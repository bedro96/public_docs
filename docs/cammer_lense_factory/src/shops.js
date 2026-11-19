// Static plant equipment, part 1: ground, conveyors, receiving, SMT, die/wire bond. Part 2 (lens, AA, test, pack, dock, clean room)
// is in shops2.js. Every builder adds items to a scene (see newScene in world.js). Anything that moves is a <g id=...> hook that
// the live module drives from the model's state (heads, lamps, glows); the rest is build-time geometry.
// Layout is a schematic [assumption]: reference manufacturer publishes no floor plan.
import { k, S, L, D, P, at, slab, post, rollY, rollX, BAYS, BAY_ORDER, newScene, tag } from './world.js';
import { ST, BELT_Z } from './layout.js';

export const ADD = (sc, slot, bay, b, svg) => sc[slot].add(b, tag(bay, svg));
export const blk = (sc, slot, bay, x, y, z, w, d, h, o = {}) => ADD(sc, slot, bay, { x, y, z, w, d, h }, slab(x, y, w, d, z, h, o));
export const cyl = (sc, slot, bay, cx, cy, r, z, h, o = {}) => ADD(sc, slot, bay, { x: cx - r, y: cy - r, z, w: 2 * r, d: 2 * r, h }, post(cx, cy, r, z, h, o));
export const sw = (a, b) => k.segment(a, b, P);

// moving heads: id, which axis they travel, amplitude (world units) and which model `act` key drives them.
export const HEADS = [
  { id: 'printer', ax: 'y', amp: 7, act: 'printer', rate: 0.9 },
  { id: 'mount1', ax: 'x', amp: 6, act: 'mount', rate: 1.7 },
  { id: 'mount2', ax: 'y', amp: 6, act: 'mount', rate: 1.3 },
  { id: 'aoi', ax: 'y', amp: 9, act: 'aoi', rate: 0.8 },
  { id: 'die', ax: 'y', amp: 11, act: 'die', rate: 1.1 },
  { id: 'wb1', ax: 'z', amp: 2.2, act: 'wire', rate: 3.1 },
  { id: 'wb2', ax: 'z', amp: 2.2, act: 'wire', rate: 3.7 },
  { id: 'wb3', ax: 'z', amp: 2.2, act: 'wire', rate: 2.9 },
  { id: 'irc', ax: 'y', amp: 8, act: 'irc', rate: 1.0 },
  { id: 'mag', ax: 'y', amp: 7, act: 'mag', rate: 1.2 },
  { id: 'vcm', ax: 'z', amp: 4, act: 'vcm', rate: 1.4 },
  { id: 'stack', ax: 'z', amp: 4, act: 'stack', rate: 1.1 },
  { id: 'tray', ax: 'y', amp: 7, act: 'tray', rate: 1.0 },
  { id: 'bag', ax: 'z', amp: 3, act: 'bag', rate: 1.2 },
];
// lamps: tower lights that turn on while a station is active
export const LAMPS = ['printer', 'mount', 'reflow', 'aoi', 'plasma', 'die', 'wire', 'irc', 'mag', 'vcm', 'stack', 'aa', 'oven', 'cal', 'shake', 'optic', 'otp', 'avi', 'tray', 'bag', 'carton'];
export const GLOWS = ['reflow', 'plasma', 'oven'];

const lamp = (sc, slot, bay, key, x, y, z) => ADD(sc, slot, bay, { x: x - 1, y: y - 1, z, w: 2, d: 2, h: 7 },
  `<g id="lp-${key}" class="lamp">${post(x, y, 0.5, z, 3.2, { tone: 'mid', cls: 'lamp-pole', steps: 8 })}${post(x, y, 1.1, z + 3.2, 2.6, { tone: 'hi', cls: 'lamp-lens', steps: 10 })}</g>`);
const head = (sc, slot, bay, id, box, svg) => ADD(sc, slot, bay, box, `<g id="hd-${id}" class="hd">${svg}</g>`);

