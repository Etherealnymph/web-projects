import './workbench.css';
import {
  mountModelControls,
  readModelControls,
  indexModelSources,
  writeControl,
} from './model-controls.js';
import {
  buildDesign,
  renderLayerSvg,
  exportDesign,
  componentCatalog,
  validateComponent,
  instantiateComponent,
} from './design.js';
import { runAnalysis, inferAnalysis, analysisCommand } from './analysis.js';
import { prepareAnalysis } from './analysis-deck.js';
import { mountBench, experiments } from './bench.js';
import { setupEditor, escapeMarkup as esc } from './editor.js';
import { readProject, filePath, projectJson, openStore } from './project-store.js';

const $ = (id) => document.getElementById(id);
const icons = {
  folder: 'M3 7h7l2 2h9v10H3z M3 7V5h7l2 2h7',
  down: 'm6 9 6 6 6-6',
  chevron: 'm9 5 7 7-7 7',
  lab: 'M9 3h6m-5 0v6L4 19q-1 2 2 2h12q3 0 2-2l-6-10V3M7 15h10',
  export: 'M12 15V3m-4 4 4-4 4 4M5 13v7h14v-7',
  import: 'M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5',
  help: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3h.01',
  plus: 'M12 5v14M5 12h14',
  sliders: 'M4 6h6m4 0h6M4 12h11m4 0h1M4 18h2m4 0h10M10 3v6m5 0v6M8 15v6',
  search: 'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0m-1 5 5 5',
  layout: 'M3 4h18v16H3zM9 4v16',
  circuit: 'M2 12h4l2-6 4 12 3-12 2 6h5',
  play: 'm7 4 13 8-13 8z',
  stop: 'M6 6h12v12H6z',
  code: 'm8 6-6 6 6 6m8-12 6 6-6 6m-3-16-2 20',
  wave: 'M2 13h4l3-8 4 15 3-12 2 5h4',
  layers: 'm2 8 10-5 10 5-10 5zM2 12l10 5 10-5M2 16l10 5 10-5',
  chip: 'M6 6h12v12H6zM9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4',
  file: 'M5 3h9l5 5v13H5zM14 3v6h5',
};
const icon = (n) =>
  '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="' +
  (icons[n] || icons.file) +
  '"/></svg>';
document.querySelectorAll('[data-icon]').forEach((el) => (el.outerHTML = icon(el.dataset.icon)));
const field = (label, id, value = '', type = 'text') =>
  '<label class="field">' +
  esc(label) +
  '<input id="' +
  id +
  '" type="' +
  type +
  '" value="' +
  esc(value) +
  '"></label>';
const opt = (value, label, selected = false) =>
  '<option value="' +
  esc(value) +
  '"' +
  (selected ? ' selected' : '') +
  '>' +
  esc(label) +
  '</option>';
const choice = (name, label, hint = '') =>
  '<button type="button" class="choice" data-choice="' +
  esc(name) +
  '"><span>' +
  esc(label) +
  '</span><small>' +
  esc(hint) +
  '</small></button>';
const group = (s) => '<h3 class="choice-group">' + esc(s) + '</h3>';
const hint = (s) => '<p class="hint">' + esc(s) + '</p>';
const fields = (rows) =>
  '<dl class="fields">' +
  rows.map(([k, v]) => '<div><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>').join('') +
  '</dl>';
const defaults = {
  op: { type: 'op' },
  tran: { type: 'tran', step: '1u', stop: '3m' },
  ac: { type: 'ac', scale: 'dec', points: 40, start: '10', end: '1Meg' },
  dc: { type: 'dc', source: 'Vdrive', start: '0', end: '3.3', step: '0.01' },
};
const initialProject = () => readProject({ ...experiments[0], title: experiments[0].name });
let project,
  store,
  design,
  activeLayer,
  selected,
  view = 'schematic',
  zoom = 1,
  result = null,
  runError = '',
  running = null,
  bench,
  editor;
let dirty = new Set(),
  removed = new Set(),
  pending = false,
  saveTimer,
  savePromise = Promise.resolve(),
  parseTimer,
  stale = true,
  storageError = '';
let job = 0,
  configByType = {};
