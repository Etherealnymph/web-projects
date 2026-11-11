import json
W='/sdcard/Download/DSH-GO/Image'
ps=json.load(open('pages_merged.json'))
meta=json.load(open('blocks_meta.json'))
out=[];A=out.append
A('# 照片时间排序清单（295 张）\n')
A('> 按拍摄时间升序编号 **001–295**，编号即下文文档中的「照片」编号。')
A('> 时间取自文件名 `IMG2026MMDDHHMMSS`，与手机相册的拍摄时间一致。\n')
A('| 编号 | 拍摄时间 | 文件名 | 含题 | 内容摘要 |')
A('|--:|:--|:--|:--:|:--|')
for p in ps:
    t=p['time'].replace('-','/')
    n=len(p['problems'])
    A(f"| {p['id']:03d} | {t} | [{p['file']}]({p['file']}) | {'✔' if n else '—'} | {p['summary'].replace('|','/')} |")
open(f'{W}/00_照片时间排序清单.md','w').write('\n'.join(out))
print('ok',len(ps))
