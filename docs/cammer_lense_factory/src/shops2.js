// Static plant equipment, part 2: lens/VCM bay, active alignment, test, pack, loading dock, the clean-room envelope and the robots.
import { k, S, L, D, P, at, slab, post, rollY, rollX, BAYS, CLEAN, CLEAN_CORE, tag } from './world.js';
import { ST, BELT_Z, ROBOTS, TRUCK } from './layout.js';
import { robotBase } from './robot.js';
import { ADD, blk, cyl, sw, cell, lineConveyor } from './shops.js';

const lampAt = (sc, slot, bay, key, x, y, z) => ADD(sc, slot, bay, { x: x - 1, y: y - 1, z, w: 2, d: 2, h: 7 },
  `<g id="lp-${key}" class="lamp">${post(x, y, 0.5, z, 3.2, { tone: 'mid', cls: 'lamp-pole', steps: 8 })}${post(x, y, 1.1, z + 3.2, 2.6, { tone: 'hi', cls: 'lamp-lens', steps: 10 })}</g>`);
const headAt = (sc, slot, bay, id, box, svg) => ADD(sc, slot, bay, box, `<g id="hd-${id}" class="hd">${svg}</g>`);
// a vertical thin panel facing +y (a test chart, a window): a slab plus its drawn lines
const faceLines = (x0, x1, y, z0, z1, cols, rows) => {
  const out = [];
  for (let i = 1; i < cols; i++) { const x = x0 + ((x1 - x0) * i) / cols; out.push(sw([x, y, z0], [x, y, z1])); }
  for (let j = 1; j < rows; j++) { const z = z0 + ((z1 - z0) * j) / rows; out.push(sw([x0, y, z], [x1, y, z])); }
  return out.join('');
};

// a circle drawn on a wall that faces +y (centre x, z; fixed y)
const faceRingY = (cx, y, cz, r, n = 14) => k.pathOf(Array.from({ length: n }, (_, i) => at(cx + r * Math.cos((i / n) * Math.PI * 2), y, cz + r * Math.sin((i / n) * Math.PI * 2))), true);
// ---------------- 4. lens + VCM bay ----------------
function lensBay(sc) {
  const bay = 'lens';
  lineConveyor(sc, 556, 714, bay);
  // magnet cell: magnet strips on a tray and a pick head
  let x0 = cell(sc, bay, ST.mag, 26, { h: 24, key: 'mag' });
  blk(sc, 'back', bay, x0 + 2, -14, 2, 18, 6, 8, { tone: 'mid', r: 0.5 });
  [0, 1, 2, 3].forEach((i) => blk(sc, 'back', bay, x0 + 3 + i * 4.6, -13, 10, 3.6, 4, 1.4, { tone: 'dark', cls: 'mt-magnet', r: 0.2 }));
  headAt(sc, 'front', bay, 'mag', { x: ST.mag - 3, y: -8, z: 14, w: 6, d: 6, h: 9 }, slab(ST.mag - 3, -3, 6, 6, 17, 5, { tone: 'hi', r: 0.8 }) + post(ST.mag, 0, 0.9, 12.4, 4.6, { tone: 'mid', steps: 8 }));
  // VCM assembly (coil + spring + carrier): a rotary table in a cabinet
  x0 = cell(sc, bay, ST.vcm, 28, { h: 26, key: 'vcm', roof: false });
  ADD(sc, 'back', bay, { x: ST.vcm - 8, y: -36, z: 26, w: 16, d: 16, h: 3 }, `${post(ST.vcm, -28, 8, 26, 1.4, { tone: 'hi', steps: 24 })}${L(k.ring(ST.vcm, -28, 5.4, 27.4, P, 18), { tone: 'faint' })}${D([[0, -5.6], [4, -4], [5.6, 0], [4, 4], [0, 5.6], [-4, 4], [-5.6, 0], [-4, -4]].map(([a, b]) => at(ST.vcm + a, -28 + b, 27.4)), { size: 0.55, tone: 'mid' })}`);
  headAt(sc, 'front', bay, 'vcm', { x: ST.vcm - 3, y: -20, z: 20, w: 6, d: 20, h: 10 }, slab(ST.vcm - 3, -16, 6, 6, 24, 4, { tone: 'hi', r: 0.8 }) + post(ST.vcm, -13, 0.9, 20, 4, { tone: 'mid', steps: 8 }));
  // barrel + lens stack machine: a lens-tray magazine (7 trays) and a stacking head
  x0 = cell(sc, bay, ST.stack, 34, { h: 28, key: 'stack', roof: false });
  for (let i = 0; i < 7; i++) blk(sc, 'back', bay, x0 + 3, -42, 28 + i * 1.5, 14, 14, 1.0, { tone: i % 2 ? 'hi' : 'mid', r: 0.5, steps: 2, bevel: 0.2 });
  blk(sc, 'back', bay, x0 + 20, -16, 2, 12, 8, 9, { tone: 'mid', r: 0.5, groove: 0.7 });
  headAt(sc, 'front', bay, 'stack', { x: ST.stack - 3, y: -14, z: 14, w: 6, d: 14, h: 12 }, slab(ST.stack - 3, -8, 6, 6, 18, 6, { tone: 'hi', r: 0.8 }) + post(ST.stack, -5, 1.2, 14, 4, { tone: 'dark', steps: 10, cls: 'lens' }));
  // transfer buffer into the active-alignment bay
  blk(sc, 'back', bay, ST.xfer - 11, -30, 0, 22, 16, 12, { tone: 'hi', r: 1, groove: 1 });
  blk(sc, 'back', bay, ST.xfer - 8, -16, 12, 16, 3, 2.4, { tone: 'mid', r: 0.4 });
}

