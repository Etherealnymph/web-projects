import test from 'node:test';
import assert from 'node:assert/strict';
import { markdown } from '../js/core.mjs';
import { renderMath, MATH_LIMITS } from '../js/math.mjs';

const count = (text, pattern) => [...text.matchAll(pattern)].length;

test('all four LaTeX delimiters render actual fractions and matrices with accessible MathML', () => {
  const output = markdown(String.raw`行内 $g_m r_o$ 与 \(\frac{1}{sC}\)。
$$
A_v=-g_m\left(R_D\parallel r_o\right)
$$
\[
\begin{bmatrix}1&2\\3&4\end{bmatrix}
\]`);
  assert.equal(count(output, /class="math-render math-inline"/g), 2);
  assert.equal(count(output, /class="math-render math-display"/g), 2);
  assert.equal(count(output, /<math /g), 4);
  assert.match(output, /class="mfrac"/);
  assert.match(output, /<mtable/);
  assert.doesNotMatch(output, /class="math-error/);
});
test('code fences, code spans, escaped dollars and ordinary Markdown retain their boundaries', () => {
  const input =
    '```tex\n$never$\n\\[never\\]\n```\n~~~text\n$$never$$\n~~~\n`$never$` 与 ``\\(never\\)``，\\$5。\n**提示** [[相连页]] [来源](https://example.com/) $x^2$';
  const output = markdown(input);
  assert.equal(count(output, /class="math-render /g), 1);
  assert.match(output, /<pre><code>\$never\$\n/);
  assert.match(output, /<code>\$never\$<\/code>/);
  assert.match(output, /<strong>提示<\/strong>/);
  assert.match(output, /class="wiki-link"/);
  assert.match(output, /href="https:\/\/example.com\//);
});
test('dangerous LaTeX commands and raw HTML cannot create links, images or HTML attributes', () => {
  for (const source of [
    String.raw`\href{javascript:alert(1)}{x}`,
    String.raw`\includegraphics{https://example.com/secret}`,
    String.raw`\htmlStyle{background:url(https://example.com)}{x}`,
    String.raw`\def\x{\href{https://example.com}{x}}\x`,
  ]) {
    const output = renderMath(source);
    assert.match(output, /class="math-error/);
    assert.doesNotMatch(output, /<(?:a|img|script|iframe)\b/);
    assert.doesNotMatch(output, /style="/);
  }
  const output = markdown(String.raw`$\text{<img src=x onerror=alert(1)>}$ <script>alert(1)</script>`);
  assert.doesNotMatch(output, /<(?:img|script)\b/);
  assert.match(output, /&lt;/);
});
test('invalid formulas report escaped errors, enforce size/expansion budgets and isolate macros', () => {
  assert.match(renderMath(String.raw`\frac{<img src=x>}{`), /公式未渲染/);
  assert.doesNotMatch(renderMath(String.raw`\frac{<img src=x>}{`), /<img/);
  assert.match(renderMath('x'.repeat(MATH_LIMITS.input + 1)), /超过 4,000/);
  assert.match(renderMath(String.raw`\def\loop{\loop}\loop`), /公式未渲染/);
  renderMath(String.raw`\gdef\PRIVATE{42}\PRIVATE`);
  assert.match(renderMath(String.raw`\PRIVATE`), /公式未渲染/);
  const oversized = renderMath(String.raw`\rule{999em}{999em}`);
  assert.doesNotMatch(oversized, /(?:style|width|height)="[^"]*999em/);
  assert.match(oversized, /width="10em"/);
  assert.match(markdown('$$\nx+1'), /缺少结束标记/);
});
test('document math count is bounded without interpreting later formula source as HTML', () => {
  const source = Array.from({ length: 130 }, () => '$x$').join(' ') + ' $<script>alert(1)</script>$';
  const output = markdown(source);
  assert.equal(count(output, /class="math-render /g), MATH_LIMITS.expressions);
  assert.match(output, /每篇最多渲染 128/);
  assert.doesNotMatch(output, /<script/);
});
