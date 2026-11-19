// The finale props at the phone's own scale (mm): a generic phone (no logo, no marks) in iso, open at the back, plus the flat
// back view and the real-size comparison strip. The camera plateau and the lens windows are schematic [estimate].
import { k, PL, LS, LL, LD, lat, lseg, LOUPE_REGIONS } from './mod.js';
import { order } from './order.js';
import { PHONE, MODULE_MM } from './model.js';

const PX0 = -22; // phone top edge (camera end) in module coordinates
const PY0 = -17;
export const PH = { x0: PX0, x1: PX0 + PHONE.l, y0: PY0, y1: PY0 + PHONE.w, zf: -4.4, zb: 5.25, bump: 4.05 };

const plan = (b, r) => ({ x: b.x, y: b.y, w: b.w, d: b.d, r: Math.min(r, b.w / 2.2, b.d / 2.2) });
const slabAt = (b, style = {}, r = 0.3, steps = 3) => LS(k.slabOf(plan(b, r), b.z, b.h, PL, steps, 0), { tone: 'mid', crease: 'faint', ...style });
const cyl = (cx, cy, r, z, h, style = {}, steps = 18) => LS(k.cylinder(cx, cy, r, z, h, PL, steps, 0), { tone: 'mid', crease: 'faint', ...style });
const B = (x0, y0, z0, x1, y1, z1) => ({ x: x0, y: y0, z: z0, w: x1 - x0, d: y1 - y0, h: z1 - z0 });
const keyOf = (b) => (((b.x + b.w / 2) * 0.766 + (b.y + b.d / 2) * 0.643) * 0.866) + (b.z + b.h / 2) * 0.5;
const asItem = (id, b, svg, cls) => ({ id, svg, cls, x0: b.x, x1: b.x + b.w, y0: b.y, y1: b.y + b.d, z0: b.z, z1: b.z + b.h, key: keyOf(b) });

// the static parts of the open phone (everything except the back glass, the module and the screws)
function items() {
  const out = [];
  const add = (id, b, svg, cls = 'ph') => out.push(asItem(id, b, svg, cls));
  const W = PH;
  const wall = 2.2;
  // display assembly (the floor) and the housing rim
  const floor = B(W.x0, W.y0, W.zf, W.x1, W.y1, W.zf + 1.0);
  add('floor', floor, slabAt(floor, { tone: 'hi' }, 9, 8), 'ph-floor');
  const rimz = [W.zf + 1.0, W.zb - 0.8];
  const rim = (id, x0, y0, x1, y1) => { const b = B(x0, y0, rimz[0], x1, y1, rimz[1]); add(id, b, slabAt(b, { tone: 'hi' }, 0.2, 2), 'ph-rim'); };
  rim('rim-w', W.x0, W.y0, W.x0 + wall, W.y1);
  rim('rim-s', W.x0 + wall, W.y0, W.x1, W.y0 + wall);
  rim('rim-e', W.x1 - wall, W.y0 + wall, W.x1, W.y1);
  rim('rim-n', W.x0 + wall, W.y1 - wall, W.x1 - wall, W.y1);
  // battery
  const bat = B(60, -9, W.zf + 1.0, 119, 47, W.zf + 4.4);
  add('battery', bat, slabAt(bat, { tone: 'mid' }, 2, 4) + LL(k.planOutline({ x: 64, y: -5, w: 51, d: 48, r: 1 }, W.zf + 4.4, PL, 3), { tone: 'faint' }) + LD([lat(70, 2, W.zf + 4.4), lat(70, 36, W.zf + 4.4)], { size: 1.4, tone: 'lo' }), 'ph-bat');
  // logic board with the B2B receptacle and a few chips
  const lb = B(14, -15, W.zf + 1.0, 52, 41, -0.8);
  add('logic', lb, slabAt(lb, { tone: 'hi' }, 2.5, 4), 'ph-lb');
  const sock = B(22, -3.2, -0.8, 28.8, 3.2, 0.1);
  add('socket', sock, slabAt(sock, { tone: 'hi' }, 0.2, 2) + LD(Array.from({ length: 8 }, (_, i) => lat(22.7 + i * 0.75, 0, 0.1)), { size: 0.7, tone: 'lit' }), 'ph-sock');
  [[32, -9, 9, 7], [32, 5, 7, 8], [43, 14, 6, 6], [32, 24, 8, 8]].forEach(([x, y, w, d], i) => {
    const c = B(x, y, -0.8, x + w, y + d, 0.5);
    add(`chip${i}`, c, slabAt(c, { tone: 'hi' }, 0.4, 2) + LD([lat(x + 0.9, y + 0.9, 0.5)], { size: 1.0, tone: 'lit' }), 'ph-chip');
  });
  // the camera frame: a low recess wall round the module, open toward the flex
  const cz = [-0.8, 2.0];
  const cw = 1.0;
  const rc = (id, x0, y0, x1, y1) => { const b = B(x0, y0, cz[0], x1, y1, cz[1]); add(id, b, slabAt(b, { tone: 'hi' }, 0.1, 2), 'ph-frame'); };
  rc('cf-w', -13, -13, -13 + cw, 13);
  rc('cf-s', -13 + cw, -13, 13, -13 + cw);
  rc('cf-n', -13 + cw, 13 - cw, 13, 13);
  rc('cf-e1', 13 - cw, -13 + cw, 13, -3.4);
  rc('cf-e2', 13 - cw, 3.4, 13, 13 - cw);
  // the two clamp ears for the screws
  const ear = (id, x0, y0, x1, y1) => { const b = B(x0, y0, -0.8, x1, y1, 1.0); add(id, b, slabAt(b, { tone: 'hi' }, 0.5, 2), 'ph-ear'); };
  ear('ear-a', -11.5, 7.9, -3.5, 11.9);
  ear('ear-b', 3.5, -11.9, 11.5, -7.9);
  // dummy neighbours: the ultra-wide and telephoto stand-ins (ghosted boxes with lens rings)
  const dummy = (id, cx, cy) => {
    const b = B(cx - 7, cy - 7, 0, cx + 7, cy + 7, 8.4);
    add(id, b, slabAt(b, { tone: 'mid' }, 0.8, 3) + LL(k.ring(cx, cy, 3.4, 8.4, PL, 28), { tone: 'hi' }), 'ph-dummy');
  };
  dummy('dummy-uw', 0, 20.5);
  dummy('dummy-tele', 19.5, 10.4);
  return out;
}

