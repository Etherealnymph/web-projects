/*!
 * fourier-core.js —— 「圆上之圆」轮廓傅里叶工具核心库
 *
 * 浏览器 / Node 双用（UMD）。无任何外部依赖。
 *
 * 数学约定
 *   轮廓视为复平面上的闭合曲线 z(t) = x(t) + i·y(t)，t ∈ [0,1)。
 *   傅里叶展开：      z(t) = Σ_k  c_k · e^{ i·2π·n_k·t }
 *   其中系数：        c_k  = (1/N) Σ_{j=0}^{N-1} z_j · e^{ -i·2π·n_k·j/N }
 *   参数文档中每个圆用 { n, amp, phase } 描述：c = amp · e^{ i·phase }
 *   因此该圆对轨迹的贡献为      amp · e^{ i·(2π·n·t + phase) }
 *   即：半径 amp、初相 phase、角速度 2π·n（n 为整数，可为负 → 反向旋转）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FourierCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TAU = Math.PI * 2;
  const FORMAT = 'fourier-contour';
  const VERSION = 1;

  /* ==================================================================
   * 1. 基础几何工具
   * ================================================================== */

  /** 折线长度；closed=true 时计入末点回到首点的长度 */
  function polylineLength(pts, closed) {
    let len = 0;
    for (let i = 1; i < pts.length; i++) {
      len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    }
    if (closed && pts.length > 1) {
      len += Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
    }
    return len;
  }

  /** 按弧长均匀重采样闭合轮廓，返回 count 个点（不重复首点） */
  function resampleClosed(points, count) {
    const src = dedupe(points);
    const n = src.length;
    if (n === 0) return [];
    if (n === 1) return new Array(count).fill([src[0][0], src[0][1]]);

    const seg = new Float64Array(n);          // seg[i] = 从 i 到 i+1 的长度
    const acc = new Float64Array(n + 1);      // 累计弧长
    for (let i = 0; i < n; i++) {
      const a = src[i], b = src[(i + 1) % n];
      seg[i] = Math.hypot(b[0] - a[0], b[1] - a[1]);
      acc[i + 1] = acc[i] + seg[i];
    }
    const total = acc[n];
    const out = new Array(count);
    if (total <= 1e-12) return new Array(count).fill([src[0][0], src[0][1]]);

    let cursor = 0;
    for (let k = 0; k < count; k++) {
      const target = (k / count) * total;
      while (cursor < n - 1 && acc[cursor + 1] < target) cursor++;
      const segStart = acc[cursor];
      const segLen = seg[cursor] || 1e-12;
      const u = Math.min(1, Math.max(0, (target - segStart) / segLen));
      const a = src[cursor], b = src[(cursor + 1) % n];
      out[k] = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
    }
    return out;
  }

  /** 去掉连续重复点（含首尾重复） */
  function dedupe(points) {
    const out = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const q = out[out.length - 1];
      if (!q || Math.abs(p[0] - q[0]) > 1e-12 || Math.abs(p[1] - q[1]) > 1e-12) {
        out.push([p[0], p[1]]);
      }
    }
    while (out.length > 1) {
      const a = out[0], b = out[out.length - 1];
      if (Math.abs(a[0] - b[0]) < 1e-12 && Math.abs(a[1] - b[1]) < 1e-12) out.pop();
      else break;
    }
    return out;
  }

  /** 环形平滑（Hann 窗），用于削掉像素级锯齿。window 为奇数，<3 时原样返回 */
  function smoothClosed(points, window) {
    const n = points.length;
    if (!window || window < 3 || n < 5) return points.map(p => [p[0], p[1]]);
    const half = Math.floor(window / 2);
    const w = new Float64Array(2 * half + 1);
    let sum = 0;
    for (let j = -half; j <= half; j++) {
      const v = 0.5 * (1 + Math.cos(Math.PI * j / half));
      w[j + half] = v; sum += v;
    }
    const out = new Array(n);
    for (let i = 0; i < n; i++) {
      let x = 0, y = 0;
      for (let j = -half; j <= half; j++) {
        const p = points[((i + j) % n + n) % n];
        const k = w[j + half];
        x += p[0] * k; y += p[1] * k;
      }
      out[i] = [x / sum, y / sum];
    }
    return out;
  }

  function bbox(points) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    }
    if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0, cx: 0, cy: 0 };
    return {
      minX, minY, maxX, maxY,
      width: maxX - minX, height: maxY - minY,
      cx: (minX + maxX) / 2, cy: (minY + maxY) / 2
    };
  }

  /** 有符号面积（正 = 图像坐标系 y 向下时的顺时针） */
  function signedArea(points) {
    let a = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const p = points[i], q = points[(i + 1) % n];
      a += p[0] * q[1] - q[0] * p[1];
    }
    return a / 2;
  }

  /* ==================================================================
   * 2. 傅里叶变换（N 为 2 的幂时走 FFT，否则朴素 DFT）
   * ================================================================== */

  function isPowerOfTwo(n) { return n > 0 && (n & (n - 1)) === 0; }

  /** 原地基 2 FFT（未归一化，X_n = Σ x_k e^{-i2πnk/N}） */
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1;
      const ang = -TAU / len;
      const wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < half; k++) {
          const a = i + k, b = a + half;
          const xr = re[b] * cr - im[b] * ci;
          const xi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - xr; im[b] = im[a] - xi;
          re[a] += xr;        im[a] += xi;
          const ncr = cr * wr - ci * wi;
          ci = cr * wi + ci * wr;
          cr = ncr;
        }
      }
    }
  }

  /**
   * 对闭合轮廓做傅里叶展开。
   * @returns {{n:number, re:number, im:number, amp:number, phase:number}[]} 按 n 升序
   */
  function dft(points) {
    const N = points.length;
    if (N < 2) throw new Error('傅里叶展开至少需要 2 个点');
    const terms = [];
    if (isPowerOfTwo(N)) {
      const re = new Float64Array(N), im = new Float64Array(N);
      for (let k = 0; k < N; k++) { re[k] = points[k][0]; im[k] = points[k][1]; }
      fft(re, im);
      const half = N >> 1;
      for (let idx = 0; idx < N; idx++) {
        const n = idx < half ? idx : idx - N;
        terms.push(makeTerm(n, re[idx] / N, im[idx] / N));
      }
    } else {
      const half = N >> 1;
      for (let n = -half; n < N - half; n++) {
        let re = 0, im = 0;
        for (let k = 0; k < N; k++) {
          const a = -TAU * n * k / N;
          const ca = Math.cos(a), sa = Math.sin(a);
          const x = points[k][0], y = points[k][1];
          re += x * ca - y * sa;
          im += y * ca + x * sa;
        }
        terms.push(makeTerm(n, re / N, im / N));
      }
    }
    terms.sort((a, b) => a.n - b.n);
    return terms;
  }

  function makeTerm(n, re, im) {
    // 极小的数值噪声直接抹平，避免文档里出现 1e-17 这种尾巴
    if (Math.abs(re) < 1e-12) re = 0;
    if (Math.abs(im) < 1e-12) im = 0;
    return { n, re, im, amp: Math.hypot(re, im), phase: Math.atan2(im, re) };
  }

  /** 取前 keep 项（按振幅降序），返回 {kept, coverage} */
  function topTerms(terms, keep) {
    const sorted = terms.slice().sort((a, b) => b.amp - a.amp);
    const totalEnergy = terms.reduce((s, t) => s + t.amp * t.amp, 0);
    const k = Math.max(1, Math.min(keep || terms.length, terms.length));
    const kept = sorted.slice(0, k);
    const e = kept.reduce((s, t) => s + t.amp * t.amp, 0);
    return { kept, coverage: totalEnergy > 0 ? e / totalEnergy : 1, dropped: terms.length - k };
  }

  /* ==================================================================
   * 3. 级数求值（正向：参数 → 轨迹）
   * ================================================================== */

  /** 把 {n,amp,phase} 或 {n,re,im} 统一成 {n,re,im,amp,phase} */
  function normalizeTerm(t) {
    let { n, re, im, amp, phase } = t;
    if (typeof amp === 'number' && typeof phase === 'number') {
      re = amp * Math.cos(phase);
      im = amp * Math.sin(phase);
    } else {
      amp = Math.hypot(re, im);
      phase = Math.atan2(im, re);
    }
    return { n, re, im, amp, phase };
  }

  /** 单个时刻 t 的位置 */
  function pointAt(terms, t) {
    let x = 0, y = 0;
    for (const it of terms) {
      const a = TAU * it.n * t + it.phase;
      x += it.amp * Math.cos(a);
      y += it.amp * Math.sin(a);
    }
    return [x, y];
  }

  /** 逐级累加，返回每一步的顶点（用于画「圆上之圆」链条） */
  function chainAt(terms, t) {
    let x = 0, y = 0;
    const chain = [[0, 0]];
    for (const it of terms) {
      const a = TAU * it.n * t + it.phase;
      x += it.amp * Math.cos(a);
      y += it.amp * Math.sin(a);
      chain.push([x, y]);
    }
    return chain;
  }

  /**
   * 在 [0,1) 上均匀采样 count 个点，返回完整轨迹。
   * 递推实现，避免逐点三角函数。
   */
  function samplePath(terms, count) {
    const M = Math.max(2, count | 0);
    const xs = new Float64Array(M), ys = new Float64Array(M);
    for (const it of terms) {
      let cr = Math.cos(it.phase), ci = Math.sin(it.phase);
      const wr = Math.cos(TAU * it.n / M), wi = Math.sin(TAU * it.n / M);
      const r = it.amp;
      for (let j = 0; j < M; j++) {
        xs[j] += r * cr;
        ys[j] += r * ci;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
    const out = new Array(M);
    for (let j = 0; j < M; j++) out[j] = [xs[j], ys[j]];
    return out;
  }

  /** 重建误差：maxErr / rmsErr（单位与坐标一致） */
  function reconstructionError(terms, points) {
    const M = points.length;
    let max = 0, sum = 0;
    for (let j = 0; j < M; j++) {
      const p = pointAt(terms, j / M);
      const dx = p[0] - points[j][0], dy = p[1] - points[j][1];
      const d = Math.hypot(dx, dy);
      if (d > max) max = d;
      sum += d * d;
    }
    return { maxError: max, rmsError: Math.sqrt(sum / M) };
  }

  /** 点到闭合折线的最短距离 */
  function distanceToContour(points, p) {
    let best = Infinity;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const a = points[i], b = points[(i + 1) % n];
      const vx = b[0] - a[0], vy = b[1] - a[1];
      const wx = p[0] - a[0], wy = p[1] - a[1];
      const L2 = vx * vx + vy * vy;
      let u = L2 > 1e-18 ? (wx * vx + wy * vy) / L2 : 0;
      u = u < 0 ? 0 : (u > 1 ? 1 : u);
      const dx = wx - vx * u, dy = wy - vy * u;
      const d2 = dx * dx + dy * dy;
      if (d2 < best) best = d2;
    }
    return Math.sqrt(best);
  }

  /**
   * 两条闭合曲线之间的最大偏差（对称），与参数化方式无关。
   * 用于回答「保留 K 项后，画出来的曲线离原轮廓最远差多少」。
   */
  function curveDeviation(a, b) {
    let max = 0, sum = 0;
    for (let i = 0; i < a.length; i++) {
      const d = distanceToContour(b, a[i]);
      if (d > max) max = d;
      sum += d * d;
    }
    for (let i = 0; i < b.length; i++) {
      const d = distanceToContour(a, b[i]);
      if (d > max) max = d;
    }
    return { maxDeviation: max, rmsDeviation: Math.sqrt(sum / a.length) };
  }

  /* ==================================================================
   * 4. 参数文档：构造 / 解析 / 序列化
   * ================================================================== */

  function round(v, digits) {
    if (!isFinite(v)) return 0;
    const f = Math.pow(10, digits);
    const r = Math.round(v * f) / f;
    return r === 0 ? 0 : r;
  }

  /**
   * 由轮廓点集构造参数文档。
   *
   * 单轮廓 → 扁平结构（version 1，顶层 terms）
   * 多轮廓 → version 2，顶层 contours: [{ role, name, terms }]
   *
   * @param {object} o {
   *   points | contours:[{points, role:'outer'|'hole', name}],
   *   description, name, source, notes, termCount, pointCount,
   *   width, height, origin, unit, phaseUnit, smooth,
   *   scaleTermsByArea = true   多轮廓时按 sqrt(面积比) 分配项数
   * }
   */
  function buildDoc(o) {
    const opt = o || {};
    const inputs = Array.isArray(opt.contours) && opt.contours.length
      ? opt.contours
      : (opt.points ? [{ points: opt.points, role: 'outer' }] : null);
    if (!inputs) throw new Error('构造文档需要 points 或 contours');
    for (const c of inputs) {
      if (!c || !c.points || c.points.length < 2) throw new Error('构造文档需要至少 2 个轮廓点');
    }

    const rawAreas = inputs.map(c => Math.max(1e-9, Math.abs(signedArea(dedupe(c.points)))));
    const maxArea = Math.max.apply(null, rawAreas);
    const baseK = inputs.map(c => Number(c.termCount || opt.termCount) || 0);   // 0 = 用全部项
    const scaledK = inputs.map((c, i) => {
      if (!baseK[i] || inputs.length === 1 || opt.scaleTermsByArea === false) return baseK[i];
      return Math.max(6, Math.round(baseK[i] * Math.sqrt(rawAreas[i] / maxArea)));
    });

    const built = inputs.map((c, i) => buildContourEntry(
      Object.assign({}, c, { termCount: scaledK[i] || undefined }), opt, i));
    const areas = built.map(b => b.area);

    const totalTerms = built.reduce((s, b) => s + b.terms.length, 0);
    const totalPoints = built.reduce((s, b) => s + b.pointCount, 0);
    const totalDropped = built.reduce((s, b) => s + b.dropped, 0);
    const weightSum = built.reduce((s, b) => s + (b.area || 1), 0) || 1;
    const coverage = built.reduce((s, b) => s + b.coverage * (b.area || 1), 0) / weightSum;
    const globalBB = globalBBox(built.map(b => b.bbox));

    const meta = {
      name: opt.name || '未命名轮廓',
      source: opt.source || 'manual',
      createdAt: opt.createdAt || new Date().toISOString(),
      pointCount: totalPoints,
      termCount: totalTerms,
      droppedTerms: totalDropped,
      amplitudeCoverage: round(coverage, 6),
      phaseUnit: opt.phaseUnit || 'rad',
      sortedBy: 'amplitude-desc',
      origin: opt.origin || 'top-left',
      yAxis: 'down',
      unit: opt.unit || 'px',
      coordinate: coordOf(globalBB, opt),
      notes: opt.notes || 'p(t) = Σ amp·e^{i(2π·n·t + phase)}，t∈[0,1)，i 为虚数单位。'
    };

    if (built.length === 1) {
      const b = built[0];
      meta.maxReconstructError = round(b.maxError, 4);
      meta.rmsReconstructError = round(b.rmsError, 4);
      return {
        format: FORMAT,
        version: 1,
        description: opt.description ||
          `${meta.name}：由 ${b.pointCount} 个等弧长采样点的傅里叶展开得到，保留 ${b.terms.length} 项复指数级数` +
          `（振幅覆盖率 ${(b.coverage * 100).toFixed(2)}%），坐标 y 轴向下。`,
        meta,
        terms: b.terms
      };
    }

    meta.contourCount = built.length;
    meta.outerCount = inputs.filter((c, i) => (c.role || 'outer') !== 'hole').length;
    meta.holeCount = built.length - meta.outerCount;
    meta.maxReconstructError = round(Math.max.apply(null, built.map(b => b.maxError)), 4);
    meta.rmsReconstructError = round(
      built.reduce((s, b) => s + b.rmsError * (b.area || 1), 0) / weightSum, 4);
    meta.termCountPolicy = opt.scaleTermsByArea === false
      ? '每个轮廓使用相同项数'
      : '每个轮廓的项数 = K·√(该轮廓面积/最大轮廓面积)，下限 6 项';
    meta.contours = built.map((b, i) => ({
      index: i,
      role: (inputs[i].role || 'outer'),
      name: inputs[i].name || `轮廓 ${i + 1}`,
      area: round(b.area, 2),
      pointCount: b.pointCount,
      termCount: b.terms.length,
      droppedTerms: b.dropped,
      amplitudeCoverage: round(b.coverage, 6),
      maxReconstructError: round(b.maxError, 4),
      rmsReconstructError: round(b.rmsError, 4),
      coordinate: coordOf(b.bbox, opt)
    }));

    return {
      format: FORMAT,
      version: 2,
      description: opt.description ||
        `${meta.name}：共 ${built.length} 个轮廓（${meta.outerCount} 个外轮廓、${meta.holeCount} 个内部孔洞），` +
        `合计 ${totalTerms} 项复指数级数，坐标 y 轴向下。`,
      meta,
      contours: built.map((b, i) => {
        const entry = { role: inputs[i].role || 'outer', name: inputs[i].name || `轮廓 ${i + 1}` };
        if (typeof inputs[i].parentIndex === 'number') entry.parent = inputs[i].parentIndex;
        entry.terms = b.terms;
        return entry;
      })
    };
  }

  function buildContourEntry(c, opt, i) {
    let points = dedupe(c.points);
    const nPoint = c.pointCount || opt.pointCount || Math.min(2048, Math.max(64, points.length));
    points = resampleClosed(points, nPoint);
    if (opt.smooth) points = smoothClosed(points, opt.smooth);

    const all = dft(points);
    const keep = Math.max(1, Math.min(c.termCount || opt.termCount || all.length, all.length));
    const { kept, coverage, dropped } = topTerms(all, keep);
    const err = reconstructionError(kept.map(normalizeTerm), points);
    return {
      terms: docTerms(kept),
      pointCount: points.length,
      termCount: kept.length,
      coverage, dropped, err,
      area: Math.abs(signedArea(points)),
      bbox: bbox(points),
      maxError: err.maxError,
      rmsError: err.rmsError
    };
  }

  /** 用新的项数重建某个轮廓条目（项数按面积缩放时使用） */
  function docTerms(kept) {
    return kept
      .slice()
      .sort((a, b) => b.amp - a.amp)
      .map(t => {
        const phase = round(t.phase, 6);
        return { n: t.n, amp: round(t.amp, 4), phase: phase === 0 ? 0 : phase };
      });
  }

  function coordOf(bb, opt) {
    return {
      width: round(bb.width, 3),
      height: round(bb.height, 3),
      minX: round(bb.minX, 3),
      minY: round(bb.minY, 3),
      maxX: round(bb.maxX, 3),
      maxY: round(bb.maxY, 3),
      canvasWidth: (opt && opt.width) || null,
      canvasHeight: (opt && opt.height) || null
    };
  }

  function globalBBox(list) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const b of list) {
      if (!b) continue;
      minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY);
      maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY);
    }
    if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0, cx: 0, cy: 0 };
    return {
      minX, minY, maxX, maxY,
      width: maxX - minX, height: maxY - minY,
      cx: (minX + maxX) / 2, cy: (minY + maxY) / 2
    };
  }

  const KEY_ALIASES = {
    description: ['description', '说明', '描述', '图像说明', 'desc'],
    terms: ['terms', '参数', '系数', '各项参数', 'coefficients', 'harmonics', 'circles', 'epicycles'],
    meta: ['meta', 'metadata', '元信息', '元数据', '信息'],
    points: ['points', '轮廓', '轮廓点', 'contour', 'contourPoints', 'path'],
    contours: ['contours', '轮廓组', '多轮廓', '轮廓列表', 'shapes', 'curves'],
    role: ['role', '类型', 'kind'],
    name: ['name', '名称', '标题'],
    phaseUnit: ['phaseUnit', '相位单位', 'angleUnit'],
    n: ['n', 'freq', 'frequency', '频率', '次数', '谐波', 'harmonic'],
    amp: ['amp', 'amplitude', 'radius', 'r', '振幅', '半径', '模'],
    phase: ['phase', 'phi', 'theta', 'angle', '相位', '初相', '初相位', '角度'],
    re: ['re', 'real', 'x', '实部'],
    im: ['im', 'imag', 'y', '虚部']
  };

  function pick(obj, keys) {
    if (!obj || typeof obj !== 'object') return undefined;
    for (const k of keys) {
      if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== undefined && obj[k] !== null) return obj[k];
    }
    return undefined;
  }

  /**
   * 解析参数文档（对象或 JSON 字符串），容错并给出中文错误信息。
   * 兼容单轮廓（顶层 terms / points）与多轮廓（顶层 contours）两种结构。
   * @returns {{doc, terms, contours:Array<{terms,role,name,index}>, warnings, description, meta}}
   *          terms 为第一个轮廓的项，便于只关心单轮廓的调用方使用。
   */
  function parseDoc(input) {
    const warnings = [];
    let raw = input;
    if (typeof input === 'string') {
      const text = input.trim();
      if (!text) throw new Error('文档为空，请粘贴 JSON 参数文档');
      try {
        raw = JSON.parse(stripBom(text));
      } catch (e) {
        throw new Error('JSON 解析失败：' + e.message);
      }
    }
    if (!raw || typeof raw !== 'object') throw new Error('文档必须是一个 JSON 对象');

    // 允许 {"doc": {...}} 包裹
    if (raw.doc && typeof raw.doc === 'object') raw = raw.doc;

    const metaRaw = pick(raw, KEY_ALIASES.meta);
    const meta = (metaRaw && typeof metaRaw === 'object') ? Object.assign({}, metaRaw) : {};
    const rawDescription = pick(raw, KEY_ALIASES.description);
    const description = typeof rawDescription === 'string' ? rawDescription
      : (typeof meta.description === 'string' ? meta.description : '');

    const phaseUnitRaw = String(pick(raw, KEY_ALIASES.phaseUnit) || meta.phaseUnit || meta.相位单位 || 'rad').toLowerCase();
    const phaseUnit = /deg|度/.test(phaseUnitRaw) ? 'deg' : 'rad';

    const contoursRaw = pick(raw, KEY_ALIASES.contours);
    const many = Array.isArray(contoursRaw) && contoursRaw.length > 0;
    const sources = many ? contoursRaw : [raw];

    const contours = sources.map((src, ci) => {
      const label = many ? `轮廓 ${ci + 1}` : '';
      if (many && (src === null || typeof src !== 'object')) {
        throw new Error(`第 ${ci + 1} 个轮廓不是合法对象`);
      }
      const list = resolveTermList(src, meta, warnings, label);
      return {
        index: ci,
        role: String(pick(src, KEY_ALIASES.role) || (many && src.role) || 'outer'),
        name: String(pick(src, KEY_ALIASES.name) || (many ? `轮廓 ${ci + 1}` : (meta.name || '轮廓'))),
        meta: (pick(src, KEY_ALIASES.meta) && typeof pick(src, KEY_ALIASES.meta) === 'object')
          ? pick(src, KEY_ALIASES.meta) : {},
        terms: parseTermList(list, phaseUnit, label)
      };
    });

    if (phaseUnit === 'deg') warnings.push('检测到相位单位为角度制，已换算为弧度');

    const doc = many
      ? {
        format: pick(raw, ['format']) || FORMAT,
        version: pick(raw, ['version']) || 2,
        description, meta,
        contours: contours.map(c => ({
          role: c.role,
          name: c.name,
          terms: c.terms.map(t => ({ n: t.n, amp: round(t.amp, 6), phase: round(t.phase, 8) }))
        }))
      }
      : {
        format: pick(raw, ['format']) || FORMAT,
        version: pick(raw, ['version']) || VERSION,
        description, meta,
        terms: contours[0].terms.map(t => ({ n: t.n, amp: round(t.amp, 6), phase: round(t.phase, 8) }))
      };

    return { doc, terms: contours[0].terms, contours, warnings, description, meta };
  }

  /** 从一个轮廓条目里取出项列表（terms 或 points） */
  function resolveTermList(src, meta, warnings, label) {
    let list = pick(src, KEY_ALIASES.terms);
    if (Array.isArray(list) && list.length) return list;
    const pts = pick(src, KEY_ALIASES.points);
    if (Array.isArray(pts) && pts.length >= 2) {
      const points = coercePoints(pts);
      const keep = Number(pick(src, ['termCount']) || meta.termCount) || 128;
      const res = topTerms(dft(resampleClosed(points, Number(meta.pointCount) || 512)), keep);
      warnings.push(`${label ? label + '：' : ''}未提供 terms，已由 ${points.length} 个轮廓点在线展开为 ${res.kept.length} 项。`);
      return res.kept;
    }
    throw new Error(`${label ? label + '：' : ''}缺少参数数组：需要 "terms": [{ "n":…, "amp":…, "phase":… }, …]，` +
      '或提供 "points" 轮廓点');
  }

  /** 解析项列表（含容错与中文报错） */
  function parseTermList(termList, phaseUnit, label) {
    if (!Array.isArray(termList) || termList.length === 0) {
      throw new Error(`${label ? label + '：' : ''}参数数组为空`);
    }
    const at = i => `${label ? label + ' ' : ''}第 ${i + 1} 项`;
    const terms = [];
    termList.forEach((t, i) => {
      if (Array.isArray(t)) {
        // 简写：[n, amp, phase] 或 [n, re, im]
        if (t.length < 2) throw new Error(`${at(i)}数组至少需要两个数：[n, amp, phase]`);
        const n = Number(t[0]);
        checkN(n, i, label);
        if (!isFinite(Number(t[1]))) throw new Error(`${at(i)}的数值不是数字`);
        if (t.length >= 3) {
          const ph = Number(t[2]) * (phaseUnit === 'deg' ? Math.PI / 180 : 1);
          if (!isFinite(ph)) throw new Error(`${at(i)}的相位不是数字`);
          terms.push(normalizeTerm({ n, amp: Number(t[1]), phase: ph }));
        } else {
          terms.push(normalizeTerm({ n, re: Number(t[1]), im: 0 }));
        }
        return;
      }
      if (t === null || typeof t !== 'object') {
        throw new Error(`${at(i)}不是合法的参数对象`);
      }

      let n = pick(t, KEY_ALIASES.n);
      if (n === undefined) throw new Error(`${at(i)}缺少频率 n（整数，可为负）`);
      n = Number(n);
      checkN(n, i, label);

      const ampRaw = pick(t, KEY_ALIASES.amp);
      const phaseRaw = pick(t, KEY_ALIASES.phase);
      const reRaw = pick(t, KEY_ALIASES.re);
      const imRaw = pick(t, KEY_ALIASES.im);

      if (ampRaw !== undefined) {
        const amp = Number(ampRaw);
        if (!isFinite(amp)) throw new Error(`${at(i)}的 amp 不是数字`);
        let ph = phaseRaw === undefined ? 0 : Number(phaseRaw);
        if (!isFinite(ph)) throw new Error(`${at(i)}的 phase 不是数字`);
        if (phaseUnit === 'deg') ph = ph * Math.PI / 180;
        terms.push(normalizeTerm({ n, amp, phase: ph }));
      } else if (reRaw !== undefined || imRaw !== undefined) {
        const re = Number(reRaw || 0), im = Number(imRaw || 0);
        if (!isFinite(re) || !isFinite(im)) throw new Error(`${at(i)}的 re/im 不是数字`);
        terms.push(normalizeTerm({ n, re, im }));
      } else {
        throw new Error(`${at(i)}既没有 amp/phase，也没有 re/im`);
      }
    });
    return terms;
  }

  function checkN(n, i, label) {
    if (!isFinite(n) || Math.abs(n - Math.round(n)) > 1e-9) {
      throw new Error(`${label ? label + ' ' : ''}第 ${i + 1} 项的 n 必须是整数（当前 ${n}）`);
    }
  }

  function coercePoints(pts) {
    return pts.map((p, i) => {
      if (Array.isArray(p) && p.length >= 2) return [Number(p[0]), Number(p[1])];
      if (p && typeof p === 'object') {
        const x = pick(p, ['x', 'X', '实部', 're']);
        const y = pick(p, ['y', 'Y', '虚部', 'im']);
        if (x !== undefined && y !== undefined) return [Number(x), Number(y)];
      }
      throw new Error(`第 ${i + 1} 个轮廓点格式不正确，应为 [x, y]`);
    });
  }

  function stripBom(s) { return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s; }

  /** 稳定美观的 JSON 序列化：description 在开头，terms 每项一行 */
  function serializeDoc(doc, space) {
    return JSON.stringify(orderDoc(doc), null, space === undefined ? 2 : space);
  }

  function orderDoc(doc) {
    const out = {};
    out.format = doc.format || FORMAT;
    out.version = doc.version || (Array.isArray(doc.contours) && doc.contours.length ? 2 : VERSION);
    out.description = doc.description || '';
    if (doc.meta !== undefined) out.meta = doc.meta;
    if (Array.isArray(doc.contours) && doc.contours.length) {
      out.contours = doc.contours.map((c, i) => {
        const entry = {};
        entry.role = c.role || 'outer';
        entry.name = c.name || `轮廓 ${i + 1}`;
        if (typeof c.parent === 'number') entry.parent = c.parent;
        entry.terms = orderTerms(c.terms);
        return entry;
      });
    } else {
      out.terms = orderTerms(doc.terms);
    }
    return out;
  }

  function orderTerms(terms) {
    return (terms || []).map(t => {
      const o = {};
      if (t.n !== undefined) o.n = t.n;
      if (t.amp !== undefined) o.amp = round(t.amp, 4);
      if (t.phase !== undefined) o.phase = round(t.phase, 6);
      if (t.re !== undefined && t.amp === undefined) { o.re = round(t.re, 6); o.im = round(t.im || 0, 6); }
      return o;
    });
  }

  /** 文档摘要（给 UI 显示） */
  function summarize(doc) {
    const meta = (doc && doc.meta) || {};
    const groups = (doc && Array.isArray(doc.contours) && doc.contours.length)
      ? doc.contours.map(c => c.terms || [])
      : [(doc && doc.terms) || []];
    const terms = groups[0] || [];
    const all = groups.reduce((a, g) => a.concat(g), []);
    const amps = all.map(t => Math.abs(Number(t.amp) || 0));
    return {
      description: (doc && doc.description) || '',
      name: meta.name || '',
      source: meta.source || '',
      createdAt: meta.createdAt || '',
      contourCount: groups.length,
      outerCount: meta.outerCount !== undefined ? meta.outerCount
        : (doc && doc.contours ? doc.contours.filter(c => (c.role || 'outer') !== 'hole').length : 1),
      holeCount: meta.holeCount !== undefined ? meta.holeCount
        : (doc && doc.contours ? doc.contours.filter(c => c.role === 'hole').length : 0),
      termCount: all.length,
      firstContourTermCount: terms.length,
      totalAmp: amps.reduce((a, b) => a + b, 0),
      maxAmp: amps.reduce((a, b) => Math.max(a, b), 0),
      nMin: all.length ? Math.min.apply(null, all.map(t => Number(t.n) || 0)) : 0,
      nMax: all.length ? Math.max.apply(null, all.map(t => Number(t.n) || 0)) : 0,
      pointCount: meta.pointCount || 0,
      coverage: meta.amplitudeCoverage,
      coordinate: meta.coordinate || null,
      maxReconstructError: meta.maxReconstructError,
      rmsReconstructError: meta.rmsReconstructError,
      contoursMeta: meta.contours || null,
      termCountPolicy: meta.termCountPolicy || '',
      notes: meta.notes || ''
    };
  }

  /* ==================================================================
   * 5. 内置形状（用于示例文档 / 示例图）
   * ================================================================== */

  const SHAPES = {
    heart: {
      label: '心形 heart',
      note: '经典心形参数方程：x=16sin³t, y=13cos t−5cos2t−2cos3t−cos4t',
      fn(t) {
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        return [x, -y];   // y 轴向下
      }
    },
    star: {
      label: '五角星 star',
      note: '五角星：外顶点半径 1，内顶点半径 0.382，逐点直连',
      fn(t) {
        const pts = 10;
        const k = t * pts;
        const i = Math.floor(k), u = k - i;
        const R = 1, r = 0.382;
        const a0 = -Math.PI / 2 + i * TAU / pts;
        const a1 = -Math.PI / 2 + (i + 1) * TAU / pts;
        const p0 = [Math.cos(a0) * R, Math.sin(a0) * R];
        const p1 = [Math.cos(a1) * (i % 2 === 0 ? r : R), Math.sin(a1) * (i % 2 === 0 ? r : R)];
        return [p0[0] + (p1[0] - p0[0]) * u, p0[1] + (p1[1] - p0[1]) * u];
      }
    },
    rose: {
      label: '玫瑰线 rose (k=5)',
      note: '玫瑰线 r=cos(5θ)，绘制完整一圈得到 5 瓣闭合曲线',
      fn(t) {
        const th = t * TAU;
        const r = Math.cos(5 * th);
        return [Math.cos(th) * r, Math.sin(th) * r];
      }
    },
    cardioid: {
      label: '心形线 cardioid',
      note: '心形线 r = 1 − cosθ',
      fn(t) {
        const th = t * TAU;
        const r = 1 - Math.cos(th);
        return [Math.cos(th) * r, Math.sin(th) * r];
      }
    },
    butterfly: {
      label: '蝴蝶 butterfly',
      note: '蝴蝶曲线 r = e^{sinθ} − 2cos(4θ) + sin⁵((2θ−π)/24)',
      fn(t) {
        const th = t * TAU;
        const r = Math.exp(Math.sin(th)) - 2 * Math.cos(4 * th) + Math.pow(Math.sin((2 * th - Math.PI) / 24), 5);
        return [Math.cos(th) * r, Math.sin(th) * r];
      }
    },
    epitrochoid: {
      label: '外摆线 epitrochoid',
      note: '外摆线：小圆在半径 R 的大圆外滚动，笔尖距小圆圆心 d',
      fn(t) {
        const th = t * TAU;
        const R = 5, r = 2, d = 3;
        const k = (R + r) / r;
        return [(R + r) * Math.cos(th) - d * Math.cos(k * th), (R + r) * Math.sin(th) - d * Math.sin(k * th)];
      }
    },
    brainf: {
      label: '双纽线 lemniscate',
      note: '双纽线 (x²+y²)² = x²−y² 的参数式',
      fn(t) {
        const th = t * TAU;
        const c = Math.cos(th), s = Math.sin(th);
        const den = 1 + s * s;
        return [c / den, s * c / den];
      }
    }
  };

  /** 由形状函数采样出点集，并归一化到指定尺寸、居中于原点 */
  function shapePoints(name, count, size) {
    const shape = SHAPES[name];
    if (!shape) throw new Error('未知形状：' + name);
    const n = count || 512;
    const pts = new Array(n);
    for (let i = 0; i < n; i++) pts[i] = shape.fn(i / n);
    const bb = bbox(pts);
    const scale = (size || 400) / Math.max(bb.width, bb.height, 1e-9);
    return pts.map(p => [(p[0] - bb.cx) * scale, (p[1] - bb.cy) * scale]);
  }

  /* ==================================================================
   * 6. 图像 → 轮廓（阈值 / 连通域 / 边界跟踪）
   * ================================================================== */

  /**
   * Otsu 自动阈值，返回前景/背景两类灰度均值的中点（比直接返回分割点更稳健，
   * 避免严格双峰直方图下阈值恰好等于前景灰度而分不出前景）。
   */
  function otsu(hist, total) {
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sumB = 0, wB = 0, bestVar = -1, bestI = -1;
    for (let i = 0; i < 256; i++) {
      wB += hist[i];
      if (wB === 0) continue;
      const wF = total - wB;
      if (wF === 0) break;
      sumB += i * hist[i];
      const mB = sumB / wB, mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > bestVar) { bestVar = between; bestI = i; }
    }
    if (bestI < 0) return 128;
    // 用最优分割点重算两类均值，取中点
    let wB2 = 0, sumB2 = 0;
    for (let i = 0; i <= bestI; i++) { wB2 += hist[i]; sumB2 += i * hist[i]; }
    const wF2 = total - wB2;
    if (wB2 === 0 || wF2 === 0) return bestI;
    const mB = sumB2 / wB2, mF = (sum - sumB2) / wF2;
    return Math.max(0, Math.min(255, Math.round((mB + mF) / 2)));
  }

  /**
   * 由 ImageData 生成二值掩膜。
   * 判定规则：dark → 灰度 ≤ 阈值 视为前景；light / alpha → > 阈值 视为前景。
   * @param {{data:Uint8ClampedArray,width:number,height:number}} imageData
   * @param {object} opts {mode:'dark'|'light'|'alpha', threshold:number|null, invert:boolean}
   */
  function buildMask(imageData, opts) {
    const o = opts || {};
    const w = imageData.width, h = imageData.height;
    const data = imageData.data;
    const mode = o.mode || 'dark';
    const invert = !!o.invert;

    const vals = new Float32Array(w * h);
    const hist = new Float64Array(256);
    let total = 0;
    for (let i = 0, p = 0; i < w * h; i++, p += 4) {
      let v;
      if (mode === 'alpha') {
        v = data[p + 3];
      } else {
        const a = data[p + 3];
        if (a < 8) {
          v = mode === 'dark' ? 255 : 0;          // 全透明视为背景
        } else {
          v = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
        }
      }
      vals[i] = v;
      hist[Math.max(0, Math.min(255, Math.round(v)))]++;
      total++;
    }

    let threshold = o.threshold;
    let auto = false;
    if (threshold === undefined || threshold === null || threshold < 0) {
      threshold = otsu(hist, total);
      auto = true;
    }

    const mask = new Uint8Array(w * h);
    let fg = 0;
    for (let i = 0; i < w * h; i++) {
      let on = mode === 'dark' ? (vals[i] <= threshold) : (vals[i] > threshold);
      if (invert) on = !on;
      mask[i] = on ? 1 : 0;
      if (on) fg++;
    }
    return { mask, threshold, auto, width: w, height: h, foreground: fg };
  }

  /**
   * 4 连通标记，返回全部连通域。
   * @returns {{labels:Int32Array, comps:Array<{label,size,seed,bbox,touchesBorder}>}}
   */
  function labelComponents(mask, w, h) {
    const labels = new Int32Array(w * h);
    const stack = new Int32Array(w * h);
    const comps = [];
    let label = 0;
    for (let start = 0; start < w * h; start++) {
      if (!mask[start] || labels[start]) continue;
      label++;
      let sp = 0;
      stack[sp++] = start;
      labels[start] = label;
      let size = 0, seed = start;
      let minX = w, minY = h, maxX = -1, maxY = -1;
      while (sp > 0) {
        const idx = stack[--sp];
        const x = idx % w, y = (idx - x) / w;
        size++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) { minY = y; seed = idx; }
        if (y > maxY) maxY = y;
        if (x > 0)     { const k = idx - 1; if (mask[k] && !labels[k]) { labels[k] = label; stack[sp++] = k; } }
        if (x < w - 1) { const k = idx + 1; if (mask[k] && !labels[k]) { labels[k] = label; stack[sp++] = k; } }
        if (y > 0)     { const k = idx - w; if (mask[k] && !labels[k]) { labels[k] = label; stack[sp++] = k; } }
        if (y < h - 1) { const k = idx + w; if (mask[k] && !labels[k]) { labels[k] = label; stack[sp++] = k; } }
      }
      comps.push({
        label, size, seed,
        bbox: { minX, minY, maxX, maxY },
        touchesBorder: (minX === 0 || minY === 0 || maxX === w - 1 || maxY === h - 1)
      });
    }
    return { labels, comps };
  }

  /** 面积最大的连通域（保留旧接口） */
  function largestComponent(mask, w, h) {
    const { labels, comps } = labelComponents(mask, w, h);
    let best = null;
    for (const c of comps) if (!best || c.size > best.size) best = c;
    const comp = new Uint8Array(w * h);
    if (best) for (let i = 0; i < w * h; i++) if (labels[i] === best.label) comp[i] = 1;
    return {
      component: comp,
      size: best ? best.size : 0,
      seed: best ? best.seed : -1,
      bbox: best ? best.bbox : { minX: 0, minY: 0, maxX: -1, maxY: -1 },
      touchesBorder: best ? best.touchesBorder : false
    };
  }

  // 8 邻域方向，顺时针（图像坐标 y 向下）
  const DIRS = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];

  /** 3×3 方形结构元的腐蚀 / 膨胀（可分离两次一维扫描） */
  function morphPass(src, dst, tmp, w, h, dilate) {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const a = src[row + (x > 0 ? x - 1 : 0)];
        const b = src[row + x];
        const c = src[row + (x < w - 1 ? x + 1 : w - 1)];
        tmp[row + x] = dilate ? (a | b | c) : (a & b & c);
      }
    }
    for (let y = 0; y < h; y++) {
      const row = y * w;
      const up = (y > 0 ? y - 1 : 0) * w;
      const dn = (y < h - 1 ? y + 1 : h - 1) * w;
      for (let x = 0; x < w; x++) {
        const a = tmp[up + x], b = tmp[row + x], c = tmp[dn + x];
        dst[row + x] = dilate ? (a | b | c) : (a & b & c);
      }
    }
  }

  /** 形态学闭运算：先膨胀 n 次再腐蚀 n 次，用于连接断裂的线条/网点 */
  function closeMask(mask, w, h, iterations) {
    let n = Math.max(0, Math.min(8, iterations | 0));
    if (n === 0) return mask;
    let cur = Uint8Array.from(mask);
    const tmp = new Uint8Array(w * h);
    const buf = new Uint8Array(w * h);
    while (n-- > 0) {
      morphPass(cur, buf, tmp, w, h, true);
      cur = buf.slice();
    }
    n = Math.max(0, Math.min(8, iterations | 0));
    while (n-- > 0) {
      morphPass(cur, buf, tmp, w, h, false);
      cur = buf.slice();
    }
    return cur;
  }

  /**
   * Moore 邻域边界跟踪（Jacob 停止准则），返回像素中心坐标序列。
   * @param {(x:number,y:number)=>number} at 判定 (x,y) 是否属于目标区域
   * 要求 seed 是该区域中最上方最左侧的像素（其西侧必定不属于该区域）。
   */
  function traceBoundaryWith(at, w, h, seed) {
    const sx = seed % w, sy = (seed - sx) / w;
    const contour = [];
    let cx = sx, cy = sy;
    let dirToPrev = 7;           // 起始：认定从西侧进入
    let second = null;
    const guard = w * h * 8 + 16;

    for (let step = 0; step < guard; step++) {
      contour.push([cx, cy]);
      let nd = -1, nx = 0, ny = 0;
      for (let i = 1; i <= 8; i++) {
        const d = (dirToPrev + i) % 8;
        const tx = cx + DIRS[d][0], ty = cy + DIRS[d][1];
        if (tx >= 0 && ty >= 0 && tx < w && ty < h && at(tx, ty)) { nd = d; nx = tx; ny = ty; break; }
      }
      if (nd < 0) break;                       // 孤立像素
      if (second === null) second = nx + ny * w;
      else if ((nx + ny * w) === second) break; // 回到第二点 → 闭合
      cx = nx; cy = ny;
      dirToPrev = (nd + 4) % 8;
    }
    return contour;
  }

  /** 掩膜版边界跟踪（保留旧接口） */
  function traceBoundary(comp, w, h, seed) {
    return traceBoundaryWith((x, y) => comp[y * w + x], w, h, seed);
  }

  /**
   * 完整流程：ImageData → 有序轮廓点列表。调用方负责先把图缩放到合适尺寸。
   *
   * @param {object} opts {
   *   mode, threshold, invert, closing,
   *   pointCount, smooth,
   *   includeHoles = true,      是否提取图形内部的孔洞轮廓
   *   minAreaRatio = 0.002,     小于「最大轮廓像素数 × 该比例」的碎轮廓丢弃
   *   maxContours = 24          最多保留多少个轮廓（按面积从大到小）
   * }
   * @returns {{contours:Array, threshold:{value,auto}, foreground:number, ...}}
   *   每个 contour: {points, raw, role:'outer'|'hole', area, componentSize, bbox, seed}
   *
   * 说明：边界跟踪取的是边界像素中心，因此轮廓比真实边缘约小半个像素
   * （面积偏差 ≈ 周长×0.5px），对后续傅里叶展开无实质影响。
   */
  function extractContours(imageData, opts) {
    const o = opts || {};
    const w = imageData.width, h = imageData.height;
    const m = buildMask(imageData, o);
    if (m.foreground === 0) throw new Error('没有找到前景像素：请调整阈值模式或手动阈值');

    const workMask = o.closing ? closeMask(m.mask, w, h, o.closing) : m.mask;
    const fg = labelComponents(workMask, w, h);
    if (fg.comps.length === 0) throw new Error('未找到有效连通域');

    let maxSize = 0;
    for (const c of fg.comps) if (c.size > maxSize) maxSize = c.size;
    const minPixels = Math.max(4, maxSize * Math.max(0, o.minAreaRatio || 0));

    // 背景连通域：不与图像边框相连的背景，就是图形内部的孔洞
    let bgLabels = null;
    const holes = [];
    if (o.includeHoles !== false) {
      const inv = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) inv[i] = workMask[i] ? 0 : 1;
      const bg = labelComponents(inv, w, h);
      bgLabels = bg.labels;
      for (const c of bg.comps) {
        if (c.touchesBorder || c.size < minPixels) continue;
        // 归属：孔洞四周出现次数最多的前景连通域
        const tally = new Map();
        let parentLabel = 0, bestCount = 0;
        for (let i = 0; i < w * h; i++) {
          if (bgLabels[i] !== c.label) continue;
          const x = i % w, y = (i - x) / w;
          const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
          for (const k of nb) {
            if (k < 0) continue;
            const lab = fg.labels[k];
            if (!lab) continue;
            const n = (tally.get(lab) || 0) + 1;
            tally.set(lab, n);
            if (n > bestCount) { bestCount = n; parentLabel = lab; }
          }
        }
        holes.push({ comp: c, parentLabel });
      }
    }

    const list = [];
    for (const c of fg.comps) {
      if (c.size < minPixels) continue;
      list.push({
        role: 'outer',
        componentSize: c.size,
        parentLabel: 0,
        seed: c.seed,
        at: (x, y) => fg.labels[y * w + x] === c.label ? 1 : 0
      });
    }
    for (const hole of holes) {
      const c = hole.comp;
      list.push({
        role: 'hole',
        componentSize: c.size,
        parentLabel: hole.parentLabel,
        seed: c.seed,
        at: (x, y) => bgLabels[y * w + x] === c.label ? 1 : 0
      });
    }

    list.sort((a, b) => b.componentSize - a.componentSize);
    const maxContours = Math.max(1, Math.min(o.maxContours || 24, 512));

    const contours = [];
    const count = Math.max(16, Math.min(o.pointCount || 512, 4096));
    for (const item of list) {
      if (contours.length >= maxContours) break;
      const raw = traceBoundaryWith(item.at, w, h, item.seed);
      if (raw.length < 8) continue;
      let points = resampleClosed(raw, count);
      if (o.smooth) points = smoothClosed(points, o.smooth);
      contours.push({
        points,
        raw,
        role: item.role,
        componentSize: item.componentSize,
        parentLabel: item.parentLabel,
        area: Math.abs(signedArea(points)),
        bbox: bbox(points)
      });
    }
    if (contours.length === 0) {
      throw new Error('轮廓过小（不足 8 个像素），请提高处理分辨率、放宽阈值或开启闭运算');
    }
    contours.sort((a, b) => b.area - a.area);

    // 预览用前景掩膜
    const comp = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) comp[i] = workMask[i] ? 1 : 0;

    return {
      contours,
      points: contours[0].points,          // 兼容：面积最大的轮廓
      raw: contours[0].raw,
      threshold: { value: m.threshold, auto: m.auto },
      componentSize: contours[0].componentSize,
      touchesBorder: fg.comps.some(c => c.touchesBorder && c.size >= minPixels),
      foreground: m.foreground,
      component: comp,
      width: w, height: h,
      largestBBox: bbox(contours[0].points),
      holeCount: contours.filter(c => c.role === 'hole').length,
      outerCount: contours.filter(c => c.role === 'outer').length
    };
  }

  /** 只取最大的那一个外轮廓（保留旧接口） */
  function extractContour(imageData, opts) {
    const o = Object.assign({}, opts || {}, { includeHoles: false, maxContours: 1 });
    const res = extractContours(imageData, o);
    return {
      points: res.contours[0].points,
      raw: res.contours[0].raw,
      threshold: res.threshold,
      componentSize: res.contours[0].componentSize,
      touchesBorder: res.touchesBorder,
      foreground: res.foreground,
      component: res.component,
      width: res.width, height: res.height
    };
  }

  return {
    TAU, FORMAT, VERSION,
    polylineLength, resampleClosed, smoothClosed, dedupe, bbox, signedArea,
    isPowerOfTwo, fft, dft, topTerms, makeTerm,
    normalizeTerm, pointAt, chainAt, samplePath, reconstructionError,
    distanceToContour, curveDeviation,
    buildDoc, parseDoc, serializeDoc, summarize, orderDoc, round,
    SHAPES, shapePoints,
    otsu, buildMask, labelComponents, largestComponent, traceBoundary, traceBoundaryWith,
    extractContours, extractContour, closeMask,
  };
});
