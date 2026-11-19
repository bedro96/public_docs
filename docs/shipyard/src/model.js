// Pure model of the shipyard and the ship. No DOM, no kit: everything the page shows as a number
// (and everything that moves) is computed here, so the figure, the cards and the tests agree.
// 1 world unit = about 1 metre horizontally. The drawing is schematic, so heights are exaggerated.

export const M = {
  seaWater: 1.025,              // t/m3
  g: 9.81,
};

// ---- the yard layout (world units on the floor, z up) --------------------------------------------
export const LAYOUT = {
  plate: { x: 0, y: 0, w: 820, d: 462 },
  seaLevel: -6,                 // z of the sea / flooded dock surface
  floor: -36,                   // z of the dock floor
  dock: { x0: 120, x1: 470, y0: 392, y1: 462 },
  keelH: 6,                     // keel blocks
  rowY: [10, 130],              // the shop row lies between these y
  shops: {
    warehouse: { x: 10, y: 10, w: 100, d: 120, h: 40 },
    cutting:   { x: 120, y: 10, w: 95, d: 120, h: 34 },
    welding:   { x: 225, y: 10, w: 95, d: 120, h: 40 },
    assembly:  { x: 330, y: 10, w: 110, d: 120, h: 52 },
    painting:  { x: 450, y: 10, w: 100, d: 120, h: 40 },
  },
  pad: { x: 455, y: 318 },      // where the painted block waits for the crane
  lane: { x: 500 },
  craneZ: 128,                  // girder height
  gantry: { yN: 380, yS: 458, yCant: 296, x0: 130, x1: 462 },
  mooring: { dx: 340 },         // the float-out distance from the dock to the quay berth
};

// ---- the hull in the dock: six blocks ------------------------------------------------------------
export const HULL = {
  length: 280, beam: 40, height: 34, draftUnits: 9,
  x0: 160,                      // stern end in the dock
  cuts: [0, 46, 92, 138, 184, 232, 280],      // block borders along the ship
  names: [
    { kr: '선미 블록', en: 'Stern block' },
    { kr: '기관실 블록', en: 'Engine-room block' },
    { kr: '화물창 블록 1', en: 'Hold block 1' },
    { kr: '화물창 블록 2', en: 'Hold block 2' },
    { kr: '화물창 블록 3', en: 'Hold block 3' },
    { kr: '선수 블록', en: 'Bow block' },
  ],
  // The drawing shows SIX representative blocks. A real 300 m ship is built from ~120 blocks of 300-900 t each,
  // so these six masses are "one typical block of that kind" and deliberately do NOT add up to the lightship mass.
  realBlocks: 120,
  tonnes: [640, 880, 760, 760, 760, 560],
  craneCapacity: 900,
};
export const BLOCKS = HULL.cuts.slice(0, -1).map((a, i) => ({
  i, a, b: HULL.cuts[i + 1], len: HULL.cuts[i + 1] - a, mid: (a + HULL.cuts[i + 1]) / 2, tonnes: HULL.tonnes[i],
}));

// ---- stages of "build the ship" ------------------------------------------------------------------
export const STAGE_SECONDS = [9, 9, 9, 9, 15, 16, 14];
export const STAGE_FOCUS = ['cutting', 'welding', 'assembly', 'painting', 'dock', 'dock', 'quay'];

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const sm = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const seg = (u, a, b) => sm((u - a) / (b - a));      // 0 before a, 1 after b, smooth between
export const lerp = (a, b, t) => a + (b - a) * t;
export const follow = (cur, target, dt, tau) => target + (cur - target) * Math.exp(-Math.max(0, dt) / tau);

