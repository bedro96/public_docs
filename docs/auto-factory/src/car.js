// The hero car, built once around the origin (x -40..40 along the flow, y -17..17, z 0 at the tyre contact patch, underside at z 4).
// Every part is its own <g data-p> so the live code can fly it in (body shop), recolour it (paint shop) or turn its wheels.
import { k, G, S, L, D, P, at, prismXZ, polyPath } from './world.js';

export const CAR = { len: 80, wid: 32, under: 4, wheelR: 8.2, wheelX: 26, wheelW: 7.4, wheelIn: 9.4 };

// convex side profiles (x, z), extruded along y
const LOWER = [[-38, 4], [38, 4], [40, 7], [40, 11], [36, 15], [14, 17.5], [-22, 17.5], [-37, 16], [-40, 12], [-40, 7]];
const CABIN = [[-24, 17.5], [-16, 28], [2, 28.5], [14, 17.5]];
const HOOD = [[14.2, 17.7], [36, 15.3], [36, 16.3], [14.2, 18.7]];
const TRUNK = [[-22.2, 17.7], [-37, 16.2], [-37, 17.2], [-22.2, 18.7]];
const DOOR_F = [[-2, 7], [13, 7], [13, 17.5], [-2, 17.5]];
const DOOR_R = [[-22, 7], [-3.2, 7], [-3.2, 17.5], [-22, 17.5]];
const WIN_F = [[-2.4, 18.9], [11.4, 18.9], [1.6, 27.1], [-2.4, 26.9]];
const WIN_R = [[-21.2, 18.9], [-3.8, 18.9], [-3.8, 26.9], [-15.6, 26.5]];

const solid = (paths, style = {}) => S(paths, { tone: 'hi', crease: 'faint', ...style });
const wrap = (name, inner, extra = '') => `<g data-p="${name}"${extra}>${inner}</g>`;
const poly3 = (pts) => polyPath(pts.map(([x, y, z]) => at(x, y, z)));
const slab = (plan, z, h, style = {}) => S(k.slabOf({ r: 0.4, ...plan }, z, h, P, 2, 0.25), { tone: 'hi', crease: 'faint', ...style });

const sidePoly = (poly, y) => poly.map(([x, z]) => [x, y, z]);

