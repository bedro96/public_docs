// Live layer for the loupe (the magnified hero module). Everything here is a pure function of the model's state:
// it poses the 81 parts (group transforms only, never a re-render of paths), the alignment rig, the pack-out and the phone finale.
import { lat, LOUPE_REGIONS, MOD_ORDER } from './mod.js';
import { PARTS, PART_INDEX } from './parts.js';
import { RIM, hexBase, hexTop } from './rig.js';
import { backRegion, PH } from './phone.js';
import { clamp, lerp, seg } from './model.js';
import { AA_PHASE } from './data.js';

const DIM = 0.28; // opacity of every other part while one is picked from the list

// screen vectors of one world mm along x, y, z inside the loupe projection
const O0 = lat(0, 0, 0);
const off = (dx, dy, dz) => { const p = lat(dx, dy, dz); return [p[0] - O0[0], p[1] - O0[1]]; };
const tl = (dx, dy, dz) => {
  if (!dx && !dy && !dz) return '';
  const [x, y] = off(dx, dy, dz);
  return `translate(${x.toFixed(2)} ${y.toFixed(2)})`;
};
const EX = off(1, 0, 0);
const EY = off(0, 1, 0);
const RISE = -off(0, 0, 1)[1];
const PIVOT_Y = lat(0, 0, 6)[1];
// a small tilt of the lens group about a horizontal axis, drawn as a shear of the screen about the pivot height.
// A point h mm above the pivot moves by h * (ex * theta - ey * phi) on the screen; h = (pivotY - sy) / RISE.
function tilt(txDeg, tyDeg) {
  if (Math.abs(txDeg) < 0.01 && Math.abs(tyDeg) < 0.01) return '';
  const th = (tyDeg * Math.PI) / 180;
  const ph = (txDeg * Math.PI) / 180;
  const c1 = -(EX[0] * th - EY[0] * ph) / RISE;
  const c2 = -(EX[1] * th - EY[1] * ph) / RISE;
  return `matrix(1 0 ${c1.toFixed(4)} ${(1 + c2).toFixed(4)} ${(-c1 * PIVOT_Y).toFixed(2)} ${(-c2 * PIVOT_Y).toFixed(2)})`;
}
// the phone's centre on the loupe screen: the flip squashes the finale props about this vertical line
const PHONE_CX = lat(PH.x0 + (PH.x1 - PH.x0) / 2, PH.y0 + (PH.y1 - PH.y0) / 2, 0)[0];
const squash = (sx, px) => (sx >= 0.999 ? '' : `translate(${px.toFixed(1)} 0) scale(${Math.max(0.001, sx).toFixed(3)} 1) translate(${(-px).toFixed(1)} 0)`);
const join = (...a) => a.filter(Boolean).join(' ');

export const AXES = [
  { id: 'x', ko: 'X', en: 'X', unit: 'µm', key: 'x' },
  { id: 'y', ko: 'Y', en: 'Y', unit: 'µm', key: 'y' },
  { id: 'z', ko: 'Z 초점', en: 'Z focus', unit: 'µm', key: 'z' },
  { id: 'tx', ko: 'Tx', en: 'Tx', unit: '′', key: 'tx' },
  { id: 'ty', ko: 'Ty', en: 'Ty', unit: '′', key: 'ty' },
  { id: 'tz', ko: 'Tz', en: 'Tz', unit: '′', key: 'tz' },
];
export const FIELD_NAMES = [
  { id: 'c', ko: '중심', en: 'Centre' },
  { id: 'tl', ko: '좌상', en: 'Top-left' },
  { id: 'tr', ko: '우상', en: 'Top-right' },
  { id: 'bl', ko: '좌하', en: 'Bottom-left' },
  { id: 'br', ko: '우하', en: 'Bottom-right' },
];

