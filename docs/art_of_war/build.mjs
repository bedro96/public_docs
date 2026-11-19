#!/usr/bin/env node
/* 손자병법 칠판 강의 빌드.
 *
 *   node build.mjs               -> art-of-war.html  (글꼴·스타일·장면·재생기·해설 음성·분필 소리를 모두 넣은 단일 파일)
 *   node build.mjs --no-audio    -> 해설 MP3 없이 만드는 개발용 빌드(판서 시간은 대본 길이로 추정). 배포용이 아닙니다.
 *   node build.mjs --check       -> 파일을 쓰지 않고 검사만
 *   옵션: --content DIR  --audio DIR  --out FILE
 *
 * 빌드는 아래 중 하나라도 어긋나면 실패합니다. "빌드 성공" = "검사 통과" 입니다.
 *   - content/00-meta.json + 01~04 단계 파일을 합친 장면이 SCHEMA.md 규격(validate.mjs)을 어김
 *     (필수 필드, id 유일, 23단계 · 편 1~13 순서, 해설 330~430자·한자/숫자/기호 금지, at 오름차순,
 *      노드 범위·겹침, 링크 끝점, 연표 연도 범위, 인용 필수, 태그 종류, 기업 이름 금지 …)
 *   - 칠판(Canvas)에 그려질 글자가 내장 글꼴(나눔손글씨 펜 + 한자 부분 글꼴)에 없음 → 조용히 빈 네모가 되는 것을 막습니다
 *   - 칠판 배치 검사(layout.js): 글이 노드 상자·칠판 밖으로 넘치는 경우 (넓은 화면 / 좁은 화면 폭 여러 개)
 *   - 외부 URL / 외부 글꼴 / 네트워크 호출 / innerHTML / speechSynthesis 같은 위험한 코드
 *   - 이 폴더에 art-of-war.html 말고 다른 .html(템플릿 제외)이 있음
 *   - 소리: 해설 MP3(단계마다 1개)가 없거나 길이가 durations.json 과 다름, 대본이 바뀌어 MP3 가 오래됨(scriptSha256),
 *           목소리가 ko-KR-Haena:MAI-Voice-2 가 아님, 분필 녹음이 CC0 실제 녹음이 아님, 오디오에 URL 이 들어 있음
 *
 * 산출물에는 외부 URL 이 한 글자도 없어야 합니다. 예외는 하나뿐입니다: 장면 데이터의 참고 문헌(references)과
 * 영상 출처(source) 문장 속 URL 은 "화면에 보이는 글자"일 뿐 링크도 요청도 아니므로 허용합니다(검사는 그 글자를 빼고 합니다).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateLesson, formatProblems, SCHEMA } from './validate.mjs';

const require = createRequire(import.meta.url);

export const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const OUTPUT_NAME = 'art-of-war.html';
export const TEMPLATE_NAME = 'template.html';
export { SCHEMA };
export const STEP_FILES = ['01-background.json', '02-chapters-a.json', '03-chapters-b.json', '04-closing.json'];
/** 칠판 배치 검사에 쓰는 칠판(stage) 가로 폭(px): 넓은 화면(1280 뷰포트), 넓은 화면의 최소(layout.js WIDE_MIN), 좁은 화면(390 뷰포트), 더 좁은 화면 */
export const LAYOUT_WIDTHS = [1088, 1000, 350, 300];
/** 판서가 해설보다 이만큼(초) 넘게 늦게 끝나면 경고 */
const DRAW_OVERRUN_WARN = 4;

/* ---------------------------------------------------------------------
 * 글꼴 읽기 (TTF/OTF 의 cmap·hmtx): 글꼴이 실제로 가진 글자와 글자 폭
 * ------------------------------------------------------------------- */
