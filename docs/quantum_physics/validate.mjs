#!/usr/bin/env node
/* 양자물리학 칠판 강의 내용 검증.
 *
 *   node validate.mjs                 content/ 의 파일을 모두 검사합니다(아직 없는 파일은 '대기 중'으로만 알립니다)
 *   node validate.mjs --strict        14단계 + 00-meta 가 모두 있어야 통과합니다 (배포 전 최종 점검)
 *   node validate.mjs content/03-doubleslit.json [...]   지정한 파일의 결과만 보여 줍니다(id 중복 등은 전체를 읽어 확인)
 *   node validate.mjs --dir tests/fixtures/content       다른 내용 폴더 검사
 *
 * 종료 코드: 있는 파일에 오류가 있으면 1 (대기 중인 파일은 오류가 아닙니다. --strict 에서는 오류입니다).
 *
 * 검사 항목: 필수 필드, 서식 토큰(^{ } _{ } ** **), 허용 글자(NanumPenScript ∪ QMath), 해설 길이 250~440자와 금지 문자,
 * beats.at 오름차순·해설 끝 이전, board.kind 별 요소/필드, graph 의 expr 파싱·view 안 표본 값, panel 줄 길이,
 * 단계 id == 파일명 id, 열거값(tag·callout·legend·dir·size·style), 색 팔레트, 기업명.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadFonts, missingGlyphs } from './fonts.mjs';

const require = createRequire(import.meta.url);
const Q = require('./qmath.js');

export const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const SCHEMA = 'quantum-physics-lesson/1';
export const META_FILE = '00-meta.json';
export const AUTHOR = 'Microsoft Korea STU';
/** 강의 순서와 파일 이름(NN-<id>.json). 순서·id 는 content/SCHEMA.md 의 '단계 구성' 표와 같습니다. */
export const EXPECTED_IDS = [
  'blackbody', 'photoelectric', 'doubleslit', 'schrodinger', 'box',
  'uncertainty', 'tunneling', 'spin', 'entanglement', 'bell-tests',
  'measurement', 'qcomputing', 'applications', 'frontier',
];
export const EXPECTED_FILES = EXPECTED_IDS.map((id, i) => String(i + 1).padStart(2, '0') + '-' + id + '.json');
export const STEP_FILE_RE = /^(0[1-9]|[1-9]\d)-([a-z0-9]+(?:-[a-z0-9]+)*)\.json$/;

export const PALETTE = Q.PALETTE;
export const TAG_TONES = Q.TONES;
export const CALLOUT_TONES = ['info', 'warn', 'ok'];
export const LEGEND_STYLES = ['line', 'dot', 'dash', 'bar', 'box'];
export const DIRS = ['ul', 'ur', 'dl', 'dr', 'u', 'd', 'l', 'r'];
export const PANEL_SIZES = ['xl', 'l', 'm', 's'];
export const TEXT_SIZES = ['m', 'l', 's'];
export const BOARD_KINDS = ['graph', 'flow', 'bars', 'chalk'];
export const GRAPH_TYPES = ['axes', 'fn', 'area', 'point', 'seg', 'ellipse', 'text'];

export const NARRATION_MIN = 250;
export const NARRATION_MAX = 440;
export const PANEL_WARN = 28;
export const PANEL_ERROR = 34;

/** 기업·고객 이름. 오류: 고객사 후보, 경고: 기술 기업(양자 컴퓨팅 연혁에 나올 수 있으나 정책 확인 필요). */
const CUSTOMER_NAMES = [
  /\bLG\b/i, /\bSK\b/, /\bKT\b/, /samsung/i, /hyundai/i, /naver/i, /kakao/i, /coupang/i, /tesla/i, /toyota/i, /facebook/i, /netflix/i,
  /삼성/, /엘지/, /네이버/, /카카오/, /쿠팡/, /현대/, /테슬라/, /토요타/, /도요타/, /페이스북/, /넷플릭스/,
];
const VENDOR_NAMES = [
  /google/i, /\bapple\b/i, /amazon/i, /microsoft/i, /\bnvidia\b/i, /openai/i, /\bibm\b/i,
  /구글/, /애플/, /아마존/, /마이크로소프트/, /엔비디아/, /아이비엠/,
];

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isInt = (v) => Number.isInteger(v);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const fmt = (v) => (typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v) === undefined ? String(v) : JSON.stringify(v));
const cpLen = (s) => Array.from(s).length;
const codeOf = (ch) => 'U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');

/** 글자 종류를 사람이 읽을 수 있게 */
function charClass(ch) {
  if (/\d/.test(ch)) return '숫자';
  if (/[A-Za-z]/.test(ch)) return '로마자';
  if (/\p{Script=Han}/u.test(ch)) return '한자';
  if (/[ㄱ-ㅎㅏ-ㅣ]/.test(ch)) return '한글 자모(낱글자)';
  if (/\p{Script=Greek}/u.test(ch)) return '그리스 문자';
  if (/\s/.test(ch)) return '줄바꿈/탭';
  return '기호';
}

/** 기대하는 파일 이름과 단계 id */
export const fileIdOf = (file) => {
  const m = STEP_FILE_RE.exec(file);
  return m ? m[2] : null;
};

/* ---------------------------------------------------------------------
 * 내용 읽기: content/00-meta.json + content/NN-<id>.json (파일 이름순)
 * ------------------------------------------------------------------- */
/**
 * 반환: { meta, metaFile, steps: [{file, step}], files, pending: string[], unexpected: string[], problems: string[] }
 * 읽을 수 없는 JSON 은 problems(오류)에 넣습니다. 없는 기대 파일은 pending 입니다.
 */
