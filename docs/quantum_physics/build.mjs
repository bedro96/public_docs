#!/usr/bin/env node
/* 양자물리학 칠판 강의 빌드.
 *
 *   node build.mjs               -> quantum-physics.html (글꼴·스타일·장면·계산 코드·재생기·해설 MP3·분필 녹음을 모두 넣은 단일 파일)
 *   node build.mjs --no-audio    -> 해설 MP3 없이 만드는 개발용 빌드(판서 시간은 대본 길이로 추정). 내용이 일부만 있어도 됩니다. 배포용이 아닙니다.
 *   node build.mjs --check       -> 파일을 쓰지 않고 검사만
 *   node build.mjs --content DIR --audio DIR --out FILE   (시험·시연용 경로 지정)
 *
 * 내용은 content/00-meta.json + content/NN-<id>.json (파일 이름순)을 합쳐 하나의 장면으로 조립합니다(validate.mjs).
 * 배포용 빌드(--no-audio 가 아닐 때)는 14단계와 meta 가 모두 있어야 합니다.
 *
 * 빌드는 아래 중 하나라도 어긋나면 실패합니다. 빌드가 끝났다는 것은 곧 "검사를 통과했다"는 뜻입니다.
 *   - 내용 오류(validate.mjs): 필수 필드·서식 토큰·열거값·해설 길이/금지 문자·graph 수식(expr)·허용 글자 …
 *   - 칠판·화면에 그려질 글자가 내장 글꼴(NanumPenScript ∪ QMath)에 없음 (조용히 빈 네모가 되는 것을 막습니다)
 *   - 외부 URL / 외부 글꼴 / 네트워크 호출 / innerHTML / eval 같은 위험한 코드, 느슨한 CSP
 *   - 이 폴더에 quantum-physics.html 말고 다른 .html(템플릿 제외)이 있음
 *   - 소리: 해설 MP3(단계마다 1개)가 없거나 길이가 durations.json 과 다름, 대본(narration)이 바뀌어 MP3 가 오래됨(scriptSha256),
 *           목소리가 ko-KR-Haena:MAI-Voice-2 가 아님, 분필 녹음이 CC0 실제 녹음이 아님, 오디오에 URL 이 들어 있음
 *   빌드는 해설 MP3 14개 + CC0 분필 녹음 1개를 data URI 로 HTML 에 넣고, 출처 JSON 의 URL·MP3 꼬리표는 걷어 냅니다.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SCHEMA, EXPECTED_IDS, loadContent, validateDir, formatIssue, formatProblems } from './validate.mjs';
import { loadFonts } from './fonts.mjs';

const require = createRequire(import.meta.url);
const Q = require('./qmath.js');

export { SCHEMA, loadContent };
export { loadCmap, missingGlyphs } from './fonts.mjs';
export const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const OUTPUT_NAME = 'quantum-physics.html';
export const SCENE_NAME = 'quantum-physics.scene.json';
export const TEMPLATE_NAME = 'template.html';

/* ---------------------------------------------------------------------
 * 소리 (해설 MP3 + CC0 분필 녹음 1개) 내장
 *
 *   audio/<단계 id>.mp3         narrate.py 가 만든 ko-KR-Haena 해설 (24 kHz 모노 MP3)
 *   audio/durations.json        클립 길이(초)        audio/provider.json  목소리·모델·대본 해시
 *   assets/chalk-writing.mp3    실제 칠판 녹음(CC0)   assets/chalk-writing-source.json  출처(감사용, URL 포함)
 *
 * 빌드는 MP3 를 base64 data URI 로 장면에 넣습니다. 원본 JSON/MP3 파일은 고치지 않습니다.
 * 출처 JSON 의 URL 과 MP3 꼬리표(ID3)는 산출물에 넣지 않습니다.
 * ------------------------------------------------------------------- */
