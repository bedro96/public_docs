"""Visual capture of every state: python3 tests/shots.py  -> .shots/*.png"""
import pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / '.shots'
OUT.mkdir(exist_ok=True)
URL = (ROOT / 'human-organs.html').as_uri()
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
        logs = []
        pg = b.new_page(bypass_csp=True, viewport={'width': 1366, 'height': 800})
        pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}'))
        pg.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
        pg.goto(URL, timeout=90000)
        pg.evaluate('__anatomy.openBody(true)')
        pg.wait_for_timeout(2500)
        vp = pg.locator('#viewport')
        pg.screenshot(path=str(OUT / 'explore.png'))
        pg.evaluate("__anatomy.select('pancreas');['stomach','heart','liver'].forEach(i=>__anatomy.remove(i))")
        pg.wait_for_timeout(3500)
        pg.screenshot(path=str(OUT / 'removed.png'))
        pg.evaluate("__anatomy.putAll();__anatomy.inspect('stomach')")
        pg.wait_for_timeout(3500)
        pg.screenshot(path=str(OUT / 'inspect.png'))
        pg.evaluate("__anatomy.rotate(2.4,-0.4)")
        pg.wait_for_timeout(800)
        vp.screenshot(path=str(OUT / 'inspect2.png'))
        pg.evaluate("__anatomy.closeInspect();__anatomy.setMode('meal')")
        pg.wait_for_timeout(2500)
        for i, u in [(0, 0.4), (1, 0.5), (2, 0.5), (3, 0.5), (4, 0.5), (5, 0.6)]:
            pg.evaluate(f"__anatomy.mealSeek({i},{u})")
            pg.wait_for_timeout(2600)
            vp.screenshot(path=str(OUT / f'meal{i}.png'))
        pg.screenshot(path=str(OUT / 'meal_full.png'))

        pg.close()
        ph = b.new_page(bypass_csp=True, viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        ph.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
        ph.goto(URL, timeout=90000)
        ph.evaluate('__anatomy.openBody(true)')
        ph.wait_for_timeout(2500)
        ph.evaluate("['heart','stomach','liver','pancreas'].forEach(i=>__anatomy.remove(i));__anatomy.select('heart')")
        ph.wait_for_timeout(3500)
        ph.screenshot(path=str(OUT / 'phone.png'))
        ph.evaluate("__anatomy.setMode('meal');__anatomy.mealSeek(2,0.5)")
        ph.wait_for_timeout(2500)
        ph.screenshot(path=str(OUT / 'phone_meal.png'))
        print('\n'.join(logs) or 'no console output')
        b.close()


main()
