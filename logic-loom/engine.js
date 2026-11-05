/* Logic Loom: pure, deterministic, integer netlist simulation. No UI or I/O. */
export const mask = (w) => 2 ** w - 1;
const p = (name, width = 1) => ({ name, width });
const def = (label, inputs, outputs, run, extra = {}) => ({ label, inputs, outputs, run, ...extra });
const binary = (label, fn, width = 1) =>
  def(label, [p('A', width), p('B', width)], [p('Y', width)], (a) => ({
    Y: fn(a.A, a.B) & mask(width),
  }));
export const TYPES = {
  IN: def('输入', [], [p('Y')], null, { io: true }),
  OUT: def('输出', [p('A')], [], null, { io: true }),
  CONST: def('常量', [], [p('Y')], null),
  NAND: binary('NAND 与非', (a, b) => ~(a & b)),
  NOT: def('NOT 反相', [p('A')], [p('Y')], (a) => ({ Y: 1 - a.A })),
  AND: binary('AND 与', (a, b) => a & b),
  OR: binary('OR 或', (a, b) => a | b),
  XOR: binary('XOR 异或', (a, b) => a ^ b),
  MUX1: def('MUX 选择', [p('A'), p('B'), p('S')], [p('Y')], (a) => ({ Y: a.S ? a.B : a.A })),
  FA: def('全加器', [p('A'), p('B'), p('C')], [p('S'), p('C')], (a) => ({
    S: (a.A + a.B + a.C) & 1,
    C: (a.A + a.B + a.C) >> 1,
  })),
  NOT8: def('NOT · 8', [p('A', 8)], [p('Y', 8)], (a) => ({ Y: ~a.A & 255 })),
  AND8: binary('AND · 8', (a, b) => a & b, 8),
  OR8: binary('OR · 8', (a, b) => a | b, 8),
  XOR8: binary('XOR · 8', (a, b) => a ^ b, 8),
  ADD8: def('ADD · 8', [p('A', 8), p('B', 8)], [p('Y', 8), p('C')], (a) => ({
    Y: (a.A + a.B) & 255,
    C: a.A + a.B > 255 ? 1 : 0,
  })),
  SUB8: binary('SUB · 8', (a, b) => a - b, 8),
  SHL8: def('左移一位', [p('A', 8)], [p('Y', 8)], (a) => ({ Y: (a.A << 1) & 255 })),
  SHR8: def('右移一位', [p('A', 8)], [p('Y', 8)], (a) => ({ Y: a.A >>> 1 })),
  MUX8: def('MUX · 8', [p('A', 8), p('B', 8), p('S')], [p('Y', 8)], (a) => ({ Y: a.S ? a.B : a.A })),
  ZERO8: def('ZERO · 8', [p('A', 8)], [p('Z')], (a) => ({ Z: +(a.A === 0) })),
  EQ4: def('相等 · 4', [p('A', 4), p('B', 4)], [p('Y')], (a) => ({ Y: +(a.A === a.B) })),
  DFF: def('D 触发器', [p('D'), p('EN'), p('RST')], [p('Q')], null, { sequential: true }),
  REG8: def('寄存器 · 8', [p('D', 8), p('EN'), p('RST')], [p('Q', 8)], null, { sequential: true }),
  ALU8: def('ALU · 8', [p('A', 8), p('B', 8), p('OP', 3)], [p('Y', 8), p('Z')], (a) => {
    const Y = alu(a.A, a.B, a.OP);
    return { Y, Z: +(Y === 0) };
  }),
  PC8: def('程序计数器', [p('TARGET', 8), p('JMP'), p('JZ'), p('Z'), p('HALT')], [p('Q', 8)], null, {
    sequential: true,
  }),
  ROM: def('程序 ROM', [p('ADDR', 8)], [p('WORD', 16)], null),
  DECODE: def(
    '指令译码器',
    [p('WORD', 16)],
    [p('IMM', 8), p('OP', 3), p('WE'), p('JMP'), p('JZ'), p('STORE'), p('LOAD'), p('HALT')],
    (a) => ({ IMM: a.WORD & 255, ...decode(a.WORD >>> 12) }),
  ),
  RAM8: def('RAM · 256×8', [p('ADDR', 8), p('DATA', 8), p('WE')], [p('Q', 8)], null, {
    sequential: true,
    memory: true,
  }),
};
for (const width of [2, 3, 4, 8, 16]) {
  TYPES['SPLIT' + width] = def(
    '拆线 · ' + width,
    [p('A', width)],
    Array.from({ length: width }, (_, i) => p('b' + i)),
    (a) => Object.fromEntries(Array.from({ length: width }, (_, i) => ['b' + i, (a.A >>> i) & 1])),
  );
  TYPES['JOIN' + width] = def(
    '合线 · ' + width,
    Array.from({ length: width }, (_, i) => p('b' + i)),
    [p('Y', width)],
    (a) => ({ Y: Array.from({ length: width }, (_, i) => a['b' + i] << i).reduce((x, y) => x | y, 0) }),
  );
}
export function alu(a, b, op) {
  return [a + b, a - b, a & b, a | b, a ^ b, a << 1, a >>> 1, b][op] & 255;
}
export function decode(op) {
  return {
    OP: { 1: 7, 2: 0, 3: 1, 4: 2, 5: 4, 9: 7 }[op] ?? 0,
    WE: +[1, 2, 3, 4, 5, 9].includes(op),
    JMP: +(op === 6),
    JZ: +(op === 7),
    STORE: +(op === 8),
    LOAD: +(op === 9),
    HALT: +(op === 15),
  };
}
export function spec(node, modules = {}) {
  if (node.type.startsWith('MOD:')) {
    const m = Object.hasOwn(modules, node.type.slice(4)) ? modules[node.type.slice(4)] : null;
    if (!m) throw Error('找不到子电路 ' + node.type.slice(4));
    return {
      label: m.name,
      inputs: m.graph.nodes.filter((n) => n.type === 'IN').map((n) => p(n.cfg.key, n.cfg.width || 1)),
      outputs: m.graph.nodes.filter((n) => n.type === 'OUT').map((n) => p(n.cfg.key, n.cfg.width || 1)),
      module: true,
    };
  }
  const d = TYPES[node.type];
  if (!d) throw Error('未知元件 ' + node.type);
  if (['IN', 'OUT', 'CONST'].includes(node.type)) {
    const width = node.cfg?.width || 1;
    return {
      ...d,
      inputs: d.inputs.map((v) => ({ ...v, width })),
      outputs: d.outputs.map((v) => ({ ...v, width })),
    };
  }
  return d;
}
const ID = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
export function expandedSize(graph, modules = {}, stack = new Set(), depth = 0) {
  if (depth > 8 || !Array.isArray(graph?.nodes)) return Infinity;
  let size = 0;
  for (const node of graph.nodes) {
    if (!node || typeof node.type !== 'string') return Infinity;
    if (node.type.startsWith('MOD:')) {
      const id = node.type.slice(4);
      if (stack.has(id) || !Object.hasOwn(modules, id)) return Infinity;
      const next = new Set(stack);
      next.add(id);
      size += expandedSize(modules[id].graph, modules, next, depth + 1);
    } else size++;
    if (size > 2500) return size;
  }
  return size;
}
export function validateGraph(graph, modules = {}, options = {}) {
  const errors = [];
  const strict = options.strict ?? true;
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.wires)) return ['电路格式错误'];
  if (graph.nodes.length > 250 || graph.wires.length > 1400)
    return ['电路过大（最多 250 个元件 / 1400 条连线）'];
  const nodes = new Map(),
    ds = new Map(),
    incoming = new Map();
  for (const n of graph.nodes) {
    if (!n || typeof n.id !== 'string' || !ID.test(n.id) || nodes.has(n.id)) {
      errors.push('元件 ID 无效或重复');
      continue;
    }
    nodes.set(n.id, n);
    if (typeof n.type !== 'string') {
      errors.push('元件类型缺失');
      continue;
    }
    if (!Number.isFinite(n.x) || !Number.isFinite(n.y) || Math.abs(n.x) > 20000 || Math.abs(n.y) > 20000)
      errors.push('元件位置无效');
    if (!n.cfg || typeof n.cfg !== 'object' || Array.isArray(n.cfg)) {
      errors.push('元件配置无效');
      continue;
    }
    if (['IN', 'OUT', 'CONST'].includes(n.type) && ![1, 2, 3, 4, 8, 16].includes(n.cfg.width || 1))
      errors.push('不支持的位宽');
    if (['IN', 'OUT'].includes(n.type) && !ID.test(n.cfg.key || ''))
      errors.push('端口名称只能使用字母、数字、下划线');
    if (
      n.type === 'CONST' &&
      (!Number.isInteger(n.cfg.value) || n.cfg.value < 0 || n.cfg.value > mask(n.cfg.width || 1))
    )
      errors.push('常量超出位宽');
    if (
      n.type === 'ROM' &&
      n.cfg.program !== undefined &&
      (typeof n.cfg.program !== 'string' || n.cfg.program.length > 12000)
    )
      errors.push('程序文本无效');
    try {
      ds.set(n.id, spec(n, modules));
    } catch (e) {
      errors.push(e.message);
    }
  }
  for (const t of ['IN', 'OUT']) {
    const keys = graph.nodes.filter((n) => n?.type === t).map((n) => n.cfg?.key);
    if (new Set(keys).size !== keys.length) errors.push(t + ' 端口名称重复');
  }
  const wireIds = new Set();
  for (const w of graph.wires) {
    if (!w || !ID.test(w.id || '') || wireIds.has(w.id)) {
      errors.push('连线 ID 无效或重复');
      continue;
    }
    wireIds.add(w.id);
    const f = ds.get(w.from?.node),
      t = ds.get(w.to?.node);
    const a = f?.outputs.find((x) => x.name === w.from.port),
      b = t?.inputs.find((x) => x.name === w.to.port);
    if (!a || !b) {
      errors.push('连线端点不存在');
      continue;
    }
    if (a.width !== b.width) errors.push('连线位宽不同：' + a.width + ' → ' + b.width);
    const key = w.to.node + '.' + w.to.port;
    if (incoming.has(key)) errors.push('一个输入端口只能接一根线');
    incoming.set(key, w);
  }
  if (strict)
    for (const [id, d] of ds)
      for (const port of d.inputs)
        if (!incoming.has(id + '.' + port.name))
          errors.push((nodes.get(id).label || d.label) + ' 的 ' + port.name + ' 尚未连接');
  // Registers break combinational cycles; RAM's asynchronous read still depends on ADDR.
  const visiting = new Set(),
    done = new Set();
  const walk = (id) => {
    if (visiting.has(id)) {
      errors.push('存在组合环路；反馈需要经过触发器或寄存器');
      return;
    }
    if (done.has(id)) return;
    visiting.add(id);
    const d = ds.get(id);
    if (d)
      for (const port of d.inputs) {
        if (d.sequential && !d.memory) continue;
        if (d.memory && port.name !== 'ADDR') continue;
        const w = incoming.get(id + '.' + port.name);
        if (w) walk(w.from.node);
      }
    visiting.delete(id);
    done.add(id);
  };
  for (const id of nodes.keys()) walk(id);
  if (!errors.length && expandedSize(graph, modules) > 2500)
    errors.push('展开后的电路过大或嵌套超过 8 层');
  return [...new Set(errors)];
}
export function validateModules(modules) {
  if (!modules || typeof modules !== 'object' || Array.isArray(modules)) return ['子电路库格式错误'];
  if (Object.keys(modules).length > 32) return ['最多保存 32 个子电路'];
  const errors = [],
    visiting = new Set(),
    done = new Set();
  let expansion = 0;
  const visit = (id, depth = 0) => {
    if (depth > 8) {
      errors.push('子电路嵌套最多 8 层');
      return;
    }
    if (visiting.has(id)) {
      errors.push('子电路不能直接或间接包含自身');
      return;
    }
    if (done.has(id)) return;
    const m = modules[id];
    if (
      !m ||
      !ID.test(id) ||
      m.id !== id ||
      typeof m.name !== 'string' ||
      !m.name.trim() ||
      m.name.length > 40
    ) {
      errors.push('子电路名称或 ID 无效');
      return;
    }
    visiting.add(id);
    if (!m.graph?.nodes || !Array.isArray(m.graph.nodes)) {
      errors.push('子电路缺少元件');
      visiting.delete(id);
      return;
    }
    errors.push(...validateGraph(m.graph, modules));
    if (!m.graph.nodes.some((n) => n.type === 'IN') || !m.graph.nodes.some((n) => n.type === 'OUT'))
      errors.push('子电路至少需要一个输入与一个输出');
    for (const n of m.graph.nodes) {
      if (TYPES[n.type]?.sequential || n.type === 'ROM') errors.push('当前只支持封装组合电路');
      if (n.type.startsWith('MOD:')) visit(n.type.slice(4), depth + 1);
    }
    visiting.delete(id);
    done.add(id);
  };
  for (const id of Object.keys(modules)) visit(id);
  if (!errors.length) {
    const size = (g, depth = 0) => {
      if (depth > 8) return 1e6;
      return g.nodes.reduce(
        (s, n) => s + (n.type.startsWith('MOD:') ? size(modules[n.type.slice(4)].graph, depth + 1) : 1),
        0,
      );
    };
    for (const m of Object.values(modules)) expansion += size(m.graph);
    if (expansion > 2500) errors.push('展开后的子电路库过大');
  }
  return [...new Set(errors)];
}
export function primitiveTypes(graph, modules = {}, seen = new Set()) {
  for (const n of graph.nodes) {
    if (n.type.startsWith('MOD:')) {
      const id = n.type.slice(4);
      if (!seen.has('MOD:' + id)) {
        seen.add('MOD:' + id);
        if (modules[id]) primitiveTypes(modules[id].graph, modules, seen);
      }
    } else seen.add(n.type);
  }
  return [...seen].filter((t) => !t.startsWith('MOD:'));
}
export function createRuntime(graph) {
  return {
    ticks: 0,
    state: Object.fromEntries(
      graph.nodes
        .filter((n) => TYPES[n.type]?.sequential)
        .map((n) => [n.id, n.type === 'RAM8' ? { memory: Array(256).fill(0) } : { q: 0 }]),
    ),
    program: null,
  };
}
export function simulate(graph, inputs = {}, runtime = createRuntime(graph), modules = {}) {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n])),
    incoming = new Map(graph.wires.map((w) => [w.to.node + '.' + w.to.port, w]));
  const cache = {},
    active = new Set(),
    issues = [];
  const get = (id, port) => {
    if (cache[id]) return cache[id][port] ?? null;
    const n = nodes.get(id);
    if (!n) return null;
    if (active.has(id)) {
      issues.push('组合环路');
      return null;
    }
    active.add(id);
    const d = spec(n, modules),
      a = {};
    let result = {};
    if (n.type === 'IN') result = { Y: (inputs[n.cfg.key] ?? 0) & mask(n.cfg.width || 1) };
    else if (n.type === 'CONST') result = { Y: n.cfg.value };
    else if (d.sequential && !d.memory) result = { Q: runtime.state[n.id]?.q ?? 0 };
    else {
      for (const pin of d.inputs) {
        if (d.memory && pin.name !== 'ADDR') continue;
        const w = incoming.get(id + '.' + pin.name);
        a[pin.name] = w ? get(w.from.node, w.from.port) : null;
      }
      if (Object.values(a).some((v) => v === null))
        result = Object.fromEntries(d.outputs.map((o) => [o.name, null]));
      else if (n.type === 'OUT') result = { VALUE: a.A };
      else if (n.type === 'RAM8') result = { Q: runtime.state[n.id]?.memory[a.ADDR] ?? 0 };
      else if (n.type === 'ROM') {
        try {
          const program = runtime.program || assemble(n.cfg.program || 'HALT').words;
          result = { WORD: program[a.ADDR] ?? 0xf000 };
        } catch (e) {
          issues.push(e.message);
          result = { WORD: null };
        }
      } else if (d.module) {
        const sub = modules[n.type.slice(4)].graph;
        result = simulate(sub, a, createRuntime(sub), modules).outputs;
      } else result = d.run(a);
    }
    active.delete(id);
    cache[id] = result;
    return result[port] ?? null;
  };
  const outputs = {};
  for (const n of graph.nodes) {
    const d = spec(n, modules);
    if (n.type === 'OUT') outputs[n.cfg.key] = get(n.id, 'VALUE');
    else for (const o of d.outputs) get(n.id, o.name);
  }
  return {
    outputs,
    values: cache,
    issues: [...new Set(issues)],
    read: (id, port) => {
      const w = incoming.get(id + '.' + port);
      return w ? get(w.from.node, w.from.port) : null;
    },
  };
}
export function tick(graph, inputs, runtime, modules = {}) {
  const errors = validateGraph(graph, modules);
  if (errors.length) throw Error(errors[0]);
  const before = simulate(graph, inputs, runtime, modules);
  if (before.issues.length) throw Error(before.issues[0]);
  const next = structuredClone(runtime.state);
  for (const n of graph.nodes) {
    const d = spec(n, modules);
    if (!d.sequential) continue;
    const a = Object.fromEntries(d.inputs.map((p) => [p.name, before.read(n.id, p.name)]));
    if (Object.values(a).some((x) => x === null)) throw Error('时钟边沿前有未定义信号');
    if (n.type === 'RAM8') {
      if (a.WE) next[n.id].memory[a.ADDR] = a.DATA;
    } else if (n.type === 'PC8') {
      if (!a.HALT) next[n.id].q = a.JMP || (a.JZ && a.Z) ? a.TARGET : (runtime.state[n.id].q + 1) & 255;
    } else next[n.id].q = a.RST ? 0 : a.EN ? a.D : runtime.state[n.id].q;
  }
  runtime.state = next;
  runtime.ticks++;
  return simulate(graph, inputs, runtime, modules);
}
const ISA = { MOVI: 1, ADDI: 2, SUBI: 3, ANDI: 4, XORI: 5, JMP: 6, JZ: 7, STORE: 8, LOAD: 9, HALT: 15 };
export function assemble(source) {
  if (typeof source !== 'string' || source.length > 12000) throw Error('程序文本无效或过长');
  const labels = {},
    lines = [];
  let address = 0;
  source.split(/\r?\n/).forEach((raw, i) => {
    let s = raw.split(';')[0].trim();
    if (!s) return;
    const match = s.match(/^([A-Za-z_]\w*):/);
    if (match) {
      const label = match[1].toUpperCase();
      if (Object.hasOwn(labels, label)) throw Error('第 ' + (i + 1) + ' 行：标签重复');
      labels[label] = address;
      s = s.slice(match[0].length).trim();
      if (!s) return;
    }
    lines.push({ s, line: i + 1, address: address++ });
  });
  if (!lines.length || lines.length > 256) throw Error('程序需要 1–256 条指令');
  const listing = lines.map(({ s, line, address }) => {
    const parts = s.toUpperCase().split(/[\s,]+/),
      op = parts[0];
    if (!Object.hasOwn(ISA, op)) throw Error('第 ' + line + ' 行：未知指令 ' + op);
    const count = op === 'HALT' ? 1 : 2;
    if (parts.length !== count) throw Error('第 ' + line + ' 行：' + op + ' 参数数量不正确');
    let value = 0;
    if (count === 2) {
      const token = parts[1];
      value = Object.hasOwn(labels, token)
        ? labels[token]
        : /^(0X[0-9A-F]+|0B[01]+|\d+)$/.test(token)
          ? Number(token)
          : NaN;
      if (!Number.isInteger(value) || value < 0 || value > 255)
        throw Error('第 ' + line + ' 行：参数必须是 0–255 或有效标签');
    }
    return { address, line, source: s, word: (ISA[op] << 12) | value };
  });
  return { words: listing.map((l) => l.word), listing, labels };
}
