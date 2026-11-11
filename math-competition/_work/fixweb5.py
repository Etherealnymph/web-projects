import io
p="_work/build_web.py"; t=io.open(p,encoding="utf-8").read()

# 1) 干净的预览文字
t=t.replace("""            'plain': re.sub(r'<[^>]+>', '', f['statement'])[:80],""",
"""            'plain': plain_preview(f['statement']),""")
t=t.replace("""# ---------------------------------------------------------------- 组织数据""",
"""def plain_preview(raw):
    s = raw
    s = re.sub(r'\\$\\$.*?\\$\\$', ' ', s, flags=re.S)
    s = re.sub(r'\\$[^$]*\\$', ' ', s)
    s = re.sub(r'\\[([^\\]]*)\\]\\([^)]*\\)', r'\\1', s)
    s = re.sub(r'\\*\\*|\\*|`', '', s)
    s = re.sub(r'\\\\[a-zA-Z]+', '', s)
    s = re.sub(r'[{}\\\\]', '', s)
    s = re.sub(r'\\s+', ' ', s).strip()
    return s[:64]


# ---------------------------------------------------------------- 组织数据""")

# 2) filter 的事件绑定 + 聚焦延后 + 快捷键 preventDefault
t=t.replace("""    $('#filter').value=''; filterGrid('');
    $('#filter').focus();""",
"""    $('#filter').value=''; filterGrid('');
    setTimeout(()=>$('#filter').focus(), 30);""")
t=t.replace("""function filterGrid(q){""",
"""$('#filter').addEventListener('input', e=>filterGrid(e.target.value));

function filterGrid(q){""")
t=t.replace("""  if(e.ctrlKey||e.metaKey||e.altKey) return;
  if(document.activeElement === $('#filter')){""",
"""  if(e.ctrlKey||e.metaKey||e.altKey) return;
  if(document.activeElement === $('#filter')){""")
t=t.replace("""    case 'f': case 'F': fullscreen(); break;""",
"""    case 'f': case 'F': e.preventDefault(); fullscreen(); break;""")
for k in ["'o': case 'O'","'t': case 'T'","'d': case 'D'","'?': case 'h': case 'H'","'g': case 'G'","'p': case 'P'"]:
    pass
t=t.replace("case 'o': case 'O': toggle('#grid'); break;", "case 'o': case 'O': e.preventDefault(); toggle('#grid'); break;")
t=t.replace("case 't': case 'T': toggle('#drawer'); break;", "case 't': case 'T': e.preventDefault(); toggle('#drawer'); break;")
t=t.replace("    case 'd': case 'D': {", "    case 'd': case 'D': { e.preventDefault();")
t=t.replace("    case '?': case 'h': case 'H': toggle('#help'); break;", "    case '?': case 'h': case 'H': e.preventDefault(); toggle('#help'); break;")
t=t.replace("    case 'g': case 'G': {", "    case 'g': case 'G': { e.preventDefault();")
t=t.replace("    case 'p': case 'P': printAll(); break;", "    case 'p': case 'P': e.preventDefault(); printAll(); break;")
io.open(p,"w",encoding="utf-8").write(t)
print("ok")
