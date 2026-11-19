// Builds one self-contained, offline file: camera-module-factory.html
//   node build.mjs            build
//   node build.mjs --audit    build, then run structural checks on the output ("audit passed" or exit 1)
// Both isometric drawings (the plant and the loupe) are made at build time by src/scene.js with the anatomy skill's kit
// (linked as ./kit); the live layer is bundled with esbuild; Korean fonts are subset to the glyphs actually used and inlined,
// so nothing is fetched at run time.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, symlinkSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir, homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');
const audit = process.argv.includes('--audit');
const OUT = 'camera-module-factory.html';

// the kit lives with the anatomy skill; link it so the sources import './kit/...' the way the skill's examples do
const KIT_SRC = join(homedir(), '.agents/skills/anatomy/kit');
if (!existsSync(join(root, 'kit'))) {
  if (!existsSync(KIT_SRC)) throw new Error(`anatomy kit not found at ${KIT_SRC}`);
  symlinkSync(KIT_SRC, join(root, 'kit'));
}

const { plantSvg, loupeSvg } = await import('./src/scene.js');
const { ISO_CSS } = await import('./kit/iso-kit.mjs');
const t0 = Date.now();
const plant = plantSvg();
const t1 = Date.now();
const loupe = loupeSvg();
console.log(`plant: ${(plant.length / 1024).toFixed(0)} KB in ${t1 - t0} ms; loupe: ${(loupe.length / 1024).toFixed(0)} KB in ${Date.now() - t1} ms`);

const bundle = await build({
  entryPoints: [join(root, 'src/main.js')],
  bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, legalComments: 'none',
});
// keep the bundle inert inside an HTML <script>: no literal "</script" or "<!--" (either would change how the parser reads it)
const js = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

// ---- font subsetting: glyphs used by the sources, plus printable ASCII ----
const FONTS = [
  { family: 'Round', weight: 400, file: '/usr/share/fonts/truetype/nanum/NanumSquareRoundR.ttf' },
  { family: 'Round', weight: 700, file: '/usr/share/fonts/truetype/nanum/NanumSquareRoundB.ttf' },
  { family: 'Coding', weight: 700, file: '/usr/share/fonts/truetype/nanum/NanumGothicCodingBold.ttf' },
];
const srcFiles = readdirSync(join(root, 'src')).filter((f) => f.endsWith('.js')).map((f) => `src/${f}`);
const sourceText = [...srcFiles, 'template.html'].map(read).join('\n');
const chars = new Set();
for (const ch of sourceText) if (ch.codePointAt(0) > 31) chars.add(ch);
for (let c = 0x20; c < 0x7f; c++) chars.add(String.fromCharCode(c));
for (const ch of '·×°–−→←↑↓…µ≈÷±℃≥≤') chars.add(ch);
const tmp = mkdtempSync(join(tmpdir(), 'camfactory-'));
const textFile = join(tmp, 'chars.txt');
writeFileSync(textFile, [...chars].join(''));
const subsetter = [join(homedir(), '.local/bin/pyftsubset'), 'pyftsubset'].find((p) => p === 'pyftsubset' || existsSync(p));
let faces = '';
try {
  for (const f of FONTS) {
    const out = join(tmp, `${f.family}${f.weight}.woff`);
    execFileSync(subsetter, [f.file, `--text-file=${textFile}`, '--flavor=woff', `--output-file=${out}`, '--layout-features=*', '--no-hinting']);
    faces += `@font-face{font-family:'${f.family}';font-weight:${f.weight};font-style:normal;font-display:swap;src:url(data:font/woff;base64,${readFileSync(out).toString('base64')}) format('woff');}\n`;
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

const css = read('style.css').replace('/*__FONTS__*/', () => faces);

// ---- assemble the page, then pin the script by the hash of the text that is ACTUALLY in the output ----
// The page is offline and self-contained, so it may load nothing from anywhere else (see the CSP below).
// The template must carry each placeholder exactly once, and the script placeholder on one line with nothing around it,
// because CSP hashes cover every character between <script> and </script> (including whitespace).
const template = read('template.html');
const PLACEHOLDERS = ['<!--__CSP__-->', '/*__STYLES__*/', '<!--__PLANT__-->', '<!--__LOUPE__-->', '/*__SCRIPT__*/'];
for (const ph of PLACEHOLDERS) {
  const n = template.split(ph).length - 1;
  if (n !== 1) throw new Error(`template.html must contain ${ph} exactly once (found ${n})`);
}
if (!template.includes('<script>/*__SCRIPT__*/</script>')) {
  throw new Error('template.html: the script placeholder must be written exactly as <script>/*__SCRIPT__*/</script> (no whitespace around it)');
}
const inlineScripts = (doc) => [...doc.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)];
const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('base64');

let html = template
  .replace('/*__STYLES__*/', () => ISO_CSS + '\n' + css)
  .replace('<!--__PLANT__-->', () => plant)
  .replace('<!--__LOUPE__-->', () => loupe)
  .replace('/*__SCRIPT__*/', () => js);
// hash exactly what sits between <script> and </script> in the assembled document (the CSP meta lives in <head>, outside it)
const scripts = inlineScripts(html);
if (scripts.length !== 1) throw new Error(`expected exactly one inline <script>, found ${scripts.length}`);
const scriptHash = sha256(scripts[0][2]);
const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${scriptHash}'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">`;
html = html.replace('<!--__CSP__-->', () => csp);
for (const ph of PLACEHOLDERS) if (html.includes(ph)) throw new Error(`placeholder ${ph} was not substituted`);

const outPath = join(root, OUT);
writeFileSync(outPath, html);
console.log(`wrote ${outPath} (${(html.length / 1024).toFixed(0)} KB, ${chars.size} glyphs)`);

// verify against the FILE ON DISK: the hash in the meta tag must equal the hash of the script text as shipped
{
  const disk = readFileSync(outPath, 'utf8');
  const found = inlineScripts(disk);
  const meta = disk.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/);
  const pinned = meta && [...meta[1].matchAll(/script-src\s+'sha256-([^']+)'/g)].map((m) => m[1]);
  if (found.length !== 1) throw new Error(`output has ${found.length} inline scripts, expected 1`);
  if (!pinned || pinned.length !== 1) throw new Error('output CSP does not pin exactly one script hash');
  if (found[0][2].includes('\r')) throw new Error('script text contains a carriage return: the HTML parser would normalise it and the hash would no longer match');
  if (pinned[0] !== sha256(found[0][2])) throw new Error('CSP script hash does not match the script text in the output');
  console.log(`csp: script-src pinned to sha256-${pinned[0].slice(0, 12)}… (${found[0][2].length} chars verified in the output)`);
}

