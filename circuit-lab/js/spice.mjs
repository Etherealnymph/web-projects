/** Browser-local ngspice project validation, analysis setup and raw result reader. */
export const LIMITS = {
  fileBytes: 5_000_000,
  projectBytes: 15_000_000,
  files: 100,
  points: 100000,
  variables: 1000,
};
export function safePath(input) {
  const name = String(input).replaceAll('\\', '/').replace(/^\.\//, '');
  if (
    !name ||
    name.startsWith('/') ||
    name.split('/').some((p) => !p || p === '..' || p === '.') ||
    /[\x00-\x1f<>:"|?*]/.test(name) ||
    name.length > 220
  )
    throw Error('文件路径应为工程内的相对路径，不能包含 .. 或特殊控制字符');
  return name;
}
export function number(value) {
  const match = String(value)
    .trim()
    .match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(meg|[tgkmunpf])?(?:[a-z]*)$/i);
  if (!match) throw Error('无法读取数值 ' + value);
  const scale = { t: 1e12, g: 1e9, meg: 1e6, k: 1e3, m: 1e-3, u: 1e-6, n: 1e-9, p: 1e-12, f: 1e-15 };
  const result = Number(match[1]) * (scale[(match[2] || '').toLowerCase()] || 1);
  if (!Number.isFinite(result)) throw Error('数值超出范围');
  return result;
}
export function validateFiles(files) {
  if (!Array.isArray(files) || files.length > LIMITS.files) throw Error('每个工程最多 100 个文本文件');
  const names = new Set();
  let bytes = 0;
  return files.map((file) => {
    const path = safePath(file.path);
    if (names.has(path)) throw Error('重复文件 ' + path);
    names.add(path);
    if (typeof file.content !== 'string') throw Error('文件缺少文本内容 ' + path);
    const size = new TextEncoder().encode(file.content).length;
    bytes += size;
    if (size > LIMITS.fileBytes || bytes > LIMITS.projectBytes)
      throw Error('文件过大，单文件上限 5 MB，工程上限 15 MB');
    return { path, content: file.content };
  });
}
export function analysisCommand(config) {
  const positive = (value) => {
    const n = number(value);
    if (n <= 0) throw Error('分析参数必须大于零');
    return n;
  };
  if (config.type === 'op') return 'op';
  if (config.type === 'tran') {
    const step = positive(config.step),
      stop = positive(config.stop);
    if (step > stop || stop / step > 100000)
      throw Error('瞬态步长必须小于总时长，输出间隔最多 100000 个');
    const begin = number(config.begin ?? '0'),
      maxStep = positive(config.maxStep ?? config.step);
    if (begin < 0 || begin >= stop || stop / maxStep > 1000000)
      throw Error('记录起点或最大内部步长不合法');
    return `tran ${step} ${stop} ${begin} ${maxStep}${config.uic ? ' uic' : ''}`;
  }
  if (config.type === 'ac') {
    const points = Number(config.points),
      start = positive(config.start),
      end = positive(config.end);
    if (
      !Number.isInteger(points) ||
      points < 1 ||
      points > 500 ||
      end <= start ||
      Math.log10(end / start) * points > 20000
    )
      throw Error('AC 扫频范围或每十倍频程点数不合法');
    const scale = config.scale || 'dec';
    if (!['dec', 'oct', 'lin'].includes(scale)) throw Error('扫频分布需为 dec/oct/lin');
    return `ac ${scale} ${points} ${start} ${end}`;
  }
  if (config.type === 'dc') {
    if (!/^[vi][a-z0-9_.$-]+$/i.test(config.source || '')) throw Error('DC 扫描需填写电压源/电流源名称');
    const start = number(config.start),
      end = number(config.end),
      step = number(config.step);
    if (!step || (end - start) / step <= 0 || Math.abs((end - start) / step) > 20000)
      throw Error('DC 步长方向错误或超过 20000 点');
    return `dc ${config.source} ${start} ${end} ${step}`;
  }
  throw Error('选择 OP、TRAN、AC 或 DC 分析');
}
export function prepareDeck(text, config) {
  if (typeof text !== 'string' || !text.trim()) throw Error('网表为空');
  if (text.includes('\0')) throw Error('网表包含二进制数据');
  if (/^\s*\.control\b/im.test(text))
    throw Error(
      '请移除 .control/.endc 命令块，并在分析面板选择 OP/TRAN/AC/DC；器件、.model、.subckt 和 .include 可直接保留',
    );
  const lines = text.replaceAll('\r', '').split('\n');
  // Standard SPICE reserves its first line for a title. Snippets explicitly opt out.
  if (config.titleLine !== false) lines.shift();
  const body = lines.filter((line) => !/^\s*\.(end|op|tran|ac|dc|print|plot)\b/i.test(line)).join('\n');
  return `* Guanlan Circuit Lab\n${body}\n.control\nset filetype=ascii\nset numdgt=10\n${analysisCommand(config)}\nwrite /result.raw\nquit\n.endc\n.end\n`;
}
export function parseRaw(raw) {
  const headerEnd = raw.indexOf('Values:');
  if (headerEnd < 0) throw Error('仿真没有产生 ASCII 数据，请查看引擎日志');
  const header = raw.slice(0, headerEnd);
  const count = Number(header.match(/No\. Variables:\s*(\d+)/)?.[1]);
  const points = Number(header.match(/No\. Points:\s*(\d+)/)?.[1]);
  if (!count || !points || count > LIMITS.variables || points > LIMITS.points)
    throw Error('结果超出浏览器读取上限，减小仿真时长或保存的变量数');
  const variables = [];
  const variablesText = header.split(/(?:^|\n)Variables:/)[1] || '';
  for (const line of variablesText.trim().split('\n')) {
    const match = line.trim().match(/^(\d+)\s+(\S+)\s+(\S+)/);
    if (match)
      variables.push({
        name: match[2],
        unit: match[3],
        real: new Float64Array(points),
        imag: new Float64Array(points),
      });
  }
  if (variables.length !== count) throw Error('结果变量头不完整');
  const lines = raw
    .slice(headerEnd + 7)
    .trim()
    .split('\n');
  let cursor = 0;
  for (let row = 0; row < points; row++)
    for (let column = 0; column < count; column++) {
      while (cursor < lines.length && !lines[cursor].trim()) cursor++;
      let value = lines[cursor++]?.trim();
      if (value == null) throw Error('仿真数据被截断');
      if (column === 0) {
        const match = value.match(/^(\d+)\s+(.+)$/);
        if (!match || Number(match[1]) !== row) throw Error('结果行索引不连续');
        value = match[2];
      }
      const parts = value.split(',').map(Number);
      if (!parts.every(Number.isFinite) || parts.length > 2) throw Error('结果包含无效数值');
      variables[column].real[row] = parts[0];
      variables[column].imag[row] = parts[1] || 0;
    }
  return {
    title: header.match(/Title:\s*(.*)/)?.[1] || '',
    plot: header.match(/Plotname:\s*(.*)/)?.[1] || '',
    complex: /Flags:.*complex/.test(header),
    points,
    variables,
  };
}
export function csv(result) {
  const columns = result.variables.flatMap((v) =>
    result.complex ? [v.name + '.real', v.name + '.imag'] : [v.name],
  );
  const rows = [columns.map((s) => JSON.stringify(s)).join(',')];
  for (let i = 0; i < result.points; i++)
    rows.push(
      result.variables.flatMap((v) => (result.complex ? [v.real[i], v.imag[i]] : [v.real[i]])).join(','),
    );
  return rows.join('\n');
}

export function inferAnalysis(text) {
  const directives = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\.(op|tran|ac|dc)\b/i.test(line));
  if (!directives.length) return { type: 'op' };
  const tokens = directives[directives.length - 1].split(/\s+/),
    type = tokens[0].slice(1).toLowerCase();
  let config = { type };
  if (type === 'tran') {
    const args = tokens.slice(1).filter((token) => token.toLowerCase() !== 'uic');
    config = {
      type,
      step: args[0],
      stop: args[1],
      begin: args[2] || '0',
      maxStep: args[3] || args[0],
      uic: tokens.some((token) => token.toLowerCase() === 'uic'),
    };
  }
  if (type === 'ac')
    config = {
      type,
      scale: tokens[1].toLowerCase(),
      points: tokens[2],
      start: tokens[3],
      end: tokens[4],
    };
  if (type === 'dc') {
    if (tokens.length !== 5) throw Error('嵌套 DC 扫描暂不支持，请选择单个扫描源');
    config = { type, source: tokens[1], start: tokens[2], end: tokens[3], step: tokens[4] };
  }
  analysisCommand(config);
  return config;
}
