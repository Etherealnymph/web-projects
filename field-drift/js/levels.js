/* ============================================================
   levels.js — 关卡数据
   单位：自然单位 c = 1。E、B 采用同一量纲。
   ============================================================ */
(function () {
  'use strict';
  const FD = window.FD;

  const L = [];

  /* ---------------------------------------------------------- 01 */
  L.push({
    id: 'l1',
    tag: '01',
    name: '电场之潮',
    subtitle: 'E · 匀强电场',
    bounds: 10,
    start: { p: [-8, 0, 0], v: [0, 0, 0] },
    k: 0.30,
    thrust: 0.22,
    sources: [
      { type: 'E', dir: [1, 0, 0], mag: 0.22, region: { type: 'all' } }
    ],
    seeds: [
      [-3.4, 0.2, 0.1],
      [2.0, 1.4, 0.8],
      [6.2, 3.0, 1.8]
    ],
    hazards: [],
    walls: [],
    gates: [],
    exit: { p: [8.6, 0, 0], r: 2.3 },
    par: [52, 82],
    brief: [
      '<p>一片均匀电场，方向 <b>+x</b>。你身上带着正电荷，所以场会一直把你往右推。</p>',
      '<p>注意：你<b>不是</b>沿着电场线飞的。介质有阻力，最终你会停在一个<b>终端速度</b>上——这正是下面那条方程的含义：</p>',
      '<p class="eq">dp/dt = q(E + v×B) − k·v，p=γmv</p>',
      '<p>当 dv/dt → 0，加速度为零，你就"漂"在场上。想让速度更快，只能用推进器（<kbd>W</kbd>）——那要花探针补给。</p>',
      '<p>收集三枚<b>电荷种子</b>，然后抵达右侧的绿色出口。前两枚几乎就在电场线上：松开手，让场送你去。</p>'
    ],
    goal: '收集 3 枚电荷种子 → 穿过出口',
    hint: '电场推着你走。按 W 可以用推进器加速，但会消耗探针补给。'
  });

  /* ---------------------------------------------------------- 02 */
  L.push({
    id: 'l2',
    tag: '02',
    name: '极性',
    subtitle: 'Q · 电荷符号',
    bounds: 9,
    start: { p: [0, 7.6, 0], v: [0, 0, 0] },
    k: 0.30,
    thrust: 0.22,
    sources: [
      { type: 'E', dir: [0, 1, 0], mag: 0.24, region: { type: 'all' } }
    ],
    seeds: [
      [-4.6, 3.2, 2.2],
      [4.6, 0.6, -2.6],
      [0.4, -4.2, 3.0]
    ],
    hazards: [],
    walls: [],
    gates: [],
    exit: { p: [0, -7.6, 0], r: 2.2 },
    par: [50, 82],
    brief: [
      '<p>电场垂直向上。你被压在顶部，出不去。</p>',
      '<p>按 <kbd>Q</kbd> <b>翻转电荷极性</b>。同一个电场，对负电荷的力完全反向——你会立刻失重般下落。</p>',
      '<p>力是 <b>q(E + v×B)</b>，前面那个 <b>q</b> 同时决定电场力与磁场力的方向。所以换号 = 整个洛伦兹力反向。</p>',
      '<p>出口在正下方。沿途三枚种子都在"逆着场"的那一侧：想拿到它们，你得在上升与下落之间反复换号。</p>'
    ],
    goal: '收集 3 枚电荷种子 → 抵达下方出口',
    hint: 'Q 翻转极性：正电荷被推向 +y，负电荷被推向 −y。'
  });

  /* ---------------------------------------------------------- 03 */
  L.push({
    id: 'l3',
    tag: '03',
    name: '霍耳角',
    subtitle: 'E × B · 速度被拧开',
    bounds: 10,
    start: { p: [-8, 6, 0], v: [0, 0, 0] },
    k: 0.30,
    thrust: 0.22,
    sources: [
      { type: 'E', dir: [1, 0, 0], mag: 0.16, region: { type: 'all' } },
      { type: 'B', dir: [0, 0, 1], mag: 0.30, region: { type: 'all' } }
    ],
    seeds: [
      [-2.2, 4.4, 3.6],
      [3.4, 1.0, -3.6],
      [7.2, -3.0, 2.2]
    ],
    hazards: [
      { c: [0.6, -1.4, 2.6], r: 2.2 },
      { c: [5.6, -5.2, -1.4], r: 2.0 }
    ],
    walls: [],
    gates: [],
    exit: { p: [8.4, -7.0, 0], r: 2.4 },
    par: [62, 98],
    brief: [
      '<p>现在电场 <b>+x</b> 与磁场 <b>+z</b> 同时存在，互相垂直。</p>',
      '<p>你一定会以为该往 +x 走。<b>错。</b>磁场力 <b>qv×B</b> 是横向的，会不断把你的速度从 E 方向拧开一个角度：</p>',
      '<p class="eq">tan θ<sub>H</sub> = qB / k &nbsp;→&nbsp; 本关 45°</p>',
      '<p>所以你的自然航向是 <b>+x −y</b> 的 45° 斜线。右上角的 HUD 里，<b>θ<sub>H</sub></b> 就是这个角度。</p>',
      '<p>红色的<b>场蚀区</b>恰好布在这条"高速公路"上。想安全穿过，就得用推进器离开场线。</p>'
    ],
    goal: '收集 3 枚电荷种子 → 抵达右下出口',
    hint: '磁场把你从 E 方向拧开 45°。HUD 的 θH 实时显示这个角度。'
  });

  /* ---------------------------------------------------------- 04 */
  L.push({
    id: 'l4',
    tag: '04',
    name: '静默门',
    subtitle: 'v* = E×B / B²',
    bounds: 10,
    start: { p: [0, 6.6, 0], v: [0, 0, 0] },
    k: 0.30,
    thrust: 0.22,
    sources: [
      { type: 'E', dir: [1, 0, 0], mag: 0.20, region: { type: 'all' } },
      { type: 'B', dir: [0, 0, 1], mag: 0.35, region: { type: 'all' } }
    ],
    seeds: [
      [-4.4, 7.2, 2.4],
      [4.4, 7.0, -2.4]
    ],
    hazards: [],
    walls: [
      {
        c: [0, 0, 0], n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1],
        hw: 10.2, hh: 10.2, holes: [{ c: [0, 0, 0], r: 2.6, gate: 0 }]
      }
    ],
    gates: [
      { c: [0, 0, 0], n: [0, -1, 0], r: 2.6, tol: 0.18, hold: 0.6, triggerR: 5.0 }
    ],
    exit: { p: [5.2, -6.6, 1.6], r: 2.2 },
    par: [78, 120],
    brief: [
      '<p>这道门封住了通道。它不是钥匙门，是<b>速度门</b>。</p>',
      '<p>存在一个特殊速度，让电场力与磁场力<b>恰好抵消</b>：</p>',
      '<p class="eq">q(E + v×B) = 0 &nbsp;⟹&nbsp; v* = (E×B) / B²</p>',
      '<p>以这个速度飞，电磁合力为零，但阻力仍然存在。这是 <b>E×B 漂移速度</b>。门锁检测的正是这个：</p>',
      '<p class="eq">δ = |E + v×B| / (|E| + |v×B|) &nbsp;→&nbsp; δ &lt; 0.18 才能"静默"</p>',
      '<p>先在上层收集种子，然后对着门调整速度：把 <b>δ</b> 压下去，稳定 0.6 秒，门会永久打开。</p>',
      '<p>提示：按住 <kbd>Shift</kbd> 慢动作，更容易微调。</p>'
    ],
    goal: '收集 2 枚种子 → 打开静默门 → 穿过通道',
    hint: '静默门认的是速度，不是钥匙。把 HUD 的 δ 压到 0.18 以下。'
  });

  /* ---------------------------------------------------------- 05 */
  L.push({
    id: 'l5',
    tag: '05',
    name: '不可消除',
    subtitle: 'E·B · 洛伦兹不变量',
    bounds: 11,
    start: { p: [-7.5, 0, 0], v: [0, 0, 0] },
    k: 0.30,
    thrust: 0.22,
    sources: [
      { type: 'E', dir: [0, 1, 0], mag: 0.20, region: { type: 'box', c: [5, 0, -4], h: [4.6, 5.2, 4.6] } },
      { type: 'B', dir: [0, 0, 1], mag: 0.30, region: { type: 'box', c: [5, 0, -4], h: [4.6, 5.2, 4.6] } },
      { type: 'E', dir: [0, 0.7071, 0.7071], mag: 0.21, region: { type: 'box', c: [5, 0, 4], h: [4.6, 5.2, 4.6] } },
      { type: 'B', dir: [0, 0, 1], mag: 0.30, region: { type: 'box', c: [5, 0, 4], h: [4.6, 5.2, 4.6] } }
    ],
    seeds: [
      [-6.2, 4.6, 3.4],
      [-2.0, -4.4, -2.2],
      [2.0, 5.2, 2.4]
    ],
    hazards: [],
    walls: [
      {
        c: [5, 0, 0], n: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1],
        hw: 11.2, hh: 11.2,
        holes: [
          { c: [5, 0, -4], r: 2.4, gate: 0 },
          { c: [5, 0, 4], r: 2.4, gate: 1 }
        ]
      }
    ],
    gates: [
      { c: [5, 0, -4], n: [1, 0, 0], r: 2.4, tol: 0.18, hold: 0.6, triggerR: 6.0 },
      { c: [5, 0, 4], n: [1, 0, 0], r: 2.4, tol: 0.18, hold: 0.6, triggerR: 6.0 }
    ],
    exit: { p: [9.2, 0, -7.0], r: 2.2 },
    par: [95, 150],
    brief: [
      '<p>两扇门，一个出口。只有一扇能打开。</p>',
      '<p>靠近门时，HUD 会显示<b>那扇门所在位置</b>的场。判据仍然是 δ &lt; 0.18，但这次先看 <b>E·B</b>：</p>',
      '<p class="eq">(E + v×B)·B = E·B</p>',
      '<p>只要 <b>E·B ≠ 0</b>，无论你选什么速度，平行于 B 的那部分电场都<b>消不掉</b>。这扇门永远静默不了。</p>',
      '<p>E·B 是<b>洛伦兹不变量</b>：换个参考系，它一个字都不会变。另一族不变量 |E|²−|B|² 决定 E 或 B 谁能被完全消掉。</p>',
      '<p>所以：先读数，再飞。别在不可能的门前耗尽探针补给。</p>'
    ],
    goal: '找出能静默的那扇门 → 进入出口',
    hint: 'E·B ≠ 0 的门永远打不开。先看读数，再决定走哪边。'
  });

  /* ---------------------------------------------------------- 06 */
  L.push({
    id: 'l6',
    tag: '06',
    name: '电流的两副面孔',
    subtitle: 'v×B · 局部参考系',
    bounds: 10,
    start: { p: [6.2, 0, -9.0], v: [0, 0, 0] },
    k: 0.30,
    thrust: 0.22,
    baseRegen: 0.008,
    sources: [
      { type: 'wire', a: [0, 0, -10.5], b: [0, 0, 10.5], I: 1.05 }
    ],
    seeds: [
      [6.1, -2.2, -6.6],
      [3.3, 5.6, -3.0],
      [-5.6, 3.3, 0.6],
      [-4.2, -5.0, 4.4]
    ],
    hazards: [
      { c: [0, 0, -5.0], r: 1.15 },
      { c: [0, 0, 5.0], r: 1.15 }
    ],
    walls: [],
    gates: [],
    exit: { p: [5.0, 4.4, 8.4], r: 2.2 },
    par: [95, 150],
    brief: [
      '<p>一根通电导线。它产生环形的磁场 <b>B</b>，没有电场。</p>',
      '<p>本关基础补给较低。观察磁场与局部参考系的关系：</p>',
      '<p class="eq">E′ = γ (E + v×B)</p>',
      '<p>当你以速度 v 穿过磁场，<b>在你自己的参考系里出现了一个电场</b>。游戏按下面的独立资源规则奖励运动：</p>',
      '<p class="eq">R<sub>游戏补给</sub> ∝ |v×B| · γ &nbsp;→&nbsp; <b>垂直于 B 高速飞行</b></p>',
      '<p>这是游戏资源奖励。真实发电需要外源供能并计入反作用；可到“磁通与感应”案例观察能量来源。</p>',
      '<p>顺便：站台系里你受的是<b>磁力</b>，你的参考系里受的是<b>电力</b>。按 <kbd>F</kbd> 切换看看——同一事件的场，在不同局部惯性系中有不同分量。</p>'
    ],
    goal: '收集 4 枚种子 → 抵达出口（记得充电）',
    hint: '本关基础补给较低，横向运动会获得游戏资源奖励。'
  });

  /* ---------------------------------------------------------- 07 */
  L.push({
    id: 'l7',
    tag: '07',
    name: '统一',
    subtitle: '综合 · 最后一道门',
    bounds: 12,
    start: { p: [-9, 3, 0], v: [0, 0, 0] },
    k: 0.30,
    thrust: 0.22,
    baseRegen: 0.034,
    sources: [
      { type: 'E', dir: [0, 1, 0], mag: 0.18, region: { type: 'all' } },
      { type: 'B', dir: [0, 0, 1], mag: 0.30, region: { type: 'all' } }
    ],
    seeds: [
      [-7.2, 6.2, 4.2],
      [-3.2, -5.2, -6.2],
      [4.2, 4.4, -6.0],
      [9.0, -3.4, 4.2]
    ],
    hazards: [
      { c: [-3.0, 6.4, 4.6], r: 2.1 },
      { c: [6.5, 7.2, -5.0], r: 2.3 },
      { c: [6.5, -7.2, 5.0], r: 2.3 }
    ],
    walls: [
      {
        c: [0, 0, 0], n: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1],
        hw: 12.2, hh: 12.2, holes: [{ c: [0, 0, 0], r: 2.6, gate: 0 }]
      }
    ],
    gates: [
      { c: [0, 0, 0], n: [1, 0, 0], r: 2.6, tol: 0.13, hold: 0.8, triggerR: 4.2 }
    ],
    exit: { p: [10.6, 0, 6.4], r: 2.2 },
    par: [115, 175],
    brief: [
      '<p>最后一道门：<b>E ⊥ B</b>，δ 必须压到 <b>0.13</b> 以下并保持 <b>0.8 秒</b>，触发范围只有 4.2。</p>',
      '<p>门的另一侧有三片场蚀区和一个出口。没有捷径，你必须真的会把速度调到 <b>v* = E×B/B²</b>。</p>',
      '<p>顺便，这一整片空间里飞行也会给你充能（独立于物理动能的游戏资源奖励），但速度不够就充不回来。</p>',
      '<p>记住：<b>磁场不改变你的速率，只改变你的方向；而你要控制的，正是方向。</b></p>'
    ],
    goal: '收集 4 枚种子 → 打开静默门 → 抵达出口',
    hint: '这一关的门要求更严。用慢动作把 δ 压到 0.13 以下。'
  });

  FD.LEVELS = L;

  /* ==========================================================
     实验室：可编辑的场空间
     ========================================================== */
  FD.LAB = {
    id: 'lab',
    tag: 'LAB',
    name: '场实验室',
    subtitle: '放置场源 · 观察场与势',
    bounds: 12,
    start: { p: [0, 2, 11], v: [0, 0, 0] },
    k: 0.30,
    thrust: 0.22,
    baseRegen: 0.12,
    sources: [],
    seeds: [],
    hazards: [],
    walls: [],
    gates: [],
    exit: null,
    par: [0, 0],
    brief: [],
    goal: '自由编辑'
  };

  const Br = [];
  Br.push({ key: 'q+', label: '点电荷 ⊕', short: '＋' });
  Br.push({ key: 'q-', label: '点电荷 ⊖', short: '－' });
  Br.push({ key: 'dipoleE', label: '电偶极子', short: '↔' });
  Br.push({ key: 'lineQ', label: '线电荷', short: '│' });
  Br.push({ key: 'sheetQ', label: '带电面', short: '▭' });
  Br.push({ key: 'cylQ', label: '带电柱', short: '▮' });
  Br.push({ key: 'wire', label: '线电流', short: '⟋' });
  Br.push({ key: 'sheetI', label: '面电流', short: '▤' });
  Br.push({ key: 'solenoid', label: '螺线管', short: '◎' });
  Br.push({ key: 'cylI', label: '柱电流', short: '◍' });
  Br.push({ key: 'dipoleB', label: '磁偶极子', short: '⊙' });
  Br.push({ key: 'Efield', label: '匀强电场区', short: 'E' });
  Br.push({ key: 'Bfield', label: '匀强磁场区', short: 'B' });
  FD.BRUSHES = Br;

  FD.sourceFromBrush = function (key, p, axis, scale) {
    const V = FD.V, s = scale || 1;
    const a = V.norm(axis);
    const u = V.perp(a);
    const L = 9;
    const a0 = { x: p.x - a.x * L * 0.5, y: p.y - a.y * L * 0.5, z: p.z - a.z * L * 0.5 };
    const a1 = { x: p.x + a.x * L * 0.5, y: p.y + a.y * L * 0.5, z: p.z + a.z * L * 0.5 };
    const P = [p.x, p.y, p.z], A = [a.x, a.y, a.z], U = [u.x, u.y, u.z];
    switch (key) {
      case 'q+': return { type: 'q', p: P, q: 7 * s };
      case 'q-': return { type: 'q', p: P, q: -7 * s };
      case 'dipoleE': return { type: 'dipoleE', p: P, m: [a.x * 9 * s, a.y * 9 * s, a.z * 9 * s] };
      case 'dipoleB': return { type: 'dipoleB', p: P, m: [a.x * 10 * s, a.y * 10 * s, a.z * 10 * s] };
      case 'lineQ': return { type: 'lineQ', a: [a0.x, a0.y, a0.z], b: [a1.x, a1.y, a1.z], lambda: 1.1 * s };
      case 'cylQ': return { type: 'cylQ', a: [a0.x, a0.y, a0.z], b: [a1.x, a1.y, a1.z], r: 1.5, rho: 0.45 * s };
      case 'wire': return { type: 'wire', a: [a0.x, a0.y, a0.z], b: [a1.x, a1.y, a1.z], I: 1.0 * s };
      case 'sheetQ': return { type: 'sheetQ', c: P, n: A, u: U, hw: 4.2, hh: 4.2, sigma: 0.18 * s };
      case 'sheetI': return { type: 'sheetI', c: P, n: A, u: U, hw: 4.2, hh: 4.2, K: 0.18 * s };
      case 'solenoid': return { type: 'solenoid', c: P, axis: A, r: 1.9, L: 7.5, N: 7, I: 0.9 * s };
      case 'cylI': return { type: 'cylI', a: [a0.x, a0.y, a0.z], b: [a1.x, a1.y, a1.z], r: 1.4, I: 1.2 * s };
      case 'Efield': return { type: 'E', dir: A, mag: 0.20 * s, region: { type: 'box', c: P, h: [4.2, 4.2, 4.2] } };
      case 'Bfield': return { type: 'B', dir: A, mag: 0.30 * s, region: { type: 'box', c: P, h: [4.2, 4.2, 4.2] } };
    }
    return null;
  };

  FD.LAB_PRESETS = {
    dipole: {
      label: '电偶极子',
      defs: [
        { type: 'q', p: [-2.2, 0, 0], q: 9 },
        { type: 'q', p: [2.2, 0, 0], q: -9 }
      ]
    },
    capacitor: {
      label: '平行板',
      defs: [
        { type: 'sheetQ', c: [-3.4, 0, 0], n: [1, 0, 0], u: [0, 1, 0], hw: 4, hh: 4, sigma: 0.08 },
        { type: 'sheetQ', c: [3.4, 0, 0], n: [1, 0, 0], u: [0, 1, 0], hw: 4, hh: 4, sigma: -0.08 }
      ]
    },
    solenoid: {
      label: '螺线管',
      defs: [
        { type: 'solenoid', c: [0, 0, 0], axis: [0, 0, 1], r: 2.4, L: 8, N: 8, I: 1.0 }
      ]
    },
    wire: {
      label: '直导线',
      defs: [
        { type: 'wire', a: [0, -9, 0], b: [0, 9, 0], I: 1.4 }
      ]
    },
    quad: {
      label: '四极场',
      defs: [
        { type: 'q', p: [3.2, 3.2, 0], q: 7 },
        { type: 'q', p: [-3.2, -3.2, 0], q: 7 },
        { type: 'q', p: [-3.2, 3.2, 0], q: -7 },
        { type: 'q', p: [3.2, -3.2, 0], q: -7 }
      ]
    }
  };
})();
