// 강의 데이터·빌드·산출물 검증.  실행: node --test   (이 폴더에서)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, OUTPUT_NAME, TEMPLATE_NAME, SCHEMA, loadCmap, missingGlyphs, validateScene, findForbidden, build, mp3Info, stripMp3Tags } from './build.mjs';

const require = createRequire(import.meta.url);
const EC = require('./ecmath.js');

const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');
const scene = () => JSON.parse(read('elliptic-curve.scene.json'));
const clone = (v) => JSON.parse(JSON.stringify(v));

const STEP_IDS = ['shape', 'chord', 'scalar', 'finite', 'ecdlp', 'edwards', 'ed25519', 'x509'];

/** 장면의 모든 글(제목·자막·패널·라벨·오해·참고문헌 등)을 모읍니다. */
function allText(s) {
  const out = [s.title, s.subtitle, s.eyebrow, s.author, (s.ui || {}).hint];
  for (const m of s.misconceptions) out.push(m.title, m.text);
  out.push(...s.references);
  for (const st of s.steps) {
    out.push(st.title, st.nav, st.summary, st.tag.text, st.callout.title, st.callout.text, st.alt, st.narration);
    for (const b of st.beats) out.push(b.text);
    for (const p of st.panel) out.push(p.text);
    for (const l of st.legend) out.push(l.text);
    for (const e of st.board.elements) {
      for (const k of ['label', 'short', 'value', 'title']) if (typeof e[k] === 'string') out.push(e[k]);
      if (e.label && typeof e.label === 'object') out.push(e.label.text);
      if (Array.isArray(e.lines)) out.push(...e.lines);
    }
  }
  return out.filter((t) => typeof t === 'string');
}

