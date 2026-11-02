/* ===========================================================
   模型构建：武器视图模型 / 方块人物 / 载具 / 拾取物
   =========================================================== */
(function () {
  const MW = window.MW;

  const matCache = new Map();
  function mat(color) {
    if (!matCache.has(color)) {
      matCache.set(color, new THREE.MeshLambertMaterial({ color }));
    }
    return matCache.get(color);
  }
  const glowCache = new Map();
  function glowMat(color) {
    if (!glowCache.has(color)) {
      glowCache.set(color, new THREE.MeshBasicMaterial({ color }));
    }
    return glowCache.get(color);
  }

  function addBox(parent, w, h, d, color, x, y, z, glow) {
    const mesh = new THREE.Mesh(MW.BOX_GEO, glow ? glowMat(color) : mat(color));
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  function addCylinder(parent, radius, height, color, x, y, z, rotX, rotZ, seg) {
    const geo = new THREE.CylinderGeometry(radius, radius, height, seg || 10);
    const mesh = new THREE.Mesh(geo, mat(color));
    mesh.position.set(x, y, z);
    mesh.rotation.x = rotX || 0;
    mesh.rotation.z = rotZ || 0;
    parent.add(mesh);
    return mesh;
  }

  function partsGroup(parts) {
    const g = new THREE.Group();
    for (const p of parts || []) {
      if (p.shape === 'cyl') {
        const geo = new THREE.CylinderGeometry(p.r || 0.05, p.r || 0.05, p.h || 0.3, 8);
        const mesh = new THREE.Mesh(geo, p.glow ? glowMat(p.c) : mat(p.c));
        if (p.axis === 'z') mesh.rotation.x = Math.PI / 2;
        if (p.axis === 'x') mesh.rotation.z = Math.PI / 2;
        mesh.position.set(p.p[0], p.p[1], p.p[2]);
        g.add(mesh);
      } else {
        addBox(g, p.s[0], p.s[1], p.s[2], p.c, p.p[0], p.p[1], p.p[2], p.glow);
      }
    }
    return g;
  }

  /* ---------- 径向光晕贴图 ---------- */
  let radialTex = null;
  function getRadial() {
    if (radialTex) return radialTex;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 64, 64);
    radialTex = new THREE.CanvasTexture(c);
    return radialTex;
  }
  MW.getRadialTexture = getRadial;

  const spriteCache = new Map();
  function glowSprite(color, size) {
    const key = color + '_' + size;
    if (spriteCache.has(key)) {
      return new THREE.Sprite(spriteCache.get(key));
    }
    const m = new THREE.SpriteMaterial({
      map: getRadial(), color, transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, opacity: 0.55
    });
    spriteCache.set(key, m);
    const s = new THREE.Sprite(m);
    s.scale.set(size, size, 1);
    return s;
  }
  MW.Models = { mat, glowMat, addBox, glowSprite, partsGroup };

  /* ---------- 武器视图模型 ---------- */
  MW.Models.weaponView = function (weaponId) {
    const def = MW.WEAPONS[weaponId];
    const group = new THREE.Group();
    if (def) {
      const parts = partsGroup(def.view);
      group.add(parts);
      group.userData.muzzle = new THREE.Object3D();
      const mz = def.muzzle || [0, 0, -0.6];
      group.userData.muzzle.position.set(mz[0], mz[1], mz[2]);
      group.add(group.userData.muzzle);
    }
    group.traverse(o => { o.frustumCulled = false; });
    return group;
  };

  MW.Models.weaponMini = function (weaponId) {
    const def = MW.WEAPONS[weaponId];
    if (!def) return addBox(new THREE.Group(), .4, .1, .6, 0x888888, 0, 0, 0);
    const g = new THREE.Group();
    const parts = partsGroup(def.view);
    parts.scale.setScalar(0.55);
    g.add(parts);
    return g;
  };

  /* ---------- 人物 ---------- */
  MW.Models.character = function (spec, scale) {
    spec = Object.assign({}, MW.CHARACTERS.player, spec || {});
    scale = scale || spec.scale || 1;
    const g = new THREE.Group();
    const root = new THREE.Group();
    root.scale.setScalar(scale);
    g.add(root);

    const skin = spec.skin, shirt = spec.shirt, pants = spec.pants, hair = spec.hair;
    const accent = spec.accent || 0xffffff;

    // 影子
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.48, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.26, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    g.add(shadow);

    const legL = new THREE.Group();
    const legR = new THREE.Group();
    legL.position.set(-0.17, 0.78, 0);
    legR.position.set(0.17, 0.78, 0);
    addBox(legL, 0.24, 0.78, 0.26, pants, 0, -0.39, 0);
    addBox(legR, 0.24, 0.78, 0.26, pants, 0, -0.39, 0);
    addBox(legL, 0.26, 0.14, 0.32, 0x2a2622, 0, -0.76, -0.04);
    addBox(legR, 0.26, 0.14, 0.32, 0x2a2622, 0, -0.76, -0.04);
    root.add(legL, legR);

    const torso = new THREE.Group();
    torso.position.y = 0.82;
    root.add(torso);
    addBox(torso, 0.66, 0.78, 0.34, shirt, 0, 0.39, 0);
    if (spec.zombie) {
      addBox(torso, 0.2, 0.22, 0.02, MW.shade(shirt, -0.28), -0.14, 0.24, -0.175);
      addBox(torso, 0.12, 0.12, 0.02, MW.shade(shirt, -0.4), 0.18, 0.5, -0.175);
    } else {
      addBox(torso, 0.36, 0.1, 0.02, accent, 0, 0.62, -0.18);
      addBox(torso, 0.12, 0.3, 0.04, 0x2b2b2b, 0.22, 0.3, -0.18);
    }
    if (spec.backpack) {
      addBox(torso, 0.42, 0.5, 0.2, 0x5b4a33, 0, 0.4, 0.28);
    }

    const head = new THREE.Group();
    head.position.y = 1.62;
    root.add(head);
    addBox(head, 0.48, 0.46, 0.44, skin, 0, 0.18, 0);
    addBox(head, 0.5, 0.12, 0.46, hair, 0, 0.4, 0.01);
    if (spec.zombie) {
      addBox(head, 0.08, 0.06, 0.02, 0xe8e66a, -0.12, 0.2, -0.225, true);
      addBox(head, 0.08, 0.06, 0.02, 0xe8e66a, 0.12, 0.2, -0.225, true);
      addBox(head, 0.18, 0.04, 0.02, 0x3a2a26, 0, 0.06, -0.225);
    } else {
      addBox(head, 0.07, 0.07, 0.02, 0xffffff, -0.11, 0.2, -0.225);
      addBox(head, 0.07, 0.07, 0.02, 0xffffff, 0.11, 0.2, -0.225);
      addBox(head, 0.04, 0.04, 0.02, 0x1b1b1b, -0.11, 0.2, -0.235);
      addBox(head, 0.04, 0.04, 0.02, 0x1b1b1b, 0.11, 0.2, -0.235);
      addBox(head, 0.14, 0.03, 0.02, 0x7a4a3a, 0, 0.07, -0.225);
    }
    if (spec.helmet) {
      addBox(head, 0.56, 0.22, 0.52, spec.helmet, 0, 0.42, 0);
      addBox(head, 0.36, 0.1, 0.06, 0x2a2a2a, 0, 0.31, -0.24);
    }
    if (spec.hair === 0x2a211c && !spec.helmet) {
      addBox(head, 0.54, 0.18, 0.2, hair, 0, 0.22, 0.16);
    }

    const armL = new THREE.Group();
    const armR = new THREE.Group();
    armL.position.set(-0.41, 1.55, 0);
    armR.position.set(0.41, 1.55, 0);
    addBox(armL, 0.18, 0.7, 0.2, shirt, 0, -0.35, 0);
    addBox(armR, 0.18, 0.7, 0.2, shirt, 0, -0.35, 0);
    addBox(armL, 0.17, 0.14, 0.19, skin, 0, -0.72, 0);
    addBox(armR, 0.17, 0.14, 0.19, skin, 0, -0.72, 0);
    root.add(armL, armR);

    return {
      group: g, root, head, torso, armL, armR, legL, legR,
      height: 1.9 * scale, radius: 0.36 * scale
    };
  };

  /* ---------- 载具 ---------- */
  MW.Models.vehicle = function (type) {
    const g = new THREE.Group();
    const turret = new THREE.Group();
    const wheels = [];
    let barrel = null;

    if (type === 'tank') {
      addBox(g, 3.0, 0.5, 4.2, 0x3f4a35, 0, 0.55, 0);
      addBox(g, 3.2, 0.35, 4.0, 0x35402c, 0, 0.85, 0);
      for (const sx of [-1.55, 1.55]) {
        addBox(g, 0.7, 0.9, 4.4, 0x24261f, sx, 0.5, 0);
        for (let i = 0; i < 5; i++) addBox(g, 0.75, 0.3, 0.55, 0x555a4a, sx, 0.22, -1.7 + i * 0.85);
      }
      const t = new THREE.Group();
      addBox(t, 1.9, 0.7, 2.2, 0x4a5a3c, 0, 0.35, 0);
      addBox(t, 1.2, 0.35, 1.0, 0x5d6d4b, 0, 0.75, 0.2);
      addCylinder(t, 0.12, 2.6, 0x2b2f28, 0, 0.38, -2.0, Math.PI / 2, 0, 10);
      addBox(t, 0.26, 0.26, 0.5, 0x1e211b, 0, 0.38, -3.4);
      addBox(t, 0.06, 0.5, 0.06, 0xd6cfa0, 0.4, 0.95, 0.1);
      t.position.y = 1.0;
      turret.add(t);
      g.add(turret);
      barrel = t;
    } else if (type === 'apc') {
      addBox(g, 2.6, 0.8, 4.6, 0x6b6f58, 0, 0.7, 0);
      addBox(g, 2.3, 0.55, 2.6, 0x5d6350, 0, 1.35, 0.2);
      addBox(g, 1.9, 0.5, 1.2, 0x4f5544, 0, 1.1, -2.0);
      addBox(g, 1.1, 0.28, 0.8, 0x3f4437, 0.6, 1.72, 0.3);
      addBox(g, 0.12, 0.12, 1.4, 0x252824, 0.6, 1.72, -0.6);
      for (const sx of [-1.35, 1.35]) for (const sz of [-1.45, 0, 1.45]) {
        const w = addBox(g, 0.35, 0.75, 0.75, 0x20221d, sx, 0.4, sz);
        wheels.push(w);
      }
      addBox(g, 1.0, 0.1, 1.7, 0x8fd8ff, 0, 1.65, 0.25, true);
      g.add(turret);
    } else if (type === 'boat') {
      addBox(g, 2.6, 0.55, 5.6, 0xdfe4e6, 0, 0.45, 0);
      addBox(g, 2.2, 0.3, 4.6, 0x2b5f7a, 0, 0.18, 0);
      addBox(g, 2.0, 0.7, 1.8, 0xc9d2d6, 0, 1.05, 0.6);
      addBox(g, 1.6, 0.5, 1.0, 0x8fa8b3, 0, 1.55, 0.7);
      addBox(g, 1.2, 0.55, 1.0, 0xb8c3c7, 0, 1.1, 2.0);
      addBox(g, 0.18, 0.18, 1.8, 0x3a3f42, 0, 1.25, -2.2);
      addBox(g, 0.5, 0.45, 0.5, 0x51585c, 0, 1.15, -1.3);
      addBox(g, 0.1, 0.8, 0.1, 0xd8dde0, 1.0, 1.6, 1.9);
      addBox(g, 0.5, 0.3, 0.06, 0xd33b32, 1.0, 1.8, 1.9);
      g.add(turret);
    } else if (type === 'drone') {
      addBox(g, 1.5, 0.35, 1.5, 0x3a3f44, 0, 0, 0);
      addBox(g, 0.6, 0.2, 0.8, 0x5c646a, 0, 0.22, -0.2);
      addBox(g, 0.24, 0.16, 0.24, 0x64f0ff, 0, 0.05, -0.85, true);
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        addBox(g, 1.2, 0.1, 0.16, 0x2f3337, x * 0.75, 0, z * 0.75);
        const rotor = new THREE.Group();
        rotor.position.set(x * 1.35, 0.1, z * 1.35);
        addBox(rotor, 0.08, 0.14, 0.08, 0x24272a, 0, 0, 0);
        const blade = addBox(rotor, 1.0, 0.04, 0.12, 0x9aa3a8, 0, 0.1, 0);
        rotor.userData.blade = blade;
        g.add(rotor);
        wheels.push(rotor);
      }
      g.add(turret);
    } else if (type === 'car') {
      addBox(g, 1.9, 0.65, 3.8, 0x2f5f8a, 0, 0.7, 0);
      addBox(g, 1.7, 0.55, 2.0, 0x24475f, 0, 1.25, 0.1);
      addBox(g, 1.45, 0.35, 0.6, 0x1b2e3c, 0, 1.32, 1.3);
      addBox(g, 1.45, 0.35, 0.5, 0x1b2e3c, 0, 1.32, -1.1);
      addBox(g, 0.55, 0.16, 0.08, 0xffe1a0, 0.55, 0.72, -1.92, true);
      addBox(g, 0.55, 0.16, 0.08, 0xffe1a0, -0.55, 0.72, -1.92, true);
      addBox(g, 0.45, 0.16, 0.08, 0xd84b3e, 0.55, 0.72, 1.92);
      addBox(g, 0.45, 0.16, 0.08, 0xd84b3e, -0.55, 0.72, 1.92);
      for (const sx of [-0.9, 0.9]) for (const sz of [-1.2, 1.2]) {
        const w = addCylinder(g, 0.33, 0.36, 0x1c1e22, sx, 0.38, sz, 0, Math.PI / 2, 12);
        wheels.push(w);
      }
      // 前挡风与尾部收分
      addBox(g, 1.6, 0.22, 0.8, 0x2f5f8a, 0, 1.05, -1.35);
      addBox(g, 1.5, 0.18, 0.7, 0x2b5478, 0, 1.0, 1.45);
      g.add(turret);
    } else if (type === 'jet') {
      addBox(g, 1.35, 0.7, 5.0, 0x5f6c75, 0, 0.8, 0);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.66, 1.9, 12), mat(0x5f6c75));
      nose.rotation.x = -Math.PI / 2;
      nose.position.set(0, 0.8, -3.35);
      g.add(nose);
      addBox(g, 1.1, 0.5, 1.4, 0x47525a, 0, 1.25, -0.9);
      addBox(g, 0.8, 0.35, 0.9, 0x9fe8ff, 0, 1.5, -1.9, true);
      addBox(g, 5.8, 0.14, 1.6, 0x6b7a83, 0, 0.9, 0.15);
      addBox(g, 1.8, 0.12, 0.9, 0x6b7a83, 0, 1.15, 2.0);
      addBox(g, 0.24, 1.1, 0.9, 0x5f6c75, 0, 1.35, 2.1);
      addBox(g, 0.12, 0.5, 0.8, 0x3c474e, 0.9, 1.4, 2.1);
      addBox(g, 0.12, 0.5, 0.8, 0x3c474e, -0.9, 1.4, 2.1);
      for (const sx of [-0.55, 0.55]) {
        addCylinder(g, 0.3, 1.0, 0x3a4147, sx, 0.8, 2.65, Math.PI / 2, 0, 10);
        addBox(g, 0.35, 0.35, 0.18, 0xff8a3d, sx, 0.8, 3.18, true);
      }
      for (const sx of [-2.4, 2.4]) {
        addBox(g, 0.32, 0.28, 0.9, 0x3a4147, sx, 0.75, -0.1);
        addBox(g, 0.18, 0.18, 1.1, 0xd8a531, sx, 0.75, -0.95);
      }
      addBox(g, 0.55, 0.55, 0.2, 0x2c3338, 0, 0.82, 2.55, true);
      addBox(g, 0.4, 0.4, 0.2, 0xff8a3d, 0.55, 0.82, 2.55, true);
      addBox(g, 0.4, 0.4, 0.2, 0xff8a3d, -0.55, 0.82, 2.55, true);
      for (const [gx, gz] of [[0, -1.4], [-0.8, 1.2], [0.8, 1.2]]) {
        addBox(g, 0.09, 0.42, 0.09, 0x30373c, gx, 0.26, gz);
        addBox(g, 0.24, 0.16, 0.3, 0x1d2023, gx, 0.08, gz);
      }
      g.add(turret);
      barrel = turret;
    } else if (type === 'artillery') {
      addBox(g, 2.8, 0.55, 4.4, 0x4a4b42, 0, 0.55, 0);
      addBox(g, 2.4, 0.35, 3.2, 0x5b5d50, 0, 0.9, 0.2);
      for (const sx of [-1.35, 1.35]) for (const sz of [-1.35, 1.35]) {
        const w = addCylinder(g, 0.42, 0.4, 0x20221d, sx, 0.45, sz, 0, Math.PI / 2, 12);
        wheels.push(w);
      }
      addBox(g, 2.4, 1.1, 0.18, 0x4d5a44, 0, 1.35, 0.9);
      const t = new THREE.Group();
      addBox(t, 1.5, 0.5, 1.6, 0x4a5a3c, 0, 0.5, 0.1);
      addCylinder(t, 0.17, 4.2, 0x2b2f28, 0, 0.62, -1.7, Math.PI / 2, 0, 12);
      addBox(t, 0.42, 0.42, 0.55, 0x1e211b, 0, 0.62, -3.7);
      addBox(t, 0.8, 0.3, 0.3, 0x4d5a44, 0, 1.0, 0.6);
      addCylinder(t, 0.26, 0.6, 0x3c474e, 0.65, 0.5, 0.45, 0, 0, 10);
      t.position.y = 1.0;
      turret.add(t);
      g.add(turret);
      barrel = t;
    } else if (type === 'warship') {
      addBox(g, 5.0, 1.2, 14, 0x8b949a, 0, 1.1, 0);
      addBox(g, 4.2, 0.8, 12, 0x3a4147, 0, 0.35, 0);
      addBox(g, 3.4, 1.8, 4.2, 0xa8b0b5, 0, 2.5, 1.0);
      addBox(g, 2.6, 1.2, 2.2, 0x9aa3a8, 0, 3.9, 1.2);
      addBox(g, 0.5, 4.0, 0.5, 0xc9d2d6, 0, 6.0, 1.5);
      addBox(g, 1.0, 0.4, 1.8, 0x6b747a, 0, 2.1, -3.4);
      addBox(g, 0.16, 0.16, 3.2, 0x2b2f32, 0, 2.25, -5.6);
      addBox(g, 1.0, 0.4, 1.8, 0x6b747a, 0, 1.9, 4.6);
      addBox(g, 0.16, 0.16, 3.0, 0x2b2f32, 0, 2.05, 6.4);
      addBox(g, 2.2, 0.25, 3.0, 0x6b7378, 0, 1.8, 0);
      g.add(turret);
      barrel = turret;
    } else {
      addBox(g, 2, 1, 3, 0x888888, 0, 0.6, 0);
      g.add(turret);
    }

    return { group: g, turret, wheels, barrel, type };
  };

  /* ---------- 拾取物 ---------- */
  MW.Models.pickup = function (itemId, weaponId, kind) {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    g.add(inner);
    let color = 0xffc857;

    if (kind === 'weapon') {
      const def = MW.WEAPONS[weaponId];
      color = def ? 0xffb347 : 0xffc857;
      const mini = MW.Models.weaponMini(weaponId);
      mini.rotation.y = Math.PI / 2;
      mini.rotation.z = -0.2;
      inner.add(mini);
    } else {
      const item = MW.ITEMS[itemId] || {};
      color = MW.parseColor(item.color, 0xffc857);
      addBox(inner, 0.42, 0.42, 0.42, color, 0, 0, 0, true);
      addBox(inner, 0.5, 0.08, 0.5, MW.shade(color, -0.3), 0, -0.22, 0);
      addBox(inner, 0.08, 0.5, 0.5, MW.shade(color, -0.3), 0, 0, 0);
    }
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.035, 6, 24),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 })
    );
    ring.rotation.x = Math.PI / 2;
    inner.add(ring);
    const halo = glowSprite(color, 1.3);
    halo.position.y = 0.05;
    inner.add(halo);
    g.userData.inner = inner;
    g.userData.ring = ring;
    g.userData.color = color;
    return g;
  };

  /* ---------- 旗帜 ---------- */
  MW.Models.flag = function (color) {
    const g = new THREE.Group();
    addBox(g, 0.12, 4.2, 0.12, 0x8d8d8d, 0, 2.1, 0);
    const cloth = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 1.0, 8, 4),
      new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide })
    );
    cloth.position.set(0.85, 3.6, 0);
    g.add(cloth);
    g.userData.cloth = cloth;
    const halo = glowSprite(color, 2.4);
    halo.position.y = 4.2;
    g.add(halo);
    return g;
  };

  /* ---------- 地标文字牌 ---------- */
  MW.Models.label = function (text, color, width) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    const ctx = c.getContext('2d');
    const accent = MW.hexToCss(color || 0xffb347);
    ctx.clearRect(0, 0, 512, 128);
    ctx.fillStyle = 'rgba(8, 12, 18, 0.72)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 4;
    const r = 18;
    ctx.beginPath();
    ctx.moveTo(r + 6, 16); ctx.lineTo(512 - r - 6, 16);
    ctx.quadraticCurveTo(512 - 6, 16, 512 - 6, 16 + r);
    ctx.lineTo(512 - 6, 112 - r);
    ctx.quadraticCurveTo(512 - 6, 112, 512 - r - 6, 112);
    ctx.lineTo(r + 6, 112);
    ctx.quadraticCurveTo(6, 112, 6, 112 - r);
    ctx.lineTo(6, 16 + r);
    ctx.quadraticCurveTo(6, 16, r + 6, 16);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = accent;
    ctx.fillRect(6, 16, 5, 96);
    ctx.font = 'bold 48px "Microsoft YaHei", "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,.8)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#f2f5f8';
    ctx.fillText(text, 256, 66, 440);
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.renderOrder = 5;
    const w = width || 10;
    sprite.scale.set(w, w * 0.25, 1);
    sprite.userData.baseScale = new THREE.Vector3(w, w * 0.25, 1);
    sprite.userData.isMapLabel = true;
    return sprite;
  };

  /* ---------- 爆炸光球 ---------- */
  MW.Models.explosion = function (color, radius) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(1, 12, 10),
      new THREE.MeshBasicMaterial({ color: color || 0xffb347, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    g.add(core);
    const halo = glowSprite(color || 0xffb347, radius * 2.6);
    g.add(halo);
    g.userData.core = core;
    g.userData.halo = halo;
    g.userData.radius = radius;
    return g;
  };
})();
