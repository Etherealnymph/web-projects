import io
p="01_题目全集.md"; t=io.open(p,encoding="utf-8").read()
mark="> \U0001f5a5 \u5168\u5c4f\u653e\u6620\u7248\uff1a\u6253\u5f00 `web/index.html`\uff08\u4e00\u9898\u4e00\u5c4f\u3001\u65b9\u5411\u952e\u7ffb\u9875\u3001F \u5168\u5c4f\u3001O \u603b\u89c8\u3001T \u770b\u8bc4\u6ce8\u4e0e\u677f\u4e66\uff09\u3002\n"
if "web/index.html" not in t:
    t = t.replace("> \u53bb\u91cd\u540e\u5171", mark + "> \u53bb\u91cd\u540e\u5171", 1)
    io.open(p,"w",encoding="utf-8",newline="\n").write(t)
    print("inserted")
else:
    print("exists")
