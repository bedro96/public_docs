// Static plant equipment. Each builder adds items to a scene (see newScene in world.js) and returns the ids it reserved.
// Everything that moves is a <g id=...> hook that the live module drives from the model's state.
import { k, S, L, D, P, at, slab, post, rollY, BAYS, LINE_X0, LINE_X1, newScene, tag } from './world.js';
import { robotBase } from './robot.js';

// ---- shared layout constants (the model and the live module read these too) ----
export const COIL = { x: 34, rMax: 13, rMin: 5.2, w: 20, z: 19 };
export const STRIP_Z = 7.7;
export const PRESS_X = [154, 200, 246, 292]; // left edges of the four press-line presses
export const PRESS_W = 34;
export const PRESS_H = 52;
export const BLANKER_X = 98;
export const PANEL_Z = 9;
export const RACKS = ['hood', 'door', 'roof', 'side', 'floor'];

export const ROBOTS = [
  // body shop: station A (underbody), B (framing), C (closures, laser)
  { id: 'wa1', bay: 'body', x: 382, y: -38, slot: 'back', tool: 'gun' },
  { id: 'wa2', bay: 'body', x: 410, y: -38, slot: 'back', tool: 'gun' },
  { id: 'wa3', bay: 'body', x: 382, y: 38, slot: 'front', tool: 'gun' },
  { id: 'wa4', bay: 'body', x: 410, y: 38, slot: 'front', tool: 'gun' },
  { id: 'wb1', bay: 'body', x: 432, y: -38, slot: 'back', tool: 'gun' },
  { id: 'wb2', bay: 'body', x: 458, y: -38, slot: 'back', tool: 'gun' },
  { id: 'wb3', bay: 'body', x: 432, y: 38, slot: 'front', tool: 'gun' },
  { id: 'wb4', bay: 'body', x: 458, y: 38, slot: 'front', tool: 'gun' },
  { id: 'wc1', bay: 'body', x: 488, y: -38, slot: 'back', tool: 'gun' },
  { id: 'wc2', bay: 'body', x: 506, y: 38, slot: 'front', tool: 'hand' },
  { id: 'wc3', bay: 'body', x: 480, y: 38, slot: 'front', tool: 'hand', pedestal: 0 },
  // paint booth (primer, base, clear)
  { id: 'pp1', bay: 'paint', x: 850, y: -38, slot: 'back', tool: 'nozzle' },
  { id: 'pp2', bay: 'paint', x: 850, y: 38, slot: 'front', tool: 'nozzle' },
  { id: 'pb1', bay: 'paint', x: 876, y: -38, slot: 'back', tool: 'nozzle' },
  { id: 'pb2', bay: 'paint', x: 876, y: 38, slot: 'front', tool: 'nozzle' },
  { id: 'pc1', bay: 'paint', x: 902, y: -38, slot: 'back', tool: 'nozzle' },
  { id: 'pc2', bay: 'paint', x: 902, y: 38, slot: 'front', tool: 'nozzle' },
  // assembly: glass setting and wheel fitting
  { id: 'ag1', bay: 'assembly', x: 1086, y: -38, slot: 'back', tool: 'hand' },
  { id: 'aw1', bay: 'assembly', x: 1196, y: -38, slot: 'back', tool: 'gun' },
  { id: 'aw2', bay: 'assembly', x: 1196, y: 38, slot: 'front', tool: 'gun' },
  // shipping: inspection robot
  { id: 'si1', bay: 'ship', x: 1330, y: -38, slot: 'back', tool: 'hand' },
];

const BAY_LIST = ['coil', 'press', 'body', 'paint', 'assembly', 'ship', 'engine'];
const ADD = (sc, slot, bay, b, svg) => sc[slot].add(b, tag(bay, svg));
const blk = (sc, slot, bay, x, y, z, w, d, h, o = {}) => ADD(sc, slot, bay, { x, y, z, w, d, h }, slab(x, y, w, d, z, h, o));
const cyl = (sc, slot, bay, cx, cy, r, z, h, o = {}) => ADD(sc, slot, bay, { x: cx - r, y: cy - r, z, w: 2 * r, d: 2 * r, h }, post(cx, cy, r, z, h, o));
const sw = (a, b) => k.segment(a, b, P);

