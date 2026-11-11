import io
p="_work/build_web.py"; t=io.open(p,encoding="utf-8").read()

t=t.replace("""/* ---------- 启动 ---------- */""",
"""/* ---------- 全文公式自检 ---------- */
function checkAll(){
  let i = 0, bad = 0, first = '';
  const step = ()=>{
    const t0 = performance.now();
    while(i < N && performance.now() - t0 < 100){
      const s = slides[i];
      if(!typeset.has(i)){ renderMathIn(s); typeset.add(i); }
      s.querySelectorAll('.katex-error').forEach(()=>{ bad++; });
      i++;
    }
    if(i < N) requestAnimationFrame(step);
    else {
      let n = 0; slides.forEach(s=>{ n += s.querySelectorAll('.katex-error').length; });
      $('#secname').textContent = '公式自检：' + N + ' 题，未识别 ' + n + ' 处'
        + (n ? '（见控制台 __errs / 按 ? 查看）' : ' ✓');
      toast(n ? ('有 ' + n + ' 处公式未识别') : '全部公式渲染正常 ✓');
      window.__errs = errs;
    }
  };
  step();
}

/* ---------- 启动 ---------- */""")
t=t.replace("""setTimeout(()=>{ fit(cur); }, 60);""",
"""setTimeout(()=>{ fit(cur); }, 60);
if(/[?&]check=1/.test(location.search)) setTimeout(checkAll, 400);""")
t=t.replace("""    case 'p': case 'P': e.preventDefault(); printAll(); break;""",
"""    case 'p': case 'P': e.preventDefault(); printAll(); break;
    case '!': checkAll(); break;""")
io.open(p,"w",encoding="utf-8").write(t)
print("ok")