export const AUDIO_MIME = 'data:audio/mpeg;base64,';
export const EXPECTED_VOICE = { voice: 'ko-KR-Haena:MAI-Voice-2', model: 'MAI-Voice-2', language: 'ko-KR' };
const CLIP_MIN_SECONDS = 20; // 250자 이상 해설은 어떤 속도로도 20초보다 짧을 수 없습니다
const CHALK_MIN_SECONDS = 4; // 분필 소리는 이 녹음을 4초 안팎 조각으로 나눠 돌려 쓴다 (player.js 의 CHALK_SEGMENT_SEC)
const DURATION_TOLERANCE = 0.1;
const DRAW_OVERRUN_WARN = 1.5; // 판서가 해설보다 이만큼(초) 넘게 늦게 끝나면 경고
const URL_BYTES_RE = /https?:\/\/|\bwww\.|\bftp:\/\//i;
const MP3_BITRATES = { 1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], 2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160] };
const MP3_RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

/** 맨 앞 ID3v2 꼬리표의 전체 길이(없으면 0). */
function id3v2Length(buf, off = 0) {
  if (buf.length < off + 10 || buf.toString('latin1', off, off + 3) !== 'ID3') return 0;
  if ((buf[off + 6] | buf[off + 7] | buf[off + 8] | buf[off + 9]) & 0x80) return 0; // 동기화 안전 정수가 아님 → 꼬리표가 아님
  const size = (buf[off + 6] << 21) | (buf[off + 7] << 14) | (buf[off + 8] << 7) | buf[off + 9];
  return 10 + size + (buf[off + 5] & 0x10 ? 10 : 0);
}

/** MP3 프레임 머리 하나를 해석합니다. MPEG Layer III 가 아니면 null. */
function mp3Header(buf, off) {
  if (off + 4 > buf.length || buf[off] !== 0xff || (buf[off + 1] & 0xe0) !== 0xe0) return null;
  const ver = (buf[off + 1] >> 3) & 3; // 3: MPEG1, 2: MPEG2, 0: MPEG2.5, 1: 예약
  const layer = (buf[off + 1] >> 1) & 3; // 1: Layer III
  if (ver === 1 || layer !== 1) return null;
  const bitrate = MP3_BITRATES[ver === 3 ? 1 : 2][buf[off + 2] >> 4]; // 0(자유 형식)·15(불량) 은 거부
  const sampleRate = MP3_RATES[ver][(buf[off + 2] >> 2) & 3];
  if (!bitrate || !sampleRate) return null;
  const samples = ver === 3 ? 1152 : 576;
  const channels = (buf[off + 3] >> 6) === 3 ? 1 : 2;
  const size = Math.floor(((samples / 8) * bitrate * 1000) / sampleRate) + ((buf[off + 2] >> 1) & 1);
  return { size, sampleRate, samples, channels, ver };
}

/**
 * MP3 를 프레임 단위로 걸어 길이를 셉니다 (디코더 없이). Xing/Info 머리 프레임은 소리가 아니므로 세지 않습니다.
 * 반환: { frames, duration(초), sampleRate, channels, junkBytes(프레임 밖 바이트: 잘림·손상) }
 */
export function mp3Info(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  let off = id3v2Length(buf);
  let frames = 0;
  let samples = 0;
  let junkBytes = 0;
  let sampleRate = 0;
  let channels = 0;
  let first = true;
  while (off < buf.length) {
    const h = mp3Header(buf, off);
    if (!h || off + h.size > buf.length) {
      if (buf.length - off === 128 && buf.toString('latin1', off, off + 3) === 'TAG') break; // ID3v1 은 프레임이 아니다
      junkBytes++;
      off++;
      continue;
    }
    if (first) {
      first = false;
      const side = h.ver === 3 ? (h.channels === 1 ? 17 : 32) : h.channels === 1 ? 9 : 17;
      const tag = buf.toString('latin1', off + 4 + side, off + 8 + side);
      if (tag === 'Xing' || tag === 'Info') { off += h.size; continue; }
    }
    frames++;
    samples += h.samples;
    sampleRate = h.sampleRate;
    channels = h.channels;
    off += h.size;
  }
  return { frames, duration: sampleRate ? samples / sampleRate : 0, sampleRate, channels, junkBytes };
}

/** 맨 앞 ID3v2 와 맨 끝 ID3v1 꼬리표(제작 도구·출처 URL 이 들어갈 수 있는 곳)를 걷어 냅니다. */
export function stripMp3Tags(input) {
  let buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  for (let n = id3v2Length(buf); n > 0 && n <= buf.length; n = id3v2Length(buf)) buf = buf.subarray(n);
  if (buf.length >= 128 && buf.toString('latin1', buf.length - 128, buf.length - 125) === 'TAG') buf = buf.subarray(0, buf.length - 128);
  return Buffer.from(buf);
}

