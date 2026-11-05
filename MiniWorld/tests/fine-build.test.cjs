/* Real Three.js geometry and actual Player collision; no WebGL claim here. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const THREE = require("../vendor/three.min.js");
const noop = () => {};
const paint = new Proxy(
  {
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createLinearGradient: () => ({ addColorStop: noop }),
    measureText: (text) => ({ width: text.length * 8 }),
  },
  { get: (o, k) => o[k] || noop },
);
const context = vm.createContext({
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
    readyState: "loading",
    addEventListener: noop,
  },
  localStorage: { getItem: () => null, setItem: noop },
});
context.window = context;
for (const file of [
  "data",
  "util",
  "geography",
  "terrain",
  "circulation",
  "fine-build",
  "world",
  "places",
  "worldgen",
  "models",
  "vehicle-models",
  "audio",
  "entities",
  "combat",
  "player",
  "game",
])
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, "../js", file + ".js"), "utf8"),
    context,
    { filename: file + ".js" },
  );
const MW = context.MW;
const cell = (id = "a", x = 0, y = 0, z = 0, size = 0.25) => ({
  id,
  x,
  y,
  z,
  w: size,
  h: size,
  d: size,
  c: 0xaabb99,
  t: 0,
  source: "test",
});
const world = () =>
  new MW.VoxelWorld({ bounds: 200, minY: -6, maxY: 96, fallbackY: 0 });
const json = (value) => JSON.parse(JSON.stringify(value));
function game() {
  const g = Object.create(MW.Game.prototype);
  Object.assign(g, {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(),
    world: world(),
    settings: { ...MW.DEFAULT_SETTINGS },
    ui: new Proxy({}, { get: () => noop }),
    doors: [],
    elevators: [],
    $: () => null,
    saveLater: noop,
    state: "playing",
    mode: "build",
    buildGrid: 0.25,
    buildBrush: 1,
    buildPrefab: "cell",
    buildRotation: 0,
    buildSerial: 0,
    buildColorIndex: 0,
    inVehicle: null,
  });
  g.player = new MW.Player(g);
  g.player.pos.set(10, 0, 10);
  return g;
}
function walk(player, x, z, maxFrames = 1000) {
  let maxRise = 0;
  for (let i = 0; i < maxFrames; i++) {
    const dx = x - player.pos.x,
      dz = z - player.pos.z,
      distance = Math.hypot(dx, dz);
    if (distance < 0.035) return maxRise;
    const oldY = player.pos.y;
    player.vel.set((dx / distance) * 1.8, -1, (dz / distance) * 1.8);
    player.moveWithCollision(1 / 60);
    maxRise = Math.max(maxRise, player.pos.y - oldY);
  }
  assert.fail("Blocked at " + player.pos.toArray() + ", target " + [x, z]);
}

test("quarter, half and metre detail cells keep exact bounds without changing legacy blocks", () => {
  const w = world();
  w.set(5, 0, 5, 0x888888, 0);
  for (const [i, size] of [0.25, 0.5, 1].entries())
    w.fine.addBatch([cell("scale" + i, i * 2, 0, 0, size)]);
  assert.equal(w.blocks.size, 1);
  assert.equal(w.fine.cells.size, 3);
  assert.equal(w.collidesBox(0.125, 0.1, 0.125, 0.05, 0.1), true);
  assert.equal(w.collidesBox(0.3, 0.1, 0.125, 0.02, 0.1), false);
  assert.equal(w.collidesBox(0.125, 0.25, 0.125, 0.05, 1.78), false);
  w.dispose();
});

test("adjacent quarter cells merge into a single exposed cuboid with 12 triangles", () => {
  const w = world();
  w.fine.addBatch([cell("a"), cell("b", 0.25)]);
  w.rebuildAllSync();
  assert.equal(w.fine.stats.triangles, 12);
  for (const chunk of w.fine.chunks.values())
    for (const mesh of chunk.meshes) {
      const geometry = mesh.geometry,
        positions = geometry.attributes.position,
        normals = geometry.attributes.normal;
      assert.ok(Number.isFinite(geometry.boundingSphere.radius));
      for (let i = 0; i < geometry.index.count; i += 3) {
        const ids = [0, 1, 2].map((k) => geometry.index.array[i + k]);
        const [a, b, c] = ids.map((id) =>
          new THREE.Vector3().fromBufferAttribute(positions, id),
        );
        assert.ok(
          b
            .sub(a)
            .cross(c.sub(a))
            .dot(new THREE.Vector3().fromBufferAttribute(normals, ids[0])) > 0,
        );
      }
    }
  w.dispose();
});

test("mixed-size adjacency removes only the covered portion of a large face", () => {
  const w = world();
  w.fine.addBatch([cell("large", 0, 0, 0, 1), cell("small", 1, 0, 0, 0.25)]);
  w.rebuildAllSync();
  let area = 0;
  for (const chunk of w.fine.chunks.values())
    for (const mesh of chunk.meshes) {
      const g = mesh.geometry;
      for (let i = 0; i < g.index.count; i += 3) {
        const [a, b, c] = [0, 1, 2].map((k) =>
          new THREE.Vector3().fromBufferAttribute(
            g.attributes.position,
            g.index.array[i + k],
          ),
        );
        area += b.sub(a).cross(c.sub(a)).length() / 2;
      }
    }
  assert.ok(Math.abs(area - 6.25) < 1e-6, "surface area " + area);
  w.dispose();
});

test("cross-chunk deletion rebuilds exposed neighbour faces, including negative coordinates", () => {
  const w = world();
  w.fine.addBatch([cell("left", -0.25), cell("right")]);
  w.rebuildAllSync();
  assert.equal(w.fine.stats.triangles, 20);
  w.fine.remove("right");
  assert.ok(w.fine.dirty.has("-1,0,0"));
  w.rebuildAllSync();
  assert.equal(w.fine.stats.triangles, 12);
  w.dispose();
});

test("precise fine ray hits report exact face, point, normal and stable ID", () => {
  const w = world();
  w.fine.addBatch([cell("micro", 0.25, 1, 0.25)]);
  const hit = w.raycast(
    new THREE.Vector3(0.375, 3, 0.375),
    new THREE.Vector3(0, -1, 0),
    8,
  );
  assert.equal(hit.fine, true);
  assert.equal(hit.fineId, "micro");
  assert.ok(Math.abs(hit.dist - 1.75) < 1e-9);
  assert.equal(hit.point.y, 1.25);
  assert.equal(hit.ny, 1);
  assert.equal(
    w.raycast(new THREE.Vector3(0.51, 1.1, 2), new THREE.Vector3(0, 0, -1), 4),
    null,
  );
  w.dispose();
});

test("nearest ray selection respects coarse walls ahead of fine cells and fine cells ahead of coarse walls", () => {
  const w = world();
  w.set(0, 1, 0, 0x888888, 0);
  w.fine.addBatch([cell("fine", 0.25, 1.25, 2)]);
  let hit = w.raycast(
    new THREE.Vector3(0.375, 1.375, 4),
    new THREE.Vector3(0, 0, -1),
    8,
  );
  assert.equal(hit.fineId, "fine");
  hit = w.raycast(
    new THREE.Vector3(0.375, 1.375, -2),
    new THREE.Vector3(0, 0, 1),
    8,
  );
  assert.equal(!!hit.fine, false);
  assert.equal(hit.z, 0);
  w.dispose();
});

test("build snapping follows actual face height rather than rounding a 20 cm tread into a metre", () => {
  const hit = { point: { x: 0.61, y: 1.2, z: 0.37 }, nx: 0, ny: 1, nz: 0 };
  const target = MW.FineBuildTools.placement(hit, {}, {}, 0.25);
  assert.equal(target.x, 0.5);
  assert.equal(target.z, 0.25);
  assert.equal(target.y, 1.2);
  assert.equal(target.h, 0.25);
  const side = MW.FineBuildTools.placement(
    { point: { x: -0.25, y: 1.33, z: 0.37 }, nx: -1, ny: 0, nz: 0 },
    {},
    {},
    0.5,
  );
  assert.equal(side.x, -0.75);
});

test("actual Player traverses quarter-metre steps without a 41 cm hop, then descends", () => {
  const g = game(),
    cells = [];
  for (let i = 0; i < 4; i++)
    cells.push({
      ...cell("step" + i, -0.75, 0, i * 0.6),
      w: 1.5,
      h: (i + 1) * 0.25,
      d: 0.6,
    });
  g.world.fine.addBatch(cells);
  g.player.pos.set(0, 0, -0.8);
  g.player.onGround = true;
  const rise = walk(g.player, 0, 2.1);
  assert.ok(Math.abs(g.player.pos.y - 1) < 0.02);
  assert.ok(rise < 0.28, "largest frame rise " + rise);
  walk(g.player, 0, -0.8);
  assert.ok(Math.abs(g.player.pos.y) < 0.02);
  g.world.dispose();
});

test("all prefab rotations validate; real 20 cm micro stairs are walkable and keep human seat/roof heights", () => {
  for (const name of ["stairs", "bench", "planter", "lamp", "pergola", "rail"])
    for (let rotation = 0; rotation < 4; rotation++) {
      const w = world();
      assert.ok(
        w.fine.addBatch(
          MW.FineBuildTools.prefab(name, 0, 0, 0, rotation, 0xbba988, name),
        ) > 0,
        name,
      );
      w.dispose();
    }
  const g = game();
  g.world.fine.addBatch(
    MW.FineBuildTools.prefab("stairs", 0, 0, 0, 0, 0xbba988, "stairs"),
  );
  g.player.pos.set(0, 0, -0.8);
  g.player.onGround = true;
  assert.ok(walk(g.player, 0, 1.7) <= 0.22);
  assert.ok(Math.abs(g.player.pos.y - 1) < 0.02);
  const bench = MW.FineBuildTools.prefab("bench", 0, 0, 0);
  assert.ok(
    bench.some((part) => part.y === 0.4 && part.h === 0.1 && part.w === 1.8),
  );
  g.world.dispose();
});

test("placement, highlight scaling and removal operate on the fine ID, never on underlying metre blocks", () => {
  const g = game();
  g.world.set(0, 0, 0, 0x888888, 0);
  g.createHighlight();
  const originalRaycast = g.world.raycast.bind(g.world);
  g.world.raycast = () => ({
    x: 0,
    y: 0,
    z: 0,
    nx: 0,
    ny: 1,
    nz: 0,
    dist: 1,
    point: { x: 0.4, y: 1, z: 0.4 },
  });
  g.updateBuild();
  assert.equal(g.highlight.scale.x, 0.25);
  assert.equal(g.highlight.position.y, 1.125);
  g.placeBlock();
  assert.equal(g.world.fine.cells.size, 1);
  assert.equal(g.world.blocks.size, 1);
  g.world.raycast = originalRaycast;
  const hit = g.world.raycast(
    new THREE.Vector3(0.375, 3, 0.375),
    new THREE.Vector3(0, -1, 0),
    6,
  );
  g.buildHit = hit;
  g.removeBlock();
  g.removeBlock(); // stale repeated click
  assert.equal(g.world.fine.cells.size, 0);
  assert.equal(g.world.blocks.size, 1);
  assert.equal(g.world.getBlock(0, 0, 0).c, 0x888888);
  g.world.dispose();
});

test("overlapping/personal-space/out-of-bounds batches fail without partial placement", () => {
  const w = world();
  w.fine.addBatch([cell("existing")]);
  const before = JSON.stringify(w.fine.serialize()),
    revision = w.revision;
  assert.throws(() =>
    w.fine.addBatch([cell("valid", 5), cell("overlap", 0.1)]),
  );
  assert.equal(JSON.stringify(w.fine.serialize()), before);
  assert.equal(w.revision, revision);
  assert.throws(() => w.fine.addBatch([cell("out", 1000)]));
  const g = game();
  g.buildTarget = { x: 10, y: 0, z: 10 };
  g.placeBlock();
  assert.equal(g.world.fine.cells.size, 0);
  w.dispose();
  g.world.dispose();
});

test("snapshot/export/import round trips cells, exact coordinates, source metadata and deletion log", () => {
  const w = world();
  w.set(7, 0, 7, 0x123456, 0);
  w.fine.addBatch([cell("keep", 0.25, 1.2, -0.5), cell("deleted", 2)]);
  w.fine.remove("deleted");
  const serialized = json(w.serialize());
  const restored = new MW.VoxelWorld(serialized.meta);
  restored.loadSerialized(serialized);
  assert.deepEqual(json(restored.fine.serialize()), serialized.fine);
  assert.equal(restored.fine.cells.get("keep").y, 1.2);
  assert.equal(restored.fine.editLog.get("deleted"), null);
  assert.equal(restored.getBlock(7, 0, 7).c, 0x123456);
  const secondSave = json(restored.serialize());
  assert.deepEqual(secondSave.fine, serialized.fine);
  w.dispose();
  restored.dispose();
});

test("legacy saves without fine metadata remain loadable and metre blocks retain their coordinates", () => {
  const w = world();
  w.loadSerialized({ meta: w.meta, blocks: [[1, 0, 2, 0x888888, 0]] });
  assert.equal(w.blocks.size, 1);
  assert.equal(w.fine.cells.size, 0);
  assert.equal(w.getBlock(1, 0, 2).x, 1);
  w.dispose();
});

test("invalid fine import is atomic for records, legacy blocks, geometry and revision", () => {
  const w = world();
  w.set(8, 0, 8, 0xaabbcc, 0);
  w.fine.addBatch([cell("original")]);
  w.rebuildAllSync();
  const saved = JSON.stringify(w.serialize()),
    revision = w.revision,
    oldChunks = w.fine.chunks;
  for (const bad of [
    { version: 7, cells: [] },
    { version: 1, cells: [cell("a"), cell("a")] },
    { version: 1, cells: [{ ...cell(), x: Infinity }] },
    { version: 1, cells: [{ ...cell(), h: 0 }] },
    { version: 1, cells: [cell("a"), cell("b", 0.1)] },
    { version: 1, cells: [cell("a")], edits: [{ id: "a", cell: null }] },
    { version: 1, cells: [], edits: [{ id: "a", cell: cell("a") }] },
  ]) {
    assert.throws(() =>
      w.loadSerialized({ meta: w.meta, blocks: [], fine: bad }),
    );
    assert.equal(JSON.stringify(w.serialize()), saved);
    assert.equal(w.revision, revision);
    assert.equal(w.fine.chunks, oldChunks);
  }
  w.dispose();
});

test("game importer rejects bad fine data before disposing or hiding the active world", async () => {
  const g = game(),
    previous = g.world;
  let disposed = false;
  g.disposeWorld = () => {
    disposed = true;
  };
  await assert.rejects(
    g.startImportedWorld(
      { blocks: [], fine: { version: 1, cells: [{ ...cell(), x: Infinity }] } },
      "bad.json",
    ),
  );
  assert.equal(disposed, false);
  assert.equal(g.world, previous);
  assert.equal(g.state, "playing");
  g.world.dispose();
});

test("10000-cell cap is enforced before mutating a batch; the base world is not materialized at finer resolution", () => {
  const w = world(),
    cells = [];
  for (let i = 0; i < 10000; i++)
    cells.push(cell("cell" + i, (i % 100) * 0.5, 0, Math.floor(i / 100) * 0.5));
  w.fine.addBatch(cells, false);
  assert.equal(w.fine.cells.size, 10000);
  assert.equal(w.blocks.size, 0);
  assert.throws(() => w.fine.addBatch([cell("overLimit", 60)]));
  assert.equal(w.fine.cells.size, 10000);
  assert.ok(
    w.fine.query({ x: 0, y: 0, z: 0, w: 0.5, h: 1, d: 0.5 }).length <= 4,
  );
  w.dispose();
});

test("generated maker gardens are bounded, human scale and have clear arrivals in three cities only", () => {
  for (const id of ["beijing", "washington", "tokyo"]) {
    const w = MW.WorldGen.generate(MW.WORLDS.find((def) => def.id === id));
    const garden = w.meta.makerGarden;
    assert.ok(garden, id);
    assert.equal(garden.cells, 121, id);
    assert.equal(
      [...w.fine.cells.values()].filter((c) =>
        c.source.startsWith("maker-garden:"),
      ).length,
      garden.cells,
    );
    assert.ok(w.meta.fineScenery.lamps >= 8, id);
    assert.ok(w.meta.fineScenery.benches >= 2, id);
    assert.equal(w.meta.fineScenery.skipped, 0, id);
    assert.ok(w.fine.cells.size < 1500, id);
    while (w.fine.dirty.size) w.fine.rebuildDirty(1000);
    console.log(
      JSON.stringify({
        world: id,
        fineCells: w.fine.cells.size,
        streetLamps: w.meta.fineScenery.lamps,
        humanBenches: w.meta.fineScenery.benches,
        fineChunks: w.fine.stats.chunks,
        fineTriangles: w.fine.stats.triangles,
      }),
    );
    assert.equal(w.fine.editLog.size, 0);
    assert.equal(w.surfaceAt(garden.x, garden.z), 3);
    assert.equal(w.collidesBox(garden.x, 3.03, garden.z, 0.34, 1.78), false);
    assert.ok(w.meta.destinations.some((d) => d.name.includes("匠人花园")));
    w.dispose();
  }
  const legacy = MW.WorldGen.generate(
    MW.WORLDS.find((def) => def.id === "taiwan"),
  );
  assert.equal(legacy.fine.cells.size, 0);
  legacy.dispose();
});

test("precision stair rays identify immutable tread surfaces; lift guards still reject obstruction", () => {
  const g = game();
  g.world.meta.stairways = [{ x: 0, y: 1, z: 0, levels: 1 }];
  g.world.rebuildPrecision();
  const hit = g.world.raycast(
    new THREE.Vector3(1.3, 2.5, 0.2),
    new THREE.Vector3(0, -1, 0),
    4,
  );
  assert.equal(hit.precision, true);
  assert.ok(Math.abs(hit.point.y - 1.2) < 1e-9);
  g.buildHit = hit;
  g.removeBlock();
  assert.ok(g.world.precision.meshes.length);
  g.collidesDoor = () => true;
  assert.equal(g.canPlaceFine(cell("blocked", 20, 0, 20)), false);
  g.world.dispose();
});

test("fine disposal is idempotent and frees private geometries but not shared materials", () => {
  const w = world();
  w.fine.addBatch([cell()]);
  w.rebuildAllSync();
  let geometryDisposals = 0,
    materialDisposals = 0;
  const meshes = [...w.fine.chunks.values()].flatMap((chunk) => chunk.meshes);
  for (const mesh of meshes)
    mesh.geometry.addEventListener("dispose", () => geometryDisposals++);
  w.matSolid.addEventListener("dispose", () => materialDisposals++);
  w.fine.dispose();
  w.fine.dispose();
  assert.equal(geometryDisposals, meshes.length);
  assert.equal(materialDisposals, 0);
  assert.equal(w.fine.index.size, 0);
  w.dispose();
});

test("malformed legacy block import also fails before replacing an active fine/coarse world", async () => {
  const g = game();
  g.world.set(0, 0, 0, 0x888888, 0);
  g.world.fine.addBatch([cell("original", 5)]);
  const before = JSON.stringify(g.world.serialize());
  for (const bad of [
    { blocks: [[0, 0, 0, NaN, 0]] },
    { blocks: [[0.5, 0, 0, 0xffffff, 0]] },
    { blocks: [[0, 0, 0, 0xffffff, 99]] },
    { blocks: [], meta: { bounds: Infinity } },
    { blocks: [], meta: { spawn: [0, "bad", 0] } },
  ]) {
    await assert.rejects(g.startImportedWorld(bad, "invalid.json"));
    assert.equal(JSON.stringify(g.world.serialize()), before);
    assert.equal(g.state, "playing");
  }
  g.world.dispose();
});

test("new-city common lamps and benches use fine parts while legacy generators keep metre assets", () => {
  const w = new MW.VoxelWorld({ id: "beijing", bounds: 100, fallbackY: 0 });
  const builder = new MW.Builder(w, 7);
  builder.lamp(10, 12, 0, 0xffdd99, 5);
  assert.equal(w.blocks.size, 0);
  assert.equal(w.fine.cells.size, 4);
  assert.ok(
    [...w.fine.cells.values()].some(
      (part) => part.w === 0.1 && part.d === 0.1 && part.h > 3,
    ),
  );
  assert.equal(builder.fineProp("bench", 15, 0, 12, 0xa98b62), true);
  assert.equal(w.fine.cells.size, 15);
  const legacy = new MW.VoxelWorld({ id: "taiwan", bounds: 100, fallbackY: 0 });
  new MW.Builder(legacy, 7).lamp(10, 12, 0, 0xffdd99, 5);
  assert.ok(legacy.blocks.size >= 5);
  assert.equal(legacy.fine.cells.size, 0);
  w.dispose();
  legacy.dispose();
});

test("returning to pointer lock blurs the build selector so movement keys reach the game", () => {
  const g = game();
  let blurred = false,
    locked = false;
  context.document.activeElement = {
    tagName: "SELECT",
    blur() {
      blurred = true;
    },
  };
  g.canvas = {
    requestPointerLock() {
      locked = true;
    },
  };
  g.requestLock();
  assert.equal(blurred, true);
  assert.equal(locked, true);
  delete context.document.activeElement;
  g.world.dispose();
});
