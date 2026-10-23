/* ============================================================
   audio.js — 纯 WebAudio 合成音效（无外部资源）
   ============================================================ */
(function () {
  'use strict';
  const FD = window.FD;

  const A = {
    ctx: null,
    master: null,
    muted: false,
    ready: false,

    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch (e) { return; }
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);

      // 推进器噪声
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      const src = this.ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.7;
      this.thrustGain = this.ctx.createGain();
      this.thrustGain.gain.value = 0;
      src.connect(bp); bp.connect(this.thrustGain); this.thrustGain.connect(this.master);
      src.start();

      // 环境低鸣
      this.padGain = this.ctx.createGain();
      this.padGain.gain.value = 0.0;
      const o1 = this.ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 55;
      const o2 = this.ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 82.5;
      const og = this.ctx.createGain(); og.gain.value = 0.5;
      o1.connect(og); o2.connect(og); og.connect(this.padGain); this.padGain.connect(this.master);
      o1.start(); o2.start();
      this.padOsc = [o1, o2];
      this.ready = true;
    },

    resume() {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },

    setMuted(m) {
      this.muted = m;
      if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.05);
    },

    thrust(level) {
      if (!this.ready || this.muted) return;
      this.thrustGain.gain.setTargetAtTime(level * 0.16, this.ctx.currentTime, 0.06);
    },

    pad(level) {
      if (!this.ready || this.muted) return;
      this.padGain.gain.setTargetAtTime(level * 0.05, this.ctx.currentTime, 0.4);
    },

    tone(freq, dur, type, gain, slideTo) {
      if (!this.ready || this.muted) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain || 0.12, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    },

    noise(dur, filtFreq, gain, sweepTo) {
      if (!this.ready || this.muted) return;
      const t = this.ctx.currentTime;
      const s = this.ctx.createBufferSource();
      s.buffer = this.noiseBuf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.setValueAtTime(filtFreq, t); f.Q.value = 1.1;
      if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(this.master);
      s.start(t); s.stop(t + dur + 0.05);
    },

    sfx(name) {
      if (!this.ready || this.muted) return;
      switch (name) {
        case 'seed':
          this.tone(880, 0.16, 'triangle', 0.14, 1320);
          this.tone(1320, 0.22, 'sine', 0.06, 1760);
          break;
        case 'slip':
          this.noise(0.34, 300, 0.16, 2400);
          this.tone(180, 0.28, 'sawtooth', 0.05, 90);
          break;
        case 'flip':
          this.tone(420, 0.1, 'square', 0.05, 300);
          break;
        case 'deny':
          this.tone(150, 0.2, 'sawtooth', 0.07, 90);
          break;
        case 'hurt':
          this.noise(0.3, 900, 0.1, 200);
          this.tone(90, 0.3, 'sawtooth', 0.06, 50);
          break;
        case 'gateOn':
          [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.5, 'sine', 0.09), i * 80));
          break;
        case 'gateCharge':
          this.tone(660, 0.08, 'sine', 0.05);
          break;
        case 'complete':
          [392, 523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.7, 'triangle', 0.1), i * 110));
          break;
        case 'die':
          this.tone(220, 0.7, 'sawtooth', 0.09, 40);
          this.noise(0.6, 600, 0.09, 80);
          break;
        case 'ui':
          this.tone(1200, 0.05, 'sine', 0.04);
          break;
      }
    }
  };

  FD.Audio = A;
})();
