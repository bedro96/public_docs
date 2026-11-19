// The scene layer: turns the model's state into attribute changes on the groups that scene.js left empty. Nothing is redrawn per frame:
// the plane is ONE group that gets a transform, parts get a transform / opacity only when their value actually changed, and the few
// small paths (hose, sling, shimmer, vortex) are rebuilt from a handful of points.
import { at, tr, delta, rotate3, fitLinear, matrixOf, pathOf } from './world.js';
import { PIVOT, GZ, CENTRE, CRANE_Z, PITCH, xDay, DECK, RWY } from './layout.js';
import { takeoffAt, TO, TO_EVENTS } from './takeoff.js';
import { GEAR_SAMPLES, MLG, NLG, ENG } from './engines.js';
import { lanePos, BARRELS, jackSvg } from './factory.js';
import { partKey } from './data.js';

const DEG = Math.PI / 180;
const LOF = TO_EVENTS().lof;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const seg = (v, a, b) => smooth(clamp((v - a) / (b - a)));
const q = (v, n = 4) => Math.round(v * n) / n; // quantise a world offset to a quarter unit (about 2.5 cm)
const SLOTS = 10;

// ---------- cached attribute writes: a value is only written to the DOM when it differs from the last one ----------
const memo = new WeakMap();
const jackKey = new WeakMap();
function attr(el, name, val) {
  if (!el) return;
  let m = memo.get(el);
  if (!m) { m = {}; memo.set(el, m); }
  const v = val === null || val === undefined ? '' : String(val);
  if (m[name] === v) return;
  m[name] = v;
  if (v === '') el.removeAttribute(name); else el.setAttribute(name, v);
}
const showEl = (el, on) => attr(el, 'display', on ? null : 'none');
const opac = (el, o) => attr(el, 'opacity', o >= 0.985 ? null : o.toFixed(2));

// points spread over the whole aircraft: the least-squares fit of a 3D rotation to a 2D map uses them
const PLANE_SAMPLES = [[0, 0, 0], [395, 0, 0], [300, 0, 0], [100, 0, 0], [194, 179, -10], [194, -179, -10], [30, 0, 90], [12, 72, 5], [12, -72, 5],
  [209, 56, -17], [209, -56, -17], [194, 0, -32], [194, 0, 19], [194, 0, -19], [330, 0, 10], [160, 90, -8], [160, -90, -8]];

