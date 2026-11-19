// The hero airliner: a Boeing 737 MAX 8-class twin-jet, built once as named parts around its own origin.
// Plane-local axes: x from the tail (0) to the nose (395), y across (+y = port, toward the viewer), z up with the fuselage axis at 0.
// Units are 0.1 m. Stations are measured from the nose like the real drawings and converted with X(s) = 395 - s.
// Every visible piece is a <g data-p="id">; groups that fly in together (a barrel, a wing, an engine, a gear leg) are <g data-asm="name">.
// The painter order inside #plane is fixed and correct for a viewer at +x +y +z; what appears, moves or retracts is decided by the live code.
import { k, G, S, L, D, P, at, pathOf, polyPath, loft, PL, R } from './world.js';
import { rad, NOSE0, TJ, CT, ST, FX, FT, TAIL_LEN, tailR, tailSlope, rAt, bodyPt } from './hull.js';
import { wingParts, WING_ORDER } from './wings.js';
import { finParts, stabParts, apuExhaust } from './tail.js';
import { engineParts, ENG_ORDER, ENG_CLASS, mainGearParts, mainGearDoor, noseGearParts, noseGearDoor } from './engines.js';
import { cabinDefs, cabinSvg, systemsSvg } from './cabin.js';

export const SECTIONS = [
  // [id, station from, station to] in stations (nose = 0). Boundaries are an estimate; the real section drawings are not public.
  ['radome', 0, 26],
  ['b41', 26, 72],
  ['b43', 72, 230],
  ['b46', 230, 305],
  ['b48', 305, 395],
];
export const FRAME_PITCH = 5.1; // 20 in, typical 737 frame spacing [estimate]

// ---------- fuselage surface (shared maths lives in hull.js) ----------
const dropOnBody = (x, th, inset = 0) => at(...bodyPt(x, th, inset));
const ringPoly = (x0, x1, t0, t1, n = 5, inset = 0) => {
  // rounded-ish rectangle on the skin in (x, theta)
  const pts = [];
  const c = Math.min(1.2, (x1 - x0) * 0.2);
  const cd = Math.min(5, (t1 - t0) * 0.15);
  const e = [[x0 + c, t0], [x1 - c, t0], [x1, t0 + cd], [x1, t1 - cd], [x1 - c, t1], [x0 + c, t1], [x0, t1 - cd], [x0, t0 + cd]];
  for (let i = 0; i < e.length; i++) {
    const [ax, at0] = e[i];
    const [bx, bt] = e[(i + 1) % e.length];
    for (let j = 0; j < n; j++) pts.push(dropOnBody(ax + ((bx - ax) * j) / n, at0 + ((bt - at0) * j) / n, inset));
  }
  return polyPath(pts);
};
const oval = (xc, tc, hw, ht, n = 10) => {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push(dropOnBody(xc + hw * Math.cos(a), tc + ht * Math.sin(a)));
  }
  return polyPath(pts);
};
const seg = (p, q) => k.segment(p, q, P);
const wrap = (id, inner, cls = '', extra = '') => `<g data-p="${id}"${cls ? ` class="${cls}"` : ''}${extra}>${inner}</g>`;
const asm = (name, inner, extra = '') => `<g data-asm="${name}"${extra}>${inner}</g>`;
const skin = (id, inner, cls = 'm-green') => `<g data-p="${id}" data-skin class="${cls}">${inner}</g>`;
const style = (o = {}) => ({ tone: 'hi', crease: 'faint', ...o });

