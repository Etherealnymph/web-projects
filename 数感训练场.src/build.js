/* 组装：把源码分片内联成一个可双击打开的独立 HTML。
   用法：node build.js  [--e2e]   加 --e2e 时额外产出带自检脚本的测试页 */
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');

const shell = read('shell.html');
const parts = {
  '/*@STYLES*/': read('styles.css'),
  '/*@CORE*/': read('core.js'),
  '/*@UI*/': read('ui.js'),
  '/*@MINI*/': read('minigames.js')
};

let out = shell;
for (const key of Object.keys(parts)) {
  if (out.indexOf(key) < 0) throw new Error('模板里找不到占位符 ' + key);
  out = out.replace(key, () => parts[key]);
}
if (/\/\*@(STYLES|CORE|UI|MINI)\*\//.test(out)) throw new Error('还有占位符没被替换');

// 粗查：内联后的脚本不能出现 </script>，否则 HTML 会被提前截断
['core.js', 'ui.js', 'minigames.js'].forEach((f) => {
  if (read(f).indexOf('</script') >= 0) throw new Error(f + ' 里含有 </script>，无法内联');
});

const target = path.join(dir, '..', '数感训练场.html');
fs.writeFileSync(target, out, 'utf8');
console.log('已生成 ' + target + '  （' + (out.length / 1024).toFixed(1) + ' KB）');

if (process.argv.indexOf('--e2e') >= 0) {
  const driver = read('e2e-driver.js');
  const e2e = out.replace('</body>', () => '<script>\n' + driver + '\n</script>\n</body>');
  const e2ePath = path.join(dir, '_e2e.html');
  fs.writeFileSync(e2ePath, e2e, 'utf8');
  console.log('已生成 ' + e2ePath);
}

if (process.argv.indexOf('--shot') >= 0) {
  // 截图辅助页：?m=compare / ?m=estimate / ?t=light 用于切换视图
  const clicker = [
    'setTimeout(function () {',
    '  var p = new URLSearchParams(location.search);',
    // headless 的虚拟时间会让 CSS 过渡停在起点，截图前先关掉过渡
    '  var st = document.createElement("style");',
    '  st.textContent = "*{transition:none !important;animation:none !important}";',
    '  document.head.appendChild(st);',
    '  var t = p.get("t"); if (t) { document.body.dataset.theme = t; }',
    '  var m = p.get("m");',
    '  if (m) { var b = document.querySelector(\'#modeNav button[data-mode="\' + m + \'"]\'); if (b) b.click(); }',
    '  if (p.get("dbg")) {',
    '    var lines = [];',
    '    var probe = [".pad-btn", ".btn", ".chip", ".mode-btn", ".const-row .val", ".caption", "#qTarget", ".log-item"];',
    '    lines.push("body[data-theme]=" + document.body.dataset.theme +',
    '      "  --text(cssvar)=" + getComputedStyle(document.body).getPropertyValue("--text"));',
    '    probe.forEach(function (s) {',
    '      var n = document.querySelector(s); if (!n) { lines.push(s + " : 未找到"); return; }',
    '      var cs = getComputedStyle(n);',
    '      lines.push(s + " : color=" + cs.color + " bg=" + cs.backgroundColor + " opacity=" + cs.opacity + " disabled=" + n.disabled);',
    '    });',
    '    var pre = document.createElement("pre");',
    '    pre.style.cssText = "position:fixed;left:0;top:0;z-index:999;background:#fff;color:#000;font:13px/1.5 Consolas,monospace;padding:10px;margin:0;border:2px solid red";',
    '    pre.textContent = lines.join("\\n");',
    '    document.body.appendChild(pre);',
    '  }',
    '}, 120);'
  ].join('\n');
  const shot = out.replace('</body>', () => '<script>\n' + clicker + '\n</script>\n</body>');
  const shotPath = path.join(dir, '_shot.html');
  fs.writeFileSync(shotPath, shot, 'utf8');
  console.log('已生成 ' + shotPath);
}
