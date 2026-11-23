const functions = { sin: Math.sin, cos: Math.cos, tan: Math.tan, abs: Math.abs, sqrt: Math.sqrt, exp: Math.exp };
const num = value => Number(value.toPrecision(14)).toString();

function readNumber(value, name, min = -Infinity, max = Infinity) {
  const n = Number(value);
  if (String(value).trim() === '' || !Number.isFinite(n) || n < min || n > max) throw new Error(`${name}超出有效范围`);
  return n;
}

// Emit only the parsed arithmetic tree. User-supplied text is never executed as JavaScript
// or inserted directly into a SPICE expression.
function parseEquation(source, frequency) {
  if (typeof source !== 'string' || !source.trim() || source.length > 400) throw new Error('请输入 1–400 字符的方程');
  const tokenPattern = /\s*([0-9]*\.[0-9]+(?:e[+-]?\d+)?|\d+(?:\.\d*)?(?:e[+-]?\d+)?|[a-z]+|[()+*/^\-])/iy;
  const tokens = [];
  const trimmed = source.trim();
  while (tokenPattern.lastIndex < trimmed.length) {
    const match = tokenPattern.exec(trimmed);
    if (!match) throw new Error('方程含有无法识别的字符');
    tokens.push(match[1].toLowerCase());
  }
  let index = 0;
  function accept(token) {
    if (tokens[index] !== token) return false;
    index++;
    return true;
  }
  const constant = value => ({ spice: num(value), at: () => value });
  function primary() {
    const token = tokens[index++];
    if (token === '(') {
      const value = sum();
      if (!accept(')')) throw new Error('方程括号不匹配');
      return value;
    }
    if (Object.hasOwn(functions, token)) {
      if (!accept('(')) throw new Error('函数参数需要括号');
      const argument = sum();
      if (!accept(')')) throw new Error('函数缺少右括号');
      return { spice: `${token}(${argument.spice})`, at: t => functions[token](argument.at(t)) };
    }
    if (token === 't' || token === 'time') return { spice: 'time', at: t => t };
    if (token === 'pi') return constant(Math.PI);
    if (token === 'f') return constant(frequency);
    if (token && /^[.\d]/.test(token)) return constant(readNumber(token, '方程数值'));
    throw new Error('方程支持 t、f、pi 及 sin / cos / tan / abs / sqrt / exp');
  }
  function power() {
    const base = primary();
    if (!accept('^')) return base;
    const exponent = unary();
    const exponentText = exponent.spice.replace(/^\((-?\d+)\)$/, '$1');
    if (!/^-?\d+$/.test(exponentText) || !Number.isSafeInteger(Number(exponentText))) throw new Error('幂指数应为整数常量');
    const n = Number(exponentText);
    // ngspice pow uses abs(base). Its sign-preserving pwr variant gives odd integer powers.
    const fn = Math.abs(n % 2) === 1 ? 'pwr' : 'pow';
    return { spice: `${fn}(${base.spice},${n})`, at: t => base.at(t) ** n };
  }
  function unary() {
    if (accept('+')) return unary();
    if (!accept('-')) return power();
    const arg = unary();
    return { spice: `(-${arg.spice})`, at: t => -arg.at(t) };
  }
  function product() {
    let value = unary();
    while (tokens[index] === '*' || tokens[index] === '/') {
      const op = tokens[index++], a = value, b = unary();
      value = { spice: `(${a.spice} ${op} ${b.spice})`, at: t => op === '*' ? a.at(t)*b.at(t) : a.at(t)/b.at(t) };
    }
    return value;
  }
  function sum() {
    let value = product();
    while (tokens[index] === '+' || tokens[index] === '-') {
      const op = tokens[index++], a = value, b = product();
      value = { spice: `(${a.spice} ${op} ${b.spice})`, at: t => op === '+' ? a.at(t)+b.at(t) : a.at(t)-b.at(t) };
    }
    return value;
  }
  const parsed = sum();
  if (index !== tokens.length) throw new Error('方程中存在多余的表达式，乘法请显式写 *');
  return parsed;
}

