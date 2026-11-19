// The loupe: the hero module drawn at its own scale (1 world unit = 1 mm), one named <g data-p> per part.
// Everything here is static, build-time geometry. The live layer only moves groups (translate / rotate) and fades them.
import * as k from '../kit/iso-kit.mjs';
import * as G from '../kit/lathe.mjs';
import { order } from './order.js';
import { PARTS, LENS, SPACERS, ORDER_ASM, ORDER_BOM } from './parts.js';

export { k, G };

export const LW = 2600;
export const LH = 1500;
export const LAZ = 40;
// the whole scene: phone, jig, rig. Its bounds set the projection scale; the camera then zooms by changing the viewBox.
export const WORLD = { x0: -76, x1: 132, y0: -34, y1: 64, z0: -34, z1: 70 };
export const PL = k.fitProjection(
  k.boxCorners({ x: WORLD.x0, y: WORLD.y0, w: WORLD.x1 - WORLD.x0, d: WORLD.y1 - WORLD.y0 }, WORLD.z0, WORLD.z1),
  LW, LH, { pad: 30, azimuth: LAZ },
);
export const lat = (x, y, z) => k.iso([x, y, z], PL);
export const LS = (paths, style) => k.solidSvg(paths, style);
export const LL = (d, style) => k.lineSvg(d, style);
export const LD = (pts, style) => k.dotsSvg(pts, style);
export const lseg = (a, b) => k.segment(a, b, PL);

