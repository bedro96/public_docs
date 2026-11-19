// The static world around the aeroplane: supply map, Wichita bay, rail lane, yard, the Renton hall, apron, taxiway and the real-length
// runway. Everything here is drawn once at build time. Moving things (crane, train, cart, jacks, ghosts, the plane) are in scene.js.
import { k, G, P, at, L, D, slab, post, prismXZ, loftOf, pathOf } from './world.js';
import {
  CENTRE, GZ, PITCH, xDay, DECK, DECK_X, RAMP_X0, CRANE_Z, MAP, HUB, SUPPLY, WICHITA, RAIL, YARD, HALL, WINGBAY, APRON, RWY, RWY_END, WING_BAY, WICH_X,
} from './layout.js';
import { rAt } from './hull.js';

const mat = (cls, svg) => `<g class="${cls}">${svg}</g>`;
const poly = (pts3, cls, extra = '') => `<path class="${cls}" ${extra} d="${pathOf(pts3.map((p) => at(...p)))}"/>`;
const line3 = (pts3, style) => L(pathOf(pts3.map((p) => at(...p))), style);
const Z0 = 1.5; // top of the ground slabs

// a screw jack under the aircraft (the live layer redraws it as the aircraft rises): x, y on the floor, topZ = height of its saddle
export const jackSvg = (x, y, topZ) => {
  const h = Math.max(2, topZ - Z0);
  const base = Math.min(h, 8);
  return slab(x - 7, y - 7, 14, 14, Z0, 1.4, { r: 2, tone: 'faint' }) + post(x, y, 3.4, Z0 + 1.4, base, { tone: 'mid', steps: 10 }) +
    (h > base + 1.4 ? post(x, y, 2.4, Z0 + 1.4 + base, h - base - 1.4, { tone: 'mid', steps: 10 }) : '') + slab(x - 5, y - 5, 10, 10, topZ - 1, 1.2, { r: 1, tone: 'faint' });
};

// text laid flat on the floor, reading along +x (rot = 180 for text that reads the other way)
export function flatText(str, x, y, size, { z = Z0 + 0.1, anchor = 'middle', rot = 0, cls = 'ftxt' } = {}) {
  const o = at(x, y, z);
  const ux = at(x + 1, y, z);
  const vy = at(x, y + 1, z);
  const s = rot ? -1 : 1;
  const m = [(ux[0] - o[0]) * s, (ux[1] - o[1]) * s, (vy[0] - o[0]) * s, (vy[1] - o[1]) * s, o[0], o[1]].map((v) => Math.round(v * 1000) / 1000);
  return `<text class="${cls}" transform="matrix(${m.join(' ')})" font-size="${size}" text-anchor="${anchor}">${str}</text>`;
}

const floor = (x0, y0, x1, y1, cls, opts = {}) => mat(cls, slab(x0, y0, x1 - x0, y1 - y0, 0, Z0, { r: opts.r ?? 0, tone: 'faint', crease: 'none', steps: 2 }));

// ---------- the supply map (stage 1) ----------
const ENTRY_Y = [-110, -66, -22, 22, 66, 110];
// order of the lanes at the hub: sorted by y so they do not cross
const LANE_ORDER = SUPPLY.map((n, i) => [n.y, i]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
const hubIn = HUB.x - HUB.w / 2;
export const LANES = SUPPLY.map((n, i) => {
  const ey = ENTRY_Y[LANE_ORDER.indexOf(i)];
  const mx = n.x + (hubIn - 200 - n.x) * 0.55;
  return [[n.x + 30, n.y], [mx, n.y * 0.65 + ey * 0.35], [hubIn - 150, ey], [hubIn, ey]];
});
const laneLen = LANES.map((pts) => pts.slice(1).reduce((s, p, j) => s + Math.hypot(p[0] - pts[j][0], p[1] - pts[j][1]), 0));
// a point a fraction p (0..1) of the way along lane i
export function lanePos(i, p) {
  const pts = LANES[i];
  let d = Math.max(0, Math.min(1, p)) * laneLen[i];
  for (let j = 1; j < pts.length; j++) {
    const seg = Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]);
    if (d <= seg || j === pts.length - 1) {
      const t = seg ? Math.min(1, d / seg) : 0;
      return [pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * t, pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * t];
    }
    d -= seg;
  }
  return pts[pts.length - 1];
}

