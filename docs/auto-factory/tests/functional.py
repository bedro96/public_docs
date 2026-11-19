"""Functional test with REAL mouse / keyboard input: python3 tests/functional.py   (exit code 1 on failure)

Headless software GL can run at ~1 fps, so every animated step polls the page state with a generous
timeout instead of sleeping. The page is driven by the wall clock (not a capped dt), so polling works at any frame rate.
The main pages use bypass_csp (Playwright's string predicates need eval); ONE page then runs under the real CSP and
asserts that nothing is blocked, that the script still starts and that the controls work.
"""
import pathlib
import re
import sys
import time
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'auto-factory.html').as_uri()
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
FAILS = []
HANGUL = re.compile(r'[\uac00-\ud7a3]')


def check(name, ok, extra=''):
    print(('PASS ' if ok else 'FAIL ') + name + (f'  {extra}' if extra and not ok else ''))
    if not ok:
        FAILS.append(name)


def st(pg):
    return pg.evaluate('() => window.__factory.state')


def until(pg, fn, timeout=60.0, every=0.15):
    """Poll a python predicate over the page state; works under a strict CSP too (no string predicates)."""
    end = time.time() + timeout
    while time.time() < end:
        try:
            if fn(st(pg)):
                return True
        except Exception:
            pass
        time.sleep(every)
    return False


def new_page(b, w=1366, h=800, csp=False, **kw):
    ctx = b.new_context(viewport={'width': w, 'height': h}, bypass_csp=not csp, **kw)
    pg = ctx.new_page()
    pg.logs, pg.external, pg.violations = [], [], []
    pg.on('console', lambda m: pg.logs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: pg.logs.append(f'PAGEERROR: {e}'))
    pg.on('request', lambda r: pg.external.append(r.url) if not r.url.startswith(('file:', 'data:', 'blob:')) else None)
    pg.goto(URL, timeout=90000)
    pg.wait_for_selector('html[data-ready="1"]', state='attached', timeout=60000)
    return pg


def click(pg, selector):
    """A real mouse click at the element's centre (after checking it is actually on screen)."""
    box = pg.locator(selector).bounding_box()
    assert box, f'{selector} has no box'
    pg.mouse.click(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)


# A cheap fingerprint of everything drawn in the plant SVG (attributes included: viewBox, transforms, effect paths).
FP_JS = """() => { const s = new XMLSerializer().serializeToString(document.querySelector('#plant')); let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16) + ':' + s.length; }"""
# the moving effects: sparks, paint spray, water drops, wheel spokes (their `d` attributes)
FX_JS = """() => ['sparks', 'spray', 'drops'].map(id => document.getElementById(id).getAttribute('d') || '').concat(
  [[...document.querySelectorAll('#car .spokes')].map(p => p.getAttribute('d')).join('|')])"""


def fingerprint(pg):
    return pg.evaluate(FP_JS)


def effects(pg):
    return tuple(pg.evaluate(FX_JS))


def settle(pg, timeout=60.0):
    """Wait until the drawing stops changing (two identical fingerprints 0.8 s apart)."""
    end = time.time() + timeout
    prev = None
    while time.time() < end:
        cur = fingerprint(pg)
        if cur == prev:
            return True
        prev = cur
        time.sleep(0.8)
    return False


def py_advance(u, dt, seconds, end_u=7 - 1e-4):
    """An independent re-implementation of the tour clock (stage by stage, each at its own pace)."""
    u = min(max(u, 0.0), end_u)
    left = max(0.0, dt)
    while left > 0 and u < end_u:
        s = min(len(seconds) - 1, int(u))
        to_end = (s + 1 - u) * seconds[s]
        if left < to_end:
            u += left / seconds[s]
            left = 0
        else:
            u = float(s + 1)
            left -= to_end
    return min(u, end_u)


def tick(pg, ms, n=1):
    """Run n frames of exactly `ms` wall-clock milliseconds each (needs hold(true)); >= 40 ms so the 30 ms robot throttle never skips one."""
    for _ in range(n):
        pg.evaluate('(ms) => window.__factory.tick(ms)', ms)