// ---------------- ground, floors, line conveyor ----------------
function ground(sc) {
  ADD(sc, 'back', 'all', { x: -16, y: -316, z: -4, w: 1428, d: 420, h: 3.4 }, slab(-16, -316, 1428, 420, -4, 3.4, { tone: 'lo', r: 6, steps: 4, bevel: 0 }));
  for (const name of BAY_LIST) {
    const b = BAYS[name];
    ADD(sc, 'back', name, { x: b.x, y: b.y, z: -0.6, w: b.w, d: b.d, h: 0.6 }, `<g data-bay-floor="${name}">${slab(b.x, b.y, b.w, b.d, -0.6, 0.6, { tone: 'faint', r: 2, steps: 4, bevel: 0, crease: 'none' })}</g>`);
  }
  // safety walkway marks and the AGV guide path from the engine bay to the line
  const marks = [];
  for (const name of BAY_LIST) {
    const b = BAYS[name];
    marks.push(sw([b.x + 6, b.y + b.d - 6, 0], [b.x + b.w - 6, b.y + b.d - 6, 0]));
  }
  ADD(sc, 'back', 'all', { x: 0, y: 84, z: 0, w: 1396, d: 0.1, h: 0.1 }, L(marks.join(''), { tone: 'lo', dashed: true, free: true }));
  ADD(sc, 'back', 'engine', { x: 1174, y: -222, z: 0, w: 4, d: 206, h: 0.1 }, L(sw([1176, -218, 0], [1176, -20, 0]), { tone: 'mid', dashed: true, free: true }));
}

function lineConveyor(sc, x0, x1, bay) {
  const rollers = [];
  for (let x = x0 + 3; x < x1; x += 5) rollers.push(sw([x, -13.7, 2.6], [x, 13.7, 2.6]));
  ADD(sc, 'back', bay, { x: x0, y: -14, z: 0, w: x1 - x0, d: 28, h: 2.6 }, slab(x0, -14, x1 - x0, 28, 0, 2.6, { tone: 'mid', r: 1, steps: 3, bevel: 0.3 }) + L(rollers.join(''), { tone: 'faint' }));
}

// ---------------- coil yard ----------------
function coilYard(sc) {
  const bay = 'coil';
  // coils in stock, lying on cradles at the back
  [16, 44, 72, 100].forEach((cx, i) => {
    blk(sc, 'back', bay, cx - 13, -82, 0, 26, 24, 2.2, { tone: 'mid', r: 1 });
    ADD(sc, 'back', bay, { x: cx - 11, y: -80, z: 2.2, w: 22, d: 20, h: 22 }, rollY(cx, -80, -60, 12.6, 10.4, 'hi', { steps: 24 }) + L(k.ring(cx, -60, 4.4, 12.6, P, 12), { tone: 'faint' }));
    void i;
  });
  // uncoiler: base, mandrel support behind the coil, mandrel nose in front
  blk(sc, 'back', bay, 18, -16, 0, 32, 32, 3.6, { tone: 'mid', r: 1.5 });
  blk(sc, 'back', bay, 28, -32, 0, 14, 18, 30, { tone: 'hi', r: 1 });
  // the hero coil sits in the work slot (see scene.js); its mandrel cap is drawn in front
  ADD(sc, 'front', bay, { x: COIL.x - 3, y: 10, z: COIL.z - 3, w: 6, d: 4, h: 6 }, rollY(COIL.x, 10, 14, COIL.z, 3, 'hi', { steps: 14 }));
  // pinch rolls and feed table
  blk(sc, 'back', bay, 48, -11, 4, 20, 22, 1.6, { tone: 'mid', r: 0.6 });
  // leveller: frame posts either side, lower rolls under the strip, upper rolls above it
  blk(sc, 'back', bay, 70, -17, 0, 24, 4, 20, { tone: 'hi', r: 0.8 });
  blk(sc, 'front', bay, 70, 13, 0, 24, 4, 20, { tone: 'hi', r: 0.8 });
  for (let i = 0; i < 4; i++) ADD(sc, 'back', bay, { x: 72 + i * 6 - 2.2, y: -13, z: 3, w: 4.4, d: 26, h: 4.4 }, rollY(72 + i * 6, -13, 13, 5.2, 2.2, 'mid', { steps: 14 }));
  for (let i = 0; i < 3; i++) ADD(sc, 'front', bay, { x: 75 + i * 6 - 2.2, y: -13, z: 8.2, w: 4.4, d: 26, h: 4.4 }, rollY(75 + i * 6, -13, 13, 10.4, 2.2, 'mid', { steps: 14 }));
  ADD(sc, 'front', bay, { x: 70, y: -13, z: 20, w: 24, d: 26, h: 4 }, slab(70, -13, 24, 26, 20, 4, { tone: 'hi', r: 0.8 }));
  // blanking press
  pressUnit(sc, bay, BLANKER_X, 28, 46, 'b');
  // blank stacker at the exit
  blk(sc, 'back', bay, 128, -14, 4, 20, 28, 2, { tone: 'mid', r: 1 });
  // control cabinet and a stack of finished-blank pallets at the back
  blk(sc, 'back', bay, 106, -72, 0, 22, 14, 18, { tone: 'hi', r: 1, groove: 1 });
}