function crateSvg(kind) {
  const z = Z0;
  switch (kind) {
    case 'fus': return mat('m-al', slab(-42, -11, 84, 22, z, 15, { r: 9, tone: 'mid', steps: 4 }));
    case 'wing': return mat('m-al', slab(-34, -17, 68, 34, z, 6, { r: 2, tone: 'mid' }) + slab(-30, -13, 60, 26, z + 6, 4, { r: 2, tone: 'mid' }));
    case 'tail': return mat('m-comp', slab(-19, -13, 38, 26, z, 6, { r: 2, tone: 'mid' }));
    case 'fin': return mat('m-green', slab(-14, -4, 28, 8, z, 30, { r: 1, tone: 'mid' }));
    case 'eng': return mat('m-eng', slab(-24, -13, 48, 26, z, 22, { r: 11, tone: 'mid', steps: 4 }));
    default: return mat('m-steel', slab(-13, -11, 26, 22, z, 16, { r: 2, tone: 'mid' }));
  }
}
export const crateGroup = (i) => `<g id="crate-${i}" display="none">${crateSvg(SUPPLY[i].crate)}</g>`;

function supplyMap() {
  const out = [];
  out.push(floor(MAP.x0, MAP.y0, MAP.x1, MAP.y1, 'm-wall', { r: 30 }));
  // lanes: only rail is a documented mode, so the others are drawn as plain dotted schematic lines
  LANES.forEach((pts, i) => {
    const m = SUPPLY[i].mode;
    out.push(`<path class="lane${m === 'rail' ? ' rail' : ''}" d="${pathOf(pts.map((p) => at(p[0], p[1], Z0 + 0.1)))}"/>`);
  });
  // supplier nodes
  SUPPLY.forEach((n) => {
    out.push(mat('m-wall', slab(n.x - 28, n.y - 22, 56, 44, Z0, 16, { r: 4, tone: 'mid', steps: 3 })));
    out.push(mat('m-steel', slab(n.x - 20, n.y - 14, 40, 28, Z0 + 16, 3, { r: 2, tone: 'faint' })));
  });
  // Renton: the hub, a saw-tooth factory
  const hx = HUB.x - HUB.w / 2;
  const hy = HUB.y - HUB.d / 2;
  out.push(mat('m-red', slab(hx, hy, HUB.w, HUB.d, Z0, 22, { r: 6, tone: 'mid', steps: 4 })));
  for (let i = 0; i < 4; i++) out.push(mat('m-wall', prismXZ([[hx + 12 + i * 74, Z0 + 22], [hx + 12 + i * 74 + 60, Z0 + 22], [hx + 12 + i * 74 + 60, Z0 + 42]], hy + 14, hy + HUB.d - 14, { tone: 'faint' })));
  return out.join('');
}

// ---------- Wichita: the four barrels are built in separate cells, then slide together and are joined ----------
const BARREL_C = { b48: 45, b46: 127.5, b43: 244, b41: 346 };
export const BARREL_DX0 = { b48: -120, b46: -40, b43: 40, b41: 120 };
export const BARRELS = ['b48', 'b46', 'b43', 'b41'];
export const gantryX = (b) => WICH_X + BARREL_C[b] + BARREL_DX0[b];

