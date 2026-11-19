# Design

**World:** a naval architect's drafting sheet: cool blue-grey paper, ink linework, one safety-orange accent for the thing that is lit or selected. The model is the hero; the interface is quiet panels around it. It is a sibling of the anatomy instrument figures but reads maritime where the organ chart read Joseon.

## Colour
- Paper `#eaeff2`, panel `#f7f9fa`, figure ground `#f3f6f7`, ink `#14222e`, secondary ink `#4a5b69`, rule `#c3cfd7`.
- Maritime blue `#1f5f8b` (progress, sliders, water tones), safety orange `#c2410c` (primary action, current step, selection, goliath crane `#e0702a`).
- Focus ring `#0b5cad`, 3 px with 2 px offset.
- Figure surfaces are flat tints that flow through the kit's own variables (`--anatomy-paper/face/top/shade-0..3`) so the isometric faces keep three flat steps of shade: concrete greys for the yard, steel blue for the hull and machinery, container red, blue, ochre and green for cargo.
- Water is a translucent blue (`#9ccae0` top, `#5f9fc4` band); it is the only large saturated area in the yard.

## Type
- Headings: NanumSquare Bold (`Square`). Body and labels: NanumBarunGothic (`Barun`), 400 and 700. Both are subset to the glyphs the page uses and inlined as woff, so Hangul renders offline. Numerals in markers and readouts use the system monospace.
- Every label is a pair: Korean first (bold, larger), English beneath (regular, ~84 %, secondary ink). In running text the Korean paragraph comes first and the English follows in a smaller size. `word-break: keep-all` keeps Korean words whole.

## 3D look
- The anatomy kit's isometric look: solids painted back to front, three flat shades plus an ink-grey edge, no gradients. The yard uses azimuth 45° / elevation 30°, the vessel azimuth 58° / elevation 28°.
- Shops are cutaways (back wall, low side wall, two front columns, a translucent back roof strip) so the work inside is visible.
- One lit accent at a time: the goliath crane (orange) in the yard, the radar beam and selection ring on the vessel.

## Layout
- Desktop (≥ 861 px): the stage on the left (figure, tour or system controls, caption) and a 330 px side column (card, then a numbered legend of facilities or systems). At 1024×600 the side column narrows to 290 px, the stepper stays bilingual and the figure keeps at least 200 px of height.
- ≤ 860 px: one column. The figure first, then controls, then the card and the legend. The tags become numbered markers (names are in `aria-label`s and in the legend).
- The first view of the yard is the whole yard; the first tour action or selection zooms the camera (eased viewBox) to the stage or facility.

## Motion
- All motion is time-based: the camera and every drawn quantity (water level, ship position, crane position, rope length) follow the pure model with exponential easing; the tour advances by wall-clock seconds, never per frame. Radar and propeller are driven by the model's rpm (the propeller is shown six times slower than real, and the page says so).
- `prefers-reduced-motion`: no tweening, finished states, still radar and propeller, no CSS animation; it reacts to changes after load.
