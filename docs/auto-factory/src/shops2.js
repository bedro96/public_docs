// Static equipment for the body, paint, engine, assembly and shipping bays (see shops.js for the helpers' idea).
import { k, S, L, D, P, at, slab, post, rollY, rollX, BAYS, newScene, tag } from './world.js';
import { robotBase } from './robot.js';
import { ROBOTS } from './shops.js';

const ADD = (sc, slot, bay, b, svg) => sc[slot].add(b, tag(bay, svg));
const blk = (sc, slot, bay, x, y, z, w, d, h, o = {}) => ADD(sc, slot, bay, { x, y, z, w, d, h }, slab(x, y, w, d, z, h, o));
const cyl = (sc, slot, bay, cx, cy, r, z, h, o = {}) => ADD(sc, slot, bay, { x: cx - r, y: cy - r, z, w: 2 * r, d: 2 * r, h }, post(cx, cy, r, z, h, o));
const sw = (a, b) => k.segment(a, b, P);

// An open tunnel (oven, spray booth, pretreatment): a back wall, front corner posts and a top frame, so the workpiece stays visible.
export function tunnel(sc, bay, x0, w, h, { wall = true, id = '', glow = false, half = 36 } = {}) {
  if (wall) blk(sc, 'back', bay, x0, -half - 2, 0, w, 2, h, { tone: 'mid', r: 0.4, groove: 1 });
  blk(sc, 'back', bay, x0, -half - 2, 0, 3, 5, h + 3, { tone: 'hi', r: 0.5 });
  blk(sc, 'back', bay, x0 + w - 3, -half - 2, 0, 3, 5, h + 3, { tone: 'hi', r: 0.5 });
  blk(sc, 'front', bay, x0, half - 3, 0, 3, 5, h + 3, { tone: 'hi', r: 0.5 });
  blk(sc, 'front', bay, x0 + w - 3, half - 3, 0, 3, 5, h + 3, { tone: 'hi', r: 0.5 });
  blk(sc, 'front', bay, x0, -half - 2, h, 3, 2 * half + 4, 3, { tone: 'hi', r: 0.5 });
  blk(sc, 'front', bay, x0 + w - 3, -half - 2, h, 3, 2 * half + 4, 3, { tone: 'hi', r: 0.5 });
  blk(sc, 'front', bay, x0, half - 2, h, w, 2.4, 3, { tone: 'hi', r: 0.4 });
  blk(sc, 'front', bay, x0, -half - 2, h, w, 2.4, 3, { tone: 'hi', r: 0.4 });
  if (id) ADD(sc, 'back', bay, { x: x0 + 3, y: -half, z: 6, w: w - 6, d: 0.4, h: h - 14 }, `<g id="${id}" class="${glow ? 'glow' : 'wallfx'}">${L(wallLines(x0 + 6, w - 12, -half + 0.3, 8, h - 8, glow ? 7 : 5), { tone: glow ? 'lit' : 'mid', free: true })}</g>`);
}
function wallLines(x, w, y, z0, z1, n) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const z = z0 + ((z1 - z0) * i) / Math.max(1, n - 1);
    d += k.segment([x, y, z], [x + w, y, z], P);
  }
  return d;
}

