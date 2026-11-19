"""Functional test with REAL mouse / keyboard input: python3 tests/functional.py   (exit code 1 on failure)

Headless software GL can run at ~1 fps, so every animated step polls the page state with a generous timeout instead of
sleeping. The tour is driven by the wall clock (not a capped dt), so polling works at any frame rate. Deterministic steps use
window.__camfactory.hold(true) + seek(u) + tick(ms): the page runs exactly one frame of `ms` milliseconds per tick().
The main pages use bypass_csp (Playwright's string predicates need eval); ONE page then runs under the real CSP and asserts
that nothing is blocked, that the script still starts and that the controls work.
"""
import pathlib
import re
import sys
import time
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'camera-module-factory.html').as_uri()
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
FAILS = []
HANGUL = re.compile(r'[\uac00-\ud7a3]')
LATIN = re.compile('[A-Za-z]{4}')
N_STAGES = 8
N_PARTS = 81
KO_NAMES = ['자재 입고', '기판 SMT', '센서 다이본딩', '렌즈 배럴', '능동 정렬', 'OIS·AF 보정', '포장', '스마트폰 조립']
EN_NAMES = ['Materials in', 'Substrate SMT', 'Sensor die bond', 'Lens barrel', 'Active alignment', 'calibration', 'Packing', 'Phone assembly']
PHASES = ['load', 'search', 'dispense', 'uv', 'verify', 'bake', 'release', 'done']


def check(name, ok, extra=''):
    print(('PASS ' if ok else 'FAIL ') + name + (f'  {extra}' if extra and not ok else ''))
    if not ok:
        FAILS.append(name)


def st(pg):
    return pg.evaluate('() => window.__camfactory.state')


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
    # IntersectionObserver reports "figure visible" only after a real frame; until then hold-mode ticks draw nothing, and a
    # fingerprint taken too early would "settle" on an undrawn scene. Wait for a few real frames so both figures are live.
    until(pg, lambda s: s['frames'] >= 3, timeout=90)
    return pg


def click(pg, selector, scroll=False):
    """A real mouse click at the element's centre (after checking it is actually on screen)."""
    if scroll:
        pg.locator(selector).scroll_into_view_if_needed()
    box = pg.locator(selector).bounding_box()
    assert box, f'{selector} has no box'
    pg.mouse.click(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)


# A cheap fingerprint of everything drawn in the plant SVG and the loupe SVG (attributes included: viewBox, transforms, styles).
FP_JS = """() => { const f = (sel) => { const s = new XMLSerializer().serializeToString(document.querySelector(sel)); let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16) + ':' + s.length; };
  return f('#plant') + '|' + f('#loupe'); }"""


def fingerprint(pg):
    return pg.evaluate(FP_JS)


def py_advance(u, dt, seconds, end_u=N_STAGES - 1e-4):
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
    """Run n frames of exactly `ms` wall-clock milliseconds each (needs hold(true))."""
    for _ in range(n):
        pg.evaluate('(ms) => window.__camfactory.tick(ms)', ms)


def settle(pg, timeout=60.0):
    """Tick (hold mode) until the drawing stops changing: the camera ease is exponential, so wait until two frames agree."""
    end = time.time() + timeout
    prev = None
    while time.time() < end:
        tick(pg, 1500)
        cur = fingerprint(pg)
        if cur == prev:
            return True
        prev = cur
    return False


def frozen(pg):
    """True when the whole drawing is byte-identical after more time, even after a 20 s frame (used for Pause and reduced motion).
    frozen.why names the frame size that first changed the drawing (and what changed), for the failure message."""
    ser = "() => ['#plant', '#loupe'].map((s) => new XMLSerializer().serializeToString(document.querySelector(s)))"
    first = pg.evaluate(ser)
    frozen.why = ''
    for ms in (50, 400, 1000, 20000):
        tick(pg, ms)
        time.sleep(0.3)
        now = pg.evaluate(ser)
        if now != first:
            diffs = []
            for name, a, c in zip(('plant', 'loupe'), first, now):
                ta, tc = re.findall(r'<[^>]+>', a), re.findall(r'<[^>]+>', c)
                if a != c:
                    diffs.append(f'{name}: ' + ' | '.join(f'{x[:110]} => {y[:110]}' for x, y in zip(ta, tc) if x != y)[:600])
            frozen.why = f'changed after a {ms} ms frame: ' + ' ## '.join(diffs)
            return False
    return True


frozen.why = ''