export function parseFont(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const numTables = dv.getUint16(4);
  const tables = {};
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    const tag = String.fromCharCode(dv.getUint8(rec), dv.getUint8(rec + 1), dv.getUint8(rec + 2), dv.getUint8(rec + 3));
    tables[tag] = dv.getUint32(rec + 8);
  }
  for (const need of ['cmap', 'head', 'hhea', 'hmtx']) if (tables[need] === undefined) throw new Error('글꼴에 ' + need + ' 표가 없습니다');
  const upm = dv.getUint16(tables.head + 18);
  const numHM = dv.getUint16(tables.hhea + 34);
  const cmapOff = tables.cmap;
  const subCount = dv.getUint16(cmapOff + 2);
  const cmap = new Map(); // 코드포인트 -> 글리프 번호
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
          if (g !== 0) cmap.set(c, g);
        }
      }
    } else if (format === 12) {
      const groups = dv.getUint32(off + 12);
      for (let g = 0; g < groups; g++) {
        const start = dv.getUint32(off + 16 + g * 12);
        const end = dv.getUint32(off + 20 + g * 12);
        const gid = dv.getUint32(off + 24 + g * 12);
        for (let c = start; c <= end; c++) if (gid + (c - start) !== 0) cmap.set(c, gid + (c - start));
      }
    }
  }
  if (cmap.size === 0) throw new Error('글꼴 cmap을 해석하지 못했습니다');
  const hmtx = tables.hmtx;
  const advance = (gid) => dv.getUint16(hmtx + Math.min(gid, numHM - 1) * 4);
  return {
    size: cmap.size,
    has: (cp) => cmap.has(cp),
    /** 글자 폭(em 단위). 글꼴에 없으면 null */
    em(cp) { const g = cmap.get(cp); return g === undefined ? null : advance(g) / upm; },
  };
}

/** 칠판에 그려질 글 중 글꼴들(순서대로 대체)에 없는 글자를 {char, code, where}[] 로 돌려줍니다. */
export function missingGlyphs(entries, fonts, { onlyHan = false } = {}) {
  const missing = new Map();
  for (const { text, where } of entries) {
    for (const ch of text) {
      if (/\s/.test(ch)) continue;
      if (onlyHan && !/\p{Script=Han}/u.test(ch)) continue;
      const cp = ch.codePointAt(0);
      if (fonts.some((f) => f.has(cp))) continue;
      if (!missing.has(ch)) missing.set(ch, where);
    }
  }
  return [...missing].map(([char, where]) => ({ char, where, code: 'U+' + char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0') }));
}

/** 글꼴 폭 표로 글 너비를 재는 measure(text, px) — 브라우저의 measureText 를 빌드 단계에서 흉내 냅니다. */
export function makeMeasure(fonts) {
  /* 한 글꼴 크기로 잰 폭. layout.js 의 boosted() 가 한자/그 밖 덩어리별 크기(KO_BOOST)를 입힙니다. */
  return (text, px) => {
    let em = 0;
    for (const ch of String(text)) {
      const cp = ch.codePointAt(0);
      let w = null;
      for (const f of fonts) { w = f.em(cp); if (w !== null) break; }
      em += w === null ? (cp > 0x2e80 ? 1 : 0.55) : w;
    }
    return em * px;
  };
}

/* ---------------------------------------------------------------------
 * 콘텐츠 합치기: content/00-meta.json + 01~04 단계 파일(파일명 순서)
 * ------------------------------------------------------------------- */
export function loadContent(dir) {
  const problems = [];
  let meta = null;
  const metaPath = path.join(dir, '00-meta.json');
  try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch (e) { problems.push('content/00-meta.json 을 읽을 수 없습니다: ' + e.message); }
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^0[1-9][\w-]*\.json$/.test(f)).sort() : [];
  const steps = [];
  for (const f of files) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (!j || !Array.isArray(j.steps)) { problems.push('content/' + f + ': { "steps": [...] } 형식이어야 합니다'); continue; }
      const extra = Object.keys(j).filter((k) => k !== 'steps');
      if (extra.length) problems.push('content/' + f + ': steps 밖의 키는 쓸 수 없습니다 (' + extra.join(', ') + ')');
      steps.push(...j.steps);
    } catch (e) { problems.push('content/' + f + ' 을(를) 읽을 수 없습니다: ' + e.message); }
  }
  if (meta && meta.steps !== undefined) problems.push('content/00-meta.json: steps 는 01~04 파일에 써야 합니다');
  const scene = meta && typeof meta === 'object' ? Object.assign({}, meta, { steps }) : null;
  const complete = STEP_FILES.every((f) => files.includes(f));
  return { scene, files, complete, problems };
}

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
const CLIP_MIN_SECONDS = 20; // 330자 이상 해설은 어떤 속도로도 20초보다 짧을 수 없습니다
const CHALK_MIN_SECONDS = 4; // 분필 소리는 이 녹음을 4초 안팎 조각으로 나눠 돌려 쓴다 (player.js 의 CHALK_SEGMENT_SEC)
const DURATION_TOLERANCE = 0.1;
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
    try { raw = fs.readFileSync(abs || path.join(root, rel)); } catch { problems.push(rel + ' 이(가) 없습니다 (해설은 python narrate.py, 분필은 assets/ 의 녹음을 확인하세요)'); return null; }
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
        const sha = crypto.createHash('sha256').update(step.narration).digest('hex');
        if (provider.scriptSha256[id] !== sha) problems.push(id + ': 해설 대본이 바뀌어 ' + rel + ' 이(가) 오래되었습니다 — python narrate.py 로 해설을 다시 생성하세요');
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
const FONT_DATA_RE = /url\(data:font\/(?:ttf|otf);base64,[A-Za-z0-9+/=]+\)/g;
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

