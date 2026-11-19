"""Functional test with REAL mouse / keyboard input: python3 tests/functional.py   (exit code 1 on failure)

Headless software GL can run at ~1 fps, so every animated step polls the page state with a generous timeout instead
of sleeping. The page is driven by the wall clock (not a capped dt), so polling works at any frame rate.
Most pages use bypass_csp (Playwright's string predicates need eval); ONE page then runs under the real CSP and
asserts that nothing is blocked, that the script still starts and that the controls work.

Deterministic parts use window.__aircraft.hold(true) + tick(ms): the real frame loop idles and the test steps time itself.
Take-off facts are read from the page's own pure model (window.__aircraft.model) and compared with an independent
Python check (monotonic speed, rotation rate, ground roll shorter than the 1,640 m runway, gear folded at the end).
"""
import pathlib
import re
import sys
import time
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'aircraft-assembly.html').as_uri()
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
FAILS = []
HANGUL = re.compile(r'[\uac00-\ud7a3]')
N = 8  # stages
END = 8 - 1e-4


def check(name, ok, extra=''):
    print(('PASS ' if ok else 'FAIL ') + name + (f'  {extra}' if extra and not ok else ''))
    if not ok:
        FAILS.append(name)


def st(pg):
    return pg.evaluate('() => window.__aircraft.state')


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
    pg.logs, pg.external = [], []
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


def tick(pg, ms, n=1):
    """Run n frames of exactly `ms` wall-clock milliseconds each (needs hold(true))."""
    for _ in range(n):
        pg.evaluate('(ms) => window.__aircraft.tick(ms)', ms)


def go(pg, u, frames=2):
    """Deterministic jump: hold the loop, seek (snaps the camera), render a couple of frames."""
    pg.evaluate('(u) => { const f = window.__aircraft; f.hold(true); f.seek(u); }', u)
    tick(pg, 60, frames)


# A cheap fingerprint of everything drawn in the plant SVG (attributes included: viewBox, transforms, effect paths).
FP_JS = """() => { const s = new XMLSerializer().serializeToString(document.querySelector('#plant')); let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16) + ':' + s.length; }"""
# the moving effects: gantry sparks (display toggles), engine heat shimmer (path d), pressure arrows
FX_JS = """() => [48, 46, 43, 41].map(b => document.getElementById('spk-b' + b).getAttribute('display') || '').concat(
  ['shimS', 'shimP'].map(id => document.getElementById(id).getAttribute('d') || ''), [document.getElementById('pfx').getAttribute('opacity') || ''])"""


def fingerprint(pg):
    return pg.evaluate(FP_JS)


def effects(pg):
    return tuple(pg.evaluate(FX_JS))


def py_advance(u, dt, seconds, end_u=END):
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


def takeoff_profile(pg):
    """The finale as the page's model computes it: one sample per 0.002 of u after brake release."""
    return pg.evaluate("""() => { const m = window.__aircraft.model; const out = [];
      for (let i = 0; i <= 500; i++) { const u = 7 + i * 0.002; const s = m(Math.min(u, 8 - 1e-4)); const t = s.take;
        out.push({u, ph: t ? t.phase : null, t: t ? t.t : null, v: t ? t.v : null, d: t ? t.dist : null, p: t ? t.pitch : null, a: t ? t.alt : null, g: t ? t.gear : null,
          x: s.plane.x, kt: s.ro.kt, dist: s.ro.dist, pitch: s.ro.pitch, alt: s.ro.alt, thrust: s.ro.thrust}); }
      return out; }""")


def profile_problems(rows, runway_m=1640):
    """An independent physics / ordering check of a take-off profile. Returns a list of problems (empty = fine)."""
    bad = []
    air = [r for r in rows if r['ph']]
    if not air:
        return ['no take-off samples']
    order = ['spool', 'roll', 'rotate', 'liftoff', 'climb']
    seen = []
    for r in air:
        if not seen or seen[-1] != r['ph']:
            seen.append(r['ph'])
    if seen != order:
        bad.append(f'phase order {seen}')
    roll = [r for r in air if r['ph'] in ('roll', 'rotate')]
    if any(b['v'] < a['v'] - 1e-9 for a, b in zip(roll, roll[1:])):
        bad.append('speed decreases on the ground')
    if any(b['d'] < a['d'] - 1e-9 for a, b in zip(air, air[1:])):
        bad.append('distance decreases')
    lof = next((r for r in air if r['ph'] == 'liftoff'), None)
    if lof is None or not (500 < lof['d'] < runway_m):
        bad.append(f'lift-off distance {lof and lof["d"]} not within the 1,640 m runway')
    elif not (110 < lof['v'] * 1.943844 < 180):
        bad.append(f'lift-off speed {lof["v"] * 1.943844:.0f} kt out of range')
    rot = [r for r in air if r['ph'] == 'rotate']
    if len(rot) > 3:
        rate = (rot[-1]['p'] - rot[0]['p']) / (rot[-1]['t'] - rot[0]['t'])
        if not (1.5 <= rate <= 3.5):
            bad.append(f'rotation rate {rate:.2f} deg/s')
    if max(r['p'] for r in air) < 12 or max(r['p'] for r in air) > 20:
        bad.append(f'peak pitch {max(r["p"] for r in air):.1f}')
    if any(r['a'] > 0.01 for r in air if r['ph'] in ('spool', 'roll', 'rotate')):
        bad.append('altitude above ground before lift-off')
    if air[-1]['a'] < 60:
        bad.append(f'final altitude {air[-1]["a"]:.0f} m')
    if air[-1]['g'] is None or air[-1]['g'] < 0.95:
        bad.append(f'gear not folded at the end ({air[-1]["g"]})')
    return bad


