"""Visual capture of every stage and view: python3 tests/shots.py [only-substring]  -> .shots/*.png

Seeks through the public __shipyard helpers (the page itself is driven by the wall clock),
then lets the eased display settle before each screenshot.
"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / '.shots'
OUT.mkdir(exist_ok=True)
URL = (ROOT / 'shipyard.html').as_uri()
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
ONLY = sys.argv[1] if len(sys.argv) > 1 else ''

SIZES = {'d': (1366, 800), 't': (1024, 600), 'p': (390, 844)}
# (stage, progress) pairs that show each build step at its most telling moment
STAGES = [(0, 0.55), (1, 0.6), (2, 0.6), (3, 0.6), (4, 0.35), (4, 0.9), (5, 0.5), (5, 1.0), (6, 0.5), (6, 1.0)]
# closeups: name, view, CSS selector whose centre the clip is built around, stage, u
# (centred on a real element, so the clip follows the eased camera instead of guessing fractions)
CLOSEUPS = [
    ('dock_crane', 'yard', '#y-hook', 4, 0.9),
    ('welding_shop', 'yard', '[data-tag="welding"]', 1, 0.6),
    ('propeller_rudder', 'vessel', '#v-prop', None, None),
    ('bridge_radar', 'vessel', '#v-radar', None, None),
]
CLIP_W, CLIP_H = 340, 260   # css px of the 1x clip; the 4x clip is half of it, so both are 340x260 or 680x520 px


def want(name):
    return not ONLY or ONLY in name


def settle(pg, ms=1800):
    pg.wait_for_timeout(ms)


def clip_around(pg, selector, w, h):
    """A w x h css-px clip centred on the on-screen box of `selector`, kept inside the viewport."""
    bb = pg.locator(selector).first.bounding_box()
    vw, vh = pg.viewport_size['width'], pg.viewport_size['height']
    cx, cy = bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2
    x = min(max(cx - w / 2, 0), vw - w)
    y = min(max(cy - h / 2, 0), vh - h)
    return {'x': x, 'y': y, 'width': w, 'height': h}


def main():
    logs = []
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
        for key, (w, h) in SIZES.items():
            if ONLY.startswith('close') and key != 'd':
                continue
            pg = b.new_page(bypass_csp=True, viewport={'width': w, 'height': h}, device_scale_factor=1,
                            is_mobile=(key == 'p'), has_touch=(key == 'p'))
            pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
            pg.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
            pg.goto(URL, timeout=90000)
            pg.wait_for_function('window.__shipyard && window.__shipyard.S.frames > 2', timeout=60000)
            vp = pg.locator('#viewport')
            for i, (st, u) in enumerate(STAGES):
                name = f'{key}_yard_s{st}_{int(u * 100):03d}'
                if not want(name):
                    continue
                pg.evaluate(f'__shipyard.setView("yard");__shipyard.seek({st},{u})')
                settle(pg)
                pg.screenshot(path=str(OUT / f'{name}.png'))
            if want(f'{key}_vessel'):
                pg.evaluate('__shipyard.setView("vessel")')
                settle(pg)
                pg.screenshot(path=str(OUT / f'{key}_vessel.png'))
                for sysid in ('hull', 'engine', 'nav', 'elec', 'other'):
                    pg.evaluate(f'__shipyard.select("sys","{sysid}")')
                    settle(pg, 1200)
                    pg.screenshot(path=str(OUT / f'{key}_vessel_{sysid}.png'))
                pg.evaluate('__shipyard.clearSel()')
                pg.fill('#r-explode', '100')
                pg.dispatch_event('#r-explode', 'input')
                settle(pg, 2200)
                pg.screenshot(path=str(OUT / f'{key}_vessel_explode.png'))
            if key == 'd':
                for name, view, sel, st, u in CLOSEUPS:
                    if not want('close_' + name):
                        continue
                    pg.evaluate(f'__shipyard.setView("{view}")' + (f';__shipyard.seek({st},{u})' if st is not None else ';__shipyard.clearSel()'))
                    settle(pg, 2600)
                    pg.screenshot(path=str(OUT / f'close_{name}_1x.png'), clip=clip_around(pg, sel, CLIP_W, CLIP_H))
                pg.close()
                z = b.new_page(bypass_csp=True, viewport={'width': 1366, 'height': 800}, device_scale_factor=4)
                z.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
                z.goto(URL, timeout=90000)
                z.wait_for_function('window.__shipyard && window.__shipyard.S.frames > 2', timeout=60000)
                for name, view, sel, st, u in CLOSEUPS:
                    if not want('close_' + name):
                        continue
                    z.evaluate(f'__shipyard.setView("{view}")' + (f';__shipyard.seek({st},{u})' if st is not None else ';__shipyard.clearSel()'))
                    settle(z, 2600)
                    z.screenshot(path=str(OUT / f'close_{name}_4x.png'), clip=clip_around(z, sel, CLIP_W / 2, CLIP_H / 2))
                z.close()
            else:
                pg.close()
        print('\n'.join(logs) or 'no console output')
        b.close()


main()
