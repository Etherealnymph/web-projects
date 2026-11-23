// Supported Spectre forms are translated explicitly; each conversion keeps its physical parameters.
const primitives = { resistor: ['R', 'r'], capacitor: ['C', 'c'], inductor: ['L', 'l'] };
const models = { diode: ['D', 'D'], bjt: ['Q'], mos1: ['M'], bsim3v3: ['M'], bsim4: ['M'] };

function assignments(text) {
  const result = {};
  const pattern = /([a-z_][\w.]*)\s*=\s*(\{[^{}]+\}|"[^"]*"|'[^']*'|[^\s{}=]+)/iy;
  let i = 0;
  while (i < text.length) {
    if (/\s/.test(text[i])) {
      i++;
      continue;
    }
    pattern.lastIndex = i;
    const match = pattern.exec(text);
    if (!match) throw Error('无法转换 Spectre 参数 ' + text.slice(i, i + 70));
    const key = match[1].toLowerCase();
    if (Object.hasOwn(result, key)) throw Error('重复参数 ' + key);
    result[key] = match[2];
    i = pattern.lastIndex;
  }
  return result;
}

function spiceValue(token) {
  // Spectre distinguishes M (mega) from m (milli). SPICE spells mega "meg".
  const value = String(token).replace(/(\d|\.)M(?=$|Hz|[AVFHs]\b|[^a-zA-Z])/g, '$1meg');
  if (/^[a-z_][\w.]*$/i.test(value)) return '{' + value + '}';
  return value;
}

function asParams(params) {
  return Object.entries(params)
    .map(([key, value]) => key + '=' + spiceValue(value))
    .join(' ');
}

function take(params, key, fallback) {
  const value = params[key] ?? fallback;
  delete params[key];
  if (value == null) throw Error('缺少参数 ' + key);
  return spiceValue(value);
}

function deviceName(id, prefix) {
  return id[0].toUpperCase() === prefix ? id : prefix + '_' + id;
}

