/* Precision circulation: metre-scale voxels remain editable; 20 cm stair treads,
 * open landings and lift safety barriers use the same boxes for drawing/physics. */
(function () {
  'use strict';
  const MW = window.MW;
  const overlap = (b, x, y, z, r, h) =>
    x + r > b.x0 + 0.001 &&
    x - r < b.x1 - 0.001 &&
    z + r > b.z0 + 0.001 &&
    z - r < b.z1 - 0.001 &&
    y < b.y1 - 0.001 &&
    y + h > b.y0 + 0.001;
  const box = (x, y, z, w, h, d, c, solid = true) => ({
    x0: x - w / 2,
    x1: x + w / 2,
    y0: y,
    y1: y + h,
    z0: z - d / 2,
    z1: z + d / 2,
    c,
    solid,
  });
  function merged(boxes, origin = { x: 0, y: 0, z: 0 }) {
    const positions = [];
    const colors = [];
    const color = new THREE.Color();
    for (const bounds of boxes) {
      const minX = bounds.x0 - origin.x;
      const maxX = bounds.x1 - origin.x;
      const minZ = bounds.z0 - origin.z;
      const maxZ = bounds.z1 - origin.z;
      const bottomY = bounds.y0 - origin.y;
      const topY = bounds.y1 - origin.y;
      const vertices = [
        [minX, bottomY, minZ],
        [maxX, bottomY, minZ],
        [maxX, bottomY, maxZ],
        [minX, bottomY, maxZ],
        [minX, topY, minZ],
        [maxX, topY, minZ],
        [maxX, topY, maxZ],
        [minX, topY, maxZ],
      ];
      color.setHex(bounds.c);
      const faces = [
        [0, 4, 5, 1],
        [1, 5, 6, 2],
        [2, 6, 7, 3],
        [3, 7, 4, 0],
        [4, 7, 6, 5],
        [0, 1, 2, 3],
      ];
      for (const face of faces) {
        for (const vertexIndex of [0, 1, 2, 0, 2, 3]) {
          positions.push(...vertices[face[vertexIndex]]);
          colors.push(color.r, color.g, color.b);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.position.set(origin.x, origin.y, origin.z);
    return mesh;
  }
  function stairBoxes(spec) {
    if (
      !spec ||
      ![spec.x, spec.y, spec.z, spec.levels].every(Number.isFinite) ||
      Math.abs(spec.x) > 21000000 ||
      Math.abs(spec.z) > 21000000 ||
      Math.abs(spec.y) > 4096 ||
      !Number.isInteger(spec.levels) ||
      spec.levels < 1 ||
      spec.levels > 32
    )
      return [];
    const boxes = [],
      stone = 0xbec5bd,
      rail = 0x405965,
      light = 0x90ded2;
    const add = (x, y, z, w, h, d, c, solid = true) =>
      boxes.push(box(spec.x + x, spec.y + y, spec.z + z, w, h, d, c, solid));
    // Two 2.4 m wide flights, 10 treads each, 20 cm riser / 40 cm going.
    // All full-floor bridges are at the near end; half-landings at the far end.
    for (let f = 0; f <= spec.levels; f++) {
      const y = f * 4;
      add(1.45, y - 0.18, -1, 8.3, 0.18, 2, stone);
      add(f === 0 ? 1.45 : 3, y + 0.95, -1.95, f === 0 ? 2.7 : 5.6, 0.08, 0.08, rail);
      add(5.68, y, -1, 0.08, 1.05, 2, rail);
      for (const x of [0.15, 2.85, 5.65]) add(x, y, -1.93, 0.08, 1.05, 0.08, rail);
      if (f === spec.levels) continue;
      for (let i = 0; i < 10; i++) {
        const ya = y + (i + 1) * 0.2,
          yb = y + 2 + (i + 1) * 0.2;
        add(1.3, ya - 0.18, i * 0.4 + 0.2, 2.4, 0.18, 0.4, stone);
        add(4.3, yb - 0.18, 3.8 - i * 0.4, 2.4, 0.18, 0.4, stone);
        for (const [x, yy, zz] of [
          [0.08, ya, i * 0.4 + 0.2],
          [2.52, ya, i * 0.4 + 0.2],
          [3.08, yb, 3.8 - i * 0.4],
          [5.52, yb, 3.8 - i * 0.4],
        ]) {
          add(x, yy + 0.96, zz, 0.07, 0.07, 0.41, rail);
          if (i % 3 === 0) add(x, yy, zz, 0.07, 1, 0.07, rail);
        }
        add(1.3, ya + 0.003, i * 0.4 + 0.035, 2.2, 0.014, 0.045, light, false);
        add(4.3, yb + 0.003, 3.965 - i * 0.4, 2.2, 0.014, 0.045, light, false);
      }
      add(2.8, y + 1.82, 5, 5.6, 0.18, 2, stone);
      add(2.8, y + 2, 5.95, 5.6, 1.05, 0.08, rail);
      add(0.08, y + 2, 5, 0.08, 1.05, 2, rail);
      add(5.52, y + 2, 5, 0.08, 1.05, 2, rail);
    }
    // Five shallow approach steps connect ground to the first floor deck.
    for (let i = 0; i < 5; i++) add(4.3, -1 + i * 0.2, -4.7 + i * 0.4, 2.4, 0.2, 0.4, stone);
    add(4.3, -0.18, -2.7, 2.4, 0.18, 1.4, stone);
    return boxes;
  }
  class PrecisionArchitecture {
    constructor(world, specs) {
      this.world = world;
      this.meshes = [];
      this.cells = new Map();
      this.disposed = false;
      let remainingBoxBudget = 32768;
      for (const spec of (Array.isArray(specs) ? specs : []).slice(0, 64)) {
        const boxes = stairBoxes(spec);
        if (!boxes.length) continue;
        if (boxes.length > remainingBoxBudget) break;
        remainingBoxBudget -= boxes.length;
        const mesh = merged(boxes, { x: spec.x, y: spec.y, z: spec.z });
        mesh.name = 'switchback-stairs';
        world.group.add(mesh);
        this.meshes.push(mesh);
        for (const b of boxes)
          if (b.solid)
            for (let x = Math.floor(b.x0 / 8); x <= Math.floor(b.x1 / 8); x++)
              for (let z = Math.floor(b.z0 / 8); z <= Math.floor(b.z1 / 8); z++) {
                const k = x + ',' + z;
                if (!this.cells.has(k)) this.cells.set(k, []);
                this.cells.get(k).push(b);
              }
      }
    }
    nearby(x, z, r) {
      const result = new Set();
      for (let a = Math.floor((x - r) / 8); a <= Math.floor((x + r) / 8); a++)
        for (let b = Math.floor((z - r) / 8); b <= Math.floor((z + r) / 8); b++)
          for (const v of this.cells.get(a + ',' + b) || []) result.add(v);
      return result;
    }
    collidesBox(x, y, z, r, h) {
      for (const b of this.nearby(x, z, r)) if (overlap(b, x, y, z, r, h)) return true;
      return false;
    }
    supportAt(x, z, maxY, r = 0.25) {
      let top = -Infinity;
      for (const b of this.nearby(x, z, r))
        if (b.y1 <= maxY + 0.002 && x + r > b.x0 && x - r < b.x1 && z + r > b.z0 && z - r < b.z1)
          top = Math.max(top, b.y1);
      return top;
    }
    dispose() {
      if (this.disposed) return;
      this.disposed = true;
      for (const m of this.meshes) {
        this.world.group.remove(m);
        m.geometry.dispose();
        m.material.dispose();
      }
      this.meshes = [];
      this.cells.clear();
    }
  }

  class CabinLift {
    constructor(game, spec) {
      if (
        !spec ||
        ![spec.x, spec.y, spec.z, spec.floors].every(Number.isFinite) ||
        Math.abs(spec.x) > 21000000 ||
        Math.abs(spec.z) > 21000000 ||
        Math.abs(spec.y) > 4096 ||
        !Number.isInteger(spec.floors) ||
        spec.floors < 2 ||
        spec.floors > 33
      )
        throw new Error('Invalid lift specification');
      this.game = game;
      this.spec = spec;
      this.floors = spec.floors;
      this.baseY = spec.y + 1;
      this.floor = 0;
      this.targetFloor = 0;
      this.state = 'open';
      this.doorOpen = true;
      this.doorAnim = 1;
      this.moving = false;
      this.disposed = false;
      this.passenger = null;
      this.pending = null;
      this.elapsed = 0;
      this.speed = 4;
      this.pos = new THREE.Vector3(spec.x, this.baseY, spec.z);
      this.mesh = new THREE.Group();
      this.mesh.name = 'panoramic-lift';
      game.scene.add(this.mesh);
      const shaft = [];
      for (const x of [-1.85, 1.85])
        for (const z of [-1.85, 1.85])
          shaft.push(
            box(
              spec.x + x,
              this.baseY - 0.3,
              spec.z + z,
              0.12,
              (this.floors - 1) * 4 + 3.5,
              0.12,
              0x42616d,
            ),
          );
      for (let f = 0; f < this.floors; f++) {
        shaft.push(box(spec.x, this.baseY + f * 4 + 2.8, spec.z + 1.85, 3.8, 0.16, 0.18, 0x548a91));
        shaft.push(
          box(spec.x + 2.08, this.baseY + f * 4 + 0.9, spec.z + 2.15, 0.22, 0.5, 0.18, 0xf0c377),
        );
      }
      this.shaft = merged(shaft, { x: spec.x, y: this.baseY, z: spec.z });
      this.mesh.add(this.shaft);
      this.glazing = merged(
        [
          box(spec.x, this.baseY, spec.z - 1.85, 3.7, (this.floors - 1) * 4 + 3, 0.06, 0x95cbd3),
          box(spec.x - 1.85, this.baseY, spec.z, 0.06, (this.floors - 1) * 4 + 3, 3.7, 0x95cbd3),
          box(spec.x + 1.85, this.baseY, spec.z, 0.06, (this.floors - 1) * 4 + 3, 3.7, 0x95cbd3),
        ],
        { x: spec.x, y: this.baseY, z: spec.z },
      );
      this.glazing.material.transparent = true;
      this.glazing.material.opacity = 0.2;
      this.glazing.material.depthWrite = false;
      this.mesh.add(this.glazing);
      this.gates = new THREE.InstancedMesh(
        new THREE.BoxGeometry(3.6, 0.9, 0.09),
        new THREE.MeshLambertMaterial({ color: 0x759ba2 }),
        this.floors,
      );
      this.gates.position.set(spec.x, this.baseY, spec.z);
      this.mesh.add(this.gates);
      const cabin = [
        box(0, -0.18, 0, 3.5, 0.18, 3.5, 0x485c66),
        box(0, 2.72, 0, 3.5, 0.12, 3.5, 0x516a76),
        box(0, 0.03, -1.68, 3.3, 0.7, 0.1, 0x5b8c9a),
        box(-1.68, 0.03, 0, 0.1, 0.7, 3.3, 0x5b8c9a),
        box(1.68, 0.03, 0, 0.1, 0.7, 3.3, 0x5b8c9a),
        box(0, 2.59, 0, 2.8, 0.05, 0.3, 0xf3e6bc),
      ];
      this.cabin = merged(cabin);
      this.mesh.add(this.cabin);
      this.leftDoor = merged([box(0, 0, 0, 1.65, 2.65, 0.1, 0x9abfc5)]);
      this.rightDoor = merged([box(0, 0, 0, 1.65, 2.65, 0.1, 0x9abfc5)]);
      this.mesh.add(this.leftDoor, this.rightDoor);
      this.syncMeshes();
    }
    floorY(f) {
      return this.baseY + f * 4;
    }
    floorLabel(f) {
      return this.spec.version === 2 && f === this.floors - 1 ? '屋顶观景台' : f + 1 + 'F';
    }
    validFloor(f) {
      return Number.isInteger(f) && f >= 0 && f < this.floors;
    }
    landing(f) {
      return {
        x: this.spec.spawnX ?? this.spec.x,
        y: this.floorY(f),
        z: this.spec.spawnZ ?? this.spec.z + 3.3,
      };
    }
    floorNear(player) {
      if (!player) return -1;
      const f = Math.round((player.pos.y - this.baseY) / 4);
      if (!this.validFloor(f) || Math.abs(player.pos.y - this.floorY(f)) > 1.2) return -1;
      const q = this.landing(f);
      return Math.hypot(player.pos.x - q.x, player.pos.z - q.z) < 3.8 ? f : -1;
    }
    interaction(player) {
      if (this.disposed) return null;
      if (player?.elevatorRide === this)
        return { distance: 0, floor: this.floor, label: '电梯 · 选择楼层 / 安全离开' };
      const f = this.floorNear(player);
      return f < 0
        ? null
        : {
            distance: Math.hypot(
              player.pos.x - this.landing(f).x,
              player.pos.z - this.landing(f).z,
            ),
            floor: f,
            label: `${this.spec.name || '观景电梯'} · ${this.floorLabel(f)} · ${this.moving ? '运行中' : '呼叫 / 选层'}`,
          };
    }
    syncMeshes() {
      const { x, y, z } = this.pos;
      this.cabin.position.set(x, y, z);
      this.leftDoor.position.set(x - 0.83 - this.doorAnim * 1.6, y, z + 1.7);
      this.rightDoor.position.set(x + 0.83 + this.doorAnim * 1.6, y, z + 1.7);
      const m = new THREE.Matrix4();
      for (let f = 0; f < this.floors; f++) {
        const open = f === this.floor && this.state === 'open';
        m.makeScale(1, open ? 0.001 : 1, 1);
        m.setPosition(0, f * 4 + 0.8, 1.8);
        this.gates.setMatrixAt(f, m);
      }
      this.gates.instanceMatrix.needsUpdate = true;
    }
    start(f) {
      if (!this.validFloor(f) || this.disposed || this.state !== 'open') return false;
      if (f === this.floor) return true;
      this.targetFloor = f;
      this.fromY = this.pos.y;
      this.toY = this.floorY(f);
      this.duration = Math.max(1, (1.5 * Math.abs(this.toY - this.fromY)) / this.speed);
      this.elapsed = 0;
      this.state = 'closing';
      this.doorOpen = false;
      this.moving = true;
      return true;
    }
    callTo(f) {
      if (this.passenger || this.pending) return false;
      return this.start(f);
    }
    requestRide(f, player) {
      if (
        !this.validFloor(f) ||
        this.disposed ||
        !player ||
        this.game.inVehicle ||
        (player.elevatorRide && player.elevatorRide !== this)
      )
        return false;
      if (this.passenger === player && player.elevatorRide === this) {
        if (this.state !== 'open') return false;
        return f === this.floor ? this.exit() : this.start(f);
      }
      const origin = this.floorNear(player);
      if (origin < 0 || this.passenger || this.state !== 'open' || this.pending) return false;
      if (origin !== this.floor) {
        this.pending = { player: player, origin, destination: f };
        if (!this.start(origin)) {
          this.pending = null;
          return false;
        }
        return true;
      }
      if (f === origin) return true;
      this.passenger = player;
      player.elevatorRide = this;
      player.vel.set(0, 0, 0);
      player.pos.copy(this.pos);
      player.pos.z += 0.25;
      return this.start(f);
    }
    exit() {
      const player = this.passenger;
      if (!player || player.elevatorRide !== this || this.state !== 'open') return false;
      for (const dz of [0, 0.8, 1.5]) {
        const q = this.landing(this.floor);
        q.z += dz;
        if (
          this.game.world.collidesBox(q.x, q.y + 0.025, q.z, player.radius, player.height) ||
          this.game.doors?.some((d) =>
            d.blocksAt(q.x, q.y + 0.025, q.z, player.radius, player.height),
          )
        )
          continue;
        player.pos.set(q.x, q.y + 0.025, q.z);
        player.vel.set(0, 0, 0);
        player.elevatorRide = null;
        this.passenger = null;
        return true;
      }
      this.game.ui?.toast('出口被挡住，请选择其他楼层。', 'info');
      return false;
    }
    update(dt) {
      if (this.disposed || !Number.isFinite(dt) || dt < 0) return;
      const player = this.passenger;
      if (player && player.elevatorRide !== this) this.passenger = null;
      this.elapsed += dt;
      if (this.state === 'closing') {
        this.doorAnim = Math.max(0, 1 - this.elapsed / 0.55);
        if (this.elapsed >= 0.55) {
          this.state = 'moving';
          this.elapsed = 0;
        }
      } else if (this.state === 'moving') {
        const t = Math.min(1, this.elapsed / this.duration);
        this.pos.y = this.fromY + (this.toY - this.fromY) * t * t * (3 - 2 * t);
        if (t >= 1) {
          this.floor = this.targetFloor;
          this.state = 'opening';
          this.elapsed = 0;
        }
      } else if (this.state === 'opening') {
        this.doorAnim = Math.min(1, this.elapsed / 0.55);
        if (this.elapsed >= 0.55) {
          this.state = 'open';
          this.doorOpen = true;
          this.moving = false;
          this.elapsed = 0;
          if (this.passenger) this.exit();
          if (this.pending) {
            const request = this.pending;
            this.pending = null;
            if (this.floorNear(request.player) === request.origin)
              this.requestRide(request.destination, request.player);
          }
        }
      }
      if (this.passenger?.elevatorRide === this) {
        this.passenger.pos.copy(this.pos);
        this.passenger.pos.z += 0.25;
        this.passenger.vel.set(0, 0, 0);
      }
      this.syncMeshes();
    }
    collidesBox(x, y, z, r, h) {
      if (
        this.disposed ||
        Math.abs(x - this.spec.x) > 2.3 + r ||
        Math.abs(z - this.spec.z) > 2.3 + r
      )
        return false;
      for (const b of [
        box(
          this.spec.x,
          this.baseY - 0.2,
          this.spec.z - 1.85,
          3.8,
          (this.floors - 1) * 4 + 3.2,
          0.12,
          0,
        ),
        box(
          this.spec.x - 1.85,
          this.baseY - 0.2,
          this.spec.z,
          0.12,
          (this.floors - 1) * 4 + 3.2,
          3.8,
          0,
        ),
        box(
          this.spec.x + 1.85,
          this.baseY - 0.2,
          this.spec.z,
          0.12,
          (this.floors - 1) * 4 + 3.2,
          3.8,
          0,
        ),
        box(this.pos.x, this.pos.y - 0.18, this.pos.z, 3.5, 0.18, 3.5, 0),
      ])
        if (overlap(b, x, y, z, r, h)) return true;
      const f = Math.round((y - this.baseY) / 4);
      if (this.validFloor(f) && !(f === this.floor && this.state === 'open'))
        return overlap(
          box(this.spec.x, this.floorY(f), this.spec.z + 1.8, 3.7, 2.8, 0.14, 0),
          x,
          y,
          z,
          r,
          h,
        );
      return false;
    }
    release(player) {
      if (this.pending?.player === player) this.pending = null;
      if (this.passenger === player) {
        this.passenger = null;
        if (player.elevatorRide === this) player.elevatorRide = null;
      }
    }
    openDoors() {
      return this.state === 'open';
    }
    closeDoors() {
      return false;
    }
    travelTo(f) {
      return this.requestRide(f, this.game.player);
    }
    dispose() {
      if (this.disposed) return;
      this.disposed = true;
      if (this.passenger?.elevatorRide === this) {
        const player = this.passenger;
        player.elevatorRide = null;
        player.vel.set(0, 0, 0);
        if (player.spawnPoint) player.pos.copy(player.spawnPoint);
      }
      this.passenger = null;
      this.pending = null;
      for (const m of [
        this.shaft,
        this.glazing,
        this.gates,
        this.cabin,
        this.leftDoor,
        this.rightDoor,
      ]) {
        m.geometry.dispose();
        m.material.dispose();
      }
      this.game.scene.remove(this.mesh);
    }
  }
  MW.Circulation = { stairBoxes, merged, box };
  MW.PrecisionArchitecture = PrecisionArchitecture;
  MW.CabinLift = CabinLift;
})();
