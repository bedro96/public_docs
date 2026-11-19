// The pure model of the tour: every pose, number and caption on screen is a function of one progress value u in [0, 8).
// u = stage + local progress. No DOM, no clock: the same function runs in the browser and in the tests.
import { takeoffAt, TO_EVENTS, TO, KT } from './takeoff.js';
import {
  PITCH, xDay, DECK, DECK_X, RAMP_X0, CRANE_Z, SUPPLY, WICH_X, WICHITA, RAIL, YARD, HALL, APRON, RWY, WING_BAY, CENTRE, GZ, CART_X, PIVOT,
} from './layout.js';

export const STAGE_COUNT = 8;
export const STAGE_IDS = ['supply', 'fuselage', 'wing', 'line', 'systems', 'interior', 'rollout', 'takeoff'];
// seconds each stage takes in Play (the finale has the longest single event: a real-time take-off)
export const STAGE_SECONDS = [14, 22, 15, 26, 20, 22, 20, 64];
export const END_U = STAGE_COUNT - 1e-4;
export const FINALE_SECONDS = STAGE_SECONDS[7];
// the finale timeline in seconds from its start: taxi, line up, spool (brakes on), then the simulated take-off at 1x
export const FIN = { taxi: 8, lineup: 12, spool: 16 };
export const finaleF = (tSim) => (FIN.spool + tSim) / FINALE_SECONDS;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);
const seg = (v, a, b) => smooth(clamp((v - a) / (b - a)));
const lerp = (a, b, t) => a + (b - a) * t;
const track = (v, pts) => {
  if (v <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (v <= pts[i][0]) return lerp(pts[i - 1][1], pts[i][1], smooth((v - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0])));
  return pts[pts.length - 1][1];
};

// Where the tour is after `dt` more seconds of Play, starting from u. Time is spent stage by stage at each stage's own pace, so a long
// frame gap that crosses a boundary between stages of different durations still lands exactly where a smooth run would have.
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
export const pickStep = (steps, f) => {
  let at = 0;
  for (let i = 0; i < steps.length; i++) if (f >= steps[i].f - 1e-9) at = i;
  return at;
};

// ---------- the flow-day clock ----------
// Stage 4 (u 3..4) covers arrival and days 1-4, stage 5 days 5-7, stage 6 days 8-10. Pace inside stage 4 is not uniform: the night
// lift from the raised level and the one-position wing / tail / gear work are given room.
const DAY4 = [[0, 0], [0.12, 1], [0.50, 3.2], [0.58, 3.8], [0.62, 4.0], [1, 5]];
export function dayOf(u) {
  if (u < 3) return 0;
  if (u < 4) return trackLin(u - 3, DAY4);
  if (u < 5) return 5 + (u - 4) * 3;
  if (u < 6) return 8 + (u - 5) * 3;
  return 11;
}
function trackLin(v, pts) {
  for (let i = 1; i < pts.length; i++) if (v <= pts[i][0]) return lerp(pts[i - 1][1], pts[i][1], (v - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]));
  return pts[pts.length - 1][1];
}
// the unified build clock: u while the parts are made (stages 1-3), then 3 + the flow day
export const clockOf = (u) => (u < 3 ? u : 3 + dayOf(u));

// where the line puts the fuselage (plane centre x) at flow day d: pulsed (stop-and-go) in the early positions, continuous later
export function lineX(d) {
  if (d < 1) return null;
  if (d >= 4) return xDay(d);
  if (d < 3.2) {
    const k = Math.min(2, Math.floor(d));
    if (k < 1) return xDay(1);
    return xDay(k) + PITCH * seg(d - k, 0.72, 1);
  }
  // the crane lifts the fuselage off the raised level, carries it one position on and sets it down (night of day 3)
  return lerp(xDay(3), xDay(4), seg(d, 3.3, 3.65));
}
export function lineZ(d) {
  if (d < 3.2) return DECK * seg(d, 0.55, 1.0);
  const up = DECK + 30 * seg(d, 3.2, 3.35);
  return d < 3.6 ? up : lerp(DECK + 30, 0, seg(d, 3.6, 3.85));
}

