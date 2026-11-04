/* ===========================================================
   程序化世界生成：六个紧凑案例 / 三座大型城市区域 / 世界大陆
   =========================================================== */
(function () {
  const MW = window.MW;

  class Builder {
    constructor(world, seed) {
      this.w = world;
      this.seed = seed;
      this.rand = MW.rng(seed);
      this.noise = MW.makeNoise2D(seed ^ 0x9e3779b9);
      this.grassTop = 0x77a83e;
      this.doors = [];
      this.elevators = [];
      this.labels = [];
      this.loot = [];
      this.bridges = [];
    }

    rnd() { return this.rand(); }
    randInt(a, b) { return a + Math.floor(this.rand() * (b - a + 1)); }

    set(x, y, z, c, t, jitter) {
      x = Math.round(x); y = Math.round(y); z = Math.round(z);
      if (jitter) c = MW.shade(c, (this.rand() - 0.5) * jitter);
      this.w.set(x, y, z, c, t || 0, false);
    }

    fill(x1, y1, z1, x2, y2, z2, c, opt) {
      opt = opt || {};
      const jit = opt.jitter == null ? 0.07 : opt.jitter;
      const t = opt.type || 0;
      const ax = Math.min(x1, x2) | 0, bx = Math.max(x1, x2) | 0;
      const ay = Math.min(y1, y2) | 0, by = Math.max(y1, y2) | 0;
      const az = Math.min(z1, z2) | 0, bz = Math.max(z1, z2) | 0;
      for (let x = ax; x <= bx; x++)
        for (let z = az; z <= bz; z++)
          for (let y = ay; y <= by; y++)
            this.set(x, y, z, c, t, jit);
    }

    fillRing(x1, y1, z1, x2, y2, z2, c, opt) {
      opt = opt || {};
      const jit = opt.jitter == null ? 0.07 : opt.jitter;
      const t = opt.type || 0;
      const ax = Math.min(x1, x2) | 0, bx = Math.max(x1, x2) | 0;
      const az = Math.min(z1, z2) | 0, bz = Math.max(z1, z2) | 0;
      const ay = Math.min(y1, y2) | 0, by = Math.max(y1, y2) | 0;
      for (let y = ay; y <= by; y++)
        for (let x = ax; x <= bx; x++)
          for (let z = az; z <= bz; z++) {
            if (x === ax || x === bx || z === az || z === bz) this.set(x, y, z, c, t, jit);
          }
    }

    clear(x1, y1, z1, x2, y2, z2) {
      const ax = Math.min(x1, x2) | 0, bx = Math.max(x1, x2) | 0;
      const ay = Math.min(y1, y2) | 0, by = Math.max(y1, y2) | 0;
      const az = Math.min(z1, z2) | 0, bz = Math.max(z1, z2) | 0;
      for (let x = ax; x <= bx; x++)
        for (let z = az; z <= bz; z++)
          for (let y = ay; y <= by; y++)
            this.w.remove(x, y, z, false);
    }

    surface(x, z) { return this.w.surfaceAt(x, z); }

    flatGround(size, top, sub, opt) {
      opt = opt || {};
      for (let x = -size; x <= size; x++) {
        for (let z = -size; z <= size; z++) {
          const n = MW.fbm(this.noise, x / 24, z / 24, 3);
          this.set(x, 0, z, top, 0, 0.06 + n * 0.04);
          this.set(x, -1, z, sub || MW.PALETTE.dirt[0], 0, 0.06);
          if (opt.deep) this.set(x, -2, z, MW.shade(sub || MW.PALETTE.dirt[0], -0.15), 0, 0.05);
        }
      }
      return 1;
    }

    hillGround(size, baseY, amp, scale) {
      for (let x = -size; x <= size; x++) {
        for (let z = -size; z <= size; z++) {
          const n = MW.fbm(this.noise, x / scale + 10, z / scale + 10, 4, 0.55);
          const h = baseY + Math.floor(n * amp);
          const topC = h >= baseY + amp * 0.75 ? 0x8d959b : this.grassTop;
          this.set(x, h, z, topC, 0, 0.08);
          this.set(x, h - 1, z, MW.PALETTE.dirt[0], 0, 0.06);
          this.set(x, h - 2, z, 0x6f573e, 0, 0.05);
        }
      }
    }

    road(x1, z1, x2, z2, color, y) {
      const ax = Math.min(x1, x2) | 0, bx = Math.max(x1, x2) | 0;
      const az = Math.min(z1, z2) | 0, bz = Math.max(z1, z2) | 0;
      for (let x = ax; x <= bx; x++)
        for (let z = az; z <= bz; z++) {
          const yy = y == null ? this.surface(x, z) - 1 : y;
          this.set(x, yy, z, color, 0, 0.06);
        }
    }

    tree(x, z, h, leaf, opt) {
      opt = opt || {};
      const base = opt.y != null ? opt.y : this.surface(x, z);
      h = h || this.randInt(4, 7);
      leaf = leaf || 0x4f9a3a;
      for (let i = 0; i < h; i++) this.set(x, base + i, z, 0x6b4a2c, 0, 0.1);
      const r = opt.r || (h >= 6 ? 2 : 1);
      for (let dx = -r; dx <= r; dx++)
        for (let dz = -r; dz <= r; dz++)
          for (let dy = 0; dy <= r + 1; dy++) {
            const d = Math.abs(dx) + Math.abs(dz) + Math.abs(dy - 1) * 0.9;
            if (d > r + 1.2) continue;
            if (this.rand() < 0.16) continue;
            this.set(x + dx, base + h - 2 + dy, z + dz, leaf, MW.BLOCK_TYPES.LEAF, 0.13);
          }
      if (opt.pine) {
        for (let i = 0; i < 3; i++) {
          const rr = 2 - i;
          for (let dx = -rr; dx <= rr; dx++)
            for (let dz = -rr; dz <= rr; dz++)
              if (Math.abs(dx) + Math.abs(dz) <= rr + 1)
                this.set(x + dx, base + h - 1 + i, z + dz, leaf, MW.BLOCK_TYPES.LEAF, 0.12);
        }
      }
    }

    palm(x, z, y) {
      const base = y != null ? y : this.surface(x, z);
      const h = this.randInt(6, 9);
      for (let i = 0; i < h; i++) this.set(x, base + i, z, 0x8a6b45, 0, 0.08);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        this.set(x + dx * 2, base + h, z + dz * 2, 0x4f8f3a, MW.BLOCK_TYPES.LEAF, 0.15);
        this.set(x + dx, base + h, z + dz, 0x5da344, MW.BLOCK_TYPES.LEAF, 0.15);
        if (dx && dz) this.set(x + dx, base + h - 1, z + dz, 0x4f8f3a, MW.BLOCK_TYPES.LEAF, 0.15);
      }
      this.set(x, base + h, z, 0x6fb54c, MW.BLOCK_TYPES.LEAF, 0.1);
    }

    sakura(x, z, h, y) {
      const base = y != null ? y : this.surface(x, z);
      h = h || this.randInt(4, 6);
      for (let i = 0; i < h; i++) this.set(x, base + i, z, 0x5a3a2c, 0, 0.08);
      const pinks = [0xffb7c5, 0xf7a8bb, 0xffc9d4, 0xefa0b4];
      for (let dx = -3; dx <= 3; dx++) {
        for (let dz = -3; dz <= 3; dz++) {
          for (let dy = 0; dy <= 3; dy++) {
            if (Math.abs(dx) + Math.abs(dz) + dy * 1.2 > 4.6) continue;
            if (this.rand() < 0.18) continue;
            this.set(x + dx, base + h - 2 + dy, z + dz, pinks[(dx + dz + dy + 8) % pinks.length], 0, 0.08);
          }
        }
      }
    }

    lamp(x, z, y, color, h) {
      const base = y != null ? y : this.surface(x, z);
      h = h || 4;
      for (let i = 0; i < h; i++) this.set(x, base + i, z, 0x4a3a2a, 0, 0.08);
      this.set(x, base + h, z, color || 0xffb347, MW.BLOCK_TYPES.GLOW, 0.05);
      this.set(x, base + h - 1, z, 0xffcf8a, MW.BLOCK_TYPES.GLOW, 0.05);
      if (this.rand() < 0.6) this.set(x + 1, base + h, z, color || 0xffb347, MW.BLOCK_TYPES.GLOW, 0.05);
    }

    lanternString(x1, z1, x2, z2, y) {
      const steps = Math.max(Math.abs(x2 - x1), Math.abs(z2 - z1));
      for (let i = 0; i <= steps; i++) {
        const x = Math.round(x1 + (x2 - x1) * i / steps);
        const z = Math.round(z1 + (z2 - z1) * i / steps);
        if (i % 3 === 2) this.set(x, y, z, 0xff8b3d, MW.BLOCK_TYPES.GLOW, 0.05);
      }
    }

    wallRect(x1, z1, x2, z2, y, h, color, thick) {
      thick = thick || 2;
      const ax = Math.min(x1, x2), bx = Math.max(x1, x2);
      const az = Math.min(z1, z2), bz = Math.max(z1, z2);
      for (let level = 0; level < h; level++) {
        for (let x = ax; x <= bx; x++) {
          for (let tt = 0; tt < thick; tt++) {
            this.set(x, y + level, az + tt, level < 2 ? 0x6d5a4a : color, 0, 0.05);
            this.set(x, y + level, bz - tt, level < 2 ? 0x6d5a4a : color, 0, 0.05);
          }
        }
        for (let z = az; z <= bz; z++) {
          for (let tt = 0; tt < thick; tt++) {
            this.set(ax + tt, y + level, z, level < 2 ? 0x6d5a4a : color, 0, 0.05);
            this.set(bx - tt, y + level, z, level < 2 ? 0x6d5a4a : color, 0, 0.05);
          }
        }
      }
      // 城垛
      for (let x = ax; x <= bx; x += 3) {
        this.set(x, y + h, az, 0x7a2a22, 0, 0.04);
        this.set(x, y + h, bz, 0x7a2a22, 0, 0.04);
        this.set(x, y + h + 1, az, 0x8a3227, 0, 0.04);
        this.set(x, y + h + 1, bz, 0x8a3227, 0, 0.04);
      }
      for (let z = az; z <= bz; z += 3) {
        this.set(ax, y + h, z, 0x7a2a22, 0, 0.04);
        this.set(bx, y + h, z, 0x7a2a22, 0, 0.04);
        this.set(ax, y + h + 1, z, 0x8a3227, 0, 0.04);
        this.set(bx, y + h + 1, z, 0x8a3227, 0, 0.04);
      }
    }

    roof(x1, z1, x2, z2, y, color, ridgeColor, opt) {
      opt = opt || {};
      let a1 = Math.min(x1, x2) | 0, a2 = Math.max(x1, x2) | 0;
      let b1 = Math.min(z1, z2) | 0, b2 = Math.max(z1, z2) | 0;
      const layers = opt.layers || 4;
      const shrinkX = Math.max(1, Math.round((a2 - a1 - 4) / (layers * 2)));
      const shrinkZ = Math.max(1, Math.round((b2 - b1 - 4) / (layers * 2)));
      for (let i = 0; i < layers; i++) {
        if (a1 > a2 || b1 > b2) break;
        this.fill(a1, y + i, b1, a2, y + i, b2, color, { jitter: 0.09 });
        // 飞檐
        if (i === 0) {
          this.set(a1, y + 1, b1, ridgeColor, 0, 0.04);
          this.set(a2, y + 1, b1, ridgeColor, 0, 0.04);
          this.set(a1, y + 1, b2, ridgeColor, 0, 0.04);
          this.set(a2, y + 1, b2, ridgeColor, 0, 0.04);
          this.set(a1 - 1, y + 1, b1 - 1, color, 0, 0.05);
          this.set(a2 + 1, y + 1, b1 - 1, color, 0, 0.05);
          this.set(a1 - 1, y + 1, b2 + 1, color, 0, 0.05);
          this.set(a2 + 1, y + 1, b2 + 1, color, 0, 0.05);
        }
        a1 += shrinkX; a2 -= shrinkX; b1 += shrinkZ; b2 -= shrinkZ;
      }
      if (a1 <= a2 && b1 <= b2) {
        const cy = y + layers;
        this.fill(a1, cy, b1, a2, cy, b2, color, { jitter: 0.04 });
        if (a2 - a1 >= b2 - b1) {
          const zc = Math.floor((b1 + b2) / 2);
          this.fill(a1, cy + 1, zc, a2, cy + 1, zc, ridgeColor, { jitter: 0.03 });
          this.set(a1 - 1, cy + 1, zc, ridgeColor, 0, 0.02);
          this.set(a2 + 1, cy + 1, zc, ridgeColor, 0, 0.02);
          this.set(a1, cy + 2, zc, ridgeColor, 0, 0.02);
          this.set(a2, cy + 2, zc, ridgeColor, 0, 0.02);
        } else {
          const xc = Math.floor((a1 + a2) / 2);
          this.fill(xc, cy + 1, b1, xc, cy + 1, b2, ridgeColor, { jitter: 0.03 });
          this.set(xc, cy + 2, b1, ridgeColor, 0, 0.02);
          this.set(xc, cy + 2, b2, ridgeColor, 0, 0.02);
        }
      }
    }

    stairs(x1, z1, x2, y, steps, color, dirZ) {
      dirZ = dirZ == null ? 1 : dirZ;
      for (let i = 0; i < steps; i++) {
        const z = z1 + i * dirZ;
        this.fill(x1, y - i - 1, z, x2, y - i - 1, z, color, { jitter: 0.04 });
        this.fill(x1, y - i - 1, z + dirZ, x2, y - i - 2, z + dirZ, color, { jitter: 0.03 });
      }
    }

    hall(cx, cz, w, d, groundY, opt) {
      opt = opt || {};
      const x1 = Math.floor(cx - w / 2), x2 = Math.floor(cx + w / 2);
      const z1 = Math.floor(cz - d / 2), z2 = Math.floor(cz + d / 2);
      const wallC = opt.wall || 0x9d2f26;
      const roofC = opt.roof || 0xd8a531;
      const ridgeC = opt.ridge || 0x8a5a12;
      const marble = opt.marble || 0xcfc7ae;
      const wallH = opt.h || 9;
      let by = groundY;
      if (opt.terrace !== false) {
        const tw = opt.terraceW || 3;
        this.fill(x1 - tw, groundY, z1 - tw, x2 + tw, groundY + 1, z2 + tw, marble, { jitter: 0.06 });
        for (let i = 0; i < 2; i++) {
          this.fill(cx - 4, groundY, z2 + tw + 1 + i, cx + 4, groundY, z2 + tw + 1 + i, marble, { jitter: 0.04 });
        }
        by = groundY + 2;
        // 台阶栏柱
        for (let sx = -4; sx <= 4; sx += 8) {
          this.set(cx + sx, by, z2 + tw, marble, 0, 0.02);
        }
      }
      // 地板
      this.fill(x1, by, z1, x2, by, z2, opt.floor || 0x8f8774, { jitter: 0.05 });
      // 墙
      this.fillRing(x1, by + 1, z1, x2, by + wallH, z2, wallC, { jitter: 0.06 });
      // 柱子
      for (let x = x1 + 2; x <= x2 - 2; x += 5) {
        this.fill(x, by + 1, z1, x, by + wallH, z1, 0x6e241c, { jitter: 0.04 });
        this.fill(x, by + 1, z2, x, by + wallH, z2, 0x6e241c, { jitter: 0.04 });
      }
      for (let z = z1 + 2; z <= z2 - 2; z += 5) {
        this.fill(x1, by + 1, z, x1, by + wallH, z, 0x6e241c, { jitter: 0.04 });
        this.fill(x2, by + 1, z, x2, by + wallH, z, 0x6e241c, { jitter: 0.04 });
      }
      // 门窗
      this.clear(cx - 2, by + 1, z2, cx + 2, by + 4, z2);
      this.clear(cx - 1, by + 1, z2, cx + 1, by + 3, z2);
      this.clear(cx - 2, by + 1, z1, cx + 2, by + 4, z1);
      this.doors.push({ x: cx, z: z2, y: by, w: 4.6, h: 3, name: (opt.doorName || '殿门'), color: 0x8e2b23 });
      if (opt.windows !== false) {
        for (let x = x1 + 3; x <= x2 - 3; x += 5) {
          for (let f = 0; f < 2; f++) {
            const wy = by + 3 + f * 4;
            this.set(x, wy, z1, 0x6fa6bd, MW.BLOCK_TYPES.GLASS, 0.02);
            this.set(x, wy, z2, 0x6fa6bd, MW.BLOCK_TYPES.GLASS, 0.02);
          }
        }
      }
      const roofY = by + wallH + 1;
      this.roof(x1 - 2, z1 - 2, x2 + 2, z2 + 2, roofY, roofC, ridgeC, { layers: opt.layers || 5 });
      if (opt.tv !== false && w > 26) {
        // 屋脊兽
        this.set(cx, roofY + 6, z1 - 2, 0xd9a531, 0, 0.02);
      }
      return roofY + 5;
    }

    gate(cx, cz, w, d, y, opt) {
      opt = opt || {};
      const x1 = Math.floor(cx - w / 2), x2 = Math.floor(cx + w / 2);
      const z1 = Math.floor(cz - d / 2), z2 = Math.floor(cz + d / 2);
      const h = opt.h || 12;
      this.fill(x1, y, z1, x2, y + h, z2, opt.wall || 0x9d2f26, { jitter: 0.05 });
      // 门洞
      this.clear(cx - 3, y, z1 - 1, cx + 3, y + 6, z2 + 1);
      this.roof(x1 - 3, z1 - 3, x2 + 3, z2 + 3, y + h + 1, opt.roof || 0xd8a531, opt.ridge || 0x8a5a12, { layers: 4 });
      if (opt.towers !== false) {
        for (const sx of [x1, x2]) {
          for (const sz of [z1, z2]) {
            this.fill(sx - 3, y + h + 2, sz - 3, sx + 3, y + h + 6, sz + 3, opt.wall || 0x9d2f26, { jitter: 0.05 });
            this.roof(sx - 4, sz - 4, sx + 4, sz + 4, y + h + 7, opt.roof || 0xd8a531, opt.ridge || 0x8a5a12, { layers: 3 });
          }
        }
      }
      return y + h;
    }

    pavilion(cx, cz, y, size, opt) {
      opt = opt || {};
      const half = Math.floor(size / 2);
      const cols = [[-half, -half], [half, -half], [-half, half], [half, half]];
      for (const [dx, dz] of cols) {
        this.fill(cx + dx, y, cz + dz, cx + dx, y + 4, cz + dz, 0x7a2a22, { jitter: 0.04 });
      }
      this.fill(cx - half, y, cz - half, cx + half, y, cz + half, 0x9a9180, { jitter: 0.04 });
      this.roof(cx - half - 2, cz - half - 2, cx + half + 2, cz + half + 2, y + 5, opt.roof || 0xd8a531, 0x8a5a12, { layers: 3 });
      this.set(cx, y + 4, cz, 0xffc46b, MW.BLOCK_TYPES.GLOW, 0.03);
    }

    pagoda(cx, cz, y, tiers, baseSize) {
      y = y || this.surface(cx, cz);
      let size = baseSize || 14;
      let cy = y;
      this.fill(cx - size / 2 - 2, y, cz - size / 2 - 2, cx + size / 2 + 2, y + 1, cz + size / 2 + 2, 0x9a9180, { jitter: 0.05 });
      cy = y + 2;
      for (let t = 0; t < tiers; t++) {
        const s = Math.max(4, Math.round(size * (1 - t * 0.11)));
        const h = t === 0 ? 5 : 3;
        const hx = Math.floor(s / 2);
        this.fill(cx - hx, cy, cz - hx, cx + hx, cy + h, cz + hx, t % 2 ? 0xb08a4a : 0x9d5a33, { jitter: 0.05 });
        this.clear(cx - 1, cy, cz - hx - 1, cx + 1, cy + 2, cz - hx + 1);
        this.roof(cx - hx - 2, cz - hx - 2, cx + hx + 2, cz + hx + 2, cy + h + 1, t % 2 ? 0x3f6b52 : 0x8a3a28, 0x5a2f1c, { layers: 2 });
        cy += h + 4;
      }
      this.fill(cx, cy, cz, cx, cy + 4, cz, 0xd9a531, 0, 0.02);
      for (let i = 0; i < 3; i++) this.set(cx, cy + 3 + i, cz, 0xffcf6b, MW.BLOCK_TYPES.GLOW, 0.03);
      return cy + 4;
    }

    modern(cx, cz, w, d, y, h, opt) {
      opt = opt || {};
      const x1 = Math.floor(cx - w / 2), x2 = Math.floor(cx + w / 2);
      const z1 = Math.floor(cz - d / 2), z2 = Math.floor(cz + d / 2);
      const wallC = opt.wall || 0xcfc9bd;
      const glassC = opt.glass || 0x5fa7c4;
      const floorC = opt.floor || 0x8f8b82;
      const floors = Math.max(1, Math.floor(h / 4));
      for (let f = 0; f < floors; f++) {
        const fy = y + f * 4;
        this.fill(x1, fy, z1, x2, fy, z2, floorC, { jitter: 0.04 });
        this.fillRing(x1, fy + 1, z1, x2, fy + 3, z2, wallC, { jitter: 0.04 });
        // 玻璃带
        for (let x = x1 + 2; x <= x2 - 2; x += 3) {
          this.set(x, fy + 1, z1, glassC, MW.BLOCK_TYPES.GLASS, 0.06);
          this.set(x, fy + 2, z1, glassC, MW.BLOCK_TYPES.GLASS, 0.06);
          this.set(x, fy + 1, z2, glassC, MW.BLOCK_TYPES.GLASS, 0.06);
          this.set(x, fy + 2, z2, glassC, MW.BLOCK_TYPES.GLASS, 0.06);
        }
        for (let z = z1 + 2; z <= z2 - 2; z += 3) {
          this.set(x1, fy + 1, z, glassC, MW.BLOCK_TYPES.GLASS, 0.06);
          this.set(x1, fy + 2, z, glassC, MW.BLOCK_TYPES.GLASS, 0.06);
          this.set(x2, fy + 1, z, glassC, MW.BLOCK_TYPES.GLASS, 0.06);
          this.set(x2, fy + 2, z, glassC, MW.BLOCK_TYPES.GLASS, 0.06);
        }
        // 内部教室/房间隔墙
        if (opt.rooms !== false && w >= 14) {
          for (let px = x1 + 7; px <= x2 - 7; px += 7) {
            for (let z = z1 + 1; z <= z2 - 1; z++) {
              if (Math.abs(z - cz) <= 1) continue;
              this.fill(px, fy + 1, z, px, fy + 3, z, MW.shade(wallC, -0.06), { jitter: 0.03 });
            }
            // 门洞 / 黑板 / 课桌
            for (let z = z1 + 2; z <= z2 - 2; z += 5) {
              this.set(px + 1, fy + 1, z, 0x6b4a2c, 0, 0.03);
              this.set(px + 1, fy + 2, z, 0x6b4a2c, 0, 0.03);
            }
            const bx = Math.min(x2 - 2, px + 4);
            this.fill(bx, fy + 2, z1 + 1, bx + 2, fy + 3, z1 + 1, 0x244a3f, { jitter: 0.02 });
          }
        }
        // 天花板灯与内部地板纹理
        for (let x = x1 + 3; x <= x2 - 3; x += 8) {
          this.set(x, fy + 3, cz, 0xffd9a0, MW.BLOCK_TYPES.GLOW, 0.02);
        }
        // 教室课桌
        if (opt.desk !== false) {
          for (let x = x1 + 3; x <= x2 - 4; x += 5) {
            if (Math.abs(x - cx) < 3) continue;
            for (let z = z1 + 3; z <= z2 - 3; z += 4) {
              this.set(x, fy + 1, z, 0x8a6b45, 0, 0.03);
              this.set(x + 1, fy + 1, z, 0x7d5f3c, 0, 0.03);
              this.set(x, fy + 1, z + 1, 0x4a3326, 0, 0.03);
            }
          }
        }
        // 房间内随机物资
        if (this.rand() < 0.58) {
          const loot = ['medkit', 'armor', 'ammo_light', 'ammo_heavy', 'smg', 'rifle', 'shotgun', 'sniper'];
          this.loot.push({ item: loot[this.randInt(0, loot.length - 1)], x: cx, y: fy + 1, z: cz });
        }
      }
      // 中央入口
      this.clear(cx - 2, y + 1, z2, cx + 2, y + 3, z2);
      this.clear(cx - 2, y, z2 - 1, cx + 2, y + 3, z2);
      this.fill(cx - 3, y + 4, z2 + 1, cx + 3, y + 4, z2 + 2, 0x3e3f43, { jitter: 0.03 });
      this.set(cx, y + 4, z2 + 1, 0x8fd8ff, MW.BLOCK_TYPES.GLOW, 0.02);
      // 外部楼梯塔（东侧，逐层折返，与建筑之间有桥接）
      if (opt.stairs !== false && d >= 6) {
        const tx1 = x2 + 3, tx2 = x2 + 6;
        const tz1 = z1 + 1, tz2 = tz1 + 6;
        const topY = y + floors * 4;
        this.fill(tx1, y, tz1, tx2, y, tz2, 0x8a857a, { jitter: 0.04 });
        for (let f = 0; f < floors; f++) {
          const base = y + f * 4;
          const even = f % 2 === 0;
          const lane1 = even ? tx1 : tx2 - 1;
          const lane2 = even ? tx1 + 1 : tx2;
          for (let i = 0; i < 4; i++) {
            const zz = even ? tz1 + 1 + i : tz2 - 1 - i;
            const yy = base + i;
            this.fill(lane1, yy, zz, lane2, yy, zz, 0xb9b2a4, { jitter: 0.03 });
            // 楼梯两侧防坠护栏
            this.set(lane1 - 1, yy + 1, zz, 0x7c7a70, 0, 0.03);
            this.set(lane2 + 1, yy + 1, zz, 0x7c7a70, 0, 0.03);
          }
          // 楼层平台与通往室内的门洞
          const ly = base + 4;
          this.fill(tx1, ly, tz1, tx2, ly, tz2, 0x9a9488, { jitter: 0.03 });
          // 楼梯上方留出上人口，避免被楼板封死
          if (even) this.clear(lane1, ly, tz1 + 1, lane2, ly, tz1 + 4);
          else this.clear(lane1, ly, tz2 - 4, lane2, ly, tz2 - 1);
          // 楼梯塔与建筑之间的桥接
          this.fill(x2, ly, tz1 + 2, tx1, ly, tz1 + 4, 0xa9a294, { jitter: 0.03 });
          this.set(x2 + 1, ly + 1, tz1 + 2, 0x6f6e64, 0, 0.02);
          this.set(x2 + 1, ly + 1, tz1 + 4, 0x6f6e64, 0, 0.02);
          this.clear(x2, ly + 1, tz1 + 2, x2, ly + 3, tz1 + 3);
          this.doors.push({
            x: x2, z: tz1 + 2.5, y: ly, w: 2.8, h: 3, axis: 'x',
            name: (opt.name || '大楼') + ` ${f + 1}F 楼梯桥门`
          });
        }
        // 楼梯塔护栏与顶部小屋檐
        for (let yy = y; yy <= topY; yy += 1) {
          this.set(tx1 - 1, yy, tz1, 0x8d8a82, 0, 0.03);
          this.set(tx2 + 1, yy, tz2, 0x8d8a82, 0, 0.03);
          if (yy % 2 === 0) {
            this.set(tx2 + 1, yy, tz1, 0x8d8a82, 0, 0.03);
            this.set(tx1 - 1, yy, tz2, 0x8d8a82, 0, 0.03);
          }
        }
        this.fill(tx1 - 1, topY + 1, tz1 - 1, tx2 + 1, topY + 1, tz2 + 1, 0x7b776e, { jitter: 0.03 });
        this.set(tx1, y + 2, tz2 + 1, 0xffd27a, MW.BLOCK_TYPES.GLOW, 0.02);
        // 楼梯导视灯带
        for (let yy = y + 1; yy <= topY; yy += 2) {
          this.set(tx2 + 1, yy, tz1 + 2, 0x64f0ff, MW.BLOCK_TYPES.GLOW, 0.02);
        }
        // 独立电梯井（建筑内部西南角，远离楼梯）
        if (floors >= 2) {
          const ex = x1 + 3, ez = z2 - 4;
          // 清空井道内部
          this.clear(ex - 1, y, ez - 1, ex + 1, topY + 1, ez + 1);
          // 玻璃/金属井道墙
          for (let yy = y; yy <= topY + 1; yy++) {
            for (let x = ex - 2; x <= ex + 2; x++) {
              this.set(x, yy, ez - 2, 0x6b7c86, MW.BLOCK_TYPES.GLASS, 0.02);
              this.set(x, yy, ez + 2, 0x6b7c86, MW.BLOCK_TYPES.GLASS, 0.02);
            }
            for (let z = ez - 2; z <= ez + 2; z++) {
              this.set(ex - 2, yy, z, 0x6b7c86, MW.BLOCK_TYPES.GLASS, 0.02);
              this.set(ex + 2, yy, z, 0x6b7c86, MW.BLOCK_TYPES.GLASS, 0.02);
            }
          }
          // 每层电梯门洞
          for (let f = 0; f < floors; f++) {
            const fy = y + f * 4;
            this.clear(ex - 1, fy + 1, ez + 2, ex + 1, fy + 3, ez + 2);
            this.set(ex - 1, fy + 4, ez + 2, 0x64f0ff, MW.BLOCK_TYPES.GLOW, 0.02);
          }
          this.elevators.push({
            x: ex, z: ez, y, floors,
            name: (opt.name || '大楼') + '电梯',
            spawnX: ex, spawnZ: ez + 3
          });
          if (this.elevators.length === 1) {
            this.labels.push({ text: '电梯', x: ex, y: y + 6, z: ez + 3, color: 0x64f0ff, width: 5 });
            this.labels.push({ text: '楼梯 · 桥', x: tx2 + 2, y: y + 6, z: tz2 + 1, color: 0x64f0ff, width: 6 });
          }
        }
        this.doors.push({ x: cx, z: z2, y: y, w: 4.8, h: 3, name: (opt.name || '大楼') + '入口' });
      } else {
        this.doors.push({ x: cx, z: z2, y: y, w: 4.8, h: 3, name: (opt.name || '大楼') + '入口' });
      }
      const topY = y + floors * 4;
      const roofC = opt.roof || 0x9a958c;
      this.fill(x1, topY, z1, x2, topY, z2, roofC, { jitter: 0.04 });
      // 顶部逐层收分，形成更流线型的建筑轮廓
      const crown = Math.min(3, Math.max(1, Math.floor(Math.min(w, d) / 8)));
      for (let i = 1; i <= crown; i++) {
        const ix = Math.min(Math.floor(w / 3), i + 1);
        const iz = Math.min(Math.floor(d / 3), i + 1);
        if (x1 + ix > x2 - ix || z1 + iz > z2 - iz) break;
        this.fill(x1 + ix, topY + i, z1 + iz, x2 - ix, topY + i, z2 - iz,
          MW.shade(roofC, i % 2 ? 0.08 : -0.05), { jitter: 0.03 });
      }
      this.set(cx, topY + crown + 1, cz, 0xff6b5a, MW.BLOCK_TYPES.GLOW, 0.02);
      return topY;
    }

    gableHouse(cx, cz, w, d, y, h, wallC, roofC) {
      const x1 = Math.floor(cx - w / 2), x2 = Math.floor(cx + w / 2);
      const z1 = Math.floor(cz - d / 2), z2 = Math.floor(cz + d / 2);
      this.fill(x1, y, z1, x2, y, z2, 0x8f8574, { jitter: 0.04 });
      this.fillRing(x1, y + 1, z1, x2, y + h, z2, wallC, { jitter: 0.06 });
      this.clear(cx - 1, y + 1, z2, cx + 1, y + 3, z2);
      this.clear(cx - 1, y + 3, z1, cx + 1, y + 4, z1);
      // 木屋窗户
      for (let x = x1 + 3; x <= x2 - 3; x += 4) {
        this.set(x, y + 2, z1, 0x6fa6bd, MW.BLOCK_TYPES.GLASS, 0.02);
        this.set(x, y + 3, z1, 0x6fa6bd, MW.BLOCK_TYPES.GLASS, 0.02);
        if (Math.abs(x - cx) > 2) {
          this.set(x, y + 2, z2, 0x6fa6bd, MW.BLOCK_TYPES.GLASS, 0.02);
          this.set(x, y + 3, z2, 0x6fa6bd, MW.BLOCK_TYPES.GLASS, 0.02);
        }
      }
      for (let i = 0; i < 3; i++) {
        const zz1 = z1 - 1 + i, zz2 = z2 + 1 - i;
        this.fill(x1 - 1, y + h + i, zz1, x2 + 1, y + h + i, zz1, roofC, { jitter: 0.06 });
        this.fill(x1 - 1, y + h + i, zz2, x2 + 1, y + h + i, zz2, roofC, { jitter: 0.06 });
        if (i === 2) this.fill(x1 - 1, y + h + i, zz1, x2 + 1, y + h + i, zz2, roofC, { jitter: 0.05 });
      }
      this.fill(x1 - 1, y + h + 3, cz, x2 + 1, y + h + 3, cz, MW.shade(roofC, -0.2), { jitter: 0.02 });
      this.set(cx, y + h + 4, cz, 0x7a2a22, 0, 0.02);
      this.doors.push({ x: cx, z: z2, y: y, w: 2.8, h: 3, name: '木屋入口', color: 0x6b4a2c });
      if (this.rand() < 0.5) this.loot.push({ item: 'medkit', x: cx, y: y + 1, z: cz });
      if (this.rand() < 0.5) this.lamp(cx + x2 - x1 + 1, cz, y, 0xffa24a, 3);
      return y + h + 4;
    }

    track(cx, cz, rx, rz, y) {
      y = y == null ? this.surface(cx, cz) - 1 : y;
      const red = 0xa8422f, line = 0xe7e2d6, green = 0x4f8f3e;
      for (let x = cx - rx; x <= cx + rx; x++) {
        for (let z = cz - rz; z <= cz + rz; z++) {
          const nx = (x - cx) / rx, nz = (z - cz) / rz;
          const d = Math.max(Math.abs(nx), Math.abs(nz));
          if (d > 0.98) continue;
          if (d > 0.6) {
            this.set(x, y, z, red, 0, 0.05);
            if (Math.abs(d - 0.6) < 0.012 || Math.abs(d - 0.72) < 0.012 || Math.abs(d - 0.84) < 0.012 || Math.abs(d - 0.95) < 0.012) {
              this.set(x, y, z, line, 0, 0.01);
            }
          } else {
            this.set(x, y, z, green, 0, 0.06);
          }
        }
      }
      // 球门
      this.fill(cx - 5, y + 1, cz - rz + 2, cx + 5, y + 1, cz - rz + 2, 0xeeeeee, { jitter: 0.01 });
      this.fill(cx - 5, y + 1, cz + rz - 2, cx + 5, y + 1, cz + rz - 2, 0xeeeeee, { jitter: 0.01 });
    }
  }

  /* =========================================================
     紫禁城
     ========================================================= */
  function genForbidden(b, meta) {
    const size = 70;
    b.flatGround(size, 0x77a83e, 0x6f573e);
    // 宫城广场
    b.fill(-58, 0, -54, 58, 0, 56, 0x9a9488, { jitter: 0.055 });
    b.fill(-56, 0, -52, 56, 0, 54, 0xa39c8d, { jitter: 0.045 });
    // 中轴御道
    b.fill(-9, 0, 62, 9, 0, -54, 0xb9b1a0, { jitter: 0.03 });
    b.fill(-10, 0, 56, 10, 0, 64, 0xb9b1a0, { jitter: 0.03 });
    // 金水河
    b.clear(-36, 0, 37, 36, 0, 41);
    b.fill(-36, -1, 37, 36, -1, 41, 0x3f5d68, { jitter: 0.04 });
    b.fill(-36, 0, 37, 36, 0, 37, 0xbcb4a3, { jitter: 0.03 });
    b.fill(-36, 0, 41, 36, 0, 41, 0xbcb4a3, { jitter: 0.03 });
    b.fill(-36, 0, 37, 36, 0, 41, 0x32789a, MW.BLOCK_TYPES.WATER, 0.02);
    for (const bx of [-24, 0, 24]) {
      b.fill(bx - 3, 1, 36, bx + 3, 1, 42, 0xc6bda9, { jitter: 0.03 });
      b.fill(bx - 3, 0, 36, bx - 3, 0, 42, 0xb1a692, { jitter: 0.03 });
      b.fill(bx + 3, 0, 36, bx + 3, 0, 42, 0xb1a692, { jitter: 0.03 });
    }
    // 外城墙
    b.wallRect(-56, -52, 56, 56, 1, 11, 0x8e2b23, 4);
    b.clear(-8, 1, 54, 8, 7, 58);
    // 城门楼：午门
    b.gate(0, 56, 32, 10, 1, { h: 11, towers: true });
    b.clear(-4, 1, 49, 4, 7, 63);
    b.fill(-6, 8, 50, 6, 8, 62, 0x9d2f26, { jitter: 0.04 });
    b.roof(-9, 49, 9, 63, 9, 0xd8a531, 0x8a5a12, { layers: 4 });
    // 角楼
    for (const [cx, cz] of [[-56, -52], [56, -52], [-56, 56], [56, 56]]) {
      b.fill(cx - 5, 1, cz - 5, cx + 5, 14, cz + 5, 0x933026, { jitter: 0.05 });
      b.roof(cx - 7, cz - 7, cx + 7, cz + 7, 15, 0xd8a531, 0x8a5a12, { layers: 4 });
      b.set(cx, 22, cz, 0xffc46b, MW.BLOCK_TYPES.GLOW, 0.02);
    }
    // 太和门
    b.gate(0, 32, 20, 8, 1, { h: 8, towers: false });
    b.clear(-3, 1, 27, 3, 6, 37);
    // 三大殿台基与建筑
    b.hall(0, 8, 32, 16, 1, { h: 10, terraceW: 4, roof: 0xd8a531, layers: 5 });
    b.hall(0, -14, 14, 14, 1, { h: 8, terraceW: 2, roof: 0xd8a531, layers: 4 });
    b.hall(0, -34, 26, 14, 1, { h: 9, terraceW: 2, roof: 0xd8a531, layers: 5 });
    // 两侧廊庑
    for (const sx of [-1, 1]) {
      for (let zz = 30; zz >= -40; zz -= 18) {
        b.hall(sx * 38, zz, 10, 12, 1, { h: 5, terrace: false, roof: 0x3f7a52, layers: 3, windows: true });
      }
      b.hall(sx * 27, -2, 7, 26, 1, { h: 4, terrace: false, roof: 0x3f7a52, layers: 3, windows: false });
    }
    // 御花园
    for (const [x, z] of [[-30, -46], [-18, -48], [22, -46], [34, -44], [-8, -48], [12, -44]]) {
      b.tree(x, z, b.randInt(5, 8), 0xc58b35);
    }
    b.pavilion(-26, -44, 1, 10, { roof: 0x3f7a52 });
    b.pavilion(26, -44, 1, 10, { roof: 0x3f7a52 });
    b.fill(-36, 1, -48, 36, 1, -44, 0x8f8574, { jitter: 0.04 });
    // 嘉量、铜狮等小品
    for (const [x, z] of [[-14, 36], [14, 36], [-14, 44], [14, 44]]) {
      b.fill(x, 1, z, x, 2, z, 0x7d6a4a, { jitter: 0.03 });
      b.set(x, 3, z, 0xd8a531, 0, 0.02);
    }
    for (const [x, z] of [[-12, 26], [12, 26]]) {
      b.fill(x - 1, 1, z - 1, x + 1, 2, z + 1, 0x6b5b45, { jitter: 0.05 });
    }
    // 护城河（宫墙外一圈）
    const carveMoat = (mx1, mz1, mx2, mz2) => {
      for (let x = mx1; x <= mx2; x++) {
        for (let z = mz1; z <= mz2; z++) {
          b.clear(x, -6, z, x, 0, z);
          b.set(x, -6, z, 0x5f5b52, 0, 0.04);
          for (let yy = -5; yy <= -1; yy++) b.set(x, yy, z, 0x2f7fa8, MW.BLOCK_TYPES.WATER, 0.02);
        }
      }
    };
    carveMoat(-72, -70, -64, 74);
    carveMoat(64, -70, 72, 74);
    carveMoat(-72, 68, 72, 74);
    carveMoat(-72, -70, 72, -62);
    // 四座主门：南午门、北神武门、东华门、西华门
    b.clear(-6, 1, -56, 6, 7, -48);
    b.fill(-9, 8, -56, 9, 10, -48, 0x9d2f26, { jitter: 0.04 });
    b.roof(-10, -57, 10, -47, 11, 0xd8a531, 0x8a5a12, { layers: 3 });
    b.clear(50, 1, -6, 60, 7, 6);
    b.fill(52, 8, -8, 58, 10, 8, 0x9d2f26, { jitter: 0.04 });
    b.roof(51, -9, 59, 9, 11, 0xd8a531, 0x8a5a12, { layers: 3 });
    b.clear(-60, 1, -6, -50, 7, 6);
    b.fill(-58, 8, -8, -52, 10, 8, 0x9d2f26, { jitter: 0.04 });
    b.roof(-59, -9, -51, 9, 11, 0xd8a531, 0x8a5a12, { layers: 3 });
    // 四门外桥面（城门吊桥在桥面上方升降）
    b.fill(56, 1, -4, 77, 1, 4, 0xc6bda9, { jitter: 0.03 });
    b.fill(-77, 1, -4, -56, 1, 4, 0xc6bda9, { jitter: 0.03 });
    b.fill(-4, 1, 56, 4, 1, 77, 0xc6bda9, { jitter: 0.03 });
    b.fill(-4, 1, -73, 4, 1, -52, 0xc6bda9, { jitter: 0.03 });
    b.doors.push(
      { x: 0, z: 56, y: 1, w: 8, h: 6, axis: 'z', name: '午门', gateId: 'south', color: 0x8e2b23 },
      { x: 0, z: -52, y: 1, w: 8, h: 6, axis: 'z', name: '神武门', gateId: 'north', color: 0x8e2b23 },
      { x: 56, z: 0, y: 1, w: 8, h: 6, axis: 'x', name: '东华门', gateId: 'east', color: 0x8e2b23 },
      { x: -56, z: 0, y: 1, w: 8, h: 6, axis: 'x', name: '西华门', gateId: 'west', color: 0x8e2b23 }
    );
    b.bridges.push(
      { id: 'south', x: 0, z: 56.6, y: 1, axis: 'z', dir: 1, len: 18, width: 8 },
      { id: 'north', x: 0, z: -52.6, y: 1, axis: 'z', dir: -1, len: 18, width: 8 },
      { id: 'east', x: 56.6, z: 0, y: 1, axis: 'x', dir: 1, len: 18, width: 8 },
      { id: 'west', x: -56.6, z: 0, y: 1, axis: 'x', dir: -1, len: 18, width: 8 }
    );
    // 城垛炮口 / 角楼通道
    for (const [cx, cz] of [[-56, -52], [56, -52], [-56, 56], [56, 56]]) {
      b.clear(cx - 7, 12, cz - 1, cx + 7, 13, cz + 1);
      b.clear(cx - 1, 12, cz - 7, cx + 1, 13, cz + 7);
    }
    // 城墙内侧连续护栏
    for (let x = -54; x <= 54; x++) {
      if (Math.abs(x) < 10) continue;
      b.set(x, 12, 52, 0x8d3a2e, 0, 0.02);
      b.set(x, 12, -48, 0x8d3a2e, 0, 0.02);
    }
    for (let z = -48; z <= 52; z++) {
      if (Math.abs(z) < 10) continue;
      b.set(52, 12, z, 0x8d3a2e, 0, 0.02);
      b.set(-48, 12, z, 0x8d3a2e, 0, 0.02);
    }
    // 城门外的石桥
    b.fill(-4, 1, 62, 4, 1, 71, 0xc6bda9, { jitter: 0.03 });
    b.fill(-4, 2, 62, -4, 2, 71, 0x9a9180, { jitter: 0.03 });
    b.fill(4, 2, 62, 4, 2, 71, 0x9a9180, { jitter: 0.03 });
    b.fill(-4, 1, -67, 4, 1, -53, 0xc6bda9, { jitter: 0.03 });
    b.fill(-4, 2, -67, -4, 2, -53, 0x9a9180, { jitter: 0.03 });
    b.fill(4, 2, -67, 4, 2, -53, 0x9a9180, { jitter: 0.03 });
    // 登城步道（两侧）
    for (const side of [-1, 1]) {
      const sx = side * 44;
      for (let i = 0; i < 11; i++) {
        const x = sx + side * i;
        b.fill(x, 1 + i, 43, x, 1 + i, 45, 0xb8b0a0, { jitter: 0.03 });
        b.clear(x, 2 + i, 43, x, 7 + i, 45);
      }
      b.set(sx + side * 5, 9, 42, 0xffc46b, MW.BLOCK_TYPES.GLOW, 0.02);
    }
    const cannons = [
      { x: -30, y: 12, z: 55, yaw: Math.PI, name: '午门红衣炮' },
      { x: -22, y: 12, z: 55, yaw: Math.PI, name: '午门红衣炮' },
      { x: 22, y: 12, z: 55, yaw: Math.PI, name: '午门红衣炮' },
      { x: 30, y: 12, z: 55, yaw: Math.PI, name: '午门红衣炮' },
      { x: 55, y: 12, z: 12, yaw: -Math.PI / 2, name: '东华门红衣炮' },
      { x: -55, y: 12, z: 12, yaw: Math.PI / 2, name: '西华门红衣炮' },
      { x: 10, y: 12, z: -51, yaw: 0, name: '神武门红衣炮' }
    ];
    // 炮口：清掉正前方的女墙，避免炮管穿模
    for (const c of cannons) {
      if (Math.abs(c.yaw) < 0.1) b.clear(c.x - 1, 12, c.z - 1, c.x + 1, 13, c.z - 1);
      else if (Math.abs(Math.abs(c.yaw) - Math.PI) < 0.1) b.clear(c.x - 1, 12, c.z + 1, c.x + 1, 13, c.z + 1);
      else if (c.yaw < 0) b.clear(c.x + 1, 12, c.z - 1, c.x + 1, 13, c.z + 1);
      else b.clear(c.x - 1, 12, c.z - 1, c.x - 1, 13, c.z + 1);
    }
    // 宫外树木与道路（避开护城河）
    for (let i = 0; i < 12; i++) {
      const x = b.randInt(-56, 56), z = b.randInt(57, 63);
      if (Math.abs(x) < 12) continue;
      b.tree(x, z, b.randInt(4, 7), 0xc58b35);
    }
    for (let i = 0; i < 8; i++) {
      const x = b.randInt(-56, 56), z = b.randInt(-57, -53);
      b.tree(x, z, b.randInt(4, 7), 0xa8782f);
    }
    // 路灯
    for (const z of [62, 44, 24, 4, -16, -44]) {
      b.lamp(-12, z, 1, 0xffb347, 4);
      b.lamp(12, z, 1, 0xffb347, 4);
    }
    return {
      spawn: [0, 19, 56],
      spawnYaw: 0,
      spawnPitch: -0.12,
      waterLevel: null,
      fallbackColor: 0x77a83e,
      labels: [
        { text: '午门', x: 0, y: 23, z: 56, color: 0xffc46b, width: 8 },
        { text: '神武门', x: 0, y: 23, z: -52, color: 0xffc46b, width: 8 },
        { text: '东华门', x: 56, y: 20, z: 0, color: 0xffc46b, width: 8 },
        { text: '西华门', x: -56, y: 20, z: 0, color: 0xffc46b, width: 8 },
        { text: '太和门', x: 0, y: 17, z: 32, color: 0xffc46b, width: 8 },
        { text: '太和殿', x: 0, y: 25, z: 8, color: 0xffc46b, width: 10 },
        { text: '中和殿', x: -8, y: 21, z: -14, color: 0xffc46b, width: 8 },
        { text: '保和殿', x: 8, y: 24, z: -34, color: 0xffc46b, width: 8 },
        { text: '御花园', x: 0, y: 9, z: -44, color: 0x9fe6a8, width: 7 },
        { text: '护城河', x: 0, y: 4, z: 68, color: 0x7fd8ff, width: 7 },
        { text: '城墙步道', x: -50, y: 16, z: 0, color: 0xa8c4d8, width: 8 }
      ],
      zones: [
        { name: '午门', x: 0, z: 46, r: 8, enemy: true },
        { name: '太和殿广场', x: 0, z: 24, r: 12, enemy: true },
        { name: '御花园', x: 0, z: -44, r: 10, enemy: true }
      ],
      vehicles: [{ type: 'tank', x: 18, z: 44, name: '禁卫坦克' }],
      cannons,
      pickups: [
        { item: 'rifle', x: 14, z: 50 }, { item: 'shotgun', x: -18, z: 44 },
        { item: 'medkit', x: 8, z: 34 }, { item: 'ammo_light', x: -8, z: 30 },
        { item: 'sniper', x: 30, z: -44 }, { item: 'rpg', x: -32, z: -44 }
      ]
    };
  }

  /* =========================================================
     唐长安 · 不夜城
     ========================================================= */
  function genChangan(b, meta) {
    const size = 70;
    b.flatGround(size, 0x6f6a5d, 0x594f42);
    // 朱雀大街
    b.road(-8, -64, 8, 64, 0x8d8472);
    b.fill(-8, 0, -64, 8, 0, 64, 0x8d8472, { jitter: 0.04 });
    for (const z of [-48, -28, -8, 12, 32, 52]) {
      b.fill(-64, 0, z - 4, 64, 0, z + 4, 0x827968, { jitter: 0.045 });
    }
    // 城墙与城门
    b.wallRect(-64, -62, 64, 62, 1, 10, 0x5d4a3a, 2);
    b.clear(-8, 1, 60, 8, 8, 64);
    b.gate(0, 62, 30, 12, 1, { h: 11, wall: 0x6b4b36, roof: 0x7a3a2a, ridge: 0x40251a });
    b.clear(-4, 1, 55, 4, 7, 68);
    // 大雁塔
    b.pagoda(32, -46, 1, 7, 16);
    b.fill(18, 1, -58, 46, 1, -34, 0x8a806d, { jitter: 0.04 });
    // 朱雀门内广场
    b.fill(-20, 0, 40, 20, 0, 56, 0x9a907c, { jitter: 0.04 });
    // 夜市摊位
    const stalls = [[-14, 20], [-20, 16], [-13, 8], [14, 18], [20, 12], [12, 4], [-18, 28], [18, 28]];
    for (const [x, z] of stalls) {
      b.fill(x - 2, 1, z - 2, x + 2, 1, z + 2, 0x7b5230, { jitter: 0.05 });
      b.fill(x - 2, 2, z - 2, x + 2, 3, z - 2, [0xb94b3a, 0x3f6b8a, 0xc08a3e][b.randInt(0, 2)], { jitter: 0.05 });
      b.set(x, 4, z, 0xffc46b, MW.BLOCK_TYPES.GLOW, 0.03);
      b.set(x - 2, 4, z, 0xff8b3d, MW.BLOCK_TYPES.GLOW, 0.03);
      b.set(x + 2, 4, z, 0xff8b3d, MW.BLOCK_TYPES.GLOW, 0.03);
    }
    // 坊市房屋
    const blocksX = [[-60, -34], [-28, -12], [12, 28], [34, 60]];
    const blocksZ = [[-56, -34], [-24, -12], [-4, 8], [16, 28], [36, 56]];
    for (const [x1, x2] of blocksX) {
      for (const [z1, z2] of blocksZ) {
        const cx = Math.floor((x1 + x2) / 2), cz = Math.floor((z1 + z2) / 2);
        const floors = b.randInt(1, 2);
        const w = Math.min(x2 - x1 - 6, b.randInt(9, 14));
        const d = Math.min(z2 - z1 - 6, b.randInt(8, 12));
        b.gableHouse(cx, cz, w, d, 1, 4 + floors * 2, [0xa98d6a, 0xb7a184, 0x8f7758][b.randInt(0, 2)], [0x5a3a2a, 0x7a3a2a, 0x4a3a3a][b.randInt(0, 2)]);
        b.lamp(cx - Math.floor(w / 2) - 3, cz + Math.floor(d / 2) + 2, 1, 0xffa24a, 4);
        b.lamp(cx + Math.floor(w / 2) + 3, cz + Math.floor(d / 2) + 2, 1, 0xffa24a, 4);
      }
    }
    // 主街灯笼
    for (let z = -58; z <= 58; z += 10) {
      b.lamp(-11, z, 1, 0xff7a3a, 5);
      b.lamp(11, z, 1, 0xff7a3a, 5);
      b.lanternString(-11, z, 11, z, 10);
    }
    // 城内树木
    for (let i = 0; i < 18; i++) {
      const x = b.randInt(-60, 60), z = b.randInt(-58, 56);
      if (Math.abs(x) < 14) continue;
      if (x > 16 && x < 48 && z > -60 && z < -32) continue;
      b.tree(x, z, b.randInt(4, 6), 0x4f8f3a);
    }
    // 人工湖/曲江池
    b.clear(-60, 0, -24, -42, 0, 4);
    b.fill(-60, -1, -24, -42, -1, 4, 0x2e5f6e, { jitter: 0.03 });
    b.fill(-60, 0, -24, -42, 0, 4, 0x2c7392, MW.BLOCK_TYPES.WATER, 0.02);
    b.fill(-42, 1, -10, -34, 1, -2, 0x9a907c, { jitter: 0.03 });
    b.lamp(-40, -12, 1, 0xff8b3d, 3);
    return {
      spawn: [0, 2, 48],
      waterLevel: null,
      fallbackColor: 0x6f6a5d,
      labels: [
        { text: '朱雀门', x: 0, y: 17, z: 62, color: 0xffb347, width: 8 },
        { text: '大雁塔', x: 32, y: 55, z: -46, color: 0xffc46b, width: 8 },
        { text: '西市', x: -40, y: 10, z: 16, color: 0xffb347, width: 6 },
        { text: '曲江池', x: -50, y: 6, z: -10, color: 0x7fd8ff, width: 7 }
      ],
      zones: [
        { name: '朱雀门', x: 0, z: 50, r: 11, enemy: true },
        { name: '大雁塔', x: 22, z: -44, r: 12, enemy: true },
        { name: '西市', x: -40, z: 20, r: 13, enemy: true }
      ],
      vehicles: [{ type: 'apc', x: -18, z: 60, name: '金吾卫装甲车' }],
      pickups: [
        { item: 'smg', x: -6, z: 24 }, { item: 'rifle', x: 16, z: 20 },
        { item: 'medkit', x: 6, z: 14 }, { item: 'ammo_light', x: -16, z: 12 },
        { item: 'shotgun', x: 34, z: -30 }, { item: 'armor', x: -40, z: 20 }
      ]
    };
  }

  /* =========================================================
     电子科技大学 · 清水河
     ========================================================= */
  function genUestc(b, meta) {
    const size = 70;
    b.flatGround(size, 0x76a846, 0x6a583f);
    // 校园道路
    b.fill(-66, 0, 42, 66, 0, 52, 0x53565b, { jitter: 0.03 });
    b.fill(-6, 0, -64, 6, 0, 64, 0x53565b, { jitter: 0.03 });
    b.fill(-64, 0, -2, 64, 0, 6, 0x53565b, { jitter: 0.03 });
    b.fill(-64, 0, -52, 64, 0, -44, 0x53565b, { jitter: 0.03 });
    // 主楼
    b.modern(0, -20, 44, 18, 1, 26, { wall: 0xcfc7b6, glass: 0x5b9cbe });
    b.fill(-4, 28, -26, 4, 34, -14, 0x8fa9b5, { jitter: 0.04 });
    b.fill(-5, 35, -27, 5, 35, -13, 0x9aa6ad, { jitter: 0.03 });
    // 图书馆
    b.modern(-36, 16, 26, 18, 1, 18, { wall: 0xb8c3c4, glass: 0x6fc3d8 });
    b.fill(-36, 20, 7, -36, 23, 25, 0x76b8cc, { jitter: 0.03 });
    // 清水河湖
    const lakeX = 34, lakeZ = 26, lakeR = 16;
    for (let x = lakeX - lakeR; x <= lakeX + lakeR; x++) {
      for (let z = lakeZ - lakeR; z <= lakeZ + lakeR; z++) {
        const d = Math.sqrt((x - lakeX) ** 2 + (z - lakeZ) ** 2);
        if (d > lakeR) continue;
        b.clear(x, -1, z, x, 0, z);
        b.set(x, -2, z, 0x6b5a41, 0, 0.04);
        if (d < lakeR - 1.5) b.set(x, 0, z, 0x2f7fa8, MW.BLOCK_TYPES.WATER, 0.02);
        else b.set(x, 0, z, 0xbdb49f, 0, 0.04);
      }
    }
    // 湖心亭与木桥
    b.pavilion(lakeX, lakeZ, 1, 10, { roof: 0x4a6b5a });
    b.fill(lakeX - 2, 1, lakeZ + 10, lakeX + 2, 1, lakeZ + 22, 0x8a6b45, { jitter: 0.03 });
    b.fill(lakeX - 2, 1, lakeZ - 22, lakeX + 2, 1, lakeZ - 10, 0x8a6b45, { jitter: 0.03 });
    // 教学楼
    b.modern(30, -42, 30, 12, 1, 16, { wall: 0xd3cbbc, glass: 0x5e9db8 });
    b.modern(-32, -42, 26, 12, 1, 16, { wall: 0xd3cbbc, glass: 0x5e9db8 });
    // 食堂与会堂
    b.modern(-54, -18, 16, 12, 1, 10, { wall: 0xcbb79b, glass: 0x6fa6bd, roof: 0x8a6b45, name: '食堂' });
    b.modern(-56, -38, 14, 14, 1, 12, { wall: 0xb9c2c2, glass: 0x6fc3d8, roof: 0x5a6a6e, name: '成电会堂' });
    // 宿舍区
    for (let i = 0; i < 3; i++) {
      b.modern(50, -26 + i * 18, 16, 12, 1, 20, { wall: 0xc9b79e, glass: 0x6b8f9e, roof: 0x8a8276 });
    }
    // 体育场
    b.track(-38, 34, 22, 14, 0);
    // 银杏大道
    for (let z = -60; z <= 60; z += 9) {
      if (Math.abs(z) < 8) continue;
      b.tree(-10, z, b.randInt(5, 7), 0xd6a23a);
      b.tree(10, z, b.randInt(5, 7), 0xd6a23a);
    }
    for (let x = -60; x <= 60; x += 11) {
      if (Math.abs(x) < 10) continue;
      b.tree(x, 56, b.randInt(4, 6), 0xd6a23a);
      b.tree(x, 36, b.randInt(4, 6), 0xd6a23a);
    }
    // 长椅、路灯
    for (let i = 0; i < 10; i++) {
      const x = b.randInt(-58, 58), z = b.randInt(-40, 58);
      if (Math.abs(x) < 8 && Math.abs(z) < 40) continue;
      b.lamp(x, z, 1, 0xcfd8dc, 4);
    }
    // 校门
    b.fill(-16, 1, 60, -12, 8, 60, 0xd8d2c4, { jitter: 0.04 });
    b.fill(12, 1, 60, 16, 8, 60, 0xd8d2c4, { jitter: 0.04 });
    b.fill(-12, 7, 60, 12, 8, 60, 0x3f6b8a, { jitter: 0.03 });
    b.fill(-16, 9, 60, 16, 9, 60, 0x9e988a, { jitter: 0.03 });
    return {
      spawn: [0, 2, 60],
      waterLevel: null,
      fallbackColor: 0x76a846,
      labels: [
        { text: '主楼', x: 0, y: 38, z: -20, color: 0x7fd8ff, width: 7 },
        { text: '图书馆', x: -36, y: 27, z: 16, color: 0x7fd8ff, width: 8 },
        { text: '清水河湖', x: 34, y: 7, z: 26, color: 0x7fd8ff, width: 7 },
        { text: '银杏大道', x: 0, y: 8, z: 24, color: 0xffc46b, width: 7 },
        { text: '体育场', x: -38, y: 8, z: 34, color: 0x9fe6a8, width: 7 },
        { text: '学生宿舍', x: 50, y: 26, z: -15, color: 0xffc46b, width: 7 },
        { text: '教学楼', x: 30, y: 22, z: -42, color: 0x7fd8ff, width: 7 },
        { text: '食堂', x: -54, y: 17, z: -18, color: 0xffc46b, width: 6 },
        { text: '成电会堂', x: -56, y: 20, z: -38, color: 0x7fd8ff, width: 7 },
        { text: '电子科技大学', x: 0, y: 14, z: 61, color: 0xe8edf2, width: 8 },
        { text: '校门', x: 0, y: 13, z: 60, color: 0xe8edf2, width: 6 }
      ],
      zones: [
        { name: '主楼', x: 0, z: -4, r: 12, enemy: true },
        { name: '图书馆', x: -36, z: 32, r: 12, enemy: true },
        { name: '体育场', x: -38, z: 34, r: 14, enemy: true }
      ],
      vehicles: [
        { type: 'drone', x: 8, z: 56, name: '侦察无人机' },
        { type: 'car', x: 20, z: 54, name: '校园接驳车' }
      ],
      pickups: [
        { item: 'rifle', x: 4, z: 44 }, { item: 'medkit', x: -10, z: 38 },
        { item: 'ammo_light', x: 10, z: 30 }, { item: 'smg', x: -34, z: 32 },
        { item: 'sniper', x: 50, z: -20 }, { item: 'armor', x: -36, z: 8 }
      ]
    };
  }

  /* =========================================================
     珠海市第一中学
     ========================================================= */
  function genZh1z(b, meta) {
    const size = 68;
    b.flatGround(size, 0x74a844, 0x6a583f);
    // 校门大道
    b.fill(-7, 0, -60, 7, 0, 60, 0x9a958a, { jitter: 0.04 });
    b.fill(-60, 0, 10, 60, 0, 18, 0x9a958a, { jitter: 0.04 });
    // U 型教学楼
    b.modern(0, -26, 46, 12, 1, 16, { wall: 0xe0d6c4, glass: 0x6fa6bd });
    b.modern(-24, -8, 12, 26, 1, 16, { wall: 0xe0d6c4, glass: 0x6fa6bd });
    b.modern(24, -8, 12, 26, 1, 16, { wall: 0xe0d6c4, glass: 0x6fa6bd });
    b.fill(-8, 1, -8, 8, 1, 2, 0x9a9284, { jitter: 0.04 });
    // 操场
    b.track(-34, 38, 24, 15, 0);
    // 体育馆
    b.modern(38, 32, 24, 18, 1, 13, { wall: 0xc9d2d6, glass: 0x7fb7c9, roof: 0x7d8b93 });
    b.roof(24, 21, 52, 43, 15, 0x8a98a0, 0x5d686e, { layers: 2 });
    // 宿舍
    b.modern(34, -26, 18, 14, 1, 20, { wall: 0xd7b48c, glass: 0x6c9cae, roof: 0x8a7b68 });
    b.modern(34, -48, 18, 12, 1, 20, { wall: 0xd7b48c, glass: 0x6c9cae, roof: 0x8a7b68 });
    // 食堂
    b.modern(-38, 0, 20, 16, 1, 10, { wall: 0xe3cba7, glass: 0x76a8b6 });
    // 校门
    b.fill(-15, 1, 56, -10, 9, 56, 0xcfc6b2, { jitter: 0.04 });
    b.fill(10, 1, 56, 15, 9, 56, 0xcfc6b2, { jitter: 0.04 });
    b.fill(-15, 8, 56, 15, 9, 56, 0x445a6b, { jitter: 0.03 });
    b.fill(-15, 10, 56, 15, 10, 56, 0x8f9aa0, { jitter: 0.03 });
    // 国旗
    b.fill(0, 1, 26, 0, 18, 26, 0xc9c9c9, { jitter: 0.02 });
    b.fill(1, 15, 26, 5, 18, 26, 0xd33b32, { jitter: 0.02 });
    b.fill(1, 17, 26, 2, 18, 26, 0xf2c744, { jitter: 0.01 });
    // 树与灯
    for (let i = 0; i < 22; i++) {
      const x = b.randInt(-62, 62), z = b.randInt(-60, 60);
      if (Math.abs(x) < 10) continue;
      if (x < -8 && x > -60 && z > 20 && z < 55) continue;
      b.tree(x, z, b.randInt(4, 7), 0x4f9a3a);
    }
    for (let z = -56; z <= 52; z += 12) {
      b.lamp(-9, z, 1, 0xdfe8ee, 4);
      b.lamp(9, z, 1, 0xdfe8ee, 4);
    }
    return {
      spawn: [0, 2, 60],
      waterLevel: null,
      fallbackColor: 0x74a844,
      labels: [
        { text: '教学楼', x: 0, y: 22, z: -26, color: 0x7fd8ff, width: 8 },
        { text: '体育馆', x: 38, y: 20, z: 32, color: 0x7fd8ff, width: 8 },
        { text: '操场', x: -34, y: 8, z: 38, color: 0x9fe6a8, width: 6 },
        { text: '学生宿舍', x: 34, y: 27, z: -26, color: 0xffc46b, width: 8 },
        { text: '食堂', x: -38, y: 13, z: 0, color: 0xffc46b, width: 6 },
        { text: '珠海市第一中学', x: 0, y: 14, z: 57, color: 0xe8edf2, width: 10 },
        { text: '校门', x: 0, y: 13, z: 56, color: 0xe8edf2, width: 6 }
      ],
      zones: [
        { name: '教学楼', x: 0, z: 6, r: 13, enemy: true },
        { name: '操场', x: -34, z: 38, r: 15, enemy: true },
        { name: '学生宿舍', x: 34, z: -8, r: 12, enemy: true }
      ],
      vehicles: [
        { type: 'apc', x: 12, z: 52, name: '校园装甲车' },
        { type: 'car', x: -10, z: 48, name: '校园巡逻车' }
      ],
      pickups: [
        { item: 'smg', x: 8, z: 44 }, { item: 'medkit', x: -10, z: 30 },
        { item: 'ammo_light', x: 12, z: 22 }, { item: 'shotgun', x: -34, z: 20 },
        { item: 'rifle', x: 36, z: -12 }, { item: 'ammo_shell', x: -28, z: 36 }
      ]
    };
  }

  /* =========================================================
     台湾 · 海峡战线
     ========================================================= */
  function genTaiwan(b, meta) {
    const size = 78, WL = 4, cx = -2, cz = -4;
    const townRect = [-44, 4, -6, 34];
    const fortRect = [-20, -12, 10, 12];
    const radar = { x: 30, z: -24 };
    const inRect = (x, z, r) => x >= r[0] && z >= r[1] && x <= r[2] && z <= r[3];

    // 海床（只保留可见的两层）
    for (let x = -size; x <= size; x++) {
      for (let z = -size; z <= size; z++) {
        b.set(x, -3, z, 0x8b7d5c, 0, 0.05);
        b.set(x, -2, z, 0xa2946d, 0, 0.05);
      }
    }

    // 岛屿轮廓与地形
    for (let x = -size; x <= size; x++) {
      for (let z = -size; z <= size; z++) {
        const dx = x - cx, dz = z - cz;
        const ang = Math.atan2(dz, dx);
        const coast = 44 + (b.noise(Math.cos(ang) * 2 + 30, Math.sin(ang) * 2 + 30) - 0.5) * 12;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d > coast) continue;
        const edge = (coast - d) / coast;
        let h = 5 + Math.floor(edge * 2);
        if (inRect(x, z, townRect)) h = 6;
        if (inRect(x, z, fortRect)) h = 7;
        const md = Math.sqrt((x - radar.x) ** 2 + (z - radar.z) ** 2);
        if (md < 30) {
          h = Math.max(h, Math.floor(9 + Math.pow(1 - md / 30, 1.5) * 19 + b.noise(x * 0.12 + 50, z * 0.12 + 50) * 4));
        }
        if (h < 4) h = 4;
        const beach = edge < 0.08 || h <= 5;
        const top = beach ? 0xdccb95 : (h > 17 ? 0x8d959b : 0x6f9e42);
        for (let y = Math.max(-1, h - 3); y <= h; y++) {
          let c;
          if (y === h) c = top;
          else if (beach) c = 0xcbb87c;
          else if (y >= h - 1) c = 0x7a6244;
          else c = 0x6b5740;
          b.set(x, y, z, c, 0, 0.07);
        }
      }
    }

    // 港镇道路（铺在 6 层台地表面）
    b.fill(-40, 6, 8, -30, 6, 35, 0x8b8577, { jitter: 0.04 });
    b.fill(-40, 6, 18, -8, 6, 24, 0x8b8577, { jitter: 0.04 });
    b.fill(-10, 6, 10, -4, 6, 30, 0x8b8577, { jitter: 0.04 });

    // 木码头
    for (let x = -42; x <= -36; x++) {
      for (let z = 38; z <= 48; z++) {
        if (z % 4 === 0) {
          b.set(x, 2, z, 0x5b4228, 0, 0.04);
          b.set(x, 3, z, 0x5b4228, 0, 0.04);
          b.set(x, 4, z, 0x5b4228, 0, 0.04);
        }
        if (x % 2 === 0 || z % 4 === 0) b.set(x, 5, z, 0x9a7a4e, 0, 0.05);
      }
    }
    b.fill(-42, 5, 37, -36, 5, 48, 0x9a7a4e, { jitter: 0.05 });
    b.fill(-42, 6, 35, -36, 6, 36, 0x8a6b45, { jitter: 0.04 });
    b.set(-40, 6, 47, 0xffb347, MW.BLOCK_TYPES.GLOW, 0.02);
    b.set(-40, 7, 47, 0xffd27a, MW.BLOCK_TYPES.GLOW, 0.02);

    // 港镇房屋
    const houses = [[-30, 12, 12, 9], [-18, 26, 11, 9], [-38, 22, 10, 8], [-14, 8, 9, 8], [-26, 30, 8, 7]];
    for (const [hx, hz, hw, hd] of houses) {
      b.gableHouse(hx, hz, hw, hd, 7, b.randInt(4, 6), [0xd8c8a8, 0xc9b493, 0xb9a88a][b.randInt(0, 2)], [0x8a3a2a, 0x6b4a3a][b.randInt(0, 1)]);
    }
    for (const [lx, lz] of [[-35, 16], [-22, 20], [-38, 28], [-12, 16]]) b.lamp(lx, lz, 7, 0xffc27a, 4);

    // 安平古堡
    const fx = -4, fz = 2, fy = 8;
    b.fill(fx - 13, 8, fz - 11, fx + 13, 8, fz + 13, 0x9a8f78, { jitter: 0.05 });
    b.wallRect(fx - 11, fz - 9, fx + 11, fz + 11, fy, 6, 0xa86a48, 2);
    b.clear(fx - 3, fy, fz + 10, fx + 3, fy + 4, fz + 13);
    b.fill(fx - 3, fy + 1, fz - 3, fx + 3, fy + 12, fz + 3, 0xb07a52, { jitter: 0.05 });
    b.roof(fx - 6, fz - 6, fx + 6, fz + 6, fy + 13, 0x7a3a2a, 0x3f2418, { layers: 4 });
    b.set(fx, fy + 18, fz, 0xffc46b, MW.BLOCK_TYPES.GLOW, 0.02);
    b.lamp(fx - 8, fz + 9, fy, 0xffb347, 4);
    b.lamp(fx + 8, fz + 9, fy, 0xffb347, 4);

    // 山顶雷达站
    const ry = b.surface(radar.x, radar.z);
    b.fill(radar.x - 9, ry, radar.z - 9, radar.x + 9, ry, radar.z + 9, 0x9a958a, { jitter: 0.05 });
    b.fill(radar.x - 5, ry + 1, radar.z - 5, radar.x + 5, ry + 6, radar.z + 5, 0xb0b4b6, { jitter: 0.04 });
    b.fill(radar.x - 2, ry + 7, radar.z - 2, radar.x + 2, ry + 12, radar.z + 2, 0x8d9296, { jitter: 0.04 });
    b.fill(radar.x + 1, ry + 10, radar.z, radar.x + 12, ry + 10, radar.z, 0xd8dde0, { jitter: 0.03 });
    b.set(radar.x, ry + 13, radar.z, 0x64f0ff, MW.BLOCK_TYPES.GLOW, 0.02);

    // 棕榈与路灯
    for (let i = 0; i < 46; i++) {
      const x = b.randInt(-56, 56), z = b.randInt(-56, 56);
      const sy = b.surface(x, z);
      if (sy <= WL + 1 || sy > 18) continue;
      if (inRect(x, z, townRect) || inRect(x, z, fortRect)) continue;
      if (Math.abs(x - radar.x) < 12 && Math.abs(z - radar.z) < 12) continue;
      b.palm(x, z, sy);
    }
    for (const [lx, lz] of [[-30, 34], [-6, 20], [8, 12], [-18, 36]]) b.lamp(lx, lz, b.surface(lx, lz), 0xffcf8a, 4);

    return {
      spawn: [-39, 6, 45],
      spawnYaw: -1.15,
      waterLevel: WL,
      labels: [
        { text: '港口', x: -34, y: 11, z: 26, color: 0x7fd8ff, width: 6 },
        { text: '安平古堡', x: -4, y: 18, z: 2, color: 0xffc46b, width: 8 },
        { text: '山顶雷达站', x: 30, y: 42, z: -24, color: 0x7fd8ff, width: 9 },
        { text: '木码头', x: -39, y: 7, z: 45, color: 0xffc46b, width: 6 }
      ],
      zones: [
        { name: '港口', x: -34, z: 28, r: 12, enemy: true },
        { name: '安平古堡', x: -4, z: 18, r: 12, enemy: true },
        { name: '山顶雷达站', x: 24, z: -12, r: 11, enemy: true }
      ],
      vehicles: [{ type: 'boat', x: -34, z: 45, name: '海峡巡逻艇' }],
      enemyShips: [{ x: 12, z: 64, type: 'warship' }, { x: -66, z: 10, type: 'warship' }],
      pickups: [
        { item: 'rifle', x: -34, z: 30, y: 7 }, { item: 'medkit', x: -39, z: 43, y: 7 },
        { item: 'rpg', x: -2, z: 12, y: 9 }, { item: 'ammo_rocket', x: 2, z: 10, y: 9 },
        { item: 'sniper', x: 27, z: -18 }, { item: 'armor', x: -22, z: 18, y: 7 }
      ]
    };
  }

  function genJapan(b, meta) {
    const size = 116, WL = 1;
    const fuji = { x: 6, z: -84, r: 32, h: 62 };

    // 海床
    for (let x = -size; x <= size; x++) {
      for (let z = -size; z <= size; z++) b.set(x, -2, z, 0x8b7d5c, 0, 0.04);
    }

    // 陆地、海岸、富士山
    for (let x = -size; x <= size; x++) {
      for (let z = -size; z <= size; z++) {
        const shore = 50 + (b.noise(x * 0.05 + 20, z * 0.03 + 20) - 0.5) * 18;
        let land = !(x > -20 && z > shore);
        if (Math.hypot(x - 82, z - 62) < 21) land = false;
        if (!land) continue;
        let h = 2;
        const fd = Math.hypot(x - fuji.x, z - fuji.z);
        if (fd < fuji.r) h = Math.max(h, Math.floor(2 + Math.pow(1 - fd / fuji.r, 1.55) * fuji.h));
        if (h > 4) {
          for (let yy = 2; yy <= h - 2; yy++) b.set(x, yy, z, yy > h - 8 ? 0x7d756a : 0x6b6358, 0, 0.05);
        }
        const snow = h > 30;
        const beach = !snow && z > shore - 8;
        const top = snow ? 0xeef3f7 : (beach ? 0xd9c78e : 0x6fa84a);
        b.set(x, h, z, top, 0, 0.06);
        b.set(x, h - 1, z, snow ? 0xcddae2 : (beach ? 0xcbb87c : 0x7a6244), 0, 0.05);
      }
    }

    // 城市道路
    b.fill(-8, 2, -35, 8, 2, 46, 0x4a4e55, { jitter: 0.03 });
    b.fill(-52, 2, 20, 52, 2, 27, 0x4a4e55, { jitter: 0.03 });
    b.fill(-30, 2, -10, 30, 2, -5, 0x4a4e55, { jitter: 0.03 });
    // 斑马线
    for (let x = -7; x <= 7; x += 2) {
      b.set(x, 2, 21, 0xe8e6df, 0, 0.01);
      b.set(x, 2, 26, 0xe8e6df, 0, 0.01);
    }
    for (let z = 21; z <= 26; z += 2) {
      b.set(-7, 2, z, 0xe8e6df, 0, 0.01);
      b.set(7, 2, z, 0xe8e6df, 0, 0.01);
    }

    // 城市建筑
    b.modern(0, -20, 22, 16, 3, 18, { wall: 0x3c4b55, glass: 0x64b7d4, roof: 0x2c363d, name: '中央大厦' });
    b.modern(-16, -2, 14, 12, 3, 24, { wall: 0x5a4a44, glass: 0x6fa6bd, roof: 0x3a2e2a, name: '西城写字楼' });
    b.modern(22, -2, 16, 12, 3, 30, { wall: 0x4a4f58, glass: 0x5aa8c4, roof: 0x2f343a, name: '东城大厦' });
    b.modern(-16, 34, 14, 12, 3, 20, { wall: 0x6b5a4b, glass: 0x6fa6bd, roof: 0x4a3e34, name: '西城公寓' });
    b.modern(22, 34, 16, 12, 3, 18, { wall: 0x594e46, glass: 0x6fa6bd, roof: 0x3a312a, name: '东城公寓' });
    b.modern(-16, 12, 10, 8, 3, 12, { wall: 0x7d6a55, glass: 0x7fb7c9, roof: 0x4a3a2a, name: '街区商场' });

    // 东京塔
    const tw = { x: 22, z: -22 };
    for (let lvl = 0; lvl <= 34; lvl++) {
      const half = Math.max(1, 4 - Math.floor(lvl / 9));
      const c = lvl % 6 < 3 ? 0xd84b3e : 0xe8e6df;
      for (const [dx, dz] of [[-half, -half], [half, -half], [-half, half], [half, half]]) {
        b.set(tw.x + dx, 3 + lvl, tw.z + dz, c, 0, 0.02);
      }
      if (lvl % 6 === 0) b.fill(tw.x - half, 3 + lvl, tw.z - half, tw.x + half, 3 + lvl, tw.z + half, c, { jitter: 0.02 });
    }
    b.fill(tw.x - 5, 37, tw.z - 5, tw.x + 5, 37, tw.z + 5, 0x8d9296, { jitter: 0.02 });
    b.set(tw.x, 42, tw.z, 0xff5a4a, MW.BLOCK_TYPES.GLOW, 0.02);
    b.set(tw.x, 43, tw.z, 0xffd27a, MW.BLOCK_TYPES.GLOW, 0.02);

    // 涩谷霓虹
    for (const [x, z] of [[-12, 22], [12, 22], [-12, 27], [12, 27]]) {
      b.fill(x, 3, z, x + 1, 7, z + 1, 0x1c2230, { jitter: 0.02 });
      b.set(x, 6, z, [0xff5a4a, 0x64f0ff, 0xffb347, 0xc084ff][(x + z + 20) % 4], MW.BLOCK_TYPES.GLOW, 0.02);
    }
    for (let i = 0; i < 10; i++) {
      const x = b.randInt(-7, 7), z = b.randInt(-30, 40);
      if (Math.abs(x) < 9) continue;
    }
    // 樱花
    for (let z = -28; z <= 42; z += 9) {
      if (z > 15 && z < 31) continue;
      b.sakura(-12, z, b.randInt(4, 6), 3);
      b.sakura(12, z, b.randInt(4, 6), 3);
    }

    // 跑道
    b.fill(-80, 2, -28, -62, 2, 62, 0x3f444b, { jitter: 0.02 });
    for (let z = -24; z <= 58; z += 8) b.fill(-72, 2, z, -70, 2, z + 2, 0xe8e6df, { jitter: 0.01 });
    for (let z = -28; z <= 62; z += 10) {
      b.set(-82, 3, z, 0x64f0ff, MW.BLOCK_TYPES.GLOW, 0.02);
      b.set(-60, 3, z, 0x64f0ff, MW.BLOCK_TYPES.GLOW, 0.02);
    }
    // 机库
    const hangar = (cx, cz) => {
      const x1 = cx - 12, x2 = cx + 12, z1 = cz - 8, z2 = cz + 8;
      b.fill(x1, 3, z1, x2, 3, z2, 0x8d9296, { jitter: 0.03 });
      b.fill(x2, 4, z1, x2, 9, z2, 0x6b737a, { jitter: 0.03 });
      b.fill(x1, 4, z1, x2, 9, z1, 0x596168, { jitter: 0.03 });
      b.fill(x1, 4, z2, x2, 9, z2, 0x596168, { jitter: 0.03 });
      b.fill(x1, 9, z1, x2, 9, z2, 0x7d858c, { jitter: 0.03 });
      b.fill(x1, 4, z1 + 2, x1, 8, z2 - 2, 0x2a3036, { jitter: 0.02 });
      b.set(cx, 10, cz, 0xffd9a0, MW.BLOCK_TYPES.GLOW, 0.02);
    };
    hangar(-42, 8);
    hangar(-42, 34);

    // 控制塔、营房、雷达、导弹阵地
    b.modern(-52, 50, 10, 10, 3, 26, { wall: 0x8d9296, glass: 0x6fa6bd, roof: 0x596168, stairs: false, rooms: false, name: '控制塔' });
    b.modern(-84, 4, 24, 12, 3, 12, { wall: 0x9a8f7a, glass: 0x6fa6bd, roof: 0x6b5a45, name: '营房' });
    b.modern(-84, 24, 20, 10, 3, 10, { wall: 0x9a8f7a, glass: 0x6fa6bd, roof: 0x6b5a45, name: '食堂' });
    // 雷达塔
    b.fill(-30, 3, 50, -26, 14, 54, 0xb0b4b6, { jitter: 0.03 });
    b.fill(-31, 15, 49, -25, 15, 55, 0xd8dde0, { jitter: 0.02 });
    b.set(-28, 16, 52, 0x64f0ff, MW.BLOCK_TYPES.GLOW, 0.02);
    // 导弹发射位
    for (const [mx, mz] of [[-92, 12], [-92, 26], [-92, 40], [-92, 54]]) {
      b.fill(mx - 3, 3, mz - 3, mx + 3, 3, mz + 3, 0x9a958a, { jitter: 0.03 });
      b.fill(mx, 4, mz, mx, 10, mz, 0x6b737a, { jitter: 0.02 });
      b.set(mx, 11, mz, 0xd84b3e, 0, 0.02);
      b.set(mx, 12, mz, 0xffd27a, MW.BLOCK_TYPES.GLOW, 0.02);
    }
    // 军事基地围墙
    b.wallRect(-100, -38, -25, 70, 4, 2, 0x7d7a6b, 1);
    b.clear(-82, 4, -38, -60, 7, -36);
    b.clear(-82, 4, 68, -60, 7, 70);
    b.clear(-28, 4, 20, -23, 7, 27);

    // 港口
    b.modern(46, 40, 16, 12, 3, 12, { wall: 0x8a8276, glass: 0x6fa6bd, roof: 0x5a544a, name: '港务仓库' });
    for (let x = 50; x <= 56; x++) {
      for (let z = 48; z <= 64; z++) {
        b.set(x, 2, z, 0x9a7a4e, 0, 0.04);
        if (z % 4 === 0) {
          b.set(x, 1, z, 0x5b4228, 0, 0.02);
          b.set(x, 0, z, 0x5b4228, 0, 0.02);
        }
      }
    }
    b.fill(49, 3, 48, 57, 3, 49, 0x8a6b45, { jitter: 0.03 });
    b.set(56, 4, 64, 0xffb347, MW.BLOCK_TYPES.GLOW, 0.02);
    b.set(50, 4, 64, 0xffb347, MW.BLOCK_TYPES.GLOW, 0.02);

    // 停机坪/跑道灯
    for (let x = -60; x <= -50; x += 4) {
      for (let z = -30; z <= 60; z += 6) {
        if (b.rand() < 0.7) b.set(x, 3, z, 0x64f0ff, MW.BLOCK_TYPES.GLOW, 0.02);
      }
    }

    return {
      spawn: [0, 3, 46],
      spawnYaw: 0,
      spawnPitch: -0.04,
      waterLevel: WL,
      fallbackColor: 0x6f8f4a,
      killTarget: 20,
      labels: [
        { text: '富士山', x: 6, y: 72, z: -84, color: 0xe8f6ff, width: 9 },
        { text: '涩谷十字路口', x: 0, y: 16, z: 24, color: 0xffb347, width: 7 },
        { text: '东京塔', x: 22, y: 46, z: -22, color: 0xff7a5a, width: 8 },
        { text: '自卫队基地', x: -62, y: 17, z: 25, color: 0x9fe6a8, width: 10 },
        { text: '跑道', x: -71, y: 9, z: 42, color: 0x7fd8ff, width: 6 },
        { text: '机库', x: -42, y: 13, z: 8, color: 0x7fd8ff, width: 6 },
        { text: '导弹阵地', x: -92, y: 14, z: 33, color: 0xff9a8c, width: 9 },
        { text: '横须贺港', x: 52, y: 12, z: 44, color: 0x7fd8ff, width: 9 }
      ],
      zones: [
        { name: '横须贺港', x: 52, z: 46, r: 14, enemy: true },
        { name: '防卫基地', x: -62, z: 25, r: 16, enemy: true },
        { name: '雷达站', x: -28, z: 44, r: 12, enemy: true },
        { name: '导弹阵地', x: -92, z: 33, r: 11, enemy: true }
      ],
      vehicles: [
        { type: 'jet', x: -71, z: 48, name: 'F-2 战斗机' },
        { type: 'jet', x: -71, z: -8, name: 'F-35 战斗机' },
        { type: 'tank', x: -60, z: -4, name: '10 式坦克' },
        { type: 'tank', x: -60, z: 28, name: '10 式坦克' },
        { type: 'apc', x: -50, z: 52, name: '96 式装甲车' },
        { type: 'car', x: 4, z: 32, name: '街头越野车' },
        { type: 'drone', x: -40, z: 46, name: '侦察无人机' },
        { type: 'boat', x: 58, z: 60, name: '海上巡逻艇' }
      ],
      cannons: [
        { x: -30, y: 4, z: 56, yaw: 0, name: '基地防空炮' },
        { x: 60, y: 4, z: 47, yaw: Math.PI, name: '港口岸防炮' }
      ],
      enemyShips: [{ x: 86, z: 78, type: 'warship' }, { x: 34, z: 96, type: 'warship' }],
      pickups: [
        { item: 'missile', x: 3, z: 40 },
        { item: 'ammo_rocket', x: 4, z: 41 },
        { item: 'missile', x: -60, z: 14 },
        { item: 'rpg', x: -55, z: 34 },
        { item: 'sniper', x: -20, z: 30 },
        { item: 'rifle', x: 4, z: 30 },
        { item: 'medkit', x: -70, z: 20 },
        { item: 'armor', x: 52, z: 44 },
        { item: 'ammo_rocket', x: -92, z: 30 },
        { item: 'ammo_heavy', x: -62, z: 48 }
      ]
    };
  }

  /* A compact editable district anchors a much larger streamed landscape.
     Landmarks are deliberately stylised; no claim of surveyed city geometry. */
  function cityInfrastructure(b, meta) {
    const y = 3;
    // A walkable square, clear approach road and usable flight strip.
    b.fill(-66, 2, -74, 66, 2, 68, 0xa6b0ab, { jitter: 0.01 });
    b.fill(-14, 2, -180, 14, 2, 180, 0x57646a, { jitter: 0 });
    b.fill(-180, 2, -12, 180, 2, 12, 0x57646a, { jitter: 0 });
    for (let z = -176; z < 178; z += 14) b.fill(-1, 2, z, 1, 2, z + 5, 0xd5d6bd, { jitter: 0 });
    b.fill(-379, 2, -340, -341, 2, 340, 0x46535c, { jitter: 0 });
    for (let z = -328; z < 330; z += 24) b.fill(-361, 2, z, -359, 2, z + 11, 0xe0e0c8, { jitter: 0 });
    for (let z = -324; z <= 324; z += 54) {
      b.set(-378, 3, z, 0x8ce8ef, MW.BLOCK_TYPES.GLOW);
      b.set(-342, 3, z, 0x8ce8ef, MW.BLOCK_TYPES.GLOW);
    }
    b.modern(-316, -100, 22, 24, y, 16, { wall: 0x8199a0, name: '飞行中心', stairs: false, rooms: false, desk: false });
    // Rail route avoids the central landmarks and is entirely on flat terrain.
    b.fill(-241, 3, 60, -226, 3, 132, 0xb6c1bf, { jitter: 0.01 });
    b.modern(-258, 95, 20, 34, y, 8, { wall: 0xadb9b6, name: '城际车站', stairs: false, rooms: false, desk: false });
    for (const x of [-160, -96, 96, 160]) for (const z of [-150, 150]) {
      b.tree(x, z, 7, meta.id === 'tokyo' ? 0xa6bd8d : 0x668b55, { y });
      b.lamp(x + 12, z, y, 0xffdc99, 5);
    }
    return {
      spawn: [0, 3, 100], spawnYaw: 0, spawnPitch: -0.04, killTarget: 18,
      fallbackColor: 0x739366,
      vehicles: [
        { type: 'car', x: 6, z: 82, name: '城市探索车' },
        { type: 'tank', x: -88, z: 110, name: '远征坦克' },
        { type: 'apc', x: -112, z: 110, name: '支援装甲车' },
        { type: 'drone', x: 21, z: 92, name: '城市侦察机' },
        { type: 'jet', x: -360, z: 260, name: '远征战斗机' }
      ],
      zones: [
        { name: '中央广场', x: 28, z: 36, r: 16, enemy: true },
        { name: '城际车站', x: -232, z: 95, r: 14, enemy: true },
        { name: '飞行中心', x: -315, z: -75, r: 14, enemy: true }
      ],
      pickups: [
        { item: 'rifle', x: 6, z: 93 }, { item: 'missile', x: 9, z: 93 },
        { item: 'ammo_rocket', x: 12, z: 93 }, { item: 'medkit', x: -6, z: 93 },
        { item: 'armor', x: -9, z: 93 }
      ],
      labels: [
        { text: meta.name, x: 0, y: 27, z: -12, color: 0xc3e7df, width: 18 },
        { text: '城际车站', x: -235, y: 17, z: 95, color: 0x9be0d4, width: 12 },
        { text: '飞行中心', x: -360, y: 15, z: 260, color: 0x8bdbe8, width: 12 }
      ],
      destinations: [
        { name: '中央广场', x: 0, z: 100 }, { name: '城际车站', x: -231, z: 128 },
        { name: '飞行跑道', x: -360, z: 280 }, { name: '城市街区', x: 576, z: 0 },
        { name: '郊野公路', x: 0, z: 4000 }, { name: '远郊山地', x: -7000, z: -5000 }
      ],
      advanced: {
        rail: [[-220, -160], [-160, -220], [160, -220], [220, -160], [220, 160], [160, 220], [-160, 220], [-220, 160]],
        base: [-90, 110]
      }
    };
  }

  function genBeijing(b, meta) {
    const result = cityInfrastructure(b, meta);
    b.hall(0, -52, 48, 30, 3, { wall: 0x9f4e43, roof: 0xcfa45a, columns: true });
    b.gate(0, 42, 36, 12, 3, { wall: 0xa95746, roof: 0xd0a052 });
    b.pavilion(-100, -75, 3, 16, { roof: 0xc49a56 });
    b.pavilion(100, -75, 3, 16, { roof: 0xc49a56 });
    b.modern(-95, -130, 30, 30, 3, 36, { wall: 0xb2b9b4, glass: 0x91b7bf, name: '城市文化馆', rooms: false, desk: false });
    b.modern(95, -130, 30, 30, 3, 56, { wall: 0x91a0a5, glass: 0x81b9c5, name: '中轴商务中心', rooms: false, desk: false });
    b.modern(100, 86, 32, 28, 3, 24, { wall: 0xc4b8a2, name: '城市图书馆', rooms: false });
    b.fill(-35, 3, -9, -29, 13, -3, 0xc4bfae, { jitter: 0.01 });
    result.labels.push({ text: '中轴宫阙 · 风格化地标', x: 0, y: 28, z: -52, color: 0xf0cf88, width: 17 });
    result.destinations.push({ name: '环城公路', x: 1100, z: 0 }, { name: '东郊河岸', x: 2800, z: 350 });
    return result;
  }

  function genWashington(b, meta) {
    const result = cityInfrastructure(b, meta);
    // A tapered stone obelisk and civic buildings around a walkable mall.
    for (let y = 3; y < 57; y++) {
      const r = y < 48 ? 3 : Math.max(0, Math.floor((57 - y) / 3));
      b.fill(-43 - r, y, -33 - r, -43 + r, y, -33 + r, 0xd6d8ca, { jitter: 0.01 });
    }
    b.modern(70, -70, 50, 34, 3, 16, { wall: 0xd0d5cd, glass: 0x9eb5bf, roof: 0xb4c1bd, name: '穹顶大厅', rooms: false, desk: false });
    for (let y = 20; y <= 35; y++) {
      const radius = Math.sqrt(Math.max(0, 15 * 15 - (y - 20) * (y - 20)));
      for (let x = -Math.ceil(radius); x <= Math.ceil(radius); x++) for (let z = -Math.ceil(radius); z <= Math.ceil(radius); z++) {
        const d = Math.hypot(x, z);
        if (d <= radius && d >= radius - 1.5) b.set(70 + x, y, -70 + z, 0xdce0d8, 0);
      }
    }
    b.modern(-105, -112, 46, 26, 3, 12, { wall: 0xd9ded4, glass: 0x8ba5ad, name: '白色行政馆', rooms: false, desk: false });
    for (let x = -122; x <= -88; x += 6) b.fill(x, 4, -96, x, 12, -96, 0xe4e7de, { jitter: 0 });
    b.modern(98, 92, 36, 30, 3, 20, { wall: 0xbfc4bc, name: '博物馆', rooms: false, desk: false });
    b.modern(-102, 38, 32, 28, 3, 16, { wall: 0xbdc3bc, name: '艺术中心', rooms: false, desk: false });
    result.labels.push({ text: '纪念碑 · 风格化地标', x: -43, y: 64, z: -33, color: 0xf1e5bf, width: 16 });
    result.labels.push({ text: '穹顶大厅', x: 70, y: 43, z: -70, color: 0xd5eee6, width: 13 });
    result.destinations.push({ name: '纪念碑草坪', x: -43, z: -10 }, { name: '西南河岸', x: -730, z: 500 });
    return result;
  }

  function genTokyo(b, meta) {
    const result = cityInfrastructure(b, meta);
    // Open lattice tower: a recognisable silhouette with walkable space below.
    for (let y = 3; y < 84; y++) {
      const r = Math.max(1, Math.round(12 * (1 - (y - 3) / 85)));
      const color = Math.floor(y / 9) % 2 ? 0xe4e5d8 : 0xd97a60;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.set(78 + sx * r, y, -56 + sz * r, color, 0);
      if (y % 8 === 0) b.fillRing(78 - r, y, -56 - r, 78 + r, y, -56 + r, color, { jitter: 0 });
    }
    b.fill(68, 43, -66, 88, 44, -46, 0xddddd0, { jitter: 0 });
    b.fillRing(68, 45, -66, 88, 47, -46, 0x91bdc5, { type: MW.BLOCK_TYPES.GLASS, jitter: 0 });
    b.fill(68, 48, -66, 88, 48, -46, 0xd87b65, { jitter: 0 });
    b.fill(78, 84, -56, 78, 94, -56, 0xe1e4d5, { jitter: 0 });
    b.set(78, 95, -56, 0xffa98a, MW.BLOCK_TYPES.GLOW);
    for (const [x, z, h] of [[-102, -110, 52], [-56, -105, 32], [127, -125, 60], [-100, 62, 40], [104, 97, 32]]) {
      b.modern(x, z, 28, 28, 3, h, { wall: 0x788c9a, glass: 0x7da8c2, roof: 0x647d8a, name: '湾岸街区', rooms: false, desk: false });
      b.fill(x - 8, 8, z + 15, x + 8, 10, z + 15, z < 0 ? 0xa4d9e4 : 0xe6a1a8, { type: MW.BLOCK_TYPES.GLOW, jitter: 0 });
    }
    for (let i = -10; i <= 10; i += 3) {
      b.fill(i, 2, 14, i + 1, 2, 22, 0xdce0d4, { jitter: 0 });
      b.fill(-22, 2, i, -14, 2, i + 1, 0xdce0d4, { jitter: 0 });
    }
    // Pier joins the eastern arterial; berth is over the continuous bay.
    b.fill(914, 2, -5, 1032, 2, 5, 0xb3b2a0, { jitter: 0.01 });
    for (let x = 920; x <= 1030; x += 22) b.fill(x, -12, -4, x + 1, 1, -3, 0x6e7470, { jitter: 0 });
    result.labels.push({ text: '湾岸高塔 · 风格化地标', x: 78, y: 104, z: -56, color: 0xf8c0a6, width: 19 });
    result.destinations.push({ name: '高塔广场', x: 52, z: -36 }, { name: '海湾码头', x: 1018, z: 0 });
    result.vehicles.push({ type: 'boat', x: 1048, z: 48, name: '海湾巡逻艇' });
    result.advanced.carrier = [1470, 330];
    return result;
  }

  function genEarth(b, meta) {
    const destinations = MW.Geography.destinations();
    for (const dest of destinations) {
      if (b.w.terrainGroundAt(dest.x, dest.z) > 1) continue;
      const origin = { x: dest.x, z: dest.z };
      let found = false;
      for (const radius of [2000, 10000, 30000, 60000]) {
        for (let i = 0; i < 12; i++) {
          const x = origin.x + Math.cos(i / 6 * Math.PI) * radius;
          const z = origin.z + Math.sin(i / 6 * Math.PI) * radius;
          if (b.w.terrainGroundAt(x, z) > 1) { dest.x = x; dest.z = z; found = true; break; }
        }
        if (found) break;
      }
    }
    const spawn = destinations[0], y = b.w.terrainGroundAt(spawn.x, spawn.z);
    return {
      spawn: [spawn.x, y, spawn.z], spawnYaw: -0.6, spawnPitch: -0.08, destinations,
      killTarget: 18, labels: [], zones: [], pickups: [],
      vehicles: [
        { type: 'car', x: spawn.x + 8, z: spawn.z + 8, name: '大陆远征车' },
        { type: 'jet', x: spawn.x + 24, z: spawn.z + 24, name: '地理探索机' },
        { type: 'drone', x: spawn.x - 10, z: spawn.z + 8, name: '测绘无人机' }
      ],
      advanced: { base: [spawn.x - 30, spawn.z + 20], rail: [] }
    };
  }

  const GENERATORS = {
    forbidden: genForbidden,
    changan: genChangan,
    uestc: genUestc,
    zh1z: genZh1z,
    taiwan: genTaiwan,
    japan: genJapan,
    beijing: genBeijing,
    washington: genWashington,
    tokyo: genTokyo,
    earth: genEarth
  };

  MW.WorldGen = {
    generate(def, options) {
      options = options || {};
      const meta = JSON.parse(JSON.stringify(def));
      meta.bounds = def.bounds || (def.id === 'japan' ? 116 : def.id === 'taiwan' ? 80 : 74);
      if (!def.terrain && def.id !== 'taiwan' && def.id !== 'japan') meta.groundSize = def.id === 'zh1z' ? 68 : 70;
      if (def.id === 'taiwan') meta.waterLevel = 4;
      if (def.id === 'japan') meta.waterLevel = 1;
      const world = new MW.VoxelWorld(meta);
      world.beginGeneration();
      const b = new Builder(world, def.seed || 1234);
      const gen = GENERATORS[def.id] || genForbidden;
      const result = gen(b, meta) || {};
      Object.assign(meta, result);
      meta.doors = b.doors;
      meta.elevators = b.elevators;
      meta.labels = (meta.labels || []).concat(b.labels || []);
      meta.pickups = (meta.pickups || []).concat(b.loot || []);
      meta.bridges = (meta.bridges || []).concat(b.bridges || []);
      meta.id = def.id;
      world.endGeneration();
      if (options.quick) world.rebuildAllSync(400);
      return world;
    },
    generatorFor(id) { return GENERATORS[id] || genForbidden; }
  };
  MW.Builder = Builder;
})();
