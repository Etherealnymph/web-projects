import pypdf
r=pypdf.PdfReader("docs/数学竞赛模拟题六.pdf")
for i,p in enumerate(r.pages):
    print("="*30,"page",i+1)
    print(p.extract_text(extraction_mode="layout", layout_mode_space_vertically=False))