// a machine that straddles the line: a back cabinet, two front posts and a roof, so the carrier stays visible underneath
export function cell(sc, bay, cx, w, { h = 26, back = 30, key, grooveOn = true, roof = true } = {}) {
  const x0 = cx - w / 2;
  blk(sc, 'back', bay, x0, -44, 0, w, back, h, { tone: 'hi', r: 1, groove: grooveOn ? 1.2 : false });
  if (roof) {
    blk(sc, 'front', bay, x0 + 1.2, 22, 0, 3.2, 3.6, h, { tone: 'mid', r: 0.5 });
    blk(sc, 'front', bay, x0 + w - 4.4, 22, 0, 3.2, 3.6, h, { tone: 'mid', r: 0.5 });
    blk(sc, 'front', bay, x0, -44, h, w, 70, 2.6, { tone: 'hi', r: 1 });
  }
  if (key) lamp(sc, 'front', bay, key, x0 + w - 3, -40, h + 2.6);
  return x0;
}

// ---------------- ground, bay floors, conveyors ----------------
function ground(sc) {
  ADD(sc, 'back', 'all', { x: -16, y: -108, z: -4, w: 1400, d: 216, h: 3.4 }, slab(-16, -108, 1400, 216, -4, 3.4, { tone: 'lo', r: 6, steps: 4, bevel: 0, crease: 'none' }));
  for (const name of BAY_ORDER) {
    const b = BAYS[name];
    ADD(sc, 'back', name, { x: b.x, y: b.y, z: -0.6, w: b.w, d: b.d, h: 0.6 }, `<g data-bay-floor="${name}">${slab(b.x, b.y, b.w, b.d, -0.6, 0.6, { tone: 'faint', r: 2, steps: 4, bevel: 0, crease: 'none' })}</g>`);
  }
  // walkway lines along the front of every bay, and the AGV guide path from receiving to the first cell (a schematic [assumption])
  const marks = BAY_ORDER.map((n) => { const b = BAYS[n]; return sw([b.x + 6, b.y + b.d - 8, 0], [b.x + b.w - 6, b.y + b.d - 8, 0]); }).join('');
  ADD(sc, 'back', 'all', { x: 0, y: 80, z: 0, w: 1360, d: 0.1, h: 0.1 }, L(marks, { tone: 'lo', dashed: true, free: true }));
  ADD(sc, 'back', 'recv', { x: 24, y: -70, z: 0, w: 130, d: 0.1, h: 0.1 }, L(sw([20, -74, 0], [150, -74, 0]), { tone: 'mid', dashed: true, free: true }));
}

// the line conveyor: a low table with a belt on top. Gaps at the clean-room pass-throughs are left by the caller.
export function lineConveyor(sc, x0, x1, bay) {
  const rollers = [];
  // rollers run edge to edge across the belt top, so every end lands on the belt's outline
  for (let x = x0 + 3; x < x1; x += 6) rollers.push(sw([x, -6.4, BELT_Z], [x, 6.4, BELT_Z]));
  ADD(sc, 'back', bay, { x: x0, y: -8, z: 0, w: x1 - x0, d: 16, h: BELT_Z - 1.8 }, slab(x0, -8, x1 - x0, 16, 0, BELT_Z - 1.8, { tone: 'mid', r: 0.8, steps: 3, bevel: 0.2, crease: 'faint' }));
  ADD(sc, 'back', bay, { x: x0, y: -6.4, z: BELT_Z - 1.8, w: x1 - x0, d: 12.8, h: 1.8 }, slab(x0, -6.4, x1 - x0, 12.8, BELT_Z - 1.8, 1.8, { tone: 'lo', r: 0.5, steps: 2, bevel: 0, crease: 'faint' }) + L(rollers.join(''), { tone: 'faint' }));
}