// ---------- fuselage barrels ----------
const knots = (x0, x1, n) => {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    out.push([x, rAt(x), 1]);
  }
  return out;
};
function barrelSkin(id, x0, x1) {
  let profile;
  if (x1 <= NOSE0 || x0 >= TJ) {
    if (x0 >= NOSE0) profile = knots(x0, x1, 8);
    else if (x1 > NOSE0) profile = [[x0, R], ...knots(NOSE0, x1, 8)];
    else profile = [[x0, R], [x1, R]];
  }
  return S(G.solidOf(profile, FX, P, { steps: 72 }), style({ className: id }));
}
// the radome tip converges to a point: finer knots near the end
function radomeSkin() {
  const xs = [369, 373, 377, 381, 385, 388, 390.5, 392.5, 394, 395];
  const profile = xs.map((x) => [x, rAt(x), 1]);
  return S(G.solidOf(profile, FX, P, { steps: 72 }), style({ tone: 'mid' }));
}
function tailSkin() {
  // x 62..90 is a plain cylinder; the upswept cone is a lathe in the tilted frame, in two bands so the tail fairing is its own part
  const cyl = S(G.solidOf([[TJ, R], [90, R]], FX, P, { steps: 72 }), style());
  const prof = [];
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const s = (TAIL_LEN * i) / n;
    prof.push([s, tailR(s), 1]);
  }
  const cut = TAIL_LEN - 11;
  const B = G.bandsOf(prof, [cut], FT, P, { radius: tailR, slope: tailSlope, steps: 72, rows: 8 });
  const sides = B.sidesOf(0, cut, { ends: false }).d;
  const sidesF = B.sidesOf(cut, TAIL_LEN, { ends: 'last' }).d;
  return {
    cyl,
    cone: S(B.bands[0].paths, style({ tone: 'hi' })) + L(sides, { tone: 'hi' }),
    fairing: S(B.bands[1].paths, style({ tone: 'mid' })) + L(sidesF, { tone: 'hi' }),
  };
}

// frames (rings) and stringers (lines) of one barrel, drawn under the skin
function skeleton(x0, x1) {
  const frames = [];
  const strg = [];
  const first = Math.ceil(x0 / FRAME_PITCH) * FRAME_PITCH;
  for (let x = first; x <= x1 + 0.01; x += FRAME_PITCH) {
    if (x >= TJ) frames.push(G.arcOf(FX, x, rAt(x), P, { slope: x > NOSE0 ? (rAt(x + 0.05) - rAt(x - 0.05)) / 0.1 : 0 }));
    else {
      const s = (TJ - x) / CT;
      frames.push(G.arcOf(FT, s, tailR(s), P, { slope: tailSlope(s) }));
    }
  }
  const V = G.viewOf(P);
  for (let th = -60; th <= 110; th += 8) {
    const a = rad(th);
    if (Math.cos(a) * 0.75 + Math.sin(a) * 0.5 <= 0.04) continue;
    const pts = [];
    for (let i = 0; i <= 6; i++) pts.push(at(...bodyPt(x0 + ((x1 - x0) * i) / 6, th)));
    strg.push(pathOf(pts));
  }
  void V;
  return { frames: frames.join(''), stringers: strg.join('') };
}

