"""Build output -> installable Komari theme zip (komari-theme.json + preview.png + dist/ at the root)."""
import json, os, sys, zipfile, hashlib

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
meta = json.load(open(os.path.join(root, 'komari-theme.json'), encoding='utf-8'))
for field in ('name', 'short', 'version', 'author'):
    if not isinstance(meta.get(field), str) or not meta[field].strip():
        sys.exit(f'komari-theme.json {field} must be a non-empty string for theme market submission')
if meta.get('description') is not None and not isinstance(meta['description'], str):
    sys.exit('komari-theme.json description must be a string for theme market submission')
dist = os.path.join(root, 'dist')
if not os.path.isfile(os.path.join(dist, 'index.html')):
    sys.exit('dist/index.html missing - run npm run build first')
html = open(os.path.join(dist, 'index.html'), encoding='utf-8').read()
for must in ('<title>Komari Monitor</title>', 'A simple server monitor tool.', f"/themes/{meta['short']}/dist/"):
    if must not in html:
        sys.exit(f'index.html lacks {must!r}')
out = os.path.join(root, f"komari-theme-{meta['short']}-v{meta['version']}.zip")
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for name in ('komari-theme.json', 'preview.png', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md'):
        z.write(os.path.join(root, name), name)
    for base, _, files in os.walk(dist):
        for f in sorted(files):
            p = os.path.join(base, f)
            z.write(p, os.path.relpath(p, root).replace(os.sep, '/'))
sha = hashlib.sha256(open(out, 'rb').read()).hexdigest()
print(out, os.path.getsize(out), 'bytes, sha256', sha)