function readHarmonics(text) {
  const terms = String(text).trim().split(/[;,\n]/);
  if (terms.length > 32) throw new Error('最多可定义 32 个谐波');
  return terms.map(term => {
    const parts = term.trim().split(':');
    if (parts.length < 2 || parts.length > 3) throw new Error('谐波格式为 次数:相对幅值:相位度，逗号分隔');
    const harmonic = readNumber(parts[0], '谐波次数', 1, 1000);
    if (!Number.isInteger(harmonic)) throw new Error('谐波次数须为整数');
    return [harmonic, readNumber(parts[1], '相对幅值'), readNumber(parts[2] ?? 0, '相位') * Math.PI / 180];
  });
}

export function makeGenerator(spec = {}) {
  const { wave = 'sine', name = 'GEN', positive = 'in', negative = '0' } = spec;
  if (!/^[a-z][a-z0-9_]{0,39}$/i.test(name)) throw new Error('源标识应以字母开头，只使用字母、数字和下划线');
  for (const node of [positive, negative]) if (!/^[a-z\d_][a-z\d_.$-]{0,63}$/i.test(node)) throw new Error('节点名含有无效字符');
  if (String(positive).toLowerCase() === String(negative).toLowerCase()) throw new Error('源的两个端子需要连接不同节点');
  const f = readNumber(spec.frequency ?? 1000, '频率', 1e-12, 1e15);
  const a = readNumber(spec.amplitude ?? 1, '幅值', 0, 1e15);
  const o = readNumber(spec.offset ?? 0, '偏置', -1e15, 1e15);
  const period = 1/f, w = 2*Math.PI*f;
  const pins = `${name} ${positive} ${negative}`;
  if (wave === 'sine') {
    const phase = readNumber(spec.phase ?? 0, '相位');
    return { line: `V${pins} SIN(${num(o)} ${num(a)} ${num(f)} 0 0 ${num(phase)})`,
      at: t => o + a*Math.sin(w*t + phase*Math.PI/180), period };
  }
  if (wave === 'square' || wave === 'triangle') {
    const duty = wave === 'triangle' ? 0.5 : readNumber(spec.duty ?? 50, '占空比 (%)', 0.01, 99.99)/100;
    const edge = wave === 'triangle' ? period/2 : period*Math.min(duty, 1-duty)*0.002;
    const width = wave === 'triangle' ? 0 : duty*period-edge;
    const at = t => {
      const p = ((t % period) + period) % period;
      if (p < edge) return o-a + 2*a*p/edge;
      if (p <= edge + width) return o+a;
      if (p < 2*edge + width) return o+a - 2*a*(p-edge-width)/edge;
      return o-a;
    };
    return { line: `V${pins} PULSE(${num(o-a)} ${num(o+a)} 0 ${num(edge)} ${num(edge)} ${num(width)} ${num(period)})`, period, at };
  }
  let expression;
  if (wave === 'harmonics') {
    const terms = readHarmonics(spec.harmonics ?? '1:1:0,3:0.25:0');
    expression = {
      spice: terms.map(([h,g,p]) => `(${num(g)}*sin(${num(w*h)}*time+(${num(p)})))`).join('+'),
      at: t => terms.reduce((sum, [h,g,p]) => sum + g*Math.sin(w*h*t + p), 0),
    };
  } else if (wave === 'equation') {
    expression = parseEquation(spec.equation ?? 'sin(2*pi*f*t)', f);
  } else throw new Error('无法识别的波形');
  return { line: `B${pins} V=(${num(o)})+(${num(a)})*(${expression.spice})`, at: t => o+a*expression.at(t), period };
}

export function buildGenerator(spec) { return makeGenerator(spec).line; }
