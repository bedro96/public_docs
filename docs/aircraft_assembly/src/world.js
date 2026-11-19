// Shared world: coordinates, camera and drawing helpers. Pure: runs in Node (build) and in the browser (live).
// World units: 1 unit = 0.1 m. x runs along the flow (Wichita -> Renton line -> runway), y across it (+y toward the viewer), z up.
// The plane always faces +x, so its port (left) side is +y and faces the viewer. A left turn therefore swings toward the viewer.
import * as k from '../kit/iso-kit.mjs';
import * as G from '../kit/lathe.mjs';

export { k, G };

export const AZIMUTH = 60;
export const ELEVATION = 30;
export const P = { origin: [0, 0], scale: 1, azimuth: AZIMUTH, elevation: ELEVATION };
export const K = k.cameraOf(P).k;

export const at = (x, y, z) => k.iso([x, y, z], P);
export const S = (paths, style) => k.solidSvg(paths, style);
export const L = (d, style) => k.lineSvg(d, style);
export const D = (points, style) => k.dotsSvg(points, style);
export const depth = (x, y, z) => k.depthOf([x, y, z], P);
export const polyPath = (pts) => k.pathOf(pts, true);
export const pathOf = (pts, closed = false) => k.pathOf(pts, closed);
export const tenth = (v) => Math.round(v * 10) / 10;

// screen offset of a world displacement
export const delta = (dx, dy, dz) => k.axisVector(P, [dx, dy, dz]);
export const tr = (dx, dy, dz) => (dx || dy || dz ? k.translateAlong(P, [dx, dy, dz]) : '');

// ---------- the plane ----------
export const PL = 395; // fuselage length, 39.5 m
export const R = 18.8; // fuselage radius, 3.76 m width
export const GZ = 32; // axis height above the ground when standing on its gear (plane-local z of the ground is -GZ)
// Plane-local coordinates: x runs from the tail (0) to the nose (395) so the plane faces +x like everything else.
// Stations are measured from the nose, the way Boeing does, and converted with X().
export const X = (s) => PL - s;

// ---------- depth-ordered layers (environment) ----------
// Items are axis-aligned boxes. A is drawn before B when a separating plane puts A behind B for a viewer at +x,+y,+z.
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
  const behind = Array.from({ length: n }, () => new Set());
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
    if (pick < 0) {
      for (let i = 0; i < n; i++) if (!done[i] && (pick < 0 || items[i].key < items[pick].key)) pick = i;
    }
    done[pick] = true;
    out.push(items[pick]);
  }
  return out;
}

// ---------- small solid recipes ----------
export function box(plan, z, h, { tone = 'mid', steps = 2, bevel = 0, crease = 'faint', className } = {}) {
  return S(k.slabOf({ r: 0, ...plan }, z, h, P, steps, bevel), { tone, crease, className });
}
export const slab = (x, y, w, d, z, h, opts = {}) => box({ x, y, w, d, r: opts.r ?? 0 }, z, h, opts);
export const post = (cx, cy, r, z, h, opts = {}) => S(k.cylinder(cx, cy, r, z, h, P, opts.steps ?? 14, 0), { tone: opts.tone ?? 'mid', crease: opts.crease ?? 'faint', className: opts.className });

