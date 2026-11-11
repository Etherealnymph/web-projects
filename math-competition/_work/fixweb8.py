import io
p="_work/build_web.py"; t=io.open(p,encoding="utf-8").read()
t=t.replace("""  c.style.fontSize = '20px';
  if(c.scrollHeight <= avail){ 
    let lo = 20, hi = 30, best = 20;""",
"""  c.style.fontSize = '20px';
  const hiMax = Math.min(52, Math.max(26, avail * 0.07));
  if(c.scrollHeight <= avail){ 
    let lo = 20, hi = hiMax, best = 20;""")
t=t.replace("""<span id="ovh">↕ 内容较长，可滚动</span>""", """<span id="ovh">↕ 可滚动</span>""")
io.open(p,"w",encoding="utf-8").write(t)
print("ok")
