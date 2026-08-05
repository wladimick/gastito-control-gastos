from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
changed = []
for path in (root / 'src' / 'components').glob('*.jsx'):
    text = path.read_text(encoding='utf-8')
    fixed = re.sub(
        r'const help = info \|\| financialHelpFor\(label\)\s*(?=(?:const|return|let|if)\b)',
        'const help = info || financialHelpFor(label); ',
        text,
    )
    if fixed != text:
        path.write_text(fixed, encoding='utf-8')
        changed.append(str(path.relative_to(root)))

if not changed:
    raise SystemExit('No se encontraron archivos para corregir.')
print('\n'.join(changed))
