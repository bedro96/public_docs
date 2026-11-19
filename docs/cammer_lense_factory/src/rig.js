// Loupe props at module scale (mm): the carrier jig, the ESD tray + bag + carton, and the active-alignment rig.
// Static build-time geometry; the live layer moves a few groups and fades the rest.
import { k, G, PL, LS, LL, LD, lat, lseg } from './mod.js';

const slab = (x, y, w, d, z, h, style = {}, r = 0.4, steps = 3) => LS(k.slabOf({ x, y, w, d, r: Math.min(r, w / 2.2, d / 2.2) }, z, h, PL, steps, 0), { tone: 'mid', crease: 'faint', ...style });
const cyl = (cx, cy, r, z, h, style = {}, steps = 20) => LS(k.cylinder(cx, cy, r, z, h, PL, steps, 0), { tone: 'mid', crease: 'faint', ...style });
const path = (pts, closed = true) => k.pathOf(pts.map((p) => lat(p[0], p[1], p[2])), closed);
const qr = (x, y, z, n = 5, step = 0.8) => {
  const d = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if ((i * 7 + j * 5 + i * j) % 3 !== 0) d.push(lat(x + i * step, y + j * step, z));
  return LD(d, { size: 0.9, tone: 'hi' });
};

// ------------------------------------------------------------------ the single-module carrier jig
export const JIG = { x: -34, y: -24, w: 92, d: 48, z: -3, h: 2.9 };
export function jigSvg() {
  const s = [];
  s.push(slab(JIG.x, JIG.y, JIG.w, JIG.d, JIG.z, JIG.h, { tone: 'hi' }, 2.4, 6));
  // the pocket for the rigid board and the channel for the flex tail
  s.push(LL(k.planOutline({ x: -10.5, y: -8.5, w: 21, d: 17, r: 0.6 }, -0.1, PL, 4), { tone: 'mid' }));
  s.push(LL(k.planOutline({ x: 10.5, y: -3.6, w: 20, d: 7.2, r: 0.5 }, -0.1, PL, 4), { tone: 'mid' }));
  s.push(LL(k.planOutline({ x: 30.5, y: -4.4, w: 8, d: 8.8, r: 0.5 }, -0.1, PL, 4), { tone: 'faint' }));
  // locating pins and two fiducials
  [[-11.2, -9.2], [11.2, -9.2], [-11.2, 9.2], [11.2, 9.2]].forEach(([x, y]) => s.push(cyl(x, y, 0.6, -0.1, 1.5, { tone: 'hi' }, 12)));
  s.push(LD([lat(-29, -19, -0.1), lat(53, 19, -0.1)], { size: 2.0, tone: 'lo' }));
  // handling notches and a 2D code
  s.push(LL(lseg([-34, -12, -0.1], [-30, -12, -0.1]) + lseg([-34, 12, -0.1], [-30, 12, -0.1]), { tone: 'mid', free: true }));
  s.push(qr(44, -20, -0.1, 5, 0.9));
  return `<g class="jigg mt-jig">${s.join('')}</g>`;
}

// ------------------------------------------------------------------ the ESD tray (3 x 3 pockets), its proxies, bag and carton
export const TRAY = { x: -34, y: -24, w: 160, d: 100, z: -3, h: 2.9 };
export const POCKETS = [];
for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) POCKETS.push([i * 44, j * 26]);

