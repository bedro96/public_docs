// 강의 데이터·빌드·산출물 검증.  실행: node --test   (이 폴더에서)
//
// 두 종류의 내용을 검사합니다.
//  - tests/fixtures/content : 이 테스트 전용의 작은 시험 내용(보드 6종 각 1단계). 실제 내용이 없어도 돌아갑니다.
//  - content/               : 실제 강의 내용. 네 개 파일이 모두 있을 때만 검사합니다(없으면 건너뜀).
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, OUTPUT_NAME, TEMPLATE_NAME, SCHEMA, STEP_FILES, LAYOUT_WIDTHS, parseFont, missingGlyphs, makeMeasure, loadContent, findForbidden, layoutCheck, build, mp3Info, stripMp3Tags, AUDIO_MIME } from './build.mjs';
import { validateLesson, BOARD_KINDS, PART_COUNTS } from './validate.mjs';

const require = createRequire(import.meta.url);
const L = require('./layout.js');

const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');
const clone = (v) => JSON.parse(JSON.stringify(v));
const FIXTURE_DIR = path.join(ROOT, 'tests', 'fixtures', 'content');
const fixture = () => {
  const r = loadContent(FIXTURE_DIR);
  assert.deepEqual(r.problems, []);
  return clone(r.scene);
};
const stepOf = (s, id) => s.steps.find((x) => x.id === id);
const elemOf = (s, id, type, n = 0) => stepOf(s, id).board.elements.filter((e) => e.type === type)[n];
const errorsOf = (scene, opts = { strictStructure: false }) => validateLesson(scene, opts).errors;

const real = loadContent(path.join(ROOT, 'content'));
const hasReal = real.complete && real.problems.length === 0;

const fonts = () => ({
  nanum: parseFont(fs.readFileSync(path.join(ROOT, 'assets', 'NanumPenScript-Regular.ttf'))),
  hanja: parseFont(fs.readFileSync(path.join(ROOT, 'assets', 'ChalkHanja-subset.otf'))),
});

