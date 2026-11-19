// The live page. Everything that moves is time-based (wall clock) and eased toward the pure model:
// yardAt(stage, u) says where everything should be, the page glides there. Nothing here invents a number.
// Names are chosen not to clash with the kit and the model, which share this one script scope.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const pair = (p, tag = 'span', cls = 'bi') => {
  const w = mk(tag, cls);
  const kr = mk('span', 'kr', p.kr); kr.lang = 'ko';
  const en = mk('span', 'en', p.en); en.lang = 'en';
  w.append(kr, en);
  return w;
};
const flat = (p) => `${p.kr} · ${p.en}`;
const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
const f0 = (v) => Math.round(v).toLocaleString('en-US');

const YP = GEO.yard.P, VP = GEO.vessel.P;
const TY = tools(K, YP);
const VN = GEO.vessel.nums;
const SHOP = LAYOUT.shops;
const DK = LAYOUT.dock;
const GIRDER_Z = GEO.yard.crane0.girderZ;
const move = (P, v) => translateAlong(P, v);
const mq = window.matchMedia('(prefers-reduced-motion: reduce)');

// ---- state -------------------------------------------------------------------------------------------------------------
const S = {
  view: 'yard', stage: 0, u: 0, playing: false, hold: 0,
  overview: true,                              // the first view shows the whole yard; the first tour action or selection zooms in
  sel: null,                                   // { kind: 'fac' | 'sys' | 'item', id }
  layers: { hull: true, engine: true, nav: true, elec: true, other: true },
  explode: 0, power: 1, ballast: 0,
  prop: 0,                                     // propeller angle (rad), integrated over time
  reduced: mq.matches, visible: true, clock: 0, frames: 0, errors: 0, snap: true, status: '',
};
let tgt = yardAt(0, 0);
const cur = yardAt(0, 0);                      // what is drawn: eased toward tgt
const X = { explode: 0, ballast: 0, power: 1 }; // eased vessel controls
const cams = { yard: null, vessel: null };
const vp = { w: 0, h: 0 };

// ---- dom ---------------------------------------------------------------------------------------------------------------
const R = {
  vp: $('#viewport'), tags: $('#tags'), note: $('#note'), status: $('#status'), card: $('#card'), chips: $('#chips'),
  panelY: $('#panel-yard'), panelV: $('#panel-vessel'), svgY: $('#svg-yard'), svgV: $('#svg-vessel'),
  ctlY: $('#controls-yard'), ctlV: $('#controls-vessel'),
  stepper: $('#stepper'), caption: $('#caption'), vread: $('#vreadout'), layers: $('#layers'),
  bPlay: $('#b-play'), bPrev: $('#b-prev'), bNext: $('#b-next'), bSkip: $('#b-skip'), bReset: $('#b-reset'),
  rEx: $('#r-explode'), rPw: $('#r-power'), rBa: $('#r-ballast'), oEx: $('#o-explode'), oPw: $('#o-power'), oBa: $('#o-ballast'),
  fallback: $('#fallback'),
  wpMove: $('#wp-move'), wpNest: $('#wp-nest'), wpPrimer: $('#wp-primer'),
  wpf: { plate: $('#wp-plate'), panel: $('#wp-panel'), sub: $('#wp-sub'), block: $('#wp-block') },
  pb: [0, 1, 2, 3, 4, 5].map((i) => $(`#y-pb${i}`)), cb: [0, 1, 2, 3, 4, 5].map((i) => $(`#y-cb${i}`)),
  ship: $('#y-ship'), carry: $('#y-carry'), house: $('#y-house'), gate: $('#y-gate'),
  dockTop: $('#y-dock-top'), dockBand: $('#y-dock-band'), wline: $('#y-wline'),
  craneFar: $('#y-cranefar'), craneNear: $('#y-cranenear'), trolley: $('#y-trolley'),
  rope: $('#y-rope'), foot: $('#y-foot'),
  halo: $('#v-halo'),
};
for (const e of $$('[data-ui-kr]')) { const u = D.UI[e.dataset.uiKr]; if (u) e.textContent = u.kr; }
for (const e of $$('[data-ui-en]')) { const u = D.UI[e.dataset.uiEn]; if (u) e.textContent = u.en; }

// ---- extra dynamic pieces, built once ------------------------------------------------------------------------------
const svgEl = (tag, attrs) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v); return e; };
const D_ = { rope: svgEl('path', { class: 'rope' }), sling: svgEl('path', { class: 'rope sling' }), boom: svgEl('path', { class: 'boom' }), jrope: svgEl('path', { class: 'rope' }), hook: svgEl('g', { id: 'y-hook' }) };
D_.hook.innerHTML = hookParts(TY);                 // trusted: drawn from numbers only
R.rope.append(D_.boom, D_.jrope, D_.rope, D_.sling, D_.hook);
const portal = (() => {
  const p = portalParts(TY, 27), g = svgEl('g', { id: 'y-portal' }), fixed = svgEl('g'), head = svgEl('g');
  fixed.innerHTML = p.fixed; head.innerHTML = p.head; g.append(fixed, head);
  return { g, fixed, head };
})();
const FX = { torch: svgEl('path', { class: 'spark' }), weld: svgEl('path', { class: 'spark' }), blast: svgEl('path', { class: 'grit' }), spray: svgEl('path', { class: 'mist' }) };
R.foot.append(portal.g, FX.torch, FX.weld, FX.blast, FX.spray);
R.wpNest.setAttribute('stroke-dasharray', '1 1');

// the quay crane's swing: pallet (angle 0) to the ship's deck
const PIV = GEO.yard.quayPivot, PAL = GEO.yard.palletTop, HB = GEO.yard.houseBase;
const JIB_R = 63.5, JIB_A1 = Math.atan2(HB[1] - PIV[1], HB[0] - PIV[0]), JIB_Z = 82;
const CUT = { cx: SHOP.cutting.x + 47.5, cy: SHOP.cutting.y + 59 };
const WELD = { x: SHOP.welding.x, y: SHOP.welding.y };

