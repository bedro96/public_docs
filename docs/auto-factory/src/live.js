// Live layer: wall-clock tour, camera, DOM wiring. Everything it draws is a pure function of the model's state(u).
// Pure SVG (no canvas/WebGL), so there is no context to lose; an error counter guards the rAF loop instead.
import { UI, STAGES, READOUTS, BAY_LABELS } from './data.js';
import { stateAt, robotTargets, readoutValues, pickStep, advanceTour, END_U, STAGE_COUNT, STAGE_SECONDS, PRESS_TONNES } from './model.js';
import { P, at, k, BAYS, PLANT, W, H, slab } from './world.js';
import { COIL, STRIP_Z, ROBOTS } from './shops.js';
import { robotArm } from './robot.js';
import { wheelSpokes } from './car.js';
import { ENGINE_Y } from './shops2.js';

const $ = (id) => document.getElementById(id);
const tr = (dx, dy, dz) => (dx || dy || dz ? k.translateAlong(P, [dx, dy, dz]) : '');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const SVGNS = 'http://www.w3.org/2000/svg';
// small seeded generator: effects (sparks, spray) are a pure function of the effect clock, so a frozen clock = a frozen picture
const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
// every caption sub-step as a progress value: reduced motion steps through these instead of gliding
const CAPTIONS = [];
STAGES.forEach((st, i) => st.steps.forEach((s2) => CAPTIONS.push(i + Math.min(0.97, s2.f + 0.02))));

// ---------- coat palettes: [paper, top, shade0..3] ----------
const COATS = {
  steel: ['#dfe3e8', '#f3f5f7', '#a9b0b9', '#b9bfc7', '#c9ced5', '#d7dbe0'],
  ed: ['#575c64', '#747a84', '#30343a', '#3a3f46', '#454a52', '#50555d'],
  primer: ['#c3c6cb', '#dcdee1', '#989ca3', '#a7abb1', '#b4b8bd', '#bfc2c7'],
  base: ['#d9481f', '#ec6a40', '#8c2a0e', '#a5340f', '#bd3d15', '#cd441b'],
  clear: ['#dc4b21', '#f47c52', '#8c2a0e', '#a5340f', '#bd3d15', '#d0461c'],
};
const COAT_ORDER = ['steel', 'ed', 'primer', 'base', 'clear'];
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mixHex = (a, b, t) => {
  const A = hex(a);
  const B = hex(b);
  return `#${A.map((v, i) => Math.round(lerp(v, B[i], t)).toString(16).padStart(2, '0')).join('')}`;
};
const VARS = ['--cp', '--ct', '--c0', '--c1', '--c2', '--c3'];

// ---------- camera regions (world boxes, then fitted to the figure's aspect) ----------
const REGION = [
  { x0: -6, x1: 156, y0: -92, y1: 92, z1: 56 },
  { x0: 132, x1: 342, y0: -92, y1: 92, z1: 66 },
  { x0: 352, x1: 556, y0: -92, y1: 92, z1: 80 },
  { x0: 540, x1: 1014, y0: -92, y1: 92, z1: 100 },
  { x0: 1030, x1: 1230, y0: -296, y1: -150, z1: 50 },
  { x0: 1030, x1: 1240, y0: -250, y1: 92, z1: 100 },
  { x0: 1240, x1: 1412, y0: -90, y1: 100, z1: 64 },
];
const OVERVIEW = { x0: PLANT.x, x1: PLANT.x + PLANT.w, y0: PLANT.y, y1: PLANT.y + PLANT.d, z1: 60 };

function projBox(r) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const x of [r.x0, r.x1]) for (const y of [r.y0, r.y1]) for (const z of [0, r.z1]) {
    const [sx, sy] = at(x, y, z);
    x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
  }
  return { x0, x1, y0, y1 };
}

