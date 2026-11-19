// The pure model: every number, pose and flag on screen is a function of one progress value u in [0, 8)
// (stage = floor(u), local progress f = fraction). No DOM, no clock: the same function runs in the browser and in the tests.
// Two things are animated from it: the plant (the carrier tray, people, machines) and the loupe (the magnified module,
// the alignment rig, the phone). Numbers marked [estimate]/[assumption] are drawn for illustration, not measured.
import { PARTS, PART_COUNT, PART_INDEX } from './parts.js';
import { STAGES } from './data.js';
import { ST, GOWN, GOWN_DOOR, ROBOTS, TRUCK } from './layout.js';

export const STAGE_COUNT = 8;
export const STAGE_IDS = ['intake', 'smt', 'bond', 'lens', 'align', 'test', 'pack', 'phone'];
// seconds each stage takes in Play (alignment and the finale have the most to show)
export const STAGE_SECONDS = [9, 10, 12, 13, 20, 14, 10, 20];
// the last reachable progress value (just short of 8 so floor(u) stays a valid stage index)
export const END_U = STAGE_COUNT - 1e-4;

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smooth = (t) => t * t * (3 - 2 * t);
export const seg = (f, a, b) => smooth(clamp((f - a) / (b - a)));
export const lerp = (a, b, t) => a + (b - a) * t;
// piecewise-smooth path through [f, value] pairs
export const track = (f, pts) => {
  if (f <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (f <= pts[i][0]) return lerp(pts[i - 1][1], pts[i][1], smooth((f - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0])));
  }
  return pts[pts.length - 1][1];
};

// Where the tour is after `dt` more seconds of Play, starting from u. Time is spent stage by stage at each stage's own pace,
// so a long frame gap that crosses a boundary between stages of different durations still lands where a smooth run would.
export function advanceTour(u, dt) {
  let left = Math.max(0, dt);
  let x = clamp(u, 0, END_U);
  while (left > 0 && x < END_U) {
    const st = Math.min(STAGE_COUNT - 1, Math.floor(x));
    const toEnd = (st + 1 - x) * STAGE_SECONDS[st];
    if (left < toEnd) { x += left / STAGE_SECONDS[st]; left = 0; } else { x = st + 1; left -= toEnd; }
  }
  return Math.min(x, END_U);
}

// ------------------------------------------------------------------ constants shown on the page
export const WIRES = 88; // bond wires per module [estimate]; the 2015 G4 module had 104 bond points [verified]
export const PLACE_PANEL = 600; // parts placed per 25-up panel: 24 per module x 25 [estimate]
export const PANEL_UP = 25; // modules per panel [verified, G4 2015]
export const PHONE = { l: 149.6, w: 71.5, t: 8.25 }; // iPhone 16 Pro class [verified]
export const MODULE_MM = 15; // module body footprint [estimate]
// active alignment: all values are derived estimates, the exaggeration is for the eye only
export const AA = {
  dof: 4.3, // depth of focus in um at f/1.78 [estimate]
  tiltTol: 0.04, // degrees [estimate]
  peakC: 72, // illustrative centre MTF in percent [assumption]
  peakK: 48, // illustrative corner MTF in percent [assumption]
  imageH: 6.1, // corner image height in mm [estimate]
  exT: 60, // translation exaggeration: 1 um is drawn as 0.06 mm
  exR: 60, // tilt exaggeration: 1 arcmin is drawn as 1 degree
  e0: { x: 12, y: -9, z: 28, tx: 3.2, ty: -2.4, tz: 0.8 }, // starting misplacement: um, um, um, arcmin, arcmin, arcmin
  resid: 0.25, // um of residual focus error after alignment
};
export const HOVER = 16; // mm the lens sub-assembly hovers above the sensor module while it is built and carried
export const GOOD0 = 1000;
export const FUNNEL = STAGES[5].funnel.map((s) => ({ ...s, y: s.y / 100 }));
export const YIELD = FUNNEL.reduce((a, s) => a * s.y, 1); // about 0.93 [estimate]
export const BAKE_C = 70; // oven set point in C, inside the vendor's 45-80 C range
export const REFLOW_C = 250; // [estimate]
export const CURE_C = 135; // die-attach cure, inside 120-150 C [estimate]
export const GOWN_MIN = 5.5; // minutes the entry routine takes (public: more than 5) [verified, secondary]

