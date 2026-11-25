// 강의 데이터·빌드·산출물 검증.   실행: node --test   (이 폴더에서)
//
// 두 종류의 내용을 검사합니다.
//  - tests/fixtures/content : 이 테스트 전용의 작은 시험 내용(보드 종류별 1단계). 실제 내용이 없어도 돌아갑니다.
//  - content/               : 실제 강의 내용. 14단계 + 00-meta 가 모두 있을 때만 검사합니다(없으면 건너뜀).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { ROOT, OUTPUT_NAME, SCENE_NAME, TEMPLATE_NAME, SCHEMA, AUDIO_MIME, loadContent, findForbidden, build, mp3Info, stripMp3Tags, missingGlyphs, loadCmap } from './build.mjs';
import { validateLesson, validateDir, assembleScene, BOARD_KINDS, EXPECTED_IDS, NARRATION_MIN, NARRATION_MAX } from './validate.mjs';
import { loadFonts } from './fonts.mjs';
import { withStandInRoot } from './tests/standin-build.mjs';

const require = createRequire(import.meta.url);
const Q = require('./qmath.js');

const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');
const clone = (v) => JSON.parse(JSON.stringify(v));
const FIXTURE_DIR = path.join(ROOT, 'tests', 'fixtures', 'content');
const REAL_DIR = path.join(ROOT, 'content');
const HAS_FFMPEG = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' }).status === 0;

const fixtureScene = () => {
  const r = loadContent(FIXTURE_DIR, { free: true });
  assert.deepEqual(r.problems, []);
  return clone(assembleScene(r));
};
const stepOf = (s, id) => s.steps.find((x) => x.id === id);
const elemOf = (s, id, type, n = 0) => stepOf(s, id).board.elements.filter((e) => e.type === type)[n];
const errorsOf = (scene, opts = { strictStructure: false }) => validateLesson(scene, opts).errors.map((e) => e.where + ' | ' + e.msg);
const warningsOf = (scene, opts = { strictStructure: false }) => validateLesson(scene, opts).warnings.map((e) => e.where + ' | ' + e.msg);
const hasError = (scene, pattern, label) => {
  const errs = errorsOf(scene);
  assert.ok(errs.some((e) => pattern.test(e)), (label || String(pattern)) + ' — 오류 목록: ' + JSON.stringify(errs.slice(0, 5)));
};

const realLoaded = loadContent(REAL_DIR);
const hasReal = realLoaded.pending.length === 0 && realLoaded.problems.length === 0 && !!realLoaded.meta;
const SKIP_REAL = !hasReal && '실제 내용(14단계 + 00-meta.json)이 모두 있을 때만 검사합니다';

/* ------------------------------------------------------------------ */
/* 임시 폴더 도구                                                      */
/* ------------------------------------------------------------------ */
const SOURCES = [TEMPLATE_NAME, 'style.css', 'qmath.js', 'player.js'];
const ASSETS = ['NanumPenScript-Regular.ttf', 'QMath-subset.ttf', 'OFL.txt', 'LICENSE-DejaVu.txt', 'chalk-writing.mp3', 'chalk-writing-source.json'];