function wichita() {
  const out = [];
  out.push(floor(WICHITA.x0, WICHITA.y0, WICHITA.x1, WICHITA.y1, 'm-ground', { r: 10 }));
  // back wall and columns
  out.push(mat('m-wall', slab(WICHITA.x0, WICHITA.y0 - 12, WICHITA.x1 - WICHITA.x0, 12, 0, 140, { tone: 'faint', crease: 'none' })));
  for (let x = WICHITA.x0 + 100; x < WICHITA.x1; x += 400) out.push(mat('m-steel', post(x, WICHITA.y0 + 4, 4, 0, 160, { tone: 'faint', steps: 8 })));
  out.push(mat('m-steel', slab(WICHITA.x0, WICHITA.y0 - 6, WICHITA.x1 - WICHITA.x0, 8, 150, 6, { tone: 'faint', crease: 'none' })));
  // racks of skin panels, stringers and frames along the back wall (the parts the barrels are made of)
  const rack = (x, w, n, cls) => mat(cls, Array.from({ length: n }, (_, i) => slab(x, WICHITA.y0 + 22, w, 60, Z0 + i * 5, 4, { r: 3, tone: 'faint', steps: 3 })).join(''));
  out.push(rack(WICHITA.x0 + 90, 150, 5, 'm-al'));
  out.push(rack(WICHITA.x0 + 270, 150, 4, 'm-al'));
  out.push(mat('m-steel', [0, 1, 2, 3, 4, 5].map((i) => slab(WICHITA.x0 + 460 + i * 22, WICHITA.y0 + 22, 8, 70, Z0, 8, { tone: 'faint', crease: 'none' })).join('')));
  out.push(mat('m-yellow', slab(WICHITA.x1 - 340, WICHITA.y0 + 22, 210, 40, Z0, 10, { r: 2, tone: 'faint' })));
  out.push(`<path class="zoneline" d="${k.planOutline({ x: WICHITA.x0 + 60, y: -170, w: 1860, d: 340, r: 0 }, Z0 + 0.1, P, 1)}"/>`);
  return out.join('');
}
// a cradle under each barrel; it slides with the barrel (live.js sets the x offset)
export const jigSvg = (b) => {
  const c = WICH_X + BARREL_C[b];
  const half = b === 'b43' ? 55 : b === 'b41' ? 16 : 24;
  return `<g id="jig-${b}" class="m-steel">${[-1, 1].map((s) => slab(c + s * half - 4, -22, 8, 44, Z0, GZ - 19 - Z0 + 4, { r: 1, tone: 'faint', steps: 2 })).join('')}${slab(c - half - 10, -26, half * 2 + 20, 6, Z0, 2, { tone: 'faint', crease: 'none' })}</g>`;
};
// the automated drilling / riveting gantry that stands over a barrel (far post behind the plane, the rest in front of it)
const GA = { y: 34, z: GZ + 38 };
export const gantryBack = (b) => {
  const x = gantryX(b);
  return `<g id="gantry-b-${b}" display="none" class="m-yellow">${post(x, -GA.y, 3, Z0, GA.z - Z0, { tone: 'faint', steps: 8 })}</g>`;
};
export const gantryFront = (b) => {
  const x = gantryX(b);
  return `<g id="gantry-f-${b}" display="none"><g class="m-yellow">${post(x, GA.y, 3, Z0, GA.z - Z0, { tone: 'faint', steps: 8 })}${slab(x - 6, -GA.y - 5, 12, GA.y * 2 + 10, GA.z, 6, { tone: 'faint', crease: 'none' })}</g>` +
    `<g id="head-${b}" class="m-steel">${slab(x - 7, -6, 14, 12, GA.z - 10, 10, { r: 2, tone: 'faint' })}<path id="spk-${b}" class="spark" d="${pathOf([at(x - 3, 0, GA.z - 13), at(x + 3, 0, GA.z - 20), at(x - 1, 0, GA.z - 24)])}"/></g></g>`;
};

// ---------- rail leg and the yard ----------
function railAndYard() {
  const out = [];
  const x0 = RAIL.x0 - 520; // the track starts inside the Wichita bay, where the railcar waits for the fuselage
  const x1 = RAMP_X0 - 10;
  out.push(floor(x0, -44, YARD.x0 + 40, 44, 'm-ground', { r: 0 }));
  out.push(floor(YARD.x0, YARD.y0, YARD.x1, YARD.y1, 'm-asphalt', { r: 8 }));
  // ties and rails
  const ties = [];
  for (let x = x0; x < x1; x += 36) ties.push(`M${at(x, -16, Z0 + 0.15).join(' ')}L${at(x, 16, Z0 + 0.15).join(' ')}`);
  ties.push(`M${at(x1, -16, Z0 + 0.15).join(' ')}L${at(x1, 16, Z0 + 0.15).join(' ')}`); // a last tie under the end of the rails
  out.push(`<path class="tie" d="${ties.join('')}"/>`);
  out.push(line3([[x0, -7, Z0 + 0.3], [x1, -7, Z0 + 0.3]], { tone: 'mid' }));
  out.push(line3([[x0, 7, Z0 + 0.3], [x1, 7, Z0 + 0.3]], { tone: 'mid' }));
  // the compressed rail leg: a broken line with two slashes
  const bx = RAIL.brk;
  out.push(mat('m-wall', slab(bx - 24, -52, 48, 104, 0, Z0 + 0.3, { tone: 'faint', crease: 'none' })));
  for (const dx of [-12, 12]) out.push(`<path class="brk" d="${pathOf([at(bx + dx - 14, 50, Z0 + 0.6), at(bx + dx + 14, -50, Z0 + 0.6)])}"/>`);
  out.push(flatText('RENTON YARD', 250, 205, 36, { anchor: 'middle' }));
  return out.join('');
}

