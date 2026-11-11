import json,glob,os,re,unicodedata
man=json.load(open('/root/workspace/cmp/manifest.json'))
pages={}
for f in sorted(glob.glob('ocr/*.json')):
    d=json.load(open(f))
    for p in d['pages']:
        pages[p['id']]=p
print('pages',len(pages))
# session key: date + time block (gap 45min)
from datetime import datetime
ts=[datetime.strptime(m[0],'%Y-%m-%d %H:%M:%S') for m in man]
blocks=[];start=0
for i in range(1,len(ts)):
    if (ts[i]-ts[i-1]).total_seconds()>45*60:
        blocks.append((start,i-1));start=i
blocks.append((start,len(ts)-1))
out=[]
for b,(a,z) in enumerate(blocks,1):
    for i in range(a,z+1):
        pid=i+1
        p=pages.get(pid,{'id':pid,'has_problem':False,'problems':[],'has_solution':False,'solution':'','summary':'（未识别）','clarity':'unreadable'})
        p['block']=b; p['time']=man[i][0]; p['file']=man[i][1]
        out.append(p)
json.dump(out,open('pages_merged.json','w'),ensure_ascii=False)
json.dump([[b,man[a][0][:10],man[a][0][11:16],man[z][0][11:16],z-a+1] for b,(a,z) in enumerate(blocks,1)],open('blocks.json','w'),ensure_ascii=False)
print('blocks',len(blocks))
for b,(a,z) in enumerate(blocks,1):
    nprob=sum(len(pages.get(i+1,{}).get('problems',[])) for i in range(a,z+1))
    print(b,man[a][0][:10],man[a][0][11:16],'-',man[z][0][11:16],z-a+1,'pages',nprob,'probs')