def test_pause_freezes_everything(b):
    """Finding 1: Pause (and reduced motion) must freeze the picture: sparks, spray, wheel spin, robot sway, water drops."""
    pg = new_page(b)
    pg.evaluate('() => { const f = window.__factory; f.hold(true); f.seek(2.3); f.play(); }')
    seen_sparks, prints = False, set()
    for _ in range(8):
        tick(pg, 400)
        prints.add(effects(pg))
        seen_sparks = seen_sparks or bool(effects(pg)[0])
    check('playing: welding sparks are drawn in the body shop', seen_sparks)
    check('playing: the sparks really move from frame to frame', len(prints) >= 4, str(len(prints)))
    fx_play = st(pg)['fx']
    check('playing: the effect clock runs', fx_play > 2.5, str(fx_play))
    click(pg, '#ctl-play')  # real mouse: Pause
    check('Pause: state says paused', not st(pg)['playing'])
    tick(pg, 400, 14)  # let the camera ease finish; it is chrome, not scene
    for _ in range(30):  # the ease tail is exponential: wait until two frames agree before measuring
        a = fingerprint(pg)
        tick(pg, 400)
        if fingerprint(pg) == a:
            break
    fp1, ef1, s1 = fingerprint(pg), effects(pg), st(pg)
    for ms in (50, 400, 1000, 20000):
        tick(pg, ms)
    fp2, ef2, s2 = fingerprint(pg), effects(pg), st(pg)
    check('Pause: the whole plant drawing is byte-identical after more time (even a 20 s frame)', fp1 == fp2, f'{fp1} {fp2}')
    check('Pause: sparks / spray / drops / wheel spokes did not change', ef1 == ef2)
    check('Pause: the effect clock and progress are frozen', abs(s1['fx'] - s2['fx']) < 1e-9 and abs(s1['u'] - s2['u']) < 1e-9, f'{s1["fx"]} {s2["fx"]}')
    # --- the same thing under reduced motion, which must hold even at a stage with sparks and spinning wheels
    pg.evaluate('() => { const f = window.__factory; f.seek(2.5); f.play(); }')
    tick(pg, 400, 3)
    check('control: playing again moves the effect clock again (the freeze above is not a dead page)', st(pg)['fx'] > s2['fx'] + 0.5)
    pg.emulate_media(reduced_motion='reduce')
    check('reduced: reacts to the media change', until(pg, lambda s: s['reduced']))
    tick(pg, 400, 14)
    fpa, efa, sa = fingerprint(pg), effects(pg), st(pg)
    tick(pg, 20000)
    tick(pg, 700, 3)
    check('reduced: Play is not running', not st(pg)['playing'])
    check('reduced: no effect clock, no drift (drawing identical after 20 s)', fpa == fingerprint(pg) and efa == effects(pg) and abs(st(pg)['fx'] - sa['fx']) < 1e-9, f'{sa["fx"]} {st(pg)["fx"]}')
    pg.evaluate('() => window.__factory.hold(false)')
    # --- real frames, no hooks: Play -> Pause with the real mouse, then wait for several REAL frames
    pg.emulate_media(reduced_motion='no-preference')
    until(pg, lambda s: not s['reduced'])
    pg.evaluate('() => window.__factory.seek(2.2)')
    click(pg, '#ctl-play')
    f0 = st(pg)['frames']
    check('real frames: Play animates (frames and the effect clock advance)', until(pg, lambda s: s['frames'] >= f0 + 2 and s['fx'] > 0.5))
    click(pg, '#ctl-play')  # real mouse: Pause
    s0 = st(pg)
    until(pg, lambda s: s['frames'] >= s0['frames'] + 3, timeout=90)
    fpa, efa, sa = fingerprint(pg), effects(pg), st(pg)
    until(pg, lambda s: s['frames'] >= sa['frames'] + 3, timeout=90)
    check('real frames: after Pause the drawing and effect clock do not change over several frames', fpa == fingerprint(pg) and efa == effects(pg) and abs(st(pg)['fx'] - sa['fx']) < 1e-9)
    check('real frames: ...and the page stayed healthy', st(pg)['errors'] == 0 and not pg.logs, str(pg.logs[:3]))
    pg.context.close()


def test_pause_mid_glide(b):
    """Finding 1b: Pause during a glide stops it where it is, card and scene agree, and nothing keeps seeking."""
    pg = new_page(b)
    pg.evaluate('() => { const f = window.__factory; f.hold(true); f.play(); f.select(5); }')
    tick(pg, 250)
    s = st(pg)
    check('mid-glide: a glide toward stage 6 is in flight', s['seeking'] and 0.5 < s['u'] < 4.9 and s['stage'] == 5, str(s))
    click(pg, '#ctl-play')  # real mouse: Pause
    s = st(pg)
    check('Pause mid-glide: stopped (not playing, not seeking)', not s['playing'] and not s['seeking'])
    check('Pause mid-glide: the card follows the scene (selected stage == stage under the camera)', s['stage'] == s['modelStage'] and s['stage'] < 5, str(s))
    u = s['u']
    tick(pg, 400, 3)
    tick(pg, 20000)
    s2 = st(pg)
    check('Pause mid-glide: progress is frozen from then on', abs(s2['u'] - u) < 1e-9 and not s2['seeking'], f'{u} {s2["u"]}')
    names = ['코일', '프레스', '차체', '도장', '엔진', '조립', '출고']
    check('Pause mid-glide: the card shows the stage that is on screen', names[s2['stage']] in pg.inner_text('#card-name') and pg.inner_text('#stage-count').startswith(f'{s2["stage"] + 1} /'),
          f'{pg.inner_text("#card-name")!r} {s2["stage"]}')
    pg.context.close()


def test_motion_change_mid_seek(b):
    """Finding 2: switching to reduced motion in the middle of a glide lands on the chosen stage (card, scene and caption agree)."""
    pg = new_page(b)
    pg.evaluate('() => { const f = window.__factory; f.hold(true); f.select(4); }')
    tick(pg, 250)
    s = st(pg)
    check('mid-seek: a glide to the engine shop is in flight', s['seeking'] and 0.3 < s['u'] < 3.9 and s['stage'] == 4, str(s))
    check('mid-seek: before the change the caption is NOT the engine one (the bug showed engine card + coil caption)', '주조' not in pg.inner_text('#cap-ko'))
    pg.emulate_media(reduced_motion='reduce')
    check('mid-seek: reduced motion is picked up', until(pg, lambda s: s['reduced']))
    tick(pg, 50)
    s = st(pg)
    check('mid-seek: snapped onto the engine shop at its first caption', s['stage'] == 4 and s['modelStage'] == 4 and not s['seeking'] and abs(s['u'] - 4.02) < 1e-6, str(s))
    check('mid-seek: the card is the engine shop', '엔진 공장' in pg.inner_text('#card-name'))
    check('mid-seek: the caption is the engine shop\'s (casting), the scrubber agrees', '주조' in pg.inner_text('#cap-ko') and abs(float(pg.input_value('#scrub')) - 4020) < 2, pg.inner_text('#cap-ko'))
    check('mid-seek: the route marks stage 5', pg.evaluate("() => document.querySelector('#route [aria-current]')?.dataset.i") == '4')
    pg.evaluate('() => window.__factory.hold(false)')
    pg.context.close()


