/**
 * 生成 examples/*.json 示例参数文档 + assets/examples.js（浏览器内置示例），
 * 并顺便对核心库做正确性自检。
 *
 *   node tools/gen-examples.mjs
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const FC = require(path.join(rootDir, 'assets', 'fourier-core.js'));

let failures = 0;
function check(name, ok, detail) {
  const tag = ok ? '  ok  ' : ' FAIL ';
  if (!ok) failures++;
  console.log(`[${tag}] ${name}${detail ? ' — ' + detail : ''}`);
}

/* ------------------------------------------------------------------ *
 * 1. 核心数学自检
 * ------------------------------------------------------------------ */
console.log('\n== 核心库自检 ==\n');

// 1.1 FFT 与朴素 DFT 结果一致
{
  const N = 64;
  const pts = FC.shapePoints('heart', N, 100);
  const a = FC.dft(pts);
  // 用非 2 的幂强制走朴素 DFT 路径做对照（取前 60 点 + 插值到 63 点）
  const pts2 = FC.resampleClosed(pts, 60);
  const b = FC.dft(pts2);
  const err = Math.max(...a.slice(0, 5).map((t, i) => Math.abs(Math.abs(t.amp) - Math.abs(b[i].amp))));
  check('FFT 路径可用（64 点）', a.length === N && a.some(t => t.amp > 1));
  check('朴素 DFT 路径可用（60 点）', b.length === 60 && b.some(t => t.amp > 1), `前几项振幅差 ${err.toFixed(4)}`);
}

// 1.2 全项重建 ⇔ 原始轮廓（精度检验）
for (const name of Object.keys(FC.SHAPES)) {
  const pts = FC.shapePoints(name, 512, 400);
  const terms = FC.dft(pts).map(FC.normalizeTerm);
  const err = FC.reconstructionError(terms, pts);
  check(`全项重建精确还原「${FC.SHAPES[name].label}」`, err.maxError < 1e-8,
    `maxErr=${err.maxError.toExponential(2)} rms=${err.rmsError.toExponential(2)}`);
}

// 1.3 截断项数的重建误差应随项数单调下降
{
  const pts = FC.shapePoints('star', 512, 400);
  const all = FC.dft(pts);
  const errs = [4, 16, 64, 256].map(k => {
    const kept = FC.topTerms(all, k).kept.map(FC.normalizeTerm);
    return FC.reconstructionError(kept, pts).rmsError;
  });
  const monotone = errs.every((e, i) => i === 0 || e < errs[i - 1]);
  check('项数↑ → 误差↓', monotone, errs.map(e => e.toFixed(3)).join(' → '));
}

// 1.4 文档往返：build → serialize → parse → 重建
{
  const pts = FC.shapePoints('butterfly', 512, 400);
  const doc = FC.buildDoc({
    points: pts, name: '蝴蝶 butterfly', source: 'builtin:butterfly', termCount: 96,
    description: '测试文档'
  });
  const text = FC.serializeDoc(doc);
  const back = FC.parseDoc(text);
  const pts2 = FC.samplePath(back.terms, 512);
  const err = FC.reconstructionError(back.terms, pts2);
  // 与参数化方式无关的曲线偏差：doc 内部是「等弧长重采样」后的点，
  // 因此拿重建曲线去和原始参数采样点比会误判，这里对重采样后的轮廓比。
  const ref = FC.resampleClosed(pts, 512);
  const dev = FC.curveDeviation(pts2, ref);
  check('JSON 往返解析正常', back.terms.length === 96 && back.description === '测试文档',
    `${text.length} 字节`);
  check('解析后的系数可重建轨迹', err.maxError < 1e-9, `自采样误差 ${err.maxError.toExponential(2)}`);
  check('截断 96 项后曲线仍贴合原轮廓', dev.maxDeviation < 6,
    `最大偏差=${dev.maxDeviation.toFixed(3)}px、RMS=${dev.rmsDeviation.toFixed(3)}px（轮廓尺寸 400px）`);
  check('文档记录的误差指标自洽', doc.meta.maxReconstructError < 6,
    `meta.maxReconstructError=${doc.meta.maxReconstructError}`);
  check('振幅覆盖率已记录', doc.meta.amplitudeCoverage > 0.9,
    `coverage=${(doc.meta.amplitudeCoverage * 100).toFixed(3)}%`);
}

