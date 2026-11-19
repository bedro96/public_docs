# Camera module factory · 카메라 모듈 공장

An interactive, bilingual (한국어 + English) model of a **smartphone camera-module plant**, modelled on what is publicly known about LG Innotek (LG이노텍), a supplier of iPhone-class camera modules. A guided tour follows **one main (wide) camera module** from incoming parts, through SMT, die and wire bonding, lens and VCM/OIS assembly, **active alignment**, calibration and test, to packing, and then drops it into a generic phone. It is one standalone offline HTML file (`camera-module-factory.html`, ~1.8 MB: no network, no CDN, Korean fonts inlined), drawn with the `anatomy` skill's isometric SVG kit.

The page has **two pictures side by side**: the *plant* (a schematic factory on an isometric plan, the module is a small carrier on the line) and the *loupe* (the same module magnified, 81 named parts, assembling stage by stage from the same model). The loupe is for understanding, not to scale: the module is real-size about 15 mm (an estimate; no public iPhone module dimension was found) and is drawn far larger, with a 5 mm bar and a 15 mm-vs-phone strip at the end.

## What you can do
- **Follow the module** (top right): Previous, Play / Pause, Next, Skip, Restart, *Whole plant*. Eight stages, a route list with progress, a scrubber.
- **Eight stages**: (1) materials in and the clean-room entry, (2) substrate SMT, (3) sensor die bond, wire bond and IR filter, (4) lens barrel, VCM and OIS actuator, (5) **active alignment** (the hero station: chart, collimator, six-axis stage, live MTF at five points, adhesive, UV flash, oven), (6) OIS/AF calibration, optical test and yield, (7) packing and logistics, (8) **phone assembly**: the module drops into a generic phone back, the flex tail plugs into the logic board, screws and gasket, the back closes, the phone flips; a real-size strip compares the module with the phone (149.6 x 71.5 x 8.25 mm class). A **Replay** button restarts the tour.
- **Pick a part**: click a part in the loupe or in the parts list; its bilingual name, material and confidence tag appear. Stage 1 lists the whole bill of materials (81 parts); every later stage lists the parts it adds.
- **Three panels**: *다른 회사는? · How others do it* (Sunny Optical, Largan, Samsung Electro-Mechanics, Cowell, MCNEX, Foxconn / Sharp, Q Technology; FIT / Truly / AAC are shown honestly as a data gap), *사업 현황 · Business context* (verified numbers only, with year and source id), and *근거와 신뢰도 · Sources & confidence* (every source, the tag legend, the disclaimer).
- **Confidence tags** on every fact: `[확인됨]` verified, `[확인됨(2차)]` verified by a secondary source, `[추정]` estimate, `[가정]` assumption, `[미확인]` unverified, `[자료 없음]` data gap. Moving numbers (MTF, yield, temperature, counts) come from the pure model and are labelled illustrative where they are.
- **Keyboard**: every control is a real `<button>`. `←/→` (or `↑/↓`) previous/next, `1`-`8` pick a stage, `Home/End` first/last, `Esc` leaves *Whole plant* or pauses (or clears a part pick in the loupe). These shortcuts act only while focus is on the plant figure, the tour controls or the route list; `PgUp/PgDn` are never taken over.
- **Pause really pauses** (a glide stops where it stands; every moving effect freezes). **`prefers-reduced-motion`** is honoured at load and when it changes: no glide, no autoplay, Next/Previous step through the 41 captions instantly.
- **Tour clock**: wall-clock time with no cap; per-stage pace is `STAGE_SECONDS` in `model.js` (9, 10, 12, 13, 20, 14, 10, 20 s = 108 s).
- Layouts checked at 1366x800, 1024x600 and 390x844 portrait (controls become a fixed bottom bar; the page scrolls).

## Build, test, run
```bash
npm install              # esbuild only (node_modules is git-ignored)
node build.mjs           # -> camera-module-factory.html   (needs ~/.agents/skills/anatomy/kit; linked as ./kit)
node build.mjs --audit   # same, then structural checks; ends with "audit passed (81 module parts, ...)"
node ~/.agents/skills/anatomy/scripts/lines.mjs camera-module-factory.html   # "line ends: 0 of ..."
python3 tests/functional.py   # real mouse/keyboard tests in headless Chrome, exit 1 on failure (several minutes on software GL)
python3 tests/shots.py        # screenshots to .shots/ (gitignored) for visual review
```
Open `camera-module-factory.html` directly in a browser (double-click); nothing is fetched. Fonts: `build.mjs` subsets NanumSquareRound and NanumGothicCoding from `/usr/share/fonts/truetype/nanum` with `pyftsubset` (fontTools) and inlines them as woff.