function proxyModule(cx, cy) {
  const s = [];
  s.push(slab(cx - 9.5, cy - 7.5, 19, 15, 0, 0.4, { tone: 'hi' }, 0.4, 2));
  s.push(slab(cx + 9.5, cy - 2.5, 18, 5, 0.1, 0.2, { tone: 'mid' }, 0.2, 2));
  s.push(slab(cx - 7.7, cy - 7.7, 15.4, 15.4, 0.4, 8.8, { tone: 'mid' }, 0.5, 3));
  s.push(LL(k.ring(cx, cy, 4.2, 9.2, PL, 24), { tone: 'hi' }));
  s.push(cyl(cx, cy, 3.9, 9.2, 0.4, { tone: 'hi' }, 20));
  return s.join('');
}
export function esdSvg() {
  const back = [];
  back.push(slab(TRAY.x, TRAY.y, TRAY.w, TRAY.d, TRAY.z, TRAY.h, { tone: 'hi' }, 2.4, 6));
  POCKETS.forEach(([x, y]) => {
    back.push(LL(k.planOutline({ x: x - 10.5, y: y - 8.5, w: 21, d: 17, r: 0.6 }, -0.1, PL, 4), { tone: 'mid' }));
    back.push(LL(k.planOutline({ x: x + 10.5, y: y - 3.6, w: 20, d: 7.2, r: 0.5 }, -0.1, PL, 4), { tone: 'faint' }));
  });
  back.push(qr(100, -20, -0.1, 5, 0.9));
  // proxies in far-to-near order; pocket 0 is the hero (drawn by the module itself)
  const prox = POCKETS.map((p, i) => ({ p, i })).slice(1).sort((a, b) => a.p[0] + a.p[1] - (b.p[0] + b.p[1]));
  const items = prox.map(({ p, i }) => `<g class="proxy" data-i="${i}" opacity="0">${proxyModule(p[0], p[1])}</g>`);
  return { back: `<g class="trayg mt-jig">${back.join('')}</g>`, proxies: `<g id="proxies">${items.join('')}</g>` };
}
// the ESD bag: a puffy translucent skin over the tray and its modules, sealed along one edge
export function bagSvg() {
  const s = [];
  s.push(slab(TRAY.x - 5, TRAY.y - 5, TRAY.w + 10, TRAY.d + 10, -2.5, 14, { tone: 'mid', crease: 'faint' }, 7, 5));
  // the seal line runs along the straight part of the near edge (the corners are rounded, r = 7)
  s.push(LL(lseg([TRAY.x + 2, TRAY.y + TRAY.d + 5, 11.5], [TRAY.x + TRAY.w - 2, TRAY.y + TRAY.d + 5, 11.5]), { tone: 'hi', dashed: true }));
  return `<g class="bagg">${s.join('')}</g>`;
}
// the carton: far walls and floor behind the tray, near walls in front of it
export const CARTON = { x: -46, y: -36, w: 184, d: 124, z0: -32, z1: -4 };
export function cartonSvg() {
  const C = CARTON;
  const t = 1.2;
  const h = C.z1 - C.z0;
  const wall = (x, y, w, d) => slab(x, y, w, d, C.z0, h, { tone: 'mid', crease: 'faint' }, 0, 2);
  const back = [
    slab(C.x, C.y, C.w, C.d, C.z0, 1.2, { tone: 'mid' }, 0, 2),
    wall(C.x, C.y, t, C.d), // west
    wall(C.x + t, C.y, C.w - t, t), // south
  ];
  const front = [wall(C.x + C.w - t, C.y + t, t, C.d - t), wall(C.x + t, C.y + C.d - t, C.w - 2 * t, t)];
  const lid = slab(C.x, C.y, C.w, C.d, C.z1, 1.2, { tone: 'mid' }, 0, 2);
  const tape = LL(lseg([C.x + C.w / 2, C.y, C.z1 + 1.2], [C.x + C.w / 2, C.y + C.d, C.z1 + 1.2]), { tone: 'hi', free: true });
  return { back: `<g class="cartong">${back.join('')}</g>`, front: `<g class="cartong">${front.join('')}</g>`, lid: `<g class="cartonlid">${lid}${tape}</g>` };
}

// ------------------------------------------------------------------ the active-alignment rig
export const RIG = {
  chartX: -52,
  chartZ: 28,
  mirror: { x: 0, y: 0, z: 31 },
  hex: { x: 12, y: -34, r0: 13, r1: 7, z0: -3, z1: 25 },
};
export const RIM = [[-7, -7], [0, -7.4], [7, -7], [7.4, 0], [7, 7], [0, 7.4], [-7, 7], [-7.4, 0]];
// the five chart fields: centre and four corners (y, z offsets on the chart plane)
export const FIELDS = [['c', 0, 0], ['tl', 11, 8.5], ['tr', -11, 8.5], ['bl', 11, -8.5], ['br', -11, -8.5]];
const SENSOR_PTS = [[0, 0], [-4.2, 3.3], [4.2, 3.3], [-4.2, -3.3], [4.2, -3.3]];
export const hexBase = () => [0, 1, 2, 3, 4, 5].map((i) => {
  const a = (Math.floor(i / 2) * 120 + (i % 2 ? 14 : -14)) * (Math.PI / 180);
  return [RIG.hex.x + RIG.hex.r0 * Math.cos(a), RIG.hex.y + RIG.hex.r0 * Math.sin(a), RIG.hex.z0];
});
export const hexTop = () => [0, 1, 2, 3, 4, 5].map((i) => {
  const a = (Math.floor(i / 2) * 120 + 60 + (i % 2 ? 14 : -14)) * (Math.PI / 180);
  return [RIG.hex.x + RIG.hex.r1 * Math.cos(a), RIG.hex.y + RIG.hex.r1 * Math.sin(a), RIG.hex.z1];
});

