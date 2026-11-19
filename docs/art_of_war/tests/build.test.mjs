// 손자병법 칠판 강의 테스트.  실행: node --test docs/art_of_war/tests/
// - 장면 파일(원본)의 약속과 build.mjs 의 검증·점검 규칙을 확인한다.
// - 엔진이 있으면 메모리에서 한 번 빌드해 결과물과 저장된 art-of-war.html 을 비교한다. 디스크에는 아무것도 쓰지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateScene, auditPage, buildPage, findEngine, SCENE_FILE, OUT_FILE } from '../build.mjs';

const dir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sceneRaw = fs.readFileSync(SCENE_FILE, 'utf8');
const clone = () => JSON.parse(sceneRaw);
const scene = clone();

let engine = null;
try { engine = findEngine(); } catch { /* 엔진이 없으면 빌드가 필요한 테스트는 건너뛴다 */ }
const needsEngine = { skip: engine ? false : 'chalk-talk 엔진을 찾지 못했습니다' };

test('장면: 8단계 · 노드 10 · 간선 10 · 검증 통과', () => {
  assert.equal(scene.steps.length, 8);
  assert.equal(scene.nodes.length, 10);
  assert.equal(scene.edges.length, 10);
  assert.deepEqual(validateScene(scene), []);
});

test('장면: 증명 모드 꺼짐, code/calls/inferred 없음', () => {
  assert.equal(scene.proof, false);
  assert.doesNotMatch(sceneRaw, /"(code|calls|inferred|root)"\s*:/);
});

test('장면: 출처는 영상 제목·채널만 확인된 것으로 표시하고 19:03 링크를 가진다', () => {
  const s = scene.source;
  assert.deepEqual(s.verified, ['title', 'channel']);
  assert.equal(s.channel, '인문학이랑');
  assert.equal(s.channelUrl, 'https://www.youtube.com/@humanitieserang');
  assert.equal(s.url, 'https://www.youtube.com/watch?v=MfY0Xaa1P2g&t=1143s');
  assert.equal(s.at, '19:03');
  assert.equal(19 * 60 + 3, 1143);
});

test('장면: 강의 노트는 네 필드만 가지고 영상 구간/장 링크가 없다', () => {
  for (const [i, st] of scene.steps.entries()) {
    assert.deepEqual(Object.keys(st.handout).sort(), ['classic', 'limit', 'modern', 'ref'], `steps[${i}]`);
  }
  assert.doesNotMatch(sceneRaw, /"video"\s*:/);
  assert.doesNotMatch(sceneRaw, /[?&]t=(?!1143s)\d+/); // 19:03 외의 시각 링크 없음
});

test('검증: 금지된 키·값을 거부한다', () => {
  const cases = [
    ['proof 켜짐', s => { s.proof = true; }, /proof/],
    ['code 키', s => { s.nodes[0].code = { file: 'x', line: 1 }; }, /"code"/],
    ['calls 키', s => { s.edges[0].calls = ['x']; }, /"calls"/],
    ['inferred 키', s => { s.edges[0].inferred = true; }, /"inferred"/],
    ['handout 의 video 키', s => { s.steps[0].handout.video = { url: 'https://example.com' }; }, /video/],
    ['handout 필드 누락', s => { delete s.steps[2].handout.limit; }, /limit/],
    ['확인 범위 확대', s => { s.source.verified = ['title', 'channel', 'transcript']; }, /verified/],
    ['at 과 t 불일치', s => { s.source.at = '19:04'; }, /같은 시각/],
    ['영어 문서', s => { s.lang = 'en'; }, /lang/],
    ['recap 없음', s => { for (const st of s.steps) delete st.recap; }, /recap/],
    ['유튜브가 아닌 영상 주소', s => { s.source.url = 'https://example.com/watch?v=x&t=1143s'; }, /youtube/],
  ];
  for (const [name, mutate, re] of cases) {
    const s = clone(); mutate(s);
    const problems = validateScene(s);
    assert.ok(problems.some(p => re.test(p)), `${name}: ${JSON.stringify(problems)}`);
  }
});