// ---------------- 1. receiving + gowning ----------------
function receiving(sc) {
  const bay = 'recv';
  // pallet racks along the back wall: lens trays, sensor wafers (in sealed boxes), VCM parts, substrates
  [8, 38, 68, 98].forEach((x, i) => {
    blk(sc, 'back', bay, x, -88, 0, 26, 12, 2, { tone: 'mid', r: 0.5 });
    [0, 1].forEach((lv) => {
      const z = 2 + lv * 14;
      blk(sc, 'back', bay, x, -88, z + 10, 26, 12, 1.2, { tone: 'mid', r: 0.4 });
      [0, 1, 2].forEach((j) => blk(sc, 'back', bay, x + 2 + j * 8, -86, z + 0, 6.6, 8, 9.4 - (i + j + lv) % 3 * 0.8, { tone: 'hi', r: 0.5, groove: 0.8 }));
    });
    blk(sc, 'back', bay, x, -88, 0, 1.4, 1.4, 26, { tone: 'mid', r: 0.2 });
    blk(sc, 'back', bay, x + 24.6, -88, 0, 1.4, 1.4, 26, { tone: 'mid', r: 0.2 });
  });
  // incoming-inspection bench with a microscope-style head and a monitor
  blk(sc, 'back', bay, 20, -50, 0, 44, 16, 11, { tone: 'hi', r: 0.8, groove: 1 });
  blk(sc, 'back', bay, 30, -48, 11, 10, 8, 1.6, { tone: 'mid', r: 0.4 });
  cyl(sc, 'back', bay, 35, -44, 1.6, 12.6, 9, { tone: 'hi', steps: 10 });
  blk(sc, 'back', bay, 46, -50, 11, 12, 1.6, 8, { tone: 'hi', r: 0.4 });
  // material pass-in: a small dock door and a cart row
  [92, 108, 124].forEach((x) => { blk(sc, 'back', bay, x, -50, 0, 12, 10, 8, { tone: 'mid', r: 0.6, groove: 0.8 }); });
  // AGV stand-in in the aisle (schematic; the real transport is not public) and its pallet
  ADD(sc, 'back', bay, { x: 12, y: -70, z: 0, w: 26, d: 14, h: 5 }, `<g id="agv">${slab(12, -70, 26, 14, 0.6, 3.4, { tone: 'mid', r: 2, steps: 3 })}${D([at(16, -66, 4), at(34, -66, 4), at(16, -60, 4), at(34, -60, 4)], { size: 0.5, tone: 'mid' })}${slab(15, -69, 20, 12, 4, 1.6, { tone: 'hi', r: 0.8 })}</g>`);
  // the first conveyor starts at the receiving bay and ends at the clean-room pass-through
  lineConveyor(sc, 14, 154, bay);
  // gowning row on the floor: seven markers with a small bench each (steps 1-4 in front, air shower, steps 6-7)
  [[34, 58, 'gown'], [58, 58, 'roller'], [82, 58, 'static'], [106, 58, 'shoe']].forEach(([x, y]) => {
    blk(sc, 'front', bay, x - 7, y - 5, 0, 14, 10, 3.2, { tone: 'mid', r: 1, groove: 0.9 });
    blk(sc, 'front', bay, x - 4, y - 5, 3.2, 8, 3, 7, { tone: 'hi', r: 0.4 });
  });
  blk(sc, 'front', bay, 118, 44, 0, 12, 12, 2.4, { tone: 'mid', r: 1, crease: 'none' });
  // the air shower: two side walls, a roof with nozzles, inner jets drawn as short lines while the person is inside
  const ax0 = 146;
  const ax1 = 192;
  blk(sc, 'back', bay, ax0, 34, 0, ax1 - ax0, 3, 32, { tone: 'hi', r: 0.6, groove: 0.8 });
  blk(sc, 'front', bay, ax0, 62, 0, ax1 - ax0, 3, 32, { tone: 'hi', r: 0.6, groove: 0.8 });
  blk(sc, 'front', bay, ax0, 34, 32, ax1 - ax0, 31, 3, { tone: 'hi', r: 0.8 });
  const jets = [];
  for (let i = 0; i < 7; i++) { const x = ax0 + 6 + i * 6; jets.push(sw([x, 38, 28], [x, 42, 16]), sw([x, 61, 28], [x, 56, 16])); }
  ADD(sc, 'front', bay, { x: ax0, y: 34, z: 14, w: ax1 - ax0, d: 31, h: 18 }, `<g id="shower" class="shower">${L(jets.join(''), { tone: 'lit', dashed: true, free: true })}</g>`);
  lamp(sc, 'front', bay, 'shower', ax1 - 3, 64, 32);
  // the person token: a simple standing figure (body, head), moved by the live layer
  ADD(sc, 'front', bay, { x: 20, y: 52, z: 0, w: 6, d: 6, h: 17 }, `<g id="person" class="person">${post(0, 0, 2.3, 0, 10, { tone: 'hi', steps: 10, cls: 'p-body' })}${post(0, 0, 1.7, 10, 3.2, { tone: 'hi', steps: 10, cls: 'p-head' })}</g>`);
}