const rnd = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
const pt = (a) => `${a[0].toFixed(1)} ${a[1].toFixed(1)}`;
/** short bright strokes from a world point: sparks that flicker ~14 times a second */
function sparksAt(P, p, n, t, spread, seed) {
  const frame = Math.floor(t * 14);
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = rnd(frame * 31 + i * 17 + seed), b = rnd(frame * 57 + i * 13 + seed + 5), c = rnd(frame * 11 + i * 29 + seed + 9);
    const dx = (a - 0.5) * spread, dy = (b - 0.5) * spread, dz = c * spread;
    d += `M${pt(iso([p[0] + dx * 0.25, p[1] + dy * 0.25, p[2] + dz * 0.2], P))}L${pt(iso([p[0] + dx, p[1] + dy, p[2] + dz], P))}`;
  }
  return d;
}
/** small dots around a box (grit or mist) */
function dotsAround(P, c, half, n, t, seed) {
  const frame = Math.floor(t * 9);
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = rnd(frame * 7 + i * 19 + seed), b = rnd(frame * 3 + i * 23 + seed + 2), h = rnd(frame * 5 + i * 31 + seed + 4);
    const q = iso([c[0] + (a - 0.5) * half[0] * 2, c[1] + (b - 0.5) * half[1] * 2, c[2] + h * half[2]], P);
    d += `M${pt(q)}h0.1`;
  }
  return d;
}

// ---- camera ------------------------------------------------------------------------------------------------------------
const unionBox = (bs) => bs.reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])], [Infinity, Infinity, -Infinity, -Infinity]);
const wbox = (x0, x1, y0, y1, z0, z1) => {
  const pts = [];
  for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) pts.push(iso([x, y, z], YP));
  return [Math.min(...pts.map((q) => q[0])), Math.min(...pts.map((q) => q[1])), Math.max(...pts.map((q) => q[0])), Math.max(...pts.map((q) => q[1]))];
};
const OVERVIEW = [0, 0, GEO.yard.w, GEO.yard.h];
const STAGE_VIEW = [
  wbox(8, 218, 8, 148, 0, 50), wbox(118, 322, 8, 148, 0, 54), wbox(222, 442, 8, 148, 0, 66), wbox(326, 552, 8, 148, 0, 54),
  wbox(112, 566, 286, 462, -36, 170), wbox(112, 820, 286, 462, -36, 170), wbox(470, 820, 330, 462, -36, 110),
];
const YARD_ALL = [100, 8, 946, 700];
const FOCUS_GROUP = { dock: ['dock', 'crane', 'hull'], crane: ['crane', 'dock', 'hull'], hull: ['hull', 'dock'], quay: ['quay', 'hull'] };
const SYS_LAYERS = { hull: ['hull'], engine: ['engine'], nav: ['nav'], elec: ['electrical'], other: ['piping', 'cargo', 'house'] };
const LAYER_SYS = { hull: 'hull', piping: 'other', cargo: 'other', house: 'other', engine: 'engine', electrical: 'elec', nav: 'nav' };
const liftPx = (h) => K.screenRise(h, VP);
/** drawn propeller angular speed (rad/s) at a power fraction: the real rpm slowed by SHIP.visualSlow */
const propOmega = (pf) => (rpmAt(pf) * 2 * Math.PI) / 60 / SHIP.visualSlow;

function fitBox(b, asp, pad = 0.05) {
  let w = (b[2] - b[0]) * (1 + 2 * pad), h = (b[3] - b[1]) * (1 + 2 * pad);
  if (w / h < asp) w = h * asp; else h = w / asp;
  return { x: (b[0] + b[2]) / 2 - w / 2, y: (b[1] + b[3]) / 2 - h / 2, w, h };
}
function yardTargetBox() {
  if (S.sel && S.sel.kind === 'fac') {
    const k = S.sel.id, B = GEO.yard.boxes;
    if (k === 'crane' || k === 'hull') return unionBox([B.dock, B.crane, B.hull]);
    return B[k];
  }
  return S.overview ? YARD_ALL : STAGE_VIEW[S.stage];
}
function vesselTargetBox() {
  const B = GEO.vessel.boxes, boxes = [];
  const sys = S.sel ? (S.sel.kind === 'sys' ? S.sel.id : S.sel.kind === 'item' ? D.ITEMS[S.sel.id].sys : null) : null;
  for (const [layer, b] of Object.entries(B)) {
    const s = LAYER_SYS[layer];
    if (!S.layers[s]) continue;
    if (sys && s !== sys) continue;
    const lift = liftPx(GEO.vessel.nums.lift[layer] * X.explode);
    boxes.push([b[0], b[1] - lift, b[2], b[3] - lift]);
  }
  if (!boxes.length) boxes.push([0, 0, GEO.vessel.w, GEO.vessel.h]);
  let u = unionBox(boxes);
  if (sys === 'nav') u = [u[0] - 90, u[1] - 12, u[2] + 90, u[3] + liftPx(46)];   // the bridge sits on top of its house: keep the house in frame as context
  if (S.sel && S.sel.kind === 'item') {
    const a = itemScreen(S.sel.id);
    if (a) { const hw = 210, hh = 150; u = [a[0] - hw, a[1] - hh, a[0] + hw, a[1] + hh]; }
  }
  return u;
}
function updateCamera(dt) {
  if (!vp.w || !vp.h) return;
  const asp = vp.w / vp.h, view = S.view;
  const t = fitBox(view === 'yard' ? yardTargetBox() : vesselTargetBox(), asp, view === 'yard' ? 0.04 : 0.06);
  let c = cams[view];
  if (!c || S.snap || S.reduced) c = cams[view] = { ...t };
  else for (const k of ['x', 'y', 'w']) c[k] = follow(c[k], t[k], dt, 0.38);
  c.h = c.w / asp;
  (view === 'yard' ? R.svgY : R.svgV).setAttribute('viewBox', `${c.x.toFixed(1)} ${c.y.toFixed(1)} ${c.w.toFixed(1)} ${c.h.toFixed(1)}`);
}