// ---------------- 5. active alignment ----------------
function alignBay(sc) {
  const bay = 'aa';
  lineConveyor(sc, 714, 912, bay);
  const x0 = ST.aa - 24;
  // the hero AA cell: cabinet at the back, a portal beam above, the 6-axis stage on the line, the chart wall behind
  blk(sc, 'back', bay, x0, -44, 0, 48, 30, 24, { tone: 'hi', r: 1, groove: 1.2 });
  // chart: a tall panel on the back of the cabinet with a printed test pattern, and a collimator tube beside it
  blk(sc, 'back', bay, x0 + 3, -46, 24, 34, 2.2, 28, { tone: 'hi', r: 0.8 });
  ADD(sc, 'back', bay, { x: x0 + 3, y: -43.8, z: 24, w: 34, d: 0.1, h: 28 }, `<g class="chart">${L(faceLines(x0 + 3, x0 + 37, -43.8, 24, 52, 6, 4), { tone: 'mid' })}${L(k.pathOf([at(x0 + 3, -43.8, 24), at(x0 + 37, -43.8, 24), at(x0 + 37, -43.8, 52), at(x0 + 3, -43.8, 52)], true), { tone: 'hi' })}${[[10, 32], [30, 32], [10, 46], [30, 46], [20, 39]].map(([a, b]) => L(faceRingY(x0 + a + 3, -43.8, b, 2.4), { tone: 'lo' })).join('')}</g>`);
  ADD(sc, 'back', bay, { x: x0 + 38, y: -44, z: 24, w: 8, d: 24, h: 8 }, rollY(x0 + 42, -44, -20, 30, 3.4, 'mid', { steps: 14 }) + L(k.ring(x0 + 42, -20, 3.4, 30, P, 14), { tone: 'faint' }));
  // the stage on the line: a hexapod base ring and six legs (the live layer moves the top plate in the loupe; here it is drawn at rest)
  ADD(sc, 'back', bay, { x: ST.aa - 8, y: -8, z: BELT_Z, w: 16, d: 16, h: 2 }, post(ST.aa, 0, 7.4, BELT_Z, 1.4, { tone: 'mid', steps: 20 }));
  ADD(sc, 'front', bay, { x: ST.aa - 8, y: -8, z: BELT_Z + 0.4, w: 16, d: 16, h: 10 }, `${post(ST.aa, 0, 6.2, BELT_Z + 0.4, 1, { tone: 'mid', steps: 18 })}${[0, 1, 2, 3, 4, 5].map((i) => { const a = (i / 6) * Math.PI * 2; const b = a + 0.5; return L(sw([ST.aa + Math.cos(a) * 6.2, Math.sin(a) * 6.2, BELT_Z + 1.4], [ST.aa + Math.cos(b) * 4.6, Math.sin(b) * 4.6, BELT_Z + 9.2]), { tone: 'hi' }); }).join('')}${post(ST.aa, 0, 4.6, BELT_Z + 8, 1.2, { tone: 'hi', steps: 18 })}`);
  // portal: two front posts and a beam over the stage with the UV lamp head
  blk(sc, 'front', bay, x0 + 1.5, 22, 0, 3.2, 3.6, 38, { tone: 'mid', r: 0.5 });
  blk(sc, 'front', bay, x0 + 43.3, 22, 0, 3.2, 3.6, 38, { tone: 'mid', r: 0.5 });
  blk(sc, 'front', bay, x0, 20, 38, 48, 7, 3, { tone: 'hi', r: 0.8 });
  blk(sc, 'front', bay, ST.aa - 4, 12, 28, 8, 8, 10, { tone: 'hi', r: 0.8, groove: 0.6 });
  ADD(sc, 'front', bay, { x: ST.aa - 2, y: 14, z: 26, w: 4, d: 4, h: 3 }, `<g id="uv-lamp" class="uvlamp">${post(ST.aa, 16, 2.2, 25.6, 2.4, { tone: 'lit', steps: 12, cls: 'uv-head' })}</g>`);
  lampAt(sc, 'front', bay, 'aa', x0 + 44, -42, 24);
  // two cameras on the stage side, aimed at the lens (vision alignment)
  [[ST.aa - 12, 14], [ST.aa + 12, 14]].forEach(([cx, cy]) => { blk(sc, 'front', bay, cx - 3, cy, 12, 6, 6, 6, { tone: 'hi', r: 0.8 }); cyl(sc, 'front', bay, cx, cy - 0.5, 1.8, 14, 2.6, { tone: 'dark', cls: 'lens', steps: 10 }); });
  // parallel AA cells behind (the real line runs many machines in parallel; the number is a schematic [assumption])
  [772, 800, 828].forEach((cx, i) => {
    blk(sc, 'back', bay, cx - 12, -88, 0, 24, 28, 24, { tone: 'hi', r: 1, groove: 1 });
    blk(sc, 'back', bay, cx - 9, -60.2, 8, 18, 0.2, 10, { tone: 'faint', r: 0.4, crease: 'none' });
    D([at(cx - 8, -60.4, 21)], { size: 0.5, tone: 'mid' });
    void i;
  });
  // conveyor oven for the adhesive bake: tunnel with glow strips inside
  const ox0 = ST.oven - 22;
  blk(sc, 'back', bay, ox0, -22, 0, 44, 8, 28, { tone: 'hi', r: 1, groove: 1 });
  blk(sc, 'front', bay, ox0, 14, 0, 44, 8, 6.4, { tone: 'hi', r: 1 });
  blk(sc, 'front', bay, ox0, -22, 28, 44, 44, 3, { tone: 'hi', r: 1 });
  [0, 1, 2].forEach((i) => blk(sc, 'front', bay, ox0 + 4 + i * 13, -18, 31, 10, 36, 3.4, { tone: 'mid', r: 0.6, groove: 0.7 }));
  ADD(sc, 'front', bay, { x: ox0, y: -12, z: 12, w: 44, d: 0.1, h: 10 }, `<g id="glow-oven" class="glow">${[0, 1, 2, 3, 4].map((i) => L(sw([ox0 + 5 + i * 8, -10, 24], [ox0 + 9 + i * 8, -10, 24]) + sw([ox0 + 5 + i * 8, 10, 24], [ox0 + 9 + i * 8, 10, 24]), { tone: 'lit', free: true })).join('')}</g>`);
  lampAt(sc, 'front', bay, 'oven', ox0 + 40, -20, 34);
}

