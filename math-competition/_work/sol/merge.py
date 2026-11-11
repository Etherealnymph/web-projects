# -*- coding: utf-8 -*-
"""把 sol/b*.md 里的「完整解答」合并进 01_题目全集.md。

每篇解答文件格式：
    @@P001@@
    解答正文（可含空行）
    @@P002@@
    ...

合并规则（对每道题的块）：
  1. 若该题已有 **板书要点**，把它折叠成 <details><summary>课堂板书（原样记录，供对照）</summary>…</details>
  2. 在「题目 / 答案」之后、「板书要点或 <details> 或 评注」之前，插入 **完整解答**
"""
import re, io, sys, os, glob

SRC = r'D:\Project\2026-2027-1\math-competition\01_题目全集.md'
OUT = SRC
D = os.path.dirname(os.path.abspath(__file__))


def load_solutions():
    sol = {}
    files = sorted(glob.glob(os.path.join(D, 'b*.md')))
    for f in files:
        txt = io.open(f, encoding='utf-8').read()
        parts = re.split(r'(?m)^@@P(\d{3})@@\s*$', txt)
        # parts: ['', pid, body, pid, body, ...]
        for i in range(1, len(parts), 2):
            pid = int(parts[i])
            body = parts[i + 1].strip('\n')
            if not body.strip():
                continue
            if pid in sol:
                raise SystemExit('duplicate pid %d in %s' % (pid, f))
            sol[pid] = body.strip()
    return sol


SOL_HEAD = '**完整解答**'
BD_HEAD = '**板书要点**'
BD_DETAILS = ('<details><summary>课堂板书（原样记录，供对照）</summary>\n\n'
              '{body}\n\n</details>')


def process(text, sol):
    lines = text.split('\n')
    out = []
    i = 0
    n = len(lines)
    done = set()
    while i < n:
        line = lines[i]
        m = re.match(r'^### P(\d{3})　', line)
        if not m:
            out.append(line)
            i += 1
            continue
        pid = int(m.group(1))
        # 收集本题块：到下一个 '---' 分隔线（独占一行）为止，或文件末尾
        j = i + 1
        while j < n and not (lines[j].strip() == '---'):
            j += 1
        block = lines[i:j]
        rest = lines[j:]
        # 在 block 内找插入位置：第一个 **板书要点** / <details> / '> **评注**'
        ins = None
        for k, ln in enumerate(block):
            s = ln.strip()
            if s == BD_HEAD or s.startswith('<details>') or s.startswith('> **评注**'):
                ins = k
                break
        if ins is None:
            # 没有板书/评注：放在 <sub>照片 之前，或块末
            for k, ln in enumerate(block):
                if ln.strip().startswith('<sub>照片'):
                    ins = k
                    break
            if ins is None:
                ins = len(block)
        # 处理板书要点折叠：找到 BD_HEAD 到下一个非正文段（评注/details/sub/备注）
        newblock = block[:ins]
        tail = block[ins:]
        if tail and tail[0].strip() == BD_HEAD:
            # 板书正文 = BD_HEAD 之后、到 '> **评注**' / <details> / '*备注' / <sub> 之前的连续段落
            k = 1
            while k < len(tail):
                s = tail[k].strip()
                if s.startswith('> **评注**') or s.startswith('<details>') \
                        or s.startswith('*备注') or s.startswith('<sub>'):
                    break
                k += 1
            body = '\n'.join(tail[1:k]).strip('\n').strip()
            tail = ([BD_DETAILS.format(body=body), ''] if body else []) + tail[k:]
        soltext = sol.get(pid)
        if soltext:
            done.add(pid)
            # 保证与前文空一行，再放解答
            if newblock and newblock[-1].strip() != '':
                newblock.append('')
            newblock += [SOL_HEAD, ''] + soltext.split('\n') + ['']
        out.extend(newblock)
        out.extend(tail)
        i = j
    return '\n'.join(out), done


