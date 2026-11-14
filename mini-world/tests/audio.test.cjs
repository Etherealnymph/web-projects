// These fakes record the actual SFX class's Web Audio graph and scheduling calls.
// They do not synthesize audio, measure latency/loudness, or replace listening tests.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'audio.js'), 'utf8');

class FakeParam {
  constructor(value = 0) { this.value = value; this.events = []; }
  record(method, value, time, extra) { this.events.push({ method, value, time, extra }); }
  setValueAtTime(value, time) { this.record('set', value, time); }
  linearRampToValueAtTime(value, time) { this.record('linear', value, time); }
  exponentialRampToValueAtTime(value, time) { this.record('exponential', value, time); }
  setTargetAtTime(value, time, constant) { this.record('target', value, time, constant); }
}

class FakeNode {
  constructor(kind) {
    this.kind = kind;
    this.connections = new Set();
    this.disconnectCount = 0;
    this.starts = [];
    this.stops = [];
  }
  connect(node) { this.connections.add(node); return node; }
  disconnect() { this.disconnectCount += 1; this.connections.clear(); }
  start(...args) { this.starts.push(args); }
  stop(...args) { this.stops.push(args); }
  finish() { this.onended?.(); }
}

function harness({ stereo = true, available = true } = {}) {
  const contexts = [];
  const clock = { now: 1000 };
  class FakeAudioContext {
    constructor(options) {
      this.options = options;
      this.state = 'running';
      this.currentTime = 12;
      this.sampleRate = 8000;
      this.nodes = [];
      this.buffers = [];
      this.destination = new FakeNode('destination');
      this.suspendCount = 0;
      this.resumeCount = 0;
      if (!stereo) this.createStereoPanner = undefined;
      contexts.push(this);
    }
    node(kind, parameters = []) {
      const node = new FakeNode(kind);
      for (const parameter of parameters) node[parameter] = new FakeParam();
      this.nodes.push(node);
      return node;
    }
    createGain() { return this.node('gain', ['gain']); }
    createBiquadFilter() { return this.node('filter', ['frequency']); }
    createOscillator() { return this.node('oscillator', ['frequency']); }
    createStereoPanner() { return this.node('panner', ['pan']); }
    createBufferSource() { return this.node('buffer-source'); }
    createDynamicsCompressor() { return this.node('compressor', ['threshold', 'knee', 'ratio', 'attack', 'release']); }
    createBuffer(channels, length, sampleRate) {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      const buffer = { numberOfChannels: channels, length, sampleRate, getChannelData: (channel) => data[channel] };
      this.buffers.push(buffer);
      return buffer;
    }
    suspend() { this.suspendCount += 1; this.state = 'suspended'; return Promise.resolve(); }
    resume() { this.resumeCount += 1; this.state = 'running'; return Promise.resolve(); }
  }
  const document = { hidden: false };
  const context = vm.createContext({
    document,
    performance: { now: () => clock.now },
    setTimeout, clearTimeout,
    window: {
      MW: { clamp: (value, min, max) => Math.min(max, Math.max(min, value)), WEAPONS: { rocket: { kind: 'launcher' } } },
      ...(available ? { AudioContext: FakeAudioContext } : {}),
    },
  });
  vm.runInContext(source, context, { filename: 'audio.js' });
  return { sfx: context.window.MW.SFX, contexts, document, clock };
}

function playing(overrides = {}) {
  return {
    state: 'playing', paused: false, panelOpen: false, intro: false, weather: 'clear',
    player: { pos: { x: 0, y: 0, z: 0 }, yaw: 0, inWater: false },
    world: { mapSampleAt: () => ({ surface: 'ground' }) },
    inVehicle: { type: 'car', currentSpeed: 20, speed: 40 },
    ...overrides,
  };
}

const target = (param) => param.events.filter((event) => event.method === 'target').at(-1)?.value;
const peak = (param) => param.events.find((event) => event.method === 'linear')?.value;
const lastNode = (ctx, kind) => ctx.nodes.filter((node) => node.kind === kind).at(-1);
function approx(actual, expected, tolerance = 1e-10) { assert.ok(Math.abs(actual - expected) < tolerance, `${actual} should be close to ${expected}`); }

