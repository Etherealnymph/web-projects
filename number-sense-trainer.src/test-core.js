/* 核心逻辑单元测试 / 批量出题体检：node test-core.js */
const NS = require('./core.js');

let pass = 0, fail = 0;
function eq(name, got, want, tol) {
  const ok = (typeof want === 'number' && typeof tol === 'number')
    ? Math.abs(got - want) <= tol
    : got === want;
  if (ok) { pass++; }
  else { fail++; console.log('  ✗ ' + name + '  得到 ' + got + ' 期望 ' + want); }
}
function ok(name, cond, extra) {
  if (cond) pass++;
  else { fail++; console.log('  ✗ ' + name + (extra ? '  ' + extra : '')); }
}

console.log('— 解析器 —');
eq('3+4*2', NS.evaluate('3+4*2'), 11);
eq('(3+4)*2', NS.evaluate('(3+4)*2'), 14);
eq('2^3^2 右结合', NS.evaluate('2^3^2'), 512);
eq('-2^2', NS.evaluate('-2^2'), -4);
eq('1/2π 按从左到右 = π/2', NS.evaluate('1/2π'), Math.PI / 2, 1e-12);
eq('1/(2π)', NS.evaluate('1/(2π)'), 1 / (2 * Math.PI), 1e-12);
eq('3√2', NS.evaluate('3√2'), 3 * Math.SQRT2, 1e-12);
eq('2π', NS.evaluate('2π'), 2 * Math.PI, 1e-12);
eq('2π/3', NS.evaluate('2π/3'), 2 * Math.PI / 3, 1e-12);
eq('π²/6', NS.evaluate('π²/6'), Math.PI ** 2 / 6, 1e-12);
eq('φ²', NS.evaluate('φ²'), ((1 + Math.sqrt(5)) / 2) ** 2, 1e-12);
eq('ln2', NS.evaluate('ln2'), Math.LN2, 1e-12);
eq('ln10/ln2', NS.evaluate('ln10/ln2'), Math.log2(10), 1e-12);
eq('ζ(3)', NS.evaluate('ζ(3)'), 1.2020569031595943, 1e-12);
eq('√(3/2)', NS.evaluate('√(3/2)'), Math.sqrt(1.5), 1e-12);
eq('e^π', NS.evaluate('e^π'), Math.exp(Math.PI), 1e-12);
eq('2^√2', NS.evaluate('2^√2'), Math.pow(2, Math.SQRT2), 1e-12);
eq('π^e', NS.evaluate('π^e'), Math.pow(Math.PI, Math.E), 1e-12);
eq('5^(1/3)', NS.evaluate('5^(1/3)'), Math.cbrt(5), 1e-12);
eq('γ+3/7', NS.evaluate('γ+3/7'), 0.5772156649015329 + 3 / 7, 1e-12);
eq('sin1', NS.evaluate('sin1'), Math.sin(1), 1e-12);
eq('5!', NS.evaluate('5!'), 120);
eq('全角括号与乘号', NS.evaluate('（3×4）÷2'), 6);
eq('中文上标 ³', NS.evaluate('2³'), 8);
eq('e^π/3', NS.evaluate('e^π/3'), Math.exp(Math.PI) / 3, 1e-12);
eq('1.5 小数可用', NS.evaluate('1.5*4'), 6);
ok('空表达式报错', !NS.tryEvaluate('').ok);
ok('未知名字报错', !NS.tryEvaluate('foo').ok);
ok('缺右括号报错', !NS.tryEvaluate('(1+2').ok);
ok('尾随运算符报错', !NS.tryEvaluate('1+').ok);
ok('小数点在开头被接受 = 0.5', NS.evaluate('.5') === 0.5);
ok('小数标记被识别', NS.tokenize('.5')[0].dec === true);
ok('整数没有小数标记', NS.tokenize('12')[0].dec === false);

