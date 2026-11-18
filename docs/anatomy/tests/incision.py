"""Capture the incision sequence: python3 tests/incision.py -> .shots/inc_*.png"""
import pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / '.shots'
OUT.mkdir(exist_ok=True)
URL = (ROOT / 'human-organs.html').as_uri()
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    pg = b.new_page(viewport={'width': 1366, 'height': 800})
    logs = []
    pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}'))
    pg.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
    pg.goto(URL, timeout=90000)
    pg.wait_for_timeout(1500)
    pg.screenshot(path=str(OUT / 'inc_0_closed.png'))
    for name, phase, u in [('1_cut40', 'cut', 0.4), ('2_cut100', 'cut', 0.999), ('3_open35', 'open', 0.35), ('4_open100', 'open', 0.999), ('5_fade50', 'fade', 0.5)]:
        pg.evaluate(f"__anatomy.incSeek('{phase}', {u})")
        pg.wait_for_timeout(900)
        pg.screenshot(path=str(OUT / f'inc_{name}.png'))
    pg.evaluate("__anatomy.openBody(true)")
    pg.wait_for_timeout(2500)
    pg.screenshot(path=str(OUT / 'inc_6_done.png'))
    print('\n'.join(logs) or 'no console output')
    b.close()