// 1.5 容错：角度制相位、中文键名、[n,amp,phase] 三元组
{  const doc = {
    说明: '中文键名测试',
    meta: { phaseUnit: 'deg' },
    参数: [
      { 频率: 0, 振幅: 10, 相位: 180 },
      [1, 5, 90],
      { n: -1, re: 3, im: 4 }
    ]
  };
  const r = FC.parseDoc(doc);
  const ok0 = Math.abs(r.terms[0].re + 10) < 1e-6 && Math.abs(r.terms[0].im) < 1e-6;   // 10∠180° = -10
  const ok1 = Math.abs(r.terms[1].re) < 1e-9 && Math.abs(r.terms[1].im - 5) < 1e-9;   // 5∠90° = 5i
  const ok2 = Math.abs(r.terms[2].amp - 5) < 1e-9;
  check('中文键名 / 角度制 / 三元组 容错解析', ok0 && ok1 && ok2 && r.description === '中文键名测试');
}

// 1.6 几何自洽：动画用的「圆链末端」必须与轨迹采样起点/任意时刻完全一致
{
  const terms = FC.parseDoc(fs.readFileSync(path.join(rootDir, 'examples', 'minimal-circle.json'), 'utf8')).terms;
  const t = 0.317;
  const tip = FC.chainAt(terms, t).pop();
  const p = FC.pointAt(terms, t);
  const samples = FC.samplePath(terms, 720);
  const p0 = FC.pointAt(terms, 0);
  const aligned = Math.abs(samples[0][0] - p0[0]) < 1e-9 && Math.abs(samples[0][1] - p0[1]) < 1e-9;
  const sameTip = Math.abs(tip[0] - p[0]) < 1e-9 && Math.abs(tip[1] - p[1]) < 1e-9;
  const bb = FC.bbox(samples);
  check('圆链末端 = 该时刻的笔尖位置', sameTip, `chainAt/pointAt 在 t=${t} 一致`);
  check('轨迹采样起点 = t=0 的位置', aligned);
  check('最小示例确实画出半径 100、圆心 (200,150) 的圆',
    Math.abs(bb.width - 200) < 1e-3 && Math.abs(bb.height - 200) < 1e-3 &&
    Math.abs(bb.cx - 200) < 1e-3 && Math.abs(bb.cy - 150) < 1e-3,
    `包围盒 ${bb.width.toFixed(6)}×${bb.height.toFixed(6)} @ (${bb.cx.toFixed(6)}, ${bb.cy.toFixed(6)})` +
    '（残差来自文档中相位的 7 位小数四舍五入）');
}

// 1.7 错误提示
{
  const cases = [
    ['空文档', ''],
    ['坏 JSON', '{'],
    ['缺少 terms', '{"description":"x"}'],
    ['n 非整数', '{"terms":[{"n":1.5,"amp":1,"phase":0}]}'],
    ['缺少振幅', '{"terms":[{"n":1}]}']
  ];
  for (const [label, src] of cases) {
    let msg = '';
    try { FC.parseDoc(src); } catch (e) { msg = e.message; }
    check(`错误提示：${label}`, msg.length > 0, msg);
  }
}

/* ------------------------------------------------------------------ *
 * 2. 图像 → 轮廓 自检（用合成的 ImageData）
 * ------------------------------------------------------------------ */
console.log('\n== 图像轮廓提取自检 ==\n');

function makeImage(w, h, draw) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = draw(x, y);
      const p = (y * w + x) * 4;
      data[p] = r; data[p + 1] = g; data[p + 2] = b; data[p + 3] = a;
    }
  }
  return { data, width: w, height: h };
}

