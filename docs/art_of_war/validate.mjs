/* 손자병법 칠판 강의 — 장면 검증 (content/SCHEMA.md 의 계약을 코드로 옮긴 것).
 *
 * validateLesson(scene, opts)
 *   scene : content/*.json 을 합친 강의 객체 { schema, ..., steps:[...] }
 *   opts  : { strictStructure = true }  — 거짓이면 "23단계 · 편 1~13 순서" 검사를 건너뜁니다(시험용 작은 장면).
 * 반환   : { errors:string[], warnings:string[], chalk:[{text,where}], dom:[{text,where}], ids:string[] }
 *   chalk : Canvas 칠판에 그려질 글 → 내장 글꼴(나눔손글씨 펜 + 한자 부분 글꼴)에 모든 글자가 있어야 합니다.
 *   dom   : 화면 글(DOM)로 보이는 글 → 한자는 내장 한자 글꼴에 있어야 합니다.
 *
 * 이 파일은 DOM·파일 입출력이 없는 순수 함수 모음입니다.
 */

export const SCHEMA = 'art-of-war-lesson/1';
export const PARTS = ['background', 'chapter', 'closing'];
export const PART_COUNTS = { background: 6, chapter: 13, closing: 4 };
export const COLORS = ['white', 'mint', 'yellow', 'pink', 'sky', 'orange'];
export const SIZES = ['s', 'm', 'l', 'xl'];
export const PANEL_SIZES = ['xl', 'l', 'm', 's'];
export const ALIGNS = ['left', 'center', 'right'];
export const TAG_TONES = ['fact', 'debated', 'classic', 'interp'];
export const CALLOUT_TONES = ['info', 'warn'];
export const LEGEND_STYLES = ['box', 'line', 'dash', 'dot'];
export const SHAPES = ['box', 'round', 'ellipse', 'circle', 'hex'];
export const BOARD_KINDS = ['diagram', 'timeline', 'ladder', 'radial', 'table', 'compare'];
export const NARRATION_MIN = 330;
export const NARRATION_MAX = 430;
export const NARRATION_HARD_MAX = 450;
export const AT_LAST_MAX = 0.85;
export const VW = 160;
export const VH = 100;
export const EDGE = 5;

/** 특정 기업·고객 이름 금지(SCHEMA 사실 규율 6). 영문은 단어 경계, 한글은 포함 여부로 봅니다. */
const FORBIDDEN_NAMES = [
  /\bLG\b/i, /\bSK\b/, /\bKT\b/, /samsung/i, /hyundai/i, /naver/i, /kakao/i, /coupang/i, /google/i, /\bapple\b/i, /amazon/i,
  /microsoft/i, /tesla/i, /toyota/i, /facebook/i, /netflix/i, /\bnvidia\b/i, /openai/i,
  /삼성/, /엘지/, /네이버/, /카카오/, /쿠팡/, /구글/, /애플/, /아마존/, /마이크로소프트/, /테슬라/, /토요타/, /도요타/, /페이스북/, /넷플릭스/, /엔비디아/,
];

const HAN_RE = /\p{Script=Han}/u;
const HAN_ALL_RE = /^\p{Script=Han}+(?:\s\p{Script=Han}+)*$/u; // 공백으로 나눈 한자 묶음 허용(예: 孫武 孫臏)
const HANGUL_RE = /[가-힣]/;
/** 해설에 허용되는 글자: 한글 음절, 공백, 쉼표·마침표·물음표·느낌표 */
const NARRATION_BAD_RE = /[^가-힣\s,.?!]/gu;

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isInt = (v) => Number.isInteger(v);
export const len = (s) => Array.from(String(s)).length;
const inArr = (arr, v) => arr.includes(v);
const fmt = (v) => (typeof v === 'string' ? '"' + v + '"' : JSON.stringify(v));

