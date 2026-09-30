/**
 * 界面冒烟测试：用最小 DOM 垫片在 Node 里真正执行 assets/app.js，
 * 走一遍「文档 → 动图」和「图像 → 文档」两条主链路，抓运行时错误与 ID 拼写问题。
 *
 *   node tools/smoke-test.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(rootDir, p), 'utf8');

let failures = 0;
function check(name, ok, detail) {
  if (!ok) failures++;
  console.log(`[${ok ? '  ok  ' : ' FAIL '}] ${name}${detail ? ' — ' + detail : ''}`);
}
function section(t) { console.log('\n== ' + t + ' ==\n'); }

/* ------------------------------------------------------------------ *
 * 1. 静态检查：app.js 里引用的每个 id 都要在 index.html 中真实存在
 * ------------------------------------------------------------------ */
section('静态检查');

const html = read('index.html');
const appSrc = read('assets/app.js');
const htmlIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
const usedIds = new Set([...appSrc.matchAll(/\$\('([^']+)'\)/g)].map(m => m[1]));

const missing = [...usedIds].filter(id => !htmlIds.has(id));
check('app.js 引用的元素 id 全部存在于 index.html', missing.length === 0,
  missing.length ? '缺失：' + missing.join(', ') : `${usedIds.size} 个 id 全部命中`);

const viewIds = ['view-play', 'view-extract', 'view-format'];
check('三个视图容器齐全', viewIds.every(v => htmlIds.has(v)));
check('脚本按依赖顺序引入',
  html.indexOf('fourier-core.js') < html.indexOf('examples.js') &&
  html.indexOf('examples.js') < html.indexOf('app.js'));

/* ------------------------------------------------------------------ *
 * 2. 最小 DOM 垫片
 * ------------------------------------------------------------------ */
const drawCalls = { n: 0 };
const rafQueue = [];
let now = 0;

function makeCtx() {
  const ctx = {
    canvas: null, globalAlpha: 1, lineWidth: 1, lineJoin: '', lineCap: '',
    strokeStyle: '', fillStyle: '', shadowColor: '', shadowBlur: 0,
    imageSmoothingEnabled: true, imageSmoothingQuality: 'high',
    setTransform() { drawCalls.n++; }, clearRect() { drawCalls.n++; },
    save() {}, restore() {}, beginPath() {}, closePath() {},
    moveTo(x, y) {
      drawCalls.n++;
      ctx._lastMove = [x, y];
      if (ctx._capture && !ctx._firstMove) ctx._firstMove = [x, y];
    },
    lineTo() { drawCalls.n++; }, arc() { drawCalls.n++; }, fill() { drawCalls.n++; },
    stroke() { drawCalls.n++; }, fillRect() {}, strokeRect() {}, drawImage() { drawCalls.n++; },
    fillText() {}, measureText() { return { width: 100 }; },
    setLineDash() {}, translate() {}, rotate() {}, scale() {}, clip() {},
    quadraticCurveTo() {}, bezierCurveTo() {}, ellipse() {},
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    createImageData(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; },
    putImageData() {},
    getImageData(x, y, w, h) { return cannedImageData(w, h); }
  };
  return ctx;
}

/** 造一张假的位图（垫片无法真正光栅化，这里按需返回不同图形） */
let cannedShape = 'disc';
function cannedImageData(w, h) {
  const data = new Uint8ClampedArray(w * h * 4);
  const cx = w / 2, cy = h / 2;
  const R = Math.min(w, h) * 0.36;
  const k = Math.min(w, h) / 320;                 // 以 320 处理尺寸为基准缩放
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      const r = Math.hypot(x - cx, y - cy);
      let on;
      if (cannedShape === 'target') {
        // 同心圆环：3 个前景连通域 + 2 个内部孔洞
        on = (r >= 94 * k && r <= 125 * k) || (r >= 29 * k && r <= 60 * k) || r <= 14 * k;
      } else {
        on = r <= R;
      }
      const v = on ? 30 : 245;
      data[p] = v; data[p + 1] = v; data[p + 2] = v; data[p + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}

const wrapEl = null; // 占位，下面创建后回填

function makeEl(id, tag) {
  const el = {
    id: id || '', tagName: (tag || 'div').toUpperCase(),
    dataset: {}, style: {}, children: [], _listeners: {},
    value: '', textContent: '', checked: false,
    max: '', min: '', selectedIndex: 0,
    clientWidth: 900, clientHeight: 620, width: 0, height: 0,
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); },
      toggle(c, force) {
        const on = force === undefined ? !this._s.has(c) : !!force;
        on ? this._s.add(c) : this._s.delete(c);
        return on;
      }
    },
    addEventListener(t, f) { (this._listeners[t] = this._listeners[t] || []).push(f); },
    removeEventListener() {},
    setPointerCapture() {}, releasePointerCapture() {},
    appendChild(c) {
      this.children.push(c);
      if (this.tagName === 'SELECT' && !this.value && c.value) this.value = c.value;
      return c;
    },
    remove() {},
    click() { fire(this, 'click', {}); },
    setAttribute() {}, getAttribute() { return null; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    getContext() { if (!this._ctx) this._ctx = makeCtx(); return this._ctx; },
    focus() {}, select() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 900, height: 620 }; }
  };
  Object.defineProperty(el, 'parentElement', { get: () => parentEl });
  // innerHTML 赋空值时要清空子节点（真实 DOM 行为），否则重复渲染会累积
  let html = '';
  Object.defineProperty(el, 'innerHTML', {
    get: () => html,
    set(v) { html = String(v); if (html === '') el.children.length = 0; }
  });
  return el;
}