def test_uncapped_clock(b):
    """Finding 4: the tour clock is wall-clock time with NO cap (a slow GPU must not slow the tour), crossing stage boundaries correctly."""
    pg = new_page(b)
    secs = pg.evaluate('() => window.__factory.stageSeconds')
    pg.evaluate('() => { const f = window.__factory; f.hold(true); f.seek(0.97); f.play(); }')
    tick(pg, 20000)
    want = py_advance(0.97, 20.0, secs)
    capped = py_advance(0.97, 5.0, secs)
    got = st(pg)['u']
    check('20 s frame advances 20 s of tour (stage by stage), not the old 5 s cap', abs(got - want) < 1e-6 and abs(got - capped) > 0.3, f'got={got} want={want} old-cap={capped}')
    check('...and the card follows across the boundaries', st(pg)['stage'] == int(want), str(st(pg)))
    pg.evaluate('() => { const f = window.__factory; f.seek(6.5); f.play(); }')
    tick(pg, 600000)
    s = st(pg)
    check('a huge frame ends the tour cleanly at the last stage and stops playing', s['u'] > 6.99 and s['stage'] == 6 and not s['playing'] and s['errors'] == 0, str(s))
    pg.evaluate('() => window.__factory.hold(false)')
    # real, un-hooked: a 7 s main-thread stall in ONE evaluate; the first frame afterwards must account for all of it
    pg.evaluate('() => window.__factory.seek(0)')
    click(pg, '#ctl-play')
    until(pg, lambda s: s['playing'] and s['frames'] > 2)
    time.sleep(0.5)
    res = pg.evaluate("""() => { const S1 = window.__factory.state; const t0 = performance.now(); while (performance.now() - t0 < 7000) {}
        return new Promise((r) => requestAnimationFrame(() => r([S1, window.__factory.state]))); }""")
    a, c = res
    dt = (c['t'] - a['t']) / 1000
    check('real stall: the next frame saw >= 7 s of wall clock', dt >= 6.9, str(dt))
    want = py_advance(a['u'], dt, secs)
    check('real stall: tour progress matches the FULL elapsed time (not capped at 5 s)', abs(c['u'] - want) < 2e-3 and c['u'] > py_advance(a['u'], 5.0, secs) + 0.1, f'u1={a["u"]} u2={c["u"]} want={want} dt={dt}')
    pg.context.close()


def test_drops_clear(b):
    """Finding 6: the water-test drops disappear when the water stops (an old cache key left them hanging)."""
    pg = new_page(b)
    rng = pg.evaluate("() => { const m = window.__factory.model; const w = []; for (let u = 6; u < 6.9999; u += 0.005) if (m(u).water) w.push(u); return [w[0], w[w.length - 1]]; }")
    check('the model has a water-test window in stage 7', rng[0] is not None and 6.4 < rng[0] < rng[1] < 6.8, str(rng))
    inside, after = (rng[0] + rng[1]) / 2, rng[1] + 0.03
    pg.evaluate('() => window.__factory.hold(true)')
    drops = lambda: pg.evaluate("() => document.getElementById('drops').getAttribute('d') || ''")
    for rep in range(2):
        pg.evaluate('(u) => window.__factory.seek(u)', inside)
        tick(pg, 50)
        check(f'water test #{rep + 1}: drops are drawn', len(drops()) > 100)
        pg.evaluate('(u) => window.__factory.seek(u)', after)
        tick(pg, 50)
        check(f'after the water test #{rep + 1}: drops are cleared', drops() == '', drops()[:40])
    pg.evaluate('() => window.__factory.seek(0.5)')
    tick(pg, 50)
    check('...and they are gone at the start of the tour too', drops() == '')
    pg.evaluate('() => window.__factory.hold(false)')
    pg.context.close()


def test_key_scope(b):
    """Finding 8: shortcuts act only when focus is in the model / controls / route; Page keys are never hijacked; the page scrolls."""
    pg = new_page(b)
    pg.evaluate("() => { window.__dp = []; document.addEventListener('keydown', (e) => window.__dp.push([e.key, e.defaultPrevented])); }")
    dp = lambda key: [d for k, d in pg.evaluate('() => window.__dp') if k == key]
    pg.evaluate('() => document.activeElement && document.activeElement.blur()')
    check('keys: focus is on the page body', pg.evaluate('() => document.activeElement === document.body'))
    pg.keyboard.press('ArrowRight')
    pg.keyboard.press('End')
    pg.keyboard.press('7')
    time.sleep(0.5)
    check('keys: with focus on the body, ArrowRight / End / 7 do nothing to the tour', st(pg)['stage'] == 0 and not st(pg)['seeking'])
    check('keys: ...and are not default-prevented (page keeps its own behaviour)', dp('ArrowRight') == [False] and dp('End') == [False] and dp('7') == [False], str(pg.evaluate('() => window.__dp')))
    box = pg.locator('#fig').bounding_box()
    pg.mouse.click(box['x'] + 6, box['y'] + box['height'] / 2)  # real click on empty figure area
    check('keys: a real click on the figure focuses it', pg.evaluate('() => document.activeElement.id') == 'fig', pg.evaluate('() => document.activeElement.outerHTML.slice(0, 60)'))
    pg.keyboard.press('Tab')
    pg.keyboard.press('Shift+Tab')
    check('keys: the figure shows a visible focus ring when reached by keyboard',
          pg.evaluate("() => { const o = getComputedStyle(document.activeElement); return document.activeElement.id === 'fig' && o.outlineStyle !== 'none' && parseFloat(o.outlineWidth) >= 2; }"))
    pg.keyboard.press('ArrowRight')
    check('keys: with the figure focused, ArrowRight selects the next stage', until(pg, lambda s: s['stage'] == 1))
    check('keys: ...and that key IS default-prevented', dp('ArrowRight')[-1] is True)
    until(pg, lambda s: not s['seeking'])
    pg.focus('#ctl-next')
    for key in ('PageDown', 'PageUp'):
        pg.keyboard.press(key)
    time.sleep(0.4)
    check('keys: PageUp/PageDown are never handled, even inside the controls', dp('PageDown') == [False] and dp('PageUp') == [False] and st(pg)['stage'] == 1, str(pg.evaluate('() => window.__dp')))
    # Shift+Arrow and Ctrl+Arrow keep browser meanings
    pg.keyboard.press('Shift+ArrowRight')
    time.sleep(0.3)
    check('keys: Shift+Arrow is left alone', st(pg)['stage'] == 1)
    pg.context.close()


