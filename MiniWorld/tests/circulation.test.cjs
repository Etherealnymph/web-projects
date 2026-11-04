const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const THREE = require('../vendor/three.min.js');
const noop = () => {};
const paint = new Proxy(
  {
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createLinearGradient: () => ({ addColorStop: noop }),
    measureText: (s) => ({ width: s.length * 8 }),
  },
  { get: (o, k) => o[k] || noop },
);
const c = vm.createContext({
  THREE,
  console,
  performance,
  Math,
  Date,
  Map,
  Set,
  Uint8Array,
  Uint8ClampedArray,
  Float32Array,
  setTimeout: () => 0,
  clearTimeout: noop,
  document: {
    createElement: () => ({ getContext: () => paint }),
    readyState: 'loading',
    addEventListener: noop,
  },
  localStorage: { getItem: () => null },
});
c.window = c;
for (const name of [
  'data',
  'util',
  'geography',
  'terrain',
  'circulation',
  'world',
  'places',
  'worldgen',
  'models',
  'vehicle-models',
  'audio',
  'entities',
  'combat',
  'player',
  'game',
])
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', name + '.js'), 'utf8'), c, {
    filename: name + '.js',
  });
const MW = c.MW;
function fixture() {
  const g = {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(),
    world: new MW.VoxelWorld({ bounds: 120, fallbackY: 0 }),
    settings: { ...MW.DEFAULT_SETTINGS },
    ui: { toast: noop },
    doors: [],
    elevators: [],
    inVehicle: null,
    collidesDoor(x, y, z, r, h) {
      return this.elevators.some((e) => e.collidesBox(x, y, z, r, h));
    },
  };
  g.player = new MW.Player(g);
  return g;
}
function tick(e, seconds) {
  for (let i = 0; i < seconds * 60; i++) e.update(1 / 60);
}
function walk(p, x, z) {
  for (let i = 0; i < 600; i++) {
    const dx = x - p.pos.x,
      dz = z - p.pos.z,
      d = Math.hypot(dx, dz);
    if (d < 0.04) return;
    p.vel.set((dx / d) * 2, -1, (dz / d) * 2);
    p.moveWithCollision(1 / 60);
  }
  assert.fail('walk blocked at ' + p.pos.toArray() + ' target ' + [x, z]);
}
test('switchback stairs traverse both flights/landings with 20 cm risers and full headroom', () => {
  const g = fixture(),
    s = { x: 0, y: 1, z: 0, levels: 3 };
  g.world.meta.stairways = [s];
  g.world.rebuildPrecision();
  const p = g.player;
  p.pos.set(1.3, 1.004, -0.7);
  p.onGround = true;
  for (let f = 0; f < 3; f++) {
    walk(p, 1.3, 4.8);
    assert.ok(Math.abs(p.pos.y - (3 + f * 4)) < 0.05);
    walk(p, 4.3, 4.8);
    walk(p, 4.3, -0.8);
    assert.ok(Math.abs(p.pos.y - (5 + f * 4)) < 0.05);
    if (f < 2) walk(p, 1.3, -0.8);
  }
  for (let f = 2; f >= 0; f--) {
    walk(p, 4.3, 4.8);
    walk(p, 1.3, 4.8);
    walk(p, 1.3, -0.8);
    assert.ok(Math.abs(p.pos.y - (1 + f * 4)) < 0.06);
    if (f > 0) walk(p, 4.3, -0.8);
  }
  assert.equal(g.world.precision.meshes.length, 1);
  g.world.dispose();
});
test('generated modern floors connect stairs without a solid floor over the stair opening; precision survives serialization', () => {
  const g = fixture();
  const b = new MW.Builder(g.world, 41);
  b.modern(0, 0, 20, 20, 0, 12, { rooms: false, desk: false });
  g.world.meta.stairways = b.stairways;
  g.world.endGeneration();
  const s = b.stairways[0];
  for (let f = 0; f < 3; f++) {
    assert.equal(g.world.collidesBox(s.x - 3.3, s.y + 4 * f + 0.01, s.z - 1, 0.28, 1.78), false);
    assert.equal(g.world.collidesBox(s.x + 1.3, s.y + 4 * f + 1.205, s.z + 1.8, 0.28, 1.78), false);
  }
  const serialized = g.world.serialize(),
    copy = new MW.VoxelWorld(serialized.meta);
  copy.loadSerialized(serialized);
  assert.equal(copy.precision.meshes.length, 1);
  assert.equal(copy.precision.collidesBox(s.x + 1.3, s.y + 0.1, s.z + 0.2, 0.2, 1.7), true);
  copy.dispose();
  g.world.dispose();
});
test('every floor can call a remote cabin without teleporting the passenger; ownership is exclusive', () => {
  const g = fixture(),
    a = new MW.CabinLift(g, { x: 0, y: 0, z: 0, floors: 5 }),
    b = new MW.CabinLift(g, { x: 20, y: 0, z: 0, floors: 5 });
  g.elevators = [a, b];
  const p = g.player;
  p.pos.set(0, 13, 3.3);
  p.vel.set(0, 0, 0);
  assert.equal(a.requestRide(1, p), true);
  assert.equal(p.elevatorRide, undefined);
  assert.equal(p.pos.y, 13);
  tick(a, 6);
  assert.equal(p.elevatorRide, a);
  assert.equal(b.requestRide(0, p), false);
  const before = p.pos.clone();
  b.update(1);
  assert.ok(before.equals(p.pos));
  tick(a, 6);
  assert.equal(p.elevatorRide, null);
  assert.ok(Math.abs(p.pos.y - 5.025) < 0.01);
  a.dispose();
  b.dispose();
});
test('floor calls reject non-integers, out-of-range and nonlocal boarding; travel time grows with distance', () => {
  const g = fixture(),
    e = new MW.CabinLift(g, { x: 0, y: 0, z: 0, floors: 6 });
  g.player.pos.set(0, 1, 3.3);
  for (const value of [-1, 6, 1.5, NaN, Infinity, '2', null])
    assert.equal(e.requestRide(value, g.player), false);
  g.player.pos.x = 100;
  assert.equal(e.requestRide(1, g.player), false);
  g.player.pos.x = 0;
  e.requestRide(1, g.player);
  const short = e.duration;
  tick(e, 4);
  e.requestRide(5, g.player);
  assert.ok(e.duration > short * 3);
  e.dispose();
  assert.equal(g.player.elevatorRide, null);
  assert.throws(() => new MW.CabinLift(g, { x: 0, y: 0, z: 0, floors: 1e9 }));
});
test('blocked arrival keeps passenger safely in their cabin; dispose releases owned resources once', () => {
  const g = fixture(),
    e = new MW.CabinLift(g, { x: 0, y: 0, z: 0, floors: 3 });
  g.player.pos.set(0, 1, 3.3);
  e.requestRide(1, g.player);
  g.world.collidesBox = () => true;
  tick(e, 5);
  assert.equal(e.state, 'open');
  assert.equal(g.player.elevatorRide, e);
  assert.equal(e.exit(), false);
  const resources = new Set();
  e.mesh.traverse((o) => {
    if (o.geometry) resources.add(o.geometry);
    if (o.material) resources.add(o.material);
  });
  let n = 0;
  for (const r of resources) r.addEventListener('dispose', () => n++);
  e.dispose();
  e.dispose();
  assert.equal(n, resources.size);
  assert.equal(g.player.elevatorRide, null);
  assert.equal(e.mesh.parent, null);
});
test('ground approach joins the landing without a metre-high jump or an entrance railing', () => {
  const g = fixture();
  g.world.meta.stairways = [{ x: 0, y: 1, z: 0, levels: 2 }];
  g.world.rebuildPrecision();
  const p = g.player;
  p.pos.set(4.3, 0, -5.5);
  p.onGround = true;
  walk(p, 4.3, -0.8);
  assert.ok(Math.abs(p.pos.y - 1.004) < 0.02);
  g.world.dispose();
});
test('remote caller walking away cancels boarding; teleport release prevents a moving cabin reclaiming them', () => {
  const g = fixture(),
    e = new MW.CabinLift(g, { x: 0, y: 0, z: 0, floors: 4 });
  g.player.pos.set(0, 9, 3.3);
  e.requestRide(0, g.player);
  g.player.pos.x = 20;
  tick(e, 8);
  assert.equal(e.passenger, null);
  assert.equal(e.pending, null);
  g.player.pos.set(0, 9, 3.3);
  e.requestRide(0, g.player);
  e.release(g.player);
  g.player.pos.set(50, 0, 50);
  tick(e, 8);
  assert.deepEqual(g.player.pos.toArray(), [50, 0, 50]);
  e.dispose();
});
test('four regions contain reachable distinct discoveries and finite bounded streamed detail', () => {
  for (const id of ['beijing', 'washington', 'tokyo', 'earth']) {
    const w = MW.WorldGen.generate(MW.WORLDS.find((d) => d.id === id));
    assert.ok(w.meta.discoveries.length >= (id === 'earth' ? 16 : 4), id);
    assert.equal(new Set(w.meta.discoveries.map((d) => d.id)).size, w.meta.discoveries.length);
    for (const d of w.meta.discoveries) {
      const y = w.surfaceAt(d.x, d.z);
      assert.ok(Math.abs(y - d.y) < 1.1, id + ' ' + d.name + ' arrival height ' + y + ' vs ' + d.y);
      assert.equal(
        w.collidesBox(d.x, y + 0.03, d.z, 0.34, 1.78),
        false,
        id + ' ' + d.name + ' arrival clear',
      );
    }
    if (id === 'earth') {
      assert.equal(w.meta.expeditions.length, 8);
      assert.ok(
        [...w.terrain.chunks.values()].some((c) => c.scenery),
        'continental landscape includes local scenery',
      );
    } else {
      w.terrain.prepareAt(1100, 400);
      assert.ok(
        [...w.terrain.lots.values()].some((l) => l?.props?.length >= 8),
        'street props are deterministic',
      );
    }
    assert.ok(w.terrain.chunks.size <= 169);
    assert.ok(w.terrain.lots.size <= 1024);
    w.dispose();
  }
});
test('discovery rewards are once-only, require walking nearby and reject altitude flyovers', () => {
  const g = fixture();
  g.world.meta.discoveries = [{ id: 'garden', x: 0, y: 0, z: 0, name: 'Garden', r: 6 }];
  g.ui.renderDestinations = noop;
  g.saveLater = noop;
  const journal = new MW.FieldJournal(g);
  g.player.pos.set(0, 100, 0);
  const coins = g.player.coins;
  journal.update(1);
  assert.equal(g.player.coins, coins);
  g.player.pos.y = 0;
  journal.update(1);
  journal.update(1);
  assert.equal(g.player.coins, coins + 15);
  assert.equal(journal.visited.size, 1);
});
