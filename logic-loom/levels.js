import {
  alu,
  decode,
  validateGraph,
  validateModules,
  primitiveTypes,
  createRuntime,
  simulate,
  tick,
  assemble,
} from './engine.js';
const bit = (key, width = 1) => ({ key, width });
const base = ['IN', 'OUT', 'CONST', 'NAND'];
const gates = [...base, 'NOT', 'AND', 'OR', 'XOR'];
const buses = [
  ...gates,
  'FA',
  'MUX1',
  'SPLIT8',
  'JOIN8',
  'SPLIT2',
  'SPLIT3',
  'SPLIT4',
  'JOIN3',
  'JOIN4',
  'NOT8',
  'AND8',
  'OR8',
  'XOR8',
  'ADD8',
  'SUB8',
  'MUX8',
  'SHL8',
  'SHR8',
  'ZERO8',
];
class Builder {
  constructor(level) {
    this.graph = { nodes: [], wires: [] };
    this.inputs = {};
    this.outputs = {};
    this.i = 0;
    this.col = 0;
    for (const [i, p] of level.inputs.entries())
      this.inputs[p.key] = this.add('IN', 55, 75 + i * 85, { key: p.key, width: p.width });
    for (const [i, p] of level.outputs.entries())
      this.outputs[p.key] = this.add('OUT', 1120, 90 + i * 85, { key: p.key, width: p.width });
  }
  add(type, x, y, cfg = {}) {
    const id = 'n' + ++this.i;
    this.graph.nodes.push({ id, type, x, y, cfg });
    return id;
  }
  at(id, port = 'Y') {
    return { node: id, port };
  }
  in(key) {
    return this.at(this.inputs[key]);
  }
  wire(from, to, port) {
    this.graph.wires.push({ id: 'w' + (this.graph.wires.length + 1), from, to: { node: to, port } });
  }
  gate(type, ins = {}, x, y) {
    const i = this.col++;
    const id = this.add(type, x ?? 300 + (i % 4) * 185, y ?? 90 + Math.floor(i / 4) * 150);
    for (const [p, v] of Object.entries(ins)) this.wire(v, id, p);
    return this.at(id);
  }
  constant(value, width = 1, x = 260, y = 570) {
    return this.at(this.add('CONST', x, y, { value, width }));
  }
  out(key, source) {
    this.wire(source, this.outputs[key], 'A');
  }
}
const exhaustive = (n) =>
  Array.from({ length: 2 ** n }, (_, v) => Array.from({ length: n }, (_, i) => (v >> i) & 1));
const vectors = (keys) =>
  exhaustive(keys.length).map((v) => Object.fromEntries(keys.map((k, i) => [k, v[i]])));
