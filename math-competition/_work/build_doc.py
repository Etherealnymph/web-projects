import json,glob,os,re
from datetime import datetime
W='/sdcard/Download/DSH-GO/Image'
ps=json.load(open('problems.json'))
pages={p['id']:p for p in json.load(open('pages_merged.json'))}
meta=json.load(open('blocks_meta.json'))
man=json.load(open('/root/workspace/cmp/manifest.json'))
# commentary
com={}
for f in glob.glob('comment/*.json'):
    try:
        d=json.load(open(f))
        for it in d['items']:
            com[it['pid']]=it
    except Exception as e: print('bad',f,e)

blocks={}
for g in ps: blocks.setdefault(g['block'],[]).append(g)
allpages={}
for p in json.load(open('pages_merged.json')):
    allpages.setdefault(p['block'],[]).append(p['id'])

def rng(a,b):
    return f"{a:03d}" if a==b else f"{a:03d}–{b:03d}"

def title_of(label):
    lab=label.strip()
    if re.match(r'^\d',lab): return '题 '+lab
    return lab

def esc(s): return s.replace('|','\\|').replace('\n',' ')

out=[]
A=out.append
A('# 大学生数学竞赛 · 课堂题目全集（按拍摄时间排序）\n')
A('> 素材：`Image/` 文件夹内 **295 张**课堂投影照片，拍摄时间 **2026-03-29 → 2026-10-31**，覆盖 22 个场次。')
A('> 去重后共 **%d 道题**，按拍摄时间（= 讲课顺序）排列；每题附「板书要点」与「评注」。\n' % len(ps))
A('> 阅读提示：下方目录中的分区名、题目编号都可点击跳转；每节末尾有「下一部分」快速切换。')
A('> 说明：「板书要点」是课堂上投影解答的整理版；整理时核对过与题目的对应关系，对不上或残缺的改以「原图板书（未核对）」折叠显示，仅供参考。评注为逐题补充。\n')
A('<a id="toc"></a>')
A('## 📑 分区快捷目录\n')
A('| # | 分区 | 拍摄时间 | 照片编号 | 题数 |')
A('|--:|:--|:--|:--|--:|')
for b in sorted(blocks):
    gs=blocks[b]
    ids=allpages[b]
    A(f"| {b} | [{meta[str(b)]['title']}](#sec{b}) | {gs[0]['time'][5:16]} | {rng(min(ids),max(ids))} | {len(gs)} |")
A('')
A('---\n')
A('## 🔎 按专题速查\n')
tagmap={}
for b in sorted(blocks):
    t=meta[str(b)]['tag']
    for g in blocks[b]:
        tagmap.setdefault(t,[]).append(g['pid'])
for t,pids in tagmap.items():
    A(f"**{t}**（{len(pids)} 题）：" + '、'.join(f"[P{p:03d}](#p{p:03d})" for p in pids) + '\n')
A('---\n')

for bi,b in enumerate(sorted(blocks),1):
    gs=blocks[b]; m=meta[str(b)]
    ids=allpages[b]
    A(f'<a id="sec{b}"></a>')
    A(f"## {bi}. {m['title']}\n")
    A(f"> 拍摄时间：**{gs[0]['time'][:16]}** ｜ 照片 {rng(min(ids),max(ids))}（{len(ids)} 张，{len(gs)} 题） ｜ 专题：{m['tag']}\n")
    A('**本节题目：** ' + ' ｜ '.join(f"[P{g['pid']:03d}](#p{g['pid']:03d})（{g['label']}）" for g in gs) + '\n')
    for g in gs:
        pid=g['pid']
        A(f'<a id="p{pid:03d}"></a>')
        A(f"### P{pid:03d}　{title_of(g['label'])}\n")
        st=g['statement'].strip()
        A('**题目**\n')
        A(st+'\n')
        if g['answer'].strip():
            A(f"**答案**　{g['answer'].strip()}\n")
        c=com.get(pid,{})
        sol=(c.get('solution_clean') or '').strip()
        if sol:
            A('**板书要点**\n')
            A(sol+'\n')
        elif g['solution'].strip():
            A('<details><summary>原图板书（未核对，供对照）</summary>\n')
            A(g['solution'].strip()+'\n')
            A('</details>\n')
        if c.get('commentary'):
            A(f"> **评注**　{c['commentary'].strip()}\n")
        if g['note'].strip():
            A(f"*备注：{g['note'].strip()}*\n")
        plist='、'.join(f"{p['id']:03d}" for p in sorted(g['pages'],key=lambda x:x['id']))
        files=[p['file'] for p in sorted(g['pages'],key=lambda x:x['id'])]
        links=' '.join(f"[{p['id']:03d}]({p['file']})" for p in sorted(g['pages'],key=lambda x:x['id']))
        A(f"<sub>照片：{links} ｜ 拍摄：{g['time']} ｜ [↑ 回目录](#toc)</sub>\n")
        A('---\n')
    nxt=f"[下一部分 {bi+1} →](#sec{b+1})" if bi<len(blocks) else '[完]'
    prv=f"[← 上一部分](#sec{b-1})" if bi>1 else ''
    sep=' ｜ ' if prv else ''
    A(f"<div align=\"center\">{prv}{sep}[↑ 回到目录](#toc) ｜ {nxt}</div>\n")

open(f'{W}/01_题目全集（按时间排序）.md','w').write('\n'.join(out))
print('doc written', len(ps),'problems; commentary',len(com))
