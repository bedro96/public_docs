# Aircraft assembly factory · 항공기 조립 공장 (Boeing 737 MAX 8)

An interactive, bilingual (한국어 first, English second) model of how a Boeing 737 MAX 8 is made, from parts to take-off. A guided tour follows **one airplane**: parts converge on Renton, Washington (the fuselage arrives from Wichita by rail, wing skins and spars come from Auburn / Frederickson, tail parts from abroad, engines from CFM), the fuselage is built up on Renton's moving line over about ten flow days, rolls out of the plant, and **takes off from Renton Municipal Airport (RNT) runway 16/34**, the way every Renton 737 leaves for Boeing Field. It is one standalone offline HTML file (`aircraft-assembly.html`, ~1.1 MB: no network, no CDN, Korean fonts inlined), drawn with the `anatomy` skill's isometric SVG kit and built like `docs/auto-factory/`.

**Unofficial educational model. Not to scale. Not affiliated with, or endorsed by, Boeing or any supplier. No logos, wordmarks or real liveries.** Every fact on the page carries a confidence tag (see below).

## What you can do
- **Follow the plane** (top right): Back, Play / Pause, Next, Skip, Restart, *Whole plant*. Eight stages, a route list with progress, a scrubber, a card per stage (what happens, key equipment, one key number, what comes in / goes out), a caption with live numbers.
- **Watch the one airplane being built**: 197 named parts (frames and stringers first, then skins; wing spars, ribs, tank and skins; tail; main and nose gear; seats row by row; engines last). Parts drop, slide or fade into place in a physically plausible order; the fuselage skin is drawn pale (x-ray) while the inside is built and goes opaque for the outside work and the flight. A "Fitting now" row names what is being installed.
- **Watch real motion**: a flat car with a locomotive bringing the four fuselage sections to Renton; the overhead crane lowering the wings and lifting the fin; jacks lifting the plane for the gear-swing test; the seat conveyor; the engine cart; the fuel truck; the roll-out through the hall door; and the finale.
- **The finale** (stage 8): the plane taxis to the runway end, lines up, spools the engines (130.4 kN each, LEAP-1B28), accelerates along the **true-length runway (1,640 m)**, rotates at about 2.5°/s to about 15°, lifts off, retracts the gear (nose gear forward, main gear inward, doors close), climbs and banks toward Boeing Field. Speed (kt), distance along the runway (m), pitch (deg), altitude (m) and thrust come from the same model that moves the plane (`src/takeoff.js`). The runway cannot be drawn compressed next to a 40 m plane without lying, so **the camera pans with the plane** and the legend says so. **Replay take-off** restarts it.
- **Numbers strip** (collapsible): 737 production-rate history and cumulative deliveries, each with a confidence tag.
- **Sources & confidence** panel: every claim grouped by how well it is known. One neutral factual sentence each about the 2019 grounding and the January 2024 door-plug accident, no commentary.
- **Keyboard**: every control is a real `<button>` with a visible focus ring. `←/→` (or `↑/↓`) previous/next, `1`–`8` pick a stage, `Home/End` first/last, `Esc` leaves *Whole plant* or pauses. These shortcuts act only while focus is on the model, the tour controls or the route list; elsewhere the keys keep their normal job.
- **Pause really pauses**: the glide stops where it stands and every moving effect (engine shimmer, sparks, pressure test, wing-tip vortices) freezes.
- **`prefers-reduced-motion`** is honoured at load and when it changes: no glide, no autoplay, no moving effects; Next/Back step through the captions instantly.
- **Tour clock**: wall-clock time without a cap (a slow GPU does not slow the tour). `STAGE_SECONDS` in `src/model.js` sets the pace: 203 s end to end (14 / 22 / 15 / 26 / 20 / 22 / 20 / 64 s).
- Layouts checked at 1366×800, 1024×600 and 390×844 portrait; no horizontal overflow.

