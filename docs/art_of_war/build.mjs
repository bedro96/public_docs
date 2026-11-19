#!/usr/bin/env node
// 손자병법 칠판 강의 빌드: art-of-war.scene.json  ->  art-of-war.html (단일 파일, 오프라인)
//
//   node build.mjs             장면 파일을 검증하고 art-of-war.html 을 다시 만든다
//   node build.mjs --verify    저장된 art-of-war.html 이 장면 파일과 일치하는지(최신인지) 확인한다
//   node build.mjs --scene a.scene.json --out b.html
//
// 그림(블록, 화살표, 배치)은 chalk-talk 엔진이 장면 파일로부터 그린다. 이 파일은 엔진을 그대로 호출한 뒤
// 한국어 문서에 필요한 것만 덧붙인다. 템플릿의 기준 문자열이 정확히 한 번 나오지 않으면 빌드가 실패한다.
//   1. 외부 웹폰트 링크를 지우고 시스템 한글 글꼴 스택을 쓴다 (Google Fonts 에는 한글이 없고, 오프라인에서는 못 받는다)
//   2. 조작 버튼, 단계 목록, 문서 제목의 ARIA 와 툴팁을 한국어로 바꾼다
//   3. 영상 제목·채널·19:03 링크를 담은 출처 푸터를 붙인다
//   4. 장면의 단계별 handout 으로 채워지는 '강의 노트' 서랍을 붙인다
//   5. 결과물을 점검한다: proof:false, code/calls/inferred 없음, 외부 요청 없음, 오디오 없음
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SCENE_FILE = path.join(here, 'art-of-war.scene.json');
export const OUT_FILE = path.join(here, 'art-of-war.html');

const isFile = f => { try { return fs.statSync(f).isFile(); } catch { return false; } };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ------------------------------------------------------------------ 장면 검증 */

// 이 강의는 코드 근거를 주장하지 않는다. 아래 키가 하나라도 있으면 엔진이 증명 모드를 켜 버린다.
const FORBIDDEN_KEYS = ['code', 'calls', 'inferred', 'proof', 'root'];
const HANDOUT_KEYS = ['ref', 'classic', 'limit', 'modern'];
const hasText = v => typeof v === 'string' && v.trim() !== '';

function walkKeys(v, where, visit) {
  if (Array.isArray(v)) v.forEach((x, i) => walkKeys(x, `${where}[${i}]`, visit));
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) { visit(k, `${where}.${k}`); walkKeys(x, `${where}.${k}`, visit); }
  }
}