def test_phone_offscreen_and_keys(b):
    """Findings 3 and 8 on a real touch phone: the UI follows a tap while the figure is scrolled out of view; Page/arrow keys scroll the page."""
    pg = new_page(b, 390, 844, has_touch=True, is_mobile=True, device_scale_factor=2)
    cap_before = pg.inner_text('#cap-ko')
    pg.evaluate("() => { const r = document.querySelector('#route').getBoundingClientRect(); window.scrollTo(0, window.scrollY + r.top - 8); }")
    check('phone: the figure is now completely scrolled out of view', until(pg, lambda s: not s['figVisible']) and pg.evaluate("() => document.querySelector('#fig').getBoundingClientRect().bottom") <= 0)
    f_before = st(pg)['frames']
    pg.locator('#route li:nth-child(5) .rt').tap()
    check('phone offscreen: tapping the engine route entry selects it and the glide finishes', until(pg, lambda s: s['stage'] == 4 and s['u'] >= 3.999 and not s['seeking'], timeout=90))
    s = st(pg)
    check('phone offscreen: the figure was still offscreen the whole time', not s['figVisible'] and s['frames'] > f_before, str(s))
    for _ in range(40):  # the caption is applied by a real frame
        if '주조' in pg.inner_text('#cap-ko'):
            break
        time.sleep(0.5)
    check('phone offscreen: the caption updated to the engine shop (casting)', '주조' in pg.inner_text('#cap-ko') and pg.inner_text('#cap-ko') != cap_before, pg.inner_text('#cap-ko'))
    check('phone offscreen: the scrubber value follows', abs(float(pg.input_value('#scrub')) - 4000) < 25, pg.input_value('#scrub'))
    check('phone offscreen: the counter says 5 / 7', pg.inner_text('#stage-count').strip().startswith('5 / 7'), pg.inner_text('#stage-count'))
    keys = pg.evaluate("() => [...document.querySelectorAll('#readouts .ro:not([hidden])')].map(r => r.dataset.key)")
    check('phone offscreen: ONLY the engine readout (rpm) is shown, the coil-yard one is gone', keys == ['rpm'], str(keys))
    check('phone offscreen: the card names the engine shop', '엔진 공장' in pg.inner_text('#card-name'))
    # coming back into view: the picture is the engine bay, not a stale plant
    pg.evaluate('() => window.scrollTo(0, 0)')
    check('phone: scrolling back brings the figure back into view', until(pg, lambda s: s['figVisible']))
    check('phone: the engine shop is what the figure shows after scrolling back', pg.evaluate("() => document.querySelector('#plant').dataset.focus") == 'engine')
    check('phone offscreen: no console errors', not pg.logs, str(pg.logs[:3]))

    # --- finding 8 on the phone: Page keys and arrows with focus on the page scroll it and never change the tour
    pg.evaluate("() => { window.__dp = []; document.addEventListener('keydown', (e) => window.__dp.push([e.key, e.defaultPrevented])); document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); }")
    stage_now = st(pg)['stage']
    pg.keyboard.press('PageDown')
    time.sleep(0.8)
    y1 = pg.evaluate('() => window.scrollY')
    pg.keyboard.press('ArrowDown')
    time.sleep(0.5)
    y2 = pg.evaluate('() => window.scrollY')
    dpd = pg.evaluate('() => window.__dp')
    check('phone keys: PageDown scrolls the page', y1 > 50, str(y1))
    check('phone keys: ArrowDown scrolls it further and does not change the tour stage', y2 > y1 and st(pg)['stage'] == stage_now, f'{y1} {y2}')
    check('phone keys: neither key was default-prevented', bool(dpd) and all(not d for _, d in dpd), str(dpd))
    pg.context.close()


