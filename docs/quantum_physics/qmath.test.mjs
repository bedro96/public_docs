// qmath.js 시험: 서식 토큰 · 안전한 수식 파서/계산기 · 시간표.   실행: node --test qmath.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const Q = require('./qmath.js');
const HERE = path.dirname(fileURLToPath(import.meta.url));

const ev = (src, x = 0) => Q.compileExpr(src)(x);
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, a + ' ≈ ' + b);
const throwsSyntax = (src, re) => assert.throws(() => Q.parseExpr(src), (e) => e instanceof SyntaxError && (!re || re.test(e.message)), src);

/* ---------------------------------------------------------------- 서식 토큰 */
test('parseRich: 위첨자·아래첨자·강조', () => {
  const runs = Q.parseRich('E_{n} = x^{2} **굵게** 끝');
  assert.deepEqual(
    runs.map((r) => [r.text, r.sup, r.sub, r.strong]),
    [['E', false, false, false], ['n', false, true, false], [' = x', false, false, false], ['2', true, false, false], [' ', false, false, false], ['굵게', false, false, true], [' 끝', false, false, false]],
  );
  assert.equal(Q.richToPlain(runs), 'E_n = x^2 굵게 끝');
});

test('parseRich: 평문은 한 조각, 빈 문자열은 조각 없음', () => {
  assert.equal(Q.parseRich('ψ ħ λ ∫ √ ⟩').length, 1);
  assert.equal(Q.parseRich('').length, 0);
});

test('parseRich: 잘못된 토큰은 모두 오류', () => {
  for (const bad of ['x^2', 'x^{2', 'x^{}', 'a_b', 'a * b', '**굵게', 'x^{a^b}', 'x^{[1]}', '{x}', 'a\\b', '[[point]]', 'a\u0001b', 'x^{a_b}']) {
    assert.throws(() => Q.parseRich(bad), Error, bad);
  }
  assert.throws(() => Q.parseRich(42), Error);
});

test('richChars: 화면에 그려지는 글자 집합', () => {
  const set = Q.richChars(Q.parseRich('E_{n} ψ^{2}'));
  for (const ch of ['E', 'n', ' ', 'ψ', '2']) assert.ok(set.has(ch), ch);
  assert.ok(!set.has('_') && !set.has('^') && !set.has('{'));
});

/* ---------------------------------------------------------------- 수식: 산술 */
test('expr: 숫자와 사칙연산, 우선순위', () => {
  assert.equal(ev('1 + 2 * 3'), 7);
  assert.equal(ev('(1 + 2) * 3'), 9);
  assert.equal(ev('10 - 4 - 3'), 3); // 왼쪽 결합
  assert.equal(ev('100 / 10 / 5'), 2);
  assert.equal(ev('2 * 3 / 4'), 1.5);
  assert.equal(ev('.5 + 1.'), 1.5);
  assert.equal(ev('2e3'), 2000);
  close(ev('2.5e-1'), 0.25);
});

test('expr: ^ 는 오른쪽 결합이고 단항 마이너스보다 먼저 묶인다', () => {
  assert.equal(ev('2^3^2'), 512); // 2^(3^2)
  assert.equal(ev('(2^3)^2'), 64);
  assert.equal(ev('-x^2', 3), -9); // -(x^2)
  assert.equal(ev('(-x)^2', 3), 9);
  assert.equal(ev('2^-1'), 0.5);
  assert.equal(ev('2^-x', 2), 0.25);
  assert.equal(ev('- - 3'), 3);
  assert.equal(ev('+3'), 3);
  assert.equal(ev('3 - -2'), 5);
  assert.equal(ev('x^2 + 1', 4), 17);
});

test('expr: x, pi, e 상수', () => {
  assert.equal(ev('x', 1.25), 1.25);
  close(ev('pi'), Math.PI);
  close(ev('e'), Math.E);
  close(ev('2 * pi * x', 0.5), Math.PI);
  close(ev('e^x', 1), Math.E);
});

test('expr: 모든 함수', () => {
  close(ev('sin(pi/2)'), 1);
  close(ev('cos(0)'), 1);
  close(ev('tan(pi/4)'), 1);
  close(ev('exp(1)'), Math.E);
  close(ev('ln(e)'), 1);
  close(ev('sqrt(16)'), 4);
  assert.equal(ev('abs(-3.5)'), 3.5);
  assert.equal(ev('sinc(0)'), 1);
  close(ev('sinc(pi/2)'), 2 / Math.PI);
  close(ev('tanh(0.5)'), Math.tanh(0.5));
  close(ev('sinh(1)'), Math.sinh(1));
  close(ev('cosh(1)'), Math.cosh(1));
  assert.equal(ev('step(-0.1)'), 0);
  assert.equal(ev('step(0)'), 1);
  assert.equal(ev('step(2)'), 1);
  assert.deepEqual([...Q.FUNCTION_NAMES].sort(), ['abs', 'cos', 'cosh', 'exp', 'ln', 'sin', 'sinc', 'sinh', 'sqrt', 'step', 'tan', 'tanh']);
});

