import { engineeringNumber } from './analysis-deck.js';

const identifier = '[A-Za-z_][\\w.$:-]*';
const parameterHead = new RegExp('(' + identifier + ')\\s*=\\s*', 'y');
const maxRows = 60;

function* lines(text) {
  let number = 0;
  for (const match of text.matchAll(/([^\r\n]*)(?:\r\n|\r|\n|$)/g)) {
    yield { text: match[1], offset: match.index, number: ++number };
  }
}

function relativeFile(entry, target) {
  if (/^(?:[\\/]|[a-z]:)/i.test(target)) return null;
  const parts = entry.split('/').slice(0, -1);
  for (const part of target.replaceAll('\\', '/').split('/')) {
    if (!part || part === '.') continue;
    if (part !== '..') parts.push(part);
    else if (parts.length) parts.pop();
    else return null;
  }
  return parts.join('/');
}

function isNumber(value) {
  try {
    engineeringNumber(value);
    return true;
  } catch {
    return false;
  }
}

// Assignment boundaries only occur outside quoted strings, parenthesised expressions and braces.
function readParameters(line, start) {
  const out = [],
    text = line.text;
  let depth = 0,
    quote = '',
    pending,
    end = text.length;
  function finish(at) {
    if (!pending) return;
    const value = text.slice(pending.start, at).trimEnd();
    if (isNumber(value))
      out.push({
        kind: 'parameter',
        name: pending.name,
        line: line.number,
        value,
        start: line.offset + pending.start,
        end: line.offset + pending.start + value.length,
      });
  }
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote && text[i - 1] !== '\\') quote = '';
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      continue;
    }
    if (c === '{' || c === '(' || c === '[') {
      depth++;
      continue;
    }
    if (c === '}' || c === ')' || c === ']') {
      if (depth > 0) depth--;
      continue;
    }
    if (depth) continue;
    if (c === ';' || text.startsWith('//', i) || (c === '$' && /\s/.test(text[i - 1] || ' '))) {
      end = i;
      break;
    }
    if (i !== start && !/\s/.test(text[i - 1])) continue;
    parameterHead.lastIndex = i;
    const assignment = parameterHead.exec(text);
    if (assignment) {
      finish(i);
      pending = { name: assignment[1], start: parameterHead.lastIndex };
      i = parameterHead.lastIndex - 1;
    }
  }
  finish(end);
  return out;
}

export function readModelControls(entry, content) {
  const corners = [],
    parameters = [];
  let inControl = false,
    inSubckt = 0;
  for (const line of lines(content)) {
    const text = line.text;
    if (/^\s*\.control\b/i.test(text)) {
      inControl = true;
      continue;
    }
    if (/^\s*\.endc\b/i.test(text)) {
      inControl = false;
      continue;
    }
    if (inControl) continue;
    if (/^\s*(?:inline\s+)?\.?subckt\b/i.test(text)) {
      inSubckt++;
      continue;
    }
    if (/^\s*\.?ends\b/i.test(text)) {
      inSubckt = Math.max(0, inSubckt - 1);
      continue;
    }
    const inc = text.match(
      /^\s*(\.lib|include)\s+(?:"([^"]+)"|'([^']+)'|([^\s'"]+))\s+(section\s*=\s*)?([\w.-]+)(?=\s*(?:(?:\/\/|[$;]).*)?$)/i,
    );
    if (inc && (inc[1].toLowerCase() === 'include') === Boolean(inc[5])) {
      const path = inc[2] ?? inc[3] ?? inc[4],
        value = inc[6],
        end = line.offset + inc[0].length;
      corners.push({
        kind: 'corner',
        name: path,
        path: relativeFile(entry, path),
        value,
        line: line.number,
        start: end - value.length,
        end,
      });
    }
    const params = text.match(/^\s*(?:\.param|parameters)\s+/i);
    if (params && !inSubckt) parameters.push(...readParameters(line, params[0].length));
  }
  return { corners, parameters };
}

