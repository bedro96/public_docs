# Design

**World:** a Joseon-era 신형장부도 (body-and-organs chart): ink outlines and mineral pigment on warm hanji paper. The model is the hero; the interface is quiet paper panels around it.

## Colour
- Paper `#efeee6`, panel `#f6f5ee`, ink `#1f2430`, line `#c6c5b9`.
- Indigo `#2d4c7e` (helpers, links), cinnabar `#b8321f` (selection, primary action, wound), celadon `#2f6656` (progress).
- Organs use flat mineral tints with an ink outline; the cavity wall is madder-brown so organs stand out.

## Type
- Serif: Nanum Myeongjo for organ names. Sans: NanumSquareRound for UI and English. Both are subset and inlined.
- Every label is a pair: Korean large, English smaller beneath.

## 3D look
- Toon shading in three flat steps plus an ink silhouette; no gradients on skin.
- Skin: opaque with a midline slit, then a wide superellipse window with a layered wound edge (muscle, ink line, fat); it fades to a ghost outline.
- Camera: surgeon's look-down pitch ≈ 41°; drag orbits, *시점 초기화* returns to it.

## Layout
- Three columns on desktop: organ list, stage, detail. At ≤ 900 px one column with the list as a horizontal strip.
- Removed organs rest on side shelves (desktop) or a bottom shelf (portrait).
- Motion respects `prefers-reduced-motion` (the incision opens instantly).
