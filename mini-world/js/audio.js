/* ===========================================================
   WebAudio 合成音效
   =========================================================== */
(function () {
  const MW = window.MW;

  class SFX {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.enabled = true;
      this.noiseBuffer = null;
      this.lastFoot = 0;
      this.volumes = { master: 0.65, effects: 0.8, ambience: 0.35, engine: 0.45 };
      this.voices = new Set();
      this.maxVoices = 40;
      this.listener = { x: 0, y: 0, z: 0, yaw: 0 };
      this.spatial = null;
      this.loops = null;
    }

    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume().catch(() => {});
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC({ latencyHint: 'interactive' }); } catch (_) { return; }
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? this.volumes.master : 0;
      this.effects = this.ctx.createGain();
      this.effects.gain.value = this.volumes.effects;
      this.effects.connect(this.master);
      this.limiter = this.ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -12;
      this.limiter.knee.value = 12;
      this.limiter.ratio.value = 8;
      this.limiter.attack.value = 0.003;
      this.limiter.release.value = 0.18;
      this.master.connect(this.limiter);
      this.limiter.connect(this.ctx.destination);

      const len = this.ctx.sampleRate * 3;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
      this.createLoops();
    }

    get ok() { return this.ctx && this.enabled && this.ctx.state === 'running' && !document.hidden; }

    configure(settings) {
      this.enabled = settings.audio !== false;
      for (const key of Object.keys(this.volumes)) {
        const value = settings[key + 'Volume'];
        if (Number.isFinite(value)) this.volumes[key] = MW.clamp(value, 0, 1);
      }
      if (this.master) {
        this.master.gain.setTargetAtTime(this.enabled ? this.volumes.master : 0, this.ctx.currentTime, 0.04);
        this.effects.gain.setTargetAtTime(this.volumes.effects, this.ctx.currentTime, 0.04);
      }
    }

    // Sources have a hard cap and disconnect on completion, even during rapid fire.
    track(source, nodes) {
      this.voices.add(source);
      source.onended = () => {
        this.voices.delete(source);
        source.disconnect();
        nodes.forEach(node => node.disconnect());
      };
    }

    at(position, callback) {
      const prev = this.spatial;
      if (position) {
        const l = this.listener, dx = position.x - l.x, dy = position.y - l.y, dz = position.z - l.z;
        const d = Math.hypot(dx, dy, dz);
        if (d > 650) return;
        this.spatial = { gain: 1 / Math.pow(1 + d / 32, 1.4), pan: MW.clamp((dx * Math.cos(l.yaw) - dz * Math.sin(l.yaw)) / Math.max(1, d), -1, 1) };
      }
      try { callback(); } finally { this.spatial = prev; }
    }

    createLoops() {
      const ctx = this.ctx;
      const ambient = ctx.createBufferSource();
      ambient.buffer = this.noiseBuffer; ambient.loop = true;
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 650;
      const gain = ctx.createGain(); gain.gain.value = 0;
      ambient.connect(filter); filter.connect(gain); gain.connect(this.master); ambient.start();
      const engine = ctx.createOscillator(); engine.type = 'triangle'; engine.frequency.value = 48;
      const engineGain = ctx.createGain(); engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 450;
      engine.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(this.master); engine.start();
      this.loops = { ambient, filter, gain, engine, engineGain, engineFilter };
    }

    update(game) {
      if (!this.ctx || !this.loops) return;
      const active = this.enabled && game.state === 'playing' && !game.panelOpen && !game.paused && !game.intro && !document.hidden;
      const t = this.ctx.currentTime, loops = this.loops;
      if (game.player) {
        Object.assign(this.listener, game.player.pos, { yaw: game.player.yaw });
        this.surface = game.player.inWater ? 'water' : game.world?.mapSampleAt?.(game.player.pos.x, game.player.pos.z)?.surface || 'ground';
      }
      const wet = game.weather === 'rain' || game.weather === 'storm';
      const sea = game.player?.inWater;
      loops.filter.frequency.setTargetAtTime(sea ? 320 : wet ? 2600 : 550, t, 0.3);
      loops.gain.gain.setTargetAtTime(active ? this.volumes.ambience * (wet ? 0.11 : sea ? 0.09 : 0.025) : 0, t, 0.15);
      const v = game.inVehicle;
      const ratio = v ? Math.min(1.6, Math.abs(v.currentSpeed || 0) / Math.max(1, v.speed || 20)) : 0;
      const freq = v?.type === 'jet' ? 100 + ratio * 210 : v?.type === 'drone' ? 115 + ratio * 100 : 35 + ratio * 85;
      loops.engine.frequency.setTargetAtTime(freq, t, 0.1);
      loops.engineFilter.frequency.setTargetAtTime(250 + ratio * 600, t, 0.2);
      loops.engineGain.gain.setTargetAtTime(active && v ? this.volumes.engine * (0.06 + ratio * 0.11) : 0, t, 0.1);
    }

    suspend() { if (this.ctx?.state === 'running') this.ctx.suspend().catch(() => {}); }

    stopLoops() {
      if (!this.ctx || !this.loops) return;
      this.loops.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
      this.loops.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
    }

    noise(dur, filterType, freq, gain, pan) {
      if (!this.ok || this.voices.size >= this.maxVoices) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const f = this.ctx.createBiquadFilter();
      f.type = filterType || 'lowpass';
      f.frequency.value = freq || 1200;
      const g = this.ctx.createGain();
      const t = this.ctx.currentTime;
      const volume = (gain == null ? 0.3 : gain) * (this.spatial?.gain ?? 1);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(Math.max(0.0001, volume), t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const p = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
      if (p) p.pan.value = this.spatial?.pan ?? pan ?? 0;
      src.connect(f); f.connect(g);
      if (p) { g.connect(p); p.connect(this.effects); } else { g.connect(this.effects); }
      src.loop = true;
      this.track(src, [f, g, ...(p ? [p] : [])]);
      src.start(t, Math.random() * 0.5);
      src.stop(t + dur + 0.02);
    }

    tone(freq, dur, type, gain, slideTo, pan) {
      if (!this.ok || this.voices.size >= this.maxVoices) return;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const t = this.ctx.currentTime;
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      const volume = (gain == null ? 0.2 : gain) * (this.spatial?.gain ?? 1);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(Math.max(0.0001, volume), t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const p = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
      if (p) { p.pan.value = this.spatial?.pan ?? pan ?? 0; o.connect(g); g.connect(p); p.connect(this.effects); }
      else { o.connect(g); g.connect(this.effects); }
      this.track(o, [g, ...(p ? [p] : [])]);
      o.start(t);
      o.stop(t + dur + 0.02);
    }

    shoot(weaponId, far) {
      if (!this.ok) return;
      const w = MW.WEAPONS[weaponId] || {};
      const vol = far ? 0.14 : 0.42;
      if (w.kind === 'launcher') {
        this.noise(0.35, 'lowpass', 700, 0.5);
        this.tone(90, 0.4, 'sawtooth', 0.25, 40);
        return;
      }
      switch (weaponId) {
        case 'pistol':
          this.noise(0.08, 'bandpass', 1800, vol);
          this.tone(180, 0.08, 'square', 0.12, 80);
          break;
        case 'sniper':
          this.noise(0.22, 'lowpass', 2600, vol + 0.1);
          this.tone(120, 0.25, 'sawtooth', 0.2, 40);
          break;
        case 'shotgun':
          this.noise(0.28, 'lowpass', 1400, vol + 0.12);
          this.tone(95, 0.25, 'square', 0.18, 35);
          break;
        case 'minigun':
          this.noise(0.05, 'bandpass', 2400, vol - 0.08);
          break;
        case 'laser':
          this.tone(1400, 0.12, 'sawtooth', 0.12, 220);
          this.noise(0.06, 'highpass', 3000, 0.08);
          break;
        default:
          this.noise(0.1, 'bandpass', 2100, vol);
          this.tone(150, 0.09, 'square', 0.09, 55);
      }
    }

    explosion(size, position) {
      if (position) return this.at(position, () => this.explosion(size));
      if (!this.ok) return;
      const s = MW.clamp(size || 1, 0.6, 2.5);
      this.noise(0.9 * s, 'lowpass', 500, 0.75);
      this.tone(70 * (1 / s), 0.8 * s, 'sine', 0.45, 24);
      this.tone(160, 0.25, 'sawtooth', 0.2, 30);
    }

    hit() { this.tone(880, 0.05, 'square', 0.1, 1200); }
    headshot() { this.tone(1400, 0.08, 'square', 0.14, 1800); this.tone(900, 0.1, 'sine', 0.1, 1400); }
    kill() { this.tone(220, 0.18, 'triangle', 0.14, 440); this.tone(440, 0.2, 'sine', 0.1, 660); }
    pickup() { this.tone(660, 0.07, 'sine', 0.15, 990); this.tone(990, 0.1, 'sine', 0.1, 1320); }
    reload() {
      this.noise(0.05, 'highpass', 2400, 0.14);
      setTimeout(() => this.noise(0.05, 'highpass', 1800, 0.12), 120);
    }
    click() { this.tone(520, 0.035, 'square', 0.06, 660); }
    deny() { this.tone(180, 0.12, 'square', 0.1, 110); }
    hurt() { this.noise(0.12, 'lowpass', 600, 0.28); this.tone(140, 0.18, 'sawtooth', 0.12, 70); }
    death() { this.tone(160, 0.6, 'sawtooth', 0.25, 40); this.noise(0.5, 'lowpass', 500, 0.25); }
    growl(position) { this.at(position, () => this.tone(90 + Math.random() * 40, 0.5, 'sawtooth', 0.1, 55)); }
    thunder() {
      if (!this.ok) return;
      this.noise(1.6, 'lowpass', 320, 0.55);
      this.tone(48, 1.4, 'sine', 0.3, 28);
    }
    build() { this.tone(300, 0.12, 'triangle', 0.08, 600); }
    splash() { this.noise(0.25, 'highpass', 900, 0.2); }
    uiHover() { this.tone(720, 0.025, 'sine', 0.03); }
    footstep() {
      if (!this.ok) return;
      const now = performance.now();
      if (now - this.lastFoot < 260) return;
      this.lastFoot = now;
      const water = this.surface === 'water';
      this.noise(water ? 0.13 : 0.055, 'lowpass', water ? 1900 : 650 + Math.random() * 300, water ? 0.07 : 0.055);
      if (!water) this.tone(65 + Math.random() * 20, 0.045, 'sine', 0.035, 38);
    }
    toggle(on) {
      this.enabled = on;
      if (this.master) this.master.gain.setTargetAtTime(on ? this.volumes.master : 0, this.ctx.currentTime, 0.04);
    }
  }

  MW.SFX = new SFX();
})();
