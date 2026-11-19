# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
delegated: one standalone HTML file. Isometric SVG drawn with the `anatomy` skill's kit, vanilla JS, no framework, no network. Same architecture as `docs/auto-factory/` (pure `stateAt(u)` model, build-time static scene, esbuild, CSP-pinned inline script).

## Users
ASSUMED (nobody could answer an interview): Korean middle- and high-school students (13-18) in a technology class, university students in optics or manufacturing, and curious adults, alone on a laptop or phone, or projected by a teacher. Korean is the reader's language and English the reference vocabulary, so every label is a pair.

## Product Purpose
An interactive model of a smartphone camera-module plant, modelled on LG Innotek's public information. One main camera module (81 named parts) is followed from incoming parts, SMT, die and wire bonding, lens and VCM/OIS assembly, active alignment, calibration and test, to packing, and finally into a phone. The learner sees how a lens, a sensor and an actuator become a camera, what clean room it is made in, why the lens is aligned to the sensor to micrometres, and what is public fact versus best guess. Success: the learner can put the eight stages in order, say what active alignment does and why, name three parts of the module, and tell a verified number from an estimate.

## Positioning
A crafted physical model of a factory floor, with a magnifying loupe: the plant is small precise machines on an isometric plan, and the module in the loupe really assembles itself, part by part, as the tour moves along the line.

## Operating Context
Used on a laptop, a classroom projector or a phone (390 px portrait). One offline HTML file. Often run on weak or software graphics, so animation is SVG and driven by the wall clock.

## Capabilities and Constraints
- Eight stages, guided tour (Prev, Next, Play, Pause, Skip, Restart, Whole plant, Replay at the end), a route list, click or tap on a stage chip or a part, full keyboard control, reduced motion respected (and re-checked after load).
- Competitor panel, business panel and sources panel, all with per-item confidence tags.
- Facts come from two research reports kept in `research/`; anything not public is tagged [추정] / [가정]; unknowns are said to be unknown.
- No eval, no inline handlers, no network, strict CSP; no logos or marks.

## Evidence on Hand
`research/R1_lg_innotek.md` (public company data: revenue, modules, capex, sites, customer concentration, clean-room and AA history, teardown part lists) and `research/R2_process_competitors.md` (process steps, equipment classes, competitors, the corrections to earlier claims). Everything else is authored here and labelled.

## Product Principles
- The object is the explanation: the learner understands by watching the module assemble.
- Every label is bilingual, always, with the Korean set larger.
- Every number on screen comes from the same model that moves the parts, and carries a confidence tag if it is a fact.
- Honest scale: the module is shown magnified and says so; the finale compares it with the phone at real size.
- Nothing needs a manual: the first button says what it does.

## Accessibility & Inclusion
Every control is a real button with a visible focus ring, Korean text is never clipped, contrast >= 4.5:1, motion can be paused and is off under `prefers-reduced-motion`, no information is carried by colour alone (tags are words).
