/* SEAWAR 无头测试台：在 Node 里用桩 DOM 跑游戏逻辑，验证地图生成/战斗/胜负/渲染路径。
   用法： node run.mjs [steps] [seed]   */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(here, '..', 'seawar.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('FAIL: 未找到 <script> 块'); process.exit(2); }
const code = m[1];

/* ---------------- 桩 ---------------- */
const noop = () => {};
function makeCtx() {
  const grad = { addColorStop: noop };
  const target = {
    canvas: { width: 1280, height: 800 },
    createRadialGradient: () => grad,
    createLinearGradient: () => grad,
    createPattern: () => null,
    measureText: () => ({ width: 10 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
    putImageData: noop, resetTransform: noop, setTransform: noop,
  };
  return new Proxy(target, {
    get(t, p) {
      if (typeof p === 'symbol') return undefined;
      if (p in t) return t[p];
      return noop;                     // 其它 Canvas API 一律空实现
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}
function makeEl(tag) {
  const el = {
    id: tag, tagName: String(tag).toUpperCase(),
    style: {}, dataset: {}, children: [],
    textContent: '', innerHTML: '', value: '', onclick: null,
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    addEventListener: noop, removeEventListener: noop,
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
    querySelectorAll: () => [], querySelector: () => null,
    setAttribute: noop, focus: noop, blur: noop,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 800 }),
  };
  Object.defineProperty(el, 'firstChild', { get() { return this.children[0] || null; } });
  if (tag === 'canvas' || tag === 'game' || tag === 'cvFog' || tag === 'cvUI') {
    el.width = 1280; el.height = 800; el.getContext = () => (el._ctx ||= makeCtx());
  }
  return el;
}
const els = new Map();
const documentStub = {
  title: '',
  body: makeEl('body'), documentElement: makeEl('html'),
  getElementById(id) { if (!els.has(id)) els.set(id, makeEl(id)); return els.get(id); },
  createElement(tag) { return makeEl(tag); },
  addEventListener: noop, removeEventListener: noop,
};
const windowStub = {
  innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
  addEventListener: noop, removeEventListener: noop, requestAnimationFrame: () => 0,
  AudioContext: undefined, webkitAudioContext: undefined,
};

const steps = process.argv[2] || '9000';
const seed = process.argv[3] || '20240607';
const search = `?autotest=1&steps=${steps}&seed=${seed}&diff=1`;

const logs = [];
const sandbox = {
  console: {
    log: (...a) => logs.push(a.map(String).join(' ')),
    warn: (...a) => logs.push('WARN ' + a.map(String).join(' ')),
    error: (...a) => logs.push('ERR ' + a.map(String).join(' ')),
  },
  document: documentStub, window: windowStub,
  location: { search, href: 'file:///seawar.html', hash: '' },
  navigator: { userAgent: 'node-test' },
  performance: { now: () => Number(process.hrtime.bigint() / 1000000n) },
  requestAnimationFrame: () => 0, cancelAnimationFrame: noop,
  setTimeout: () => 0, clearTimeout: noop, setInterval: () => 0, clearInterval: noop,
  URLSearchParams, alert: noop,
};
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);

const t0 = process.hrtime.bigint();
let threw = null;
try {
  vm.runInContext(code, sandbox, { filename: 'seawar.html<script>', timeout: 120000 });
} catch (e) { threw = e; }
const wall = Number(process.hrtime.bigint() - t0) / 1e6;

if (threw) {
  console.error('FAIL 运行期异常:', threw && threw.stack ? threw.stack.split('\n').slice(0, 6).join('\n') : threw);
  process.exit(1);
}

const line = logs.find(l => l.startsWith('SEAWAR_AUTOTEST '));
if (!line) {
  console.error('FAIL 未产生 SEAWAR_AUTOTEST 结果。日志:'); logs.forEach(l => console.error('  ' + l));
  process.exit(1);
}
const res = JSON.parse(line.slice('SEAWAR_AUTOTEST '.length));
console.log('===== SEAWAR 无头测试 =====');
console.log(JSON.stringify(res, null, 2));
console.log('脚本执行总耗时(含 ' + steps + ' tick 模拟): ' + wall.toFixed(0) + ' ms');
console.log(res.ok ? '结果: PASS' : '结果: FAIL');

/* 额外断言 */
const problems = [];
if (!res.connected) problems.push('地图不连通');
if (res.badValues) problems.push('存在 NaN/Infinity 状态: ' + res.badValues);
if (!res.renderOk) problems.push('渲染路径抛错: ' + res.renderErr);
if (res.edges < res.nodes - 1) problems.push('海路数量不足');
if (res.maxShips === 0) problems.push('从未生成舰船');
if (res.battles === 0) problems.push('AI 之间从未交战');
if (Object.keys(res.owners).length < 2) problems.push('所有岛屿被单一方占领，扩张异常');
if (problems.length) { console.error('断言失败:\n - ' + problems.join('\n - ')); process.exit(1); }
process.exit(0);