// ------------------------------------------------------------------ the loupe: module build state
function exploded(f) {
  // the bill of materials: every part appears in assembly order, lifted by its own explode distance, then folds away
  const a = seg(f, 0.0, 0.36);
  const fold = seg(f, 0.84, 0.97);
  // the bond wires are hair-thin and their ends only land while the sensor and board outlines are solid: they fold first
  const foldWire = seg(f, 0.84, 0.88);
  return PARTS.map((p) => {
    const o = clamp(a * PART_COUNT - p.n, 0, 1) * (1 - (p.id.startsWith('wire') ? foldWire : fold));
    return { o, dx: p.bdx, dy: 0, dz: p.bz };
  });
}

function builtParts(stage, f) {
  if (stage === 0) return exploded(f);
  return PARTS.map((p) => {
    if (p.st < stage) return { o: 1, dx: 0, dy: 0, dz: 0 };
    if (p.st > stage) return { o: 0, dx: p.from[0], dy: p.from[1], dz: p.from[2] };
    const t = seg(f, p.f[0], p.f[1]);
    const inv = 1 - t;
    return { o: clamp(t * 3), dx: p.from[0] * inv, dy: p.from[1] * inv, dz: p.from[2] * inv };
  });
}

// the lens-VCM sub-assembly is built hovering above the sensor module, then lowered by the aligner
function lensGroupPose(stage, f, aa) {
  const z = { dx: 0, dy: 0, dz: 0, tx: 0, ty: 0, tz: 0 };
  if (stage === 3) return { ...z, dz: HOVER };
  if (stage !== 4) return z;
  const down = seg(f, 0.0, 0.1);
  const base = HOVER * (1 - down);
  return {
    dx: (aa.err.x * AA.exT) / 1000,
    dy: (aa.err.y * AA.exT) / 1000,
    dz: base + (aa.err.z * AA.exT) / 1000,
    tx: (aa.err.tx * AA.exR) / 60, // arcmin x 60 / 60 = degrees drawn
    ty: (aa.err.ty * AA.exR) / 60,
    tz: (aa.err.tz * AA.exR) / 60,
  };
}

// ------------------------------------------------------------------ active alignment
const CORNERS = [['tl', -1, 1], ['tr', 1, 1], ['bl', -1, -1], ['br', 1, -1]];
const ARC = 2.909e-4; // radians per arcmin
export function aaErr(f) {
  const ez = seg(f, 0.12, 0.34);
  const et = seg(f, 0.3, 0.48);
  const el = seg(f, 0.44, 0.58);
  // the focus sweep overshoots on both sides while it settles; tilt and lateral follow
  const swing = Math.sin(ez * Math.PI * 3) * (1 - ez) * 10;
  const e0 = AA.e0;
  return {
    z: e0.z * (1 - ez) + swing + AA.resid * ez,
    tx: e0.tx * (1 - et) + Math.sin(et * Math.PI * 2) * (1 - et) * 0.6,
    ty: e0.ty * (1 - et) + Math.sin(et * Math.PI * 2) * (1 - et) * -0.5,
    x: e0.x * (1 - el),
    y: e0.y * (1 - el),
    tz: e0.tz * (1 - el),
  };
}
export function mtfOf(err) {
  const lat = Math.exp(-(((err.x * err.x) + (err.y * err.y)) / (60 * 60)));
  const c = AA.peakC * Math.exp(-((err.z / AA.dof) ** 2)) * lat;
  const R = (AA.imageH * 1000) / Math.SQRT2;
  const out = { c, corners: {}, dc: Math.abs(err.z) };
  let worst = 1e9;
  let dmax = Math.abs(err.z);
  CORNERS.forEach(([id, sx, sy]) => {
    const d = err.z + R * ARC * (err.ty * sx + err.tx * sy);
    const m = AA.peakK * Math.exp(-((d / AA.dof) ** 2)) * lat;
    out.corners[id] = m;
    worst = Math.min(worst, m);
    dmax = Math.max(dmax, Math.abs(d));
  });
  out.k = worst;
  out.focusErr = dmax;
  return out;
}

