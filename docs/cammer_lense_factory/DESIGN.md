# Design

**World:** an engineering drawing of a plant and its product on warm paper: ink outlines, white solids with three quiet shading steps, and one lit accent (signal orange, `#d9481f`) that always means "this is where to look" (the current route entry, the module carrier on the line, the selected part, the live numbers). The one other hue is **UV violet** (`#6b5bd2`), used only for the UV lamp and its cone. The module (loupe) is the hero; the plant is its context; the interface is a few paper panels around them. Same family as `docs/auto-factory/`.

## Colour
- Paper `#efeee8`, panel `#f8f7f2`, ink `#1c1e24`, secondary ink `#4a4d57`, line `#cfcdc3`.
- Accent `#d9481f` (ink `#b73a12`, tint `#f6d9cc`). Done steps use green `#2f6b57`. UV violet only for UV.
- Confidence tags are words in small chips (`확인됨`, `추정`, `가정`, ...), never colour alone.
- Clean-room volume is a pale blue-grey translucent wall tint; FFU ceiling units are small white boxes.

## Type
- Nanum Square Round (400/700) for Korean and English UI; Nanum Gothic Coding (700) for the live numbers. Subset to the glyphs used and inlined as `woff`.
- Every label is a pair: Korean first (700, larger), English beneath (400, 0.84em, darker grey). Body text 14 px and up; HUD and tag micro-labels 10-12 px as in the reference.

## Layout
- **Wide (>= 900 px):** the page never scrolls. Left: the plant figure and the loupe figure side by side (`11fr 9fr`), the caption ("Happening now"), a scrubber, the business strip. Right (372 px): panel buttons (compare, business, sources), the route list (8 entries), the stage card, the parts list. Controls top-right.
- **Compact (< 900 px):** one column, controls become a fixed bottom bar of 44 px+ targets; the page scrolls.
- **1024x600:** subtitle and padding are trimmed; both figures keep >= 220 px height; the AA overlay adapts to the width of the loupe frame by container queries (one column and MTF only when the frame is narrower than 400 px).

## The two figures
- **Plant** (1500x600 viewBox, isometric): bays along +x (receiving, SMT, bond, lens/VCM, AA, test, pack, dock), the clean-room shell with air shower, pass-through and FFU ceiling, conveyors, AGV/OHT, robots. The camera frames one bay at a time (exponential viewBox easing on the wall clock). The module carrier is a small orange-marked tray on the line, with a dashed ring that points to the loupe.
- **Loupe** (2600x1500 viewBox): the module as an exploded, assembling, named-part model; one camera per view (`jig`/bill of materials, `mod`, `tall` stack, `aa`, `aaclose`, `oven`, `tray`, `carton`, `phone`, `recess`, `flexrt`, `back`). At the AA station the loupe shows chart, collimator, six-axis stage and UV lamp, with an overlay: phase, MTF at five points, six-axis error. At the finale it shows the back view with a 15 mm vs phone strip.
- Painter's order is explicit and derived (`order.js`); moving parts are transformed as groups (no per-frame re-render of paths), so software GL stays responsive.

## Motion
- Everything is driven by `stateAt(u)` (pure, `src/model.js`). The tour moves `u` along the wall clock; Next/Prev/route clicks ease `u` exponentially; every number on screen is read from the same state that places the parts.
- `prefers-reduced-motion` (checked now and on change): no glide, no Play; Next/Prev step through the captions instantly, cameras snap, CSS transitions are cut.
- Calm motion only: no flashing (the UV phase is a smooth ramp of a steady violet cone, not a strobe).

## Components
- Route entry: number disc, Korean + English short name, a 4 px progress bar; current = ink outline, done = green disc.
- Chip on the plant figure: pill with number and names (numbers only below 640 px).
- HUD: live readouts (label pair left, tabular mono value right); the AA overlay replaces it at stage 5.
- Card: name pair, what happens, key equipment with tags, one key number with tag, in/out, notes; stage 1 adds the clean-room class legend, stage 6 the yield funnel.
- Dialogs: native `<dialog>`; compare grid of company cards, business list, sources list with the tag legend.

## Don'ts
No gradients, glass or blur; no emoji or glyph icons (inline SVG shapes only); no coloured side-stripes; no nested cards; no new accent colours; no logos or brand marks.
