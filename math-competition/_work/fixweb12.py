import io,re
p="_work/build_web.py"; t=io.open(p,encoding="utf-8").read()

# fit 重构：先求 best，再应用 zoom
old_start = t.index("function fit(i){")
old_end = t.index("/* ---------- 显示 ---------- */")
new_fit = '''function fit(i){
  const s = slides[i]; if(!s) return;
  const c = s.querySelector('.content');
  const avail = (c.clientHeight || s.clientHeight);
  const hiMax = Math.min(52, Math.max(28, avail * 0.072));
  const lo = 14.5;
  c.style.fontSize = hiMax + 'px';
  let best;
  if(c.scrollHeight <= avail){
    let a = lo, b = hiMax; best = lo;
    for(let k=0;k<12;k++){ const m=(a+b)/2; c.style.fontSize=m+'px';
      if(c.scrollHeight<=avail){best=m;a=m;} else b=m; }
  } else {
    let a = lo, b = hiMax; best = lo;
    for(let k=0;k<14;k++){ const m=(a+b)/2; c.style.fontSize=m+'px';
      if(c.scrollHeight<=avail){best=m;a=m;} else b=m; }
  }
  const fs = Math.min(hiMax * 1.6, Math.max(10, best * zoom));
  c.style.fontSize = fs.toFixed(2) + 'px';
  s.classList.toggle('over', c.scrollHeight > avail + 2);
  if(!s.classList.contains('over')) c.scrollTop = 0;
}

function setZoom(z){
  zoom = Math.min(3, Math.max(0.7, z));
  fit(cur);
  document.body.classList.toggle('hasov', slides[cur].classList.contains('over'));
  toast('字号 ' + Math.round(zoom*100) + '%');
}

'''
t = t[:old_start] + new_fit + t[old_end:]

t = t.replace("let cur = 0, typeset = new Set(), errs = [], slides = [];",
              "let cur = 0, typeset = new Set(), errs = [], slides = [], zoom = 1;")
t = t.replace("""    case '!': checkAll(); break;""",
"""    case '!': checkAll(); break;
    case '+': case '=': setZoom(zoom * 1.12); break;
    case '-': case '_': setZoom(zoom / 1.12); break;
    case '0': setZoom(1); break;""")
# 帮助里加一行
t = t.replace("""      <div><kbd>?</kbd> 本帮助　<kbd>Esc</kbd> 关闭浮层</div>""",
"""      <div><kbd>+</kbd><kbd>-</kbd> 放大 / 缩小当前题的字号　<kbd>0</kbd> 复位</div>
      <div><kbd>!</kbd> 全文公式自检（208 题一次性排版并统计未识别公式）</div>
      <div><kbd>?</kbd> 本帮助　<kbd>Esc</kbd> 关闭浮层</div>""")
io.open(p,"w",encoding="utf-8").write(t)
print("ok")
