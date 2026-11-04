/* ============================================================
   render.js — 手写透视投影 3D 渲染（Canvas 2D，无依赖）
   ============================================================ */
(function () {
  'use strict';
  const FD = window.FD, V = FD.V;
  const clamp = FD.clamp, lerp = FD.lerp;

  const R = {
    cv: null, ctx: null,
    W: 1, H: 1, dpr: 1, f: 1,
    near: 0.22,
    cam: {
      pos: V.mk(0, 0, -12),
      fwd: V.mk(0, 0, 1),
      right: V.mk(1, 0, 0),
      up: V.mk(0, 1, 0),
      yaw: 0, pitch: -0.12, dist: 8.4, fov: 66 * Math.PI / 180
    },
    shake: 0,
    _p: { x: 0, y: 0, z: 0 }
  };

  R.init = function (cv) {
    R.cv = cv;
    R.ctx = cv.getContext('2d', { alpha: false });
    R.resize();
    window.addEventListener('resize', R.resize);
  };

  R.resize = function () {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(3000000 / Math.max(1, window.innerWidth * window.innerHeight)));
    R.dpr = dpr;
    R.W = Math.floor(window.innerWidth);
    R.H = Math.floor(window.innerHeight);
    R.cv.width = Math.floor(R.W * dpr);
    R.cv.height = Math.floor(R.H * dpr);
    R.cv.style.width = R.W + 'px';
    R.cv.style.height = R.H + 'px';
    R.f = (R.H * 0.5) / Math.tan(R.cam.fov * 0.5);
    R.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 背景缓存
    const g = R.ctx.createRadialGradient(R.W * 0.5, R.H * 0.46, 0, R.W * 0.5, R.H * 0.5, Math.max(R.W, R.H) * 0.78);
    g.addColorStop(0, '#0a1828');
    g.addColorStop(0.45, '#060d18');
    g.addColorStop(1, '#02040a');
    R.bg = g;
  };

  /* ---------------- 相机 ---------------- */
  R.updateCamera = function (target, dt) {
    const c = R.cam;
    const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    c.fwd.x = Math.sin(c.yaw) * cp;
    c.fwd.y = sp;
    c.fwd.z = Math.cos(c.yaw) * cp;
    c.right = V.norm(V.cross(V.mk(0, 1, 0), c.fwd));
    c.up = V.cross(c.fwd, c.right);

    const want = {
      x: target.x - c.fwd.x * c.dist,
      y: target.y - c.fwd.y * c.dist,
      z: target.z - c.fwd.z * c.dist
    };
    const k = 1 - Math.exp(-7.5 * dt);
    c.pos.x += (want.x - c.pos.x) * k;
    c.pos.y += (want.y - c.pos.y) * k;
    c.pos.z += (want.z - c.pos.z) * k;

    if (R.shake > 0.001) {
      const s = R.shake * 0.5;
      c.pos.x += (Math.random() - 0.5) * s;
      c.pos.y += (Math.random() - 0.5) * s;
      c.pos.z += (Math.random() - 0.5) * s;
      R.shake *= Math.exp(-6 * dt);
    }
  };

  R.snapCamera = function () {
    const c = R.cam;
    c.pos.x = R._tgt.x - c.fwd.x * c.dist;
    c.pos.y = R._tgt.y - c.fwd.y * c.dist;
    c.pos.z = R._tgt.z - c.fwd.z * c.dist;
  };

  /* 投影：返回深度，写入 out；不可见返回 -1 */
  function proj(x, y, z, out) {
    const c = R.cam;
    const dx = x - c.pos.x, dy = y - c.pos.y, dz = z - c.pos.z;
    const zc = dx * c.fwd.x + dy * c.fwd.y + dz * c.fwd.z;
    if (zc <= R.near) return -1;
    const f = R.f / zc;
    out.x = R.W * 0.5 + (dx * c.right.x + dy * c.right.y + dz * c.right.z) * f;
    out.y = R.H * 0.5 - (dx * c.up.x + dy * c.up.y + dz * c.up.z) * f;
    out.z = zc;
    return zc;
  }
  R.proj = proj;

  R.projectWorld = function (p) {
    const o = { x: 0, y: 0, z: 0 };
    const d = proj(p.x, p.y, p.z, o);
    return d < 0 ? null : o;
  };

  /* ---------------- 通用绘制助手 ---------------- */
  const _a = { x: 0, y: 0, z: 0 }, _b = { x: 0, y: 0, z: 0 };

  function strokeGlow(path, color, w, alpha) {
    const ctx = R.ctx;
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha * 0.10;
    ctx.lineWidth = w * 5.2;
    ctx.stroke(path);
    ctx.globalAlpha = alpha * 0.26;
    ctx.lineWidth = w * 2.2;
    ctx.stroke(path);
    ctx.globalAlpha = alpha;
    ctx.lineWidth = w;
    ctx.stroke(path);
    ctx.globalAlpha = 1;
  }

  function line3(ax, ay, az, bx, by, bz) {
    if (proj(ax, ay, az, _a) < 0) return false;
    if (proj(bx, by, bz, _b) < 0) return false;
    R.ctx.moveTo(_a.x, _a.y);
    R.ctx.lineTo(_b.x, _b.y);
    return true;
  }

  /* ============================================================
     背景 / 空间参考
     ============================================================ */
  function drawSpace(st) {
    const ctx = R.ctx;
    ctx.fillStyle = R.bg;
    ctx.fillRect(0, 0, R.W, R.H);

    const B = st.level.bounds;

    // 空间点阵
    const step = B * 2 / 7;
    ctx.globalAlpha = 1;
    const dots = new Path2D();
    for (let i = 0; i <= 7; i++) {
      for (let j = 0; j <= 7; j++) {
        for (let k = 0; k <= 7; k++) {
          const x = -B + i * step, y = -B + j * step, z = -B + k * step;
          if (proj(x, y, z, _a) < 0) continue;
          if (_a.x < -30 || _a.x > R.W + 30 || _a.y < -30 || _a.y > R.H + 30) continue;
          const s = clamp(26 / _a.z, 0.4, 2.4);
          dots.moveTo(_a.x + s, _a.y);
          dots.arc(_a.x, _a.y, s, 0, 6.2832);
        }
      }
    }
    ctx.fillStyle = 'rgba(80,150,200,0.16)';
    ctx.fill(dots);

    // 尘埃（视差）
    if (!R.dust) {
      R.dust = [];
      const rnd = FD.mulberry(7);
      for (let i = 0; i < 260; i++) R.dust.push({ x: rnd() * 2 - 1, y: rnd() * 2 - 1, z: rnd() * 2 - 1, s: rnd() });
    }
    const dustPath = new Path2D();
    const tt = R._t || 0;
    for (let i = 0; i < R.dust.length; i++) {
      const d = R.dust[i];
      const x = d.x * B * 1.35 + Math.sin(tt * 0.25 + d.s * 9) * 0.6;
      const y = d.y * B * 1.35 + Math.cos(tt * 0.21 + d.s * 7) * 0.6;
      const z = d.z * B * 1.35;
      if (proj(x, y, z, _a) < 0) continue;
      if (_a.x < -10 || _a.x > R.W + 10 || _a.y < -10 || _a.y > R.H + 10) continue;
      const sz = clamp(16 / _a.z, 0.3, 1.6);
      dustPath.moveTo(_a.x + sz, _a.y);
      dustPath.arc(_a.x, _a.y, sz, 0, 6.2832);
    }
    ctx.fillStyle = 'rgba(150,200,235,0.30)';
    ctx.fill(dustPath);

    // 地面网格
    const grid = new Path2D();
    const gn = 8;
    for (let i = -gn; i <= gn; i++) {
      const t = i * (B / gn);
      line3(-B, -B, t, B, -B, t);
      line3(t, -B, -B, t, -B, B);
    }
    ctx.strokeStyle = 'rgba(40,95,140,0.30)';
    ctx.lineWidth = 1;
    ctx.stroke(grid);

    // 盒体棱
    const box = new Path2D();
    const corners = [
      [-B, -B, -B], [B, -B, -B], [B, -B, B], [-B, -B, B],
      [-B, B, -B], [B, B, -B], [B, B, B], [-B, B, B]
    ];
    const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    for (const e of edges) {
      const a = corners[e[0]], b = corners[e[1]];
      if (proj(a[0], a[1], a[2], _a) < 0) continue;
      if (proj(b[0], b[1], b[2], _b) < 0) continue;
      box.moveTo(_a.x, _a.y); box.lineTo(_b.x, _b.y);
    }
    ctx.strokeStyle = 'rgba(55,130,180,0.22)';
    ctx.lineWidth = 1.2;
    ctx.stroke(box);
  }

  /* ============================================================
     场线
     ============================================================ */
  const ECOL = [[28, 96, 132], [64, 186, 226], [186, 248, 255]];
  const BCOL = [[80, 44, 126], [146, 92, 220], [232, 180, 255]];
  const DEPTH = [1.0, 0.58, 0.28];

  function drawFieldLines(st, kind) {
    const ctx = R.ctx;
    const lines = st.lines ? st.lines[kind] : null;
    if (!lines || !lines.length) return;
    const cols = kind === 'E' ? ECOL : BCOL;
    const buckets = [];
    for (let i = 0; i < 3; i++) {
      const row = [];
      for (let b = 0; b < 3; b++) row.push({ path: new Path2D(), c: cols[i], a: DEPTH[b] });
      buckets.push(row);
    }
    const dotsNear = new Path2D(), dotsFar = new Path2D();
    const t = st.t;
    const nPts = 4;

    for (let li = 0; li < lines.length; li++) {
      const ln = lines[li];
      const P = ln.p, M = ln.m, n = M.length;
      if (n < 2) continue;

      // 平均强度分档
      let sum = 0, cnt = 0;
      for (let i = 0; i < n; i++) { sum += M[i]; cnt++; }
      const avg = sum / Math.max(1, cnt);
      let lvl = avg > 0.55 ? 2 : avg > 0.2 ? 1 : 0;

      let nearBand = 0;
      let px = 0, py = 0, prevOk = false;

      for (let i = 0; i < n; i++) {
        const d = proj(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], _a);
        if (d < 0) { prevOk = false; continue; }
        const band = d < 18 ? 0 : d < 34 ? 1 : 2;
        if (!prevOk) {
          nearBand = band;
          buckets[lvl][band].path.moveTo(_a.x, _a.y);
          prevOk = true;
          px = _a.x; py = _a.y;
        } else {
          if (band !== nearBand) {
            buckets[lvl][nearBand].path.lineTo(_a.x, _a.y);
            nearBand = band;
            buckets[lvl][band].path.moveTo(px, py);
            buckets[lvl][band].path.lineTo(_a.x, _a.y);
          } else {
            buckets[lvl][nearBand].path.lineTo(_a.x, _a.y);
          }
          px = _a.x; py = _a.y;
        }
      }

      // 流动光点（沿场方向的短划线）
      const spd = 0.12 + Math.min(1.2, avg) * 0.55;
      const phase = (ln.off || 0);
      for (let q = 0; q < nPts; q++) {
        const u = ((t * spd + phase + q / nPts) % 1);
        const idx = Math.min(n - 2, Math.floor(u * (n - 1)));
        const path = dotsNear;
        const d0 = proj(P[idx * 3], P[idx * 3 + 1], P[idx * 3 + 2], _a);
        if (d0 < 0) continue;
        const d1 = proj(P[(idx + 1) * 3], P[(idx + 1) * 3 + 1], P[(idx + 1) * 3 + 2], _b);
        if (d1 < 0) continue;
        if (_a.x < -20 || _a.x > R.W + 20 || _a.y < -20 || _a.y > R.H + 20) continue;
        // 沿方向外推，形成流线划痕
        const dx = _b.x - _a.x, dy = _b.y - _a.y;
        const L = Math.hypot(dx, dy);
        const ext = clamp(L * 0.85, 1.5, 7);
        const ux = dx / (L || 1), uy = dy / (L || 1);
        const pth = d0 < 22 ? dotsNear : dotsFar;
        pth.moveTo(_a.x - ux * ext, _a.y - uy * ext);
        pth.lineTo(_a.x + ux * ext, _a.y + uy * ext);
      }
    }

    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      for (let b = 0; b < 3; b++) {
        const bk = buckets[i][b];
        const col = 'rgb(' + bk.c[0] + ',' + bk.c[1] + ',' + bk.c[2] + ')';
        ctx.strokeStyle = col;
        if (b === 0) {
          ctx.globalAlpha = 0.05 * bk.a;
          ctx.lineWidth = 5.2;
          ctx.stroke(bk.path);
        }
        ctx.globalAlpha = 0.20 * bk.a;
        ctx.lineWidth = 1.0;
        ctx.stroke(bk.path);
        bk.path = null;
      }
    }
    // 亮划痕
    ctx.strokeStyle = kind === 'E' ? 'rgba(206,250,255,1)' : 'rgba(242,206,255,1)';
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 1.6;
    ctx.stroke(dotsNear);
    ctx.globalAlpha = 0.34;
    ctx.lineWidth = 1.2;
    ctx.stroke(dotsFar);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ============================================================
     参考系点阵（E′ / B′）
     ============================================================ */
  const _e1 = { x: 0, y: 0, z: 0 }, _b1 = { x: 0, y: 0, z: 0 };

  function drawFrameLattice(st) {
    const p = st.probe.pos;
    const sph = 3, rad = 5.4;
    const ctx = R.ctx;
    ctx.globalCompositeOperation = 'lighter';
    const arrowsE = new Path2D(), arrowsB = new Path2D();

    for (let i = 0; i < sph; i++) {
      for (let j = 0; j < sph; j++) {
        for (let k = 0; k < sph; k++) {
          const x = p.x + (i - 1) * rad;
          const y = p.y + (j - 1) * rad;
          const z = p.z + (k - 1) * rad;
          const s = { x: x, y: y, z: z };
          st.sources.sample(s, _e1, _b1);
          FD.transformFields(_e1, _b1, st.probe.vel, _e1, _b1);
          const me = Math.sqrt(_e1.x * _e1.x + _e1.y * _e1.y + _e1.z * _e1.z);
          const mb = Math.sqrt(_b1.x * _b1.x + _b1.y * _b1.y + _b1.z * _b1.z);
          drawArrow(x, y, z, _e1, me, 1.9, arrowsE);
          drawArrow(x, y, z, _b1, mb, 1.9, arrowsB);
        }
      }
    }
    ctx.strokeStyle = 'rgba(110,235,255,0.55)';
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = 1;
    ctx.stroke(arrowsE);
    ctx.strokeStyle = 'rgba(220,150,255,0.55)';
    ctx.stroke(arrowsB);
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawArrow(x, y, z, vec, mag, len, path) {
    if (mag < 1e-4) return;
    const inv = len / mag;
    const ex = x + vec.x * inv, ey = y + vec.y * inv, ez = z + vec.z * inv;
    if (proj(x, y, z, _a) < 0) return;
    if (proj(ex, ey, ez, _b) < 0) return;
    path.moveTo(_a.x, _a.y);
    path.lineTo(_b.x, _b.y);
    // 箭头
    const dx = _b.x - _a.x, dy = _b.y - _a.y;
    const L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L;
    const hl = clamp(L * 0.4, 3, 9);
    path.moveTo(_b.x, _b.y);
    path.lineTo(_b.x - ux * hl - uy * hl * 0.45, _b.y - uy * hl + ux * hl * 0.45);
    path.moveTo(_b.x, _b.y);
    path.lineTo(_b.x - ux * hl + uy * hl * 0.45, _b.y - uy * hl - ux * hl * 0.45);
  }

  /* ============================================================
     墙体 / 门
     ============================================================ */
  function drawWalls(st) {
    const ctx = R.ctx;
    const walls = st.level.walls || [];
    for (const w of walls) {
      const c = V.from(w.c), n = V.from(w.n), u = V.from(w.u), v = V.from(w.v);
      const cell = w.hw / Math.max(6, Math.round(w.hw / 1.45));
      const nx = Math.round(w.hw / cell), ny = Math.round(w.hh / cell);
      const path = new Path2D();
      const edges = new Path2D();
      for (let i = -nx; i < nx; i++) {
        for (let j = -ny; j < ny; j++) {
          const a = i * cell, b = j * cell;
          const cx = c.x + u.x * a + v.x * b, cy = c.y + u.y * a + v.y * b, cz = c.z + u.z * a + v.z * b;
          let skip = false;
          for (const h of w.holes) {
            const dx = cx - h.c[0], dy = cy - h.c[1], dz = cz - h.c[2];
            const du = dx * u.x + dy * u.y + dz * u.z;
            const dv = dx * v.x + dy * v.y + dz * v.z;
            if (du * du + dv * dv < (h.r + cell * 0.35) * (h.r + cell * 0.35)) { skip = true; break; }
          }
          if (skip) continue;
          const p0 = {
            x: c.x + u.x * a + v.x * b, y: c.y + u.y * a + v.y * b, z: c.z + u.z * a + v.z * b
          };
          const p1 = { x: p0.x + u.x * cell, y: p0.y + u.y * cell, z: p0.z + u.z * cell };
          const p2 = { x: p1.x + v.x * cell, y: p1.y + v.y * cell, z: p1.z + v.z * cell };
          const p3 = { x: p0.x + v.x * cell, y: p0.y + v.y * cell, z: p0.z + v.z * cell };
          const d0 = proj(p0.x, p0.y, p0.z, _a); if (d0 < 0) continue;
          const a0x = _a.x, a0y = _a.y;
          if (proj(p1.x, p1.y, p1.z, _a) < 0) continue; const a1x = _a.x, a1y = _a.y;
          if (proj(p2.x, p2.y, p2.z, _a) < 0) continue; const a2x = _a.x, a2y = _a.y;
          if (proj(p3.x, p3.y, p3.z, _a) < 0) continue; const a3x = _a.x, a3y = _a.y;
          path.moveTo(a0x, a0y); path.lineTo(a1x, a1y); path.lineTo(a2x, a2y); path.lineTo(a3x, a3y); path.closePath();
          edges.moveTo(a0x, a0y); edges.lineTo(a1x, a1y); edges.lineTo(a2x, a2y); edges.lineTo(a3x, a3y); edges.closePath();
        }
      }
      ctx.fillStyle = 'rgba(28,64,96,0.34)';
      ctx.fill(path);
      ctx.strokeStyle = 'rgba(80,180,225,0.34)';
      ctx.lineWidth = 0.9;
      ctx.stroke(edges);

      // 外框
      const fr = new Path2D();
      const corners = [
        [-w.hw, -w.hh], [w.hw, -w.hh], [w.hw, w.hh], [-w.hw, w.hh]
      ].map(function (ab) {
        return {
          x: c.x + u.x * ab[0] + v.x * ab[1],
          y: c.y + u.y * ab[0] + v.y * ab[1],
          z: c.z + u.z * ab[0] + v.z * ab[1]
        };
      });
      for (let i = 0; i < 4; i++) {
        const p0 = corners[i], p1 = corners[(i + 1) % 4];
        if (proj(p0.x, p0.y, p0.z, _a) < 0) continue;
        if (proj(p1.x, p1.y, p1.z, _b) < 0) continue;
        fr.moveTo(_a.x, _a.y); fr.lineTo(_b.x, _b.y);
      }
      ctx.strokeStyle = 'rgba(90,200,240,0.65)';
      ctx.lineWidth = 1.5;
      ctx.stroke(fr);
    }
  }

  function drawGate(st, g, idx) {
    const ctx = R.ctx;
    const c = V.from(g.c), n = V.norm(V.from(g.n));
    const u = V.perp(n), v = V.cross(n, u);
    const seg = 44;
    const open = g.open;
    const chg = g.charge || 0;
    const col = open ? [90, 255, 160] : (chg > 0.02 ? [255, 200, 90] : [255, 80, 110]);

    // 圆环
    const ring = new Path2D();
    const ring2 = new Path2D();
    let first = true;
    for (let i = 0; i <= seg; i++) {
      const th = i / seg * Math.PI * 2;
      const x = c.x + (u.x * Math.cos(th) + v.x * Math.sin(th)) * g.r;
      const y = c.y + (u.y * Math.cos(th) + v.y * Math.sin(th)) * g.r;
      const z = c.z + (u.z * Math.cos(th) + v.z * Math.sin(th)) * g.r;
      if (proj(x, y, z, _a) < 0) { first = true; continue; }
      const r2 = g.r * 0.86;
      const x2 = c.x + (u.x * Math.cos(th) + v.x * Math.sin(th)) * r2;
      const y2 = c.y + (u.y * Math.cos(th) + v.y * Math.sin(th)) * r2;
      const z2 = c.z + (u.z * Math.cos(th) + v.z * Math.sin(th)) * r2;
      const ok2 = proj(x2, y2, z2, _b) >= 0;
      if (first) { ring.moveTo(_a.x, _a.y); if (ok2) ring2.moveTo(_b.x, _b.y); first = false; }
      else { ring.lineTo(_a.x, _a.y); if (ok2) ring2.lineTo(_b.x, _b.y); }
    }
    ctx.globalCompositeOperation = 'lighter';
    strokeGlow(ring, 'rgb(' + col[0] + ',' + col[1] + ',' + col[2] + ')', 2.2, open ? 0.9 : 0.55);
    ctx.strokeStyle = 'rgb(' + col[0] + ',' + col[1] + ',' + col[2] + ')';
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    ctx.stroke(ring2);

    // 膜（按透视在圆环内部填充）
    if (!open) {
      const pc = R.projectWorld(c);
      if (pc) {
        const rr = Math.max(4, R.f * g.r / Math.max(1, pc.z));
        if (rr < R.W * 1.6) {
          const grd = ctx.createRadialGradient(pc.x, pc.y, rr * 0.1, pc.x, pc.y, rr * 1.05);
          grd.addColorStop(0, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',0.015)');
          grd.addColorStop(0.65, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',0.06)');
          grd.addColorStop(1, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',0.17)');
          ctx.globalAlpha = 1;
          ctx.fillStyle = grd;
          ctx.fill(ring);
        }
      }
    }

    // 充能进度弧
    if (!open && chg > 0.001) {
      const pc = R.projectWorld(c);
      if (pc) {
        const rr = Math.max(6, R.f * g.r / Math.max(1, pc.z));
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(pc.x, pc.y, rr * 0.99, -Math.PI / 2, -Math.PI / 2 + chg * Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,220,120,0.95)';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ============================================================
     场源几何
     ============================================================ */
  const _sp = { x: 0, y: 0, z: 0 };

  function seg2(ax, ay, az, bx, by, bz, path) {
    if (proj(ax, ay, az, _a) < 0) return;
    const x0 = _a.x, y0 = _a.y;
    if (proj(bx, by, bz, _b) < 0) return;
    path.moveTo(x0, y0); path.lineTo(_b.x, _b.y);
  }

  function circle3(c, axis, r, seg, path, n) {
    const e1 = V.perp(axis), e2 = V.cross(axis, e1);
    const N = n || 30;
    let first = true;
    for (let i = 0; i <= N; i++) {
      const th = i / N * Math.PI * 2;
      const x = c.x + (e1.x * Math.cos(th) + e2.x * Math.sin(th)) * r;
      const y = c.y + (e1.y * Math.cos(th) + e2.y * Math.sin(th)) * r;
      const z = c.z + (e1.z * Math.cos(th) + e2.z * Math.sin(th)) * r;
      if (proj(x, y, z, _a) < 0) { first = true; continue; }
      if (first) { path.moveTo(_a.x, _a.y); first = false; }
      else path.lineTo(_a.x, _a.y);
    }
  }

  function drawCharge(p, neg, alpha) {
    if (proj(p.x, p.y, p.z, _a) < 0) return;
    const ctx = R.ctx;
    const rr = clamp(R.f * 0.5 / _a.z, 2.5, 36);
    const col = neg ? [255, 130, 220] : [120, 235, 255];
    const px = _a.x, py = _a.y;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(px, py, 0, px, py, rr * 4);
    g.addColorStop(0, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + (0.7 * alpha) + ')');
    g.addColorStop(0.25, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + (0.22 * alpha) + ')');
    g.addColorStop(1, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(px, py, rr * 4, 0, 6.2832); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',0.9)';
    ctx.beginPath(); ctx.arc(px, py, rr * 0.55, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = Math.max(1.2, rr * 0.12);
    const s2 = rr * 0.5;
    ctx.beginPath();
    ctx.moveTo(px - s2, py); ctx.lineTo(px + s2, py);
    if (!neg) { ctx.moveTo(px, py - s2); ctx.lineTo(px, py + s2); }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawDipoleE(p, m, alpha) {
    const mm = V.len(m) || 1;
    const u = V.mul(m, 1 / mm);
    const half = 0.9;
    const a = { x: p.x - u.x * half, y: p.y - u.y * half, z: p.z - u.z * half };
    const b = { x: p.x + u.x * half, y: p.y + u.y * half, z: p.z + u.z * half };
    const ctx = R.ctx;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = 'rgba(160,220,255,0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    seg2(a.x, a.y, a.z, b.x, b.y, b.z, ctx);
    ctx.stroke();
    ctx.globalAlpha = 1;
    drawCharge(a, true, alpha);
    drawCharge(b, false, alpha);
  }

  function drawDipoleB(p, m, alpha) {
    const mm = V.len(m) || 1;
    const u = V.mul(m, 1 / mm);
    const ctx = R.ctx;
    const path = new Path2D();
    circle3(p, u, 0.95, 0, path, 22);
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,190,130,0.95)';
    ctx.lineWidth = 2.2;
    ctx.stroke(path);
    ctx.globalCompositeOperation = 'source-over';
    const tip = { x: p.x + u.x * 1.6, y: p.y + u.y * 1.6, z: p.z + u.z * 1.6 };
    const ar = new Path2D();
    drawArrow(tip.x, tip.y, tip.z, u, 1, 0.9, ar);
    ctx.strokeStyle = 'rgba(255,200,140,0.9)';
    ctx.lineWidth = 1.6;
    ctx.stroke(ar);
    ctx.globalAlpha = 1;
  }

  function drawLineSource(a, b, color, alpha, ticks) {
    const ctx = R.ctx;
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    seg2(a.x, a.y, a.z, b.x, b.y, b.z, ctx);
    ctx.stroke();
    ctx.lineWidth = 10;
    ctx.globalAlpha = alpha * 0.16;
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha;
    if (ticks !== false) {
      const n = 7;
      const d = V.sub(b, a);
      const perp = V.mul(V.perp(d), 0.32);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const q = { x: a.x + d.x * t, y: a.y + d.y * t, z: a.z + d.z * t };
        seg2(q.x - perp.x, q.y - perp.y, q.z - perp.z, q.x + perp.x, q.y + perp.y, q.z + perp.z, ctx);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawCyl(a, b, r, color, alpha) {
    const axis = V.norm(V.sub(b, a));
    const ctx = R.ctx;
    const path = new Path2D();
    circle3(a, axis, r, 0, path, 20);
    circle3(b, axis, r, 0, path, 20);
    const e1 = V.perp(axis), e2 = V.cross(axis, e1);
    for (let i = 0; i < 4; i++) {
      const th = i / 4 * Math.PI * 2;
      const ox = e1.x * Math.cos(th) + e2.x * Math.sin(th);
      const oy = e1.y * Math.cos(th) + e2.y * Math.sin(th);
      const oz = e1.z * Math.cos(th) + e2.z * Math.sin(th);
      seg2(a.x + ox * r, a.y + oy * r, a.z + oz * r, b.x + ox * r, b.y + oy * r, b.z + oz * r, path);
    }
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.stroke(path);
    ctx.globalAlpha = alpha * 0.1;
    ctx.lineWidth = 8;
    ctx.stroke(path);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  function drawSheet(c, n, u, hw, hh, color, alpha, marks) {
    const v = V.cross(n, u);
    const ctx = R.ctx;
    const N = 7;
    const path = new Path2D();
    for (let i = -N; i <= N; i++) {
      const a0 = i * hw / N;
      seg2(c.x + u.x * a0 - v.x * hh, c.y + u.y * a0 - v.y * hh, c.z + u.z * a0 - v.z * hh,
        c.x + u.x * a0 + v.x * hh, c.y + u.y * a0 + v.y * hh, c.z + u.z * a0 + v.z * hh, path);
      const b0 = i * hh / N;
      seg2(c.x + v.x * b0 - u.x * hw, c.y + v.y * b0 - u.y * hw, c.z + v.z * b0 - u.z * hw,
        c.x + v.x * b0 + u.x * hw, c.y + v.y * b0 + u.y * hw, c.z + v.z * b0 + u.z * hw, path);
    }
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke(path);
    if (marks === 'plus' || marks === 'minus') {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      const mp = new Path2D();
      for (let i = -2; i <= 2; i++) {
        for (let j = -2; j <= 2; j++) {
          const q = {
            x: c.x + u.x * i * hw * 0.4 + v.x * j * hh * 0.4,
            y: c.y + u.y * i * hw * 0.4 + v.y * j * hh * 0.4,
            z: c.z + u.z * i * hw * 0.4 + v.z * j * hh * 0.4
          };
          if (proj(q.x, q.y, q.z, _a) < 0) continue;
          const s2 = 3.2, px = _a.x, py = _a.y;
          mp.moveTo(px - s2, py); mp.lineTo(px + s2, py);
          if (marks === 'plus') { mp.moveTo(px, py - s2); mp.lineTo(px, py + s2); }
        }
      }
      ctx.stroke(mp);
    } else if (marks === 'arrow') {
      const ar = new Path2D();
      for (let i = -2; i <= 2; i++) {
        for (let j = -2; j <= 2; j++) {
          const q = {
            x: c.x + u.x * i * hw * 0.4 + v.x * j * hh * 0.4,
            y: c.y + u.y * i * hw * 0.4 + v.y * j * hh * 0.4,
            z: c.z + u.z * i * hw * 0.4 + v.z * j * hh * 0.4
          };
          drawArrow(q.x, q.y, q.z, u, 1, 1.0, ar);
        }
      }
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.3;
      ctx.stroke(ar);
    }
    ctx.globalAlpha = 1;
  }

  function drawSolenoid(c, axis, r, L, N, alpha) {
    const ctx = R.ctx;
    const path = new Path2D();
    for (let i = 0; i < N; i++) {
      const t = (i / (N - 1) - 0.5) * L;
      circle3({ x: c.x + axis.x * t, y: c.y + axis.y * t, z: c.z + axis.z * t }, axis, r, 0, path, 18);
    }
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,190,130,0.75)';
    ctx.lineWidth = 1.5;
    ctx.stroke(path);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  function drawSource(d, alpha) {
    const a = alpha == null ? 1 : alpha;
    const ctx = R.ctx;
    if (d.type === 'wire') {
      const A = V.from(d.a), Bv = V.from(d.b);
      drawLineSource(A, Bv, 'rgba(255,190,130,0.95)', a);
      if (a > 0.5) {
        const n = 10;
        ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < n; k++) {
          let t = (k / n + (R._t || 0) * 0.22 * (d.I >= 0 ? 1 : -1)) % 1;
          if (t < 0) t += 1;
          const x = A.x + (Bv.x - A.x) * t, y = A.y + (Bv.y - A.y) * t, z = A.z + (Bv.z - A.z) * t;
          if (proj(x, y, z, _a) < 0) continue;
          ctx.fillStyle = 'rgba(255,235,190,0.9)';
          ctx.beginPath(); ctx.arc(_a.x, _a.y, 2, 0, 6.2832); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    } else if (d.type === 'loop') {
      const c = V.from(d.c), axis = V.norm(V.from(d.axis));
      const path = new Path2D();
      circle3(c, axis, d.r, 0, path, 40);
      ctx.globalAlpha = a;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,190,130,0.85)';
      ctx.lineWidth = 2.2;
      ctx.stroke(path);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    } else if (d.type === 'q') {
      drawCharge(V.from(d.p), d.q < 0, a);
    } else if (d.type === 'dipoleE') {
      drawDipoleE(V.from(d.p), V.from(d.m), a);
    } else if (d.type === 'dipoleB') {
      drawDipoleB(V.from(d.p), V.from(d.m), a);
    } else if (d.type === 'lineQ' || d.type === 'cylQ') {
      const A = V.from(d.a), Bv = V.from(d.b);
      if (d.type === 'cylQ') drawCyl(A, Bv, d.r, 'rgba(180,225,255,0.9)', a);
      const neg = d.lambda != null ? d.lambda < 0 : d.rho < 0;
      drawLineSource(A, Bv, neg ? 'rgba(255,140,220,0.9)' : 'rgba(150,225,255,0.9)', a);
    } else if (d.type === 'sheetQ') {
      const c = V.from(d.c), n = V.norm(V.from(d.n)), u = V.norm(V.from(d.u));
      drawSheet(c, n, u, d.hw, d.hh, 'rgba(150,220,255,0.5)', a, d.sigma < 0 ? 'minus' : 'plus');
    } else if (d.type === 'sheetI') {
      const c = V.from(d.c), n = V.norm(V.from(d.n)), u = V.norm(V.from(d.u));
      drawSheet(c, n, u, d.hw, d.hh, 'rgba(255,190,130,0.45)', a, 'arrow');
    } else if (d.type === 'solenoid') {
      drawSolenoid(V.from(d.c), V.norm(V.from(d.axis)), d.r, d.L, d.N || 7, a);
    } else if (d.type === 'cylI') {
      const A = V.from(d.a), Bv = V.from(d.b);
      drawCyl(A, Bv, d.r, 'rgba(255,200,150,0.85)', a);
    } else if ((d.type === 'E' || d.type === 'B') && d.region && d.region.type === 'box') {
      const c = d.region.c, h = d.region.h;
      const col = d.type === 'E' ? '90,220,255' : '200,130,255';
      const corners = [];
      for (let i = 0; i < 8; i++) {
        corners.push({
          x: c[0] + ((i & 1) ? h[0] : -h[0]),
          y: c[1] + ((i & 2) ? h[1] : -h[1]),
          z: c[2] + ((i & 4) ? h[2] : -h[2])
        });
      }
      const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
      const path = new Path2D();
      for (let e = 0; e < edges.length; e++) {
        const P0 = corners[edges[e][0]], P1 = corners[edges[e][1]];
        seg2(P0.x, P0.y, P0.z, P1.x, P1.y, P1.z, path);
      }
      ctx.globalAlpha = a;
      ctx.strokeStyle = 'rgba(' + col + ',0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 6]);
      ctx.stroke(path);
      ctx.setLineDash([]);
      const dir = V.norm(V.from(d.dir));
      const ar = new Path2D();
      for (let i = 0; i < 8; i++) drawArrow(corners[i].x, corners[i].y, corners[i].z, dir, 1, 2.6, ar);
      ctx.strokeStyle = 'rgba(' + col + ',0.5)';
      ctx.lineWidth = 1.2;
      ctx.stroke(ar);
      ctx.globalAlpha = 1;
    }
  }

  function drawSources(st) {
    const defs = st.level.sources || [];
    for (let i = 0; i < defs.length; i++) drawSource(defs[i], 1);
    if (st.ghost) {
      const ctx = R.ctx;
      drawSource(st.ghost, 0.45);
      if (proj(st.ghostPos.x, st.ghostPos.y, st.ghostPos.z, _a) >= 0) {
        ctx.strokeStyle = 'rgba(255,235,150,0.75)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        const r = 20;
        ctx.beginPath();
        ctx.moveTo(_a.x - r, _a.y); ctx.lineTo(_a.x + r, _a.y);
        ctx.moveTo(_a.x, _a.y - r); ctx.lineTo(_a.x, _a.y + r);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  /* ============================================================
     物体：种子 / 危险区 / 出口
     ============================================================ */
  function drawSeed(st, s) {
    if (s.taken) return;
    const ctx = R.ctx;
    const p = s.p;
    const bob = Math.sin(st.t * 2 + s.ph) * 0.18;
    const d = proj(p.x, p.y + bob, p.z, _a);
    if (d < 0) return;
    const rr = clamp(R.f * 0.42 / d, 2, 34);
    const pulse = 0.75 + 0.25 * Math.sin(st.t * 3.4 + s.ph);

    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(_a.x, _a.y, 0, _a.x, _a.y, rr * 3.4);
    g.addColorStop(0, 'rgba(255,240,190,' + (0.95 * pulse) + ')');
    g.addColorStop(0.22, 'rgba(255,200,90,' + (0.42 * pulse) + ')');
    g.addColorStop(1, 'rgba(255,160,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(_a.x, _a.y, rr * 3.4, 0, 6.2832); ctx.fill();

    ctx.fillStyle = 'rgba(255,252,240,0.98)';
    ctx.beginPath(); ctx.arc(_a.x, _a.y, rr * 0.36, 0, 6.2832); ctx.fill();

    // 轨道环
    ctx.strokeStyle = 'rgba(255,215,120,0.9)';
    ctx.lineWidth = Math.max(0.8, rr * 0.10);
    ctx.beginPath();
    ctx.ellipse(_a.x, _a.y, rr * 1.6, rr * 0.46, st.t * 0.9 + s.ph, 0, 6.2832);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,180,0.55)';
    ctx.beginPath();
    ctx.ellipse(_a.x, _a.y, rr * 1.06, rr * 0.92, -st.t * 1.35 + s.ph, 0, 6.2832);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawHazard(st, h) {
    const ctx = R.ctx;
    const c = h.c;
    const pulse = 0.62 + 0.38 * Math.sin(st.t * 2.2 + (h.ph || 0));
    const pc = R.projectWorld(c);
    if (!pc) return;
    const rr = R.f * h.r / Math.max(0.6, pc.z);
    if (rr > R.W * 2) return;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(pc.x, pc.y, rr * 0.12, pc.x, pc.y, rr);
    g.addColorStop(0, 'rgba(255,40,70,' + (0.10 * pulse) + ')');
    g.addColorStop(0.62, 'rgba(255,40,70,' + (0.13 * pulse) + ')');
    g.addColorStop(0.9, 'rgba(255,90,110,' + (0.30 * pulse) + ')');
    g.addColorStop(1, 'rgba(255,40,70,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(pc.x, pc.y, rr, 0, 6.2832); ctx.fill();

    ctx.strokeStyle = 'rgba(255,110,130,' + (0.5 + 0.3 * pulse) + ')';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(pc.x, pc.y, rr * 0.97, 0, 6.2832); ctx.stroke();
    ctx.setLineDash([4, 7]);
    ctx.beginPath(); ctx.arc(pc.x, pc.y, rr * 0.72, st.t * 0.6, st.t * 0.6 + 5.2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawExit(st) {
    const ctx = R.ctx;
    const e = st.level.exit;
    if (!e) return;
    const p = V.from(e.p);
    const pulse = 0.7 + 0.3 * Math.sin(st.t * 2.6);
    const pc = R.projectWorld(p);
    if (!pc) return;
    const rr = R.f * e.r / Math.max(0.6, pc.z);

    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(pc.x, pc.y, 0, pc.x, pc.y, rr * 1.9);
    g.addColorStop(0, 'rgba(120,255,180,' + (0.22 * pulse) + ')');
    g.addColorStop(0.5, 'rgba(60,230,140,0.10)');
    g.addColorStop(1, 'rgba(40,200,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(pc.x, pc.y, rr * 1.9, 0, 6.2832); ctx.fill();

    ctx.strokeStyle = 'rgba(120,255,180,0.9)';
    ctx.lineWidth = 2.4;
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.arc(pc.x, pc.y, rr * (1 - i * 0.13), st.t * (1 + i * 0.4), st.t * (1 + i * 0.4) + 4.4);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ============================================================
     探针
     ============================================================ */
  function drawProbe(st) {
    if (st.showProbe === false) return;
    const ctx = R.ctx;
    const pr = st.probe;
    const p = pr.pos;

    // 尾迹
    const tr = st.trail;
    if (tr && tr.length > 2) {
      ctx.globalCompositeOperation = 'lighter';
      const bands = 5;
      for (let b = 0; b < bands; b++) {
        const path = new Path2D();
        let started = false;
        for (let i = 0; i < tr.length - 1; i++) {
          const age = 1 - i / (tr.length - 1);
          if (Math.abs(age * bands - b - 0.5) > 1.2) continue;
          const a0 = tr[i], a1 = tr[i + 1];
          if (proj(a0.x, a0.y, a0.z, _a) < 0) { started = false; continue; }
          if (proj(a1.x, a1.y, a1.z, _b) < 0) { started = false; continue; }
          path.moveTo(_a.x, _a.y); path.lineTo(_b.x, _b.y);
          started = true;
        }
        if (!started && b > 0) continue;
        ctx.globalAlpha = (1 - b / bands) * 0.5;
        ctx.strokeStyle = pr.q > 0 ? 'rgba(120,240,255,1)' : 'rgba(255,150,240,1)';
        ctx.lineWidth = 2.2 - b * 0.3;
        ctx.stroke(path);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    const d = proj(p.x, p.y, p.z, _a);
    if (d < 0) return;
    const rr = clamp(R.f * 0.40 / d, 2.5, 40);
    const posCol = pr.q > 0 ? [120, 240, 255] : [255, 140, 230];

    ctx.globalCompositeOperation = 'lighter';

    // 光晕
    const g = ctx.createRadialGradient(_a.x, _a.y, 0, _a.x, _a.y, rr * 3.4);
    g.addColorStop(0, 'rgba(' + posCol[0] + ',' + posCol[1] + ',' + posCol[2] + ',0.5)');
    g.addColorStop(0.35, 'rgba(' + posCol[0] + ',' + posCol[1] + ',' + posCol[2] + ',0.12)');
    g.addColorStop(1, 'rgba(' + posCol[0] + ',' + posCol[1] + ',' + posCol[2] + ',0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(_a.x, _a.y, rr * 3.4, 0, 6.2832); ctx.fill();

    // 八面体
    const s = 0.42;
    const verts = [
      [0, s, 0], [0, -s, 0], [s, 0, 0], [-s, 0, 0], [0, 0, s], [0, 0, -s]
    ];
    const scr = [];
    for (const v of verts) {
      const o = { x: 0, y: 0, z: 0 };
      if (proj(p.x + v[0], p.y + v[1], p.z + v[2], o) < 0) { scr.push(null); continue; }
      scr.push(o);
    }
    const faces = [[0, 2, 4], [0, 4, 3], [0, 3, 5], [0, 5, 2], [1, 4, 2], [1, 3, 4], [1, 5, 3], [1, 2, 5]];
    ctx.strokeStyle = 'rgba(' + posCol[0] + ',' + posCol[1] + ',' + posCol[2] + ',0.9)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (const f of faces) {
      const a0 = scr[f[0]], a1 = scr[f[1]], a2 = scr[f[2]];
      if (!a0 || !a1 || !a2) continue;
      ctx.moveTo(a0.x, a0.y); ctx.lineTo(a1.x, a1.y); ctx.lineTo(a2.x, a2.y); ctx.closePath();
    }
    ctx.stroke();

    // 速度矢量
    const vlen = Math.hypot(pr.vel.x, pr.vel.y, pr.vel.z);
    if (vlen > 0.02) {
      const path = new Path2D();
      drawArrow(p.x, p.y, p.z, pr.vel, vlen, 1.2 + vlen * 3.2, path);
      ctx.strokeStyle = 'rgba(150,255,220,0.9)';
      ctx.lineWidth = 1.6;
      ctx.stroke(path);
    }

    // 无受力速度 v*（金色虚线：飞向它，场就消失了）
    if (st.vstar && st.vstarMag > 0.02 && st.vstarMag < 3) {
      const path = new Path2D();
      drawArrow(p.x, p.y, p.z, st.vstar, st.vstarMag, 1.1 + st.vstarMag * 2.6, path);
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = 'rgba(255,214,110,0.9)';
      ctx.lineWidth = 1.5;
      ctx.stroke(path);
      ctx.setLineDash([]);
    }

    // 洛伦兹力矢量
    if (st.force && st.forceMag > 0.008) {
      const path = new Path2D();
      drawArrow(p.x, p.y, p.z, st.force, st.forceMag, 1.0 + st.forceMag * 6, path);
      ctx.strokeStyle = 'rgba(255,170,90,0.95)';
      ctx.lineWidth = 2;
      ctx.stroke(path);
      if (st.forceMag > 0.02) {
        ctx.strokeStyle = 'rgba(255,140,60,0.25)';
        ctx.lineWidth = 6;
        ctx.stroke(path);
      }
    }

    ctx.globalCompositeOperation = 'source-over';
  }

  /* 准星 δ 环：越接近静默，环越收紧 */
  function drawDeltaRing(st) {
    const g = st.gateNear;
    if (!g || g.open) return;
    const ctx = R.ctx;
    const d = FD.clamp(g.delta, 0, 1);
    const rad = 64 + 150 * d;
    const cx = R.W / 2, cy = R.H / 2;
    const t = FD.clamp(1 - d / Math.max(0.001, g.tol * 2.2), 0, 1);
    const r = Math.round(255 - 165 * t);
    const gr = Math.round(90 + 165 * t);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(' + r + ',' + gr + ',150,' + (0.42 + 0.45 * t) + ')';
    ctx.lineWidth = 2 + 2.6 * t;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, 6.2832);
    ctx.stroke();
    // 目标阈值环
    const rad2 = 64 + 150 * g.tol;
    ctx.strokeStyle = 'rgba(140,255,190,0.34)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 6]);
    ctx.beginPath();
    ctx.arc(cx, cy, rad2, 0, 6.2832);
    ctx.stroke();
    ctx.setLineDash([]);
    if (t > 0.5) {
      ctx.fillStyle = 'rgba(150,255,200,' + ((t - 0.5) * 1.6) + ')';
      ctx.font = '600 10px ui-monospace, Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('静默 ' + Math.round(t * 100) + '%', cx, cy - rad - 12);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ============================================================
     屏幕特效
     ============================================================ */
  function drawScreenFX(st) {
    const ctx = R.ctx;
    const sp = Math.hypot(st.probe.vel.x, st.probe.vel.y, st.probe.vel.z);

    // 速度线
    if (sp > 0.42) {
      const a = clamp((sp - 0.42) / 0.5, 0, 1);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(150,225,255,' + (a * 0.22) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const cx = R.W / 2, cy = R.H / 2;
      const n = 26;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * 6.2832 + st.t * 0.2;
        const r0 = R.W * (0.30 + 0.1 * Math.sin(i * 3.1 + st.t * 2));
        const r1 = r0 + R.W * 0.22 * a;
        ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
        ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
      }
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }

    if (st.fx.slip > 0.001) {
      const a = st.fx.slip;
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(R.W / 2, R.H / 2, R.H * 0.1, R.W / 2, R.H / 2, R.H * 0.8);
      g.addColorStop(0, 'rgba(120,200,255,0)');
      g.addColorStop(1, 'rgba(140,110,255,' + (0.30 * a) + ')');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, R.W, R.H);
      ctx.globalCompositeOperation = 'source-over';
    }

    if (st.fx.hurt > 0.001) {
      const a = st.fx.hurt;
      const g = ctx.createRadialGradient(R.W / 2, R.H / 2, R.H * 0.28, R.W / 2, R.H / 2, R.H * 0.78);
      g.addColorStop(0, 'rgba(255,30,60,0)');
      g.addColorStop(1, 'rgba(255,30,60,' + (0.42 * a) + ')');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, R.W, R.H);
    }

    if (st.fx.slow > 0.001) {
      ctx.strokeStyle = 'rgba(140,200,255,' + (0.18 * st.fx.slow) + ')';
      ctx.lineWidth = 2;
      ctx.strokeRect(6, 6, R.W - 12, R.H - 12);
    }
  }

  /* ============================================================
     势的切面：φ（电势）与 A（磁矢势）
     平面过探针、垂直于视线 —— 这样投影是均匀缩放，可用位图精确贴图
     ============================================================ */
  const POT_RES = 44;
  const POT_RANGE = 9.5;
  let potTimer = 0, potSource = null, potSignature = null;
  const potGrid = new Float32Array(POT_RES * POT_RES);
  const potA = [];

  function ensurePot() {
    if (R.potCv) return;
    R.potCv = document.createElement('canvas');
    R.potCv.width = POT_RES; R.potCv.height = POT_RES;
    R.potCtx = R.potCv.getContext('2d');
    R.potImg = R.potCtx.createImageData(POT_RES, POT_RES);
  }

  const potOut = { phi: 0, ax: 0, ay: 0, az: 0 };

  function buildPotential(st, range) {
    ensurePot();
    const pr = st.probe.pos, c = R.cam;
    const e1 = c.right, e2 = c.up;
    const two = range;
    let maxAbs = 1e-6, maxA = 1e-6;
    for (let j = 0; j < POT_RES; j++) {
      const v = (1 - (j + 0.5) / POT_RES * 2) * two;
      for (let i = 0; i < POT_RES; i++) {
        const u = ((i + 0.5) / POT_RES * 2 - 1) * two;
        const x = pr.x + e1.x * u + e2.x * v;
        const y = pr.y + e1.y * u + e2.y * v;
        const z = pr.z + e1.z * u + e2.z * v;
        st.sources.potential({ x: x, y: y, z: z }, potOut);
        const idx = j * POT_RES + i;
        if (st.potMode === 1) {
          potGrid[idx] = potOut.phi;
          const a = Math.abs(potOut.phi);
          if (a > maxAbs) maxAbs = a;
        } else {
          const m = Math.hypot(potOut.ax, potOut.ay, potOut.az);
          potGrid[idx] = m;
          if (m > maxA) maxA = m;
        }
      }
    }
    // 颜色（分位数归一化，避免被奇点主导）
    const d = R.potImg.data;
    const sample = [];
    for (let k = 0; k < potGrid.length; k += 3) sample.push(st.potMode === 1 ? Math.abs(potGrid[k]) : potGrid[k]);
    sample.sort(function (a, b) { return a - b; });
    const q = st.potMode === 1 ? 0.72 : 0.80;
    const scale = Math.max(1e-4, sample[Math.floor(sample.length * q)] || 1e-3);
    for (let j2 = 0; j2 < POT_RES; j2++) {
      for (let i2 = 0; i2 < POT_RES; i2++) {
        const k = j2 * POT_RES + i2;
        const nx = (i2 + 0.5) / POT_RES * 2 - 1;
        const ny = (j2 + 0.5) / POT_RES * 2 - 1;
        const rr = Math.sqrt(nx * nx + ny * ny);
        const fade = 1 - FD.smoothstep(0.30, 0.98, rr);
        let r, g, b, a;
        if (st.potMode === 1) {
          let t = potGrid[k] / scale;
          const sgn = t < 0 ? -1 : 1;
          t = sgn * Math.pow(Math.min(1.6, Math.abs(t)), 0.62);
          if (t >= 0) {
            const u2 = Math.min(1, t);
            r = 255; g = 60 + 120 * (1 - u2); b = 40 * (1 - u2);
          } else {
            const u2 = Math.min(1, -t);
            r = 40 * (1 - u2); g = 120 + 80 * (1 - u2); b = 255;
          }
          a = 98 * Math.min(1, Math.abs(t) * 1.35) * fade;
        } else {
          let t = Math.pow(Math.min(1, potGrid[k] / scale), 0.55);
          r = 110 + 140 * t; g = 60 + 150 * t; b = 200 + 55 * t;
          a = 132 * t * fade;
        }
        d[k * 4] = r; d[k * 4 + 1] = g; d[k * 4 + 2] = b; d[k * 4 + 3] = a;
      }
    }
    R.potCtx.putImageData(R.potImg, 0, 0);
    R.potScale = scale;
    R.potMaxAbs = maxAbs;
    R.potMaxA = maxA;

    // A 的箭头采样
    potA.length = 0;
    if (st.potMode === 2) {
      const N = 6;
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const u = ((i + 0.5) / N * 2 - 1) * range * 0.86;
          const v = (1 - (j + 0.5) / N * 2) * range * 0.86;
          const x = pr.x + e1.x * u + e2.x * v;
          const y = pr.y + e1.y * u + e2.y * v;
          const z = pr.z + e1.z * u + e2.z * v;
          st.sources.potential({ x: x, y: y, z: z }, potOut);
          potA.push({ x: x, y: y, z: z, ax: potOut.ax, ay: potOut.ay, az: potOut.az, m: Math.hypot(potOut.ax, potOut.ay, potOut.az) });
        }
      }
    }
  }

  function drawPotential(st) {
    if (!st.potMode || !st.sources.potentialValid) return;
    ensurePot();
    const c = R.cam;
    const pr = st.probe.pos;
    // 平面深度
    const dx = pr.x - c.pos.x, dy = pr.y - c.pos.y, dz = pr.z - c.pos.z;
    const zc = dx * c.fwd.x + dy * c.fwd.y + dz * c.fwd.z;
    if (zc < 1) return;

    const S = Math.min(R.W, R.H) * 0.36;
    const range = zc * S / R.f;
    const now = st.t;
    const signature = [pr.x, pr.y, pr.z, c.right.x, c.right.y, c.right.z, c.up.x, c.up.y, c.up.z, range, st.potMode];
    const changed = !potSignature || signature.some((value, i) => Math.abs(value - potSignature[i]) > 0.002);
    if (potSource !== st.sources || (changed && now - potTimer > 0.12)) {
      potTimer = now; potSource = st.sources; potSignature = signature; buildPotential(st, range);
    }

    const pc = R.projectWorld({ x: pr.x, y: pr.y, z: pr.z });
    if (!pc) return;
    if (S < 8) return;

    const ctx = R.ctx;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.62;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(R.potCv, pc.x - S, pc.y - S, S * 2, S * 2);
    ctx.globalAlpha = 1;

    // 等势线 / 等势圈
    const levels = st.potMode === 1 ? [-0.66, -0.33, 0.33, 0.66] : [0.3, 0.55, 0.8];
    const path = new Path2D();
    const sc = R.potScale || 1;
    const toX = (i, j) => pc.x + ((i / (POT_RES - 1)) * 2 - 1) * S;
    const toY = (i, j) => pc.y + ((j / (POT_RES - 1)) * 2 - 1) * S;
    for (let j = 0; j < POT_RES - 1; j += 1) {
      for (let i = 0; i < POT_RES - 1; i += 1) {
        const v00 = potGrid[j * POT_RES + i] / sc;
        const v10 = potGrid[j * POT_RES + i + 1] / sc;
        const v01 = potGrid[(j + 1) * POT_RES + i] / sc;
        const v11 = potGrid[(j + 1) * POT_RES + i + 1] / sc;
        const mn = Math.min(v00, v10, v01, v11), mx = Math.max(v00, v10, v01, v11);
        for (let k = 0; k < levels.length; k++) {
          const L = levels[k];
          if (L < mn || L > mx) continue;
          const pts = [];
          if ((v00 - L) * (v10 - L) < 0) { const t = (L - v00) / (v10 - v00); pts.push([i + t, j]); }
          if ((v10 - L) * (v11 - L) < 0) { const t = (L - v10) / (v11 - v10); pts.push([i + 1, j + t]); }
          if ((v01 - L) * (v11 - L) < 0) { const t = (L - v01) / (v11 - v01); pts.push([i + t, j + 1]); }
          if ((v00 - L) * (v01 - L) < 0) { const t = (L - v00) / (v01 - v00); pts.push([i, j + t]); }
          if (pts.length >= 2) {
            path.moveTo(toX(pts[0][0]), toY(0, pts[0][1]));
            path.lineTo(toX(pts[1][0]), toY(0, pts[1][1]));
          }
        }
      }
    }
    ctx.strokeStyle = st.potMode === 1 ? 'rgba(200,225,255,0.35)' : 'rgba(220,190,255,0.35)';
    ctx.lineWidth = 0.9;
    ctx.stroke(path);

    // A 箭头
    if (st.potMode === 2 && potA.length) {
      const arrows = new Path2D();
      const mA = R.potMaxA || 1;
      for (let i = 0; i < potA.length; i++) {
        const a = potA[i];
        if (a.m < mA * 0.08) continue;
        drawArrow(a.x, a.y, a.z, { x: a.ax, y: a.ay, z: a.az }, a.m, 1.0 + 1.3 * (a.m / mA), arrows);
      }
      ctx.strokeStyle = 'rgba(235,200,255,0.85)';
      ctx.lineWidth = 1.3;
      ctx.stroke(arrows);
    }

    // 边框与标签
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = st.potMode === 1 ? 'rgba(120,200,255,0.26)' : 'rgba(200,150,255,0.26)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(pc.x, pc.y, S, 0, 6.2832); ctx.stroke();
    ctx.font = '600 10px ui-monospace, Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = st.potMode === 1 ? 'rgba(150,215,255,0.85)' : 'rgba(220,180,255,0.85)';
    const label = st.potMode === 1
      ? 'φ 电势切面  ±' + Math.max(0.01, R.potMaxAbs).toFixed(2)
      : 'A 磁矢势切面  max ' + Math.max(0.0001, R.potMaxA).toFixed(3);
    ctx.fillText(label, pc.x - S * 0.72, pc.y - S - 8);
    if (st.potMode === 2 && (R.potMaxA || 0) < 2e-4) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(200,160,255,0.8)';
      ctx.fillText('A = 0：这片空间里没有电流或磁场源', pc.x, pc.y + S + 20);
    }
  }

  /* ============================================================
     主绘制
     ============================================================ */
  R.draw = function (st) {
    const ctx = R.ctx;
    R._t = st.t;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    drawSpace(st);

    // 门 / 墙
    drawWalls(st);
    drawSources(st);
    for (let i = 0; i < st.gates.length; i++) drawGate(st, st.gates[i], i);

    // 势的切面
    drawPotential(st);

    // 场线
    if (st.frameMode) {
      drawFrameLattice(st);
    } else {
      drawFieldLines(st, 'B');
      drawFieldLines(st, 'E');
    }

    // 物体
    for (const h of st.hazards) drawHazard(st, h);
    drawExit(st);
    for (const s of st.seeds) drawSeed(st, s);

    drawProbe(st);
    drawDeltaRing(st);
    drawScreenFX(st);

    // 世界标签
    drawLabels(st);
    drawExitIndicator(st);
    drawSeedMarkers(st);
  };

  /* 种子方向指示 */
  function drawSeedMarkers(st) {
    if (!st.seeds || !st.seeds.length) return;
    const c = R.cam, ctx = R.ctx;
    const cx = R.W / 2, cy = R.H / 2;
    for (let i = 0; i < st.seeds.length; i++) {
      const s = st.seeds[i];
      if (s.taken) continue;
      const dx = s.p.x - c.pos.x, dy = s.p.y - c.pos.y, dz = s.p.z - c.pos.z;
      const x = dx * c.right.x + dy * c.right.y + dz * c.right.z;
      const y = dx * c.up.x + dy * c.up.y + dz * c.up.z;
      const pc = R.projectWorld(s.p);
      const m = 70;
      const onScreen = pc && pc.x > m && pc.x < R.W - m && pc.y > m && pc.y < R.H - m;
      if (onScreen) continue;
      const ang = Math.atan2(-y, x);
      const rad = Math.min(R.W, R.H) * 0.31;
      const px = cx + Math.cos(ang) * rad;
      const py = cy + Math.sin(ang) * rad;
      const dd = Math.hypot(dx, dy, dz);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(ang);
      ctx.fillStyle = 'rgba(255,205,110,0.75)';
      ctx.beginPath();
      ctx.moveTo(8, 0); ctx.lineTo(-4, -5); ctx.lineTo(-1, 0); ctx.lineTo(-4, 5);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.font = '600 9px ui-monospace, Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,215,140,0.6)';
      ctx.fillText(dd.toFixed(0), px, py + 16);
    }
  }

  /* 出口方向指示（离屏时贴边显示） */
  function drawExitIndicator(st) {
    const e = st.level.exit;
    if (!e) return;
    const c = R.cam;
    const dx = e.p[0] - c.pos.x, dy = e.p[1] - c.pos.y, dz = e.p[2] - c.pos.z;
    const x = dx * c.right.x + dy * c.right.y + dz * c.right.z;
    const y = dx * c.up.x + dy * c.up.y + dz * c.up.z;
    const z = dx * c.fwd.x + dy * c.fwd.y + dz * c.fwd.z;
    const pc = R.projectWorld({ x: e.p[0], y: e.p[1], z: e.p[2] });
    const m = 62;
    const onScreen = pc && pc.x > m && pc.x < R.W - m && pc.y > m && pc.y < R.H - m;
    if (onScreen) return;
    let ang = Math.atan2(-y, x);
    if (z <= 0) ang = Math.atan2(-y, x);
    const cx = R.W / 2, cy = R.H / 2;
    const rad = Math.min(R.W, R.H) * 0.40;
    const px = cx + Math.cos(ang) * rad;
    const py = cy + Math.sin(ang) * rad;
    const ctx = R.ctx;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(ang);
    ctx.fillStyle = 'rgba(110,255,170,0.9)';
    ctx.beginPath();
    ctx.moveTo(11, 0); ctx.lineTo(-6, -7); ctx.lineTo(-2, 0); ctx.lineTo(-6, 7);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    const dist = Math.hypot(dx, dy, dz);
    ctx.font = '600 10px ui-monospace, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(140,255,190,0.8)';
    ctx.fillText('出口 ' + dist.toFixed(0), px, py + 22);
  }

  function drawLabels(st) {
    const ctx = R.ctx;
    ctx.font = '600 11px ui-monospace, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < st.gates.length; i++) {
      const g = st.gates[i];
      const pc = R.projectWorld({ x: g.c[0], y: g.c[1], z: g.c[2] });
      if (!pc) continue;
      const dist = Math.hypot(st.probe.pos.x - g.c[0], st.probe.pos.y - g.c[1], st.probe.pos.z - g.c[2]);
      if (dist > 22) continue;
      const rr = R.f * g.r / Math.max(0.6, pc.z);
      const y = pc.y - rr - 14;
      let txt, col;
      if (g.open) { txt = '门 ' + (i + 1) + ' · 已解锁'; col = 'rgba(120,255,180,0.95)'; }
      else if (g.ebUnsolvable) { txt = '门 ' + (i + 1) + ' · E·B ≠ 0 不可静默'; col = 'rgba(255,120,140,0.95)'; }
      else { txt = '门 ' + (i + 1) + ' · δ ' + g.delta.toFixed(2); col = 'rgba(255,210,120,0.95)'; }
      ctx.fillStyle = 'rgba(4,10,18,0.65)';
      const w = ctx.measureText(txt).width;
      ctx.fillRect(pc.x - w / 2 - 7, y - 9, w + 14, 18);
      ctx.fillStyle = col;
      ctx.fillText(txt, pc.x, y);
    }
  }

  R.setTarget = function (p) { R._tgt = p; };

  FD.Render = R;
})();
