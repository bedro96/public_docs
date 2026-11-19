// The take-off, simulated: a point-mass model with a constant-thrust-with-lapse engine, quadratic drag and a lift curve linear in pitch.
// Every number in it is an ESTIMATE or an ASSUMPTION (see TO below); the engine rating itself (130.41 kN, LEAP-1B28) is the verified one.
// Pure: runs in Node (tests, build) and in the browser. The table is built once, then the page only reads it by time.
export const G0 = 9.80665;
export const KT = 1.943844; // m/s -> kt
export const TO = {
  mass: 68000, // kg: light production/test flight, ~45 t empty + fuel + test gear  [assumption]
  S: 127, // m2 wing area [estimate for the 737-8 family]
  thrust: 130410, // N per engine, LEAP-1B28 rated take-off thrust at sea level [verified, certification data sheet]
  engines: 2,
  lapse: 1 / 420, // thrust falls ~16% by 70 m/s (ram-drag lapse) [estimate]
  mu: 0.02, // rolling friction coefficient [estimate]
  cd0: 0.065, // zero-lift drag, gear down, flaps for take-off [estimate]
  cdGearUp: 0.02, // drag removed when the gear is up [estimate]
  k: 0.045, // induced drag factor [estimate]
  cl0: 0.95, // lift coefficient at zero pitch, take-off flaps [estimate]
  clAlpha: 0.11, // per degree [estimate]
  vrKt: 130, // rotation speed [estimate; light production aircraft are quoted around 125-135 kt]
  rotRate: 2.5, // deg/s, the usual 2-3 deg/s [verified-secondary]
  pitchTarget: 15, // deg initial climb attitude [verified-secondary]
  pitchHold: 13,
  gearDelay: 4, // s after lift-off before the gear lever goes up [estimate]
  gearTime: 10, // s for the gear to fold, "8-12 s" [estimate]
  bankDeg: 18, // gentle turn toward Boeing Field
  tEnd: 46,
};
const RHO = 1.225;
const smooth = (t) => t * t * (3 - 2 * t);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

// thrust fraction of the rated value: engines spool up with the brakes on (t < 0), then power is set (0 <= t < 3)
export function thrustFrac(t) {
  if (t < -4) return 0.08;
  if (t < 0) return 0.08 + 0.5 * smooth((t + 4) / 4);
  if (t < 3) return 0.58 + 0.42 * smooth(t / 3);
  return 1;
}

function simulate() {
  const dt = 0.02;
  const rows = [];
  const ev = { vr: null, lof: null, gear0: null, gear1: null, bank0: null, v2: null, h35: null };
  let t = 0; let s = 0; let v = 0.0; let theta = 0; let gamma = 0; let h = 0; let psi = 0; let phi = 0; let y = 0; let air = false; let rot = false;
  let g = 0; let thrAt = 0;
  const W = TO.mass * G0;
  const row = () => rows.push([t, s, v, theta, h, psi, phi, y, g, thrustFrac(t) * TO.thrust / 1000, gamma]);
  row();
  const N = Math.round(TO.tEnd / dt);
  for (let i = 0; i < N; i++) {
    thrAt = thrustFrac(t);
    const T = TO.engines * TO.thrust * thrAt * Math.max(0.3, 1 - v * TO.lapse);
    const q = 0.5 * RHO * v * v;
    // gear position from the lift-off time on
    if (ev.lof !== null) g = clamp((t - ev.lof - TO.gearDelay) / TO.gearTime);
    if (g > 0 && ev.gear0 === null) ev.gear0 = t;
    if (g >= 1 && ev.gear1 === null) ev.gear1 = t;
    const alpha = theta - (gamma * 180) / Math.PI;
    const CL = TO.cl0 + TO.clAlpha * alpha;
    const L = q * TO.S * CL;
    const D = q * TO.S * (TO.cd0 - TO.cdGearUp * smooth(g) + TO.k * CL * CL);
    if (!air) {
      if (v * KT >= TO.vrKt && !rot) { rot = true; ev.vr = t; }
      if (rot) theta = Math.min(TO.pitchTarget, theta + TO.rotRate * dt);
      const a = (T - D - TO.mu * Math.max(0, W - L)) / TO.mass;
      v += a * dt; s += v * dt;
      if (L >= W) { air = true; ev.lof = t; }
    } else {
      const a = (T * Math.cos((alpha * Math.PI) / 180) - D - W * Math.sin(gamma)) / TO.mass;
      v += a * dt;
      gamma += ((L + T * Math.sin((alpha * Math.PI) / 180) - W * Math.cos(gamma)) / (TO.mass * v)) * dt;
      // pitch: continue to the initial attitude, then settle to the holding attitude once well clear of the ground
      const want = t - ev.lof < 12 ? TO.pitchTarget : TO.pitchHold;
      theta += clamp(want - theta, -TO.rotRate * 0.5 * dt, TO.rotRate * dt);
      h += v * Math.sin(gamma) * dt;
      if (h >= 10.7 && ev.h35 === null) { ev.h35 = t; ev.v2 = v; }
      // gentle left turn once clear of the ground (positive yaw = toward +y, the viewer's side)
      if (h > 60 && ev.bank0 === null) ev.bank0 = t;
      let target = 0;
      if (ev.bank0 !== null) {
        const tt = t - ev.bank0;
        target = (-TO.bankDeg * Math.PI / 180) * smooth(clamp(tt / 5)) * (1 - smooth(clamp((tt - 14) / 5)));
      }
      phi += clamp(target - phi, -0.06 * dt * 60, 0.06 * dt * 60);
      psi += (G0 * Math.tan(-phi)) / v * dt;
      s += v * Math.cos(gamma) * Math.cos(psi) * dt;
      y += v * Math.cos(gamma) * Math.sin(psi) * dt;
    }
    t += dt;
    row();
  }
  return { dt, rows, ev };
}

let SIM = null;
export const sim = () => SIM || (SIM = simulate());
export const TO_EVENTS = () => sim().ev;

// state at sim time t (seconds after brake release; negative = engines spooling, brakes on)
export function takeoffAt(t) {
  const { rows, dt, ev } = sim();
  const idx = clamp(t / dt, 0, rows.length - 1);
  const i = Math.floor(idx);
  const j = Math.min(rows.length - 1, i + 1);
  const a = idx - i;
  const m = (k) => rows[i][k] + (rows[j][k] - rows[i][k]) * a;
  const airborne = ev.lof !== null && t >= ev.lof;
  return {
    t,
    dist: t < 0 ? 0 : m(1),
    v: t < 0 ? 0 : m(2),
    pitch: t < 0 ? 0 : m(3),
    alt: t < 0 ? 0 : m(4),
    psi: t < 0 ? 0 : m(5),
    phi: t < 0 ? 0 : m(6),
    y: t < 0 ? 0 : m(7),
    gear: t < 0 ? 0 : m(8),
    thrustKN: thrustFrac(t) * TO.thrust / 1000,
    gamma: t < 0 ? 0 : m(10),
    airborne,
    phase: t < 0 ? 'spool' : !airborne ? (ev.vr !== null && t >= ev.vr ? 'rotate' : 'roll') : t - ev.lof < 3 ? 'liftoff' : 'climb',
  };
}
