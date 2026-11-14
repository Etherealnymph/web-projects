// Real Three.js resource disposal events, without pretending to have a WebGL GPU.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const THREE = require('../vendor/three.min.js');
const noop = () => {};
const paint = { createRadialGradient: () => ({ addColorStop: noop }), fillRect: noop };
const context = vm.createContext({
  THREE, console, clearTimeout, setTimeout,
  document: { readyState: 'loading', addEventListener: noop, createElement: () => ({ getContext: () => paint }) },
  MW: {
    BOX_GEO: new THREE.BoxGeometry(1, 1, 1),
    SFX: { explosion: noop, stopLoops: noop },
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    easeOut: value => 1 - (1 - value) ** 3
  }
});
context.window = context;
for (const name of ['circulation', 'models', 'vehicle-models', 'entities', 'combat', 'game']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', name + '.js'), 'utf8'), context, { filename: name + '.js' });
}
const MW = context.MW;

function game() {
  const g = Object.create(MW.Game.prototype);
  Object.assign(g, {
    scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(),
    settings: { graphics: 'high' }, shake: noop,
    player: { pos: new THREE.Vector3(100, 0, 0), alive: false, avatar: { group: new THREE.Group() }, vmHolder: new THREE.Group() },
    world: { dispose: noop }, advanced: null,
    zombies: [], soldiers: [], pickups: [], vehicles: [], ships: [], zones: [],
    notes: [], doors: [], cannons: [], elevators: [], airdrops: [], bridges: [],
    labels: [], projectiles: [], mines: []
  });
  g.combat = new MW.Combat(g);
  return g;
}

function watch(resources) {
  const counts = new Map();
  for (const resource of new Set(resources)) {
    if (!resource) continue;
    counts.set(resource, 0);
    resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1));
  }
  return counts;
}

function resourcesOf(root) {
  const resources = new Set();
  root.traverse(object => {
    if (object.geometry) resources.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material) continue;
      resources.add(material);
      if (material.map) resources.add(material.map);
    }
  });
  return [...resources];
}

function assertOwnership(counts) {
  for (const [resource, count] of counts) {
    assert.equal(count, resource.userData?.mwOwned ? 1 : 0, resource.type + ' ownership');
  }
}

test('cached glow sprites preserve requested size on every instance', () => {
  const a = MW.Models.glowSprite(0x123456, 3.4);
  const b = MW.Models.glowSprite(0x123456, 3.4);
  assert.deepEqual(a.scale.toArray(), [3.4, 3.4, 1]);
  assert.deepEqual(b.scale.toArray(), [3.4, 3.4, 1]);
  assert.equal(a.material, b.material);
});

test('overlapping explosions animate independently and release only owned resources on expiry', () => {
  const g = game(), pos = new THREE.Vector3(0, 3, 0);
  g.combat.explode(pos, 4, 0, { visualOnly: true });
  const first = g.combat.explosions[0].obj;
  g.combat.update(0.2);
  g.combat.explode(pos, 4, 0, { visualOnly: true });
  const second = g.combat.explosions[1].obj;
  const shared = MW.Models.glowSprite(0xffb347, 4 * 2.6);
  assert.notEqual(first.userData.halo.material, second.userData.halo.material);
  assert.notEqual(second.userData.halo.material, shared.material);
  assert.equal(first.userData.halo.material.map, shared.material.map);
  const counts = watch([...resourcesOf(first), ...resourcesOf(second), shared.material, shared.geometry]);
  g.combat.update(0.1);
  assert.ok(first.userData.halo.material.opacity < second.userData.halo.material.opacity);
  assert.equal(shared.material.opacity, 0.55);
  g.combat.update(1);
  assert.equal(g.combat.explosions.length, 0);
  MW.Models.disposeOwned(first);
  MW.Models.disposeOwned(second);
  assertOwnership(counts);
  g.combat.dispose();
});

test('repeated projectile removal releases private geometry/material exactly once and retains shared assets', () => {
  const g = game();
  for (let i = 0; i < 32; i++) {
    for (const type of ['grenade', 'rocket', 'shell', 'missile']) {
      const p = new MW.Entities.Projectile(g, new THREE.Vector3(0, 3, 0), new THREE.Vector3(0, 0, -20), { type });
      g.projectiles.push(p);
      const counts = watch(resourcesOf(p.mesh));
      p.remove(); p.remove(); p.explode();
      assert.equal(p.dead, true);
      assert.equal(p.mesh.parent, null);
      assertOwnership(counts);
    }
  }
  assert.equal(g.projectiles.length, 0);
  assert.equal(g.combat.explosions.length, 0);
  const p = new MW.Entities.Projectile(g, new THREE.Vector3(), new THREE.Vector3(), { type: 'missile' });
  g.projectiles.push(p);
  const counts = watch(resourcesOf(p.mesh));
  p.explode(); p.explode(); p.remove();
  assertOwnership(counts);
  assert.equal(g.combat.explosions.length, 1);
  assert.equal(g.projectiles.length, 0);
  g.combat.dispose();
});

test('world disposal releases active effects/projectiles and drops the particle pool without disposing shared resources', () => {
  const g = game(), pos = new THREE.Vector3(0, 3, 0), velocity = new THREE.Vector3();
  for (let i = 0; i < 2; i++) g.combat.spawnParticle(pos, velocity, 0xffb347, 0.01, 1);
  g.combat.update(0.02);
  assert.equal(g.combat.pool.length, 2);
  g.combat.spawnParticle(pos, velocity, 0xffb347, 2, 1);
  g.combat.tracer(pos, pos.clone().addScalar(1), 0xffffff, 2);
  g.combat.explode(pos, 3, 0, { visualOnly: true });
  for (const type of ['grenade', 'missile']) {
    g.projectiles.push(new MW.Entities.Projectile(g, pos, velocity, { type }));
  }
  const combat = g.combat, projectiles = [...g.projectiles];
  const counts = watch([...resourcesOf(g.scene), MW.BOX_GEO, MW.getRadialTexture()]);
  g.disposeWorld();
  combat.dispose();
  assertOwnership(counts);
  assert.equal(g.projectiles.length, 0);
  assert.ok(projectiles.every(projectile => projectile.dead));
  assert.equal(combat.pool.length + combat.particles.length + combat.tracers.length + combat.explosions.length, 0);
  assert.equal(g.scene.children.length, 0);
  assert.equal(g.combat, null);
});

test('health bar resources participate in owned cleanup without touching shared vehicle materials', () => {
  MW.Models.disposeOwned(undefined);
  const model = MW.Models.vehicle('tank');
  const bar = MW.makeHealthBar(0x62c7ff);
  model.group.add(bar);
  const counts = watch(resourcesOf(model.group));
  MW.Models.disposeVehicle(model);
  MW.Models.disposeVehicle(model);
  assertOwnership(counts);
});

test('support explosions spare allied soldiers and still damage hostile targets', () => {
  const g = game(), pos = new THREE.Vector3(0, 3, 0);
  let alliedDamage = 0, hostileDamage = 0;
  g.soldiers.push({ pos: pos.clone(), dead: false, damage: amount => { alliedDamage += amount; } });
  g.zombies.push({ pos: pos.clone(), dead: false, hit: amount => { hostileDamage += amount; } });
  g.combat.explode(pos, 5, 50, { source: 'support' });
  assert.equal(alliedDamage, 0);
  assert.ok(hostileDamage > 0);
  g.combat.explode(pos, 5, 50, { source: 'enemy' });
  assert.ok(alliedDamage > 0);
  g.combat.dispose();
});
