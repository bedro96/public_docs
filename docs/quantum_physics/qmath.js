/* qmath.js - 서식 토큰 파서, 판서 시간표, 그리고 그래프용 안전한 수식 계산기.
 *
 * 브라우저(window.QMath)와 Node(require)가 같은 파일을 씁니다.
 * - 빌드(build.mjs)·검증(validate.mjs)·시험은 장면 원본을 이 파일로 다시 읽어 검사합니다.
 * - 재생기(player.js)는 같은 파서로 글을 풀고 같은 계산기로 곡선을 그립니다.
 *
 * 구성: 1) 서식 토큰(^{ } _{ } ** **)  2) 수식 파서·계산기(eval/Function 을 쓰지 않는 손으로 쓴 재귀 하강 파서)
 *       3) 곡선 표본 추출  4) 시간표
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  else root.QMath = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ====================================================================
   * 1. 서식 토큰
   *   ^{...} 위첨자   _{...} 아래첨자   **...** 강조
   *   그 밖의 ^ _ { } \ 는 모두 오류입니다. (HTML은 쓰지 않으며 출력은 항상 텍스트 노드로만 만듭니다.)
   * ==================================================================== */
  function parseRich(src) {
    if (typeof src !== 'string') throw new Error('문자열이 아닙니다');
    const runs = [];
    let buf = '';
    let strong = false;
    const flush = () => {
      if (buf) runs.push({ text: buf, sup: false, sub: false, strong });
      buf = '';
    };
    let i = 0;
    while (i < src.length) {
      const ch = src[i];
      if (ch === '*') {
        if (src[i + 1] !== '*') throw new Error('낱개 * 는 쓸 수 없습니다 (강조는 **...**): ' + JSON.stringify(src));
        flush();
        strong = !strong;
        i += 2;
        continue;
      }
      if ((ch === '^' || ch === '_') && src[i + 1] === '{') {
        const end = src.indexOf('}', i + 2);
        if (end < 0) throw new Error('닫히지 않은 첨자 토큰: ' + JSON.stringify(src));
        const inner = src.slice(i + 2, end);
        if (!inner) throw new Error('빈 첨자 토큰: ' + JSON.stringify(src));
        if (/[{}^_\\*[\]]/.test(inner)) throw new Error('첨자 토큰 안에 쓸 수 없는 문자가 있습니다: ' + JSON.stringify(src));
        flush();
        runs.push({ text: inner, sup: ch === '^', sub: ch === '_', strong });
        i = end + 1;
        continue;
      }
      if (ch === '^' || ch === '_' || ch === '{' || ch === '}' || ch === '\\') {
        throw new Error('잘못된 서식 문자 ' + JSON.stringify(ch) + ': ' + JSON.stringify(src));
      }
      if (ch === '[' && src[i + 1] === '[') throw new Error('[[ 자리표시자는 쓸 수 없습니다: ' + JSON.stringify(src));
      if (ch < ' ' || ch === '\u007f') throw new Error('제어 문자는 쓸 수 없습니다: ' + JSON.stringify(src));
      buf += ch;
      i += 1;
    }
    if (strong) throw new Error('닫히지 않은 ** 강조: ' + JSON.stringify(src));
    flush();
    return runs;
  }

  /** 스크린리더/aria용 평문: x^{2} -> x^2, E_{n} -> E_n */
  function richToPlain(runs) {
    return runs.map((r) => (r.sup ? '^' + r.text : r.sub ? '_' + r.text : r.text)).join('');
  }

  /** 화면에 실제로 그려지는 글자 집합(공백 포함). 글리프 검사용. */
  function richChars(runs) {
    const set = new Set();
    for (const r of runs) for (const ch of r.text) set.add(ch);
    return set;
  }

  /* ====================================================================
   * 2. 수식 파서 · 계산기
   *
   *   expr   := term (('+' | '-') term)*
   *   term   := unary (('*' | '/') unary)*
   *   unary  := ('-' | '+') unary | power
   *   power  := atom ('^' unary)?            오른쪽 결합: 2^3^2 = 2^(3^2),  -x^2 = -(x^2),  2^-x 허용
   *   atom   := 숫자 | x | pi | e | 함수 '(' expr ')' | '(' expr ')'
   *
   * 곱셈 생략(2x)은 허용하지 않습니다. 파서는 AST 를 만들고, 계산기는 AST 를 클로저로 바꿔 실행합니다.
   * eval, new Function 등 동적 코드 실행은 쓰지 않습니다.
   * ==================================================================== */
  const MAX_EXPR_LENGTH = 240;
  const MAX_EXPR_DEPTH = 40;
  const CONSTANTS = { pi: Math.PI, e: Math.E };
  const FUNCTIONS = {
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    exp: Math.exp,
    ln: Math.log,
    sqrt: Math.sqrt,
    abs: Math.abs,
    sinc: (u) => (u === 0 ? 1 : Math.sin(u) / u),
    tanh: Math.tanh,
    sinh: Math.sinh,
    cosh: Math.cosh,
    step: (u) => (u >= 0 ? 1 : 0),
  };
  const FUNCTION_NAMES = Object.keys(FUNCTIONS);

  function tokenize(src) {
    const tokens = [];
    let i = 0;
    while (i < src.length) {
      const ch = src[i];
      if (ch === ' ' || ch === '\t') { i += 1; continue; }
      if ((ch >= '0' && ch <= '9') || (ch === '.' && src[i + 1] >= '0' && src[i + 1] <= '9')) {
        const m = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(i));
        tokens.push({ k: 'num', v: Number(m[0]), pos: i });
        i += m[0].length;
        continue;
      }
      if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')) {
        const m = /^[A-Za-z][A-Za-z0-9]*/.exec(src.slice(i));
        tokens.push({ k: 'id', v: m[0], pos: i });
        i += m[0].length;
        continue;
      }
      if ('+-*/^()'.includes(ch)) { tokens.push({ k: ch, pos: i }); i += 1; continue; }
      throw new SyntaxError('허용되지 않는 문자 ' + JSON.stringify(ch) + ' (위치 ' + (i + 1) + ')');
    }
    tokens.push({ k: 'end', pos: src.length });
    return tokens;
  }

  /** 문자열 수식을 AST 로 만듭니다. 문법 오류는 SyntaxError (한국어 설명) 로 던집니다. */
  function parseExpr(src) {
    if (typeof src !== 'string' || !src.trim()) throw new SyntaxError('수식이 비어 있습니다');
    if (src.length > MAX_EXPR_LENGTH) throw new SyntaxError('수식이 너무 깁니다 (' + MAX_EXPR_LENGTH + '자 이하)');
    const tokens = tokenize(src);
    let p = 0;
    let depth = 0;
    const peek = () => tokens[p];
    const fail = (msg, tok) => { throw new SyntaxError(msg + ' (위치 ' + ((tok || peek()).pos + 1) + ')'); };
    const eat = (k) => {
      if (peek().k !== k) fail("'" + k + "' 가 필요합니다");
      return tokens[p++];
    };
    const enter = () => { if (++depth > MAX_EXPR_DEPTH) fail('괄호·거듭제곱이 너무 깊습니다'); };
    const leave = () => { depth -= 1; };

    function parseSum() {
      let left = parseTerm();
      while (peek().k === '+' || peek().k === '-') {
        const op = tokens[p++].k;
        left = { t: 'bin', op, l: left, r: parseTerm() };
      }
      return left;
    }
    function parseTerm() {
      let left = parseUnary();
      while (peek().k === '*' || peek().k === '/') {
        const op = tokens[p++].k;
        left = { t: 'bin', op, l: left, r: parseUnary() };
      }
      return left;
    }
    function parseUnary() {
      if (peek().k === '-' || peek().k === '+') {
        const op = tokens[p++].k;
        enter();
        const e = parseUnary();
        leave();
        return op === '-' ? { t: 'neg', e } : e;
      }
      return parsePower();
    }
    function parsePower() {
      const base = parseAtom();
      if (peek().k === '^') {
        p += 1;
        enter();
        const exp = parseUnary();
        leave();
        return { t: 'bin', op: '^', l: base, r: exp };
      }
      return base;
    }
    function parseAtom() {
      const tok = peek();
      if (tok.k === 'num') { p += 1; return { t: 'num', v: tok.v }; }
      if (tok.k === '(') {
        p += 1;
        enter();
        const e = parseSum();
        leave();
        eat(')');
        return e;
      }
      if (tok.k === 'id') {
        p += 1;
        if (tok.v === 'x') return { t: 'x' };
        if (Object.prototype.hasOwnProperty.call(CONSTANTS, tok.v)) return { t: 'num', v: CONSTANTS[tok.v] };
        if (Object.prototype.hasOwnProperty.call(FUNCTIONS, tok.v)) {
          if (peek().k !== '(') fail("함수 " + tok.v + ' 뒤에는 ( 가 와야 합니다');
          p += 1;
          enter();
          const arg = parseSum();
          leave();
          eat(')');
          return { t: 'call', f: tok.v, a: arg };
        }
        fail('알 수 없는 이름 "' + tok.v + '" (쓸 수 있는 것: x, pi, e, ' + FUNCTION_NAMES.join(' ') + ')', tok);
      }
      if (tok.k === 'end') fail('수식이 갑자기 끝났습니다');
      fail("예상치 못한 '" + tok.k + "'");
      return null;
    }

    const ast = parseSum();
    if (peek().k !== 'end') {
      const k = peek().k;
      fail(k === 'num' || k === 'id' || k === '(' ? '곱셈 기호 * 가 빠졌습니다(2x 처럼 생략할 수 없습니다)' : "예상치 못한 '" + k + "'");
    }
    return ast;
  }

  /** AST 를 x -> number 클로저로 바꿉니다. 정의되지 않는 곳(0 으로 나누기, ln(-1), 넘침 ...)은 NaN 이 됩니다. */
  function compileAst(node) {
    switch (node.t) {
      case 'num': { const v = node.v; return () => v; }
      case 'x': return (x) => x;
      case 'neg': { const f = compileAst(node.e); return (x) => -f(x); }
      case 'call': {
        const fn = FUNCTIONS[node.f];
        const f = compileAst(node.a);
        return (x) => fn(f(x));
      }
      case 'bin': {
        const l = compileAst(node.l);
        const r = compileAst(node.r);
        switch (node.op) {
          case '+': return (x) => l(x) + r(x);
          case '-': return (x) => l(x) - r(x);
          case '*': return (x) => l(x) * r(x);
          case '/': return (x) => l(x) / r(x);
          default: return (x) => Math.pow(l(x), r(x));
        }
      }
      default: throw new Error('알 수 없는 AST 노드');
    }
  }

  /** 수식을 컴파일합니다. 반환 함수 f(x) 는 유한한 숫자 또는 NaN(정의되지 않음)만 돌려줍니다. */
  function compileExpr(src) {
    const f = compileAst(parseExpr(src));
    const g = (x) => {
      const y = f(x);
      return typeof y === 'number' && Number.isFinite(y) ? y : NaN;
    };
    g.source = src;
    return g;
  }

  /* ====================================================================
   * 3. 곡선 표본 추출
   * ==================================================================== */
  /**
   * f 를 [a, b] 에서 n+1 개 점으로 표본 추출합니다. 정의되지 않거나(NaN) 화면 범위를 크게 벗어나는 점에서
   * 선을 끊고, 끊어진 조각(점 [x, y] 의 배열)의 배열을 돌려줍니다. 한 점짜리 조각은 버립니다.
   * yRange=[lo, hi] 를 주면 그 높이의 `slack` 배 바깥(기본 4배)은 "화면 밖"으로 보고 끊습니다(tan 의 극점 등).
   */
  function sampleCurve(f, a, b, n, yRange, slack) {
    const out = [];
    let cur = [];
    const lo = yRange ? yRange[0] : -Infinity;
    const hi = yRange ? yRange[1] : Infinity;
    const pad = yRange ? (hi - lo) * (slack === undefined ? 4 : slack) : 0;
    for (let i = 0; i <= n; i++) {
      const x = a + ((b - a) * i) / n;
      const y = f(x);
      const ok = Number.isFinite(y) && y >= lo - pad && y <= hi + pad;
      if (ok) cur.push([x, y]);
      else {
        if (cur.length > 1) out.push(cur);
        cur = [];
      }
    }
    if (cur.length > 1) out.push(cur);
    return out;
  }

  /** 검증용 요약: 표본 n 개 중 유한한 것의 수, 그중 y 범위 안에 있는 것의 수. */
  function sampleStats(f, a, b, n, yRange) {
    let finite = 0;
    let inView = 0;
    let ymin = Infinity;
    let ymax = -Infinity;
    for (let i = 0; i <= n; i++) {
      const y = f(a + ((b - a) * i) / n);
      if (!Number.isFinite(y)) continue;
      finite += 1;
      ymin = Math.min(ymin, y);
      ymax = Math.max(ymax, y);
      if (!yRange || (y >= yRange[0] && y <= yRange[1])) inView += 1;
    }
    return { total: n + 1, finite, inView, ymin, ymax };
  }

  /* ====================================================================
   * 4. 시간표 (빌드·검증·재생기가 같은 값을 쓰도록 여기서 계산)
   * ==================================================================== */
  const PALETTE = ['white', 'mint', 'yellow', 'pink', 'sky', 'orange'];
  const TONES = ['concept', 'experiment', 'math', 'apply', 'open'];
  const DEFAULT_DUR = { axes: 0.9, fn: 2.4, area: 1.6, point: 0.4, seg: 1.0, ellipse: 1.6, text: 0.7, bar: 1.2, node: 0.75 };
  const READ_CHARS_PER_SEC = 9; // 자동 넘김 때 자막을 읽을 시간

  /** 해설 길이 추정(초): MAI-Voice-2 ko-KR-Haena 는 공백 포함 초당 약 6.8자(art_of_war 23클립 실측 6.2~7.6). */
  const NARRATION_CHARS_PER_SEC = 6.8;
  const NARRATION_FASTEST_CHARS_PER_SEC = 7.6;
  const estimateNarration = (narration) => Math.min(150, Math.max(6, Array.from(narration || '').length / NARRATION_CHARS_PER_SEC));
  const fastestNarration = (narration) => Math.min(150, Math.max(6, Array.from(narration || '').length / NARRATION_FASTEST_CHARS_PER_SEC));

  const textDuration = (plain) => Math.min(2.4, Math.max(0.7, plain.length * 0.075));
  const plainOf = (text) => richToPlain(parseRich(text));

  /** 요소 하나가 그려지는 데 걸리는 시간(초). 글이 붙은 요소는 글자 수에 비례해 늘어납니다. */
  function elementDuration(el) {
    const labelDur = (text) => (text ? textDuration(plainOf(text)) : 0);
    switch (el.type) {
      case 'point': return el.label ? 0.35 + 0.6 * labelDur(el.label) : DEFAULT_DUR.point;
      case 'text': return labelDur(el.text);
      case 'node': return DEFAULT_DUR.node + 0.7 * [el.title].concat(el.lines || []).reduce((n, t) => n + labelDur(t), 0);
      case 'fn': case 'seg': {
        const base = el.dur !== undefined ? el.dur : DEFAULT_DUR[el.type];
        return base + (el.label && el.label.text ? 0.6 * labelDur(el.label.text) : 0);
      }
      default: return el.dur !== undefined ? el.dur : DEFAULT_DUR[el.type] || 0.5;
    }
  }

  /**
   * 한 단계의 판서 시간표. 반환: { panel: [{at, dur}], boardEnd, panelEnd, animEnd, holdEnd }   (초 단위, 속도 1배 기준)
   * 판서 `at` 는 단계 시작(판서 0초) 기준 초 단위입니다.
   */
  function stepTimeline(step) {
    let end = 0;
    let prevEnd = 0;
    const panel = [];
    (step.panel || []).forEach((line, i) => {
      const dur = line.dur !== undefined ? line.dur : textDuration(plainOf(line.text));
      const at = line.at !== undefined ? line.at : i === 0 ? 0.3 : prevEnd + 0.25;
      prevEnd = at + dur;
      end = Math.max(end, prevEnd);
      panel.push({ at, dur });
    });
    const panelEnd = end;
    let boardEnd = 0;
    for (const el of (step.board && step.board.elements) || []) {
      boardEnd = Math.max(boardEnd, el.at + elementDuration(el));
    }
    end = Math.max(end, boardEnd);
    const lastBeat = (step.beats || []).reduce((m, b) => Math.max(m, b.at), 0);
    const animEnd = Math.max(end, lastBeat) + 0.4;
    const readChars = [step.summary].concat((step.beats || []).map((b) => b.text))
      .reduce((n, t) => n + plainOf(t).length, 0);
    const holdEnd = Math.max(animEnd + 3, readChars / READ_CHARS_PER_SEC);
    return { panel, boardEnd, panelEnd, animEnd, holdEnd };
  }

  return {
    version: 1,
    parseRich, richToPlain, richChars,
    MAX_EXPR_LENGTH, FUNCTION_NAMES, parseExpr, compileExpr, sampleCurve, sampleStats,
    PALETTE, TONES, DEFAULT_DUR, READ_CHARS_PER_SEC, NARRATION_CHARS_PER_SEC, NARRATION_FASTEST_CHARS_PER_SEC,
    estimateNarration, fastestNarration, textDuration, elementDuration, stepTimeline,
  };
});