## The eight stages
| # | Stage | What you see |
| --- | --- | --- |
| 1 | 공급망 · Supply chain | Map strip: Wichita (fuselage), Auburn / Frederickson (wing skins and spars), KAI Korea (horizontal stabilizers), Tata Boeing Hyderabad (vertical-fin structures [unverified]), CFM (LEAP-1B engines), landing gear and avionics (makers not confirmed); crates converge on a hub, then go to Renton |
| 2 | 위치타 · Wichita | Frames + stringers + skins, four sections 41/43/46/48, automated drilling and riveting [general capability only], join, primer, rail car and locomotive to Renton |
| 3 | 렌턴: 날개 · Wings | Wing bay: spars, ribs, stringers, fuel tank, skins, slats, flaps, ailerons, spoilers, winglets |
| 4 | 라인 1~4일 · Moving line, days 1–4 | Fuselage onto the raised level, floor and bulkheads, crane lowers wings, fin lifted, gear fitted (day-4 sequence is a 2026 tour report, tagged) |
| 5 | 5~7일 · Systems | Wiring and hydraulics, power on, fuel tanks, pressure test, jacks and gear swing |
| 6 | 8~10일 · Seats and engines | Seats on the conveyor, engines hung from the pylons from a cart (day ~9) |
| 7 | 롤아웃 · Roll-out | Out of the hall, fuel, engine runs, taxi |
| 8 | 이륙 · Finale | Take-off from RNT runway 16/34 |

## Build, test, run
Open `aircraft-assembly.html` in any browser (it is self-contained). To rebuild:
```bash
npm install              # esbuild only (node_modules is git-ignored)
node build.mjs           # -> aircraft-assembly.html   (needs ~/.agents/skills/anatomy/kit; linked as ./kit)
node build.mjs --audit   # same, then structural checks; ends with "audit passed (N named parts)"
node ~/.agents/skills/anatomy/scripts/lines.mjs aircraft-assembly.html   # "line ends: 0 of N ends on M lines float"
python3 tests/functional.py   # real mouse/keyboard tests in headless Chrome, exit 1 on failure (several minutes on software GL)
python3 tests/shots.py [label]   # screenshots to .shots/ (gitignored) for visual review; optional label substring
```
Fonts: `build.mjs` subsets NanumSquareRound and NanumGothicCoding from `/usr/share/fonts/truetype/nanum` with `pyftsubset` and inlines them as woff.

## Files
| Path | What |
| --- | --- |
| `src/data.js` | All bilingual content: UI strings, readout labels, the 8 stages (card, equipment, key number, in/out, timed captions), numbers strip, sources and confidence, part names |
| `src/model.js` | Pure model `stateAt(u)`: where every moving thing is, which part is attached, the camera focus, the flow-day clock, and the numbers on the readouts. No DOM |
| `src/takeoff.js` | The take-off simulation (point mass, thrust with lapse, drag, lift, rotation, gear retraction, bank). Pure; runs in Node and in the browser |
| `src/layout.js` | The plant plan: supply map, Wichita, rail, yard, Renton hall (position markers), apron, runway, in world units of 0.1 m |
| `src/world.js`, `hull.js`, `wings.js`, `tail.js`, `engines.js`, `cabin.js`, `plane.js` | Geometry: projection helpers and painter-order slots; the hero airplane as named parts |
| `src/factory.js`, `scene.js`, `apply.js` | The static plant, the empty groups that move, and the per-frame application of the model to transforms (no re-render of the scene) |
| `src/live.js`, `src/main.js` | Runtime: tour, camera, chips, readouts, keyboard, reduced motion; exposes `window.__aircraft` for tests |
| `template.html`, `style.css` | Page chrome and styling |
| `build.mjs` | esbuild bundle, font subsetting, CSP hash, scene render at build time, structural audit |
| `tests/functional.py`, `tests/shots.py`, `tests/preview.*` | Tests, screenshots, static previews |
| `research/R1_supply_structure.md`, `R2_final_assembly_flight.md` | The research the facts come from, with source URLs and confidence |
| `PRODUCT.md`, `DESIGN.md` | Product and design notes |