const files = () => project.files;
const source = (path) => files().find((f) => f.path === path);
const currentLayer = () => design?.layers.find((l) => l.id === activeLayer);
const component = () => currentLayer()?.components.find((c) => c.id === selected);
const catalog = () => [...componentCatalog, ...project.custom];
const setStatus = (message) => {
  $('status-message').textContent = String(message);
};
const errorText = (e) => e?.message || String(e);
function guarded(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (e) {
      if ($('modal').open) $('modal-error').textContent = errorText(e);
      setStatus(errorText(e));
    }
  };
}
function dialog(title, body, actions = '', submit = null) {
  $('modal-title').textContent = title;
  $('modal-body').innerHTML = body;
  $('modal-actions').innerHTML = actions;
  $('modal-error').textContent = '';
  $('modal-body').onclick = null;
  $('modal-body').onchange = null;
  $('modal-form').onsubmit = guarded(async (e) => {
    e.preventDefault();
    if (submit) await submit();
  });
  if (!$('modal').open) $('modal').showModal();
}
const submitBtn = (text) => '<button class="primary" type="submit">' + esc(text) + '</button>';
const close = () => {
  if ($('modal').open) $('modal').close();
};
$('modal-close').onclick = close;
function choices(fn) {
  $('modal-body').onclick = guarded(async (e) => {
    const b = e.target.closest('[data-choice]');
    if (b) await fn(b.dataset.choice);
  });
}
function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 20000);
}
function mark(path) {
  if (path) dirty.add(path);
  pending = true;
  clearTimeout(saveTimer);
  $('save-state').textContent = store ? '待保存' : '临时会话 · 请导出备份';
  saveTimer = setTimeout(() => flush().catch(() => {}), 350);
}
function flush() {
  clearTimeout(saveTimer);
  savePromise = savePromise
    .catch(() => {})
    .then(async () => {
      if (!pending || !store) return;
      const p = project,
        d = dirty,
        r = removed;
      dirty = new Set();
      removed = new Set();
      pending = false;
      try {
        p.revision = await store.save(p, d, r);
        storageError = '';
        $('save-state').textContent = pending ? '待保存' : '已保存至本机';
      } catch (e) {
        for (const path of d) dirty.add(path);
        for (const path of r) removed.add(path);
        pending = true;
        storageError = errorText(e);
        $('save-state').textContent = '保存失败 · 请导出';
        setStatus(storageError);
        throw e;
      }
    });
  return savePromise;
}
window.addEventListener('pagehide', () => {
  void flush().catch(() => {});
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) void flush().catch(() => {});
});
function invalidate() {
  const hadData = Boolean(running || result || runError);
  job++;
  running?.abort();
  running = null;
  result = null;
  runError = '';
  if (hadData) {
    bench?.clear();
    updateRun();
  }
}
function reparse() {
  clearTimeout(parseTimer);
  if (!stale) return;
  design = buildDesign(files(), project.entry);
  if (project.configMode === 'auto') {
    project.config = inferred(source(project.entry));
    updateHeader();
  }
  if (!design.layers.some((l) => l.id === activeLayer)) activeLayer = design.entryLayerId;
  if (!component()) selected = null;
  stale = false;
  draw();
  inspector();
}
function changed(path) {
  invalidate();
  stale = true;
  mark(path);
  clearTimeout(parseTimer);
  parseTimer = setTimeout(guarded(reparse), 250);
}
function fileView(path, line) {
  if (!source(path)) throw Error('文件不存在：' + path);
  project.active = path;
  mark();
  showView('code');
  if (line) editor.go(line);
}
function openEditor() {
  $('as-entry').hidden = project.active === project.entry;
  const f = source(project.active);
  editor.open(project.id + '/' + f.path, f.path, f.content);
  renderFiles();
}
function selectLayer(id) {
  reparse();
  if (!design.layers.some((l) => l.id === id)) throw Error('图层不存在。');
  selected = null;
  activeLayer = id;
  zoom = 1;
  draw();
  inspector();
}
function showView(next) {
  if (!['schematic', 'code', 'bench'].includes(next)) throw Error('未知视图。');
  view = next;
  for (const el of document.querySelectorAll('[data-view]'))
    el.setAttribute('aria-selected', String(el.dataset.view === next));
  for (const id of ['schematic', 'code', 'bench']) $(id + '-view').hidden = id !== next;
  if (next === 'code') openEditor();
  if (next === 'schematic') reparse();
  if (next === 'bench') window.dispatchEvent(new Event('resize'));
}
function draw() {
  const l = currentLayer();
  if (!l) return;
  $('layer').innerHTML = design.layers
    .map((x) => opt(x.id, x.name === 'TOP' ? 'TOP · 顶层' : x.name, x.id === l.id))
    .join('');
  $('drawing').innerHTML = renderLayerSvg(l, { selectedId: selected });
  sizeDrawing();
  $('schematic-count').textContent = l.components.length + ' 个元件 · ' + l.nets.length + ' 个网络';
  $('diagnostics').textContent = design.diagnostics.length
    ? '诊断 ' + design.diagnostics.length + ' 项'
    : '连线检查 / 诊断';
}
function sizeDrawing() {
  $('drawing').style.width = zoom * 100 + '%';
  $('drawing').style.height = zoom * 100 + '%';
  $('drawing').style.minWidth = '0';
  $('drawing').style.minHeight = '0';
  $('drawing').style.margin = 'auto';
  $('fit').textContent = Math.round(zoom * 100) + '%';
}
function drawZoom(value) {
  zoom = Math.max(0.4, Math.min(4, value));
  sizeDrawing();
}
function selectedAt(id) {
  if (!currentLayer()?.components.some((c) => c.id === id)) throw Error('元件不存在。');
  selected = id;
  draw();
  inspector();
  return component();
}
function inspector() {
  const l = currentLayer();
  if (!l) return;
  const c = component(),
    block = $('inspect');
  if (c) {
    const def = c.definition,
      where = def
        ? def.file + ' · L' + def.line + (def.binCount ? ' · ' + def.binCount + ' 个尺寸分档' : '')
        : c.model
          ? '未解析到 ' + c.model
          : design.language === 'analog'
            ? 'SPICE 内建原语'
            : 'HDL 语言原语';
    block.innerHTML =
      '<h3 class="inspect-title">' +
      esc(c.name) +
      '</h3>' +
      fields([
        ['类型 / 模型', c.type + (c.model ? ' / ' + c.model : '')],
        ['参数', c.value || '—'],
        ['引脚 → 网络', c.pins.map((p) => p.name + ' → ' + p.net).join(' · ')],
        ['实例位置', c.source.file + ' · L' + c.source.line],
        ['工艺库 / 定义来源', where],
      ]) +
      '<div class="inspect-actions"><button id="instance-line">实例代码</button>' +
      (design.language === 'analog' ? '<button id="edit-instance">编辑实例</button>' : '') +
      (def ? '<button id="definition-line">模型定义</button>' : '') +
      (c.targetLayerId ? '<button id="child-layer">进入子层</button>' : '') +
      '</div>';
    $('instance-line').onclick = () => fileView(c.source.file, c.source.line);
    if ($('edit-instance'))
      $('edit-instance').onclick = () => {
        const f = source(c.source.file),
          rows = f.content.split('\n'),
          index = c.source.line - 1,
          line = rows[index];
        dialog(
          '编辑 ' + c.name,
          field('实例语句（引脚、模型与参数）', 'edit-card', line.trim()) +
            hint(c.source.file + ' · L' + c.source.line),
          submitBtn('应用到电路'),
          () => {
            const replacement = $('edit-card').value.trim();
            if (!replacement) throw Error('请输入实例语句。');
            const start = rows.slice(0, index).reduce((n, row) => n + row.length + 1, 0);
            project.active = f.path;
            openEditor();
            editor.edit(start, start + line.length, line.match(/^\s*/)[0] + replacement);
            reparse();
            close();
          },
        );
      };
    if (def) $('definition-line').onclick = () => fileView(def.file, def.line);
    if (c.targetLayerId) $('child-layer').onclick = () => selectLayer(c.targetLayerId);
  } else {
    const isHdl = design.language !== 'analog';
    block.innerHTML =
      '<h3 class="inspect-title">' +
      esc(l.name === 'TOP' ? '顶层电路' : l.name) +
      '</h3>' +
      fields([
        ['设计入口', project.entry],
        ['当前层文件', l.file],
        ['层级', design.layers.length + ' 层'],
        ['解析模式', isHdl ? 'HDL 结构视图' : '模拟电路'],
      ]) +
      hint('点选图中的元件，查看引脚、参数及模型来源。');
  }
}
function renderFiles() {
  const area = $('file-list');
  area.replaceChildren();
  let folder = null;
  for (const f of [...files()].sort((a, b) => a.path.localeCompare(b.path, 'en'))) {
    const parts = f.path.split('/'),
      name = parts.pop(),
      dir = parts.join('/');
    if (folder !== dir && dir) {
      const d = document.createElement('div');
      d.className = 'folder';
      d.innerHTML = icon('folder') + esc(dir);
      area.append(d);
    }
    folder = dir;
    const b = document.createElement('button');
    b.className = 'file-row' + (project.active === f.path ? ' active' : '');
    b.title = f.path;
    b.innerHTML =
      icon('file') +
      '<span>' +
      esc(name) +
      '</span>' +
      (f.path === project.entry ? '<small>入口</small>' : '');
    b.onclick = () => fileView(f.path);
    area.append(b);
  }
}
function partGroup(part) {
  if (project.custom.some((d) => d.id === part.id)) return '自定义';
  if (['R', 'L', 'C', 'T'].includes(part.prefix)) return '无源元件';
  if ('VIEBGFH'.includes(part.prefix)) return '信号源与受控源';
  return '半导体与功能器件';
}
function renderParts() {
  const q = $('part-search').value.toLowerCase();
  const list = catalog().filter((d) =>
    (d.id + ' ' + d.label + ' ' + d.prefix).toLowerCase().includes(q),
  );
  $('part-list').innerHTML =
    [...new Set(list.map(partGroup))]
      .map(
        (group) =>
          '<div class="part-group">' +
          esc(group) +
          '</div>' +
          list
            .filter((d) => partGroup(d) === group)
            .map(
              (d) =>
                '<button class="part-row" data-part="' +
                esc(d.id) +
                '"><code>' +
                esc(d.prefix) +
                '</code><span>' +
                esc(d.label) +
                '</span></button>',
            )
            .join(''),
      )
      .join('') || hint('没有匹配的元件。');
}
function mode() {
  return project.config?.type || 'op';
}
function updateRun() {
  if (!project) return;
  $('run').innerHTML =
    icon(running ? 'stop' : 'play') + '<span>' + (running ? '停止' : '运行仿真') + '</span>';
  $('mode-label').textContent = mode().toUpperCase();
  const area = $('last-run');
  if (running) {
    area.innerHTML = hint('正在求解…');
    return;
  }
  if (runError) {
    area.innerHTML = '<p class="hint">' + esc(runError) + '</p>';
    return;
  }
  if (!result) {
    area.innerHTML = hint('运行当前电路后，可在仪器台查看电压、电流与波形。');
    return;
  }
  area.innerHTML =
    '<p class="result-chip">' +
    esc(result.analysis.toUpperCase()) +
    ' · 完成</p>' +
    fields([
      ['采样', result.points + ' 点 · ' + result.traces.length + ' 条曲线'],
      ['内核 / 耗时', result.engine + ' / ' + Math.round(result.elapsedMs) + ' ms'],
    ]) +
    '<div class="inspect-actions"><button id="result-panel">查看仪表</button><button id="result-log">日志</button></div>';
  $('result-panel').onclick = () => showView('bench');
  $('result-log').onclick = () =>
    dialog('求解器日志', '<pre class="details">' + esc(result.logs.join('\n')) + '</pre>');
}
function updateHeader() {
  $('project-name').textContent = project.title;
  $('entry-label').textContent = project.entry;
  $('design-name').textContent = project.title;
  updateRun();
}
function inferred(f) {
  try {
    return inferAnalysis(f.content, f.path) || { ...defaults.op };
  } catch {
    return { ...defaults.op };
  }
}
async function activate(p, isNew = true) {
  const custom = p.custom.map(validateComponent);
  if (project) await flush();
  invalidate();
  project = p;
  project.custom = custom;
  project.config ||= inferred(source(p.entry));
  configByType = {};
  activeLayer = null;
  selected = null;
  zoom = 1;
  stale = true;
  dirty = new Set(isNew ? files().map((f) => f.path) : []);
  removed = new Set();
  pending = isNew;
  editor.reset();
  renderFiles();
  renderParts();
  reparse();
  updateHeader();
  showView('schematic');
  try {
    localStorage.setItem('opencircuit.active', p.id);
  } catch {}
  if (isNew) mark();
  else $('save-state').textContent = '已保存至本机';
}
async function simulate(config = null, navigate = true) {
  reparse();
  if (design.language !== 'analog')
    throw Error('当前入口为 HDL 结构视图。请选择 SPICE 或可转换的 Spectre 测试台作为仿真入口。');
  config ||=
    project.configMode === 'auto'
      ? inferAnalysis(source(project.entry).content, project.entry)
      : project.config;
  if (running) running.abort();
  const token = ++job;
  running = new AbortController();
  result = null;
  runError = '';
  bench.clear();
  updateRun();
  try {
    const data = await runAnalysis(
      {
        files: files().map(({ path, content }) => ({ path, content })),
        entry: project.entry,
        config,
      },
      { signal: running.signal },
    );
    if (token !== job) throw Error('本次运行已取消。');
    result = data;
    bench.setResult(data);
    if (navigate) {
      showView('bench');
      bench.show(data.analysis === 'op' ? 'meters' : 'scope');
    }
    setStatus(data.analysis.toUpperCase() + ' 完成 · ' + data.points + ' 个采样点');
    return data;
  } catch (e) {
    if (token === job) {
      runError = errorText(e);
      setStatus(runError);
    }
    throw e;
  } finally {
    if (token === job) {
      running = null;
      updateRun();
    }
  }
}
function cancelRun() {
  invalidate();
  setStatus('本次运行已停止');
}
function setConfig(next) {
  if (!next || !Object.hasOwn(defaults, next.type)) throw Error('分析类型可选 op、dc、ac、tran。');
  analysisCommand(next);
  project.configMode = 'manual';
  project.config = structuredClone(next);
  configByType[next.type] = project.config;
  invalidate();
  mark();
  updateHeader();
}
function analysisOptions() {
  let draft = { ...project.config };
  const labels = {
    op: 'OP · 直流工作点',
    tran: 'TRAN · 瞬态',
    dc: 'DC · 直流扫描',
    ac: 'AC · 小信号扫频',
  };
  const form = () => {
    let items = '';
    if (draft.type === 'tran')
      items =
        field('输出步长（s）', 'cfg-step', draft.step) +
        field('停止时间（s）', 'cfg-stop', draft.stop) +
        field('记录起点（s，可空）', 'cfg-begin', draft.begin) +
        field('最大内部步长（s，可空）', 'cfg-maxStep', draft.maxStep) +
        '<label><input type="checkbox" id="cfg-uic" ' +
        (draft.uic ? 'checked' : '') +
        '> 使用初始条件 UIC</label>';
    if (draft.type === 'dc')
      items =
        field('独立源位号', 'cfg-source', draft.source) +
        field('扫描起点（V 或 A）', 'cfg-start', draft.start) +
        field('扫描终点（V 或 A）', 'cfg-end', draft.end) +
        field('步长（V 或 A）', 'cfg-step', draft.step);
    if (draft.type === 'ac')
      items =
        '<label class="field">频率取样<select id="cfg-scale">' +
        ['dec', 'oct', 'lin'].map((s) => opt(s, s, draft.scale === s)).join('') +
        '</select></label>' +
        field('采样数（DEC/OCT 每段，LIN 总数）', 'cfg-points', draft.points, 'number') +
        field('起始频率（Hz）', 'cfg-start', draft.start) +
        field('终止频率（Hz）', 'cfg-end', draft.end);
    dialog(
      '仿真参数',
      '<p class="hint">' +
        (project.configMode === 'auto'
          ? '当前使用入口网表的分析卡。'
          : '当前使用工程中保存的分析参数。') +
        ' <button type="button" id="use-card" class="secondary">从网表读取</button></p><label class="field">分析类型<select id="analysis-type">' +
        Object.entries(labels)
          .map(([k, v]) => opt(k, v, k === draft.type))
          .join('') +
        '</select></label><div class="form-grid">' +
        items +
        '</div>' +
        hint(
          draft.type === 'op'
            ? '求解静态偏置点并记录节点电压及可用支路电流。'
            : '支持工程单位，例如 1u、100n、1k、1Meg。参数应用于本次工程的求解设置。',
        ),
      submitBtn('应用参数'),
      () => {
        const next = { type: draft.type };
        for (const e of $('modal-body').querySelectorAll('[id^=cfg-]')) {
          const k = e.id.slice(4);
          if (e.type === 'checkbox') {
            if (e.checked) next[k] = true;
          } else if (e.value.trim())
            next[k] = e.type === 'number' ? Number(e.value) : e.value.trim();
        }
        setConfig(next);
        close();
      },
    );
    $('use-card').onclick = guarded(() => {
      const cfg = inferAnalysis(source(project.entry).content, project.entry);
      setConfig(cfg);
      project.configMode = 'auto';
      mark();
      close();
      setStatus('仿真将跟随入口分析卡');
    });
    $('analysis-type').onchange = (e) => {
      draft = { ...(configByType[e.target.value] || defaults[e.target.value]) };
      form();
    };
  };
  form();
}
function setFile(path, content, create = true) {
  path = filePath(path);
  if (typeof content !== 'string') throw Error('源代码应为文本。');
  const old = source(path);
  if (old) {
    if (old.content === content) return;
    old.content = content;
  } else if (create) files().push({ path, content });
  else throw Error('文件不存在。');
  changed(path);
  renderFiles();
  if (view === 'code' && project.active === path) openEditor();
}
function setEntry(path) {
  if (!source(path)) throw Error('工程内没有此文件。');
  project.entry = path;
  project.active = path;
  project.configMode = 'auto';
  project.config = inferred(source(path));
  configByType = {};
  selected = null;
  activeLayer = null;
  zoom = 1;
  changed(path);
  reparse();
  updateHeader();
  renderFiles();
  showView('schematic');
}
function fileOptions() {
  const f = source(project.active);
  dialog(
    f.path,
    choice('entry', '设为设计与仿真入口', '更新原理图') +
      choice('rename', '重命名或移动文件', '工程内路径') +
      choice('go', '跳转至行', '行号') +
      choice('save', '下载源文件', '原始文本') +
      (files().length > 1 ? choice('delete', '移除此文件', '工程内') : ''),
  );
  choices((k) => {
    if (k === 'entry') {
      setEntry(f.path);
      close();
    }
    if (k === 'save') {
      download(new Blob([f.content]), f.path.split('/').pop());
      close();
    }
    if (k === 'go') {
      dialog('跳转至行', field('行号', 'go-line', 1, 'number'), submitBtn('跳转'), () => {
        const line = $('go-line').value;
        close();
        editor.go(line);
      });
    }
    if (k === 'rename')
      dialog(
        '重命名文件',
        field('工程内相对路径', 'new-name', f.path) +
          hint('引用此文件的 include 路径可在代码编辑器中更新。'),
        submitBtn('重命名'),
        () => {
          const path = filePath($('new-name').value),
            old = f.path;
          if (path === old) {
            close();
            return;
          }
          if (source(path)) throw Error('目标文件已存在。');
          removed.add(old);
          dirty.delete(old);
          f.path = path;
          if (project.entry === old) project.entry = path;
          project.active = path;
          changed(path);
          openEditor();
          updateHeader();
          close();
        },
      );
    if (k === 'delete')
      dialog('移除文件', hint('从本工程移除 ' + f.path + '。'), submitBtn('确认移除'), () => {
        project.files = files().filter((x) => x !== f);
        removed.add(f.path);
        dirty.delete(f.path);
        project.active = files()[0].path;
        if (project.entry === f.path) setEntry(project.active);
        else {
          changed();
          openEditor();
        }
        close();
      });
  });
}
function newFile() {
  dialog(
    '新建文件',
    field('相对路径', 'new-path', 'untitled.cir') +
      hint('可使用 .cir、.sp、.scs、.lib、.v、.vhd 等扩展名。'),
    submitBtn('创建'),
    () => {
      const path = filePath($('new-path').value);
      if (source(path)) throw Error('文件已存在。');
      const content = /\.(cir|sp|spice|ckt)$/i.test(path) ? '* ' + path + '\n\n.end\n' : '';
      setFile(path, content);
      close();
      fileView(path);
    },
  );
}
function newProject() {
  dialog(
    '新建工程',
    field('工程名称', 'new-title', '我的电路') + field('设计入口', 'new-entry', 'main.cir'),
    submitBtn('创建工程'),
    async () => {
      const name = $('new-title').value.trim(),
        entry = filePath($('new-entry').value);
      if (!name) throw Error('请输入工程名称。');
      await activate(
        readProject({
          title: name,
          entry,
          files: [
            {
              path: entry,
              content: /\.(cir|spice|sp)$/i.test(entry) ? '* ' + name + '\n\n.op\n.end\n' : '',
            },
          ],
        }),
      );
      close();
      fileView(entry);
    },
  );
}
async function projectMenu() {
  if (storageError && store) {
    dialog(
      '本机存储冲突',
      hint(storageError) +
        choice('copy', '保存为独立工程', '保留本标签页内容') +
        choice('restore', '重新打开已保存的版本', '丢弃当前未保存改动'),
    );
    choices(async (k) => {
      const target =
        k === 'copy'
          ? readProject({ ...projectJson(project), title: project.title + ' · 副本' })
          : await store.load(project.id);
      if (!target) throw Error('未找到已保存的工程。');
      const original = pending;
      pending = false;
      try {
        await activate(target, k === 'copy');
        storageError = '';
        close();
      } catch (e) {
        pending = original;
        throw e;
      }
    });
    return;
  }
  await flush();
  const records = store ? await store.list() : [];
  dialog(
    '本机工程',
    choice('new', '新建工程', '空白设计') +
      choice('import', '导入工程或文件', 'JSON / 源码 / PDK') +
      choice('files', '管理当前文件', '入口 / 下载 / 移除') +
      choice('manage', '管理当前工程', '改名 / 删除') +
      group('已保存的工程') +
      records
        .map((p) =>
          choice(p.id, p.title, p.id === project.id ? '当前' : p.order.length + ' 个文件'),
        )
        .join(''),
  );
  choices(async (k) => {
    if (k === 'new') return newProject();
    if (k === 'import') return importMenu();
    if (k === 'files') {
      showView('code');
      return fileOptions();
    }
    if (k === 'manage') return manageProject();
    await activate(await store.load(k), false);
    close();
  });
}
function manageProject() {
  dialog(
    '管理工程',
    field('工程名称', 'rename-project', project.title) +
      (store ? choice('delete', '删除当前本机工程', '含该工程的所有源文件') : ''),
    submitBtn('保存名称'),
    () => {
      const name = $('rename-project').value.trim();
      if (!name) throw Error('请输入工程名称。');
      project.title = name;
      mark();
      updateHeader();
      close();
    },
  );
  choices(() =>
    dialog(
      '删除工程',
      hint('确认删除本机的「' + project.title + '」及其源文件？'),
      submitBtn('确认删除工程'),
      async () => {
        await flush();
        await store.remove(project.id, project.revision);
        const others = await store.list();
        const next = others.length ? await store.load(others[0].id) : initialProject();
        await activate(next, !others.length);
        close();
      },
    ),
  );
}
async function openExperiment(id) {
  const demo = experiments.find((d) => d.id === id);
  if (!demo) throw Error('实验不存在。');
  const p = readProject({ ...demo, title: demo.name });
  await activate(p);
  close();
  return simulate(p.config);
}
const languageDemos = {
  spectre: {
    title: 'Spectre · 分压器',
    entry: 'divider.scs',
    files: [
      {
        path: 'divider.scs',
        content:
          '// Two-resistor voltage divider\nsimulator lang=spectre\nV1 (in 0) vsource dc=3\nR1 (in out) resistor r=1k\nR2 (out 0) resistor r=2k\nop1 dc\n',
      },
    ],
    config: { type: 'op' },
  },
  verilog: {
    title: 'Verilog · 半加器',
    entry: 'half_adder.v',
    files: [
      {
        path: 'half_adder.v',
        content:
          '// Structural half adder\nmodule half_adder(input a, input b, output sum, output carry);\n  xor U_SUM (sum, a, b);\n  and U_CARRY (carry, a, b);\nendmodule\n',
      },
    ],
  },
  vhdl: {
    title: 'VHDL · 半加器',
    entry: 'half_adder.vhd',
    files: [
      {
        path: 'half_adder.vhd',
        content:
          'library ieee;\nuse ieee.std_logic_1164.all;\nentity half_adder is\n  port (a, b : in std_logic; s, c : out std_logic);\nend entity;\narchitecture rtl of half_adder is\nbegin\n  s <= a xor b;\n  c <= a and b;\nend architecture;\n',
      },
    ],
  },
};
function labsMenu() {
  dialog(
    '电路实验库',
    hint('选择实验会创建独立工程并运行。已有工程可从顶部工程菜单重新打开。') +
      experiments.map((d) => choice(d.id, d.name, d.config.type.toUpperCase())).join('') +
      choice('sky', 'SKY130 螺旋电感谐振', 'AC · 开放工艺模型') +
      choice('mos', 'SKY130 NMOS 转移特性', 'DC · TT 角 BSIM4') +
      group('语言示例') +
      Object.entries(languageDemos)
        .map(([k, v]) => choice(k, v.title, k === 'spectre' ? 'OP' : '结构原理图'))
        .join(''),
  );
  choices(async (k) => {
    if (k === 'sky' || k === 'mos') return loadSky(k);
    if (Object.hasOwn(languageDemos, k)) {
      await activate(readProject(languageDemos[k]));
      close();
      if (k === 'spectre') await simulate();
    } else await openExperiment(k);
  });
}
async function loadSky(kind) {
  let manifest = {
    title: 'SKY130 · 螺旋电感谐振',
    entry: 'tank.cir',
    config: { type: 'ac', scale: 'dec', points: 40, start: '1Meg', end: '10G' },
    files: ['tank.cir', 'sky130_fd_pr__ind_03_90.model.spice'],
  };
  if (kind === 'mos') {
    const r = await fetch('./engine/sky130/manifest.json');
    if (!r.ok) throw Error('无法读取 SKY130 模型清单。');
    manifest = await r.json();
  }
  const names = manifest.files;
  const imported = await Promise.all(
    names.map(async (path) => {
      const r = await fetch('./engine/sky130/' + path);
      if (!r.ok) throw Error('示例模型读取失败：' + path);
      return { path, content: await r.text() };
    }),
  );
  await activate(readProject({ ...manifest, files: imported }));
  close();
  return simulate();
}
function modelMenu() {
  dialog(
    '工艺角与设计变量',
    '<div id="model-controls"></div><div class="inspect-actions"><button type="button" class="secondary" id="add-model-files">导入模型文件或目录</button></div>',
  );
  mountModelControls($('model-controls'), {
    files: files(),
    entry: project.entry,
    onWrite: (path, content) => {
      setFile(path, content);
      reparse();
      setStatus('已更新模型设置，请重新仿真');
    },
    onOpen: (path, line) => {
      close();
      fileView(path, line);
    },
  });
  $('add-model-files').onclick = importMenu;
}
function importMenu() {
  dialog(
    '导入文件与工艺库',
    choice('file', '选择文件', '源代码、工程 JSON、模型卡') +
      choice('folder', '导入工程或 PDK 目录', '保留相对路径') +
      choice('sky', '打开 SKY130 电感测试台', '随包模型 · AC') +
      choice('mos', '打开 SKY130 1.8 V NMOS 测试台', 'TT 角模型 · DC') +
      hint(
        '导入包含入口网表与模型目录的共同父目录，使用 .include 或 .lib 选择模型文件及工艺角。打开入口文件后，在文件操作中设为设计入口。',
      ),
  );
  choices((k) => {
    if (k === 'sky' || k === 'mos') return loadSky(k);
    close();
    $(k === 'file' ? 'file-picker' : 'folder-picker').click();
  });
}
const textExtensions =
  /\.(cir|circuit|spice|sp|spi|ckt|net|scs|lib|inc|include|mod|model|mdl|l|va|v|sv|vh|svh|vhd|vhdl|pm|txt|tt|ff|ss|sf|fs|corner|param|params|sub|cdl)$/i;
