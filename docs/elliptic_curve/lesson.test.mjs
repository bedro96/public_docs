// 강의 데이터·빌드·산출물 검증.  실행: node --test   (이 폴더에서)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, OUTPUT_NAME, TEMPLATE_NAME, SCHEMA, loadCmap, missingGlyphs, validateScene, findForbidden, build } from './build.mjs';

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
    out.push(st.title, st.nav, st.summary, st.tag.text, st.callout.title, st.callout.text, st.alt);
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
    for (const f of ['elliptic-curve.scene.json', 'template.html', 'style.css', 'ecmath.js', 'player.js']) fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
    fs.copyFileSync(path.join(ROOT, 'assets', 'NanumPenScript-Regular.ttf'), path.join(dir, 'assets', 'NanumPenScript-Regular.ttf'));
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
  // 오해 바로잡기 제목처럼 따옴표로 인용된 표현('풀 수 없다')은 허용, 직접 단정은 금지
  assert.doesNotMatch(texts, /(?<!')(풀 수 없다|불가능하다|절대 (못|안))/, '단정적 불가능 표현');
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

test('산출물: 푸터 작성자, window.ellipticPlayer, 소리 없음, 줄어든 동작 CSS, 내장 글꼴', () => {
  const html = read(OUTPUT_NAME);
  assert.match(html, /<footer[\s\S]*작성: Microsoft Korea STU[\s\S]*<\/footer>/);
  assert.match(html, /window\.ellipticPlayer\s*=/);
  assert.match(html, /window\.LESSON_DATA\s*=/);
  assert.match(html, /@font-face\{font-family:ChalkKorean;src:url\(data:font\/ttf;base64,/);
  assert.match(html, /prefers-reduced-motion/);
  assert.doesNotMatch(html, /<audio|new Audio|AudioContext|speechSynthesis|SpeechSynthesis|<video/);
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