// ---------- the hall ----------
function hall() {
  const out = [];
  out.push(floor(HALL.x0, HALL.y0, HALL.x1, HALL.y1, 'm-ground'));
  // back wall, roof beam and the crane rail on it
  const hw = HALL.x1 - HALL.x0;
  out.push(mat('m-wall', slab(HALL.x0, HALL.y0 - 14, hw, 14, 0, 340, { tone: 'faint', crease: 'none' })));
  out.push(mat('m-steel', slab(HALL.x0, HALL.y0 - 10, hw, 12, 330, 8, { tone: 'faint', crease: 'none' })));
  out.push(mat('m-steel', slab(HALL.x0, HALL.y0 + 2, hw, 8, CRANE_Z - 10, 8, { tone: 'faint', crease: 'none' })));
  for (let x = HALL.x0 + 300; x < HALL.x1; x += 600) out.push(mat('m-steel', post(x, HALL.y0 + 6, 5, 0, 330, { tone: 'faint', steps: 8 })));
  // light bars under the beam (a dashed reference line that stops at the hall's ends)
  out.push(L(pathOf([at(HALL.x0, HALL.y0 + 2, 322), at(HALL.x1, HALL.y0 + 2, 322)]), { tone: 'faint', dashed: true, free: true }));
  // position stripes and numbers (a position is one flow day: 1 .. 10)
  const st = [];
  for (let p = 1; p <= 10; p++) {
    const x = xDay(p) + PITCH / 2;
    st.push(`M${at(x, -300, Z0 + 0.1).join(' ')}L${at(x, 310, Z0 + 0.1).join(' ')}`);
  }
  out.push(`<path class="stripe" d="${st.join('')}"/>`);
  for (let p = 1; p <= 10; p++) out.push(flatText(String(p), xDay(p), 262, 62, { cls: 'ftxt big' }));
  // the raised level for the first three positions and its ramp
  const dx0 = DECK_X.x0;
  const dw = DECK_X.x1 - dx0;
  out.push(mat('m-ground', slab(dx0, -90, dw, 180, 0, DECK, { tone: 'mid', crease: 'faint', steps: 2 })));
  out.push(mat('m-yellow', slab(dx0, 90 - 4, dw, 4, DECK, 2, { tone: 'faint', crease: 'none' })));
  out.push(mat('m-yellow', slab(dx0, -90, dw, 4, DECK, 2, { tone: 'faint', crease: 'none' })));
  out.push(mat('m-ground', prismXZ([[RAMP_X0, 0], [dx0, DECK], [dx0, 0]], -90, 90, { tone: 'mid' })));
  // far handrail: posts at both ends of the rail and every ~116 along it
  const nPost = 14;
  for (let i = 0; i <= nPost; i++) out.push(mat('m-steel', post(dx0 + (dw * i) / nPost, -86, 1.4, DECK, 14, { tone: 'faint', steps: 6 })));
  out.push(L(pathOf([at(dx0, -86, DECK + 14), at(DECK_X.x1, -86, DECK + 14)]), { tone: 'mid' }));
  return out.join('');
}

// wing area: tooling trestles under each wing, racks of spars and skin panels
function wingBay() {
  const out = [];
  out.push(`<path class="zoneline" d="${k.planOutline({ x: WINGBAY.x0, y: WINGBAY.y0, w: WINGBAY.x1 - WINGBAY.x0, d: WINGBAY.y1 - WINGBAY.y0, r: 0 }, Z0 + 0.1, P, 1)}"/>`);
  const trestle = (x, y) => post(x, y, 3.2, Z0, 21, { tone: 'faint', steps: 8 }) + slab(x - 9, y - 4, 18, 8, Z0, 2, { tone: 'faint', crease: 'none' });
  // starboard wing (origin 2160, -320): local y -60, -100, -150; port wing (origin 2410, -520): local y +60, +100, +150
  const S1 = [-60, -100, -150].map((ly) => [WING_BAY.S.x + 215, WING_BAY.S.y + ly]);
  const P1 = [60, 100, 150].map((ly) => [WING_BAY.P.x + 215, WING_BAY.P.y + ly]);
  out.push(mat('m-steel', [...S1, ...P1].sort((a, b) => a[1] - b[1]).map(([x, y]) => trestle(x, y)).join('')));
  // racks: two long spars and a stack of skin panels
  out.push(mat('m-steel', [0, 1].map((i) => slab(2740 + i * 26, -525, 10, 175, Z0, 9, { tone: 'faint', crease: 'none' })).join('')));
  out.push(mat('m-al', [0, 1, 2, 3].map((i) => slab(2830, -525, 100, 160, Z0 + i * 5, 4, { r: 3, tone: 'faint', steps: 3 })).join('')));
  // a long drilling / sealing gantry rail along the front edge of the bay
  out.push(mat('m-yellow', slab(WINGBAY.x0 + 10, WINGBAY.y1 - 24, 740, 6, Z0, 3, { tone: 'faint', crease: 'none' })));
  return out.join('');
}

