import katex from '../vendor/katex/katex.mjs';

export const MATH_LIMITS = Object.freeze({ input: 4000, expressions: 128, expansions: 200, size: 10 });
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );

export function mathError(source, message, display = false) {
  const shown = source.length > MATH_LIMITS.input ? source.slice(0, MATH_LIMITS.input) + '…' : source;
  return `<span class="math-error ${display ? 'math-display' : 'math-inline'}" role="note"><strong>公式未渲染：${escape(message)}</strong><code>${escape(shown)}</code></span>`;
}

export function renderMath(source, display = false, budget = { remaining: MATH_LIMITS.expressions }) {
  if (budget.remaining-- <= 0) return mathError(source, '每篇最多渲染 128 个公式', display);
  if (source.length > MATH_LIMITS.input) return mathError(source, '单个公式超过 4,000 字符', display);
  if (!source.trim()) return mathError(source, '公式为空', display);
  if (/\\(?:href|url|includegraphics|htmlClass|htmlId|htmlStyle|htmlData)\b/.test(source)) {
    return mathError(source, '公式内不允许链接、外部图片或 HTML 扩展', display);
  }
  try {
    const rendered = katex.renderToString(source, {
      displayMode: display,
      output: 'htmlAndMathml',
      throwOnError: true,
      trust: false,
      strict: 'error',
      maxExpand: MATH_LIMITS.expansions,
      maxSize: MATH_LIMITS.size,
      macros: {}, // Never share definitions between formulas or notes.
      globalGroup: false,
    });
    return `<span class="math-render ${display ? 'math-display' : 'math-inline'}" tabindex="0" role="group" aria-label="${display ? '块公式' : '行内公式'}，过长时可横向滚动">${rendered}</span>`;
  } catch (error) {
    // KaTeX errors may contain user input. Escape the message and the source;
    // only successful output from the fixed, trust=false renderer becomes HTML.
    const message = String(error.message || '语法错误')
      .replace(/^KaTeX parse error:\s*/, '')
      .slice(0, 240);
    return mathError(source, message, display);
  }
}

export function escapedAt(text, index) {
  let backslashes = 0;
  for (let previous = index - 1; previous >= 0 && text[previous] === '\\'; previous--) backslashes++;
  return backslashes % 2 === 1;
}

export function closingDelimiter(text, delimiter, start) {
  for (
    let index = text.indexOf(delimiter, start);
    index !== -1;
    index = text.indexOf(delimiter, index + delimiter.length)
  ) {
    if (!escapedAt(text, index)) return index;
  }
  return -1;
}