function fire(el, type, ev) {
  const ls = el._listeners[type] || [];
  const e = Object.assign({
    target: el, clientX: 0, clientY: 0, deltaY: 0, deltaMode: 0,
    pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1,
    preventDefault() {}, stopPropagation() {}
  }, ev || {});
  ls.forEach(f => f.call(el, e));
  return ls.length;
}

/* 依据 index.html 里真实写死的属性初始化控件，尽量贴近浏览器行为 */
const registry = {};
const parentEl = makeEl('__parent', 'div');

function el(id, tag) {
  if (!registry[id]) registry[id] = makeEl(id, tag);
  if (tag && registry[id].tagName === 'DIV') registry[id].tagName = tag.toUpperCase();
  return registry[id];
}

for (const m of html.matchAll(/<(\w+)\b([^>]*\sid="([^"]+)"[^>]*)>/g)) {
  const [, tag, attrs, id] = m;
  const e = el(id, tag);
  const cls = /class="([^"]*)"/.exec(attrs);
  if (cls) cls[1].split(/\s+/).forEach(c => c && e.classList.add(c));
  const val = /\svalue="([^"]*)"/.exec(attrs);
  if (val) e.value = val[1];
  const max = /\smax="([^"]*)"/.exec(attrs);
  if (max) e.max = max[1];
  const min = /\smin="([^"]*)"/.exec(attrs);
  if (min) e.min = min[1];
  if (/\schecked/.test(attrs)) e.checked = true;
  const dv = /data-view="([^"]+)"/.exec(attrs);
  if (dv) e.dataset.view = dv[1];
}
// select 默认值 = 标了 selected 的 option，否则第一个 option
for (const m of html.matchAll(/<select\b[^>]*\sid="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)) {
  const opts = [...m[2].matchAll(/<option value="([^"]*)"([^>]*)>/g)];
  const sel = opts.find(o => /\sselected/.test(o[2])) || opts[0];
  if (sel) el(m[1]).value = sel[1];
}

// 顶部标签按钮没有 id，单独扫描
const tabEls = [];
for (const m of html.matchAll(/<(\w+)\b([^>]*data-view="([^"]+)"[^>]*)>/g)) {
  const [, tag, attrs, view] = m;
  const e = makeEl('tab-' + view, tag);
  e.dataset.view = view;
  const cls = /class="([^"]*)"/.exec(attrs);
  if (cls) cls[1].split(/\s+/).forEach(c => c && e.classList.add(c));
  tabEls.push(e);
}