// a world box (mm) -> a viewBox rectangle in user units (before the camera's aspect adjustment)
export function projBox(b) {
  const pts = k.boxCorners({ x: b.x0, y: b.y0, w: b.x1 - b.x0, d: b.y1 - b.y0 }, b.z0, b.z1).map((p) => lat(p[0], p[1], p[2]));
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
export const LOUPE_BOXES = {
  bom: { x0: -16, x1: 40, y0: -14, y1: 14, z0: -3, z1: 68 },
  jig: { x0: -38, x1: 62, y0: -26, y1: 26, z0: -4, z1: 14 },
  mod: { x0: -14, x1: 34, y0: -12, y1: 12, z0: -3, z1: 13 },
  tall: { x0: -14, x1: 34, y0: -12, y1: 12, z0: -3, z1: 30 },
  aa: { x0: -58, x1: 34, y0: -52, y1: 24, z0: -3, z1: 42 },
  aaclose: { x0: -12, x1: 32, y0: -16, y1: 46, z0: -3, z1: 30 },
  oven: { x0: -24, x1: 38, y0: -22, y1: 22, z0: -3, z1: 30 },
  tray: { x0: -34, x1: 120, y0: -34, y1: 72, z0: -30, z1: 24 },
  carton: { x0: -52, x1: 144, y0: -44, y1: 96, z0: -34, z1: 30 },
  recess: { x0: -30, x1: 50, y0: -24, y1: 34, z0: -8, z1: 46 },
  flexrt: { x0: -22, x1: 60, y0: -24, y1: 26, z0: -8, z1: 24 },
  phone: { x0: -28, x1: 132, y0: -22, y1: 58, z0: -8, z1: 36 },
};
export const LOUPE_REGIONS = Object.fromEntries(Object.entries(LOUPE_BOXES).map(([n, b]) => [n, projBox(b)]));

// ------------------------------------------------------------------ small recipes
const plan = (b, r = 0.25) => ({ x: b.x, y: b.y, w: b.w, d: b.d, r: Math.min(r, b.w / 2.2, b.d / 2.2) });
function slabB(b, style = {}, steps = 3, bevel = 0, r = 0.25) {
  return LS(k.slabOf(plan(b, r), b.z, b.h, PL, steps, bevel), { tone: 'mid', crease: 'faint', ...style });
}
const cylB = (cx, cy, r, z, h, style = {}, steps = 24) => LS(k.cylinder(cx, cy, r, z, h, PL, steps, 0), { tone: 'mid', crease: 'faint', ...style });
// a hollow rectangular tube (four strips, far ones first)
function frameB(x0, y0, x1, y1, wall, z, h, style = {}) {
  const s = (x, y, w, d) => LS(k.slabOf({ x, y, w, d, r: 0 }, z, h, PL, 2, 0), { tone: 'mid', crease: 'faint', ...style });
  return s(x0, y0, wall, y1 - y0) + s(x0 + wall, y0, x1 - x0 - wall, wall) + s(x1 - wall, y0 + wall, wall, y1 - y0 - wall) + s(x0 + wall, y1 - wall, x1 - x0 - 2 * wall, wall);
}
const AXIS_Z = (z) => G.frameOf([0, 0, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
function ringZ(z0, z1, rIn, rOut, style = {}) {
  return LS(G.ringBand(0, z1 - z0, rIn, rOut, AXIS_Z(z0), PL), { tone: 'mid', crease: 'faint', ...style });
}
function lensElement(l) {
  const t = l.z1 - l.z0;
  const ro = l.r - 0.5;
  const q = (r) => 1 - (r / ro) ** 2;
  const sf = (r) => t + l.a1 * 0.5 * q(r);
  const sb = (r) => l.a2 * 0.5 * q(r) * -1 + Math.max(0, l.a2 * 0.5);
  const n = 5;
  const back = [];
  const front = [];
  for (let i = 0; i <= n; i++) {
    const r = (ro * i) / n;
    const wob = l.wv ? l.wv * 0.4 * Math.sin((i / n) * Math.PI * 2) : 0; // aspheric inflection on L5-L7
    back.push([Math.max(0, sb(r) + wob), r]);
    front.push([Math.min(t, sf(r) + wob), r]);
  }
  const prof = [...back, [back[n][0], l.r], [front[n][0], l.r], ...front.reverse()];
  return LS(G.solidOf(prof, AXIS_Z(l.z0), PL, { steps: 48 }), { tone: 'mid', crease: 'faint' });
}
const ptsAt = (list, z) => list.map(([x, y]) => lat(x, y, z));

// ------------------------------------------------------------------ one builder per part (default: a bevelled slab)
function sensorSvg(b) {
  const s = [slabB(b, { tone: 'hi' }, 3, 0, 0.2)];
  const top = b.z + b.h;
  // the active area (9.84 x 7.38 mm [estimate]) and the bond pads along the north and south edges
  s.push(LL(k.planOutline({ x: -4.92, y: -3.69, w: 9.84, d: 7.38, r: 0.1 }, top, PL, 3), { tone: 'hi' }));
  const pads = [];
  for (let i = 0; i < 13; i++) { pads.push(lat(-4.2 + i * 0.7, 4.0, top), lat(-4.2 + i * 0.7, -4.0, top)); }
  for (let i = 0; i < 11; i++) pads.push(lat(-5.25, -3.5 + i * 0.7, top));
  s.push(LD(pads, { size: 0.9, tone: 'mid' }));
  s.push(LL(k.planOutline({ x: -4.2, y: -2.9, w: 8.4, d: 5.8, r: 0 }, top, PL, 2), { tone: 'faint', dashed: true }));
  return s.join('');
}
function wiresSvg(id) {
  const out = [];
  const top = 2.1;
  const loop = (a, b, lift) => {
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.max(a[2], b[2]) + lift];
    const p = [lat(...a), lat(mid[0] * 0.5 + a[0] * 0.5, mid[1] * 0.5 + a[1] * 0.5, mid[2] * 0.9), lat(...mid), lat(mid[0] * 0.5 + b[0] * 0.5, mid[1] * 0.5 + b[1] * 0.5, mid[2] * 0.9), lat(...b)];
    return `M${p.map((q) => q.map((v) => Math.round(v * 10) / 10).join(' ')).join('L')}`;
  };
  if (id === 'wire-n') for (let i = 0; i < 13; i++) out.push(loop([-4.2 + i * 0.7, 4.0, top], [-4.2 + i * 0.7, 4.85, 1.6], 0.55));
  if (id === 'wire-s') for (let i = 0; i < 13; i++) out.push(loop([-4.2 + i * 0.7, -4.0, top], [-4.2 + i * 0.7, -4.85, 1.6], 0.55));
  if (id === 'wire-w') for (let i = 0; i < 11; i++) out.push(loop([-5.25, -3.5 + i * 0.7, top], [-5.8, -3.5 + i * 0.7, 1.6], 0.5));
  const ends = [];
  return out.map((d) => LL(d, { tone: 'hi', className: 'wire' })).join('') + LD(ends, {});
}
function coilSvg(b) {
  const s = [slabB(b, { tone: 'mid' }, 3, 0, 0.35)];
  const top = b.z + b.h;
  const n = 3;
  for (let i = 1; i <= n; i++) {
    const g = (Math.min(b.w, b.d) / 2 - 0.12) * (i / (n + 0.6));
    s.push(LL(k.planOutline({ x: b.x + g, y: b.y + g, w: b.w - 2 * g, d: b.d - 2 * g, r: 0.2 }, top, PL, 3), { tone: 'lo' }));
  }
  return s.join('');
}
function magnetSvg(b) {
  // north / south halves: the seam is drawn across the long side
  const s = [slabB(b, { tone: 'hi', crease: 'faint' }, 3, 0, 0.1)];
  const top = b.z + b.h;
  const long = b.w > b.d;
  const m = long ? [lat(b.x + b.w / 2, b.y, top), lat(b.x + b.w / 2, b.y + b.d, top)] : [lat(b.x, b.y + b.d / 2, top), lat(b.x + b.w, b.y + b.d / 2, top)];
  s.push(LL(`M${m[0].join(' ')}L${m[1].join(' ')}`, { tone: 'hi' }));
  return s.join('');
}
function passiveSvg(b) {
  const s = [slabB(b, { tone: 'mid' }, 2, 0, 0)];
  const top = b.z + b.h;
  const long = b.w < b.d;
  const caps = long
    ? [[b.x, b.y + b.d * 0.22, b.x + b.w, b.y + b.d * 0.22], [b.x, b.y + b.d * 0.78, b.x + b.w, b.y + b.d * 0.78]]
    : [[b.x + b.w * 0.22, b.y, b.x + b.w * 0.22, b.y + b.d], [b.x + b.w * 0.78, b.y, b.x + b.w * 0.78, b.y + b.d]];
  caps.forEach((c) => s.push(LL(lseg([c[0], c[1], top], [c[2], c[3], top]), { tone: 'hi' })));
  return s.join('');
}
function icSvg(b) {
  const top = b.z + b.h;
  return slabB(b, { tone: 'hi' }, 2, 0, 0.1) + LD([lat(b.x + 0.25, b.y + 0.25, top)], { size: 1.0, tone: 'lit' });
}
function pcbSvg(b) {
  const s = [slabB(b, { tone: 'hi' }, 3, 0, 0.5)];
  const top = b.z + b.h;
  const pads = [];
  for (let i = 0; i < 12; i++) pads.push(lat(-8.2 + i * 1.5, 6.9, top), lat(-8.2 + i * 1.5, -6.9, top));
  s.push(LD(pads, { size: 0.8, tone: 'mid' }));
  s.push(LL(k.planOutline({ x: -9.0, y: -7.0, w: 18, d: 14, r: 0.3 }, top, PL, 3), { tone: 'faint' }));
  s.push(LD([lat(-8.6, -6.6, top), lat(8.6, 6.6, top)], { size: 1.6, tone: 'lo' })); // fiducials
  return s.join('');
}
function flexSvg(b) {
  const s = [slabB(b, { tone: 'hi', crease: 'none' }, 2, 0, 0.2)];
  const top = b.z + b.h;
  for (const dy of [-1.5, -0.75, 0, 0.75, 1.5]) s.push(LL(lseg([b.x, dy, top], [b.x + b.w - 5.4, dy, top]), { tone: 'mid', free: true }));
  return s.join('');
}
function b2bSvg(b) {
  const top = b.z + b.h;
  const pins = [];
  for (let i = 0; i < 10; i++) pins.push(lat(b.x + 0.5 + i * ((b.w - 1) / 9), b.y + b.d / 2, top));
  return slabB(b, { tone: 'hi' }, 2, 0, 0.1) + LD(pins, { size: 0.7, tone: 'lit' });
}
function pasteSvg() {
  // 24 deposits on the pads, a hint of the stencil pattern
  const d = [];
  PARTS.filter((p) => /^(c\d+|ic-|eeprom)/.test(p.id)).forEach((p) => d.push(lat(p.box.x + p.box.w / 2, p.box.y + p.box.d / 2, 0.45)));
  for (let i = 0; i < 12; i++) d.push(lat(-8.2 + i * 1.5, 6.2, 0.45), lat(-8.2 + i * 1.5, -6.2, 0.45));
  return LD(d, { size: 1.5, tone: 'mid' });
}
function springSvg(b) {
  return slabB(b, { tone: 'mid' }, 2, 0, 0.1);
}
function irHolderSvg(b) {
  return frameB(b.x, b.y, b.x + b.w, b.y + b.d, 1.4, b.z, b.h, { tone: 'mid' });
}
function glassSvg(b) {
  const top = b.z + b.h;
  return slabB(b, { tone: 'hi', crease: 'faint' }, 2, 0, 0.1) + LL(lseg([b.x + 1.2, b.y + b.d - 0.7, top], [b.x + 4.2, b.y + 0.7, top]), { tone: 'lit', free: true }) + LL(lseg([b.x + 2.4, b.y + b.d - 0.7, top], [b.x + 4.8, b.y + 2.0, top]), { tone: 'lit', free: true });
}
function adhSvg() {
  const drops = [[-7, -7], [0, -7.4], [7, -7], [7.4, 0], [7, 7], [0, 7.4], [-7, 7], [-7.4, 0]];
  return drops.map(([x, y], i) => `<g class="drop" data-i="${i}">${cylB(x, y, 0.75, 3.78, 0.28, { tone: 'hi' }, 12)}</g>`).join('');
}
function shieldSvg(b) {
  const top = b.z + b.h;
  return slabB(b, { tone: 'hi', crease: 'faint' }, 3, 0, 0.5) + LL(k.planOutline({ x: -7.0, y: -7.0, w: 14, d: 14, r: 0.4 }, top, PL, 3), { tone: 'faint' }) + LL(k.ring(0, 0, 4.2, top, PL, 36), { tone: 'hi' });
}
function labelSvg(b) {
  const top = b.z + b.h;
  const d = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i * 5 + j * 3) % 3 !== 1) d.push(lat(b.x + 0.5 + i * 0.85, b.y + 0.5 + j * 0.85, top));
  return slabB(b, { tone: 'mid' }, 2, 0, 0.1) + LD(d, { size: 0.9, tone: 'hi' });
}
function filmSvg(b) {
  return cylB(0, 0, 4.9, b.z, b.h, { tone: 'mid', crease: 'none' }, 40);
}
function stopSvg(b) {
  return ringZ(b.z, b.z + b.h, 2.0, 3.6, { tone: 'hi' });
}
function posts(b) {
  return cylB(b.x + b.w / 2, b.y + b.d / 2, 0.52, b.z, b.h, { tone: 'hi' }, 14);
}
function yokeSvg(b) {
  return frameB(b.x, b.y, b.x + b.w, b.y + b.d, 0.5, b.z, b.h, { tone: 'mid' }) + frameB(b.x, b.y, b.x + b.w, b.y + b.d, 2.0, b.z + b.h - 0.35, 0.35, { tone: 'mid' });
}
function barrelSvg() {
  return ringZ(4.2, 9.2, 3.8, 4.3, { tone: 'mid' }) + ringZ(9.2, 9.6, 3.2, 4.3, { tone: 'hi' });
}