// ---------------- 6. calibration + test ----------------
function testBay(sc) {
  const bay = 'test';
  lineConveyor(sc, 920, 1118, bay);
  // OIS/AF calibration (a shaker table and a laser), vibration/shake, MTF light box, OTP programmer, AVI camera
  let x0 = cell(sc, bay, ST.cal, 30, { h: 24, key: 'cal' });
  blk(sc, 'back', bay, x0 + 3, -14, 2, 24, 6, 5, { tone: 'mid', r: 0.5 });
  cyl(sc, 'back', bay, ST.cal + 6, -34, 3, 24, 5, { tone: 'dark', cls: 'lens', steps: 12 });
  x0 = cell(sc, bay, ST.shake, 30, { h: 24, key: 'shake' });
  blk(sc, 'back', bay, x0 + 3, -14, 2, 24, 6, 5, { tone: 'mid', r: 0.5 });
  blk(sc, 'back', bay, x0 + 5, -32, 24, 20, 14, 4, { tone: 'mid', r: 0.8, groove: 0.8 });
  x0 = cell(sc, bay, ST.optic, 32, { h: 30, key: 'optic' });
  // MTF / shading light box: a white-panel box and a dome
  blk(sc, 'back', bay, x0 + 4, -42, 30, 24, 20, 6, { tone: 'hi', r: 1.5, steps: 5 });
  ADD(sc, 'back', bay, { x: ST.optic - 6, y: -22, z: 36, w: 12, d: 12, h: 6 }, post(ST.optic, -16, 6, 36, 1.2, { tone: 'lit', steps: 20 }) + L(k.ring(ST.optic, -16, 3.6, 37.2, P, 14), { tone: 'faint' }));
  x0 = cell(sc, bay, ST.otp, 26, { h: 24, key: 'otp' });
  blk(sc, 'back', bay, x0 + 3, -40, 24, 12, 8, 6, { tone: 'hi', r: 0.8, groove: 0.6 });
  x0 = cell(sc, bay, ST.avi, 28, { h: 26, key: 'avi' });
  cyl(sc, 'front', bay, ST.avi, 0, 4.2, 26, 3, { tone: 'hi', steps: 18 });
  cyl(sc, 'front', bay, ST.avi, 0, 2.4, 29, 3.4, { tone: 'dark', cls: 'lens', steps: 14 });
  // a back row of test cabinets: the real test hall is a long row of identical cells (count not public: schematic)
  for (let i = 0; i < 8; i++) {
    const x = 930 + i * 22;
    blk(sc, 'back', bay, x, -88, 0, 18, 22, 20, { tone: 'hi', r: 0.8, groove: 0.9 });
    blk(sc, 'back', bay, x + 3, -66.2, 8, 12, 0.2, 7, { tone: 'faint', r: 0.3, crease: 'none' });
  }
}

