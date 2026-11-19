// Shared plant world: coordinates, camera and drawing helpers. Pure: runs in Node (build) and in the browser (live).
// World units: x runs along the flow line (receiving -> dock), y is across it (+y toward the viewer), z is up.
// One unit is roughly 6 cm (a 1.2 m machine is 20 units). The plant is a schematic: bays are drawn at a convenient model scale.
import * as k from '../kit/iso-kit.mjs';
import * as G from '../kit/lathe.mjs';
import { order } from './order.js';

export { k, G, order };

export const W = 1500;
export const H = 600;
export const AZIMUTH = 60;

// Eight bays along the line at y = 0. Bay 8 is the loading dock: the phone assembly itself happens at the customer (see loupe.js).
export const BAYS = {
  recv: { x: 0, y: -92, w: 156, d: 184 },
  smt: { x: 168, y: -92, w: 192, d: 184 },
  bond: { x: 372, y: -92, w: 176, d: 184 },
  lens: { x: 560, y: -92, w: 150, d: 184 },
  aa: { x: 722, y: -92, w: 190, d: 184 },
  test: { x: 924, y: -92, w: 190, d: 184 },
  pack: { x: 1126, y: -92, w: 130, d: 184 },
  dock: { x: 1268, y: -92, w: 92, d: 184 },
};
export const BAY_ORDER = ['recv', 'smt', 'bond', 'lens', 'aa', 'test', 'pack', 'dock'];
export const PLANT = { x: -12, y: -100, w: 1384, d: 200 };
export const LINE_X0 = 10;
export const LINE_X1 = 1340;
// the clean room: from the entry wall (air shower, material pass-through) to the exit pass-through
export const CLEAN = { x0: 160, x1: 918, ceil: 52 };
// the tightest zone: die bond, lens/VCM, active alignment
export const CLEAN_CORE = { x0: 364, x1: 916 };

export const P = k.fitProjection(
  [...k.boxCorners(PLANT, -4, 0), ...k.boxCorners({ x: 0, y: -92, w: 1360, d: 184 }, 0, 70)],
  W,
  H,
  { pad: 22, azimuth: AZIMUTH },
);

export const at = (x, y, z) => k.iso([x, y, z], P);
export const S = (paths, style) => k.solidSvg(paths, style);
export const L = (d, style) => k.lineSvg(d, style);
export const D = (points, style) => k.dotsSvg(points, style);
export const depth = (x, y, z) => k.depthOf([x, y, z], P);

// ---------- depth-ordered layers ----------
// Items are axis-aligned boxes. A is drawn before B when a separating plane puts A behind B for a viewer at +x,+y,+z.
// Where two axes disagree (a diagonal neighbour) the centre depth decides; a cycle falls back to centre depth too.
export function layer() {
  const items = [];
  return {
    items,
    add(box, svg, extra = {}) {
      const b = { x0: box.x, x1: box.x + (box.w ?? 0), y0: box.y, y1: box.y + (box.d ?? 0), z0: box.z ?? 0, z1: (box.z ?? 0) + (box.h ?? 0), svg, ...extra };
      b.key = depth((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2);
      items.push(b);
      return svg;
    },
    svg() {
      return order(items).map((b) => b.svg).join('');
    },
  };
}

// ---------- small solid recipes ----------
// A box with a bevel, screws and an inset groove: the kit's parts vocabulary in one call.
export function box(plan, z, h, { tone = 'mid', steps = 3, bevel = 0.5, crease, groove = false, screws = 0, cls } = {}) {
  const parts = [S(k.slabOf(plan, z, h, P, steps, bevel), { tone, crease, className: cls })];
  if (groove) parts.push(L(k.planOutline(k.insetPlan(plan, groove), z + h, P, steps), { tone: 'faint' }));
  if (screws) {
    const c = k.corners(plan, Math.min(screws, plan.w / 3, plan.d / 3));
    parts.push(D(c.map(([x, y]) => at(x, y, z + h)), { size: 0.4, tone: 'lo' }));
  }
  return parts.join('');
}
export const slab = (x, y, w, d, z, h, opts = {}) => box({ x, y, w, d, r: opts.r ?? 0.8 }, z, h, opts);
export const post = (cx, cy, r, z, h, opts = {}) => S(k.cylinder(cx, cy, r, z, h, P, opts.steps ?? 16, opts.bevel ?? 0), { tone: opts.tone ?? 'mid', crease: opts.crease, lit: opts.lit, className: opts.cls });

// A prism over a convex (x, z) polygon extruded along y from y0 to y1.
const FRAME_Y = G.frameOf([0, 0, 0], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
export function prismXZ(poly, y0, y1, ox = 0, oz = 0) {
  const F = { ...FRAME_Y, o: [ox, 0, oz] };
  return G.prismOf(F, poly, y0, y1, P);
}
// A prism over a convex (y, z) polygon extruded along x from x0 to x1.
export function prismYZ(poly, x0, x1, ox = 0, oz = 0) {
  const F = G.frameOf([ox, 0, oz], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  return G.prismOf(F, poly, x0, x1, P);
}
// A lathe cylinder lying along y (rolls, reels). Slow (a few ms): static parts only.
export function rollY(cx, y0, y1, cz, r, tone = 'mid', opts = {}) {
  const F = G.frameOf([cx, y0, cz], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  return S(G.solidOf([[0, r], [y1 - y0, r]], F, P, { steps: opts.steps ?? 20 }), { tone, crease: opts.crease, className: opts.cls });
}
export function rollX(x0, x1, cy, cz, r, tone = 'mid', opts = {}) {
  const F = G.frameOf([x0, cy, cz], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  return S(G.solidOf([[0, r], [x1 - x0, r]], F, P, { steps: opts.steps ?? 20 }), { tone, crease: opts.crease, className: opts.cls });
}

// A scene has painter slots drawn in this order: BACK (everything behind the line, the floor and anything under the carrier),
// WORK (the moving carrier), FRONT (everything in front of the line and anything overhead). Items inside a slot are depth-sorted
// by axis-aligned boxes; anything that straddles the line is split by the caller into a back piece and a front piece.
export function newScene() {
  return { back: layer(), front: layer(), work: [], fx: [] };
}
// Wrap an item in a bay tag so the stage selector can dim the other bays.
export const tag = (bay, svg) => `<g data-b="${bay}">${svg}</g>`;

export const rect = (x0, x1, y0, y1, z) => [at(x0, y0, z), at(x1, y0, z), at(x1, y1, z), at(x0, y1, z)];
export const polyPath = (pts) => k.pathOf(pts, true);
// closed rectangles drawn on the faces of a box (windows, doors, labels)
export const faceY = (x0, x1, y, z0, z1) => k.pathOf([at(x0, y, z0), at(x1, y, z0), at(x1, y, z1), at(x0, y, z1)], true);
export const faceX = (x, y0, y1, z0, z1) => k.pathOf([at(x, y0, z0), at(x, y1, z0), at(x, y1, z1), at(x, y0, z1)], true);
export const sw = (a, b) => k.segment(a, b, P);
