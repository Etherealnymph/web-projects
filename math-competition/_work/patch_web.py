import io
p="_work/build_web.py"; t=io.open(p,encoding="utf-8").read()

# 1) 解析器接受 <sub>来源
t=t.replace("""        if s.startswith('<sub>照片'):""","""        if s.startswith('<sub>照片') or s.startswith('<sub>来源'):""")

# 2) 目录浮层：HTML
t=t.replace("""<div class="overlay" id="grid">""",
"""<div class="overlay" id="toc">
  <div class="panel">
    <div class="phead"><b id="toctitle">目录</b>
      <button class="btn" data-act="close" data-target="toc">关闭 (M)</button></div>
    <div class="pbody"><div id="toclist"></div></div>
  </div>
</div>

<div class="overlay" id="grid">""")

# 3) 底部按钮
t=t.replace("""    <button class="btn" data-act="grid" title="总览（O）">▦ 总览</button>""",
"""    <button class="btn" data-act="toc" title="目录（M）">☰ 目录</button>
    <button class="btn" data-act="grid" title="总览（O）">▦ 总览</button>""")

# 4) CSS
t=t.replace("""/* 总览网格 */""",
"""/* 目录 */
#toclist{display:flex;flex-direction:column;gap:2px}
.trow{display:grid;grid-template-columns:38px 1fr 54px 92px 74px;align-items:center;gap:10px;
      padding:7px 10px;border-radius:8px;cursor:pointer;border:1px solid transparent;background:none;
      color:var(--fg);font:inherit;text-align:left}
.trow:hover{background:var(--chip);border-color:var(--line)}
.trow.cur{border-color:var(--accent);background:var(--chip)}
.trow .tno{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.trow .ttl{font-size:14.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.trow .tcnt,.trow .trng{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.trow .ttag{font-size:11px;color:var(--muted);text-align:right;white-space:nowrap}
.trow.is-mock{border-left:3px solid var(--accent)}
.trow.is-mock .ttl{font-weight:600}
.trow.is-mock .ttag{color:var(--accent);font-weight:700}

/* 总览网格 */""")

# 5) JS：构建目录 + 事件
t=t.replace("""/* ---------- 总览 ---------- */""",
"""/* ---------- 目录 ---------- */
function buildToc(){
  const box = $('#toclist');
  const secs = [];
  DATA.forEach((it,i)=>{
    let s = secs.find(x=>x.no===it.sec);
    if(!s){ s = {no:it.sec, title:it.secTitle, first:i, last:i, n:0}; secs.push(s); }
    s.last = i; s.n++;
  });
  $('#toctitle').textContent = '目录 · ' + secs.length + ' 个分区 / ' + N + ' 题';
  box.innerHTML = secs.map(s=>{
    const p1 = String(DATA[s.first].pid).padStart(3,'0');
    const p2 = String(DATA[s.last].pid).padStart(3,'0');
    const mock = /模拟/.test(s.title) ? ' is-mock' : '';
    const tag = /模拟/.test(s.title) ? '模拟卷' : '';
    return `<button class="trow${mock}" data-i="${s.first}">
        <span class="tno">${s.no}</span>
        <span class="ttl">${s.title}</span>
        <span class="tcnt">${s.n} 题</span>
        <span class="trng">P${p1}–P${p2}</span>
        <span class="ttag">${tag}</span></button>`;
  }).join('');
  box.addEventListener('click', e=>{
    const b = e.target.closest('.trow'); if(!b) return;
    toggle('#toc', false); show(+b.dataset.i);
  });
}
function markToc(){
  [...$('#toclist').children].forEach(b=>{
    const i = +b.dataset.i;
    b.classList.toggle('cur', i === cur || (DATA[cur].sec === DATA[i].sec && cur >= i));
  });
}

/* ---------- 总览 ---------- */""")
t=t.replace("""  if(sel==='#grid' && v){""",
"""  if(sel==='#toc' && v) markToc();
  if(sel==='#grid' && v){""")
t=t.replace("""  if(drawer.classList.contains('on')) fillDrawer(it);""",
"""  if(drawer.classList.contains('on')) fillDrawer(it);
  if($('#toc').classList.contains('on')) markToc();""")
t=t.replace("""    case 'o': case 'O': e.preventDefault(); toggle('#grid'); break;""",
"""    case 'm': case 'M': e.preventDefault(); toggle('#toc'); break;
    case 'o': case 'O': e.preventDefault(); toggle('#grid'); break;""")
t=t.replace("""  else if(a==='grid') toggle('#grid');""",
"""  else if(a==='toc') toggle('#toc');
  else if(a==='grid') toggle('#grid');""")
t=t.replace("""    if($('#grid').classList.contains('on')) return toggle('#grid', false);""",
"""    if($('#toc').classList.contains('on')) return toggle('#toc', false);
    if($('#grid').classList.contains('on')) return toggle('#grid', false);""")
t=t.replace("""build();
buildGrid();""",
"""build();
buildToc();
buildGrid();""")
t=t.replace("""      <div><kbd>O</kbd> 题目总览（可筛选题号、关键字）</div>""",
"""      <div><kbd>M</kbd> 目录：24 个分区（模拟卷一 / 三 / 四 / 五 / 六、模拟检测卷·第三套均有标识）</div>
      <div><kbd>O</kbd> 题目总览（可筛选题号、关键字）</div>""")
io.open(p,"w",encoding="utf-8").write(t)
print("patched")