`window.__aircraft`: `state` (u, stage, modelStage, f, playing, seeking, overview, reduced, frames, errors, viewBox, t, fx, figVisible, day, partsAttached, partCount, `takeoff{phase, t, v_kt, dist_m, pitch_deg, alt_m, gear}`), `model(u)`, `advance(u, dt)`, `stageSeconds`, `captions`, `seek(u)`, `step(±1)`, `select(i)`, `play()`, `pause()`, `replay()`, `chipPos(i)`, `chipVisible(i)`, `routePos(i)`, `planePos()`, and two deterministic-time hooks: `hold(true)` idles the rAF loop and `tick(ms)` runs exactly one frame of `ms` wall-clock milliseconds (headless software GL delivers a real frame only every few seconds).

## Confidence tags
Every fact on the page is tagged: **[확인됨 verified]** (manufacturer, regulator or certification document), **[확인됨(2차) verified, secondary]** (a reputable trade or news report, or a company-published figure repeated elsewhere), **[추정 estimate]**, **[가정 assumption]** and **[미확인 unverified]**. The flow-day clock (about 10 flow days per line position; day-by-day tasks) is mostly secondary and is tagged as such; "11 days" (2005 figure), "22 days" (earlier) and "about 15 calendar days" (a 2026 tour report) are all shown and none is presented as the truth. Production-rate history is tagged per figure.

## Assumptions (change them in `data.js` / `model.js` / `takeoff.js`)
- **One airplane, one sequence.** Real plants build many planes at once; ghost planes down the line show that. Which step happens on which flow day follows the research (R2) and is tagged; unknown details are drawn schematically and say so.
- **The take-off is a model, not a flight record**: 68 t, 127 m², constant thrust (130.41 kN per engine, with a lapse of about 16% at 70 m/s), quadratic drag, lift linear in pitch, rotation at 130 kt and 2.5°/s to about 15°, gear up in about 10 s, an 18° bank. Result: lift-off after about 920 m at about 141 kt, inside the 1,640 m runway. Only the 130.41 kN engine rating and the runway length are verified; everything else is an estimate or an assumption, and the page says so.
- **Cranes, AGVs and tugs** are drawn only where the research supports them (the 89 ft overhead crane, jacks, engine lift, rail); otherwise they are labelled schematic.
- **Not to scale where compressed**: the 3,500 km rail leg is compressed and broken; the supply map is schematic; in the finale the runway is at true length and the camera pans.
- **Livery**: neutral. Renton planes leave the plant in primer green and are painted later at Boeing Field, which the tour says. No logos.
- **Payload**: seats, galleys and bins are installed; bags and passengers are not (a factory does not install payload).
- The user interview of the impeccable skill could not be answered, so users (13–18 year-old Korean learners, laptop/phone/projector) are inferred in `PRODUCT.md`.

## Security
The built page carries `Content-Security-Policy: default-src 'none'; script-src 'sha256-…'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`. The hash is computed from the script text as it appears in the assembled output, the build asserts exactly one inline script, and re-reads the file to verify the pinned hash. `tests/functional.py` repeats that check and opens a copy with one extra character in the script under the real CSP to prove the browser refuses it. No `eval`, no inline handlers, no network; content strings are written with `textContent`; the only `innerHTML` is SVG generated by the model's own geometry.

## Known limits
- `--audit` is a structural audit (required ids and named parts present, no duplicate ids, no external URLs / inline handlers / eval, no NaN in the scene). The kit's SDF clearance audit needs a solid registry recorded while building and is **not** run; ordering was checked visually (1× and 4× close-ups of the wing, tail, engine, gear and rotation) and the line-end check (`lines.mjs`) is clean.
- The factory interior (bays, jigs, gantries) is schematic. The research confirms the line, the raised level, the 89 ft cranes, the day-4 body join and the day-9 engine hang only in general terms; exact tooling is not public.
- Wichita's automated drilling and riveting is shown as a general capability; 737-specific cell detail is [unverified].
- Boeing Field work after take-off (paint, final checks, delivery) is described in the card but not drawn.
- The clouds in the finale are decorative.