export function rigStatic() {
  const R = RIG;
  const s = [];
  // the chart board with five slanted-edge targets, a lamp bar and a stand
  s.push(slab(R.chartX - 1.5, -17, 1.5, 34, 6, 32, { tone: 'hi' }, 0.4, 2));
  s.push(slab(R.chartX - 6, -9, 8, 18, -3, 9, { tone: 'mid' }, 0.5, 2));
  FIELDS.forEach(([id, dy, dz]) => {
    const y = dy * 0.9;
    const z = R.chartZ + dz * 0.9;
    s.push(LL(path([[R.chartX + 0.1, y - 2.2, z - 2.2], [R.chartX + 0.1, y + 2.2, z - 2.2], [R.chartX + 0.1, y + 2.2, z + 2.2], [R.chartX + 0.1, y - 2.2, z + 2.2]]), { tone: 'hi' }));
    s.push(`<path class="tgt tgt-${id}" d="${path([[R.chartX + 0.1, y - 2.2, z - 2.2], [R.chartX + 0.1, y + 2.2, z - 2.2], [R.chartX + 0.1, y + 2.2, z + 2.2]])}"/>`);
  });
  s.push(slab(R.chartX + 0.2, -17, 3, 34, 38, 2.4, { tone: 'hi' }, 0.3, 2)); // lamp bar
  // the collimator tube between chart and mirror (a lathe cylinder along x)
  const F = G.frameOf([R.chartX + 2, 0, R.chartZ], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  s.push(LS(G.ringBand(0, 34, 4.4, 5.6, F, PL), { tone: 'mid', crease: 'faint' }));
  s.push(LS(G.ringBand(34, 38, 5.6, 6.6, F, PL), { tone: 'hi', crease: 'faint' }));
  // the mirror stand
  s.push(slab(-1.4, -1.4, 2.8, 2.8, 12, 17, { tone: 'mid' }, 0.3, 2));
  s.push(slab(-4, -4, 8, 8, 10, 2, { tone: 'mid' }, 0.5, 2));
  // sensor-side camera brackets (two vision cameras that find the module and the lens)
  [[26, 18], [26, -18]].forEach(([x, y], i) => {
    s.push(slab(x - 3, y - 3, 6, 6, 8, 7, { tone: 'hi' }, 0.6, 3));
    s.push(cyl(x - 4.6, y, 1.9, 9.5, 3.6, { tone: 'mid' }, 14));
    s.push(slab(x - 1.2, y - 1.2, 2.4, 2.4, -3, 11, { tone: 'mid' }, 0.3, 2));
    void i;
  });
  // the hexapod base ring and the six base joints
  const hb = hexBase();
  s.push(cyl(R.hex.x, R.hex.y, R.hex.r0 + 3, R.hex.z0, 2.2, { tone: 'hi' }, 36));
  s.push(LD(hb.map((p) => lat(p[0], p[1], p[2] + 2.2)), { size: 1.6, tone: 'hi' }));
  return `<g class="rigstatic">${s.join('')}</g>`;
}

// the mirror and the rays (they appear with the rig)
export function rigOptics() {
  const R = RIG;
  const m = R.mirror;
  // a 45-degree plate over the module that turns the sensor's view toward the chart (-x)
  const mir = path([[m.x - 8, m.y - 9, m.z - 4], [m.x - 8, m.y + 9, m.z - 4], [m.x + 8, m.y + 9, m.z + 7], [m.x + 8, m.y - 9, m.z + 7]]);
  const rays = FIELDS.map(([id, dy, dz], i) => {
    const sp = SENSOR_PTS[i];
    const y = dy * 0.9;
    const z = R.chartZ + dz * 0.9;
    const up = [sp[0] * 0.3, sp[1] * 0.3, m.z + 1];
    const d = `M${lat(sp[0], sp[1], 9.8).join(' ')}L${lat(up[0], up[1], up[2]).join(' ')}L${lat(R.chartX + 0.3, y, z).join(' ')}`;
    return `<path class="ray ray-${id}" d="${d}"/>`;
  });
  return `<g class="rigoptics"><path class="mirror" d="${mir}"/><g class="rays">${rays.join('')}</g></g>`;
}

// the gripper that holds the lens group (moves with the pose): a side pad, a stalk, a bridge arm and the hexapod platform
export function gripSvg() {
  const R = RIG;
  const s = [];
  s.push(slab(7.9, -3.6, 1.5, 7.2, 4.6, 4.2, { tone: 'hi' }, 0.3, 2)); // suction pad on the yoke's +x face
  s.push(slab(9.4, -3, 2.4, 6, 3.8, 6, { tone: 'mid' }, 0.3, 2)); // bracket
  s.push(slab(10, -1.2, 2.2, 2.4, 9.8, 12.5, { tone: 'mid' }, 0.3, 2)); // stalk
  s.push(slab(R.hex.x - 4, R.hex.y, 8, -R.hex.y - 2 + 2, 22.3, 2.8, { tone: 'hi' }, 0.4, 2)); // arm
  s.push(cyl(R.hex.x, R.hex.y, R.hex.r1 + 3, R.hex.z1 - 2.4, 2.4, { tone: 'hi' }, 30)); // platform
  return `<g class="grip">${s.join('')}</g>`;
}
// six struts (paths set live) and joints
export function strutsSvg() {
  const d = [0, 1, 2, 3, 4, 5].map((i) => `<path class="strut" data-i="${i}" d=""/>`);
  return `<g class="struts">${d.join('')}</g>`;
}

// the dispense needle and the UV lamp
export function needleSvg() {
  const s = [];
  s.push(cyl(0, 0, 0.5, 4.6, 7, { tone: 'hi' }, 10));
  s.push(cyl(0, 0, 1.3, 11.6, 6, { tone: 'mid' }, 14));
  s.push(`<circle class="dropper" cx="0" cy="0" r="0"/>`);
  return `<g class="needle" opacity="0"><g class="needle-in">${s.join('')}</g></g>`;
}
export const UV = { x: 0, y: 24, z: 22 };
export function uvSvg() {
  const U = UV;
  const s = [];
  s.push(slab(U.x - 5, U.y, 10, 3, U.z, 5, { tone: 'hi' }, 0.6, 3)); // lamp head
  s.push(slab(U.x - 1, U.y + 3, 2, 16, U.z + 1, 3, { tone: 'mid' }, 0.3, 2)); // wand
  const cone = path([[U.x - 5, U.y, U.z], [U.x + 5, U.y, U.z], [9, 7, 10], [-9, 7, 10]]);
  return `<g class="uvg">${s.join('')}<path class="uvcone" d="${cone}" opacity="0"/></g>`;
}
// the bake oven hood: a translucent open-front box with heater lines
export function ovenSvg() {
  const o = { x0: -14, x1: 34, y0: -13, y1: 13, z0: -2.9, z1: 17 };
  const wall = (pts) => `<path class="ovwall" d="${path(pts)}"/>`;
  const s = [
    wall([[o.x0, o.y0, o.z0], [o.x1, o.y0, o.z0], [o.x1, o.y0, o.z1], [o.x0, o.y0, o.z1]]), // far (south) wall
    wall([[o.x0, o.y0, o.z0], [o.x0, o.y1, o.z0], [o.x0, o.y1, o.z1], [o.x0, o.y0, o.z1]]), // west wall
    wall([[o.x0, o.y0, o.z1], [o.x1, o.y0, o.z1], [o.x1, o.y1, o.z1], [o.x0, o.y1, o.z1]]), // roof
  ];
  const coils = [];
  for (let i = 0; i < 6; i++) coils.push(LL(lseg([o.x0 + 3 + i * 7, -10, o.z1 - 0.5], [o.x0 + 3 + i * 7, 10, o.z1 - 0.5]), { tone: 'red', free: true }));
  return `<g class="ovenhood" opacity="0">${s.join('')}${coils.join('')}</g>`;
}
