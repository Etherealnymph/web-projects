
(function (root, factory) {
  const api = factory(root.ST || (typeof require === 'function' ? require('./bsim3.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ST = Object.assign(root.ST || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (ST) {
  'use strict';
  const TNOM = ST.CONST.TNOM, Q = ST.CONST.Q, KB = ST.CONST.KB;
  const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
  function op(dev, cornerId, cfg) {
    if (!dev || !dev.corners) return { error: 'Device or corners not found' };
    const corner = dev.corners[cornerId];
    if (!corner) return { error: 'corner ' + cornerId + ' not found' };
    return ST.mosOp(Object.assign({}, cfg, { device: dev, corner: corner, cornerId: cornerId, type: cfg.type || dev.type }));
  }
  function bisect(f, lo, hi, tol) {
    tol = tol || 1e-6;
    let flo = f(lo), fhi = f(hi);
    if (!isFinite(flo) || !isFinite(fhi)) return NaN;
    if (flo === 0) return lo;
    if (fhi === 0) return hi;
    if (flo * fhi > 0) return NaN;
    for (let i = 0; i < 200; i++) {
      const mid = Math.sqrt(lo * hi) || 0.5 * (lo + hi);
      const fm = f(mid);
      if (!isFinite(fm)) return NaN;
      if (Math.abs(fm) < tol * Math.max(1e-12, Math.abs(fhi), Math.abs(flo))) return mid;
      if (flo * fm <= 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
      if (Math.abs(hi - lo) < 1e-15 * hi) break;
    }
    return Math.sqrt(lo * hi);
  }
  function solveWidthForId(dev, cornerId, cfg, targetId, opts) {
    const o = opts || {}, corner = dev.corners[cornerId];
    if (!corner || !corner.wmin) return { error: '该器件缺少尺寸数据' };
    const wmin = corner.wmin, wmax = corner.wmax, target = Math.abs(targetId);
    const idAt = (Wf, n) => {
      const r = op(dev, cornerId, Object.assign({}, cfg, { W: Wf, nf: n }));
      return r.error ? NaN : Math.abs(r.Id);
    };
    const idMin = idAt(wmin, 1);
    if (!isFinite(idMin)) return { error: '无法在该工艺角下计算该器件' };
    let nf = clamp(Math.floor(target / idMin), 1, 4096);
    for (let it = 0; it < 60; it++) {
      const per = target / nf;
      const iLo = idAt(wmin, nf) / nf, iHi = idAt(wmax, nf) / nf;
      if (isFinite(iLo) && iLo > per) {
        if (nf === 1) return { error: '当前偏置下最小电流为 ' + eng(iLo) + 'A (每指宽度 ' + (wmin * 1e6).toFixed(3) + ' µm) —— 目标 ' + eng(target) + 'A 更小。请降低 Vgs 或减小 L。' };
        nf = Math.max(1, nf - 1);
        continue;
      }
      if (isFinite(iHi) && iHi < per) {
        nf = nf < 4096 ? nf + 1 : nf;
        if (nf >= 4096) break;
        continue;
      }
      const f = (Wf) => idAt(Wf, nf) - target;
      const Wf = bisect(f, wmin * 0.999, wmax * 1.001);
      if (!isFinite(Wf)) break;
      const r = op(dev, cornerId, Object.assign({}, cfg, { W: Wf, nf: nf }));
      r.solved = { Wf: Wf, Wtotal: Wf * nf, nf: nf, target: targetId, residual: Math.abs(r.Id) - target, Wmin: wmin, Wmax: wmax };
      return r;
    }
    return { error: '目标电流 ' + eng(target) + 'A 在每指宽度 ' + (wmin * 1e6).toFixed(3) + '–' + (wmax * 1e6).toFixed(3) + ' µm 的表征范围内无法实现（已尝试 1~4096 指）' };
  }
  function eng(x) {
    const a = Math.abs(x);
    if (a >= 1) return x.toFixed(3);
    if (a >= 1e-3) return (x * 1e3).toFixed(3) + 'm';
    if (a >= 1e-6) return (x * 1e6).toFixed(3) + 'u';
    return x.toExponential(3);
  }
  function solveVgsForId(dev, cornerId, cfg, targetId, opts) {
    const o = opts || {};
    const sgn = (cfg.type || dev.type) === 'p' ? -1 : 1;
    const lo = o.Vmin !== undefined ? o.Vmin : 0, hi = o.Vmax !== undefined ? o.Vmax : 2.2;
    const f = (v) => {
      const r = op(dev, cornerId, Object.assign({}, cfg, { Vgs: sgn * v }));
      return r.error ? NaN : Math.abs(r.Id) - Math.abs(targetId);
    };
    const v = bisect(f, lo, hi);
    if (!isFinite(v)) return { error: '目标电流在 0~2.2V 的 Vgs 范围内无法达到' };
    const r = op(dev, cornerId, Object.assign({}, cfg, { Vgs: sgn * v }));
    r.solved = { Vgs: sgn * v, target: targetId, residual: r.Id - sgn * targetId };
    return r;
  }
  function solveVgsForGmId(dev, cornerId, cfg, targetGmId, opts) {
    const o = opts || {};
    const sgn = (cfg.type || dev.type) === 'p' ? -1 : 1;
    const lo = o.Vmin !== undefined ? o.Vmin : 0.0, hi = o.Vmax !== undefined ? o.Vmax : 2.2;
    const gmIdOf = (v) => {
      const r = op(dev, cornerId, Object.assign({}, cfg, { Vgs: sgn * v }));
      return r.error ? NaN : r.gmId;
    };
    const f = (v) => gmIdOf(v) - targetGmId;
    const v = bisect(f, lo, hi);
    if (!isFinite(v)) return { error: '目标 gm/ID 无法在该器件上实现' };
    const r = op(dev, cornerId, Object.assign({}, cfg, { Vgs: sgn * v }));
    r.solved = { Vgs: sgn * v, gmId: r.gmId, target: targetGmId };
    return r;
  }
  function solveLForGain(dev, cornerId, cfg, targetGain) {
    const f = (L) => {
      const r = op(dev, cornerId, Object.assign({}, cfg, { L: L }));
      return r.error ? NaN : r.gainIntrinsic - targetGain;
    };
    const L = bisect(f, 0.18e-6, 20e-6);
    if (!isFinite(L)) return { error: '无法在该器件上达到目标本征增益' };
    const r = op(dev, cornerId, Object.assign({}, cfg, { L: L }));
    r.solved = { L: L, gain: r.gainIntrinsic };
    return r;
  }
  function sweepVgs(dev, cornerId, cfg, opts) {
    const o = opts || {}, n = o.points || 60;
    const sgn = (cfg.type || dev.type) === 'p' ? -1 : 1;
    const v0 = o.from, v1 = o.to, out = [];
    for (let i = 0; i < n; i++) {
      const v = v0 + (v1 - v0) * i / (n - 1);
      const r = op(dev, cornerId, Object.assign({}, cfg, { Vgs: sgn * v }));
      if (!r.error) out.push(Object.assign({ x: v }, r));
    }
    return out;
  }
  function sweepVds(dev, cornerId, cfg, opts) {
    const o = opts || {}, n = o.points || 60;
    const sgn = (cfg.type || dev.type) === 'p' ? -1 : 1, out = [];
    for (let i = 0; i < n; i++) {
      const v = o.from + (o.to - o.from) * i / (n - 1);
      const r = op(dev, cornerId, Object.assign({}, cfg, { Vds: sgn * v }));
      if (!r.error) out.push(Object.assign({ x: v }, r));
    }
    return out;
  }
  function sweepGmId(dev, cornerId, cfg, opts) {
    const o = opts || {}, n = o.points || 40;
    const g0 = o.from !== undefined ? o.from : 4, g1 = o.to !== undefined ? o.to : 28, out = [];
    for (let i = 0; i < n; i++) {
      const target = g0 + (g1 - g0) * i / (n - 1);
      const r = solveVgsForGmId(dev, cornerId, cfg, target, o);
      if (r && !r.error) {
        const WoverL = r.Wtotal / r.L;
        out.push({
          x: r.gmId, gmId: r.gmId, Vgs: r.Vgs, Vov: r.Vov, Id: r.Id,
          IdPerWL: Math.abs(r.Id) / WoverL, fT: r.fT, gm: r.gm, gds: r.gds,
          gain: r.gainIntrinsic, Vth: r.Vth, region: r.region, r: r
        });
      }
    }
    return out;
  }
  function mismatch(mm, Wum, Lum, nf) {
    const areaSingle = Wum * Lum * (nf || 1), geo = 1 / Math.sqrt(areaSingle);
    return {
      area: areaSingle,
      sigmaVthSingle: mm.avtV * geo,
      sigmaDlRel: mm.avtDl * geo,
      sigmaDwRel: mm.avtDw * geo,
      sigmaToxRel: mm.avtTox * geo
    };
  }
  function currentMirror(cfg) {
    const { dev, cornerId, type, Lref, Wref, nfRef, Lout, Wout, nfOut, ratio, Vout, Vdd } = cfg;
    const corObj = dev.corners[cornerId] || {};
    const Vth0 = op(dev, cornerId, { W: Wref, L: Lref, nf: nfRef, type, Vgs: 0, Vds: 0.1, Vbs: 0 }).Vth;
    const solveRef = (vgs) => op(dev, cornerId, { W: Wref, L: Lref, nf: nfRef, type, Vgs: vgs, Vds: vgs, Vbs: 0 });
    const sgn = type === 'p' ? -1 : 1;
    let vgs;
    if (cfg.gmIdTarget) vgs = sgn * solveVgsForGmId(dev, cornerId, { W: Wref, L: Lref, nf: nfRef, type, Vds: Math.abs(cfg.Vgs || 0.8) }, cfg.gmIdTarget).solved.Vgs;
    else { const f = (v) => Math.abs(solveRef(sgn * v).Id) - Math.abs(cfg.Iref); vgs = sgn * bisect(f, 0, 2.2); }
    const ref = solveRef(vgs);
    const out = op(dev, cornerId, { W: Wout, L: Lout, nf: nfOut, type, Vgs: vgs, Vds: sgn * Math.abs(Vout), Vbs: 0 });
    const Wr = Wref * nfRef, Wo = Wout * nfOut;
    const mirror = Math.abs(out.Id) / Math.max(Math.abs(ref.Id), 1e-30);
    const mmR = mismatch(corObj.mismatch || {}, Wref * 1e6, Lref * 1e6, nfRef);
    const mmO = mismatch(corObj.mismatch || {}, Wout * 1e6, Lout * 1e6, nfOut);
    const vthDiff = Math.sqrt(mmR.sigmaVthSingle * mmR.sigmaVthSingle + mmO.sigmaVthSingle * mmO.sigmaVthSingle);
    const dBetaRel = Math.sqrt(mmR.sigmaDlRel * mmR.sigmaDlRel + mmR.sigmaDwRel * mmR.sigmaDwRel + mmO.sigmaDlRel * mmO.sigmaDlRel + mmO.sigmaDwRel * mmO.sigmaDwRel);
    const gmIdRef = ref.gmId, gmIdOut = out.gmId;
    const sigmaIrel = Math.sqrt(Math.pow(vthDiff * (gmIdRef + gmIdOut) / 2, 2) + dBetaRel * dBetaRel);
    return {
      ref, out, Vgs: vgs, mirrorRatio: mirror, refCurrent: Math.abs(ref.Id),
      outCurrent: Math.abs(out.Id), VoutMin: Math.abs(out.Vdsat),
      roOut: out.ro, roRef: ref.ro,
      sigmaVthPair: vthDiff, sigmaBetaRel: dBetaRel, sigmaIrel: sigmaIrel,
      sigmaI: sigmaIrel * Math.abs(out.Id),
      headroom: Vdd !== undefined ? Vdd - Math.abs(out.Vdsat) : undefined
    };
  }
  function otaSingle(c) {
    const gm1 = c.gm1, ro1 = c.ro1, ro3 = c.ro3, CL = c.CL, Cc = c.Cc || 0;
    const rout = (ro1 * (ro3 || ro1)) / ((ro1 + (ro3 || ro1)) || 1);
    const Av = gm1 * rout;
    const Cnode = CL + Cc;
    const fnd = Cnode > 0 ? gm1 / (2 * Math.PI * Cnode) : Infinity;
    const GBW = Cnode > 0 ? gm1 / (2 * Math.PI * Cnode) : Infinity;
    const SR = (c.Itail && Cnode > 0) ? c.Itail / Cnode : undefined;
    const Vn2 = c.noiseDensity ? c.noiseDensity : gm1 > 0 ? 8 * KB * TNOM / (3 * gm1) : 0;
    return { gain: Av, gainDb: 20 * Math.log10(Av), rout, GBW, fnd, SR, VnInput: Math.sqrt(Vn2), VnInput2: Vn2, Cnode, pm: 90 };
  }
  function otaTwoStage(c) {
    const gm1 = c.gm1, gm2 = c.gm2, ro1 = c.ro1, ro2 = c.ro2;
    const Cc = c.Cc, CL = c.CL, Rz = c.Rz || 0;
    const A1 = gm1 * ro1, A2 = gm2 * ro2, Av = A1 * A2;
    const p1 = 1 / (2 * Math.PI * gm2 * ro2 * ro1 * Cc);
    const p2 = gm2 / (2 * Math.PI * CL);
    const z = 1 / (2 * Math.PI * Cc * (1 / gm2 - Rz));
    const GBW = gm1 / (2 * Math.PI * Cc);
    const PM = 90 - Math.atan(GBW / p2) * 180 / Math.PI;
    const SR = c.Itail ? c.Itail / Cc : undefined;
    const Vn2 = 2 * (8 * KB * TNOM / (3 * gm1)) * (1 + gm2 / gm1);
    return { A1, A2, gain: Av, gainDb: 20 * Math.log10(Av), p1, p2, z, GBW, PM, SR, Cc, CL, VnInput2: Vn2, VnInput: Math.sqrt(Vn2), ro1, ro2 };
  }
  const exprCache = {};
  const SUFFIX = { f: 1e-15, p: 1e-12, n: 1e-9, u: 1e-6, m: 1e-3, k: 1e3, g: 1e9, t: 1e12 };
  const SUFFIX_RE = /(\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)\s*([fpnumkgt])(?![A-Za-z0-9_])/g;
  function deSpice(expr) {
    return String(expr).replace(SUFFIX_RE, (m, num, suf) => {
      const v = parseFloat(num) * (SUFFIX[suf] !== undefined ? SUFFIX[suf] : 1);
      return '(' + v + ')';
    });
  }
  function evalExpr(expr, params) {
    let entry = exprCache[expr];
    if (!entry) {
      const js = deSpice(expr);
      entry = new Function('P', 'with (P) { return (' + js + '); }');
      exprCache[expr] = entry;
    }
    const P = Object.assign({ int: Math.trunc, sqrt: Math.sqrt, exp: Math.exp, log: Math.log, min: Math.min, max: Math.max, abs: Math.abs }, params);
    return entry(P);
  }
  function rfLayout(dev, cornerId, nf, wf, L) {
    const lay = dev.layout;
    if (!lay) return { error: 'layout data not available for this device' };
    const cornerObj = dev.corners[cornerId] || {};
    const globals = cornerObj.globals || {};
    const base = { lr: L, wr: wf, nr: nf };
    const P = Object.assign({}, globals, base);
    const pnames = Object.keys(lay.params || {});
    for (const n of pnames) {
      if (base[n] !== undefined) { P[n] = base[n]; continue; }
      const e = lay.params[n];
      P[n] = /^[-+0-9.eE\s*\/()]+$/.test(e) ? evalExpr(e, P) : evalExpr(e, P);
    }
    P.lef = P.lef !== undefined ? P.lef : L;
    P.wef = P.wef !== undefined ? P.wef : wf;
    const out = { params: {}, elements: {}, diodes: {} };
    for (const n of pnames) out.params[n] = P[n];
    for (const el of lay.elements || []) {
      try {
        if (el.kind === 'mos') continue;
        if (el.kind === 'diode') {
          const area = evalExpr(el.area, P), pj = evalExpr(el.pj, P);
          const dm = (lay.diodeModels || {})[el.model] || {};
          const cj = dm.cj ? evalExpr(String(dm.cj), P) : 0;
          const cjsw = dm.cjsw ? evalExpr(String(dm.cjsw), P) : 0;
          out.diodes[el.name] = { model: el.model, area, pj, cj, cjsw, mj: dm.mj, mjsw: dm.mjsw, pb: dm.pb, C0: area * cj + pj * cjsw };
        } else {
          out.elements[el.name] = { kind: el.kind, value: evalExpr(el.value, P) };
        }
      } catch (e) { out.elements[el.name] = { error: String(e) }; }
    }
    out.Rg = out.elements.rg ? out.elements.rg.value : undefined;
    out.Rs = out.elements.rs ? out.elements.rs.value : undefined;
    out.Rd = out.elements.rd ? out.elements.rd.value : undefined;
    out.Rb = out.elements.rb ? out.elements.rb.value : undefined;
    out.CgsLayout = out.elements.cgs_m ? out.elements.cgs_m.value : undefined;
    out.CgdLayout = out.elements.cgd_m ? out.elements.cgd_m.value : undefined;
    out.CdbLayout = out.diodes.ddd ? out.diodes.ddd.C0 : undefined;
    out.CsbLayout = out.diodes.dss ? out.diodes.dss.C0 : undefined;
    out.CdbFull = out.diodes.ddd ? out.diodes.ddd.C0 + (out.diodes.ddg ? out.diodes.ddg.C0 : 0) : undefined;
    out.CsbFull = out.diodes.dss ? out.diodes.dss.C0 + (out.diodes.dsg ? out.diodes.dsg.C0 : 0) : undefined;
    return out;
  }
  return {
    op, bisect, solveWidthForId, solveVgsForId, solveVgsForGmId, solveLForGain,
    sweepVgs, sweepVds, sweepGmId, mismatch, currentMirror,
    otaSingle, otaTwoStage, rfLayout, evalExpr
  };
});