/** 장면 파일의 약속을 검사하고 문제 목록(문자열 배열)을 돌려준다. 비어 있으면 통과. */
export function validateScene(scene) {
  const bad = [];
  if (!scene || typeof scene !== 'object') return ['장면이 JSON 객체가 아닙니다'];
  if (scene.proof !== false) bad.push('"proof": false 여야 합니다 (코드 근거를 주장하지 않는 개념 강의)');
  for (const [k, v] of Object.entries(scene)) {
    if (k === 'proof') continue;
    walkKeys({ [k]: v }, '장면', (key, where) => { if (FORBIDDEN_KEYS.includes(key)) bad.push(`${where}: "${key}" 키는 쓸 수 없습니다`); });
  }
  if (scene.lang !== 'ko') bad.push('"lang": "ko" 여야 합니다');
  if (scene.style !== 'chalk') bad.push('"style": "chalk" 여야 합니다');
  if (!hasText(scene.title)) bad.push('title 이 없습니다');

  const steps = Array.isArray(scene.steps) ? scene.steps : [];
  if (steps.length < 4 || steps.length > 8) bad.push(`단계는 4~8개여야 합니다 (현재 ${steps.length}개)`);
  if (!steps.some(s => s && s.recap === true)) bad.push('recap 단계가 없습니다');
  steps.forEach((s, i) => {
    const at = `steps[${i}]`;
    if (!s || !hasText(s.title) || !hasText(s.say)) bad.push(`${at}: title 과 say 가 필요합니다`);
    const h = s && s.handout;
    if (!h || typeof h !== 'object') { bad.push(`${at}: handout(강의 노트)이 없습니다`); return; }
    for (const k of HANDOUT_KEYS) if (!hasText(h[k])) bad.push(`${at}.handout.${k}: 비어 있습니다`);
    // 영상 구간·챕터 링크 같은 키는 영상 내용을 확인하지 못한 상태에서 출처를 암시하므로 막는다.
    for (const k of Object.keys(h)) if (!HANDOUT_KEYS.includes(k)) bad.push(`${at}.handout.${k}: 허용되지 않는 키입니다 (${HANDOUT_KEYS.join(', ')}만 사용)`);
  });

  const src = scene.source;
  if (!src || typeof src !== 'object') { bad.push('source 가 없습니다'); return bad; }
  for (const k of ['title', 'channel', 'channelUrl', 'url', 'at']) if (!hasText(src[k])) bad.push(`source.${k}: 비어 있습니다`);
  if (JSON.stringify(src.verified) !== JSON.stringify(['title', 'channel'])) bad.push('source.verified 는 ["title", "channel"] 이어야 합니다 (영상에서 확인한 것은 제목과 채널뿐)');
  try {
    const v = new URL(src.url), c = new URL(src.channelUrl);
    if (v.protocol !== 'https:' || v.hostname !== 'www.youtube.com' || v.pathname !== '/watch' || !v.searchParams.get('v')) bad.push('source.url 은 https://www.youtube.com/watch?v=… 형태여야 합니다');
    if (c.protocol !== 'https:' || c.hostname !== 'www.youtube.com' || !c.pathname.startsWith('/@')) bad.push('source.channelUrl 은 https://www.youtube.com/@… 형태여야 합니다');
    const t = /^(\d+)s?$/.exec(v.searchParams.get('t') || '');
    const m = /^(\d+):([0-5]\d)$/.exec(src.at || '');
    if (!t || !m) bad.push('source.url 의 t=…s 와 source.at(MM:SS)이 필요합니다');
    else if (+t[1] !== +m[1] * 60 + +m[2]) bad.push(`source.at(${src.at})과 source.url 의 t=${t[1]}s 가 같은 시각이 아닙니다`);
  } catch { bad.push('source.url / source.channelUrl 이 올바른 URL 이 아닙니다'); }
  return bad;
}

/* ------------------------------------------------------------------ chalk-talk 엔진 */

/** 엔진 위치: CHALK_TALK_DIR → 저장소 .github/skills → ~/.agents/skills. 심볼릭 링크는 실제 경로로 푼다. */
export function findEngine(env = process.env) {
  const repoRoot = path.resolve(here, '..', '..');
  const tried = [env.CHALK_TALK_DIR, path.join(repoRoot, '.github', 'skills', 'chalk-talk'), path.join(os.homedir(), '.agents', 'skills', 'chalk-talk')].filter(Boolean);
  for (const dir of tried) {
    try {
      const real = fs.realpathSync(dir);
      if (isFile(path.join(real, 'scripts', 'build.mjs')) && isFile(path.join(real, 'assets', 'template.html'))) return real;
    } catch { /* 다음 후보 */ }
  }
  throw new Error('chalk-talk 엔진을 찾지 못했습니다. CHALK_TALK_DIR 로 위치를 알려 주세요. 찾아 본 곳:\n  ' + tried.join('\n  '));
}