function aaPhase(f) {
  if (f < 0.1) return 'load';
  if (f < 0.55) return 'search';
  if (f < 0.62) return 'dispense';
  if (f < 0.7) return 'uv';
  if (f < 0.76) return 'verify';
  if (f < 0.97) return 'bake';
  return 'release';
}

function aaOf(stage, f) {
  const base = stage < 4 ? { x: AA.e0.x, y: AA.e0.y, z: AA.e0.z, tx: AA.e0.tx, ty: AA.e0.ty, tz: AA.e0.tz } : stage > 4 ? { x: 0, y: 0, z: AA.resid, tx: 0, ty: 0, tz: 0 } : aaErr(f);
  const mtf = mtfOf(base);
  const ph = stage === 4 ? aaPhase(f) : stage > 4 ? 'done' : 'idle';
  const on = stage === 4;
  const dispense = on ? seg(f, 0.55, 0.62) : stage > 4 ? 1 : 0; // adhesive points laid so far (0..1)
  const uv = on && f >= 0.62 && f < 0.7 ? Math.sin(((f - 0.62) / 0.08) * Math.PI) : 0;
  const bake = on ? seg(f, 0.76, 0.84) * (1 - seg(f, 0.94, 0.97)) : 0;
  return {
    err: base,
    mtf,
    phase: ph,
    dispense,
    uv,
    bake,
    temp: on ? Math.round(25 + (BAKE_C - 25) * seg(f, 0.76, 0.86) * (1 - 0.8 * seg(f, 0.94, 0.97))) : 25,
    rig: on ? seg(f, 0.0, 0.06) * (1 - seg(f, 0.95, 1)) : 0,
    needle: on && f >= 0.54 && f < 0.64 ? seg(f, 0.55, 0.62) : -1, // position round the holder rim, -1 = parked
    fixed: stage > 4 || (on && f >= 0.7),
  };
}

// ------------------------------------------------------------------ the phone finale
function phoneOf(stage, f) {
  if (stage !== 7) return { on: false, drop: 0, s1: 0, s2: 0, flex: 0, b2b: 0, lid: 0, flip: 0, strip: 0, step: 0, view: 'none', mod: { dx: 0, dy: 0, dz: 0 }, arrive: 0, face: 'open', flipSx: 1 };
  const drop = seg(f, 0.12, 0.34);
  const arrive = seg(f, 0.0, 0.12);
  const s1 = seg(f, 0.34, 0.41);
  const s2 = seg(f, 0.42, 0.49);
  const flex = seg(f, 0.5, 0.6); // the tail slides over the logic-board socket
  const b2b = seg(f, 0.6, 0.66); // and is pressed down
  const lid = seg(f, 0.66, 0.78);
  const flip = f < 0.8 ? 0 : seg(f, 0.8, 0.92);
  const strip = seg(f, 0.9, 1);
  const step = f < 0.12 ? 0 : f < 0.34 ? 1 : f < 0.42 ? 2 : f < 0.5 ? 3 : f < 0.6 ? 4 : f < 0.66 ? 5 : f < 0.8 ? 6 : 7;
  return {
    on: true,
    drop, s1, s2, flex, b2b, lid, flip, strip, step, arrive,
    // module offset while it drops into the recess: lifted above it, then seated
    mod: { dx: 0, dy: 0, dz: 34 * (1 - drop) },
    view: f < 0.1 ? 'phone' : f < 0.5 ? 'recess' : f < 0.66 ? 'flexrt' : f < 0.8 ? 'phone' : 'back',
    // which of the two phone drawings is visible during the flip: 'open' (3D) or 'back' (flat)
    face: flip < 0.5 ? 'open' : 'back',
    flipSx: f < 0.8 ? 1 : Math.abs(Math.cos(flip * Math.PI)),
  };
}