def main():
    global SRC, OUT
    if len(sys.argv) > 1:
        SRC = sys.argv[1]
    if len(sys.argv) > 2:
        OUT = sys.argv[2]
    sol = load_solutions()
    with io.open(SRC, encoding='utf-8') as f:
        text = f.read()
    if SOL_HEAD in text:
        print('WARN: 源文件已含「完整解答」，请先恢复原始文件', file=sys.stderr)
        return 1
    new, done = process(text, sol)
    allp = set(range(1, 209))
    print('合并题数 %d / %d' % (len(done), 208))
    miss = sorted(allp - done)
    if miss:
        print('缺解答：' + ', '.join('P%03d' % p for p in miss))
    new = new.replace(
        '> \u53bb\u91cd\u540e\u5171 **208 \u9053\u9898**\uff0c\u6309\u62cd\u6444\u65f6\u95f4\uff08= \u8bb2\u8bfe\u987a\u5e8f\uff09\u6392\u5217\uff1b\u6bcf\u9898\u9644\u300c\u677f\u4e66\u8981\u70b9\u300d\u4e0e\u300c\u8bc4\u6ce8\u300d\u3002',
        '> \u53bb\u91cd\u540e\u5171 **208 \u9053\u9898**\uff0c\u6309\u62cd\u6444\u65f6\u95f4\uff08= \u8bb2\u8bfe\u987a\u5e8f\uff09\u6392\u5217\uff1b\u6bcf\u9898\u9644\u300c\u5b8c\u6574\u89e3\u7b54\u300d\u3001\u300c\u8bfe\u5802\u677f\u4e66\u300d\u4e0e\u300c\u8bc4\u6ce8\u300d\u3002')
    new = new.replace(
        '> \u8bf4\u660e\uff1a\u300c\u677f\u4e66\u8981\u70b9\u300d\u662f\u8bfe\u5802\u4e0a\u6295\u5f71\u89e3\u7b54\u7684\u6574\u7406\u7248\uff1b\u6574\u7406\u65f6\u6838\u5bf9\u8fc7\u4e0e\u9898\u76ee\u7684\u5bf9\u5e94\u5173\u7cfb\uff0c\u5bf9\u4e0d\u4e0a\u6216\u6b8b\u7f3a\u7684\u6539\u4ee5\u300c\u539f\u56fe\u677f\u4e66\uff08\u672a\u6838\u5bf9\uff09\u300d\u6298\u53e0\u663e\u793a\uff0c\u4ec5\u4f9b\u53c2\u8003\u3002\u8bc4\u6ce8\u4e3a\u9010\u9898\u8865\u5145\u3002',
        '> \u8bf4\u660e\uff1a\u6bcf\u9898\u4f9d\u6b21\u7ed9\u51fa\u300c\u9898\u76ee \u2192 \u7b54\u6848\uff08\u82e5\u6709\uff09\u2192 \u5b8c\u6574\u89e3\u7b54 \u2192 \u8bfe\u5802\u677f\u4e66\uff08\u6298\u53e0\uff0c\u539f\u6837\u4fdd\u7559\uff0c\u4ec5\u4f9b\u5bf9\u7167\uff09\u2192 \u8bc4\u6ce8\u300d\u3002\n> \u300c\u5b8c\u6574\u89e3\u7b54\u300d\u662f\u9010\u9898\u8865\u9f50\u7684\u5b8c\u6574\u8fc7\u7a0b\uff08\u8bc1\u660e\u6216\u8ba1\u7b97\u7684\u6bcf\u4e00\u6b65\uff0c\u5fc5\u8981\u5904\u6807\u51fa\u6240\u7528\u5b9a\u7406\uff09\uff1b\u5bf9\u4e2a\u522b\u9898\u9762\u6709\u8bef\uff08\u62cd\u6444\u7f3a\u5b57\u3001\u7b26\u53f7\u8bef\uff09\u7684\uff0c\u5df2\u5728\u8be5\u9898\u5185\u6807\u6ce8\u300c\u9898\u9762\u6838\u8ba2\u300d\u5e76\u6309\u4fee\u6b63\u540e\u7684\u7248\u672c\u89e3\u7b54\u3002\n> \u300c\u8bfe\u5802\u677f\u4e66\u300d\u4e3a\u8bfe\u5802\u6295\u5f71\u89e3\u7b54\u7684\u539f\u6837\u8bb0\u5f55\uff08\u6298\u53e0\uff09\uff0c\u53ef\u4e0e\u5b8c\u6574\u89e3\u7b54\u5bf9\u7167\u3002')
    with io.open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write(new)
    print('写入 %d 字节' % len(new.encode('utf-8')))
    return 0


if __name__ == '__main__':
    sys.exit(main())
