"""Screenshots for visual review: python3 tests/shots.py   -> .shots/ (gitignored)

Every stage at 1366x800, 1024x600 and 390x844 (mobile), plus 1x and 4x close-ups around the moving car at the
junctions where parts meet (weld, dip tank, marriage, wheels, water test). Look at them: overlaps, clipped Korean,
floating parts, bare areas.
"""
import pathlib
import sys
import time
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'auto-factory.html').as_uri()
OUT = ROOT / '.shots'
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
VIEWS = [('desktop', 1366, 800, {}), ('s1024', 1024, 600, {}), ('phone', 390, 844, dict(has_touch=True, is_mobile=True, device_scale_factor=2))]
# the middle of each stage, then a few specific beats (desktop only)
POINTS = [(f's{i + 1}', i + 0.5) for i in range(7)] + [('press-stroke', 1.45), ('weld', 2.35), ('dip', 3.4), ('spray', 3.8), ('marriage', 5.3), ('dyno', 6.3)]
EXTRA = {'press-stroke', 'weld', 'dip', 'spray', 'marriage', 'dyno'}
CLOSE = [('weld', 2.35), ('dip', 3.45), ('marriage', 5.32), ('wheels', 5.62), ('water', 6.55)]


def settle(pg, u):
    # hold() + tick(): deterministic frames (software GL only delivers one real frame every few seconds); seek() snaps the camera
    pg.evaluate('(u) => { const f = window.__factory; f.hold(true); f.seek(u); f.tick(60); f.tick(60); }', u)
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
            pg.evaluate('() => { const f = window.__factory; f.hold(true); f.seek(0); f.tick(60); }')
            pg.locator('#ctl-over').click()
            pg.evaluate('() => { for (let i = 0; i < 14; i++) window.__factory.tick(300); }')
            time.sleep(0.3)
            pg.screenshot(path=str(OUT / f'{name}-overview.png'))
            print(name, 'logs:', logs[:3])
            ctx.close()
        # close-ups: 1x and 4x around the moving car
        for scale in (1, 4):
            ctx = b.new_context(viewport={'width': 1366, 'height': 800}, bypass_csp=True, device_scale_factor=scale)
            pg = ctx.new_page()
            pg.goto(URL)
            pg.wait_for_selector('html[data-ready="1"]', state='attached', timeout=60000)
            for label, u in CLOSE:
                settle(pg, u)
                c = pg.evaluate('() => window.__factory.carPos()')
                half = 85
                clip = dict(x=max(0, c['x'] - half), y=max(0, c['y'] - half), width=2 * half, height=2 * half)
                pg.screenshot(path=str(OUT / f'close{scale}x-{label}.png'), clip=clip)
            ctx.close()
        b.close()
    print('screenshots in', OUT)
    return 0


if __name__ == '__main__':
    sys.exit(main())