# ----------------------------------------------------------------------------------------------------------------------
def test_model_numbers(b):
    """The numbers on screen come from the pure model. Check their shape (monotone, bounded) and the facts the page promises."""
    pg = new_page(b)
    m = lambda js: pg.evaluate(f'() => {{ const M = window.__camfactory.model; return {js}; }}')
    check('the page ships 81 named parts', pg.evaluate('() => window.__camfactory.partCount') == N_PARTS)
    check('stage seconds: eight stages with a longer active-alignment stage', pg.evaluate('() => window.__camfactory.stageSeconds') == [9, 10, 12, 13, 20, 14, 10, 20])
    # the module is assembled stage by stage; stage 1 shows the whole bill of materials
    counts = m('[1.0, 1.9, 2.9, 3.9, 4.9, 5.2, 5.9, 7.0, 7.99].map(u => M(u).count.parts)')
    check('assembled part count never goes down from stage 2 on and ends at 81', all(a <= c for a, c in zip(counts, counts[1:])) and counts[-1] == N_PARTS and counts[0] < 20, str(counts))
    check('stage 1 shows the exploded bill of materials: all 81 parts at once (mid-stage), then they drop onto the jig', m('M(0.5).count.parts') == N_PARTS and m('M(0.8).count.parts') == N_PARTS and m('M(0.99).view') == 'jig', m('[M(0.5).count.parts, M(0.8).count.parts, M(0.99).count.parts, M(0.99).view]'))
    # active alignment: phases in order, MTF climbs while searching and stays put after
    seq = m("(() => { const o = []; for (let u = 4; u < 5; u += 0.004) { const p = M(u).aa.phase; if (o[o.length - 1] !== p) o.push(p); } return o; })()")
    idx = [PHASES.index(p) for p in seq if p in PHASES]
    check('AA phases run in order: load, search, dispense, uv, verify, bake, release', len(idx) == len(seq) and idx == sorted(idx) and {'load', 'search', 'dispense', 'uv', 'verify', 'bake'} <= set(seq), str(seq))
    mt = m('[4.14, 4.3, 4.4, 4.5, 4.58].map(u => M(u).aa.mtf.c)')
    check('AA: centre MTF climbs while the stage searches for the peak', all(a < c for a, c in zip(mt, mt[1:])), str(mt))
    fin = m('M(4.7).aa.mtf')
    check('AA: at the peak the centre MTF is high and the corner MTF is clearly lower (a lens never is perfect at the edge)', 65 <= fin['c'] <= 80 and 35 <= fin['k'] <= 55 and fin['k'] < fin['c'] - 15, str(fin))
    err = m('[4.2, 4.5, 4.6].map(u => Math.hypot(M(u).aa.err.z, M(u).aa.err.x, M(u).aa.err.y))')
    check('AA: the focus/position error shrinks while the stage searches', err[0] > err[1] >= err[2] - 1e-9, str(err))
    check('AA: the UV flash happens only after the adhesive is dispensed, the bake only after the UV', m("(() => { const f = (p) => { for (let u = 4; u < 5; u += 0.002) if (M(u).aa.phase === p) return u; return 9; }; return f('dispense') < f('uv') && f('uv') < f('bake'); })()"))
    check('AA: the oven bake reaches the 45-80 C vendor range', 45 <= m('Math.max(...[4.8, 4.85, 4.9, 4.95].map(u => M(u).temp))') <= 80)
    # yield funnel
    good = m('[5.1, 5.4, 5.7, 5.9, 6.2].map(u => M(u).good)')
    check('yield: good units out of 1000 only fall along the test stage, end between 85 % and 97 % [estimate]', all(a >= c for a, c in zip(good, good[1:])) and good[0] == 1000 and 850 <= good[-1] <= 970, str(good))
    packed = m('[6.0, 6.2, 6.5, 6.95].map(u => M(u).packed)')
    check('packing: the packed count rises and never exceeds the good count', all(a <= c for a, c in zip(packed, packed[1:])) and packed[-1] <= good[-1] and packed[-1] > 0, f'{packed} {good}')
    # phone finale
    ph = m('[7.2, 7.5, 7.99].map(u => M(u).phone)')
    check('finale: the module drops in, flex connects, lid closes, the phone flips (in that order)', ph[0]['drop'] > 0 and ph[0]['flex'] == 0 and ph[1]['s1'] == 1 and ph[2]['flex'] == 1 and ph[2]['b2b'] == 1 and ph[2]['lid'] == 1 and ph[2]['flip'] == 1, str(ph)[:300])
    check('finale: ends on the back view with the scale strip', m('M(7.9999).view') == 'back' and m('M(7.9999).phone.strip') > 0.9)
    check('the carrier is on the line until the carton leaves, and is a tray before the carton', m("M(0.3).car.kind") == 'tray' and m("M(7.9).car.kind") == 'carton' and m('M(7.9).car.vis') == 0)
    pg.context.close()


def test_tour_plays_to_the_end(b):
    """Deterministic full tour: 1 s frames from u=0 to the end; every stage visited in order, finishes cleanly, replay appears."""
    pg = new_page(b)
    pg.evaluate('() => { const f = window.__camfactory; f.hold(true); f.seek(0); f.play(); }')
    visited, last_u, mono, n = [], -1.0, True, 0
    while n < 240:
        tick(pg, 1000)
        s = st(pg)
        n += 1
        if not visited or visited[-1] != s['stage']:
            visited.append(s['stage'])
        mono = mono and s['u'] >= last_u - 1e-9
        last_u = s['u']
        if not s['playing']:
            break
    s = st(pg)
    check('tour: 1 s frames play from the start through all eight stages in order', visited == list(range(N_STAGES)), str(visited))
    check('tour: progress is monotone and it takes about the sum of the stage seconds (108 s)', mono and 100 <= n <= 114, f'{n} frames mono={mono}')
    check('tour: ends by itself, stops playing, shows the finale and no errors', s['finished'] and not s['playing'] and s['u'] > 7.99 and s['errors'] == 0 and s['loupeView'] == 'back', str(s))
    check('tour: Replay button is shown at the end', s['replayShown'] and pg.is_visible('#ctl-replay'))
    pg.evaluate('() => window.__camfactory.hold(false)')
    click(pg, '#ctl-replay')  # real mouse
    check('Replay (real click) restarts the tour from the intake and plays', until(pg, lambda s: s['playing'] and s['u'] < 1 and not s['finished']))
    check('Replay: the button hides again while the tour runs', not pg.is_visible('#ctl-replay'))
    pg.context.close()
    # real time, real frames: the last stages run to the end by themselves on the wall clock
    pg = new_page(b)
    pg.evaluate('() => { const f = window.__camfactory; f.seek(6.7); f.play(); }')
    check('real time: the finale plays out on the wall clock and finishes', until(pg, lambda s: s['finished'] and not s['playing'], timeout=150) and st(pg)['stage'] == 7, str(st(pg)))
    check('real time: ...and Replay is offered', pg.is_visible('#ctl-replay'))
    pg.context.close()


