/* 타원곡선 칠판 강의 재생기 — 외부 의존성 없는 단일 파일 플레이어 (소리 없음).
 *
 * 빌드 계약: window.ECMath(ecmath.js)와 window.LESSON_DATA(elliptic-curve.scene.json)가 먼저 정의되어야 합니다.
 * 이 파일은 장면 JSON을 읽어 Canvas에 판서합니다. 좌표평면은 가로·세로 배율이 항상 같습니다(등축).
 * 화면의 모든 글은 텍스트 노드/Canvas fillText로만 그리며 HTML 문자열을 삽입하지 않습니다.
 *
 * 구성: 0 상수·도우미  1 장면 준비  2 글 배치  3 칠판 배치(좌표평면·격자·막대·흐름도)
 *       4 분필 도구  5 칠판 그리기  6 렌더·재생  7 화면 갱신  8 조작  9 공개 API
 */
(function () {
  'use strict';

  const DATA = window.LESSON_DATA;
  const EC = window.ECMath;
  const byId = (id) => document.getElementById(id);

  if (!DATA || !EC || !Array.isArray(DATA.steps) || DATA.steps.length === 0) {
    const fatal = byId('fatal');
    if (fatal) fatal.hidden = false;
    return;
  }

  /* ====================================================================
   * 0. 상수 · 도우미
   * ==================================================================== */
  const TAU = Math.PI * 2;
  const COLORS = { white: '#f3f0e4', mint: '#86efc6', yellow: '#ffe27d', pink: '#ff9fc4', sky: '#8fd3ff', orange: '#ffb067' };
  const COLOR_KO = { white: '흰색', mint: '민트색', yellow: '노란색', pink: '분홍색', sky: '하늘색', orange: '주황색' };
  const FONT_FAMILY = "ChalkKorean, 'Nanum Pen Script', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', 'Noto Sans CJK KR', sans-serif";
  const PANEL_SIZES = { xl: 52, l: 41, m: 34, s: 29 };
  const WIDE_MIN = 760; // 이 너비 이상이면 그림(왼쪽)과 글(오른쪽)을 나란히 둡니다.
  const SPEEDS = [0.75, 1, 1.25, 1.5];

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, s, e) => (e > s ? clamp((t - s) / (e - s), 0, 1) : t >= e ? 1 : 0);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const fontStr = (px) => px.toFixed(1) + 'px ' + FONT_FAMILY;
  const rectsOverlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  function formatClock(sec) {
    const s = Math.max(0, Math.round(sec));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  /** 서식 토큰이 풀린 글을 텍스트 노드(<sup>/<sub>/<strong>)로만 넣습니다. */
  function renderRich(el, text, resolved) {
    const runs = EC.parseRich(EC.substitute(text, resolved));
    const frag = document.createDocumentFragment();
    for (const r of runs) {
      let node = document.createTextNode(r.text);
      if (r.sup || r.sub) {
        const wrap = document.createElement(r.sup ? 'sup' : 'sub');
        wrap.appendChild(node);
        node = wrap;
      }
      if (r.strong) {
        const wrap = document.createElement('strong');
        wrap.appendChild(node);
        node = wrap;
      }
      frag.appendChild(node);
    }
    el.replaceChildren(frag);
  }
  const plainOf = (text, resolved) => EC.richToPlain(EC.parseRich(EC.substitute(text, resolved)));

  /* ====================================================================
   * 1. 장면 준비 (정확 연산 → 화면용 숫자)
   * ==================================================================== */
  const Z = { axes: 0, curve: 1, dots: 1, hline: 2, line: 2, tangent: 2, orbit: 3, link: 3, bar: 3, node: 3, point: 4 };

  function prepareStep(raw, i) {
    const resolved = raw.math ? EC.resolveMath(raw.math) : null;
    const sub = (t) => EC.substitute(t, resolved);
    const runsOf = (t) => EC.parseRich(sub(t));
    const tl = EC.stepTimeline(raw, sub);
    const S = { i, raw, id: raw.id, resolved, tl, kind: raw.board.kind, sub, runsOf };

    S.pts = Object.create(null);
    if (resolved) {
      const { curve, F } = resolved;
      for (const name of Object.keys(resolved.points)) {
        const P = resolved.points[name];
        S.pts[name] = P === null ? null : { x: F.num(P.x), y: F.num(P.y), text: EC.formatPoint(curve, P) };
      }
      if (curve.model === 'weierstrass') S.ab = [F.num(curve.a), F.num(curve.b)];
      S.p = F.kind === 'F' ? Number(F.p) : null;
    }

    S.panel = raw.panel.map((line, k) => ({
      runs: runsOf(line.text), color: line.color, size: line.size, at: tl.panel[k].at, dur: tl.panel[k].dur,
    }));

    S.els = raw.board.elements.map((el, k) => {
      const e = Object.assign({}, el);
      e.idx = k;
      e.dur = EC.elementDuration(el, sub);
      e.end = el.at + e.dur;
      e.hex = el.color ? COLORS[el.color] : COLORS.white;
      e.z = Z[el.type];
      if (el.type === 'point' && typeof el.label === 'string') e.runs = runsOf(el.label);
      if (el.type === 'point' && typeof el.short === 'string') e.shortRuns = runsOf(el.short);
      if (el.type === 'hline' && typeof el.label === 'string') e.runs = runsOf(el.label);
      if (el.type === 'curve' && el.label) e.runs = runsOf(el.label.text);
      if (el.type === 'bar') {
        e.runs = runsOf(el.label);
        e.valueRuns = runsOf(el.value);
        e.log2 = el.count !== undefined ? EC.log2Count(el.count) : el.pow2;
      }
      if (el.type === 'node') {
        e.titleRuns = runsOf(el.title);
        e.lineRuns = el.lines.map(runsOf);
        let at = 0.75; // 상자(0.75초) 다음에 제목과 줄을 차례로 씁니다
        e.parts = [e.titleRuns].concat(e.lineRuns).map((runs) => {
          const d = 0.7 * EC.textDuration(EC.richToPlain(runs));
          const part = { runs, start: at, dur: d };
          at += d;
          return part;
        });
      }
      if (el.type === 'dots' && resolved) {
        e.points = resolved.curve.enumerate().map((P) => ({ x: Number(P.x), y: Number(P.y) }));
      }
      if (el.type === 'orbit' && resolved) {
        const G = resolved.points[el.of];
        e.multiples = EC.orbitOf(resolved.curve, G, 2000).multiples.filter((P) => P !== null).map((P) => ({ x: Number(P.x), y: Number(P.y) }));
      }
      return e;
    });
    S.order = S.els.slice().sort((a, b) => a.z - b.z || a.idx - b.idx);
    S.titleText = plainOf(raw.title, resolved);
    S.altText = plainOf(raw.alt, resolved);
    return S;
  }

  /* ====================================================================
   * 2. 캔버스 · 글 배치
   * ==================================================================== */
  const canvas = byId('board');
  const ctx = canvas.getContext('2d');
  let steps = [];
  try {
    steps = DATA.steps.map(prepareStep);
  } catch (e) {
    const fatal = byId('fatal');
    if (fatal) { fatal.hidden = false; fatal.textContent = '강의 데이터를 해석하지 못했습니다: ' + e.message; }
    return;
  }
  const N = steps.length;

  /**
   * 서식 있는 글을 줄바꿈해 배치합니다. 위·아래 첨자는 직전 글자에 붙어 다닙니다.
   * 반환: { lines:[{segs:[{text,x,dy,size,w,space,n,prefix}], w}], w, h, lineH, size, n, overflow }
   */
  function layoutRich(runs, size, maxW) {
    const atoms = [];
    for (const r of runs) {
      for (const part of r.text.split(/(\s+)/)) {
        if (part) atoms.push({ text: part, sup: r.sup, sub: r.sub, space: /^\s+$/.test(part) });
      }
    }
    for (const a of atoms) {
      a.size = a.sup || a.sub ? size * 0.64 : size;
      ctx.font = fontStr(a.size);
      a.w = ctx.measureText(a.text).width;
      a.dy = a.sup ? -size * 0.4 : a.sub ? size * 0.2 : 0;
    }
    const lines = [];
    let line = { segs: [], w: 0 };
    const push = (a) => {
      line.segs.push({ text: a.text, x: line.w, dy: a.dy, size: a.size, w: a.w, space: a.space, n: a.text.length, prefix: null });
      line.w += a.w;
    };
    let i = 0;
    while (i < atoms.length) {
      const a = atoms[i];
      let j = i;
      let ww = 0;
      while (j < atoms.length && atoms[j].space === a.space) { ww += atoms[j].w; j++; }
      if (a.space) {
        if (line.segs.length) {
          let k = j;
          let nextW = 0;
          while (k < atoms.length && !atoms[k].space) { nextW += atoms[k].w; k++; }
          if (line.w + ww + nextW > maxW) { lines.push(line); line = { segs: [], w: 0 }; } else for (let q = i; q < j; q++) push(atoms[q]);
        }
      } else {
        for (let q = i; q < j; q++) push(atoms[q]);
      }
      i = j;
    }
    if (line.segs.length) lines.push(line);
    if (!lines.length) lines.push(line);
    let n = 0;
    let w = 0;
    for (const l of lines) { w = Math.max(w, l.w); for (const s of l.segs) n += s.n; }
    return { lines, w, h: lines.length * size * 1.22, lineH: size * 1.22, size, n, overflow: w > maxW + 1 };
  }

  function segPrefix(sg) {
    if (!sg.prefix) {
      ctx.font = fontStr(sg.size);
      sg.prefix = [0];
      for (let k = 1; k <= sg.n; k++) sg.prefix.push(ctx.measureText(sg.text.slice(0, k)).width);
    }
    return sg.prefix;
  }

  /** 글을 p(0~1)만큼 써 줍니다. (x, y)는 글 덩어리의 왼쪽 위. 분필 끝 위치를 돌려줍니다. */
  function drawRich(L, x, y, p, color, opts) {
    if (p <= 0) return null;
    const o = opts || {};
    const f = p >= 1 ? Infinity : p * L.n;
    const ox = o.align === 'right' ? -L.w : o.align === 'center' ? -L.w / 2 : 0;
    let acc = 0;
    let tip = null;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    outer:
    for (let li = 0; li < L.lines.length; li++) {
      const by = y + li * L.lineH + L.size * 0.92;
      for (const sg of L.lines[li].segs) {
        if (acc >= f) break outer;
        const sx = x + ox + sg.x;
        const sy = by + sg.dy;
        let width = sg.w;
        const partial = acc + sg.n > f;
        if (partial) {
          const pre = segPrefix(sg);
          const kf = f - acc;
          const k = Math.min(sg.n - 1, Math.floor(kf));
          width = pre[k] + (pre[k + 1] - pre[k]) * (kf - k);
        }
        if (!sg.space) {
          ctx.save();
          ctx.font = fontStr(sg.size);
          if (partial) { ctx.beginPath(); ctx.rect(sx - 6, sy - sg.size * 1.2, width + 6, sg.size * 1.8); ctx.clip(); }
          if (o.knock) {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineWidth = 6;
            ctx.lineJoin = 'round';
            ctx.strokeStyle = '#000';
            ctx.strokeText(sg.text, sx, sy);
            ctx.globalCompositeOperation = 'source-over';
          }
          chalkGlyphs(sg.text, sx, sy, color, sg.size);
          ctx.restore();
        }
        tip = { x: sx + width, y: by - L.size * 0.3 };
        acc += sg.n;
        if (partial) break outer;
      }
    }
    ctx.restore();
    return tip;
  }

  /* ====================================================================
   * 3. 칠판 배치
   * ==================================================================== */
  let frame = null; // { W, H, wide, pad, board:{x,y,w,h}, panel:{x,y,w,h}, geoms:[...] }
  let dpr = 1;
  let warnings = [];

  function layoutPanel(S, W) {
    const scale = clamp(W / 560, 0.8, 1.1);
    let y = 0;
    const items = [];
    S.panel.forEach((line, i) => {
      const size = PANEL_SIZES[line.size] * scale;
      const L = layoutRich(line.runs, size, W);
      if (i) y += size * 0.32;
      items.push({ L, y, line });
      y += L.h;
    });
    return { items, h: y, scale };
  }

  /** 흐름도: 뱀 모양(지그재그)으로 상자를 배치합니다. 폭이 좁으면 열 수를 줄입니다. */
  function layoutFlow(S, rect) {
    const nodes = S.els.filter((e) => e.type === 'node');
    const narrow = rect.w < 420;
    const gapX = 38;
    const gapY = narrow ? 30 : 44;
    const minBoxW = narrow ? 300 : 170; // 좁은 화면에서는 한 줄에 상자 하나
    const cols = clamp(Math.floor((rect.w + gapX) / (minBoxW + gapX)), 1, S.raw.board.cols);
    const boxW = (rect.w - (cols - 1) * gapX) / cols;
    const tsize = narrow ? 27 : clamp(boxW / 7.6, 26, 36);
    const pad = narrow ? 11 : 14;
    const boxes = nodes.map((e) => {
      const title = layoutRich(e.titleRuns, tsize, boxW - 2 * pad);
      const lines = e.lineRuns.map((r) => layoutRich(r, tsize * 0.88, boxW - 2 * pad));
      const h = pad + title.h + 6 + lines.reduce((n, l) => n + l.h, 0) + pad - 2;
      return { e, title, lines, h, pad };
    });
    const rows = Math.ceil(boxes.length / cols);
    const rowH = [];
    for (let r = 0; r < rows; r++) rowH.push(Math.max(...boxes.slice(r * cols, r * cols + cols).map((b) => b.h)));
    const sumH = rowH.reduce((n, h) => n + h, 0);
    const need = sumH + (rows - 1) * gapY + 12; // 최소 높이는 기본 간격 기준
    // 칠판이 넉넉하면(넓은 화면) 줄 사이를 조금 벌려 아래쪽이 휑해 보이지 않게 합니다.
    const gapFit = rows > 1 && !narrow ? clamp((rect.h - 24 - sumH) / (rows - 1), gapY, 78) : gapY;
    const total = sumH + (rows - 1) * gapFit;
    const offY = Math.max(6, (rect.h - total) / 2);
    boxes.forEach((b, k) => {
      const r = Math.floor(k / cols);
      let c = k % cols;
      if (r % 2 === 1) c = cols - 1 - c;
      b.x = rect.x + c * (boxW + gapX);
      b.y = rect.y + offY + rowH.slice(0, r).reduce((n, h) => n + h, 0) + r * gapFit;
      b.w = boxW;
      b.h = rowH[r];
    });
    return { boxes, cols, rows, need };
  }

  /** 막대그래프: 글줄 + 막대 + (필요하면 값 줄) 을 위에서부터 쌓고 아래에 로그 눈금축을 둡니다. */
  function layoutBars(S, rect) {
    const bars = S.els.filter((e) => e.type === 'bar');
    const board = S.raw.board;
    const fs = clamp(rect.w / 17, 22, 31);
    const barH = 26;
    const rows = bars.map((e) => {
      const label = layoutRich(e.runs, fs, rect.w);
      const value = layoutRich(e.valueRuns, fs, rect.w);
      const sameRow = label.w + 18 + value.w <= rect.w;
      const h = label.h + 4 + barH + (sameRow ? 0 : value.h + 2);
      return { e, label, value, sameRow, h };
    });
    const ticks = board.axisTicks.map((t) => layoutRich(t === 0 ? [{ text: '1', sup: false, sub: false }] : [{ text: '2', sup: false, sub: false }, { text: String(t), sup: true, sub: false }], fs * 0.8, 200));
    const axisLabel = board.axisLabel ? layoutRich(EC.parseRich(board.axisLabel), fs * 0.9, rect.w) : null;
    const axisH = 14 + ticks[0].h + (axisLabel ? axisLabel.h + 4 : 0);
    const content = rows.reduce((n, r) => n + r.h, 0);
    const need = content + rows.length * 22 + axisH + 14;
    const gap = Math.max(14, (rect.h - content - axisH - 14) / rows.length);
    let y = rect.y + 10;
    for (const r of rows) { r.y = y; y += r.h + gap; }
    return { rows, ticks, axisLabel, axisH, need, fs, barH, axisY: rect.y + rect.h - axisH - 2 };
  }

  function planeGeom(S, rect) {
    const v = S.raw.board.view;
    const s = Math.min(rect.w / (v.x[1] - v.x[0]), rect.h / (v.y[1] - v.y[0]));
    const cx = (v.x[0] + v.x[1]) / 2;
    const cy = (v.y[0] + v.y[1]) / 2;
    const G = {
      kind: 'plane', rect, s,
      X: (x) => rect.x + rect.w / 2 + (x - cx) * s,
      Y: (y) => rect.y + rect.h / 2 - (y - cy) * s,
    };
    G.xmin = cx - rect.w / 2 / s; G.xmax = cx + rect.w / 2 / s;
    G.ymin = cy - rect.h / 2 / s; G.ymax = cy + rect.h / 2 / s;
    G.xPxPerUnit = s; G.yPxPerUnit = s;
    return G;
  }

  function finiteGeom(S, rect) {
    const p = S.p;
    const left = rect.x + (rect.w < 420 ? 24 : 32);
    const bottom = rect.y + rect.h - (rect.w < 420 ? 22 : 28);
    const top = rect.y + (rect.w < 420 ? 20 : 24);
    const right = rect.x + rect.w - 8;
    const cell = Math.min((right - left) / p, (bottom - top) / p);
    const gx0 = left + ((right - left) - cell * p) / 2;
    const gy1 = bottom - ((bottom - top) - cell * p) / 2 + 0;
    const G = { kind: 'finite', rect, p, cell, gx0, gy1, X: (v) => gx0 + (v + 0.5) * cell, Y: (v) => gy1 - (v + 0.5) * cell };
    G.xPxPerUnit = cell; G.yPxPerUnit = cell;
    return G;
  }

  /* ---- 곡선 표본 (실수 평면): y^2 = x^3 + a x + b ---- */
  function curvePaths(a, b, xmin, xmax, ylim) {
    const f = (x) => x * x * x + a * x + b;
    const bisect = (lo, hi, g) => {
      let flo = g(lo);
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2;
        const fm = g(mid);
        if ((fm < 0) === (flo < 0)) { lo = mid; flo = fm; } else hi = mid;
      }
      return (lo + hi) / 2;
    };
    const roots = [];
    const n = 2400;
    let px = xmin;
    let pf = f(px);
    for (let i = 1; i <= n; i++) {
      const x = xmin + ((xmax - xmin) * i) / n;
      const fx = f(x);
      if (pf * fx < 0) roots.push(bisect(px, x, f));
      px = x; pf = fx;
    }
    const bounds = [xmin].concat(roots, [xmax]);
    const paths = [];
    for (let k = 0; k < bounds.length - 1; k++) {
      const lo = bounds[k];
      const hi = bounds[k + 1];
      if (f((lo + hi) / 2) <= 0) continue;
      const loRoot = k > 0;
      const hiRoot = k < bounds.length - 2;
      const M = 220;
      if (loRoot && hiRoot) { // 닫힌 고리(타원체)
        const up = [];
        const dn = [];
        for (let j = 0; j <= M; j++) {
          const x = lo + ((hi - lo) * (1 - Math.cos(Math.PI * j / M))) / 2;
          const y = Math.sqrt(Math.max(0, f(x)));
          up.push([x, y]); dn.push([x, -y]);
        }
        paths.push(up.concat(dn.reverse()));
      } else if (loRoot) { // 오른쪽으로 끝없이 뻗는 가지: 화면 위·아래 끝에서 잘라 냅니다
        let end = hi;
        if (f(hi) > ylim * ylim) end = bisect(lo, hi, (x) => f(x) - ylim * ylim);
        const up = [];
        const dn = [];
        for (let j = 0; j <= M; j++) {
          const sfr = j / M;
          const x = lo + (end - lo) * sfr * sfr;
          const y = Math.sqrt(Math.max(0, f(x)));
          up.push([x, y]); dn.push([x, -y]);
        }
        paths.push(dn.reverse().concat(up));
      }
    }
    return paths;
  }

  function polyline(points, G) {
    const px = points.map(([x, y]) => [G.X(x), G.Y(y)]);
    const cum = [0];
    for (let i = 1; i < px.length; i++) cum.push(cum[i - 1] + Math.hypot(px[i][0] - px[i - 1][0], px[i][1] - px[i - 1][1]));
    return { px, cum, len: cum[cum.length - 1] };
  }

  /** 직선 (x0,y0)-(x1,y1)을 사각형 안으로 자릅니다 (Liang–Barsky). */
  function clipSeg(r, x0, y0, x1, y1) {
    let t0 = 0;
    let t1 = 1;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const tests = [[-dx, x0 - r.x], [dx, r.x + r.w - x0], [-dy, y0 - r.y], [dy, r.y + r.h - y0]];
    for (const [pp, q] of tests) {
      if (pp === 0) { if (q < 0) return null; } else {
        const t = q / pp;
        if (pp < 0) { if (t > t1) return null; t0 = Math.max(t0, t); } else { if (t < t0) return null; t1 = Math.min(t1, t); }
      }
    }
    return [x0 + t0 * dx, y0 + t0 * dy, x0 + t1 * dx, y0 + t1 * dy];
  }

  function planeLine(S, G, P, R) {
    const { curve, F } = S.resolved;
    const A = S.resolved.points[P];
    const B = R === undefined ? A : S.resolved.points[R];
    const ln = R === undefined ? curve.tangentLine(A) : curve.lineThrough(A, B);
    let a;
    let b;
    if (ln.vertical) {
      const x = F.num(ln.x);
      a = [G.X(x), G.rect.y - 10]; b = [G.X(x), G.rect.y + G.rect.h + 10];
    } else {
      const m = F.num(ln.m);
      const c = F.num(ln.c);
      a = [G.X(G.xmin - 1), G.Y(m * (G.xmin - 1) + c)];
      b = [G.X(G.xmax + 1), G.Y(m * (G.xmax + 1) + c)];
    }
    return clipSeg(G.rect, a[0], a[1], b[0], b[1]);
  }

  /* ---- 라벨 자리 찾기 ---- */
  const DIR_VEC = { ul: [-1, -1], ur: [1, -1], dl: [-1, 1], dr: [1, 1], u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
  const DIR_ORDER = ['ur', 'ul', 'dr', 'dl', 'r', 'l', 'u', 'd'];

  function candidateRect(dir, px, py, w, h, off) {
    const [vx, vy] = DIR_VEC[dir];
    const x = vx < 0 ? px - off - w : vx > 0 ? px + off : px - w / 2;
    const y = vy < 0 ? py - off - h : vy > 0 ? py + off : py - h / 2;
    return { x, y, w, h };
  }

  function placeLabels(S, G, inner, obstacles, items, warn) {
    const placed = [];
    const out = new Map();
    const search = (it, L) => {
      const w = L.w + 6;
      const h = L.h * 0.95;
      const prefer = [it.dir || 'ur'].concat(DIR_ORDER.filter((d) => d !== (it.dir || 'ur')));
      let best = null;
      for (const ring of [0, 1]) {
        const off = it.r + 6 + ring * 18;
        prefer.forEach((dir, rank) => {
          const r = candidateRect(dir, it.x, it.y, w, h, off);
          let pen = rank * 0.5 + ring * 20;
          if (r.x < inner.x || r.y < inner.y || r.x + r.w > inner.x + inner.w || r.y + r.h > inner.y + inner.h) pen += 1e5;
          for (const q of placed) if (rectsOverlap(r, q)) pen += 1e4;
          for (const o of obstacles.rects) if (rectsOverlap(r, o)) pen += o.wt;
          for (const pt of obstacles.pts) if (pt.x > r.x - 2 && pt.x < r.x + r.w + 2 && pt.y > r.y - 2 && pt.y < r.y + r.h + 2) pen += pt.wt;
          if (!best || pen < best.pen) best = { pen, r, dir, L };
        });
        if (best && best.pen < 20) break;
      }
      return best;
    };
    for (const it of items) {
      let best = search(it, it.L);
      // 좌표가 긴 라벨이 다른 글과 겹치면 짧은 이름("3P")으로 바꿔 봅니다.
      if (best.pen >= 1e4 && it.Ls) {
        const alt = search(it, it.Ls);
        if (alt.pen < best.pen) best = alt;
      }
      placed.push(best.r);
      out.set(it.key, { x: best.r.x + 3, y: best.r.y, rect: best.r, dir: best.dir, L: best.L });
      if (best.pen >= 1e4) warn('label-overlap', it.text + ' (' + Math.round(best.pen) + ')');
    }
    return { out, placed };
  }

  function sampleSegment(pts, x0, y0, x1, y1, wt, step) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let i = 0; i <= n; i++) pts.push({ x: lerp(x0, x1, i / n), y: lerp(y0, y1, i / n), wt });
  }

  function buildPlaneStep(S, rect, dense) {
    const G = planeGeom(S, rect);
    const { curve } = S.resolved;
    const curveEl = S.els.find((e) => e.type === 'curve');
    G.paths = [];
    if (curveEl) {
      for (const pts of curvePaths(S.ab[0], S.ab[1], G.xmin - 0.2, G.xmax + 0.2, Math.max(Math.abs(G.ymin), Math.abs(G.ymax)) + 0.4)) G.paths.push(polyline(pts, G));
    }
    G.lines = new Map();
    for (const e of S.els) {
      if (e.type === 'line') G.lines.set(e.idx, planeLine(S, G, e.through[0], e.through[1]));
      if (e.type === 'tangent') G.lines.set(e.idx, planeLine(S, G, e.point));
    }
    const inner = { x: rect.x + 4, y: rect.y + 4, w: rect.w - 8, h: rect.h - 8 };
    G.inner = inner;
    G.markers = new Map();
    const obstacles = { rects: [], pts: [] };
    const warnLocal = [];
    const warn = (kind, detail) => warnLocal.push({ step: S.id, kind, detail });
    // 점 표식 (화면 밖이면 가장자리 화살표)
    const edge = rect.w < 420 ? 12 : 16;
    const box = { x: rect.x + edge, y: rect.y + edge, w: rect.w - 2 * edge, h: rect.h - 2 * edge };
    for (const e of S.els) {
      if (e.type !== 'point') continue;
      const P = S.pts[e.ref];
      if (!P) continue;
      let x = G.X(P.x);
      let y = G.Y(P.y);
      let inside = x >= rect.x + 6 && x <= rect.x + rect.w - 6 && y >= rect.y + 6 && y <= rect.y + rect.h - 6;
      let ang = 0;
      if (!inside) {
        const cx = rect.x + rect.w / 2;
        const cy = rect.y + rect.h / 2;
        const dx = x - cx;
        const dy = y - cy;
        const t = Math.min(dx === 0 ? Infinity : (box.w / 2) / Math.abs(dx), dy === 0 ? Infinity : (box.h / 2) / Math.abs(dy));
        x = cx + dx * t; y = cy + dy * t; ang = Math.atan2(dy, dx);
      }
      const r = e.small ? 4.2 : rect.w < 420 ? 5.2 : 6.4;
      G.markers.set(e.idx, { x, y, r, inside, ang });
      obstacles.rects.push({ x: x - r - 3, y: y - r - 3, w: 2 * r + 6, h: 2 * r + 6, wt: 2000 });
    }
    // 곡선·직선 표본
    for (const path of G.paths) {
      for (let i = 0; i < path.px.length; i += 1) {
        if (i % 3 === 0) obstacles.pts.push({ x: path.px[i][0], y: path.px[i][1], wt: 7 });
      }
    }
    for (const e of S.els) {
      if (e.type === 'line' || e.type === 'tangent') {
        const c = G.lines.get(e.idx);
        if (c) sampleSegment(obstacles.pts, c[0], c[1], c[2], c[3], 6, 7);
      }
      if (e.type === 'link') {
        const A = S.pts[e.from];
        const B = S.pts[e.to];
        if (A && B) sampleSegment(obstacles.pts, G.X(A.x), G.Y(A.y), G.X(B.x), G.Y(B.y), 5, 7);
      }
    }
    // 눈금·좌표축
    const ox = G.X(0);
    const oy = G.Y(0);
    obstacles.rects.push({ x: rect.x, y: oy - 3, w: rect.w, h: 6, wt: 5 }, { x: ox - 3, y: rect.y, w: 6, h: rect.h, wt: 5 });
    obstacles.rects.push({ x: rect.x, y: oy + 3, w: rect.w, h: 20, wt: 3 }, { x: ox - 32, y: rect.y, w: 28, h: rect.h, wt: 3 });
    // 라벨: 곡선 이름(자리가 정해짐) → 점 라벨(나타나는 순서)
    const fs = rect.w < 420 ? 21 : 25;
    G.labelFs = fs;
    const fixed = [];
    if (curveEl && curveEl.runs) {
      const L = layoutRich(curveEl.runs, fs, rect.w);
      const lx = G.X(curveEl.label.x);
      const ly = G.Y(curveEl.label.y);
      G.curveLabel = { L, x: lx, y: ly - L.h * 0.8 };
      const cr = { x: lx - 2, y: ly - L.h * 0.8, w: L.w + 6, h: L.h, wt: 3000 };
      obstacles.rects.push(cr);
      if (lx < rect.x + 2 || lx + L.w > rect.x + rect.w - 2) warn('curve-label-out', curveEl.label.text);
      fixed.push(cr);
    }
    const items = [];
    for (const e of S.els.slice().sort((p, q) => p.at - q.at)) {
      if (e.type !== 'point' || !e.runs) continue;
      const m = G.markers.get(e.idx);
      if (!m) continue;
      items.push({ key: e.idx, L: layoutRich(e.runs, fs, rect.w), Ls: e.shortRuns ? layoutRich(e.shortRuns, fs, rect.w) : null, x: m.x, y: m.y, r: m.r, dir: e.dir, text: e.label });
    }
    const { out } = placeLabels(S, G, inner, obstacles, items, warn);
    G.labels = out;
    G.warn = warnLocal;
    G.curve = curve;
    return G;
  }

  function buildFiniteStep(S, rect) {
    const G = finiteGeom(S, rect);
    const warnLocal = [];
    const warn = (kind, detail) => warnLocal.push({ step: S.id, kind, detail });
    G.inner = { x: rect.x + 2, y: rect.y + 2, w: rect.w - 4, h: rect.h - 4 };
    G.markers = new Map();
    const obstacles = { rects: [], pts: [] };
    for (const e of S.els) {
      if (e.type === 'dots') for (const P of e.points) obstacles.rects.push({ x: G.X(P.x) - G.cell * 0.3, y: G.Y(P.y) - G.cell * 0.3, w: G.cell * 0.6, h: G.cell * 0.6, wt: 4 });
      if (e.type === 'orbit') {
        e.multiples.forEach((P, k) => {
          obstacles.rects.push({ x: G.X(P.x) - G.cell * 0.3, y: G.Y(P.y) - G.cell * 0.3, w: G.cell * 0.6 + 14, h: G.cell * 0.6, wt: 3 });
          if (k > 0) sampleSegment(obstacles.pts, G.X(e.multiples[k - 1].x), G.Y(e.multiples[k - 1].y), G.X(P.x), G.Y(P.y), 1.5, 10);
        });
      }
      if (e.type === 'hline') sampleSegment(obstacles.pts, G.gx0, G.Y(e.y), G.gx0 + G.cell * G.p, G.Y(e.y), 3, 8);
    }
    const fs = rect.w < 420 ? 20 : 24;
    G.labelFs = fs;
    const items = [];
    for (const e of S.els) {
      if (e.type !== 'point') continue;
      const P = S.pts[e.ref];
      if (!P) continue;
      const r = G.cell * 0.34;
      const m = { x: G.X(P.x), y: G.Y(P.y), r: r + 2, inside: true, ang: 0 };
      G.markers.set(e.idx, m);
      obstacles.rects.push({ x: m.x - m.r, y: m.y - m.r, w: 2 * m.r, h: 2 * m.r, wt: 2000 });
    }
    let hl = null;
    for (const e of S.els) {
      if (e.type === 'hline' && e.runs) {
        const L = layoutRich(e.runs, fs, rect.w);
        hl = { L, x: G.gx0 + G.cell * G.p - L.w - 4, y: G.Y(e.y) + 5 };
        G.hlineLabel = hl;
      }
    }
    for (const e of S.els.slice().sort((p, q) => p.at - q.at)) {
      if (e.type !== 'point' || !e.runs) continue;
      const m = G.markers.get(e.idx);
      items.push({ key: e.idx, L: layoutRich(e.runs, fs, rect.w), Ls: e.shortRuns ? layoutRich(e.shortRuns, fs, rect.w) : null, x: m.x, y: m.y, r: m.r, dir: e.dir, text: e.label });
    }
    if (hl) obstacles.rects.push({ x: hl.x, y: hl.y, w: hl.L.w + 4, h: hl.L.h, wt: 3000 });
    const { out } = placeLabels(S, G, G.inner, obstacles, items, warn);
    G.labels = out;
    G.warn = warnLocal;
    return G;
  }

  function computeFrame(W) {
    const wide = W >= WIDE_MIN;
    const pad = wide ? 22 : 12;
    let side;
    let panelW;
    let panelX;
    if (wide) {
      side = clamp(Math.round(W * 0.5), 340, 520);
      panelX = pad * 2 + side;
      panelW = W - panelX - pad;
    } else {
      side = W - 2 * pad;
      panelW = side;
      panelX = pad;
    }
    const gap = 16;
    const panels = steps.map((S) => layoutPanel(S, panelW));
    // 단계마다 칠판 높이: 좌표평면·격자는 정사각형, 막대·흐름도는 내용이 필요한 만큼
    const probe = { x: pad, y: pad, w: side, h: side };
    const boardH = steps.map((S) => {
      const floor = side * (wide ? 0.8 : 0.6);
      if (S.kind === 'flow') return Math.max(floor, layoutFlow(S, probe).need);
      if (S.kind === 'bars') return Math.max(floor, layoutBars(S, probe).need);
      return side;
    });
    const maxBoard = Math.max(...boardH);
    const maxPanel = Math.max(...panels.map((p) => p.h));
    const H = wide ? Math.max(maxBoard, maxPanel) + 2 * pad : Math.max(...steps.map((_, i) => pad + boardH[i] + gap + panels[i].h)) + pad;
    const warn = [];
    const geoms = steps.map((S, i) => {
      const G = { panel: panels[i] };
      const rect = { x: pad, y: pad, w: side, h: boardH[i] };
      G.panelRect = wide ? { x: panelX, y: pad, w: panelW, h: H - 2 * pad } : { x: panelX, y: pad + boardH[i] + gap, w: panelW, h: panels[i].h };
      if (S.kind === 'plane') Object.assign(G, buildPlaneStep(S, rect));
      else if (S.kind === 'finite') Object.assign(G, buildFiniteStep(S, rect));
      else if (S.kind === 'bars') Object.assign(G, { kind: 'bars', rect, bars: layoutBars(S, rect), warn: [] });
      else if (S.kind === 'flow') Object.assign(G, { kind: 'flow', rect, flow: layoutFlow(S, rect), warn: [] });
      else Object.assign(G, { kind: 'chalk', rect, warn: [] });
      for (const it of panels[i].items) if (it.L.overflow) G.warn.push({ step: S.id, kind: 'panel-overflow', detail: it.line.runs.map((r) => r.text).join('') });
      warn.push(...G.warn);
      return G;
    });
    const stepH = steps.map((_, i) => (wide ? Math.max(boardH[i], panels[i].h) + 2 * pad : pad + boardH[i] + gap + panels[i].h + pad));
    return { W, H, wide, pad, geoms, warnings: warn, stepH };
  }

  /* ====================================================================
   * 4. 분필 도구
   * ==================================================================== */
  const grainTiles = new WeakMap();
  function applyGrain(W, H) {
    let pat = grainTiles.get(ctx);
    if (!pat) {
      const tile = document.createElement('canvas');
      tile.width = tile.height = 128;
      const tctx = tile.getContext('2d');
      const img = tctx.createImageData(128, 128);
      for (let i = 0; i < img.data.length; i += 4) img.data[i + 3] = Math.random() < 0.34 ? 110 + Math.random() * 145 : 0;
      tctx.putImageData(img, 0, 0);
      pat = ctx.createPattern(tile, 'repeat');
      grainTiles.set(ctx, pat);
    }
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function chalkLine(x0, y0, x1, y1, color, w, dash, alpha) {
    const A = alpha === undefined ? 1 : alpha;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    if (dash) ctx.setLineDash(dash);
    const path = () => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
    ctx.globalAlpha = 0.16 * A; ctx.lineWidth = w * 2.6; path();
    ctx.globalAlpha = 0.92 * A; ctx.lineWidth = w; path();
    ctx.globalAlpha = 0.4 * A; ctx.lineWidth = Math.max(1, w * 0.45); ctx.translate(0.7, -0.6); path();
    ctx.restore();
  }

  function arrowHead(x, y, ang, size, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.moveTo(-size, -size * 0.55);
    ctx.lineTo(0, 0);
    ctx.lineTo(-size, size * 0.55);
    ctx.stroke();
    ctx.restore();
  }

  function chalkGlyphs(text, x, y, color, size) {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 3;
    ctx.globalAlpha = 0.92;
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(0.6, size * 0.025);
    ctx.globalAlpha = 0.5;
    ctx.strokeText(text, x, y);
    ctx.globalAlpha = 0.3;
    ctx.fillText(text, x + 0.7, y + 0.6);
  }

  function strokePolyline(pl, limit, color, w, dash) {
    let tip = pl.px[0];
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    if (dash) ctx.setLineDash(dash);
    const build = () => {
      ctx.beginPath();
      ctx.moveTo(pl.px[0][0], pl.px[0][1]);
      let i = 1;
      for (; i < pl.px.length && pl.cum[i] <= limit; i++) { ctx.lineTo(pl.px[i][0], pl.px[i][1]); tip = pl.px[i]; }
      if (i < pl.px.length && limit > pl.cum[i - 1]) {
        const f = (limit - pl.cum[i - 1]) / (pl.cum[i] - pl.cum[i - 1]);
        tip = [lerp(pl.px[i - 1][0], pl.px[i][0], f), lerp(pl.px[i - 1][1], pl.px[i][1], f)];
        ctx.lineTo(tip[0], tip[1]);
      }
      ctx.stroke();
    };
    ctx.globalAlpha = 0.16; ctx.lineWidth = w * 2.6; build();
    ctx.globalAlpha = 0.92; ctx.lineWidth = w; build();
    ctx.globalAlpha = 0.4; ctx.lineWidth = Math.max(1, w * 0.45); ctx.translate(0.7, -0.6); build();
    ctx.restore();
    return { x: tip[0], y: tip[1] };
  }

  function roundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function dot(x, y, r, color, alpha) {
    ctx.save();
    ctx.globalAlpha = (alpha === undefined ? 1 : alpha) * 0.95;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = (alpha === undefined ? 1 : alpha) * 0.55;
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = '#fffdf2';
    ctx.stroke();
    ctx.restore();
  }

  function ring(x, y, r, color, alpha, w) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = w || 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  /** 선생님이 쥔 분필 (끝이 (x, y)에 닿고 몸통은 오른쪽 위로) */
  function drawChalkPiece(x, y, active, k) {
    const len = 42 * k;
    const wd = 10 * k;
    ctx.save();
    ctx.translate(x, y);
    if (active) ctx.translate((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 0.8);
    ctx.rotate(-Math.PI * 0.3);
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    const grad = ctx.createLinearGradient(0, -wd / 2, 0, wd / 2);
    grad.addColorStop(0, '#fffdf2');
    grad.addColorStop(1, '#cfc8ae');
    ctx.fillStyle = grad;
    roundedRect(0, -wd / 2, len, wd, wd * 0.38);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = 'rgba(224,196,102,0.92)';
    ctx.fillRect(len * 0.5, -wd / 2, len * 0.26, wd);
    ctx.restore();
    if (active) {
      ctx.save();
      ctx.fillStyle = '#fffdf2';
      for (let i = 0; i < 4; i++) {
        ctx.globalAlpha = 0.25 + Math.random() * 0.4;
        ctx.beginPath();
        ctx.arc(x + (Math.random() - 0.5) * 12, y + 2 + Math.random() * 14, 0.6 + Math.random() * 1.3, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /* ====================================================================
   * 5. 칠판 그리기
   * ==================================================================== */
  function noteTip(tips, start, tip) {
    if (tip) tips.push({ start, x: tip.x, y: tip.y });
  }

  /* ---- 좌표평면 ---- */
  function drawPlaneAxes(G, p, narrow) {
    const { rect, X, Y } = G;
    const ox = X(0);
    const oy = Y(0);
    const fs = narrow ? 16 : 19;
    ctx.save();
    ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
    // 눈금선
    ctx.strokeStyle = '#f3f0e4';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.1 * seg(p, 0.1, 0.7);
    ctx.beginPath();
    for (let x = Math.ceil(G.xmin); x <= G.xmax; x++) { ctx.moveTo(X(x), rect.y); ctx.lineTo(X(x), rect.y + rect.h); }
    for (let y = Math.ceil(G.ymin); y <= G.ymax; y++) { ctx.moveTo(rect.x, Y(y)); ctx.lineTo(rect.x + rect.w, Y(y)); }
    ctx.stroke();
    ctx.globalAlpha = 1;
    const white = COLORS.white;
    const px = seg(p, 0, 0.6);
    const py = seg(p, 0.25, 0.85);
    const xa = rect.x + 4;
    const xb = rect.x + rect.w - 6;
    const ya = rect.y + rect.h - 4;
    const yb = rect.y + 6;
    if (px > 0) chalkLine(xa, oy, lerp(xa, xb, easeOut(px)), oy, white, 2.2);
    if (py > 0) chalkLine(ox, ya, ox, lerp(ya, yb, easeOut(py)), white, 2.2);
    if (px >= 1) arrowHead(xb, oy, 0, 10, white);
    if (py >= 1) arrowHead(ox, yb, -Math.PI / 2, 10, white);
    // 눈금 숫자
    const ta = seg(p, 0.6, 1);
    if (ta > 0) {
      const every = G.s < 26 ? 2 : 1;
      ctx.globalAlpha = ta;
      ctx.font = fontStr(fs);
      ctx.fillStyle = white;
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = white;
      ctx.beginPath();
      for (let x = Math.ceil(G.xmin); x <= G.xmax - 0.6; x++) if (x !== 0 && x % every === 0) { ctx.moveTo(X(x), oy - 4); ctx.lineTo(X(x), oy + 4); }
      for (let y = Math.ceil(G.ymin); y <= G.ymax - 0.6; y++) if (y !== 0 && y % every === 0) { ctx.moveTo(ox - 4, Y(y)); ctx.lineTo(ox + 4, Y(y)); }
      ctx.stroke();
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'center';
      for (let x = Math.ceil(G.xmin); x <= G.xmax - 0.6; x++) if (x !== 0 && x % every === 0) ctx.fillText(String(x), X(x), oy + fs + 8);
      ctx.textAlign = 'right';
      for (let y = Math.ceil(G.ymin); y <= G.ymax - 0.6; y++) if (y !== 0 && y % every === 0) ctx.fillText(String(y), ox - 9, Y(y) + fs * 0.32);
      ctx.fillText('0', ox - 9, oy + fs + 4);
      ctx.textAlign = 'left';
      ctx.fillText('x', xb - 2, oy - 12);
      ctx.fillText('y', ox + 12, yb + fs);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    return px < 1 ? { x: lerp(xa, xb, easeOut(px)), y: oy } : py < 1 ? { x: ox, y: lerp(ya, yb, easeOut(py)) } : null;
  }

  function drawPlane(S, G, t, tips, reduced) {
    const { rect, X, Y } = G;
    const narrow = rect.w < 420;
    ctx.save();
    // 창 가장자리 (등축 확인용 희미한 테두리)
    ctx.strokeStyle = 'rgba(243,240,228,0.2)';
    ctx.lineWidth = 1.5;
    roundedRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1, 10);
    ctx.stroke();
    ctx.restore();

    for (const e of S.order) {
      const p = seg(t, e.at, e.end);
      if (p <= 0) continue;
      ctx.save();
      ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
      if (e.type === 'axes') {
        ctx.restore();
        noteTip(tips, e.at, drawPlaneAxes(G, p, narrow));
        continue;
      }
      if (e.type === 'curve') {
        const total = G.paths.reduce((n, pl) => n + pl.len, 0);
        let left = p * total;
        for (const pl of G.paths) {
          const lim = Math.min(pl.len, left);
          if (lim > 0) noteTip(tips, e.at, strokePolyline(pl, lim, e.hex, 3));
          left -= pl.len;
          if (left <= 0) break;
        }
        if (G.curveLabel && p > 0.5) {
          const lp = seg(p, 0.5, 1);
          drawRich(G.curveLabel.L, G.curveLabel.x, G.curveLabel.y, lp, e.hex, { knock: true });
        }
      } else if (e.type === 'line' || e.type === 'tangent') {
        const c = G.lines.get(e.idx);
        if (c) {
          const q = easeInOut(p);
          const x1 = lerp(c[0], c[2], q);
          const y1 = lerp(c[1], c[3], q);
          chalkLine(c[0], c[1], x1, y1, e.hex, e.type === 'tangent' ? 2.6 : 3, e.type === 'tangent' ? [11, 8] : null);
          noteTip(tips, e.at, { x: x1, y: y1 });
        }
      } else if (e.type === 'link') {
        const A = S.pts[e.from];
        const B = S.pts[e.to];
        if (A && B) {
          const x0 = X(A.x); const y0 = Y(A.y); const x1 = X(B.x); const y1 = Y(B.y);
          const q = easeInOut(p);
          const ex = lerp(x0, x1, q);
          const ey = lerp(y0, y1, q);
          chalkLine(x0, y0, ex, ey, e.hex, 2.4, [7, 7]);
          if (p >= 1) arrowHead(x1, y1, Math.atan2(y1 - y0, x1 - x0), 9, e.hex);
          noteTip(tips, e.at, { x: ex, y: ey });
        }
      }
      ctx.restore();
    }
    // 점 표식
    for (const e of S.order) {
      if (e.type !== 'point') continue;
      const m = G.markers.get(e.idx);
      const p = seg(t, e.at, e.at + 0.35);
      if (!m || p <= 0) continue;
      ctx.save();
      if (m.inside) {
        const r = m.r * (0.4 + 0.6 * easeOut(p));
        dot(m.x, m.y, r, e.hex, 1);
        if (p < 1 && !reduced) ring(m.x, m.y, m.r * (1 + 1.6 * (1 - p)), e.hex, 1 - p, 2);
      } else {
        ctx.translate(m.x, m.y);
        ctx.rotate(m.ang);
        ctx.fillStyle = e.hex;
        ctx.globalAlpha = 0.95 * p;
        ctx.beginPath();
        ctx.moveTo(10, 0); ctx.lineTo(-7, -8); ctx.lineTo(-7, 8); ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    // 라벨 (맨 위)
    for (const e of S.order) {
      if (e.type !== 'point' || !e.runs) continue;
      const lab = G.labels.get(e.idx);
      const p = seg(t, e.at + 0.35, e.end);
      if (!lab || p <= 0) continue;
      noteTip(tips, e.at + 0.35, drawRich(lab.L, lab.x, lab.y, p, e.hex, { knock: true }));
    }
  }

  /* ---- 유한체 격자 ---- */
  function drawFiniteAxes(G, p) {
    const left = G.gx0;
    const bottom = G.gy1;
    const right = G.gx0 + G.cell * G.p;
    const top = G.gy1 - G.cell * G.p;
    const white = COLORS.white;
    const narrow = G.rect.w < 420;
    const every = G.cell < 22 ? 2 : 1;
    const fs = narrow ? 15 : 18;
    ctx.save();
    ctx.strokeStyle = white;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.1 * seg(p, 0.1, 0.7);
    ctx.beginPath();
    for (let v = 0; v < G.p; v++) {
      ctx.moveTo(G.X(v), top); ctx.lineTo(G.X(v), bottom);
      ctx.moveTo(left, G.Y(v)); ctx.lineTo(right, G.Y(v));
    }
    ctx.stroke();
    ctx.restore();
    const px = seg(p, 0, 0.6);
    const py = seg(p, 0.25, 0.85);
    if (px > 0) chalkLine(left, bottom, lerp(left, right, easeOut(px)), bottom, white, 2.2);
    if (py > 0) chalkLine(left, bottom, left, lerp(bottom, top, easeOut(py)), white, 2.2);
    const ta = seg(p, 0.6, 1);
    if (ta > 0) {
      ctx.save();
      ctx.globalAlpha = ta;
      ctx.font = fontStr(fs);
      ctx.fillStyle = white;
      ctx.textAlign = 'center';
      for (let v = 0; v < G.p; v += every) ctx.fillText(String(v), G.X(v), bottom + fs + 4);
      ctx.textAlign = 'right';
      for (let v = 0; v < G.p; v += every) ctx.fillText(String(v), left - 6, G.Y(v) + fs * 0.32);
      ctx.textAlign = 'left';
      ctx.fillText('x', right - fs * 0.4, bottom - 8);
      ctx.fillText('y', left + 8, top - 6);
      ctx.restore();
    }
    return px < 1 ? { x: lerp(left, right, easeOut(px)), y: bottom } : py < 1 ? { x: left, y: lerp(bottom, top, easeOut(py)) } : null;
  }

  function drawFinite(S, G, t, tips, reduced) {
    const { rect } = G;
    ctx.save();
    ctx.strokeStyle = 'rgba(243,240,228,0.2)';
    ctx.lineWidth = 1.5;
    roundedRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1, 10);
    ctx.stroke();
    ctx.restore();
    const cell = G.cell;
    for (const e of S.order) {
      const p = seg(t, e.at, e.end);
      if (p <= 0) continue;
      if (e.type === 'axes') noteTip(tips, e.at, drawFiniteAxes(G, p));
      else if (e.type === 'hline') {
        const y = G.Y(e.y);
        const x0 = G.gx0;
        const x1 = lerp(G.gx0, G.gx0 + cell * G.p, easeInOut(p));
        chalkLine(x0, y, x1, y, e.hex, 2.4, [10, 7]);
        noteTip(tips, e.at, { x: x1, y });
        if (G.hlineLabel && p > 0.4) drawRich(G.hlineLabel.L, G.hlineLabel.x, G.hlineLabel.y, seg(p, 0.4, 1), e.hex, { knock: true });
      } else if (e.type === 'dots') {
        const n = e.points.length;
        e.points.forEach((P, k) => {
          const local = clamp(p * n - k, 0, 1);
          if (local <= 0) return;
          dot(G.X(P.x), G.Y(P.y), cell * 0.2 * (0.4 + 0.6 * easeOut(local)), e.hex, 0.85);
          if (local < 1) noteTip(tips, e.at, { x: G.X(P.x), y: G.Y(P.y) });
        });
      }
    }
    for (const e of S.order) {
      if (e.type !== 'orbit') continue;
      const p = seg(t, e.at, e.end);
      if (p <= 0) continue;
      const M = e.multiples;
      const n = M.length;
      const showNum = cell >= 20;
      const nfs = clamp(cell * 0.62, 14, 21);
      for (let k = 1; k < n; k++) {
        const local = p * n - k;
        if (local <= 0) break;
        const q = clamp(local / 0.7, 0, 1);
        const a = M[k - 1];
        const b = M[k];
        chalkLine(G.X(a.x), G.Y(a.y), lerp(G.X(a.x), G.X(b.x), q), lerp(G.Y(a.y), G.Y(b.y), q), e.hex, 1.4, null, 0.5);
      }
      for (let k = 0; k < n; k++) {
        const local = clamp(p * n - k, 0, 1);
        if (local <= 0) break;
        const P = M[k];
        const x = G.X(P.x);
        const y = G.Y(P.y);
        const popLocal = clamp((local - 0.4) / 0.6, 0, 1);
        if (k === 0 || popLocal > 0) {
          dot(x, y, cell * 0.27 * (0.5 + 0.5 * easeOut(k === 0 ? local : popLocal)), e.hex, 1);
          if (showNum || k < 3 || k === n - 1) {
            ctx.save();
            ctx.font = fontStr(nfs);
            ctx.textAlign = 'left';
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.lineJoin = 'round';
            ctx.strokeText(String(k + 1), x + cell * 0.3, y - cell * 0.22);
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = e.hex;
            ctx.globalAlpha = 0.95 * popLocal;
            ctx.fillText(String(k + 1), x + cell * 0.3, y - cell * 0.22);
            ctx.restore();
          }
        }
        if (local < 1) noteTip(tips, e.at, { x, y });
      }
    }
    for (const e of S.order) {
      if (e.type !== 'point') continue;
      const m = G.markers.get(e.idx);
      const p = seg(t, e.at, e.at + 0.35);
      if (!m || p <= 0) continue;
      dot(m.x, m.y, cell * 0.3 * (0.5 + 0.5 * easeOut(p)), e.hex, 1);
      ring(m.x, m.y, cell * 0.5 * (1 + (reduced ? 0 : 0.6 * (1 - p))), e.hex, 0.95, 2.2);
    }
    for (const e of S.order) {
      if (e.type !== 'point' || !e.runs) continue;
      const lab = G.labels.get(e.idx);
      const p = seg(t, e.at + 0.35, e.end);
      if (!lab || p <= 0) continue;
      noteTip(tips, e.at + 0.35, drawRich(lab.L, lab.x, lab.y, p, e.hex, { knock: true }));
    }
  }

  /* ---- 막대 ---- */
  function drawBars(S, G, t, tips) {
    const B = G.bars;
    const { rect } = G;
    const ax0 = rect.x + 8;
    const ax1 = rect.x + rect.w - 8;
    const scale = (v) => ax0 + (clamp(v, 0, S.raw.board.axisMax) / S.raw.board.axisMax) * (ax1 - ax0);
    // 축
    const ay = B.axisY;
    ctx.save();
    chalkLine(ax0, ay, ax1, ay, COLORS.white, 2);
    ctx.restore();
    S.raw.board.axisTicks.forEach((tv, i) => {
      const x = scale(tv);
      chalkLine(x, ay - 6, x, ay + 6, COLORS.white, 1.8);
      const L = B.ticks[i];
      const lx = clamp(x, rect.x + L.w / 2 + 2, rect.x + rect.w - L.w / 2 - 2);
      drawRich(L, lx, ay + 8, 1, COLORS.white, { align: 'center' });
    });
    if (B.axisLabel) drawRich(B.axisLabel, rect.x + rect.w - 4, ay + 10 + B.ticks[0].h, 1, '#cfd8c8', { align: 'right' });
    // 가는 세로 눈금선
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = COLORS.white;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const tv of S.raw.board.axisTicks) { ctx.moveTo(scale(tv), rect.y + 4); ctx.lineTo(scale(tv), ay); }
    ctx.stroke();
    ctx.restore();
    for (const r of B.rows) {
      const e = r.e;
      const p = seg(t, e.at, e.end);
      if (p <= 0) continue;
      const lp = seg(p, 0, 0.35);
      noteTip(tips, e.at, drawRich(r.label, rect.x + 4, r.y, lp, e.hex, {}));
      const by = r.y + r.label.h + 4 + (r.sameRow ? 0 : r.value.h + 2);
      const bp = easeOut(seg(p, 0.15, 1));
      const bw = Math.max(0, (scale(e.log2) - ax0) * bp);
      ctx.save();
      ctx.globalAlpha = 0.78;
      ctx.fillStyle = e.hex;
      roundedRect(ax0, by, Math.max(bw, 0.1), B.barH, 5);
      ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#fffdf2';
      roundedRect(ax0, by, Math.max(bw, 0.1), B.barH, 5);
      ctx.stroke();
      ctx.restore();
      if (p < 1 && bw > 0) noteTip(tips, e.at + 0.15, { x: ax0 + bw, y: by + B.barH / 2 });
      const vp = seg(p, 0.55, 1);
      if (vp > 0) {
        if (r.sameRow) drawRich(r.value, rect.x + rect.w - 4, r.y, vp, e.hex, { align: 'right' });
        else drawRich(r.value, rect.x + 4, r.y + r.label.h + 2, vp, e.hex, {});
      }
    }
  }

  /* ---- 흐름도 ---- */
  function drawFlow(S, G, t, tips) {
    const boxes = G.flow.boxes;
    boxes.forEach((b, k) => {
      const e = b.e;
      const el = t - e.at;
      if (el < 0) return;
      const arrowP = k > 0 ? seg(el, 0, 0.4) : 1;
      const boxStart = k > 0 ? 0.25 : 0;
      const boxP = seg(el, boxStart, boxStart + 0.5);
      if (k > 0 && arrowP > 0) {
        const a = boxes[k - 1];
        let x0;
        let y0;
        let x1;
        let y1;
        if (Math.abs(a.y - b.y) < 2) { // 같은 줄
          const dir = b.x > a.x ? 1 : -1;
          x0 = dir > 0 ? a.x + a.w + 3 : a.x - 3; x1 = dir > 0 ? b.x - 3 : b.x + b.w + 3;
          y0 = y1 = a.y + a.h / 2;
        } else { // 줄바꿈: 같은 열에서 아래로
          x0 = x1 = a.x + a.w / 2;
          y0 = a.y + a.h + 3; y1 = b.y - 3;
        }
        const ex = lerp(x0, x1, easeInOut(arrowP));
        const ey = lerp(y0, y1, easeInOut(arrowP));
        chalkLine(x0, y0, ex, ey, COLORS.white, 2.6, null);
        if (arrowP >= 1) arrowHead(x1, y1, Math.atan2(y1 - y0, x1 - x0), 10, COLORS.white);
        noteTip(tips, e.at, { x: ex, y: ey });
      }
      if (boxP > 0) {
        ctx.save();
        ctx.globalAlpha = 0.1 * boxP;
        ctx.fillStyle = e.hex;
        roundedRect(b.x, b.y, b.w, b.h, 12);
        ctx.fill();
        ctx.globalAlpha = 0.92;
        ctx.strokeStyle = e.hex;
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        const perim = 2 * (b.w + b.h);
        ctx.setLineDash([perim * boxP, perim]);
        roundedRect(b.x, b.y, b.w, b.h, 12);
        ctx.stroke();
        ctx.restore();
        if (boxP < 1) noteTip(tips, e.at + boxStart, { x: b.x + b.w * boxP, y: b.y });
      }
      // 글: 제목 → 줄
      const texts = [{ L: b.title, y: b.pad }].concat(b.lines.map((L, i) => ({ L, y: b.pad + b.title.h + 6 + b.lines.slice(0, i).reduce((n, l) => n + l.h, 0) })));
      texts.forEach((tx, i) => {
        const part = e.parts[i];
        const p = seg(el, part.start, part.start + part.dur);
        if (p <= 0) return;
        noteTip(tips, e.at + part.start, drawRich(tx.L, b.x + b.pad, b.y + tx.y, p, i === 0 ? e.hex : COLORS.white, {}));
      });
    });
  }

  /* ---- 오른쪽(또는 아래) 글 ---- */
  function drawPanel(S, G, t, tips) {
    const pr = G.panelRect;
    G.panel.items.forEach((it) => {
      const p = seg(t, it.line.at, it.line.at + it.line.dur);
      if (p <= 0) return;
      noteTip(tips, it.line.at, drawRich(it.L, pr.x, pr.y + it.y, p, COLORS[it.line.color], {}));
    });
  }

  /* ====================================================================
   * 6. 렌더 · 재생
   * ==================================================================== */
  let index = 0;
  let t = 0;
  let hold = 0;
  let playing = false;
  let started = false;
  let auto = true;
  let speed = 1;
  let reduced = false;
  let lastTip = null;
  let rafId = 0;
  let lastNow = 0;
  const visited = new Set([0]);

  const reducedQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  reduced = !!(reducedQuery && reducedQuery.matches);

  const stepEnd = () => steps[index].tl.animEnd;
  const effT = () => (reduced ? stepEnd() : t);
  const isComplete = () => t >= stepEnd() - 1e-6 || reduced;

  function drawBoard(S, G, tt, tips) {
    if (G.kind === 'plane') drawPlane(S, G, tt, tips, reduced);
    else if (G.kind === 'finite') drawFinite(S, G, tt, tips, reduced);
    else if (G.kind === 'bars') drawBars(S, G, tt, tips);
    else if (G.kind === 'flow') drawFlow(S, G, tt, tips);
  }

  /** 넓은 화면은 모든 단계가 같은 높이, 좁은 화면은 단계마다 필요한 높이로 맞춥니다. */
  function syncCanvasSize() {
    const H = Math.ceil(frame.wide ? frame.H : frame.stepH[index]);
    const pw = Math.round(frame.W * dpr);
    const ph = Math.round(H * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
      canvas.style.height = H + 'px';
    }
    return H;
  }

  function render() {
    if (!frame) return;
    const H = syncCanvasSize();
    const S = steps[index];
    const G = frame.geoms[index];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, frame.W, H);
    const tt = effT();
    const tips = [];
    drawBoard(S, G, tt, tips);
    drawPanel(S, G, tt, tips);
    applyGrain(frame.W, H);
    if (!reduced && started && tt < stepEnd() - 1e-6) {
      let best = null;
      for (const tp of tips) if (!best || tp.start >= best.start) best = tp;
      if (best) lastTip = best;
      if (lastTip) drawChalkPiece(lastTip.x, lastTip.y, playing, clamp(frame.W / 900, 0.7, 1));
    }
    updateProgressUI();
  }

  function layoutAll() {
    const stage = byId('board-stage');
    const W = Math.max(280, Math.floor(stage.clientWidth));
    dpr = clamp(window.devicePixelRatio || 1, 1, 2.5);
    frame = computeFrame(W);
    warnings = frame.warnings;
    canvas.width = 0; // render()가 단계에 맞는 크기로 다시 맞춥니다
  }

  function advance(dt) {
    const end = stepEnd();
    if (t < end) t = Math.min(end, t + dt);
    else hold += dt;
    if (t >= end - 1e-6) {
      if (!auto) {
        playing = false;
        updatePlayUI();
        refreshStatus();
      } else if (hold >= steps[index].tl.holdEnd - end) {
        if (index < N - 1) goTo(index + 1, { play: true });
        else { playing = false; updatePlayUI(); refreshStatus(); }
      }
    }
  }

  function tick(now) {
    rafId = 0;
    if (!playing) return;
    const dt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000)) * speed;
    lastNow = now;
    advance(dt);
    render();
    if (playing) schedule();
  }
  function schedule() {
    if (rafId) return;
    lastNow = performance.now();
    rafId = requestAnimationFrame(tick);
  }

  /* ====================================================================
   * 7. 화면 갱신
   * ==================================================================== */
  const el = {
    status: byId('status'), time: byId('time'), progress: byId('progress'), fill: byId('progress-fill'),
    play: byId('play'), playLabel: byId('play-label'), playIcon: byId('play-icon'),
    prev: byId('prev'), next: byId('next'), replay: byId('replay'), restart: byId('restart'),
    autoToggle: byId('auto-toggle'), autoState: byId('auto-state'), speed: byId('speed'),
    hint: byId('board-hint'), hintText: byId('hint-text'),
    title: byId('board-title'), count: byId('board-count'), tag: byId('board-tag'),
    legend: byId('legend'), chapters: byId('chapters'), summary: byId('summary'), beats: byId('beats'),
    callout: byId('callout'), calloutTitle: byId('callout-title'), calloutText: byId('callout-text'),
    captionToggle: byId('caption-toggle'), captionBody: byId('caption-body'), sr: byId('board-sr'),
    reducedNote: byId('reduced-note'),
  };

  function updatePlayUI() {
    let label;
    let icon = 'play';
    if (reduced) label = '다음 단계 보기';
    else if (playing) { label = '일시정지'; icon = 'pause'; }
    else if (isComplete()) label = index < N - 1 ? '다음 단계 재생' : '처음부터 재생';
    else label = t > 0 ? '이어서 재생' : '재생';
    el.playLabel.textContent = label;
    byId('icon-play').hidden = icon !== 'play';
    byId('icon-pause').hidden = icon !== 'pause';
    el.play.setAttribute('aria-label', label);
    el.prev.setAttribute('aria-disabled', index === 0 ? 'true' : 'false');
    el.next.setAttribute('aria-disabled', index === N - 1 ? 'true' : 'false');
    el.hint.classList.toggle('is-off', started || reduced);
    el.hint.hidden = started || reduced;
  }

  function refreshStatus() {
    const n = index + 1;
    let msg;
    if (reduced) msg = n + '단계 · 완성된 칠판을 보고 있어요';
    else if (!started) msg = '재생 버튼을 누르면 판서가 시작돼요 (소리는 나오지 않아요)';
    else if (playing) msg = n + '단계 판서 중';
    else if (isComplete()) msg = n + '단계 판서 완료' + (index < N - 1 ? '' : ' · 마지막 단계예요');
    else msg = n + '단계 일시정지';
    if (el.status.textContent !== msg) el.status.textContent = msg;
  }

  let lastPct = -1;
  let lastBeat = -2;
  function updateProgressUI() {
    const S = steps[index];
    const tt = effT();
    const frac = S.tl.animEnd > 0 ? clamp(tt / S.tl.animEnd, 0, 1) : 1;
    el.fill.style.transform = 'scaleX(' + frac.toFixed(4) + ')';
    const pct = Math.round(frac * 100);
    if (pct !== lastPct) {
      lastPct = pct;
      el.progress.setAttribute('aria-valuenow', String(pct));
      el.progress.setAttribute('aria-valuetext', pct + '%');
      el.time.textContent = formatClock(tt) + ' / ' + formatClock(S.tl.animEnd);
    }
    // 설명 순서 강조
    const beats = S.raw.beats;
    let active = -1;
    if (!isComplete()) for (let i = 0; i < beats.length; i++) if (beats[i].at <= tt) active = i;
    const key = isComplete() ? beats.length : active;
    if (key !== lastBeat) {
      lastBeat = key;
      [...el.beats.children].forEach((li, i) => {
        const state = isComplete() ? 'past' : i < active ? 'past' : i === active ? 'active' : 'future';
        li.className = 'is-' + state;
        if (state === 'active') li.setAttribute('aria-current', 'true'); else li.removeAttribute('aria-current');
      });
    }
  }

  function buildLegend(S) {
    const frag = document.createDocumentFragment();
    for (const item of S.raw.legend) {
      const li = document.createElement('li');
      const sw = document.createElement('span');
      sw.className = 'swatch' + (item.style === 'line' ? '' : ' is-' + item.style);
      sw.style.setProperty('--c', COLORS[item.color]);
      sw.setAttribute('aria-hidden', 'true');
      const tx = document.createElement('span');
      renderRich(tx, item.text, S.resolved);
      const hidden = document.createElement('span');
      hidden.className = 'sr-only';
      hidden.textContent = ' (' + COLOR_KO[item.color] + ')';
      li.append(sw, tx, hidden);
      frag.appendChild(li);
    }
    el.legend.replaceChildren(frag);
  }

  function updateStepUI() {
    const S = steps[index];
    renderRich(el.title, S.raw.title, S.resolved);
    el.count.textContent = (index + 1) + ' / ' + N;
    el.tag.textContent = S.raw.tag.text;
    el.tag.dataset.tone = S.raw.tag.tone;
    renderRich(el.summary, S.raw.summary, S.resolved);
    const frag = document.createDocumentFragment();
    S.raw.beats.forEach((b) => {
      const li = document.createElement('li');
      renderRich(li, b.text, S.resolved);
      frag.appendChild(li);
    });
    el.beats.replaceChildren(frag);
    lastBeat = -2;
    el.callout.dataset.tone = S.raw.callout.tone;
    renderRich(el.calloutTitle, S.raw.callout.title, S.resolved);
    renderRich(el.calloutText, S.raw.callout.text, S.resolved);
    buildLegend(S);
    canvas.setAttribute('aria-label', '칠판 ' + (index + 1) + '단계: ' + S.titleText);
    el.sr.textContent = S.altText;
    [...el.chapters.querySelectorAll('.chapter-btn')].forEach((b, i) => {
      b.classList.toggle('is-current', i === index);
      b.classList.toggle('is-seen', i !== index && visited.has(i));
      if (i === index) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    lastPct = -1;
    try {
      history.replaceState(null, '', '#' + (index + 1));
    } catch (e) { /* file:// 등에서 막히면 주소 갱신만 건너뜁니다 */ }
  }

  function buildChapters() {
    const frag = document.createDocumentFragment();
    steps.forEach((S, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chapter-btn';
      const num = document.createElement('span');
      num.className = 'chapter-num';
      num.textContent = String(i + 1);
      num.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span');
      name.className = 'chapter-name';
      name.textContent = S.raw.nav;
      b.append(num, name);
      b.setAttribute('aria-label', (i + 1) + '단계 ' + S.raw.nav);
      b.addEventListener('click', () => goTo(i));
      li.appendChild(b);
      frag.appendChild(li);
    });
    el.chapters.replaceChildren(frag);
  }

  function buildExtras() {
    const mis = byId('mis-list');
    const frag = document.createDocumentFragment();
    for (const m of DATA.misconceptions) {
      const li = document.createElement('li');
      li.className = 'mis-item';
      const h = document.createElement('p');
      h.className = 'mis-title';
      renderRich(h, m.title, null);
      const p = document.createElement('p');
      p.className = 'mis-text';
      renderRich(p, m.text, null);
      li.append(h, p);
      frag.appendChild(li);
    }
    mis.replaceChildren(frag);
    const refs = byId('ref-list');
    const rf = document.createDocumentFragment();
    for (const r of DATA.references) {
      const li = document.createElement('li');
      renderRich(li, r, null);
      rf.appendChild(li);
    }
    refs.replaceChildren(rf);
  }

  /* ====================================================================
   * 8. 조작
   * ==================================================================== */
  function goTo(i, opts) {
    const o = opts || {};
    index = clamp(i, 0, N - 1);
    hold = 0;
    lastTip = null;
    visited.add(index);
    const wantPlay = o.play !== undefined ? o.play : playing;
    if (reduced) { t = stepEnd(); playing = false; started = true; } else if (wantPlay) { t = 0; playing = true; started = true; } else { t = stepEnd(); playing = false; started = true; }
    updateStepUI();
    updatePlayUI();
    refreshStatus();
    render();
    if (playing) schedule();
  }

  function play() {
    if (reduced) { goTo(index < N - 1 ? index + 1 : 0); return; }
    if (playing) return;
    if (started && isComplete()) { goTo(index < N - 1 ? index + 1 : 0, { play: true }); return; }
    playing = true;
    started = true;
    hold = 0;
    updatePlayUI();
    refreshStatus();
    schedule();
  }
  function pause() {
    if (!playing) return;
    playing = false;
    updatePlayUI();
    refreshStatus();
    render();
  }
  const toggle = () => (playing ? pause() : play());
  const next = () => { if (index < N - 1) goTo(index + 1); };
  const prev = () => { if (index > 0) goTo(index - 1); };
  const replay = () => goTo(index, { play: !reduced });
  const restart = () => goTo(0, { play: !reduced });

  function setAuto(on) {
    auto = !!on;
    el.autoToggle.setAttribute('aria-pressed', String(auto));
    el.autoState.textContent = auto ? '켬' : '끔';
  }
  function setSpeed(v) {
    const n = Number(v);
    if (!SPEEDS.includes(n)) return;
    speed = n;
    el.speed.value = String(n);
  }

  /** 테스트·점검용: 단계 i의 시각 tt(초 또는 'end')로 이동해 멈춘 채 그립니다. */
  function seek(i, tt) {
    index = clamp(i, 0, N - 1);
    playing = false;
    started = true;
    hold = 0;
    lastTip = null;
    visited.add(index);
    t = tt === 'end' || tt === undefined ? stepEnd() : clamp(Number(tt), 0, stepEnd());
    updateStepUI();
    updatePlayUI();
    refreshStatus();
    render();
  }

  function onKeyDown(e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = e.target && e.target.tagName;
    if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === ' ' || e.key === 'Spacebar') {
      if (tag === 'BUTTON' || tag === 'A') return; // 버튼은 스스로 눌림 처리
      e.preventDefault();
      toggle();
    } else if (e.key === 'ArrowRight') { e.preventDefault(); next(); } else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); } else if (/^[1-9]$/.test(e.key)) {
      const n = Number(e.key);
      if (n <= N) goTo(n - 1);
    }
  }

  let lastW = 0;
  function onResize() {
    const W = Math.floor(byId('board-stage').clientWidth);
    if (W === lastW) return;
    lastW = W;
    layoutAll();
    render();
  }

  function onMotionChange() {
    reduced = !!(reducedQuery && reducedQuery.matches);
    el.reducedNote.hidden = !reduced;
    if (reduced) { playing = false; t = stepEnd(); started = true; }
    updatePlayUI();
    refreshStatus();
    render();
  }

  /* ====================================================================
   * 9. 공개 API · 시작
   * ==================================================================== */
  function getState() {
    const S = steps[index];
    const G = frame ? frame.geoms[index] : null;
    const tt = effT();
    return {
      ready: !!frame,
      index, count: N, id: S.id, kind: S.kind,
      playing, started, reduced, auto, speed,
      t: Number(tt.toFixed(3)), animEnd: Number(S.tl.animEnd.toFixed(3)), complete: isComplete(),
      progress: S.tl.animEnd > 0 ? clamp(tt / S.tl.animEnd, 0, 1) : 1,
      canvas: frame ? { cssW: frame.W, cssH: Math.ceil(frame.wide ? frame.H : frame.stepH[index]), dpr, wide: frame.wide } : null,
      plot: G && (G.kind === 'plane' || G.kind === 'finite')
        ? { kind: G.kind, xPxPerUnit: G.xPxPerUnit, yPxPerUnit: G.yPxPerUnit, rect: G.rect }
        : null,
      warnings: warnings.slice(),
    };
  }

  function layoutReport() {
    return {
      width: frame ? frame.W : 0, height: frame ? frame.H : 0, warnings: warnings.slice(),
      steps: steps.map((S, i) => ({
        id: S.id, kind: S.kind,
        plot: frame && frame.geoms[i].xPxPerUnit ? { x: frame.geoms[i].xPxPerUnit, y: frame.geoms[i].yPxPerUnit } : null,
        animEnd: S.tl.animEnd, holdEnd: S.tl.holdEnd, neededHeight: frame ? Math.round(frame.stepH[i]) : 0,
      })),
    };
  }

  window.ellipticPlayer = {
    getState, layoutReport, goTo, play, pause, toggle, next, prev, replay, restart, seek, setSpeed, setAuto,
    get steps() { return steps.map((S) => S.id); },
  };

  function init() {
    renderRich(byId('lesson-title'), DATA.title, null);
    byId('lesson-eyebrow').textContent = DATA.eyebrow;
    byId('lesson-subtitle').textContent = DATA.subtitle;
    byId('lesson-count').textContent = '· ' + N + '단계';
    el.hintText.textContent = (DATA.ui && DATA.ui.hint) || '';
    buildChapters();
    buildExtras();
    el.play.addEventListener('click', toggle);
    el.prev.addEventListener('click', prev);
    el.next.addEventListener('click', next);
    el.replay.addEventListener('click', replay);
    el.restart.addEventListener('click', restart);
    el.hint.addEventListener('click', play);
    canvas.addEventListener('click', toggle);
    el.autoToggle.addEventListener('click', () => setAuto(el.autoToggle.getAttribute('aria-pressed') !== 'true'));
    el.speed.addEventListener('change', () => setSpeed(el.speed.value));
    el.captionToggle.addEventListener('click', () => {
      const open = el.captionBody.hidden;
      el.captionBody.hidden = !open;
      el.captionToggle.setAttribute('aria-expanded', String(open));
      el.captionToggle.textContent = open ? '설명 접기' : '설명 펼치기';
    });
    document.addEventListener('keydown', onKeyDown);
    if (reducedQuery && reducedQuery.addEventListener) reducedQuery.addEventListener('change', onMotionChange);
    window.addEventListener('resize', onResize);
    if (window.ResizeObserver) new ResizeObserver(onResize).observe(byId('board-stage'));
    window.addEventListener('hashchange', () => {
      const n = parseInt(location.hash.slice(1), 10);
      if (n >= 1 && n <= N && n - 1 !== index) goTo(n - 1);
    });

    el.reducedNote.hidden = !reduced;
    setAuto(true);
    const n0 = parseInt(location.hash.slice(1), 10);
    if (n0 >= 1 && n0 <= N) index = n0 - 1;
    visited.add(index);
    layoutAll();
    lastW = frame.W;
    t = reduced ? stepEnd() : 0;
    updateStepUI();
    updatePlayUI();
    refreshStatus();
    render();
    // 손글씨 글꼴이 준비되면 글자 폭이 달라지므로 한 번 더 배치합니다.
    if (document.fonts && document.fonts.load) {
      document.fonts.load('30px ChalkKorean', '가나다ABC123').then(() => {
        layoutAll();
        render();
      }).catch(() => { /* 글꼴을 못 읽어도 대체 글꼴로 계속합니다 */ });
    }
  }

  init();
})();
