// Fuselage surface maths shared by the plane parts: crown height, side position, nose taper, upswept tail cone.
// Units are 0.1 m; x runs from the tail (0) to the nose (395); the fuselage axis is z = 0 and the barrel radius R = 1.88 m.
import { G, PL, R } from './world.js';

export const rad = (d) => (d * Math.PI) / 180;
export const NOSE0 = 349; // the nose starts to taper here
export const TJ = 62; // the upswept tail cone starts here
const TILT = rad(5.5);
export const CT = Math.cos(TILT);
export const ST = Math.sin(TILT);
export const FX = G.frameOf([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
export const FT = G.frameOf([TJ, 0, 0], [-CT, 0, ST], [0, 1, 0], [ST, 0, CT]); // s runs from the joint toward the tail tip
export const TAIL_LEN = TJ / CT;
const TAIL_R = 3.0;
export const tailR = (s) => TAIL_R + (R - TAIL_R) * (1 - Math.pow(Math.min(1, Math.max(0, s / TAIL_LEN)), 1.7));
export const tailSlope = (s) => (tailR(s + 0.05) - tailR(s - 0.05)) / 0.1;

export function rAt(x) {
  if (x < NOSE0) return R;
  const t = Math.min(1, (x - NOSE0) / (PL - NOSE0));
  return R * Math.pow(Math.max(0, 1 - Math.pow(t, 2.2)), 1 / 2.2);
}
export const tailPt = (s, th) => G.pointOf(FT, s, tailR(s), rad(th));
// a point on the skin at axial position x and angle th (0 = port side at axis height, 90 = crown)
export function bodyPt(x, th, inset = 0) {
  const a = rad(th);
  if (x >= TJ) {
    const r = rAt(x) - inset;
    return [x, r * Math.cos(a), r * Math.sin(a)];
  }
  const s = (TJ - x) / CT;
  return G.pointOf(FT, s, tailR(s) - inset, a);
}
// axis height and radius of the (tilted) cross-section at x
export function section(x) {
  if (x >= TJ) return { zc: 0, r: rAt(x) };
  const s = Math.max(0, (TJ - x) / CT);
  return { zc: s * ST, r: tailR(s) * 1 };
}
// crown height at x
export const topZ = (x) => {
  const { zc, r } = section(x);
  return zc + r;
};
// half-width of the skin at height z (positive y) for a feature that must start on the surface
export function bodyY(x, z) {
  const { zc, r } = section(x);
  return Math.sqrt(Math.max(0, r * r - (z - zc) * (z - zc)));
}