const documentShim = {
  readyState: 'complete',
  body: makeEl('body', 'body'),
  getElementById: id => registry[id] || el(id),
  createElement: tag => makeEl('', tag),
  querySelectorAll: sel => (sel === '.tab' ? tabEls : []),
  querySelector: () => null,
  addEventListener() {},
  execCommand: () => true
};

const g = globalThis;
g.window = g;
g.document = documentShim;
g.devicePixelRatio = 1;
g.addEventListener = () => {};
g.removeEventListener = () => {};
g.requestAnimationFrame = cb => { rafQueue.push(cb); return rafQueue.length; };
g.cancelAnimationFrame = () => {};
g.URL = { createObjectURL: () => 'blob:test', revokeObjectURL() {} };
// Node 自带只读 navigator（无 clipboard），app.js 会自动走 execCommand 兜底
g.Blob = g.Blob || class { constructor(parts) { this.parts = parts; } };

function flushFrames(n) {
  for (let i = 0; i < n; i++) {
    const batch = rafQueue.splice(0, rafQueue.length);
    now += 16;
    batch.forEach(cb => cb(now));
  }
}

/* ------------------------------------------------------------------ *
 * 3. 执行三个脚本（顺序与 index.html 一致）
 * ------------------------------------------------------------------ */
section('加载脚本');

let bootError = null;
try {
  for (const f of ['assets/fourier-core.js', 'assets/examples.js', 'assets/app.js']) {
    vm.runInThisContext(read(f), { filename: f });
  }
} catch (e) {
  bootError = e;
}
check('三个脚本可正常执行（含 init）', !bootError, bootError ? bootError.stack.split('\n').slice(0, 3).join(' | ') : '');

if (bootError) { console.log('\n冒烟测试中止\n'); process.exit(1); }

/* ------------------------------------------------------------------ *
 * 4. 校验初始状态
 * ------------------------------------------------------------------ */
section('文档 → 动图');

const docText = registry.docText;
const back = g.FourierCore.parseDoc(docText.value);
check('启动时自动载入内置示例文档', docText.value.includes('"description"') && back.terms.length > 0,
  back.terms.length + ' 项 · ' + (docText.value.length / 1024).toFixed(1) + ' KB');
check('图像说明已显示', registry.descText.textContent.length > 10,
  registry.descText.textContent.slice(0, 40) + '…');
check('统计卡片已填充',
  registry.statTerms.textContent === String(back.terms.length) &&
  registry.statNRange.textContent.startsWith('[') &&
  registry.statSize.textContent.includes('×'),
  `${registry.statTerms.textContent} 项 · n∈${registry.statNRange.textContent} · ${registry.statSize.textContent} px`);
check('参数表已渲染', (registry.termTable.innerHTML.match(/<tr>/g) || []).length === 40,
  (registry.termTable.innerHTML.match(/<tr>/g) || []).length + ' 行');
check('滑块上限 = 文档项数', String(registry.limitRange.max) === String(back.terms.length),
  'max=' + registry.limitRange.max);

drawCalls.n = 0;
flushFrames(4);
check('动画循环产生绘制指令', drawCalls.n > 50, drawCalls.n + ' 次绘图调用');
check('t 随时间推进', parseFloat(registry.badgeT.textContent) > 0, 't=' + registry.badgeT.textContent);

// 改项数
registry.limitRange.value = '8';
fire(registry.limitRange, 'input', {});
flushFrames(2);
check('调低项数后重新采样并更新徽标', registry.badgeTerms.textContent === '8',
  '绘制的圆数量 = ' + registry.badgeTerms.textContent);