export function makeScene() {
  const el = (id) => document.getElementById(id);
  const E = {
    pwrap: el('pwrap'), plane: el('plane'), pfx: el('pfx'), shim: el('shim'), shimS: el('shimS'), shimP: el('shimP'),
    shadow: el('shadow'), cradle: el('cradle'), cartFus: el('cart-fus'), train: el('train'),
    crane: el('crane'), trolley: el('crane-trolley'), hook: el('crane-hook'), cable: el('crane-cable'), sling: el('crane-sling'),
    jacksFar: el('jacks-far'), jacksNear: el('jacks-near'), fuel: el('fuel'), hose: el('hose'), conv: el('conv'),
    cartS: el('cart-eng-S'), cartP: el('cart-eng-P'), vortS: el('vortS'), vortP: el('vortP'), sky: el('sky'),
  };
  const crates = Array.from({ length: 6 }, (_, i) => el(`crate-${i}`));
  const jigs = Object.fromEntries(BARRELS.map((b) => [b, el(`jig-${b}`)]));
  const gantry = BARRELS.map((b) => ({ b, back: el(`gantry-b-${b}`), front: el(`gantry-f-${b}`), head: el(`head-${b}`), spark: el(`spk-${b}`) }));
  const ghosts = Array.from({ length: SLOTS }, (_, j) => ({ g: el(`gh-${j}`), u: [0, 1, 2].map((l) => el(`gu${l}-${j}`)) }));
  // parts and assemblies of the aircraft
  const parts = [...E.plane.querySelectorAll('[data-p]')].map((g) => {
    const a = g.closest('[data-asm]');
    return { g, id: g.dataset.p, skin: g.hasAttribute('data-skin'), asm: a ? a.dataset.asm : '', key: partKey(g.dataset.p) };
  });
  const asmEls = {};
  E.plane.querySelectorAll('[data-asm]').forEach((g) => { asmEls[g.dataset.asm] = g; });
  const pwrap = E.pwrap;

  // ---------- fits of the whole-aircraft pose (cached by angle) ----------
  const fits = new Map();
  const poseFit = (yaw, pitch, roll) => {
    const key = [yaw, pitch, roll].map((v) => Math.round(v / DEG * 20)).join('|');
    let f = fits.get(key);
    if (!f) {
      if (fits.size > 800) fits.clear();
      f = fitLinear(PLANE_SAMPLES, PIVOT, yaw, pitch, roll);
      fits.set(key, f);
    }
    return f;
  };
  const gfit = new Map();
  const gearFit = (kind, side, g) => {
    const key = `${kind}${side}|${Math.round(g * 100)}`;
    let f = gfit.get(key);
    if (!f) {
      if (kind === 'm') f = fitLinear(GEAR_SAMPLES.main(side), [MLG.x, side * MLG.y, MLG.top], 0, 0, -side * Math.PI / 2 * g);
      else f = fitLinear(GEAR_SAMPLES.nose(), [NLG.x, 0, NLG.top], 0, (Math.PI / 2) * g, 0);
      gfit.set(key, f);
    }
    return f;
  };
  const flat = (a) => (Math.abs(a) < 1e-4);

  // the tip of a wing at a past moment of the take-off, in world coordinates
  const TIP = [160, 0, -10];
  const tipWorld = (side, t) => {
    const st = takeoffAt(t);
    const p = rotate3([TIP[0], side * 179, TIP[2]], PIVOT, st.psi, (st.pitch * Math.PI) / 180, st.phi);
    const ox = RWY.start - PIVOT[0] + st.dist * 10;
    return [p[0] + ox, p[1] + st.y * 10, p[2] + GZ + st.alt * 10, st.alt];
  };

  // ---------- the hose of the fuel truck: from the truck's port to the wing's underside, with a sag (truck-local coordinates) ----------
  const hosePath = (planeZ) => {
    const a = [-6, -13, 12];
    const b = [-30, -125, planeZ - 11];
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      pts.push(at(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t) - 16 * Math.sin(Math.PI * t) * (1 - 0.3 * t)));
    }
    return pathOf(pts);
  };

  // ---------- one frame ----------
  function apply(s, fxT) {
    const pl = s.plane;
    const take = s.take;
    let attached = 0;
    const moving = new Map(); // what is being fitted right now: key -> how far it still has to go

    // ===== the aircraft =====
    showEl(pwrap, pl.vis);
    if (pl.vis) {
      let tf;
      if (flat(pl.yaw) && flat(pl.pitch) && flat(pl.roll)) tf = tr(q(pl.x), q(pl.y), q(pl.z));
      else {
        const [dx, dy] = delta(pl.x, pl.y, pl.z);
        tf = matrixOf(poseFit(pl.yaw, pl.pitch, pl.roll), dx, dy);
      }
      attr(pwrap, 'transform', tf || null);
      attr(pwrap, 'data-primed', s.primed ? '1' : '0');
      attr(pwrap, 'data-power', s.power ? '1' : '0');
      // assemblies (wings, engines, tail surfaces, gear, barrels): offset and opacity; the gear also folds
      const asmO = {};
      for (const [name, g] of Object.entries(asmEls)) {
        const a = s.asm(name);
        let o = a.o;
        asmO[name] = o;
        const gear = name === 'mlgS' || name === 'mlgP' ? ['m', name === 'mlgP' ? 1 : -1, s.gear.main] : name === 'nlg' ? ['n', 0, s.gear.nose] : null;
        const door = name === 'mlgdoorS' || name === 'mlgdoorP' || name === 'nlgdoor';
        if (door) o *= 1 - 0.85 * s.gear.doors;
        if (gear && gear[2] >= 0.98) o = 0;
        const on = o > 0.01;
        showEl(g, on);
        if (!on) continue;
        opac(g, o);
        let t = tr(q(a.dx), q(a.dy), q(a.dz));
        if (gear && gear[2] > 0.005) t += ` ${matrixOf(gearFit(gear[0], gear[1], gear[2]), 0, 0)}`;
        attr(g, 'transform', t.trim() || null);
        // a wing standing in its bay (before the line) is not "being fitted"
        const d = Math.abs(a.dx) + Math.abs(a.dy) + Math.abs(a.dz);
        const wingWait = (name === 'wingS' || name === 'wingP') && s.u < 3;
        if (d > 0.8 && a.o > 0.05 && !wingWait && !door && s.u < 7) moving.set(`a:${name}`, d);
      }
      // parts
      for (const r of parts) {
        const p = s.part(r.id);
        const o = r.skin ? p.o * s.skin : p.o;
        const on = o > 0.01;
        showEl(r.g, on);
        if (p.o >= 0.99 && (!r.asm || asmO[r.asm] >= 0.99)) attached++;
        if (!on) continue;
        opac(r.g, o);
        attr(r.g, 'transform', tr(q(p.dx), q(p.dy), q(p.dz)) || null);
        const d = Math.abs(p.dx) + Math.abs(p.dy) + Math.abs(p.dz);
        if (d > 0.8 && p.o > 0.05 && r.key && s.u < 7) moving.set(`p:${r.key}`, Math.max(d, moving.get(`p:${r.key}`) || 0));
      }
    }

    // ===== pressure arrows, shimmer behind the engines =====
    showEl(E.pfx, s.fx.pressure && pl.vis);
    if (s.fx.pressure) opac(E.pfx, 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(fxT * 5)));
    const burn = take ? clamp(take.thrustKN / (TO.thrust / 1000)) * (take.phase === 'spool' && take.t < -4 ? 0.3 : 1) : s.engineRun;
    const shimOn = burn > 0.04 && pl.vis;
    showEl(E.shim, shimOn);
    if (shimOn) {
      const ph = Math.round(fxT * 12) / 12;
      for (const [node, side] of [[E.shimS, -1], [E.shimP, 1]]) {
        const d = [];
        for (let ln = 0; ln < 3; ln++) {
          const pts = [];
          for (let i = 0; i <= 8; i++) {
            const w = Math.sin(ph * 9 + i * 1.25 + ln * 2.1);
            pts.push(at(ENG.x0 - 2 - i * 4.4, side * ENG.y + (ln - 1) * 3.2 + w * 0.9 * (i / 8 + 0.2), ENG.z + (ln - 1) * 2.6 + Math.cos(ph * 7 + i + ln) * 0.8));
          }
          d.push(pathOf(pts));
        }
        attr(node, 'd', d.join(''));
      }
      opac(E.shim, 0.25 + 0.75 * burn);
    }

    // ===== wing-tip vortices: the past positions of both tips for a few seconds after lift-off =====
    let vt = 0;
    if (take && take.airborne && take.alt > 0.5) vt = 1 - seg(take.t - LOF, 7, 15);
    for (const [node, side] of [[E.vortS, -1], [E.vortP, 1]]) {
      const on = vt > 0.02;
      showEl(node, on);
      if (!on) continue;
      const pts = [];
      for (let i = 0; i <= 14; i++) {
        const w = tipWorld(side, take.t - i * 0.18);
        if (w[3] > 0.4) pts.push(at(w[0], w[1], w[2]));
      }
      attr(node, 'd', pts.length > 1 ? pathOf(pts) : '');
      opac(node, vt);
    }

    // ===== shadow and cradle =====
    showEl(E.sky, !!take && take.alt > 6);
    const shadowOn = s.u >= 6.1 && pl.vis;
    showEl(E.shadow, shadowOn);
    if (shadowOn) {
      const alt = take ? take.alt : 0;
      opac(E.shadow, 0.9 * (1 - clamp(alt / 180)));
      if (flat(pl.yaw)) attr(E.shadow, 'transform', tr(q(pl.x), q(pl.y), GZ) || null);
      else {
        const [dx, dy] = delta(pl.x, pl.y, GZ);
        attr(E.shadow, 'transform', matrixOf(poseFit(pl.yaw, 0, 0), dx, dy));
      }
    }
    showEl(E.cradle, s.cradle && pl.vis);
    if (s.cradle) attr(E.cradle, 'transform', tr(q(pl.x), q(pl.y), q(pl.z)) || null);
    showEl(E.cartFus, s.cart.show);
    if (s.cart.show) attr(E.cartFus, 'transform', tr(q(pl.x), q(pl.y), q(s.cart.z)) || null);

    // ===== jacks =====
    const jk = s.plane.jacks > 0.003;
    showEl(E.jacksFar, jk);
    showEl(E.jacksNear, jk);
    if (jk) {
      const top = pl.z - 11;
      const key = `${Math.round(pl.jacks * 50)}`;
      for (const [node, list] of [[E.jacksFar, [[190, -70], [310, 0]]], [E.jacksNear, [[190, 70]]]]) {
        attr(node, 'transform', tr(q(pl.x), q(pl.y), 0) || null);
        if (jackKey.get(node) !== key) {
          jackKey.set(node, key);
          node.innerHTML = list.map(([x, y]) => jackSvg(x, y, top)).join('');
        }
      }
    }

    // ===== fuel truck, conveyor, engine carts =====
    showEl(E.fuel, s.fuelTruck.show);
    if (s.fuelTruck.show) {
      attr(E.fuel, 'transform', tr(q(pl.x + 220), q(pl.y + 250), 0) || null);
      showEl(E.hose, s.fuelTruck.on);
      if (s.fuelTruck.on) attr(E.hose, 'd', hosePath(pl.z));
    }
    showEl(E.conv, s.conveyor.show);
    if (s.conveyor.show) attr(E.conv, 'transform', tr(q(pl.x), q(pl.y), 0) || null);
    for (const [node, side, name] of [[E.cartS, -1, 'engS'], [E.cartP, 1, 'engP']]) {
      const a = s.asm(name);
      const on = s.engineCart.show && a.o > 0.01;
      showEl(node, on);
      if (on) attr(node, 'transform', tr(q(pl.x + ENG.x0 + ENG.len / 2 + a.dx), q(pl.y + side * ENG.y + a.dy), 0) || null);
    }

    // ===== the crane =====
    const c = s.crane;
    showEl(E.crane, c.show);
    if (c.show) {
      attr(E.crane, 'transform', tr(q(c.x), 0, 0) || null);
      attr(E.trolley, 'transform', tr(0, q(c.y), 0) || null);
      attr(E.hook, 'transform', tr(0, q(c.y), q(c.z)) || null);
      attr(E.cable, 'd', pathOf([at(0, c.y, CRANE_Z + 14), at(0, c.y, c.z)]));
      let sd = '';
      if (c.load) {
        const [hx, dz] = c.load === 'fus' ? [110, 52] : c.load === 'fin' ? [18, 20] : [35, 30];
        sd = pathOf([at(-hx, c.y, c.z - dz), at(0, c.y, c.z), at(hx, c.y, c.z - dz)]);
      }
      attr(E.sling, 'd', sd);
    }

    // ===== train, crates, jigs, gantries =====
    showEl(E.train, s.train.show);
    if (s.train.show) attr(E.train, 'transform', tr(q(s.train.x), 0, 0) || null);
    crates.forEach((g, i) => {
      const p = s.supply[i];
      const on = s.u < 1 && p > 0.001;
      showEl(g, on);
      if (on) { const [x, y] = lanePos(i, p); attr(g, 'transform', tr(q(x), q(y), 0) || null); }
    });
    for (const b of BARRELS) attr(jigs[b], 'transform', tr(q(s.barrel[b].dx), 0, 0) || null);
    gantry.forEach((gr, i) => {
      const on = s.gantryOn && s.gantry[i] > 0.002;
      showEl(gr.back, on);
      showEl(gr.front, on);
      if (!on) return;
      attr(gr.head, 'transform', tr(0, q(28 * Math.sin(s.u * 70 + i * 1.7)), 0) || null);
      showEl(gr.spark, Math.floor(fxT * 16 + i) % 2 === 0);
    });

    // ===== the aircraft on the line (ghosts) =====
    const gf = seg(s.u, 2.3, 2.9) * (1 - seg(s.u, 6.0, 6.6));
    const d1 = Math.max(s.day, 1);
    const base = 1 + (d1 - 1) - Math.floor(d1 - 1);
    ghosts.forEach((gh, k) => {
      const p = base + k;
      const hero = s.day >= 1 && Math.abs(p - s.day) < 0.02;
      const on = gf > 0.01 && p <= 10.9 && !hero;
      showEl(gh.g, on);
      if (!on) return;
      const fl = Math.floor(p);
      const x = p < 3 ? xDay(fl) + PITCH * seg(p - fl, 0.72, 1) : xDay(p);
      const zoff = GZ + (p <= 3.3 ? DECK : lerp(DECK, 0, seg(p, 3.3, 3.9)));
      attr(gh.g, 'transform', tr(q(x - CENTRE), 0, q(zoff)) || null);
      const l1 = seg(p, 4, 4.3);
      const l2 = seg(p, 9, 9.3);
      const lv = [1 - l1, l1 * (1 - l2), l2];
      const edge = 1 - seg(p, 10.2, 10.9);
      gh.u.forEach((u, l) => { showEl(u, lv[l] > 0.02); opac(u, lv[l] * gf * edge); });
    });
    return { attached, moving: [...moving.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]) };
  }
  return { apply, partCount: parts.length };
}