/** 임시 폴더에 빌드에 필요한 파일을 복사해 놓고 mutate 로 고친 뒤 fn 을 돌립니다. */
function withTempRoot(mutate, fn, { audio = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aow-build-'));
  try {
    fs.mkdirSync(path.join(dir, 'assets'));
    fs.mkdirSync(path.join(dir, 'content'));
    for (const f of [TEMPLATE_NAME, 'style.css', 'layout.js', 'draw.js', 'player.js']) fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
    for (const f of ['NanumPenScript-Regular.ttf', 'ChalkHanja-subset.otf', 'OFL.txt', 'OFL-NotoSerifCJK.txt', 'chalk-writing.mp3', 'chalk-writing-source.json']) {
      fs.copyFileSync(path.join(ROOT, 'assets', f), path.join(dir, 'assets', f));
    }
    for (const f of fs.readdirSync(FIXTURE_DIR)) fs.copyFileSync(path.join(FIXTURE_DIR, f), path.join(dir, 'content', f));
    if (audio) makeStandInAudio(dir);
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
const buildNoAudio = (dir, extra = {}) => build({ root: dir, write: false, noAudio: true, ...extra });
const buildWithAudio = (dir, extra = {}) => build({ root: dir, write: false, clipMinSeconds: 4, ...extra });

/**
 * 시험용 해설 클립: 실제 해설이 아직 없어도 오디오 경로(길이·해시·내장)를 검사하도록
 * CC0 분필 녹음 MP3 를 각 단계의 "해설"로 흉내 냅니다(임시 폴더 안에서만, 저장소에는 남지 않습니다).
 */
function makeStandInAudio(dir) {
  fs.mkdirSync(path.join(dir, 'audio'));
  const chalk = fs.readFileSync(path.join(dir, 'assets', 'chalk-writing.mp3'));
  const loaded = loadContent(path.join(dir, 'content'));
  const durations = {};
  const hashes = {};
  const duration = mp3Info(stripMp3Tags(chalk)).duration;
  for (const s of loaded.scene.steps) {
    fs.writeFileSync(path.join(dir, 'audio', s.id + '.mp3'), chalk);
    durations[s.id] = Math.round(duration * 1000) / 1000;
    hashes[s.id] = crypto.createHash('sha256').update(s.narration).digest('hex');
  }
  fs.writeFileSync(path.join(dir, 'audio', 'durations.json'), JSON.stringify(durations, null, 2));
  fs.writeFileSync(path.join(dir, 'audio', 'provider.json'), JSON.stringify({ provider: 'azure-speech', model: 'MAI-Voice-2', voice: 'ko-KR-Haena:MAI-Voice-2', language: 'ko-KR', format: 'mp3', synthetic: true, scriptSha256: hashes }, null, 2));
}

/* ------------------------------------------------------------------ */
/* 1. 시험 내용(fixtures)                                              */
/* ------------------------------------------------------------------ */
test('시험 내용: 보드 6종이 하나씩 있고 스키마 검증을 오류 0건으로 통과한다', () => {
  const s = fixture();
  assert.equal(s.schema, SCHEMA);
  const r = validateLesson(s, { strictStructure: false });
  assert.deepEqual(r.errors, []);
  assert.deepEqual([...new Set(s.steps.map((x) => x.board.kind))].sort(), [...BOARD_KINDS].sort());
  for (const st of s.steps) {
    assert.ok(st.narration.length >= 330 && st.narration.length <= 430, `${st.id}: 해설 ${st.narration.length}자`);
    assert.doesNotMatch(st.narration, /[^가-힣\s,.?!]/u, `${st.id}: 해설에는 한글·쉼표·마침표만`);
    assert.equal(st.digest.length >= 3 && st.digest.length <= 4, true, `${st.id}: 한 장 요약 3~4장`);
    assert.ok(st.beats.length >= 2 && st.panel.length >= 2, st.id);
  }
  assert.equal(s.quiz.length, 6);
  for (const q of s.quiz) {
    assert.equal(q.options.length, 3);
    assert.equal(q.options.filter((o) => o.correct).length, 1);
  }
  assert.ok(r.chalk.length > 40 && r.dom.length > 40, '글 목록 수집');
});

test('완결성 검사: 파일이 일부뿐이면 23단계 구조 검사는 오류, 개발 중에는 건너뛴다', () => {
  const s = fixture();
  const strict = validateLesson(s, { strictStructure: true }).errors.join('\n');
  assert.match(strict, /23/);
  assert.equal(validateLesson(s, { strictStructure: false }).errors.length, 0);
  assert.equal(loadContent(FIXTURE_DIR).complete, false);
  assert.deepEqual(PART_COUNTS, { background: 6, chapter: 13, closing: 4 });
  assert.equal(STEP_FILES.length, 4);
});

test('나쁜 시험 내용: 규칙 위반마다 정확한 오류가 나온다 (필수 필드·id·해설·at·좌표·링크·연표·인용·색·퀴즈·금지어)', () => {
  const longNarr = (s) => s.steps[0].narration;
  const cases = [
    ['bad-schema', (s) => { s.schema = 'x/9'; }, /schema/],
    ['bad-lang', (s) => { s.lang = 'en'; }, /lang/],
    ['missing-title', (s) => { delete s.title; }, /title/],
    ['duplicate-id', (s) => { s.steps[1].id = s.steps[0].id; }, /중복된 id/],
    ['missing-board', (s) => { delete s.steps[0].board; }, /board/],
    ['unknown-board-kind', (s) => { s.steps[0].board.kind = 'pie'; }, /diagram \| timeline/],
    ['short-narration', (s) => { s.steps[0].narration = '짧아요.'; }, /330~430/],
    ['long-narration', (s) => { s.steps[0].narration = longNarr(s) + longNarr(s); }, /330~430|450/],
    ['hanja-in-narration', (s) => { s.steps[0].narration = longNarr(s).replace(/\.$/, ' 孫武.'); }, /한자·로마자·숫자·기호/],
    ['latin-in-narration', (s) => { s.steps[0].narration = longNarr(s).replace(/\.$/, ' AI.'); }, /한자·로마자·숫자·기호/],
    ['digit-in-narration', (s) => { s.steps[0].narration = longNarr(s).replace(/\.$/, ' 3편.'); }, /한자·로마자·숫자·기호/],
    ['percent-in-narration', (s) => { s.steps[0].narration = longNarr(s).replace(/\.$/, ' 칠십%.'); }, /"%"/],
    ['arrow-in-narration', (s) => { s.steps[0].narration = longNarr(s).replace(/\.$/, ' 가->나.'); }, /->|-|>/],
    ['guillemet-in-narration', (s) => { s.steps[0].narration = longNarr(s).replace(/\.$/, ' 《손자》.'); }, /《/],
    ['parens-in-narration', (s) => { s.steps[0].narration = longNarr(s).replace(/\.$/, ' (보충).'); }, /\(/],
    ['narration-not-ended', (s) => { s.steps[0].narration = longNarr(s).replace(/\.$/, ''); }, /마침표/],
    ['narration-padded', (s) => { s.steps[0].narration = ' ' + longNarr(s); }, /공백/],
    ['at-not-ascending', (s) => { const e = stepOf(s, 'fx-diagram').board.elements; e[1].at = 0.01; }, /오름차순/],
    ['at-last-too-late', (s) => { const e = stepOf(s, 'fx-diagram').board.elements; e[e.length - 1].at = 0.95; }, /0\.85 이하/],
    ['at-out-of-range', (s) => { s.steps[0].beats[0].at = 1.5; }, /0~1/],
    ['beats-at-not-ascending', (s) => { s.steps[0].beats[1].at = 0.01; s.steps[0].beats[0].at = 0.5; }, /오름차순/],
    ['node-out-of-bounds', (s) => { elemOf(s, 'fx-diagram', 'node').x = 158; }, /여백\(5\) 밖/],
    ['node-overlap', (s) => { const [a, b] = stepOf(s, 'fx-diagram').board.elements.filter((e) => e.type === 'node'); b.x = a.x; b.y = a.y; }, /겹칩니다/],
    ['link-endpoint-missing', (s) => { elemOf(s, 'fx-diagram', 'link').to = 'nope'; }, /존재하지 않는 노드 id: nope/],
    ['duplicate-node-id', (s) => { const ns = stepOf(s, 'fx-diagram').board.elements.filter((e) => e.type === 'node'); ns[1].id = ns[0].id; }, /id/],
    ['node-title-too-long', (s) => { elemOf(s, 'fx-diagram', 'node').title = '열두글자를넘어서는아주긴제목'; }, /12자 이내/],
    ['bad-node-shape', (s) => { elemOf(s, 'fx-diagram', 'node').shape = 'star'; }, /box \| round/],
    ['bad-color', (s) => { elemOf(s, 'fx-diagram', 'node').color = 'purple'; }, /white \| mint/],
    ['timeline-year-out-of-axis', (s) => { elemOf(s, 'fx-timeline', 'event').year = 99999; }, /축 범위/],
    ['table-cell-too-long', (s) => { elemOf(s, 'ch13-table', 'row').cells[0] = '열네 글자를 넘는 아주 아주 긴 표 칸 글'; }, /14자 이내/],
    ['chapter-without-quote', (s) => { delete stepOf(s, 'ch01-five').quote; }, /quote 가 필수/],
    ['chapter-without-no', (s) => { delete stepOf(s, 'ch01-five').chapterNo; }, /chapterNo/],
    ['tag-tone-enum', (s) => { s.steps[0].tag.tone = 'wow'; }, /fact \| debated \| classic \| interp/],
    ['alt-missing', (s) => { delete s.steps[0].alt; }, /alt/],
    ['title-too-long', (s) => { s.steps[0].title = '아주'.repeat(20) + ' 긴 제목'; }, /28자 이내/],
    ['digest-too-few', (s) => { s.steps[0].digest.length = 2; }, /3~4개/],
    ['forbidden-LG', (s) => { s.steps[0].summary = 'LG 전자의 사례'; }, /기업·고객 이름/],
    ['forbidden-company', (s) => { s.steps[0].summary = '삼성 같은 회사 이야기'; }, /기업·고객 이름/],
    ['forbidden-in-quiz', (s) => { s.quiz[0].question = 'LG 이야기일까요?'; }, /기업·고객 이름/],
    ['quiz-wrong-count', (s) => { s.quiz.pop(); }, /6문항/],
    ['quiz-two-options', (s) => { s.quiz[0].options.pop(); }, /보기 3개/],
    ['quiz-no-correct', (s) => { s.quiz[0].options.forEach((o) => { o.correct = false; }); }, /정답은 정확히 1개/],
    ['quiz-two-correct', (s) => { s.quiz[0].options.forEach((o) => { o.correct = true; }); }, /정답은 정확히 1개/],
  ];
  for (const [name, mutate, pattern] of cases) {
    const s = fixture();
    mutate(s);
    const errors = errorsOf(s);
    assert.ok(errors.length > 0, `${name}: 오류가 있어야 합니다`);
    assert.match(errors.join('\n'), pattern, name);
  }
  assert.ok(cases.length >= 40);
});

test('나쁜 시험 내용(구조): 단계 수·부 구분·chapterNo 순서 (23단계 구조 검사)', () => {
  // 구조 검사는 23단계를 요구하므로, 합성으로 23단계를 만들어 하나씩 망가뜨린다.
  const base = fixture();
  const proto = {
    background: stepOf(base, 'fx-diagram'),
    chapter: stepOf(base, 'ch01-five'),
    closing: stepOf(base, 'fx-compare'),
  };
  const make = () => {
    const s = clone(base);
    s.steps = [];
    let n = 0;
    const add = (part, chapterNo) => {
      const st = clone(proto[part]);
      st.id = (part === 'chapter' ? 'ch' + String(chapterNo).padStart(2, '0') : part.slice(0, 2)) + '-s' + ++n;
      st.part = part;
      if (part === 'chapter') st.chapterNo = chapterNo;
      else delete st.chapterNo;
      s.steps.push(st);
    };
    for (let i = 0; i < 6; i++) add('background');
    for (let i = 1; i <= 13; i++) add('chapter', i);
    for (let i = 0; i < 4; i++) add('closing');
    return s;
  };
  const ok = make();
  const base23 = validateLesson(ok, { strictStructure: true }).errors.filter((e) => /구조|23|chapterNo|part|부/.test(e));
  assert.deepEqual(base23, [], '정상 구조는 구조 오류가 없어야 합니다: ' + base23.join('; '));

  const fewer = make();
  fewer.steps.pop();
  assert.match(validateLesson(fewer, { strictStructure: true }).errors.join('\n'), /23|closing|마무리/);

  const swapped = make();
  const ch = swapped.steps.filter((x) => x.part === 'chapter');
  [ch[0].chapterNo, ch[1].chapterNo] = [ch[1].chapterNo, ch[0].chapterNo];
  assert.match(validateLesson(swapped, { strictStructure: true }).errors.join('\n'), /chapterNo/);

  const misordered = make();
  [misordered.steps[0], misordered.steps[6]] = [misordered.steps[6], misordered.steps[0]];
  assert.ok(validateLesson(misordered, { strictStructure: true }).errors.length > 0, '부 순서가 뒤바뀌면 오류');
});

test('layoutCheck: 노드 글이 상자보다 크면 오류, 정상 내용은 오류 0건 (넓은·좁은 칠판 4가지 폭)', () => {
  const measure = makeMeasure(Object.values(fonts()));
  const s = fixture();
  const ok = layoutCheck(L, s.steps, measure, LAYOUT_WIDTHS);
  assert.deepEqual(ok.errors, []);
  assert.ok(Array.isArray(ok.warnings));

  const bad = fixture();
  const node = elemOf(bad, 'fx-diagram', 'node');
  node.w = 14;
  node.h = 8;
  node.title = '아주 긴 노드 제목';
  node.lines = ['아주 긴 보조 설명 글입니다', '두 번째 줄도 길어요'];
  const out = layoutCheck(L, bad.steps, measure, LAYOUT_WIDTHS);
  assert.ok(out.errors.some((e) => /글이 상자보다 커요/.test(e)), out.errors.join('\n'));
});

/** 배치 결과(prims)에서 실제 판서가 끝나는 시각(초). 폭이 달라도 같아야 하고 stepEnd 와 일치해야 합니다. */
const drawEnd = (plan, D) => Math.max(...plan.prims.map((p) => p.at * D + (p.o1 || 0)));

test('시간표: 판서 끝 시각(animEnd)은 칠판 폭과 무관하고 stepEnd 와 같으며, 판서는 해설 길이 안에서 끝난다', () => {
  const s = fixture();
  const measure = makeMeasure(Object.values(fonts()));
  for (const st of s.steps) {
    const D = L.estimateDuration(st.narration);
    const a = L.stepEnd(st, D);
    assert.ok(a > 5 && a <= D + 12, `${st.id}: animEnd ${a} / 추정 해설 ${D}`);
    // 폭을 바꿔 배치해도(넓은 화면·좁은 화면) 판서 끝은 같다
    const ends = LAYOUT_WIDTHS.map((W) => drawEnd(L.planStep(st, W, measure), D));
    assert.ok(ends.every((e) => Math.abs(e - a) < 1e-6), `${st.id}: 판서 끝이 폭마다 다름 ${ends} vs ${a}`);
  }
});

/* ------------------------------------------------------------------ */
/* 2. 실제 내용(content/)                                              */
/* ------------------------------------------------------------------ */
test('실제 내용: 23단계(배경 6 + 13편 + 마무리 4), 순서·chapterNo·id', { skip: !hasReal && '콘텐츠 파일 네 개가 모두 있을 때만 검사합니다' }, () => {
  const { scene } = real;
  const r = validateLesson(scene, { strictStructure: true });
  assert.deepEqual(r.errors, []);
  assert.equal(scene.steps.length, 23);
  const count = (part) => scene.steps.filter((x) => x.part === part).length;
  assert.deepEqual({ background: count('background'), chapter: count('chapter'), closing: count('closing') }, PART_COUNTS);
  assert.deepEqual(scene.steps.map((x) => x.part), [...Array(6).fill('background'), ...Array(13).fill('chapter'), ...Array(4).fill('closing')]);
  assert.deepEqual(scene.steps.filter((x) => x.part === 'chapter').map((x) => x.chapterNo), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  assert.equal(new Set(scene.steps.map((x) => x.id)).size, 23);
  for (const st of scene.steps.filter((x) => x.part === 'chapter')) {
    assert.ok(st.quote && st.quote.han && st.quote.reading && st.quote.meaning && st.quote.where, `${st.id}: 인용 카드(han·reading·meaning·where)`);
  }
  assert.equal(scene.quiz.length, 6);
  const kinds = new Set(scene.steps.map((x) => x.board.kind));
  for (const k of BOARD_KINDS) assert.ok(kinds.has(k), `실제 내용에도 ${k} 보드가 한 번은 쓰여야 합니다`);
});

test('실제 내용: 해설은 330~430자·한글뿐, 대본 길이가 쓸 만한 해설 시간을 만든다', { skip: !hasReal && '콘텐츠 없음' }, () => {
  for (const st of real.scene.steps) {
    assert.ok(st.narration.length >= 330 && st.narration.length <= 430, `${st.id}: ${st.narration.length}자`);
    assert.doesNotMatch(st.narration, /[^가-힣\s,.?!]/u, st.id);
    const D = L.estimateDuration(st.narration);
    assert.ok(D >= 40 && D <= 90, `${st.id}: 추정 해설 ${D}초`);
  }
});

test('실제 내용: 모든 글자가 내장 글꼴 두 개(나눔손글씨 펜 + 한자 부분 글꼴)에 있고, 금지어가 없다', { skip: !hasReal && '콘텐츠 없음' }, () => {
  const r = validateLesson(real.scene, { strictStructure: true });
  const f = fonts();
  assert.deepEqual(missingGlyphs(r.chalk, [f.nanum, f.hanja]), [], '칠판 글자');
  assert.deepEqual(missingGlyphs(r.dom, [f.nanum, f.hanja], { onlyHan: true }), [], '화면 한자');
  const all = JSON.stringify(real.scene);
  assert.doesNotMatch(all, /\bLG\b|삼성|현대자동차|네이버|카카오|구글|마이크로소프트|Microsoft(?! Korea STU)/);
});

test('실제 내용: 모든 단계가 4가지 칠판 폭에서 오류 없이 배치되고, 판서 끝 시각은 폭과 무관하다', { skip: !hasReal && '콘텐츠 없음' }, () => {
  const measure = makeMeasure(Object.values(fonts()));
  const lc = layoutCheck(L, real.scene.steps, measure, LAYOUT_WIDTHS);
  assert.deepEqual(lc.errors, []);
  for (const st of real.scene.steps) {
    const D = L.estimateDuration(st.narration);
    const ends = LAYOUT_WIDTHS.map((W) => drawEnd(L.planStep(st, W, measure), D));
    assert.ok(ends.every((e) => Math.abs(e - ends[0]) < 1e-6), `${st.id}: ${ends}`);
    assert.ok(Math.abs(ends[0] - L.stepEnd(st, D)) < 1e-6, `${st.id}: stepEnd 와 다름`);
    assert.ok(ends[0] <= D + 12, `${st.id}: 판서 끝 ${ends[0]} > 해설 ${D} + 12`);
  }
});

/* ------------------------------------------------------------------ */
/* 3. 빌드 (시험 내용 + 임시 폴더)                                      */
/* ------------------------------------------------------------------ */
test('빌드(--no-audio): 성공, 개발용 경고, 분필 녹음 1개와 글꼴 2개만 내장, 외부 URL·금지 API 없음', () => {
  withTempRoot(() => {}, (dir) => {
    const out = buildNoAudio(dir);
    assert.equal(out.stats.noAudio, true);
    assert.equal(out.stats.steps, 6);
    assert.match(out.warnings.join('\n'), /--no-audio/);
    assert.deepEqual(findForbidden(out.html.replace(/https:\/\/example\.invalid\S*/g, '')), []);
    assert.equal((out.html.match(/data:audio\/mpeg;base64,/g) || []).length, 1, '분필 녹음 1개');
    assert.equal((out.html.match(/url\(data:font\/(?:ttf|otf);base64,/g) || []).length, 2);
    assert.match(out.html, /font-family:ChalkKorean/);
    assert.match(out.html, /font-family:ChalkHanja/);
    assert.match(out.html, /window\.LESSON_DATA = \{/);
    assert.match(out.html, /window\.artOfWarPlayer\s*=/);
    assert.equal(out.scene.build.noAudio, true);
    assert.equal(out.scene.narrationProvider, null);
    for (const st of out.scene.steps) assert.equal(st.audio, undefined);
    assert.equal(out.scene.chalkSound.license, 'CC0-1.0');
    assert.equal(out.scene.chalkSound.recorded, true);
    assert.match(out.scene.chalkSound.audio, /^data:audio\/mpeg;base64,/);
  });
});

test('빌드(음성 포함): 해설 MP3 6개 + 분필 1개를 내장하고 대본 해시·길이를 맞춰 본다', () => {
  withTempRoot(() => {}, (dir) => {
    const out = buildWithAudio(dir);
    assert.equal(out.stats.noAudio, false);
    assert.equal((out.html.match(/data:audio\/mpeg;base64,/g) || []).length, 7, '해설 6 + 분필 1');
    const chalk = stripMp3Tags(fs.readFileSync(path.join(dir, 'assets', 'chalk-writing.mp3')));
    for (const st of out.scene.steps) {
      assert.ok(st.audio.startsWith(AUDIO_MIME), st.id);
      assert.ok(Buffer.from(st.audio.slice(AUDIO_MIME.length), 'base64').equals(chalk), st.id + ': 파일과 같은 바이트');
      assert.ok(st.audioDuration > 4, st.id);
    }
    const p = out.scene.narrationProvider;
    assert.equal(p.voice, 'ko-KR-Haena:MAI-Voice-2');
    assert.equal(p.model, 'MAI-Voice-2');
    assert.equal(p.synthetic, true);
    assert.equal(p.scriptSha256, undefined, '해시는 산출물에 넣지 않는다');
    assert.deepEqual(out.warnings.filter((w) => /--no-audio/.test(w)), []);
  }, { audio: true });
});

test('빌드: 산출물에는 출처 URL 이 "보이는 글"로만 있고 링크·요청은 없다', () => {
  withTempRoot(() => {}, (dir) => {
    const out = buildNoAudio(dir);
    assert.match(out.html, /example\.invalid/, '출처 URL 글자는 화면에 보여 줍니다');
    assert.doesNotMatch(out.html, /<a\s[^>]*href\s*=\s*["'](?!#)|<img\s|<link\s+(?!rel="icon" href="data:,">)|<script\s+src|<iframe/i);
    const withoutUrlText = out.html.replace(/https:\/\/example\.invalid\S*/g, '');
    assert.doesNotMatch(withoutUrlText.replace(/data:audio\/mpeg;base64,[A-Za-z0-9+/=]+/g, ''), /https?:\/\/|www\./);
    // 원본 출처 파일에는 URL 이 있지만(감사용) 산출물에는 한 글자도 없다
    assert.match(fs.readFileSync(path.join(dir, 'assets', 'chalk-writing-source.json'), 'utf8'), /https:\/\//);
    assert.doesNotMatch(out.html, /freesound|creativecommons\.org|digitale\.de\//i);
    assert.match(out.html, /digitale\.de/);
    assert.match(out.html, /CC0/);
  });
});

test('빌드 실패: 칠판 글꼴에 없는 글자 — 한자 부분 글꼴에도 없는 한자, 이모지, 기호', () => {
  const failing = (mutate, pattern, label) => withTempRoot(mutate, (dir) => assert.throws(() => buildNoAudio(dir), pattern, label));
  // 부분 글꼴에 없는 한자(闕 등)를 판서 글에 쓰면 실패
  failing((dir) => editJson(dir, 'content/01-steps.json', (j) => { elemOf({ steps: j.steps }, 'ch01-five', 'spoke').han = '龘'; }), /글꼴에 없는 (글자|한자)/, 'han-missing');
  failing((dir) => editJson(dir, 'content/01-steps.json', (j) => { j.steps[0].panel[0].text = '불 🔥 붙는다'; }), /글꼴에 없는 글자/, 'emoji');
  failing((dir) => editJson(dir, 'content/00-meta.json', (j) => { j.quiz[0].question = '龘 한자는 글꼴에 없다. 무엇일까요?'; }), /한자 부분 글꼴에 없는 한자/, 'dom-han');
  // 모든 한자가 글꼴에 있는 정상 내용은 통과
  withTempRoot(() => {}, (dir) => assert.ok(buildNoAudio(dir).html.length > 1e5));
});

test('빌드 실패: 스키마 위반은 빌드를 막고 오류 목록(problems)을 돌려준다', () => {
  withTempRoot((dir) => editJson(dir, 'content/01-steps.json', (j) => { j.steps[0].narration = '짧아요.'; }), (dir) => {
    try {
      buildNoAudio(dir);
      assert.fail('실패해야 합니다');
    } catch (e) {
      assert.match(e.message, /빌드 실패/);
      assert.ok(Array.isArray(e.problems) && e.problems.some((p) => /330~430/.test(p)));
    }
  });
});

test('빌드 실패: 모르는 파일 형식·깨진 JSON·메타의 steps', () => {
  const failing = (mutate, pattern, label) => withTempRoot(mutate, (dir) => assert.throws(() => buildNoAudio(dir), pattern, label));
  failing((dir) => editFile(dir, 'content/01-steps.json', (t) => t.slice(0, t.length - 40)), /읽을 수 없습니다/, 'malformed-json');
  failing((dir) => fs.rmSync(path.join(dir, 'content', '00-meta.json')), /00-meta\.json/, 'missing-meta');
  failing((dir) => editJson(dir, 'content/00-meta.json', (j) => { j.steps = []; }), /steps 는 01~04/, 'meta-steps');
  failing((dir) => editJson(dir, 'content/01-steps.json', (j) => { j.extra = 1; }), /steps 밖의 키/, 'extra-key');
});

test('빌드 실패(오프라인 규칙): 외부 URL, @import, fetch, innerHTML, eval, 음성합성, 다른 HTML, 빠진 토큰, </script', () => {
  const failing = (mutate, pattern, label) => withTempRoot(mutate, (dir) => assert.throws(() => buildNoAudio(dir), pattern, label));
  failing((dir) => editFile(dir, TEMPLATE_NAME, (t) => t.replace('</body>', '<img src="https://example.com/a.png"></body>')), /외부 URL|src/, 'external-url');
  failing((dir) => editFile(dir, 'style.css', (t) => '@import url("https://fonts.googleapis.com/css2?family=Nanum+Pen+Script");\n' + t), /@import|외부 URL|구글/, 'google-fonts');
  failing((dir) => editFile(dir, 'player.js', (t) => t + '\nfetch("x");\n'), /fetch/, 'fetch');
  failing((dir) => editFile(dir, 'player.js', (t) => t + '\nnew XMLHttpRequest();\n'), /XMLHttpRequest/, 'xhr');
  failing((dir) => editFile(dir, 'player.js', (t) => t + '\ndocument.body.innerHTML = "x";\n'), /HTML 문자열 삽입/, 'innerHTML');
  failing((dir) => editFile(dir, 'player.js', (t) => t + '\neval("1");\n'), /eval/, 'eval');
  failing((dir) => editFile(dir, 'player.js', (t) => t + '\nwindow.speechSynthesis.speak(1);\n'), /음성 합성|speechSynthesis/, 'speechSynthesis');
  failing((dir) => editFile(dir, 'draw.js', (t) => t + '\n/* </script> */\n'), /<\/script/, 'script-break');
  failing((dir) => fs.writeFileSync(path.join(dir, 'other.html'), '<html></html>'), /HTML을 둘 수 없습니다/, 'extra-html');
  failing((dir) => editFile(dir, TEMPLATE_NAME, (t) => t.replace('/*__PLAYER__*/', '')), /__PLAYER__/, 'missing-token');
  failing((dir) => editFile(dir, TEMPLATE_NAME, (t) => t.replace('/*__DRAW__*/', '')), /__DRAW__/, 'missing-draw-token');
  failing((dir) => fs.rmSync(path.join(dir, 'assets', 'ChalkHanja-subset.otf')), /ChalkHanja-subset\.otf/, 'missing-hanja-font');
  failing((dir) => fs.rmSync(path.join(dir, 'assets', 'OFL-NotoSerifCJK.txt')), /OFL-NotoSerifCJK/, 'missing-license');
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
  ]) {
    assert.match(findForbidden(html).join('\n'), pattern, html);
  }
  assert.deepEqual(findForbidden('<p>안녕</p><style>a{background:url(data:image/png;base64,AAAA)}</style>'), []);
});

/* ------------------------------------------------------------------ */
/* 4. 소리: 해설 클립 · 분필 녹음                                      */
/* ------------------------------------------------------------------ */
const id3v2 = (text) => {
  const body = Buffer.concat([Buffer.from([0]), Buffer.from('src\0' + text, 'latin1')]);
  const frame = Buffer.concat([Buffer.from('TXXX', 'latin1'), Buffer.from([0, 0, (body.length >> 8) & 255, body.length & 255, 0, 0]), body]);
  const n = frame.length;
  return Buffer.concat([Buffer.from('ID3', 'latin1'), Buffer.from([3, 0, 0, (n >> 21) & 127, (n >> 14) & 127, (n >> 7) & 127, n & 127]), frame]);
};

test('분필 녹음: 실제 CC0 녹음 MP3 (4초 이상), 출처 파일은 CC0·recorded:true, 글꼴 라이선스 전문이 있다', () => {
  const info = mp3Info(fs.readFileSync(path.join(ROOT, 'assets', 'chalk-writing.mp3')));
  assert.ok(info.frames > 500 && info.duration > 4, JSON.stringify(info));
  assert.equal(info.junkBytes, 0);
  const src = JSON.parse(read('assets/chalk-writing-source.json'));
  assert.equal(src.license, 'CC0-1.0');
  assert.equal(src.recorded, true);
  assert.match(read('assets/OFL.txt'), /SIL OPEN FONT LICENSE/i);
  assert.match(read('assets/OFL-NotoSerifCJK.txt'), /SIL OPEN FONT LICENSE/i);
  assert.ok(fs.existsSync(path.join(ROOT, 'assets', 'ChalkHanja-subset.otf')));
  assert.ok(fs.existsSync(path.join(ROOT, 'subset_hanja.py')));
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

test('소리: 출처 메타데이터는 허용 목록 필드만, URL 은 지우고 내장한다', () => {
  withTempRoot(() => {}, (dir) => {
    const out = buildNoAudio(dir);
    const c = out.scene.chalkSound;
    assert.deepEqual(Object.keys(c).sort(), ['audio', 'creator', 'duration', 'edits', 'license', 'recorded', 'title']);
    assert.equal(c.creator, 'digitale.de');
    assert.match(c.title, /Writing with Chalk/);
    assert.doesNotMatch(JSON.stringify({ ...c, audio: '' }), /https?:|www\./);
    assert.ok(c.duration >= 4);
  });
});

test('빌드 실패(소리): 대본 변경(해시)·빠진/잘린/가짜 클립·길이 불일치·잘못된 목소리·합성 아님·CC0 아님·녹음 아님·짧은 분필', () => {
  const failing = (mutate, pattern, label) => withTempRoot(mutate, (dir) => assert.throws(() => buildWithAudio(dir), pattern, label), { audio: true });
  failing((dir) => editJson(dir, 'content/01-steps.json', (j) => { j.steps[2].narration = j.steps[2].narration.replace(/\.$/, '. 바뀐 문장입니다.'); }), /ch01-five[\s\S]*(오래|대본|narrate)/, 'script-changed');
  failing((dir) => fs.rmSync(path.join(dir, 'audio', 'ch03-ladder.mp3')), /audio\/ch03-ladder\.mp3/, 'missing clip');
  failing((dir) => fs.writeFileSync(path.join(dir, 'audio', 'fx-compare.mp3'), 'not an mp3 '.repeat(500)), /audio\/fx-compare\.mp3[\s\S]*(MP3|프레임)/, 'not mp3');
  failing((dir) => { const f = path.join(dir, 'audio', 'fx-timeline.mp3'); fs.writeFileSync(f, fs.readFileSync(f).subarray(0, 60000)); }, /audio\/fx-timeline\.mp3[\s\S]*(길이|프레임 밖)/, 'truncated');
  failing((dir) => editJson(dir, 'audio/durations.json', (j) => { j['fx-diagram'] = 20.5; }), /fx-diagram[\s\S]*길이/, 'duration mismatch');
  failing((dir) => editJson(dir, 'audio/durations.json', (j) => { delete j['ch13-table']; }), /ch13-table[\s\S]*durations/, 'missing duration');
  failing((dir) => editJson(dir, 'audio/provider.json', (j) => { j.voice = 'en-US-Other:Voice'; }), /목소리|voice/i, 'voice');
  failing((dir) => editJson(dir, 'audio/provider.json', (j) => { j.model = 'Other'; }), /model/, 'model');
  failing((dir) => editJson(dir, 'audio/provider.json', (j) => { j.synthetic = false; }), /synthetic|합성/, 'synthetic flag');
  failing((dir) => editJson(dir, 'audio/provider.json', (j) => { delete j.scriptSha256; }), /scriptSha256/, 'no hashes');
  failing((dir) => editJson(dir, 'assets/chalk-writing-source.json', (j) => { j.license = 'CC-BY-4.0'; }), /CC0/, 'license');
  failing((dir) => editJson(dir, 'assets/chalk-writing-source.json', (j) => { j.recorded = false; }), /녹음|recorded/, 'recorded');
  failing((dir) => { const f = path.join(dir, 'assets', 'chalk-writing.mp3'); fs.writeFileSync(f, fs.readFileSync(f).subarray(0, 20000)); }, /chalk-writing\.mp3[\s\S]*(4초|짧|프레임 밖)/, 'short chalk');
  // 정상 클립은 clipMinSeconds 를 기본값(20초)으로 두면 "너무 짧다"로 막힌다
  withTempRoot(() => {}, (dir) => assert.throws(() => build({ root: dir, write: false }), /너무 짧습니다/), { audio: true });
});

test('음성 포함 빌드는 audio/ 가 없으면 실패하고, --no-audio 는 audio/ 없이도 성공한다', () => {
  withTempRoot(() => {}, (dir) => {
    assert.throws(() => build({ root: dir, write: false }), /audio\/provider\.json|audio\/durations\.json/);
    assert.ok(buildNoAudio(dir).html.length > 1e5);
  });
});

/* ------------------------------------------------------------------ */
/* 5. 소스·템플릿·폴더 규칙                                            */
/* ------------------------------------------------------------------ */
test('player.js / draw.js / layout.js: 안전한 DOM 사용, 합성 소리 없음, 필수 API', () => {
  const player = read('player.js');
  for (const method of ['getState', 'goTo', 'play', 'pause', 'toggle', 'next', 'prev', 'replay', 'restart', 'seek', 'setSpeed', 'setAuto', 'setVoiceEnabled', 'setChalkEnabled', 'setChalkVolume', 'answerQuiz', 'layoutReport']) {
    assert.match(player, new RegExp('\\b' + method + '\\b'), method);
  }
  for (const f of ['player.js', 'draw.js', 'layout.js']) {
    const src = read(f);
    assert.doesNotMatch(src, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function|fetch\(|XMLHttpRequest/, f);
    assert.doesNotMatch(src, /speechSynthesis|SpeechSynthesis|createOscillator|createBuffer\(|createScriptProcessor|new OfflineAudioContext/, f);
    assert.doesNotMatch(src, /https?:\/\//, f);
  }
  assert.match(player, /prefers-reduced-motion/);
  assert.match(player, /decodeAudioData/);
  assert.match(player, /NotAllowedError/);
  assert.match(player, /layoutReport/);
});

test('템플릿: 해설·분필 컨트롤, 분필 음량 기본 25%, 한 장 요약·퀴즈·오해·참고 자료·장 목록 자리', () => {
  const t = read(TEMPLATE_NAME);
  for (const id of ['board', 'board-stage', 'voice-toggle', 'chalk-toggle', 'chalk-volume', 'chalk-volume-value', 'voice-note', 'chalk-note', 'auto-toggle', 'speed', 'chapters', 'quiz-list']) {
    assert.match(t, new RegExp('id="' + id + '"'), id);
  }
  assert.match(t, /<input id="chalk-volume" type="range" min="0" max="100" step="1" value="25">/);
  assert.match(t, /<output id="chalk-volume-value"[^>]*>25%<\/output>/);
  assert.match(t, /id="voice-note"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(t, /<html lang="ko"/);
  assert.match(t, /<canvas id="board"/);
  assert.match(t, /digitale\.de/);
  assert.match(t, /CC0/);
  assert.match(t, /MAI-Voice-2|Haena|합성/);
  assert.match(t, /작성: Microsoft Korea STU|%%AUTHOR%%/);
  assert.match(read('style.css'), /prefers-reduced-motion/);
  assert.match(read('style.css'), /\.chapter-btn/);
});

test('폴더 규칙: HTML은 template.html 과 art-of-war.html 뿐이고 가상환경·캐시는 무시된다', () => {
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
  assert.deepEqual(found.sort(), [OUTPUT_NAME, TEMPLATE_NAME].sort());
  const ignore = read('.gitignore');
  for (const pat of ['.venv/', '__pycache__/', '*.pending.mp3']) assert.ok(ignore.includes(pat), pat);
});

test('narrate.py: 목소리·리소스·두 번째 제한 간격이 코드에 고정되어 있다 (실제 호출은 하지 않음)', () => {
  const py = read('narrate.py');
  assert.match(py, /ko-KR-Haena:MAI-Voice-2/);
  assert.match(py, /mai-transcribe-westus-resource/);
  assert.match(py, /public-ai-rg/);
  assert.match(py, /THROTTLE_SECONDS\s*=\s*2/);
  for (const flag of ['--smoke', '--force', '--only', '--check']) assert.ok(py.includes(flag), flag);
  assert.match(py, /scriptSha256/);
  assert.match(py, /provider\.json/);
  assert.match(py, /durations\.json/);
  assert.doesNotMatch(py, /(subscription[_-]?key|api[_-]?key)\s*=\s*["'][A-Za-z0-9]{16,}/i);
  assert.match(read('requirements-audio.txt'), /azure-cognitiveservices-speech/);
});

/* ------------------------------------------------------------------ */
/* 6. 저장소의 산출물이 최신인가                                        */
/* ------------------------------------------------------------------ */
test('산출물 art-of-war.html 이 현재 소스·내용으로 만든 빌드와 같다 (다르면 node build.mjs 를 다시 실행하세요)', { skip: !hasReal && '콘텐츠 없음' }, () => {
  const html = read(OUTPUT_NAME);
  const dev = /"build":\{"noAudio":true\}/.test(html);
  const hasAudioDir = fs.existsSync(path.join(ROOT, 'audio', 'provider.json'));
  if (!dev && !hasAudioDir) assert.fail('음성 빌드 산출물인데 audio/ 가 없습니다');
  const out = build({ write: false, noAudio: dev });
  assert.equal(html, out.html, OUTPUT_NAME + ' 이(가) 최신이 아닙니다. ' + (dev ? 'node build.mjs --no-audio' : 'node build.mjs') + ' 를 다시 실행하세요.');
  assert.deepEqual(findForbidden(out.html.replace(/data:audio\/mpeg;base64,[A-Za-z0-9+/=]+/g, '')).filter((p) => !/example\.invalid/.test(p)), findForbidden(out.html).filter((p) => !/example\.invalid/.test(p)));
});

test('산출물: 푸터 작성자, 줄어든 동작 CSS, 내장 글꼴, <audio>/<video> 요소 없음, Canvas 칠판', { skip: !fs.existsSync(path.join(ROOT, OUTPUT_NAME)) && '산출물 없음' }, () => {
  const html = read(OUTPUT_NAME);
  assert.match(html, /<footer[\s\S]*작성: Microsoft Korea STU[\s\S]*<\/footer>/);
  assert.match(html, /window\.artOfWarPlayer\s*=/);
  assert.match(html, /@font-face\{font-family:ChalkKorean;src:url\(data:font\/ttf;base64,/);
  assert.match(html, /@font-face\{font-family:ChalkHanja;src:url\(data:font\/otf;base64,/);
  assert.match(html, /prefers-reduced-motion/);
  assert.doesNotMatch(html, /<audio|<video|speechSynthesis|SpeechSynthesis|createOscillator|createBuffer\(/);
  assert.match(html, /<html lang="ko"/);
  assert.match(html, /<canvas id="board"/);
  assert.match(html, /<meta name="viewport"/);
});
