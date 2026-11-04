/* ===========================================================
   玩家：移动 / 背包 / 武器 / 生命
   =========================================================== */
(function () {
  const MW = window.MW;

  class Player {
    constructor(game) {
      this.game = game;
      this.pos = new THREE.Vector3(0, 3, 0);
      this.vel = new THREE.Vector3();
      this.yaw = 0;
      this.pitch = 0;
      this.radius = 0.34;
      this.height = 1.78;
      this.eyeHeight = 1.62;
      this.onGround = false;
      this.inWater = false;
      this.alive = true;
      this.health = 100;
      this.maxHealth = 100;
      this.armor = 0;
      this.coins = 120;
      this.kills = 0;
      this.deaths = 0;
      this.backpackLevel = 1;
      this.items = new Map();
      this.weapons = [];
      this.current = 0;
      this.ammo = { light: 60, heavy: 0, shell: 0, rocket: 0 };
      this.fireCd = 0;
      this.reloadT = 0;
      this.reloading = false;
      this.recoil = 0;
      this.viewKick = 0;
      this.bob = 0;
      this.sprinting = false;
      this.thirdPerson = false;
      this.scoped = false;
      this.lastDamage = -99;
      this.stepPhase = 0;
      this.spawnPoint = new THREE.Vector3();
      this.reviveTimer = 0;
      this.spawnProtect = 0;
      this.weaponLocked = false;

      this.buildModel();
      this.buildViewmodel();
      this.resetLoadout();
    }

    buildModel() {
      const spec = Object.assign({}, MW.CHARACTERS.player, this.game.customPlayerSkin || {});
      this.avatar = MW.Models.character(spec);
      this.avatar.group.visible = false;
      this.game.scene.add(this.avatar.group);
    }

    buildViewmodel() {
      this.vmHolder = new THREE.Group();
      this.game.camera.add(this.vmHolder);
      this.vmHolder.position.set(0.33, -0.3, -0.52);
      this.viewGroup = null;
      this.refreshViewmodel();
    }

    refreshViewmodel() {
      if (this.viewGroup) {
        this.vmHolder.remove(this.viewGroup);
        this.viewGroup = null;
      }
      const w = this.weapon;
      if (!w) return;
      const g = MW.Models.weaponView(w.id);
      const def = MW.WEAPONS[w.id];
      if (def) {
        if (w.id === 'sniper') g.scale.setScalar(0.9);
        if (w.id === 'minigun') g.scale.setScalar(0.92);
      }
      this.vmHolder.add(g);
      this.viewGroup = g;
      this.muzzle = g.userData.muzzle;
      this.flash = MW.Models.glowSprite(0xffd27a, 0.9);
      this.flash.visible = false;
      if (this.muzzle) this.muzzle.add(this.flash);
    }

    get weapon() { return this.weapons[this.current] || null; }
    get weaponDef() { const w = this.weapon; return w ? MW.WEAPONS[w.id] : null; }

    resetLoadout() {
      this.weapons = [
        { id: 'pistol', mag: 12 }
      ];
      this.current = 0;
      this.ammo = { light: 72, heavy: 0, shell: 0, rocket: 0 };
      this.items.clear();
      this.items.set('grenade', 2);
      this.items.set('mine', 1);
      this.items.set('medkit', 1);
      this.backpackLevel = 1;
      this.refreshViewmodel();
    }

    get capacity() { return MW.BACKPACKS[this.backpackLevel - 1].capacity; }

    usedSlots() {
      let n = 0;
      for (const [id, count] of this.items) {
        const def = MW.ITEMS[id];
        const stack = def ? def.stack || 1 : 1;
        n += Math.ceil(count / stack);
      }
      return n;
    }

    addItem(id, count) {
      count = count || 1;
      const def = MW.ITEMS[id];
      if (!def) return false;
      if (def.kind === 'backpack') {
        this.upgradeBackpack(def.upgrade);
        return true;
      }
      const prev = this.items.get(id) || 0;
      const maxStack = def.stack || 1;
      const prevSlots = Math.ceil(prev / maxStack);
      const newSlots = Math.ceil((prev + count) / maxStack);
      if (this.usedSlots() - prevSlots + newSlots > this.capacity) return false;
      this.items.set(id, prev + count);
      return true;
    }

    removeItem(id, count) {
      count = count || 1;
      const cur = this.items.get(id) || 0;
      if (cur < count) return false;
      if (cur === count) this.items.delete(id);
      else this.items.set(id, cur - count);
      return true;
    }

    itemCount(id) { return this.items.get(id) || 0; }

    upgradeBackpack(level) {
      if (!level || level <= this.backpackLevel) return false;
      this.backpackLevel = Math.min(3, level);
      this.game.ui.toast(`背包升级：${MW.BACKPACKS[this.backpackLevel - 1].name}（${this.capacity} 格）`, 'good');
      return true;
    }

    addWeapon(id) {
      if (!MW.WEAPONS[id]) return false;
      const existing = this.weapons.find(w => w.id === id);
      const def = MW.WEAPONS[id];
      if (existing) {
        this.ammo[def.ammo] = Math.min(9999, (this.ammo[def.ammo] || 0) + Math.floor(def.mag * 1.5));
        this.game.ui.toast(`已拥有 ${def.name}，补充弹药`, 'info');
        return true;
      }
      if (this.weapons.length >= 7) {
        this.game.ui.toast('武器栏已满（最多 7 件）', 'bad');
        return false;
      }
      this.weapons.push({ id, mag: def.mag });
      this.ammo[def.ammo] = Math.min(9999, (this.ammo[def.ammo] || 0) + def.mag * 2);
      this.switchWeapon(this.weapons.length - 1);
      return true;
    }

    switchWeapon(index) {
      if (index < 0 || index >= this.weapons.length) return;
      if (index === this.current && this.viewGroup) return;
      this.current = index;
      this.reloading = false;
      this.reloadT = 0;
      this.refreshViewmodel();
      this.game.ui.updateWeapon();
      if (this.weaponDef && this.weaponDef.kind === 'launcher' && this.game.mode !== 'combat') {
        this.game.ui.toast('导弹发射器已就绪 · 按 C 进入战斗后左键发射', 'info');
      }
      MW.SFX.click();
    }

    cycleWeapon(dir) {
      if (!this.weapons.length) return;
      let i = this.current + (dir || 1);
      i = (i + this.weapons.length) % this.weapons.length;
      this.switchWeapon(i);
    }

    startReload() {
      const w = this.weapon, def = this.weaponDef;
      if (!w || !def || this.reloading) return;
      if (w.mag >= def.mag) return;
      if ((this.ammo[def.ammo] || 0) <= 0) {
        this.game.ui.toast(`没有${this.ammoName(def.ammo)}了`, 'bad');
        MW.SFX.deny();
        return;
      }
      this.reloading = true;
      this.reloadT = def.reload;
      MW.SFX.reload();
    }

    finishReload() {
      const w = this.weapon, def = this.weaponDef;
      if (!w || !def) return;
      const need = def.mag - w.mag;
      const have = this.ammo[def.ammo] || 0;
      const take = Math.min(need, have);
      w.mag += take;
      this.ammo[def.ammo] = have - take;
      this.reloading = false;
      this.reloadT = 0;
      this.viewKick = Math.max(0, this.viewKick - 0.4);
      this.game.ui.updateWeapon();
    }

    ammoName(type) {
      return ({ light: '5.56mm 弹药', heavy: '7.62mm 弹药', shell: '12 号霰弹', rocket: '火箭弹' })[type] || '弹药';
    }

    /* ---------- 伤害 ---------- */
    damage(amount, opts) {
      if (!this.alive || this.game.godMode || this.spawnProtect > 0) return;
      if (this.armor > 0) {
        const absorb = Math.min(this.armor, amount * 0.62);
        this.armor -= absorb;
        amount -= absorb;
      }
      this.health -= amount;
      this.lastDamage = this.game.time;
      this.game.shake(0.35, 0.25);
      this.game.ui.hurtFlash();
      if (opts && opts.sourcePos) this.game.ui.showDamageFrom(opts.sourcePos);
      MW.SFX.hurt();
      if (this.health <= 0) {
        this.health = 0;
        this.die();
      }
    }

    heal(n) { this.health = Math.min(this.maxHealth, this.health + n); }

    useItem(id) {
      const def = MW.ITEMS[id];
      if (!def) return false;
      if (id === 'medkit') {
        if (this.health >= this.maxHealth) { this.game.ui.toast('生命值已满', 'info'); return false; }
        if (!this.removeItem(id, 1)) return false;
        this.heal(def.heal || 40);
        this.game.ui.toast(`使用急救包，恢复 ${def.heal || 40} 生命`, 'good');
        MW.SFX.pickup();
        return true;
      }
      if (id === 'armor') {
        if (!this.removeItem(id, 1)) return false;
        this.armor = Math.min(100, this.armor + (def.armor || 50));
        this.game.ui.toast(`获得 ${def.armor || 50} 点护甲`, 'good');
        MW.SFX.pickup();
        return true;
      }
      return false;
    }

    die() {
      if (!this.alive) return;
      this.alive = false;
      this.deaths++;
      this.deathTime = this.game.time;
      this.avatar.group.visible = false;
      this.game.ui.showDeath();
      MW.SFX.death();
      this.game.onPlayerDeath();
    }

    respawn() {
      for (const lift of this.game.elevators || []) lift.release(this);
      this.alive = true;
      this.health = this.maxHealth;
      this.armor = 0;
      this.spawnProtect = 4;
      this.pos.copy(this.spawnPoint);
      this.vel.set(0, 0, 0);
      this.yaw = this.game.world?.meta.spawnYaw || 0;
      this.pitch = 0;
      this.game.ui.hideDeath();
      this.game.respawnAtBase();
      this.game.ui.toast('你在据点重新集结', 'info');
    }

    /* ---------- 更新 ---------- */
    update(dt, keys) {
      if (!this.alive) {
        this.reviveTimer += dt;
        if (this.reviveTimer > 3.2 && !this.game.inVehicle) {
          this.reviveTimer = 0;
          this.respawn();
        }
        this.updateAvatar(dt);
        return;
      }
      const def = this.weaponDef;
      const inVehicle = !!this.game.inVehicle;
      this.avatar.group.visible = this.thirdPerson && !inVehicle;
      this.vmHolder.visible = !this.thirdPerson && !inVehicle && !this.scoped && this.game.mode === 'combat';

      this.fireCd = Math.max(0, this.fireCd - dt);
      this.spawnProtect = Math.max(0, this.spawnProtect - dt);
      if (this.reloading) {
        this.reloadT -= dt;
        if (this.reloadT <= 0) this.finishReload();
      }

      // 生命恢复
      if (this.game.time - this.lastDamage > 9 && this.health < this.maxHealth && !inVehicle) {
        this.health = Math.min(this.maxHealth, this.health + 3.5 * dt);
      }

      if (inVehicle) {
        this.pos.copy(this.game.inVehicle.pos);
        this.pos.y += this.game.inVehicle.seatHeight ?? 1.6;
        this.avatar.group.position.copy(this.game.inVehicle.pos);
        this.updateViewmodel(dt, false);
        return;
      }
      if (this.elevatorRide) {
        this.avatar.group.visible = false;
        this.vmHolder.visible = false;
        this.vel.set(0, 0, 0);
        return;
      }

      const waterLevel = this.game.world?.meta.waterLevel;
      this.inWater = waterLevel != null && this.pos.y < waterLevel + 0.15;

      const sprint = !!keys.shift && keys.w && !this.scoped;
      this.sprinting = sprint;
      let speed = (sprint ? 8.6 : 5.2);
      if (this.scoped) speed *= 0.42;
      else if (this.game.aiming) speed *= 0.62;
      if (def && def.heavy) speed *= 0.72;
      if (this.inWater) speed *= 0.55;

      let fx = 0, fz = 0;
      if (keys.w) fz -= 1;
      if (keys.s) fz += 1;
      if (keys.a) fx -= 1;
      if (keys.d) fx += 1;
      const len = Math.hypot(fx, fz);
      if (len > 0) { fx /= len; fz /= len; }
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      const wx = fx * cos + fz * sin;
      const wz = -fx * sin + fz * cos;

      const targetVX = wx * speed, targetVZ = wz * speed;
      const accel = this.onGround ? 16 : 6;
      this.vel.x = MW.lerp(this.vel.x, targetVX, Math.min(1, accel * dt));
      this.vel.z = MW.lerp(this.vel.z, targetVZ, Math.min(1, accel * dt));

      // 重力 / 游泳
      if (this.inWater) {
        this.vel.y = Math.max(this.vel.y - 9 * dt, -2.4);
        if (keys.space) this.vel.y = 3.6;
      } else {
        this.vel.y -= 22 * dt;
        if (keys.space && this.onGround) {
          this.vel.y = 8.2;
          this.onGround = false;
          MW.SFX.footstep();
        }
      }
      if (this.inWater && keys.space) this.vel.y = 4.8;

      this.moveWithCollision(dt);
      if (Math.abs(this.vel.x) + Math.abs(this.vel.z) > 1.8 && this.onGround) {
        this.bob += dt * (sprint ? 13 : 9);
        if (this.bob > Math.PI) { this.bob -= Math.PI; MW.SFX.footstep(); }
      }

      this.pos.x = MW.clamp(this.pos.x, -this.game.travelBounds, this.game.travelBounds);
      const zBounds = this.game.travelBoundsZ || this.game.travelBounds;
      this.pos.z = MW.clamp(this.pos.z, -zBounds, zBounds);
      const rescueBelow = Math.min(-18, (this.game.world?.fallbackY ?? 0) - 24);
      if (this.pos.y < rescueBelow) { this.pos.copy(this.spawnPoint); this.vel.set(0, 0, 0); }

      // 角色模型
      this.avatar.group.position.copy(this.pos);
      this.avatar.group.rotation.y = this.yaw;
      this.updateAvatar(dt);
      this.updateViewmodel(dt, len > 0 && this.onGround);
    }

    moveWithCollision(dt) {
      const w = this.game.world;
      if (!w) return;
      const r = this.radius, h = this.height;
      const solid = (x, y, z) => w.collidesBox(x, y, z, r, h, true) || this.game.collidesDoor(x, y, z, r, h);
      const stepH = this.inWater ? 1.35 : 1.05;
      // Resolve the smallest possible riser first; fractional stairs should not
      // trigger the old one-metre hop. Legacy voxel steps keep their old limit.
      const moveAxis = axis => {
        const next = this.pos[axis] + this.vel[axis] * dt;
        const clear = rise => !solid(axis === 'x' ? next : this.pos.x, this.pos.y + rise, axis === 'z' ? next : this.pos.z);
        if (clear(0)) { this.pos[axis] = next; return; }
        if (this.onGround || this.inWater) for (const rise of [.21,.41,.61,.81,stepH]) {
          if (clear(rise)) { this.pos[axis] = next; this.pos.y += rise; return; }
        }
        this.vel[axis] = 0;
      };
      const wasGrounded = this.onGround;
      moveAxis('x'); moveAxis('z');
      const oldY = this.pos.y, ny = oldY + this.vel.y * dt;
      if (solid(this.pos.x, ny, this.pos.z)) {
        // Binary search the contact height, including 20 cm treads. Rounding to
        // whole voxels here used to push feet through ceilings above stairs.
        let safe = oldY, blocked = ny;
        for (let i = 0; i < 14; i++) {
          const mid = (safe + blocked) / 2;
          if (solid(this.pos.x, mid, this.pos.z)) blocked = mid; else safe = mid;
        }
        this.pos.y = safe;
        this.onGround = this.vel.y <= 0;
        this.vel.y = 0;
      } else {
        this.pos.y = ny; this.onGround = false;
        if (this.vel.y <= .01 && solid(this.pos.x, this.pos.y - .035, this.pos.z)) {this.onGround = true; this.vel.y = 0;}
      }
      if (wasGrounded && this.vel.y <= 0 && w.precision) {
        const support = w.precision.supportAt(this.pos.x, this.pos.z, this.pos.y + .025, r);
        if (support > this.pos.y - .26 && support <= this.pos.y + .025 && !solid(this.pos.x, support + .004, this.pos.z)) {
          this.pos.y = support + .004; this.vel.y = 0; this.onGround = true;
        }
      }
      if (this.inWater) this.onGround = false;
      const fy = w.terrain ? w.terrainGroundAt(this.pos.x,this.pos.z) : w.fallbackY;
      if (this.pos.y < fy) {
        this.pos.y = fy;
        this.vel.y = 0;
        this.onGround = true;
      }
    }

    updateAvatar(dt) {
      if (!this.avatar) return;
      const speed = Math.hypot(this.vel.x, this.vel.z);
      this.stepPhase += dt * (2 + speed * 1.7);
      const amp = MW.clamp(speed / 6, 0, 1) * 0.6;
      this.avatar.legL.rotation.x = Math.sin(this.stepPhase) * amp;
      this.avatar.legR.rotation.x = -Math.sin(this.stepPhase) * amp;
      this.avatar.armL.rotation.x = -Math.sin(this.stepPhase) * amp * 0.7;
      this.avatar.armR.rotation.x = Math.sin(this.stepPhase) * amp * 0.7;
      this.avatar.group.position.y = this.pos.y + (this.alive ? 0 : -0.6);
      if (!this.alive) {
        this.avatar.group.rotation.z = MW.lerp(this.avatar.group.rotation.z, Math.PI / 2, dt * 4);
      } else {
        this.avatar.group.rotation.z = MW.lerp(this.avatar.group.rotation.z, 0, dt * 6);
      }
    }

    updateViewmodel(dt, walking) {
      if (!this.viewGroup || !this.vmHolder.visible) return;
      this.viewKick = Math.max(0, this.viewKick - dt * 7);
      this.recoil = MW.lerp(this.recoil, this.viewKick, Math.min(1, dt * 18));
      const bobX = Math.sin(this.bob) * (walking ? 0.012 : 0);
      const bobY = Math.abs(Math.cos(this.bob)) * (walking ? 0.012 : 0);
      let reloadDrop = 0, reloadRot = 0;
      if (this.reloading && this.weaponDef) {
        const t = 1 - this.reloadT / this.weaponDef.reload;
        const curve = Math.sin(Math.PI * MW.clamp(t, 0, 1));
        reloadDrop = curve * 0.22;
        reloadRot = curve * 0.7;
      }
      this.vmHolder.position.set(0.33 + bobX, -0.3 + bobY - reloadDrop, -0.52 + this.recoil * 0.09);
      this.vmHolder.rotation.set(this.recoil * 0.16 + reloadRot, 0.02, -reloadRot * 0.35);
      if (this.flash) {
        this.flash.visible = this.recoil > 0.55;
        const s = 0.6 + Math.random() * 0.5;
        this.flash.scale.set(s, s, 1);
      }
    }

    get eyePos() {
      return new THREE.Vector3(this.pos.x, this.pos.y + this.eyeHeight, this.pos.z);
    }

    get forward() {
      return new THREE.Vector3(
        -Math.sin(this.yaw) * Math.cos(this.pitch),
        Math.sin(this.pitch),
        -Math.cos(this.yaw) * Math.cos(this.pitch)
      );
    }

    /* 供 HUD 显示 */
    get weaponAmmoText() {
      const w = this.weapon, def = this.weaponDef;
      if (!w || !def) return '—';
      return `${w.mag} / ${this.ammo[def.ammo] || 0}`;
    }

    addAmmo(type, amount) {
      this.ammo[type] = Math.min(9999, (this.ammo[type] || 0) + amount);
    }
  }

  MW.Player = Player;
})();
