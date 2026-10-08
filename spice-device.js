
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.UI = Object.assign(root.UI || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function el(tag, attrs, children) {
    const parts = tag.split(/(?=[.#])/);
    const node = document.createElement(parts[0] || 'div');
    for (const p of parts.slice(1)) {
      if (p[0] === '.') node.classList.add(p.slice(1));
      else if (p[0] === '#') node.id = p.slice(1);
    }
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (v !== null && v !== undefined) node.setAttribute(k, v);
      }
    }
    (children || []).forEach((c) => {
      if (c === null || c === undefined) return;
      node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return node;
  }
  const $ = (sel, rootEl) => (rootEl || document).querySelector(sel);
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }
  const SUFF = [[1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'u'], [1e-9, 'n'], [1e-12, 'p'], [1e-15, 'f'], [1e-18, 'a']];
  function eng(x, digits, unit) {
    if (x === undefined || x === null) return '—';
    if (typeof x === 'string') return x;
    if (!isFinite(x)) return x > 0 ? '∞' : (x < 0 ? '-∞' : '—');
    if (x === 0) return '0' + (unit ? ' ' + unit : '');
    const a = Math.abs(x);
    if (a >= 1e15 || a < 1e-18) return x.toExponential(digits === undefined ? 3 : digits) + (unit ? ' ' + unit : '');
    for (const [m, p] of SUFF) {
      if (a >= m * 0.9999) {
        const v = x / m;
        return v.toFixed(digits === undefined ? (Math.abs(v) < 10 ? 3 : Math.abs(v) < 100 ? 2 : 1) : digits) + p + (unit ? ' ' + unit : '');
      }
    }
    return x.toString();
  }
  function num(x, digits, unit) {
    if (x === undefined || x === null || (typeof x === 'number' && !isFinite(x))) return '—';
    return (+x).toFixed(digits === undefined ? 4 : digits) + (unit ? ' ' + unit : '');
  }
  function numberField(spec) {
    const input = el('input', {
      type: 'text',
      value: spec.value === undefined || spec.value === null ? '' : String(spec.value),
      inputmode: 'decimal',
      autocomplete: 'off',
      spellcheck: 'false',
      class: 'nf-input'
    });
    if (spec.width) input.style.width = spec.width;
    const box = el('label.field', null, [
      el('span.field-label', { text: spec.label }),
      el('span.field-body', null, [input, spec.unit ? el('span.unit', { text: spec.unit }) : null]),
      spec.hint ? el('span.hint', { text: spec.hint }) : null
    ]);
    // Do not redraw while the user is typing. Redrawing replaces this input
    // node and previously caused the field to lose focus after one character.
    const numericPattern = /^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?$/;
    let lastCommitted = input.value;
    const commit = () => {
      const raw = input.value.trim();
      if (!numericPattern.test(raw)) {
        input.setCustomValidity(raw ? '请输入有效数字' : '请输入数字');
        return;
      }
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        input.setCustomValidity('请输入有效数字');
        return;
      }
      if ((spec.min !== undefined && value < spec.min) || (spec.max !== undefined && value > spec.max)) {
        input.setCustomValidity('数值超出允许范围');
        return;
      }
      input.setCustomValidity('');
      if (raw === lastCommitted) return;
      lastCommitted = raw;
      if (spec.onChange) spec.onChange(value);
    };
    input.addEventListener('input', () => input.setCustomValidity(''));
    input.addEventListener('change', commit);
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        commit();
        input.blur();
      }
    });
    box.getInput = () => input;
    box.getValue = () => Number(input.value);
    box.setValue = (v) => {
      const value = v === undefined || v === null ? '' : String(v);
      input.value = value;
      lastCommitted = value;
    };
    return box;
  }
  function selectField(spec) {
    const sel = el('select', { class: 'nf-select' });
    for (const o of spec.options) {
      const opt = el('option', { value: o.value, text: o.label });
      if (String(o.value) === String(spec.value)) opt.selected = true;
      if (o.group) {
        let g = sel.querySelector('optgroup[label="' + o.group + '"]');
        if (!g) { g = el('optgroup', { label: o.group }); sel.appendChild(g); }
        g.appendChild(opt);
      } else sel.appendChild(opt);
    }
    const box = el('label.field', null, [
      el('span.field-label', { text: spec.label }),
      el('span.field-body', null, [sel, spec.unit ? el('span.unit', { text: spec.unit }) : null]),
      spec.hint ? el('span.hint', { text: spec.hint }) : null
    ]);
    sel.addEventListener('change', () => spec.onChange && spec.onChange(sel.value));
    box.setValue = (v) => { sel.value = v; };
    box.getValue = () => sel.value;
    box.setOptions = (opts, val) => {
      clear(sel);
      for (const o of opts) {
        const opt = el('option', { value: o.value, text: o.label });
        if (o.group) {
          let g = sel.querySelector('optgroup[label="' + o.group + '"]');
          if (!g) { g = el('optgroup', { label: o.group }); sel.appendChild(g); }
          g.appendChild(opt);
        } else sel.appendChild(opt);
      }
      if (val !== undefined) sel.value = val;
    };
    return box;
  }
  function button(text, onClick, cls) {
    return el('button.btn' + (cls ? '.' + cls : ''), { text: text, onclick: onClick });
  }
  function kvTable(rows, opts) {
    const o = opts || {};
    const t = el('table.kv' + (o.cls ? '.' + o.cls : ''));
    const tb = el('tbody');
    for (const r of rows) {
      if (!r) continue;
      if (r.section) {
        tb.appendChild(el('tr.section', null, [el('td', { colspan: 2, text: r.section })]));
        continue;
      }
      tb.appendChild(el('tr' + (r.cls ? '.' + r.cls : ''), null, [
        el('td.k', { text: r.label }),
        el('td.v', { html: r.html !== undefined ? r.html : String(r.value === undefined ? '—' : r.value) + (r.unit ? ' <span class="u">' + r.unit + '</span>' : '') })
      ]));
    }
    t.appendChild(tb);
    return t;
  }
  function gridTable(headers, rows, opts) {
    const o = opts || {};
    const t = el('table.grid' + (o.cls ? '.' + o.cls : ''));
    const thead = el('thead', null, [el('tr', null, headers.map((h) => el('th', { text: h })))]);
    const tb = el('tbody');
    for (const r of rows) {
      tb.appendChild(el('tr', null, r.map((c) => el('td', { html: c === undefined || c === null ? '—' : String(c) }))));
    }
    t.appendChild(thead); t.appendChild(tb);
    return t;
  }
  function chart(spec) {
    const height = spec.height || 240;
    const wrap = el('div.chart-wrap');
    const canvas = el('canvas.chart');
    wrap.appendChild(canvas);
    const legend = el('div.chart-legend');
    wrap.appendChild(legend);
    function draw() {
      const dpr = window.devicePixelRatio || 1;
      const w = wrap.clientWidth || 560;
      canvas.width = Math.max(200, Math.floor(w * dpr));
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = '100%';
      canvas.style.height = height + 'px';
      const g = canvas.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const W = canvas.width / dpr, H = canvas.height / dpr;
      const padL = 58, padR = spec.y2 ? 58 : 14, padT = 12, padB = 34;
      const iw = W - padL - padR, ih = H - padT - padB;
      g.clearRect(0, 0, W, H);
      g.font = '11px system-ui,Segoe UI,Arial';
      const series = (spec.series || []).filter((s) => s.data && s.data.length);
      if (!series.length) { g.fillStyle = '#888'; g.fillText('无数据', padL, padT + 20); return; }
      const axes = { y: { log: !!(spec.y && spec.y.log) }, y2: { log: !!(spec.y2 && spec.y2.log) } };
      const rng = (ax) => {
        const ss = series.filter((s) => (s.axis || 'y') === ax);
        const key = ax === 'y2' ? 1 : 1;
        let lo = Infinity, hi = -Infinity;
        for (const s of ss) for (const p of s.data) {
          const v = p[key];
          if (v === null || v === undefined || !isFinite(v)) continue;
          if (axes[ax].log && v <= 0) continue;
          if (v < lo) lo = v; if (v > hi) hi = v;
        }
        if (!isFinite(lo)) { lo = 0; hi = 1; }
        if (lo === hi) { hi = lo + Math.abs(lo || 1) * 0.1; lo = lo - Math.abs(lo || 1) * 0.1; }
        if (axes[ax].log) { lo = Math.log10(lo); hi = Math.log10(hi); }
        const pad = (hi - lo) * 0.06;
        const override = ax === 'y' ? spec.y : spec.y2;
        if (override && override.min !== undefined) lo = axes[ax].log ? Math.log10(override.min) : override.min;
        if (override && override.max !== undefined) hi = axes[ax].log ? Math.log10(override.max) : override.max;
        return [lo - pad, hi + pad];
      };
      const [y0, y1] = rng('y');
      const hasY2 = series.some((s) => s.axis === 'y2');
      const [y20, y21] = hasY2 ? rng('y2') : [0, 1];
      let x0 = Infinity, x1 = -Infinity;
      for (const s of series) for (const p of s.data) {
        const v = p[0];
        if (!isFinite(v)) continue;
        if (spec.x && spec.x.log && v <= 0) continue;
        if (v < x0) x0 = v; if (v > x1) x1 = v;
      }
      if (spec.x && spec.x.min !== undefined) x0 = spec.x.min;
      if (spec.x && spec.x.max !== undefined) x1 = spec.x.max;
      if (!(x1 > x0)) { x1 = x0 + 1; }
      const xLog = !!(spec.x && spec.x.log);
      const X = (v) => padL + iw * ((xLog ? Math.log10(v) : v) - (xLog ? Math.log10(x0) : x0)) / ((xLog ? Math.log10(x1) : x1) - (xLog ? Math.log10(x0) : x0));
      const Y = (v, ax) => {
        const [a, b] = ax === 'y2' ? [y20, y21] : [y0, y1];
        const vv = axes[ax] && axes[ax].log ? Math.log10(Math.max(v, 1e-30)) : v;
        return padT + ih - ih * (vv - a) / ((b - a) || 1);
      };
      g.strokeStyle = '#2a3242'; g.fillStyle = '#98a2b3'; g.lineWidth = 1;
      const ticks = (a, b, n) => {
        const out = [];
        let span = b - a;
        if (!isFinite(span) || span <= 0) span = 1;
        const step = Math.pow(10, Math.floor(Math.log10(span / n)));
        const mult = [1, 2, 2.5, 5, 10].find((m) => span / (step * m) <= n) || 10;
        const st = step * mult;
        if (st <= 0) return [a];
        for (let v = Math.ceil(a / st) * st; v <= b + st * 1e-9; v += st) out.push(v);
        return out;
      };
      const xa = xLog ? Math.log10(x0) : x0, xb = xLog ? Math.log10(x1) : x1;
      for (const t of ticks(xa, xb, 6)) {
        const px = X(xLog ? Math.pow(10, t) : t);
        if (px < padL - 1 || px > padL + iw + 1) continue;
        g.beginPath(); g.moveTo(px, padT); g.lineTo(px, padT + ih); g.stroke();
        g.textAlign = 'center'; g.textBaseline = 'top';
        const lbl = xLog ? (Math.pow(10, t) >= 1 ? Math.pow(10, t).toPrecision(3) : Math.pow(10, t).toExponential(1)) : (+t.toPrecision(4));
        g.fillText(String(lbl), px, padT + ih + 5);
      }
      for (const t of ticks(y0, y1, 5)) {
        const py = Y(axes.y.log ? Math.pow(10, t) : t, 'y');
        if (py < padT - 1 || py > padT + ih + 1) continue;
        g.beginPath(); g.moveTo(padL, py); g.lineTo(padL + iw, py); g.stroke();
        g.textAlign = 'right'; g.textBaseline = 'middle';
        const v = axes.y.log ? Math.pow(10, t) : t;
        g.fillText(fmtTick(v), padL - 5, py);
      }
      if (hasY2) {
        for (const t of ticks(y20, y21, 4)) {
          const py = Y(axes.y2.log ? Math.pow(10, t) : t, 'y2');
          if (py < padT - 1 || py > padT + ih + 1) continue;
          g.textAlign = 'left'; g.textBaseline = 'middle';
          const v = axes.y2.log ? Math.pow(10, t) : t;
          g.fillText(fmtTick(v), padL + iw + 5, py);
        }
      }
      g.fillStyle = '#c3cbd8'; g.textAlign = 'center'; g.textBaseline = 'bottom';
      if (spec.x && spec.x.label) g.fillText(spec.x.label, padL + iw / 2, H - 2);
      g.save();
      g.translate(12, padT + ih / 2); g.rotate(-Math.PI / 2);
      g.textAlign = 'center'; g.textBaseline = 'top';
      if (spec.y && spec.y.label) g.fillText(spec.y.label, 0, 0);
      g.restore();
      if (hasY2 && spec.y2 && spec.y2.label) {
        g.save(); g.translate(W - 6, padT + ih / 2); g.rotate(Math.PI / 2);
        g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText(spec.y2.label, 0, 0);
        g.restore();
      }
      for (const h of spec.hLines || []) {
        const py = Y(h.y, h.axis || 'y');
        if (py < padT || py > padT + ih) continue;
        g.save(); g.setLineDash([4, 3]); g.strokeStyle = '#6b7280';
        g.beginPath(); g.moveTo(padL, py); g.lineTo(padL + iw, py); g.stroke();
        g.restore();
        if (h.label) { g.fillStyle = '#8b93a3'; g.textAlign = 'left'; g.textBaseline = 'bottom'; g.fillText(h.label, padL + 4, py - 2); }
      }
      series.forEach((s, i) => {
        const ax = s.axis || 'y';
        g.strokeStyle = s.color || palette(i);
        g.lineWidth = s.width || 1.8;
        if (s.dash) g.setLineDash([5, 4]); else g.setLineDash([]);
        g.beginPath();
        let started = false;
        for (const p of s.data) {
          const px = X(p[0]);
          const yv = p[1];
          if (yv === null || yv === undefined || !isFinite(yv) || (axes[ax].log && yv <= 0)) { started = false; continue; }
          const py = Y(yv, ax);
          if (!started) { g.moveTo(px, py); started = true; } else g.lineTo(px, py);
        }
        g.stroke();
        g.setLineDash([]);
        if (s.points) {
          g.fillStyle = s.color || palette(i);
          for (const p of s.data) {
            if (!isFinite(p[1])) continue;
            g.beginPath(); g.arc(X(p[0]), Y(p[1], ax), 2.2, 0, 6.283); g.fill();
          }
        }
      });
    }
    function fmtTick(v) {
      const a = Math.abs(v);
      if (v === 0) return '0';
      if (a >= 1e4 || a < 1e-3) return v.toExponential(1);
      return String(+v.toPrecision(4));
    }
    function palette(i) { return ['#4ea1ff', '#ffb84d', '#59d99b', '#ff7b72', '#c792ea', '#7fd1e0', '#e6c07b'][i % 7]; }
    function render() {
      clear(legend);
      (spec.series || []).forEach((s, i) => {
        legend.appendChild(el('span.lg', null, [
          el('span.sw', { style: { background: s.color || palette(i) } }),
          el('span', { text: s.name + (s.axis === 'y2' ? ' (右轴)' : '') })
        ]));
      });
      draw();
    }
    render();
    wrap.redraw = render;
    if (window.ResizeObserver) {
      let t = null;
      const ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(draw, 120); });
      ro.observe(wrap);
    }
    return wrap;
  }
  function note(text) { return el('div.note', { html: text }); }
  function card(title, children, cls) {
    return el('section.card' + (cls ? '.' + cls : ''), null, [
      title ? el('h3.card-title', { text: title }) : null,
      el('div.card-body', null, children)
    ]);
  }
  function row(children, cls) { return el('div.row' + (cls ? '.' + cls : ''), null, children); }
  function col(children, cls) { return el('div.col' + (cls ? '.' + cls : ''), null, children); }
  return { el, $, clear, eng, num, numberField, selectField, button, kvTable, gridTable, chart, note, card, row, col };
});