def test_pause_freezes_everything(b):
    """Pause (and reduced motion) must freeze the picture: the plant, the loupe, the AA stage, the camera."""
    pg = new_page(b)
    pg.evaluate('() => { const f = window.__camfactory; f.hold(true); f.seek(4.3); f.play(); }')
    prints = set()
    for _ in range(8):
        tick(pg, 400)
        prints.add(fingerprint(pg))
    check('playing at the active-alignment stage: the drawing changes from frame to frame', len(prints) >= 6, str(len(prints)))
    fx_play = st(pg)['fx']
    check('playing: the effect clock runs', fx_play > 2.5, str(fx_play))
    click(pg, '#ctl-play')  # real mouse: Pause
    check('Pause: state says paused', not st(pg)['playing'])
    settled = settle(pg)
    check('Pause: the whole drawing (plant + loupe) is byte-identical after more time (even a 20 s frame)', settled and frozen(pg), f'settled={settled} {frozen.why}')
    s1 = st(pg)
    tick(pg, 20000)
    s2 = st(pg)
    check('Pause: effect clock and progress are frozen', abs(s1['fx'] - s2['fx']) < 1e-9 and abs(s1['u'] - s2['u']) < 1e-9, f'{s1["fx"]} {s2["fx"]}')
    # control: the same detector fails on a page that is sabotaged to keep moving (proves the freeze check can fail)
    bad = new_page(b)
    bad.evaluate('() => { const f = window.__camfactory; f.hold(true); f.seek(4.3); f.tick(200); }')
    bad.evaluate("() => { let k = 0; setInterval(() => document.querySelector('#loupe g').setAttribute('data-x', String(++k)), 50); }")
    time.sleep(0.4)
    check('CONTROL: the freeze detector DOES fail on a sabotaged page (a test that cannot fail is worthless)', not frozen(bad))
    bad.context.close()
    # reduced motion at the same stage
    pg.evaluate('() => { const f = window.__camfactory; f.seek(4.3); f.play(); }')
    tick(pg, 400, 3)
    check('control: playing again moves the effect clock again (the freeze above is not a dead page)', st(pg)['fx'] > s2['fx'] + 0.5)
    pg.emulate_media(reduced_motion='reduce')
    check('reduced: reacts to the media change', until(pg, lambda s: s['reduced']))
    settle(pg)
    fx0 = st(pg)['fx']
    check('reduced: Play is not running; nothing drifts after a 20 s frame', not st(pg)['playing'] and frozen(pg) and abs(st(pg)['fx'] - fx0) < 1e-9)
    pg.evaluate('() => window.__camfactory.hold(false)')
    # real frames, no hooks: Play -> Pause with the real mouse, then wait for several REAL frames
    pg.emulate_media(reduced_motion='no-preference')
    until(pg, lambda s: not s['reduced'])
    pg.evaluate('() => window.__camfactory.seek(4.2)')
    click(pg, '#ctl-play')
    f0 = st(pg)['frames']
    check('real frames: Play animates (frames and the effect clock advance)', until(pg, lambda s: s['frames'] >= f0 + 2 and s['fx'] > 0.5, timeout=90))
    click(pg, '#ctl-play')  # real mouse: Pause
    s0 = st(pg)
    until(pg, lambda s: s['frames'] >= s0['frames'] + 3, timeout=90)
    fpa, sa = fingerprint(pg), st(pg)
    until(pg, lambda s: s['frames'] >= sa['frames'] + 3, timeout=90)
    check('real frames: after Pause the drawing and effect clock do not change over several frames', fpa == fingerprint(pg) and abs(st(pg)['fx'] - sa['fx']) < 1e-9)
    check('real frames: ...and the page stayed healthy', st(pg)['errors'] == 0 and not pg.logs, str(pg.logs[:3]))
    pg.context.close()


def test_pause_mid_glide(b):
    """Pause during a glide stops it where it is, card and scene agree, and nothing keeps seeking."""
    pg = new_page(b)
    pg.evaluate('() => { const f = window.__camfactory; f.hold(true); f.play(); f.select(5); }')
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
    check('Pause mid-glide: the card shows the stage that is on screen', KO_NAMES[s2['stage']] in pg.inner_text('#card-name') and pg.inner_text('#stage-count').startswith(f'{s2["stage"] + 1} /'),
          f'{pg.inner_text("#card-name")!r} {s2["stage"]}')
    pg.context.close()


def test_motion_change_mid_seek(b):
    """Switching to reduced motion in the middle of a glide lands on the chosen stage (card, scene and caption agree)."""
    pg = new_page(b)
    pg.evaluate('() => { const f = window.__camfactory; f.hold(true); f.select(4); }')
    tick(pg, 250)
    s = st(pg)
    check('mid-seek: a glide to the active-alignment stage is in flight', s['seeking'] and 0.3 < s['u'] < 3.9 and s['stage'] == 4, str(s))
    check('mid-seek: before the change the caption is NOT the alignment one', '차트' not in pg.inner_text('#cap-ko'))
    pg.emulate_media(reduced_motion='reduce')
    check('mid-seek: reduced motion is picked up', until(pg, lambda s: s['reduced']))
    tick(pg, 50)
    s = st(pg)
    check('mid-seek: snapped onto the alignment stage at its first caption', s['stage'] == 4 and s['modelStage'] == 4 and not s['seeking'] and abs(s['u'] - 4.02) < 1e-6, str(s))
    check('mid-seek: the card is the alignment stage', '능동 정렬' in pg.inner_text('#card-name') and 'Active alignment' in pg.inner_text('#card-name'))
    check('mid-seek: the caption is the alignment one (chart + sensor on), the scrubber agrees', '차트' in pg.inner_text('#cap-ko') and abs(float(pg.input_value('#scrub')) - 4020) < 2, pg.inner_text('#cap-ko'))
    check('mid-seek: the route marks stage 5', pg.evaluate("() => document.querySelector('#route [aria-current]')?.dataset.i") == '4')
    pg.evaluate('() => window.__camfactory.hold(false)')
    pg.context.close()


