export const escapeMarkup = (text) =>
  String(text ?? '').replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch],
  );

function markup(code) {
  if (code.length > 220000) return escapeMarkup(code);
  return code
    .split('\n')
    .map((line) => {
      if (/^\s*(\*|\/\/|--|;)/.test(line)) return '<em>' + escapeMarkup(line) + '</em>';
      return line
        .split(
          /("(?:[^"\\]|\\.)*"|\.[A-Za-z]+\b|\b(?:module|endmodule|subckt|ends|entity|architecture|begin|end|assign|wire|port|model|include|simulator|input|output|is|of|use)\b|(?<![\w.])[-+]?\d*\.?\d+(?:e[-+]?\d+)?(?:meg|[tgkmunpf])?\b)/gi,
        )
        .map((s, i) =>
          i % 2
            ? '<b class="' +
              (s.startsWith('"') ? 'str' : /^[-+.\d]*\d/.test(s) ? 'num' : 'kw') +
              '">' +
              escapeMarkup(s) +
              '</b>'
            : escapeMarkup(s),
        )
        .join('');
    })
    .join('\n');
}

export function setupEditor(onInput, report) {
  const el = document.querySelector('#source'),
    hl = document.querySelector('#highlight'),
    nums = document.querySelector('#line-numbers');
  const $ = (id) => document.getElementById(id);
  let history = [],
    future = [],
    lastValue = '',
    lastAnchor = 0,
    file = '';
  const savedHistories = new Map();
  const cursor = () => {
    const s = el.value.slice(0, el.selectionStart),
      line = s.split('\n').length;
    $('cursor').textContent = '行 ' + line + ' · 列 ' + (s.length - s.lastIndexOf('\n'));
  };
  function refresh() {
    const lines = el.value.split('\n').length;
    const large = el.value.length > 220000;
    hl.hidden = large;
    hl.innerHTML = large ? '' : markup(el.value) + '\n';
    nums.textContent = Array.from({ length: Math.min(lines, 30000) }, (_, i) => i + 1).join('\n');
    el.classList.toggle('plain', large);
    cursor();
    sync();
  }
  function sync() {
    hl.scrollTop = el.scrollTop;
    hl.scrollLeft = el.scrollLeft;
    nums.scrollTop = el.scrollTop;
  }
  function commit(previous, anchor) {
    if (previous === el.value) return;
    history.push({ text: previous, anchor });
    if (history.length > 80 || (history.length > 3 && previous.length * history.length > 4000000))
      history.shift();
    future.length = 0;
    lastValue = el.value;
    lastAnchor = el.selectionStart;
    refresh();
    onInput(el.value);
  }
  function replace(start, end, value) {
    const prev = el.value;
    el.setRangeText(value, start, end, 'end');
    commit(prev, start);
  }
  function travel(from, to) {
    if (!from.length) return;
    to.push({ text: el.value, anchor: el.selectionStart });
    const v = from.pop();
    el.value = v.text;
    el.setSelectionRange(v.anchor, v.anchor);
    lastValue = v.text;
    refresh();
    onInput(v.text);
    el.focus();
  }
  function go(line) {
    const row = Math.max(1, Math.min(el.value.split('\n').length, Math.trunc(line) || 1));
    const start = el.value
      .split('\n')
      .slice(0, row - 1)
      .reduce((n, s) => n + s.length + 1, 0);
    el.focus();
    el.setSelectionRange(start, start + (el.value.split('\n')[row - 1]?.length || 0));
    el.scrollTop = Math.max(0, (row - 4) * parseFloat(getComputedStyle(el).lineHeight));
    sync();
    cursor();
  }
  const find = () => {
    $('findbar').hidden = false;
    $('find-text').focus();
    $('find-text').select();
  };
  function next() {
    const q = $('find-text').value;
    if (!q) return false;
    let ix = el.value.indexOf(q, el.selectionEnd);
    if (ix < 0) ix = el.value.indexOf(q);
    if (ix < 0) {
      report('没有匹配项');
      return false;
    }
    const line = el.value.slice(0, ix).split('\n').length;
    go(line);
    el.setSelectionRange(ix, ix + q.length);
    return true;
  }
  $('find').onclick = find;
  $('find-close').onclick = () => {
    $('findbar').hidden = true;
    el.focus();
  };
  $('next-match').onclick = next;
  $('find-text').onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      next();
    }
  };
  $('replace-one').onclick = () => {
    const q = $('find-text').value;
    if (q && (el.value.slice(el.selectionStart, el.selectionEnd) === q || next()))
      replace(el.selectionStart, el.selectionEnd, $('replace-text').value);
  };
  $('replace-all').onclick = () => {
    const q = $('find-text').value;
    if (!q) return;
    const n = el.value.split(q).length - 1;
    if (n) replace(0, el.value.length, el.value.split(q).join($('replace-text').value));
    report('已替换 ' + n + ' 处');
  };
  $('undo').onclick = () => travel(history, future);
  $('redo').onclick = () => travel(future, history);
  el.onbeforeinput = () => {
    lastAnchor = el.selectionStart;
  };
  el.oninput = () => commit(lastValue, lastAnchor);
  el.onscroll = sync;
  el.onselect = cursor;
  el.onclick = cursor;
  el.onkeyup = cursor;
  el.onkeydown = (e) => {
    const mod = e.ctrlKey || e.metaKey,
      k = e.key.toLowerCase();
    if (mod && k === 'z') {
      e.preventDefault();
      e.shiftKey ? travel(future, history) : travel(history, future);
    } else if (mod && k === 'y') {
      e.preventDefault();
      travel(future, history);
    } else if (mod && k === 'f') {
      e.preventDefault();
      find();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (!e.shiftKey && el.selectionStart === el.selectionEnd) {
        replace(el.selectionStart, el.selectionEnd, '  ');
        return;
      }
      const start = el.value.lastIndexOf('\n', el.selectionStart - 1) + 1,
        end = el.selectionEnd;
      const v = el.value
        .slice(start, end)
        .split('\n')
        .map((l) => (e.shiftKey ? l.replace(/^ {1,2}|^\t/, '') : '  ' + l))
        .join('\n');
      replace(start, end, v);
      el.setSelectionRange(start, start + v.length);
    } else if (mod && (k === '/' || k === 'd')) {
      e.preventDefault();
      const start = el.value.lastIndexOf('\n', el.selectionStart - 1) + 1;
      const stop = el.value.indexOf('\n', el.selectionEnd),
        end = stop < 0 ? el.value.length : stop;
      const body = el.value.slice(start, end),
        prefix = /\.v(hd|hdl)$/i.test(file) ? '--' : /\.(v|sv|scs)$/i.test(file) ? '//' : '*';
      if (k === 'd') replace(end, end, '\n' + body);
      else {
        const lines = body.split('\n'),
          remove = lines.every((l) => l.startsWith(prefix));
        replace(
          start,
          end,
          lines
            .map((l) => (remove ? l.slice(prefix.length).replace(/^ /, '') : prefix + ' ' + l))
            .join('\n'),
        );
      }
    }
  };
  return {
    go,
    refresh,
    open(key, path, code) {
      if (key === file && code === el.value) return;
      if (file) savedHistories.set(file, { history, future, scroll: el.scrollTop });
      file = key;
      const h = savedHistories.get(key);
      history = h?.history || [];
      future = h?.future || [];
      el.value = code;
      lastValue = code;
      lastAnchor = 0;
      el.scrollTop = h?.scroll || 0;
      el.scrollLeft = 0;
      $('code-file').textContent = path;
      refresh();
    },
    reset() {
      savedHistories.clear();
      file = '';
      history = [];
      future = [];
    },
    edit(start, end, value) {
      replace(start, end, value);
    },
  };
}
