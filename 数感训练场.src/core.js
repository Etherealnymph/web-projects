/* =========================================================================
 * 数感训练场 · 核心逻辑（纯计算，零 DOM 依赖，可在 Node 中直接测试）
 * 包含：常数库 / 表达式分词器 / 递归下降解析求值器 / 题目生成器 / 计分
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.NS = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * 1. 常数库：有理数的邻居们（代数无理数 / 超越数 / 性质未知者）
   * ------------------------------------------------------------------ */
  var PHI = (1 + Math.sqrt(5)) / 2;
  var GAMMA = 0.5772156649015329;          // 欧拉–马歇罗尼常数
  var APERY = 1.2020569031595943;          // ζ(3)
  var CATALAN = 0.9159655941772190;        // 卡塔兰常数 G

  // cat 分类：'超越数' | '代数无理数' | '未定' | '无理数'
  var CONSTANTS = [
    { sym: 'π', names: ['π', 'pi'], value: Math.PI, cn: '圆周率', cat: '超越数', note: '圆周长与直径之比，Lindemann 1882 证明其超越性', quick: true },
    { sym: 'e', names: ['e'], value: Math.E, cn: '自然常数', cat: '超越数', note: '(1+1/n)^n 的极限，Euler 常数', quick: true },
    { sym: 'φ', names: ['φ', 'phi'], value: PHI, cn: '黄金比', cat: '代数无理数', note: '(1+√5)/2，满足 x² = x + 1', quick: true },
    { sym: 'γ', names: ['γ', 'gamma'], value: GAMMA, cn: '欧拉–马歇罗尼常数', cat: '未定', note: '调和级数与 ln n 之差；它是不是有理数，至今无人知道', quick: true },
    { sym: '√2', names: [], value: Math.SQRT2, cn: '2 的平方根', cat: '代数无理数', note: '人类发现的第一个无理数', quick: true },
    { sym: '√3', names: [], value: Math.sqrt(3), cn: '3 的平方根', cat: '代数无理数', note: '正方形对角线相关', quick: true },
    { sym: '√5', names: [], value: Math.sqrt(5), cn: '5 的平方根', cat: '代数无理数', note: '与黄金比同源', quick: true },
    { sym: '√7', names: [], value: Math.sqrt(7), cn: '7 的平方根', cat: '代数无理数', note: '', quick: false },
    { sym: '√10', names: [], value: Math.sqrt(10), cn: '10 的平方根', cat: '代数无理数', note: '', quick: false },
    { sym: 'ln2', names: [], value: Math.LN2, cn: '2 的自然对数', cat: '超越数', note: '0.693147…，二进制与信息论的老朋友', quick: true },
    { sym: 'ln3', names: [], value: Math.log(3), cn: '3 的自然对数', cat: '超越数', note: '', quick: false },
    { sym: 'ln10', names: [], value: Math.LN10, cn: '10 的自然对数', cat: '超越数', note: '换底公式的中转站', quick: false },
    { sym: 'ζ(3)', names: ['ζ(3)'], value: APERY, cn: '阿培里常数', cat: '无理数', note: 'Apéry 1978 证明它是无理数；是否超越仍未知', quick: true },
    { sym: 'G', names: ['G'], value: CATALAN, cn: '卡塔兰常数', cat: '未定', note: '0.915965…；同样连"是不是无理数"都还不知道', quick: true },
    { sym: 'τ', names: ['τ', 'tau'], value: 2 * Math.PI, cn: '圆周常数', cat: '超越数', note: 'τ = 2π ≈ 6.283185…', quick: false },
    { sym: 'e^π', names: [], value: Math.exp(Math.PI), cn: '格尔丰德常数 e^π', cat: '超越数', note: 'Nesterenko 1996 年证明其超越性', quick: true },
    { sym: '2^√2', names: [], value: Math.pow(2, Math.SQRT2), cn: '格尔丰德–施奈德常数', cat: '超越数', note: 'Gelfond–Schneider 定理的招牌例子', quick: false },
    { sym: 'π^e', names: [], value: Math.pow(Math.PI, Math.E), cn: 'π 的 e 次幂', cat: '未定', note: '注意对比：e^π 已被证明是超越数，π^e 至今没有定论', quick: false },
    { sym: 'sin1', names: [], value: Math.sin(1), cn: '1 弧度正弦', cat: '超越数', note: 'Lindemann–Weierstrass 定理', quick: false },
    { sym: 'cos1', names: [], value: Math.cos(1), cn: '1 弧度余弦', cat: '超越数', note: 'Lindemann–Weierstrass 定理', quick: false }
  ];

  var CONST_MAP = {};                       // 解析器用：名字 -> 常数对象
  CONSTANTS.forEach(function (c) {
    CONST_MAP[c.sym.toLowerCase()] = c;
    c.names.forEach(function (n) { CONST_MAP[n.toLowerCase()] = c; });
  });

  var FUNC_TABLE = {
    sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, exp: Math.exp,
    ln: Math.log, log: Math.log10, log10: Math.log10, log2: Math.log2,
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    asin: Math.asin, acos: Math.acos, atan: Math.atan,
    floor: Math.floor, ceil: Math.ceil, round: Math.round, sign: Math.sign,
    max: Math.max, min: Math.min
  };
  FUNC_TABLE['ζ'] = function (x) { return x === 3 ? APERY : (x === 2 ? Math.PI * Math.PI / 6 : NaN); };
  FUNC_TABLE['zeta'] = FUNC_TABLE['ζ'];

  var FUNC_CN = {
    sqrt: '开平方', cbrt: '开立方', ln: '自然对数', log: '常用对数', log10: '常用对数',
    log2: '二进制对数', exp: '指数函数', sin: '正弦', cos: '余弦', tan: '正切',
    sinh: '双曲正弦', cosh: '双曲余弦', tanh: '双曲正切', abs: '绝对值',
    asin: '反正弦', acos: '反余弦', atan: '反正切', floor: '向下取整',
    ceil: '向上取整', round: '四舍五入', sign: '符号函数', 'ζ': '黎曼ζ函数', zeta: '黎曼ζ函数'
  };

  /* ------------------------------------------------------------------ *
   * 2. 分词器
   * ------------------------------------------------------------------ */
  var SUP = { '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9, '⁰': 0, '¹': 1 };
  var LETTER = /[A-Za-zπφγτζθλ]/;

  function normalize(src) {
    return String(src)
      .replace(/[×⋅·✕＊✖]/g, '*')
      .replace(/[÷∕／]/g, '/')
      .replace(/[−–—―ー]/g, '-')
      .replace(/[（]/g, '(')
      .replace(/[）]/g, ')')
      .replace(/[，]/g, ',')
      .replace(/[＋]/g, '+')
      .replace(/[－]/g, '-')
      .replace(/[\u00a0\u3000\t\n\r]/g, ' ');
  }

  function tokenize(src) {
    var s = normalize(src);
    var tokens = [];
    var i = 0;
    while (i < s.length) {
      var c = s[i];
      if (c === ' ') { i++; continue; }
      if (Object.prototype.hasOwnProperty.call(SUP, c)) {
        tokens.push({ t: 'op', v: '^', pos: i });
        tokens.push({ t: 'num', v: SUP[c], raw: String(SUP[c]), dec: false, pos: i });
        i++; continue;
      }
      if ((c >= '0' && c <= '9') || c === '.') {
        var j = i, raw = '', seenDot = false, seenDigit = false;
        while (j < s.length && ((s[j] >= '0' && s[j] <= '9') || (s[j] === '.' && !seenDot))) {
          if (s[j] === '.') seenDot = true; else seenDigit = true;
          raw += s[j]; j++;
        }
        if (!seenDigit) throw new Err('小数点位置不对', i);
        tokens.push({ t: 'num', v: parseFloat(raw), raw: raw, dec: seenDot, pos: i });
        i = j; continue;
      }
      if (c === '√' || c === '∛') {
        tokens.push({ t: 'op', v: c === '√' ? '√' : '∛', pos: i });
        i++; continue;
      }
      if (LETTER.test(c)) {
        var k = i;
        while (k < s.length && LETTER.test(s[k])) k++;
        var name = s.slice(i, k);
        var lower = name.toLowerCase();
        if (CONST_MAP[lower]) {
          tokens.push({ t: 'const', v: CONST_MAP[lower], raw: name, pos: i });
        } else if (FUNC_TABLE[lower]) {
          tokens.push({ t: 'func', v: lower, raw: name, pos: i });
        } else {
          throw new Err('不认识的名字「' + name + '」（可用：π e φ γ τ ln log sin cos √ ζ 等）', i);
        }
        i = k; continue;
      }
      if ('+-*/^()!,%'.indexOf(c) >= 0) {
        tokens.push({ t: 'op', v: c, pos: i });
        i++; continue;
      }
      throw new Err('多余的符号「' + c + '」', i);
    }
    return tokens;
  }

  function Err(msg, pos) {
    this.name = 'ExprError';
    this.message = msg;
    this.pos = pos;
    this.stack = (new Error(msg)).stack;
  }
  Err.prototype = Object.create(Error.prototype);
  Err.prototype.constructor = Err;

  /* ------------------------------------------------------------------ *
   * 3. 递归下降解析器
   *    优先级：+ -  <  * / 与隐式乘法  <  负号  <  ^  <  后缀!  <  原子
   *    √ 作用于紧随其后的一个"原子"（√2、√π、√(3+1)）
   * ------------------------------------------------------------------ */
  function Parser(tokens) {
    this.tk = tokens;
    this.p = 0;
  }
  Parser.prototype.peek = function () { return this.tk[this.p] || null; };
  Parser.prototype.next = function () { return this.tk[this.p++] || null; };
  Parser.prototype.isOp = function (v) {
    var t = this.peek();
    return !!t && t.t === 'op' && t.v === v;
  };
  Parser.prototype.startsPrimary = function () {
    var t = this.peek();
    if (!t) return false;
    if (t.t === 'num' || t.t === 'const' || t.t === 'func') return true;
    if (t.t === 'op' && (t.v === '(' || t.v === '√' || t.v === '∛')) return true;
    return false;
  };

  Parser.prototype.parseExpression = function () {
    var v = this.parseTerm();
    while (this.peek() && this.peek().t === 'op' && (this.peek().v === '+' || this.peek().v === '-')) {
      var op = this.next().v;
      var r = this.parseTerm();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  };

  Parser.prototype.parseTerm = function () {
    var v = this.parseUnary();
    for (;;) {
      var t = this.peek();
      if (t && t.t === 'op' && (t.v === '*' || t.v === '/' || t.v === '%')) {
        this.next();
        var r = this.parseUnary();
        if (t.v === '*') v = v * r;
        else if (t.v === '/') v = v / r;
        else v = v % r;
      } else if (this.startsPrimary()) {
        // 隐式乘法：2π、3√2、2(3+4)、πe
        v = v * this.parseUnary();
      } else break;
    }
    return v;
  };

  Parser.prototype.parseUnary = function () {
    if (this.isOp('-')) { this.next(); return -this.parseUnary(); }
    if (this.isOp('+')) { this.next(); return this.parseUnary(); }
    return this.parsePower();
  };

  Parser.prototype.parsePower = function () {
    var base = this.parsePostfix();
    if (this.isOp('^')) {
      this.next();
      var exp = this.parseUnary();      // 右结合
      base = Math.pow(base, exp);
    }
    return base;
  };

  Parser.prototype.parsePostfix = function () {
    var v = this.parsePrimary();
    while (this.isOp('!')) {
      this.next();
      v = factorial(v);
    }
    return v;
  };

  Parser.prototype.parsePrimary = function () {
    var t = this.next();
    if (!t) throw new Err('表达式在这里就结束了，还缺一个数或常数', this.p);
    if (t.t === 'num') return t.v;
    if (t.t === 'const') return t.v.value;
    if (t.t === 'op' && t.v === '(') {
      var v = this.parseExpression();
      if (!this.isOp(')')) throw new Err('少了一个右括号 )', this.p);
      this.next();
      return v;
    }
    if (t.t === 'op' && (t.v === '√' || t.v === '∛')) {
      var operand = this.parsePostfix();
      return t.v === '√' ? Math.sqrt(operand) : Math.cbrt(operand);
    }
    if (t.t === 'func') {
      var arg;
      if (this.isOp('(')) {
        this.next();
        var args = [this.parseExpression()];
        while (this.isOp(',')) { this.next(); args.push(this.parseExpression()); }
        if (!this.isOp(')')) throw new Err('函数 ' + t.raw + ' 的括号没有闭合', this.p);
        this.next();
        arg = args;
      } else {
        arg = [this.parsePostfix()];      // ln2、sin1、ζ(3) 之外的 zeta3 都能用
      }
      var fn = FUNC_TABLE[t.v];
      return fn.apply(null, arg);
    }
    if (t.t === 'op' && t.v === '-') return -this.parseUnary();
    if (t.t === 'op') throw new Err('运算符「' + t.v + '」前面缺少数字', t.pos);
    throw new Err('无法解析的位置', t.pos);
  };

  function factorial(n) {
    if (n < 0 || Math.abs(n - Math.round(n)) > 1e-12 || n > 170) return NaN;
    var r = 1;
    for (var i = 2; i <= n; i++) r *= i;
    return r;
  }

  function evaluate(src) {
    var tokens = tokenize(src);
    if (!tokens.length) throw new Err('还没有输入表达式', 0);
    var p = new Parser(tokens);
    var v = p.parseExpression();
    if (p.p < tokens.length) throw new Err('表达式结尾有多余内容', tokens[p.p].pos);
    return v;
  }

  /** 安全求值：返回 {ok, value, error} */
  function tryEvaluate(src) {
    try { return { ok: true, value: evaluate(src) }; }
    catch (e) { return { ok: false, error: e.message || String(e) }; }
  }

  /* ------------------------------------------------------------------ *
   * 4. 表达式结构分析（用于自动生成"结构提示"）
   * ------------------------------------------------------------------ */
  function analyze(src) {
    var tokens = tokenize(src);
    var info = {
      consts: [], funcs: [], ints: [], opCount: 0,
      hasRoot: false, hasPow: false, hasDiv: false, hasAdd: false, hasSub: false,
      hasMul: false, maxDepth: 0, cats: {}, text: normalize(src)
    };
    var depth = 0;
    tokens.forEach(function (t) {
      if (t.t === 'const') {
        var c = t.v;
        if (info.consts.indexOf(c) < 0) info.consts.push(c);
        info.cats[c.cat] = (info.cats[c.cat] || 0) + 1;
      } else if (t.t === 'func') {
        if (info.funcs.indexOf(t.v) < 0) info.funcs.push(t.v);
        if (t.v === 'sqrt' || t.v === 'cbrt') info.hasRoot = true;
      } else if (t.t === 'num') {
        if (info.ints.indexOf(t.v) < 0) info.ints.push(t.v);
      } else if (t.t === 'op') {
        if (t.v === '(') { depth++; info.maxDepth = Math.max(info.maxDepth, depth); }
        else if (t.v === ')') depth--;
        else if (t.v === '√' || t.v === '∛') { info.hasRoot = true; info.opCount++; }
        else {
          info.opCount++;
          if (t.v === '^') info.hasPow = true;
          else if (t.v === '/') info.hasDiv = true;
          else if (t.v === '*') info.hasMul = true;
          else if (t.v === '+') info.hasAdd = true;
          else if (t.v === '-') info.hasSub = true;
        }
      }
    });
    return info;
  }

  /** 生成第一级提示：只说结构，不露答案 */
  function structureHint(src) {
    var a = analyze(src);
    var parts = [];
    parts.push('整个式子共出现 ' + (a.ints.length + a.consts.length) + ' 个不同的数字/常数，' + a.opCount + ' 个运算符');
    var ops = [];
    if (a.hasAdd) ops.push('加法');
    if (a.hasSub) ops.push('减法');
    if (a.hasMul) ops.push('乘法');
    if (a.hasDiv) ops.push('除法');
    if (a.hasPow) ops.push('乘方');
    if (a.hasRoot) ops.push('开方');
    if (ops.length) parts.push('用到了：' + ops.join('、'));
    if (a.maxDepth >= 2) parts.push('有嵌套括号');
    else if (a.maxDepth === 1) parts.push('有一层括号');
    return parts.join('；') + '。';
  }

  /** 推断这个表达式取值里混进了哪几类数（有理数 / 代数无理数 / 超越数） */
  function inferKinds(src) {
    var tokens = tokenize(src);
    var a = analyze(src);
    var kinds = [];
    var add = function (k) { if (kinds.indexOf(k) < 0) kinds.push(k); };

    a.consts.forEach(function (c) {
      if (c.cat === '代数无理数') add('代数无理数');
      else if (c.cat === '超越数') add('超越数');
      else add('无理数（超越性未知）');
    });
    if (a.hasRoot) add('代数无理数');

    // e^(1/3) 这类分数次幂：非完全幂的整数开方 → 代数无理数
    var fracPow = false;
    tokens.forEach(function (t, i) {
      if (t.t === 'op' && t.v === '^' && tokens[i + 1] && tokens[i + 1].t === 'op' && tokens[i + 1].v === '(') {
        var depth = 0;
        for (var j = i + 1; j < tokens.length; j++) {
          if (tokens[j].v === '(') depth++;
          else if (tokens[j].v === ')') { depth--; if (!depth) break; }
          else if (tokens[j].v === '/') fracPow = true;
        }
      }
    });
    if (fracPow) add('代数无理数');

    // 根式出现在指数上（2^√2）由 Gelfond–Schneider 定理给出超越数
    if (a.hasPow && a.hasRoot) add('超越数');

    // ln / log / sin / cos / tan / exp / ζ 取有理数点，通常是超越数
    ['ln', 'log', 'log10', 'log2', 'sin', 'cos', 'tan', 'exp', 'ζ', 'zeta'].forEach(function (f) {
      if (a.funcs.indexOf(f) >= 0) add('超越数');
    });

    if (!kinds.length) add('有理数');
    return { list: kinds, analysis: a };
  }

  /** 生成第二级提示：说出"数的类型"，仍不露具体数字 */
  function typeHint(src) {
    var k = inferKinds(src);
    var a = k.analysis;
    var txt = '数的成分：有理数（整数与分数）';
    var extra = k.list.filter(function (x) { return x !== '有理数'; });
    if (extra.length) txt += ' 与 ' + extra.join('、');
    txt += '。';
    if (a.consts.length) txt += '涉及的常数：' + a.consts.map(function (c) { return c.cn; }).join('、') + '。';
    if (a.funcs.length) {
      txt += '用到的函数：' + a.funcs.map(function (f) { return FUNC_CN[f] || f; }).join('、') + '。';
    }
    if (extra.indexOf('超越数') >= 0) txt += '（超越数的小数位是"随机"的，只能靠记忆里的前几位去认。）';
    return txt;
  }

  /* ------------------------------------------------------------------ *
   * 5. 数值工具
   * ------------------------------------------------------------------ */
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = a % b; a = b; b = t; } return a; }
  function ri(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function coprime(a, b) { return gcd(a, b) === 1; }
  function nonSquare(min, max) {
    for (var i = 0; i < 60; i++) {
      var n = ri(min, max);
      if (!Number.isInteger(Math.sqrt(n))) return n;
    }
    return 7;
  }
  function frac(minA, maxA, minB, maxB) {
    for (var i = 0; i < 80; i++) {
      var a = ri(minA, maxA), b = ri(minB, maxB);
      if (b > 1 && coprime(a, b)) return { a: a, b: b };
    }
    return { a: 3, b: 7 };
  }

  /** 高精度显示一个数（最多 15 位有效数字，去掉多余零） */
  function formatPrecise(v, maxDigits) {
    if (!isFinite(v)) return String(v);
    if (v === 0) return '0';
    var sign = v < 0 ? '-' : '';
    var av = Math.abs(v);
    if (av >= 1e15 || av < 1e-9) {
      return sign + av.toExponential(11).replace(/\.?0+e/, 'e');
    }
    var digits = maxDigits || 15;
    var intLen = Math.floor(Math.log10(av)) + 1;
    var decimals = Math.max(0, Math.min(15, digits - Math.max(intLen, 1) + (intLen <= 0 ? -intLen + 1 : 0)));
    var s = av.toFixed(Math.min(15, decimals + (intLen <= 0 ? -intLen : 0)));
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return sign + s;
  }

  /** 逐字符对比显示值与用户值的小数位，返回 [{ch, ok, isDot}] */
  function digitDiff(shown, value) {
    var d = (shown.split('.')[1] || '').length;
    var s = shown;
    var u = isFinite(value) ? value.toFixed(Math.min(15, Math.max(d, 0))) : '×';
    var out = [], n = Math.max(s.length, u.length);
    for (var i = 0; i < n; i++) {
      var a = s[i] === undefined ? ' ' : s[i];
      var b = u[i] === undefined ? ' ' : u[i];
      out.push({ ch: b, target: a, ok: a === b });
    }
    return out;
  }

  /** 判定用户表达式与目标的关系 */
  function judge(userValue, targetValue, digits) {
    var tol = 0.5 * Math.pow(10, -digits) * (1 + 1e-9);
    var diff = Math.abs(userValue - targetValue);
    var rel = diff / Math.max(1e-12, Math.abs(targetValue));
    return {
      diff: diff,
      rel: rel,
      exact: isFinite(userValue) && diff <= 1e-9 * Math.max(1, Math.abs(targetValue)),
      matchRound: isFinite(userValue) && diff <= tol,
      tol: tol
    };
  }

  /* ------------------------------------------------------------------ *
   * 6. 题库模板
   *    每个模板返回 {display, label}；display 必须能被本文件的解析器读懂
   *    且不得含小数点（"答案不许写小数"这条规则由模板天生保证）
   * ------------------------------------------------------------------ */
  var TEMPLATES = [
    /* ---------- 难度 1：入门，显示 4 位小数 ---------- */
    { tier: 1, label: '两个整数的商', gen: function () { var f = frac(1, 12, 2, 12); return { display: f.a + '/' + f.b }; } },
    { tier: 1, label: '整数的平方根', gen: function () { return { display: '√' + nonSquare(2, 40) }; } },
    { tier: 1, label: 'π 与整数相除', gen: function () { return { display: 'π/' + ri(2, 9) }; } },
    { tier: 1, label: 'π 的整数倍', gen: function () { return { display: ri(2, 9) + 'π' }; } },
    { tier: 1, label: 'π 与整数相加减', gen: function () { return { display: Math.random() < 0.5 ? 'π+' + ri(1, 9) : 'π-' + ri(1, 3) }; } },
    { tier: 1, label: '两个分数的和', gen: function () { var f = frac(1, 9, 2, 11), g = frac(1, 9, 2, 11); return { display: f.a + '/' + f.b + '+' + g.a + '/' + g.b }; } },
    { tier: 1, label: '自然对数', gen: function () { return { display: 'ln' + ri(2, 10) }; } },
    { tier: 1, label: 'e 的整数次幂', gen: function () { return { display: 'e^' + ri(2, 3) }; } },
    { tier: 1, label: '分数与 π 相乘', gen: function () { var f = frac(2, 11, 2, 9); return { display: f.a + 'π/' + f.b }; } },
    { tier: 1, label: '根式与整数相加', gen: function () { return { display: '√' + nonSquare(2, 30) + '+' + ri(1, 8) }; } },

    /* ---------- 难度 2：进阶，显示 6 位小数 ---------- */
    { tier: 2, label: '根式的整数倍加整数', gen: function () { return { display: ri(2, 6) + '√' + nonSquare(2, 20) + '+' + ri(1, 9) }; } },
    { tier: 2, label: 'π 的平方除以整数', gen: function () { return { display: 'π²/' + ri(1, 12) }; } },
    { tier: 2, label: 'e 的分数次幂', gen: function () { return { display: 'e^(1/' + ri(2, 5) + ')' }; } },
    { tier: 2, label: '整系数根式除以整数', gen: function () { return { display: ri(2, 7) + '√' + nonSquare(2, 24) + '/' + ri(2, 6) }; } },
    { tier: 2, label: 'a 与根式的和除以整数', gen: function () { return { display: '(' + ri(1, 6) + '+' + ri(2, 5) + '√' + nonSquare(2, 12) + ')/' + ri(2, 7) }; } },
    { tier: 2, label: '黄金比的乘方', gen: function () { return { display: 'φ^' + ri(2, 5) }; } },
    { tier: 2, label: 'π 的分数倍', gen: function () { return { display: ri(2, 11) + 'π/' + ri(2, 9) }; } },
    { tier: 2, label: '分数与根式相加', gen: function () { var f = frac(1, 9, 2, 9); return { display: f.a + '/' + f.b + '+√' + nonSquare(2, 20) }; } },
    { tier: 2, label: '分数的平方根', gen: function () { var f = frac(2, 9, 2, 9); return { display: '√(' + f.a + '/' + f.b + ')' }; } },
    { tier: 2, label: '两个根式相加', gen: function () { return { display: '√' + nonSquare(2, 30) + '+√' + nonSquare(2, 30) }; } },
    { tier: 2, label: '自然对数加整数', gen: function () { return { display: 'ln' + ri(2, 12) + '+' + ri(1, 7) }; } },
    { tier: 2, label: 'π 的分数倍与分数的和', gen: function () { var f = frac(1, 9, 2, 9); return { display: ri(2, 9) + 'π/' + ri(2, 9) + '+' + f.a + '/' + f.b }; } },

    /* ---------- 难度 3：困难，显示 8 位小数 ---------- */
    { tier: 3, label: 'π 的倍数与根式的和', gen: function () { return { display: ri(2, 7) + 'π+' + ri(2, 6) + '√' + nonSquare(2, 15) }; } },
    { tier: 3, label: 'π 与 e 的整数组合', gen: function () { return { display: ri(2, 6) + 'π+' + ri(2, 6) + 'e' }; } },
    { tier: 3, label: '嵌套根式', gen: function () { return { display: '√(' + ri(2, 9) + '+' + ri(2, 6) + '√' + nonSquare(2, 12) + ')' }; } },
    { tier: 3, label: '欧拉常数加分数', gen: function () { var f = frac(1, 9, 2, 11); return { display: 'γ+' + f.a + '/' + f.b }; } },
    { tier: 3, label: '阿培里常数的分数倍', gen: function () { return { display: ri(2, 9) + 'ζ(3)/' + ri(2, 7) }; } },
    { tier: 3, label: '卡塔兰常数的分数倍', gen: function () { return { display: ri(2, 9) + 'G/' + ri(2, 7) }; } },
    { tier: 3, label: '整数的分数次幂', gen: function () { return { display: ri(2, 30) + '^(1/' + ri(2, 5) + ')' }; } },
    { tier: 3, label: 'πe 除以整数', gen: function () { return { display: 'πe/' + ri(2, 9) }; } },
    { tier: 3, label: 'e^π 除以整数', gen: function () { return { display: 'e^π/' + ri(2, 9) }; } },
    { tier: 3, label: '自然对数与 π 的分数之和', gen: function () { return { display: 'ln' + ri(2, 12) + '+π/' + ri(2, 9) }; } },
    { tier: 3, label: '三个分数之和', gen: function () { var f = frac(1, 9, 2, 9), g = frac(1, 9, 2, 9), h = frac(1, 9, 2, 9); return { display: f.a + '/' + f.b + '+' + g.a + '/' + g.b + '+' + h.a + '/' + h.b }; } },
    { tier: 3, label: '格尔丰德常数的分数倍', gen: function () { return { display: '2^√2/' + ri(2, 7) }; } },

    /* ---------- 难度 4：专家，显示 10 位小数 ---------- */
    { tier: 4, label: 'π、e 与分数三合一', gen: function () { var f = frac(1, 9, 2, 11); return { display: ri(2, 7) + 'π+' + ri(2, 7) + 'e+' + f.a + '/' + f.b }; } },
    { tier: 4, label: 'π² 的分数倍加分数（含 ζ(2)）', gen: function () { var f = frac(1, 9, 2, 11); return { display: 'π²/' + ri(2, 12) + '+' + f.a + '/' + f.b }; } },
    { tier: 4, label: '根式分数与分数之和', gen: function () { var f = frac(1, 9, 2, 11); return { display: '(' + ri(1, 7) + '+' + ri(2, 5) + '√' + nonSquare(2, 12) + ')/' + ri(2, 7) + '+' + f.a + '/' + f.b }; } },
    { tier: 4, label: '卡塔兰常数与阿培里常数', gen: function () { return { display: 'G+' + ri(2, 8) + 'ζ(3)/' + ri(2, 7) }; } },
    { tier: 4, label: 'e^π 的分数倍加分数', gen: function () { var f = frac(1, 9, 2, 11); return { display: 'e^π/' + ri(2, 9) + '+' + f.a + '/' + f.b }; } },
    { tier: 4, label: 'π² 与 e 的分数组合', gen: function () { return { display: 'π²/' + ri(2, 9) + '+e/' + ri(2, 9) }; } },
    { tier: 4, label: '自然对数与 π 的乘积', gen: function () { return { display: 'ln' + ri(2, 9) + 'π/' + ri(2, 9) }; } },
    { tier: 4, label: '根式分数与 π 的组合', gen: function () { var f = frac(2, 9, 2, 9); return { display: '√(' + f.a + '/' + f.b + ')π/' + ri(2, 9) }; } },
    { tier: 4, label: '整数的高次根与分数', gen: function () { return { display: ri(2, 30) + '^√' + nonSquare(2, 9) + '/' + ri(2, 7) }; } },
    { tier: 4, label: '黄金比乘方与分数', gen: function () { return { display: 'φ^' + ri(2, 6) + '/' + ri(2, 7) }; } },
    { tier: 4, label: '根式、分数与整数三合一', gen: function () { var f = frac(1, 9, 2, 11); return { display: '√' + nonSquare(2, 30) + '+' + ri(2, 7) + 'π/' + ri(2, 7) + '+' + f.a + '/' + f.b }; } }
  ];

  var DIGITS = { 1: 4, 2: 6, 3: 8, 4: 10 };
  var TIER_CN = { 1: '简单', 2: '普通', 3: '困难', 4: '专家' };

  /** 判断小数是否在 d 位内就"终止"了（太容易看穿，中高难度不用） */
  function terminates(value, d) {
    var x = Math.abs(value) * Math.pow(10, d);
    return Math.abs(x - Math.round(x)) < 1e-6;
  }

  function makeTarget(tier, opts) {
    opts = opts || {};
    var pool = TEMPLATES.filter(function (t) { return t.tier === tier; });
    if (!pool.length) pool = TEMPLATES;
    var lastDisplay = opts.avoid;
    for (var attempt = 0; attempt < 600; attempt++) {
      var tpl = pick(pool);
      var cand = tpl.gen();
      if (!cand || !cand.display) continue;
      if (cand.display.indexOf('.') >= 0) continue;
      var res = tryEvaluate(cand.display);
      if (!res.ok || !isFinite(res.value)) continue;
      var v = res.value;
      if (v <= 0.05 || v >= 250) continue;                   // 量级要适合"目测小数"
      if (Math.abs(v - Math.round(v)) < 1e-6) continue;       // 别出整数
      if (tier >= 2 && terminates(v, DIGITS[tier])) continue;  // 别出终止小数
      var shown = v.toFixed(DIGITS[tier]);
      if (shown === lastDisplay) continue;
      if (/^(\d)\1*$/.test(shown.replace('.', ''))) continue;  // 别出 1.1111 这种
      return {
        display: cand.display,
        value: v,
        shown: shown,
        digits: DIGITS[tier],
        tier: tier,
        tierName: TIER_CN[tier],
        label: tpl.label,
        analysis: analyze(cand.display)
      };
    }
    // 兜底：一个永远不会失败的题目
    var fv = 22 / 7;
    return {
      display: '22/7', value: fv, shown: fv.toFixed(DIGITS[tier] || 4),
      digits: DIGITS[tier] || 4, tier: tier || 1, tierName: TIER_CN[tier] || '简单',
      label: '两个整数的商', analysis: analyze('22/7')
    };
  }

  /* ------------------------------------------------------------------ *
   * 7. 计分
   * ------------------------------------------------------------------ */
  var TIER_BASE = { 1: 120, 2: 200, 3: 320, 4: 480 };
  var HINT_COST = { 1: 20, 2: 45, 3: 0 };
  var WRONG_COST = 12;

  function scoreRound(o) {
    var base = TIER_BASE[o.tier] || 120;
    var lines = [{ label: '答对基础分（' + (TIER_CN[o.tier] || '') + '）', delta: base }];
    var total = base;

    var limit = 90;
    var speed = Math.max(0, Math.round((limit - Math.min(o.seconds, limit)) / limit * base * 0.5));
    if (speed > 0) { total += speed; lines.push({ label: '速度奖励（用时 ' + o.seconds.toFixed(1) + ' 秒）', delta: speed }); }

    if (o.hintsUsed && o.hintsUsed.length) {
      var cost = 0;
      o.hintsUsed.forEach(function (h) { cost += HINT_COST[h] || 0; });
      if (cost) { total -= cost; lines.push({ label: '使用 ' + o.hintsUsed.length + ' 次提示', delta: -cost }); }
    }
    if (o.wrongs) {
      var pen = o.wrongs * WRONG_COST;
      total -= pen; lines.push({ label: '答错 ' + o.wrongs + ' 次', delta: -pen });
    }
    if (o.perfect) { var pb = Math.round(base * 0.4); total += pb; lines.push({ label: '数值完全精确！', delta: pb }); }
    if (o.canonical) { var cb = Math.round(base * 0.25); total += cb; lines.push({ label: '与出题人写法一致', delta: cb }); }
    if (o.streak > 0) { var sb = 8 * Math.min(o.streak, 5); total += sb; lines.push({ label: '连击 ×' + o.streak, delta: sb }); }

    var floor = o.revealed ? 0 : 10;
    if (total < floor) { lines.push({ label: '本题保底/作废', delta: floor - total }); total = floor; }
    return { total: Math.round(total), lines: lines };
  }

  /* ------------------------------------------------------------------ *
   * 8. 小游戏素材
   * ------------------------------------------------------------------ */
  /** 生成一对数值接近的表达式，用于"比大小" */
  function makeComparePair() {
    var a = null, b = null;
    for (var i = 0; i < 400; i++) {
      var t1 = makeTarget(ri(1, 2));
      var t2 = makeTarget(ri(1, 2));
      if (t1.display === t2.display) continue;
      var la = Math.log(Math.abs(t1.value)), lb = Math.log(Math.abs(t2.value));
      var gap = Math.abs(la - lb);
      if (gap < 0.02 || gap > 0.35) continue;      // 太接近看不出来、太远没意思
      a = t1; b = t2;
      break;
    }
    if (!a) {
      a = makeTarget(1); b = makeTarget(1);
      if (Math.abs(Math.log(a.value) - Math.log(b.value)) < 0.02) b = makeTarget(2);
    }
    return { left: a, right: b, bigger: a.value > b.value ? 'left' : 'right' };
  }

  /** 生成一个"估数"题目 */
  function makeEstimateTarget(tier) {
    return makeTarget(tier || ri(2, 3));
  }

  function estimateScore(estimate, truth) {
    if (!isFinite(estimate)) return { score: 0, rel: Infinity, grade: '无效输入' };
    var rel = Math.abs(estimate - truth) / Math.max(1e-12, Math.abs(truth));
    var score, grade;
    if (rel <= 0.0005) { score = 120; grade = '神之数感'; }
    else if (rel <= 0.002) { score = 100; grade = '极其精准'; }
    else if (rel <= 0.01) { score = 80; grade = '相当不错'; }
    else if (rel <= 0.03) { score = 55; grade = '还算靠谱'; }
    else if (rel <= 0.08) { score = 30; grade = '有点飘'; }
    else if (rel <= 0.2) { score = 10; grade = '差得有点远'; }
    else { score = 0; grade = '完全跑偏'; }
    return { score: score, rel: rel, grade: grade };
  }

  return {
    VERSION: '1.0.0',
    CONSTANTS: CONSTANTS,
    CONST_MAP: CONST_MAP,
    FUNC_TABLE: FUNC_TABLE,
    FUNC_CN: FUNC_CN,
    TEMPLATES: TEMPLATES,
    DIGITS: DIGITS,
    TIER_CN: TIER_CN,
    TIER_BASE: TIER_BASE,
    HINT_COST: HINT_COST,
    WRONG_COST: WRONG_COST,
    tokenize: tokenize,
    evaluate: evaluate,
    tryEvaluate: tryEvaluate,
    analyze: analyze,
    inferKinds: inferKinds,
    structureHint: structureHint,
    typeHint: typeHint,
    formatPrecise: formatPrecise,
    digitDiff: digitDiff,
    judge: judge,
    makeTarget: makeTarget,
    scoreRound: scoreRound,
    makeComparePair: makeComparePair,
    makeEstimateTarget: makeEstimateTarget,
    estimateScore: estimateScore,
    gcd: gcd
  };
});
