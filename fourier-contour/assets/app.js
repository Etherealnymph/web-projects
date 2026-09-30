/*!
 * app.js —— 圆上之圆 · 轮廓傅里叶绘图工具 界面逻辑
 * 依赖：fourier-core.js（数学核心）、examples.js（内置示例文档，可选）
 *
 * 支持单轮廓（顶层 terms）与多轮廓（顶层 contours，含内部孔洞）两种参数文档。
 */
(function () {
  'use strict';

  var FC = window.FourierCore;
  var TAU = Math.PI * 2;
  var $ = function (id) { return document.getElementById(id); };
  var clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  var SAMPLES = 1440;          // 最大轮廓的轨迹采样点数
  var METER = 320;             // 误差统计用的采样点数（控制拖动滑块时的开销）
  var ZOOM_MIN = 0.05, ZOOM_MAX = 12;   // 缩放范围
  var WHEEL_SENS = 0.0015;              // 滚轮灵敏度（指数缩放，一格约 ±16%）

  /* 多轮廓配色 */
  var PALETTE = ['#3fd8c0', '#f2a44e', '#9d8cf0', '#e879a8', '#7fd45a', '#59b8f0', '#e0c05a', '#c78cf0'];

  /* ==================================================================
   * 通用小工具
   * ================================================================== */
  function showNote(el, text, kind) {
    if (!el) return;
    el.className = 'note on ' + (kind || '');
    el.textContent = text;
  }
  function hideNote(el) { if (el) { el.className = 'note'; el.textContent = ''; } }

  function downloadText(filename, text) {
    var blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.top = '-1000px'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }

  function copyText(text, noteEl) {
    var done = function (ok) {
      showNote(noteEl, ok ? '✔ 已复制到剪贴板' : '✘ 复制失败，请手动全选复制', ok ? 'ok' : 'err');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); },
        function () { done(fallbackCopy(text)); });
    } else {
      done(fallbackCopy(text));
    }
  }

  function setStat(id, text) { var el = $(id); if (el) el.textContent = text; }
  function fmtSec(v) { return (v >= 10 ? v.toFixed(1) : v.toFixed(2)) + ' s'; }

  /* ==================================================================
   * 视图切换
   * ================================================================== */
  var VIEWS = ['play', 'extract', 'format'];
  var currentView = 'play';

  function switchView(name) {
    if (VIEWS.indexOf(name) < 0) return;
    currentView = name;
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      t.classList.toggle('on', t.dataset.view === name);
    });
    VIEWS.forEach(function (v) { $('view-' + v).classList.toggle('on', v === name); });
    if (name === 'play') { resizeAnimCanvas(); }
    if (name === 'extract') { drawPreview(); }
  }

  /* ==================================================================
   * 视图一：参数文档 → 动图
   * ================================================================== */
  var P = {
    doc: null,
    parsed: null,
    contours: [],        // [{terms, ordered, active, path, bbox, area, role, name, color, k}]
    sel: 0,              // 参数表当前查看的轮廓
    bbox: null,
    t: 0,
    playing: true,
    duration: 10,
    limit: 64,           // 最大轮廓绘制的圆数量
    zoom: 1,
    pan: { x: 0, y: 0 }, // 画布像素偏移（拖动平移）
    opts: { circles: true, radii: true, ghost: false, flip: false, sort: true, grid: true, lineWidth: 1.6 },
    cssW: 800, cssH: 600, dpr: 1,
    lastTs: 0,
    badgeCache: {}
  };

  function applyDocText(text) {
    var parsed;
    try {
      parsed = FC.parseDoc(text);
    } catch (e) {
      showNote($('noteDoc'), '✘ 文档解析失败：\n' + e.message, 'err');
      return false;
    }
    P.doc = parsed.doc;
    P.parsed = parsed;

    // 每个轮廓：预采样求面积（用于按面积分配项数），并分配颜色
    P.contours = parsed.contours.map(function (c, i) {
      var area = Math.abs(FC.signedArea(FC.samplePath(c.terms, 256)));
      return {
        terms: c.terms,
        role: c.role || 'outer',
        name: c.name || ('轮廓 ' + (i + 1)),
        color: PALETTE[i % PALETTE.length],
        area: Math.max(area, 1e-6),
        ordered: [], active: [], path: [], bbox: null, k: 0
      };
    });
    P.sel = 0;

    var totalTerms = parsed.contours.reduce(function (s, c) { return s + c.terms.length; }, 0);
    var maxTerms = parsed.contours.reduce(function (m, c) { return Math.max(m, c.terms.length); }, 0);
    P.limit = clamp(Math.min(maxTerms, 96), 1, Math.max(1, maxTerms));

    var lr = $('limitRange');
    lr.max = String(Math.max(1, maxTerms));
    lr.value = String(P.limit);
    $('limitOut').textContent = String(P.limit);

    var sum = FC.summarize(parsed.doc);
    $('descText').textContent = parsed.description ||
      '（该文档没有 description 字段；建议在开头补上图像说明）';
    setStat('statTerms', totalTerms + (P.contours.length > 1 ? '（' + P.contours.length + ' 轮廓）' : ''));
    setStat('statPoints', sum.pointCount ? String(sum.pointCount) : '—');
    setStat('statNRange', totalTerms ? ('[' + sum.nMin + ', ' + sum.nMax + ']') : '—');
    setStat('statCoverage', (typeof sum.coverage === 'number')
      ? (sum.coverage * 100).toFixed(3) + '%' : '—');

    buildContourSelect();
    rebuild();
    resetView();

    if (parsed.warnings && parsed.warnings.length) {
      showNote($('noteDoc'), '⚠ 已解析 ' + totalTerms + ' 项参数（' + P.contours.length + ' 个轮廓）\n' +
        parsed.warnings.join('\n'), 'warn');
    } else {
      showNote($('noteDoc'), '✔ 已解析 ' + P.contours.length + ' 个轮廓、共 ' + totalTerms + ' 项参数，正在绘制。', 'ok');
    }
    return true;
  }

  function buildContourSelect() {
    var wrap = $('contourPickWrap');
    var sel = $('contourSelect');
    if (!wrap || !sel) return;
    sel.innerHTML = '';
    P.contours.forEach(function (c, i) {
      var o = document.createElement('option');
      o.value = String(i);
      o.textContent = (c.name || ('轮廓 ' + (i + 1))) +
        '（' + (c.role === 'hole' ? '内部孔洞' : '外轮廓') + '，' + c.terms.length + ' 项）';
      sel.appendChild(o);
    });
    sel.value = '0';
    wrap.style.display = P.contours.length > 1 ? '' : 'none';
  }

  var rebuildPending = false;
  function scheduleRebuild() {
    if (rebuildPending) return;
    rebuildPending = true;
    requestAnimationFrame(function () { rebuildPending = false; rebuild(); });
  }

  function rebuild() {
    if (!P.contours.length) { P.bbox = null; return; }

    var maxArea = P.contours.reduce(function (m, c) { return Math.max(m, c.area); }, 1e-9);
    var multi = P.contours.length > 1;
    var totalActive = 0;

    P.contours.forEach(function (c) {
      c.ordered = P.opts.sort
        ? c.terms.slice().sort(function (a, b) { return b.amp - a.amp; })
        : c.terms.slice();
      var k = P.limit;
      if (multi) k = Math.max(6, Math.round(P.limit * Math.sqrt(c.area / maxArea)));
      c.k = clamp(k, 1, c.ordered.length);
      c.active = c.ordered.slice(0, c.k);
      var n = multi ? Math.max(360, Math.round(SAMPLES * Math.sqrt(c.area / maxArea))) : SAMPLES;
      c.path = FC.samplePath(c.active, n);
      c.bbox = FC.bbox(c.path);
      totalActive += c.active.length;
    });

    P.bbox = unionBBox(P.contours.map(function (c) { return c.bbox; }));
    setStat('statSize', P.bbox.width.toFixed(1) + ' × ' + P.bbox.height.toFixed(1));
    setStat('statCoverage', coverageText());

    // 截断误差：当前项数画出的轨迹 vs 全部项画出的轨迹（取所有轮廓里的最大值）
    var worst = 0;
    P.contours.forEach(function (c) {
      if (c.ordered.length <= c.k) return;
      var full = FC.samplePath(c.ordered, METER);
      var cur = FC.samplePath(c.active, METER);
      var dev = FC.curveDeviation(cur, full);
      if (dev.maxDeviation > worst) worst = dev.maxDeviation;
    });
    var diag = Math.hypot(P.bbox.width, P.bbox.height) || 1;
    setStat('statErr', worst > 0
      ? ('±' + worst.toFixed(2) + ' px（' + (worst / diag * 100).toFixed(2) + '%）')
      : '0（全部项）');

    renderTermTable();
    drawLegend();
    updateBadges(true);
  }

  function unionBBox(list) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    list.forEach(function (b) {
      if (!b) return;
      minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY);
      maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY);
    });
    if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 1, height: 1, cx: 0, cy: 0 };
    return {
      minX: minX, minY: minY, maxX: maxX, maxY: maxY,
      width: maxX - minX, height: maxY - minY,
      cx: (minX + maxX) / 2, cy: (minY + maxY) / 2
    };
  }

  function coverageText() {
    var cov = P.doc && P.doc.meta ? P.doc.meta.amplitudeCoverage : undefined;
    return (typeof cov === 'number') ? (cov * 100).toFixed(3) + '%' : '—';
  }

  function renderTermTable() {
    var tb = $('termTable');
    var c = P.contours[clamp(P.sel, 0, P.contours.length - 1)];
    if (!c) { tb.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#4a5966">（无参数）</td></tr>'; return; }
    var rows = c.active.slice(0, 40);
    var maxAmp = rows.reduce(function (m, t) { return Math.max(m, t.amp); }, 0) || 1;
    var html = '';
    for (var i = 0; i < rows.length; i++) {
      var t = rows[i];
      var deg = t.phase * 180 / Math.PI;
      var w = Math.max(1, Math.round(t.amp / maxAmp * 34));
      html += '<tr><td class="i">' + (i + 1) + '</td><td>' + t.n + '</td><td>' + t.amp.toFixed(3) +
        '</td><td>' + deg.toFixed(2) + '°</td><td><span class="bar" style="width:' + w + 'px;background:' +
        c.color + '"></span></td></tr>';
    }
    if (!html) html = '<tr><td colspan="5" style="text-align:center;color:#4a5966">（无参数）</td></tr>';
    tb.innerHTML = html;
    $('termTableHint').textContent = (P.contours.length > 1 ? (c.name + ' · ') : '') +
      (c.active.length > 40 ? ('前 40 / ' + c.active.length + ' 项') : (c.active.length + ' 项'));
  }

  /* ---------------- 画布绘制 ---------------- */
  function resizeAnimCanvas() {
    var c = $('animCanvas');
    if (!c) return;
    var wrap = c.parentElement;
    var w = Math.max(120, wrap.clientWidth), h = Math.max(120, wrap.clientHeight);
    var dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    P.cssW = w; P.cssH = h; P.dpr = dpr;
  }

  /** 只按包围盒算出的「适配比例」（不含用户缩放） */
  function baseFitScale() {
    var b = P.bbox || { width: 1, height: 1 };
    var pad = Math.max(16, Math.min(56, Math.min(P.cssW, P.cssH) * 0.1));
    var sx = (P.cssW - pad * 2) / Math.max(b.width, 1e-6);
    var sy = (P.cssH - pad * 2) / Math.max(b.height, 1e-6);
    var s = Math.min(sx, sy);
    return (isFinite(s) && s > 0) ? s : 1;
  }

  function computeTransform() {
    var b = P.bbox || { width: 1, height: 1, cx: 0, cy: 0 };
    var cx = b.cx || 0, cy = b.cy || 0;
    var s = baseFitScale() * P.zoom;
    return { s: s, ox: P.cssW / 2 - cx * s + P.pan.x, oy: P.cssH / 2 - cy * s + P.pan.y };
  }

  /* ---------------- 缩放 / 平移 ---------------- */
  function zoomToSlider(z) {
    return Math.round(100 * Math.log(clamp(z, ZOOM_MIN, ZOOM_MAX) / ZOOM_MIN) / Math.log(ZOOM_MAX / ZOOM_MIN));
  }
  function sliderToZoom(v) {
    return ZOOM_MIN * Math.pow(ZOOM_MAX / ZOOM_MIN, clamp(Number(v), 0, 100) / 100);
  }

  function syncZoomUI() {
    var zr = $('zoomRange');
    if (zr) zr.value = String(zoomToSlider(P.zoom));
    var zo = $('zoomOut');
    if (zo) zo.textContent = P.zoom.toFixed(2) + '×';
    updateBadges(true);
  }

  /**
   * 设置缩放。给了锚点（画布坐标）就保持锚点下的图形位置不动 —— 滚轮缩放。
   * 没给锚点则以画布中心缩放 —— 滑块缩放。
   */
  function setZoom(z, anchorX, anchorY) {
    var nz = clamp(z, ZOOM_MIN, ZOOM_MAX);
    var ax = (typeof anchorX === 'number') ? anchorX : P.cssW / 2;
    var ay = (typeof anchorY === 'number') ? anchorY : P.cssH / 2;
    var b = P.bbox || { cx: 0, cy: 0 };
    var cx = b.cx || 0, cy = b.cy || 0;
    var fit = baseFitScale();
    var s0 = fit * P.zoom, s1 = fit * nz;
    // 锚点下的图形坐标：p = (a - o0) / s0，缩放后要求 o1 + p*s1 = a
    var px = (ax - (P.cssW / 2 - cx * s0 + P.pan.x)) / s0;
    var py = (ay - (P.cssH / 2 - cy * s0 + P.pan.y)) / s0;
    P.zoom = nz;
    P.pan.x = ax - px * s1 - (P.cssW / 2 - cx * s1);
    P.pan.y = ay - py * s1 - (P.cssH / 2 - cy * s1);
    syncZoomUI();
  }

  function panBy(dx, dy) {
    P.pan.x += dx;
    P.pan.y += dy;
  }

  function resetView() {
    P.zoom = 1;
    P.pan.x = 0;
    P.pan.y = 0;
    syncZoomUI();
  }

  function drawGrid(ctx, W, H) {
    ctx.save();
    ctx.strokeStyle = 'rgba(120,160,190,.055)';
    ctx.lineWidth = 1;
    var step = 44;
    for (var x = (W / 2) % step; x < W; x += step) {
      ctx.beginPath(); ctx.moveTo(Math.round(x) + .5, 0); ctx.lineTo(Math.round(x) + .5, H); ctx.stroke();
    }
    for (var y = (H / 2) % step; y < H; y += step) {
      ctx.beginPath(); ctx.moveTo(0, Math.round(y) + .5); ctx.lineTo(W, Math.round(y) + .5); ctx.stroke();
    }
    ctx.restore();
  }

  function updateBadges(force) {
    var b = P.badgeCache;
    var total = P.contours.reduce(function (s, c) { return s + c.active.length; }, 0);
    var nv = total + (P.contours.length > 1 ? ' / ' + P.contours.length + ' 轮廓' : '');
    var tv = P.t.toFixed(3);
    var sv = (P.duration > 0 ? (1 / P.duration) : 0).toFixed(3);
    var zv = P.zoom.toFixed(2) + '×';
    if (force || b.n !== nv) { $('badgeTerms').textContent = nv; b.n = nv; }
    if (force || b.t !== tv) { $('badgeT').textContent = tv; b.t = tv; }
    if (force || b.s !== sv) { $('badgeSpeed').textContent = sv; b.s = sv; }
    if ($('badgeZoom') && (force || b.z !== zv)) { $('badgeZoom').textContent = zv; b.z = zv; }
  }

  function drawLegend() {
    var box = $('animLegend');
    if (!box) return;
    var html = '';
    if (P.contours.length <= 1) {
      var c0 = P.contours[0];
      var col = c0 ? c0.color : '#3fd8c0';
      html = '<span class="lg"><i style="background:' + col + '"></i>轨迹</span>' +
        '<span class="lg"><i style="background:' + col + ';opacity:.55"></i>半径</span>' +
        '<span class="lg"><i style="background:#5b6c7d"></i>圆</span>';
    } else {
      P.contours.slice(0, 8).forEach(function (c) {
        html += '<span class="lg"><i style="background:' + c.color + '"></i>' +
          (c.role === 'hole' ? '孔 ' : '外 ') + (c.k + ' 项') + '</span>';
      });
      if (P.contours.length > 8) html += '<span class="lg">…共 ' + P.contours.length + ' 个轮廓</span>';
    }
    box.innerHTML = html;
  }

  function strokeContourPath(ctx, path, upto, tip, toX, toY) {
    ctx.beginPath();
    ctx.moveTo(toX(path[0][0]), toY(path[0][1]));
    for (var i = 1; i <= upto; i++) ctx.lineTo(toX(path[i][0]), toY(path[i][1]));
    if (tip) ctx.lineTo(toX(tip[0]), toY(tip[1]));
    ctx.stroke();
  }

  function draw() {
    var c = $('animCanvas');
    if (!c) return;
    var ctx = c.getContext('2d');
    var W = P.cssW, H = P.cssH;
    ctx.setTransform(P.dpr, 0, 0, P.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (P.opts.grid) drawGrid(ctx, W, H);
    if (!P.contours.length || !P.bbox) return;

    var T = computeTransform();
    var flip = P.opts.flip;
    var toX = function (x) { return T.ox + x * T.s; };
    var toY = function (y) { var v = T.oy + y * T.s; return flip ? (H - v) : v; };

    // 原点十字
    ctx.save();
    ctx.strokeStyle = 'rgba(150,180,200,.22)';
    ctx.lineWidth = 1;
    var ox = toX(0), oy = toY(0);
    ctx.beginPath();
    ctx.moveTo(ox - 5, oy); ctx.lineTo(ox + 5, oy);
    ctx.moveTo(ox, oy - 5); ctx.lineTo(ox, oy + 5);
    ctx.stroke();
    ctx.restore();

    // 完整轨迹（幽灵）
    if (P.opts.ghost) {
      ctx.save();
      ctx.lineWidth = 1;
      P.contours.forEach(function (ct) {
        if (!ct.path.length) return;
        ctx.beginPath();
        for (var g = 0; g < ct.path.length; g++) {
          var gx = toX(ct.path[g][0]), gy = toY(ct.path[g][1]);
          if (g === 0) ctx.moveTo(gx, gy); else ctx.lineTo(gx, gy);
        }
        ctx.closePath();
        ctx.strokeStyle = hexA(ct.color, 0.18);
        ctx.stroke();
      });
      ctx.restore();
    }

    var tips = [];

    P.contours.forEach(function (ct) {
      var K = ct.active.length;
      if (!K) return;
      var chain = FC.chainAt(ct.active, P.t);
      var tip = chain[K];
      tips.push({ tip: tip, color: ct.color });

      // 圆
      if (P.opts.circles) {
        ctx.save();
        ctx.lineWidth = 1;
        for (var j = 0; j < K; j++) {
          var r = ct.active[j].amp * T.s;
          if (r < 0.35) continue;
          var alpha = 0.05 + 0.26 * Math.pow(1 - j / K, 1.15);
          ctx.beginPath();
          ctx.arc(toX(chain[j][0]), toY(chain[j][1]), r, 0, TAU);
          ctx.strokeStyle = 'rgba(124,168,200,' + alpha.toFixed(3) + ')';
          ctx.stroke();
        }
        ctx.restore();
      }

      // 半径连线
      if (P.opts.radii) {
        ctx.save();
        ctx.beginPath();
        for (var mm = 0; mm < K; mm++) {
          ctx.moveTo(toX(chain[mm][0]), toY(chain[mm][1]));
          ctx.lineTo(toX(chain[mm + 1][0]), toY(chain[mm + 1][1]));
        }
        ctx.strokeStyle = hexA(ct.color, 0.5);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }

      // 已画出的轨迹
      var M = ct.path.length;
      var upto = Math.min(M - 1, Math.floor(P.t * M));
      ctx.save();
      ctx.strokeStyle = ct.color;
      ctx.lineWidth = P.opts.lineWidth;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.shadowColor = hexA(ct.color, 0.55);
      ctx.shadowBlur = 11;
      strokeContourPath(ctx, ct.path, upto, tip, toX, toY);
      ctx.restore();

      // 起点
      ctx.save();
      ctx.beginPath();
      ctx.arc(toX(ct.path[0][0]), toY(ct.path[0][1]), 2.2, 0, TAU);
      ctx.fillStyle = hexA(ct.color, 0.5);
      ctx.fill();
      ctx.restore();
    });

    // 笔尖
    tips.forEach(function (item) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(toX(item.tip[0]), toY(item.tip[1]), 3.2, 0, TAU);
      ctx.fillStyle = '#ffe9c2';
      ctx.shadowColor = hexA(item.color, 0.9);
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.restore();
    });
  }

  /** #rrggbb + alpha → rgba() */
  function hexA(hex, a) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function updatePlayIcon() {
    $('iconPause').style.display = P.playing ? '' : 'none';
    $('iconPlay').style.display = P.playing ? 'none' : '';
  }

  function setDuration(sec, syncSlider) {
    P.duration = clamp(sec, 0.2, 120);
    if (syncSlider !== false) {
      var dr = $('durationRange');
      dr.value = String(P.duration);
    }
    $('durationOut').textContent = fmtSec(P.duration) + ' · ' + (1 / P.duration).toFixed(2) + ' 圈/秒';
    updateBadges(true);
  }

  function frame(ts) {
    requestAnimationFrame(frame);
    var dt = P.lastTs ? Math.min(0.06, (ts - P.lastTs) / 1000) : 0;
    P.lastTs = ts;
    if (currentView !== 'play') return;         // 不可见时不渲染
    if (P.playing && P.contours.length) {
      P.t += dt / Math.max(0.1, P.duration);
      while (P.t >= 1) P.t -= 1;
      $('progress').value = String(Math.round(P.t * 1000));
    }
    $('clockT').textContent = P.t.toFixed(2) + ' / 1.00';
    updateBadges(false);
    draw();
  }

  /* ---------------- 文档相关按钮 ---------------- */
  function examples() {
    if (window.FOURIER_EXAMPLES && window.FOURIER_EXAMPLES.length) return window.FOURIER_EXAMPLES;
    return Object.keys(FC.SHAPES).slice(0, 6).map(function (k) {
      return {
        id: k,
        name: FC.SHAPES[k].label,
        description: FC.SHAPES[k].note,
        doc: FC.buildDoc({
          points: FC.shapePoints(k, 512, 400),
          name: FC.SHAPES[k].label,
          source: 'builtin:' + k,
          description: FC.SHAPES[k].note,
          termCount: 128, pointCount: 512, origin: 'center'
        })
      };
    });
  }

  function loadExample(id) {
    var list = examples();
    var ex = null;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) ex = list[i];
    if (!ex) for (var j = 0; j < list.length; j++) if (list[j].id === 'heart') ex = list[j];
    if (!ex) ex = list[0];
    var text = FC.serializeDoc(ex.doc);
    $('docText').value = text;
    $('exampleSelect').value = ex.id;
    P.t = 0;
    P.playing = true;
    updatePlayIcon();
    applyDocText(text);
  }

  function readDocFile(file) {
    if (!file) return;
    if (file.text) {
      file.text().then(function (t) { $('docText').value = t; applyDocText(t); },
        function () { showNote($('noteDoc'), '✘ 文件读取失败', 'err'); });
    } else {
      var fr = new FileReader();
      fr.onload = function () { $('docText').value = String(fr.result); applyDocText(String(fr.result)); };
      fr.onerror = function () { showNote($('noteDoc'), '✘ 文件读取失败', 'err'); };
      fr.readAsText(file);
    }
  }

  function exportCurrentTerms() {
    if (!P.contours.length) { showNote($('noteDoc'), '✘ 还没有可导出的参数', 'err'); return; }
    var base = P.doc || {};
    var meta = Object.assign({}, base.meta || {});
    var multi = P.contours.length > 1;
    var total = P.contours.reduce(function (s, c) { return s + c.active.length; }, 0);

    meta.termCount = total;
    meta.sortedBy = P.opts.sort ? 'amplitude-desc' : 'original-order';
    meta.exportedAt = new Date().toISOString();
    meta.notes = '本文件由界面按当前绘制的项数导出：' +
      (multi ? '共 ' + P.contours.length + ' 个轮廓，' : '') + '合计 ' + total + ' 项。';
    if (multi) {
      meta.contourCount = P.contours.length;
      meta.outerCount = P.contours.filter(function (c) { return c.role !== 'hole'; }).length;
      meta.holeCount = P.contours.filter(function (c) { return c.role === 'hole'; }).length;
      delete meta.contours;
    }

    var doc = {
      format: 'fourier-contour',
      version: multi ? 2 : 1,
      description: base.description || '',
      meta: meta
    };
    var toTerms = function (terms) {
      return terms.map(function (t) {
        return { n: t.n, amp: Number(t.amp.toFixed(4)), phase: Number(t.phase.toFixed(6)) };
      });
    };
    if (multi) {
      doc.contours = P.contours.map(function (c) {
        return { role: c.role, name: c.name, terms: toTerms(c.active) };
      });
    } else {
      doc.terms = toTerms(P.contours[0].active);
    }
    downloadText('fourier-contour-' + total + 'terms.json', FC.serializeDoc(doc) + '\n');
    showNote($('noteDoc'), '✔ 已导出当前绘制的 ' + P.contours.length + ' 个轮廓、共 ' + total + ' 项参数', 'ok');
  }

  /* ==================================================================
   * 视图二：图像 → 参数文档
   * ================================================================== */
  var E = {
    name: '（未命名）',
    raw: null,
    srcCanvas: null,
    imageData: null,
    w: 0, h: 0,
    ow: 0, oh: 0,
    hasAlpha: false,
    result: null,
    doc: null,
    recon: [],          // 每个轮廓的重建轨迹（预览叠加用）
    maskCanvas: null,
    busy: false
  };

  var SAMPLES_IMG = [
    { id: 'heart', label: '心形（填充图形）' },
    { id: 'star', label: '五角星（尖角折线）' },
    { id: 'butterfly', label: '蝴蝶（高频细节）' },
    { id: 'rose', label: '玫瑰线（五瓣）' },
    { id: 'pi', label: 'π 字符（衬线字形）' },
    { id: 'ring', label: '圆环（含内孔）' },
    { id: 'target', label: '同心圆环（外圈 + 内孔 + 中心）' },
    { id: 'text8', label: '数字 8（两个内孔）' }
  ];

  function buildSampleImage(id) {
    var S = 512;
    var cv = document.createElement('canvas');
    cv.width = cv.height = S;
    var ctx = cv.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#111111';
    ctx.strokeStyle = '#111111';

    if (id === 'pi') {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 400px "Times New Roman",Georgia,serif';
      ctx.fillText('\u03C0', S / 2, S / 2 + 10);
    } else if (id === 'text8') {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 420px Georgia,"Times New Roman",serif';
      ctx.fillText('8', S / 2, S / 2 + 6);
    } else if (id === 'ring') {
      ctx.beginPath();
      ctx.arc(256, 256, 184, 0, TAU, false);
      ctx.arc(256, 256, 96, 0, TAU, true);
      ctx.fill();
    } else if (id === 'target') {
      ctx.beginPath();
      ctx.arc(256, 256, 200, 0, TAU, false);
      ctx.arc(256, 256, 150, 0, TAU, true);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(256, 256, 96, 0, TAU, false);
      ctx.arc(256, 256, 46, 0, TAU, true);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(256, 256, 22, 0, TAU);
      ctx.fill();
    } else {
      var pts = FC.shapePoints(id, 480, 384);
      ctx.beginPath();
      ctx.moveTo(256 + pts[0][0], 256 + pts[0][1]);
      for (var i = 1; i < pts.length; i++) ctx.lineTo(256 + pts[i][0], 256 + pts[i][1]);
      ctx.closePath();
      ctx.fill();
    }
    return cv;
  }

  function useCanvasAsSource(cv, name, ow, oh) {
    E.raw = { kind: 'canvas', canvas: cv };
    E.name = name;
    E.ow = ow || cv.width;
    E.oh = oh || cv.height;
    refreshSource();
  }

  function useImageElement(img, name) {
    E.raw = { kind: 'image', img: img };
    E.name = name;
    E.ow = img.naturalWidth || img.width;
    E.oh = img.naturalHeight || img.height;
    refreshSource();
  }

  /** 按当前「处理分辨率」把原始来源重新缩放成 E.srcCanvas，并取出像素 */
  function refreshSource() {
    if (!E.raw) return;
    var maxSize = Number($('sizeRange').value) || 320;
    var src = E.raw.kind === 'image' ? E.raw.img : E.raw.canvas;
    var ow = E.ow || src.width, oh = E.oh || src.height;
    var scale = Math.min(1, maxSize / Math.max(ow, oh));
    var w = Math.max(8, Math.round(ow * scale));
    var h = Math.max(8, Math.round(oh * scale));

    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, w, h);

    E.srcCanvas = cv;
    E.w = w; E.h = h;
    E.maskCanvas = null;

    try {
      E.imageData = ctx.getImageData(0, 0, w, h);
    } catch (err) {
      E.imageData = null;
      showNote($('noteImg'), '✘ 浏览器阻止了像素读取（file:// 下的跨域限制）：\n' +
        '请改用「内置示例图」，或通过本地 HTTP 服务打开本页面（例如在该目录执行 npx serve）。', 'err');
      drawPreview();
      return;
    }
    var d = E.imageData.data, minA = 255;
    for (var i = 3; i < d.length; i += 28) { if (d[i] < minA) minA = d[i]; if (minA < 8) break; }
    E.hasAlpha = minA < 250;

    $('dropHint').style.display = 'none';
    processImage();
  }

  function handleImageFile(file) {
    if (!file) return;
    if (!/^image\//.test(file.type || '')) {
      showNote($('noteImg'), '✘ 请选择图片文件（png / jpg / gif / webp / svg）', 'err');
      return;
    }
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      useImageElement(img, file.name);
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      showNote($('noteImg'), '✘ 图片解码失败，请换一张试试', 'err');
    };
    img.src = url;
  }

  function extractOpts() {
    var mode = $('contourMode') ? $('contourMode').value : 'largest';
    var minPct = $('minAreaRange') ? Number($('minAreaRange').value) / 10 : 0.2;    // 0.0–6.0 %
    return {
      mode: $('modeSelect').value,
      threshold: $('chkAutoThr').checked ? null : Number($('thrRange').value),
      invert: $('chkInvert').checked,
      closing: Number($('closingRange').value),
      pointCount: Number($('pointsRange').value),
      smooth: Number($('smoothRange').value),
      includeHoles: mode === 'all',
      minAreaRatio: mode === 'all' ? Math.max(0, minPct / 100) : 0,
      maxContours: mode === 'all' ? Number($('maxContoursRange').value) : 1
    };
  }

  function processImage() {
    if (!E.imageData || E.busy) return;
    E.busy = true;
    var opts = extractOpts();
    try {
      E.result = FC.extractContours(E.imageData, opts);
      E.maskCanvas = null;
      var warns = [];
      if (opts.mode === 'alpha' && !E.hasAlpha) warns.push('该图片没有透明像素，alpha 模式无法分离形状，建议改用「深色为前景」。');
      if (E.result.touchesBorder) warns.push('轮廓接触到图像边缘，形状可能被裁切。');
      if (E.result.contours.length >= opts.maxContours) {
        warns.push('轮廓数量已达上限 ' + opts.maxContours + '，更小的轮廓被忽略（可调「最多轮廓数」或「最小轮廓面积」）。');
      }
      var msg = '✔ 已提取 ' + E.result.contours.length + ' 个轮廓（' +
        E.result.outerCount + ' 外轮廓 / ' + E.result.holeCount + ' 内部孔洞），阈值 ' +
        E.result.threshold.value + (E.result.threshold.auto ? '（Otsu 自动）' : '（手动）');
      if (warns.length) showNote($('noteImg'), '⚠ ' + msg.replace('✔ ', '') + '\n⚠ ' + warns.join('\n⚠ '), 'warn');
      else showNote($('noteImg'), msg, 'ok');
      buildDocFromResult();
    } catch (err) {
      E.result = null; E.doc = null;
      $('extractResult').value = '';
      showNote($('noteImg'), '✘ ' + err.message, 'err');
    }
    E.busy = false;
    drawPreview();
  }

  function buildDocFromResult() {
    if (!E.result) return;
    var res = E.result;
    var K = Number($('keepRange').value);
    var modeLabel = { dark: '深色为前景', light: '浅色为前景', alpha: '透明通道为前景' }[$('modeSelect').value];
    var holeCount = res.contours.filter(function (c) { return c.role === 'hole'; }).length;
    var desc = '由图像「' + E.name + '」提取轮廓生成：原图 ' + E.ow + '×' + E.oh +
      '，处理尺寸 ' + E.w + '×' + E.h + '，前景判定「' + modeLabel + '」，阈值 ' + res.threshold.value +
      (res.threshold.auto ? '（Otsu 自动）' : '（手动）') +
      ($('chkInvert').checked ? ' + 反相' : '') +
      '，闭运算 ' + Number($('closingRange').value) + ' 次，等弧长采样 ' +
      Number($('pointsRange').value) + ' 点、环形平滑窗口 ' + Number($('smoothRange').value) + '。' +
      '共提取 ' + res.contours.length + ' 个轮廓（含 ' + holeCount + ' 个内部孔洞），' +
      '傅里叶展开保留振幅最大的前 ' + K + ' 项（小轮廓按面积自动减少项数）。' +
      '坐标原点在图像左上角，y 轴向下，单位为处理后的像素。';

    var doc = FC.buildDoc({
      contours: res.contours.map(function (c, i) {
        return {
          points: c.points,
          role: c.role,
          name: (c.role === 'hole' ? '内部孔洞 ' : '外轮廓 ') + (i + 1)
        };
      }),
      name: E.name,
      source: 'image:' + E.name,
      description: desc,
      termCount: K,
      pointCount: res.contours[0].points.length,
      width: E.w,
      height: E.h,
      origin: 'top-left',
      unit: 'px',
      scaleTermsByArea: true,
      notes: 'p(t) = Σ amp·e^{i(2π·n·t + phase)}，t∈[0,1)。每个轮廓的 terms 已按振幅从大到小排序。'
    });
    E.doc = doc;
    E.maskCanvas = null;

    // 预览叠加用的重建轨迹
    var parsed = FC.parseDoc(doc);
    E.recon = parsed.contours.map(function (c, i) {
      return {
        path: FC.samplePath(c.terms, Math.max(240, E.result.contours[i].points.length)),
        color: PALETTE[i % PALETTE.length]
      };
    });

    var text = FC.serializeDoc(doc);
    $('extractResult').value = text;
    $('exHint').textContent = (doc.meta.contourCount ? doc.meta.contourCount + ' 轮廓 · ' : '') +
      doc.meta.termCount + ' 项 · ' + (text.length / 1024).toFixed(1) + ' KB';

    var cov = doc.meta.amplitudeCoverage;
    var diag = Math.hypot(doc.meta.coordinate.width, doc.meta.coordinate.height) || 1;
    setStat('exCoverage', (cov * 100).toFixed(3) + '%');
    setStat('exDeviation', doc.meta.maxReconstructError.toFixed(2) + ' px（' +
      (doc.meta.maxReconstructError / diag * 100).toFixed(2) + '%）');
    setStat('exRms', doc.meta.rmsReconstructError.toFixed(3) + ' px');
    setStat('exThreshold', res.threshold.value + (res.threshold.auto ? ' 自动' : ' 手动'));
    setStat('exCount', res.contours.length + '（' + res.outerCount + '+' + res.holeCount + '孔）');
  }

  function maskOverlayCanvas() {
    if (!E.result || !E.result.component) return null;
    if (E.maskCanvas) return E.maskCanvas;
    var w = E.w, h = E.h;
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var ctx = cv.getContext('2d');
    var img = ctx.createImageData(w, h);
    var d = img.data, comp = E.result.component;
    for (var i = 0, p = 0; i < w * h; i++, p += 4) {
      if (comp[i]) { d[p] = 63; d[p + 1] = 216; d[p + 2] = 192; d[p + 3] = 130; }
    }
    ctx.putImageData(img, 0, 0);
    E.maskCanvas = cv;
    return cv;
  }

  function drawPreview() {
    var cv = $('previewCanvas');
    if (!cv || !E.srcCanvas) return;
    var wrap = $('imageDrop');
    var availW = Math.max(80, wrap.clientWidth - 26);
    var availH = Math.max(80, wrap.clientHeight - 26);
    var scale = Math.min(availW / E.w, availH / E.h, 4);
    var dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(E.w * scale * dpr);
    cv.height = Math.round(E.h * scale * dpr);
    cv.style.width = (E.w * scale) + 'px';
    cv.style.height = (E.h * scale) + 'px';
    var ctx = cv.getContext('2d');
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    ctx.clearRect(0, 0, E.w, E.h);
    ctx.drawImage(E.srcCanvas, 0, 0);

    if ($('chkShowMask').checked) {
      var ov = maskOverlayCanvas();
      if (ov) { ctx.globalAlpha = 0.55; ctx.drawImage(ov, 0, 0); ctx.globalAlpha = 1; }
    }
    if (E.result) {
      var poly = function (pts) {
        ctx.beginPath();
        for (var i = 0; i < pts.length; i++) {
          if (i === 0) ctx.moveTo(pts[i][0], pts[i][1]);
          else ctx.lineTo(pts[i][0], pts[i][1]);
        }
        ctx.closePath();
      };
      // 重建轨迹（虚线，同色）
      E.recon.forEach(function (r) {
        if (!r.path.length) return;
        ctx.setLineDash([5 / scale * 1.4, 4 / scale * 1.4]);
        ctx.strokeStyle = hexA(r.color, 0.95);
        ctx.lineWidth = Math.max(0.7, 1.8 / scale * 1.5);
        poly(r.path);
        ctx.stroke();
        ctx.setLineDash([]);
      });
      // 提取到的轮廓
      E.result.contours.forEach(function (c, i) {
        ctx.strokeStyle = hexA(PALETTE[i % PALETTE.length], 0.8);
        ctx.lineWidth = Math.max(0.6, 1.2 / scale * 1.5);
        poly(c.points);
        ctx.stroke();
      });
    }
  }

  /* ==================================================================
   * 初始化与事件绑定
   * ================================================================== */
  function init() {
    var sel = $('exampleSelect');
    examples().forEach(function (ex) {
      var o = document.createElement('option');
      o.value = ex.id; o.textContent = ex.name;
      sel.appendChild(o);
    });
    var ssel = $('sampleSelect');
    SAMPLES_IMG.forEach(function (s) {
      var o = document.createElement('option');
      o.value = s.id; o.textContent = s.label;
      ssel.appendChild(o);
    });

    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      t.addEventListener('click', function () { switchView(t.dataset.view); });
    });

    /* ---- 视图一 ---- */
    sel.addEventListener('change', function () { loadExample(sel.value); });
    $('btnApplyDoc').addEventListener('click', function () {
      if (applyDocText($('docText').value)) { P.t = 0; P.playing = true; updatePlayIcon(); }
    });
    $('btnOpenDoc').addEventListener('click', function () { $('docFile').click(); });
    $('docFile').addEventListener('change', function (e) {
      readDocFile(e.target.files && e.target.files[0]);
      e.target.value = '';
    });
    $('btnDownloadDoc').addEventListener('click', exportCurrentTerms);
    $('btnCopyDoc').addEventListener('click', function () { copyText($('docText').value, $('noteDoc')); });
    $('btnClearDoc').addEventListener('click', function () {
      $('docText').value = '';
      hideNote($('noteDoc'));
      $('descText').textContent = '（尚未载入文档）';
    });

    var ta = $('docText');
    ta.addEventListener('dragover', function (e) { e.preventDefault(); ta.classList.add('drag'); });
    ta.addEventListener('dragleave', function () { ta.classList.remove('drag'); });
    ta.addEventListener('drop', function (e) {
      e.preventDefault(); ta.classList.remove('drag');
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) readDocFile(f);
      else if (e.dataTransfer) { $('docText').value = e.dataTransfer.getData('text'); applyDocText($('docText').value); }
    });

    $('limitRange').addEventListener('input', function () {
      P.limit = Number(this.value);
      $('limitOut').textContent = String(P.limit);
      scheduleRebuild();
    });

    // 速度
    $('durationRange').addEventListener('input', function () {
      setDuration(Number(this.value), false);
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-speed]'), function (btn) {
      btn.addEventListener('click', function () {
        var mult = Number(btn.dataset.speed);
        setDuration(10 / mult, true);
        Array.prototype.forEach.call(document.querySelectorAll('[data-speed]'), function (b) {
          b.classList.toggle('on', b === btn);
        });
      });
    });

    $('widthRange').addEventListener('input', function () {
      P.opts.lineWidth = Number(this.value);
      $('widthOut').textContent = P.opts.lineWidth.toFixed(1);
    });
    $('zoomRange').addEventListener('input', function () {
      setZoom(sliderToZoom(this.value));
    });
    $('btnFit').addEventListener('click', resetView);

    /* ---- 画布交互：滚轮缩放 / 拖动平移 / 双击复位 ---- */
    var canvas = $('animCanvas');
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      var rect = canvas.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var my = e.clientY - rect.top;
      var d = e.deltaY || 0;
      if (e.deltaMode === 1) d *= 16;            // 按行滚动
      else if (e.deltaMode === 2) d *= 100;      // 按页滚动
      d = clamp(d, -140, 140);                   // 触控板小步长也能平滑缩放
      setZoom(P.zoom * Math.exp(-d * WHEEL_SENS), mx, my);
    }, { passive: false });

    var drag = null;
    canvas.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, panX: P.pan.x, panY: P.pan.y };
      canvas.classList.add('dragging');
      if (canvas.setPointerCapture && e.pointerId !== undefined) {
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
      }
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!drag) return;
      e.preventDefault();
      P.pan.x = drag.panX + (e.clientX - drag.x);
      P.pan.y = drag.panY + (e.clientY - drag.y);
    });
    var endDrag = function (e) {
      if (!drag) return;
      drag = null;
      canvas.classList.remove('dragging');
      if (canvas.releasePointerCapture && e && e.pointerId !== undefined) {
        try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
      }
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('dblclick', function (e) { e.preventDefault(); resetView(); });
    [['chkCircles', 'circles'], ['chkRadii', 'radii'], ['chkGhost', 'ghost'],
      ['chkFlip', 'flip'], ['chkGrid', 'grid']].forEach(function (pair) {
        $(pair[0]).addEventListener('change', function () { P.opts[pair[1]] = this.checked; });
      });
    $('chkSort').addEventListener('change', function () {
      P.opts.sort = this.checked;
      rebuild();
    });
    if ($('contourSelect')) {
      $('contourSelect').addEventListener('change', function () {
        P.sel = Number(this.value) || 0;
        renderTermTable();
      });
    }
    $('btnPlay').addEventListener('click', function () {
      P.playing = !P.playing;
      updatePlayIcon();
    });
    $('btnReset').addEventListener('click', function () {
      P.t = 0;
      $('progress').value = '0';
    });
    $('progress').addEventListener('input', function () {
      P.t = Number(this.value) / 1000 || 0;
      if (P.playing) { P.playing = false; updatePlayIcon(); }
    });

    document.addEventListener('keydown', function (e) {
      var tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;
      if (e.code === 'Space') {
        e.preventDefault();
        P.playing = !P.playing;
        updatePlayIcon();
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        setDuration(P.duration / 1.25, true);
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        setDuration(P.duration * 1.25, true);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        P.t = Math.min(0.999, P.t + 0.02);
        P.playing = false; updatePlayIcon();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        P.t = Math.max(0, P.t - 0.02);
        P.playing = false; updatePlayIcon();
      }
    });

    /* ---- 视图二 ---- */
    $('btnPickImage').addEventListener('click', function () { $('imageFile').click(); });
    $('imageFile').addEventListener('change', function (e) {
      handleImageFile(e.target.files && e.target.files[0]);
      e.target.value = '';
    });
    $('btnSample').addEventListener('click', function () {
      var id = $('sampleSelect').value;
      useCanvasAsSource(buildSampleImage(id), '示例图:' + id, 512, 512);
    });

    var drop = $('imageDrop');
    drop.addEventListener('dragover', function (e) {
      e.preventDefault();
      $('dropHint').classList.add('on');
      $('dropHint').style.display = '';
    });
    drop.addEventListener('dragleave', function (e) {
      if (e.target === drop || e.target === $('dropHint')) $('dropHint').classList.remove('on');
    });
    drop.addEventListener('drop', function (e) {
      e.preventDefault();
      $('dropHint').classList.remove('on');
      if (E.srcCanvas) $('dropHint').style.display = 'none';
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      handleImageFile(f);
    });

    var sizeRange = $('sizeRange');
    sizeRange.addEventListener('input', function () { $('sizeOut').textContent = this.value + ' px'; });
    sizeRange.addEventListener('change', function () { if (E.raw) refreshSource(); });

    $('thrRange').addEventListener('input', function () {
      $('thrOut').textContent = this.value;
      $('chkAutoThr').checked = false;
      scheduleExtract();
    });
    $('chkAutoThr').addEventListener('change', scheduleExtract);
    $('chkInvert').addEventListener('change', scheduleExtract);
    $('modeSelect').addEventListener('change', function () {
      $('chkAutoThr').checked = true;
      scheduleExtract();
    });
    $('closingRange').addEventListener('input', function () {
      $('closingOut').textContent = this.value + ' ×';
      scheduleExtract();
    });
    $('pointsRange').addEventListener('input', function () {
      $('pointsOut').textContent = this.value;
      scheduleExtract();
    });
    $('smoothRange').addEventListener('input', function () {
      $('smoothOut').textContent = this.value;
      scheduleExtract();
    });
    $('contourMode').addEventListener('change', function () {
      var all = this.value === 'all';
      $('holeOpts').style.display = all ? '' : 'none';
      scheduleExtract();
    });
    $('minAreaRange').addEventListener('input', function () {
      $('minAreaOut').textContent = (Number(this.value) / 10).toFixed(1) + ' %';
      scheduleExtract();
    });
    $('maxContoursRange').addEventListener('input', function () {
      $('maxContoursOut').textContent = this.value;
      scheduleExtract();
    });
    $('keepRange').addEventListener('input', function () {
      $('keepOut').textContent = this.value;
      if (E.result) buildDocFromResult();
      drawPreview();
    });
    $('chkShowMask').addEventListener('change', drawPreview);
    $('btnExtract').addEventListener('click', function () {
      processImage();
      showNote($('noteEx'), '✔ 已重新生成参数文档（' +
        (E.doc ? (E.doc.meta.contourCount ? E.doc.meta.contourCount + ' 个轮廓、' : '') + E.doc.meta.termCount + ' 项' : '0 项') + '）', 'ok');
    });
    $('btnUseInPlay').addEventListener('click', function () {
      var text = $('extractResult').value;
      if (!text.trim()) { showNote($('noteEx'), '✘ 还没有生成参数文档', 'err'); return; }
      $('docText').value = text;
      P.t = 0; P.playing = true; updatePlayIcon();
      if (applyDocText(text)) {
        $('exampleSelect').selectedIndex = -1;
        switchView('play');
      } else {
        showNote($('noteEx'), '✘ 生成的文档无法解析，请检查文本是否被改动', 'err');
      }
    });
    $('btnDownloadExDoc').addEventListener('click', function () {
      var text = $('extractResult').value;
      if (!text.trim()) { showNote($('noteEx'), '✘ 还没有生成参数文档', 'err'); return; }
      try { FC.parseDoc(text); } catch (e) { showNote($('noteEx'), '✘ ' + e.message, 'err'); return; }
      downloadText('fourier-contour-' + (E.doc ? E.doc.meta.termCount + 'terms' : 'doc') + '.json', text + '\n');
      showNote($('noteEx'), '✔ 已下载参数文档', 'ok');
    });
    $('btnCopyExDoc').addEventListener('click', function () { copyText($('extractResult').value, $('noteEx')); });

    /* ---- 尺寸自适应 ---- */
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () {
        if (currentView === 'play') resizeAnimCanvas();
        if (currentView === 'extract') drawPreview();
      });
      ro.observe($('animCanvas').parentElement);
      ro.observe($('imageDrop'));
    }
    window.addEventListener('resize', function () {
      if (currentView === 'play') resizeAnimCanvas();
      if (currentView === 'extract') drawPreview();
    });

    /* ---- 启动 ---- */
    resizeAnimCanvas();
    updatePlayIcon();
    setDuration(10, true);
    syncZoomUI();
    loadExample('heart');
    requestAnimationFrame(frame);
  }

  var extractTimer = null;
  function scheduleExtract() {
    if (!E.imageData) return;
    if (extractTimer) clearTimeout(extractTimer);
    extractTimer = setTimeout(function () { extractTimer = null; processImage(); }, 90);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
