// Live layer: wall-clock tour, two cameras (the plant and the loupe), DOM wiring.
// Everything it draws is a pure function of the model's state(u). Pure SVG (no canvas/WebGL), so there is no context to lose;
// an error counter guards the rAF loop instead. Group transforms only: no path is ever rebuilt per frame except the six robot arms.
import { UI, STAGES, READOUTS, BAY_LABELS } from './data.js';
import { stateAt, robotTargets, readoutValues, captionNumbers, pickStep, advanceTour, END_U, STAGE_COUNT, STAGE_SECONDS, AA, seg } from './model.js';
import { P, at, k, BAYS, PLANT, W, H } from './world.js';
import { BELT_Z, ROBOTS, TRUCK } from './layout.js';
import { HEADS, LAMPS, GLOWS } from './shops.js';
import { TRUCK_X } from './shops2.js';
import { robotArm } from './robot.js';
import { makeLoupe } from './liveloupe.js';
import { fillCard, fillParts, markPart, fillBiz, wireDialogs, pair } from './panels.js';
import { PARTS } from './parts.js';

const $ = (id) => document.getElementById(id);
const tr = (dx, dy, dz) => (dx || dy || dz ? k.translateAlong(P, [dx, dy, dz]) : '');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const SVGNS = 'http://www.w3.org/2000/svg';
// every caption sub-step as a progress value: reduced motion steps through these instead of gliding
const CAPTIONS = [];
STAGES.forEach((st, i) => st.steps.forEach((s2) => CAPTIONS.push(i + Math.min(0.97, s2.f + 0.02))));