/* ---------------------------------------------------------------------
 * 칠판 배치 검사 (layout.js 를 빌드에서 그대로 돌립니다)
 * ------------------------------------------------------------------- */
/**
 * 각 단계를 여러 칠판 폭에서 배치해 보고, error 는 problems 로, warn 은 warnings 로 모읍니다.
 * 글 폭은 나눔손글씨 펜·한자 부분 글꼴의 글자 폭 표로 잽니다(브라우저 measureText 와 같은 글꼴).
 */
export function layoutCheck(L, steps, measure, widths = LAYOUT_WIDTHS) {
  const errors = [];
  const warnings = new Map();
  for (const W of widths) {
    for (const raw of steps) {
      let plan;
      try { plan = L.planStep(raw, W, measure); } catch (e) { errors.push('배치 계산 실패 ' + raw.id + ' (W=' + W + '): ' + e.message); continue; }
      for (const is of plan.issues) {
        const msg = raw.id + ' (칠판 폭 ' + W + 'px' + (plan.wide ? ' 넓은 화면' : ' 좁은 화면') + (plan.mode === 'flow' || plan.mode === 'vertical' ? ', 세로 재배치' : '') + '): ' + is.detail + ' [' + is.kind + ']';
        if (is.level === 'error') errors.push('칠판 배치 — ' + msg);
        else warnings.set(is.kind + '|' + raw.id + '|' + is.detail, msg);
      }
    }
  }
  return { errors, warnings: [...warnings.values()] };
}

/** 소리·판서 시간표 요약(참고용) */
function timingSummary(L, steps, durations) {
  return steps.map((s) => {
    const D = durations[s.id] || L.estimateDuration(s.narration);
    return { id: s.id, duration: D, animEnd: L.stepEnd(s, D), estimated: !durations[s.id] };
  });
}

/* ---------------------------------------------------------------------
 * 빌드
 * ------------------------------------------------------------------- */
export const readSources = (root) => {
  const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
  return { template: read(TEMPLATE_NAME), styles: read('style.css'), layout: read('layout.js'), draw: read('draw.js'), player: read('player.js') };
};

/**
 * opts: { root, content, audio, noAudio, write, out, strictStructure, clipMinSeconds, widths }
 * 반환: { html, scene, summary, warnings, stats }   — 실패하면 e.problems 가 붙은 Error 를 던집니다.
 */
