import io
p="_work/build_web.py"; t=io.open(p,encoding="utf-8").read()

# 1) lead 小标题里的公式也要渲染
t=t.replace("""                head = inline(esc(mm.group(1).strip()))""",
"""                head = inline_math(mm.group(1).strip(), math, mdisp)""")

# 2) 用滚动容器自身高度做基准
t=t.replace("""  const avail = s.clientHeight;""",
"""  const avail = (c.clientHeight || s.clientHeight);""")

# 3) ↑↓/PgUp/PgDn：内容溢出时先滚动，滚到底再翻页
t=t.replace("""    case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ':
      e.preventDefault(); show(cur+1); break;
    case 'ArrowLeft': case 'ArrowUp': case 'PageUp':
      e.preventDefault(); show(cur-1); break;""",
"""    case 'ArrowRight': case ' ':
      e.preventDefault(); show(cur+1); break;
    case 'ArrowLeft':
      e.preventDefault(); show(cur-1); break;
    case 'ArrowDown': case 'PageDown':
      e.preventDefault(); scrollOrPage(1); break;
    case 'ArrowUp': case 'PageUp':
      e.preventDefault(); scrollOrPage(-1); break;""")
t=t.replace("""/* ---------- 提示 ---------- */""",
"""/* ---------- 滚动或翻页 ---------- */
function scrollOrPage(dir){
  const s = slides[cur], c = s && s.querySelector('.content');
  if(c && s.classList.contains('over')){
    const atEnd = c.scrollTop + c.clientHeight >= c.scrollHeight - 3;
    const atTop = c.scrollTop <= 3;
    if(dir > 0 && !atEnd){ c.scrollBy({top: c.clientHeight*0.82, behavior:'smooth'}); return; }
    if(dir < 0 && !atTop){ c.scrollBy({top: -c.clientHeight*0.82, behavior:'smooth'}); return; }
  }
  show(cur + dir);
}

/* ---------- 提示 ---------- */""")
io.open(p,"w",encoding="utf-8").write(t)
print("ok")