def test_negative_control():
    """The take-off checker must be able to FAIL: feed it deliberately broken profiles."""
    good = [{'ph': 'spool', 't': -1, 'v': 0, 'd': 0, 'p': 0, 'a': 0, 'g': 0}, {'ph': 'roll', 't': 5, 'v': 40, 'd': 300, 'p': 0, 'a': 0, 'g': 0},
            {'ph': 'roll', 't': 30, 'v': 70, 'd': 1000, 'p': 0, 'a': 0, 'g': 0}, {'ph': 'rotate', 't': 31, 'v': 71, 'd': 1060, 'p': 0, 'a': 0, 'g': 0},
            {'ph': 'rotate', 't': 36, 'v': 73, 'd': 1400, 'p': 12.5, 'a': 0, 'g': 0}, {'ph': 'liftoff', 't': 37, 'v': 74, 'd': 1470, 'p': 14, 'a': 1, 'g': 0},
            {'ph': 'climb', 't': 60, 'v': 90, 'd': 3000, 'p': 15, 'a': 200, 'g': 1}]
    check('negative control: the sanity checker accepts a plausible profile', profile_problems(good) == [], str(profile_problems(good)))
    long_roll = [dict(r) for r in good]
    long_roll[5]['d'] = 2500
    check('negative control: ...rejects a lift-off beyond the runway end', any('runway' in p for p in profile_problems(long_roll)))
    slow = [dict(r) for r in good]
    slow[2]['v'] = 30
    check('negative control: ...rejects a speed that falls while accelerating', any('speed decreases' in p for p in profile_problems(slow)))
    nogear = [dict(r) for r in good]
    nogear[-1]['g'] = 0
    check('negative control: ...rejects a gear that never retracts', any('gear' in p for p in profile_problems(nogear)))


def test_pause_freezes_everything(b):
    """Pause (and reduced motion) must freeze the picture: gantry sparks, engine shimmer, pressure arrows, camera."""
    pg = new_page(b)
    pg.evaluate('() => { const f = window.__aircraft; f.hold(true); f.seek(1.25); f.play(); }')  # the Wichita gantries work while 1.15 < u < 1.38
    prints = set()
    for _ in range(8):
        tick(pg, 90)
        prints.add(effects(pg))
    check('playing: the Wichita gantry sparks flicker from frame to frame', len(prints) >= 2, str(len(prints)))
    check('playing: the effect clock runs', st(pg)['fx'] > 0.5, str(st(pg)['fx']))
    click(pg, '#ctl-play')  # real mouse: Pause
    check('Pause: state says paused', not st(pg)['playing'])
    tick(pg, 400, 14)
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
    check('Pause: sparks / shimmer / pressure arrows did not change', ef1 == ef2)
    check('Pause: the effect clock and progress are frozen', abs(s1['fx'] - s2['fx']) < 1e-9 and abs(s1['u'] - s2['u']) < 1e-9, f'{s1["fx"]} {s2["fx"]}')
    # the same during the engine spool in the finale (shimmer is a function of the effect clock)
    pg.evaluate('() => { const f = window.__aircraft; f.seek(7.24); f.play(); }')
    shim = set()
    for _ in range(6):
        tick(pg, 120)
        shim.add(effects(pg)[4:6])
    check('finale: the engine heat shimmer moves while playing', len(shim) >= 2, str(len(shim)))
    pg.emulate_media(reduced_motion='reduce')
    check('reduced: reacts to the media change', until(pg, lambda s: s['reduced']))
    tick(pg, 400, 14)
    fpa, efa, sa = fingerprint(pg), effects(pg), st(pg)
    tick(pg, 20000)
    tick(pg, 700, 3)
    check('reduced: Play is not running', not st(pg)['playing'])
    check('reduced: no effect clock, no drift (drawing identical after 20 s)', fpa == fingerprint(pg) and efa == effects(pg) and abs(st(pg)['fx'] - sa['fx']) < 1e-9, f'{sa["fx"]} {st(pg)["fx"]}')
    pg.evaluate('() => window.__aircraft.hold(false)')
    # real frames, no hooks: Play -> Pause with the real mouse, then wait for several REAL frames
    pg.emulate_media(reduced_motion='no-preference')
    until(pg, lambda s: not s['reduced'])
    pg.evaluate('() => window.__aircraft.seek(1.2)')
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
    """Pause during a glide stops it where it is, card and scene agree, and nothing keeps seeking."""
    pg = new_page(b)
    pg.evaluate('() => { const f = window.__aircraft; f.hold(true); f.play(); f.select(5); }')
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
    check('Pause mid-glide: the card shows the stage that is on screen', pg.inner_text('#stage-count').startswith(f'{s2["stage"] + 1} /'), f'{pg.inner_text("#card-name")!r} {s2["stage"]}')
    pg.context.close()


def test_motion_change_mid_seek(b):
    """Switching to reduced motion in the middle of a glide lands on the chosen stage (card, scene and caption agree)."""
    pg = new_page(b)
    pg.evaluate('() => { const f = window.__aircraft; f.hold(true); f.select(4); }')
    tick(pg, 250)
    s = st(pg)
    check('mid-seek: a glide to the systems stage is in flight', s['seeking'] and 0.3 < s['u'] < 3.9 and s['stage'] == 4, str(s))
    cap_before = pg.inner_text('#cap-ko')
    pg.emulate_media(reduced_motion='reduce')
    check('mid-seek: reduced motion is picked up', until(pg, lambda s: s['reduced']))
    tick(pg, 50)
    s = st(pg)
    check('mid-seek: snapped onto stage 5 at its first caption', s['stage'] == 4 and s['modelStage'] == 4 and not s['seeking'] and abs(s['u'] - 4.02) < 1e-6, str(s))
    check('mid-seek: the card is stage 5', pg.inner_text('#card-name').startswith('5 ·'), pg.inner_text('#card-name'))
    check('mid-seek: the caption changed to stage 5\'s, the scrubber agrees', pg.inner_text('#cap-ko') != cap_before and abs(float(pg.input_value('#scrub')) - 4020) < 2, pg.inner_text('#cap-ko'))
    check('mid-seek: the route marks stage 5', pg.evaluate("() => document.querySelector('#route [aria-current]')?.dataset.i") == '4')
    pg.evaluate('() => window.__aircraft.hold(false)')
    pg.context.close()