export function build(opts = {}) {
  const root = opts.root || ROOT;
  const contentDir = path.resolve(root, opts.content || 'content');
  const audioDir = path.resolve(root, opts.audio || 'audio');
  const noAudio = opts.noAudio === true;
  const warnings = [];
  const problems = [];

  const loaded = loadContent(contentDir);
  problems.push(...loaded.problems);
  if (!loaded.scene) fail(problems);
  const scene = loaded.scene;
  const strictStructure = opts.strictStructure !== undefined ? opts.strictStructure : loaded.complete;
  if (!strictStructure) warnings.push('콘텐츠 파일이 모두 있지는 않아(' + STEP_FILES.join(', ') + ') 23단계 구조 검사를 건너뜁니다');

  const result = validateLesson(scene, { strictStructure });
  problems.push(...result.errors);
  warnings.push(...result.warnings);

  /* 글꼴: 나눔손글씨 펜 + 한자 부분 글꼴 */
  const nanumPath = path.join(root, 'assets', 'NanumPenScript-Regular.ttf');
  const hanjaPath = path.join(root, 'assets', 'ChalkHanja-subset.otf');
  let nanumBuf = null;
  let hanjaBuf = null;
  let fonts = null;
  try { nanumBuf = fs.readFileSync(nanumPath); } catch { problems.push('assets/NanumPenScript-Regular.ttf 이(가) 없습니다'); }
  try { hanjaBuf = fs.readFileSync(hanjaPath); } catch { problems.push('assets/ChalkHanja-subset.otf 이(가) 없습니다 — python3 subset_hanja.py 로 만드세요'); }
  for (const lic of ['OFL.txt', 'OFL-NotoSerifCJK.txt']) if (!fs.existsSync(path.join(root, 'assets', lic))) problems.push('assets/' + lic + ' (글꼴 라이선스 전문)이 없습니다');
  if (nanumBuf && hanjaBuf) {
    fonts = { nanum: parseFont(nanumBuf), hanja: parseFont(hanjaBuf) };
    // 칠판(Canvas) 글: 모든 글자가 두 글꼴 중 하나에 있어야 합니다.
    for (const m of missingGlyphs(result.chalk, [fonts.nanum, fonts.hanja])) {
      problems.push('칠판 글꼴에 없는 글자 ' + m.code + ' "' + m.char + '" (' + m.where + ') — 한자·기호라면 python3 subset_hanja.py 로 한자 부분 글꼴을 다시 만들고, 아니라면 다른 글자로 바꾸세요');
    }
    // 화면(DOM) 글: 한자는 내장 한자 글꼴에 있어야 합니다(시스템 글꼴에 기대지 않습니다).
    for (const m of missingGlyphs(result.dom, [fonts.nanum, fonts.hanja], { onlyHan: true })) {
      problems.push('한자 부분 글꼴에 없는 한자 ' + m.code + ' "' + m.char + '" (' + m.where + ') — python3 subset_hanja.py 로 한자 부분 글꼴을 다시 만드세요');
    }
  }

  /* 소스 */
  let src;
  try { src = readSources(root); } catch (e) { problems.push('소스 파일을 읽을 수 없습니다: ' + e.message); fail(problems); }
  for (const [name, text] of [['layout.js', src.layout], ['draw.js', src.draw], ['player.js', src.player], ['style.css', src.styles]]) {
    if (/<\/script|<!--/i.test(text)) problems.push(name + ' 에 </script 또는 <!-- 가 있어 HTML에 넣을 수 없습니다');
  }
  for (const token of ['/*__STYLES__*/', '/*__LAYOUT__*/', '/*__DRAW__*/', '/*__SCENE__*/', '/*__PLAYER__*/', '%%TITLE%%', '%%AUTHOR%%']) {
    if (!src.template.includes(token)) problems.push('template.html 에 ' + token + ' 가 없습니다');
  }

  /* 소리 */
  const audio = loadAudio(root, audioDir, scene, problems, { noAudio, clipMinSeconds: opts.clipMinSeconds });

  /* 칠판 배치 검사 + 시간표 */
  let summary = [];
  if (fonts && Array.isArray(scene.steps) && result.errors.length === 0) {
    try {
      const L = require(path.join(root, 'layout.js'));
      const lc = layoutCheck(L, scene.steps, makeMeasure([fonts.nanum, fonts.hanja]), opts.widths || LAYOUT_WIDTHS);
      problems.push(...lc.errors);
      warnings.push(...lc.warnings.map((w) => '배치 경고 — ' + w));
      const durations = {};
      for (const s of scene.steps) if (audio.clips[s.id]) durations[s.id] = audio.clips[s.id].duration;
      summary = timingSummary(L, scene.steps, durations);
      for (const t of summary) {
        if (t.animEnd - t.duration > DRAW_OVERRUN_WARN) warnings.push(t.id + ': 판서가 해설보다 ' + (t.animEnd - t.duration).toFixed(1) + '초 늦게 끝납니다 (마지막 at 을 앞으로 당기거나 글을 줄이세요)');
      }
    } catch (e) {
      problems.push('layout.js 를 불러오거나 실행하지 못했습니다: ' + e.message);
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
    '@font-face{font-family:ChalkKorean;src:url(data:font/ttf;base64,' + nanumBuf.toString('base64') + ') format("truetype");font-weight:400;font-style:normal;font-display:block}\n' +
    '@font-face{font-family:ChalkHanja;src:url(data:font/otf;base64,' + hanjaBuf.toString('base64') + ') format("opentype");font-weight:100 900;font-style:normal;font-display:block}\n';
  const assemble = (data) => src.template
    .replace('%%TITLE%%', () => escapeHtml(scene.title))
    .replace('%%AUTHOR%%', () => escapeHtml(scene.author))
    .replace('/*__STYLES__*/', () => fontFace + src.styles)
    .replace('/*__LAYOUT__*/', () => src.layout)
    .replace('/*__DRAW__*/', () => src.draw)
    .replace('/*__SCENE__*/', () => 'window.LESSON_DATA = ' + jsonForScript(data) + ';')
    .replace('/*__PLAYER__*/', () => src.player);
  const html = assemble(lesson);

  // 외부 URL 검사: 참고 문헌·영상 출처 문장 속 URL 글자는 "보이는 글"이므로 빼고 검사합니다.
  const forCheck = JSON.parse(JSON.stringify(lesson));
  forCheck.references = (forCheck.references || []).map(scrubUrls);
  forCheck.source = Object.fromEntries(Object.entries(forCheck.source || {}).map(([k, v]) => [k, scrubUrls(v)]));
  const checked = assemble(forCheck);
  const leftovers = checked.replace(FONT_DATA_RE, '').replace(AUDIO_DATA_RE, '').match(/\/\*__[A-Z]+__\*\/|%%[A-Z]+%%/g);
  if (leftovers) problems.push('치환되지 않은 토큰: ' + leftovers.join(', '));
  problems.push(...findForbidden(checked).map((p) => '금지된 항목: ' + p));
  const wantAudio = (noAudio ? 0 : lesson.steps.length) + 1;
  if ((html.match(AUDIO_DATA_RE) || []).length !== wantAudio) problems.push('내장된 오디오가 ' + wantAudio + '개가 아닙니다');
  if ((html.match(FONT_DATA_RE) || []).length !== 2) problems.push('내장된 글꼴이 2개(나눔손글씨 펜 + 한자 부분 글꼴)가 아닙니다');

  const outName = opts.out ? path.basename(opts.out) : OUTPUT_NAME;
  const htmlFiles = listHtmlFiles(root).filter((f) => f !== TEMPLATE_NAME && f !== OUTPUT_NAME && f !== outName);
  if (htmlFiles.length) problems.push('이 폴더에는 ' + OUTPUT_NAME + ' 외의 HTML을 둘 수 없습니다: ' + htmlFiles.join(', '));
  if (problems.length) fail(problems);

  if (opts.write !== false) fs.writeFileSync(opts.out ? path.resolve(root, opts.out) : path.join(root, OUTPUT_NAME), html);
  return {
    html,
    scene: lesson,
    summary,
    warnings,
    stats: {
      bytes: Buffer.byteLength(html),
      steps: lesson.steps.length,
      glyphs: { nanum: fonts.nanum.size, hanja: fonts.hanja.size },
      audioClips: noAudio ? 0 : lesson.steps.length,
      chalkSeconds: audio.chalk.duration,
      strictStructure,
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
    for (const s of r.summary) console.log('  - ' + s.id.padEnd(16) + ' 해설 ' + s.duration.toFixed(1).padStart(5) + '초' + (s.estimated ? '(추정)' : '      ') + ' / 판서 끝 ' + s.animEnd.toFixed(1).padStart(5) + '초');
    console.log('글꼴 글자 수: 나눔손글씨 펜 ' + r.stats.glyphs.nanum + ' + 한자 부분 ' + r.stats.glyphs.hanja + ' · 해설 MP3 ' + r.stats.audioClips + '개 + 분필 녹음(CC0) ' + r.stats.chalkSeconds.toFixed(1) + '초 내장 · 외부 URL 0건 · 글리프 누락 0건');
    if (r.stats.noAudio) console.warn('\n⚠ 개발용 빌드(--no-audio): 해설 음성이 없습니다. 배포 전에는 python narrate.py 로 해설을 만든 뒤 node build.mjs 로 다시 빌드하세요.');
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