// wheel solids. side +1 = near (+y), -1 = far (-y)
function wheelSvg(cx, side) {
  const y0 = side > 0 ? CAR.wheelIn : -CAR.wheelIn - CAR.wheelW;
  const faceY = side > 0 ? y0 + CAR.wheelW : y0;
  const F = G.frameOf([cx, y0, CAR.wheelR], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  const tire = [[0, 6], [0, CAR.wheelR], [CAR.wheelW, CAR.wheelR], [CAR.wheelW, 6]];
  const Fd = G.frameOf([cx, faceY, CAR.wheelR], [0, side, 0], [1, 0, 0], [0, 0, 1]);
  return [
    S(G.solidOf(tire, F, P, { steps: 28 }), { tone: 'lo', crease: 'faint', className: 'tire' }),
    S(G.disc(0, 0.4, 5.6, Fd, P, { steps: 28 }), { tone: 'mid', crease: 'faint' }),
    S(G.disc(0.4, 1, 1.8, Fd, P, { steps: 16 }), { tone: 'hi', crease: 'faint' }),
  ].join('');
}

// Five spokes on the rim face, turned by `angle` (radians). Both ends land on the hub cap and the rim edge.
export function wheelSpokes(cx, side, angle) {
  const faceY = side > 0 ? CAR.wheelIn + CAR.wheelW + 1 : -CAR.wheelIn - CAR.wheelW - 1;
  let d = '';
  for (let i = 0; i < 5; i++) {
    const a = angle + (i * Math.PI * 2) / 5;
    const c = Math.cos(a);
    const s = Math.sin(a);
    d += k.segment([cx + c * 1.8, faceY, CAR.wheelR + s * 1.8], [cx + c * 5.5, faceY, CAR.wheelR + s * 5.5], P);
  }
  return d;
}

export function carParts() {
  const parts = {};
  // skid the shell rides on in the body and paint shops
  parts.skid = wrap('skid', [slab({ x: -46, y: -15, w: 92, d: 30, r: 2 }, 0.2, 3.4, { tone: 'lo' })].join('') + D([at(-42, -11, 3.6), at(42, -11, 3.6), at(-42, 11, 3.6), at(42, 11, 3.6)], { size: 0.5, tone: 'mid' }));

  const spokes = (name, cx, side) => `<path class="iso-line spokes" data-tone="mid" data-s="${name}" data-cx="${cx}" data-side="${side}" d="${wheelSpokes(cx, side, 0)}"/>`;
  parts.wheelFarF = wrap('wheelFarF', wheelSvg(CAR.wheelX, -1) + spokes('FarF', CAR.wheelX, -1));
  parts.wheelFarR = wrap('wheelFarR', wheelSvg(-CAR.wheelX, -1) + spokes('FarR', -CAR.wheelX, -1));
  parts.wheelNearF = wrap('wheelNearF', wheelSvg(CAR.wheelX, 1) + spokes('NearF', CAR.wheelX, 1));
  parts.wheelNearR = wrap('wheelNearR', wheelSvg(-CAR.wheelX, 1) + spokes('NearR', -CAR.wheelX, 1));

  // underbody: floor pan under the cabin and boot, two longitudinal rails reaching the nose, cross members. The engine bay is open.
  parts.floor = wrap('floor', [
    slab({ x: -38, y: -14, w: 52, d: 28, r: 1.2 }, 4, 2.4, { tone: 'mid' }),
    slab({ x: -34, y: -9.5, w: 70, d: 3 }, 6.4, 1.6, { tone: 'mid' }),
    slab({ x: -34, y: 6.5, w: 70, d: 3 }, 6.4, 1.6, { tone: 'mid' }),
    ...[-26, -8, 8, 36].map((x) => slab({ x: x - 1.5, y: -13, w: 3, d: 26 }, 6.4, 1.4, { tone: 'mid' })),
  ].join(''), ' class="paint"');

  const arches = [CAR.wheelX, -CAR.wheelX]
    .map((cx) => `<path class="arch" d="${G.disc(0, 0.05, 9.6, G.frameOf([cx, 16.05, CAR.wheelR], [0, 1, 0], [1, 0, 0], [0, 0, 1]), P, { steps: 24 }).fill}"/>`)
    .join('');
  parts.wallFar = wrap('wallFar', solid(prismXZ(LOWER, -16, -14)), ' class="paint"');
  parts.cowl = wrap('cowl', [slab({ x: 13, y: -14, w: 2.6, d: 28 }, 6, 11.5), slab({ x: -25, y: -14, w: 2.6, d: 28 }, 6, 11.5)].join(''), ' class="paint"');
  parts.wallNear = wrap('wallNear', solid(prismXZ(LOWER, 14, 16)) + arches + L(k.segment([-39, 16, 12.2], [38.5, 16, 12.2], P), { tone: 'faint' }), ' class="paint"');

  // greenhouse: roof and pillars; glass is drawn on the +y side and on the windscreen slope
  const wind = [[13.1, -11.6, 18.5], [13.1, 11.6, 18.5], [3.4, 11.6, 27.6], [3.4, -11.6, 27.6]];
  parts.cabin = wrap('cabin', solid(prismXZ(CABIN, -13, 13)), ' class="paint"');
  parts.glass = wrap('glass', `<path class="win" d="${poly3(sidePoly(WIN_F, 13.1))}"/><path class="win" d="${poly3(sidePoly(WIN_R, 13.1))}"/><path class="win" d="${poly3(wind)}"/>`);
  parts.seams = wrap('seams', L(k.segment([-16.2, 13.1, 28], [2, 13.1, 28.5], P), { tone: 'lit', free: true }) + L(k.segment([-16.2, -13, 28], [2, -13, 28.5], P), { tone: 'lit', free: true }), ' class="laser"');

  parts.hood = wrap('hood', solid(prismXZ(HOOD, -14, 14)) + L(k.segment([14.2, 0, 18.7], [36, 0, 16.3], P), { tone: 'faint' }), ' class="paint"');
  parts.trunk = wrap('trunk', solid(prismXZ(TRUNK, -14, 14)), ' class="paint"');
  parts.doorF = wrap('doorF', solid(prismXZ(DOOR_F, 16, 16.9)) + D([at(-0.2, 16.95, 15.3)], { size: 0.6, tone: 'hi' }) + L(k.segment([-2, 16.9, 14], [13, 16.9, 14], P), { tone: 'faint' }), ' class="paint"');
  parts.doorR = wrap('doorR', solid(prismXZ(DOOR_R, 16, 16.9)) + D([at(-5, 16.95, 15.3)], { size: 0.6, tone: 'hi' }) + L(k.segment([-22, 16.9, 14], [-3.2, 16.9, 14], P), { tone: 'faint' }), ' class="paint"');

  // lamps and grille on the +x face, fitted in assembly
  parts.lamps = wrap('lamps', [
    slab({ x: 40, y: 7.5, w: 0.9, d: 6 }, 8, 2.6, { tone: 'mid' }),
    slab({ x: 40, y: -13.5, w: 0.9, d: 6 }, 8, 2.6, { tone: 'mid' }),
    slab({ x: 40, y: -4.5, w: 0.7, d: 9 }, 7.6, 2.6, { tone: 'lo' }),
  ].join(''));
  parts.mirror = wrap('mirror', slab({ x: 8, y: 16.9, w: 3, d: 3.2, r: 0.8 }, 19.4, 2.4, { tone: 'mid' }));
  // clear-coat glints
  parts.gloss = wrap('gloss', [
    L(k.segment([18, -6, 18.2], [32, -6, 16.5], P), { tone: 'lit', free: true }),
    L(k.segment([-12, 4, 28.2], [-2, 4, 28.4], P), { tone: 'lit', free: true }),
    L(k.segment([-18, 16.95, 15.7], [-8, 16.95, 15.7], P), { tone: 'lit', free: true }),
  ].join(''), ' class="gloss"');

  // ---- assembly-shop parts (all drawn inside the body; they fly in and then disappear into it) ----
  const eng = engineParts(26, 0, 4.4);
  parts.module = wrap('module', [
    slab({ x: 15, y: -13, w: 22, d: 26, r: 0.6 }, 3, 1.4, { tone: 'mid' }),
    ...[-1, 1].map((s) => L(k.segment([26, s * 8, 3.8], [26.6, s * 14.4, 7.6], P), { tone: 'mid' })),
    eng.pan, eng.block, eng.bores, eng.head, eng.cover, eng.intake, eng.exhaust, eng.belt,
  ].join(''));
  parts.rear = wrap('rear', [
    slab({ x: -29, y: -12.5, w: 4, d: 25, r: 0.6 }, 3, 2.6, { tone: 'mid' }),
    ...[-1, 1].map((s) => L(k.segment([-27, s * 9, 4.2], [-26.4, s * 14.4, 7.6], P), { tone: 'mid' })),
    L(k.segment([20, 4, 2.6], [-28, 4, 2.6], P) + k.segment([-28, 4, 2.6], [-36, 4, 3.4], P), { tone: 'hi' }),
    S(G.solidOf([[0, 2.4], [8, 2.4]], G.frameOf([-34, 4, 3.4], [-1, 0, 0], [0, 1, 0], [0, 0, 1]), P, { steps: 14 }), { tone: 'mid' }),
  ].join(''));
  parts.cockpit = wrap('cockpit', [
    slab({ x: 10.6, y: -11, w: 2.4, d: 22, r: 0.5 }, 12, 4.2, { tone: 'hi' }),
    S(G.solidOf([[0, 3.2], [1.6, 3.2]], G.frameOf([11.8, 5, 14.6], [1, 0, 0], [0, 1, 0], [0, 0, 1]), P, { steps: 18 }), { tone: 'hi' }),
  ].join(''));
  parts.seats = wrap('seats', [-6, 8.5].map((y) => slab({ x: -14, y, w: 8, d: 6.5, r: 1 }, 6, 3, { tone: 'hi' }) + slab({ x: -15, y, w: 2, d: 6.5, r: 0.8 }, 9, 7, { tone: 'hi' })).join(''));
  parts.harness = wrap('harness', L(k.segment([-36, -9, 7.2], [10, -9, 7.2], P) + k.segment([10, -9, 7.2], [10, 9, 12], P) + k.segment([-36, 9, 7.2], [10, 9, 7.2], P) + k.segment([-20, -9, 7.2], [-20, 9, 7.2], P), { tone: 'lit', free: true }), ' class="harness"');
  // overhead carrier used to lift the body in the paint shop and at the marriage: cross beams at the ends, a rail between them
  const rod = (x, y) => S(k.cylinder(x, y, 0.9, 3, 54, P, 8, 0), { tone: 'mid', crease: 'none' });
  parts.hanger = wrap('hanger', [
    rod(34, -21), rod(34, 21), rod(-34, -21), rod(-34, 21),
    slab({ x: 32, y: -24, w: 4, d: 48, r: 0.6 }, 57, 3, { tone: 'hi' }),
    slab({ x: -36, y: -24, w: 4, d: 48, r: 0.6 }, 57, 3, { tone: 'hi' }),
    slab({ x: -34, y: -2, w: 68, d: 4, r: 0.6 }, 60, 3, { tone: 'hi' }),
  ].join(''));
  return parts;
}

// Engine blocks are built at an offset, long axis along y. Returned as separate pieces so the engine shop can assemble them in turn.
export function engineParts(ox, oy, oz) {
  const sl = (x, y, z, w, d, h, o = {}) => slab({ x: ox + x, y: oy + y, w, d, r: o.r ?? 0.5 }, oz + z, h, { tone: o.tone ?? 'hi', ...o });
  const bore = (b) => k.ring(ox, oy + b, 2.3, oz + 8, P, 14);
  return {
    pan: sl(-5, -12, 0, 10, 24, 2, { tone: 'mid' }),
    block: sl(-6, -13, 2, 12, 26, 6),
    bores: L([-9.75, -3.25, 3.25, 9.75].map(bore).join(''), { tone: 'mid' }),
    head: sl(-6, -13, 8, 12, 26, 3),
    cover: sl(-4.5, -12, 11, 9, 24, 1.4, { tone: 'mid', groove: 1 }),
    intake: sl(-9.8, -10, 8.4, 3.6, 20, 3, { tone: 'mid' }) + [-9.75, -3.25, 3.25, 9.75].map((b) => S(k.cylinder(ox - 7, oy + b, 0.9, oz + 8.6, 2.4, P, 8, 0), { tone: 'mid', crease: 'none' })).join(''),
    exhaust: sl(6, -9, 5.6, 2, 18, 2.4, { tone: 'lo' }) + L(k.segment([ox + 7, oy, oz + 5.6], [ox + 9.5, oy, oz + 1], P), { tone: 'hi' }),
    belt: sl(-5, 13, 1.6, 10, 2, 8, { tone: 'mid' }),
    crank: S(G.solidOf([[0, 1.5], [24, 1.5]], G.frameOf([ox, oy - 12, oz + 4.5], [0, 1, 0], [1, 0, 0], [0, 0, 1]), P, { steps: 12 }), { tone: 'hi' }),
    pistons: [-9.75, -3.25, 3.25, 9.75].map((b) => S(k.cylinder(ox, oy + b, 1.9, oz + 8, 3, P, 12, 0.2), { tone: 'hi' })).join(''),
  };
}

// painter's order inside the car group (back to front)
export const CAR_ORDER = ['skid', 'wheelFarF', 'wheelFarR', 'floor', 'rear', 'wallFar', 'cowl', 'module', 'harness', 'seats', 'cockpit', 'wallNear', 'cabin', 'glass', 'seams', 'hood', 'trunk', 'doorR', 'doorF', 'lamps', 'mirror', 'gloss', 'wheelNearR', 'wheelNearF', 'hanger'];

export function carSvg(skip = []) {
  const parts = carParts();
  return CAR_ORDER.filter((n) => !skip.includes(n)).map((n) => parts[n]).join('');
}
// a finished, painted car with no assembly aids: what waits on the carrier
export const PARKED_SKIP = ['skid', 'hanger', 'module', 'harness', 'seats', 'cockpit', 'seams'];
