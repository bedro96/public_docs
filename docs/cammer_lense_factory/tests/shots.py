"""Screenshots for visual review: python3 tests/shots.py   -> .shots/ (gitignored)

Every stage at 1366x800, 1024x600 and 390x844 (mobile), plus a few beats inside the busiest stations (bill of materials,
active alignment: search / dispense / UV / bake, the tray, the phone: recess / flex routing / back view), and 1x and 4x
close-ups of the hero module (the loupe) and of the carrier on the plant line. Look at them: overlaps, clipped Korean,
floating parts, bare areas.
"""
import pathlib
import sys
import time
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'camera-module-factory.html').as_uri()
OUT = ROOT / '.shots'
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
VIEWS = [('desktop', 1366, 800, {}), ('s1024', 1024, 600, {}), ('phone', 390, 844, dict(has_touch=True, is_mobile=True, device_scale_factor=2))]
# the middle of each stage, then a few specific beats (desktop only)
POINTS = [(f's{i + 1}', i + 0.5) for i in range(8)] + [
    ('bom', 0.3), ('aa-search', 4.3), ('aa-dispense', 4.58), ('aa-uv', 4.66), ('aa-bake', 4.88),
    ('funnel', 5.9), ('tray', 6.3), ('carton', 6.9), ('phone-recess', 7.3), ('phone-flex', 7.58), ('phone-lid', 7.72), ('phone-back', 7.99),
]
EXTRA = {'bom', 'aa-search', 'aa-dispense', 'aa-uv', 'aa-bake', 'funnel', 'tray', 'carton', 'phone-recess', 'phone-flex', 'phone-lid', 'phone-back'}
CLOSE = [('bom', 0.3), ('lens', 3.6), ('aa-search', 4.3), ('aa-dispense', 4.58), ('aa-bake', 4.88), ('phone-flex', 7.58), ('phone-back', 7.99)]


def settle(pg, u):
    # hold() + tick(): deterministic frames (software GL only delivers one real frame every few seconds); seek() snaps the cameras
    pg.evaluate('(u) => { const f = window.__camfactory; f.hold(true); f.seek(u); f.tick(60); f.tick(60); f.tick(60); }', u)
    time.sleep(0.3)


def main():
    OUT.mkdir(exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
        for name, w, h, kw in VIEWS:
            ctx = b.new_context(viewport={'width': w, 'height': h}, bypass_csp=True, **kw)
            pg = ctx.new_page()
            logs = []
            pg.on('console', lambda m: logs.append(m.text) if m.type in ('error', 'warning') else None)
            pg.on('pageerror', lambda e: logs.append(str(e)))
            pg.goto(URL)
            pg.wait_for_selector('html[data-ready="1"]', state='attached', timeout=60000)
            for label, u in POINTS:
                if name != 'desktop' and label in EXTRA:
                    continue
                settle(pg, u)
                pg.screenshot(path=str(OUT / f'{name}-{label}.png'))
            pg.evaluate('() => { const f = window.__camfactory; f.hold(true); f.seek(0); f.tick(60); }')
            pg.locator('#ctl-over').click()
            pg.evaluate('() => { for (let i = 0; i < 14; i++) window.__camfactory.tick(300); }')
            time.sleep(0.3)
            pg.screenshot(path=str(OUT / f'{name}-overview.png'))
            print(name, 'logs:', logs[:3])
            ctx.close()
        # close-ups: 1x and 4x of the loupe figure, and of the carrier on the line
        for scale in (1, 4):
            ctx = b.new_context(viewport={'width': 1366, 'height': 800}, bypass_csp=True, device_scale_factor=scale)
            pg = ctx.new_page()
            pg.goto(URL)
            pg.wait_for_selector('html[data-ready="1"]', state='attached', timeout=60000)
            for label, u in CLOSE:
                settle(pg, u)
                pg.locator('#lfig').screenshot(path=str(OUT / f'close{scale}x-loupe-{label}.png'))
                c = pg.evaluate('() => window.__camfactory.carPos()')
                half = 90
                clip = dict(x=max(0, c['x'] - half), y=max(0, c['y'] - half), width=2 * half, height=2 * half)
                pg.screenshot(path=str(OUT / f'close{scale}x-line-{label}.png'), clip=clip)
            ctx.close()
        b.close()
    print('screenshots in', OUT)
    return 0


if __name__ == '__main__':
    sys.exit(main())