/** 출처 메타데이터 문자열에서 URL 을 지웁니다. */
const scrubUrls = (v) => String(v).replace(/(?:https?:\/\/|www\.)\S*/gi, '').replace(/\s{2,}/g, ' ').trim();
const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

/**
 * 해설·분필 소리를 읽어 검증하고 장면에 넣을 값을 돌려줍니다. 문제는 problems 에 모읍니다.
 * opts.noAudio 이면 해설은 건너뛰고(개발용) 분필 녹음만 검사합니다.
 * 반환: { clips: {id: {audio, duration}}, provider, chalk }
 */
export function loadAudio(root, audioDir, scene, problems, opts = {}) {
  const out = { clips: {}, provider: null, chalk: null };
  const readJson = (rel, abs) => {
    try { return JSON.parse(fs.readFileSync(abs || path.join(root, rel), 'utf8')); } catch (e) { problems.push(rel + ' 을(를) 읽을 수 없습니다: ' + e.message); return null; }
  };
  const readMp3 = (rel, abs) => {
    let raw;
    try { raw = fs.readFileSync(abs || path.join(root, rel)); } catch { problems.push(rel + ' 이(가) 없습니다 (해설은 narrate.py, 분필은 assets/ 의 녹음을 확인하세요)'); return null; }
    const body = stripMp3Tags(raw);
    const info = mp3Info(body);
    if (info.frames === 0) { problems.push(rel + ': MP3 프레임을 찾을 수 없습니다 (MP3 파일이 아니거나 비어 있음)'); return null; }
    if (info.junkBytes > 0) problems.push(rel + ': 프레임 밖 바이트 ' + info.junkBytes + '개 — 잘렸거나 손상된 MP3 입니다');
    const hit = URL_BYTES_RE.exec(body.toString('latin1'));
    if (hit) problems.push(rel + ': 오디오 본문에 URL(' + hit[0] + ')이 들어 있어 내장할 수 없습니다 — 다시 인코딩하세요');
    return { body, info };
  };

  if (!opts.noAudio) {
    const provider = readJson('audio/provider.json', path.join(audioDir, 'provider.json'));
    const durations = readJson('audio/durations.json', path.join(audioDir, 'durations.json'));
    if (provider) {
      if (provider.voice !== EXPECTED_VOICE.voice) problems.push('audio/provider.json: 해설 목소리(voice)가 ' + EXPECTED_VOICE.voice + ' 이어야 합니다 (현재 ' + provider.voice + ')');
      if (provider.model !== EXPECTED_VOICE.model) problems.push('audio/provider.json: model 이 ' + EXPECTED_VOICE.model + ' 이어야 합니다 (현재 ' + provider.model + ')');
      if (provider.language !== EXPECTED_VOICE.language) problems.push('audio/provider.json: language 가 ' + EXPECTED_VOICE.language + ' 이어야 합니다');
      if (provider.synthetic !== true) problems.push('audio/provider.json: synthetic 이 true 여야 합니다 — AI 합성 음성임을 화면에 알려야 합니다');
      if (!provider.scriptSha256 || typeof provider.scriptSha256 !== 'object') problems.push('audio/provider.json: scriptSha256(단계별 대본 해시)가 없습니다');
      out.provider = {};
      for (const k of ['provider', 'model', 'voice', 'language', 'format']) if (typeof provider[k] === 'string') out.provider[k] = scrubUrls(provider[k]);
      out.provider.synthetic = provider.synthetic === true;
    }
    for (const step of scene.steps || []) {
      if (!step || typeof step.id !== 'string') continue;
      const id = step.id;
      const rel = 'audio/' + id + '.mp3';
      if (provider && provider.scriptSha256 && typeof step.narration === 'string') {
        if (provider.scriptSha256[id] !== sha256(step.narration)) problems.push(id + ': 해설 대본이 바뀌어 ' + rel + ' 이(가) 오래되었습니다 — python narrate.py 로 해설을 다시 생성하세요');
      }
      const mp3 = readMp3(rel, path.join(audioDir, id + '.mp3'));
      if (!mp3) continue;
      const want = durations ? durations[id] : undefined;
      if (!durations || !(want > 0)) problems.push(id + ': audio/durations.json 에 길이가 없습니다');
      else if (Math.abs(mp3.info.duration - want) > DURATION_TOLERANCE) problems.push(rel + ': 길이 불일치 — MP3 프레임 ' + mp3.info.duration.toFixed(2) + '초, durations.json ' + want + '초');
      const min = opts.clipMinSeconds === undefined ? CLIP_MIN_SECONDS : opts.clipMinSeconds;
      if (mp3.info.duration < min) problems.push(rel + ': 길이 ' + mp3.info.duration.toFixed(1) + '초는 해설로 너무 짧습니다 (' + min + '초 이상)');
      out.clips[id] = { audio: AUDIO_MIME + mp3.body.toString('base64'), duration: want > 0 ? want : mp3.info.duration };
    }
  }

  const src = readJson('assets/chalk-writing-source.json');
  const chalk = readMp3('assets/chalk-writing.mp3');
  if (src) {
    if (src.license !== 'CC0-1.0') problems.push('assets/chalk-writing-source.json: 분필 녹음의 license 는 CC0-1.0 이어야 합니다 (현재 ' + src.license + ')');
    if (src.recorded !== true) problems.push('assets/chalk-writing-source.json: recorded 가 true(실제 녹음)여야 합니다 — 합성 분필 소리는 쓸 수 없습니다');
    if (!isStr(src.title) || !isStr(src.creator)) problems.push('assets/chalk-writing-source.json: title, creator 가 필요합니다');
  }
  if (chalk && chalk.info.duration < CHALK_MIN_SECONDS) problems.push('assets/chalk-writing.mp3: 길이 ' + chalk.info.duration.toFixed(1) + '초는 너무 짧습니다 (' + CHALK_MIN_SECONDS + '초 이상 필요 — 짧은 조각 순환)');
  if (src && chalk) {
    out.chalk = {
      title: scrubUrls(src.title || ''),
      creator: scrubUrls(src.creator || ''),
      license: src.license,
      recorded: src.recorded === true,
      edits: scrubUrls(src.edits || ''),
      duration: Math.round(chalk.info.duration * 1000) / 1000,
      audio: AUDIO_MIME + chalk.body.toString('base64'),
    };
  }
  return out;
}