// the tray, bag and carton in stage 7's start (the module leaves the plant)
function packOf(stage, f) {
  if (stage < 6) return { tray: 0, bag: 0, carton: 0, fill: 0, lid: 0, lower: 0, hero: 0 };
  if (stage > 6) return { tray: 0, bag: 1, carton: 1, fill: 1, lid: 1, lower: 1, hero: 0 };
  return {
    fill: seg(f, 0.04, 0.3), // trays fill with modules
    bag: seg(f, 0.3, 0.52),
    lower: seg(f, 0.52, 0.66), // tray and bag go into the carton
    lid: seg(f, 0.66, 0.78),
    carton: seg(f, 0.5, 0.58),
    tray: 1,
    hero: 1,
  };
}

// ------------------------------------------------------------------ the plant: carrier, people and machines
function carrierOf(stage, f) {
  // x of the hero carrier; lvl is how built the tiny module on it looks: 0 tray, 1 board, 2 populated, 3 sensor, 4 lens, 5 shielded
  let x = ST.start;
  let vis = 1;
  let lvl = 0;
  let kind = 'tray';
  if (stage === 0) { x = lerp(ST.start, ST.pass, seg(f, 0.8, 1)); vis = seg(f, 0.78, 0.86); }
  else if (stage === 1) {
    x = track(f, [[0, ST.pass + 10], [0.08, ST.printer], [0.28, ST.printer], [0.34, ST.mount1], [0.44, ST.mount1], [0.5, ST.mount2], [0.6, ST.mount2], [0.66, ST.reflow - 8], [0.82, ST.reflow + 8], [0.86, ST.aoi], [0.96, ST.aoi], [1, ST.aoi + 6]]);
    lvl = f < 0.08 ? 0 : f < 0.34 ? 1 : 2;
  } else if (stage === 2) {
    x = track(f, [[0, ST.plasma], [0.1, ST.plasma], [0.16, ST.die], [0.44, ST.die], [0.5, ST.wb1], [0.58, ST.wb1], [0.62, ST.wb2], [0.7, ST.wb2], [0.74, ST.wb3], [0.84, ST.wb3], [0.9, ST.irc], [1, ST.irc + 2]]);
    lvl = f < 0.3 ? 2 : 3;
  } else if (stage === 3) {
    x = track(f, [[0, ST.mag], [0.28, ST.mag], [0.34, ST.vcm], [0.58, ST.vcm], [0.64, ST.stack], [0.94, ST.stack], [1, ST.xfer]]);
    lvl = f < 0.6 ? 3 : 4;
  } else if (stage === 4) {
    x = track(f, [[0, ST.xfer + 4], [0.1, ST.aa], [0.74, ST.aa], [0.78, ST.oven - 22], [0.95, ST.oven + 22], [1, ST.oven + 34]]);
    lvl = 4;
  } else if (stage === 5) {
    x = track(f, [[0, ST.cal], [0.2, ST.cal], [0.26, ST.shake], [0.4, ST.shake], [0.46, ST.optic], [0.6, ST.optic], [0.64, ST.otp], [0.72, ST.otp], [0.76, ST.avi], [0.95, ST.avi], [1, ST.avi + 6]]);
    lvl = f < 0.12 ? 4 : 5;
  } else if (stage === 6) {
    x = track(f, [[0, ST.tray], [0.3, ST.tray], [0.36, ST.bag], [0.52, ST.bag], [0.58, ST.carton], [1, ST.carton]]);
    lvl = 5;
    kind = f < 0.3 ? 'tray' : f < 0.54 ? 'bag' : 'carton';
  } else {
    x = track(f, [[0, ST.carton], [0.14, ST.dock - 12], [0.22, ST.dock - 12]]);
    lvl = 5;
    kind = 'carton';
    vis = 1 - seg(f, 0.18, 0.26); // loaded onto the truck
  }
  return { x, vis, lvl, kind };
}