check('截断误差已显示', /px/.test(registry.statErr.textContent), registry.statErr.textContent);

// 播放 / 暂停
fire(registry.btnPlay, 'click', {});
check('暂停后图标切换', registry.iconPause.style.display === 'none' && registry.iconPlay.style.display === '');
registry.progress.value = '500';
fire(registry.progress, 'input', {});
flushFrames(1);
check('拖动进度条可定位到 t=0.5', Math.abs(parseFloat(registry.badgeT.textContent) - 0.5) < 1e-6,
  't=' + registry.badgeT.textContent);

// 导出 / 复制
let exportErr = null;
try { fire(registry.btnDownloadDoc, 'click', {}); fire(registry.btnCopyDoc, 'click', {}); }
catch (e) { exportErr = e; }
check('导出当前项数 / 复制 不会抛错', !exportErr, exportErr ? exportErr.message : registry.noteDoc.textContent.slice(0, 30));

// 非法文档的错误提示
registry.docText.value = '{ 坏掉的 JSON';
fire(registry.btnApplyDoc, 'click', {});
check('坏文档给出中文错误提示',
  registry.noteDoc.textContent.startsWith('✘') && registry.noteDoc.textContent.includes('JSON'),
  registry.noteDoc.textContent.split('\n')[0]);

// 简易中文文档
registry.docText.value = JSON.stringify({
  说明: '最小示例：一个圆',
  参数: [{ 频率: 0, 振幅: 200, 相位: 0 }, { 频率: 1, 振幅: 100, 相位: 90 }]
});
fire(registry.btnApplyDoc, 'click', {});
flushFrames(2);
check('中文键名文档可播放', registry.statTerms.textContent === '2' && registry.descText.textContent.includes('最小示例'),
  registry.descText.textContent);

/* ------------------------------------------------------------------ *
 * 5. 图像 → 文档
 * ------------------------------------------------------------------ */
section('图像 → 文档');

fire(tabEls.find(t => t.dataset.view === 'extract'), 'click', {});
check('切换到视图二', registry['view-extract'].classList.contains('on') && !registry['view-play'].classList.contains('on'));

fire(registry.btnSample, 'click', {});
check('内置示例图可提取轮廓并生成文档', registry.extractResult.value.includes('"terms"'),
  registry.exHint.textContent + ' · ' + registry.noteImg.textContent.slice(0, 46));
const gen = g.FourierCore.parseDoc(registry.extractResult.value);
check('生成的文档可被解析', gen.terms.length > 0 && gen.description.includes('提取轮廓'),
  gen.terms.length + ' 项');
check('生成的文档带 n=0 项（圆心）', gen.terms.some(t => t.n === 0));
check('误差统计已填充', /px/.test(registry.exDeviation.textContent) && /%/.test(registry.exCoverage.textContent),
  `覆盖率 ${registry.exCoverage.textContent} · 最大偏差 ${registry.exDeviation.textContent}`);
check('说明字段记录了提取参数',
  gen.description.includes('处理尺寸') && gen.description.includes('等弧长采样'),
  gen.description.slice(0, 60) + '…');

// 改变阈值模式 / 项数
registry.keepRange.value = '16';
fire(registry.keepRange, 'input', {});
const gen16 = g.FourierCore.parseDoc(registry.extractResult.value);
check('改变保留项数后重新生成文档', gen16.terms.length === 16, gen16.terms.length + ' 项');

registry.modeSelect.value = 'alpha';
fire(registry.modeSelect, 'change', {});
fire(registry.btnExtract, 'click', {});
check('切到 alpha 模式对不透明图给出提醒',
  registry.noteImg.textContent.includes('透明') || registry.noteImg.textContent.startsWith('✔'),
  registry.noteImg.textContent.split('\n')[0].slice(0, 44));
registry.modeSelect.value = 'dark';
fire(registry.modeSelect, 'change', {});
fire(registry.btnExtract, 'click', {});
check('切回深色模式可正常提取', registry.noteImg.textContent.startsWith('✔'),
  registry.noteImg.textContent.split('\n')[0].slice(0, 44));

