// Builds one self-contained, offline file: shipyard.html
//   node build.mjs            build the page
//   node build.mjs --check    build, then verify the markup rules (no external urls, hash matches)
// There is no bundler: the isometric kit and the src/ modules are plain ES modules. Node imports them to draw the
// static figures; the page gets the same source, concatenated with its import/export words removed.
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');

const K = await import('./vendor/iso-kit.mjs');
const model = await import('./src/model.js');
const { buildYard, yardBounds } = await import('./src/geo-yard.js');
const { buildVessel, vesselBounds } = await import('./src/geo-vessel.js');

// ---- the two figures -----------------------------------------------------------------------------
const YW = 1200, YH = 720, VW = 1200, VH = 640;
const yardP = K.fitProjection(yardBounds(), YW, YH, { pad: 10, azimuth: 45, elevation: 30 });
const yard = buildYard(K, yardP);
const vesselP = K.fitProjection(vesselBounds(), VW, VH, { pad: 14, azimuth: 58, elevation: 28 });
const vessel = buildVessel(K, vesselP);

const geo = {
  yard: { w: YW, h: YH, P: yardP, anchors: yard.meta.anchors, boxes: yard.meta.boxes, houseBase: yard.houseBase, crane0: yard.crane0, quayPivot: yard.quayPivot, palletTop: yard.palletTop },
  vessel: { w: VW, h: VH, P: vesselP, anchors: vessel.meta.anchors, boxes: vessel.meta.boxes, items: vessel.meta.items, nums: vessel.meta.nums },
};

// ---- markup ----------------------------------------------------------------------------------------------
const yardSvg =
  `<svg id="svg-yard" class="iso-svg fig" viewBox="0 0 ${YW} ${YH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Shipyard in isometric view: warehouse, cutting, welding, assembly and painting shops, dry dock with a goliath crane, and the quay. 조선소 등각 투영도: 자재 창고, 절단·용접·조립·도장 공장, 건조 도크와 골리앗 크레인, 안벽.">` +
  `<g id="y-ground">${yard.ground}</g>` +
  `<g id="y-shops">${yard.shopsSvg}</g>` +
  `<g id="y-quay" class="fac" data-fac="quay">${yard.quaySvg}</g>` +
  `<g id="y-dockback" class="fac" data-fac="dock">${yard.dockBackSvg}${yard.northRail}</g>` +
  `<g id="y-cranefar" class="fac" data-fac="crane">${yard.craneBackSvg}</g>` +
  `<path id="y-sea-top" class="wtop" d="${yard.seaTop}"/><path id="y-dock-top" class="wtop" d=""/>` +
  `<g id="y-gate" class="fac" data-fac="dock">${yard.gate}</g>` +
  `<g id="y-ship" class="fac" data-fac="hull">${yard.blocksSvg.map((b, i) => `<g id="y-pb${i}" class="placed">${b}</g>`).join('')}</g>` +
  `<g id="y-house" class="fac" data-fac="quay">${yard.houseSvg}</g>` +
  `<g id="y-carry" class="fac" data-fac="hull">${yard.blocksSvg.map((b, i) => `<g id="y-cb${i}" class="carry">${b}</g>`).join('')}</g>` +
  `<path id="y-sea-band" class="wband" d="${yard.seaBand}"/><path id="y-dock-band" class="wband" d=""/><path id="y-wline" class="wline" d=""/>` +
  `<g id="y-south" class="fac" data-fac="dock">${yard.southRail}</g>` +
  `<g id="y-rope"></g>` +
  `<g id="y-cranenear" class="fac" data-fac="crane">${yard.craneFrontSvg}<g id="y-trolley">${yard.trolleySvg}</g></g>` +
  `<g id="y-fx"></g>` +
  `<g id="y-wp">${yard.wpSvg}</g>` +
  `<g id="y-foot"></g>` +
  `</svg>`;
const vesselSvg = vessel.svg;

