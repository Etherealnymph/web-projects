/* 无头测试器：在 Node 里跑 seawar.html 的内联脚本（Canvas/DOM 全部打桩）
   用法: node harness.js <游戏html> "<query>"                     —— 跑文件自带 autotest
        node harness.js <游戏html> "<query>" <probe.js>           —— 追加探针脚本后运行
   探针可用全局: __fire(元素id, 事件名, 事件对象) / __els（元素桩） */
const fs = require('fs'), vm = require('vm');
const file = process.argv[2] || 'D:/Project/html/seawar.html';
const query = process.argv[3] || 'autotest=1&steps=10800&seed=12345&diff=1';
const probeFile = process.argv[4] || null;
const html = fs.readFileSync(file, 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.log('NO_SCRIPT'); process.exit(1); }
const code = m[1] + (probeFile ? '\n' + fs.readFileSync(probeFile, 'utf8') : '');

const LISTENERS = {};   // id -> {type: [fn]}
function on(id, type, fn) {
  const byId = LISTENERS[id] || (LISTENERS[id] = {});
  (byId[type] || (byId[type] = [])).push(fn);
}
function fire(id, type, ev) {
  const byId = LISTENERS[id];
  if (!byId || !byId[type]) return 0;
  const e = Object.assign({ preventDefault() {}, stopPropagation() {}, button: 0, shiftKey: false, deltaY: 0, key: '', clientX: 0, clientY: 0, touches: [] }, ev || {});
  for (const fn of byId[type]) fn(e);
  return byId[type].length;
}

function makeCtx() {
  const store = {};
  return new Proxy(store, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (k === 'measureText') return () => ({ width: 8 });
      if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (k === 'canvas') return { width: 1280, height: 800 };
      return function () {};
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}
const CTX = makeCtx();
function El(id) {
  const e = { id, style: {}, dataset: {}, children: [], textContent: '', value: '', _html: '', width: 1280, height: 800, parentNode: null, onclick: null };
  e.classList = { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
    toggle(c, f) { if (f === undefined) f = !this._s.has(c); f ? this._s.add(c) : this._s.delete(c); return f; },
    contains(c) { return this._s.has(c); } };
  e.getContext = () => CTX;
  e.appendChild = c => { e.children.push(c); c.parentNode = e; return c; };
  e.removeChild = c => { const i = e.children.indexOf(c); if (i >= 0) e.children.splice(i, 1); return c; };
  e.addEventListener = (type, fn) => on(id, type, fn);
  e.removeEventListener = () => {};
  e.querySelectorAll = () => []; e.setAttribute = () => {};
  Object.defineProperty(e, 'innerHTML', { get() { return e._html; }, set(v) { e._html = v; e.children = []; } });
  Object.defineProperty(e, 'firstChild', { get() { return e.children[0]; } });
  return e;
}
const reg = {};
const document = { getElementById: id => reg[id] || (reg[id] = El(id)), createElement: t => El('_' + t + '_' + Math.random().toString(36).slice(2, 7)),
  addEventListener: (type, fn) => on('document', type, fn), title: '', body: El('body'), querySelectorAll: () => [] };
const logs = [];
const sandbox = {
  document,
  console: { log: (...a) => logs.push(a.map(String).join(' ')), error: (...a) => logs.push('ERR ' + a.map(String).join(' ')), warn: () => {} },
  location: { search: '?' + query, hash: '', pathname: '/seawar.html', href: 'file:///D:/Project/html/seawar.html' },
  requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
  performance: { now: () => Number(process.hrtime.bigint() / 1000n) / 1000 },
  setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  URLSearchParams, TextEncoder,
  __fire: fire, __listeners: LISTENERS, __els: reg
};
sandbox.window = sandbox;
sandbox.innerWidth = 1280; sandbox.innerHeight = 800; sandbox.devicePixelRatio = 1;
sandbox.addEventListener = (type, fn) => on('window', type, fn);
sandbox.removeEventListener = () => {};
vm.createContext(sandbox);
try { vm.runInContext(code, sandbox, { filename: 'seawar-inline.js' }); }
catch (e) { console.log('THROW ' + e.stack); process.exit(2); }
console.log(logs.join('\n'));
