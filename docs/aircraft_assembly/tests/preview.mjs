// Developer preview: renders the hero plane (and anything else passed with --scene) at rest into .shots/preview.html.
//   node tests/preview.mjs [--x0 N --y0 N --w N --h N] [--xray 0..1] [--stage N]
// then  python3 tests/preview.py   to screenshot it. Not part of the shipped page.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1]]] : acc), []));
const { planeSvg } = await import(join(root, 'src/plane.js'));
const { sceneSvg } = await import(join(root, 'src/scene.js'));
const { ISO_CSS } = await import(join(root, 'kit/iso-kit.mjs'));
const { at } = await import(join(root, 'src/world.js'));
const css = readFileSync(join(root, 'style.css'), 'utf8');
const wholeScene = args.scene !== undefined;
const svg = wholeScene ? '' : planeSvg();
const [ox, oy] = at(0, 0, 0);
const w = Number(args.w ?? 560);
const h = Number(args.h ?? 340);
// --focus "x,y,z,w": a world point to centre on and the view width in screen units (aspect 1500:900 like the shots)
let fv = null;
if (args.focus) {
  const [fx, fy, fz, fw] = String(args.focus).split(',').map(Number);
  const [cx, cy] = at(fx, fy, fz);
  fv = { x0: cx - fw / 2, y0: cy - (fw * 0.6) / 2, w: fw, h: fw * 0.6 };
}
const x0 = fv ? fv.x0 : Number(args.x0 ?? ox - 20);
const y0 = fv ? fv.y0 : Number(args.y0 ?? oy - 130);
const vw = fv ? fv.w : w;
const vh = fv ? fv.h : h;
const xray = args.xray ?? '0';
// --scene: the whole static scene (the plane sits at the origin, i.e. at Wichita's left edge); a world point (X, Y, Z) is at screen (at(X, Y, Z))
const body = wholeScene ? sceneSvg().replace(/viewBox="[^"]*"/, `viewBox="${x0} ${y0} ${vw} ${vh}"`).replace('<svg class="iso-svg plant" id="plant"', '<svg class="iso-svg plant" id="plant" data-xray="' + xray + '"') : `<svg id="plant" class="iso-svg" viewBox="${x0} ${y0} ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg" data-xray="${xray}">${svg}</svg>`;
const html = `<!doctype html><meta charset="utf-8"><style>${ISO_CSS}\n${css}\nbody{margin:0;background:#f8f7f2} svg{display:block;width:100vw;height:100vh}</style>
<body class="iso" data-theme="light">${body}
<script>document.querySelectorAll('[data-skin]').forEach(function(n){n.setAttribute('opacity','${xray === '0' ? 1 : xray}')});
${args.show ? `String('${args.show}').split(',').forEach(function(id){var n=document.getElementById(id);if(n)n.removeAttribute('display')});` : ''}</script></body>`;
mkdirSync(join(root, '.shots'), { recursive: true });
writeFileSync(join(root, '.shots/preview.html'), html);
console.log(`preview: ${(body.length / 1024).toFixed(0)} KB, viewBox ${x0} ${y0} ${vw} ${vh}`);