/* ---------------------------------------------------------------------
 * 출력 검사
 * ------------------------------------------------------------------- */
const FONT_DATA_RE = /url\(data:font\/ttf;base64,[A-Za-z0-9+/=]+\)/g;
const AUDIO_DATA_RE = /data:audio\/mpeg;base64,[A-Za-z0-9+/=]+/g;

/** 외부 자원/네트워크/위험 API 사용 흔적을 문자열 목록으로 돌려줍니다. */
export function findForbidden(html) {
  const text = html.replace(FONT_DATA_RE, 'url(data:font)').replace(AUDIO_DATA_RE, 'data:audio');
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
    [/speechSynthesis|SpeechSynthesisUtterance/, '브라우저 음성 합성(speechSynthesis) — 해설은 내장 MP3 만 씁니다'],
  ];
  for (const [re, label] of rules) {
    const m = re.exec(text);
    if (m) problems.push(label + ' — "' + text.slice(Math.max(0, m.index - 20), m.index + 50).replace(/\s+/g, ' ') + '"');
  }
  return problems;
}

function listHtmlFiles(dir, base = dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...listHtmlFiles(p, base));
    else if (/\.html?$/i.test(entry.name)) found.push(path.relative(base, p));
  }
  return found;
}

const jsonForScript = (value) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 인라인 <script>/<style> 블록의 내용 해시로 엄격한 CSP 를 만듭니다(unsafe-inline·unsafe-eval 없음). */
export function buildCsp(html) {
  const hashOf = (body) => "'sha256-" + crypto.createHash('sha256').update(body, 'utf8').digest('base64') + "'";
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => hashOf(m[1]));
  const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => hashOf(m[1]));
  return [
    "default-src 'none'",
    'script-src ' + (scripts.join(' ') || "'none'"),
    'style-src ' + (styles.join(' ') || "'none'"),
    'font-src data:',
    'media-src data:',
    'img-src data:',
    "connect-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
}

