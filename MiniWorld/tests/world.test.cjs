/* Node geometry/physics regression checks; no browser or WebGL claim. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');
const THREE = require('../vendor/three.min.js');
const context2d = new Proxy({
  createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  measureText: s => ({ width: s.length * 8 }),
  createLinearGradient: () => ({ addColorStop() {} })
}, { get: (target, name) => name in target ? target[name] : () => {} });
const sandbox = { THREE, console, performance, Math, Date, Map, Set, Float32Array, Uint8Array, Uint8ClampedArray,
  document: { createElement: () => ({ getContext: () => context2d }) }, localStorage: { getItem() { return null; } } };
sandbox.window = sandbox;
const context = vm.createContext(sandbox);
for (const file of ['data.js', 'util.js', 'geography.js', 'terrain.js', 'world.js', 'worldgen.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file), 'utf8'), context, { filename: file });
const MW = sandbox.MW;

const reports = [];
function run(name, fn) { const t = performance.now(); fn(); reports.push({ name, ms: Math.round(performance.now() - t) }); }
function basic(meta = {}) { return new MW.VoxelWorld({ bounds: 96, ...meta }); }

run('merged solid cube has 12 triangles, no internal faces', () => {
  const world = basic();
  for (let x = 1; x <= 3; x++) for (let y = 0; y <= 2; y++) for (let z = 1; z <= 3; z++) world.set(x, y, z, 0x888888, 0);
  world.rebuildAllSync();
  assert.equal(world.renderStats.triangles, 12);
  assert.equal(world.collidesBox(2, 0.1, 2, 0.2, 1), true);
  const hit = world.raycast(new THREE.Vector3(2.5, 6, 2.5), new THREE.Vector3(0, -1, 0), 10);
  assert.equal(hit.y, 2);
  assert.equal(hit.ny, 1);
  for (const c of world.chunks.values()) for (const m of c.meshes) {
    assert.equal(m.frustumCulled, true);
    assert.ok(Number.isFinite(m.geometry.boundingSphere.radius));
    // The winding and supplied normal must agree on every exposed triangle.
    const p = m.geometry.attributes.position, n = m.geometry.attributes.normal, indices = m.geometry.index.array;
    for (let i = 0; i < indices.length; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(p, indices[i]);
      const b = new THREE.Vector3().fromBufferAttribute(p, indices[i + 1]);
      const c = new THREE.Vector3().fromBufferAttribute(p, indices[i + 2]);
      const face = b.sub(a).cross(c.sub(a));
      assert.ok(face.dot(new THREE.Vector3().fromBufferAttribute(n, indices[i])) > 0);
    }
  }
  world.dispose();
});

run('chunk-border edits rebuild both neighbours, including negatives', () => {
  const world = basic();
  world.set(-1, 0, 0, 0x888888, 0); world.set(0, 0, 0, 0x888888, 0);
  world.rebuildAllSync();
  assert.equal(world.renderStats.triangles, 20);
  world.remove(0, 0, 0);
  assert.ok(world.dirty.has('-1,0'));
  world.rebuildAllSync();
  assert.equal(world.renderStats.triangles, 12);
  assert.equal(world.surfaceAt(-0.4, 0.2), 1);
  world.dispose();
});

run('glass keeps a solid face behind it; top colour and saved edits survive', () => {
  const world = basic();
  world.set(1, 0, 1, 0x888888, 0); world.set(2, 0, 1, 0x99bbdd, MW.BLOCK_TYPES.GLASS);
  world.rebuildAllSync();
  assert.equal(world.renderStats.triangles, 22);
  world.set(1, 0, 1, 0x123456, 0);
  assert.equal(world.topBlock(1, 1).c, 0x123456);
  world.applyEdits([[1, 0, 1, -1, 0], [4, 2, 4, 0xffcc88, 0]]);
  assert.equal(world.exportEdits().length, 2);
  assert.equal(world.getBlock(1, 0, 1), undefined);
  assert.equal(world.getBlock(4, 2, 4).c, 0xffcc88);
  world.dispose();
});

run('geographic transforms round-trip and coast data distinguish land/ocean', () => {
  for (const origin of Object.values(MW.Geography.origins)) {
    const target = { lat: origin.lat + 0.025, lon: origin.lon + 0.035 };
    const w = MW.Geography.toWorld(target.lat, target.lon, origin);
    const result = MW.Geography.toLatLon(w.x, w.z, origin);
    assert.ok(Math.abs(result.lat - target.lat) < 1e-9);
    assert.ok(Math.abs(result.lon - target.lon) < 1e-9);
  }
  assert.ok(MW.Geography.landDistance(39.9042, 116.4074) > 0);
  assert.ok(MW.Geography.landDistance(-25.3, 133.8) > 0);
  assert.ok(MW.Geography.landDistance(0, -30) < 0);
});

run('height triangles join exactly; floor and skyline collisions are deterministic', () => {
  const def = MW.WORLDS.find(w => w.id === 'beijing');
  const world = basic({ ...def });
  const terrain = world.terrain;
  terrain.prepareAt(0, 0);
  const left = terrain.chunks.get('-1,0').mesh.geometry.attributes.position;
  const right = terrain.chunks.get('0,0').mesh.geometry.attributes.position;
  for (let row = 0; row <= 32; row++) assert.equal(left.getY(row * 33 + 32), right.getY(row * 33));
  for (const [x, z] of [[13.3, 24.2], [601.1, 814.7], [-6123.3, 7994.2]]) {
    const h = terrain.heightAt(x, z);
    assert.equal(h, terrain.heightAt(x, z));
    if (!terrain.structureAt(x, z)) {
      assert.equal(world.collidesBox(x, h - 0.2, z, 0.01, 1), true);
      assert.equal(world.collidesBox(x, h + 0.05, z, 0.01, 1), false);
      assert.equal(world.collidesBox(x, h - 0.2, z, 0.01, 1, true), false);
    }
  }
  let lot;
  for (let x = 5; x < 16 && !lot; x++) for (let z = 3; z < 8 && !lot; z++) lot = terrain._lot(x, z);
  assert.ok(lot);
  assert.equal(terrain.collidesBox(lot.x, lot.y + 2, lot.z, 0.3, 1.7, true), true);
  assert.equal(terrain.surfaceAt(lot.x, lot.z), lot.y + lot.h);
  const roof = terrain.raycast(new THREE.Vector3(lot.x, lot.y + lot.h + 20, lot.z), new THREE.Vector3(0, -1, 0), 40);
  assert.equal(roof.structure, true);
  const before = terrain.chunks.size;
  for (let i = 0; i < 1000; i++) world.mapSampleAt(i * 33, i * -23);
  assert.equal(terrain.chunks.size, before);
  world.dispose();
  assert.equal(terrain.chunks.size, 0);
  assert.equal(terrain.pending.length, 0);
});

run('streamed residency stays bounded across travel, teleport and quality changes', () => {
  const def = MW.WORLDS.find(w => w.id === 'beijing');
  const world = basic({ ...def });
  const terrain = world.terrain;
  for (let frame = 0; frame < 170; frame++) terrain.update(0.016, { x: 0, z: 0 });
  assert.equal(terrain.chunks.size, 169);
  for (let i = 0; i < 25; i++) {
    terrain.update(0.016, { x: i * 270, z: -i * 310 });
    assert.ok(terrain.chunks.size <= 169);
    assert.ok(terrain.heights.size <= 8192);
    assert.ok(terrain.lots.size <= 1024);
  }
  terrain.prepareAt(15000, -15000);
  assert.ok(terrain.stats.evicted > 0);
  assert.ok(terrain.chunks.size <= 169);
  terrain.setQuality('low');
  for (let i = 0; i < 100; i++) terrain.update(0.016, { x: 15000, z: -15000 });
  assert.ok(terrain.chunks.size <= 81);
  assert.equal(terrain.pending.length, 0);
  world.dispose();
});

run('all four new worlds generate playable spawns, rail, destinations and bounded meshes', () => {
  for (const id of ['beijing', 'washington', 'tokyo', 'earth']) {
    const def = MW.WORLDS.find(w => w.id === id);
    const world = MW.WorldGen.generate(def);
    const [x, y, z] = world.meta.spawn;
    assert.ok(Number.isFinite(y));
    assert.equal(world.collidesBox(x, y + 0.04, z, 0.25, 1.7), false, id + ' spawn must be clear');
    assert.ok(world.meta.destinations.length >= 6);
    for (const d of world.meta.destinations) assert.ok(Number.isFinite(world.surfaceAt(d.x, d.z)), id + ' destination');
    assert.ok(world.terrain.chunks.size <= 9);
    if (id !== 'earth') {
      assert.equal(world.meta.travelBounds, 16384);
      assert.equal(world.meta.advanced.rail.length, 8);
      for (const [rx, rz] of world.meta.advanced.rail) assert.equal(world.terrainGroundAt(rx, rz), 3);
      world.rebuildAllSync();
      assert.ok(world.renderStats.triangles > 0);
      assert.ok(world.renderStats.triangles < world.blockCount * 12);
    } else {
      const positions = [...world.terrain.chunks.values()][0].mesh.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) assert.ok(Math.abs(positions[i]) <= 256);
      assert.ok(Math.abs(world.meta.spawn[0]) > 1e7);
      for (const d of world.meta.destinations) assert.ok(world.terrainGroundAt(d.x, d.z) > 0, d.name + ' must be on land');
    }
    console.log(JSON.stringify({ world: id, blocks: world.blockCount, voxelTriangles: world.renderStats.triangles, terrainChunks: world.terrain.chunks.size }));
    world.dispose();
  }
});

run('legacy island and palace preserve collision and export/import semantics', () => {
  for (const id of ['taiwan', 'forbidden']) {
    const world = MW.WorldGen.generate(MW.WORLDS.find(w => w.id === id));
    world.rebuildAllSync();
    assert.ok(world.blockCount > 10000);
    assert.ok(world.renderStats.triangles < world.blockCount * 12);
    const data = world.serialize();
    const copy = new MW.VoxelWorld(data.meta);
    copy.loadSerialized(data);
    assert.equal(copy.blockCount, world.blockCount);
    assert.equal(copy.renderStats.triangles, world.renderStats.triangles);
    const [x, , z] = data.meta.spawn;
    assert.equal(copy.surfaceAt(x, z), world.surfaceAt(x, z));
    world.dispose(); copy.dispose();
  }
});

console.log(JSON.stringify({ passed: reports.length, reports }, null, 2));
