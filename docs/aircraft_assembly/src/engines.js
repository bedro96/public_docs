// Engines (CFM LEAP-1B class, one under each wing on a short pylon) and landing gear, as named parts.
// Engine axis runs along x at y = +-56, z = -17.6; the lathe coordinate s starts at the nozzle plane (x = 209) and grows forward.
import { G, S, L, D, P, at, pathOf, loft, prismXZ, post, slab } from './world.js';

export const ENG = { x0: 209, y: 56, z: -17.6, len: 62, fan: 8.8 };
export const engFrame = (side) => G.frameOf([ENG.x0, side * ENG.y, ENG.z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
const cowlProfile = [
  [0, 8.0, 1], [6, 9.6, 1], [14, 10.4, 1], [22, 10.75, 1], [30, 10.9, 1],
  [40, 10.95, 1], [50, 10.85, 1], [57, 10.6, 1], [60, 10.3, 1], [62, 10.0, 1],
];

export function engineParts(side) {
  const sfx = side > 0 ? '_p' : '_s';
  const F = engFrame(side);
  const B = G.bandsOf(cowlProfile, [30, 57], F, P, { steps: 36, rows: 8 });
  const sideLine = (a, b, ends) => B.sidesOf(a, b, { ends }).d;
  const band = (i, tone, from, to, ends) => S(B.bands[i].paths, { tone, crease: 'faint' }) + L(sideLine(from, to, ends), { tone: 'hi' });
  // fan face: dark recessed disc, a spinner and the blade roots
  const fanDisc = S(G.disc(61.6, 62, ENG.fan, F, P), { tone: 'hi' });
  const lip = S(G.ringBand(61.2, 62.1, ENG.fan, 10.15, F, P), { tone: 'hi' });
  const spinner = S(G.sphereOf(G.pointOf(F, 60.6, 0, 0), 2.5, P), { tone: 'hi' });
  const blades = [];
  const nb = 18;
  for (let i = 0; i < nb; i++) {
    const a = (i / nb) * Math.PI * 2;
    const p0 = G.pointOf(F, 61.9, 2.4, a);
    const p1 = G.pointOf(F, 61.9, ENG.fan - 0.3, a + 0.22);
    // only blades whose root faces the viewer are worth the stroke; the rest are hidden by the lip anyway
    blades.push(pathOf([at(...p0), at(...p1)]));
  }
  const core = S(G.solidOf([[-9, 0.7, 1], [-4, 3.3, 1], [1, 5.2, 1], [8, 5.5, 1]], F, P, { steps: 20 }), { tone: 'hi' });
  const chev = (() => {
    const pts = [];
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push(at(...G.pointOf(F, i % 2 ? -1.1 : 0.4, 8.05 - (i % 2 ? 0.3 : 0), a)));
    }
    return pathOf(pts);
  })();
  const pylonPoly = [[203, -9.2], [262, -8.6], [262, -5.8], [248, -3.4], [233, -3.6], [212, -6.4]];
  const pylon = prismXZ(pylonPoly, side * ENG.y - 1.4, side * ENG.y + 1.4, { tone: 'hi' });
  return {
    ['engine_reverser' + sfx]: band(0, 'hi', 0, 30, 'first'),
    ['engine_fan_cowl' + sfx]: band(1, 'hi', 30, 57, false),
    ['engine_inlet' + sfx]: band(2, 'hi', 57, 62, false) + fanDisc + lip,
    ['engine_fan' + sfx]: `<path class="blade" d="${blades.join('')}"/>` + spinner,
    ['engine_core' + sfx]: core + `<path class="chev" d="${chev}"/>`,
    ['engine_pylon' + sfx]: pylon,
  };
}
export const ENG_ORDER = ['engine_pylon', 'engine_core', 'engine_reverser', 'engine_fan_cowl', 'engine_inlet', 'engine_fan'];
export const ENG_CLASS = { engine_pylon: 'm-comp', engine_core: 'm-steel', engine_reverser: 'm-comp', engine_fan_cowl: 'm-eng', engine_inlet: 'm-eng', engine_fan: 'm-dark' };

// ---------- landing gear ----------
export const MLG = { x: 194, y: 28.6, zAxle: -26.15, R: 5.85, w: 4.7, off: 3.0, top: -11.3 };
export const NLG = { x: 348, y: 2.2, zAxle: -28.6, R: 3.4, w: 2.2, top: -18.6 };
// a wheel with its axis along y: tyre in dark, hub in light
function wheel(cx, y0, cz, R, w) {
  const F = G.frameOf([cx, y0, cz], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  const tyre = [[0, R * 0.62, 1], [0.35, R * 0.95, 1], [1.0, R, 1], [w - 1.0, R, 1], [w - 0.35, R * 0.95, 1], [w, R * 0.62, 1]];
  const t = S(G.solidOf(tyre, F, P, { steps: 28 }), { tone: 'hi' });
  const hub = `<g class="m-al">${S(G.disc(w - 0.05, w + 0.12, R * 0.58, F, P), { tone: 'hi' })}</g>`;
  const cap = `<g class="m-steel">${S(G.disc(w + 0.1, w + 0.35, R * 0.22, F, P), { tone: 'hi' })}</g>`;
  return `<g class="m-dark">${t}</g>${hub}${cap}`;
}
const rod = (a, b) => `<path class="link" d="${pathOf([at(...a), at(...b)])}"/>`;

// ordered [id, svg, class] triples, in painter order for a viewer on the +y side
export function mainGearParts(side) {
  const sfx = side > 0 ? '_p' : '_s';
  const yc = side * MLG.y;
  const zA = MLG.zAxle;
  const lowY = yc - MLG.off - MLG.w / 2;
  const highY = yc + MLG.off - MLG.w / 2;
  const [lowId, highId] = side > 0 ? ['mlg_wheel_in', 'mlg_wheel_out'] : ['mlg_wheel_out', 'mlg_wheel_in'];
  const strut = post(MLG.x, yc, 1.35, zA + 0.5, MLG.top - zA - 0.5, { steps: 14 }) + slab(MLG.x - 1.1, yc - 6.2, 2.2, 12.4, zA - 0.9, 1.8, { r: 0 });
  const brace = rod([MLG.x + 1, yc - side * 0.4, -17.5], [MLG.x + 8, yc - side * 14, MLG.top + 0.5]) + rod([MLG.x - 1, yc, -17.5], [MLG.x - 8, yc - side * 14, MLG.top + 0.8]) + rod([MLG.x + 0.4, yc, -21], [MLG.x + 2.6, yc, -24.6]);
  return [
    [lowId + sfx, wheel(MLG.x, lowY, zA, MLG.R, MLG.w), ''],
    ['mlg_strut' + sfx, strut, 'm-steel'],
    ['mlg_brace' + sfx, brace, ''],
    [highId + sfx, wheel(MLG.x, highY, zA, MLG.R, MLG.w), ''],
  ];
}
export function mainGearDoor(side) {
  return slab(MLG.x - 17, side * 19.4 - 3.1, 36, 6.2, -14.6, 0.5, { r: 0 });
}
export function noseGearParts() {
  const strut = post(NLG.x, 0, 0.95, NLG.zAxle + 0.4, NLG.top - NLG.zAxle - 0.4, { steps: 12 }) + slab(NLG.x - 0.7, -NLG.y - 1.2, 1.4, NLG.y * 2 + 2.4, NLG.zAxle - 0.7, 1.4, { r: 0 });
  const link = rod([NLG.x - 0.3, 0, -22.4], [NLG.x - 2.6, 0, -25.6]) + rod([NLG.x + 0.5, 0.0, -20], [NLG.x + 4.4, 0.0, -24.4]);
  return [
    ['nlg_wheel_l', wheel(NLG.x, -NLG.y - NLG.w / 2, NLG.zAxle, NLG.R, NLG.w), ''],
    ['nlg_strut', strut + link, 'm-steel'],
    ['nlg_wheel_r', wheel(NLG.x, NLG.y - NLG.w / 2, NLG.zAxle, NLG.R, NLG.w), ''],
  ];
}
export const noseGearDoor = () => slab(NLG.x - 5, -7.2, 10, 5.2, -18.8, 0.4, { r: 0 }) + slab(NLG.x - 5, 2.0, 10, 5.2, -18.8, 0.4, { r: 0 });
export const GEAR_SAMPLES = {
  main: (side) => {
    const yc = side * MLG.y;
    return [[MLG.x, yc, MLG.top], [MLG.x, yc, MLG.zAxle], [MLG.x - MLG.R, yc, MLG.zAxle], [MLG.x + MLG.R, yc, MLG.zAxle], [MLG.x, yc, MLG.zAxle - MLG.R], [MLG.x, yc - 6, MLG.zAxle], [MLG.x, yc + 6, MLG.zAxle], [MLG.x, yc - 6, MLG.zAxle - MLG.R], [MLG.x, yc + 6, MLG.zAxle - MLG.R], [MLG.x + 5, yc, -19], [MLG.x - 5, yc, -19]];
  },
  nose: () => [[NLG.x, 0, NLG.top], [NLG.x, 0, NLG.zAxle], [NLG.x - NLG.R, 0, NLG.zAxle], [NLG.x + NLG.R, 0, NLG.zAxle], [NLG.x, 0, NLG.zAxle - NLG.R], [NLG.x, -3.4, NLG.zAxle], [NLG.x, 3.4, NLG.zAxle], [NLG.x, 3.4, NLG.zAxle - NLG.R], [NLG.x, -3.4, NLG.zAxle - NLG.R]],
};