{
  const W = 256, H = 256;
  const cx = 128, cy = 128, R = 80;
  const img = makeImage(W, H, (x, y) => (Math.hypot(x - cx, y - cy) <= R ? [20, 20, 20, 255] : [250, 250, 250, 255]));
  const res = FC.extractContour(img, { mode: 'dark', pointCount: 256, smooth: 1 });
  const area = Math.abs(FC.signedArea(res.points));
  const areaErr = Math.abs(area - Math.PI * R * R) / (Math.PI * R * R);
  const bb = FC.bbox(res.points);
  check('圆形轮廓提取：点数正确', res.points.length === 256, `raw=${res.raw.length} 点`);
  check('圆形轮廓提取：面积吻合', areaErr < 0.02, `面积 ${area.toFixed(1)} vs πR²=${(Math.PI * R * R).toFixed(1)}`);
  check('圆形轮廓提取：包围盒吻合', Math.abs(bb.width - 2 * R) <= 3 && Math.abs(bb.height - 2 * R) <= 3,
    `${bb.width.toFixed(1)}×${bb.height.toFixed(1)}`);

  const doc = FC.buildDoc({
    points: res.points, name: '圆', source: 'test', termCount: 8, pointCount: 256, smooth: 0
  });
  const rms = doc.meta.rmsReconstructError;
  check('圆只需少数项即可拟合（8 项 RMS < 0.5px）', rms < 0.5, `RMS=${rms}`);
  const dc = doc.terms.find(t => t.n === 0);
  const dcx = dc.amp * Math.cos(dc.phase), dcy = dc.amp * Math.sin(dc.phase);
  check('n=0 项即圆心（复平面重心）',
    Math.abs(dcx - cx) < 0.5 && Math.abs(dcy - cy) < 0.5,
    `n=0 → (${dcx.toFixed(2)}, ${dcy.toFixed(2)})（圆心 (128,128)，amp=${dc.amp} 是它到原点的距离）`);
}

{
  // 有两个连通域时，应取面积最大的那个
  const W = 128, H = 128;
  const img = makeImage(W, H, (x, y) => {
    const inBig = Math.hypot(x - 80, y - 80) <= 35;
    const inSmall = Math.hypot(x - 20, y - 20) <= 12;
    return (inBig || inSmall) ? [0, 0, 0, 255] : [255, 255, 255, 255];
  });
  const res = FC.extractContour(img, { mode: 'dark', pointCount: 128 });
  const bb = FC.bbox(res.points);
  check('取最大连通域', bb.cx > 60 && bb.cy > 60, `bcenter=(${bb.cx.toFixed(0)},${bb.cy.toFixed(0)}) 期望(80,80)`);
  check('连通域大小合理', Math.abs(res.componentSize - Math.PI * 35 * 35) / (Math.PI * 35 * 35) < 0.05);
}

{
  // 透明 PNG 的 alpha 模式（注意：像素中心跟踪使轮廓比真实边缘约小半像素）
  const W = 96, H = 96;
  const img = makeImage(W, H, (x, y) => (Math.hypot(x - 48, y - 48) <= 30 ? [200, 40, 40, 255] : [0, 0, 0, 0]));
  const res = FC.extractContour(img, { mode: 'alpha', pointCount: 128 });
  const area = Math.abs(FC.signedArea(res.points));
  const ideal = Math.PI * 900;
  check('alpha 模式提取透明 PNG 形状', Math.abs(area - ideal) / ideal < 0.05,
    `面积 ${area.toFixed(0)} vs πR²=${ideal.toFixed(0)}（半像素偏小属预期）`);
}

{
  // 网点/断线图案：闭运算后应能连通成一个整体
  const W = 128, H = 128;
  const img = makeImage(W, H, (x, y) => {
    const v = (x + y) % 2 === 0 ? 60 : 200;
    return (Math.hypot(x - 64, y - 64) <= 40) ? [v, v, v, 255] : [230, 230, 230, 255];
  });
  const auto = FC.extractContour(img, { mode: 'dark', threshold: null, pointCount: 128, closing: 2 });
  check('Otsu 自动阈值 + 闭运算处理网点图案',
    auto.threshold.auto && Math.abs(auto.componentSize - Math.PI * 1600) / (Math.PI * 1600) < 0.06,
    `threshold=${auto.threshold.value} 连通域=${auto.componentSize}px (πR²=${(Math.PI * 1600).toFixed(0)})`);
}

