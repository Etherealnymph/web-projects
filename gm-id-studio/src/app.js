/* ============================================================
   GM/ID STUDIO application
   ============================================================ */
(function () {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const nf = (x, d) => Number(x).toFixed(d == null ? 2 : d);

  const E = window.CmosEngine;
  const CM = window.CmosModel;
  const VDD = () => (state.domain === '3.3' ? 3.3 : 1.8);
  const LMIN = () => (state.domain === '3.3' ? 0.35 : 0.18);
  const WMIN = 0.24, WMAX = 100;
  const MAX_SWEEP = 1201;

  const COLORS = ['#5eead4', '#fbbf24', '#f472b6', '#a78bfa', '#60a5fa', '#34d399', '#fb923c', '#e879f9', '#f87171', '#22d3ee'];
  const CORNER_NAMES = { TT: 'Typical', FF: 'Fast-Fast', SS: 'Slow-Slow', SF: 'Slow-Fast', FS: 'Fast-Slow' };

  const METRICS = {
    Vgs: { label: 'VGS', unit: 'V', get: p => p.Vgs, fmt: v => nf(v, 3) },
    Id: { label: 'ID', unit: 'A', get: p => p.Id, fmt: fmtCurrent },
    Id_uA: { label: 'ID', unit: 'µA', get: p => p.Id * 1e6, fmt: v => nf(v, 3) },
    IdW: { label: 'ID/W', unit: 'µA/µm', get: p => p.IdW, fmt: v => nf(v, 3) },
    gm: { label: 'gm', unit: 'S', get: p => p.gm, fmt: fmtGm },
    gm_uS: { label: 'gm', unit: 'µS', get: p => p.gm * 1e6, fmt: v => nf(v, 3) },
    gds: { label: 'gds', unit: 'S', get: p => p.gds, fmt: fmtGm },
    gmid: { label: 'gm/ID', unit: '1/V', get: p => p.gmid, fmt: v => nf(v, 2) },
    gmro: { label: 'gm·ro', unit: 'V/V', get: p => p.gmro, fmt: v => nf(v, 1) },
    fT: { label: 'fT', unit: 'GHz', get: p => p.fT / 1e9, fmt: v => nf(v, 2) },
    Cgg: { label: 'Cgg', unit: 'fF', get: p => p.Cgg * 1e15, fmt: v => nf(v, 2) },
    Vth: { label: 'VTH', unit: 'V', get: p => p.Vth, fmt: v => nf(v, 3) },
    Vov: { label: 'VOV', unit: 'V', get: p => p.Vov, fmt: v => nf(v, 3) },
    Vdsat: { label: 'VDSAT', unit: 'V', get: p => p.Vdsat, fmt: v => nf(v, 3) },
    SS: { label: 'SS', unit: 'mV/dec', get: p => p.SS, fmt: v => nf(v, 1) },
    ro: { label: 'ro', unit: 'Ω', get: p => p.ro, fmt: fmtRes },
    gdsId: { label: 'gds/ID', unit: '1/V', get: p => p.gds / p.Id, fmt: v => nf(v, 4) }
  };

  const state = {
    corner: 'TT', device: 'n', domain: '1.8',
    L: 0.18, W: 10, Vgs: 0.7, Vds: 0.9, Vbs: 0,
    VgsMin: 0, VgsMax: 1.8, points: 401,
    view: 'vgs-gmid', logX: false, logY: false, grid: true,
    lsweep: [0.18, 0.24, 0.36, 0.5, 0.8, 1.2, 2.0],
    customVds: [0.2, 0.4, 0.6, 0.9, 1.2, 1.5],
    custom: { x: 'gmid', y: 'gmro', family: 'single', expr: '' },
    modalTab: 'params',
    selected: null,
    lastSeries: [],
    lastAxes: { x: METRICS.Vgs, y: METRICS.gmid }
  };

  let DB = null;
  let META = null;
  let PARSE_MS = 0;
  let plotStore = [];
  let miniPlots = [];
  let bootDone = false;
  let renderTimer = 0;
  let toastTimer = 0;
  let hoverTimer = 0;
  let customListMode = '';
  let plotEventsBound = false;

  /* ---------------- formatting ---------------- */
  function fmtCurrent(a) {
    if (!isFinite(a)) return '—';
    const x = Math.abs(a);
    if (x < 1e-12) return (a * 1e15).toFixed(2) + ' fA';
    if (x < 1e-9) return (a * 1e12).toFixed(2) + ' pA';
    if (x < 1e-6) return (a * 1e9).toFixed(2) + ' nA';
    if (x < 1e-3) return (a * 1e6).toFixed(2) + ' µA';
    return (a * 1e3).toFixed(3) + ' mA';
  }
  function fmtGm(s) {
    if (!isFinite(s)) return '—';
    const x = Math.abs(s);
    if (x < 1e-6) return (s * 1e9).toFixed(2) + ' nS';
    if (x < 1e-3) return (s * 1e6).toFixed(2) + ' µS';
    return (s * 1e3).toFixed(3) + ' mS';
  }
  function fmtRes(r) {
    if (!isFinite(r)) return '—';
    if (r < 1e3) return r.toFixed(1) + ' Ω';
    if (r < 1e6) return (r / 1e3).toFixed(2) + ' kΩ';
    return (r / 1e6).toFixed(2) + ' MΩ';
  }
  function fmtCap(f) {
    if (!isFinite(f)) return '—';
    if (f < 1e-12) return (f * 1e15).toFixed(2) + ' fF';
    if (f < 1e-9) return (f * 1e12).toFixed(2) + ' pF';
    return (f * 1e9).toFixed(2) + ' nF';
  }
  function fmtLenM(m) {
    if (m < 1e-6) return (m * 1e9).toFixed(0) + ' nm';
    return (m * 1e6).toFixed(2) + ' µm';
  }
  function fmtSci(x, d) {
    if (!isFinite(x)) return '—';
    return Number(x).toExponential(d == null ? 2 : d);
  }

  /* ---------------- boot ---------------- */
  function setBoot(pct, text) {
    const bar = $('#bootBar'), step = $('#bootStep');
    if (bar) bar.style.width = Math.max(0, Math.min(100, pct)) + '%';
    if (step && text) step.textContent = text;
  }
  function nextFrame() {
    return new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
  }

  async function gunzipBase64(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('当前浏览器不支持 DecompressionStream，请使用 Chrome / Edge 80+');
    }
    const ds = new DecompressionStream('gzip');
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    return await new Response(stream).text();
  }

  async function boot() {
    try {
      setBoot(8, '正在解压内嵌 rf018.scs …');
      const text = await gunzipBase64(window.RF018_GZIP_B64);
      setBoot(38, '正在解析 Spectre sections / parameters …');
      await nextFrame();
      const t0 = performance.now();
      DB = CM.parseSpectre(text, {
        file: 'rf018.scs',
        sha256: window.RF018_SHA256 || '',
        bytes: window.RF018_BYTES || 0
      });
      PARSE_MS = performance.now() - t0;
      META = DB.source;
      setBoot(78, '正在建立 BSIM3 binned model card …');
      await nextFrame();
      if (!DB.corners.TT || !DB.corners.TT.devices.nch) throw new Error('模型中没有找到 TT / nch binned model');
      $('#app').hidden = false;
      initUI();
      setBoot(100, '模型就绪 · ' + PARSE_MS.toFixed(0) + ' ms');
      await nextFrame();
      requestAnimationFrame(() => { if (window.Plotly) Plotly.Plots.resize($('#plot')); });
      setTimeout(() => {
        $('#boot').classList.add('gone');
        bootDone = true;
      }, 280);
    } catch (err) {
      console.error(err);
      setBoot(100, '解析失败：' + err.message);
      $('#bootStep').style.color = '#fb7185';
    }
  }

  /* ---------------- state / simulation ---------------- */
  function simOpts(overrides) {
    return Object.assign({
      corner: state.corner,
      domain: state.domain,
      device: state.device,
      L: state.L * 1e-6,
      W: state.W * 1e-6,
      Vgs: state.Vgs,
      Vds: state.Vds,
      Vbs: state.Vbs
    }, overrides || {});
  }

  function biasPoint() {
    try { return E.simulate(DB, simOpts()); }
    catch (err) { console.warn(err); return null; }
  }

  function activePoint() {
    return state.selected || biasPoint();
  }

  function binIndex(bin) {
    if (!bin) return 0;
    const k = E.keyFor(state.corner, state.domain, state.device);
    const arr = DB.corners[k.cornerKey] && DB.corners[k.cornerKey].devices[k.devKey];
    return arr ? arr.indexOf(bin) + 1 : 0;
  }

  function cornerKeyFor(dev) {
    return E.keyFor(state.corner, state.domain, dev || state.device);
  }

  function activeBins() {
    const k = cornerKeyFor();
    const c = DB.corners[k.cornerKey];
    return (c && c.devices[k.devKey]) || [];
  }

  /* ---------------- UI sync ---------------- */
  function setSegmented(sel, value) {
    $$(sel + ' button').forEach(b => b.classList.toggle('active', b.dataset.value === String(value)));
  }

  function sliderFromW(w) {
    const t = Math.log(clamp(w, WMIN, WMAX) / WMIN) / Math.log(WMAX / WMIN);
    return t * 100;
  }
  function wFromSlider(v) {
    return WMIN * Math.pow(WMAX / WMIN, v / 100);
  }
  function prettyW(w) {
    if (w < 1) return w.toFixed(2);
    if (w < 10) return w.toFixed(2).replace(/\.?0+$/, '');
    return w.toFixed(1).replace(/\.0$/, '');
  }
  function prettyL(l) {
    return l.toFixed(2).replace(/0$/, '').replace(/\.$/, '');
  }

  function syncInputs() {
    const vdd = VDD();
    const lmin = LMIN();
    state.L = clamp(state.L, lmin, 20);
    state.W = clamp(state.W, WMIN, 900);
    state.Vgs = clamp(state.Vgs, 0, vdd);
    state.Vds = clamp(state.Vds, 0, vdd);
    state.Vbs = clamp(state.Vbs, 0, vdd / 2);
    state.VgsMin = clamp(state.VgsMin, 0, vdd);
    state.VgsMax = clamp(state.VgsMax, 0.1, vdd);
    if (state.VgsMax <= state.VgsMin) state.VgsMax = vdd;

    $('#LInput').value = prettyL(state.L);
    $('#LRange').min = lmin;
    $('#LRange').max = state.domain === '3.3' ? 3.3 : 2.0;
    $('#LRange').value = clamp(state.L, lmin, Number($('#LRange').max));
    $('#LminHint').textContent = lmin.toFixed(2) + ' µm';
    $('#LmaxHint').textContent = (state.domain === '3.3' ? '3.3' : '2.0') + ' µm';
    $('#LInput').min = lmin;

    $('#WInput').value = prettyW(state.W);
    $('#WRange').value = sliderFromW(state.W);

    $('#VgsInput').max = vdd;
    $('#VgsInput').value = nf(state.Vgs, 3);
    $('#VgsRange').max = vdd;
    $('#VgsRange').value = state.Vgs;

    $('#VdsInput').max = vdd;
    $('#VdsInput').value = nf(state.Vds, 2);
    $('#VdsRange').max = vdd;
    $('#VdsRange').value = state.Vds;

    $('#VbsInput').max = nf(vdd / 2, 2);
    $('#VbsInput').value = nf(state.Vbs, 2);
    $('#VbsRange').max = nf(vdd / 2, 2);
    $('#VbsRange').value = state.Vbs;

    $('#VgsMin').max = vdd;
    $('#VgsMin').value = nf(state.VgsMin, 3);
    $('#VgsMax').max = vdd;
    $('#VgsMax').value = nf(state.VgsMax, 3);

    $('#vgsSym').innerHTML = state.device === 'p' ? '|V<sub>GS</sub>|' : 'V<sub>GS</sub>';
    $('#vgsLabel').textContent = state.device === 'p' ? '栅源电压' : '栅源电压';

    setSegmented('#cornerSeg', state.corner);
    setSegmented('#deviceSeg', state.device);
    setSegmented('#domainSeg', state.domain);

    $('#topCorner').textContent = state.corner;
    $('#topDevice').textContent = state.device === 'p' ? 'PMOS' : 'NMOS';
    $('#topVdd').textContent = vdd.toFixed(1) + ' V';
    $('#cornerNote').textContent = CORNER_NAMES[state.corner] + ' · ' + (state.device === 'p' ? 'PMOS' : 'NMOS') + ' · ' + (state.domain === '3.3' ? '3.3 V I/O' : '1.8 V core');

    $('#statusL').textContent = prettyL(state.L);
    $('#statusW').textContent = prettyW(state.W);
    $('#statusVds').textContent = nf(state.Vds, 2);
    $('#statusPoints').textContent = state.points + ' pts';
  }

  function updateActiveButtons() {
    $$('#viewTabs button').forEach(b => b.classList.toggle('active', b.dataset.view === state.view));
    $('#btnLogX').classList.toggle('active', state.logX);
    $('#btnLogY').classList.toggle('active', state.logY);
    $('#btnGrid').classList.toggle('active', state.grid);
    $('#lsweepBar').hidden = state.view !== 'lsweep';
    $('#customBar').hidden = state.view !== 'custom';
  }

  /* ---------------- live values ---------------- */
  function metricForView(view, p) {
    if (view === 'gmid-gmro' || view === 'lsweep') {
      return { x: METRICS.gmid, y: METRICS.gmro };
    }
    if (view === 'gmid-idw') {
      return { x: METRICS.gmid, y: METRICS.IdW };
    }
    if (view === 'custom') {
      return {
        x: METRICS[state.custom.x] || METRICS.gmid,
        y: state.custom.expr ? { label: state.custom.expr, unit: '', get: q => evalCustom(state.custom.expr, q) } : (METRICS[state.custom.y] || METRICS.gmro)
      };
    }
    return { x: METRICS.Vgs, y: METRICS.gmid };
  }

  function updateLive() {
    const p = activePoint();
    if (!p) return;
    const viewMetrics = metricForView(state.view, p);
    state.lastAxes = viewMetrics;
    const xv = viewMetrics.x.get(p);
    const yv = viewMetrics.y.get(p);
    const locked = !!state.selected;

    $('#probeXLabel').innerHTML = labelHTML(viewMetrics.x.label);
    $('#probeYLabel').innerHTML = labelHTML(viewMetrics.y.label);
    $('#probeX').textContent = isFinite(xv) ? (viewMetrics.x.fmt ? viewMetrics.x.fmt(xv) : nf(xv, 3)) : '—';
    $('#probeY').textContent = isFinite(yv) ? (viewMetrics.y.fmt ? viewMetrics.y.fmt(yv) : nf(yv, 3)) : '—';
    $('#probeX').nextElementSibling.textContent = viewMetrics.x.unit || '';
    $('#probeY').nextElementSibling.textContent = viewMetrics.y.unit || '';

    $('#statVth').textContent = nf(p.Vth, 3);
    $('#statGmid').textContent = nf(p.gmid, 2);
    $('#statGmro').textContent = nf(p.gmro, 1);
    $('#statIdw').textContent = p.IdW < 0.01 ? p.IdW.toExponential(2) : nf(p.IdW, 2);
    $('#statFt').textContent = p.fT < 1e6 ? nf(p.fT / 1e9, 2) : nf(p.fT / 1e9, 2);
    $('#statVthSub').textContent = 'VSB ' + nf(p.Vbs, 2) + ' V · DIBL ' + nf(p.dibl * 1000, 1) + ' mV/V';
    $('#statGmidSub').textContent = 'n = ' + nf(p.n, 2) + ' · SS ' + nf(p.SS, 0) + ' mV/dec';
    $('#statGmroSub').textContent = 'ro = ' + fmtRes(p.ro);
    $('#statIdwSub').textContent = 'ID = ' + fmtCurrent(p.Id);
    $('#statFtSub').textContent = 'Cgg = ' + nf(p.Cgg * 1e15, 2) + ' fF';

    $('#lockBadge').textContent = locked ? '已锁定' : '实时偏置';
    $('#lockBadge').classList.toggle('locked', locked);

    const badge = $('#regionBadge');
    const col = E.REGION_COLOR[p.region] || '#64748b';
    badge.style.color = col;
    badge.style.borderColor = hexA(col, 0.28);
    badge.style.background = hexA(col, 0.075);
    badge.querySelector('span').textContent = E.REGION_CN[p.region] || p.region;
    badge.querySelector('em').textContent = E.REGION_EN[p.region] || '';

    $('#pId').textContent = p.Id < 1e-6 ? (p.Id * 1e9).toFixed(2) : (p.Id * 1e6).toFixed(2);
    $('#pId').nextElementSibling.textContent = p.Id < 1e-6 ? 'nA' : 'µA';
    $('#pGm').textContent = (p.gm * 1e6).toFixed(2);
    $('#pGds').textContent = (p.gds * 1e6).toFixed(3);
    $('#pIdw').textContent = p.IdW < 0.01 ? p.IdW.toExponential(2) : p.IdW.toFixed(2);
    $('#pVov').textContent = nf(p.Vov, 3);
    $('#pVdsat').textContent = nf(p.Vdsat, 3);
    $('#pSs').textContent = nf(p.SS, 0);
    $('#pFt').textContent = nf(p.fT / 1e9, 2);

    const idx = binIndex(p.bin);
    const bin = p.bin;
    $('#binTag').textContent = 'BIN ' + idx;
    $('#binTag2').textContent = 'BIN ' + idx;
    $('#statusBin').textContent = 'BIN ' + idx + ' · ' + (state.domain === '3.3' ? (state.device === 'p' ? 'pch3' : 'nch3') : (state.device === 'p' ? 'pch' : 'nch'));
    $('#binDevice').textContent = state.domain === '3.3' ? (state.device === 'p' ? 'pch3' : 'nch3') : (state.device === 'p' ? 'pch' : 'nch');
    $('#binL').textContent = fmtLenM(bin.lmin) + ' – ' + fmtLenM(bin.lmax);
    $('#binW').textContent = fmtLenM(bin.wmin) + ' – ' + fmtLenM(bin.wmax);
    $('#binVth').textContent = (bin.type === 'p' ? '−' : '') + Math.abs(bin.vth0).toFixed(3) + ' V';
    $('#binU0').textContent = (bin.u0 * 1e4).toFixed(0) + ' cm²/Vs';
    $('#binTox').textContent = (bin.tox * 1e9).toFixed(2) + ' nm';
    $('#binVsat').textContent = fmtSci(bin.vsat * 100, 2) + ' cm/s';

    drawRegionMap(p);
    updateStatus(p);
  }

  function labelHTML(label) {
    return String(label)
      .replace(/VGS/g, 'V<sub>GS</sub>')
      .replace(/VDSAT/g, 'V<sub>DSAT</sub>')
      .replace(/VOV/g, 'V<sub>OV</sub>')
      .replace(/VTH/g, 'V<sub>TH</sub>')
      .replace(/ID\/W/g, 'ID/W')
      .replace(/gm·ro/g, 'gm·ro')
      .replace(/gm\/ID/g, 'gm/ID')
      .replace(/fT/g, 'f<sub>T</sub>');
  }

  function hexA(hex, a) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function updateStatus(p) {
    const msg = state.selected
      ? '已锁定工作点 · 点击“解除锁定”返回实时偏置'
      : '实时偏置 · 模型 ' + (META ? META.file : 'rf018.scs') + ' · 解析 ' + PARSE_MS.toFixed(0) + ' ms';
    $('#statusMsg').textContent = msg;
    if (p) {
      $('#statusL').textContent = prettyL(p.L * 1e6);
      $('#statusW').textContent = prettyW(p.W * 1e6);
      $('#statusVds').textContent = nf(p.Vds, 2);
    }
  }

  /* ---------------- region map ---------------- */
  function drawRegionMap(p) {
    const svg = $('#regionMap');
    if (!svg) return;
    const W = 260, H = 150, padL = 25, padR = 9, padT = 9, padB = 18;
    const vdd = VDD();
    const vth = p.Vth;
    const x = v => padL + (clamp(v, 0, vdd) / vdd) * (W - padL - padR);
    const y = v => padT + (1 - clamp(v, 0, vdd) / vdd) * (H - padT - padB);
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const xCut = x(Math.max(0, vth - 0.12));
    const xSub = x(Math.min(vdd, vth + 0.05));

    let shapes = '';
    shapes += `<rect x="${padL}" y="${padT}" width="${Math.max(0, xCut - padL)}" height="${plotH}" fill="${hexA('#64748b', 0.14)}"/>`;
    shapes += `<rect x="${xCut}" y="${padT}" width="${Math.max(0, xSub - xCut)}" height="${plotH}" fill="${hexA('#38bdf8', 0.14)}"/>`;

    // boundary Vdsat(Vgs) for the saturation / triode split
    const boundary = [];
    const n = 34;
    for (let i = 0; i <= n; i++) {
      const vg = Math.min(vdd, Math.max(vth + 0.05, (vth + 0.05) + (vdd - (vth + 0.05)) * i / n));
      let vdsat = vdd;
      try {
        const q = E.simulate(DB, simOpts({ Vgs: vg, Vds: Math.min(vdd * 0.5, vdd) }));
        vdsat = q.Vdsat;
      } catch (e) { /* ignore */ }
      boundary.push([x(vg), y(Math.min(vdsat, vdd))]);
    }
    if (boundary.length) {
      const topRight = `${x(vdd)},${padT}`;
      const topLeft = `${boundary[0][0]},${padT}`;
      const polySat = boundary.map(pt => pt.join(',')).join(' ') + ` ${topRight} ${topLeft}`;
      shapes += `<polygon points="${polySat}" fill="${hexA('#34d399', 0.14)}"/>`;
      const polyTri = boundary.map(pt => pt.join(',')).join(' ') + ` ${x(vdd)},${padT + plotH} ${boundary[0][0]},${padT + plotH}`;
      shapes += `<polygon points="${polyTri}" fill="${hexA('#f59e0b', 0.13)}"/>`;
      shapes += `<polyline points="${boundary.map(pt => pt.join(',')).join(' ')}" fill="none" stroke="${hexA('#94a3b8', 0.35)}" stroke-width="0.8" stroke-dasharray="3 3"/>`;
    }

    // axes / grid
    let grid = '';
    for (let i = 0; i <= 4; i++) {
      const gx = padL + (plotW * i) / 4;
      const gy = padT + (plotH * i) / 4;
      grid += `<line x1="${gx}" y1="${padT}" x2="${gx}" y2="${padT + plotH}" stroke="${hexA('#94a3b8', 0.07)}"/>`;
      grid += `<line x1="${padL}" y1="${gy}" x2="${padL + plotW}" y2="${gy}" stroke="${hexA('#94a3b8', 0.07)}"/>`;
    }
    const labels = `
      <text x="${padL - 5}" y="${padT + 7}" text-anchor="end" font-size="6" fill="#647984">${vdd.toFixed(1)}V</text>
      <text x="${padL - 5}" y="${padT + plotH}" text-anchor="end" font-size="6" fill="#647984">0</text>
      <text x="${padL}" y="${padT + plotH + 10}" text-anchor="middle" font-size="6" fill="#647984">0</text>
      <text x="${padL + plotW}" y="${padT + plotH + 10}" text-anchor="middle" font-size="6" fill="#647984">${vdd.toFixed(1)}V</text>
      <text x="${padL + plotW - 2}" y="${padT + 9}" text-anchor="end" font-size="6" fill="${hexA('#34d399', 0.8)}">SAT</text>
      <text x="${xSub + 3}" y="${padT + plotH - 4}" font-size="6" fill="${hexA('#f59e0b', 0.8)}">TRIODE</text>
      <text x="${Math.max(padL + 3, xSub - 20)}" y="${padT + plotH - 4}" font-size="6" fill="${hexA('#38bdf8', 0.8)}">SUB</text>
    `;

    const px = x(p.Vgs), py = y(p.Vds);
    const dot = `
      <line x1="${px}" y1="${padT}" x2="${px}" y2="${padT + plotH}" stroke="${hexA('#5eead4', 0.28)}" stroke-width="0.7" stroke-dasharray="2 2"/>
      <line x1="${padL}" y1="${py}" x2="${padL + plotW}" y2="${py}" stroke="${hexA('#5eead4', 0.2)}" stroke-width="0.7" stroke-dasharray="2 2"/>
      <circle cx="${px}" cy="${py}" r="4.2" fill="${hexA('#5eead4', 0.16)}" stroke="#5eead4" stroke-width="1.2"/>
      <circle cx="${px}" cy="${py}" r="1.5" fill="#d7fff8"/>
    `;
    svg.innerHTML = `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#rmapbg)"/>
      <defs><linearGradient id="rmapbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#08131b"/><stop offset="1" stop-color="#050c11"/></linearGradient></defs>
      ${grid}${shapes}${labels}${dot}
      <rect x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" fill="none" stroke="${hexA('#94a3b8', 0.18)}"/>`;
  }

  /* ---------------- chart helpers ---------------- */
  function axisStyle(title, opts) {
    const o = opts || {};
    const grid = state.grid ? 'rgba(148,193,209,.085)' : 'rgba(0,0,0,0)';
    return Object.assign({
      title: { text: title, font: { size: 9, color: '#8aa0aa' }, standoff: 8 },
      gridcolor: grid,
      zerolinecolor: grid,
      linecolor: 'rgba(148,193,209,.16)',
      tickfont: { family: 'JetBrains Mono, Consolas, monospace', size: 8, color: '#7f96a0' },
      ticks: 'outside',
      ticklen: 3,
      tickwidth: 1,
      tickcolor: 'rgba(148,193,209,.18)',
      showline: true,
      mirror: false,
      automargin: true
    }, o);
  }

  function baseLayout(opts) {
    const o = opts || {};
    const layout = {
      autosize: true,
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: '#081018',
      font: { family: 'Inter, Segoe UI, Microsoft YaHei, sans-serif', size: 9, color: '#9fb3bd' },
      margin: o.margin || { l: 62, r: 24, t: 28, b: 48 },
      hovermode: 'closest',
      dragmode: 'pan',
      showlegend: o.showlegend !== false,
      legend: {
        orientation: 'h', x: 0.01, y: 1.02, xanchor: 'left', yanchor: 'bottom',
        bgcolor: 'rgba(8,16,24,.55)', bordercolor: 'rgba(148,193,209,.12)', borderwidth: 1,
        font: { size: 8, color: '#aec4cc' }, itemsizing: 'constant', itemwidth: 30
      },
      xaxis: axisStyle(o.xTitle || '', Object.assign({}, o.xaxis || {}, o.logX ? { type: 'log' } : {})),
      yaxis: axisStyle(o.yTitle || '', Object.assign({}, o.yaxis || {}, o.logY ? { type: 'log' } : {})),
      hoverlabel: { bgcolor: '#0b1a23', bordercolor: 'rgba(94,234,212,.35)', font: { family: 'JetBrains Mono, Consolas, monospace', size: 9, color: '#e6f0f4' } },
      uirevision: o.uirevision || state.view,
      shapes: o.shapes || [],
      annotations: o.annotations || []
    };
    if (o.y2Title) {
      layout.yaxis2 = axisStyle(o.y2Title, Object.assign({
        overlaying: 'y', side: 'right', type: 'log', showgrid: false, zeroline: false
      }, o.y2axis || {}));
      layout.margin.r = 68;
    }
    return layout;
  }

  const PLOT_CONFIG = { displayModeBar: false, responsive: true, scrollZoom: true, doubleClick: 'reset', displaylogo: false };

  function clearPlotArea() {
    if (miniPlots.length) {
      miniPlots.forEach(id => { const el = document.getElementById(id); if (el) { try { Plotly.purge(el); } catch (e) {} } });
      miniPlots = [];
    }
    $('#libraryGrid').hidden = true;
    $('#plotEmpty').hidden = true;
    $('#plot').hidden = false;
  }

  function register(points, meta) {
    const idx = plotStore.length;
    plotStore.push({ points: points, meta: meta || {} });
    return points.map((p, i) => [idx, i]);
  }

  function lineTrace(x, y, name, color, opts) {
    const o = opts || {};
    return Object.assign({
      x: x, y: y, type: 'scatter', mode: 'lines', name: name,
      line: { color: color, width: 2.0, shape: 'linear' },
      hovertemplate: o.hovertemplate || (name + '<br>%{x:.3g}, %{y:.3g}<extra></extra>'),
      hoverinfo: 'text',
      connectgaps: false
    }, o.extra || {});
  }

  function markerTrace(x, y, name, color, symbol, size, extra) {
    return Object.assign({
      x: x, y: y, type: 'scatter', mode: 'markers', name: name,
      marker: { color: color, size: size || 9, symbol: symbol || 'circle-open', line: { color: color, width: 1.5 } },
      hovertemplate: name + '<br>%{x:.3g}, %{y:.3g}<extra></extra>',
      hoverinfo: 'skip',
      hovertemplate: null,
      showlegend: false
    }, extra || {});
  }

  function regionBands(points, vdd) {
    const bands = [];
    let cur = null;
    for (const p of points) {
      if (!cur || cur.region !== p.region) {
        if (cur) bands.push(cur);
        cur = { region: p.region, x0: p.Vgs, x1: p.Vgs };
      } else {
        cur.x1 = p.Vgs;
      }
    }
    if (cur) bands.push(cur);
    return bands.filter(b => b.x1 - b.x0 > vdd * 0.018);
  }

  function bandShapes(bands, vdd, opts) {
    const o = opts || {};
    const shapes = [], annotations = [];
    for (const b of bands) {
      const col = E.REGION_COLOR[b.region] || '#64748b';
      shapes.push({
        type: 'rect', xref: 'x', yref: 'paper', x0: b.x0, x1: b.x1, y0: 0, y1: 1,
        fillcolor: hexA(col, 0.055), line: { width: 0 }, layer: 'below'
      });
      if (o.labels !== false && b.x1 - b.x0 > vdd * 0.12) {
        annotations.push({
          x: (b.x0 + b.x1) / 2, y: 1.015, xref: 'x', yref: 'paper',
          text: E.REGION_CN[b.region], showarrow: false,
          font: { size: 7, color: hexA(col, 0.95) }, yanchor: 'bottom'
        });
      }
    }
    return { shapes, annotations };
  }

  function crosshair(x, y, xUnit, yUnit) {
    if (x == null || y == null || !isFinite(x) || !isFinite(y)) return { shapes: [], annotations: [] };
    const shapes = [
      { type: 'line', x0: x, x1: x, y0: 0, y1: 1, yref: 'paper', line: { color: 'rgba(94,234,212,.38)', width: 1, dash: 'dot' } },
      { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: y, y1: y, line: { color: 'rgba(94,234,212,.28)', width: 1, dash: 'dot' } }
    ];
    const annotations = [{
      x: x, y: y, xref: 'x', yref: 'y', text: '(' + fmtAxis(x) + (xUnit || '') + ', ' + fmtAxis(y) + (yUnit || '') + ')',
      showarrow: true, arrowhead: 0, arrowwidth: 0.6, arrowcolor: 'rgba(94,234,212,.6)',
      ax: 16, ay: -18, bgcolor: 'rgba(6,17,24,.9)', bordercolor: 'rgba(94,234,212,.28)', borderwidth: 1,
      font: { family: 'JetBrains Mono, Consolas, monospace', size: 8, color: '#d7fff8' },
      xanchor: 'left', yanchor: 'bottom'
    }];
    return { shapes, annotations };
  }

  function fmtAxis(v) {
    if (!isFinite(v)) return '—';
    const a = Math.abs(v);
    if (a === 0) return '0';
    if (a >= 1000) return v.toExponential(2);
    if (a < 0.01) return v.toExponential(2);
    return Number(v.toFixed(3)).toString();
  }

  function thresholdShape(vth) {
    return {
      type: 'line', x0: vth, x1: vth, y0: 0, y1: 1, yref: 'paper',
      line: { color: 'rgba(251,191,36,.42)', width: 1, dash: 'dot' }
    };
  }

  /* ---------------- main render ---------------- */
  function renderAll(opts) {
    const o = opts || {};
    if (!DB) return;
    syncInputs();
    updateActiveButtons();
    updateLive();
    if (state.view === 'library') {
      clearPlotArea();
      $('#plot').hidden = true;
      $('#libraryGrid').hidden = false;
      renderLibrary();
      return;
    }
    clearPlotArea();
    $('#plot').hidden = false;
    if (state.view === 'vgs-gmid') renderVgsGmid();
    else if (state.view === 'gmid-gmro') renderGmidGmro();
    else if (state.view === 'lsweep') renderLsweep();
    else if (state.view === 'gmid-idw') renderGmidIdw();
    else if (state.view === 'custom') renderCustom();
    updateLive();
    if (o.status) $('#statusMsg').textContent = o.status;
  }

  function scheduleRender() {
    if (renderTimer) cancelAnimationFrame(renderTimer);
    renderTimer = requestAnimationFrame(() => {
      renderTimer = 0;
      renderAll();
    });
  }

  function renderVgsGmid() {
    const pts = E.sweepVgs(DB, simOpts(), state.points).filter(p => p.Id > 1e-11 && isFinite(p.gmid) && (!state.logX || p.Vgs > 1e-3));
    if (!pts.length) return emptyPlot('没有有效数据点');
    const vdd = VDD();
    plotStore = [];
    const cd = register(pts, { view: 'vgs-gmid' });
    const x = pts.map(p => p.Vgs);
    const y = pts.map(p => p.gmid);
    const bi = biasPoint();
    const sel = state.selected;
    const maxGmid = Math.max(4, Math.max.apply(null, y));
    const bands = regionBands(pts, vdd);
    const bs = bandShapes(bands, vdd);
    const shapes = bs.shapes.slice();
    const annotations = bs.annotations.slice();
    if (bi) {
      shapes.push(thresholdShape(bi.Vth));
      annotations.push({
        x: bi.Vth, y: 1.015, xref: 'x', yref: 'paper', text: 'VTH ' + nf(bi.Vth, 3) + ' V',
        showarrow: false, font: { size: 7, color: 'rgba(251,191,36,.9)' }, yanchor: 'bottom'
      });
    }
    const traces = [];
    traces.push(lineTrace(x, y, 'gm/ID', '#5eead4', {
      extra: { customdata: cd, hovertemplate: 'VGS %{x:.3f} V<br>gm/ID %{y:.2f} 1/V<extra></extra>' }
    }));
    const idPts = pts.filter(p => p.Id > 1e-13);
    traces.push(lineTrace(idPts.map(p => p.Vgs), idPts.map(p => p.Id), 'ID', '#fbbf24', {
      extra: {
        customdata: register(idPts, { view: 'vgs-gmid' }),
        yaxis: 'y2',
        line: { color: 'rgba(251,191,36,.55)', width: 1.2, dash: 'dot' },
        hovertemplate: 'VGS %{x:.3f} V<br>ID %{y:.3e} A<extra></extra>'
      }
    }));
    if (bi) traces.push(markerTrace([bi.Vgs], [bi.gmid], '实时偏置', 'rgba(251,191,36,.9)', 'circle-open', 9));
    if (sel) {
      traces.push(markerTrace([sel.Vgs], [sel.gmid], '锁定点', '#ffffff', 'diamond', 9, { marker: { color: '#fbbf24', size: 8, symbol: 'diamond', line: { color: '#fff', width: 1.2 } } }));
      const ch = crosshair(sel.Vgs, sel.gmid, ' V', ' 1/V');
      shapes.push.apply(shapes, ch.shapes);
      annotations.push.apply(annotations, ch.annotations);
    }
    const layout = baseLayout({
      xTitle: (state.device === 'p' ? '|VGS|' : 'VGS') + '  (V)',
      yTitle: 'gm/ID  (1/V)',
      y2Title: 'ID  (A)',
      logX: state.logX,
      logY: state.logY,
      shapes: shapes,
      annotations: annotations,
      margin: { l: 60, r: 68, t: 30, b: 46 },
      xaxis: { range: state.logX ? [1e-3, vdd] : [0, vdd] },
      yaxis: state.logY ? { range: [0.1, maxGmid * 1.12] } : { range: [0, maxGmid * 1.12] },
      y2axis: { range: [-12, 0] }
    });
    layout.yaxis2.tickformat = '.0e';
    Plotly.react($('#plot'), traces, layout, PLOT_CONFIG);
    state.lastSeries = [{ name: 'VGS–gm/ID', points: pts }];
    state.lastAxes = { x: METRICS.Vgs, y: METRICS.gmid };
    setTitle((state.device === 'p' ? '|V<sub>GS</sub>|' : 'V<sub>GS</sub>') + ' → GM/ID', '固定 V<sub>DS</sub> 扫描栅压 · 着色区域为管子工作区 · 右轴为 ID');
  }

  function renderGmidGmro() {
    const pts = E.sweepVgs(DB, simOpts(), state.points).filter(p => p.Id > 1e-8 && p.gmid > 1.2 && p.gmid < 1e6 && p.gmro > 0 && p.region !== 'triode' && p.Vdsat < p.Vds - 0.03);
    if (!pts.length) return emptyPlot('没有有效数据点');
    const vdd = VDD();
    plotStore = [];
    const cd = register(pts, { view: 'gmid-gmro' });
    const x = pts.map(p => p.gmid);
    const y = pts.map(p => p.gmro);
    const maxX = Math.max(32, Math.max.apply(null, x) * 1.02);
    const maxY = Math.max(10, Math.max.apply(null, y) * 1.12);
    const bands = [
      { x0: 20, x1: maxX, name: '弱反型', col: '#38bdf8' },
      { x0: 8, x1: Math.min(20, maxX), name: '中等反型', col: '#5eead4' },
      { x0: 0, x1: Math.min(8, maxX), name: '强反型', col: '#fbbf24' }
    ].filter(b => b.x1 > b.x0);
    const shapes = [], annotations = [];
    bands.forEach(b => {
      shapes.push({ type: 'rect', xref: 'x', yref: 'paper', x0: b.x0, x1: b.x1, y0: 0, y1: 1, fillcolor: hexA(b.col, 0.045), line: { width: 0 }, layer: 'below' });
      if (b.x1 - b.x0 > 3) annotations.push({ x: (b.x0 + b.x1) / 2, y: 1.015, xref: 'x', yref: 'paper', text: b.name, showarrow: false, font: { size: 7, color: hexA(b.col, 0.9) }, yanchor: 'bottom' });
    });
    const sel = state.selected;
    if (sel) {
      const ch = crosshair(sel.gmid, sel.gmro, ' 1/V', '');
      shapes.push.apply(shapes, ch.shapes);
      annotations.push.apply(annotations, ch.annotations);
    }
    const traces = [{
      x: x, y: y, type: 'scatter', mode: 'lines+markers', name: 'gm/ID – gm·ro',
      line: { color: 'rgba(94,234,212,.3)', width: 1.0 },
      marker: { color: pts.map(p => E.REGION_COLOR[p.region] || '#64748b'), size: 3.6, line: { width: 0 } },
      customdata: cd,
      hovertemplate: 'gm/ID %{x:.2f} 1/V<br>gm·ro %{y:.1f}<extra></extra>'
    }];
    if (sel) traces.push(markerTrace([sel.gmid], [sel.gmro], '锁定点', '#fbbf24', 'diamond', 9, { marker: { color: '#fbbf24', size: 8, symbol: 'diamond', line: { color: '#fff', width: 1.1 } } }));
    const layout = baseLayout({
      xTitle: 'gm/ID  (1/V)', yTitle: 'gm·ro  (V/V)',
      logX: state.logX, logY: state.logY,
      shapes: shapes, annotations: annotations,
      margin: { l: 60, r: 22, t: 30, b: 46 },
      xaxis: { range: state.logX ? [0.5, maxX] : [0, maxX] }, yaxis: state.logY ? { range: [1, maxY] } : { range: [0, maxY] }
    });
    Plotly.react($('#plot'), traces, layout, PLOT_CONFIG);
    state.lastSeries = [{ name: 'GM/ID–GM·RO', points: pts }];
    state.lastAxes = { x: METRICS.gmid, y: METRICS.gmro };
    setTitle('GM/ID → GM·RO', '固定 L、W 与 V<sub>DS</sub> · 点颜色表示工作区 · 越靠右越接近弱反型');
  }

  function renderLsweep() {
    const vdd = VDD();
    const lmin = LMIN();
    const list = state.lsweep.map(Number).filter(v => isFinite(v) && v >= lmin && v <= 20).sort((a, b) => a - b);
    if (!list.length) return emptyPlot('L 扫描列表为空');
    plotStore = [];
    const traces = [];
    const all = [];
    list.forEach((L, i) => {
      const pts = E.sweepVgs(DB, simOpts({ L: L * 1e-6 }), 301).filter(p => p.Id > 1e-8 && p.gmid > 1.2 && p.gmro > 0 && p.region !== 'triode' && p.Vdsat < p.Vds - 0.03);
      if (!pts.length) return;
      all.push({ L: L, points: pts });
      const hue = 168 + (i / Math.max(1, list.length - 1)) * 118;
      const color = 'hsl(' + hue + ',72%,64%)';
      const cd = register(pts, { view: 'lsweep', L: L });
      traces.push({
        x: pts.map(p => p.gmid), y: pts.map(p => p.gmro), type: 'scatter', mode: 'lines',
        name: 'L = ' + prettyL(L) + ' µm',
        line: { color: color, width: Math.abs(L - state.L) < 1e-4 ? 3.2 : 1.8 },
        customdata: cd,
        hovertemplate: 'L ' + prettyL(L) + ' µm<br>gm/ID %{x:.2f} 1/V<br>gm·ro %{y:.1f}<extra></extra>'
      });
    });
    if (!traces.length) return emptyPlot('没有有效数据点');
    const allX = [], allY = [];
    all.forEach(s => s.points.forEach(p => { allX.push(p.gmid); allY.push(p.gmro); }));
    const maxX = Math.max(32, Math.max.apply(null, allX) * 1.02);
    const maxY = Math.max(20, Math.max.apply(null, allY) * 1.1);
    const shapes = [], annotations = [];
    const sel = state.selected;
    if (sel) {
      const ch = crosshair(sel.gmid, sel.gmro, ' 1/V', '');
      shapes.push.apply(shapes, ch.shapes);
      annotations.push.apply(annotations, ch.annotations);
    }
    annotations.push({
      x: 0.99, y: 0.03, xref: 'paper', yref: 'paper', text: 'W = ' + prettyW(state.W) + ' µm · VDS = ' + nf(state.Vds, 2) + ' V',
      showarrow: false, font: { size: 8, color: 'rgba(148,193,209,.65)', family: 'JetBrains Mono, monospace' },
      xanchor: 'right', yanchor: 'bottom'
    });
    const layout = baseLayout({
      xTitle: 'gm/ID  (1/V)', yTitle: 'gm·ro  (V/V)',
      logX: state.logX, logY: state.logY,
      shapes: shapes, annotations: annotations,
      margin: { l: 60, r: 22, t: 30, b: 46 },
      xaxis: { range: state.logX ? [0.5, maxX] : [0, maxX] }, yaxis: state.logY ? { range: [1, maxY] } : { range: [0, maxY] },
      showlegend: true
    });
    Plotly.react($('#plot'), traces, layout, PLOT_CONFIG);
    state.lastSeries = all.map(s => ({ name: 'L=' + prettyL(s.L) + 'µm', points: s.points }));
    state.lastAxes = { x: METRICS.gmid, y: METRICS.gmro };
    setTitle('GM/ID → GM·RO · L 扫描', '固定 W 与 V<sub>DS</sub>，每条曲线对应一个沟道长度 · 点击曲线可切换 L');
  }

  function renderGmidIdw() {
    const vdd = VDD();
    const pts = E.sweepVgs(DB, simOpts(), state.points).filter(p => p.Id > 1e-8 && p.gmid > 1.2 && p.IdW > 1e-7 && p.region !== 'triode' && p.Vdsat < p.Vds - 0.03);
    if (!pts.length) return emptyPlot('没有有效数据点');
    plotStore = [];
    const cd = register(pts, { view: 'gmid-idw' });
    const x = pts.map(p => p.gmid);
    const y = pts.map(p => p.IdW);
    const maxX = Math.max(32, Math.max.apply(null, x) * 1.02);
    const maxY = Math.max.apply(null, y) * 4;
    const bands = [
      { x0: 20, x1: maxX, name: '弱反型' },
      { x0: 8, x1: Math.min(20, maxX), name: '中等反型' },
      { x0: 0, x1: Math.min(8, maxX), name: '强反型' }
    ].filter(b => b.x1 > b.x0);
    const shapes = [], annotations = [];
    bands.forEach(b => {
      shapes.push({ type: 'rect', xref: 'x', yref: 'paper', x0: b.x0, x1: b.x1, y0: 0, y1: 1, fillcolor: hexA('#38bdf8', 0.03), line: { width: 0 }, layer: 'below' });
    });
    const sel = state.selected;
    if (sel) {
      const ch = crosshair(sel.gmid, sel.IdW, ' 1/V', ' µA/µm');
      shapes.push.apply(shapes, ch.shapes);
      annotations.push.apply(annotations, ch.annotations);
    }
    const traces = [{
      x: x, y: y, type: 'scatter', mode: 'lines+markers', name: 'gm/ID – ID/W',
      line: { color: 'rgba(251,191,36,.4)', width: 1.2 },
      marker: { color: pts.map(p => E.REGION_COLOR[p.region] || '#64748b'), size: 3.6, line: { width: 0 } },
      customdata: cd,
      hovertemplate: 'gm/ID %{x:.2f} 1/V<br>ID/W %{y:.3f} µA/µm<extra></extra>'
    }];
    if (sel) traces.push(markerTrace([sel.gmid], [sel.IdW], '锁定点', '#fbbf24', 'diamond', 9, { marker: { color: '#fbbf24', size: 8, symbol: 'diamond', line: { color: '#fff', width: 1.1 } } }));
    const layout = baseLayout({
      xTitle: 'gm/ID  (1/V)', yTitle: 'ID/W  (µA/µm)',
      logX: state.logX, logY: true,
      shapes: shapes, annotations: annotations,
      margin: { l: 64, r: 22, t: 30, b: 46 },
      xaxis: { range: [0, maxX] }, yaxis: { range: [-6, Math.log10(maxY)] }
    });
    layout.yaxis.type = 'log';
    Plotly.react($('#plot'), traces, layout, PLOT_CONFIG);
    state.lastSeries = [{ name: 'GM/ID–ID/W', points: pts }];
    state.lastAxes = { x: METRICS.gmid, y: METRICS.IdW };
    setTitle('GM/ID → ID/W', '电流密度设计图 · 对数纵轴 · 颜色表示工作区 · 可直接读取单位宽度电流');
  }

  function renderCustom() {
    const family = state.custom.family;
    let specs = [];
    if (family === 'L') {
      specs = state.lsweep.map(Number).filter(v => isFinite(v) && v >= LMIN() && v <= 20).sort((a, b) => a - b).map(L => ({ label: 'L=' + prettyL(L) + ' µm', L: L, Vds: state.Vds }));
    } else if (family === 'Vds') {
      specs = state.customVds.map(Number).filter(v => isFinite(v) && v >= 0 && v <= VDD()).sort((a, b) => a - b).map(vd => ({ label: 'VDS=' + nf(vd, 2) + ' V', L: state.L, Vds: vd }));
    } else {
      specs = [{ label: 'L=' + prettyL(state.L) + ' µm', L: state.L, Vds: state.Vds }];
    }
    if (!specs.length) return emptyPlot('没有可绘制的曲线');

    plotStore = [];
    const traces = [];
    const all = [];
    const expr = (state.custom.expr || '').trim();
    const xm = METRICS[state.custom.x] || METRICS.gmid;
    const ym = expr ? null : (METRICS[state.custom.y] || METRICS.gmro);
    let exprError = false;
    specs.forEach((s, i) => {
      const pts = E.sweepVgs(DB, simOpts({ L: s.L * 1e-6, Vds: s.Vds }), state.points);
      const valid = [];
      for (const p of pts) {
        const xv = xm.get(p);
        const yv = expr ? evalCustom(expr, p) : ym.get(p);
        if (!isFinite(xv) || !isFinite(yv)) continue;
        if (state.custom.x === 'gmid' && p.Id < 1e-8) continue;
        if (state.logX && xv <= 0) continue;
        if (state.logY && yv <= 0) continue;
        valid.push({ p: p, x: xv, y: yv });
      }
      if (!valid.length) { if (expr) exprError = true; return; }
      all.push({ name: s.label, valid: valid });
      const cd = register(valid.map(v => v.p), { view: 'custom', spec: s });
      const color = COLORS[i % COLORS.length];
      traces.push({
        x: valid.map(v => v.x), y: valid.map(v => v.y), type: 'scatter', mode: 'lines',
        name: s.label, line: { color: color, width: 2.0 },
        customdata: cd,
        hovertemplate: xm.label + ' %{x:.4g} ' + xm.unit + '<br>' + (expr ? 'Y' : ym.label) + ' %{y:.4g} ' + (expr ? '' : ym.unit) + '<extra></extra>'
      });
    });
    if (!traces.length) return emptyPlot(exprError ? 'Y 表达式无法求值，请检查变量名与括号（可用 gm、Id、gmid、ro 等）' : '没有有效数据点');
    const sel = state.selected;
    const shapes = [], annotations = [];
    if (sel) {
      const xv = xm.get(sel);
      const yv = expr ? evalCustom(expr, sel) : ym.get(sel);
      const ch = crosshair(xv, yv, ' ' + xm.unit, expr ? '' : ' ' + ym.unit);
      shapes.push.apply(shapes, ch.shapes);
      annotations.push.apply(annotations, ch.annotations);
    }
    const layout = baseLayout({
      xTitle: xm.label + '  (' + xm.unit + ')',
      yTitle: (expr ? '自定义表达式' : ym.label) + (expr ? '' : '  (' + ym.unit + ')'),
      logX: state.logX, logY: state.logY,
      shapes: shapes, annotations: annotations,
      margin: { l: 64, r: 22, t: 30, b: 46 },
      showlegend: traces.length > 1
    });
    Plotly.react($('#plot'), traces, layout, PLOT_CONFIG);
    state.lastSeries = all.map(s => ({ name: s.name, points: s.valid.map(v => v.p) }));
    state.lastAxes = { x: xm, y: expr ? { label: expr, unit: '', fmt: v => nf(v, 4) } : ym };
    setTitle('自定义曲线', '任意 X/Y 指标组合 · 支持 L / V<sub>DS</sub> 曲线族与 Y 表达式');
  }

  function safeFmt(v, d) { return isFinite(v) ? nf(v, d == null ? 3 : d) : '—'; }

  function evalCustom(expr, p) {
    const names = ['Vgs', 'Id', 'Id_uA', 'IdW', 'gm', 'gm_uS', 'gds', 'gmid', 'gmro', 'fT', 'fT_GHz', 'Cgg', 'Cgg_fF', 'Vth', 'Vov', 'Vdsat', 'SS', 'n', 'W', 'W_um', 'L', 'L_um', 'ro'];
    const vals = [p.Vgs, p.Id, p.Id * 1e6, p.IdW, p.gm, p.gm * 1e6, p.gds, p.gmid, p.gmro, p.fT, p.fT / 1e9, p.Cgg, p.Cgg * 1e15, p.Vth, p.Vov, p.Vdsat, p.SS, p.n, p.W, p.W * 1e6, p.L, p.L * 1e6, p.ro];
    try {
      const fn = Function.apply(null, names.concat(['return (' + expr + ');']));
      const v = fn.apply(null, vals);
      return typeof v === 'number' && isFinite(v) ? v : NaN;
    } catch (e) {
      return NaN;
    }
  }

  function emptyPlot(msg) {
    $('#plotEmpty').hidden = false;
    $('#plotEmpty').textContent = msg;
    $('#plot').hidden = true;
    setTitle('无有效曲线', msg);
  }

  function setTitle(title, subtitle) {
    $('#chartTitle').innerHTML = title;
    $('#chartSubtitle').innerHTML = subtitle;
  }

  /* ---------------- library ---------------- */
  function renderLibrary() {
    const vdd = VDD();
    const pts = E.sweepVgs(DB, simOpts(), state.points).filter(p => p.Id > 1e-12);
    if (!pts.length) return emptyPlot('没有有效数据点');
    const sel = state.selected;
    const grid = $('#libraryGrid');
    grid.hidden = false;
    grid.innerHTML = [
      ['ID–VGS', 'log'], ['gm–VGS', 'µS'], ['gds–VGS', 'log nS'],
      ['fT–GM/ID', 'GHz'], ['ID–VDS', '输出族'], ['GM/ID–VOV', '1/V']
    ].map((t, i) => `<div class="mini-chart"><div class="mini-title">${t[0]}<span>${t[1]}</span></div><div class="mini-plot" id="mini${i}"></div></div>`).join('');
    miniPlots = ['mini0', 'mini1', 'mini2', 'mini3', 'mini4', 'mini5'];
    const miniLayout = (xTitle, yTitle, opts) => {
      const o = opts || {};
      return {
        autosize: true, margin: { l: 40, r: 9, t: 20, b: 27 },
        paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: '#081018',
        font: { family: 'JetBrains Mono, Consolas, monospace', size: 7, color: '#8ca3ad' },
        showlegend: false, hovermode: 'closest',
        xaxis: { title: { text: xTitle, font: { size: 7 } }, gridcolor: 'rgba(148,193,209,.06)', linecolor: 'rgba(148,193,209,.12)', tickfont: { size: 6 }, zeroline: false, ...(o.xaxis || {}) },
        yaxis: { title: { text: yTitle, font: { size: 7 } }, gridcolor: 'rgba(148,193,209,.06)', linecolor: 'rgba(148,193,209,.12)', tickfont: { size: 6 }, zeroline: false, ...(o.yaxis || {}) },
        hoverlabel: { bgcolor: '#0b1a23', bordercolor: 'rgba(94,234,212,.3)', font: { size: 8 } }
      };
    };
    const miniConfig = { displayModeBar: false, responsive: true, staticPlot: false };

    requestAnimationFrame(() => {
      try {
        Plotly.react($('#mini0'), [{
          x: pts.map(p => p.Vgs), y: pts.map(p => p.Id * 1e6), type: 'scatter', mode: 'lines',
          line: { color: '#5eead4', width: 1.5 }, hovertemplate: '%{x:.3f} V<br>%{y:.3e} µA<extra></extra>'
        }], miniLayout('VGS (V)', 'ID (µA)', { yaxis: { type: 'log' } }), miniConfig);

        Plotly.react($('#mini1'), [{
          x: pts.map(p => p.Vgs), y: pts.map(p => p.gm * 1e6), type: 'scatter', mode: 'lines',
          line: { color: '#fbbf24', width: 1.5 }, hovertemplate: '%{x:.3f} V<br>%{y:.3f} µS<extra></extra>'
        }], miniLayout('VGS (V)', 'gm (µS)'), miniConfig);

        const gdsPts = pts.filter(p => p.gds > 1e-12);
        Plotly.react($('#mini2'), [{
          x: gdsPts.map(p => p.Vgs), y: gdsPts.map(p => p.gds * 1e9), type: 'scatter', mode: 'lines',
          line: { color: '#f472b6', width: 1.5 }, hovertemplate: '%{x:.3f} V<br>%{y:.3e} nS<extra></extra>'
        }], miniLayout('VGS (V)', 'gds (nS)', { yaxis: { type: 'log' } }), miniConfig);

        const ftPts = pts.filter(p => p.fT > 1e6);
        Plotly.react($('#mini3'), [{
          x: ftPts.map(p => p.gmid), y: ftPts.map(p => p.fT / 1e9), type: 'scatter', mode: 'lines',
          line: { color: '#a78bfa', width: 1.5 }, hovertemplate: '%{x:.2f} 1/V<br>%{y:.2f} GHz<extra></extra>'
        }], miniLayout('gm/ID (1/V)', 'fT (GHz)'), miniConfig);

        const vgsSteps = [];
        for (let i = 0; i < 6; i++) vgsSteps.push((0.30 + i * 0.13) * vdd);
        const vd = [];
        for (let i = 0; i <= 80; i++) vd.push(vdd * i / 80);
        const outTraces = vgsSteps.map((vg, i) => {
          const arr = vd.map(Vds => { try { return E.simulate(DB, simOpts({ Vgs: vg, Vds: Vds })); } catch (e) { return null; } }).filter(Boolean);
          return {
            x: arr.map(p => p.Vds), y: arr.map(p => p.Id * 1e3), type: 'scatter', mode: 'lines',
            line: { color: 'hsl(' + (168 + i * 24) + ',70%,62%)', width: 1.3 },
            hovertemplate: 'VDS %{x:.3f} V<br>ID %{y:.3f} mA<extra></extra>'
          };
        });
        Plotly.react($('#mini4'), outTraces, miniLayout('VDS (V)', 'ID (mA)'), miniConfig);

        Plotly.react($('#mini5'), [{
          x: pts.map(p => p.Vov), y: pts.map(p => p.gmid), type: 'scatter', mode: 'lines',
          line: { color: '#60a5fa', width: 1.5 }, hovertemplate: '%{x:.3f} V<br>%{y:.2f} 1/V<extra></extra>'
        }], miniLayout('VOV (V)', 'gm/ID (1/V)'), miniConfig);
      } catch (e) { console.warn(e); }
    });
    state.lastSeries = [{ name: 'VGS sweep', points: pts }];
    state.lastAxes = { x: METRICS.Vgs, y: METRICS.gmid };
    setTitle('常用曲线库', '六组辅助曲线 · 悬停读数 · 点击上方标签可回到单图模式');
    updateLive();
  }

  /* ---------------- hover / click ---------------- */
  function onPlotHover(ev) {
    const pt = ev && ev.points && ev.points[0];
    if (!pt) return;
    const cd = pt.customdata;
    let txt = '';
    if (cd && Array.isArray(cd) && plotStore[cd[0]]) {
      const p = plotStore[cd[0]].points[cd[1]];
      if (p) {
        const ax = state.lastAxes;
        txt = labelText(ax.x.label) + ' <b>' + fmtAxis(ax.x.get(p)) + '</b> ' + (ax.x.unit || '') +
          ' · ' + labelText(ax.y.label) + ' <b>' + fmtAxis(ax.y.get(p)) + '</b> ' + (ax.y.unit || '') +
          ' · ' + (E.REGION_CN[p.region] || '');
        if (state.view === 'vgs-gmid') {
          txt += ' · ID <b>' + fmtCurrent(p.Id) + '</b>';
        }
        showHover(txt);
        return;
      }
    }
    if (state.view === 'vgs-gmid' && pt.data && /ID/.test(pt.data.name)) {
      showHover('VGS <b>' + fmtAxis(pt.x) + '</b> V · ID <b>' + fmtCurrent(pt.y) + '</b>');
      return;
    }
    showHover(labelText(pt.data.name || '') + ' <b>' + fmtAxis(pt.x) + '</b>, <b>' + fmtAxis(pt.y) + '</b>');
  }

  function showHover(html) {
    const el = $('#hoverReadout');
    el.innerHTML = html;
    el.hidden = false;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }

  function onPlotClick(ev) {
    const pt = ev && ev.points && ev.points[0];
    if (!pt) return;
    const cd = pt.customdata;
    if (!cd || !Array.isArray(cd) || !plotStore[cd[0]]) {
      const near = nearestPoint(pt.x, pt.y);
      if (near) selectPoint(near.p, near.meta);
      return;
    }
    const store = plotStore[cd[0]];
    const p = store.points[cd[1]];
    if (!p) return;
    selectPoint(p, store.meta);
  }

  function nearestPoint(x, y) {
    const ax = state.lastAxes;
    if (!ax || !state.lastSeries || !state.lastSeries.length) return null;
    let best = null, bestD = Infinity;
    for (const series of state.lastSeries) {
      for (const p of series.points) {
        const px = ax.x.get(p), py = ax.y.get(p);
        if (!isFinite(px) || !isFinite(py)) continue;
        const dx = (px - x) / (Math.abs(x) + 1e-9);
        const dy = (py - y) / (Math.abs(y) + 1e-9);
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = { p: p, meta: series.meta || {} }; }
      }
    }
    return bestD < 0.09 ? best : null;
  }

  function selectPoint(p, meta) {
    state.selected = p;
    state.Vgs = p.Vgs;
    state.Vds = p.Vds;
    if (meta && meta.view === 'lsweep' && meta.L) {
      state.L = meta.L;
    }
    syncInputs();
    updateLive();
    renderAll({ status: '已锁定工作点 · ' + E.REGION_CN[p.region] + ' · ' + fmtCurrent(p.Id) });
    toast('已锁定：VGS ' + nf(p.Vgs, 3) + ' V · gm/ID ' + nf(p.gmid, 2) + ' 1/V · gm·ro ' + nf(p.gmro, 1));
  }

  function unlock() {
    state.selected = null;
    updateLive();
    renderAll({ status: '已解除锁定 · 返回实时偏置' });
  }

  /* ---------------- model modal ---------------- */
  function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.hidden = false;
  }
  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  }
  function closeAllModals() {
    $$('.modal-backdrop').forEach(el => el.hidden = true);
  }

  function openModelModal() {
    renderModelSummary();
    state.modalTab = 'params';
    renderModelTabs();
    renderModelTab();
    openModal('modalModel');
  }

  function renderModelSummary() {
    const totalBins = Object.keys(DB.corners).reduce((n, c) => n + Object.keys(DB.corners[c].devices).reduce((m, d) => m + DB.corners[c].devices[d].length, 0), 0);
    const sha = (META && META.sha256) ? META.sha256.slice(0, 16) + '…' : '—';
    const cells = [
      ['FILE', META ? META.file : 'rf018.scs', (META ? (META.bytes / 1024).toFixed(1) : '831.7') + ' KB · ' + (META ? META.lines : '16,825') + ' lines'],
      ['SHA-256', sha, '内嵌原始模型指纹'],
      ['PARSE', PARSE_MS.toFixed(0) + ' ms', '浏览器端解析耗时'],
      ['BINS', String(totalBins), '5 corners × 2 voltage domains']
    ];
    $('#modelSummary').innerHTML = cells.map(c => `<div class="summary-cell"><span>${c[0]}</span><b title="${c[1]}">${c[1]}</b><small>${c[2]}</small></div>`).join('');
  }

  function renderModelTabs() {
    $$('#modalModel .modal-tabs button').forEach(b => b.classList.toggle('active', b.dataset.mtab === state.modalTab));
  }

  function renderModelTab() {
    const body = $('#modelTabBody');
    if (!body) return;
    const p = activePoint();
    if (!p) { body.innerHTML = '<p class="method-copy">没有有效工作点。</p>'; return; }
    if (state.modalTab === 'params') {
      const b = p.bin;
      const rows = [
        ['lmin', fmtLenM(b.lmin), 'µm', 'BIN 最小沟道长度'],
        ['lmax', fmtLenM(b.lmax), 'µm', 'BIN 最大沟道长度'],
        ['wmin', fmtLenM(b.wmin), 'µm', 'BIN 最小沟道宽度'],
        ['wmax', fmtLenM(b.wmax), 'µm', 'BIN 最大沟道宽度'],
        ['vth0', (b.type === 'p' ? '−' : '') + Math.abs(b.vth0).toFixed(6), 'V', '零偏阈值电压'],
        ['k1', b.k1.toFixed(6), 'V^0.5', '体效应系数'],
        ['k2', b.k2.toFixed(6), 'V', '体效应二阶系数'],
        ['tox', (b.tox * 1e9).toFixed(3), 'nm', '氧化层厚度'],
        ['u0', (b.u0 * 1e4).toFixed(1), 'cm²/Vs', '低场迁移率'],
        ['vsat', fmtSci(b.vsat * 100, 3), 'cm/s', '饱和速度'],
        ['rdsw', b.rdsw.toFixed(1), 'Ω·µm', '源漏串联电阻'],
        ['pclm', b.pclm.toFixed(4), '—', '沟道长度调制参数'],
        ['pdiblc2', b.pdiblc2.toExponential(3), '—', 'DIBL 参数'],
        ['eta0', b.eta0.toExponential(3), '—', 'DIBL 系数'],
        ['cit', b.cit.toExponential(3), 'F/m²', '界面陷阱电容'],
        ['cgdo', b.cgdo.toExponential(3), 'F/m', '栅漏覆盖电容'],
        ['cgso', b.cgso.toExponential(3), 'F/m', '栅源覆盖电容'],
        ['dlc', (b.dlc * 1e9).toFixed(2), 'nm', '沟道长度修正'],
        ['wint', (b.wint * 1e9).toFixed(2), 'nm', '沟道宽度修正']
      ];
      body.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:10px">
        <div class="method-copy" style="margin:0"><b style="color:#e9f8fa">BIN ${binIndex(b)}</b> · ${state.domain === '3.3' ? (state.device === 'p' ? 'pch3' : 'nch3') : (state.device === 'p' ? 'pch' : 'nch')} · ${state.corner} · 由当前 L/W 自动匹配</div>
        <span class="tag" style="font-family:var(--mono);font-size:8px;color:#647984">L=${fmtLenM(b.lmin)}–${fmtLenM(b.lmax)} · W=${fmtLenM(b.wmin)}–${fmtLenM(b.wmax)}</span>
      </div>
      <table class="param-table"><thead><tr><th>参数</th><th>值</th><th>单位 / 说明</th></tr></thead><tbody>
        ${rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]} · ${r[3]}</td></tr>`).join('')}
      </tbody></table>`;
    } else if (state.modalTab === 'bins') {
      const bins = activeBins();
      const cur = binIndex(p.bin);
      const k = cornerKeyFor();
      const devName = k.devKey;
      body.innerHTML = `<div class="method-copy" style="margin-bottom:8px">${state.corner} · ${devName} · 共 ${bins.length} 个 BIN。点击任意行可将 L/W 切换到该 BIN 的代表值。</div>
        <table class="bin-table"><thead><tr><th>BIN</th><th>L min</th><th>L max</th><th>W min</th><th>W max</th><th>VTH0 (V)</th><th>U0 (cm²/Vs)</th><th>VSAT (cm/s)</th></tr></thead><tbody>
        ${bins.map((b, i) => `<tr data-bin="${i}" class="${i + 1 === cur ? 'selected' : ''}"><td>${i + 1}</td><td>${(b.lmin * 1e6).toFixed(2)}</td><td>${(b.lmax * 1e6).toFixed(2)}</td><td>${(b.wmin * 1e6).toFixed(2)}</td><td>${(b.wmax * 1e6).toFixed(2)}</td><td>${b.vth0.toFixed(4)}</td><td>${(b.u0 * 1e4).toFixed(0)}</td><td>${fmtSci(b.vsat * 100, 2)}</td></tr>`).join('')}
        </tbody></table>`;
      $$('#modelTabBody .bin-table tr').forEach(tr => {
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', () => {
          const b = bins[Number(tr.dataset.bin)];
          if (!b) return;
          const lmid = Math.sqrt(b.lmin * b.lmax);
          const wmid = Math.sqrt(b.wmin * b.wmax);
          state.L = clamp(lmid * 1e6, LMIN(), 20);
          state.W = clamp(wmid * 1e6, WMIN, 100);
          state.selected = null;
          closeAllModals();
          renderAll({ status: '已切换到 BIN ' + (Number(tr.dataset.bin) + 1) });
          toast('已切换到 BIN ' + (Number(tr.dataset.bin) + 1) + ' · L=' + prettyL(state.L) + ' µm · W=' + prettyW(state.W) + ' µm');
        });
      });
    } else {
      body.innerHTML = `<div class="method-copy">
        <p><b>原始文件</b>：<code>C:\\Users\\21154\\Desktop\\rf018.scs</code>（内嵌 gzip 数据），启动时解压并用 JavaScript 解析 Spectre 的 <code>section</code>、<code>parameters</code>、<code>include section=…</code> 与 <code>model … bsim3v3 { N: … }</code> binned model card。</p>
        <p><b>可提取内容</b>：5 个工艺角（TT/FF/SS/SF/FS）× 2 个电压域（1.8 V / 3.3 V）× NMOS/PMOS，共 10 组、每组 16 个 L/W BIN。</p>
        <p><b>曲线引擎</b>：以 BIN 中的 VTH0、K1、K2、TOX、U0、VSAT、RDSW、PCLM 等为主，构建 EKV 型前向电荷 + α-power 饱和 + 串联电阻 + DIBL/CLM 的快速模型；gm、gds 由中心差分得到。</p>
        <div class="warn">本页是 gm/Id 设计空间探索工具，不是完整 BSIM3 求解器。温度、版图寄生、噪声、栅漏电流与高阶短沟道效应未包含。最终曲线请在 Spectre 中用导出的测试台复核。</div>
        <p><b>工作区</b>：截止 / 亚阈值 / 线性（三极管）/ 饱和的判据见页面底部与帮助面板。</p>
      </div>`;
    }
  }

  /* ---------------- file load ---------------- */
  async function sha256Hex(buffer) {
    if (!window.crypto || !crypto.subtle) return '';
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.prototype.map.call(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  }

  async function loadModelFile(file) {
    if (!file) return;
    try {
      toast('正在解析 ' + file.name + ' …');
      const buf = await file.arrayBuffer();
      const text = new TextDecoder('utf-8').decode(buf);
      const hash = await sha256Hex(buf);
      const t0 = performance.now();
      const db = CM.parseSpectre(text, { file: file.name, sha256: hash, bytes: buf.byteLength });
      const ms = performance.now() - t0;
      if (!db.corners.TT || !db.corners.TT.devices.nch) throw new Error('未找到 TT / nch 模型');
      DB = db; META = db.source; PARSE_MS = ms;
      state.selected = null;
      renderModelSummary();
      renderModelTab();
      $('#parseFoot').textContent = '解析 ' + ms.toFixed(0) + ' ms';
      renderAll({ status: '已载入 ' + file.name + ' · ' + ms.toFixed(0) + ' ms' });
      const match = hash && hash === window.RF018_SHA256;
      toast('已载入 ' + file.name + ' · ' + (match ? 'SHA-256 校验通过' : 'SHA-256 与内置版本不同，已使用新文件'), !match);
    } catch (err) {
      console.error(err);
      toast('模型解析失败：' + err.message, true);
    }
  }

  /* ---------------- export ---------------- */
  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function exportPNG() {
    if (state.view === 'library') { toast('曲线库视图请先切换到单图再导出 PNG', true); return; }
    Plotly.downloadImage($('#plot'), { format: 'png', width: 1600, height: 900, scale: 2, filename: 'gm-id-' + state.view });
    toast('正在生成 PNG…');
  }

  function exportCSV() {
    if (!state.lastSeries || !state.lastSeries.length) { toast('当前没有可导出的曲线数据', true); return; }
    const header = ['series', 'Vgs_V', 'Vds_V', 'Id_A', 'gm_S', 'gds_S', 'gm_id_1_per_V', 'gm_ro', 'Id_W_uA_per_um', 'fT_GHz', 'Vth_V', 'region'];
    const rows = [header.join(',')];
    state.lastSeries.forEach(s => {
      s.points.forEach(p => {
        rows.push([s.name, p.Vgs, p.Vds, p.Id, p.gm, p.gds, p.gmid, p.gmro, p.IdW, p.fT / 1e9, p.Vth, p.region].map(v => typeof v === 'number' ? Number(v).toPrecision(8) : v).join(','));
      });
    });
    download('gm-id-' + state.view + '.csv', '\ufeff' + rows.join('\n'), 'text/csv;charset=utf-8');
    closeAllModals();
    toast('CSV 已导出');
  }

  function exportNetlist() {
    const p = activePoint();
    if (!p) return;
    const vdd = VDD();
    const cornerSec = state.domain === '3.3' ? state.corner.toLowerCase() + '_3v' : state.corner.toLowerCase();
    const devName = state.domain === '3.3' ? (state.device === 'p' ? 'pch3' : 'nch3') : (state.device === 'p' ? 'pch' : 'nch');
    const L = (p.L * 1e6).toFixed(4) + 'u';
    const W = (p.W * 1e6).toFixed(4) + 'u';
    const lines = [];
    lines.push('// GM/ID Studio — Spectre DC testbench');
    lines.push('// model: rf018.scs  sha256: ' + (META ? META.sha256 : ''));
    lines.push('// corner: ' + state.corner + '  device: ' + devName + '  VDD: ' + vdd + ' V');
    lines.push('simulator lang=spectre');
    lines.push('include "rf018.scs" section=' + cornerSec);
    lines.push('');
    if (state.device === 'n') {
      lines.push('parameters L=' + L + ' W=' + W + ' vds=' + p.Vds.toFixed(4) + ' vsb=' + p.Vbs.toFixed(4));
      lines.push('VGS (g 0) vsource dc=0');
      lines.push('VDS (d 0) vsource dc=vds');
      lines.push('VBS (b 0) vsource dc=-vsb');
      lines.push('M1 (d g 0 b) ' + devName + ' L=L W=W');
      lines.push('save M1:ids M1:gm M1:gds M1:vth M1:vdsat');
      lines.push('dc dc dev=VGS param=dc start=0 stop=' + vdd + ' step=0.005');
    } else {
      lines.push('parameters L=' + L + ' W=' + W + ' vds=' + p.Vds.toFixed(4) + ' vsb=' + p.Vbs.toFixed(4));
      lines.push('VDD (vdd 0) vsource dc=' + vdd);
      lines.push('VG (g 0) vsource dc=' + vdd);
      lines.push('VD (d 0) vsource dc=' + (vdd - p.Vds).toFixed(4));
      lines.push('VB (b 0) vsource dc=' + (vdd + p.Vbs).toFixed(4));
      lines.push('M1 (d g vdd b) ' + devName + ' L=L W=W');
      lines.push('save M1:ids M1:gm M1:gds M1:vth M1:vdsat');
      lines.push('dc dc dev=VG param=dc start=' + vdd + ' stop=0 step=-0.005');
    }
    lines.push('');
    lines.push('// 说明：');
    lines.push('// 1) 将本文件与 rf018.scs 放在同一目录；section 名称按工艺角/电压域调整。');
    lines.push('// 2) Spectre 的 save 名称可能随版本/器件模型不同，必要时改 save M1:currents 等。');
    lines.push('// 3) 为了得到 gm/Id 与 gm·ro，请在波形查看器中用 gm/Id 与 gm/gds 计算。');
    download('gm-id-testbench.scs', lines.join('\n'), 'text/plain;charset=utf-8');
    closeAllModals();
    toast('Spectre 测试台已导出');
  }

  function exportJSON() {
    const p = activePoint();
    if (!p) return;
    const out = {
      source: META,
      corner: state.corner, device: state.device, domain: state.domain,
      geometry: { L_um: p.L * 1e6, W_um: p.W * 1e6, Leff_um: p.Leff * 1e6, Weff_um: p.Weff * 1e6 },
      bias: { Vgs: p.Vgs, Vds: p.Vds, Vbs: p.Vbs },
      region: p.region,
      metrics: {
        Vth: p.Vth, Vov: p.Vov, Vdsat: p.Vdsat, SS_mV_dec: p.SS, n: p.n,
        Id_A: p.Id, IdW_uA_um: p.IdW, gm_S: p.gm, gds_S: p.gds, ro_ohm: p.ro,
        gm_id_1_V: p.gmid, gm_ro: p.gmro, Cgg_F: p.Cgg, fT_Hz: p.fT
      },
      bin: p.bin
    };
    download('gm-id-operating-point.json', JSON.stringify(out, null, 2), 'application/json');
    closeAllModals();
    toast('工作点 JSON 已导出');
  }

  /* ---------------- toast ---------------- */
  function toast(msg, err) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    el.classList.toggle('err', !!err);
    requestAnimationFrame(() => el.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => { el.hidden = true; }, 240);
    }, 3400);
  }

  /* ---------------- init ---------------- */
  function initCustomSelects() {
    const opts = Object.keys(METRICS).map(k => `<option value="${k}">${METRICS[k].label}${METRICS[k].unit ? ' (' + METRICS[k].unit + ')' : ''}</option>`).join('');
    $('#customX').innerHTML = opts;
    $('#customY').innerHTML = opts;
    $('#customX').value = state.custom.x;
    $('#customY').value = state.custom.y;
  }

  function initUI() {
    initCustomSelects();
    $('#customListWrap').hidden = state.custom.family === 'single';
    if (state.custom.family === 'L') $('#customList').value = state.lsweep.join(', ');
    syncInputs();
    updateActiveButtons();

    const setBias = (patch, opts) => {
      Object.assign(state, patch);
      state.selected = null;
      syncInputs();
      updateLive();
      scheduleRender();
      if (opts && opts.toast) toast(opts.toast);
    };

    $('#cornerSeg').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      state.corner = b.dataset.value; state.selected = null;
      syncInputs(); renderAll({ status: '已切换工艺角 ' + state.corner });
    });
    $('#deviceSeg').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      state.device = b.dataset.value; state.selected = null;
      syncInputs(); renderAll({ status: '已切换器件 ' + (state.device === 'p' ? 'PMOS' : 'NMOS') });
    });
    $('#domainSeg').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const d = b.dataset.value;
      if (d === state.domain) return;
      state.domain = d;
      if (d === '3.3') {
        state.L = Math.max(0.35, state.L); state.Vds = Math.min(1.65, 3.3); state.Vgs = Math.min(1.2, 3.3);
        state.Vbs = 0; state.VgsMax = 3.3; state.lsweep = [0.35, 0.5, 0.8, 1.2, 2.0, 3.0];
        state.customVds = [0.4, 0.8, 1.2, 1.65, 2.2, 3.0];
      } else {
        state.L = Math.min(2.0, Math.max(0.18, state.L)); state.Vds = 0.9; state.Vgs = 0.7;
        state.Vbs = 0; state.VgsMax = 1.8; state.lsweep = [0.18, 0.24, 0.36, 0.5, 0.8, 1.2, 2.0];
        state.customVds = [0.2, 0.4, 0.6, 0.9, 1.2, 1.5];
      }
      state.selected = null;
      $('#lsweepInput').value = state.lsweep.join(', ');
      syncInputs(); renderAll({ status: '已切换电压域 ' + d + ' V' });
    });

    const bindNumber = (id, key, scale) => {
      const el = $(id);
      el.addEventListener('change', () => {
        const v = Number(el.value);
        if (!isFinite(v)) { syncInputs(); return; }
        setBias({ [key]: scale ? v * scale : v });
      });
    };
    bindNumber('#LInput', 'L');
    bindNumber('#WInput', 'W');
    bindNumber('#VgsInput', 'Vgs');
    bindNumber('#VdsInput', 'Vds');
    bindNumber('#VbsInput', 'Vbs');
    bindNumber('#VgsMin', 'VgsMin');
    bindNumber('#VgsMax', 'VgsMax');

    $('#LRange').addEventListener('input', e => { state.L = Number(e.target.value); state.selected = null; syncInputs(); updateLive(); scheduleRender(); });
    $('#WRange').addEventListener('input', e => { state.W = wFromSlider(Number(e.target.value)); state.selected = null; syncInputs(); updateLive(); scheduleRender(); });
    $('#VgsRange').addEventListener('input', e => { state.Vgs = Number(e.target.value); state.selected = null; syncInputs(); updateLive(); scheduleRender(); });
    $('#VdsRange').addEventListener('input', e => { state.Vds = Number(e.target.value); state.selected = null; syncInputs(); updateLive(); scheduleRender(); });
    $('#VbsRange').addEventListener('input', e => { state.Vbs = Number(e.target.value); state.selected = null; syncInputs(); updateLive(); scheduleRender(); });
    $('#pointsSelect').addEventListener('change', e => { state.points = Number(e.target.value); state.selected = null; renderAll(); });
    $('#btnRun').addEventListener('click', () => { state.selected = null; renderAll({ status: '重新扫描完成 · ' + state.points + ' pts' }); toast('已重新扫描 · ' + state.points + ' 点'); });

    $('#viewTabs').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      state.view = b.dataset.view; state.logX = false; state.logY = false;
      updateActiveButtons(); renderAll();
    });
    $('#btnLogX').addEventListener('click', () => { state.logX = !state.logX; updateActiveButtons(); renderAll(); });
    $('#btnLogY').addEventListener('click', () => { state.logY = !state.logY; updateActiveButtons(); renderAll(); });
    $('#btnGrid').addEventListener('click', () => { state.grid = !state.grid; updateActiveButtons(); renderAll(); });
    $('#btnReset').addEventListener('click', () => { Plotly.relayout($('#plot'), { 'xaxis.autorange': true, 'yaxis.autorange': true, 'yaxis2.autorange': true }); });
    $('#btnPng').addEventListener('click', exportPNG);

    $('#btnApplyLsweep').addEventListener('click', () => {
      const vals = $('#lsweepInput').value.split(/[,\s;]+/).map(Number).filter(v => isFinite(v) && v > 0);
      if (!vals.length) { toast('请输入有效的 L 列表', true); return; }
      state.lsweep = vals;
      state.selected = null;
      renderAll({ status: 'L 扫描列表已更新' });
    });

    $('#customX').addEventListener('change', e => { state.custom.x = e.target.value; renderAll(); });
    $('#customY').addEventListener('change', e => { state.custom.y = e.target.value; state.custom.expr = ''; $('#customExpr').value = ''; renderAll(); });
    $('#customFamily').addEventListener('change', e => {
      state.custom.family = e.target.value;
      const wrap = $('#customListWrap');
      wrap.hidden = state.custom.family === 'single';
      if (state.custom.family === 'L') $('#customList').value = state.lsweep.join(', ');
      else if (state.custom.family === 'Vds') $('#customList').value = state.customVds.join(', ');
      renderAll();
    });
    $('#customExpr').addEventListener('change', e => { state.custom.expr = e.target.value.trim(); renderAll(); });
    $('#btnCustomDraw').addEventListener('click', () => {
      state.custom.x = $('#customX').value;
      state.custom.y = $('#customY').value;
      state.custom.family = $('#customFamily').value;
      state.custom.expr = $('#customExpr').value.trim();
      const rawList = $('#customList').value.split(/[,\s;]+/).map(Number).filter(v => isFinite(v) && v > 0);
      if (state.custom.family === 'L' && rawList.length) state.lsweep = rawList;
      if (state.custom.family === 'Vds' && rawList.length) state.customVds = rawList;
      state.selected = null;
      renderAll({ status: '自定义曲线已更新' });
    });

    $('#modelFile').addEventListener('click', openModelModal);
    $('#btnModel').addEventListener('click', openModelModal);
    $('#btnModel2').addEventListener('click', openModelModal);
    $('#btnProbeModel').addEventListener('click', openModelModal);
    $('#btnExport').addEventListener('click', () => openModal('modalExport'));
    $('#btnHelp').addEventListener('click', () => openModal('modalHelp'));
    $('#btnReloadModel').addEventListener('click', () => $('#fileInput').click());
    $('#fileInput').addEventListener('change', e => { loadModelFile(e.target.files && e.target.files[0]); e.target.value = ''; });

    $('#lockBadge').addEventListener('click', () => { if (state.selected) unlock(); else toast('点击曲线上的点即可锁定工作点'); });
    $('#btnUnlock').addEventListener('click', unlock);

    $('#expPng').addEventListener('click', exportPNG);
    $('#expCsv').addEventListener('click', exportCSV);
    $('#expNetlist').addEventListener('click', exportNetlist);
    $('#expJson').addEventListener('click', exportJSON);

    $$('.modal-backdrop').forEach(bd => {
      bd.addEventListener('click', e => { if (e.target === bd) bd.hidden = true; });
    });
    $$('[data-close]').forEach(b => b.addEventListener('click', closeAllModals));
    $$('#modalModel .modal-tabs button').forEach(b => b.addEventListener('click', () => { state.modalTab = b.dataset.mtab; renderModelTabs(); renderModelTab(); }));

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeAllModals();
    });

    updateActiveButtons();
    renderAll({ status: '模型已就绪 · 点击曲线锁定工作点' });
    setTimeout(bindPlotEvents, 60);
    window.addEventListener('resize', debounce(() => {
      if (!bootDone) return;
      if (state.view !== 'library' && window.Plotly) Plotly.Plots.resize($('#plot'));
    }, 160));
    $('#parseFoot').textContent = '解析 ' + PARSE_MS.toFixed(0) + ' ms';
  }

  function bindPlotEvents() {
    if (plotEventsBound || !window.Plotly) return;
    const plot = $('#plot');
    if (!plot || typeof plot.on !== 'function') return;
    plot.on('plotly_hover', onPlotHover);
    plot.on('plotly_click', onPlotClick);
    plotEventsBound = true;
  }

  function debounce(fn, ms) {
    let t = 0;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