// A prism over a convex polygon given in (u, v) of a frame, extruded along the frame's axis from s0 to s1.
export const frame = (o, a, u, v) => G.frameOf(o, a, u, v);
export function prism(F, poly, s0, s1, style = {}) {
  return S(G.prismOf(F, poly, s0, s1, P), { tone: 'hi', crease: 'faint', ...style });
}
// prism over an (x, z) polygon, extruded along y between y0 and y1
const FXZ = G.frameOf([0, 0, 0], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
export const prismXZ = (poly, y0, y1, style) => prism(FXZ, poly, y0, y1, style);
// prism over an (x, y) polygon, extruded up from z0 to z1
const FXY = G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
export const prismXY = (poly, z0, z1, style) => prism(FXY, poly, z0, z1, style);
// prism over a (y, z) polygon, extruded along x between x0 and x1
const FYZ = G.frameOf([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
export const prismYZ = (poly, x0, x1, style) => prism(FYZ, poly, x0, x1, style);

// ---------- lofted solids (wings, fins, stabilisers, pylons) ----------
// A convex solid between closed rings of 3D points (same point count in every ring). Faces facing the viewer are filled in the kit's four
// tones, so the result drops into S() like any kit solid. Convex means no face hides another, so no depth sort is needed inside the part.
export function loftOf(rings, { caps = true } = {}) {
  const V = G.viewOf(P);
  const Lt = G.lightOf(P);
  const flat = rings.map((ring) => ring.map((p) => at(p[0], p[1], p[2])));
  const all = rings.flat();
  const c = [0, 1, 2].map((i) => all.reduce((s, p) => s + p[i], 0) / all.length);
  const buckets = [[], [], [], [], []];
  const crease = [];
  const face = (pts3, pts2) => {
    // normal from the first three points; orient away from the solid's centre
    const a = G.sub3(pts3[1], pts3[0]);
    const b = G.sub3(pts3[2], pts3[0]);
    let n = G.cross3(a, b);
    const m = pts3.reduce((s, p) => G.add3(s, p), [0, 0, 0]).map((v) => v / pts3.length);
    if (G.dot3(n, G.sub3(m, c)) < 0) n = G.mul3(n, -1);
    n = G.unit3(n);
    if (G.dot3(n, V) <= 1e-6) return;
    buckets[G.bandOf(G.dot3(n, Lt))].push(pathOf(pts2, true));
  };
  const n = rings[0].length;
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n;
      face([rings[i][j], rings[i][j2], rings[i + 1][j2], rings[i + 1][j]], [flat[i][j], flat[i][j2], flat[i + 1][j2], flat[i + 1][j]]);
    }
  }
  if (caps) {
    face(rings[0], flat[0]);
    face(rings[rings.length - 1], flat[rings.length - 1]);
  }
  const hull = G.hullOf(flat.flat());
  return { fill: pathOf(hull, true), outline: pathOf(hull, true), crease: crease.join(''), top: buckets[4].join(''), shades: buckets.slice(0, 4).map((d) => d.join('')) };
}
export const loft = (rings, style = {}, opts) => S(loftOf(rings, opts), { tone: 'hi', crease: 'none', ...style });
export const hull2 = (pts) => G.hullOf(pts);

// ---------- affine approximation of a 3D rotation, applied to an already drawn group ----------
// Rotating a drawn SVG group needs the depth the 2D drawing no longer has. Instead of re-rendering, the group gets ONE matrix: the
// least-squares 2x2 map taking the rest-pose screen positions of a set of sample points to their positions after the 3D rotation.
// For the small pitch / bank angles of a take-off (<= ~25 deg) the error is about a metre on a 40 m aeroplane.
export function rotate3(p, c, yaw, pitch, roll) {
  // roll about x, then pitch about y (nose up is positive), then yaw about z; all about the pivot c
  let [x, y, z] = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
  let cs = Math.cos(roll);
  let sn = Math.sin(roll);
  [y, z] = [y * cs - z * sn, y * sn + z * cs];
  cs = Math.cos(pitch);
  sn = Math.sin(pitch);
  [x, z] = [x * cs - z * sn, x * sn + z * cs];
  cs = Math.cos(yaw);
  sn = Math.sin(yaw);
  [x, y] = [x * cs - y * sn, x * sn + y * cs];
  return [x + c[0], y + c[1], z + c[2]];
}
// Returns [a, b, c, d] of the linear map (screen' = A * screen) about the pivot's own screen position, for sample points `pts`.
export function fitLinear(pts, c, yaw, pitch, roll) {
  const [cx, cy] = at(c[0], c[1], c[2]);
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  let bx1 = 0;
  let bx2 = 0;
  let by1 = 0;
  let by2 = 0;
  for (const p of pts) {
    const [px, py] = at(p[0], p[1], p[2]);
    const [qx, qy] = at(...rotate3(p, c, yaw, pitch, roll));
    const x = px - cx;
    const y = py - cy;
    sxx += x * x; sxy += x * y; syy += y * y;
    bx1 += (qx - cx) * x; bx2 += (qx - cx) * y;
    by1 += (qy - cy) * x; by2 += (qy - cy) * y;
  }
  const det = sxx * syy - sxy * sxy || 1;
  // [a c; b d] with screen' = [a c; b d] [x y]
  const a = (bx1 * syy - bx2 * sxy) / det;
  const cc = (bx2 * sxx - bx1 * sxy) / det;
  const b = (by1 * syy - by2 * sxy) / det;
  const d = (by2 * sxx - by1 * sxy) / det;
  return { m: [a, b, cc, d], pivot: [cx, cy] };
}
// the SVG matrix for a fit, followed by a world translation of the pivot (screen delta dx, dy)
export function matrixOf(fit, dx = 0, dy = 0) {
  const [a, b, c, d] = fit.m;
  const [px, py] = fit.pivot;
  const e = px + dx - (a * px + c * py);
  const f = py + dy - (b * px + d * py);
  const r = (v) => Math.round(v * 1000) / 1000;
  return `matrix(${r(a)} ${r(b)} ${r(c)} ${r(d)} ${r(e)} ${r(f)})`;
}