// ---------------- 7. pack ----------------
function packBay(sc) {
  const bay = 'pack';
  lineConveyor(sc, 1118, 1262, bay);
  // tray loader: a stack of ESD trays and a pick head
  let x0 = cell(sc, bay, ST.tray, 30, { h: 22, key: 'tray', roof: false });
  for (let i = 0; i < 6; i++) blk(sc, 'back', bay, x0 + 4, -42, 22 + i * 1.6, 16, 14, 1.2, { tone: i % 2 ? 'hi' : 'mid', r: 0.6, steps: 2, bevel: 0.2 });
  headAt(sc, 'front', bay, 'tray', { x: ST.tray - 3, y: -10, z: 14, w: 6, d: 8, h: 9 }, slab(ST.tray - 3, -3, 6, 6, 17, 5, { tone: 'hi', r: 0.8 }) + post(ST.tray, 0, 0.9, 12.4, 4.6, { tone: 'mid', steps: 8 }));
  // vacuum bag sealer
  x0 = cell(sc, bay, ST.bag, 28, { h: 22, key: 'bag' });
  headAt(sc, 'front', bay, 'bag', { x: ST.bag - 8, y: -4, z: 14, w: 16, d: 8, h: 6 }, slab(ST.bag - 8, -4, 16, 8, 15, 4, { tone: 'hi', r: 0.8, groove: 0.7 }));
  // carton station: a carton former behind and a roller conveyor
  x0 = cell(sc, bay, ST.carton, 30, { h: 22, key: 'carton', roof: false });
  [0, 1, 2].forEach((i) => blk(sc, 'back', bay, x0 + 3 + i * 8, -42, 22, 7, 14, 6, { tone: 'hi', r: 0.5, groove: 0.5 }));
  // pallet of finished cartons waiting for the truck
  [0, 1].forEach((i) => [0, 1].forEach((j) => blk(sc, 'back', bay, 1196 + i * 14, -80 + j * 12, 0, 12, 10, 8, { tone: 'hi', r: 0.5, groove: 0.7 })));
}