test('initialization is idempotent and transient noise reuses one buffer and two permanent sources', () => {
  const { sfx, contexts } = harness();
  sfx.init();
  const ctx = sfx.ctx;
  const loops = sfx.loops;
  const buffer = sfx.noiseBuffer;
  const initialNodes = ctx.nodes.length;
  for (let i = 0; i < 6; i++) sfx.init();
  assert.equal(contexts.length, 1);
  assert.equal(sfx.loops, loops);
  assert.equal(ctx.nodes.length, initialNodes);
  assert.equal(ctx.buffers.length, 1);
  assert.equal(buffer.length, ctx.sampleRate * 3);
  assert.equal(loops.ambient.buffer, buffer);
  assert.equal(loops.ambient.loop, true);
  assert.equal(loops.ambient.starts.length, 1);
  assert.equal(loops.engine.starts.length, 1);
  assert.equal(ctx.nodes.filter((node) => node.starts.length).length, 2);
  assert.equal(sfx.voices.size, 0, 'persistent ambience and engine do not consume transient voices');
  sfx.noise(0.1, 'lowpass', 500, 0.2);
  sfx.noise(0.2, 'highpass', 1800, 0.1);
  assert.equal(ctx.buffers.length, 1);
  assert.ok([...sfx.voices].every((voice) => voice.buffer === buffer));
});

test('volume controls clamp finite inputs and keep effects independent from ambience and engine buses', () => {
  const { sfx } = harness();
  sfx.configure({ masterVolume: -2, effectsVolume: 5, ambienceVolume: -1, engineVolume: 2 });
  assert.deepEqual({ ...sfx.volumes }, { master: 0, effects: 1, ambience: 0, engine: 1 });
  sfx.configure({ masterVolume: 0.6, effectsVolume: 0, ambienceVolume: 0.5, engineVolume: 0.4 });
  sfx.configure({ masterVolume: NaN, effectsVolume: Infinity, ambienceVolume: '0.1' });
  assert.deepEqual({ ...sfx.volumes }, { master: 0.6, effects: 0, ambience: 0.5, engine: 0.4 });
  sfx.init();
  assert.equal(sfx.master.gain.value, 0.6);
  assert.equal(sfx.effects.gain.value, 0);
  assert.ok(sfx.effects.connections.has(sfx.master));
  assert.ok(sfx.loops.gain.connections.has(sfx.master));
  assert.ok(sfx.loops.engineGain.connections.has(sfx.master));
  assert.ok(sfx.master.connections.has(sfx.limiter));
  assert.ok(sfx.limiter.connections.has(sfx.ctx.destination));
  sfx.update(playing());
  assert.ok(target(sfx.loops.gain.gain) > 0, 'muting effects does not mute ambience');
  assert.ok(target(sfx.loops.engineGain.gain) > 0, 'muting effects does not mute the engine');
  sfx.configure({ audio: false });
  assert.equal(target(sfx.master.gain), 0);
  const nodeCount = sfx.ctx.nodes.length;
  sfx.tone(440, 0.1); sfx.noise(0.1);
  assert.equal(sfx.ctx.nodes.length, nodeCount, 'disabled audio does not allocate effect nodes');
  sfx.toggle(true);
  assert.equal(target(sfx.master.gain), 0.6, 're-enabling restores the chosen master volume');
});