function truckOf(stage, f) {
  if (stage < 6) return { x: TRUCK.x0, vis: 0, door: 0 };
  if (stage === 6) return { x: lerp(TRUCK.x0, TRUCK.x1, seg(f, 0.5, 0.85)), vis: 1, door: seg(f, 0.88, 1) };
  return { x: lerp(TRUCK.x1, TRUCK.x0 + 80, seg(f, 0.3, 0.7)), vis: 1 - seg(f, 0.55, 0.75), door: 1 - seg(f, 0.24, 0.3) };
}

// the person who walks the 7-step gowning routine and then goes through the clean-room door
function personOf(stage, f) {
  if (stage !== 0) return { vis: 0, x: GOWN_DOOR[0], y: GOWN_DOOR[1], step: 7, frac: 1, minutes: GOWN_MIN };
  const t = seg(f, 0.35, 0.75);
  const n = GOWN.length; // 7 markers
  const pos = t * (n - 1);
  const i = Math.min(n - 2, Math.floor(pos));
  const u = pos - i;
  const a = GOWN[i];
  const b = GOWN[i + 1];
  const x = lerp(a[0], b[0], smooth(u));
  const y = lerp(a[1], b[1], smooth(u));
  const afterDoor = seg(f, 0.88, 1);
  return {
    vis: seg(f, 0.3, 0.36) * (1 - seg(f, 0.96, 1)),
    x: lerp(x, GOWN_DOOR[0], afterDoor),
    y: lerp(y, GOWN_DOOR[1], afterDoor),
    step: f < 0.35 ? 0 : t >= 1 ? 7 : Math.max(1, Math.min(7, Math.ceil(t * 7 - 1e-6))),
    frac: t,
    minutes: GOWN_MIN * t,
    shower: f > 0.35 && Math.round(t * 6) === 4 ? 1 : 0,
  };
}

// machine activity, 0..1, used to light lamps and drive moving heads in the plant
function actOf(stage, f) {
  const a = {};
  const win = (v, x0, x1) => (f >= x0 && f < x1 && v ? 1 : 0);
  a.printer = win(stage === 1, 0.1, 0.3);
  a.mount = win(stage === 1, 0.3, 0.6);
  a.reflow = win(stage === 1, 0.62, 0.84);
  a.aoi = win(stage === 1, 0.84, 0.97);
  a.plasma = win(stage === 2, 0.0, 0.1);
  a.die = win(stage === 2, 0.16, 0.44);
  a.wire = win(stage === 2, 0.48, 0.84);
  a.irc = win(stage === 2, 0.86, 1);
  a.mag = win(stage === 3, 0.0, 0.3);
  a.vcm = win(stage === 3, 0.3, 0.6);
  a.stack = win(stage === 3, 0.6, 0.95);
  a.aa = win(stage === 4, 0.0, 0.76);
  a.oven = win(stage === 4, 0.76, 0.97);
  a.cal = win(stage === 5, 0.0, 0.22);
  a.shake = win(stage === 5, 0.22, 0.42);
  a.optic = win(stage === 5, 0.42, 0.62);
  a.otp = win(stage === 5, 0.62, 0.74);
  a.avi = win(stage === 5, 0.74, 0.96);
  a.tray = win(stage === 6, 0.0, 0.3);
  a.bag = win(stage === 6, 0.3, 0.56);
  a.carton = win(stage === 6, 0.56, 0.84);
  a.shower = stage === 0 ? personOf(0, f).shower ?? 0 : 0;
  a.agv = win(stage === 0, 0.0, 0.34);
  return a;
}

// temperature shown in the HUD for the stage's heat steps
function tempOf(stage, f, aa) {
  if (stage === 1) return Math.round(track(f, [[0, 25], [0.62, 25], [0.7, REFLOW_C], [0.78, REFLOW_C], [0.84, 60], [1, 40]]));
  if (stage === 2) return Math.round(track(f, [[0, 25], [0.4, 25], [0.44, CURE_C], [0.47, CURE_C], [0.52, 60], [1, 40]]));
  if (stage === 4) return aa.temp;
  return 25;
}