// ---------------- 8. loading dock ----------------
function dockBay(sc) {
  const bay = 'dock';
  lineConveyor(sc, 1262, 1330, bay);
  // dock wall with a roller door, a leveller plate and two bollards
  blk(sc, 'back', bay, 1272, -92, 0, 88, 3, 46, { tone: 'hi', r: 0.8 });
  blk(sc, 'back', bay, 1296, -92.6, 0, 40, 0.8, 34, { tone: 'mid', r: 0.3, groove: 1 });
  blk(sc, 'back', bay, 1330, -14, 0, 28, 28, 5, { tone: 'mid', r: 0.8, groove: 0.8 });
  [-20, 22].forEach((y) => cyl(sc, 'front', bay, 1362, y, 1.8, 0, 8, { tone: 'hi', steps: 10 }));
}

// ---------------- the truck (two halves so the carrier can ride between them) ----------------
export const TRUCK_X = TRUCK.x1; // the drawn position; the live layer translates it by (state.truck.x - TRUCK_X)
export function truckSvg() {
  const x = TRUCK_X;
  const fl = BELT_Z - 1.2;
  const back = [
    slab(x - 36, -12, 72, 38, fl - 1.6, 1.6, { tone: 'mid', r: 1 }),
    slab(x - 36, -12.6, 72, 1.6, fl, 24, { tone: 'hi', r: 0.8, groove: 0.8, crease: 'faint' }),
    slab(x + 34.4, -12, 1.8, 38, fl, 24, { tone: 'hi', r: 0.6, groove: 0.6 }),
    slab(x + 38, -10, 18, 34, fl - 1.6, 16.6, { tone: 'hi', r: 3, steps: 4, bevel: 0.6, groove: 1 }),
    slab(x + 46, -9.4, 9.6, 32.8, fl + 15, 2.2, { tone: 'mid', r: 2, steps: 3 }),
    rollY(x - 22, -13, -10, 3.6, 3.6, 'dark', { cls: 'tire', steps: 18 }), rollY(x + 24, -13, -10, 3.6, 3.6, 'dark', { cls: 'tire', steps: 18 }), rollY(x + 48, -13, -10, 3.6, 3.6, 'dark', { cls: 'tire', steps: 18 }),
  ];
  const front = [
    slab(x - 36, 25.4, 72, 1.6, fl, 4, { tone: 'hi', r: 0.6, groove: 0.5 }),
    rollY(x - 22, 24, 27, 3.6, 3.6, 'dark', { cls: 'tire', steps: 18 }), rollY(x + 24, 24, 27, 3.6, 3.6, 'dark', { cls: 'tire', steps: 18 }), rollY(x + 48, 24, 27, 3.6, 3.6, 'dark', { cls: 'tire', steps: 18 }),
  ];
  // roller door at the rear (drawn as a curtain that slides up: scaleY by the live layer through the group's own transform)
  const door = slab(x - 37.6, -12, 1.4, 38, fl, 24, { tone: 'mid', r: 0.4, groove: 0.6 });
  return { back: `<g id="truck-b">${back.join('')}<g id="truck-door">${door}</g></g>`, front: `<g id="truck-f">${front.join('')}</g>` };
}

