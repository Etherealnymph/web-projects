import io,re
p="01_题目全集.md"; t=io.open(p,encoding="utf-8").read()
i=t.index('<a id="sec23"></a>')
head, seg = t[:i], t[i:]
out=[]
for l in seg.split("\n"):
    if l.startswith("> ") and not l.startswith("> 来源：") and not l.startswith("> **评注**"):
        out.append("> **评注**　" + l[2:])
    else:
        out.append(l)
seg="\n".join(out)
t=head+seg
io.open(p,"w",encoding="utf-8",newline="\n").write(t)
print("converted:", len([l for l in out if l.startswith("> **评注**　")]))

# 解析器：去掉备注里重复的「备注：」前缀
q="_work/build_web.py"; s=io.open(q,encoding="utf-8").read()
s=s.replace("""            buf['note'].append(s.strip('*').strip())""",
"""            note = s.strip('*').strip()
            note = re.sub(r'^备注[:：]\\s*', '', note)
            buf['note'].append(note)""")
io.open(q,"w",encoding="utf-8").write(s)
print("parser patched")
