/* =========================================================================
 * 数感训练场 · 界面与游戏流程
 * 依赖 core.js 暴露的 window.NS
 * ========================================================================= */
(function () {
  'use strict';

  var NS = window.NS;
  if (!NS) { document.body.innerHTML = '<p style="padding:40px">核心脚本加载失败。</p>'; return; }

  /* ---------------- 小工具 ---------------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt !== undefined && txt !== null) n.textContent = txt;
    return n;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var SUP_DIGITS = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
  function sup(n) { return String(n).split('').map(function (c) { return SUP_DIGITS[+c] || c; }).join(''); }
  function tolText(d) { return '5×10⁻' + sup(d) + '（也就是 ' + NS.formatPrecise(0.5 * Math.pow(10, -d)) + '）'; }
  function timeText(sec) {
    if (sec < 60) return sec.toFixed(1) + ' 秒';
    return Math.floor(sec / 60) + ' 分 ' + Math.round(sec % 60) + ' 秒';
  }
  function dateText(ts) {
    var d = new Date(ts);
    var p = function (x) { return x < 10 ? '0' + x : String(x); };
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  /* ---------------- 存档 ---------------- */
  var KEY = { profile: 'ns.profile.v1', log: 'ns.log.v1', rank: 'ns.rank.v1' };
  function loadJSON(k, def) {
    try { var s = localStorage.getItem(k); return s ? JSON.parse(s) : def; } catch (e) { return def; }
  }
  function saveJSON(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) { toast('浏览器拒绝保存数据（可能是隐私模式）', 'bad'); return false; }
  }

  var profile = Object.assign({
    player: '无名数感师', totalScore: 0, rounds: 0, solved: 0,
    bestRound: 0, bestStreak: 0, totalTime: 0,
    theme: 'dark', sound: true, peek: false, tier: 2, autoTier: true
  }, loadJSON(KEY.profile, {}));
  var logs = loadJSON(KEY.log, []);
  var rank = loadJSON(KEY.rank, []);
  if (!Array.isArray(logs)) logs = [];
  if (!Array.isArray(rank)) rank = [];

  function saveProfile() {
    profile.player = S.player;
    profile.totalScore = S.totalScore;
    profile.bestStreak = Math.max(profile.bestStreak, S.bestStreak);
    profile.theme = S.theme; profile.sound = S.sound;
    profile.peek = S.peek; profile.tier = S.tier; profile.autoTier = S.autoTier;
    saveJSON(KEY.profile, profile);
  }

  /* ---------------- 状态 ---------------- */
  var S = {
    mode: 'classic',
    tier: profile.tier, autoTier: profile.autoTier,
    peek: profile.peek, sound: profile.sound, theme: profile.theme,
    player: profile.player,
    totalScore: profile.totalScore,
    bestStreak: profile.bestStreak,
    roundsPerGame: 10,
    round: 0, gameScore: 0, streak: 0, gameSolved: 0, gameTime: 0,
    cur: null, timer: null, nextTimer: null, nextCountdown: null
  };

  /* ---------------- 音效 ---------------- */
  var audioCtx = null;
  function beep(freq, dur, type, gain) {
    if (!S.sound) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.value = gain || 0.05;
      o.connect(g); g.connect(audioCtx.destination);
      var t = audioCtx.currentTime;
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* 静默失败 */ }
  }
  var sfx = {
    click: function () { beep(520, 0.05, 'square', 0.025); },
    type: function () { beep(760, 0.03, 'triangle', 0.015); },
    good: function () { beep(660, 0.12, 'sine', 0.06); setTimeout(function () { beep(880, 0.16, 'sine', 0.06); }, 90); setTimeout(function () { beep(1180, 0.2, 'sine', 0.05); }, 190); },
    bad: function () { beep(220, 0.18, 'sawtooth', 0.05); setTimeout(function () { beep(160, 0.22, 'sawtooth', 0.045); }, 110); },
    tick: function () { beep(400, 0.04, 'sine', 0.02); }
  };

  /* ---------------- 浮层提示 ---------------- */
  var toastTimer = null;
  function toast(msg, kind) {
    var t = $('#toast');
    t.textContent = msg;
    t.className = 'toast show' + (kind ? ' ' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = 'toast' + (kind ? ' ' + kind : ''); }, 2600);
  }

  /* ---------------- 顶栏 ---------------- */
  function refreshHud() {
    $('#hudScore').textContent = S.gameScore;
    $('#hudStreak').textContent = S.streak;
    $('#hudTotal').textContent = S.totalScore;
    $('#soundBtn').classList.toggle('off', !S.sound);
  }

  /* ---------------- 按钮盘 ---------------- */
  var PAD_GROUPS = [
    {
      title: '数字', keys: [
        ['7', '7', 'k'], ['8', '8', 'k'], ['9', '9', 'k'],
        ['4', '4', 'k'], ['5', '5', 'k'], ['6', '6', 'k'],
        ['1', '1', 'k'], ['2', '2', 'k'], ['3', '3', 'k'],
        ['0', '0', 'k'], ['⌫ 退格', null, 'soft act-back'], ['清空', null, 'soft act-clear']
      ]
    },
    {
      title: '运算', keys: [
        ['+', '+', 'k'], ['−', '-', 'k'], ['×', '×', 'k'], ['÷', '÷', 'k'],
        ['^', '^', 'k'], ['√', '√', 'k'], ['(', '(', 'k'], [')', ')', 'k'],
        ['!', '!', 'k'], ['/', '/', 'k'], ['.', null, 'k locked']
      ]
    },
    {
      title: '函数', keys: [
        ['ln', 'ln', 'soft'], ['log', 'log', 'soft'], ['sin', 'sin', 'soft'],
        ['cos', 'cos', 'soft'], ['tan', 'tan', 'soft'], ['exp', 'exp', 'soft']
      ]
    }
  ];

  function buildPad() {
    var pad = $('#pad');
    pad.innerHTML = '';
    PAD_GROUPS.forEach(function (g) {
      var box = el('div', 'pad-group');
      box.appendChild(el('h5', null, g.title));
      var keys = el('div', 'pad-keys');
      g.keys.forEach(function (k) {
        var label = k[0], ins = k[1], cls = k[2] || '';
        var b = el('button', 'pad-btn ' + (cls.indexOf('k') === 0 ? '' : cls), label);
        b.setAttribute('type', 'button');
        if (cls.indexOf('locked') >= 0) {
          b.disabled = true;
          b.title = '答案里不允许出现小数点';
          b.classList.add('locked');
        } else if (cls.indexOf('act-back') >= 0) {
          b.onclick = function () { doBackspace(); };
        } else if (cls.indexOf('act-clear') >= 0) {
          b.onclick = function () { $('#answerInput').value = ''; updateValidity(); $('#answerInput').focus(); sfx.click(); };
        } else {
          b.onclick = function () { insertAnswer(ins); sfx.type(); };
        }
        keys.appendChild(b);
      });
      box.appendChild(keys);
      pad.appendChild(box);
    });

    // 常数组
    var box = el('div', 'pad-group');
    box.appendChild(el('h5', null, '常数'));
    var keys = el('div', 'pad-keys');
    NS.CONSTANTS.filter(function (c) { return c.quick; }).forEach(function (c) {
      var b = el('button', 'pad-btn soft', c.sym);
      b.setAttribute('type', 'button');
      b.title = c.cn + '（' + c.cat + '）';
      b.onclick = function () { insertAnswer(c.sym); sfx.type(); };
      keys.appendChild(b);
    });
    box.appendChild(keys);
    pad.appendChild(box);
  }

  function insertAnswer(text) {
    var inp = $('#answerInput');
    var start = inp.selectionStart === null ? inp.value.length : inp.selectionStart;
    var end = inp.selectionEnd === null ? start : inp.selectionEnd;
    inp.value = inp.value.slice(0, start) + text + inp.value.slice(end);
    var pos = start + text.length;
    inp.focus();
    try { inp.setSelectionRange(pos, pos); } catch (e) { }
    updateValidity();
  }

  function doBackspace() {
    var inp = $('#answerInput');
    var start = inp.selectionStart, end = inp.selectionEnd;
    if (start === null) { inp.value = inp.value.slice(0, -1); }
    else if (start === end && start > 0) {
      inp.value = inp.value.slice(0, start - 1) + inp.value.slice(end);
      start--;
    } else {
      inp.value = inp.value.slice(0, start) + inp.value.slice(end);
    }
    inp.focus();
    try { inp.setSelectionRange(start, start); } catch (e) { }
    updateValidity();
    sfx.click();
  }

  /* ---------------- 答案校验 ---------------- */
  function checkAnswer(raw) {
    if (!raw || !raw.trim()) return { ok: false, msg: '还没有写表达式呢' };
    if (raw.length > 140) return { ok: false, msg: '表达式太长了' };
    var tokens;
    try { tokens = NS.tokenize(raw); }
    catch (e) { return { ok: false, msg: '解析失败：' + e.message }; }
    if (tokens.some(function (t) { return t.t === 'num' && t.dec; })) {
      return { ok: false, msg: '答案里不许出现小数点 —— 想写 1.5 就写 3/2' };
    }
    var r = NS.tryEvaluate(raw);
    if (!r.ok) return { ok: false, msg: '解析失败：' + r.error };
    if (!isFinite(r.value)) return { ok: false, msg: '这个式子算不出有限数值' };
    return { ok: true, value: r.value, tokens: tokens };
  }

  function exprKey(src) {
    try {
      return NS.tokenize(src).map(function (t) {
        if (t.t === 'const') return t.v.sym;
        if (t.t === 'func') return t.v;
        return t.raw !== undefined ? t.raw : t.v;
      }).join(' ');
    } catch (e) { return src; }
  }

  function updateValidity() {
    var box = $('#validity');
    var raw = $('#answerInput').value;
    if (S.cur && S.cur.done) { box.className = 'validity'; box.textContent = '本题已结束'; return; }
    if (!raw.trim()) { box.className = 'validity'; box.textContent = '等待输入……'; return; }
    var c = checkAnswer(raw);
    if (!c.ok) { box.className = 'validity bad'; box.textContent = '✗ ' + c.msg; return; }
    if (S.peek) {
      box.className = 'validity ok';
      box.textContent = '= ' + NS.formatPrecise(c.value, 12);
    } else {
      box.className = 'validity ok';
      box.textContent = '✓ 表达式合法（数值已隐藏，用右侧验算区偷偷看）';
    }
  }

  /* ---------------- 经典模式流程 ---------------- */
  function currentTier() {
    if (!S.autoTier) return S.tier;
    return Math.min(4, 1 + Math.floor(S.streak / 2));
  }

  function stopTimer() {
    if (S.timer) { clearInterval(S.timer); S.timer = null; }
  }
  function startTimer() {
    stopTimer();
    var t0 = S.cur.t0;
    S.timer = setInterval(function () {
      if (!S.cur) return;
      var sec = (performance.now() - t0) / 1000;
      $('#qTimer').textContent = sec.toFixed(1) + ' 秒';
    }, 100);
  }

  function startGame() {
    S.round = 0; S.gameScore = 0; S.streak = 0; S.gameSolved = 0; S.gameTime = 0;
    S.cur = null;
    refreshHud();
    newRound();
  }

  function newRound() {
    clearTimeout(S.nextTimer);
    clearInterval(S.nextCountdown);
    stopTimer();
    if (S.round >= S.roundsPerGame) { showSummary(); return; }
    S.round++;
    profile.rounds++;
    var tier = currentTier();
    var t = NS.makeTarget(tier, { avoid: S.cur && S.cur.target ? S.cur.target.shown : null });
    S.cur = {
      target: t, t0: performance.now(), hints: [], wrongs: 0,
      revealed: false, done: false, calcUses: 0
    };
    $('#qTier').textContent = t.tierName + ' · ' + t.label;
    $('#qProgress').textContent = '第 ' + S.round + ' / ' + S.roundsPerGame + ' 题';
    $('#qCaption').textContent = '这个数由有理数、无理数、超越数组合而成，已被四舍五入到 ' + t.digits + ' 位小数。请还原它未截断的原式。';
    $('#qTarget').textContent = t.shown;
    $('#qNote').textContent = '判定规则：你算出的值四舍五入到 ' + t.digits + ' 位小数后，必须等于上面的数（允许误差 ' + tolText(t.digits) + '）。';
    $('#answerInput').value = '';
    $('#feedback').innerHTML = '';
    $('#hintList').innerHTML = '<span class="muted">还没有使用提示。</span>';
    $('#validity').className = 'validity';
    $('#qTimer').textContent = '0.0 秒';
    $('#tierSeg').querySelectorAll('button').forEach(function (b) {
      var v = +b.dataset.tier;
      b.classList.toggle('active', S.autoTier ? v === 0 : v === S.tier);
    });
    updateValidity();
    startTimer();
    if (S.mode === 'classic') $('#answerInput').focus();
  }

  function renderScoreLines(score) {
    return score.lines.map(function (l) {
      return '<div class="fb-line"><span>' + esc(l.label) + '</span><span class="v" style="color:' +
        (l.delta >= 0 ? 'var(--ok)' : 'var(--bad)') + '">' + (l.delta >= 0 ? '+' : '') + l.delta + '</span></div>';
    }).join('');
  }

  function submitAnswer() {
    if (!S.cur) return;
    if (S.cur.done) { nextRound(); return; }
    var raw = $('#answerInput').value;
    var c = checkAnswer(raw);
    if (!c.ok) { toast(c.msg, 'bad'); sfx.bad(); return; }
    var t = S.cur.target;
    var j = NS.judge(c.value, t.value, t.digits);
    var seconds = (performance.now() - S.cur.t0) / 1000;

    if (!j.matchRound) {
      S.cur.wrongs++;
      sfx.bad();
      var dd = NS.digitDiff(t.shown, c.value);
      var sameCount = 0;
      for (var i = 0; i < dd.length; i++) {
        if (!dd[i].ok) break;
        if (dd[i].ch !== '.') sameCount++;
      }
      var html = '<div class="fb bad">' +
        '<div class="fb-title">还差一点 · 第 ' + S.cur.wrongs + ' 次尝试</div>' +
        '<div class="fb-line"><span>你算出的值</span><span class="v">' + esc(NS.formatPrecise(c.value, 12)) + '</span></div>' +
        '<div class="fb-line"><span>目标显示值</span><span class="v">' + esc(t.shown) + '</span></div>' +
        '<div class="fb-line"><span>差值</span><span class="v">' + (c.value > t.value ? '+' : '') + esc(NS.formatPrecise(c.value - t.value, 6)) + '</span></div>' +
        '<div class="fb-sep"></div>' +
        '<div class="fb-line"><span>相同的前导数字</span><span class="v">' + sameCount + ' 位</span></div>' +
        '<div class="digit-compare">' + dd.map(function (x) {
          return '<span class="dc ' + (x.ok ? 'ok' : '') + (x.ch === '.' ? ' dot' : '') + '">' + (x.ch === '.' ? '.' : esc(x.ch)) + '</span>';
        }).join('') + '</div>' +
        '<div class="fb-actions">' +
        '<button class="btn tiny" data-act="toCalc">送去验算区</button>' +
        '<button class="btn tiny" data-act="hint1">给我点结构提示</button>' +
        '</div></div>';
      $('#feedback').innerHTML = html;
      bindFeedbackActions();
      return;
    }

    // —— 答对 ——
    S.cur.done = true;
    stopTimer();
    var perfect = j.exact;
    var canonical = exprKey(raw) === exprKey(t.display);
    var score = NS.scoreRound({
      tier: t.tier, seconds: seconds, hints: S.cur.hints,
      wrongs: S.cur.wrongs, perfect: perfect, canonical: canonical,
      streak: S.streak, revealed: S.cur.revealed
    });
    S.streak++;
    S.bestStreak = Math.max(S.bestStreak, S.streak);
    S.gameScore += score.total;
    S.totalScore += score.total;
    S.gameSolved++;
    S.gameTime += seconds;
    profile.solved++;
    profile.totalTime += seconds;
    profile.bestRound = Math.max(profile.bestRound, score.total);
    saveProfile();
    refreshHud();
    sfx.good();

    pushLog({
      mode: 'classic', tier: t.tier, tierName: t.tierName, target: t.display,
      shown: t.shown, userExpr: raw, userValue: c.value, ok: true,
      revealed: S.cur.revealed, score: score.total, seconds: seconds,
      hints: S.cur.hints.slice(), wrongs: S.cur.wrongs,
      canonical: canonical, perfect: perfect
    });

    var badges = [];
    if (perfect) badges.push('<span class="badge">数值完全精确</span>');
    if (canonical) badges.push('<span class="badge">正中靶心</span>');
    if (S.streak >= 3) badges.push('<span class="badge">连击 ' + S.streak + '</span>');

    var html2 = '<div class="fb good">' +
      '<div class="fb-title">答对了！ ' + badges.join(' ') + '</div>' +
      '<div class="fb-line"><span>你的式子</span><span class="v">' + esc(raw) + ' = ' + esc(NS.formatPrecise(c.value, 12)) + '</span></div>' +
      '<div class="fb-line"><span>出题人的原式</span><span class="v">' + esc(t.display) + '</span></div>' +
      '<div class="fb-line"><span>本题结构</span><span class="v">' + esc(t.label) + '</span></div>' +
      '<div class="fb-sep"></div>' +
      renderScoreLines(score) +
      '<div class="fb-sep"></div>' +
      '<div class="fb-line"><span>本题得分</span><span class="score-total">' + score.total + '</span></div>' +
      '<div class="fb-actions"><button class="btn primary" data-act="next">下一题 <kbd>Enter</kbd></button>' +
      '<span class="muted" style="align-self:center" id="nextCount">5 秒后自动继续</span></div></div>';
    $('#feedback').innerHTML = html2;
    bindFeedbackActions();

    var left = 5;
    S.nextCountdown = setInterval(function () {
      left--;
      var n = $('#nextCount');
      if (n) n.textContent = left + ' 秒后自动继续';
      if (left <= 0) clearInterval(S.nextCountdown);
    }, 1000);
    S.nextTimer = setTimeout(function () { nextRound(); }, 5200);
  }

  function revealAnswer() {
    if (!S.cur || S.cur.done) return;
    S.cur.revealed = true;
    S.cur.done = true;
    stopTimer();
    var t = S.cur.target;
    var r = NS.tryEvaluate(t.display);
    var seconds = (performance.now() - S.cur.t0) / 1000;
    profile.totalTime += seconds;
    S.streak = 0;
    refreshHud();
    pushLog({
      mode: 'classic', tier: t.tier, tierName: t.tierName, target: t.display,
      shown: t.shown, userExpr: $('#answerInput').value || '（未作答）', userValue: null,
      ok: false, revealed: true, score: 0,
      seconds: seconds,
      hints: S.cur.hints.slice(), wrongs: S.cur.wrongs
    });
    pushHint(3, t.display);
    $('#feedback').innerHTML = '<div class="fb warn">' +
      '<div class="fb-title">答案已揭示，本题不计分（连击清零）</div>' +
      '<div class="fb-line"><span>原式</span><span class="v">' + esc(t.display) + '</span></div>' +
      '<div class="fb-line"><span>精确值</span><span class="v">' + esc(r.ok ? NS.formatPrecise(r.value) : '—') + '</span></div>' +
      '<div class="fb-line"><span>题目类型</span><span class="v">' + esc(t.label) + '</span></div>' +
      '<div class="fb-actions"><button class="btn primary" data-act="next">下一题 <kbd>Enter</kbd></button></div></div>';
    bindFeedbackActions();
  }

  function bindFeedbackActions() {
    $$('#feedback [data-act]').forEach(function (b) {
      b.onclick = function () {
        var a = b.dataset.act;
        if (a === 'next') { clearTimeout(S.nextTimer); clearInterval(S.nextCountdown); nextRound(); }
        else if (a === 'toCalc') { switchTab('calc'); $('#calcInput').value = $('#answerInput').value; runCalc(); }
        else if (a === 'hint1') { switchTab('hint'); useHint(1); }
      };
    });
  }

  function showSummary() {
    clearTimeout(S.nextTimer);
    stopTimer();
    var acc = profile.rounds ? Math.round(profile.solved / profile.rounds * 100) : 0;
    var avg = S.gameSolved ? S.gameTime / S.gameSolved : 0;
    $('#feedback').innerHTML = '<div class="fb">' +
      '<div class="fb-title">本局结束 · 共 ' + S.roundsPerGame + ' 题</div>' +
      '<div class="fb-line"><span>本局总分</span><span class="score-total">' + S.gameScore + '</span></div>' +
      '<div class="fb-line"><span>解出题数</span><span class="v">' + S.gameSolved + ' / ' + S.roundsPerGame + '</span></div>' +
      '<div class="fb-line"><span>平均用时</span><span class="v">' + timeText(avg) + '</span></div>' +
      '<div class="fb-line"><span>历史正确率</span><span class="v">' + acc + '%</span></div>' +
      '<div class="fb-actions">' +
      '<button class="btn primary" data-act="submitRank">把成绩记入排行榜</button>' +
      '<button class="btn" data-act="again">再来一局</button>' +
      '</div></div>';
    $$('#feedback [data-act]').forEach(function (b) {
      b.onclick = function () {
        if (b.dataset.act === 'again') startGame();
        else submitRank(S.gameScore, '经典模式', '10 题 · 解出 ' + S.gameSolved + ' 题 · 平均 ' + timeText(avg));
      };
    });
  }

  function nextRound() {
    clearTimeout(S.nextTimer);
    clearInterval(S.nextCountdown);
    if (S.round >= S.roundsPerGame) { showSummary(); return; }
    newRound();
  }

  /* ---------------- 提示 ---------------- */
  function pushHint(level, text) {
    var box = $('#hintList');
    if (box.querySelector('.muted')) box.innerHTML = '';
    var item = el('div', 'hint-item');
    item.innerHTML = '<h6>提示 ' + level + '</h6><div>' + esc(text) + '</div>';
    box.appendChild(item);
    box.scrollTop = box.scrollHeight;
  }

  function useHint(level) {
    if (!S.cur) { toast('先开始一局吧', 'bad'); return; }
    if (S.cur.done) { toast('本题已经结束', 'bad'); return; }
    if (S.cur.hints.indexOf(level) >= 0) { toast('这个提示已经用过了'); return; }
    var t = S.cur.target;
    S.cur.hints.push(level);
    if (level === 1) pushHint(1, NS.structureHint(t.display));
    else if (level === 2) pushHint(2, NS.typeHint(t.display));
    else { pushHint(3, '原式：' + t.display); revealAnswer(); }
    sfx.click();
  }

  /* ---------------- 侧栏：验算 ---------------- */
  function runCalc() {
    var src = $('#calcInput').value;
    var out = $('#calcOut'), dc = $('#calcDigits');
    if (!src.trim()) {
      out.innerHTML = '<span class="muted">输入一个表达式即可开始验算。</span>';
      dc.innerHTML = '';
      return;
    }
    var r = NS.tryEvaluate(src);
    if (!r.ok) {
      out.innerHTML = '<span class="verdict-bad">✗ ' + esc(r.error) + '</span>';
      dc.innerHTML = '';
      return;
    }
    if (!isFinite(r.value)) {
      out.innerHTML = '<span class="verdict-bad">这个式子算不出有限数值</span>';
      dc.innerHTML = '';
      return;
    }
    var html = '<div class="calc-value">' + esc(NS.formatPrecise(r.value)) + '</div>';
    if (S.cur && S.cur.target) {
      var t = S.cur.target;
      var j = NS.judge(r.value, t.value, t.digits);
      var verdict, cls;
      if (j.exact) { verdict = '完全精确，就是它！'; cls = 'verdict-ok'; }
      else if (j.matchRound) { verdict = '可以四舍五入成目标数 —— 判定通过！'; cls = 'verdict-ok'; }
      else if (j.rel < 1e-3) { verdict = '非常接近，但还差一点点'; cls = 'verdict-near'; }
      else { verdict = '离目标还远'; cls = 'verdict-bad'; }
      html += '<div class="calc-line"><span>目标显示值</span><span class="v">' + esc(t.shown) + '</span></div>' +
        '<div class="calc-line"><span>差值</span><span class="v">' + (r.value > t.value ? '+' : '') + esc(NS.formatPrecise(r.value - t.value, 6)) + '</span></div>' +
        '<div class="calc-line"><span>允许误差</span><span class="v">' + tolText(t.digits) + '</span></div>' +
        '<div class="calc-line"><span>判定</span><span class="' + cls + '">' + verdict + '</span></div>';
      var dd = NS.digitDiff(t.shown, r.value);
      dc.innerHTML = '<div class="muted" style="font-size:11px;width:100%">逐位对比（绿=一致，红=不一致）</div>' +
        dd.map(function (x) {
          return '<span class="dc ' + (x.ok ? 'ok' : '') + (x.ch === '.' ? ' dot' : '') + '">' + (x.ch === '.' ? '.' : esc(x.ch)) + '</span>';
        }).join('');
      if (S.cur && !S.cur.done) S.cur.calcUses++;
    } else {
      html += '<div class="calc-line muted">开始一局后，这里会显示它与目标的差距。</div>';
      dc.innerHTML = '';
    }
    out.innerHTML = html;
  }

  function buildCalcChips() {
    var box = $('#calcChips');
    box.innerHTML = '';
    ['π', 'e', 'φ', 'γ', '√', '^', '(', ')', 'ζ(3)', 'G', 'ln', '/', '×', '+', '-'].forEach(function (s) {
      var b = el('button', 'chip', s);
      b.onclick = function () {
        var inp = $('#calcInput');
        inp.value += s;
        inp.focus();
        runCalc();
        sfx.type();
      };
      box.appendChild(b);
    });
    var clr = el('button', 'chip', '清空');
    clr.onclick = function () { $('#calcInput').value = ''; runCalc(); };
    box.appendChild(clr);
  }

  function buildConstTable() {
    var box = $('#constTable');
    box.innerHTML = '';
    NS.CONSTANTS.forEach(function (c) {
      var row = el('div', 'const-row');
      row.title = (c.note || '') + '  （点一下填入验算区）';
      row.innerHTML = '<span class="sym">' + esc(c.sym) + '</span>' +
        '<span class="cn">' + esc(c.cn) + ' <span class="cat">' + esc(c.cat) + '</span></span>' +
        '<span class="val">' + esc(NS.formatPrecise(c.value, 11)) + '</span>';
      row.onclick = function () {
        $('#calcInput').value += c.sym;
        runCalc();
        sfx.click();
      };
      box.appendChild(row);
    });
  }

  /* ---------------- 侧栏：记录 / 排行 ---------------- */
  function pushLog(entry) {
    entry.ts = Date.now();
    entry.name = S.player;
    logs.unshift(entry);
    if (logs.length > 200) logs = logs.slice(0, 200);
    saveJSON(KEY.log, logs);
    renderLog();
  }

  function renderLog() {
    var grid = $('#statGrid');
    var rounds = profile.rounds || 0;
    var acc = rounds ? Math.round(profile.solved / rounds * 100) : 0;
    var avg = profile.solved ? profile.totalTime / profile.solved : 0;
    var stats = [
      ['累计总分', S.totalScore],
      ['已答题数', rounds],
      ['正确率', acc + '%'],
      ['最高单题', profile.bestRound],
      ['最佳连击', profile.bestStreak],
      ['平均用时', avg ? avg.toFixed(1) + 's' : '—']
    ];
    grid.innerHTML = stats.map(function (s) {
      return '<div class="stat"><span>' + s[0] + '</span><b>' + esc(String(s[1])) + '</b></div>';
    }).join('');

    $('#logCount').textContent = logs.length ? '（最近 ' + logs.length + ' 条）' : '';
    var list = $('#logList');
    if (!logs.length) { list.innerHTML = '<span class="muted">还没有记录，去答一题吧。</span>'; return; }
    list.innerHTML = logs.slice(0, 60).map(function (e) {
      var okCls = e.ok ? 'ok' : 'no';
      var title = e.ok ? '✓ 答对' : (e.revealed ? '✗ 看了答案' : '✗ 未解出');
      return '<div class="log-item ' + okCls + '">' +
        '<div class="top"><span class="expr">' + esc(e.shown || '') + '</span><span>' + title + (e.score ? ' +' + e.score : '') + '</span></div>' +
        '<div class="expr">' + esc(e.target || '') + '</div>' +
        '<div class="meta">' + esc(e.tierName || '') + ' · 你的答案 ' + esc(e.userExpr || '—') +
        ' · ' + (e.seconds ? e.seconds.toFixed(1) + 's' : '—') +
        (e.wrongs ? ' · 错 ' + e.wrongs + ' 次' : '') +
        (e.hints && e.hints.length ? ' · 提示 ' + e.hints.length + ' 次' : '') +
        ' · ' + dateText(e.ts) + '</div></div>';
    }).join('');
  }

  function submitRank(score, mode, detail) {
    if (!score) { toast('0 分就先不记了吧', 'bad'); return; }
    rank.push({ name: S.player || '无名数感师', score: score, mode: mode, detail: detail, ts: Date.now() });
    rank.sort(function (a, b) { return b.score - a.score; });
    if (rank.length > 50) rank = rank.slice(0, 50);
    saveJSON(KEY.rank, rank);
    renderRank();
    switchTab('rank');
    toast('成绩已记入排行榜', 'ok');
    sfx.good();
  }

  function renderRank() {
    var box = $('#rankList');
    if (!rank.length) { box.innerHTML = '<span class="muted">排行榜还是空的。</span>'; return; }
    box.innerHTML = rank.slice(0, 20).map(function (r, i) {
      var medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : ('#' + (i + 1));
      return '<div class="rank-item' + (r.name === S.player ? ' me' : '') + '">' +
        '<div class="top"><span class="' + (i === 0 ? 'no1' : '') + '">' + medal + ' ' + esc(r.name) + '</span>' +
        '<span class="score">' + r.score + '</span></div>' +
        '<div class="meta">' + esc(r.mode) + ' · ' + esc(r.detail || '') + ' · ' + dateText(r.ts) + '</div></div>';
    }).join('');
  }

  /* ---------------- 侧栏 Tab ---------------- */
  function switchTab(name) {
    $$('#sideTabs button').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === name); });
    $$('.tabpane').forEach(function (p) { p.classList.toggle('active', p.id === 'tab-' + name); });
  }

  /* ---------------- 模式切换 ---------------- */
  function setMode(mode) {
    S.mode = mode;
    $$('#modeNav .mode-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.mode === mode); });
    $$('.panel').forEach(function (p) { p.classList.toggle('active', p.id === 'panel-' + mode); });
    if (window.MiniGames) window.MiniGames.onModeChange(mode, S);
    if (mode === 'classic') {
      if (!S.cur) startGame();
      else $('#answerInput').focus();
    }
  }

  /* ---------------- 主题 / 音效 ---------------- */
  function applyTheme() {
    document.body.dataset.theme = S.theme;
    $('#themeBtn').textContent = S.theme === 'dark' ? '◐' : '☀';
  }

  /* ---------------- 导入导出 ---------------- */
  function exportData() {
    var data = { v: 1, exportedAt: new Date().toISOString(), profile: profile, logs: logs, rank: rank };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = '数感训练场-存档-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast('存档已导出', 'ok');
  }

  function importData(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var d = JSON.parse(String(reader.result));
        if (d.profile) { profile = Object.assign(profile, d.profile); }
        if (Array.isArray(d.logs)) logs = d.logs.concat(logs).slice(0, 200);
        if (Array.isArray(d.rank)) { rank = rank.concat(d.rank); rank.sort(function (a, b) { return b.score - a.score; }); rank = rank.slice(0, 50); }
        S.totalScore = profile.totalScore || S.totalScore;
        S.player = profile.player || S.player;
        $('#playerName').value = S.player;
        saveJSON(KEY.profile, profile); saveJSON(KEY.log, logs); saveJSON(KEY.rank, rank);
        renderLog(); renderRank(); refreshHud();
        toast('存档已导入', 'ok');
      } catch (e) { toast('导入失败：文件格式不对', 'bad'); }
    };
    reader.readAsText(file);
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    applyTheme();
    $('#playerName').value = S.player;
    $('#peekChk').checked = S.peek;
    $('#soundBtn').classList.toggle('off', !S.sound);
    buildPad();
    buildCalcChips();
    buildConstTable();
    renderLog();
    renderRank();
    refreshHud();

    // 顶栏
    $('#playerName').oninput = function () { S.player = this.value.trim() || '无名数感师'; saveProfile(); renderRank(); };
    $('#themeBtn').onclick = function () { S.theme = S.theme === 'dark' ? 'light' : 'dark'; applyTheme(); saveProfile(); sfx.click(); };
    $('#soundBtn').onclick = function () { S.sound = !S.sound; refreshHud(); saveProfile(); sfx.click(); };
    $$('#modeNav .mode-btn').forEach(function (b) { b.onclick = function () { setMode(b.dataset.mode); sfx.click(); }; });

    // 难度
    $$('#tierSeg button').forEach(function (b) {
      b.onclick = function () {
        var v = +b.dataset.tier;
        if (v === 0) { S.autoTier = true; toast('自适应：连击越多，难度越高'); }
        else { S.autoTier = false; S.tier = v; toast('难度固定为「' + NS.TIER_CN[v] + '」（' + NS.DIGITS[v] + ' 位小数）'); }
        saveProfile();
        $$('#tierSeg button').forEach(function (x) {
          var xv = +x.dataset.tier;
          x.classList.toggle('active', S.autoTier ? xv === 0 : xv === S.tier);
        });
        if (S.mode === 'classic') {
          if (S.round >= S.roundsPerGame) startGame();       // 本局已结束，换难度直接开新局
          else if (!S.cur || S.cur.done) newRound();
        }
        sfx.click();
      };
    });

    // 答题
    $('#submitBtn').onclick = submitAnswer;
    $('#backspaceBtn').onclick = doBackspace;
    $('#clearBtn').onclick = function () { $('#answerInput').value = ''; updateValidity(); $('#answerInput').focus(); };
    $('#revealBtn').onclick = function () { if (S.cur && !S.cur.done) revealAnswer(); };
    $('#answerInput').addEventListener('input', updateValidity);
    $('#answerInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); submitAnswer(); }
      if (e.key === 'Escape') { this.value = ''; updateValidity(); }
    });
    $('#peekChk').onchange = function () { S.peek = this.checked; saveProfile(); updateValidity(); };

    // 侧栏
    $$('#sideTabs button').forEach(function (b) { b.onclick = function () { switchTab(b.dataset.tab); sfx.click(); }; });
    $('#calcInput').addEventListener('input', runCalc);
    $('#hint1Btn').onclick = function () { useHint(1); };
    $('#hint2Btn').onclick = function () { useHint(2); };
    $('#hint3Btn').onclick = function () { useHint(3); };
    $('#exportBtn').onclick = exportData;
    $('#importBtn').onclick = function () { $('#importFile').click(); };
    $('#importFile').onchange = function () { if (this.files[0]) importData(this.files[0]); this.value = ''; };
    $('#clearDataBtn').onclick = function () {
      if (!confirm('确定清空本机保存的所有成绩与记录？')) return;
      logs = []; rank = [];
      profile = { player: S.player, totalScore: 0, rounds: 0, solved: 0, bestRound: 0, bestStreak: 0, totalTime: 0, theme: S.theme, sound: S.sound, peek: S.peek, tier: S.tier, autoTier: S.autoTier };
      S.totalScore = 0; S.bestStreak = 0;
      saveJSON(KEY.profile, profile); saveJSON(KEY.log, logs); saveJSON(KEY.rank, rank);
      renderLog(); renderRank(); refreshHud();
      toast('数据已清空', 'ok');
    };
    $('#clearRankBtn').onclick = function () {
      if (!confirm('确定清空排行榜？')) return;
      rank = []; saveJSON(KEY.rank, rank); renderRank(); toast('排行榜已清空', 'ok');
    };

    // 全局快捷键（输入框内的回车由各自的监听器处理，避免重复提交）
    document.addEventListener('keydown', function (e) {
      if (S.mode !== 'classic') return;
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.key === 'Enter') { e.preventDefault(); submitAnswer(); }
    });

    startGame();
  }

  // 供小游戏模块复用
  window.NSApp = {
    S: S, sfx: sfx, toast: toast, $: $, $$: $$, el: el, esc: esc,
    saveJSON: saveJSON, loadJSON: loadJSON, KEY: KEY,
    pushLog: pushLog, submitRank: submitRank, get profile() { return profile; },
    setProfile: function (p) { profile = p; }, refreshHud: refreshHud,
    timeText: timeText, dateText: dateText, fmt: NS.formatPrecise
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