export function boot() {
  const svg = $('plant');
  const fig = $('fig');
  if (!svg || !fig) return;
  const fx = $('fx');
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');

  // ---------- element caches ----------
  const carG = $('car');
  const parts = {};
  carG.querySelectorAll('[data-p]').forEach((g) => { parts[g.dataset.p] = { g, sig: '' }; });
  const spokes = [...carG.querySelectorAll('.spokes')];
  const coils = [...document.querySelectorAll('.coilv')];
  const panels = [...document.querySelectorAll('.pn')];
  const blanksEls = [...document.querySelectorAll('.bl')];
  const eng = {};
  document.querySelectorAll('[data-e]').forEach((g) => { eng[g.dataset.e] = g; });
  const rams = { b: $('ram-b'), 1: $('ram-1'), 2: $('ram-2'), 3: $('ram-3'), 4: $('ram-4') };
  const racks = [0, 1, 2, 3, 4].map((i) => $(`rack-${i}`));
  const arms = {};
  ROBOTS.forEach((r) => { arms[r.id] = { el: $(`arm-${r.id}`), cur: null, key: '' }; });
  const el = {
    strip: $('strip'), blanks: $('blanks'), panel: $('panel'), scrap: $('scrap'), agv: $('agv'), engSlot: $('eng-slot'), liquid: $('ed-liquid'),
    oven1: $('oven1-heat'), oven2: $('oven2-heat'), pt: $('pt-spray'), booth: $('booth-air'), water: $('water-test'),
  };
  // trimmed offcuts that drop away from press 2
  el.scrap.innerHTML = [-1, 1].map((sd) => slab(-4, sd * 13 - 1.2, 8, 2.4, 9.2, 0.5, { tone: 'mid', r: 0.3, steps: 2 })).join('');
  const make = (id) => { const p = document.createElementNS(SVGNS, 'path'); p.setAttribute('id', id); fx.appendChild(p); return p; };
  const fxSpark = make('sparks');
  const fxSpray = make('spray');
  const fxDrops = make('drops');

  // ---------- DOM for chips, route, card ----------
  const route = $('route');
  const chipHost = $('chips');
  const bi = (id, pair) => {
    const n = $(id);
    if (!n) return;
    n.querySelector('.ko').textContent = pair.ko;
    n.querySelector('.en').textContent = pair.en;
  };
  const routeBtns = [];
  const chips = [];
  STAGES.forEach((st, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'rt';
    b.dataset.i = String(i);
    b.innerHTML = '<span class="n"></span><span class="names"><span class="ko" lang="ko"></span><span class="en" lang="en"></span></span><span class="bar" aria-hidden="true"></span>';
    b.querySelector('.n').textContent = String(i + 1);
    b.querySelector('.ko').textContent = st.short.ko;
    b.querySelector('.en').textContent = st.short.en;
    li.appendChild(b);
    route.appendChild(li);
    routeBtns.push(b);
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'chip';
    c.dataset.i = String(i);
    c.innerHTML = '<span class="n"></span><span class="names"><span class="ko" lang="ko"></span><span class="en" lang="en"></span></span>';
    c.querySelector('.n').textContent = String(i + 1);
    c.querySelector('.ko').textContent = st.short.ko;
    c.querySelector('.en').textContent = st.short.en;
    c.setAttribute('aria-label', `${st.name.ko} / ${st.name.en}`);
    chipHost.appendChild(c);
    chips.push(c);
  });
  // static UI strings
  document.querySelectorAll('[data-ui]').forEach((n) => {
    const p = UI[n.dataset.ui];
    if (!p) return;
    const ko = n.querySelector('.ko');
    const en = n.querySelector('.en');
    if (ko) ko.textContent = p.ko;
    if (en) en.textContent = p.en;
  });

  // ---------- tour state (wall clock) ----------
  // T.u is the model progress; T.seek is a glide target (stage selection); T.sel is the stage whose card is shown.
  // T.fx is the EFFECT clock (sparks, spray, spin, drops, jitter, robot sway). It only runs while something is
  // actually moving (Play, or a glide) and never under reduced motion, so Pause and reduced motion freeze the picture.
  const T = { u: 0, seek: null, snap: false, playing: false, sel: 0, overview: false, now: 0, fx: 0, visible: true, reduced: mq.matches, errors: 0, frames: 0, dead: false };
  const stageOf = (u) => Math.min(STAGE_COUNT - 1, Math.floor(u));
  const status = $('status');
  const say = (ko, en) => { status.textContent = `${ko} · ${en}`; };
  const stageSay = (n) => say(`${n + 1}번 공정: ${STAGES[n].name.ko}`, `Stage ${n + 1}: ${STAGES[n].name.en}`);

  // End a glide so that the scene (T.u) and the card (T.sel) agree again: where it stands, or at its target.
  function endSeek({ toTarget = false, min = 0 } = {}) {
    if (T.seek !== null && toTarget) T.u = clamp(Math.max(T.seek, min), 0, END_U);
    T.seek = null;
    T.snap = false;
    T.sel = stageOf(T.u);
  }

  function select(i, { snap = false, announce = true } = {}) {
    const n = clamp(i, 0, STAGE_COUNT - 1);
    T.sel = n;
    T.overview = false;
    T.seek = n;
    T.snap = snap || T.reduced;
    if (T.reduced) T.seek = n + 0.02;
    if (announce) stageSay(n);
    syncUi(true);
  }
  function stepRM(dir) {
    // reduced motion: Next / Previous step through the captions instead of animating
    T.overview = false;
    const last = CAPTIONS.length - 1;
    const edge = dir > 0 ? T.u >= CAPTIONS[last] - 0.005 : T.u <= CAPTIONS[0] + 0.005;
    if (edge) {
      say(dir > 0 ? '마지막 설명입니다' : '첫 번째 설명입니다', dir > 0 ? 'This is the last step' : 'This is the first step');
      syncUi(true);
      return;
    }
    // from the very start (u = 0, before the first caption mark) Next goes to the SECOND caption, never to a no-op
    const here = Math.max(T.u, CAPTIONS[0]);
    if (dir > 0) T.u = CAPTIONS.find((v) => v > here + 0.005) ?? CAPTIONS[last];
    else T.u = [...CAPTIONS].reverse().find((v) => v < T.u - 0.005) ?? CAPTIONS[0];
    T.seek = null;
    T.snap = false;
    T.sel = stageOf(T.u);
    stageSay(T.sel);
    syncUi(true);
  }
  const next = () => {
    if (T.reduced) return stepRM(1);
    if (T.sel >= STAGE_COUNT - 1) { say('마지막 공정입니다', 'This is the last stage'); return; }
    select(T.sel + 1);
  };
  const prev = () => {
    if (T.reduced) return stepRM(-1);
    const f = T.u - stageOf(T.u);
    select(f > 0.2 && T.sel === stageOf(T.u) ? T.sel : T.sel - 1);
  };
  function setPlaying(v) {
    if (T.reduced && v) { say(UI.reduced.ko, UI.reduced.en); return; }
    if (v && T.u >= END_U - 0.01) { T.u = 0; T.sel = 0; T.seek = null; }
    // Pause freezes the picture where it is: a glide in progress stops here instead of finishing, and the card follows the scene
    if (!v && T.seek !== null) endSeek({ toTarget: T.snap });
    T.playing = v;
    if (v) T.overview = false;
    say(v ? UI.playing.ko : UI.paused.ko, v ? UI.playing.en : UI.paused.en);
    syncUi(true);
  }
  const restart = () => {
    T.errors = 0;
    T.u = 0; T.sel = 0; T.seek = null; T.snap = false; T.overview = false;
    if (T.dead) { T.dead = false; requestAnimationFrame(loop); }
    $('fail').hidden = true;
    say('처음으로 돌아갑니다', 'Back to the start');
    setPlaying(!T.reduced);
  };
  const skip = () => {
    // jump to the start of the next stage without gliding
    if (T.reduced) return stepRM(1);
    if (T.sel >= STAGE_COUNT - 1) { T.u = END_U; T.seek = null; T.snap = false; syncUi(true); return; }
    select(T.sel + 1, { snap: true });
  };

  // ---------- buttons and keys ----------
  $('ctl-next').addEventListener('click', next);
  $('ctl-prev').addEventListener('click', prev);
  $('ctl-play').addEventListener('click', () => setPlaying(!T.playing));
  $('ctl-restart').addEventListener('click', restart);
  $('ctl-skip').addEventListener('click', skip);
  $('ctl-over').addEventListener('click', () => {
    T.overview = !T.overview;
    say(T.overview ? '공장 전체를 봅니다' : `${T.sel + 1}번 공정으로 돌아갑니다`, T.overview ? 'Showing the whole plant' : `Back to stage ${T.sel + 1}`);
    syncUi(true);
  });
  routeBtns.forEach((b) => b.addEventListener('click', () => select(+b.dataset.i)));
  chips.forEach((c) => c.addEventListener('click', () => select(+c.dataset.i)));
  const scrub = $('scrub');
  scrub.max = String(STAGE_COUNT * 1000);
  scrub.addEventListener('input', () => {
    T.u = clamp(+scrub.value / 1000, 0, END_U);
    T.seek = null;
    T.snap = false;
    T.playing = false;
    T.sel = stageOf(T.u);
    syncUi(true);
  });
  // Keyboard shortcuts only apply while focus is in the figure, the tour controls or the route list. Everywhere else the
  // keys keep their normal job (scrolling the page, moving a slider), so nothing is hijacked and Page Up/Down are never touched.
  const KEY_SCOPE = '#fig, .controls, .routebox';
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const tg = e.target;
    const tag = (tg && tg.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (!(tg && tg.closest && tg.closest(KEY_SCOPE))) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); prev(); }
    else if (e.key === 'Home') { e.preventDefault(); select(0); }
    else if (e.key === 'End') { e.preventDefault(); select(STAGE_COUNT - 1); }
    else if (e.key === 'Escape') {
      if (T.overview) { e.preventDefault(); T.overview = false; syncUi(true); say('공정 보기로 돌아갑니다', 'Back to the stage view'); }
      else if (T.playing) { e.preventDefault(); setPlaying(false); }
    } else if (/^[1-7]$/.test(e.key)) { e.preventDefault(); select(+e.key - 1); }
  });
  const onMq = () => {
    T.reduced = mq.matches;
    if (T.reduced) {
      // a glide in progress must not just vanish (that left the card on one stage and the scene on another):
      // land on the stage that was chosen, at its first caption, then stop everything that moves
      endSeek({ toTarget: true, min: T.seek === null ? 0 : Math.floor(T.seek) + 0.02 });
      T.playing = false;
      cam.snap = true;
    }
    document.documentElement.dataset.motion = T.reduced ? 'reduced' : 'full';
    $('rm-note').hidden = !T.reduced;
    syncUi(true);
  };
  mq.addEventListener('change', onMq);

  // ---------- camera ----------
  const cam = { cx: W / 2, cy: H / 2, vw: W, snap: true };
  const box = { cw: 1, ch: 1 };
  const ro = new ResizeObserver(() => { const r = fig.getBoundingClientRect(); box.cw = Math.max(1, r.width); box.ch = Math.max(1, r.height); cam.snap = true; });
  ro.observe(fig);
  // chip half-widths (measured once, and again when the web font arrives) so the selected chip can be kept fully inside the figure
  const chipHalf = chips.map(() => 14);
  const measureChips = () => chips.forEach((c, i) => { chipHalf[i] = Math.max(12, c.offsetWidth / 2); });
  measureChips();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureChips);
  function camTarget(s) {
    const aspect = box.ch / box.cw;
    const narrow = box.cw < 700 || aspect > 0.75;
    let r = T.overview ? OVERVIEW : { ...REGION[T.sel] };
    if (!T.overview) {
      const carX = s.car.visible ? s.car.x : r.x0 + 60;
      const follow = T.sel === 2 || T.sel === 3 || T.sel === 5 || (T.sel === 4 && narrow);
      if (T.sel === 4) {
        const ex = s.eng.x;
        if (narrow) { r.x0 = clamp(ex - 70, r.x0, r.x1 - 140); r.x1 = r.x0 + 140; }
      } else if (follow && (narrow || T.sel === 3)) {
        const half = narrow ? 100 : 150;
        const c = clamp(carX, r.x0 + half, r.x1 - half);
        r.x0 = c - half; r.x1 = c + half;
      }
      if (T.sel === 5) r.y0 = s.f < 0.8 ? (narrow ? -250 : -250) : -66;
      if (T.sel === 5 && narrow && s.f >= 0.8) { r.x0 = clamp(carX - 100, 1030, 1140); r.x1 = r.x0 + 200; }
    }
    const b = projBox(r);
    const pad = 0.07;
    let bw = (b.x1 - b.x0) * (1 + pad * 2);
    let bh = (b.y1 - b.y0) * (1 + pad * 2);
    const vw = Math.max(bw, bh / aspect);
    return { cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, vw };
  }
  function stepCamera(s, dt) {
    const t = camTarget(s);
    const a = cam.snap || T.reduced ? 1 : 1 - Math.exp(-dt * 3.4);
    cam.cx = lerp(cam.cx, t.cx, a); cam.cy = lerp(cam.cy, t.cy, a); cam.vw = lerp(cam.vw, t.vw, a);
    cam.snap = false;
    const vh = cam.vw * (box.ch / box.cw);
    const vb = `${(cam.cx - cam.vw / 2).toFixed(1)} ${(cam.cy - vh / 2).toFixed(1)} ${cam.vw.toFixed(1)} ${vh.toFixed(1)}`;
    if (vb !== cam.vb) { svg.setAttribute('viewBox', vb); cam.vb = vb; }
    cam.vh = vh;
  }
  const toPx = (sx, sy) => [((sx - (cam.cx - cam.vw / 2)) / cam.vw) * box.cw, ((sy - (cam.cy - cam.vh / 2)) / cam.vh) * box.ch];
  let lastCompact = null;
  function placeChips() {
    const compact = box.cw < 640;
    if (compact !== lastCompact) { lastCompact = compact; fig.classList.toggle('compact', compact); measureChips(); }
    BAY_LABELS.forEach(({ bay, stage }) => {
      const b = BAYS[bay];
      const back = bay === 'engine';
      const [px, py] = toPx(...at(b.x + b.w / 2, back ? b.y + 6 : b.y + b.d + 2, 0));
      const c = chips[stage];
      const isSel = stage === T.sel && !T.overview;
      const h = compact ? 30 : 36;
      const yMin = back ? h : 4;
      const yMax = back ? box.ch - 4 : box.ch - h;
      // the chip of the selected bay stays fully on screen (clamped in x and y); the others are hidden when they would be cut off
      const hw = chipHalf[stage] + 2;
      const pxc = isSel ? clamp(px, hw, Math.max(hw, box.cw - hw)) : px;
      const pyc = isSel ? clamp(py, yMin, yMax) : py;
      const off = pxc < 8 || pxc > box.cw - 8 || pyc < yMin || pyc > yMax;
      c.style.transform = `translate(${pxc.toFixed(1)}px,${pyc.toFixed(1)}px)`;
      c.classList.toggle('off', off);
      c.tabIndex = off ? -1 : 0;
      c.setAttribute('aria-hidden', off ? 'true' : 'false');
      c.classList.toggle('on', stage === T.sel && !T.overview);
      c.classList.toggle('back', back);
    });
  }

  // ---------- applying the model ----------
  const last = { sig: {}, caption: '', card: -1, scrub: '', routeSig: '', routeSel: -1 };
  const once = (key, val, fn) => { if (last.sig[key] !== val) { last.sig[key] = val; fn(); } };
  const disp = (n, on) => { n.style.display = on ? '' : 'none'; };

  function applyStatic(s) {
    // coil and strip
    coils.forEach((c, i) => once(`coil${i}`, s.coil.show && i === s.coil.i, () => disp(c, s.coil.show && i === s.coil.i)));
    const sh = s.strip.show && s.strip.x1 > s.strip.x0 + 1;
    once('strip', sh ? `${s.strip.x1.toFixed(1)}|${s.coil.i}` : 'off', () => {
      el.strip.style.display = sh ? '' : 'none';
      if (!sh) return;
      const zb = COIL.z - s.coil.r;
      const w = 9;
      const zAt = (x) => (x < COIL.x + 12 ? lerp(zb, STRIP_Z, clamp((x - COIL.x) / 12, 0, 1) ** 0.6) : STRIP_Z);
      const xs = [];
      for (let x = COIL.x; x < s.strip.x1; x += 6) xs.push(x);
      xs.push(s.strip.x1);
      const a = xs.map((x) => at(x, -w, zAt(x)));
      const b = xs.map((x) => at(x, w, zAt(x))).reverse();
      el.strip.setAttribute('d', k.pathOf([...a, ...b], true));
    });
    // blanks stack, hero panel
    const nb = s.blanks.n;
    blanksEls.forEach((b, i) => once(`bl${i}`, i < nb, () => disp(b, i < nb)));
    once('blTr', 'x', () => el.blanks.setAttribute('transform', tr(138, 0, 0)));
    once('panel', s.panel.show ? `${s.panel.x.toFixed(2)}|${s.panel.variant}` : 'off', () => {
      disp(el.panel, s.panel.show);
      if (s.panel.show) el.panel.setAttribute('transform', tr(s.panel.x, 0, 0));
    });
    panels.forEach((p, i) => once(`pn${i}`, s.panel.variant === i, () => disp(p, s.panel.variant === i)));
    once('scrap', s.scrap.toFixed(2), () => {
      disp(el.scrap, s.scrap > 0.01);
      if (s.scrap > 0.01) { el.scrap.setAttribute('transform', tr(0, 0, -7 * s.scrap)); el.scrap.style.opacity = String(1 - s.scrap * 0.4); el.scrap.setAttribute('data-x', '217'); }
    });
    // rams
    Object.entries(rams).forEach(([id, g]) => {
      const v = s.rams[id] || 0;
      once(`ram${id}`, v.toFixed(2), () => g.setAttribute('transform', tr(0, 0, -9.5 * v)));
    });
    racks.forEach((r, i) => once(`rk${i}`, s.racks[i].toFixed(2), () => { r.style.opacity = String(s.racks[i]); disp(r, s.racks[i] > 0.02); }));
  }

  function applyCar(s, t) {
    const c = s.car;
    once('carVis', c.visible ? 'y' : 'n', () => disp(carG, c.visible));
    if (c.visible) {
      once('carTr', `${c.x.toFixed(2)}|${c.dz.toFixed(2)}`, () => carG.setAttribute('transform', tr(c.x, 0, c.dz)));
      for (const [name, p] of Object.entries(c.parts)) {
        const o = p.o;
        const rec = parts[name];
        if (!rec) continue;
        const sig = `${o.toFixed(2)}|${p.dx.toFixed(1)}|${p.dy.toFixed(1)}|${p.dz.toFixed(1)}`;
        if (rec.sig === sig) continue;
        rec.sig = sig;
        rec.g.style.display = o <= 0.01 ? 'none' : '';
        rec.g.style.opacity = o >= 0.99 ? '' : String(o);
        const t2 = tr(p.dx, p.dy, p.dz);
        if (t2) rec.g.setAttribute('transform', t2); else rec.g.removeAttribute('transform');
      }
      // paint
      const ci = COAT_ORDER.indexOf(s.paint.coat);
      const from = COATS[COAT_ORDER[Math.max(0, ci - 1)]];
      const to = COATS[s.paint.coat];
      const m = ci === 0 ? 0 : s.paint.mix;
      once('paint', `${s.paint.coat}|${m.toFixed(2)}`, () => from.forEach((_, i) => carG.style.setProperty(VARS[i], mixHex(from[i], to[i], m))));
      // wheels
      const ang = (s.car.spin ? t * 14 * s.car.spin : 0) + (T.sel === 5 ? 0 : 0);
      if (s.car.spin > 0) {
        const key = Math.round(ang * 10);
        once('spin', String(key), () => spokes.forEach((p) => p.setAttribute('d', wheelSpokes(+p.dataset.cx, +p.dataset.side, ang))));
      }
    }
    // AGV deck and the powertrain
    once('agv', s.agv.show ? s.agv.dy.toFixed(1) : 'off', () => { disp(el.agv, s.agv.show); if (s.agv.show) el.agv.setAttribute('transform', tr(1150, s.agv.dy, 0)); });
    const e = s.eng;
    once('eng', e.show ? `${e.x.toFixed(1)}|${e.scale.toFixed(2)}` : 'off', () => {
      disp(el.engSlot, e.show);
      if (!e.show) return;
      const [ox, oy] = at(0, 0, 0);
      const [nx, ny] = at(e.x, ENGINE_Y, 0);
      el.engSlot.setAttribute('transform', `translate(${(nx - ox).toFixed(2)} ${(ny - oy).toFixed(2)}) translate(${ox.toFixed(2)} ${oy.toFixed(2)}) scale(${e.scale.toFixed(3)}) translate(${(-ox).toFixed(2)} ${(-oy).toFixed(2)})`);
    });
    if (e.show) {
      for (const [n, p] of Object.entries(e.parts)) {
        const g = eng[n];
        if (!g) continue;
        once(`e${n}`, `${p.o}|${p.dz.toFixed(1)}`, () => { g.style.display = p.o ? '' : 'none'; const t2 = tr(0, 0, p.dz); if (t2) g.setAttribute('transform', t2); else g.removeAttribute('transform'); });
      }
      const jit = e.rpm ? Math.sin(t * 90) * 0.35 : 0;
      once('ejit', jit.toFixed(2), () => { eng.block.parentNode.style.transform = jit ? `translate(${jit}px,${(-jit).toFixed(2)}px)` : ''; });
    }
    // glows and water
    const hot1 = s.stage === 3 && s.f >= 0.66 && s.f < 0.9 ? clamp((s.oven - 20) / 160, 0, 1) : 0;
    const hot2 = (s.stage === 3 && s.f >= 0.94) || s.stage === 4 ? clamp((s.oven - 20) / 130, 0, 1) : 0;
    once('hot1', hot1.toFixed(2), () => el.oven1.style.setProperty('--heat', String(hot1)));
    once('hot2', hot2.toFixed(2), () => el.oven2.style.setProperty('--heat', String(hot2)));
    const mist = s.stage === 3 && s.f >= 0.12 && s.f < 0.3 ? 1 : 0;
    once('pt', String(mist), () => el.pt.style.setProperty('--heat', String(mist)));
    const air = s.stage === 3 && s.f >= 0.84 && s.f < 0.95 ? 1 : 0;
    once('booth', String(air), () => el.booth.style.setProperty('--heat', String(air * 0.8)));
    once('liq', s.dip.toFixed(2), () => { el.liquid.style.opacity = String(0.22 + 0.3 * s.dip); });
    once('water', s.water ? 'y' : 'n', () => el.water.style.setProperty('--heat', s.water ? '1' : '0'));
  }

  // robots: smooth toward the model's target; rebuild an arm only when it moved.
  // `t` is the effect clock (frozen while paused / under reduced motion) and `moving` says whether the tour is playing or gliding:
  // when it is not, the arms go straight to the pose for the current progress instead of easing, so a paused plant is truly still.
  function applyRobots(s, t, dt, moving) {
    const tg = robotTargets(s, t);
    const a = T.reduced || !moving ? 1 : 1 - Math.exp(-dt * 7);
    const step = Math.floor(t * 24); // sparks and spray re-roll 24 times per effect-second
    const sparks = [];
    const spray = [];
    ROBOTS.forEach((r, i) => {
      const rec = arms[r.id];
      if (!rec.el) return;
      const want = tg[r.id].target;
      if (!rec.cur) rec.cur = want.slice();
      else for (let j = 0; j < 3; j++) rec.cur[j] = lerp(rec.cur[j], want[j], a);
      const key = rec.cur.map((v) => v.toFixed(1)).join(',');
      if (key !== rec.key) {
        rec.key = key;
        rec.el.innerHTML = robotArm(r.x, r.y, rec.cur, r);
      }
      if (tg[r.id].busy) {
        const rnd = rng(step * 7919 + i * 104729 + 17);
        const [sx, sy] = at(...rec.cur);
        if (r.tool === 'gun') for (let n = 0; n < 5; n++) { const ang = rnd() * 6.283; const l = 1.5 + rnd() * 3.2; sparks.push(`M${sx.toFixed(1)} ${sy.toFixed(1)}l${(Math.cos(ang) * l).toFixed(1)} ${(Math.sin(ang) * l - 0.8).toFixed(1)}`); }
        if (r.tool === 'nozzle') for (let n = 0; n < 7; n++) { const ang = rnd() * 6.283; const l = rnd() * 5; spray.push(`M${(sx + Math.cos(ang) * l).toFixed(1)} ${(sy + Math.sin(ang) * l * 0.7).toFixed(1)}h0.01`); }
      }
    });
    const sparkD = sparks.join('');
    const sprayD = spray.join('');
    once('spk', sparkD, () => fxSpark.setAttribute('d', sparkD));
    once('spy', sprayD, () => fxSpray.setAttribute('d', sprayD));
    // water-test drops. One cache key for both states, so the drops are cleared on the transition back to "no water"
    // (an earlier version cached the initial empty value and left the last drops hanging after the test).
    let dropsD = '';
    if (s.water) {
      const d = [];
      for (let n = 0; n < 30; n++) {
        const ph = (t * 1.4 + n * 0.37) % 1;
        const x = 1330 + ((n * 7) % 10) * 3.2;
        const y = -30 + ((n * 13) % 7) * 10;
        const [sx, sy] = at(x, y, 44 - 40 * ph);
        d.push(`M${sx.toFixed(1)} ${sy.toFixed(1)}v3`);
      }
      dropsD = d.join('');
    }
    once('drops', dropsD, () => fxDrops.setAttribute('d', dropsD));
    return { hot: sparks.length };
  }

  // ---------- readouts, caption, card, route ----------
  const roHost = $('readouts');
  const roNodes = {};
  Object.keys(READOUTS).forEach((key) => {
    const row = document.createElement('div');
    row.className = 'ro';
    row.dataset.key = key;
    row.innerHTML = '<dt><span class="ko" lang="ko"></span><span class="en" lang="en"></span></dt><dd><b class="v">0</b><span class="u"></span></dd>';
    row.querySelector('.ko').textContent = READOUTS[key].ko;
    row.querySelector('.en').textContent = READOUTS[key].en;
    row.querySelector('.u').textContent = READOUTS[key].unit ? ` ${READOUTS[key].unit}` : '';
    roHost.appendChild(row);
    roNodes[key] = row;
  });
  const fmt = (v) => v.toLocaleString('en-US');
  function applyReadouts(s) {
    const vals = readoutValues(s);
    const show = STAGES[T.sel].readouts;
    Object.entries(roNodes).forEach(([key, row]) => {
      const on = show.includes(key);
      once(`ro-h-${key}`, on ? 'y' : 'n', () => { row.hidden = !on; });
      if (on) once(`ro-${key}`, String(vals[key]), () => { row.querySelector('.v').textContent = fmt(vals[key]); });
    });
  }
  function fillCard(i) {
    const st = STAGES[i];
    bi('card-name', st.name);
    bi('card-what', st.what);
    bi('card-in', st.inn);
    bi('card-out', st.out);
    bi('card-keytext', { ko: st.key.ko, en: st.key.en });
    $('card-keyvalue').textContent = st.key.value;
    const ul = $('card-equip');
    ul.textContent = '';
    st.equipment.forEach((q) => {
      const li = document.createElement('li');
      li.innerHTML = '<span class="ko" lang="ko"></span><span class="en" lang="en"></span>';
      li.querySelector('.ko').textContent = q.ko;
      li.querySelector('.en').textContent = q.en;
      ul.appendChild(li);
    });
    $('card-num').textContent = `${i + 1} / ${STAGE_COUNT}`;
  }
  function syncUi(force) {
    const sel = T.sel;
    if (force || last.card !== sel) { last.card = sel; fillCard(sel); }
    routeBtns.forEach((b, i) => {
      if (i === sel && !T.overview) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      b.classList.toggle('done', i < stageOf(T.u));
    });
    if (last.routeSel !== sel) {
      // keep the current entry in view when the route is a horizontal strip (phone); no page scroll involved
      last.routeSel = sel;
      const ol = $('route');
      const li = routeBtns[sel].parentElement;
      if (ol.scrollWidth > ol.clientWidth + 1) {
        const left = ol.scrollLeft + (li.getBoundingClientRect().left - ol.getBoundingClientRect().left) - (ol.clientWidth - li.offsetWidth) / 2;
        ol.scrollTo({ left: Math.max(0, left), behavior: 'auto' });
      }
    }
    const pb = $('ctl-play');
    pb.dataset.state = T.playing ? 'playing' : 'paused';
    pb.setAttribute('aria-pressed', T.playing ? 'true' : 'false');
    pb.disabled = T.reduced;
    $('ctl-prev').disabled = T.reduced ? T.u <= CAPTIONS[0] + 0.005 : T.sel === 0 && T.u < 0.02;
    $('ctl-next').disabled = T.reduced ? T.u >= CAPTIONS[CAPTIONS.length - 1] - 0.005 : T.sel >= STAGE_COUNT - 1;
    $('ctl-over').setAttribute('aria-pressed', T.overview ? 'true' : 'false');
    $('stage-count').textContent = `${sel + 1} / ${STAGE_COUNT}`;
    document.body.dataset.stage = String(sel);
    svg.dataset.focus = T.overview ? 'all' : STAGES[sel].bay;
  }
  function applyCaption(s) {
    const st = STAGES[s.stage];
    const idx = pickStep(st.steps, s.f);
    const key = `${s.stage}.${idx}`;
    if (key !== last.caption) {
      last.caption = key;
      const sp = st.steps[idx];
      $('cap-ko').textContent = sp.ko;
      $('cap-en').textContent = sp.en;
    }
    routeBtns.forEach((b, i) => {
      const p = i < s.stage ? 1 : i === s.stage ? s.f : 0;
      once(`rb${i}`, p.toFixed(2), () => b.style.setProperty('--p', p.toFixed(3)));
    });
    const sv = String(Math.round(s.u * 1000));
    if (last.scrub !== sv && document.activeElement !== scrub) { last.scrub = sv; scrub.value = sv; }
    scrub.setAttribute('aria-valuetext', `${s.stage + 1} / ${STAGE_COUNT}: ${st.name.en} ${Math.round(s.f * 100)}%`);
  }

  // ---------- frame loop ----------
  let tPrev = performance.now();
  let visible = true;
  new IntersectionObserver((es) => {
    const v = es[es.length - 1].isIntersecting;
    if (v && !visible) cam.snap = true; // coming back into view: no long glide across the plant
    visible = v;
    T.visible = v;
  }).observe(fig);
  document.addEventListener('visibilitychange', () => { tPrev = performance.now(); });
  let lastRobots = 0;
  function frame(now) {
    // Elapsed WALL-CLOCK time, deliberately not capped: a slow renderer (software GL runs ~1 fps) or a busy main thread
    // must not slow the tour down. (visibilitychange resets tPrev, so a hidden tab does not fast-forward it either.)
    const dt = Math.max(0, (now - tPrev) / 1000);
    tPrev = now;
    T.now = now;
    T.frames++;
    const moving = !T.reduced && (T.playing || T.seek !== null);
    if (T.seek !== null) {
      if (T.snap) { T.u = T.seek; T.seek = null; T.snap = false; }
      else {
        const d = T.seek - T.u;
        const step = d * (1 - Math.exp(-dt * 2.4)) + Math.sign(d) * Math.min(Math.abs(d), dt * 0.35);
        T.u += Math.abs(step) >= Math.abs(d) ? d : step;
        if (Math.abs(T.seek - T.u) < 0.004) { T.u = T.seek; T.seek = null; }
      }
    } else if (T.playing) {
      T.u = advanceTour(T.u, dt); // integrates across stage boundaries, each stage at its own pace
      if (T.u >= END_U) { T.u = END_U; T.playing = false; say('여행이 끝났습니다. 처음부터를 눌러 다시 보세요.', 'The tour is finished. Press Restart to watch again.'); syncUi(true); }
      if (T.sel !== stageOf(T.u)) { T.sel = stageOf(T.u); syncUi(true); }
    }
    if (moving) T.fx += Math.min(dt, 1);
    T.u = clamp(T.u, 0, END_U);
    const s = stateAt(T.u);
    T.s = s;
    // only the SVG redraw is skipped while the figure is off screen; captions, readouts, scrubber and route must stay current
    if (visible) {
      applyStatic(s);
      applyCar(s, T.fx);
      if (now - lastRobots > 30 || T.reduced) { applyRobots(s, T.fx, Math.min(0.2, (now - lastRobots) / 1000), moving); lastRobots = now; }
      stepCamera(s, dt);
      placeChips();
    }
    applyReadouts(s);
    applyCaption(s);
    syncSel();
  }
  function syncSel() {
    const want = String(T.sel) + (T.overview ? 'o' : '') + (T.playing ? 'p' : '') + (T.reduced ? 'r' : '');
    if (want !== last.routeSig) { last.routeSig = want; syncUi(false); }
  }
  let hold = false; // test hook: while true the rAF loop idles and the test steps time itself with tick()
  function loop() {
    if (T.dead) return;
    try {
      // performance.now(), NOT the rAF timestamp: that one is the compositor's frame time and can be stamped BEFORE a long
      // main-thread stall, which would hide the stall from the tour clock (measured: a 7 s stall showed up as 1.8 s).
      if (hold) tPrev = performance.now(); else frame(performance.now());
      T.errors = 0;
    } catch (err) {
      T.errors++;
      T.lastError = String(err && err.stack ? err.stack : err);
      if (T.errors >= 5) {
        T.dead = true;
        const f = $('fail');
        f.hidden = false;
        f.querySelector('.ko').textContent = UI.fail.ko;
        f.querySelector('.en').textContent = UI.fail.en;
        return;
      }
    }
    requestAnimationFrame(loop);
  }

  // ---------- test hooks ----------
  const centre = (n) => { const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; };
  window.__factory = {
    get state() {
      return { u: T.u, stage: T.sel, modelStage: stageOf(T.u), f: T.u - stageOf(T.u), playing: T.playing, seeking: T.seek !== null, overview: T.overview, reduced: T.reduced, errors: T.errors, frames: T.frames, dead: T.dead, viewBox: cam.vb, lastError: T.lastError || '', t: T.now, fx: T.fx, figVisible: T.visible };
    },
    model: stateAt,
    advance: advanceTour,
    stageSeconds: STAGE_SECONDS.slice(),
    captions: CAPTIONS.slice(),
    // deterministic time for tests: hold(true) stops the real frame loop, tick(ms) then runs exactly one frame of `ms` wall-clock milliseconds
    hold(v) { hold = !!v; if (!hold) { tPrev = performance.now(); lastRobots = 0; T.now = tPrev; } },
    tick(ms = 50) { const now = (T.now || performance.now()) + ms; tPrev = now - ms; frame(now); },
    seek(u) { T.u = clamp(u, 0, END_U); T.seek = null; T.snap = false; T.sel = stageOf(T.u); T.playing = false; cam.snap = true; syncUi(true); },
    step: (n) => (n > 0 ? next() : prev()),
    select, play: () => setPlaying(true), pause: () => setPlaying(false),
    chipPos: (stage) => centre(chips[stage]),
    routePos: (stage) => centre(routeBtns[stage]),
    chipVisible: (stage) => !chips[stage].classList.contains('off'),
    carPos() { const q = parts.floor.g.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; },
    colors: () => VARS.map((v) => carG.style.getPropertyValue(v)),
    reduced: () => T.reduced,
  };

  onMq();
  fillCard(0);
  syncUi(true);
  document.documentElement.dataset.ready = '1';
  say('공정을 고르거나 재생을 눌러 보세요', 'Pick a stage or press Play');
  requestAnimationFrame(() => { tPrev = performance.now(); lastRobots = 0; loop(); });
}
