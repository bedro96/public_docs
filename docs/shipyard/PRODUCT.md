# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
delegated: single standalone HTML file (the anatomy skill's isometric SVG kit, vendored, plus vanilla JS). Assumed because the brief asked for one offline HTML file and nobody was available to answer.

## Users
ASSUMED (no one could answer the interview): Korean middle- and high-school students (13–18) learning how a ship is built and what is inside one, alone on a laptop or phone, or projected by a teacher. Bilingual: Korean is the learner's language, English is the reference vocabulary.

## Product Purpose
An interactive model of a modern shipyard and of the ship it builds. The YARD view shows the facilities a steel plate passes through (warehouse, cutting, welding shop, assembly shop, painting shop, dry dock with a goliath crane, quay), and a seven-stage guided tour plays the build: plate and cutting, welding panels, assembling blocks, painting, erecting blocks in the dock, flooding and launching, and quay outfitting before sea trials. The VESSEL view is a cutaway container ship whose systems (hull, engine, navigation, electrical, cargo / living / safety) can be isolated, exploded and read about. Success: the learner can say, in both languages, what each facility does and in what order a ship is made, and can name the main systems of a ship and where they sit.

## Positioning
A physical-feeling scale model on a drafting table, not a slide deck: the crane really lifts a block into the dock, the dock really floods and the hull floats out, and the numbers on the card come from the same model that drives the motion.

## Operating Context
Laptop, classroom projector, or phone. One offline HTML file; no network at runtime.

## Capabilities and Constraints
- Facilities: 자재 창고 warehouse, 절단 공장 cutting shop, 용접 공장 welding shop, 조립 공장 assembly shop, 도장 공장 painting shop, 건조 도크 dry dock, 골리앗 크레인 goliath crane, 건조 중인 선체 hull under construction, 안벽 quay.
- Vessel systems: 선체 hull (double bottom 이중저, ballast tanks 밸러스트 탱크, bulkheads 격벽, frames, shell), 기관·추진 engine & propulsion (two-stroke main engine, shaft, propeller 프로펠러, rudder 방향타), 항해 장비 navigation (bridge 선교, radar, ECDIS, GPS, AIS, gyrocompass, autopilot), 전기 시스템 electrical (generators, main switchboard, cable trays, emergency generator), and 화물·거주·안전 cargo, living and safety (holds, accommodation, HVAC, piping, lifeboat, anchor).
- The ship is a container ship, chosen because it shows every system the brief names. The yard builds it from six representative blocks (a real ship has about 120; the page says so).
- Content is simplified to middle- and high-school level. Figures are illustrative, rounded and internally consistent; the model is schematic and not to scale (the hull is exaggerated in depth and the propeller is shown six times slower than real).
- Every label, caption and card is shown in Korean and English.

## Evidence on Hand
No supplied imagery or data. All shapes, text and numbers are authored here. Physical numbers (dock flooding time, draft, rpm, speed, tip speed) come from a small pure model that also drives the animation.

## Product Principles
- The object is the explanation: everything is learned by touching a facility or a system.
- Every label is bilingual, always: Korean first and larger, English beneath.
- Numbers shown are the numbers the model uses.
- Nothing needs a manual: Play shows the whole build; a click on any facility or system answers "what is this".

## Accessibility & Inclusion
Every control is a real button or range input with a visible focus ring. Tour: Prev / Next / Play / Skip / Restart, Left and Right arrows, Esc. Selection works with keyboard and touch through numbered markers and a legend list. `prefers-reduced-motion` (also when changed after load) shows finished states without tweening and keeps the radar and propeller still. Targets are at least 24 px. Works at 1366×800, 1024×600 and 390×844 without horizontal scrolling. Colour is never the only signal.