export function indexModelSources(files) {
  const sections = new Map(),
    definitions = [];
  for (const { path, content } of files) {
    const corners = new Map();
    let inControl = false,
      section = '';
    for (const { text, number } of lines(content)) {
      if (/^\s*\.control\b/i.test(text)) {
        inControl = true;
        continue;
      }
      if (/^\s*\.endc\b/i.test(text)) {
        inControl = false;
        continue;
      }
      if (inControl) continue;
      const block = text.match(/^\s*(?:\.lib|section)\s+([\w.-]+)\s*(?:(?:\/\/|[$;]).*)?$/i);
      if (block) {
        section = block[1];
        corners.set(section.toLowerCase(), section);
        continue;
      }
      if (/^\s*(?:\.endl|endsection)\b/i.test(text)) {
        section = '';
        continue;
      }
      const def = text.match(/^\s*(?:inline\s+)?\.?(model|subckt)\s+([^\s({]+)/i);
      if (def)
        definitions.push({ kind: def[1].toLowerCase(), name: def[2], path, line: number, section });
    }
    sections.set(path, [...corners.values()]);
  }
  return { sections, definitions };
}

export function writeControl(content, control, value, allowed = []) {
  const replacement = String(value).trim();
  if (control.kind === 'corner') {
    if (!allowed.includes(replacement)) throw Error('请选择此模型文件已声明的工艺角。');
  } else if (control.kind !== 'parameter' || !isNumber(replacement)) {
    throw Error('请输入数值或工程单位，例如 1.8、100n、2.2k 或 1meg。');
  }
  if (content.slice(control.start, control.end) !== control.value)
    throw Error('源行已更新，请重新打开参数面板。');
  return content.slice(0, control.start) + replacement + content.slice(control.end);
}

export function mountModelControls(container, { files, entry, onWrite, onOpen }) {
  const source = files.find((f) => f.path === entry);
  if (!source) throw Error('工程内没有入口文件 ' + entry);
  const doc = container.ownerDocument;
  function el(tag, text, className) {
    const element = doc.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }
  function button(text, click, className) {
    const b = el('button', text, className);
    b.type = 'button';
    b.addEventListener('click', click);
    return b;
  }
  const { sections, definitions } = indexModelSources(files);
  const drafts = new Map();
  const draftKey = (p) => p.line + '/' + p.name;
  const settings = el('div'),
    status = el('p', '', 'hint'),
    search = el('input'),
    hits = el('div'),
    count = el('small');
  status.setAttribute('role', 'status');
  search.type = 'search';
  search.placeholder = '名称、文件路径或工艺角';
  const findLabel = el('label', '搜索模型与子电路', 'field');
  findLabel.append(search);
  container.replaceChildren(
    settings,
    status,
    el('h3', '模型与子电路', 'choice-group'),
    findLabel,
    count,
    hits,
  );
  let content = source.content,
    busy = false,
    previousSource = source.content;
  function listDefinitions() {
    const q = search.value.trim().toLowerCase(),
      frag = doc.createDocumentFragment();
    let total = 0;
    for (const d of definitions) {
      if (q && ![d.name, d.path, d.section].some((s) => s.toLowerCase().includes(q))) continue;
      if (total++ >= maxRows) continue;
      const row = button(d.name, () => onOpen(d.path, d.line), 'choice');
      row.append(el('small', [d.kind, d.section, d.path + ' · L' + d.line].filter(Boolean).join(' · ')));
      frag.append(row);
    }
    count.textContent =
      total > maxRows
        ? '显示前 ' + maxRows + ' / ' + total + ' 项，可继续缩小搜索范围。'
        : total + ' 项';
    hits.replaceChildren(frag);
  }
  search.addEventListener('input', listDefinitions);
  listDefinitions();

  async function apply(control, value, allowed) {
    if (busy) return;
    busy = true;
    try {
      if (source.content !== previousSource && source.content !== content) {
        content = previousSource = source.content;
        drafts.clear();
        renderSettings();
        throw Error('入口文件已更新，请核对当前参数后再应用。');
      }
      const next = writeControl(content, control, value, allowed);
      if (next !== content) await onWrite(entry, next);
      content = next;
      previousSource = source.content;
      if (control.kind === 'parameter') drafts.delete(draftKey(control));
      renderSettings();
      status.textContent =
        '已应用 ' + control.name + ' = ' + String(value).trim() + '。下次仿真将读取更新后的入口。';
    } catch (error) {
      if (control.kind === 'corner') renderSettings();
      status.textContent = error.message;
    } finally {
      busy = false;
    }
  }

  function renderSettings() {
    const { corners, parameters } = readModelControls(entry, content),
      frag = doc.createDocumentFragment();
    frag.append(el('h3', '入口工艺角', 'choice-group'));
    if (!corners.length) frag.append(el('p', '入口未声明带工艺角的库引用。', 'hint'));
    for (const c of corners) {
      const options = sections.get(c.path) || [],
        select = el('select');
      let current = options.find((item) => item.toLowerCase() === c.value.toLowerCase());
      if (!current) {
        const option = el('option', c.value + '（未找到声明）');
        option.value = c.value;
        option.disabled = true;
        select.append(option);
        current = c.value;
      }
      for (const value of options) {
        const option = el('option', value);
        option.value = value;
        select.append(option);
      }
      select.value = current;
      select.disabled = !options.length;
      select.addEventListener('change', () => apply(c, select.value, options));
      const field = el('label', c.name + ' · L' + c.line, 'field');
      field.append(select);
      frag.append(field);
      if (!options.length)
        frag.append(
          el('small', sections.has(c.path) ? '模型文件中未找到工艺角声明。' : '工程内未找到引用文件。'),
        );
    }
    frag.append(el('h3', '入口设计变量', 'choice-group'));
    if (!parameters.length)
      frag.append(el('p', '入口顶层没有单行数值变量。表达式和子电路局部参数可在源码中编辑。', 'hint'));
    for (const p of parameters.slice(0, maxRows)) {
      const field = el('label', p.name + ' · L' + p.line, 'field'),
        input = el('input'),
        row = el('div', undefined, 'form-grid');
      input.value = drafts.get(draftKey(p)) ?? p.value;
      input.addEventListener('input', () => drafts.set(draftKey(p), input.value));
      input.spellcheck = false;
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          apply(p, input.value);
        }
      });
      field.append(input);
      row.append(
        field,
        button('应用 ' + p.name, () => apply(p, input.value)),
      );
      frag.append(row);
    }
    if (parameters.length > maxRows)
      frag.append(
        el(
          'small',
          '显示前 ' + maxRows + ' / ' + parameters.length + ' 个变量，其余变量可在入口文件中编辑。',
        ),
      );
    frag.append(button('打开入口源码', () => onOpen(entry, 1), 'choice'));
    settings.replaceChildren(frag);
  }
  renderSettings();
}