/** 소리·판서 시간표 요약(참고용) */
function timingSummary(steps, durations) {
  return steps.map((s) => {
    const real = durations[s.id];
    const duration = real || Q.estimateNarration(s.narration);
    return { id: s.id, duration, animEnd: Q.stepTimeline(s).animEnd, estimated: !real };
  });
}

/* ---------------------------------------------------------------------
 * 빌드
 * ------------------------------------------------------------------- */
export const readSources = (root) => {
  const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
  return { template: read(TEMPLATE_NAME), styles: read('style.css'), qmath: read('qmath.js'), player: read('player.js') };
};

/**
 * opts: { root, content, audio, noAudio, write, out, strict, clipMinSeconds, scene }
 *   strict: 14단계+meta 전체 필요(기본: --no-audio 가 아니면 true)
 *   scene:  quantum-physics.scene.json 도 쓸지(기본: 기본 경로로 쓰는 전체 빌드일 때만)
 * 반환: { html, scene, summary, warnings, stats } — 실패하면 e.problems 가 붙은 Error 를 던집니다.
 */
export function build(opts = {}) {
  const root = opts.root || ROOT;
  const contentDir = path.resolve(root, opts.content || 'content');
  const audioDir = path.resolve(root, opts.audio || 'audio');
  const noAudio = opts.noAudio === true;
  const strict = opts.strict !== undefined ? opts.strict : !noAudio;
  const warnings = [];
  const problems = [];

  /* 내용 */
  const v = validateDir(contentDir, { strict, root, free: opts.free !== undefined ? opts.free : !!opts.content });
  for (const e of v.errors) problems.push(e.raw ? e.msg : formatIssue(e));
  for (const w of v.warnings) warnings.push(formatIssue(w));
  if (!v.scene) problems.push('content/00-meta.json 이(가) 필요합니다');
  if (noAudio && v.pending.length > 0) warnings.push('내용이 일부만 있습니다(대기 중 ' + v.pending.length + '개: ' + v.pending.join(', ') + ') — 개발용 부분 빌드');
  if (!v.scene || v.loaded.steps.length === 0) {
    if (v.scene) problems.push('단계 파일(content/NN-*.json)이 하나도 없습니다');
    fail(problems);
  }
  const scene = v.scene;

  /* 글꼴 */
  const fonts = loadFonts(root);
  if (fonts.error) problems.push(fonts.error);
  for (const lic of ['OFL.txt', 'LICENSE-DejaVu.txt']) if (!fs.existsSync(path.join(root, 'assets', lic))) problems.push('assets/' + lic + ' (글꼴 라이선스 전문)이 없습니다');

  /* 소스 */
  let src;
  try { src = readSources(root); } catch (e) { problems.push('소스 파일을 읽을 수 없습니다: ' + e.message); fail(problems); }
  for (const [name, text] of [['qmath.js', src.qmath], ['player.js', src.player], ['style.css', src.styles]]) {
    if (/<\/script|<!--/i.test(text)) problems.push(name + ' 에 </script 또는 <!-- 가 있어 HTML에 넣을 수 없습니다');
  }
  for (const token of ['/*__STYLES__*/', '/*__QMATH__*/', '/*__SCENE__*/', '/*__PLAYER__*/', '%%TITLE%%', '%%AUTHOR%%', '%%CSP%%']) {
    if (!src.template.includes(token)) problems.push('template.html 에 ' + token + ' 가 없습니다');
  }
  for (const token of ['<script>/*__QMATH__*/</script>', '<script>/*__SCENE__*/</script>', '<script>/*__PLAYER__*/</script>', '<style>/*__STYLES__*/</style>']) {
    if (!src.template.includes(token)) problems.push('template.html 의 ' + token + ' 는 한 줄에 정확히 이 모양이어야 합니다(CSP 해시 계산)');
  }

  /* 소리 */
  const audio = loadAudio(root, audioDir, scene, problems, { noAudio, clipMinSeconds: opts.clipMinSeconds });

  /* 시간표 */
  let summary = [];
  if (!problems.length) {
    const durations = {};
    for (const s of scene.steps) if (audio.clips[s.id]) durations[s.id] = audio.clips[s.id].duration;
    summary = timingSummary(scene.steps, durations);
    for (const t of summary) {
      if (t.animEnd - t.duration > DRAW_OVERRUN_WARN) warnings.push(t.id + ': 판서가 해설보다 ' + (t.animEnd - t.duration).toFixed(1) + '초 늦게 끝납니다' + (t.estimated ? '(추정)' : '') + ' (마지막 at 을 앞으로 당기거나 글을 줄이세요)');
      const last = scene.steps.find((s) => s.id === t.id).beats.reduce((m, b) => Math.max(m, b.at), 0);
      if (!t.estimated && last > t.duration - 0.5) warnings.push(t.id + ': 마지막 자막(' + last + '초)이 실제 해설 끝(' + t.duration.toFixed(1) + '초)보다 늦습니다');
    }
  }
  if (problems.length) fail(problems);

  /* 조립 */
  const lesson = JSON.parse(JSON.stringify(scene));
  if (!noAudio) {
    for (const step of lesson.steps) {
      step.audio = audio.clips[step.id].audio;
      step.audioDuration = audio.clips[step.id].duration;
    }
    lesson.narrationProvider = audio.provider;
  } else {
    lesson.narrationProvider = null;
    warnings.push('--no-audio: 해설 음성(MP3)이 없는 개발용 빌드입니다. 판서 시간은 대본 길이로 추정하며 배포하지 마세요');
  }
  lesson.chalkSound = audio.chalk;
  lesson.build = { noAudio };

  const fontFace =
    '@font-face{font-family:NanumPenScript;src:url(data:font/ttf;base64,' + fonts.nanum.toString('base64') + ') format("truetype");font-weight:400;font-style:normal;font-display:block}\n' +
    '@font-face{font-family:QMath;src:url(data:font/ttf;base64,' + fonts.qmath.toString('base64') + ') format("truetype");font-weight:400;font-style:normal;font-display:block}\n';
  const assemble = (data) => {
    const body = src.template
      .replace('%%TITLE%%', () => escapeHtml(scene.title))
      .replace('%%AUTHOR%%', () => escapeHtml(scene.author))
      .replace('/*__STYLES__*/', () => fontFace + src.styles)
      .replace('/*__QMATH__*/', () => src.qmath)
      .replace('/*__SCENE__*/', () => 'window.LESSON_DATA = ' + jsonForScript(data) + ';')
      .replace('/*__PLAYER__*/', () => src.player);
    return body.replace('%%CSP%%', () => buildCsp(body));
  };
  const html = assemble(lesson);

  // 외부 URL 검사: 참고 문헌 속 URL 글자는 "보이는 글"이므로 빼고 검사합니다.
  const forCheck = JSON.parse(JSON.stringify(lesson));
  forCheck.references = (forCheck.references || []).map(scrubUrls);
  const checked = assemble(forCheck);
  const leftovers = checked.replace(FONT_DATA_RE, '').replace(AUDIO_DATA_RE, '').match(/\/\*__[A-Z]+__\*\/|%%[A-Z]+%%/g);
  if (leftovers) problems.push('치환되지 않은 토큰: ' + leftovers.join(', '));
  problems.push(...findForbidden(checked).map((p) => '금지된 항목: ' + p));
  const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(html);
  if (!csp) problems.push('CSP meta 가 없습니다');
  else if (/unsafe-inline|unsafe-eval|\*/.test(csp[1].replace(/'unsafe-hashes'/g, ''))) problems.push('CSP 가 느슨합니다: ' + csp[1].slice(0, 120));
  const wantAudio = (noAudio ? 0 : lesson.steps.length) + 1;
  if ((html.match(AUDIO_DATA_RE) || []).length !== wantAudio) problems.push('내장된 오디오가 ' + wantAudio + '개가 아닙니다');
  if ((html.match(FONT_DATA_RE) || []).length !== 2) problems.push('내장된 글꼴이 2개(NanumPenScript + QMath)가 아닙니다');

  const outName = opts.out ? path.basename(opts.out) : OUTPUT_NAME;
  const htmlFiles = listHtmlFiles(root).filter((f) => f !== TEMPLATE_NAME && f !== OUTPUT_NAME && f !== outName);
  if (htmlFiles.length) problems.push('이 폴더에는 ' + OUTPUT_NAME + ' 외의 HTML을 둘 수 없습니다: ' + htmlFiles.join(', '));
  if (problems.length) fail(problems);

  const complete = v.pending.length === 0 && v.unexpected.length === 0;
  const writeScene = opts.scene !== undefined ? opts.scene : !opts.out && !opts.content && complete;
  if (opts.write !== false) {
    fs.writeFileSync(opts.out ? path.resolve(root, opts.out) : path.join(root, OUTPUT_NAME), html);
    if (writeScene) fs.writeFileSync(path.join(root, SCENE_NAME), JSON.stringify(scene, null, 2) + '\n');
  }
  return {
    html,
    scene: lesson,
    summary,
    warnings,
    stats: {
      bytes: Buffer.byteLength(html),
      steps: lesson.steps.length,
      expectedSteps: EXPECTED_IDS.length,
      glyphs: { nanum: fonts.nanumInfo.cmap.size, qmath: fonts.qmathInfo.cmap.size },
      audioClips: noAudio ? 0 : lesson.steps.length,
      chalkSeconds: audio.chalk.duration,
      complete,
      sceneWritten: opts.write !== false && writeScene,
      noAudio,
    },
  };
}