async function importList(list, folder = false) {
  if (!list.length) return;
  if (!folder && list.length === 1 && /\.json$/i.test(list[0].name)) {
    const data = JSON.parse(await list[0].text());
    if (data.files || typeof data.content === 'string') {
      await activate(readProject(data, list[0].name));
      return;
    }
    const d = validateComponent(data);
    addCustom(d);
    return;
  }
  const candidates = folder
    ? list.filter((f) => textExtensions.test(f.name) || !f.name.includes('.'))
    : list;
  if (!candidates.length) throw Error('没有识别到文本电路文件。');
  if (candidates.reduce((n, f) => n + f.size, 0) > 150 * 1024 * 1024)
    throw Error('当前导入超过 150 MiB，请选择所需模型和入口的子目录。');
  const imported = [];
  for (const f of candidates) {
    const path = filePath(
      (folder ? f.webkitRelativePath.split('/').slice(1).join('/') : f.name) || f.name,
    );
    imported.push({ path, content: await f.text() });
  }
  const existing = new Set(files().map((f) => f.path)),
    collisions = imported.filter((f) => existing.has(f.path));
  function apply() {
    const accepted = new Map(files().map((f) => [f.path, f]));
    for (const f of imported) {
      accepted.set(f.path, f);
      dirty.add(f.path);
    }
    project.files = [...accepted.values()];
    changed();
    renderFiles();
    const first = imported.find((f) => /\.(cir|sp|scs|spice|v|vhd)$/i.test(f.path)) || imported[0];
    close();
    fileView(first.path);
    setStatus('已导入 ' + imported.length + ' 个文件；可在文件操作中设置入口。');
  }
  if (collisions.length) {
    dialog(
      '导入同名文件',
      hint('以下 ' + collisions.length + ' 个同名文件将被导入内容替换。') +
        '<pre class="details">' +
        esc(collisions.map((f) => f.path).join('\n')) +
        '</pre>',
      submitBtn('替换并导入'),
      apply,
    );
  } else apply();
}
function addCustom(def) {
  const d = validateComponent(def);
  if (catalog().some((x) => x.id === d.id)) throw Error('元件 ID 已存在。');
  project.custom.push(d);
  mark();
  renderParts();
  setStatus('已加入元件库：' + d.label);
  return d;
}
function customDialog() {
  const example = {
    id: 'sense-resistor',
    label: '采样电阻',
    prefix: 'R',
    pins: ['P', 'N'],
    value: '0.1',
  };
  dialog(
    '代码自定义元件',
    '<label class="field">JSON 元件定义<textarea id="custom-json" rows="9" spellcheck="false">' +
      esc(JSON.stringify(example, null, 2)) +
      '</textarea></label><a href="./docs/custom-components.md" target="_blank" rel="noopener">元件代码规范与子电路示例</a>',
    submitBtn('加入元件库'),
    () => {
      addCustom($('custom-json').value);
      close();
    },
  );
}
function insertCard(text, layer = currentLayer()) {
  if (!layer) throw Error('没有选中的电路层。');
  const f = source(layer.file);
  if (
    !f ||
    design.language !== 'analog' ||
    /\.scs$/i.test(f.path) ||
    /^\s*simulator\s+lang=spectre/im.test(f.content)
  )
    throw Error('此元件模板使用 SPICE 语法。请选择 SPICE 网表或在代码编辑器中编辑当前语言。');
  let offset = f.content.search(/^\s*\.end\s*(?:[;$].*)?$/im);
  if (layer.kind === 'subckt' || (layer.name !== 'TOP' && layer.language === 'analog')) {
    const lines = f.content.split('\n'),
      end = lines.findIndex((s, i) => i >= layer.line && /^\s*\.ends\b/i.test(s));
    if (end < 0) throw Error('此子电路未找到 .ends。');
    offset = lines.slice(0, end).join('\n').length + 1;
  }
  if (offset < 0) offset = f.content.length;
  const addition =
    (offset > 0 && !f.content.slice(0, offset).endsWith('\n') ? '\n' : '') + text.trim() + '\n';
  project.active = f.path;
  openEditor();
  editor.edit(offset, offset, addition);
  reparse();
  setStatus('已写入 ' + f.path);
  return f.path;
}
function place(id, params) {
  const d = catalog().find((x) => x.id === id);
  if (!d) throw Error('元件不存在。');
  reparse();
  const l = currentLayer();
  if (l.components.some((c) => c.name.toLowerCase() === String(params.name).toLowerCase()))
    throw Error('本层已有此位号。');
  const card = instantiateComponent(d, { ...params, existingSource: source(l.file).content });
  insertCard(card, l);
  showView('schematic');
  const c = currentLayer()?.components.find((x) => x.name === params.name);
  if (c) selectedAt(c.id);
  return card;
}
function partDialog(id) {
  const d = catalog().find((x) => x.id === id);
  reparse();
  const l = currentLayer();
  let n = 1;
  while (l.components.some((c) => c.name.toUpperCase() === d.prefix + n)) n++;
  dialog(
    '放置' + d.label,
    field('位号', 'inst-name', d.prefix + n) +
      field(
        '端点网络，依次为 ' + d.pins.join(' / '),
        'inst-nodes',
        d.pins.map((_, i) => (i === d.pins.length - 1 ? '0' : 'net' + (n + i))).join(' '),
      ) +
      field('数值 / 模型参数', 'inst-value', d.value) +
      hint('放置层为 ' + l.name + '。同名网络自动连接。'),
    submitBtn('放置到当前层'),
    () => {
      place(id, {
        name: $('inst-name').value.trim(),
        nodes: $('inst-nodes').value.trim().split(/\s+/),
        value: $('inst-value').value.trim(),
      });
      close();
    },
  );
}
function diagnostics() {
  reparse();
  const items = [...design.diagnostics];
  // A single pin is observable from the drawn topology; externally bound subcircuit ports are valid.
  const l = currentLayer(),
    external = new Set(l.ports.map((p) => String(p).toLowerCase()));
  if (design.language === 'analog')
    for (const n of l.nets) {
      if (n.pins.length !== 1 || external.has(n.name.toLowerCase()) || /^(0|gnd!)$/i.test(n.name))
        continue;
      const owner = l.components.find((c) => c.id === n.pins[0].componentId);
      if (owner)
        items.push({
          ...owner.source,
          message: '单引脚网络 ' + n.name + '，请核对 ' + owner.name + ' 的连接',
        });
    }
  dialog(
    '解析诊断',
    items.length
      ? items.map((d, i) => choice(i, d.message, d.file + ' · L' + d.line)).join('')
      : hint('当前结构解析未报告问题。可运行仿真检查模型依赖、偏置点与收敛情况。'),
  );
  choices((k) => {
    const d = items[Number(k)];
    close();
    fileView(d.file, d.line);
  });
}
const exportTypes = {
  project: '完整工程 JSON',
  native: '入口原生网表',
  spice: '独立可运行 SPICE 网表',
  bom: '当前层物料清单 CSV',
  svg: '当前图层 SVG',
  png: '当前图层 PNG',
  'all-png': '所有图层 PNG · ZIP',
  pdf: '所有图层矢量 PDF',
  kicad: '当前层 KiCad 原理图',
  'kicad-xml': '当前层 KiCad XML 网表',
  csv: '仿真数据 CSV',
};
async function makeExport(format) {
  reparse();
  if (format === 'project')
    return {
      name: project.title + '.oceda.json',
      blob: new Blob([JSON.stringify(projectJson(project), null, 2)], { type: 'application/json' }),
    };
  if (format === 'spice') {
    if (design.language !== 'analog') throw Error('此导出需要模拟电路入口。');
    const prepared = prepareAnalysis({
      files: files(),
      entry: project.entry,
      config: project.configMode === 'auto' ? null : project.config,
    });
    const body = prepared.deck.slice(0, prepared.deck.lastIndexOf('\n.control\n'));
    return {
      name:
        project.entry
          .split('/')
          .pop()
          .replace(/\.[^.]+$/, '') + '-expanded.cir',
      blob: new Blob([body + '\n.' + analysisCommand(prepared.config) + '\n.end\n'], {
        type: 'text/plain',
      }),
    };
  }
  if (format === 'bom') {
    const l = currentLayer(),
      quote = (s) => '"' + String(s ?? '').replaceAll('"', '""') + '"';
    const rows = [
      ['Reference', 'Type', 'Value', 'Model', 'Instance file', 'Line', 'Definition file', 'Line'],
      ...l.components.map((c) => [
        c.name,
        c.type,
        c.value,
        c.model,
        c.source.file,
        c.source.line,
        c.definition?.file,
        c.definition?.line,
      ]),
    ];
    return {
      name: l.name + '-bom.csv',
      blob: new Blob(['\uFEFF' + rows.map((r) => r.map(quote).join(',')).join('\r\n')], {
        type: 'text/csv;charset=utf-8',
      }),
    };
  }
  if (format === 'csv') {
    if (!result) throw Error('请先运行仿真。');
    const cols = [
      result.x,
      ...result.traces.flatMap((t) =>
        t.imag
          ? [
              { name: t.name + '.real', values: t.values },
              { name: t.name + '.imag', values: t.imag },
            ]
          : [t],
      ),
    ];
    const quote = (v) => '"' + String(v).replaceAll('"', '""') + '"';
    const rows = [cols.map((c) => quote(c.name)).join(',')];
    for (let i = 0; i < result.points; i++) rows.push(cols.map((c) => c.values[i]).join(','));
    return {
      name: result.analysis + '.csv',
      blob: new Blob([rows.join('\n')], { type: 'text/csv' }),
    };
  }
  if (!Object.hasOwn(exportTypes, format)) throw Error('未知导出格式。');
  return exportDesign(design, activeLayer, format);
}
function exportMenu() {
  dialog(
    '导出',
    Object.entries(exportTypes)
      .filter(([k]) => k !== 'csv' || result)
      .map(([k, v]) =>
        choice(k, v, k === 'native' ? '入口源文件' : k === 'project' ? '包含所有依赖文件' : ''),
      )
      .join(''),
  );
  choices(async (k) => {
    const { name, blob } = await makeExport(k);
    download(blob, name);
    close();
    setStatus('已导出 ' + name);
  });
}
function help() {
  dialog(
    '使用说明与 AI 调试',
    group('工作台') +
      hint(
        '点选元件可定位实例及工艺模型源行。双击子电路或使用图层下拉框进入下一层。元件库按引脚顺序连接同名网络。',
      ) +
      group('编辑与仿真') +
      hint(
        '⌘/Ctrl + Enter 运行，⌘/Ctrl + S 保存，⌘/Ctrl + F 查找，⌘/Ctrl + D 复制行，⌘/Ctrl + / 切换行注释。改动网表后需重新求解。',
      ) +
      group('Agent 接口') +
      hint('浏览器代理可调用本页的 window.OpenCircuitEDA。运行示例和接口契约包含在技能文件中。') +
      '<p><a href="./skills/opencircuit-workbench/SKILL.md" target="_blank" rel="noopener">打开 AI 调试 SKILL.md</a></p><p><a href="./docs/custom-components.md" target="_blank" rel="noopener">自定义元件规范</a></p>' +
      group('支持范围') +
      hint(
        'ngspice 执行 SPICE 模型与可转换的 Spectre 语法。Verilog、VHDL 提供结构视图。经典绘图编辑器保留手工布线、移动与旋转等旧版功能。',
      ),
  );
}
function mobileMenu() {
  dialog(
    '文件与元件',
    choice('add', '新建文件') +
      choice('import', '导入文件或工艺库') +
      choice('custom', '自定义元件') +
      group('工程文件') +
      files()
        .map((f) => choice('file/' + f.path, f.path))
        .join('') +
      group('元件库') +
      catalog()
        .map((d) => choice('part/' + d.id, d.label, d.prefix))
        .join(''),
  );
  choices((k) => {
    if (k === 'add') return newFile();
    if (k === 'import') return importMenu();
    if (k === 'custom') return customDialog();
    if (k.startsWith('file/')) {
      close();
      fileView(k.slice(5));
    } else partDialog(k.slice(5));
  });
}
async function classic() {
  await flush();
  sessionStorage.setItem(
    'opencircuit.classic.transfer',
    JSON.stringify({
      ...projectJson(project),
      workbenchId: project.id,
      workbenchRevision: project.revision,
    }),
  );
  location.href = './classic.html#workbench';
}
function initHandlers() {
  const clicks = {
    'project-btn': projectMenu,
    labs: labsMenu,
    models: modelMenu,
    'as-entry': () => setEntry(project.active),
    export: exportMenu,
    help,
    'add-file': newFile,
    import: importMenu,
    custom: customDialog,
    classic,
    settings: analysisOptions,
    run: () => (running ? cancelRun() : simulate()),
    'file-options': fileOptions,
    diagnostics,
    'mobile-project': mobileMenu,
    'zoom-in': () => drawZoom(zoom * 1.2),
    'zoom-out': () => drawZoom(zoom / 1.2),
    fit: () => drawZoom(1),
  };
  for (const [id, fn] of Object.entries(clicks)) $(id).onclick = guarded(fn);
  for (const el of document.querySelectorAll('[data-view]'))
    el.onclick = () => showView(el.dataset.view);
  $('layer').onchange = (e) => selectLayer(e.target.value);
  $('part-search').oninput = renderParts;
  $('part-list').onclick = guarded((e) => {
    const b = e.target.closest('[data-part]');
    if (b) partDialog(b.dataset.part);
  });
  let previousClick = null;
  $('drawing').onclick = (e) => {
    const target = e.target.closest('[data-component-id]');
    if (!target) return;
    const id = target.dataset.componentId,
      now = performance.now(),
      c = selectedAt(id);
    if (c.targetLayerId && previousClick?.id === id && now - previousClick.time < 400) {
      previousClick = null;
      selectLayer(c.targetLayerId);
    } else previousClick = { id, time: now };
  };
  $('drawing').ondblclick = (e) => {
    const c = e.target.closest('[data-component-id]'),
      item = currentLayer()?.components.find((x) => x.id === c?.dataset.componentId);
    if (item?.targetLayerId) selectLayer(item.targetLayerId);
  };
  $('drawing').onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const c = e.target.closest('[data-component-id]');
      if (c) {
        e.preventDefault();
        selectedAt(c.dataset.componentId);
      }
    }
  };
  for (const k of ['file-picker', 'folder-picker'])
    $(k).onchange = guarded(async (e) => {
      const list = Array.from(e.target.files);
      e.target.value = '';
      await importList(list, k === 'folder-picker');
    });
  document.onkeydown = guarded(async (e) => {
    if ($('modal').open || !(e.ctrlKey || e.metaKey)) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!running) await simulate();
    }
    if (e.key.toLowerCase() === 's') {
      e.preventDefault();
      await flush();
      setStatus(store ? '工程已保存' : '请从导出菜单保存工程 JSON');
    }
  });
}
function api() {
  const snap = () => {
    reparse();
    return {
      version: '3.0',
      project: {
        id: project.id,
        title: project.title,
        entry: project.entry,
        active: project.active,
        files: files().map(({ path, content }) => ({ path, size: content.length })),
      },
      config: structuredClone(project.config),
      configMode: project.configMode,
      view,
      layer: activeLayer,
      selection: selected,
      layers: design.layers.map((l) => ({
        id: l.id,
        name: l.name,
        file: l.file,
        line: l.line,
        components: l.components.length,
        nets: l.nets.length,
      })),
      diagnostics: structuredClone(design.diagnostics),
      run: {
        running: !!running,
        error: runError,
        analysis: result?.analysis || null,
        points: result?.points || 0,
        probes: result?.traces.map((t) => t.name) || [],
      },
      storage: store ? 'indexedDB' : 'memory',
    };
  };
  const ops = {
    state: snap,
    readFile: (path) => {
      const f = source(path);
      if (!f) throw Error('文件不存在。');
      return f.content;
    },
    createProject: async (data) => {
      await activate(readProject(data));
      await flush();
      return snap();
    },
    writeFile: (path, content) => {
      setFile(path, content);
      reparse();
      return snap();
    },
    openFile: fileView,
    setEntry,
    selectLayer,
    showView,
    inspectLayer: (id = activeLayer) => {
      reparse();
      const l = design.layers.find((x) => x.id === id);
      if (!l) throw Error('图层不存在。');
      return structuredClone(l);
    },
    selectComponent: (id) => structuredClone(selectedAt(id)),
    components: () => structuredClone(catalog()),
    registerComponent: addCustom,
    modelControls: () => {
      const data = readModelControls(project.entry, source(project.entry).content);
      const { sections } = indexModelSources(files());
      return {
        parameters: data.parameters,
        corners: data.corners.map((c) => ({ ...c, options: sections.get(c.path) || [] })),
      };
    },
    setModelControl: ({ kind, name, line, value }) => {
      const entry = source(project.entry),
        { parameters, corners } = readModelControls(project.entry, entry.content);
      const matches = [...parameters, ...corners].filter(
        (c) => c.kind === kind && c.name === name && (line == null || c.line === line),
      );
      if (matches.length !== 1)
        throw Error('请用 modelControls() 返回的名称、类型和源行选择唯一参数。');
      const c = matches[0],
        options = c.kind === 'corner' ? indexModelSources(files()).sections.get(c.path) || [] : [];
      setFile(entry.path, writeControl(entry.content, c, value, options));
      reparse();
      return snap();
    },
    place,
    configure: (cfg) => {
      setConfig(cfg);
      return structuredClone(project.config);
    },
    run: async (cfg) => {
      if (cfg) setConfig(cfg);
      return structuredClone(await simulate(null, false));
    },
    cancel: cancelRun,
    result: () => structuredClone(result),
    experiments: () =>
      experiments.map(({ id, name, config, expected }) => ({
        id,
        name,
        analysis: config.type,
        expected,
      })),
    runExperiment: async (id) => structuredClone(await openExperiment(id)),
    exportArtifact: makeExport,
    save: flush,
    showInstrument: (tab) => {
      showView('bench');
      bench.show(tab);
    },
  };
  Object.defineProperty(window, 'OpenCircuitEDA', {
    value: Object.freeze(ops),
    configurable: false,
  });
  window.dispatchEvent(new CustomEvent('opencircuit:ready'));
}
async function start() {
  editor = setupEditor((code) => {
    source(project.active).content = code;
    changed(project.active);
  }, setStatus);
  bench = mountBench($('bench'), {
    onInsert: (line) => {
      reparse();
      const l = design.layers.find((d) => d.id === design.entryLayerId),
        name = line.trim().split(/\s+/)[0];
      if (l.components.some((c) => c.name.toLowerCase() === name.toLowerCase()))
        throw Error('入口中已有 ' + name + '，请修改发生器位号。');
      insertCard(line, l);
      fileView(project.entry);
    },
    onExperiment: openExperiment,
  });
  let initial,
    isNew = true,
    deletedDuringTransfer = [],
    classicAction;
  try {
    store = await openStore();
    const id = localStorage.getItem('opencircuit.active');
    if (id) initial = await store.load(id);
    if (initial) isNew = false;
  } catch (e) {
    storageError = errorText(e);
  }
  if (location.hash.startsWith('#share=')) {
    try {
      const shared = JSON.parse(
        new TextDecoder().decode(
          Uint8Array.from(atob(location.hash.slice(7)), (c) => c.charCodeAt(0)),
        ),
      );
      initial = readProject(shared, '分享的电路');
      isNew = true;
      history.replaceState(null, '', location.pathname + location.search);
    } catch (e) {
      setStatus('分享工程读取失败：' + errorText(e));
    }
  }
  if (location.hash === '#from-classic') {
    const item = sessionStorage.getItem('opencircuit.from-classic');
    if (item) {
      const transferred = JSON.parse(item);
      initial = readProject(transferred, '经典绘图工程');
      if (transferred.workbenchId && store) {
        const previous = await store.load(transferred.workbenchId);
        if (previous?.revision === transferred.workbenchRevision && previous) {
          initial.id = previous.id;
          initial.revision = previous.revision;
          const paths = new Set(initial.files.map((f) => f.path));
          deletedDuringTransfer = previous.files
            .map((f) => f.path)
            .filter((path) => !paths.has(path));
        } else if (previous) {
          initial.title += ' · 绘图副本';
        }
      }
      classicAction = transferred.classicAction;
      isNew = true;
      sessionStorage.removeItem('opencircuit.from-classic');
      history.replaceState(null, '', location.pathname + location.search);
    }
  }
  await activate(initial || initialProject(), isNew);
  for (const path of deletedDuringTransfer) removed.add(path);
  initHandlers();
  api();
  if (classicAction?.tab === 'pdk') modelMenu();
  else if (classicAction && Object.hasOwn(defaults, classicAction.type)) {
    const cfg = inferred(source(project.entry));
    if (cfg.type === classicAction.type) {
      setConfig(cfg);
      try {
        await simulate(cfg, false);
        showView('bench');
        bench.show(classicAction.tab || 'scope');
      } catch (e) {
        setStatus(errorText(e));
      }
    } else {
      configByType[mode()] = project.config;
      project.config = { ...defaults[classicAction.type] };
      updateHeader();
      analysisOptions();
    }
  }
  if (storageError) setStatus(storageError);
}
start().catch((e) => {
  setStatus('工作台启动失败：' + errorText(e));
  console.error(e);
});
