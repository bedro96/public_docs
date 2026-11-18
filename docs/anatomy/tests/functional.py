"""Functional test with real UI input: python3 tests/functional.py (exit code 1 on failure).

Headless software GL renders a few frames per second, so every animated step polls
the page state with a generous timeout instead of sleeping a fixed time.
"""
import pathlib
import sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'human-organs.html').as_uri()
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
FAILS = []


def check(name, ok, extra=''):
    print(('PASS ' if ok else 'FAIL ') + name + (f'  {extra}' if extra and not ok else ''))
    if not ok:
        FAILS.append(name)


def until(pg, expr, timeout=60000):
    try:
        pg.wait_for_function(expr, timeout=timeout)
        return True
    except Exception:
        return False


def state(pg):
    return pg.evaluate('__anatomy.state()')


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
        pg = b.new_page(viewport={'width': 1366, 'height': 800})
        logs, external = [], []
        pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
        pg.on('request', lambda r: external.append(r.url) if not r.url.startswith(('file:', 'data:', 'blob:')) else None)
        pg.goto(URL, timeout=90000)
        pg.wait_for_selector('#incise', state='visible')

        # 1. the body starts closed and the controls are locked
        st = state(pg)
        check('starts closed', st['phase'] == 'closed' and not st['opened'])
        check('app data-body=closed', pg.get_attribute('#app', 'data-body') == 'closed')
        check('organ list is inert while closed', pg.evaluate("document.querySelector('#rail').inert === true"))
        check('mode switch is inert while closed', pg.evaluate("document.querySelector('#modes').inert === true"))
        check('incision button visible', pg.is_visible('#incise'))
        check('surgeon-view card is bilingual', '집도 시점' in pg.inner_text('#detail') and "surgeon's view" in pg.inner_text('#detail'))

        # 2. real click runs the animation: cut -> open -> fade -> done
        pg.click('#incise')
        seen = set()
        for _ in range(200):
            seen.add(state(pg)['phase'])
            if state(pg)['opened']:
                break
            pg.wait_for_timeout(250)
        st = state(pg)
        check('incision completes by itself', st['opened'], str(seen))
        check('passes through the cut phase', 'cut' in seen, str(seen))
        check('camera looks down from the surgeon pitch', abs(st['camPitch'] - 0.72) < 0.05, str(st['camPitch']))
        check('app data-body=open', pg.get_attribute('#app', 'data-body') == 'open')
        check('organ list is live after opening', pg.evaluate("document.querySelector('#rail').inert === false"))
        check('incision button hidden after opening', not pg.is_visible('#incise'))
        pg.wait_for_timeout(1500)

        # 3. choose organs from the list: bilingual detail, 췌장 included
        for oid, kr, en in [('heart', '심장', 'Heart'), ('pancreas', '췌장', 'Pancreas'), ('stomach', '위', 'Stomach')]:
            pg.click(f'#organNav button[data-id="{oid}"]')
            txt = pg.inner_text('#detail')
            check(f'select {oid} shows Korean and English', kr in txt and en in txt)
            check(f'select {oid} updates state', state(pg)['selected'] == oid)

        # 4. remove and put back with the button
        pg.click('#actToggle')
        check('button removes the stomach', 'stomach' in state(pg)['removed'])
        check('removed organ travels to the shelf', until(pg, "__anatomy.state().at.stomach.x > 3.5 || __anatomy.state().at.stomach.x < -3.5 || __anatomy.state().at.stomach.y < -2"))
        pg.click('#actToggle')
        check('button puts it back', 'stomach' not in state(pg)['removed'])

        # 5. real mouse drag out of the body, then drag back in
        pg.evaluate("__anatomy.putAll()")
        pg.wait_for_timeout(2500)
        box = pg.locator('#viewport').bounding_box()
        src = pg.evaluate("__anatomy.screenPos('liver')")
        dst = {'x': box['x'] + box['width'] - 70, 'y': box['y'] + box['height'] * 0.55}
        pg.mouse.move(src['x'], src['y'])
        pg.mouse.down()
        for i in range(1, 13):
            pg.mouse.move(src['x'] + (dst['x'] - src['x']) * i / 12, src['y'] + (dst['y'] - src['y']) * i / 12)
            pg.wait_for_timeout(60)
        pg.mouse.up()
        check('mouse drag takes the liver out', until(pg, "__anatomy.state().removed.includes('liver')", 15000), str(state(pg)['removed']))
        pg.wait_for_timeout(2500)
        cur = pg.evaluate("__anatomy.screenPos('liver')")
        home = pg.evaluate("__anatomy.homeScreenPos('liver')")
        pg.mouse.move(cur['x'], cur['y'])
        pg.mouse.down()
        for i in range(1, 13):
            pg.mouse.move(cur['x'] + (home['x'] - cur['x']) * i / 12, cur['y'] + (home['y'] - cur['y']) * i / 12)
            pg.wait_for_timeout(60)
        pg.mouse.up()
        check('dragging it back snaps it into the body', until(pg, "!__anatomy.state().removed.includes('liver')", 15000), str(state(pg)['removed']))

        # 6. a short click on empty space must not remove anything; dragging empty space orbits the camera
        pg.wait_for_timeout(1500)
        yaw0 = state(pg)['camPitch']
        pg.mouse.move(box['x'] + 60, box['y'] + 200)
        pg.mouse.down()
        pg.mouse.move(box['x'] + 110, box['y'] + 160, steps=6)
        pg.mouse.up()
        check('dragging empty space tilts the view', abs(state(pg)['camPitch'] - yaw0) > 0.01 or state(pg)['removed'] == [])

        # 7. enlarge and rotate
        pg.click('#organNav button[data-id="heart"]')
        check('heart is selected before enlarging', state(pg)['selected'] == 'heart')
        pg.click('#actZoom')
        check('enlarge opens the inspector', until(pg, "__anatomy.state().inspect === 'heart'", 20000))
        check('inspector toolbar is visible', pg.is_visible('#inspectBar'))
        s0 = state(pg)
        c = pg.evaluate("({x: innerWidth*0.45, y: innerHeight*0.5})")
        pg.mouse.move(c['x'], c['y'])
        pg.mouse.down()
        pg.mouse.move(c['x'] + 140, c['y'] + 40, steps=8)
        pg.mouse.up()
        s1 = state(pg)
        check('dragging rotates the organ', abs(s1['yaw'] - s0['yaw']) > 0.1, f"{s0['yaw']} -> {s1['yaw']}")
        pg.click('#inLarger')
        check('Larger button zooms in', state(pg)['zoom'] > s1['zoom'])
        pg.click('#inSmaller')
        pg.mouse.move(c['x'], c['y'])
        z0 = state(pg)['zoom']
        pg.mouse.wheel(0, -300)
        pg.wait_for_timeout(400)
        check('mouse wheel zooms', state(pg)['zoom'] != z0)
        pg.keyboard.press('Escape')
        check('Escape closes the inspector', until(pg, "__anatomy.state().inspect === null", 20000), str(state(pg)['inspect']))

        # 8. follow the meal through all six stages
        pg.click('#modeMeal')
        check('meal mode opens', state(pg)['mode'] == 'meal' and pg.is_visible('#meal'))
        check('route has six stages', pg.locator('#route li').count() == 6)
        check('meal starts playing by itself', state(pg)['meal']['playing'] is True)
        check('playback advances to the next stage on its own', until(pg, "__anatomy.state().meal.stage >= 1", 150000))
        pg.click('#mealPlay')
        check('play button pauses', state(pg)['meal']['playing'] is False)
        stages = {state(pg)['meal']['stage']}
        for _ in range(5):
            if pg.is_enabled('#mealNext'):
                pg.click('#mealNext')
            stages.add(state(pg)['meal']['stage'])
        check('Next button reaches the last stage', state(pg)['meal']['stage'] == 5, str(sorted(stages)))
        check('Next is disabled on the last stage', not pg.is_enabled('#mealNext'))
        pg.evaluate('__anatomy.mealSeek(5, 0.999)')
        pg.click('#mealPlay')
        check('last stage finishes', until(pg, "__anatomy.state().meal.done === true", 60000))
        bol = pg.evaluate('__anatomy.bolus()')
        check('food marker is shown', bol['visible'])
        pg.click('#route li:nth-child(3) button')
        check('stage chip jumps to the stomach', until(pg, "__anatomy.state().meal.stage === 2", 15000))
        pg.click('#modeExplore')
        check('back to explore', state(pg)['mode'] == 'explore')

        # 9. health
        check('no console errors or warnings', not logs, '; '.join(logs))
        check('works offline (no network requests)', not external, ', '.join(external[:5]))
        b.close()

    print(f'\n{len(FAILS)} failed' if FAILS else '\nall passed')
    sys.exit(1 if FAILS else 0)


main()
