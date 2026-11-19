// DOM builders for the side card, the parts list, the business strip and the three dialogs.
// Every string goes in through textContent; nothing here ever builds HTML from data.
import { UI, TAG, STAGES, BUSINESS, BUSINESS_FULL, SITES, COMPETITORS, COMPETE_NOTE, SRC, SOURCES_NOTE, CLEAN_TABLE } from './data.js';
import { PARTS } from './parts.js';
import { FUNNEL, YIELD } from './model.js';

const $ = (id) => document.getElementById(id);
export function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}
// a Korean + English pair as two spans (Korean first); the page's CSS decides how they are laid out
export function pair(tag, cls, p) {
  const n = el(tag, cls);
  const ko = el('span', 'ko', p.ko);
  ko.lang = 'ko';
  const en = el('span', 'en', p.en);
  en.lang = 'en';
  n.append(ko, en);
  return n;
}
export function chip(key) {
  const t = TAG[key] || TAG.U;
  const n = pair('span', `tg tg-${key in TAG ? key : 'U'}`, t);
  n.setAttribute('title', `${t.ko} · ${t.en}`);
  return n;
}
const setPair = (id, p) => {
  const n = $(id);
  n.querySelector('.ko').textContent = p.ko;
  n.querySelector('.en').textContent = p.en;
};
const fmtPct = (v) => `${(v * 100).toFixed(1)} %`;

// ---------- business strip (the six verified numbers; year and source are in the Sources panel) ----------
export function fillBiz() {
  const ul = $('biz');
  ul.textContent = '';
  BUSINESS.forEach((b) => {
    const li = el('li', 'bz');
    li.dataset.id = b.id;
    const s = el('span', 'bs', b.src);
    s.setAttribute('title', `${UI.sources.ko} · ${UI.sources.en}: ${b.src}`);
    const foot = el('div', 'bf');
    foot.append(chip(b.tag), s);
    li.append(el('b', 'bv', b.v), pair('span', 'bl', b), foot);
    ul.appendChild(li);
  });
}

// ---------- stage card ----------
function legendTable() {
  const wrap = el('div', 'legend');
  wrap.append(pair('h3', 'xh', UI.legend));
  const tbl = el('table', 'tbl');
  const head = el('tr');
  ['ISO 14644-1', 'FED-STD-209E', '≥ 0.5 µm / m³'].forEach((t) => head.appendChild(el('th', '', t)));
  tbl.appendChild(head);
  CLEAN_TABLE.forEach((r) => {
    const tr = el('tr', r.hot ? 'hot' : '');
    tr.append(el('td', '', r.iso), el('td', '', r.fed), el('td', 'n', r.n));
    tbl.appendChild(tr);
    if (r.note && r.note.ko) {
      const nt = el('tr', 'note');
      const td = el('td');
      td.colSpan = 3;
      td.appendChild(pair('span', 'nt', r.note));
      nt.appendChild(td);
      tbl.appendChild(nt);
    }
  });
  wrap.appendChild(tbl);
  return wrap;
}
function funnelBars() {
  const wrap = el('div', 'funnel');
  wrap.append(pair('h3', 'xh', UI.funnelH));
  let cum = 1;
  const ul = el('ul', 'fn');
  FUNNEL.forEach((s) => {
    cum *= s.y;
    const li = el('li');
    li.append(pair('span', 'fl', s), el('i', 'fb'), el('b', 'fv', `${(s.y * 100).toFixed(1)}`));
    li.querySelector('.fb').style.setProperty('--w', `${((cum - 0.9) / 0.1) * 100}%`);
    li.querySelector('.fb').setAttribute('title', fmtPct(cum));
    ul.appendChild(li);
  });
  wrap.appendChild(ul);
  const tot = el('p', 'fn-t');
  tot.append(el('b', '', `≈ ${(YIELD * 100).toFixed(0)} %`), pair('span', 'fn-l', { ko: ' 누적(1,000개 중 약 930개) [추정]', en: ' cumulative (about 930 of 1,000) [estimate]' }));
  wrap.appendChild(tot);
  return wrap;
}

export function fillCard(i) {
  const st = STAGES[i];
  setPair('card-name', st.name);
  setPair('card-what', st.what);
  setPair('card-in', st.inn);
  setPair('card-out', st.out);
  setPair('card-keytext', { ko: st.key.ko, en: st.key.en });
  $('card-keyvalue').textContent = st.key.value;
  const kt = $('card-keytag');
  kt.textContent = '';
  kt.appendChild(chip(st.key.tag));
  const ul = $('card-equip');
  ul.textContent = '';
  st.equipment.forEach((q) => {
    const li = el('li');
    li.append(pair('span', 'eq', q), chip(q.tag));
    ul.appendChild(li);
  });
  const nl = $('card-notes');
  nl.textContent = '';
  st.notes.forEach((q) => {
    const li = el('li');
    li.append(chip(q.tag), pair('span', 'nt', q));
    nl.appendChild(li);
  });
  $('card-num').textContent = `${i + 1} / ${STAGES.length}`;
  const ex = $('card-extra');
  ex.textContent = '';
  if (st.table === 'clean') ex.appendChild(legendTable());
  if (st.funnel) ex.appendChild(funnelBars());
  ex.hidden = ex.childElementCount === 0;
}