/** build()를 임시 폴더에 복사해 돌려 보기 위한 도우미. */
function withTempCopy(mutate, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-build-'));
  try {
    fs.mkdirSync(path.join(dir, 'assets'));
    fs.mkdirSync(path.join(dir, 'audio'));
    for (const f of ['elliptic-curve.scene.json', 'template.html', 'style.css', 'ecmath.js', 'player.js']) fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
    for (const f of ['NanumPenScript-Regular.ttf', 'chalk-writing.mp3', 'chalk-writing-source.json']) fs.copyFileSync(path.join(ROOT, 'assets', f), path.join(dir, 'assets', f));
    for (const f of fs.readdirSync(path.join(ROOT, 'audio'))) fs.copyFileSync(path.join(ROOT, 'audio', f), path.join(dir, 'audio', f));
    mutate(dir);
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
const editFile = (dir, name, fnEdit) => fs.writeFileSync(path.join(dir, name), fnEdit(fs.readFileSync(path.join(dir, name), 'utf8')));

/* ------------------------------------------------------------------ */
test('장면: 한국어 8단계, 순서와 칠판 종류, 작성자', () => {
  const s = scene();
  assert.equal(s.schema, SCHEMA);
  assert.equal(s.lang, 'ko');
  assert.equal(s.author, 'Microsoft Korea STU');
  assert.deepEqual(s.steps.map((x) => x.id), STEP_IDS);
  assert.deepEqual(s.steps.map((x) => x.board.kind), ['plane', 'plane', 'plane', 'finite', 'bars', 'finite', 'flow', 'flow']);
  for (const st of s.steps) {
    for (const field of ['title', 'summary', 'alt']) assert.match(st[field], /[가-힣]/, `${st.id}.${field}`);
    assert.ok(st.beats.length >= 3, `${st.id}: 설명 구절 3개 이상`);
    assert.ok(st.panel.length >= 3, `${st.id}: 판서 3줄 이상`);
    assert.ok(['analogy', 'real'].includes(st.tag.tone));
  }
});

test('장면 검증: 오류 0건 (수학 expect, 점 참조, 서식 토큰, 요소 종류)', () => {
  const r = validateScene(scene());
  assert.deepEqual(r.errors, []);
  assert.equal(r.steps.length, 8);
});

test('칠판 글꼴(나눔손글씨 펜)이 장면의 모든 판서 글자를 가지고 있다', () => {
  const r = validateScene(scene());
  const cmap = loadCmap(fs.readFileSync(path.join(ROOT, 'assets', 'NanumPenScript-Regular.ttf')));
  const chalk = r.steps.flatMap((x) => x.chalk);
  assert.ok(chalk.length > 80);
  assert.deepEqual(missingGlyphs(chalk, cmap), []);
  // 글꼴이 갖지 못한 글자는 실제로 잡아낸다
  assert.ok(missingGlyphs([{ text: 'x² → ∞', where: 't' }], cmap).length >= 3);
  let hangul = 0;
  for (let c = 0xac00; c <= 0xd7a3; c++) if (cmap.has(c)) hangul++;
  assert.equal(hangul, 11172);
});

test('내용 규칙: 연도 숫자 없음, 서명·암호화 구분, 알려진 효율적 알고리즘 표현, 인증서가 모두 쓰는 것은 아님', () => {
  const s = scene();
  const texts = allText(s).join('\n');
  assert.doesNotMatch(texts, /\b(19|20)\d{2}\s*년/, '연도 표기');
  assert.doesNotMatch(texts, /\b(19|20)\d{2}\b(?![\d/])/, '네 자리 연도처럼 보이는 숫자');
  assert.match(texts, /알려진 효율적인 고전 알고리즘/);
  assert.match(texts, /증명된 것은 아니/);
  // 오해 바로잡기 제목·해설처럼 "풀 수 없다고 증명된 게 아니다"로 부정하는 표현과 따옴표 인용('풀 수 없다')은 허용, 직접 단정은 금지
  assert.doesNotMatch(texts, /(?<!')(풀 수 없다(?!고 증명된 게 아니)|불가능하다|절대 (못|안))/, '단정적 불가능 표현');
  const ed = s.steps.find((x) => x.id === 'ed25519');
  const edText = [ed.summary, ed.callout.text, ...ed.beats.map((b) => b.text), ...ed.panel.map((p) => p.text)].join(' ');
  assert.match(edText, /서명/);
  assert.match(edText, /암호화도 키 교환도 아니/);
  assert.match(edText, /X25519/);
  assert.match(texts, /모든 인증서가 Ed25519를 쓰는 건 아니/);
  assert.match(texts, /비유|analog/i);
});

test('시간표: 모든 단계가 합리적이고 설명 구절이 판서 순서를 따른다', () => {
  const s = scene();
  const r = validateScene(s);
  s.steps.forEach((st, i) => {
    const tl = r.steps[i].timeline;
    assert.ok(tl.animEnd >= 8 && tl.animEnd <= 30, `${st.id}: animEnd ${tl.animEnd}`);
    assert.ok(tl.holdEnd >= tl.animEnd + 3, `${st.id}: holdEnd`);
    const times = st.beats.map((b) => b.at);
    assert.deepEqual(times, [...times].sort((a, b) => a - b), `${st.id}: 구절 시각 오름차순`);
    assert.ok(times[times.length - 1] <= tl.animEnd, `${st.id}: 마지막 구절이 판서 시간 안`);
  });
});

/* ------------------------------------------------------------------ */
test('빌드: 성공하고 산출물이 최신이며 외부 URL·금지 API가 없다', () => {
  const out = build({ write: false });
  assert.equal(out.summary.length, 8);
  assert.deepEqual(findForbidden(out.html), []);
  assert.doesNotMatch(out.html.replace(/url\(data:font\/ttf;base64,[A-Za-z0-9+/=]+\)/, ''), /https?:\/\/|www\./);
  assert.equal(fs.readFileSync(path.join(ROOT, OUTPUT_NAME), 'utf8'), out.html, 'elliptic-curve.html 이 최신이 아닙니다. node build.mjs 를 다시 실행하세요.');
});

test('산출물: 푸터 작성자, window.ellipticPlayer, 내장 소리(해설·분필), 줄어든 동작 CSS, 내장 글꼴', () => {
  const html = read(OUTPUT_NAME);
  assert.match(html, /<footer[\s\S]*작성: Microsoft Korea STU[\s\S]*<\/footer>/);
  assert.match(html, /window\.ellipticPlayer\s*=/);
  assert.match(html, /window\.LESSON_DATA\s*=/);
  assert.match(html, /@font-face\{font-family:ChalkKorean;src:url\(data:font\/ttf;base64,/);
  assert.match(html, /prefers-reduced-motion/);
  // 소리는 내장 MP3 만 쓴다: 합성 소리(발진기·잡음 버퍼·브라우저 음성합성)와 <audio>/<video> 요소는 없다
  assert.doesNotMatch(html, /<audio|<video|speechSynthesis|SpeechSynthesis|createOscillator|createBuffer\(/);
  assert.equal((html.match(/data:audio\/mpeg;base64,/g) || []).length, 9, '해설 8개 + 분필 1개');
  assert.match(html, /<html lang="ko"/);
  assert.match(html, /<canvas id="board"/);
  assert.doesNotMatch(html, /<svg[^>]*>\s*<(?:circle|path)[^>]*><\/(?:circle|path)>\s*<\/svg>\s*<canvas/); // 판서는 Canvas
});

test('폴더 규칙: HTML은 template.html 과 elliptic-curve.html 뿐 (목록이 하나만 고르도록)', () => {
  const found = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.html?$/i.test(e.name)) found.push(path.relative(ROOT, p));
    }
  };
  walk(ROOT);
  assert.deepEqual(found.sort(), [OUTPUT_NAME, TEMPLATE_NAME].sort());
  assert.ok(fs.existsSync(path.join(ROOT, 'assets', 'OFL.txt')));
});

test('player.js: 안전한 DOM 사용과 필수 API', () => {
  const src = read('player.js');
  for (const method of ['getState', 'goTo', 'play', 'pause', 'toggle', 'next', 'prev', 'replay', 'restart', 'seek', 'setSpeed', 'setAuto', 'layoutReport']) {
    assert.match(src, new RegExp('\\b' + method + '\\b'), method);
  }
  assert.doesNotMatch(src, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function|fetch\(|XMLHttpRequest/);
  assert.match(src, /prefers-reduced-motion/);
  assert.match(src, /Math\.min\(rect\.w \/ \(v\.x\[1\] - v\.x\[0\]\), rect\.h \/ \(v\.y\[1\] - v\.y\[0\]\)\)/, '등축: 가로·세로 배율이 하나의 s');
});

/* ------------------------------------------------------------------ */
test('빌드 실패: 모르는 요소·없는 점·틀린 expect·잘못된 색·잘못된 토큰', () => {
  const cases = [
    ['unknown-element', (s) => { s.steps[0].board.elements.push({ type: 'hexagon', at: 1 }); }, /쓸 수 없는 요소/],
    ['missing-point', (s) => { s.steps[1].board.elements.push({ type: 'point', ref: 'Nope', color: 'white', at: 1 }); }, /정의되지 않은 점/],
    ['bad-expect', (s) => { s.steps[0].math.points.Am.expect = ['1', '1']; }, /기대값/],
    ['bad-color', (s) => { s.steps[0].board.elements[2].color = 'purple'; }, /팔레트 밖의 색/],
    ['bad-token', (s) => { s.steps[0].panel[0].text = 'y^2 = x^3'; }, /\^|토큰|서식/],
    ['unknown-ref', (s) => { s.steps[0].panel[1].text = '[[Zed]]'; }, /Zed|정의되지 않은/],
    ['bad-schema', (s) => { s.schema = 'nope/9'; }, /schema|스키마/],
  ];
  for (const [name, mutate, pattern] of cases) {
    const s = clone(scene());
    mutate(s);
    const { errors } = validateScene(s);
    assert.ok(errors.length > 0, `${name}: 오류가 있어야 합니다`);
    assert.match(errors.join('\n'), pattern, name);
  }
});

test('빌드 실패: 글꼴에 없는 글자, 외부 URL, 다른 HTML, 빠진 토큰, 깨진 JSON', () => {
  const failing = (mutate, pattern, label) => {
    withTempCopy(mutate, (dir) => assert.throws(() => build({ root: dir, write: false }), pattern, label));
  };
  failing((dir) => editFile(dir, 'elliptic-curve.scene.json', (t) => t.replace('"y^{2} = x^{3} + ax + b"', '"y² = x³ → ∞"')), /글꼴에 없는 글자/, 'glyph');
  failing((dir) => editFile(dir, 'template.html', (t) => t.replace('</body>', '<img src="https://example.com/a.png"></body>')), /외부 URL|src/, 'external-url');
  failing((dir) => editFile(dir, 'style.css', (t) => '@import url("https://fonts.googleapis.com/css2?family=Nanum+Pen+Script");\n' + t), /@import|외부 URL|구글/, 'google-fonts');
  failing((dir) => editFile(dir, 'player.js', (t) => t + '\nfetch("x");\n'), /fetch/, 'fetch');
  failing((dir) => editFile(dir, 'player.js', (t) => t + '\ndocument.body.innerHTML = "x";\n'), /HTML 문자열 삽입/, 'innerHTML');
  failing((dir) => fs.writeFileSync(path.join(dir, 'other.html'), '<html></html>'), /HTML을 둘 수 없습니다/, 'extra-html');
  failing((dir) => editFile(dir, 'template.html', (t) => t.replace('/*__PLAYER__*/', '')), /__PLAYER__/, 'missing-token');
  failing((dir) => editFile(dir, 'elliptic-curve.scene.json', (t) => t.slice(0, t.length - 40)), /읽을 수 없습니다/, 'malformed-json');
  failing((dir) => editFile(dir, 'player.js', (t) => t + '\n/* </script> */\n'), /<\/script/, 'script-break');
});

test('findForbidden: 금지 항목을 실제로 잡아낸다', () => {
  for (const [html, pattern] of [
    ['<a href="https://x.test">', /http/],
    ['<script>fetch("/a")</script>', /fetch/],
    ['<script>el.innerHTML = 1</script>', /HTML/],
    ['<style>@import "a.css";</style>', /@import/],
    ['<style>a{background:url(img.png)}</style>', /url\(\)/],
    ['<script>new WebSocket("ws://a")</script>', /WebSocket/],
  ]) {
    assert.match(findForbidden(html).join('\n'), pattern, html);
  }
  assert.deepEqual(findForbidden('<p>안녕</p><style>a{background:url(data:image/png;base64,AAAA)}</style>'), []);
});

test('수학 결과가 장면에 나오는 숫자와 같다 (자막·판서 글 ↔ 정확 연산)', () => {
  const s = scene();
  const text = (id) => {
    const st = s.steps.find((x) => x.id === id);
    const r = EC.resolveMath(st.math);
    const sub = (t) => EC.substitute(t, r);
    return [st.summary, ...st.beats.map((b) => b.text), ...st.panel.map((p) => p.text), st.callout.text].map(sub).join('\n');
  };
  assert.match(text('chord'), /P \+ Q = -R = \(2, 2\)/);
  assert.match(text('chord'), /m = \(-1 - 2\) \/ \(1 - \(-2\)\) = -1/);
  const chordLabels = JSON.stringify(s.steps.find((x) => x.id === 'chord').board.elements);
  assert.match(chordLabels, /R = \[\[R\]\]/);
  assert.equal(EC.substitute('[[R]]', EC.resolveMath(s.steps.find((x) => x.id === 'chord').math)), '(2, -2)');
  assert.match(text('scalar'), /\(1, -1\)/);
  assert.match(text('scalar'), /\(8, 22\)/);
  assert.match(text('scalar'), /\(-7\/4, 19\/8\)/);
  assert.match(text('finite'), /\(16, 4\)/);
  assert.match(text('finite'), /19/);
  assert.match(text('edwards'), /121665\/121666/);
});

/* ------------------------------------------------------------------ */
/* 소리: 해설 MP3 8개 + CC0 분필 녹음 1개를 빌드가 내장한다 */
const b64 = (uri) => Buffer.from(uri.slice(uri.indexOf(',') + 1), 'base64');
const DATA_AUDIO = /^data:audio\/mpeg;base64,[A-Za-z0-9+/=]+$/;
/** 짧은 ID3v2.3 꼬리표(TXXX 한 프레임). */
function id3v2(text) {
  const body = Buffer.concat([Buffer.from([0]), Buffer.from('src\0' + text, 'latin1')]);
  const frame = Buffer.concat([Buffer.from('TXXX', 'latin1'), Buffer.from([0, 0, (body.length >> 8) & 255, body.length & 255, 0, 0]), body]);
  const n = frame.length;
  return Buffer.concat([Buffer.from('ID3', 'latin1'), Buffer.from([3, 0, 0, (n >> 21) & 127, (n >> 14) & 127, (n >> 7) & 127, n & 127]), frame]);
}

test('소리: 해설 클립 8개와 분필 녹음이 data:audio/mpeg 로 장면에 내장되고, 원본 장면 파일은 그대로다', () => {
  const out = build({ write: false });
  const raw = scene();
  assert.equal(out.scene.steps.length, 8);
  for (const st of out.scene.steps) {
    assert.match(st.audio, DATA_AUDIO, st.id);
    assert.ok(st.audioDuration >= 40 && st.audioDuration < 90, `${st.id}: audioDuration ${st.audioDuration}`);
    assert.ok(typeof st.narration === 'string' && st.narration.length > 100, st.id);
  }
  for (const st of raw.steps) assert.equal(st.audio, undefined, '원본 JSON 에는 오디오를 넣지 않는다');
  assert.equal(raw.chalkSound, undefined);
  assert.match(out.scene.chalkSound.audio, DATA_AUDIO);
  assert.ok(out.scene.chalkSound.duration >= 4, '분필 녹음은 4초 이상 (조각 순환에 필요)');
  assert.match(out.html, /window\.LESSON_DATA = \{/);
  // 장면 JSON 안에 들어간 오디오가 파일과 같은 소리다 (태그만 없음)
  for (const st of out.scene.steps) {
    const file = stripMp3Tags(fs.readFileSync(path.join(ROOT, 'audio', st.id + '.mp3')));
    assert.ok(b64(st.audio).equals(file), st.id + ' 내장 오디오가 파일과 다름');
  }
});

test('소리: 내장 MP3 는 실제로 MP3 프레임이고 길이가 durations.json 과 같다 (±0.1초), 클립은 판서보다 길다', () => {
  const out = build({ write: false });
  const durations = JSON.parse(read('audio/durations.json'));
  const rep = validateScene(scene());
  out.scene.steps.forEach((st, i) => {
    const info = mp3Info(b64(st.audio));
    assert.ok(info.frames > 1000, st.id);
    assert.equal(info.sampleRate, 24000);
    assert.equal(info.junkBytes, 0, st.id + ': 프레임 사이 쓰레기 바이트');
    assert.ok(Math.abs(info.duration - durations[st.id]) < 0.1, `${st.id}: 프레임 길이 ${info.duration} vs durations ${durations[st.id]}`);
    assert.equal(st.audioDuration, durations[st.id]);
    assert.ok(st.audioDuration > rep.steps[i].timeline.animEnd + 10, `${st.id}: 해설이 판서보다 충분히 길다(해설 마저 듣는 구간)`);
  });
  const chalk = mp3Info(b64(out.scene.chalkSound.audio));
  assert.ok(chalk.duration > 13 && chalk.duration < 15, String(chalk.duration));
});

test('소리: 해설 대본(narration)과 MP3 가 한 쌍이다 (scriptSha256 일치) — 대본을 고치면 빌드가 막는다', () => {
  const provider = JSON.parse(read('audio/provider.json'));
  const crypto = require('node:crypto');
  for (const st of scene().steps) {
    assert.ok(st.narration && st.narration.length > 100, st.id);
    assert.equal(crypto.createHash('sha256').update(st.narration).digest('hex'), provider.scriptSha256[st.id], st.id);
    assert.match(st.narration, /[가-힣]/);
    assert.doesNotMatch(st.narration, /https?:|www\./);
  }
  withTempCopy((dir) => editFile(dir, 'elliptic-curve.scene.json', (t) => t.replace(/("id": "chord"[\s\S]*?"narration": ")/, '$1바뀐 대본. ')), (dir) => {
    assert.throws(() => build({ root: dir, write: false }), /chord[\s\S]*(오래된|대본|다시 생성|narrate)/);
  });
});

test('소리: 출처 메타데이터에서 URL 을 걷어 내고 허용 목록 필드만 내장한다 (분필 CC0 녹음, 합성 해설 공시)', () => {
  const out = build({ write: false });
  const c = out.scene.chalkSound;
  assert.deepEqual(Object.keys(c).sort(), ['audio', 'creator', 'duration', 'edits', 'license', 'recorded', 'title']);
  assert.equal(c.license, 'CC0-1.0');
  assert.equal(c.recorded, true);
  assert.equal(c.creator, 'digitale.de');
  assert.match(c.title, /Writing with Chalk/);
  const p = out.scene.narrationProvider;
  assert.equal(p.voice, 'ko-KR-Haena:MAI-Voice-2');
  assert.equal(p.model, 'MAI-Voice-2');
  assert.equal(p.language, 'ko-KR');
  assert.equal(p.synthetic, true);
  assert.equal(p.scriptSha256, undefined);
  assert.equal(p.auth, undefined);
  const withoutAudio = out.html.replace(/data:audio\/mpeg;base64,[A-Za-z0-9+/=]+/g, 'data:audio');
  assert.doesNotMatch(withoutAudio, /https?:\/\/|www\.|freesound|creativecommons\.org/i);
  // 원본 출처 파일에는 URL 이 있지만(감사용) 산출물에는 한 글자도 없다
  assert.match(read('assets/chalk-writing-source.json'), /https:\/\//);
  assert.match(out.html, /digitale\.de/);
  assert.match(out.html, /CC0/);
});

test('소리: MP3 꼬리표(ID3v2/ID3v1)에 든 URL 은 내장 전에 지워진다 — 오디오 본문에 URL 이 남으면 빌드가 실패한다', () => {
  const chalkPath = (dir) => path.join(dir, 'assets', 'chalk-writing.mp3');
  // 1) ID3v2 + ID3v1 꼬리표에 URL: 걷어 내고 빌드 성공
  withTempCopy((dir) => {
    const body = stripMp3Tags(fs.readFileSync(chalkPath(dir)));
    const v1 = Buffer.concat([Buffer.from('TAG', 'latin1'), Buffer.from('http://v1.example/x'.padEnd(125, '\0'), 'latin1')]);
    fs.writeFileSync(chalkPath(dir), Buffer.concat([id3v2('https://evil.example/a'), body, v1]));
  }, (dir) => {
    const out = build({ root: dir, write: false });
    assert.doesNotMatch(out.html.replace(/data:audio\/mpeg;base64,[A-Za-z0-9+/=]+/g, ''), /evil|v1\.example/);
    const payload = b64(out.scene.chalkSound.audio);
    assert.ok(!payload.includes('evil.example') && !payload.includes('v1.example'));
    assert.notEqual(payload.subarray(0, 3).toString('latin1'), 'ID3');
    assert.equal(mp3Info(payload).junkBytes, 0);
  });
  // 2) 프레임 본문 안의 URL 바이트: 지울 수 없으므로 빌드 실패
  withTempCopy((dir) => {
    const f = path.join(dir, 'audio', 'shape.mp3');
    const buf = fs.readFileSync(f);
    Buffer.from('https://evil.example/', 'latin1').copy(buf, 5000);
    fs.writeFileSync(f, buf);
  }, (dir) => assert.throws(() => build({ root: dir, write: false }), /audio\/shape\.mp3[\s\S]*(URL|http)/));
});

test('빌드 실패(소리): 빠진 클립·잘린 클립·길이 불일치·MP3 아님·잘못된 목소리·CC0 아님·녹음 아님·너무 짧은 분필', () => {
  const failing = (mutate, pattern, label) => withTempCopy(mutate, (dir) => assert.throws(() => build({ root: dir, write: false }), pattern, label));
  failing((dir) => fs.rmSync(path.join(dir, 'audio', 'scalar.mp3')), /audio\/scalar\.mp3/, 'missing clip');
  failing((dir) => fs.writeFileSync(path.join(dir, 'audio', 'finite.mp3'), 'not an mp3 '.repeat(500)), /audio\/finite\.mp3[\s\S]*(MP3|프레임)/, 'not mp3');
  failing((dir) => { const f = path.join(dir, 'audio', 'ecdlp.mp3'); fs.writeFileSync(f, fs.readFileSync(f).subarray(0, 300000)); }, /audio\/ecdlp\.mp3[\s\S]*길이/, 'truncated');
  failing((dir) => editFile(dir, 'audio/durations.json', (t) => t.replace('"edwards": 58.08', '"edwards": 20.5')), /edwards[\s\S]*길이/, 'duration mismatch');
  failing((dir) => editFile(dir, 'audio/durations.json', (t) => t.replace(/,\s*"x509": [0-9.]+/, '')), /x509[\s\S]*durations/, 'missing duration');
  failing((dir) => editFile(dir, 'audio/provider.json', (t) => t.replace('ko-KR-Haena:MAI-Voice-2', 'en-US-Other:Voice')), /목소리|voice/i, 'voice');
  failing((dir) => editFile(dir, 'audio/provider.json', (t) => t.replace(/"synthetic": true/, '"synthetic": false')), /synthetic|합성/, 'synthetic flag');
  failing((dir) => editFile(dir, 'assets/chalk-writing-source.json', (t) => t.replace('"CC0-1.0"', '"CC-BY-4.0"')), /CC0/, 'license');
  failing((dir) => editFile(dir, 'assets/chalk-writing-source.json', (t) => t.replace('"recorded": true', '"recorded": false')), /녹음|recorded/, 'recorded');
  failing((dir) => { const f = path.join(dir, 'assets', 'chalk-writing.mp3'); fs.writeFileSync(f, fs.readFileSync(f).subarray(0, 40000)); }, /chalk-writing\.mp3[\s\S]*(4초|짧)/, 'short chalk');
  failing((dir) => editFile(dir, 'elliptic-curve.scene.json', (t) => t.replace(/("id": "shape"[\s\S]*?)"narration": "[^"]*"/, '$1"narration": ""')), /steps\[0\]\.narration/, 'empty narration');
});

test('mp3Info/stripMp3Tags: 프레임 길이를 정확히 세고, 꼬리표를 걷어 낸다', () => {
  const clip = fs.readFileSync(path.join(ROOT, 'audio', 'shape.mp3'));
  const info = mp3Info(clip);
  assert.equal(info.frames, 1870);
  assert.ok(Math.abs(info.duration - 44.88) < 1e-9);
  assert.equal(info.sampleRate, 24000);
  assert.equal(info.channels, 1);
  const tagged = Buffer.concat([id3v2('http://x.test/y'), clip]);
  assert.ok(tagged.includes('x.test'));
  const clean = stripMp3Tags(tagged);
  assert.ok(clean.equals(clip));
  assert.equal(mp3Info(Buffer.from('아무 소리도 아닌 파일')).frames, 0);
});

test('템플릿: 해설·분필 컨트롤이 있고 분필 음량 기본은 25%, 설명은 "소리 없음"이 아니다', () => {
  const t = read(TEMPLATE_NAME);
  for (const id of ['voice-toggle', 'chalk-toggle', 'chalk-volume', 'chalk-volume-value', 'voice-label', 'voice-note', 'chalk-note', 'voice-chip-label', 'auto-toggle', 'speed', 'reduced-note']) {
    assert.match(t, new RegExp('id="' + id + '"'), id);
  }
  assert.match(t, /<input id="chalk-volume" type="range" min="0" max="100" step="1" value="25">/);
  assert.match(t, /<output id="chalk-volume-value"[^>]*>25%<\/output>/);
  assert.match(t, /id="voice-note"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(t, /id="chalk-note"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.doesNotMatch(t, /소리 없는 판서|해설 음성은 없습니다|silent-chip/);
  assert.match(t, /digitale\.de/);
  assert.match(t, /CC0/);
  assert.match(t, /MAI-Voice-2|Haena|합성/);
  assert.match(read('style.css'), /\.voice-note\.is-error/);
  assert.match(read('style.css'), /\.chalk-volume/);
});

test('player.js: 합성 소리 금지 (발진기·잡음 버퍼·음성합성 없음), 녹음 MP3 만 재생', () => {
  const src = read('player.js');
  assert.doesNotMatch(src, /speechSynthesis|SpeechSynthesis|createOscillator|createBuffer\(|createScriptProcessor|new OfflineAudioContext/);
  assert.match(src, /decodeAudioData/);
  assert.match(src, /new Audio\(/);
  assert.match(src, /NotAllowedError/);
  assert.match(src, /pagehide/);
  assert.match(src, /visibilitychange/);
  for (const method of ['setVoiceEnabled', 'setChalkEnabled', 'setChalkVolume']) assert.match(src, new RegExp('\\b' + method + '\\b'), method);
  assert.doesNotMatch(src, /소리는 나오지 않|소리 없음/);
});

test('README: 소리 없는 판서가 아니라 해설이 있는 판서로 안내하고, 소리 출처·재생성·검증 방법을 적는다', () => {
  const r = read('README.md');
  assert.doesNotMatch(r, /소리 없는|소리는 나지 않|해설 음성은 없|음성 없이/);
  for (const needle of ['해설', 'ko-KR-Haena', 'MAI-Voice-2', 'CC0', 'digitale.de', 'narrate.py', 'verify_media.py', 'verify_chalk.py', 'verify_browser.py', 'player.test.mjs', '25%', '0.9']) {
    assert.ok(r.includes(needle), 'README 에 "' + needle + '" 이(가) 없습니다');
  }
});
