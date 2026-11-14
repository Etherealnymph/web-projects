
(function () {
  'use strict';
  const M = window.__SPICE_MODELS__;
  const ST = window.ST, C = window.ST, U = window.UI;
  const { el, clear, eng, num, kvTable, gridTable, chart, note, card } = U;
  if (!M) {
    document.body.innerHTML = '<p style="padding:24px;color:#f88">模型数据未加载：请确认 web/data/models.js 存在，并通过本地服务器或直接双击本页面打开。</p>';
    return;
  }
  const T0 = 273.15;
  const FAMILIES = [
    { id: 'rf18', label: '1.8V RF 器件 (nmos_rf / pmos_rf)', devices: ['nmos_rf', 'pmos_rf'] },
    { id: 'rf33', label: '3.3V RF 器件 (nmos_rf33 / pmos_rf33)', devices: ['nmos_rf33', 'pmos_rf33'] },
    { id: 'base18', label: '1.8V baseband 器件 (nch / pch)', devices: ['nch', 'pch'] },
    { id: 'base33', label: '3.3V baseband 器件 (nch3 / pch3)', devices: ['nch3', 'pch3'] }
  ];
  const devById = (id) => {
    for (const d of M.devices) {
      if (d && typeof d === 'object' && d.id === id) return d;
    }
    return undefined;
  };
  const cornerInfo = (cid) => (M.corners || []).find((c) => c.id === cid) || { id: cid, label: cid };
  const state = {
    deviceId: 'nmos_rf',
    cornerSel: {},
    T: 25,
    W: 1.5, nf: 64, L: 0.18,
    Vgs: 0.7, Vds: 0.9, Vbs: 0,
    Vdd: 1.8,
    tab: 'dc'
  };
  for (const f of FAMILIES) {
    const dev0 = devById(f.devices[0]);
    state.cornerSel[f.id] = (dev0 && dev0.corners) ? Object.keys(dev0.corners)[0] : 'TT';
  }
  function familyOfDevice(id) {
    return FAMILIES.find((f) => f.devices.indexOf(id) >= 0) || FAMILIES[0];
  }
  function dev() { return devById(state.deviceId); }
  function cornerId() {
    const d = dev();
    if (!d || !d.corners) return 'TT';
    const want = state.cornerSel[familyOfDevice(state.deviceId).id];
    if (d.corners[want]) return want;
    return Object.keys(d.corners)[0];
  }
  function cfg(extra) {
    return Object.assign({
      W: state.W * 1e-6, L: state.L * 1e-6, nf: Math.round(state.nf),
      Vgs: state.Vgs, Vds: state.Vds, Vbs: state.Vbs, T: T0 + state.T,
      type: dev() ? dev().type : 'n'
    }, extra || {});
  }
  function run(extra) { return C.op(dev(), cornerId(), cfg(extra)); }
  function cornerFor(deviceId) {
    const dd = devById(deviceId);
    if (!dd || !dd.corners) return 'TT';
    const want = state.cornerSel[familyOfDevice(deviceId).id];
    return dd.corners[want] ? want : Object.keys(dd.corners)[0];
  }
  function opAny(deviceId, c) { return C.op(devById(deviceId), cornerFor(deviceId), c); }
  function deviceOptions() {
    const out = [];
    for (const f of FAMILIES) {
      for (const id of f.devices) {
        const d = devById(id);
        if (d) out.push({ value: id, group: f.label, label: d.label });
      }
    }
    return out;
  }
  function fileDefaults(deviceId) {
    const d = deviceId ? devById(deviceId) : dev();
    if (!d || !d.layout || !d.layout.params) return null;
    const p = d.layout.params;
    const ev = (k) => (p[k] !== undefined ? C.evalExpr(String(p[k]), {}) : undefined);
    const L = ev('lr'), W = ev('wr'), nf = ev('nr');
    if (!(L > 0) || !(W > 0) || !(nf > 0)) return null;
    const extra = {};
    for (const k of ['lspace', 'ledge', 'ledgeeff', 'lsti', 'wsti', 'rod', 'rsti']) {
      const v = ev(k);
      if (v !== undefined) extra[k] = v;
    }
    return { subckt: d.subckt, L: L, W: W, nf: Math.round(nf), extra: extra };
  }
  function clampGeometry() {
    const d = dev(), cid = cornerId(), c = d.corners[cid];
    if (!c || !c.lmin) return;
    const um = 1e6;
    state.L = Math.min(Math.max(state.L, c.lmin * um), c.lmax * um);
    state.W = Math.min(Math.max(state.W, c.wmin * um), c.wmax * um);
    if (state.L < 1e-3) state.L = c.lmin * um;
  }
  function header() {
    return el('header.app-header', null, [
      el('div.title', null, [
        el('h1', { text: 'TSMC 0.18µm RF 器件计算器' }),
        el('p.sub', { html: '模型源: <b>rf018.scs</b> (' + (M.meta.docNo || '') + ' v' + (M.meta.version || '') + ', ' + (M.meta.process || '') + ') · BSIM3v3.' + String(M.meta.bsimVersion || '').replace('3.', '') + ' · 引擎按 Eldo Device Equations Manual 的 BSIM3v3 方程实现' })
      ]),
      el('div.badge', { text: M.devices.length + ' 器件 / ' + (M.corners || []).length + ' 工艺角' })
    ]);
  }
  function deviceBar(onChange) {
    const devSel = U.selectField({
      label: '器件', value: state.deviceId, options: deviceOptions(),
      onChange: (v) => {
        state.deviceId = v;
        clampGeometry();
        const nextDevice = devById(v);
        const nextCids = nextDevice && nextDevice.corners ? Object.keys(nextDevice.corners) : ['TT'];
        const familyId = familyOfDevice(v).id;
        const selected = nextDevice && nextDevice.corners && nextDevice.corners[state.cornerSel[familyId]]
          ? state.cornerSel[familyId]
          : nextCids[0];
        state.cornerSel[familyId] = selected;
        corSel.setOptions(nextCids.map((c) => ({ value: c, label: cornerInfo(c).label || c })), selected);
        onChange();
      }
    });
    const d = dev(), cids = d && d.corners ? Object.keys(d.corners) : ['TT'];
    const corSel = U.selectField({
      label: '工艺角', value: cornerId(), options: cids.map((c) => ({ value: c, label: cornerInfo(c).label || c })),
      onChange: (v) => { state.cornerSel[familyOfDevice(state.deviceId).id] = v; onChange(); }
    });
    const tempF = U.numberField({ label: '温度', value: state.T, step: 5, unit: '°C', width: '72px', onChange: (v) => { state.T = v; onChange(); } });
    const vddF = U.numberField({ label: '电源 VDD', value: state.Vdd, step: 0.1, unit: 'V', width: '72px', onChange: (v) => { state.Vdd = v; onChange(); } });
    const c = d && d.corners ? d.corners[cornerId()] : null;
    const range = (c && c.lmin) ? ('L ' + (c.lmin * 1e6).toFixed(3) + '–' + (c.lmax * 1e6).toFixed(3) + ' µm · 每指 W ' + (c.wmin * 1e6).toFixed(3) + '–' + (c.wmax * 1e6).toFixed(3) + ' µm') : '无尺寸范围限制';
    return el('div.device-bar', null, [devSel, corSel, tempF, vddF, el('div.range', { text: range })]);
  }
  function geoFields(onChange) {
    const fd = fileDefaults();
    const fW = U.numberField({ label: 'W (每指宽度)', value: state.W, step: 0.1, unit: 'µm', onChange: (v) => { state.W = v; onChange(); } });
    const fNf = U.numberField({ label: '指数 nf', value: state.nf, step: 1, unit: '', width: '72px', onChange: (v) => { state.nf = Math.max(1, Math.round(v)); onChange(); } });
    const fL = U.numberField({ label: 'L (沟长)', value: state.L, step: 0.01, unit: 'µm', onChange: (v) => { state.L = v; onChange(); } });
    const hint = el('div.note');
    if (fd) {
      hint.appendChild(el('span', { html: '指数 nf 在 rf018.scs 里只是子电路 <code>' + fd.subckt + '</code> 的默认参数 <code>nr=' + fd.nf + '</code>（每指 <code>wr=' + (fd.W * 1e6).toFixed(2) + 'µm</code>、<code>lr=' + (fd.L * 1e6).toFixed(2) + 'µm</code> 同理），模型卡本身没有 nf。 ' }));
      hint.appendChild(U.button('一键填入文件默认 (L=' + (fd.L * 1e6).toFixed(2) + 'µm, W=' + (fd.W * 1e6).toFixed(2) + 'µm, nf=' + fd.nf + ')', () => {
        state.L = fd.L * 1e6; state.W = fd.W * 1e6; state.nf = fd.nf;
        fW.setValue(state.W); fNf.setValue(state.nf); fL.setValue(state.L);
        onChange(true);
      }));
    } else {
      hint.appendChild(el('span', { html: '本器件是 rf018.scs 里的<b>顶层模型卡</b>（' + dev().modelName + '），文件里<b>没有</b> nf / 默认几何 —— 指数 nf 是实例参数（Spectre 的 <code>nf</code> 或 <code>m</code>），由版图与设计决定：填 1 表示一个整管。' }));
    }
    hint.appendChild(el('div', { html: 'W 为 <b>每指宽度</b>，总宽 = W × nf（与 rf018.scs 子电路 <code>m0 … w=wr m=nr</code> 一致）。每指宽度必须落在模型 bin 的表征范围内，否则界面会提示。' }));
    return el('div', null, [el('div.field-grid', null, [fW, fNf, fL]), hint]);
  }
  function biasFields(onChange) {
    return el('div.field-grid', null, [
      U.numberField({ label: 'Vgs', value: state.Vgs, step: 0.05, unit: 'V', onChange: (v) => { state.Vgs = v; onChange(); } }),
      U.numberField({ label: 'Vds', value: state.Vds, step: 0.05, unit: 'V', onChange: (v) => { state.Vds = v; onChange(); } }),
      U.numberField({ label: 'Vbs', value: state.Vbs, step: 0.1, unit: 'V', onChange: (v) => { state.Vbs = v; onChange(); } })
    ]);
  }
  function opSummary(r) {
    if (!r || r.error) return note('<b>错误：</b>' + (r ? r.error : '无结果'));
    const sgn = r.type === 'p' ? -1 : 1;
    return kvTable([
      { section: '直流工作点' },
      { label: '工作区', value: { cutoff: '截止', subthreshold: '亚阈值', linear: '线性/三极管', saturation: '饱和区' }[r.region] || r.region, cls: 'hl' },
      { label: 'Vth', value: num(r.Vth, 4), unit: 'V' },
      { label: 'Vov = Vgs − Vth', value: num(r.Vov, 4), unit: 'V' },
      { label: 'Vdsat', value: num(Math.abs(r.Vdsat), 4), unit: 'V' },
      { label: 'Id', value: eng(r.Id, 3), unit: 'A' },
      { label: 'Id / 总宽', value: num(Math.abs(r.IdPerUm) * 1e6, 2), unit: 'µA/µm' },
      { label: 'Id / 每指', value: eng(r.IdPerFinger, 3), unit: 'A' },
      { section: '小信号' },
      { label: 'gm', value: eng(r.gm, 3), unit: 'S' },
      { label: 'gm / Id', value: num(r.gmId, 2), unit: '1/V' },
      { label: 'gds', value: eng(r.gds, 3), unit: 'S' },
      { label: 'ro = 1/gds', value: eng(r.ro, 3), unit: 'Ω' },
      { label: '本征增益 gm·ro', value: num(r.gainIntrinsic, 1) + ' (' + num(20 * Math.log10(Math.max(r.gainIntrinsic, 1e-9)), 1) + ' dB)' },
      { label: 'gmbs', value: eng(Math.abs(r.gmbs), 3), unit: 'S' },
      { section: '器件内部量 (BSIM3)' },
      { label: 'Leff / Weff (每指)', value: (r.Leff * 1e6).toFixed(4) + ' / ' + (r.Weff * 1e6).toFixed(4), unit: 'µm' },
      { label: '总宽 W×nf', value: (r.Wtotal * 1e6).toFixed(2), unit: 'µm' },
      { label: '亚阈值因子 n', value: num(r.n, 3) },
      { label: '亚阈值摆幅 SS', value: num(r.subthresholdSwing, 1), unit: 'mV/dec' },
      { label: 'µeff', value: num(r.muEff * 1e4, 1), unit: 'cm²/Vs' },
      { label: 'Abulk', value: num(r.Abuk === undefined ? r.Abulk : r.Abulk, 4) },
      { label: 'Vgsteff', value: num(Math.abs(r.Vgsteff), 4), unit: 'V' },
      { label: 'Early 电压 VA', value: eng(r.VA, 3), unit: 'V' },
      { label: 'Rds (模型 rdsw)', value: num(r.Rds, 1), unit: 'Ω' },
      { label: 'Cox', value: num(r.Cox * 1e3, 4), unit: 'fF/µm²' },
      { label: 'fT', value: eng(r.fT, 3), unit: 'Hz' }
    ]);
  }
  function tabDC(host, refresh) {
    const d = dev();
    const resBox = el('div.results'), chartBox = el('div.charts'), cornerBox = el('div');
    function draw() {
      const r = run();
      clear(resBox); resBox.appendChild(opSummary(r));
      clear(chartBox);
      if (r && !r.error) {
        const sgn = r.type === 'p' ? -1 : 1;
        const vgsMax = Math.min(2.4, Math.abs(r.Vth) + 1.1);
        const sw = C.sweepVgs(d, cornerId(), cfg(), { from: 0, to: vgsMax, points: 90 });
        clear(chartBox);
        chartBox.appendChild(chart({
          height: 250, x: { label: 'Vgs (V)' }, y: { label: 'Id (A)', log: true }, y2: { label: 'gm/Id (1/V)' },
          series: [
            { name: 'Id', data: sw.map((p) => [p.x, Math.abs(p.Id)]), color: '#4ea1ff' },
            { name: '亚阈值区', data: sw.filter((p) => p.region !== 'saturation').map((p) => [p.x, Math.abs(p.Id)]), color: '#ff7b72', dash: true },
            { name: 'gm/Id', data: sw.map((p) => [p.x, p.gmId]), color: '#59d99b', axis: 'y2' }
          ],
          hLines: [{ y: sgn * state.Vgs, label: '当前 Vgs' }]
        }));
        const vdsMax = Math.min(2.4, Math.abs(state.Vdd) + 0.4);
        const sw2 = C.sweepVds(d, cornerId(), cfg(), { from: 0, to: vdsMax, points: 90 });
        chartBox.appendChild(chart({
          height: 250, x: { label: 'Vds (V)' }, y: { label: 'Id (A)' },
          series: [
            { name: 'Id(Vds)', data: sw2.map((p) => [p.x, Math.abs(p.Id)]), color: '#ffb84d' },
            { name: 'gds', data: sw2.map((p) => [p.x, Math.abs(p.gds)]), color: '#c792ea', axis: 'y2', dash: true }
          ],
          y2: { label: 'gds (S)', log: true },
          hLines: [{ y: Math.abs(r.Vds), label: '当前 Vds' }]
        }));
      }
      clear(cornerBox);
      const rows = []; let maxId = 0; const per = [];
      if (d && d.corners) {
        for (const cid of Object.keys(d.corners)) {
          const rr = C.op(d, cid, cfg());
          if (rr.error) continue;
          per.push({ cid: cid, r: rr });
          maxId = Math.max(maxId, Math.abs(rr.Id));
        }
      }
      for (const p of per) {
        const rr = p.r;
        rows.push([
          cornerInfo(p.cid).label || p.cid,
          num(rr.Vth, 4), eng(Math.abs(rr.Id), 3),
          '<div class="bar"><span style="width:' + (100 * Math.abs(rr.Id) / (maxId || 1)).toFixed(1) + '%"></span></div>',
          num(rr.gmId, 2), eng(rr.gainIntrinsic, 2), eng(rr.fT, 3)
        ]);
      }
      cornerBox.appendChild(card('工艺角对照 (同一尺寸与偏置)', [gridTable(['工艺角', 'Vth (V)', 'Id', '相对电流', 'gm/Id (1/V)', 'gm·ro', 'fT'], rows)]));
    }
    host.appendChild(el('div.panel-2col', null, [
      card('尺寸与偏置', [geoFields(draw), biasFields(draw), note('W 为 <b>每指宽度</b>，总宽 = W × nf（与 rf018.scs 子电路 <code>w=wr m=nr</code> 一致）。')]),
      card('计算结果', [resBox])
    ]));
    host.appendChild(el('div.panel-2col', null, [chartBox]));
    host.appendChild(cornerBox);
    draw();
  }
  function tabSolve(host) {
    const local = { mode: 'Id', target: 100, variable: 'W', L: state.L, W: state.W, nf: state.nf, IdForGmId: 100 };
    const resBox = el('div.results'), outBox = el('div');
    const targetField = U.numberField({ label: '目标值', value: 100, unit: '', step: 'any', hint: 'Id: µA · gm: µS · gm/Id: 1/V · 本征增益: 倍数', onChange: (v) => { local.target = v; draw(); } });
    const modeSel = U.selectField({
      label: '求解目标', value: 'Id',
      options: [
        { value: 'Id', label: '目标电流 Id' }, { value: 'gm', label: '目标跨导 gm' },
        { value: 'gmId', label: '目标 gm/Id' }, { value: 'gain', label: '目标本征增益 gm·ro' },
        { value: 'Vov', label: '目标过驱动 Vov' }
      ],
      onChange: (v) => { local.mode = v; syncTarget(); draw(); }
    });
    const varSel = U.selectField({
      label: '求解变量', value: 'W',
      options: [{ value: 'W', label: '每指宽度 W' }, { value: 'Vgs', label: '栅压 Vgs' }, { value: 'L', label: '沟长 L' }],
      onChange: (v) => { local.variable = v; draw(); }
    });
    function syncTarget() {
      const map = { Id: 100, gm: 200, gmId: 15, gain: 40, Vov: 0.2 };
      local.target = map[local.mode];
      targetField.setValue(local.target);
    }
    const geoBox = el('div');
    function draw() {
      clear(geoBox);
      const sgn = dev().type === 'p' ? -1 : 1;
      if (local.variable !== 'W') geoBox.appendChild(U.numberField({ label: 'W (每指)', value: local.W, step: 0.1, unit: 'µm', onChange: (v) => { local.W = v; draw(); } }));
      geoBox.appendChild(U.numberField({ label: '指数 nf', value: local.nf, step: 1, unit: '', width: '72px', onChange: (v) => { local.nf = Math.max(1, Math.round(v)); draw(); } }));
      if (local.variable !== 'L') geoBox.appendChild(U.numberField({ label: 'L', value: local.L, step: 0.01, unit: 'µm', onChange: (v) => { local.L = v; draw(); } }));
      if (local.variable !== 'Vgs') geoBox.appendChild(U.numberField({ label: 'Vgs', value: sgn * state.Vgs, step: 0.05, unit: 'V', onChange: (v) => { state.Vgs = sgn * v; draw(); } }));
      if (local.mode === 'gmId' && local.variable === 'W') geoBox.appendChild(U.numberField({ label: '目标 Id (gm/Id 模式)', value: local.IdForGmId, step: 10, unit: 'µA', onChange: (v) => { local.IdForGmId = v; draw(); } }));
      geoBox.appendChild(U.numberField({ label: 'Vds', value: sgn * state.Vds, step: 0.05, unit: 'V', onChange: (v) => { state.Vds = sgn * v; draw(); } }));
      geoBox.appendChild(U.numberField({ label: 'Vbs', value: sgn * state.Vbs, step: 0.1, unit: 'V', onChange: (v) => { state.Vbs = sgn * v; draw(); } }));
      const base = {
        W: local.W * 1e-6, L: local.L * 1e-6, nf: local.nf,
        Vgs: sgn * state.Vgs, Vds: sgn * state.Vds, Vbs: sgn * state.Vbs, T: T0 + state.T, type: dev().type
      };
      let r = null, label = '';
      if (local.mode === 'gain') { const L = C.solveLForGain(dev(), cornerId(), base, local.target); r = L; label = 'L = ' + (L.solved ? (L.solved.L * 1e6).toFixed(4) + ' µm' : '—'); }
      else if (local.variable === 'L') {
        const f = (L) => metric(C.op(dev(), cornerId(), Object.assign({}, base, { L: L * 1e-6 })), local.mode) - local.target;
        const Lv = C.bisect(f, 0.18, 20);
        r = isFinite(Lv) ? C.op(dev(), cornerId(), Object.assign({}, base, { L: Lv * 1e-6 })) : { error: '在 L = 0.18 ~ 20 µm 内无解' };
        label = 'L = ' + (isFinite(Lv) ? Lv.toFixed(4) + ' µm' : '—');
      } else if (local.variable === 'W') {
        if (local.mode === 'Id') {
          r = C.solveWidthForId(dev(), cornerId(), base, local.target * 1e-6);
          if (r.solved) label = 'W = ' + (r.solved.Wf * 1e6).toFixed(4) + ' µm/指 × ' + r.solved.nf + ' 指 (总宽 ' + (r.solved.Wtotal * 1e6).toFixed(2) + ' µm)';
        } else if (local.mode === 'gm') {
          const f = (W) => Math.abs(C.op(dev(), cornerId(), Object.assign({}, base, { W })).gm) - local.target * 1e-6;
          const Wf = C.bisect(f, 0.1e-6, 5e-3);
          r = isFinite(Wf) ? C.op(dev(), cornerId(), Object.assign({}, base, { W: Wf })) : { error: '无解' };
          label = 'W = ' + (isFinite(Wf) ? (Wf * 1e6).toFixed(4) + ' µm/指' : '—');
        } else if (local.mode === 'gmId') {
          const t = C.solveVgsForGmId(dev(), cornerId(), base, local.target);
          if (t.error) { r = t; } else {
            const Ides = local.IdForGmId * 1e-6;
            const Wr = C.solveWidthForId(dev(), cornerId(), Object.assign({}, base, { Vgs: t.solved.Vgs }), Ides);
            r = Wr;
            label = 'Vgs = ' + t.solved.Vgs.toFixed(4) + ' V (gm/Id = ' + t.gmId.toFixed(2) + ')，' +
              (Wr.solved ? 'W = ' + (Wr.solved.Wf * 1e6).toFixed(4) + ' µm/指 × ' + Wr.solved.nf + ' 指 (总宽 ' + (Wr.solved.Wtotal * 1e6).toFixed(2) + ' µm) @ ' + eng(Math.abs(Wr.Id), 3) + 'A' : (Wr.error || '—'));
          }
        } else if (local.mode === 'Vov') {
          const f = (W) => Math.abs(C.op(dev(), cornerId(), Object.assign({}, base, { W })).Vov) - local.target;
          const Wf = C.bisect(f, 0.1e-6, 5e-3);
          r = isFinite(Wf) ? C.op(dev(), cornerId(), Object.assign({}, base, { W: Wf })) : { error: '无解' };
          label = 'W = ' + (isFinite(Wf) ? (Wf * 1e6).toFixed(4) + ' µm/指' : '—');
        }
      } else {
        if (local.mode === 'Id') {
          r = C.solveVgsForId(dev(), cornerId(), base, local.target * 1e-6);
          if (r.solved) label = 'Vgs = ' + r.solved.Vgs.toFixed(4) + ' V';
        } else if (local.mode === 'gm') {
          const f = (v) => Math.abs(C.op(dev(), cornerId(), Object.assign({}, base, { Vgs: sgn * v })).gm) - local.target * 1e-6;
          const v = C.bisect(f, 0, 2.2);
          r = isFinite(v) ? C.op(dev(), cornerId(), Object.assign({}, base, { Vgs: sgn * v })) : { error: '无解' };
          label = 'Vgs = ' + (isFinite(v) ? (sgn * v).toFixed(4) + ' V' : '—');
        } else if (local.mode === 'gmId') {
          r = C.solveVgsForGmId(dev(), cornerId(), base, local.target);
          if (r.solved) label = 'Vgs = ' + r.solved.Vgs.toFixed(4) + ' V';
        } else if (local.mode === 'Vov') {
          const f = (v) => Math.abs(C.op(dev(), cornerId(), Object.assign({}, base, { Vgs: sgn * v })).Vov) - local.target;
          const v = C.bisect(f, 0, 2.2);
          r = isFinite(v) ? C.op(dev(), cornerId(), Object.assign({}, base, { Vgs: sgn * v })) : { error: '无解' };
          label = 'Vgs = ' + (isFinite(v) ? (sgn * v).toFixed(4) + ' V' : '—');
        }
      }
      clear(resBox);
      resBox.appendChild(el('div.solved', { html: '<b>求解结果：</b> ' + (r && !r.error ? label : (r.error || '无解')) }));
      clear(outBox);
      if (r && !r.error) { outBox.appendChild(el('h4', { text: '该工作点明细' })); outBox.appendChild(opSummary(r)); }
    }
    function metric(r, mode) {
      if (!r || r.error) return NaN;
      if (mode === 'Id') return Math.abs(r.Id);
      if (mode === 'gm') return Math.abs(r.gm);
      if (mode === 'gmId') return r.gmId;
      if (mode === 'Vov') return Math.abs(r.Vov);
      if (mode === 'gain') return r.gainIntrinsic;
      return NaN;
    }
    host.appendChild(el('div.panel-2col', null, [
      card('设计反解', [modeSel, targetField, varSel, geoBox, note('反向求解基于对引擎的单调二分搜索（W、L、Vgs 对目标量均单调）。求解 W 时以指数 nf 为约束，输出为每指宽度。')]),
      card('结果', [resBox, outBox])
    ]));
    draw();
  }
  function tabGmId(host) {
    const local = { from: 4, to: 28, points: 30, L: state.L, Vds: Math.abs(state.Vds) };
    const chartBox = el('div'), tableBox = el('div'), solveBox = el('div.results');
    const st = { gmIdTarget: 12, IdTarget: 100 };
    function draw() {
      const sgn = dev().type === 'p' ? -1 : 1;
      const base = cfg({ L: local.L * 1e-6, Vds: sgn * local.Vds });
      const sw = C.sweepGmId(dev(), cornerId(), base, { from: local.from, to: local.to, points: local.points });
      clear(chartBox);
      if (sw.length) {
        const WoverL = (state.W * state.nf) / local.L;
        chartBox.appendChild(chart({
          height: 300, x: { label: 'gm/Id (1/V)' }, y: { label: 'Id / (W/L)  (A)', log: true }, y2: { label: 'fT (Hz)', log: true },
          series: [
            { name: 'Id/(W/L)', data: sw.map((p) => [p.gmId, p.IdPerWL]), color: '#4ea1ff' },
            { name: 'fT', data: sw.map((p) => [p.gmId, p.fT]), color: '#ffb84d', axis: 'y2' }
          ],
          hLines: [{ x: st.gmIdTarget }]
        }));
      }
      clear(tableBox);
      tableBox.appendChild(gridTable(
        ['gm/Id (1/V)', 'Vgs (V)', 'Vov (V)', 'Id/(W/L) (µA)', 'fT (GHz)', 'gm·ro', '工作区'],
        sw.filter((p, i) => i % Math.max(1, Math.floor(sw.length / 12)) === 0).map((p) => [
          num(p.gmId, 1), num(p.Vgs, 4), num(p.Vov, 3), num(p.IdPerWL * 1e6, 3),
          num(p.fT / 1e9, 2), num(p.gain, 1), p.region
        ])
      ));
      clear(solveBox);
      const gid = st.gmIdTarget, Idt = st.IdTarget * 1e-6;
      const r1 = C.solveVgsForGmId(dev(), cornerId(), base, gid);
      if (r1.error) solveBox.appendChild(note(r1.error));
      else {
        const Wr = C.solveWidthForId(dev(), cornerId(), Object.assign({}, base, { Vgs: r1.solved.Vgs }), Idt);
        solveBox.appendChild(kvTable([
          { section: '按目标 gm/Id 选尺寸' },
          { label: '目标 gm/Id', value: num(gid, 2), unit: '1/V' },
          { label: '所需 Vgs', value: num(r1.solved.Vgs, 4), unit: 'V' },
          { label: '该点 Id/(W/L)', value: num(Math.abs(r1.Id) / (r1.Wtotal / r1.L) * 1e6, 3), unit: 'µA' },
          { label: '目标电流 Id', value: eng(Idt, 3), unit: 'A' },
          { label: '所需总宽 W', value: Wr.solved ? num(Wr.solved.Wtotal * 1e6, 2) : '—', unit: 'µm', cls: 'hl' },
          { label: '推荐指数 / 每指宽度', value: Wr.solved ? (Wr.solved.nf + ' 指 × ' + num(Wr.solved.Wf * 1e6, 4) + ' µm') : '—' },
          { label: '校验 Id', value: Wr.solved ? eng(Wr.Id, 3) : (Wr.error || '—'), unit: Wr.solved ? 'A' : '' },
          { label: '校验 gm/Id', value: Wr.solved ? num(Wr.gmId, 2) : '—', unit: Wr.solved ? '1/V' : '' },
          { label: 'fT', value: Wr.solved ? eng(Wr.fT, 3) : '—', unit: Wr.solved ? 'Hz' : '' },
          { label: '本征增益', value: Wr.solved ? num(Wr.gainIntrinsic, 1) : '—' }
        ]));
      }
    }
    host.appendChild(el('div.panel-2col', null, [
      card('扫描设置', [
        U.numberField({ label: 'L', value: local.L, step: 0.01, unit: 'µm', onChange: (v) => { local.L = v; draw(); } }),
        U.numberField({ label: 'Vds', value: local.Vds, step: 0.05, unit: 'V', onChange: (v) => { local.Vds = v; draw(); } }),
        U.numberField({ label: 'gm/Id 起点', value: local.from, step: 0.5, unit: '1/V', onChange: (v) => { local.from = v; draw(); } }),
        U.numberField({ label: 'gm/Id 终点', value: local.to, step: 0.5, unit: '1/V', onChange: (v) => { local.to = v; draw(); } }),
        U.numberField({ label: '点数', value: local.points, step: 5, unit: '', onChange: (v) => { local.points = Math.max(5, Math.round(v)); draw(); } }),
        note('gm/Id 方法与 W 无关：曲线给出每平方 (W/L) 的电流。gm/Id 越大越省功耗但 fT 越低（弱反型）。')
      ]),
      card('按 gm/Id 设计', [
        U.numberField({ label: '目标 gm/Id', value: st.gmIdTarget, step: 0.5, unit: '1/V', onChange: (v) => { st.gmIdTarget = v; draw(); } }),
        U.numberField({ label: '目标 Id', value: st.IdTarget, step: 10, unit: 'µA', onChange: (v) => { st.IdTarget = v; draw(); } }),
        solveBox
      ])
    ]));
    host.appendChild(card('gm/Id 设计曲线', [chartBox]));
    host.appendChild(card('数据点', [tableBox]));
    draw();
  }
  function tabRF(host) {
    const local = { Rg: 0, f1: 1e3, f2: 1e6, freq: 1e4 };
    const box = el('div');
    function draw() {
      const r = run({ Rg: local.Rg > 0 ? local.Rg : undefined });
      clear(box);
      if (r.error) { box.appendChild(note(r.error)); return; }
      const caps = r.caps, cp = r.capsPerFinger;
      let layCaps = null;
      if (dev().layout && (!caps.Cdb || caps.Cdb === 0)) {
        const lay = C.rfLayout(dev(), cornerId(), Math.round(state.nf), state.W * 1e-6, state.L * 1e-6);
        if (!lay.error) layCaps = lay;
      }
      const CdbTxt = caps.Cdb > 0 ? eng(caps.Cdb, 3) + ' F' : (layCaps ? eng(layCaps.CdbFull, 3) + ' F <span class="u">(版图公式, 总器件)</span>' : '—');
      const CsbTxt = caps.Csb > 0 ? eng(caps.Csb, 3) + ' F' : (layCaps ? eng(layCaps.CsbFull, 3) + ' F <span class="u">(版图公式, 总器件)</span>' : '—');
      const Rg = local.Rg > 0 ? local.Rg : 0;
      const rowsp = [
        { section: '电容 (总器件, 近似)' },
        { label: 'Cgs (含交叠)', value: eng(caps.Cgs, 3), unit: 'F' },
        { label: 'Cgd (含交叠)', value: eng(caps.Cgd, 3), unit: 'F' },
        { label: 'Cgb', value: eng(caps.Cgb, 3), unit: 'F' },
        { label: 'Cdb (漏-衬底)', html: CdbTxt },
        { label: 'Csb (源-衬底)', html: CsbTxt },
        { label: 'Cox·W·L 总', value: eng(caps.CoxArea, 3), unit: 'F' },
        { label: 'Cgs/Cgd 每指', value: eng(cp.Cgs, 3) + ' / ' + eng(cp.Cgd, 3), unit: 'F' },
        { section: '高频指标' },
        { label: 'fT = gm/2π(Cgs+Cgd)', value: eng(r.fT, 3), unit: 'Hz', cls: 'hl' },
        { label: 'fmax (需输入 Rg)', value: Rg > 0 ? eng(r.fmax, 3) : '—', unit: Rg > 0 ? 'Hz' : '' },
        { label: 'gm', value: eng(r.gm, 3), unit: 'S' },
        { label: 'Cgg 总', value: eng(caps.Cgs + caps.Cgd + caps.Cgb, 3), unit: 'F' },
        { section: '噪声 (器件端口, 总器件)' },
        { label: '热噪声 S_id(f)', value: eng(r.noise.SidThermalTotal, 3), unit: 'A²/Hz' },
        { label: '1/f @1kHz', value: eng(r.noise.SidFlicker1k, 3), unit: 'A²/Hz' },
        { label: '1/f @10kHz', value: eng(r.noise.SidFlicker10k, 3), unit: 'A²/Hz' },
        { label: '输入参考 @1kHz', value: eng(Math.sqrt(r.noise.SidFlicker1k + r.noise.SidThermalTotal) / Math.abs(r.gm), 3), unit: 'V/√Hz' },
        { label: 'N0 / Nl (1/f 模型)', value: eng(r.noise.N0, 2) + ' / ' + eng(r.noise.Nl, 2), unit: '' }
      ];
      box.appendChild(el('div.panel-2col', null, [
        card('电容与高频', [kvTable(rowsp)]),
        card('噪声谱密度', [noiseChart(r)])
      ]));
      box.appendChild(el('div.panel-2col', null, [
        card('射频子电路版图寄生 (直接取自 rf018.scs 公式)', [layoutTable(r)]),
        card('说明', [note('电容为 Meyer 类近似（饱和区本征 Cgs≈⅔WLCox，线性区各 ½），交叠电容按 cgso/cgdo(+cgsl/cgdl)·Weff；结电容用 cj/cjsw/cjswg 的分级模型。<br>噪声：热噪声用 BSIM3 NOIMOD=2 公式 S<sub>id</sub>=4kT·µ<sub>eff</sub>|Q<sub>inv</sub>|/(L<sub>eff</sub>²+µ|Q<sub>inv</sub>|R<sub>ds</sub>)；1/f 用 BSIM3v3.24 统一闪烁噪声模型（noia/noib/noic/ef）。<br>版图寄生仅对 RF 器件可用，直接按 rf018.scs 子电路中的 rg/rs/rd/cgs_m/cgd_m/cds_m 与衬底二极管公式计算。')])
      ]));
    }
    function noiseChart(r) {
      const f1 = local.f1, f2 = local.f2;
      if (!isFinite(f1) || !isFinite(f2) || f1 <= 0 || f2 <= 0) return note('频率范围无效');
      const pts = [], ptsIn = [];
      for (let i = 0; i <= 60; i++) {
        const f = f1 * Math.pow(f2 / f1, i / 60);
        const sid = r.noise.flicker(f) + r.noise.SidThermalTotal;
        pts.push([f, sid]);
        ptsIn.push([f, Math.sqrt(sid) / Math.abs(r.gm)]);
      }
      const gm = Math.abs(r.gm);
      const kT = 1.380649e-23 * (T0 + state.T);
      return el('div', null, [
        chart({ height: 260, x: { label: '频率', log: true }, y: { label: 'S_id (A²/Hz)', log: true }, series: [{ name: 'S_id(f)', data: pts, color: '#4ea1ff' }] }),
        chart({
          height: 240, x: { label: '频率', log: true }, y: { label: '输入参考噪声 (V/√Hz)', log: true },
          series: [
            { name: 'S_vg^(1/2)', data: ptsIn, color: '#59d99b' },
            { name: '热噪声底 4kT·γ/gm', data: pts.map((p) => [p[0], Math.sqrt(4 * kT * 2 / 3 * gm) / gm]), color: '#ffb84d', dash: true }
          ]
        }),
        el('div.field-grid', null, [
          U.numberField({ label: '起始频率', value: local.f1, step: 100, unit: 'Hz', onChange: (v) => { local.f1 = v; draw(); } }),
          U.numberField({ label: '截止频率', value: local.f2, step: 1e4, unit: 'Hz', onChange: (v) => { local.f2 = v; draw(); } }),
          U.numberField({ label: '栅电阻 Rg (0=忽略)', value: local.Rg, step: 1, unit: 'Ω', onChange: (v) => { local.Rg = v; draw(); } })
        ]),
        note('积分噪声 (f1→f2): <b>' + eng(intNoise(r, f1, f2), 3) + ' Vrms</b>（含 1/f 与热噪声）')
      ]);
    }
    function intNoise(r, f1, f2) {
      const n = 200, gm = Math.abs(r.gm);
      let sum = 0;
      for (let i = 0; i < n; i++) {
        const fa = f1 * Math.pow(f2 / f1, i / n), fb = f1 * Math.pow(f2 / f1, (i + 1) / n);
        const s = (r.noise.flicker((fa + fb) / 2) + r.noise.SidThermalTotal) / (gm * gm);
        sum += s * (fb - fa);
      }
      return Math.sqrt(sum);
    }
    function layoutTable(r) {
      const d = dev();
      if (!d.layout) return note('该器件没有 RF 子电路版图公式（仅 RF 器件有）。');
      const lay = C.rfLayout(d, cornerId(), Math.round(state.nf), state.W * 1e-6, state.L * 1e-6);
      if (lay.error) return note(lay.error);
      const rows = [
        { section: '电阻 (Ω)' },
        { label: 'Rg (栅)', value: num(lay.Rg, 2), unit: 'Ω' },
        { label: 'Rs (源)', value: num(lay.Rs, 3), unit: 'Ω' },
        { label: 'Rd (漏)', value: num(lay.Rd, 3), unit: 'Ω' },
        { label: 'Rb (衬底网络)', value: num(lay.Rb, 2), unit: 'Ω' },
        { label: 'Rdb', value: num(lay.params.rdb, 2), unit: 'Ω' },
        { section: '版图电容 (F)' },
        { label: 'cgs_m', value: eng(lay.CgsLayout, 3), unit: 'F' },
        { label: 'cgd_m', value: eng(lay.CgdLayout, 3), unit: 'F' },
        { label: 'cds_m', value: eng(lay.elements.cds_m ? lay.elements.cds_m.value : NaN, 3), unit: 'F' },
        { label: 'Cdb (ddd+ddg, 总器件)', value: eng(lay.CdbFull, 3), unit: 'F' },
        { label: 'Csb (dss+dsg, 总器件)', value: eng(lay.CsbFull, 3), unit: 'F' },
        { section: '版图几何' },
        { label: 'Lod (整个器件长度)', value: num(lay.params.lod * 1e6, 2), unit: 'µm' },
        { label: '衬底二极管面积', value: eng(lay.diodes.dss ? lay.diodes.dss.area : NaN, 3), unit: 'm²' },
        { label: '衬底二极管周长', value: eng(lay.diodes.dss ? lay.diodes.dss.pj : NaN, 3), unit: 'm' }
      ];
      return el('div', null, [kvTable(rows), U.button('用该 Rg (' + num(lay.Rg, 1) + ' Ω) 计算 fmax', () => { local.Rg = lay.Rg; draw(); })]);
    }
    host.appendChild(el('div.panel-2col', null, [
      card('尺寸与偏置', [geoFields(draw), biasFields(draw)]),
      card('说明与快捷键', [note('先选器件、工况，再在下方看电容/噪声/版图寄生。RF 器件的 Rg 可由版图公式估算后一键填入，用于 fmax。')])
    ]));
    host.appendChild(box);
    draw();
  }
  function tabMirror(host) {
    const local = { Iref: 50, Lref: 0.5, Wref: 1.5, nfRef: 1, Lout: 0.5, Wout: 1.5, nfOut: 4, Vout: 0.6 };
    const box = el('div'), mmBox = el('div');
    function draw() {
      const d = dev();
      const r = C.currentMirror({
        dev: d, cornerId: cornerId(), type: d.type,
        Lref: local.Lref * 1e-6, Wref: local.Wref * 1e-6, nfRef: local.nfRef,
        Lout: local.Lout * 1e-6, Wout: local.Wout * 1e-6, nfOut: local.nfOut,
        Iref: local.Iref * 1e-6, Vout: local.Vout, Vdd: state.Vdd
      });
      clear(box);
      if (r.error) { box.appendChild(note(r.error)); return; }
      box.appendChild(kvTable([
        { section: '电流镜工作点' },
        { label: '参考支路 Vgs', value: num(r.Vgs, 4), unit: 'V', cls: 'hl' },
        { label: '参考电流 Iref', value: eng(r.refCurrent, 3), unit: 'A' },
        { label: '输出电流 Iout', value: eng(r.outCurrent, 3), unit: 'A' },
        { label: '实际镜像比', value: num(r.mirrorRatio, 3) },
        { label: '输出管 Vdsat (最小 Vout)', value: num(r.VoutMin, 4), unit: 'V' },
        { label: '输出管 ro', value: eng(r.roOut, 3), unit: 'Ω' },
        { label: '参考管 ro', value: eng(r.roRef, 3), unit: 'Ω' },
        { label: '输出摆幅余量', value: r.headroom === undefined ? '—' : num(r.headroom, 3), unit: 'V' },
        { section: '随机失配 (1σ)' },
        { label: 'ΔVth (两管之差)', value: eng(r.sigmaVthPair, 3), unit: 'V' },
        { label: 'σ(Δβ/β)', value: num(r.sigmaBetaRel * 100, 3), unit: '%' },
        { label: 'σ(Iout/Iout) 相对', value: num(r.sigmaIrel * 100, 3), unit: '%', cls: 'hl' },
        { label: 'σ(Iout) 绝对', value: eng(r.sigmaI, 3), unit: 'A' }
      ]));
      clear(mmBox);
      const mm = (d.corners[cornerId()] || {}).mismatch || {};
      const series = [];
      for (const nfO of [1, 4, 16]) {
        const pts = [];
        for (let k = 0; k < 40; k++) {
          const scale = Math.pow(10, -0.3 + k * 0.09);
          const mmR = C.mismatch(mm, local.Wref, local.Lref, local.nfRef);
          const mmO = C.mismatch(mm, local.Wout * scale, local.Lout, nfO);
          const vth = Math.sqrt(mmR.sigmaVthSingle ** 2 + mmO.sigmaVthSingle ** 2);
          const db = Math.sqrt(mmR.sigmaDlRel ** 2 + mmR.sigmaDwRel ** 2 + mmO.sigmaDlRel ** 2 + mmO.sigmaDwRel ** 2);
          const rel = Math.sqrt((vth * r.ref.gmId) ** 2 + db ** 2);
          pts.push([local.Wout * scale * nfO * local.Lout, rel * 100]);
        }
        series.push({ name: 'nf_out = ' + nfO, data: pts, points: false });
      }
      mmBox.appendChild(chart({
        height: 260, x: { label: '输出管面积 W·L (µm²)', log: true }, y: { label: 'σ(Iout/Iout) (%)', log: true }, series: series
      }));
    }
    host.appendChild(el('div.panel-2col', null, [
      card('电流镜参数', [
        U.numberField({ label: '参考电流 Iref', value: local.Iref, step: 5, unit: 'µA', onChange: (v) => { local.Iref = v; draw(); } }),
        el('h4', { text: '参考管 (二极管连接)' }),
        U.numberField({ label: 'L_ref', value: local.Lref, step: 0.01, unit: 'µm', onChange: (v) => { local.Lref = v; draw(); } }),
        U.numberField({ label: 'W_ref (每指)', value: local.Wref, step: 0.1, unit: 'µm', onChange: (v) => { local.Wref = v; draw(); } }),
        U.numberField({ label: 'nf_ref', value: local.nfRef, step: 1, unit: '', onChange: (v) => { local.nfRef = Math.max(1, Math.round(v)); draw(); } }),
        el('h4', { text: '输出管' }),
        U.numberField({ label: 'L_out', value: local.Lout, step: 0.01, unit: 'µm', onChange: (v) => { local.Lout = v; draw(); } }),
        U.numberField({ label: 'W_out (每指)', value: local.Wout, step: 0.1, unit: 'µm', onChange: (v) => { local.Wout = v; draw(); } }),
        U.numberField({ label: 'nf_out', value: local.nfOut, step: 1, unit: '', onChange: (v) => { local.nfOut = Math.max(1, Math.round(v)); draw(); } }),
        U.numberField({ label: '输出节点 Vout', value: local.Vout, step: 0.05, unit: 'V', onChange: (v) => { local.Vout = v; draw(); } })
      ]),
      card('结果', [box])
    ]));
    host.appendChild(card('失配 vs 面积 (1σ, 含参考管失配)', [mmBox]));
    draw();
  }
  function tabOpamp(host) {
    const local = {
      devIn: 'nmos_rf', devLoad: 'pmos_rf', dev2: 'pmos_rf',
      Ibias: 20, Lin: 0.5, Win: 3, nfin: 4, Vdsin: 0.6,
      Lload: 0.5, Wload: 3, nfload: 4,
      L2: 0.5, W2: 10, nf2: 1,
      Cc: 1, CL: 2, Rz: 0, Vdd: 1.8
    };
    const box = el('div');
    function draw() {
      const T = T0 + state.T;
      const dIn = devById(local.devIn), dLd = devById(local.devLoad), d2 = devById(local.dev2);
      if (!dIn || !dLd || !d2) { clear(box); box.appendChild(note('器件不存在，请检查选择。')); return; }
      const sIn = dIn.type === 'p' ? -1 : 1, sLd = dLd.type === 'p' ? -1 : 1, s2 = d2.type === 'p' ? -1 : 1;
      const inBase = { W: local.Win * 1e-6, L: local.Lin * 1e-6, nf: local.nfin, Vds: sIn * local.Vdsin, Vbs: 0, T: T, type: dIn.type };
      const rin = C.solveVgsForId(dIn, cornerFor(local.devIn), inBase, local.Ibias * 1e-6);
      if (rin.error) { clear(box); box.appendChild(note('输入对无解：' + rin.error)); return; }
      const loadBase = { W: local.Wload * 1e-6, L: local.Lload * 1e-6, nf: local.nfload, Vds: sLd * local.Vdsin, Vbs: 0, T: T, type: dLd.type };
      const rload = C.solveVgsForId(dLd, cornerFor(local.devLoad), loadBase, local.Ibias * 1e-6);
      const outBase = { W: local.W2 * 1e-6, L: local.L2 * 1e-6, nf: local.nf2, Vds: s2 * local.Vdsin, Vbs: 0, T: T, type: d2.type };
      const rout = C.solveVgsForId(d2, cornerFor(local.dev2), outBase, local.Ibias * 2e-6);
      const gm1 = Math.abs(rin.gm), ro1 = rin.ro;
      const ro3 = rload.error ? ro1 : rload.ro;
      const gm2 = rout.error ? gm1 : Math.abs(rout.gm), ro2 = rout.error ? ro1 : rout.ro;
      const r1 = (ro1 * ro3) / (ro1 + ro3);
      const r2 = ro2;
      const one = C.otaSingle({ gm1, ro1, ro3, CL: local.CL * 1e-12, Itail: 2 * local.Ibias * 1e-6, noiseDensity: rin.noise.SidThermalTotal / (gm1 * gm1) });
      const two = C.otaTwoStage({ gm1, gm2, ro1: r1, ro2: r2, Cc: local.Cc * 1e-12, CL: local.CL * 1e-12, Rz: local.Rz, Itail: local.Ibias * 1e-6 });
      clear(box);
      box.appendChild(el('div.panel-2col', null, [
        card('器件与偏置 (由 BSIM3 引擎求解)', [
          kvTable([
            { section: '输入对 (每边 ' + local.Ibias + ' µA)' },
            { label: 'Vgs (求解)', value: num(rin.solved.Vgs, 4), unit: 'V' },
            { label: 'gm', value: eng(gm1, 3), unit: 'S' },
            { label: 'ro', value: eng(ro1, 3), unit: 'Ω' },
            { label: 'Vdsat', value: num(Math.abs(rin.Vdsat), 3), unit: 'V' },
            { label: 'gm/Id', value: num(rin.gmId, 2), unit: '1/V' },
            { label: 'fT', value: eng(rin.fT, 3), unit: 'Hz' },
            { section: '负载 (电流镜)' },
            { label: rload.error ? '负载无解' : 'Vgs (求解)', value: rload.error ? '—' : num(rload.solved.Vgs, 4), unit: 'V' },
            { label: 'ro', value: eng(ro3, 3), unit: 'Ω' },
            { section: '第二级输出管 (2×Ibias)' },
            { label: rout.error ? '无解' : 'Vgs (求解)', value: rout.error ? '—' : num(rout.solved.Vgs, 4), unit: 'V' },
            { label: 'gm2', value: eng(gm2, 3), unit: 'S' },
            { label: 'ro2', value: eng(ro2, 3), unit: 'Ω' }
          ])
        ]),
        card('单级 5T OTA', [
          kvTable([
            { label: '第一级输出电阻 ro1∥ro3', value: eng(r1, 3), unit: 'Ω' },
            { label: '直流增益', value: num(one.gain, 1) + ' (' + num(one.gainDb, 1) + ' dB)', cls: 'hl' },
            { label: 'GBW = gm1/2πCL', value: eng(one.GBW, 3), unit: 'Hz' },
            { label: '尾电流 Itail', value: eng(2 * local.Ibias * 1e-6, 3), unit: 'A' },
            { label: '压摆率 SR = Itail/CL', value: eng(one.SR, 3), unit: 'V/s' },
            { label: '输入参考热噪声', value: eng(one.VnInput, 3), unit: 'V/√Hz' },
            { label: '相位裕度 (单极点)', value: '≈90', unit: '°' }
          ])
        ])
      ]));
      box.appendChild(card('两级 Miller 补偿 OTA (一级 gm1/ro1∥ro3, 二级 gm2/ro2)', [
        el('div.panel-3col', null, [
          kvTable([{ section: '增益' }, { label: 'A1', value: eng(two.A1, 3) }, { label: 'A2', value: eng(two.A2, 3) }, { label: '总增益', value: num(two.gain, 0) + ' (' + num(two.gainDb, 1) + ' dB)', cls: 'hl' }]),
          kvTable([{ section: '频率' }, { label: '主极点 p1', value: eng(two.p1, 3), unit: 'Hz' }, { label: '次极点 p2', value: eng(two.p2, 3), unit: 'Hz' }, { label: 'GBW', value: eng(two.GBW, 3), unit: 'Hz', cls: 'hl' }, { label: '零点 z', value: eng(two.z, 3), unit: 'Hz' }, { label: '相位裕度 (≈)', value: num(two.PM, 1), unit: '°' }]),
          kvTable([{ section: '大信号/噪声' }, { label: 'SR = Ibias/Cc', value: eng(two.SR, 3), unit: 'V/s' }, { label: '输入参考噪声', value: eng(two.VnInput, 3), unit: 'V/√Hz' }, { label: '所需 Cc (PM=60°)', value: eng(2.2 * gm1 / (2 * Math.PI * two.p2), 3), unit: 'F' }])
        ]),
        note('相位裕度按 PM ≈ 90° − atan(GBW/p2) 估算；含 Cc 引入的右半平面零点（可用 Rz 调零，当前 Rz = ' + local.Rz + ' Ω）。 结果为一阶手算，用于选型，最终请用 Spectre 验证。')
      ]));
    }
    host.appendChild(card('设计输入', [
      el('div.field-grid', null, [
        U.selectField({ label: '输入对器件', value: local.devIn, options: deviceOptions(), onChange: (v) => { local.devIn = v; draw(); } }),
        U.selectField({ label: '负载器件 (电流镜)', value: local.devLoad, options: deviceOptions(), onChange: (v) => { local.devLoad = v; draw(); } }),
        U.selectField({ label: '第二级输出管', value: local.dev2, options: deviceOptions(), onChange: (v) => { local.dev2 = v; draw(); } }),
        U.numberField({ label: '每边偏置 Ibias', value: local.Ibias, step: 5, unit: 'µA', onChange: (v) => { local.Ibias = v; draw(); } }),
        U.numberField({ label: '输入对/负载 Vds', value: local.Vdsin, step: 0.05, unit: 'V', onChange: (v) => { local.Vdsin = v; draw(); } }),
        U.numberField({ label: '输入对 L', value: local.Lin, step: 0.05, unit: 'µm', onChange: (v) => { local.Lin = v; draw(); } }),
        U.numberField({ label: '输入对 W/指', value: local.Win, step: 0.5, unit: 'µm', onChange: (v) => { local.Win = v; draw(); } }),
        U.numberField({ label: '输入对 nf', value: local.nfin, step: 1, unit: '', onChange: (v) => { local.nfin = Math.max(1, Math.round(v)); draw(); } }),
        U.numberField({ label: '负载 L', value: local.Lload, step: 0.05, unit: 'µm', onChange: (v) => { local.Lload = v; draw(); } }),
        U.numberField({ label: '负载 W/指', value: local.Wload, step: 0.5, unit: 'µm', onChange: (v) => { local.Wload = v; draw(); } }),
        U.numberField({ label: '负载 nf', value: local.nfload, step: 1, unit: '', onChange: (v) => { local.nfload = Math.max(1, Math.round(v)); draw(); } }),
        U.numberField({ label: '第二级 W/指', value: local.W2, step: 1, unit: 'µm', onChange: (v) => { local.W2 = v; draw(); } }),
        U.numberField({ label: '第二级 nf', value: local.nf2, step: 1, unit: '', onChange: (v) => { local.nf2 = Math.max(1, Math.round(v)); draw(); } }),
        U.numberField({ label: 'Cc', value: local.Cc, step: 0.1, unit: 'pF', onChange: (v) => { local.Cc = v; draw(); } }),
        U.numberField({ label: 'CL', value: local.CL, step: 0.5, unit: 'pF', onChange: (v) => { local.CL = v; draw(); } }),
        U.numberField({ label: 'Rz (调零, 0=无)', value: local.Rz, step: 100, unit: 'Ω', onChange: (v) => { local.Rz = v; draw(); } })
      ]),
      note('三个器件独立选择（工艺角跟随各器件所属族别，在顶部切换）。每级器件都按“给定电流求 Vgs”的方式由 BSIM3 引擎求解，因此 ro 与该偏置下真实工作点一致；负载管按同样电流求解 Vgs（用于估算 ro3），实际电路中共模由反馈决定，ro 值相差很小。')
    ]));
    host.appendChild(box);
    draw();
  }
  function tabModel(host) {
    const box = el('div');
    function draw() {
      const d = dev(), cid = cornerId(), c = d.corners[cid] || {};
      const r = run();
      clear(box);
      const mm = c.mismatch || {};
      const binRows = (c.bins || []).map((b) => [b.bin, (b.lmin * 1e6).toFixed(3), (b.lmax * 1e6).toFixed(3), (b.wmin * 1e6).toFixed(3), (b.wmax * 1e6).toFixed(3)]);
      box.appendChild(el('div.panel-2col', null, [
        card('器件与模型卡', [kvTable([
          { label: '器件', value: d.label },
          { label: '模型卡名', value: d.modelName },
          { label: '类型 / 电压域', value: (d.type === 'n' ? 'NMOS' : 'PMOS') + ' / ' + d.voltage + 'V' },
          { label: '子电路', value: d.subckt || '(顶层 model)' },
          { label: '工艺角', value: (cornerInfo(cid).label || cid) + '  (' + c.section + ')' },
          { label: '当前 L/W 所在 bin', value: r && !r.error ? ('#' + r.bin + (r.binExact ? '' : ' (超出表征范围, 已就近取用)')) : '—' },
          { section: '失配系数 (rf018 失配子电路)' },
          { label: 'Avt(Vth)', value: eng(mm.avtV, 3), unit: 'V·µm' },
          { label: 'Adl(ΔL/L)', value: eng(mm.avtDl, 3) },
          { label: 'Adw(ΔW/W)', value: eng(mm.avtDw, 3) },
          { label: 'Atox(Δtox/tox)', value: eng(mm.avtTox, 3) },
          { label: 'σ_Vth = Avt/√(WL)', value: r && !r.error ? eng(mm.avtV / Math.sqrt(r.Wtotal * 1e6 * r.L * 1e6), 3) : '—', unit: 'V' }
        ])]),
        card('bin 覆盖范围 (µm)', [gridTable(['bin', 'Lmin', 'Lmax', 'Wmin', 'Wmax'], binRows)])
      ]));
      box.appendChild(card('当前实际使用的器件参数 (已应用 bin 修正与温度)', [paramsTable(r)]));
      box.appendChild(el('div.panel-2col', null, [
        card('指数 nf / 几何的默认值来源', [nfExplain(d)]),
        card('子电路默认几何参数', [subcktDefaults(d)])
      ]));
      box.appendChild(card('模型文件中的工艺角全局参数 (节选)', [globalsTable(c.globals)]));
      box.appendChild(card('计算引擎说明', [note('<b>实现依据</b>：BSIM3v3 方程取自 Eldo Device Equations Manual (AMS 2009.2) BSIM3v3 章节，含 Vth（含 RSCE/DIBL/NWE）、亚阈值 Vgsteff、迁移率退化 (MOBMOD)、Abulk、Rds、Vdsat、Vdseff 平滑、CLM/DIBL/SCBE Early 电压、温度模型 (KT1/KT2/UTE/AT/PRT) 与噪声模型 (NOIMOD=2)。<br><b>尺寸处理</b>：L<sub>eff</sub> = L + XL − 2·LINT，W<sub>eff</sub> = W + XW − 2·WINT；参数按 BSIM3 binning 公式 P + LP/L<sub>eff</sub> + WP/W<sub>eff</sub> + PP/(L<sub>eff</sub>W<sub>eff</sub>) 修正；每次计算为 <b>单指</b> 器件，总电流 = nf × 单指电流。<br><b>PMOS</b>：全部电压与 VTH0 取反后按 N 型等效计算（与 TSMC PMOS 卡片的符号约定一致：vth0<0、k1>0）。<br><b>已知近似</b>：电容为 Meyer 类近似 + 交叠/结电容解析式（非 CAPMOD=3 精确电荷分配）；gm/gds/gmbs 用 1 mV 中心差分；PHI 未在 rf018.scs 中给出，采用 BSIM3 默认 0.7 V。<br><b>用途</b>：快速选型/手算校核。最终设计请以 Spectre/HSPICE 用同一 rf018.scs 仿真为准。')]));
    }
    function paramsTable(r) {
      if (!r || r.error) return note('无结果');
      const P = r.P || {};
      const names = ['vth0', 'k1', 'k2', 'k3', 'k3b', 'w0', 'nlx', 'dvt0', 'dvt1', 'dvt2', 'eta0', 'etab', 'dsub', 'nfactor', 'cit', 'cdsc', 'cdscb', 'cdscd', 'voff', 'u0', 'ua', 'ub', 'uc', 'vsat', 'a0', 'a1', 'a2', 'ags', 'b0', 'b1', 'keta', 'rdsw', 'prwg', 'prwb', 'wr', 'pclm', 'pdiblc1', 'pdiblc2', 'pdiblcb', 'pscbe1', 'pscbe2', 'pvag', 'delta', 'tox', 'toxm', 'xj', 'nch', 'lint', 'wint', 'xl', 'xw', 'ldif', 'hdif', 'rsh', 'cgso', 'cgdo', 'cgbo', 'cgsl', 'cgdl', 'cj', 'cjsw', 'cjswg', 'pb', 'pbsw', 'mj', 'mjsw', 'js', 'jsw', 'kt1', 'kt1l', 'kt2', 'ute', 'at', 'prt', 'ua1', 'ub1', 'uc1', 'noia', 'noib', 'noic', 'nstar', 'ef', 'em', 'noimod', 'capmod', 'mobmod', 'version', 'tnom'];
      const rows = [];
      for (let i = 0; i < names.length; i += 3) rows.push(names.slice(i, i + 3).map((n) => n + ' = ' + fmtP(P[n])));
      return gridTable(['参数', '', ''], rows.map((r2) => [r2[0] || '', r2[1] || '', r2[2] || '']), { cls: 'params' });
    }
    function nfExplain(d) {
      const fd = fileDefaults(d.id);
      const rows = [
        { section: '模型卡里' },
        { label: 'BSIM3 卡 (' + d.modelName + ') 是否有 nf/nr', value: '没有 —— BSIM3 模型描述单个器件，不存在“指数”这个参数' },
        { section: '文件里的默认值' }
      ];
      if (fd) {
        rows.push({ label: '子电路', value: fd.subckt + ' ( d g s b )' });
        rows.push({ label: '参数行', value: 'parameters lr=' + (fd.L).toExponential(2) + ' nr=' + fd.nf + ' wr=' + (fd.W).toExponential(2) + ' …' });
        rows.push({ label: '内部 MOSFET 实例', value: 'm0 (di gi si bi) ' + d.modelName + ' l=lr w=wr m=nr → nf = m = nr' });
        rows.push({ label: '文件默认尺寸', value: 'L = ' + (fd.L * 1e6).toFixed(2) + ' µm, 每指 W = ' + (fd.W * 1e6).toFixed(2) + ' µm, nf = ' + fd.nf, cls: 'hl' });
      } else rows.push({ label: '默认尺寸', value: '无 —— 顶层模型卡不出现在子电路里，L/W/nf 全部由网表实例给定' });
      rows.push({ section: '为什么还需要你设置' });
      rows.push({ label: '① 它是实例参数', value: '调用时覆盖：X1 d g s b ' + (d.subckt || d.modelName) + ' lr=… nr=… wr=…（或 nch 用 w/l/nf）' });
      const cor = d.corners[cid] || {};
      const wminUm = cor.wmin ? (cor.wmin * 1e6).toFixed(3) : '—';
      const wmaxUm = cor.wmax ? (cor.wmax * 1e6).toFixed(3) : '—';
      rows.push({ label: '② 决定每指宽度', value: '模型 bin 只对每指 W 有效（' + wminUm + '–' + wmaxUm + ' µm），总宽 = W×nf' });
      rows.push({ label: '③ 影响 Vth/Id 本身', value: 'binning 的 W 相关修正项 (WVTH0、WK1、WU0…) 按每指 W_eff 计算，所以 Id 不是随 nf 严格线性' });
      rows.push({ label: '④ 版图/RF 要求', value: 'Rg ∝ 1/nf，源漏结电容可共享；失配 ∝ 1/√(W·L·nf)' });
      return kvTable(rows);
    }
    function subcktDefaults(d) {
      const fd = fileDefaults(d.id);
      if (!fd) return note('该器件在 rf018.scs 中是顶层 <code>model</code> 卡（不是子电路），因此没有 lr/nr/wr 一类版图默认参数。');
      const rows = [
        { section: '器件几何（可被实例覆盖）' },
        { label: 'lr (沟长)', value: (fd.L * 1e6).toFixed(3), unit: 'µm' },
        { label: 'wr (每指宽度)', value: (fd.W * 1e6).toFixed(3), unit: 'µm' },
        { label: 'nr (指数)', value: String(fd.nf), unit: '指' },
        { section: '版图参数（决定寄生）' }
      ];
      const names = { lspace: 'lspace 指间距', ledge: 'ledge 扩散外延', ledgeeff: 'ledgeeff 有效外延', lsti: 'lsti STI 长度', wsti: 'wsti STI 宽度', rod: 'rod 扩散方块电阻', rsti: 'rsti STI 方块电阻' };
      for (const k in names) {
        if (fd.extra[k] !== undefined) {
          const v = fd.extra[k], isOhm = k === 'rod' || k === 'rsti';
          rows.push({ label: names[k], value: isOhm ? v.toFixed(0) : (v * 1e6).toFixed(3), unit: isOhm ? 'Ω/□' : 'µm' });
        }
      }
      rows.push({ section: '这些默认值用在哪里' });
      rows.push({ label: '版图寄生页', value: '④ 小信号/RF/噪声 页的 rg/rs/rd/cgs_m/cgd_m/cds_m 与衬底二极管面积/周长直接按这些参数计算' });
      return el('div', null, [kvTable(rows), note('数值直接解析自 rf018.scs 的 <code>' + fd.subckt + '</code> 参数行；工具里把 nr 解释为指数 nf、wr 为每指宽度、lr 为沟长。')]);
    }
    function fmtP(v) {
      if (v === undefined || v === null) return '—';
      if (typeof v === 'string') return v;
      if (v === 0) return '0';
      const a = Math.abs(v);
      if (a >= 1e5 || a < 1e-4) return v.toExponential(4);
      return String(+v.toPrecision(6));
    }
    function globalsTable(g) {
      const keys = Object.keys(g || {}).sort(), rows = [];
      for (let i = 0; i < keys.length; i += 3) rows.push([0, 1, 2].map((k) => { const n = keys[i + k]; return n === undefined ? '' : n + ' = ' + fmtP(g[n]); }));
      return gridTable(['工艺角参数', '', ''], rows);
    }
    host.appendChild(box);
    draw();
    return draw;
  }
  function boot() {
    const app = U.$('#app');
    clear(app);
    const tabsHost = el('nav.tabs'), panels = el('main.panels');
    const TABS = [
      { id: 'dc', label: '① 工作点 (Vth/Id)', render: tabDC },
      { id: 'solve', label: '② 设计反解 (算 W/Vgs/L)', render: tabSolve },
      { id: 'gmId', label: '③ gm/Id 设计曲线', render: tabGmId },
      { id: 'rf', label: '④ 小信号 / RF / 噪声', render: tabRF },
      { id: 'mirror', label: '⑤ 电流镜 / 失配', render: tabMirror },
      { id: 'opamp', label: '⑥ 运放设计', render: tabOpamp },
      { id: 'model', label: '⑦ 模型参数 / 公式', render: tabModel }
    ];
    function renderTab() {
      clear(panels);
      const t = TABS.find((x) => x.id === state.tab) || TABS[0];
      const panel = el('div.tab-panel');
      panels.appendChild(panel);
      t.render(panel, () => { /* per-tab refresh handled internally */ });
      for (const b of tabsHost.children) b.classList.toggle('active', b.dataset.tab === t.id);
      if (location.hash.slice(1) !== t.id) {
        try { history.replaceState(null, '', '#' + t.id); } catch (e) { /* file:// */ }
      }
    }
    app.appendChild(header());
    app.appendChild(deviceBar(() => renderTab()));
    for (const t of TABS) tabsHost.appendChild(el('button.tab', { text: t.label, 'data-tab': t.id, onclick: () => { state.tab = t.id; renderTab(); } }));
    app.appendChild(tabsHost);
    app.appendChild(panels);
    const h = (location.hash || '').replace('#', '');
    if (h && TABS.some((t) => t.id === h)) state.tab = h;
    window.addEventListener('hashchange', () => {
      const hh = (location.hash || '').replace('#', '');
      if (hh && TABS.some((t) => t.id === hh) && hh !== state.tab) { state.tab = hh; renderTab(); }
    });
    app.appendChild(el('footer.foot', { html: '模型来源：rf018.scs (TSMC 0.18µm RF SPICE Model, ' + (M.meta.docNo || '') + ' v' + (M.meta.version || '') + ', BSIM3 v' + (M.meta.bsimVersion || '') + ')。计算为 BSIM3 方程式解析求解，用于设计选型与手算校核；流片前请用 Spectre/HSPICE 复算。生成时间 ' + (M.meta.generatedAt || '') + '。' }));
    renderTab();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