// ---------- plant camera regions (world boxes, then fitted to the figure's aspect) ----------
const BAYX = {
  recv: [-10, 232], smt: [158, 368], bond: [364, 556], lens: [552, 716], aa: [716, 918], test: [920, 1122], pack: [1118, 1400], dock: [1236, 1492],
};
const REGION = STAGES.map((st) => ({ x0: BAYX[st.bay][0], x1: BAYX[st.bay][1], y0: -96, y1: 98, z1: 58 }));
const OVERVIEW = { x0: PLANT.x, x1: PLANT.x + PLANT.w + 60, y0: PLANT.y, y1: PLANT.y + PLANT.d, z1: 60 };

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
  const lsvg = $('loupe');
  const lfig = $('lfig');
  if (!svg || !fig || !lsvg || !lfig) return;
  const fx = $('fx');
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');

  // ---------- static strings ----------
  document.querySelectorAll('[data-ui]').forEach((n) => {
    const p = UI[n.dataset.ui];
    if (!p) return;
    const ko = n.querySelector('.ko');
    const en = n.querySelector('.en');
    if (ko) ko.textContent = p.ko;
    if (en) en.textContent = p.en;
  });
  $('cap-lab-ko').textContent = UI.now.ko;
  $('cap-lab-en').textContent = UI.now.en;
  fillBiz();

  // ---------- plant element caches ----------
  const carG = $('car');
  const carLv = [1, 2, 3, 4, 5].map((n) => $(`car-l${n}`));
  const carTray = $('car-tray');
  const carBag = $('car-bag');
  const carCarton = $('car-carton');
  const heads = HEADS.map((h) => ({ ...h, el: $(`hd-${h.id}`) })).filter((h) => h.el);
  const lamps = LAMPS.map((key) => ({ key, el: $(`lp-${key}`) })).filter((l) => l.el);
  const glows = GLOWS.map((key) => ({ key, el: $(`glow-${key}`) })).filter((l) => l.el);
  const arms = {};
  ROBOTS.forEach((r) => { arms[r.id] = { el: $(`arm-${r.id}`), cur: null, key: '' }; });
  const el = {
    shower: $('shower'), person: $('person'), agv: $('agv'), truckB: $('truck-b'), truckF: $('truck-f'), door: $('truck-door'), uv: $('uv-lamp'),
  };
  const ring = document.createElementNS(SVGNS, 'circle');
  ring.setAttribute('id', 'lring');
  ring.setAttribute('class', 'lring');
  ring.setAttribute('r', '10');
  fx.appendChild(ring);

  // ---------- DOM for chips, route ----------
  const route = $('route');
  const chipHost = $('chips');
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

  // ---------- tour state (wall clock) ----------
  // T.u is the model progress; T.seek is a glide target (stage selection); T.sel is the stage whose card is shown.
  // T.fx is the EFFECT clock (head jitter, robot sway). It only runs while something is actually moving (Play, or a glide)
  // and never under reduced motion, so Pause and reduced motion freeze the picture.
  const T = { u: 0, seek: null, snap: false, playing: false, sel: 0, overview: false, now: 0, fx: 0, visible: true, lvisible: true, reduced: mq.matches, errors: 0, frames: 0, dead: false };
  const stageOf = (u) => Math.min(STAGE_COUNT - 1, Math.floor(u));
  const status = $('status');
  const say = (ko, en) => { status.textContent = `${ko} · ${en}`; };
  const stageSay = (n) => say(`${n + 1}번 공정: ${STAGES[n].name.ko}`, `Stage ${n + 1}: ${STAGES[n].name.en}`);
  const finished = () => (T.reduced ? T.u >= CAPTIONS[CAPTIONS.length - 1] - 0.005 : T.u >= END_U - 0.01);

  // ---------- the loupe ----------
  const loupe = makeLoupe({ svg: lsvg, fig: lfig, e0: AA.e0, onPick: (id) => markPart(id) });
  const pickPart = (id) => loupe.setSel(loupe.sel === id ? null : id);

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
    if (edge) { say(dir > 0 ? UI.last.ko : UI.first.ko, dir > 0 ? UI.last.en : UI.first.en); syncUi(true); return; }
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
    if (T.sel >= STAGE_COUNT - 1) { say(UI.lastStage.ko, UI.lastStage.en); return; }
    select(T.sel + 1);
  };
  const prev = () => {
    if (T.reduced) return stepRM(-1);
    const f = T.u - stageOf(T.u);
    select(f > 0.2 && T.sel === stageOf(T.u) ? T.sel : T.sel - 1);
  };
  function setPlaying(v) {
    if (T.reduced && v) { say(UI.noMotion.ko, UI.noMotion.en); return; }
    if (v && T.u >= END_U - 0.01) { T.u = 0; T.sel = 0; T.seek = null; cams(true); }
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
    cams(true);
    if (T.dead) { T.dead = false; requestAnimationFrame(loop); }
    $('fail').hidden = true;
    say(UI.restarted.ko, UI.restarted.en);
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
  $('ctl-replay').addEventListener('click', restart);
  $('ctl-skip').addEventListener('click', skip);
  $('ctl-over').addEventListener('click', () => {
    T.overview = !T.overview;
    say(T.overview ? UI.overOn.ko : UI.overOff.ko, T.overview ? UI.overOn.en : UI.overOff.en);
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
      if (T.overview) { e.preventDefault(); T.overview = false; syncUi(true); say(UI.overOff.ko, UI.overOff.en); }
      else if (T.playing) { e.preventDefault(); setPlaying(false); }
    } else if (/^[1-8]$/.test(e.key)) { e.preventDefault(); select(+e.key - 1); }
  });
  // part picks from the loupe also clear with Escape while the loupe has focus
  lfig.addEventListener('keydown', (e) => { if (e.key === 'Escape' && loupe.sel) { e.preventDefault(); loupe.setSel(null); } });
  const onMq = () => {
    T.reduced = mq.matches;
    if (T.reduced) {
      // a glide in progress must not just vanish (that left the card on one stage and the scene on another):
      // land on the stage that was chosen, at its first caption, then stop everything that moves
      endSeek({ toTarget: true, min: T.seek === null ? 0 : Math.floor(T.seek) + 0.02 });
      T.playing = false;
      cams(true);
    }
    document.documentElement.dataset.motion = T.reduced ? 'reduced' : 'full';
    $('rm-note').hidden = !T.reduced;
    syncUi(true);
  };
  mq.addEventListener('change', onMq);

  // ---------- plant camera ----------
  const cam = { cx: W / 2, cy: H / 2, vw: W, vh: H, snap: true, vb: '' };
  const box = { cw: 1, ch: 1 };
  const measure = () => { const r = fig.getBoundingClientRect(); box.cw = Math.max(1, r.width); box.ch = Math.max(1, r.height); cam.snap = true; };
  const ro = new ResizeObserver(measure);
  ro.observe(fig);
  measure();
  const cams = (snap) => { cam.snap = snap; loupe.cam.snap = snap; };
  // chip half-widths (measured once, and again when the web font arrives) so the selected chip can be kept fully inside the figure
  const chipHalf = chips.map(() => 14);
  const measureChips = () => chips.forEach((c, i) => { chipHalf[i] = Math.max(12, c.offsetWidth / 2); });
  measureChips();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureChips);
  function camTarget(s) {
    const aspect = box.ch / box.cw;
    const narrow = box.cw < 700 || aspect > 0.75;
    let r = T.overview ? OVERVIEW : { ...REGION[T.sel] };
    if (!T.overview && narrow) {
      // a narrow figure follows the carrier along the bay instead of showing the whole bay at a tiny scale
      const carX = s.car.vis > 0.01 ? s.car.x : (r.x0 + r.x1) / 2;
      const half = 78;
      const c = clamp(carX, r.x0 + half, r.x1 - half);
      r = { ...r, x0: c - half, x1: c + half };
    }
    const b = projBox(r);
    const pad = 0.06;
    const bw = (b.x1 - b.x0) * (1 + pad * 2);
    const bh = (b.y1 - b.y0) * (1 + pad * 2);
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
    STAGES.forEach((st, stage) => {
      const b = BAYS[st.bay];
      const [px, py] = toPx(...at(b.x + b.w / 2, b.y + b.d + 2, 0));
      const c = chips[stage];
      const isSel = stage === T.sel && !T.overview;
      const h = compact ? 30 : 36;
      const yMin = 4;
      const yMax = box.ch - h;
      // the chip of the selected bay stays fully on screen (clamped in x and y); the others are hidden when they would be cut off
      const hw = chipHalf[stage] + 2;
      const pxc = isSel ? clamp(px, hw, Math.max(hw, box.cw - hw)) : px;
      const pyc = isSel ? clamp(py, yMin, yMax) : py;
      const off = pxc < 8 || pxc > box.cw - 8 || pyc < yMin || pyc > yMax;
      c.style.transform = `translate(${pxc.toFixed(1)}px,${pyc.toFixed(1)}px)`;
      c.classList.toggle('off', off);
      c.tabIndex = off ? -1 : 0;
      c.setAttribute('aria-hidden', off ? 'true' : 'false');
      c.classList.toggle('on', isSel);
    });
  }

  // ---------- applying the model to the plant ----------
  const last = { sig: {}, caption: '', capnum: '', card: -1, scrub: '', routeSig: '', routeSel: -1, parts: -1 };
  const once = (key, val, fn) => { if (last.sig[key] !== val) { last.sig[key] = val; fn(); } };
  const disp = (n, on) => { n.style.display = on ? '' : 'none'; };
  const setTr = (n, t) => { if (t) n.setAttribute('transform', t); else n.removeAttribute('transform'); };

  function applyPlant(s, t) {
    const c = s.car;
    // the hero carrier on the line, built up level by level (the loupe shows the same module at its own scale)
    once('carVis', c.vis > 0.01 ? 'y' : 'n', () => disp(carG, c.vis > 0.01));
    if (c.vis > 0.01) {
      once('carTr', `${c.x.toFixed(2)}|${c.vis.toFixed(2)}`, () => { setTr(carG, tr(c.x, 0, 0)); carG.style.opacity = c.vis >= 0.99 ? '' : c.vis.toFixed(2); });
      const carton = c.kind === 'carton';
      once('carKind', `${c.kind}|${c.lvl}`, () => {
        disp(carTray, !carton);
        carLv.forEach((g, i) => disp(g, !carton && (c.lvl >= 5 ? i === 0 || i === 4 : i < c.lvl)));
        disp(carBag, c.kind === 'bag');
        disp(carCarton, carton);
      });
      // the loupe ring: where the magnified module is on the line
      const [rx, ry] = at(c.x, 0, BELT_Z + 4);
      const rr = clamp(cam.vw * 0.03, 9, 26);
      once('ring', `${rx.toFixed(1)}|${ry.toFixed(1)}|${rr.toFixed(1)}`, () => { ring.setAttribute('cx', rx.toFixed(1)); ring.setAttribute('cy', ry.toFixed(1)); ring.setAttribute('r', rr.toFixed(1)); });
    }
    once('ringVis', c.vis > 0.01 ? 'y' : 'n', () => { ring.style.display = c.vis > 0.01 ? '' : 'none'; });

    // machine heads, lamps, glows
    const act = s.act;
    heads.forEach((h) => {
      const a = act[h.act] || 0;
      const o = a ? Math.sin(t * h.rate * 3) * h.amp * a : 0;
      once(`hd-${h.id}`, o.toFixed(1), () => {
        const d = h.ax === 'x' ? tr(o, 0, 0) : h.ax === 'y' ? tr(0, o, 0) : tr(0, 0, o);
        setTr(h.el, d);
      });
    });
    lamps.forEach((l) => once(`lp-${l.key}`, (act[l.key] || 0) > 0.5 ? '1' : '0', () => l.el.classList.toggle('on', (act[l.key] || 0) > 0.5)));
    glows.forEach((g) => once(`gl-${g.key}`, String(act[g.key] || 0), () => g.el.style.setProperty('--heat', String(act[g.key] || 0))));
    once('uvlamp', s.aa.uv > 0.05 ? '1' : '0', () => el.uv.classList.toggle('on', s.aa.uv > 0.05));

    // people and carts
    once('shower', String(act.shower), () => { el.shower.style.opacity = act.shower ? '1' : '0'; });
    const pr = s.person;
    const bob = pr.vis > 0.05 && T.fx > 0 ? Math.abs(Math.sin(t * 7)) * 0.7 : 0;
    once('person', `${pr.x.toFixed(1)}|${pr.y.toFixed(1)}|${pr.vis.toFixed(2)}|${bob.toFixed(1)}`, () => {
      disp(el.person, pr.vis > 0.01);
      el.person.style.opacity = pr.vis >= 0.99 ? '' : pr.vis.toFixed(2);
      setTr(el.person, tr(pr.x - 20, pr.y - 52, bob));
    });
    const agvX = s.stage === 0 ? 90 * Math.sin(Math.PI * seg(s.f, 0, 0.34)) : 0;
    once('agv', agvX.toFixed(1), () => setTr(el.agv, tr(agvX, 0, 0)));
    const tk = s.truck;
    once('truck', `${tk.x.toFixed(1)}|${tk.vis.toFixed(2)}|${tk.door.toFixed(2)}`, () => {
      const on = tk.vis > 0.01;
      disp(el.truckB, on);
      disp(el.truckF, on);
      const t2 = tr(tk.x - TRUCK_X, 0, 0);
      setTr(el.truckB, t2);
      setTr(el.truckF, t2);
      setTr(el.door, tr(0, 0, 4 * tk.door));
      el.door.style.opacity = (1 - tk.door).toFixed(2);
    });
  }

  // robots: smooth toward the model's target; rebuild an arm only when it moved.
  // `t` is the effect clock (frozen while paused / under reduced motion) and `moving` says whether the tour is playing or gliding:
  // when it is not, the arms go straight to the pose for the current progress instead of easing, so a paused plant is truly still.
  function applyRobots(s, t, dt, moving) {
    const tg = robotTargets(s, t);
    const a = T.reduced || !moving ? 1 : 1 - Math.exp(-dt * 7);
    ROBOTS.forEach((r) => {
      const rec = arms[r.id];
      if (!rec.el) return;
      const want = tg[r.id];
      if (!rec.cur) rec.cur = want.slice();
      else for (let j = 0; j < 3; j++) rec.cur[j] = lerp(rec.cur[j], want[j], a);
      const key = rec.cur.map((v) => v.toFixed(1)).join(',');
      if (key !== rec.key) {
        rec.key = key;
        rec.el.innerHTML = robotArm(r.x, r.y, rec.cur, r);
      }
    });
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
  function applyReadouts(s) {
    const vals = readoutValues(s);
    const show = STAGES[T.sel].readouts;
    Object.entries(roNodes).forEach(([key, row]) => {
      const on = show.includes(key);
      once(`ro-h-${key}`, on ? 'y' : 'n', () => { row.hidden = !on; });
      if (on) once(`ro-${key}`, String(vals[key]), () => { row.querySelector('.v').textContent = vals[key]; });
    });
  }
  function syncUi(force) {
    const sel = T.sel;
    if (force || last.card !== sel) { last.card = sel; fillCard(sel); }
    if (force || last.parts !== sel) { last.parts = sel; fillParts(sel, pickPart); markPart(loupe.sel); }
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
    // Replay appears in the loupe once the whole journey has been shown
    $('ctl-replay').hidden = !finished() || T.playing;
  }
  function applyCaption(s) {
    const st = STAGES[s.stage];
    const idx = pickStep(st.steps, s.f);
    const key = `${s.stage}.${idx.f}`;
    if (key !== last.caption) {
      last.caption = key;
      $('cap-ko').textContent = idx.ko;
      $('cap-en').textContent = idx.en;
    }
    const num = captionNumbers(s);
    const nk = `${num.ko}|${num.en}`;
    if (nk !== last.capnum) {
      last.capnum = nk;
      const n = $('cap-num');
      n.querySelector('.ko').textContent = num.ko;
      n.querySelector('.en').textContent = num.en;
    }
    routeBtns.forEach((b, i) => {
      const p = i < s.stage ? 1 : i === s.stage ? s.f : 0;
      once(`rb${i}`, p.toFixed(2), () => b.style.setProperty('--p', p.toFixed(3)));
    });
    const sv = String(Math.round(s.u * 1000));
    if (last.scrub !== sv && document.activeElement !== scrub) { last.scrub = sv; scrub.value = sv; }
    scrub.setAttribute('aria-valuetext', `${s.stage + 1} / ${STAGE_COUNT}: ${st.name.en} ${Math.round(s.f * 100)}%`);
  }

  // ---------- dialogs ----------
  const dialogs = wireDialogs(() => syncUi(false));

  // ---------- frame loop ----------
  let tPrev = performance.now();
  const watch = (node, key, onShow) => new IntersectionObserver((es) => {
    const v = es[es.length - 1].isIntersecting;
    if (v && !T[key]) onShow();
    T[key] = v;
  }).observe(node);
  watch(fig, 'visible', () => { cam.snap = true; });
  watch(lfig, 'lvisible', () => { loupe.cam.snap = true; });
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
      if (T.u >= END_U) { T.u = END_U; T.playing = false; say(UI.finished.ko, UI.finished.en); syncUi(true); }
      if (T.sel !== stageOf(T.u)) { T.sel = stageOf(T.u); syncUi(true); }
    }
    if (moving) T.fx += Math.min(dt, 1);
    T.u = clamp(T.u, 0, END_U);
    const s = stateAt(T.u);
    T.s = s;
    // only the SVG redraws are skipped while a figure is off screen; captions, readouts, scrubber and route must stay current
    if (T.visible) {
      applyPlant(s, T.fx);
      if (now - lastRobots > 30 || T.reduced) { applyRobots(s, T.fx, Math.min(0.2, (now - lastRobots) / 1000), moving); lastRobots = now; }
      stepCamera(s, dt);
      placeChips();
    }
    if (T.lvisible) loupe.apply(s, { dt, reduced: T.reduced });
    applyReadouts(s);
    applyCaption(s);
    syncSel();
  }
  function syncSel() {
    const want = String(T.sel) + (T.overview ? 'o' : '') + (T.playing ? 'p' : '') + (T.reduced ? 'r' : '') + (finished() ? 'f' : '');
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
  window.__camfactory = {
    get state() {
      return {
        u: T.u, stage: T.sel, modelStage: stageOf(T.u), f: T.u - stageOf(T.u), playing: T.playing, seeking: T.seek !== null, overview: T.overview, reduced: T.reduced,
        errors: T.errors, frames: T.frames, dead: T.dead, viewBox: cam.vb, loupeViewBox: loupe.cam.vb, loupeView: loupe.cam.view, lastError: T.lastError || '', t: T.now, fx: T.fx,
        figVisible: T.visible, finished: finished(), partSel: loupe.sel, dialog: dialogs.open() ? dialogs.open().id : '', replayShown: !$('ctl-replay').hidden,
      };
    },
    model: stateAt,
    advance: advanceTour,
    stageSeconds: STAGE_SECONDS.slice(),
    captions: CAPTIONS.slice(),
    partCount: PARTS.length,
    // deterministic time for tests: hold(true) stops the real frame loop, tick(ms) then runs exactly one frame of `ms` wall-clock milliseconds
    hold(v) { hold = !!v; if (!hold) { tPrev = performance.now(); lastRobots = 0; T.now = tPrev; } },
    tick(ms = 50) { const now = (T.now || performance.now()) + ms; tPrev = now - ms; frame(now); },
    seek(u) { T.u = clamp(u, 0, END_U); T.seek = null; T.snap = false; T.sel = stageOf(T.u); T.playing = false; cams(true); syncUi(true); },
    step: (n) => (n > 0 ? next() : prev()),
    select, play: () => setPlaying(true), pause: () => setPlaying(false),
    chipPos: (stage) => centre(chips[stage]),
    routePos: (stage) => centre(routeBtns[stage]),
    chipVisible: (stage) => !chips[stage].classList.contains('off'),
    partPos: (id) => { const r = loupe.byId[id]; return r ? centre(r.g) : null; },
    partShown: () => loupe.recs.filter((r) => r.g.style.display !== 'none').length,
    partOrder: () => loupe.order,
    pickPart,
    carPos() { return centre(carG); },
    ringPos() { return centre(ring); },
    reduced: () => T.reduced,
  };

  onMq();
  syncUi(true);
  document.documentElement.dataset.ready = '1';
  say(UI.hello.ko, UI.hello.en);
  void pair;
  requestAnimationFrame(() => { tPrev = performance.now(); lastRobots = 0; loop(); });
}