// ---------------- generic stamping press ----------------
// Bed and lower die sit under the workpiece (back), the back columns behind it (back), the front columns and the crown in front
// of it (front). The slide and upper die are one <g id="ram-<id>"> in the front slot that the live module lowers by the stroke.
function pressUnit(sc, bay, x0, w, h, id) {
  blk(sc, 'back', bay, x0, -22, 0, w, 44, 6, { tone: 'hi', r: 1 });
  blk(sc, 'back', bay, x0 + 6, -13, 6, w - 12, 26, PANEL_Z - 6, { tone: 'mid', r: 1.2 });
  const col = (x, y, slot) => blk(sc, slot, bay, x, y, 0, 4.4, 5, h, { tone: 'hi', r: 0.6 });
  col(x0 + 1.2, -27, 'back');
  col(x0 + w - 5.6, -27, 'back');
  col(x0 + 1.2, 22, 'front');
  col(x0 + w - 5.6, 22, 'front');
  blk(sc, 'front', bay, x0, -28, h, w, 56, 8, { tone: 'hi', r: 1, groove: 1.4 });
  const sx = x0 + 3;
  const sWd = w - 6;
  const ram = [
    ...[x0 + w * 0.3, x0 + w * 0.7].map((rx) => post(rx, 0, 1.4, 38, h + 3 - 38, { tone: 'mid', steps: 10 })),
    slab(sx, -17, sWd, 34, 30, 7, { tone: 'hi', r: 1 }),
    slab(sx + 4, -11, sWd - 8, 22, 22, 8, { tone: 'mid', r: 1 }),
  ].join('');
  ADD(sc, 'front', bay, { x: sx, y: -17, z: 22, w: sWd, d: 34, h: 15 }, `<g id="ram-${id}">${ram}</g>`);
}

function pressShop(sc) {
  const bay = 'press';
  PRESS_X.forEach((x0, i) => pressUnit(sc, bay, x0, PRESS_W, PRESS_H, String(i + 1)));
  // transfer belts between presses and into the first press
  for (let i = 0; i <= 3; i++) {
    const xa = i === 0 ? 134 : PRESS_X[i - 1] + PRESS_W;
    const xb = PRESS_X[i];
    blk(sc, 'back', bay, xa, -9, 4, xb - xa, 18, 3, { tone: 'mid', r: 0.8 });
  }
  blk(sc, 'back', bay, PRESS_X[3] + PRESS_W, -9, 4, 14, 18, 3, { tone: 'mid', r: 0.8 });
  // finished-panel racks in front of the line (visibility driven by the model)
  RACKS.forEach((name, i) => {
    const rx = 156 + i * 36;
    ADD(sc, 'front', bay, { x: rx, y: 46, z: 0, w: 30, d: 30, h: 14 }, `<g id="rack-${i}" class="rack">${rackSvg(name, rx, 46)}</g>`);
  });
  // die storage and control room at the back
  blk(sc, 'back', bay, 160, -78, 0, 60, 22, 14, { tone: 'hi', r: 1, groove: 1.2 });
  blk(sc, 'back', bay, 240, -78, 0, 46, 22, 24, { tone: 'hi', r: 1, groove: 1.2 });
  blk(sc, 'back', bay, 296, -80, 0, 30, 18, 12, { tone: 'mid', r: 1 });
}

function rackSvg(name, x, y) {
  const parts = [slab(x, y, 30, 30, 0, 2.4, { tone: 'mid', r: 1 })];
  const sheet = (sx, sy, w, d, z, h = 0.9) => slab(x + sx, y + sy, w, d, z, h, { tone: 'hi', r: 0.4, steps: 2, bevel: 0.2 });
  const stack = (sx, sy, w, d, n, extra = 0) => {
    for (let i = 0; i < n; i++) parts.push(sheet(sx, sy, w, d, 2.4 + i * 1.5));
    if (extra) parts.push(slab(x + sx + 2, y + sy + 2, w - 4, d - 4, 2.4 + n * 1.5, extra, { tone: 'hi', r: 1.2, steps: 3, bevel: 0.3 }));
  };
  if (name === 'hood') stack(3, 5, 24, 20, 4, 1.8);
  if (name === 'door') { stack(2, 4, 12, 22, 4, 1.4); stack(16, 4, 12, 22, 3, 1.4); }
  if (name === 'roof') stack(2, 4, 26, 22, 3, 1.2);
  if (name === 'side') { stack(3, 3, 24, 11, 4, 1.6); stack(3, 16, 24, 11, 3, 1.6); }
  if (name === 'floor') stack(0, 2, 30, 26, 3, 1);
  return parts.join('');
}

export function buildStatic() {
  const sc = newScene();
  ground(sc);
  coilYard(sc);
  pressShop(sc);
  // the car's floor conveyor: body shop, then after the ED tank (the body hangs from an overhead rail in between)
  lineConveyor(sc, 352, 548, 'body');
  lineConveyor(sc, 740, 1030, 'paint');
  lineConveyor(sc, 1030, 1246, 'assembly');
  lineConveyor(sc, 1246, 1380, 'ship');
  return sc;
}
export { robotBase };