if (audit) {
  // Structural audit. (The kit's SDF audit needs a recorded solid registry, which this scene does not keep; see README.)
  const problems = [];
  const { PARTS } = await import('./src/parts.js');
  const { BAYS } = await import('./src/world.js');
  const need = ['plant', 'loupe', 'fx', 'car', 'car-tray', 'car-l1', 'car-l5', 'car-bag', 'car-carton', 'agv', 'person', 'shower', 'truck-b', 'truck-f', 'truck-door', 'mod',
    'l-jig', 'l-esd', 'l-proxies', 'l-bag', 'l-cartonb', 'l-cartonf', 'l-cartonlid', 'l-phoneb', 'l-phonef', 'l-screws', 'l-lid', 'l-rig', 'l-optics', 'l-struts', 'l-grip', 'l-needle', 'l-uv', 'l-oven', 'l-scale', 'l-back',
    'arm-lens', 'arm-aa', 'arm-pack', 'glow-reflow', 'glow-plasma', 'glow-oven', 'uv-lamp', 'wafer',
    'fig', 'lfig', 'chips', 'route', 'scrub', 'cap-ko', 'cap-en', 'readouts', 'ctl-prev', 'ctl-play', 'ctl-next', 'ctl-skip', 'ctl-restart', 'ctl-over', 'ctl-replay', 'status', 'fail', 'rm-note', 'parts-list',
    'dlg-compare', 'dlg-business', 'dlg-sources', 'open-compare', 'open-business', 'open-sources', 'aahud', 'biz'];
  for (const id of need) if (!html.includes(`id="${id}"`)) problems.push(`missing id ${id}`);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dup.length) problems.push(`duplicate ids: ${[...new Set(dup)].slice(0, 6).join(', ')}`);
  for (const p of PARTS) if (!html.includes(`data-p="${p.id}"`)) problems.push(`missing module part ${p.id}`);
  if (PARTS.length < 60) problems.push(`only ${PARTS.length} module parts, the brief asks for at least 60`);
  for (const b of Object.keys(BAYS)) if (!html.includes(`data-bay-floor="${b}"`)) problems.push(`missing bay floor ${b}`);
  const bare = html.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<script>[\s\S]*?<\/script>/, '');
  if (/(src|href)\s*=\s*["']https?:/i.test(bare) || /url\(\s*["']?https?:/i.test(html)) problems.push('external URL in the page');
  if (/\son[a-z]+\s*=/.test(bare)) problems.push('inline event handler');
  if (/\beval\s*\(|new Function\(/.test(js)) problems.push('eval/new Function in bundle');
  if (/NaN|undefined/.test(plant) || /NaN|undefined/.test(loupe)) problems.push('NaN/undefined inside an SVG');
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(bare)) problems.push('emoji in the page');
  if (problems.length) { console.error('audit FAILED:\n - ' + problems.join('\n - ')); process.exit(1); }
  console.log(`audit passed (${PARTS.length} module parts, ${ids.length} ids)`);
}