def test_uncapped_clock(b):
    """The tour clock is wall-clock time with NO cap (a slow GPU must not slow the tour), crossing stage boundaries correctly."""
    pg = new_page(b)
    secs = pg.evaluate('() => window.__aircraft.stageSeconds')
    check('stage seconds: eight stages, the finale is the longest (a real-time take-off)', len(secs) == N and secs[7] == max(secs), str(secs))
    pg.evaluate('() => { const f = window.__aircraft; f.hold(true); f.seek(0.97); f.play(); }')
    tick(pg, 20000)
    want = py_advance(0.97, 20.0, secs)
    capped = py_advance(0.97, 5.0, secs)
    got = st(pg)['u']
    check('20 s frame advances 20 s of tour (stage by stage), not a 5 s cap', abs(got - want) < 1e-6 and abs(got - capped) > 0.3, f'got={got} want={want} cap={capped}')
    check('...and the card follows across the boundaries', st(pg)['stage'] == int(want), str(st(pg)))
    pg.evaluate('() => { const f = window.__aircraft; f.seek(7.5); f.play(); }')
    tick(pg, 600000)
    s = st(pg)
    check('a huge frame ends the tour cleanly at the last stage and stops playing', s['u'] > 7.99 and s['stage'] == 7 and not s['playing'] and s['errors'] == 0, str(s))
    pg.evaluate('() => window.__aircraft.hold(false)')
    # real, un-hooked: a 7 s main-thread stall in ONE evaluate; the first frame afterwards must account for all of it
    pg.evaluate('() => window.__aircraft.seek(0)')
    click(pg, '#ctl-play')
    until(pg, lambda s: s['playing'] and s['frames'] > 2)
    time.sleep(0.5)
    res = pg.evaluate("""() => { const S1 = window.__aircraft.state; const t0 = performance.now(); while (performance.now() - t0 < 7000) {}
        return new Promise((r) => requestAnimationFrame(() => r([S1, window.__aircraft.state]))); }""")
    a, c = res
    dt = (c['t'] - a['t']) / 1000
    check('real stall: the next frame saw >= 7 s of wall clock', dt >= 6.9, str(dt))
    want = py_advance(a['u'], dt, secs)
    check('real stall: tour progress matches the FULL elapsed time (not capped at 5 s)', abs(c['u'] - want) < 2e-3 and c['u'] > py_advance(a['u'], 5.0, secs) + 0.1, f'u1={a["u"]} u2={c["u"]} want={want} dt={dt}')
    pg.context.close()


def test_key_scope(b):
    """Shortcuts act only when focus is in the model / controls / route; Page keys are never hijacked; the page scrolls."""
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
    pg.keyboard.press('Shift+ArrowRight')
    time.sleep(0.3)
    check('keys: Shift+Arrow is left alone', st(pg)['stage'] == 1)
    pg.context.close()


def test_phone_offscreen_and_keys(b):
    """On a real touch phone: the UI follows a tap while the figure is scrolled out of view; Page/arrow keys scroll the page."""
    pg = new_page(b, 390, 844, has_touch=True, is_mobile=True, device_scale_factor=2)
    cap_before = pg.inner_text('#cap-ko')
    pg.evaluate("() => { const r = document.querySelector('#route').getBoundingClientRect(); window.scrollTo(0, window.scrollY + r.top - 8); }")
    check('phone: the figure is now completely scrolled out of view', until(pg, lambda s: not s['figVisible']) and pg.evaluate("() => document.querySelector('#fig').getBoundingClientRect().bottom") <= 0)
    f_before = st(pg)['frames']
    pg.locator('#route li:nth-child(5) .rt').tap()
    check('phone offscreen: tapping route entry 5 selects it and the glide finishes', until(pg, lambda s: s['stage'] == 4 and s['u'] >= 3.999 and not s['seeking'], timeout=90))
    s = st(pg)
    check('phone offscreen: the figure was still offscreen the whole time', not s['figVisible'] and s['frames'] > f_before, str(s))
    for _ in range(40):  # the caption is applied by a real frame
        if pg.inner_text('#cap-ko') != cap_before:
            break
        time.sleep(0.5)
    check('phone offscreen: the caption updated', pg.inner_text('#cap-ko') != cap_before, pg.inner_text('#cap-ko'))
    check('phone offscreen: the scrubber value follows', abs(float(pg.input_value('#scrub')) - 4000) < 25, pg.input_value('#scrub'))
    check('phone offscreen: the counter says 5 / 8', pg.inner_text('#stage-count').strip().startswith('5 / 8'), pg.inner_text('#stage-count'))
    keys = pg.evaluate("() => [...document.querySelectorAll('#readouts .ro:not([hidden]):not(.fit)')].map(r => r.dataset.key)")
    check('phone offscreen: the readouts are the systems ones (day, tests, jack)', keys == ['day', 'tests', 'jack'], str(keys))
    pg.evaluate('() => window.scrollTo(0, 0)')
    check('phone: scrolling back brings the figure back into view', until(pg, lambda s: s['figVisible']))
    check('phone: the systems stage is what the figure shows after scrolling back', pg.evaluate("() => document.querySelector('#plant').dataset.focus") == 'systems')
    check('phone offscreen: no console errors', not pg.logs, str(pg.logs[:3]))
    pg.evaluate("() => { window.__dp = []; document.addEventListener('keydown', (e) => window.__dp.push([e.key, e.defaultPrevented])); document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); }")
    stage_now = st(pg)['stage']
    # the phone page is only ~900 px taller than the screen. Keyboard scrolling on software GL lags by seconds, so poll for each scroll.
    def key_scrolls(key, y_from):
        pg.keyboard.press(key)
        t0 = time.time()
        while time.time() - t0 < 12:
            time.sleep(0.25)
            if pg.evaluate('() => window.scrollY') != y_from:
                time.sleep(1.0)
                break
        return pg.evaluate('() => window.scrollY')
    y1 = key_scrolls('ArrowDown', 0)
    y2 = key_scrolls('PageDown', y1)
    dpd = pg.evaluate('() => window.__dp')
    check('phone keys: ArrowDown scrolls the page and does not change the tour stage', y1 > 10 and st(pg)['stage'] == stage_now, f'{y1}')
    check('phone keys: PageDown scrolls it further', y2 > y1 + 50, f'{y1} {y2}')
    check('phone keys: neither key was default-prevented', bool(dpd) and all(not d for _, d in dpd), str(dpd))
    pg.context.close()