def test_uncapped_clock(b):
    """The tour clock is wall-clock time with NO cap (a slow GPU must not slow the tour), crossing stage boundaries correctly."""
    pg = new_page(b)
    secs = pg.evaluate('() => window.__camfactory.stageSeconds')
    pg.evaluate('() => { const f = window.__camfactory; f.hold(true); f.seek(0.97); f.play(); }')
    tick(pg, 20000)
    want = py_advance(0.97, 20.0, secs)
    capped = py_advance(0.97, 5.0, secs)
    got = st(pg)['u']
    check('20 s frame advances 20 s of tour (stage by stage), not a 5 s cap', abs(got - want) < 1e-6 and abs(got - capped) > 0.3, f'got={got} want={want} cap={capped}')
    check('...and the card follows across the boundaries', st(pg)['stage'] == int(want), str(st(pg)))
    pg.evaluate('() => { const f = window.__camfactory; f.seek(7.5); f.play(); }')
    tick(pg, 600000)
    s = st(pg)
    check('a huge frame ends the tour cleanly at the last stage and stops playing', s['u'] > 7.99 and s['stage'] == 7 and not s['playing'] and s['errors'] == 0, str(s))
    pg.evaluate('() => window.__camfactory.hold(false)')
    # real, un-hooked: a 7 s main-thread stall in ONE evaluate; the first frame afterwards must account for all of it
    pg.evaluate('() => window.__camfactory.seek(0)')
    click(pg, '#ctl-play')
    until(pg, lambda s: s['playing'] and s['frames'] > 2)
    time.sleep(0.5)
    res = pg.evaluate("""() => { const S1 = window.__camfactory.state; const t0 = performance.now(); while (performance.now() - t0 < 7000) {}
        return new Promise((r) => requestAnimationFrame(() => r([S1, window.__camfactory.state]))); }""")
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
    check('phone: the plant figure is now completely scrolled out of view', until(pg, lambda s: not s['figVisible']) and pg.evaluate("() => document.querySelector('#fig').getBoundingClientRect().bottom") <= 0)
    f_before = st(pg)['frames']
    pg.locator('#route li:nth-child(5) .rt').tap()
    check('phone offscreen: tapping the alignment route entry selects it and the glide finishes', until(pg, lambda s: s['stage'] == 4 and s['u'] >= 3.999 and not s['seeking'], timeout=90))
    s = st(pg)
    check('phone offscreen: the figure was still offscreen the whole time', not s['figVisible'] and s['frames'] > f_before, str(s))
    for _ in range(40):  # the caption is applied by a real frame
        if '차트' in pg.inner_text('#cap-ko'):
            break
        time.sleep(0.5)
    check('phone offscreen: the caption updated to the alignment stage', '차트' in pg.inner_text('#cap-ko') and pg.inner_text('#cap-ko') != cap_before, pg.inner_text('#cap-ko'))
    check('phone offscreen: the scrubber value follows', abs(float(pg.input_value('#scrub')) - 4000) < 25, pg.input_value('#scrub'))
    check('phone offscreen: the counter says 5 / 8', pg.inner_text('#stage-count').strip().startswith('5 / 8'), pg.inner_text('#stage-count'))
    keys = pg.evaluate("() => [...document.querySelectorAll('#readouts .ro:not([hidden])')].map(r => r.dataset.key)")
    check('phone offscreen: ONLY the alignment readouts are shown (MTF, error, temperature)', keys == ['temp', 'mtfc', 'mtfk', 'err'] or sorted(keys) == sorted(['mtfc', 'mtfk', 'err', 'temp']), str(keys))
    check('phone offscreen: the card names the alignment stage', '능동 정렬' in pg.inner_text('#card-name'))
    pg.evaluate('() => window.scrollTo(0, 0)')
    check('phone: scrolling back brings the figure back into view', until(pg, lambda s: s['figVisible']))
    check('phone: the AA bay is what the plant shows after scrolling back', pg.evaluate("() => document.querySelector('#plant').dataset.focus") == 'aa')
    check('phone offscreen: no console errors', not pg.logs, str(pg.logs[:3]))
    pg.evaluate("() => { window.__dp = []; document.addEventListener('keydown', (e) => window.__dp.push([e.key, e.defaultPrevented])); document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); }")
    stage_now = st(pg)['stage']
    # keyboard scrolling is applied by the browser on a real frame, which can take seconds on software GL: poll, do not sleep
    pg.keyboard.press('PageDown')
    for _ in range(100):
        if pg.evaluate('() => window.scrollY') > 50:
            break
        time.sleep(0.2)
    time.sleep(2)  # let the first keyboard scroll animation finish: a key pressed in the middle of one can be coalesced away
    y1 = pg.evaluate('() => window.scrollY')
    pg.keyboard.press('ArrowDown')
    for _ in range(100):
        if pg.evaluate('() => window.scrollY') > y1 + 5:
            break
        time.sleep(0.2)
    y2 = pg.evaluate('() => window.scrollY')
    dpd = pg.evaluate('() => window.__dp')
    check('phone keys: PageDown scrolls the page', y1 > 50, str(y1))
    check('phone keys: ArrowDown scrolls it further and does not change the tour stage', y2 > y1 and st(pg)['stage'] == stage_now, f'{y1} {y2}')
    check('phone keys: neither key was default-prevented', bool(dpd) and all(not d for _, d in dpd), str(dpd))
    pg.context.close()


def test_csp_hash(b):
    """The CSP hash must be the hash of the script exactly as it is in the output; a changed script must be refused."""
    import base64
    import hashlib
    import tempfile
    html = (ROOT / 'camera-module-factory.html').read_text(encoding='utf-8')
    scripts = re.findall(r'<script>(.*?)</script>', html, re.S)
    outside = html.replace(scripts[0], '', 1)
    check('csp: exactly one inline script in the output (and no other script tag anywhere)', len(scripts) == 1 and len(re.findall(r'<script\b', outside)) == 1)
    meta = re.search(r'http-equiv="Content-Security-Policy" content="([^"]+)"', html)
    pinned = re.findall(r"'sha256-([A-Za-z0-9+/=]+)'", meta.group(1)) if meta else []
    digest = base64.b64encode(hashlib.sha256(scripts[0].encode('utf-8')).digest()).decode()
    check('csp: script-src pins exactly the hash of the final inline script text', pinned == [digest], f'{pinned} vs {digest}')
    check('csp: the policy has no unsafe-eval and no unsafe-inline for scripts, and no connect/img sources off-page', "unsafe-eval" not in meta.group(1) and not re.search(r"script-src[^;]*unsafe-inline", meta.group(1)) and "connect-src 'none'" in meta.group(1))
    tpl = (ROOT / 'template.html').read_text(encoding='utf-8')
    check('csp: template placeholders appear exactly once, script placeholder is the exact one-line form',
          all(tpl.count(p) == 1 for p in ('/*__SCRIPT__*/', '/*__STYLES__*/', '<!--__PLANT__-->', '<!--__LOUPE__-->', '<!--__CSP__-->')) and '<script>/*__SCRIPT__*/</script>' in tpl, '')
    check('page has no external references (src/href/url to http)', not re.search(r'(?:src|href)="https?:|url\(\s*["\']?https?:', html))
    with tempfile.TemporaryDirectory() as d:
        bad = pathlib.Path(d) / 'tampered.html'
        bad.write_text(html.replace('</script>', ';/*x*/</script>', 1), encoding='utf-8')
        ctx = b.new_context(viewport={'width': 800, 'height': 600})
        pg = ctx.new_page()
        logs = []
        pg.on('console', lambda m: logs.append(m.text))
        pg.goto(bad.as_uri(), timeout=60000)
        time.sleep(1.5)
        check('csp: a script that no longer matches the hash is REFUSED (no __camfactory, CSP error reported)',
              pg.evaluate('() => typeof window.__camfactory') == 'undefined' and any('Content Security Policy' in t for t in logs), str(logs[:2]))
        ctx.close()


