// The pure model: every number and pose on screen is a function of one progress value u in [0, 7]
// (stage = floor(u), local progress f = fraction). No DOM, no clock: the same function runs in the browser and in the tests.
import { COIL, PRESS_X, ROBOTS } from './shops.js';

export const STAGE_COUNT = 7;
export const STAGE_IDS = ['coil', 'press', 'body', 'paint', 'engine', 'assembly', 'ship'];
// seconds each stage takes in Play (paint and assembly have the most to show)
export const STAGE_SECONDS = [9, 11, 13, 18, 10, 15, 10];

// the last reachable progress value (just short of 7 so floor(u) stays a valid stage index)
export const END_U = STAGE_COUNT - 1e-4;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

// Where the tour is after `dt` more seconds of Play, starting from u. Time is spent stage by stage at each stage's own
// pace, so a long frame gap (slow GPU, throttled tab, busy main thread) that crosses a boundary between stages of
// different durations still lands exactly where a smooth run would have.
export function advanceTour(u, dt) {
  let left = Math.max(0, dt);
  let x = clamp(u, 0, END_U);
  while (left > 0 && x < END_U) {
    const st = Math.min(STAGE_COUNT - 1, Math.floor(x));
    const toEnd = (st + 1 - x) * STAGE_SECONDS[st]; // seconds left in this stage
    if (left < toEnd) { x += left / STAGE_SECONDS[st]; left = 0; } else { x = st + 1; left -= toEnd; }
  }
  return Math.min(x, END_U);
}

const smooth = (t) => t * t * (3 - 2 * t);
const seg = (f, a, b) => smooth(clamp((f - a) / (b - a)));
const lerp = (a, b, t) => a + (b - a) * t;
const track = (f, pts) => {
  // piecewise-smooth path through [f, value] pairs
  if (f <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (f <= pts[i][0]) return lerp(pts[i - 1][1], pts[i][1], smooth((f - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0])));
  }
  return pts[pts.length - 1][1];
};

// where the car stands (centre x) at the key moments of each stage
export const CAR_X = { start: 366, A: 396, B: 444, C: 496, exitBody: 548, lift: 560, arches: 592, tank: 648, afterTank: 744, oven1: 786, primer: 858, base: 880, clear: 900, oven2: 970, wait: 1062, trim: 1086, marriage: 1150, wheels: 1196, assemblyExit: 1232, dyno: 1292, water: 1336, out: 1352 };
export const DZ_LIFT = 34;
export const DZ_DIP = -2;
export const WELDS_TOTAL = 4500;
export const COIL_TONNES = 20;
export const COIL_LENGTH_M = 2430;
export const FILM_UM = { ed: 20, primer: 30, base: 15, clear: 40 };
export const PRESS_TONNES = [2400, 1600, 1200, 1200];
export const PARTS_TOTAL = 30000;

const PARTS = ['skid', 'wheelFarF', 'wheelFarR', 'wheelNearF', 'wheelNearR', 'floor', 'rear', 'wallFar', 'cowl', 'module', 'harness', 'seats', 'cockpit', 'wallNear', 'cabin', 'glass', 'seams', 'hood', 'trunk', 'doorR', 'doorF', 'lamps', 'mirror', 'gloss', 'hanger'];
const hiddenParts = () => Object.fromEntries(PARTS.map((p) => [p, { o: 0, dx: 0, dy: 0, dz: 0 }]));
const show = (parts, names, o = 1) => names.forEach((n) => { parts[n].o = o; });

