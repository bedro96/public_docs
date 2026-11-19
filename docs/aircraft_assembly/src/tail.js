// Empennage: vertical fin with rudder and dorsal fairing, horizontal stabilizers with elevators, APU exhaust.
import { G, S, P, at, loft, prismXZ } from './world.js';
import { rad, FT, TAIL_LEN, topZ, bodyY } from './hull.js';

const foil = (c) => (Math.sqrt(Math.max(0, c)) * Math.max(0, 1 - c)) / 0.385;
const CS = [0, 0.08, 0.25, 0.5, 0.75, 1];
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- vertical fin ----------
export const FIN = { zTop: 90.9, leRoot: 77, leTip: 23, teRoot: 12, teTip: 5, t: 1.25 };
const finLE = (z) => lerp(FIN.leRoot, FIN.leTip, (z - 14) / (FIN.zTop - 14));
const finTE = (z) => lerp(FIN.teRoot, FIN.teTip, (z - 14) / (FIN.zTop - 14));
// a horizontal section of the fin at height z between chord fractions c0..c1 (the root ring is bent to follow the crown)
function finRing(z, c0, c1, { root = false, t = FIN.t } = {}) {
  const cs = CS.map((c) => c0 + (c1 - c0) * c);
  const xs = (c) => finLE(z) - c * (finLE(z) - finTE(z));
  const th = (c) => Math.max(t * foil(c) * (1 - 0.5 * ((z - 14) / (FIN.zTop - 14))), 0.14);
  const zAt = (x) => (root ? topZ(x) - 1.6 : z);
  return [
    ...cs.map((c) => [xs(c), th(c), zAt(xs(c))]),
    ...[...cs].reverse().map((c) => [xs(c), -th(c), zAt(xs(c))]),
  ];
}
const finPiece = (c0, c1, o = {}) => {
  const zs = [14, 34, 54, 72, FIN.zTop];
  return loft(zs.map((z, i) => finRing(z, c0, c1, { root: i === 0, ...o })), { tone: 'hi' });
};
export function finParts() {
  return {
    fin: finPiece(0, 0.7),
    rudder: finPiece(0.7, 1.0, { t: 1.0 }),
    dorsal_fin: prismXZ([[106, 18.2], [62, 18.2], [60, 26], [70, 34], [80, 32]], -0.9, 0.9, { tone: 'hi' }),
    fin_cap: loft([[[finLE(FIN.zTop) + 0.4, 0, FIN.zTop], [finLE(FIN.zTop) - 4, 1.3, FIN.zTop + 0.6], [finTE(FIN.zTop), 0.4, FIN.zTop + 0.5], [finLE(FIN.zTop) - 4, -1.3, FIN.zTop + 0.6]], [[finLE(FIN.zTop) - 2, 0, FIN.zTop + 2.4], [finLE(FIN.zTop) - 4, 0.4, FIN.zTop + 2.2], [finTE(FIN.zTop) + 2, 0.2, FIN.zTop + 2.2], [finLE(FIN.zTop) - 4, -0.4, FIN.zTop + 2.2]]], { tone: 'mid' }),
  };
}

// ---------- horizontal stabilizer ----------
export const HS = { yTip: 71.7, leRoot: 60, leTip: 19, teRoot: 12, teTip: 5, z0: 4.5, tan: Math.tan(rad(7)), t: 1.7 };
const hsLE = (y) => lerp(HS.leRoot, HS.leTip, (y - 8) / (HS.yTip - 8));
const hsTE = (y) => lerp(HS.teRoot, HS.teTip, (y - 8) / (HS.yTip - 8));
const hsZ = (y) => HS.z0 + (y - 8) * HS.tan;
function hsRing(y, c0, c1, side, { root = false, dz = 0, t = HS.t } = {}) {
  const cs = CS.map((c) => c0 + (c1 - c0) * c);
  const xs = (c) => hsLE(y) - c * (hsLE(y) - hsTE(y));
  const th = (c) => Math.max(t * (1 - 0.6 * ((y - 8) / (HS.yTip - 8))) * foil(c) * 0.5, 0.12);
  const yAt = (x, z) => (root ? side * Math.max(bodyY(x, z) - 0.5, 1) : side * y);
  return [
    ...cs.map((c) => [xs(c), yAt(xs(c), hsZ(y) + th(c)), hsZ(y) + th(c) + dz]),
    ...[...cs].reverse().map((c) => [xs(c), yAt(xs(c), hsZ(y) - th(c)), hsZ(y) - th(c) + dz]),
  ];
}
export function stabParts(side) {
  const sfx = side > 0 ? '_p' : '_s';
  const ys = [8, 28, 50, HS.yTip];
  const mk = (c0, c1, o = {}) => loft(ys.map((y, i) => hsRing(y, c0, c1, side, { root: i === 0, ...o })), { tone: 'hi' });
  return {
    ['h_stab' + sfx]: mk(0, 0.7),
    ['elevator' + sfx]: mk(0.7, 1, { t: 1.4 }),
  };
}

// ---------- APU exhaust at the very tip of the tail cone ----------
export function apuExhaust() {
  const prof = [[TAIL_LEN - 0.4, 1.5], [TAIL_LEN + 0.6, 1.5], [TAIL_LEN + 1.6, 1.25]];
  return S(G.solidOf(prof, FT, P, { steps: 20 }), { tone: 'hi' });
}
export const tailTip = () => at(...G.pointOf(FT, TAIL_LEN, 0, 0));
