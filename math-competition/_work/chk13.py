import io,re
t=io.open("web/index.html",encoding="utf-8").read()
i=t.find("辅助函数的来历")
print(repr(t[i-260:i+120]))
