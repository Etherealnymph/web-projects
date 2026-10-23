/* ============================================================
   core.js — 向量数学 / 工具
   ============================================================ */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});

  FD.TAU = Math.PI * 2;
  FD.clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  FD.lerp = (a, b, t) => a + (b - a) * t;
  FD.smoothstep = (e0, e1, x) => {
    const t = FD.clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  FD.approach = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  FD.fmt = (v, n = 3) => (Math.abs(v) < 5e-4 && v !== 0 ? (v < 0 ? '-0.000' : '0.000') : v.toFixed(n));

  const V = {
    mk(x, y, z) { return { x: x || 0, y: y || 0, z: z || 0 }; },
    set(o, x, y, z) { o.x = x; o.y = y; o.z = z; return o; },
    copy(o, a) { o.x = a.x; o.y = a.y; o.z = a.z; return o; },
    from(a) { return { x: a[0], y: a[1], z: a[2] }; },
    arr(a) { return [a.x, a.y, a.z]; },
    add(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; },
    sub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; },
    mul(a, s) { return { x: a.x * s, y: a.y * s, z: a.z * s }; },
    addS(a, b, s) { return { x: a.x + b.x * s, y: a.y + b.y * s, z: a.z + b.z * s }; },
    dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; },
    cross(a, b) {
      return {
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x
      };
    },
    len(a) { return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z); },
    len2(a) { return a.x * a.x + a.y * a.y + a.z * a.z; },
    dist(a, b) { const x = a.x - b.x, y = a.y - b.y, z = a.z - b.z; return Math.sqrt(x * x + y * y + z * z); },
    dist2(a, b) { const x = a.x - b.x, y = a.y - b.y, z = a.z - b.z; return x * x + y * y + z * z; },
    norm(a) {
      const l = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z) || 1;
      return { x: a.x / l, y: a.y / l, z: a.z / l };
    },
    neg(a) { return { x: -a.x, y: -a.y, z: -a.z }; },
    lerp(a, b, t) {
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
    },
    // 原地版本（热路径）
    iadd(o, a, b) { o.x = a.x + b.x; o.y = a.y + b.y; o.z = a.z + b.z; return o; },
    isub(o, a, b) { o.x = a.x - b.x; o.y = a.y - b.y; o.z = a.z - b.z; return o; },
    imul(o, a, s) { o.x = a.x * s; o.y = a.y * s; o.z = a.z * s; return o; },
    iaddS(o, a, b, s) { o.x = a.x + b.x * s; o.y = a.y + b.y * s; o.z = a.z + b.z * s; return o; },
    icopy(o, a) { o.x = a.x; o.y = a.y; o.z = a.z; return o; },
    iset(o, x, y, z) { o.x = x; o.y = y; o.z = z; return o; },
    // 任意垂直向量
    perp(a) {
      const ax = Math.abs(a.x), ay = Math.abs(a.y), az = Math.abs(a.z);
      let u;
      if (ax <= ay && ax <= az) u = { x: 0, y: -a.z, z: a.y };
      else if (ay <= az) u = { x: -a.z, y: 0, z: a.x };
      else u = { x: -a.y, y: a.x, z: 0 };
      return V.norm(u);
    }
  };
  FD.V = V;

  /* ---------- 确定性随机 ---------- */
  FD.mulberry = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* ---------- 球面均匀采样（Fibonacci） ---------- */
  FD.fibSphere = function (n) {
    const pts = [], ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (i + 0.5) * 2 / n;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const th = ga * i;
      pts.push({ x: Math.cos(th) * r, y: y, z: Math.sin(th) * r });
    }
    return pts;
  };

  /* ---------- 颜色 ---------- */
  FD.hsl = function (h, s, l, a) {
    return 'hsla(' + h + ',' + s + '%,' + l + '%,' + a + ')';
  };
  FD.mixColor = function (c1, c2, t) {
    // c = [r,g,b]
    return [
      Math.round(c1[0] + (c2[0] - c1[0]) * t),
      Math.round(c1[1] + (c2[1] - c1[1]) * t),
      Math.round(c1[2] + (c2[2] - c1[2]) * t)
    ];
  };
  FD.rgba = function (c, a) {
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  };

  /* ---------- 数值收敛到 0 的格式化 ---------- */
  FD.sgn = (x) => (x < 0 ? '−' : '+');
})();