// ---------- skin features on the port side ----------
// Window belt: 737-class pitch of ~5.1 units, z about +2.5. Doors and exits are cut out of the belt.
export const DOORS = {
  L1: { x: 307, w: 8, t0: -22, t1: 34, ko: '앞쪽 승객 출입문 L1', en: 'Forward entry door L1' },
  L2: { x: 97, w: 8, t0: -22, t1: 34, ko: '뒤쪽 출입문 L2', en: 'Aft entry door L2' },
};
export const HATCHES = [
  { id: 'hatch_1', x: 227, w: 5, t0: -4, t1: 24 },
  { id: 'hatch_2', x: 217, w: 5, t0: -4, t1: 24 },
];
export const PLUG = { x: 142, w: 6.5, t0: -14, t1: 26 }; // optional mid-exit door plug (variant, as on the 737-8-200 / MAX 9)
const WINDOW_X = [];
for (let x = 298; x > 104; x -= FRAME_PITCH) WINDOW_X.push(Number(x.toFixed(2)));
const blocked = (x) => [...Object.values(DOORS), ...HATCHES, PLUG].some((d) => Math.abs(x - d.x) < d.w / 2 + 3.2);
function windows(x0, x1) {
  const d = WINDOW_X.filter((x) => x >= x0 && x < x1 && !blocked(x)).map((x) => oval(x, 8, 1.3, 6.2, 10)).join('');
  return `<path class="win" d="${d}"/>`;
}
function doorSvg(d) {
  return `<path class="door" d="${ringPoly(d.x - d.w / 2, d.x + d.w / 2, d.t0, d.t1, 4)}"/>` + D([at(...bodyPt(d.x + d.w * 0.28, d.t1 - 22))], { size: 0.9, tone: 'hi' });
}
const hatchSvg = (h) => `<path class="hatch" d="${ringPoly(h.x - h.w / 2, h.x + h.w / 2, h.t0, h.t1, 3)}"/>`;
function cockpit() {
  const front = [[360.5, 49], [372, 49], [371, 79], [361.5, 79]].map(([x, t]) => dropOnBody(x, t));
  const frontS = [[360.5, 101], [372, 101], [371, 131], [361.5, 131]].map(([x, t]) => dropOnBody(x, t));
  const side = [[349, 30], [359.5, 30], [359.5, 60], [349, 60]].map(([x, t]) => dropOnBody(x, t));
  const aft = [[339.5, 32], [347.5, 32], [347.5, 58], [339.5, 58]].map(([x, t]) => dropOnBody(x, t));
  return {
    front: `<path class="winf" d="${polyPath(front)}${polyPath(frontS)}"/>`,
    side: `<path class="winf" d="${polyPath(side)}${polyPath(aft)}"/>`,
  };
}
const probe = (x, th, len = 3.2) => {
  const a = bodyPt(x, th);
  const b = [a[0] + len, a[1] + 0.5, a[2]];
  return L(seg(a, b), { tone: 'hi' }) + D([at(...b)], { size: 0.7, tone: 'hi' });
};

// ---------- wings ----------
const WING_CLASS = {
  wing_lower_skin: 'm-al', wing_spar_front: 'm-steel', wing_spar_rear: 'm-steel', wing_fuel_tank: 'm-fuel', wing_ribs: '', wing_stringers: '',
  wing_upper_skin: 'm-al', slats: 'm-al', spoilers: 'm-comp', flap_in: 'm-al', flap_out: 'm-al', aileron: 'm-comp', flap_fairings: 'm-comp',
  winglet: 'm-comp', wing_tip_light: '',
};
function wingAsm(side) {
  const sfx = side > 0 ? '_p' : '_s';
  const parts = wingParts(side);
  const one = (id) => {
    const cls = WING_CLASS[id];
    const skinned = id === 'wing_upper_skin';
    const lit = id === 'wing_tip_light' ? ` class="${side > 0 ? 'light-r' : 'light-g'}"` : cls ? ` class="${cls}"` : '';
    return `<g data-p="${id}${sfx}"${skinned ? ' data-skin' : ''}${lit}>${parts[id + sfx]}</g>`;
  };
  return asm(side > 0 ? 'wingP' : 'wingS', WING_ORDER.map(one).join(''));
}
function engineAsm(side) {
  const sfx = side > 0 ? '_p' : '_s';
  const parts = engineParts(side);
  return asm(side > 0 ? 'engP' : 'engS', ENG_ORDER.map((id) => (
    // the nacelle is not x-rayed with the fuselage skin: a hung engine must be seen as a solid body on its cart
    `<g data-p="${id}${sfx}" class="${ENG_CLASS[id]}">${parts[id + sfx]}</g>`
  )).join(''));
}
function gearAsm(side) {
  const sfx = side > 0 ? '_p' : '_s';
  const legs = mainGearParts(side).map(([id, svg, cls]) => wrap(id, svg, cls)).join('');
  return asm(side > 0 ? 'mlgP' : 'mlgS', legs) + asm(side > 0 ? 'mlgdoorP' : 'mlgdoorS', wrap('mlg_door' + sfx, mainGearDoor(side), 'm-comp'));
}
const noseAsm = () => asm('nlg', noseGearParts().map(([id, svg, cls]) => wrap(id, svg, cls)).join('')) + asm('nlgdoor', wrap('nlg_door', noseGearDoor(), 'm-comp'));
function stabAsm(side) {
  const sfx = side > 0 ? '_p' : '_s';
  const parts = stabParts(side);
  return asm(side > 0 ? 'htailP' : 'htailS', wrap('h_stab' + sfx, parts['h_stab' + sfx], 'm-comp') + wrap('elevator' + sfx, parts['elevator' + sfx], 'm-comp'));
}