// ---------- what is attached when (clock tl) ----------
// kind: drop (comes down onto its place), side (slides in from the side, +dy near side), slide (along x), rise (comes up from below), fade
const D3 = (d0, d1) => [3 + d0, 3 + d1];
const hasSuffix = (id, s) => id.endsWith(s);
const RULES = [
  // fuselage barrels (stage 2, Wichita): frames and stringers first, the skin wraps them
  [/^frames_(48|46|43|41)$/, (m) => { const i = BARREL_I[m[1]]; return [1.01 + 0.03 * i, 1.09 + 0.03 * i, 'drop', 40]; }],
  [/^stringers_(48|46|43|41)$/, (m) => { const i = BARREL_I[m[1]]; return [1.07 + 0.03 * i, 1.15 + 0.03 * i, 'drop', 40]; }],
  [/^(barrel_(48|46|43|41)|tailcone)$/, (m) => { const i = BARREL_I[m[2] || '48']; return [1.13 + 0.035 * i, 1.23 + 0.035 * i, 'drop', 50]; }],
  [/^(windows_(46|43)|door_l1|door_l2|exit_hatches|door_plug|cockpit_windows|pitot_capt|pitot_stby)$/, () => [1.33, 1.4, 'fade', 0]],
  // wings (stage 3): built in the bay, port wing a little behind starboard
  [/^wing_lower_skin_/, (m, id) => W3(id, 2.04, 2.14, 'drop', 60)],
  [/^wing_spar_(front|rear)_/, (m, id) => W3(id, m[1] === 'front' ? 2.12 : 2.17, m[1] === 'front' ? 2.2 : 2.25, 'drop', 70)],
  [/^wing_ribs_/, (m, id) => W3(id, 2.24, 2.36, 'drop', 60)],
  [/^wing_stringers_/, (m, id) => W3(id, 2.3, 2.4, 'drop', 50)],
  [/^wing_fuel_tank_/, (m, id) => W3(id, 2.38, 2.5, 'fade', 0)],
  [/^wing_upper_skin_/, (m, id) => W3(id, 2.54, 2.64, 'drop', 80)],
  [/^slats_/, (m, id) => W3(id, 2.64, 2.7, 'slide', 40)],
  [/^spoilers_/, (m, id) => W3(id, 2.68, 2.74, 'drop', 30)],
  [/^flap_(in|out)_/, (m, id) => W3(id, 2.7, 2.78, 'slide', -40)],
  [/^aileron_/, (m, id) => W3(id, 2.76, 2.82, 'slide', -30)],
  [/^flap_fairings_/, (m, id) => W3(id, 2.78, 2.84, 'fade', 0)],
  [/^winglet_/, (m, id) => W3(id, 2.82, 2.9, 'drop', 50)],
  [/^wing_tip_light_/, (m, id) => W3(id, 2.88, 2.92, 'fade', 0)],
  // Renton line, flow days 1-3 (raised level): floor, structure, systems
  [/^cabin_floor$/, () => [...D3(1.0, 1.3), 'drop', 30]],
  [/^pressure_bulkhead_(fwd|aft)$/, (m) => [...D3(m[1] === 'fwd' ? 1.05 : 1.15, m[1] === 'fwd' ? 1.35 : 1.45), 'slide', m[1] === 'fwd' ? 40 : -40]],
  [/^cargo_(fwd|aft)$/, (m) => [...D3(m[1] === 'fwd' ? 1.3 : 1.4, m[1] === 'fwd' ? 1.6 : 1.7), 'drop', 30]],
  [/^center_tank$/, () => [...D3(1.5, 1.8), 'drop', 30]],
  [/^ac_packs$/, () => [...D3(1.6, 1.9), 'drop', 30]],
  [/^elec_bay$/, () => [...D3(1.7, 2.0), 'drop', 30]],
  [/^flight_deck_floor$/, () => [...D3(1.8, 2.0), 'drop', 30]],
  [/^dorsal_fin$/, () => [...D3(1.1, 1.4), 'drop', 40]],
  [/^wiring_harness$/, () => [...D3(2.0, 2.9), 'fade', 0]],
  [/^hydraulic_lines$/, () => [...D3(2.3, 3.0), 'fade', 0]],
  [/^flight_deck$/, () => [...D3(3.0, 3.3), 'drop', 30]],
  [/^radome$/, () => [...D3(3.0, 3.35), 'slide', 70]],
  // day 4: wings, tail, gear in one position
  [/^fin$/, () => [...D3(4.5, 4.75), 'carry', 0]],
  [/^rudder$/, () => [...D3(4.62, 4.78), 'fade', 0]],
  [/^apu_exhaust$/, () => [...D3(4.78, 4.86), 'fade', 0]],
  // day 5-6: galleys, lavs, tanks, sidewalls, bins
  [/^(galley_aft|lavatory_aft)$/, (m) => [...D3(5.0, 5.5), 'side', 60]],
  [/^water_tanks$/, () => [...D3(5.3, 5.6), 'drop', 30]],
  [/^sidewall_far$/, () => [...D3(6.0, 6.3), 'fade', 0]],
  [/^bins_(far|near)$/, (m) => [...D3(m[1] === 'far' ? 6.2 : 6.4, m[1] === 'far' ? 6.6 : 6.8), 'drop', 30]],
  [/^(galley_fwd|lavatory_fwd)$/, () => [...D3(6.4, 6.9), 'side', 60]],
  [/^cockpit_door$/, () => [...D3(6.6, 6.8), 'fade', 0]],
  // day 8: seats on the conveyor, three at a time
  [/^seat_row_(\d\d)$/, (m) => { const i = Number(m[1]) - 1; return [...D3(8.0 + 0.55 * (i / 29), 8.0 + 0.55 * (i / 29) + 0.16), 'side', 90]; }],
  // payload is not installed at the factory
  [/^bags_(fwd|aft)$/, () => [99, 100, 'fade', 0]],
];
const BARREL_I = { 48: 0, 46: 1, 43: 2, 41: 3 };
function W3(id, a, b, kind, amt) {
  const late = hasSuffix(id, '_p') ? 0.04 : 0;
  return [a + late, b + late, kind, amt];
}
const ruleCache = new Map();
function ruleOf(id) {
  if (ruleCache.has(id)) return ruleCache.get(id);
  let out = null;
  for (const [re, fn] of RULES) {
    const m = re.exec(id);
    if (m) { out = fn(m, id); break; }
  }
  ruleCache.set(id, out);
  return out;
}
export const partRule = (id) => ruleOf(id);