// ---------------- 2. SMT ----------------
function smt(sc) {
  const bay = 'smt';
  lineConveyor(sc, 166, 362, bay);
  // printer: back cabinet, stencil frame, squeegee
  let x0 = cell(sc, bay, ST.printer, 30, { h: 24, key: 'printer' });
  blk(sc, 'back', bay, x0 + 3, -12, 11, 24, 22, 1.2, { tone: 'mid', r: 0.6, crease: 'faint' });
  head(sc, 'front', bay, 'printer', { x: x0 + 8, y: -9, z: 12, w: 14, d: 3, h: 6 }, slab(x0 + 8, -2, 14, 3, 12.2, 3, { tone: 'hi', r: 0.4 }) + slab(x0 + 7, -2.4, 16, 1.2, 15.2, 2.4, { tone: 'mid', r: 0.3 }));
  // two placement machines: feeder banks with reels, a gantry beam and a head
  [ST.mount1, ST.mount2].forEach((cx, j) => {
    x0 = cell(sc, bay, cx, 32, { h: 26, key: j ? undefined : 'mount' });
    for (let i = 0; i < 5; i++) ADD(sc, 'back', bay, { x: x0 + 3 + i * 5.6, y: -44, z: 12, w: 4, d: 4, h: 8 }, rollY(x0 + 5 + i * 5.6, -44, -40, 16, 4, 'mid', { steps: 14 }));
    blk(sc, 'back', bay, x0 + 2, -14, 4, 28, 2, 8, { tone: 'mid', r: 0.4, groove: 0.6 });
    head(sc, 'front', bay, `mount${j + 1}`, { x: cx - 4, y: -6, z: 14, w: 8, d: 8, h: 10 }, slab(cx - 3, -3, 6, 6, 15, 5, { tone: 'hi', r: 0.8 }) + post(cx, 0, 1, 11.6, 3.4, { tone: 'mid', steps: 8 }) + slab(cx - 12, -1, 24, 2, 21, 1.4, { tone: 'mid', r: 0.3 }));
  });
  // reflow oven: back wall, heater modules on the roof, front sill; glow strips inside
  const rx0 = ST.reflow - 21;
  blk(sc, 'back', bay, rx0, -22, 0, 42, 8, 30, { tone: 'hi', r: 1, groove: 1 });
  blk(sc, 'front', bay, rx0, 14, 0, 42, 8, 6.4, { tone: 'hi', r: 1 });
  blk(sc, 'front', bay, rx0, -22, 30, 42, 44, 3, { tone: 'hi', r: 1 });
  [0, 1, 2, 3, 4].forEach((i) => blk(sc, 'front', bay, rx0 + 3 + i * 7.6, -18, 33, 6.4, 36, 4, { tone: 'mid', r: 0.6, groove: 0.7 }));
  ADD(sc, 'front', bay, { x: rx0, y: -12, z: 12, w: 42, d: 0.1, h: 10 }, `<g id="glow-reflow" class="glow">${[0, 1, 2, 3, 4].map((i) => L(sw([rx0 + 4 + i * 8, -10, 26], [rx0 + 8 + i * 8, -10, 26]) + sw([rx0 + 4 + i * 8, 10, 26], [rx0 + 8 + i * 8, 10, 26]), { tone: 'lit', free: true })).join('')}</g>`);
  lamp(sc, 'front', bay, 'reflow', rx0 + 38, -20, 37);
  // AOI: gantry with a camera that scans across the carrier
  x0 = cell(sc, bay, ST.aoi, 22, { h: 24, key: 'aoi' });
  head(sc, 'front', bay, 'aoi', { x: ST.aoi - 3, y: -6, z: 14, w: 6, d: 6, h: 9 }, slab(ST.aoi - 3, -3, 6, 6, 18, 5, { tone: 'hi', r: 0.8 }) + post(ST.aoi, 0, 1.6, 14, 4, { tone: 'dark', cls: 'lens', steps: 12 }));
  blk(sc, 'back', bay, x0 + 3, -14, 2, 16, 6, 7, { tone: 'mid', r: 0.5 });
}