export function phoneStatic() {
  const its = items();
  // the module's footprint decides which static parts are drawn before it and which after
  const modBox = B(-9.5, -7.7, 0, 28.4, 7.7, 9.7);
  const MOD = asItem('MOD', modBox, '', '');
  const sorted = order([...its, MOD]);
  const at = sorted.findIndex((q) => q.id === 'MOD');
  const wrap = (list) => list.map((q) => `<g class="${q.cls}">${q.svg}</g>`).join('');
  return { back: wrap(sorted.slice(0, at)), front: wrap(sorted.slice(at + 1)) };
}

// screws: head r 1.1 with a slot, 2.9 mm and 3.8 mm shank lengths are the teardown's [verified]; only the heads are drawn
export const SCREWS = [{ x: -7.5, y: 9.9, z: 1.0, len: 2.9 }, { x: 7.5, y: -9.9, z: 1.0, len: 3.8 }];
export function screwSvg(i) {
  const s = SCREWS[i];
  return `<g class="screw" data-i="${i}" opacity="0">${cyl(s.x, s.y, 1.1, s.z, 0.7, { tone: 'hi' }, 14)}${LL(lseg([s.x - 1.1, s.y, s.z + 0.7], [s.x + 1.1, s.y, s.z + 0.7]), { tone: 'hi' })}</g>`;
}

// the back glass with the camera plateau and the lens windows
export function lidSvg() {
  const W = PH;
  const s = [];
  const glass = B(W.x0, W.y0, W.zb - 0.8, W.x1, W.y1, W.zb);
  s.push(slabAt(glass, { tone: 'hi', crease: 'faint' }, 9, 8));
  const plat = B(-15, -13, W.zb, 28.5, 30, W.zb + W.bump);
  s.push(slabAt(plat, { tone: 'hi' }, 7, 6));
  const top = W.zb + W.bump;
  const win = (cx, cy, r) => LL(k.ring(cx, cy, r, top, PL, 32), { tone: 'hi' }) + LL(k.ring(cx, cy, r - 1.0, top, PL, 28), { tone: 'mid' }) + cyl(cx, cy, r - 1.0, top - 0.1, 0.5, { tone: 'lit' }, 24);
  s.push(win(0, 0, 4.8), win(0, 20.5, 4.4), win(19.5, 10.4, 4.4));
  s.push(cyl(24, 23.4, 1.7, top - 0.1, 0.4, { tone: 'hi' }, 14), cyl(8, 26, 1.4, top - 0.1, 0.4, { tone: 'hi' }, 12));
  return `<g class="lidg" opacity="0">${s.join('')}</g>`;
}