// ---------- parts list: the parts this stage adds; stage 1 (intake) shows the whole bill of materials ----------
export function fillParts(i, onPick) {
  const list = $('parts-list');
  list.textContent = '';
  const mine = i === 0 ? PARTS : PARTS.filter((p) => p.st === i);
  $('parts-n').textContent = String(mine.length);
  const note = el('li', 'pnote');
  note.appendChild(pair('span', '', i === 0 ? UI.partsAll : mine.length ? UI.clickPart : UI.partsNone));
  list.appendChild(note);
  mine.forEach((p) => {
    const li = el('li');
    const b = el('button', 'pbtn');
    b.type = 'button';
    b.dataset.p = p.id;
    b.setAttribute('aria-pressed', 'false');
    b.append(el('i', `sw mt-${p.mat}`), pair('span', 'pn', p), chip(p.tag));
    b.addEventListener('click', () => onPick(p.id));
    li.appendChild(b);
    list.appendChild(li);
  });
}
export function markPart(id) {
  document.querySelectorAll('#parts-list .pbtn').forEach((b) => b.setAttribute('aria-pressed', b.dataset.p === id ? 'true' : 'false'));
  const ps = $('partsel');
  const p = id ? PARTS.find((q) => q.id === id) : null;
  if (!p) { ps.hidden = true; return; }
  ps.hidden = false;
  ps.textContent = '';
  const ko = el('span', 'ko', `${p.ko}${p.note ? ` — ${p.note}` : ''}`);
  ko.lang = 'ko';
  const en = el('span', 'en', p.en);
  en.lang = 'en';
  ps.append(chip(p.tag), ko, en);
}

// ---------- dialogs ----------
function section(h, ...kids) {
  const s = el('section', 'dsec');
  s.append(pair('h3', 'dh', h), ...kids);
  return s;
}
function fillCompare() {
  const body = $('compare-body');
  body.textContent = '';
  body.appendChild(pair('p', 'lead', UI.compareLead));
  const grid = el('div', 'cgrid');
  COMPETITORS.forEach((c) => {
    const card = el('article', 'ccard');
    card.append(pair('h3', 'cn', c.name), pair('p', 'cr', c.role));
    const ul = el('ul', 'cl');
    c.claims.forEach((q) => {
      const li = el('li');
      li.append(chip(q.tag), pair('span', 'cc', q));
      ul.appendChild(li);
    });
    card.appendChild(ul);
    grid.appendChild(card);
  });
  body.appendChild(grid);
  body.appendChild(pair('p', 'note', COMPETE_NOTE));
  const sites = el('ul', 'sites');
  SITES.forEach((s) => {
    const li = el('li');
    li.append(pair('b', 'sn', s), pair('span', 'sd', s.note), chip(s.tag));
    sites.appendChild(li);
  });
  body.appendChild(section(UI.sitesH, sites));
}
function fillBusiness() {
  const body = $('business-body');
  body.textContent = '';
  const ul = el('ul', 'bfull');
  [...BUSINESS, ...BUSINESS_FULL].forEach((b) => {
    const li = el('li');
    li.append(el('b', 'bv', b.v), pair('span', 'bl', b), chip(b.tag));
    if (b.src) li.append(el('span', 'bs', b.src));
    ul.appendChild(li);
  });
  body.append(pair('p', 'lead', UI.bizYear), ul);
}
function fillSources() {
  const body = $('sources-body');
  body.textContent = '';
  const keys = el('ul', 'tagkey');
  Object.keys(TAG).forEach((k) => {
    const li = el('li');
    li.append(chip(k));
    keys.appendChild(li);
  });
  body.appendChild(section(UI.tagKeyH, keys));
  body.appendChild(pair('p', 'note', SOURCES_NOTE));
  const ul = el('ul', 'srcl');
  SRC.forEach((s) => {
    const li = el('li');
    li.append(el('code', 'sid', s.id), chip(s.tag), pair('span', 'sl', { ko: s.label, en: s.en }));
    ul.appendChild(li);
  });
  body.appendChild(section(UI.srcH, ul));
  body.appendChild(pair('p', 'note', UI.disclaimer));
}

export function wireDialogs(onChange) {
  fillCompare();
  fillBusiness();
  fillSources();
  const pairs = [['open-compare', 'dlg-compare'], ['open-business', 'dlg-business'], ['open-sources', 'dlg-sources']];
  const dlgs = pairs.map(([b, d]) => {
    const dlg = $(d);
    const opener = $(b);
    opener.addEventListener('click', () => {
      if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
      onChange();
    });
    dlg.addEventListener('close', onChange);
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }); // a click on the backdrop
    dlg.querySelectorAll('[data-close]').forEach((x) => x.addEventListener('click', () => dlg.close()));
    return dlg;
  });
  return { dlgs, open: () => dlgs.find((d) => d.open) || null };
}