// 送进动图
fire(registry.btnUseInPlay, 'click', {});
flushFrames(2);
check('生成的文档可送入动图播放',
  registry['view-play'].classList.contains('on') &&
  registry.statTerms.textContent === String(gen16.terms.length),
  registry.statTerms.textContent + ' 项');

/* ------------------------------------------------------------------ *
 * 5b. 多轮廓（含内部孔洞）
 * ------------------------------------------------------------------ */
section('多轮廓（内部孔洞）');

fire(tabEls.find(t => t.dataset.view === 'extract'), 'click', {});
registry.keepRange.value = '128';
fire(registry.keepRange, 'input', {});
cannedShape = 'target';                 // 换成同心圆环（含内部孔洞）
registry.sampleSelect.value = 'target';
fire(registry.btnSample, 'click', {});
const multi = g.FourierCore.parseDoc(registry.extractResult.value);
check('同心圆环提取出多个轮廓（外轮廓 + 内部孔洞）',
  multi.contours.length >= 4 && multi.contours.some(c => c.role === 'hole'),
  multi.contours.length + ' 个轮廓：' + multi.contours.map(c => c.role).join('/'));
check('多轮廓文档为 version 2 且带 contours 数组',
  multi.doc.version === 2 && Array.isArray(multi.doc.contours) && Array.isArray(multi.doc.contours[0].terms),
  'v' + multi.doc.version + ' · ' + registry.exHint.textContent);
check('说明中写明了轮廓数量与孔洞',
  multi.description.includes('内部孔洞') && multi.description.includes('轮廓'),
  multi.description.slice(0, 56) + '…');
check('轮廓统计已显示', /孔/.test(registry.exCount.textContent), registry.exCount.textContent);
check('小轮廓项数按面积自动减少',
  multi.contours.every(c => c.terms.length <= 128) &&
  Math.max(...multi.contours.map(c => c.terms.length)) === 128 &&
  Math.min(...multi.contours.map(c => c.terms.length)) < 128,
  '各轮廓项数 ' + multi.contours.map(c => c.terms.length).join(' / '));
check('文档记录了项数分配策略', /面积/.test(multi.meta.termCountPolicy || ''),
  (multi.meta.termCountPolicy || '').slice(0, 30) + '…');

// 只有「仅最大外轮廓」模式
registry.contourMode.value = 'largest';
fire(registry.contourMode, 'change', {});
fire(registry.btnExtract, 'click', {});
const single = g.FourierCore.parseDoc(registry.extractResult.value);
check('切到「仅最大外轮廓」后只剩一个轮廓',
  single.contours.length === 1 && single.contours[0].role === 'outer' && single.doc.version === 1,
  single.contours.length + ' 个轮廓');
registry.contourMode.value = 'all';
fire(registry.contourMode, 'change', {});
fire(registry.btnExtract, 'click', {});

// 送进动图后动画应同时绘制多条轨迹
fire(registry.btnUseInPlay, 'click', {});
flushFrames(3);
const playParsed = g.FourierCore.parseDoc(registry.docText.value);
check('动图同时绘制多个轮廓',
  registry.badgeTerms.textContent.includes('/ ' + playParsed.contours.length + ' 轮廓'),
  '徽标：' + registry.badgeTerms.textContent);
check('参数表可在轮廓之间切换',
  registry['contourPickWrap'].style.display !== 'none' &&
  registry.contourSelect.children.length === playParsed.contours.length,
  registry.contourSelect.children.length + ' 个可选项');
check('多轮廓时图例按轮廓分色',
  (registry.animLegend.innerHTML.match(/class="lg"/g) || []).length === Math.min(8, playParsed.contours.length),
  (registry.animLegend.innerHTML.match(/class="lg"/g) || []).length + ' 条图例');
