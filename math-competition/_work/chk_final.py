import io,re
t=io.open("01_题目全集.md",encoding="utf-8").read()
# 1) 每个目录行/速查链接指向的锚点都存在
ids=set(re.findall(r'<a id="(p\d{3})"></a>',t)) | set(re.findall(r'<a id="(sec\d+)"></a>',t))
links=set(re.findall(r'\]\(#(p\d{3}|sec\d+)\)',t))
print("broken links:", sorted(links-ids)[:10], "count=", len(links-ids))
# 2) 题数 / 分区数
print("problems:", len(re.findall(r'(?m)^### P\d{3}',t)), "sections:", len(re.findall(r'(?m)^## \d+\.',t)))
# 3) 每个 pid 唯一
pids=re.findall(r'(?m)^### P(\d{3})',t)
print("unique pids:", len(set(pids))==len(pids), len(pids))
# 4) 每题的锚点紧邻标题
print("anchor/heading mismatch:", len(re.findall(r'(?m)^<a id="p\d{3}"></a>\n### P',t)))
# 5) 空解答
parts=re.split(r'(?m)^### P(\d{3})　',t)
bad=[parts[k] for k in range(1,len(parts),2) if "**完整解答**" not in parts[k+1]]
print("problems without 完整解答:", bad)