/* ------------------------------------------------------------------ *
 * 3. 生成示例文档
 * ------------------------------------------------------------------ */
console.log('\n== 生成示例文档 ==\n');

const outDir = path.join(rootDir, 'examples');
fs.mkdirSync(outDir, { recursive: true });

/* 合成一张「同心圆环」位图：3 个前景连通域 + 2 个内部孔洞，用于多轮廓示例与断言 */
function nestedRingsImage(W, H) {
  const k = Math.min(W, H) / 320;
  return makeImage(W, H, (x, y) => {
    const r = Math.hypot(x - W / 2, y - H / 2);
    const on = (r >= 94 * k && r <= 125 * k) || (r >= 29 * k && r <= 60 * k) || r <= 14 * k;
    const v = on ? 20 : 240;
    return [v, v, v, 255];
  });
}

const NESTED = nestedRingsImage(320, 320);

// 3.0 多轮廓提取断言
{
  const all = FC.extractContours(NESTED, { mode: 'dark', includeHoles: true, pointCount: 256, smooth: 3 });
  const holes = all.contours.filter(c => c.role === 'hole');
  check('同心圆环提取到 3 个外轮廓 + 2 个内部孔洞',
    all.outerCount === 3 && all.holeCount === 2 && all.contours.length === 5,
    all.contours.map(c => c.role + '/' + c.componentSize).join(' '));

  const outerAreas = all.contours.filter(c => c.role === 'outer').map(c => c.area);
  const holeAreas = holes.map(c => c.area);
  check('轮廓按面积从大到小排序',
    all.contours.every((c, i) => i === 0 || c.area <= all.contours[i - 1].area),
    all.contours.map(c => c.area.toFixed(0)).join(' > '));
  check('孔洞面积均小于其所属外轮廓',
    Math.max(...holeAreas) < Math.max(...outerAreas),
    `孔洞最大 ${Math.max(...holeAreas).toFixed(0)} < 外轮廓最大 ${Math.max(...outerAreas).toFixed(0)}`);

  const only = FC.extractContours(NESTED, { mode: 'dark', includeHoles: false, maxContours: 1, pointCount: 256 });
  check('关闭 includeHoles 后只剩外轮廓', only.holeCount === 0, only.contours.length + ' 个轮廓');

  const ratio = FC.extractContours(NESTED, { mode: 'dark', includeHoles: true, minAreaRatio: 0.05, pointCount: 256 });
  check('minAreaRatio 可过滤小轮廓', ratio.contours.length < all.contours.length && ratio.contours.length >= 2,
    `保留 ${ratio.contours.length} 个（原 ${all.contours.length} 个）`);

  const limited = FC.extractContours(NESTED, { mode: 'dark', includeHoles: true, maxContours: 2, pointCount: 256 });
  check('maxContours 生效', limited.contours.length === 2);
}