export function loadContent(dir, loadOpts = {}) {
  const problems = [];
  const present = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  /* free: 시험용 폴더처럼 14단계 표에 묶이지 않는 내용(어떤 NN-id.json 이든 기대 파일로 취급) */
  const expectedFiles = loadOpts.free ? present.filter((f) => STEP_FILE_RE.test(f)) : EXPECTED_FILES;
  let meta = null;
  const metaPath = path.join(dir, META_FILE);
  if (present.includes(META_FILE)) {
    try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch (e) { problems.push('content/' + META_FILE + ': JSON 을 읽을 수 없습니다 — ' + e.message); }
    if (meta !== null && !isObj(meta)) { problems.push('content/' + META_FILE + ': 객체여야 합니다'); meta = null; }
    else if (meta && meta.steps !== undefined) problems.push('content/' + META_FILE + ': steps 는 NN-*.json 파일에 써야 합니다');
  }
  const files = present.filter((f) => /^\d\d.*\.json$/.test(f) && f !== META_FILE).sort();
  const steps = [];
  const unexpected = [];
  for (const f of files) {
    if (!STEP_FILE_RE.test(f)) { problems.push('content/' + f + ': 파일 이름이 NN-<id>.json (소문자·숫자·하이픈) 형식이 아닙니다'); continue; }
    if (!expectedFiles.includes(f)) unexpected.push(f);
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (!isObj(j)) { problems.push('content/' + f + ': 단계 객체 하나여야 합니다 ({ "id": ... } — 배열이나 {"steps":[...]} 가 아님)'); continue; }
      if (Array.isArray(j.steps)) { problems.push('content/' + f + ': {"steps":[...]} 가 아니라 단계 객체 하나를 쓰세요'); continue; }
      steps.push({ file: f, step: j });
    } catch (e) { problems.push('content/' + f + ': JSON 을 읽을 수 없습니다 — ' + e.message); }
  }
  const pending = [];
  if (!present.includes(META_FILE)) pending.push(META_FILE);
  for (const f of expectedFiles) if (!present.includes(f)) pending.push(f);
  return { meta, metaFile: META_FILE, steps, files, pending, unexpected, problems };
}

/** 조립된 장면: 00-meta 의 모든 키 + steps(파일 이름순) */
export const assembleScene = (loaded) => (loaded.meta ? Object.assign({}, loaded.meta, { steps: loaded.steps.map((s) => s.step) }) : null);

/* ---------------------------------------------------------------------
 * 장면 검증
 * ------------------------------------------------------------------- */
/**
 * validateLesson(scene, opts)
 *   scene: { ...meta, steps: [...] }  (meta 가 없을 수도 있습니다: opts.noMeta)
 *   opts.files: steps 와 나란한 파일 이름 배열(오류 위치 표시·id 와 파일명 일치 검사)
 *   opts.glyphs: 어느 글꼴에든 있는 코드 포인트 집합(Set) — 있으면 글리프 검사를 합니다
 *   opts.noMeta: 00-meta 검사를 건너뜁니다
 *   opts.strictStructure: 14단계 전체가 EXPECTED_IDS 와 같은 순서인지 검사
 * 반환: { errors: [{file, where, msg}], warnings: [...], texts: [{text, where}], ids: string[] }
 */
