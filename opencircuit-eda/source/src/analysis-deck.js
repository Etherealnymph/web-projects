import { spectreDefinitions, translateSpectre } from './analysis-spectre.js';

const MAX_LINES = 450000;
const MAX_SOURCE_CHARS = 48_000_000;
const analysisCard = /^\.(op|tran|ac|dc)\b/i;

function pathKey(input, base = []) {
  const path = String(input || '').replaceAll('\\', '/');
  if (path.startsWith('/') || /[\x00-\x1f<>:"|?*]/.test(path))
    throw Error('需要工程内的相对文件路径 ' + path);
  const parts = [...base];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!parts.length) throw Error('引用路径超出工程目录 ' + path);
      parts.pop();
    } else parts.push(part);
  }
  if (!parts.length) throw Error('文件路径为空');
  return parts.join('/');
}

function initialLanguage(text, path) {
  const marker = text.match(/^\s*simulator\s+lang\s*=\s*(spice|spectre)\b/im);
  if (marker) return marker[1].toLowerCase();
  if (/\.(?:v|vh|sv|svh|vhd|vhdl)$/i.test(path))
    throw Error('数字 HDL 文件可在原理图工作台查看；模拟分析需要 SPICE 或 Spectre 电路入口');
  return /\.scs$/i.test(path) ? 'spectre' : 'spice';
}

