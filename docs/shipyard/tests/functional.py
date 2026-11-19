"""Functional checks with REAL mouse / keyboard / touch input: python3 tests/functional.py  (exit 1 on any failure)

The page is driven by the wall clock, so assertions poll the public `window.__shipyard` snapshot with
generous timeouts instead of sleeping for a fixed time. State is never forced through the API except
where a long animation has to be skipped (seek) or a model number is compared with what the page shows.
Most pages run with bypass_csp=True (Playwright's string predicates need eval); one page runs under the
real CSP and must stay clean.
"""
import os
import pathlib
import re
import sys
import time

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
# SHIPYARD_HTML points the suite at another build (used to prove a test fails against a deliberately broken copy)
URL = pathlib.Path(os.environ.get('SHIPYARD_HTML') or ROOT / 'shipyard.html').resolve().as_uri()
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
FAILS = []
PASSED = [0]


def check(ok, msg):
    if ok:
        PASSED[0] += 1
        print(f'  ok   {msg}')
    else:
        FAILS.append(msg)
        print(f'  FAIL {msg}')


def snap(pg):
    return pg.evaluate('__shipyard.snapshot()')


def poll(pg, expr, pred, timeout=20.0, step=0.15):
    """Evaluate `expr` until pred(value) is truthy; return the last value."""
    end = time.time() + timeout
    v = None
    while time.time() < end:
        v = pg.evaluate(expr)
        if pred(v):
            return v
        time.sleep(step)
    return v


def wait_snap(pg, pred, timeout=20.0):
    v = poll(pg, '__shipyard.snapshot()', pred, timeout)
    return v, bool(pred(v))