function bodyShop(sc) {
  const bay = 'body';
  // station fixtures under the skid: clamps and locating pins
  [396, 444, 496].forEach((cx) => {
    blk(sc, 'back', bay, cx - 44, -18, 2.6, 88, 4, 3, { tone: 'mid', r: 0.6 });
    blk(sc, 'back', bay, cx - 44, 14, 2.6, 88, 4, 3, { tone: 'mid', r: 0.6 });
  });
  // robots: bases here, arms are live
  ROBOTS.filter((r) => r.bay === 'body').forEach((r) => ADD(sc, r.slot, 'body', { x: r.x - 6, y: r.y - 6, z: 0, w: 12, d: 12, h: 17 }, robotBase(r.x, r.y, r)));
  // framing gate: two portal posts either side of station B and a top beam (the side frames come in through it)
  blk(sc, 'back', bay, 418, -50, 0, 5, 6, 64, { tone: 'hi', r: 0.8 });
  blk(sc, 'back', bay, 472, -50, 0, 5, 6, 64, { tone: 'hi', r: 0.8 });
  blk(sc, 'front', bay, 418, 46, 0, 5, 6, 64, { tone: 'hi', r: 0.8 });
  blk(sc, 'front', bay, 472, 46, 0, 5, 6, 64, { tone: 'hi', r: 0.8 });
  blk(sc, 'front', bay, 418, -50, 64, 59, 102, 4, { tone: 'hi', r: 0.8, groove: 1 });
  // part feeders: stacks of side frames, roof panels, closures
  blk(sc, 'back', bay, 360, -80, 0, 28, 24, 10, { tone: 'hi', r: 1, groove: 1 });
  blk(sc, 'back', bay, 394, -80, 0, 28, 24, 14, { tone: 'hi', r: 1, groove: 1 });
  blk(sc, 'back', bay, 436, -80, 0, 30, 20, 8, { tone: 'mid', r: 1 });
  blk(sc, 'front', bay, 360, 60, 0, 30, 22, 8, { tone: 'mid', r: 1 });
  blk(sc, 'front', bay, 440, 60, 0, 30, 22, 8, { tone: 'mid', r: 1 });
  blk(sc, 'back', bay, 480, -80, 0, 34, 20, 20, { tone: 'hi', r: 1, groove: 1 });
  // measuring cell: a gantry with a laser scanner at the exit
  blk(sc, 'back', bay, 512, -34, 0, 4, 4, 40, { tone: 'hi' });
  blk(sc, 'front', bay, 512, 30, 0, 4, 4, 40, { tone: 'hi' });
  blk(sc, 'front', bay, 512, -34, 38, 4, 68, 3, { tone: 'hi' });
}

function paintShop(sc) {
  const bay = 'paint';
  // pretreatment tunnel with three spray zones
  tunnel(sc, bay, 548, 44, 70, { id: 'pt-spray' });
  // ED (electro-coat) dip tank: back wall + ends behind the car, front wall and the liquid surface in front of it
  const tx = 600;
  const tw = 96;
  blk(sc, 'back', bay, tx, -37, 0, tw, 3, 30, { tone: 'hi', r: 0.4 });
  blk(sc, 'back', bay, tx, -37, 0, 4, 74, 30, { tone: 'hi', r: 0.4 });
  blk(sc, 'back', bay, tx + tw - 4, -37, 0, 4, 74, 30, { tone: 'hi', r: 0.4 });
  blk(sc, 'back', bay, tx + 4, -34, 0, tw - 8, 68, 12, { tone: 'lo', r: 0.4, crease: 'none' });
  blk(sc, 'front', bay, tx, 34, 0, tw, 3, 30, { tone: 'hi', r: 0.4, groove: 0.8 });
  const surf = [at(tx + 4, -34, 27), at(tx + tw - 4, -34, 27), at(tx + tw - 4, 34, 27), at(tx + 4, 34, 27)];
  ADD(sc, 'front', bay, { x: tx + 4, y: -34, z: 27, w: tw - 8, d: 68, h: 0.1 }, `<path id="ed-liquid" class="liquid" d="${k.pathOf(surf, true)}"/>`);
  // pump + filter skids and the paint supply tanks behind the booth
  [610, 630, 650].forEach((cx) => cyl(sc, 'back', bay, cx, -62, 8, 0, 26, { tone: 'hi', steps: 20 }));
  blk(sc, 'back', bay, 672, -70, 0, 28, 20, 12, { tone: 'mid', r: 1, groove: 1 });
  // ED oven, spray booth, clear oven
  tunnel(sc, bay, 744, 84, 56, { id: 'oven1-heat', glow: true });
  tunnel(sc, bay, 836, 84, 54, { id: 'booth-air' });
  tunnel(sc, bay, 928, 84, 56, { id: 'oven2-heat', glow: true });
  ROBOTS.filter((r) => r.bay === 'paint').forEach((r) => ADD(sc, r.slot, 'paint', { x: r.x - 6, y: r.y - 6, z: 0, w: 12, d: 12, h: 17 }, robotBase(r.x, r.y, r)));
  // colour supply tanks and a mixing room at the back of the booth
  [846, 866, 886, 906].forEach((cx, i) => cyl(sc, 'back', bay, cx, -64, 7, 0, 22 + (i % 2) * 6, { tone: 'hi', steps: 18 }));
  blk(sc, 'back', bay, 930, -74, 0, 40, 24, 22, { tone: 'hi', r: 1, groove: 1.2 });
  // exhaust stack of the ovens
  cyl(sc, 'back', bay, 786, -48, 3, 56, 24, { tone: 'mid', steps: 12 });
  cyl(sc, 'back', bay, 970, -48, 3, 56, 24, { tone: 'mid', steps: 12 });
}

