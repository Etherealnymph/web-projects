import io,re
t=io.open("01_题目全集.md",encoding="utf-8").read()
print("题数:", len(re.findall(r'(?m)^### P\d{3}',t)))
print("分区:", len(re.findall(r'(?m)^## \d+\.',t)))
print("断链:", len(set(re.findall(r'\]\(#(p\d{3}|sec\d+)\)',t)) - set(re.findall(r'<a id="(p\d{3}|sec\d+)"></a>',t))))
print("文件大小:", len(t.encode('utf-8')), "bytes")
for l in t.split("\n"):
    if l.startswith("## 1") or l.startswith("## 2"):
        pass
print("---- 目录表末 6 行 ----")
rows=[l for l in t.split("\n") if re.match(r'^\| \d+ \| \[', l)]
for r in rows[-6:]: print(r)
