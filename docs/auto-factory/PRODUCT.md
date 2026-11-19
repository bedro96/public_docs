# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
delegated: one standalone HTML file. Isometric SVG drawn with the `anatomy` skill's kit, vanilla JS, no framework, no network. Assumed because the brief asked for a single offline HTML file in the style of the earlier anatomy model.

## Users
ASSUMED (nobody could answer an interview): Korean middle- and high-school students (13–18) in a technology or science class, alone on a laptop or phone, or projected by a teacher. Korean is the learner's language and English is the reference vocabulary, so every label is a pair.

## Product Purpose
An interactive model of a modern automobile plant. A roll of steel (a coil) goes in at one end and a finished car drives out of the other. The learner follows one car through the five shops (press, body, paint, engine, assembly) plus the coil yard and shipping, sees the machines work, and reads what each shop does, the key equipment, one key number and what comes in and goes out. Success: the learner can put the five shops in order, say what each does to the car, and quote one true number for each.

## Positioning
A crafted physical model of a factory floor, not a flow-chart: the plant is drawn as small, precise machines on an isometric plan, and the steel really turns into a car as the tour moves along the line.

## Operating Context
Used on a laptop, a classroom projector or a phone (390 px portrait). One offline HTML file. Often run on weak or software graphics, so animation is SVG and driven by the wall clock.

## Capabilities and Constraints
- Seven stages: coil yard and blanking, press shop, body shop, paint shop, engine shop, assembly shop, final test and shipping.
- Guided tour (Prev, Next, Play, Pause, Restart), a route list, click or tap on a shop, full keyboard control, reduced motion respected (and re-checked after load).
- Facts are simplified for school learners and given as typical ranges, not any one maker's figures.
- No eval, no inline handlers, no network, strict CSP.

## Evidence on Hand
No supplied imagery or data. All shapes, text and numbers are authored here from general knowledge of automotive manufacturing and are illustrative.

## Product Principles
- The object is the explanation: the learner understands by watching the steel change into a car.
- Every label is bilingual, always, with the Korean set larger.
- Every number on screen comes from the same model that moves the parts.
- Nothing needs a manual: the first button says what it does.

## Accessibility & Inclusion
Every control is a real button with a visible focus ring, Korean text is never clipped, contrast ≥ 4.5:1, motion can be paused and is off under `prefers-reduced-motion`.
