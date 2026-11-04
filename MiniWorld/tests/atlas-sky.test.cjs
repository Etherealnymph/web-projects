// Atlas interaction and camera-relative scene-state checks. These do not claim
// to validate a WebGL renderer or screenshots in a browser without a GPU.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const THREE = require('../vendor/three.min.js');
const noop = () => {};
const elements = new Map();
let lastRaster;
function element() {
  const handlers = new Map();
  const paint = new Proxy({
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    putImageData: image => { lastRaster = image; },
    measureText: text => ({ width: text.length * 8 })
  }, { get: (o, p) => p in o ? o[p] : noop });
  return {
    width: 900, height: 900, handlers, getContext: () => paint, setPointerCapture: noop,
    getBoundingClientRect: () => ({ left: 100, top: 50, width: 450, height: 450 }),
    addEventListener(type, fn) { if (!handlers.has(type)) handlers.set(type, []); handlers.get(type).push(fn); },
    appendChild: noop, setAttribute: noop, remove: noop, classList: { add: noop, remove: noop, toggle: noop }
  };
}
const sandbox = { THREE, console, Math, Date, Map, Set, Float32Array, Uint8Array, Uint8ClampedArray,
  innerWidth: 1280, innerHeight: 720, requestAnimationFrame: () => 1,
  document: { readyState: 'loading', addEventListener: noop, createElement: element,
    getElementById: id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); } },
  localStorage: { getItem: () => null } };
sandbox.window = sandbox;
const context = vm.createContext(sandbox);
for (const file of ['data', 'util', 'models', 'ui', 'expedition-ui', 'game'])
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file + '.js'), 'utf8'), context, { filename: file + '.js' });
const MW = sandbox.MW;
function ui() {
  const view = Object.create(MW.UI.prototype);
  view.g = { world: { meta: { terrain: {}, bounds: 20015114, travelBounds: 20015114, travelBoundsZ: 10007500, name: 'Earth' } },
    player: { pos: { x: 12900000, z: -4400000 }, yaw: 0 }, zones: [], ships: [], vehicles: [] };
  view.mapZoom = 20000;
  const scale = 858 / (2 * view.g.world.meta.bounds + 2) * view.mapZoom;
  view.mapPan = { x: -view.g.player.pos.x * scale, y: -view.g.player.pos.z * scale };
  return view;
}
function under(view, x, y) {
  const scale = 858 / (2 * view.g.world.meta.bounds + 2) * view.mapZoom;
  return { x: (x - 450 - view.mapPan.x) / scale, z: (y - 450 - view.mapPan.y) / scale };
}

test('atlas binds one wheel handler and keeps a geographic coordinate under the pointer', () => {
  const view = ui();
  view.bindMapEvents(); view.bindMapEvents();
  const canvas = view.$('world-map-canvas');
  assert.equal(canvas.handlers.get('wheel').length, 1);
  const before = under(view, 400, 600);
  canvas.handlers.get('wheel')[0]({ preventDefault: noop, deltaY: -100, deltaMode: 0, clientX: 300, clientY: 350 });
  const after = under(view, 400, 600);
  assert.ok(Math.abs(before.x - after.x) < 1e-6);
  assert.ok(Math.abs(before.z - after.z) < 1e-6);
});

test('zoom buttons preserve the current centre at continental coordinates', () => {
  const view = ui();
  const before = under(view, 450, 450);
  view.zoomMapAt(view.mapZoom * 1.5);
  view.zoomMapAt(view.mapZoom / 1.5);
  const after = under(view, 450, 450);
  assert.ok(Math.abs(before.x - after.x) < 1e-6);
  assert.ok(Math.abs(before.z - after.z) < 1e-6);
});

test('atlas never samples beyond latitude bounds, and colour edits invalidate its raster', () => {
  const view = ui();
  let samples = 0;
  Object.assign(view.g.world, { blockCount: 10, revision: 0,
    meta: { terrain: {}, bounds: 100, travelBounds: 100, travelBoundsZ: 50, name: 'Test' },
    mapSampleAt(x, z) { assert.ok(Math.abs(x) <= 100); assert.ok(Math.abs(z) <= 50); samples++; return { c: 0x668899 }; } });
  view.mapZoom = 1; view.mapPan = { x: 0, y: 0 };
  view.g.player.pos = { x: 0, z: 0 };
  view.drawWorldMap();
  assert.ok(samples > 0 && samples < 192 * 192);
  assert.deepEqual(Array.from(lastRaster.data.slice(0, 4)), [8, 25, 37, 255]);
  const first = samples;
  view.drawWorldMap(); assert.equal(samples, first);
  view.g.world.revision++;
  view.drawWorldMap(); assert.ok(samples > first);
});

test('sky, stars and sun retain local precision after a continental camera move', () => {
  const game = Object.create(MW.Game.prototype);
  game.weather = 'clear'; game.season = 'summer';
  game.initScene();
  const camera = game.camera;
  camera.far = 1850; camera.position.set(12900000, 430, -4400000); camera.updateMatrixWorld();
  for (const object of [game.sky, game.stars, game.sunSprite]) object.onBeforeRender(null, null, camera);
  assert.equal(game.sky.position.distanceTo(camera.position), 0);
  assert.equal(game.stars.position.distanceTo(camera.position), 0);
  assert.ok(Math.abs(game.sunSprite.position.distanceTo(camera.position) - camera.far * 0.88) < 1e-6);
  assert.equal(game.sky.material.depthTest, false);
  assert.ok(game.sky.material.vertexShader.includes('vWorld = position;'));
  assert.ok(game.sky.renderOrder < 0);
  const modelView = new THREE.Matrix4().multiplyMatrices(camera.matrixWorldInverse, game.sky.matrixWorld);
  assert.ok(Math.abs(modelView.elements[12]) < 1e-6);
  assert.ok(Math.abs(modelView.elements[13]) < 1e-6);
  assert.ok(Math.abs(modelView.elements[14]) < 1e-6);
  // Menu camera returns close to the origin without needing a simulation tick.
  camera.position.set(0, 6, 16); camera.updateMatrixWorld();
  for (const object of [game.sky, game.stars, game.sunSprite]) object.onBeforeRender(null, null, camera);
  assert.equal(game.sky.position.distanceTo(camera.position), 0);
});
