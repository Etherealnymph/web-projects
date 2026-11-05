import {
  TYPES,
  spec,
  mask,
  validateGraph,
  validateModules,
  primitiveTypes,
  createRuntime,
  simulate,
  tick,
  assemble,
} from './engine.js';
import { LEVELS, starter, solution, testLevel, DEFAULT_PROGRAM } from './levels.js';
import { readWorkspace, writeWorkspace, exportWorkspace, parseImport } from './storage.js';
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const clone = (x) => structuredClone(x),
  uid = (prefix) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const SANDBOX = {
  id: 'sandbox',
  number: 0,
  chapter: '自由实验',
  name: '一张空白的可能',
  subtitle: '自由实验台 · 不计关卡成绩',
  inputs: [
    { key: 'A', width: 1 },
    { key: 'B', width: 1 },
  ],
  outputs: [{ key: 'Y', width: 1 }],
  allowed: Object.keys(TYPES),
  brief:
    '这里可以自由添加输入和输出、修改端口名称与位宽，试验所有基础组件。组合电路可以封装为可复用芯片；点击验证会检查连线结构，不会自动证明它符合你的设计意图。',
  hint: '给输入与输出使用唯一英文名称；连接相同位宽的端口。组合反馈不允许，寄存器反馈允许。',
  coverage: '结构检查',
};
let storage;
try {
  storage = window.localStorage;
} catch {
  storage = {
    getItem() {
      throw Error('浏览器禁止本地存储');
    },
    setItem() {
      throw Error('浏览器禁止本地存储');
    },
  };
}
const loaded = readWorkspace(storage);
let workspace = loaded.data,
  level,
  record,
  graph,
  runtime,
  sim,
  inputs = {},
  selected = null,
  pending = null,
  pointer = { x: 0, y: 0 },
  view = { x: 0, y: 0, w: 1280, h: 740 },
  drag = null,
  runner = null,
  history = new Map(),
  currentTab = 'observe',
  toastTimer,
  result = null,
  listing = [];
