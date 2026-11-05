import { safePath } from './spice.mjs';
const pinCounts = { R: 2, C: 2, L: 2, V: 2, I: 2, D: 2, M: 4, Q: 3, E: 4, G: 4, F: 2, H: 2, B: 2, S: 4 };
export function parseComponents(text) {
  let subcircuit = false;
  const components = [],
    skipped = [],
    records = [];
  let current = null;
  text
    .replaceAll('\r', '')
    .split('\n')
    .forEach((line, lineIndex) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('+')) {
        if (current) {
          current.text += ' ' + trimmed.slice(1).trim();
          current.lineIndices.push(lineIndex);
        } else skipped.push({ line: lineIndex + 1, text: line });
        return;
      }
      if (!trimmed || /^[*;]/.test(trimmed)) return;
      current = { text: trimmed, lineIndex, lineIndices: [lineIndex] };
      records.push(current);
    });
  const models = new Set(
    records
      .filter((record) => /^\.model\s+\S+\s+(NPN|PNP)\b/i.test(record.text))
      .map((record) => record.text.split(/\s+/)[1].toLowerCase()),
  );
  for (const record of records) {
    const { text: trimmed, lineIndex, lineIndices } = record;
    if (/^\.subckt\b/i.test(trimmed)) subcircuit = true;
    if (/^\.ends\b/i.test(trimmed)) {
      subcircuit = false;
      continue;
    }
    if (subcircuit || trimmed.startsWith('.')) continue;
    const tokens = trimmed.split(/\s+/),
      name = tokens[0],
      type = name[0].toUpperCase();
    let count = pinCounts[type];
    if (type === 'Q') {
      const modelIndex = tokens.findIndex((token, i) => i > 0 && models.has(token.toLowerCase()));
      if (modelIndex === 4 || modelIndex === 5) count = modelIndex - 1;
    }
    if (type === 'X') {
      const parameter = tokens.findIndex(
        (token, i) => i > 0 && (token.includes('=') || /^params:/i.test(token)),
      );
      count = (parameter > 0 ? parameter : tokens.length) - 2;
    }
    if (!count || count > 16 || tokens.length < count + 2) {
      skipped.push({ line: lineIndex + 1, text: trimmed });
      continue;
    }
    components.push({
      name,
      type,
      nodes: tokens.slice(1, count + 1).map((node) => node.toLowerCase()),
      value: tokens.slice(count + 1).join(' '),
      lineIndex,
      lineIndices,
      tokens,
    });
  }
  return { components, skipped };
}
function replaceStatement(text, component, replacement) {
  const indices = new Set(component.lineIndices);
  return text
    .replaceAll('\r', '')
    .split('\n')
    .flatMap((line, index) =>
      index === component.lineIndex
        ? replacement
          ? [replacement]
          : []
        : indices.has(index)
          ? []
          : [line],
    )
    .join('\n');
}
export function changeComponent(text, name, changes) {
  const component = parseComponents(text).components.find((item) => item.name === name);
  if (!component) throw Error('未找到器件 ' + name);
  const nodes = changes.nodes || component.nodes;
  if (nodes.length !== component.nodes.length || nodes.some((node) => !/^[a-z0-9_.$!+-]+$/i.test(node)))
    throw Error('节点名只能包含字母、数字或 _ . $ ! + -');
  const value = String(changes.value ?? component.value).trim();
  if (!value || /[\r\n]/.test(value)) throw Error('器件参数必须位于一行');
  return replaceStatement(text, component, [name, ...nodes, value].join(' '));
}
export function removeComponent(text, name) {
  const component = parseComponents(text).components.find((item) => item.name === name);
  if (!component) throw Error('未找到器件 ' + name);
  return replaceStatement(text, component, '');
}
export function parseSymbol(text, name = 'symbol') {
  if (text.length > 200000) throw Error('符号文件过大');
  const symbol = { name, pins: [], lines: [], rectangles: [], circles: [], attributes: {} };
  let pin = null;
  for (const line of text.replaceAll('\r', '').split('\n')) {
    const tokens = line.trim().split(/\s+/);
    if (tokens[0] === 'PIN') {
      pin = { x: Number(tokens[1]), y: Number(tokens[2]), label: '', order: symbol.pins.length + 1 };
      if (![pin.x, pin.y].every(Number.isFinite)) throw Error('无效符号引脚');
      symbol.pins.push(pin);
    } else if (tokens[0] === 'PINATTR' && pin) {
      if (tokens[1] === 'PinName') pin.label = tokens.slice(2).join(' ');
      if (tokens[1] === 'SpiceOrder') pin.order = Number(tokens[2]);
    } else if (tokens[0] === 'SYMATTR') symbol.attributes[tokens[1]] = tokens.slice(2).join(' ');
    else if (['LINE', 'RECTANGLE', 'CIRCLE'].includes(tokens[0])) {
      const coords = tokens.slice(2, 6).map(Number);
      if (coords.length === 4 && coords.every(Number.isFinite))
        symbol[tokens[0] === 'LINE' ? 'lines' : tokens[0] === 'CIRCLE' ? 'circles' : 'rectangles'].push(
          coords,
        );
    }
  }
  if (
    !symbol.pins.length ||
    symbol.pins.length > 32 ||
    symbol.pins.some((p) => !Number.isInteger(p.order) || p.order < 1) ||
    new Set(symbol.pins.map((p) => p.order)).size !== symbol.pins.length
  )
    throw Error('符号引脚顺序缺失或重复');
  symbol.pins.sort((a, b) => a.order - b.order);
  if (symbol.pins.some((p, i) => p.order !== i + 1)) throw Error('SpiceOrder 必须连续从 1 开始');
  return symbol;
}
function transform(x, y, orientation) {
  const match = orientation.match(/^([RM])(0|90|180|270)$/);
  if (!match) throw Error('不支持的符号方向 ' + orientation);
  if (match[1] === 'M') x = -x;
  const angle = (Number(match[2]) * Math.PI) / 180;
  return [
    Math.round(x * Math.cos(angle) - y * Math.sin(angle)),
    Math.round(x * Math.sin(angle) + y * Math.cos(angle)),
  ];
}
export function importASC(text, symbols) {
  const instances = [],
    wires = [],
    flags = [],
    directives = [];
  let current = null;
  for (const line of text.replaceAll('\r', '').split('\n')) {
    const tokens = line.trim().split(/\s+/);
    if (tokens[0] === 'WIRE') {
      const coords = tokens.slice(1).map(Number);
      if (coords.length !== 4 || !coords.every(Number.isFinite)) throw Error('无效导线');
      wires.push(coords);
    }
    if (tokens[0] === 'FLAG')
      flags.push({ x: Number(tokens[1]), y: Number(tokens[2]), name: tokens.slice(3).join(' ') });
    if (tokens[0] === 'SYMBOL') {
      current = {
        symbol: tokens[1],
        x: Number(tokens[2]),
        y: Number(tokens[3]),
        orientation: tokens[4],
        attributes: {},
      };
      instances.push(current);
    }
    if (tokens[0] === 'SYMATTR' && current) current.attributes[tokens[1]] = tokens.slice(2).join(' ');
    if (tokens[0] === 'TEXT') {
      const marker = line.indexOf('!');
      if (marker >= 0) directives.push(line.slice(marker + 1).replaceAll('\\n', '\n'));
    }
  }
  if (instances.length > 1000 || wires.length > 4000)
    throw Error('原理图超出 1000 器件或 4000 导线上限');
  const points = new Map(),
    parents = new Map();
  const key = (x, y) => `${x},${y}`;
  function add(x, y) {
    if (![x, y].every(Number.isFinite)) throw Error('原理图坐标无效');
    const k = key(x, y);
    points.set(k, { x, y });
    parents.set(k, k);
    return k;
  }
  wires.forEach(([x1, y1, x2, y2]) => {
    add(x1, y1);
    add(x2, y2);
  });
  flags.forEach((f) => add(f.x, f.y));
  for (const item of instances) {
    const key = item.symbol.replaceAll('\\', '/').toLowerCase();
    const candidates = Object.entries(symbols).filter(
      ([name]) => name === key || name.endsWith('/' + key),
    );
    if (candidates.length > 1) throw Error('符号名称存在歧义 ' + item.symbol);
    const symbol = candidates[0]?.[1];
    if (!symbol) throw Error(`请同时导入 ${item.symbol}.asy，转换需要该符号的实际引脚顺序`);
    item.definition = symbol;
    item.pins = symbol.pins.map((pin) => {
      const [x, y] = transform(pin.x, pin.y, item.orientation);
      return add(item.x + x, item.y + y);
    });
  }
  function find(k) {
    let p = k;
    while (parents.get(p) !== p) p = parents.get(p);
    while (parents.get(k) !== k) {
      const next = parents.get(k);
      parents.set(k, p);
      k = next;
    }
    return p;
  }
  function join(a, b) {
    parents.set(find(a), find(b));
  }
  for (const [x1, y1, x2, y2] of wires) {
    const start = key(x1, y1);
    for (const [k, p] of points) {
      const cross = (p.x - x1) * (y2 - y1) - (p.y - y1) * (x2 - x1);
      if (
        Math.abs(cross) < 1e-8 &&
        p.x >= Math.min(x1, x2) &&
        p.x <= Math.max(x1, x2) &&
        p.y >= Math.min(y1, y2) &&
        p.y <= Math.max(y1, y2)
      )
        join(start, k);
    }
  }
  const names = new Map(),
    flagsByName = new Map();
  const reserved = new Set(flags.map((flag) => flag.name.toLowerCase()));
  for (const flag of flags) {
    if (!/^[a-z0-9_.$!+-]+$/i.test(flag.name)) throw Error('FLAG 节点名不合法');
    const name = flag.name.toLowerCase(),
      k = key(flag.x, flag.y);
    if (flagsByName.has(name)) join(k, flagsByName.get(name));
    else flagsByName.set(name, k);
  }
  for (const flag of flags) {
    const root = find(key(flag.x, flag.y)),
      name = flag.name.toLowerCase();
    if (names.has(root) && names.get(root) !== name) throw Error('导线短接了不同命名网络');
    names.set(root, name);
  }
  let n = 0;
  const node = (k) => {
    const root = find(k);
    if (!names.has(root)) {
      let candidate;
      do {
        candidate = 'n' + ++n;
      } while (reserved.has(candidate));
      reserved.add(candidate);
      names.set(root, candidate);
    }
    return names.get(root);
  };
  const modelFiles = new Set(),
    lines = ['* Imported LTspice schematic (ngspice compatibility required)'];
  const layout = {};
  const usedNames = new Set();
  for (const item of instances) {
    const attrs = { ...item.definition.attributes, ...item.attributes };
    const name = attrs.InstName;
    if (!name || !/^\w[\w.$-]*$/.test(name) || usedNames.has(name.toLowerCase()))
      throw Error('InstName 缺失或重复');
    usedNames.add(name.toLowerCase());
    const spiceName =
      attrs.Prefix && name[0].toUpperCase() !== attrs.Prefix.toUpperCase() ? attrs.Prefix + name : name;
    const value = attrs.Value || attrs.SpiceModel;
    if (!value) throw Error('缺少 Value/SpiceModel ' + name);
    if (attrs.ModelFile) modelFiles.add(safePath(attrs.ModelFile));
    lines.push(
      [spiceName, ...item.pins.map(node), value, attrs.SpiceLine || '', attrs.SpiceLine2 || '']
        .filter(Boolean)
        .join(' '),
    );
    layout[spiceName] = { x: item.x, y: item.y, symbol: item.symbol.toLowerCase() };
  }
  lines.push(
    ...[...modelFiles].map((name) => `.include "${name}"`),
    ...directives.filter((line) => !/^\s*\.end\s*$/i.test(line)),
    '.end',
  );
  return { netlist: lines.join('\n') + '\n', layout };
}
export function importTheme(text) {
  const input = JSON.parse(text),
    theme = {};
  for (const key of ['background', 'panel', 'text', 'muted', 'accent', 'wire', 'grid']) {
    if (input[key] !== undefined) {
      if (!/^#[a-f0-9]{6}$/i.test(input[key])) throw Error('主题颜色应为六位十六进制 ' + key);
      theme[key] = input[key];
    }
  }
  if (!Object.keys(theme).length) throw Error('未找到可用主题颜色');
  return theme;
}
