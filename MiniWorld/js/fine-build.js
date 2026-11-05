/* Fine construction is a separate sparse layer. Metre-scale terrain, buildings
 * and old save files are unchanged. Rendering and physics share these AABBs. */
(function () {
  "use strict";
  const MW = window.MW;
  const EPS = 0.00001;
  const MAX_CELLS = 10000;
  const MAX_EDITS = 20000;
  const INDEX_SIZE = 1;
  const CHUNK_SIZE = 4;
  const NORMALS = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  const copy = (cell) => ({ ...cell });
  const round = (n) => Math.round(n * 100000) / 100000;
  const solid = (cell) => [0, 1, 4, 5].includes(cell.t);
  const opaque = (cell) => [0, 1, 4].includes(cell.t);
  const overlaps = (a, b) =>
    a.x < b.x + b.w - EPS &&
    a.x + a.w > b.x + EPS &&
    a.y < b.y + b.h - EPS &&
    a.y + a.h > b.y + EPS &&
    a.z < b.z + b.d - EPS &&
    a.z + a.d > b.z + EPS;

  function rangeKeys(box, size) {
    const keys = [];
    for (
      let x = Math.floor(box.x / size);
      x <= Math.floor((box.x + box.w - EPS) / size);
      x++
    )
      for (
        let y = Math.floor(box.y / size);
        y <= Math.floor((box.y + box.h - EPS) / size);
        y++
      )
        for (
          let z = Math.floor(box.z / size);
          z <= Math.floor((box.z + box.d - EPS) / size);
          z++
        )
          keys.push(x + "," + y + "," + z);
    return keys;
  }

  function validateCell(raw, world) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw Error("精细构件格式无效");
    if (typeof raw.id !== "string" || !/^[a-zA-Z0-9_:.,-]{1,100}$/.test(raw.id))
      throw Error("精细构件 ID 无效");
    if (![raw.x, raw.y, raw.z, raw.w, raw.h, raw.d].every(Number.isFinite))
      throw Error("精细构件坐标或尺寸不是有限数");
    if ([raw.w, raw.h, raw.d].some((n) => n < 0.05 - EPS || n > 4 + EPS))
      throw Error("精细构件每边需在 0.05–4 m");
    if (
      !Number.isInteger(raw.c) ||
      raw.c < 0 ||
      raw.c > 0xffffff ||
      !Number.isInteger(raw.t) ||
      raw.t < 0 ||
      raw.t > 5
    )
      throw Error("精细构件材质无效");
    const bound =
      (world.meta?.terrain ? world.meta.travelBounds : world.bounds + 40) ||
      world.bounds + 40;
    const boundZ = world.meta?.travelBoundsZ || bound;
    if (
      ![bound, boundZ, world.minY, world.maxY].every(Number.isFinite) ||
      bound <= 0 ||
      boundZ <= 0 ||
      world.maxY < world.minY
    )
      throw Error("世界边界元数据无效");
    if (
      raw.x < -bound ||
      raw.x + raw.w > bound ||
      raw.z < -boundZ ||
      raw.z + raw.d > boundZ ||
      raw.y < world.minY ||
      raw.y + raw.h > world.maxY + 1
    )
      throw Error("精细构件超出世界边界或高度");
    if (
      raw.source !== undefined &&
      (typeof raw.source !== "string" || raw.source.length > 80)
    )
      throw Error("构件来源标记无效");
    return {
      id: raw.id,
      x: round(raw.x),
      y: round(raw.y),
      z: round(raw.z),
      w: round(raw.w),
      h: round(raw.h),
      d: round(raw.d),
      c: raw.c,
      t: raw.t,
      source: raw.source || "import",
    };
  }

  function rayBox(origin, dir, box, maxDist) {
    let near = -Infinity,
      far = Infinity,
      normal = [0, 1, 0];
    const axes = ["x", "y", "z"],
      sizes = ["w", "h", "d"];
    for (let axis = 0; axis < 3; axis++) {
      const key = axes[axis],
        low = box[key],
        high = low + box[sizes[axis]],
        d = dir[key];
      if (Math.abs(d) < 1e-12) {
        if (origin[key] < low || origin[key] > high) return null;
        continue;
      }
      let a = (low - origin[key]) / d,
        b = (high - origin[key]) / d;
      let sign = -1;
      if (a > b) {
        const swap = a;
        a = b;
        b = swap;
        sign = 1;
      }
      if (a > near) {
        near = a;
        normal = [0, 0, 0];
        normal[axis] = sign;
      }
      far = Math.min(far, b);
      if (near > far + EPS) return null;
    }
    if (far < 0 || near > maxDist) return null;
    return {
      dist: Math.max(0, near),
      nx: normal[0],
      ny: normal[1],
      nz: normal[2],
    };
  }

  // Merge equal-colour coplanar exposed rectangles without changing their bounds.
  function mergeRectangles(rects) {
    let result = rects;
    for (let pass = 0; pass < 2; pass++) {
      for (const horizontal of [true, false]) {
        const groups = new Map();
        for (const rect of result) {
          const key = horizontal
            ? rect.v0 + ":" + rect.v1
            : rect.u0 + ":" + rect.u1;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(rect);
        }
        result = [];
        for (const items of groups.values()) {
          items.sort((a, b) => (horizontal ? a.u0 - b.u0 : a.v0 - b.v0));
          for (const item of items) {
            const last = result[result.length - 1];
            const join = horizontal
              ? last &&
                last.v0 === item.v0 &&
                last.v1 === item.v1 &&
                Math.abs(last.u1 - item.u0) < EPS
              : last &&
                last.u0 === item.u0 &&
                last.u1 === item.u1 &&
                Math.abs(last.v1 - item.v0) < EPS;
            if (join) {
              if (horizontal) last.u1 = item.u1;
              else last.v1 = item.v1;
            } else result.push({ ...item });
          }
        }
      }
    }
    return result;
  }

  class FineBuild {
    constructor(world) {
      this.world = world;
      this.cells = new Map();
      this.index = new Map();
      this.columns = new Map();
      this.chunkCells = new Map();
      this.chunks = new Map();
      this.dirty = new Set();
      this.editLog = new Map();
      this.stats = { triangles: 0, chunks: 0 };
      this.disposed = false;
    }

    chunkKey(cell) {
      return [cell.x, cell.y, cell.z]
        .map((n) => Math.floor(n / CHUNK_SIZE))
        .join(",");
    }

    query(box) {
      const found = new Set();
      for (const key of rangeKeys(box, INDEX_SIZE))
        for (const id of this.index.get(key) || []) found.add(id);
      return [...found].map((id) => this.cells.get(id)).filter(Boolean);
    }

    _dirtyAround(cell) {
      this.dirty.add(this.chunkKey(cell));
      const around = {
        x: cell.x - EPS * 2,
        y: cell.y - EPS * 2,
        z: cell.z - EPS * 2,
        w: cell.w + EPS * 4,
        h: cell.h + EPS * 4,
        d: cell.d + EPS * 4,
      };
      for (const other of this.query(around))
        this.dirty.add(this.chunkKey(other));
    }

    _columnKeys(cell) {
      const keys = [];
      for (
        let x = Math.floor(cell.x);
        x <= Math.floor(cell.x + cell.w - EPS);
        x++
      )
        for (
          let z = Math.floor(cell.z);
          z <= Math.floor(cell.z + cell.d - EPS);
          z++
        )
          keys.push(x + "," + z);
      return keys;
    }

    _insert(cell) {
      this.cells.set(cell.id, cell);
      for (const key of this._columnKeys(cell)) {
        if (!this.columns.has(key)) this.columns.set(key, new Set());
        this.columns.get(key).add(cell.id);
      }
      for (const key of rangeKeys(cell, INDEX_SIZE)) {
        if (!this.index.has(key)) this.index.set(key, new Set());
        this.index.get(key).add(cell.id);
      }
      const key = this.chunkKey(cell);
      if (!this.chunkCells.has(key)) this.chunkCells.set(key, new Set());
      this.chunkCells.get(key).add(cell.id);
      this._dirtyAround(cell);
    }

    _erase(id) {
      const cell = this.cells.get(id);
      if (!cell) return false;
      this._dirtyAround(cell);
      this.cells.delete(id);
      for (const key of this._columnKeys(cell)) {
        this.columns.get(key)?.delete(id);
        if (!this.columns.get(key)?.size) this.columns.delete(key);
      }
      for (const key of rangeKeys(cell, INDEX_SIZE)) {
        this.index.get(key)?.delete(id);
        if (!this.index.get(key)?.size) this.index.delete(key);
      }
      this.chunkCells.get(this.chunkKey(cell))?.delete(id);
      return true;
    }

    addBatch(rawCells, record = true) {
      if (!Array.isArray(rawCells) || rawCells.length > MAX_CELLS)
        throw Error("精细构件数量超限");
      const prepared = rawCells.map((cell) => validateCell(cell, this.world));
      const ids = new Set();
      let additions = 0,
        newEdits = 0;
      // A temporary spatial hash keeps batch validation bounded and atomic.
      const staged = new Map();
      for (const cell of prepared) {
        if (ids.has(cell.id)) throw Error("批次包含重复构件 ID");
        ids.add(cell.id);
        if (!this.cells.has(cell.id)) additions++;
        if (!this.editLog.has(cell.id)) newEdits++;
        const candidates = new Map(
          this.query(cell).map((other) => [other.id, other]),
        );
        for (const key of rangeKeys(cell, INDEX_SIZE))
          for (const other of staged.get(key) || [])
            candidates.set(other.id, other);
        for (const other of candidates.values())
          if (other.id !== cell.id && overlaps(cell, other))
            throw Error("构件与已有精细构件重叠");
        for (const key of rangeKeys(cell, INDEX_SIZE)) {
          if (!staged.has(key)) staged.set(key, []);
          staged.get(key).push(cell);
        }
      }
      if (this.cells.size + additions > MAX_CELLS)
        throw Error("精细层最多保存 10000 个构件");
      if (record && this.editLog.size + newEdits > MAX_EDITS)
        throw Error("精细编辑记录已达上限，请导出备份");
      for (const cell of prepared) {
        this._erase(cell.id);
        this._insert(cell);
        if (record) this.editLog.set(cell.id, copy(cell));
      }
      if (prepared.length) this.world.revision++;
      return prepared.length;
    }

    remove(id, record = true) {
      if (!this.cells.has(id)) return false;
      if (record && !this.editLog.has(id) && this.editLog.size >= MAX_EDITS)
        throw Error("精细编辑记录已达上限");
      if (!this._erase(id)) return false;
      if (record) this.editLog.set(id, null);
      this.world.revision++;
      return true;
    }

    collidesBox(x, y, z, radius, height) {
      const box = {
        x: x - radius,
        y: y + 0.001,
        z: z - radius,
        w: radius * 2,
        h: height - 0.002,
        d: radius * 2,
      };
      return this.query(box).some((cell) => solid(cell) && overlaps(box, cell));
    }

    supportAt(x, z, maxY, radius = 0.25) {
      const box = {
        x: x - radius,
        y: maxY - 1.1,
        z: z - radius,
        w: radius * 2,
        h: 1.102,
        d: radius * 2,
      };
      let top = -Infinity;
      for (const cell of this.query(box))
        if (
          solid(cell) &&
          cell.y + cell.h <= maxY + 0.002 &&
          x + radius > cell.x + EPS &&
          x - radius < cell.x + cell.w - EPS &&
          z + radius > cell.z + EPS &&
          z - radius < cell.z + cell.d - EPS
        )
          top = Math.max(top, cell.y + cell.h);
      return top;
    }

    stepHeightsAt(x, z, feet, maxRise, radius) {
      const box = {
        x: x - radius,
        y: feet,
        z: z - radius,
        w: radius * 2,
        h: maxRise,
        d: radius * 2,
      };
      return [
        ...new Set(
          this.query(box)
            .filter((cell) => solid(cell) && overlaps(box, cell))
            .map((cell) => round(cell.y + cell.h - feet + 0.004))
            .filter((rise) => rise > 0 && rise <= maxRise),
        ),
      ].sort((a, b) => a - b);
    }

    topAt(x, z) {
      let top = -Infinity;
      for (const id of this.columns.get(Math.floor(x) + "," + Math.floor(z)) ||
        []) {
        const cell = this.cells.get(id);
        if (
          solid(cell) &&
          x >= cell.x &&
          x < cell.x + cell.w &&
          z >= cell.z &&
          z < cell.z + cell.d
        )
          top = Math.max(top, cell.y + cell.h);
      }
      return top;
    }

    raycast(origin, dir, maxDist) {
      if (!this.cells.size || !Number.isFinite(maxDist) || maxDist <= 0)
        return null;
      const length = Math.hypot(dir.x, dir.y, dir.z);
      if (length < EPS) return null;
      const direction = {
        x: dir.x / length,
        y: dir.y / length,
        z: dir.z / length,
      };
      const axes = ["x", "y", "z"];
      const bucket = axes.map((axis) => Math.floor(origin[axis] / INDEX_SIZE));
      const steps = axes.map((axis) => (direction[axis] > 0 ? 1 : -1));
      const delta = axes.map((axis) =>
        Math.abs(direction[axis]) < 1e-12
          ? Infinity
          : INDEX_SIZE / Math.abs(direction[axis]),
      );
      const next = axes.map((axis, i) =>
        Math.abs(direction[axis]) < 1e-12
          ? Infinity
          : ((bucket[i] + (steps[i] > 0 ? 1 : 0)) * INDEX_SIZE - origin[axis]) /
            direction[axis],
      );
      const tested = new Set();
      let nearest = null,
        distance = 0;
      // Exact voxel traversal of the metre index. Fine shapes are tested using
      // their real AABBs, never snapped to the index bucket or ray step size.
      while (distance <= maxDist) {
        for (const id of this.index.get(bucket.join(",")) || []) {
          if (tested.has(id)) continue;
          tested.add(id);
          const cell = this.cells.get(id);
          const hit = rayBox(
            origin,
            direction,
            cell,
            nearest ? nearest.dist : maxDist,
          );
          if (hit && (!nearest || hit.dist < nearest.dist))
            nearest = {
              ...hit,
              fine: true,
              fineId: cell.id,
              x: cell.x,
              y: cell.y,
              z: cell.z,
              cell: copy(cell),
              point: {
                x: origin.x + direction.x * hit.dist,
                y: origin.y + direction.y * hit.dist,
                z: origin.z + direction.z * hit.dist,
              },
            };
        }
        const axis =
          next[0] <= next[1] && next[0] <= next[2]
            ? 0
            : next[1] <= next[2]
              ? 1
              : 2;
        distance = next[axis];
        if (nearest && distance > nearest.dist + EPS) break;
        bucket[axis] += steps[axis];
        next[axis] += delta[axis];
      }
      return nearest;
    }

    exposedFaces(cell, dir) {
      const axis = dir < 2 ? "x" : dir < 4 ? "y" : "z";
      const size = axis === "x" ? "w" : axis === "y" ? "h" : "d";
      const positive = dir % 2 === 0;
      const plane = round(cell[axis] + (positive ? cell[size] : 0));
      const rect =
        dir < 2
          ? {
              u0: cell.z,
              u1: round(cell.z + cell.d),
              v0: cell.y,
              v1: round(cell.y + cell.h),
            }
          : dir < 4
            ? {
                u0: cell.x,
                u1: round(cell.x + cell.w),
                v0: cell.z,
                v1: round(cell.z + cell.d),
              }
            : {
                u0: cell.x,
                u1: round(cell.x + cell.w),
                v0: cell.y,
                v1: round(cell.y + cell.h),
              };
      const slab = { ...cell, [axis]: plane - EPS * 2, [size]: EPS * 4 };
      const covers = [];
      for (const other of this.query(slab)) {
        if (
          other.id === cell.id ||
          !(opaque(other) || (other.t === cell.t && [3, 5].includes(cell.t)))
        )
          continue;
        const boundary = positive ? other[axis] : other[axis] + other[size];
        if (Math.abs(boundary - plane) > EPS) continue;
        const projection =
          dir < 2
            ? {
                u0: other.z,
                u1: other.z + other.d,
                v0: other.y,
                v1: other.y + other.h,
              }
            : dir < 4
              ? {
                  u0: other.x,
                  u1: other.x + other.w,
                  v0: other.z,
                  v1: other.z + other.d,
                }
              : {
                  u0: other.x,
                  u1: other.x + other.w,
                  v0: other.y,
                  v1: other.y + other.h,
                };
        if (
          projection.u0 < rect.u1 - EPS &&
          projection.u1 > rect.u0 + EPS &&
          projection.v0 < rect.v1 - EPS &&
          projection.v1 > rect.v0 + EPS
        )
          covers.push(projection);
      }
      const us = [rect.u0, rect.u1],
        vs = [rect.v0, rect.v1];
      for (const cover of covers) {
        us.push(Math.max(rect.u0, cover.u0), Math.min(rect.u1, cover.u1));
        vs.push(Math.max(rect.v0, cover.v0), Math.min(rect.v1, cover.v1));
      }
      const unique = (values) =>
        [...new Set(values.map(round))].sort((a, b) => a - b);
      const u = unique(us),
        v = unique(vs),
        visible = [];
      for (let i = 0; i < u.length - 1; i++)
        for (let j = 0; j < v.length - 1; j++) {
          const midU = (u[i] + u[i + 1]) / 2,
            midV = (v[j] + v[j + 1]) / 2;
          if (
            !covers.some(
              (c) =>
                midU > c.u0 - EPS &&
                midU < c.u1 + EPS &&
                midV > c.v0 - EPS &&
                midV < c.v1 + EPS,
            )
          )
            visible.push({ u0: u[i], u1: u[i + 1], v0: v[j], v1: v[j + 1] });
        }
      return { plane, rects: visible };
    }

    buildChunk(key) {
      const old = this.chunks.get(key);
      if (old) {
        for (const mesh of old.meshes) {
          this.world.group.remove(mesh);
          mesh.geometry.dispose();
        }
        this.stats.triangles -= old.triangles;
        this.chunks.delete(key);
      }
      const ids = this.chunkCells.get(key);
      if (!ids?.size) {
        this.chunkCells.delete(key);
        this.stats.chunks = this.chunks.size;
        return;
      }
      const origin = key.split(",").map((n) => Number(n) * CHUNK_SIZE);
      const planes = new Map();
      for (const id of ids) {
        const cell = this.cells.get(id);
        for (let dir = 0; dir < 6; dir++) {
          const face = this.exposedFaces(cell, dir);
          const kind =
            cell.t === 1
              ? "glow"
              : cell.t === 3
                ? "water"
                : cell.t === 5
                  ? "glass"
                  : "solid";
          const planeKey = [dir, face.plane, cell.c, kind].join("|");
          if (!planes.has(planeKey))
            planes.set(planeKey, {
              dir,
              plane: face.plane,
              color: cell.c,
              kind,
              rects: [],
            });
          planes.get(planeKey).rects.push(...face.rects);
        }
      }
      const buckets = new Map(),
        color = new THREE.Color();
      for (const face of planes.values()) {
        if (!buckets.has(face.kind))
          buckets.set(face.kind, {
            positions: [],
            normals: [],
            colors: [],
            uv: [],
            indices: [],
          });
        const data = buckets.get(face.kind);
        color.setHex(face.color);
        for (const rect of mergeRectangles(face.rects)) {
          const first = data.positions.length / 3;
          for (const [u, v] of [
            [rect.u0, rect.v0],
            [rect.u1, rect.v0],
            [rect.u1, rect.v1],
            [rect.u0, rect.v1],
          ]) {
            const p =
              face.dir < 2
                ? [face.plane, v, u]
                : face.dir < 4
                  ? [u, face.plane, v]
                  : [u, v, face.plane];
            data.positions.push(
              p[0] - origin[0],
              p[1] - origin[1],
              p[2] - origin[2],
            );
            data.normals.push(...NORMALS[face.dir]);
            data.colors.push(color.r, color.g, color.b);
            data.uv.push(u / 4, v / 4);
          }
          if ([0, 2, 5].includes(face.dir))
            data.indices.push(
              first,
              first + 2,
              first + 1,
              first,
              first + 3,
              first + 2,
            );
          else
            data.indices.push(
              first,
              first + 1,
              first + 2,
              first,
              first + 2,
              first + 3,
            );
        }
      }
      const materials = {
        solid: this.world.matSolid,
        glow: this.world.matGlow,
        water: this.world.matWater,
        glass: this.world.matGlass,
      };
      const meshes = [];
      let triangles = 0;
      for (const [kind, data] of buckets) {
        if (!data.indices.length) continue;
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(data.positions, 3),
        );
        geometry.setAttribute(
          "normal",
          new THREE.Float32BufferAttribute(data.normals, 3),
        );
        geometry.setAttribute(
          "color",
          new THREE.Float32BufferAttribute(data.colors, 3),
        );
        geometry.setAttribute(
          "uv",
          new THREE.Float32BufferAttribute(data.uv, 2),
        );
        geometry.setIndex(data.indices);
        geometry.computeBoundingSphere();
        const mesh = new THREE.Mesh(geometry, materials[kind]);
        mesh.name = "fine-build-" + key;
        mesh.position.set(...origin);
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        mesh.userData.fineChunk = key;
        if (kind === "water" || kind === "glass") mesh.renderOrder = 2;
        this.world.group.add(mesh);
        meshes.push(mesh);
        triangles += data.indices.length / 3;
      }
      this.chunks.set(key, { meshes, triangles });
      this.stats.triangles += triangles;
      this.stats.chunks = this.chunks.size;
    }

    rebuildDirty(limit = 2) {
      let rebuilt = 0;
      for (const key of this.dirty) {
        this.dirty.delete(key);
        this.buildChunk(key);
        if (++rebuilt >= limit) break;
      }
      return rebuilt;
    }

    serialize() {
      return {
        version: 1,
        cells: [...this.cells.values()].map(copy),
        edits: [...this.editLog].map(([id, cell]) => ({
          id,
          cell: cell ? copy(cell) : null,
        })),
      };
    }

    static validateSnapshot(data, world) {
      if (
        !data ||
        data.version !== 1 ||
        !Array.isArray(data.cells) ||
        data.cells.length > MAX_CELLS
      )
        throw Error("精细层文件格式或构件数量无效");
      if (
        data.edits !== undefined &&
        (!Array.isArray(data.edits) || data.edits.length > MAX_EDITS)
      )
        throw Error("精细层编辑记录数量无效");
      const staging = new FineBuild({
        ...world,
        revision: world.revision || 0,
      });
      staging.addBatch(data.cells, false);
      const seen = new Set();
      for (const entry of data.edits || []) {
        if (
          !entry ||
          typeof entry.id !== "string" ||
          !/^[a-zA-Z0-9_:.,-]{1,100}$/.test(entry.id) ||
          seen.has(entry.id)
        )
          throw Error("精细层编辑 ID 无效");
        seen.add(entry.id);
        const cell =
          entry.cell === null ? null : validateCell(entry.cell, world);
        if (cell && cell.id !== entry.id) throw Error("精细层编辑 ID 不一致");
        if (
          cell &&
          JSON.stringify(cell) !== JSON.stringify(staging.cells.get(entry.id))
        )
          throw Error("精细层编辑记录与构件不一致");
        if (!cell && staging.cells.has(entry.id))
          throw Error("精细层删除记录与构件不一致");
        staging.editLog.set(entry.id, cell);
      }
      return staging;
    }

    loadSnapshot(data) {
      const revision = this.world.revision;
      const staging = FineBuild.validateSnapshot(data, {
        ...this.world,
        revision,
      });
      for (const chunk of this.chunks.values())
        for (const mesh of chunk.meshes) {
          this.world.group.remove(mesh);
          mesh.geometry.dispose();
        }
      this.cells = staging.cells;
      this.index = staging.index;
      this.columns = staging.columns;
      this.chunkCells = staging.chunkCells;
      this.dirty = new Set([...this.chunks.keys(), ...this.chunkCells.keys()]);
      this.chunks = new Map();
      this.editLog = staging.editLog;
      this.stats = { triangles: 0, chunks: 0 };
      this.world.revision++;
      return true;
    }

    dispose() {
      if (this.disposed) return;
      this.disposed = true;
      for (const chunk of this.chunks.values())
        for (const mesh of chunk.meshes) {
          this.world.group.remove(mesh);
          mesh.geometry.dispose();
        }
      this.chunks.clear();
      this.cells.clear();
      this.index.clear();
      this.columns.clear();
      this.chunkCells.clear();
      this.dirty.clear();
      this.editLog.clear();
      this.stats = { triangles: 0, chunks: 0 };
    }
  }

  function prefab(
    name,
    x,
    y,
    z,
    rotation = 0,
    color = 0xbca787,
    prefix = "prefab",
  ) {
    const local = [];
    const add = (a, b, c, w, h, d, tint = color, type = 0) =>
      local.push({ x: a, y: b, z: c, w, h, d, c: tint, t: type });
    const timber = color,
      metal = 0x455f60,
      stone = 0xc6c8b8;
    if (name === "stairs") {
      for (let i = 0; i < 5; i++)
        add(-0.75, 0, i * 0.4, 1.5, (i + 1) * 0.2, 0.4, stone);
    } else if (name === "bench") {
      for (const a of [-0.7, 0.6])
        for (const c of [-0.25, 0.15]) add(a, 0, c, 0.1, 0.4, 0.1, metal);
      for (let i = 0; i < 3; i++)
        add(-0.9, 0.4, -0.28 + i * 0.2, 1.8, 0.1, 0.15, timber);
      for (const a of [-0.75, 0.65]) add(a, 0.5, 0.28, 0.1, 0.45, 0.1, metal);
      for (const h of [0.65, 0.85]) add(-0.9, h, 0.38, 1.8, 0.1, 0.1, timber);
    } else if (name === "planter") {
      add(-0.6, 0, -0.6, 1.2, 0.5, 0.1, stone);
      add(-0.6, 0, 0.5, 1.2, 0.5, 0.1, stone);
      add(-0.6, 0, -0.5, 0.1, 0.5, 1, stone);
      add(0.5, 0, -0.5, 0.1, 0.5, 1, stone);
      add(-0.5, 0.05, -0.5, 1, 0.3, 1, 0x725843);
      for (const a of [-0.3, 0.15])
        for (const c of [-0.3, 0.15])
          add(a, 0.35, c, 0.2, 0.35, 0.2, 0x71966b, 4);
    } else if (name === "lamp") {
      add(-0.175, 0, -0.175, 0.35, 0.1, 0.35, metal);
      add(-0.05, 0.1, -0.05, 0.1, 1.65, 0.1, metal);
      add(-0.15, 1.75, -0.15, 0.3, 0.15, 0.3, 0xffe0a3, 1);
      add(-0.25, 1.9, -0.25, 0.5, 0.1, 0.5, metal);
    } else if (name === "pergola") {
      for (const a of [-1.4, 1.25])
        for (const c of [-1.1, 0.95]) add(a, 0, c, 0.15, 2.3, 0.15, timber);
      for (const c of [-1.1, 0.95]) add(-1.5, 2.3, c, 3, 0.15, 0.15, timber);
      for (let i = 0; i < 7; i++)
        add(-1.4 + i * 0.45, 2.45, -1.3, 0.1, 0.1, 2.6, timber);
    } else if (name === "rail") {
      for (const a of [-0.75, -0.04, 0.67])
        add(a, 0, -0.04, 0.08, 0.9, 0.08, metal);
      add(-0.8, 0.9, -0.04, 1.6, 0.08, 0.08, timber);
    } else throw Error("未知微型预制件");
    const turns = ((rotation % 4) + 4) % 4;
    return local.map((part, i) => {
      let a = part.x,
        c = part.z,
        w = part.w,
        d = part.d;
      for (let r = 0; r < turns; r++) {
        const oldA = a;
        a = -c - d;
        c = oldA;
        const oldW = w;
        w = d;
        d = oldW;
      }
      return {
        ...part,
        id: prefix + "_" + i,
        x: round(x + a),
        y: round(y + part.y),
        z: round(z + c),
        w: round(w),
        d: round(d),
        source: "prefab:" + name,
      };
    });
  }

  function placement(hit, origin, dir, grid) {
    if (![0.25, 0.5, 1].includes(grid)) grid = 0.25;
    const point = hit.point || {
      x: origin.x + dir.x * hit.dist,
      y: origin.y + dir.y * hit.dist,
      z: origin.z + dir.z * hit.dist,
    };
    const target = {
      x: Math.floor((point.x + hit.nx * EPS) / grid) * grid,
      y: Math.floor((point.y + hit.ny * EPS) / grid) * grid,
      z: Math.floor((point.z + hit.nz * EPS) / grid) * grid,
      w: grid,
      h: grid,
      d: grid,
    };
    // Along the hit normal, meet the real face exactly, including 20 cm treads
    // and non-grid-aligned terrain heights. Tangential axes remain grid-snapped.
    if (hit.nx) target.x = point.x + (hit.nx < 0 ? -grid : 0);
    if (hit.ny) target.y = point.y + (hit.ny < 0 ? -grid : 0);
    if (hit.nz) target.z = point.z + (hit.nz < 0 ? -grid : 0);
    target.x = round(target.x);
    target.y = round(target.y);
    target.z = round(target.z);
    return target;
  }

  function validateWorldData(data) {
    if (!data || !Array.isArray(data.blocks) || data.blocks.length > 600000)
      throw Error("世界方块格式或数量无效");
    const meta = data.meta || {};
    for (const key of ["bounds", "travelBounds", "travelBoundsZ"])
      if (
        meta[key] !== undefined &&
        (!Number.isFinite(meta[key]) || meta[key] <= 0 || meta[key] > 21000000)
      )
        throw Error("世界边界元数据无效");
    for (const key of ["minY", "maxY", "fallbackY"])
      if (
        meta[key] !== undefined &&
        (!Number.isFinite(meta[key]) || Math.abs(meta[key]) > 20000)
      )
        throw Error("世界高度元数据无效");
    if (
      meta.spawn !== undefined &&
      (!Array.isArray(meta.spawn) ||
        meta.spawn.length !== 3 ||
        !meta.spawn.every(Number.isFinite))
    )
      throw Error("世界出生点无效");
    for (const block of data.blocks) {
      if (
        !Array.isArray(block) ||
        block.length < 4 ||
        !block.slice(0, 4).every(Number.isInteger) ||
        Math.abs(block[0]) > 21000000 ||
        Math.abs(block[2]) > 21000000 ||
        Math.abs(block[1]) > 20000 ||
        block[3] < 0 ||
        block[3] > 0xffffff ||
        (block[4] !== undefined &&
          (!Number.isInteger(block[4]) || block[4] < 0 || block[4] > 5))
      )
        throw Error("世界含有无效旧方块；原世界未改变");
    }
    return true;
  }

  MW.FineBuild = FineBuild;
  MW.FineBuildTools = {
    MAX_CELLS,
    MAX_EDITS,
    overlaps,
    rayBox,
    validateCell,
    validateWorldData,
    prefab,
    placement,
  };
})();
