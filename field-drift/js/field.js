/* ============================================================
   field.js — 场源、采样、势、洛伦兹变换、流线构建
   单位：自然单位 c = 1
   支持：点电荷 / 电偶极子 / 线电荷 / 带电面 / 带电柱
         线电流 / 面电流 / 柱电流 / 螺线管 / 电流环 / 磁偶极子
         匀强电场区 / 匀强磁场区
   ============================================================ */
(function () {
  'use strict';
  const FD = window.FD, V = FD.V;
  const clamp = FD.clamp, ss = FD.smoothstep;

  /* ---------------- 区域权重（软边界） ---------------- */
  function regionWeight(reg, p) {
    if (!reg || reg.type === 'all') return 1;
    if (reg.type === 'box') {
      const c = reg.c, h = reg.h;
      const dx = Math.abs(p.x - c[0]) - h[0];
      const dy = Math.abs(p.y - c[1]) - h[1];
      const dz = Math.abs(p.z - c[2]) - h[2];
      const d = Math.max(dx, dy, dz);
      return 1 - ss(-0.9, 0.9, d);
    }
    if (reg.type === 'sphere') {
      const dx = p.x - reg.c[0], dy = p.y - reg.c[1], dz = p.z - reg.c[2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) - reg.r;
      return 1 - ss(-0.9, 0.9, d);
    }
    if (reg.type === 'cyl') {
      const ax = reg.axis;
      const dx = p.x - reg.c[0], dy = p.y - reg.c[1], dz = p.z - reg.c[2];
      const along = dx * ax[0] + dy * ax[1] + dz * ax[2];
      const px = dx - along * ax[0], py = dy - along * ax[1], pz = dz - along * ax[2];
      const dr = Math.sqrt(px * px + py * py + pz * pz) - reg.r;
      const da = Math.abs(along) - reg.half;
      const d = Math.max(dr, da);
      return 1 - ss(-0.9, 0.9, d);
    }
    return 1;
  }
  FD.regionWeight = regionWeight;

  /* ---------------- 几何离散 ---------------- */
  function addWire(segs, a, b, I) {
    segs.push({ a: a, b: b, I: I });
  }

  function addLoop(segs, d, nSeg) {
    const c = V.from(d.c), axis = V.norm(V.from(d.axis));
    const e1 = V.perp(axis), e2 = V.cross(axis, e1);
    const n = nSeg || Math.max(16, Math.round(Math.PI * 2 * d.r / 1.1));
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const th = (i / n) * Math.PI * 2;
      const p = {
        x: c.x + (e1.x * Math.cos(th) + e2.x * Math.sin(th)) * d.r,
        y: c.y + (e1.y * Math.cos(th) + e2.y * Math.sin(th)) * d.r,
        z: c.z + (e1.z * Math.cos(th) + e2.z * Math.sin(th)) * d.r
      };
      if (prev) segs.push({ a: prev, b: p, I: d.I });
      prev = p;
    }
  }

  // 把一条线均分成 k 个点电荷
  function lineCharges(list, a, b, totalQ, k) {
    const n = Math.max(2, k | 0);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      list.push({
        p: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t },
        q: totalQ / n,
        soft: 0.28
      });
    }
  }

  /* ---------------- 场源集合 ---------------- */
  function Sources(defs) {
    this.charges = [];
    this.dipolesE = [];
    this.dipolesB = [];
    this.segs = [];
    this.eRegions = [];
    this.bRegions = [];
    this.raw = defs || [];

    for (let i = 0; i < this.raw.length; i++) {
      const d = this.raw[i];
      const T = d.type;
      if (T === 'q') {
        this.charges.push({ p: V.from(d.p), q: d.q, soft: d.soft ?? 0.5 });
      } else if (T === 'dipoleE') {
        this.dipolesE.push({ p: V.from(d.p), m: V.from(d.m || [0, 1, 0]), soft: 0.6 });
      } else if (T === 'dipoleB') {
        this.dipolesB.push({ p: V.from(d.p), m: V.from(d.m || [0, 1, 0]), soft: 0.6 });
      } else if (T === 'lineQ') {
        const a = V.from(d.a), b = V.from(d.b);
        const len = V.dist(a, b);
        const k = Math.min(16, Math.max(4, Math.round(len / 1.6)));
        lineCharges(this.charges, a, b, (d.lambda ?? 1) * len, k);
      } else if (T === 'sheetQ') {
        const c = V.from(d.c), n = V.norm(V.from(d.n));
        const u = V.norm(V.from(d.u || [1, 0, 0]));
        const v = V.cross(n, u);
        const N = 5;
        const qTot = (d.sigma ?? 1) * (2 * d.hw) * (2 * d.hh);
        for (let ix = 0; ix < N; ix++) {
          for (let iy = 0; iy < N; iy++) {
            const a = -d.hw + (ix + 0.5) * (2 * d.hw / N);
            const b = -d.hh + (iy + 0.5) * (2 * d.hh / N);
            this.charges.push({
              p: {
                x: c.x + u.x * a + v.x * b,
                y: c.y + u.y * a + v.y * b,
                z: c.z + u.z * a + v.z * b
              },
              q: qTot / (N * N),
              soft: 0.3
            });
          }
        }
      } else if (T === 'cylQ') {
        // 轴线近似 λ = ρπr²，仅作远离柱半径的外部定性观察；未积分有限柱内场。
        const a = V.from(d.a), b = V.from(d.b);
        const len = V.dist(a, b);
        const lambda = (d.rho ?? 1) * Math.PI * d.r * d.r;
        const k = Math.min(16, Math.max(4, Math.round(len / 1.6)));
        lineCharges(this.charges, a, b, lambda * len, k);
      } else if (T === 'wire') {
        addWire(this.segs, V.from(d.a), V.from(d.b), d.I);
      } else if (T === 'loop') {
        addLoop(this.segs, d);
      } else if (T === 'solenoid') {
        const c = V.from(d.c), axis = V.norm(V.from(d.axis));
        const N = d.N || 7, L = d.L || 8, r = d.r || 2;
        for (let i = 0; i < N; i++) {
          const t = N === 1 ? 0 : (i / (N - 1) - 0.5) * L;
          addLoop(this.segs, {
            c: [c.x + axis.x * t, c.y + axis.y * t, c.z + axis.z * t],
            axis: [axis.x, axis.y, axis.z],
            r: r, I: d.I
          }, 14);
        }
      } else if (T === 'sheetI') {
        const c = V.from(d.c), n = V.norm(V.from(d.n));
        const u = V.norm(V.from(d.u || [1, 0, 0]));
        const v = V.cross(n, u);
        const N = 5;
        for (let i = 0; i < N; i++) {
          const b = -d.hh + (i + 0.5) * (2 * d.hh / N);
          const mid = { x: c.x + v.x * b, y: c.y + v.y * b, z: c.z + v.z * b };
          const a0 = { x: mid.x - u.x * d.hw, y: mid.y - u.y * d.hw, z: mid.z - u.z * d.hw };
          const a1 = { x: mid.x + u.x * d.hw, y: mid.y + u.y * d.hw, z: mid.z + u.z * d.hw };
          addWire(this.segs, a0, a1, (d.K ?? 1) * (2 * d.hh / N));
        }
      } else if (T === 'cylI') {
        // 有限根轴向电流近似长空心柱；内场仅在长柱与充分对称极限下近零。
        const a = V.from(d.a), b = V.from(d.b);
        const axis = V.norm(V.sub(b, a));
        const e1 = V.perp(axis), e2 = V.cross(axis, e1);
        const N = 8, r = d.r || 1.2;
        for (let i = 0; i < N; i++) {
          const th = i / N * Math.PI * 2;
          const ox = e1.x * Math.cos(th) + e2.x * Math.sin(th);
          const oy = e1.y * Math.cos(th) + e2.y * Math.sin(th);
          const oz = e1.z * Math.cos(th) + e2.z * Math.sin(th);
          addWire(this.segs,
            { x: a.x + ox * r, y: a.y + oy * r, z: a.z + oz * r },
            { x: b.x + ox * r, y: b.y + oy * r, z: b.z + oz * r },
            (d.I ?? 1) / N);
        }
      } else if (T === 'E') {
        this.eRegions.push({ dir: V.norm(V.from(d.dir)), mag: d.mag, region: d.region || { type: 'all' }, c: (d.region && d.region.c) || [0, 0, 0] });
      } else if (T === 'B') {
        this.bRegions.push({ dir: V.norm(V.from(d.dir)), mag: d.mag, region: d.region || { type: 'all' }, c: (d.region && d.region.c) || [0, 0, 0] });
      }
    }
    // Geometry is constant across all field, potential and streamline samples.
    this.segs.forEach(s => {
      s.Lx = s.b.x - s.a.x; s.Ly = s.b.y - s.a.y; s.Lz = s.b.z - s.a.z;
      s.L2 = s.Lx * s.Lx + s.Ly * s.Ly + s.Lz * s.Lz;
      s.L = Math.sqrt(s.L2);
    });
    this.potentialValid = !this.raw.some(d => (d.type === 'E' || d.type === 'B') && d.region && d.region.type !== 'all');
  }

  /* ---------------- 采样 E / B ---------------- */
  Sources.prototype.sample = function (p, E, B) {
    E.x = 0; E.y = 0; E.z = 0;
    B.x = 0; B.y = 0; B.z = 0;

    const ch = this.charges;
    for (let i = 0; i < ch.length; i++) {
      const c = ch[i];
      const dx = p.x - c.p.x, dy = p.y - c.p.y, dz = p.z - c.p.z;
      const r2 = dx * dx + dy * dy + dz * dz + c.soft;
      const inv = c.q / (r2 * Math.sqrt(r2));
      E.x += dx * inv; E.y += dy * inv; E.z += dz * inv;
    }

    const de = this.dipolesE;
    for (let i = 0; i < de.length; i++) {
      const d = de[i];
      const dx = p.x - d.p.x, dy = p.y - d.p.y, dz = p.z - d.p.z;
      const r2 = dx * dx + dy * dy + dz * dz + d.soft;
      const r = Math.sqrt(r2);
      const inv3 = 1 / (r2 * r);
      const pdotr = (d.m.x * dx + d.m.y * dy + d.m.z * dz) / r2;
      E.x += (3 * pdotr * dx - d.m.x) * inv3;
      E.y += (3 * pdotr * dy - d.m.y) * inv3;
      E.z += (3 * pdotr * dz - d.m.z) * inv3;
    }

    const sg = this.segs;
    for (let i = 0; i < sg.length; i++) {
      const s = sg[i];
      const ax = s.a.x, ay = s.a.y, az = s.a.z;
      const Lx = s.Lx, Ly = s.Ly, Lz = s.Lz;
      const L2 = s.L2;
      if (L2 < 1e-9) continue;
      const rx = p.x - ax, ry = p.y - ay, rz = p.z - az;
      const tt = (rx * Lx + ry * Ly + rz * Lz) / L2;
      const px = rx - tt * Lx, py = ry - tt * Ly, pz = rz - tt * Lz;
      let d2 = px * px + py * py + pz * pz + 0.3;
      const L = s.L;
      const ta = -tt * L, tb = (1 - tt) * L;
      const f = (tb / Math.sqrt(tb * tb + d2) - ta / Math.sqrt(ta * ta + d2)) / d2;
      const invL = 1 / L;
      // ŝ × perp
      const cx = (Ly * pz - Lz * py) * invL;
      const cy = (Lz * px - Lx * pz) * invL;
      const cz = (Lx * py - Ly * px) * invL;
      B.x += s.I * f * cx;
      B.y += s.I * f * cy;
      B.z += s.I * f * cz;
    }

    const db = this.dipolesB;
    for (let i = 0; i < db.length; i++) {
      const d = db[i];
      const dx = p.x - d.p.x, dy = p.y - d.p.y, dz = p.z - d.p.z;
      const r2 = dx * dx + dy * dy + dz * dz + d.soft;
      const r = Math.sqrt(r2);
      const inv3 = 1 / (r2 * r);
      const mdotr = (d.m.x * dx + d.m.y * dy + d.m.z * dz) / r2;
      // curl(m × r / (r²+s)^(3/2)), including the soft-core term.
      const core = 3 * d.soft / r2 - 1;
      B.x += (3 * mdotr * dx + core * d.m.x) * inv3;
      B.y += (3 * mdotr * dy + core * d.m.y) * inv3;
      B.z += (3 * mdotr * dz + core * d.m.z) * inv3;
    }

    const er = this.eRegions;
    for (let i = 0; i < er.length; i++) {
      const w = regionWeight(er[i].region, p);
      if (w <= 0.0005) continue;
      const k = er[i].mag * w;
      E.x += er[i].dir.x * k; E.y += er[i].dir.y * k; E.z += er[i].dir.z * k;
    }
    const br = this.bRegions;
    for (let i = 0; i < br.length; i++) {
      const w = regionWeight(br[i].region, p);
      if (w <= 0.0005) continue;
      const k = br[i].mag * w;
      B.x += br[i].dir.x * k; B.y += br[i].dir.y * k; B.z += br[i].dir.z * k;
    }
    return { E: E, B: B };
  };

  /* ---------------- 势 φ、A ---------------- */
  // out = {phi, ax, ay, az}
  Sources.prototype.potential = function (p, out) {
    let phi = 0, ax = 0, ay = 0, az = 0;

    const ch = this.charges;
    for (let i = 0; i < ch.length; i++) {
      const c = ch[i];
      const dx = p.x - c.p.x, dy = p.y - c.p.y, dz = p.z - c.p.z;
      phi += c.q / Math.sqrt(dx * dx + dy * dy + dz * dz + c.soft);
    }
    const de = this.dipolesE;
    for (let i = 0; i < de.length; i++) {
      const d = de[i];
      const dx = p.x - d.p.x, dy = p.y - d.p.y, dz = p.z - d.p.z;
      const r2 = dx * dx + dy * dy + dz * dz + d.soft;
      phi += (d.m.x * dx + d.m.y * dy + d.m.z * dz) / (r2 * Math.sqrt(r2));
    }
    const er = this.eRegions;
    for (let i = 0; i < er.length; i++) {
      const w = regionWeight(er[i].region, p);
      if (w <= 0.0005) continue;
      const c = er[i].c;
      phi -= er[i].mag * w * (er[i].dir.x * (p.x - c[0]) + er[i].dir.y * (p.y - c[1]) + er[i].dir.z * (p.z - c[2]));
    }

    const sg = this.segs;
    for (let i = 0; i < sg.length; i++) {
      const s = sg[i];
      const ax0 = s.a.x, ay0 = s.a.y, az0 = s.a.z;
      const Lx = s.Lx, Ly = s.Ly, Lz = s.Lz;
      const L2 = s.L2;
      if (L2 < 1e-9) continue;
      const rx = p.x - ax0, ry = p.y - ay0, rz = p.z - az0;
      const tt = (rx * Lx + ry * Ly + rz * Lz) / L2;
      const px = rx - tt * Lx, py = ry - tt * Ly, pz = rz - tt * Lz;
      const d = Math.sqrt(px * px + py * py + pz * pz + 0.3);
      const L = s.L;
      const ta = -tt * L, tb = (1 - tt) * L;
      const f = (Math.asinh(tb / d) - Math.asinh(ta / d)) / L;
      ax += s.I * f * Lx;
      ay += s.I * f * Ly;
      az += s.I * f * Lz;
    }
    const db = this.dipolesB;
    for (let i = 0; i < db.length; i++) {
      const d = db[i];
      const dx = p.x - d.p.x, dy = p.y - d.p.y, dz = p.z - d.p.z;
      const r2 = dx * dx + dy * dy + dz * dz + d.soft;
      const inv3 = 1 / (r2 * Math.sqrt(r2));
      ax += (d.m.y * dz - d.m.z * dy) * inv3;
      ay += (d.m.z * dx - d.m.x * dz) * inv3;
      az += (d.m.x * dy - d.m.y * dx) * inv3;
    }
    const br = this.bRegions;
    for (let i = 0; i < br.length; i++) {
      const w = regionWeight(br[i].region, p);
      if (w <= 0.0005) continue;
      const c = br[i].c;
      const rx = p.x - c[0], ry = p.y - c[1], rz = p.z - c[2];
      // A = ½ B × r
      ax += 0.5 * w * (br[i].dir.y * rz - br[i].dir.z * ry) * br[i].mag;
      ay += 0.5 * w * (br[i].dir.z * rx - br[i].dir.x * rz) * br[i].mag;
      az += 0.5 * w * (br[i].dir.x * ry - br[i].dir.y * rx) * br[i].mag;
    }

    out.phi = phi; out.ax = ax; out.ay = ay; out.az = az;
    return out;
  };

  FD.Sources = Sources;

  /* ---------------- 洛伦兹变换（c = 1） ---------------- */
  FD.transformFields = function (E, B, v, outE, outB) {
    const b2 = v.x * v.x + v.y * v.y + v.z * v.z;
    if (b2 < 1e-9) {
      outE.x = E.x; outE.y = E.y; outE.z = E.z;
      outB.x = B.x; outB.y = B.y; outB.z = B.z;
      return 1;
    }
    const g = 1 / Math.sqrt(Math.max(1e-4, 1 - b2));
    const vB = V.cross(v, B), vE = V.cross(v, E);
    const ev = (E.x * v.x + E.y * v.y + E.z * v.z) / b2;
    const bv = (B.x * v.x + B.y * v.y + B.z * v.z) / b2;
    const gm1 = g - 1;
    outE.x = g * (E.x + vB.x) - gm1 * ev * v.x;
    outE.y = g * (E.y + vB.y) - gm1 * ev * v.y;
    outE.z = g * (E.z + vB.z) - gm1 * ev * v.z;
    outB.x = g * (B.x - vE.x) - gm1 * bv * v.x;
    outB.y = g * (B.y - vE.y) - gm1 * bv * v.y;
    outB.z = g * (B.z - vE.z) - gm1 * bv * v.z;
    return g;
  };

  /* ---------------- 无受力速度 v* = E×B / B² ---------------- */
  FD.driftVelocity = function (E, B, out) {
    const b2 = V.len2(B);
    if (b2 < 1e-8) { out.x = 0; out.y = 0; out.z = 0; return false; }
    const c = V.cross(E, B);
    out.x = c.x / b2; out.y = c.y / b2; out.z = c.z / b2;
    const perpendicular = Math.abs(V.dot(E, B)) <= 1e-9 * Math.max(1, V.len(E) * V.len(B));
    return perpendicular && V.len2(out) < 1;
  };

  /* ---------------- 稳态速度（霍耳） ---------------- */
  FD.steadyVelocity = function (E, B, q, k, out) {
    const mu = q / k;
    const b2 = V.len2(B);
    const den = 1 + mu * mu * b2;
    const bxE = V.cross(B, E);
    const bdE = V.dot(B, E);
    const s = mu / den;
    out.x = s * (E.x - mu * bxE.x + mu * mu * B.x * bdE);
    out.y = s * (E.y - mu * bxE.y + mu * mu * B.y * bdE);
    out.z = s * (E.z - mu * bxE.z + mu * mu * B.z * bdE);
    return out;
  };

  /* ---------------- 流线追踪 ---------------- */
  function trace(src, kind, start, dirSign, maxSteps, h, bounds) {
    const E = { x: 0, y: 0, z: 0 }, B = { x: 0, y: 0, z: 0 };
    const pts = [], mags = [];
    let p = { x: start.x, y: start.y, z: start.z };
    const F = kind === 'E' ? E : B;
    for (let i = 0; i < maxSteps; i++) {
      src.sample(p, E, B);
      const m = Math.sqrt(F.x * F.x + F.y * F.y + F.z * F.z);
      pts.push(p.x, p.y, p.z);
      mags.push(m);
      if (m < 1e-5) break;
      const s = dirSign * h / m;
      const mx = p.x + F.x * s * 0.5, my = p.y + F.y * s * 0.5, mz = p.z + F.z * s * 0.5;
      const q = { x: mx, y: my, z: mz };
      src.sample(q, E, B);
      const m2 = Math.sqrt(F.x * F.x + F.y * F.y + F.z * F.z) || 1;
      p = { x: p.x + F.x * (dirSign * h / m2), y: p.y + F.y * (dirSign * h / m2), z: p.z + F.z * (dirSign * h / m2) };
      if (Math.abs(p.x) > bounds || Math.abs(p.y) > bounds || Math.abs(p.z) > bounds) {
        pts.push(p.x, p.y, p.z); mags.push(0); break;
      }
    }
    return { p: pts, m: mags };
  }

  function rev3(a) {
    const n = a.length / 3, out = new Array(a.length);
    for (let i = 0; i < n; i++) {
      out[i * 3] = a[(n - 1 - i) * 3];
      out[i * 3 + 1] = a[(n - 1 - i) * 3 + 1];
      out[i * 3 + 2] = a[(n - 1 - i) * 3 + 2];
    }
    return out;
  }
  function rev1(a) { return a.slice().reverse(); }

  /* ---------------- 构建全部流线 ---------------- */
  FD.buildStreamlines = function (src, level) {
    const B0 = level.bounds;
    const out = { E: [], B: [] };
    const seen = [];
    const push = (kind, line, seedPt) => {
      if (line.p.length < 6) return;
      const arr = kind === 'E' ? out.E : out.B;
      if (arr.length >= 100) return;
      line.off = Math.random();
      arr.push(line);
      seen.push({ kind: kind, x: seedPt.x, y: seedPt.y, z: seedPt.z });
    };

    // 从最强的几个点电荷出发
    const ch = src.charges.slice().sort(function (a, b) { return Math.abs(b.q) - Math.abs(a.q); }).slice(0, 5);
    for (let i = 0; i < ch.length; i++) {
      const dirs = FD.fibSphere(9);
      for (let d = 0; d < dirs.length; d++) {
        const dir = dirs[d];
        const st = {
          x: ch[i].p.x + dir.x * 0.85,
          y: ch[i].p.y + dir.y * 0.85,
          z: ch[i].p.z + dir.z * 0.85
        };
        push('E', trace(src, 'E', st, ch[i].q >= 0 ? 1 : -1, 26, 0.8, B0), st);
      }
    }

    // 区域内部种子（局部场区）
    for (let ri = 0; ri < src.raw.length; ri++) {
      const d = src.raw[ri];
      if (!d.region || d.region.type !== 'box') continue;
      const c = d.region.c, h = d.region.h;
      const kind = d.type;
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          for (let k = 0; k < 2; k++) {
            const st = {
              x: c[0] + (i ? 1 : -1) * h[0] * 0.42,
              y: c[1] + (j ? 1 : -1) * h[1] * 0.42,
              z: c[2] + (k ? 1 : -1) * h[2] * 0.42
            };
            const f = trace(src, kind, st, 1, 14, 1.0, B0);
            const b = trace(src, kind, st, -1, 7, 1.0, B0);
            const merged = { p: rev3(b.p).concat(f.p.slice(3)), m: rev1(b.m).concat(f.m.slice(1)) };
            push(kind, merged, st);
          }
        }
      }
    }

    // 网格种子
    const g = 3;
    for (let pass = 0; pass < 2; pass++) {
      const kind = pass === 0 ? 'E' : 'B';
      for (let ix = 0; ix < g; ix++) {
        for (let iy = 0; iy < g; iy++) {
          for (let iz = 0; iz < g; iz++) {
            const st = {
              x: -B0 + (ix + 0.5) * (2 * B0 / g),
              y: -B0 + (iy + 0.5) * (2 * B0 / g),
              z: -B0 + (iz + 0.5) * (2 * B0 / g)
            };
            let dup = false;
            for (let s = 0; s < seen.length; s++) {
              if (seen[s].kind !== kind) continue;
              const dx = seen[s].x - st.x, dy = seen[s].y - st.y, dz = seen[s].z - st.z;
              if (dx * dx + dy * dy + dz * dz < 4.0) { dup = true; break; }
            }
            if (dup) continue;
            const f = trace(src, kind, st, 1, 16, 1.0, B0);
            const b = trace(src, kind, st, -1, 8, 1.0, B0);
            const merged = { p: rev3(b.p).concat(f.p.slice(3)), m: rev1(b.m).concat(f.m.slice(1)) };
            push(kind, merged, st);
          }
        }
      }
    }
    return out;
  };
})();
