# Automobile factory · 자동차 공장

An interactive, bilingual (English + 한국어) model of a modern car plant. A roll of steel (coil) goes in at one end of an isometric plant and a finished car drives out of the other; a guided tour follows **one car** through the coil yard and blanking, the **press shop**, **body shop**, **paint shop**, **engine shop**, **assembly shop** and final test / shipping. It is one standalone offline HTML file (`auto-factory.html`, ~1.1 MB: no network, no CDN, Korean fonts inlined), drawn with the `anatomy` skill's isometric SVG kit.

## What you can do
- **Follow the car** (top right): Previous, Play / Pause, Next, Skip, Restart, *Whole plant*. Seven stages, a route list with progress, a scrubber.
- **Pick a shop**: click a route entry, a pill on the figure, or press `1`–`7`. The camera glides to that bay, its floor lights up and the card shows: name (KO/EN), what happens, key equipment, one key number, what comes in / goes out.
- **Watch real motion**: a coil unrolling into a strip and being blanked; four presses stroking in turn on one panel (draw → trim → flange → pierce); ~21 robot arms (IK) spot-welding and laser-seaming, with sparks; the body riding the line, dipped into the ED tank, sprayed (primer, base, clear: the car's colours really change), baked in ovens; an engine built in its side bay, carried by an AGV and married to the body from below; wheels, doors, a roller (dyno) test, water test and dispatch.
- **Keyboard**: every control is a real `<button>` with a visible focus ring. `←/→` (or `↑/↓`) previous/next, `1`–`7` pick a stage, `Home/End` first/last, `Esc` leaves *Whole plant* or pauses. These shortcuts act only while focus is on the model (click it or `Tab` to it), the tour controls or the route list: with focus anywhere else the keys keep their normal job (scrolling, moving the slider), and `PgUp/PgDn` are never taken over. `Tab`/`Space`/`Enter` as usual.
- **Pause really pauses**: Pause stops a glide where it stands (the card follows the scene) and freezes every moving effect: sparks, paint spray, wheel spin, robot sway, water-test drops. The effect clock only runs while the tour plays or glides.
- **`prefers-reduced-motion`** is honoured at load and when it changes (also in the middle of a glide: the view lands on the chosen stage at once): no glide, no autoplay, no moving effects; Next/Previous step through the captions of each stage instantly (and leave *Whole plant*), and are disabled at the first / last caption.
- **Tour clock**: wall-clock time with no cap (a slow GPU or a stalled main thread does not slow the tour); the pace is per stage (`STAGE_SECONDS` in `model.js`) and crossings between stages are integrated exactly (`advanceTour`). Captions, counters, scrubber and card keep updating even when the figure is scrolled out of view; only the SVG redraw is skipped.
- Layouts checked at 1366×800, 1024×600 (slim scrubber kept) and 390×844 portrait (controls become a bottom bar; route becomes a horizontal strip).

## Build, test, run
```bash
npm install              # esbuild only (node_modules is git-ignored)
node build.mjs           # -> auto-factory.html   (needs ~/.agents/skills/anatomy/kit; linked as ./kit)
node build.mjs --audit   # same, then structural checks; ends with "audit passed"
node ~/.agents/skills/anatomy/scripts/lines.mjs auto-factory.html   # "line ends: 0 of 334 ends on 43 lines float"
python3 tests/functional.py   # real mouse/keyboard tests in headless Chrome, exit 1 on failure (~4 min on software GL)
python3 tests/shots.py        # screenshots to .shots/ (gitignored) for visual review
```
Fonts: `build.mjs` subsets NanumSquareRound and NanumGothicCoding from `/usr/share/fonts/truetype/nanum` with `pyftsubset` (fontTools; `~/.local/bin` is tried) and inlines them as woff.

## Files
| Path | What |
| --- | --- |
| `src/data.js` | All bilingual content: UI strings, readout labels, the 7 stages (card text, equipment, key number, in/out, timed captions) |
| `src/model.js` | Pure model `stateAt(u)`: where every moving thing is, and the true numbers (strip metres, press force, welds, film µm, oven °C, rpm, parts, km/h, checks). No DOM |
| `src/world.js`, `car.js`, `robot.js`, `shops.js`, `shops2.js`, `scene.js` | Geometry: projection helpers and painter-order slots, the car (43 named parts), the IK robot arm, the bays, the assembled plant SVG |
| `src/live.js`, `src/main.js` | Runtime: tour, camera, DOM, keyboard, reduced-motion; exposes `window.__factory` for tests |
| `template.html`, `style.css` | Page chrome and styling |
| `build.mjs` | esbuild bundle + font subsetting + CSP hash + scene render at build time |
| `tests/functional.py`, `tests/shots.py` | Tests and screenshots |
| `PRODUCT.md`, `DESIGN.md` | Product and design notes (impeccable skill) |

`window.__factory`: `state` (u, stage, modelStage, playing, seeking, overview, reduced, frames, errors, t, fx, figVisible…), `model(u)`, `advance(u, dt)`, `stageSeconds`, `captions`, `seek(u)`, `step(±1)`, `select(i)`, `play()`, `pause()`, `chipPos(i)`, `chipVisible(i)`, `routePos(i)`, `carPos()`, `colors()`, and two deterministic-time hooks for tests: `hold(true)` idles the rAF loop and `tick(ms)` then runs exactly one frame of `ms` wall-clock milliseconds (headless software GL delivers a real frame only every 3–4 s, so a glide cannot be observed half-way otherwise). `hold(false)` resumes real frames.

## Security
The built page carries `Content-Security-Policy: default-src 'none'; script-src 'sha256-…'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`. The hash is computed from the text between `<script>` and `</script>` **as it appears in the assembled output**, the build asserts exactly one inline script and one occurrence of every placeholder, and after writing it re-reads the file and compares the pinned hash again (`csp: script-src pinned to … verified in the output`). `tests/functional.py` repeats that check on the shipped file and opens a copy with one extra character in the script under the real CSP to prove the browser refuses it. No `eval`, no inline handlers, no network; content strings come from `data.js` and are written with `textContent`; the only `innerHTML` is SVG generated by the model's own geometry.

## Assumptions (state them, change them in `data.js`/`model.js`)
- The brief was taken as written ("press shop, body shop, paint shop, assembly shop and engine shop"). The tour has seven stages: coil yard & blanking (1), press (2), body (3), paint (4), engine (5), assembly (6), final test & shipping (7).
- The engine shop is a **side branch** that feeds the assembly line, so the tour visits it between paint and assembly, which is also where the engine is built in time to meet the body.
- Numbers are simplified typical ranges for learners, not any one maker's: coil ~20 t, 1.5 m wide, 0.7 mm thick, ~2.4 km long; tandem press line 2,000+ t (the counter shows 2,400 / 1,600 / 1,200 / 1,200 t per press), ~12 strokes/min; ~300 stamped panels and 3,000–5,000 spot welds per body (the counter climbs to ~4,500; body geometry held to about ±1 mm); paint film ED 20 + primer 30 + base 15 + clear 40 ≈ 105 µm, ovens 140–190 °C; engine machining to hundredths of a mm (bore tolerance ~10 µm); ~30,000 parts per car; 100+ end-of-line checks (the counter climbs to 120); ~1 car per minute.
- Spot welding is explained as **resistance welding**: two copper electrodes squeeze the sheets, a strong current flows, the steel's electrical resistance heats the spot until a small molten nugget fuses the sheets. The small "sparks" drawn at the robot tips are a visual cue for "welding here" (real spot welding can throw a few sparks, laser seams more), not the joining mechanism.
- The plant is **not to scale**. Doors, hood and tailgate are removed after paint and re-hung at the end of trim (as in real plants). The car model is a stylised sedan; the engine is an inline-three.
- The user interview of the impeccable skill could not be answered, so users (13–18 year-old Korean learners, laptop/phone/projector) are inferred in `PRODUCT.md`.

## Known limits
- `--audit` is a structural audit (required ids and car parts present, no duplicate ids, no external URLs / inline handlers / eval, no NaN in the scene). The kit's SDF clearance audit (`kit/audit.mjs`) needs a solid registry recorded while building; this scene is composed from many hand-placed prisms and a few lathe solids and does not keep one, so that audit is **not** run. Ordering was checked visually (screenshots at 1× and 4×) and the line-end check (`lines.mjs`) is clean.
- Non-focused bays are not dimmed; the focused bay's floor is tinted instead (dimming hundreds of groups per frame is too slow on software rendering).
- Robot arms are rebuilt as SVG while posing (~1 ms each, throttled); on a very weak device they update at a lower rate than the rest.
- The car at the marriage moment shows black wheel arches before the wheels arrive; wheels come a few seconds later in the tour.