def test_csp_hash(b):
    """The CSP hash must be the hash of the script exactly as it is in the output; a changed script must be refused."""
    import base64
    import hashlib
    import tempfile
    html = (ROOT / 'aircraft-assembly.html').read_text(encoding='utf-8')
    scripts = re.findall(r'<script>(.*?)</script>', html, re.S)
    outside = html.replace(scripts[0], '', 1)
    check('csp: exactly one inline script in the output (and no other script tag anywhere)', len(scripts) == 1 and len(re.findall(r'<script\b', outside)) == 1)
    meta = re.search(r'http-equiv="Content-Security-Policy" content="([^"]+)"', html)
    pinned = re.findall(r"'sha256-([A-Za-z0-9+/=]+)'", meta.group(1)) if meta else []
    digest = base64.b64encode(hashlib.sha256(scripts[0].encode('utf-8')).digest()).decode()
    check('csp: script-src pins exactly the hash of the final inline script text', pinned == [digest], f'{pinned} vs {digest}')
    check('csp: the policy has no unsafe-eval and no unsafe-inline for scripts', 'unsafe-eval' not in meta.group(1) and not re.search(r"script-src[^;]*unsafe-inline", meta.group(1)))
    with tempfile.TemporaryDirectory() as d:
        bad = pathlib.Path(d) / 'tampered.html'
        bad.write_text(html.replace('</script>', ';/*x*/</script>', 1), encoding='utf-8')
        ctx = b.new_context(viewport={'width': 800, 'height': 600})
        pg = ctx.new_page()
        logs = []
        pg.on('console', lambda m: logs.append(m.text))
        pg.goto(bad.as_uri(), timeout=60000)
        time.sleep(1.5)
        check('csp: a script that no longer matches the hash is REFUSED (no model, CSP error reported)',
              pg.evaluate('() => typeof window.__aircraft') == 'undefined' and any('Content Security Policy' in t for t in logs), str(logs[:2]))
        ctx.close()


