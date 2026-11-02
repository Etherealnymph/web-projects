/* ===========================================================
   游戏实体
   =========================================================== */
(function () {
  const MW = window.MW;
  const TMP = new THREE.Vector3();

  function makeHealthBar(color) {
    const g = new THREE.Group();
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.12),
      new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.65, depthTest: false, depthWrite: false })
    );
    bg.renderOrder = 20;
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(0.86, 0.075),
      new THREE.MeshBasicMaterial({ color, transparent: true, depthTest: false, depthWrite: false })
    );
    fill.position.z = 0.002;
    fill.renderOrder = 21;
    g.add(bg, fill);
    g.userData.fill = fill;
    g.visible = false;
    return g;
  }
  MW.makeHealthBar = makeHealthBar;

  function moveMob(game, ent, dx, dz) {
    const w = game.world;
    const r = ent.radius, h = ent.height;
    const solid = (x, y, z) => w.collidesBox(x, y, z, r, h) || game.collidesDoor(x, y, z, r, h);
    if (!solid(ent.pos.x + dx, ent.pos.y + 0.02, ent.pos.z)) ent.pos.x += dx;
    else if (!solid(ent.pos.x + dx, ent.pos.y + 1.05, ent.pos.z)) { ent.pos.x += dx; ent.pos.y += 1; }
    if (!solid(ent.pos.x, ent.pos.y + 0.02, ent.pos.z + dz)) ent.pos.z += dz;
    else if (!solid(ent.pos.x, ent.pos.y + 1.05, ent.pos.z + dz)) { ent.pos.z += dz; ent.pos.y += 1; }
    const surf = w.surfaceAt(ent.pos.x, ent.pos.z);
    if (ent.pos.y < surf - 0.2 && surf - ent.pos.y < 2.2) ent.pos.y = surf;
    if (ent.pos.y > surf + 0.4) ent.pos.y -= 8 * 0.016;
    ent.pos.x = MW.clamp(ent.pos.x, -game.travelBounds, game.travelBounds);
    ent.pos.z = MW.clamp(ent.pos.z, -game.travelBounds, game.travelBounds);
  }

  /* =========================================================
     僵尸
     ========================================================= */
  class Zombie {
    constructor(game, x, y, z, opts) {
      opts = opts || {};
      this.game = game;
      this.elite = !!opts.elite;
      const spec = this.elite ? MW.CHARACTERS.elite : MW.CHARACTERS.zombie;
      this.model = MW.Models.character(spec);
      this.pos = new THREE.Vector3(x, y == null ? game.world.surfaceAt(x, z) : y, z);
      this.model.group.position.copy(this.pos);
      game.scene.add(this.model.group);
      this.radius = this.model.radius;
      this.height = this.model.height;
      this.maxHp = this.elite ? 320 : 110;
      this.hp = this.maxHp;
      this.speed = (this.elite ? 1.45 : 2.15) + Math.random() * 0.35;
      this.dmg = this.elite ? 20 : 7;
      this.attackCd = Math.random() * 0.6;
      this.phase = Math.random() * Math.PI * 2;
      this.dead = false;
      this.deadT = 0;
      this.stun = 0;
      this.target = null;
      this.growlT = 2 + Math.random() * 5;
      this.bar = makeHealthBar(0xd84b3e);
      this.bar.position.y = this.height + 0.5;
      this.bar.scale.setScalar(this.elite ? 1.35 : 1);
      this.model.group.add(this.bar);
      this.wander = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize().multiplyScalar(6);
      this.yaw = Math.random() * Math.PI * 2;
      this.model.group.rotation.y = this.yaw;
    }

    update(dt) {
      if (this.dead) {
        this.deadT += dt;
        this.model.group.rotation.z = MW.lerp(this.model.group.rotation.z, Math.PI / 2, dt * 5);
        this.model.group.position.y = this.pos.y - Math.min(0.4, this.deadT * 0.6);
        if (this.deadT > 1.5) this.remove();
        return;
      }
      this.stun = Math.max(0, this.stun - dt);
      this.attackCd = Math.max(0, this.attackCd - dt);
      this.growlT -= dt;
      if (this.growlT < 0) {
        this.growlT = 5 + Math.random() * 8;
        if (this.game.distToPlayer(this.pos) < 28) MW.SFX.growl();
      }

      if (this.stun <= 0 && !this.game.combatPaused) {
        const target = this.pickTarget();
        this.target = target;
        if (target) {
          TMP.subVectors(target, this.pos);
          const dist = TMP.length();
          const dx = TMP.x / (dist || 1), dz = TMP.z / (dist || 1);
          const attackRange = this.elite ? 2.7 : 2.05;
          if (dist > attackRange) {
            const sp = this.speed * (this.game.season === 'winter' ? 0.86 : 1);
            moveMob(this.game, this, (dx + Math.sin(this.phase * 1.3) * 0.18) * sp * dt, (dz + Math.cos(this.phase * 1.1) * 0.18) * sp * dt);
            this.phase += dt * 5;
          } else if (this.attackCd <= 0) {
            this.attackCd = this.elite ? 1.1 : 1.25;
            if (target.isPlayer) {
              // 隔墙不能抓伤玩家
              const zEye = this.pos.clone().add(new THREE.Vector3(0, 1.4, 0));
              const pEye = this.game.player.pos.clone().add(new THREE.Vector3(0, 1.0, 0));
              const blocked = this.game.world.lineBlocked(zEye, pEye) || this.game.doorLineBlocked(zEye, pEye);
              if (blocked) { this.atkCd = 0.5; return; }
              if (this.game.inVehicle) this.game.inVehicle.damage(this.dmg * 2.2);
              else this.game.player.damage(this.dmg, { sourcePos: this.pos });
            } else if (target.soldier) target.soldier.damage(this.dmg);
            MW.SFX.growl();
          }
          const wantYaw = Math.atan2(-dx, -dz);
          let diff = ((wantYaw - this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          this.yaw += diff * Math.min(1, dt * 8);
        } else {
          // 游荡
          const sp = this.speed * 0.4;
          moveMob(this.game, this, this.wander.x * 0.1, this.wander.z * 0.1);
          this.phase += dt * 3;
        }
      }

      this.model.group.position.copy(this.pos);
      this.model.group.rotation.y = this.yaw;
      const amp = 0.7;
      this.model.legL.rotation.x = Math.sin(this.phase) * amp;
      this.model.legR.rotation.x = -Math.sin(this.phase) * amp;
      this.model.armL.rotation.x = -1.15 + Math.sin(this.phase + 1) * 0.2;
      this.model.armR.rotation.x = -1.15 - Math.sin(this.phase + 1) * 0.2;
      this.model.head.rotation.z = Math.sin(this.phase * 0.5) * 0.12;

      // 血条（受伤或距离较近时显示，避免夜行尸在暗处完全不可见）
      const ratio = this.hp / this.maxHp;
      this.bar.visible = ratio < 0.999 || this.game.distToPlayer(this.pos) < 24;
      const fill = this.bar.userData.fill;
      fill.scale.x = Math.max(0.001, ratio);
      fill.position.x = -(1 - ratio) * 0.43;
      this.bar.quaternion.copy(this.game.camera.quaternion);
    }

    pickTarget() {
      const p = this.game.player;
      let best = null, bestD = 34;
      if (p.alive) {
        const d = this.game.distToPlayer(this.pos);
        if (d < bestD) { bestD = d; best = { pos: p.pos, isPlayer: true }; }
      }
      for (const s of this.game.soldiers) {
        if (s.dead) continue;
        const d = this.pos.distanceTo(s.pos);
        if (d < bestD) { bestD = d; best = { pos: s.pos, soldier: s }; }
      }
      return best;
    }

    hit(dmg, dir, opts) {
      if (this.dead) return;
      this.hp -= dmg;
      this.stun = Math.max(this.stun, 0.08);
      if (dir) {
        const k = opts && opts.knockback != null ? opts.knockback : 0.22;
        moveMob(this.game, this, dir.x * k, dir.z * k);
      }
      this.game.combat.blood(this.pos.clone().add(new THREE.Vector3(0, this.height * 0.6, 0)), dir);
      if (this.hp <= 0) this.die();
      else MW.SFX.hit();
    }

    die() {
      if (this.dead) return;
      this.dead = true;
      this.deadT = 0;
      this.bar.visible = false;
      this.model.armL.rotation.x = -2.2;
      this.model.armR.rotation.x = -2.2;
      MW.SFX.kill();
      this.game.onZombieKilled(this);
    }

    remove() {
      this.game.scene.remove(this.model.group);
      this.game.removeZombie(this);
    }
  }

  /* =========================================================
     友军士兵
     ========================================================= */
  class Soldier {
    constructor(game, x, y, z, name) {
      this.game = game;
      this.name = name || '士兵';
      const spec = Object.assign({}, MW.CHARACTERS.soldier, { backpack: true });
      this.model = MW.Models.character(spec);
      this.pos = new THREE.Vector3(x, y == null ? game.world.surfaceAt(x, z) : y, z);
      this.model.group.position.copy(this.pos);
      game.scene.add(this.model.group);
      this.radius = this.model.radius;
      this.height = this.model.height;
      this.maxHp = 150;
      this.hp = 150;
      this.speed = 4.4;
      this.dead = false;
      this.deadT = 0;
      this.state = 'follow';
      this.targetZone = null;
      this.phase = Math.random() * 6;
      this.fireCd = 0.5;
      this.yaw = 0;
      this.bar = makeHealthBar(0x62c7ff);
      this.bar.position.y = this.height + 0.45;
      this.model.group.add(this.bar);
      this.enemyTarget = null;
      const ang = Math.random() * Math.PI * 2;
      this.formOffset = new THREE.Vector3(Math.cos(ang) * 5, 0, Math.sin(ang) * 5);
    }

    update(dt) {
      if (this.dead) {
        this.deadT += dt;
        this.model.group.rotation.z = MW.lerp(this.model.group.rotation.z, Math.PI / 2, dt * 5);
        if (this.deadT > 2.5) {
          this.game.scene.remove(this.model.group);
          this.game.removeSoldier(this);
        }
        return;
      }
      this.fireCd -= dt;
      const p = this.game.player;

      // 选择目标
      let best = null, bestD = 32;
      for (const z of this.game.zombies) {
        if (z.dead) continue;
        const d = this.pos.distanceTo(z.pos);
        if (d < bestD) { bestD = d; best = z; }
      }
      this.enemyTarget = best;

      let moveTarget = null;
      if (this.state === 'capture' && this.targetZone) {
        moveTarget = new THREE.Vector3(this.targetZone.def.x, this.pos.y, this.targetZone.def.z);
        if (this.pos.distanceTo(moveTarget) < 3) moveTarget = null;
      } else if (p.alive) {
        moveTarget = new THREE.Vector3(p.pos.x + this.formOffset.x, p.pos.y, p.pos.z + this.formOffset.z);
        if (this.pos.distanceTo(moveTarget) < 3) moveTarget = null;
      }

      if (best && this.pos.distanceTo(best.pos) < 26) {
        const dx = best.pos.x - this.pos.x, dz = best.pos.z - this.pos.z;
        this.yaw = Math.atan2(-dx, -dz);
        if (this.fireCd <= 0 && bestD < 26) {
          this.fireCd = 0.62 + Math.random() * 0.2;
          const from = this.pos.clone().add(new THREE.Vector3(0, 1.4, 0));
          const to = best.pos.clone().add(new THREE.Vector3(0, best.height * 0.6, 0));
          const spread = 0.6;
          to.x += (Math.random() - 0.5) * spread;
          to.y += (Math.random() - 0.5) * spread;
          this.game.combat.tracer(from, to, 0x9fe6ff, 0.06);
          best.hit(16, new THREE.Vector3(dx, 0, dz).normalize(), { knockback: 0.05 });
          if (this.game.distToPlayer(this.pos) < 30) MW.SFX.shoot('rifle', true);
        }
      } else if (moveTarget) {
        TMP.subVectors(moveTarget, this.pos);
        const dist = TMP.length();
        const dx = TMP.x / (dist || 1), dz = TMP.z / (dist || 1);
        const before = this.pos.clone();
        moveMob(this.game, this, dx * this.speed * dt, dz * this.speed * dt);
        if (this.pos.distanceTo(before) < 0.001 && this.pos.distanceTo(moveTarget) > 4) {
          moveMob(this.game, this, -dz * this.speed * dt, dx * this.speed * dt);
        }
        this.yaw = Math.atan2(-dx, -dz);
        this.phase += dt * 9;
      } else {
        this.phase += dt * 2;
      }

      this.model.group.position.copy(this.pos);
      this.model.group.rotation.y = this.yaw;
      const amp = moveTarget ? 0.65 : 0.05;
      this.model.legL.rotation.x = Math.sin(this.phase) * amp;
      this.model.legR.rotation.x = -Math.sin(this.phase) * amp;
      this.model.armL.rotation.x = best ? -1.35 : -0.15;
      this.model.armR.rotation.x = best ? -1.35 : 0.15;
      this.model.head.rotation.y = 0;

      const ratio = this.hp / this.maxHp;
      this.bar.visible = ratio < 0.999;
      const fill = this.bar.userData.fill;
      fill.scale.x = Math.max(0.001, ratio);
      fill.position.x = -(1 - ratio) * 0.43;
      this.bar.quaternion.copy(this.game.camera.quaternion);
    }

    damage(n) {
      if (this.dead) return;
      this.hp -= n;
      this.game.combat.blood(this.pos.clone().add(new THREE.Vector3(0, 1.2, 0)));
      if (this.hp <= 0) {
        this.dead = true;
        this.deadT = 0;
        this.bar.visible = false;
        this.game.ui.toast(`${this.name} 阵亡`, 'bad');
        this.game.ui.updateSquad();
      }
    }
  }

  /* =========================================================
     城防火炮
     ========================================================= */
  class Cannon {
    constructor(game, spec) {
      this.game = game;
      this.spec = spec;
      this.pos = new THREE.Vector3(spec.x, spec.y, spec.z);
      this.yaw = spec.yaw || 0;
      this.pitch = spec.pitch != null ? spec.pitch : 0.18;
      this.fireCd = 0;
      const g = new THREE.Group();
      const wood = 0x5b3a22, iron = 0x2c3034;
      MW.Models.addBox(g, 1.5, 0.35, 1.1, wood, 0, 0.35, 0);
      for (const sx of [-0.7, 0.7]) {
        MW.Models.addBox(g, 0.25, 0.7, 0.75, 0x3a2a1c, sx, 0.35, 0.1);
        MW.Models.addBox(g, 0.28, 0.28, 0.28, iron, sx, 0.35, 0.1);
      }
      const barrel = new THREE.Group();
      MW.Models.addBox(barrel, 0.34, 0.34, 2.1, iron, 0, 0.65, -0.5);
      MW.Models.addBox(barrel, 0.46, 0.46, 0.3, 0x4a3a26, 0, 0.65, 0.5);
      MW.Models.addBox(barrel, 0.24, 0.24, 0.4, 0x191c1e, 0, 0.65, -1.7);
      const halo = MW.Models.glowSprite(0xff8a3d, 0.8);
      halo.position.set(0, 0.9, -1.6);
      halo.visible = false;
      barrel.add(halo);
      g.add(barrel);
      g.position.copy(this.pos);
      g.rotation.y = this.yaw;
      this.model = g;
      this.barrel = barrel;
      this.barrel.rotation.x = this.pitch;
      this.flash = halo;
      game.scene.add(g);
    }

    update(dt) {
      this.fireCd = Math.max(0, this.fireCd - dt);
      if (this.barrel) this.barrel.rotation.x = MW.lerp(this.barrel.rotation.x, this.pitch, Math.min(1, dt * 10));
      if (this.flash) this.flash.visible = this.fireCd > 2.2;
    }

    adjustPitch(delta) {
      this.pitch = MW.clamp(this.pitch + delta, -0.12, 1.15);
      this.game.ui.setInteract(`火炮俯仰 ${Math.round(this.pitch * 180 / Math.PI)}° · 滚轮/↑↓ 调整 · E 开炮`);
    }

    fire() {
      if (this.fireCd > 0) return false;
      this.fireCd = 2.6;
      const cp = Math.cos(this.pitch);
      const dir = new THREE.Vector3(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp).normalize();
      const origin = this.pos.clone().add(new THREE.Vector3(0, 0.9, 0)).addScaledVector(dir, 2.1);
      this.game.combat.launchShell(origin, dir, 120, 7, 150, 'player');
      MW.SFX.explosion(1.1);
      this.game.shake(0.35, 0.25);
      if (this.game.distToPlayer(this.pos) < 25) this.game.ui.toast(`${this.spec.name || '火炮'} 开火！`, 'info');
      return true;
    }
  }

  /* =========================================================
     拾取物
     ========================================================= */
  class Pickup {
    constructor(game, spec, x, y, z) {
      this.game = game;
      this.spec = spec;
      this.kind = spec.kind || 'item';
      this.id = spec.id;
      this.pos = new THREE.Vector3(x, y == null ? game.world.surfaceAt(x, z) + 0.9 : y, z);
      this.mesh = MW.Models.pickup(spec.id, spec.id, this.kind);
      this.mesh.position.copy(this.pos);
      game.scene.add(this.mesh);
      this.phase = Math.random() * 6;
      this.taken = false;
      this.radius = 1.6;
    }

    update(dt) {
      if (this.taken) return;
      this.phase += dt;
      const inner = this.mesh.userData.inner;
      inner.position.y = Math.sin(this.phase * 2) * 0.14;
      inner.rotation.y += dt * 1.4;
      const ring = this.mesh.userData.ring;
      if (ring) {
        const s = 1 + Math.sin(this.phase * 3) * 0.08;
        ring.scale.set(s, s, s);
      }
    }

    label() {
      if (this.kind === 'weapon') {
        const def = MW.WEAPONS[this.id];
        return def ? def.name : '武器';
      }
      const def = MW.ITEMS[this.id];
      return def ? def.name : '物品';
    }

    tryTake(player) {
      if (this.taken) return false;
      let ok = false;
      if (this.kind === 'weapon') {
        ok = player.addWeapon(this.id);
      } else {
        const def = MW.ITEMS[this.id];
        if (!def) return false;
        if (def.kind === 'ammo') {
          player.addAmmo(def.ammo, def.amount || 30);
          ok = true;
          this.game.ui.toast(`+${def.amount || 30} ${def.name}`, 'info');
        } else if (def.kind === 'backpack') {
          ok = player.upgradeBackpack(def.upgrade);
        } else {
          ok = player.addItem(this.id, 1);
          if (!ok) {
            this.game.ui.toast('背包已满，先丢弃或使用一些物品', 'bad');
            MW.SFX.deny();
            return false;
          }
        }
      }
      if (!ok) return false;
      this.taken = true;
      this.game.scene.remove(this.mesh);
      this.game.removePickup(this);
      MW.SFX.pickup();
      this.game.ui.toast(`拾取 ${this.label()}`, 'good');
      this.game.ui.updateInventory();
      this.game.ui.updateHUD();
      this.game.saveLater();
      return true;
    }
  }

  /* =========================================================
     载具
     ========================================================= */
  class Vehicle {
    constructor(game, type, x, z, name) {
      this.game = game;
      this.type = type;
      this.name = name || ({ tank: '坦克', apc: '装甲车', boat: '巡逻艇', drone: '无人机', car: '越野车', jet: '战斗机', artillery: '重炮' })[type] || '载具';
      this.model = MW.Models.vehicle(type);
      this.pos = new THREE.Vector3(x, game.world.surfaceAt(x, z), z);
      if (type === 'boat') this.pos.y = (game.world.meta.waterLevel || 4) + 0.1;
      if (type === 'drone') this.pos.y = game.world.surfaceAt(x, z) + 2.5;
      if (type === 'jet') this.pos.y = game.world.surfaceAt(x, z) + 0.2;
      this.model.group.position.copy(this.pos);
      this.yaw = Math.PI;
      this.model.group.rotation.y = this.yaw;
      game.scene.add(this.model.group);
      this.driver = null;
      this.maxHp = type === 'tank' ? 1400 : type === 'apc' ? 700 : type === 'boat' ? 900 : type === 'jet' ? 650 : type === 'artillery' ? 1000 : type === 'car' ? 420 : 260;
      this.hp = this.maxHp;
      this.fireCd = 0;
      this.radius = type === 'tank' ? 2.4 : type === 'jet' ? 3.0 : type === 'artillery' ? 2.3 : type === 'car' ? 1.4 : type === 'apc' ? 1.6 : 1.8;
      this.speed = type === 'tank' ? 8 : type === 'apc' ? 10.5 : type === 'boat' ? 13 : type === 'jet' ? 24 : type === 'car' ? 8 : type === 'artillery' ? 2.2 : 14;
      this.currentSpeed = 0;
      this.throttle = 0;
      this.airSpeed = 0;
      this.fpv = false;
      this.airborne = false;
      this.landing = false;
      this.turretPitch = 0;
      this.landed = false;
      this.altitude = this.pos.y;
      this.velocity = new THREE.Vector3();
      this.phase = 0;
      this.dead = false;
      this.bar = makeHealthBar(0xffb347);
      this.bar.position.y = type === 'tank' ? 2.6 : type === 'jet' ? 2.4 : 2.2;
      this.model.group.add(this.bar);
      this.targetYaw = 0;
    }

    get isAir() { return this.type === 'drone' || this.type === 'jet'; }

    update(dt) {
      if (this.dead) return;
      this.fireCd = Math.max(0, this.fireCd - dt);
      if (this.game.inVehicle === this) {
        this.updateDriven(dt);
      } else if (this.type === 'boat') {
        this.pos.y = (this.game.world.meta.waterLevel || 4) + 0.1 + Math.sin(this.game.time * 1.2) * 0.12;
        this.model.group.position.copy(this.pos);
      } else if (this.type === 'drone') {
        this.pos.y += Math.sin(this.game.time * 1.5) * dt * 0.3;
        this.model.group.position.copy(this.pos);
        this.model.wheels.forEach((r, i) => r.rotation.y += dt * 22 * (i % 2 ? 1 : -1));
      }
      const ratio = this.hp / this.maxHp;
      this.bar.visible = ratio < 0.999;
      const fill = this.bar.userData.fill;
      fill.scale.x = Math.max(0.001, ratio);
      fill.position.x = -(1 - ratio) * 0.43;
      this.bar.quaternion.copy(this.game.camera.quaternion);
    }

    driveInput(keys) {
      const fwd = (keys.w ? 1 : 0) - (keys.s ? 1 : 0);
      const turn = (keys.a ? 1 : 0) - (keys.d ? 1 : 0);
      return {
        fwd, turn,
        up: keys.space ? 1 : 0,
        down: keys.shift ? 1 : 0,
        boost: keys.shift ? 1 : 0,
        brake: keys.space ? 1 : 0
      };
    }

    updateDriven(dt) {
      const input = this.driveInput(this.game.keys);
      const p = this.game.player;
      const w = this.game.world;
      const turnRate = this.type === 'car' ? 1.9 : this.type === 'tank' ? 1.15 : this.type === 'apc' ? 1.55 : this.type === 'boat' ? 1.15 : this.type === 'drone' ? 1.7 : this.type === 'artillery' ? 0.65 : 1.0;
      this.yaw += input.turn * turnRate * dt;
      p.yaw = this.yaw;

      if (this.type === 'jet') {
        // 油门 / 失速 / 鼠标俯仰
        this.throttle = MW.clamp(this.throttle + input.fwd * dt * 0.65, 0, 1);
        const target = this.speed * this.throttle;
        this.airSpeed += (target - this.airSpeed) * Math.min(1, dt * 1.8);
        this.currentSpeed = this.airSpeed;
        const dx = -Math.sin(this.yaw) * this.airSpeed * dt;
        const dz = -Math.cos(this.yaw) * this.airSpeed * dt;
        const nx = this.pos.x + dx, nz = this.pos.z + dz;
        const surf = w.surfaceAt(nx, nz);
        let vy;
        if (this.airSpeed < 9) {
          vy = -7 * (1 - this.airSpeed / 9) + p.pitch * 3.5;
        } else {
          vy = p.pitch * 26 + (input.up - input.down) * 10;
        }
        let ny = this.pos.y + vy * dt;
        const wl = w.meta.waterLevel;
        if (wl != null && ny <= wl + 0.45) {
          this.crash('坠入海中');
          return;
        }
        const minY = surf + 0.5;
        if (ny < minY) {
          if (this.airSpeed > 18 && p.pitch < -0.40) {
            this.crash('俯冲撞地');
            return;
          }
          ny = minY;
          this.landing = true;
          if (!this.landed && this.airSpeed < 23) {
            this.landed = true;
            this.game.ui.toast('战斗机已接地 · 按 S 减速，E 离开', 'good');
          }
          if (this.airSpeed < 8) this.airSpeed *= Math.max(0, 1 - dt * 1.2);
          this.airborne = false;
        } else if (ny > surf + 1.6) {
          this.airborne = true;
          this.landing = false;
          this.landed = false;
        }
        if (w.collidesBox(nx, ny + 0.9, nz, this.radius, 1.0)) {
          this.crash('撞上建筑或地形');
          return;
        }
        this.pos.x = MW.clamp(nx, -this.game.travelBounds, this.game.travelBounds);
        this.pos.z = MW.clamp(nz, -this.game.travelBounds, this.game.travelBounds);
        this.pos.y = MW.clamp(ny, -4, 90);
      } else if (this.type === 'drone') {
        const sp = this.speed;
        const step = sp * input.fwd * dt;
        const nx = this.pos.x - Math.sin(this.yaw) * step;
        const nz = this.pos.z - Math.cos(this.yaw) * step;
        if (!w.collidesBox(nx, this.pos.y, this.pos.z, 0.8, 0.8)) this.pos.x = nx;
        if (!w.collidesBox(this.pos.x, this.pos.y, nz, 0.8, 0.8)) this.pos.z = nz;
        this.pos.y += (input.up - input.down) * 9 * dt;
        this.pos.y = MW.clamp(this.pos.y, w.surfaceAt(this.pos.x, this.pos.z) + 0.8, 60);
        this.pos.x = MW.clamp(this.pos.x, -this.game.travelBounds, this.game.travelBounds);
        this.pos.z = MW.clamp(this.pos.z, -this.game.travelBounds, this.game.travelBounds);
        this.currentSpeed = Math.abs(input.fwd) * sp;
        this.model.wheels.forEach((r, i) => r.rotation.y += dt * 26 * (i % 2 ? 1 : -1));
      } else if (this.type === 'boat') {
        const wl = w.meta.waterLevel || 4;
        let sp = this.speed * (input.boost ? 1.6 : 1) * (input.brake ? 0.2 : 1);
        if (input.fwd < 0) sp *= 0.5;
        const dx = -Math.sin(this.yaw) * sp * input.fwd * dt;
        const dz = -Math.cos(this.yaw) * sp * input.fwd * dt;
        this.currentSpeed = Math.abs(sp * input.fwd);
        const canSail = (x, z) => {
          if (w.surfaceAt(x, z) > wl + 0.8) return false;
          for (const s of this.game.ships) {
            if (!s.dead && Math.hypot(s.pos.x - x, s.pos.z - z) < 12.5) return false;
          }
          return true;
        };
        const nx = this.pos.x + dx, nz = this.pos.z + dz;
        if (canSail(nx, this.pos.z)) this.pos.x = nx;
        if (canSail(this.pos.x, nz)) this.pos.z = nz;
        this.pos.x = MW.clamp(this.pos.x, -this.game.travelBounds, this.game.travelBounds);
        this.pos.z = MW.clamp(this.pos.z, -this.game.travelBounds, this.game.travelBounds);
        this.pos.y = wl + 0.1 + Math.sin(this.game.time * 1.6) * 0.1;
      } else {
        let sp = this.speed * (input.boost ? 1.8 : 1) * (input.brake ? 0.2 : 1);
        if (input.fwd < 0) sp *= 0.45;
        this.currentSpeed = Math.abs(sp * input.fwd);
        const dx = -Math.sin(this.yaw) * sp * input.fwd * dt;
        const dz = -Math.cos(this.yaw) * sp * input.fwd * dt;
        const bodyH = this.type === 'car' ? 1.55 : this.type === 'tank' ? 2.5 : this.type === 'apc' ? 2.5 : this.type === 'artillery' ? 2.3 : 1.9;
        const blocked = (x, z) => {
          if (w.collidesBox(x, this.pos.y + bodyH / 2, z, this.radius, bodyH)) return true;
          if (this.game.collidesDoor(x, this.pos.y + bodyH / 2, z, this.radius, bodyH)) return true;
          for (const v of this.game.vehicles) {
            if (v === this || v.dead) continue;
            if (Math.hypot(v.pos.x - x, v.pos.z - z) < this.radius + v.radius) return true;
          }
          return false;
        };
        const nx = this.pos.x + dx, nz = this.pos.z + dz;
        if (!blocked(nx, this.pos.z)) this.pos.x = nx;
        if (!blocked(this.pos.x, nz)) this.pos.z = nz;
        this.pos.y = w.surfaceAt(this.pos.x, this.pos.z);
      }

      this.model.group.position.copy(this.pos);
      this.model.group.rotation.y = this.yaw;
      this.model.group.rotation.x = this.type === 'jet' ? -p.pitch * 0.35 : 0;
      this.game.player.pos.copy(this.pos);
      this.game.player.pos.y += this.type === 'jet' ? 0.7 : 1.2;
      if (this.type === 'tank' && this.model.turret) {
        const keys = this.game.keys || {};
        const pin = (keys.arrowup ? 1 : 0) - (keys.arrowdown ? 1 : 0);
        if (pin) this.adjustTurretPitch(pin * 0.85 * dt);
        this.model.turret.rotation.y = 0;
        if (this.model.barrel) this.model.barrel.rotation.x = -this.turretPitch * 0.9;
      } else if (this.model.turret) {
        this.model.turret.rotation.x = 0;
        let diff = ((this.yaw - this.model.turret.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        this.model.turret.rotation.y += diff * Math.min(1, dt * 7);
      }
      if (this.type === 'artillery' && this.model.barrel) {
        this.model.barrel.rotation.x = -this.turretPitch * 0.9;
      }
    }

    crash(reason) {
      if (this.dead) return;
      this.dead = true;
      this.crashReason = reason;
      const p = this.game.player;
      this.game.combat.explode(this.pos.clone(), 17, 220, { source: 'player' });
      this.game.ui.toast(`战斗机坠毁：${reason}`, 'bad');
      if (this.game.inVehicle === this) {
        this.game.inVehicle = null;
        p.pos.set(this.pos.x, this.game.world.surfaceAt(this.pos.x, this.pos.z) + 1, this.pos.z);
        p.vel.set(0, 0, 0);
      }
      this.game.scene.remove(this.model.group);
      this.game.ui.updateVehicleHUD(null);
      this.game.player.spawnProtect = Math.max(this.game.player.spawnProtect, 0.4);
    }

    pushByPlayer(player, dt) {
      if (this.type !== 'artillery' || this.dead || this.driver) return;
      const dx = this.pos.x - player.pos.x, dz = this.pos.z - player.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > this.radius + 1.8 || dist < 0.01) return;
      const vx = player.vel.x, vz = player.vel.z;
      const vlen = Math.hypot(vx, vz);
      if (vlen < 0.5) return;
      const dot = (vx * dx + vz * dz) / (vlen * dist);
      if (dot < 0.25) return;
      const step = 1.1 * dt;
      const nx = this.pos.x + (dx / dist) * step;
      const nz = this.pos.z + (dz / dist) * step;
      if (this.game.world.collidesBox(nx, this.pos.y + 0.5, nz, this.radius, 2.0)) return;
      if (this.game.collidesDoor(nx, this.pos.y + 0.5, nz, this.radius, 1.8)) return;
      for (const v of this.game.vehicles) {
        if (v === this || v.dead) continue;
        if (Math.hypot(v.pos.x - nx, v.pos.z - nz) < this.radius + v.radius) return;
      }
      this.pos.x = nx;
      this.pos.z = nz;
      this.pos.y = this.game.world.surfaceAt(nx, nz);
      this.model.group.position.copy(this.pos);
      this.currentSpeed = 1.1;
    }

    enter() {
      this.driver = this.game.player;
      this.game.inVehicle = this;
      this.fpv = false;
      this.turretPitch = 0;
      this.model.group.visible = true;
      const label = this.type === 'drone' ? '操控无人机' : this.type === 'jet' ? '驾驶战斗机' : this.type === 'artillery' ? '推动重炮' : `驾驶 ${this.name}`;
      const tip = this.type === 'drone'
        ? 'W/S 前后 · A/D 转向 · Space/Shift 升降 · V 视角 · E 降落'
        : this.type === 'jet'
          ? 'W/S 油门 · A/D 转向 · 鼠标上下 俯仰 · V 座舱 · E 离开'
          : this.type === 'tank'
            ? 'A/D 转向 · W/S 前后 · 滚轮/↑↓ 炮口俯仰 · 左键开火 · E 离开'
            : this.type === 'artillery'
              ? 'A/D 转向 · W/S 缓慢推动 · 滚轮/↑↓ 炮口 · 左键重炮 · E 离开'
              : `W/S 前后 · A/D 转向 · ${this.type === 'car' ? 'Shift 加速 · Space 刹车' : 'Shift 加速'} · 左键开火 · E 离开`;
      this.game.ui.toast(`${label} · ${tip}`, 'info');
      this.game.player.yaw = this.yaw;
      this.game.player.pitch = 0;
      MW.SFX.click();
    }

    exit() {
      this.game.inVehicle = null;
      this.driver = null;
      this.fpv = false;
      this.model.group.visible = true;
      const p = this.game.player;
      if (this.type === 'drone') {
        this.pos.y = this.game.world.surfaceAt(this.pos.x, this.pos.z) + 0.8;
        this.model.group.position.copy(this.pos);
        this.game.ui.toast('无人机已降落 · 离开操控', 'info');
      } else if (this.type === 'jet') {
        this.pos.y = this.game.world.surfaceAt(this.pos.x, this.pos.z) + 0.2;
        this.throttle = 0;
        this.airSpeed = 0;
        this.currentSpeed = 0;
        this.model.group.position.copy(this.pos);
        this.game.ui.toast('已离开战斗机', 'info');
      } else {
        this.game.ui.toast('已离开载具', 'info');
      }
      p.pos.set(this.pos.x + 2.4, this.game.world.surfaceAt(this.pos.x + 2.4, this.pos.z), this.pos.z);
      p.vel.set(0, 0, 0);
      p.avatar.group.visible = p.thirdPerson;
      this.game.ui.updateVehicleHUD(null);
    }

    aimAtShip(origin, baseDir, speed) {
      let best = null, bestDot = 0.9;
      for (const s of this.game.ships) {
        if (s.dead) continue;
        const to = s.pos.clone().add(new THREE.Vector3(0, 3, 0)).sub(origin);
        const dist = to.length();
        if (dist > 170) continue;
        const dot = to.normalize().dot(baseDir);
        if (dot > bestDot) { bestDot = dot; best = s; }
      }
      if (!best) return baseDir.clone();
      const target = best.pos.clone().add(new THREE.Vector3(0, 2.6, 0));
      const dist = origin.distanceTo(target);
      const flight = dist / Math.max(20, speed);
      target.y += 0.5 * 3.2 * flight * flight;
      return target.sub(origin).normalize();
    }

    adjustTurretPitch(delta) {
      this.turretPitch = MW.clamp(this.turretPitch + delta, -0.12, 0.9);
      if (this.model.barrel) this.model.barrel.rotation.x = -this.turretPitch * 0.9;
      this.game.ui.updateVehicleHUD(this.game.inVehicle === this ? this : null);
    }

    fire() {
      if (this.fireCd > 0) return;
      const dir = this.game.player.forward.clone();
      const origin = this.pos.clone().add(new THREE.Vector3(0, this.type === 'drone' ? 0.3 : 1.6, 0));
      if (this.type === 'tank') {
        this.fireCd = 3.6;
        const cp = Math.cos(this.turretPitch);
        const rocketDir = new THREE.Vector3(-Math.sin(this.yaw) * cp, Math.sin(this.turretPitch), -Math.cos(this.yaw) * cp).normalize();
        const muzzle = this.pos.clone().add(new THREE.Vector3(0, 1.9, 0)).addScaledVector(rocketDir, 3.4);
        this.game.combat.launchShell(muzzle, rocketDir, 115, 8.5, 130, 'player');
        MW.SFX.explosion(0.8);
        this.game.shake(0.5, 0.35);
      } else if (this.type === 'artillery') {
        this.fireCd = 4.6;
        const cp = Math.cos(this.turretPitch);
        const dirA = new THREE.Vector3(-Math.sin(this.yaw) * cp, Math.sin(this.turretPitch), -Math.cos(this.yaw) * cp).normalize();
        const muzzle = this.pos.clone().add(new THREE.Vector3(0, 2.0, 0)).addScaledVector(dirA, 3.8);
        this.game.combat.launchShell(muzzle, dirA, 125, 10.5, 260, 'player');
        MW.SFX.explosion(1.3);
        this.game.shake(0.6, 0.4);
      } else if (this.type === 'apc') {
        this.fireCd = 0.12;        const spread = 0.02;
        const d = this.game.player.forward.clone();
        d.x += (Math.random() - 0.5) * spread;
        d.y += (Math.random() - 0.5) * spread;
        this.game.combat.hitscan(origin, d, 26, 140, { tracer: 0xffd27a, fromPlayer: true });
        MW.SFX.shoot('minigun');
      } else if (this.type === 'boat') {
        this.fireCd = 2.4;
        const aim = this.aimAtShip(origin, dir, 130);
        this.game.combat.launchShell(origin.clone().addScaledVector(aim, 2.4), aim, 130, 7.5, 300, 'player');
        MW.SFX.explosion(0.9);
        this.game.shake(0.4, 0.25);
      } else if (this.type === 'jet') {
        this.fireCd = 1.5;
        const aim = this.aimAtShip(origin, dir, 180);
        for (const side of [-1, 1]) {
          const start = origin.clone().add(new THREE.Vector3(side * 2, -0.1, 0));
          this.game.combat.launchShell(start, aim, 180, 6.5, 220, 'player');
        }
        MW.SFX.explosion(0.6);
        this.game.shake(0.35, 0.2);
      } else if (this.type === 'drone') {
        this.fireCd = 0.1;
        this.game.combat.hitscan(origin, dir, 18, 160, { tracer: 0x64f0ff, fromPlayer: true });
        MW.SFX.shoot('laser');
      }
    }

    damage(n) {
      if (this.dead) return;
      this.hp -= n;
      if (this.hp <= 0) {
        this.dead = true;
        this.game.combat.explode(this.pos.clone(), 8, 0, { visualOnly: false, source: 'vehicle' });
        this.game.scene.remove(this.model.group);
        this.game.ui.toast(`${this.name} 被摧毁`, 'bad');
        if (this.game.inVehicle === this) this.game.inVehicle = null;
        this.game.removeVehicle(this);
      }
    }
  }

  /* =========================================================
     空投补给
     ========================================================= */
  class Airdrop {
    constructor(game, kind, x, z) {
      this.game = game;
      this.kind = kind;
      this.pos = new THREE.Vector3(x, game.world.surfaceAt(x, z) + 38, z);
      this.landed = false;
      const g = new THREE.Group();
      MW.Models.addBox(g, 2.2, 2.0, 2.2, 0x6b5a3f, 0, 1.0, 0);
      MW.Models.addBox(g, 2.35, 0.18, 2.35, 0x2f4f5a, 0, 1.2, 0);
      MW.Models.addBox(g, 0.35, 2.1, 2.3, 0xd8b25a, 0, 1.0, 0);
      const canopy = new THREE.Mesh(new THREE.SphereGeometry(2.8, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.42), new THREE.MeshLambertMaterial({ color: 0xd9e2e8, side: THREE.DoubleSide }));
      canopy.position.y = 5.2;
      g.add(canopy);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const line = MW.Models.addBox(g, 0.05, 2.6, 0.05, 0x40484c, sx * 1.8, 3.6, sz * 1.8);
        line.rotation.z = sx * 0.22;
        line.rotation.x = -sz * 0.22;
      }
      const beacon = MW.Models.glowSprite(0x7fd8ff, 1.6);
      beacon.position.y = 2.4;
      g.add(beacon);
      g.position.copy(this.pos);
      this.mesh = g;
      game.scene.add(g);
      this.phase = 0;
    }

    update(dt) {
      if (this.landed) return;
      this.phase += dt;
      this.pos.y -= 5.2 * dt;
      this.mesh.position.copy(this.pos);
      this.mesh.rotation.y = Math.sin(this.phase * 0.7) * 0.15;
      if (this.pos.y <= this.game.world.surfaceAt(this.pos.x, this.pos.z) + 1.4) {
        this.landed = true;
        this.game.landAirdrop(this);
      }
    }
  }

  /* =========================================================
     敌方战舰
     ========================================================= */
  class EnemyShip {
    constructor(game, x, z) {
      this.game = game;
      this.name = '敌舰';
      this.model = MW.Models.vehicle('warship');
      const wl = game.world.meta.waterLevel || 4;
      this.pos = new THREE.Vector3(x, wl, z);
      this.model.group.position.copy(this.pos);
      this.model.group.rotation.y = Math.atan2(-(-x), -(-z));
      game.scene.add(this.model.group);
      this.hp = 700;
      this.maxHp = 1200;
      this.fireCd = 14 + Math.random() * 8;
      this.dead = false;
      this.phase = Math.random() * 5;
      this.bar = makeHealthBar(0xff5a4a);
      this.bar.position.y = 9;
      this.model.group.add(this.bar);
    }

    update(dt) {
      if (this.dead) return;
      this.phase += dt;
      this.pos.y = (this.game.world.meta.waterLevel || 4) + 0.05 + Math.sin(this.phase * 1.1) * 0.12;
      this.model.group.position.copy(this.pos);
      this.model.group.rotation.z = Math.sin(this.phase * 0.7) * 0.02;
      this.fireCd -= dt;
      const player = this.game.player;
      if (player.alive && this.fireCd <= 0) {
        const d = player.pos.distanceTo(this.pos);
        if (d < 95) {
          this.fireCd = 5.5;
          const target = player.pos.clone().addScaledVector(player.vel, 1.2);
          const from = this.pos.clone().add(new THREE.Vector3(0, 3.4, 0));
          target.y = Math.max(1, target.y);
          const dir = target.sub(from).normalize();
          this.game.combat.launchShell(from, dir, 70, 6, 90, 'enemy');
          this.game.ui.toast('敌舰向你开火！', 'bad');
          MW.SFX.explosion(0.7);
        }
      }
      const ratio = this.hp / this.maxHp;
      this.bar.visible = ratio < 0.999;
      const fill = this.bar.userData.fill;
      fill.scale.x = Math.max(0.001, ratio);
      fill.position.x = -(1 - ratio) * 0.43;
      this.bar.quaternion.copy(this.game.camera.quaternion);
    }

    damage(n) {
      if (this.dead) return;
      this.hp -= n;
      this.game.ui.hitMarker('hit');
      MW.SFX.hit();
      if (this.hp <= 0) {
        this.dead = true;
        this.game.combat.explode(this.pos.clone().add(new THREE.Vector3(0, 2, 0)), 14, 0, { source: 'ship' });
        MW.SFX.explosion(2.2);
        this.game.ui.toast('敌舰已被击沉！', 'good');
        this.game.addCoins(300);
        this.game.onShipDestroyed(this);
        this.model.group.position.y -= 20;
        this.game.scene.remove(this.model.group);
        this.game.removeShip(this);
        this.game.checkVictory();
      }
    }
  }

  /* =========================================================
     据点
     ========================================================= */
  class Zone {
    constructor(game, def) {
      this.game = game;
      this.def = def;
      this.pos = new THREE.Vector3(def.x, game.world.surfaceAt(def.x, def.z), def.z);
      this.color = def.enemy ? 0xd8513e : 0x5bd08a;
      this.model = MW.Models.flag(this.color);
      this.model.position.copy(this.pos);
      game.scene.add(this.model);
      this.progress = 0;
      this.captured = false;
      this.presence = 0;
      this.zombiesInside = 0;
      this.ring = new THREE.Mesh(
        new THREE.RingGeometry(def.r - 0.4, def.r, 48),
        new THREE.MeshBasicMaterial({ color: this.color, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
      );
      this.ring.rotation.x = -Math.PI / 2;
      this.ring.position.set(def.x, this.pos.y + 0.03, def.z);
      game.scene.add(this.ring);
      this.phase = Math.random() * 5;
    }

    update(dt) {
      this.phase += dt;
      if (this.captured) {
        this.ring.material.opacity = 0.12 + Math.sin(this.phase * 2) * 0.03;
        return;
      }
      let units = 0;
      const p = this.game.player;
      if (p.alive && this.distTo(p.pos) < this.def.r) units += 1;
      for (const s of this.game.soldiers) {
        if (!s.dead && this.distTo(s.pos) < this.def.r) units += 1.5;
      }
      this.presence = units;
      let zcount = 0;
      for (const z of this.game.zombies) {
        if (!z.dead && this.distTo(z.pos) < this.def.r) zcount++;
      }
      this.zombiesInside = zcount;
      const contested = zcount > 0;
      if (units > 0 && !contested) {
        this.progress = Math.min(100, this.progress + dt * (2.2 + units * 1.5));
      } else if (units === 0) {
        this.progress = Math.max(0, this.progress - dt * 1.0);
      }
      const flagCloth = this.model.userData.cloth;
      if (flagCloth) flagCloth.rotation.y = Math.sin(this.phase * 2.2) * 0.18;
      this.ring.material.color.setHex(contested ? 0xff7a4a : this.color);
      this.ring.material.opacity = 0.2 + Math.sin(this.phase * 3) * 0.06;
      if (this.progress >= 100) this.capture();
    }

    distTo(v) {
      return Math.hypot(v.x - this.def.x, v.z - this.def.z);
    }

    capture() {
      if (this.captured) return;
      this.captured = true;
      this.progress = 100;
      this.color = 0x5bd08a;
      this.model.userData.cloth.material.color.setHex(0x5bd08a);
      this.ring.material.color.setHex(0x5bd08a);
      this.ring.material.opacity = 0.14;
      this.game.addCoins(180);
      this.game.ui.toast(`已占领据点：${this.def.name} · +180 金币`, 'good');
      MW.SFX.pickup();
      this.game.spawnSupplyDrop(this.pos.clone());
      this.game.ui.updateObjectives();
      this.game.checkVictory();
      this.game.saveLater();
    }
  }

  /* =========================================================
     世界便签
     ========================================================= */
  class NoteMarker {
    constructor(game, note) {
      this.game = game;
      this.note = note;
      const g = new THREE.Group();
      const y = game.world.surfaceAt(note.x, note.z);
      this.pos = new THREE.Vector3(note.x, y, note.z);
      MW.Models.addBox(g, 0.12, 1.2, 0.12, 0x8a6b45, 0, 0.6, 0);
      MW.Models.addBox(g, 0.7, 0.5, 0.06, 0xf0e6c8, 0.2, 1.0, 0);
      MW.Models.addBox(g, 0.5, 0.06, 0.07, 0x9a7a4e, 0.18, 1.15, 0.005);
      MW.Models.addBox(g, 0.5, 0.06, 0.07, 0x9a7a4e, 0.18, 1.0, 0.005);
      MW.Models.addBox(g, 0.5, 0.06, 0.07, 0x9a7a4e, 0.18, 0.85, 0.005);
      const halo = MW.Models.glowSprite(0xffd78a, 0.8);
      halo.position.y = 1.15;
      g.add(halo);
      g.position.copy(this.pos);
      this.mesh = g;
      this.phase = Math.random() * 5;
      game.scene.add(g);
    }

    update(dt) {
      this.phase += dt;
      this.mesh.position.y = this.pos.y + Math.sin(this.phase * 1.6) * 0.05;
    }

    remove() {
      this.game.scene.remove(this.mesh);
    }
  }

  /* =========================================================
     投掷物 / 地雷
     ========================================================= */
  class Projectile {
    constructor(game, pos, vel, opts) {
      this.game = game;
      this.pos = pos.clone();
      this.vel = vel.clone();
      this.type = opts.type || 'grenade';
      this.radius = opts.radius || 6;
      this.damage = opts.damage || 100;
      this.fuse = opts.fuse == null ? 2.4 : opts.fuse;
      this.source = opts.source || 'player';
      this.dead = false;
      this.age = 0;
      this.gravity = opts.gravity == null ? 19 : opts.gravity;
      this.bounces = opts.bounces || 0;
      this.homing = opts.homing || null;
      const size = this.type === 'shell' ? 0.28 : (this.type === 'rocket' || this.type === 'missile') ? 0.34 : 0.22;
      const color = this.type === 'missile' ? 0xd8d2c4 : this.type === 'rocket' ? 0xff8a3d : 0x3d4a35;
      this.mesh = new THREE.Mesh(
        new THREE.SphereGeometry(size, 8, 6),
        new THREE.MeshLambertMaterial({ color })
      );
      this.mesh.position.copy(pos);
      if (this.type === 'rocket' || this.type === 'shell' || this.type === 'missile') {
        const halo = MW.Models.glowSprite(this.type === 'missile' ? 0xffd27a : 0xffa347, 1.1);
        this.mesh.add(halo);
      }
      game.scene.add(this.mesh);
      this.trailT = 0;
      if (this.type === 'missile') this.gravity = 3.2;
    }

    update(dt) {
      if (this.dead) return;
      this.age += dt;
      if (this.homing) {
        if (this.homing.dead) this.homing = null;
        else {
          const target = this.homing.pos.clone();
          if (this.homing.height) target.y += this.homing.height * 0.5;
          else target.y += 3;
          const toTarget = target.clone().sub(this.pos);
          const dist = toTarget.length();
          const speed = this.vel.length();
          const want = toTarget.normalize().multiplyScalar(speed);
          this.vel.lerp(want, Math.min(1, dt * 3.4));
          if (this.vel.length() > 0.01) this.vel.setLength(speed);
          if (dist < 3) { this.explode(); return; }
        }
      }
      this.vel.y -= this.gravity * dt;
      const steps = 3;
      const sdt = dt / steps;
      for (let i = 0; i < steps; i++) {
        this.pos.addScaledVector(this.vel, sdt);
        // 命中战舰/大型载具
        if (this.type === 'shell' || this.type === 'rocket' || this.type === 'missile') {
          for (const s of this.game.ships) {
            if (s.dead) continue;
            const center = s.pos.clone().add(new THREE.Vector3(0, 3, 0));
            if (this.pos.distanceTo(center) < 7.2) {
              this.explode();
              return;
            }
          }
          for (const v of this.game.vehicles) {
            if (v.dead || v === this.game.inVehicle) continue;
            if (this.source === 'player' && this.pos.distanceTo(v.pos.clone().add(new THREE.Vector3(0, 1, 0))) < 2.8) {
              this.explode();
              return;
            }
          }
        }
        if (this.game.world.collidesBox(this.pos.x, this.pos.y, this.pos.z, 0.1, 0.2)) {
          if (this.type === 'grenade' && this.bounces < 2) {
            this.bounces++;
            this.vel.y = Math.abs(this.vel.y) * 0.4;
            this.vel.x *= 0.6; this.vel.z *= 0.6;
            this.pos.y += 0.1;
          } else {
            this.explode();
            return;
          }
        }
      }
      const wl = this.game.world.meta.waterLevel;
      if ((this.type === 'shell' || this.type === 'rocket' || this.type === 'missile') && wl != null && this.pos.y <= wl + 0.15 && !this.homing) {
        this.explode();
        return;
      }
      this.mesh.position.copy(this.pos);
      this.trailT += dt;
      if ((this.type === 'rocket' || this.type === 'shell' || this.type === 'missile') && this.trailT > 0.02) {
        this.trailT = 0;
        this.game.combat.smoke(this.pos, this.type === 'missile' ? 0xd8d2c4 : 0xffa347, 1);
      }
      this.fuse -= dt;
      if (this.fuse <= 0) this.explode();
      if (this.pos.y < -20) this.remove();
    }

    explode() {
      if (this.dead) return;
      this.dead = true;
      this.game.scene.remove(this.mesh);
      this.game.combat.explode(this.pos.clone(), this.radius, this.damage, { source: this.source });
      this.game.removeProjectile(this);
    }

    remove() {
      this.dead = true;
      this.game.scene.remove(this.mesh);
      this.game.removeProjectile(this);
    }
  }

  class Mine {
    constructor(game, pos) {
      this.game = game;
      this.pos = pos.clone();
      this.armed = false;
      this.age = 0;
      this.dead = false;
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.12, 10), new THREE.MeshLambertMaterial({ color: 0x3f4436 }));
      base.position.y = 0.06;
      g.add(base);
      const glow = MW.Models.glowSprite(0xff4b3a, 0.9);
      glow.position.y = 0.2;
      g.add(glow);
      this.glow = glow;
      g.position.copy(this.pos);
      this.mesh = g;
      game.scene.add(g);
      this.phase = 0;
    }

    update(dt) {
      if (this.dead) return;
      this.age += dt;
      this.phase += dt;
      if (!this.armed && this.age > 1.2) this.armed = true;
      if (this.armed) {
        this.glow.material.opacity = 0.4 + Math.abs(Math.sin(this.phase * 6)) * 0.6;
        let trigger = false;
        for (const z of this.game.zombies) {
          if (!z.dead && this.pos.distanceTo(z.pos) < 4.2) { trigger = true; break; }
        }
        const p = this.game.player;
        if (p.alive && this.pos.distanceTo(p.pos) < 2.2) trigger = true;
        if (this.game.inVehicle && this.pos.distanceTo(this.game.inVehicle.pos) < 4) trigger = true;
        if (trigger) this.explode();
      } else {
        this.glow.material.opacity = 0.25 + this.age * 0.3;
      }
    }

    explode() {
      if (this.dead) return;
      this.dead = true;
      this.game.scene.remove(this.mesh);
      this.game.combat.explode(this.pos.clone().add(new THREE.Vector3(0, 0.4, 0)), 7, 140, { source: 'mine' });
      this.game.removeMine(this);
    }
  }

  /* =========================================================
     楼层电梯
     ========================================================= */
  class Elevator {
    constructor(game, spec) {
      this.game = game;
      this.spec = spec;
      this.floors = Math.max(2, spec.floors || 2);
      this.baseY = spec.y;
      this.pos = new THREE.Vector3(spec.x, spec.y + 1, spec.z);
      this.doorOpen = false;
      this.doorAnim = 0;
      this.moving = false;
      this.travel = 0;
      this.fromY = spec.y;
      this.toY = spec.y;
      this.targetFloor = 0;
      this.phase = Math.random() * 3;

      const g = new THREE.Group();
      const metal = 0x3b4650, panel = 0x7f8c95, glass = 0x8fd8ff;
      // 电梯间/轿厢：地面、三面墙与顶
      MW.Models.addBox(g, 2.9, 0.18, 2.9, 0x59636a, 0, 0.09, 0);
      MW.Models.addBox(g, 2.9, 2.6, 0.16, metal, 0, 1.35, -1.4);
      MW.Models.addBox(g, 0.16, 2.6, 2.9, metal, -1.4, 1.35, 0);
      MW.Models.addBox(g, 0.16, 2.6, 2.9, metal, 1.4, 1.35, 0);
      MW.Models.addBox(g, 2.9, 0.16, 2.9, metal, 0, 2.7, 0);
      MW.Models.addBox(g, 1.0, 1.9, 0.05, 0x28424e, 0, 1.4, -1.31);
      const btn = MW.Models.addBox(g, 0.14, 0.14, 0.06, 0xffd27a, 1.12, 1.15, 1.3, true);
      this.button = btn;
      // 双开滑门
      this.leftDoor = MW.Models.addBox(g, 1.22, 2.35, 0.12, panel, -0.7, 1.35, 1.42);
      this.rightDoor = MW.Models.addBox(g, 1.22, 2.35, 0.12, panel, 0.7, 1.35, 1.42);
      MW.Models.addBox(g, 1.1, 0.18, 0.08, 0x1c252b, -0.7, 2.03, 1.49);
      MW.Models.addBox(g, 1.1, 0.18, 0.08, 0x1c252b, 0.7, 2.03, 1.49);
      this.floorLight = MW.Models.addBox(g, 0.55, 0.2, 0.06, 0x64f0ff, 0, 2.55, 1.42, true);
      // 井道导视
      MW.Models.addBox(g, 0.08, 2.4, 0.08, 0x64f0ff, -1.55, 1.35, 1.3, true);
      g.position.set(spec.x, spec.y, spec.z);
      game.scene.add(g);
      this.mesh = g;
    }

    update(dt) {
      this.phase += dt;
      const target = this.doorOpen ? 1 : 0;
      this.doorAnim = MW.lerp(this.doorAnim, target, Math.min(1, dt * 5));
      if (this.leftDoor) this.leftDoor.position.x = -0.7 - this.doorAnim * 1.05;
      if (this.rightDoor) this.rightDoor.position.x = 0.7 + this.doorAnim * 1.05;
      if (this.button) {
        const s = 1 + Math.sin(this.phase * 3) * 0.2;
        this.button.scale.set(s, s, 1);
      }
      if (this.moving) {
        this.travel += dt / 1.25;
        const t = MW.clamp(this.travel, 0, 1);
        const ease = t * t * (3 - 2 * t);
        this.mesh.position.y = MW.lerp(this.fromY, this.toY, ease);
        if (this.game.player && this.game.player.elevatorRide) {
          this.game.player.pos.set(this.spec.x, this.mesh.position.y + 1.05, this.spec.z + 0.35);
        }
        if (t >= 1) {
          this.moving = false;
          this.mesh.position.y = this.toY;
          this.doorOpen = true;
          if (this.game.player && this.game.player.elevatorRide) {
            this.game.player.elevatorRide = false;
            const sx = this.spec.spawnX != null ? this.spec.spawnX : this.spec.x;
            const sz = this.spec.spawnZ != null ? this.spec.spawnZ : this.spec.z;
            this.game.player.pos.set(sx, this.toY + 1.05, sz);
            this.game.player.vel.set(0, 0, 0);
          }
          this.game.ui.toast(`电梯到达 ${this.targetFloor + 1}F`, 'good');
          MW.SFX.click();
        }
      }
    }

    openDoors() { this.doorOpen = true; }
    closeDoors() { this.doorOpen = false; }

    travelTo(floor) {
      this.closeDoors();
      this.targetFloor = floor;
      this.fromY = this.mesh.position.y;
      this.toY = this.spec.y + floor * 4;
      this.travel = 0;
      this.moving = true;
    }
  }

  /* =========================================================
     城门吊桥
     ========================================================= */
  class Drawbridge {
    constructor(game, spec) {
      this.game = game;
      this.spec = spec;
      this.axis = spec.axis === 'x' ? 'x' : 'z';
      this.dir = spec.dir === -1 ? -1 : 1;
      this.len = spec.len || 12;
      this.width = spec.width || 8;
      this.open = false;
      this.angle = 0;
      const g = new THREE.Group();
      g.position.set(spec.x, spec.y + 0.9, spec.z);
      const deck = new THREE.Group();
      const wood = 0x6b4a2c, woodDark = 0x4a3322, iron = 0x384046;
      for (let i = 0; i < 7; i++) {
        const plank = MW.Models.addBox(deck, this.width - 0.2, 0.16, this.len / 7 - 0.04, i % 2 ? wood : MW.shade(wood, 0.08), 0, 0, this.dir * (i + 0.5) * this.len / 7);
        plank.rotation.x = 0;
      }
      MW.Models.addBox(deck, 0.2, 0.28, this.len, iron, -this.width / 2, -0.16, this.dir * this.len / 2);
      MW.Models.addBox(deck, 0.2, 0.28, this.len, iron, this.width / 2, -0.16, this.dir * this.len / 2);
      for (const sx of [-1, 1]) {
        const chain = MW.Models.addBox(g, 0.08, 0.08, 3.6, iron, sx * (this.width / 2 - 0.3), 1.2, this.dir * 0.6);
        chain.rotation.x = this.dir * 0.5;
      }
      if (this.axis === 'x') deck.rotation.y = Math.PI / 2;
      g.add(deck);
      g.position.y = spec.y + 1.1;
      game.scene.add(g);
      this.deck = deck;
      this.mesh = g;
    }

    setOpen(open) { this.open = open; }

    update(dt) {
      const target = this.open ? 0 : -this.dir * Math.PI * 0.5;
      this.angle = MW.lerp(this.angle, target, Math.min(1, dt * 3.2));
      if (this.axis === 'z') this.deck.rotation.x = this.angle;
      else this.deck.rotation.z = -this.angle;
    }
  }

  /* =========================================================
     可开关的门
     ========================================================= */
  class Door {
    constructor(game, spec) {
      this.game = game;
      this.spec = spec;
      this.w = Math.max(2, spec.w || 2);
      this.h = Math.max(2, spec.h || 3);
      this.axis = spec.axis === 'x' ? 'x' : 'z';
      this.pos = this.axis === 'x'
        ? new THREE.Vector3(spec.x + 0.5, spec.y + 1, spec.z)
        : new THREE.Vector3(spec.x, spec.y + 1, spec.z + 0.5);
      this.open = false;
      this.anim = 0;
      const color = spec.color || 0x6b4a2c;
      const g = new THREE.Group();
      const frameMat = MW.Models.mat(MW.shade(color, -0.35));
      const panelMat = MW.Models.mat(color);
      const half = this.w / 2;
      // 门框
      for (const sx of [-half, half]) {
        const frame = new THREE.Mesh(MW.BOX_GEO, frameMat);
        frame.scale.set(0.16, this.h + 0.2, 0.26);
        frame.position.set(sx, this.h / 2, 0);
        g.add(frame);
      }
      const lintel = new THREE.Mesh(MW.BOX_GEO, frameMat);
      lintel.scale.set(this.w + 0.3, 0.18, 0.26);
      lintel.position.set(0, this.h, 0);
      g.add(lintel);
      // 双开木门板：左右两扇分别向两侧打开
      const leafW = (this.w - 0.16) / 2;
      this.leftHinge = new THREE.Group();
      this.leftHinge.position.set(-half + 0.08, 0, 0);
      this.rightHinge = new THREE.Group();
      this.rightHinge.position.set(half - 0.08, 0, 0);
      for (const side of [-1, 1]) {
        const hinge = side < 0 ? this.leftHinge : this.rightHinge;
        const panel = new THREE.Mesh(MW.BOX_GEO, panelMat);
        panel.scale.set(leafW - 0.04, this.h - 0.1, 0.12);
        panel.position.set(side * (leafW / 2), (this.h - 0.1) / 2, 0);
        hinge.add(panel);
        const win = new THREE.Mesh(MW.BOX_GEO, MW.Models.glowMat(0x8fd8ff, 0.7));
        win.scale.set(leafW * 0.48, 0.32, 0.03);
        win.position.set(side * (leafW / 2), this.h * 0.7, -0.08);
        hinge.add(win);
        const handle = new THREE.Mesh(MW.BOX_GEO, MW.Models.glowMat(0xffd27a));
        handle.scale.set(0.07, 0.07, 0.08);
        handle.position.set(side * (leafW - 0.25), this.h * 0.48, -0.1);
        hinge.add(handle);
        g.add(hinge);
      }
      const trim = new THREE.Mesh(MW.BOX_GEO, MW.Models.mat(MW.shade(color, -0.22)));
      trim.scale.set(this.w - 0.2, 0.07, 0.15);
      trim.position.set(0, this.h * 0.34, 0);
      g.add(trim);
      if (this.axis === 'x') {
        g.position.set(spec.x + 0.5, spec.y + 1, spec.z);
        g.rotation.y = Math.PI / 2;
      } else {
        g.position.set(spec.x, spec.y + 1, spec.z + 0.5);
      }
      this.mesh = g;
      game.scene.add(g);
      this.phase = Math.random() * 3;
    }

    get id() { return `${this.axis}:${this.spec.x},${this.spec.y},${this.spec.z}`; }

    update(dt) {
      const target = this.open ? -Math.PI * 0.52 : 0;
      this.leftHinge.rotation.y = MW.lerp(this.leftHinge.rotation.y, target, Math.min(1, dt * 9));
      this.rightHinge.rotation.y = MW.lerp(this.rightHinge.rotation.y, -target, Math.min(1, dt * 9));
    }

    toggle() {
      this.open = !this.open;
      MW.SFX.click();
      if (this.spec.gateId && this.game.bridges) {
        const br = this.game.bridges.find(b => b.spec.id === this.spec.gateId);
        if (br) br.setOpen(this.open);
      }
      this.game.ui.toast(this.open ? `已打开：${this.spec.name || '门'}` : `已关闭：${this.spec.name || '门'}`, 'info');
    }

    containsPlayer(p) {
      return this.blocksAt(p.pos.x, p.pos.y, p.pos.z, p.radius, p.height);
    }

    blocksAt(x, y, z, r, h) {
      if (this.open || Math.abs(this.leftHinge.rotation.y) > 0.55) return false;
      const half = this.w / 2 + 0.05;
      if (this.axis === 'x') {
        if (x + r < this.spec.x + 0.18 || x - r > this.spec.x + 0.82) return false;
        if (z + r < this.spec.z - half || z - r > this.spec.z + half) return false;
      } else {
        if (x + r < this.spec.x - half || x - r > this.spec.x + half) return false;
        if (z + r < this.spec.z + 0.18 || z - r > this.spec.z + 0.82) return false;
      }
      if (y + h <= this.spec.y + 1 || y >= this.spec.y + 1 + this.h) return false;
      return true;
    }
  }

  MW.Entities = { Zombie, Soldier, Pickup, Vehicle, EnemyShip, Zone, NoteMarker, Projectile, Mine, Door, Cannon, Elevator, Airdrop, Drawbridge, makeHealthBar, moveMob };
})();
