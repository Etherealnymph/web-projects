/* 端到端自检脚本：只在 build.js --e2e 产出的测试页里注入，不进入正式文件 */
(function () {
  var log = [];
  function ok(name, cond, extra) {
    log.push((cond ? 'PASS' : 'FAIL') + ' | ' + name + (extra ? ' | ' + extra : ''));
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function q(s) { return document.querySelector(s); }
  function fire(node, type) { node.dispatchEvent(new Event(type, { bubbles: true })); }
  function feedbackText() { return q('#feedback').textContent || ''; }
  function lineValue(label) {
    var lines = Array.prototype.slice.call(document.querySelectorAll('#feedback .fb-line'));
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].textContent || '';
      if (t.indexOf(label) === 0) return t.slice(label.length).trim();
    }
    return null;
  }

  window.onerror = function (msg, src, line) { log.push('FAIL | 运行期报错 | ' + msg + ' @' + line); };

  (async function () {
    try {
      // 主程序在 DOMContentLoaded 里初始化，必须等它就绪
      if (document.readyState === 'loading') {
        await new Promise(function (r) { document.addEventListener('DOMContentLoaded', r); });
      }
      await sleep(200);

      /* ---------- 1. 初始化 ---------- */
      var target = (q('#qTarget').textContent || '').trim();
      ok('题目已渲染', /^\d+\.\d+$/.test(target), target);
      ok('按钮盘已生成', document.querySelectorAll('.pad-btn').length >= 35, document.querySelectorAll('.pad-btn').length + ' 个');
      ok('常数速查表已生成', document.querySelectorAll('.const-row').length >= 15, document.querySelectorAll('.const-row').length + ' 行');
      ok('统计卡已生成', document.querySelectorAll('.stat').length === 6);
      ok('进度显示正确', q('#qProgress').textContent.indexOf('第 1 / 10 题') >= 0, q('#qProgress').textContent);
      ok('判定规则已说明', q('#qNote').textContent.indexOf('四舍五入') >= 0);

      /* ---------- 2. 错误答案路径 ---------- */
      q('#answerInput').value = '999';
      fire(q('#answerInput'), 'input');
      ok('合法性提示为合法', q('#validity').textContent.indexOf('表达式合法') >= 0, q('#validity').textContent);
      q('#submitBtn').click();
      ok('答错有反馈', feedbackText().indexOf('还差一点') >= 0);
      ok('答错显示差值', feedbackText().indexOf('差值') >= 0);
      ok('答错显示逐位对比', document.querySelectorAll('#feedback .dc').length > 3);

      /* ---------- 3. 小数被拒绝 ---------- */
      q('#answerInput').value = '1.5';
      fire(q('#answerInput'), 'input');
      ok('小数被拦截', q('#validity').textContent.indexOf('不许出现小数点') >= 0, q('#validity').textContent);
      q('#submitBtn').click();
      ok('小数提交被拒绝', feedbackText().indexOf('还差一点') >= 0, '反馈未被覆盖');

      /* ---------- 4. 提示 ---------- */
      document.querySelector('#sideTabs button[data-tab="hint"]').click();
      q('#hint1Btn').click();
      ok('结构提示可用', document.querySelectorAll('#hintList .hint-item').length === 1);
      q('#hint2Btn').click();
      ok('类型提示可用', document.querySelectorAll('#hintList .hint-item').length === 2);

      /* ---------- 5. 看答案 + 反推校验 ---------- */
      document.querySelector('#sideTabs button[data-tab="calc"]').click();
      q('#answerInput').value = '';
      q('#revealBtn').click();
      var answer = lineValue('原式');
      ok('揭示了原式', !!answer, answer);
      var digits = (target.split('.')[1] || '').length;
      var ev = window.NS.tryEvaluate(answer);
      ok('原式可被解析', ev.ok, ev.error || '');
      if (ev.ok) {
        ok('原式四舍五入后等于题面', ev.value.toFixed(digits) === target, ev.value.toFixed(digits) + ' vs ' + target);
      }
      ok('揭示后提示列表增加', document.querySelectorAll('#hintList .hint-item').length === 3);
      ok('揭示扣分说明', feedbackText().indexOf('不计分') >= 0);

      /* ---------- 6. 验算区 ---------- */
      q('#calcInput').value = answer;
      fire(q('#calcInput'), 'input');
      ok('验算区算出数值', document.querySelectorAll('#calcOut .calc-value').length === 1, (q('#calcOut').textContent || '').slice(0, 60));
      ok('验算区给出判定', q('#calcOut').textContent.indexOf('判定') >= 0);
      ok('验算区逐位对比', document.querySelectorAll('#calcDigits .dc').length > 3);
      q('#calcInput').value = '1+';
      fire(q('#calcInput'), 'input');
      ok('验算区报错提示', q('#calcOut').textContent.indexOf('解析失败') >= 0 || q('#calcOut').textContent.indexOf('✗') >= 0);

      /* ---------- 7. 下一题 ---------- */
      var nextBtn = document.querySelector('#feedback [data-act="next"]');
      ok('存在下一题按钮', !!nextBtn);
      if (nextBtn) nextBtn.click();
      await sleep(60);
      ok('进入下一题', q('#qProgress').textContent.indexOf('第 2 / 10 题') >= 0, q('#qProgress').textContent);
      ok('新题目已渲染', /^\d+\.\d+$/.test((q('#qTarget').textContent || '').trim()));
      ok('反馈已清空', feedbackText().trim() === '');

      /* ---------- 8. 记录与排行 ---------- */
      document.querySelector('#sideTabs button[data-tab="log"]').click();
      ok('记录里有条目', document.querySelectorAll('#logList .log-item').length >= 2, document.querySelectorAll('#logList .log-item').length + ' 条');
      window.NSApp.submitRank(777, '自检', '来自 e2e');
      ok('排行榜写入成功', document.querySelectorAll('#rankList .rank-item').length >= 1);
      ok('本地存档已写入', !!localStorage.getItem('ns.profile.v1'));

      /* ---------- 9. 比大小 ---------- */
      document.querySelector('#modeNav button[data-mode="compare"]').click();
      await sleep(80);
      var le = q('#cmpLeft .duel-expr').textContent, re = q('#cmpRight .duel-expr').textContent;
      ok('比大小出题', le !== '—' && re !== '—', le + '  vs  ' + re);
      var lv = window.NS.tryEvaluate(le), rv = window.NS.tryEvaluate(re);
      ok('比大小两边都能算', lv.ok && rv.ok);
      q('#cmpLeft').click();
      await sleep(30);
      ok('比大小有反馈', (q('#cmpFeedback').textContent || '').indexOf('倍数关系') >= 0);
      ok('比大小计分', q('#cmpScore').textContent.indexOf('本局') >= 0, q('#cmpScore').textContent);
      var cl = q('#cmpLeft').className, cr = q('#cmpRight').className;
      ok('比大小标注正确答案', cl.indexOf('correct') >= 0 || cr.indexOf('correct') >= 0);

      /* ---------- 10. 估数 ---------- */
      document.querySelector('#modeNav button[data-mode="estimate"]').click();
      await sleep(80);
      var expr = q('#estExpr').textContent;
      ok('估数出题', expr !== '—' && expr.length > 1, expr);
      q('#estInput').value = 'abc';
      q('#estSubmit').click();
      ok('非数字估计被拒绝', (q('#estFeedback').textContent || '').trim() === '');
      q('#estInput').value = '3.1416';
      q('#estSubmit').click();
      await sleep(30);
      ok('估数给出评分', (q('#estFeedback').textContent || '').indexOf('相对误差') >= 0, (q('#estFeedback').textContent || '').slice(0, 50));

      /* ---------- 11. 切回经典 ---------- */
      document.querySelector('#modeNav button[data-mode="classic"]').click();
      await sleep(50);
      ok('切回经典模式保留题目', q('#panel-classic').classList.contains('active'));

      /* ---------- 12. 主题与音效开关 ---------- */
      var theme0 = document.body.dataset.theme;
      q('#themeBtn').click();
      ok('主题可切换', document.body.dataset.theme !== theme0, theme0 + ' -> ' + document.body.dataset.theme);
      q('#themeBtn').click();
    } catch (e) {
      log.push('FAIL | 自检异常 | ' + e.message + ' | ' + (e.stack || '').split('\n')[1]);
    }

    var fails = log.filter(function (x) { return x.indexOf('FAIL') === 0; }).length;
    var text = '\n===E2E START===\n' + log.join('\n') +
      '\n===E2E END===\n共 ' + log.length + ' 项，失败 ' + fails + ' 项';
    document.title = fails ? ('E2E-FAIL-' + fails) : 'E2E-OK';
    if (location.search.indexOf('shot') >= 0) {
      // 截图模式：把结果直接铺满页面，便于用截图取证
      document.body.innerHTML = '';
      var pre = document.createElement('pre');
      pre.id = 'e2e-result';
      pre.style.cssText = 'margin:0;padding:14px;font:13px/1.6 Consolas,monospace;white-space:pre-wrap;background:#fff;color:#111';
      pre.textContent = text;
      document.body.appendChild(pre);
      document.body.style.background = '#fff';
    } else {
      var div = document.createElement('pre');
      div.id = 'e2e-result';
      div.textContent = text;
      document.body.appendChild(div);
    }
  })();
})();