/** 임시 폴더에 빌드에 필요한 파일(+ 시험 내용)을 복사해 놓고 mutate 로 고친 뒤 fn 을 돌립니다. */
function withTempRoot(mutate, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qp-build-'));
  try {
    fs.mkdirSync(path.join(dir, 'assets'));
    fs.mkdirSync(path.join(dir, 'content'));
    for (const f of SOURCES) fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
    for (const f of ASSETS) fs.copyFileSync(path.join(ROOT, 'assets', f), path.join(dir, 'assets', f));
    for (const f of fs.readdirSync(FIXTURE_DIR)) fs.copyFileSync(path.join(FIXTURE_DIR, f), path.join(dir, 'content', f));
    mutate(dir);
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
const editFile = (dir, name, fnEdit) => fs.writeFileSync(path.join(dir, name), fnEdit(fs.readFileSync(path.join(dir, name), 'utf8')));
const editJson = (dir, name, fnEdit) => {
  const j = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
  fnEdit(j);
  fs.writeFileSync(path.join(dir, name), JSON.stringify(j, null, 2));
};
const buildNoAudio = (dir, extra = {}) => build({ root: dir, content: 'content', write: false, noAudio: true, ...extra });
const buildWithAudio = (dir, extra = {}) => build({ root: dir, content: 'content', write: false, clipMinSeconds: 4, ...extra });

/** 가짜 해설 클립까지 갖춘 "마스터" 폴더를 한 번만 만들고(ffmpeg), 각 시험은 그것을 복사해 씁니다. */
let master = null;
function audioMaster() {
  if (master) return master;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qp-master-'));
  withStandInRoot({}, (src) => { fs.cpSync(src, dir, { recursive: true }); });
  master = dir;
  return dir;
}
test.after(() => { if (master) fs.rmSync(master, { recursive: true, force: true }); });

function withAudioRoot(mutate, fn) {
  const src = audioMaster();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qp-audio-'));
  try {
    fs.cpSync(src, dir, { recursive: true });
    mutate(dir);
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
const SKIP_AUDIO = !HAS_FFMPEG && 'ffmpeg 가 없어 가짜 해설 클립을 만들 수 없습니다';

/* ------------------------------------------------------------------ */
/* 1. 시험 내용(fixture)                                               */
/* ------------------------------------------------------------------ */
test('시험 내용: 보드 4종이 모두 있고 스키마 검증을 오류 0건으로 통과한다', () => {
  const r = validateDir(FIXTURE_DIR, { free: true, strict: true });
  assert.deepEqual(r.errors.map((e) => e.file + ' ' + e.where + ' ' + e.msg), []);
  assert.equal(r.pending.length, 0);
  assert.equal(r.scene.schema, SCHEMA);
  assert.equal(SCHEMA, 'quantum-physics-lesson/1');
  assert.deepEqual([...new Set(r.scene.steps.map((s) => s.board.kind))].sort(), [...BOARD_KINDS].sort());
  const graph = stepOf(r.scene, 'graphall');
  assert.deepEqual([...new Set(graph.board.elements.map((e) => e.type))].sort(), ['area', 'axes', 'ellipse', 'fn', 'point', 'seg', 'text']);
  assert.equal(stepOf(r.scene, 'flowsix').board.elements.length, 6);
  assert.ok(stepOf(r.scene, 'barsmark').board.markers.length >= 2);
  assert.equal(stepOf(r.scene, 'chalkonly').board.elements.length, 0);
  assert.equal(stepOf(r.scene, 'graphequal').board.equalAspect, true);
});

test('완결성: 일부 파일뿐이면 pending 으로 보고하고 오류는 아니며, --strict 에서만 오류', () => {
  const partial = validateDir(REAL_DIR);
  assert.equal(partial.errors.filter((e) => /--strict/.test(e.msg)).length, 0, '비 strict 에서는 대기 중 파일이 오류가 아님');
  assert.equal(partial.pending.length + partial.loaded.steps.length, EXPECTED_IDS.length, '파일은 존재하거나 pending 이거나 둘 중 하나');
  // 가짜 폴더: 파일이 하나도 없어도 죽지 않는다
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'qp-empty-'));
  try {
    const r = validateDir(empty);
    assert.equal(r.loaded.steps.length, 0);
    assert.equal(r.pending.length, EXPECTED_IDS.length + 1, '14단계 + 00-meta.json 모두 pending');
    assert.equal(r.errors.filter((e) => /--strict/.test(e.msg)).length, 0, '비 strict 에서는 pending 이 오류가 아님');
    const strict = validateDir(empty, { strict: true });
    assert.ok(strict.errors.length >= EXPECTED_IDS.length, 'strict: 모든 빠진 파일이 오류');
    assert.ok(strict.errors.some((e) => /--strict/.test(e.msg) && /01-/.test(e.msg)));
  } finally {
    fs.rmSync(empty, { recursive: true, force: true });
  }
});

test('validate.mjs CLI: 시험 내용은 종료 코드 0, 틀린 파일이 있으면 종료 코드 1', () => {
  const ok = spawnSync('node', ['validate.mjs', '--dir', 'tests/fixtures/content', '--quiet'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.match(ok.stdout, /통과/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qp-cli-'));
  try {
    for (const f of fs.readdirSync(FIXTURE_DIR)) fs.copyFileSync(path.join(FIXTURE_DIR, f), path.join(dir, f));
    editJson(dir, '03-flowsix.json', (j) => { j.narration = 'ABC 123'; });
    const bad = spawnSync('node', ['validate.mjs', '--dir', dir], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(bad.status, 1, bad.stdout);
    assert.match(bad.stdout, /03-flowsix\.json/);
    assert.match(bad.stdout, /실패/);
    const unknown = spawnSync('node', ['validate.mjs', '--nope'], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(unknown.status, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  // 대기 중 파일만 있는 실제 폴더: 오류가 아니면 종료 코드 0 (내용 에이전트가 쓰는 동안에도 돌려 볼 수 있어야 한다)
  const real = spawnSync('node', ['validate.mjs', '--quiet'], { cwd: ROOT, encoding: 'utf8' });
  assert.ok(real.status === 0 || real.status === 1);
  const strict = spawnSync('node', ['validate.mjs', '--strict', '--quiet'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(strict.status === 0, hasReal && real.status === 0, '--strict 는 14단계가 모두 있고 오류가 없을 때만 통과');
});

/* ------------------------------------------------------------------ */
/* 2. 나쁜 내용: 규칙 위반마다 정확한 오류                              */
/* ------------------------------------------------------------------ */
test('나쁜 내용(공통): 필수 필드·id·tag·callout·legend·alt·서식 토큰', () => {
  const ok = fixtureScene();
  assert.deepEqual(errorsOf(ok), []);

  let s = clone(ok); delete stepOf(s, 'flowsix').title; hasError(s, /title/, 'title 빠짐');
  s = clone(ok); delete stepOf(s, 'flowsix').nav; hasError(s, /nav/, 'nav 빠짐');
  s = clone(ok); stepOf(s, 'flowsix').id = 'Flow Six'; hasError(s, /id/, 'id 형식');
  s = clone(ok); stepOf(s, 'flowsix').id = 'graphall'; hasError(s, /겹칩니다/, 'id 중복');
  s = clone(ok); stepOf(s, 'flowsix').tag.tone = 'fun'; hasError(s, /tag.*tone|concept/, 'tag tone');
  s = clone(ok); stepOf(s, 'flowsix').callout.tone = 'danger'; hasError(s, /callout.*tone|info/, 'callout tone');
  s = clone(ok); stepOf(s, 'graphall').legend[0].style = 'wavy'; hasError(s, /legend.*style|line/, 'legend style');
  s = clone(ok); stepOf(s, 'graphall').legend[0].color = 'purple'; hasError(s, /color|white/, 'legend color');
  s = clone(ok); delete stepOf(s, 'flowsix').alt; hasError(s, /alt/, 'alt 빠짐');
  s = clone(ok); stepOf(s, 'chalkonly').panel[0].text = 'x^2'; hasError(s, /서식 오류/, '서식 토큰 ^ 단독');
  s = clone(ok); stepOf(s, 'chalkonly').panel[0].text = 'E_{n'; hasError(s, /서식 오류/, '닫히지 않은 첨자');
  s = clone(ok); stepOf(s, 'chalkonly').panel[0].text = 'x²'; hasError(s, /첨자|서식/, '유니코드 첨자');
  s = clone(ok); stepOf(s, 'chalkonly').panel[0].text = '가'.repeat(40); hasError(s, /너무 깁니다/, '판서 줄 길이');
  s = clone(ok); stepOf(s, 'chalkonly').panel[0].color = 'purple'; hasError(s, /color|white/, '판서 색');
  s = clone(ok); stepOf(s, 'chalkonly').panel[0].size = 'xxl'; hasError(s, /size|xl/, '판서 크기');
  s = clone(ok); s.schema = 'other/1'; hasError(s, /schema/, 'schema');
  s = clone(ok); s.author = 'Someone'; hasError(s, /author/, 'author');
  s = clone(ok); s.lang = 'en'; hasError(s, /lang/, 'lang');
  s = clone(ok); s.misconceptions = []; hasError(s, /misconceptions/, '오해 없음');
  s = clone(ok); s.references = ['하나']; hasError(s, /references/, '참고문헌 부족');
});

test('나쁜 내용(해설): 길이 250~440자, 숫자·로마자·기호·한자 금지, 자막 at 오름차순·해설 끝 이전', () => {
  const ok = fixtureScene();
  assert.equal(NARRATION_MIN, 250);
  assert.equal(NARRATION_MAX, 440);
  const long = (n) => '가나다라마바사아자차 '.repeat(Math.ceil(n / 11)).slice(0, n).trim();
  let s = clone(ok); stepOf(s, 'flowsix').narration = long(120); hasError(s, /250/, '너무 짧은 해설');
  s = clone(ok); stepOf(s, 'flowsix').narration = long(480); hasError(s, /440/, '너무 긴 해설');
  const base = stepOf(ok, 'flowsix').narration;
  for (const [bad, label] of [['플랑크 상수 6.63', '숫자'], ['ABC 입자', '로마자'], ['λ 파장', '그리스 문자'], ['파동 (입자)', '괄호'], ['光子 입자', '한자'], ['입자—파동', '줄표'], ['입자 ψ', '기호']]) {
    s = clone(ok); stepOf(s, 'flowsix').narration = base.slice(0, 200) + ' ' + bad + ' ' + base.slice(200); hasError(s, /읽는 글자|narration/, label);
  }
  s = clone(ok); stepOf(s, 'flowsix').narration = ' ' + base; hasError(s, /공백/, '앞 공백');
  s = clone(ok); stepOf(s, 'flowsix').beats[1].at = stepOf(s, 'flowsix').beats[0].at; hasError(s, /오름차순|앞 자막/, 'beats.at 같음');
  s = clone(ok); stepOf(s, 'flowsix').beats[2].at = 120; hasError(s, /해설 끝|beats/, 'beats.at 해설 끝 뒤');
  s = clone(ok); stepOf(s, 'flowsix').beats = [{ at: 1, text: '하나뿐' }]; hasError(s, /자막/, '자막 개수');
  s = clone(ok); delete stepOf(s, 'flowsix').narration; hasError(s, /narration/, '해설 빠짐');
});

test('나쁜 내용(graph): expr 해석 오류·범위 밖·좌표 view 밖·알 수 없는 요소·색·dir', () => {
  const ok = fixtureScene();
  const g = 'graphall';
  let s = clone(ok); elemOf(s, g, 'fn').expr = 'sin(x'; hasError(s, /\.expr[\s\S]*해석/, '괄호');
  s = clone(ok); elemOf(s, g, 'fn').expr = '2x'; hasError(s, /곱셈/, '곱셈 생략');
  s = clone(ok); elemOf(s, g, 'fn').expr = 'foo(x)'; hasError(s, /알 수 없는 이름/, '모르는 함수');
  s = clone(ok); elemOf(s, g, 'fn').expr = 'constructor.constructor("1")()'; hasError(s, /해석할 수 없습니다/, '코드 주입 시도');
  s = clone(ok); elemOf(s, g, 'fn').expr = 'ln(x - 100)'; hasError(s, /어디서도 값이 정의되지 않습니다/, '전부 NaN');
  s = clone(ok); elemOf(s, g, 'fn').expr = '1000 + x'; hasError(s, /view\.y[\s\S]*밖/, '전부 화면 밖');
  s = clone(ok); elemOf(s, g, 'fn').expr = 42; hasError(s, /수식 문자열/, 'expr 가 문자열 아님');
  s = clone(ok); elemOf(s, g, 'point').x = 999; hasError(s, /view[\s\S]*밖/, '점이 view 밖');
  s = clone(ok); elemOf(s, g, 'seg').from = [1, 1]; elemOf(s, g, 'seg').to = [1, 1]; hasError(s, /같습니다/, '길이 0 선분');
  s = clone(ok); elemOf(s, g, 'ellipse').rx = 0; hasError(s, /0 보다 커야/, '타원 반지름 0');
  s = clone(ok); stepOf(s, g).board.elements.push({ type: 'spline', at: 1 }); hasError(s, /type/, '알 수 없는 요소 종류');
  s = clone(ok); elemOf(s, g, 'fn').color = 'purple'; hasError(s, /color|white/, '색 팔레트');
  s = clone(ok); elemOf(s, g, 'point').dir = 'up'; hasError(s, /dir|ul/, 'dir 값');
  s = clone(ok); stepOf(s, g).board.view = { x: [1, 0], y: [0, 1] }; hasError(s, /view\.x/, 'view 순서');
  s = clone(ok); delete stepOf(s, g).board.view; hasError(s, /board\.view/, 'view 빠짐');
  s = clone(ok); stepOf(s, g).board.elements.push(clone(stepOf(s, g).board.elements.find((e) => e.type === 'axes'))); hasError(s, /axes 는 하나만/, 'axes 중복');
  s = clone(ok); elemOf(s, g, 'fn').at = -1; hasError(s, /\.at/, 'at 음수');
  s = clone(ok); elemOf(s, g, 'fn').samples = 3; hasError(s, /samples/, 'samples 범위');
  s = clone(ok); stepOf(s, g).board.elements = []; hasError(s, /요소가 1개 이상/, '빈 graph');
  s = clone(ok); stepOf(s, 'graphequal').board.equalAspect = 'yes'; hasError(s, /equalAspect/, 'equalAspect 형식');
});

test('나쁜 내용(flow/bars/chalk): 노드 수·cols·막대 amount·markers·chalk elements', () => {
  const ok = fixtureScene();
  let s = clone(ok); stepOf(s, 'flowsix').board.elements.push({ type: 'node', id: 'n7', at: 1, title: '일곱', lines: [], color: 'sky' }); hasError(s, /2~6개/, '노드 7개');
  s = clone(ok); stepOf(s, 'flowsix').board.cols = 5; hasError(s, /cols/, 'cols 5');
  s = clone(ok); stepOf(s, 'flowsix').board.elements[1].id = stepOf(s, 'flowsix').board.elements[0].id; hasError(s, /겹칩니다/, '노드 id 중복');
  s = clone(ok); stepOf(s, 'flowsix').board.elements[0].lines = ['가', '나', '다', '라', '마', '바']; hasError(s, /줄이 너무 많습니다/, '노드 줄 수');
  s = clone(ok); stepOf(s, 'flowsix').board.elements[0].type = 'bar'; hasError(s, /"node"/, 'flow 에 bar');
  s = clone(ok); stepOf(s, 'barsmark').board.elements[0].amount = 99; hasError(s, /amount/, 'amount > axisMax');
  s = clone(ok); stepOf(s, 'barsmark').board.elements[0].count = 3; hasError(s, /count\/pow2/, '옛 count 필드');
  s = clone(ok); stepOf(s, 'barsmark').board.markers[0].at = 99; hasError(s, /markers\[0\]\.at|axisMax/, 'marker 범위');
  s = clone(ok); stepOf(s, 'barsmark').board.axisTicks = [0]; hasError(s, /axisTicks/, '눈금 1개');
  s = clone(ok); stepOf(s, 'barsmark').board.elements.length = 1; hasError(s, /2~6개/, '막대 1개');
  s = clone(ok); stepOf(s, 'chalkonly').board.elements = [{ type: 'text', at: 0, text: 'x' }]; hasError(s, /빈 배열/, 'chalk 에 요소');
  s = clone(ok); stepOf(s, 'chalkonly').board.kind = 'plane'; hasError(s, /board\.kind/, '옛 보드 종류');
  s = clone(ok); stepOf(s, 'chalkonly').board.kind = 'math'; hasError(s, /board\.kind/, '옛 math 종류');
});

test('나쁜 내용(글자·금지어): 두 글꼴에 없는 글자는 오류, QMath 가 가진 그리스·수학 기호는 통과', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qp-glyph-'));
  try {
    for (const f of fs.readdirSync(FIXTURE_DIR)) fs.copyFileSync(path.join(FIXTURE_DIR, f), path.join(dir, f));
    const good = validateDir(dir, { free: true });
    assert.deepEqual(good.errors, []);
    editJson(dir, '05-chalkonly.json', (j) => { j.panel[0].text = 'ψ ħ λ ν ⟩ ∫ √ ≥ Δ'; });
    assert.deepEqual(validateDir(dir, { free: true }).errors, [], '보장된 글자 집합은 통과');
    editJson(dir, '05-chalkonly.json', (j) => { j.panel[0].text = '😀 이모지'; });
    assert.ok(validateDir(dir, { free: true }).errors.some((e) => /글꼴|글자|glyph/i.test(e.msg) && /😀|U\+1F600/.test(e.msg + e.where)), '이모지는 두 글꼴 어디에도 없다');
    editJson(dir, '05-chalkonly.json', (j) => { j.panel[0].text = '漢字'; });
    assert.ok(validateDir(dir, { free: true }).errors.length > 0, '한자는 칠판 글꼴에 없다');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('나쁜 내용(금지어): 고객·기업 이름은 오류', () => {
  const ok = fixtureScene();
  const s = clone(ok);
  stepOf(s, 'chalkonly').callout.text = '삼성 반도체 이야기';
  const errs = errorsOf(s);
  assert.ok(errs.some((e) => /기업|고객/.test(e)), JSON.stringify(errs.slice(0, 4)));
});

test('글꼴 합집합: 나눔손글씨 펜 + QMath. 그리스 문자는 QMath 에만, 한글은 나눔에, 어디에도 없으면 build 에러 대상', () => {
  const fonts = loadFonts(ROOT);
  assert.ok(!fonts.error, fonts.error);
  const nanum = fonts.nanumInfo.cmap;
  const qmath = fonts.qmathInfo.cmap;
  for (const ch of 'ψħλνΔ∫√≥⟩⟨→') assert.ok(qmath.has(ch.codePointAt(0)), ch + ' 는 QMath 에 있어야 합니다');
  for (const ch of '가나다한글') assert.ok(nanum.has(ch.codePointAt(0)), ch + ' 는 나눔에 있어야 합니다');
  for (const ch of 'ψλ∫') assert.ok(!nanum.has(ch.codePointAt(0)), ch + ' 는 나눔에 없습니다(그래서 QMath 가 필요)');
  const miss = (text) => missingGlyphs([{ text, where: 't' }], [fonts.union]).map((m) => m.char).sort();
  assert.deepEqual(miss('ψħ가A1'), []);
  assert.deepEqual(miss('😀漢'), ['漢', '😀'].sort());
  assert.deepEqual(loadCmap(fs.readFileSync(path.join(ROOT, 'assets', 'QMath-subset.ttf'))), qmath);
});

test('QMath 부분 글꼴: SCHEMA 가 보장하는 글자 집합을 모두 가지고 있다', () => {
  const schema = fs.readFileSync(path.join(ROOT, 'content', 'SCHEMA.md'), 'utf8');
  const fonts = loadFonts(ROOT);
  const q = fonts.qmathInfo.cmap;
  // SCHEMA 의 '글꼴·글자 집합 (보장)' 절에서 글자 목록 불릿(ASCII/그리스/연산/화살표)의 `...` 안 글자를 뽑는다
  const sec = (schema.split(/## 글꼴·글자 집합/)[1] || '').split(/\n## /)[0];
  const lines = sec.split('\n').filter((l) => /^- (ASCII|그리스|연산|화살표)/.test(l));
  assert.equal(lines.length, 4, 'SCHEMA 글자 목록 불릿 4개');
  const chars = new Set();
  for (const line of lines) for (const m of line.matchAll(/`([^`]+)`/g)) for (const c of m[1]) if (c.trim() && c.codePointAt(0) > 0x7f) chars.add(c);
  assert.ok(chars.size >= 60, '보장 글자가 너무 적게 읽힘: ' + chars.size);
  const absent = [...chars].filter((c) => !q.has(c.codePointAt(0)));
  assert.deepEqual(absent, [], 'QMath 에 없는 보장 글자');
  for (let cp = 0x20; cp < 0x7f; cp++) assert.ok(q.has(cp), 'ASCII ' + String.fromCodePoint(cp));
});

/* ------------------------------------------------------------------ */
/* 3. 실제 내용                                                         */
/* ------------------------------------------------------------------ */
test('실제 내용: 14단계 순서·id·파일 이름, 스키마 검증 오류 0건', { skip: SKIP_REAL }, () => {
  const r = validateDir(REAL_DIR, { strict: true });
  assert.deepEqual(r.errors.map((e) => e.file + ' ' + e.where + ' ' + e.msg), []);
  assert.deepEqual(r.scene.steps.map((s) => s.id), EXPECTED_IDS);
  assert.equal(r.scene.steps.length, 14);
  assert.equal(r.scene.schema, SCHEMA);
  assert.equal(r.scene.author, 'Microsoft Korea STU');
  assert.ok(r.scene.title && r.scene.eyebrow, '제목·eyebrow');
  const kinds = new Set(r.scene.steps.map((s) => s.board.kind));
  assert.ok(kinds.has('graph'));
});

test('실제 내용: 해설은 250~440자·한글뿐이고 대본 길이가 쓸 만한 해설 시간을 만든다', { skip: SKIP_REAL }, () => {
  const scene = assembleScene(realLoaded);
  for (const st of scene.steps) {
    const len = Array.from(st.narration).length;
    assert.ok(len >= 250 && len <= 440, st.id + ': ' + len + '자');
    assert.match(st.narration, /^[가-힣 .,?!']+$/, st.id + ': 한글·공백·. , ? ! 뿐이어야 함');
    const est = Q.estimateNarration(st.narration);
    assert.ok(est >= 30 && est <= 80, st.id + ': 추정 해설 ' + est.toFixed(1) + '초');
    const tl = Q.stepTimeline(st);
    assert.ok(tl.animEnd <= est + 1.5, st.id + ': 판서 끝 ' + tl.animEnd.toFixed(1) + '초가 추정 해설 끝 ' + est.toFixed(1) + '초보다 늦음');
  }
});

test('실제 내용: 모든 글자가 내장 글꼴 두 개(나눔 + QMath)에 있고 고객 이름이 없다', { skip: SKIP_REAL }, () => {
  const r = validateDir(REAL_DIR, { strict: true });
  const fonts = loadFonts(ROOT);
  assert.ok(r.texts.length > 100, '판서·자막 글이 읽혀야 함: ' + r.texts.length);
  assert.deepEqual(missingGlyphs(r.texts, [fonts.union]), []);
  const all = JSON.stringify(r.scene);
  assert.doesNotMatch(all, /삼성|엘지|네이버|카카오|현대자동차|Samsung|Hyundai/);
});

test('실제 내용: 모든 graph 수식이 유한값을 내고 다양한 보드 종류가 쓰인다', { skip: SKIP_REAL }, () => {
  const scene = assembleScene(realLoaded);
  let curves = 0;
  for (const st of scene.steps) {
    if (st.board.kind !== 'graph') continue;
    const [x0, x1] = st.board.view.x;
    for (const el of st.board.elements) {
      if (el.type !== 'fn') continue;
      const stats = Q.sampleStats(Q.compileExpr(el.expr), el.x ? el.x[0] : x0, el.x ? el.x[1] : x1, 200, st.board.view.y);
      assert.ok(stats.inView > 5, st.id + ': ' + el.expr + ' 가 화면 안에 거의 없음');
      curves++;
    }
  }
  assert.ok(curves >= 8, '곡선이 너무 적음: ' + curves);
});

/* ------------------------------------------------------------------ */
/* 4. 빌드                                                              */
/* ------------------------------------------------------------------ */
test('빌드(--no-audio): 성공, 개발용 경고, 분필 녹음 1개와 글꼴 2개만 내장, 외부 URL·금지 API 없음', () => {
  withTempRoot(() => {}, (dir) => {
    const out = buildNoAudio(dir);
    assert.equal(out.stats.audioClips, 0);
    assert.equal(out.stats.steps, 5);
    assert.match(out.warnings.join('\n'), /--no-audio/);
    assert.deepEqual(findForbidden(out.html), []);
    assert.equal((out.html.match(/data:audio\/mpeg;base64,/g) || []).length, 1, '분필 녹음 1개');
    assert.equal((out.html.match(/url\(data:font\/ttf;base64,/g) || []).length, 2, '글꼴 2개');
    assert.match(out.html, /font-family:NanumPenScript/);
    assert.match(out.html, /font-family:QMath/);
    assert.match(out.html, /window\.LESSON_DATA = \{/);
    assert.match(out.html, /window\.quantumPlayer\s*=/);
    assert.match(out.html, /window\.QMath|root\.QMath/);
    assert.equal(out.scene.build.noAudio, true);
    assert.equal(out.scene.narrationProvider, null);
    for (const st of out.scene.steps) assert.equal(st.audio, undefined);
    assert.equal(out.scene.chalkSound.license, 'CC0-1.0');
    assert.equal(out.scene.chalkSound.recorded, true);
    assert.match(out.scene.chalkSound.audio, /^data:audio\/mpeg;base64,/);
    assert.equal(out.scene.schema, SCHEMA);
    // 엄격한 CSP: 인라인 스크립트·스타일은 해시, unsafe-* 없음
    const csp = /Content-Security-Policy" content="([^"]*)"/.exec(out.html)[1];
    assert.match(csp, /default-src 'none'/);
    assert.match(csp, /script-src 'sha256-/);
    assert.match(csp, /connect-src 'none'/);
    assert.doesNotMatch(csp, /unsafe-|\*/);
  });
});

test('빌드: 장면에는 출처 URL·해시가 없고 작성자·AI 합성 음성 안내가 있다', () => {
  withTempRoot(() => {}, (dir) => {
    const out = buildNoAudio(dir);
    assert.match(out.html, /작성: Microsoft Korea STU/);
    assert.match(out.html, /AI 합성 음성/);
    assert.doesNotMatch(JSON.stringify({ ...out.scene.chalkSound, audio: '' }), /https?:|www\./);
    assert.doesNotMatch(out.html.replace(/data:(audio|font)\/[a-z]+;base64,[A-Za-z0-9+/=]+/g, ''), /https?:\/\//);
  });
});

test('빌드(음성 포함): 해설 MP3 + 분필 1개를 내장하고 대본 해시·길이를 맞춰 본다', { skip: SKIP_AUDIO }, () => {
  withAudioRoot(() => {}, (dir) => {
    const out = buildWithAudio(dir);
    assert.equal(out.stats.audioClips, 5);
    assert.equal((out.html.match(/data:audio\/mpeg;base64,/g) || []).length, 6, '해설 5 + 분필 1');
    for (const st of out.scene.steps) {
      assert.ok(st.audio.startsWith(AUDIO_MIME), st.id);
      const bytes = Buffer.from(st.audio.slice(AUDIO_MIME.length), 'base64');
      assert.ok(Math.abs(mp3Info(bytes).duration - st.audioDuration) < 0.1, st.id + ': 내장 MP3 길이 == durations.json');
      assert.ok(st.audioDuration > 10, st.id);
    }
    const p = out.scene.narrationProvider;
    assert.equal(p.voice, 'ko-KR-Haena:MAI-Voice-2');
    assert.equal(p.model, 'MAI-Voice-2');
    assert.equal(p.synthetic, true);
    assert.equal(p.scriptSha256, undefined, '해시는 산출물에 넣지 않는다');
    assert.deepEqual(out.warnings.filter((w) => /--no-audio/.test(w)), []);
  });
});

test('빌드 실패(소리): 대본 변경(해시)·빠진/잘린/가짜 클립·길이 불일치·잘못된 목소리·합성 아님·CC0 아님·녹음 아님·짧은 분필', { skip: SKIP_AUDIO }, () => {
  const failing = (mutate, pattern, label) => withAudioRoot(mutate, (dir) => assert.throws(() => buildWithAudio(dir), pattern, label));
  failing((dir) => editJson(dir, 'content/03-flowsix.json', (j) => { j.narration = j.narration.replace(/\.$/, '. 바뀐 문장입니다.'); }), /flowsix[\s\S]*(오래|대본|narrate)/, 'script-changed');
  failing((dir) => fs.rmSync(path.join(dir, 'audio', 'graphall.mp3')), /audio\/graphall\.mp3/, 'missing clip');
  failing((dir) => fs.writeFileSync(path.join(dir, 'audio', 'graphequal.mp3'), 'not an mp3 '.repeat(500)), /audio\/graphequal\.mp3[\s\S]*(MP3|프레임)/, 'not mp3');
  failing((dir) => { const f = path.join(dir, 'audio', 'barsmark.mp3'); fs.writeFileSync(f, fs.readFileSync(f).subarray(0, 30000)); }, /audio\/barsmark\.mp3[\s\S]*(길이|프레임 밖)/, 'truncated');
  failing((dir) => editJson(dir, 'audio/durations.json', (j) => { j.chalkonly = 99.5; }), /chalkonly[\s\S]*길이/, 'duration mismatch');
  failing((dir) => editJson(dir, 'audio/durations.json', (j) => { delete j.flowsix; }), /flowsix[\s\S]*durations/, 'missing duration');
  failing((dir) => editJson(dir, 'audio/provider.json', (j) => { j.voice = 'en-US-Other:Voice'; }), /목소리|voice/i, 'voice');
  failing((dir) => editJson(dir, 'audio/provider.json', (j) => { j.model = 'Other'; }), /model/, 'model');
  failing((dir) => editJson(dir, 'audio/provider.json', (j) => { j.synthetic = false; }), /synthetic|합성/, 'synthetic flag');
  failing((dir) => editJson(dir, 'audio/provider.json', (j) => { delete j.scriptSha256; }), /scriptSha256/, 'no hashes');
  failing((dir) => editJson(dir, 'assets/chalk-writing-source.json', (j) => { j.license = 'CC-BY-4.0'; }), /CC0/, 'license');
  failing((dir) => editJson(dir, 'assets/chalk-writing-source.json', (j) => { j.recorded = false; }), /녹음|recorded/, 'recorded');
  failing((dir) => { const f = path.join(dir, 'assets', 'chalk-writing.mp3'); fs.writeFileSync(f, fs.readFileSync(f).subarray(0, 20000)); }, /chalk-writing\.mp3[\s\S]*(4초|짧|프레임 밖)/, 'short chalk');
  // 정상 클립도 clipMinSeconds 를 기본값(20초)으로 두면(시험 클립은 40초대라 통과) — 대신 사실상 불가능한 값으로 확인
  withAudioRoot(() => {}, (dir) => assert.throws(() => build({ root: dir, content: 'content', write: false, clipMinSeconds: 600 }), /너무 짧습니다/));
});

test('음성 포함 빌드는 audio/ 가 없으면 실패하고, --no-audio 는 audio/ 없이도 성공한다', () => {
  withTempRoot(() => {}, (dir) => {
    assert.throws(() => build({ root: dir, content: 'content', write: false }), /audio\/provider\.json|audio\/durations\.json/);
    assert.ok(buildNoAudio(dir).html.length > 1e5);
  });
});

test('빌드 실패: 스키마 위반은 빌드를 막고 오류 목록(problems)을 돌려준다', () => {
  withTempRoot((dir) => editJson(dir, 'content/01-graphall.json', (j) => { j.board.elements.find((e) => e.type === 'fn').expr = 'sin(x'; }), (dir) => {
    try {
      buildNoAudio(dir);
      assert.fail('빌드가 실패해야 합니다');
    } catch (e) {
      assert.match(e.message, /빌드 실패/);
      assert.ok(Array.isArray(e.problems) && e.problems.length >= 1);
      assert.match(e.problems.join('\n'), /01-graphall\.json[\s\S]*expr|expr[\s\S]*해석/);
    }
  });
  withTempRoot((dir) => fs.writeFileSync(path.join(dir, 'content', '02-graphequal.json'), '{ 깨진 json'), (dir) => assert.throws(() => buildNoAudio(dir), /02-graphequal\.json|JSON/));
  withTempRoot((dir) => editJson(dir, 'content/00-meta.json', (j) => { j.steps = []; }), (dir) => assert.throws(() => buildNoAudio(dir), /steps|00-meta/));
  withTempRoot((dir) => fs.rmSync(path.join(dir, 'content', '00-meta.json')), (dir) => assert.throws(() => buildNoAudio(dir), /00-meta/));
});

test('빌드 실패: 칠판 글꼴에 없는 글자(이모지·한자)와 없는 글꼴 파일', () => {
  withTempRoot((dir) => editJson(dir, 'content/05-chalkonly.json', (j) => { j.panel[1].text = '😀 이모지'; }), (dir) => assert.throws(() => buildNoAudio(dir), /글꼴|글자/));
  withTempRoot((dir) => fs.rmSync(path.join(dir, 'assets', 'QMath-subset.ttf')), (dir) => assert.throws(() => buildNoAudio(dir), /QMath-subset\.ttf/));
  withTempRoot((dir) => fs.rmSync(path.join(dir, 'assets', 'NanumPenScript-Regular.ttf')), (dir) => assert.throws(() => buildNoAudio(dir), /NanumPenScript/));
});

test('빌드 실패(오프라인 규칙): 외부 URL, @import, fetch, innerHTML, eval, 음성합성, 다른 HTML, 빠진 토큰, </script', () => {
  const failing = (mutate, pattern, label) => withTempRoot(mutate, (dir) => assert.throws(() => buildNoAudio(dir), pattern, label));
  failing((dir) => editFile(dir, TEMPLATE_NAME, (t) => t.replace('</body>', '<img src="https://example.com/a.png"></body>')), /외부 URL|src/, 'external-url');
  failing((dir) => editFile(dir, 'style.css', (t) => '@import url("https://fonts.googleapis.com/css2?family=Nanum+Pen+Script");\n' + t), /@import|외부 URL|구글/, 'google-fonts');
  failing((dir) => editFile(dir, 'player.js', (t) => t + '\nfetch("x");\n'), /fetch/, 'fetch');
  failing((dir) => editFile(dir, 'player.js', (t) => t + '\nnew XMLHttpRequest();\n'), /XMLHttpRequest/, 'xhr');
  failing((dir) => editFile(dir, 'player.js', (t) => t + '\ndocument.body.innerHTML = "x";\n'), /HTML 문자열 삽입/, 'innerHTML');
  failing((dir) => editFile(dir, 'player.js', (t) => t + '\neval("1");\n'), /eval/, 'eval');
  failing((dir) => editFile(dir, 'qmath.js', (t) => t + '\nnew Function("return 1");\n'), /Function/, 'new Function');
  failing((dir) => editFile(dir, 'player.js', (t) => t + '\nwindow.speechSynthesis.speak(1);\n'), /음성 합성|speechSynthesis/, 'speechSynthesis');
  failing((dir) => editFile(dir, 'qmath.js', (t) => t + '\n/* </script> */\n'), /<\/script/, 'script-break');
  failing((dir) => fs.writeFileSync(path.join(dir, 'other.html'), '<html></html>'), /HTML을 둘 수 없습니다/, 'extra-html');
  failing((dir) => editFile(dir, TEMPLATE_NAME, (t) => t.replace('/*__PLAYER__*/', '')), /__PLAYER__/, 'missing-token');
  failing((dir) => editFile(dir, TEMPLATE_NAME, (t) => t.replace('/*__QMATH__*/', '')), /__QMATH__/, 'missing-qmath-token');
});

test('findForbidden: 금지 항목을 실제로 잡아낸다', () => {
  for (const [html, pattern] of [
    ['<a href="https://x.test">', /http/],
    ['<script>fetch("/a")</script>', /fetch/],
    ['<script>el.innerHTML = 1</script>', /HTML/],
    ['<style>@import "a.css";</style>', /@import/],
    ['<style>a{background:url(img.png)}</style>', /url\(\)/],
    ['<script>new WebSocket("ws://a")</script>', /WebSocket/],
    ['<script>speechSynthesis.cancel()</script>', /음성 합성/],
    ['<script>eval("1")</script>', /eval/],
    ['<script>new Function("return 1")</script>', /Function/],
  ]) {
    assert.match(findForbidden(html).join('\n'), pattern, html);
  }
  assert.deepEqual(findForbidden('<p>안녕</p><style>a{background:url(data:image/png;base64,AAAA)}</style>'), []);
});

/* ------------------------------------------------------------------ */
/* 5. 소리: 분필 녹음 · MP3 도구                                        */
/* ------------------------------------------------------------------ */
const id3v2 = (text) => {
  const body = Buffer.concat([Buffer.from([0]), Buffer.from('src\0' + text, 'latin1')]);
  const frame = Buffer.concat([Buffer.from('TXXX', 'latin1'), Buffer.from([0, 0, (body.length >> 8) & 255, body.length & 255, 0, 0]), body]);
  const n = frame.length;
  return Buffer.concat([Buffer.from('ID3', 'latin1'), Buffer.from([3, 0, 0, (n >> 21) & 127, (n >> 14) & 127, (n >> 7) & 127, n & 127]), frame]);
};

test('분필 녹음: 실제 CC0 녹음 MP3 (4초 이상), 출처 파일은 CC0·recorded:true, 글꼴 라이선스 전문이 있다', () => {
  const info = mp3Info(fs.readFileSync(path.join(ROOT, 'assets', 'chalk-writing.mp3')));
  assert.ok(info.frames > 100 && info.duration > 4, JSON.stringify(info));
  assert.equal(info.junkBytes, 0);
  const src = JSON.parse(read('assets/chalk-writing-source.json'));
  assert.equal(src.license, 'CC0-1.0');
  assert.equal(src.recorded, true);
  assert.match(read('assets/OFL.txt'), /SIL OPEN FONT LICENSE/i);
  assert.match(read('assets/LICENSE-DejaVu.txt'), /Bitstream Vera|DejaVu/i);
  assert.ok(fs.existsSync(path.join(ROOT, 'assets', 'QMath-subset.ttf')));
  assert.ok(fs.existsSync(path.join(ROOT, 'subset_font.py')));
});

test('엘립틱 커브 강의와 같은 분필 녹음 바이트를 쓴다 (복사본, 합성음 아님)', () => {
  const mine = fs.readFileSync(path.join(ROOT, 'assets', 'chalk-writing.mp3'));
  const orig = path.join(ROOT, '..', 'elliptic_curve', 'assets', 'chalk-writing.mp3');
  if (fs.existsSync(orig)) assert.ok(mine.equals(fs.readFileSync(orig)));
});

test('mp3Info/stripMp3Tags: 프레임 길이를 세고, 꼬리표를 걷어 낸다', () => {
  const clip = fs.readFileSync(path.join(ROOT, 'assets', 'chalk-writing.mp3'));
  const clean = stripMp3Tags(clip);
  const info = mp3Info(clean);
  const tagged = Buffer.concat([id3v2('http://x.test/y'), clean]);
  assert.ok(tagged.includes('x.test'));
  assert.ok(stripMp3Tags(tagged).equals(clean));
  assert.equal(mp3Info(tagged).frames, info.frames);
  assert.equal(mp3Info(Buffer.from('아무 소리도 아닌 파일')).frames, 0);
  const v1 = Buffer.concat([Buffer.from('TAG', 'latin1'), Buffer.from('http://v1.example/x'.padEnd(125, '\0'), 'latin1')]);
  assert.ok(stripMp3Tags(Buffer.concat([clean, v1])).equals(clean));
});

test('소리: MP3 꼬리표 속 URL 은 내장 전에 지워지고, 오디오 본문의 URL 은 빌드를 실패시킨다', () => {
  const chalkPath = (dir) => path.join(dir, 'assets', 'chalk-writing.mp3');
  withTempRoot((dir) => {
    const body = stripMp3Tags(fs.readFileSync(chalkPath(dir)));
    const v1 = Buffer.concat([Buffer.from('TAG', 'latin1'), Buffer.from('http://v1.example/x'.padEnd(125, '\0'), 'latin1')]);
    fs.writeFileSync(chalkPath(dir), Buffer.concat([id3v2('https://evil.example/a'), body, v1]));
  }, (dir) => {
    const out = buildNoAudio(dir);
    assert.doesNotMatch(out.html.replace(/data:audio\/mpeg;base64,[A-Za-z0-9+/=]+/g, ''), /evil|v1\.example/);
    const payload = Buffer.from(out.scene.chalkSound.audio.slice(AUDIO_MIME.length), 'base64');
    assert.ok(!payload.includes('evil.example') && !payload.includes('v1.example'));
    assert.notEqual(payload.subarray(0, 3).toString('latin1'), 'ID3');
    assert.equal(mp3Info(payload).junkBytes, 0);
  });
  withTempRoot((dir) => {
    const f = chalkPath(dir);
    const buf = fs.readFileSync(f);
    Buffer.from('https://evil.example/', 'latin1').copy(buf, 5000);
    fs.writeFileSync(f, buf);
  }, (dir) => assert.throws(() => buildNoAudio(dir), /chalk-writing\.mp3[\s\S]*(URL|http)/));
});

test('소리: 출처 메타데이터는 허용 목록 필드만 내장하고 URL 은 지운다', () => {
  withTempRoot(() => {}, (dir) => {
    const out = buildNoAudio(dir);
    const c = out.scene.chalkSound;
    assert.deepEqual(Object.keys(c).sort(), ['audio', 'creator', 'duration', 'edits', 'license', 'recorded', 'title']);
    assert.match(c.title, /Chalk/);
    assert.doesNotMatch(JSON.stringify({ ...c, audio: '' }), /https?:|www\./);
    assert.ok(c.duration >= 4);
  });
});

/* ------------------------------------------------------------------ */
/* 6. 소스·템플릿·폴더 규칙                                             */
/* ------------------------------------------------------------------ */
test('player.js / qmath.js: 안전한 DOM 사용, 합성 소리 없음, 동적 코드 없음, 필수 API', () => {
  const player = read('player.js');
  for (const method of ['getState', 'goTo', 'play', 'pause', 'toggle', 'next', 'prev', 'replay', 'restart', 'seek', 'setSpeed', 'setAuto', 'setVoiceEnabled', 'setChalkEnabled', 'setChalkVolume', 'layoutReport']) {
    assert.match(player, new RegExp('\\b' + method + '\\b'), method);
  }
  for (const f of ['player.js', 'qmath.js']) {
    const src = read(f);
    assert.doesNotMatch(src, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function\(|\bFunction\(|fetch\(|XMLHttpRequest/, f);
    assert.doesNotMatch(src, /speechSynthesis|SpeechSynthesis|createOscillator|createBuffer\(|createScriptProcessor|new OfflineAudioContext/, f);
    assert.doesNotMatch(src, /https?:\/\//, f);
  }
  assert.match(player, /window\.quantumPlayer\s*=/);
  assert.doesNotMatch(player, /ellipticPlayer|BigInt|ecmath|\[\[[A-Za-z_]+\]\]/); // [[점]] 자리표시자는 쓰지 않는다(배열의 배열 [[x,y]] 표기와 구분)
  assert.match(player, /prefers-reduced-motion/);
  assert.match(player, /NotAllowedError/);
  assert.match(player, /NanumPenScript, QMath|NanumPenScript,\s*QMath/);
});

test('템플릿: 해설·분필 컨트롤, 분필 음량 기본 25%, 장 목록·오해·참고문헌 자리, AI 합성 음성 공시', () => {
  const t = read(TEMPLATE_NAME);
  for (const id of ['board', 'board-stage', 'voice-toggle', 'chalk-toggle', 'chalk-volume', 'chalk-volume-value', 'voice-note', 'chalk-note', 'auto-toggle', 'speed', 'chapters', 'mis-list', 'ref-list', 'board-tag-text', 'legend', 'callout']) {
    assert.match(t, new RegExp('id="' + id + '"'), id);
  }
  assert.match(t, /<input id="chalk-volume" type="range" min="0" max="100" step="1" value="25">/);
  assert.match(t, /<output id="chalk-volume-value"[^>]*>25%<\/output>/);
  assert.match(t, /<html lang="ko"/);
  assert.match(t, /<canvas id="board"/);
  assert.match(t, /digitale\.de/);
  assert.match(t, /CC0/);
  assert.match(t, /MAI-Voice-2/);
  assert.match(t, /AI 합성 음성/);
  assert.match(t, /작성: %%AUTHOR%%/);
  assert.match(read('style.css'), /prefers-reduced-motion/);
  assert.match(read('style.css'), /max-width:\s*1000px/);
});

test('폴더 규칙: HTML은 template.html 과 quantum-physics.html 뿐이고 가상환경·캐시는 무시된다', () => {
  assert.equal(OUTPUT_NAME, 'quantum-physics.html');
  assert.equal(SCENE_NAME, 'quantum-physics.scene.json');
  const found = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === '__pycache__') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.html?$/i.test(e.name)) found.push(path.relative(ROOT, p));
    }
  };
  walk(ROOT);
  for (const f of found) assert.ok([OUTPUT_NAME, TEMPLATE_NAME].includes(f), '허용되지 않은 HTML: ' + f);
  assert.ok(found.includes(TEMPLATE_NAME));
  const ignore = read('.gitignore');
  for (const pat of ['.venv/', '__pycache__/', '*.pending.mp3']) assert.ok(ignore.includes(pat), pat);
});

test('narrate.py: 목소리·리소스·두 번째 제한 간격이 코드에 고정되어 있다 (실제 호출은 하지 않음)', () => {
  const py = read('narrate.py');
  assert.match(py, /ko-KR-Haena:MAI-Voice-2/);
  assert.match(py, /mai-transcribe-westus-resource/);
  assert.match(py, /public-ai-rg/);
  assert.match(py, /THROTTLE_SECONDS\s*=\s*2/);
  assert.match(py, /MAX_CHARS\s*=\s*440/);
  for (const flag of ['--smoke', '--force', '--only', '--check']) assert.ok(py.includes(flag), flag);
  assert.match(py, /scriptSha256/);
  assert.match(py, /provider\.json/);
  assert.match(py, /durations\.json/);
  assert.match(py, /aad#/);
  assert.doesNotMatch(py, /(subscription[_-]?key|api[_-]?key)\s*=\s*["'][A-Za-z0-9]{16,}/i);
  assert.match(read('requirements-audio.txt'), /azure-cognitiveservices-speech/);
});

test('README: 소리 정책·글꼴·narrate.py 사용법·검증 방법을 적는다', () => {
  const md = read('README.md');
  assert.match(md, /quantum-physics\.html/);
  assert.match(md, /narrate\.py/);
  assert.match(md, /art_of_war\/\.venv\/bin\/python/);
  assert.match(md, /--no-audio/);
  assert.match(md, /CC0/);
  assert.match(md, /QMath/);
  assert.match(md, /NanumPenScript|나눔손글씨/);
  assert.match(md, /node --test/);
  assert.match(md, /verify_browser\.py/);
  assert.match(md, /25\s*%/);
});

/* ------------------------------------------------------------------ */
/* 7. 저장소의 산출물이 있으면 최신인가                                  */
/* ------------------------------------------------------------------ */
const outputExists = fs.existsSync(path.join(ROOT, OUTPUT_NAME));

test('산출물 quantum-physics.html 이 있으면 현재 소스·내용으로 만든 빌드와 같다 (다르면 node build.mjs 를 다시 실행하세요)', { skip: (!outputExists && '산출물 없음(아직 빌드 전)') || SKIP_REAL }, () => {
  const html = read(OUTPUT_NAME);
  const dev = /"build":\{"noAudio":true\}/.test(html);
  if (!dev && !fs.existsSync(path.join(ROOT, 'audio', 'provider.json'))) assert.fail('음성 빌드 산출물인데 audio/ 가 없습니다');
  const out = build({ write: false, noAudio: dev });
  assert.equal(html, out.html, OUTPUT_NAME + ' 이(가) 최신이 아닙니다. ' + (dev ? 'node build.mjs --no-audio' : 'node build.mjs') + ' 를 다시 실행하세요.');
});

test('산출물: 푸터 작성자, 줄어든 동작 CSS, 내장 글꼴 2개, <audio>/<video> 요소 없음, Canvas 칠판', { skip: !outputExists && '산출물 없음(아직 빌드 전)' }, () => {
  const html = read(OUTPUT_NAME);
  assert.match(html, /<footer[\s\S]*작성: Microsoft Korea STU[\s\S]*<\/footer>/);
  assert.match(html, /window\.quantumPlayer\s*=/);
  assert.match(html, /@font-face\{font-family:NanumPenScript;src:url\(data:font\/ttf;base64,/);
  assert.match(html, /@font-face\{font-family:QMath;src:url\(data:font\/ttf;base64,/);
  assert.match(html, /prefers-reduced-motion/);
  assert.doesNotMatch(html, /<audio|<video|speechSynthesis|SpeechSynthesis|createOscillator|createBuffer\(/);
  assert.match(html, /<html lang="ko"/);
  assert.match(html, /<canvas id="board"/);
  assert.match(html, /<meta name="viewport"/);
});