export function validateLesson(scene, opts = {}) {
  const errors = [];
  const warnings = [];
  const texts = [];
  const out = { errors, warnings, texts, ids: [] };
  let file = '';
  const err = (where, msg) => errors.push({ file, where, msg });
  const warn = (where, msg) => warnings.push({ file, where, msg });

  if (!isObj(scene)) { err('', '장면이 객체가 아닙니다'); return out; }

  /** 글자 검사용 목록에 등록 (그려지거나 화면에 보이는 모든 글) */
  const shown = (where, text) => texts.push({ text, where: (file ? file + ' ' : '') + where });
  const forbidden = (where, text) => {
    for (const re of CUSTOMER_NAMES) if (re.test(text)) err(where, '기업·고객 이름은 쓸 수 없습니다 (' + re.source + ')');
    for (const re of VENDOR_NAMES) if (re.test(text)) warn(where, '기업 이름이 들어 있습니다(' + re.source + ') — 고객·기업명 금지 정책에 맞는지 확인하세요');
  };

  /** 서식 문자열: 비어 있지 않고, 토큰이 올바르고, 화면에 보이는 길이가 max 이하. 보이는 글을 돌려줍니다(실패 시 null). */
  const rich = (where, v, o = {}) => {
    if (v === undefined && o.optional) return null;
    if (!isStr(v)) { err(where, '비어 있지 않은 문자열이 필요합니다 (현재 ' + fmt(v) + ')'); return null; }
    let runs;
    try { runs = Q.parseRich(v); } catch (e) { err(where, '서식 오류 — ' + e.message); return null; }
    const visible = runs.map((r) => r.text).join('');
    shown(where, visible);
    forbidden(where, visible);
    const n = cpLen(visible);
    if (o.max && n > (o.errMax || o.max * 1.5)) err(where, '글이 너무 깁니다 (' + n + '자, ' + o.max + '자 이하 권장): ' + fmt(visible.slice(0, 40) + '…'));
    else if (o.max && n > o.max) warn(where, '글이 깁니다 (' + n + '자, ' + o.max + '자 이하 권장)');
    if (/[²³¹⁰⁴-⁹₀-₉]/.test(visible)) err(where, '유니코드 첨자(²,₀ 등)는 쓰지 말고 ^{2} / _{0} 서식을 쓰세요');
    return visible;
  };
  const plain = (where, v, o = {}) => {
    if (!isStr(v)) { if (!(v === undefined && o.optional)) err(where, '비어 있지 않은 문자열이 필요합니다 (현재 ' + fmt(v) + ')'); return; }
    shown(where, v);
    forbidden(where, v);
    const n = cpLen(v);
    if (o.max && n > (o.errMax || o.max * 1.5)) err(where, '글이 너무 깁니다 (' + n + '자, ' + o.max + '자 이하 권장)');
    else if (o.max && n > o.max) warn(where, '글이 깁니다 (' + n + '자, ' + o.max + '자 이하 권장)');
  };
  const enumOf = (where, v, list, optional) => {
    if (v === undefined && optional) return;
    if (!list.includes(v)) err(where, list.map((s) => '"' + s + '"').join(' | ') + ' 중 하나여야 합니다 (현재 ' + fmt(v) + ')');
  };
  const color = (where, v) => enumOf(where, v, PALETTE);
  const unknownKeys = (where, obj, allowed) => {
    for (const k of Object.keys(obj)) if (!allowed.includes(k)) warn(where, '알 수 없는 필드 "' + k + '" (오타인가요? 쓸 수 있는 필드: ' + allowed.join(', ') + ') — 엔진이 무시합니다');
  };
  const atField = (where, v, optional) => {
    if (v === undefined && optional) return true;
    if (!isNum(v) || v < 0) { err(where, '0 이상의 숫자(초)여야 합니다 (현재 ' + fmt(v) + ')'); return false; }
    if (v > 120) { err(where, '시각이 너무 큽니다 (' + v + '초) — 단계 시작 후 초 단위입니다'); return false; }
    return true;
  };
  const durField = (where, v, optional) => {
    if (v === undefined && optional) return;
    if (!isNum(v) || v <= 0 || v > 30) err(where, '0 초과 30 이하의 숫자(초)여야 합니다 (현재 ' + fmt(v) + ')');
  };

  /* ---------- 00-meta ---------- */
  if (!opts.noMeta) {
    file = opts.metaFile === undefined ? META_FILE : opts.metaFile;
    if (scene.schema !== SCHEMA) err('schema', '"' + SCHEMA + '" 이어야 합니다 (현재 ' + fmt(scene.schema) + ')');
    if (scene.lang !== 'ko') err('lang', '"ko" 이어야 합니다 (현재 ' + fmt(scene.lang) + ')');
    rich('eyebrow', scene.eyebrow, { max: 40 });
    rich('title', scene.title, { max: 40 });
    rich('subtitle', scene.subtitle, { max: 100 });
    if (scene.author !== AUTHOR) err('author', '"' + AUTHOR + '" 이어야 합니다 (현재 ' + fmt(scene.author) + ')');
    if (!isObj(scene.ui)) err('ui', '{ "hint": "눌러서 판서 시작" } 이 필요합니다');
    else {
      rich('ui.hint', scene.ui.hint, { max: 20 });
      if (scene.ui.hint !== '눌러서 판서 시작') warn('ui.hint', '"눌러서 판서 시작" 이 표준입니다');
    }
    const miscs = scene.misconceptions;
    if (!Array.isArray(miscs) || miscs.length === 0) err('misconceptions', '{title,text} 배열이 필요합니다 (4~5개)');
    else {
      if (miscs.length < 3 || miscs.length > 6) err('misconceptions', '오해 바로잡기는 4~5개여야 합니다 (현재 ' + miscs.length + '개)');
      else if (miscs.length < 4 || miscs.length > 5) warn('misconceptions', '오해 바로잡기는 4~5개를 권장합니다 (현재 ' + miscs.length + '개)');
      miscs.forEach((m, i) => {
        const w = 'misconceptions[' + i + ']';
        if (!isObj(m)) { err(w, '{title,text} 객체여야 합니다'); return; }
        rich(w + '.title', m.title, { max: 40 });
        rich(w + '.text', m.text, { max: 260 });
        unknownKeys(w, m, ['title', 'text']);
      });
    }
    const refs = scene.references;
    if (!Array.isArray(refs) || refs.length === 0) err('references', '참고문헌 문자열 배열이 필요합니다 (8~12개)');
    else {
      if (refs.length < 6 || refs.length > 14) err('references', '참고문헌은 8~12개여야 합니다 (현재 ' + refs.length + '개)');
      else if (refs.length < 8 || refs.length > 12) warn('references', '참고문헌은 8~12개를 권장합니다 (현재 ' + refs.length + '개)');
      refs.forEach((r, i) => plain('references[' + i + ']', r, { max: 200, errMax: 320 }));
    }
    const metaKeys = ['schema', 'lang', 'eyebrow', 'title', 'subtitle', 'author', 'ui', 'misconceptions', 'references'];
    unknownKeys('', scene, metaKeys.concat(opts.noMeta ? ['steps'] : ['steps']));
  }

  /* ---------- 단계 ---------- */
  const steps = Array.isArray(scene.steps) ? scene.steps : [];
  if (!Array.isArray(scene.steps)) { file = ''; err('steps', '배열이 필요합니다'); }
  const seen = new Map();
  steps.forEach((step, si) => {
    file = opts.files && opts.files[si] ? opts.files[si] : '';
    const label = file || 'steps[' + si + ']';
    if (!isObj(step)) { err('', '단계가 객체가 아닙니다'); return; }
    validateStep(step, label);
  });

  function validateStep(step, label) {
    const id = step.id;
    if (typeof id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) err('id', '소문자 영문·숫자(하이픈 허용)여야 합니다 (현재 ' + fmt(id) + ')');
    else {
      out.ids.push(id);
      if (seen.has(id)) err('id', '단계 id "' + id + '" 가 ' + seen.get(id) + ' 와 겹칩니다');
      seen.set(id, label);
      const fid = file ? fileIdOf(file) : null;
      if (fid && fid !== id) err('id', '파일 이름의 id "' + fid + '" 와 단계 id "' + id + '" 가 같아야 합니다');
    }
    unknownKeys('', step, ['id', 'nav', 'title', 'tag', 'summary', 'narration', 'beats', 'callout', 'legend', 'alt', 'board', 'panel']);
    rich('nav', step.nav, { max: 8, errMax: 12 });
    rich('title', step.title, { max: 48, errMax: 80 });
    if (!isObj(step.tag)) err('tag', '{ "tone": ..., "text": ... } 가 필요합니다');
    else {
      enumOf('tag.tone', step.tag.tone, TAG_TONES);
      rich('tag.text', step.tag.text, { max: 44, errMax: 70 });
      unknownKeys('tag', step.tag, ['tone', 'text']);
    }
    rich('summary', step.summary, { max: 160, errMax: 260 });
    validateNarration(step);
    validateBeats(step);
    if (!isObj(step.callout)) err('callout', '{ "tone", "title", "text" } 가 필요합니다');
    else {
      enumOf('callout.tone', step.callout.tone, CALLOUT_TONES);
      rich('callout.title', step.callout.title, { max: 30, errMax: 44 });
      rich('callout.text', step.callout.text, { max: 150, errMax: 240 });
      unknownKeys('callout', step.callout, ['tone', 'title', 'text']);
    }
    if (!Array.isArray(step.legend)) err('legend', '배열이 필요합니다 (의미가 없으면 [])');
    else {
      if (step.legend.length > 6) err('legend', '범례 항목이 너무 많습니다 (' + step.legend.length + '개, 6개 이하)');
      step.legend.forEach((l, i) => {
        const w = 'legend[' + i + ']';
        if (!isObj(l)) { err(w, '{color,style,text} 객체여야 합니다'); return; }
        color(w + '.color', l.color);
        enumOf(w + '.style', l.style, LEGEND_STYLES);
        rich(w + '.text', l.text, { max: 30, errMax: 46 });
        unknownKeys(w, l, ['color', 'style', 'text']);
      });
    }
    if (!isStr(step.alt)) err('alt', '문자열이 필요합니다');
    else {
      plain('alt', step.alt);
      if (cpLen(step.alt) < 40) warn('alt', '대체 서술이 너무 짧습니다 (' + cpLen(step.alt) + '자) — 축, 곡선 모양, 값을 서술하세요');
      if (cpLen(step.alt) > 600) warn('alt', '대체 서술이 깁니다 (' + cpLen(step.alt) + '자)');
    }
    validatePanel(step);
    validateBoard(step);
    // 판서가 해설보다 늦게 끝나지 않는지
    if (typeof step.narration === 'string' && isObj(step.board) && Array.isArray(step.board.elements) && Array.isArray(step.panel)) {
      try {
        const tl = Q.stepTimeline(step);
        const est = Q.estimateNarration(step.narration);
        if (tl.animEnd > est + 1) warn('board/panel', '판서가 약 ' + tl.animEnd.toFixed(1) + '초에 끝나는데 해설 추정 길이는 ' + est.toFixed(1) + '초입니다 — at 을 앞으로 당기거나 글을 줄이세요');
      } catch { /* 서식 오류는 위에서 이미 보고했습니다 */ }
    }
  }

  function validateNarration(step) {
    const n = step.narration;
    if (!isStr(n)) { err('narration', '비어 있지 않은 문자열이 필요합니다'); return; }
    forbidden('narration', n);
    const len = cpLen(n);
    if (len < NARRATION_MIN) err('narration', '해설이 ' + len + '자입니다 — ' + NARRATION_MIN + '자 이상이어야 합니다 (약 40~60초)');
    if (len > NARRATION_MAX) err('narration', '해설이 ' + len + '자입니다 — ' + NARRATION_MAX + '자를 넘으면 음성 서비스가 거부합니다');
    if (n !== n.trim()) err('narration', '앞뒤 공백이 있습니다 (대본 해시가 달라집니다)');
    const bad = [];
    for (const m of n.matchAll(/[^가-힣 .,?!']/gu)) bad.push({ ch: m[0], i: m.index });
    if (bad.length) {
      const sample = bad.slice(0, 6).map((b) => JSON.stringify(b.ch) + '(' + charClass(b.ch) + ', ' + codeOf(b.ch) + ', ' + (b.i + 1) + '번째 근처: …' + n.slice(Math.max(0, b.i - 6), b.i + 6).replace(/\n/g, '↵') + '…)');
      err('narration', '음성이 예측 불가하게 읽는 글자 ' + bad.length + '개 — 숫자·기호·로마자·한자는 모두 한글로 풀어 쓰세요 (허용: 한글, 공백, . , ? ! \'). 예: ' + sample.join(', '));
    }
    if (/ {2,}/.test(n)) warn('narration', '연속 공백이 있습니다');
    if (!/[.?!]$/.test(n)) warn('narration', '마지막 문장이 . ? ! 로 끝나지 않습니다');
  }

  function validateBeats(step) {
    const beats = step.beats;
    if (!Array.isArray(beats)) { err('beats', '{at,text} 배열이 필요합니다 (3~4개)'); return; }
    if (beats.length < 2 || beats.length > 6) err('beats', '자막은 3~4개여야 합니다 (현재 ' + beats.length + '개)');
    else if (beats.length < 3 || beats.length > 4) warn('beats', '자막은 3~4개를 권장합니다 (현재 ' + beats.length + '개)');
    let prev = -Infinity;
    const fast = typeof step.narration === 'string' ? Q.fastestNarration(step.narration) : Infinity;
    const est = typeof step.narration === 'string' ? Q.estimateNarration(step.narration) : Infinity;
    beats.forEach((b, i) => {
      const w = 'beats[' + i + ']';
      if (!isObj(b)) { err(w, '{at,text} 객체여야 합니다'); return; }
      rich(w + '.text', b.text, { max: 100, errMax: 170 });
      unknownKeys(w, b, ['at', 'text']);
      if (!isNum(b.at) || b.at < 0) { err(w + '.at', '0 이상의 숫자(초)여야 합니다 (현재 ' + fmt(b.at) + ')'); return; }
      if (b.at <= prev) err(w + '.at', 'at 은 앞 자막보다 커야 합니다(오름차순): ' + b.at + ' <= ' + prev);
      prev = b.at;
      if (i === beats.length - 1) {
        if (b.at >= fast - 1) err(w + '.at', '마지막 자막 시각 ' + b.at + '초가 해설 끝(추정 ' + est.toFixed(0) + '초, 가장 빠르면 ' + fast.toFixed(0) + '초) 이전이 아닙니다');
        else if (b.at > est - 3) warn(w + '.at', '마지막 자막 시각 ' + b.at + '초가 해설 끝(추정 ' + est.toFixed(0) + '초)에 너무 가깝습니다');
      }
    });
  }

  function validatePanel(step) {
    const panel = step.panel;
    if (!Array.isArray(panel)) { err('panel', '{text,color,size,at} 배열이 필요합니다 (3~7줄)'); return; }
    if (panel.length < 2 || panel.length > 8) err('panel', '노트는 3~7줄이어야 합니다 (현재 ' + panel.length + '줄)');
    else if (panel.length < 3 || panel.length > 7) warn('panel', '노트는 3~7줄을 권장합니다 (현재 ' + panel.length + '줄)');
    let prev = -Infinity;
    panel.forEach((l, i) => {
      const w = 'panel[' + i + ']';
      if (!isObj(l)) { err(w, '{text,color,size,at} 객체여야 합니다'); return; }
      const vis = rich(w + '.text', l.text);
      if (vis !== null) {
        const n = cpLen(vis);
        if (n > PANEL_ERROR) err(w + '.text', '한 줄이 너무 깁니다 (' + n + '자, ' + PANEL_WARN + '자 안팎까지): ' + fmt(vis));
        else if (n > PANEL_WARN) warn(w + '.text', '한 줄이 깁니다 (' + n + '자, ' + PANEL_WARN + '자 이하 권장): ' + fmt(vis));
      }
      color(w + '.color', l.color);
      enumOf(w + '.size', l.size, PANEL_SIZES);
      if (atField(w + '.at', l.at, true) && l.at !== undefined) {
        if (l.at < prev) warn(w + '.at', '앞 줄보다 먼저 쓰이는 줄입니다');
        prev = l.at;
      }
      unknownKeys(w, l, ['text', 'color', 'size', 'at', 'dur']);
    });
  }

  /* ---------- 보드 ---------- */
  function validateBoard(step) {
    const b = step.board;
    if (!isObj(b)) { err('board', '객체가 필요합니다'); return; }
    if (!BOARD_KINDS.includes(b.kind)) { err('board.kind', BOARD_KINDS.map((k) => '"' + k + '"').join(' | ') + ' 중 하나여야 합니다 (현재 ' + fmt(b.kind) + ')'); return; }
    const els = b.elements;
    if (!Array.isArray(els)) { err('board.elements', '배열이 필요합니다'); return; }
    if (b.kind === 'graph') validateGraph(b, els);
    else if (b.kind === 'flow') validateFlow(b, els);
    else if (b.kind === 'bars') validateBars(b, els);
    else {
      unknownKeys('board', b, ['kind', 'elements']);
      if (els.length) err('board.elements', 'chalk 보드의 elements 는 빈 배열 [] 이어야 합니다 (글은 panel 에)');
    }
  }

  function validateGraph(b, els) {
    unknownKeys('board', b, ['kind', 'view', 'equalAspect', 'elements']);
    let xr = null;
    let yr = null;
    if (!isObj(b.view)) err('board.view', '{ "x": [a, b], "y": [a, b] } 가 필요합니다');
    else {
      const range = (k) => {
        const r = b.view[k];
        if (!Array.isArray(r) || r.length !== 2 || !r.every(isNum) || !(r[0] < r[1])) { err('board.view.' + k, '[최소, 최대] (최소 < 최대) 여야 합니다 (현재 ' + fmt(r) + ')'); return null; }
        return r;
      };
      xr = range('x');
      yr = range('y');
    }
    if (b.equalAspect !== undefined && typeof b.equalAspect !== 'boolean') err('board.equalAspect', 'true/false 여야 합니다');
    if (els.length < 1) err('board.elements', 'graph 보드에는 요소가 1개 이상 필요합니다');
    if (els.length > 40) err('board.elements', '요소가 너무 많습니다 (' + els.length + '개, 40개 이하)');
    if (!els.some((e) => isObj(e) && e.type === 'axes')) warn('board.elements', 'axes(축) 요소가 없습니다 — 의도한 것이 맞나요?');
    if (els.filter((e) => isObj(e) && e.type === 'axes').length > 1) err('board.elements', 'axes 는 하나만 둘 수 있습니다');

    const inX = (v) => !xr || (v >= xr[0] - 1e-9 && v <= xr[1] + 1e-9);
    const inY = (v) => !yr || (v >= yr[0] - 1e-9 && v <= yr[1] + 1e-9);
    const xy = (w, x, y, what) => {
      if (!isNum(x) || !isNum(y)) { err(w, what + ' 의 x, y 는 숫자여야 합니다'); return false; }
      if (!inX(x) || !inY(y)) { err(w, what + ' (' + x + ', ' + y + ') 가 view(x ' + fmt(xr) + ', y ' + fmt(yr) + ') 밖입니다'); return false; }
      return true;
    };
    const label = (w, lab) => {
      if (lab === undefined) return;
      if (!isObj(lab)) { err(w, '{ "text", "x", "y" } 여야 합니다'); return; }
      rich(w + '.text', lab.text, { max: 22, errMax: 34 });
      xy(w, lab.x, lab.y, '라벨 위치');
      unknownKeys(w, lab, ['text', 'x', 'y']);
    };
    const exprCheck = (w, e, range) => {
      if (typeof e.expr !== 'string') { err(w + '.expr', '수식 문자열이 필요합니다 (현재 ' + fmt(e.expr) + ')'); return; }
      let f;
      try { f = Q.compileExpr(e.expr); } catch (x) { err(w + '.expr', '수식을 해석할 수 없습니다: ' + x.message + ' — ' + fmt(e.expr)); return; }
      const [a, bb] = range;
      const st = Q.sampleStats(f, a, bb, 240, yr);
      if (st.finite === 0) err(w + '.expr', '구간 [' + a + ', ' + bb + '] 어디서도 값이 정의되지 않습니다 (NaN/무한대): ' + fmt(e.expr));
      else if (st.inView === 0) err(w + '.expr', '구간 [' + a + ', ' + bb + '] 의 모든 값이 view.y ' + fmt(yr) + ' 밖에 있습니다 (값 범위 ' + st.ymin.toPrecision(3) + ' ~ ' + st.ymax.toPrecision(3) + '): ' + fmt(e.expr));
      else if (st.inView / st.total < 0.15) warn(w + '.expr', '구간의 대부분(' + Math.round((1 - st.inView / st.total) * 100) + '%)이 view.y 밖입니다 (값 범위 ' + st.ymin.toPrecision(3) + ' ~ ' + st.ymax.toPrecision(3) + ')');
      else if (st.finite / st.total < 0.5) warn(w + '.expr', '구간의 절반 넘게 값이 정의되지 않습니다(' + Math.round((1 - st.finite / st.total) * 100) + '%)');
    };
    const xRange = (w, e, required) => {
      if (e.x === undefined && !required) return xr || [0, 1];
      if (!Array.isArray(e.x) || e.x.length !== 2 || !e.x.every(isNum) || !(e.x[0] < e.x[1])) {
        err(w + '.x', '[a, b] (a < b) 여야 합니다 (현재 ' + fmt(e.x) + ')');
        return xr || [0, 1];
      }
      if (xr && (e.x[1] < xr[0] || e.x[0] > xr[1])) err(w + '.x', '구간 ' + fmt(e.x) + ' 이(가) view.x ' + fmt(xr) + ' 와 겹치지 않습니다');
      else if (xr && (e.x[0] < xr[0] - 1e-9 || e.x[1] > xr[1] + 1e-9)) warn(w + '.x', '구간 ' + fmt(e.x) + ' 이(가) view.x ' + fmt(xr) + ' 를 벗어납니다(잘려서 그려집니다)');
      return e.x;
    };

    els.forEach((e, i) => {
      const w = 'board.elements[' + i + ']';
      if (!isObj(e)) { err(w, '객체여야 합니다'); return; }
      if (!GRAPH_TYPES.includes(e.type)) { err(w + '.type', GRAPH_TYPES.map((t) => '"' + t + '"').join(' | ') + ' 중 하나여야 합니다 (현재 ' + fmt(e.type) + ')'); return; }
      atField(w + '.at', e.at);
      switch (e.type) {
        case 'axes': {
          unknownKeys(w, e, ['type', 'at', 'dur', 'xLabel', 'yLabel', 'xTicks', 'yTicks', 'grid']);
          durField(w + '.dur', e.dur, true);
          rich(w + '.xLabel', e.xLabel, { max: 20, errMax: 32, optional: true });
          rich(w + '.yLabel', e.yLabel, { max: 20, errMax: 32, optional: true });
          if (e.grid !== undefined && typeof e.grid !== 'boolean') err(w + '.grid', 'true/false 여야 합니다');
          for (const [k, r] of [['xTicks', xr], ['yTicks', yr]]) {
            if (e[k] === undefined) continue;
            if (!Array.isArray(e[k])) { err(w + '.' + k, '[{v,label}] 배열이어야 합니다'); continue; }
            if (e[k].length > 12) err(w + '.' + k, '눈금이 너무 많습니다 (' + e[k].length + '개, 12개 이하)');
            e[k].forEach((t, j) => {
              const tw = w + '.' + k + '[' + j + ']';
              if (!isObj(t) || !isNum(t.v)) { err(tw, '{ "v": 숫자, "label": 문자열 } 이어야 합니다'); return; }
              if (r && (t.v < r[0] - 1e-9 || t.v > r[1] + 1e-9)) err(tw + '.v', '눈금 값 ' + t.v + ' 이(가) view ' + fmt(r) + ' 밖입니다');
              rich(tw + '.label', t.label, { max: 10, errMax: 18 });
              unknownKeys(tw, t, ['v', 'label']);
            });
          }
          break;
        }
        case 'fn': {
          unknownKeys(w, e, ['type', 'expr', 'x', 'color', 'at', 'dur', 'dash', 'samples', 'label']);
          color(w + '.color', e.color);
          durField(w + '.dur', e.dur, true);
          if (e.dash !== undefined && typeof e.dash !== 'boolean') err(w + '.dash', 'true/false 여야 합니다');
          if (e.samples !== undefined && (!isInt(e.samples) || e.samples < 8 || e.samples > 2000)) err(w + '.samples', '8~2000 사이 정수여야 합니다');
          exprCheck(w, e, xRange(w, e, false));
          label(w + '.label', e.label);
          break;
        }
        case 'area': {
          unknownKeys(w, e, ['type', 'expr', 'x', 'color', 'at', 'dur', 'base']);
          color(w + '.color', e.color);
          durField(w + '.dur', e.dur, true);
          if (e.base !== undefined && !isNum(e.base)) err(w + '.base', '숫자여야 합니다');
          exprCheck(w, e, xRange(w, e, true));
          break;
        }
        case 'point': {
          unknownKeys(w, e, ['type', 'x', 'y', 'color', 'at', 'label', 'dir']);
          color(w + '.color', e.color);
          xy(w, e.x, e.y, '점');
          rich(w + '.label', e.label, { max: 22, errMax: 34, optional: true });
          enumOf(w + '.dir', e.dir, DIRS, true);
          break;
        }
        case 'seg': {
          unknownKeys(w, e, ['type', 'from', 'to', 'color', 'at', 'dur', 'style', 'arrow', 'label']);
          color(w + '.color', e.color);
          durField(w + '.dur', e.dur, true);
          enumOf(w + '.style', e.style, ['solid', 'dash'], true);
          if (e.arrow !== undefined && typeof e.arrow !== 'boolean') err(w + '.arrow', 'true/false 여야 합니다');
          const ends = ['from', 'to'].map((k) => (Array.isArray(e[k]) && e[k].length === 2 && e[k].every(isNum) ? e[k] : null));
          ['from', 'to'].forEach((k, j) => { if (!ends[j]) err(w + '.' + k, '[x, y] 숫자 쌍이어야 합니다 (현재 ' + fmt(e[k]) + ')'); });
          if (ends[0] && ends[1]) {
            if (ends[0][0] === ends[1][0] && ends[0][1] === ends[1][1]) err(w, '시작점과 끝점이 같습니다');
            // 선분은 view 에서 잘려 그려지지만, 끝점이 모두 view 밖이면 보이지 않을 수 있습니다.
            const out2 = ends.filter((p) => !inX(p[0]) || !inY(p[1])).length;
            if (out2 === 2) warn(w, '두 끝점이 모두 view 밖입니다(보이는 부분만 그려집니다)');
            else if (out2 === 1) warn(w, '한 끝점이 view 밖입니다(보이는 부분만 그려집니다)');
          }
          label(w + '.label', e.label);
          break;
        }
        case 'ellipse': {
          unknownKeys(w, e, ['type', 'cx', 'cy', 'rx', 'ry', 'color', 'at', 'dur', 'dash', 'from', 'to']);
          color(w + '.color', e.color);
          durField(w + '.dur', e.dur, true);
          if (e.dash !== undefined && typeof e.dash !== 'boolean') err(w + '.dash', 'true/false 여야 합니다');
          if (![e.cx, e.cy, e.rx, e.ry].every(isNum)) { err(w, 'cx, cy, rx, ry 는 숫자여야 합니다'); break; }
          if (e.rx <= 0 || e.ry <= 0) err(w, 'rx, ry 는 0 보다 커야 합니다');
          if ((e.from === undefined) !== (e.to === undefined)) err(w, 'from 과 to 는 함께 써야 합니다(라디안)');
          else if (e.from !== undefined && (!isNum(e.from) || !isNum(e.to))) err(w, 'from, to 는 숫자(라디안)여야 합니다');
          if (e.rx > 0 && e.ry > 0 && xr && yr) {
            // 호 위의 점 중 view 밖에 나가는 비율
            const a0 = isNum(e.from) ? e.from : 0;
            const a1 = isNum(e.to) ? e.to : Math.PI * 2;
            let outside = 0;
            const N = 90;
            for (let k = 0; k <= N; k++) {
              const t = a0 + ((a1 - a0) * k) / N;
              if (!inX(e.cx + e.rx * Math.cos(t)) || !inY(e.cy + e.ry * Math.sin(t))) outside += 1;
            }
            if (outside === N + 1) err(w, '타원이 통째로 view 밖입니다');
            else if (outside / (N + 1) > 0.05) warn(w, '타원의 일부(' + Math.round((outside / (N + 1)) * 100) + '%)가 view 밖으로 나갑니다(잘려서 그려집니다)');
          }
          break;
        }
        case 'text': {
          unknownKeys(w, e, ['type', 'x', 'y', 'text', 'color', 'size', 'at', 'dir']);
          color(w + '.color', e.color);
          xy(w, e.x, e.y, '글자');
          rich(w + '.text', e.text, { max: 26, errMax: 40 });
          enumOf(w + '.size', e.size, TEXT_SIZES, true);
          enumOf(w + '.dir', e.dir, DIRS, true);
          break;
        }
        default:
      }
    });
  }

  function validateFlow(b, els) {
    unknownKeys('board', b, ['kind', 'cols', 'elements']);
    if (!isInt(b.cols) || b.cols < 1 || b.cols > 4) err('board.cols', '1~4 사이 정수여야 합니다 (현재 ' + fmt(b.cols) + ')');
    if (els.length < 2 || els.length > 6) err('board.elements', 'flow 노드는 2~6개여야 합니다 (현재 ' + els.length + '개)');
    const ids = new Set();
    els.forEach((e, i) => {
      const w = 'board.elements[' + i + ']';
      if (!isObj(e)) { err(w, '객체여야 합니다'); return; }
      if (e.type !== 'node') { err(w + '.type', '"node" 여야 합니다 (현재 ' + fmt(e.type) + ')'); return; }
      unknownKeys(w, e, ['type', 'id', 'color', 'at', 'title', 'lines']);
      if (!isStr(e.id) || !/^[A-Za-z0-9_-]+$/.test(e.id)) err(w + '.id', '영문·숫자 id 가 필요합니다');
      else if (ids.has(e.id)) err(w + '.id', 'id "' + e.id + '" 가 겹칩니다');
      else ids.add(e.id);
      color(w + '.color', e.color);
      atField(w + '.at', e.at);
      rich(w + '.title', e.title, { max: 14, errMax: 22 });
      if (!Array.isArray(e.lines)) err(w + '.lines', '문자열 배열이어야 합니다 (없으면 [])');
      else {
        if (e.lines.length > 5) err(w + '.lines', '줄이 너무 많습니다 (' + e.lines.length + '줄, 5줄 이하)');
        e.lines.forEach((l, j) => rich(w + '.lines[' + j + ']', l, { max: 20, errMax: 32 }));
      }
    });
  }

  function validateBars(b, els) {
    unknownKeys('board', b, ['kind', 'axisLabel', 'axisMax', 'axisTicks', 'markers', 'elements']);
    rich('board.axisLabel', b.axisLabel, { max: 24, errMax: 36 });
    const max = b.axisMax;
    const maxOk = isNum(max) && max > 0;
    if (!maxOk) err('board.axisMax', '0 보다 큰 숫자여야 합니다 (현재 ' + fmt(max) + ')');
    if (!Array.isArray(b.axisTicks) || b.axisTicks.length < 2 || b.axisTicks.length > 12 || !b.axisTicks.every(isNum)) err('board.axisTicks', '숫자 2~12개의 배열이어야 합니다');
    else if (maxOk && b.axisTicks.some((t) => t < 0 || t > max)) err('board.axisTicks', '눈금은 0 ~ axisMax(' + max + ') 사이여야 합니다');
    if (b.markers !== undefined) {
      if (!Array.isArray(b.markers) || b.markers.length > 4) err('board.markers', '{at,label,color} 배열(4개 이하)이어야 합니다');
      else {
        b.markers.forEach((m, i) => {
          const w = 'board.markers[' + i + ']';
          if (!isObj(m)) { err(w, '객체여야 합니다'); return; }
          unknownKeys(w, m, ['at', 'label', 'color']);
          if (!isNum(m.at) || (maxOk && (m.at < 0 || m.at > max))) err(w + '.at', '0 ~ axisMax 사이 숫자여야 합니다 (현재 ' + fmt(m.at) + ')');
          rich(w + '.label', m.label, { max: 16, errMax: 26 });
          color(w + '.color', m.color);
        });
      }
    }
    if (els.length < 2 || els.length > 6) err('board.elements', '막대는 2~6개여야 합니다 (현재 ' + els.length + '개)');
    els.forEach((e, i) => {
      const w = 'board.elements[' + i + ']';
      if (!isObj(e)) { err(w, '객체여야 합니다'); return; }
      if (e.type !== 'bar') { err(w + '.type', '"bar" 여야 합니다 (현재 ' + fmt(e.type) + ')'); return; }
      if (e.count !== undefined || e.pow2 !== undefined) err(w, 'count/pow2 는 쓰지 않습니다 — amount(축 단위 길이)를 쓰세요');
      unknownKeys(w, e, ['type', 'color', 'at', 'dur', 'amount', 'label', 'value']);
      color(w + '.color', e.color);
      atField(w + '.at', e.at);
      durField(w + '.dur', e.dur, true);
      if (!isNum(e.amount) || e.amount < 0 || (maxOk && e.amount > max)) err(w + '.amount', '0 ~ axisMax(' + fmt(max) + ') 사이 숫자여야 합니다 (현재 ' + fmt(e.amount) + ')');
      rich(w + '.label', e.label, { max: 22, errMax: 34 });
      rich(w + '.value', e.value, { max: 12, errMax: 20 });
    });
  }

  /* ---------- 전체 구조 ---------- */
  if (opts.strictStructure) {
    file = '';
    const ids = steps.map((s) => (isObj(s) ? s.id : undefined));
    if (ids.length !== EXPECTED_IDS.length || EXPECTED_IDS.some((id, i) => ids[i] !== id)) {
      err('steps', '단계는 ' + EXPECTED_IDS.length + '개이며 순서가 ' + EXPECTED_IDS.join(', ') + ' 여야 합니다 (현재 ' + ids.join(', ') + ')');
    }
  }

  /* ---------- 글리프 ---------- */
  if (opts.glyphs) {
    for (const m of missingGlyphs(out.texts, [opts.glyphs])) {
      const [fileName, ...rest] = m.where.split(' ');
      const hasFile = /\.json$/.test(fileName);
      errors.push({
        file: hasFile ? fileName : '',
        where: hasFile ? rest.join(' ') : m.where,
        msg: '내장 글꼴(NanumPenScript, QMath)에 없는 글자 ' + m.code + ' "' + m.char + '" — 허용 글자 집합은 content/SCHEMA.md 의 \'글꼴·글자 집합\' 을 보세요 (유니코드 첨자 대신 ^{ }/_{ }, 곡선 따옴표 대신 ASCII 따옴표 등)',
      });
    }
  }
  return out;
}

/** 오류/경고 한 건을 한 줄 문자열로 */
export const formatIssue = (i) => (i.file ? 'content/' + i.file : '장면') + (i.where ? ' › ' + i.where : '') + ' — ' + i.msg;

/** 오류를 사람이 읽기 좋은 한 덩어리 문자열로 */
export function formatProblems(list, title) {
  return title + ' (' + list.length + '건)\n - ' + list.join('\n - ');
}

/**
 * 폴더 하나를 읽어 검증합니다 (CLI 와 build.mjs 가 같이 씁니다).
 * 반환: { loaded, scene, errors, warnings, perFile: Map(file -> {errors, warnings}), pending, unexpected, texts }
 */
export function validateDir(dir, opts = {}) {
  const loaded = loadContent(dir, { free: !!opts.free });
  const fonts = opts.glyphs === false ? null : loadFonts(opts.root || ROOT);
  const glyphs = fonts && !fonts.error ? fonts.union : null;
  const problems = loaded.problems.map((m) => ({ file: '', where: '', msg: m, raw: true }));
  if (fonts && fonts.error) problems.push({ file: '', where: '', msg: fonts.error });
  const files = loaded.steps.map((s) => s.file);
  const base = loaded.meta ? Object.assign({}, loaded.meta, { steps: loaded.steps.map((s) => s.step) }) : { steps: loaded.steps.map((s) => s.step) };
  const strictStructure = !!opts.strict && !opts.free && loaded.pending.length === 0;
  const result = validateLesson(base, { files, glyphs, noMeta: !loaded.meta, strictStructure });
  const errors = [...problems, ...result.errors];
  if (opts.strict) {
    for (const f of loaded.pending) errors.push({ file: '', where: '', msg: '--strict: 파일이 없습니다: content/' + f });
    for (const f of loaded.unexpected) errors.push({ file: '', where: '', msg: '--strict: 예상 목록에 없는 파일입니다: content/' + f });
  }
  return { loaded, scene: loaded.meta ? base : null, errors, warnings: result.warnings, pending: loaded.pending, unexpected: loaded.unexpected, texts: result.texts, ids: result.ids };
}

/* ---------------------------------------------------------------------
 * CLI
 * ------------------------------------------------------------------- */
function main() {
  const argv = process.argv.slice(2);
  let dir = path.join(ROOT, 'content');
  let strict = false;
  let free = false;
  let quiet = false;
  const only = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--strict') strict = true;
    else if (a === '--free') free = true;
    else if (a === '--quiet' || a === '-q') quiet = true;
    else if (a === '--dir') { dir = path.resolve(argv[++i] || ''); free = true; }
    else if (a === '-h' || a === '--help') {
      console.log('사용법: node validate.mjs [--strict] [--quiet] [--dir DIR] [content/NN-id.json ...]\n  --strict  14단계 + 00-meta 가 모두 있어야 통과\n  --dir DIR 다른 폴더(시험용 fixture 등)를 검사합니다. 14단계 표 대신 그 폴더의 NN-id.json 을 모두 기대 파일로 봅니다(--free)\n  파일 인자  그 파일의 오류·경고만 보여 줍니다');
      return;
    } else if (a.startsWith('-')) { console.error('알 수 없는 옵션: ' + a); process.exitCode = 2; return; }
    else only.push(path.basename(a));
  }
  const r = validateDir(dir, { strict, free });
  const shownFile = (f) => only.length === 0 || only.includes(f) || f === '';
  const errors = r.errors.filter((e) => shownFile(e.file));
  const warnings = r.warnings.filter((w) => shownFile(w.file));
  const files = [META_FILE, ...r.loaded.steps.map((s) => s.file)].filter((f) => (f === META_FILE ? r.loaded.meta : true));
  console.log('양자물리학 강의 내용 검사 — ' + path.relative(process.cwd(), dir) + '/');
  for (const f of files) {
    if (only.length && !only.includes(f)) continue;
    const e = r.errors.filter((x) => x.file === f).length;
    const w = r.warnings.filter((x) => x.file === f).length;
    console.log('  ' + (e ? '✗' : '✓') + ' ' + f + (e ? '  오류 ' + e : '') + (w ? '  경고 ' + w : ''));
  }
  const pendingShown = r.pending.filter((f) => only.length === 0 || only.includes(f));
  if (pendingShown.length && !quiet) console.log('  … 대기 중(pending): ' + pendingShown.join(', '));
  if (!quiet && warnings.length) {
    console.log('\n경고 ' + warnings.length + '건');
    for (const w of warnings) console.log(' - ' + formatIssue(w));
  }
  if (errors.length) {
    console.log('\n오류 ' + errors.length + '건');
    for (const e of errors) console.log(' - ' + (e.raw ? e.msg : formatIssue(e)));
  }
  const presentCount = r.loaded.steps.length + (r.loaded.meta ? 1 : 0);
  console.log('\n' + (errors.length ? '실패' : '통과') + ': 파일 ' + presentCount + '개 검사, 오류 ' + errors.length + ', 경고 ' + warnings.length + ', 대기 중 ' + r.pending.length + (strict ? ' (--strict)' : ''));
  if (errors.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
