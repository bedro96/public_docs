# R2 — Smartphone camera module manufacturing: process, competitors, anatomy, final assembly (Part B)

**Scope:** iPhone-class camera module (reference manufacturer [anonymous] and competitors). It feeds an educational isometric factory animation.
**Confidence tags:** `[verified]` means a fetched primary source or vendor page states it. `[verified-2nd]` means a news or secondary report quoting a primary source. `[estimate]` means derived or industry-typical. `[unverified]` means reported but not confirmed. `[BEST GUESS]` means my reconstruction from industry practice.
**Source IDs (S#)** map to the URL list in section 9.

---

## 0. Executive summary

- **Process flow (verified skeleton).** reference manufacturer's own factory tour (ETNews) shows this order: sensor wafers/dies are cleaned, then attached to the substrate, then wire-bonded. The assembly is cleaned and inspected, then the IR filter is attached. Lens, barrel and actuator are joined by reference manufacturer's in-house "active alignment" (AA). Last come OIS/AF tests, visual inspection and shipping. All manufacturing except inspection/test runs in a **"10-zone" (Class 10) cleanroom**, entered through a 7-step particle-removal routine [S11].
- **AA numbers.**
  - AA vendors quote a throughput of **UPH 1,000 per machine** (4 AA stages) and an optical-centre alignment of **±10 µm** [S19].
  - UV fixation takes **≥0.5–1 s** and the heat cure runs at **45–80 °C** [S22].
  - Luxvisions (Luxshare family, formerly Cowell's parent) says its **18-axis AA** achieves **<0.1 µm** translation and **<0.003°** rotation accuracy [S25].
- **reference manufacturer scale.** reference manufacturer produced **241.74 M camera modules in H1 2026** (191.6 M in H1 2025) [S16]. That is roughly 32–40 M per month group-wide, not 3 M/month. The Hai Phong site has **6,500 employees, 242,600 m² floor area, ~US$4.1 B revenue in 2025**, and a V3 plant of 150,000 m² that more than doubled Vietnam capacity [S13, S14].
- **Competitors.**
  - Sunny is #1 in phone lenses (1.324 B units in 2024) and #1 in phone modules (~530 M, ~12% share) [S27].
  - Luxvisions (which owns Cowell) is #2 in consumer camera modules by 2025 revenue (Frost & Sullivan, per its IPO prospectus), with 71% of revenue from Apple [S25].
  - Q Tech ships ~422 M phone modules a year to Android brands [S29].
  - Largan makes lenses (and VCMs via Largan Digital), not modules.
- **Phone mounting.** The iPhone 16 Pro rear camera assembly is **screwed (2 screws: 2.9 mm and 3.8 mm) into a recess in the frame and plugged into the logic board with 2 press-fit B2B connectors**. It is not soldered or glued [S9].
- **Search-quality warning.** Pages from `frameandfocal.com` that surfaced in search are **AI-generated fabrications** (invented "IMX999", "dual periscope" on the 16 Pro, "4.8 mm bump", etc.). I excluded them. Treat any value on that domain as wrong.

---

## 1. Anatomy of an iPhone-class camera module

### 1.1 Reference device: iPhone 16 Pro (Apple specs [S1, S3])

| Camera | Spec (Apple) |
|---|---|
| Main "48MP Fusion" | 24 mm, ƒ/1.78, 2nd-gen **sensor-shift OIS**, 100% Focus Pixels; also yields a 12 MP 2x crop (48 mm, ƒ/1.78) [S1] |
| Ultra Wide | 48 MP, 13 mm, ƒ/2.2, 120° FOV, Hybrid Focus Pixels [S1] |
| Telephoto | 12 MP, 120 mm (5x), ƒ/2.8, 20° FOV, **seven-element lens, 3D sensor-shift OIS + AF, tetraprism** [S1] |
| LiDAR scanner | Yes, on Pro models [S1] |
| Front (TrueDepth) | **12 MP**, ƒ/1.9, autofocus [S1] |

- The main sensor is a "second-generation quad-pixel sensor that can read data 2x faster", paired with the Apple Camera Interface [S3].
- GSMArena lists it as 1/1.28", 1.22–2.44 µm (native vs 2×2 binned) [S32]. The part number is reported by secondary sources as Sony IMX903 [unverified]. I did not find a primary confirmation.
- TechInsights confirms the ultra-wide sensor is a **Sony IMX972: 1/2.55", 48 MP, 0.70 µm pixel pitch, stacked BSI CIS** [S7].
- TechInsights BOM (16 Pro): **48 MP wide rear camera subsystem US$62.33; 12 MP periscope telephoto subsystem US$33.78** [S8].

### 1.2 Component list with real or derived sizes

| # | Component | What it is | Size / number | Tag / source |
|---|---|---|---|---|
| 1 | **Lens elements** | Injection-moulded plastic aspheres, 7P on iPhone 12 Pro wide and 16 Pro tele; glass is possible for element 1 on some phones | Apple: "seven-element" lens on 16 Pro tele [S1]; 12 Pro wide "seven-element" [S4]. Diameter: main ~6–7 mm; element thickness 0.2–0.8 mm [estimate] | count [verified]; dimensions [estimate] |
| 2 | Lens materials | COP (Zeonex): >91% transmission, n≈1.53, Abbe 56; high-index resins (n≈1.6–1.67, Abbe ~20) for flint elements | COP data [S31]; high-index grades [estimate] | [verified] / [estimate] |
| 3 | **Barrel + spacers + light shields** | Moulded barrel; black-coated spacer rings and stops between elements | Sunny now also ships "glass-plastic hybrid" phone lenses [S27] | spacers [estimate] |
| 4 | **IR-cut filter** | Coated or blue glass, bonded to the substrate or holder with matt, low-outgassing adhesive [S22] | ~0.1–0.3 mm thick [estimate]. Crystal-Optech (Taizhou) supplies IR-cut filters and tetraprism optics [S26] | supplier [verified-2nd]; blue glass on iPhone [unverified] |
| 5 | **Image sensor (main)** | Sony stacked BSI CMOS, 48 MP quad-Bayer, 1/1.28", 1.22 µm | Active area ≈ 8064×6048 × 1.22 µm = **9.84 × 7.38 mm** (diag. ≈12.3 mm) [derived]. Die incl. periphery ≈ 10.5–11.5 × 8–9 mm [estimate]. Die-size data is behind the TechInsights paywall | pitch [verified]; die [estimate] |
| 6 | Sensor (UW) | Sony IMX972, 1/2.55", 0.70 µm, 48 MP | [S7] | [verified] |
| 7 | **Substrate** | Rigid-flex PCB (rigid sensor area + flex tail with B2B connector). Passives (01005/0402), EEPROM, driver IC on the board | Flex must keep working while the sensor moves in sensor-shift designs [S26] | [verified-2nd] |
| 8 | Flex/FPC suppliers | Sumitomo Electric and Mektec, for iPhone camera flex | [S26] | [verified-2nd] |
| 9 | **VCM actuator (AF)** | Magnet + coil + leaf springs (+ ball guide in some designs) in a holder | Largan Digital's integrated VCM footprint is **6.95 × 6.5 mm** for a 1/3.6" sensor [S30] | [verified] (a Largan product, not the iPhone's) |
| 10 | **OIS (sensor-shift)** | Sensor carried on a moving platform; Apple says 12 Pro Max shifts at >5,000 Hz; teardown X-ray shows four magnets around the sensor | [S37]; Apple first used it on the 12 Pro Max main (1.7 µm pixels, ƒ/1.6) [S4] | [verified-2nd] |
| 11 | Position sensors | Hall/TMR. iPhone 17 teardown reportedly shows 3 TDK TMR sensors in the main camera and 2 in the UW | [S26] | [verified-2nd] |
| 12 | **Tetraprism telephoto** | Folded optic: precision prism(s) + lens group + 3D sensor-shift OIS/AF | Prisms from Crystal-Optech, Lante Optics [S26]. reference manufacturer makes the tele module and OIS actuators (~70% share on 15 Pro Max, ~60% on 16 cycle, >50% on 17 cycle); Jahwa Electronics, ICT also in [S26] | [verified-2nd] |
| 13 | **Shield can / housing** | Ni-plated metal can, bonded with heat-cure adhesive; EMI grounding | [S22] lists "shield can bonding", "grounding", "stiffener attach" | [verified] (vendor) |
| 14 | **B2B connector** | Press-fit connector on the camera flex, mating a socket on the logic board | iPhone 16 Pro: 2 rear camera connectors; **LiDAR separate** [S9] | [verified] |
| 15 | **LiDAR scanner** | VCSEL emitter + SPAD receiver (direct ToF). Separate part, fixed with its own two screws (1.7 mm, 3.0 mm) | Screws [S9]; VCSEL+SPAD architecture [unverified in my fetched sources; widely reported] | mixed |
| 16 | **Face ID / TrueDepth** | VCSEL dot projector with DOE (>30,000 dots), IR flood illuminator, IR camera. Apple says "thousands of invisible dots"; Wikipedia says >30,000 | [S38] | [verified-2nd] |
| 17 | Front camera | 12 MP ƒ/1.9 AF on iPhone 16 Pro [S1]. TechInsights: iPhone 16 front camera slightly taller, B2B connectors rotated 90° [S6] | [verified] |

**Bonding points.** DELO documents "bonding over 30 points" in a compact camera module [S22]. They include flex anchoring, sensor attach (COB, die attach, flip-chip attach), grounding, IR filter to substrate, housing bonding by AA, VCM bonding (magnet-to-housing, spring-to-substrate, coil), lens barrel attach, first lens bonding, lens-to-barrel bonding, shield can, damping, guide rail, stiffener, prism bonding for periscope, and Halbach-array magnet bonding.

---

## 2. Process flow, station by station

**Where reference manufacturer is the reference.**
- Verified: the order of operations and the cleanroom class [S11].
- Verified: reference manufacturer calls AA a "독자 개발" (self-developed) process [S11].
- **Not public:** per-station cycle times and yields. These are labelled **[BEST GUESS]**.
- Lens makers (Largan, Genius, Sunny) mould the lens elements. Whether reference manufacturer assembles barrels from their elements or buys finished lens modules is **[unverified]**. Industry practice is that lens makers deliver a barrel-assembled lens module.

### Station table

| Stn | Station | What happens | Key numbers | Tag |
|---|---|---|---|---|
| **S0** | Incoming QC (IQC) | Rigid-flex panels, sensors (supplied as **wafers**, per ETNews), IR filters, lens modules, VCM/actuator parts | reference manufacturer receives sensors "웨이퍼 단위" (wafer units) [S11] | [verified-2nd] |
| **S1** | **SMT** on substrate | Solder-paste print, place passives/EEPROM/driver, reflow, AOI | 01005/0402 parts; peak ~245–260 °C reflow; ~30–60 parts per board; 20–30-up panel | [BEST GUESS] |
| **S2** | **Plasma clean + sensor die attach** (COB) | Plasma-clean the pad surfaces, then pick sensor die from the wafer and place on epoxy; heat-cure the epoxy ("low warpage" adhesive to maintain alignment) | Die placement ±10–25 µm; cure 120–150 °C | adhesive type [verified], values [BEST GUESS] |
| **S3** | **Wire bonding** | Au (or Pd-Cu) wires, die pad to substrate pad | ~60–120 wires; ~0.06–0.1 s/wire; ~6–10 s per module | [BEST GUESS] |
| **S4** | **Clean + inspect** | Wash after wire bond, then inspection | ETNews: "세척 후 검사" (cleaned, then inspected) [S11] | [verified] |
| **S5** | **IR-filter attach** | Dispense light-blocking adhesive, place filter on holder or substrate, cure. reference manufacturer automated clean→IRCF attach for reference manufacturer G6 so no human touches the part [S11] | Low-outgassing, matt adhesive [S22] | [verified] |
| **S6** | Lens barrel build | Lens elements stacked in barrel with spacers and shields (usually at lens maker); "first lens bonding" and "lens-to-barrel" adhesive | [S22]. Moulding: COP/COC, mould cycle ~20–40 s [estimate] | process [verified], numbers [estimate] |
| **S7** | **VCM / actuator assembly** | Magnet + coil + springs + holder; reference manufacturer also makes OIS actuators for tetraprism [S26] | VCM bonding adhesives [S22] | [verified-2nd] |
| **S8** | **Active alignment (AA)** | See 2.1 | UPH 1,000 per machine [S19] | [verified] (vendor) |
| **S9** | **Cure/bake** | UV/heat dual-cure to full strength | UV fixation ≥0.5–1 s; heat cure 45–80 °C (range) [S22]. Typical oven 80 °C, 30–60 min | range [verified]; dwell [BEST GUESS] |
| **S10** | **OIS/AF calibration** | AF code vs distance (infinity/macro), Hall/TMR gain/offset, OIS on shake table. reference manufacturer: OIS QC shakes the module "수백 번" (hundreds of times) while shooting [S11] | OIS test ~20–60 s [BEST GUESS] | [verified] / [BEST GUESS] |
| **S11** | **Optical tests + OTP** | MTF centre/corners, lens-shading, white-balance/colour calibration, defect-pixel, dark current, particles/dirt, flare, colour uniformity; calibration data stored in OTP/EEPROM | reference manufacturer V30 report: colour calibration, FOV, resolution, depth, focus [S12] | list [verified-2nd]; OTP [estimate] |
| **S12** | Reliability lab (sampling) | External shock, extreme temperature, thermal shock, dust | [S11] | [verified] |
| **S13** | Final inspection + packing | Equipment and visual inspection, then ship | [S11] | [verified] |
| **S14** | Ship to Apple assembly | Foxconn, Pegatron, Wistron (some in India) | Apple FY2022 supplier list: Foxconn (Tamil Nadu etc.), Pegatron (Tamil Nadu), Wistron (Karnataka) [S18] | [verified] |

**Key insight.** Since the iPhone 13 cycle, Apple has bought individual camera modules and **Foxconn does the multi-camera assembly and alignment** (earlier, reference manufacturer/Sharp pre-assembled 2–3 modules) [S26]. [verified-2nd]

### 2.1 Active alignment (AA): the core step

**Procedure** [S19, S20, S21]:
1. Apply UV + thermosetting adhesive to the sensor-substrate subassembly (or the lens barrel skirt).
2. Supply lens + VCM/holder; grip with a multi-axis gripper and coarse-place.
3. **Power the sensor** and stream live video of a test chart. The chart is a checkerboard/slanted-edge sampled at **five fields** (centre + 4 corners), each with H and V regions of interest [S21].
4. Sweep through focus. Compute through-focus SFR/MTF at each field, then compute a correction.
5. Move the gripper in **6 degrees of freedom** (X, Y, Z, θx, θy, θz) until centre and corners peak in a common window. Commonlands notes this balances the field, not just the centre [S20].
6. UV-flash the adhesive while holding the pose; the target is pre-offset by characterised cure shrinkage [S20].
7. Release; the module goes to the heat-cure oven.

**Numbers:**

| Item | Value | Source | Tag |
|---|---|---|---|
| Throughput | UPH 1,000 per machine, "4" AA stages for smartphone, handler fully automatic | S19 (Asue/Japan Finetech) | [verified] vendor claim |
| Centre misalignment | <±10 µm between sensor centre and lens image centre (X, Y trim available for tighter) | S19 | [verified] vendor |
| Luxvisions AA | 18-axis; translation <0.1 µm; rotation <0.003° | S25 (prospectus via media) | [verified-2nd] |
| UV fixation | ≥0.5 s (dual-cure) / ≥1 s; 1–5 s for PHOTOBOND FB | S22 | [verified] vendor |
| Heat cure | from 45 °C up; typical ≥80 °C grades | S22 | [verified] vendor |
| Glue bead | width 0.1–0.3 mm; height tolerance ±5 µm; ±0.5 µm AA accuracy | S24 | [unverified] (Chinese vendor marketing) |
| Cycle per module | 6–15 s mid-volume; 3–5 s tuned mass production | S23 | [unverified] (startup blog) |
| Derived cycle | UPH 1000 on 4 stages = 3.6 s effective; 14.4 s per stage | derived from S19 | [estimate] |
| Post-AA drift | Epoxy keeps curing 24–48 h; MTF can drift 5–10% | S23 | [unverified] |
| Cure shrinkage | Characterised and pre-compensated | S20 | [verified] |

**Tolerance reasoning** (derived, for animation labels):
- Image-side depth of focus ≈ ±(F# × blur circle). With ƒ/1.78 and c ≈ 2 px (~2.4 µm): about **±4.3 µm**.
- Corner image height ≈ 6.2 mm. So allowable tilt ≈ 4.3 µm / 6.2 mm ≈ **0.7 mrad ≈ 0.04° ≈ 2.4 arc-min**. [estimate]
- Commonlands' 1/2.3" example gives 1.5 mrad (~0.09°) at ƒ/2 with c = 3 µm [S20]. A 1.22 µm-pitch sensor is roughly 2× tighter.

**Why AA is the yield-critical step.** reference manufacturer says AA "determines camera module production yield", so it is managed separately within the 10-zone cleanroom [S11]. The only public yield datapoint is a Chinese adhesive vendor's claim that a 5P wide module project went from **82% to 95.6%** assembly yield after adopting its AA glue [S24] [unverified]. Therefore **AA yield ≈ 99% is optimistic** for early ramp.

### 2.2 Cleanroom and ESD

- reference manufacturer Gwangju: all manufacturing except inspection/test in **"10-zone" (Class 10)**. ETNews defines it as ≤10 particles of ~0.5 µm per cubic foot, i.e. better than a hospital OR (Class 100). Entry uses a 7-step routine: gown and shoes, sticky roller #1, static test, shoe-sole wash, air shower, sticky roller #2, hand wash; 5+ min [S11] [verified].
- Class mapping (ISO 14644-1) [estimate/standard]: FED-STD-209 Class 10 ≈ ISO 4 (≈352 particles/m³ at ≥0.5 µm); Class 100 ≈ ISO 5 (3,520/m³); Class 10,000 ≈ ISO 7 (352,000/m³). So the user's "100–10,000" hint is looser than what reference manufacturer describes for core steps. Test and inspection areas are typically a lower class [estimate].
- ESD: no primary source fetched. Standard practice: ESD flooring, wrist straps, ionisers, conductive trays [estimate].
- reference manufacturer now uses AI inspection: root-cause identification time cut by up to 90%, and process-parameter optimisation cut from 72 h to 6 h [S13] [verified-2nd].

---

## 3. Competitors

| Company | Role / model | Scale and share | Layout / process notes | Tag / source |
|---|---|---|---|---|
| **reference manufacturer** | Module maker (Apple, others); also in-house OIS actuators and 3D sensing | Optics revenue ₩17.29 T (2023), ₩17.80 T (2024), ₩18.32 T (2025) [S17]. Optics op. margin 2023–25: 3.8%, 3.4%, 2.6%; H1 2026: 4.5% [S16]. Camera modules produced H1 2026: **241.74 M** (H1 2025: 191.6 M) [S16] | Sites per Apple's FY2022 supplier list: Gyeonggi-do (Paju), Gyeongsangbuk-do (Gumi), **Hai Phong** [S18]. Gumi = "mother factory" for R&D and high-value modules; Paju = advanced cameras + 3D sensing; Vietnam = mass-market modules [S13] | [verified] |
| **Sunny Optical** (Yuyao, Ningbo) | Lenses + modules, vertically integrated. Entered Apple via lenses ~2021; reportedly won full-module programs after 2024 [S26] | Phone lenses **1,324 M** units in 2024 (+13.1%); #1 (30.8% share per broker). Phone modules ~**530 M** (~12.1% share per broker) [S27]. 2024 revenue RMB 38.29 B [S27]. Dec 2024 alone: 53.4 M modules, 104.9 M lenses [S27] | Fully automated lines are Sunny's marketing line; I found no primary layout source. 7P lenses and glass-plastic hybrid lenses in volume 2024 [S27] | counts [verified]; share [estimate]; growth rate conflicting (+13.3% vs −5.9%) |
| **Largan Precision** (Taichung) | **Lenses only**; Largan Digital (group) designs and makes VCMs | 2024 revenue NT$59.46 B; gross margin ≈52.5% [S30]. Claimed ~30% global lens share [S30] | Tetraprism lenses too [S26]. Largan Digital VCM: 100% in-house designed and process tooling; integrated VCM lens+VCM reduces size 20% [S30] | [verified] |
| **Genius Electronic Optical** (Xiamen, Fujian) | Lenses only | Listed on Apple's supplier list (Fujian) [S18] | | [verified] |
| **Samsung Electro-Mechanics** | Modules; mostly Samsung phones | Camera/comm solutions revenue ₩2.094 T H1 2024; ₩1.047 T Samsung-phone modules in H1 2024 [S33] | Thai Nguyen (Vietnam) specialises in camera-module mass production [S34]. Busan/Sejong now focus on substrates, MLCC, inductors [S34]. Tianjin production site still listed [S34]. Apple FY2022 list shows SEMCO under Hebei (China) [S18], conflicting | [verified]; conflicts noted |
| **Luxvisions Innovation** (Guangzhou; Luxshare family) | Modules, 2nd largest by 2025 revenue (Frost & Sullivan) | Revenue RMB 15.25 B (2023) → 34.76 B (2025); Apple 71% of revenue; gross margin 10.8% [S25] | Own 18-axis AA [S25]. Owns **Cowell** (acquired 44.87% in Dec 2020, ~70% since) [S25, S26] | [verified-2nd] |
| **Cowell e Holdings** (HK-listed, Guangdong) | Apple front-camera modules since 2009; rear modules since 2024 | FY2024 revenue **US$2,494 M** (+170%); net profit US$119 M; >6,000 employees; sites: Huanan 60,564 m² and Hengkeng 30,700 m² [S28] | Guangdong per Apple list [S18]. 2024 growth came from new rear camera orders; first-batch tele modules mostly reference manufacturer, then Foxconn and Cowell added [S36] | [verified] |
| **Foxconn (Hon Hai) / Rayprus / Sharp** | Module + multi-camera assembly. Face ID projector and IR cameras made in Longhua, Shenzhen [S26] | Sharp was the second iPhone module supplier (30–40% share ~2020), then stopped after 2021 Vietnam shutdown and sensor-shift ramp trouble [S26]. Sharp withdrew from iPhone 16 Pro tele [S36] | Apple FY2022 list shows Sharp under Jiangsu [S18]; the Chinese article places Sharp capacity in Vietnam. **Conflict unresolved** | [verified-2nd] |
| **Q Technology** (Kunshan) | Android phone modules | **422 M** phone modules in 2024; ≥32 MP ≈ 50%; OIS ≈ 12.9% (54.4 M), periscope ≈ 1.8% (7.8 M) [S29] | Android-only | [verified] |
| **O-film** (Nanchang) | Modules; lost Apple in 2021 [S26] | Smartphone ≈ 75% of revenue (2025), gross margin 9.7% [S25] | | [verified-2nd] |
| **Partron** (Korea) | Samsung phone modules, actuators | 2024 revenue ₩1.4864 T, op. profit ₩61.7 B [S33] | | [verified-2nd] |
| **MCNEX** (Korea) | Phone + automotive | 2024 revenue ₩1.057 T, op. profit ₩44.3 B [S33] | | [verified-2nd] |
| **Truly, AAC, Foxconn Interconnect Technology (FIT)** | — | No reliable primary data found | | gap |
| **Sony** | Sensors only (Nagasaki, Kumamoto, Oita, Yamagata) [S18, S26] | Apple partnership > 10 years [S26] | Samsung (Austin) reportedly entering stacked sensors [S26] | [verified-2nd] |

**Market share, overall.** QYResearch: 2023 market US$34.88 B; the top four (reference manufacturer, Sunny, Foxconn/Sharp, SEMCO) hold **>60%** [S35] [estimate]. Report Prime shows reference manufacturer #1 at US$4.30 B (2024) [S35] [unverified]. Do not quote Report Prime's per-company figures.

**reference manufacturer competitive pressure.** reference manufacturer's module margin fell to 2.6% in 2025 due to "intensifying competition in the Apple camera module market" [S16].

---

## 4. Line rates and yield

### 4.1 Verified scale numbers

| Quantity | Value | Source |
|---|---|---|
| reference manufacturer modules produced H1 2026 | 241.74 M (≈1.34 M/day; ≈40 M/month) | S16 |
| reference manufacturer modules produced H1 2025 | 191.6 M (≈32 M/month) | S16 |
| Hai Phong employees | 6,500 (from 800 at founding), 99% local | S14 |
| Hai Phong floor area | 242,600 m²; V3 plant alone 150,000 m² | S13, S14 |
| Hai Phong cumulative investment / revenue | ~US$1.9 B / ~US$25 B (10 years); 2025 revenue ≈ US$4.1 B | S14 |
| Hai Phong commercial module output since 2017 | Mass production started 2017 | S14 |
| "390 M modules/yr" in Hai Phong | Reported by a Vietnamese magazine | S15 [unverified] |

**Interpretation of the "390 M/yr" figure.** It matches reference manufacturer's *group* total (≈ 2 × 191.6 M ≈ 383 M/yr in 2025), not Hai Phong alone. By revenue share (Hai Phong US$4.1 B vs reference manufacturer optics ₩18.32 T ≈ US$13 B at ~₩1,400/$), Hai Phong is ~30% of value. Since Vietnam builds lower-ASP modules, I estimate **Hai Phong ≈ 100–190 M modules/yr (≈ 8–16 M/month)** [estimate]. That is well above the "3 M/month" hint.

Average revenue per module ≈ ₩9.13 T / 241.74 M ≈ ₩37,800 (≈ US$26–27), which includes 3D sensing and other optics [derived].

### 4.2 [BEST GUESS] reference line for the animation (4,000 UPH, ~90 k modules/day)

Assumes 22 h/day and ~90% OEE. These are my reconstructions from industry practice and the AA vendor data above.

| Stn | Station | Cycle / UPH per machine | Machines for 4,000 UPH |
|---|---|---|---|
| S1 | SMT line (printer, 3 shooters, reflow, AOI) | ~1,250 boards/h per shooter | 1 line |
| S2 | Plasma + die attach | ~2,000 UPH | 2 |
| S3 | Wire bond | ~450 UPH (8 s) | 9 |
| S4–S5 | Clean + IRCF attach | ~1,800 UPH | 2–3 |
| S8 | **AA** | 1,000 UPH (vendor) | **4** |
| S9 | UV/thermal cure oven | 40 min dwell → ~2,700 units in oven | 1 conveyor oven |
| S10–S11 | Calibration + optical test | 30 s/module, 8–16 parallel | ~33 stations |
| S13 | Final AOI/AVI + pack | ~2,000 UPH | 2 |

### 4.3 [BEST GUESS] per-step yields

| Step | First-pass yield |
|---|---|
| SMT | 99.5% |
| Die attach | 99.8% |
| Wire bond | 99.5% |
| Clean + IRCF (particles) | 98.5% |
| AA | 98% (mature; 95% early ramp) |
| Calibration/test | 97.5% |
| **Cumulative** | **≈93%** (≈96% after rework) |

The cumulative figure is the product of the steps above: 0.995 × 0.998 × 0.995 × 0.985 × 0.98 × 0.975. Tetraprism tele modules have reported yield challenges at suppliers; that source is low quality [unverified].

---

## 5. The final connection: module in the iPhone

### 5.1 Device envelope (verified)

| Item | iPhone 16 Pro | Source |
|---|---|---|
| Height × width × depth | **149.6 × 71.5 × 8.25 mm** | S1 |
| Weight | **199 g** | S1 |
| 16 Pro Max for reference | 163 × 77.6 × 8.25 mm, 227 g | S2 |
| Camera bump | iPhone 16 (non-Pro): body 7.83 mm, 11.3 mm with cameras → **≈3.5 mm** bump | S6 |
| 16 Pro bump | Not in Apple specs. Estimate 3.5–4 mm. A Chinese consumer post says 3.9 mm for the 16 Pro Max | S6 / smzdm [estimate]/[unverified] |
| Layout | Rear cameras moved from square to vertical layout on iPhone 16; the iPhone 16 cannot lie flat | S6 |
| IP rating | IP68, 6 m for 30 min | S1 |

### 5.2 How the module is mounted (iFixit, iPhone 16 Pro) [S9]

- Remove the back glass (heat plus pick), then the connector covers (tri-point Y000 screws).
- The **LiDAR** sensor is separate: **two screws (1.7 mm and 3.0 mm)**.
- Disconnect **two rear camera connectors** with a spudger; the second sits under the first.
- Remove the **two screws (2.9 mm and 3.8 mm)** securing the rear camera assembly.
- Install: "Align the rear camera assembly with its screw posts and place it in its recess in the frame." Then connect the first rear camera connector "on the left edge of the logic board" and the second above it.
- **Contrast, iPhone 16 (non-Pro) [S10]:** three screws (2.3, 4.7, 3.2 mm), one press connector, a top bracket with four screws.
- TechInsights: opening needs two bottom screws and moderate heat on the display or back cover [S6].

**So:** screwed into a frame recess, connected by press-fit B2B connectors. Not soldered, not glued. The animation finale should show: the module drops into the recess, two screws, flex bends to the logic board, B2B pressed, then LiDAR beside it, then back glass.

### 5.3 Magnetics note

Apple's Accessory Design Guidelines (R32 Update 1) say accessories must not affect AF or OIS and that magnets should be avoided [S39 §4.8]. This is an easy callout for the animation: OIS/VCM magnets are sensitive.

---

## 6. [BEST GUESS] animation layout (flow order)

1. Gowning airlock (7 steps, ~5 min) → SMT hall (panel loader → printer → shooters → reflow → AOI).
2. Class-10/100 core: plasma → die attach → bake → wire bond → wash → AOI → IRCF attach.
3. Barrel/VCM/lens module feed lane from the side (lens maker's modules arrive in trays).
4. AA island: 4 AA cells (6-axis gripper, chart, UV LED) → conveyor oven.
5. Calibration and test hall (OIS shake tables, chart stations, OTP write).
6. Visual inspection → tray → ESD bag → ship to Foxconn/Pegatron/Wistron/Tata → iPhone assembly → finale.

---

## 7. KEY NUMBERS TABLE

| # | Value | Unit | Source | Confidence |
|---|---|---|---|---|
| 1 | 149.6 × 71.5 × 8.25 | mm (iPhone 16 Pro) | S1 | [verified] |
| 2 | 199 | g (iPhone 16 Pro) | S1 | [verified] |
| 3 | 163 × 77.6 × 8.25; 227 | mm; g (16 Pro Max) | S2 | [verified] |
| 4 | 48 (main), 48 (UW), 12 (tele), 12 (front) | MP | S1 | [verified] |
| 5 | ƒ/1.78 main; ƒ/2.2 UW; ƒ/2.8 tele; ƒ/1.9 front | aperture | S1 | [verified] |
| 6 | 24 / 13 / 120 | mm equiv. focal length (main/UW/tele) | S1 | [verified] |
| 7 | 7 | elements in tele lens | S1 | [verified] |
| 8 | 1/1.28" | main sensor format | S32 | [verified-2nd] |
| 9 | 1.22 | µm native pixel pitch (main) | S32 | [verified-2nd] |
| 10 | 2.44 | µm binned pitch | S32 | [verified-2nd] |
| 11 | 9.84 × 7.38 | mm active area (main) | derived from #9 | [estimate] |
| 12 | 0.70 | µm pixel pitch, IMX972 UW (1/2.55", 48 MP) | S7 | [verified] |
| 13 | 62.33 | US$ BOM, 48 MP wide camera subsystem | S8 | [verified-2nd] |
| 14 | 33.78 | US$ BOM, 12 MP periscope tele subsystem | S8 | [verified-2nd] |
| 15 | 7.83 / 11.3 / ≈3.5 | mm body / with cameras / bump (iPhone 16) | S6 | [verified] |
| 16 | 2 (2.9 mm, 3.8 mm) | screws, rear camera assembly (16 Pro) | S9 | [verified] |
| 17 | 2 | rear-camera press connectors (16 Pro) | S9 | [verified] |
| 18 | 2 (1.7 mm, 3.0 mm) | screws, LiDAR (16 Pro) | S9 | [verified] |
| 19 | 1.7 | µm pixel pitch, iPhone 12 Pro Max main | S4 | [verified] |
| 20 | >5,000 | adjustments/s, 12 Pro Max sensor-shift | S37 | [verified-2nd] |
| 21 | 4 | magnets around sensor (12 Pro Max X-ray) | S37 | [verified-2nd] |
| 22 | >30,000 | IR dots, Face ID | S38 | [verified-2nd] |
| 23 | 1.53 / 56 / >91% | n / Abbe / transmission, Zeonex COP | S31 | [verified] |
| 24 | 6.95 × 6.5 | mm, Largan integrated VCM footprint (1/3.6" sensor) | S30 | [verified] |
| 25 | Class 10 | cleanroom class (≤10 particles ≥0.5 µm/ft³) | S11 | [verified] |
| 26 | 7 | steps in cleanroom entry | S11 | [verified] |
| 27 | ≥5 | min gowning/entry time | S11 | [verified] |
| 28 | 6 | AA degrees of freedom | S19, S20 | [verified] |
| 29 | 18 | AA axes (Luxvisions) | S25 | [verified-2nd] |
| 30 | <0.1 / <0.003 | µm / ° AA accuracy (Luxvisions) | S25 | [verified-2nd] |
| 31 | <±10 | µm optical-centre misalignment (AA) | S19 | [verified] (vendor) |
| 32 | 1,000 | UPH per AA machine (4 stages) | S19 | [verified] (vendor) |
| 33 | ≥0.5–1 | s UV fixation | S22 | [verified] (vendor) |
| 34 | 45–80 | °C heat cure range | S22 | [verified] (vendor) |
| 35 | >30 | adhesive bonding points per module | S22 | [verified] (vendor) |
| 36 | 5 | AA chart fields (centre + 4 corners) | S21 | [verified] |
| 37 | ±4.3 | µm image-side depth of focus (ƒ/1.78, c≈2.4 µm) | derived | [estimate] |
| 38 | 0.04 (≈2.4 arc-min) | ° tilt tolerance at corner | derived | [estimate] |
| 39 | 3.6 / 14.4 | s effective / per-stage AA cycle | derived from #32 | [estimate] |
| 40 | 241.74 M | reference manufacturer modules produced, H1 2026 | S16 | [verified-2nd] |
| 41 | 191.6 M | reference manufacturer modules produced, H1 2025 | S16 | [verified-2nd] |
| 42 | ₩18.32 T | reference manufacturer optics revenue, 2025 | S17 | [verified-2nd] |
| 43 | 2.6% / 4.5% | reference manufacturer optics op. margin 2025 / H1 2026 | S16 | [verified-2nd] |
| 44 | 6,500 | Hai Phong employees | S14 | [verified-2nd] |
| 45 | 242,600 | m² Hai Phong floor area | S14 | [verified-2nd] |
| 46 | 150,000 | m² V3 plant | S13 | [verified-2nd] |
| 47 | ~4.1 | US$ B Hai Phong 2025 revenue | S14 | [verified-2nd] |
| 48 | ~100–190 M | modules/yr Hai Phong | derived from S14/S16/S17 | [estimate] |
| 49 | 72 → 6 | h process-parameter search time at reference manufacturer (AI) | S13 | [verified-2nd] |
| 50 | 1,324 M | Sunny phone lenses 2024 | S27 | [verified-2nd] |
| 51 | ~530 M | Sunny phone modules 2024 | S27 | [estimate] (broker; growth figure conflicts) |
| 52 | 53.4 M | Sunny modules, Dec 2024 | S27 | [verified-2nd] |
| 53 | RMB 38.29 B | Sunny 2024 revenue | S27 | [verified-2nd] |
| 54 | US$2,494 M | Cowell FY2024 revenue (+170%) | S28 | [verified] |
| 55 | RMB 34.76 B; 71% | Luxvisions 2025 revenue; Apple share | S25 | [verified-2nd] |
| 56 | 422 M | Q Tech phone modules 2024 | S29 | [verified] |
| 57 | NT$59.46 B; ~52.5% | Largan 2024 revenue; gross margin | S30 | [verified] |
| 58 | >60% | top-4 module maker share (2023) | S35 | [estimate] |
| 59 | ≈93% | cumulative first-pass yield, reference line | §4.3 | [BEST GUESS] |
| 60 | 4,000 UPH / 4 AA machines | reference line | §4.2 | [BEST GUESS] |

---

## 8. CORRECTIONS (where the hints or common claims are wrong)

1. **Luxvisions is not Foxconn.** It is Luxshare-family (founder Wang Laixi, brother of Luxshare's founder). It acquired Cowell (44.87% in Dec 2020, ~70% since) and Lite-On's IMG business [S25, S26]. Foxconn's own module arm is Rayprus [S26].
2. **Cowell is not Korean.** It is HK-listed and Guangdong-based, now Luxvisions-controlled [S25, S28]. The Korean module makers are reference manufacturer, SEMCO, Partron, MCNEX, Cammsys.
3. **"3 million modules/month" for Hai Phong is far too low.** reference manufacturer group output is ~32–40 M/month [S16]. A Vietnamese magazine's "390 M/yr" matches the group total, not Hai Phong alone [S15].
4. **Class 100–10,000.** reference manufacturer describes **Class 10** for core manufacturing [S11]. 10,000 would be far looser.
5. **SEMCO's Busan plant is no longer a camera-module site.** Busan/Sejong specialise in substrates, MLCC and inductors; Thai Nguyen (Vietnam) is the camera-module mass-production hub [S34]. Sources on Tianjin conflict.
6. **Pixel pitch is 1.22 µm**, not 1.2 µm (1.22–2.44 µm binned) [S32].
7. **Sensor-shift OIS appeared first on the iPhone 12 Pro Max main camera**, with a 1.7 µm sensor [S4, S37]. The 16 Pro main has "second-generation" sensor-shift OIS; the tele has "3D sensor-shift OIS and AF" [S1]. Apple lists no OIS for the 16 Pro ultra-wide [S1].
8. **"Dual camera" is outdated.** The 16 Pro has a triple rear system plus LiDAR [S1, S40].
9. **Front camera 18 MP.** The 16 Pro front camera is **12 MP**, ƒ/1.9, AF [S1]. The 18 MP front sensor is reported for iPhone 17 [S26] [verified-2nd].
10. **B2B "soldered" and "glued".** The module is held by **two screws and two press-fit B2B connectors**, in a frame recess [S9]. LiDAR is a separate screwed part.
11. **Multi-camera pre-assembly.** From the iPhone 13 cycle Apple buys individual modules and Foxconn does multi-camera alignment [S26] [verified-2nd]. Do not show reference manufacturer pre-assembling the triple camera for iPhone 16.
12. **"AA yield ~99%"** has no public support. The only datapoint is an 82% → 95.6% adhesive-vendor claim for a 5P wide module [S24] [unverified].
13. **Lens materials.** COP/COC are optical plastics. I found no primary source on reference manufacturer buying vs making lens elements. Treat "reference manufacturer buys lens modules from Largan/Genius/Sunny" as industry practice [unverified]. Also note Sunny entered Apple lens supply ~2021 [S26] [verified-2nd].
14. **Blue-glass IR filter on iPhone** is [unverified]; supplier Crystal-Optech provides IR-cut filters [S26].
15. **Discard `frameandfocal.com`.** Its fabricated claims include "IMX999", a "physical iris" on the 16 Pro, "dual periscope", "4.8 mm bump", and a "Foxconn Zhengzhou Class 5 cleanroom" for camera assembly.
16. **Sharp's location conflict.** Apple's FY2022 list shows Sharp under Jiangsu; a Chinese article says its camera capacity is in Vietnam [S18, S26]. Unresolved.

**Gaps.** No primary source for per-station tact, wire count, die size, line counts, Samsung EM cleanroom class, Sunny line layout or Truly/AAC/FIT data. ASMPT, Hanwha and AMICRO AA machine pages did not surface; Asue/Japan Finetech and Luxvisions are the AA machine sources used. TechInsights sensor-die measurements are paywalled.

---

## 9. Sources

- S1 Apple iPhone 16 Pro tech specs: https://support.apple.com/en-us/121031
- S2 Apple iPhone 16 Pro Max tech specs: https://support.apple.com/en-us/121032
- S3 Apple Newsroom, iPhone 16 Pro (Sep 2024): https://www.apple.com/newsroom/2024/09/apple-debuts-iphone-16-pro-and-iphone-16-pro-max/
- S4 Apple Newsroom, iPhone 12 Pro (Oct 2020): https://www.apple.com/newsroom/2020/10/apple-introduces-iphone-12-pro-and-iphone-12-pro-max-with-5g/
- S5 Apple Newsroom, iPhone 15 Pro (Sep 2023): https://www.apple.com/newsroom/2023/09/apple-unveils-iphone-15-pro-and-iphone-15-pro-max/
- S6 TechInsights iPhone 16 teardown: https://www.techinsights.com/blog/apple-iphone-16-teardown
- S7 TechInsights Sony IMX972: https://www.techinsights.com/blog/sony-imx972-advanced-floorplan-analysis
- S8 Electronics360 / TechInsights iPhone 16 Pro BOM: https://electronics360.globalspec.com/article/22029/techinsights-teardowns-apple-iphone-16-pro
- S9 iFixit iPhone 16 Pro rear cameras: https://www.ifixit.com/Guide/iPhone+16+Pro+Rear+Cameras+Replacement/179999
- S10 iFixit iPhone 16 rear camera assembly: https://www.ifixit.com/Guide/iPhone+16+Rear+Camera+Assembly+Replacement/177395
- S11 ETNews, reference manufacturer Gwangju (2017): https://www.etnews.com/20170406000212
- S12 Hankyung, reference manufacturer V30 camera (2017): https://www.hankyung.com/article/201709208208g
- S13 Korea Times, V3 plant (Sep 2025): [reference manufacturer source URL removed]
- S14 Digital Times, Hai Phong 10th anniversary: https://www.dt.co.kr/article/12087530
- S15 Emidas Magazine: [manufacturer source URL removed]
- S16 ZDNet Korea, reference manufacturer H1 2026: https://zdnet.co.kr/view/?no=20260816234233
- S17 StockAnalysis reference manufacturer segments: [manufacturer source URL removed]
- S18 Apple Supplier List (FY2022): https://www.apple.com/supply-chain/pdf/Apple-Supplier-List.pdf
- S19 Asue / Japan Finetech AA equipment: https://asue-group.com/en/products/active-alignment-equipment-for-camera-module/
- S20 Commonlands, active alignment: https://commonlands.com/blogs/technical/active-alignment-for-camera-modules
- S21 AIC AA demo: https://aic-tw.com/demos/two-components-assembly-en
- S22 DELO camera module adhesives: https://www.delo-adhesives.com/industries/consumer-electronics/camera-modules/ and https://www.delo.de/fileadmin/user_upload/Downloads/Customized_Adhesives_for_Compact_Camera_Module_Assembly-en.pdf
- S23 Princeton Optical (low quality): https://princetonoptical.com/blog/auto-aa-in-plain-english
- S24 Baidu report, AA glue (low quality): https://report.baidu.com/view/8c48093087c4bb4cf7ec4afe04a1b0717fd5b3bb.html
- S25 Luxvisions IPO analysis (Tencent News): https://news.qq.com/rain/a/20260806A03N9B00
- S26 Apple camera supply chain (10100.com): https://www.10100.com/article/149966474
- S27 Sunny FY2024: https://news.qq.com/rain/a/20250324A093S400 ; Dec 2024: https://news.qq.com/rain/a/20250110A07WJU00 ; broker note: https://www.hangyan.co/reports/3600113742714504346
- S28 Cowell FY2024 (MarketScreener): https://hk.marketscreener.com/quote/stock/COWELL-E-HOLDINGS-INC-21373860/news/Cowell-e-Holdings-posts-solid-growth-in-2024-49503536/
- S29 Q Tech FY2024: https://www.qtechsmartvision.com/ueditor/php/upload/file/20250325/1742864750138768.pdf
- S30 Largan: https://mopsov.twse.com.tw/nas/STR/300820250109E001.pdf ; Largan Digital: https://www.largan.com.tw/largandigi/ ; https://en.wikipedia.org/wiki/Largan_Precision
- S31 Zeon COP: https://www.zeonsmi.com/products/cyclo-olefin-polymer-cop/optical-cop/
- S32 GSMArena iPhone 16 Pro review: https://www.gsmarena.com/apple_iphone_16_pro-review-2752p5.php
- S33 THE ELEC: https://www.thelec.kr/news/articleView.html?idxno=29578 ; https://www.thelec.kr/news/articleView.html?idxno=33067
- S34 Samsung EM global network: https://www.samsungsem.com/global/about-us/company/location.do?tab=2 ; LinkedIn production-network post
- S35 QYResearch: https://www.qyresearch.com/reports/2324851/compact-camera-module ; Report Prime (low quality): https://www.reportprime.com/compact-camera-module-r2043/company
- S36 GSMArena, reference manufacturer tele share: [manufacturer source URL removed]
- S37 Gadgets360, 12 Pro Max sensor-shift teardown: https://www.gadgets360.com/mobiles/news/iphone-12-pro-max-teardown-reveals-sensor-shift-image-stabilisation-technology-jerryrigeverything-2327884
- S38 Apple Face ID support: https://support.apple.com/en-us/102381 ; https://en.wikipedia.org/wiki/Face_ID
- S39 Apple Accessory Design Guidelines R32 Update 1: https://developer.apple.com/accessories/Accessory-Design-Guidelines.pdf
- S40 Wikipedia iPhone 16 Pro: https://en.wikipedia.org/wiki/IPhone_16_Pro
- Also used: Asia Business Daily on reference manufacturer 2023 revenue: https://www.asiae.co.kr/en/article/2024012515553758392