test('expr: 함수 중첩과 실제 물리 곡선', () => {
  close(ev('sin(x)^2 + cos(x)^2', 1.234), 1);
  close(ev('exp(-(x-3)^2)', 3), 1);
  close(ev('exp(-(x-3)^2)', 4), Math.exp(-1));
  close(ev('sqrt(2) * sin(pi * x)', 0.5), Math.SQRT2);
  close(ev('1/(exp(x) - 1)', 1), 1 / (Math.E - 1));
  assert.equal(ev('step(x) * (1 - exp(-x))', -2) + 0, 0); // (-0 + 0 === 0)
});

test('expr: 정의되지 않는 곳은 NaN (0 나누기, ln 음수, 넘침, 음수의 분수 거듭제곱)', () => {
  assert.ok(Number.isNaN(ev('1/x', 0)));
  assert.ok(Number.isNaN(ev('ln(x)', -1)));
  assert.ok(Number.isNaN(ev('ln(0)')));
  assert.ok(Number.isNaN(ev('sqrt(x)', -4)));
  assert.ok(Number.isNaN(ev('exp(1000)')));
  assert.ok(Number.isNaN(ev('(-8)^(1/3)')));
  assert.ok(Number.isNaN(ev('0/0')));
  assert.ok(Number.isNaN(ev('10^400')));
});

/* ---------------------------------------------------------------- 수식: 오류 */
test('expr: 문법 오류는 한국어 설명이 붙은 SyntaxError', () => {
  throwsSyntax('', /비어/);
  throwsSyntax('   ', /비어/);
  throwsSyntax('1 +', /끝났/);
  throwsSyntax('(1 + 2', /\)/);
  throwsSyntax('1 + 2)', /\)/);
  throwsSyntax('* 2', /예상치/);
  throwsSyntax('2x', /곱셈/);
  throwsSyntax('2 x', /곱셈/);
  throwsSyntax('2(3)', /곱셈/);
  throwsSyntax('(1)(2)', /곱셈/);
  throwsSyntax('1.2.3', /곱셈/);
  throwsSyntax('sin x', /\(/);
  throwsSyntax('sin', /\(/);
  throwsSyntax('foo(x)', /알 수 없는 이름/);
  throwsSyntax('y + 1', /알 수 없는 이름/);
  throwsSyntax('X + 1', /알 수 없는 이름/); // 대소문자 구분
  throwsSyntax('Sin(x)', /알 수 없는 이름/);
  throwsSyntax('x # 2', /허용되지 않는 문자/);
  throwsSyntax('x ; y', /허용되지 않는 문자/);
  throwsSyntax('x, 1', /허용되지 않는 문자/);
  throwsSyntax('x = 1', /허용되지 않는 문자/);
  throwsSyntax('π', /허용되지 않는 문자/);
  throwsSyntax('x²', /허용되지 않는 문자/);
});

test('expr: 길이와 깊이 제한', () => {
  throwsSyntax('1+'.repeat(Q.MAX_EXPR_LENGTH) + '1', /너무 깁니다/);
  throwsSyntax('('.repeat(60) + 'x' + ')'.repeat(60), /너무 깊/);
  throwsSyntax('-'.repeat(60) + 'x', /너무 깊/);
  assert.equal(ev('('.repeat(20) + '1' + ')'.repeat(20)), 1);
  assert.throws(() => Q.parseExpr(42), SyntaxError);
  assert.throws(() => Q.parseExpr(null), SyntaxError);
});

