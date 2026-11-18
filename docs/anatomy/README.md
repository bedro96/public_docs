# 인체 장기 모형 · Human organ model

An interactive, bilingual (한국어 / English) 3D model of the human torso for learning the digestive system.

**Open `human-organs.html`** in any modern browser. It is one self-contained file (about 900 KB: three.js, fonts and data are inlined) and needs no network.

## What it does

1. **The body starts closed.** Press *절개 시작 / Begin the incision*. A scalpel draws a midline cut from the chest to the belly, the cut is pulled open into a wide window, then the skin fades to a transparent outline. The camera ends looking down from a surgeon's point of view. This is a teaching model, not a real operation.
2. **Explore.** Pick an organ from the list (or tap it) to read its name in Korean and English, what it does, and its part in digestion.
   - **Take out:** drag an organ out of the body (or use *꺼내기*). It rests on the shelf; drag it back, or use *넣기* / *모두 넣기*.
   - **Enlarge and rotate:** *확대 · 회전* opens the organ big; drag to turn it, wheel or +/- to zoom, `Esc` to close.
   - Labels, the body outline and the surgeon's view can be toggled or reset from the toolbar.
3. **Follow the meal.** A bite of food travels mouth → esophagus → stomach → small intestine → large intestine → rectum/anus. Each stage lights the organ and its helpers (liver, gallbladder, pancreas) and explains the time it takes.

Organs covered: mouth/teeth 입, esophagus 식도, stomach 위, small intestine 소장, large intestine 대장, liver 간, gallbladder 쓸개, pancreas 췌장, spleen 비장, heart 심장, lungs 폐.

## Assumptions

- The brief wrote "취장"; it is read as **췌장 (pancreas)**.
- Audience: Korean middle-school students; content is simplified and illustrative, not medical advice.
- Organ shapes are procedural and stylised, not scans. Times and sizes are approximate.
- The `anatomy` skill's isometric SVG kit and its beta 3D mode were not used because they cannot give free-rotating organic organs.

## Build and test

```bash
npm install          # three, esbuild
node build.mjs       # writes human-organs.html (needs the Nanum fonts + pyftsubset)
python3 tests/shots.py        # screenshots of every state -> .shots/
python3 tests/incision.py     # the incision sequence -> .shots/inc_*.png
python3 tests/functional.py   # real-input functional test, exit 1 on failure
```

Tests use Playwright (Python) with `/usr/bin/google-chrome` and software GL, so animation is slow; the tests poll state instead of sleeping. A `window.__anatomy` object exposes the state and seek helpers for them.

Source: `src/main.js` (scene, incision, UI), `src/geometry.js` (procedural organs), `src/data.js` (bilingual content), `template.html`, `style.css`. Design notes: `DESIGN.md`, `PRODUCT.md`.
