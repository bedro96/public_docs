"""Screenshots for visual review: python3 tests/shots.py [only-substring]   -> .shots/ (gitignored)

Every stage at 1366x800, 1024x600 and 390x844 (mobile), the whole-plant overview, the take-off beats (taxi, line-up,
roll, rotation, lift-off, gear folding, climb) and 1x / 4x close-ups around the hero plane at the junctions where
parts meet (wing lowered, tail lifted, engine on its cart, gear, rotation). Look at them: overlaps, clipped Korean,
floating parts, bare areas.
"""
import pathlib
import sys
import time
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'aircraft-assembly.html').as_uri()
OUT = ROOT / '.shots'
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
VIEWS = [('desktop', 1366, 800, {}), ('s1024', 1024, 600, {}), ('phone', 390, 844, dict(has_touch=True, is_mobile=True, device_scale_factor=2))]
# the middle of each stage, then specific beats (desktop only)
POINTS = [(f's{i + 1}', i + 0.5) for i in range(8)]
BEATS = [
    ('supply-train', 0.9), ('rail', 1.8), ('wing-lines', 2.6), ('arrive', 3.05), ('day2', 3.25), ('crane-wings', 3.6),
    ('crane-tail', 3.8), ('day5', 4.2), ('seats', 5.5), ('engine-lift', 5.9), ('rollout', 6.5), ('taxi', 7.07),
    ('lineup', 7.2), ('spool', 7.26),
]
EXTRA = {b[0] for b in BEATS}
CLOSE = [('wings', 3.62), ('tail', 3.8), ('engine', 5.9), ('gear', 4.5), ('rotate', 7.55), ('liftoff', 7.66)]


def settle(pg, u):
    # hold() + tick(): deterministic frames (software GL only delivers one real frame every few seconds); seek() snaps the camera
    pg.evaluate('(u) => { const f = window.__aircraft; f.hold(true); f.seek(u); f.tick(60); f.tick(60); }', u)
    time.sleep(0.3)


def finale_beats(pg):
    """(label, u) pairs inside the finale found from the model itself: the take-off phases."""
    return pg.evaluate("""() => {
      const m = window.__aircraft.model; const out = []; const seen = new Set();
      for (let i = 0; i <= 2000; i++) { const u = 7 + i / 2000; const s = m(Math.min(u, 8 - 1e-4)); const t = s.take;
        if (t && !seen.has(t.phase)) { seen.add(t.phase); out.push([t.phase, u + 0.004]); }
        if (t && t.gear > 0.5 && !seen.has('gear')) { seen.add('gear'); out.push(['gear', u]); } }
      out.push(['end', 8 - 2e-4]);
      return out; }""")


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else ''
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
            pts = list(POINTS)
            if name == 'desktop':
                pts += BEATS + [('to-' + a, c) for a, c in finale_beats(pg)]
            for label, u in pts:
                if only and only not in label:
                    continue
                settle(pg, u)
                pg.screenshot(path=str(OUT / f'{name}-{label}.png'))
            if not only or 'overview' in only:
                pg.evaluate('() => { const f = window.__aircraft; f.hold(true); f.seek(0); f.tick(60); }')
                pg.locator('#ctl-over').click()
                pg.evaluate('() => { for (let i = 0; i < 14; i++) window.__aircraft.tick(300); }')
                time.sleep(0.3)
                pg.screenshot(path=str(OUT / f'{name}-overview.png'))
            print(name, 'logs:', logs[:3])
            ctx.close()
        if not only:
            for scale in (1, 4):
                ctx = b.new_context(viewport={'width': 1366, 'height': 800}, bypass_csp=True, device_scale_factor=scale)
                pg = ctx.new_page()
                pg.goto(URL)
                pg.wait_for_selector('html[data-ready="1"]', state='attached', timeout=60000)
                for label, u in CLOSE:
                    settle(pg, u)
                    c = pg.evaluate('() => window.__aircraft.planePos()')
                    half = 120
                    clip = dict(x=max(0, c['x'] - half), y=max(0, c['y'] - half), width=2 * half, height=2 * half)
                    pg.screenshot(path=str(OUT / f'close{scale}x-{label}.png'), clip=clip)
                ctx.close()
        b.close()
    print('screenshots in', OUT)
    return 0


if __name__ == '__main__':
    sys.exit(main())