class Page:
    """A page with console / request bookkeeping."""

    def __init__(self, browser, **kw):
        self.logs, self.requests = [], []
        kw.setdefault('viewport', {'width': 1366, 'height': 800})
        kw.setdefault('bypass_csp', True)             # Playwright's string predicates need eval; the CSP test turns this off
        self.pg = browser.new_page(**kw)
        self.pg.on('console', lambda m: self.logs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
        self.pg.on('pageerror', lambda e: self.logs.append(f'PAGEERROR: {e}'))
        self.pg.on('request', lambda r: self.requests.append(r.url) if not r.url.startswith(('file:', 'data:')) else None)
        self.pg.goto(URL, timeout=90000)
        poll(self.pg, 'window.__shipyard ? __shipyard.S.frames : 0', lambda v: v > 3, 60)

    def close(self):
        self.pg.close()


def point_in(pg, sel):
    """A viewport point where the topmost element really belongs to `sel` (a real click will hit it)."""
    return pg.evaluate("""(sel) => {
      const g = document.querySelector(sel); if (!g) return null;
      const r = g.getBoundingClientRect(), vp = document.querySelector('#viewport').getBoundingClientRect();
      const x0 = Math.max(r.left, vp.left), x1 = Math.min(r.right, vp.right), y0 = Math.max(r.top, vp.top), y1 = Math.min(r.bottom, vp.bottom);
      for (let j = 1; j < 24; j++) for (let i = 1; i < 24; i++) {
        const x = x0 + (x1 - x0) * i / 24, y = y0 + (y1 - y0) * j / 24;
        const e = document.elementFromPoint(x, y);
        if (e && e.closest(sel)) return { x, y };
      }
      return null;
    }""", sel)


def test_load_and_model(b):
    print('load, structure, model numbers')
    P = Page(b)
    pg = P.pg
    s = snap(pg)
    check(s['view'] == 'yard' and s['stage'] == 0, 'starts in the yard view at stage 1')
    check(s['overview'] is True, 'the first view shows the whole yard')
    check(s['frames'] > 3 and s['errors'] == 0, 'animation loop runs without errors')
    check(pg.evaluate("document.querySelector('#svg-yard').querySelectorAll('.fac').length") >= 5, 'the five shops (and the dock, crane, quay) are drawn as clickable groups')
    check(pg.evaluate("document.querySelectorAll('#svg-yard .iso-solid').length + document.querySelectorAll('#svg-vessel .iso-solid').length") > 300, 'figure is built from hundreds of solids')
    check(pg.evaluate("document.querySelectorAll('#card [lang=ko]').length > 0 && document.querySelectorAll('#card [lang=en]').length > 0"), 'card shows Korean and English')
    check(pg.evaluate("[...document.querySelectorAll('.btn')].every(b => b.querySelector('[lang=ko]') && b.querySelector('[lang=en]'))"), 'every button carries both languages')
    ff = pg.evaluate("document.fonts.check('700 16px Square') && document.fonts.check('400 16px Barun')")
    check(ff, 'Nanum fonts are inlined and loaded (Hangul renders offline)')
    m = pg.evaluate('({fl: __shipyard.model.floodHours(), depth: __shipyard.model.DOCK.depth, rpm: __shipyard.model.rpmAt(1), kn: __shipyard.model.speedAt(1), rpm0: __shipyard.model.rpmAt(0)})')
    check(6 < m['fl'] < 8 and m['depth'] == 14, f"dock flooding time from the model is plausible ({m['fl']:.1f} h)")
    check(m['rpm'] == 90 and m['kn'] == 22 and m['rpm0'] == 0, 'service speed 22 kn at 90 rpm, 0 rpm when stopped')
    # masses: the six drawn blocks are samples, so they must not be presented as the whole ship (6 blocks sum to ~4 kt, the lightship is 38 kt)
    mm = pg.evaluate('({sum: __shipyard.model.HULL.tonnes.reduce((a, b) => a + b, 0), ls: __shipyard.model.DOCK.lightship, n: __shipyard.model.HULL.realBlocks, cap: __shipyard.model.HULL.craneCapacity, max: Math.max(...__shipyard.model.HULL.tonnes)})')
    check(mm['sum'] < mm['ls'] and mm['n'] >= 100 and mm['max'] <= mm['cap'], f"six sample blocks ({mm['sum']} t) are far below the {mm['ls']} t lightship and each fits the {mm['cap']} t crane, so the data labels them as samples of ~{mm['n']}")
    pg.click('[data-chip="hull"]')
    check(wait_snap(pg, lambda s: s['sel'] and s['sel']['id'] == 'hull')[1], 'the hull facility card opens')
    hc = pg.inner_text('#card')
    check('대표 블록' in hc and 'representative' in hc and '약 120' in hc and 'about 120' in hc,
          'the hull card says the six drawn blocks are representative samples of a ship with about 120 blocks, in both languages')
    check('대표 블록 한 개' in hc and 'one representative block' in hc, 'and that the masses are for one block, not a share of the hull')
    pg.keyboard.press('Escape')
    check(not P.requests, f'no external requests ({P.requests[:2]})')
    check(not P.logs, f'no console errors ({P.logs[:2]})')
    P.close()


def test_tour(b):
    print('guided tour (real clicks and keys)')
    P = Page(b)
    pg = P.pg
    pg.click('#b-next')
    v, ok = wait_snap(pg, lambda s: s['stage'] == 1)
    check(ok and v['overview'] is False, 'Next goes to stage 2 and zooms in')
    poll(pg, "document.querySelector('#caption').innerText", lambda t: '용접' in t, 10)
    cap = pg.inner_text('#caption')
    check('용접' in cap and re.search('welding', cap, re.I) is not None, 'caption is bilingual for the stage')
    pg.click('#b-prev')
    check(wait_snap(pg, lambda s: s['stage'] == 0)[1], 'Prev goes back')
    pg.click('.step[data-step="4"]')
    v, ok = wait_snap(pg, lambda s: s['stage'] == 4)
    check(ok and pg.get_attribute('.step[data-step="4"]', 'aria-current') == 'step', 'the stepper jumps to stage 5 and marks it current')
    # wall clock: play for ~3 s on a 15 s stage and expect about 20 % progress, whatever the frame rate
    pg.evaluate('__shipyard.seek(1,0)')
    t0 = time.time()
    pg.click('#b-play')
    check(pg.get_attribute('#b-play', 'aria-pressed') == 'true', 'Play toggles to pressed')
    time.sleep(3.0)
    u = snap(pg)['u']
    el = time.time() - t0
    check(0.5 * el / 9 < u < 1.8 * el / 9 + 0.1, f'tour progress follows the wall clock (u={u:.2f} after {el:.1f}s of a 9 s stage)')
    pg.click('#b-play')
    s1 = snap(pg)
    time.sleep(0.8)
    s2 = snap(pg)
    check(not s2['playing'] and abs(s2['u'] - s1['u']) < 0.02, 'Pause stops progress')
    pg.click('#b-skip')
    check(snap(pg)['u'] >= 0.99, 'Skip jumps to the end of the step')
    # Skip while PLAYING: stays at the end of the selected step and pauses (it used to roll on into the next step one frame later)
    pg.evaluate('__shipyard.seek(1,0.2)')
    pg.click('#b-play')
    check(snap(pg)['playing'], 'Play is running before the Skip')
    f0 = snap(pg)['frames']
    pg.click('#b-skip')
    v, ok = wait_snap(pg, lambda s: s['frames'] >= f0 + 3, 30)      # let several real frames run after the click
    check(ok and v['stage'] == 1 and v['u'] >= 0.99 and not v['playing'], f"Skip while playing stays at the end of step 2 and pauses (stage {v['stage']}, u {v['u']:.2f}, playing {v['playing']})")
    check(pg.get_attribute('#b-play', 'aria-pressed') == 'false' and 'paused' in pg.inner_text('#status').lower(), 'the Play button is released and the status says it paused')
    pg.click('#b-play')
    v, ok = wait_snap(pg, lambda s: s['stage'] == 2, 25)
    check(ok, 'playing advances to the next stage by itself')
    pg.keyboard.press('Escape')
    check(wait_snap(pg, lambda s: not s['playing'])[1], 'Esc pauses the tour')
    pg.evaluate('document.activeElement && document.activeElement.blur()')
    pg.keyboard.press('ArrowRight')
    check(wait_snap(pg, lambda s: s['stage'] == 3)[1], 'ArrowRight steps forward')
    pg.keyboard.press('ArrowLeft')
    check(wait_snap(pg, lambda s: s['stage'] == 2)[1], 'ArrowLeft steps back')
    pg.click('#b-reset')
    v, ok = wait_snap(pg, lambda s: s['stage'] == 0 and s['overview'])
    check(ok and not v['playing'], 'Restart returns to stage 1 and the overview')
    # last stage guard and first stage guard
    pg.click('#b-prev')
    check('첫 단계' in pg.inner_text('#status'), 'Prev on the first stage says so')
    pg.evaluate('__shipyard.seek(6,1)')
    pg.click('#b-next')
    check('마지막' in pg.inner_text('#status'), 'Next on the last stage says so')
    check(not P.logs, f'no console errors ({P.logs[:2]})')
    P.close()


def test_stage_physics(b):
    print('stages show model numbers')
    P = Page(b)
    pg = P.pg
    pg.evaluate('__shipyard.seek(5,0.5)')
    v, ok = wait_snap(pg, lambda s: s['water'] > 0.5 and abs(s['drawn']['water'] - s['water']) < 0.01)
    cap = pg.inner_text('#caption')
    mt = re.search(r'수위 ([\d.]+) / 14 m', cap)
    check(ok and mt and abs(float(mt.group(1)) - v['water'] * 14) < 0.15, f'the flooding caption shows the modelled level ({mt.group(0) if mt else cap!r})')
    check('빈 도크 근삿값' in cap and 'empty-basin estimate' in cap, 'the flooding caption labels the elapsed time as an empty-basin estimate in both languages')
    pg.evaluate('__shipyard.seek(5,0.0)')
    v, ok = wait_snap(pg, lambda s: s['drawn']['water'] < 0.05)
    check(ok, 'the dock is drained at the start of stage 6')
    pg.evaluate('__shipyard.seek(5,1.0)')
    v, ok = wait_snap(pg, lambda s: s['drawn']['shipDx'] > 100)
    check(ok, 'after flooding the hull floats out of the dock')
    pg.evaluate('__shipyard.seek(4,0.5)')
    v, ok = wait_snap(pg, lambda s: isinstance(s['crane'], str) and s['placed'] >= 0)
    check(ok, f"the crane reports its phase ({v['crane']!r}) and the placed-block count")
    cap = poll(pg, "document.querySelector('#caption').innerText", lambda t: '대표 블록' in t, 10)
    check('대표 블록' in cap and 'Sample block' in cap and 'about 120 blocks' in cap and '약 120개' in cap,
          f'the block-erection caption says the block is a sample of about 120 (not the whole hull) in both languages ({cap[-120:]!r})')
    check(snap(pg)['errors'] == 0, 'no loop errors after jumping through stages')
    P.close()


def test_select(b):
    print('select a facility / system (click and keyboard)')
    P = Page(b)
    pg = P.pg
    s0 = snap(pg)
    OV_W = float(s0['viewBox'].split()[2])          # the whole-yard overview's width, before anything is selected
    check(s0['overview'] is True and s0['sel'] is None, 'the page starts on the whole-yard overview')
    pg.click('[data-chip="dock"]')
    v, ok = wait_snap(pg, lambda s: s['sel'] and s['sel']['id'] == 'dock')
    check(ok, 'a chip selects the dry dock')
    card = pg.inner_text('#card')
    check('건조 도크' in card and 'Dry dock' in card, 'the card names it in Korean and English')
    check('빈 도크' in card and 'empty-basin' in card, 'the dock card labels the flooding time as an empty-basin estimate in both languages')
    # the camera: the resulting viewBox must contain the selected facility's box AND be tighter than the whole-yard overview AND differ per facility
    # (containing alone proves nothing: the overview contains everything)
    vb = lambda: [float(x) for x in snap(pg)['viewBox'].split()]
    box_of = lambda k: pg.evaluate(f'GEO.yard.boxes["{k}"]')
    contains = lambda v_, bx: v_[0] - 1 <= bx[0] and v_[1] - 1 <= bx[1] and bx[2] <= v_[0] + v_[2] + 1 and bx[3] <= v_[1] + v_[3] + 1
    framed = lambda k, ov_w: poll(pg, '__shipyard.snapshot().viewBox', lambda s_: (lambda v_: contains(v_, box_of(k)) and v_[2] < 0.9 * ov_w)([float(x) for x in s_.split()]), 15)
    dock_vb = [float(x) for x in framed('dock', OV_W).split()]
    dock_box = box_of('dock')
    check(contains(dock_vb, dock_box) and dock_vb[2] < 0.9 * OV_W, f'the camera frames the dry dock tighter than the overview (viewBox width {dock_vb[2]:.0f} vs overview {OV_W:.0f})')
    pg.keyboard.press('Escape')
    check(wait_snap(pg, lambda s: s['sel'] is None)[1], 'Esc clears the selection')
    pg.click('[data-chip="warehouse"]')
    check(wait_snap(pg, lambda s: s['sel'] and s['sel']['id'] == 'warehouse')[1], 'a chip selects the warehouse')
    wh_vb = [float(x) for x in framed('warehouse', OV_W).split()]
    wh_box = box_of('warehouse')
    check(contains(wh_vb, wh_box) and wh_vb[2] < 0.9 * OV_W, f'the camera frames the warehouse tighter than the overview (viewBox width {wh_vb[2]:.0f})')
    check(not contains(wh_vb, dock_box) and wh_vb != dock_vb, 'the warehouse framing does not also show the dock (the camera really moves per facility)')
    pg.keyboard.press('Escape')
    check(wait_snap(pg, lambda s: s['sel'] is None)[1], 'Esc clears the selection')
    # focus survives Esc: after clicking a yard marker, Esc must leave focus on a marker (the same one), not drop it to the page body
    pg.click('[data-tag="welding"]')
    check(wait_snap(pg, lambda s: s['sel'] and s['sel']['id'] == 'welding')[1], 'a yard marker selects its facility')
    pg.keyboard.press('Escape')
    check(wait_snap(pg, lambda s: s['sel'] is None)[1], 'Esc clears a marker selection')
    ae = pg.evaluate("(() => { const e = document.activeElement; return e ? { tag: e.dataset.tag || '', cls: e.className, tn: e.tagName } : null })()")
    check(ae and ae['tag'] == 'welding' and 'tag' in ae['cls'], f'after Esc the focus is back on the welding marker, not the body ({ae})')
    # Play clears the selection and the chip must stop saying it is pressed
    pg.click('[data-chip="painting"]')
    check(wait_snap(pg, lambda s: s['sel'] and s['sel']['id'] == 'painting')[1], 'a chip selects the painting shop')
    check(pg.get_attribute('[data-chip="painting"]', 'aria-pressed') == 'true', 'the selected chip is aria-pressed')
    pg.click('#b-play')
    check(wait_snap(pg, lambda s: s['sel'] is None and s['playing'])[1], 'Play clears the selection')
    pressed = pg.evaluate("[...document.querySelectorAll('#chips [data-chip]')].filter(c => c.getAttribute('aria-pressed') === 'true').length")
    check(pressed == 0, f'and no chip stays aria-pressed ({pressed})')
    pg.click('#b-play')   # pause again
    pg.evaluate('__shipyard.seek(0,0)')
    # real click on a shop in the figure
    pg.click('#b-next')
    time.sleep(1.8)
    pt = point_in(pg, '#svg-yard .fac[data-fac="welding"]')
    check(pt is not None, 'the welding shop has a clickable point')
    if pt:
        pg.mouse.click(pt['x'], pt['y'])
        v, ok = wait_snap(pg, lambda s: s['sel'] and s['sel']['id'] == 'welding')
        check(ok, 'clicking a shop in the figure selects it')
        check(pg.evaluate("document.activeElement && document.activeElement.id") == 'card', 'focus moves to the card')
        check('용접 공장' in pg.inner_text('#card') and 'Welding shop' in pg.inner_text('#card'), 'welding card is bilingual')
    pg.click('#b-all')
    check(wait_snap(pg, lambda s: s['sel'] is None)[1], 'the card button shows all again')
    # keyboard
    pg.focus('[data-chip="quay"]')
    pg.keyboard.press('Enter')
    check(wait_snap(pg, lambda s: s['sel'] and s['sel']['id'] == 'quay')[1], 'Enter on a focused chip selects the quay')
    pg.keyboard.press('Escape')
    check(wait_snap(pg, lambda s: s['sel'] is None)[1], 'Esc clears again')
    poll(pg, "(() => { const t = document.querySelector('[data-tag=\"crane\"]'); return !!t && !t.hidden })()", bool, 30)   # the camera is still easing back after Esc: wait until the marker is on screen
    pg.focus('[data-tag="crane"]')
    check(pg.evaluate("document.activeElement && document.activeElement.dataset.tag") == 'crane', 'the crane marker takes keyboard focus')
    pg.keyboard.press('Space')
    check(wait_snap(pg, lambda s: s['sel'] and s['sel']['id'] == 'crane')[1], 'a facility tag button works with the keyboard')
    pg.keyboard.press('Escape')
    # tab order reaches the main controls
    pg.evaluate('document.activeElement.blur(); window.scrollTo(0,0)')
    seen = set()
    for _ in range(90):
        pg.keyboard.press('Tab')
        seen.add(pg.evaluate("(() => { const e = document.activeElement; return e ? (e.id || e.className.split(' ')[0] || e.tagName) : '' })()"))
    need = {'tab-yard', 'b-prev', 'b-play', 'b-next', 'b-skip', 'b-reset', 'step', 'tag', 'chip'}
    check(need <= seen, f'Tab reaches tabs, tour controls, stepper, tags and chips (missing {sorted(need - seen)})')
    focus_ring = pg.evaluate("(() => { const e = document.querySelector('#b-next'); e.focus(); const c = getComputedStyle(e); return c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) >= 2 })()")
    check(focus_ring, 'focus ring is visible on buttons')
    check(not P.logs, f'no console errors ({P.logs[:2]})')
    P.close()


def test_vessel(b):
    print('vessel: layers, explode, sliders, system focus')
    P = Page(b)
    pg = P.pg
    pg.click('#tab-vessel')
    v, ok = wait_snap(pg, lambda s: s['view'] == 'vessel')
    check(ok and pg.is_visible('#panel-vessel') and not pg.is_visible('#panel-yard'), 'the vessel tab swaps the panel')
    check(pg.get_attribute('#tab-vessel', 'aria-selected') == 'true', 'tab aria-selected follows')
    check(pg.is_visible('#controls-vessel') and not pg.is_visible('#controls-yard'), 'vessel controls replace the tour controls')
    # tabs by keyboard
    pg.focus('#tab-vessel')
    pg.keyboard.press('ArrowLeft')
    check(wait_snap(pg, lambda s: s['view'] == 'yard')[1], 'ArrowLeft on the tabs goes back to the yard')
    pg.keyboard.press('ArrowRight')
    check(wait_snap(pg, lambda s: s['view'] == 'vessel')[1], 'ArrowRight goes to the vessel')
    # layers
    pg.click('.lt[data-layer="hull"]')
    check(pg.get_attribute('.lt[data-layer="hull"]', 'aria-pressed') == 'false', 'hull toggle is released')
    disp = lambda k: poll(pg, f"getComputedStyle(document.querySelector('#lyr-{k}')).display", lambda d: True)
    check(poll(pg, "getComputedStyle(document.querySelector('#lyr-hull')).display", lambda d: d == 'none') == 'none', 'the hull layer disappears')
    check(disp('engine') != 'none', 'other layers stay')
    pg.click('.lt[data-layer="hull"]')
    check(poll(pg, "getComputedStyle(document.querySelector('#lyr-hull')).display", lambda d: d != 'none') != 'none', 'the hull layer returns')
    for k in ('engine', 'nav', 'elec', 'other'):
        pg.click(f'.lt[data-layer="{k}"]')
    hidden = poll(pg, "['engine','electrical','nav','piping','cargo','house'].every(k => getComputedStyle(document.querySelector('#lyr-' + k)).display === 'none')", bool)
    check(hidden, 'engine, electrical, navigation and other layers can be hidden')
    for k in ('engine', 'nav', 'elec', 'other'):
        pg.click(f'.lt[data-layer="{k}"]')
    # explode with the keyboard
    pg.focus('#r-explode')
    pg.keyboard.press('End')
    v, ok = wait_snap(pg, lambda s: s['explode'] == 1)
    check(ok and pg.inner_text('#o-explode') == '100%', 'explode slider goes to 100 %')
    pg.wait_for_function('__shipyard.X.explode > 0.97', timeout=20000)
    tr = pg.evaluate("document.querySelector('#lyr-nav').getAttribute('transform')")
    tr0 = pg.evaluate("document.querySelector('#lyr-hull').getAttribute('transform')")
    check(tr != tr0 and tr, f'exploding lifts the navigation layer more than the hull ({tr0} vs {tr})')
    pg.keyboard.press('Home')
    pg.wait_for_function('__shipyard.X.explode < 0.03', timeout=20000)
    check(True, 'explode returns to assembled')
    # power: real numbers from the model
    ro = lambda: pg.inner_text('#vreadout')
    txt0 = ro()
    pg.focus('#r-power')
    pg.keyboard.press('Home')
    check(wait_snap(pg, lambda s: s['power'] == 0)[1], 'power slider to 0')
    end = time.time() + 15
    while time.time() < end and '프로펠러 0 rpm' not in ro():
        time.sleep(0.2)
    check('프로펠러 0 rpm' in ro() and 'propeller 0 rpm' in ro(), 'zero power reads 0 rpm in both languages')
    pg.keyboard.press('End')
    end = time.time() + 15
    while time.time() < end and ro() != txt0:
        time.sleep(0.2)
    check('90 rpm' in txt0 and '22.0 kn' in txt0, 'full power reads 90 rpm and 22 kn')
    check(ro() == txt0, 'full power reads the same again (pure model)')
    # ballast
    pg.focus('#r-ballast')
    d0 = ro()
    pg.keyboard.press('End')
    end = time.time() + 15
    while time.time() < end and ro() == d0:
        time.sleep(0.2)
    check(ro() != d0, 'ballast changes the draft readout')
    pg.keyboard.press('Home')
    # system focus
    pg.click('[data-chip="engine"]')
    check(wait_snap(pg, lambda s: s['sel'] and s['sel']['kind'] == 'sys' and s['sel']['id'] == 'engine')[1], 'a system chip focuses the engine')
    check('기관' in pg.inner_text('#card') and 'Engine' in pg.inner_text('#card'), 'engine card is bilingual')
    check(pg.evaluate("document.querySelector('#lyr-hull').classList.contains('dim')"), 'other systems are dimmed')
    pg.click('#card .part >> nth=0')
    v, ok = wait_snap(pg, lambda s: s['sel'] and s['sel']['kind'] == 'item')
    check(ok and pg.evaluate("document.activeElement && document.activeElement.id") == 'card', 'a part button selects an item and focus stays on the card')
    check('주기관' in pg.inner_text('#card') or 'Main engine' in pg.inner_text('#card'), 'the item card shows the main engine')
    pg.keyboard.press('Escape')
    check(wait_snap(pg, lambda s: s['sel'] is None)[1], 'Esc clears the vessel selection')
    # a real click on the ship picks its item
    pt = point_in(pg, '#svg-vessel [data-item="main-engine"]')
    check(pt is not None, 'the main engine has a clickable point')
    if pt:
        pg.mouse.click(pt['x'], pt['y'])
        check(wait_snap(pg, lambda s: s['sel'] and s['sel']['id'] == 'main-engine')[1], 'clicking the engine in the figure selects it')
    # moving parts really move (compare the drawn path data a moment apart)
    for sel_, what in (('#v-radar', 'the radar scanner sweeps'), ('#v-prop', 'the propeller turns')):
        js = f"[...document.querySelectorAll('{sel_} path')].map(p => p.getAttribute('d')).join('|')"
        a = pg.evaluate(js)
        c = poll(pg, js, lambda d: d != a, 6)
        check(bool(a) and c != a, what)
    check(not P.logs, f'no console errors ({P.logs[:2]})')
    P.close()


def test_review_fixes(b):
    print('review fixes: layers, focus, propeller, claims')
    P = Page(b)
    pg = P.pg
    pg.click('#tab-vessel')
    check(wait_snap(pg, lambda s: s['view'] == 'vessel')[1], 'vessel view')
    shown = lambda k: poll(pg, f"getComputedStyle(document.querySelector('#lyr-{k}')).display", lambda d: d != 'none', 15) != 'none'     # the figure redraws on the next frame: poll
    gone = lambda k: poll(pg, f"getComputedStyle(document.querySelector('#lyr-{k}')).display", lambda d: d == 'none', 15) == 'none'
    pressed = lambda k: pg.get_attribute(f'.lt[data-layer="{k}"]', 'aria-pressed')
    # (4) a hidden system cannot be selected while still hidden: selecting reveals its layer and says so
    pg.click('.lt[data-layer="engine"]')
    check(poll(pg, "getComputedStyle(document.querySelector('#lyr-engine')).display", lambda d: d == 'none') == 'none' and pressed('engine') == 'false', 'engine layer is hidden first')
    check(poll(pg, "(() => { const t = document.querySelector('#tags .tag[data-tag=\"engine\"]'); return !!t && t.hidden })()", bool, 6) is True,
          'and its marker exists but is hidden with it')
    pg.click('[data-chip="engine"]')
    check(wait_snap(pg, lambda s: s['sel'] and s['sel']['id'] == 'engine')[1], 'selecting the hidden engine system works')
    check(shown('engine') and pressed('engine') == 'true' and snap(pg)['layers']['engine'] is True, 'the engine layer was switched back on, the figure shows it and the toggle is pressed again')
    check('다시 켰습니다' in pg.inner_text('#status') and 'switched back on' in pg.inner_text('#status'), 'the status says the layer came back, in both languages')
    # and the same for an item picked from the card of another system
    pg.click('.lt[data-layer="elec"]')
    check(poll(pg, "getComputedStyle(document.querySelector('#lyr-electrical')).display", lambda d: d == 'none') == 'none', 'electrical layer hidden')
    pg.evaluate("__shipyard.select('item', 'switchboard', 'part')")
    check(wait_snap(pg, lambda s: s['sel'] and s['sel']['id'] == 'switchboard')[1] and shown('electrical') and pressed('elec') == 'true', 'selecting a hidden item reveals its layer too')
    # hiding the layer of the selected system clears the selection (no marker or card for something that is not drawn)
    pg.click('.lt[data-layer="elec"]')
    check(wait_snap(pg, lambda s: s['sel'] is None)[1] and pressed('elec') == 'false', 'switching off the selected system\'s layer clears the selection')
    check(gone('electrical'), 'and the layer is hidden')
    pg.click('.lt[data-layer="elec"]')
    pg.click('[data-chip="nav"]')
    check(wait_snap(pg, lambda s: s['sel'] and s['sel']['id'] == 'nav')[1], 'navigation selected')
    pg.click('.lt[data-layer="other"]')
    check(snap(pg)['sel'] and snap(pg)['sel']['id'] == 'nav', 'hiding a different layer keeps the selection')
    pg.click('.lt[data-layer="other"]')
    # (5) focus after leaving an item: the show-all button disappears, so focus must land on the replacement marker, not on the body
    pg.click('#card .part >> nth=0')
    check(wait_snap(pg, lambda s: s['sel'] and s['sel']['kind'] == 'item')[1], 'an item of the navigation system is selected')
    pg.focus('#b-all')
    pg.keyboard.press('Enter')
    check(wait_snap(pg, lambda s: s['sel'] is None)[1], 'Enter on the show-all button clears the selection')
    ae = pg.evaluate("(() => { const e = document.activeElement; return e ? { tag: e.dataset.tag || '', cls: String(e.className) } : null })()")
    check(ae and ae['tag'] == 'nav' and 'tag' in ae['cls'], f'focus lands on the navigation marker, not the body ({ae})')
    # Esc from a focused vessel marker behaves the same way
    pg.click('[data-chip="elec"]')
    check(wait_snap(pg, lambda s: s['sel'] and s['sel']['id'] == 'elec')[1], 'electrical selected')
    pg.focus('#tags .tag >> nth=0')
    pg.keyboard.press('Escape')
    check(wait_snap(pg, lambda s: s['sel'] is None)[1], 'Esc clears it')
    ae = pg.evaluate("(() => { const e = document.activeElement; return e ? { tag: e.dataset.tag || '', cls: String(e.className) } : null })()")
    check(ae and ae['tag'] == 'elec' and 'tag' in ae['cls'], f'focus lands on the electrical marker after Esc ({ae})')
    # (7) the propeller angle is integrated, so changing the power never makes it jump
    pg.focus('#r-power')
    pg.keyboard.press('End')
    pg.wait_for_function('__shipyard.X.power > 0.99', timeout=20000)
    time.sleep(1.0)     # a few seconds of 'elapsed' on the clock: the old elapsed*speed formula made the jump proportional to it
    r = pg.evaluate("""(() => {
      const m = __shipyard.model, W = 2 * Math.PI, dt = 0.016;
      const wmax = m.rpmAt(1) * W / 60 / m.SHIP.visualSlow;
      const d = (a, b) => { let x = (b - a) % W; if (x < 0) x += W; return Math.min(x, W - x); };
      const a0 = __shipyard.snapshot().prop;
      const sl = document.querySelector('#r-power'); sl.value = '20'; sl.dispatchEvent(new Event('input', { bubbles: true }));
      __shipyard.advance(dt);
      const a1 = __shipyard.snapshot().prop;
      __shipyard.advance(dt);
      const a2 = __shipyard.snapshot().prop;
      return { wmax, dt, step1: d(a0, a1), step2: d(a1, a2), a0, a1 };
    })()""")
    check(r['step1'] <= r['wmax'] * r['dt'] + 1e-6 and r['step2'] <= r['wmax'] * r['dt'] + 1e-6,
          f"changing power 100 % -> 20 % moves the propeller by at most one frame of rotation (max {r['wmax'] * r['dt']:.4f} rad; moved {r['step1']:.4f}, {r['step2']:.4f})")
    check(r['step2'] > 0, 'the propeller still turns at 20 % power')
    pg.focus('#r-power')
    pg.keyboard.press('Home')
    pg.wait_for_function('__shipyard.X.power < 1e-6', timeout=40000)       # rpm goes with the cube root of power, so wait for it to be truly ~0
    r0 = pg.evaluate("(() => { const a = __shipyard.snapshot().prop; __shipyard.advance(0.5); return [a, __shipyard.snapshot().prop]; })()")
    check(abs(r0[1] - r0[0]) < 0.02, f'at 0 power the propeller stands still (moved {abs(r0[1] - r0[0]):.4f} rad in 0.5 s; at 20 % it moves ~{r["wmax"] * 0.585 * 0.5:.2f})')
    # (9) claims about safety are qualified, not absolute
    pg.click('[data-chip="hull"]')
    pg.click('#card .part:has-text("Bulkhead")')
    check(wait_snap(pg, lambda s: s['sel'] and s['sel']['id'] == 'bulkhead')[1], 'the bulkhead card opens')
    bc = pg.inner_text('#card')
    check('손상 복원성' in bc and 'damage-stability' in bc and 'lowers the risk of sinking' in bc and '위험을 줄' in bc, 'the bulkhead card qualifies the sinking claim (damage stability) in both languages')
    check('cannot sink' not in bc and 'never sink' not in bc and 'stays afloat.' not in bc, 'and makes no absolute claim')
    pg.evaluate("__shipyard.select('item', 'emergency', 'part')")
    check(wait_snap(pg, lambda s: s['sel'] and s['sel']['id'] == 'emergency')[1], 'the emergency generator card opens')
    ec = pg.inner_text('#card')
    check('기관실과 떨어진' in ec and 'separated from the engine room' in ec and '불 난 곳' not in ec and '불이 난 곳' not in ec, 'the emergency generator card says it is kept apart from the engine room (not "above the fire")')
    pg.evaluate("__shipyard.select('item', 'double-bottom', 'part')")
    check(wait_snap(pg, lambda s: s['sel'] and s['sel']['id'] == 'double-bottom')[1] and 'second barrier' in pg.inner_text('#card'), 'the double-bottom card says "second barrier" rather than "keeps the sea out"')
    check(not P.logs, f'no console errors ({P.logs[:2]})')
    P.close()


def test_reduced_motion(b):
    print('prefers-reduced-motion')
    P = Page(b, reduced_motion='reduce')
    pg = P.pg
    s = snap(pg)
    check(s['reduced'] is True and pg.evaluate("document.documentElement.dataset.motion") == 'reduced', 'honoured at load')
    check(s['u'] >= 0.99, 'a step shows its finished state at once')
    pg.click('#b-next')
    v, ok = wait_snap(pg, lambda s: s['stage'] == 1 and s['u'] >= 0.99)
    check(ok, 'Next shows the end state without animation')
    check(pg.evaluate("document.getAnimations().length") == 0, 'no running CSS animations')
    pg.click('#tab-vessel')
    radar_d = "document.querySelector('#v-radar path.scanner') ? document.querySelector('#v-radar path.scanner').getAttribute('d') : ''"
    poll(pg, radar_d, lambda d: bool(d), 10)       # the vessel is drawn a frame after the tab switch
    time.sleep(0.6)
    a = pg.evaluate(radar_d)
    time.sleep(0.8)
    c = pg.evaluate(radar_d)
    check(bool(a) and a == c, 'the radar is still')
    P.close()
    # a change after load
    P = Page(b, reduced_motion='no-preference')
    pg = P.pg
    check(snap(pg)['reduced'] is False, 'motion is on by default')
    pg.emulate_media(reduced_motion='reduce')
    v, ok = wait_snap(pg, lambda s: s['reduced'] is True)
    check(ok and pg.evaluate("document.documentElement.dataset.motion") == 'reduced', 'reacts when the preference changes after load')
    pg.emulate_media(reduced_motion='no-preference')
    check(wait_snap(pg, lambda s: s['reduced'] is False)[1], 'and when it changes back')
    P.close()


def test_phone(b):
    print('phone 390x844 and 1024x600')
    P = Page(b, viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    pg = P.pg
    sw = lambda: pg.evaluate('[document.documentElement.scrollWidth, innerWidth]')
    a, w = sw()
    check(a <= w, f'no horizontal overflow in the yard view ({a} <= {w})')
    pg.tap('#b-next')
    check(wait_snap(pg, lambda s: s['stage'] == 1)[1], 'tap on Next works')
    pg.tap('#tab-vessel')
    check(wait_snap(pg, lambda s: s['view'] == 'vessel')[1], 'tap on the Vessel tab works')
    a, w = sw()
    check(a <= w, f'no horizontal overflow in the vessel view ({a} <= {w})')
    pg.tap('[data-chip="elec"]')
    check(wait_snap(pg, lambda s: s['sel'] and s['sel']['id'] == 'elec')[1], 'tap on a system chip selects it')
    a, w = sw()
    check(a <= w, f'no horizontal overflow with a card open ({a} <= {w})')
    inside = pg.evaluate("""[...document.querySelectorAll('button, input')].filter(e => e.offsetParent !== null).map(e => { const r = e.getBoundingClientRect(); return [e.id || e.className, r.left, r.right, r.height]; }).filter(x => x[1] < -0.5 || x[2] > 390.5)""")
    check(not inside, f'every visible control sits inside the 390 px width ({inside[:3]})')
    small = pg.evaluate("""[...document.querySelectorAll('button, input')].filter(e => e.offsetParent !== null).map(e => { const r = e.getBoundingClientRect(); return [e.id || e.className, r.width, r.height]; }).filter(x => x[1] < 24 || x[2] < 24)""")
    check(not small, f'touch targets are at least 24 px ({small[:3]})')
    names = pg.evaluate("[...document.querySelectorAll('.tag')].every(t => (t.getAttribute('aria-label') || '').includes('·') || (t.getAttribute('aria-label') || '').length > 2)")
    check(names, 'phone tag markers keep a bilingual accessible name')
    # the readout must follow the sliders even when the figure itself is scrolled offscreen (it used to freeze with the figure)
    pg.evaluate("document.querySelector('#r-power').scrollIntoView({ block: 'start' })")
    off = poll(pg, '__shipyard.S.visible', lambda v_: v_ is False, 10)
    check(off is False, 'the figure is really offscreen while the power slider is at the top of the phone screen (IntersectionObserver says so)')
    ro0 = pg.inner_text('#vreadout')
    check('90 rpm' in ro0, f'full power reads 90 rpm before the change ({ro0[:60]!r})')
    pg.focus('#r-power')
    pg.keyboard.press('Home')
    got = poll(pg, "document.querySelector('#vreadout').innerText", lambda t: '0 rpm' in t and '90 rpm' not in t, 6)
    check('프로펠러 0 rpm' in got and 'propeller 0 rpm' in got and pg.inner_text('#o-power') == '0%',
          f'offscreen slider change still updates the readout and the % label ({got[:60]!r}, {pg.inner_text("#o-power")})')
    check(snap(pg)['visible'] is False, 'and the figure was still offscreen for that check (not vacuous)')
    pg.keyboard.press('End')
    got = poll(pg, "document.querySelector('#vreadout').innerText", lambda t: '90 rpm' in t, 6)
    check('90 rpm' in got, 'and back to 90 rpm at full power')
    pg.tap('#tab-yard')
    pg.tap('[data-chip="dock"]')
    check(wait_snap(pg, lambda s: s['sel'] and s['sel']['id'] == 'dock')[1], 'tap on a facility chip selects it')
    visible = pg.evaluate("(() => { const r = document.querySelector('#card').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0 })()")
    check(visible, 'the card is scrolled into view on a phone')
    check(not P.logs, f'no console errors ({P.logs[:2]})')
    P.close()
    P = Page(b, viewport={'width': 1024, 'height': 600})
    pg = P.pg
    a, w = pg.evaluate('[document.documentElement.scrollWidth, innerWidth]')
    check(a <= w, 'no horizontal overflow at 1024x600')
    r = pg.evaluate("(() => { const v = document.querySelector('#viewport').getBoundingClientRect(); const c = document.querySelector('#b-play').getBoundingClientRect(); return [v.height, c.bottom, innerHeight] })()")
    check(r[0] >= 200 and r[1] <= r[2], f'at 1024x600 the figure keeps {r[0]:.0f}px and the tour controls stay on screen')
    P.close()


def test_csp(b):
    print('real CSP page')
    P = Page(b, bypass_csp=False)
    pg = P.pg
    viol = []
    pg.on('console', lambda m: viol.append(m.text) if 'Content Security Policy' in m.text or 'Refused' in m.text else None)
    meta = pg.evaluate("document.querySelector('meta[http-equiv=Content-Security-Policy]').content")
    check("default-src 'none'" in meta and "script-src 'sha256-" in meta and "connect-src 'none'" in meta, 'the CSP meta is strict and hash-based')
    check(snap(pg)['frames'] > 3, 'the script runs under the CSP')
    pg.click('#b-next')
    pg.click('#tab-vessel')
    pg.click('[data-chip="nav"]')
    pg.focus('#r-explode')
    pg.keyboard.press('End')
    time.sleep(1.0)
    check(snap(pg)['sel']['id'] == 'nav' and snap(pg)['explode'] == 1, 'the page works under the CSP')
    check(not viol, f'no CSP violations ({viol[:2]})')
    check(not P.logs, f'no console errors ({P.logs[:2]})')
    check(not P.requests, 'no network requests')
    html = ROOT.joinpath('shipyard.html').read_text(encoding='utf-8')
    check(not re.search(r'(src|href)\s*=\s*["\']https?:', html) and 'url(http' not in html, 'no external URLs in the file')
    check(not re.search(r'\son[a-z]+\s*=\s*["\']', html), 'no inline event handlers')
    P.close()


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else ''       # optional: python3 tests/functional.py reduced
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
        for t in (test_load_and_model, test_tour, test_stage_physics, test_select, test_vessel, test_review_fixes, test_reduced_motion, test_phone, test_csp):
            if only and only not in t.__name__:
                continue
            try:
                t(b)
            except Exception as e:  # a crashing test is a failure, and the rest still run
                FAILS.append(f'{t.__name__} crashed: {type(e).__name__}: {str(e)[:300]}')
                print(f'  FAIL {t.__name__} crashed: {type(e).__name__}: {str(e)[:300]}')
        b.close()
    print(f'\n{PASSED[0]} checks passed, {len(FAILS)} failed')
    for f in FAILS:
        print('  -', f)
    sys.exit(1 if FAILS else 0)


main()
