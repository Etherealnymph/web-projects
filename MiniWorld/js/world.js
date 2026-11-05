/* ===========================================================
   体素世界：分块可见面合并 / 连续地形 / 碰撞 / 射线
   =========================================================== */
(function () {
  const MW = window.MW;

  const TYPE_SOLID = 0, TYPE_GLOW = 1, TYPE_DECO = 2, TYPE_WATER = 3, TYPE_LEAF = 4, TYPE_GLASS = 5;
  MW.BLOCK_TYPES = { SOLID: TYPE_SOLID, GLOW: TYPE_GLOW, DECO: TYPE_DECO, WATER: TYPE_WATER, LEAF: TYPE_LEAF, GLASS: TYPE_GLASS };

  function makeChamferBox(bevel) {
    const b = bevel == null ? 0.06 : bevel;
    const h = 0.5, i = h - b;
    const pos = [], nor = [], uvs = [];
    const uvFor = (v, n) => {
      const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
      if (ay >= ax && ay >= az) return [v[0] + 0.5, v[2] + 0.5];
      if (ax >= az) return [v[2] + 0.5, v[1] + 0.5];
      return [v[0] + 0.5, v[1] + 0.5];
    };
    const tri = (a, c, d, n) => {
      const e1 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
      const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      if (cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0) { const tmp = c; c = d; d = tmp; }
      for (const v of [a, c, d]) {
        pos.push(v[0], v[1], v[2]);
        nor.push(n[0], n[1], n[2]);
        const uv = uvFor(v, n);
        uvs.push(uv[0], uv[1]);
      }
    };
    const quad = (a, c, d, e, n) => { tri(a, c, d, n); tri(a, d, e, n); };
    // 顶/底保持完整平面，避免俯视大地时出现格栅
    quad([-h, h, -h], [-h, h, h], [h, h, h], [h, h, -h], [0, 1, 0]);
    quad([-h, -h, -h], [h, -h, -h], [h, -h, h], [-h, -h, h], [0, -1, 0]);
    // 四个侧面在竖直棱处内收，形成柔和的竖向倒角
    quad([h, -h, -i], [h, h, -i], [h, h, i], [h, -h, i], [1, 0, 0]);
    quad([-h, -h, -i], [-h, -h, i], [-h, h, i], [-h, h, -i], [-1, 0, 0]);
    quad([-i, -h, h], [i, -h, h], [i, h, h], [-i, h, h], [0, 0, 1]);
    quad([-i, -h, -h], [-i, h, -h], [i, h, -h], [i, -h, -h], [0, 0, -1]);
    // 四条竖棱倒角
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const n = [sx * 0.707, 0, sz * 0.707];
      const a = [sx * h, -h, sz * i], bb = [sx * h, h, sz * i];
      const c = [sx * i, h, sz * h], d = [sx * i, -h, sz * h];
      quad(a, bb, c, d, n);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    return g;
  }

  function makePixelTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(64, 64);
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        // Fine grain without a dark grid: neighbouring surfaces read as one
        // material instead of disconnected quarter-metre squares.
        const noise = 0.975 + ((x * 17 + y * 29 + x * y * 3) % 19) / 760;
        const v = Math.max(0, Math.min(255, (noise * 255) | 0));
        const i = (y * 64 + x) * 4;
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  const SHARED = {
    box: new THREE.BoxGeometry(1, 1, 1),
    matSolid: new THREE.MeshLambertMaterial({ color: 0xffffff, map: makePixelTexture(), vertexColors: true }),
    matGlow: new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true }),
    matGlass: new THREE.MeshPhongMaterial({
      color: 0xffffff, vertexColors: true, transparent: true, opacity: 0.26, shininess: 95,
      specular: 0xbfefff, depthWrite: false, side: THREE.DoubleSide
    }),
    matWater: new THREE.MeshPhongMaterial({
      color: 0xffffff, vertexColors: true, transparent: true, opacity: 0.7, shininess: 45,
      specular: 0x3f6f86, depthWrite: false, flatShading: true, side: THREE.DoubleSide
    })
  };
  MW.BOX_GEO = SHARED.box;

  class VoxelWorld {
    constructor(meta) {
      this.meta = meta || {};
      this.blocks = new Map();
      this.chunkBlocks = new Map();
      this.chunks = new Map();
      this.group = new THREE.Group();
      this.group.name = 'world';
      this.dirty = new Set();
      this.editLog = new Map();
      this.revision = 0;
      this.recordEdits = false;
      this.chunkSize = 16;
      this.minY = this.meta.minY == null ? -6 : this.meta.minY;
      this.maxY = this.meta.maxY == null ? 96 : this.meta.maxY;
      this.bounds = this.meta.bounds || 96;
      this.fallbackY = this.meta.fallbackY != null
        ? this.meta.fallbackY
        : (this.meta.waterLevel != null ? this.meta.waterLevel - 2 : 1);
      this.endlessPlane = null;
      this.topMap = new Map();
      this.seasonal = [];
      this.waterPlane = null;
      this.waterTime = 0;
      this.rebuildBudget = 4;
      this.onChunkBuilt = null;

      this.matSolid = SHARED.matSolid;
      this.matGlow = SHARED.matGlow;
      this.matGlass = SHARED.matGlass;
      this.matWater = SHARED.matWater;
      this.terrain = this.meta.terrain && MW.StreamedTerrain ? new MW.StreamedTerrain(this) : null;
      this.renderStats = { triangles: 0, chunks: 0 };
      this.fine = MW.FineBuild ? new MW.FineBuild(this) : null;
    }

    key(x, y, z) { return x + '|' + y + '|' + z; }
    cKey(cx, cz) { return cx + ',' + cz; }

    chunkOf(x, z) {
      return [Math.floor(x / this.chunkSize), Math.floor(z / this.chunkSize)];
    }

    getBlock(x, y, z) {
      return this.blocks.get(this.key(Math.floor(x), Math.floor(y), Math.floor(z)));
    }

    isSolid(x, y, z) {
      const b = this.blocks.get(this.key(x, y, z));
      if (!b) return false;
      return b.t === TYPE_SOLID || b.t === TYPE_GLOW || b.t === TYPE_LEAF || b.t === TYPE_GLASS;
    }

    isWater(x, y, z) {
      const b = this.blocks.get(this.key(x, y, z));
      return !!b && b.t === TYPE_WATER;
    }

    /* 顶面高度（可站立表面 y）；地图之外返回无限地面高度 */
    surfaceAt(x, z) {
      const t = this.topMap.get(Math.floor(x) + ',' + Math.floor(z));
      const ground = this.terrain ? this.terrain.surfaceAt(x, z) : this.fallbackY;
      const coarse = t ? (this.terrain ? Math.max(t.y + 1, ground) : t.y + 1) : ground;
      return Math.max(coarse, this.fine?.topAt(x, z) ?? -Infinity);
    }

    topBlock(x, z) {
      return this.topMap.get(Math.floor(x) + ',' + Math.floor(z)) || null;
    }

    terrainGroundAt(x, z) { return this.terrain ? this.terrain.heightAt(x, z) : this.fallbackY; }

    mapSampleAt(x, z) {
      const top = this.topBlock(x, z);
      if (top) return top;
      if (this.terrain) {
        const sample = this.terrain.sample(x, z);
        return { y: sample.height - 1, c: sample.water ? 0x246c88 : sample.color, t: sample.water ? TYPE_WATER : TYPE_SOLID };
      }
      return { y: this.fallbackY - 1, c: this.meta.fallbackColor == null ? 0x77a83e : this.meta.fallbackColor, t: TYPE_SOLID };
    }

    prepareAt(x, z) { if (this.terrain) this.terrain.prepareAt(x, z); }

    setQuality(quality) { if (this.terrain) this.terrain.setQuality(quality); }

    set(x, y, z, color, type, record) {
      x = Math.round(x); y = Math.round(y); z = Math.round(z);
      if (y < this.minY || y > this.maxY) return false;
      if (Math.abs(x) > this.bounds + 40 || Math.abs(z) > this.bounds + 40) return false;
      const k = this.key(x, y, z);
      const prev = this.blocks.get(k);
      if (prev && prev.c === color && prev.t === type) return false;
      this.blocks.set(k, { x, y, z, c: color, t: type });
      this.revision++;
      this._addToChunk(x, y, z, k);
      if (type === TYPE_WATER && prev && prev.t !== TYPE_WATER) this._untrackTop(x, y, z);
      this._trackTop(x, y, z, color, type);
      this._markDirty(x, z);
      if (record !== false && this.recordEdits) this.editLog.set(k, [x, y, z, color, type]);
      return true;
    }

    remove(x, y, z, record) {
      x = Math.round(x); y = Math.round(y); z = Math.round(z);
      const k = this.key(x, y, z);
      const prev = this.blocks.get(k);
      if (!prev) return false;
      this.blocks.delete(k);
      this.revision++;
      this._removeFromChunk(x, z, k);
      this._untrackTop(x, y, z);
      this._markDirty(x, z);
      if (record !== false && this.recordEdits) this.editLog.set(k, [x, y, z, -1, 0]);
      return true;
    }

    _trackTop(x, y, z, color, type) {
      if (type === TYPE_WATER) return;
      const k = x + ',' + z;
      const cur = this.topMap.get(k);
      if (!cur || y >= cur.y) this.topMap.set(k, { y, c: color, t: type });
    }

    _untrackTop(x, y, z) {
      const k = x + ',' + z;
      const cur = this.topMap.get(k);
      if (!cur || cur.y !== y) return;
      for (let yy = y - 1; yy >= this.minY; yy--) {
        const b = this.blocks.get(this.key(x, yy, z));
        if (b && b.t !== TYPE_WATER) { this.topMap.set(k, { y: yy, c: b.c, t: b.t }); return; }
      }
      this.topMap.delete(k);
    }

    _markDirty(x, z) {
      const [cx, cz] = this.chunkOf(x, z);
      this.dirty.add(this.cKey(cx, cz));
      // Exposed-face meshing needs both sides of a chunk-boundary edit rebuilt.
      const lx = x - cx * this.chunkSize, lz = z - cz * this.chunkSize;
      if (lx === 0) this.dirty.add(this.cKey(cx - 1, cz));
      if (lx === this.chunkSize - 1) this.dirty.add(this.cKey(cx + 1, cz));
      if (lz === 0) this.dirty.add(this.cKey(cx, cz - 1));
      if (lz === this.chunkSize - 1) this.dirty.add(this.cKey(cx, cz + 1));
    }

    _addToChunk(x, y, z, k) {
      const [cx, cz] = this.chunkOf(x, z);
      const ck = this.cKey(cx, cz);
      let set = this.chunkBlocks.get(ck);
      if (!set) { set = new Set(); this.chunkBlocks.set(ck, set); }
      set.add(k);
    }

    _removeFromChunk(x, z, k) {
      const [cx, cz] = this.chunkOf(x, z);
      const ck = this.cKey(cx, cz);
      const set = this.chunkBlocks.get(ck);
      if (set) set.delete(k);
    }

    /* ---------- 分块构建 ---------- */
    buildChunk(cx, cz) {
      const ck = this.cKey(cx, cz);
      const old = this.chunks.get(ck);
      if (old) {
        for (const m of old.meshes) { this.group.remove(m); m.geometry.dispose(); }
        this.renderStats.triangles -= old.triangles || 0;
        this.chunks.delete(ck);
      }
      const x0 = cx * this.chunkSize, z0 = cz * this.chunkSize;
      const set = this.chunkBlocks.get(ck);
      if (!set || !set.size) {
        this.chunkBlocks.delete(ck);
        this.renderStats.chunks = this.chunks.size;
        return;
      }
      const normals = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
      const planes = new Map();
      const opaque = t => t === TYPE_SOLID || t === TYPE_GLOW || t === TYPE_LEAF;
      const quantize = c => (((c >> 19) & 31) << 19) | (((c >> 11) & 31) << 11) | (((c >> 3) & 31) << 3);
      for (const k of set) {
        const b = this.blocks.get(k);
        if (!b) continue;
        const kind = b.t === TYPE_GLOW ? 'glow' : b.t === TYPE_GLASS ? 'glass' : b.t === TYPE_WATER ? 'water' : 'solid';
        for (let dir = 0; dir < 6; dir++) {
          const n = normals[dir];
          const other = this.blocks.get(this.key(b.x + n[0], b.y + n[1], b.z + n[2]));
          if (other && (opaque(other.t) || (other.t === b.t && (b.t === TYPE_GLASS || b.t === TYPE_WATER)))) continue;
          const plane = dir < 2 ? b.x + (dir === 0 ? 1 : 0) : dir < 4 ? b.y + (dir === 2 ? 1 : 0) : b.z + (dir === 4 ? 1 : 0);
          const u = dir < 2 ? b.z : b.x, v = dir < 2 || dir >= 4 ? b.y : b.z;
          const pk = dir + '|' + plane + '|' + kind;
          if (!planes.has(pk)) planes.set(pk, { dir, plane, kind, cells: new Map() });
          planes.get(pk).cells.set(u + ',' + v, { u, v, color: quantize(b.c) });
        }
      }
      const buckets = {};
      const col = new THREE.Color();
      const topColor = (x, y, z, fallback) => {
        let r = 0, g = 0, b = 0, count = 0;
        const fr = fallback >> 16 & 255, fg = fallback >> 8 & 255, fb = fallback & 255;
        for (let dx = -1; dx <= 0; dx++) for (let dz = -1; dz <= 0; dz++) {
          const item = this.blocks.get(this.key(x + dx, y - 1, z + dz));
          if (!item || !opaque(item.t)) continue;
          const rr = item.c >> 16 & 255, gg = item.c >> 8 & 255, bb = item.c & 255;
          // Blend only the same-looking material, preserving road/grass borders.
          if (Math.max(Math.abs(rr - fr), Math.abs(gg - fg), Math.abs(bb - fb)) > 32) continue;
          r += rr; g += gg; b += bb; count++;
        }
        return count ? (Math.round(r / count) << 16) | (Math.round(g / count) << 8) | Math.round(b / count) : fallback;
      };
      for (const face of planes.values()) {
        const { dir, plane, kind, cells } = face;
        const bucket = buckets[kind] || (buckets[kind] = { position: [], normal: [], uv: [], color: [], indices: [] });
        const coordinates = Array.from(cells.values()).sort((a, b) => a.v - b.v || a.u - b.u);
        const same = (u, v, color) => { const c = cells.get(u + ',' + v); return !!c && c.color === color; };
        for (const cell of coordinates) {
          if (!cells.has(cell.u + ',' + cell.v)) continue;
          let width = 1, height = 1;
          while (same(cell.u + width, cell.v, cell.color)) width++;
          let grow = true;
          while (grow) {
            for (let u = 0; u < width; u++) if (!same(cell.u + u, cell.v + height, cell.color)) { grow = false; break; }
            if (grow) height++;
          }
          for (let v = 0; v < height; v++) for (let u = 0; u < width; u++) cells.delete((cell.u + u) + ',' + (cell.v + v));
          const uv = [[cell.u, cell.v], [cell.u + width, cell.v], [cell.u + width, cell.v + height], [cell.u, cell.v + height]];
          const first = bucket.position.length / 3;
          for (const [u, v] of uv) {
            const p = dir < 2 ? [plane, v, u] : dir < 4 ? [u, plane, v] : [u, v, plane];
            bucket.position.push(p[0] - x0, p[1], p[2] - z0);
            bucket.normal.push(...normals[dir]);
            const offsetU = dir < 2 ? z0 : x0, offsetV = dir < 2 || dir >= 4 ? 0 : z0;
            bucket.uv.push((u - offsetU) / 8, (v - offsetV) / 8);
            col.setHex(dir === 2 && kind === 'solid' ? topColor(p[0], p[1], p[2], cell.color) : cell.color);
            bucket.color.push(col.r, col.g, col.b);
          }
          const reverse = dir === 0 || dir === 2 || dir === 5;
          if (reverse) bucket.indices.push(first, first + 2, first + 1, first, first + 3, first + 2);
          else bucket.indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
        }
      }
      const meshes = [];
      let triangles = 0;
      const materials = { solid: this.matSolid, glow: this.matGlow, glass: this.matGlass, water: this.matWater };
      for (const [kind, data] of Object.entries(buckets)) {
        if (!data.indices.length) continue;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(data.position, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(data.normal, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(data.uv, 2));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(data.color, 3));
        geo.setIndex(data.indices);
        geo.computeBoundingSphere();
        const mesh = new THREE.Mesh(geo, materials[kind]);
        mesh.position.set(x0, 0, z0);
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        mesh.renderOrder = kind === 'glass' ? 2 : kind === 'water' ? 1 : 0;
        mesh.userData.chunk = ck;
        this.group.add(mesh);
        meshes.push(mesh);
        triangles += data.indices.length / 3;
      }
      this.chunks.set(ck, { meshes, count: set.size, triangles });
      this.renderStats.triangles += triangles;
      this.renderStats.chunks = this.chunks.size;
      if (this.onChunkBuilt) this.onChunkBuilt(ck);
    }

    markAllDirty() {
      for (const k of this.chunkBlocks.keys()) this.dirty.add(k);
      for (const k of this.chunks.keys()) this.dirty.add(k);
    }

    rebuildDirty(limit) {
      if (!this.dirty.size) return 0;
      limit = limit == null ? this.rebuildBudget : limit;
      let n = 0;
      for (const ck of this.dirty) {
        this.dirty.delete(ck);
        const [cx, cz] = ck.split(',').map(Number);
        this.buildChunk(cx, cz);
        if (++n >= limit) break;
      }
      return n;
    }

    rebuildAllSync(budget) {
      this.markAllDirty();
      let guard = 0;
      while (this.dirty.size && guard++ < 5000) this.rebuildDirty(budget || 1000);
      while (this.fine?.dirty.size) this.fine.rebuildDirty(1000);
    }

    /* ---------- 生成期 ---------- */
    beginGeneration() { this.recordEdits = false; }
    endGeneration() {
      this.recordEdits = true;
      this.rebuildPrecision();
      this.markAllDirty();
      this.createWater();
      this.createEndlessGround();
      if (this.terrain) {
        const spawn = this.meta.spawn || [0, 3, 0];
        this.terrain.prepareAt(spawn[0], spawn[2]);
      }
    }

    rebuildPrecision() {
      this.precision?.dispose();
      this.precision = MW.PrecisionArchitecture ? new MW.PrecisionArchitecture(this, this.meta.stairways) : null;
    }

    /* ---------- 水面 ---------- */
    createWater() {
      if (this.meta.waterLevel == null || this.waterPlane) return;
      const size = Math.max(2000, (this.meta.drawDistance || 800) * 2.4);
      const geo = new THREE.PlaneGeometry(size, size, 48, 48);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshPhongMaterial({
        color: 0x276f8c, transparent: true, opacity: 0.9, depthWrite: false,
        shininess: 78, specular: 0x86a7bd
      });
      this._waterUniforms = { uWaterTime: { value: 0 }, uWaterPhase: { value: new THREE.Vector2() } };
      mat.onBeforeCompile = shader => {
        Object.assign(shader.uniforms, this._waterUniforms);
        shader.vertexShader = 'uniform float uWaterTime;\nuniform vec2 uWaterPhase;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
          #include <begin_vertex>
          transformed.y += sin(position.x * 0.05 + uWaterPhase.x + uWaterTime * 0.9) * 0.10
            + cos(position.z * 0.07 + uWaterPhase.y + uWaterTime * 0.6) * 0.06;
        `);
        shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `
          #include <beginnormal_vertex>
          objectNormal.x -= cos(position.x * 0.05 + uWaterPhase.x + uWaterTime * 0.9) * 0.005;
          objectNormal.z += sin(position.z * 0.07 + uWaterPhase.y + uWaterTime * 0.6) * 0.0042;
        `);
      };
      mat.customProgramCacheKey = () => 'miniworld-water-v2';
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = this.meta.waterLevel + 0.12;
      if (this.meta.spawn) {
        mesh.position.x = Math.floor(this.meta.spawn[0] / 128) * 128;
        mesh.position.z = Math.floor(this.meta.spawn[2] / 128) * 128;
      }
      mesh.renderOrder = 2;
      mesh.frustumCulled = false;
      this.waterPlane = mesh;
      this.group.add(mesh);
    }

    /* ---------- 无限地面 ---------- */
    groundTexture(color) {
      const key = color >>> 0;
      if (!this._groundTexCache) this._groundTexCache = new Map();
      if (this._groundTexCache.has(key)) return this._groundTexCache.get(key);
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const ctx = c.getContext('2d');
      ctx.fillStyle = MW.hexToCss(color);
      ctx.fillRect(0, 0, 128, 128);
      const dark = MW.hexToCss(MW.shade(color, -0.08));
      const light = MW.hexToCss(MW.shade(color, 0.06));
      for (let i = 0; i < 500; i++) {
        ctx.globalAlpha = 0.12 + Math.random() * 0.2;
        ctx.fillStyle = Math.random() < 0.5 ? dark : light;
        const s = 1 + Math.floor(Math.random() * 3);
        ctx.fillRect(Math.random() * 128, Math.random() * 128, s, s);
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(120, 120);
      tex.encoding = THREE.sRGBEncoding;
      tex.anisotropy = 4;
      this._groundTexCache.set(key, tex);
      return tex;
    }

    createEndlessGround() {
      if (this.meta.waterLevel != null || this.endlessPlane || this.terrain) return;
      const color = this.meta.fallbackColor != null ? this.meta.fallbackColor : 0x77a83e;
      const outer = 1000;
      const hole = this.meta.groundSize || 70;
      const shape = new THREE.Shape();
      shape.moveTo(-outer, -outer);
      shape.lineTo(outer, -outer);
      shape.lineTo(outer, outer);
      shape.lineTo(-outer, outer);
      shape.closePath();
      const inner = new THREE.Path();
      inner.moveTo(-hole, -hole);
      inner.lineTo(-hole, hole);
      inner.lineTo(hole, hole);
      inner.lineTo(hole, -hole);
      inner.closePath();
      shape.holes.push(inner);
      const geo = new THREE.ShapeGeometry(shape, 1);
      geo.rotateX(-Math.PI / 2);
      // 重映射 UV，避免 ShapeGeometry 的世界坐标 UV 让纹理过密
      const uv = geo.attributes.uv;
      const pos = geo.attributes.position;
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, (pos.getX(i) + outer) / (outer * 2), (pos.getZ(i) + outer) / (outer * 2));
      }
      const mat = new THREE.MeshLambertMaterial({ map: this.groundTexture(color) });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = this.fallbackY - 0.04;
      mesh.renderOrder = -2;
      mesh.frustumCulled = false;
      this.endlessPlane = mesh;
      this.group.add(mesh);
    }

    update(dt, cameraPos) {
      this.rebuildDirty();
      this.fine?.rebuildDirty(2);
      if (this.terrain) this.terrain.update(dt, cameraPos);
      if (this.waterPlane) {
        this.waterTime += dt;
        if (cameraPos) {
          this.waterPlane.position.x = Math.floor(cameraPos.x / 128) * 128;
          this.waterPlane.position.z = Math.floor(cameraPos.z / 128) * 128;
        }
        this._waterUniforms.uWaterTime.value = this.waterTime;
        this._waterUniforms.uWaterPhase.value.set((this.waterPlane.position.x * 0.05) % (Math.PI * 2), (this.waterPlane.position.z * 0.07) % (Math.PI * 2));
      }
      if (this.endlessPlane && cameraPos) {
        // 无限地面是静态环形面，中心留出真实地图，不随相机移动
        this.endlessPlane.position.y = this.fallbackY - 0.04;
      }
    }

    /* ---------- 碰撞 ---------- */
    collidesBox(x, y, z, radius, height, ignoreTerrainFloor) {
      if (this.fine?.collidesBox(x, y, z, radius, height)) return true;
      if (this.precision?.collidesBox(x, y, z, radius, height)) return true;
      if (this.terrain && this.terrain.collidesBox(x, y, z, radius, height, ignoreTerrainFloor)) return true;
      const x0 = Math.floor(x - radius), x1 = Math.floor(x + radius);
      const z0 = Math.floor(z - radius), z1 = Math.floor(z + radius);
      const y0 = Math.floor(y + 0.001), y1 = Math.floor(y + height - 0.001);
      for (let bx = x0; bx <= x1; bx++) {
        for (let bz = z0; bz <= z1; bz++) {
          for (let by = y0; by <= y1; by++) {
            if (this.isSolid(bx, by, bz)) return true;
          }
        }
      }
      return false;
    }

    /* 从 from 到 to 的体素射线，返回首个实体方块 */
    raycast(origin, dir, maxDist) {
      maxDist = maxDist || 60;
      let nearest = this._raycastVoxels(origin, dir, maxDist);
      const accept = hit => { if (hit && (!nearest || hit.dist < nearest.dist)) nearest = hit; };
      if (this.terrain) accept(this.terrain.raycast(origin, dir, nearest ? nearest.dist : maxDist));
      else if (MW.FineBuild && dir.y < -0.000001 && origin.y >= this.fallbackY) {
        const dist = (this.fallbackY - origin.y) / dir.y;
        if (dist <= maxDist) accept({ x: Math.floor(origin.x + dir.x * dist), y: this.fallbackY - 1,
          z: Math.floor(origin.z + dir.z * dist), nx: 0, ny: 1, nz: 0, dist, terrain: true, ground: true });
      }
      if (this.precision && MW.FineBuildTools) {
        const candidates = new Set(), limit = nearest ? nearest.dist : maxDist;
        for (let t = 0; t <= limit + 2; t += 2)
          for (const box of this.precision.nearby(origin.x + dir.x * Math.min(t, limit), origin.z + dir.z * Math.min(t, limit), 2)) candidates.add(box);
        for (const bounds of candidates) {
          const cell = { x: bounds.x0, y: bounds.y0, z: bounds.z0,
            w: bounds.x1 - bounds.x0, h: bounds.y1 - bounds.y0, d: bounds.z1 - bounds.z0 };
          const hit = MW.FineBuildTools.rayBox(origin, dir, cell, nearest ? nearest.dist : maxDist);
          if (hit) accept({ ...hit, ...cell, cell, precision: true });
        }
      }
      accept(this.fine?.raycast(origin, dir, nearest ? nearest.dist : maxDist));
      if (nearest && !nearest.point) nearest.point = {
        x: origin.x + dir.x * nearest.dist,
        y: origin.y + dir.y * nearest.dist,
        z: origin.z + dir.z * nearest.dist
      };
      return nearest;
    }

    _raycastVoxels(origin, dir, maxDist) {
      if (!this.blocks.size) return null;
      let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
      const stepX = dir.x > 0 ? 1 : -1, stepY = dir.y > 0 ? 1 : -1, stepZ = dir.z > 0 ? 1 : -1;
      const tDeltaX = Math.abs(1 / (dir.x || 1e-9));
      const tDeltaY = Math.abs(1 / (dir.y || 1e-9));
      const tDeltaZ = Math.abs(1 / (dir.z || 1e-9));
      const frac = (v) => v - Math.floor(v);
      let tMaxX = dir.x > 0 ? (1 - frac(origin.x)) * tDeltaX : frac(origin.x) * tDeltaX;
      let tMaxY = dir.y > 0 ? (1 - frac(origin.y)) * tDeltaY : frac(origin.y) * tDeltaY;
      let tMaxZ = dir.z > 0 ? (1 - frac(origin.z)) * tDeltaZ : frac(origin.z) * tDeltaZ;
      let nx = 0, ny = 0, nz = 0, t = 0;
      maxDist = maxDist || 60;

      if (this.isSolid(x, y, z)) return { x, y, z, nx: 0, ny: 1, nz: 0, dist: 0 };

      while (t <= maxDist) {
        if (tMaxX < tMaxY && tMaxX < tMaxZ) {
          x += stepX; t = tMaxX; tMaxX += tDeltaX; nx = -stepX; ny = 0; nz = 0;
        } else if (tMaxY < tMaxZ) {
          y += stepY; t = tMaxY; tMaxY += tDeltaY; nx = 0; ny = -stepY; nz = 0;
        } else {
          z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ;
        }
        if (t > maxDist) break;
        if (this.isSolid(x, y, z)) return { x, y, z, nx, ny, nz, dist: t };
      }
      return null;
    }

    /* 视线是否被方块遮挡 */
    lineBlocked(a, b) {
      const dir = new THREE.Vector3().subVectors(b, a);
      const len = dir.length();
      if (len < 0.001) return false;
      dir.divideScalar(len);
      const hit = this.raycast(a, dir, len - 0.05);
      return !!hit;
    }

    /* ---------- 编辑记录 ---------- */
    startRecording() { this.recordEdits = true; }
    applyEdits(edits) {
      if (!Array.isArray(edits)) return;
      this.recordEdits = false;
      for (const e of edits) {
        if (!e || e.length < 4) continue;
        const [x, y, z, c, t] = e;
        if (![x, y, z, c].every(Number.isFinite)) continue;
        if (y < this.minY || y > this.maxY || Math.abs(x) > this.bounds + 40 || Math.abs(z) > this.bounds + 40) continue;
        if (c === -1) this.remove(x, y, z, false);
        else this.set(x, y, z, c, t || 0, false);
        // Restored edits must survive the next autosave as well.
        this.editLog.set(this.key(Math.round(x), Math.round(y), Math.round(z)), [Math.round(x), Math.round(y), Math.round(z), c, t || 0]);
      }
      this.recordEdits = true;
      this.markAllDirty();
    }
    exportEdits() { return Array.from(this.editLog.values()); }

    /* ---------- 序列化 ---------- */
    serialize() {
      const out = [];
      for (const b of this.blocks.values()) out.push([b.x, b.y, b.z, b.c, b.t]);
      return {
        format: 'miniworld-voxel',
        version: 1,
        name: this.meta.name || '未命名世界',
        meta: this.meta,
        blocks: out,
        ...(this.fine ? { fine: this.fine.serialize() } : {})
      };
    }

    loadSerialized(data) {
      MW.FineBuildTools?.validateWorldData(data);
      // Reject the complete fine payload before touching legacy blocks or meshes.
      if (data.fine && MW.FineBuild) MW.FineBuild.validateSnapshot(data.fine, this);
      this.revision++;
      this.rebuildPrecision();
      this.recordEdits = false;
      this.blocks.clear();
      this.chunkBlocks.clear();
      this.topMap.clear();
      this.editLog.clear();
      for (const ck of this.chunks.keys()) {
        const ch = this.chunks.get(ck);
        for (const m of ch.meshes) { this.group.remove(m); m.geometry.dispose(); }
      }
      this.chunks.clear();
      this.renderStats.triangles = 0;
      this.renderStats.chunks = 0;
      for (const b of data.blocks || []) {
        if (b.length < 4) continue;
        const k = this.key(b[0], b[1], b[2]);
        this.blocks.set(k, { x: b[0], y: b[1], z: b[2], c: b[3], t: b[4] || 0 });
        this._addToChunk(b[0], b[1], b[2], k);
        this._trackTop(b[0], b[1], b[2], b[3], b[4] || 0);
      }
      if (this.fine) this.fine.loadSnapshot(data.fine || { version: 1, cells: [], edits: [] });
      this.recordEdits = true;
      this.markAllDirty();
      this.rebuildAllSync(400);
      if (this.meta.waterLevel != null && !this.waterPlane) this.createWater();
      this.createEndlessGround();
      if (this.terrain) {
        const spawn = this.meta.spawn || [0, 3, 0];
        this.terrain.prepareAt(spawn[0], spawn[2]);
      }
    }

    /* 统计 */
    get blockCount() { return this.blocks.size; }

    dispose() {
      this.fine?.dispose();
      this.precision?.dispose();
      for (const ch of this.chunks.values()) {
        for (const m of ch.meshes) { this.group.remove(m); m.geometry.dispose(); }
      }
      this.chunks.clear();
      this.chunkBlocks.clear();
      this.blocks.clear();
      this.topMap.clear();
      this.dirty.clear();
      this.editLog.clear();
      if (this.terrain) this.terrain.dispose();
      if (this.waterPlane) {
        this.group.remove(this.waterPlane);
        this.waterPlane.geometry.dispose();
        this.waterPlane.material.dispose();
      }
      if (this.endlessPlane) {
        this.group.remove(this.endlessPlane);
        this.endlessPlane.geometry.dispose();
        this.endlessPlane.material.dispose();
      }
      if (this._groundTexCache) { for (const texture of this._groundTexCache.values()) texture.dispose(); this._groundTexCache.clear(); }
      if (this.group.parent) this.group.parent.remove(this.group);
    }
  }

  MW.VoxelWorld = VoxelWorld;
})();