export function paintOf(stage, f) {
  // returns { coat, mix, film } : which coat is the visible surface and how far into it we are (0..1)
  if (stage < 2) return { coat: 'steel', mix: 0, film: 0 };
  if (stage === 2) return { coat: 'steel', mix: 0, film: 0 };
  if (stage === 3) {
    if (f < 0.32) return { coat: 'steel', mix: 0, film: 0 };
    if (f < 0.56) return { coat: 'ed', mix: seg(f, 0.34, 0.5), film: FILM_UM.ed * seg(f, 0.34, 0.5) };
    if (f < 0.84) return { coat: 'ed', mix: 1, film: FILM_UM.ed };
    if (f < 0.88) return { coat: 'primer', mix: seg(f, 0.84, 0.88), film: FILM_UM.ed + FILM_UM.primer * seg(f, 0.84, 0.88) };
    if (f < 0.92) return { coat: 'base', mix: seg(f, 0.88, 0.92), film: FILM_UM.ed + FILM_UM.primer + FILM_UM.base * seg(f, 0.88, 0.92) };
    if (f < 0.95) return { coat: 'clear', mix: seg(f, 0.92, 0.95), film: FILM_UM.ed + FILM_UM.primer + FILM_UM.base + FILM_UM.clear * seg(f, 0.92, 0.95) };
    return { coat: 'clear', mix: 1, film: 105 };
  }
  return { coat: 'clear', mix: 1, film: 105 };
}