// ---------- apron, taxiway, runway ----------
export const taxiPoint = (q) => {
  // the plane's taxi line (the same curve model.js flies): x runs linearly, y blends from -90 to 0
  const w = (v) => { const t = Math.min(1, Math.max(0, (v - 0.1) / 0.85)); return t * t * (3 - 2 * t); };
  const x0 = APRON.stand + 400;
  const x1 = RWY.start;
  return [x0 + (x1 - x0) * q, -90 * (1 - w(q))];
};
function airside() {
  const out = [];
  out.push(floor(APRON.x0, APRON.y0, APRON.x1, APRON.y1, 'm-asphalt'));
  // the field the runway sits in, long enough for the climb-out
  out.push(floor(RWY.x0 - 600, -1100, 39000, 1100, 'm-ground'));
  // taxiway from the apron to the runway: a stroke along the taxi line
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const q = 0.02 + (i / 24) * 0.97;
    const [x, y] = taxiPoint(q);
    if (x > APRON.x1 - 200) pts.push(at(x, y, Z0 + 0.12));
  }
  pts.unshift(at(APRON.x1 - 300, taxiPoint((APRON.x1 - 300 - (APRON.stand + 400)) / (RWY.start - APRON.stand - 400))[1], Z0 + 0.12));
  out.push(`<path class="taxi" d="${pathOf(pts)}"/>`);
  out.push(floor(RWY.x0, -RWY.w / 2, RWY_END, RWY.w / 2, 'm-asphalt'));
  // stand lines: lead-in line from the stand to the taxi line
  out.push(`<path class="runway-mark" style="stroke:#e3b43c" d="${pathOf([at(APRON.x0 + 250, -90, Z0 + 0.2), at(APRON.stand + 400, -90, Z0 + 0.2)])}"/>`);
  out.push(flatText('RENTON FLIGHT LINE', 8000, 250, 40, { cls: 'ftxt lite' }));
  // runway markings
  const edge = RWY.w / 2 - 12;
  const m = [];
  m.push(`M${at(RWY.x0 + 10, -edge, Z0 + 0.2).join(' ')}L${at(RWY_END - 10, -edge, Z0 + 0.2).join(' ')}`);
  m.push(`M${at(RWY.x0 + 10, edge, Z0 + 0.2).join(' ')}L${at(RWY_END - 10, edge, Z0 + 0.2).join(' ')}`);
  for (let x = RWY.x0 + 400; x < RWY_END - 400; x += 300) m.push(`M${at(x, 0, Z0 + 0.2).join(' ')}L${at(x + 150, 0, Z0 + 0.2).join(' ')}`);
  for (const [xe, dir] of [[RWY.x0 + 30, 1], [RWY_END - 30, -1]]) {
    for (let i = -4; i <= 4; i++) {
      if (!i) continue;
      m.push(`M${at(xe, i * 30 - 6, Z0 + 0.2).join(' ')}L${at(xe + dir * 130, i * 30 - 6, Z0 + 0.2).join(' ')}`);
    }
  }
  out.push(`<path class="runway-mark" d="${m.join('')}"/>`);
  out.push(flatText('34', RWY.x0 + 330, 0, 90, { cls: 'ftxt rw' }));
  out.push(flatText('16', RWY_END - 330, 0, 90, { cls: 'ftxt rw', rot: 180 }));
  // distance along the runway from brake release, every 100 m with a label every 500 m
  const t = [];
  const labels = [];
  for (let d = 0; d <= 1600; d += 100) {
    const x = RWY.start + d * 10;
    const big = d % 500 === 0;
    t.push(`M${at(x, RWY.w / 2 + 4, Z0 + 0.2).join(' ')}L${at(x, RWY.w / 2 + (big ? 70 : 38), Z0 + 0.2).join(' ')}`);
    if (big) labels.push(flatText(d === 0 ? '0' : `${d.toLocaleString('en-US')} m`, x, RWY.w / 2 + 130, 44, { cls: 'ftxt tick' }));
  }
  out.push(`<path class="runway-tick" d="${t.join('')}"/>`);
  out.push(labels.join(''));
  // runway edge lights
  const dots = [];
  for (let x = RWY.x0 + 150; x < RWY_END; x += 300) { dots.push(at(x, -RWY.w / 2 - 6, Z0 + 1)); dots.push(at(x, RWY.w / 2 + 6, Z0 + 1)); }
  out.push(D(dots, { size: 1.3, tone: 'mid' }));
  return out.join('');
}

