
**Confidence tags:**
- **[verified]**: stated in a primary source (LG Innotek press release, sustainability report, DART-based filing) or a named news outlet.
- **[verified-secondary]**: from a secondary or derived site that repeats filing data.
- **[estimate]**: my inference.
- **[unverified]**: reported once, from a weak source, or not found.

Several 2026 items come from secondary sites (BigGo mirror, theinference.org, a DART-derived "LLM Wiki", totaltech.blog). They are flagged where used.

---

# R1 — LG Innotek (LG이노텍, KRX 011070): company, sites, shop layout, process, technology, timeline

## 0. Executive summary

- **Scale and dependence.** LG Innotek's consolidated revenue is about KRW 21.9T (2025). Optics Solutions is about 84% of it (KRW 18.3T, 2025). A single unnamed customer, universally read as Apple, is 79–81% of revenue.
- **Apple share.** The company never names the customer. The share is 78–81% in recent years, not "70–80%".
- **Supply history.** LG Innotek has supplied Apple camera modules since 2010 (iPhone 4 era), not as a front camera. Source: BusinessPost, and a Bizwatch article for the iPhone 4 rear 5MP (not directly fetched, 403).
- **Production split.**
  - Gumi (Korea) is the "mother factory". It handles R&D, new-model high-value modules and new-application optics.
  - Paju (Korea) does camera modules, 3D sensing, and now humanoid-robot cameras.
  - Hai Phong (Vietnam) is the volume and general-purpose smartphone module base. The V3 plant (about 150,000 m²) opened in Sept 2025 and more than doubled module capacity. Hai Phong's 2024 revenue was KRW 5.4T.
  - Yantai (China) is also an optics site.
  - Mexico, Wroclaw and Jakarta are not smartphone-camera plants.
- **Shop/process facts are thin and dated.**
  - The best public detail is a 2017 ETNews plant tour (Gwangju, LG G6 module) and a 2015 LG Innotek press piece (G4 OIS module).
  - Together they give a verified line flow: die bond, wire bond, glass filter, singulation, active alignment (AA), cure, test.
  - They also give an AA tolerance and a "10-class" clean-room.
  - There is no public number for current tact time, yield, line count or AGV/OHT use. Do not present any as fact.
- **AI/automation.** There is public information on AI process recipes (recipe search 72 h to ≤6 h) and a 2026 government "AI Factory" project targeting an unmanned curing line by 2029.

---

## 1. Optics Solutions business

### 1.1 Financials (K-IFRS consolidated)

| Item | 2023 | 2024 | 2025 | Source |
|---|---|---|---|---|
| Revenue | KRW 20.6053T | 21.2008T | 21.8966T (+3.3%) | lginnotek.com/news/pressView.do?idx=6459 / 6521 / 6575 [verified] |
| Operating profit | 830.8B | 706.0B | 665.0B (−5.8%) | same [verified] |
| Net profit | – | – | 341.3B | idx=6575 [verified] |
| Optics Solutions revenue | 17.2948T | 17.8001T | 18.3185T (83.6% of total) | press releases; 2025 figure via DART-derived basarajm.github.io/llm-wiki [verified-secondary] |
| Optics operating profit | 663.1B | 596.6B | 482.2B | same; HuffPost KR corroborates 2023–25 [verified-secondary] |
| R&D | – | 744.2B (3.5% of revenue) | 577.4B | Sustainability Report 2024-25; 2025 via DART wiki |

Segment structure:
- 2025 Package Solutions: about KRW 1.72T revenue, OP 128.9B.
- 2025 Mobility Solutions: about KRW 1.858T revenue, OP 53.9B.
- Segments were renamed in Dec 2025 (기판소재 → Package Solutions; 전장부품 → Mobility Solutions).

