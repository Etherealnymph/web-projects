# -*- coding: utf-8 -*-
"""把 01_题目全集.md 生成「一题一屏」的全屏放映网页。

产物：
  web/index.html                     单文件应用（数据、样式、脚本全内嵌）
  web/vendor/katex/katex.min.js      KaTeX（本地，离线可用）
  web/vendor/katex/katex.min.css
  web/vendor/katex/fonts/*.woff2
"""
import io, os, re, json, shutil, html, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # math-competition/
MD = os.path.join(ROOT, '01_题目全集.md')
WEB = os.path.join(ROOT, 'web')
KATEX_SRC = (r'C:\Users\21154\.vscode\extensions'
             r'\.ab17b374-2e55-4a5c-aaee-b7e9b536b313\node_modules'
             r'\@marp-team\marp-core\node_modules\katex\dist')

# ---------------------------------------------------------------- 解析 markdown

SEC_RE = re.compile(r'^<a id="sec(\d+)"></a>$')
P_RE = re.compile(r'^<a id="p(\d{3})"></a>$')
H2_RE = re.compile(r'^## (\d+)\.\s*(.+)$')
H3_RE = re.compile(r'^### P(\d{3})\u3000(.*)$')
TIME_RE = re.compile(r'^> 拍摄时间：\*\*([^*]+)\*\*.*专题：(.+)$')


def split_problems(md):
    """返回 [{pid,label,title_line,lines,sec}]"""
    lines = md.split('\n')
    probs, cur_sec, i = [], None, 0
    while i < len(lines):
        ln = lines[i]
        m = SEC_RE.match(ln.strip())
        if m:
            # 下一行是 ## N. 标题
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            m2 = H2_RE.match(lines[j].strip()) if j < len(lines) else None
            cur_sec = {'no': int(m2.group(1)), 'title': m2.group(2).strip()} if m2 else None
            i = j + 1
            continue
        m = P_RE.match(ln.strip())
        if m:
            pid = int(m.group(1))
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            m3 = H3_RE.match(lines[j].strip())
            label = m3.group(2).strip() if m3 else ''
            # 收集到下一个题/节/分隔符
            k = j + 1
            body = []
            while k < len(lines):
                s = lines[k].strip()
                if P_RE.match(s) or SEC_RE.match(s) or s.startswith('<div align="center">'):
                    break
                if s == '---':
                    k += 1
                    continue
                body.append(lines[k])
                k += 1
            probs.append({'pid': pid, 'label': label, 'sec': cur_sec, 'lines': body})
            i = k
            continue
        i += 1
    return probs


def cut(lines):
    """把题目块切成 题目/答案/解答/板书/评注/备注/照片。"""
    mode = None
    buf = {'statement': [], 'answer': [], 'solution': [], 'comment': [], 'note': [], 'photos': []}
    board, cur_board = [], None
    for ln in lines:
        s = ln.strip()
        if s == '**题目**':
            mode = 'statement'; continue
        if s.startswith('**答案**'):
            mode = 'answer'
            rest = s[len('**答案**'):].strip().lstrip('\u3000').strip()
            if rest:
                buf['answer'].append(rest)
            continue
        if s == '**完整解答**':
            mode = 'solution'; continue
        if s.startswith('<details>'):
            mode = 'board'
            summ = re.search(r'<summary>(.*?)</summary>', s)
            cur_board = {'summary': html.unescape(summ.group(1)) if summ else '课堂板书', 'lines': []}
            board.append(cur_board)
            continue
        if s.startswith('</details>'):
            mode = None; cur_board = None; continue
        if s.startswith('> **评注**'):
            mode = 'comment'
            rest = s[len('> **评注**'):].strip().lstrip('\u3000').strip()
            if rest:
                buf['comment'].append(rest)
            continue
        if s.startswith('*备注'):
            mode = 'note'
            buf['note'].append(s.strip('*').strip())
            continue
        if s.startswith('<sub>照片'):
            mode = 'photos'
            txt = re.sub(r'\[([^\]]+)\]\([^)]*\)', r'\1', s)
            txt = re.sub(r'<[^>]+>', '', txt)
            buf['photos'].append(txt.strip())
            continue
        if not s:
            if mode in ('statement', 'answer', 'solution', 'comment', 'note') and buf[mode] and buf[mode][-1] != '':
                buf[mode].append('')
            elif mode == 'board' and cur_board is not None and cur_board['lines'] and cur_board['lines'][-1] != '':
                cur_board['lines'].append('')
            continue
        if mode == 'board' and cur_board is not None:
            cur_board['lines'].append(ln.rstrip())
        elif mode:
            buf[mode].append(ln.rstrip())
    out = {k: '\n'.join(v).strip() for k, v in buf.items() if k != 'photos'}
    out['photos'] = ' '.join(buf['photos']).strip()
    out['board'] = [(b['summary'], '\n'.join(b['lines']).strip()) for b in board if '\n'.join(b['lines']).strip()]
    return out


# ------------------------------------------------- markdown-lite -> HTML + 数学

MATH_TOKEN = '\x01%d\x01'