function stockBuild(engineDir, scenePath) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aow-stock-'));
  try {
    const out = path.join(dir, 'stock.out');
    execFileSync(process.execPath, [path.join(engineDir, 'scripts', 'build.mjs'), scenePath, out], {
      env: { ...process.env, CHALK_SHARE: '1' }, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8',
    });
    return fs.readFileSync(out, 'utf8');
  } catch (err) {
    throw new Error('엔진 빌드 실패: ' + String(err.stderr || err.message).trim());
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/* ------------------------------------------------------------------ 한국어 화면 구성 */

// 시스템 한글 글꼴만 쓴다. 외부 글꼴 파일도, 글꼴 임베드도 없다.
const SANS = '"Pretendard Variable",Pretendard,"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR","Noto Sans CJK KR","NanumBarunGothic","Nanum Barun Gothic","NanumGothic",system-ui,sans-serif';
const MONO = 'ui-monospace,"SF Mono","Cascadia Mono",Menlo,Consolas,"Noto Sans Mono CJK KR","NanumGothicCoding",monospace';
const FONT_MARK = '/* 한글 글꼴 */';

const CSS = `
${FONT_MARK}
[data-style="chalk"]{
  --hand:${SANS}; --sans:var(--hand); --display:var(--hand); --mono:${MONO};
  --sub-f:var(--hand); --packet-f:var(--hand); --tag-f:var(--hand); --eyebrow-f:var(--hand); --group-f:var(--hand);
  --sub-s:13px; --sub-lh:16px; --packet-s:13px; --tag-s:12px; --tag-ls:.02em; --eyebrow-ls:.08em; --group-ls:.04em;
}
.txt h2,.txt p,.mtitle,.src,.notes{word-break:keep-all; overflow-wrap:break-word}

/* 화면 크기: 아래에 출처 푸터가 보일 자리를 남긴다 */
.app{width:min(100%, calc((100vh - 200px) * 16 / 9))}
.src{width:min(100%, calc((100vh - 200px) * 16 / 9)); min-width:min(100%, 640px); margin:0 auto; padding:2px 16px 4px; font:400 12.5px/1.6 var(--ui-f); color:var(--ink-2)}
.src p{margin:0; max-width:110ch; text-wrap:pretty}
.src a{color:var(--accent); text-underline-offset:.2em}
.src a:hover{color:var(--ink)}
.src a:focus-visible{outline:2px solid var(--accent); outline-offset:2px; border-radius:3px}
.credit{position:static; display:block; width:min(100%, calc((100vh - 200px) * 16 / 9)); min-width:min(100%, 640px); margin:0 auto; padding:0 16px 14px; text-align:right; opacity:1}
@media (max-width:720px){.src{padding:2px 16px 8px}.credit{display:none}}

/* 강의 노트 서랍 */
.ctl .notes-btn{width:auto; padding:0 13px; font:600 14px/1 var(--ui-f); white-space:nowrap}
.notes{position:fixed; top:12px; right:12px; bottom:12px; width:min(420px, calc(100vw - 24px)); display:flex; flex-direction:column;
  background:var(--card); color:var(--ink); border:1px solid var(--line-2); border-radius:14px; box-shadow:0 18px 60px rgba(0,0,0,.28);
  transform:translateX(calc(100% + 24px)); visibility:hidden; transition:transform .32s cubic-bezier(.2,.7,.3,1), visibility 0s linear .32s; z-index:6}
.notes.open{transform:none; visibility:visible; transition:transform .32s cubic-bezier(.2,.7,.3,1)}
.notes header{display:flex; align-items:center; gap:10px; padding:14px 14px 12px 18px; border-bottom:1px solid var(--line)}
.notes-t{flex:1; min-width:0; display:flex; flex-direction:column; gap:2px}
.notes-t strong{font:700 17px/1.3 var(--ui-f)}
.notes-t span{font:400 13px/1.4 var(--ui-f); color:var(--ink-2)}
.notes-x{all:unset; cursor:pointer; padding:7px 12px; border-radius:8px; border:1px solid var(--line-2); font:600 13.5px/1.2 var(--ui-f); color:var(--ink)}
.notes-x:hover{border-color:var(--ink-2)}
.notes-x:focus-visible,.notes-body:focus-visible,.notes-btn:focus-visible{outline:2px solid var(--accent); outline-offset:3px}
.notes-body{flex:1; overflow:auto; padding:16px 18px 8px}
.notes-body h3{margin:0 0 14px; font:700 20px/1.35 var(--ui-title-f); color:var(--accent)}
.notes-body section{margin:0 0 16px}
.notes-body h4{margin:0 0 4px; font:700 13.5px/1.4 var(--ui-f); letter-spacing:.02em; color:var(--ink-2)}
.notes-body p{margin:0; font:400 16px/1.65 var(--ui-f); color:var(--ink)}
.notes-body .lim{padding-left:12px; border-left:3px solid var(--warn)}
.notes-foot{margin:0; padding:10px 18px 14px; border-top:1px solid var(--line); font:400 12.5px/1.55 var(--ui-f); color:var(--ink-2)}
@media (min-width:1100px){body.notes-open{padding-right:444px}}
@media (prefers-reduced-motion:reduce){.notes,.notes.open{transition:none}}
@media print{.notes,.notes-btn{display:none}}
`;

const TEXT = {
  desc: '손자병법 13편을 묻고, 따지고, 덜 상하는 길을 고르고, 멈출 줄 아는 하나의 판단 흐름으로 풀어 보는 8단계 칠판 강의입니다. 인문학이랑의 영상에서 영감을 받은 일반 개요입니다.',
  credit: '칠판 강의 · chalk-talk',
  notesBtn: '강의 노트', notesTip: '강의 노트 열기/닫기 (N)',
};

// [찾을 문자열, 바꿀 문자열, 이름]: 템플릿에 정확히 한 번 있어야 한다.
const UI_SWAPS = [
  ['<html lang="en" data-style="studio" data-theme="light">', '<html lang="ko" data-style="studio" data-theme="light">', 'html lang'],
  ['aria-label="Steps"', 'aria-label="강의 단계"', 'Steps'],
  ['aria-label="Step list"', 'aria-label="단계 목록"', 'Step list'],
  ['aria-label="Previous step" title="Previous (←)"', 'aria-label="이전 단계" title="이전 (←)"', 'prev'],
  ['aria-label="Play" title="Play (P)"', 'aria-label="재생" title="재생 (P)"', 'play'],
  ['aria-label="Next step" title="Next (→ / space)"', 'aria-label="다음 단계" title="다음 (→ / 스페이스)"', 'next'],
  ['aria-label="Proof view: which arrows are backed by code" aria-pressed="false" title="Proof view (V)"', 'aria-label="근거 보기: 화살표가 코드로 뒷받침되는지" aria-pressed="false" title="근거 보기 (V)"', 'proof'],
  ['aria-label="Before / after the change" aria-pressed="false" title="Before / after (D)"', 'aria-label="변경 전/후 보기" aria-pressed="false" title="변경 전/후 (D)"', 'diff'],
  ['aria-label="Source code"', 'aria-label="소스 코드"', 'Source code'],
  ['aria-label="Close code" title="Close (Esc)"', 'aria-label="코드 닫기" title="닫기 (Esc)"', 'Close code'],
  ["$('play').setAttribute('aria-label', 'Pause')", "$('play').setAttribute('aria-label', '일시정지')", 'JS pause'],
  ["$('play').setAttribute('aria-label', 'Play')", "$('play').setAttribute('aria-label', '재생')", 'JS play'],
  ["`Step ${i + 1}${st.title ? ': ' + st.title : ''}`", "`${i + 1}단계${st.title ? ': ' + st.title : ''}`", 'JS step label'],
  ['b.title = st.title || `Step ${i + 1}`', 'b.title = st.title || `${i + 1}단계`', 'JS step title'],
  ["+ 'Before / after (D)'", "+ '변경 전/후 (D)'", 'JS diff tip'],
];

function once(html, find, repl, name) {
  const parts = html.split(find);
  if (parts.length !== 2) throw new Error(`템플릿 기준 문자열 "${name}"이(가) ${parts.length - 1}번 나옵니다 (1번이어야 함). chalk-talk 템플릿이 바뀌었는지 확인하세요.`);
  return parts[0] + repl + parts[1];
}

/** once() 와 같지만 정확히 count 번 나와야 하는 문자열을 모두 바꾼다. */
function exactly(html, find, repl, count, name) {
  const parts = html.split(find);
  if (parts.length !== count + 1) throw new Error(`템플릿 기준 문자열 "${name}"이(가) ${parts.length - 1}번 나옵니다 (${count}번이어야 함). chalk-talk 템플릿이 바뀌었는지 확인하세요.`);
  return parts.join(repl);
}

const footerHtml = s => `<footer class="src" aria-label="출처">
  <p>출처: <a href="${esc(s.channelUrl)}" target="_blank" rel="noopener noreferrer">${esc(s.channel)}</a>의 영상 <a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">〈${esc(s.title)}〉</a>(링크는 ${esc(s.at)} 위치로 열립니다)에서 영감을 받은 손자병법 일반 개요입니다.
  영상에서 확인한 것은 제목과 채널뿐이며, 이 페이지의 설명을 영상 속 발언이나 ${esc(s.at)} 구간의 내용으로 소개하지 않습니다.</p>
</footer>`;

const notesHtml = `<aside id="notes" class="notes" aria-labelledby="notes-title" inert>
  <header>
    <div class="notes-t"><strong id="notes-title" tabindex="-1">강의 노트</strong><span id="notes-step"></span></div>
    <button type="button" id="notes-close" class="notes-x" title="닫기 (Esc)">닫기</button>
  </header>
  <div id="notes-body" class="notes-body" tabindex="0" role="region" aria-label="단계별 강의 노트"></div>
  <p class="notes-foot">손자병법 원전을 바탕으로 한 일반 해설이며, 영상 속 발언을 옮긴 것이 아닙니다. '현대적 해석'은 이해를 돕기 위한 적용 예입니다.</p>
</aside>`;

// 서랍은 장면 JSON 의 steps[k].handout 만 읽어 그린다. 문자열은 textContent 로만 넣는다.
const notesScript = `<script>
(() => {
'use strict';
const scene = JSON.parse(document.getElementById('scene').textContent);
const steps = Array.isArray(scene.steps) ? scene.steps : [];
const $ = id => document.getElementById(id);
const btn = $('notes-btn'), panel = $('notes'), body = $('notes-body'), label = $('notes-step');
const SECTIONS = [['classic', '원문과 풀이', ''], ['limit', '읽을 때 주의할 점', 'lim'], ['modern', '현대적 해석', '']];
const make = (tag, text, cls) => { const e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e; };
let shown = 0;
function render(k) {
  if (k === shown) return;
  shown = k;
  const st = steps[k - 1], h = st && st.handout;
  body.replaceChildren();
  label.textContent = st ? k + ' / ' + steps.length + '단계 · ' + st.title : '';
  if (!h) return;
  body.appendChild(make('h3', h.ref));
  for (const [key, title, cls] of SECTIONS) {
    if (!h[key]) continue;
    const s = make('section'); s.appendChild(make('h4', title)); s.appendChild(make('p', h[key], cls)); body.appendChild(s);
  }
  body.scrollTop = 0;
}
const sync = () => render(parseInt($('n').textContent, 10) || 1);
const isOpen = () => panel.classList.contains('open');
function setOpen(on) {
  panel.classList.toggle('open', on); panel.inert = !on;
  document.body.classList.toggle('notes-open', on);
  btn.setAttribute('aria-expanded', String(on));
  if (on) { sync(); $('notes-title').focus({ preventScroll: true }); } else if (panel.contains(document.activeElement)) btn.focus();
}
btn.addEventListener('click', () => setOpen(!isOpen()));
$('notes-close').addEventListener('click', () => setOpen(false));
// 서랍 안의 스페이스·PageDown 등은 스크롤과 버튼 동작에 쓰고, 강의 단계 이동으로 새어 나가지 않게 한다.
const KEEP = [' ', 'Enter', 'PageDown', 'PageUp', 'Home', 'End', 'j', 'k'];
for (const e of [panel, btn]) e.addEventListener('keydown', ev => { if (KEEP.includes(ev.key)) ev.stopPropagation(); });
document.addEventListener('keydown', ev => {
  if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
  if (ev.key === 'Escape' && isOpen()) setOpen(false);
  else if (ev.key === 'n' || ev.key === 'N') setOpen(!isOpen());
});
new MutationObserver(sync).observe($('n'), { childList: true, characterData: true, subtree: true });
sync();
if (new URLSearchParams(location.search).has('notes')) setOpen(true);
})();
</script>
`;

/** 검증된 장면 JSON 문자열로 최종 HTML 을 만든다. */
export function buildPage(sceneRaw, { engineDir = findEngine() } = {}) {
  const scene = JSON.parse(sceneRaw);
  const bad = validateScene(scene);
  if (bad.length) throw new Error('장면 검증 실패:\n  - ' + bad.join('\n  - '));

  // 엔진은 파일 경로를 받는다. 임시 폴더에 장면을 두고 돌린다(저장소에 .html 이 새로 생기지 않게 한다).
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aow-scene-'));
  let html;
  try {
    const p = path.join(tmp, 'art-of-war.scene.json');
    fs.writeFileSync(p, sceneRaw);
    html = stockBuild(engineDir, p);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }

  // 1. 외부 웹폰트: 링크 3줄과 설명 주석을 지운다.
  const fontLinks = /<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\n<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\n<!--[^\n]*-->\n<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/[^"]*">\n/;
  if (html.split(fontLinks).length !== 2) throw new Error('템플릿의 Google Fonts 링크 블록을 찾지 못했습니다. chalk-talk 템플릿이 바뀌었는지 확인하세요.');
  html = html.replace(fontLinks, () => '');
  // 템플릿 기본값에 남은 Geist 글꼴 이름(오프라인에서는 받을 수 없다)도 한글 시스템 스택으로 바꾼다.
  html = exactly(html, '--sans:"Geist","Inter",system-ui,-apple-system,"Segoe UI",sans-serif;', `--sans:${SANS};`, 1, 'default sans');
  html = exactly(html, '--mono:"Geist Mono",ui-monospace,"SF Mono",Menlo,Consolas,monospace;', `--mono:${MONO};`, 2, 'default mono');
  // 템플릿의 기본(studio) 스타일은 이 강의에서 쓰이지 않지만 muted 색이 밝은 바탕에서 대비 2.5:1 이라 정적 검사에 걸린다. 같은 줄의 --edge 색으로 맞춘다.
  html = once(html, '--muted:#A1A1AA; --edge:#71717A;', '--muted:#71717A; --edge:#71717A;', 'studio muted');
  html = once(html, '</style>', CSS + '</style>', 'style end');

  // 2. 한국어 UI 와 문서 제목.
  for (const [find, repl, name] of UI_SWAPS) html = once(html, find, repl, name);
  html = once(html, '<title>Chalk Talk</title>', `<title>${esc(scene.title)}</title>\n<meta name="description" content="${esc(TEXT.desc)}">`, 'title');
  html = once(html, '<h1 class="sr" id="sr-title">Chalk Talk</h1>', `<h1 class="sr" id="sr-title">${esc(scene.title)}${scene.subtitle ? ' - ' + esc(scene.subtitle) : ''}</h1>`, 'sr-title');

  // 3. 서랍 버튼, 푸터, 서랍.
  html = once(html, '<button id="theme" aria-label="Switch light / dark" title="Light / dark (T)">',
    `<button type="button" id="notes-btn" class="notes-btn" aria-controls="notes" aria-expanded="false" title="${TEXT.notesTip}">${TEXT.notesBtn}</button>\n        <button id="theme" aria-label="밝은 화면과 어두운 화면 전환" title="밝게 / 어둡게 (T)">`, 'theme button');
  html = once(html, '<span class="credit">chalk-talk</span>', `${footerHtml(scene.source)}\n<span class="credit">${TEXT.credit}</span>\n${notesHtml}`, 'credit');
  html = once(html, '</body>', notesScript + '</body>', 'body end');

  const problems = auditPage(html, scene);
  if (problems.length) throw new Error('결과물 점검 실패:\n  - ' + problems.join('\n  - '));
  return html;
}

/* ------------------------------------------------------------------ 결과물 점검 */

const SCENE_BLOCK = /<script id="scene" type="application\/json">\n([\s\S]*?)\n<\/script>/;
const LEFTOVER_ENGLISH = ['aria-label="Steps"', 'aria-label="Step list"', 'aria-label="Previous step"', 'aria-label="Play"', 'aria-label="Next step"',
  'aria-label="Switch light / dark"', 'aria-label="Close code"', 'aria-label="Source code"', '<title>Chalk Talk</title>', '>Chalk Talk</h1>', "'Pause'", '`Step ${'];
const NETWORK_OR_MEDIA = [/<link[\s>]/i, /<script[^>]*\ssrc=/i, /<(?:img|iframe|object|embed|audio|video|source|track)[\s>]/i, /\bfetch\s*\(/, /XMLHttpRequest/, /sendBeacon/,
  /\bWebSocket\b/, /\bEventSource\b/, /importScripts/, /new\s+Worker\b/, /\bimport\s*\(/, /@import/i, /AudioContext/, /new\s+Audio\b/, /speechSynthesis/];

/** 최종 HTML 점검. 문제 목록을 돌려준다(비어 있으면 통과). */
export function auditPage(html, scene) {
  const bad = [];
  const m = SCENE_BLOCK.exec(html);
  if (!m) return ['장면 JSON 블록을 찾지 못했습니다'];
  let embedded;
  try { embedded = JSON.parse(m[1]); } catch (e) { return ['장면 JSON 이 올바르지 않습니다: ' + e.message]; }
  if (JSON.stringify(embedded) !== JSON.stringify(scene)) bad.push('내장된 장면이 장면 파일과 다릅니다');
  bad.push(...validateScene(embedded).map(x => '내장 장면: ' + x));

  const page = html.replace(SCENE_BLOCK, '');
  // 외부 의존성: 허용되는 주소는 SVG 네임스페이스와 출처 푸터의 두 링크(이동용, 자동 요청 아님)뿐이다.
  const allowed = new Set(['http://www.w3.org/2000/svg', esc(scene.source.url), esc(scene.source.channelUrl)]);
  for (const u of page.match(/https?:\/\/[^\s"'<>)\\]+/g) || []) if (!allowed.has(u)) bad.push(`허용되지 않은 외부 주소: ${u}`);
  if (/(?:src|href|action|poster)\s*=\s*["']?\/\//i.test(page)) bad.push('프로토콜 상대(//…) 외부 주소가 있습니다');
  for (const re of NETWORK_OR_MEDIA) if (re.test(page)) bad.push(`금지된 요소/API: ${re}`);
  if (/url\(\s*["']?(?!#)/.test(page)) bad.push('url(#…) 이외의 url() 참조가 있습니다');
  const anchors = page.match(/<a\s[^>]*href=/g) || [];
  if (anchors.length !== 2) bad.push(`푸터 링크는 영상·채널 2개여야 합니다 (현재 ${anchors.length}개)`);
  for (const a of page.match(/<a\s[^>]*>/g) || []) if (!/target="_blank"/.test(a) || !/rel="noopener noreferrer"/.test(a)) bad.push(`새 창 링크에 rel="noopener noreferrer" 가 없습니다: ${a}`);

  for (const s of LEFTOVER_ENGLISH) if (page.includes(s)) bad.push(`영어 UI 문자열이 남아 있습니다: ${s}`);
  if (!page.includes('<html lang="ko"')) bad.push('<html lang="ko"> 가 아닙니다');
  if (!page.includes(`<title>${esc(scene.title)}</title>`)) bad.push('<title> 이 장면 제목과 다릅니다');
  if (!page.includes(`id="sr-title">${esc(scene.title)}`)) bad.push('제목 ARIA(sr-title)가 한국어 제목이 아닙니다');
  if (!/<button id="proof"[^>]*\shidden/.test(page)) bad.push('증거 보기 버튼이 숨겨져 있어야 합니다');
  if (page.indexOf(FONT_MARK) < page.indexOf('--hand:"Patrick Hand"')) bad.push('한글 글꼴 규칙이 템플릿 기본 글꼴보다 앞에 있습니다');
  if (/Geist/.test(page)) bad.push('받을 수 없는 Geist 글꼴 이름이 남아 있습니다');
  for (const id of ['notes', 'notes-btn', 'notes-body', 'notes-close']) if (!page.includes(`id="${id}"`)) bad.push(`#${id} 가 없습니다`);
  if (!page.includes('class="src"')) bad.push('출처 푸터가 없습니다');
  return bad;
}

/* ------------------------------------------------------------------ 실행 */

function main(argv) {
  const opt = { scene: SCENE_FILE, out: OUT_FILE, verify: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--verify') opt.verify = true;
    else if (argv[i] === '--scene' && argv[i + 1]) opt.scene = path.resolve(argv[++i]);
    else if (argv[i] === '--out' && argv[i + 1]) opt.out = path.resolve(argv[++i]);
    else throw new Error(`알 수 없는 인자: ${argv[i]}\n사용법: node build.mjs [--verify] [--scene 파일] [--out 파일]`);
  }
  if (!isFile(opt.scene)) throw new Error('장면 파일이 없습니다: ' + opt.scene);
  const sceneRaw = fs.readFileSync(opt.scene, 'utf8');
  const html = buildPage(sceneRaw);
  if (opt.verify) {
    if (!isFile(opt.out) || fs.readFileSync(opt.out, 'utf8') !== html) throw new Error(`${path.basename(opt.out)} 이(가) 장면 파일과 다릅니다. node build.mjs 로 다시 만드세요.`);
    console.log(`확인: ${path.basename(opt.out)} 은(는) 최신입니다`);
    return;
  }
  fs.writeFileSync(opt.out, html);
  const s = JSON.parse(sceneRaw);
  console.log(`${opt.out}\n${(Buffer.byteLength(html) / 1024).toFixed(0)} KB · ${s.steps.length}단계 · 노드 ${s.nodes.length} · 간선 ${s.edges.length} · proof:false · 외부 의존성 없음`);
}

const entry = process.argv[1] && (() => { try { return fs.realpathSync(path.resolve(process.argv[1])); } catch { return null; } })();
if (entry && entry === fs.realpathSync(fileURLToPath(import.meta.url))) {
  try { main(process.argv.slice(2)); } catch (err) { console.error('build: ' + err.message); process.exit(1); }
}