// ---------------- engine bay (behind the assembly bay) ----------------
export const ENGINE_Y = -214;
export const ENGINE_STATIONS = { cast: 1056, machine: 1082, build: 1108, test: 1134, agv: 1176 };
function engineShop(sc) {
  const bay = 'engine';
  const E = ENGINE_STATIONS;
  const sy = ENGINE_Y;
  // The hero engine (long axis along y, +-14) travels along x at y = sy, so station walls stand at |dy| >= 17.
  // casting: furnace behind a mould press
  cyl(sc, 'back', bay, E.cast, sy - 34, 9, 0, 24, { tone: 'hi', steps: 20 });
  blk(sc, 'back', bay, E.cast - 12, sy - 22, 0, 24, 5, 18, { tone: 'hi', r: 0.8 });
  blk(sc, 'front', bay, E.cast - 12, sy + 18, 0, 24, 5, 18, { tone: 'hi', r: 0.8 });
  blk(sc, 'front', bay, E.cast - 12, sy - 22, 30, 24, 45, 3, { tone: 'hi', r: 0.8 });
  // machining centre: enclosure wall, spindle gantry
  blk(sc, 'back', bay, E.machine - 12, sy - 22, 0, 24, 3, 34, { tone: 'mid', r: 0.6 });
  blk(sc, 'front', bay, E.machine - 12, sy + 18, 0, 24, 3, 12, { tone: 'mid', r: 0.6 });
  blk(sc, 'front', bay, E.machine - 12, sy - 22, 34, 24, 43, 3, { tone: 'hi', r: 0.8, groove: 1 });
  // assembly bench with parts bins
  blk(sc, 'back', bay, E.build - 12, sy - 22, 0, 24, 5, 24, { tone: 'hi', r: 0.8, groove: 1 });
  blk(sc, 'front', bay, E.build - 12, sy + 18, 0, 10, 6, 9, { tone: 'mid', r: 0.6 });
  blk(sc, 'front', bay, E.build + 2, sy + 18, 0, 10, 6, 9, { tone: 'mid', r: 0.6 });
  // test cell: a dynamometer behind the engine, with a guard and an exhaust duct
  blk(sc, 'back', bay, E.test - 12, sy - 30, 0, 24, 10, 12, { tone: 'hi', r: 1 });
  cyl(sc, 'back', bay, E.test, sy - 36, 5, 0, 26, { tone: 'mid', steps: 16 });
  blk(sc, 'front', bay, E.test - 12, sy + 18, 0, 24, 3, 14, { tone: 'mid', r: 0.6 });
  // conveyor under the engines
  blk(sc, 'back', bay, 1042, sy - 10, 0, 148, 20, 3, { tone: 'mid', r: 0.8 });
  // parts stores at the back of the bay
  blk(sc, 'back', bay, 1040, sy - 80, 0, 56, 22, 14, { tone: 'hi', r: 1, groove: 1.2 });
  blk(sc, 'back', bay, 1104, sy - 80, 0, 40, 22, 10, { tone: 'mid', r: 1 });
  blk(sc, 'back', bay, 1198, sy - 56, 0, 26, 40, 8, { tone: 'mid', r: 1 });
}