function isSpiceTitle(text) {
  if (!text || /^[.*+]/.test(text)) return /^\.title\b/i.test(text);
  const [name, ...fields] = text.split(/\s+/);
  if (!/^[a-z][\w.$:-]*$/i.test(name) || fields.length < 2) return true;
  // A bare title is standard SPICE. Accept common snippets that start with an instance, too.
  if (/^[a-z][0-9_$]/i.test(name) || fields.includes('0')) return false;
  if (/^[rclivb]/i.test(name)) {
    return !/^(?:[+-]?[.\d]|[{']|\w+\s*=|(?:dc|ac|sin|pulse|pwl|exp|sffm|am)(?:\b|\())/i.test(
      fields.slice(2).join(' '),
    );
  }
  return !/^[mdqjxkfhegtswozau]/i.test(name);
}

function fileLines(content, path, section, entry, config) {
  const source = content
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n');
  let language = initialLanguage(content, path);
  let active = !section,
    found = false,
    inSection = '';
  let result = [];
  for (let i = 0; i < source.length; i++) {
    let text = source[i].trim();
    const no = i + 1;
    if (no === 1 && entry && language === 'spice') {
      if (config.titleLine === true || (config.titleLine !== false && isSpiceTitle(text))) continue;
    }
    const change = text.match(/^simulator\s+lang\s*=\s*(spectre|spice)\s*(?:\/\/.*)?$/i);
    if (change) {
      language = change[1].toLowerCase();
      continue;
    }
    if (language === 'spectre') {
      text = text.replace(/\/\/.*$/, '').trim();
      while (text.endsWith('\\') && i + 1 < source.length)
        text = text.slice(0, -1) + ' ' + source[++i].replace(/\/\/.*$/, '').trim();
      if (/^model\s+\S+\s+\w+\s*\{/.test(text) && !text.endsWith('}')) {
        const block = [text];
        while (i + 1 < source.length) {
          const next = source[++i].replace(/\/\/.*$/, '').trim();
          if (next) block.push(next);
          if (next === '}') break;
        }
        if (block.at(-1) !== '}') throw Error(path + ':' + no + ' 模型块缺少结束符 }');
        text = block.join(' ');
      }
      if (/^(?:library\s+\S+|endlibrary(?:\s+\S+)?)$/i.test(text)) continue;
    }
    if (!text || text.startsWith('*')) continue;
    const start = text.match(/^(?:\.lib|section)\s+([^\s"']+)\s*(?:[$;].*)?$/i);
    if (start) {
      if (inSection) throw Error(path + ':' + no + ' 不支持嵌套工艺角定义');
      inSection = start[1].toLowerCase();
      active = !!section && inSection === section.toLowerCase();
      if (active && found) throw Error(path + ' 重复定义工艺角 ' + section);
      if (active) found = true;
      continue;
    }
    if (/^(?:\.endl|endsection)\b/i.test(text)) {
      if (!inSection) throw Error(path + ':' + no + ' 工艺角结束标记缺少定义');
      inSection = '';
      active = !section;
      continue;
    }
    if (active) result.push({ text, language, path, no });
  }
  if (inSection) throw Error(path + ' 工艺角缺少结束标记 ' + inSection);
  if (section && !found) throw Error(path + ' 未定义工艺角 ' + section);
  return result;
}

function flatten(files, entry, config) {
  if (!Array.isArray(files)) throw Error('工程文件需使用 [{path,content}]');
  const byPath = new Map();
  for (const file of files) {
    const path = pathKey(file.path);
    if (byPath.has(path)) throw Error('工程含重复路径 ' + path);
    if (typeof file.content !== 'string') throw Error(path + ' 缺少文本内容');
    byPath.set(path, file.content);
  }
  const records = [],
    stack = [],
    dependencies = new Set();
  let totalChars = 0;
  function visit(path, section = '') {
    if (!byPath.has(path)) throw Error('尚未导入依赖文件 ' + path);
    const key = path + (section ? ' [' + section + ']' : '');
    if (stack.includes(key)) throw Error('循环引用 ' + [...stack, key].join(' → '));
    if (stack.length >= 96) throw Error('模型文件引用超过 96 层');
    const source = byPath.get(path);
    totalChars += source.length;
    if (totalChars > MAX_SOURCE_CHARS)
      throw Error('展开的仿真输入超过 48 M 字符，请选择所需的器件和工艺角');
    if (source.includes('\0')) throw Error(path + ' 含有二进制数据');
    stack.push(key);
    dependencies.add(key);
    for (const line of fileLines(source, path, section, stack.length === 1, config)) {
      const inc = line.text.match(
        /^(\.inc(?:lude)?|\.lib|include)\s+(?:"([^"]+)"|'([^']+)'|([^\s'"]+))(.*)$/i,
      );
      if (inc) {
        let suffix = inc[5].replace(/\s+[$;].*$/, '').trim();
        if (/^section\s*=/i.test(suffix)) suffix = suffix.replace(/^section\s*=\s*/i, '');
        if (/\s|[{}]/.test(suffix) || (inc[1][0] === '.' && !/^\.lib$/i.test(inc[1]) && suffix))
          throw Error(path + ':' + line.no + ' 无法解析模型文件引用');
        const requested = inc[2] ?? inc[3] ?? inc[4];
        const target = pathKey(requested, path.split('/').slice(0, -1));
        try {
          visit(target, suffix);
        } catch (error) {
          throw Error(path + ':' + line.no + ' → ' + error.message);
        }
      } else {
        if (records.length >= MAX_LINES) throw Error('展开的仿真网表超过 ' + MAX_LINES + ' 行');
        records.push(line);
      }
    }
    stack.pop();
  }
  visit(pathKey(entry));
  return { records, dependencies: [...dependencies] };
}

export function engineeringNumber(value) {
  const input = String(value)
    .trim()
    .replace(/M(?=Hz$)/, 'meg')
    .replace(/(?<=[0-9.])A$/, '');
  const m = input.match(
    /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(meg|[tgkmunpfa])?(?:Hz|s|V|A|F|H|ohm)?$/i,
  );
  if (!m) throw Error('参数应为数值或 SPICE 工程单位 ' + value);
  const n =
    Number(m[1]) *
    ({ t: 1e12, g: 1e9, meg: 1e6, k: 1e3, m: 1e-3, u: 1e-6, n: 1e-9, p: 1e-12, f: 1e-15, a: 1e-18 }[
      (m[2] || '').toLowerCase()
    ] ?? 1);
  if (!Number.isFinite(n)) throw Error('参数超出数值范围 ' + value);
  return n;
}

export function analysisCommand(config) {
  const n = engineeringNumber;
  const type = String(config.type).toLowerCase();
  if (type === 'op') return 'op';
  if (type === 'dc') {
    if (!/^[vi][\w.$:-]*$/i.test(config.source)) throw Error('DC 扫描请指定独立电压源或电流源名称');
    const start = n(config.start),
      end = n(config.end),
      step = n(config.step),
      span = (end - start) / step;
    if (!(span > 0 && span <= 99999)) throw Error('DC 步长方向需与起止值一致，采样数上限 100000');
    return ['dc', config.source, start, end, step].join(' ');
  }
  if (type === 'ac') {
    const scale = String(config.scale ?? 'dec').toLowerCase(),
      points = Number(config.points),
      start = n(config.start),
      end = n(config.end);
    if (
      !['dec', 'oct', 'lin'].includes(scale) ||
      !Number.isInteger(points) ||
      points < 1 ||
      !(end > start && start > 0)
    )
      throw Error('AC 扫频需要有序正频率和正整数点数');
    const count =
      scale === 'lin'
        ? points
        : points * (scale === 'dec' ? Math.log10(end / start) : Math.log2(end / start)) + 1;
    if (count > 100000) throw Error('AC 扫频超过 100000 点');
    return ['ac', scale, points, start, end].join(' ');
  }
  if (type === 'tran') {
    const step = n(config.step),
      stop = n(config.stop),
      begin = n(config.begin ?? 0),
      maxStep = n(config.maxStep ?? config.step);
    if (
      !(
        step > 0 &&
        stop >= step &&
        begin >= 0 &&
        begin < stop &&
        maxStep > 0 &&
        (stop - begin) / step <= 99999 &&
        stop / maxStep <= 1000000
      )
    )
      throw Error('请检查瞬态步长、记录起点与停止时间，输出上限 100000 点');
    return ['tran', step, stop, begin, maxStep, config.uic ? 'uic' : ''].join(' ').trim();
  }
  throw Error('请选择 OP、DC、AC 或 TRAN 分析');
}

function fromDirective(line) {
  if (!line) return { type: 'op' };
  const [directive, ...args] = line
    .trim()
    .replace(/\s+[$;].*$/, '')
    .split(/\s+/);
  const type = directive.slice(1).toLowerCase();
  let config = { type };
  if (type === 'ac' && args.length === 4)
    config = { type, scale: args[0], points: Number(args[1]), start: args[2], end: args[3] };
  else if (type === 'dc' && args.length === 4)
    config = { type, source: args[0], start: args[1], end: args[2], step: args[3] };
  else if (type === 'tran') {
    const uic = args.at(-1)?.toLowerCase() === 'uic';
    if (uic) args.pop();
    if (args.length < 2 || args.length > 4) throw Error('请检查 .tran 的步长、停止时间、起点和最大步长');
    config = {
      type,
      step: args[0],
      stop: args[1],
      begin: args[2] ?? '0',
      maxStep: args[3] ?? args[0],
      uic,
    };
  } else if (type !== 'op' || args.length) throw Error('该分析卡参数暂不受支持 ' + line);
  analysisCommand(config);
  return config;
}

export function inferAnalysis(text, path = 'main.cir') {
  const rows = fileLines(text, path, '', true, {});
  let directive;
  for (const row of rows) {
    if (row.language === 'spice' && analysisCard.test(row.text)) directive = row.text;
    if (row.language === 'spectre' && /^\S+\s+(tran|dc|ac)\b/i.test(row.text))
      directive = translateSpectre(row.text, new Map());
  }
  return fromDirective(directive);
}

export function prepareAnalysis({ files, entry, config }) {
  const { records, dependencies } = flatten(files, entry, config ?? {});
  const definitions = spectreDefinitions(records),
    lines = ['* OpenCircuit EDA'];
  const entryPath = pathKey(entry);
  let directive;
  for (const row of records) {
    try {
      if (/^\.(?:control|endc|shell|osdi|pre_osdi|codemodel|spiceinit)\b/i.test(row.text))
        throw Error('请将控制命令移出电路网表，并在分析设置中指定仿真');
      const line = row.language === 'spectre' ? translateSpectre(row.text, definitions) : row.text;
      if (analysisCard.test(line)) {
        if (row.path === entryPath) directive = line;
        continue;
      }
      if (line && !/^\.(?:end|plot|print)\b/i.test(line)) lines.push(line);
    } catch (error) {
      throw Error(row.path + ':' + row.no + ' ' + error.message);
    }
  }
  config = config?.type ? config : fromDirective(directive);
  const command = analysisCommand(config);
  lines.push(
    '.control',
    'set filetype=ascii',
    'set numdgt=12',
    command,
    'write /result.raw',
    'quit',
    '.endc',
    '.end',
    '',
  );
  return {
    deck: lines.join('\n'),
    config: { ...config, type: String(config.type).toLowerCase() },
    dependencies,
  };
}