// ---------- the plane ----------
export function planeSvg() {
  const sk = { b41: skeleton(323, 369), b43: skeleton(165, 323), b46: skeleton(90, 165), b48: skeleton(0, 90) };
  const tail = tailSkin();
  const cp = cockpit();
  const fin = finParts();
  const sys = systemsSvg();
  const out = [
    cabinDefs(),
    gearAsm(-1), engineAsm(-1), wingAsm(-1), stabAsm(-1),
    noseAsm(),
    asm('interior', cabinSvg()),
    asm('harness', wrap('wiring_harness', sys.wire) + wrap('hydraulic_lines', sys.hyd)),
    asm('b48',
      wrap('frames_48', `<path class="frame" d="${sk.b48.frames}"/>`) +
      wrap('stringers_48', `<path class="strg" d="${sk.b48.stringers}"/>`) +
      skin('barrel_48', tail.cone + tail.cyl) +
      skin('tailcone', tail.fairing, 'm-comp')),
    asm('b46',
      wrap('frames_46', `<path class="frame" d="${sk.b46.frames}"/>`) +
      wrap('stringers_46', `<path class="strg" d="${sk.b46.stringers}"/>`) +
      skin('barrel_46', barrelSkin('b46', 90, 165)) +
      wrap('windows_46', windows(90, 165)) + wrap('door_l2', doorSvg(DOORS.L2)) +
      wrap('door_plug', `<path class="hatch" d="${ringPoly(PLUG.x - PLUG.w / 2, PLUG.x + PLUG.w / 2, PLUG.t0, PLUG.t1, 3)}"/>`)),
    asm('b43',
      wrap('frames_43', `<path class="frame" d="${sk.b43.frames}"/>`) +
      wrap('stringers_43', `<path class="strg" d="${sk.b43.stringers}"/>`) +
      skin('barrel_43', barrelSkin('b43', 165, 323)) +
      wrap('windows_43', windows(165, 323)) + wrap('door_l1', doorSvg(DOORS.L1)) + wrap('exit_hatches', HATCHES.map(hatchSvg).join(''))),
    asm('b41',
      wrap('frames_41', `<path class="frame" d="${sk.b41.frames}"/>`) +
      wrap('stringers_41', `<path class="strg" d="${sk.b41.stringers}"/>`) +
      skin('barrel_41', barrelSkin('b41', 323, 369)) +
      wrap('cockpit_windows', cp.front + cp.side) +
      wrap('pitot_capt', probe(341, 12)) + wrap('pitot_stby', probe(336, -12))),
    asm('radome', skin('radome', radomeSkin(), 'm-comp')),
    asm('tail',
      wrap('dorsal_fin', fin.dorsal_fin, 'm-green') +
      wrap('fin', fin.fin, 'm-green') +
      wrap('rudder', fin.rudder, 'm-comp') +
      wrap('apu_exhaust', apuExhaust(), 'm-dark')),
    stabAsm(1),
    gearAsm(1), engineAsm(1), wingAsm(1),
  ];
  return `<g id="plane">${out.join('')}</g>`;
}