def extract_math(text):
    """抽出 $$...$$ 与 $...$，返回 (带占位符的文本, [latex,...], [is_display,...])"""
    math, out, i, n = [], [], 0, len(text)
    while i < n:
        c = text[i]
        if c == '$':
            if text.startswith('$$', i):
                j = text.find('$$', i + 2)
                if j > 0:
                    math.append(text[i + 2:j].strip())
                    out.append(MATH_TOKEN % (len(math) - 1))
                    i = j + 2
                    continue
            else:
                j = i + 1
                while j < n:
                    if text[j] == '\\':
                        j += 2; continue
                    if text[j] == '$':
                        break
                    j += 1
                if j < n and j > i + 1:
                    math.append(text[i + 1:j])
                    out.append(MATH_TOKEN % (len(math) - 1))
                    i = j + 1
                    continue
        out.append(c)
        i += 1
    return ''.join(out), math


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def inline(s):
    """行内标记：**粗体**、`代码`、[文字](链接)"""
    s = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', s)
    s = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', s)
    s = re.sub(r'`([^`]+)`', r'<code>\1</code>', s)
    return s


def md_to_html(text, math, mdisp):
    """先按显示公式切块，再处理段落/列表。"""
    if not text.strip():
        return ''
    # 用显示公式把正文切片
    pieces, pos = [], 0
    disp_re = re.compile(r'\x01(\d+)\x01')
    for m in disp_re.finditer(text):
        idx = int(m.group(1))
        if mdisp[idx]:
            pieces.append(('text', text[pos:m.start()]))
            pieces.append(('math', idx))
            pos = m.end()
    pieces.append(('text', text[pos:]))

    out = []
    for kind, val in pieces:
        if kind == 'math':
            out.append('<div class="mathblock"><span class="math" data-display="1">%s</span></div>'
                       % esc(math[val]))
            continue
        # 文本段：`\n`（字面）当作换行，按空行分段
        val = re.sub(r'\\n(?![A-Za-z])', '\n', val)
        for block in re.split(r'\n\s*\n', val):
            block = block.strip('\n')
            if not block.strip():
                continue
            lines = [l for l in block.split('\n')]
            # 列表？
            if all(l.strip().startswith('- ') for l in lines if l.strip()):
                items = ''.join('<li>%s</li>' % inline_math(l.strip()[2:], math, mdisp)
                                for l in lines if l.strip())
                out.append('<ul>%s</ul>' % items); continue
            if all(re.match(r'^\s*\d+\.\s', l) for l in lines if l.strip()):
                items = ''.join('<li>%s</li>' % inline_math(re.sub(r'^\s*\d+\.\s*', '', l), math, mdisp)
                                for l in lines if l.strip())
                out.append('<ol>%s</ol>' % items); continue
            if lines and lines[0].strip().startswith('>'):
                q = ' '.join(re.sub(r'^\s*>+\s?', '', l) for l in lines).strip()
                out.append('<p class="quote">%s</p>' % inline_math(q, math, mdisp))
                continue
            merged = ' '.join(l.strip() for l in lines)
            mm = re.match(r'^\*\*(.{1,18}?)\*\*[\s\u3000]*(.*)$', merged, re.S)
            if mm and mm.group(1).strip():
                head = inline_math(mm.group(1).strip(), math, mdisp)
                rest = inline_math(mm.group(2), math, mdisp) if mm.group(2).strip() else ''
                out.append('<p class="lead"><b>%s</b>%s</p>' % (head, (' ' + rest) if rest else ''))
            else:
                body = inline_math(merged, math, mdisp)
                out.append('<p>%s</p>' % body)
    return '\n'.join(out)


def inline_math(s, math, mdisp):
    s = esc(s)
    s = inline(s)
    s = re.sub(r'\x01(\d+)\x01',
               lambda m: '<span class="math" data-display="0">%s</span>' % esc(math[int(m.group(1))]),
               s)
    return s


def build_field(text):
    if not text or not text.strip():
        return ''
    prot, math = extract_math(text)
    mdisp = [False] * len(math)
    # 判断哪些是显示公式：抽取时 $$ 与 $ 混在一起，重新扫描一次标记
    # （extract_math 用同一列表，故按原始顺序重新判断）
    prot2, math2, disp2 = extract_math_marked(text)
    assert math2 == math, 'math mismatch'
    return md_to_html(prot, math, disp2)


def extract_math_marked(text):
    math, disp, out, i, n = [], [], [], 0, len(text)
    while i < n:
        c = text[i]
        if c == '$':
            if text.startswith('$$', i):
                j = text.find('$$', i + 2)
                if j > 0:
                    math.append(text[i + 2:j].strip()); disp.append(True)
                    out.append(MATH_TOKEN % (len(math) - 1)); i = j + 2; continue
            else:
                j = i + 1
                while j < n:
                    if text[j] == '\\':
                        j += 2; continue
                    if text[j] == '$':
                        break
                    j += 1
                if j < n and j > i + 1:
                    math.append(text[i + 1:j]); disp.append(False)
                    out.append(MATH_TOKEN % (len(math) - 1)); i = j + 1; continue
        out.append(c); i += 1
    return ''.join(out), math, disp


