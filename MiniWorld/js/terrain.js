/* Bounded, deterministic terrain streaming. All mesh vertices are local to a
 * chunk so metre-scale rendering remains stable at continent-sized coordinates.
 * Rendering is disposable; terrain, collisions and scenery come from the seed.
 */
(function () {
  'use strict';
  const MW = window.MW;
  const now = () => typeof performance !== 'undefined' ? performance.now() : Date.now();
  const key = (x, z) => x + ',' + z;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  class StreamedTerrain {
    constructor(world) {
      this.world = world;
      this.config = world.meta.terrain;
      this.size = this.config.chunkSize || 256;
      this.radius = clamp(this.config.radius || 6, 2, 7);
      this.nearRadius = this.config.nearRadius == null ? 2 : this.config.nearRadius;
      this.cacheLimit = Math.min(this.config.cacheLimit || 169, 225);
      this.budget = clamp(this.config.budget || 2, 1, 3);
      this.sample = MW.Geography.makeSampler(world.meta);
      this.chunks = new Map();
      this.pending = [];
      this.wanted = new Map();
      this.heights = new Map();
      this.lots = new Map();
      this.center = null;
      this.disposed = false;
      this.group = new THREE.Group();
      this.group.name = 'streamed-terrain';
      this.world.group.add(this.group);
      this.material = new THREE.MeshLambertMaterial({ vertexColors: true });
      this.sceneryMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
      this.stats = { resident: 0, pending: 0, built: 0, evicted: 0, triangles: 0 };
    }

    // Collision uses the same 8 m triangle grid as the nearest terrain meshes.
    // Sampling never creates a mesh, allowing bounded atlas rendering and queries.
    _heightNode(gx, gz) {
      const k = key(gx, gz);
      if (this.heights.has(k)) return this.heights.get(k);
      const h = this.sample(gx * 8, gz * 8).height;
      if (this.heights.size >= 8192) this.heights.clear();
      this.heights.set(k, h);
      return h;
    }

    heightAt(x, z) {
      const gx = Math.floor(x / 8), gz = Math.floor(z / 8);
      const u = x / 8 - gx, v = z / 8 - gz;
      const a = this._heightNode(gx, gz), b = this._heightNode(gx + 1, gz);
      const c = this._heightNode(gx, gz + 1), d = this._heightNode(gx + 1, gz + 1);
      return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
    }

    _lot(cx, cz) {
      const k = key(cx, cz);
      if (this.lots.has(k)) return this.lots.get(k);
      if (this.lots.size >= 1024) this.lots.clear();
      const x = cx * 96 + 48, z = cz * 96 + 48;
      const r = Math.hypot(x, z);
      let lot = null;
      if (this.config.profile !== 'earth' && r > 540 && r < 2600) {
        const seed = Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663) ^ this.world.meta.seed;
        const rand = MW.rng(seed);
        const sample = this.sample(x, z);
        if (!sample.water && !sample.road && rand() > 0.16) {
          const w = 22 + rand() * 20, d = 22 + rand() * 24;
          const h = 10 + Math.floor(rand() * (this.config.profile === 'tokyo' ? 13 : 8)) * 4;
          const clearFootprint = [[-1, -1], [1, -1], [-1, 1], [1, 1]].every(([sx, sz]) => {
            const edge = this.sample(x + sx * (w / 2 + 3), z + sz * (d / 2 + 3));
            return !edge.water && !edge.road;
          });
          if (clearFootprint) lot = { x, z, w, d, h, y: this.heightAt(x, z), color: MW.pick([0xb0b9b5, 0x9aa8ab, 0xc7bfae, 0x7a8a94, 0xb4bfbe], rand) };
        }
      }
      this.lots.set(k, lot);
      return lot;
    }

    structureAt(x, z) {
      const lot = this._lot(Math.floor(x / 96), Math.floor(z / 96));
      return lot && Math.abs(x - lot.x) <= lot.w / 2 && Math.abs(z - lot.z) <= lot.d / 2 ? lot : null;
    }

    surfaceAt(x, z) {
      const lot = this.structureAt(x, z);
      return lot ? lot.y + lot.h : this.heightAt(x, z);
    }

    collidesBox(x, y, z, radius, height, ignoreFloor) {
      if (!ignoreFloor) {
        const floor = Math.max(this.heightAt(x, z), this.heightAt(x - radius, z - radius),
          this.heightAt(x + radius, z - radius), this.heightAt(x - radius, z + radius), this.heightAt(x + radius, z + radius));
        if (y < floor - 0.025) return true;
      }
      for (let cx = Math.floor((x - radius) / 96); cx <= Math.floor((x + radius) / 96); cx++) {
        for (let cz = Math.floor((z - radius) / 96); cz <= Math.floor((z + radius) / 96); cz++) {
          const lot = this._lot(cx, cz);
          if (lot && x + radius > lot.x - lot.w / 2 && x - radius < lot.x + lot.w / 2 &&
            z + radius > lot.z - lot.d / 2 && z - radius < lot.z + lot.d / 2 &&
            y < lot.y + lot.h - 0.01 && y + height > lot.y) return true;
        }
      }
      return false;
    }

    raycast(origin, dir, maxDist) {
      const inside = t => {
        const x = origin.x + dir.x * t, y = origin.y + dir.y * t, z = origin.z + dir.z * t;
        const lot = this.structureAt(x, z);
        return y <= this.heightAt(x, z) || !!(lot && y >= lot.y && y <= lot.y + lot.h);
      };
      const step = Math.max(0.5, maxDist / 256);
      let previous = 0;
      for (let t = 0; t <= maxDist + step; t += step) {
        const current = Math.min(maxDist, t);
        if (inside(current)) {
          let lo = previous, hi = current;
          for (let i = 0; i < 8; i++) { const mid = (lo + hi) * 0.5; if (inside(mid)) hi = mid; else lo = mid; }
          const x = origin.x + dir.x * hi, z = origin.z + dir.z * hi, yy = origin.y + dir.y * hi;
          const lot = this.structureAt(x, z);
          let nx = 0, ny = 1, nz = 0;
          if (lot && yy < lot.y + lot.h - 0.06 && yy > lot.y + 0.06) {
            if (Math.abs(Math.abs(x - lot.x) - lot.w / 2) < Math.abs(Math.abs(z - lot.z) - lot.d / 2)) { nx = x > lot.x ? 1 : -1; ny = 0; }
            else { nz = z > lot.z ? 1 : -1; ny = 0; }
          }
          return { x: Math.floor(x - nx * 0.01), y: Math.floor(yy - ny * 0.01), z: Math.floor(z - nz * 0.01), nx, ny, nz, dist: hi, terrain: true, structure: !!lot };
        }
        if (current === maxDist) break;
        previous = current;
      }
      return null;
    }

    _schedule(x, z) {
      const cx = Math.floor(x / this.size), cz = Math.floor(z / this.size);
      if (this.center && this.center.x === cx && this.center.z === cz) return;
      this.center = { x: cx, z: cz };
      const wanted = new Map();
      const queue = [];
      for (let dx = -this.radius; dx <= this.radius; dx++) for (let dz = -this.radius; dz <= this.radius; dz++) {
        const distance = Math.max(Math.abs(dx), Math.abs(dz));
        const segments = distance <= this.nearRadius ? 32 : distance <= 4 ? 16 : 8;
        const k = key(cx + dx, cz + dz);
        wanted.set(k, segments);
        const current = this.chunks.get(k);
        if (!current || current.segments !== segments) queue.push({ cx: cx + dx, cz: cz + dz, segments, priority: dx * dx + dz * dz });
      }
      // Outside chunks are disposed before new allocations. There is no path
      // whose traversal length can grow the resident geometry without a bound.
      for (const [k, chunk] of this.chunks) if (!wanted.has(k)) this._disposeChunk(k, chunk);
      queue.sort((a, b) => a.priority - b.priority);
      this.wanted = wanted;
      this.pending = queue;
      this._stats();
    }

    prepareAt(x, z) {
      this._schedule(x, z);
      let n = 0;
      while (this.pending.length && n < 9) { const next = this.pending.shift(); this._build(next); n++; }
      this._stats();
    }

    update(_dt, position) {
      if (!position || this.disposed) return;
      this._schedule(position.x, position.z);
      const start = now();
      for (let n = 0; n < this.budget && this.pending.length; n++) {
        this._build(this.pending.shift());
        if (now() - start >= 5) break;
      }
      this._stats();
    }

    _build({ cx, cz, segments }) {
      if (this.disposed) return;
      const k = key(cx, cz);
      if (this.wanted.get(k) !== segments) return;
      const old = this.chunks.get(k);
      if (old) this._disposeChunk(k, old);
      if (this.chunks.size >= this.cacheLimit) return;
      const size = this.size, step = size / segments, x0 = cx * size, z0 = cz * size;
      const stride = segments + 3, samples = new Array(stride * stride);
      for (let z = -1; z <= segments + 1; z++) for (let x = -1; x <= segments + 1; x++)
        samples[(z + 1) * stride + x + 1] = this.sample(x0 + x * step, z0 + z * step);
      const positions = [], normals = [], colors = [], indices = [];
      const color = new THREE.Color();
      for (let z = 0; z <= segments; z++) for (let x = 0; x <= segments; x++) {
        const i = (z + 1) * stride + x + 1, s = samples[i];
        // Keep the continuous base just below editable paving at the same
        // elevation, preventing coplanar roads/squares from flickering.
        positions.push(x * step, s.height - 0.035, z * step);
        const dx = (samples[i + 1].height - samples[i - 1].height) / (2 * step);
        const dz = (samples[i + stride].height - samples[i - stride].height) / (2 * step);
        const inv = 1 / Math.hypot(dx, 1, dz);
        normals.push(-dx * inv, inv, -dz * inv);
        color.setHex(s.color);
        colors.push(color.r, color.g, color.b);
      }
      const row = segments + 1;
      for (let z = 0; z < segments; z++) for (let x = 0; x < segments; x++) {
        const a = z * row + x, b = a + 1, c = a + row, d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
      // Skirts cover the small interpolation gap where 8/16/32 m LOD edges
      // meet. Equal-resolution edges share exactly the same global samples.
      const edges = [[], [], [], []];
      for (let i = 0; i <= segments; i++) {
        edges[0].push(i); edges[1].push(i * row + segments);
        edges[2].push(segments * row + segments - i); edges[3].push((segments - i) * row);
      }
      for (const edge of edges) {
        const lows = [];
        for (const top of edge) {
          lows.push(positions.length / 3);
          positions.push(positions[top * 3], positions[top * 3 + 1] - 18, positions[top * 3 + 2]);
          normals.push(normals[top * 3], normals[top * 3 + 1], normals[top * 3 + 2]);
          colors.push(colors[top * 3] * 0.92, colors[top * 3 + 1] * 0.92, colors[top * 3 + 2] * 0.92);
        }
        for (let i = 0; i < segments; i++) indices.push(edge[i], lows[i], edge[i + 1], edge[i + 1], lows[i], lows[i + 1]);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geometry.setIndex(indices);
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, this.material);
      mesh.position.set(x0, 0, z0);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.group.add(mesh);
      const scenery = segments === 32 ? this._scenery(cx, cz) : null;
      if (scenery) this.group.add(scenery);
      const triangleCount = indices.length / 3 + (scenery ? scenery.geometry.attributes.position.count / 3 : 0);
      this.chunks.set(k, { mesh, scenery, segments, triangleCount });
      this.stats.built++;
      this.stats.triangles += triangleCount;
    }

    _scenery(cx, cz) {
      if (this.config.profile === 'earth') return null;
      const x0 = cx * this.size, z0 = cz * this.size, positions = [], colors = [];
      const color = new THREE.Color();
      const triangle = (a, b, c, hex) => {
        color.setHex(hex);
        for (const p of [a, b, c]) { positions.push(p[0] - x0, p[1], p[2] - z0); colors.push(color.r, color.g, color.b); }
      };
      const box = (x, y, z, w, h, d, hex) => {
        const a = x - w / 2, b = x + w / 2, c = z - d / 2, e = z + d / 2, t = y + h;
        const v = [[a, y, c], [b, y, c], [b, y, e], [a, y, e], [a, t, c], [b, t, c], [b, t, e], [a, t, e]];
        for (const f of [[0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0], [4, 7, 6, 5]]) {
          triangle(v[f[0]], v[f[1]], v[f[2]], hex); triangle(v[f[0]], v[f[2]], v[f[3]], hex);
        }
      };
      // Assign scenery by centre to exactly one chunk, including negative cells.
      for (let lx = Math.floor(x0 / 96); lx <= Math.floor((x0 + this.size) / 96); lx++) {
        for (let lz = Math.floor(z0 / 96); lz <= Math.floor((z0 + this.size) / 96); lz++) {
          const lot = this._lot(lx, lz);
          if (!lot || lot.x < x0 || lot.x >= x0 + this.size || lot.z < z0 || lot.z >= z0 + this.size) continue;
          box(lot.x, lot.y - 1.5, lot.z, lot.w, lot.h + 1.5, lot.d, lot.color);
          box(lot.x, lot.y + lot.h, lot.z, lot.w + 0.7, 0.5, lot.d + 0.7, 0x6c7e84);
          for (let y = lot.y + 3; y < lot.y + lot.h - 1; y += 4) {
            box(lot.x, y, lot.z, lot.w + 0.12, 1.8, lot.d + 0.12, 0x638999);
            for (let x = lot.x - lot.w / 2 + 4; x < lot.x + lot.w / 2; x += 5) {
              box(x, y, lot.z - lot.d / 2 - 0.07, 0.35, 1.8, 0.05, lot.color);
              box(x, y, lot.z + lot.d / 2 + 0.07, 0.35, 1.8, 0.05, lot.color);
            }
          }
        }
      }
      const rand = MW.rng(Math.imul(cx, 49157) ^ Math.imul(cz, 98317) ^ this.world.meta.seed);
      for (let i = 0; i < 22; i++) {
        const x = x0 + rand() * this.size, z = z0 + rand() * this.size;
        if (Math.hypot(x, z) < 460 || this.structureAt(x, z)) continue;
        const s = this.sample(x, z);
        if (s.water || s.road) continue;
        const y = this.heightAt(x, z), h = 6 + rand() * 5, r = 2.4 + rand() * 1.8;
        box(x, y, z, 0.6, h * 0.6, 0.6, 0x6f6250);
        for (let ring = 0; ring < 2; ring++) for (let side = 0; side < 7; side++) {
          const angle = side / 7 * Math.PI * 2, next = (side + 1) / 7 * Math.PI * 2;
          const rr = r * (ring ? 0.72 : 1), yy = y + h * (ring ? 0.53 : 0.32);
          triangle([x + Math.cos(angle) * rr, yy, z + Math.sin(angle) * rr],
            [x, yy + h * 0.55, z], [x + Math.cos(next) * rr, yy, z + Math.sin(next) * rr], ring ? 0x578364 : 0x467759);
        }
      }
      if (!positions.length) return null;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, this.sceneryMaterial);
      mesh.position.set(x0, 0, z0);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      return mesh;
    }

    _disposeChunk(k, chunk) {
      this.group.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
      if (chunk.scenery) { this.group.remove(chunk.scenery); chunk.scenery.geometry.dispose(); }
      this.chunks.delete(k);
      this.stats.triangles -= chunk.triangleCount;
      this.stats.evicted++;
    }

    _stats() { this.stats.resident = this.chunks.size; this.stats.pending = this.pending.length; }

    setQuality(quality) {
      const radius = quality === 'low' ? 4 : 6;
      if (radius === this.radius) return;
      this.radius = radius;
      this.center = null;
      this.nearRadius = quality === 'low' ? 1 : 2;
    }

    dispose() {
      this.disposed = true;
      for (const [k, chunk] of this.chunks) this._disposeChunk(k, chunk);
      this.pending.length = 0;
      this.wanted.clear(); this.heights.clear(); this.lots.clear();
      this.material.dispose(); this.sceneryMaterial.dispose();
      this.world.group.remove(this.group);
      this._stats();
    }
  }
  MW.StreamedTerrain = StreamedTerrain;
})();
