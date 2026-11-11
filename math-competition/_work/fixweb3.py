import io
p="_work/build_web.py"; t=io.open(p,encoding="utf-8").read()

# (a) 段首的加粗小标题独立成行
old = """            body = inline_math(' '.join(l.strip() for l in lines), math, mdisp)
            out.append('<p>%s</p>' % body)"""
new = """            merged = ' '.join(l.strip() for l in lines)
            mm = re.match(r'^\\*\\*(.{1,18}?)\\*\\*[\\s\\u3000]*(.*)$', merged, re.S)
            if mm and mm.group(1).strip():
                head = inline(esc(mm.group(1).strip()))
                rest = inline_math(mm.group(2), math, mdisp) if mm.group(2).strip() else ''
                out.append('<p class="lead"><b>%s</b>%s</p>' % (head, (' ' + rest) if rest else ''))
            else:
                body = inline_math(merged, math, mdisp)
                out.append('<p>%s</p>' % body)"""
assert old in t
t = t.replace(old, new)

# (b) 字号下限 13px + 溢出标记
t = t.replace("""  let lo = 9.5, hi = 20, best = 9.5;""", """  let lo = 13, hi = 20, best = 13;""")
t = t.replace("""  c.style.fontSize = best+'px';
  c.scrollTop = 0;
}""",
"""  c.style.fontSize = best+'px';
  c.scrollTop = 0;
  s.classList.toggle('over', c.scrollHeight > avail + 2);
}""")
t = t.replace("""    c.style.fontSize = best+'px'; return;
  }""",
"""    c.style.fontSize = best+'px';
    s.classList.remove('over');
    return;
  }""")

# (c) CSS：lead 小标题、溢出提示
t = t.replace(""".sol b{color:var(--accent2)}""",
""".sol b{color:var(--accent2)}
p.lead{margin:.85em 0 .3em}
p.lead>b{display:block;color:var(--accent);font-size:.92em;letter-spacing:.02em;margin-bottom:.12em}
p.lead:first-child{margin-top:0}
.slide.over>.content{scrollbar-color:var(--line) transparent}
#ovh{display:none;font-size:12px;color:var(--muted);border:1px dashed var(--line);
     border-radius:999px;padding:1px 9px}
body.hasov #ovh{display:inline-block}""")

# 顶栏加溢出提示
t = t.replace("""    <div id="pidwrap"><span id="pid"></span><span id="plabel"></span></div>""",
"""    <div id="pidwrap"><span id="ovh">↕ 内容较长，可滚动</span><span id="pid"></span><span id="plabel"></span></div>""")
t = t.replace("""  fit(i);
  $('#secname').textContent""",
"""  fit(i);
  document.body.classList.toggle('hasov', s.classList.contains('over'));
  $('#secname').textContent""")
io.open(p,"w",encoding="utf-8").write(t)
print("patched")
