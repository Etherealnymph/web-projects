/* ===========================================================
   体素世界：分块 InstancedMesh 渲染 / 碰撞 / 射线
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
        const cx = (x / 16) | 0, cy = (y / 16) | 0;
        const cell = 0.90 + ((cx * 7 + cy * 13) % 9) * 0.012;
        const seam = (x % 16 === 0 || y % 16 === 0) ? 0.78 : 1.0;
        const noise = 0.98 + Math.random() * 0.02;
        const v = Math.max(0, Math.min(255, (cell * seam * noise * 255) | 0));
        const i = (y * 64 + x) * 4;
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  const SHARED = {
    box: new THREE.BoxGeometry(1, 1, 1),
    chamfer: makeChamferBox(0.22),
    matSolid: new THREE.MeshLambertMaterial({ color: 0xffffff, map: makePixelTexture() }),
    matGlow: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    matGlass: new THREE.MeshPhongMaterial({
      color: 0x9fdfef, transparent: true, opacity: 0.26, shininess: 95,
      specular: 0xbfefff, depthWrite: false, side: THREE.DoubleSide
    }),
    matWater: new THREE.MeshPhongMaterial({
      color: 0x3b90bd, transparent: true, opacity: 0.7, shininess: 45,
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
      this.recordEdits = false;
      this.chunkSize = 16;
      this.minY = -6;
      this.maxY = 96;
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
    }

    key(x, y, z) { return x + '|' + y + '|' + z; }
    cKey(cx, cz) { return cx + ',' + cz; }

    chunkOf(x, z) {
      return [Math.floor(x / this.chunkSize), Math.floor(z / this.chunkSize)];
    }

    getBlock(x, y, z) {
      return this.blocks.get(this.key(Math.round(x), Math.round(y), Math.round(z)));
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
      const t = this.topMap.get(Math.round(x) + ',' + Math.round(z));
      return t ? t.y + 1 : this.fallbackY;
    }

    topBlock(x, z) {
      return this.topMap.get(Math.round(x) + ',' + Math.round(z)) || null;
    }

    set(x, y, z, color, type, record) {
      x = Math.round(x); y = Math.round(y); z = Math.round(z);
      if (y < this.minY || y > this.maxY) return false;
      if (Math.abs(x) > this.bounds + 40 || Math.abs(z) > this.bounds + 40) return false;
      const k = this.key(x, y, z);
      const prev = this.blocks.get(k);
      if (prev && prev.c === color && prev.t === type) return false;
      this.blocks.set(k, { x, y, z, c: color, t: type });
      this._addToChunk(x, y, z, k);
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
      if (!cur || y > cur.y) this.topMap.set(k, { y, c: color, t: type });
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
        for (const m of old.meshes) {
          this.group.remove(m);
          if (m.dispose) m.dispose();
        }
      }
      const x0 = cx * this.chunkSize, z0 = cz * this.chunkSize;
      const buckets = { solid: [], glow: [], deco: [], water: [], glass: [] };
      const set = this.chunkBlocks.get(ck);
      if (set) {
        for (const k of set) {
          const b = this.blocks.get(k);
          if (!b) continue;
          if (b.t === TYPE_GLOW) buckets.glow.push(b);
          else if (b.t === TYPE_WATER) buckets.water.push(b);
          else if (b.t === TYPE_DECO) buckets.deco.push(b);
          else if (b.t === TYPE_GLASS) buckets.glass.push(b);
          else buckets.solid.push(b);
        }
      }

      const meshes = [];
      const make = (list, mat, scale, order) => {
        if (!list.length) return;
        const mesh = new THREE.InstancedMesh(SHARED.chamfer, mat, list.length);
        const m = new THREE.Matrix4();
        const q = new THREE.Quaternion();
        const s = new THREE.Vector3(scale, scale, scale);
        const p = new THREE.Vector3();
        const col = new THREE.Color();
        for (let i = 0; i < list.length; i++) {
          const b = list[i];
          p.set(b.x + 0.5, b.y + 0.5, b.z + 0.5);
          m.compose(p, q, s);
          mesh.setMatrixAt(i, m);
          col.setHex(b.c >>> 0);
          mesh.setColorAt(i, col);
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        // 分块已经足够小，直接关闭实例网格的视锥剔除，避免错误的包围球裁掉整块地形
        mesh.frustumCulled = false;
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        mesh.renderOrder = order || 0;
        mesh.userData.chunk = ck;
        this.group.add(mesh);
        meshes.push(mesh);
      };

      make(buckets.solid, this.matSolid, 1);
      make(buckets.deco, this.matSolid, 1);
      make(buckets.glow, this.matGlow, 1);
      make(buckets.glass, this.matGlass, 1, 2);
      make(buckets.water, this.matWater, 1, 1);

      this.chunks.set(ck, { meshes, count: buckets.solid.length + buckets.glow.length + buckets.deco.length + buckets.water.length + buckets.glass.length });
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
    }

    /* ---------- 生成期 ---------- */
    beginGeneration() { this.recordEdits = false; }
    endGeneration() {
      this.recordEdits = true;
      this.markAllDirty();
      this.createWater();
      this.createEndlessGround();
    }

    /* ---------- 水面 ---------- */
    createWater() {
      if (this.meta.waterLevel == null) return;
      const size = 2000;
      const geo = new THREE.PlaneGeometry(size, size, 72, 72);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x1d6f99, transparent: true, opacity: 0.92, depthWrite: false
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = this.meta.waterLevel + 0.28;
      mesh.renderOrder = 2;
      mesh.frustumCulled = false;
      this.waterPlane = mesh;
      this.group.add(mesh);
      this._waterBase = geo.attributes.position.array.slice();
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
      ctx.globalAlpha = 0.10;
      ctx.strokeStyle = dark;
      ctx.lineWidth = 1;
      for (let i = 0; i <= 128; i += 16) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 128); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(128, i); ctx.stroke();
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
      if (this.meta.waterLevel != null || this.endlessPlane) return;
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
      if (this.waterPlane) {
        this.waterTime += dt;
        const pos = this.waterPlane.geometry.attributes.position;
        const base = this._waterBase;
        if (base) {
          const t = this.waterTime;
          for (let i = 0; i < pos.count; i++) {
            const bx = base[i * 3], bz = base[i * 3 + 2];
            pos.array[i * 3 + 1] = Math.sin(bx * 0.16 + t * 1.1) * 0.09 +
              Math.cos(bz * 0.2 + t * 0.8) * 0.07;
          }
          pos.needsUpdate = true;
        }
        if (cameraPos) {
          this.waterPlane.position.x = cameraPos.x;
          this.waterPlane.position.z = cameraPos.z;
        }
      }
      if (this.endlessPlane && cameraPos) {
        // 无限地面是静态环形面，中心留出真实地图，不随相机移动
        this.endlessPlane.position.y = this.fallbackY - 0.04;
      }
    }

    /* ---------- 碰撞 ---------- */
    collidesBox(x, y, z, radius, height) {
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
        if (c === -1) this.remove(x, y, z, false);
        else this.set(x, y, z, c, t || 0, false);
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
        blocks: out
      };
    }

    loadSerialized(data) {
      this.recordEdits = false;
      this.blocks.clear();
      this.chunkBlocks.clear();
      this.topMap.clear();
      this.editLog.clear();
      for (const ck of this.chunks.keys()) {
        const ch = this.chunks.get(ck);
        for (const m of ch.meshes) { this.group.remove(m); if (m.dispose) m.dispose(); }
      }
      this.chunks.clear();
      for (const b of data.blocks || []) {
        if (b.length < 4) continue;
        const k = this.key(b[0], b[1], b[2]);
        this.blocks.set(k, { x: b[0], y: b[1], z: b[2], c: b[3], t: b[4] || 0 });
        this._addToChunk(b[0], b[1], b[2], k);
        this._trackTop(b[0], b[1], b[2], b[3], b[4] || 0);
      }
      this.recordEdits = true;
      this.markAllDirty();
      this.rebuildAllSync(400);
      if (this.meta.waterLevel != null && !this.waterPlane) this.createWater();
      this.createEndlessGround();
    }

    /* 统计 */
    get blockCount() { return this.blocks.size; }

    dispose() {
      for (const ch of this.chunks.values()) {
        for (const m of ch.meshes) { this.group.remove(m); if (m.dispose) m.dispose(); }
      }
      this.chunks.clear();
      this.chunkBlocks.clear();
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
      if (this.group.parent) this.group.parent.remove(this.group);
    }
  }

  MW.VoxelWorld = VoxelWorld;
})();
