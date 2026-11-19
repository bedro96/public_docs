# 조선소 모형 · Shipyard model

An interactive, bilingual (한국어 / English) model of a modern shipyard and of the ship it builds, for middle- and high-school learners.

**Open `shipyard.html`** in any modern browser. It is one self-contained file (about 610 KB: kit, fonts, geometry and data are inlined) and needs no network.

## What it does

Two linked views, switched with the tabs at the top.

1. **야드 Yard.** An isometric shipyard: 자재 창고 warehouse, 절단 공장 cutting shop, 용접 공장 welding shop, 조립 공장 assembly shop, 도장 공장 painting shop, 건조 도크 dry dock with a 골리앗 크레인 goliath crane, and the 안벽 quay.
   - **Build the ship** is a seven-stage tour with *Prev / Play / Next / Skip / Restart*, a progress list, and a caption with live numbers: 1 plate and cutting · 2 welding · 3 assembly (sub-assembly → block → pre-outfitting) · 4 painting (shot blasting, primer, coating, drying) · 5 block erection in the dock (the crane really carries each of six representative blocks; the keel goes first) · 6 flooding and launch (the water rises 14 m in about 7 h of model time, the gate opens and the hull floats out) · 7 quay outfitting and sea trials.
   - Click or tap a facility (or its numbered marker, or the legend list) to zoom to it and read its bilingual card: what it does, key parts, one key number.
2. **선박 Vessel.** A cutaway 300 m container ship with its near half cut away. Five systems: 선체 hull (이중저 double bottom, 밸러스트 탱크 ballast tanks, 격벽 bulkheads, frames, shell), 기관·추진 engine and propulsion (two-stroke main engine, shaft, 프로펠러 propeller, 방향타 rudder), 항해 장비 navigation (선교 bridge, radar, ECDIS, GPS, AIS, gyrocompass, autopilot), 전기 시스템 electrical (generators, main switchboard, cable trays, emergency generator), and cargo / living / safety (holds, accommodation, HVAC, fuel and ballast piping, lifeboat, anchor).
   - **Layer buttons** show or hide each system; selecting a system dims the others and zooms to it; **분해 Explode** lifts the systems apart; **엔진 출력 Engine power** and **밸러스트 물 Ballast water** change the numbers in the readout (rpm, speed, propeller tip speed, draft) from the same model that spins the propeller and sweeps the radar.

Keyboard: every control is a real button or slider with a visible focus ring. In the yard, ←/→ step the tour; Esc clears the selection (or pauses); the tabs support ←/→/Home/End.
`prefers-reduced-motion` is honoured at load and when it changes later: finished states are shown at once, with no tweening, and the radar and propeller stay still.

## Assumptions

- The brief says "a vessel with hull, engine, navigation system, electrical system and more", so a **container ship** was chosen: it has every one of those systems and the yard builds it from six representative blocks.
- The brief's list of five systems is rendered as hull / engine / navigation / electrical / "other" (cargo, accommodation, HVAC, piping, safety).
- Everything is a schematic and **not to scale**: the dock and hull are exaggerated in depth, the propeller is drawn turning six times slower than real (the page says so), and the numbers (14 m dock, 90 rpm, 22 kn, 4,600 kW, 1,500 °C steel melting) are rounded, illustrative and internally consistent. They come from `src/model.js`.
- **The six drawn hull blocks are representative samples** (560–880 t each, one typical block of its kind). A real 300 m ship is built from about 120 blocks and weighs about 38,000 t when launched, so the six masses deliberately do not add up to the ship; the captions and the hull card say so in English and Korean.
- **Flooding time is an empty-basin estimate**: 350 × 62 × 14 m of water at a constant 12 m³/s is about 7 h. A real dock fills slightly faster because the hull displaces water; the caption and the dock card say so.
- Safety statements are qualified: a bulkhead *lowers the risk* of sinking (how well a damaged ship stays afloat depends on its damage-stability design), and the emergency generator is kept *apart from the engine room* so an engine-room fire does not stop it.
- Audience: Korean learners aged 13–18; Korean text comes first and larger, English second.
- The kit's `node build.mjs --audit` (the anatomy skill's) applies to figures with recorded pipes and tubes; this model builds its figures directly and has no such recorder, so the audit is not run. `node build.mjs --check` verifies that the page has no external URLs. `lines.mjs` reports `line ends: 0`.

## Robustness

- Strict Content-Security-Policy meta (script pinned by sha256 of the exact inline script, no network, no `eval`, no inline handlers). Playwright string predicates need `eval`, so the tests use `bypass_csp`, except one page that runs under the real CSP and asserts no violations.
- The tour, camera and every drawn quantity run on the wall clock with exponential easing toward the model's value, so a 1 fps software GPU still finishes a step on time. *Skip to end of step* is always one click away; any click gives immediate status text.
- Interaction rules worth knowing: *Skip* jumps to the end of the current step and **pauses** (a playing tour would otherwise roll into the next step); selecting a system whose layer is switched off **switches the layer back on** (and says so), and switching off the layer of the selected system clears the selection; after Esc or "show all" focus returns to the matching marker instead of dropping to the page; the vessel readout (rpm, speed, draft) and the tour caption keep updating while the figure is scrolled out of view on a phone (only the SVG redraw is skipped); the propeller angle is integrated from its angular speed, so changing power never makes it jump.
- The rAF loop is wrapped in try/catch; repeated errors show a bilingual fallback message. Work is throttled when the tab is hidden.
- Layout checked at 1366×800, 1024×600 and 390×844 portrait (no horizontal overflow, controls ≥ 24 px).

## Build and test

```bash
npm install            # nothing to install: the build has no dependencies, this just checks package.json
node build.mjs         # writes shipyard.html (needs the Nanum fonts in /usr/share/fonts/truetype/nanum and pyftsubset)
node build.mjs --check # fails if the built page references an external URL
python3 tests/functional.py   # real-input functional test (Playwright + /usr/bin/google-chrome), exit 1 on failure
python3 tests/functional.py review_fixes   # one section (match on the test function name)
SHIPYARD_HTML=/tmp/broken.html python3 tests/functional.py   # run the suite against another build, e.g. a deliberately broken copy, to prove a test can fail
python3 tests/shots.py        # screenshots of every stage and view at 3 sizes -> .shots/ (gitignored)
python3 tests/shots.py close_ # only the 1x and 4x close-ups, centred on the hook, a welding head, the propeller and the radar
```

Tests drive the page with real mouse and keyboard input and poll `window.__shipyard` (state, `seek(stage,u)`, `select(kind,id)`, `screenPos(id)`, `snapshot()`, `model`) instead of sleeping.

## Layout of the source

- `src/model.js` pure numbers (dock flooding, crane cycle, ship rpm/speed/draft), no DOM.
- `src/data.js` all bilingual `{kr, en}` content.
- `src/geo-common.js`, `geo-yard.js`, `geo-vessel.js`, `geo-dyn.js` isometric geometry built with the vendored anatomy kit (`vendor/iso-kit.mjs`).
- `src/live.js` page behaviour (state, tour, camera, tags, cards, drawing, `window.__shipyard`).
- `template.html`, `style.css`, `build.mjs`; design notes in `DESIGN.md` and `PRODUCT.md`.

## Known limits

- The yard overview is dense; the numbered markers and the legend list carry the names. The container stacks hide part of the cutaway (the "other" layer button hides them).
- The painted block at stage 4 appears at the paint shop pad without a transport vehicle.
- Fonts are subset to the glyphs the page uses (531); adding new Korean text means rebuilding.
- Tested with Chrome only (headless, software GL).
