// Shared world: coordinates, camera and drawing helpers. Pure: runs in Node (build) and in the browser (live).
// World units: x runs along the flow line (coil yard -> shipping), y is across it (+y toward the viewer), z is up.
// One unit is roughly 6 cm, so the 80-unit car is about 4.8 m long. Bays are drawn at a convenient model scale.
import * as k from '../kit/iso-kit.mjs';
import * as G from '../kit/lathe.mjs';

export { k, G };

export const W = 1500;
export const H = 600;
export const AZIMUTH = 60;

// The plant: six bays along the line at y = 0 (the car's centre line) plus the engine bay behind the assembly bay.
export const BAYS = {
  coil: { x: 0, y: -90, w: 130, d: 180 },
  press: { x: 146, y: -90, w: 190, d: 180 },
  body: { x: 352, y: -90, w: 170, d: 180 },
  paint: { x: 538, y: -90, w: 476, d: 180 },
  assembly: { x: 1030, y: -90, w: 200, d: 180 },
  ship: { x: 1246, y: -90, w: 150, d: 180 },
  engine: { x: 1030, y: -300, w: 200, d: 170 },
};
export const PLANT = { x: -16, y: -316, w: 1428, d: 420 };
export const LINE_X0 = 14;
export const LINE_X1 = 1380;

export const P = k.fitProjection(
  [...k.boxCorners(PLANT, -4, 0), ...k.boxCorners({ x: 0, y: -90, w: 1396, d: 180 }, 0, 120), ...k.boxCorners(BAYS.engine, 0, 70)],
  W,
  H,
  { pad: 26, azimuth: AZIMUTH },
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

const EPS = 0.01;
function before(a, b) {
  // returns -1 if a is behind b, 1 if a is in front of b, 0 if the boxes are not separable
  let votes = 0;
  if (a.x1 <= b.x0 + EPS) votes -= 1;
  else if (b.x1 <= a.x0 + EPS) votes += 1;
  if (a.y1 <= b.y0 + EPS) votes -= 1;
  else if (b.y1 <= a.y0 + EPS) votes += 1;
  if (a.z1 <= b.z0 + EPS) votes -= 1;
  else if (b.z1 <= a.z0 + EPS) votes += 1;
  if (votes < 0) return -1;
  if (votes > 0) return 1;
  return 0;
}
export function order(items) {
  const n = items.length;
  const behind = Array.from({ length: n }, () => new Set()); // behind[j] = items that must come before j
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let r = before(items[i], items[j]);
      if (r === 0) r = items[i].key <= items[j].key ? -1 : 1;
      if (r < 0) behind[j].add(i);
      else behind[i].add(j);
    }
  }
  const out = [];
  const done = new Array(n).fill(false);
  for (let step = 0; step < n; step++) {
    let pick = -1;
    for (let i = 0; i < n; i++) {
      if (done[i]) continue;
      let ready = true;
      for (const j of behind[i]) if (!done[j]) { ready = false; break; }
      if (ready && (pick < 0 || items[i].key < items[pick].key)) pick = i;
    }
    if (pick < 0) { // cycle: take the farthest remaining
      for (let i = 0; i < n; i++) if (!done[i] && (pick < 0 || items[i].key < items[pick].key)) pick = i;
    }
    done[pick] = true;
    out.push(items[pick]);
  }
  return out;
}

// ---------- small solid recipes ----------
// A box with a bevel, screws and an inset groove: the kit's parts vocabulary in one call.
export function box(plan, z, h, { tone = 'mid', steps = 3, bevel = 0.5, crease, groove = false, screws = 0 } = {}) {
  const parts = [S(k.slabOf(plan, z, h, P, steps, bevel), { tone, crease })];
  if (groove) parts.push(L(k.planOutline(k.insetPlan(plan, groove), z + h, P, steps), { tone: 'faint' }));
  if (screws) {
    const c = k.corners(plan, Math.min(screws, plan.w / 3, plan.d / 3));
    parts.push(D(c.map(([x, y]) => at(x, y, z + h)), { size: 0.4, tone: 'lo' }));
  }
  return parts.join('');
}
export const slab = (x, y, w, d, z, h, opts = {}) => box({ x, y, w, d, r: opts.r ?? 0.8 }, z, h, opts);
export const post = (cx, cy, r, z, h, opts = {}) => S(k.cylinder(cx, cy, r, z, h, P, opts.steps ?? 16, opts.bevel ?? 0), { tone: opts.tone ?? 'mid', crease: opts.crease, lit: opts.lit });

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
// A lathe cylinder lying along y (rolls, wheels). Slow (a few ms): static parts only.
export function rollY(cx, y0, y1, cz, r, tone = 'mid', opts = {}) {
  const F = G.frameOf([cx, y0, cz], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  return S(G.solidOf([[0, r], [y1 - y0, r]], F, P, { steps: opts.steps ?? 20 }), { tone, crease: opts.crease });
}
export function rollX(x0, x1, cy, cz, r, tone = 'mid', opts = {}) {
  const F = G.frameOf([x0, cy, cz], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  return S(G.solidOf([[0, r], [x1 - x0, r]], F, P, { steps: opts.steps ?? 20 }), { tone, crease: opts.crease });
}

// A scene is three painter slots drawn in this order: BACK (everything behind the car's centre line, plus the floor and anything
// under the car), WORK (the moving workpieces: coil, strip, panels, car) and FRONT (everything in front of the line and anything
// overhead). Items inside a slot are depth-sorted by axis-aligned boxes. Anything that would straddle the line is split by the
// caller into a back piece, a front piece and an overhead piece, so the order stays correct whatever the workpiece does.
export function newScene() {
  return { back: layer(), front: layer(), work: [], fx: [] };
}
// Wrap an item in a bay tag so the stage selector can dim the other bays.
export const tag = (bay, svg) => `<g data-b="${bay}">${svg}</g>`;

export const rect = (x0, x1, y0, y1, z) => [at(x0, y0, z), at(x1, y0, z), at(x1, y1, z), at(x0, y1, z)];
export const polyPath = (pts) => k.pathOf(pts, true);
