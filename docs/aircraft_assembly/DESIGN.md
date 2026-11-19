# Design

**World:** an engineering drawing of a plant and an airfield on warm paper: ink outlines, white and pale-grey solids with three quiet shading steps, and one lit accent (signal orange, `#d9481f`) that always means "this is where to look" (the selected stage chip, the current route entry, the live numbers, sparks and the Replay button). The airplane is the hero: a pale aluminium frame that turns primer green as it is skinned, so it is the one coloured mass on the plan. The interface is a few paper panels around the figure. This matches the instrument figures of the `anatomy` skill and the earlier auto-factory model.

## Colour
- Paper `#efeee8`, panel `#f8f7f2`, ink `#1c1e24`, secondary ink `#4a4d57`, line `#cfcdc3`.
- Accent `#d9481f` (hover/pressed `#b73a12`, tint `#f6d9cc`). Done steps use a green `--ok` (`#2f6b57`).
- Material classes on the airplane's parts (`.m-al` bare aluminium, `.m-green` primer, `.m-comp` composite grey, `.m-steel`, `.m-dark`, `.m-eng`, `.m-fuel`, `.m-yellow` for cranes and carts, `.m-red` for the locomotive). Before the join at Wichita the fuselage is bare aluminium (`#pwrap[data-primed="0"]`); after it, primer green. No livery, no logos.
- Everything else (hall, floors, gantries, runway) is white, grey or paper so that the airplane and the orange accent carry the colour. Clouds in the finale are off-white with a hairline outline.
- Confidence tags are words in small pills (verified / secondary / estimate / assumption / unverified): never colour alone.

## Type
- Nanum Square Round (400/700) for Korean and English UI; Nanum Gothic Coding (700) for the live numbers. Both are subset to the glyphs the page uses (572 glyphs) and inlined as `woff`, so Hangul renders offline.
- Every label is a pair: Korean first (700, larger), English beneath (400, smaller, darker grey). Paragraph measure stays between 45 and 75 characters.
- Card title 21 px, body 14–16 px, captions 12–13 px, legend 12 / 10.5 px. Nothing is clipped.

## Layout
- **Wide (≥ 900 px):** the page never scrolls. Left: the figure (height `clamp(250px, 44dvh, 520px)`), the caption ("Now" / "지금"), a scrubber. Right (≈ 372 px): the route list (8 entries), then the stage card (scrolls inside its column), then the collapsible numbers strip. Controls sit top-right: Back, Play/Pause (the one filled accent button), Next, Skip, Restart, Whole plant, Sources & confidence.
- **Inside the figure:** HUD (top left: the live numbers and a "Fitting now" row), legend (bottom left: "Not to scale…"), Replay take-off button (bottom right, finale only), stage chip and label chips over the plan.
- **Compact (< 900 px):** one column: figure, caption, scrubber, route as a horizontal strip, card. Controls become a fixed bottom bar of 44–52 px targets; English labels on buttons are dropped, the Korean label and icon stay. Chips become numbered discs.
- **1024×600:** the subtitle and some padding are removed and the scrubber shrinks to a slim row, so the figure keeps its height.

## The figure
- One isometric world (azimuth 60°, elevation 30°; units of 0.1 m) laid out left to right in time order: supply map, Wichita, rail, Renton yard, the hall with the numbered line positions and the wing bay, the apron, the runway (1,640 m, true length).
- The world is far wider than any screen, so the **camera** frames one place at a time (exponential viewBox easing on the wall clock). It follows the airplane through the line and, in the finale, **pans along the runway** leading the plane and rising with the climb. *Whole plant* shows everything, compressed.
- Painter's order is explicit: `back` (static world, sky) → `work` (jigs, crates, train) → ghost airplanes → far-side helpers → shadow and cradle → **the airplane** → near-side helpers → `front` (columns, near gantries) → effects (vortices) → overhead crane. Each static part is depth-sorted inside its slot.
- Focus is shown by a chip; the other bays are not dimmed (dimming hundreds of groups per frame is too slow on software rendering).
- Chip rules: the selected chip stays inside the figure and above the legend; when the camera pans away from its anchor (finale) it is pinned to the top right, clear of the HUD.

## Motion
- Everything is driven by `stateAt(u)` (pure, `src/model.js`), where `u` = stage + fraction. The tour moves `u` along the wall clock; Next/Back/route clicks glide `u` exponentially; the numbers on screen come from the same state that places the parts. The take-off numbers come from `takeoffAt(t)` in `src/takeoff.js`.
- The scene is never re-rendered per frame: the plane, crane, train, carts and shadow are groups moved with `transform`; part visibility is a toggle on named groups; only the few effect paths (shimmer, vortices, hose, crane cable) change `d`.
- `prefers-reduced-motion` (checked now and on change): no glide, no Play; Next/Back step through the captions of each stage instantly, the camera snaps, CSS transitions are cut.
- Long phases have Skip; every click gives immediate feedback in a polite live region.

## Components
- Route entry: number disc, Korean + English name, a 4 px progress bar along the bottom; current = ink outline, done = green disc.
- Chip on the figure: pill with number and names. Label chips (non-interactive) name places: "Wichita · fuselage plant", "Raised level (days 1–3)", and so on.
- HUD: up to five live readouts, label pair on the left, tabular mono value on the right.
- Card: name pair and `n / 8`; what happens (KO then EN); key equipment; key number with its tag; in / out.
- Sources dialog: groups, one item per claim with its confidence pill.
- Numbers strip: bars for the production-rate history, cumulative deliveries, line rate; each row has a tag.

## Don'ts
No gradients, glass or blur; no emoji or glyph icons (inline SVG shapes only); no coloured side-stripes; no nested cards; no new accent colours; no logos or liveries.
