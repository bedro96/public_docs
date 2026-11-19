#!/usr/bin/env node
/* 타원곡선 칠판 강의 빌드.
 *
 *   node build.mjs          -> elliptic-curve.html (글꼴·스타일·장면·수학·재생기를 모두 넣은 단일 파일)
 *
 * 빌드는 아래 중 하나라도 어긋나면 실패합니다. 빌드가 끝났다는 것은 곧 "검사를 통과했다"는 뜻입니다.
 *   - 장면 JSON 형식 오류, 알 수 없는 요소/색/방향, 존재하지 않는 점 참조
 *   - 장면의 모든 수학 값(점 좌표, 접선, 위수 등)이 정확 연산(ecmath.js)과 다름
 *   - 서식 토큰(^{ } _{ } ** **) 오류, 풀리지 않은 [[점]] 자리표시자
 *   - 칠판(Canvas)에 그려질 글자가 내장 글꼴에 없음 (조용히 빈 네모가 되는 것을 막습니다)
 *   - 외부 URL / 외부 글꼴 / 네트워크 호출 / innerHTML 같은 위험한 코드
 *   - 이 폴더에 elliptic-curve.html 말고 다른 .html(템플릿 제외)이 있음
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const EC = require('./ecmath.js');

export const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const OUTPUT_NAME = 'elliptic-curve.html';
export const TEMPLATE_NAME = 'template.html';
export const SCHEMA = 'elliptic-curve-lesson/1';

const DIRS = ['ul', 'ur', 'dl', 'dr', 'u', 'd', 'l', 'r'];
const SIZES = ['xl', 'l', 'm', 's'];
const LEGEND_STYLES = ['line', 'dot', 'dash', 'bar', 'box'];
const TONES = ['analogy', 'real'];
const CALLOUT_TONES = ['info', 'warn', 'ok'];

const ELEMENTS = {
  plane: ['axes', 'curve', 'point', 'line', 'tangent', 'link'],
  finite: ['axes', 'dots', 'orbit', 'point', 'hline'],
  bars: ['bar'],
  flow: ['node'],
  chalk: [],
};

/* ---------------------------------------------------------------------
 * TTF cmap 읽기 (형식 4, 12): 글꼴이 실제로 가진 글자 집합
 * ------------------------------------------------------------------- */
export function loadCmap(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const numTables = dv.getUint16(4);
  let cmapOff = -1;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    const tag = String.fromCharCode(dv.getUint8(rec), dv.getUint8(rec + 1), dv.getUint8(rec + 2), dv.getUint8(rec + 3));
    if (tag === 'cmap') cmapOff = dv.getUint32(rec + 8);
  }
  if (cmapOff < 0) throw new Error('글꼴에 cmap 표가 없습니다');
  const subCount = dv.getUint16(cmapOff + 2);
  const set = new Set();
  for (let i = 0; i < subCount; i++) {
    const off = cmapOff + dv.getUint32(cmapOff + 4 + i * 8 + 4);
    const format = dv.getUint16(off);
    if (format === 4) {
      const segX2 = dv.getUint16(off + 6);
      const endO = off + 14;
      const startO = endO + segX2 + 2;
      const deltaO = startO + segX2;
      const rangeO = deltaO + segX2;
      for (let s = 0; s < segX2 / 2; s++) {
        const end = dv.getUint16(endO + s * 2);
        const start = dv.getUint16(startO + s * 2);
        const delta = dv.getInt16(deltaO + s * 2);
        const rOff = dv.getUint16(rangeO + s * 2);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          let g;
          if (rOff === 0) g = (c + delta) & 0xffff;
          else {
            g = dv.getUint16(rangeO + s * 2 + rOff + (c - start) * 2);
            if (g !== 0) g = (g + delta) & 0xffff;
          }
          if (g !== 0) set.add(c);
        }
      }
    } else if (format === 12) {
      const groups = dv.getUint32(off + 12);
      for (let g = 0; g < groups; g++) {
        const start = dv.getUint32(off + 16 + g * 12);
        const end = dv.getUint32(off + 20 + g * 12);
        const gid = dv.getUint32(off + 24 + g * 12);
        for (let c = start; c <= end; c++) if (gid + (c - start) !== 0) set.add(c);
      }
    }
  }
  if (set.size === 0) throw new Error('글꼴 cmap을 해석하지 못했습니다');
  return set;
}