// the first moment each part is complete, for the "parts fitted" counter and the tests
export function partProgress(id, tl) {
  const r = ruleOf(id);
  if (!r) return 1;
  return seg(tl, r[0], r[1]);
}

// ---------- carrying a load by crane: bay -> over the plane -> lowered ----------
// returns {s: blend 0..1 between the pick-up place and the final place, lift: extra height in units, hookDown: 0..1 (the hook is at the load)}
function carry(p) {
  const s = seg(p, 0.3, 0.8);
  const lift = 90 * Math.sin(Math.PI * seg(p, 0.12, 0.9)) ** 0.7 * (p > 0.12 && p < 0.9 ? 1 : 0);
  return { s, lift };
}

// ---------- the plane's pose ----------
const ZYARD = GZ + 7; // standing on the flatcar or the cart: its deck is 0.7 m above the floor
function planePlace(u) {
  // returns {x,y,z} of the plane-local origin (tail at x=0) and flags
  const o = { x: 0, y: 0, z: GZ, yaw: 0, pitch: 0, roll: 0, rail: false, cart: false, jacks: 0, gear: 0, gearN: 0, doors: 0, taxi: false, vis: true };
  const d = dayOf(u);
  if (u < 1) { o.vis = false; return o; }
  if (u < 2) {
    // Wichita: stays at the jigs until it is joined and primed, then is moved onto the railcar and rides to the yard
    const q = seg(u, 1.56, 1.64);
    const car = trainX(u) - CENTRE;
    o.x = u < 1.64 ? lerp(WICH_X, trainX(1.5) - CENTRE, q) : car;
    o.z = lerp(GZ, ZYARD, q);
    o.rail = u >= 1.64;
    return o;
  }
  if (u < 3) { o.x = YARD.stop - CENTRE; o.z = ZYARD; return o; }
  if (u < 4) {
    const f = u - 3;
    if (d < 1) {
      // offloaded in the yard and wheeled into the hall on a cart; a ramp takes the cart up to the raised level (schematic)
      const q = seg(d, 0.08, 0.92);
      o.x = lerp(YARD.stop, xDay(1), q) - CENTRE;
      o.z = lerp(ZYARD, GZ + DECK + 7, clamp((o.x + CENTRE - RAMP_X0) / (DECK_X.x0 - RAMP_X0))) - 7 * seg(d, 0.92, 1);
      o.cart = d < 0.92;
      o.rail = f < 0.02;
      return o;
    }
    o.x = lineX(d) - CENTRE;
    o.z = GZ + lineZ(d);
    return o;
  }
  if (u < 6) { o.x = xDay(d) - CENTRE; o.z = GZ; }
  else if (u < 7) {
    const f = u - 6;
    // roll-out through the hall door to the stand, then ground checks, then a short taxi test
    const x0 = xDay(11);
    o.x = track(f, [[0, x0], [0.22, APRON.stand], [0.8, APRON.stand], [1, APRON.stand + 400]]) - CENTRE;
    o.y = -90 * seg(f, 0.04, 0.24);
    o.z = GZ;
  } else {
    const f = u - 7;
    const s = f * FINALE_SECONDS;
    const stand = APRON.stand + 400;
    const startX = RWY.start - PIVOT[0];
    const yStand = -90;
    if (s < FIN.lineup) {
      // taxi: a gentle S-curve from the apron stand to the runway centreline, ending lined up on it
      const q = seg(s, 0, FIN.taxi + 3);
      const x0 = stand - CENTRE;
      o.x = lerp(x0, startX, q);
      const w = (v) => seg(v, 0.1, 0.95);
      o.y = lerp(yStand, 0, w(q));
      const e = 0.01;
      const dyq = (lerp(yStand, 0, w(q + e)) - lerp(yStand, 0, w(q - e))) / (2 * e);
      o.yaw = Math.atan2(dyq, startX - x0);
      o.taxi = q > 0.01 && q < 0.995;
      o.z = GZ;
    } else {
      const t = s - FIN.spool;
      const st = takeoffAt(t);
      o.x = startX + st.dist * 10;
      o.y = st.y * 10;
      o.z = GZ + st.alt * 10;
      o.yaw = st.psi;
      o.pitch = (st.pitch * Math.PI) / 180;
      o.roll = st.phi;
      o.gear = st.gear;
      o.gearN = st.gear;
      o.take = st;
    }
  }
  return o;
}