function carState(stage, f) {
  const parts = hiddenParts();
  let x = CAR_X.start;
  let dz = 0;
  let visible = false;
  let spin = 0;
  const car = { x, dz, visible, parts, spin };
  if (stage === 2) {
    visible = true;
    x = track(f, [[0, CAR_X.start], [0.1, CAR_X.A], [0.3, CAR_X.A], [0.4, CAR_X.B], [0.7, CAR_X.B], [0.78, CAR_X.C], [0.95, CAR_X.C], [1, CAR_X.exitBody]]);
    show(parts, ['skid', 'floor']);
    parts.floor.o = seg(f, 0, 0.08);
    parts.wallFar.o = seg(f, 0.4, 0.46); parts.wallFar.dy = -34 * (1 - seg(f, 0.4, 0.5));
    parts.wallNear.o = seg(f, 0.4, 0.46); parts.wallNear.dy = 34 * (1 - seg(f, 0.4, 0.5));
    parts.cowl.o = seg(f, 0.44, 0.5); parts.cowl.dz = 24 * (1 - seg(f, 0.44, 0.54));
    parts.cabin.o = seg(f, 0.54, 0.6); parts.cabin.dz = 34 * (1 - seg(f, 0.54, 0.66));
    parts.seams.o = seg(f, 0.68, 0.72) * (1 - seg(f, 0.88, 0.95));
    parts.doorF.o = seg(f, 0.8, 0.84); parts.doorF.dy = 30 * (1 - seg(f, 0.8, 0.88));
    parts.doorR.o = seg(f, 0.82, 0.86); parts.doorR.dy = 30 * (1 - seg(f, 0.82, 0.9));
    parts.hood.o = seg(f, 0.86, 0.9); parts.hood.dz = 26 * (1 - seg(f, 0.86, 0.94));
    parts.trunk.o = seg(f, 0.88, 0.92); parts.trunk.dz = 26 * (1 - seg(f, 0.88, 0.96));
  } else if (stage >= 3) {
    visible = true;
    show(parts, ['skid', 'floor', 'wallFar', 'cowl', 'wallNear', 'cabin', 'doorF', 'doorR', 'hood', 'trunk']);
    if (stage === 3) {
      x = track(f, [[0, CAR_X.exitBody], [0.05, CAR_X.lift], [0.12, CAR_X.lift], [0.24, CAR_X.arches], [0.32, CAR_X.tank], [0.56, CAR_X.tank], [0.66, CAR_X.afterTank], [0.7, CAR_X.afterTank], [0.74, CAR_X.oven1], [0.8, CAR_X.oven1], [0.84, CAR_X.primer], [0.88, CAR_X.primer + 8], [0.92, CAR_X.base + 8], [0.95, CAR_X.clear + 8], [1, CAR_X.oven2]]);
      dz = track(f, [[0.05, 0], [0.12, DZ_LIFT], [0.32, DZ_LIFT], [0.42, DZ_DIP], [0.48, DZ_DIP], [0.56, DZ_LIFT], [0.66, DZ_LIFT], [0.7, 0]]);
      parts.hanger.o = clamp(dz / 8);
      parts.skid.o = 1;
      parts.gloss.o = seg(f, 0.95, 1);
    } else if (stage === 4) {
      x = lerp(CAR_X.oven2, CAR_X.wait, seg(f, 0, 0.14));
      parts.gloss.o = 1;
    } else if (stage === 5) {
      parts.gloss.o = 1;
      x = track(f, [[0, CAR_X.wait], [0.1, CAR_X.trim], [0.36, CAR_X.trim], [0.42, CAR_X.marriage], [0.66, CAR_X.marriage], [0.72, CAR_X.wheels], [0.94, CAR_X.wheels], [1, CAR_X.assemblyExit]]);
      // doors, bonnet and boot come off for fitting the inside, and go back on at the end
      const off = seg(f, 0, 0.08);
      const on = seg(f, 0.86, 0.94);
      const gone = off * (1 - on);
      parts.doorF.o = 1 - gone; parts.doorF.dy = 34 * gone;
      parts.doorR.o = 1 - gone; parts.doorR.dy = 34 * gone;
      parts.hood.o = 1 - gone; parts.hood.dz = 30 * gone;
      parts.trunk.o = 1 - gone; parts.trunk.dz = 30 * gone;
      parts.skid.o = 1 - seg(f, 0.04, 0.1); // the car leaves its skid for the trim line
      parts.harness.o = seg(f, 0.1, 0.16) * (1 - seg(f, 0.3, 0.34));
      const cock = seg(f, 0.16, 0.26);
      parts.cockpit.o = cock * (1 - seg(f, 0.26, 0.3)); parts.cockpit.dy = 36 * (1 - cock); parts.cockpit.dz = 8 * (1 - cock);
      const seat = seg(f, 0.2, 0.3);
      parts.seats.o = seat * (1 - seg(f, 0.3, 0.34)); parts.seats.dy = 36 * (1 - seat); parts.seats.dz = 10 * (1 - seat);
      const gl = seg(f, 0.3, 0.38);
      parts.glass.o = gl; parts.glass.dz = 16 * (1 - gl);
      dz = track(f, [[0.42, 0], [0.5, 22], [0.58, 22], [0.66, 0]]);
      parts.hanger.o = clamp(dz / 6);
      // the powertrain module rides in on its AGV from the engine bay: its y offset relative to the car
      const ride = seg(f, 0.42, 0.58);
      parts.module.o = f >= 0.4 ? 1 : 0;
      parts.module.dy = -214 * (1 - ride);
      parts.module.dz = -dz;
      parts.rear.o = seg(f, 0.58, 0.64); parts.rear.dz = -8 * (1 - seg(f, 0.58, 0.66));
      const wr = [seg(f, 0.74, 0.8), seg(f, 0.77, 0.83), seg(f, 0.8, 0.86), seg(f, 0.83, 0.89)];
      ['wheelFarF', 'wheelFarR', 'wheelNearF', 'wheelNearR'].forEach((n, i) => {
        parts[n].o = wr[i];
        parts[n].dy = (n.startsWith('wheelFar') ? -1 : 1) * 40 * (1 - wr[i]);
      });
      parts.lamps.o = seg(f, 0.92, 0.96);
      parts.mirror.o = seg(f, 0.9, 0.95);
      parts.glass.o = gl;
    } else if (stage === 6) {
      parts.gloss.o = 1;
      show(parts, ['wheelFarF', 'wheelFarR', 'wheelNearF', 'wheelNearR', 'glass', 'lamps', 'mirror', 'module', 'rear']);
      parts.module.o = 0; parts.rear.o = 0;
      x = track(f, [[0, CAR_X.assemblyExit], [0.1, CAR_X.dyno], [0.36, CAR_X.dyno], [0.46, CAR_X.water], [0.8, CAR_X.water], [0.92, CAR_X.out], [1, CAR_X.out]]);
      spin = seg(f, 0.1, 0.16) * (1 - seg(f, 0.34, 0.4));
    }
    if (stage >= 5) show(parts, ['glass'], parts.glass.o);
    if (stage >= 3 && stage < 5) { parts.glass.o = 0; }
  }
  if (stage === 5 && parts.wheelFarF.o === 0 && f > 0.9) show(parts, ['wheelFarF', 'wheelFarR', 'wheelNearF', 'wheelNearR']);
  return { x, dz, visible, parts, spin };
}

