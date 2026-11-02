/* ===========================================================
   战斗：命中判定 / 投掷物 / 爆炸 / 粒子效果
   =========================================================== */
(function () {
  const MW = window.MW;
  const V = new THREE.Vector3();

  class Combat {
    constructor(game) {
      this.game = game;
      this.tracers = [];
      this.particles = [];
      this.explosions = [];
      this.pool = [];
      this.explosionLight = new THREE.PointLight(0xffa347, 0, 26, 2);
      game.scene.add(this.explosionLight);
      this.lightT = 0;
    }

    /* ---------- 玩家开火 ---------- */
    fireWeapon() {
      const p = this.game.player;
      const w = p.weapon, def = p.weaponDef;
      if (!w || !def) return;
      if (p.fireCd > 0 || p.reloading || !p.alive || this.game.mode !== 'combat') return;
      if (this.game.inVehicle) { this.game.inVehicle.fire(); return; }
      if (w.mag <= 0) {
        MW.SFX.deny();
        p.startReload();
        return;
      }
      p.fireCd = 60 / def.rpm;
      w.mag--;
      p.viewKick = Math.min(1.2, p.viewKick + (def.heavy ? 0.34 : def.kind === 'launcher' ? 0.8 : 0.5));
      p.pitch += 0.004 + Math.random() * 0.004;
      p.yaw += (Math.random() - 0.5) * 0.006;

      const origin = p.eyePos;
      const baseDir = p.forward;
      const spread = def.spread * (p.scoped ? 0.25 : 1) * (p.game.aiming ? 0.6 : 1);

      if (def.kind === 'launcher') {
        const dir = baseDir.clone();
        dir.x += (Math.random() - 0.5) * spread * 6;
        dir.y += (Math.random() - 0.5) * spread * 6;
        dir.normalize();
        const start = origin.clone().addScaledVector(dir, 0.9);
        start.y -= 0.12;
        let homing = null;
        if (def.homing) {
          let bestDot = 0.3, bestDist = 280;
          for (const s of this.game.ships) {
            if (s.dead) continue;
            const to = s.pos.clone().add(new THREE.Vector3(0, 3, 0)).sub(origin);
            const dist = to.length();
            const dot = to.normalize().dot(dir);
            if (dot > bestDot && dist < bestDist) { bestDot = dot; bestDist = dist; homing = s; }
          }
          if (!homing) {
            for (const z of this.game.zombies) {
              if (z.dead) continue;
              const to = z.pos.clone().add(new THREE.Vector3(0, z.height * 0.5, 0)).sub(origin);
              const dist = to.length();
              const dot = to.normalize().dot(dir);
              if (dot > bestDot && dist < bestDist) { bestDot = dot; bestDist = dist; homing = z; }
            }
          }
        }
        const proj = new MW.Entities.Projectile(this.game, start, dir.clone().multiplyScalar(52), {
          type: def.projectile === 'missile' ? 'missile' : 'rocket',
          fuse: 6, radius: def.radius || 7, damage: def.dmg, source: 'player', homing
        });
        this.game.projectiles.push(proj);
        if (homing) this.game.ui.toast('导弹已锁定目标', 'info');
      } else {
        const pellets = def.pellets || 1;
        for (let i = 0; i < pellets; i++) {
          const dir = baseDir.clone();
          if (spread > 0) {
            dir.x += (Math.random() - 0.5) * spread * 2;
            dir.y += (Math.random() - 0.5) * spread * 2;
            dir.z += (Math.random() - 0.5) * spread * 2;
            dir.normalize();
          }
          const color = def.glow ? 0x64f0ff : 0xffd27a;
          this.hitscan(origin, dir, def.dmg, def.range, {
            tracer: color, fromPlayer: true, laser: !!def.glow, shotgun: pellets > 1
          });
        }
      }
      MW.SFX.shoot(w.id);
      this.game.ui.updateWeapon();
      this.muzzleSmoke(origin, baseDir);
      if (w.mag <= 0) setTimeout(() => { if (p.weapon === w) p.startReload(); }, 180);
    }

    /* ---------- 命中扫描 ---------- */
    hitscan(origin, dir, damage, range, opts) {
      opts = opts || {};
      const world = this.game.world;
      const wallHit = world.raycast(origin, dir, range);
      let maxDist = wallHit ? wallHit.dist : range;
      let best = null, bestT = maxDist, headshot = false;

      for (const z of this.game.zombies) {
        if (z.dead) continue;
        const cx = z.pos.x, cy = z.pos.y + z.height * 0.52, cz = z.pos.z;
        V.set(cx - origin.x, cy - origin.y, cz - origin.z);
        const t = V.dot(dir);
        if (t < 0 || t > maxDist) continue;
        const px = origin.x + dir.x * t, py = origin.y + dir.y * t, pz = origin.z + dir.z * t;
        const d2 = (px - cx) ** 2 + (py - cy) ** 2 + (pz - cz) ** 2;
        const rad = (z.elite ? 0.95 : 0.78);
        if (d2 < rad * rad && t < bestT) {
          best = { type: 'zombie', entity: z, t };
          bestT = t;
          headshot = false;
          // 头部判定
          const hy = z.pos.y + z.height * 0.88;
          V.set(cx - origin.x, hy - origin.y, cz - origin.z);
          const th = V.dot(dir);
          if (th > 0 && th < maxDist) {
            const hx = origin.x + dir.x * th, hz = origin.z + dir.z * th;
            const hd2 = (hx - cx) ** 2 + (origin.y + dir.y * th - hy) ** 2 + (hz - cz) ** 2;
            if (hd2 < 0.24 * 0.24) { headshot = true; bestT = th; best.t = th; }
          }
        }
      }

      for (const s of this.game.ships || []) {
        if (s.dead) continue;
        const cx = s.pos.x, cy = s.pos.y + 3, cz = s.pos.z;
        V.set(cx - origin.x, cy - origin.y, cz - origin.z);
        const t = V.dot(dir);
        if (t < 0 || t > maxDist) continue;
        const px = origin.x + dir.x * t, py = origin.y + dir.y * t, pz = origin.z + dir.z * t;
        const d2 = (px - cx) ** 2 + (py - cy) ** 2 + (pz - cz) ** 2;
        if (d2 < 49 && t < bestT) {
          best = { type: 'ship', entity: s, t };
          bestT = t;
          headshot = false;
        }
      }

      const hitPoint = origin.clone().addScaledVector(dir, Math.min(bestT, maxDist));
      if (best) {
        const dmg = headshot ? damage * 2.2 : damage;
        if (best.type === 'zombie') {
          best.entity.hit(dmg, dir, { knockback: opts.shotgun ? 0.35 : 0.2 });
          this.game.ui.hitMarker(headshot ? 'head' : 'hit');
          if (headshot) MW.SFX.headshot();
        } else if (best.type === 'ship') {
          best.entity.damage(dmg * 0.8);
          this.game.ui.hitMarker('hit');
          this.spark(hitPoint, 0xffd27a, 5);
        }
      } else if (wallHit) {
        this.spark(hitPoint, 0xffc98a, 3);
      }

      const start = origin.clone().addScaledVector(dir, 1.2);
      start.y -= 0.16;
      this.tracer(start, hitPoint, opts.tracer || 0xffd27a, opts.laser ? 0.16 : 0.05, opts.laser);
      return { hit: best, point: hitPoint, headshot };
    }

    /* ---------- 投掷物 ---------- */
    throwGrenade() {
      const p = this.game.player;
      if (this.game.mode !== 'combat' || !p.alive) return;
      if (!p.removeItem('grenade', 1)) {
        this.game.ui.toast('没有手雷了', 'bad');
        MW.SFX.deny();
        return;
      }
      const dir = p.forward.clone();
      const start = p.eyePos.clone().addScaledVector(dir, 0.6);
      const vel = dir.clone().multiplyScalar(19);
      vel.y += 5;
      const proj = new MW.Entities.Projectile(this.game, start, vel, {
        type: 'grenade', fuse: 2.4, radius: 7.5, damage: 145, source: 'player'
      });
      this.game.projectiles.push(proj);
      MW.SFX.click();
      this.game.ui.updateInventory();
      this.game.ui.toast('手雷已投出', 'info');
    }

    placeMine() {
      const p = this.game.player;
      if (this.game.mode !== 'combat' || !p.alive) return;
      if (!p.removeItem('mine', 1)) {
        this.game.ui.toast('没有地雷了', 'bad');
        MW.SFX.deny();
        return;
      }
      const pos = p.pos.clone();
      pos.x += -Math.sin(p.yaw) * 1.8;
      pos.z += -Math.cos(p.yaw) * 1.8;
      pos.y = this.game.world.surfaceAt(pos.x, pos.z);
      const mine = new MW.Entities.Mine(this.game, pos);
      this.game.mines.push(mine);
      MW.SFX.click();
      this.game.ui.updateInventory();
      this.game.ui.toast('地雷已布设', 'info');
    }

    launchShell(pos, dir, speed, radius, damage, source) {
      const proj = new MW.Entities.Projectile(this.game, pos, dir.clone().multiplyScalar(speed), {
        type: 'shell', fuse: 8, radius, damage, source, gravity: 3.2
      });
      this.game.projectiles.push(proj);
      return proj;
    }

    /* ---------- 爆炸 ---------- */
    explode(pos, radius, damage, opts) {
      opts = opts || {};
      const source = opts.source || 'player';
      const visual = MW.Models.explosion(0xffb347, radius);
      visual.position.copy(pos);
      visual.scale.setScalar(0.4);
      this.game.scene.add(visual);
      this.explosions.push({ obj: visual, life: 0.65, max: 0.65, radius });
      this.explosionLight.position.copy(pos);
      this.explosionLight.intensity = 8;
      this.lightT = 0.25;

      MW.SFX.explosion(radius / 6);
      const distPlayer = this.game.player.pos.distanceTo(pos);

      for (const z of this.game.zombies) {
        if (z.dead) continue;
        const d = z.pos.distanceTo(pos);
        if (d < radius) {
          const falloff = 1 - (d / radius) * 0.72;
          z.hit(damage * falloff, new THREE.Vector3(z.pos.x - pos.x, 0, z.pos.z - pos.z).normalize(), { knockback: 0.7 });
        }
      }
      for (const s of this.game.soldiers) {
        if (s.dead) continue;
        const d = s.pos.distanceTo(pos);
        if (d < radius && source !== 'player') s.damage(damage * (1 - d / radius) * 0.5);
      }
      const p = this.game.player;
      if (p.alive && distPlayer < radius) {
        let f = 1 - (distPlayer / radius) * 0.7;
        if (source === 'player') f *= 0.28;
        if (source === 'enemy' || source === 'ship') f *= 0.6;
        p.damage(damage * f * 0.55, { sourcePos: pos });
      }
      for (const v of this.game.vehicles) {
        if (v.dead) continue;
        const d = v.pos.distanceTo(pos);
        if (d < radius * 1.3) v.damage(damage * 0.6 * (1 - d / (radius * 1.4)));
      }
      for (const s of this.game.ships || []) {
        if (s.dead) continue;
        const d = s.pos.distanceTo(pos);
        if (d < radius * 1.6) s.damage(damage * 1.3 * (1 - d / (radius * 1.8)));
      }
      this.spark(pos, 0xffc46b, Math.floor(radius * 3));
      this.spark(pos, 0x6b6b6b, Math.floor(radius * 2));
      for (let i = 0; i < radius * 2; i++) {
        this.smoke(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * radius, Math.random() * 2, (Math.random() - 0.5) * radius)), 0x8a8a8a, 1);
      }
      this.game.shake(MW.clamp(0.9 - distPlayer / 90, 0.08, 0.9), 0.45);
    }

    /* ---------- 特效 ---------- */
    tracer(from, to, color, life, laser) {
      const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
      const mat = new THREE.LineBasicMaterial({
        color, transparent: true, opacity: laser ? 0.95 : 0.7,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      const line = new THREE.Line(geo, mat);
      this.game.scene.add(line);
      this.tracers.push({ line, life: life || 0.06, max: life || 0.06, laser });
    }

    blood(pos, dir) {
      for (let i = 0; i < 6; i++) {
        const v = new THREE.Vector3(
          (Math.random() - 0.5) * 2.2,
          Math.random() * 2.2,
          (Math.random() - 0.5) * 2.2
        );
        if (dir) v.addScaledVector(dir, 0.8);
        this.spawnParticle(pos, v, 0x8a2b23, 0.5, 0.08, 15);
      }
    }

    spark(pos, color, count) {
      for (let i = 0; i < count; i++) {
        const v = new THREE.Vector3(
          (Math.random() - 0.5) * 7,
          Math.random() * 6,
          (Math.random() - 0.5) * 7
        );
        this.spawnParticle(pos, v, color, 0.45, 0.07, 16);
      }
    }

    smoke(pos, color, count) {
      for (let i = 0; i < count; i++) {
        const v = new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          0.8 + Math.random() * 2,
          (Math.random() - 0.5) * 2
        );
        this.spawnParticle(pos, v, color, 0.8, 0.16, -2);
      }
    }

    muzzleSmoke(origin, dir) {
      const pos = origin.clone().addScaledVector(dir, 0.7);
      this.spawnParticle(pos, new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.4, (Math.random() - 0.5) * 0.4), 0xffd9a0, 0.18, 0.05, 6);
    }

    spawnParticle(pos, vel, color, life, size, gravity) {
      if (this.particles.length > 220) {
        const old = this.particles.shift();
        this.game.scene.remove(old.mesh);
      }
      const mesh = new THREE.Mesh(MW.BOX_GEO, MW.Models.glowMat(color));
      mesh.scale.setScalar(size);
      mesh.position.copy(pos);
      this.game.scene.add(mesh);
      this.particles.push({ mesh, vel: vel.clone(), life, max: life, gravity: gravity == null ? 12 : gravity, size });
    }

    update(dt) {
      for (let i = this.tracers.length - 1; i >= 0; i--) {
        const t = this.tracers[i];
        t.life -= dt;
        t.line.material.opacity = Math.max(0, (t.life / t.max)) * (t.laser ? 0.95 : 0.7);
        if (t.life <= 0) {
          this.game.scene.remove(t.line);
          t.line.geometry.dispose();
          t.line.material.dispose();
          this.tracers.splice(i, 1);
        }
      }
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          this.game.scene.remove(p.mesh);
          this.particles.splice(i, 1);
          continue;
        }
        p.vel.y -= p.gravity * dt;
        p.mesh.position.addScaledVector(p.vel, dt);
        if (p.mesh.position.y < 0.05) { p.mesh.position.y = 0.05; p.vel.multiplyScalar(0.4); p.vel.y = 0; }
        const s = p.size * (0.3 + 0.7 * (p.life / p.max));
        p.mesh.scale.setScalar(s);
        p.mesh.rotation.x += dt * 4;
        p.mesh.rotation.y += dt * 3;
      }
      for (let i = this.explosions.length - 1; i >= 0; i--) {
        const e = this.explosions[i];
        e.life -= dt;
        const t = 1 - e.life / e.max;
        const s = 0.4 + MW.easeOut(t) * e.radius * 1.1;
        e.obj.scale.setScalar(s);
        e.obj.userData.core.material.opacity = Math.max(0, 0.95 * (1 - t));
        e.obj.userData.halo.material.opacity = Math.max(0, 0.9 * (1 - t));
        e.obj.userData.core.scale.setScalar(0.5 + t * 0.8);
        if (e.life <= 0) {
          this.game.scene.remove(e.obj);
          this.explosions.splice(i, 1);
        }
      }
      if (this.lightT > 0) {
        this.lightT -= dt;
        this.explosionLight.intensity = Math.max(0, this.explosionLight.intensity - dt * 35);
      }
    }
  }

  MW.Combat = Combat;
})();