// ---- dock flooding: true physics ----------------------------------------------------------------
export const DOCK = {
  length: 350, width: 62, depth: 14,           // m, inner basin; depth = water depth when flooded
  inflow: 12,                                   // m3/s through the filling culverts
  lightship: 38000,                             // t, hull at launch
  cb: 0.62, loa: 300, beam: 42.8,
};
export const dockVolume = () => DOCK.length * DOCK.width * DOCK.depth;
export const floodHours = () => dockVolume() / DOCK.inflow / 3600;
export const lightDraft = () => DOCK.lightship / (M.seaWater * DOCK.cb * DOCK.loa * DOCK.beam);
/** level (m of water above the dock floor) after fraction f of the filling time */
export const levelAt = (f) => clamp(f) * DOCK.depth;
/** the hull floats when the water is as deep as its draft plus the keel blocks (1.5 m) */
export const floatLevel = () => lightDraft() + 1.5;
export const floatFraction = () => floatLevel() / DOCK.depth;

// ---- the crane cycle for one block ---------------------------------------------------------------
export const slotX = (i) => HULL.x0 + BLOCKS[i].mid;
export const slotY = () => (LAYOUT.dock.y0 + LAYOUT.dock.y1) / 2;
export const slotZ = () => LAYOUT.floor + LAYOUT.keelH;
export const REST_GX = 300;
/**
 * Where the crane and the block are in cycle phase c (0..1) for block i.
 * gx/ty are the world x and y of the hook, hz the height of the hook, and
 * load is the world position of the block's base centre (or null while it waits / sits in its slot).
 */
export function craneCycle(i, c) {
  const prevGx = i === 0 ? REST_GX : slotX(i - 1);
  const padX = LAYOUT.pad.x, padY = LAYOUT.pad.y;
  const sx = slotX(i), sy = slotY(), sz = slotZ();
  const TOP = 40;                        // block height ~ 34 + slings
  const clear = 24;                      // base height while carrying (clears the placed hull, top at +4)
  const a = seg(c, 0.0, 0.2);            // travel to the pad
  const b = seg(c, 0.2, 0.3);            // lift
  const d = seg(c, 0.3, 0.62);           // carry
  const e = seg(c, 0.62, 0.84);          // lower
  const f = seg(c, 0.84, 1.0);           // release and rise
  let gx, ty, hook, load = null, phase;
  if (c < 0.2) {
    gx = lerp(prevGx, padX, a); ty = lerp(slotY(), padY, a); hook = lerp(LAYOUT.craneZ - 22, TOP + 14, a); phase = 'travel';
    load = [padX, padY, 0];
  } else if (c < 0.3) {
    gx = padX; ty = padY; hook = lerp(TOP + 14, clear + TOP + 14, b); phase = 'lift';
    load = [padX, padY, lerp(0, clear, b)];
  } else if (c < 0.62) {
    gx = lerp(padX, sx, d); ty = lerp(padY, sy, d); hook = clear + TOP + 14; phase = 'carry';
    load = [gx, ty, clear];
  } else if (c < 0.84) {
    gx = sx; ty = sy; hook = lerp(clear, sz, e) + TOP + 14; phase = 'lower';
    load = [sx, sy, lerp(clear, sz, e)];
  } else {
    gx = sx; ty = sy; hook = lerp(sz + TOP + 14, LAYOUT.craneZ - 22, f); phase = 'release';
    load = [sx, sy, sz];
  }
  return { gx, ty, hook, load, phase };
}

// ---- where a work piece waits inside a shop, and how it travels between shops (out of the door, along the apron) ----
export const APRON_Y = 140;
export const inside = (k) => ({ x: LAYOUT.shops[k].x + (k === 'welding' ? 40 : LAYOUT.shops[k].w / 2), y: LAYOUT.shops[k].y + LAYOUT.shops[k].d * 0.52 });
/** point at fraction t (0..1) along the route a -> apron -> apron -> b, as {x, y} */
export function route(a, b, t) {
  const pts = [[a.x, a.y], [a.x, APRON_Y], [b.x, APRON_Y], [b.x, b.y]];
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = len[len.length - 1] * clamp(t);
  let i = 1;
  while (i < pts.length - 1 && len[i] < L) i++;
  const f = (L - len[i - 1]) / ((len[i] - len[i - 1]) || 1);
  return { x: lerp(pts[i - 1][0], pts[i][0], f), y: lerp(pts[i - 1][1], pts[i][1], f) };
}