function fail(problems) {
  const e = new Error(formatProblems(problems, '빌드 실패'));
  e.problems = problems;
  throw e;
}

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-audio') o.noAudio = true;
    else if (a === '--check') o.write = false;
    else if (a === '--content') o.content = argv[++i];
    else if (a === '--audio') o.audio = argv[++i];
    else if (a === '--out') o.out = argv[++i];
    else if (a === '-h' || a === '--help') o.help = true;
    else throw new Error('알 수 없는 옵션: ' + a);
  }
  return o;
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log('사용법: node build.mjs [--no-audio] [--check] [--content DIR] [--audio DIR] [--out FILE]');
      return;
    }
    const r = build(args);
    const name = args.out ? path.basename(args.out) : OUTPUT_NAME;
    for (const w of r.warnings) console.warn('경고: ' + w);
    console.log((args.write === false ? '검사 통과: ' : '빌드 성공: ') + name + ' (' + (r.stats.bytes / 1048576).toFixed(2) + ' MB)');
    const totalAnim = r.summary.reduce((n, s) => n + s.animEnd, 0);
    const totalDur = r.summary.reduce((n, s) => n + s.duration, 0);
    console.log('단계 ' + r.stats.steps + '개, 해설 ' + (r.stats.noAudio ? '추정 ' : '') + (totalDur / 60).toFixed(1) + '분, 판서 합계 ' + (totalAnim / 60).toFixed(1) + '분 (속도 1배, 단계 사이 0.9초 간격 제외)');
    for (const s of r.summary) console.log('  - ' + s.id.padEnd(15) + ' 해설 ' + s.duration.toFixed(1).padStart(5) + '초' + (s.estimated ? '(추정)' : '      ') + ' / 판서 끝 ' + s.animEnd.toFixed(1).padStart(5) + '초');
    console.log('글꼴 글자 수: NanumPenScript ' + r.stats.glyphs.nanum + ' + QMath ' + r.stats.glyphs.qmath + ' · 해설 MP3 ' + r.stats.audioClips + '개 + 분필 녹음(CC0) ' + r.stats.chalkSeconds.toFixed(1) + '초 내장 · 외부 URL 0건 · 글리프 누락 0건 · 엄격한 CSP');
    if (r.stats.sceneWritten) console.log('장면 JSON 갱신: ' + SCENE_NAME);
    else if (args.write !== false && !r.stats.complete) console.log('(내용이 전부 있지 않아 ' + SCENE_NAME + ' 은 갱신하지 않았습니다)');
    if (r.stats.noAudio) console.warn('\n⚠ 개발용 빌드(--no-audio): 해설 음성이 없습니다. 배포 전에는 narrate.py 로 해설을 만든 뒤 node build.mjs 로 다시 빌드하세요.');
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