def test_csp_hash(b):
    """Finding 11: the CSP hash must be the hash of the script exactly as it is in the output; a changed script must be refused."""
    import base64
    import hashlib
    import tempfile
    html = (ROOT / 'auto-factory.html').read_text(encoding='utf-8')
    scripts = re.findall(r'<script>(.*?)</script>', html, re.S)
    outside = html.replace(scripts[0], '', 1)
    check('csp: exactly one inline script in the output (and no other script tag anywhere)', len(scripts) == 1 and len(re.findall(r'<script\b', outside)) == 1)
    meta = re.search(r'http-equiv="Content-Security-Policy" content="([^"]+)"', html)
    pinned = re.findall(r"'sha256-([A-Za-z0-9+/=]+)'", meta.group(1)) if meta else []
    digest = base64.b64encode(hashlib.sha256(scripts[0].encode('utf-8')).digest()).decode()
    check('csp: script-src pins exactly the hash of the final inline script text', pinned == [digest], f'{pinned} vs {digest}')
    check('csp: the policy has no unsafe-eval and no unsafe-inline for scripts', "unsafe-eval" not in meta.group(1) and not re.search(r"script-src[^;]*unsafe-inline", meta.group(1)))
    tpl = (ROOT / 'template.html').read_text(encoding='utf-8')
    check('csp: template placeholders appear exactly once, script placeholder is the exact one-line form',
          all(tpl.count(p) == 1 for p in ('/*__SCRIPT__*/', '/*__STYLES__*/', '<!--__SCENE__-->', '<!--__CSP__-->')) and '<script>/*__SCRIPT__*/</script>' in tpl, '')
    with tempfile.TemporaryDirectory() as d:
        bad = pathlib.Path(d) / 'tampered.html'
        bad.write_text(html.replace('</script>', ';/*x*/</script>', 1), encoding='utf-8')
        ctx = b.new_context(viewport={'width': 800, 'height': 600})
        pg = ctx.new_page()
        logs = []
        pg.on('console', lambda m: logs.append(m.text))
        pg.goto(bad.as_uri(), timeout=60000)
        time.sleep(1.5)
        check('csp: a script that no longer matches the hash is REFUSED (no factory, CSP error reported)',
              pg.evaluate('() => typeof window.__factory') == 'undefined' and any('Content Security Policy' in t for t in logs), str(logs[:2]))
        ctx.close()


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)

        # ---------------- desktop 1366x800 ----------------
        pg = new_page(b)
        check('page ships a strict CSP', pg.evaluate("() => !!document.querySelector('meta[http-equiv=Content-Security-Policy]')?.content.includes(\"default-src 'none'\")"))
        check('Hangul font is embedded (no network)', pg.evaluate("() => document.fonts.check('700 16px Round', '자동차')"))
        s = st(pg)
        check('starts at stage 1, paused', s['stage'] == 0 and not s['playing'] and s['errors'] == 0, str(s))
        check('title is bilingual', '자동차' in pg.inner_text('.title') and 'car' in pg.inner_text('.title'))
        check('seven route entries', pg.locator('#route .rt').count() == 7)
        check('seven bay chips', pg.locator('#chips .chip').count() == 7)

        # 1. Next / Prev with the real mouse
        click(pg, '#ctl-next')
        check('Next click selects stage 2', until(pg, lambda s: s['stage'] == 1))
        check('...and the view glides to it (u reaches 1)', until(pg, lambda s: s['u'] >= 0.99 and not s['seeking']))
        check('card shows the press shop in both languages', '프레스 공장' in pg.inner_text('#card-name') and 'Press shop' in pg.inner_text('#card-name'))
        check('route marks the current stage', pg.evaluate("() => document.querySelector('#route [aria-current]') !== null"))
        click(pg, '#ctl-prev')
        check('Prev click goes back to stage 1', until(pg, lambda s: s['stage'] == 0 and s['u'] < 0.2))

        # 2. Play / Pause
        u0 = st(pg)['u']
        click(pg, '#ctl-play')
        check('Play starts the tour', until(pg, lambda s: s['playing']))
        check('Play button reports pressed', pg.get_attribute('#ctl-play', 'aria-pressed') == 'true')
        check('time advances while playing', until(pg, lambda s: s['u'] > u0 + 0.15, timeout=40))
        click(pg, '#ctl-play')
        check('Pause stops it', until(pg, lambda s: not s['playing']))
        u1 = st(pg)['u']
        time.sleep(1.0)
        check('...and u holds still', abs(st(pg)['u'] - u1) < 1e-6)

        # 3. choose shops: route list click, chip click, then keyboard
        click(pg, '#route li:nth-child(4) .rt')
        check('route entry 4 selects the paint shop', until(pg, lambda s: s['stage'] == 3))
        check('card names the paint shop', '도장 공장' in pg.inner_text('#card-name') and 'Paint shop' in pg.inner_text('#card-name'))
        until(pg, lambda s: s['u'] >= 3.0 and not s['seeking'])
        pg.evaluate('() => window.__factory.select(5)')
        until(pg, lambda s: s['stage'] == 5 and not s['seeking'])
        until(pg, lambda s: s['u'] >= 5.0 and not s['seeking'])
        # the chip of the selected bay MUST be on screen (no silent skip) and clickable with the real mouse
        check('selected stage chip is visible', pg.evaluate('() => window.__factory.chipVisible(5)'))
        pos = pg.evaluate('() => window.__factory.chipPos(5)')
        figbox = pg.locator('#fig').bounding_box()
        check('selected chip lies fully inside the figure', figbox['x'] <= pos['x'] - pos['w'] / 2 and pos['x'] + pos['w'] / 2 <= figbox['x'] + figbox['width']
              and figbox['y'] <= pos['y'] - pos['h'] / 2 and pos['y'] + pos['h'] / 2 <= figbox['y'] + figbox['height'], f'{pos} {figbox}')
        pg.mouse.click(pos['x'], pos['y'])
        check('clicking the assembly chip in the figure keeps assembly selected', until(pg, lambda s: s['stage'] == 5))
        # a chip of ANOTHER shop, in the whole-plant view, with the real mouse
        click(pg, '#ctl-over')
        until(pg, lambda s: s['overview'])
        picked = None
        for i in (3, 2, 4, 1):
            hit = pg.evaluate("""(i) => { const c = document.querySelectorAll('#chips .chip')[i]; const r = c.getBoundingClientRect();
                const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !c.classList.contains('off') && !!e && c.contains(e); }""", i)
            if hit:
                picked = i
                break
        check('overview: at least one other shop chip is visible and unobstructed', picked is not None)
        if picked is not None:
            pos = pg.evaluate('(i) => window.__factory.chipPos(i)', picked)
            pg.mouse.click(pos['x'], pos['y'])
            check('clicking another shop chip with the mouse selects that shop and leaves the overview', until(pg, lambda s: s['stage'] == picked and not s['overview']))
        click(pg, '#route li:nth-child(2) .rt')
        until(pg, lambda s: s['stage'] == 1)
        pg.focus('#route li:nth-child(1) .rt')
        pg.keyboard.press('ArrowRight')
        check('ArrowRight steps forward', until(pg, lambda s: s['stage'] == 2))
        pg.keyboard.press('ArrowLeft')
        check('ArrowLeft steps back', until(pg, lambda s: s['stage'] <= 2 and s['u'] < 2.5))
        pg.keyboard.press('5')
        check('number key 5 selects the engine shop', until(pg, lambda s: s['stage'] == 4))
        check('engine card is bilingual', '엔진 공장' in pg.inner_text('#card-name') and 'Engine shop' in pg.inner_text('#card-name'))
        pg.keyboard.press('End')
        check('End selects the last stage', until(pg, lambda s: s['stage'] == 6))
        until(pg, lambda s: s['u'] >= 6.0 and not s['seeking'])
        check('Next is disabled on the last stage (real button state)', pg.is_disabled('#ctl-next'))
        n_before = st(pg)['u']
        pg.keyboard.press('ArrowRight')
        time.sleep(0.5)
        check('...and ArrowRight on the last stage does not move anything', st(pg)['stage'] == 6 and abs(st(pg)['u'] - n_before) < 0.5)
        pg.keyboard.press('Home')
        check('Home selects the first', until(pg, lambda s: s['stage'] == 0))
        check('Prev is disabled on the very first stage', until(pg, lambda s: s['u'] < 0.02 and not s['seeking']) and pg.is_disabled('#ctl-prev'))

        # Tab reaches real buttons with a visible focus ring; Enter/Space activates them
        pg.focus('#ctl-play')
        pg.keyboard.press('Tab')
        check('Tab moves focus from Play to Next', pg.evaluate("() => document.activeElement.id") == 'ctl-next')
        check('focused control has a visible outline', pg.evaluate("() => getComputedStyle(document.activeElement).outlineStyle !== 'none' && parseFloat(getComputedStyle(document.activeElement).outlineWidth) >= 2"))
        pg.keyboard.press('Shift+Tab')
        check('Shift+Tab goes back to Play', pg.evaluate("() => document.activeElement.id") == 'ctl-play')
        pg.keyboard.press('Tab')
        pg.keyboard.press('Space')
        check('Space activates the focused Next button', until(pg, lambda s: s['stage'] == 1))
        until(pg, lambda s: s['u'] >= 0.99 and not s['seeking'])  # let the glide land: Pause now stops a glide where it stands
        # overview toggle + Esc
        click(pg, '#ctl-over')
        check('overview toggle on', until(pg, lambda s: s['overview']))
        check('overview button reports pressed', pg.get_attribute('#ctl-over', 'aria-pressed') == 'true')
        pg.keyboard.press('Escape')
        check('Esc leaves overview', until(pg, lambda s: not s['overview']))
        # Esc pauses while playing
        click(pg, '#ctl-play')
        until(pg, lambda s: s['playing'])
        pg.keyboard.press('Escape')
        check('Esc pauses playback', until(pg, lambda s: not s['playing']))
        # skip
        stage_before_skip = st(pg)['stage']
        click(pg, '#ctl-skip')
        check('Skip jumps ahead exactly one stage and lands at its start', until(pg, lambda s: s['stage'] == stage_before_skip + 1 and s['u'] >= stage_before_skip + 1 and not s['seeking']), str(st(pg)))
        # scrubber with the keyboard
        pg.focus('#scrub')
        before = st(pg)['u']
        pg.keyboard.press('ArrowRight')
        check('scrubber moves with the arrow key (and the arrow does not also change stage)', until(pg, lambda s: s['u'] > before))
        # restart
        click(pg, '#ctl-restart')
        check('Restart starts again from the coil', until(pg, lambda s: s['u'] < 1 and s['playing']))
        pg.keyboard.press('Escape')

        # 4. every stage's card carries both languages; the model's numbers are true
        ok = True
        for i in range(7):
            pg.evaluate(f'() => window.__factory.seek({i} + 0.5)')
            until(pg, lambda s, i=i: s['stage'] == i)
            ko, en = pg.inner_text('#cap-ko'), pg.inner_text('#cap-en')
            card = pg.inner_text('.card')
            if not (HANGUL.search(ko) and re.search('[A-Za-z]{4}', en) and HANGUL.search(card) and re.search('[A-Za-z]{4}', card)):
                ok = False
                print('   missing a language at stage', i + 1)
        check('captions and cards are bilingual at every stage', ok)
        pg.evaluate('() => window.__factory.seek(2.5)')
        until(pg, lambda s: s['stage'] == 2)
        what_en, what_ko = pg.inner_text('#card-what .en'), pg.inner_text('#card-what .ko')
        check('body shop card explains spot welding as resistance heating under electrode pressure (EN + KO), not "sparks"',
              'electrodes' in what_en and 'resistance' in what_en and 'spark' not in what_en.lower() and '전극' in what_ko and '저항열' in what_ko and '스파크' not in what_ko, what_en[:120])
        pg.evaluate('() => window.__factory.seek(2.05)')
        until(pg, lambda s: s['stage'] == 2)
        cap_en = ''
        for _ in range(100):  # the caption is applied by the next real frame (seconds in software GL)
            cap_en = pg.inner_text('#cap-en')
            if 'electrodes' in cap_en:
                break
            time.sleep(0.5)
        check('first body-shop caption: electrodes squeeze the spot, a current pulse welds it', 'electrodes' in cap_en and 'current' in cap_en and 'spark' not in cap_en.lower(), cap_en)
        m = pg.evaluate('() => [2.05, 2.5, 2.95].map(u => window.__factory.model(u).welds)')
        check('spot-weld counter rises to ~4,500', m[0] < m[1] < m[2] <= 4500 and m[2] > 3500, str(m))
        f = pg.evaluate('() => [3.1, 3.5, 3.95].map(u => window.__factory.model(u).film)')
        check('paint film builds up toward ~105 um', f[0] <= f[1] <= f[2] and 80 <= f[2] <= 120, str(f))
        check('car is hidden in the press shop, present in the body shop', not pg.evaluate('() => window.__factory.model(1.5).car.visible') and pg.evaluate('() => window.__factory.model(2.5).car.visible'))
        check('no horizontal overflow at 1366x800', pg.evaluate('() => document.documentElement.scrollWidth <= innerWidth + 1'))
        check('no page scroll at 1366x800 (app fits)', pg.evaluate('() => document.documentElement.scrollHeight <= innerHeight + 1'))
        check('no external requests (desktop)', not pg.external, str(pg.external))
        check('no console errors/warnings (desktop)', not pg.logs, str(pg.logs[:4]))
        s = st(pg)
        check('render loop healthy (frames, no errors)', s['frames'] > 10 and s['errors'] == 0 and not s['dead'], str(s))
        pg.context.close()

        # ---------------- reduced motion, including a change after load ----------------
        pg = new_page(b)
        check('motion starts full', pg.get_attribute('html', 'data-motion') == 'full')
        pg.emulate_media(reduced_motion='reduce')
        check('reacts to reduced motion after load', until(pg, lambda s: s['reduced']))
        check('note about reduced motion is shown', pg.is_visible('#rm-note'))
        click(pg, '#ctl-play')
        time.sleep(0.6)
        check('Play does not run the animation under reduced motion', not st(pg)['playing'])
        # -- Next / Prev step through the captions (non-vacuous: every step must change the caption or the stage, and the ends disable the buttons)
        caps = pg.evaluate('() => window.__factory.captions')
        check('reduced: Prev is disabled at the very first caption', pg.is_disabled('#ctl-prev') and not pg.is_disabled('#ctl-next'))
        click(pg, '#ctl-over')
        check('reduced: the whole-plant overview can be switched on', until(pg, lambda s: s['overview']))
        click(pg, '#ctl-next')
        pg.evaluate('() => window.__factory.hold(true)')  # captions are applied by a frame; step frames ourselves so each REAL click can be checked
        tick(pg, 50)
        check('reduced: Next leaves the overview', until(pg, lambda s: not s['overview']) and pg.get_attribute('#ctl-over', 'aria-pressed') == 'false')
        u_b = st(pg)['u']
        check('reduced: the first Next moves to the SECOND caption (never a silent no-op)', abs(u_b - caps[1]) < 1e-6, f'{u_b} vs {caps}')
        seen, clicks, ko_seen = [u_b], 1, {pg.inner_text('#cap-ko')}
        while not pg.is_disabled('#ctl-next') and clicks < len(caps) + 3:
            click(pg, '#ctl-next')
            tick(pg, 50)
            clicks += 1
            seen.append(st(pg)['u'])
            ko_seen.add(pg.inner_text('#cap-ko'))
        check('reduced: Next walks every caption in order and is DISABLED at the last one',
              pg.is_disabled('#ctl-next') and clicks == len(caps) - 1 and all(b > a for a, b in zip(seen, seen[1:])) and abs(st(pg)['u'] - caps[-1]) < 1e-6,
              f'clicks={clicks} of {len(caps)} u={st(pg)["u"]} last={caps[-1]}')
        check('reduced: the last caption belongs to the last stage (shipping)', st(pg)['stage'] == 6 and not st(pg)['seeking'])
        check('reduced: every step showed a different caption text', len(ko_seen) == len(caps) - 1, f'{len(ko_seen)} of {len(caps) - 1}')
        pg.focus('#ctl-over')
        pg.keyboard.press('ArrowRight')
        time.sleep(0.4)
        check('reduced: ArrowRight at the last caption stays put and says so', abs(st(pg)['u'] - caps[-1]) < 1e-6 and 'last' in pg.inner_text('#status').lower())
        clicks = 0
        while not pg.is_disabled('#ctl-prev') and clicks < len(caps) + 3:
            click(pg, '#ctl-prev')
            clicks += 1
        check('reduced: Prev walks back to the first caption and is disabled there', pg.is_disabled('#ctl-prev') and clicks == len(caps) - 1 and abs(st(pg)['u'] - caps[0]) < 1e-6, f'clicks={clicks} u={st(pg)["u"]}')
        pg.evaluate('() => window.__factory.hold(false)')
        click(pg, '#route li:nth-child(3) .rt')
        check('route selection works and lands immediately', until(pg, lambda s: s['stage'] == 2 and s['u'] >= 2.0 and not s['seeking']))
        pg.emulate_media(reduced_motion='no-preference')
        check('reacts when reduced motion is switched off again', until(pg, lambda s: not s['reduced']))
        click(pg, '#ctl-play')
        check('Play works again', until(pg, lambda s: s['playing']))
        pg.context.close()

        # ---------------- 1024x600 ----------------
        pg = new_page(b, 1024, 600)
        check('1024x600: no horizontal overflow', pg.evaluate('() => document.documentElement.scrollWidth <= innerWidth + 1'))
        for sel in ('#ctl-prev', '#ctl-play', '#ctl-next', '#ctl-over', '#route li:nth-child(1) .rt', '#route li:nth-child(7) .rt', '#cap'):
            inside = pg.evaluate("(s) => { const r = document.querySelector(s).getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1; }", sel)
            check(f'1024x600: {sel} fully on screen', inside)
        fig = pg.evaluate("() => { const r = document.querySelector('#fig').getBoundingClientRect(); return r.height; }")
        check('1024x600: figure keeps usable height', fig >= 270, str(fig))
        # the scrubber is part of the compact layout (it used to be hidden here): visible, on screen, reachable by Tab, works with arrow keys
        sb = pg.evaluate("() => { const e = document.querySelector('#scrub'); const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return {w: r.width, h: r.height, l: r.left, r: r.right, t: r.top, b: r.bottom, vis: cs.visibility, disp: cs.display, labelled: !!(e.getAttribute('aria-label') || document.querySelector('label[for=scrub]'))}; }")
        check('1024x600: the progress scrubber is visible and fully on screen', sb['disp'] != 'none' and sb['vis'] == 'visible' and sb['w'] > 150 and sb['h'] >= 16 and sb['l'] >= 0 and sb['r'] <= 1025 and sb['t'] >= 0 and sb['b'] <= 601, str(sb))
        check('1024x600: the scrubber has an accessible name', sb['labelled'])
        pg.focus('#ctl-next')
        reached = False
        for _ in range(12):
            pg.keyboard.press('Tab')
            if pg.evaluate('() => document.activeElement.id') == 'scrub':
                reached = True
                break
        check('1024x600: Tab reaches the scrubber', reached)
        if reached:
            before = st(pg)['u']
            for _ in range(5):
                pg.keyboard.press('ArrowRight')
            check('1024x600: ArrowRight on the scrubber moves the tour (and does not jump stage)', until(pg, lambda s: s['u'] > before + 0.003) and st(pg)['stage'] == int(before))
        click(pg, '#route li:nth-child(6) .rt')
        check('1024x600: route click works', until(pg, lambda s: s['stage'] == 5))
        check('1024x600: no console errors', not pg.logs, str(pg.logs[:3]))
        pg.context.close()

        # ---------------- phone 390x844 portrait ----------------
        pg = new_page(b, 390, 844, has_touch=True, is_mobile=True, device_scale_factor=2)
        check('phone: no horizontal overflow', pg.evaluate('() => document.documentElement.scrollWidth <= innerWidth + 1'), str(pg.evaluate('() => [document.documentElement.scrollWidth, innerWidth]')))
        for sel in ('#ctl-prev', '#ctl-play', '#ctl-next', '#ctl-skip', '#ctl-restart', '#ctl-over'):
            r = pg.evaluate("(s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left, r.right, r.top, r.bottom, r.width, r.height]; }", sel)
            check(f'phone: {sel} reachable (on screen, >= 44px tall)', r[0] >= 0 and r[1] <= 391 and r[3] <= 845 and r[2] >= 0 and r[5] >= 44 and r[4] >= 44, str(r))
        pg.tap('#ctl-next')
        check('phone: tapping Next works', until(pg, lambda s: s['stage'] == 1))
        pg.locator('#route li:nth-child(5) .rt').scroll_into_view_if_needed()
        pg.locator('#route li:nth-child(5) .rt').tap()
        check('phone: a far route entry can be reached and tapped', until(pg, lambda s: s['stage'] == 4))
        check('phone: figure is tall enough to read', pg.evaluate("() => document.querySelector('#fig').getBoundingClientRect().height") >= 230)
        small = pg.evaluate("""() => [...document.querySelectorAll('button')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && (r.width < 40 || r.height < 40); }).map(b => b.className + ':' + b.getBoundingClientRect().width.toFixed(0) + 'x' + b.getBoundingClientRect().height.toFixed(0))""")
        check('phone: no visible control under 40px', not [x for x in small if not x.startswith('chip')], str(small))
        pg.evaluate('() => window.__factory.seek(5.5)')
        until(pg, lambda s: s['stage'] == 5)
        check('phone: still no horizontal overflow at stage 6', pg.evaluate('() => document.documentElement.scrollWidth <= innerWidth + 1'))
        check('phone: no console errors', not pg.logs, str(pg.logs[:3]))
        check('phone: no external requests', not pg.external, str(pg.external))
        pg.context.close()
        test_phone_offscreen_and_keys(b)


        # ---------------- the REAL CSP page ----------------
        pg = new_page(b, csp=True)
        pg.evaluate("() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); }")
        check('CSP page: script ran under its hash (factory exists)', pg.evaluate('() => !!window.__factory'))
        click(pg, '#ctl-next')
        check('CSP page: Next works', until(pg, lambda s: s['stage'] == 1))
        click(pg, '#ctl-play')
        check('CSP page: Play works', until(pg, lambda s: s['playing']))
        click(pg, '#ctl-play')
        click(pg, '#route li:nth-child(4) .rt')
        check('CSP page: route works', until(pg, lambda s: s['stage'] == 3))
        until(pg, lambda s: s['u'] >= 3.5, timeout=30)
        viol = pg.evaluate('() => window.__csp')
        check('CSP page: no CSP violations', not viol, str(viol))
        check('CSP page: no console errors', not [l for l in pg.logs], str(pg.logs[:3]))
        check('CSP page: no external requests', not pg.external, str(pg.external))
        pg.context.close()

        # ---------------- the review-finding tests (deterministic: hold()/tick() step the frame loop; real input where it matters) ----------------
        test_pause_freezes_everything(b)
        test_pause_mid_glide(b)
        test_motion_change_mid_seek(b)
        test_uncapped_clock(b)
        test_drops_clear(b)
        test_key_scope(b)
        test_csp_hash(b)
        b.close()
    print('\n%d failure(s)' % len(FAILS) if FAILS else '\nall functional checks passed')
    sys.exit(1 if FAILS else 0)


if __name__ == '__main__':
    main()