// ---------- the train (stage 2) ----------
export function trainX(u) {
  // the flatcar's centre: parked at the end of the Wichita bay, then along the compressed rail lane to the yard stop
  if (u < 1.66) return RAIL.x0 - 100;
  if (u < 2) return lerp(RAIL.x0 - 100, YARD.stop, seg(u, 1.66, 1.99));
  if (u < 3) return YARD.stop;
  // offloaded in the yard at the start of stage 4: the empty car backs away
  if (u < 3.06) return lerp(YARD.stop, YARD.stop - 1100, seg(u, 3.0, 3.06));
  return YARD.stop - 1100;
}

// ---------- cameras ----------
// The camera is a focus point in world units plus the screen width to show; live.js turns it into a viewBox for the current aspect.
function cameraOf(u, pl, day) {
  const fx = (x, y, z, w) => ({ x, y, z, w });
  const px = pl.x + CENTRE;
  if (u < 1) return fx(-5900, 0, 0, 3300);
  if (u < 2) {
    const q = seg(u, 1.5, 1.64);
    return fx(lerp(WICHITA.cx, px, q), 0, 30, lerp(1350, 2100, q));
  }
  if (u < 3) {
    // the wing bay in the hall; the plane waits in the yard
    const q = seg(u - 2, 0, 0.18);
    return fx(lerp(YARD.stop, 2650, q), lerp(0, -380, q), 40, lerp(1500, 1250, q));
  }
  if (u < 4) {
    if (day < 3.9) return fx(px, -40, 40, 1200);
    // day 4: wings and the tail come in at one position, the camera pulls out a little and looks at the far side where the wings wait
    return fx(px, lerp(-40, -200, seg(day, 3.9, 4.3)), 40, lerp(1200, 1700, seg(day, 3.9, 4.3)));
  }
  if (u < 5) return fx(px, lerp(-200, -30, seg(day, 4.5, 5.2)), 40, lerp(1700, 1200, seg(day, 4.5, 5.2)));
  if (u < 6) return fx(px, -30, 40, 1200);
  if (u < 7) return fx(px, -20, 40, u - 6 < 0.22 ? 1650 : 1350);
  const s = (u - 7) * FINALE_SECONDS;
  if (s < FIN.lineup) return fx(px, pl.y, 40, 1500);
  // the camera pans along the runway with the plane, leading it a little, and rises with the climb
  const alt = pl.take ? pl.take.alt * 10 : 0;
  return fx(px + 260, pl.y, 40 + alt * 0.9, lerp(1500, 2100, seg(s - FIN.spool, 22, 46)));
}

