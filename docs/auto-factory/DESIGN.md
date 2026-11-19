# Design

**World:** an engineering drawing of a plant on warm paper: ink outlines, white solids with three quiet shading steps, and one lit accent (signal orange, `#d9481f`) that always means "this is where to look" (the focused bay floor, the current route entry, the car's painted body, sparks, the live numbers). The plant is the hero; the interface is a few paper panels around it. This matches the instrument figures of the `anatomy` skill and the earlier human-organs model.

## Colour
- Paper `#efeee8`, panel `#f8f7f2`, ink `#1c1e24`, line `#cfcdc3`.
- Accent `#d9481f` (hover/pressed `#b73a12`, tint `#f6d9cc` for the focused bay floor). Done steps use a green `--ok`.
- The car is painted by CSS variables (`--cp --ct --c0..c3` on `#car`): bare steel (grey), ED coat (near-black), primer (grey), base coat (orange), clear (adds a gloss highlight). The painted body is the one big accent mass in the plant.
- Everything else (machines, floors, gantries) is white/grey so that the moving car, robot sparks and spray carry the colour.

## Type
- Nanum Square Round (400/700) for Korean and English UI; Nanum Gothic Coding (700) for the live numbers. Both are subset to the glyphs the page uses and inlined as `woff`, so Hangul renders offline.
- Every label is a pair: Korean first (700, larger), English beneath (400, 0.84em, darker grey). Paragraph measure stays between 45 and 75 characters.
- Card title 21 px, body 15–16 px, captions 12–13 px. No text under 10 px.

## Layout
- **Wide (≥ 900 px):** the page never scrolls. Left: the plant figure (fills the height), the caption ("Happening now" / "지금 일어나는 일"), a scrubber. Right (372 px): the route list (7 entries), then the stage card (scrolls inside its column). Controls sit top-right: Prev, Play/Pause (the one filled accent button), Next, Skip, Restart, Whole plant.
- **Compact (< 900 px):** one column: figure (44 dvh), caption, scrubber, route as a horizontal scroll strip, card. Controls become a fixed bottom bar of 44–52 px targets; English labels on buttons are dropped, the Korean label and icon stay.
- **1024×600:** the subtitle and some padding are removed and the scrubber shrinks to a slim 22 px row, so the figure keeps ≥ 270 px height and the scrubber stays reachable.

## The figure
- One isometric plant (1500×600 viewBox, azimuth 60°) with the five shops as bays along a flow line (+x): coil, press, body, paint, assembly, shipping; the engine shop is a side bay behind the assembly bay and feeds it on an AGV.
- Because the plant is ~2.9:1, the **camera** frames one bay at a time (exponential viewBox easing on the wall clock). It follows the car through paint and assembly, and on narrow screens through the body shop too. *Whole plant* shows everything.
- Focus is shown by tinting the bay floor and a pill chip; other bays are not dimmed (dimming hundreds of groups every frame is too slow on software rendering).
- Painter's order is explicit: slots `back → work → front → fx`. Each static part is depth-sorted inside its slot; moving workpieces (coil, panel, car, engine) live in the `work` slot, and parts that must hide them (gantry beams, near robots) live in `front`.

## Motion
- Everything is driven by `stateAt(u)` (pure, `src/model.js`), where `u` = stage + fraction. The tour moves `u` along the wall clock; Next/Prev/route clicks ease `u` exponentially; the numbers on screen (strip metres, press force, panels, welds, film µm, oven °C, rpm, parts, km/h, checks) are read from the same state that places the parts.
- `prefers-reduced-motion` (checked now and on change): no glide, no Play; Next/Prev step through the captions of each stage instantly, the camera snaps, CSS transitions are cut.
- Long phases have Skip; every click gives immediate feedback in a polite live region.

## Components
- Route entry: number disc, Korean + English name, a 4 px progress bar along the bottom; current = ink outline, done = green disc.
- Chip on the figure: pill with number and names (numbers only when the figure is < 640 px wide, with an enlarged hit area).
- HUD: up to three live readouts, label pair on the left, tabular mono value on the right.
- Card: name pair and `n / 7`; what happens (KO then EN); key equipment (2-col list); key number; in / out.

## Don'ts
No gradients, glass or blur; no emoji or glyph icons (inline SVG shapes only); no coloured side-stripes; no nested cards; no new accent colours.