export function makeLoupe({ svg, fig, e0, onPick }) {
  const q = (sel) => svg.querySelector(sel);
  const G = {};
  ['l-jig', 'l-esd', 'l-cartonb', 'l-phoneb', 'l-rig', 'mod', 'l-proxies', 'l-bag', 'l-cartonf', 'l-cartonlid', 'l-phonef', 'l-screws', 'l-lid', 'l-optics', 'l-struts', 'l-grip', 'l-needle', 'l-uv', 'l-oven', 'l-scale', 'l-back'].forEach((id) => { G[id] = svg.getElementById(id); });
  const modEl = G.mod;
  const last = {};
  const once = (key, val, fn) => { if (last[key] !== val) { last[key] = val; fn(); } };
  // group opacity and display in one cached write
  const setO = (id, o, tr) => {
    const g = G[id];
    if (!g) return;
    const v = clamp(o, 0, 1);
    once(`o-${id}`, `${v.toFixed(2)}|${tr ?? ''}`, () => {
      g.style.display = v <= 0.01 ? 'none' : '';
      g.style.opacity = v >= 0.995 ? '1' : v.toFixed(2);
      if (tr !== undefined) { if (tr) g.setAttribute('transform', tr); else g.removeAttribute('transform'); }
    });
  };

  // every inline opacity="0" attribute becomes a style value, so that writing '' later means "visible" (an attribute would keep winning)
  svg.querySelectorAll('[opacity]').forEach((n) => { n.style.opacity = n.getAttribute('opacity'); n.removeAttribute('opacity'); });
  // the lid group carries its own inline opacity as well as the wrapper's
  const lidg = q('.lidg');
  if (lidg) lidg.style.opacity = '1';

  // ---------- parts ----------
  const recs = [...modEl.querySelectorAll('[data-p]')].map((g) => ({ g, id: g.dataset.p, n: PART_INDEX[g.dataset.p].n, grp: g.dataset.grp, sig: '' }));
  const byId = Object.fromEntries(recs.map((r) => [r.id, r]));
  const drops = [...modEl.querySelectorAll('.drop')];
  let sel = null;
  let orderName = 'asm';
  function setOrder(name) {
    if (name === orderName) return;
    orderName = name;
    const frag = document.createDocumentFragment();
    MOD_ORDER[name].forEach((id) => frag.appendChild(byId[id].g));
    modEl.appendChild(frag);
  }
  function setSel(id) {
    sel = id && byId[id] ? id : null;
    recs.forEach((r) => { r.sig = ''; });
    last.partSel = undefined;
    if (onPick) onPick(sel);
  }
  svg.addEventListener('click', (e) => {
    const g = e.target && e.target.closest ? e.target.closest('[data-p]') : null;
    if (!g || g.classList.contains('ghost')) { return; }
    setSel(sel === g.dataset.p ? null : g.dataset.p);
  });

  function poseParts(s) {
    const L = s.lens;
    const lensKey = `${L.dx.toFixed(2)}|${L.dy.toFixed(2)}|${L.dz.toFixed(2)}|${L.tx.toFixed(2)}|${L.ty.toFixed(2)}`;
    const lensT = join(tl(L.dx, L.dy, L.dz), tilt(L.tx, L.ty));
    for (const r of recs) {
      const p = s.parts[r.n];
      const lens = r.grp === 'lens';
      const sig = `${p.o.toFixed(2)}|${p.dx.toFixed(2)}|${p.dy.toFixed(2)}|${p.dz.toFixed(2)}|${lens ? lensKey : ''}`;
      if (sig === r.sig) continue;
      r.sig = sig;
      const picked = sel === null || sel === r.id;
      const o = p.o * (picked ? 1 : DIM);
      r.g.style.display = o <= 0.01 ? 'none' : '';
      r.g.style.opacity = o >= 0.99 ? '1' : o.toFixed(2); // never '': the inline opacity="0" attribute would then win
      r.g.style.pointerEvents = p.o < 0.5 ? 'none' : '';
      r.g.classList.toggle('sel', sel === r.id);
      const t = join(lens ? lensT : '', tl(p.dx, p.dy, p.dz));
      if (t) r.g.setAttribute('transform', t); else r.g.removeAttribute('transform');
    }
  }

  // ---------- the alignment rig, needle, struts ----------
  const optics = G['l-optics'];
  const tgt = {};
  svg.querySelectorAll('.tgt').forEach((p) => { tgt[p.getAttribute('class').split(' ').find((c) => c.startsWith('tgt-')).slice(4)] = p; });
  const rays = {};
  svg.querySelectorAll('.ray').forEach((p) => { rays[p.getAttribute('class').split(' ').find((c) => c.startsWith('ray-')).slice(4)] = p; });
  const struts = [...svg.querySelectorAll('.strut')];
  const HB = hexBase();
  const HT = hexTop();
  const needle = q('#l-needle .needle');
  const needleIn = q('#l-needle .needle-in');
  const dropper = q('#l-needle .dropper');
  if (dropper) { const [cx, cy] = lat(0, 0, 4.0); dropper.setAttribute('cx', cx.toFixed(1)); dropper.setAttribute('cy', cy.toFixed(1)); }
  const uvcone = q('.uvcone');
  const ovenhood = q('.ovenhood');
  const proxies = [...svg.querySelectorAll('.proxy')];
  const screws = [...svg.querySelectorAll('.screw')];
  const backStrip = q('.bv-strip');

  function applyRig(s) {
    const aa = s.aa;
    const st = s.stage;
    const f = s.f;
    const rig = st === 4 ? aa.rig * (1 - seg(f, 0.72, 0.78)) : 0;
    const L = s.lens;
    const pose = tl(L.dx, L.dy, L.dz);
    setO('l-rig', rig);
    setO('l-optics', rig);
    setO('l-struts', rig);
    setO('l-grip', rig, pose);
    setO('l-uv', st === 4 ? aa.rig * seg(f, 0.56, 0.6) * (1 - seg(f, 0.72, 0.76)) : 0);
    if (uvcone) once('uvcone', aa.uv.toFixed(2), () => { uvcone.style.opacity = aa.uv.toFixed(2); });
    setO('l-oven', aa.bake > 0.005 ? 1 : 0);
    if (ovenhood) once('ovenhood', aa.bake.toFixed(2), () => { ovenhood.style.opacity = aa.bake.toFixed(2); });
    if (rig > 0.01) {
      // six struts from the hexapod base to the platform, which follows the lens pose
      const key = `${L.dx.toFixed(2)}|${L.dy.toFixed(2)}|${L.dz.toFixed(2)}`;
      once('struts', key, () => {
        struts.forEach((p, i) => {
          const a = lat(HB[i][0], HB[i][1], HB[i][2] + 2.2);
          const b = lat(HT[i][0] + L.dx, HT[i][1] + L.dy, HT[i][2] + L.dz - 2.4);
          p.setAttribute('d', `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`);
        });
      });
      // the chart gets crisper as the lens nears focus (MTF read back through the optics)
      const m = clamp(aa.mtf.c / 72, 0, 1.1);
      once('mtfvis', m.toFixed(2), () => {
        Object.values(tgt).forEach((p) => { p.style.opacity = (0.25 + 0.75 * clamp(m, 0, 1)).toFixed(2); });
        Object.values(rays).forEach((p) => { p.style.opacity = (0.35 + 0.65 * clamp(m, 0, 1)).toFixed(2); });
      });
    }
    // the dispense needle visits the eight rim points one by one
    const nOn = aa.needle >= 0;
    if (needle) {
      const i = nOn ? Math.min(7, Math.floor(aa.needle * 8)) : 0;
      const frac = nOn ? aa.needle * 8 - i : 0;
      const hop = Math.sin(Math.PI * clamp(frac, 0, 1)) * 2.6;
      const key = nOn ? `${i}|${hop.toFixed(1)}` : 'off';
      once('needle', key, () => {
        needle.style.opacity = nOn ? '1' : '0';
        if (!nOn) return;
        needleIn.setAttribute('transform', tl(RIM[i][0], RIM[i][1], hop));
        if (dropper) dropper.setAttribute('r', (seg(frac, 0.1, 0.5) * 1.1 * (1 - seg(frac, 0.7, 0.95))).toFixed(2));
      });
    }
    drops.forEach((d, i) => once(`drop${i}`, clamp(aa.dispense * 8 - i, 0, 1) > 0.02 ? 'y' : 'n', () => { d.style.opacity = clamp(aa.dispense * 8 - i, 0, 1) > 0.02 ? '1' : '0'; }));
  }

  // ---------- pack-out and phone finale ----------
  function applyPack(s) {
    const st = s.stage;
    const f = s.f;
    const pk = s.pack;
    const ph = s.phone;
    const lowered = tl(0, 0, -16 * pk.lower);
    const jig = st <= 5 ? 1 : st === 6 ? 1 - seg(f, 0, 0.06) : 0;
    setO('l-jig', jig);
    const packFade = st === 6 ? 1 : st === 7 ? 1 - ph.arrive : 0;
    const esd = st === 6 ? seg(f, 0, 0.06) : st === 7 ? 1 - ph.arrive : 0;
    setO('l-esd', esd, lowered);
    setO('l-proxies', esd, lowered);
    proxies.forEach((p, j) => once(`px${j}`, clamp(pk.fill * 8 - j, 0, 1).toFixed(2), () => { p.style.opacity = clamp(pk.fill * 8 - j, 0, 1).toFixed(2); }));
    setO('l-bag', st === 6 ? pk.bag : st === 7 ? 1 - ph.arrive : 0, lowered);
    const cart = st === 6 ? pk.carton : st === 7 ? 1 - ph.arrive : 0;
    setO('l-cartonb', cart);
    setO('l-cartonf', cart);
    setO('l-cartonlid', st === 6 ? (pk.lid > 0.01 ? 1 : 0) : st === 7 ? 1 - ph.arrive : 0, tl(0, 0, 22 * (1 - pk.lid)));
    void packFade;
    setO('l-scale', st <= 5 ? 1 : 0);

    // the module itself: lowered into the carton, then lifted over the phone
    const face = ph.on && ph.face === 'back' ? 0 : 1;
    const modT = st === 6 ? lowered : st === 7 ? join(squash(ph.flipSx, PHONE_CX), tl(0, 0, ph.mod.dz)) : '';
    const modO = st === 7 ? ph.arrive * face : 1;
    once('mod', `${modO.toFixed(2)}|${modT}`, () => {
      modEl.style.display = modO <= 0.01 ? 'none' : '';
      modEl.style.opacity = modO >= 0.995 ? '' : modO.toFixed(2);
      if (modT) modEl.setAttribute('transform', modT); else modEl.removeAttribute('transform');
    });

    // phone props
    const open = ph.on ? ph.arrive * face : 0;
    const sq = squash(ph.flipSx, PHONE_CX);
    setO('l-phoneb', open, sq);
    setO('l-phonef', open, sq);
    screws.forEach((p, i) => {
      const v = i === 0 ? ph.s1 : ph.s2;
      once(`screw${i}`, v.toFixed(2), () => {
        p.style.opacity = v.toFixed(2);
        const t = tl(0, 0, 5 * (1 - v));
        if (t) p.setAttribute('transform', t); else p.removeAttribute('transform');
      });
    });
    setO('l-screws', ph.on ? open : 0, sq);
    setO('l-lid', ph.on && ph.lid > 0.005 ? open : 0, join(sq, tl(0, 0, 40 * (1 - ph.lid))));
    // the flat back view: appears when the phone has flipped
    const R = backRegion();
    setO('l-back', ph.on && ph.face === 'back' ? 1 : 0, squash(ph.flipSx, R.cx));
    if (backStrip) once('strip', ph.strip.toFixed(2), () => { backStrip.style.opacity = ph.strip.toFixed(2); });
  }

  // ---------- the camera ----------
  const cam = { cx: 1300, cy: 750, vw: 2600, vh: 1500, snap: true, vb: '', view: '' };
  const box = { cw: 1, ch: 1 };
  const measure = () => { const r = fig.getBoundingClientRect(); box.cw = Math.max(1, r.width); box.ch = Math.max(1, r.height); cam.snap = true; };
  const ro = new ResizeObserver(measure);
  ro.observe(fig);
  measure(); // do not wait for the observer's first callback: a camera fitted to a 1 x 1 pixel figure would fly off to nowhere
  // Overlays cover parts of the figure (the alignment display and the scale note, the live numbers): the camera fits the region
  // into what is left, measured in pixels so it holds at every figure size, instead of guessing a fraction.
  const hudEl = document.getElementById('aahud');
  const noteEl = fig.querySelector('.lnote');
  const roEl = document.getElementById('readouts');
  const h = (e) => (e && e.offsetHeight ? e.offsetHeight + 12 : 0); // 0 while hidden (display: none)
  function occupied(view) {
    if (hudEl && !hudEl.hidden) return { top: h(noteEl), bottom: Math.min(box.ch * 0.5, hudEl.offsetHeight + 12) };
    if (view === 'back') return { top: h(roEl), bottom: h(noteEl) };
    return { top: 0, bottom: 0 };
  }
  function camTarget(s) {
    // dispensing and the UV flash happen at the module itself, so the camera comes in close for those two beats;
    // the carton is bigger than the tray, so the camera pulls back once it appears
    const view = s.view === 'aa' && (s.aa.phase === 'dispense' || s.aa.phase === 'uv') ? 'aaclose' : s.view === 'tray' && s.f >= 0.5 ? 'carton' : s.view;
    const r = view === 'back' ? backRegion() : LOUPE_REGIONS[view] || LOUPE_REGIONS.mod;
    const pad = 0.08;
    const occ = occupied(view);
    const freeH = Math.max(box.ch * 0.4, box.ch - occ.top - occ.bottom);
    const sc = Math.min(box.cw / (r.w * (1 + pad * 2)), freeH / (r.h * (1 + pad * 2))); // pixels per user unit
    const vw = box.cw / sc;
    const vh = box.ch / sc;
    // the region's centre goes to the middle of the free strip, not of the whole figure
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2 + (box.ch / 2 - (occ.top + freeH / 2)) / sc;
    return { cx, cy, vw, vh };
  }
  function stepCamera(s, dt, reduced) {
    const t = camTarget(s);
    cam.view = s.view;
    const a = cam.snap || reduced ? 1 : 1 - Math.exp(-dt * 3.4);
    cam.cx = lerp(cam.cx, t.cx, a);
    cam.cy = lerp(cam.cy, t.cy, a);
    cam.vw = lerp(cam.vw, t.vw, a);
    cam.snap = false;
    cam.vh = cam.vw * (box.ch / box.cw);
    const vb = `${(cam.cx - cam.vw / 2).toFixed(1)} ${(cam.cy - cam.vh / 2).toFixed(1)} ${cam.vw.toFixed(1)} ${cam.vh.toFixed(1)}`;
    if (vb !== cam.vb) { svg.setAttribute('viewBox', vb); cam.vb = vb; }
  }

  // ---------- the alignment heads-up display ----------
  const hud = document.getElementById('aahud');
  const mtfs = document.getElementById('mtfs');
  const axes = document.getElementById('axes');
  const phaseEl = document.getElementById('aa-phase');
  const mrows = {};
  const arows = {};
  if (mtfs && axes) {
    FIELD_NAMES.forEach((fl) => {
      const row = document.createElement('div');
      row.className = 'mrow';
      row.innerHTML = '<span class="aah-n"><span class="ko" lang="ko"></span><span class="en" lang="en"></span></span><span class="meter" aria-hidden="true"><i></i></span><b class="v">0</b>';
      row.querySelector('.ko').textContent = fl.ko;
      row.querySelector('.en').textContent = fl.en;
      mtfs.appendChild(row);
      mrows[fl.id] = { i: row.querySelector('i'), v: row.querySelector('.v') };
    });
    AXES.forEach((ax) => {
      const row = document.createElement('div');
      row.className = 'mrow';
      row.innerHTML = '<span class="aah-n"><span class="ko" lang="ko"></span><span class="en" lang="en"></span></span><span class="meter" aria-hidden="true"><i></i></span><b class="v">0</b>';
      row.querySelector('.ko').textContent = ax.ko;
      row.querySelector('.en').textContent = ax.en === ax.ko ? '' : ax.en;
      axes.appendChild(row);
      arows[ax.id] = { i: row.querySelector('i'), v: row.querySelector('.v'), ax };
    });
  }
  function applyHud(s) {
    if (!hud) return;
    const on = s.stage === 4;
    once('hud', on ? 'y' : 'n', () => { hud.hidden = !on; });
    if (!on) return;
    const M = s.aa.mtf;
    FIELD_NAMES.forEach((fl) => {
      const v = fl.id === 'c' ? M.c : M.corners[fl.id];
      once(`m-${fl.id}`, v.toFixed(0), () => { mrows[fl.id].i.style.width = `${clamp(v, 0, 100).toFixed(0)}%`; mrows[fl.id].v.textContent = v.toFixed(0); });
    });
    AXES.forEach((ax) => {
      const v = s.aa.err[ax.key];
      const w = clamp(Math.abs(v) / Math.abs(e0[ax.key]), 0, 1) * 100;
      once(`a-${ax.id}`, v.toFixed(1), () => { arows[ax.id].i.style.width = `${w.toFixed(0)}%`; arows[ax.id].v.textContent = `${v.toFixed(1)} ${ax.unit}`; });
    });
    const ph = AA_PHASE[s.aa.phase] || AA_PHASE.idle;
    once('phase', s.aa.phase, () => {
      if (!phaseEl) return;
      phaseEl.querySelector('.ko').textContent = ph.ko;
      phaseEl.querySelector('.en').textContent = ph.en;
    });
  }

  function apply(s, { dt, reduced }) {
    setOrder(s.stage === 0 && s.f < 0.86 ? 'bom' : 'asm');
    poseParts(s);
    applyRig(s);
    applyPack(s);
    applyHud(s);
    stepCamera(s, dt, reduced);
  }
  return {
    apply,
    cam,
    box,
    get sel() { return sel; },
    setSel,
    get order() { return orderName; },
    recs,
    byId,
  };
}

export { PARTS };