def plain_preview(raw):
    s = raw
    s = re.sub(r'\$\$.*?\$\$', ' ', s, flags=re.S)
    s = re.sub(r'\$[^$]*\$', ' ', s)
    s = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', s)
    s = re.sub(r'\*\*|\*|`', '', s)
    s = re.sub(r'\\[a-zA-Z]+', '', s)
    s = re.sub(r'[{}\\]', '', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s[:64]


# ---------------------------------------------------------------- 组织数据

def build_data():
    md = io.open(MD, encoding='utf-8').read()
    probs = split_problems(md)
    data = []
    for p in probs:
        f = cut(p['lines'])
        item = {
            'pid': p['pid'],
            'label': p['label'],
            'sec': (p['sec']['no'] if p['sec'] else 0),
            'secTitle': (p['sec']['title'] if p['sec'] else ''),
            'statement': build_field(f['statement']),
            'answer': build_field(f['answer']),
            'solution': build_field(f['solution']),
            'comment': build_field(f['comment']),
            'note': build_field(f['note']),
            'board': [{'summary': s, 'html': build_field(t)} for s, t in f['board']],
            'photos': esc(f['photos']),
            'plain': plain_preview(f['statement']),
        }
        data.append(item)
    return data


# ---------------------------------------------------------------- 页面模板

CSS = r"""
:root{
  --bg:#faf8f3; --fg:#17181a; --muted:#6f7276; --line:#e4dfd4; --card:#ffffff;
  --accent:#a32d1f; --accent2:#1f6f8b; --chip:#f1ece1; --shadow:0 8px 30px rgba(0,0,0,.07);
  --fs:20px;
}
html[data-theme="dark"]{
  --bg:#14161a; --fg:#e9e7e2; --muted:#98a0a8; --line:#2a2f36; --card:#1b1f25;
  --accent:#e0795f; --accent2:#6fb3d2; --chip:#232830; --shadow:0 8px 30px rgba(0,0,0,.5);
}
*{box-sizing:border-box}
html,body{margin:0;height:100%}
body{
  background:var(--bg); color:var(--fg);
  font-family:"Segoe UI","PingFang SC","Microsoft YaHei","Hiragino Sans GB",system-ui,sans-serif;
  -webkit-font-smoothing:antialiased; overflow:hidden;
}
#app{position:fixed;inset:0;display:flex;flex-direction:column}

/* 顶栏 */
#hdr{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;
     padding:14px 34px 10px;border-bottom:1px solid var(--line);gap:18px}
#secname{font-size:14px;letter-spacing:.06em;color:var(--muted);text-transform:none;
         white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#pidwrap{display:flex;align-items:center;gap:10px;flex:0 0 auto}
#pid{font-size:15px;font-weight:700;color:#fff;background:var(--accent);
     padding:3px 10px;border-radius:999px;letter-spacing:.04em}
#plabel{font-size:14px;color:var(--muted)}

/* 舞台 */
#stage{flex:1 1 auto;position:relative;overflow:hidden}
.slide{position:absolute;inset:0;padding:2.2vh 6vw 1vh;opacity:0;visibility:hidden;
       transition:opacity .16s ease;display:flex}
.slide.on{opacity:1;visibility:visible}
.slide>.content{width:100%;max-width:1180px;margin:0 auto;font-size:var(--fs);
                overflow-y:auto;overflow-x:hidden;padding-bottom:2vh;scrollbar-width:thin}
.stmt{font-size:1.06em;line-height:1.62;border-left:4px solid var(--accent);
      padding:2px 0 2px 18px;margin:0 0 14px}
.ans{display:flex;align-items:baseline;gap:10px;background:var(--chip);border-radius:10px;
     padding:10px 16px;margin:0 0 18px;font-size:.98em;line-height:1.5}
.ans .tag{flex:0 0 auto;font-size:.78em;font-weight:700;color:var(--accent);
          border:1px solid var(--accent);border-radius:6px;padding:1px 7px;letter-spacing:.08em}
.solh{font-size:.74em;letter-spacing:.22em;color:var(--muted);font-weight:600;
      margin:0 0 8px;border-bottom:1px dashed var(--line);padding-bottom:6px}
.sol{line-height:1.66}
.sol p{margin:.45em 0}
.sol b{color:var(--accent2)}
p.lead{margin:.85em 0 .3em}
p.lead>b:first-child{display:block;color:var(--accent);font-size:.92em;letter-spacing:.02em;margin-bottom:.12em}
p.lead:first-child{margin-top:0}
p.lead>b:not(:first-child){color:var(--accent2);font-weight:600}
.slide.over>.content{scrollbar-color:var(--line) transparent;
  -webkit-mask-image:linear-gradient(to bottom,#000 calc(100% - 30px),transparent);
          mask-image:linear-gradient(to bottom,#000 calc(100% - 30px),transparent)}
#ovh{display:none;font-size:12px;color:var(--muted);border:1px dashed var(--line);
     border-radius:999px;padding:1px 9px}
body.hasov #ovh{display:inline-block}
.sol ul,.sol ol{margin:.4em 0 .4em 1.2em;padding:0}
.sol li{margin:.2em 0}
.quote{margin:.75em 0;padding:.45em 0 .45em 14px;border-left:3px solid var(--line);
       color:var(--muted);font-size:.94em;line-height:1.6}
.mathblock{margin:.55em 0;overflow-x:auto;overflow-y:hidden}
.mathblock .katex{font-size:1em}
.katex{font-size:1.02em}
code{background:var(--chip);padding:.1em .35em;border-radius:4px;font-size:.92em}
a{color:var(--accent2)}
.math-error{color:#c0392b;border-bottom:1px dotted #c0392b}

/* 底栏 */
#ftr{flex:0 0 auto;display:flex;align-items:center;gap:14px;padding:9px 34px 12px;
     border-top:1px solid var(--line)}
#bar{flex:1 1 auto;height:4px;background:var(--line);border-radius:2px;overflow:hidden}
#bar>i{display:block;height:100%;width:0;background:var(--accent);transition:width .18s}
#cnt{font-variant-numeric:tabular-nums;font-size:13px;color:var(--muted);white-space:nowrap}
.btn{border:1px solid var(--line);background:var(--card);color:var(--fg);border-radius:9px;
     padding:5px 11px;font-size:13px;cursor:pointer;line-height:1.5;white-space:nowrap}
.btn:hover{border-color:var(--accent);color:var(--accent)}
.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.btn.primary:hover{opacity:.9;color:#fff}

/* 抽屉（评注/板书/备注） */
#drawer{position:fixed;left:0;right:0;bottom:0;max-height:62vh;background:var(--card);
        border-top:1px solid var(--line);box-shadow:var(--shadow);transform:translateY(102%);
        transition:transform .2s ease;z-index:40;display:flex;flex-direction:column}
#drawer.on{transform:translateY(0)}
#dhead{display:flex;align-items:center;justify-content:space-between;padding:12px 30px;
       border-bottom:1px solid var(--line);font-size:14px;color:var(--muted)}
#dbody{padding:14px 30px 26px;overflow-y:auto;font-size:16px;line-height:1.62}
#dbody h5{margin:14px 0 6px;font-size:13px;letter-spacing:.12em;color:var(--accent);font-weight:700}
#dbody h5:first-child{margin-top:0}
#dbody .qm{color:var(--muted);font-size:.95em}

/* 遮罩层 */
.overlay{position:fixed;inset:0;background:rgba(10,10,12,.55);backdrop-filter:blur(2px);
         z-index:60;display:none;align-items:center;justify-content:center;padding:4vh 4vw}
.overlay.on{display:flex}
.panel{background:var(--bg);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);
       width:min(1180px,96vw);max-height:92vh;display:flex;flex-direction:column;overflow:hidden}
.phead{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 22px;
       border-bottom:1px solid var(--line)}
.phead b{font-size:16px}
.pbody{overflow-y:auto;padding:16px 22px 24px}

/* 总览网格 */
#gridlist{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:10px}
.gitem{border:1px solid var(--line);background:var(--card);border-radius:10px;padding:9px 11px;
       cursor:pointer;text-align:left;color:var(--fg);font:inherit;overflow:hidden}
.gitem:hover{border-color:var(--accent);transform:translateY(-1px)}
.gitem .gpid{font-size:12px;font-weight:700;color:var(--accent)}
.gitem .glab{font-size:11px;color:var(--muted);margin-left:6px}
.gitem .gtex{display:block;font-size:12px;color:var(--muted);margin-top:5px;line-height:1.4;
             max-height:3.9em;overflow:hidden}
.gitem.cur{outline:2px solid var(--accent);outline-offset:1px}
#filter{flex:1 1 auto;max-width:320px;padding:7px 11px;border-radius:9px;border:1px solid var(--line);
        background:var(--card);color:var(--fg);font-size:13px}

/* 帮助 */
#helplist{font-size:15px;line-height:2.05}
#helplist kbd{display:inline-block;min-width:1.9em;text-align:center;border:1px solid var(--line);
              border-bottom-width:2px;border-radius:6px;padding:0 6px;margin-right:6px;
              font:inherit;font-size:13px;background:var(--card)}
/* 提示气泡 */
#toast{position:fixed;left:50%;bottom:88px;transform:translateX(-50%) translateY(10px);
       background:rgba(20,20,22,.9);color:#fff;padding:8px 16px;border-radius:999px;font-size:13px;
       opacity:0;pointer-events:none;transition:.18s;z-index:80}
#toast.on{opacity:1;transform:translateX(-50%) translateY(0)}
/* 点击翻页热区 */
.zone{position:absolute;top:0;bottom:0;width:12%;z-index:5;opacity:0;
      transition:opacity .2s;cursor:pointer;border:0;background:transparent;color:var(--muted);font-size:34px}
#stage:hover .zone{opacity:.35}
.zone:hover{opacity:.9 !important}
#zprev{left:0}
#znext{right:0}
/* 打印 */
body.printing .slide{position:static;opacity:1;visibility:visible;display:block;
                     page-break-after:always;padding:10mm 8mm;height:auto}
body.printing #stage{overflow:visible}
body.printing .slide>.content{max-height:none;overflow:visible;font-size:15px}
body.printing .zone{display:none}
@media print{
  #hdr,#ftr,#drawer,.overlay,.zone,#toast{display:none !important}
  body{overflow:visible}
  #app{position:static}
}
"""

JS = r"""
const DATA = window.__DATA__;
const N = DATA.length;
const $ = s => document.querySelector(s);
const stage = $('#stage'), drawer = $('#drawer'), dbody = $('#dbody');

let cur = 0, typeset = new Set(), errs = [], slides = [], zoom = 1;

/* ---------- KaTeX ---------- */
function renderMathIn(el){
  el.querySelectorAll('span.math:not([data-done])').forEach(sp=>{
    const tex = sp.textContent;
    const disp = sp.dataset.display === '1';
    try{
      katex.render(tex, sp, {displayMode:disp, throwOnError:false, strict:false,
                             trust:true, output:'html', errorColor:'#c0392b'});
      if(sp.querySelector('.katex-error')) errs.push({pid:DATA[cur].pid, tex:tex.slice(0,80)});
    }catch(e){
      sp.classList.add('math-error'); sp.textContent = tex;
      errs.push({pid:DATA[cur].pid, tex:tex.slice(0,80), msg:e.message});
    }
    sp.dataset.done = '1';
  });
}

/* ---------- 幻灯片 ---------- */
function slideEl(it){
  const s = document.createElement('div');
  s.className = 'slide';
  s.id = 'p' + String(it.pid).padStart(3,'0');
  const ans = it.answer ? `<div class="ans"><span class="tag">答案</span><div>${it.answer}</div></div>` : '';
  s.innerHTML = `<div class="content">
      <div class="stmt">${it.statement}</div>
      ${ans}
      <div class="solh">完整解答</div>
      <div class="sol">${it.solution}</div>
    </div>`;
  return s;
}

function build(){
  DATA.forEach(it=>{ const el = slideEl(it); stage.appendChild(el); slides.push(el); });
}

/* ---------- 自适应字号 ---------- */
function fit(i){
  const s = slides[i]; if(!s) return;
  const c = s.querySelector('.content');
  const avail = (c.clientHeight || s.clientHeight);
  const hiMax = Math.min(52, Math.max(28, avail * 0.072));
  const lo = 14.5;
  c.style.fontSize = hiMax + 'px';
  let best;
  if(c.scrollHeight <= avail){
    let a = lo, b = hiMax; best = lo;
    for(let k=0;k<12;k++){ const m=(a+b)/2; c.style.fontSize=m+'px';
      if(c.scrollHeight<=avail){best=m;a=m;} else b=m; }
  } else {
    let a = lo, b = hiMax; best = lo;
    for(let k=0;k<14;k++){ const m=(a+b)/2; c.style.fontSize=m+'px';
      if(c.scrollHeight<=avail){best=m;a=m;} else b=m; }
  }
  const fs = Math.min(hiMax * 1.6, Math.max(10, best * zoom));
  c.style.fontSize = fs.toFixed(2) + 'px';
  s.classList.toggle('over', c.scrollHeight > avail + 2);
  if(!s.classList.contains('over')) c.scrollTop = 0;
}

function setZoom(z){
  zoom = Math.min(3, Math.max(0.7, z));
  fit(cur);
  document.body.classList.toggle('hasov', slides[cur].classList.contains('over'));
  toast('字号 ' + Math.round(zoom*100) + '%');
}

/* ---------- 显示 ---------- */
function show(i, push=true){
  i = Math.max(0, Math.min(N-1, i));
  cur = i;
  const it = DATA[i];
  slides.forEach((s,k)=>s.classList.toggle('on', k===i));
  const s = slides[i];
  if(!typeset.has(i)){ renderMathIn(s); typeset.add(i); }
  fit(i);
  document.body.classList.toggle('hasov', s.classList.contains('over'));
  $('#secname').textContent = (it.sec? it.sec + ' · ' + it.secTitle : '');
  $('#pid').textContent = 'P' + String(it.pid).padStart(3,'0');
  $('#plabel').textContent = it.label || '';
  $('#cnt').textContent = (i+1) + ' / ' + N;
  $('#bar>i').style.width = ((i+1)/N*100).toFixed(2) + '%';
  if(push) history.replaceState(null,'','#p'+String(it.pid).padStart(3,'0'));
  try{ localStorage.setItem('mc-pos', String(i)); }catch(e){}
  if(drawer.classList.contains('on')) fillDrawer(it);
  // 预热相邻两页
  [i+1, i-1].forEach(k=>{ const n=slides[k]; if(n && !typeset.has(k)){ renderMathIn(n); typeset.add(k);} });
}

function fillDrawer(it){
  const parts = [];
  if(it.comment) parts.push('<h5>评注</h5>' + it.comment);
  it.board.forEach(b=>parts.push('<h5>' + b.summary + '</h5>' + b.html));
  if(it.note) parts.push('<h5>备注</h5>' + it.note);
  if(it.photos) parts.push('<h5>原始照片</h5><div class="qm">' + it.photos + '</div>');
  dbody.innerHTML = parts.length ? parts.join('') : '<div class="qm">（本题无附加内容）</div>';
  dbody.querySelectorAll('span.math:not([data-done])').forEach(sp=>{
    try{ katex.render(sp.textContent, sp, {displayMode:sp.dataset.display==='1', throwOnError:false, strict:false, trust:true, output:'html'}); }catch(e){}
    sp.dataset.done='1';
  });
  dbody.scrollTop = 0;
}

/* ---------- 总览 ---------- */
function buildGrid(){
  const box = $('#gridlist');
  box.innerHTML = DATA.map((it,i)=>`<button class="gitem" data-i="${i}">
      <span class="gpid">P${String(it.pid).padStart(3,'0')}</span><span class="glab">${it.label||''}</span>
      <span class="gtex">${it.plain || ''}</span></button>`).join('');
  box.addEventListener('click', e=>{
    const b = e.target.closest('.gitem'); if(!b) return;
    toggle('#grid', false); show(+b.dataset.i);
  });
}

function toggle(sel, on){
  const el = $(sel);
  const v = (on===undefined) ? !el.classList.contains('on') : on;
  el.classList.toggle('on', v);
  if(sel==='#grid' && v){
    const b = $('#gridlist').children[cur];
    if(b) b.scrollIntoView({block:'center'});
    $('#filter').value=''; filterGrid('');
    setTimeout(()=>$('#filter').focus(), 30);
  }
  if(sel==='#drawer' && v) fillDrawer(DATA[cur]);
}

$('#filter').addEventListener('input', e=>filterGrid(e.target.value));

function filterGrid(q){
  q = q.trim().toLowerCase();
  [...$('#gridlist').children].forEach(b=>{
    const ok = !q || b.textContent.toLowerCase().includes(q);
    b.style.display = ok ? '' : 'none';
    b.classList.toggle('cur', +b.dataset.i === cur);
  });
}

/* ---------- 滚动或翻页 ---------- */
function scrollOrPage(dir){
  const s = slides[cur], c = s && s.querySelector('.content');
  if(c && s.classList.contains('over')){
    const atEnd = c.scrollTop + c.clientHeight >= c.scrollHeight - 3;
    const atTop = c.scrollTop <= 3;
    if(dir > 0 && !atEnd){ c.scrollBy({top: c.clientHeight*0.82, behavior:'smooth'}); return; }
    if(dir < 0 && !atTop){ c.scrollBy({top: -c.clientHeight*0.82, behavior:'smooth'}); return; }
  }
  show(cur + dir);
}

/* ---------- 提示 ---------- */
let toastT;
function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(()=>t.classList.remove('on'), 1500);
}

/* ---------- 全屏 ---------- */
function fullscreen(){
  if(document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(()=>toast('浏览器拒绝了全屏请求'));
}

/* ---------- 事件 ---------- */
document.addEventListener('keydown', e=>{
  const k = e.key;
  if(k==='Escape'){
    if($('#grid').classList.contains('on')) return toggle('#grid', false);
    if($('#help').classList.contains('on')) return toggle('#help', false);
    if(drawer.classList.contains('on')) return toggle('#drawer', false);
    return;
  }
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  if(document.activeElement === $('#filter')){
    if(k==='Enter'){ const first=[...$('#gridlist').children].find(b=>b.style.display!=='none');
      if(first){ toggle('#grid',false); show(+first.dataset.i); } }
    return;
  }
  switch(k){
    case 'ArrowRight': case ' ':
      e.preventDefault(); show(cur+1); break;
    case 'ArrowLeft':
      e.preventDefault(); show(cur-1); break;
    case 'ArrowDown': case 'PageDown':
      e.preventDefault(); scrollOrPage(1); break;
    case 'ArrowUp': case 'PageUp':
      e.preventDefault(); scrollOrPage(-1); break;
    case 'Home': e.preventDefault(); show(0); break;
    case 'End': e.preventDefault(); show(N-1); break;
    case 'f': case 'F': e.preventDefault(); fullscreen(); break;
    case 'o': case 'O': e.preventDefault(); toggle('#grid'); break;
    case 't': case 'T': e.preventDefault(); toggle('#drawer'); break;
    case 'd': case 'D': { e.preventDefault();
      const t = document.documentElement.getAttribute('data-theme')==='dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', t);
      try{ localStorage.setItem('mc-theme', t); }catch(e){}
      break;
    }
    case '?': case 'h': case 'H': e.preventDefault(); toggle('#help'); break;
    case 'g': case 'G': { e.preventDefault();
      const v = prompt('跳到第几题？（1–' + N + ' 或 P028）');
      if(v){ const m = /(\d+)/.exec(v); if(m){ const n=+m[1];
        show(/p/i.test(v) ? DATA.findIndex(d=>d.pid===n) : n-1); } }
      break;
    }
    case 'p': case 'P': e.preventDefault(); printAll(); break;
    case '!': checkAll(); break;
    case '+': case '=': setZoom(zoom * 1.12); break;
    case '-': case '_': setZoom(zoom / 1.12); break;
    case '0': setZoom(1); break;
  }
});

// 滚轮翻页（内容未溢出时）
let wheelLock = false;
stage.addEventListener('wheel', e=>{
  const c = slides[cur]?.querySelector('.content');
  if(!c) return;
  const scrollable = c.scrollHeight > c.clientHeight + 4;
  if(scrollable) return;
  if(wheelLock) return;
  if(Math.abs(e.deltaY) < 24) return;
  wheelLock = true; setTimeout(()=>wheelLock=false, 380);
  show(cur + (e.deltaY > 0 ? 1 : -1));
}, {passive:true});

// 触摸滑动
let tx=0, ty=0;
stage.addEventListener('touchstart', e=>{ tx=e.touches[0].clientX; ty=e.touches[0].clientY; }, {passive:true});
stage.addEventListener('touchend', e=>{
  const dx=e.changedTouches[0].clientX-tx, dy=e.changedTouches[0].clientY-ty;
  if(Math.abs(dx)>60 && Math.abs(dx)>Math.abs(dy)*1.6) show(cur + (dx<0?1:-1));
}, {passive:true});

document.addEventListener('click', e=>{
  const b = e.target.closest('[data-act]'); if(!b) return;
  const a = b.dataset.act;
  if(a==='prev') show(cur-1);
  else if(a==='next') show(cur+1);
  else if(a==='fs') fullscreen();
  else if(a==='grid') toggle('#grid');
  else if(a==='drawer') toggle('#drawer');
  else if(a==='help') toggle('#help');
  else if(a==='theme'){ const t=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';
    document.documentElement.setAttribute('data-theme',t); try{localStorage.setItem('mc-theme',t)}catch(e){} }
  else if(a==='print') printAll();
  else if(a==='close') toggle('#'+b.dataset.target, false);
});

window.addEventListener('hashchange', ()=>{
  const m = /^#p(\d+)$/.exec(location.hash);
  if(m){ const i = DATA.findIndex(d=>d.pid===+m[1]); if(i>=0 && i!==cur) show(i, false); }
});

window.addEventListener('resize', ()=>{ fit(cur); });

/* ---------- 打印 ---------- */
function printAll(){
  document.body.classList.add('printing');
  let i = 0;
  const step = ()=>{
    // 分批排版，避免长时间卡死
    const t0 = performance.now();
    while(i < N && performance.now() - t0 < 120){
      const s = slides[i];
      if(!typeset.has(i)){ renderMathIn(s); typeset.add(i); }
      s.querySelector('.content').style.fontSize = '15px';
      i++;
    }
    if(i < N) requestAnimationFrame(step);
    else { toast('已全部排版，准备打印…'); setTimeout(()=>{ window.print(); document.body.classList.remove('printing'); }, 300); }
  };
  step();
}

/* ---------- 全文公式自检 ---------- */
function checkAll(){
  let i = 0, bad = 0, first = '';
  const step = ()=>{
    const t0 = performance.now();
    while(i < N && performance.now() - t0 < 100){
      const s = slides[i];
      if(!typeset.has(i)){ renderMathIn(s); typeset.add(i); }
      s.querySelectorAll('.katex-error').forEach(()=>{ bad++; });
      i++;
    }
    if(i < N) requestAnimationFrame(step);
    else {
      let n = 0; slides.forEach(s=>{ n += s.querySelectorAll('.katex-error').length; });
      $('#secname').textContent = '公式自检：' + N + ' 题，未识别 ' + n + ' 处'
        + (n ? '（见控制台 __errs / 按 ? 查看）' : ' ✓');
      toast(n ? ('有 ' + n + ' 处公式未识别') : '全部公式渲染正常 ✓');
      window.__errs = errs;
    }
  };
  step();
}

/* ---------- 启动 ---------- */
build();
buildGrid();
let start = 0;
const m = /^#p(\d+)$/.exec(location.hash);
if(m){ const i = DATA.findIndex(d=>d.pid===+m[1]); if(i>=0) start = i; }
else { const v = parseInt(localStorage.getItem('mc-pos')||'-1',10); if(v>=0 && v<N) start = v; }
const th = localStorage.getItem('mc-theme'); if(th) document.documentElement.setAttribute('data-theme', th);
show(start, false);
setTimeout(()=>{ fit(cur); }, 60);
if(/[?&]check=1/.test(location.search)) setTimeout(checkAll, 400);
setTimeout(()=>{ if(errs.length) toast('有 ' + errs.length + ' 处公式未被 KaTeX 识别（按 ? 查看说明）'); }, 1200);
window.__errs = errs;
"""

HTML = """<!doctype html>
<html lang="zh-CN" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>大学生数学竞赛 · 题目放映（__N__ 题）</title>
<link rel="stylesheet" href="vendor/katex/katex.min.css">
<style>__CSS__</style>
</head>
<body>
<div id="app">
  <header id="hdr">
    <div id="secname"></div>
    <div id="pidwrap"><span id="ovh">↕ 可滚动</span><span id="pid"></span><span id="plabel"></span></div>
  </header>

  <main id="stage">
    <button class="zone" id="zprev" data-act="prev" title="上一题（←）">‹</button>
    <button class="zone" id="znext" data-act="next" title="下一题（→）">›</button>
  </main>

  <footer id="ftr">
    <button class="btn" data-act="prev" title="上一题 ←">‹ 上一题</button>
    <button class="btn" data-act="next" title="下一题 →">下一题 ›</button>
    <div id="bar"><i></i></div>
    <span id="cnt">1 / __N__</span>
    <button class="btn" data-act="grid" title="总览（O）">▦ 总览</button>
    <button class="btn" data-act="drawer" title="评注 / 板书（T）">ⓘ 附加</button>
    <button class="btn" data-act="fs" title="全屏（F）">⤢ 全屏</button>
    <button class="btn" data-act="theme" title="深/浅色（D）">◐</button>
    <button class="btn" data-act="help" title="快捷键（?）">?</button>
  </footer>
</div>

<div id="drawer">
  <div id="dhead"><span>附加内容：评注 · 课堂板书 · 备注 · 照片</span>
    <button class="btn" data-act="close" data-target="drawer">关闭 (T)</button></div>
  <div id="dbody"></div>
</div>

<div class="overlay" id="grid">
  <div class="panel">
    <div class="phead"><b>总览 · __N__ 题</b>
      <input id="filter" placeholder="筛选：题号 / 关键字（如 P028、积分、级数）">
      <button class="btn" data-act="close" data-target="grid">关闭 (O)</button></div>
    <div class="pbody"><div id="gridlist"></div></div>
  </div>
</div>

<div class="overlay" id="help">
  <div class="panel">
    <div class="phead"><b>快捷键</b><button class="btn" data-act="close" data-target="help">关闭</button></div>
    <div class="pbody"><div id="helplist">
      <div><kbd>→</kbd><kbd>↓</kbd><kbd>Space</kbd><kbd>PgDn</kbd> 下一题</div>
      <div><kbd>←</kbd><kbd>↑</kbd><kbd>PgUp</kbd> 上一题</div>
      <div><kbd>Home</kbd><kbd>End</kbd> 第一题 / 最后一题</div>
      <div><kbd>F</kbd> 全屏 / 退出全屏（也可用浏览器 F11）</div>
      <div><kbd>O</kbd> 题目总览（可筛选题号、关键字）</div>
      <div><kbd>T</kbd> 查看本题的评注、课堂板书、备注、原始照片</div>
      <div><kbd>G</kbd> 输入题号跳转（如 28 或 P028）</div>
      <div><kbd>D</kbd> 深色 / 浅色切换　<kbd>P</kbd> 排版全部并打印 / 导出 PDF</div>
      <div><kbd>+</kbd><kbd>-</kbd> 放大 / 缩小当前题的字号　<kbd>0</kbd> 复位</div>
      <div><kbd>!</kbd> 全文公式自检（208 题一次性排版并统计未识别公式）</div>
      <div><kbd>?</kbd> 本帮助　<kbd>Esc</kbd> 关闭浮层</div>
      <div style="margin-top:14px;color:var(--muted);font-size:13px">
        鼠标：底部按钮翻页；左右边缘点击翻页；内容未溢出时滚轮也可翻页。<br>
        手机/平板：左右滑动翻页。地址栏 #p028 可直接分享到某一题。
      </div>
    </div></div>
  </div>
</div>

<div id="toast"></div>

<script>window.__DATA__ = __PAYLOAD__;</script>
<script src="vendor/katex/katex.min.js"></script>
<script>__JS__</script>
</body>
</html>
"""


def copy_katex():
    dst = os.path.join(WEB, 'vendor', 'katex')
    os.makedirs(os.path.join(dst, 'fonts'), exist_ok=True)
    shutil.copy2(os.path.join(KATEX_SRC, 'katex.min.js'), os.path.join(dst, 'katex.min.js'))
    shutil.copy2(os.path.join(KATEX_SRC, 'katex.min.css'), os.path.join(dst, 'katex.min.css'))
    n = 0
    for f in sorted(os.listdir(os.path.join(KATEX_SRC, 'fonts'))):
        if f.endswith('.woff2'):
            shutil.copy2(os.path.join(KATEX_SRC, 'fonts', f), os.path.join(dst, 'fonts', f))
            n += 1
    return n


def main():
    data = build_data()
    print('题目数:', len(data), '题目总字数:', sum(len(d['statement']) for d in data))
    empty_sol = [d['pid'] for d in data if not d['solution'].strip()]
    if empty_sol:
        print('!! 无解答:', empty_sol)
    nf = copy_katex()
    print('KaTeX 字体:', nf, '个 woff2')
    js = JS
    if '</script' in js.lower():
        raise SystemExit('JS 中含有 </script>，需转义')
    page = (HTML.replace('__CSS__', CSS)
                .replace('__PAYLOAD__', json.dumps(data, ensure_ascii=False, separators=(',', ':')))
                .replace('__JS__', js)
                .replace('__N__', str(len(data))))
    out = os.path.join(WEB, 'index.html')
    io.open(out, 'w', encoding='utf-8', newline='\n').write(page)
    print('写出', out, round(len(page.encode('utf-8')) / 1024), 'KB')


if __name__ == '__main__':
    main()