def test_dialogs(b):
    """The three panels: compare, business, sources. Real clicks open them; Esc, the X button and the backdrop close them."""
    pg = new_page(b)
    for opener, dlg in (('#open-compare', 'dlg-compare'), ('#open-business', 'dlg-business'), ('#open-sources', 'dlg-sources')):
        click(pg, opener)
        check(f'{dlg}: a real click opens it', until(pg, lambda s, d=dlg: s['dialog'] == d))
        check(f'{dlg}: it is bilingual', bool(HANGUL.search(pg.inner_text(f'#{dlg}'))) and bool(LATIN.search(pg.inner_text(f'#{dlg}'))))
        pg.keyboard.press('Escape')
        check(f'{dlg}: Esc closes it', until(pg, lambda s: s['dialog'] == ''))
        click(pg, opener)
        until(pg, lambda s, d=dlg: s['dialog'] == d)
        click(pg, f'#{dlg} [data-close]')
        check(f'{dlg}: the close button closes it', until(pg, lambda s: s['dialog'] == ''))
        click(pg, opener)
        until(pg, lambda s, d=dlg: s['dialog'] == d)
        pg.mouse.click(4, 4)  # on the backdrop
        check(f'{dlg}: a click on the backdrop closes it', until(pg, lambda s: s['dialog'] == ''))
    # compare: the competitors the research supports, each with a confidence tag on every claim
    click(pg, '#open-compare')
    until(pg, lambda s: s['dialog'] == 'dlg-compare')
    txt = pg.inner_text('#compare-body')
    check('compare: Sunny, Largan, Samsung Electro-Mechanics, Cowell, MCNEX, Foxconn Interconnect and Q Technology are all there',
          all(w in txt for w in ('Sunny', 'Largan', 'Samsung Electro-Mechanics', 'Cowell', 'MCNEX', 'Foxconn', 'Q Technology')))
    tags_ok = pg.evaluate("() => [...document.querySelectorAll('#compare-body .ccard li')].every(li => li.querySelector('.tg'))")
    n_cards = pg.locator('#compare-body .ccard').count()
    check('compare: every claim carries a confidence tag, and there are nine company cards', tags_ok and n_cards == 9, str(n_cards))
    check('compare: the data gap for FIT / Truly / AAC is stated, not invented', pg.evaluate("() => !!document.querySelector('#compare-body .tg-G')"))
    check('compare: both [확인됨] and [추정] tags appear', pg.evaluate("() => !!document.querySelector('#compare-body .tg-V, #compare-body .tg-V2') && !!document.querySelector('#compare-body .tg-E')"))
    check('compare: the plant sites list is shown', pg.locator('#compare-body .sites li').count() >= 3)
    pg.keyboard.press('Escape')
    until(pg, lambda s: s['dialog'] == '')
    # business: verified numbers only, each with year/source id that exists in the sources panel
    click(pg, '#open-business')
    until(pg, lambda s: s['dialog'] == 'dlg-business')
    rows = pg.evaluate("() => [...document.querySelectorAll('#business-body .bfull li')].map(li => ({v: li.querySelector('.bv').textContent, tag: [...li.querySelectorAll('.tg')].map(t => t.className).join(' '), src: (li.querySelector('.bs') || {}).textContent || ''}))")
    check('business: the six strip numbers are in the panel', all(v in ' '.join(r['v'] for r in rows) for v in ('21.90', '83.6', '483', '81.7', '341.1')), str(rows)[:300])
    check('business: every row has a confidence tag and a source id', all(r['tag'] and r['src'] for r in rows), str(rows)[:300])
    pg.keyboard.press('Escape')
    until(pg, lambda s: s['dialog'] == '')
    strip = pg.evaluate("() => [...document.querySelectorAll('#biz .bz')].map(li => ({id: li.dataset.id, tg: [...li.querySelectorAll('.tg')].map(t => t.className), src: li.querySelector('.bs').textContent}))")
    check('business strip: six numbers, each tagged verified (V) or verified-secondary (V2) only, each with a source id',
          len(strip) == 6 and all(len(r['tg']) == 1 and re.search(r'tg-V2?$', r['tg'][0]) and r['src'] for r in strip), str(strip))
    srcs = [r['src'] for r in strip]
    click(pg, '#open-sources')
    until(pg, lambda s: s['dialog'] == 'dlg-sources')
    sids = pg.evaluate("() => [...document.querySelectorAll('#sources-body .sid')].map(e => e.textContent)")
    check('sources: every source id used by the business strip is listed in the sources panel', all(s in sids for s in srcs) and len(sids) >= 15, f'{srcs} {len(sids)}')
    check('sources: the tag legend lists verified, verified (secondary), estimate, assumption, unverified and data gap', pg.locator('#sources-body .tagkey li').count() == 6)
    body = pg.inner_text('#sources-body')
    check('sources: the unofficial / not-to-scale / no-affiliation disclaimer is on the page', '비공식' in body and 'unofficial' in body and 'affiliation' in body)
    pg.keyboard.press('Escape')
    until(pg, lambda s: s['dialog'] == '')
    # the tour keeps working after the dialogs
    click(pg, '#ctl-next')
    check('the tour still works after the dialogs (Next selects stage 2)', until(pg, lambda s: s['stage'] == 1))
    check('no console errors from the dialogs', not pg.logs, str(pg.logs[:3]))
    pg.context.close()


