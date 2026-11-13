import pypdf, glob, io, os
for f in sorted(glob.glob("docs/*.pdf")):
    r = pypdf.PdfReader(f)
    print("="*70)
    print(os.path.basename(f), "pages:", len(r.pages))
    txt = "\n".join((p.extract_text() or "") for p in r.pages)
    print("chars:", len(txt))
    print(txt[:600].replace("\n"," | "))