Quarterly data (seasonality for the animation's demand curve):
- Q4 2025 was a record quarter: revenue KRW 7.6098T, OP 324.7B. Optics was 6.6462T (+15.2% YoY).
- Q3 2026: revenue 6.3671T (+18.6%), OP 94.8B (−53.4%). Optics was 5.4041T (+20.6%). Source: lg.co.kr/media/release/30719 [verified].
- Optics is about 85% of Q3 2026 revenue (my arithmetic) [estimate].
- Profit is back-loaded into Q3/Q4 because of the September iPhone launch.

### 1.2 Apple dependency

LG Innotek discloses only "customer ≥10% of revenue". Apple is the presumed customer, and the company never names it [verified as disclosure practice].

| Period | Share | Source |
|---|---|---|
| 2023 | 79.6% | HuffPost KR huffingtonpost.kr/article/256280 |
| 2024 | 80.5% (HuffPost) or ~81.0% (thevaluenews.co.kr/news/203212) | two sources disagree |
| 2025 | 81.1% (HuffPost) or 81.4%, ≈KRW 17.83T (thevaluenews / DART wiki) | two sources disagree |
| H1 2022 / 2023 / 2024 / 2025 | 72.2% / 75.1% / 76.7% / 77.4% | fnnews 202508160910592488 |
| H1 2026 | 77.9% (KRW 8.8415T); top-10 customers 86% | EDaily |
| 9M 2025 | 78.7% | metroseoul / theinference.org [verified-secondary] |
| 9M 2026 | 80.4% (KRW 14.0094T) | metroseoul 20261112500514 [verified-secondary] |

Newsway (2026-03-13) quotes the company as saying Apple is "about 80%" of revenue.

Why the discrepancy: the two sources use different bases (customer revenue versus segment). I could not resolve it, so use "≈ 80% (79.6–81.4% depending on source)".

### 1.3 Camera-module output and utilisation (FY2025 business report)

Source: Newsway 2026-03-13 and the DART-derived wiki.

- Capacity: 591,411 thousand modules/year [verified-secondary].
- Output: 483,093 thousand modules [verified-secondary]. That is about 1.32 million modules per day on average [estimate, my arithmetic].
- Utilisation: 81.7% in 2025, 70.8% in 2024, 52.5% in 2022 [verified, Newsway].
  - The article's own text has a typo ("2023: 81.7%"). It is the 2025 figure.
  - The company attributes it to the "peak season entry in H2 and strong new-model sales of the main customer".
- Raw-material purchases were KRW 15.6158T in 2025: image sensor 41%, actuator 24%, lens 13% [verified-secondary]. Using these shares gives about KRW 6.4T for sensors, 3.7T for actuators and 2.0T for lenses [estimate].
- Suppliers listed in the report:
  - Image sensors: Sony and STMicroelectronics (wiki); Hankyung says Sony/Samsung.
  - Lenses: Largan, Genius.
  - Actuators: Alps/Mitsumi (historic), Jahwa Electronics, and in-house.
  - In 2015 the VCM came from Mitsumi with in-house development planned (visionsystem.kr, LG Innotek press material).
- LG Innotek does **not** make the image sensor [verified].

### 1.4 Capex

- **2025 facility investment (Optics).** The 2025 figure is KRW 375.9B in the ETNews filing summary (etnews.com/20251127000455).
  - The DART-wiki figure is 480.1B (total capex 678.7B). The two are inconsistent, probably different bases (investment plan versus cash capex) [flagged].
- **2026 announcement.** On 2025-11-27 the board approved KRW 341.1B of optics facility investment through 2026-12-31 (etnews.com/20251127000455; tokenpost.kr/news/tech/308950).
  - The purpose is "response to new models of the main customer" and the amount is 9.26% below 2025 [verified].
- **Gumi.** Two investment agreements with the city/province:
  - KRW 1.4T MOU on 2022-07-06 through 2023, including the Gumi 4 plant purchase (lginnotek.com idx=6353; lg.co.kr/media/release/25037) [verified].
  - KRW 600B MOU on 2025-03-25, running Apr 2025–Dec 2026, "for high-value camera modules" (idx=6532; idx=6555) [verified].
- **Vietnam.** July 2023 announcement of about KRW 1.3T (USD 1B) through Dec 2025, including V3 (idx=6555) [verified].
- **3D sensing 2017.** About KRW 270B was invested from April 2017 for Apple 3D-sensing modules (BusinessPost, 2017-10-31) [verified, press].

---

## 2. Sites

### 2.1 Domestic

Sustainability Report 2024-25: 23 sites in total, 10 in Korea and 13 overseas. There are 8 domestic production sites and 5 overseas production subsidiaries (Yantai, Haiphong, San Juan del Rio, Wroclaw, Jakarta) [verified].

The Optics ISO 9001 sites listed are Gumi 1, 1A, 2 and 4, Paju, Ansan, Hai Phong and Yantai [verified].

- **Gumi (Gyeongbuk).**
  - The campus has five plants: 1, 1A, 2, 3 and 4. Total site land is about 370,000 m² (about 52 football fields). Gumi 4 has about 230,000 m² of floor area and was acquired in 2022 [verified, company press].
  - The company's own domestic campus page lists Gumi 1A, Gumi 3, Gwangju and "Paju Factory C7" (lginnotek.com/company/domestic_campus.lgit?locale=en) [verified].
  - Gumi 1A completed in 2015 per the company history.
  - Role: "mother factory" for R&D, new-model high-value camera modules and optics for new applications (idx=6555) [verified].
  - Gumi also hosts FC-BGA substrates ("Dream Factory"; PC FC-BGA mass production from Dec 2024). That is not a camera line.
  - A 2008 anecdote (iPhone-era supplier audit): Gwangju failed, Gumi was substituted and refitted in 45 days. The article does not name the customer, so Apple is [unverified]. Source: inews24/Nate, 2026-04-01.
  - Gumi headcount: not found.
- **Paju (Gyeonggi).**
  - Built as an LED plant (completed Oct 2010, 182,000 m², about 3,000 staff). It was later converted. A "Paju 2" plant is mentioned in the sustainability report.
  - Today it makes camera modules and 3D sensing (idx=6555).
  - Per Nate/ETNews 2026-08-13, it also makes camera modules for a North American humanoid-robot maker (tens of thousands of units, 5–8 cameras per robot), plus XR 3D sensing modules and automotive cameras. It is framed as the Physical-AI base. The same article says the Gumi plant mainly handles mobile camera modules [verified-secondary].
- **Gwangju.**
  - Established April 1985, about 900 staff. It is now the Mobility core base. A KRW 100B extension, completed Dec 2026, brings total floor area to 97,000 m² (idx=6574) [verified].
  - Gwangju was the original camera-module plant (the 2017 ETNews tour). It is not a current iPhone camera base, though the Nate article lists "Gwangju" among Korean factories.
- **Ansan, Magok (Seoul R&D/HQ campus), Pyeongtaek.** Not camera-module iPhone sites as far as the public record shows.

### 2.2 Overseas

- **Hai Phong, Vietnam** (LG Innotek Vietnam Hai Phong Co., Ltd., Trang Due Industrial Park).
  - Established Sept 2016; mass production started Sept 2017 (BusinessPost 2017-10-31: "the new Vietnam plant has been running since September").
  - 2022: more than 3,500 employees and more than USD 1B invested; 2022 revenue VND 78.2T (en.haiphong.gov.vn) [verified, government].
  - Ten-year anniversary on 1 Oct 2026 (Digital Times dt.co.kr/article/12087530; BigGo mirror):
    - Employees went from 800 to 6,500.
    - Floor area is 242,600 m².
    - Cumulative investment is about USD 1.9B and cumulative revenue about USD 25B (about KRW 33T).
    - 2025 revenue was about USD 4.1B; 99% of hires are local [verified-secondary].
  - V3 plant (idx=6555 / lg.co.kr/media/release/29384, 2025-09-21): total floor area about 150,000 m² (45,000 pyeong, about 20 football fields), camera-module capacity at least doubled, and the 2024 Vietnam subsidiary revenue was KRW 5.4T, the largest of its overseas subsidiaries [verified].
  - Product split:
    - Legacy models go to Vietnam; new and high-value models go to Gumi (idx=6532, March 2025).
    - Hankyung (2025-09-24) says Hai Phong output is general-purpose modules shipped to Foxconn in China [verified-secondary].
    - Sisa Journal-e (2025-09-22) says automotive, robotics and high-value modules are made in Gumi, and smartphone modules in Vietnam [verified-secondary].
  - Znews.vn (citing The Elec) claims Gumi and Paju will "gradually shrink". That is a single secondary claim and [unverified].
  - Separate semiconductor-substrate plant at Hai Phong (RF-SiP/FC-CSP/FC-BGA):
    - About USD 1B on a 98,000-pyeong (about 330,000 m²) site (MOU 2026-06-04, idx=6593).
    - Greened.kr says it will be a "100% smart factory" (robots, AMR, AI vision inspection, digital twin).
    - Timing conflicts: Greened/BigGo say groundbreaking in July (some say June) with completion in May 2027; Korea Herald says mid-July groundbreaking with mass production in 2028. [verified for the plan; timing unresolved]
- **Yantai, China**: Optics ISO 9001 site (Sustainability Report). Output and size are not public.
- **San Juan del Rio (Mexico), Wroclaw (Poland), Jakarta (Indonesia)**: automotive/mobility. **Not** camera-module iPhone sites.
- **Employees.**
  - End 2024: 19,115 in total (12,658 in Korea, 6,457 overseas) [verified].
  - The DART-derived 2025 figure of 12,211 looks Korea-only and is ambiguous.
  - The overseas headcount in this report looks understated against Hai Phong alone (6,500), so treat the 6,457 overseas figure as 2024 and the 6,500 Hai Phong figure as Oct 2026.

### 2.3 Apple's supplier list

I could not retrieve the Apple Supplier List PDF. The URL returns an HTML page and bots are blocked. No Apple-published facility list was verified for LG Innotek. This is a gap.

---

## 3. Shop/line layout and process

### 3.1 What is publicly documented

**Source 1: ETNews, 2017-04-06 (etnews.com/20170406000212). A Gwangju plant tour; the module was for the LG G6.** [verified, dated, one plant]
- All manufacturing except inspection and testing happens in a "10-zone" clean room: at most 10 particles of 0.5 µm per ft³ (ISO 4 / Class 10; the article phrases the size as "0.0005 mm"). It is cleaner than a surgical 100-class room.
- Entry takes more than 5 minutes through 7 steps:
  1. Gown and boots.
  2. First adhesive roll.
  3. Static test.
  4. Shoe floor wash.
  5. Air shower.
  6. Second adhesive roll.
  7. Hand wash.
- Process order: wafer-level sensor cleaning, then attach to the substrate (die attach), wire bonding, cleaning and inspection, then IR-filter attach. For the G6 this was automated with no human handling after cleaning.
- Active Alignment (AA) is an LG Innotek-developed process that aligns lens/barrel to sensor including tilt. It is run separately in the 10-zone clean room and the article says it "determines yield".
- Final stage: equipment and visual inspection. The OIS test shakes the module hundreds of times while it shoots. The reliability lab covers shock, extreme temperature, thermal shock and dust.

**Source 2: LG Innotek press release on the G4 OIS module (2015), reproduced at visionsystem.kr/issue-news?tpf=board/view&board_code=2&code=1489** [verified, company-sourced]:
- The "Advanced Active Align" process follows: **die bonding** (placing the CIS on the substrate), **wire bonding** (104 points connecting the substrate and CIS), **0.11 mm ultra-thin glass blue-filter mounting**, and **singulation** (25 units separated per substrate panel). Then the unit is joined with the barrel assembled onto the bidirectional VCM actuator.
- Work happens in a "10-class clean room" (at most 10 particles of 0.0005 mm per cubic foot).
- Tilt is adjusted in 3 µm steps from centre to edge for best resolution.
- In the last 3–4 months of a roughly one-year development, the team devoted themselves to the AA process.
- The VCM was supplied by Mitsumi, with in-house development planned.

**Source 3: LG PRI (LG Production Engineering Research Institute) equipment page, lg-pri.com/page/solution/ca/1/?tab=2** [verified, group-company product page]. It lists camera-module equipment:
- **Active Align**: 6-axis mechanism, AI epoxy-dispense inspection, best-focus and tilt algorithm, particle-minimising sensor, UPH maximisation, batch or in-line configuration.
- Laser soldering.
- Attach with force control and dual dispense.
- Stiffener side-fill dispenser (mobile optical modules).
- Sensor cleaner (HFE-based, in-line or standalone).
- Calibration and tester platforms (actuator tester, CM tester and others).
- Optical particle picker (four detection methods, in-line or batch).

LG PRI shows what the group can build in-house. It does not prove that LG Innotek's iPhone lines use these tools.

**Source 4: LG Chem "Active Align epoxy"** (future-mobility.lgchem.com): a UV/thermal hybrid-cure lens-to-PCB epoxy with low shrinkage and fast initial fixation [verified as a product page; use in LG Innotek lines is [unverified]].

**Source 5: Cure is the hardest step.** Aju Press (ajunews 20261021152635560): LG Innotek was selected for the 2026 "AI Factory" lead project for optical modules (Gumi budget KRW 34.6B, LG Innotek KRW 15.9B). It targets an unmanned AI plus robot curing line by 2029 [verified].

**Source 6: AI process recipe** (idx=6477, 2024-05-30; idx=6555). Introduced in 2023:
- Recipe search time cut from 72 h to 6 h or less.
- Defects reduced by up to 90% on key inspection items.
- "AI incoming-material inspection" cut cause-analysis time by up to 90%.
- Uses tens of millions of data points [verified, company claim].

### 3.2 Canonical flow for the animation

Marked [estimate/inferred]. Order and steps are supported by Sources 1–3. SMT and calibration come from industry practice.

1. **Substrate/FPCB preparation and SMT** of passives and driver parts [estimate].
2. **Die attach (epoxy)** of the CMOS sensor on the board, then **oven cure** [verified step names; oven cure from patent KR101294419B1].
3. **Wire bond** (G4: 104 wires) [verified, G4]. Flip-chip alternative: see §4.4.
4. **Glass IR/blue filter mount**, **singulation** (25 units per panel for G4), cleaning and inspection [verified, G4].
5. **Lens barrel + actuator assembly** (VCM or OIS) [verified].
6. **Active alignment**: 6-axis, best focus plus tilt (3 µm tilt step at G4 time), epoxy dispense, **UV/thermal cure** [verified for method; vendor and numbers for iPhone [unverified]].
7. **Calibration and function test** (AF, OIS shake test, MTF/resolution) and **reliability sampling** [verified generally].
8. **Packing and shipment**; legacy models to Vietnam, new models to Gumi.

### 3.3 Not publicly available

Tact time, UPH, line yield, line count, building layout, current iPhone clean-room class, AGV/OHT use, and the AA tool vendor are all absent from public sources. The user's vendor guesses (ASMPT, AMICRO, Hanwha) are not supported. Third-party AA vendors that exist in the market are TRIOPTICS (ProCam), Hyvision System and ASMPT. None is verified as an LG Innotek supplier [unverified]. LG PRI is the in-group candidate [estimate].

For the model, use clearly labelled placeholder values.

---

## 4. Technology

### 4.1 Actuators and OIS
- **VCM autofocus.** 2005-07: world's smallest 6.4 mm 2MP AF module using a VCM (news.lginnotek.com/938).
- **Bidirectional VCM.** The 2015 module puts the barrel at mid-travel so it focuses faster and uses 50% less power. Mitsumi supplied it (visionsystem.kr, press material).
- **OIS.** 2012-08 → 2013: world's first 13MP OIS module (5.7 mm thick). Later the iPhone 17 main camera uses sensor-shift OIS (Apple spec). LG Innotek's role in the sensor-shift module itself is [unverified].
- **Jahwa.** The Elec (2022-04-15, thelec.net idxno=3988): Jahwa Electronics (KRW 191B OIS facility) would supply OIS actuators to LG Innotek, previously Alps Alpine/Mitsumi. A Corephotonics patent dispute existed; Korean courts invalidated its Korean patents in 2020 [verified, press].

### 4.2 Multi-camera and tele
- 2015: dual camera with active alignment (optical 2×); 2016: Apple had it make the iPhone 7 dual camera (ETNews 2017).
- 2018: first triple camera; V40 ThinQ five cameras.
- **Folded zoom (tetraprism).** LG Innotek was the initial sole supplier for the iPhone 15 Pro Max (MacRumors citing ETNews 2026-04-16) [verified-secondary].
- **Variable aperture (iPhone 18 Pro).** Per MacRumors 2026-04-16 and Korea Herald 2026-08-10, LG Innotek prepared production for June/July 2026 with dedicated Gumi equipment; Sunny Optical makes the aperture actuators and Cowell may also supply. Whether LG Innotek supplies the final module was confirmed only by press, not by the companies [verified-secondary].
- **Foldable iPhone.** Reported LG Innotek supply, unconfirmed by either company [unverified].
- iPhone 17 series: front 18MP Center Stage; Pro rears are all 48MP (main/UW/tetraprism tele); LG Innotek said V3 doubled capacity [verified, Apple spec; supply split [unverified]].

### 4.3 3D sensing
- iPhone X (2017) TrueDepth: LG Innotek supplied the 3D sensing module for the first time (The Investor/ET News; BusinessPost 2017-10-31). The first ramp had yield and productivity problems, which improved sharply after Chuseok (Q3 2017 call). Sharp was the other qualified maker (BusinessPost) [verified].
- ToF module in mass production for iPhone since Feb 2019 (BusinessPost) [verified-secondary]. The exclusive Vision Pro 3D-sensing supplier (2024, BusinessPost) [verified-secondary].
- A 3D module needs a VCSEL, a DOE, an IR CIS, a lens and an FPC, plus active alignment, calibration and test (a Chinese teardown article I read; treat as [estimate] for LG Innotek specifics).
- totaltech.blog's "$238M" figure is [unverified] (looks AI-generated). Ignore it.

### 4.4 Packaging (COB versus flip-chip)
- Patent KR101294419B1 (assignee **LG Innotek**, inventor 우재근; Google Patents): sensor chip on a PCB with epoxy and oven cure, wire bonding, a housing metal-bonded to the PCB, then the lens barrel. Its second embodiment is flip-chip. This is the closest public document to the COB flow, but it is a 2012-era patent. It is not proof of the iPhone line [verified patent; use in Apple lines [unverified]].
- **Warning on KR20130119195A.** That patent describes a flip-chip package, a two-adhesive pre-cure/main-cure active-alignment method and an actuator holder. Its assignee is **Samsung Electro-Mechanics (삼성전기)**, not LG Innotek. Do not attribute it to LG Innotek. It is useful only as a generic description of the technique.
- I found no public statements about Cu pillar, underfill or molded interconnect in LG Innotek camera modules. Those belong to the Package Solutions (FC-CSP/FC-BGA) business [unverified for camera modules].
- Package Solutions: FC-CSP, RF-SiP, FC-BGA. Target Package OP of KRW 1T by 2031 and revenue of 3T by 2030 [verified, company statement].

---

## 5. Timeline

| Year | Event | Source / confidence |
|---|---|---|
| 1970-08-22 | Founding (Geumseong Alps Electronics lineage); other sources vary (Wikipedia Feb 1970; Brand Atlas 1976 incorporation) | Sustainability Report [verified for the date given there] |
| 1995 / 1998 / 1999 / 2000 | LG Electronic Components → LG C&D → merger with LG Precision → LG Innotek | company history [verified] |
| 2003-02 / 06 | Mobile camera module development start / success | news.lginnotek.com/938 [verified] |
| 2005-07 | World's smallest 6.4 mm 2MP AF module | same [verified] |
| 2008 | Camera module sales exceed KRW 1T; Gumi audit anecdote | inews24 / Nate 2026-04-01 [customer unverified] |
| 2009-07 | Merger with LG Micron | [verified] |
| 2010 | First Apple camera supply (iPhone 4) | BusinessPost; Bizwatch [verified-secondary] |
| 2010-10 | Paju LED plant completed | [verified] |
| 2012–13 | First 13MP OIS module | company [verified] |
| 2015 | Gumi 1A completed; dual camera with active alignment; G4 OIS with Advanced AA | company history, visionsystem.kr [verified] |
| 2015-05 | 1 billion smartphone camera modules cumulative | company [verified] |
| 2016 | Hai Phong established (Sept); module sales KRW 2.85T (#1 six years running); Sony exits camera modules, LG Innotek sole dual-camera supplier | ETNews 2017; BusinessPost [verified] |
| 2017 | Hai Phong mass production (Sept); KRW 270B 3D-sensing investment from April; iPhone X 3D sensing | BusinessPost [verified] |
| 2019 | ToF for iPhone | BusinessPost [verified-secondary] |
| 2022-07 | Gumi KRW 1.4T MOU; Gumi 4 acquired | idx=6353 [verified] |
| 2023-07 | Vietnam KRW 1.3T (USD 1B) announced | idx=6555 [verified] |
| 2023 | AI process recipe introduced | idx=6477 [verified] |
| 2024 | Vision Pro 3D sensing; PC FC-BGA mass production (Dec) | [verified-secondary] |
| 2025-03 | Gumi KRW 600B MOU | idx=6532 [verified] |
| 2025-09 | Hai Phong V3 complete, capacity ≥2× | idx=6555 [verified] |
| 2025-11 | KRW 341.1B optics capex for 2026 | ETNews [verified] |
| 2026-06 | Hai Phong substrate-plant MOU (~USD 1B) | idx=6593 [verified] |
| 2026-10 | AI Factory award; Hai Phong 10th anniversary | Aju Press; Digital Times [verified] |

---

## 6. Gaps and uncertainties

- Not found: AA, die-bond and wire-bond tool vendors; tact time; yield; number of lines; AGV/OHT; current iPhone clean-room class; building layout; Gumi/Paju camera floor areas; Gumi headcount.
- The ETNews and visionsystem.kr process descriptions are 2015–2017 era, for Android modules at Gwangju. Apple-line equipment in 2026 will be more advanced.
- I could not read DART directly. 2025 segment figures rely on a DART-derived wiki and agree with press where checked.
- The Apple share differs between sources by 0.3–0.9 pt.
- The Apple Supplier List and the Bizwatch article were not retrievable.
- Hai Phong substrate-plant timing is unresolved.

---

## 7. KEY NUMBERS TABLE

| # | Value | Unit | Source | Confidence |
|---|---|---|---|---|
| 1 | 21.8966 | KRW T, 2025 revenue | lginnotek.com idx=6575 | verified |
| 2 | 21.2008 | KRW T, 2024 revenue | idx=6521 | verified |
| 3 | 20.6053 | KRW T, 2023 revenue | idx=6459 | verified |
| 4 | 665.0 | KRW B, 2025 operating profit | idx=6575 | verified |
| 5 | 706.0 | KRW B, 2024 OP | idx=6521 | verified |
| 6 | 830.8 | KRW B, 2023 OP | idx=6459 | verified |
| 7 | 18.3185 | KRW T, Optics 2025 revenue | DART wiki | verified-secondary |
| 8 | 17.8001 | KRW T, Optics 2024 revenue | press release | verified |
| 9 | 17.2948 | KRW T, Optics 2023 revenue | press release | verified |
| 10 | 83.6 | %, Optics share 2025 | DART wiki | verified-secondary |
| 11 | 482.2 | KRW B, Optics OP 2025 | DART wiki | verified-secondary |
| 12 | 596.6 | KRW B, Optics OP 2024 | HuffPost / wiki | verified-secondary |
| 13 | 663.1 | KRW B, Optics OP 2023 | same | verified-secondary |
| 14 | 7.6098 | KRW T, Q4 2025 revenue (record) | press | verified |
| 15 | 6.3671 | KRW T, Q3 2026 revenue | lg.co.kr/media/release/30719 | verified |
| 16 | 94.8 | KRW B, Q3 2026 OP | same | verified |
| 17 | 5.4041 | KRW T, Optics Q3 2026 | same | verified |
| 18 | 79.6 / 80.5 / 81.1 | %, top customer 2023 / 24 / 25 | HuffPost KR | verified-secondary |
| 19 | 81.4 | %, top customer 2025 (≈17.83T) | thevaluenews | verified-secondary |
| 20 | 77.9 | %, top customer H1 2026 | EDaily | verified-secondary |
| 21 | 80.4 | %, top customer 9M 2026 | metroseoul | verified-secondary |
| 22 | 591,411 | thousand modules, 2025 capacity | DART wiki / Newsway | verified-secondary |
| 23 | 483,093 | thousand modules, 2025 output | same | verified-secondary |
| 24 | 81.7 / 70.8 / 52.5 | %, utilisation 2025 / 24 / 22 | Newsway 2026-03-13 | verified |
| 25 | 41 / 24 / 13 | %, sensor / actuator / lens of raw-material purchases | DART wiki | verified-secondary |
| 26 | 15.6158 | KRW T, raw-material purchases 2025 | same | verified-secondary |
| 27 | 341.1 | KRW B, optics capex through Dec 2026 | etnews 20251127000455 | verified |
| 28 | 375.9 | KRW B, optics facility investment 2025 | same | verified (conflicts with 480.1) |
| 29 | 480.1 | KRW B, optics capex 2025 (cash basis) | DART wiki | verified-secondary |
| 30 | 1.4 | KRW T, Gumi MOU 2022 | idx=6353 | verified |
| 31 | 0.6 | KRW T, Gumi MOU 2025 | idx=6532 | verified |
| 32 | 1.3 (USD 1B) | KRW T, Vietnam 2023–25 | idx=6555 | verified |
| 33 | 270 | KRW B, 3D-sensing investment 2017 | BusinessPost | verified |
| 34 | 370,000 | m², Gumi land | company | verified |
| 35 | 230,000 | m², Gumi 4 floor area | company | verified |
| 36 | 150,000 | m², Hai Phong V3 floor area | idx=6555 | verified |
| 37 | 242,600 | m², Hai Phong total floor area | Digital Times | verified-secondary |
| 38 | 6,500 | employees, Hai Phong, Oct 2026 | Digital Times | verified-secondary |
| 39 | 3,500 | employees, Hai Phong 2022 | en.haiphong.gov.vn | verified |
| 40 | ≈1.9 | USD B, Hai Phong cumulative investment | Digital Times | verified-secondary |
| 41 | ≈4.1 | USD B, Hai Phong 2025 revenue | Digital Times | verified-secondary |
| 42 | 5.4 | KRW T, Vietnam subsidiary revenue 2024 | idx=6555 | verified |
| 43 | 19,115 | employees, group end 2024 | Sustainability Report | verified |
| 44 | 23 / 10 / 13 | sites total / Korea / overseas | Sustainability Report | verified |
| 45 | 10 | clean-room class (≤10 particles/ft³ at 0.5 µm) | ETNews 2017; visionsystem.kr | verified (Gwangju, 2015–17) |
| 46 | 7 steps, >5 | clean-room entry steps / minutes | ETNews 2017 | verified |
| 47 | 104 | wire-bond points, G4 module | visionsystem.kr | verified |
| 48 | 25 | units per substrate panel (singulation), G4 | visionsystem.kr | verified |
| 49 | 3 | µm, tilt-adjust step in AA, G4 | visionsystem.kr | verified |
| 50 | 0.11 | mm, glass blue-filter thickness, G4 | visionsystem.kr | verified |
| 51 | 72 → ≤6 | hours, AI recipe search time | idx=6477 | verified (company claim) |
| 52 | up to 90 | %, defect reduction on key inspections via AI | idx=6477 | verified (company claim) |
| 53 | 34.6 / 15.9 | KRW B, AI Factory budget total / LG Innotek | Aju Press | verified |
| 54 | 2029 | year, unmanned curing line target | Aju Press | verified (target) |
| 55 | 2.85 | KRW T, camera-module revenue 2016 | ETNews 2017 | verified |
| 56 | 6.4 | mm, 2005 smallest 2MP AF module | news.lginnotek.com/938 | verified |
| 57 | 5.7 | mm, 2013 13MP OIS module thickness | company | verified |
| 58 | ~USD 1B, 98,000 pyeong | substrate plant, Hai Phong | idx=6593 | verified |
| 59 | 97,000 | m², Gwangju after extension | idx=6574 | verified |
| 60 | 1.32 million/day | modules per day, average | my arithmetic from #23 | estimate |

---

## 8. CORRECTIONS to your hints

1. **"1.3T Gumi" is wrong.** KRW 1.3T (USD 1B) was for Vietnam (2023–25). Gumi was KRW 1.4T (2022) plus 600B (2025).
2. **"Hai Phong 2 billion USD" is wrong.** Cumulative is about USD 1.9B after 10 years, and the 2023–25 commitment was USD 1B. A further ~USD 1B is a separate substrate plant.
3. **Apple share "70–80%"** should be about 78–81% in recent years (H1 2022 was 72%).
4. **Mexico** is automotive/mobility, not a camera-module site. So are Wroclaw and Jakarta.
5. **Gwangju** was the original camera plant but is now the Mobility base. It is not an iPhone camera site.
6. **First Apple supply** was the iPhone 4 (2010) rear 5MP camera, not a front camera. It is reported by BusinessPost and Bizwatch only; the Apple-side confirmation is missing.
7. **Founding** is August 1970, in the Geumseong Alps lineage. Sources differ (Wikipedia: Feb 1970; Brand Atlas: 1976).
8. **Clean-room class.** Documented as "10-class" (ISO 4-equivalent, ≤10 particles/ft³ at 0.5 µm), not ISO 6–7. This is from 2015–17 and the Gwangju plant. It is likely lower-class (cleaner) in the AA zone only. Do not extrapolate to the whole line or to 2026.
9. **Folded zoom** started on the iPhone 15 Pro Max, with LG Innotek the initial sole supplier.
10. **Patent KR20130119195A** belongs to Samsung Electro-Mechanics. Use KR101294419B1 (LG Innotek) for the COB flow.
11. **AA vendor guesses** (ASMPT, AMICRO, Hanwha) are unsupported. LG PRI publishes its own Active Align tool.
12. **Sustainability Report vs press** differ slightly on Optics 2024 revenue (17.8001T vs 17.8002T). This is rounding.