import io,re
t=io.open("web/index.html",encoding="utf-8").read()
i=t.find("若题面原式")
print(repr(t[i-320:i+80]))
