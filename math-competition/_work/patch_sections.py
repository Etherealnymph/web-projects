import io, re
p = "01_题目全集.md"
t = io.open(p, encoding="utf-8").read()
orig_len = len(t)

# ---------- 1) 四个已有模拟卷小节：重命名标题 + 目录行 ----------
renames = [
    ("## 19. 习题课：多元积分综合", "## 19. 模拟卷一 · 多元积分综合（电子科大模拟测试一）",
     "| 19 | [习题课：多元积分综合](#sec19)", "| 19 | [模拟卷一 · 多元积分综合](#sec19)"),
    ("## 20. 模拟题三", "## 20. 模拟卷三（课堂模拟测试三）",
     "| 20 | [模拟题三](#sec20)", "| 20 | [模拟卷三](#sec20)"),
    ("## 21. 级数与积分综合", "## 21. 模拟卷五 · 级数与积分综合（模拟测试五）",
     "| 21 | [级数与积分综合](#sec21)", "| 21 | [模拟卷五 · 级数与积分综合](#sec21)"),
    ("## 22. 模拟题四", "## 22. 模拟卷四（模拟测试四）",
     "| 22 | [模拟题四](#sec22)", "| 22 | [模拟卷四](#sec22)"),
]
for old_h, new_h, old_row, new_row in renames:
    assert old_h in t, old_h
    assert old_row in t, old_row
    t = t.replace(old_h, new_h, 1)
    t = t.replace(old_row, new_row, 1)

# ---------- 2) 目录表新增 23、24 两行 ----------
row22 = [l for l in t.split("\n") if l.startswith("| 22 | [模拟卷四](#sec22)")][0]
new_rows = (row22 + "\n"
            "| 23 | [模拟卷六（模拟测试六）](#sec23) | — | PDF 2 页 | 11 |\n"
            "| 24 | [模拟检测卷·第三套](#sec24) | — | 长图 18 张 | 11 |")
t = t.replace(row22, new_rows, 1)

# ---------- 3) 插入 23、24 两节（替换文末的 [完] 导航） ----------
tail_nav = '<div align="center">[← 上一部分](#sec21) ｜ [↑ 回到目录](#toc) ｜ [完]</div>'
assert tail_nav in t
new_sections = io.open("_work/new_sections.md", encoding="utf-8").read().strip("\n")
t = t.replace(tail_nav,
              '<div align="center">[← 上一部分](#sec21) ｜ [↑ 回到目录](#toc) ｜ [下一部分 23 →](#sec23)</div>\n\n'
              + new_sections, 1)

# ---------- 4) 专题速查：把 P209–P230 归入「综合」 ----------
m = re.search(r"\*\*综合\*\*（(\d+) 题）：(.*)$", t, re.M)
assert m
old_cnt, old_list = int(m.group(1)), m.group(2)
added = "、".join("[P%d](#p%d)" % (i, i) for i in range(209, 231))
new_line = "**综合**（%d 题）：%s、%s" % (old_cnt + 22, old_list, added)
t = t.replace(m.group(0), new_line, 1)

# ---------- 5) 顶部说明：题数与来源 ----------
t = t.replace("> 去重后共 **208 道题**，按拍摄时间（= 讲课顺序）排列；每题附「完整解答」、「课堂板书」与「评注」。",
              "> 去重后共 **230 道题**：前 208 题按拍摄时间（= 讲课顺序）排列，另补入 **4 份模拟卷（卷一／三／四／五／六）与「模拟检测卷·第三套」**的 22 道题；每题附「完整解答」、"
              "「课堂板书」与「评注」。")
io.open(p, "w", encoding="utf-8", newline="\n").write(t)
print("orig chars", orig_len, "-> new chars", len(t))
print("题目标题数:", len(re.findall(r"(?m)^### P\d{3}", t)))
print("anchors:", len(re.findall(r'<a id="p\d{3}"></a>', t)))