test('expr: 안전성 — 어떤 입력도 코드 실행으로 이어지지 않는다', () => {
  globalThis.__qmathPwned = false;
  const attacks = [
    'constructor', 'constructor.constructor("return 1")()', '__proto__', 'this', 'globalThis', 'process', 'require("fs")',
    'x.constructor', 'toString()', 'hasOwnProperty', 'sin.call(x)', 'Math.sin(x)', 'alert(1)', '(()=>1)()', '`${1}`',
    'x;globalThis.__qmathPwned=true', 'eval("1")', 'Function("return 1")()', 'import("fs")', '[1][0]', '{}', 'a=1',
  ];
  for (const a of attacks) assert.throws(() => Q.compileExpr(a), SyntaxError, a);
  assert.equal(globalThis.__qmathPwned, false);
  delete globalThis.__qmathPwned;
  // 프로토타입 속성 이름은 상수/함수로 취급되지 않는다
  for (const name of ['constructor', 'toString', 'valueOf', 'hasOwnProperty']) throwsSyntax(name + '(x)', /알 수 없는 이름/);
  throwsSyntax('__proto__(x)', /허용되지 않는 문자/); // 밑줄은 토큰이 될 수 없다
  // 소스 코드에도 동적 실행 API 가 없다
  const code = fs.readFileSync(path.join(HERE, 'qmath.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/'[^'\n]*'|"[^"\n]*"/g, '""');
  assert.ok(!/\beval\s*\(/.test(code), 'eval 사용 금지');
  assert.ok(!/new\s+Function\b|\bFunction\s*\(/.test(code), 'Function 생성자 사용 금지');
  assert.ok(!/\binnerHTML\b|\bdocument\b|\bfetch\s*\(/.test(code), '브라우저 API 사용 금지');
});

test('compileExpr: 반환 함수는 유한값 또는 NaN 만 돌려주고 source 를 기억한다', () => {
  const f = Q.compileExpr('1/x');
  assert.equal(f.source, '1/x');
  assert.equal(f(2), 0.5);
  assert.ok(Number.isNaN(f(0)));
  assert.ok(Number.isNaN(Q.compileExpr('exp(x)')(1e6)));
});

/* ---------------------------------------------------------------- 표본 */
test('sampleCurve: 연속 곡선은 한 조각, 극점은 조각을 끊는다', () => {
  const sin = Q.compileExpr('sin(x)');
  const whole = Q.sampleCurve(sin, 0, 2 * Math.PI, 100, [-1, 1]);
  assert.equal(whole.length, 1);
  assert.equal(whole[0].length, 101);
  assert.equal(whole[0][0][0], 0);
  close(whole[0][100][0], 2 * Math.PI);

  const tan = Q.compileExpr('tan(x)');
  const pieces = Q.sampleCurve(tan, -4, 4, 400, [-3, 3]);
  assert.ok(pieces.length >= 2, '극점에서 끊김: ' + pieces.length);
  for (const piece of pieces) for (const [, y] of piece) assert.ok(Math.abs(y) <= 3 + 6 * 4, 'slack 안');

  const inv = Q.compileExpr('1/x');
  const halves = Q.sampleCurve(inv, -2, 2, 100, [-4, 4]);
  assert.equal(halves.length, 2);
});

test('sampleCurve: 한 점짜리 조각은 버린다 / 전부 정의되지 않으면 빈 배열', () => {
  assert.deepEqual(Q.sampleCurve(() => NaN, 0, 1, 10), []);
  const f = (x) => (x === 0.5 ? 1 : NaN);
  assert.deepEqual(Q.sampleCurve(f, 0, 1, 10), []);
  assert.equal(Q.sampleCurve((x) => x, 0, 1, 10).length, 1);
});

test('sampleStats: 유한한 표본과 화면 안 표본', () => {
  const g = Q.compileExpr('exp(-x^2)');
  const s = Q.sampleStats(g, -3, 3, 60, [0, 1.2]);
  assert.equal(s.total, 61);
  assert.equal(s.finite, 61);
  assert.equal(s.inView, 61);
  close(s.ymax, 1, 0.01);
  const none = Q.sampleStats(Q.compileExpr('10 + x'), 0, 1, 10, [0, 1]);
  assert.equal(none.inView, 0);
  assert.equal(none.finite, 11);
  const nan = Q.sampleStats(Q.compileExpr('ln(x)'), -2, -1, 10, [-5, 5]);
  assert.equal(nan.finite, 0);
});

/* ---------------------------------------------------------------- 시간표 */
test('estimateNarration / fastestNarration: 글자 수에 비례, 6~150초로 제한', () => {
  const t = '가'.repeat(340);
  close(Q.estimateNarration(t), 340 / Q.NARRATION_CHARS_PER_SEC);
  assert.ok(Q.fastestNarration(t) < Q.estimateNarration(t));
  assert.equal(Q.estimateNarration(''), 6);
  assert.equal(Q.estimateNarration(undefined), 6);
  assert.equal(Q.estimateNarration('가'.repeat(5000)), 150);
});

test('textDuration: 0.7~2.4초', () => {
  assert.equal(Q.textDuration('a'), 0.7);
  assert.equal(Q.textDuration('a'.repeat(100)), 2.4);
  close(Q.textDuration('a'.repeat(20)), 1.5);
});

test('elementDuration: 종류별 기본값, dur 지정, 글자 수 반영', () => {
  assert.equal(Q.elementDuration({ type: 'axes', at: 0 }), Q.DEFAULT_DUR.axes);
  assert.equal(Q.elementDuration({ type: 'fn', at: 0 }), Q.DEFAULT_DUR.fn);
  assert.equal(Q.elementDuration({ type: 'fn', at: 0, dur: 5 }), 5);
  assert.ok(Q.elementDuration({ type: 'fn', at: 0, label: { text: 'ψ(x) 파동함수' } }) > Q.DEFAULT_DUR.fn);
  assert.equal(Q.elementDuration({ type: 'point', at: 0 }), Q.DEFAULT_DUR.point);
  assert.ok(Q.elementDuration({ type: 'point', at: 0, label: '들뜬 상태' }) > Q.DEFAULT_DUR.point);
  assert.ok(Q.elementDuration({ type: 'text', at: 0, text: '긴 설명 글자가 많은 문장입니다' }) > Q.elementDuration({ type: 'text', at: 0, text: 'x' }));
  assert.ok(Q.elementDuration({ type: 'node', at: 0, title: '제목', lines: ['한 줄', '두 줄'] }) > Q.DEFAULT_DUR.node);
  assert.equal(Q.elementDuration({ type: 'bar', at: 0, dur: 2 }), 2);
});

test('stepTimeline: 판서 줄 시작 기본값, board 끝, 마지막 자막, hold', () => {
  const step = {
    summary: '요약 문장입니다',
    panel: [{ text: '첫 줄' }, { text: '둘째 줄', at: 5 }, { text: '셋째 줄' }],
    board: { elements: [{ type: 'axes', at: 0.5 }, { type: 'fn', at: 1, dur: 10 }] },
    beats: [{ at: 0, text: '하나' }, { at: 20, text: '둘' }],
  };
  const tl = Q.stepTimeline(step);
  assert.equal(tl.panel.length, 3);
  assert.equal(tl.panel[0].at, 0.3);
  close(tl.panel[1].at, 5);
  close(tl.panel[2].at, tl.panel[1].at + tl.panel[1].dur + 0.25);
  assert.equal(tl.boardEnd, 11);
  assert.equal(tl.animEnd, 20.4); // 마지막 자막 20 + 0.4
  assert.ok(tl.holdEnd >= tl.animEnd + 3);
  assert.ok(tl.animEnd >= tl.boardEnd && tl.animEnd >= tl.panelEnd);
});

test('stepTimeline: 빈 단계도 안전', () => {
  const tl = Q.stepTimeline({ summary: '가', beats: [], panel: [], board: { elements: [] } });
  assert.equal(tl.animEnd, 0.4);
  assert.ok(tl.holdEnd >= 3.4);
});

test('상수: 팔레트 6색, tone 5종', () => {
  assert.deepEqual([...Q.PALETTE], ['white', 'mint', 'yellow', 'pink', 'sky', 'orange']);
  assert.deepEqual([...Q.TONES], ['concept', 'experiment', 'math', 'apply', 'open']);
});

/* ---------------------------------------------------------------- 실제 내용의 수식 */
test('실제 내용(content/): 모든 graph 의 expr 가 파싱되고 유한값을 낸다', (t) => {
  const dir = path.join(HERE, 'content');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^\d\d-.+\.json$/.test(f) && f !== '00-meta.json') : [];
  if (!files.length) return t.skip('content/ 가 비어 있음');
  let count = 0;
  for (const f of files) {
    const step = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (!step.board || step.board.kind !== 'graph') continue;
    const [x0, x1] = step.board.view.x;
    for (const el of step.board.elements) {
      if (el.type !== 'fn' && el.type !== 'area') continue;
      for (const src of [el.expr, el.expr2].filter((s) => typeof s === 'string')) {
        const stats = Q.sampleStats(Q.compileExpr(src), el.from !== undefined ? el.from : x0, el.to !== undefined ? el.to : x1, 120);
        assert.ok(stats.finite > 10, f + ': ' + src + ' 유한한 값이 거의 없음');
        count++;
      }
    }
  }
  assert.ok(count > 5, '검사한 수식이 너무 적음: ' + count);
});