// ---- the yard at a given stage and progress -------------------------------------------------------
/**
 * Target state of the whole yard at stage s (0..6) and progress u (0..1).
 * The live code eases what is drawn toward this, so a jump (Next / Prev) glides.
 */
export function yardAt(s, u) {
  u = clamp(u);
  const Y = {
    stage: s, u,
    wp: { form: 'none', x: 0, y: 0, z: 0, paint: 0, show: 0 },   // the work piece token
    torch: { on: 0, x: 0, y: 0 },                                  // cutting torch, 0..1 along the plate
    weld: 0,                                                       // 0..1 welding robot active
    spray: 0, blast: 0,
    crane: { gx: REST_GX, ty: slotY(), hook: LAYOUT.craneZ - 22, load: null, phase: 'idle' },
    placed: 0, active: -1, cycle: 0,
    water: 0, ship: { dx: 0, dz: 0, op: 1 }, gate: 0, house: 0, jib: 0,
    sail: 0, shipShow: s >= 4,
    spmt: { x: 0, y: 0, show: 0 },
    readout: {},
  };
  const SH = LAYOUT.shops;
  const at = (a, b, t) => { const q = route(a, b, t); return { x: q.x, y: q.y }; };
  if (s === 0) {                                  // materials -> cutting
    const w = inside('warehouse'), c = inside('cutting');
    const t = seg(u, 0.04, 0.4);
    Y.wp = { form: 'plate', ...at(w, c, t), z: 5, paint: 0, show: 1 };
    Y.torch = { on: seg(u, 0.45, 0.5) * (1 - seg(u, 0.93, 0.97)), x: seg(u, 0.5, 0.93), y: 0 };
    Y.readout = { plateMm: 25, cutM: Math.round(seg(u, 0.5, 0.93) * 12 * 10) / 10 };
  } else if (s === 1) {                           // welding shop
    const c = inside('cutting'), w = inside('welding');
    const t = seg(u, 0.0, 0.25);
    Y.wp = { form: u < 0.3 ? 'plate' : 'panel', ...at(c, w, t), z: 5, paint: 0, show: 1 };
    Y.weld = seg(u, 0.3, 0.36) * (1 - seg(u, 0.92, 0.97));
    Y.readout = { weldM: Math.round(seg(u, 0.35, 0.93) * 24 * 10) / 10 };
  } else if (s === 2) {                           // assembly shop
    const w = inside('welding'), a = inside('assembly');
    const t = seg(u, 0.0, 0.2);
    Y.wp = { form: u < 0.45 ? 'panel' : u < 0.75 ? 'sub' : 'block', ...at(w, a, t), z: 5, paint: 0, show: 1 };
    Y.readout = { subs: Math.round(seg(u, 0.25, 0.75) * 3) };
  } else if (s === 3) {                           // painting shop
    const a = inside('assembly'), p = inside('painting');
    const t = seg(u, 0.0, 0.2);
    Y.wp = { form: 'block', ...at(a, p, t), z: 5, paint: seg(u, 0.55, 0.85), show: 1 };
    Y.blast = seg(u, 0.25, 0.3) * (1 - seg(u, 0.5, 0.55));
    Y.spray = seg(u, 0.55, 0.6) * (1 - seg(u, 0.85, 0.9));
    Y.readout = { stage: u < 0.55 ? 'blast' : u < 0.85 ? 'coat' : 'dry', um: Math.round(seg(u, 0.55, 0.85) * 300) };
  } else if (s === 4) {                           // block erection in the dry dock
    const N = BLOCKS.length;
    const x = u * N, i = Math.min(N - 1, Math.floor(x)), c = x - i;
    Y.shipShow = true;
    Y.placed = i + (c >= 0.84 ? 1 : 0);
    Y.active = c >= 0.84 ? -1 : i;
    Y.cycle = c;
    const cc = craneCycle(i, c);
    Y.crane = cc; Y.crane.i = i;
    if (u >= 0.999) { Y.placed = N; Y.active = -1; }
    Y.wp = { form: 'none', x: 0, y: 0, z: 0, paint: 1, show: 0 };
    Y.readout = { block: Math.min(N, i + 1), tonnes: BLOCKS[i].tonnes, phase: cc.phase, placed: Y.placed };
  } else if (s === 5) {                           // flood and launch
    Y.placed = BLOCKS.length; Y.shipShow = true;
    const f = seg(u, 0.04, 0.58);
    Y.water = f;
    const lvl = levelAt(f);
    const lift = clamp((lvl - floatLevel()) / (DOCK.depth - floatLevel()));   // 0..1 of the way up
    Y.ship.dz = lift * (LAYOUT.seaLevel - (LAYOUT.floor + LAYOUT.keelH + HULL.draftUnits));
    Y.gate = seg(u, 0.6, 0.68);
    const out = seg(u, 0.7, 0.99);
    Y.ship.dx = out * LAYOUT.mooring.dx;
    Y.crane = { gx: REST_GX, ty: slotY(), hook: LAYOUT.craneZ - 22, load: null, phase: 'park' };
    Y.readout = { levelM: lvl, hours: f * floodHours(), floats: lvl >= floatLevel(), out };
  } else {                                        // quay outfitting, sea trials
    Y.placed = BLOCKS.length; Y.shipShow = true; Y.water = 1; Y.gate = 1;
    Y.ship.dx = LAYOUT.mooring.dx; Y.ship.dz = LAYOUT.seaLevel - (LAYOUT.floor + LAYOUT.keelH + HULL.draftUnits);
    Y.house = seg(u, 0.08, 0.5);                  // deckhouse lowered onto the ship by the quay crane
    Y.jib = Y.house;
    const sail = seg(u, 0.6, 0.99);
    Y.sail = sail;
    Y.ship.dx += sail * 330;
    Y.ship.op = 1 - seg(u, 0.82, 0.98);
    Y.readout = { house: Y.house, sail, knots: 22 * sail };
  }
  return Y;
}

