(function () {
  'use strict';
  const FD = window.FD,
    P = FD.Physics;
  const parameter = (key, label, min, max, step, value) => ({ key, label, min, max, step, value });
  FD.EXPERIMENTS = [
    {
      id: 'cyclotron',
      name: '01 · 磁场与回旋',
      group: '电磁学',
      question: '磁场增强两倍，速率和轨道半径分别怎样改变？',
      explanation:
        '磁力始终垂直于速度。保持初速时，B 加倍使半径减半，动能保持不变。翻转电荷会反转旋转方向。',
      equation: 'r = γmv⊥ / |qB|，ω = |qB| / γm，P磁 = 0',
      limits: '匀强静磁场，c=m=1，忽略辐射与粒子自场。采用相对论 Boris 积分。',
      params: [
        parameter('B', '磁场 B', 0.1, 2, 0.1, 0.6),
        parameter('speed', '初速 β', 0.1, 0.8, 0.05, 0.5),
        parameter('q', '电荷 q', -1, 1, 2, 1),
      ],
      bounds: [-5, 5, -5, 5],
      kind: 'em',
    },
    {
      id: 'selector',
      name: '02 · 速度选择器',
      group: '电磁学',
      question: '同一束粒子，哪些速度能沿直线穿过交叉电磁场？',
      explanation:
        '这里 E 沿 +y，B 沿 +z。初速度沿 +x 且 v=E/B 时两力抵消。改变电荷符号仍保留同一抵消速度，但偏离它后的弯曲方向反转。',
      equation: 'Fy = q(E − vxB)，v* = E/B',
      limits: '匀强正交场，c=m=q=1，无碰撞。默认 E/B=0.4；超出光速的抵消速度不可实现。',
      params: [
        parameter('E', '电场 E', 0, 0.8, 0.05, 0.2),
        parameter('B', '磁场 B', 0.1, 1, 0.05, 0.5),
        parameter('speed', '注入速度 β', 0.1, 0.8, 0.05, 0.4),
      ],
      bounds: [-1, 12, -5, 5],
      kind: 'em',
    },
    {
      id: 'hall',
      name: '03 · 阻力与霍耳漂移',
      group: '电磁学',
      question: '把阻力减小，最终方向是否一定沿电场？',
      explanation:
        '阻力会改变稳态速度。橙色受力箭头包含电力、磁力与阻力。漂移倾角满足 tanθ=B/k，而电磁力抵消速度只在阻力为零时可能维持。',
      equation: 'dp/dt = q(E+v×B) − kv，tanθ = qB/k',
      limits: 'c=m=q=1，E 沿 +y，B 沿 +z，阻力相对站台系定义。所设范围使稳态速率小于 c。',
      params: [
        parameter('B', '磁场 B', 0.3, 1.5, 0.1, 0.6),
        parameter('drag', '阻力 k', 0.1, 1, 0.05, 0.3),
      ],
      bounds: [-1, 12, -1, 9],
      kind: 'em',
    },
    {
      id: 'pendulum',
      name: '04 · 单摆与小角近似',
      group: '力学',
      question: '把摆角从 10° 增到 100°，周期还一样吗？',
      explanation:
        '小摆角时 sinθ≈θ，周期近似与振幅无关。大摆角的真实摆落后于虚线小角参考摆。增加摆长也会增加周期。',
      equation: 'θ̈ = −(g/L)sinθ − bθ̇，T小角 = 2π√(L/g)',
      limits: 'SI 单位，m=1 kg，g=9.81 m/s²，刚性无质量摆杆。虚线显示同初始角的小角解析解。',
      params: [
        parameter('angle', '初始角度 / °', 5, 140, 5, 70),
        parameter('length', '摆长 / m', 0.5, 3, 0.1, 2),
        parameter('drag', '阻尼 / s⁻¹', 0, 0.5, 0.05, 0),
      ],
      bounds: [-3.6, 3.6, -3.5, 1],
      kind: 'pendulum',
    },
    {
      id: 'resonance',
      name: '05 · 驱动与共振',
      group: '振动',
      question: '驱动力大小相同，为什么某些频率能激起大振幅？',
      explanation:
        '能量持续由外部驱动输入。把频率调到固有角频率 2 rad/s 附近，经过暂态后振幅通常更大；阻尼限制峰值，并使位移共振峰略向低频移动。',
      equation: 'ẍ + bẋ + 4x = cos(Ωt)，ω₀=2 rad/s',
      limits: 'SI 单位，m=1 kg，k=4 N/m，驱动力振幅 1 N。忽略弹簧质量，记录能量包含外源输入。',
      params: [
        parameter('frequency', '驱动 Ω / rad·s⁻¹', 0.3, 4, 0.1, 2),
        parameter('drag', '阻尼 b / s⁻¹', 0.05, 1, 0.05, 0.2),
      ],
      bounds: [-4, 4, -2, 2],
      kind: 'resonance',
    },
    {
      id: 'projectile',
      name: '06 · 抛体与空气阻力',
      group: '力学',
      question: '有空气阻力时，最大射程还出现在 45° 吗？',
      explanation:
        '青色轨迹包含线性阻力，虚线为同初始条件的真空抛物线。比较不同角度的落地点，观察上升下降不再对称以及机械能损失。',
      equation: 'ẍ=−bvₓ，ÿ=−g−bvᵧ',
      limits:
        'SI 单位，m=1 kg，初速 15 m/s，地面平坦。线性阻力用于教学，真实高速空气阻力通常更接近平方律。',
      params: [
        parameter('angle', '发射角 / °', 10, 80, 5, 45),
        parameter('drag', '阻力 b / s⁻¹', 0, 1, 0.05, 0.3),
      ],
      bounds: [-1, 25, -1, 13],
      kind: 'projectile',
    },
    {
      id: 'orbit',
      name: '07 · 从圆轨道到逃逸',
      group: '引力',
      question: '圆轨道速度乘 √2，轨迹会怎样变化？',
      explanation:
        '初速系数为 1 时接近圆轨道，小于 √2 且未撞击中心时是束缚轨道，大于 √2 时可逃逸。橙色引力指向中心，速度沿轨迹切线。',
      equation: 'r̈ = −GM r/|r|³，ε=v²/2−GM/r',
      limits: '无量纲 GM=1、初始半径=2。固定中心天体、忽略其他引力源，半径 0.15 内视为撞击。',
      params: [parameter('speed', '初速 / 圆轨道速度', 0.3, 1.8, 0.05, 1)],
      bounds: [-5, 5, -5, 5],
      kind: 'orbit',
    },
    {
      id: 'induction',
      name: '08 · 磁通与感应',
      group: '电磁学',
      question: '磁通达到最大时，感应电动势也最大吗？',
      explanation:
        '磁通的变化率决定电动势。磁通极值处变化率为零，过零时变化最快。电阻越小，电流和耗散功率越大，能量由改变磁通的外部装置供应。',
      equation: 'Φ=cos(2πft)，ε=−dΦ/dt，I=ε/R',
      limits: 'SI 单位，匝数×面积×磁场振幅=1 Wb。理想外源施加磁通，忽略回路自感与反作用。',
      params: [
        parameter('frequency', '频率 / Hz', 0.1, 1, 0.1, 0.3),
        parameter('resistance', '电阻 / Ω', 0.5, 5, 0.5, 2),
      ],
      bounds: [-2, 2, -2, 2],
      kind: 'induction',
    },
    {
      id: 'wave',
      name: '09 · 驻波与边界',
      group: '波动',
      question: '波腹在上下振动时，波节是否也在沿绳子移动？',
      explanation:
        '两端固定只允许整数阶驻波。第 n 阶有 n 个波腹、n−1 个内部波节；波节固定，能量在动能和弹性势能之间交换。',
      equation: 'y=sin(nπx/L)cos(nπct/L)，fₙ=nc/(2L)',
      limits: 'L=c=线密度=1，振幅单位归一化，小振幅线性波方程，无阻尼。曲线竖向夸大以便观察。',
      params: [parameter('mode', '谐波阶数 n', 1, 6, 1, 2)],
      bounds: [-0.1, 1.1, -1.5, 1.5],
      kind: 'wave',
    },
  ];

  FD.createExperiment = function (definition, values) {
    const p = Object.fromEntries(definition.params.map((item) => [item.key, item.value]));
    definition.params.forEach((item) => {
      if (Number.isFinite(values?.[item.key]))
        p[item.key] = FD.clamp(values[item.key], item.min, item.max);
    });
    const kind = definition.kind;
    const angle = ((p.angle || 0) * Math.PI) / 180;
    let s = [0, 0, 0, 0];
    if (kind === 'pendulum') s = [angle, 0];
    if (kind === 'resonance') s = [0, 0];
    if (kind === 'projectile') s = [0, 0, 15 * Math.cos(angle), 15 * Math.sin(angle)];
    if (kind === 'orbit') s = [2, 0, 0, p.speed / Math.sqrt(2)];
    if (kind === 'em') s = [0, 0, p.speed || 0, 0];
    const model = { definition, p, state: s, time: 0, ended: false, reason: '' };
    model.step = function (dt) {
      if (this.ended) return;
      const old = this.state;
      if (kind === 'em') {
        const E = { x: 0, y: definition.id === 'hall' ? 0.2 : p.E || 0, z: 0 };
        const v = P.boris(
          { x: old[2], y: old[3], z: 0 },
          E,
          { x: 0, y: 0, z: p.B },
          p.q ?? 1,
          p.drag || 0,
          { x: 0, y: 0, z: 0 },
          dt,
        );
        this.state = [old[0] + ((old[2] + v.x) * dt) / 2, old[1] + ((old[3] + v.y) * dt) / 2, v.x, v.y];
      } else if (kind === 'pendulum')
        this.state = P.rk4(old, this.time, dt, (value) => P.pendulum(value, p.length, p.drag));
      else if (kind === 'resonance')
        this.state = P.rk4(old, this.time, dt, (value, t) =>
          P.oscillator(value, t, p.drag, p.frequency),
        );
      else if (kind === 'projectile')
        this.state = P.rk4(old, this.time, dt, (value) => P.projectile(value, p.drag));
      else if (kind === 'orbit') this.state = P.rk4(old, this.time, dt, P.gravity);
      this.time += dt;
      if (kind === 'projectile' && this.state[1] < 0) {
        const fraction = old[1] / (old[1] - this.state[1]);
        this.state = old.map((value, i) => value + fraction * (this.state[i] - value));
        this.state[1] = 0;
        this.time -= dt * (1 - fraction);
        this.ended = true;
        this.reason = '已落地';
      }
      if (kind === 'orbit' && Math.hypot(this.state[0], this.state[1]) < 0.15) {
        this.ended = true;
        this.reason = '撞击中心天体';
      }
      if (this.time >= 40) {
        this.ended = true;
        this.reason = '已完成 40 秒观察';
      }
    };
    model.observe = function () {
      const s = this.state,
        t = this.time;
      let x = s[0],
        y = s[1],
        vx = s[2] || 0,
        vy = s[3] || 0,
        ax = 0,
        ay = 0,
        kinetic = 0,
        potential = 0;
      let metrics = [];
      if (kind === 'em') {
        const gamma = 1 / Math.sqrt(1 - vx * vx - vy * vy);
        const q = p.q ?? 1,
          E = definition.id === 'hall' ? 0.2 : p.E || 0;
        ax = q * vy * p.B - (p.drag || 0) * vx;
        ay = q * (E - vx * p.B) - (p.drag || 0) * vy;
        kinetic = gamma - 1;
        potential = -q * E * y;
        metrics = [
          ['速率 β', Math.hypot(vx, vy)],
          ['动能 / mc²', kinetic],
          ['电磁功率 qE·v', q * E * vy],
          ['磁力功率', 0],
        ];
      } else if (kind === 'pendulum') {
        x = p.length * Math.sin(s[0]);
        y = -p.length * Math.cos(s[0]);
        vx = p.length * s[1] * Math.cos(s[0]);
        vy = p.length * s[1] * Math.sin(s[0]);
        const alpha = P.pendulum(s, p.length, p.drag)[1];
        ax = p.length * (alpha * Math.cos(s[0]) - s[1] * s[1] * Math.sin(s[0]));
        ay = p.length * (alpha * Math.sin(s[0]) + s[1] * s[1] * Math.cos(s[0]));
        kinetic = 0.5 * p.length * p.length * s[1] * s[1];
        potential = 9.81 * p.length * (1 - Math.cos(s[0]));
        metrics = [
          ['摆角 / °', (s[0] * 180) / Math.PI],
          ['角速度 / rad·s⁻¹', s[1]],
          ['小角周期 / s', 2 * Math.PI * Math.sqrt(p.length / 9.81)],
          ['机械能 / J', kinetic + potential],
        ];
      } else if (kind === 'resonance') {
        y = 0;
        vx = s[1];
        vy = 0;
        ax = P.oscillator(s, t, p.drag, p.frequency)[1];
        kinetic = (vx * vx) / 2;
        potential = 2 * x * x;
        metrics = [
          ['位移 / m', x],
          ['速度 / m·s⁻¹', vx],
          ['驱动功率 / W', Math.cos(p.frequency * t) * vx],
          ['耗散功率 / W', p.drag * vx * vx],
        ];
      } else if (kind === 'projectile') {
        ax = -p.drag * vx;
        ay = -9.81 - p.drag * vy;
        kinetic = (vx * vx + vy * vy) / 2;
        potential = 9.81 * y;
        metrics = [
          ['水平距离 / m', x],
          ['高度 / m', y],
          ['水平速度 / m·s⁻¹', vx],
          ['机械能 / J', kinetic + potential],
        ];
      } else if (kind === 'orbit') {
        const derivative = P.gravity(s);
        ax = derivative[2];
        ay = derivative[3];
        kinetic = (vx * vx + vy * vy) / 2;
        potential = -1 / Math.hypot(x, y);
        metrics = [
          ['半径', Math.hypot(x, y)],
          ['比机械能', kinetic + potential],
          ['比角动量', x * vy - y * vx],
          ['速率', Math.hypot(vx, vy)],
        ];
      } else if (kind === 'induction') {
        const value = P.induction(t, p.frequency, p.resistance);
        metrics = [
          ['磁通 / Wb', value.flux],
          ['电动势 / V', value.emf],
          ['电流 / A', value.current],
          ['耗散功率 / W', value.power],
        ];
        kinetic = value.flux;
        potential = value.emf;
      } else {
        kinetic = (Math.pow(p.mode * Math.PI, 2) / 4) * Math.pow(Math.sin(p.mode * Math.PI * t), 2);
        potential = (Math.pow(p.mode * Math.PI, 2) / 4) * Math.pow(Math.cos(p.mode * Math.PI * t), 2);
        metrics = [
          ['频率 / Hz', p.mode / 2],
          ['内部波节数', p.mode - 1],
          ['归一化动能', kinetic],
          ['归一化总能', kinetic + potential],
        ];
      }
      return { x, y, vx, vy, ax, ay, kinetic, potential, metrics };
    };
    return model;
  };
})();