// ------------------------------------------------------------------ the flat back view and the real-size strip (landscape)
// drawn in millimetres inside a group that live.js places and scales; strokes stay one pixel wide (non-scaling)
export const BACK = { w: PHONE.l, h: PHONE.w, scale: 6.6, ox: -14, oy: -6, tw: 196, th: 134 };
export function backRegion() {
  // the flat view sits where the 'phone' region is, so the camera only has to pan a little
  const r = LOUPE_REGIONS.phone;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const s = BACK.scale;
  const w = BACK.tw * s + 60;
  const h = BACK.th * s + 60;
  return { cx, cy, s, x: cx - w / 2, y: cy - h / 2, w, h };
}
export function backViewSvg() {
  const R = backRegion();
  const s = BACK.scale;
  const L = (cls, d) => `<path class="${cls}" d="${d}"/>`;
  const rr = (x, y, w, h, r) => `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
  const circ = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
  const text = (x, y, t, cls = 'bv-t', anchor = 'middle') => `<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}">${t}</text>`;
  const g = [];
  g.push(L('bv-body', rr(0, 0, BACK.w, BACK.h, 9)));
  // the camera plateau at the left (the camera end), three windows, a flash and a LiDAR stand-in
  g.push(L('bv-plat', rr(4, 4, 38, 38, 10)));
  [[14, 14, 6.6], [14, 31, 6.0], [31, 23, 6.0]].forEach(([x, y, r]) => { g.push(L('bv-ring', circ(x, y, r))); g.push(L('bv-glass', circ(x, y, r - 1.6))); });
  g.push(L('bv-glass', circ(35, 9, 1.8)), L('bv-glass', circ(36, 37, 2.2)));
  // the module footprint under the main window (15 mm square) with its callout
  g.push(L('bv-mod', rr(14 - MODULE_MM / 2, 14 - MODULE_MM / 2, MODULE_MM, MODULE_MM, 1.2)));
  g.push(L('bv-lead', 'M21.5 14H52'));
  g.push(text(54, 16.2, '≈ 15 mm', 'bv-acc', 'start'));
  // length ruler under the phone
  const ry = BACK.h + 6;
  const tick = [];
  for (let i = 0; i <= 14; i++) tick.push(`M${i * 10} ${ry}v${i % 5 === 0 ? 5 : 3}`);
  g.push(L('bv-ruler', `M0 ${ry}H${BACK.w}${tick.join('')}M${BACK.w} ${ry}v5`));
  g.push(text(BACK.w / 2, ry + 13, '149.6 mm'));
  // the thickness profile to the right: a thin bar with the camera bump on its camera side
  const tx = BACK.w + 12;
  g.push(L('bv-body', rr(tx, 0, PHONE.t, BACK.h, 1.2)));
  g.push(L('bv-plat', `M${tx} 4v38h-3.5v-38z`));
  g.push(L('bv-ruler', `M${tx} ${BACK.h + 6}h${PHONE.t}M${tx} ${BACK.h + 4}v4M${tx + PHONE.t} ${BACK.h + 4}v4`));
  g.push(text(tx + PHONE.t / 2, BACK.h + 19, '8.25', 'bv-t'));
  g.push(`<text class="bv-t" x="${tx + PHONE.t + 11}" y="${BACK.h / 2}" text-anchor="middle" transform="rotate(90 ${tx + PHONE.t + 11} ${BACK.h / 2})">71.5 mm</text>`);
  // the strip: module (15 mm) against the phone (149.6 mm) on one common ruler
  const ty = BACK.h + 34;
  // (wrapped in one group so the live layer can fade the strip in at the very end of the finale)
  const strip = [];
  strip.push(L('bv-bar', `M0 ${ty}h${BACK.w}M0 ${ty - 3}v6M${BACK.w} ${ty - 3}v6`));
  strip.push(L('bv-barmod', `M0 ${ty - 3}h${MODULE_MM}v6h${-MODULE_MM}Z`));
  strip.push(text(MODULE_MM / 2, ty - 6, '15', 'bv-acc'));
  strip.push(text(BACK.w / 2, ty - 6, '149.6'));
  strip.push(text(0, ty + 12, '실제 크기 비교: 모듈 ≈ 15 mm [추정] · 폰 149.6 mm', 'bv-t', 'start'));
  strip.push(text(0, ty + 21, 'Real size: module ≈ 15 mm [estimate] · phone 149.6 mm', 'bv-t', 'start'));
  g.push(`<g class="bv-strip">${strip.join('')}</g>`);
  void lat;
  // centre the drawn group (phone, side view, labels, strip: about 185 x 128 mm) in the region
  const ox = R.cx - 92.5 * s;
  const oy = R.cy - 64 * s;
  return { svg: `<g class="backg" transform="translate(${ox.toFixed(1)} ${oy.toFixed(1)}) scale(${s})">${g.join('')}</g>`, region: R };
}
void PX0;