export function spectreDefinitions(records) {
  const types = new Map();
  for (const { text } of records) {
    const subckt = text.match(/^(?:inline\s+)?\.?subckt\s+([^\s(]+)/i);
    if (subckt) types.set(subckt[1].toLowerCase(), 'X');
    const model = text.match(/^(\.?)model\s+(\S+)\s+([\w]+)\b/i);
    if (model) {
      const type = model[3].toLowerCase();
      const prefix =
        models[type]?.[0] ||
        { d: 'D', nmos: 'M', pmos: 'M', npn: 'Q', pnp: 'Q', njf: 'J', pjf: 'J', sw: 'S' }[type];
      if (prefix) types.set(model[2].toLowerCase(), prefix);
    }
  }
  return types;
}

function sourceLine(id, nodes, kind, params) {
  const prefix = kind.startsWith('i') ? 'I' : 'V';
  const defaultType = { vsin: 'sine', vpulse: 'pulse', vsweep: 'sweep' }[kind] || 'dc';
  const type = (params.type || defaultType).toLowerCase();
  delete params.type;
  const explicitDC = Object.hasOwn(params, 'dc');
  const dc = take(params, 'dc', '0');
  let output = deviceName(id, prefix) + ' ' + nodes;
  if (explicitDC || type === 'dc') output += ' DC ' + dc;
  if ('mag' in params) output += ' AC ' + take(params, 'mag') + ' ' + take(params, 'phase', '0');
  if (type === 'sine' || type === 'sin') {
    const offset = take(params, 'offset' in params ? 'offset' : 'sinedc', dc),
      ampl = take(params, 'ampl'),
      freq = take(params, 'freq');
    output +=
      ' SIN(' +
      [
        offset,
        ampl,
        freq,
        take(params, 'delay', 0),
        take(params, 'damp', 0),
        take(params, 'sinephase', 0),
      ].join(' ') +
      ')';
  } else if (type === 'pulse') {
    output +=
      ' PULSE(' +
      [
        take(params, 'val0'),
        take(params, 'val1'),
        take(params, 'delay', 0),
        take(params, 'rise'),
        take(params, 'fall'),
        take(params, 'width'),
        take(params, 'period'),
      ].join(' ') +
      ')';
  } else if (type !== 'dc') {
    throw Error('尚未支持此 Spectre 信号源类型 ' + type);
  }
  if (Object.keys(params).length) throw Error('尚未支持信号源参数 ' + Object.keys(params).join(', '));
  return output;
}

function convertAnalysis(kind, params) {
  const fields = assignments(params);
  const type = kind.toLowerCase();
  let line;
  if (type === 'tran') {
    const stop = take(fields, 'stop');
    const step = take(fields, 'step', fields.maxstep ?? Number(spectreNumber(stop)) / 200);
    const begin = take(fields, 'outputstart', 0);
    if ('start' in fields && spectreNumber(take(fields, 'start')) !== 0)
      throw Error('暂仅支持从 0 s 启动瞬态分析');
    line = '.tran ' + [step, stop, begin, take(fields, 'maxstep', step)].join(' ');
  } else if (type === 'ac') {
    const scale = ['dec', 'lin', 'oct'].find((key) => key in fields);
    if (!scale) throw Error('请设置 ac 的 dec、lin 或 oct 点数');
    line = '.ac ' + [scale, take(fields, scale), take(fields, 'start'), take(fields, 'stop')].join(' ');
  } else if (Object.keys(fields).length) {
    const source = fields.dev;
    const param = (fields.param || 'dc').toLowerCase();
    delete fields.dev;
    delete fields.param;
    if (!source || param !== 'dc') throw Error('DC 扫描支持独立源 dev=... param=dc');
    line =
      '.dc ' + [source, take(fields, 'start'), take(fields, 'stop'), take(fields, 'step')].join(' ');
  } else line = '.op';
  if (Object.keys(fields).length) throw Error('尚未支持分析参数 ' + Object.keys(fields).join(', '));
  return line;
}

function spectreNumber(value) {
  const m = String(value).match(/^([\d.eE+-]+)(meg|[TGMkmunpfa])?$/);
  if (!m) throw Error('分析时间需填写具体数值 ' + value);
  return (
    Number(m[1]) *
    ({
      T: 1e12,
      G: 1e9,
      M: 1e6,
      meg: 1e6,
      k: 1e3,
      m: 1e-3,
      u: 1e-6,
      n: 1e-9,
      p: 1e-12,
      f: 1e-15,
      a: 1e-18,
    }[m[2]] ?? 1)
  );
}

export function translateSpectre(text, types) {
  if (!text || /^(\/\/|\*)/.test(text)) return '';
  let match;
  if (/^global\b/i.test(text)) return '.' + text;
  if ((match = text.match(/^(?:inline\s+)?subckt\s+(\S+?)\s*(?:\(([^)]*)\)|( +[^()]*))$/i))) {
    return '.subckt ' + match[1] + ' ' + (match[2] ?? match[3]).trim();
  }
  if (/^ends\b/i.test(text)) return '.' + text;
  if ((match = text.match(/^parameters\s+(.+)/i))) return '.param ' + asParams(assignments(match[1]));
  if ((match = text.match(/^\S+\s+(tran|ac|dc)\b(.*)$/i))) return convertAnalysis(match[1], match[2]);
  if ((match = text.match(/^model\s+(\S+)\s+(\w+)\s*(.*)$/i))) {
    const [, name, rawKind, rest] = match,
      kind = rawKind.toLowerCase();
    if (!models[kind]) throw Error('尚未转换 Spectre 模型类型 ' + kind);
    const params = assignments(rest.replace(/^\((.*)\)$/, '$1').replace(/^\{(.*)\}$/, '$1'));
    const polarity = (params.type || '').toLowerCase();
    delete params.type;
    let type = 'D';
    if (kind === 'bjt') {
      if (!['npn', 'pnp'].includes(polarity)) throw Error('BJT 模型需指明 type=npn 或 pnp');
      type = polarity.toUpperCase();
    } else if (kind !== 'diode') {
      if (!['n', 'p'].includes(polarity)) throw Error('MOS 模型需指明 type=n 或 p');
      type = polarity === 'n' ? 'NMOS' : 'PMOS';
      params.level = { mos1: 1, bsim3v3: 49, bsim4: 54 }[kind];
    }
    return '.model ' + name + ' ' + type + ' (' + asParams(params) + ')';
  }
  match = text.match(/^(\S+)\s*\(([^()]*)\)\s*(\S+)\s*(.*)$/);
  if (!match) throw Error('尚未支持该 Spectre 语句 ' + text.slice(0, 75));
  const [, id, ports, model, rest] = match;
  const kind = model.toLowerCase(),
    nodes = ports.trim().split(/\s+/).join(' ');
  const params = assignments(rest);
  if (Object.hasOwn(primitives, kind)) {
    const [prefix, parameter] = primitives[kind];
    return [deviceName(id, prefix), nodes, take(params, parameter), asParams(params)]
      .filter(Boolean)
      .join(' ');
  }
  if (['vsource', 'isource', 'vsin', 'vpulse', 'vsweep'].includes(kind))
    return sourceLine(id, nodes, kind, params);
  if (!types.has(kind)) throw Error('未在已引用的模型库中找到 ' + model + '（实例 ' + id + '）');
  return [deviceName(id, types.get(kind)), nodes, model, asParams(params)].filter(Boolean).join(' ');
}
