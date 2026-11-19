# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
delegated: one standalone HTML file. Isometric SVG drawn with the `anatomy` skill's kit, vanilla JS, no framework, no network. Assumed because the brief asked for a single offline HTML file in the style of the earlier anatomy and auto-factory models.

## Users
ASSUMED (nobody could answer an interview): Korean middle- and high-school students (13–18) in a technology or science class, alone on a laptop or phone, or projected by a teacher. Korean is the learner's language and English is the reference vocabulary, so every label is a pair.

## Product Purpose
An interactive model of how one Boeing 737 MAX 8 is made, from parts to take-off. The learner follows a single airplane from the supply chain (a fuselage by rail from Wichita, wing parts from Auburn, engines from CFM) through fuselage and wing fabrication, Renton's moving final-assembly line (about ten flow days), the roll-out, and a take-off from Renton Municipal Airport. Along the way the airplane is built up part by part (197 named parts), and each stage shows what happens, the key equipment, one key number, and what comes in and goes out. Success: the learner can put the stages in order, say which big parts come from where and when they are joined, and quote one true number per stage, while also knowing how sure each number is.

## Positioning
A crafted physical model of a factory floor and an airfield, not a flow chart: the airplane really gets its frames, skins, wings, tail, gear, seats and engines as the tour moves along the line, and at the end it flies. Every fact is tagged with how well it is known (verified, secondary, estimate, assumption, unverified), which is the point of difference from a glossy brochure.

## Operating Context
Used on a laptop, a classroom projector or a phone (390 px portrait). One offline HTML file. Often run on weak or software graphics, so the animation is SVG transforms on grouped nodes, driven by the wall clock. The take-off is a simple physical model and is labelled as one.

## Capabilities and Constraints
- Eight stages: supply chain, Wichita fuselage, Renton wings, moving line days 1–4, systems days 5–7, seats and engines days 8–10, roll-out and ground checks, take-off finale (with Replay).
- Guided tour (Back, Next, Play, Pause, Skip, Restart, Whole plant), a route list, click or tap on a stage chip, full keyboard control, reduced motion respected (and re-checked after load).
- Not-to-scale legends wherever space is compressed; in the finale the runway is true length (1,640 m) and the camera pans.
- Unofficial and educational: no Boeing or supplier logos, wordmarks or liveries; no affiliation claimed. The 2019 grounding and the 2024 door-plug accident appear as one neutral factual sentence each in the sources panel, with no commentary.
- No eval, no inline handlers, no network, strict CSP.

## Evidence on Hand
Two research reports with sources and confidence (`research/R1_supply_structure.md`, `research/R2_final_assembly_flight.md`): the supply and structure story, and final assembly, roll-out and first flight from Renton. No supplied imagery. All shapes are authored here; the take-off is a point-mass simulation whose only verified inputs are the engine rating (130.41 kN) and the runway length.

## Product Principles
- The object is the explanation: the learner understands by watching parts become one airplane and then watching it fly.
- Truthful before impressive: every claim carries its confidence, estimates say so, schematic things say "schematic" and "not to scale".
- Every label is bilingual, always, with the Korean set larger.
- Every number on screen comes from the same model that moves the parts.
- Nothing needs a manual: the first button says what it does.

## Accessibility & Inclusion
Every control is a real button with a visible focus ring, Korean text is never clipped, contrast ≥ 4.5:1, body text ≥ 14 px, motion can be paused and is off under `prefers-reduced-motion`, no emoji, no information carried by colour alone (the confidence tags are words).