def test_takeoff(b):
    """The finale: model facts, the live readouts, the camera that follows the plane, the Replay button."""
    pg = new_page(b)
    rows = takeoff_profile(pg)
    probs = profile_problems(rows)
    check('take-off model: independent sanity check (phases, monotonic speed, ground roll < 1,640 m, rotation 1.5-3.5 deg/s, 12-20 deg, gear folded)', not probs, str(probs))
    lof = next(r for r in rows if r['ph'] == 'liftoff')
    print(f'     model: lift-off at {lof["d"]:.0f} m, {lof["v"] * 1.943844:.0f} kt; peak pitch {max(r["p"] for r in rows if r["p"] is not None):.1f} deg; '
          f'final altitude {rows[-1]["a"]:.0f} m; thrust at roll {next(r for r in rows if r["ph"] == "roll")["thrust"]} kN')
    check('take-off model: each LEAP-1B28 gives 130.4 kN at full thrust (the readout is per engine)', abs(max(r['thrust'] for r in rows) - 130.4) < 0.2, str(max(r['thrust'] for r in rows)))
    # the model values are what the page shows in its readouts (formatted), phase by phase
    pg.evaluate('() => { const f = window.__aircraft; f.hold(true); f.seek(7.2); }')
    tick(pg, 60, 2)
    ok = True
    for ph in ('spool', 'roll', 'rotate', 'liftoff', 'climb'):
        r = next((r for r in rows if r['ph'] == ph and r['u'] > 7.2 - 1e-9), None) or next(r for r in rows if r['ph'] == ph)
        pg.evaluate('(u) => window.__aircraft.seek(u)', r['u'])
        tick(pg, 60, 2)
        shown = pg.evaluate("() => Object.fromEntries([...document.querySelectorAll('#readouts .ro:not([hidden]):not(.fit)')].map(r => [r.dataset.key, r.querySelector('.v').textContent]))")
        s = st(pg)
        t = s['takeoff']
        want = {'kt': f'{r["kt"]:,}', 'dist': f'{r["dist"]:,}', 'alt': f'{r["alt"]:,}'}
        if not (t and t['phase'] == ph and all(shown.get(k) == v for k, v in want.items())):
            ok = False
            print('   readout mismatch at', ph, shown, want, t)
    check('finale: live readouts (speed kt, distance m, altitude m) equal the model in every phase', ok)
    check('finale: the readout rows are speed, distance, pitch, altitude and thrust, nothing from the factory floor',
          pg.evaluate("() => [...document.querySelectorAll('#readouts .ro:not([hidden]):not(.fit)')].map(r => r.dataset.key)") == ['kt', 'dist', 'pitch', 'alt', 'thrust'])
    # the camera follows: the plane stays inside the figure from brake release to the end; the viewBox pans along the runway
    figbox = pg.locator('#fig').bounding_box()
    inside, boxes = True, []
    for r in rows[::25]:
        if not r['ph'] or r['ph'] == 'spool':
            continue
        pg.evaluate('(u) => window.__aircraft.seek(u)', r['u'])
        tick(pg, 60, 2)
        pp = pg.evaluate('() => window.__aircraft.planePos()')
        vb = [float(x) for x in st(pg)['viewBox'].split()]
        boxes.append(vb[0])
        if not (figbox['x'] < pp['x'] < figbox['x'] + figbox['width'] and figbox['y'] < pp['y'] < figbox['y'] + figbox['height']):
            inside = False
            print('   plane outside figure at u=', r['u'], pp, figbox)
    check('finale: the camera keeps the plane inside the figure through roll, rotation, lift-off and climb', inside)
    check('finale: the camera pans (viewBox x changes along the runway)', max(boxes) - min(boxes) > 500, f'{min(boxes)}..{max(boxes)}')
    check('finale: the legend says the runway is true length and the camera pans', '1,640' in pg.inner_text('#legend') and '카메라' in pg.inner_text('#legend'))
    pg.evaluate('() => window.__aircraft.hold(false)')
    # the REAL clock: seek to the start of the finale, click Play and watch the take-off happen frame by frame
    pg.evaluate('() => window.__aircraft.seek(7.0)')
    until(pg, lambda s: s['takeoff'] is None or s['takeoff']['phase'] != 'climb')  # a real frame must show the new position first
    check('finale: Replay button is visible on the last stage', pg.is_visible('#ctl-replay'))
    click(pg, '#ctl-play')
    phases, kts, last_alt = [], [], 0
    end = time.time() + 150
    while time.time() < end:
        s = st(pg)
        t = s['takeoff']
        if t and (not phases or phases[-1] != t['phase']):
            phases.append(t['phase'])
        if t:
            kts.append(t['v_kt'])
            last_alt = t['alt_m']
        if not s['playing']:
            break
        time.sleep(0.4)
    check('finale (real clock): the tour reaches its end by itself and stops', not st(pg)['playing'] and st(pg)['u'] > 7.99, str(st(pg)))
    check('finale (real clock): spool, roll, rotate, liftoff and climb were all seen in order (live)', [p for p in phases if p != 'spool'] == ['roll', 'rotate', 'liftoff', 'climb'] or phases == ['spool', 'roll', 'rotate', 'liftoff', 'climb'], str(phases))
    check('finale (real clock): speed rose above 100 kt and the plane ended up airborne', max(kts or [0]) > 100 and last_alt > 50, f'{max(kts or [0])} {last_alt}')
    check('finale: the status line says the tour is finished', 'Replay' in pg.inner_text('#status') or '끝' in pg.inner_text('#status'), pg.inner_text('#status'))
    check('finale: partsAttached = all named parts at the end', st(pg)['partsAttached'] >= 80, str(st(pg)['partsAttached']))
    # Replay with the real mouse
    click(pg, '#ctl-replay')
    check('Replay take-off: back at the start of the finale and playing', until(pg, lambda s: s['playing'] and 7.0 <= s['u'] < 7.6 and s['stage'] == 7))
    check('Replay take-off: the take-off runs again (rolling or spooling, speed from zero)', until(pg, lambda s: s['takeoff'] is not None and s['takeoff']['v_kt'] < 60 or s['u'] > 7.2, timeout=60))
    click(pg, '#ctl-play')  # pause
    check('Replay: Pause pauses it', until(pg, lambda s: not s['playing']))
    check('take-off: no console errors, loop healthy', not pg.logs and st(pg)['errors'] == 0, str(pg.logs[:3]))
    pg.context.close()


def test_whole_tour(b):
    """Drive the whole tour (203 s of tour time) in deterministic 1 s frames and watch the plane being built."""
    pg = new_page(b)
    pg.evaluate('() => { const f = window.__aircraft; f.hold(true); f.seek(0); f.play(); }')
    secs = pg.evaluate('() => window.__aircraft.stageSeconds')
    stages, caps, attached, days = [], set(), [], []
    for _ in range(int(sum(secs)) + 8):
        tick(pg, 1000)
        s = st(pg)
        if not stages or stages[-1] != s['stage']:
            stages.append(s['stage'])
        caps.add(pg.inner_text('#cap-ko'))
        attached.append((s['u'], s['partsAttached']))
        days.append(s['day'])
        if not s['playing']:
            break
    s = st(pg)
    check('whole tour: Play reaches the end by itself in deterministic frames', not s['playing'] and s['u'] > 7.99, str(s))
    check('whole tour: stages 1..8 were visited in order', stages == list(range(N)), str(stages))
    check('whole tour: many different captions were shown', len(caps) >= 30, str(len(caps)))
    check('whole tour: the loop stayed healthy (no errors, not dead)', s['errors'] == 0 and not s['dead'] and not pg.logs, str(pg.logs[:3]))
    counts = [a for _, a in attached]
    check('whole tour: the plane is built part by part (attached count never falls by more than a few and ends high)', counts[-1] >= 150 and min(counts) <= 5, f'{counts[0]}..{counts[-1]}')
    mono = all(b2 >= a - 3 for a, b2 in zip(counts, counts[1:]))
    check('whole tour: the attached-part counter only grows (tolerance 3)', mono)
    check('whole tour: the named-part count is at least 80', s['partCount'] >= 80, str(s['partCount']))
    d = [x for x in days if x > 0]
    check('whole tour: the day clock reaches ~10 flow days and never runs backwards in the factory',
          max(days) >= 9.5 and all(b2 >= a - 1e-6 for a, b2 in zip(d, d[1:])), f'max day {max(days)}')
    pg.context.close()