def test_loupe_and_parts(b):
    """The loupe follows the model (view and part count), parts can be picked from the loupe or the list, and the HUD shows the model's numbers."""
    pg = new_page(b)
    pg.evaluate('() => window.__camfactory.hold(true)')
    expect = {0.5: 'bom', 1.5: 'mod', 3.5: 'tall', 4.3: 'aa', 5.5: 'mod', 6.5: 'tray', 7.9999: 'back'}
    ok, got = True, {}
    for u, view in expect.items():
        pg.evaluate('(u) => window.__camfactory.seek(u)', u)
        settle(pg)
        got[u] = st(pg)['loupeView']
        ok = ok and got[u] == view
    check('loupe view follows the model at every stage (bill of materials, module, tall stack, AA, tray, back)', ok, str(got))
    # the shown-part count tracks the assembled count
    for u in (1.5, 3.5, 5.5):
        pg.evaluate('(u) => window.__camfactory.seek(u)', u)
        tick(pg, 100, 2)
        shown = pg.evaluate('() => window.__camfactory.partShown()')
        want = pg.evaluate('(u) => window.__camfactory.model(u).count.parts', u)
        check(f'loupe at u={u}: shows {want} parts, the model says so', shown >= want and shown <= want + 8, f'{shown} vs {want}')
    # HUD numbers come from the model
    pg.evaluate('() => window.__camfactory.seek(4.5)')
    tick(pg, 100, 2)
    hud = pg.evaluate("() => Object.fromEntries([...document.querySelectorAll('#readouts .ro:not([hidden])')].map(r => [r.dataset.key, r.querySelector('.v').textContent]))")
    mtf = pg.evaluate('() => window.__camfactory.model(4.5).aa.mtf')
    check('HUD at the alignment stage shows exactly the four AA numbers', sorted(hud) == ['err', 'mtfc', 'mtfk', 'temp'], str(hud))
    check('HUD centre / corner MTF equal the model values (rounded)', abs(float(hud['mtfc']) - mtf['c']) <= 0.6 and abs(float(hud['mtfk']) - mtf['k']) <= 0.6, f'{hud} {mtf}')
    check('the AA panel (phase, MTF at five points, six axes) is visible during alignment and the generic HUD is hidden', pg.is_visible('#aahud') and not pg.is_visible('#readouts'))
    n_mtf, n_ax = pg.locator('#mtfs > *').count(), pg.locator('#axes > *').count()
    check('AA panel: five MTF bars (centre + four corners) and six axis rows (X Y Z Tx Ty Tz)', n_mtf == 5 and n_ax == 6, f'{n_mtf} {n_ax}')
    # part pick from the list (real click)
    pg.evaluate('() => window.__camfactory.seek(3.5)')
    tick(pg, 100, 2)
    pg.evaluate('() => window.__camfactory.hold(false)')
    check('parts list at stage 4 lists the parts this stage adds', pg.locator('#parts-list .pbtn').count() >= 5)
    click(pg, '#parts-list .pbtn >> nth=0', scroll=True)
    s = st(pg)
    check('picking a part in the list selects it and shows its bilingual name', s['partSel'] is not None and pg.is_visible('#partsel') and bool(HANGUL.search(pg.inner_text('#partsel'))) and bool(LATIN.search(pg.inner_text('#partsel'))), str(s['partSel']))
    first = s['partSel']
    if pg.locator('#parts-list .pbtn[aria-pressed="true"]').count():
        click(pg, '#parts-list .pbtn[aria-pressed="true"]', scroll=True)
    check('picking it again clears the selection', until(pg, lambda s: s['partSel'] is None) and not pg.is_visible('#partsel'))
    # part pick from the loupe with the real mouse (a part that is really on top at its own centre)
    pg.evaluate('() => { const f = window.__camfactory; f.hold(true); f.seek(5.5); }')
    settle(pg)
    pg.evaluate('() => window.__camfactory.hold(false)')
    pg.locator('#lfig').scroll_into_view_if_needed()
    hit = pg.evaluate("""() => { const f = window.__camfactory; const ids = [...document.querySelectorAll('#loupe [data-p]')].map((g) => g.dataset.p); for (const id of ids) { const p = f.partPos(id); if (!p) continue;
        const e = document.elementFromPoint(p.x, p.y); const g = e && e.closest ? e.closest('[data-p]') : null;
        if (g && g.dataset.p === id && !g.classList.contains('ghost')) return [id, p.x, p.y]; } return null; }""")
    check('the loupe has at least one part that can be clicked with the mouse', hit is not None)
    if hit:
        pg.mouse.click(hit[1], hit[2])
        check('clicking a part in the loupe selects it', until(pg, lambda s: s['partSel'] == hit[0]), str(st(pg)['partSel']))
        pg.focus('#lfig') if pg.evaluate("() => document.querySelector('#lfig').tabIndex >= 0") else None
        pg.evaluate("() => document.querySelector('#lfig').dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}))")
        check('Escape in the loupe clears the selection', until(pg, lambda s: s['partSel'] is None))
    check('no console errors from the loupe', not pg.logs, str(pg.logs[:3]))
    pg.context.close()


