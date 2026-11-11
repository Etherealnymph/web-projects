from pathlib import Path

p = Path(r'C:\Users\21154\Desktop\1101\GmIdStudio\src\app.js')
lines = p.read_text(encoding='utf-8').splitlines()
for i, l in enumerate(lines):
    if '原始文件' in l and 'rf018.scs' in l:
        lines[i] = l.replace('\\', '\\\\')
        print('fixed', i + 1)
p.write_text('\n'.join(lines) + '\n', encoding='utf-8')
