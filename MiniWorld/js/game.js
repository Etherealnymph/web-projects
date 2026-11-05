/* ===========================================================
   游戏主控
   =========================================================== */
(function () {
  const MW = window.MW;
  const V3 = THREE.Vector3;

  const BUILD_COLORS = [
    { name: '石砖', c: 0x9a958a },
    { name: '红墙', c: 0x9d2f26 },
    { name: '金瓦', c: 0xd8a531 },
    { name: '木纹', c: 0x8a6b45 },
    { name: '玻璃', c: 0x5fa7c4 },
    { name: '草地', c: 0x77a83e },
    { name: '大理石', c: 0xcfc7ae },
    { name: '深色石', c: 0x2b2f38 },
    { name: '发光灯', c: 0xffb347, glow: true },
    { name: '水', c: 0x2f7fa8, water: true }
  ];

  const LOAD_QUOTES = [
    '“先搭一座桥，再考虑要不要过河。”',
    '“世界不是被发现的，是被一块一块放上去的。”',
    '“在像素里，黄昏可以永远不结束。”',
    '“所有伟大的城市，都从一块石头开始。”',
    '“别忘了在离开的地方留一张便签。”'
  ];

  class Game {
    constructor() {
      this.$ = id => document.getElementById(id);
      this.settings = Object.assign({}, MW.DEFAULT_SETTINGS, MW.store.get('settings', {}));
      this.customWeapons = MW.store.get('customWeapons', []);
      if (Array.isArray(this.customWeapons)) {
        for (const w of this.customWeapons) {
          if (w && w.id && w.view) MW.WEAPONS[w.id] = w;
        }
      }
      this.customPlayerSkin = MW.store.get('playerSkin', null);
      this.skillPrompt = '';

      this.state = 'menu';
      this.mode = 'explore';
      this.weather = 'clear';
      this.season = 'autumn';
      this.time = 0;
      this.bounds = 70;
      this.travelBounds = 600;
      this.travelBoundsZ = 600;
      this.killTarget = 12;
      this.panelOpen = null;
      this.firing = false;
      this.aiming = false;
      this.pointerLocked = false;
      this.inVehicle = null;
      this.buildTarget = null;
      this.buildColorIndex = 0;
      this.buildBrush = 1;
      this.buildAction = 'place';
      const finePrefs = MW.store.get('fineBuildPrefs', {}) || {};
      this.buildGrid = [0.25, 0.5, 1].includes(finePrefs.grid) ? finePrefs.grid : 0.25;
      this.buildPrefab = 'cell';
      this.buildRotation = 0;
      this.buildSerial = 0;
      this.interactTarget = null;
      this.victoryShown = false;
      this.shipTotal = 0;
      this.shipsDestroyed = 0;
      this.saveT = 20;
      this.combatTimer = 0;
      this.uiT = 0;
      this.minimapT = 0;
      this.labels = [];
      this.fpsSmooth = 60;
      this.fpsT = 0;
      this.lastWorldId = MW.store.get('lastWorld', null);
      this.keys = {};

      this.zombies = [];
      this.soldiers = [];
      this.pickups = [];
      this.vehicles = [];
      this.ships = [];
      this.zones = [];
      this.notes = [];
      this.doors = [];
      this.cannons = [];
      this.elevators = [];
      this.airdrops = [];
      this.bridges = [];
      this.projectiles = [];
      this.mines = [];

      this.initRenderer();
      this.initScene();
      this.ui = new MW.UI(this);
      this.ui.init();
      MW.SFX.configure(this.settings);
      this.bindEvents();
      this.loadSkillFile();
      this.ui.setAPIStatus(!!this.settings.apiKey);
      this.clock = new THREE.Clock();
      this.animate();
    }

    /* =======================================================
       初始化
       ======================================================= */
    initRenderer() {
      const canvas = this.$('game-canvas');
      this.canvas = canvas;
      try {
        this.renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: true,
          powerPreference: 'high-performance',
          alpha: false
        });
      } catch (e) {
        this.ui && this.ui.showFatal && this.ui.showFatal();
        throw e;
      }
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.outputEncoding = THREE.sRGBEncoding;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.06;
      this.renderer.setClearColor(0x0a0f16, 1);
      this.applyGraphics();
    }

    applyGraphics() {
      const caps = { low: 1, balanced: 1.35, high: 2, auto: 1.5 };
      this.pixelCap = caps[this.settings.graphics] || 1.5;
      this.pixelRatio = Math.min(window.devicePixelRatio || 1, this.pixelCap);
      this.renderer.setPixelRatio(this.pixelRatio);
      this.qualityTimer = 0;
      document.body.classList.toggle('reduce-motion', !!this.settings.reducedMotion);
      this.world?.setQuality(this.settings.graphics);
    }

    groundAt(x, z) {
      return Math.max(this.world.surfaceAt(x, z), this.advanced?.groundAt(x, z) ?? -Infinity);
    }

    travelTo(destination) {
      if (!this.player || !this.world || !destination) return;
      const x = Number(destination.x), z = Number(destination.z);
      if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x)>this.travelBounds || Math.abs(z)>(this.travelBoundsZ || this.travelBounds)) return;
      if (this.inVehicle) { this.inVehicle.exit(); if (this.inVehicle) return; }
      for (const lift of this.elevators || []) lift.release(this.player);
      this.player.pos.set(x, this.groundAt(x,z) + 0.08, z);
      this.player.vel.set(0,0,0); this.player.spawnProtect = 6;
      this.camera.position.copy(this.player.eyePos);
      this.world.prepareAt(x,z);
      this.closeAllPanels(); this.saveLater();
      this.ui.toast(`已抵达 ${destination.name || '目的地'}`, 'good');
    }

    initScene() {
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.06, 1200);
      this.camera.rotation.order = 'YXZ';
      this.scene.add(this.camera);

      this.fog = new THREE.FogExp2(0xbdd6e2, 0.0028);
      this.scene.fog = this.fog;

      this.skyUniforms = {
        topColor: { value: new THREE.Color(0x2f6fa8) },
        bottomColor: { value: new THREE.Color(0xbfe0ef) },
        horizonColor: { value: new THREE.Color(0xdff0f6) },
        sunColor: { value: new THREE.Color(0xfff2cc) },
        sunDir: { value: new THREE.Vector3(0.5, 0.7, -0.4).normalize() },
        sunPower: { value: 1.0 }
      };
      const skyGeo = new THREE.SphereGeometry(620, 32, 20);
      const skyMat = new THREE.ShaderMaterial({
        uniforms: this.skyUniforms,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        vertexShader: `
          varying vec3 vWorld;
          void main() {
            // Direction comes from local sphere coordinates, independent of
            // a continent-sized camera translation.
            vWorld = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          uniform vec3 topColor;
          uniform vec3 bottomColor;
          uniform vec3 horizonColor;
          uniform vec3 sunColor;
          uniform vec3 sunDir;
          uniform float sunPower;
          varying vec3 vWorld;
          void main() {
            vec3 dir = normalize(vWorld);
            float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
            vec3 upper = mix(bottomColor, topColor, smoothstep(0.5, 1.0, h));
            vec3 col = mix(horizonColor, upper, smoothstep(0.0, 0.62, h));
            float sd = max(dot(dir, normalize(sunDir)), 0.0);
            float disc = pow(sd, 340.0);
            float glow = pow(sd, 9.0) * 0.28;
            col += sunColor * (disc * 1.5 + glow) * sunPower;
            gl_FragColor = vec4(col, 1.0);
          }`
      });
      this.sky = new THREE.Mesh(skyGeo, skyMat);
      this.sky.frustumCulled = false;
      this.sky.renderOrder = -1000;
      this.sky.onBeforeRender = (_renderer, _scene, camera) => {
        this.sky.position.copy(camera.position);
        this.sky.updateMatrixWorld();
      };
      this.scene.add(this.sky);

      // 星空
      const starCount = 900;
      const sGeo = new THREE.BufferGeometry();
      const sPos = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 0.92);
        const r = 560;
        sPos[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
        sPos[i * 3 + 1] = Math.cos(phi) * r;
        sPos[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
      }
      sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
      this.stars = new THREE.Points(sGeo, new THREE.PointsMaterial({
        color: 0xdcecff, size: 2.4, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false
      }));
      this.stars.frustumCulled = false;
      this.stars.onBeforeRender = (_renderer, _scene, camera) => {
        const distance = camera.far * 0.9;
        this.stars.position.copy(camera.position);
        this.stars.scale.setScalar(distance / 560);
        this.stars.material.size = 2.4 * distance / 560;
        this.stars.updateMatrixWorld();
      };
      this.scene.add(this.stars);

      // 太阳 / 月亮光晕
      this.sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: MW.getRadialTexture(), color: 0xffe9b0, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9
      }));
      this.sunSprite.scale.set(55, 55, 1);
      this.sunSprite.frustumCulled = false;
      this.sunSprite.onBeforeRender = (_renderer, _scene, camera) => {
        const distance = camera.far * 0.88;
        this.sunSprite.position.copy(this.skyUniforms.sunDir.value).multiplyScalar(distance).add(camera.position);
        this.sunSprite.scale.set(55 * distance / 520, 55 * distance / 520, 1);
        this.sunSprite.updateMatrixWorld();
      };
      this.scene.add(this.sunSprite);

      // 灯光
      this.hemi = new THREE.HemisphereLight(0xcfe6f5, 0x4a4a3a, 0.8);
      this.scene.add(this.hemi);
      this.sun = new THREE.DirectionalLight(0xfff0c8, 1.0);
      this.scene.add(this.sun);
      this.fillLight = new THREE.DirectionalLight(0x88aaff, 0.18);
      this.fillLight.position.set(-60, 40, 60);
      this.scene.add(this.fillLight);
      this.ambient = new THREE.AmbientLight(0xffffff, 0.18);
      this.scene.add(this.ambient);

      this.initWeatherParticles();
      this.envTarget = null;
      this.envCurrent = {
        top: new THREE.Color(0x2f6fa8), bottom: new THREE.Color(0xbfe0ef),
        horizon: new THREE.Color(0xdff0f6), sun: new THREE.Color(0xfff2cc)
      };
      this.setSkyPreset('day', true);
    }

    initWeatherParticles() {
      const count = 1400;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 80;
        pos[i * 3 + 1] = Math.random() * 40;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 80;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.weatherMat = new THREE.PointsMaterial({
        color: 0xbcd9ef, size: 0.09, transparent: true, opacity: 0.6,
        depthWrite: false, sizeAttenuation: true
      });
      this.weatherPoints = new THREE.Points(geo, this.weatherMat);
      this.weatherPoints.frustumCulled = false;
      this.weatherPoints.visible = false;
      this.scene.add(this.weatherPoints);
      this.weatherCount = count;
    }

    loadSkillFile() {
      fetch('skills/world-build.md')
        .then(r => r.ok ? r.text() : null)
        .then(t => { if (t) this.skillPrompt = t; })
        .catch(() => {});
    }

    /* =======================================================
       主循环
       ======================================================= */
    animate() {
      if (!this._frame) this._frame = () => this.animate();
      requestAnimationFrame(this._frame);
      const raw = this.clock.getDelta();
      if (document.hidden || this.contextLost) return;
      const dt = Math.min(raw, 0.05);
      if (this.state === 'playing') {
        this.update(dt);
      } else {
        this.updateMenuCamera(dt);
      }
      this.renderer.render(this.scene, this.camera);
      MW.SFX.update(this);
      this.fpsSmooth = MW.lerp(this.fpsSmooth, 1 / Math.max(raw, 0.0001), 0.05);
      this.fpsT += raw;
      if (this.fpsT > 0.6) {
        this.fpsT = 0;
        const info = this.renderer.info.render;
        const chunks = this.world?.terrain?.chunks?.size;
        const details = this.settings.performanceHUD ? ` · ${info.calls} calls · ${Math.round(info.triangles / 1000)}k △${chunks == null ? '' : ' · ' + chunks + ' chunks'}` : '';
        this.ui.setFps(Math.round(this.fpsSmooth), details);
      }
      this.qualityTimer += dt;
      if (this.settings.graphics === 'auto' && this.state === 'playing' && !this.panelOpen && this.qualityTimer > 4) {
        this.qualityTimer = 0;
        const next = MW.clamp(this.pixelRatio + (this.fpsSmooth < 38 ? -0.12 : this.fpsSmooth > 58 ? 0.06 : 0), 0.7, Math.min(this.pixelCap, window.devicePixelRatio || 1));
        if (Math.abs(next-this.pixelRatio) > 0.01) { this.pixelRatio=next; this.renderer.setPixelRatio(next); }
      }
    }

    updateMenuCamera(dt) {
      if (!this.menuCamT) this.menuCamT = 0;
      this.menuCamT += dt;
      this.camera.position.set(Math.sin(this.menuCamT * 0.05) * 8, 6, 16);
      this.camera.lookAt(0, 0, 0);
    }

    update(dt) {
      this.time += dt;
      const paused = !!this.panelOpen || this.paused;
      this.updateEnvironment(dt);
      this.world.update(dt, this.camera.position);
      this.combat.update(dt);
      this.architect.update(dt);

      if (this.intro) {
        this.updateIntro(dt);
        this.updateLabels();
        this.ui.tick(dt, this);
        return;
      }

      if (!paused) {
        if (this.inVehicle) this.inVehicle.update(dt);
        this.player.update(dt, this.keys);
        if (!this.inVehicle) {
          for (const v of this.vehicles) if (v.type === 'artillery') v.pushByPlayer(this.player, dt);
        }
        for (const v of this.vehicles) if (v !== this.inVehicle) v.update(dt);
        for (let i=this.zombies.length-1;i>=0;i--) this.zombies[i].update(dt);
        for (let i=this.soldiers.length-1;i>=0;i--) this.soldiers[i].update(dt);
        for (const p of this.pickups) p.update(dt);
        for (const n of this.notes) n.update(dt);
        for (const d of this.doors) d.update(dt);
        for (const c of this.cannons) c.update(dt);
        for (const e of this.elevators) e.update(dt);
        for (const zo of this.zones) zo.update(dt);
        for (let i=this.projectiles.length-1;i>=0;i--) this.projectiles[i].update(dt);
        for (let i=this.mines.length-1;i>=0;i--) this.mines[i].update(dt);
        for (let i=this.ships.length-1;i>=0;i--) this.ships[i].update(dt);
        this.advanced?.update(dt);
        this.journal?.update(dt);
        this.updateAirdrops(dt);
        for (const b of this.bridges) b.update(dt);

        this.updateCombatSpawn(dt);
        this.updateBuild(dt);
        this.updateInteraction();
        this.updateDanger();
        if (this.player.inWater && !this._wasWater) {
          this.ui.toast('落水了 · 按住 Space 上浮 · 按 R 返回最近岸边', 'info');
        }
        this._wasWater = this.player.inWater;
        this.updateLabels();
        this.updateAutoFire(dt);
        this.updateSave(dt);
      }
      this.updateCamera(dt);
      this.ui.updateVehicleHUD(this.inVehicle);
      this.ui.tick(dt, this);
    }

    /* =======================================================
       环境 / 天气 / 季节
       ======================================================= */
    setSkyPreset(name, instant) {
      this.skyPreset = name;
      const preset = MW.SKY_PRESETS[name] || MW.SKY_PRESETS.day;
      const angle = THREE.MathUtils.degToRad(preset.sunAngle);
      let dir;
      if (preset.sunAngle < 0) {
        dir = new THREE.Vector3(0.45, 0.62, 0.5).normalize();
      } else {
        dir = new THREE.Vector3(Math.cos(angle) * 0.82, Math.sin(angle), -0.38).normalize();
      }
      this.sunDirection = dir;
      this.basePreset = preset;
      this.computeEnvTarget();
      if (instant) this.applyEnvInstant();
    }

    computeEnvTarget() {
      const p = this.basePreset || MW.SKY_PRESETS.day;
      let top = new THREE.Color(p.top);
      let bottom = new THREE.Color(p.bottom);
      let horizon = new THREE.Color(p.horizon);
      let sun = new THREE.Color(p.sun);
      let density = 0.0028;
      let sunI = p.sunI;
      let hemiI = p.hemiI;
      let ambient = 0.14;
      let star = p.night;

      switch (this.weather) {
        case 'rain':
          top.lerp(new THREE.Color(0x4a5b68), 0.55);
          bottom.lerp(new THREE.Color(0x8a9aa3), 0.6);
          horizon.lerp(new THREE.Color(0x9aa8ae), 0.55);
          sunI *= 0.45; hemiI *= 0.7; density = 0.0065; ambient = 0.24;
          break;
        case 'snow':
          top.lerp(new THREE.Color(0x718695), 0.45);
          bottom.lerp(new THREE.Color(0xd8e4ea), 0.65);
          horizon.lerp(new THREE.Color(0xe3edf2), 0.6);
          sunI *= 0.6; hemiI *= 0.9; density = 0.0082; ambient = 0.32;
          break;
        case 'fog':
          top.lerp(new THREE.Color(0x9aa5a8), 0.55);
          bottom.lerp(new THREE.Color(0xc2cbcd), 0.7);
          horizon.lerp(new THREE.Color(0xcdd5d6), 0.75);
          sunI *= 0.4; hemiI *= 0.85; density = 0.022; ambient = 0.36;
          break;
        case 'storm':
          top.lerp(new THREE.Color(0x202c38), 0.7);
          bottom.lerp(new THREE.Color(0x53646e), 0.7);
          horizon.lerp(new THREE.Color(0x6a7a84), 0.65);
          sunI *= 0.3; hemiI *= 0.55; density = 0.011; ambient = 0.2;
          break;
      }
      const seasonTint = { spring: 0x2a3a2a, summer: 0x24352a, autumn: 0x3a2c1e, winter: 0x2c3742 }[this.season];
      if (seasonTint != null) bottom.lerp(new THREE.Color(seasonTint), 0.05);

      this.envTarget = { top, bottom, horizon, sun, density, sunI, hemiI, ambient, star };
      this.sunSprite.material.color.copy(sun);
      this.sunSprite.position.copy(this.sunDirection).multiplyScalar(520);
      this.sun.position.copy(this.sunDirection).multiplyScalar(140);
    }

    applyEnvInstant() {
      const t = this.envTarget;
      if (!t) return;
      this.envCurrent.top.copy(t.top);
      this.envCurrent.bottom.copy(t.bottom);
      this.envCurrent.horizon.copy(t.horizon);
      this.envCurrent.sun.copy(t.sun);
      this.skyUniforms.topColor.value.copy(t.top);
      this.skyUniforms.bottomColor.value.copy(t.bottom);
      this.skyUniforms.horizonColor.value.copy(t.horizon);
      this.skyUniforms.sunColor.value.copy(t.sun);
      this.skyUniforms.sunDir.value.copy(this.sunDirection);
      this.fog.color.copy(t.bottom);
      this.fog.density = t.density;
      this.sun.intensity = t.sunI;
      this.hemi.intensity = t.hemiI;
      this.ambient.intensity = t.ambient;
      this.hemi.color.copy(t.top);
      this.hemi.groundColor.setHex(0x3a3a2e);
      this.stars.material.opacity = t.star;
      this.sunSprite.material.opacity = this.skyPreset === 'night' ? 0.75 : 0.95;
      this.sunSprite.visible = this.skyPreset !== 'night' || true;
    }

    updateEnvironment(dt) {
      if (!this.envTarget) return;
      const k = Math.min(1, dt * 2.4);
      this.envCurrent.top.lerp(this.envTarget.top, k);
      this.envCurrent.bottom.lerp(this.envTarget.bottom, k);
      this.envCurrent.horizon.lerp(this.envTarget.horizon, k);
      this.envCurrent.sun.lerp(this.envTarget.sun, k);
      this.skyUniforms.topColor.value.copy(this.envCurrent.top);
      this.skyUniforms.bottomColor.value.copy(this.envCurrent.bottom);
      this.skyUniforms.horizonColor.value.copy(this.envCurrent.horizon);
      this.skyUniforms.sunColor.value.copy(this.envCurrent.sun);
      const dirTarget = this.sunDirection || new THREE.Vector3(0.4, 0.8, -0.3);
      this.skyUniforms.sunDir.value.lerp(dirTarget, k).normalize();
      this.fog.color.lerp(this.envTarget.bottom, k);
      this.fog.density = MW.lerp(this.fog.density, this.envTarget.density, k);
      this.sun.intensity = MW.lerp(this.sun.intensity, this.envTarget.sunI, k);
      this.hemi.intensity = MW.lerp(this.hemi.intensity, this.envTarget.hemiI, k);
      this.ambient.intensity = MW.lerp(this.ambient.intensity, this.envTarget.ambient, k);
      this.hemi.color.lerp(this.envTarget.top, k);
      this.hemi.groundColor.setHex(0x3a3a2e);
      this.stars.material.opacity = MW.lerp(this.stars.material.opacity, this.envTarget.star, k);
      this.sky.position.copy(this.camera.position);
      this.stars.position.copy(this.camera.position);
      this.sunSprite.position.copy(this.skyUniforms.sunDir.value).multiplyScalar(this.camera.far * 0.88).add(this.camera.position);
      this.sun.position.copy(this.skyUniforms.sunDir.value).multiplyScalar(140);
      this.skyUniforms.sunPower.value = MW.lerp(this.skyUniforms.sunPower.value, this.weather === 'storm' ? 0.15 : 1, k);

      this.updateWeatherParticles(dt);

      // 闪电
      if (this.weather === 'storm') {
        this.lightningT = (this.lightningT || 5) - dt;
        if (this.lightningT <= 0) {
          this.lightningT = 6 + Math.random() * 9;
          this.lightningFlash = 1;
          setTimeout(() => MW.SFX.thunder(), 240 + Math.random() * 400);
        }
        if (this.lightningFlash > 0) {
          this.lightningFlash -= dt * 5;
          const f = Math.max(0, this.lightningFlash);
          this.ambient.intensity += f * 2.2;
          this.sun.intensity += f * 1.2;
          this.skyUniforms.topColor.value.lerp(new THREE.Color(0xffffff), f * 0.55);
        }
      }
    }

    updateWeatherParticles(dt) {
      const w = this.weather;
      const active = w === 'rain' || w === 'snow' || w === 'storm';
      this.weatherPoints.visible = active;
      if (!active) return;
      const isSnow = w === 'snow';
      this.weatherMat.size = isSnow ? 0.19 : 0.07;
      this.weatherMat.opacity = isSnow ? 0.8 : 0.52;
      this.weatherMat.color.setHex(isSnow ? 0xf2f8ff : 0xb6d3e6);
      const pos = this.weatherPoints.geometry.attributes.position;
      const cam = this.camera.position;
      const speed = isSnow ? 4.2 : 31;
      const wind = isSnow ? 1.4 : 5;
      for (let i = 0; i < this.weatherCount; i++) {
        let x = pos.array[i * 3], y = pos.array[i * 3 + 1], z = pos.array[i * 3 + 2];
        y -= speed * dt;
        x += wind * dt * (isSnow ? Math.sin(this.time + i) : 1);
        z += wind * dt * 0.4;
        if (y < cam.y - 18 || Math.abs(x - cam.x) > 46 || Math.abs(z - cam.z) > 46) {
          x = cam.x + (Math.random() - 0.5) * 76;
          z = cam.z + (Math.random() - 0.5) * 76;
          y = cam.y + 24 + Math.random() * 12;
        }
        pos.array[i * 3] = x;
        pos.array[i * 3 + 1] = y;
        pos.array[i * 3 + 2] = z;
      }
      pos.needsUpdate = true;
    }

    setWeather(id, silent) {
      const def = MW.WEATHERS.find(w => w.id === id) || MW.WEATHERS[0];
      this.weather = def.id;
      this.computeEnvTarget();
      this.ui.setWeather(def);
      if (!silent) {
        this.ui.toast(`天气切换：${def.name}`, 'info');
        MW.SFX.click();
        this.saveLater();
      }
    }

    cycleWeather() {
      const i = MW.WEATHERS.findIndex(w => w.id === this.weather);
      this.setWeather(MW.WEATHERS[(i + 1) % MW.WEATHERS.length].id);
    }

    cycleSeason() {
      const i = MW.SEASONS.findIndex(s => s.id === this.season);
      this.setSeason(MW.SEASONS[(i + 1) % MW.SEASONS.length].id);
    }

    setSeason(id, silent) {
      const def = MW.SEASONS.find(s => s.id === id) || MW.SEASONS[0];
      this.season = def.id;
      this.applySeasonColors(silent);
      this.computeEnvTarget();
      this.ui.setSeason(def);
      if (!silent) {
        this.ui.toast(`季节切换：${def.name}`, 'info');
        MW.SFX.click();
        this.saveLater();
      }
    }

    applySeasonColors(silent) {
      if (!this.world) return;
      const def = MW.SEASONS.find(s => s.id === this.season) || MW.SEASONS[0];
      const w = this.world;
      const prev = w.recordEdits;
      w.recordEdits = false;
      let changed = 0;
      for (const b of w.blocks.values()) {
        if (b.t !== MW.BLOCK_TYPES.LEAF) continue;
        const base = def.leaf[(b.x + b.y + b.z + 300) % def.leaf.length];
        const c = MW.shade(base, (((b.x * 7 + b.y * 3 + b.z * 5) % 9) - 4) * 0.012);
        if (c !== b.c) {
          w.set(b.x, b.y, b.z, c, MW.BLOCK_TYPES.LEAF, false);
          changed++;
          if (changed > 60000) break;
        }
      }
      w.recordEdits = prev;
      if (changed && !silent) this.ui.toast(`树叶染上了${def.name}的颜色`, 'info');
    }

    /* =======================================================
       世界生命周期
       ======================================================= */
    async startWorld(id) {
      if (this.state === 'loading') return;
      this.state = 'loading';
      const def = MW.WORLDS.find(w => w.id === id) || MW.WORLDS[0];
      this.ui.closeAll();
      this.panelOpen = null;
      this.paused = false;
      this.ui.hideVictory();
      this.ui.hideDeath();
      this.ui.showLoading(def.name);
      this.ui.setLoading(4, '正在平整土地……');
      await this.nextFrame(80);

      this.disposeWorld();
      this.currentWorldDef = def;
      this.victoryShown = false;
      try {
        this.world = MW.WorldGen.generate(def);
      } catch (e) {
        console.error('世界生成失败', e);
        this.state = 'menu';
        this.ui.hideLoading();
        this.ui.showMenu();
        this.ui.toast('世界生成失败：' + e.message, 'bad');
        return;
      }
      this.scene.add(this.world.group);
      this.world.setQuality(this.settings.graphics);
      this.bounds = (this.world.meta.bounds || 72) - 4;
      this.travelBounds = this.world.meta.travelBounds || Math.max(600, (this.world.meta.bounds || 72) * 5);
      this.travelBoundsZ = this.world.meta.travelBoundsZ || this.travelBounds;
      this.camera.far = this.world.meta.drawDistance || (this.world.meta.terrain ? 9000 : 1800);
      this.camera.updateProjectionMatrix();

      const total = Math.max(1, this.world.dirty.size);
      let done = 0;
      this.ui.setLoading(12, `正在堆叠 ${this.world.blockCount.toLocaleString()} 个方块……`);
      await this.nextFrame();
      let guard = 0;
      while (this.world.dirty.size && guard++ < 3000) {
        const n = this.world.rebuildDirty(9);
        done += n;
        const pct = 12 + Math.min(76, (done / total) * 76);
        this.ui.setLoading(pct, `正在堆叠 ${this.world.blockCount.toLocaleString()} 个方块……`);
        await this.nextFrame();
      }
      this.ui.setLoading(92, '正在唤醒这片世界……');
      await this.nextFrame();

      this.setupWorld(def);
      this.startIntro();
      this.ui.hideLoading();
      this.ui.hideMenu();
      this.ui.showHud();
      this.state = 'playing';
      this.setMode('explore', true);
      this.setWeather(this.world.meta.weather || def.weather || 'clear', true);
      this.setSeason(this.world.meta.season || def.season || 'summer', true);
      this.setSkyPreset(this.world.meta.sky || def.sky || 'day', true);
      this.loadProgress(def.id);
      this.world.prepareAt(this.player.pos.x,this.player.pos.z);
      this.applyDebugSpawn();
      this.player.refreshViewmodel();
      this.ui.updateAll();
      this.ui.toast(`进入 ${def.name} · 按 E 交互，B 呼出 AI 建筑师`, 'good');
      this.saveLater();
      this.ui.setAPIStatus(!!this.settings.apiKey);
    }

    setupWorld(def) {
      const meta = this.world.meta;
      const spawn = meta.spawn || [0, this.world.surfaceAt(0, 0), 0];
      this.player = new MW.Player(this);
      this.player.pos.set(spawn[0], spawn[1], spawn[2]);
      this.player.spawnPoint.copy(this.player.pos);
      this.player.yaw = meta.spawnYaw || 0;
      this.player.pitch = meta.spawnPitch || 0;
      this.player.thirdPerson = false;
      this.player.spawnProtect = 3;
      this.camera.position.copy(this.player.eyePos);
      this.combat = new MW.Combat(this);
      this.architect = new MW.Architect(this);
      this.createHighlight();

      this.zones = [];
      this.zombies = [];
      this.soldiers = [];
      this.pickups = [];
      this.vehicles = [];
      this.ships = [];
      this.notes = [];
      this.doors = [];
      this.cannons = [];
      this.elevators = [];
      this.airdrops = [];
      this.bridges = [];
      this.projectiles = [];
      this.mines = [];
      this.inVehicle = null;
      this.combatTimer = 2;
      this.killTarget = meta.killTarget || 12;
      this.shipTotal = (meta.enemyShips || []).length;
      this.shipsDestroyed = 0;
      this.victoryShown = false;

      for (const zd of meta.zones || []) this.zones.push(new MW.Entities.Zone(this, zd));
      for (const vd of meta.vehicles || []) {
        try { this.vehicles.push(new MW.Entities.Vehicle(this, vd.type, vd.x, vd.z, vd.name)); }
        catch (e) { console.warn('载具生成失败', e); }
      }
      for (const pd of meta.pickups || []) {
        const kind = MW.WEAPONS[pd.item] ? 'weapon' : 'item';
        const y = pd.y != null ? pd.y : this.world.surfaceAt(pd.x, pd.z) + 0.8;
        this.pickups.push(new MW.Entities.Pickup(this, { kind, id: pd.item }, pd.x, y, pd.z));
      }
      for (const sd of meta.enemyShips || []) {
        try { this.ships.push(new MW.Entities.EnemyShip(this, sd.x, sd.z)); }
        catch (e) { console.warn('敌舰生成失败', e); }
      }
      for (const dd of meta.doors || []) {
        try { this.doors.push(new MW.Entities.Door(this, dd)); }
        catch (e) { console.warn('门生成失败', e); }
      }
      for (const cd of meta.cannons || []) {
        try { this.cannons.push(new MW.Entities.Cannon(this, cd)); }
        catch (e) { console.warn('火炮生成失败', e); }
      }
      for (const ed of (Array.isArray(meta.elevators) ? meta.elevators : []).slice(0, 64)) {
        try { this.elevators.push(new MW.Entities.Elevator(this, ed)); }
        catch (e) { console.warn('电梯生成失败', e); }
      }
      for (const bd of meta.bridges || []) {
        try { this.bridges.push(new MW.Entities.Drawbridge(this, bd)); }
        catch (e) { console.warn('吊桥生成失败', e); }
      }
      for (const d of this.doors) {
        if (!d.spec.gateId) continue;
        d.open = false;
        const br = this.bridges.find(b => b.spec.id === d.spec.gateId);
        if (br) br.setOpen(false);
      }
      this.loadNotes();
      this.advanced = new MW.Advanced(this);
      this.journal = MW.FieldJournal ? new MW.FieldJournal(this) : null;
      this.spawnAmbientPickups();
      this.airdropT = 22;
      this.airdropSeq = 0;
      this.labels = [];
      for (const l of meta.labels || []) {
        try {
          const sprite = MW.Models.label(l.text, MW.parseColor(l.color, 0xffb347), l.width || 10);
          sprite.position.set(l.x, l.y, l.z);
          this.scene.add(sprite);
          this.labels.push(sprite);
        } catch (e) { console.warn('地标加载失败', e); }
      }
      this.ui.setWorldInfo(meta, def);
      this.ui.updateSquad();
      this.ui.updateObjectives();
      this.ui.renderDestinations();
    }

    spawnAmbientPickups() {
      if (!this.world) return;
      const extras = [
        { kind: 'item', id: 'ammo_light', n: 2 },
        { kind: 'item', id: 'medkit', n: 1 },
        { kind: 'item', id: 'grenade', n: 1 }
      ];
      for (const ex of extras) {
        for (let i = 0; i < ex.n; i++) {
          for (let tries = 0; tries < 20; tries++) {
            const a = Math.random() * Math.PI * 2;
            const d = 12 + Math.random() * 45;
            const x = Math.round(this.player.pos.x + Math.cos(a) * d);
            const z = Math.round(this.player.pos.z + Math.sin(a) * d);
            const y = this.world.surfaceAt(x, z);
            if (this.world.meta.waterLevel != null && y <= this.world.meta.waterLevel + 0.5) continue;
            if (this.world.collidesBox(x, y, z, 0.5, 2)) continue;
            this.pickups.push(new MW.Entities.Pickup(this, { kind: ex.kind, id: ex.id }, x, y + 0.8, z));
            break;
          }
        }
      }
    }

    disposeWorld() {
      clearTimeout(this._saveTimer);
      MW.SFX.stopLoops();
      this.advanced?.dispose(); this.advanced = null;
      this.journal = null;
      this.inVehicle = null;
      this.interactTarget = null;
      if (this.player) {
        this.scene.remove(this.player.avatar.group);
        this.camera.remove(this.player.vmHolder);
        this.player = null;
      }
      for (const z of this.zombies) { this.scene.remove(z.model.group); MW.Models.disposeOwned(z.model.group); }
      for (const s of this.soldiers) { this.scene.remove(s.model.group); MW.Models.disposeOwned(s.model.group); }
      for (const p of this.pickups) this.scene.remove(p.mesh);
      for (const v of this.vehicles) { this.scene.remove(v.model.group); if (v.type !== 'train') MW.Models.disposeVehicle(v.model); }
      for (const s of this.ships) { this.scene.remove(s.model.group); MW.Models.disposeVehicle(s.model); }
      for (const z of this.zones) {
        this.scene.remove(z.model);
        this.scene.remove(z.ring);
      }
      for (const n of this.notes) this.scene.remove(n.mesh);
      for (const d of this.doors) this.scene.remove(d.mesh);
      for (const c of this.cannons) this.scene.remove(c.model);
      for (const e of this.elevators) e.dispose();
      this.activeElevator = null;
      for (const a of this.airdrops) this.scene.remove(a.mesh);
      for (const b of this.bridges) this.scene.remove(b.mesh);
      for (const l of this.labels || []) { this.scene.remove(l); l.material.map?.dispose(); l.material.dispose(); }
      this.labels = [];
      for (const p of [...this.projectiles]) p.remove();
      for (const m of this.mines) this.scene.remove(m.mesh);
      this.combat?.dispose();
      this.zombies = [];
      this.soldiers = [];
      this.pickups = [];
      this.vehicles = [];
      this.ships = [];
      this.zones = [];
      this.notes = [];
      this.doors = [];
      this.cannons = [];
      this.elevators = [];
      this.airdrops = [];
      this.bridges = [];
      this.projectiles = [];
      this.mines = [];
      if (this.highlight) {
        this.scene.remove(this.highlight);
        this.scene.remove(this.highlightFill);
        this.highlight = null;
        this.highlightFill = null;
      }
      if (this.world) {
        this.world.dispose();
        this.world = null;
      }
      this.combat = null;
      this.architect = null;
    }

    createHighlight() {
      const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004));
      this.highlight = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
        color: 0xffb347, transparent: true, opacity: 0.95, depthTest: false
      }));
      this.highlight.renderOrder = 5;
      this.highlight.visible = false;
      this.scene.add(this.highlight);
      this.highlightFill = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.12, depthWrite: false })
      );
      this.highlightFill.visible = false;
      this.scene.add(this.highlightFill);
    }

    /* =======================================================
       战斗
       ======================================================= */
    get aliveZombies() { return this.zombies.filter(z => !z.dead); }

    updateCombatSpawn(dt) {
      if (this.mode !== 'combat' || !this.player || !this.player.alive) return;
      this.combatTimer -= dt;
      const maxZ = 9 + Math.min(8, Math.floor(this.player.kills / 4));
      if (this.combatTimer <= 0 && this.aliveZombies.length < maxZ) {
        this.combatTimer = Math.max(1.1, 4.2 - this.player.kills * 0.04) * (0.7 + Math.random() * 0.6);
        this.spawnZombie();
      }
    }

    spawnZombie(near) {
      if (!this.world || !this.player) return null;
      const p = this.player;
      const elite = this.player.kills > 14 && Math.random() < 0.18;
      for (let tries = 0; tries < 28; tries++) {
        const a = Math.random() * Math.PI * 2;
        const d = near ? 14 + Math.random() * 8 : 26 + Math.random() * 22;
        const x = p.pos.x + Math.cos(a) * d;
        const z = p.pos.z + Math.sin(a) * d;
        if (Math.abs(x) > this.travelBounds || Math.abs(z) > (this.travelBoundsZ || this.travelBounds)) continue;
        const y = this.world.surfaceAt(x, z);
        if (this.world.meta.waterLevel != null && y <= this.world.meta.waterLevel + 0.6) continue;
        if (this.world.collidesBox(x, y + 0.1, z, 0.45, 2)) continue;
        const zz = new MW.Entities.Zombie(this, x, y + 0.1, z, { elite });
        this.zombies.push(zz);
        this.combat.smoke(new THREE.Vector3(x, y + 1, z), 0x6b7a52, 3);
        if (this.time - (this._lastSpawnWarn || 0) > 6) {
          this._lastSpawnWarn = this.time;
          const dx = x - p.pos.x, dz = z - p.pos.z;
          let a = Math.atan2(dx, -dz) - p.yaw;
          while (a > Math.PI) a -= Math.PI * 2;
          while (a < -Math.PI) a += Math.PI * 2;
          let dir = Math.abs(a) < Math.PI / 4 ? '前方' : (a > 0 && a < Math.PI * 0.75 ? '右侧' : (a < 0 && a > -Math.PI * 0.75 ? '左侧' : '身后'));
          this.ui.toast(`夜行尸从${dir}出现`, 'bad');
          MW.SFX.growl();
        }
        return zz;
      }
      return null;
    }

    enterCombat() {
      if (!this.player) return;
      this.combatTimer = 1.2;
      const n = Math.min(3, 9 - this.aliveZombies.length);
      for (let i = 0; i < n; i++) {
        setTimeout(() => { if (this.mode === 'combat') this.spawnZombie(true); }, 250 + i * 450);
      }
      this.ui.toast('战斗模式：夜行尸正在靠近', 'bad');
      this.ui.updateObjectives();
    }

    onZombieKilled(z) {
      const p = this.player;
      if (!p) return;
      p.kills++;
      const coins = z.elite ? 55 : 14;
      this.addCoins(coins);
      this.ui.killFeed(z.elite ? '腐化巨尸' : '夜行尸', '');
      this.ui.updateHUD();
      this.ui.updateObjectives();
      this.combat.spark(z.pos.clone().add(new THREE.Vector3(0, 1, 0)), 0x9db060, 10);
      const r = Math.random();
      if (r < 0.08) {
        this.spawnDrop(z.pos, 'weapon');
      } else if (r < 0.32) {
        this.spawnDrop(z.pos, 'ammo');
      } else if (r < 0.4) {
        this.spawnDrop(z.pos, 'medkit');
      } else if (r < 0.45) {
        this.spawnDrop(z.pos, 'grenade');
      }
      this.checkVictory();
      this.saveLater();
    }

    spawnDrop(pos, type) {
      let spec;
      if (type === 'weapon') {
        spec = { kind: 'weapon', id: MW.pick(MW.DROP_WEAPONS) };
      } else if (type === 'ammo') {
        const ammos = ['ammo_light', 'ammo_heavy', 'ammo_shell', 'ammo_rocket'];
        spec = { kind: 'item', id: MW.pick(ammos) };
      } else if (type === 'medkit') {
        spec = { kind: 'item', id: 'medkit' };
      } else {
        spec = { kind: 'item', id: 'grenade' };
      }
      const y = this.world.surfaceAt(pos.x, pos.z) + 0.9;
      this.pickups.push(new MW.Entities.Pickup(this, spec, pos.x, y, pos.z));
    }

    spawnSupplyDrop(pos) {
      const pick = Math.random();
      const spec = pick < 0.45
        ? { kind: 'weapon', id: MW.pick(['rifle', 'shotgun', 'sniper', 'minigun']) }
        : pick < 0.8 ? { kind: 'item', id: 'ammo_rocket' } : { kind: 'item', id: 'backpack3' };
      const x = pos.x + 2.5, z = pos.z + 2.5;
      const y = this.world.surfaceAt(x, z) + 0.9;
      this.pickups.push(new MW.Entities.Pickup(this, spec, x, y, z));
      this.ui.toast('空投补给已抵达据点', 'good');
    }

    onPlayerDeath() {
      if (this.inVehicle) {
        this.inVehicle.exit();
        this.inVehicle = null;
      }
      this.firing = false;
      this.aiming = false;
      this.ui.clearScope();
    }

    respawnAtBase() {
      if (!this.player) return;
      for (const lift of this.elevators || []) lift.release(this.player);
      this.player.pos.copy(this.player.spawnPoint);
      this.player.vel.set(0, 0, 0);
      this.health = 100;
      this.player.health = 100;
      this.player.armor = 0;
      this.player.spawnProtect = 4;
      // 清掉据点附近的僵尸，避免无限连杀
      for (const z of [...this.zombies]) {
        if (!z.dead && z.pos.distanceTo(this.player.spawnPoint) < 26) {
          this.scene.remove(z.model.group);
          this.removeZombie(z);
        }
      }
      this.camera.position.copy(this.player.eyePos);
      this.firing = false;
      this.ui.toast('据点安全区域已清理 · 4 秒无敌', 'info');
    }

    removeZombie(z) {
      const i = this.zombies.indexOf(z);
      if (i >= 0) this.zombies.splice(i, 1);
    }

    removeSoldier(s) {
      const i = this.soldiers.indexOf(s);
      if (i >= 0) this.soldiers.splice(i, 1);
    }

    removePickup(p) {
      const i = this.pickups.indexOf(p);
      if (i >= 0) this.pickups.splice(i, 1);
    }

    removeVehicle(v) {
      const i = this.vehicles.indexOf(v);
      if (i >= 0) this.vehicles.splice(i, 1);
      if (this.inVehicle === v) this.inVehicle = null;
    }

    removeShip(s) {
      const i = this.ships.indexOf(s);
      if (i >= 0) this.ships.splice(i, 1);
    }

    removeProjectile(p) {
      const i = this.projectiles.indexOf(p);
      if (i >= 0) this.projectiles.splice(i, 1);
    }

    removeMine(m) {
      const i = this.mines.indexOf(m);
      if (i >= 0) this.mines.splice(i, 1);
    }

    onShipDestroyed(s) {
      this.shipsDestroyed++;
      this.ui.updateObjectives();
      this.saveLater();
    }

    addCoins(n) {
      if (!this.player) return;
      this.player.coins += n;
      this.ui.updateHUD();
    }

    distToPlayer(pos) {
      return this.player ? this.player.pos.distanceTo(pos) : 9999;
    }

    collidesDoor(x, y, z, r, h) {
      if (this.advanced?.collidesBox(x,y,z,r,h)) return true;
      for (const e of this.elevators || []) if (e.collidesBox(x,y,z,r,h)) return true;
      for (const d of this.doors) {
        if (d.blocksAt(x, y, z, r, h)) return true;
      }
      return false;
    }

    doorLineBlocked(a, b) {
      const steps = 6;
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        const z = a.z + (b.z - a.z) * t;
        if (this.collidesDoor(x, y, z, 0.12, 0.12)) return true;
      }
      return false;
    }

    /* =======================================================
       小队 / 据点
       ======================================================= */
    recruitSoldier() {
      if (!this.player) return;
      const alive = this.soldiers.filter(s => !s.dead).length;
      if (alive >= 6) { this.ui.toast('小队已满（最多 6 人）', 'bad'); return; }
      if (this.player.coins < 60) { this.ui.toast('金币不足，需要 60', 'bad'); MW.SFX.deny(); return; }
      this.player.coins -= 60;
      const names = ['陈青', '林渡', '赵野', '沈舟', '周牧', '苏河', '顾北辰', '叶小满'];
      const name = MW.pick(names);
      const a = Math.random() * Math.PI * 2;
      const x = this.player.pos.x + Math.cos(a) * 3;
      const z = this.player.pos.z + Math.sin(a) * 3;
      const y = this.world.surfaceAt(x, z);
      const s = new MW.Entities.Soldier(this, x, y, z, name);
      s.state = 'follow';
      this.soldiers.push(s);
      this.ui.toast(`${name} 加入了小队`, 'good');
      this.ui.updateSquad();
      this.ui.updateHUD();
      MW.SFX.pickup();
      this.saveLater();
    }

    dispatchSquad() {
      const squad = this.soldiers.filter(s => !s.dead);
      if (!squad.length) { this.ui.toast('没有可派遣的士兵', 'bad'); return; }
      const targets = this.zones.filter(z => !z.captured);
      if (!targets.length) { this.ui.toast('所有据点都已占领', 'info'); return; }
      let best = null, bd = 1e9;
      for (const z of targets) {
        const d = Math.hypot(z.def.x - this.player.pos.x, z.def.z - this.player.pos.z);
        if (d < bd) { bd = d; best = z; }
      }
      for (const s of squad) { s.state = 'capture'; s.targetZone = best; }
      this.ui.toast(`小队正在前往「${best.def.name}」`, 'info');
      this.ui.updateSquad();
      this.saveLater();
    }

    checkVictory() {
      if (this.victoryShown || !this.player || !this.world) return;
      const zonesDone = this.zones.length > 0 && this.zones.every(z => z.captured);
      const killsDone = this.player.kills >= this.killTarget;
      const shipsDone = this.shipTotal === 0 || this.shipsDestroyed >= this.shipTotal;
      if (zonesDone && killsDone && shipsDone) {
        this.victoryShown = true;
        this.addCoins(500);
        const stats = [
          { label: '击杀', value: this.player.kills },
          { label: '占据点', value: this.zones.filter(z => z.captured).length },
          { label: '金币', value: this.player.coins }
        ];
        this.ui.showVictory(stats);
        this.saveProgress();
      }
    }

    /* =======================================================
       建造
       ======================================================= */
    setMode(mode, silent) {
      if (!this.player) return;
      this.mode = mode;
      if (mode !== 'combat') {
        this.player.scoped = false;
        this.aiming = false;
        this.ui.clearScope();
      }
      if (mode === 'build') {
        this.player.thirdPerson = true;
        this.ui.buildBar(true);
        this.ui.setBuildAction(this.buildAction);
        this.ui.toast('建造模式：左键执行当前工具，右键快速拆除，F 切换放置/摧毁', 'info');
      } else {
        this.ui.buildBar(false);
        if (this.highlight) this.highlight.visible = false;
        if (this.highlightFill) this.highlightFill.visible = false;
      }
      if (mode === 'combat') this.enterCombat();
      this.ui.setMode(mode);
      this.ui.updateWeapon();
      this.player.refreshViewmodel();
      if (!silent) MW.SFX.click();
    }

    get selectedBuild() { return BUILD_COLORS[this.buildColorIndex] || BUILD_COLORS[0]; }

    setBuildColor(i) {
      this.buildColorIndex = MW.clamp(i, 0, BUILD_COLORS.length - 1);
      this.ui.updateBuildColors();
      MW.SFX.click();
    }

    setBrush(n) {
      this.buildBrush = MW.clamp(n, 1, 3);
      this.ui.updateBrush();
      MW.SFX.click();
    }

    setBuildAction(action) {
      this.buildAction = action === 'destroy' ? 'destroy' : 'place';
      this.ui.setBuildAction(this.buildAction);
      MW.SFX.click();
      if (this.mode === 'build') {
        this.ui.toast(this.buildAction === 'destroy' ? '建造工具：摧毁方块（左键拆除）' : '建造工具：放置方块（左键放置）', 'info');
      }
    }

    setBuildGrid(value) {
      const grid = Number(value);
      if (![0.25, 0.5, 1].includes(grid)) return;
      this.buildGrid = grid;
      MW.store.set('fineBuildPrefs', { grid });
      this.ui.updateBrush();
      this.ui.toast(`网格 ${grid} m · 对准表面后左键放置`, 'info');
    }

    setBuildPrefab(name) {
      if (!['cell', 'stairs', 'bench', 'planter', 'lamp', 'pergola', 'rail'].includes(name)) return;
      this.buildPrefab = name;
      this.ui.updateBrush();
    }

    rotateBuild() {
      this.buildRotation = ((this.buildRotation || 0) + 1) % 4;
      this.ui.updateBrush();
      MW.SFX.click();
    }

    buildCells(prefix = 'preview') {
      if (!this.buildTarget || !MW.FineBuildTools) return [];
      const target = this.buildTarget, grid = this.buildGrid || 0.25;
      const selected = this.selectedBuild;
      if (this.buildPrefab && this.buildPrefab !== 'cell') {
        return MW.FineBuildTools.prefab(this.buildPrefab, target.x + grid / 2, target.y,
          target.z + grid / 2, this.buildRotation || 0, selected.c, prefix);
      }
      const type = selected.glow ? MW.BLOCK_TYPES.GLOW : selected.water ? MW.BLOCK_TYPES.WATER
        : selected.name === '玻璃' ? MW.BLOCK_TYPES.GLASS : MW.BLOCK_TYPES.SOLID;
      const cells = [], count = this.buildBrush || 1, offset = Math.floor((count - 1) / 2);
      for (let dx = -offset; dx < count - offset; dx++)
        for (let dy = -offset; dy < count - offset; dy++)
          for (let dz = -offset; dz < count - offset; dz++) {
            const x = Number((target.x + dx * grid).toFixed(5));
            const y = Number((target.y + dy * grid).toFixed(5));
            const z = Number((target.z + dz * grid).toFixed(5));
            cells.push({ id: `cell:${x}:${y}:${z}:${grid}`, x, y, z, w: grid, h: grid, d: grid,
              c: selected.c, t: type, source: 'user:grid:' + grid });
          }
      return cells;
    }

    updateBuild() {
      if (this.mode !== 'build' || !this.player || !this.world || !this.world.fine) {
        if (this.highlight) this.highlight.visible = false;
        if (this.highlightFill) this.highlightFill.visible = false;
        this.buildTarget = null;
        return;
      }
      const eye = this.player.eyePos, direction = this.player.forward;
      const hit = this.world.raycast(eye, direction, 9);
      this.buildHit = hit;
      if (!hit) {
        this.buildTarget = null;
        this.highlight.visible = false;
        this.highlightFill.visible = false;
        return;
      }
      this.buildTarget = MW.FineBuildTools.placement(hit, eye, direction, this.buildGrid || 0.25);
      let bounds;
      if (this.buildAction === 'destroy') {
        bounds = hit.cell || { x: hit.x, y: hit.y, z: hit.z, w: 1, h: 1, d: 1 };
      } else {
        const cells = this.buildCells();
        const x = Math.min(...cells.map(c => c.x)), y = Math.min(...cells.map(c => c.y)), z = Math.min(...cells.map(c => c.z));
        bounds = { x, y, z, w: Math.max(...cells.map(c => c.x + c.w)) - x,
          h: Math.max(...cells.map(c => c.y + c.h)) - y, d: Math.max(...cells.map(c => c.z + c.d)) - z };
      }
      this.highlight.visible = !(this.buildAction === 'destroy' && (hit.terrain || hit.precision));
      this.highlightFill.visible = this.highlight.visible;
      this.highlight.position.set(bounds.x + bounds.w / 2, bounds.y + bounds.h / 2, bounds.z + bounds.d / 2);
      this.highlight.scale.set(bounds.w, bounds.h, bounds.d);
      this.highlightFill.position.copy(this.highlight.position);
      this.highlightFill.scale.copy(this.highlight.scale);
      this.highlightFill.material.color.setHex(this.buildAction === 'destroy' ? 0xd98570 : this.selectedBuild.c);
      const status = this.$('fine-build-status');
      if (status) {
        const targetName = hit.fine ? '精细构件' : hit.precision ? '既有 20 cm 楼梯（保留）' : hit.terrain ? '连续地表' : '旧 1 m 方块';
        const text = `细部构件 ${this.world.fine.cells.size} / 10000 · 瞄准：${targetName}`;
        if (status.textContent !== text) status.textContent = text;
      }
    }

    canPlaceFine(cell) {
      const playerBox = { x: this.player.pos.x - this.player.radius, y: this.player.pos.y,
        z: this.player.pos.z - this.player.radius, w: this.player.radius * 2,
        h: this.player.height, d: this.player.radius * 2 };
      if (MW.FineBuildTools.overlaps(cell, playerBox)) return false;
      const epsilon = 0.00001;
      for (let x = Math.floor(cell.x + epsilon); x <= Math.floor(cell.x + cell.w - epsilon); x++)
        for (let y = Math.floor(cell.y + epsilon); y <= Math.floor(cell.y + cell.h - epsilon); y++)
          for (let z = Math.floor(cell.z + epsilon); z <= Math.floor(cell.z + cell.d - epsilon); z++)
            if (this.world.isSolid(x, y, z)) return false;
      const x = cell.x + cell.w / 2, z = cell.z + cell.d / 2, radius = Math.max(cell.w, cell.d) / 2 - epsilon;
      if (this.world.precision?.collidesBox(x, cell.y + epsilon, z, radius, cell.h - epsilon * 2)) return false;
      if (this.world.terrain?.collidesBox(x, cell.y + epsilon, z, radius, cell.h - epsilon * 2, true)) return false;
      if (this.collidesDoor?.(x, cell.y + epsilon, z, radius, cell.h - epsilon * 2)) return false;
      return true;
    }

    placeBlock() {
      if (this.mode !== 'build' || !this.buildTarget || !this.world.fine) return;
      if (this.buildPrefab !== 'cell' && this.buildPrefab && this.buildHit?.ny !== 1) {
        this.ui.toast('微型预制件需要放在向上的水平表面', 'info'); return;
      }
      const prefix = 'user-' + Date.now().toString(36) + '-' + (++this.buildSerial);
      const cells = this.buildCells(prefix);
      try {
        if (cells.some(cell => !this.canPlaceFine(cell))) throw Error('放置区域被人物、建筑或电梯占用');
        const placed = this.world.fine.addBatch(cells, true);
        if (placed) {
          MW.SFX.build();
          this.saveLater();
          this.ui.updateBrush();
        }
      } catch (error) { this.ui.toast(error.message + '；本次未放置任何构件', 'info'); }
    }

    removeBlock() {
      if (this.mode !== 'build' || !this.buildHit) return;
      const hit = this.buildHit;
      // Fine removal is by ID only. A stale/deleted hit never falls through to
      // rounding coordinates and removing a legacy one-metre block underneath.
      if (hit.fine) {
        try {
          if (this.world.fine?.remove(hit.fineId, true)) {
            MW.SFX.build(); this.saveLater(); this.ui.updateBrush();
          }
        } catch (error) { this.ui.toast(error.message, 'info'); }
        return;
      }
      if (hit.terrain || hit.precision) {
        this.ui.toast(hit.precision ? '既有精密楼梯保留；精细构件可单独拆除' : '连续地表保留；可在表面建造', 'info');
        return;
      }
      const count = this.buildBrush || 1, offset = Math.floor((count - 1) / 2);
      let removed = 0;
      for (let dx = -offset; dx < count - offset; dx++)
        for (let dy = -offset; dy < count - offset; dy++)
          for (let dz = -offset; dz < count - offset; dz++)
            if (this.world.remove(hit.x + dx, hit.y + dy, hit.z + dz, true)) removed++;
      if (removed) { MW.SFX.build(); this.saveLater(); }
    }

    /* =======================================================
       交互
       ======================================================= */
    escapeToShore() {
      const p = this.player;
      const w = this.world;
      const wl = w && w.meta ? w.meta.waterLevel : null;
      if (!p || wl == null) return;
      let best = null, bestD = 1e9;
      for (let r = 3; r <= 110; r += 2) {
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          const x = p.pos.x + Math.cos(a) * r;
          const z = p.pos.z + Math.sin(a) * r;
          const surf = w.surfaceAt(x, z);
          if (surf <= wl + 0.6) continue;
          if (w.collidesBox(x, surf + 0.1, z, p.radius, p.height)) continue;
          if (this.collidesDoor(x, surf + 0.1, z, p.radius, p.height)) continue;
          const d = Math.hypot(x - p.pos.x, z - p.pos.z);
          if (d < bestD) { bestD = d; best = { x, z, surf }; }
        }
        if (best) break;
      }
      if (!best) {
        p.pos.copy(p.spawnPoint);
        this.ui.toast('已返回出生点', 'info');
      } else {
        p.pos.set(best.x, best.surf + 0.2, best.z);
        this.ui.toast('已游回最近的岸边 · 按 Space 可以跳跃上岸', 'good');
      }
      p.vel.set(0, 0, 0);
      p.inWater = false;
    }

    updateAirdrops(dt) {
      for (const a of this.airdrops) a.update(dt);
      this.airdrops = this.airdrops.filter(a => !a.landed);
      if (!this.player || !this.player.alive) return;
      this.airdropT = (this.airdropT == null ? 24 : this.airdropT) - dt;
      if (this.airdropT > 0) return;
      this.airdropT = 58 + Math.random() * 24;
      this.spawnAirdrop();
    }

    spawnAirdrop() {
      const kinds = ['tank', 'jet', 'artillery'];
      const kind = kinds[(this.airdropSeq++) % kinds.length];
      const w = this.world;
      const wl = w.meta.waterLevel;
      let spot = null;
      for (let i = 0; i < 26; i++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = 18 + Math.random() * 22;
        const x = this.player.pos.x + Math.cos(ang) * dist;
        const z = this.player.pos.z + Math.sin(ang) * dist;
        if (Math.abs(x) > this.travelBounds - 5 || Math.abs(z) > (this.travelBoundsZ || this.travelBounds) - 5) continue;
        const surf = w.surfaceAt(x, z);
        if (wl != null && surf <= wl + 0.8) continue;
        if (w.collidesBox(x, surf + 1, z, 3.2, 2.4)) continue;
        if (this.vehicles.some(v => !v.dead && Math.hypot(v.pos.x - x, v.pos.z - z) < 5)) continue;
        spot = { x, z };
        break;
      }
      if (!spot) return;
      this.airdrops.push(new MW.Entities.Airdrop(this, kind, spot.x, spot.z));
      const nm = kind === 'tank' ? '坦克' : kind === 'jet' ? '战斗机' : '重型火炮';
      this.ui.toast(`空投警报：${nm}正在降落`, 'good');
      MW.SFX.thunder();
    }

    landAirdrop(a) {
      this.scene.remove(a.mesh);
      const names = { tank: '空投坦克', jet: '空投战斗机', artillery: '空投重炮' };
      const v = new MW.Entities.Vehicle(this, a.kind, a.pos.x, a.pos.z, names[a.kind]);
      v.yaw = Math.random() * Math.PI * 2;
      v.model.group.rotation.y = v.yaw;
      this.vehicles.push(v);
      this.combat?.spark(a.pos.clone().add(new THREE.Vector3(0, 1, 0)), 0x9fe6a8, 14);
      this.ui.toast(`${names[a.kind]} 已抵达 · 靠近按 E`, 'good');
    }

    updateLabels() {
      if (!this.player) return;
      if (this.intro) {
        for (const l of this.labels) l.visible = false;
        return;
      }
      for (const l of this.labels) {
        const d = l.position.distanceTo(this.player.pos);
        const a = MW.clamp((d - 14) / 30, 0, 1);
        l.material.opacity = a * 0.92;
        l.visible = a > 0.04;
        const base = l.userData.baseScale;
        if (base) {
          const k = 0.65 + Math.min(0.9, d / 110);
          l.scale.set(base.x * k, base.y * k, 1);
        }
      }
    }

    updateDanger() {      if (this.mode !== 'combat' || !this.player || !this.player.alive) {
        this.ui.setDanger(false);
        return;
      }
      let nearest = null, nd = 1e9;
      for (const z of this.zombies) {
        if (z.dead) continue;
        const d = z.pos.distanceTo(this.player.pos);
        if (d < nd) { nd = d; nearest = z; }
      }
      if (!nearest || nd > 15) { this.ui.setDanger(false); return; }
      const dx = nearest.pos.x - this.player.pos.x;
      const dz = nearest.pos.z - this.player.pos.z;
      let a = Math.atan2(dx, -dz) - this.player.yaw;
      while (a > Math.PI) a -= Math.PI * 2;
      while (a < -Math.PI) a += Math.PI * 2;
      let dir = '附近';
      if (Math.abs(a) < Math.PI / 4) dir = '前方';
      else if (a >= Math.PI / 4 && a < Math.PI * 0.75) dir = '右侧';
      else if (a <= -Math.PI / 4 && a > -Math.PI * 0.75) dir = '左侧';
      else dir = '身后';
      this.ui.setDanger(true, `夜行尸接近 · ${dir}`);
    }

    updateInteraction() {
      if (!this.player || !this.player.alive) {
        this.interactTarget = null;
        this.ui.setInteract(null);
        return;
      }      if (this.inVehicle) {
        const vt = this.inVehicle;
        const label = vt.type === 'drone' ? '降落并离开无人机' : vt.type === 'jet' ? '离开战斗机' : `离开 ${vt.name}`;
        this.interactTarget = { type: 'exitVehicle', label };
        this.ui.setInteract(this.interactTarget.label);
        return;
      }
      let best = null, bd = 3.0;
      for (const p of this.pickups) {
        if (p.taken) continue;
        const d = p.pos.distanceTo(this.player.pos);
        if (d < 2.6 && d < bd) { bd = d; best = { type: 'pickup', pickup: p, label: `拾取 ${p.label()}` }; }
      }
      for (const v of this.vehicles) {
        if (v.dead) continue;
        const d = v.pos.distanceTo(this.player.pos);
        if (d < 9 && (!best || d < bd)) {
          bd = d;
          const label = v.type === 'drone' ? `操控 ${v.name}` : `驾驶 ${v.name}`;
          best = { type: 'vehicle', vehicle: v, label };
        }
      }
      for (const n of this.notes) {
        const d = n.pos.distanceTo(this.player.pos);
        if (d < 3.0 && d < bd) { bd = d; best = { type: 'note', note: n.note, label: '阅读便签' }; }
      }
      for (const door of this.doors) {
        const d = door.pos.distanceTo(this.player.pos);
        if (d < 3.4 && (!best || d < bd)) {
          bd = d;
          best = { type: 'door', door, label: `${door.open ? '关闭' : '打开'}：${door.spec.name || '门'}` };
        }
      }
      for (const cannon of this.cannons) {
        const d = cannon.pos.distanceTo(this.player.pos);
        if (d < 3.6 && (!best || d < bd)) {
          bd = d;
          best = { type: 'cannon', cannon, label: cannon.fireCd > 0 ? `${cannon.spec.name} 装填中` : `开炮：${cannon.spec.name || '火炮'} · 俯仰 ${Math.round(cannon.pitch * 180 / Math.PI)}°（滚轮/↑↓）` };
        }
      }
      for (const lift of this.elevators) {
        const interaction = lift.interaction(this.player);
        if (interaction && (!best || interaction.distance < bd)) {
          bd = interaction.distance;
          best = { type: 'elevator', elevator: lift, label: interaction.label };
        }
      }
      this.interactTarget = best;
      this.ui.setInteract(best ? best.label : null);
    }

    interact() {
      if (!this.interactTarget) return;
      const t = this.interactTarget;
      if (t.type === 'exitVehicle') {
        if (this.inVehicle) this.inVehicle.exit();
        if (this.player) this.player.pos.y += 1;
      } else if (t.type === 'pickup') {
        t.pickup.tryTake(this.player);
      } else if (t.type === 'vehicle') {
        if (this.mode === 'build') this.setMode('explore');
        t.vehicle.enter();
      } else if (t.type === 'note') {
        this.openNote(t.note.id);
      } else if (t.type === 'door') {
        t.door.toggle();
        this.saveLater();
      } else if (t.type === 'cannon') {
        t.cannon.fire();
      } else if (t.type === 'elevator') {
        this.openElevator(t.elevator);
      }
      this.updateInteraction();
    }

    openNote(id) {
      const note = this.notes.find(n => n.note.id === id);
      if (!note) return;
      this.currentNote = note.note;
      this.openPanel('note-read');
      this.ui.openNote(note.note);
    }

    addWorldNote(text) {
      if (!this.world || !this.player) return false;
      text = (text || '').trim();
      if (!text) return false;
      const dir = this.player.forward;
      const x = Math.round(this.player.pos.x + dir.x * 2);
      const z = Math.round(this.player.pos.z + dir.z * 2);
      const note = {
        id: MW.uid('note'),
        text: text.slice(0, 160),
        author: this.settings.playerName || '旅行者',
        time: MW.nowStamp(),
        x, z
      };
      this.worldNotes = this.worldNotes || [];
      this.worldNotes.push(note);
      const marker = new MW.Entities.NoteMarker(this, note);
      this.notes.push(marker);
      this.saveNotes();
      this.ui.renderNotes();
      this.ui.toast('便签已钉在这里', 'good');
      MW.SFX.pickup();
      this.saveLater();
      return true;
    }

    deleteNote(id) {
      const i = this.notes.findIndex(n => n.note.id === id);
      if (i < 0) return;
      this.scene.remove(this.notes[i].mesh);
      this.notes.splice(i, 1);
      this.worldNotes = (this.worldNotes || []).filter(n => n.id !== id);
      this.saveNotes();
      this.ui.renderNotes();
      this.closeAllPanels();
      this.ui.toast('便签已撕掉', 'info');
      this.saveLater();
    }

    loadNotes() {
      if (!this.currentWorldDef) return;
      this.worldNotes = MW.store.get('notes_' + this.currentWorldDef.id, []);
      if (!Array.isArray(this.worldNotes)) this.worldNotes = [];
      for (const note of this.worldNotes) {
        try { this.notes.push(new MW.Entities.NoteMarker(this, note)); }
        catch (e) { console.warn('便签加载失败', e); }
      }
    }

    saveNotes() {
      if (!this.currentWorldDef) return;
      MW.store.set('notes_' + this.currentWorldDef.id, this.worldNotes || []);
    }

    addMessage(channel, author, text) {
      text = (text || '').trim();
      if (!text) return false;
      const board = MW.store.get('board', null) || MW.SAMPLE_MESSAGES.map(m => ({ ...m }));
      const msg = {
        id: MW.uid('msg'),
        author: (author || this.settings.playerName || '旅行者').slice(0, 12),
        text: text.slice(0, 240),
        time: MW.nowStamp(),
        likes: 0,
        channel
      };
      board.unshift(msg);
      MW.store.set('board', board);
      this.ui.renderMessages();
      this.ui.toast('已发布到留言板', 'good');
      return true;
    }

    getBoard() {
      let board = MW.store.get('board', null);
      if (!Array.isArray(board)) {
        board = MW.SAMPLE_MESSAGES.map(m => ({ ...m }));
        MW.store.set('board', board);
      }
      return board;
    }

    likeMessage(id) {
      const board = this.getBoard();
      const m = board.find(x => x.id === id);
      if (!m) return;
      m.likes = (m.likes || 0) + 1;
      MW.store.set('board', board);
      this.ui.renderMessages();
      MW.SFX.click();
    }

    /* =======================================================
       入场俯瞰
       ======================================================= */
    startIntro() {
      if (!this.player || !this.world) return;
      const p = this.player;
      const end = p.eyePos.clone();
      const start = new THREE.Vector3(p.pos.x, p.pos.y + 34, p.pos.z + 48);
      const lookStart = new THREE.Vector3(0, 10, 0);
      const fwd = new THREE.Vector3(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));
      const lookEnd = end.clone().addScaledVector(fwd, 14);
      this.intro = { t: 0, dur: 5.4, start, end, lookStart, lookEnd };
      this.camera.position.copy(start);
      this.camera.lookAt(lookStart);
      this.camera.fov = 58;
      this.camera.updateProjectionMatrix();
      this.ui.toast('俯瞰镜头 · 点击画面或按任意键跳过', 'info');
      if (this.ui.setIntro) this.ui.setIntro(true);
    }

    updateIntro(dt) {
      const i = this.intro;
      i.t += dt;
      const k = MW.clamp(i.t / i.dur, 0, 1);
      const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const pos = i.start.clone().lerp(i.end, ease);
      pos.y += Math.sin(ease * Math.PI) * 5;
      this.camera.position.copy(pos);
      const look = i.lookStart.clone().lerp(i.lookEnd, ease);
      this.camera.lookAt(look);
      this.camera.fov = MW.lerp(58, 72, ease);
      this.camera.updateProjectionMatrix();
      if (k >= 1) this.finishIntro();
    }

    finishIntro() {
      if (!this.intro) return;
      this.intro = null;
      this.camera.fov = 72;
      this.camera.updateProjectionMatrix();
      if (this.ui.setIntro) this.ui.setIntro(false);
    }

    /* =======================================================
       相机 / 帧更新
       ======================================================= */
    updateCamera(dt) {
      if (!this.player) return;
      const p = this.player;
      let shake = this.shakeAmt || 0;
      this.shakeAmt = Math.max(0, shake - dt * 1.8);

      if (this.inVehicle) {
        const v = this.inVehicle;
        const yaw = p.yaw, pitch = p.pitch;
        if (v.fpv && (v.type === 'drone' || v.type === 'jet')) {
          v.model.group.visible = false;
          const eye = v.pos.clone().add(new THREE.Vector3(0, v.type === 'jet' ? 0.9 : 0.25, 0));
          this.camera.position.lerp(eye, Math.min(1, dt * 14));
          this.camera.lookAt(eye.clone().addScaledVector(p.forward, 20));
          this.camera.rotateZ(Math.sin(this.time * 0.8) * 0.004);
          this.camera.fov = MW.lerp(this.camera.fov, 82, Math.min(1, dt * 8));
          this.camera.updateProjectionMatrix();
          this.ui.setScope(false);
          this.ui.setCrosshair('combat');
          this.ui.setThirdView(false);
          return;
        }
        const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
        let dist = v.type === 'tank' ? 11 : v.type === 'drone' ? 6 : v.type === 'jet' ? 16 : v.type === 'car' ? 8 : 9;
        const target = v.pos.clone().add(new THREE.Vector3(0, v.type === 'tank' ? 3.2 : v.type === 'jet' ? 2.8 : v.type === 'car' ? 1.6 : 2.2, 0));
        let desired = target.clone().addScaledVector(fwd, -dist).add(new THREE.Vector3(0, 3.2 + pitch * 3, 0));
        const dir = desired.clone().sub(target);
        const wantDist = dir.length();
        dir.normalize();
        const hit = this.world.raycast(target, dir, wantDist);
        if (hit) desired = target.clone().addScaledVector(dir, Math.max(1.6, hit.dist - 0.5));
        this.camera.position.lerp(desired, Math.min(1, dt * 6));
        this.camera.lookAt(target.clone().addScaledVector(fwd, 10).add(new THREE.Vector3(0, pitch * 6, 0)));
        this.camera.rotateZ(Math.sin(this.time * 0.8) * 0.006);
        this.ui.setScope(false);
        this.ui.setCrosshair('combat');
        this.ui.setThirdView(true);
      } else if (p.thirdPerson) {
        const eye = p.eyePos;
        const fwd = p.forward;
        const flat = new THREE.Vector3(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));
        const desired = eye.clone().addScaledVector(flat, -4.4).add(new THREE.Vector3(0, 1.1, 0));
        const dir = desired.clone().sub(eye);
        const dist = dir.length();
        dir.normalize();
        const hit = this.world.raycast(eye, dir, dist);
        if (hit) desired.copy(eye).addScaledVector(dir, Math.max(0.8, hit.dist - 0.3));
        this.camera.position.lerp(desired, Math.min(1, dt * 9));
        const look = eye.clone().addScaledVector(fwd, 4);
        this.camera.lookAt(look);
        this.ui.setThirdView(true);
      } else {
        this.camera.position.copy(p.eyePos);
        this.camera.position.y += Math.sin(p.bob * 2) * 0.014;
        const roll = this.aiming ? 0 : Math.sin(p.bob) * 0.004;
        this.camera.rotation.set(p.pitch, p.yaw, roll);
        this.ui.setThirdView(false);
      }

      if (shake > 0) {
        this.camera.position.x += (Math.random() - 0.5) * shake * 0.4;
        this.camera.position.y += (Math.random() - 0.5) * shake * 0.4;
        this.camera.rotation.z += (Math.random() - 0.5) * shake * 0.02;
      }

      // 视野 / 瞄准镜
      const targetFov = p.scoped ? 28 : (this.aiming ? 58 : 72);
      this.camera.fov = MW.lerp(this.camera.fov, targetFov, Math.min(1, dt * 10));
      this.camera.updateProjectionMatrix();
      this.ui.setScope(p.scoped && !p.thirdPerson && !this.inVehicle);
      this.ui.setCrosshair(this.mode, !!p.scoped);
      this.ui.setAim(this.aiming);
      this.ui.setThirdView(p.thirdPerson || !!this.inVehicle);

      // 水下色调
      const wl = this.world && this.world.meta.waterLevel;
      this.ui.setUnderwater(wl != null && this.camera.position.y < wl + 0.2);
    }

    shake(amount, duration) {
      if (this.settings.reducedMotion) return;
      this.shakeAmt = Math.max(this.shakeAmt || 0, amount);
    }

    updateAutoFire() {
      if (!this.firing || this.mode !== 'combat' || !this.player || !this.player.alive) return;
      const def = this.player.weaponDef;
      if (def && def.auto) this.combat.fireWeapon();
    }

    updateSave(dt) {
      this.saveT -= dt;
      if (this.saveT <= 0) {
        this.saveT = 20;
        this.saveProgress();
      }
    }

    saveLater() {
      clearTimeout(this._saveTimer);
      this._saveTimer = setTimeout(() => this.saveProgress(), 2500);
    }

    /* =======================================================
       输入
       ======================================================= */
    bindEvents() {
      window.addEventListener('resize', () => this.onResize());
      window.addEventListener('blur', () => { this.keys = {}; this.firing = false; });
      this.canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.contextLost=true; this.saveProgress(); this.ui.toast('图形连接暂时中断，进度已尝试保存；连接恢复后请刷新页面', 'info'); });
      this.canvas.addEventListener('webglcontextrestored', () => { this.contextLost=false; this.ui.toast('图形连接已恢复，请刷新后继续上次世界', 'info'); });

      document.addEventListener('keydown', e => this.onKeyDown(e));
      document.addEventListener('keyup', e => this.onKeyUp(e));

      this.canvas.addEventListener('mousedown', e => this.onMouseDown(e));
      document.addEventListener('mouseup', e => this.onMouseUp(e));
      document.addEventListener('mousemove', e => this.onMouseMove(e));
      document.addEventListener('contextmenu', e => {
        if (e.target === this.canvas) e.preventDefault();
      });
      document.addEventListener('wheel', e => {
        if (this.state !== 'playing' || this.panelOpen) return;
        if (e.target !== this.canvas) return;
        e.preventDefault();
        if (this.inVehicle && (this.inVehicle.type === 'tank' || this.inVehicle.type === 'artillery')) {
          this.inVehicle.adjustTurretPitch(e.deltaY > 0 ? -0.05 : 0.05);
          return;
        }
        if (this.interactTarget && this.interactTarget.type === 'cannon') {
          this.interactTarget.cannon.adjustPitch(e.deltaY > 0 ? -0.045 : 0.045);
          return;
        }
        if (this.mode === 'combat') this.player.cycleWeapon(e.deltaY > 0 ? 1 : -1);
      }, { passive: false });

      this.canvas.addEventListener('click', () => {
        if (this.state !== 'playing' || this.panelOpen) return;
        if (!this.pointerLocked) this.requestLock();
      });

      document.addEventListener('pointerlockchange', () => {
        this.pointerLocked = document.pointerLockElement === this.canvas;
        this.ui.setPointerLock(this.pointerLocked);
      });
      document.addEventListener('pointerlockerror', () => {
        this.ui.toast('鼠标锁定失败，请点击画面重试', 'info');
      });

      window.addEventListener('beforeunload', () => {
        if (this.state === 'playing') this.saveProgress();
        MW.store.set('settings', this.settings);
      });

      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.state === 'playing') {
          this.keys = {};
          this.firing = false;
          this.saveProgress();
          MW.SFX.suspend();
        } else if (!document.hidden && MW.SFX.ctx) {
          MW.SFX.init();
        }
      });
    }

    requestLock() {
      if (!this.canvas || this.state !== 'playing') return;
      // Return keyboard control to the world after a build-palette selection.
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) document.activeElement.blur();
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    }

    onResize() {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(this.pixelRatio || Math.min(window.devicePixelRatio || 1, 1.5));
      this.ui.resizeWorkshop();
    }

    isTyping(e) {
      const t = e.target;
      if (!t) return false;
      if (!(t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return false;
      if (t.offsetParent === null) return false;
      const hiddenPanel = t.closest('.modal.hidden, .drawer.hidden, #start-screen.hidden');
      return !hiddenPanel;
    }

    onKeyDown(e) {
      if (e.key === 'Escape') {
        if (this.panelOpen) { this.closeAllPanels(); e.preventDefault(); return; }
        if (this.state === 'playing') {
          if (this.player && this.player.scoped) { this.player.scoped = false; this.ui.clearScope(); return; }
          this.openPanel('pause');
          e.preventDefault();
        }
        return;
      }
      if (this.isTyping(e)) return;
      if (this.panelOpen === 'map' && e.code === 'KeyP') { this.closeAllPanels(); return; }
      if (this.state !== 'playing') return;
      if (this.intro) { this.finishIntro(); return; }
      if (this.panelOpen) return;

      const key = e.key.toLowerCase();
      this.keys[key] = true;
      if (e.code === 'Space') { this.keys.space = true; e.preventDefault(); }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keys.shift = true;

      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl) return;
      if (e.repeat) return;

      switch (e.code) {
        case 'KeyZ': this.setMode('explore'); break;
        case 'KeyX': this.setMode('build'); break;
        case 'KeyC': this.setMode('combat'); break;
        case 'KeyR':
          if (this.mode === 'build') { this.rotateBuild(); break; }
          if (this.player.inWater && !this.inVehicle) this.escapeToShore();
          else if (this.mode === 'combat') this.player.startReload();
          break;
        case 'KeyQ':
          if (this.mode === 'build') {
            this.keys = {};
            if (document.pointerLockElement) document.exitPointerLock();
            this.ui.toast('鼠标已释放：选择网格或预制件，再点击画面继续建造', 'info');
          }
          break;
        case 'KeyG': this.combat.throwGrenade(); break;
        case 'KeyM': this.combat.placeMine(); break;
        case 'KeyE': this.interact(); break;
        case 'KeyN': this.openPanel('notes'); this.ui.focusNoteInput(); break;
        case 'KeyL': this.openPanel('notes'); break;
        case 'KeyI': this.openPanel('inventory'); break;
        case 'KeyK': this.openPanel('squad'); break;
        case 'KeyB': this.openPanel('ai'); break;
        case 'KeyP': this.openPanel('map'); break;
        case 'KeyU': this.openPanel('operations'); break;
        case 'ArrowUp':
          if (this.interactTarget && this.interactTarget.type === 'cannon') { e.preventDefault(); this.interactTarget.cannon.adjustPitch(0.05); }
          break;
        case 'ArrowDown':
          if (this.interactTarget && this.interactTarget.type === 'cannon') { e.preventDefault(); this.interactTarget.cannon.adjustPitch(-0.05); }
          break;
        case 'KeyO': this.openPanel('workshop'); break;
        case 'KeyH': this.openPanel('help'); break;
        case 'KeyT': this.cycleWeather(); break;
        case 'KeyY': this.cycleSeason(); break;
        case 'KeyF':
          if (this.mode === 'build') this.setBuildAction(this.buildAction === 'place' ? 'destroy' : 'place');
          break;
        case 'KeyV':
          if (this.inVehicle) {
            const v = this.inVehicle;
            if (v.type === 'drone' || v.type === 'jet') {
              v.fpv = !v.fpv;
              v.model.group.visible = !v.fpv;
              this.ui.toast(v.fpv ? (v.type === 'jet' ? '座舱视角' : '无人机第一视角') : '第三人称视角', 'info');
            } else {
              this.ui.toast('该载具没有座舱视角', 'info');
            }
          } else {
            this.player.thirdPerson = !this.player.thirdPerson;
            this.ui.toast(this.player.thirdPerson ? '第三人称' : '第一人称', 'info');
          }
          break;
        case 'BracketLeft': if (this.mode === 'build') this.setBrush(this.buildBrush - 1); break;
        case 'BracketRight': if (this.mode === 'build') this.setBrush(this.buildBrush + 1); break;
        case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5':
        case 'Digit6': case 'Digit7': case 'Digit8': case 'Digit9': case 'Digit0': {
          const n = e.code === 'Digit0' ? 10 : Number(e.code.slice(5));
          if (this.mode === 'build') this.setBuildColor(n - 1);
          else if (this.mode === 'combat' && n <= 7) this.player.switchWeapon(n - 1);
          break;
        }
        case 'Tab': e.preventDefault(); if (this.mode === 'combat') this.openPanel('inventory'); break;
      }
    }

    onKeyUp(e) {
      const key = e.key.toLowerCase();
      this.keys[key] = false;
      if (e.code === 'Space') this.keys.space = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keys.shift = false;
    }

    onMouseDown(e) {
      if (this.state !== 'playing' || this.panelOpen) return;
      if (e.target !== this.canvas) return;
      if (this.intro) { this.finishIntro(); this.requestLock(); return; }
      if (!this.pointerLocked) { this.requestLock(); return; }
      if (e.button === 0) {
        if (this.mode === 'build') {
          if (this.buildAction === 'destroy') this.removeBlock();
          else this.placeBlock();
          return;
        }
        if (this.inVehicle) { this.inVehicle.fire(); return; }
        if (this.mode === 'combat') {
          this.firing = true;
          this.combat.fireWeapon();
        }
      } else if (e.button === 2) {
        this.aiming = true;
        if (this.mode === 'combat' && this.player.weaponDef && this.player.weaponDef.scope) {
          this.player.scoped = true;
          this.player.thirdPerson = false;
        }
        if (this.mode === 'build') this.removeBlock();
      }
    }

    onMouseUp(e) {
      if (e.button === 0) this.firing = false;
      if (e.button === 2) {
        this.aiming = false;
        if (this.player) this.player.scoped = false;
      }
    }

    onMouseMove(e) {
      if (this.state !== 'playing' || !this.pointerLocked || this.panelOpen) return;
      if (!this.player) return;
      const sens = this.player.scoped ? 0.0009 : 0.0022;
      if (this.inVehicle) {
        this.player.pitch = MW.clamp(this.player.pitch - e.movementY * sens, -1.45, 1.45);
        return;
      }
      this.player.yaw -= e.movementX * sens;
      this.player.pitch -= e.movementY * sens;
      this.player.pitch = MW.clamp(this.player.pitch, -1.45, 1.45);
    }

    /* =======================================================
       面板 / 菜单
       ======================================================= */
    openPanel(name) {
      if (this.state !== 'playing' && name !== 'settings' && name !== 'help') return;
      this.ui.openPanel(name);
      this.panelOpen = name;
      this.firing = false;
      this.keys = {};
      if (document.pointerLockElement) document.exitPointerLock();
      if (name === 'inventory') this.ui.renderInventory();
      if (name === 'squad') this.ui.renderSquadPanel();
      if (name === 'notes') { this.ui.renderNotes(); this.ui.renderMessages(); }
      if (name === 'workshop') this.ui.refreshWorkshop();
      if (name === 'settings') this.ui.fillSettings();
      if (name === 'operations') this.advanced?.render();
      if (name === 'pause') this.paused = true;
    }

    openElevator(elevator) {
      if (!elevator?.interaction(this.player)) return;
      if (elevator.moving) { this.ui.toast('轿厢正在运行，请在候梯区稍候。', 'info'); return; }
      this.activeElevator = elevator;
      this.openPanel('elevator');
      this.ui.renderElevator(elevator);
    }

    rideElevator(floor) {
      const e = this.activeElevator;
      if (!e || !this.player) return;
      if (!e.requestRide(floor, this.player)) {
        this.ui.toast('电梯正在运行，或你已离开候梯区。请在楼层入口稍候。', 'info');
        return;
      }
      this.closeAllPanels();
      this.ui.toast(e.pending ? '已呼叫轿厢，请在此等候。到达后自动前往所选楼层。' : '已选择楼层 · 观景电梯出发', 'info');
      MW.SFX.click();
    }

    closePanel(name) {
      this.ui.closePanel(name || this.panelOpen);
      this.panelOpen = null;
      this.paused = false;
    }

    closeAllPanels() {
      this.ui.closeAll();
      this.panelOpen = null;
      this.paused = false;
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    }

    returnToMenu() {
      this.saveProgress();
      MW.store.set('settings', this.settings);
      this.ui.closeAll();
      this.panelOpen = null;
      this.paused = false;
      this.disposeWorld();
      this.currentWorldDef = null;
      this.state = 'menu';
      this.ui.hideHud();
      this.ui.updateVehicleHUD(null);
      this.ui.hideVictory();
      this.ui.hideDeath();
      this.ui.showMenu();
      if (document.pointerLockElement) document.exitPointerLock();
      this.ui.toast('世界已保存', 'good');
    }

    /* =======================================================
       存档 / 导入导出
       ======================================================= */
    saveProgress() {
      if (!this.world || !this.player || !this.currentWorldDef) return;
      const p = this.player;
      const data = {
        version: 2,
        discoveries: Array.from(this.journal?.visited || []),
        worldId: this.currentWorldDef.id,
        name: this.world.meta.name,
        weather: this.weather,
        season: this.season,
        victory: this.victoryShown,
        player: {
          position: p.elevatorRide ? Object.values(p.elevatorRide.landing(p.elevatorRide.floor)) : p.pos.toArray(),
          yaw: p.yaw,
          health: p.health,
          armor: p.armor,
          coins: p.coins,
          kills: p.kills,
          deaths: p.deaths,
          backpackLevel: p.backpackLevel,
          weapons: p.weapons,
          current: p.current,
          ammo: p.ammo,
          items: Array.from(p.items.entries())
        },
        edits: this.world.exportEdits(),
        fine: this.world.fine?.serialize(),
        zones: this.zones.map(z => ({ name: z.def.name, progress: z.progress, captured: z.captured })),
        doors: this.doors.map(d => ({ id: d.id, open: d.open })),
        shipsDestroyed: this.shipsDestroyed,
        savedAt: Date.now()
      };
      const ok = MW.store.set('save_' + this.currentWorldDef.id, data);
      if (ok) {
        if (this.currentWorldDef.id !== 'custom') MW.store.set('lastWorld', this.currentWorldDef.id);
        this.ui.setSaveInfo(`已自动保存 · ${MW.nowStamp()} · ${data.edits.length} 处整米改动 · ${data.fine?.cells.length || 0} 个精细构件`);
      } else {
        this.ui.setSaveInfo('自动保存失败：浏览器存储空间不足，请导出世界备份');
      }
    }

    loadProgress(worldId) {
      const save = MW.store.get('save_' + worldId, null);
      if (!save || !save.player) {
        this.ui.setSaveInfo('新世界 · 自动保存已开启');
        return;
      }
      const p = this.player;
      const sp = save.player;
      if (this.journal && Array.isArray(save.discoveries)) this.journal.visited = new Set(save.discoveries.filter(id => this.world.meta.discoveries?.some(place => place.id === id)));
      p.coins = sp.coins != null ? sp.coins : p.coins;
      p.kills = sp.kills || 0;
      p.deaths = sp.deaths || 0;
      p.health = sp.health || 100;
      if (p.health < 45) p.health = 100;
      p.armor = sp.armor || 0;
      p.backpackLevel = sp.backpackLevel || 1;
      if (Array.isArray(sp.weapons) && sp.weapons.length) {
        p.weapons = sp.weapons.filter(w => MW.WEAPONS[w.id]).map(w => ({ id: w.id, mag: w.mag || 1 }));
        if (!p.weapons.length) p.weapons = [{ id: 'pistol', mag: 12 }];
        p.current = MW.clamp(sp.current || 0, 0, p.weapons.length - 1);
      }
      if (sp.ammo) p.ammo = Object.assign(p.ammo, sp.ammo);
      if (Array.isArray(sp.items)) {
        p.items = new Map(sp.items.filter(it => MW.ITEMS[it[0]]));
      }
      p.refreshViewmodel();
      this.weather = save.weather || this.weather;
      this.season = save.season || this.season;
      this.victoryShown = !!save.victory;
      this.shipsDestroyed = save.shipsDestroyed || 0;
      if (Array.isArray(save.edits) && save.edits.length) {
        this.world.applyEdits(save.edits);
      }
      if (save.fine && this.world.fine) {
        try { this.world.fine.loadSnapshot(save.fine); }
        catch (error) { this.ui.toast('精细构件存档未恢复：' + error.message + '；生成的原景观保留', 'info'); }
      }
      if (Array.isArray(sp.position) && sp.position.length===3 && sp.position.every(Number.isFinite)) {
        const [x,y,z]=sp.position;
        if (Math.abs(x)<=this.travelBounds && Math.abs(z)<=(this.travelBoundsZ || this.travelBounds) && y>(this.world.fallbackY ?? -100)-16 && y<20000 && !this.world.collidesBox(x,y,z,p.radius,p.height)) {
          p.pos.set(x,Math.max(y,this.world.terrain ? this.world.terrainGroundAt(x,z) : this.world.fallbackY),z);
          if(Number.isFinite(sp.yaw)) p.yaw=sp.yaw;
        }
      }
      if (Array.isArray(save.zones)) {
        for (const zs of save.zones) {
          const z = this.zones.find(zz => zz.def.name === zs.name);
          if (z) {
            z.progress = zs.progress || 0;
            if (zs.captured && !z.captured) {
              z.captured = true;
              z.progress = 100;
              z.model.userData.cloth.material.color.setHex(0x5bd08a);
              z.ring.material.color.setHex(0x5bd08a);
              z.ring.material.opacity = 0.14;
            }
          }
        }
      }
      if (Array.isArray(save.doors)) {
        for (const ds of save.doors) {
          const d = this.doors.find(dd => dd.id === ds.id);
          if (d) {
            d.open = !!ds.open;
            const rot = d.open ? -Math.PI * 0.52 : 0;
            d.leftHinge.rotation.y = rot;
            d.rightHinge.rotation.y = -rot;
            if (d.spec.gateId) {
              const br = this.bridges.find(b => b.spec.id === d.spec.gateId);
              if (br) br.setOpen(d.open);
            }
          }
        }
      }
      this.setWeather(this.weather, true);
      this.setSeason(this.season, true);
      this.setSkyPreset(this.world.meta.sky || this.skyPreset, true);
      this.ui.renderDestinations();
      this.ui.setSaveInfo(`已读取存档 · 击杀 ${p.kills} · 金币 ${p.coins}`);
    }

    resetWorldProgress() {
      if (!this.currentWorldDef) return;
      if (!confirm('确定重置当前世界的进度？建筑改动、据点、角色进度都会清空（便签与留言保留）。')) return;
      MW.store.remove('save_' + this.currentWorldDef.id);
      this.closeAllPanels();
      this.startWorld(this.currentWorldDef.id);
    }

    exportWorld() {
      if (!this.world) { this.ui.toast('还没有进入世界', 'bad'); return; }
      this.ui.toast('正在打包世界，请稍候……', 'info');
      setTimeout(() => {
        try {
          const data = this.world.serialize();
          data.format = 'miniworld-world';
          data.version = 1;
          data.notes = this.worldNotes || [];
          data.savedAt = new Date().toISOString();
          data.playerHint = { coins: this.player.coins, kills: this.player.kills };
          const text = JSON.stringify(data);
          const safe = (this.world.meta.name || 'world').replace(/[\\/:*?"<>|]/g, '');
          MW.download(`${safe}_${Date.now()}.miniworld.json`, text);
          this.ui.toast(`世界已导出 · ${(text.length / 1024 / 1024).toFixed(2)} MB`, 'good');
        } catch (e) {
          console.error(e);
          this.ui.toast('导出失败：' + e.message, 'bad');
        }
      }, 60);
    }

    async importWorldFile(file) {
      if (!file) return;
      const previousState = this.state;
      try {
        const text = await MW.readFile(file);
        const data = JSON.parse(text);
        if (!data || !Array.isArray(data.blocks)) throw new Error('不是有效的世界文件');
        await this.startImportedWorld(data, file.name);
      } catch (e) {
        console.error(e);
        // Validation failures occur before replacing the active world.
        if (this.state !== 'loading') this.state = previousState;
        else this.state = this.world && this.player ? 'playing' : 'menu';
        this.ui.hideLoading();
        if (this.state === 'menu') this.ui.showMenu();
        this.ui.toast('导入失败：' + e.message, 'bad');
      }
    }

    async loadSampleWorld() {
      this.ui.showLoading('示例 · 像素小岛');
      this.ui.setLoading(8, '正在读取世界文件……');
      try {
        const res = await fetch('worlds/sample-island.miniworld.json');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        await this.startImportedWorld(data, '示例小岛');
      } catch (e) {
        this.state = 'menu';
        this.ui.hideLoading();
        this.ui.toast('示例世界加载失败：' + e.message, 'bad');
        this.ui.showMenu();
      }
    }

    async startImportedWorld(data, filename) {
      if (this.state === 'loading') return;
      if (MW.FineBuildTools) MW.FineBuildTools.validateWorldData(data);
      else if (!data || !Array.isArray(data.blocks)) throw Error('世界方块格式无效');
      if (data.fine && MW.FineBuild) {
        const meta = data.meta || {};
        const bounds = Number.isFinite(meta.bounds) && meta.bounds > 0 ? meta.bounds : 80;
        MW.FineBuild.validateSnapshot(data.fine, { meta, bounds,
          minY: meta.minY ?? -6, maxY: meta.maxY ?? 96, revision: 0 });
      }
      this.state = 'loading';
      this.ui.closeAll();
      this.panelOpen = null;
      this.paused = false;
      this.ui.hideVictory();
      this.ui.hideDeath();
      this.ui.showLoading(data.meta && data.meta.name || '导入的世界');
      this.ui.setLoading(6, '正在读取世界文件……');
      await this.nextFrame(80);
      this.disposeWorld();

      const meta = Object.assign({
        name: filename ? filename.replace(/\.miniworld\.json$|\.json$/i, '') : '导入的世界',
        id: 'custom', bounds: 80, spawn: [0, 10, 0],
        sky: 'day', weather: 'clear', season: 'summer', zones: [], vehicles: [], pickups: [], enemyShips: []
      }, data.meta || {});
      this.currentWorldDef = {
        id: 'custom', name: meta.name, icon: '✧', desc: '导入的世界',
        sky: meta.sky, season: meta.season, weather: meta.weather, objective: meta.objective || '自由探索'
      };
      this.world = new MW.VoxelWorld(meta);
      this.scene.add(this.world.group);
      this.bounds = (meta.bounds || 80) - 4;
      this.travelBounds = meta.travelBounds || Math.max(600, (meta.bounds || 80) * 5);
      this.travelBoundsZ = meta.travelBoundsZ || this.travelBounds;
      this.camera.far = meta.drawDistance || (meta.terrain ? 9000 : 1800);
      this.camera.updateProjectionMatrix();
      this.ui.setLoading(35, `正在堆叠 ${data.blocks.length.toLocaleString()} 个方块……`);
      await this.nextFrame();
      this.world.loadSerialized(data);
      this.world.setQuality(this.settings.graphics);
      this.worldNotes = Array.isArray(data.notes) ? data.notes : [];
      this.world.meta.spawn = meta.spawn;
      if (!meta.spawn || meta.spawn[1] == null) {
        meta.spawn = [0, this.world.surfaceAt(0, 0) + 1, 0];
      }
      this.ui.setLoading(88, '正在唤醒这片世界……');
      await this.nextFrame();
      this.setupWorld(this.currentWorldDef);
      this.worldNotes = Array.isArray(data.notes) ? data.notes : [];
      for (const n of this.notes) this.scene.remove(n.mesh);
      this.notes = [];
      for (const note of this.worldNotes) {
        try { this.notes.push(new MW.Entities.NoteMarker(this, note)); } catch (e) {}
      }
      this.ui.hideLoading();
      this.ui.hideMenu();
      this.ui.showHud();
      this.state = 'playing';
      this.setMode('explore', true);
      this.setWeather(meta.weather || 'clear', true);
      this.setSeason(meta.season || 'summer', true);
      this.setSkyPreset(meta.sky || 'day', true);
      this.player.pos.set(meta.spawn[0], meta.spawn[1], meta.spawn[2]);
      this.player.spawnPoint.copy(this.player.pos);
      this.world.prepareAt(this.player.pos.x,this.player.pos.z);
      this.ui.updateAll();
      this.ui.toast('世界文件导入成功', 'good');
    }

    /* =======================================================
       设置 / API
       ======================================================= */
    applySettingsFromUI() {
      const g = id => this.$(id);
      this.settings.playerName = (g('set-name').value || '旅行者').trim().slice(0, 12) || '旅行者';
      this.settings.apiBase = (g('set-api-base').value || '').trim();
      this.settings.apiKey = (g('set-api-key').value || '').trim();
      this.settings.model = (g('set-model').value || 'deepseek-chat').trim();
      this.settings.webSearch = g('set-web').checked;
      this.settings.audio = g('set-audio').checked;
      this.settings.graphics = g('set-graphics').value;
      this.settings.reducedMotion = g('set-motion').checked;
      this.settings.performanceHUD = g('set-performance').checked;
      for (const key of ['master','effects','ambience','engine']) this.settings[key+'Volume']=Number(g('set-volume-'+key).value)/100;
      MW.store.set('settings', this.settings);
      MW.SFX.configure(this.settings);
      this.applyGraphics();
      this.ui.updateName();
      this.ui.setAPIStatus(!!this.settings.apiKey);
      if (this.world) this.saveProgress();
      this.ui.toast('设置已保存', 'good');
    }

    async testAPI() {
      const base = (this.$('set-api-base').value || '').trim().replace(/\/+$/, '');
      const key = (this.$('set-api-key').value || '').trim();
      const model = (this.$('set-model').value || '').trim();
      const out = this.$('api-test-result');
      if (!base || !key) {
        out.textContent = '请填写地址和 Key';
        out.className = 'api-test bad';
        return;
      }
      out.textContent = '测试中……';
      out.className = 'api-test';
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 12000);
        const res = await fetch(base + '/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
          body: JSON.stringify({
            model: model || 'deepseek-chat',
            messages: [{ role: 'user', content: '回复“ok”两个字母，不要其他内容。' }],
            max_tokens: 8, temperature: 0
          }),
          signal: ctrl.signal
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        out.textContent = text ? '连接成功 · ' + String(text).trim().slice(0, 16) : '连接成功';
        out.className = 'api-test ok';
        this.ui.toast('API 连接成功', 'good');
      } catch (e) {
        out.textContent = '失败：' + e.message;
        out.className = 'api-test bad';
      }
    }

    /* =======================================================
       工坊
       ======================================================= */
    equipWeapon(id) {
      if (!this.player) { this.ui.toast('请先进入世界', 'bad'); return; }
      if (this.player.addWeapon(id)) {
        this.ui.toast(`已装备 ${MW.WEAPONS[id].name} · 按 C 进入战斗`, 'good');
        this.ui.updateWeapon();
        this.ui.updateInventory();
      }
    }

    async generateWeaponAI(prompt) {
      if (!prompt || !prompt.trim()) { this.ui.toast('先描述一下想要的武器', 'bad'); return; }
      this.ui.toast('正在设计武器模型……', 'info');
      let data = null;
      if (this.settings.apiKey && this.architect) {
        try {
          data = await this.architect.askJSON(
            `你是像素武器设计师。只输出 JSON：{"name":"武器名","desc":"简述","dmg":30,"rpm":400,"mag":30,"spread":0.02,"range":100,"ammo":"light","color":"#39b8c9","parts":[{"p":[x,y,z],"s":[w,h,d],"c":"#hex"}]}。枪口朝 -Z，原点在握把，零件尺寸单位米，总长 0.6-1.2，颜色不超过 4 种，可加 "glow":true 的发光件。`,
            prompt
          );
        } catch (e) {
          this.ui.toast('API 生成失败，使用本地生成器', 'info');
        }
      }
      if (!data || !Array.isArray(data.parts)) data = this.localWeaponModel(prompt);
      const id = 'custom_' + Date.now().toString(36);
      const def = {
        id,
        name: (data.name || '实验武器').slice(0, 18),
        short: (data.name || '实验').slice(0, 6),
        kind: 'gun',
        slot: 1,
        dmg: MW.clamp(Number(data.dmg) || 30, 5, 200),
        pellets: 1,
        rpm: MW.clamp(Number(data.rpm) || 420, 60, 1400),
        auto: Number(data.rpm) > 300,
        mag: MW.clamp(Math.round(Number(data.mag) || 24), 1, 200),
        reserve: 120,
        spread: MW.clamp(Number(data.spread) || 0.02, 0, 0.2),
        range: MW.clamp(Number(data.range) || 100, 20, 250),
        reload: 1.8,
        ammo: ['light', 'heavy', 'shell', 'rocket'].includes(data.ammo) ? data.ammo : 'light',
        color: data.color || '#5eead4',
        desc: (data.desc || 'AI 设计的实验武器。').slice(0, 60),
        tier: 3,
        view: this.normalizeWeaponParts(data.parts),
        muzzle: [0, 0.02, -0.8],
        custom: true
      };
      if (!def.view.length) def.view = this.localWeaponModel(prompt).parts;
      MW.WEAPONS[id] = def;
      this.customWeapons.push(def);
      MW.store.set('customWeapons', this.customWeapons);
      this.ui.refreshWorkshop();
      this.ui.toast(`新武器「${def.name}」已加入工坊`, 'good');
      return def;
    }

    normalizeWeaponParts(parts) {
      const out = [];
      for (const p of parts || []) {
        if (!p || !Array.isArray(p.p) || !Array.isArray(p.s)) continue;
        out.push({
          p: p.p.map(v => MW.clamp(Number(v) || 0, -1.4, 1.4)),
          s: p.s.map(v => MW.clamp(Number(v) || 0.05, 0.01, 1.2)),
          c: MW.parseColor(p.c, 0x555b63),
          glow: !!p.glow
        });
        if (out.length > 40) break;
      }
      return out;
    }

    localWeaponModel(prompt) {
      const s = (prompt || '').toLowerCase();
      const isLaser = /激光|能量|电磁|轨道|光子|等离子/.test(s);
      const isHeavy = /重|机枪|加特林|火箭|炮/.test(s);
      const isSniper = /狙|长|精确|轨道/.test(s);
      const color = isLaser ? 0x39b8c9 : isHeavy ? 0xb0632f : 0x4a5560;
      const glow = isLaser ? 0x64f0ff : 0xffb347;
      const len = isSniper ? 0.95 : isHeavy ? 0.75 : 0.58;
      const parts = [
        { p: [0, 0, -len * 0.4], s: [0.1, 0.14, len], c: color },
        { p: [0, 0.02, -len * 0.95], s: [0.05, 0.05, 0.36], c: MW.shade(color, -0.25) },
        { p: [0, -0.13, -len * 0.25], s: [0.07, 0.19, 0.1], c: MW.shade(color, -0.35) },
        { p: [0, 0.12, -len * 0.3], s: [0.08, 0.06, 0.26], c: MW.shade(color, 0.15) },
        { p: [0, 0.02, -len * 1.05], s: [0.03, 0.03, 0.14], c: glow, glow: true },
        { p: [0, -0.02, len * 0.16], s: [0.08, 0.11, 0.22], c: MW.shade(color, -0.2) }
      ];
      if (isHeavy) {
        for (let i = -1; i <= 1; i++) {
          parts.push({ p: [i * 0.045, 0.02, -len * 0.85], s: [0.035, 0.035, 0.5], c: 0x24272b });
        }
      }
      if (isSniper) {
        parts.push({ p: [0, 0.17, -len * 0.38], s: [0.06, 0.06, 0.34], c: 0x14181a });
        parts.push({ p: [0, 0.17, -len * 0.52], s: [0.09, 0.09, 0.05], c: glow, glow: true });
      }
      return {
        name: isLaser ? 'ZX 实验激光枪' : isHeavy ? '重装支援武器' : isSniper ? '精确射手步枪' : '实验型步枪',
        desc: '本地生成器根据描述拼装的方块武器。',
        dmg: isSniper ? 120 : isHeavy ? 22 : isLaser ? 48 : 30,
        rpm: isHeavy ? 900 : isSniper ? 60 : isLaser ? 240 : 420,
        mag: isHeavy ? 100 : isSniper ? 6 : isLaser ? 30 : 30,
        spread: isSniper ? 0.002 : isHeavy ? 0.06 : isLaser ? 0.005 : 0.02,
        range: isSniper ? 220 : 110,
        ammo: isHeavy ? 'heavy' : 'light',
        color: '#' + color.toString(16).padStart(6, '0'),
        parts
      };
    }

    importWeaponData(data) {
      if (!data || !Array.isArray(data.view) && !Array.isArray(data.parts)) throw new Error('缺少 view/parts 零件数组');
      const id = data.id && !MW.WEAPONS[data.id] ? data.id : 'imported_' + Date.now().toString(36);
      const def = Object.assign({
        id, name: '导入武器', short: '导入', kind: 'gun', slot: 1,
        dmg: 30, pellets: 1, rpm: 400, auto: true, mag: 30, reserve: 120,
        spread: 0.02, range: 100, reload: 1.8, ammo: 'light',
        color: '#9aa3a8', desc: '从文件导入的武器模型。', tier: 3
      }, data, { id });
      def.view = this.normalizeWeaponParts(data.view || data.parts);
      if (!def.view.length) throw new Error('零件为空');
      def.muzzle = Array.isArray(data.muzzle) ? data.muzzle : [0, 0.02, -0.8];
      MW.WEAPONS[id] = def;
      if (!this.customWeapons.find(w => w.id === id)) {
        this.customWeapons.push(def);
        MW.store.set('customWeapons', this.customWeapons);
      }
      this.ui.refreshWorkshop();
      this.ui.toast(`已导入武器「${def.name}」`, 'good');
      return def;
    }

    exportWeapon(id) {
      const def = MW.WEAPONS[id];
      if (!def) return;
      const data = {
        format: 'miniworld-weapon',
        version: 1,
        id: def.id, name: def.name, desc: def.desc,
        dmg: def.dmg, rpm: def.rpm, mag: def.mag, spread: def.spread,
        range: def.range, ammo: def.ammo, color: def.color,
        view: def.view, muzzle: def.muzzle
      };
      MW.download(`${def.name.replace(/[\\/:*?"<>|]/g, '')}.weapon.json`, JSON.stringify(data, null, 2));
      this.ui.toast('武器模型已导出', 'good');
    }

    applyPlayerSkin(spec) {
      if (!spec) return;
      this.customPlayerSkin = spec;
      MW.store.set('playerSkin', spec);
      if (this.player) {
        this.scene.remove(this.player.avatar.group);
        const oldVm = this.player.vmHolder;
        const parent = oldVm ? oldVm.parent : this.camera;
        this.player.avatar = MW.Models.character(Object.assign({}, MW.CHARACTERS.player, spec));
        this.player.avatar.group.visible = this.player.thirdPerson;
        this.scene.add(this.player.avatar.group);
      }
      this.ui.toast('人物皮肤已应用', 'good');
    }

    /* =======================================================
       工具
       ======================================================= */
    applyDebugSpawn() {
      try {
        const q = new URLSearchParams(location.search);
        if (!this.player) return;
        if (q.has('x')) this.player.pos.x = Number(q.get('x')) || 0;
        if (q.has('z')) this.player.pos.z = Number(q.get('z')) || 0;
        if (q.has('y')) this.player.pos.y = Number(q.get('y')) || this.player.pos.y;
        else if (q.has('x') || q.has('z')) {
          this.player.pos.y = this.world.surfaceAt(this.player.pos.x, this.player.pos.z) + 0.2;
        }
        if (q.has('yaw')) this.player.yaw = Number(q.get('yaw')) || 0;
        if (q.has('pitch')) this.player.pitch = Number(q.get('pitch')) || 0;
        if (q.get('third') === '1') this.player.thirdPerson = true;
        this.player.spawnPoint.copy(this.player.pos);
      } catch (e) {}
    }

    nextFrame(delay) {
      return new Promise(resolve => {
        const done = () => requestAnimationFrame(() => resolve());
        if (delay) setTimeout(done, delay);
        else requestAnimationFrame(done);
      });
    }
  }

  MW.Game = Game;
  MW.BUILD_COLORS = BUILD_COLORS;

  function boot() {
    try {
      const params = new URLSearchParams(location.search);
      if (params.get('reset') === '1') {
        try {
          Object.keys(localStorage).filter(k => k.indexOf('mw_') === 0).forEach(k => localStorage.removeItem(k));
        } catch (e) {}
        location.replace(location.pathname);
        return;
      }
      window.MW.game = new Game();
      const auto = params.get('world');
      if (auto) {
        setTimeout(() => {
          if (MW.WORLDS.some(w => w.id === auto)) window.MW.game.startWorld(auto);
        }, 120);
      }
    } catch (e) {
      console.error('启动失败', e);
      const el = document.getElementById('menu-status');
      if (el) { el.textContent = '启动失败：' + e.message; el.style.color = '#ff6b5a'; }
      const host = document.getElementById('world-grid');
      if (host) {
        const notice = document.createElement('section'); notice.className='graphics-notice'; notice.setAttribute('role','alert');
        const heading=document.createElement('h3'); heading.textContent='当前浏览器无法启动 3D 图形';
        const text=document.createElement('p'); text.textContent='请在支持 WebGL 的桌面浏览器中打开，并在浏览器设置中启用硬件加速。远程预览、部分虚拟机或禁用 GPU 的环境可能不支持 3D 游戏。';
        const detail=document.createElement('p'); detail.textContent=e.message; detail.className='field-note';
        const retry=document.createElement('button'); retry.className='btn primary'; retry.textContent='重新尝试';retry.addEventListener('click',()=>location.reload());
        notice.append(heading,text,detail,retry);host.replaceChildren(notice);
      }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