// ---- tags (real buttons laid over the figure) ---------------------------------------------------------------------------
const FAC_ORDER = ['warehouse', 'cutting', 'welding', 'assembly', 'painting', 'dock', 'crane', 'hull', 'quay'];
const SYS_ANCHOR = { hull: 'double-bottom', engine: 'main-engine', nav: 'bridge', elec: 'generators', other: 'cargo' };
const itemScreen = (id) => {
  const a = GEO.vessel.items[id];
  if (!a) return null;
  const p = iso(a.at, VP);
  return [p[0], p[1] - liftPx(GEO.vessel.nums.lift[a.layer] * X.explode)];
};
let tagList = [];
function nameOf(kind, id) { return kind === 'fac' ? D.FACILITIES[id] : kind === 'sys' ? D.SYSTEMS[id] : D.ITEMS[id]; }
function buildTags() {
  R.tags.replaceChildren();
  tagList = [];
  const add = (kind, id, n, anchor) => {
    const b = mk('button', 'tag'); b.type = 'button'; b.dataset.tag = id; b.dataset.kind = kind;
    const i = mk('i', 'n', String(n)); b.append(i, pair(nameOf(kind, id)));
    b.setAttribute('aria-label', flat(nameOf(kind, id)));
    b.addEventListener('click', () => select(kind, id, 'tag'));
    R.tags.append(b);
    tagList.push({ el: b, kind, id, anchor, shown: true });
  };
  if (S.view === 'yard') {
    FAC_ORDER.forEach((k, i) => add('fac', k, i + 1, () => GEO.yard.anchors[k]));
  } else if (S.sel) {
    const sys = S.sel.kind === 'sys' ? S.sel.id : D.ITEMS[S.sel.id].sys;
    D.ITEM_ORDER.filter((id) => D.ITEMS[id].sys === sys && GEO.vessel.items[id]).forEach((id, i) => add('item', id, i + 1, () => itemScreen(id)));
  } else {
    D.SYSTEM_ORDER.forEach((s, i) => add('sys', s, i + 1, () => itemScreen(SYS_ANCHOR[s])));
  }
  syncTags();
}
function placeTags() {
  const c = cams[S.view];
  if (!c || !vp.w) return;
  for (const t of tagList) {
    const a = t.anchor();
    if (!a) continue;
    const x = ((a[0] - c.x) / c.w) * vp.w, y = ((a[1] - c.y) / c.h) * vp.h;
    const sysOn = t.kind === 'fac' || S.layers[t.kind === 'sys' ? t.id : D.ITEMS[t.id].sys];     // no marker on a system that is switched off
    const on = sysOn && x > 6 && x < vp.w - 6 && y > 12 && y < vp.h - 4;
    if (on !== t.shown) { t.el.hidden = !on; t.shown = on; }
    if (on) t.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
  }
}
function syncTags() {
  for (const t of tagList) {
    const on = !!S.sel && S.sel.kind === t.kind && S.sel.id === t.id;
    t.el.classList.toggle('on', on);
    t.el.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
}

// ---- cards, chips, captions ---------------------------------------------------------------------------------------------
function keyRow(label, value) {
  const d = mk('div', 'key'); d.append(pair(label, 'span', 'bi k'), mk('b', 'v', value));
  return d;
}
function renderCard() {
  const c = R.card; c.replaceChildren();
  let kind, id;
  if (S.sel) { kind = S.sel.kind; id = S.sel.id; }
  else if (S.view === 'yard') { kind = 'fac'; id = D.STAGES[S.stage].fac; }
  else { kind = 'intro'; id = null; }
  const data = kind === 'intro' ? D.VESSEL_INTRO : nameOf(kind, id);
  c.dataset.kind = kind; c.dataset.id = id || '';
  if (kind === 'fac' && !S.sel) {
    const st = D.STAGES[S.stage];
    const crumb = mk('p', 'crumb'); crumb.append(pair({ kr: `${D.UI.stepOf.kr} ${S.stage + 1}/7 · ${st.kr}`, en: `${D.UI.stepOf.en} ${S.stage + 1} of 7 · ${st.en}` }, 'span', 'bi inl'));
    c.append(crumb);
  } else if (kind === 'item') {
    const crumb = mk('p', 'crumb'); const b = mk('button', 'link'); b.type = 'button';
    b.append(pair(D.SYSTEMS[data.sys], 'span', 'bi inl'));
    b.addEventListener('click', () => select('sys', data.sys, 'part'));
    crumb.append(b);
    c.append(crumb);
  }
  const h = mk('h2', 'title'); h.append(pair(data)); c.append(h);
  c.append(pair(data.what, 'p', 'bi what'));
  const items = kind === 'sys' ? D.ITEM_ORDER.filter((k) => D.ITEMS[k].sys === id) : null;
  if (items || (data.parts && data.parts.length)) {
    const hh = mk('h3', 'sub'); hh.append(pair(D.UI.keyParts, 'span', 'bi inl')); c.append(hh);
    const ul = mk('ul', 'parts');
    if (items) for (const k of items) { const li = mk('li'); const b = mk('button', 'part'); b.type = 'button'; b.append(pair(D.ITEMS[k], 'span', 'bi inl')); b.addEventListener('click', () => select('item', k, 'part')); li.append(b); ul.append(li); }
    else for (const p of data.parts) { const li = mk('li'); li.append(pair(p, 'span', 'bi inl')); ul.append(li); }
    c.append(ul);
  }
  c.append(keyRow(data.key, data.value));
  const back = S.sel && (kind === 'fac' || kind === 'sys' || kind === 'item');
  if (back) {
    const b = mk('button', 'btn quiet back'); b.type = 'button'; b.id = 'b-all';
    b.append(pair(D.UI.focusAll, 'span', 'bi inl'));
    b.addEventListener('click', () => clearSel('button'));
    c.append(b);
  }
}
function renderChips() {
  R.chips.replaceChildren();
  const h = mk('p', 'chips-h'); h.append(pair(S.view === 'yard' ? D.UI.facilities : D.UI.systems, 'span', 'bi inl'));
  R.chips.append(h);
  const list = S.view === 'yard' ? FAC_ORDER.map((k) => ['fac', k]) : D.SYSTEM_ORDER.map((k) => ['sys', k]);
  list.forEach(([kind, id], i) => {
    const b = mk('button', 'chip'); b.type = 'button'; b.dataset.chip = id; b.dataset.kind = kind;
    b.append(mk('i', 'n', String(i + 1)), pair(nameOf(kind, id)));
    b.addEventListener('click', () => select(kind, id, 'chip'));
    R.chips.append(b);
  });
  syncChips();
}
function syncChips() {
  for (const b of $$('.chip', R.chips)) {
    const on = !!S.sel && ((S.sel.kind === b.dataset.kind && S.sel.id === b.dataset.chip) || (b.dataset.kind === 'sys' && S.sel.kind === 'item' && D.ITEMS[S.sel.id].sys === b.dataset.chip));
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
}
const PHASE = {
  travel: { kr: '이동', en: 'travelling' }, lift: { kr: '들어올림', en: 'lifting' }, carry: { kr: '운반', en: 'carrying' },
  lower: { kr: '내려놓기', en: 'lowering' }, release: { kr: '훅 풀기', en: 'unhooking' }, park: { kr: '대기', en: 'parked' }, idle: { kr: '대기', en: 'idle' },
};
const PSTAGE = { blast: { kr: '쇼트블라스팅', en: 'shot blasting' }, coat: { kr: '도장', en: 'coating' }, dry: { kr: '건조', en: 'drying' } };
function readoutOf(s, r) {
  switch (s) {
    case 0: return { kr: `강판 두께 25 mm · 절단 길이 ${f1(r.cutM)} m`, en: `Plate 25 mm · cut length ${f1(r.cutM)} m` };
    case 1: return { kr: `용접 길이 ${f1(r.weldM)} m`, en: `Weld length ${f1(r.weldM)} m` };
    case 2: return { kr: `소조립 ${r.subs}/3`, en: `Sub-assemblies ${r.subs} of 3` };
    case 3: return { kr: `${PSTAGE[r.stage].kr}${r.stage === 'coat' ? ` · 도막 ${r.um} µm` : ''}`, en: `${PSTAGE[r.stage].en}${r.stage === 'coat' ? ` · coat ${r.um} µm` : ''}` };
    case 4: return { kr: `대표 블록 ${r.block}/6 · ${f0(r.tonnes)} t · 크레인 ${PHASE[r.phase].kr} · 올린 블록 ${r.placed} (실제 배는 약 ${HULL.realBlocks}개 블록)`, en: `Sample block ${r.block} of 6 · ${f0(r.tonnes)} t · crane ${PHASE[r.phase].en} · placed ${r.placed} (a real ship has about ${HULL.realBlocks} blocks)` };
    case 5: return { kr: `수위 ${f1(r.levelM)} / ${DOCK.depth} m · 경과 ${f1(r.hours)} h (빈 도크 근삿값) · ${r.floats ? '배가 뜸' : '아직 안 뜸'}`, en: `Level ${f1(r.levelM)} / ${DOCK.depth} m · elapsed ${f1(r.hours)} h (empty-basin estimate) · ${r.floats ? 'afloat' : 'still grounded'}` };
    default: return { kr: `선실 ${Math.round(r.house * 100)}% 설치 · 시운전 속도 ${f1(r.knots)} kn`, en: `Deckhouse ${Math.round(r.house * 100)}% fitted · trial speed ${f1(r.knots)} kn` };
  }
}
let lastCap = '';
function renderCaption() {
  const st = D.STAGES[S.stage], ro = readoutOf(S.stage, tgt.readout);
  const key = `${S.stage}|${flat(ro)}`;
  if (key === lastCap) return;
  lastCap = key;
  R.caption.replaceChildren();
  R.caption.append(pair(st.say, 'p', 'bi say'));
  const r = pair(ro, 'p', 'bi read'); r.dataset.stage = String(S.stage);
  R.caption.append(r);
}
let lastV = '';
function renderVesselReadout() {
  const key = `${S.power.toFixed(2)}|${S.ballast.toFixed(2)}`;
  if (key === lastV) return;
  lastV = key;
  const draft = ballastDraft(S.ballast), pf = S.power;
  R.vread.replaceChildren();
  R.vread.append(pair({
    kr: `출력 ${Math.round(pf * 100)}% → 프로펠러 ${f0(rpmAt(pf))} rpm · 선속 ${f1(speedAt(pf))} kn · 날개 끝 ${f1(tipSpeed(rpmAt(pf)))} m/s · 발전기 부하 ${f0(genLoadKw(pf))} kW`,
    en: `Power ${Math.round(pf * 100)}% → propeller ${f0(rpmAt(pf))} rpm · speed ${f1(speedAt(pf))} kn · tip ${f1(tipSpeed(rpmAt(pf)))} m/s · generator load ${f0(genLoadKw(pf))} kW`,
  }, 'p', 'bi read'));
  R.vread.append(pair({
    kr: `밸러스트 ${f0(ballastTonnes(S.ballast))} t → 흘수 ${f1(draft)} m`,
    en: `Ballast ${f0(ballastTonnes(S.ballast))} t → draft ${f1(draft)} m`,
  }, 'p', 'bi read'));
}
function say(p) {
  S.status = flat(p);
  R.status.textContent = S.status;
}

// ---- selection ---------------------------------------------------------------------------------------------------------
function select(kind, id, via) {
  if (kind === 'fac' && S.view !== 'yard') setView('yard', true);
  if ((kind === 'sys' || kind === 'item') && S.view !== 'vessel') setView('vessel', true);
  S.sel = { kind, id }; S.overview = false;
  // a system that is switched off cannot be read about: switch its layer back on (the layer buttons follow)
  const sysOf = selSys();
  const revealed = !!sysOf && !S.layers[sysOf];
  if (revealed) { S.layers[sysOf] = true; syncLayerButtons(); }
  const d = nameOf(kind, id);
  say({ kr: `선택: ${d.kr}${revealed ? ' · 레이어를 다시 켰습니다' : ''}`, en: `Selected: ${d.en}${revealed ? ' · layer switched back on' : ''}` });
  const rebuilt = S.view === 'vessel';              // the vessel's tags depend on the selection; the yard's do not
  if (rebuilt) buildTags(); else syncTags();
  renderCard(); syncChips(); syncDim();
  // a click on the figure, a card button or a vessel tag replaces the element that had focus: put focus on the card so keyboard users keep their place
  if (via === 'svg' || via === 'part' || (via === 'tag' && rebuilt)) R.card.focus({ preventScroll: true });
  // on a phone the card sits below the figure: bring it into view
  if (via && window.matchMedia('(max-width: 860px)').matches) R.card.scrollIntoView({ block: 'nearest', behavior: S.reduced ? 'auto' : 'smooth' });
}
/** the ship system (hull/engine/nav/elec/other) the current selection belongs to, or null */
function selSys() {
  if (!S.sel) return null;
  if (S.sel.kind === 'sys') return S.sel.id;
  return S.sel.kind === 'item' ? D.ITEMS[S.sel.id].sys : null;
}
function syncLayerButtons() {
  for (const b of $$('.lt', R.layers)) b.setAttribute('aria-pressed', S.layers[b.dataset.layer] ? 'true' : 'false');
}
function clearSel(via) {
  if (!S.sel) return;
  const prev = S.sel;
  const ae = document.activeElement;
  // focus sits on a marker or on the card's "show all" button, both of which are replaced or removed below
  const hadFocus = !!ae && (R.tags.contains(ae) || ae.id === 'b-all');
  S.sel = null;
  say({ kr: '전체 보기로 돌아왔습니다', en: 'Back to the full view' });
  if (S.view === 'vessel') buildTags(); else syncTags();     // the yard's markers do not depend on the selection, so they (and their focus) stay
  renderCard(); syncChips(); syncDim();
  if (hadFocus || via === 'button') {
    const tagId = prev.kind === 'item' ? D.ITEMS[prev.id].sys : prev.id;      // the replacement marker for what was selected
    const t = R.tags.querySelector(`[data-tag="${tagId}"]`) || R.tags.querySelector('.tag') || R.card;
    t.focus({ preventScroll: true });
    if (document.activeElement !== t) R.card.focus({ preventScroll: true });
  }
}
function syncDim() {
  const sel = S.sel;
  for (const g of $$('#svg-yard .fac')) {
    const k = g.dataset.fac;
    const on = sel && sel.kind === 'fac' && !(FOCUS_GROUP[sel.id] || [sel.id]).includes(k);
    g.classList.toggle('dim', !!on);
  }
  const sys = sel ? (sel.kind === 'sys' ? sel.id : sel.kind === 'item' ? D.ITEMS[sel.id].sys : null) : null;
  for (const g of $$('#svg-vessel .lyr')) g.classList.toggle('dim', !!sys && g.dataset.sys !== sys);
  for (const g of $$('#svg-vessel [data-item]')) g.classList.toggle('sel', !!sel && sel.kind === 'item' && g.dataset.item === sel.id);
}

// ---- the tour ----------------------------------------------------------------------------------------------------------
function stageName(i) { const s = D.STAGES[i]; return { kr: `${i + 1}단계 · ${s.kr}`, en: `Step ${i + 1} · ${s.en}` }; }
function go(i, how) {
  i = clamp(i, 0, D.STAGES.length - 1);
  S.stage = i; S.u = S.reduced ? 1 : 0; S.hold = 0; S.overview = false;
  if (S.sel && S.sel.kind === 'fac') S.sel = null;
  buildTagsIfNeeded();
  say(stageName(i));
  renderCard(); renderStepper(); syncDim(); syncChips();
  void how;
}
const buildTagsIfNeeded = () => { if (S.view === 'yard') syncTags(); };
function setPlaying(on) {
  S.playing = on;
  R.bPlay.setAttribute('aria-pressed', on ? 'true' : 'false');
  R.bPlay.replaceChildren(pair(on ? D.UI.pause : D.UI.play, 'span', 'bi inl'));
}
function renderStepper() {
  if (!R.stepper.children.length) {
    D.STAGES.forEach((st, i) => {
      const li = mk('li'); const b = mk('button', 'step'); b.type = 'button'; b.dataset.step = String(i);
      b.append(mk('i', 'n', String(i + 1)), pair(st));
      b.addEventListener('click', () => { setPlaying(false); go(i); });
      li.append(b); R.stepper.append(li);
    });
  }
  $$('.step', R.stepper).forEach((b, i) => {
    b.classList.toggle('done', i < S.stage);
    if (i === S.stage) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
  });
}
function tourTick(dt) {
  if (!S.playing) return;
  if (S.reduced) {
    S.hold += dt;
    if (S.hold > 6) { S.hold = 0; if (S.stage < 6) go(S.stage + 1); else setPlaying(false); }
    return;
  }
  S.u += dt / STAGE_SECONDS[S.stage];
  if (S.u >= 1) {
    if (S.stage < 6) go(S.stage + 1);
    else { S.u = 1; setPlaying(false); say({ kr: '완성! 처음부터 다시 볼 수 있습니다', en: 'Done! Press Play to watch again' }); }
  }
}
const tour = {
  next() { if (S.stage >= 6) { say({ kr: '마지막 단계입니다', en: 'This is the last step' }); return; } go(S.stage + 1); },
  prev() { if (S.stage <= 0) { say({ kr: '첫 단계입니다', en: 'This is the first step' }); return; } go(S.stage - 1); },
  play() {
    if (S.playing) { setPlaying(false); say({ kr: '일시정지', en: 'Paused' }); return; }
    if (S.stage === 6 && S.u >= 0.999) go(0);
    S.sel = null; S.overview = false; setPlaying(true); syncDim(); buildTagsIfNeeded(); syncChips(); renderCard(); say({ kr: `재생: ${stageName(S.stage).kr}`, en: `Playing: ${stageName(S.stage).en}` });
  },
  // Skip jumps to the end of the CURRENT step and stays there: a playing tour is paused, otherwise the next frame would roll on into the next step
  skip() {
    const wasPlaying = S.playing;
    S.u = 1; S.overview = false;
    if (wasPlaying) setPlaying(false);
    say(wasPlaying ? { kr: '이 단계의 끝으로 이동하고 멈춤', en: 'Jumped to the end of this step and paused' } : { kr: '이 단계의 끝으로 이동', en: 'Jumped to the end of this step' });
  },
  reset() { setPlaying(false); go(0); S.overview = true; say({ kr: '처음부터', en: 'Back to the start' }); },
};

// ---- views -------------------------------------------------------------------------------------------------------------
function setView(v, quiet) {
  S.view = v;
  R.panelY.hidden = v !== 'yard'; R.panelV.hidden = v !== 'vessel';
  R.ctlY.hidden = v !== 'yard'; R.ctlV.hidden = v !== 'vessel';
  for (const b of $$('.tab')) { const on = b.dataset.view === v; b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; }
  if (v === 'vessel') setPlaying(false);
  if (S.sel && ((v === 'yard' && S.sel.kind !== 'fac') || (v === 'vessel' && S.sel.kind === 'fac'))) S.sel = null;
  R.note.replaceChildren(pair(v === 'yard' ? { kr: `${D.UI.schematic.kr} · ${D.UI.hintYard.kr}`, en: `${D.UI.schematic.en} · ${D.UI.hintYard.en}` } : { kr: `${D.UI.schematic.kr} · ${D.UI.slow.kr}`, en: `${D.UI.schematic.en} · ${D.UI.slow.en}` }, 'span', 'bi'));
  measure(); S.snap = true;
  buildTags(); renderCard(); renderChips(); syncDim();
  if (!quiet) say(v === 'yard' ? { kr: '야드 보기', en: 'Yard view' } : { kr: '선박 보기', en: 'Vessel view' });
}
function measure() {
  const r = R.vp.getBoundingClientRect();
  vp.w = r.width; vp.h = r.height;
}
function renderLayers() {
  R.layers.replaceChildren();
  for (const k of D.SYSTEM_ORDER) {
    const b = mk('button', 'lt'); b.type = 'button'; b.dataset.layer = k; b.setAttribute('aria-pressed', 'true');
    const dot = mk('i', 'dot'); dot.dataset.sys = k;
    b.append(dot, pair(D.SYSTEMS[k]));
    b.addEventListener('click', () => {
      S.layers[k] = !S.layers[k];
      syncLayerButtons();
      say({ kr: `${D.SYSTEMS[k].kr} ${S.layers[k] ? '켬' : '끔'}`, en: `${D.SYSTEMS[k].en} ${S.layers[k] ? 'shown' : 'hidden'}` });
      if (!S.layers[k] && selSys() === k) clearSel();      // never leave a card open for something that is not on screen
    });
    R.layers.append(b);
  }
}

// ---- drawing the yard ---------------------------------------------------------------------------------------------------
function drawYard(c) {
  const w = c.wp;
  R.wpMove.setAttribute('transform', move(YP, [w.x, w.y, w.z]));
  R.wpMove.setAttribute('opacity', w.show.toFixed(2));
  for (const f of Object.keys(R.wpf)) R.wpf[f].style.display = w.form === f ? '' : 'none';
  const reveal = tgt.stage === 0 ? clamp(c.torch.x * 1.03) : 1;
  R.wpNest.setAttribute('stroke-dashoffset', (1 - reveal).toFixed(3));
  R.wpPrimer.setAttribute('opacity', w.paint.toFixed(2));

  const showShip = tgt.stage >= 4;
  R.ship.style.display = showShip ? '' : 'none';
  R.carry.style.display = showShip ? '' : 'none';
  R.ship.setAttribute('transform', move(YP, [c.ship.dx, 0, c.ship.dz]));
  R.ship.setAttribute('opacity', c.ship.op.toFixed(2));
  for (let i = 0; i < 6; i++) {
    R.pb[i].style.display = i < c.placed ? '' : 'none';
    const carrying = c.active === i && c.crane.load && showShip;
    R.cb[i].style.display = carrying ? '' : 'none';
    if (carrying) R.cb[i].setAttribute('transform', move(YP, [c.crane.load[0] - slotX(i), c.crane.load[1] - slotY(), c.crane.load[2] - slotZ()]));
  }
  // dock water
  const wt = dockWater(K, YP, DK, LAYOUT.floor, LAYOUT.seaLevel, c.water);
  R.dockTop.setAttribute('d', wt.top); R.dockBand.setAttribute('d', wt.band); R.wline.setAttribute('d', wt.line);
  R.gate.setAttribute('transform', move(YP, [0, 0, -c.gate * 44]));
  R.gate.setAttribute('opacity', (1 - c.gate * 0.8).toFixed(2));

  // goliath crane, trolley, rope, hook, slings
  const cr = c.crane;
  const dx = move(YP, [cr.gx - REST_GX, 0, 0]);
  R.craneFar.setAttribute('transform', dx); R.craneNear.setAttribute('transform', dx);
  R.trolley.setAttribute('transform', move(YP, [REST_GX, cr.ty, GIRDER_Z]));
  const top = iso([cr.gx, cr.ty, GIRDER_Z + 2], YP), hk = iso([cr.gx, cr.ty, cr.hook], YP);
  D_.rope.setAttribute('d', `M${pt(top)}L${pt(hk)}`);
  D_.hook.setAttribute('transform', move(YP, [cr.gx, cr.ty, cr.hook]));
  let sl = '';
  if (cr.load && c.active >= 0 && showShip) {
    const len = BLOCKS[c.active].len * 0.36, hz = cr.load[2] + HULL.height;
    const h0 = iso([cr.gx, cr.ty, cr.hook - 4], YP);
    for (const [sx, sy] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) sl += `M${pt(h0)}L${pt(iso([cr.load[0] + sx * len, cr.load[1] + sy * 11, hz], YP))}`;
  }
  D_.sling.setAttribute('d', sl);

  // quay crane and deckhouse: the jib swings from the pallet (angle 0) to the ship's deck; once down, the house rides with the ship
  const hs = c.house, onQuay = tgt.stage === 6;
  R.house.style.display = onQuay ? '' : 'none';
  if (onQuay) {
    const a = JIB_A1 * hs, landed = hs >= 0.999;
    const tipx = PIV[0] + JIB_R * Math.cos(a), tipy = PIV[1] + JIB_R * Math.sin(a);
    const bz = lerp(PAL[2], HB[2], hs) + 26 * Math.sin(Math.PI * hs);
    const off = landed ? [0, 0, 0] : [tipx - HB[0], tipy - HB[1], bz - HB[2]];
    R.house.setAttribute('transform', move(YP, [off[0] + c.ship.dx - LAYOUT.mooring.dx, off[1], off[2] + c.ship.dz - 15]));
    R.house.setAttribute('opacity', c.ship.op.toFixed(2));
    const piv = iso([PIV[0], PIV[1], PIV[2] + 4], YP), tip = iso([tipx, tipy, JIB_Z], YP);
    D_.boom.setAttribute('d', `M${pt(piv)}L${pt(tip)}`);
    D_.jrope.setAttribute('d', landed ? '' : `M${pt(tip)}L${pt(iso([tipx, tipy, bz + 34], YP))}`);
  } else { D_.boom.setAttribute('d', ''); D_.jrope.setAttribute('d', ''); }

  // cutting portal and torch, welding, blasting and spraying
  const tx = CUT.cx - 30 + 16 * c.torch.on + 28 * c.torch.x, ty = CUT.cy + Math.sin(c.torch.x * 38) * 7;
  portal.fixed.setAttribute('transform', move(YP, [tx, CUT.cy, 3]));
  portal.head.setAttribute('transform', move(YP, [tx, ty, -1]));
  const live = !S.reduced;
  FX.torch.setAttribute('d', live && c.torch.on > 0.5 ? sparksAt(YP, [tx, ty, 6.8], 9, S.clock, 7, 1) : '');
  FX.weld.setAttribute('d', live && c.weld > 0.5
    ? sparksAt(YP, [WELD.x + 26, WELD.y + 51.5, 10.4], 7, S.clock, 6, 3) + sparksAt(YP, [WELD.x + 26, WELD.y + 63.5, 10.4], 7, S.clock, 6, 5) + sparksAt(YP, [WELD.x + 56, WELD.y + 58, 10.2], 9, S.clock, 7, 7) : '');
  const px0 = c.wp.x, py0 = c.wp.y;
  FX.blast.setAttribute('d', live && c.blast > 0.5 ? dotsAround(YP, [px0, py0, 5], [20, 14, 22], 26, S.clock, 11) : '');
  FX.spray.setAttribute('d', live && c.spray > 0.5 ? dotsAround(YP, [px0, py0, 14], [20, 14, 12], 22, S.clock, 13) : '');
}

// ---- drawing the vessel -------------------------------------------------------------------------------------------------
const LAYER_EL = Object.fromEntries(Object.keys(GEO.vessel.nums.lift).map((k) => [k, $(`#lyr-${k}`)]));
const PROP = { back: svgEl('path', { class: 'blade back' }), front: svgEl('path', { class: 'blade' }) };
$('#v-prop').append(PROP.back, PROP.front);
const RAD = { beam: svgEl('path', { class: 'beam' }), bar: svgEl('path', { class: 'scanner' }) };
$('#v-radar').append(RAD.beam, RAD.bar);
function drawVessel() {
  for (const [k, el] of Object.entries(LAYER_EL)) {
    const sys = LAYER_SYS[k];
    el.style.display = S.layers[sys] ? '' : 'none';
    el.setAttribute('transform', move(VP, [0, 0, GEO.vessel.nums.lift[k] * X.explode]));
  }
  R.svgV.style.setProperty('--ballast', X.ballast.toFixed(3));
  const th = S.reduced ? 0.4 : S.prop;
  if (S.layers.engine) {
    const pr = propeller(K, VP, [VN.propX, 0, VN.shaftZ], VN.propR, SHIP.blades, th);
    PROP.front.setAttribute('d', pr.front.join('')); PROP.back.setAttribute('d', pr.back.join(''));
  }
  if (S.layers.nav) {
    const ra = S.reduced ? 0.7 : (S.clock * 2 * Math.PI) / radarPeriod();
    const r = radar(K, VP, VN.radar, ra);
    RAD.bar.setAttribute('d', r.bar); RAD.beam.setAttribute('d', S.reduced ? '' : r.beam);
  }
}

// ---- the loop ----------------------------------------------------------------------------------------------------------
function easeTo(c, t, dt, tau, snap) {
  for (const k of Object.keys(t)) {
    const a = c[k], b = t[k];
    if (k === 'readout') c[k] = b;
    else if (typeof b === 'number' && typeof a === 'number') c[k] = snap ? b : follow(a, b, dt, tau);
    else if (b && typeof b === 'object' && !Array.isArray(b) && a && typeof a === 'object') easeTo(a, b, dt, tau, snap);
    else c[k] = b;
  }
}
function paintUi() {
  $$('.step', R.stepper).forEach((b, i) => b.style.setProperty('--p', (i < S.stage ? 1 : i === S.stage ? S.u : 0).toFixed(3)));
}
function step(dt, draw = true) {
  S.clock += dt;
  tourTick(dt);
  tgt = yardAt(S.stage, S.u);
  const snap = S.snap || S.reduced;
  easeTo(cur, tgt, dt, 0.2, snap);
  for (const [k, v] of [['explode', S.explode], ['ballast', S.ballast], ['power', S.power]]) X[k] = snap ? v : follow(X[k], v, dt, 0.25);
  // the propeller angle is INTEGRATED from the (eased) angular speed, so a power change slows it down smoothly instead of jumping to clock*omega
  S.prop = (S.prop + (S.reduced ? 0 : propOmega(X.power) * dt)) % (2 * Math.PI);
  // numbers, captions and progress are state, not drawing: they update even while the figure is scrolled out of view (a phone);
  // only the SVG redraw, the camera and the tag placement are skipped then
  if (S.view === 'yard') { if (draw) drawYard(cur); renderCaption(); paintUi(); } else { if (draw) drawVessel(); renderVesselReadout(); }
  if (draw) { updateCamera(dt); placeTags(); S.snap = false; }
}
let last = performance.now(), warned = false;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.max(0, (now - last) / 1000);
  last = now;
  if (document.hidden) return;
  try { step(dt, S.visible); S.frames++; } catch (err) {
    S.errors++;
    if (S.errors <= 3) console.error('shipyard frame error', err);
    if (S.errors > 30 && !warned) { warned = true; R.fallback.hidden = false; }
  }
}

// ---- input -------------------------------------------------------------------------------------------------------------
for (const b of $$('.tab')) b.addEventListener('click', () => setView(b.dataset.view));
$('.tabs').addEventListener('keydown', (e) => {
  const tabs = $$('.tab'); const i = tabs.indexOf(document.activeElement);
  if (i < 0) return;
  let n = -1;
  if (e.key === 'ArrowRight') n = (i + 1) % tabs.length; else if (e.key === 'ArrowLeft') n = (i + tabs.length - 1) % tabs.length;
  else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = tabs.length - 1;
  if (n < 0) return;
  e.preventDefault(); tabs[n].focus(); setView(tabs[n].dataset.view);
});
R.bNext.addEventListener('click', () => tour.next());
R.bPrev.addEventListener('click', () => tour.prev());
R.bPlay.addEventListener('click', () => tour.play());
R.bSkip.addEventListener('click', () => tour.skip());
R.bReset.addEventListener('click', () => tour.reset());
function slider(input, out, key, text) {
  input.addEventListener('input', () => {
    S[key] = Number(input.value) / 100;
    out.textContent = `${input.value}%`;
    say(text(S[key]));
    if (key !== 'explode') renderVesselReadout();     // the numbers answer at once, even when no frame is drawn (figure scrolled away)
  });
}
slider(R.rEx, R.oEx, 'explode', (v) => ({ kr: `분해 ${Math.round(v * 100)}%`, en: `Explode ${Math.round(v * 100)}%` }));
slider(R.rPw, R.oPw, 'power', (v) => ({ kr: `엔진 출력 ${Math.round(v * 100)}% · 선속 ${f1(speedAt(v))} kn`, en: `Engine power ${Math.round(v * 100)}% · speed ${f1(speedAt(v))} kn` }));
slider(R.rBa, R.oBa, 'ballast', (v) => ({ kr: `밸러스트 ${f0(ballastTonnes(v))} t · 흘수 ${f1(ballastDraft(v))} m`, en: `Ballast ${f0(ballastTonnes(v))} t · draft ${f1(ballastDraft(v))} m` }));
R.panelY.addEventListener('click', (e) => { const g = e.target.closest('[data-fac]'); if (g) select('fac', g.dataset.fac, 'svg'); });
R.panelV.addEventListener('click', (e) => {
  const it = e.target.closest('[data-item]');
  if (it && D.ITEMS[it.dataset.item]) { select('item', it.dataset.item, 'svg'); return; }
  const l = e.target.closest('[data-sys]');
  if (l) select('sys', l.dataset.sys, 'svg'); else clearSel('svg');
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (S.sel) clearSel('key'); else if (S.playing) { setPlaying(false); say({ kr: '일시정지', en: 'Paused' }); }
    return;
  }
  if (e.target instanceof HTMLInputElement || e.target.closest('.tabs') || e.altKey || e.ctrlKey || e.metaKey) return;
  if (S.view !== 'yard') return;
  if (e.key === 'ArrowRight') { e.preventDefault(); tour.next(); } else if (e.key === 'ArrowLeft') { e.preventDefault(); tour.prev(); }
});
const onMotion = () => {
  S.reduced = mq.matches;
  document.documentElement.dataset.motion = S.reduced ? 'reduced' : 'full';
  if (S.reduced) { S.u = 1; S.snap = true; say({ kr: D.UI.reduced.kr, en: D.UI.reduced.en }); } else say({ kr: '움직임을 다시 켰습니다', en: 'Motion is on again' });
};
mq.addEventListener('change', onMotion);
new ResizeObserver(() => { measure(); S.snap = true; }).observe(R.vp);
new IntersectionObserver((es) => { S.visible = es.some((e) => e.isIntersecting); }).observe(R.vp);

