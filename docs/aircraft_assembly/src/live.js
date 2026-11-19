// Live layer: wall-clock tour, camera, DOM wiring. Everything it draws is a pure function of the model's stateAt(u).
// Pure SVG (no canvas / WebGL), so there is no context to lose; an error counter guards the rAF loop instead.
import {
  UI, STAGES, READOUTS, NUMBERS, NUMBER_HEADS, TAGS, SOURCES, CHIP_ANCHORS, LABELS, PARTS, ASM_NAMES,
} from './data.js';
import {
  stateAt, pickStep, advanceTour, END_U, STAGE_COUNT, STAGE_SECONDS, FIN, FINALE_SECONDS,
} from './model.js';
import { at } from './world.js';
import { SUPPLY } from './layout.js';
import { makeScene } from './apply.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
// every caption sub-step as a progress value: reduced motion steps through these instead of gliding
const CAPTIONS = [];
STAGES.forEach((st, i) => st.steps.forEach((s2) => CAPTIONS.push(i + Math.min(0.97, s2.f + 0.02))));

const OVER_CORNERS = [[-7100, -560, 0], [9700, -560, 0], [-7100, 480, 0], [9700, 480, 0], [-3000, 0, 330], [9700, 480, 330]].map((p) => at(...p));
const OVER = {
  x0: Math.min(...OVER_CORNERS.map((p) => p[0])), x1: Math.max(...OVER_CORNERS.map((p) => p[0])),
  y0: Math.min(...OVER_CORNERS.map((p) => p[1])), y1: Math.max(...OVER_CORNERS.map((p) => p[1])),
};
const pair = (n, p) => {
  if (!n) return;
  const ko = n.querySelector('.ko');
  const en = n.querySelector('.en');
  if (ko) ko.textContent = p.ko;
  if (en) en.textContent = p.en;
};
const tagPill = (t) => {
  const tg = TAGS[t];
  const sp = document.createElement('span');
  sp.className = `tg ${tg.cls}`;
  sp.textContent = tg.ko;
  sp.title = tg.en;
  sp.setAttribute('aria-label', `${tg.ko} · ${tg.en}`);
  return sp;
};
const bilingual = (cls, p, tag) => {
  const w = document.createElement('div');
  w.className = cls;
  const ko = document.createElement('span');
  ko.className = 'ko';
  ko.lang = 'ko';
  const en = document.createElement('span');
  en.className = 'en';
  en.lang = 'en';
  if (tag) ko.appendChild(tagPill(tag));
  ko.appendChild(document.createTextNode(p.ko));
  en.textContent = p.en;
  w.append(ko, en);
  return w;
};

