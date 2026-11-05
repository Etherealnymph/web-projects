import { EXAMPLES } from './examples.mjs';
import { validateFiles, safePath, csv, analysisCommand, inferAnalysis } from './spice.mjs';
import {
  parseComponents,
  changeComponent,
  removeComponent,
  parseSymbol,
  importASC,
  importTheme,
} from './schematic.mjs';
import {
  drawSchematic,
  drawPlot,
  symbolPreview,
  traceValue,
  sampleAtFraction,
  COLORS,
} from './view.mjs';
const $ = (id) => document.getElementById(id);
const state = {
  version: 1,
  title: '',
  files: [],
  entry: 'main.cir',
  config: { type: 'op' },
  layout: {},
  symbols: {},
  theme: {},
  example: 'divider',
};
let result = null,
  held = null,
  selected = null,
  wireStart = null,
  worker = null,
  timer = null,
  saveTimer = null;
let activeFile = 'main.cir',
  traceNames = new Set(),
  sample = 0,
  history = [],
  future = [],
  generation = 0;
const dbPromise = new Promise((resolve, reject) => {
  const request = indexedDB.open('ethereal.circuit-lab', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('workspace');
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
function notice(message, error = false) {
  $('toast').textContent = message;
  $('toast').classList.toggle('error', error);
  $('toast').hidden = false;
  clearTimeout(notice.timer);
  notice.timer = setTimeout(() => ($('toast').hidden = true), 4500);
}
function file() {
  return state.files.find((f) => f.path === state.entry);
}
function pushHistory() {
  history.push(JSON.stringify(state));
  if (history.length > 25) history.shift();
  future = [];
}
function dirty() {
  $('save-status').textContent = '正在保存…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const db = await dbPromise;
      await new Promise((resolve, reject) => {
        const tx = db.transaction('workspace', 'readwrite');
        tx.objectStore('workspace').put(JSON.parse(JSON.stringify(state)), 'current');
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      $('save-status').textContent = '已保存到本机';
    } catch (error) {
      $('save-status').textContent = '保存失败，请导出工程';
      notice('本机存储不可用，请导出工程备份', true);
    }
  }, 350);
}
function download(name, text, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function stop(message = '已停止') {
  generation++;
  if (worker) worker.terminate();
  worker = null;
  clearTimeout(timer);
  $('run').disabled = false;
  $('cancel').disabled = true;
  if (message) $('run-status').textContent = message;
}
function invalidate() {
  stop('工程已修改，运行后更新波形');
  result = null;
  sample = 0;
  renderResult();
}
function renderCases() {
  const q = $('search').value.trim().toLowerCase(),
    category = $('category').value;
  $('examples').replaceChildren();
  for (const ex of EXAMPLES) {
    if (category && category !== ex.group) continue;
    if (q && !`${ex.title} ${ex.group} ${ex.question}`.toLowerCase().includes(q)) continue;
    const b = document.createElement('button');
    b.className = 'example' + (state.example === ex.id ? ' active' : '');
    b.textContent = ex.title;
    const small = document.createElement('small');
    small.textContent = ex.group;
    b.append(small);
    b.addEventListener('click', () => {
      if (
        state.files.some((f) => f.content.length > 100000) &&
        !confirm('切换案例会替换当前工程，请先导出备份。继续？')
      )
        return;
      pushHistory();
      loadExample(ex);
    });
    $('examples').append(b);
  }
}
function loadExample(ex) {
  stop();
  Object.assign(state, {
    title: ex.title,
    files: [{ path: 'main.cir', content: ex.netlist }],
    entry: 'main.cir',
    config: { ...ex.analysis },
    layout: {},
    symbols: {},
    example: ex.id,
  });
  activeFile = state.entry;
  selected = null;
  held = null;
  result = null;
  traceNames = new Set(ex.probes);
  renderAll();
  dirty();
}
function renderAnalysis() {
  $('analysis').value = state.config.type;
  const host = $('analysis-fields');
  host.replaceChildren();
  const titleLabel = document.createElement('label'),
    titleCheckbox = document.createElement('input');
  titleCheckbox.type = 'checkbox';
  titleCheckbox.checked = state.config.titleLine !== false;
  titleCheckbox.style.width = 'auto';
  titleCheckbox.addEventListener('change', () => {
    state.config.titleLine = titleCheckbox.checked;
    invalidate();
    dirty();
  });
  titleLabel.append(titleCheckbox, document.createTextNode(' 首行按 SPICE 标题处理'));
  host.append(titleLabel);
  const specs = {
    op: [],
    tran: [
      ['step', '输出步长', '10u'],
      ['stop', '总时长', '10m'],
      ['begin', '记录起点', '0'],
      ['maxStep', '最大内部步长', '10u'],
    ],
    ac: [
      ['start', '起始频率 / Hz', '10'],
      ['end', '结束频率 / Hz', '10meg'],
      ['points', '每十倍频程点数', '40'],
    ],
    dc: [
      ['source', '扫描源名称', 'V1'],
      ['start', '起点', '0'],
      ['end', '终点', '5'],
      ['step', '步长', '0.01'],
    ],
  };
  for (const [key, label, initial] of specs[state.config.type]) {
    state.config[key] ??= key === 'maxStep' ? state.config.step : initial;
    const row = document.createElement('label');
    row.textContent = label;
    const input = document.createElement('input');
    input.value = state.config[key];
    input.setAttribute('aria-label', label);
    input.addEventListener('change', () => {
      state.config[key] = input.value;
      invalidate();
      dirty();
    });
    row.append(input);
    host.append(row);
  }
  if (state.config.type === 'tran') {
    const label = document.createElement('label'),
      input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!state.config.uic;
    input.style.width = 'auto';
    input.addEventListener('change', () => {
      state.config.uic = input.checked;
      invalidate();
      dirty();
    });
    label.append(input, document.createTextNode(' 使用初始条件 UIC'));
    host.append(label);
  }
}
function renderFiles() {
  const select = $('file-select');
  select.replaceChildren();
  for (const f of state.files) {
    const option = document.createElement('option');
    option.value = f.path;
    option.textContent = f.path + (f.path === state.entry ? ' · 主网表' : '');
    select.append(option);
  }
  if (!state.files.some((f) => f.path === activeFile)) activeFile = state.entry;
  select.value = activeFile;
  $('netlist').value = state.files.find((f) => f.path === activeFile)?.content || '';
}
function renderLesson() {
  const ex = EXAMPLES.find((ex) => ex.id === state.example);
  $('lesson').replaceChildren();
  if (ex) {
    const strong = document.createElement('strong');
    strong.textContent = ex.question;
    $('lesson').append(strong, document.createTextNode(ex.explanation));
  } else $('lesson').textContent = '你的电路工程 · 检查模型与分析条件，再用波形验证设计。';
  $('title').textContent = state.title;
}
function renderDiagram() {
  const parsed = parseComponents(file()?.content || '');
  const selector = $('component-select');
  selector.replaceChildren(new Option('选择器件…', ''));
  for (const c of parsed.components) selector.add(new Option(c.name + ' · ' + c.value, c.name));
  selector.value = selected || '';
  $('diagram-note').textContent =
    `${parsed.components.length} 个顶层器件${parsed.skipped.length ? ' · ' + parsed.skipped.length + ' 行未映射为图形' : ''}`;
  drawSchematic(
    $('schematic'),
    parsed.components,
    state.layout,
    selected,
    (name) => {
      selected = name;
      renderDiagram();
      renderInspector();
    },
    connectPins,
    () => {
      dirty();
      renderDiagram();
    },
  );
}
function connectPins(component, index) {
  if (!wireStart) {
    wireStart = { name: component.name, index, node: component.nodes[index] };
    notice('已选择 ' + component.name + '，再点另一器件的引脚连接');
    return;
  }
  const start = wireStart;
  wireStart = null;
  if (start.name === component.name && start.index === index) return;
  const target = component.nodes[index];
  if (target === '0' && start.node !== '0' && !confirm('这会把所选引脚接地，继续？')) return;
  pushHistory();
  const mergedNode = start.node === '0' || target === '0' ? '0' : start.node;
  const replacedNode = mergedNode === start.node ? target : start.node;
  let next = file().content;
  for (const c of parseComponents(next).components) {
    if (c.nodes.includes(replacedNode))
      next = changeComponent(next, c.name, {
        nodes: c.nodes.map((node) => (node === replacedNode ? mergedNode : node)),
      });
  }
  file().content = next;
  invalidate();
  renderDiagram();
  renderFiles();
  renderInspector();
  dirty();
}
function renderInspector() {
  const host = $('component-details');
  host.replaceChildren();
  const c = parseComponents(file()?.content || '').components.find((c) => c.name === selected);
  if (!c) {
    host.textContent = '点选器件，修改值或引脚对应节点。';
    return;
  }
  const title = document.createElement('b');
  title.textContent = c.name;
  host.append(title);
  const inputs = [];
  for (let i = 0; i < c.nodes.length; i++) {
    const label = document.createElement('label');
    label.textContent = `引脚 ${i + 1} 节点`;
    const input = document.createElement('input');
    input.value = c.nodes[i];
    input.setAttribute('aria-label', `${c.name} 引脚 ${i + 1}`);
    label.append(input);
    host.append(label);
    inputs.push(input);
  }
  const valueLabel = document.createElement('label');
  valueLabel.textContent = '值 / 模型 / 参数';
  const value = document.createElement('input');
  value.value = c.value;
  value.setAttribute('aria-label', '器件参数');
  valueLabel.append(value);
  host.append(valueLabel);
  const apply = document.createElement('button');
  apply.textContent = '应用参数';
  apply.addEventListener('click', () => {
    try {
      const next = changeComponent(file().content, c.name, {
        nodes: inputs.map((i) => i.value.trim()),
        value: value.value,
      });
      pushHistory();
      file().content = next;
      invalidate();
      renderDiagram();
      renderFiles();
      dirty();
    } catch (error) {
      notice(error.message, true);
    }
  });
  const remove = document.createElement('button');
  remove.textContent = '删除器件';
  remove.addEventListener('click', () => {
    pushHistory();
    file().content = removeComponent(file().content, c.name);
    delete state.layout[c.name];
    selected = null;
    invalidate();
    renderDiagram();
    renderFiles();
    renderInspector();
    dirty();
  });
  host.append(apply, remove);
}
function appendComponent(prefix, count, value, symbol) {
  const comps = parseComponents(file().content).components;
  let i = 1;
  while (comps.some((c) => c.name.toLowerCase() === (prefix + i).toLowerCase())) i++;
  const name = prefix + i;
  const nodes = Array.from({ length: count }, (_, j) =>
    j === count - 1 ? '0' : `n${comps.length + 1}_${j + 1}`,
  );
  pushHistory();
  file().content =
    file().content.replace(/^\s*\.end\s*$/im, '') + `\n${name} ${nodes.join(' ')} ${value}\n.end\n`;
  state.layout[name] = {
    x: 150 + (comps.length % 3) * 265,
    y: 150 + Math.floor(comps.length / 3) * 135,
    ...(symbol ? { symbol } : {}),
  };
  selected = name;
  invalidate();
  renderDiagram();
  renderFiles();
  renderInspector();
  dirty();
}
function renderSymbols() {
  const host = $('symbols');
  host.replaceChildren();
  const entries = Object.entries(state.symbols);
  if (!entries.length) {
    host.textContent = '导入 .asy 预览符号与引脚顺序。';
    return;
  }
  for (const [name, symbol] of entries) {
    const details = document.createElement('details'),
      summary = document.createElement('summary');
    summary.textContent = name + ` · ${symbol.pins.length} 引脚`;
    details.append(summary, symbolPreview(symbol));
    const button = document.createElement('button');
    button.textContent = '放置此符号';
    button.addEventListener('click', () => {
      const prefix = symbol.attributes.Prefix || 'X',
        value = symbol.attributes.Value || symbol.attributes.SpiceModel || name;
      if (!/^[RCLVIDMQXEGFBHS]$/i.test(prefix)) {
        notice('不支持此器件前缀 ' + prefix, true);
        return;
      }
      appendComponent(prefix.toUpperCase(), symbol.pins.length, value, name);
      if (symbol.attributes.ModelFile)
        notice('请检查网表并加入对应 .include ' + symbol.attributes.ModelFile);
    });
    details.append(button);
    host.append(details);
  }
}
function applyTheme() {
  for (const key of ['background', 'panel', 'text', 'muted', 'accent', 'wire', 'grid'])
    document.documentElement.style.removeProperty('--' + key);
  document.documentElement.style.colorScheme = '';
  for (const [key, value] of Object.entries(state.theme))
    document.documentElement.style.setProperty('--' + key, value);
  if (state.theme.background) {
    const rgb = state.theme.background.match(/[0-9a-f]{2}/gi).map((n) => parseInt(n, 16));
    document.documentElement.style.colorScheme = rgb[0] + rgb[1] + rgb[2] > 420 ? 'light' : 'dark';
  }
}
function renderAll() {
  renderLesson();
  renderCases();
  renderAnalysis();
  renderFiles();
  renderDiagram();
  renderInspector();
  renderSymbols();
  applyTheme();
  renderResult();
}
function renderResult() {
  const host = $('traces');
  host.replaceChildren();
  if (result) {
    const candidates = result.variables.filter((v, i) => i > 0 || /Operating Point/.test(result.plot));
    if (!candidates.some((v) => traceNames.has(v.name)))
      traceNames = new Set(candidates.slice(0, 3).map((v) => v.name));
    for (const [index, v] of candidates.entries()) {
      const label = document.createElement('label');
      label.style.color = COLORS[index % COLORS.length];
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = traceNames.has(v.name);
      box.addEventListener('change', () => {
        if (box.checked) traceNames.add(v.name);
        else traceNames.delete(v.name);
        plot();
      });
      label.append(box, document.createTextNode(v.name + ' / ' + v.unit));
      host.append(label);
    }
    $('sample').max = result.points - 1;
    $('sample').value = Math.min(sample, result.points - 1);
  }
  $('csv').disabled = !result;
  $('hold').disabled = !result;
  plot();
}
function plot() {
  drawPlot($('plot'), result, traceNames, $('plot-mode').value, sample, held);
  const host = $('measurements');
  host.replaceChildren();
  if (!result) {
    $('cursor').textContent = '运行后，将鼠标移到波形查看数据';
    return;
  }
  const row = Math.min(sample, result.points - 1);
  $('cursor').textContent = /Operating Point/.test(result.plot)
    ? '直流工作点'
    : result.variables[0].name + ' = ' + result.variables[0].real[row].toPrecision(5);
  for (const v of result.variables.filter((v) => traceNames.has(v.name))) {
    const span = document.createElement('span');
    span.textContent = v.name + ' ';
    const b = document.createElement('b');
    b.textContent = traceValue(v, row, $('plot-mode').value).toPrecision(5);
    span.append(
      b,
      document.createTextNode(
        ' ' + ($('plot-mode').value === 'db' ? 'dB' : $('plot-mode').value === 'phase' ? '°' : v.unit),
      ),
    );
    host.append(span);
  }
  for (const wire of $('schematic').querySelectorAll('[data-node]')) {
    const voltage = result.variables.find(
      (variable) => variable.name.toLowerCase() === 'v(' + wire.dataset.node.toLowerCase() + ')',
    );
    if (!voltage) continue;
    const value = voltage.real[row];
    wire.style.stroke = Math.abs(value) < 1e-9 ? 'var(--wire)' : value > 0 ? '#dfb17c' : '#78aee9';
    wire.style.opacity = String(Math.min(1, 0.4 + Math.abs(value) / 5));
  }
}
async function run() {
  try {
    analysisCommand(state.config);
    stop('正在初始化 ngspice…');
    const own = ++generation;
    worker = new Worker(new URL('./worker.mjs', import.meta.url), { type: 'module' });
    $('run').disabled = true;
    $('cancel').disabled = false;
    $('log').textContent = '';
    timer = setTimeout(() => {
      if (own === generation) {
        stop('超过 45 秒，仿真已停止');
        notice('仿真超时，可减少分析时长或排查收敛问题', true);
      }
    }, 45000);
    worker.onmessage = (event) => {
      if (own !== generation) return;
      const data = event.data;
      stop(data.ok ? `完成 · ${Math.round(data.elapsed)} ms · ${data.result.points} 点` : '仿真失败');
      if (data.ok) {
        held = held?.plot === data.result.plot ? held : null;
        result = data.result;
        sample = 0;
        $('log').textContent = result.logs.join('\n');
        renderResult();
      } else {
        $('log').textContent = data.error;
        $('log-details').open = true;
        notice('仿真失败，请查看日志', true);
      }
    };
    worker.onerror = (event) => {
      stop('引擎加载失败');
      $('log').textContent = event.message;
      $('log-details').open = true;
    };
    worker.postMessage({ files: state.files, entry: state.entry, config: state.config });
  } catch (error) {
    notice(error.message, true);
  }
}
function validateProject(input) {
  if (input?.version !== 1 || !input.files || !['op', 'tran', 'ac', 'dc'].includes(input.config?.type))
    throw Error('工程版本或分析类型不支持');
  const files = validateFiles(input.files),
    entry = safePath(input.entry);
  if (!files.some((f) => f.path === entry)) throw Error('主网表文件不存在');
  const symbols = {};
  for (const f of files.filter((f) => /\.asy$/i.test(f.path)))
    symbols[f.path.replace(/\.asy$/i, '').toLowerCase()] = parseSymbol(f.content, f.path);
  const layout = {};
  for (const [name, pos] of Object.entries(input.layout || {})) {
    if (
      Number.isFinite(pos.x) &&
      Number.isFinite(pos.y) &&
      Math.abs(pos.x) < 100000 &&
      Math.abs(pos.y) < 100000
    )
      layout[name] = { x: pos.x, y: pos.y };
  }
  return {
    version: 1,
    title: String(input.title || '导入工程').slice(0, 120),
    files,
    entry,
    config: input.config,
    layout,
    symbols,
    theme: importTheme(JSON.stringify({ ...{ accent: '#70d7c6' }, ...input.theme })),
    example: input.example || null,
  };
}
async function importFiles(list) {
  try {
    const incoming = [];
    for (const f of list) {
      if (f.size > 5_000_000) throw Error('单文件上限 5 MB');
      incoming.push({ path: safePath(f.webkitRelativePath || f.name), content: await f.text() });
    }
    validateFiles(incoming);
    if (
      incoming.length === 1 &&
      /\.json$/i.test(incoming[0].path) &&
      !/\.theme\.json$/i.test(incoming[0].path)
    ) {
      const next = validateProject(JSON.parse(incoming[0].content));
      pushHistory();
      Object.assign(state, next);
      activeFile = state.entry;
      invalidate();
      renderAll();
      dirty();
      notice('工程已导入');
      return;
    }
    const next = JSON.parse(JSON.stringify(state));
    for (const f of incoming) {
      if (/\.theme\.json$/i.test(f.path)) {
        next.theme = { ...next.theme, ...importTheme(f.content) };
        continue;
      }
      const old = next.files.find((item) => item.path === f.path);
      if (old) old.content = f.content;
      else next.files.push(f);
      if (/\.asy$/i.test(f.path))
        next.symbols[f.path.replace(/\.asy$/i, '').toLowerCase()] = parseSymbol(f.content, f.path);
    }
    const asc = incoming.find((f) => /\.asc$/i.test(f.path));
    if (asc) {
      const converted = importASC(asc.content, next.symbols);
      const path = asc.path.replace(/\.asc$/i, '.cir');
      next.files = next.files.filter((f) => f.path !== path);
      next.files.push({ path, content: converted.netlist });
      next.entry = path;
      next.layout = converted.layout;
    } else {
      const main = incoming.find((f) => /\.(cir|sp|spice|net)$/i.test(f.path));
      if (main) {
        next.entry = main.path;
        next.layout = {};
      }
    }
    next.files = validateFiles(next.files);
    if (asc || incoming.some((f) => f.path === next.entry))
      next.config = inferAnalysis(next.files.find((f) => f.path === next.entry).content);
    next.title = asc?.path || next.entry;
    next.example = null;
    pushHistory();
    Object.assign(state, next);
    activeFile = state.entry;
    selected = null;
    invalidate();
    renderAll();
    dirty();
    notice('文件已导入，检查分析设置后运行');
  } catch (error) {
    notice(error.message, true);
  }
}
for (const group of new Set(EXAMPLES.map((ex) => ex.group))) {
  const option = document.createElement('option');
  option.textContent = group;
  option.value = group;
  $('category').append(option);
}
$('case-count').textContent = EXAMPLES.length + ' 例';
$('search').addEventListener('input', renderCases);
$('category').addEventListener('change', renderCases);
$('run').addEventListener('click', run);
$('cancel').addEventListener('click', () => stop());
$('analysis').addEventListener('change', () => {
  pushHistory();
  state.config = { type: $('analysis').value };
  renderAnalysis();
  invalidate();
  dirty();
});
for (const [id, pane] of [
  ['schematic', 'schematic-pane'],
  ['netlist', 'netlist-pane'],
])
  $('tab-' + id).addEventListener('click', () => {
    for (const other of ['schematic', 'netlist']) {
      $('tab-' + other).classList.toggle('active', other === id);
      $(other + '-pane').hidden = other !== id;
    }
    if (id === 'netlist') renderFiles();
  });
$('component-select').addEventListener('change', () => {
  selected = $('component-select').value || null;
  renderDiagram();
  renderInspector();
});
$('make-entry').addEventListener('click', () => {
  try {
    const config = inferAnalysis(state.files.find((f) => f.path === activeFile).content);
    pushHistory();
    state.entry = activeFile;
    state.config = config;
    state.example = null;
    state.title = activeFile;
    state.layout = {};
    selected = null;
    invalidate();
    renderAll();
    dirty();
  } catch (error) {
    notice(error.message, true);
  }
});
$('file-select').addEventListener('change', () => {
  activeFile = $('file-select').value;
  renderFiles();
});
$('netlist').addEventListener('focus', pushHistory);
$('netlist').addEventListener('input', () => {
  state.files.find((f) => f.path === activeFile).content = $('netlist').value;
  state.example = null;
  invalidate();
  renderDiagram();
  dirty();
});
$('add').addEventListener('click', () => {
  const type = $('add-type').value;
  appendComponent(
    type,
    type === 'M' ? 4 : 2,
    { R: '1k', C: '100n', L: '1m', V: 'DC 1', I: 'DC 1m', D: 'DIO', M: 'NM W=10u L=1u' }[type],
  );
});
$('arrange').addEventListener('click', () => {
  pushHistory();
  state.layout = {};
  renderDiagram();
  dirty();
});
$('undo').addEventListener('click', () => {
  if (!history.length) return;
  future.push(JSON.stringify(state));
  Object.assign(state, JSON.parse(history.pop()));
  invalidate();
  renderAll();
  dirty();
});
$('redo').addEventListener('click', () => {
  if (!future.length) return;
  history.push(JSON.stringify(state));
  Object.assign(state, JSON.parse(future.pop()));
  invalidate();
  renderAll();
  dirty();
});
$('import').addEventListener('click', () => $('file-input').click());
$('folder').addEventListener('click', () => $('folder-input').click());
for (const id of ['file-input', 'folder-input'])
  $(id).addEventListener('change', async () => {
    await importFiles([...$(id).files]);
    $(id).value = '';
  });
$('save').addEventListener('click', () =>
  download('circuit-project.json', JSON.stringify(state, null, 2), 'application/json'),
);
$('export-netlist').addEventListener('click', () =>
  download(state.entry.split('/').pop(), file().content),
);
$('csv').addEventListener('click', () => {
  if (result) download('waveforms.csv', csv(result), 'text/csv');
});
$('hold').addEventListener('click', () => {
  held = result;
  notice('本次结果已保留，下一次运行以虚线对照');
});
$('plot-mode').addEventListener('change', plot);
$('sample').addEventListener('input', () => {
  sample = Number($('sample').value);
  plot();
});
$('plot').addEventListener('pointermove', (event) => {
  if (!result) return;
  const rect = $('plot').getBoundingClientRect();
  const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left - 50) / (rect.width - 66)));
  sample = sampleAtFraction(result, fraction);
  $('sample').value = sample;
  plot();
});
$('help').addEventListener('click', () => $('help-dialog').showModal());
document.querySelector('.dialog-close').addEventListener('click', () => $('help-dialog').close());
$('send-note').addEventListener('click', () => {
  try {
    if (file().content.length > 75000) throw Error('网表太大，请导出工程后记录附件');
    localStorage.setItem(
      'ethereal.workspace.handoff.v1',
      JSON.stringify({
        kind: 'circuit',
        title: state.title,
        body: `## 仿真条件\n分析 ${state.config.type.toUpperCase()}\n网表 ${state.entry}\n设置 ${JSON.stringify(state.config)}\n${result ? '已运行 ' + result.plot + '，' + result.points + ' 点' : '尚未运行'}\n\n## 当前样本读数\n${
          result
            ? result.variables
                .filter((v) => traceNames.has(v.name) || v === result.variables[0])
                .map(
                  (v) =>
                    v.name +
                    ' = ' +
                    v.real[sample] +
                    (result.complex ? ' + j(' + v.imag[sample] + ')' : '') +
                    ' ' +
                    v.unit,
                )
                .join('\n')
            : '待仿真'
        }\n\n## 观察与结论\n记录模型来源、适用条件和下一步验证。`,
        netlist: file().content,
        source: '观澜电路',
        createdAt: new Date().toISOString(),
      }),
    );
    location.href = '../silicon-notes/';
  } catch (error) {
    notice('跨项目交接失败，请导出工程', true);
  }
});
window.addEventListener('resize', plot);
window.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    run();
  }
  if (event.key === 'Escape') wireStart = null;
});
window.addEventListener('dragover', (event) => event.preventDefault());
window.addEventListener('drop', (event) => {
  event.preventDefault();
  if (event.dataTransfer.files.length) importFiles([...event.dataTransfer.files]);
});
async function boot() {
  loadExample(EXAMPLES[0]);
  clearTimeout(saveTimer);
  try {
    const db = await dbPromise;
    const saved = await new Promise((resolve, reject) => {
      const req = db.transaction('workspace').objectStore('workspace').get('current');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (saved) {
      Object.assign(state, validateProject(saved));
      activeFile = state.entry;
      renderAll();
      $('save-status').textContent = '已恢复本机工程';
    }
  } catch (error) {
    $('save-status').textContent = '使用临时工作区，建议导出';
  }
  try {
    const raw = localStorage.getItem('ethereal.workspace.handoff.v1'),
      handoff = raw && JSON.parse(raw);
    if (
      handoff?.kind === 'circuit' &&
      typeof handoff.netlist === 'string' &&
      handoff.netlist.length < 1000000
    ) {
      $('handoff').hidden = false;
      $('handoff').textContent = '收到设计网表 · ' + String(handoff.title || '未命名');
      const button = document.createElement('button');
      button.textContent = '载入并检查';
      button.addEventListener('click', () => {
        try {
          const config = inferAnalysis(handoff.netlist);
          pushHistory();
          state.files = [{ path: 'imported.cir', content: handoff.netlist }];
          state.entry = 'imported.cir';
          state.config = config;
          state.title = String(handoff.title || '导入设计');
          state.example = null;
          state.layout = {};
          activeFile = state.entry;
          invalidate();
          renderAll();
          dirty();
          localStorage.removeItem('ethereal.workspace.handoff.v1');
          $('handoff').hidden = true;
        } catch (error) {
          notice(error.message, true);
        }
      });
      $('handoff').append(button);
    }
  } catch (error) {
    notice('跨项目记录格式无效', true);
  }
}
boot();

let samplePlayer = null;
function stopSamplePlayer() {
  if (samplePlayer) clearInterval(samplePlayer);
  samplePlayer = null;
  $('play-samples').textContent = '播放取样';
}
$('play-samples').addEventListener('click', () => {
  if (samplePlayer) {
    stopSamplePlayer();
    return;
  }
  if (!result || result.points < 2) {
    notice('先运行瞬态或扫频分析');
    return;
  }
  $('play-samples').textContent = '暂停取样';
  samplePlayer = setInterval(() => {
    if (!result || document.hidden) {
      stopSamplePlayer();
      return;
    }
    sample = (sample + Math.max(1, Math.floor(result.points / 240))) % result.points;
    $('sample').value = sample;
    plot();
  }, 1000 / 30);
});
