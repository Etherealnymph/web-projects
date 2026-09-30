/* =========================================================================
 * 数感训练场 · 小游戏（比大小 / 估数挑战）
 * ========================================================================= */
(function () {
  'use strict';

  var NS = window.NS;
  var App = window.NSApp;
  if (!NS || !App) return;
  var $ = App.$, $$ = App.$$, el = App.el, esc = App.esc;

  /* ================= 比大小 ================= */
  var CMP = { total: 10, round: 0, score: 0, right: 0, cur: null, t0: 0, raf: null, locked: false, gen: 0 };
  var CMP_LIMIT = 15;
  var currentMode = 'classic';

  function cmpReset() {
    cancelAnimationFrame(CMP.raf);
    CMP.round = 0; CMP.score = 0; CMP.right = 0; CMP.cur = null; CMP.locked = false; CMP.gen++;
  }

  function cmpStart() {
    cmpReset();
    $('#cmpFeedback').innerHTML = '';
    cmpNext();
  }

  function cmpStop() { cancelAnimationFrame(CMP.raf); CMP.locked = true; }

  function cmpNext() {
    if (CMP.round >= CMP.total) { cmpSummary(); return; }
    CMP.round++;
    CMP.gen++;
    CMP.locked = false;
    CMP.cur = NS.makeComparePair();
    CMP.t0 = performance.now();
    $('#cmpProgress').textContent = '第 ' + CMP.round + ' / ' + CMP.total + ' 题';
    $('#cmpScore').textContent = '本局 ' + CMP.score + ' 分';
    $('#cmpLeft').className = 'duel-side';
    $('#cmpRight').className = 'duel-side';
    $('#cmpLeft').querySelector('.duel-expr').textContent = CMP.cur.left.display;
    $('#cmpRight').querySelector('.duel-expr').textContent = CMP.cur.right.display;
    $('#cmpLeft').disabled = false;
    $('#cmpRight').disabled = false;
    $('#cmpFeedback').innerHTML = '';
    tick();
  }

  function tick() {
    if (CMP.locked || !CMP.cur) return;
    var el2 = performance.now() - CMP.t0;
    var left = Math.max(0, CMP_LIMIT * 1000 - el2);
    $('#cmpTimerBar').style.width = (left / (CMP_LIMIT * 1000) * 100) + '%';
    if (left <= 0) { cmpAnswer(null); return; }
    CMP.raf = requestAnimationFrame(tick);
  }

  function cmpAnswer(side) {
    if (CMP.locked || !CMP.cur) return;
    CMP.locked = true;
    cancelAnimationFrame(CMP.raf);
    var cur = CMP.cur;
    var seconds = (performance.now() - CMP.t0) / 1000;
    var correct = side === cur.bigger;
    var gain = 0;
    if (correct) {
      var speed = Math.max(0, Math.round((CMP_LIMIT - Math.min(seconds, CMP_LIMIT)) / CMP_LIMIT * 40));
      gain = 60 + speed;
      CMP.score += gain;
      CMP.right++;
      App.sfx.good();
    } else {
      App.sfx.bad();
    }
    $('#cmpLeft').className = 'duel-side' + (cur.bigger === 'left' ? ' correct' : (side === 'left' ? ' wrong' : ''));
    $('#cmpRight').className = 'duel-side' + (cur.bigger === 'right' ? ' correct' : (side === 'right' ? ' wrong' : ''));
    $('#cmpLeft').disabled = true;
    $('#cmpRight').disabled = true;
    $('#cmpScore').textContent = '本局 ' + CMP.score + ' 分';

    var title = side === null ? '超时了！' : (correct ? '答对了 +' + gain : '答错了');
    var info = '<div class="fb ' + (correct ? 'good' : 'bad') + '">' +
      '<div class="fb-title">' + title + '</div>' +
      '<div class="fb-line"><span>' + esc(cur.left.display) + '</span><span class="v">' + esc(NS.formatPrecise(cur.left.value, 10)) + '</span></div>' +
      '<div class="fb-line"><span>' + esc(cur.right.display) + '</span><span class="v">' + esc(NS.formatPrecise(cur.right.value, 10)) + '</span></div>' +
      '<div class="fb-line"><span>倍数关系</span><span class="v">较大者约为较小者的 ' +
      (Math.max(cur.left.value, cur.right.value) / Math.min(cur.left.value, cur.right.value)).toFixed(3) + ' 倍</span></div>' +
      '<div class="fb-line"><span>用时</span><span class="v">' + seconds.toFixed(1) + ' 秒</span></div>' +
      '<div class="fb-actions"><button class="btn tiny" data-cmp="next">下一题</button></div></div>';
    $('#cmpFeedback').innerHTML = info;
    $$('#cmpFeedback [data-cmp]').forEach(function (b) { b.onclick = cmpNext; });
    App.pushLog({
      mode: 'compare', tierName: '比大小', shown: cur.left.display + '  vs  ' + cur.right.display,
      target: (cur.bigger === 'left' ? cur.left : cur.right).display,
      userExpr: side === null ? '（超时）' : (side === 'left' ? cur.left.display : cur.right.display),
      ok: correct, score: gain, seconds: seconds, wrongs: correct ? 0 : 1
    });
    var myGen = CMP.gen;
    setTimeout(function () { if (CMP.gen === myGen && CMP.locked) cmpNext(); }, 2200);
  }

  function cmpSummary() {
    var acc = Math.round(CMP.right / CMP.total * 100);
    $('#cmpFeedback').innerHTML = '<div class="fb">' +
      '<div class="fb-title">比大小 · 一局结束</div>' +
      '<div class="fb-line"><span>本局得分</span><span class="score-total">' + CMP.score + '</span></div>' +
      '<div class="fb-line"><span>答对</span><span class="v">' + CMP.right + ' / ' + CMP.total + '（' + acc + '%）</span></div>' +
      '<div class="fb-actions"><button class="btn primary" data-cmp="rank">记入排行榜</button>' +
      '<button class="btn" data-cmp="again">再来一局</button></div></div>';
    $$('#cmpFeedback [data-cmp]').forEach(function (b) {
      b.onclick = function () {
        if (b.dataset.cmp === 'again') cmpStart();
        else App.submitRank(CMP.score, '比大小', CMP.right + '/' + CMP.total + ' 正确');
      };
    });
  }

  /* ================= 估数挑战 ================= */
  var EST = { total: 8, round: 0, score: 0, best: 0, cur: null, t0: 0, locked: false, gen: 0 };

  function estReset() { EST.round = 0; EST.score = 0; EST.best = 0; EST.cur = null; EST.locked = false; EST.gen++; }

  function estStart() {
    estReset();
    $('#estFeedback').innerHTML = '';
    estNext();
  }

  function estNext() {
    if (EST.round >= EST.total) { estSummary(); return; }
    EST.round++;
    EST.gen++;
    EST.locked = false;
    EST.cur = NS.makeEstimateTarget();
    EST.t0 = performance.now();
    $('#estProgress').textContent = '第 ' + EST.round + ' / ' + EST.total + ' 题';
    $('#estScore').textContent = '本局 ' + EST.score + ' 分';
    $('#estExpr').textContent = EST.cur.display;
    $('#estInput').value = '';
    $('#estFeedback').innerHTML = '';
    $('#estInput').focus();
  }

  function estSubmit() {
    if (EST.locked || !EST.cur) return;
    var raw = $('#estInput').value.trim();
    if (!/^-?\d+(\.\d+)?$|^-?\.\d+$/.test(raw)) {
      App.toast('请填一个纯数字（可以带小数点），比如 1.4427', 'bad');
      return;
    }
    EST.locked = true;
    var guess = parseFloat(raw);
    var truth = EST.cur.value;
    var res = NS.estimateScore(guess, truth);
    EST.score += res.score;
    EST.best = Math.max(EST.best, res.score);
    $('#estScore').textContent = '本局 ' + EST.score + ' 分';
    if (res.score >= 80) App.sfx.good(); else if (res.score === 0) App.sfx.bad(); else App.sfx.click();
    App.pushLog({
      mode: 'estimate', tierName: '估数挑战', shown: EST.cur.display,
      target: EST.cur.display, userExpr: raw + '（真实值 ' + NS.formatPrecise(truth, 10) + '）',
      ok: res.score >= 55, score: res.score,
      seconds: (performance.now() - EST.t0) / 1000, wrongs: res.score >= 55 ? 0 : 1
    });

    $('#estFeedback').innerHTML = '<div class="fb ' + (res.score >= 80 ? 'good' : res.score >= 30 ? 'warn' : 'bad') + '">' +
      '<div class="fb-title">' + esc(res.grade) + ' +' + res.score + '</div>' +
      '<div class="fb-line"><span>你的估计</span><span class="v">' + esc(raw) + '</span></div>' +
      '<div class="fb-line"><span>真实值</span><span class="v">' + esc(NS.formatPrecise(truth, 12)) + '</span></div>' +
      '<div class="fb-line"><span>相对误差</span><span class="v">' + (res.rel * 100).toFixed(3) + '%</span></div>' +
      '<div class="fb-line"><span>出题原式</span><span class="v">' + esc(EST.cur.display) + '</span></div>' +
      '<div class="fb-actions"><button class="btn primary" data-est="next">下一题 <kbd>Enter</kbd></button></div></div>';
    $$('#estFeedback [data-est]').forEach(function (b) { b.onclick = estNext; });
    var myGen = EST.gen;
    setTimeout(function () { if (EST.gen === myGen && EST.locked) estNext(); }, 3000);
  }

  function estSummary() {
    $('#estFeedback').innerHTML = '<div class="fb">' +
      '<div class="fb-title">估数挑战 · 一局结束</div>' +
      '<div class="fb-line"><span>本局得分</span><span class="score-total">' + EST.score + '</span></div>' +
      '<div class="fb-line"><span>单题最高</span><span class="v">' + EST.best + ' 分</span></div>' +
      '<div class="fb-line"><span>平均每題</span><span class="v">' + (EST.score / EST.total).toFixed(1) + ' 分</span></div>' +
      '<div class="fb-actions"><button class="btn primary" data-est="rank">记入排行榜</button>' +
      '<button class="btn" data-est="again">再来一局</button></div></div>';
    $$('#estFeedback [data-est]').forEach(function (b) {
      b.onclick = function () {
        if (b.dataset.est === 'again') estStart();
        else App.submitRank(EST.score, '估数挑战', '平均 ' + (EST.score / EST.total).toFixed(1) + ' 分/题');
      };
    });
  }

  /* ================= 绑定 ================= */
  function bind() {
    $('#cmpLeft').onclick = function () { cmpAnswer('left'); };
    $('#cmpRight').onclick = function () { cmpAnswer('right'); };
    $('#estSubmit').onclick = estSubmit;
    $('#estInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); if (EST.locked) estNext(); else estSubmit(); }
    });
    document.addEventListener('keydown', function (e) {
      if (currentMode !== 'estimate' || !EST.locked) return;
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (e.key === 'Enter') { e.preventDefault(); estNext(); }
    });
  }

  window.MiniGames = {
    onModeChange: function (mode) {
      currentMode = mode;
      if (mode === 'compare') { if (CMP.round >= CMP.total || CMP.round === 0 || !CMP.cur) cmpStart(); }
      else cmpStop();
      if (mode === 'estimate') { if (EST.round >= EST.total || EST.round === 0 || !EST.cur) estStart(); }
    },
    cmpStart: cmpStart,
    estStart: estStart
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