const hintBefore = registry.termTableHint.textContent;
registry.contourSelect.value = '1';
fire(registry.contourSelect, 'change', {});
check('切换轮廓后参数表刷新',
  registry.termTableHint.textContent !== hintBefore &&
  registry.termTableHint.textContent.indexOf(playParsed.contours[1].name + ' · ') === 0,
  hintBefore + '  →  ' + registry.termTableHint.textContent);
check('多轮廓导出仍为合法文档', (() => {
  try { fire(registry.btnDownloadDoc, 'click', {}); return true; } catch (e) { return false; }
})(), registry.noteDoc.textContent.slice(0, 40));

/* ------------------------------------------------------------------ *
 * 5c. 画布滚轮缩放 / 拖动平移
 * ------------------------------------------------------------------ */
section('滚轮缩放与平移');

const canvas = registry.animCanvas;
const zoomVal = () => parseFloat(registry.zoomOut.textContent);
const sliderVal = () => Number(registry.zoomRange.value);

check('初始为适配视图 1.00×', Math.abs(zoomVal() - 1) < 1e-6, registry.zoomOut.textContent);

fire(canvas, 'wheel', { deltaY: -240, clientX: 450, clientY: 310 });
const zIn = zoomVal();
check('向上滚动放大', zIn > 1.15, '1.00× → ' + registry.zoomOut.textContent);
check('放大后滑块同步', sliderVal() > 55, '滑块 ' + sliderVal());
check('画布徽标同步显示缩放', registry.badgeZoom.textContent === registry.zoomOut.textContent,
  registry.badgeZoom.textContent);

fire(canvas, 'wheel', { deltaY: 240, clientX: 450, clientY: 310 });
check('向下滚动缩小', zoomVal() < zIn && Math.abs(zoomVal() - 1) < 0.05, registry.zoomOut.textContent);

// 以光标为锚点：光标下的那个图形点必须保持不动
// 关掉网格后，每帧的第一个 moveTo 就是原点十字的左端，于是原点屏幕坐标 = (m[0]+5, m[1])
{
  const ctx = canvas.getContext('2d');
  registry.chkGrid.checked = false;
  fire(registry.chkGrid, 'change', {});
  const originScreen = () => {
    ctx._capture = true; ctx._firstMove = null;
    flushFrames(1);
    ctx._capture = false;
    return { x: ctx._firstMove[0] + 5, y: ctx._firstMove[1] };
  };

  registry.btnFit.click();
  const p0 = originScreen();
  check('原点屏幕位置已取得（用于锚点自检）',
    isFinite(p0.x) && p0.x > 0 && p0.x < canvas.clientWidth,
    `(${p0.x.toFixed(2)}, ${p0.y.toFixed(2)})`);

  fire(canvas, 'wheel', { deltaY: -300, clientX: p0.x, clientY: p0.y });
  const z1 = zoomVal();
  const p1 = originScreen();
  check('滚轮放大生效', z1 > 1.15, '1.00× → ' + z1.toFixed(3) + '×');
  check('以光标为锚点：光标下的图形点保持不动',
    Math.abs(p1.x - p0.x) < 0.5 && Math.abs(p1.y - p0.y) < 0.5,
    `原点 (${p0.x.toFixed(2)}, ${p0.y.toFixed(2)}) → (${p1.x.toFixed(2)}, ${p1.y.toFixed(2)})`);

  // 换一个缩放档位，再验证一次锚点不漂移
  registry.zoomRange.value = '72';
  fire(registry.zoomRange, 'input', {});
  const p2 = originScreen();
  fire(canvas, 'wheel', { deltaY: -300, clientX: p2.x, clientY: p2.y });
  const p3 = originScreen();
  check('换缩放档位后锚点依然不漂移',
    Math.abs(p3.x - p2.x) < 0.5 && Math.abs(p3.y - p2.y) < 0.5,
    `${zoomVal().toFixed(2)}× 下原点 (${p2.x.toFixed(2)}, ${p2.y.toFixed(2)}) → (${p3.x.toFixed(2)}, ${p3.y.toFixed(2)})`);

  // 缩放中心不在画布中心时，应产生平移
  fire(canvas, 'wheel', { deltaY: -300, clientX: 20, clientY: 20 });
  const p4 = originScreen();
  check('锚点偏离画布中心时会同步平移画布',
    Math.abs(p4.x - p3.x) > 1 || Math.abs(p4.y - p3.y) > 1,
    `原点 (${p3.x.toFixed(2)}, ${p3.y.toFixed(2)}) → (${p4.x.toFixed(2)}, ${p4.y.toFixed(2)})`);

  registry.chkGrid.checked = true;
  fire(registry.chkGrid, 'change', {});
}

