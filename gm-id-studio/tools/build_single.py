from pathlib import Path

ROOT = Path(r'C:\Users\21154\Desktop\1101\gm-id-studio')
SRC = ROOT / 'src'
DIST = ROOT / 'dist'
DIST.mkdir(exist_ok=True)

html = (SRC / 'index.html').read_text(encoding='utf-8')
css = (SRC / 'styles.css').read_text(encoding='utf-8')
html = html.replace('<link rel="stylesheet" href="styles.css">', '<style>\n' + css + '\n</style>')

scripts = [
    ('../vendor/plotly.min.js', ROOT / 'vendor' / 'plotly.min.js'),
    ('model-parser.js', SRC / 'model-parser.js'),
    ('engine.js', SRC / 'engine.js'),
    ('model-b64.js', SRC / 'model-b64.js'),
    ('app.js', SRC / 'app.js'),
]
for src, path in scripts:
    code = path.read_text(encoding='utf-8')
    if '</script' in code.lower():
        raise SystemExit('script terminator in ' + str(path))
    tag = '<script src="%s"></script>' % src
    if tag not in html:
        raise SystemExit('missing tag ' + tag)
    html = html.replace(tag, '<script>\n' + code + '\n</script>')

out = DIST / 'GM-ID-Studio.html'
out.write_text(html, encoding='utf-8')
print(out, out.stat().st_size)
