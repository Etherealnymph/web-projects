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
    }

    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.55 : 0;
      this.master.connect(this.ctx.destination);

      const len = this.ctx.sampleRate * 1.2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }

    get ok() { return this.ctx && this.enabled; }

    noise(dur, filterType, freq, gain, pan) {
      if (!this.ok) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const f = this.ctx.createBiquadFilter();
      f.type = filterType || 'lowpass';
      f.frequency.value = freq || 1200;
      const g = this.ctx.createGain();
      const t = this.ctx.currentTime;
      g.gain.setValueAtTime(gain == null ? 0.3 : gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const p = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
      if (p && pan) p.pan.value = pan;
      src.connect(f); f.connect(g);
      if (p) { g.connect(p); p.connect(this.master); } else { g.connect(this.master); }
      src.start(t);
      src.stop(t + dur + 0.02);
    }

    tone(freq, dur, type, gain, slideTo, pan) {
      if (!this.ok) return;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const t = this.ctx.currentTime;
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(gain == null ? 0.2 : gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const p = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
      if (p && pan) { p.pan.value = pan; o.connect(g); g.connect(p); p.connect(this.master); }
      else { o.connect(g); g.connect(this.master); }
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

    explosion(size) {
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
    growl() { this.tone(90 + Math.random() * 40, 0.5, 'sawtooth', 0.14, 55); }
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
      this.noise(0.045, 'lowpass', 900, 0.05);
    }
    toggle(on) {
      this.enabled = on;
      if (this.master) this.master.gain.value = on ? 0.55 : 0;
    }
  }

  MW.SFX = new SFX();
})();