// ---- the page script: kit + model + data + geometry helpers + live code, one scope ----------------------------------------
const strip = (src) => src.replace(/^export (?=(?:const|let|function|class))/gm, '').replace(/^import [^;\n]*;[ \t]*$/gm, '');
const kitSrc = read('vendor/iso-kit.mjs');
const kitNames = [...kitSrc.matchAll(/^export (?:const|function) (\w+)/gm)].map((m) => m[1]);
const dataFile = strip(read('src/data.js'));
const script = [
  '"use strict";',
  strip(kitSrc),
  `const K = { ${kitNames.join(', ')} };`,
  strip(read('src/model.js')),
  `const D = (() => {\n${dataFile}\nreturn { UI, STAGES, FACILITIES, SYSTEMS, ITEMS, ITEM_ORDER, SYSTEM_ORDER, VESSEL_INTRO };\n})();`,
  strip(read('src/geo-common.js')),
  `const GEO = ${JSON.stringify(geo)};`,
  strip(read('src/geo-dyn.js')),
  strip(read('src/live.js')),
].join('\n');
const js = script.replace(/<\/script/gi, '<\\/script');

// ---- font subsetting: only the glyphs the page can show -----------------------------------------------------
const FONTS = [
  { family: 'Square', weight: 700, file: '/usr/share/fonts/truetype/nanum/NanumSquareB.ttf' },
  { family: 'Barun', weight: 400, file: '/usr/share/fonts/truetype/nanum/NanumBarunGothic.ttf' },
  { family: 'Barun', weight: 700, file: '/usr/share/fonts/truetype/nanum/NanumBarunGothicBold.ttf' },
];
const sourceText = ['src/data.js', 'src/live.js', 'src/geo-dyn.js', 'template.html'].map(read).join('\n') + yardSvg + vesselSvg;
const chars = new Set();
for (const ch of sourceText) if (ch.codePointAt(0) > 31) chars.add(ch);
for (let c = 0x20; c < 0x7f; c++) chars.add(String.fromCharCode(c));
for (const ch of '·×°–−→←↑↓…「」µ±≈≥≤') chars.add(ch);
const tmp = mkdtempSync(join(tmpdir(), 'shipyard-'));
const textFile = join(tmp, 'chars.txt');
writeFileSync(textFile, [...chars].join(''));
const pyftsubset = existsSync('/home/azureuser/.local/bin/pyftsubset') ? '/home/azureuser/.local/bin/pyftsubset' : 'pyftsubset';
let faces = '';
try {
  for (const f of FONTS) {
    const out = join(tmp, `${f.family}${f.weight}.woff`);
    execFileSync(pyftsubset, [f.file, `--text-file=${textFile}`, '--flavor=woff', `--output-file=${out}`, '--layout-features=*', '--no-hinting']);
    faces += `@font-face{font-family:'${f.family}';font-weight:${f.weight};font-style:normal;font-display:swap;src:url(data:font/woff;base64,${readFileSync(out).toString('base64')}) format('woff');}\n`;
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

const css = K.ISO_CSS + '\n' + read('style.css').replace('/*__FONTS__*/', faces);
const scriptHash = createHash('sha256').update(js).digest('base64');
const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${scriptHash}'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">`;
const html = read('template.html')
  .replace('<!--__CSP__-->', () => csp)
  .replace('/*__STYLES__*/', () => css)
  .replace('<!--__YARD__-->', () => yardSvg)
  .replace('<!--__VESSEL__-->', () => vesselSvg)
  .replace('/*__SCRIPT__*/', () => js);

const outPath = join(root, 'shipyard.html');
writeFileSync(outPath, html);
const parts = (yardSvg.match(/class="iso-solid/g) || []).length;
const vparts = (vesselSvg.match(/class="iso-solid/g) || []).length;
console.log(`wrote ${outPath} (${(html.length / 1024).toFixed(0)} KB, ${chars.size} glyphs, yard solids ${parts}, vessel solids ${vparts})`);

if (process.argv.includes('--check')) {
  const bad = html.match(/(?:src|href)=["']https?:|url\(["']?https?:/gi);
  if (bad) { console.error('external reference found:', bad); process.exit(1); }
  console.log('check passed: no external references');
}