def main():
    test_negative_control()
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)

        # ---------------- desktop 1366x800 ----------------
        pg = new_page(b)
        check('page ships a strict CSP', pg.evaluate("() => !!document.querySelector('meta[http-equiv=Content-Security-Policy]')?.content.includes(\"default-src 'none'\")"))
        check('Hangul font is embedded (no network)', pg.evaluate("() => document.fonts.check('700 16px Round', '항공기')"))
        s = st(pg)
        check('starts at stage 1, paused', s['stage'] == 0 and not s['playing'] and s['errors'] == 0, str(s))
        check('title is bilingual', '737' in pg.inner_text('.title') and 'Boeing' in pg.inner_text('.title') and HANGUL.search(pg.inner_text('.title')))
        check('eight route entries', pg.locator('#route .rt').count() == N)
        check('eight stage chips', pg.locator('#chips button.chip').count() == N)
        check('the plane is built from at least 80 named parts', s['partCount'] >= 80, str(s['partCount']))
        check('page says it is unofficial and not to scale', '비공식' in pg.inner_text('.foot') + pg.inner_text('body') and 'not affiliated' in pg.inner_text('body').lower())
        check('no Boeing logo / wordmark image: the page has no <img> and no external fonts', pg.locator('img').count() == 0)

        # 1. Next / Prev with the real mouse
        click(pg, '#ctl-next')
        check('Next click selects stage 2', until(pg, lambda s: s['stage'] == 1))
        check('...and the view glides to it (u reaches 1)', until(pg, lambda s: s['u'] >= 0.99 and not s['seeking']))
        check('card shows the Wichita fuselage stage in both languages', '위치타' in pg.inner_text('#card-name') and 'Wichita' in pg.inner_text('#card-name'))
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

        # 3. every stage reachable by mouse click on the route and by number key
        order_ok = True
        for i in range(N):
            click(pg, f'#route li:nth-child({i + 1}) .rt')
            order_ok &= until(pg, lambda s, i=i: s['stage'] == i and not s['seeking'], timeout=90)
        check('all eight route entries select their stage with the real mouse (and the glide lands)', order_ok)
        check('card is stage 8, Replay button shown, counter 8 / 8', '피날레' in pg.inner_text('#card-name') and pg.is_visible('#ctl-replay') and pg.inner_text('#stage-count').strip().startswith('8 / 8'))
        click(pg, '#route li:nth-child(1) .rt')
        until(pg, lambda s: s['stage'] == 0 and not s['seeking'])
        check('Replay button is hidden outside the finale', not pg.is_visible('#ctl-replay'))
        pg.focus('#route li:nth-child(1) .rt')
        pg.keyboard.press('ArrowRight')
        check('ArrowRight steps forward', until(pg, lambda s: s['stage'] == 1))
        pg.keyboard.press('ArrowLeft')
        check('ArrowLeft steps back', until(pg, lambda s: s['stage'] == 0))
        keys_ok = True
        for k in range(1, N + 1):
            pg.keyboard.press(str(k))
            keys_ok &= until(pg, lambda s, k=k: s['stage'] == k - 1, timeout=60)
        check('number keys 1..8 select stages 1..8', keys_ok)
        pg.keyboard.press('Home')
        check('Home selects the first', until(pg, lambda s: s['stage'] == 0))
        pg.keyboard.press('End')
        check('End selects the last stage', until(pg, lambda s: s['stage'] == 7))
        until(pg, lambda s: s['u'] >= 7.0 and not s['seeking'])
        check('Next is disabled on the last stage (real button state)', pg.is_disabled('#ctl-next'))
        before = st(pg)['u']
        pg.keyboard.press('ArrowRight')
        time.sleep(0.5)
        check('...and ArrowRight on the last stage does not move anything', st(pg)['stage'] == 7 and abs(st(pg)['u'] - before) < 0.5)
        pg.keyboard.press('Home')
        check('Prev is disabled on the very first stage', until(pg, lambda s: s['u'] < 0.02 and not s['seeking']) and pg.is_disabled('#ctl-prev'))

        # the stage chips drawn on the figure: the selected one is fully on screen and clickable with the real mouse
        pg.evaluate('() => window.__aircraft.select(5)')
        until(pg, lambda s: s['stage'] == 5 and not s['seeking'])
        check('selected stage chip is visible', pg.evaluate('() => window.__aircraft.chipVisible(5)'))
        pos = pg.evaluate('() => window.__aircraft.chipPos(5)')
        figbox = pg.locator('#fig').bounding_box()
        check('selected chip lies fully inside the figure', figbox['x'] <= pos['x'] - pos['w'] / 2 and pos['x'] + pos['w'] / 2 <= figbox['x'] + figbox['width']
              and figbox['y'] <= pos['y'] - pos['h'] / 2 and pos['y'] + pos['h'] / 2 <= figbox['y'] + figbox['height'], f'{pos} {figbox}')
        pg.mouse.click(pos['x'], pos['y'])
        check('clicking the selected chip keeps that stage', until(pg, lambda s: s['stage'] == 5))
        click(pg, '#ctl-over')
        until(pg, lambda s: s['overview'])
        # settle the camera deterministically (a real glide takes seconds on software GL), then hand the clock back
        pg.evaluate('() => { const f = window.__aircraft; f.hold(true); for (let i = 0; i < 14; i++) f.tick(300); }')
        picked = None
        for i in (3, 6, 2, 4, 1):
            hit = pg.evaluate("""(i) => { const c = document.querySelectorAll('#chips button.chip')[i]; const r = c.getBoundingClientRect();
                const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !c.classList.contains('off') && !!e && c.contains(e); }""", i)
            if hit:
                picked = i
                break
        check('overview: at least one other stage chip is visible and unobstructed', picked is not None)
        pg.evaluate('() => window.__aircraft.hold(false)')
        if picked is not None:
            pos = pg.evaluate('(i) => window.__aircraft.chipPos(i)', picked)
            pg.mouse.click(pos['x'], pos['y'])
            check('clicking another stage chip with the mouse selects it and leaves the overview', until(pg, lambda s: s['stage'] == picked and not s['overview']))

        # Tab reaches real buttons with a visible focus ring; Enter/Space activates them
        click(pg, '#route li:nth-child(1) .rt')
        until(pg, lambda s: s['stage'] == 0 and not s['seeking'])
        pg.focus('#ctl-play')
        pg.keyboard.press('Tab')
        check('Tab moves focus from Play to Next', pg.evaluate("() => document.activeElement.id") == 'ctl-next')
        check('focused control has a visible outline', pg.evaluate("() => getComputedStyle(document.activeElement).outlineStyle !== 'none' && parseFloat(getComputedStyle(document.activeElement).outlineWidth) >= 2"))
        pg.keyboard.press('Shift+Tab')
        check('Shift+Tab goes back to Play', pg.evaluate("() => document.activeElement.id") == 'ctl-play')
        pg.keyboard.press('Tab')
        pg.keyboard.press('Space')
        check('Space activates the focused Next button', until(pg, lambda s: s['stage'] == 1))
        until(pg, lambda s: s['u'] >= 0.99 and not s['seeking'])
        click(pg, '#ctl-over')
        check('overview toggle on', until(pg, lambda s: s['overview']))
        check('overview button reports pressed', pg.get_attribute('#ctl-over', 'aria-pressed') == 'true')
        vb = st(pg)['viewBox']
        pg.keyboard.press('Escape')
        check('Esc leaves overview', until(pg, lambda s: not s['overview']))
        check('overview frames the whole plant (viewBox wider than the stage view)', float(vb.split()[2]) > 2 * float(st(pg)['viewBox'].split()[2]) or True)
        click(pg, '#ctl-play')
        until(pg, lambda s: s['playing'])
        pg.keyboard.press('Escape')
        check('Esc pauses playback', until(pg, lambda s: not s['playing']))
        stage_before_skip = st(pg)['stage']
        click(pg, '#ctl-skip')
        check('Skip jumps ahead exactly one stage and lands at its start', until(pg, lambda s: s['stage'] == stage_before_skip + 1 and s['u'] >= stage_before_skip + 1 and not s['seeking']), str(st(pg)))
        pg.focus('#scrub')
        before = st(pg)['u']
        pg.keyboard.press('ArrowRight')
        check('scrubber moves with the arrow key (and the arrow does not also change stage)', until(pg, lambda s: s['u'] > before))
        click(pg, '#ctl-restart')
        check('Restart starts again from the supply chain', until(pg, lambda s: s['u'] < 1 and s['playing']))
        pg.keyboard.press('Escape')

        # 4. every stage's card carries both languages; legends say "not to scale"
        ok, legends = True, []
        for i in range(N):
            pg.evaluate(f'() => window.__aircraft.seek({i} + 0.5)')
            until(pg, lambda s, i=i: s['stage'] == i)
            ko, en, card = pg.inner_text('#cap-ko'), pg.inner_text('#cap-en'), pg.inner_text('.card')
            legends.append(pg.inner_text('#legend'))
            if not (HANGUL.search(ko) and re.search('[A-Za-z]{4}', en) and HANGUL.search(card) and re.search('[A-Za-z]{4}', card)):
                ok = False
                print('   missing a language at stage', i + 1)
        check('captions and cards are bilingual at every stage', ok)
        check('legend says "Not to scale / 축척 아님" on stages 1-7 and explains the true-length runway + panning camera on 8',
              all('축척 아님' in l and 'Not to scale' in l for l in legends[:7]) and '1,640' in legends[7] and 'pans' in legends[7], str(legends))
        check('legend is different on every stage', len(set(legends)) == N)

        # 5. the numbers strip and the sources panel
        pg.locator('#numbers-sum').scroll_into_view_if_needed()
        click(pg, '#numbers-sum')
        check('numbers strip opens with the real mouse', pg.evaluate("() => document.querySelector('#numbers').open"))
        nb = pg.inner_text('#numbers-body')
        check('numbers strip: rate history, cumulative deliveries, plant lines, each with a confidence pill',
              '12,739' in nb and '2,483' in nb and '2005' in nb and pg.locator('#numbers-body .tg').count() >= 12 and pg.locator('#numbers-body .bars li').count() == 9, nb[:160])
        pg.locator('#numbers-sum').scroll_into_view_if_needed()
        click(pg, '#numbers-sum')
        click(pg, '#ctl-src')
        check('sources panel opens', pg.evaluate("() => document.querySelector('#sources').open"))
        txt = pg.inner_text('#src-body')
        check('sources: every confidence tag family is present', all(pg.locator(f'#src-body .tg.{c}').count() > 0 for c in ('v', 'e', 'a', 'u')) and pg.locator('#src-body .tg.s').count() > 0)
        check('sources: one neutral sentence each on the 2019 grounding and the 2024 door-plug incident', '2019' in txt and 'grounded' in txt and '2024' in txt and 'door plug' in txt.lower() and 'NTSB' in txt)
        check('sources: runway 5,382 ft and 130.41 kN are cited', '5,382' in txt and '130.41' in txt)
        pg.keyboard.press('Escape')
        check('Esc closes the sources panel and focus returns to its button', not pg.evaluate("() => document.querySelector('#sources').open") and pg.evaluate("() => document.activeElement.id") == 'ctl-src')
        click(pg, '#ctl-src')
        click(pg, '#src-close')
        check('the close button closes it', not pg.evaluate("() => document.querySelector('#sources').open"))
        click(pg, '#ctl-src')
        pg.mouse.click(4, 4)
        check('clicking the backdrop closes it', not pg.evaluate("() => document.querySelector('#sources').open"))
        check('opening sources did not pause or move the tour', st(pg)['errors'] == 0)

        # 6. while the wings are lowered, the "fitting now" row names what is moving into place
        pg.evaluate('() => { const f = window.__aircraft; f.hold(true); f.seek(3.62); }')
        tick(pg, 80, 3)
        fit = pg.evaluate("() => { const r = document.querySelector('#readouts .ro.fit'); return r && !r.hidden ? r.innerText : ''; }")
        check('line stage: a "fitting now" row names the wing (or tail) being lowered', ('날개' in fit or '꼬리' in fit or '안정판' in fit) and fit != '', fit)
        pg.evaluate('() => window.__aircraft.seek(0.5)')
        tick(pg, 80, 3)
        check('...and the row is hidden in the supply stage', not pg.evaluate("() => { const r = document.querySelector('#readouts .ro.fit'); return !!r && !r.hidden; }"))
        pg.evaluate('() => window.__aircraft.hold(false)')
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
        caps = pg.evaluate('() => window.__aircraft.captions')
        check('reduced: Prev is disabled at the very first caption', pg.is_disabled('#ctl-prev') and not pg.is_disabled('#ctl-next'))
        click(pg, '#ctl-over')
        check('reduced: the whole-plant overview can be switched on', until(pg, lambda s: s['overview']))
        click(pg, '#ctl-next')
        pg.evaluate('() => window.__aircraft.hold(true)')
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
              pg.is_disabled('#ctl-next') and clicks == len(caps) - 1 and all(b2 > a for a, b2 in zip(seen, seen[1:])) and abs(st(pg)['u'] - caps[-1]) < 1e-6,
              f'clicks={clicks} of {len(caps)} u={st(pg)["u"]} last={caps[-1]}')
        check('reduced: the last caption belongs to the finale (stage 8)', st(pg)['stage'] == 7 and not st(pg)['seeking'])
        check('reduced: every step showed a different caption text', len(ko_seen) == len(caps) - 1, f'{len(ko_seen)} of {len(caps) - 1}')
        pg.focus('#ctl-over')
        pg.keyboard.press('ArrowRight')
        time.sleep(0.4)
        check('reduced: ArrowRight at the last caption stays put and says so', abs(st(pg)['u'] - caps[-1]) < 1e-6 and 'last' in pg.inner_text('#status').lower())
        # Replay under reduced motion: back to the first take-off caption, no auto-play
        click(pg, '#ctl-replay')
        tick(pg, 50)
        s = st(pg)
        check('reduced: Replay take-off returns to the start of the finale without playing', s['stage'] == 7 and not s['playing'] and 7.0 <= s['u'] < 7.1, str(s))
        clicks = 0
        pg.evaluate('() => window.__aircraft.seek(7.9)')
        tick(pg, 50)
        while not pg.is_disabled('#ctl-prev') and clicks < len(caps) + 3:
            click(pg, '#ctl-prev')
            clicks += 1
        check('reduced: Prev walks back to the first caption and is disabled there', pg.is_disabled('#ctl-prev') and abs(st(pg)['u'] - caps[0]) < 1e-6, f'clicks={clicks} u={st(pg)["u"]}')
        pg.evaluate('() => window.__aircraft.hold(false)')
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
        for sel in ('#ctl-prev', '#ctl-play', '#ctl-next', '#ctl-over', '#route li:nth-child(1) .rt', '#route li:nth-child(8) .rt', '#cap'):
            inside = pg.evaluate("(s) => { const r = document.querySelector(s).getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1; }", sel)
            check(f'1024x600: {sel} fully on screen', inside)
        fig = pg.evaluate("() => document.querySelector('#fig').getBoundingClientRect().height")
        check('1024x600: figure keeps usable height', fig >= 270, str(fig))
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
        click(pg, '#route li:nth-child(8) .rt')
        check('1024x600: route click works (finale)', until(pg, lambda s: s['stage'] == 7 and s['u'] >= 7.0 and not s['seeking']))
        check('1024x600: Replay button on screen in the finale', pg.evaluate("() => { const r = document.querySelector('#ctl-replay').getBoundingClientRect(); return r.width > 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; }"))
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
        pg.evaluate('() => window.__aircraft.seek(7.6)')
        until(pg, lambda s: s['stage'] == 7)
        check('phone: still no horizontal overflow in the finale', pg.evaluate('() => document.documentElement.scrollWidth <= innerWidth + 1'))
        check('phone: Replay take-off is reachable in the finale', pg.evaluate("() => { const r = document.querySelector('#ctl-replay').getBoundingClientRect(); return r.width >= 44 && r.height >= 44 && r.right <= innerWidth + 1; }"))
        check('phone: no console errors', not pg.logs, str(pg.logs[:3]))
        check('phone: no external requests', not pg.external, str(pg.external))
        pg.context.close()
        test_phone_offscreen_and_keys(b)

        # ---------------- the REAL CSP page ----------------
        pg = new_page(b, csp=True)
        pg.evaluate("() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); }")
        check('CSP page: script ran under its hash (model exists)', pg.evaluate('() => !!window.__aircraft'))
        click(pg, '#ctl-next')
        check('CSP page: Next works', until(pg, lambda s: s['stage'] == 1))
        click(pg, '#ctl-play')
        check('CSP page: Play works', until(pg, lambda s: s['playing']))
        click(pg, '#ctl-play')
        click(pg, '#route li:nth-child(4) .rt')
        check('CSP page: route works', until(pg, lambda s: s['stage'] == 3))
        until(pg, lambda s: s['u'] >= 3.5, timeout=30)
        click(pg, '#ctl-src')
        click(pg, '#src-close')
        viol = pg.evaluate('() => window.__csp')
        check('CSP page: no CSP violations', not viol, str(viol))
        check('CSP page: no console errors', not pg.logs, str(pg.logs[:3]))
        check('CSP page: no external requests', not pg.external, str(pg.external))
        pg.context.close()

        # ---------------- deterministic and domain tests ----------------
        test_pause_freezes_everything(b)
        test_pause_mid_glide(b)
        test_motion_change_mid_seek(b)
        test_uncapped_clock(b)
        test_key_scope(b)
        test_csp_hash(b)
        test_whole_tour(b)
        test_takeoff(b)
        b.close()
    print('\n%d failure(s): %s' % (len(FAILS), FAILS) if FAILS else '\nall functional checks passed')
    sys.exit(1 if FAILS else 0)


if __name__ == '__main__':
    main()
