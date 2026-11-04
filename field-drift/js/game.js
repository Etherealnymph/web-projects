/* ============================================================
   game.js — 主循环 / 物理 / 目标 / 界面状态机
   ============================================================ */
(function () {
  'use strict';
  const FD = window.FD, V = FD.V, R = FD.Render, A = FD.Audio;
  const clamp = FD.clamp;

  /* ---------------- 全局常数 ---------------- */
  const BASE_REGEN = 0.022;
  const THRUST_COST = 0.085;
  const SLIP_COST = 0.20;
  const SLIP_DV = 0.55;
  const SLOW_COST = 0.045;
  const EMF_GAIN = 0.40;
  const HAZARD_DRAIN = 0.42;
  const MAX_SPEED = 0.93;
  const PROBE_R = 0.42;
  const SUB = 1 / 120;

  /* ---------------- 状态 ---------------- */
  const G = {
    mode: 'title',
    levelIndex: 0,
    level: null,
    sources: null,
    lines: null,
    seeds: [],
    gates: [],
    hazards: [],
    walls: [],
    exit: null,
    probe: null,
    trail: [],
    time: 0,
    acc: 0,
    keys: { w: 0, a: 0, s: 0, d: 0 },
    frameMode: false,
    slowKey: false,
    fx: { slip: 0, hurt: 0, slow: 0, shake: 0 },
    field: { E: V.mk(), B: V.mk(), Ep: V.mk(), Bp: V.mk(), beta: 0, gamma: 1, delta: 1, eb: 0, inv: 0, hall: 0 },
    deadT: 0,
    progress: { unlocked: 0, medals: {} },
    attractYaw: 0,
    manualReturn: 'title',
    started: false,
    // 实验室 / 势
    lab: false,
    potMode: 0,          // 0 关 / 1 φ / 2 A
    brush: 'q+',
    brushScale: 1,
    ghost: null,
    ghostPos: V.mk(),
    rebuildT: 0
  };
  FD.G = G;

  const FE = V.mk(), FB = V.mk(), FEp = V.mk(), FBp = V.mk();
  const potScratch = { phi: 0, ax: 0, ay: 0, az: 0 };
  const GE = V.mk(), GB = V.mk(), GEp = V.mk(), GBp = V.mk();
  const scratch = V.mk();
  const prevPos = V.mk();

  /* ---------------- DOM ---------------- */
  let el = {};
  function $(id) { return document.getElementById(id); }

  function cacheDom() {
    el = {
      hud: $('hud'), level: $('hud-level'), objective: $('hud-objective'),
      rE: $('r-e'), rB: $('r-b'), rEB: $('r-eb'), rInv: $('r-inv'),
      rBeta: $('r-beta'), rHall: $('r-hall'), rVstar: $('r-vstar'),
      rDelta: $('r-delta'), rNote: $('r-note'), rDeltaBar: $('r-deltabar'),
      rEnergy: $('r-energy'), rEnergyBar: $('r-energybar'),
      hudCharge: $('hud-charge'), hudFrame: $('hud-frame'),
      gateHud: $('gatehud'), ghName: $('gh-name'), ghDelta: $('gh-delta'),
      ghFill: $('gh-fill'), ghNote: $('gh-note'),
      rPhi: $('r-phi'), rA: $('r-avec'),
      labbar: $('labbar'), labTools: $('lab-tools'), labPresets: $('lab-presets'),
      labBrush: $('lab-brush-name'), labScale: $('lab-scale'),
      lockhint: $('lockhint'), toastWrap: $('toast-wrap'), fps: $('fps'),
      screens: document.querySelectorAll('.screen')
    };
  }

  /* ---------------- 存档 ---------------- */
  function loadProgress() {
    try {
      const s = localStorage.getItem('fd.progress.v1');
      if (s) {
        const p = JSON.parse(s);
        if (p && Number.isFinite(p.unlocked)) {
          G.progress = {
            unlocked: clamp(Math.floor(p.unlocked), 0, FD.LEVELS.length - 1),
            medals: p.medals && typeof p.medals === 'object' ? p.medals : {}
          };
        }
      }
    } catch (e) { }
  }
  function saveProgress() {
    try { localStorage.setItem('fd.progress.v1', JSON.stringify(G.progress)); } catch (e) { }
  }

  /* ---------------- 工具 ---------------- */
  function showScreen(name) {
    el.screens.forEach(function (s) { s.classList.remove('active'); });
    if (name) {
      const s = document.getElementById('scr-' + name);
      if (s) s.classList.add('active');
    }
  }
  function toast(msg, cls) {
    while (el.toastWrap.children.length >= 3) el.toastWrap.removeChild(el.toastWrap.firstChild);
    const d = document.createElement('div');
    d.className = 'toast' + (cls ? ' ' + cls : '');
    d.textContent = msg;
    el.toastWrap.appendChild(d);
    setTimeout(function () {
      d.style.transition = 'opacity .4s';
      d.style.opacity = '0';
      setTimeout(function () { d.remove(); }, 420);
    }, 2200);
  }

  /* ---------------- 关卡加载 ---------------- */
  function loadLevel(idx) {
    const def = FD.LEVELS[idx];
    G.levelIndex = idx;
    G.lab = false;
    loadDef(def);
  }

  function loadDef(def) {
    G.level = def;
    G.sources = new FD.Sources(def.sources);
    G.lines = null;
    const source = G.sources;
    FD.requestLines(source, def, lines => { if (G.sources === source) G.lines = lines; });
    G.walls = def.walls || [];
    G.seeds = (def.seeds || []).map(function (p, i) {
      return { p: V.from(p), taken: false, ph: i * 1.7 };
    });
    G.gates = (def.gates || []).map(function (g, i) {
      const fieldE = V.mk(), fieldB = V.mk();
      G.sources.sample(V.from(g.c), fieldE, fieldB);
      return {
        fieldE, fieldB,
        c: g.c, n: g.n, r: g.r, tol: g.tol || 0.15, hold: g.hold || 0.6,
        triggerR: g.triggerR || 5,
        open: false, charge: 0, delta: 1, ebUnsolvable: false, eZero: false, seen: false, idx: i
      };
    });
    G.hazards = (def.hazards || []).map(function (h, i) {
      return { c: V.from(h.c), r: h.r, ph: i * 2.1 };
    });
    G.exit = def.exit;
    G.probe = {
      pos: V.from(def.start.p),
      vel: V.from(def.start.v || [0, 0, 0]),
      q: 1, energy: 1, alive: true
    };
    G.trail = [];
    G.time = 0;
    G.acc = 0;
    G.deadT = 0;
    G.frameMode = false;
    G.fx = { slip: 0, hurt: 0, slow: 0, shake: 0 };

    faceLevel();
    updateHudText();
  }

  /* ---------------- 实验室 ---------------- */
  function startLab() {
    const lab = JSON.parse(JSON.stringify(FD.LAB));
    lab.sources = JSON.parse(JSON.stringify(FD.LAB_PRESETS.dipole.defs));
    G.lab = true;
    G.levelIndex = -1;
    loadDef(lab);
    G.mode = 'lab';
    G.potMode = 0;
    G.brush = 'q+';
    G.brushScale = 1;
    el.hud.classList.remove('hidden');
    el.labbar.classList.remove('hidden');
    el.lockhint.classList.add('hidden');
    showScreen(null);
    faceLevel();
    setBrush('q+');
    A.init(); A.resume();
    setTimeout(function () { if (G.mode === 'lab') toast('选择下方元素，左键放到准星处', ''); }, 900);
  }

  function rebuildLab() {
    if (!G.lab) return;
    G.sources = new FD.Sources(G.level.sources);
    G.lines = null;
    const source = G.sources;
    FD.requestLines(source, G.level, lines => { if (G.sources === source) G.lines = lines; });
  }

  function cursorPoint(out) {
    const pr = G.probe, f = R.cam.fwd;
    const d = 8.5;
    out.x = pr.pos.x + f.x * d;
    out.y = pr.pos.y + f.y * d;
    out.z = pr.pos.z + f.z * d;
    const B = G.level.bounds - 1.2;
    out.x = clamp(out.x, -B, B); out.y = clamp(out.y, -B, B); out.z = clamp(out.z, -B, B);
    return out;
  }

  function snapAxis(v) {
    const ax = Math.abs(v.x), ay = Math.abs(v.y), az = Math.abs(v.z);
    if (ax >= ay && ax >= az) return { x: v.x >= 0 ? 1 : -1, y: 0, z: 0 };
    if (ay >= az) return { x: 0, y: v.y >= 0 ? 1 : -1, z: 0 };
    return { x: 0, y: 0, z: v.z >= 0 ? 1 : -1 };
  }

  function makeGhost() {
    if (!G.lab) { G.ghost = null; return; }
    cursorPoint(G.ghostPos);
    const axis = snapAxis(R.cam.fwd);
    G.ghost = FD.sourceFromBrush(G.brush, G.ghostPos, axis, G.brushScale);
  }

  function placeSource() {
    if (!G.lab) return;
    if (G.level.sources.length >= 40) { toast('场源已达上限（40）', 'warn'); return; }
    const d = G.ghost || FD.sourceFromBrush(G.brush, cursorPoint(G.ghostPos), snapAxis(R.cam.fwd), G.brushScale);
    if (!d) return;
    G.level.sources.push(d);
    A.sfx('ui');
    rebuildLab();
    updateHudText();
    toast('已放置：' + brushName(G.brush), 'good');
  }

  function deleteNearCursor() {
    if (!G.lab || !G.level.sources.length) return;
    const p = cursorPoint(V.mk());
    let best = -1, bd = 1e9;
    for (let i = 0; i < G.level.sources.length; i++) {
      const d = G.level.sources[i];
      const c = srcCenter(d);
      const dd = V.dist2(c, p);
      if (dd < bd) { bd = dd; best = i; }
    }
    if (best >= 0 && bd < 36) {
      G.level.sources.splice(best, 1);
      rebuildLab();
      updateHudText();
      A.sfx('deny');
      toast('已删除一个场源');
    } else toast('准星附近没有场源', 'warn');
  }

  function srcCenter(d) {
    if (d.p) return V.from(d.p);
    if (d.c) return V.from(d.c);
    if (d.a) return V.mid ? V.mid(d.a, d.b) : V.mul(V.add(V.from(d.a), V.from(d.b)), 0.5);
    return V.mk(0, 0, 0);
  }

  function brushName(key) {
    for (let i = 0; i < FD.BRUSHES.length; i++) if (FD.BRUSHES[i].key === key) return FD.BRUSHES[i].label;
    return key;
  }

  function updateBrushLabel() {
    if (!el.labBrush) return;
    el.labBrush.textContent = brushName(G.brush);
    el.labScale.textContent = '×' + G.brushScale.toFixed(1);
  }

  function setBrush(key) {
    G.brush = key;
    updateBrushLabel();
    const btns = el.labTools.querySelectorAll('.lab-btn');
    for (let i = 0; i < btns.length; i++) btns[i].classList.toggle('active', btns[i].dataset.key === key);
    A.sfx('ui');
  }

  function cyclePot() {
    G.potMode = (G.potMode + 1) % 3;
    A.sfx('ui');
    toast(G.potMode === 0 ? '势视图：关' : G.potMode === 1 ? '势视图：φ 电势切面' : '势视图：A 磁矢势切面');
  }

  // 把相机摆到"从起点看向出口"的姿态
  function faceLevel() {
    const def = G.level;
    const tx = def.exit ? def.exit.p[0] : 0;
    const ty = def.exit ? def.exit.p[1] : 0;
    const tz = def.exit ? def.exit.p[2] : 0;
    const ex = tx - def.start.p[0];
    const ey = ty - def.start.p[1];
    const ez = tz - def.start.p[2];
    const horiz = Math.hypot(ex, ez);
    R.cam.yaw = Math.atan2(ex, ez) + 0.26;
    R.cam.pitch = clamp(Math.atan2(ey, horiz || 1) * 0.5, -0.62, 0.4);
    R.cam.dist = Math.max(7.4, def.bounds * 0.86);
    const fx = Math.sin(R.cam.yaw) * Math.cos(R.cam.pitch);
    const fy = Math.sin(R.cam.pitch);
    const fz = Math.cos(R.cam.yaw) * Math.cos(R.cam.pitch);
    const tgt = { x: G.probe.pos.x, y: G.probe.pos.y, z: G.probe.pos.z };
    R.cam.fwd = { x: fx, y: fy, z: fz };
    R.cam.right = V.norm(V.cross(V.mk(0, 1, 0), R.cam.fwd));
    R.cam.up = V.cross(R.cam.fwd, R.cam.right);
    R.cam.pos = { x: tgt.x - fx * R.cam.dist, y: tgt.y - fy * R.cam.dist, z: tgt.z - fz * R.cam.dist };
  }

  /* ---------------- 物理 ---------------- */
  function sampleFields() {
    G.sources.sample(G.probe.pos, FE, FB);
    const sp = Math.hypot(G.probe.vel.x, G.probe.vel.y, G.probe.vel.z);
    const g = 1 / Math.sqrt(Math.max(1e-4, 1 - Math.min(0.999, sp * sp)));
    FD.transformFields(FE, FB, G.probe.vel, FEp, FBp);
    G.field.gamma = g;
    G.field.beta = sp;
  }

  function physicsStep(dt) {
    const pr = G.probe, lv = G.level;
    const k = lv.k ?? 0.30, th = lv.thrust ?? 0.22;
    sampleFields();

    // 推进器
    let tx = 0, ty = 0, tz = 0, tlevel = 0;
    const f = R.cam.fwd, rt = R.cam.right;
    if (G.keys.w) { tx += f.x; ty += f.y; tz += f.z; tlevel = 1; }
    if (G.keys.s) { tx -= f.x; ty -= f.y; tz -= f.z; tlevel = Math.max(tlevel, 0.8); }
    if (G.keys.d) { tx += rt.x; ty += rt.y; tz += rt.z; tlevel = Math.max(tlevel, 0.62); }
    if (G.keys.a) { tx -= rt.x; ty -= rt.y; tz -= rt.z; tlevel = Math.max(tlevel, 0.62); }
    if (tlevel > 1e-3) {
      const l = Math.hypot(tx, ty, tz) || 1;
      tx /= l; ty /= l; tz /= l;
    }
    if (pr.energy <= 0.002) tlevel = 0;
    G.thrustLevel = tlevel;

    const q = pr.q;
    const vxB = V.cross(pr.vel, FB);
    const g = G.field.gamma;
    prevPos.x = pr.pos.x; prevPos.y = pr.pos.y; prevPos.z = pr.pos.z;
    const velocity = FD.Physics.boris(pr.vel, FE, FB, q, k,
      { x: tx * th * tlevel, y: ty * th * tlevel, z: tz * th * tlevel }, dt);
    V.copy(pr.vel, velocity);
    let sp = Math.hypot(pr.vel.x, pr.vel.y, pr.vel.z);
    if (sp > MAX_SPEED) {
      const s = MAX_SPEED / sp;
      pr.vel.x *= s; pr.vel.y *= s; pr.vel.z *= s;
      sp = MAX_SPEED;
    }
    pr.pos.x += pr.vel.x * dt;
    pr.pos.y += pr.vel.y * dt;
    pr.pos.z += pr.vel.z * dt;

    collide(prevPos);

    // 场能
    const emf = Math.hypot(vxB.x, vxB.y, vxB.z) * g;
    const base = lv.baseRegen != null ? lv.baseRegen : BASE_REGEN;
    const drain = tlevel * THRUST_COST + (G.slowKey ? SLOW_COST : 0);
    pr.energy = clamp(pr.energy + (base + EMF_GAIN * emf - drain) * dt, 0, 1);

    // 危险区
    for (let i = 0; i < G.hazards.length; i++) {
      const h = G.hazards[i];
      if (V.dist2(pr.pos, h.c) < h.r * h.r) {
        pr.energy -= HAZARD_DRAIN * dt;
        G.fx.hurt = Math.min(1, G.fx.hurt + dt * 3.2);
        R.shake = Math.max(R.shake, 0.35);
        if (Math.random() < dt * 3) A.sfx('hurt');
      }
    }
    if (pr.energy <= 0) die();

    // 种子
    for (let i = 0; i < G.seeds.length; i++) {
      const s = G.seeds[i];
      if (s.taken) continue;
      if (V.dist2(pr.pos, s.p) < 1.35) {
        s.taken = true;
        pr.energy = clamp(pr.energy + 0.10, 0, 1);
        A.sfx('seed');
        G.fx.slip = Math.max(G.fx.slip, 0.10);
        const n = G.seeds.filter(function (x) { return x.taken; }).length;
        toast('电荷种子 ' + n + ' / ' + G.seeds.length, 'good');
        updateHudText();
      }
    }
  }

  function collide(prev) {
    const pr = G.probe, B = G.level.bounds;
    // 边界
    if (pr.pos.x > B - PROBE_R) { pr.pos.x = B - PROBE_R; if (pr.vel.x > 0) pr.vel.x *= -0.2; }
    if (pr.pos.x < -B + PROBE_R) { pr.pos.x = -B + PROBE_R; if (pr.vel.x < 0) pr.vel.x *= -0.2; }
    if (pr.pos.y > B - PROBE_R) { pr.pos.y = B - PROBE_R; if (pr.vel.y > 0) pr.vel.y *= -0.2; }
    if (pr.pos.y < -B + PROBE_R) { pr.pos.y = -B + PROBE_R; if (pr.vel.y < 0) pr.vel.y *= -0.2; }
    if (pr.pos.z > B - PROBE_R) { pr.pos.z = B - PROBE_R; if (pr.vel.z > 0) pr.vel.z *= -0.2; }
    if (pr.pos.z < -B + PROBE_R) { pr.pos.z = -B + PROBE_R; if (pr.vel.z < 0) pr.vel.z *= -0.2; }

    const thick = 0.5 + PROBE_R;
    for (let wi = 0; wi < G.walls.length; wi++) {
      const w = G.walls[wi];
      const c = w.c, n = V.norm(V.from(w.n)), u = V.norm(V.from(w.u)), vv = V.norm(V.from(w.v));
      const ax = pr.pos.x - c[0], ay = pr.pos.y - c[1], az = pr.pos.z - c[2];
      const s = ax * n.x + ay * n.y + az * n.z;
      if (Math.abs(s) > thick) continue;
      const uu = ax * u.x + ay * u.y + az * u.z;
      const vv2 = ax * vv.x + ay * vv.y + az * vv.z;
      if (Math.abs(uu) > w.hw || Math.abs(vv2) > w.hh) continue;

      let inHole = false;
      for (let hi = 0; hi < w.holes.length; hi++) {
        const h = w.holes[hi];
        const hx = h.c[0] - c[0], hy = h.c[1] - c[1], hz = h.c[2] - c[2];
        const du = hx * u.x + hy * u.y + hz * u.z;
        const dv = hx * vv.x + hy * vv.y + hz * vv.z;
        const dx = uu - du, dy = vv2 - dv;
        const rr = h.r - PROBE_R * 0.85;
        const gateOpen = (h.gate === undefined || h.gate === null) ? true : G.gates[h.gate].open;
        if (dx * dx + dy * dy < rr * rr && gateOpen) { inHole = true; break; }
      }
      if (inHole) continue;

      // 上一帧在哪一侧
      const px = prev.x - c[0], py = prev.y - c[1], pz = prev.z - c[2];
      const sprev = px * n.x + py * n.y + pz * n.z;
      const side = sprev >= 0 ? 1 : -1;
      const target = side * thick;
      pr.pos.x = c[0] + n.x * target + u.x * uu + vv.x * vv2;
      pr.pos.y = c[1] + n.y * target + u.y * uu + vv.y * vv2;
      pr.pos.z = c[2] + n.z * target + u.z * uu + vv.z * vv2;
      const vn = pr.vel.x * n.x + pr.vel.y * n.y + pr.vel.z * n.z;
      if (vn * side < 0) {
        pr.vel.x -= n.x * vn * 1.25;
        pr.vel.y -= n.y * vn * 1.25;
        pr.vel.z -= n.z * vn * 1.25;
        if (Math.abs(vn) > 0.18) { A.sfx('deny'); R.shake = Math.max(R.shake, 0.4); }
      }
    }
  }

  function die() {
    if (G.deadT > 0 || !G.probe.alive) return;
    G.probe.alive = false;
    G.deadT = 1.25;
    G.fx.hurt = 1;
    R.shake = 1.2;
    A.sfx('die');
  }

  function respawn() {
    const pr = G.probe, lv = G.level;
    pr.pos = V.from(lv.start.p);
    pr.vel = V.mk(0, 0, 0);
    pr.energy = 0.72;
    pr.alive = true;
    G.trail = [];
    G.deadT = 0;
    G.fx.hurt = 0;
    toast('探针重构 · 场能 72%', 'warn');
  }

  /* ---------------- 动作 ---------------- */
  function frameSlip() {
    const pr = G.probe;
    if ((G.mode !== 'play' && G.mode !== 'lab') || !pr.alive) return;
    if (pr.energy < SLIP_COST + 0.02) { A.sfx('deny'); toast('场能不足，无法换系', 'warn'); return; }
    pr.energy -= SLIP_COST;
    const f = R.cam.fwd;
    pr.vel.x += f.x * SLIP_DV;
    pr.vel.y += f.y * SLIP_DV;
    pr.vel.z += f.z * SLIP_DV;
    const sp = Math.hypot(pr.vel.x, pr.vel.y, pr.vel.z);
    if (sp > MAX_SPEED) {
      const s = MAX_SPEED / sp;
      pr.vel.x *= s; pr.vel.y *= s; pr.vel.z *= s;
    }
    G.fx.slip = 1;
    R.shake = Math.max(R.shake, 0.55);
    A.sfx('slip');
  }

  function flipCharge() {
    const pr = G.probe;
    if (G.mode !== 'play' && G.mode !== 'lab') return;
    pr.q *= -1;
    A.sfx('flip');
    toast(pr.q > 0 ? '极性 ⊕ 正电荷' : '极性 ⊖ 负电荷');
    el.hudCharge.textContent = pr.q > 0 ? '⊕' : '⊖';
    el.hudCharge.classList.toggle('neg', pr.q < 0);
  }

  /* ---------------- 每帧 ---------------- */
  function update(dt) {
    if (G.mode === 'title' || G.mode === 'levels' || G.mode === 'brief' || G.mode === 'complete') {
      G.attractYaw += dt * 0.075;
      R.cam.yaw = G.attractYaw;
      R.cam.pitch = -0.18 + Math.sin(G.attractYaw * 0.7) * 0.1;
      R.cam.dist = 20;
      R.cam.fwd = {
        x: Math.sin(R.cam.yaw) * Math.cos(R.cam.pitch),
        y: Math.sin(R.cam.pitch),
        z: Math.cos(R.cam.yaw) * Math.cos(R.cam.pitch)
      };
      R.cam.right = V.norm(V.cross(V.mk(0, 1, 0), R.cam.fwd));
      R.cam.up = V.cross(R.cam.fwd, R.cam.right);
      R.cam.pos = {
        x: -R.cam.fwd.x * R.cam.dist,
        y: -R.cam.fwd.y * R.cam.dist,
        z: -R.cam.fwd.z * R.cam.dist
      };
      R.shake *= Math.exp(-4 * dt);
      G.fx.slip *= Math.exp(-3 * dt);
      return;
    }
    if (G.mode !== 'play' && G.mode !== 'lab') return;

    G.fx.slip *= Math.exp(-3.4 * dt);
    G.fx.hurt *= Math.exp(-2.2 * dt);
    R.shake *= Math.exp(-5 * dt);

    if (G.deadT > 0) {
      G.deadT -= dt;
      if (G.deadT <= 0) respawn();
      updateCameraOnly(dt);
      return;
    }

    const scale = G.slowKey ? 0.28 : 1;
    G.acc += dt * scale;
    let iter = 0;
    while (G.acc >= SUB && iter < 8) {
      physicsStep(SUB);
      G.time += SUB;
      if (!G.lab && G.probe.alive) {
        updateGates(SUB);
        checkExit();
      }
      G.acc -= SUB;
      iter++;
      if (!G.probe.alive || (G.mode !== 'play' && G.mode !== 'lab')) break;
    }
    if (iter >= 8) G.acc = 0;


    // 尾迹
    const tp = G.probe.pos;
    const last = G.trail[G.trail.length - 1];
    if (!last || V.dist2(last, tp) > 0.045) {
      G.trail.push({ x: tp.x, y: tp.y, z: tp.z });
      if (G.trail.length > 70) G.trail.shift();
    }

    if (G.lab) {
      makeGhost();
    }
    updateCameraOnly(dt);
    updateHud(dt);
  }

  function updateCameraOnly(dt) {
    const pr = G.probe;
    const tgt = V.mk(
      pr.pos.x + pr.vel.x * 0.16,
      pr.pos.y + pr.vel.y * 0.16,
      pr.pos.z + pr.vel.z * 0.16
    );
    R.setTarget(tgt);
    R.updateCamera(tgt, dt);
  }

  function updateGates(dt) {
    const pr = G.probe;
    for (let i = 0; i < G.gates.length; i++) {
      const g = G.gates[i];
      const gc = { x: g.c[0], y: g.c[1], z: g.c[2] };
      const dist = V.dist(pr.pos, gc);
      V.copy(GE, g.fieldE);
      V.copy(GB, g.fieldB);
      const vB = V.cross(pr.vel, GB);
      const mE = Math.hypot(GE.x, GE.y, GE.z);
      const mV = Math.hypot(vB.x, vB.y, vB.z);
      const sx = GE.x + vB.x, sy = GE.y + vB.y, sz = GE.z + vB.z;
      const den = mE + mV;
      g.delta = den < 1e-12 ? 0 : Math.hypot(sx, sy, sz) / den;
      g.eZero = mE < 0.015;
      g.eb = Math.abs(GE.x * GB.x + GE.y * GB.y + GE.z * GB.z);
      g.ebUnsolvable = g.eb > 0.006 && !g.eZero;

      if (!g.seen && dist < g.triggerR + 1.5) {
        g.seen = true;
        if (g.ebUnsolvable) toast('门 ' + (i + 1) + '：E·B ≠ 0 —— 无法精确抵消，仍以 δ 阈值判门', 'warn');
        else if (g.eZero) toast('门 ' + (i + 1) + '：E ≈ 0，可静止或沿 B 运动', 'warn');
        else toast('门 ' + (i + 1) + '：把 δ 压到 ' + g.tol + ' 以下', '');
      }

      if (!g.open && dist < g.triggerR && g.delta < g.tol) {
        const before = g.charge;
        g.charge = clamp(g.charge + dt / g.hold, 0, 1);
        if (Math.floor(before * 6) !== Math.floor(g.charge * 6)) A.sfx('gateCharge');
        if (g.charge >= 1) {
          g.open = true;
          A.sfx('gateOn');
          toast('门 ' + (i + 1) + ' 已解锁', 'good');
          R.shake = Math.max(R.shake, 0.3);
        }
      } else if (!g.open) {
        g.charge = clamp(g.charge - dt * 1.6, 0, 1);
      }
    }
  }

  function checkExit() {
    const pr = G.probe;
    const all = G.seeds.every(function (s) { return s.taken; });
    const e = G.level.exit;
    const d2 = (pr.pos.x - e.p[0]) * (pr.pos.x - e.p[0]) + (pr.pos.y - e.p[1]) * (pr.pos.y - e.p[1]) + (pr.pos.z - e.p[2]) * (pr.pos.z - e.p[2]);
    if (d2 < e.r * e.r) {
      if (all) complete();
      else if (!G._exitWarn || G.time - G._exitWarn > 2.5) {
        G._exitWarn = G.time;
        toast('出口已锁定：还差 ' + G.seeds.filter(function (s) { return !s.taken; }).length + ' 枚种子', 'warn');
        A.sfx('deny');
      }
    }
  }

  function complete() {
    if (G.mode !== 'play') return;
    G.mode = 'complete';
    A.sfx('complete');
    R.shake = 0.6;
    document.exitPointerLock && document.exitPointerLock();
    const t = G.time;
    const par = G.level.par;
    let medal = 'bronze', mtxt = '铜';
    if (t <= par[0]) { medal = 'gold'; mtxt = '金'; }
    else if (t <= par[1]) { medal = 'silver'; mtxt = '银'; }
    G.progress.medals[G.level.id] = medal;
    G.progress.unlocked = Math.max(G.progress.unlocked, Math.min(FD.LEVELS.length - 1, G.levelIndex + 1));
    saveProgress();

    $('done-tag').textContent = 'LEVEL ' + G.level.tag;
    $('done-title').textContent = G.level.name + ' · 穿越成功';
    $('done-medal').textContent = medal === 'gold' ? '★ ★ ★' : medal === 'silver' ? '★ ★' : '★';
    $('done-stats').innerHTML =
      '用时 <b>' + t.toFixed(1) + ' s</b> &nbsp;·&nbsp; 评级 <b>' + mtxt + '</b><br>' +
      '金 ≤ ' + par[0] + 's &nbsp;/&nbsp; 银 ≤ ' + par[1] + 's';
    $('btn-next').style.display = G.levelIndex >= FD.LEVELS.length - 1 ? 'none' : '';
    showScreen('complete');
    el.hud.classList.add('hidden');
  }

  /* ---------------- HUD ---------------- */
  let hudAcc = 0;
  function updateHud(dt) {
    hudAcc += dt;
    if (hudAcc < 0.07) return;
    hudAcc = 0;
    const pr = G.probe;
    const f = G.field;
    sampleFields();

    const E = G.frameMode ? FEp : FE;
    const B = G.frameMode ? FBp : FB;
    const mE = Math.hypot(E.x, E.y, E.z);
    const mB = Math.hypot(B.x, B.y, B.z);
    const eb = E.x * B.x + E.y * B.y + E.z * B.z;
    const inv = mE * mE - mB * mB;

    el.rE.textContent = FD.fmt(mE, 3);
    el.rB.textContent = FD.fmt(mB, 3);
    el.rEB.textContent = FD.fmt(eb, 4);
    el.rInv.textContent = FD.fmt(inv, 4);
    el.rBeta.textContent = f.beta.toFixed(2) + ' / ' + f.gamma.toFixed(2);
    const k = G.level.k ?? 0.30;
    const hall = Math.atan(Math.abs(pr.q) * V.len(FB) / Math.max(1e-12, k)) * 180 / Math.PI;
    el.rHall.textContent = hall.toFixed(1) + '°';

    // v*
    const vs = V.mk();
    const ok = FD.driftVelocity(FE, FB, vs);
    if (!ok || Math.hypot(FE.x, FE.y, FE.z) < 0.01) {
      el.rVstar.textContent = '—';
    } else {
      const vm = Math.hypot(vs.x, vs.y, vs.z);
      el.rVstar.textContent = vm.toFixed(2) + (vm > 1 ? ' (>c)' : '');
    }

    // δ（探针处）
    const vB = V.cross(pr.vel, FB);
    const mv = Math.hypot(vB.x, vB.y, vB.z);
    const dsum = Math.hypot(FE.x + vB.x, FE.y + vB.y, FE.z + vB.z);
    const den0 = Math.hypot(FE.x, FE.y, FE.z) + mv;
    const delta = den0 < 1e-12 ? 0 : dsum / den0;
    f.delta = delta;
    el.rDelta.textContent = delta.toFixed(3);
    el.rDeltaBar.style.transform = 'scaleX(' + clamp(1 - delta, 0, 1) + ')';

    // 提示
    let note = '';
    const mEraw = Math.hypot(FE.x, FE.y, FE.z);
    const ebRaw = FE.x * FB.x + FE.y * FB.y + FE.z * FB.z;
    if (mEraw < 0.015 && mB > 0.01) note = '纯磁场：静止或沿 B 运动时磁力为零；横向运动发生回旋';
    else if (Math.abs(ebRaw) > 0.006) note = 'E·B = ' + FD.fmt(ebRaw, 3) + ' ≠ 0：平行场分量无法精确抵消';
    el.rNote.textContent = note + (G.sources.potentialValid ? '' : ' 匀强盒的软边界用于关卡塑形，势切面已停用。');

    // 势
    const potOut = potScratch;
    G.sources.potential(pr.pos, potOut);
    el.rPhi.textContent = G.sources.potentialValid ? FD.fmt(potOut.phi, 3) : '局部场边界未定义';
    el.rA.textContent = G.sources.potentialValid ? FD.fmt(Math.hypot(potOut.ax, potOut.ay, potOut.az), 3) : '局部场边界未定义';

    el.rEnergy.textContent = Math.round(pr.energy * 100) + '%';
    el.rEnergyBar.style.width = (pr.energy * 100).toFixed(1) + '%';
    el.rEnergyBar.style.background = pr.energy < 0.22
      ? 'linear-gradient(90deg,#ff4d6a,#ff9a6a)'
      : 'linear-gradient(90deg,#2ad7ff,#8ef7ff)';
    el.hudFrame.textContent = G.frameMode ? '我的参考系' : '站台系';
    el.hudFrame.style.color = G.frameMode ? '#ff9de0' : '#8a7dff';

    // 静默门面板
    let near = null, nd = 1e9;
    for (let i = 0; i < G.gates.length; i++) {
      const g = G.gates[i];
      const d = Math.hypot(pr.pos.x - g.c[0], pr.pos.y - g.c[1], pr.pos.z - g.c[2]);
      if (d < g.triggerR + 4 && d < nd) { nd = d; near = g; }
    }
    G.nearestGate = near;
    if (near) {
      el.gateHud.classList.remove('hidden');
      el.gateHud.classList.toggle('open', near.open);
      el.gateHud.classList.toggle('bad', !near.open && near.ebUnsolvable);
      el.ghName.textContent = '门 ' + (near.idx + 1);
      el.ghDelta.textContent = near.delta.toFixed(3);
      el.ghFill.style.width = (near.charge * 100).toFixed(0) + '%';
      if (near.open) el.ghNote.textContent = '已永久解锁 · 可穿过';
      else if (near.ebUnsolvable) el.ghNote.textContent = 'E·B ≠ 0 —— 任何参考系都无法静默，这扇门不是路';
      else if (near.eZero) el.ghNote.textContent = '此处 E ≈ 0：δ 恒为 1，无法解锁';
      else if (near.charge > 0.02) el.ghNote.textContent = '稳定对齐中… 保持 ' + near.hold.toFixed(1) + ' 秒';
      else el.ghNote.textContent = '把速度对准金色 v* 箭头，让 δ < ' + near.tol;
    } else {
      el.gateHud.classList.add('hidden');
    }
  }

  function updateHudText() {
    if (!G.level) return;
    if (G.lab) {
      el.level.textContent = 'LAB · 场实验室';
      el.objective.textContent = '场源 ' + G.level.sources.length + ' 个 · 左键放置 · V 势视图';
      return;
    }
    const n = G.seeds.filter(function (s) { return s.taken; }).length;
    const total = G.seeds.length;
    el.level.textContent = 'LEVEL ' + G.level.tag + ' · ' + G.level.name;
    el.objective.textContent = '电荷种子 ' + n + ' / ' + total + (n === total ? ' · 出口已解锁' : '');
  }

  /* ---------------- 渲染 ---------------- */
  function buildScene() {
    const inWorld = G.probe && (G.mode === 'play' || G.mode === 'pause' || G.mode === 'manual' || G.mode === 'lab');
    if (!G.attract || !inWorld) {
      if (!G.attract) return null;
      return {
        level: G.attractLevel,
        sources: G.attractSources,
        lines: G.attractLines,
        seeds: [], gates: [], hazards: [], walls: [],
        probe: { pos: V.mk(0, 0, 0), vel: V.mk(0, 0, 0), q: 1, energy: 1 },
        trail: [], t: performance.now() / 1000, frameMode: false, potMode: 0,
        fx: { slip: 0, hurt: 0, slow: 0, shake: 0 },
        force: null, forceMag: 0, showProbe: false
      };
    }
    const pr = G.probe;
    const force = V.cross(pr.vel, FB);
    force.x = pr.q * (FE.x + force.x);
    force.y = pr.q * (FE.y + force.y);
    force.z = pr.q * (FE.z + force.z);
    const vs = V.mk();
    const hasVs = FD.driftVelocity(FE, FB, vs) && Math.hypot(FE.x, FE.y, FE.z) > 0.012;
    return {
      level: G.level,
      sources: G.sources,
      lines: G.lines,
      seeds: G.seeds,
      gates: G.gates,
      hazards: G.hazards,
      walls: G.level.walls || [],
      probe: pr,
      trail: G.trail,
      t: performance.now() / 1000,
      frameMode: G.frameMode,
      fx: G.fx,
      force: force,
      forceMag: Math.hypot(force.x, force.y, force.z),
      vstar: hasVs ? vs : null,
      vstarMag: hasVs ? Math.hypot(vs.x, vs.y, vs.z) : 0,
      gateNear: G.nearestGate,
      potMode: G.potMode,
      ghost: G.ghost,
      ghostPos: G.ghostPos,
      showProbe: true
    };
  }

  function render() {
    const st = buildScene();
    if (!st) return;
    R.draw(st);
  }

  /* ---------------- 循环 ---------------- */
  let lastT = 0, fpsAcc = 0, fpsN = 0;
  function loop(now) {
    const raw = Math.min(0.06, (now - lastT) / 1000 || 0.016);
    lastT = now;
    if (document.hidden) { requestAnimationFrame(loop); return; }
    if (FD.Intuition.active) { FD.Intuition.update(raw); requestAnimationFrame(loop); return; }
    if (FD.onFrame) FD.onFrame(raw);
    update(raw);
    render();
    if (!el.fps.classList.contains('hidden')) {
      fpsAcc += raw; fpsN++;
      if (fpsAcc > 0.5) {
        el.fps.textContent = Math.round(fpsN / fpsAcc) + ' fps';
        fpsAcc = 0; fpsN = 0;
      }
    }
    requestAnimationFrame(loop);
  }

  /* ---------------- 输入 ---------------- */
  function setupInput() {
    window.addEventListener('keydown', function (e) {
      if (FD.Intuition.active || e.target.closest('input,textarea,select,[contenteditable=true]')) return;
      const k = e.key.toLowerCase();
      if (e.repeat && !['w', 'a', 's', 'd', 'shift'].includes(k)) return;
      if ((G.mode === 'play' || G.mode === 'lab') && [' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();

      if (k === 'escape') {
        if (G.mode === 'lab') { exitLab(); return; }
        if (G.mode === 'play') pause();
        else if (G.mode === 'pause') resume();
        else if (G.mode === 'manual') closeManual();
        return;
      }
      if (k === 'h') {
        if (G.mode === 'play' || G.mode === 'pause' || G.mode === 'lab') openManual(G.mode);
        else if (G.mode === 'manual') closeManual();
        return;
      }
      if (k === 'm') {
        G.muted = !G.muted;
        A.setMuted(G.muted);
        toast(G.muted ? '静音' : '开启声音');
        return;
      }
      if (k === 'p') { el.fps.classList.toggle('hidden'); return; }
      if (k === 'v') { if (G.mode === 'play' || G.mode === 'lab' || G.mode === 'pause') cyclePot(); return; }
      if (G.mode === 'lab') {
        if (k === 'e') { placeSource(); return; }
        if (k === 'x') { deleteNearCursor(); return; }
        if (k === '[') { G.brushScale = clamp(G.brushScale / 1.25, 0.25, 4); updateBrushLabel(); return; }
        if (k === ']') { G.brushScale = clamp(G.brushScale * 1.25, 0.25, 4); updateBrushLabel(); return; }
      }
      if (G.mode !== 'play' && G.mode !== 'lab') return;
      if (k === 'w') G.keys.w = 1;
      if (k === 'a') G.keys.a = 1;
      if (k === 's') G.keys.s = 1;
      if (k === 'd') G.keys.d = 1;
      if (k === 'shift') { G.slowKey = true; G.fx.slow = 1; }
      if (k === ' ') frameSlip();
      if (k === 'q') flipCharge();
      if (k === 'f') {
        G.frameMode = !G.frameMode;
        A.sfx('ui');
        toast(G.frameMode ? '参考系：我的系（E′, B′）' : '参考系：站台系（E, B）');
      }
      if (k === 'r') {
        if (G.probe.alive) { respawn(); toast('重置到起点'); }
      }
    });

    window.addEventListener('keyup', function (e) {
      const k = e.key.toLowerCase();
      if (k === 'w') G.keys.w = 0;
      if (k === 'a') G.keys.a = 0;
      if (k === 's') G.keys.s = 0;
      if (k === 'd') G.keys.d = 0;
      if (k === 'shift') { G.slowKey = false; G.fx.slow = 0; }
    });

    window.addEventListener('blur', function () {
      G.keys.w = G.keys.a = G.keys.s = G.keys.d = 0;
      G.slowKey = false;
      if (G.mode === 'play') pause();
    });

    const cv = R.cv;
    cv.addEventListener('click', function () {
      if (G.mode === 'lab') return;
      if (G.mode === 'play' && document.pointerLockElement !== cv) {
        const p = cv.requestPointerLock();
        if (p && p.catch) p.catch(function () { });
      }
    });
    document.addEventListener('pointerlockchange', function () {
      const locked = document.pointerLockElement === cv;
      el.lockhint.classList.toggle('hidden', locked || G.mode !== 'play');
    });
    document.addEventListener('mousemove', function (e) {
      if (document.pointerLockElement !== cv || (G.mode !== 'play' && G.mode !== 'lab')) return;
      R.cam.yaw -= e.movementX * 0.0022;
      R.cam.pitch = clamp(R.cam.pitch - e.movementY * 0.0022, -1.35, 1.35);
    });
    window.addEventListener('wheel', function (e) {
      if (G.mode !== 'play' && G.mode !== 'lab') return;
      R.cam.dist = clamp(R.cam.dist + e.deltaY * 0.012, 4.5, 18);
    }, { passive: true });

    // 实验室：拖拽看视角，单击放源（不锁指针，方便点工具栏）
    let drag = null;
    cv.addEventListener('mousedown', function (e) {
      if (G.mode !== 'lab' || e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, moved: 0 };
      e.preventDefault();
    });
    window.addEventListener('mousemove', function (e) {
      if (G.mode !== 'lab' || !drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      drag.x = e.clientX; drag.y = e.clientY;
      R.cam.yaw -= dx * 0.0042;
      R.cam.pitch = clamp(R.cam.pitch - dy * 0.0042, -1.35, 1.35);
    });
    window.addEventListener('mouseup', function () {
      if (G.mode !== 'lab' || !drag) return;
      const wasClick = drag.moved < 7;
      drag = null;
      if (wasClick) placeSource();
    });

    // 触屏拖拽视角（简单支持）
    let touchX = null, touchY = null;
    cv.addEventListener('touchstart', function (e) {
      if (e.touches.length === 1) { touchX = e.touches[0].clientX; touchY = e.touches[0].clientY; }
    }, { passive: true });
    cv.addEventListener('touchmove', function (e) {
      if (touchX === null || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - touchX;
      const dy = e.touches[0].clientY - touchY;
      touchX = e.touches[0].clientX; touchY = e.touches[0].clientY;
      R.cam.yaw -= dx * 0.006;
      R.cam.pitch = clamp(R.cam.pitch - dy * 0.006, -1.35, 1.35);
    }, { passive: true });
    cv.addEventListener('touchend', function () { touchX = null; });
  }

  /* ---------------- 界面流程 ---------------- */
  function exitLab() {
    G.lab = false;
    G.mode = 'title';
    G.potMode = 0;
    G.ghost = null;
    el.labbar.classList.add('hidden');
    el.hud.classList.add('hidden');
    showScreen('title');
    document.exitPointerLock && document.exitPointerLock();
  }

  function pause() {
    if (G.mode !== 'play') return;
    G.mode = 'pause';
    showScreen('pause');
    document.exitPointerLock && document.exitPointerLock();
    A.thrust(0);
  }
  function resume() {
    G.mode = 'play';
    showScreen(null);
    A.resume();
    if (document.pointerLockElement !== R.cv) el.lockhint.classList.remove('hidden');
  }
  function openManual(from) {
    G.manualReturn = from;
    G.mode = 'manual';
    showScreen('manual');
    document.exitPointerLock && document.exitPointerLock();
  }
  function closeManual() {
    if (G.manualReturn === 'pause') { G.mode = 'pause'; showScreen('pause'); }
    else if (G.manualReturn === 'play') { G.mode = 'play'; showScreen(null); el.hud.classList.remove('hidden'); }
    else if (G.manualReturn === 'lab') { G.mode = 'lab'; showScreen(null); el.hud.classList.remove('hidden'); }
    else { G.mode = 'title'; showScreen('title'); el.hud.classList.add('hidden'); }
  }

  function startLevel(idx) {
    loadLevel(idx);
    G.mode = 'brief';
    $('brief-tag').textContent = 'LEVEL ' + G.level.tag;
    $('brief-title').textContent = G.level.name + ' · ' + G.level.subtitle;
    $('brief-body').innerHTML = G.level.brief.join('');
    $('brief-goal').textContent = G.level.goal;
    el.hud.classList.add('hidden');
    el.labbar.classList.add('hidden');
    showScreen('brief');
  }

  function beginPlay() {
    el.labbar.classList.add('hidden');
    faceLevel();
    G.mode = 'play';
    showScreen(null);
    el.hud.classList.remove('hidden');
    updateHudText();
    A.init();
    A.resume();
    setTimeout(function () { if (G.mode === 'play') toast(G.level.hint || '', ''); }, 1400);
    el.lockhint.classList.remove('hidden');
  }

  function buildLevelGrid() {
    const grid = $('level-grid');
    grid.innerHTML = '';
    FD.LEVELS.forEach(function (L, i) {
      const b = document.createElement('button');
      const locked = i > G.progress.unlocked;
      b.className = 'lvl-btn' + (locked ? ' locked' : '');
      const m = G.progress.medals[L.id];
      b.innerHTML = '<span>LEVEL ' + L.tag + (locked ? ' · 未解锁' : '') + '</span><b>' + L.name + '</b>' +
        '<span class="medalmini">' + (locked ? '🔒' : (m === 'gold' ? '★ ★ ★' : m === 'silver' ? '★ ★' : m === 'bronze' ? '★' : '')) + '</span>';
      if (!locked) b.addEventListener('click', function () { A.sfx('ui'); startLevel(i); });
      grid.appendChild(b);
    });
  }

  function buildLabBar() {
    el.labTools.innerHTML = '';
    FD.BRUSHES.forEach(function (b) {
      const btn = document.createElement('button');
      btn.className = 'lab-btn';
      btn.dataset.key = b.key;
      btn.innerHTML = '<i>' + b.short + '</i>' + b.label;
      btn.addEventListener('click', function () { setBrush(b.key); });
      el.labTools.appendChild(btn);
    });
    el.labPresets.innerHTML = '';
    Object.keys(FD.LAB_PRESETS).forEach(function (k) {
      const pset = FD.LAB_PRESETS[k];
      const btn = document.createElement('button');
      btn.className = 'lab-btn preset';
      btn.textContent = '示例 · ' + pset.label;
      btn.addEventListener('click', function () {
        G.level.sources.length = 0;
        pset.defs.forEach(function (d) { G.level.sources.push(JSON.parse(JSON.stringify(d))); });
        rebuildLab();
        updateHudText();
        A.sfx('gateOn');
        toast('已载入示例：' + pset.label, 'good');
      });
      el.labPresets.appendChild(btn);
    });
    const clr = document.createElement('button');
    clr.className = 'lab-btn clear';
    clr.textContent = '清空场源';
    clr.addEventListener('click', function () {
      G.level.sources.length = 0;
      rebuildLab();
      updateHudText();
      A.sfx('deny');
      toast('已清空');
    });
    el.labPresets.appendChild(clr);
    setBrush(G.brush);
  }

  function setupUI() {
    $('btn-start').addEventListener('click', function () {
      A.init(); A.sfx('ui');
      const idx = Math.min(G.progress.unlocked, FD.LEVELS.length - 1);
      startLevel(idx);
    });
    $('btn-levels').addEventListener('click', function () {
      A.sfx('ui');
      buildLevelGrid();
      G.mode = 'levels';
      showScreen('levels');
    });
    $('btn-levels-back').addEventListener('click', function () {
      A.sfx('ui');
      G.mode = 'title';
      showScreen('title');
    });
    $('btn-manual').addEventListener('click', function () { A.sfx('ui'); openManual('title'); });
    $('btn-lab').addEventListener('click', function () {
      A.init(); A.sfx('ui');
      buildLabBar();
      startLab();
    });
    $('btn-manual-close').addEventListener('click', function () { A.sfx('ui'); closeManual(); });
    $('btn-brief-back').addEventListener('click', function () {
      A.sfx('ui');
      G.mode = 'title';
      showScreen('title');
    });
    $('btn-begin').addEventListener('click', function () { A.sfx('ui'); beginPlay(); });
    $('btn-resume').addEventListener('click', function () { A.sfx('ui'); resume(); });
    $('btn-restart').addEventListener('click', function () { A.sfx('ui'); startLevel(G.levelIndex); });
    $('btn-pause-manual').addEventListener('click', function () { A.sfx('ui'); openManual('pause'); });
    $('btn-pause-title').addEventListener('click', function () {
      A.sfx('ui');
      G.mode = 'title';
      G.attractYaw = 0;
      showScreen('title');
      el.hud.classList.add('hidden');
    });
    $('btn-next').addEventListener('click', function () {
      A.sfx('ui');
      const n = Math.min(FD.LEVELS.length - 1, G.levelIndex + 1);
      startLevel(n);
    });
    $('btn-replay').addEventListener('click', function () { A.sfx('ui'); startLevel(G.levelIndex); });
    $('btn-done-title').addEventListener('click', function () {
      A.sfx('ui');
      G.mode = 'title';
      G.attractYaw = 0;
      showScreen('title');
      el.hud.classList.add('hidden');
    });
  }

  /* ---------------- 标题展示场 ---------------- */
  function buildAttract() {
    const defs = [
      { type: 'q', p: [-4.5, 2.4, -1.0], q: 16 },
      { type: 'q', p: [4.2, -2.2, 1.2], q: -13 },
      { type: 'loop', c: [0.5, 3.4, 3.2], axis: [0.2, 1, 0.15], r: 4.2, I: 0.55 }
    ];
    const lvl = { bounds: 11 };
    G.attractLevel = lvl;
    G.attractSources = new FD.Sources(defs);
    G.attractLines = FD.buildStreamlines(G.attractSources, lvl);
    G.attract = true;
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    cacheDom();
    loadProgress();
    R.init($('view'));
    buildAttract();
    setupInput();
    setupUI();
    FD.Intuition.init();
    document.addEventListener('visibilitychange', function () {
      G.keys.w = G.keys.a = G.keys.s = G.keys.d = 0;
      G.slowKey = false; G.acc = 0; lastT = performance.now();
      if (document.hidden) { A.suspend(); if (G.mode === 'play') pause(); }
      else A.resume();
    });
    if (location.search.indexOf('debug') >= 0) el.fps.classList.remove('hidden');
    el.hud.classList.add('hidden');
    showScreen('title');
    lastT = performance.now();
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* ---------------- 调试 / 测试接口 ---------------- */
  FD.gotoLevel = function (i, play) {
    if (play) {
      loadLevel(i);
      G.mode = 'play';
      el.hud.classList.remove('hidden');
      showScreen(null);
      faceLevel();
    } else startLevel(i);
  };
  FD.setProbe = function (p, v) {
    if (!G.probe) return;
    G.probe.pos = V.from(p);
    G.probe.vel = V.from(v || [0, 0, 0]);
    faceLevel();
  };
})();
