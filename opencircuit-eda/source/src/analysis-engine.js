import { prepareAnalysis } from './analysis-deck.js';

const UNITS = {
  voltage: 'V',
  current: 'A',
  frequency: 'Hz',
  time: 's',
  temperature: '°C',
  impedance: 'Ω',
};

function parseTraces(raw, config) {
  const headerEnd = raw.indexOf('Values:');
  if (headerEnd < 0) throw Error('ngspice 没有输出 ASCII 波形');
  const header = raw.slice(0, headerEnd);
  const points = Number(header.match(/No\. Points:\s*(\d+)/)?.[1]);
  const count = Number(header.match(/No\. Variables:\s*(\d+)/)?.[1]);
  if (!points || !count || points > 100000 || count > 5000 || points * count > 2_000_000)
    throw Error('输出点数或信号数量超出浏览器读取预算，请缩小扫描或用 .save 指定节点');
  const complex = /Flags:.*complex/i.test(header);
  const declarations = header.split(/(?:^|\n)Variables:/)[1] || '';
  const vectors = [];
  for (const line of declarations.trim().split('\n')) {
    const field = line.trim().match(/^(\d+)\s+(\S+)\s+(\S+)/);
    if (!field || Number(field[1]) !== vectors.length) throw Error('ngspice 变量索引不完整');
    const name = field[2],
      unit = UNITS[field[3].toLowerCase()] || field[3];
    vectors.push({
      name,
      unit,
      values: new Array(points),
      ...(complex ? { imag: new Array(points) } : {}),
    });
  }
  if (vectors.length !== count) throw Error('ngspice 变量数不一致');
  const lines = raw.slice(headerEnd + 7).matchAll(/[^\r\n]+/g);
  for (let i = 0; i < points; i++) {
    for (let j = 0; j < count; j++) {
      let value = lines.next().value?.[0]?.trim();
      if (!value) throw Error('ngspice 数据流被截断');
      if (j === 0) {
        const index = value.match(/^(\d+)\s+(.+)$/);
        if (!index || Number(index[1]) !== i) throw Error('ngspice 行索引不连续');
        value = index[2];
      }
      const values = value.split(',');
      const real = Number(values[0]),
        imag = Number(values[1] ?? 0);
      if (!Number.isFinite(real) || !Number.isFinite(imag)) throw Error('ngspice 返回了发散的波形');
      vectors[j].values[i] = real;
      if (complex) vectors[j].imag[i] = imag;
    }
  }
  let x = { name: 'point', unit: '', values: [0] };
  if (config.type !== 'op') {
    const first = vectors.shift();
    x = { name: first.name, unit: first.unit, values: first.values };
    if (config.type === 'dc') {
      x.name = config.source;
      x.unit = /^i/i.test(config.source) ? 'A' : 'V';
    }
  }
  return { points, x, traces: vectors };
}

export async function executeAnalysis(request, createModule) {
  const start = performance.now(),
    { deck, config, dependencies } = prepareAnalysis(request),
    logs = [];
  let fatal = '';
  function log(message) {
    const line = String(message);
    if (logs.length < 600) logs.push(line.slice(0, 1200));
    if (
      !fatal &&
      /(?:simulation(?:\(s\))? aborted|run simulation\(s\) aborted|timestep too small|unrecognized parameter.*ignored|unknown parameter.*ignored|^error(?:\s|:)|doanalyses:.*failed)/i.test(
        line,
      )
    )
      fatal = line;
  }
  const module = await createModule({
    noInitialRun: true,
    noExitRuntime: true,
    print: log,
    printErr: log,
  });
  module.FS.writeFile(
    '/proc/meminfo',
    'MemTotal: 262144 kB\nMemFree: 131072 kB\nMemAvailable: 131072 kB\n',
  );
  module.FS.writeFile('/circuit.cir', deck);
  let status;
  try {
    status = module.callMain(['-b', '/circuit.cir']);
  } catch (error) {
    if (error.status !== 0) throw Error([error.message, ...logs.slice(-12)].join('\n'));
  }
  if (fatal || status || !module.FS.analyzePath('/result.raw').exists) {
    throw Error([fatal || 'ngspice 求解失败', ...logs.slice(-15)].join('\n'));
  }
  if (module.FS.stat('/result.raw').size > 48_000_000)
    throw Error('求解结果超过 48 MB，请减小采样点数或用 .save 限定信号');
  const result = parseTraces(module.FS.readFile('/result.raw', { encoding: 'utf8' }), config);
  return {
    ...result,
    analysis: config.type,
    engine: 'ngspice-46 / WebAssembly',
    dependencies,
    logs,
    elapsedMs: Math.round(performance.now() - start),
  };
}