test('spatial effects pan left/right relative to listener yaw and attenuate by three-dimensional distance', () => {
  const { sfx } = harness();
  sfx.init();
  sfx.update(playing({ player: { pos: { x: 10, y: 2, z: -20 }, yaw: 0, inWater: false } }));
  sfx.at({ x: 42, y: 2, z: -20 }, () => sfx.tone(440, 0.1, 'sine', 0.4));
  assert.equal(lastNode(sfx.ctx, 'panner').pan.value, 1);
  approx(peak(lastNode(sfx.ctx, 'gain').gain), 0.4 / Math.pow(2, 1.4));
  sfx.at({ x: -22, y: 2, z: -20 }, () => sfx.noise(0.1, 'lowpass', 600, 0.4, 0.7));
  assert.equal(lastNode(sfx.ctx, 'panner').pan.value, -1, 'world position overrides a flat pan argument');
  sfx.listener.yaw = Math.PI / 2;
  sfx.at({ x: 10, y: 2, z: -52 }, () => sfx.tone(440, 0.1));
  approx(lastNode(sfx.ctx, 'panner').pan.value, 1);
  sfx.at({ x: 10, y: 34, z: -20 }, () => sfx.tone(440, 0.1, 'sine', 0.4));
  assert.equal(lastNode(sfx.ctx, 'panner').pan.value, 0);
  approx(peak(lastNode(sfx.ctx, 'gain').gain), 0.4 / Math.pow(2, 1.4), 1e-9);
  assert.equal(sfx.spatial, null, 'spatial settings do not leak into later UI sounds');
});

test('effects beyond 650 metres are culled before allocation; the boundary and vertical distance are respected', () => {
  const { sfx } = harness();
  sfx.init();
  const initialNodes = sfx.ctx.nodes.length;
  let called = false;
  sfx.at({ x: 650.01, y: 0, z: 0 }, () => { called = true; sfx.explosion(1); });
  sfx.explosion(1, { x: 0, y: 651, z: 0 });
  assert.equal(called, false);
  assert.equal(sfx.ctx.nodes.length, initialNodes);
  sfx.at({ x: 650, y: 0, z: 0 }, () => sfx.tone(440, 0.1));
  assert.equal(sfx.voices.size, 1);
  assert.equal(lastNode(sfx.ctx, 'panner').pan.value, 1);
});

test('nested spatial calls restore their parent context even when an effect callback throws', () => {
  const { sfx } = harness();
  const original = { gain: 0.7, pan: 0.2 };
  sfx.spatial = original;
  assert.throws(() => sfx.at({ x: 20, y: 0, z: 0 }, () => {
    const outer = sfx.spatial;
    assert.throws(() => sfx.at({ x: -10, y: 0, z: 0 }, () => { throw new Error('effect failed'); }), /effect failed/);
    assert.equal(sfx.spatial, outer);
    throw new Error('outer failed');
  }), /outer failed/);
  assert.equal(sfx.spatial, original);
});

test('rapid mixed fire cannot exceed 40 transient sources and ended voices disconnect all private nodes', () => {
  const { sfx } = harness();
  sfx.init();
  for (let i = 0; i < 39; i++) {
    if (i % 2) sfx.noise(0.1, 'lowpass', 1200, 0.2);
    else sfx.tone(440, 0.1, 'sine', 0.2);
  }
  sfx.explosion(1); // Multiple layers must respect the remaining single voice slot.
  assert.equal(sfx.voices.size, 40);
  const allocated = sfx.ctx.nodes.length;
  for (let i = 0; i < 100; i++) { sfx.shoot('rocket'); sfx.tone(880, 0.05); sfx.noise(0.05); }
  assert.equal(sfx.voices.size, 40);
  assert.equal(sfx.ctx.nodes.length, allocated, 'saturated effects allocate no extra nodes');
  const voices = [...sfx.voices];
  const privateNodes = [];
  for (const voice of voices) {
    const visit = (node) => {
      if (node === sfx.effects || node === sfx.master || node === sfx.limiter) return;
      privateNodes.push(node);
      for (const next of node.connections) visit(next);
    };
    visit(voice);
    assert.equal(voice.starts.length, 1);
    assert.equal(voice.stops.length, 1);
    assert.ok(voice.stops[0][0] > sfx.ctx.currentTime);
    voice.finish();
  }
  assert.equal(sfx.voices.size, 0);
  assert.ok(privateNodes.every((node) => node.disconnectCount === 1 && node.connections.size === 0));
  assert.equal(sfx.effects.disconnectCount, 0);
  assert.equal(sfx.loops.ambient.disconnectCount, 0);
  assert.equal(sfx.loops.engine.disconnectCount, 0);
  sfx.tone(440, 0.1);
  assert.equal(sfx.voices.size, 1, 'released voice slots can be reused');
  assert.equal(sfx.ctx.buffers.length, 1);
});