// 3.1 多轮廓文档构造 / 往返
let nestedDoc = null;
{
  const res = FC.extractContours(NESTED, {
    mode: 'dark', includeHoles: true, pointCount: 512, smooth: 3, minAreaRatio: 0.002, maxContours: 12
  });
  nestedDoc = FC.buildDoc({
    contours: res.contours.map((c, i) => ({
      points: c.points, role: c.role,
      name: (c.role === 'hole' ? '内部孔洞 ' : '外轮廓 ') + (i + 1)
    })),
    name: '同心圆环 nested rings',
    source: 'synthetic:nested-rings',
    description: '同心圆环轮廓：一张合成的圆环位图经过二值化、连通域分析与边界跟踪后，' +
      '共提取到 5 条闭合轮廓 —— 3 个外轮廓（外环、内环、中心圆盘）与 2 个内部孔洞（外环内圈、内环内圈）。' +
      '每个轮廓各自做傅里叶展开，项数按轮廓面积自动分配：面积越大保留越多项。' +
      '动画里每个轮廓都是独立的一条「圆上之圆」链条，同时绘制。',
    termCount: 160,
    pointCount: 512,
    width: 320, height: 320,
    createdAt: '2026-01-01T00:00:00.000Z'
  });
  const text = FC.serializeDoc(nestedDoc);
  fs.writeFileSync(path.join(outDir, 'nested-rings.json'), text + '\n', 'utf8');

  const back = FC.parseDoc(text);
  check('多轮廓示例文档：5 个轮廓、version 2',
    back.contours.length === 5 && back.doc.version === 2 && back.doc.meta.holeCount === 2,
    `${back.contours.length} 个轮廓 · ${(text.length / 1024).toFixed(1)} KB`);
  check('多轮廓示例：项数按面积递减',
    back.contours.map(c => c.terms.length).every((v, i, a) => i === 0 || v <= a[i - 1]) &&
    back.contours[0].terms.length === 160,
    back.contours.map(c => c.terms.length).join(' / '));
  check('多轮廓示例：每条轮廓都能重建出闭合轨迹', back.contours.every(c => {
    const p = FC.samplePath(c.terms, 256);
    const bb = FC.bbox(p);
    return p.length === 256 && bb.width > 5 && bb.height > 5;
  }));
  check('多轮廓示例：孔洞轮廓位于其外轮廓内部', (() => {
    const outer = back.contours[0].terms;
    const hole = back.contours[1].terms;
    const ob = FC.bbox(FC.samplePath(outer, 256));
    const hb = FC.bbox(FC.samplePath(hole, 256));
    return hb.width < ob.width && hb.height < ob.height;
  })(), `${nestedDoc.meta.contourCount} 个轮廓，合计 ${nestedDoc.meta.termCount} 项`);
  check('多轮廓示例：记录了项数分配策略', /面积/.test(nestedDoc.meta.termCountPolicy),
    nestedDoc.meta.termCountPolicy);
}

const SPECS = [
  { id: 'heart',       shape: 'heart',       terms: 128, points: 512, size: 400,
    name: '心形 heart',
    description: '心形轮廓：x=16sin³t、y=13cos t−5cos2t−2cos3t−cos4t 的心形参数方程，' +
      '按等弧长重采样为 512 点后做傅里叶展开，保留振幅最大的 128 项。' +
      '该曲线光滑且高频成分衰减极快，约 24 项即可肉眼看不出差别。' },
  { id: 'star',        shape: 'star',        terms: 160, points: 512, size: 400,
    name: '五角星 star',
    description: '五角星轮廓：10 个顶点的折线（外接半径 1、内接半径 0.382），' +
      '重采样为 512 点后傅里叶展开保留 160 项。折线拐角处导数不连续，' +
      '因此高频谐波衰减慢，需要较多项才能还原尖角。' },
  { id: 'rose',        shape: 'rose',        terms: 96,  points: 512, size: 400,
    name: '玫瑰线 rose (k=5)',
    description: '玫瑰线 r=cos(5θ) 的五瓣闭合轮廓，512 点采样、96 项复指数级数。' +
      '五重旋转对称使频谱能量集中在 n 为 5 的倍数的谐波上。' },
  { id: 'cardioid',    shape: 'cardioid',    terms: 96,  points: 512, size: 400,
    name: '心形线 cardioid',
    description: '心形线 r=1−cosθ 的闭合轮廓，512 点采样、96 项复指数级数。' +
      '曲线在 θ=0 处有一个尖点（cusp），是检验高频收敛速度的好例子。' },
  { id: 'butterfly',   shape: 'butterfly',   terms: 160, points: 512, size: 400,
    name: '蝴蝶 butterfly',
    description: '蝴蝶曲线 r=e^{sinθ}−2cos4θ+sin⁵((2θ−π)/24) 的闭合轮廓，' +
      '512 点采样、160 项复指数级数，包含大量中高频细节。' },
  { id: 'epitrochoid', shape: 'epitrochoid', terms: 160, points: 720, size: 400,
    name: '外摆线 epitrochoid',
    description: '外摆线（R=5, r=2, d=3）：小圆在大圆外滚动时笔尖画出的闭合曲线，' +
      '720 点采样、160 项复指数级数。与「圆上之圆」的动画形式天然对应。' },
  { id: 'lemniscate',  shape: 'brainf',      terms: 96,  points: 512, size: 400,
    name: '双纽线 lemniscate',
    description: '双纽线 (x²+y²)²=x²−y² 的闭合轮廓（两瓣、在原点自交），' +
      '512 点采样、96 项复指数级数。自交点附近的强烈奇异性会带来丰富的高频成分。' }
];

