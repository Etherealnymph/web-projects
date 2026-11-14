/* ===========================================================
   工具函数
   =========================================================== */
(function () {
  const MW = window.MW;

  MW.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  MW.lerp = (a, b, t) => a + (b - a) * t;
  MW.smoothstep = t => t * t * (3 - 2 * t);
  MW.easeOut = t => 1 - Math.pow(1 - t, 3);

  MW.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  MW.pick = (arr, rnd) => arr[Math.floor((rnd ? rnd() : Math.random()) * arr.length) % arr.length];

  MW.uid = (prefix) => (prefix || 'id') + '_' + Date.now().toString(36) + Math.floor(Math.random() * 1e5).toString(36);

  MW.nowStamp = () => {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  /* 颜色工具 */
  MW.hexToCss = (c) => '#' + (c >>> 0 & 0xffffff).toString(16).padStart(6, '0');

  MW.parseColor = (v, fallback = 0x888888) => {
    if (typeof v === 'number') return v >>> 0 & 0xffffff;
    if (typeof v === 'string') {
      let s = v.trim();
      if (s[0] === '#') s = s.slice(1);
      if (/^[0-9a-f]{6}$/i.test(s)) return parseInt(s, 16);
      if (/^[0-9a-f]{3}$/i.test(s)) return parseInt(s.split('').map(x => x + x).join(''), 16);
      const named = { red: 0xcc3333, gold: 0xd8a531, white: 0xeeeeee, stone: 0x888888, wood: 0x7b5230 };
      if (named[s.toLowerCase()]) return named[s.toLowerCase()];
    }
    return fallback;
  };

  MW.shade = (color, amount) => {
    const r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255;
    const f = 1 + amount;
    return (MW.clamp(Math.round(r * f), 0, 255) << 16) |
      (MW.clamp(Math.round(g * f), 0, 255) << 8) |
      MW.clamp(Math.round(b * f), 0, 255);
  };

  MW.mixColor = (a, b, t) => {
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    return (Math.round(ar + (br - ar) * t) << 16) |
      (Math.round(ag + (bg - ag) * t) << 8) |
      Math.round(ab + (bb - ab) * t);
  };

  MW.shadeCSS = (hex, amount) => MW.hexToCss(MW.shade(MW.parseColor(hex), amount));

  /* 噪声 */
  MW.makeNoise2D = function (seed) {
    const rnd = MW.rng(seed);
    const perm = new Uint8Array(512);
    const vals = new Float32Array(256);
    for (let i = 0; i < 256; i++) { perm[i] = i; vals[i] = rnd(); }
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
    const val = (x, y) => vals[perm[(x & 255)] ^ perm[(y & 255)]];

    return function (x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const a = val(xi, yi), b = val(xi + 1, yi), c = val(xi, yi + 1), d = val(xi + 1, yi + 1);
      return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
    };
  };

  MW.fbm = function (noise, x, y, octaves = 4, persistence = 0.5, lacunarity = 2) {
    let total = 0, amp = 1, freq = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
      total += noise(x * freq, y * freq) * amp;
      norm += amp;
      amp *= persistence;
      freq *= lacunarity;
    }
    return total / norm;
  };

  /* 存储 */
  MW.store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem('mw_' + key);
        if (raw == null) return fallback;
        return JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('mw_' + key, JSON.stringify(value)); return true; }
      catch (e) { console.warn('存储失败', e); return false; }
    },
    remove(key) {
      try { localStorage.removeItem('mw_' + key); } catch (e) {}
    }
  };

  MW.download = function (filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
  };

  MW.readFile = function (file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsText(file);
    });
  };

  MW.timeText = (seconds) => {
    const m = Math.floor(seconds / 60), s = Math.floor(seconds % 60);
    return m + ':' + String(s).padStart(2, '0');
  };

  MW.escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  MW.debounce = function (fn, ms) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  };

  MW.segmentPointDistance = function (ax, ay, az, bx, by, bz, px, py, pz) {
    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const len2 = abx * abx + aby * aby + abz * abz || 1;
    let t = ((px - ax) * abx + (py - ay) * aby + (pz - az) * abz) / len2;
    t = MW.clamp(t, 0, 1);
    const dx = px - (ax + abx * t), dy = py - (ay + aby * t), dz = pz - (az + abz * t);
    return { dist: Math.sqrt(dx * dx + dy * dy + dz * dz), t };
  };
})();