// ---------------- 3. plasma, die bond, wire bond, IR filter ----------------
function bond(sc) {
  const bay = 'bond';
  lineConveyor(sc, 364, 556, bay);
  // plasma chamber with a window and a glow
  let x0 = cell(sc, bay, ST.plasma, 24, { h: 22, key: 'plasma' });
  ADD(sc, 'front', bay, { x: ST.plasma - 8, y: -14, z: 12, w: 16, d: 0.1, h: 8 }, `<g id="glow-plasma" class="glow">${L(sw([ST.plasma - 8, -12, 20], [ST.plasma + 8, -12, 20]) + sw([ST.plasma - 8, 12, 20], [ST.plasma + 8, 12, 20]) + sw([ST.plasma - 8, -12, 12], [ST.plasma + 8, -12, 12]), { tone: 'lit', free: true })}</g>`);
  // die bonder: cabinet with a wafer disc on a stage, pick head moves from the wafer to the carrier
  x0 = cell(sc, bay, ST.die, 38, { h: 28, key: 'die' });
  ADD(sc, 'back', bay, { x: ST.die - 14, y: -42, z: 28, w: 16, d: 16, h: 3 }, `<g id="wafer">${post(ST.die - 6, -34, 8, 28.6, 1.2, { tone: 'hi', steps: 28, cls: 'wafer' })}${L(k.ring(ST.die - 6, -34, 5.6, 29.8, P, 20), { tone: 'faint' })}${L([[-4, -2], [-4, 2], [0, -4], [0, 4], [4, -2], [4, 2]].map(([a, b]) => sw([ST.die - 6 + a, -34 + b, 29.8], [ST.die - 6 + a + 1.6, -34 + b, 29.8])).join(''), { tone: 'faint', free: true })}</g>`);
  head(sc, 'front', bay, 'die', { x: ST.die - 3, y: -10, z: 14, w: 6, d: 8, h: 9 }, slab(ST.die + 2, -3, 3, 6, 18, 5, { tone: 'hi', r: 0.6 }) + post(ST.die + 3.5, 0, 0.9, 13.4, 4.6, { tone: 'mid', steps: 8 }) + slab(ST.die - 14, -1, 20, 2, 22, 1.4, { tone: 'mid', r: 0.3 }));
  blk(sc, 'back', bay, ST.die + 4, -14, 4, 12, 6, 10, { tone: 'mid', r: 0.5 });
  // three wire bonders in a row: each a head on an arm that dips to the carrier
  [ST.wb1, ST.wb2, ST.wb3].forEach((cx, i) => {
    cell(sc, bay, cx, 20, { h: 22, key: i === 0 ? 'wire' : undefined });
    head(sc, 'front', bay, `wb${i + 1}`, { x: cx - 3, y: -5, z: 12, w: 6, d: 6, h: 8 }, slab(cx - 2.4, -2.4, 4.8, 4.8, 16, 4, { tone: 'hi', r: 0.8 }) + post(cx, 0, 0.5, 11.8, 4.4, { tone: 'lit', steps: 6 }) + slab(cx - 8, -1, 16, 2, 20, 1.2, { tone: 'mid', r: 0.3 }));
    // wire spool on the cabinet
    ADD(sc, 'back', bay, { x: cx - 4, y: -44, z: 22, w: 8, d: 3, h: 8 }, rollY(cx, -44, -41, 26, 3.8, 'mid', { steps: 12 }));
  });
  // IR-cut filter attach: dispenser + glass picker
  x0 = cell(sc, bay, ST.irc, 22, { h: 24, key: 'irc' });
  head(sc, 'front', bay, 'irc', { x: ST.irc - 3, y: -8, z: 14, w: 6, d: 6, h: 9 }, slab(ST.irc - 3, -3, 6, 6, 18, 5, { tone: 'hi', r: 0.8 }) + post(ST.irc, 0, 0.9, 13.4, 4.6, { tone: 'lit', steps: 8 }));
  blk(sc, 'back', bay, x0 + 2, -14, 2, 16, 6, 8, { tone: 'mid', r: 0.5 });
}

export function buildStatic1(sc) {
  ground(sc);
  receiving(sc);
  smt(sc);
  bond(sc);
  return sc;
}
export { newScene, rollX, S, L, D };