export function validateLesson(scene, opts = {}) {
  const strictStructure = opts.strictStructure !== false;
  const errors = [];
  const warnings = [];
  const chalk = [];
  const dom = [];
  const ids = [];
  const err = (where, msg) => errors.push(where + ': ' + msg);
  const warn = (where, msg) => warnings.push(where + ': ' + msg);
  const out = { errors, warnings, chalk, dom, ids };

  if (!scene || typeof scene !== 'object' || Array.isArray(scene)) {
    err('scene', '객체가 아닙니다');
    return out;
  }

  /* ---------- 작은 도우미: 값을 검사하면서 글 목록에 모읍니다 ---------- */
  const text = (where, v, { max, min = 1, canvas = false, optional = false } = {}) => {
    if (v === undefined && optional) return false;
    if (!isStr(v)) { err(where, '비어 있지 않은 문자열이 필요합니다 (현재 ' + fmt(v) + ')'); return false; }
    const n = len(v);
    if (n < min) err(where, '너무 짧습니다 (' + n + '자, 최소 ' + min + '자)');
    if (max && n > max) err(where, n + '자 — ' + max + '자 이내여야 합니다: ' + fmt(v));
    if (/\n|\r|\t/.test(v)) err(where, '줄바꿈·탭 문자를 쓸 수 없습니다');
    (canvas ? chalk : dom).push({ text: v, where });
    return true;
  };
  const enumOf = (where, v, list) => {
    if (!inArr(list, v)) { err(where, list.join(' | ') + ' 중 하나여야 합니다 (현재 ' + fmt(v) + ')'); return false; }
    return true;
  };
  const color = (where, v) => enumOf(where, v, COLORS);
  const hanText = (where, v, { max, optional = false } = {}) => {
    if (v === undefined && optional) return;
    if (!text(where, v, { max, canvas: true })) return;
    if (!HAN_ALL_RE.test(v)) err(where, '한자(漢字)만 쓸 수 있습니다: ' + fmt(v));
  };
  /** 같은 배열 안에서 at 이 0~1, 오름차순, 마지막이 limit 이하인지 */
  const atSeries = (where, list, limit) => {
    let prev = -1;
    let last = null;
    list.forEach((it, i) => {
      const a = it && it.at;
      if (!isNum(a) || a < 0 || a > 1) { err(where + '[' + i + '].at', '0~1 사이 숫자(해설 길이의 비율)여야 합니다 (현재 ' + fmt(a) + ')'); return; }
      if (a < prev - 1e-9) err(where + '[' + i + '].at', '오름차순이어야 합니다 (' + a + ' < 앞 요소 ' + prev + ')');
      prev = Math.max(prev, a);
      last = a;
    });
    if (last !== null && last > limit + 1e-9) err(where, '마지막 요소의 at 은 ' + limit + ' 이하여야 합니다 (현재 ' + last + ')');
  };
  const forbidden = (where, v) => {
    if (typeof v !== 'string') return;
    for (const re of FORBIDDEN_NAMES) if (re.test(v)) err(where, '기업·고객 이름은 쓸 수 없습니다 (' + re.source + ')');
  };

  /* ---------- 최상위(00-meta) ---------- */
  if (scene.schema !== SCHEMA) err('schema', '"' + SCHEMA + '" 이어야 합니다 (현재 ' + fmt(scene.schema) + ')');
  if (scene.lang !== 'ko') err('lang', '"ko" 이어야 합니다');
  text('eyebrow', scene.eyebrow, { max: 40 });
  text('title', scene.title, { max: 40 });
  text('subtitle', scene.subtitle, { max: 90 });
  text('author', scene.author, { max: 60 });
  for (const k of ['eyebrow', 'title', 'subtitle']) forbidden(k, scene[k]);
  if (!scene.ui || typeof scene.ui !== 'object') err('ui', '객체가 필요합니다');
  else text('ui.hint', scene.ui.hint, { max: 20, canvas: true });

  if (!scene.source || typeof scene.source !== 'object') err('source', '객체가 필요합니다 { title, channel, url, note }');
  else {
    for (const k of ['title', 'channel', 'note']) text('source.' + k, scene.source[k], { max: 400 });
    if (!isStr(scene.source.url)) err('source.url', '문자열이 필요합니다');
    // 영상 내용은 확인하지 못했다는 사실을 note 에서 분명히 밝혀야 합니다.
    if (isStr(scene.source.note) && !/확인|검증/.test(scene.source.note)) warn('source.note', '영상 내용을 확인하지 못했다는 안내가 보이지 않습니다');
  }

  if (!Array.isArray(scene.references) || scene.references.length < 5 || scene.references.length > 10) err('references', '문자열 5~10개의 배열이어야 합니다');
  else scene.references.forEach((r, i) => { text('references[' + i + ']', r, { max: 220 }); });

  if (!Array.isArray(scene.misconceptions) || scene.misconceptions.length < 3 || scene.misconceptions.length > 5) err('misconceptions', '{title,text} 3~5개의 배열이어야 합니다');
  else {
    scene.misconceptions.forEach((m, i) => {
      const w = 'misconceptions[' + i + ']';
      if (!m || typeof m !== 'object') { err(w, '객체가 필요합니다'); return; }
      text(w + '.title', m.title, { max: 40 });
      text(w + '.text', m.text, { max: 200 });
      forbidden(w, m.title);
      forbidden(w, m.text);
    });
  }

  if (!Array.isArray(scene.quiz) || scene.quiz.length !== 6) err('quiz', '6문항의 배열이어야 합니다 (현재 ' + (Array.isArray(scene.quiz) ? scene.quiz.length : typeof scene.quiz) + ')');
  else {
    scene.quiz.forEach((q, i) => {
      const w = 'quiz[' + i + ']';
      if (!q || typeof q !== 'object') { err(w, '객체가 필요합니다'); return; }
      text(w + '.question', q.question, { max: 90 });
      forbidden(w, q.question);
      // chapterNo 0 = 배경 편(제n편이 아닌 문제)
      if (!isInt(q.chapterNo) || q.chapterNo < 0 || q.chapterNo > 13) err(w + '.chapterNo', '0(배경)~13 정수여야 합니다 (현재 ' + fmt(q.chapterNo) + ')');
      if (!Array.isArray(q.options) || q.options.length !== 3) { err(w + '.options', '보기 3개가 필요합니다'); return; }
      let right = 0;
      q.options.forEach((o, j) => {
        const ow = w + '.options[' + j + ']';
        if (!o || typeof o !== 'object') { err(ow, '객체가 필요합니다'); return; }
        text(ow + '.text', o.text, { max: 70 });
        text(ow + '.feedback', o.feedback, { max: 160 });
        forbidden(ow, o.text);
        forbidden(ow, o.feedback);
        if (typeof o.correct !== 'boolean') err(ow + '.correct', 'true/false 여야 합니다');
        else if (o.correct) right++;
      });
      if (right !== 1) err(w + '.options', '정답은 정확히 1개여야 합니다 (현재 ' + right + '개)');
    });
  }

  /* ---------- 단계 ---------- */
  const steps = Array.isArray(scene.steps) ? scene.steps : null;
  if (!steps || steps.length === 0) { err('steps', '단계 배열이 비어 있습니다'); return out; }
  const seen = new Set();
  steps.forEach((s, si) => {
    const w0 = 'steps[' + si + ']';
    if (!s || typeof s !== 'object') { err(w0, '객체가 필요합니다'); return; }
    const w = (isStr(s.id) ? s.id : w0);
    if (!isStr(s.id) || !/^[a-z][a-z0-9-]*$/.test(s.id)) err(w0 + '.id', '소문자·숫자·하이픈(영문 소문자로 시작)이어야 합니다 (현재 ' + fmt(s.id) + ')');
    else if (seen.has(s.id)) err(w0 + '.id', '중복된 id 입니다: ' + s.id);
    else { seen.add(s.id); ids.push(s.id); }

    text(w + '.nav', s.nav, { max: 12 });
    if (!enumOf(w + '.part', s.part, PARTS)) { /* 아래 검사는 part 에 의존하지 않는 것만 계속 */ }
    if (s.part === 'chapter') {
      if (!isInt(s.chapterNo) || s.chapterNo < 1 || s.chapterNo > 13) err(w + '.chapterNo', '편 단계는 1~13 정수여야 합니다 (현재 ' + fmt(s.chapterNo) + ')');
      else if (isStr(s.id) && !s.id.startsWith('ch' + String(s.chapterNo).padStart(2, '0') + '-')) err(w + '.id', '편 단계의 id 는 ch' + String(s.chapterNo).padStart(2, '0') + '- 로 시작해야 합니다');
    } else if (s.chapterNo !== undefined) err(w + '.chapterNo', 'part=chapter 가 아닌 단계에는 chapterNo 를 쓰지 않습니다');
    text(w + '.kicker', s.kicker, { max: 40 });
    text(w + '.title', s.title, { max: 28 });
    hanText(w + '.han', s.han, { max: 6, optional: true });
    if (!s.tag || typeof s.tag !== 'object') err(w + '.tag', '{tone,text} 가 필요합니다');
    else { enumOf(w + '.tag.tone', s.tag.tone, TAG_TONES); text(w + '.tag.text', s.tag.text, { max: 16 }); }
    text(w + '.summary', s.summary, { max: 90 });
    for (const k of ['kicker', 'title', 'summary', 'alt', 'narration']) forbidden(w + '.' + k, s[k]);

    /* 해설 */
    if (isStr(s.narration)) {
      const n = len(s.narration);
      if (n < NARRATION_MIN || n > NARRATION_MAX) err(w + '.narration', n + '자 — ' + NARRATION_MIN + '~' + NARRATION_MAX + '자여야 합니다');
      if (n > NARRATION_HARD_MAX) err(w + '.narration', '450자를 넘으면 음성 합성이 실패합니다');
      const bad = [...new Set(s.narration.match(NARRATION_BAD_RE) || [])];
      if (bad.length) err(w + '.narration', '한자·로마자·숫자·기호는 쓸 수 없고 모두 한글로 풀어야 합니다: ' + bad.map((c) => '"' + c + '"').join(' '));
      if (/\s{2,}/.test(s.narration) || s.narration !== s.narration.trim()) err(w + '.narration', '연속 공백이나 앞뒤 공백이 있습니다');
      if (!/[.?!]$/.test(s.narration.trim())) err(w + '.narration', '문장이 마침표·물음표·느낌표로 끝나야 합니다');
      dom.push({ text: s.narration, where: w + '.narration' });
    } else err(w + '.narration', '문자열이 필요합니다');

    /* 인용 */
    if (s.quote === undefined) {
      if (s.part === 'chapter') err(w + '.quote', '편 단계에는 quote 가 필수입니다');
    } else if (!s.quote || typeof s.quote !== 'object') err(w + '.quote', '{han,reading,meaning,where} 객체여야 합니다');
    else {
      const q = s.quote;
      text(w + '.quote.han', q.han, { max: 40 });
      if (isStr(q.han) && len(q.han.replace(/[^\p{Script=Han}]/gu, '')) < 2) err(w + '.quote.han', '한자 원문이어야 합니다');
      text(w + '.quote.reading', q.reading, { max: 60 });
      if (isStr(q.reading) && !HANGUL_RE.test(q.reading)) err(w + '.quote.reading', '한글 독음이어야 합니다');
      text(w + '.quote.meaning', q.meaning, { max: 90 });
      text(w + '.quote.where', q.where, { max: 40 });
    }

    /* 한 장 요약 */
    if (!Array.isArray(s.digest) || s.digest.length < 3 || s.digest.length > 4) err(w + '.digest', '{head,text} 3~4개가 필요합니다');
    else s.digest.forEach((d, i) => {
      if (!d || typeof d !== 'object') { err(w + '.digest[' + i + ']', '객체가 필요합니다'); return; }
      text(w + '.digest[' + i + '].head', d.head, { max: 20 });
      text(w + '.digest[' + i + '].text', d.text, { max: 70 });
      forbidden(w + '.digest[' + i + ']', (d.head || '') + (d.text || ''));
    });

    /* 콜아웃 · 범례 · 대체 글 */
    if (!s.callout || typeof s.callout !== 'object') err(w + '.callout', '{tone,title,text} 가 필요합니다');
    else {
      enumOf(w + '.callout.tone', s.callout.tone, CALLOUT_TONES);
      text(w + '.callout.title', s.callout.title, { max: 20 });
      text(w + '.callout.text', s.callout.text, { max: 120 });
      forbidden(w + '.callout', (s.callout.title || '') + (s.callout.text || ''));
    }
    if (!Array.isArray(s.legend) || s.legend.length < 1 || s.legend.length > 5) err(w + '.legend', '범례 1~5개가 필요합니다');
    else s.legend.forEach((l, i) => {
      if (!l || typeof l !== 'object') { err(w + '.legend[' + i + ']', '객체가 필요합니다'); return; }
      color(w + '.legend[' + i + '].color', l.color);
      enumOf(w + '.legend[' + i + '].style', l.style, LEGEND_STYLES);
      text(w + '.legend[' + i + '].text', l.text, { max: 24 });
    });
    text(w + '.alt', s.alt, { max: 200, min: 20 });

    /* 자막 */
    if (!Array.isArray(s.beats) || s.beats.length < 2 || s.beats.length > 5) err(w + '.beats', '{at,text} 2~5개가 필요합니다');
    else {
      s.beats.forEach((b, i) => { if (b && typeof b === 'object') text(w + '.beats[' + i + '].text', b.text, { max: 110 }); else err(w + '.beats[' + i + ']', '객체가 필요합니다'); });
      atSeries(w + '.beats', s.beats, 0.95);
    }

    /* 판서 요약 */
    if (!Array.isArray(s.panel) || s.panel.length < 2 || s.panel.length > 5) err(w + '.panel', '{text,color,size,at} 2~5줄이 필요합니다');
    else {
      s.panel.forEach((p, i) => {
        const pw = w + '.panel[' + i + ']';
        if (!p || typeof p !== 'object') { err(pw, '객체가 필요합니다'); return; }
        text(pw + '.text', p.text, { max: 28, canvas: true });
        color(pw + '.color', p.color);
        enumOf(pw + '.size', p.size, PANEL_SIZES);
        forbidden(pw, p.text);
      });
      atSeries(w + '.panel', s.panel, AT_LAST_MAX);
    }

    /* 보드 */
    if (!s.board || typeof s.board !== 'object') err(w + '.board', '객체가 필요합니다');
    else validateBoard(w + '.board', s.board);
  });

  /* ---------- 보드 ---------- */
  function validateBoard(bw, b) {
    if (!enumOf(bw + '.kind', b.kind, BOARD_KINDS)) return;
    if (!Array.isArray(b.elements) || b.elements.length === 0) { err(bw + '.elements', '요소 배열이 필요합니다'); return; }
    const els = b.elements;
    const bad = (i, msg) => err(bw + '.elements[' + i + ']', msg);
    const lineList = (where, lines, { max = 3, each = 16, optional = false } = {}) => {
      if (lines === undefined && optional) return;
      if (!Array.isArray(lines) || lines.length < 1 || lines.length > max) { err(where, '문자열 1~' + max + '줄의 배열이어야 합니다'); return; }
      lines.forEach((l, i) => text(where + '[' + i + ']', l, { max: each, canvas: true }));
    };
    const stackFields = (where, e, { lines }) => {
      hanText(where + '.han', e.han, { max: 4, optional: true });
      text(where + '.title', e.title, { max: 12, canvas: true });
      if (lines) lineList(where + '.lines', e.lines, { optional: true });
      else text(where + '.line', e.line, { max: 16, canvas: true });
      color(where + '.color', e.color);
    };
    const checkElementTypes = (allowed) => els.forEach((e, i) => {
      if (!e || typeof e !== 'object') { bad(i, '객체가 필요합니다'); return; }
      if (!inArr(allowed, e.type)) bad(i, 'type 은 ' + allowed.join(' | ') + ' 이어야 합니다 (현재 ' + fmt(e.type) + ')');
    });
    const count = (type, min, max) => {
      const n = els.filter((e) => e && e.type === type).length;
      if (n < min || n > max) err(bw + '.elements', type + ' 은(는) ' + min + '~' + max + '개여야 합니다 (현재 ' + n + '개)');
    };

    switch (b.kind) {
      case 'diagram': {
        checkElementTypes(['region', 'node', 'link', 'text']);
        const nodes = new Map();
        els.forEach((e, i) => {
          if (e && e.type === 'node') {
            const ew = bw + '.elements[' + i + ']';
            if (!isStr(e.id) || !/^[a-z][a-z0-9-]*$/.test(e.id)) err(ew + '.id', '노드 id 는 소문자·숫자·하이픈이어야 합니다 (현재 ' + fmt(e.id) + ')');
            else if (nodes.has(e.id)) err(ew + '.id', '노드 id 중복: ' + e.id);
            else nodes.set(e.id, e);
          }
        });
        els.forEach((e, i) => {
          if (!e || typeof e !== 'object') return;
          const ew = bw + '.elements[' + i + ']';
          if (e.type === 'region') {
            for (const k of ['x', 'y', 'w', 'h']) if (!isNum(e[k])) err(ew + '.' + k, '숫자여야 합니다');
            if ([e.x, e.y, e.w, e.h].every(isNum)) {
              if (e.w <= 0 || e.h <= 0) err(ew, 'w, h 는 양수여야 합니다');
              if (e.x < 0 || e.y < 0 || e.x + e.w > VW || e.y + e.h > VH) err(ew, '구역이 가상 캔버스(' + VW + '×' + VH + ') 밖으로 나갑니다');
            }
            color(ew + '.color', e.color);
            text(ew + '.label', e.label, { max: 12, canvas: true, optional: true });
          } else if (e.type === 'node') {
            for (const k of ['x', 'y', 'w', 'h']) if (!isNum(e[k])) err(ew + '.' + k, '숫자여야 합니다');
            enumOf(ew + '.shape', e.shape, SHAPES);
            stackFields(ew, e, { lines: true });
            if ([e.x, e.y, e.w, e.h].every(isNum)) {
              if (e.w < 8 || e.h < 6) err(ew, '노드가 너무 작습니다 (w ≥ 8, h ≥ 6)');
              if (e.x - e.w / 2 < EDGE - 1e-9 || e.x + e.w / 2 > VW - EDGE + 1e-9 || e.y - e.h / 2 < EDGE - 1e-9 || e.y + e.h / 2 > VH - EDGE + 1e-9) {
                err(ew, '노드 "' + e.id + '" 가 여백(' + EDGE + ') 밖으로 나갑니다 — x ' + (e.x - e.w / 2) + '~' + (e.x + e.w / 2) + ', y ' + (e.y - e.h / 2) + '~' + (e.y + e.h / 2) + ' (허용 ' + EDGE + '~' + (VW - EDGE) + ', ' + EDGE + '~' + (VH - EDGE) + ')');
              }
            }
          } else if (e.type === 'link') {
            const endpoint = (k) => {
              const v = e[k];
              if (typeof v === 'string') { if (!nodes.has(v)) err(ew + '.' + k, '존재하지 않는 노드 id: ' + v); } else if (Array.isArray(v) && v.length === 2 && v.every(isNum)) {
                if (v[0] < 0 || v[0] > VW || v[1] < 0 || v[1] > VH) err(ew + '.' + k, '좌표가 가상 캔버스 밖입니다: ' + JSON.stringify(v));
              } else err(ew + '.' + k, '노드 id 또는 [x, y] 여야 합니다');
            };
            endpoint('from');
            endpoint('to');
            if (e.from !== undefined && e.from === e.to) err(ew, '같은 노드끼리 잇는 링크입니다');
            enumOf(ew + '.style', e.style === undefined ? 'solid' : e.style, ['solid', 'dash']);
            if (e.arrow !== undefined && typeof e.arrow !== 'boolean') err(ew + '.arrow', 'true/false 여야 합니다');
            text(ew + '.label', e.label, { max: 10, canvas: true, optional: true });
            color(ew + '.color', e.color === undefined ? 'white' : e.color);
          } else if (e.type === 'text') {
            if (!isNum(e.x) || !isNum(e.y)) err(ew, 'x, y 는 숫자여야 합니다');
            else if (e.x < EDGE || e.x > VW - EDGE || e.y < EDGE || e.y > VH - EDGE) err(ew, '글 위치가 여백(' + EDGE + ') 밖입니다');
            text(ew + '.text', e.text, { max: 36, canvas: true });
            enumOf(ew + '.size', e.size === undefined ? 's' : e.size, SIZES);
            color(ew + '.color', e.color === undefined ? 'white' : e.color);
            enumOf(ew + '.align', e.align === undefined ? 'center' : e.align, ALIGNS);
          }
        });
        // 노드끼리 겹치면 안 됩니다
        const list = [...nodes.values()].filter((n) => [n.x, n.y, n.w, n.h].every(isNum));
        for (let i = 0; i < list.length; i++) {
          for (let j = i + 1; j < list.length; j++) {
            const a = list[i];
            const c = list[j];
            if (Math.abs(a.x - c.x) < (a.w + c.w) / 2 - 1e-9 && Math.abs(a.y - c.y) < (a.h + c.h) / 2 - 1e-9) err(bw + '.elements', '노드 "' + a.id + '" 와 "' + c.id + '" 가 겹칩니다');
          }
        }
        if (nodes.size < 2) err(bw + '.elements', '노드가 2개 이상 필요합니다');
        if (nodes.size > 20) err(bw + '.elements', '노드가 너무 많습니다 (' + nodes.size + '개, 20개 이하)');
        atSeries(bw + '.elements', els, AT_LAST_MAX);
        break;
      }
      case 'timeline': {
        checkElementTypes(['span', 'event']);
        const ax = b.axis;
        let axisOk = false;
        if (!ax || typeof ax !== 'object') err(bw + '.axis', '{from,to,step,unit} 가 필요합니다');
        else {
          if (![ax.from, ax.to, ax.step].every(isInt)) err(bw + '.axis', 'from, to, step 은 정수여야 합니다');
          else if (ax.from >= ax.to || ax.step <= 0) err(bw + '.axis', 'from < to, step > 0 이어야 합니다');
          else if (Math.floor((ax.to - ax.from) / ax.step) + 1 > 14) err(bw + '.axis', '눈금이 너무 많습니다 (14개 이하)');
          else axisOk = true;
          if (ax.unit !== 'BCE') err(bw + '.axis.unit', '"BCE" 여야 합니다');
          if (axisOk && (ax.to - ax.from) % ax.step !== 0) warn(bw + '.axis', '(to - from) 이 step 의 배수가 아니라 끝 눈금이 비어 보일 수 있습니다');
        }
        els.forEach((e, i) => {
          if (!e || typeof e !== 'object') return;
          const ew = bw + '.elements[' + i + ']';
          if (!isInt(e.lane) || e.lane < 0 || e.lane > 3) err(ew + '.lane', '0~3 정수여야 합니다 (현재 ' + fmt(e.lane) + ')');
          color(ew + '.color', e.color);
          if (e.uncertain !== undefined && typeof e.uncertain !== 'boolean') err(ew + '.uncertain', 'true/false 여야 합니다');
          text(ew + '.title', e.title, { max: 12, canvas: true });
          const inRange = (k) => {
            if (!isInt(e[k])) err(ew + '.' + k, '정수 연도여야 합니다 (현재 ' + fmt(e[k]) + ')');
            else if (axisOk && (e[k] < ax.from || e[k] > ax.to)) err(ew + '.' + k, '연도 ' + e[k] + ' 이(가) 축 범위(' + ax.from + '~' + ax.to + ') 밖입니다');
          };
          if (e.type === 'span') {
            inRange('from');
            inRange('to');
            if (isInt(e.from) && isInt(e.to) && e.from >= e.to) err(ew, 'from < to 여야 합니다');
          } else if (e.type === 'event') {
            inRange('year');
            text(ew + '.sub', e.sub, { max: 16, canvas: true, optional: true });
          }
        });
        count('span', 0, 8);
        count('event', 0, 10);
        if (els.length < 3) err(bw + '.elements', '요소가 3개 이상 필요합니다');
        atSeries(bw + '.elements', els, AT_LAST_MAX);
        break;
      }
      case 'ladder': {
        text(bw + '.top', b.top, { max: 6, canvas: true });
        text(bw + '.bottom', b.bottom, { max: 6, canvas: true });
        checkElementTypes(['tier']);
        count('tier', 3, 5);
        els.forEach((e, i) => { if (e && e.type === 'tier') stackFields(bw + '.elements[' + i + ']', e, { lines: false }); });
        atSeries(bw + '.elements', els, AT_LAST_MAX);
        break;
      }
      case 'radial': {
        const c = b.center;
        if (!c || typeof c !== 'object') err(bw + '.center', '{han,title,lines,color,at} 가 필요합니다');
        else {
          stackFields(bw + '.center', c, { lines: true });
          if (!isNum(c.at) || c.at < 0 || c.at > 1) err(bw + '.center.at', '0~1 사이 숫자여야 합니다');
        }
        checkElementTypes(['spoke']);
        count('spoke', 3, 8);
        els.forEach((e, i) => { if (e && e.type === 'spoke') stackFields(bw + '.elements[' + i + ']', e, { lines: false }); });
        atSeries(bw + '.elements', els, AT_LAST_MAX);
        if (c && isNum(c.at) && els[0] && isNum(els[0].at) && c.at > els[0].at + 1e-9) err(bw + '.center.at', '중심(' + c.at + ')은 첫 번째 가지(' + els[0].at + ')보다 먼저 쓰여야 합니다');
        break;
      }
      case 'table': {
        if (!Array.isArray(b.cols) || b.cols.length < 2 || b.cols.length > 4) err(bw + '.cols', '열 이름 2~4개의 배열이어야 합니다');
        else b.cols.forEach((c, i) => text(bw + '.cols[' + i + ']', c, { max: 14, canvas: true }));
        checkElementTypes(['row']);
        count('row', 3, 9);
        els.forEach((e, i) => {
          if (!e || e.type !== 'row') return;
          const ew = bw + '.elements[' + i + ']';
          if (!Array.isArray(e.cells) || (Array.isArray(b.cols) && e.cells.length !== b.cols.length)) err(ew + '.cells', '칸 수가 열 수(' + (Array.isArray(b.cols) ? b.cols.length : '?') + ')와 같아야 합니다');
          else e.cells.forEach((cell, j) => text(ew + '.cells[' + j + ']', cell, { max: 14, canvas: true }));
          color(ew + '.color', e.color);
        });
        atSeries(bw + '.elements', els, AT_LAST_MAX);
        break;
      }
      case 'compare': {
        for (const side of ['left', 'right']) {
          const sd = b[side];
          if (!sd || typeof sd !== 'object') err(bw + '.' + side, '{title,color} 가 필요합니다');
          else { text(bw + '.' + side + '.title', sd.title, { max: 10, canvas: true }); color(bw + '.' + side + '.color', sd.color); }
        }
        checkElementTypes(['pair']);
        count('pair', 3, 6);
        els.forEach((e, i) => {
          if (!e || e.type !== 'pair') return;
          const ew = bw + '.elements[' + i + ']';
          text(ew + '.label', e.label, { max: 6, canvas: true });
          text(ew + '.left', e.left, { max: 16, canvas: true });
          text(ew + '.right', e.right, { max: 16, canvas: true });
        });
        atSeries(bw + '.elements', els, AT_LAST_MAX);
        break;
      }
      default:
    }
    // 보드 글 전체에서 기업 이름 검사
    for (const c of chalk) if (c.where.startsWith(bw)) forbidden(c.where, c.text);
  }

  /* ---------- 전체 구조 ---------- */
  if (strictStructure) {
    const byPart = { background: 0, chapter: 0, closing: 0 };
    for (const s of steps) if (s && byPart[s.part] !== undefined) byPart[s.part]++;
    for (const part of PARTS) if (byPart[part] !== PART_COUNTS[part]) err('steps', part + ' 단계는 ' + PART_COUNTS[part] + '개여야 합니다 (현재 ' + byPart[part] + '개)');
    if (steps.length !== 23) err('steps', '모두 23단계여야 합니다 (현재 ' + steps.length + '개)');
    // 부(部) 순서: 배경 → 편 → 마무리
    const order = steps.map((s) => (s ? PARTS.indexOf(s.part) : -1));
    for (let i = 1; i < order.length; i++) if (order[i] < order[i - 1]) { err('steps', '단계 순서는 배경 → 13편 → 마무리여야 합니다 (' + (steps[i].id || i) + ')'); break; }
    const chapters = steps.filter((s) => s && s.part === 'chapter').map((s) => s.chapterNo);
    if (chapters.length === 13 && chapters.some((n, i) => n !== i + 1)) err('steps', 'chapterNo 는 1~13 순서대로 하나씩이어야 합니다 (현재 ' + chapters.join(',') + ')');
  }

  return out;
}

/** 오류를 사람이 읽기 좋은 한 덩어리 문자열로 */
export function formatProblems(list, title) {
  return title + ' (' + list.length + '건)\n - ' + list.join('\n - ');
}
