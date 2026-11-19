"""Developer preview: screenshot .shots/preview.html (made by tests/preview.mjs). Usage: python3 tests/preview.py [out.png] [width height scale]"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parent.parent
out = Path(sys.argv[1]) if len(sys.argv) > 1 else root / '.shots' / 'preview.png'
w = int(sys.argv[2]) if len(sys.argv) > 2 else 1400
h = int(sys.argv[3]) if len(sys.argv) > 3 else 860
scale = float(sys.argv[4]) if len(sys.argv) > 4 else 1
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': w, 'height': h}, device_scale_factor=scale)
    errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto((root / '.shots' / 'preview.html').as_uri())
    pg.wait_for_timeout(300)
    out.parent.mkdir(exist_ok=True)
    pg.screenshot(path=str(out))
    print('saved', out, 'errors:', errs)
    b.close()
