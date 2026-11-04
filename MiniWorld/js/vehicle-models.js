/* Sculpted procedural vehicles. Static parts are batched by material; moving parts
   retain their pivots. All assets are local, with a cheap distance LOD. */
(function () {
  'use strict';
  const M = window.MW.Models, T = THREE;
  const legacy = M.vehicle;
  const materials = new Map();
  const boxGeometry = new T.BoxGeometry(1, 1, 1);
  const cylinderGeometry = new T.CylinderGeometry(1, 1, 1, 12);
  const sphereGeometry = new T.SphereGeometry(1, 12, 8);
  const palette = { hull: 0x647c86, dark: 0x18252e, glass: 0x3f8fa7, steel: 0xa1b2b7, amber: 0xffc47d, blue: 0x5ce4ff, green: 0x52664b };
  function material(color, glow) {
    const key = `${color}:${!!glow}`;
    if (!materials.has(key)) materials.set(key, glow
      ? new T.MeshBasicMaterial({ color })
      : new T.MeshPhongMaterial({ color, shininess: color === palette.glass ? 95 : 32, specular: 0x354852 }));
    return materials.get(key);
  }
  function mesh(parent, geo, color, x, y, z, glow) {
    const m = new T.Mesh(geo, material(color, glow));
    m.position.set(x || 0, y || 0, z || 0); parent.add(m); return m;
  }
  function box(p, sx, sy, sz, c, x, y, z, glow) {
    const m = mesh(p, boxGeometry, c, x, y, z, glow); m.scale.set(sx, sy, sz); return m;
  }
  function cyl(p, r, length, c, x, y, z, axis) {
    const m = mesh(p, cylinderGeometry, c, x, y, z); m.scale.set(r, length, r);
    if (axis === 'x') m.rotation.z = Math.PI / 2;
    if (axis === 'z') m.rotation.x = Math.PI / 2;
    return m;
  }
  function ellipsoid(p, sx, sy, sz, c, x, y, z) {
    const m = mesh(p, sphereGeometry, c, x, y, z); m.scale.set(sx, sy, sz); return m;
  }
  function prism(p, points, height, c, y) {
    const shape = new T.Shape();
    points.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)); shape.closePath();
    const geo = new T.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, steps: 1 });
    geo.rotateX(-Math.PI / 2); geo.userData.mwOwned = true;
    return mesh(p, geo, c, 0, y, 0);
  }
  function tire(p, x, y, z, r, wheels) {
    const w = new T.Group(); w.position.set(x, y, z); p.add(w);
    cyl(w, r, 0.32, palette.dark, 0, 0, 0, 'x');
    cyl(w, r * 0.54, 0.34, palette.steel, 0, 0, 0, 'x');
    for (let i = 0; i < 3; i++) {
      const spoke = box(w, 0.36, 0.07, r * 0.85, palette.dark, 0, 0, 0); spoke.rotation.x = i * Math.PI / 3;
    }
    wheels.push(w); return w;
  }
  function batch(group) {
    for (const child of [...group.children]) if (child.isGroup) batch(child);
    const buckets = new Map();
    for (const obj of group.children) {
      if (!obj.isMesh || obj.userData.animated || Array.isArray(obj.material)) continue;
      if (!buckets.has(obj.material)) buckets.set(obj.material, []);
      buckets.get(obj.material).push(obj);
    }
    for (const [mat, parts] of buckets) {
      if (parts.length < 2) continue;
      const positions = [], normals = [];
      for (const part of parts) {
        part.updateMatrix();
        const geo = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
        geo.applyMatrix4(part.matrix);
        positions.push(...geo.attributes.position.array); normals.push(...geo.attributes.normal.array);
        geo.dispose();
        if (part.geometry.userData.mwOwned) part.geometry.dispose();
        group.remove(part);
      }
      const merged = new T.BufferGeometry();
      merged.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      merged.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
      merged.computeBoundingSphere(); merged.userData.mwOwned = true;
      group.add(new T.Mesh(merged, mat));
    }
  }
  function radar(p, x, y, z) {
    cyl(p, 0.06, 1.8, palette.steel, x, y - 0.8, z);
    const r = new T.Group(); r.position.set(x, y, z); p.add(r);
    box(r, 1.7, 0.45, 0.12, palette.dark, 0, 0, 0);
    box(r, 1.5, 0.04, 0.14, palette.blue, 0, 0.12, 0, true);
    return r;
  }
  M.vehicle = function (type) {
    if (!['car', 'tank', 'apc', 'jet', 'boat', 'warship', 'drone', 'train', 'carrier', 'mech', 'aa'].includes(type)) return legacy(type);
    const body = new T.Group(), turret = new T.Group(), wheels = [], rotors = [], legs = [];
    let barrel = null, dish = null, exhaust = null;
    let dimensions = [2.1, 1.7, 4.4], color = palette.hull;
    if (type === 'car' || type === 'apc') {
      const armored = type === 'apc'; color = armored ? 0x647352 : 0x2d7088;
      const half = armored ? 1.25 : 0.95, len = armored ? 2.35 : 2.05;
      prism(body, [[-half, len], [half, len], [half, -len + 0.25], [half - 0.3, -len], [-half + 0.3, -len], [-half, -len + 0.25]], 0.55, color, 0.55);
      box(body, half * 2 - 0.14, 0.24, len * 2 - 0.1, palette.dark, 0, 0.45, 0);
      box(body, half * 1.75, 0.65, 2.0, color, 0, 1.22, 0.25);
      const wind = box(body, half * 1.62, 0.5, 0.045, palette.glass, 0, 1.29, -0.78); wind.rotation.x = -0.25;
      box(body, half * 1.6, 0.4, 0.045, palette.glass, 0, 1.3, 1.28);
      for (const s of [-1, 1]) {
        box(body, 0.035, 0.4, 1.6, palette.glass, s * half * 0.89, 1.3, 0.25);
        box(body, 0.04, 0.48, 0.08, palette.dark, s * half * 0.91, 1.3, 0.23);
        box(body, 0.34, 0.15, 0.08, palette.amber, s * half * 0.68, 0.85, -len, true);
        box(body, 0.32, 0.13, 0.08, 0xff594d, s * half * 0.68, 0.78, len, true);
        box(body, 0.23, 0.17, 0.22, palette.dark, s * (half + 0.08), 1.23, -0.56);
        for (const z of armored ? [-1.55, 0, 1.55] : [-1.3, 1.35]) tire(body, s * half, 0.43, z, 0.43, wheels);
      }
      box(body, 0.95, 0.18, 0.06, palette.dark, 0, 0.7, -len - 0.01);
      for (const x of [-0.7, 0.7]) box(body, 0.07, 0.08, 2.1, palette.steel, x, 1.63, 0.2);
      if (armored) {
        turret.position.y = 1.72; body.add(turret);
        box(turret, 0.8, 0.36, 0.9, palette.green, 0, 0.1, 0);
        cyl(turret, 0.055, 1.8, palette.dark, 0, 0.2, -1, 'z');
      }
    } else if (type === 'tank' || type === 'aa') {
      color = palette.green; dimensions = [3.5, 2.7, 5];
      prism(body, [[-1.45, 2], [1.45, 2], [1.45, -1.5], [1, -2.25], [-1, -2.25], [-1.45, -1.5]], 0.65, color, 0.6);
      for (const s of [-1, 1]) {
        box(body, 0.62, 0.92, 4.4, palette.dark, s * 1.48, 0.54, 0);
        for (let i = 0; i < 6; i++) tire(body, s * 1.56, 0.52, -1.7 + i * 0.68, 0.33, wheels);
        box(body, 0.12, 0.55, 4.2, color, s * 1.81, 0.96, 0);
        for (let i = 0; i < 5; i++) box(body, 0.16, 0.28, 0.58, 0x7e8a6a, s * 1.83, 1.03, -1.6 + i * 0.76);
        box(body, 0.2, 0.12, 0.08, palette.amber, s * 1.05, 1.05, -2.15, true);
      }
      turret.position.y = 1.18; body.add(turret);
      cyl(turret, 1.08, 0.16, palette.dark, 0, 0.05, 0);
      prism(turret, [[-1, 0.9], [1, 0.9], [1.1, -0.4], [0.65, -1.2], [-0.65, -1.2], [-1.1, -0.4]], 0.65, 0x718263, 0.12);
      barrel = new T.Group(); barrel.position.set(0, 0.52, -0.8); turret.add(barrel);
      if (type === 'aa') {
        for (const s of [-1, 1]) {
          box(barrel, 0.75, 0.7, 1.8, palette.dark, s * 1.05, 0.1, 0.2);
          for (const x of [-0.18, 0.18]) cyl(barrel, 0.13, 1.9, palette.steel, s * 1.05 + x, 0.15, 0.15, 'z');
        }
        dish = radar(turret, 0, 2.1, 0.55);
      } else {
        cyl(barrel, 0.13, 3.1, palette.dark, 0, 0, -1.4, 'z');
        cyl(barrel, 0.18, 0.55, 0x89937a, 0, 0, -1.2, 'z');
        box(barrel, 0.28, 0.23, 0.38, palette.dark, 0, 0, -3.0);
        cyl(turret, 0.34, 0.1, palette.dark, 0.5, 0.82, 0.35);
        box(turret, 0.24, 0.18, 0.26, palette.blue, -0.5, 0.76, -0.3, true);
        cyl(turret, 0.022, 1.65, palette.dark, -0.8, 1.45, 0.65);
      }
    } else if (type === 'jet') {
      dimensions = [6.4, 2, 7.4];
      ellipsoid(body, 0.7, 0.5, 2.8, 0x81949e, 0, 0.85, -0.1);
      const noseGeo = new T.ConeGeometry(0.52, 1.8, 16); noseGeo.userData.mwOwned = true;
      const nose = mesh(body, noseGeo, 0xa8b8be, 0, 0.85, -3.1); nose.rotation.x = -Math.PI / 2;
      ellipsoid(body, 0.44, 0.42, 0.95, palette.glass, 0, 1.23, -1.35);
      prism(body, [[0,-1.4],[0.7,-1.2],[3.25,1.1],[3.1,1.65],[0.6,0.85],[-0.6,0.85],[-3.1,1.65],[-3.25,1.1],[-0.7,-1.2]], 0.10, 0x758993, 0.8);
      prism(body, [[0,1.4],[1.7,2.6],[1.4,2.9],[0,2.4],[-1.4,2.9],[-1.7,2.6]], 0.09, 0x758993, 0.94);
      for (const s of [-1, 1]) {
        const tail = box(body, 0.10, 1.1, 0.85, 0x647d89, s * 0.55, 1.37, 2.0); tail.rotation.z = s * 0.3; tail.rotation.x = -0.28;
        box(body, 0.35, 0.28, 0.75, palette.dark, s * 0.64, 0.66, -0.85);
        cyl(body, 0.28, 0.8, palette.dark, s * 0.37, 0.8, 2.55, 'z');
        cyl(body, 0.21, 0.05, palette.amber, s * 0.37, 0.8, 2.98, 'z');
        cyl(body, 0.09, 1.25, palette.steel, s * 2.25, 0.55, 0.45, 'z');
        box(body, 0.32, 0.03, 0.25, palette.dark, s * 2.25, 0.55, 0.9);
        box(body, 0.16, 0.045, 0.18, s < 0 ? 0xff5d58 : 0x74e3a7, s * 3.15, 0.93, 1.22, true);
      }
      for (const [x,z] of [[0,-1.7],[-0.7,1.2],[0.7,1.2]]) { cyl(body, 0.045, 0.4, palette.steel, x, 0.3, z); tire(body, x, 0.15, z, 0.17, wheels); }
      exhaust = M.glowSprite(0x60bfff, 1.15); exhaust.position.set(0, 0.8, 3.05); body.add(exhaust);
    } else if (type === 'boat' || type === 'warship' || type === 'carrier') {
      const carrier = type === 'carrier', war = type === 'warship';
      const w = carrier ? 7.2 : war ? 2.6 : 1.35, l = carrier ? 24 : war ? 7.4 : 3;
      dimensions = [w * 2, carrier ? 10 : war ? 7 : 2.3, l * 2];
      prism(body, [[-w*0.75,l],[w*0.75,l],[w,l*0.4],[w,-l*0.65],[0,-l],[-w,-l*0.65],[-w,l*0.4]], carrier ? 2.5 : 0.8, 0x435b68, 0.1);
      prism(body, [[-w,l*0.9],[w,l*0.9],[w,-l*0.65],[0,-l],[-w,-l*0.65]], 0.16, 0x9aa9af, carrier ? 2.6 : 0.95);
      if (carrier) {
        prism(body, [[-7.5,22],[7.5,22],[7.5,-15],[4,-24],[-6,-24],[-8,-10]], 0.22, 0x394c59, 2.8);
        for (let z=-20;z<20;z+=3) box(body, 0.18, 0.025, 1.6, palette.amber, -1.4, 3.04, z, true);
        for (const x of [-6.3, 6.6]) box(body, 0.08, 0.02, 39, palette.steel, x, 3.04, -0.2);
        for (let z=5;z<17;z+=2) box(body, 4.5, 0.035, 0.06, palette.steel, -1.5, 3.04, z);
        box(body, 2.4, 3.0, 6, palette.hull, 4.1, 4.5, 5);
        box(body, 2.8, 1.0, 3.8, palette.steel, 4.1, 6.4, 4.1);
        box(body, 2.85, 0.38, 2.5, palette.glass, 4.1, 6.55, 3.8);
        dish = radar(body, 4.1, 9.1, 5);
        // Deck aircraft are lightweight silhouettes, not live flight simulations.
        for (const z of [-9, -2, 7]) {
          ellipsoid(body, 0.34, 0.25, 1.65, 0xa1b3bc, -4.6, 3.4, z);
          box(body, 2.35, 0.07, 0.55, 0x849ca8, -4.6, 3.4, z + 0.3);
          box(body, 0.05, 0.6, 0.55, palette.hull, -4.6, 3.75, z+1.1);
        }
      } else {
        box(body, w*1.35, war ? 1.8 : 0.75, l*0.38, palette.hull, 0, war ? 2 : 1.38, l*0.18);
        box(body, w*1.1, 0.55, l*0.25, palette.glass, 0, war ? 3.1 : 1.9, l*0.12);
        turret.position.set(0, 1.1, -l*0.55); body.add(turret);
        ellipsoid(turret, w*0.35, 0.4, 0.6, palette.steel, 0, 0.25, 0);
        cyl(turret, war ? 0.09 : 0.055, war ? 3.2 : 1.2, palette.dark, 0, 0.4, war ? -1.8 : -0.8, 'z');
        dish = radar(body, 0, war ? 5.9 : 3.5, l*0.25);
        for (const s of [-1,1]) for (let z=-l*0.6;z<l*0.8;z+=1.4) cyl(body, 0.025, 0.45, palette.steel, s*w*0.85, 1.25, z);
      }
    } else if (type === 'drone') {
      dimensions = [2.6, 0.6, 2.6];
      ellipsoid(body, 0.65, 0.22, 0.52, palette.dark, 0, 0, 0);
      box(body, 0.36, 0.14, 0.6, palette.hull, 0, 0.2, 0);
      ellipsoid(body, 0.17, 0.17, 0.17, palette.glass, 0, -0.19, -0.52);
      for (const x of [-1,1]) for (const z of [-1,1]) {
        const arm = box(body, 1.4, 0.08, 0.12, palette.hull, x*0.55, 0, z*0.55); arm.rotation.y = -x*z*Math.PI/4;
        const r = new T.Group(); r.position.set(x*1.05, 0.12, z*1.05); body.add(r);
        cyl(r, 0.13, 0.18, palette.dark, 0, 0, 0);
        box(r, 1.05, 0.025, 0.095, 0xa8bac1, 0, 0.13, 0);
        box(r, 0.095, 0.025, 1.05, 0xa8bac1, 0, 0.13, 0);
        wheels.push(r); rotors.push(r);
      }
      box(body, 0.15, 0.07, 0.08, palette.blue, 0, 0, -0.57, true);
    } else if (type === 'train') {
      dimensions = [3, 3.3, 10]; color = 0xc9d7dd;
      prism(body, [[-1.4,5],[1.4,5],[1.4,-3.9],[0.9,-5],[-0.9,-5],[-1.4,-3.9]], 1.8, color, 0.7);
      ellipsoid(body, 1.4, 0.5, 4.9, palette.steel, 0, 2.4, 0);
      box(body, 2.85, 0.18, 9.1, 0x26b6c8, 0, 1.15, 0);
      box(body, 1.6, 0.6, 0.06, palette.glass, 0, 2.05, -4.86);
      for (const s of [-1,1]) {
        for (let z=-3;z<=3;z+=1.35) box(body, 0.025, 0.65, 0.95, palette.glass, s*1.41, 1.95, z);
        for (const z of [-3.5,-2.7,2.7,3.5]) tire(body, s*1.16, 0.47, z, 0.39, wheels);
        box(body, 0.3, 0.12, 0.06, palette.amber, s*0.7, 1.05, -4.9, true);
      }
      box(body, 2.2, 0.45, 8.8, palette.dark, 0, 0.65, 0);
    } else if (type === 'mech') {
      dimensions = [2.4, 3.8, 1.8];
      ellipsoid(body, 0.85, 0.65, 0.6, palette.hull, 0, 2.4, 0);
      box(body, 0.85, 0.35, 0.75, palette.dark, 0, 3.12, -0.12);
      box(body, 0.62, 0.08, 0.05, palette.blue, 0, 3.12, -0.51, true);
      for (const s of [-1,1]) {
        const leg = new T.Group(); leg.position.set(s*0.55, 2.1, 0); body.add(leg); legs.push(leg);
        cyl(leg, 0.24, 0.45, palette.dark, 0, 0, 0, 'x');
        box(leg, 0.38, 0.8, 0.42, palette.hull, 0, -0.45, 0);
        cyl(leg, 0.24, 0.46, palette.steel, 0, -0.9, 0, 'x');
        box(leg, 0.28, 0.7, 0.35, palette.dark, 0, -1.35, 0.16);
        box(leg, 0.5, 0.22, 0.85, palette.hull, 0, -1.94, -0.05);
        box(body, 0.38, 0.7, 0.45, palette.hull, s*1.0, 2.35, 0);
        cyl(body, 0.12, 0.95, palette.dark, s*1.0, 2.15, -0.7, 'z');
      }
    }
    batch(body);
    const group = new T.LOD(); group.addLevel(body, 0);
    const far = new T.Group();
    box(far, ...dimensions, color, 0, dimensions[1] / 2, 0);
    group.addLevel(far, type === 'carrier' ? 850 : type === 'warship' ? 420 : 180);
    return { group, body, turret, wheels, barrel, rotors, legs, radar: dish, exhaust, type };
  };
  M.animateVehicle = function (model, dt, speed, time) {
    if (model.radar) model.radar.rotation.y += dt * 1.1;
    if (model.exhaust) { model.exhaust.visible = speed > 6; model.exhaust.scale.setScalar(0.55 + Math.min(1.5, speed / 24)); }
    if (model.type !== 'drone') for (const w of model.wheels || []) w.rotation.x -= speed * dt * 2.5;
    for (let i=0;i<(model.legs || []).length;i++) model.legs[i].rotation.x = Math.sin(time*6 + i*Math.PI)*Math.min(0.45, speed*0.1);
  };
  M.missile = function () {
    const group = new T.Group();
    cyl(group, 0.11, 0.95, palette.steel, 0, 0, 0, 'z');
    const cone = new T.ConeGeometry(0.11, 0.35, 8); cone.userData.mwOwned=true;
    const nose = mesh(group,cone,palette.dark,0,0,-0.65); nose.rotation.x=-Math.PI/2;
    box(group,0.48,0.035,0.22,palette.hull,0,0,0.35);
    box(group,0.035,0.48,0.22,palette.hull,0,0,0.35);
    batch(group); return group;
  };
  M.disposeVehicle = function (model) {
    M.disposeOwned(model?.group);
  };
})();
