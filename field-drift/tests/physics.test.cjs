const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = vm.createContext({ window: {}, console, Math });
for (const file of ['core', 'field', 'physics', 'levels', 'experiments'])
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file + '.js'), 'utf8'), context);
const { V, Sources, Physics: P, EXPERIMENTS, createExperiment } = context.window.FD;
const zero = () => ({ x: 0, y: 0, z: 0 });
function close(actual, expected, tolerance = 1e-7) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected} ± ${tolerance}`);
}

test('pure magnetic rotation preserves speed over 24000 steps', () => {
  let v = { x: 0.7, y: 0.1, z: 0.1 };
  const initial = V.len(v);
  for (let i = 0; i < 24000; i++) v = P.boris(v, zero(), { x: 0, y: 0, z: 0.8 }, 1, 0, zero(), 1 / 240);
  close(V.len(v), initial, 1e-11);
});
test('parallel electric acceleration agrees with p=qEt and remains subluminal', () => {
  let v = zero();
  for (let i = 0; i < 2400; i++) v = P.boris(v, { x: 0.5, y: 0, z: 0 }, zero(), 1, 0, zero(), 1 / 240);
  close(v.x, 5 / Math.sqrt(26), 1e-10);
  assert.ok(V.len(v) < 1);
});
test('zero force and both electric-magnetic force cancellation are handled', () => {
  close(P.residual(zero(), { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0.2 }), 0);
  close(P.residual({ x: 0, y: 0.2, z: 0 }, { x: 0, y: 0, z: 0.5 }, { x: 0.4, y: 0, z: 0 }), 0);
  const out = zero();
  assert.equal(
    context.window.FD.driftVelocity({ x: 0.2, y: 0, z: 0.1 }, { x: 0, y: 0, z: 1 }, out),
    false,
  );
  assert.equal(context.window.FD.driftVelocity({ x: 2, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, out), false);
});
test('field invariants survive Lorentz transformations', () => {
  const E = { x: 0.5, y: -0.2, z: 0.1 },
    B = { x: 0.1, y: 0.3, z: 0.7 },
    Ep = zero(),
    Bp = zero();
  context.window.FD.transformFields(E, B, { x: 0.7, y: 0.1, z: -0.2 }, Ep, Bp);
  close(V.dot(Ep, Bp), V.dot(E, B));
  close(V.len2(Ep) - V.len2(Bp), V.len2(E) - V.len2(B));
});
test('zero distributed charges and currents stay zero', () => {
  const src = new Sources([
    { type: 'lineQ', a: [0, 0, 0], b: [0, 3, 0], lambda: 0 },
    { type: 'sheetQ', c: [0, 0, 0], n: [0, 0, 1], u: [1, 0, 0], hw: 2, hh: 2, sigma: 0 },
    { type: 'cylQ', a: [0, 0, 0], b: [0, 3, 0], r: 1, rho: 0 },
    { type: 'cylI', a: [0, 0, 0], b: [0, 3, 0], r: 1, I: 0 },
  ]);
  const E = zero(),
    B = zero();
  src.sample({ x: 3, y: 4, z: 1 }, E, B);
  close(V.len(E), 0);
  close(V.len(B), 0);
});
test('softened electric field equals negative potential gradient', () => {
  const source = new Sources([
    { type: 'q', p: [0, 0, 0], q: 2 },
    { type: 'dipoleE', p: [0, 1, 0], m: [1, 2, 3] },
  ]);
  const p = { x: 1.2, y: 0.3, z: 0.8 },
    E = zero(),
    B = zero();
  source.sample(p, E, B);
  for (const axis of ['x', 'y', 'z']) {
    const a = {},
      b = {},
      h = 1e-5;
    source.potential({ ...p, [axis]: p[axis] + h }, a);
    source.potential({ ...p, [axis]: p[axis] - h }, b);
    close(E[axis], -(a.phi - b.phi) / (2 * h));
  }
});
test('softened magnetic dipole and finite wire agree with curl A', () => {
  const source = new Sources([
    { type: 'dipoleB', p: [0, 0, 0], m: [1, 2, 3] },
    { type: 'wire', a: [1, -4, 0], b: [1, 4, 0], I: 0.2 },
  ]);
  const p = { x: 0.2, y: 0.3, z: 0.4 },
    E = zero(),
    B = zero(),
    derivative = {};
  source.sample(p, E, B);
  for (const axis of ['x', 'y', 'z']) {
    const a = {},
      b = {},
      h = 1e-5;
    source.potential({ ...p, [axis]: p[axis] + h }, a);
    source.potential({ ...p, [axis]: p[axis] - h }, b);
    derivative[axis] = ['ax', 'ay', 'az'].map((key) => (a[key] - b[key]) / (2 * h));
  }
  close(B.x, derivative.y[2] - derivative.z[1]);
  close(B.y, derivative.z[0] - derivative.x[2]);
  close(B.z, derivative.x[1] - derivative.y[0]);
});
test('potential validity flags regional field approximations', () => {
  assert.equal(new Sources([{ type: 'E', dir: [1, 0, 0], mag: 1 }]).potentialValid, true);
  assert.equal(
    new Sources([
      { type: 'E', dir: [1, 0, 0], mag: 1, region: { type: 'box', c: [0, 0, 0], h: [1, 1, 1] } },
    ]).potentialValid,
    false,
  );
});
function run(id, values, seconds) {
  const model = createExperiment(
    EXPERIMENTS.find((x) => x.id === id),
    values,
  );
  for (let i = 0; i < seconds * 240 && !model.ended; i++) model.step(1 / 240);
  return model;
}
test('pendulum and orbit conserve energy, orbit conserves angular momentum', () => {
  for (const id of ['pendulum', 'orbit']) {
    const initial = run(id, {}, 0).observe(),
      end = run(id, {}, 20).observe();
    close(end.kinetic + end.potential, initial.kinetic + initial.potential, 1e-5);
    if (id === 'orbit') {
      close(end.x * end.vy - end.y * end.vx, initial.x * initial.vy - initial.y * initial.vx, 1e-7);
      close(Math.hypot(end.x, end.y), 2, 1e-7);
    }
  }
});
test('vacuum projectile range agrees with analytic solution and drag reduces range', () => {
  const a = run('projectile', { drag: 0, angle: 45 }, 10),
    b = run('projectile', { drag: 0.5, angle: 45 }, 10);
  assert.ok(a.ended && b.ended);
  close(a.state[0], 225 / 9.81, 0.0001);
  assert.ok(b.state[0] < a.state[0]);
});
test('Faraday emf matches minus the flux derivative and vanishes at flux extremum', () => {
  const t = 0.42,
    h = 1e-6;
  close(
    P.induction(t, 0.3, 2).emf,
    -(P.induction(t + h, 0.3, 2).flux - P.induction(t - h, 0.3, 2).flux) / (2 * h),
  );
  close(P.induction(0, 0.3, 2).emf, 0);
});
test('standing wave nodes remain fixed and integrated energy is constant', () => {
  for (let n = 1; n <= 6; n++) for (let j = 0; j <= n; j++) close(P.standingWave(j / n, 0.37, n), 0);
  const initial = run('wave', {}, 0).observe(),
    end = run('wave', {}, 3).observe();
  close(initial.kinetic + initial.potential, end.kinetic + end.potential);
});
test('all nine cases remain finite through full observations at parameter extremes', () => {
  for (const definition of EXPERIMENTS)
    for (const boundary of ['min', 'max']) {
      const values = Object.fromEntries(definition.params.map((p) => [p.key, p[boundary]]));
      const model = run(definition.id, values, 40);
      assert.ok(model.state.every(Number.isFinite), definition.id);
      assert.ok(
        model.observe().metrics.every(([, value]) => Number.isFinite(value)),
        definition.id,
      );
    }
});
test('worker requests coalesce and obsolete responses never replace current lines', () => {
  const sent = [],
    received = [];
  let worker;
  class MockWorker {
    constructor() {
      worker = this;
    }
    postMessage(message) {
      sent.push(message);
    }
  }
  const c = vm.createContext({
    window: { FD: {}, Worker: MockWorker },
    Worker: MockWorker,
    location: { protocol: 'http:' },
    setTimeout,
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/field-cache.js'), 'utf8'), c);
  for (let i = 0; i < 3; i++)
    c.window.FD.requestLines({ raw: [i] }, { bounds: 10 }, (lines) => received.push(lines));
  assert.equal(sent.length, 1);
  worker.onmessage({ data: { id: sent[0].id, lines: 'old' } });
  assert.equal(sent.length, 2);
  assert.equal(received.length, 0);
  worker.onmessage({ data: { id: sent[1].id, lines: 'new' } });
  assert.deepEqual(received, ['new']);
});