// ------------------------------------------------------------------ the loupe camera region names
function loupeView(stage, f) {
  switch (stage) {
    case 0: return f < 0.86 ? 'bom' : 'jig';
    case 1: return 'mod';
    case 2: return 'mod';
    case 3: return 'tall';
    case 4: return f < 0.74 ? 'aa' : 'oven';
    case 5: return 'mod';
    case 6: return 'tray';
    default: return phoneOf(7, f).view;
  }
}

export function stateAt(u0) {
  const u = clamp(u0, 0, END_U);
  const stage = Math.min(STAGE_COUNT - 1, Math.floor(u));
  const f = clamp(u - stage, 0, 1);
  const aa = aaOf(stage, f);
  const parts = builtParts(stage, f);
  const lens = lensGroupPose(stage, f, aa);
  const phone = phoneOf(stage, f);
  const pack = packOf(stage, f);
  const car = carrierOf(stage, f);
  const person = personOf(stage, f);
  // the flex tail is lifted while the phone's B2B connector is routed and pressed home
  if (stage === 7) {
    const lift = 7 * seg(f, 0.22, 0.34) * (1 - seg(f, 0.5, 0.6)) + 0.35 * (1 - seg(f, 0.6, 0.66)) * seg(f, 0.5, 0.6);
    ['flex', 'stiff', 'b2b'].forEach((id) => { parts[PART_INDEX[id].n].dz += lift; });
  }
  // stage 6: parts are all there; the film tab is peeled at the end of the plant test
  const shown = parts.reduce((n, p) => n + (p.o >= 0.5 ? 1 : 0), 0);
  const elems = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'].reduce((n, id) => n + (parts[PART_INDEX[id].n].o >= 0.9 ? 1 : 0), 0);
  // yield funnel: units still good out of GOOD0 as the funnel is walked step by step (test stage)
  const fprog = stage === 5 ? seg(f, 0.72, 0.96) * FUNNEL.length : stage > 5 ? FUNNEL.length : 0;
  let good = GOOD0;
  FUNNEL.forEach((s, i) => { const t = clamp(fprog - i, 0, 1); good *= 1 - (1 - s.y) * t; });
  // stage 7 module view
  return {
    u, stage, f, id: STAGE_IDS[stage],
    parts, // [{o, dx, dy, dz}] indexed by part n
    lens, // lens-VCM sub-assembly pose (mm, degrees)
    aa, phone, pack, car, person,
    truck: truckOf(stage, f),
    act: actOf(stage, f),
    view: loupeView(stage, f),
    count: { parts: shown, elems },
    gown: person,
    place: Math.round(PLACE_PANEL * (stage === 1 ? seg(f, 0.3, 0.6) : stage > 1 ? 1 : 0)),
    wires: Math.round(WIRES * (stage === 2 ? seg(f, 0.48, 0.84) : stage > 2 ? 1 : 0)),
    temp: tempOf(stage, f, aa),
    tests: stage === 5 ? Math.min(6, Math.floor(seg(f, 0.14, 0.72) * 6 + 0.0001)) : stage > 5 ? 6 : 0,
    good: Math.round(good),
    packed: stage === 6 ? Math.round(240 * seg(f, 0.04, 0.3)) : stage > 6 ? 240 : 0,
    funnel: { prog: fprog, good },
    sweep: stage === 4 && f < 0.56 ? f : -1,
  };
}

