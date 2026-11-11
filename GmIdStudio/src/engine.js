/* Compact BSIM3-parameterized design engine for gm/Id exploration.
   Uses the extracted BSIM3 bin card (VTH0, K1, K2, TOX, U0, VSAT, RDSW,
   PCLM, etc.) with an EKV-style channel charge + alpha-power saturation core. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CmosEngine = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VT = 0.025852;           // thermal voltage at 27 C
  const EPSOX = 3.453e-11;       // F/m
  const LN10 = Math.LN10;

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  function pickBin(db, cornerKey, devKey, L, W) {
    const corner = db.corners[cornerKey];
    if (!corner) throw new Error('missing corner ' + cornerKey);
    const bins = corner.devices[devKey];
    if (!bins || !bins.length) throw new Error('missing device ' + devKey);
    const tol = 1e-12;
    const exact = bins.filter(b => L >= b.lmin - tol && L <= b.lmax + tol && W >= b.wmin - tol && W <= b.wmax + tol);
    if (exact.length) return exact[0];
    let best = bins[0], bestD = Infinity;
    for (const b of bins) {
      const lc = clamp(L, b.lmin, b.lmax);
      const wc = clamp(W, b.wmin, b.wmax);
      const d = Math.abs(Math.log(lc / L)) + Math.abs(Math.log(wc / W));
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  function keyFor(corner, domain, device) {
    const ck = domain === '3.3' ? corner + '_3V' : corner;
    const dk = domain === '3.3' ? (device === 'p' ? 'pch3' : 'nch3') : (device === 'p' ? 'pch' : 'nch');
    return { cornerKey: ck, devKey: dk };
  }

  function softplus(z) {
    if (z > 40) return z;
    if (z < -40) return Math.exp(z);
    return Math.log1p(Math.exp(z));
  }

  function simulate(db, opts) {
    const o = Object.assign({
      corner: 'TT', domain: '1.8', device: 'n', L: 0.18e-6, W: 10e-6,
      Vgs: 0.9, Vds: 0.9, Vbs: 0
    }, opts || {});
    const L = clamp(Number(o.L), 1e-7, 20e-6);
    const W = clamp(Number(o.W), 1e-7, 900e-6);
    const keys = keyFor(o.corner, o.domain, o.device);
    const bin = pickBin(db, keys.cornerKey, keys.devKey, L, W);
    const tox = bin.tox || (o.domain === '3.3' ? 6.8e-9 : 4.08e-9);
    const Cox = EPSOX / tox;
    const phi = o.domain === '3.3' ? 0.75 : 0.7;
    const Lref = o.domain === '3.3' ? 0.35e-6 : 0.18e-6;
    const vth0 = Math.abs(bin.vth0);
    const k1 = bin.k1 || 0;
    const k2 = bin.k2 || 0;
    const vbs = Math.max(0, Number(o.Vbs) || 0);

    const n = 1 + k1 / (2 * Math.sqrt(phi + vbs));
    const Leff = Math.max(L - 2 * bin.dlc, 0.05e-6);
    const Weff = Math.max(W - 2 * bin.wint, 0.05e-6);
    const ueff = Math.max(bin.u0, 1e-4);
    const vsat = Math.max(bin.vsat, 1e3);
    const Esat = 2 * vsat / ueff;
    const Is = 2 * n * ueff * Cox * VT * VT * (Weff / Leff);
    const Rds = clamp((bin.rdsw || 0) / (W * 1e6), 0, 5000);
    const Rs = Rds / 2, Rd = Rds / 2;
    const dibl0 = (o.domain === '3.3' ? 0.015 : 0.020) * Math.pow(Lref / L, 0.7);
    const lam = Math.max(0.0002, 0.004 * Math.pow(Lref / L, 0.7) * ((bin.pclm || 1) / 1.1));
    const vbsTerm = k1 * (Math.sqrt(phi + vbs) - Math.sqrt(phi)) + k2 * vbs;

    function vthAt(vd) {
      return vth0 + vbsTerm - dibl0 * Math.max(0, vd);
    }

    function intrinsic(vg, vd) {
      const vth = vthAt(vd);
      const vov = vg - vth;
      const vdsat = vov > 0
        ? Math.max(0.02, vov / (1 + vov / (Esat * Leff)))
        : 3 * VT;
      const ff = softplus(vov / (2 * n * VT));
      let id = Is * ff * ff;
      id /= (1 + Math.max(vov, 0) / (Esat * Leff));
      const x = vd / vdsat;
      if (x < 1) id *= x * (2 - x);
      else id *= 1 + lam * (vd - vdsat);
      return { id: Math.max(0, id), vdsat, vth };
    }

    function drain(vg, vd) {
      vg = Math.max(0, vg); vd = Math.max(0, vd);
      let id = 0;
      for (let k = 0; k < 6; k++) {
        const r = intrinsic(vg - id * Rs, vd - id * Rds);
        id = 0.5 * id + 0.5 * r.id;
      }
      return id;
    }

    const Vgs = Math.max(0, Number(o.Vgs) || 0);
    const Vds = Math.max(0, Number(o.Vds) || 0);
    const point = intrinsic(Vgs, Vds);
    let Id = drain(Vgs, Vds);
    const h = 1e-3;
    let gm = (drain(Vgs + h, Vds) - drain(Math.max(0, Vgs - h), Vds)) / (2 * h);
    let gds = (drain(Vgs, Vds + h) - drain(Vgs, Math.max(0, Vds - h))) / (2 * h);
    if (!isFinite(gm) || gm < 0) gm = 0;
    if (!isFinite(gds) || gds <= 0) gds = Math.max(1e-12, Id * 1e-5);
    const gmid = Id > 1e-15 ? gm / Id : 0;
    // Weak-inversion / high-field output-conductance shaping. This keeps the
    // intrinsic-gain trade-off visible instead of a single flat gds/Id line.
    if (Vds >= point.vdsat && gmid > 0) {
      gds += Id * 0.05 * Math.pow(gmid / 10, 2);
    }
    const ro = 1 / gds;
    const gmro = gm / gds;
    const Cgg = Cox * Weff * Leff + ((bin.cgdo || 0) + (bin.cgso || 0)) * Weff;
    const fT = Cgg > 0 ? gm / (2 * Math.PI * Cgg) : 0;
    const vov = Vgs - point.vth;
    let region;
    if (vov < -0.12) region = 'cutoff';
    else if (vov < 0.05) region = 'subthreshold';
    else if (Vds < point.vdsat) region = 'triode';
    else region = 'saturation';

    return {
      corner: o.corner, domain: o.domain, device: o.device,
      L, W, Vgs, Vds, Vbs: vbs,
      bin, Leff, Weff, tox, Cox,
      Vth: point.vth, Vov: vov, Vdsat: point.vdsat, n, SS: n * VT * LN10 * 1000,
      Id, IdW: Id / Weff,          // A/m == uA/um
      gm, gds, ro, gmid, gmro, Cgg, fT,
      region, dibl: dibl0, lambda: lam, Rds, Is
    };
  }

  function sweepVgs(db, opts, nPoints) {
    const o = Object.assign({}, opts || {});
    const vdd = o.domain === '3.3' ? 3.3 : 1.8;
    const n = nPoints || 401;
    const vmin = o.VgsMin != null ? o.VgsMin : 0;
    const vmax = o.VgsMax != null ? o.VgsMax : vdd;
    const out = [];
    for (let i = 0; i < n; i++) {
      const Vgs = vmin + (vmax - vmin) * i / (n - 1);
      const p = simulate(db, Object.assign({}, o, { Vgs }));
      out.push(p);
    }
    return out;
  }

  const REGION_CN = {
    cutoff: '截止区', subthreshold: '亚阈值区', triode: '线性/三极管区',
    saturation: '饱和区'
  };
  const REGION_EN = {
    cutoff: 'CUTOFF', subthreshold: 'SUBTHRESHOLD', triode: 'TRIODE',
    saturation: 'SATURATION'
  };
  const REGION_COLOR = {
    cutoff: '#64748b', subthreshold: '#38bdf8', triode: '#f59e0b',
    saturation: '#34d399'
  };

  return { simulate, sweepVgs, pickBin, keyFor, REGION_CN, REGION_EN, REGION_COLOR, VT, EPSOX };
});