/** 칠판에 그려질 글자 중 글꼴에 없는 것을 {char, where}[] 로 돌려줍니다. */
export function missingGlyphs(entries, cmap) {
  const missing = new Map();
  for (const { text, where } of entries) {
    for (const ch of text) {
      if (ch === ' ' || cmap.has(ch.codePointAt(0))) continue;
      if (!missing.has(ch)) missing.set(ch, where);
    }
  }
  return [...missing].map(([char, where]) => ({ char, where, code: 'U+' + char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0') }));
}

/* ---------------------------------------------------------------------
 * 장면 검증
 * ------------------------------------------------------------------- */
const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
/** 서식 토큰을 풀고 화면에 실제로 그려지는 글자만 남깁니다 (^{2} -> 2). */
const shownText = (sub) => EC.parseRich(sub).map((r) => r.text).join('');

/**
 * 장면을 검증하고 단계별 수학 결과를 풀어 돌려줍니다.
 * 반환: { errors: string[], steps: [{ resolved, timeline, chalk: [{text, where}] }] }
 */
export function validateScene(scene) {
  const errors = [];
  const err = (where, msg) => errors.push(where + ': ' + msg);
  const out = { errors, steps: [] };

  if (!scene || typeof scene !== 'object') {
    err('scene', '객체가 아닙니다');
    return out;
  }
  if (scene.schema !== SCHEMA) err('schema', '"' + SCHEMA + '" 이어야 합니다');
  if (scene.lang !== 'ko') err('lang', '"ko" 이어야 합니다');
  for (const k of ['eyebrow', 'title', 'subtitle', 'author']) if (!isStr(scene[k])) err(k, '문자열이 필요합니다');
  if (scene.ui !== undefined && (typeof scene.ui !== 'object' || !isStr(scene.ui.hint))) err('ui.hint', '문자열이 필요합니다');
  const chalk = [];
  if (scene.ui && isStr(scene.ui.hint)) chalk.push({ text: scene.ui.hint, where: 'ui.hint' });

  const checkRich = (where, text, resolved) => {
    if (!isStr(text)) { err(where, '비어 있지 않은 문자열이 필요합니다'); return null; }
    try {
      const sub = EC.substitute(text, resolved);
      EC.parseRich(sub);
      return sub;
    } catch (e) {
      err(where, e.message);
      return null;
    }
  };

  if (!Array.isArray(scene.steps) || scene.steps.length === 0) {
    err('steps', '단계가 하나 이상 필요합니다');
    return out;
  }
  const ids = new Set();

  scene.steps.forEach((step, si) => {
    const W = 'steps[' + si + ']';
    const info = { resolved: null, timeline: null, chalk: [] };
    out.steps.push(info);
    if (!step || typeof step !== 'object') { err(W, '객체가 아닙니다'); return; }

    if (!isStr(step.id) || !/^[a-z][a-z0-9-]*$/.test(step.id)) err(W + '.id', '소문자 영문/숫자/- 식별자가 필요합니다');
    else if (ids.has(step.id)) err(W + '.id', '중복된 id: ' + step.id);
    else ids.add(step.id);
    if (!isStr(step.nav)) err(W + '.nav', '문자열이 필요합니다');

    // 수학 결과
    let resolved = null;
    if (step.math !== undefined) {
      try { resolved = EC.resolveMath(step.math); } catch (e) { err(W + '.math', e.message); }
    }
    info.resolved = resolved;
    const rich = (where, text) => checkRich(W + '.' + where, text, resolved);
    const chalkText = (where, text) => {
      const sub = rich(where, text);
      if (sub !== null) info.chalk.push({ text: shownText(sub), where: W + '.' + where });
    };

    chalkText('title', step.title);
    rich('summary', step.summary);
    if (!step.tag || !TONES.includes(step.tag.tone) || !isStr(step.tag.text)) err(W + '.tag', 'tone(' + TONES.join('|') + ')과 text가 필요합니다');
    else rich('tag.text', step.tag.text);
    if (!isStr(step.alt)) err(W + '.alt', '대체 텍스트(alt)가 필요합니다');
    else rich('alt', step.alt);

    // 자막 구절
    if (!Array.isArray(step.beats) || step.beats.length === 0) err(W + '.beats', '1개 이상 필요합니다');
    else {
      let prev = -1;
      step.beats.forEach((b, bi) => {
        if (!isNum(b.at) || b.at < 0) err(W + '.beats[' + bi + '].at', '0 이상의 숫자가 필요합니다');
        else if (b.at <= prev) err(W + '.beats[' + bi + '].at', '앞 구절보다 커야 합니다');
        else prev = b.at;
        rich('beats[' + bi + '].text', b.text);
      });
    }
    if (!step.callout || !CALLOUT_TONES.includes(step.callout.tone)) err(W + '.callout', 'tone(' + CALLOUT_TONES.join('|') + ')이 필요합니다');
    else { rich('callout.title', step.callout.title); rich('callout.text', step.callout.text); }
    if (!Array.isArray(step.legend) || step.legend.length === 0) err(W + '.legend', '1개 이상 필요합니다');
    else step.legend.forEach((l, li) => {
      if (!EC.PALETTE.includes(l.color)) err(W + '.legend[' + li + '].color', '팔레트 밖의 색: ' + l.color);
      if (!LEGEND_STYLES.includes(l.style)) err(W + '.legend[' + li + '].style', LEGEND_STYLES.join('|') + ' 중 하나');
      rich('legend[' + li + '].text', l.text);
    });

    // 판서 글 (오른쪽 패널)
    if (!Array.isArray(step.panel) || step.panel.length === 0) err(W + '.panel', '1줄 이상 필요합니다');
    else step.panel.forEach((line, li) => {
      const w = 'panel[' + li + ']';
      if (!EC.PALETTE.includes(line.color)) err(W + '.' + w + '.color', '팔레트 밖의 색: ' + line.color);
      if (!SIZES.includes(line.size)) err(W + '.' + w + '.size', SIZES.join('|') + ' 중 하나');
      if (line.at !== undefined && (!isNum(line.at) || line.at < 0)) err(W + '.' + w + '.at', '0 이상의 숫자');
      chalkText(w + '.text', line.text);
    });

    // 칠판 그림
    const board = step.board;
    if (!board || !(board.kind in ELEMENTS)) {
      err(W + '.board.kind', Object.keys(ELEMENTS).join('|') + ' 중 하나');
      return;
    }
    const kind = board.kind;
    const allowed = ELEMENTS[kind];
    const needMath = kind === 'plane' || kind === 'finite';
    if (needMath && !resolved) err(W + '.math', kind + ' 칠판에는 math 블록이 필요합니다');
    if (kind === 'plane' && resolved && resolved.curve.model !== 'weierstrass') err(W + '.math', 'plane 칠판은 바이어슈트라스 곡선이 필요합니다');
    if (kind === 'finite' && resolved && resolved.F.kind !== 'F') err(W + '.math', 'finite 칠판은 유한체(F<p>)가 필요합니다');
    if (kind === 'plane') {
      const v = board.view;
      if (!v || !Array.isArray(v.x) || !Array.isArray(v.y) || v.x.length !== 2 || v.y.length !== 2 || ![...v.x, ...v.y].every(isNum) || v.x[0] >= v.x[1] || v.y[0] >= v.y[1]) {
        err(W + '.board.view', '{x:[최소,최대], y:[최소,최대]} 형식이 필요합니다');
      }
    }
    if (kind === 'bars') {
      if (!isNum(board.axisMax) || board.axisMax <= 0) err(W + '.board.axisMax', '양수가 필요합니다');
      if (!Array.isArray(board.axisTicks) || !board.axisTicks.every(isNum)) err(W + '.board.axisTicks', '숫자 배열이 필요합니다');
      if (board.axisLabel !== undefined) {
        const sub = checkRich(W + '.board.axisLabel', board.axisLabel, resolved);
        if (sub !== null) info.chalk.push({ text: shownText(sub), where: W + '.board.axisLabel' });
      }
    }
    if (kind === 'flow' && (!Number.isInteger(board.cols) || board.cols < 1 || board.cols > 4)) err(W + '.board.cols', '1~4의 정수');

    const elements = Array.isArray(board.elements) ? board.elements : [];
    if (!Array.isArray(board.elements)) err(W + '.board.elements', '배열이 필요합니다');
    const nodeIds = new Set();
    const needPoint = (where, name) => {
      if (!resolved || !(name in resolved.points)) err(where, '정의되지 않은 점: ' + name);
    };
    elements.forEach((el, ei) => {
      const w = W + '.board.elements[' + ei + ']';
      if (!allowed.includes(el.type)) { err(w + '.type', kind + ' 칠판에서 쓸 수 없는 요소: ' + el.type); return; }
      if (!isNum(el.at) || el.at < 0) err(w + '.at', '0 이상의 숫자가 필요합니다');
      if (el.dur !== undefined && (!isNum(el.dur) || el.dur <= 0)) err(w + '.dur', '양수가 필요합니다');
      if (el.color !== undefined && !EC.PALETTE.includes(el.color)) err(w + '.color', '팔레트 밖의 색: ' + el.color);
      const label = (name, text) => {
        const sub = checkRich(w + '.' + name, text, resolved);
        if (sub !== null) info.chalk.push({ text: shownText(sub), where: w + '.' + name });
      };
      switch (el.type) {
        case 'axes': break;
        case 'curve':
          if (el.label) { label('label.text', el.label.text); if (!isNum(el.label.x) || !isNum(el.label.y)) err(w + '.label', 'x, y 좌표가 필요합니다'); }
          break;
        case 'point':
          needPoint(w + '.ref', el.ref);
          if (el.label !== undefined) label('label', el.label);
          if (el.short !== undefined) {
            if (el.label === undefined) err(w + '.short', 'short는 label이 있을 때만 쓸 수 있습니다');
            else label('short', el.short);
          }
          if (el.dir !== undefined && !DIRS.includes(el.dir)) err(w + '.dir', DIRS.join('|') + ' 중 하나');
          break;
        case 'line':
          if (!Array.isArray(el.through) || el.through.length !== 2) err(w + '.through', '점 이름 2개가 필요합니다');
          else el.through.forEach((n) => needPoint(w + '.through', n));
          break;
        case 'tangent': needPoint(w + '.point', el.point); break;
        case 'link': needPoint(w + '.from', el.from); needPoint(w + '.to', el.to); break;
        case 'dots': break;
        case 'orbit': needPoint(w + '.of', el.of); break;
        case 'hline':
          if (!isNum(el.y)) err(w + '.y', '숫자가 필요합니다');
          if (el.label !== undefined) label('label', el.label);
          break;
        case 'bar':
          if ((el.count === undefined) === (el.pow2 === undefined)) err(w, 'count(문자열) 또는 pow2(숫자) 중 정확히 하나가 필요합니다');
          else if (el.count !== undefined) {
            try { EC.log2Count(el.count); } catch (e) { err(w + '.count', e.message); }
          } else if (!isNum(el.pow2)) err(w + '.pow2', '숫자가 필요합니다');
          label('label', el.label);
          label('value', el.value);
          break;
        case 'node':
          if (!isStr(el.id) || nodeIds.has(el.id)) err(w + '.id', '고유한 id가 필요합니다');
          else nodeIds.add(el.id);
          label('title', el.title);
          if (!Array.isArray(el.lines) || el.lines.length === 0) err(w + '.lines', '문자열 배열이 필요합니다');
          else el.lines.forEach((t, li) => label('lines[' + li + ']', t));
          break;
        default: break;
      }
      if (el.type !== 'axes' && el.color === undefined) err(w + '.color', '색이 필요합니다');
    });
    if (kind === 'bars' && elements.length === 0) err(W + '.board.elements', '막대가 필요합니다');
    if (kind === 'flow' && elements.length < 2) err(W + '.board.elements', '상자가 2개 이상 필요합니다');

    // 시간표 (자막 구절이 판서 끝을 넘지 않는지)
    try {
      info.timeline = EC.stepTimeline(step, (t) => EC.substitute(t, resolved));
      const lastBeat = (step.beats || []).reduce((m, b) => Math.max(m, b.at), 0);
      const subFn = (t) => EC.substitute(t, resolved);
      const lastDraw = Math.max(
        0,
        ...elements.map((e) => (isNum(e.at) ? e.at + EC.elementDuration(e, subFn) : 0)),
        ...info.timeline.panel.map((p) => p.at + p.dur),
      );
      if (lastBeat > lastDraw + 1.0) err(W + '.beats', '마지막 자막 구절(' + lastBeat + '초)이 판서가 끝나는 시각(' + lastDraw.toFixed(1) + '초)보다 1초 넘게 늦습니다');
    } catch (e) {
      err(W + '.timeline', e.message);
    }
  });

  // 오해 · 참고문헌
  if (!Array.isArray(scene.misconceptions) || scene.misconceptions.length === 0) err('misconceptions', '1개 이상 필요합니다');
  else scene.misconceptions.forEach((m, i) => { checkRich('misconceptions[' + i + '].title', m.title); checkRich('misconceptions[' + i + '].text', m.text); });
  if (!Array.isArray(scene.references) || scene.references.length === 0) err('references', '1개 이상 필요합니다');
  else scene.references.forEach((r, i) => checkRich('references[' + i + ']', r));

  for (const s of out.steps) chalk.push(...s.chalk);
  out.chalk = chalk;
  return out;
}

/* ---------------------------------------------------------------------
 * 출력 검사
 * ------------------------------------------------------------------- */
const FONT_DATA_RE = /url\(data:font\/ttf;base64,[A-Za-z0-9+/=]+\)/g;

/** 외부 자원/네트워크/위험 API 사용 흔적을 문자열 목록으로 돌려줍니다. */
export function findForbidden(html) {
  const text = html.replace(FONT_DATA_RE, 'url(data:font)');
  const problems = [];
  const rules = [
    [/https?:\/\//i, '외부 URL (http/https)'],
    [/(^|[^\w.])\/\/[a-z0-9-]+\.[a-z]{2,}\//i, '프로토콜 없는 외부 URL (//host/)'],
    [/\bwww\./i, '외부 URL (www.)'],
    [/@import\b/i, 'CSS @import'],
    [/fonts\.(googleapis|gstatic)/i, '구글 글꼴'],
    [/<[a-z][^>]*\s(?:src|href|action|poster|srcset)\s*=\s*["'](?!#|data:)/i, '외부/상대 경로 src·href'],
    [/url\(\s*["']?(?!data:|#)/i, 'data: 가 아닌 CSS url()'],
    [/\bfetch\s*\(/, 'fetch() 네트워크 호출'],
    [/XMLHttpRequest/, 'XMLHttpRequest'],
    [/\bWebSocket\b/, 'WebSocket'],
    [/\bEventSource\b/, 'EventSource'],
    [/sendBeacon/, 'sendBeacon'],
    [/importScripts/, 'importScripts'],
    [/\beval\s*\(/, 'eval()'],
    [/new\s+Function\s*\(/, 'new Function()'],
    [/\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML|document\.write\s*\(/, 'HTML 문자열 삽입 API'],
  ];
  for (const [re, label] of rules) {
    const m = re.exec(text);
    if (m) problems.push(label + ' — "' + text.slice(Math.max(0, m.index - 20), m.index + 50).replace(/\s+/g, ' ') + '"');
  }
  return problems;
}

function listHtmlFiles(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...listHtmlFiles(p));
    else if (/\.html?$/i.test(entry.name)) found.push(path.relative(ROOT, p));
  }
  return found;
}

const jsonForScript = (value) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ---------------------------------------------------------------------
 * 빌드
 * ------------------------------------------------------------------- */
export function build(opts = {}) {
  const root = opts.root || ROOT;
  const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

  let scene;
  try {
    scene = JSON.parse(read('elliptic-curve.scene.json'));
  } catch (e) {
    throw new Error('elliptic-curve.scene.json 을 읽을 수 없습니다: ' + e.message);
  }
  const result = validateScene(scene);
  const problems = [...result.errors];

  const font = fs.readFileSync(path.join(root, 'assets', 'NanumPenScript-Regular.ttf'));
  const cmap = loadCmap(font);
  for (const m of missingGlyphs(result.chalk, cmap)) {
    problems.push('글꼴에 없는 글자 ' + m.code + ' "' + m.char + '" (' + m.where + ') — ASCII 로 바꾸거나 ^{ } _{ } 토큰을 쓰세요');
  }

  const template = read(TEMPLATE_NAME);
  const styles = read('style.css');
  const ecmath = read('ecmath.js');
  const player = read('player.js');
  for (const [name, src] of [['ecmath.js', ecmath], ['player.js', player], ['style.css', styles]]) {
    if (/<\/script|<!--/i.test(src)) problems.push(name + ' 에 </script 또는 <!-- 가 있어 HTML에 넣을 수 없습니다');
  }
  // 템플릿 글자 중 칠판 글꼴(.hint-text 등)로 그려지는 것은 장면의 ui.hint 로 이미 검사합니다.
  for (const token of ['/*__STYLES__*/', '/*__ECMATH__*/', '/*__SCENE__*/', '/*__PLAYER__*/', '%%TITLE%%', '%%AUTHOR%%']) {
    if (!template.includes(token)) problems.push('template.html 에 ' + token + ' 가 없습니다');
  }
  if (problems.length) {
    const e = new Error('빌드 실패 (' + problems.length + '건)\n - ' + problems.join('\n - '));
    e.problems = problems;
    throw e;
  }

  const fontFace = '@font-face{font-family:ChalkKorean;src:url(data:font/ttf;base64,' + font.toString('base64') + ') format("truetype");font-weight:400;font-style:normal;font-display:block}\n';
  const html = template
    .replace('%%TITLE%%', () => escapeHtml(scene.title))
    .replace('%%AUTHOR%%', () => escapeHtml(scene.author))
    .replace('/*__STYLES__*/', () => fontFace + styles)
    .replace('/*__ECMATH__*/', () => ecmath)
    .replace('/*__SCENE__*/', () => 'window.LESSON_DATA = ' + jsonForScript(scene) + ';')
    .replace('/*__PLAYER__*/', () => player);

  const leftovers = html.replace(FONT_DATA_RE, '').match(/\/\*__[A-Z]+__\*\/|%%[A-Z]+%%/g);
  if (leftovers) problems.push('치환되지 않은 토큰: ' + leftovers.join(', '));
  problems.push(...findForbidden(html).map((p) => '금지된 항목: ' + p));

  const htmlFiles = listHtmlFiles(root).filter((f) => f !== TEMPLATE_NAME && f !== OUTPUT_NAME);
  if (htmlFiles.length) problems.push('이 폴더에는 ' + OUTPUT_NAME + ' 외의 HTML을 둘 수 없습니다: ' + htmlFiles.join(', '));

  if (problems.length) {
    const e = new Error('빌드 실패 (' + problems.length + '건)\n - ' + problems.join('\n - '));
    e.problems = problems;
    throw e;
  }

  const summary = scene.steps.map((s, i) => ({
    id: s.id,
    animEnd: result.steps[i].timeline.animEnd,
    holdEnd: result.steps[i].timeline.holdEnd,
  }));
  if (opts.write !== false) fs.writeFileSync(path.join(root, OUTPUT_NAME), html);
  return { html, scene, summary, stats: { bytes: Buffer.byteLength(html), glyphs: cmap.size } };
}

function main() {
  try {
    const { html, summary, stats } = build();
    const total = summary.reduce((n, s) => n + s.animEnd, 0);
    console.log('빌드 성공: ' + OUTPUT_NAME + ' (' + (Buffer.byteLength(html) / 1048576).toFixed(2) + ' MB)');
    console.log('단계 ' + summary.length + '개, 판서 합계 ' + total.toFixed(1) + '초 (속도 1배, 자동 넘김 대기 제외)');
    for (const s of summary) console.log('  - ' + s.id.padEnd(10) + ' 판서 ' + s.animEnd.toFixed(1).padStart(5) + '초 / 머무름 ' + s.holdEnd.toFixed(1).padStart(5) + '초');
    console.log('글꼴 글자 수 ' + stats.glyphs + ' · 외부 URL 0건 · 글리프 누락 0건');
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