// ------------------------------------------------------------------ robots (the plant's IK arms)
// target [x, y, z] of each robot's tool; `t` is wall-clock seconds so idle robots keep a gentle rhythm
export function robotTargets(s, t) {
  const out = {};
  ROBOTS.forEach((r) => {
    const rest = r.rest;
    let tg = rest;
    const cyc = (period, a, b) => {
      const p = (t % period) / period;
      const m = p < 0.5 ? seg(p, 0.05, 0.45) : 1 - seg(p, 0.55, 0.95);
      return [lerp(a[0], b[0], m), lerp(a[1], b[1], m), lerp(a[2], b[2], m) + 10 * Math.sin(m * Math.PI)];
    };
    if (r.id === 'lens') tg = s.stage === 3 ? cyc(4, [ST.vcm - 8, -26, 20], [ST.stack, -4, 24]) : cyc(9, [rest[0] - 6, rest[1], rest[2]], [rest[0] + 6, rest[1] + 4, rest[2] + 2]);
    if (r.id === 'aa') tg = s.stage === 4 ? cyc(5, [ST.aa - 20, -26, 22], [ST.aa - 2, -6, 28]) : cyc(9, [rest[0] - 6, rest[1], rest[2]], [rest[0] + 6, rest[1] + 4, rest[2] + 2]);
    if (r.id === 'pack') tg = s.stage === 6 ? cyc(3.2, [ST.tray + 6, -26, 20], [ST.bag + 4, -3, 22]) : cyc(9, [rest[0] - 6, rest[1], rest[2]], [rest[0] + 6, rest[1] + 4, rest[2] + 2]);
    out[r.id] = tg;
  });
  return out;
}

// ------------------------------------------------------------------ the numbers shown in the heads-up display
export const pickStep = (steps, f) => {
  let cur = steps[0];
  for (const s of steps) if (f >= s.f) cur = s;
  return cur;
};

const fmt = (v, d = 0) => (Number.isFinite(v) ? v.toFixed(d) : '0');
export function readoutValues(s) {
  const M = s.aa.mtf;
  const alignOn = s.stage === 4;
  return {
    parts: `${s.count.parts}/${PART_COUNT}`,
    gown: `${s.person.step ?? 0}`,
    gmin: fmt(s.person.minutes ?? 0, 1),
    place: `${s.place}`,
    temp: `${s.temp}`,
    wires: `${s.wires}`,
    elems: `${s.count.elems}`,
    mtfc: fmt(alignOn || s.stage > 4 ? M.c : 0, 0),
    mtfk: fmt(alignOn || s.stage > 4 ? M.k : 0, 0),
    err: fmt(alignOn || s.stage > 4 ? M.focusErr : 0, 1),
    tests: `${s.tests}`,
    good: `${s.good}`,
    packed: `${s.packed}`,
    mod: `${s.phone.step ?? 0}`,
  };
}

// ------------------------------------------------------------------ one line of live numbers for the caption
export function captionNumbers(s) {
  const st = s.stage;
  const v = readoutValues(s);
  switch (st) {
    case 0: return { ko: `입장 ${v.gown}/7단계 · ${v.gmin}분 · 부품 ${v.parts}`, en: `Entry step ${v.gown}/7 · ${v.gmin} min · parts ${v.parts}` };
    case 1: return { ko: `장착 ${v.place}개/패널 · ${v.temp} °C`, en: `Placed ${v.place}/panel · ${v.temp} °C` };
    case 2: return { ko: `와이어 ${v.wires}개 · ${v.temp} °C`, en: `Wires ${v.wires} · ${v.temp} °C` };
    case 3: return { ko: `렌즈 ${v.elems}/7매 · 부품 ${v.parts}`, en: `Lens ${v.elems}/7 · parts ${v.parts}` };
    case 4: return { ko: `MTF 중심 ${v.mtfc}% · 모서리 ${v.mtfk}% · 오차 ${v.err} µm · ${v.temp} °C`, en: `MTF centre ${v.mtfc}% · corner ${v.mtfk}% · error ${v.err} µm · ${v.temp} °C` };
    case 5: return { ko: `검사 ${v.tests}/6 · 양품 ${v.good}/1,000`, en: `Tests ${v.tests}/6 · good ${v.good}/1,000` };
    case 6: return { ko: `포장 ${v.packed}개`, en: `Packed ${v.packed}` };
    default: return { ko: `조립 ${v.mod}/7단계`, en: `Assembly step ${v.mod}/7` };
  }
}