console.log('— 出题器批量体检 —');
let stats = {}, bad = [], minV = Infinity, maxV = -Infinity;
for (const tier of [1, 2, 3, 4]) {
  for (let i = 0; i < 6000; i++) {
    const t = NS.makeTarget(tier);
    stats[tier] = stats[tier] || {};
    stats[tier][t.label] = (stats[tier][t.label] || 0) + 1;
    minV = Math.min(minV, t.value); maxV = Math.max(maxV, t.value);
    if (t.display.includes('.')) bad.push(['含小数点', tier, t.display]);
    const re = NS.tryEvaluate(t.display);
    if (!re.ok || !isFinite(re.value)) bad.push(['重新解析失败', tier, t.display, re.error]);
    else if (Math.abs(re.value - t.value) > 1e-12) bad.push(['值与表达式不符', tier, t.display]);
    if (Math.abs(t.value - Math.round(t.value)) < 1e-6) bad.push(['结果是整数', tier, t.display]);
    if (t.value <= 0.02 || t.value >= 1e5) bad.push(['量级越界', tier, t.display, t.value]);
    if (t.shown.split('.')[1].length !== t.digits) bad.push(['小数位数不对', tier, t.shown]);
    if (!isFinite(parseFloat(t.shown))) bad.push(['显示值非法', tier, t.shown]);
    // 判定函数：完全相同的表达式必须判为 exact + matchRound
    const j = NS.judge(re.value, t.value, t.digits);
    if (!j.exact || !j.matchRound) bad.push(['自身判定失败', tier, t.display]);
  }
}
ok('批量出题无异常', bad.length === 0, JSON.stringify(bad.slice(0, 6)));
console.log('  值域: ' + minV.toFixed(4) + ' ~ ' + maxV.toFixed(2));
for (const tier of [1, 2, 3, 4]) {
  const labels = Object.keys(stats[tier]);
  console.log('  难度' + tier + ' 模板覆盖 ' + labels.length + ' 种');
}

console.log('— 判定容差 —');
const t1 = NS.makeTarget(2);
ok('差值在半个末位内算对', NS.judge(t1.value + 0.4e-6, t1.value, t1.digits).matchRound);
ok('差值超过半个末位算错', !NS.judge(t1.value + 0.6e-6, t1.value, t1.digits).matchRound);

console.log('— 提示文本 —');
const hintCases = ['2^√2/5', 'π²/6', '3/7+4/9', '(1+√5)/2', 'ln2+π/3', 'γ+5/8', 'e^π/7', '22/7', '√(3+2√2)', '5^(1/3)'];
hintCases.forEach(function (src) {
  const k = NS.inferKinds(src).list;
  console.log('  ' + src.padEnd(12) + ' -> ' + k.join(' + '));
  if (NS.tryEvaluate(src).ok) console.log('       ' + NS.structureHint(src));
});
ok('2^√2 应含超越数', NS.inferKinds('2^√2/5').list.indexOf('超越数') >= 0, NS.inferKinds('2^√2/5').list.join('+'));
ok('纯分数不含超越数', NS.inferKinds('3/7+4/9').list.join('+') === '有理数');
ok('√2 归为代数无理数', NS.inferKinds('√2+1').list.join('+') === '代数无理数');
ok('ln2 归为超越数', NS.inferKinds('ln2').list.indexOf('超越数') >= 0);
ok('π 归为超越数', NS.inferKinds('3π/7').list.indexOf('超越数') >= 0);
ok('γ 标注超越性未知', NS.inferKinds('γ+1/2').list.join('+').indexOf('未知') >= 0);
const th = NS.makeTarget(3);
console.log('  题目: ' + th.display + ' -> ' + th.shown);
console.log('  提示1: ' + NS.structureHint(th.display));
console.log('  提示2: ' + NS.typeHint(th.display));

console.log('— 比大小 / 估数 —');
for (let i = 0; i < 500; i++) {
  const p = NS.makeComparePair();
  const okPair = p.bigger === (p.left.value > p.right.value ? 'left' : 'right') && p.left.value !== p.right.value;
  if (!okPair) { ok('比大小对数', false, JSON.stringify(p)); break; }
  const gap = Math.abs(Math.log(p.left.value) - Math.log(p.right.value));
  if (!(gap > 0.01 && gap < 0.4)) { ok('比大小差距合理', false, gap); break; }
}
pass += 2;
for (let i = 0; i < 200; i++) {
  const e = NS.makeEstimateTarget();
  if (!isFinite(e.value)) { ok('估数目标', false); break; }
}
pass++;
ok('估数评分单调', NS.estimateScore(1.0001, 1).score > NS.estimateScore(1.2, 1).score);
ok('格式化 1/3', NS.formatPrecise(1 / 3).startsWith('0.333333333333333'), NS.formatPrecise(1 / 3));
ok('格式化 π²/6', NS.formatPrecise(Math.PI ** 2 / 6) === '1.64493406684823', NS.formatPrecise(Math.PI ** 2 / 6));
ok('格式化为整数不带点', NS.formatPrecise(4) === '4', NS.formatPrecise(4));
const dd = NS.digitDiff('3.1416', Math.PI);
ok('逐位对比长度', dd.length === 6, JSON.stringify(dd));

console.log('\n通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
