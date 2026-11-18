// Builds one self-contained, offline file: human-organs.html
// three.js + app code are bundled with esbuild; Korean fonts are subset to the glyphs actually used.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');

const bundle = await build({
  entryPoints: [join(root, 'src/main.js')],
  bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, legalComments: 'none',
});
const js = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

// ---- font subsetting ----
const FONTS = [
  { family: 'Myeongjo', weight: 400, file: '/usr/share/fonts/truetype/nanum/NanumMyeongjo.ttf' },
  { family: 'Myeongjo', weight: 700, file: '/usr/share/fonts/truetype/nanum/NanumMyeongjoBold.ttf' },
  { family: 'Round', weight: 400, file: '/usr/share/fonts/truetype/nanum/NanumSquareRoundR.ttf' },
  { family: 'Round', weight: 700, file: '/usr/share/fonts/truetype/nanum/NanumSquareRoundB.ttf' },
];
const sourceText = ['src/data.js', 'src/main.js', 'template.html'].map(read).join('\n');
const chars = new Set();
for (const ch of sourceText) if (ch.codePointAt(0) > 31) chars.add(ch);
for (let c = 0x20; c < 0x7f; c++) chars.add(String.fromCharCode(c));
for (const ch of '·×°–−→←↑↓…「」·') chars.add(ch);
const tmp = mkdtempSync(join(tmpdir(), 'anatomy-'));
const textFile = join(tmp, 'chars.txt');
writeFileSync(textFile, [...chars].join(''));

let faces = '';
for (const f of FONTS) {
  const out = join(tmp, `${f.family}${f.weight}.woff`);
  execFileSync('pyftsubset', [f.file, `--text-file=${textFile}`, '--flavor=woff', `--output-file=${out}`, '--layout-features=*', '--no-hinting']);
  const b64 = readFileSync(out).toString('base64');
  faces += `@font-face{font-family:'${f.family}';font-weight:${f.weight};font-style:normal;font-display:swap;src:url(data:font/woff;base64,${b64}) format('woff');}\n`;
}
rmSync(tmp, { recursive: true, force: true });

const css = read('style.css').replace('/*__FONTS__*/', faces);
const html = read('template.html')
  .replace('/*__STYLES__*/', () => css)
  .replace('/*__SCRIPT__*/', () => js);

const outPath = join(root, 'human-organs.html');
writeFileSync(outPath, html);
console.log(`wrote ${outPath} (${(html.length / 1024).toFixed(0)} KB, ${chars.size} glyphs)`);
