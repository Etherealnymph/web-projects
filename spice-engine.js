
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ST = Object.assign(root.ST || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const Q = 1.602176634e-19, KB = 1.380649e-23, EPS0 = 8.8541878128e-12;
  const EPSI = 11.7 * EPS0, EPSOX = 3.9 * EPS0;
  const NI_CM3 = 1.45e10, TREF = 300.15, TNOM = 298.15;
  const VBC = -30, DVB = 1e-3, DELTA_VBSC = 1e-3;
  const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
  const safeExp = (x) => (x > 80 ? Math.exp(80) : x < -80 ? 0 : Math.exp(x));
  const sq = (x) => x * x;
  const DEFAULTS = {
    version: 3.24, binunit: 2, type: 'n', mobmod: 1, capmod: 3, noimod: 1,
    level: 49, phi: 0.7, vbi: 1.1, elm: 5, noff: 1, acde: 1, moin: 15,
    nstar: 2.0e14, em: 4.1e7, ef: 1.0, af: 1.0, kf: 0, flkflag: 0, mfnlev: 0,
    toxm: 4.08e-9, xj: 1.5e-7, nch: 1.7e17, nd: 1.0e20, sub: 0,
    lint: 0, wint: 0, xl: 0, xw: 0, dwg: 0, dwb: 0, dlc: 0, dwc: 0,
    ll: 0, lw: 0, lwl: 0, wl: 0, ww: 0, wwl: 0, lln: 1, lwn: 1, wln: 1, wwn: 1,
    dvt0: 0, dvt1: 0, dvt2: 0, dvt0w: 0, dvt1w: 0, dvt2w: 0,
    k3: 0, k3b: 0, w0: 0, nlx: 0, dsub: 0, drout: 0,
    cdsc: 0, cdscb: 0, cdscd: 0, cit: 0, eta0: 0, etab: 0,
    a0: 1, a1: 0, a2: 1, ags: 0, b0: 0, b1: 0, keta: 0,
    vsat: 8e4, ua: -2.25e-9, ub: 5.87e-19, uc: -4.65e-11, u0: 0.067,
    rdsw: 0, prwg: 0, prwb: 0, wr: 1,
    pclm: 1.3, pdiblc1: 0.39, pdiblc2: 0.0086, pdiblcb: 0, pscbe1: 4.24e8,
    pscbe2: 1.0e-5, pvag: 0, delta: 0.01, alpha0: 0, alpha1: 0, beta0: 30,
    kt1: -0.11, kt1l: 0, kt2: 0.022, ute: -1.5, ua1: 4.31e-9, ub1: -7.61e-18,
    uc1: -5.6e-11, at: 3.3e4, prt: 0,
    cgso: 0, cgdo: 0, cgbo: 0, cgsl: 0, cgdl: 0, ckappa: 0.6, cf: 0,
    cj: 0, cjsw: 0, cjswg: 0, pb: 1.0, pbsw: 1.0, pbswg: 1.0,
    mj: 0.5, mjsw: 0.33, mjswg: 0.33, tcj: 0, tcjsw: 0, tcjswg: 0,
    tpb: 0, tpbsw: 0, tpbswg: 0, js: 0, jsw: 0,
    noia: 1e20, noib: 5e4, noic: -1.4e-12,
    xpart: 0, nqsmod: 0, iimod: 0, tnoimod: 0, ntnoi: 1.0,
    lmin: 0, lmax: 1, wmin: 0, wmax: 1
  };
  function par(P, name) {
    const v = P[name];
    if (v === undefined || v === null) {
      const d = DEFAULTS[name];
      return d === undefined ? 0 : d;
    }
    return v;
  }
  const isP = (P, name) => P[name] !== undefined && P[name] !== null;
  function selectBin(corner, L, W) {
    const bins = corner.bins || [];
    for (const b of bins) {
      if (L >= b.lmin * 0.999999 && L <= b.lmax * 1.000001 &&
          W >= b.wmin * 0.999999 && W <= b.wmax * 1.000001) return { bin: b, exact: true };
    }
    let best = null, bestD = Infinity;
    for (const b of bins) {
      const dl = L < b.lmin ? b.lmin - L : L > b.lmax ? L - b.lmax : 0;
      const dw = W < b.wmin ? b.wmin - W : W > b.wmax ? W - b.wmax : 0;
      const d = Math.hypot(dl / b.lmin, dw / b.wmin);
      if (d < bestD) { bestD = d; best = b; }
    }
    return { bin: best, exact: false };
  }
  function mu0T(P, T) { return par(P, 'u0') * Math.pow(T / TNOM, par(P, 'ute')); }
  function muAT(P, T) { return par(P, 'ua') + par(P, 'ua1') * (T / TNOM - 1); }
  function muBT(P, T) { return par(P, 'ub') + par(P, 'ub1') * (T / TNOM - 1); }
  function muCT(P, T) { return par(P, 'uc') + par(P, 'uc1') * (T / TNOM - 1); }
  function vsatT(P, T) { return par(P, 'vsat') - par(P, 'at') * (T / TNOM - 1); }
  function rdswT(P, T) { return par(P, 'rdsw') + par(P, 'prt') * (T / TNOM - 1); }
  function resolveGeometry(P, L, W, vgsteff) {
    const Lp = L + par(P, 'xl'), Wp = W + par(P, 'xw');
    const Lln = par(P, 'lln'), Lwn = par(P, 'lwn'), Wln = par(P, 'wln'), Wwn = par(P, 'wwn');
    const dL = par(P, 'lint') + par(P, 'll') * (Lp / Lln) + par(P, 'lw') * (Wp / Lwn) +
      par(P, 'lwl') * (Lp * Wp / (Lln * Lwn));
    const dW = par(P, 'wint') + par(P, 'wl') * (Lp / Wln) + par(P, 'ww') * (Wp / Wwn) +
      par(P, 'wwl') * (Lp * Wp / (Wln * Wwn));
    const phi = par(P, 'phi'), phis0 = Math.sqrt(Math.max(phi, 1e-6));
    const bias = par(P, 'dwg') * (vgsteff || 0) + par(P, 'dwb') * (phis0 - Math.sqrt(phi));
    return {
      Leff: Math.max(Lp - 2 * dL, 1e-9),
      Weff: Math.max(Wp - 2 * dW - 2 * bias, 1e-9),
      LeffCV: Math.max(Lp - 2 * (par(P, 'dlc') + 0), 1e-9),
      dL: dL, dW: dW
    };
  }
  function applyBinning(P, Leff, Weff) {
    const out = Object.assign({}, P);
    for (const key in P) {
      if (key.length < 2) continue;
      const head = key[0];
      if (head !== 'l' && head !== 'w' && head !== 'p') continue;
      const base = key.slice(1);
      if (!isP(P, base)) continue;
      if (key === 'lmin' || key === 'lmax' || key === 'wmin' || key === 'wmax') continue;
      if (key === 'lint' || key === 'wint' || key === 'level') continue;
      const lk = P['l' + base], wk = P['w' + base], pk = P['p' + base];
      if (lk === undefined && wk === undefined && pk === undefined) continue;
      let v = par(P, base);
      if (lk) v += lk / Leff;
      if (wk) v += wk / Weff;
      if (pk) v += pk / (Leff * Weff);
      out[base] = v;
    }
    return out;
  }
  function fingerIV(P0, Vgs, Vds, Vbs, T, opts) {
    const o = opts || {}, vt = KB * T / Q;
    const tox = par(P0, 'tox') > 0 ? par(P0, 'tox') : par(P0, 'toxm');
    const toxm = par(P0, 'toxm') > 0 ? par(P0, 'toxm') : tox;
    const Cox = EPSOX / tox, nchM3 = par(P0, 'nch') * 1e6;
    const geo = resolveGeometry(P0, o.Lfinger, o.Wfinger, 0);
    const Leff = geo.Leff, Weff = geo.Weff;
    const P = applyBinning(P0, Leff, Weff);
    const k1ox = par(P, 'k1') * tox / toxm, k2ox = par(P, 'k2') * tox / toxm;
    const k1 = par(P, 'k1'), k2 = k2ox;
    const Vbsc = 0.9 * (par(P, 'phi') - (k2ox !== 0 ? sq(k1ox) / (4 * sq(k2ox)) : 0));
    let vbseff;
    if (Vbs >= Vbsc) {
      const t0 = Vbs - Vbsc - DVB;
      vbseff = Vbsc + 0.5 * (t0 + Math.sqrt(Math.max(t0 * t0 - 4 * DVB * Vbsc, 0)));
    } else vbseff = Vbs;
    vbseff = Math.min(vbseff, 0);
    const phi = par(P, 'phi');
    let phis;
    if (vbseff <= 0) phis = phi - vbseff;
    else phis = phi * phi / (phi + 0.5 * vbseff);
    phis = Math.max(phis, 1e-4);
    const sqrtPhis = Math.sqrt(phis);
    const Xdep = nchM3 > 0 ? Math.sqrt(2 * EPSI * phis / (Q * nchM3)) : 1e-7;
    const Lt = Math.sqrt(EPSI * tox * par(P, 'xj') / EPSOX) * (1 + par(P, 'dvt2') * vbseff);
    const Lt0 = Math.sqrt(EPSI * tox * par(P, 'xj') / EPSOX);
    const Litl = Math.sqrt(EPSI * tox * par(P, 'xj') / EPSOX);
    const Theta0 = par(P, 'dvt0') !== 0 ? safeExp(-par(P, 'dvt1') * Leff / (2 * Lt)) + 2 * safeExp(-2 * par(P, 'dvt1') * Leff / Lt) : 0;
    const Theta0W = par(P, 'dvt0w') !== 0 ? safeExp(-par(P, 'dvt1w') * Leff / (2 * Lt)) + 2 * safeExp(-2 * par(P, 'dvt1w') * Leff / Lt) : 0;
    const vbi = par(P, 'vbi');
    const DVth0 = par(P, 'dvt0') * (vbi - phi) * Theta0 * Vds;
    const DVth0W = par(P, 'dvt0w') * (vbi - phi) * Theta0W * Vds;
    const Pdibl = Vds * (par(P, 'eta0') + par(P, 'etab') * vbseff) * (safeExp(-par(P, 'dsub') * Leff / (2 * Lt0)) + 2 * safeExp(-par(P, 'dsub') * Leff / Lt0));
    const dVthT = (par(P, 'kt1') + par(P, 'kt1l') / Leff + par(P, 'kt2') * vbseff) * (T / TNOM - 1);
    const Vth = par(P, 'vth0') + k1ox * sqrtPhis - k1 * Math.sqrt(phi) - k2 * vbseff - DVth0 - DVth0W + dVthT - Pdibl + (par(P, 'k3') + par(P, 'k3b') * vbseff) * tox * phi / (Weff + par(P, 'w0')) + k1 * Math.sqrt(phi) * (Math.sqrt(1 + par(P, 'nlx') / Leff) - 1);
    const Cd = EPSI / Xdep;
    const n = 1 + par(P, 'nfactor') * Cd / Cox + Theta0 * (par(P, 'cdsc') + par(P, 'cdscb') * vbseff + par(P, 'cdscd') * Vds) / Cox + par(P, 'cit') / Cox;
    const nSafe = Math.max(n, 1.0);
    const Vgseff = Vgs;
    const t1 = (Vgseff - Vth) / (2 * nSafe * vt);
    const num = 2 * nSafe * vt * Math.log1p(safeExp(t1));
    const cFactor = 2 * nSafe * Cox * Math.sqrt(2 * phi / (Q * EPSI * nchM3));
    const den = 1 + cFactor * safeExp(-(Vgseff - Vth - 2 * par(P, 'voff')) / (2 * nSafe * vt));
    const Vgsteff = Math.max(num / den, 0);
    let muEff;
    const u0T = mu0T(P, T), uAT = muAT(P, T), uBT = muBT(P, T), uCT = muCT(P, T);
    if (par(P, 'mobmod') === 1) {
      const g = (Vgsteff + 2 * Vth) / tox;
      muEff = u0T / (1 + (uAT + uCT * vbseff) * g + uBT * g * g);
    } else if (par(P, 'mobmod') === 2) {
      const g = Vgsteff / tox;
      muEff = u0T / (1 + (uAT + uCT * vbseff) * g + uBT * g * g);
    } else {
      const g = (Vgsteff + 2 * Vth) / tox;
      muEff = u0T / ((1 + uAT * g + uBT * g * g) * (1 + uCT * vbseff));
    }
    muEff = Math.max(muEff, 1e-4);
    const xjXdep = Math.sqrt(Math.max(par(P, 'xj') * Xdep, 0));
    const Lratio = Leff / (Leff + 2 * xjXdep);
    const Abulk0 = (1 + k1ox / (2 * sqrtPhis) * (par(P, 'a0') * Lratio + par(P, 'b0') / (Weff + par(P, 'b1')))) / (1 + par(P, 'keta') * vbseff);
    const Abulk = Abulk0 - par(P, 'ags') * par(P, 'a0') * (Vgsteff / (1 + par(P, 'keta') * vbseff)) * (k1ox / (2 * sqrtPhis)) * Lratio * Lratio * Lratio;
    const Vsat = vsatT(P, T);
    const wr = par(P, 'wr');
    const Rds = rdswT(P, T) * (1 + par(P, 'prwg') * Vgsteff + par(P, 'prwb') * (sqrtPhis - Math.sqrt(phi))) / Math.pow(Weff * 1e6, wr);
    const Esat = 2 * Vsat / muEff;
    const Rfactor = Weff * Vsat * Cox * Rds;
    let lam = par(P, 'a1') * Vgsteff + par(P, 'a2');
    lam = Math.min(lam, 0.999999);
    let Vdsat;
    if (Rds === 0 && Math.abs(lam - 1) < 1e-12) {
      Vdsat = Esat * Leff * (Vgsteff + 2 * vt) / (Abulk * Esat * Leff + Vgsteff + 2 * vt);
    } else {
      const a = sq(Abulk) * Rfactor + (1 / lam - 1) * Abulk;
      const b = -(Vgsteff + 2 * vt) * (2 / lam - 1) - Abulk * (Esat * Leff + 3 * Rfactor * (Vgsteff + 2 * vt));
      const c = Esat * Leff * (Vgsteff + 2 * vt) + 2 * Rfactor * sq(Vgsteff + 2 * vt);
      const disc = Math.max(b * b - 4 * a * c, 0);
      Vdsat = (-b - Math.sqrt(disc)) / (2 * a);
    }
    if (!isFinite(Vdsat) || Vdsat <= 0) Vdsat = 1e-3;
    const DELTA = par(P, 'delta');
    const v1 = Vdsat - Vds - DELTA;
    const Vdseff = Vdsat - 0.5 * (v1 + Math.sqrt(Math.max(v1 * v1 + 4 * DELTA * Vdsat, 0)));
    const Ids0 = Weff * Cox * muEff * Vgsteff * (1 - Abulk * Vdseff / (2 * (Vgsteff + 2 * vt))) * Vdseff / (Leff * (1 + Vdseff / (Esat * Leff)));
    const IdsRds = Ids0 / (1 + Rds * Ids0 / Vdseff);
    const deltaV = Vds - Vdseff;
    const VAsat = (Esat * Leff * Vdsat + 2 * Rfactor * Vgsteff * (1 - Abulk * Vdsat / (2 * (Vgsteff + 2 * vt)))) / (2 / lam - 1 + Rfactor * Abulk);
    const VACLM = par(P, 'pclm') > 0 && deltaV > 0 ? (Abulk * Esat * Leff + Vgsteff) * deltaV / (par(P, 'pclm') * Abulk * Esat * Litl) : Infinity;
    const thetarout = par(P, 'pdiblc1') * (safeExp(-par(P, 'drout') * Leff / (2 * Lt0)) + 2 * safeExp(-par(P, 'drout') * Leff / Lt0)) + par(P, 'pdiblc2');
    const thetaRout = thetarout * (1 + par(P, 'pdiblcb') * vbseff);
    const VADIBL = Math.abs(thetaRout) > 1e-12 ? (Vgsteff + 2 * vt) / thetaRout * (1 - Abulk * Vdsat / (Abulk * Vdsat + Vgsteff + 2 * vt)) : Infinity;
    const invVA = (isFinite(VACLM) ? 1 / VACLM : 0) + (isFinite(VADIBL) ? 1 / VADIBL : 0);
    const VA = VAsat + (1 + par(P, 'pvag') * Vgsteff / (Esat * Leff)) * (Math.abs(invVA) > 1e-12 ? 1 / invVA : Infinity);
    const VASCBE = deltaV > 1e-9 ? (Leff / Math.max(par(P, 'pscbe2'), 1e-30)) * safeExp(par(P, 'pscbe1') * Litl / deltaV) : Infinity;
    const fVA = 1 + (isFinite(VA) ? deltaV / VA : 0);
    const fSCBE = 1 + (isFinite(VASCBE) ? deltaV / VASCBE : 0);
    let Ids = IdsRds * fVA * fSCBE;
    if (!isFinite(Ids) || isNaN(Ids)) Ids = 0;
    if (Ids < 0) Ids = 0;
    return {
      Leff, Weff, Cox, vt, n: nSafe, phis, sqrtPhis, Xdep, vbseff, Vbsc,
      Vgs, Vds, Vbs, Vth, Vgsteff, muEff, Abulk, Abulk0, Rds, Esat, Vdsat, Vdseff,
      Ids, Ids0, IdsRds, VA, VAsat, VACLM, VADIBL, VASCBE, deltaV, thetarout, lam,
      Rfactor, Vsat, P, geo
    };
  }
  function mosOp(cfg) {
    const dev = cfg.device, corner = cfg.corner;
    const s = (cfg.type === 'p') ? -1 : 1;
    const W = cfg.W, L = cfg.L, nf = Math.max(1, Math.round(cfg.nf || 1));
    const T = cfg.T || TNOM;
    const Wf = W, Wtotal = Wf * nf;
    const Vgs = s * cfg.Vgs, Vds = s * cfg.Vds, Vbs = s * cfg.Vbs;
    const sel = selectBin(corner, L, Wf);
    if (!sel.bin) return { error: 'no model bin for L=' + L + ' W=' + Wf };
    const Pcard = Object.assign({}, sel.bin.params);
    Pcard.type = cfg.type;
    if (s < 0) Pcard.vth0 = -par(Pcard, 'vth0');
    const o = { Lfinger: L, Wfinger: Wf };
    const f = fingerIV(Pcard, Vgs, Vds, Vbs, T, o);
    const dVg = 1e-3, dVd = 1e-3, dVb = 1e-3;
    const fg1 = fingerIV(Pcard, Vgs + dVg / 2, Vds, Vbs, T, o).Ids;
    const fg0 = fingerIV(Pcard, Vgs - dVg / 2, Vds, Vbs, T, o).Ids;
    const fd1 = fingerIV(Pcard, Vgs, Vds + dVd / 2, Vbs, T, o).Ids;
    const fd0 = fingerIV(Pcard, Vgs, Vds - dVd / 2, Vbs, T, o).Ids;
    const fb1 = fingerIV(Pcard, Vgs, Vds, Vbs + dVb / 2, T, o).Ids;
    const fb0 = fingerIV(Pcard, Vgs, Vds, Vbs - dVb / 2, T, o).Ids;
    const gm1 = (fg1 - fg0) / dVg, gds1 = (fd1 - fd0) / dVd, gmbs1 = (fb1 - fb0) / dVb;
    const capsF = capacitance(Pcard, f, { Wf: Wf, L: L, Vgs: Vgs, Vds: Vds, Vbs: Vbs, T: T, cfg: cfg });
    const noiseF = noiseModel(Pcard, f, capsF, { T: T, cfg: cfg, nf: nf, Vgs: Vgs, Vds: Vds, gm1: gm1, gds1: gds1, gmbs1: gmbs1 });
    const Id = nf * f.Ids;
    const gm = nf * gm1, gds = nf * gds1, gmbs = nf * gmbs1;
    const CggF = capsF.Cgs + capsF.Cgd + capsF.Cgb;
    const fT = CggF > 0 ? gm1 / (2 * Math.PI * CggF) : Infinity;
    const fmaxF = fmaxOf(fT, capsF, cfg);
    const caps = scaleCaps(capsF, nf);
    const noise = {
      SidThermal: noiseF.SidThermal, SidThermalTotal: noiseF.SidThermal * nf,
      flicker: (fq) => noiseF.flicker(fq) * nf,
      SidFlicker1k: noiseF.flicker(1000) * nf,
      SidFlicker10k: noiseF.flicker(10000) * nf,
      N0: noiseF.N0, Nl: noiseF.Nl, dLclm: noiseF.dLclm,
      perFinger: noiseF
    };
    return {
      deviceId: dev.id, cornerId: cfg.cornerId, type: cfg.type,
      W: W, L: L, nf: nf, Wf: Wf, Wtotal: Wtotal, T: T,
      Vgs: cfg.Vgs, Vds: cfg.Vds, Vbs: cfg.Vbs,
      binExact: sel.exact, bin: sel.bin.bin, binRange: sel.bin,
      Leff: f.Leff, Weff: f.Weff, WeffTotal: f.Weff * nf, Cox: f.Cox,
      Vth: s * f.Vth, Vov: s * (Vgs - f.Vth),
      Id: s * Id, IdPerFinger: s * f.Ids, IdPerUm: s * Id / (Wtotal * 1e6),
      gm, gds, gmbs: s * gmbs,
      gmId: gm / Math.max(Math.abs(Id), 1e-30),
      ro: 1 / Math.max(gds, 1e-30),
      gainIntrinsic: gm / Math.max(gds, 1e-30),
      Vdsat: s * f.Vdsat, Vdseff: s * f.Vdseff,
      region: region_(Vgs, Vds, f),
      n: f.n, phis: f.phis, vbseff: f.vbseff, muEff: f.muEff, Abulk: f.Abulk,
      Abulk0: f.Abulk0, Vgsteff: s * f.Vgsteff,
      VA: f.VA, Rds: f.Rds, Esat: f.Esat, Rfactor: f.Rfactor, lambda: f.lam,
      VAsat: f.VAsat, VACLM: f.VACLM, VADIBL: f.VADIBL, VASCBE: f.VASCBE,
      capsPerFinger: capsF, caps, noise,
      fT, fmax: fmaxF,
      subthresholdSwing: f.n * Math.log(10) * KB * T / Q * 1000,
      P: f.P, finger: f
    };
  }
  function scaleCaps(c, k) {
    const out = {};
    for (const key in c) out[key] = typeof c[key] === 'number' ? c[key] * k : c[key];
    return out;
  }
  function region_(Vgs, Vds, f) {
    const Vov = Vgs - f.Vth;
    if (Vov <= -0.05) return 'cutoff';
    if (Vov < 0.05) return 'subthreshold';
    if (Vds < f.Vdsat * 0.98) return 'linear';
    return 'saturation';
  }
  function fmaxOf(fT, caps, cfg) {
    const Rg = cfg.Rg || 0, Cgd = caps.Cgd;
    if (!(Rg > 0) || !(Cgd > 0) || !isFinite(fT)) return Infinity;
    return Math.sqrt(fT / (8 * Math.PI * Rg * Cgd));
  }
  function capacitance(P, f, o) {
    const cfg = o.cfg || {};
    const Weff = f.Weff, Leff = f.Leff, Cox = f.Cox, CoxArea = Cox * Weff * Leff;
    const Cgso = par(P, 'cgso') + (par(P, 'capmod') === 3 ? par(P, 'cgsl') : 0);
    const Cgdo = par(P, 'cgdo') + (par(P, 'capmod') === 3 ? par(P, 'cgdl') : 0);
    const CovS = Cgso * Weff, CovD = Cgdo * Weff, CovB = par(P, 'cgbo') * Leff;
    const Vds = o.Vds, Vdsat = Math.max(f.Vdsat, 1e-6);
    const inStrong = f.Vgsteff > 2 * f.vt;
    let CgsI = 0, CgdI = 0, CgbI = 0;
    if (inStrong) {
      const x = clamp(Vds / Vdsat, 0, 1);
      const sat = Math.pow(x, 3), lin = 1 - sat;
      CgsI = CoxArea * (0.5 * lin + (2 / 3) * sat);
      CgdI = CoxArea * (0.5 * lin + 0.02 * sat);
      CgbI = 0;
    } else {
      const w = Math.exp(clamp(f.Vgsteff / (2 * f.vt), -30, 0));
      CgbI = CoxArea * (1 - w);
      CgsI = CoxArea * 0.5 * w;
      CgdI = CoxArea * 0.5 * w * 0.1;
    }
    const T = o.T || TNOM;
    const jc = junction(P, cfg, o, T);
    return {
      Cgs: CgsI + CovS, Cgd: CgdI + CovD, Cgb: CgbI + CovB,
      CgsIntrinsic: CgsI, CgdIntrinsic: CgdI, CgbIntrinsic: CgbI,
      Cgso: CovS, Cgdo: CovD, Cgbo: CovB, CoxArea,
      Cdb: jc.Cdb, Csb: jc.Csb, CdbArea: jc.CdbArea, CsbArea: jc.CsbArea,
      Cjd: jc.Cdb, Cjs: jc.Csb,
      Vdb: o.Vds - o.Vbs, Vsb: -o.Vbs
    };
  }
  function junction(P, cfg, o, T) {
    const Wf = o.Wf || 1e-6, ldif = par(P, 'ldif'), hdif = par(P, 'hdif');
    const defArea = Wf * (2 * hdif + ldif);
    const defPerim = 2 * (Wf + 2 * hdif + ldif);
    const areaD = cfg.AD !== undefined && cfg.AD !== null ? cfg.AD : defArea;
    const areaS = cfg.AS !== undefined && cfg.AS !== null ? cfg.AS : defArea;
    const perimD = cfg.PD !== undefined && cfg.PD !== null ? cfg.PD : defPerim;
    const perimS = cfg.PS !== undefined && cfg.PS !== null ? cfg.PS : defPerim;
    const wgateD = cfg.PDgate !== undefined ? cfg.PDgate : Wf;
    const wgateS = cfg.PSgate !== undefined ? cfg.PSgate : Wf;
    return {
      Cdb: jcap(P, areaD, perimD, wgateD, o.Vds - o.Vbs, T),
      Csb: jcap(P, areaS, perimS, wgateS, -o.Vbs, T),
      CdbArea: areaD, CsbArea: areaS, perimD: perimD, perimS: perimS,
      defArea: defArea, defPerim: defPerim
    };
  }
  function jcap(P, area, perim, Wgate, Vj, T) {
    const dT = T - TNOM;
    const cj = par(P, 'cj') * (1 + par(P, 'tcj') * dT);
    const cjsw = par(P, 'cjsw') * (1 + par(P, 'tcjsw') * dT);
    const cjswg = par(P, 'cjswg') * (1 + par(P, 'tcjswg') * dT);
    const pb = par(P, 'pb') - par(P, 'tpb') * dT;
    const pbsw = par(P, 'pbsw') - par(P, 'tpbsw') * dT;
    const pbswg = par(P, 'pbswg') - par(P, 'tpbswg') * dT;
    const F = (v, pbx, m) => {
      if (pbx <= 0) return 1;
      let x = v / pbx;
      if (x < 0) x = 0;
      if (x > 0.95) x = 0.95;
      return Math.pow(1 - x, -m);
    };
    return Math.max(area, 0) * cj * F(Vj, pb, par(P, 'mj')) +
      Math.max(perim, 0) * cjsw * F(Vj, pbsw, par(P, 'mjsw')) +
      Math.max(Wgate, 0) * cjswg * F(Vj, pbswg, par(P, 'mjswg'));
  }
  function noiseModel(P, f, caps, o) {
    const T = o.T || TNOM, nf = o.nf || 1, kT = KB * T;
    const Weff = f.Weff, Leff = f.Leff, Cox = f.Cox, Ids = f.Ids;
    const gm1 = o.gm1, gds1 = o.gds1, gmbs1 = o.gmbs1;
    const noimod = par(P, 'noimod');
    let SidThermal;
    if (noimod === 1 || noimod === 3) SidThermal = (8 / 3) * kT * (gm1 + gds1 + gmbs1);
    else {
      const Qinv = Math.abs(Cox * Weff * Leff * f.Vgsteff * (1 - f.Abulk * f.Vdseff / (2 * (f.Vgsteff + 2 * f.vt))));
      SidThermal = 4 * kT * f.muEff * Qinv / (Leff * Leff + f.muEff * Qinv * f.Rds);
    }
    if (!isFinite(SidThermal) || SidThermal < 0) SidThermal = 0;
    const NOIA = par(P, 'noia'), NOIB = par(P, 'noib'), NOIC = par(P, 'noic');
    const NSTAR = par(P, 'nstar'), EF = par(P, 'ef');
    const EM = par(P, 'em'), Esat = f.Esat;
    const N0 = Cox / Q * f.Vgsteff;
    const Nl = Cox / Q * f.Vgsteff * (1 - f.Abulk * f.Vdseff / (Math.max(f.Vgsteff + 2 * f.vt, 1e-9)));
    let dLclm = 0;
    if (f.Vds > f.Vdsat && Esat > 0) {
      const arg = (f.Vds - f.Vdseff) / (LitlOf(P, f) * Esat) + EM / Esat;
      dLclm = LitlOf(P, f) * Math.log(Math.max(arg, 1e-30));
    }
    const flickerAt = (freq) => {
      const fEF = Math.pow(freq, EF);
      const first = Q * Q * f.vt * f.muEff * Ids / (1e8 * Cox * Math.max(f.Abulk, 1e-6) * Leff * Leff * fEF) * (NOIA * Math.log((N0 + NSTAR) / (Nl + NSTAR)) + NOIB * (N0 - Nl) + NOIC * (N0 * N0 - Nl * Nl) / 2);
      const second = f.vt * Ids * Ids * 2 * dLclm / (Weff * Leff * Leff * fEF) * (NOIA + NOIB * Nl + NOIC * Nl * Nl) / sq(Nl + NSTAR);
      let s = first + second;
      if (s < 0) s = 0;
      return s;
    };
    return {
      SidThermal, SidThermalTotal: SidThermal * nf, flicker: flickerAt,
      SidFlicker1k: flickerAt(1000), SidFlicker10k: flickerAt(10000),
      N0, Nl, dLclm, gm1: gm1, gds1: gds1
    };
  }
  function LitlOf(P, f) {
    const tox = par(P, 'tox') > 0 ? par(P, 'tox') : par(P, 'toxm');
    return Math.sqrt(EPSI * tox * par(P, 'xj') / EPSOX);
  }
  return {
    CONST: { Q, KB, EPS0, EPSI, EPSOX, NI_CM3, TREF, TNOM },
    DEFAULTS, par, selectBin, applyBinning, resolveGeometry,
    fingerIV, mosOp, capacitance, jcap,
    vthOnly: function (cfg) {
      const r = mosOp(Object.assign({}, cfg, { Vgs: 0, Vds: cfg.Vds || 0 }));
      return r.Vth;
    }
  };
});