// ---------- everything that is static, in painter order (back to front) ----------
export function staticBack() {
  return [supplyMap(), wichita(), railAndYard(), hall(), wingBay(), airside()].join('');
}
// columns along the front edge of the hall and the crane rail there: drawn after the plane
export function staticFront() {
  const out = [];
  for (let x = HALL.x0 + 300; x < HALL.x1; x += 600) out.push(mat('m-steel', post(x, HALL.y1 - 6, 4, 0, 330, { tone: 'faint', steps: 8 })));
  out.push(mat('m-steel', slab(HALL.x0, HALL.y1 - 10, HALL.x1 - HALL.x0, 6, CRANE_Z - 10, 6, { tone: 'faint', crease: 'none' })));
  return `<g id="front-static" opacity=".78">${out.join('')}</g>`;
}

// ---------- ghost aircraft: the other planes on the line, pale, at three stages of completeness ----------
// plane-local coordinates, like #plane; each symbol is a plain silhouette with two shade passes
const gsolid = (p) => `<path d="${p.fill}"/>${p.shades[0] || p.shades[1] ? `<path class="gh-s" d="${p.shades[0]}${p.shades[1]}"/>` : ''}${p.top ? `<path class="gh-a" d="${p.top}"/>` : ''}`;
function tubeRings() {
  const xs = [4, 40, 90, 150, 230, 300, 349, 372, 388, 394];
  return xs.map((x) => Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    const r = Math.max(2, x < 62 ? 3 + (18.8 - 3) * (1 - Math.pow(1 - x / 62, 1.7)) : rAt(x));
    return [x, r * Math.cos(a), r * Math.sin(a) + (x < 62 ? (62 - x) * 0.095 : 0)];
  }));
}
export function ghostDefs() {
  const tube = gsolid(loftOf(tubeRings()));
  const wing = (s) => gsolid(G.prismOf(G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]), [[252, s * 18], [169, s * 179], [155, s * 179], [183, s * 18]], -11, -9, P));
  const stab = (s) => gsolid(G.prismOf(G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]), [[60, s * 10], [19, s * 72], [12, s * 72], [14, s * 10]], 4.5, 6, P));
  const fin = gsolid(G.prismOf(G.frameOf([0, 0, 0], [0, 1, 0], [1, 0, 0], [0, 0, 1]), [[78, 17], [24, 91], [5, 91], [11, 17]], -0.7, 0.7, P));
  const gear = [[194, 28.6], [194, -28.6], [348, 0]].map(([x, y]) => gsolid(k.cylinder(x, y, 1.6, -31, 17, P, 8, 0))).join('');
  const eng = (s) => gsolid(loftOf([8.8, 10.4, 10.9, 10.3].map((r, j) => Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2; return [209 + j * 20.6, s * 56 + r * Math.cos(a), -17.6 + r * Math.sin(a)]; }))));
  const l1 = wing(-1) + wing(1) + stab(-1) + stab(1) + fin + gear;
  return `<defs><g id="gh0" class="ghostp">${tube}</g><g id="gh1" class="ghostp">${wing(-1)}${tube}${wing(1)}${fin}${stab(-1)}${stab(1)}${gear}</g>` +
    `<g id="gh2" class="ghostp">${eng(-1)}${wing(-1)}${tube}${wing(1)}${fin}${stab(-1)}${stab(1)}${gear}${eng(1)}</g></defs>`;
}
