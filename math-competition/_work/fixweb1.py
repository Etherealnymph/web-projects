import io
p="_work/build_web.py"; t=io.open(p,encoding="utf-8").read()
t=t.replace("let cur = 0, typeset = new Set(), errs = [];",
            "let cur = 0, typeset = new Set(), errs = [], slides = [];")
t=t.replace("""function build(){
  DATA.forEach(it=>{ stage.appendChild(slideEl(it)); });
}""",
"""function build(){
  DATA.forEach(it=>{ const el = slideEl(it); stage.appendChild(el); slides.push(el); });
}""")
t=t.replace("const s = stage.children[i]; if(!s) return;", "const s = slides[i]; if(!s) return;")
t=t.replace("[...stage.children].forEach((s,k)=>s.classList.toggle('on', k===i));",
            "slides.forEach((s,k)=>s.classList.toggle('on', k===i));")
t=t.replace("const s = stage.children[i];\n  if(!typeset.has(i)){", "const s = slides[i];\n  if(!typeset.has(i)){")
t=t.replace("[i+1, i-1].forEach(k=>{ const n=stage.children[k];", "[i+1, i-1].forEach(k=>{ const n=slides[k];")
t=t.replace("const c = stage.children[cur]?.querySelector('.content');", "const c = slides[cur]?.querySelector('.content');")
t=t.replace("const s = stage.children[i];\n      if(!typeset.has(i)){", "const s = slides[i];\n      if(!typeset.has(i)){")
io.open(p,"w",encoding="utf-8").write(t)
print(t.count("stage.children"))