// ---------- readouts ----------
export const WIRE_KM = 69; // ~43 mi of wire on the MAX [verified-secondary]
export const SEAT_ROWS = 29;
const COUNTS = { crates: SUPPLY.length };

// ---------- the whole state ----------
export function stateAt(u0) {
  const u = clamp(u0, 0, STAGE_COUNT - 1e-6);
  const stage = Math.floor(u);
  const f = u - stage;
  const day = dayOf(u);
  const tl = clockOf(u);
  const pl = planePlace(u);
  const take = pl.take || null;
  const s = { u, stage, f, id: STAGE_IDS[stage], day, tl, plane: pl, take };

  // ---- skin x-ray: the skin goes pale while the inside is built, opaque for the outside work and the flight ----
  let skin = 1;
  if (u >= 3 && u < 7) skin = track(day, [[0, 1], [0.9, 1], [1.4, 0.3], [4.8, 0.3], [5.2, 0.38], [8, 0.34], [9.6, 0.5], [10.6, 1], [11, 1]]);
  if (u >= 3 && u < 3.12) skin = 1;
  s.skin = skin;
  // green primer after the join (a bare aluminium look before)
  s.primed = u >= 1.54;
  s.power = day >= 6 && u < 7;
  s.fx = {
    pressure: day >= 7.0 && day < 7.42,
    fuel: day >= 5.5 && day < 5.95,
    jacks: day >= 7.42 && day < 7.95,
  };
  s.line = { speedCmMin: u >= 3 && u < 6 ? 5 : 0, pulsed: day > 0 && day < 4 };

  // jacks lift the plane for the gear swing (70.3 t in the factory text)
  const lift = seg(day, 7.4, 7.55) * (1 - seg(day, 7.85, 7.95));
  pl.z += lift * 12;
  pl.jacks = lift;
  const swing = day >= 7.5 && day <= 7.9 ? Math.sin(Math.PI * seg(day, 7.55, 7.85)) : 0;
  if (u >= 3 && u < 6) { pl.gear = swing; pl.gearN = swing; pl.doors = swing > 0 ? Math.min(1, swing * 3) : 0; }
  s.gear = { main: pl.gear, nose: pl.gearN, doors: pl.doors || Math.min(1, Math.sin(Math.PI * clamp(pl.gear)) * 2.5) };

  // ---- supply chain (stage 1) ----
  s.supply = SUPPLY.map((n) => (stage === 0 ? seg(f, n.win[0], n.win[1]) : 1));
  // ---- Wichita (stage 2): barrels, gantries ----
  const jf = stage === 1 ? f : stage > 1 ? 1 : 0;
  const join = seg(u, 1.4, 1.52);
  s.barrel = {
    b48: { dx: -120 * (1 - join) }, b46: { dx: -40 * (1 - join) }, b43: { dx: 40 * (1 - join) }, b41: { dx: 120 * (1 - join) },
  };
  s.gantry = [0, 1, 2, 3].map((i) => seg(u, 1.15 + 0.02 * i, 1.34 + 0.02 * i));
  s.gantryOn = u > 1.15 && u < 1.38;
  // ---- train ----
  s.train = { x: trainX(u), show: u >= 1 && u < 3.7 };
  s.cart = { show: pl.cart, x: pl.x + CENTRE, z: pl.z - ZYARD };
  // the cradle under the fuselage rides with it from the join at Wichita until the main gear is on, except while the crane carries it
  s.cradle = u >= 1.56 && u < 5 && (day < 3.25 || day > 3.8) && day < 4.9;

  // ---- wings, tail, engines, gear: offsets per assembly ----
  const origin = { x: pl.x, y: pl.y, z: pl.z };
  const bayOff = (side) => {
    const b = side > 0 ? WING_BAY.P : WING_BAY.S;
    return { x: b.x - origin.x, y: b.y - origin.y, z: b.z - origin.z + 0 };
  };
  const asm = {};
  const wingAt = (side, a, b) => {
    const p = clamp((day - a) / (b - a));
    const bo = bayOff(side);
    if (u < 3.0) return { o: 1, dx: bo.x, dy: bo.y, dz: bo.z };
    const c = carry(p);
    const sc = c.s;
    return { o: 1, dx: bo.x * (1 - sc), dy: bo.y * (1 - sc), dz: bo.z * (1 - sc) + c.lift, p };
  };
  asm.wingS = wingAt(-1, 4.0, 4.3);
  asm.wingP = wingAt(1, 4.25, 4.55);
  if (u >= 4) { asm.wingS = { o: 1, dx: 0, dy: 0, dz: 0 }; asm.wingP = { o: 1, dx: 0, dy: 0, dz: 0 }; }
  if (u >= 3 && u < 4) {
    // wing carried by the crane (schematic); the carrying only happens while day is within the windows
    asm.wingS = wingAt(-1, 4.0, 4.3);
    asm.wingP = wingAt(1, 4.25, 4.55);
  }
  // day 4 lies at the end of stage 4: keep carrying until the plane's day passes 4.55 (stage 4 holds days up to 5, so the rule above covers u<4)
  for (const k of ['htailS', 'htailP']) {
    const side = k === 'htailP' ? 1 : -1;
    const p = seg(day, 4.62, 4.8);
    asm[k] = { o: u < 3 ? 0 : p, dx: 0, dy: side * 110 * (1 - p), dz: 0 };
  }
  const pg = seg(day, 4.78, 4.95);
  asm.mlgS = asm.mlgP = asm.mlgdoorS = asm.mlgdoorP = { o: u < 3 ? 0 : pg, dx: 0, dy: 0, dz: -40 * (1 - pg) };
  asm.nlg = asm.nlgdoor = { o: u < 3 ? 0 : pg, dx: 0, dy: 0, dz: -40 * (1 - pg) };
  for (const k of ['engS', 'engP']) {
    const side = k === 'engP' ? 1 : -1;
    const a = k === 'engP' ? 9.0 : 9.12;
    const roll = seg(day, a, a + 0.4);
    const rise = seg(day, a + 0.4, a + 0.7);
    const o = day < a ? 0 : 1;
    asm[k] = { o: u < 3 ? 0 : o, dx: 0, dy: side * 220 * (1 - roll), dz: -1.5 * (1 - rise) };
  }
  s.conveyor = { show: u >= 5 && u < 6 && day >= 7.95 && day < 8.75 };
  for (const b of ['b48', 'b46', 'b43', 'b41']) asm[b] = { o: 1, dx: s.barrel[b].dx, dy: 0, dz: 0 };
  s.engineCart = { show: day >= 8.9 && day < 9.95, roll: [seg(day, 9.0, 9.4), seg(day, 9.12, 9.52)], rise: [seg(day, 9.4, 9.7), seg(day, 9.52, 9.82)] };
  s.asm = (name) => asm[name] || { o: 1, dx: 0, dy: 0, dz: 0 };

  // ---- parts ----
  const part = (id) => {
    const r = ruleOf(id);
    if (!r) return { o: stage >= 1 || u >= 1 ? 1 : 0, dx: 0, dy: 0, dz: 0 };
    const [a, b, kind, amt] = r;
    const c = u < 3 ? u : tl;
    const p = seg(c, a, b);
    if (p <= 0) return { o: 0, dx: 0, dy: 0, dz: 0 };
    const o = kind === 'carry' ? 1 : clamp(p * 2.2);
    if (kind === 'drop') return { o, dx: 0, dy: 0, dz: amt * (1 - p) };
    if (kind === 'side') return { o, dx: 0, dy: amt * (1 - p), dz: 0 };
    if (kind === 'slide') return { o, dx: amt * (1 - p), dy: 0, dz: 0 };
    if (kind === 'rise') return { o, dx: 0, dy: 0, dz: -amt * (1 - p) };
    if (kind === 'carry') {
      // the vertical fin is lifted by the overhead crane from beside the line
      const q = clamp((day - 4.5) / 0.25);
      const c2 = carry(q);
      return { o: day < 4.5 ? 0 : 1, dx: 0, dy: 180 * (1 - c2.s), dz: 60 * (1 - c2.s) + c2.lift };
    }
    return { o, dx: 0, dy: 0, dz: 0 };
  };
  s.part = part;

  // ---- overhead crane (hall) ----
  let crane = { show: false, x: 0, y: 0, z: CRANE_Z, load: null };
  if (u >= 3 && u < 5) {
    const px = pl.x + CENTRE;
    const hook = (x, y, z, load) => ({ show: true, x, y, z, load });
    if (day >= 3.15 && day < 3.9) {
      const q = seg(day, 3.15, 3.25);
      crane = hook(px, 0, lerp(CRANE_Z, pl.z + 19 + 52, q), 'fus');
    } else if (day >= 4.0 && day < 4.3) {
      const w = asm.wingS; const q = clamp((day - 4.0) / 0.3);
      crane = hook(pl.x + w.dx + 200, pl.y + w.dy - 90, pl.z + w.dz + 30 + (1 - seg(q, 0, 0.12)) * 100, 'wingS');
    } else if (day >= 4.25 && day < 4.55) {
      const w = asm.wingP; const q = clamp((day - 4.25) / 0.3);
      crane = hook(pl.x + w.dx + 200, pl.y + w.dy + 90, pl.z + w.dz + 30 + (1 - seg(q, 0, 0.12)) * 100, 'wingP');
    } else if (day >= 4.5 && day < 4.8) {
      const r = part('fin');
      crane = hook(pl.x + 28 + r.dx, pl.y + r.dy, pl.z + 90 + r.dz + 20, 'fin');
    } else if (day >= 3.0 && day < 3.15) crane = { show: true, x: lerp(px + 500, px, seg(day, 3.0, 3.15)), y: 0, z: CRANE_Z, load: null };
    else if (day >= 3.9 && day < 4.0) crane = { show: true, x: px, y: 0, z: lerp(pl.z + 70, CRANE_Z, seg(day, 3.9, 4.0)), load: null };
  }
  s.crane = crane;

  // ---- effects ----
  s.ground = { shadow: u >= 7 && pl.z > GZ + 1 };
  s.engineRun = u >= 6 && u < 7 ? seg(u - 6, 0.5, 0.58) * (1 - seg(u - 6, 0.78, 0.86)) : 0;
  s.fuelTruck = { show: u >= 6.18 && u < 6.5, on: u >= 6.24 && u < 6.46 };
  s.fuelL = u < 6 ? 0 : u < 7 ? Math.round(17500 * seg(u - 6, 0.24, 0.46) / 10) * 10 : 17500;

  // ---- readouts ----
  const rows = [...Array(SEAT_ROWS).keys()].map((i) => partProgress('seat_row_' + String(i + 1).padStart(2, '0'), tl));
  const seatRows = u < 3 ? 0 : rows.filter((p) => p >= 0.999).length;
  const wingParts = ['wing_lower_skin_s', 'wing_spar_front_s', 'wing_spar_rear_s', 'wing_ribs_s', 'wing_stringers_s', 'wing_fuel_tank_s', 'wing_upper_skin_s', 'slats_s', 'spoilers_s', 'flap_in_s', 'flap_out_s', 'aileron_s', 'flap_fairings_s', 'winglet_s', 'wing_tip_light_s'];
  const fitted = wingParts.filter((id) => partProgress(id, tl) >= 0.999).length * 2;
  s.ro = {
    crates: stage === 0 ? s.supply.filter((p) => p >= 0.999).length : COUNTS.crates,
    sections: u >= 1.52 ? 4 : [0, 1, 2, 3].filter((i) => u >= 1.24 + 0.035 * i).length,
    rail: u < 1.66 ? 0 : u < 2 ? Math.round(3500 * seg(u, 1.66, 1.99)) : 3500,
    wingparts: u < 2 ? 0 : fitted,
    day: Math.round(day * 10) / 10,
    wire: Math.round(WIRE_KM * seg(tl, 3 + 2.0, 3 + 3.0) * 10) / 10,
    speedcm: u >= 3 && u < 6 && day >= 4 ? 5 : 0,
    tests: u < 3 ? 0 : [day >= 3.5, day >= 5.9, day >= 6.05, day >= 7.4, day >= 7.9, day >= 8].filter(Boolean).length,
    jack: Math.round(70.3 * lift * 10) / 10,
    rows: seatRows,
    engines: asm.engS.o > 0 ? (asm.engP.o > 0 ? 2 : 1) : asm.engP.o > 0 ? 1 : 0,
    fuel: s.fuelL,
    n1: u < 6.5 ? 0 : Math.round(24 + 66 * s.engineRun),
    kt: take ? Math.round(take.v * KT) : 0,
    dist: take ? Math.round(take.dist) : 0,
    pitch: take ? Math.round(take.pitch * 10) / 10 : 0,
    alt: take ? Math.round(take.alt) : 0,
    thrust: take ? Math.round(take.thrustKN * 10) / 10 : u >= 7 ? 0 : 0,
  };
  // total named parts fitted (counts the build-up from the rules; parts with no rule are present from the start)
  s.focus = cameraOf(u, pl, day);
  return s;
}

export const TAKEOFF = { events: TO_EVENTS, at: takeoffAt, TO };