// 缩放上限
for (let i = 0; i < 40; i++) fire(canvas, 'wheel', { deltaY: -240, clientX: 450, clientY: 310 });
check('缩放到上限后被夹住', zoomVal() <= 12.0001 && zoomVal() >= 11.9, registry.zoomOut.textContent);
for (let i = 0; i < 80; i++) fire(canvas, 'wheel', { deltaY: 240, clientX: 450, clientY: 310 });
check('缩小到下限后被夹住', zoomVal() <= 0.0501 && zoomVal() >= 0.049, registry.zoomOut.textContent);

// 拖拽平移
fire(canvas, 'pointerdown', { clientX: 400, clientY: 300 });
fire(canvas, 'pointermove', { clientX: 470, clientY: 340 });
const dragging = canvas.classList.contains('dragging');
fire(canvas, 'pointerup', { clientX: 470, clientY: 340 });
check('按住拖动进入拖拽态并结束拖拽', dragging && !canvas.classList.contains('dragging'));

// 复位
registry.btnFit.click();
check('复位按钮恢复 1.00×', Math.abs(zoomVal() - 1) < 1e-9 && sliderVal() >= 54 && sliderVal() <= 56,
  registry.zoomOut.textContent + ' · 滑块 ' + sliderVal());
fire(canvas, 'wheel', { deltaY: -240, clientX: 300, clientY: 300 });
fire(canvas, 'dblclick', {});
check('双击画布复位视图', Math.abs(zoomVal() - 1) < 1e-9, registry.zoomOut.textContent);

// 滑块缩放
registry.zoomRange.value = '100';
fire(registry.zoomRange, 'input', {});
check('滑块可直接拉到最大缩放', Math.abs(zoomVal() - 12) < 0.001 && sliderVal() === 100, registry.zoomOut.textContent);
registry.zoomRange.value = '0';
fire(registry.zoomRange, 'input', {});
check('滑块可拉到最小缩放', Math.abs(zoomVal() - 0.05) < 0.001, registry.zoomOut.textContent);
registry.zoomRange.value = '55';
fire(registry.zoomRange, 'input', {});
check('滑块回到中位约等于 1×', Math.abs(zoomVal() - 1) < 0.05, registry.zoomOut.textContent);

// 换文档后自动复位
fire(registry.btnApplyDoc, 'click', {});
check('更换文档后视图自动复位', Math.abs(zoomVal() - 1) < 1e-9, registry.zoomOut.textContent);

/* ------------------------------------------------------------------ *
 * 6. 图表/视图切换回归
 * ------------------------------------------------------------------ */
section('其他');

fire(tabEls.find(t => t.dataset.view === 'format'), 'click', {});
check('视图三可切换', registry['view-format'].classList.contains('on'));

// 文档格式页中的示例代码块都应为合法思路（这里只检查关键约定是否写明）
check('格式页写明了数学约定与字段表',
  html.includes('amp · e^{ i·(2π·n·t + phase) }') && html.includes('terms[].n'));

console.log(`\n${failures === 0 ? '界面冒烟测试全部通过 ✓' : failures + ' 项失败 ✗'}\n`);
process.exit(failures === 0 ? 0 : 1);