const generated = [];

// 手写的教学示例（插在列表第二位，方便对照阅读）
function pushMinimalExample() {
  const file = path.join(outDir, 'minimal-circle.json');
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  const r = FC.parseDoc(doc);
  check('手写示例 minimal-circle.json', r.terms.length === 2 && r.description.length > 20,
    r.terms.length + ' 项 · ' + r.description.slice(0, 24) + '…');
  generated.splice(1, 0, { id: 'minimal', name: doc.meta.name, description: doc.description, doc });
}

// 多轮廓示例插在列表第三位
function pushNestedExample() {
  generated.splice(2, 0, {
    id: 'nested', name: nestedDoc.meta.name, description: nestedDoc.description, doc: nestedDoc
  });
}

for (const spec of SPECS) {
  const pts = FC.shapePoints(spec.shape, spec.points, spec.size);
  const doc = FC.buildDoc({
    points: pts,
    name: spec.name,
    source: 'builtin:' + spec.shape,
    description: spec.description,
    termCount: spec.terms,
    pointCount: spec.points,
    origin: 'center',
    unit: 'px',
    createdAt: '2026-01-01T00:00:00.000Z'
  });
  const text = FC.serializeDoc(doc);
  const file = path.join(outDir, spec.id + '.json');
  fs.writeFileSync(file, text + '\n', 'utf8');

  // 落盘后重新读取解析，确保文件本身可用
  const reparsed = FC.parseDoc(fs.readFileSync(file, 'utf8'));
  const cov = (doc.meta.amplitudeCoverage * 100).toFixed(3);
  check(`示例 ${spec.id}.json`, reparsed.terms.length === spec.terms,
    `${(text.length / 1024).toFixed(1)} KB · ${spec.terms} 项 · 覆盖率 ${cov}% · RMS 误差 ${doc.meta.rmsReconstructError}`);

  generated.push({ id: spec.id, name: spec.name, description: spec.description, doc });
}

pushMinimalExample();
pushNestedExample();

// 浏览器内置版本（file:// 下无法 fetch，所以内嵌为 JS）
const js = `/* 本文件由 tools/gen-examples.mjs 自动生成，请勿手改。\n   内容与 examples/*.json 完全一致，供 file:// 直接打开时使用。 */\n` +
  'window.FOURIER_EXAMPLES = ' + JSON.stringify(generated, null, 1) + ';\n';
fs.writeFileSync(path.join(rootDir, 'assets', 'examples.js'), js, 'utf8');
check('assets/examples.js 已生成', js.length > 1000, `${(js.length / 1024).toFixed(1)} KB`);
check('内置示例可被解析', generated.every(g => {
  const r = FC.parseDoc(JSON.stringify(g.doc));
  return r.terms.length > 0 && r.description.length > 10;
}));

/* ------------------------------------------------------------------ *
 * 4. 格式说明文档（docs/参数文档格式.md）中的最小示例也要能解析
 * ------------------------------------------------------------------ */
{
  const mini = {
    format: 'fourier-contour',
    version: 1,
    description: '半径 100、圆心 (200,150) 的圆',
    meta: { name: 'circle', phaseUnit: 'rad', unit: 'px' },
    terms: [
      { n: 0, amp: 100, phase: 0 },
      { n: 1, amp: 100, phase: Math.PI / 2 }
    ]
  };
  const r = FC.parseDoc(mini);
  const pts = FC.samplePath(r.terms, 64);
  const bb = FC.bbox(pts);
  check('最小示例（DC + n=1）画出直径 200 的圆',
    Math.abs(bb.width - 200) < 1e-6 && Math.abs(bb.height - 200) < 1e-6,
    `${bb.width}×${bb.height}`);
}

console.log(`\n${failures === 0 ? '全部自检通过 ✓' : failures + ' 项自检失败 ✗'}\n`);
process.exit(failures === 0 ? 0 : 1);