// ---------------- clean-room envelope ----------------
function cleanRoom(sc) {
  const bay = 'clean';
  const { x0, x1, ceil } = CLEAN;
  const y0 = -92;
  const y1 = 92;
  // floor tint (the whole clean zone) and the core outline (the Class 10 core: die bond to AA)
  ADD(sc, 'back', bay, { x: x0, y: y0, z: -0.5, w: x1 - x0, d: y1 - y0, h: 0.6 }, `<g class="crfloor">${slab(x0, y0, x1 - x0, y1 - y0, -0.5, 0.6, { tone: 'faint', r: 1, steps: 3, bevel: 0, crease: 'none', cls: 'crfloor-solid' })}</g>`);
  const c0 = CLEAN_CORE.x0;
  const c1 = CLEAN_CORE.x1;
  ADD(sc, 'back', bay, { x: c0, y: -90, z: 0.1, w: c1 - c0, d: 180, h: 0.1 }, `<g class="corefloor">${L(k.pathOf([at(c0, -90, 0.2), at(c1, -90, 0.2), at(c1, 90, 0.2), at(c0, 90, 0.2)], true), { tone: 'lit', dashed: true })}</g>`);
  // back wall: panels with seams and a few windows; left and right walls with the pass-through openings
  const seams = [];
  for (let x = x0 + 12; x < x1; x += 12) seams.push(sw([x, y0, 0], [x, y0, ceil]));
  ADD(sc, 'back', bay, { x: x0, y: y0 - 2, z: 0, w: x1 - x0, d: 2, h: ceil }, slab(x0, y0 - 2, x1 - x0, 2, 0, ceil, { tone: 'faint', r: 0.4, crease: 'faint', cls: 'crwall' }) + L(seams.join(''), { tone: 'faint' }));
  const wall = (x, y, w, d, z, h) => blk(sc, 'back', bay, x, y, z, w, d, h, { tone: 'faint', r: 0.3, crease: 'none', cls: 'crwall' });
  wall(x0 - 2, y0 - 2, 2, 90 - 10 + 2, 0, ceil); // left wall, back part (up to the pass-through at |y| < 10)
  wall(x1, y0 - 2, 2, 90 - 10 + 2, 0, ceil);
  wall(x0 - 2, -10, 2, 20, 28, ceil - 28); // lintels above the pass-throughs
  wall(x1, -10, 2, 20, 28, ceil - 28);
  [x0 - 2, x1].forEach((wx) => blk(sc, 'front', bay, wx, 10, 0, 2, 82, ceil, { tone: 'faint', r: 0.3, crease: 'none', cls: 'crwall' }));
  // the front stays open to see inside: a low curb, a gowning door gap at x 198..222, and corner columns
  [[x0, 198], [222, x1]].forEach(([a, b]) => blk(sc, 'front', bay, a, 90, 0, b - a, 2, 3, { tone: 'mid', r: 0.4, crease: 'none' }));
  [x0 - 2, 400, 660, x1].forEach((cx) => blk(sc, 'front', bay, cx, 90, 0, 2.4, 2.4, ceil, { tone: 'faint', r: 0.3, crease: 'none' }));
  blk(sc, 'front', bay, x0 - 2, 90, ceil - 2, x1 - x0 + 4, 2.4, 2, { tone: 'mid', r: 0.3, crease: 'none' });
  // ceiling: a rail along the back, then a grid of fan-filter units (FFU) drawn as small parts
  blk(sc, 'back', bay, x0 - 2, y0 - 2, ceil, x1 - x0 + 4, 12, 2, { tone: 'mid', r: 0.3, crease: 'none' });
  for (let i = 0, x = x0 + 4; x + 10 <= x1; i++, x += 16) {
    [-86, -70].forEach((fy) => ADD(sc, 'back', bay, { x, y: fy, z: ceil - 2.4, w: 10, d: 10, h: 2.4 },
      slab(x, fy, 10, 10, ceil - 2.4, 2.4, { tone: 'hi', r: 0.5, steps: 2, bevel: 0.15, crease: 'faint', cls: 'ffu' }) + L(sw([x, fy + 3, ceil], [x + 10, fy + 3, ceil]) + sw([x, fy + 5, ceil], [x + 10, fy + 5, ceil]) + sw([x, fy + 7, ceil], [x + 10, fy + 7, ceil]), { tone: 'faint' })));
    void i;
  }
  // pass-throughs: material chambers with a door at each wall crossing the line
  [[x0 - 8, 'in'], [x1 - 6, 'out']].forEach(([px, side]) => {
    blk(sc, 'back', bay, px, -12, 0, 14, 8, 24, { tone: 'hi', r: 0.8, groove: 0.8 });
    blk(sc, 'front', bay, px, 10, 0, 14, 3, 6, { tone: 'hi', r: 0.8 });
    blk(sc, 'front', bay, px, -12, 24, 14, 25, 2.4, { tone: 'hi', r: 0.8 });
    void side;
  });
}

// ---------------- robots ----------------
function robots(sc) {
  ROBOTS.forEach((r) => {
    ADD(sc, 'back', r.bay, { x: r.x - 6, y: r.y - 6, z: 0, w: 12, d: 12, h: 24 }, robotBase(r.x, r.y, { pedestal: r.pedestal }));
    ADD(sc, 'front', r.bay, { x: r.x - 24, y: r.y - 8, z: 0, w: 48, d: 62, h: 46 }, `<g id="arm-${r.id}" class="arm"></g>`);
  });
}

export function buildStatic2(sc) {
  lensBay(sc);
  alignBay(sc);
  testBay(sc);
  packBay(sc);
  dockBay(sc);
  cleanRoom(sc);
  robots(sc);
  return sc;
}
export { tag, rollX, S };