// ---------------- assembly bay ----------------
function assemblyShop(sc) {
  const bay = 'assembly';
  // slat conveyor line, parts shelves and kitting carts at the back
  blk(sc, 'back', bay, 1040, -80, 0, 26, 22, 12, { tone: 'hi', r: 1, groove: 1 });
  blk(sc, 'back', bay, 1070, -80, 0, 26, 22, 18, { tone: 'hi', r: 1, groove: 1 });
  blk(sc, 'back', bay, 1100, -78, 0, 22, 22, 9, { tone: 'mid', r: 1 });
  blk(sc, 'back', bay, 1198, -80, 0, 28, 22, 10, { tone: 'hi', r: 1, groove: 1 });
  blk(sc, 'front', bay, 1050, 58, 0, 34, 22, 8, { tone: 'mid', r: 1 });
  blk(sc, 'front', bay, 1120, 58, 0, 34, 22, 8, { tone: 'mid', r: 1 });
  blk(sc, 'front', bay, 1190, 60, 0, 30, 20, 12, { tone: 'hi', r: 1, groove: 1 });
  // marriage portal: posts either side of the line, top beam, and the pit where the powertrain AGV docks
  blk(sc, 'back', bay, 1104, -44, 0, 5, 6, 78, { tone: 'hi', r: 0.8 });
  blk(sc, 'back', bay, 1192, -44, 0, 5, 6, 78, { tone: 'hi', r: 0.8 });
  blk(sc, 'front', bay, 1104, 40, 0, 5, 6, 78, { tone: 'hi', r: 0.8 });
  blk(sc, 'front', bay, 1192, 40, 0, 5, 6, 78, { tone: 'hi', r: 0.8 });
  blk(sc, 'front', bay, 1104, -44, 78, 93, 90, 4, { tone: 'hi', r: 0.8, groove: 1 });
  ROBOTS.filter((r) => r.bay === 'assembly').forEach((r) => ADD(sc, r.slot, 'assembly', { x: r.x - 6, y: r.y - 6, z: 0, w: 12, d: 12, h: 17 }, robotBase(r.x, r.y, r)));
  // wheel and tyre rack at the back, fluid-fill station in front
  blk(sc, 'front', bay, 1204, 30, 0, 18, 18, 12, { tone: 'hi', r: 1 });
  cyl(sc, 'front', bay, 1213, 39, 3, 12, 14, { tone: 'mid', steps: 12 });
}

// ---------------- shipping / final test ----------------
function shipBay(sc) {
  const bay = 'ship';
  // roller dynamometer (rollers sunk in the floor, shown as a pit with four rollers)
  blk(sc, 'back', bay, 1270, -24, 0, 56, 48, 1.2, { tone: 'mid', r: 1.5 });
  [1282, 1306].forEach((cx) => {
    ADD(sc, 'back', bay, { x: cx - 3, y: -20, z: 1.2, w: 6, d: 40, h: 6 }, rollY(cx, -20, 20, 4.2, 3, 'mid', { steps: 16 }));
  });
  // water-test booth: a frame with spray bars (right after the dyno)
  tunnel(sc, bay, 1326, 36, 46, { id: 'water-test' });
  ROBOTS.filter((r) => r.bay === 'ship').forEach((r) => ADD(sc, r.slot, 'ship', { x: r.x - 6, y: r.y - 6, z: 0, w: 12, d: 12, h: 17 }, robotBase(r.x, r.y, r)));
  // inspection hall bench, and the car carrier truck waiting in the yard
  blk(sc, 'back', bay, 1256, -80, 0, 40, 20, 10, { tone: 'hi', r: 1, groove: 1 });
  blk(sc, 'front', bay, 1256, 56, 0, 44, 24, 6, { tone: 'mid', r: 1 });
  // yard cars waiting for transport (neutral, from the same car model by <use>)
  ADD(sc, 'front', bay, { x: 1290, y: 46, z: 0, w: 84, d: 42, h: 30 }, `<use href="#car-parked" transform="${k.translateAlong(P, [1336, 66, 0])}"/>`);
}

export function buildAll(sc) {
  bodyShop(sc);
  paintShop(sc);
  engineShop(sc);
  assemblyShop(sc);
  shipBay(sc);
  return sc;
}
export { newScene };