# ----------------------------------------------------------------------------------------------------------------------
def main():
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)

        # ---------------- desktop 1366x800 ----------------
        pg = new_page(b)
        check('page ships a strict CSP', pg.evaluate("() => !!document.querySelector('meta[http-equiv=Content-Security-Policy]')?.content.includes(\"default-src 'none'\")"))
        check('Hangul font is embedded (no network)', pg.evaluate("() => document.fonts.check('700 16px Round', '카메라')"))
        s = st(pg)
        check('starts at stage 1, paused', s['stage'] == 0 and not s['playing'] and s['errors'] == 0, str(s))
        check('title is bilingual', '카메라' in pg.inner_text('.title') and 'camera' in pg.inner_text('.title'))
        check('eight route entries', pg.locator('#route .rt').count() == N_STAGES)
        check('eight bay chips', pg.locator('#chips .chip').count() == N_STAGES)
        check('the loupe and the plant are both drawn (two SVGs)', pg.evaluate("() => !!document.querySelector('#plant') && !!document.querySelector('#loupe') && document.querySelectorAll('#loupe [data-p]').length >= 81"))
        check('the not-to-scale statement is on the page in both languages', '축척' in pg.inner_text('#lfig') and 'not to scale' in pg.inner_text('#lfig'), pg.inner_text('#lfig')[:200])
        check('the business strip is on the page with six numbers', pg.locator('#biz .bz').count() == 6)

        # 1. Next / Prev with the real mouse
        click(pg, '#ctl-next')
        check('Next click selects stage 2', until(pg, lambda s: s['stage'] == 1))
        check('...and the view glides to it (u reaches 1)', until(pg, lambda s: s['u'] >= 0.99 and not s['seeking']))
        check('card shows the SMT stage in both languages', '기판 SMT' in pg.inner_text('#card-name') and 'Substrate SMT' in pg.inner_text('#card-name'))
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

        # 3. choose stages: route list click, chip click, then keyboard
        click(pg, '#route li:nth-child(4) .rt')
        check('route entry 4 selects the lens / VCM stage', until(pg, lambda s: s['stage'] == 3))
        check('card names the lens / VCM stage', '렌즈 배럴' in pg.inner_text('#card-name') and 'Lens barrel' in pg.inner_text('#card-name'))
        until(pg, lambda s: s['u'] >= 3.0 and not s['seeking'])
        pg.evaluate('() => window.__camfactory.select(5)')
        until(pg, lambda s: s['stage'] == 5 and not s['seeking'])
        until(pg, lambda s: s['u'] >= 5.0 and not s['seeking'])
        check('selected stage chip is visible', pg.evaluate('() => window.__camfactory.chipVisible(5)'))
        pos = pg.evaluate('() => window.__camfactory.chipPos(5)')
        figbox = pg.locator('#fig').bounding_box()
        check('selected chip lies fully inside the figure', figbox['x'] <= pos['x'] - pos['w'] / 2 and pos['x'] + pos['w'] / 2 <= figbox['x'] + figbox['width']
              and figbox['y'] <= pos['y'] - pos['h'] / 2 and pos['y'] + pos['h'] / 2 <= figbox['y'] + figbox['height'], f'{pos} {figbox}')
        pg.mouse.click(pos['x'], pos['y'])
        check('clicking the selected stage chip in the figure keeps it selected', until(pg, lambda s: s['stage'] == 5))
        # a chip of ANOTHER stage, in the whole-plant view, with the real mouse
        click(pg, '#ctl-over')
        until(pg, lambda s: s['overview'])
        check('overview: the camera pulls back to show the whole plant', until(pg, lambda s: float(s['viewBox'].split()[2]) > 1400, timeout=90), st(pg)['viewBox'])
        picked = None
        for i in (3, 2, 4, 1, 6):
            hit = pg.evaluate("""(i) => { const c = document.querySelectorAll('#chips .chip')[i]; const r = c.getBoundingClientRect();
                const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !c.classList.contains('off') && !!e && c.contains(e); }""", i)
            if hit:
                picked = i
                break
        check('overview: at least one other stage chip is visible and unobstructed', picked is not None)
        if picked is not None:
            pos = pg.evaluate('(i) => window.__camfactory.chipPos(i)', picked)
            pg.mouse.click(pos['x'], pos['y'])
            check('clicking another stage chip with the mouse selects that stage and leaves the overview', until(pg, lambda s: s['stage'] == picked and not s['overview']))
        click(pg, '#route li:nth-child(2) .rt')
        until(pg, lambda s: s['stage'] == 1)
        pg.focus('#route li:nth-child(1) .rt')
        pg.keyboard.press('ArrowRight')
        check('ArrowRight steps forward', until(pg, lambda s: s['stage'] == 2))
        pg.keyboard.press('ArrowLeft')
        check('ArrowLeft steps back', until(pg, lambda s: s['stage'] <= 2 and s['u'] < 2.5))
        pg.keyboard.press('5')
        check('number key 5 selects the active-alignment stage', until(pg, lambda s: s['stage'] == 4))
        check('alignment card is bilingual', '능동 정렬' in pg.inner_text('#card-name') and 'Active alignment' in pg.inner_text('#card-name'))
        pg.keyboard.press('8')
        check('number key 8 selects the phone-assembly finale', until(pg, lambda s: s['stage'] == 7))
        pg.keyboard.press('Home')
        until(pg, lambda s: s['stage'] == 0)
        pg.keyboard.press('End')
        check('End selects the last stage', until(pg, lambda s: s['stage'] == 7))
        until(pg, lambda s: s['u'] >= 7.0 and not s['seeking'], timeout=90)
        check('Next is disabled on the last stage (real button state)', pg.is_disabled('#ctl-next'))
        n_before = st(pg)['u']
        pg.keyboard.press('ArrowRight')
        time.sleep(0.5)
        check('...and ArrowRight on the last stage does not move anything', st(pg)['stage'] == 7 and abs(st(pg)['u'] - n_before) < 0.5)
        pg.keyboard.press('Home')
        check('Home selects the first', until(pg, lambda s: s['stage'] == 0))
        home_ok = until(pg, lambda s: s['u'] < 0.02 and not s['seeking'], timeout=120)
        prev_ok = False
        for _ in range(100):  # the button state is applied by a real frame, which can take seconds on software GL
            if pg.is_disabled('#ctl-prev'):
                prev_ok = True
                break
            time.sleep(0.3)
        s = st(pg)
        check('Prev is disabled on the very first stage', home_ok and prev_ok, f"u={s['u']} seeking={s['seeking']} stage={s['stage']} frames={s['frames']} home_ok={home_ok}")

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
        click(pg, '#ctl-over')
        check('overview toggle on', until(pg, lambda s: s['overview']))
        check('overview button reports pressed', pg.get_attribute('#ctl-over', 'aria-pressed') == 'true')
        pg.keyboard.press('Escape')
        check('Esc leaves overview', until(pg, lambda s: not s['overview']))
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
        check('Restart starts again from the intake', until(pg, lambda s: s['u'] < 1 and s['playing']))
        pg.keyboard.press('Escape')

        # 4. every stage's card and caption carry both languages and the right stage name
        ok = True
        for i in range(N_STAGES):
            pg.evaluate(f'() => window.__camfactory.seek({i} + 0.5)')
            until(pg, lambda s, i=i: s['stage'] == i)
            ko, en = pg.inner_text('#cap-ko'), pg.inner_text('#cap-en')
            card = pg.inner_text('.card')
            name = pg.inner_text('#card-name')
            if not (HANGUL.search(ko) and LATIN.search(en) and HANGUL.search(card) and LATIN.search(card) and KO_NAMES[i] in name and EN_NAMES[i] in name):
                ok = False
                print('   missing a language or the wrong name at stage', i + 1, repr(name[:60]))
        check('captions and cards are bilingual and name the right stage at every stage', ok)
        pg.evaluate('() => window.__camfactory.seek(0.5)')
        until(pg, lambda s: s['stage'] == 0)
        card = pg.inner_text('.card')
        check('stage 1 card shows the clean-room class legend and the gowning steps (ISO class, Class 10 core tagged)', 'ISO' in card and '10' in card)
        pg.evaluate('() => window.__camfactory.seek(5.95)')
        until(pg, lambda s: s['stage'] == 5)
        check('stage 6 card shows the yield funnel and tags it as an estimate', pg.locator('.card .extra').is_visible() and pg.evaluate("() => !!document.querySelector('.card .extra') && /추정/.test(document.querySelector('.card').innerText)"))
        pg.evaluate('() => window.__camfactory.seek(4.5)')
        until(pg, lambda s: s['stage'] == 4)
        check('the whole page has no horizontal overflow at 1366x800', pg.evaluate('() => document.documentElement.scrollWidth <= innerWidth + 1'))
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
        caps = pg.evaluate('() => window.__camfactory.captions')
        check('reduced: there are 41 captions across the eight stages', len(caps) == 41, str(len(caps)))
        click(pg, '#ctl-over')
        check('reduced: the whole-plant overview can be switched on', until(pg, lambda s: s['overview']))
        click(pg, '#ctl-next')
        pg.evaluate('() => window.__camfactory.hold(true)')  # captions are applied by a frame; step frames ourselves so each REAL click can be checked
        tick(pg, 50)
        check('reduced: Next leaves the overview', until(pg, lambda s: not s['overview']) and pg.get_attribute('#ctl-over', 'aria-pressed') == 'false')
        u_b = st(pg)['u']
        check('reduced: the first Next moves to the SECOND caption (never a silent no-op)', abs(u_b - caps[1]) < 1e-6, f'{u_b} vs {caps[:3]}')
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
        check('reduced: the last caption belongs to the finale and the Replay button is shown', st(pg)['stage'] == 7 and not st(pg)['seeking'] and st(pg)['finished'] and st(pg)['replayShown'])
        check('reduced: every step showed a different caption text', len(ko_seen) == len(caps) - 1, f'{len(ko_seen)} of {len(caps) - 1}')
        pg.focus('#ctl-over')
        pg.keyboard.press('ArrowRight')
        time.sleep(0.4)
        check('reduced: ArrowRight at the last caption stays put and says so', abs(st(pg)['u'] - caps[-1]) < 1e-6 and 'last' in pg.inner_text('#status').lower(), pg.inner_text('#status'))
        clicks = 0
        while not pg.is_disabled('#ctl-prev') and clicks < len(caps) + 3:
            click(pg, '#ctl-prev')
            tick(pg, 50)
            clicks += 1
        check('reduced: Prev walks back to the first caption and is disabled there', pg.is_disabled('#ctl-prev') and clicks == len(caps) - 1 and abs(st(pg)['u'] - caps[0]) < 1e-6, f'clicks={clicks} u={st(pg)["u"]}')
        pg.evaluate('() => window.__camfactory.hold(false)')
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
        for sel in ('#ctl-prev', '#ctl-play', '#ctl-next', '#ctl-over', '#cap', '#fig', '#lfig'):
            inside = pg.evaluate("(s) => { const r = document.querySelector(s).getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1; }", sel)
            check(f'1024x600: {sel} fully on screen', inside)
        fig = pg.evaluate("() => [document.querySelector('#fig').getBoundingClientRect().height, document.querySelector('#lfig').getBoundingClientRect().height]")
        check('1024x600: both figures keep usable height', fig[0] >= 220 and fig[1] >= 220, str(fig))
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
        pg.locator('#route li:nth-child(6) .rt').scroll_into_view_if_needed()
        click(pg, '#route li:nth-child(6) .rt')
        check('1024x600: route click works', until(pg, lambda s: s['stage'] == 5))
        pg.evaluate('() => { const f = window.__camfactory; f.hold(true); f.seek(4.3); }')
        settle(pg)
        r = pg.evaluate("() => { const a = document.querySelector('#aahud').getBoundingClientRect(), l = document.querySelector('#lfig').getBoundingClientRect(); return [a.left >= l.left - 1 && a.right <= l.right + 1 && a.top >= l.top - 1 && a.bottom <= l.bottom + 1, a.height]; }")
        check('1024x600: the AA panel fits inside the loupe frame', r[0], str(r))
        pg.evaluate('() => window.__camfactory.hold(false)')
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
        sizes = pg.evaluate("() => [document.querySelector('#fig').getBoundingClientRect().height, document.querySelector('#lfig').getBoundingClientRect().height]")
        check('phone: both figures are tall enough to read', sizes[0] >= 230 and sizes[1] >= 230, str(sizes))
        small = pg.evaluate("""() => [...document.querySelectorAll('button')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && (r.width < 40 || r.height < 40); }).map(b => b.className + ':' + b.getBoundingClientRect().width.toFixed(0) + 'x' + b.getBoundingClientRect().height.toFixed(0))""")
        check('phone: no visible control under 40px (stage chips excepted)', not [x for x in small if not x.startswith('chip')], str(small))
        pg.evaluate('() => window.__camfactory.seek(5.5)')
        until(pg, lambda s: s['stage'] == 5)
        check('phone: still no horizontal overflow at stage 6', pg.evaluate('() => document.documentElement.scrollWidth <= innerWidth + 1'))
        pg.evaluate('() => window.__camfactory.seek(7.9999)')
        until(pg, lambda s: s['stage'] == 7)
        check('phone: the finale shows the Replay button inside the screen', until(pg, lambda s: s['replayShown']) and pg.evaluate("() => { const r = document.querySelector('#ctl-replay').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1; }"))
        check('phone: still no horizontal overflow at the finale', pg.evaluate('() => document.documentElement.scrollWidth <= innerWidth + 1'))
        check('phone: no console errors', not pg.logs, str(pg.logs[:3]))
        check('phone: no external requests', not pg.external, str(pg.external))
        pg.context.close()
        test_phone_offscreen_and_keys(b)

        # ---------------- the REAL CSP page ----------------
        pg = new_page(b, csp=True)
        pg.evaluate("() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); }")
        check('CSP page: script ran under its hash (__camfactory exists)', pg.evaluate('() => !!window.__camfactory'))
        click(pg, '#ctl-next')
        check('CSP page: Next works', until(pg, lambda s: s['stage'] == 1))
        click(pg, '#ctl-play')
        check('CSP page: Play works', until(pg, lambda s: s['playing']))
        click(pg, '#ctl-play')
        click(pg, '#route li:nth-child(5) .rt')
        check('CSP page: route works', until(pg, lambda s: s['stage'] == 4))
        click(pg, '#open-sources')
        check('CSP page: dialogs work', until(pg, lambda s: s['dialog'] == 'dlg-sources'))
        pg.keyboard.press('Escape')
        until(pg, lambda s: s['u'] >= 4.0, timeout=60)
        viol = pg.evaluate('() => window.__csp')
        check('CSP page: no CSP violations', not viol, str(viol))
        check('CSP page: no console errors', not pg.logs, str(pg.logs[:3]))
        check('CSP page: no external requests', not pg.external, str(pg.external))
        pg.context.close()

        # ---------------- the deterministic and review-finding tests ----------------
        test_model_numbers(b)
        test_dialogs(b)
        test_loupe_and_parts(b)
        test_pause_freezes_everything(b)
        test_pause_mid_glide(b)
        test_motion_change_mid_seek(b)
        test_uncapped_clock(b)
        test_key_scope(b)
        test_csp_hash(b)
        test_tour_plays_to_the_end(b)
        b.close()
    print('\n%d failure(s): %s' % (len(FAILS), FAILS) if FAILS else '\nall functional checks passed')
    sys.exit(1 if FAILS else 0)


if __name__ == '__main__':
    main()
