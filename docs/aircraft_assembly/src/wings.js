// Wings, tail, engines and landing gear of the hero 737 MAX 8-class airliner, as named parts.
// Plane-local axes as in plane.js: x tail (0) -> nose (395), +y port (toward the viewer), z up, fuselage axis at z = 0.
// Dimensions are rounded from public drawings (span 35.9 m, length 39.5 m); anything finer is an estimate and is drawn, not claimed.
import { k, G, S, L, D, P, at, pathOf, polyPath, loft, loftOf, prismXZ } from './world.js';

const rad = (d) => (d * Math.PI) / 180;
const f2 = (v) => Math.round(v * 100) / 100;

// ---------- wing planform (port side, y > 0) ----------
export const W = { y0: 17.9, y1: 179, tan: Math.tan(rad(6)), zRoot: -10.5, tRoot: 8.5, tTip: 2.4 };
export const wingLE = (y) => 252 - (83 * (y - 17)) / 162;
export const wingTE = (y) => 183 - (28 * (y - 17)) / 162;
export const chord = (y) => wingLE(y) - wingTE(y);
export const zMean = (y) => W.zRoot + (y - 17) * W.tan;
export const thick = (y) => W.tRoot - ((W.tRoot - W.tTip) * (y - 17)) / 162;
const foil = (c) => (Math.sqrt(Math.max(0, c)) * Math.max(0, 1 - c)) / 0.385;
const sampleC = (c0, c1, n) => Array.from({ length: n }, (_, i) => c0 + ((c1 - c0) * i) / (n - 1));

// one ring (a closed section) of the wing between chord fractions c0..c1 at half-span y; `side` mirrors it to the starboard wing
function wingRing(y, c0, c1, side, o = {}) {
  const { top = 1, bot = -1, dx = 0, dz = 0, n = Math.max(2, Math.ceil((c1 - c0) / 0.11) + 1) } = o;
  const cs = sampleC(c0, c1, n);
  const T = thick(y) / 2;
  const zu = (c) => {
    const lo = zMean(y) + T * foil(c) * bot + dz;
    return Math.max(zMean(y) + T * foil(c) * top + dz, lo + 0.12);
  };
  const zl = (c) => zMean(y) + T * foil(c) * bot + dz;
  const X = (c) => wingLE(y) - c * chord(y) + dx;
  return [...cs.map((c) => [X(c), side * y, zu(c)]), ...[...cs].reverse().map((c) => [X(c), side * y, zl(c)])];
}
const wingPiece = (side, y0, y1, c0, c1, o = {}, style = {}) => loft([wingRing(y0, c0, c1, side, o), wingRing(y1, c0, c1, side, o)], style);
// point on the upper surface of the wing
const wingTop = (side, y, c, top = 1) => {
  const T = thick(y) / 2;
  return [wingLE(y) - c * chord(y), side * y, zMean(y) + T * foil(c) * top];
};
const line = (pts) => pathOf(pts.map((p) => at(...p)));
// a smooth blob along x: used for fairings, lights and the like
export function blob(x0, x1, y, z, rh, rv, { n = 10, pow = 0.6 } = {}) {
  const rings = [];
  const cuts = 5;
  for (let i = 0; i <= cuts; i++) {
    const t = i / cuts;
    const kf = Math.pow(Math.max(0.0001, Math.sin(Math.PI * Math.min(0.98, Math.max(0.02, t)))), pow);
    const ring = [];
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2;
      ring.push([x0 + (x1 - x0) * t, y + rh * kf * Math.cos(a), z + rv * kf * Math.sin(a)]);
    }
    rings.push(ring);
  }
  return rings;
}