export function stateAt(u0) {
  const u = clamp(u0, 0, STAGE_COUNT - 1e-6);
  const stage = Math.floor(u);
  const f = u - stage;
  const s = { u, stage, f, id: STAGE_IDS[stage] };
  // ---- coil, strip, blanks (stage 0) ----
  const unrolled = stage === 0 ? seg(f, 0.04, 0.7) : stage > 0 ? 1 : 0;
  s.coil = { show: stage === 0, unrolled, i: Math.round(unrolled * 0.82 * 7), r: lerp(COIL.rMax, COIL.rMin, unrolled * 0.82), meters: Math.round(COIL_LENGTH_M * unrolled * 0.82 / 10) * 10 };
  const stripHead = stage === 0 ? 66 + seg(f, 0.04, 0.3) * 52 : 118;
  s.strip = { x0: stage === 0 ? COIL.x : 0, x1: stripHead, show: stage === 0 && f > 0.03 && f < 0.82, cut: stage === 0 && f > 0.34 };
  s.blanks = { n: stage === 0 ? Math.floor(seg(f, 0.4, 0.8) * 8) : stage === 1 ? Math.max(0, 8 - Math.floor(f * 12)) : 0, stacker: stage <= 1 };
  s.rams = { b: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  s.panel = { show: false, variant: 0, x: 0, y: 0, z: 0, o: 1 };
  s.scrap = 0;
  s.force = 0;
  s.panelCount = 0;
  s.racks = [0, 0, 0, 0, 0];
  if (stage === 0) {
    // blanking press hits as the strip feeds through
    const hit = f > 0.34 && f < 0.82 ? Math.max(0, Math.sin(f * 70)) : 0;
    s.rams.b = hit;
    s.panel = { show: f > 0.84, variant: 0, x: 114 + seg(f, 0.84, 1) * 30, y: 0, z: 0, o: 1 };
  }
  if (stage === 1) {
    // one blank walks through the four presses; press i strokes while the panel stands inside it.
    // Segment j (t in [j, j+1)): the panel travels from stop j to stop j+1 during the first half, then press j+1 strokes.
    const stops = [138, PRESS_X[0] + 17, PRESS_X[1] + 17, PRESS_X[2] + 17, PRESS_X[3] + 17, PRESS_X[3] + 17 + 34];
    const t = clamp(f / 0.78, 0, 1) * 5; // 0..5
    const j = Math.min(4, Math.floor(t));
    const local = t - j;
    s.panel = { show: f < 0.9, variant: 0, x: lerp(stops[j], stops[j + 1], seg(local, 0, 0.45)), y: 0, z: 0, o: 1 };
    s.force = 0;
    for (let i = 1; i <= 4; i++) {
      const u2 = clamp((t - (i - 0.5)) / 0.5, 0, 1); // press i strokes in the second half of segment i-1
      s.rams[i] = Math.sin(u2 * Math.PI);
      s.force = Math.max(s.force, Math.round(PRESS_TONNES[i - 1] * Math.max(0, (s.rams[i] - 0.82) / 0.18)));
    }
    s.panel.variant = t < 0.75 ? 0 : t < 1.75 ? 1 : t < 2.75 ? 2 : 3;
    s.scrap = t >= 1.6 && t < 2.5 ? seg(t, 1.6, 2.5) : 0;
    s.racks = [0, 1, 2, 3, 4].map((i) => seg(f, 0.4 + i * 0.1, 0.5 + i * 0.1));
    s.panelCount = Math.floor(f * 15);
  }
  if (stage >= 2) s.racks = [1, 1, 1, 1, 1];
  s.car = carState(stage, f);
  s.paint = paintOf(stage, f);
  // ---- body shop numbers ----
  s.welds = stage < 2 ? 0 : stage > 2 ? WELDS_TOTAL : Math.round(track(f, [[0.08, 0], [0.3, 900], [0.44, 900], [0.7, 3600], [0.78, 3600], [0.94, WELDS_TOTAL]]) / 10) * 10;
  s.working = [];
  // ---- paint numbers ----
  s.film = Math.round(s.paint.film);
  s.oven = 20;
  if (stage === 3) {
    // first oven (ED, ~180 C) runs while the body is inside it, the second (top coats, ~150 C) as the body enters it
    if (f >= 0.66 && f < 0.88) s.oven = 20 + 160 * seg(f, 0.66, 0.74) * (1 - seg(f, 0.8, 0.88));
    if (f >= 0.95) s.oven = 20 + 130 * seg(f, 0.95, 1);
  } else if (stage === 4) s.oven = 20 + 130 * (1 - seg(f, 0.02, 0.14));
  s.dip = stage === 3 ? clamp((-(s.car.dz) + DZ_LIFT) / (DZ_LIFT - DZ_DIP)) : 0;
  // ---- engine shop (stage 4) ----
  s.eng = engineState(stage, f);
  // ---- assembly / shipping ----
  s.agv = { show: stage === 5 && f >= 0.38 && f < 0.8, dy: stage === 5 ? (f < 0.6 ? -214 * (1 - seg(f, 0.42, 0.58)) : -214 * seg(f, 0.64, 0.76)) : -214 };
  s.parts = stage === 5 ? Math.round(track(f, [[0.08, 600], [0.34, 9000], [0.66, 20000], [0.9, 28500], [1, PARTS_TOTAL]]) / 100) * 100 : stage > 5 ? PARTS_TOTAL : 0;
  s.speed = stage === 6 ? Math.round(120 * seg(f, 0.14, 0.3) * (1 - seg(f, 0.3, 0.38))) : 0;
  s.checks = stage === 6 ? Math.round(120 * seg(f, 0.5, 0.88)) : 0;
  s.water = stage === 6 && f > 0.5 && f < 0.66;
  s.scan = stage === 6 && f > 0.68 && f < 0.82 ? seg(f, 0.68, 0.82) : -1;
  s.output = stage === 6 ? seg(f, 0.88, 1) : 0;
  return s;
}

function engineState(stage, f) {
  // positions along the engine conveyor, and which engine parts are present / exploded
  const E = { show: stage === 4 || (stage === 5 && f < 0.42), x: 1056, parts: {}, rpm: 0, glow: 0, spindle: -1, cooling: 0 };
  const names = ['pan', 'block', 'crank', 'pistons', 'head', 'intake', 'exhaust', 'cover', 'belt', 'bores'];
  names.forEach((n) => { E.parts[n] = { o: 0, dz: 0 }; });
  if (stage < 4) { E.show = false; return E; }
  if (stage === 5) {
    // the finished engine waits on the AGV in the engine bay until the powertrain module takes over in the car group
    Object.keys(E.parts).forEach((n) => { E.parts[n].o = ['crank', 'pistons', 'bores'].includes(n) ? 0 : 1; });
    E.x = 1176; E.show = f < 0.42; E.scale = 1;
    return E;
  }
  E.scale = lerp(1.4, 1, seg(f, 0.94, 1));
  E.x = track(f, [[0, 1056], [0.16, 1056], [0.26, 1082], [0.38, 1082], [0.46, 1108], [0.72, 1108], [0.8, 1134], [0.92, 1134], [0.98, 1176], [1, 1176]]);
  E.parts.block.o = seg(f, 0.02, 0.08);
  E.parts.pan.o = seg(f, 0.04, 0.1);
  E.glow = f < 0.18 ? 1 - seg(f, 0.06, 0.18) : 0; // molten, cooling
  E.parts.bores.o = seg(f, 0.28, 0.34);
  E.spindle = f > 0.26 && f < 0.4 ? (f - 0.26) / 0.14 : -1; // machining head progress
  const drop = (n, a, b, h) => { const t = seg(f, a, b); E.parts[n].o = t > 0 ? 1 : 0; E.parts[n].dz = h * (1 - t); };
  drop('crank', 0.48, 0.52, 14);
  drop('pistons', 0.52, 0.57, 16);
  drop('head', 0.57, 0.62, 18);
  drop('intake', 0.62, 0.65, 10);
  drop('exhaust', 0.62, 0.65, 10);
  drop('cover', 0.65, 0.68, 12);
  drop('belt', 0.68, 0.71, 8);
  // crank and pistons disappear into the block once the head is on
  if (f > 0.6) { E.parts.crank.o = 0; E.parts.pistons.o = 0; }
  E.rpm = f > 0.8 && f < 0.93 ? Math.round(6000 * seg(f, 0.8, 0.86) * (1 - 0.1 * seg(f, 0.9, 0.93))) : 0;
  E.firing = E.rpm > 0;
  return E;
}

// robot targets (world coordinates). t is wall-clock seconds; busy says whether the robot is working this moment.
// Positions are expressed relative to the car so the arms follow the body they are working on.
export function robotTargets(s, t) {
  const out = {};
  const c = s.car;
  const stage = s.stage;
  const f = s.f;
  const sway = (i, rate = 1) => 0.5 + 0.5 * Math.sin(t * rate * 1.7 + i * 2.1);
  ROBOTS.forEach((r, i) => {
    let busy = false;
    let target = [r.x, r.y * 0.45, 22]; // rest pose: tucked toward the base
    const side = Math.sign(r.y);
    if (stage === 2 && c.visible) {
      const sta = r.id.startsWith('wa') ? [0.08, 0.34] : r.id.startsWith('wb') ? [0.4, 0.74] : [0.76, 0.96];
      busy = f >= sta[0] && f <= sta[1];
      const phase = sway(i, 1.2);
      const lx = lerp(-26, 30, (i * 0.37 + phase) % 1);
      if (busy) {
        if (r.id.startsWith('wa')) target = [c.x + lx, side * lerp(5, 12, phase), 7.6];
        else if (r.id.startsWith('wb')) target = side < 0 ? [c.x + lx, -17.2, lerp(8, 16, phase)] : [c.x + lerp(-12, 6, phase), side * 10, 29];
        else if (r.tool === 'gun') target = [c.x + lerp(-16, 2, phase), -17.2, lerp(9, 17, phase)];
        else target = [c.x + (r.id === 'wc2' ? 6 : -10), side * 19, 12];
      }
    } else if (stage === 3 && r.bay === 'paint') {
      const step = r.id.startsWith('pp') ? [0.84, 0.88] : r.id.startsWith('pb') ? [0.88, 0.92] : [0.92, 0.95];
      busy = f >= step[0] && f <= step[1];
      if (busy) target = [c.x + lerp(-26, 30, sway(i, 2.4)), side * 19, lerp(8, 24, sway(i + 3, 1.4))];
    } else if (stage === 5 && r.bay === 'assembly') {
      if (r.id === 'ag1') { busy = f >= 0.28 && f <= 0.4; if (busy) target = [c.x + 8, -8, 24]; }
      else { busy = f >= 0.72 && f <= 0.9; if (busy) target = [c.x + (r.id === 'aw1' ? -26 : 26) , side * 17, 8.4]; }
    } else if (stage === 6 && r.bay === 'ship') {
      busy = f >= 0.64 && f <= 0.84;
      if (busy) target = [c.x + lerp(-30, 30, seg(f, 0.66, 0.82)), -18, 20];
    }
    out[r.id] = { target, busy };
  });
  return out;
}

// the live numbers shown in the readout (keys match data.js READOUTS)
export function readoutValues(s) {
  return { meters: s.coil.meters, force: s.force, panels: s.panelCount, welds: s.welds, film: s.film, oven: Math.round(s.oven), rpm: s.eng.rpm, parts: s.parts, speed: s.speed, checks: s.checks, takt: 60 };
}

// the tour caption shown for (stage, f): the latest sub-step whose start is <= f
export const pickStep = (steps, f) => steps.reduce((a, st, i) => (f >= st.f ? i : a), 0);
