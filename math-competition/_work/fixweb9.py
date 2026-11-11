import io
p="_work/build_web.py"; t=io.open(p,encoding="utf-8").read()

# 1) 解析时保留空行（段落分隔）
old = """        if not s:
            continue
        if mode == 'board' and cur_board is not None:"""
new = """        if not s:
            if mode in ('statement', 'answer', 'solution', 'comment', 'note') and buf[mode] and buf[mode][-1] != '':
                buf[mode].append('')
            elif mode == 'board' and cur_board is not None and cur_board['lines'] and cur_board['lines'][-1] != '':
                cur_board['lines'].append('')
            continue
        if mode == 'board' and cur_board is not None:"""
assert old in t
t = t.replace(old, new, 1)

# 2) 字面 \n 只在非字母前替换（避免误伤 \nabla 等）
t = t.replace("""        val = val.replace('\\\\n', '\\n')""",
              """        val = re.sub(r'\\\\n(?![A-Za-z])', '\\n', val)""")
io.open(p,"w",encoding="utf-8").write(t)
print("ok")