## Files
| Path | What |
| --- | --- |
| `src/data.js` | All bilingual content: UI strings, tags, the 8 stages (card text, equipment, key number, timed captions), competitors, business numbers, sources |
| `src/model.js` | Pure model `stateAt(u)`: where every moving thing is and the numbers (parts placed, wires, AA search/MTF/error, dispense/UV/bake, temperature, yield funnel, packing, phone steps). No DOM |
| `src/parts.js`, `mod.js`, `order.js` | The hero module: 81 named parts (geometry, material, stage, tag), the exploded poses per stage, painter order, loupe camera boxes |
| `src/rig.js`, `phone.js` | The active-alignment rig (chart, collimator, six-axis stage, UV lamp) and the phone (back, plateau, logic board, back view, scale strip) |
| `src/world.js`, `layout.js`, `robot.js`, `shops.js`, `shops2.js`, `scene.js` | The plant: projection, bays, clean-room shell and FFU ceiling, machines, AGV/OHT/conveyors, the static SVG scenes |
| `src/live.js`, `liveloupe.js`, `panels.js`, `main.js` | Runtime: tour, plant camera, loupe camera and HUD, cards and dialogs, keyboard, reduced motion; exposes `window.__camfactory` |
| `template.html`, `style.css` | Page chrome and styling |
| `build.mjs` | esbuild bundle + font subsetting + CSP hash + scene render at build time + `--audit` |
| `research/` | R1 (LG Innotek: public facts) and R2 (process and competitors), the sources behind every tag |
| `tests/functional.py`, `tests/shots.py` | Tests and screenshots |
| `PRODUCT.md`, `DESIGN.md` | Product and design notes |

`window.__camfactory`: `state` (u, stage, modelStage, f, playing, seeking, overview, reduced, frames, errors, t, fx, figVisible, finished, replayShown, partSel, dialog, viewBox, loupeViewBox, loupeView), `model(u)`, `advance(u, dt)`, `stageSeconds`, `captions`, `partCount`, `seek(u)`, `step(+-1)`, `select(i)`, `play()`, `pause()`, `chipPos(i)`, `routePos(i)`, `chipVisible(i)`, `partPos(id)`, `partShown()`, `partOrder()`, `pickPart(id)`, and two deterministic-time hooks for tests: `hold(true)` idles the rAF loop and `tick(ms)` then runs exactly one frame of `ms` wall-clock milliseconds. `hold(false)` resumes real frames.

## Security
The built page carries `Content-Security-Policy: default-src 'none'; script-src 'sha256-...'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`. The hash is computed from the script exactly as it appears in the assembled output; the build asserts one inline script and one occurrence of every placeholder and re-reads the output to compare the pinned hash. `tests/functional.py` repeats that on the shipped file and opens a copy with one extra character under the real CSP to prove the browser refuses it. No `eval`, no inline handlers, no network; content strings are written with `textContent`; the only `innerHTML` is SVG generated by the page's own geometry.

## Honesty notes (read these)
- **Unofficial, educational, not to scale, no affiliation, no logos or marks.** The plant is a schematic of this page's own drawing, not any real plant's layout, size or speed. The phone is generic (no brand mark).
- **What is public fact and what is best guess is tagged per item.** Public facts (LG Innotek's revenue, module output, capex; the iPhone camera module's parts from teardowns; the 2015-17 Gwangju "Class 10" clean room and in-house active alignment) come from research R1/R2. The process order, the bay layout, machine counts, cycle times, yield funnel (about 93 % cumulative) and the AA numbers shown (centre MTF 72 %, corners 48 %) are **best guesses** or illustrative.
- **Module size**: the module body is drawn at about 15 x 15 mm [estimate]; research found no public iPhone module dimension, so the "8-12 mm class" of the brief is not used as a fact. The page never prints a literal magnification ("x40"): it says "drawn magnified, not to scale" and gives a 5 mm bar.
- **Clean room**: "Class 10" is claimed only for the bond-to-AA core and only as the 2015-17 Gwangju secondary-source fact. Overpressure arrows are **not** drawn (no source). Test-cabinet and AA-cell counts are schematic [assumption].
- **Not claimed**: Hai Phong investment or monthly-output figures, any AA-machine vendor, and any competitor's layout (none is published). FIT / Truly / AAC are a data gap.
- Business numbers shown (2025 revenue KRW 21.90 T, optics 83.6 %, top customer about 80 %, 483 M modules, utilisation 81.7 %, optics capex KRW 341.1 B) are only those the research marked verified or verified-secondary.

## Known limits
- `--audit` is a structural audit (81 module parts present, no duplicate ids, no external URLs / inline handlers / eval, no NaN). The kit's SDF clearance audit is not run (the scene is composed of hand-placed prisms and lathe solids without a solid registry). Ordering was checked visually at 1x and 4x.
- The plant is long and thin (about 7:1), so *Whole plant* shows it small; the tour camera frames one bay at a time.
- Software GL renders about one frame every few seconds; the page is wall-clock driven, so it stays correct, only less smooth.
