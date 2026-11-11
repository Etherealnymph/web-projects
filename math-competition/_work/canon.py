import json,re
ps=json.load(open('pages_merged.json'))
def norm(s):
    return re.sub(r'[\s\$\\\{\}\[\]（）()，,。；;：:、\'"“”]','',s)
groups={}
order=[]
for p in ps:
    for q in p['problems']:
        k=norm(q['statement'])[:160]
        if k not in groups:
            groups[k]={'keys':k,'statement':q['statement'],'label':q['label'],'answer':q['answer'],'note':q['note'],
                       'pages':[],'solution':'','has_solution':False,'block':p['block'],'time':p['time'],
                       'best':(p['clarity']=='good', len(q['statement']))}
            order.append(k)
        g=groups[k]
        g['pages'].append({'id':p['id'],'file':p['file'],'time':p['time'],'block':p['block'],
                           'solution':p['solution'],'has_solution':p['has_solution'],'clarity':p['clarity'],'summary':p['summary']})
        # prefer longer statement
        if len(q['statement'])>len(g['statement']):
            g['statement']=q['statement']; g['label']=q['label']
        if q['answer'] and not g['answer']: g['answer']=q['answer']
        if q['note'] and not g['note']: g['note']=q['note']
        if p['has_solution'] and len(p['solution'])>len(g['solution']):
            g['solution']=p['solution']
out=[]
for i,k in enumerate(order,1):
    g=groups[k]; g['pid']=i
    out.append(g)
json.dump(out,open('problems.json','w'),ensure_ascii=False,indent=1)
print('unique problems',len(out))
print('with solution',sum(1 for g in out if g['solution']))
from collections import Counter
print(Counter(len(g['pages']) for g in out))