// ---- the ship: numbers that move the figure and appear on cards ----------------------------------
export const SHIP = {
  kind: { kr: '컨테이너선', en: 'Container ship' },
  loa: 300, beam: 42.8, depth: 24.5, teu: 8000,
  designSpeed: 22,               // knots at full power
  mcr: 40000,                    // kW, main engine maximum continuous rating
  mcrRpm: 90,                    // rpm, direct drive (no gearbox)
  cyl: 7, bore: 0.8,             // m
  propD: 9.0, blades: 5,
  gens: 3, genKw: 2400, emerKw: 400, volts: 6600, hz: 60,
  radarRpm: 24,
  doubleBottom: 2.2,             // m
  frame: 0.85,                   // m frame spacing
  ballastT: 24000,               // t ballast capacity
  visualSlow: 6,                 // propeller is shown 6x slower than real so the eye can follow
};
/** speed in knots at a power fraction (admiralty cube law: power ~ speed^3) */
export const speedAt = (pf) => SHIP.designSpeed * Math.cbrt(clamp(pf, 0, 1.2));
/** propeller rpm at a power fraction (propeller law: power ~ rpm^3) */
export const rpmAt = (pf) => SHIP.mcrRpm * Math.cbrt(clamp(pf, 0, 1.2));
export const tipSpeed = (rpm) => Math.PI * SHIP.propD * rpm / 60;       // m/s
export const radarPeriod = () => 60 / SHIP.radarRpm;                      // s per sweep
export const genLoadKw = (pf) => Math.round(1200 + 3400 * clamp(pf, 0, 1));
export const draftOf = (tonnes) => tonnes / (M.seaWater * DOCK.cb * SHIP.loa * SHIP.beam);
/** draft with the ballast tanks filled by fraction b (launch condition + ballast water) */
export const ballastDraft = (b) => draftOf(DOCK.lightship + SHIP.ballastT * clamp(b));
export const ballastTonnes = (b) => Math.round(SHIP.ballastT * clamp(b));

export const SHIP_ZLIFT = { hull: 0, piping: 10, cargo: 30, engine: 24, electrical: 50, house: 56, nav: 80 };   // same numbers as V.lift in geo-vessel.js
export const explodeLift = (layer, e) => (SHIP_ZLIFT[layer] || 0) * clamp(e);
