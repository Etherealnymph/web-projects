import io
p="_work/build_web.py"; t=io.open(p,encoding="utf-8").read()
t=t.replace("p.lead>b{display:block;color:var(--accent);font-size:.92em;letter-spacing:.02em;margin-bottom:.12em}",
            "p.lead>b:first-child{display:block;color:var(--accent);font-size:.92em;letter-spacing:.02em;margin-bottom:.12em}")
t=t.replace("p.lead:first-child{margin-top:0}",
            "p.lead:first-child{margin-top:0}\np.lead>b:not(:first-child){color:var(--accent2);font-weight:600}")
io.open(p,"w",encoding="utf-8").write(t)
print("ok")