const bytePairs = () => {
  const a = [0, 1, 2, 7, 15, 63, 127, 128, 254, 255],
    out = [];
  for (const A of a) for (const B of a) out.push({ A, B });
  for (let i = 0; i < 256; i++) out.push({ A: i, B: (i * 73 + 29) & 255 });
  return out;
};
const seqTrace = (steps) => ({ kind: 'sequence', steps });
function sequentialCases(kind) {
  if (kind === 'bit' || kind === 'reg') {
    const max = kind === 'bit' ? 1 : 255,
      steps = [],
      state = { q: 0 };
    for (let i = 0; i < 48; i++) {
      const D = (i * 53 + 7) & max,
        EN = +(i % 3 !== 0),
        RST = +(i % 11 === 0);
      state.q = RST ? 0 : EN ? D : state.q;
      steps.push({ inputs: { D, EN, RST }, expected: { Q: state.q } });
    }
    return [seqTrace(steps)];
  }
  if (kind === 'count') {
    let q = 0;
    return [
      seqTrace(
        Array.from({ length: 288 }, (_, i) => {
          const inputs = { EN: +(i % 13 !== 0), RST: +(i === 0 || i === 281) };
          q = inputs.RST ? 0 : inputs.EN ? (q + 1) & 255 : q;
          return { inputs, expected: { Q: q } };
        }),
      ),
    ];
  }
  if (kind === 'pc') {
    let q = 0;
    return [
      seqTrace(
        Array.from({ length: 300 }, (_, i) => {
          const inputs = {
            TARGET: (i * 17) & 255,
            JMP: +(i === 5 || i === 270),
            JZ: +(i % 17 === 0),
            Z: +(i % 3 === 0),
            HALT: +(i % 19 === 0),
          };
          if (!inputs.HALT) q = inputs.JMP || (inputs.JZ && inputs.Z) ? inputs.TARGET : (q + 1) & 255;
          return { inputs, expected: { PC: q } };
        }),
      ),
    ];
  }
}
export const DEFAULT_PROGRAM = `; 累加器 A 从 0 开始。分号后是注释。
MOVI 3
STORE 40
loop:
SUBI 1
JZ done
JMP loop
done:
ADDI 9
STORE 41
HALT`;
export const CPU_PROGRAMS = [
  { name: '加法与存储', source: 'MOVI 5\nADDI 7\nSTORE 20\nHALT', acc: 12, memory: { 20: 12 } },
  { name: '条件跳转与循环', source: DEFAULT_PROGRAM, acc: 9, memory: { 40: 3, 41: 9 } },
  {
    name: '访存与异或',
    source: 'MOVI 42\nSTORE 64\nMOVI 0\nLOAD 64\nXORI 15\nSTORE 65\nHALT',
    acc: 37,
    memory: { 64: 42, 65: 37 },
  },
  {
    name: '8 位回绕与逻辑',
    source: 'MOVI 255\nADDI 2\nSUBI 3\nANDI 15\nSTORE 90\nHALT',
    acc: 14,
    memory: { 90: 14 },
  },
];
const defs = [
  {
    id: '01',
    chapter: '火花',
    name: '让信号走一程',
    subtitle: '连接 · 输入与输出',
    inputs: [bit('A')],
    outputs: [bit('Y')],
    allowed: base,
    brief:
      '把输入 A 的信号送到输出 Y。点击一个输出圆点，再点击输入圆点，即可连接。输入可扇出，输入端口只能有一个驱动源。',
    hint: '从 A 元件右侧的 Y 圆点，连接到 Y 元件左侧的 A 圆点。',
    cases: () => vectors(['A']),
    expect: (a) => ({ Y: a.A }),
    solve: (b) => b.out('Y', b.in('A')),
  },
  {
    id: '02',
    chapter: '火花',
    name: '翻转一位',
    subtitle: 'NAND · 非门',
    inputs: [bit('A')],
    outputs: [bit('Y')],
    allowed: base,
    brief: '只有一种原料：与非门。让 A=0 时 Y=1，A=1 时 Y=0。',
    hint: '把同一个 A 同时接到 NAND 的两个输入。',
    cases: () => vectors(['A']),
    expect: (a) => ({ Y: 1 - a.A }),
    solve: (b) => b.out('Y', b.gate('NAND', { A: b.in('A'), B: b.in('A') })),
    reward: 'NOT',
  },
  {
    id: '03',
    chapter: '火花',
    name: '两把钥匙',
    subtitle: 'NAND · 与门',
    inputs: [bit('A'), bit('B')],
    outputs: [bit('Y')],
    allowed: base,
    brief: '只有 A 与 B 同时为 1，Y 才能为 1。继续只使用 NAND。',
    hint: '第一个 NAND 求出与的反相；第二个 NAND 把它再反相。',
    cases: () => vectors(['A', 'B']),
    expect: (a) => ({ Y: a.A & a.B }),
    solve: (b) => {
      const n = b.gate('NAND', { A: b.in('A'), B: b.in('B') });
      b.out('Y', b.gate('NAND', { A: n, B: n }));
    },
    reward: 'AND',
  },
  {
    id: '04',
    chapter: '火花',
    name: '任意一束光',
    subtitle: '德摩根 · 或门',
    inputs: [bit('A'), bit('B')],
    outputs: [bit('Y')],
    allowed: [...base, 'NOT', 'AND'],
    brief: '只要有一个输入为 1，输出就为 1。用反相与 NAND 组合出 OR。',
    hint: 'A、B 各反相一次，再连接到 NAND。',
    cases: () => vectors(['A', 'B']),
    expect: (a) => ({ Y: a.A | a.B }),
    solve: (b) =>
      b.out(
        'Y',
        b.gate('NAND', { A: b.gate('NOT', { A: b.in('A') }), B: b.gate('NOT', { A: b.in('B') }) }),
      ),
    reward: 'OR',
  },
  {
    id: '05',
    chapter: '火花',
    name: '相异时亮起',
    subtitle: '组合逻辑 · 异或门',
    inputs: [bit('A'), bit('B')],
    outputs: [bit('Y')],
    allowed: [...base, 'NOT', 'AND', 'OR'],
    brief: '两个输入不同才亮起。相同的输入，无论是 00 还是 11，都输出 0。',
    hint: '(A OR B) AND NOT(A AND B)。',
    cases: () => vectors(['A', 'B']),
    expect: (a) => ({ Y: a.A ^ a.B }),
    solve: (b) => {
      const either = b.gate('OR', { A: b.in('A'), B: b.in('B') }),
        both = b.gate('AND', { A: b.in('A'), B: b.in('B') }),
        not = b.gate('NOT', { A: both });
      b.out('Y', b.gate('AND', { A: either, B: not }));
    },
    reward: 'XOR',
  },
  {
    id: '06',
    chapter: '算术',
    name: '一位，也会进位',
    subtitle: '半加器 · 两个输出',
    inputs: [bit('A'), bit('B')],
    outputs: [bit('SUM'), bit('CARRY')],
    allowed: gates,
    brief: '计算两个比特的和。SUM 是低位，CARRY 是进位。1+1 应当得到二进制 10。',
    hint: 'SUM 是异或；CARRY 是与。',
    cases: () => vectors(['A', 'B']),
    expect: (a) => ({ SUM: (a.A + a.B) & 1, CARRY: (a.A + a.B) >> 1 }),
    solve: (b) => {
      b.out('SUM', b.gate('XOR', { A: b.in('A'), B: b.in('B') }));
      b.out('CARRY', b.gate('AND', { A: b.in('A'), B: b.in('B') }));
    },
  },
  {
    id: '07',
    chapter: '算术',
    name: '把进位交下去',
    subtitle: '全加器 · 三个输入',
    inputs: [bit('A'), bit('B'), bit('C')],
    outputs: [bit('SUM'), bit('CARRY')],
    allowed: gates,
    brief: '加上来自上一位的进位 C。这是长整数加法中会反复使用的一小块。',
    hint: '先做 A+B，再加 C；把两次半加的进位 OR 起来。',
    cases: () => vectors(['A', 'B', 'C']),
    expect: (a) => ({ SUM: (a.A + a.B + a.C) & 1, CARRY: (a.A + a.B + a.C) >> 1 }),
    solve: (b) => {
      const x = b.gate('XOR', { A: b.in('A'), B: b.in('B') });
      b.out('SUM', b.gate('XOR', { A: x, B: b.in('C') }));
      b.out(
        'CARRY',
        b.gate('OR', {
          A: b.gate('AND', { A: b.in('A'), B: b.in('B') }),
          B: b.gate('AND', { A: x, B: b.in('C') }),
        }),
      );
    },
    reward: 'FA',
  },
  {
    id: '08',
    chapter: '算术',
    name: '一条路，两种选择',
    subtitle: '选择器 · MUX',
    inputs: [bit('A'), bit('B'), bit('S')],
    outputs: [bit('Y')],
    allowed: [...gates, 'FA'],
    brief: 'S=0 时传递 A；S=1 时传递 B。选择信号控制数据走哪条路。',
    hint: '(A AND NOT S) OR (B AND S)。',
    cases: () => vectors(['A', 'B', 'S']),
    expect: (a) => ({ Y: a.S ? a.B : a.A }),
    solve: (b) =>
      b.out(
        'Y',
        b.gate('OR', {
          A: b.gate('AND', { A: b.in('A'), B: b.gate('NOT', { A: b.in('S') }) }),
          B: b.gate('AND', { A: b.in('B'), B: b.in('S') }),
        }),
      ),
    reward: 'MUX1',
  },
  {
    id: '09',
    chapter: '算术',
    name: '信号分流站',
    subtitle: '分配器 · DEMUX',
    inputs: [bit('D'), bit('S')],
    outputs: [bit('LEFT'), bit('RIGHT')],
    allowed: [...gates, 'FA', 'MUX1'],
    brief: 'S=0 把 D 送到 LEFT；S=1 把 D 送到 RIGHT。另一条输出保持 0。',
    hint: 'LEFT=D AND NOT S；RIGHT=D AND S。',
    cases: () => vectors(['D', 'S']),
    expect: (a) => ({ LEFT: a.D & (1 - a.S), RIGHT: a.D & a.S }),
    solve: (b) => {
      b.out('LEFT', b.gate('AND', { A: b.in('D'), B: b.gate('NOT', { A: b.in('S') }) }));
      b.out('RIGHT', b.gate('AND', { A: b.in('D'), B: b.in('S') }));
    },
  },
  {
    id: '10',
    chapter: '算术',
    name: '奇数个火花',
    subtitle: '校验 · 三位奇偶性',
    inputs: [bit('A'), bit('B'), bit('C')],
    outputs: [bit('ODD')],
    allowed: [...gates, 'FA', 'MUX1'],
    brief: '当三位输入中有奇数个 1 时，ODD=1。你也可以把这块电路封装到芯片库。',
    hint: '把两个 XOR 串接。',
    cases: () => vectors(['A', 'B', 'C']),
    expect: (a) => ({ ODD: a.A ^ a.B ^ a.C }),
    solve: (b) =>
      b.out('ODD', b.gate('XOR', { A: b.gate('XOR', { A: b.in('A'), B: b.in('B') }), B: b.in('C') })),
  },
  {
    id: '11',
    chapter: '总线',
    name: '八条线，一个字节',
    subtitle: '拆线与合线 · 8 位反相',
    inputs: [bit('A', 8)],
    outputs: [bit('Y', 8)],
    allowed: [...gates, 'FA', 'MUX1', 'SPLIT8', 'JOIN8'],
    brief:
      '总线是多根信号线的集合。拆成 b0–b7（b0 为最低位），分别反相，再合成字节。完成后解锁逐位总线逻辑。',
    hint: 'SPLIT8 → 八个 NOT → JOIN8，位序保持一致。',
    cases: () => Array.from({ length: 256 }, (_, A) => ({ A })),
    expect: (a) => ({ Y: ~a.A & 255 }),
    solve: (b) => {
      const s = b.gate('SPLIT8', { A: b.in('A') }, 280, 80),
        join = b.add('JOIN8', 880, 80, {});
      for (let i = 0; i < 8; i++) {
        const n = b.gate(
          'NOT',
          { A: b.at(s.node, 'b' + i) },
          530 + (i % 2) * 160,
          45 + Math.floor(i / 2) * 135,
        );
        b.wire(n, join, 'b' + i);
      }
      b.out('Y', b.at(join));
    },
    reward: '总线逻辑',
  },
  {
    id: '12',
    chapter: '总线',
    name: '进位的涟漪',
    subtitle: '8 位加法 · Ripple carry',
    inputs: [bit('A', 8), bit('B', 8)],
    outputs: [bit('Y', 8), bit('CARRY')],
    allowed: [...gates, 'FA', 'MUX1', 'SPLIT8', 'JOIN8'],
    brief: '把八个全加器首尾相接。最低位进位为 0，最高位进位送到 CARRY。结果对 256 取模。',
    hint: '每个 FA 的 C 输出，接到下一位 FA 的 C 输入。',
    cases: bytePairs,
    expect: (a) => ({ Y: (a.A + a.B) & 255, CARRY: +(a.A + a.B > 255) }),
    coverage: '356 组边界与确定性回归',
    solve: (b) => {
      const a = b.gate('SPLIT8', { A: b.in('A') }, 270, 60),
        c = b.gate('SPLIT8', { A: b.in('B') }, 270, 460);
      let carry = b.constant(0, 1, 430, 600);
      const join = b.add('JOIN8', 1800, 80, {});
      for (let i = 0; i < 8; i++) {
        const f = b.gate(
          'FA',
          { A: b.at(a.node, 'b' + i), B: b.at(c.node, 'b' + i), C: carry },
          500 + i * 155,
          130 + (i % 2) * 210,
        );
        b.wire(b.at(f.node, 'S'), join, 'b' + i);
        carry = b.at(f.node, 'C');
      }
      b.graph.nodes.find((n) => n.id === b.outputs.Y).x = 2010;
      b.graph.nodes.find((n) => n.id === b.outputs.CARRY).x = 2010;
      b.out('Y', b.at(join));
      b.out('CARRY', carry);
    },
    reward: 'ADD8 / SUB8',
  },
  {
    id: '13',
    chapter: '总线',
    name: '为字节选路',
    subtitle: '8 位选择器',
    inputs: [bit('A', 8), bit('B', 8), bit('S')],
    outputs: [bit('Y', 8)],
    allowed: [...gates, 'FA', 'MUX1', 'SPLIT8', 'JOIN8', 'NOT8', 'AND8', 'OR8', 'XOR8', 'ADD8', 'SUB8'],
    brief: '用同一个 S，控制 8 个单比特选择器。所有位一起选择同一个字节。',
    hint: '两条输入总线分别拆线；八个 MUX1 共享 S；最后按位合线。',
    cases: () =>
      bytePairs().flatMap((v) => [
        { ...v, S: 0 },
        { ...v, S: 1 },
      ]),
    expect: (a) => ({ Y: a.S ? a.B : a.A }),
    coverage: '712 组边界与确定性回归',
    solve: (b) => {
      const a = b.gate('SPLIT8', { A: b.in('A') }, 270, 30),
        c = b.gate('SPLIT8', { A: b.in('B') }, 270, 430),
        join = b.add('JOIN8', 950, 80, {});
      for (let i = 0; i < 8; i++) {
        const m = b.gate(
          'MUX1',
          { A: b.at(a.node, 'b' + i), B: b.at(c.node, 'b' + i), S: b.in('S') },
          500 + (i % 2) * 190,
          30 + Math.floor(i / 2) * 165,
        );
        b.wire(m, join, 'b' + i);
      }
      b.out('Y', b.at(join));
    },
    reward: 'MUX8',
  },
  {
    id: '14',
    chapter: '记忆',
    name: '留住一拍',
    subtitle: 'D 触发器 · 时钟边沿',
    inputs: [bit('D'), bit('EN'), bit('RST')],
    outputs: [bit('Q')],
    allowed: [...buses, 'DFF'],
    brief:
      '触发器是新的物理原料。上升沿才采样：RST=1 清零；否则 EN=1 记住 D；EN=0 保持。清零优先于使能。',
    hint: '三个控制输入接到 DFF 同名端口，Q 接输出。改变 D 后，点击“时钟 +1”才会更新 Q。',
    sequential: 'bit',
    solve: (b) => {
      const d = b.gate('DFF', { D: b.in('D'), EN: b.in('EN'), RST: b.in('RST') });
      b.out('Q', b.at(d.node, 'Q'));
    },
  },
  {
    id: '15',
    chapter: '记忆',
    name: '一排记忆',
    subtitle: '8 位寄存器',
    inputs: [bit('D', 8), bit('EN'), bit('RST')],
    outputs: [bit('Q', 8)],
    allowed: [...buses, 'DFF'],
    brief: '八个触发器共享使能和复位，构成一个 8 位寄存器。每次边沿同时写入八位。',
    hint: '拆开 D，逐位接到八个 DFF，EN 与 RST 扇出到全部触发器。',
    sequential: 'reg',
    solve: (b) => {
      const split = b.gate('SPLIT8', { A: b.in('D') }, 280, 50),
        join = b.add('JOIN8', 970, 80, {});
      for (let i = 0; i < 8; i++) {
        const f = b.gate(
          'DFF',
          { D: b.at(split.node, 'b' + i), EN: b.in('EN'), RST: b.in('RST') },
          510 + (i % 2) * 190,
          30 + Math.floor(i / 2) * 170,
        );
        b.wire(b.at(f.node, 'Q'), join, 'b' + i);
      }
      b.out('Q', b.at(join));
    },
    reward: 'REG8',
  },
  {
    id: '16',
    chapter: '记忆',
    name: '数到下一个黎明',
    subtitle: '计数器 · 安全的反馈',
    inputs: [bit('EN'), bit('RST')],
    outputs: [bit('Q', 8)],
    allowed: [...buses, 'DFF', 'REG8'],
    brief: 'EN=1 时每拍加一；EN=0 保持；RST=1 清零。255 的下一拍回到 0。反馈回路必须经过寄存器。',
    hint: 'REG8.Q + 常量 1 → REG8.D。常量的位宽设为 8。',
    sequential: 'count',
    solve: (b) => {
      const reg = b.add('REG8', 620, 180, {}),
        sum = b.gate('ADD8', { A: b.at(reg, 'Q'), B: b.constant(1, 8, 290, 430) }, 370, 200);
      b.wire(sum, reg, 'D');
      b.wire(b.in('EN'), reg, 'EN');
      b.wire(b.in('RST'), reg, 'RST');
      b.out('Q', b.at(reg, 'Q'));
    },
  },
  {
    id: '17',
    chapter: '处理器',
    name: '计算的心脏',
    subtitle: 'ALU · 八种运算',
    inputs: [bit('A', 8), bit('B', 8), bit('OP', 3)],
    outputs: [bit('Y', 8), bit('ZERO')],
    allowed: [...buses, 'DFF', 'REG8'],
    brief:
      'OP 从 0 到 7 分别选择：加、减、与、或、异或、A 左移、A 右移、B 直通。ZERO 在 Y=0 时为 1。所有结果保留低 8 位。',
    hint: '计算八个候选值；用七个 MUX8 建三层选择树，依次由 OP 的 b0、b1、b2 选择。',
    cases: () => bytePairs().flatMap((a) => Array.from({ length: 8 }, (_, OP) => ({ ...a, OP }))),
    expect: (a) => {
      const Y = alu(a.A, a.B, a.OP);
      return { Y, ZERO: +(Y === 0) };
    },
    coverage: '2848 组边界与确定性回归',
    solve: (b) => {
      const sel = b.gate('SPLIT3', { A: b.in('OP') }, 270, 650);
      let terms = ['ADD8', 'SUB8', 'AND8', 'OR8', 'XOR8', 'SHL8', 'SHR8'].map((type, i) =>
        b.gate(
          type,
          { A: b.in('A'), ...(!['SHL8', 'SHR8'].includes(type) ? { B: b.in('B') } : {}) },
          310 + (i % 2) * 170,
          30 + Math.floor(i / 2) * 155,
        ),
      );
      terms.push(b.in('B'));
      for (let layer = 0; layer < 3; layer++) {
        const next = [];
        for (let i = 0; i < terms.length; i += 2)
          next.push(
            b.gate(
              'MUX8',
              { A: terms[i], B: terms[i + 1], S: b.at(sel.node, 'b' + layer) },
              680 + layer * 180,
              60 + (i / 2) * 165,
            ),
          );
        terms = next;
      }
      b.graph.nodes.find((n) => n.id === b.outputs.Y).x = 1460;
      b.graph.nodes.find((n) => n.id === b.outputs.ZERO).x = 1460;
      b.out('Y', terms[0]);
      b.out('ZERO', b.at(b.gate('ZERO8', { A: terms[0] }, 1250, 300).node, 'Z'));
    },
    reward: 'ALU8',
  },
  {
    id: '18',
    chapter: '处理器',
    name: '指向下一步',
    subtitle: '程序计数器 · 跳转与暂停',
    inputs: [bit('TARGET', 8), bit('JMP'), bit('JZ'), bit('Z'), bit('HALT')],
    outputs: [bit('PC', 8)],
    allowed: [...buses, 'DFF', 'REG8', 'ALU8'],
    brief:
      '通常每拍 PC+1。JMP=1 或 JZ=1 且 Z=1 时跳到 TARGET。HALT=1 时保持，优先于跳转。初始 PC 为 0。',
    hint: '用选择器选择 PC+1 或 TARGET；寄存器 EN 接 NOT HALT，RST 接 0。',
    sequential: 'pc',
    solve: (b) => {
      const reg = b.add('REG8', 850, 180, {}),
        sum = b.gate('ADD8', { A: b.at(reg, 'Q'), B: b.constant(1, 8, 300, 650) }, 360, 180),
        sel = b.gate(
          'OR',
          { A: b.in('JMP'), B: b.gate('AND', { A: b.in('JZ'), B: b.in('Z') }, 350, 430) },
          550,
          430,
        ),
        mux = b.gate('MUX8', { A: sum, B: b.in('TARGET'), S: sel }, 640, 170);
      b.wire(mux, reg, 'D');
      b.wire(b.gate('NOT', { A: b.in('HALT') }, 640, 600), reg, 'EN');
      b.wire(b.constant(0, 1, 840, 600), reg, 'RST');
      b.out('PC', b.at(reg, 'Q'));
    },
    reward: 'PC8',
  },
  {
    id: '19',
    chapter: '处理器',
    name: '听懂一条指令',
    subtitle: '译码 · 控制信号',
    inputs: [bit('CODE', 4)],
    outputs: [bit('OP', 3), bit('WE'), bit('JMP'), bit('JZ'), bit('STORE'), bit('LOAD'), bit('HALT')],
    allowed: [...buses, 'EQ4', 'DFF', 'REG8', 'ALU8', 'PC8'],
    brief:
      '将 4 位操作码译成控制信号。1:MOVI，2:ADDI，3:SUBI，4:ANDI，5:XORI，6:JMP，7:JZ，8:STORE，9:LOAD，15:HALT；其他码全部输出 0。OP 选择 ALU 运算，WE 允许写累加器。',
    hint: 'EQ4 比较 CODE 与常量，得到各指令选择线。WE=1/2/3/4/5/9；OP 三个位分别 OR(1,3,9)、OR(1,4,9)、OR(1,5,9)。',
    cases: () => Array.from({ length: 16 }, (_, CODE) => ({ CODE })),
    expect: (a) => decode(a.CODE),
    solve: (b) => {
      const eq = {};
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 15].forEach((v, i) => {
        eq[v] = b.gate(
          'EQ4',
          { A: b.in('CODE'), B: b.constant(v, 4, 260 + (i % 2) * 340, 30 + Math.floor(i / 2) * 170) },
          420 + (i % 2) * 340,
          30 + Math.floor(i / 2) * 170,
        );
      });
      const or = (arr, x, y) =>
        arr.reduce((acc, v, i) => (i ? b.gate('OR', { A: acc, B: v }, x + i * 155, y) : v));
      const join = b.add('JOIN3', 1770, 70, {});
      [
        [1, 3, 9],
        [1, 4, 9],
        [1, 5, 9],
      ].forEach((a, i) =>
        b.wire(
          or(
            a.map((v) => eq[v]),
            1040,
            45 + i * 145,
          ),
          join,
          'b' + i,
        ),
      );
      b.out('OP', b.at(join));
      b.out(
        'WE',
        or(
          [1, 2, 3, 4, 5, 9].map((v) => eq[v]),
          950,
          560,
        ),
      );
      for (const [key, v] of Object.entries({ JMP: 6, JZ: 7, STORE: 8, LOAD: 9, HALT: 15 }))
        b.out(key, eq[v]);
      for (const id of Object.values(b.outputs)) b.graph.nodes.find((n) => n.id === id).x = 2070;
    },
    reward: 'DECODE / ROM / RAM',
  },
  {
    id: '20',
    chapter: '处理器',
    name: '你的第一颗处理器',
    subtitle: 'LL-8 · 从电路到程序',
    inputs: [],
    outputs: [bit('ACC', 8), bit('PC', 8)],
    allowed: [...buses, 'EQ4', 'DFF', 'REG8', 'ALU8', 'PC8', 'ROM', 'DECODE', 'RAM8'],
    brief:
      '用已经解锁的模块连接一颗 8 位累加器 CPU。ROM 由 PC 寻址；译码驱动 ALU、累加器和 RAM；ZERO 必须检测累加器。通过四段实际程序回归后，旅程完成。',
    hint: 'ROM.WORD→DECODE；IMM→RAM.ADDR、MUX.A、PC.TARGET；LOAD→MUX.S；RAM.Q→MUX.B；MUX.Y→ALU.B；REG.Q→ALU.A、RAM.DATA、ZERO.A；ALU.Y→REG.D；WE→REG.EN；其余控制信号接同名端口。',
    cpu: true,
    solve: (b) => {
      const pc = b.add('PC8', 220, 80, {}),
        rom = b.add('ROM', 440, 80, { program: DEFAULT_PROGRAM }),
        dec = b.add('DECODE', 670, 70, {}),
        reg = b.add('REG8', 1160, 380, {}),
        aluNode = b.add('ALU8', 930, 380, {}),
        ram = b.add('RAM8', 430, 490, {}),
        mux = b.add('MUX8', 690, 420, {}),
        zero = b.add('ZERO8', 1160, 660, {}),
        constant = b.constant(0, 1, 950, 660);
      for (const [f, fp, t, tp] of [
        [pc, 'Q', rom, 'ADDR'],
        [rom, 'WORD', dec, 'WORD'],
        [dec, 'IMM', ram, 'ADDR'],
        [reg, 'Q', ram, 'DATA'],
        [dec, 'STORE', ram, 'WE'],
        [dec, 'IMM', mux, 'A'],
        [ram, 'Q', mux, 'B'],
        [dec, 'LOAD', mux, 'S'],
        [mux, 'Y', aluNode, 'B'],
        [reg, 'Q', aluNode, 'A'],
        [dec, 'OP', aluNode, 'OP'],
        [aluNode, 'Y', reg, 'D'],
        [dec, 'WE', reg, 'EN'],
        [reg, 'Q', zero, 'A'],
        [zero, 'Z', pc, 'Z'],
        [dec, 'IMM', pc, 'TARGET'],
        [dec, 'JMP', pc, 'JMP'],
        [dec, 'JZ', pc, 'JZ'],
        [dec, 'HALT', pc, 'HALT'],
      ])
        b.wire(b.at(f, fp), t, tp);
      b.wire(constant, reg, 'RST');
      b.out('ACC', b.at(reg, 'Q'));
      b.out('PC', b.at(pc, 'Q'));
      for (const id of Object.values(b.outputs)) b.graph.nodes.find((n) => n.id === id).x = 1410;
    },
  },
];
export const LEVELS = defs.map((l, i) => ({
  ...l,
  index: i,
  number: i + 1,
  coverage:
    l.coverage ||
    (l.cpu ? '4 段程序 / 每段最多 96 拍' : l.sequential ? '逐拍状态与保持检查' : '穷举所有输入组合'),
}));
export function starter(level) {
  return new Builder(level).graph;
}
export function solution(level) {
  const b = new Builder(level);
  level.solve(b);
  return b.graph;
}
function interfaceErrors(level, graph) {
  const errors = [];
  for (const [type, ports] of [
    ['IN', level.inputs],
    ['OUT', level.outputs],
  ]) {
    const actual = graph.nodes.filter((n) => n.type === type);
    if (
      actual.length !== ports.length ||
      ports.some((p) => !actual.some((n) => n.cfg.key === p.key && (n.cfg.width || 1) === p.width))
    )
      errors.push('请保留关卡规定的 ' + type + ' 名称与位宽');
  }
  return errors;
}
export function testLevel(level, graph, modules = {}) {
  const errors = [
    ...validateModules(modules),
    ...validateGraph(graph, modules),
    ...interfaceErrors(level, graph),
  ];
  const types = primitiveTypes(graph, modules);
  for (const t of types) if (!level.allowed.includes(t)) errors.push('本关尚未解锁 ' + t);
  if (level.cpu)
    for (const t of ['PC8', 'ROM', 'DECODE', 'REG8', 'RAM8', 'ALU8'])
      if (graph.nodes.filter((n) => n.type === t).length !== 1)
        errors.push('最终处理器需要且只需要一个 ' + t);
  if (errors.length) return { pass: false, count: 0, errors: [...new Set(errors)] };
  let count = 0;
  const check = (inputs, expected, actual, extra = {}) => {
    count++;
    for (const [key, value] of Object.entries(expected))
      if (actual[key] !== value)
        return { pass: false, count, errors: [], failure: { inputs, expected, actual, ...extra } };
    return null;
  };
  if (level.cpu) {
    for (const program of CPU_PROGRAMS) {
      const runtime = createRuntime(graph);
      runtime.program = assemble(program.source).words;
      let halted = false;
      const pc = graph.nodes.find((n) => n.type === 'PC8'),
        ram = graph.nodes.find((n) => n.type === 'RAM8');
      for (let i = 0; i < 96; i++) {
        const result = simulate(graph, {}, runtime, modules);
        if (result.read(pc.id, 'HALT') === 1) {
          halted = true;
          break;
        }
        tick(graph, {}, runtime, modules);
      }
      const result = simulate(graph, {}, runtime, modules);
      const expected = { ACC: program.acc, PC: runtime.program.length - 1, HALTED: 1 },
        actual = { ACC: result.outputs.ACC, PC: result.outputs.PC, HALTED: +halted };
      for (const [address, value] of Object.entries(program.memory)) {
        expected['RAM[' + address + ']'] = value;
        actual['RAM[' + address + ']'] = runtime.state[ram.id].memory[+address];
      }
      const fail = check({}, expected, actual, { program: program.name, step: runtime.ticks });
      if (fail) return fail;
    }
  } else if (level.sequential) {
    for (const sequence of sequentialCases(level.sequential)) {
      const runtime = createRuntime(graph);
      const zero = Object.fromEntries(level.outputs.map((p) => [p.key, 0]));
      let fail = check({}, zero, simulate(graph, {}, runtime, modules).outputs, { step: 0 });
      if (fail) return fail;
      for (const [i, step] of sequence.steps.entries()) {
        const before = simulate(graph, step.inputs, runtime, modules).outputs;
        const snapshot = structuredClone(runtime.state);
        const again = simulate(graph, step.inputs, runtime, modules).outputs;
        if (
          JSON.stringify(snapshot) !== JSON.stringify(runtime.state) ||
          JSON.stringify(before) !== JSON.stringify(again)
        )
          throw Error('组合求值改变了状态');
        const out = tick(graph, step.inputs, runtime, modules).outputs;
        fail = check(step.inputs, step.expected, out, { step: i + 1 });
        if (fail) return fail;
      }
    }
  } else {
    const runtime = createRuntime(graph);
    for (const inputs of level.cases()) {
      const result = simulate(graph, inputs, runtime, modules);
      const fail = check(inputs, level.expect(inputs), result.outputs);
      if (fail) return fail;
    }
  }
  return { pass: true, count, errors: [] };
}