// ---- start -------------------------------------------------------------------------------------------------------------
document.documentElement.dataset.motion = S.reduced ? 'reduced' : 'full';
renderLayers(); renderStepper(); setPlaying(false); setView('yard', true);
say({ kr: `${D.UI.hintYard.kr}`, en: `${D.UI.hintYard.en}` });
if (S.reduced) S.u = 1;
requestAnimationFrame(frame);

// ---- the hook for tests and curious people ---------------------------------------------------------------------------------
window.__shipyard = {
  S, cur, X,
  get target() { return tgt; },
  seek(stage, u = 0) { setPlaying(false); S.stage = clamp(Math.round(stage), 0, 6); S.u = clamp(u); S.sel = null; S.overview = false; S.snap = true; renderStepper(); renderCard(); syncDim(); syncChips(); buildTags(); },
  setView, select, clearSel, tour,
  advance(seconds) { step(seconds); },
  screenPos(id) {
    const e = R.tags.querySelector(`[data-tag="${id}"]`) || $(`[data-chip="${id}"]`) || $(`[data-fac="${id}"]`) || $(`[data-item="${id}"]`) || $(`[data-sys="${id}"]`);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
  },
  snapshot() {
    return {
      view: S.view, stage: S.stage, u: S.u, playing: S.playing, sel: S.sel, layers: { ...S.layers }, explode: S.explode, power: S.power, ballast: S.ballast,
      reduced: S.reduced, status: S.status, frames: S.frames, errors: S.errors,
      water: tgt.water, placed: tgt.placed, active: tgt.active, crane: tgt.crane.phase, ship: { ...tgt.ship }, readout: { ...tgt.readout },
      drawn: { water: cur.water, placed: cur.placed, shipDx: cur.ship.dx, wp: { ...cur.wp } },
      viewBox: (S.view === 'yard' ? R.svgY : R.svgV).getAttribute('viewBox'), overview: S.overview,
      prop: S.prop, visible: S.visible,
    };
  },
  model: { yardAt, craneCycle, floodHours, floatLevel, lightDraft, rpmAt, speedAt, tipSpeed, ballastDraft, ballastTonnes, SHIP, DOCK, HULL, BLOCKS },
};