// ---------- the two wings ----------
// returns { id: svg } for the parts of one wing; `side` = +1 port, -1 starboard
export function wingParts(side) {
  const sfx = side > 0 ? '_p' : '_s';
  const part = {};
  const lower = wingPiece(side, W.y0, W.y1, 0.15, 0.68, { top: -0.9, bot: -1 }, { tone: 'mid' });
  const fSpar = wingPiece(side, W.y0, 172, 0.15, 0.162, { top: 0.97, bot: -0.97 }, { tone: 'mid' });
  const rSpar = wingPiece(side, W.y0, 168, 0.665, 0.68, { top: 0.97, bot: -0.97 }, { tone: 'mid' });
  const ribY = [20, 28, 36, 45, 54, 63, 72, 82, 93, 104, 116, 128, 140, 152, 163, 172];
  const ribs = ribY.map((y) => line(sampleC(0.152, 0.672, 6).map((c) => wingTop(side, y, c, 0.96)))).join('');
  const strg = [0.22, 0.3, 0.4, 0.5, 0.58, 0.64].map((c) => line([20, 60, 100, 140, 170].map((y) => wingTop(side, y, c, 0.97)))).join('');
  const tank = wingPiece(side, 21, 150, 0.17, 0.65, { top: 0.88, bot: -0.88 }, { tone: 'mid' });
  const upper = wingPiece(side, W.y0, W.y1, 0.15, 0.68, { top: 1, bot: 0.93 }, { tone: 'hi', crease: 'none' });
  const slatSeg = [[20, 50], [62, 95], [97, 131], [133, 177]];
  const slats = slatSeg.map(([a, b]) => wingPiece(side, a, b, 0, 0.152, { top: 1.03, bot: -1.02, dx: -0.5 }, { tone: 'hi' })).join('');
  const krueger = wingPiece(side, W.y0, 20, 0, 0.152, { top: 1.0, bot: -1.0, dx: -0.2, dz: -0.35 }, { tone: 'mid' });
  const flapIn = wingPiece(side, 21, 76, 0.68, 1, { top: 1.0, bot: -1.0, dx: -0.7, dz: -0.3 }, { tone: 'hi' });
  const flapOut = wingPiece(side, 80, 135, 0.68, 1, { top: 1.0, bot: -1.0, dx: -0.6, dz: -0.25 }, { tone: 'hi' });
  const aileron = wingPiece(side, 140, 177, 0.7, 1, { top: 1.0, bot: -1.0, dx: -0.3 }, { tone: 'hi' });
  const spoilSeg = [[24, 52], [55, 76], [80, 105], [108, 130]];
  const spoilers = spoilSeg.map(([a, b]) => wingPiece(side, a, b, 0.56, 0.69, { top: 1.06, bot: 0.95, dz: 0.05 }, { tone: 'hi' })).join('');
  const fairings = [46, 80, 112].map((y) => loft(blob(wingTE(y) - 2, wingTE(y) - 11, side * y, zMean(y) - 1.4, 1.4, 1.3, { n: 8 }), { tone: 'hi' })).join('');
  const tipC = wingTop(side, W.y1, 0.5, 0);
  const light = D([at(tipC[0], tipC[1] + side * 0.2, tipC[2])], { size: 1.3, tone: 'hi' });

  // split-tip winglet: an up blade and a short down blade
  const bladeRing = (xle, xte, y, z, t) => [[xle, y, z + t], [xte, y, z + t * 0.6], [xte, y, z - t * 0.6], [xle, y, z - t]];
  const yT = side * W.y1;
  const zT = zMean(W.y1);
  const up = loft([
    bladeRing(wingLE(W.y1), wingTE(W.y1), yT, zT, 1.1),
    bladeRing(wingLE(W.y1) - 3, wingTE(W.y1) - 3.5, yT + side * 1.0, zT + 5, 0.9),
    bladeRing(wingLE(W.y1) - 11, wingTE(W.y1) - 7.5, yT + side * 3.2, zT + 19, 0.55),
    bladeRing(wingLE(W.y1) - 17, wingTE(W.y1) - 8.5, yT + side * 4.6, zT + 25.2, 0.4),
  ].map((r) => r.map((p) => [p[0], p[1], p[2]])), { tone: 'hi' }, { caps: true });
  const down = loft([
    bladeRing(wingLE(W.y1) - 3, wingTE(W.y1) - 3, yT, zT, 0.9),
    bladeRing(wingLE(W.y1) - 7, wingTE(W.y1) - 2.5, yT + side * 1.0, zT - 8.5, 0.55),
  ], { tone: 'mid' });

  part['wing_lower_skin' + sfx] = lower;
  part['wing_spar_front' + sfx] = fSpar;
  part['wing_spar_rear' + sfx] = rSpar;
  part['wing_ribs' + sfx] = `<path class="rib" d="${ribs}"/>`;
  part['wing_stringers' + sfx] = `<path class="strg" d="${strg}"/>`;
  part['wing_fuel_tank' + sfx] = tank;
  part['wing_upper_skin' + sfx] = upper;
  part['slats' + sfx] = slats + krueger;
  part['flap_in' + sfx] = flapIn;
  part['flap_out' + sfx] = flapOut;
  part['aileron' + sfx] = aileron;
  part['spoilers' + sfx] = spoilers;
  part['flap_fairings' + sfx] = fairings;
  part['winglet' + sfx] = up + down;
  part['wing_tip_light' + sfx] = light;
  return part;
}
export const WING_ORDER = ['wing_lower_skin', 'wing_spar_front', 'wing_spar_rear', 'wing_fuel_tank', 'wing_ribs', 'wing_stringers', 'wing_upper_skin', 'slats', 'spoilers', 'flap_in', 'flap_out', 'aileron', 'flap_fairings', 'winglet', 'wing_tip_light'];
