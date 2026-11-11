import io
p="_work/build_web.py"; t=io.open(p,encoding="utf-8").read()
t=t.replace(""".slide.over>.content{scrollbar-color:var(--line) transparent}""",
""".slide.over>.content{scrollbar-color:var(--line) transparent;
  -webkit-mask-image:linear-gradient(to bottom,#000 calc(100% - 30px),transparent);
          mask-image:linear-gradient(to bottom,#000 calc(100% - 30px),transparent)}""")
io.open(p,"w",encoding="utf-8").write(t)
print("ok")