const svg = $('#circuit');
function notify(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4000);
}
function persist() {
  workspace.current = level.id;
  record.graph = graph;
  const r = writeWorkspace(storage, workspace);
  $('#save-status').textContent = r.ok ? '已保存到本机' : '保存失败 · 请导出';
  $('#save-status').classList.toggle('failed', !r.ok);
  if (!r.ok) notify(r.error);
}
function unlocked(l) {
  return l.id === 'sandbox' || l.index === 0 || !!workspace.progress[LEVELS[l.index - 1].id];
}
function isSequential() {
  return graph.nodes.some((n) => TYPES[n.type]?.sequential);
}
function stopRun() {
  if (runner) {
    clearInterval(runner);
    runner = null;
  }
  $('#run').textContent = '▶ 运行';
}
function clearTest() {
  result = null;
  $('#next-level').hidden = true;
  renderResult();
}
function resetRuntime() {
  stopRun();
  runtime = createRuntime(graph);
  try {
    const source = record.program || graph.nodes.find((n) => n.type === 'ROM')?.cfg.program;
    listing = source ? assemble(source).listing : [];
    if (source) runtime.program = assemble(source).words;
  } catch {
    listing = [];
  }
  refreshSimulation();
}
function remember(before) {
  const h = history.get(level.id) || { undo: [], redo: [] };
  h.undo.push(clone(before));
  if (h.undo.length > 60) h.undo.shift();
  h.redo = [];
  history.set(level.id, h);
}
function mutate(fn, { assisted = false } = {}) {
  const before = clone(graph);
  fn();
  if (JSON.stringify(before) === JSON.stringify(graph)) return;
  remember(before);
  if (assisted) record.assisted = true;
  clearTest();
  resetRuntime();
  persist();
  renderPalette();
  renderInspector();
  renderNav();
  renderInputs();
  updateAssistance();
}
function selectLevel(id, { force = false } = {}) {
  stopRun();
  const next = id === 'sandbox' ? SANDBOX : LEVELS.find((l) => l.id === id);
  if (!next) return;
  const locked = !unlocked(next);
  if (
    locked &&
    !force &&
    !confirm('这关还未解锁。进入“探索练习”可以提前查看与搭建，但不记为独立完成。继续？')
  )
    return;
  level = next;
  record =
    workspace.records[id] ||
    (workspace.records[id] = {
      graph: starter(level),
      assisted: locked,
      program: level.cpu ? DEFAULT_PROGRAM : '',
    });
  if (locked) record.assisted = true;
  graph = record.graph;
  inputs = {};
  selected = null;
  pending = null;
  result = null;
  $('#stage-chapter').textContent =
    level.id === 'sandbox'
      ? 'OPEN WORKSHOP'
      : String(level.number).padStart(2, '0') + ' / ' + level.chapter;
  $('#stage-title').textContent = level.name;
  $('#stage-subtitle').textContent = level.subtitle;
  $('#brief').textContent = level.brief;
  $('#hint-text').textContent = level.hint;
  $('#hint').open = false;
  $('#program-source').value = record.program || DEFAULT_PROGRAM;
  $('#assembly-status').textContent = '装载后使用“时钟 +1”逐条执行；“验证电路”运行固定回归程序。';
  $('#next-level').hidden = true;
  $('#demo').hidden = level.id === 'sandbox';
  $('#test').innerHTML = level.id === 'sandbox' ? '检查结构 <span>↗</span>' : '验证电路 <span>↗</span>';
  renderPalette();
  renderNav();
  renderInputs();
  renderTruth();
  renderResult();
  renderInspector();
  updateAssistance();
  setTab(level.cpu ? 'program' : 'observe');
  resetRuntime();
  fit();
}
function updateAssistance() {
  const badge = $('#assistance-badge');
  badge.textContent = record.assisted
    ? '示范 / 探索练习'
    : level.id === 'sandbox'
      ? '自由设计'
      : '自主构建';
  badge.classList.toggle('practice', record.assisted);
}
function renderNav() {
  let chapter = '';
  $('#level-list').innerHTML = LEVELS.map((l) => {
    let s = '';
    if (l.chapter !== chapter) {
      chapter = l.chapter;
      s = '<div class="chapter-label">' + esc(chapter) + '</div>';
    }
    const progress = workspace.progress[l.id],
      locked = !unlocked(l),
      mark = progress?.kind === 'independent' ? '✓' : progress ? '◐' : locked ? '·' : '';
    return (
      s +
      `<button class="level-button ${l.id === level.id ? 'active' : ''} ${locked ? 'locked' : ''}" data-level="${l.id}" ${l.id === level.id ? 'aria-current="step"' : ''} title="${l.number}. ${esc(l.name)}${locked ? '（可进入探索练习）' : ''}${progress ? ' · ' + (progress.kind === 'independent' ? '独立完成' : '练习通过') : ''}"><span class="num">${l.id}</span><span class="level-name">${esc(l.name)}</span><span class="level-mark">${mark}</span></button>`
    );
  }).join('');
  const independent = Object.values(workspace.progress).filter((p) => p.kind === 'independent').length,
    practice = Object.values(workspace.progress).filter((p) => p.kind === 'practice').length;
  $('#progress-label').textContent =
    independent + ' / 20 独立完成' + (practice ? ' · ' + practice + ' 关练习' : '');
  $('#progress-bar').style.width = (independent / 20) * 100 + '%';
}
function renderPalette() {
  const modules = Object.values(workspace.modules).filter((m) =>
    primitiveTypes(m.graph, workspace.modules).every((t) => level.allowed.includes(t)),
  );
  const choices = level.allowed.filter((t) => level.id === 'sandbox' || !['IN', 'OUT'].includes(t));
  $('#component-type').innerHTML =
    choices.map((t) => `<option value="${t}">${esc(TYPES[t].label)}</option>`).join('') +
    modules.map((m) => `<option value="MOD:${esc(m.id)}">芯片 · ${esc(m.name)}</option>`).join('');
  $('#quick-components').innerHTML = choices
    .filter((t) => ['NAND', 'NOT', 'AND', 'XOR'].includes(t))
    .slice(0, 2)
    .map((t) => `<button class="small-btn" data-add="${t}">${t}</button>`)
    .join('');
  renderLibrary();
}
function addComponent(type) {
  if (!type) return;
  if (!type.startsWith('MOD:') && !level.allowed.includes(type)) return;
  let cfg = {};
  if (type === 'CONST') cfg = { value: 0, width: 1 };
  if (['IN', 'OUT'].includes(type)) {
    const prefix = type === 'IN' ? 'IN' : 'OUT';
    let n = 1;
    while (graph.nodes.some((x) => x.cfg.key === prefix + n)) n++;
    cfg = { key: prefix + n, width: 1 };
  }
  if (type === 'ROM') cfg = { program: record.program || DEFAULT_PROGRAM };
  const id = uid('n'),
    x = Math.round((view.x + view.w * 0.4) / 10) * 10,
    y = Math.round((view.y + view.h * 0.35) / 10) * 10;
  mutate(() => graph.nodes.push({ id, type, x, y, cfg }), {
    assisted: type.startsWith('MOD:') && workspace.modules[type.slice(4)].assisted,
  });
  selected = { kind: 'node', id };
  draw();
  renderInspector();
  notify(
    '已放入 ' +
      spec(
        graph.nodes.find((n) => n.id === id),
        workspace.modules,
      ).label +
      '；拖动可移动',
  );
}
function renderInputs() {
  const nodes = graph.nodes.filter((n) => n.type === 'IN');
  $('#input-controls').innerHTML =
    nodes
      .map((n) => {
        const width = n.cfg.width || 1;
        return `<div class="signal-row"><span>${esc(n.cfg.key)}<small>${width} bit</small></span><div class="signal-control">${width === 1 ? `<button class="bit-toggle ${inputs[n.cfg.key] || 0 ? 'on' : ''}" data-input="${esc(n.cfg.key)}" aria-label="切换输入 ${esc(n.cfg.key)}" aria-pressed="${!!inputs[n.cfg.key]}">${inputs[n.cfg.key] || 0}</button>` : `<input class="bus-input" type="number" min="0" max="${mask(width)}" value="${inputs[n.cfg.key] || 0}" data-input="${esc(n.cfg.key)}" aria-label="输入 ${esc(n.cfg.key)}，0 至 ${mask(width)}">`}</div></div>`;
      })
      .join('') + (nodes.length ? '' : '<p class="muted">无外部输入；信号来自程序与内部状态。</p>');
}
function renderOutputs() {
  const nodes = graph.nodes.filter((n) => n.type === 'OUT');
  $('#output-values').innerHTML = nodes
    .map((n) => {
      const val = sim?.outputs[n.cfg.key] ?? null;
      return `<div class="signal-row"><span>${esc(n.cfg.key)}<small>输出</small>${(n.cfg.width || 1) > 1 ? `<span class="binary">${val === null ? '·'.repeat(n.cfg.width) : val.toString(2).padStart(n.cfg.width, '0')}</span>` : ''}</span><output class="output-value ${val === null ? 'unknown' : val ? 'on' : ''}">${val === null ? '?' : val}</output></div>`;
    })
    .join('');
}
function renderTruth() {
  if (level.cpu || level.sequential || level.id === 'sandbox') {
    $('#truth-table').innerHTML = '';
    return;
  }
  const cases = level.cases(),
    keys = level.inputs.map((p) => p.key),
    out = level.outputs.map((p) => p.key);
  $('#truth-table').innerHTML =
    `<table aria-label="目标真值表"><thead><tr>${[...keys, ...out].map((k) => '<th>' + esc(k) + '</th>').join('')}</tr></thead><tbody>${cases
      .slice(0, 16)
      .map((a) => {
        const expected = level.expect(a);
        return (
          '<tr>' +
          [...keys.map((k) => a[k]), ...out.map((k) => expected[k])]
            .map((v) => '<td>' + v + '</td>')
            .join('') +
          '</tr>'
        );
      })
      .join('')}</tbody></table>` +
    (cases.length > 16
      ? `<p class="muted">显示前 16 项；验证使用 ${cases.length} 项。<br>${esc(level.coverage)}</p>`
      : '');
}
function renderResult() {
  const el = $('#test-result');
  el.className = 'test-result';
  if (!result) {
    el.innerHTML =
      '<div class="result-mark">○</div><strong>等待验证</strong><p>' +
      esc(level.coverage) +
      '<br>完成连接后，点击“验证电路”。</p>';
    return;
  }
  el.classList.add(result.pass ? 'pass' : 'fail');
  let description = result.pass
    ? level.id === 'sandbox'
      ? '结构有效。功能仍需按你的设计验证。'
      : record.assisted
        ? '练习通过，下一关已解锁。'
        : '已记录独立完成，下一关已解锁。'
    : result.errors.length
      ? '先完成这些连接与结构检查。'
      : '发现一个不符合目标的输出。';
  el.innerHTML = `<div class="result-mark">${result.pass ? '✓' : '↯'}</div><strong>${result.pass ? (level.id === 'sandbox' ? '结构检查通过' : record.assisted ? '示范 / 探索练习通过' : '独立验证通过') : '还差一点连接'}</strong><p>${esc(description)}${result.pass ? '<br>通过 ' + result.count + ' 项检查。' : ''}</p>`;
  if (result.errors.length)
    el.innerHTML +=
      '<pre>' +
      esc(result.errors.slice(0, 6).join('\n')) +
      (result.errors.length > 6 ? '\n…另有 ' + (result.errors.length - 6) + ' 项' : '') +
      '</pre>';
  if (result.failure) {
    const f = result.failure;
    el.innerHTML +=
      '<pre>' +
      esc(
        (f.program ? '程序：' + f.program + '\n' : '') +
          (f.step !== undefined ? '时钟：' + f.step + '\n' : '') +
          '输入 ' +
          JSON.stringify(f.inputs) +
          '\n目标 ' +
          JSON.stringify(f.expected) +
          '\n实际 ' +
          JSON.stringify(f.actual),
      ) +
      '</pre>';
  }
}
function runValidation() {
  stopRun();
  $('#test').disabled = true;
  $('#test').textContent = '正在检查…';
  setTimeout(() => {
    try {
      if (level.id === 'sandbox') {
        const errors = [
          ...validateModules(workspace.modules),
          ...validateGraph(graph, workspace.modules),
        ];
        result = { pass: errors.length === 0, count: 1, errors };
      } else result = testLevel(level, graph, workspace.modules);
      if (result.pass && level.id !== 'sandbox') {
        const previous = workspace.progress[level.id];
        if (previous?.kind !== 'independent')
          workspace.progress[level.id] = {
            kind: record.assisted ? 'practice' : 'independent',
            date: new Date().toISOString(),
          };
        persist();
        renderNav();
        $('#next-level').hidden = level.index === LEVELS.length - 1;
        notify(
          level.cpu
            ? '四段程序全部通过。你的电路已能执行真实指令。'
            : '验证通过 · ' + result.count + ' 项检查',
        );
      }
      renderResult();
      setTab('observe');
    } catch (e) {
      result = { pass: false, count: 0, errors: [e.message] };
      renderResult();
      setTab('observe');
    } finally {
      $('#test').disabled = false;
      $('#test').innerHTML = (level.id === 'sandbox' ? '检查结构' : '验证电路') + ' <span>↗</span>';
    }
  }, 30);
}
function nodeHeight(n) {
  const d = spec(n, workspace.modules);
  return 63 + Math.max(d.inputs.length, d.outputs.length, 1) * 24;
}
function pinPosition(node, port, direction) {
  const d = spec(node, workspace.modules),
    pins = direction === 'in' ? d.inputs : d.outputs;
  return {
    x: node.x + (direction === 'in' ? 0 : 158),
    y: node.y + 61 + pins.findIndex((p) => p.name === port) * 24,
  };
}
function curve(a, b) {
  const offset = Math.max(45, Math.abs(b.x - a.x) * 0.48);
  return `M ${a.x} ${a.y} C ${a.x + offset} ${a.y}, ${b.x - offset} ${b.y}, ${b.x} ${b.y}`;
}
function clientToGraph(e) {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const matrix = svg.getScreenCTM();
  return matrix ? pt.matrixTransform(matrix.inverse()) : { x: 0, y: 0 };
}
function draw() {
  if (!sim) return;
  svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
  const map = new Map(graph.nodes.map((n) => [n.id, n]));
  let content = `<defs><pattern id="grid" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="#365348"/></pattern></defs><rect x="${view.x - 10000}" y="${view.y - 10000}" width="30000" height="30000" fill="url(#grid)" data-background="true"/>`;
  content +=
    '<g class="wires">' +
    graph.wires
      .map((w) => {
        const from = map.get(w.from.node),
          to = map.get(w.to.node);
        if (!from || !to) return '';
        const a = pinPosition(from, w.from.port, 'out'),
          b = pinPosition(to, w.to.port, 'in'),
          val = sim.values[from.id]?.[w.from.port] ?? null,
          width = spec(from, workspace.modules).outputs.find((p) => p.name === w.from.port)?.width;
        const path = curve(a, b),
          selectedClass = selected?.kind === 'wire' && selected.id === w.id ? 'selected' : '';
        return `<g data-wire="${w.id}" tabindex="0" role="button" aria-label="连线 ${esc(from.cfg.key || TYPES[from.type]?.label || from.type)} ${esc(w.from.port)} 到 ${esc(to.cfg.key || TYPES[to.type]?.label || to.type)} ${esc(w.to.port)}，值 ${val ?? '未定义'}"><path class="wire ${val === null ? 'unknown' : val ? 'high' : ''} ${selectedClass}" d="${path}"/><path class="wire-hit" d="${path}"/>${width > 1 ? `<text class="wire-label" x="${(a.x + b.x) / 2}" y="${(a.y + b.y) / 2 - 8}" text-anchor="middle">${val ?? '?'} / ${width}b</text>` : ''}</g>`;
      })
      .join('') +
    '</g>';
  content +=
    '<g class="nodes">' +
    graph.nodes
      .map((n) => {
        const d = spec(n, workspace.modules),
          height = nodeHeight(n),
          sel = selected?.kind === 'node' && selected.id === n.id,
          title = n.label || n.cfg.key || d.label;
        let html = `<g class="node ${d.io ? 'node-io' : ''} ${d.sequential ? 'node-seq' : ''} ${d.module ? 'node-module' : ''} ${sel ? 'selected' : ''}" data-node="${n.id}" transform="translate(${n.x},${n.y})" tabindex="0" role="button" aria-label="元件 ${esc(title)}，${esc(d.label)}，方向键移动"><rect class="node-body" width="158" height="${height}" rx="7"/><text class="node-heading" x="14" y="25">${esc(title.length > 15 ? title.slice(0, 14) + '…' : title)}</text><text class="node-caption" x="14" y="40">${n.type === 'CONST' ? n.cfg.value + ' / ' + (n.cfg.width || 1) + ' BIT' : d.sequential ? 'EDGE TRIGGERED' : d.module ? 'CUSTOM CHIP' : ['IN', 'OUT'].includes(n.type) ? (n.cfg.width || 1) + ' BIT · ' + n.type : n.type}</text><line class="node-divider" x1="12" y1="47" x2="146" y2="47"/>`;
        for (const [direction, pins] of [
          ['in', d.inputs],
          ['out', d.outputs],
        ])
          for (const [i, pin] of pins.entries()) {
            const y = 61 + i * 24,
              x = direction === 'in' ? 0 : 158,
              val = direction === 'out' ? sim.values[n.id]?.[pin.name] : sim.read(n.id, pin.name);
            const pendingClass =
              pending?.node === n.id && pending.port === pin.name && direction === 'out'
                ? 'pending'
                : '';
            html += `<g data-pin-node="${n.id}" data-pin-port="${pin.name}" data-pin-direction="${direction}"><circle class="pin-hit" cx="${x}" cy="${y}" r="12"/><circle class="pin pin-${direction === 'in' ? 'input' : 'output'} ${val ? 'high' : ''} ${pendingClass}" cx="${x}" cy="${y}" r="5" tabindex="0" role="button" aria-label="${esc(title)} ${direction === 'in' ? '输入' : '输出'} ${pin.name}，${pin.width} 位，值 ${val ?? '未连接'}"/><text class="node-pin-label" x="${direction === 'in' ? 13 : 145}" y="${y + 3}" text-anchor="${direction === 'in' ? 'start' : 'end'}">${pin.name}${pin.width > 1 ? ' · ' + pin.width : ''}</text></g>`;
          }
        if (n.type === 'OUT')
          html += `<text class="node-value" x="141" y="65" text-anchor="end">${sim.outputs[n.cfg.key] ?? '?'}</text>`;
        return html + '</g>';
      })
      .join('') +
    '</g>';
  if (pending) {
    const from = map.get(pending.node);
    if (from)
      content += `<path class="pending-wire" d="${curve(pinPosition(from, pending.port, 'out'), pointer)}"/>`;
  }
  svg.innerHTML = content;
  $('#graph-size').textContent = graph.nodes.length + ' 元件 · ' + graph.wires.length + ' 连线';
  $('#canvas-guide').hidden = graph.wires.length > 2 || graph.nodes.length > 5;
  $('#zoom-label').textContent = Math.round((1280 / view.w) * 100) + '%';
  const h = history.get(level.id);
  $('#undo').disabled = !h?.undo.length;
  $('#redo').disabled = !h?.redo.length;
  $('#delete').disabled = !selected;
  $('#clear-wire').disabled = !pending;
}
function refreshSimulation() {
  try {
    sim = simulate(graph, inputs, runtime, workspace.modules);
    draw();
    renderOutputs();
    renderCPU();
    $('#runtime-label').textContent = isSequential()
      ? '第 ' + runtime.ticks + ' 拍 · 边沿同步更新'
      : '组合逻辑 · 实时求值';
    $('#step').disabled = !isSequential();
    $('#run').disabled = !isSequential();
    $('#reset-sim').disabled = !isSequential();
  } catch (e) {
    notify(e.message);
  }
}
function fit() {
  if (!graph.nodes.length) {
    view = { x: 0, y: 0, w: 1280, h: 740 };
    draw();
    return;
  }
  const minX = Math.min(...graph.nodes.map((n) => n.x)) - 80,
    minY = Math.min(...graph.nodes.map((n) => n.y)) - 90,
    maxX = Math.max(...graph.nodes.map((n) => n.x + 158)) + 80,
    maxY = Math.max(...graph.nodes.map((n) => n.y + nodeHeight(n))) + 110;
  view = { x: minX, y: minY, w: Math.max(700, maxX - minX), h: Math.max(430, maxY - minY) };
  draw();
}
function zoom(factor) {
  const w = Math.min(7000, Math.max(300, view.w * factor)),
    h = (view.h * w) / view.w;
  view = { x: view.x + (view.w - w) / 2, y: view.y + (view.h - h) / 2, w, h };
  draw();
}
function renderInspector() {
  const el = $('#inspector');
  if (!selected) {
    el.innerHTML =
      '<span>选择元件，可查看端口与属性。</span><span class="keyboard-note">⌘/Ctrl Z 撤销 · Delete 删除</span>';
    return;
  }
  if (selected.kind === 'wire') {
    el.innerHTML =
      '<strong>连线已选择</strong><span>按 Delete 或点击 ⌫ 删除；重新连接会替换原输入线。</span>';
    return;
  }
  const n = graph.nodes.find((n) => n.id === selected.id);
  if (!n) {
    selected = null;
    renderInspector();
    return;
  }
  const d = spec(n, workspace.modules);
  el.innerHTML = `<strong>${esc(d.label)}</strong><label>标签 <input data-prop="label" value="${esc(n.label || '')}" maxlength="32" aria-label="元件标签"></label>`;
  if (n.type === 'CONST')
    el.innerHTML += `<label>数值 <input data-prop="value" type="number" min="0" max="${mask(n.cfg.width || 1)}" value="${n.cfg.value}" style="width:65px"></label>`;
  if (n.type === 'CONST' || (level.id === 'sandbox' && d.io))
    el.innerHTML += `<label>位宽 <select data-prop="width">${[1, 2, 3, 4, 8, 16].map((w) => `<option value="${w}" ${w === (n.cfg.width || 1) ? 'selected' : ''}>${w}</option>`).join('')}</select></label>`;
  if (level.id === 'sandbox' && d.io)
    el.innerHTML += `<label>端口名 <input data-prop="key" value="${esc(n.cfg.key)}" maxlength="32"></label>`;
  if (d.sequential) el.innerHTML += '<span>复位初值 0 · 同步边沿写入</span>';
}
function changeProperty(e) {
  const prop = e.target.dataset.prop;
  if (!prop || selected?.kind !== 'node') return;
  const n = graph.nodes.find((n) => n.id === selected.id),
    candidate = clone(graph),
    copy = candidate.nodes.find((x) => x.id === n.id);
  if (prop === 'label') copy.label = e.target.value;
  else if (prop === 'key') copy.cfg.key = e.target.value;
  else {
    const num = Number(e.target.value);
    if (!Number.isInteger(num)) {
      notify('请输入整数');
      renderInspector();
      return;
    }
    copy.cfg[prop] = num;
    if (prop === 'width' && copy.type === 'CONST') copy.cfg.value &= mask(num);
  }
  const errors = validateGraph(candidate, workspace.modules, { strict: false });
  if (errors.length) {
    notify(errors[0] + '；原设置已保留');
    renderInspector();
    return;
  }
  mutate(() => {
    graph = candidate;
  });
  renderInputs();
  refreshSimulation();
}
function removeSelected() {
  if (!selected) return;
  if (selected.kind === 'node') {
    const n = graph.nodes.find((n) => n.id === selected.id);
    if (level.id !== 'sandbox' && TYPES[n?.type]?.io) {
      notify('关卡的输入与输出需要保留；自由实验台可以修改。');
      return;
    }
    const id = selected.id;
    mutate(() => {
      graph.nodes = graph.nodes.filter((n) => n.id !== id);
      graph.wires = graph.wires.filter((w) => w.from.node !== id && w.to.node !== id);
    });
    renderInputs();
  } else {
    const id = selected.id;
    mutate(() => (graph.wires = graph.wires.filter((w) => w.id !== id)));
  }
  selected = null;
  pending = null;
  renderInspector();
  refreshSimulation();
}
function selectPin(el) {
  const id = el.dataset.pinNode,
    port = el.dataset.pinPort,
    direction = el.dataset.pinDirection;
  if (direction === 'out') {
    pending = { node: id, port };
    const n = graph.nodes.find((n) => n.id === id);
    pointer = pinPosition(n, port, 'out');
    notify('输出已选择；再点击目标输入圆点。');
    draw();
    return;
  }
  if (!pending) {
    notify('先点击一个输出端口，再点击此输入端口。');
    return;
  }
  const from = clone(pending),
    candidate = clone(graph);
  candidate.wires = candidate.wires.filter((w) => !(w.to.node === id && w.to.port === port));
  candidate.wires.push({ id: uid('w'), from, to: { node: id, port } });
  const errors = validateGraph(candidate, workspace.modules, { strict: false });
  if (errors.length) {
    notify(errors[0]);
    return;
  }
  pending = null;
  mutate(() => (graph = candidate));
  notify('连线已接通');
}
function undo(redo = false) {
  stopRun();
  const h = history.get(level.id);
  if (!h) return;
  const source = redo ? h.redo : h.undo,
    dest = redo ? h.undo : h.redo;
  if (!source.length) return;
  dest.push(clone(graph));
  graph = source.pop();
  record.graph = graph;
  selected = null;
  pending = null;
  clearTest();
  resetRuntime();
  persist();
  renderInspector();
  renderInputs();
}
function stepClock() {
  if (!isSequential()) return false;
  try {
    const pc = graph.nodes.find((n) => n.type === 'PC8');
    if (pc && sim.read(pc.id, 'HALT') === 1) {
      stopRun();
      notify('HALT · 程序已停机，PC 保持。');
      return false;
    }
    tick(graph, inputs, runtime, workspace.modules);
    refreshSimulation();
    return true;
  } catch (e) {
    stopRun();
    notify(e.message);
    return false;
  }
}
function renderCPU() {
  const sequential = graph.nodes.filter((n) => TYPES[n.type]?.sequential && !TYPES[n.type]?.memory);
  $('#cpu-ticks').textContent = runtime.ticks + ' 拍';
  $('#cpu-state').innerHTML =
    sequential
      .map(
        (n) =>
          `<div class="signal-row"><span>${esc(n.label || TYPES[n.type].label)}</span><output class="output-value">${runtime.state[n.id]?.q ?? 0}</output></div>`,
      )
      .join('') || '<p class="muted">还没有寄存器。先放入并连接电路。</p>';
  const ram = graph.nodes.find((n) => n.type === 'RAM8'),
    address = Number($('#memory-address').value);
  $('#memory-value').textContent =
    ram && Number.isInteger(address) && address >= 0 && address <= 255
      ? runtime.state[ram.id].memory[address]
      : '—';
  const pc = graph.nodes.find((n) => n.type === 'PC8'),
    pcValue = pc ? runtime.state[pc.id].q : -1;
  $('#program-listing').innerHTML = listing
    .map(
      (l) =>
        `<div class="listing-line ${l.address === pcValue ? 'current' : ''}"><span>${l.address.toString(16).padStart(2, '0')}</span><span>${l.word.toString(16).padStart(4, '0')}</span>${esc(l.source)}</div>`,
    )
    .join('');
}
function setTab(name) {
  currentTab = name;
  for (const t of ['observe', 'library', 'program']) {
    $('#tab-' + t).classList.toggle('active', t === name);
    $('#tab-' + t).setAttribute('aria-selected', t === name ? 'true' : 'false');
    $('#panel-' + t).hidden = t !== name;
  }
}
function renderLibrary() {
  const modules = Object.values(workspace.modules);
  $('#module-count').textContent = modules.length;
  $('#module-list').innerHTML = modules.length
    ? modules
        .map((m) => {
          const node = { type: 'MOD:' + m.id };
          const d = spec(node, workspace.modules),
            available = primitiveTypes(m.graph, workspace.modules).every((t) =>
              level.allowed.includes(t),
            );
          return `<article class="module-card"><h3>${esc(m.name)} ${m.assisted ? '<span class="badge practice">练习来源</span>' : ''}</h3><p>IN ${d.inputs.map((p) => esc(p.name) + '[' + p.width + ']').join(' · ')}<br>OUT ${d.outputs.map((p) => esc(p.name) + '[' + p.width + ']').join(' · ')}</p><div class="module-actions"><button data-module-add="${m.id}" ${available ? '' : 'disabled'}>${available ? '放入画布' : '本关未解锁内部元件'}</button><button data-module-delete="${m.id}">删除</button></div></article>`;
        })
        .join('')
    : '<div class="library-empty">这里还没有芯片。<br>做好一块组合电路，再点击“封装芯片”。</div>';
}
function prepareModule() {
  const errors = validateGraph(graph, workspace.modules);
  if (errors.length) {
    notify('封装前请完成电路：' + errors[0]);
    return;
  }
  if (graph.nodes.some((n) => TYPES[n.type]?.sequential || n.type === 'ROM')) {
    notify('当前只支持封装组合电路；状态元件暂不支持。');
    return;
  }
  const ports = (type) =>
    graph.nodes
      .filter((n) => n.type === type)
      .map((n) => n.cfg.key + '[' + (n.cfg.width || 1) + ']')
      .join('、');
  if (!ports('IN') || !ports('OUT')) {
    notify('芯片至少需要一个输入和一个输出。');
    return;
  }
  $('#module-preview').textContent = '输入 ' + ports('IN') + ' → 输出 ' + ports('OUT');
  $('#module-name').value = '';
  $('#module-error').textContent = '';
  $('#module-dialog').showModal();
  $('#module-name').focus();
}
function saveModule(e) {
  if (e.submitter?.value !== 'save') return;
  e.preventDefault();
  const name = $('#module-name').value.trim();
  if (!name) return;
  const id = uid('chip'),
    candidate = {
      ...workspace.modules,
      [id]: { id, name, graph: clone(graph), assisted: record.assisted },
    };
  const errors = validateModules(candidate);
  if (errors.length) {
    $('#module-error').textContent = errors[0];
    return;
  }
  workspace.modules = candidate;
  persist();
  renderPalette();
  $('#module-dialog').close();
  setTab('library');
  notify('已保存芯片「' + name + '」');
}
function deleteModule(id) {
  const type = 'MOD:' + id;
  const used =
    Object.values(workspace.records).some((r) => r.graph.nodes.some((n) => n.type === type)) ||
    Object.values(workspace.modules).some((m) => m.graph.nodes.some((n) => n.type === type)) ||
    [...history.values()].some((h) =>
      [...h.undo, ...h.redo].some((g) => g.nodes.some((n) => n.type === type)),
    );
  if (used) {
    notify('这块芯片仍被电路或撤销历史引用。移除引用后重新打开页面，再尝试删除。');
    return;
  }
  if (confirm('删除芯片「' + workspace.modules[id].name + '」？')) {
    delete workspace.modules[id];
    persist();
    renderPalette();
  }
}
function download(text, name) {
  const blob = new Blob([text], { type: 'application/json' }),
    url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
svg.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  const pin = e.target.closest('[data-pin-node]');
  if (pin) {
    e.preventDefault();
    selectPin(pin);
    return;
  }
  const node = e.target.closest('[data-node]'),
    wire = e.target.closest('[data-wire]'),
    point = clientToGraph(e);
  if (node) {
    selected = { kind: 'node', id: node.dataset.node };
    const n = graph.nodes.find((x) => x.id === selected.id);
    drag = { kind: 'node', id: n.id, start: point, x: n.x, y: n.y, before: clone(graph), moved: false };
  } else if (wire) {
    selected = { kind: 'wire', id: wire.dataset.wire };
    drag = null;
  } else {
    selected = null;
    drag = { kind: 'pan', start: point, view: { ...view }, clientX: e.clientX, clientY: e.clientY };
  }
  svg.focus({ preventScroll: true });
  svg.setPointerCapture(e.pointerId);
  renderInspector();
  draw();
});
svg.addEventListener('pointermove', (e) => {
  const p = clientToGraph(e);
  pointer = p;
  if (drag?.kind === 'node') {
    const n = graph.nodes.find((x) => x.id === drag.id);
    const dx = p.x - drag.start.x,
      dy = p.y - drag.start.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    if (drag.moved) {
      n.x = Math.max(-19000, Math.min(19000, Math.round((drag.x + dx) / 10) * 10));
      n.y = Math.max(-19000, Math.min(19000, Math.round((drag.y + dy) / 10) * 10));
      draw();
    }
  } else if (drag?.kind === 'pan') {
    const scale = svg.getScreenCTM()?.a || 1;
    view.x = drag.view.x - (e.clientX - drag.clientX) / scale;
    view.y = drag.view.y - (e.clientY - drag.clientY) / scale;
    draw();
  } else if (pending) {
    const from = graph.nodes.find((n) => n.id === pending.node);
    const preview = svg.querySelector('.pending-wire');
    if (from && preview)
      preview.setAttribute('d', curve(pinPosition(from, pending.port, 'out'), pointer));
  }
});
function finishDrag() {
  if (drag?.kind === 'node' && drag.moved) {
    remember(drag.before);
    persist();
    draw();
  }
  drag = null;
}
svg.addEventListener('pointerup', finishDrag);
svg.addEventListener('pointercancel', finishDrag);
svg.addEventListener(
  'wheel',
  (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      zoom(e.deltaY > 0 ? 1.1 : 0.9);
    }
  },
  { passive: false },
);
svg.addEventListener('keydown', (e) => {
  if (['Enter', ' '].includes(e.key)) {
    const pin = e.target.closest('[data-pin-node]');
    if (pin) {
      e.preventDefault();
      selectPin(pin);
      svg.focus();
      return;
    }
    const node = e.target.closest('[data-node]'),
      wire = e.target.closest('[data-wire]');
    if (node || wire) {
      e.preventDefault();
      selected = { kind: node ? 'node' : 'wire', id: node?.dataset.node || wire.dataset.wire };
      draw();
      renderInspector();
      svg.focus();
    }
  }
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && selected?.kind === 'node') {
    e.preventDefault();
    const n = graph.nodes.find((n) => n.id === selected.id),
      delta = e.shiftKey ? 50 : 10;
    mutate(() => {
      n.x = Math.max(
        -19000,
        Math.min(19000, n.x + (e.key === 'ArrowRight' ? delta : e.key === 'ArrowLeft' ? -delta : 0)),
      );
      n.y = Math.max(
        -19000,
        Math.min(19000, n.y + (e.key === 'ArrowDown' ? delta : e.key === 'ArrowUp' ? -delta : 0)),
      );
    });
    svg.focus();
  }
});
document.addEventListener('keydown', (e) => {
  const typing = e.target.matches('input,textarea,select');
  if (e.key === 'Escape') {
    pending = null;
    draw();
  }
  if (typing || $('#module-dialog').open) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    undo(e.shiftKey);
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    undo(true);
  } else if (['Delete', 'Backspace'].includes(e.key) && selected) {
    e.preventDefault();
    removeSelected();
  } else if (e.key === '+' || e.key === '=') zoom(0.85);
  else if (e.key === '-') zoom(1.15);
});
$('#level-list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-level]');
  if (b) {
    selectLevel(b.dataset.level);
    persist();
  }
});
$('#sandbox').onclick = () => {
  selectLevel('sandbox');
  persist();
};
$('#component-type').onchange = () => {};
$('#add-component').onclick = () => addComponent($('#component-type').value);
$('#quick-components').onclick = (e) => {
  const b = e.target.closest('[data-add]');
  if (b) addComponent(b.dataset.add);
};
$('#undo').onclick = () => undo();
$('#redo').onclick = () => undo(true);
$('#delete').onclick = removeSelected;
$('#clear-wire').onclick = () => {
  pending = null;
  draw();
};
$('#zoom-in').onclick = () => zoom(0.8);
$('#zoom-out').onclick = () => zoom(1.25);
$('#fit').onclick = fit;
$('#inspector').onchange = changeProperty;
$('#input-controls').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-input]');
  if (b) {
    inputs[b.dataset.input] = 1 - (inputs[b.dataset.input] || 0);
    renderInputs();
    refreshSimulation();
  }
});
$('#input-controls').addEventListener('change', (e) => {
  if (!e.target.matches('input[data-input]')) return;
  const n = graph.nodes.find((n) => n.type === 'IN' && n.cfg.key === e.target.dataset.input),
    value = Number(e.target.value);
  if (!Number.isInteger(value) || value < 0 || value > mask(n.cfg.width || 1)) {
    notify('输入需要在 0–' + mask(n.cfg.width || 1) + ' 之间');
    renderInputs();
    return;
  }
  inputs[n.cfg.key] = value;
  refreshSimulation();
});
$('#hint-btn').onclick = () => {
  setTab('observe');
  $('#hint').open = !$('#hint').open;
};
$('#test').onclick = runValidation;
$('#next-level').onclick = () => {
  if (level.index < 19) {
    selectLevel(LEVELS[level.index + 1].id);
    persist();
  }
};
$('#demo').onclick = () => {
  if (graph.wires.length || graph.nodes.some((n) => !TYPES[n.type]?.io)) {
    if (
      !confirm(
        '示范将替换当前画布，并标记为练习。可以撤销画布替换；练习标记需从空白重开才能解除。继续？',
      )
    )
      return;
  }
  mutate(() => (graph = solution(level)), { assisted: true });
  record.assisted = true;
  updateAssistance();
  persist();
  fit();
  notify('这是示范电路。点击“验证电路”体验检查，也可以逐根拆开观察。');
};
$('#restart').onclick = () => {
  if (!confirm('从本关空白电路重新开始？这会清空本关画布与撤销历史，历史通关记录仍保留。')) return;
  const wasAssisted = record.assisted;
  mutate(() => (graph = starter(level)));
  record.assisted = !unlocked(level);
  history.delete(level.id);
  if (wasAssisted) notify('已从空白重新开始；旧示范的撤销历史已清除。');
  selected = null;
  pending = null;
  clearTest();
  resetRuntime();
  persist();
  updateAssistance();
  renderInspector();
  fit();
};
$('#reset-sim').onclick = () => {
  resetRuntime();
  notify('所有寄存器和 RAM 已清零；电路与程序保留。');
};
$('#step').onclick = stepClock;
$('#run').onclick = () => {
  if (runner) {
    stopRun();
    return;
  }
  let steps = 0;
  $('#run').textContent = 'Ⅱ 暂停';
  runner = setInterval(() => {
    if (!stepClock()) return;
    steps++;
    if (steps >= 256) {
      stopRun();
      notify('连续运行 256 拍后暂停。可继续运行，或复位。');
    }
  }, 200);
};
for (const t of ['observe', 'library', 'program']) $('#tab-' + t).onclick = () => setTab(t);
$('.tabs').addEventListener('keydown', (e) => {
  if (!['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
  const names = ['observe', 'library', 'program'],
    i = names.indexOf(currentTab),
    next = names[(i + (e.key === 'ArrowRight' ? 1 : 2)) % 3];
  e.preventDefault();
  setTab(next);
  $('#tab-' + next).focus();
});
$('#save-module').onclick = prepareModule;
$('#module-form').addEventListener('submit', saveModule);
$('#module-list').onclick = (e) => {
  const add = e.target.closest('[data-module-add]'),
    del = e.target.closest('[data-module-delete]');
  if (add) addComponent('MOD:' + add.dataset.moduleAdd);
  if (del) deleteModule(del.dataset.moduleDelete);
};
$('#memory-address').oninput = renderCPU;
$('#load-program').onclick = () => {
  const source = $('#program-source').value;
  try {
    const assembled = assemble(source);
    record.program = source;
    for (const n of graph.nodes) if (n.type === 'ROM') n.cfg.program = source;
    resetRuntime();
    runtime.program = assembled.words;
    listing = assembled.listing;
    refreshSimulation();
    persist();
    $('#assembly-status').textContent =
      '已装载 ' + assembled.words.length + ' 条指令，寄存器与 RAM 已清零。';
    notify('汇编成功。用时钟执行你连接的电路。');
  } catch (e) {
    $('#assembly-status').textContent = e.message + '。原运行程序已保留。';
    notify(e.message);
  }
};
$('#export').onclick = () =>
  download(exportWorkspace(workspace), 'logic-loom-' + new Date().toISOString().slice(0, 10) + '.json');
$('#import').onclick = () => $('#import-file').click();
$('#import-file').onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    if (file.size > 1500000) throw Error('工程文件过大，上限 1.5 MB');
    const candidate = parseImport(await file.text());
    if (
      !confirm(
        '工程校验通过。导入将替换当前本机工程，且导入电路全部标记为练习，不导入成绩。建议先取消并导出当前工程。确认替换？',
      )
    )
      return;
    const saved = writeWorkspace(storage, candidate);
    if (!saved.ok) throw Error(saved.error + '；现有工程仍保留');
    stopRun();
    workspace = candidate;
    history.clear();
    selectLevel(workspace.current, { force: true });
    persist();
    notify('工程已导入；没有导入通关成绩。');
  } catch (err) {
    notify('导入失败：' + err.message + '。当前工程未改变。');
  }
};
window.addEventListener('beforeunload', () => stopRun());
selectLevel(workspace.current, { force: true });
if (loaded.error) {
  $('#save-status').textContent = '读取失败 · 原数据保留';
  $('#save-status').classList.add('failed');
  notify(loaded.error + '；请先导出可用工程，避免覆盖旧记录。');
}
