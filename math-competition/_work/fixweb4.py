import io
p="_work/build_web.py"; t=io.open(p,encoding="utf-8").read()
old = """            merged = ' '.join(l.strip() for l in lines)"""
new = """            if lines and lines[0].strip().startswith('>'):
                q = ' '.join(re.sub(r'^\\s*>+\\s?', '', l) for l in lines).strip()
                out.append('<p class="quote">%s</p>' % inline_math(q, math, mdisp))
                continue
            merged = ' '.join(l.strip() for l in lines)"""
assert old in t
t = t.replace(old, new, 1)
t = t.replace(""".mathblock{margin:.55em 0;overflow-x:auto;overflow-y:hidden}""",
""".quote{margin:.75em 0;padding:.45em 0 .45em 14px;border-left:3px solid var(--line);
       color:var(--muted);font-size:.94em;line-height:1.6}
.mathblock{margin:.55em 0;overflow-x:auto;overflow-y:hidden}""")
io.open(p,"w",encoding="utf-8").write(t)
print("ok")