test('빌드: 결과물이 점검을 통과하고 저장된 HTML 과 같다', needsEngine, () => {
  const html = buildPage(sceneRaw, { engineDir: engine });
  assert.deepEqual(auditPage(html, scene), []);
  assert.equal(fs.readFileSync(OUT_FILE, 'utf8'), html, 'art-of-war.html 이 최신이 아닙니다: node build.mjs');
});

test('결과물: 한국어 UI, 출처 푸터, 강의 노트 서랍', needsEngine, () => {
  const html = buildPage(sceneRaw, { engineDir: engine });
  assert.match(html, /<html lang="ko"/);
  assert.match(html, /<title>손자병법, 싸우기 전에 이기는 판단<\/title>/);
  assert.match(html, /id="sr-title"[^>]*>손자병법/);
  for (const s of ['이전 단계', '다음 단계', '강의 노트']) assert.ok(html.includes(s), s);
  assert.match(html, /<footer class="src"[\s\S]*href="https:\/\/www\.youtube\.com\/@humanitieserang"/);
  assert.match(html, /href="https:\/\/www\.youtube\.com\/watch\?v=MfY0Xaa1P2g&amp;t=1143s"/);
  assert.match(html, /영상에서 확인한 것은 제목과 채널뿐/);
  assert.match(html, /id="notes-btn"/);
  assert.match(html, /<aside id="notes"/);
  assert.match(html, /steps\[/); // 서랍은 장면의 steps[k].handout 으로 채워진다
});

test('결과물: 외부 의존성과 오디오가 없다', needsEngine, () => {
  const html = buildPage(sceneRaw, { engineDir: engine });
  assert.doesNotMatch(html, /<link[\s>]/i);
  assert.doesNotMatch(html, /fonts\.(googleapis|gstatic)\.com/);
  assert.doesNotMatch(html, /<script[^>]*\ssrc=/i);
  assert.doesNotMatch(html, /<(audio|video|iframe|img)[\s>]/i);
  assert.doesNotMatch(html, /AudioContext|speechSynthesis|new\s+Audio\b/);
  assert.doesNotMatch(html, /\bfetch\s*\(|XMLHttpRequest|WebSocket/);
  const urls = new Set(html.match(/https?:\/\/[^\s"'<>)\\]+/g));
  assert.deepEqual([...urls].sort(), [
    'http://www.w3.org/2000/svg',
    'https://www.youtube.com/@humanitieserang',
    'https://www.youtube.com/watch?v=MfY0Xaa1P2g&amp;t=1143s',
    'https://www.youtube.com/watch?v=MfY0Xaa1P2g&t=1143s',
  ].sort());
});

test('점검: 외부 글꼴 링크·외부 주소·영어 UI 가 끼어들면 잡아낸다', needsEngine, () => {
  const html = buildPage(sceneRaw, { engineDir: engine });
  const cases = [
    ['글꼴 링크', html.replace('</head>', '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caveat"></head>')],
    ['외부 스크립트', html.replace('</body>', '<script src="https://cdn.example.com/x.js"></script></body>')],
    ['외부 주소', html.replace('</footer>', '<a href="https://example.com/">x</a></footer>')],
    ['영어 ARIA', html.replace('aria-label="이전 단계"', 'aria-label="Previous step"')],
    ['오디오', html.replace('</body>', '<script>new AudioContext()</script></body>')],
  ];
  for (const [name, bad] of cases) assert.ok(auditPage(bad, scene).length > 0, name);
});

test('폴더: HTML 은 art-of-war.html 하나뿐이고 생성물이 섞여 있지 않다', () => {
  const files = fs.readdirSync(dir).sort();
  assert.deepEqual(files.filter(f => f.endsWith('.html')), ['art-of-war.html']);
  assert.ok(!files.some(f => /\.(png|svg|mp3|wav|ogg|woff2?|ttf|otf)$/i.test(f)), files.join(', '));
  assert.ok(!files.some(f => /-snaps$/.test(f)), files.join(', '));
  assert.ok(files.includes('README.md') && files.includes('build.mjs') && files.includes('art-of-war.scene.json'));
});
