import io
p="_work/build_web.py"; t=io.open(p,encoding="utf-8").read()
t=t.replace('<script>window.__DATA__ = __DATA__;</script>', '<script>window.__DATA__ = __PAYLOAD__;</script>')
t=t.replace(".replace('__DATA__', json.dumps(data, ensure_ascii=False, separators=(',', ':')))",
            ".replace('__PAYLOAD__', json.dumps(data, ensure_ascii=False, separators=(',', ':')))")
io.open(p,"w",encoding="utf-8").write(t)
print('ok')