test('pause, panels, intro, menu and hidden tabs fade continuous sounds to zero and playing restores them', () => {
  const { sfx, document } = harness();
  sfx.init();
  for (const override of [{ paused: true }, { panelOpen: 'settings' }, { intro: true }, { state: 'menu' }]) {
    sfx.update(playing());
    assert.ok(target(sfx.loops.gain.gain) > 0);
    assert.ok(target(sfx.loops.engineGain.gain) > 0);
    sfx.update(playing(override));
    assert.equal(target(sfx.loops.gain.gain), 0);
    assert.equal(target(sfx.loops.engineGain.gain), 0);
  }
  document.hidden = true;
  sfx.update(playing());
  assert.equal(target(sfx.loops.gain.gain), 0);
  assert.equal(target(sfx.loops.engineGain.gain), 0);
  const nodes = sfx.ctx.nodes.length;
  sfx.explosion(1);
  assert.equal(sfx.ctx.nodes.length, nodes, 'hidden tabs do not start one-shot effects');
  document.hidden = false;
  sfx.update(playing());
  assert.ok(target(sfx.loops.gain.gain) > 0);
  assert.ok(target(sfx.loops.engineGain.gain) > 0);
  sfx.stopLoops();
  assert.equal(target(sfx.loops.gain.gain), 0);
  assert.equal(target(sfx.loops.engineGain.gain), 0);
});

test('visibility suspension is idempotent and init resumes only a visible existing context', () => {
  const { sfx, document, contexts } = harness();
  sfx.init();
  const loops = sfx.loops;
  const buffer = sfx.noiseBuffer;
  sfx.suspend(); sfx.suspend();
  assert.equal(sfx.ctx.state, 'suspended');
  assert.equal(sfx.ctx.suspendCount, 1);
  const nodes = sfx.ctx.nodes.length;
  sfx.tone(440, 0.1);
  assert.equal(sfx.ctx.nodes.length, nodes);
  document.hidden = true;
  sfx.init();
  assert.equal(sfx.ctx.resumeCount, 0);
  document.hidden = false;
  sfx.init(); sfx.init();
  assert.equal(sfx.ctx.resumeCount, 1);
  assert.equal(sfx.ctx.state, 'running');
  assert.equal(contexts.length, 1);
  assert.equal(sfx.loops, loops);
  assert.equal(sfx.noiseBuffer, buffer);
  assert.equal(sfx.ctx.nodes.length, nodes);
});

test('older browsers without a stereo panner still route effects through the effects bus and release them', () => {
  const { sfx } = harness({ stereo: false });
  sfx.init();
  sfx.tone(440, 0.1); sfx.noise(0.1);
  assert.equal(sfx.voices.size, 2);
  assert.equal(sfx.ctx.nodes.some((node) => node.kind === 'panner'), false);
  const effectGains = sfx.ctx.nodes.filter((node) => node.kind === 'gain' && node.connections.has(sfx.effects));
  assert.equal(effectGains.length, 2);
  for (const voice of [...sfx.voices]) voice.finish();
  assert.ok(effectGains.every((node) => node.disconnectCount === 1));
  assert.equal(sfx.voices.size, 0);
});

test('missing Web Audio support degrades silently without allocating a context', () => {
  const { sfx, contexts } = harness({ available: false });
  assert.doesNotThrow(() => {
    sfx.init(); sfx.configure({ masterVolume: 0.3 }); sfx.tone(440, 0.1); sfx.noise(0.1);
    sfx.update(playing()); sfx.stopLoops(); sfx.suspend();
  });
  assert.equal(sfx.ctx, null);
  assert.equal(contexts.length, 0);
  assert.equal(sfx.voices.size, 0);
});