const BUILD = {
  base: pcbSvg, flex: flexSvg, b2b: b2bSvg, sensor: sensorSvg, ircf: glassSvg, holder: irHolderSvg, adh: adhSvg,
  shield: shieldSvg, label: labelSvg, film: filmSvg, stop: stopSvg, yoke: yokeSvg, barrel: barrelSvg, paste: pasteSvg,
  'ic-ois': icSvg, 'ic-af': icSvg, eeprom: icSvg,
  carrier: (b) => frameB(b.x, b.y, b.x + b.w, b.y + b.d, 1.1, b.z, b.h, { tone: 'mid' }),
  'af-coil': (b) => frameB(b.x, b.y, b.x + b.w, b.y + b.d, 0.4, b.z, b.h, { tone: 'mid' }) + [0.4, 0.8, 1.2, 1.6, 2.0].map((dz) => LL(k.planOutline({ x: b.x, y: b.y, w: b.w, d: b.d, r: 0 }, b.z + dz, PL, 2), { tone: 'lo' })).join(''),
  retainer: (b) => ringZ(b.z, b.z + b.h, 3.0, 3.9, { tone: 'hi' }),
};

export function buildPart(p) {
  const b = p.box;
  let svg;
  if (BUILD[p.id]) svg = BUILD[p.id](b);
  else if (/^wire-/.test(p.id)) svg = wiresSvg(p.id);
  else if (/^c\d+$/.test(p.id)) svg = passiveSvg(b);
  else if (/^coil-/.test(p.id)) svg = coilSvg(b);
  else if (/^(mag|afmag)-/.test(p.id)) svg = magnetSvg(b);
  else if (/^spr-/.test(p.id)) svg = springSvg(b);
  else if (/^post-/.test(p.id)) svg = posts(b);
  else if (/^L\d$/.test(p.id)) svg = lensElement(LENS.find((l) => l.id === p.id));
  else if (/^sp\d$/.test(p.id)) { const s = SPACERS.find((q) => q.id === p.id); svg = ringZ(s.z0, s.z1, 2.9, 3.9, { tone: 'mid' }); } else svg = slabB(b, { tone: 'hi' }, 3, 0, 0.15);
  return svg;
}

// ------------------------------------------------------------------ the module: <g id="mod"> -> <g id="mod-lens"> + the other parts
// Parts sit in assembled order; stage 1 swaps the DOM order once to the exploded order (live.js), then back.
export function moduleSvg() {
  const byId = Object.fromEntries(PARTS.map((p) => [p.id, p]));
  const g = (id) => {
    const p = byId[id];
    const cls = `mt mt-${p.mat}${p.ghost ? ' ghost' : ''} g-${p.grp}`;
    return `<g class="${cls}" data-p="${p.id}" data-grp="${p.grp}" opacity="0">${buildPart(p)}</g>`;
  };
  return ORDER_ASM.map((id) => g(id)).join('');
}
export const MOD_ORDER = { asm: ORDER_ASM, bom: ORDER_BOM };
void order;
