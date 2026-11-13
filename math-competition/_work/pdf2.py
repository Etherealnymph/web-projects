import pypdf
for f in ["docs/数学竞赛模拟题六.pdf","docs/数学竞赛模拟测试五.pdf"]:
    r=pypdf.PdfReader(f)
    print("="*72); print(f)
    for i,p in enumerate(r.pages):
        print("--- page",i+1)
        print(p.extract_text())