export function boot() {
  const svg = $('plant');
  const fig = $('fig');
  if (!svg || !fig) return;
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scene = makeScene();

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
    pair(b, st.short);
    li.appendChild(b);
    route.appendChild(li);
    routeBtns.push(b);
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'chip';
    c.dataset.i = String(i);
    c.innerHTML = '<span class="n"></span><span class="names"><span class="ko" lang="ko"></span><span class="en" lang="en"></span></span>';
    c.querySelector('.n').textContent = String(i + 1);
    pair(c, st.short);
    c.setAttribute('aria-label', `${st.name.ko} / ${st.name.en}`);
    chipHost.appendChild(c);
    chips.push(c);
  });
  // plain labels on the drawing (no buttons): place names, supply nodes, the day tag. Decorative, so hidden from assistive tech.
  const labelChip = (cls) => {
    const d = document.createElement('div');
    d.className = `chip lab off ${cls}`;
    d.setAttribute('aria-hidden', 'true');
    d.innerHTML = '<span class="names"><span class="ko" lang="ko"></span><span class="en" lang="en"></span></span>';
    chipHost.appendChild(d);
    return d;
  };
  const labels = LABELS.map((l) => { const d = labelChip(l.back ? 'back' : ''); pair(d, l); return { d, l }; });
  const supplyChips = SUPPLY.map((n) => {
    const d = labelChip(n.y < 0 || n.back ? 'back' : '');
    const unk = n.c === 'u';
    pair(d, { ko: `${n.ko} · ${n.what.ko}${unk ? ' [미확인]' : ''}`, en: `${n.en} · ${n.what.en}${unk ? ' [unverified]' : ''}` });
    return { d, n };
  });
  const dayChip = labelChip('back day');
  // static UI strings
  document.querySelectorAll('[data-ui]').forEach((n) => {
    const p = UI[n.dataset.ui];
    if (p) pair(n, p);
  });

  // ---------- tour state (wall clock) ----------
  // T.u is the model progress; T.seek is a glide target (stage selection); T.sel is the stage whose card is shown.
  // T.fx is the EFFECT clock (sparks, shimmer, pulses). It only runs while something is actually moving (Play, or a glide) and never
  // under reduced motion, so Pause and reduced motion freeze the picture.
  const T = { u: 0, seek: null, snap: false, playing: false, sel: 0, overview: false, now: 0, fx: 0, visible: true, reduced: mq.matches, errors: 0, frames: 0, dead: false, s: null, rec: { attached: 0, moving: [] } };
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
    if (T.sel >= STAGE_COUNT - 1) { say('마지막 공정입니다', 'This is the last stage'); return undefined; }
    return select(T.sel + 1);
  };
  const prev = () => {
    if (T.reduced) return stepRM(-1);
    const f = T.u - stageOf(T.u);
    return select(f > 0.2 && T.sel === stageOf(T.u) ? T.sel : T.sel - 1);
  };
  function setPlaying(v) {
    if (T.reduced && v) { say(UI.reduced.ko, UI.reduced.en); return; }
    if (v && T.u >= END_U - 0.01) { T.u = 0; T.sel = 0; T.seek = null; cam.snap = true; }
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
    cam.snap = true;
    if (T.dead) { T.dead = false; requestAnimationFrame(loop); }
    $('fail').hidden = true;
    say('처음으로 돌아갑니다', 'Back to the start');
    setPlaying(!T.reduced);
  };
  const skip = () => {
    // jump to the start of the next stage without gliding
    if (T.reduced) return stepRM(1);
    if (T.sel >= STAGE_COUNT - 1) { T.u = END_U; T.seek = null; T.snap = false; syncUi(true); return undefined; }
    return select(T.sel + 1, { snap: true });
  };
  // the finale again from the lined-up start: the same simulated take-off, 1x
  const replay = () => {
    T.errors = 0;
    T.sel = STAGE_COUNT - 1;
    T.overview = false;
    T.seek = null;
    T.snap = false;
    T.u = STAGE_COUNT - 1;
    cam.snap = true;
    if (T.dead) { T.dead = false; requestAnimationFrame(loop); }
    $('fail').hidden = true;
    if (T.reduced) {
      T.u = STAGE_COUNT - 1 + 0.02;
      T.playing = false;
      say('이륙 장면의 처음으로 돌아갑니다. 다음 버튼으로 설명을 넘기세요.', 'Back to the start of the take-off. Use Next to step through.');
      syncUi(true);
      return;
    }
    T.playing = true;
    say('이륙을 처음부터 다시 봅니다', 'Replaying the take-off');
    syncUi(true);
  };

  // ---------- buttons and keys ----------
  $('ctl-next').addEventListener('click', next);
  $('ctl-prev').addEventListener('click', prev);
  $('ctl-play').addEventListener('click', () => setPlaying(!T.playing));
  $('ctl-restart').addEventListener('click', restart);
  $('ctl-skip').addEventListener('click', skip);
  $('ctl-replay').addEventListener('click', replay);
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
  // Keyboard shortcuts only apply while focus is in the figure, the tour controls or the route list. Everywhere else the keys keep
  // their normal job (scrolling the page, moving a slider), so nothing is hijacked and Page Up/Down are never touched.
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
    } else if (/^[1-8]$/.test(e.key)) { e.preventDefault(); select(+e.key - 1); }
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

  // ---------- sources dialog ----------
  const dlg = $('sources');
  const body = $('src-body');
  SOURCES.forEach((g) => {
    const h = document.createElement('h3');
    h.innerHTML = '<span class="ko" lang="ko"></span><span class="en" lang="en"></span>';
    pair(h, g.h);
    body.appendChild(h);
    const ul = document.createElement('ul');
    g.items.forEach((it) => {
      const li = document.createElement('li');
      const w = bilingual('item', it, it.t);
      li.appendChild(w);
      if (it.src) {
        const c = document.createElement('code');
        c.textContent = it.src;
        w.appendChild(c);
      }
      ul.appendChild(li);
    });
    body.appendChild(ul);
  });
  $('ctl-src').addEventListener('click', () => { if (!dlg.open) dlg.showModal(); });
  $('src-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => $('ctl-src').focus());

  // ---------- numbers strip ----------
  (function buildNumbers() {
    const host = $('numbers-body');
    const head = (p) => { const h = document.createElement('h3'); h.innerHTML = '<span class="ko" lang="ko"></span><span class="en" lang="en"></span>'; pair(h, p); return h; };
    const rates = document.createElement('div');
    rates.className = 'nm';
    rates.appendChild(head(NUMBER_HEADS.rates));
    const ul = document.createElement('ul');
    ul.className = 'bars';
    NUMBERS.rates.forEach((r) => {
      const li = document.createElement('li');
      const when = document.createElement('span');
      when.className = 'when';
      when.textContent = r.when;
      const b = document.createElement('span');
      b.className = 'b';
      const i = document.createElement('i');
      i.style.setProperty('--w', String(Math.round((r.v / 52) * 100)));
      b.appendChild(i);
      const val = document.createElement('span');
      val.className = 'val';
      val.append(tagPill(r.tag), String(r.v));
      li.append(when, b, val);
      if (r.note || r.whenEn) {
        const nt = document.createElement('span');
        nt.className = 'nt';
        nt.textContent = [r.whenEn, r.note && `${r.note.ko} · ${r.note.en}`].filter(Boolean).join(' · ');
        li.appendChild(nt);
      }
      ul.appendChild(li);
    });
    rates.appendChild(ul);
    const cum = document.createElement('div');
    cum.className = 'nm';
    cum.appendChild(head(NUMBER_HEADS.cumulative));
    const cd = document.createElement('div');
    cd.className = 'cum';
    NUMBERS.cumulative.forEach((c) => {
      const d = document.createElement('div');
      const st = document.createElement('strong');
      st.textContent = c.v;
      const ko = document.createElement('span');
      ko.className = 'ko';
      ko.append(tagPill(c.tag), c.ko);
      const en = document.createElement('span');
      en.className = 'en';
      en.textContent = c.en;
      d.append(st, ko, en);
      cd.appendChild(d);
    });
    cum.appendChild(cd);
    const ln = document.createElement('div');
    ln.className = 'nm';
    ln.appendChild(head(NUMBER_HEADS.lines));
    ln.appendChild(bilingual('', NUMBERS.lines, NUMBERS.lines.tag));
    host.append(rates, cum, ln);
    // the strip sits under the card in the scrolling side column: when it is opened, bring it into view
    const nd = $('numbers');
    nd.addEventListener('toggle', () => { if (nd.open) nd.scrollIntoView({ block: 'nearest', behavior: 'auto' }); });
  }());

  // ---------- camera ----------
  const cam = { cx: 0, cy: 0, vw: 3000, snap: true, vb: '', vh: 1800 };
  const box = { cw: 1, ch: 1, legendH: -1 };
  // the figure's size, kept up to date by a ResizeObserver; measureBox() reads it synchronously (the test hooks call it, because the
  // observer's callback only arrives with a rendered frame and the tests drive frames by hand)
  function measureBox() {
    const r = fig.getBoundingClientRect();
    const cw = Math.max(1, r.width);
    const ch = Math.max(1, r.height);
    if (cw !== box.cw || ch !== box.ch) { box.cw = cw; box.ch = ch; box.legendH = -1; cam.snap = true; }
  }
  const ro = new ResizeObserver(measureBox);
  ro.observe(fig);
  // chip half-widths (measured once, and again when the web font arrives) so the selected chip can be kept fully inside the figure
  const chipHalf = chips.map(() => 14);
  const measureChips = () => chips.forEach((c, i) => { chipHalf[i] = Math.max(12, c.offsetWidth / 2); });
  measureChips();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureChips);
  function camTarget(s) {
    const aspect = box.ch / box.cw;
    if (T.overview) {
      const bw = (OVER.x1 - OVER.x0) * 1.05;
      const bh = (OVER.y1 - OVER.y0) * 1.1;
      return { cx: (OVER.x0 + OVER.x1) / 2, cy: (OVER.y0 + OVER.y1) / 2, vw: Math.max(bw, bh / aspect) };
    }
    const f = s.focus;
    const [cx, cy] = at(f.x, f.y, f.z);
    // portrait or small figures: pull in closer (the supply map in stage 1 is already as wide as the figure)
    const narrow = box.cw < 700 || aspect > 0.75;
    return { cx, cy, vw: f.w * (narrow && s.u >= 1 ? 0.78 : 1) };
  }
  function stepCamera(s, dt) {
    const t = camTarget(s);
    // the finale follows a fast plane: a stiffer camera so it stays in frame
    const rate = s.u >= 7 + FIN.lineup / FINALE_SECONDS ? 12 : 3.4;
    const a = cam.snap || T.reduced ? 1 : 1 - Math.exp(-dt * rate);
    cam.cx = lerp(cam.cx, t.cx, a); cam.cy = lerp(cam.cy, t.cy, a); cam.vw = lerp(cam.vw, t.vw, a);
    cam.snap = false;
    const vh = cam.vw * (box.ch / box.cw);
    const vb = `${(cam.cx - cam.vw / 2).toFixed(1)} ${(cam.cy - vh / 2).toFixed(1)} ${cam.vw.toFixed(1)} ${vh.toFixed(1)}`;
    if (vb !== cam.vb) { svg.setAttribute('viewBox', vb); cam.vb = vb; }
    cam.vh = vh;
  }
  const toPx = (sx, sy) => [((sx - (cam.cx - cam.vw / 2)) / cam.vw) * box.cw, ((sy - (cam.cy - cam.vh / 2)) / cam.vh) * box.ch];
  let lastCompact = null;
  const place = (c, px, py, off) => {
    c.style.transform = `translate(${px.toFixed(1)}px,${py.toFixed(1)}px)`;
    if (c.classList.contains('off') !== off) c.classList.toggle('off', off);
  };
  const lastText = { day: '' };
  function placeChips(s) {
    const compact = box.cw < 640;
    if (compact !== lastCompact) { lastCompact = compact; fig.classList.toggle('compact', compact); measureChips(); }
    const inside = (px, py, m = 8) => px > m && px < box.cw - m && py > m && py < box.ch - m;
    if (box.legendH < 0) { const lg = $('legend'); box.legendH = lg.offsetHeight + (parseFloat(getComputedStyle(lg).bottom) || 0); }
    CHIP_ANCHORS.forEach((a, i) => {
      const c = chips[i];
      const [px, py] = toPx(...at(a.x, a.y, a.z));
      const isSel = i === T.sel && !T.overview;
      const h = compact ? 30 : 36;
      const yMin = a.back ? h : 4;
      // the selected chip stays above the legend strip (it would be hidden behind it otherwise)
      const yMax = a.back ? box.ch - box.legendH - 6 : box.ch - box.legendH - h - 6;
      // the chip of the selected stage stays fully on screen; when its anchor is out of frame (the camera pans away in the finale) it is pinned to the top right, clear of the numbers at the top left
      const hw = chipHalf[i] + 2;
      let pxc = px;
      let pyc = py;
      let off = px < 8 || px > box.cw - 8 || py < yMin || py > yMax;
      if (isSel) {
        off = false;
        const xIn = px >= hw && px <= box.cw - hw;
        if (!xIn || py < -40 || py > box.ch + 80) { pxc = Math.max(hw, box.cw - hw - 10); pyc = a.back ? yMin + 4 : 6; } else pyc = clamp(py, yMin, Math.max(yMin, yMax));
      }
      c.style.transform = `translate(${pxc.toFixed(1)}px,${pyc.toFixed(1)}px)`;
      c.classList.toggle('off', off);
      c.tabIndex = off ? -1 : 0;
      c.setAttribute('aria-hidden', off ? 'true' : 'false');
      c.classList.toggle('on', isSel);
      c.classList.toggle('back', !!a.back);
    });
    labels.forEach(({ d, l }) => {
      const live = T.overview ? true : s.u >= l.u0 && s.u < l.u1;
      if (!live) { if (!d.classList.contains('off')) d.classList.add('off'); return; }
      const [px, py] = toPx(...at(l.x, l.y, l.z));
      place(d, px, py, !inside(px, py));
    });
    supplyChips.forEach(({ d, n }) => {
      const live = !T.overview && s.u < 1.02;
      if (!live) { if (!d.classList.contains('off')) d.classList.add('off'); return; }
      const [px, py] = toPx(...at(n.x, n.y, 0));
      place(d, px, py, !inside(px, py));
    });
    // the day tag above the plane while it is on the moving line
    const onLine = !T.overview && s.u >= 3 && s.u < 6;
    if (!onLine) { if (!dayChip.classList.contains('off')) dayChip.classList.add('off'); } else {
      const pl = s.plane;
      const n = Math.floor(s.day);
      const txt = n >= 1 ? `${n}일째 · day ${n}` : '도착 중 · arriving';
      if (lastText.day !== txt) {
        lastText.day = txt;
        pair(dayChip, n >= 1 ? { ko: `${n}일째`, en: `day ${n}` } : { ko: '도착 중', en: 'arriving' });
      }
      const [px, py] = toPx(...at(pl.x + 200, pl.y, pl.z + 112));
      place(dayChip, px, py, !inside(px, py));
    }
  }

  // ---------- readouts, caption, card, route ----------
  const roHost = $('readouts');
  const roNodes = {};
  Object.keys(READOUTS).forEach((key) => {
    const row = document.createElement('div');
    row.className = 'ro';
    row.dataset.key = key;
    row.innerHTML = '<dt><span class="ko" lang="ko"></span><span class="en" lang="en"></span></dt><dd><b class="v">0</b><span class="u"></span></dd>';
    pair(row, READOUTS[key]);
    row.querySelector('.u').textContent = READOUTS[key].unit ? ` ${READOUTS[key].unit}` : '';
    roHost.appendChild(row);
    roNodes[key] = row;
  });
  const fitRow = document.createElement('div');
  fitRow.className = 'ro fit';
  fitRow.hidden = true;
  fitRow.innerHTML = '<dt><span class="ko" lang="ko"></span><span class="en" lang="en"></span></dt><dd><span class="ko" lang="ko"></span><span class="en" lang="en"></span></dd>';
  pair(fitRow.querySelector('dt'), UI.fitting);
  roHost.appendChild(fitRow);
  const fmt = (v) => v.toLocaleString('en-US');
  const last = { sig: {}, caption: '', card: -1, scrub: '', routeSig: '', routeSel: -1 };
  const once = (key, val, fn) => { if (last.sig[key] !== val) { last.sig[key] = val; fn(); } };
  const nameOf = (k) => (k.startsWith('a:') ? ASM_NAMES[k.slice(2)] : PARTS[k.slice(2)]);
  function applyReadouts(s) {
    const show = STAGES[T.sel].readouts;
    Object.entries(roNodes).forEach(([key, row]) => {
      const on = show.includes(key);
      once(`ro-h-${key}`, on ? 'y' : 'n', () => { row.hidden = !on; });
      if (on) once(`ro-${key}`, String(s.ro[key]), () => { row.querySelector('.v').textContent = fmt(s.ro[key]); });
    });
    // "fitting now": the one or two things moving into place this moment (derived from the model's offsets)
    const seen = new Set();
    const names = [];
    for (const k of T.rec.moving) {
      const nm = nameOf(k);
      if (!nm || seen.has(nm.en)) continue;
      seen.add(nm.en);
      names.push(nm);
      if (names.length >= 2) break;
    }
    const showFit = names.length > 0 && s.u >= 1 && s.u < 7 && !T.overview;
    const ko = names.map((n) => n.ko).join(' · ');
    const en = names.map((n) => n.en).join(' · ');
    once('fit', showFit ? `${ko}|${en}` : '', () => {
      fitRow.hidden = !showFit;
      if (showFit) pair(fitRow.querySelector('dd'), { ko, en });
    });
  }
  function fillCard(i) {
    const st = STAGES[i];
    pair($('card-name'), st.name);
    pair($('card-what'), st.what);
    pair($('card-in'), st.inn);
    pair($('card-out'), st.out);
    pair($('card-keytext'), { ko: st.key.ko, en: st.key.en });
    pair($('legend'), st.legend);
    box.legendH = -1; // re-measure on the next frame (the legend text changed)
    $('card-keyvalue').textContent = st.key.value;
    const ul = $('card-equip');
    ul.textContent = '';
    st.equipment.forEach((q) => {
      const li = document.createElement('li');
      li.innerHTML = '<span class="ko" lang="ko"></span><span class="en" lang="en"></span>';
      pair(li, q);
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
    $('ctl-replay').hidden = sel !== STAGE_COUNT - 1;
    $('stage-count').textContent = `${sel + 1} / ${STAGE_COUNT}`;
    document.body.dataset.stage = String(sel);
    svg.dataset.focus = T.overview ? 'all' : STAGES[sel].id;
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
  function frame(now) {
    // Elapsed WALL-CLOCK time, deliberately not capped: a slow renderer (software GL runs ~1 fps) or a busy main thread must not slow
    // the tour down. (visibilitychange resets tPrev, so a hidden tab does not fast-forward it either.)
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
      if (T.u >= END_U) { T.u = END_U; T.playing = false; say(UI.done.ko, UI.done.en); syncUi(true); }
      if (T.sel !== stageOf(T.u)) { T.sel = stageOf(T.u); syncUi(true); }
    }
    if (moving) T.fx += Math.min(dt, 1);
    T.u = clamp(T.u, 0, END_U);
    const s = stateAt(T.u);
    T.s = s;
    // only the SVG redraw is skipped while the figure is off screen; captions, readouts, scrubber and route must stay current
    if (visible) {
      T.rec = scene.apply(s, T.fx);
      stepCamera(s, dt);
      placeChips(s);
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
      // performance.now(), NOT the rAF timestamp: that one is the compositor's frame time and can be stamped BEFORE a long main-thread
      // stall, which would hide the stall from the tour clock.
      if (hold) tPrev = performance.now(); else frame(performance.now());
      T.errors = 0;
    } catch (err) {
      T.errors++;
      T.lastError = String(err && err.stack ? err.stack : err);
      if (T.errors >= 5) {
        T.dead = true;
        const f = $('fail');
        f.hidden = false;
        pair(f, UI.fail);
        return;
      }
    }
    requestAnimationFrame(loop);
  }

  // ---------- test hooks ----------
  const centre = (n) => { const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; };
  window.__aircraft = {
    get state() {
      const t = T.s && T.s.take;
      return {
        u: T.u, stage: T.sel, modelStage: stageOf(T.u), f: T.u - stageOf(T.u), playing: T.playing, seeking: T.seek !== null, overview: T.overview,
        reduced: T.reduced, errors: T.errors, frames: T.frames, dead: T.dead, viewBox: cam.vb, lastError: T.lastError || '', t: T.now, fx: T.fx,
        figVisible: T.visible, day: T.s ? T.s.day : 0, partsAttached: T.rec.attached, partCount: scene.partCount,
        takeoff: t ? { phase: t.phase, t: t.t, v_kt: t.v * 1.943844, dist_m: t.dist, pitch_deg: t.pitch, alt_m: t.alt, gear: t.gear } : null,
      };
    },
    model: stateAt,
    advance: advanceTour,
    stageSeconds: STAGE_SECONDS.slice(),
    captions: CAPTIONS.slice(),
    // deterministic time for tests: hold(true) stops the real frame loop, tick(ms) then runs exactly one frame of `ms` wall-clock milliseconds
    hold(v) { hold = !!v; if (!hold) { tPrev = performance.now(); T.now = tPrev; } },
    tick(ms = 50) { measureBox(); const now = (T.now || performance.now()) + ms; tPrev = now - ms; frame(now); },
    seek(u) { measureBox(); T.u = clamp(u, 0, END_U); T.seek = null; T.snap = false; T.sel = stageOf(T.u); T.playing = false; cam.snap = true; syncUi(true); },
    step: (n) => (n > 0 ? next() : prev()),
    select, play: () => setPlaying(true), pause: () => setPlaying(false), replay,
    chipPos: (stage) => centre(chips[stage]),
    routePos: (stage) => centre(routeBtns[stage]),
    chipVisible: (stage) => !chips[stage].classList.contains('off'),
    planePos() { const r = $('plane').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; },
    reduced: () => T.reduced,
  };

  onMq();
  fillCard(0);
  syncUi(true);
  document.documentElement.dataset.ready = '1';
  say('공정을 고르거나 재생을 눌러 보세요', 'Pick a stage or press Play');
  requestAnimationFrame(() => { tPrev = performance.now(); loop(); });
}
