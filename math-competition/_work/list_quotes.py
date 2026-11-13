import io,re
t=io.open("01_题目全集.md",encoding="utf-8").read()
i=t.index('<a id="sec23"></a>')
seg=t[i:]
# 找出该段内所有以 "> " 开头、但不是 "> **评注**"、"> 拍摄"、"> 来源"、"> 说明" 的行
lines=[l for l in seg.split("\n") if l.startswith("> ") and not l.startswith("> **评注**")]
from collections import Counter
print(Counter(l[:6] for l in lines))
