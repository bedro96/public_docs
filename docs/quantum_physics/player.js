/* 양자물리학 칠판 강의 재생기 — 외부 의존성 없는 단일 파일 플레이어 (해설 음성 + 분필 소리).
 *
 * 빌드 계약: window.QMath(qmath.js)와 window.LESSON_DATA(quantum-physics.scene.json + 내장 MP3)가 먼저 정의되어야 합니다.
 * 이 파일은 장면 JSON을 읽어 Canvas에 판서하고, 단계마다 내장된 해설 음성(ko-KR-Haena)을 재생합니다.
 * 칠판 종류: graph(함수 그래프·도식) · flow(상자와 화살표) · bars(가로 막대) · chalk(글자만).
 * graph 의 식(expr)은 qmath.js 의 안전한 파서로만 계산합니다(eval/Function 없음).
 * 화면의 모든 글은 텍스트 노드/Canvas fillText로만 그리며 HTML 문자열을 삽입하지 않습니다.
 *
 * 시계 규칙(이 파일의 핵심):
 *   - 해설 음성이 재생 중이면 audio.currentTime 이 판서 시계 t 의 기준입니다. 자체 시계를 더하지 않습니다(두 번 세지 않음).
 *   - 음성이 없거나(끔·오류·끝남) 재생 중이 아니면 rAF 타임스탬프 차이 × 속도로 t 를 흘립니다.
 *     기준점은 첫 프레임의 rAF 타임스탬프이고 schedule() 이 덮어쓰지 않습니다(렌더 시간이 시계에서 빠지지 않게).
 *   - 단계 완료 = 판서 끝 && 음성 끝(음성이 꺼져 있거나 오류면 판서 끝). 완료 뒤 0.9초(실제 시간)를 세고 자동 넘김.
 *   - 분필 소리는 펜이 칠판에 닿아 있는 동안에만, 내장된 실제 녹음(CC0)으로만 냅니다. 합성 소리로 대체하지 않습니다.
 *
 * 구성: 0 상수·도우미  1 장면 준비  2 글 배치  3 칠판 배치(그래프·막대·흐름도)
 *       4 분필 도구  5 칠판 그리기  6 분필 소리·해설 음성  7 렌더·재생  8 화면 갱신  9 조작  10 공개 API
 */
(function () {
  'use strict';

  const DATA = window.LESSON_DATA;
  const QM = window.QMath;
  const byId = (id) => document.getElementById(id);

  if (!DATA || !QM || !Array.isArray(DATA.steps) || DATA.steps.length === 0) {
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
  const TONE_LABEL = { concept: '개념', experiment: '실험', math: '유도', apply: '응용', open: '열린 문제' };
  // 손글씨(NanumPenScript)에 없는 그리스 문자·수학 기호는 QMath(DejaVu Sans 부분 집합)로 글자마다 대체됩니다.
  const FONT_FAMILY = "NanumPenScript, QMath, 'Nanum Pen Script', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', 'Noto Sans CJK KR', sans-serif";
  const PANEL_SIZES = { xl: 52, l: 41, m: 34, s: 29 };
  const WIDE_MIN = 1000; // 이 너비 이상이면 그림(왼쪽)과 글(오른쪽)을 나란히 둡니다.
  const SPEEDS = [0.75, 1, 1.25, 1.5];
  const GAP_SEC = 0.9; // 단계가 완료(판서 끝 && 음성 끝)된 뒤 다음 단계로 넘어가기까지 기다리는 실제 시간
  const MAX_FRAME_DT = 0.25; // 탭 전환 등으로 한 프레임이 길어져도 시계는 이만큼만 따라갑니다(초)
  const STALL_SEC = 4; // 음성이 "재생 중"인데 이 시간 동안 currentTime 이 안 움직이면 오류로 봅니다
  const END_SLACK_SEC = 0.75; // ended 가 "이 클립의 끝"으로 인정되려면 currentTime 이 클립 길이에서 이 안쪽이어야 합니다(초)
  const CHALK_MAX_GAIN = 0.3; // 슬라이더 100% 일 때의 마스터 게인(조용한 상한)
  const CHALK_DEFAULT_VOLUME = 25; // 슬라이더 기본값(%)
  const CHALK_SEGMENT_SEC = 3.5; // 한 조각이 이만큼 울리면 녹음의 다른 부분에서 새 조각을 시작합니다(녹음 끝에서 4초 여유)
  const CHALK_BLOCKED_NOTE_SEC = 1.5; // 컨텍스트가 소리를 못 내는 채 이만큼 판서하면 안내를 보입니다

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
  function renderRich(el, text) {
    const runs = QM.parseRich(text);
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
  const plainOf = (text) => QM.richToPlain(QM.parseRich(text));

  /* ====================================================================
   * 1. 장면 준비 (식 컴파일 · 서식 파싱 · 시간표)
   * ==================================================================== */
  const Z = { axes: 0, area: 1, fn: 2, ellipse: 3, seg: 3, bar: 3, node: 3, point: 4, text: 5 };

  function prepareStep(raw, i) {
    const runsOf = (t) => QM.parseRich(t);
    if (!raw.board || !['graph', 'flow', 'bars', 'chalk'].includes(raw.board.kind)) throw new Error((raw.id || i + 1) + ' 단계: 알 수 없는 보드 종류 "' + (raw.board && raw.board.kind) + '"');
    const tl = QM.stepTimeline(raw);
    const S = { i, raw, id: raw.id, tl, kind: raw.board.kind, runsOf };

    S.panel = raw.panel.map((line, k) => ({
      runs: runsOf(line.text), color: line.color, size: line.size, at: tl.panel[k].at, dur: tl.panel[k].dur,
    }));

    S.els = raw.board.elements.map((el, k) => {
      const e = Object.assign({}, el);
      e.idx = k;
      e.dur = QM.elementDuration(el);
      e.end = el.at + e.dur;
      e.hex = el.color ? COLORS[el.color] : COLORS.white;
      e.z = Z[el.type];
      if (e.z === undefined) throw new Error((raw.id || i + 1) + ' 단계: 알 수 없는 요소 종류 "' + el.type + '"');
      if (el.type === 'point' && typeof el.label === 'string') e.runs = runsOf(el.label);
      if (el.type === 'text') e.runs = runsOf(el.text);
      if ((el.type === 'fn' || el.type === 'seg') && el.label && typeof el.label.text === 'string') {
        e.runs = runsOf(el.label.text);
        e.labelDur = QM.textDuration(plainOf(el.label.text)) * 0.6; // 선을 다 그린 뒤 이름을 쓰는 시간
        e.drawEnd = e.end - e.labelDur;
      } else if (el.type === 'point' && e.runs) {
        e.drawEnd = el.at + 0.35;
      } else {
        e.drawEnd = e.end;
      }
      if (el.type === 'fn' || el.type === 'area') {
        e.f = QM.compileExpr(el.expr);
      }
      if (el.type === 'axes') {
        e.xLabelRuns = el.xLabel ? runsOf(el.xLabel) : null;
        e.yLabelRuns = el.yLabel ? runsOf(el.yLabel) : null;
        e.xTickRuns = (el.xTicks || []).map((tk) => ({ v: tk.v, runs: runsOf(String(tk.label)) }));
        e.yTickRuns = (el.yTicks || []).map((tk) => ({ v: tk.v, runs: runsOf(String(tk.label)) }));
      }
      if (el.type === 'bar') {
        e.runs = runsOf(el.label);
        e.valueRuns = runsOf(el.value);
      }
      if (el.type === 'node') {
        e.titleRuns = runsOf(el.title);
        e.lineRuns = el.lines.map(runsOf);
        let at = 0.75; // 상자(0.75초) 다음에 제목과 줄을 차례로 씁니다
        e.parts = [e.titleRuns].concat(e.lineRuns).map((runs) => {
          const d = 0.7 * QM.textDuration(QM.richToPlain(runs));
          const part = { runs, start: at, dur: d };
          at += d;
          return part;
        });
      }
      return e;
    });
    if (S.kind === 'bars') S.markers = (raw.board.markers || []).map((m) => Object.assign({ runs: runsOf(m.label), hex: COLORS[m.color] || COLORS.white }, m));
    S.order = S.els.slice().sort((a, b) => a.z - b.z || a.idx - b.idx);
    S.titleText = plainOf(raw.title);
    S.altText = plainOf(raw.alt);
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

  let richSeq = 0; // 글 덩어리마다 붙는 번호 (분필 접촉 조각 식별용)

  /**
   * 서식 있는 글을 줄바꿈해 배치합니다. 위·아래 첨자는 직전 글자에 붙어 다닙니다.
   * 반환: { lines:[{segs:[{text,x,dy,size,w,space,n,prefix}], w}], w, h, lineH, size, n, overflow, uid }
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
      } else if (ww <= maxW) {
        for (let q = i; q < j; q++) push(atoms[q]);
      } else {
        // 한 단어가 칠판 폭보다 넓으면(공백이 없는 긴 글) 글자 단위로 줄을 바꿉니다.
        for (let q = i; q < j; q++) {
          const at = atoms[q];
          ctx.font = fontStr(at.size);
          for (const ch of Array.from(at.text)) {
            const cw = ctx.measureText(ch).width;
            if (line.segs.length && line.w + cw > maxW) { lines.push(line); line = { segs: [], w: 0 }; }
            push({ text: ch, dy: at.dy, size: at.size, w: cw, space: false });
          }
        }
      }
      i = j;
    }
    if (line.segs.length) lines.push(line);
    if (!lines.length) lines.push(line);
    let n = 0;
    let w = 0;
    for (const l of lines) { w = Math.max(w, l.w); for (const s of l.segs) n += s.n; }
    return { lines, w, h: lines.length * size * 1.22, lineH: size * 1.22, size, n, overflow: w > maxW + 1, uid: ++richSeq };
  }

  function segPrefix(sg) {
    if (!sg.prefix) {
      ctx.font = fontStr(sg.size);
      sg.prefix = [0];
      for (let k = 1; k <= sg.n; k++) sg.prefix.push(ctx.measureText(sg.text.slice(0, k)).width);
    }
    return sg.prefix;
  }

  /**
   * 글을 p(0~1)만큼 써 줍니다. (x, y)는 글 덩어리의 왼쪽 위.
   * 분필 끝을 { x, y, active, contact, unit, character } 로 돌려줍니다.
   *   active  — 아직 쓰는 중(p < 1)
   *   contact — 지금 분필이 칠판에 닿아 있는가. 공백과 글자 안의 획 사이(한글 2획, 그 밖 1획의 뒤 30%)는 뗍니다.
   *   unit    — 분필 소리 조각 식별자. 획이 바뀔 때마다 달라져 소리도 획 단위로 끊깁니다.
   */
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
      for (let si = 0; si < L.lines[li].segs.length; si++) {
        const sg = L.lines[li].segs[si];
        if (acc >= f) break outer;
        const sx = x + ox + sg.x;
        const sy = by + sg.dy;
        let width = sg.w;
        const partial = acc + sg.n > f;
        let contact = false;
        let unit = 'r' + L.uid + ':' + li + ':' + si;
        let character = '';
        if (partial) {
          const pre = segPrefix(sg);
          const kf = f - acc;
          const k = Math.min(sg.n - 1, Math.floor(kf));
          width = pre[k] + (pre[k + 1] - pre[k]) * (kf - k);
          character = sg.text[k] || '';
          const strokes = /[가-힣=+]/.test(character) ? 2 : 1;
          const strokePos = (kf - k) * strokes;
          const stroke = Math.min(strokes - 1, Math.floor(strokePos));
          contact = !sg.space && strokePos - stroke < 0.7;
          unit += ':' + k + ':' + stroke;
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
        tip = { x: sx + width, y: by - L.size * 0.3, active: p < 1, contact, unit, character };
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

  function layoutPanel(S, W, forceScale) {
    const scale = forceScale || clamp(W / 560, 0.8, 1.1);
    let y = 0;
    const items = [];
    S.panel.forEach((line, i) => {
      const size = PANEL_SIZES[line.size] * scale;
      const L = layoutRich(line.runs, size, W);
      if (i) y += size * (forceScale ? 0.5 : 0.32);
      items.push({ L, y, line });
      y += L.h;
    });
    return { items, h: y, scale, w: Math.max(0, ...items.map((it) => it.L.w)) };
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

  /** 막대그래프: (기준선 이름) + 글줄 + 막대 + (필요하면 값 줄) 을 위에서부터 쌓고 아래에 눈금축을 둡니다. */
  function layoutBars(S, rect) {
    const bars = S.els.filter((e) => e.type === 'bar');
    const board = S.raw.board;
    const fs = clamp(rect.w / 17, 22, 31);
    const barH = 26;
    const ax0 = rect.x + 8;
    const ax1 = rect.x + rect.w - 8;
    const rows = bars.map((e) => {
      const label = layoutRich(e.runs, fs, rect.w);
      const value = layoutRich(e.valueRuns, fs, rect.w);
      const sameRow = label.w + 18 + value.w <= rect.w;
      const h = label.h + 4 + barH + (sameRow ? 0 : value.h + 2);
      return { e, label, value, sameRow, h };
    });
    const ticks = board.axisTicks.map((t) => layoutRich([{ text: String(t), sup: false, sub: false }], fs * 0.8, 200));
    const tickH = ticks.length ? ticks[0].h : 0;
    const axisLabel = board.axisLabel ? layoutRich(QM.parseRich(board.axisLabel), fs * 0.9, rect.w) : null;
    const axisH = 14 + tickH + (axisLabel ? axisLabel.h + 4 : 0);
    // 기준 세로선 이름: 가로로 겹치면 한 층 위로 올립니다.
    const gapM = 6;
    const marks = [];
    const levels = [];
    for (const m of S.markers) {
      const L = layoutRich(m.runs, fs * 0.9, rect.w);
      const x = ax0 + (clamp(m.at, 0, board.axisMax) / board.axisMax) * (ax1 - ax0);
      const lx = clamp(x - L.w / 2, rect.x + 2, rect.x + rect.w - L.w - 2);
      let level = 0;
      while ((levels[level] || []).some((r) => lx < r.x + r.w + gapM && r.x < lx + L.w + gapM)) level++;
      (levels[level] = levels[level] || []).push({ x: lx, w: L.w });
      marks.push({ m, L, x, lx, level });
    }
    const markH = marks.length ? levels.length * (Math.max(...marks.map((k) => k.L.h)) + 2) + 8 : 0;
    for (const k of marks) k.ly = rect.y + 6 + k.level * (k.L.h + 2);
    const content = rows.reduce((n, r) => n + r.h, 0);
    const need = markH + content + rows.length * 22 + axisH + 14;
    const gap = Math.max(14, (rect.h - markH - content - axisH - 14) / Math.max(1, rows.length));
    let y = rect.y + 10 + markH;
    for (const r of rows) { r.y = y; y += r.h + gap; }
    return { rows, ticks, axisLabel, axisH, need, fs, barH, ax0, ax1, marks, markH, axisY: rect.y + rect.h - axisH - 2 };
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
      for (const ring of [0, 1, 2]) {
        const off = it.r + 6 + ring * 18;
        prefer.forEach((dir, rank) => {
          const raw = candidateRect(dir, it.x, it.y, w, h, off);
          // 칠판 밖으로 나가면 안쪽으로 밀어 넣되(밀린 거리만큼 감점), 아예 들어갈 자리가 없으면 큰 감점
          const r = {
            x: clamp(raw.x, inner.x, Math.max(inner.x, inner.x + inner.w - w)),
            y: clamp(raw.y, inner.y, Math.max(inner.y, inner.y + inner.h - h)),
            w, h,
          };
          let pen = rank * 0.5 + ring * 20 + (Math.abs(r.x - raw.x) + Math.abs(r.y - raw.y)) * 0.6;
          if (w > inner.w + 1 || h > inner.h + 1) pen += 1e5;
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

  /* ---- 그래프 칠판 배치 ---- */
  const TEXT_SIZE_WIDE = { s: 22, m: 26, l: 32 };
  const TEXT_SIZE_NARROW = { s: 19, m: 22, l: 27 };

  /** 점 목록 [[x,y]…] → 화면 좌표 꺾은선 { px, cum, len } (누적 길이 포함) */
  function polylinePx(points, G) {
    const px = points.map(([x, y]) => [G.X(x), G.Y(y)]);
    const cum = [0];
    for (let i = 1; i < px.length; i++) cum.push(cum[i - 1] + Math.hypot(px[i][0] - px[i - 1][0], px[i][1] - px[i - 1][1]));
    return { px, cum, len: cum[cum.length - 1] };
  }

  /**
   * 그래프 한 단계의 기하: 축 이름·눈금 글자가 들어갈 여백을 빼고 남은 곳(P)에 데이터 범위(view)를 맞춥니다.
   * equalAspect 이면 가로·세로 배율이 같도록 P 안에서 가운데 정렬(원이 찌그러지지 않음).
   */
  function graphGeom(S, rect) {
    const view = S.raw.board.view;
    const narrow = rect.w < 420;
    const axes = S.els.find((e) => e.type === 'axes');
    const tfs = narrow ? 17 : 20; // 눈금 글자 크기
    const lfs = narrow ? 20 : 23; // 축 이름 글자 크기
    const xEdge = !(view.y[0] < 0 && view.y[1] > 0); // x축이 아래 가장자리에 놓이는가
    const yEdge = !(view.x[0] < 0 && view.x[1] > 0); // y축이 왼쪽 가장자리에 놓이는가
    let left = 8;
    let right = 16;
    let top = 10;
    let bottom = 10;
    let ax = null;
    if (axes) {
      const lay = (runs, size) => layoutRich(runs, size, rect.w * 0.9);
      ax = {
        e: axes,
        xt: axes.xTickRuns.map((t) => ({ v: t.v, L: lay(t.runs, tfs) })),
        yt: axes.yTickRuns.map((t) => ({ v: t.v, L: lay(t.runs, tfs) })),
        xl: axes.xLabelRuns ? lay(axes.xLabelRuns, lfs) : null,
        yl: axes.yLabelRuns ? lay(axes.yLabelRuns, lfs) : null,
      };
      const maxYt = ax.yt.reduce((n, t) => Math.max(n, t.L.w), 0);
      const xtH = ax.xt.reduce((n, t) => Math.max(n, t.L.h), 0);
      if (yEdge) left = Math.max(left, maxYt + 20);
      else left = Math.max(left, 12);
      if (ax.xt.length && xEdge) left = Math.max(left, ax.xt[0].L.w / 2 + 6);
      right = Math.max(right, 18);
      if (ax.xt.length) right = Math.max(right, ax.xt[ax.xt.length - 1].L.w / 2 + 6);
      top = ax.yl ? ax.yl.h + 16 : 14;
      bottom = (ax.xt.length && xEdge ? xtH + 14 : 8) + (ax.xl ? ax.xl.h + 8 : 6);
    }
    const P = { x: rect.x + left, y: rect.y + top, w: Math.max(40, rect.w - left - right), h: Math.max(40, rect.h - top - bottom) };
    const dx = view.x[1] - view.x[0];
    const dy = view.y[1] - view.y[0];
    let sx = P.w / dx;
    let sy = P.h / dy;
    if (S.raw.board.equalAspect) sx = sy = Math.min(sx, sy);
    const D = { w: dx * sx, h: dy * sy };
    D.x = P.x + (P.w - D.w) / 2;
    D.y = P.y + (P.h - D.h) / 2;
    const G = {
      kind: 'graph', rect, P, D, narrow, tfs, lfs, ax, xEdge, yEdge, view,
      X: (x) => D.x + (x - view.x[0]) * sx,
      Y: (y) => D.y + D.h - (y - view.y[0]) * sy,
      xPxPerUnit: sx, yPxPerUnit: sy,
    };
    G.axisY = xEdge ? D.y + D.h : G.Y(0);
    G.axisX = yEdge ? D.x : G.X(0);
    G.sizeOf = (e) => (narrow ? TEXT_SIZE_NARROW : TEXT_SIZE_WIDE)[e.size || 'm'] || (narrow ? 22 : 26);
    return G;
  }

  /** 앵커(x, y)와 방향(dir)을 가진 라벨 목록을 만들어 겹치지 않게 놓습니다. */
  function buildGraphStep(S, rect) {
    const G = graphGeom(S, rect);
    const { D, view, narrow } = G;
    const warnLocal = [];
    const warn = (kind, detail) => warnLocal.push({ step: S.id, kind, detail });
    const obstacles = { rects: [], pts: [] };
    G.fns = new Map();
    G.areas = new Map();
    G.segs = new Map();
    G.ells = new Map();
    G.markers = new Map();

    // ---- 축 ----
    if (G.ax) {
      const { ax } = G;
      obstacles.rects.push({ x: D.x - 4, y: G.axisY - 3, w: D.w + 8, h: 6, wt: 5 }, { x: G.axisX - 3, y: D.y - 4, w: 6, h: D.h + 8, wt: 5 });
      for (const t of ax.xt) {
        t.x = G.X(t.v);
        t.y = G.axisY + 8;
        obstacles.rects.push({ x: t.x - t.L.w / 2 - 2, y: t.y - 2, w: t.L.w + 4, h: t.L.h, wt: 3000 });
      }
      for (const t of ax.yt) {
        t.y = G.Y(t.v) - t.L.h * 0.5;
        t.x = G.axisX - 10 - t.L.w;
        obstacles.rects.push({ x: t.x - 2, y: t.y, w: t.L.w + 4, h: t.L.h, wt: 3000 });
      }
      if (ax.xl) {
        ax.xl.x = Math.min(G.rect.x + G.rect.w - ax.xl.w - 4, D.x + D.w + 4 - ax.xl.w);
        ax.xl.y = G.rect.y + G.rect.h - ax.xl.h - 4;
        obstacles.rects.push({ x: ax.xl.x - 2, y: ax.xl.y, w: ax.xl.w + 4, h: ax.xl.h, wt: 3000 });
      }
      if (ax.yl) {
        ax.yl.x = clamp(G.axisX - 10, G.rect.x + 2, G.rect.x + G.rect.w - ax.yl.w - 2);
        ax.yl.y = G.rect.y + 4;
        obstacles.rects.push({ x: ax.yl.x - 2, y: ax.yl.y, w: ax.yl.w + 4, h: ax.yl.h, wt: 3000 });
      }
    }

    // ---- 곡선·넓이·선분·타원 ----
    const nCurve = (frac) => clamp(Math.ceil((D.w * frac) / 2), 60, 1500);
    for (const e of S.els) {
      if (e.type === 'fn') {
        const lo = e.x ? e.x[0] : view.x[0];
        const hi = e.x ? e.x[1] : view.x[1];
        const n = Math.max(e.samples || 0, nCurve(Math.abs(hi - lo) / (view.x[1] - view.x[0])));
        const parts = QM.sampleCurve(e.f, lo, hi, n, view.y, 1).map((pts) => polylinePx(pts, G)).filter((pl) => pl.len > 0.5);
        const total = parts.reduce((s, pl) => s + pl.len, 0);
        G.fns.set(e.idx, { parts, total });
        if (!parts.length) warn('fn-empty', e.expr);
        for (const pl of parts) for (let i = 0; i < pl.px.length; i += 3) obstacles.pts.push({ x: pl.px[i][0], y: pl.px[i][1], wt: 7 });
      } else if (e.type === 'area') {
        const n = nCurve(Math.abs(e.x[1] - e.x[0]) / (view.x[1] - view.x[0]));
        const base = G.Y(e.base === undefined ? 0 : e.base);
        const top = [];
        for (let i = 0; i <= n; i++) {
          const x = e.x[0] + ((e.x[1] - e.x[0]) * i) / n;
          const y = e.f(x);
          if (Number.isFinite(y)) top.push([G.X(x), clamp(G.Y(y), D.y - 4, D.y + D.h + 4)]);
        }
        G.areas.set(e.idx, { top, base: clamp(base, D.y, D.y + D.h) });
        if (top.length < 2) warn('area-empty', e.expr);
      } else if (e.type === 'seg') {
        const x0 = G.X(e.from[0]); const y0 = G.Y(e.from[1]); const x1 = G.X(e.to[0]); const y1 = G.Y(e.to[1]);
        G.segs.set(e.idx, { x0, y0, x1, y1, len: Math.hypot(x1 - x0, y1 - y0) });
        sampleSegment(obstacles.pts, x0, y0, x1, y1, 6, 7);
      } else if (e.type === 'ellipse') {
        const a0 = e.from === undefined ? 0 : e.from;
        const a1 = e.to === undefined ? TAU : e.to;
        const n = Math.max(24, Math.ceil((Math.abs(a1 - a0) / TAU) * 120));
        const pts = [];
        for (let i = 0; i <= n; i++) {
          const a = a0 + ((a1 - a0) * i) / n;
          pts.push([e.cx + e.rx * Math.cos(a), e.cy + e.ry * Math.sin(a)]);
        }
        const pl = polylinePx(pts, G);
        G.ells.set(e.idx, pl);
        for (let i = 0; i < pl.px.length; i += 2) obstacles.pts.push({ x: pl.px[i][0], y: pl.px[i][1], wt: 6 });
      }
    }

    // ---- 점 표식 ----
    for (const e of S.els) {
      if (e.type !== 'point') continue;
      const r = narrow ? 5.2 : 6.4;
      const m = { x: G.X(e.x), y: G.Y(e.y), r };
      G.markers.set(e.idx, m);
      obstacles.rects.push({ x: m.x - r - 3, y: m.y - r - 3, w: 2 * r + 6, h: 2 * r + 6, wt: 2000 });
    }

    // ---- 라벨 (나타나는 순서대로 자리를 잡습니다) ----
    const labelFs = narrow ? 22 : 26;
    const maxW = Math.max(120, G.P.w * 0.92);
    const items = [];
    for (const e of S.els.slice().sort((a, b) => a.at - b.at || a.idx - b.idx)) {
      if (!e.runs) continue;
      if (e.type === 'point') {
        const m = G.markers.get(e.idx);
        items.push({ key: e.idx, L: layoutRich(e.runs, labelFs, maxW), x: m.x, y: m.y, r: m.r, dir: e.dir || 'ur', text: e.label });
      } else if (e.type === 'text') {
        items.push({ key: e.idx, L: layoutRich(e.runs, G.sizeOf(e), maxW), x: G.X(e.x), y: G.Y(e.y), r: 0, dir: e.dir || 'r', text: e.text });
      } else if (e.type === 'fn' || e.type === 'seg') {
        items.push({ key: e.idx, L: layoutRich(e.runs, labelFs, maxW), x: G.X(e.label.x), y: G.Y(e.label.y), r: 0, dir: e.dir || 'ur', text: e.label.text });
      }
    }
    const inner = { x: rect.x + 3, y: rect.y + 3, w: rect.w - 6, h: rect.h - 6 };
    const { out } = placeLabels(S, G, inner, obstacles, items, warn);
    G.labels = out;
    G.inner = inner;
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
      side = clamp(Math.round(W * 0.5), 340, 560);
      panelX = pad * 2 + side;
      panelW = W - panelX - pad;
    } else {
      side = W - 2 * pad;
      panelW = side;
      panelX = pad;
    }
    const gap = 16;
    // chalk(그림 없는) 단계는 넓은 화면에서 칠판 전체를 글줄에 씁니다: 더 크게, 가운데 정렬 블록
    const chalkWide = (S) => wide && S.kind === 'chalk';
    const fullW = W - 2 * pad;
    const chalkPanel = (S) => {
      let P = null;
      for (const sc of [1.5, 1.3, 1.15, 1.0]) { P = layoutPanel(S, fullW, sc); if (P.h <= side) break; }
      return P;
    };
    const panels = steps.map((S) => (chalkWide(S) ? chalkPanel(S) : layoutPanel(S, panelW)));
    // 단계마다 칠판 높이: 그래프는 정사각형, 막대·흐름도는 내용이 필요한 만큼 (chalk 는 정사각형)
    const probe = { x: pad, y: pad, w: side, h: side };
    const boardH = steps.map((S) => {
      const floor = side * (wide ? 0.8 : 0.6);
      if (S.kind === 'flow') return Math.max(floor, layoutFlow(S, probe).need);
      if (S.kind === 'bars') return Math.max(floor, layoutBars(S, probe).need);
      if (S.kind === 'chalk') return wide ? side : 0; // 좁은 화면: 그림이 없으니 칠판 영역을 두지 않고 글줄만
      return side;
    });
    const maxBoard = Math.max(...boardH);
    const maxPanel = Math.max(...panels.map((p) => p.h));
    const H = wide ? Math.max(maxBoard, maxPanel) + 2 * pad : Math.max(...steps.map((_, i) => pad + boardH[i] + gap + panels[i].h)) + pad;
    const warn = [];
    const geoms = steps.map((S, i) => {
      const G = { panel: panels[i] };
      const rect = { x: pad, y: pad, w: side, h: boardH[i] };
      if (chalkWide(S)) {
        const bx = pad + Math.max(0, (fullW - panels[i].w) / 2);
        G.panelRect = { x: bx, y: pad + Math.max(0, (H - 2 * pad - panels[i].h) / 2), w: fullW, h: panels[i].h };
      } else G.panelRect = wide ? { x: panelX, y: pad, w: panelW, h: H - 2 * pad } : { x: panelX, y: pad + boardH[i] + gap, w: panelW, h: panels[i].h };
      if (S.kind === 'graph') Object.assign(G, buildGraphStep(S, rect));
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
  /**
   * 분필 끝 후보를 기록합니다. tip = { x, y, active?, contact?, unit?, character? }
   *   active  — 지금 그리고 있는 중인가(기본 true). 다 그린 요소의 끝은 active:false 로 "쉬는" 위치만 알려 줍니다.
   *   contact — 분필이 칠판에 닿아 있는가(기본 true). false 면 그림은 그려지지만 소리는 없습니다.
   *   unit    — 소리 조각 식별자. site(요소별 접두사)와 합쳐 단계 안에서 유일해야 하며, 바뀌면 새 조각이 시작됩니다.
   */
  function noteTip(tips, start, tip, site) {
    if (!tip) return;
    tips.push({
      start, x: tip.x, y: tip.y,
      active: tip.active !== undefined ? tip.active : true,
      contact: tip.contact !== false,
      unit: (site || 'tip') + (tip.unit ? ':' + tip.unit : ''),
      character: tip.character || '',
    });
  }

  /* ---- 그래프 ---- */
  /** 축: 눈금선(희미) → 가로축 → 세로축 → 눈금 숫자 → 축 이름 순서로 그립니다. */
  function drawGraphAxes(G, p) {
    const { rect, D, ax, X, Y } = G;
    const white = COLORS.white;
    const e = ax.e;
    const ay = G.axisY;
    const bx = G.axisX;
    ctx.save();
    ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
    if (e.grid !== false) {
      ctx.strokeStyle = '#f3f0e4';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.1 * seg(p, 0.1, 0.7);
      ctx.beginPath();
      for (const t of ax.xt) { ctx.moveTo(X(t.v), D.y); ctx.lineTo(X(t.v), D.y + D.h); }
      for (const t of ax.yt) { ctx.moveTo(D.x, Y(t.v)); ctx.lineTo(D.x + D.w, Y(t.v)); }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const px = seg(p, 0, 0.5);
    const py = seg(p, 0.2, 0.7);
    const xa = D.x - 4;
    const xb = D.x + D.w + 8;
    const ya = D.y + D.h + 4;
    const yb = D.y - 8;
    if (px > 0) chalkLine(xa, ay, lerp(xa, xb, easeOut(px)), ay, white, 2.2);
    if (py > 0) chalkLine(bx, ya, bx, lerp(ya, yb, easeOut(py)), white, 2.2);
    if (px >= 1) arrowHead(xb, ay, 0, 10, white);
    if (py >= 1) arrowHead(bx, yb, -Math.PI / 2, 10, white);
    // 눈금 표시
    const ma = seg(p, 0.45, 0.7);
    if (ma > 0) {
      ctx.strokeStyle = white;
      ctx.lineWidth = 1.8;
      ctx.globalAlpha = ma;
      ctx.beginPath();
      for (const t of ax.xt) { ctx.moveTo(X(t.v), ay - 5); ctx.lineTo(X(t.v), ay + 5); }
      for (const t of ax.yt) { ctx.moveTo(bx - 5, Y(t.v)); ctx.lineTo(bx + 5, Y(t.v)); }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // 눈금 숫자·축 이름: 글씨는 분필로 써 내려갑니다
    const tp = seg(p, 0.55, 0.85);
    if (tp > 0) {
      for (const t of ax.xt) drawRich(t.L, t.x, t.y, tp, white, { align: 'center' });
      for (const t of ax.yt) drawRich(t.L, t.x, t.y, tp, white, {});
    }
    let tip = null;
    const lp = seg(p, 0.8, 1);
    if (ax.xl && lp > 0) tip = drawRich(ax.xl, ax.xl.x, ax.xl.y, lp, '#e3ecd9', {});
    if (ax.yl && lp > 0) tip = drawRich(ax.yl, ax.yl.x, ax.yl.y, lp, '#e3ecd9', {}) || tip;
    if (px < 1) return { x: lerp(xa, xb, easeOut(px)), y: ay, unit: 'x' };
    if (py < 1) return { x: bx, y: lerp(ya, yb, easeOut(py)), unit: 'y' };
    return tip;
  }

  /** 곡선 아래 빗금 넓이: 왼쪽에서 오른쪽으로 번지듯 칠합니다. */
  function drawGraphArea(G, e, A, p, tips) {
    const top = A.top;
    if (top.length < 2) return;
    const x0 = top[0][0];
    const x1 = top[top.length - 1][0];
    const xr = lerp(x0, x1, easeInOut(p));
    const { D } = G;
    ctx.save();
    ctx.beginPath(); ctx.rect(x0 - 1, D.y - 6, xr - x0 + 1, D.h + 12); ctx.clip();
    ctx.beginPath();
    ctx.moveTo(top[0][0], A.base);
    for (const q of top) ctx.lineTo(q[0], q[1]);
    ctx.lineTo(x1, A.base);
    ctx.closePath();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = e.hex;
    ctx.fill();
    ctx.save();
    ctx.clip();
    let minY = A.base;
    let maxY = A.base;
    for (const q of top) { minY = Math.min(minY, q[1]); maxY = Math.max(maxY, q[1]); }
    const step = 11;
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = e.hex;
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    for (let c = Math.floor((x0 + minY) / step) * step; c <= x1 + maxY; c += step) {
      ctx.moveTo(c - minY, minY);
      ctx.lineTo(c - maxY, maxY);
    }
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 2;
    ctx.beginPath();
    top.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
    ctx.stroke();
    ctx.restore();
    if (p > 0) {
      let k = 0;
      while (k < top.length - 1 && top[k][0] < xr) k++;
      noteTip(tips, e.at, { x: xr, y: top[k][1], active: p < 1, unit: 's' + Math.floor((xr - x0) / 11) }, 'e' + e.idx);
    }
  }

  function drawGraph(S, G, t, tips, reduced) {
    const { rect, D } = G;
    ctx.save();
    // 칠판 가장자리 (희미한 테두리)
    ctx.strokeStyle = 'rgba(243,240,228,0.2)';
    ctx.lineWidth = 1.5;
    roundedRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1, 10);
    ctx.stroke();
    ctx.restore();

    for (const e of S.order) {
      if (e.type === 'point' || e.type === 'text') continue;
      const p = seg(t, e.at, e.drawEnd);
      if (p <= 0) continue;
      if (e.type === 'axes') {
        noteTip(tips, e.at, drawGraphAxes(G, seg(t, e.at, e.end)), 'e' + e.idx);
        continue;
      }
      ctx.save();
      if (e.type === 'fn') {
        // 곡선은 그래프 창(D) 안쪽으로 잘라 그립니다
        ctx.beginPath(); ctx.rect(D.x - 2, D.y - 2, D.w + 4, D.h + 4); ctx.clip();
        const F = G.fns.get(e.idx);
        let left = p * F.total;
        for (let pi = 0; pi < F.parts.length && left > 0; pi++) {
          const pl = F.parts[pi];
          const lim = Math.min(pl.len, left);
          if (lim > 0) {
            const tp = strokePolyline(pl, lim, e.hex, 3, e.dash ? [11, 8] : null);
            noteTip(tips, e.at, { x: tp.x, y: tp.y, active: p < 1 && lim < pl.len, unit: 'p' + pi }, 'e' + e.idx);
          }
          left -= pl.len;
        }
      } else if (e.type === 'area') {
        drawGraphArea(G, e, G.areas.get(e.idx), p, tips);
      } else if (e.type === 'seg') {
        ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
        const s = G.segs.get(e.idx);
        const q = easeInOut(p);
        const ex = lerp(s.x0, s.x1, q);
        const ey = lerp(s.y0, s.y1, q);
        chalkLine(s.x0, s.y0, ex, ey, e.hex, 2.8, e.style === 'dash' ? [9, 7] : null);
        if (e.arrow && p >= 1 && s.len > 6) arrowHead(s.x1, s.y1, Math.atan2(s.y1 - s.y0, s.x1 - s.x0), Math.min(11, s.len * 0.4), e.hex);
        noteTip(tips, e.at, { x: ex, y: ey, active: p < 1 }, 'e' + e.idx);
      } else if (e.type === 'ellipse') {
        ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
        const pl = G.ells.get(e.idx);
        const tp = strokePolyline(pl, p * pl.len, e.hex, 2.8, e.dash ? [9, 7] : null);
        noteTip(tips, e.at, { x: tp.x, y: tp.y, active: p < 1 }, 'e' + e.idx);
      }
      ctx.restore();
    }
    // 점 표식
    for (const e of S.order) {
      if (e.type !== 'point') continue;
      const m = G.markers.get(e.idx);
      const p = seg(t, e.at, e.at + 0.35);
      if (!m || p <= 0) continue;
      dot(m.x, m.y, m.r * (0.4 + 0.6 * easeOut(p)), e.hex, 1);
      if (p < 1 && !reduced) ring(m.x, m.y, m.r * (1 + 1.6 * (1 - p)), e.hex, 1 - p, 2);
    }
    // 글자 (맨 위): 점·선·곡선 이름과 자유 글자
    for (const e of S.order) {
      if (!e.runs) continue;
      const lab = G.labels.get(e.idx);
      if (!lab) continue;
      const start = e.type === 'point' ? e.at + 0.35 : e.type === 'text' ? e.at : e.drawEnd;
      const p = seg(t, start, e.end);
      if (p <= 0) continue;
      noteTip(tips, start, drawRich(lab.L, lab.x, lab.y, p, e.hex, { knock: true }), 'e' + e.idx + 'L');
    }
  }

  /* ---- 막대 ---- */
  function drawBars(S, G, t, tips) {
    const B = G.bars;
    const { rect } = G;
    const { ax0, ax1 } = B;
    const max = S.raw.board.axisMax;
    const scale = (v) => ax0 + (clamp(v, 0, max) / max) * (ax1 - ax0);
    // 축
    const ay = B.axisY;
    chalkLine(ax0, ay, ax1, ay, COLORS.white, 2);
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
    for (const tv of S.raw.board.axisTicks) { ctx.moveTo(scale(tv), rect.y + 4 + B.markH); ctx.lineTo(scale(tv), ay); }
    ctx.stroke();
    ctx.restore();
    // 기준 세로선(markers): 이름을 쓰고 아래로 점선을 내립니다 (막대보다 먼저, 시간 정보가 없으므로 단계 시작 직후)
    B.marks.forEach((k, mi) => {
      const m = k.m;
      const start = 0.2 + mi * 0.7;
      const p = seg(t, start, start + 0.8);
      if (p <= 0) return;
      const top = k.ly + k.L.h + 2;
      chalkLine(k.x, top, k.x, lerp(top, ay, easeOut(p)), m.hex, 2, [8, 7]);
      noteTip(tips, start, drawRich(k.L, k.lx, k.ly, p, m.hex, { knock: true }), 'M' + mi);
    });
    for (const r of B.rows) {
      const e = r.e;
      const p = seg(t, e.at, e.end);
      if (p <= 0) continue;
      const lp = seg(p, 0, 0.35);
      noteTip(tips, e.at, drawRich(r.label, rect.x + 4, r.y, lp, e.hex, { knock: true }), 'e' + e.idx + 'L');
      const by = r.y + r.label.h + 4 + (r.sameRow ? 0 : r.value.h + 2);
      const bp = easeOut(seg(p, 0.15, 1));
      const bw = Math.max(0, (scale(e.amount) - ax0) * bp);
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
      if (p < 1 && bw > 0) noteTip(tips, e.at + 0.15, { x: ax0 + bw, y: by + B.barH / 2 }, 'e' + e.idx + 'B');
      const vp = seg(p, 0.55, 1);
      if (vp > 0) {
        if (r.sameRow) noteTip(tips, e.at + 0.55, drawRich(r.value, rect.x + rect.w - 4, r.y, vp, e.hex, { align: 'right', knock: true }), 'e' + e.idx + 'V');
        else noteTip(tips, e.at + 0.55, drawRich(r.value, rect.x + 4, r.y + r.label.h + 2, vp, e.hex, { knock: true }), 'e' + e.idx + 'V');
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
        noteTip(tips, e.at, { x: ex, y: ey, active: arrowP < 1 }, 'e' + e.idx + 'A');
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
        if (boxP < 1) noteTip(tips, e.at + boxStart, { x: b.x + b.w * boxP, y: b.y }, 'e' + e.idx + 'X');
      }
      // 글: 제목 → 줄
      const texts = [{ L: b.title, y: b.pad }].concat(b.lines.map((L, i) => ({ L, y: b.pad + b.title.h + 6 + b.lines.slice(0, i).reduce((n, l) => n + l.h, 0) })));
      texts.forEach((tx, i) => {
        const part = e.parts[i];
        const p = seg(el, part.start, part.start + part.dur);
        if (p <= 0) return;
        noteTip(tips, e.at + part.start, drawRich(tx.L, b.x + b.pad, b.y + tx.y, p, i === 0 ? e.hex : COLORS.white, {}), 'e' + e.idx + 'T' + i);
      });
    });
  }

  /* ---- 오른쪽(또는 아래) 글 ---- */
  function drawPanel(S, G, t, tips) {
    const pr = G.panelRect;
    G.panel.items.forEach((it, k) => {
      const p = seg(t, it.line.at, it.line.at + it.line.dur);
      if (p <= 0) return;
      noteTip(tips, it.line.at, drawRich(it.L, pr.x, pr.y + it.y, p, COLORS[it.line.color], {}), 'P' + k);
    });
  }

  /* ====================================================================
   * 6. 분필 소리 · 해설 음성 — 둘 다 파일 안에 내장된 녹음만 씁니다(합성·외부 대체 없음)
   * ==================================================================== */
  const PROVIDER = DATA.narrationProvider || {};
  const VOICE_NAME = String(PROVIDER.voice || '').split(':')[0];
  const VOICE_LABEL = [PROVIDER.model, VOICE_NAME].filter(Boolean).join(' ') || '해설 음성';

  /** 안내/오류 문단(#voice-note, #chalk-note)을 채웁니다. kind: 'info' | 'error' */
  function setNote(node, text, kind) {
    if (!node) return;
    node.textContent = text || '';
    node.className = 'voice-note' + (text && kind ? ' is-' + kind : '');
  }

  /**
   * 분필 소리 (Web Audio) — 내장된 실제 녹음(CC0)을 펜이 칠판에 닿은 동안에만 재생합니다.
   * 획(unit)이 바뀌면 녹음의 다른 부분에서 새 조각을 시작하고, 펜을 떼면 4ms 안에 끝내 무음이 됩니다.
   * AudioContext 는 사용자의 재생·토글 동작 안에서만 만듭니다(unlock).
   */
  const chalk = (() => {
    let volume = CHALK_DEFAULT_VOLUME;
    let actx = null;
    let buffer = null;
    let master = null;
    let current = null; // { source, envelope, id, started, offset }
    let loading = null;
    let cursor = 0;
    let error = '';
    let want = null; // 가장 최근에 요청된 접촉 { id } — 디코딩·컨텍스트 준비가 끝나면 바로 다시 적용합니다
    let blockedSince = 0;
    let blockedShown = false;

    const note = (text, kind) => setNote(el.chalkNote, text, kind);

    function endCurrent() {
      if (!current) return;
      const v = current;
      current = null;
      if (!actx) return;
      const at = actx.currentTime;
      try {
        v.envelope.gain.cancelScheduledValues(at);
        v.envelope.gain.setValueAtTime(v.envelope.gain.value, at);
        v.envelope.gain.linearRampToValueAtTime(0, at + 0.004);
        v.source.stop(at + 0.005);
      } catch (e) { /* 이미 끝난 조각 */ }
      if (buffer) cursor = (v.offset + Math.max(0.06, at - v.started) + 0.137) % (buffer.duration - 4);
    }

    /** 모든 소리를 즉시 멈추고 요청도 지웁니다(일시정지·단계 이동·탭 숨김). */
    function stop() {
      want = null;
      endCurrent();
    }

    function fail(reason) {
      error = '분필 녹음을 재생하지 못했어요. 분필 소리를 끄고 강의를 계속 볼 수 있어요. (' + reason + ')';
      note('⚠ ' + error, 'error');
      stop();
    }

    function ensure() {
      if (actx) return actx;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { fail('이 브라우저는 Web Audio를 지원하지 않습니다'); return null; }
      try {
        actx = new AC();
        master = actx.createGain();
        master.gain.value = (CHALK_MAX_GAIN * volume) / 100;
        master.connect(actx.destination);
      } catch (e) {
        actx = null;
        master = null;
        fail(e && e.message ? e.message : '오디오 컨텍스트를 만들 수 없습니다');
        return null;
      }
      return actx;
    }

    function load(c) {
      if (loading) return;
      loading = (async () => {
        const sample = DATA.chalkSound;
        if (!sample || typeof sample.audio !== 'string' || sample.audio.indexOf(',') < 0) throw new Error('내장된 실제 분필 녹음이 없습니다');
        const bytes = Uint8Array.from(atob(sample.audio.split(',')[1]), (ch) => ch.charCodeAt(0));
        const decoded = await c.decodeAudioData(bytes.buffer);
        if (!decoded || !(decoded.duration >= 4)) throw new Error('분필 녹음이 너무 짧습니다');
        buffer = decoded;
        apply(); // 디코딩이 끝난 바로 이 순간에 펜이 닿아 있었다면 소리를 이어 붙입니다
      })().catch((e) => fail(e && e.message ? e.message : '분필 녹음을 풀지 못했습니다'));
    }

    function onRunning() {
      if (!actx || actx.state !== 'running') return;
      blockedSince = 0;
      if (blockedShown) { blockedShown = false; note('', ''); }
      apply();
    }

    /** 사용자 동작 안에서 호출: 컨텍스트를 만들고/깨우고, 녹음을 풉니다. 재생을 누를 때마다 resume 을 다시 시도합니다. */
    function unlock() {
      const c = ensure();
      if (!c || error) return;
      blockedSince = 0;
      if (c.state !== 'running') {
        try {
          const r = c.resume();
          if (r && typeof r.then === 'function') r.then(onRunning, (e) => fail(e && e.message ? e.message : '오디오 컨텍스트를 시작하지 못했습니다'));
        } catch (e) { fail(e && e.message ? e.message : '오디오 컨텍스트를 시작하지 못했습니다'); }
      }
      load(c);
    }

    function begin(id) {
      const at = actx.currentTime;
      const source = actx.createBufferSource();
      const envelope = actx.createGain();
      source.buffer = buffer;
      envelope.gain.setValueAtTime(0, at);
      envelope.gain.linearRampToValueAtTime(1, at + 0.004);
      source.connect(envelope);
      envelope.connect(master);
      const v = { source, envelope, id, started: at, offset: cursor };
      source.onended = () => {
        try { source.disconnect(); envelope.disconnect(); } catch (e) { /* 이미 끊김 */ }
        if (current === v) current = null;
      };
      current = v;
      source.start(at, cursor);
    }

    function apply() {
      if (!want || volume === 0 || error) { endCurrent(); return; }
      if (!actx) { unlock(); if (!actx || error) return; }
      if (actx.state !== 'running') {
        // 브라우저가 소리를 막고 있는 채로 판서만 흘러가면 조용히 지나가지 않고 알립니다.
        const now = performance.now();
        if (!blockedSince) blockedSince = now;
        else if (!blockedShown && now - blockedSince >= CHALK_BLOCKED_NOTE_SEC * 1000) {
          blockedShown = true;
          note('브라우저가 분필 소리 재생을 막고 있어요. 재생 버튼을 한 번 더 눌러 주세요.', 'info');
        }
        return;
      }
      if (!buffer) return;
      if (current && current.id === want.id && actx.currentTime - current.started < CHALK_SEGMENT_SEC) return;
      endCurrent();
      begin(want.id);
    }

    /** contact: { id } | null — 지금 펜이 닿아 있는 획. 같은 id 면 계속 울리고, 바뀌면 새 조각. */
    function update(contact) {
      want = contact || null;
      apply();
    }

    function setVolume(value) {
      const n = Number(value);
      volume = clamp(isFinite(n) ? n : CHALK_DEFAULT_VOLUME, 0, 100);
      if (master && actx) master.gain.setValueAtTime((CHALK_MAX_GAIN * volume) / 100, actx.currentTime);
      const shown = Math.round(volume);
      if (el.chalkVolume) { el.chalkVolume.value = String(shown); el.chalkVolume.setAttribute('aria-valuetext', shown + '퍼센트'); }
      if (el.chalkVolumeValue) el.chalkVolumeValue.value = shown + '%';
      apply();
    }

    /** 소리를 다시 켤 때: 이전 오류를 지우고 처음부터 다시 시도합니다. */
    function retry() {
      if (!error) return;
      error = '';
      loading = null;
      note('', '');
    }

    return { unlock, update, stop, setVolume, retry, state: () => ({ volume, ready: !!buffer, error }) };
  })();

  /* ---- 해설 음성: 단계마다 내장된 MP3 한 개. 오디오 시계(currentTime)가 판서의 기준입니다. ---- */
  let voice = null;
  try { voice = new Audio(); } catch (e) { voice = null; }
  if (voice) voice.preload = 'auto';
  let voiceEnabled = true;
  let voiceError = ''; // 이 단계에서 음성을 못 쓰게 된 이유 ('' 이면 정상). 다음 단계에서 다시 시도합니다.
  let voiceStarted = false; // 이 단계 음성 재생을 시작했고 아직 취소되지 않음
  let voiceDone = false; // 이 단계 음성을 끝까지 들었음(ended)
  let voiceToken = 0; // 단계 이동·정지 때마다 올려 늦게 도착하는 이벤트·약속을 무효화
  let audioLoaded = -1; // voice.src 가 가리키는 단계
  let selfPause = false; // 우리가 pause() 를 불러 곧 올 pause 이벤트를 무시해야 함
  let stallAt = -1;
  let stallFor = 0;
  let blockedByBrowser = false; // 브라우저가 재생을 막아(NotAllowedError) 멈춘 상태
  let hiddenPaused = false; // 탭이 가려져서 멈춘 상태

  const voiceUsable = () => voiceEnabled && !voiceError;
  const voiceFinished = () => !voiceUsable() || voiceDone;
  /** 오디오 시계가 판서 시계의 기준인가 */
  const voiceMaster = () => !!voice && voiceUsable() && voiceStarted && !voiceDone && audioLoaded === index && !voice.paused;

  function failVoice(token, message) {
    if (token !== voiceToken) return;
    voiceError = message;
    voiceStarted = false;
    voiceDone = false;
    audioLoaded = -1; // 다음 시도 때 다시 불러오기
    pauseAudio();
    setNote(el.voiceNote, '⚠ ' + VOICE_LABEL + ' 오디오 오류: ' + message + ' 판서와 자막으로 계속 진행합니다. 소리 없이 보려면 "해설 음성"을 끄세요.', 'error');
    updatePlayUI();
    refreshStatus();
  }

  function pauseAudio() {
    if (voice && !voice.paused) {
      selfPause = true;
      try { voice.pause(); } catch (e) { selfPause = false; }
    }
  }

  /** 이전 음성을 즉시 멈추고 늦게 오는 이벤트를 무효화합니다(단계 이동·음성 끄기). */
  function stopVoice() {
    voiceToken += 1;
    pauseAudio();
    voiceStarted = false;
  }

  function onPlayRejected(token, err) {
    if (token !== voiceToken) return;
    const name = err && err.name ? err.name : '';
    if (name === 'AbortError') return; // pause()·새 로드가 끼어든 정상 상황
    if (name === 'NotAllowedError') {
      // 사용자 동작 없이 재생이 막힌 경우: 오류가 아니므로 멈추고 한 번 더 누르게 안내합니다.
      // (이미 들은 부분이 있으면 voiceStarted 를 유지해 같은 자리에서 이어 재생합니다.)
      voiceStarted = audioLoaded === index && (voice.currentTime || 0) > 0.05 && !voiceDone;
      blockedByBrowser = true;
      setNote(el.voiceNote, '브라우저가 소리 재생을 막았어요. 재생 버튼을 한 번 더 눌러 주세요.', 'info');
      if (playing) pausePlayback();
      else { updatePlayUI(); refreshStatus(); }
      return;
    }
    failVoice(token, '파일을 재생하지 못했어요' + (name ? ' (' + name + ')' : '') + '.');
  }

  function playVoiceElement(token) {
    let pr;
    try { pr = voice.play(); } catch (e) { onPlayRejected(token, e); return; }
    if (pr && typeof pr.then === 'function') pr.then(null, (err) => onPlayRejected(token, err));
  }

  /** 이 단계 해설을 처음부터 재생합니다. */
  function startVoice() {
    voiceError = '';
    voiceDone = false;
    voiceStarted = true;
    stallAt = -1;
    stallFor = 0;
    const token = ++voiceToken;
    if (!voiceEnabled) { voiceStarted = false; return; }
    const raw = steps[index].raw;
    if (!voice) { failVoice(token, '이 브라우저는 오디오 재생을 지원하지 않아요.'); return; }
    if (typeof raw.audio !== 'string' || !raw.audio) { failVoice(token, '이 단계에는 내장된 해설 음성이 없어요.'); return; }
    blockedByBrowser = false;
    setNote(el.voiceNote, '', '');
    voice.defaultPlaybackRate = speed; // 새 src 를 불러오면 playbackRate 가 이 값으로 초기화됩니다
    if (audioLoaded !== index) {
      voice.src = raw.audio;
      audioLoaded = index;
    }
    try { voice.currentTime = 0; } catch (e) { /* 메타데이터 이전에는 무시 */ }
    voice.playbackRate = speed;
    playVoiceElement(token);
  }

  /** 멈췄던 해설을 같은 자리에서 이어서 재생합니다. 이어갈 음성이 없으면 false. */
  function resumeVoice() {
    if (!voice || !voiceUsable() || !voiceStarted || voiceDone || audioLoaded !== index) return false;
    stallAt = -1;
    stallFor = 0;
    blockedByBrowser = false;
    voice.defaultPlaybackRate = speed;
    voice.playbackRate = speed;
    playVoiceElement(voiceToken);
    return true;
  }

  /* 오디오 요소 하나를 모든 단계가 재사용하므로, 이전 클립(또는 같은 단계의 이전 재생)에서 늦게 도착한 ended·pause 이벤트가
   * 새 재생의 상태를 바꿀 수 있습니다(수동 이동·다시 재생 직후). DOM 이벤트에는 세대 표지를 실을 수 없으니, 이벤트가 전달되는
   * 시점의 요소 상태로 "지금 이 단계 클립이 정말 끝에 닿았는가"를 확인합니다. 새 클립은 처음부터(또는 재생 중) 이므로 거릅니다. */
  function clipReachedEnd() {
    if (!voice || audioLoaded !== index || !voice.ended) return false;
    const dur = steps[index].raw.audioDuration || 0;
    return dur <= 0 || (voice.currentTime || 0) >= dur - END_SLACK_SEC;
  }

  if (voice) {
    voice.addEventListener('ended', () => {
      if (!voiceStarted || !voiceUsable() || audioLoaded !== index) return;
      if (!clipReachedEnd()) return; // 이전 클립·이전 재생의 늦은 ended
      voiceDone = true;
      updatePlayUI();
      refreshStatus();
    });
    voice.addEventListener('error', () => {
      if (!voiceStarted || !voiceUsable() || audioLoaded !== index) return;
      const code = voice.error ? voice.error.code : 0;
      failVoice(voiceToken, '오디오 파일을 읽지 못했어요' + (code ? ' (코드 ' + code + ')' : '') + '.');
    });
    voice.addEventListener('pause', () => {
      if (selfPause) { selfPause = false; return; }
      if (!voice.paused) return; // 전달되는 사이에 이미 다시 재생 중: 이전 재생의 늦은 pause
      // 헤드셋·미디어 키 등 바깥에서 멈춘 경우 재생 상태를 맞춥니다.
      if (playing && voiceStarted && voiceUsable() && audioLoaded === index && !voice.ended && !voiceDone) pausePlayback();
    });
  }

  /** 음성이 "재생 중"이라는데 시계가 멈춰 있으면 조용히 서 있지 않고 오류로 알립니다. */
  function watchStall(dt) {
    if (!voiceMaster()) { stallAt = -1; stallFor = 0; return; }
    const ct = voice.currentTime || 0;
    if (ct > stallAt + 0.001) { stallAt = ct; stallFor = 0; return; }
    stallFor += dt;
    if (stallFor >= STALL_SEC) failVoice(voiceToken, '재생 시계가 멈췄어요.');
  }

  /* ====================================================================
   * 7. 렌더 · 재생
   * ==================================================================== */
  let index = 0;
  let t = 0; // 판서 시계(해설 시각, 초)
  let hold = 0; // 단계가 완료된 뒤 실제로 흐른 시간(초)
  let playing = false;
  let started = false;
  let ended = false; // 마지막 단계까지 마침
  let auto = true;
  let speed = 1;
  let reduced = false;
  let chalkEnabled = true;
  let lastTip = null;
  let penDown = false;
  let writingCharacter = '';
  let rafId = 0;
  let lastNow = null; // null: 다음 프레임의 rAF 타임스탬프를 기준점으로 삼음
  const visited = new Set([0]);

  const reducedQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  reduced = !!(reducedQuery && reducedQuery.matches);

  const stepEnd = () => steps[index].tl.animEnd;
  const effT = () => (reduced ? stepEnd() : t);
  const drawDone = () => reduced || t >= stepEnd() - 1e-6;
  /** 단계 완료 = 판서 끝 && 음성 끝(음성이 꺼져 있거나 오류면 판서 끝) */
  const isComplete = () => drawDone() && voiceFinished();
  /** 자동 넘김을 쓸 수 있는가: 줄어든 동작에서는 해설 음성만이 시간을 재 주므로 음성이 있어야 합니다. */
  const autoAvailable = () => !reduced || voiceUsable();

  function drawBoard(S, G, tt, tips) {
    if (G.kind === 'graph') drawGraph(S, G, tt, tips, reduced);
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

    // 펜: 지금 쓰고 있는 끝점(active) 중 가장 늦게 시작한 것. 접촉(contact)이 있을 때만 분필 소리가 납니다.
    penDown = false;
    writingCharacter = '';
    let contact = null;
    if (!reduced && started && tt < stepEnd() - 1e-6) {
      let pen = null;
      let rest = null;
      for (const tp of tips) {
        if (!rest || tp.start >= rest.start) rest = tp;
        if (tp.active && (!pen || tp.start >= pen.start)) pen = tp;
      }
      const pick = pen || rest;
      if (pick) lastTip = pick;
      penDown = !!(pen && pen.contact && playing);
      // 공백 위를 지날 때는 penDown=false 이면서 writingCharacter 가 ' ' 입니다(분필을 든 채 이동 → 무음).
      writingCharacter = pen && playing ? pen.character || '' : '';
      if (penDown) contact = { id: index + '|' + pen.unit };
      if (lastTip) drawChalkPiece(lastTip.x, lastTip.y, penDown, clamp(frame.W / 900, 0.7, 1));
    }
    chalk.update(chalkEnabled && contact ? contact : null);
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

  /**
   * 한 프레임(dt 실제 초)만큼 시계를 진행합니다.
   * - 음성이 재생 중이면 판서 시계는 오디오의 currentTime 을 따라가고(dt 를 더하지 않음 → 이중 계산 없음),
   * - 그렇지 않으면 자체 시계(dt × 속도)로 흐릅니다.
   * - 단계가 "완료"된 뒤 실제로 흐른 시간만 hold 에 쌓입니다(속도와 무관한 실제 0.9초).
   */
  function advance(dt) {
    const end = stepEnd();
    const wasComplete = isComplete();
    let leftover = 0; // 이번 프레임에서 판서가 끝난 뒤 남은 실제 시간
    watchStall(dt);
    if (reduced) {
      t = end;
    } else if (voiceMaster()) {
      t = clamp(Math.max(t, voice.currentTime || 0), 0, end);
    } else if (t < end) {
      const before = t;
      t = Math.min(end, t + dt * speed);
      if (t >= end - 1e-6) leftover = speed > 0 ? Math.max(0, dt - (end - before) / speed) : 0;
    }
    if (isComplete()) hold += wasComplete ? dt : leftover;
    else hold = 0;
  }

  /** 단계가 끝난 뒤의 행동: 마지막 단계면 마침, 자동 넘김이 꺼져 있으면 정지, 0.9초가 지나면 다음 단계. */
  function afterAdvance() {
    if (!isComplete()) return;
    if (index >= N - 1) { finishLesson(); return; }
    if (!auto || !autoAvailable()) { haltComplete(); return; }
    if (hold >= GAP_SEC - 1e-9) goTo(index + 1, { play: true });
  }

  function tick(now) {
    rafId = 0;
    if (!playing) return;
    if (lastNow === null) lastNow = now; // 첫 프레임은 기준점만 잡습니다(dt = 0)
    const dt = clamp((now - lastNow) / 1000, 0, MAX_FRAME_DT);
    lastNow = now;
    advance(dt);
    render();
    afterAdvance();
    refreshStatus();
    updatePlayUI();
    if (playing) schedule();
  }

  /** schedule 은 기준점(lastNow)을 건드리지 않습니다: 렌더에 걸린 시간도 다음 dt 에 포함됩니다. */
  function schedule() {
    if (rafId) return;
    rafId = requestAnimationFrame(tick);
  }
  function startLoop() {
    if (rafId) return;
    lastNow = null;
    schedule();
  }
  function stopLoop() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    lastNow = null;
  }

  /** 마지막 단계까지 마침: 모든 소리를 멈추고 "처음부터 재생"을 안내합니다. */
  function finishLesson() {
    ended = true;
    playing = false;
    hold = 0;
    stopLoop();
    chalk.stop();
    pauseAudio();
    render();
    updatePlayUI();
    refreshStatus();
  }

  /** 단계를 마쳤지만 자동 넘김이 꺼져 있어 멈춤. 다음 단계는 재생 버튼으로 직접 넘깁니다. */
  function haltComplete() {
    playing = false;
    hold = 0;
    stopLoop();
    chalk.stop();
    pauseAudio();
    render();
    updatePlayUI();
    refreshStatus();
  }

  /* ====================================================================
   * 8. 화면 갱신
   * ==================================================================== */
  const el = {
    status: byId('status'), time: byId('time'), progress: byId('progress'), fill: byId('progress-fill'),
    play: byId('play'), playLabel: byId('play-label'), playIcon: byId('play-icon'),
    prev: byId('prev'), next: byId('next'), replay: byId('replay'), restart: byId('restart'),
    autoToggle: byId('auto-toggle'), autoState: byId('auto-state'), speed: byId('speed'),
    voiceToggle: byId('voice-toggle'), voiceState: byId('voice-state'), voiceLabel: byId('voice-label'),
    voiceChip: byId('voice-chip-label'), voiceNote: byId('voice-note'),
    chalkToggle: byId('chalk-toggle'), chalkState: byId('chalk-state'), chalkNote: byId('chalk-note'),
    chalkVolume: byId('chalk-volume'), chalkVolumeValue: byId('chalk-volume-value'),
    hint: byId('board-hint'), hintText: byId('hint-text'),
    title: byId('board-title'), count: byId('board-count'), tag: byId('board-tag'), tagText: byId('board-tag-text'),
    legend: byId('legend'), chapters: byId('chapters'), summary: byId('summary'), beats: byId('beats'),
    callout: byId('callout'), calloutTitle: byId('callout-title'), calloutText: byId('callout-text'),
    captionToggle: byId('caption-toggle'), captionBody: byId('caption-body'), sr: byId('board-sr'),
    transcriptText: byId('transcript-text'),
    reducedNote: byId('reduced-note'),
  };

  const REDUCED_WITH_VOICE = '움직임 줄이기가 켜져 있어요. 판서 애니메이션 없이 완성된 칠판을 보여 주고 해설 음성만 재생합니다.';
  const REDUCED_NO_VOICE = '움직임 줄이기가 켜져 있어요. 완성된 칠판만 보여 주며, 해설 음성이 꺼져 있어 "자동 넘김"을 쓸 수 없어요. "다음 단계 보기"로 직접 넘겨 주세요.';

  /** 토글 버튼 하나의 aria-pressed·상태 글자를 맞춥니다. */
  function syncToggle(button, state, on) {
    if (button) button.setAttribute('aria-pressed', String(on));
    if (state) state.textContent = on ? '켬' : '끔';
  }

  /** 자동 넘김·해설 음성·분필 소리·줄어든 동작 안내를 현재 상태에 맞춥니다. */
  function syncControlsUI() {
    const availableAuto = autoAvailable();
    if (el.autoToggle) {
      el.autoToggle.setAttribute('aria-pressed', String(auto));
      el.autoToggle.setAttribute('aria-disabled', String(!availableAuto));
    }
    if (el.autoState) el.autoState.textContent = !availableAuto ? '불가' : auto ? '켬' : '끔';
    syncToggle(el.voiceToggle, el.voiceState, voiceEnabled);
    syncToggle(el.chalkToggle, el.chalkState, chalkEnabled);
    if (el.voiceLabel) el.voiceLabel.textContent = voiceEnabled ? VOICE_LABEL + ' (AI 합성)' : '해설 음성을 껐어요 · 판서와 설명 글만 진행합니다';
    if (el.voiceChip) el.voiceChip.textContent = VOICE_NAME ? VOICE_NAME + ' · ' + (PROVIDER.model || 'MAI-Voice-2') + ' (AI 합성)' : VOICE_LABEL;
    if (el.reducedNote) {
      el.reducedNote.hidden = !reduced;
      if (reduced) el.reducedNote.textContent = voiceUsable() ? REDUCED_WITH_VOICE : REDUCED_NO_VOICE;
    }
  }

  function updatePlayUI() {
    let label;
    let icon = 'play';
    const last = index >= N - 1;
    if (reduced && !voiceUsable() && !playing) label = last ? '처음부터 보기' : '다음 단계 보기';
    else if (playing) { label = '일시정지'; icon = 'pause'; }
    else if (ended || (started && isComplete() && last)) label = '처음부터 재생';
    else if (started && isComplete()) label = '다음 단계 재생';
    else if (voiceUsable() && drawDone() && !voiceStarted) label = '이 단계 재생';
    else if (voiceStarted || t > 0) label = '이어서 재생';
    else label = '재생';
    el.playLabel.textContent = label;
    byId('icon-play').hidden = icon !== 'play';
    byId('icon-pause').hidden = icon !== 'pause';
    el.play.setAttribute('aria-label', label);
    el.prev.setAttribute('aria-disabled', index === 0 ? 'true' : 'false');
    el.next.setAttribute('aria-disabled', index === N - 1 ? 'true' : 'false');
    el.hint.classList.toggle('is-off', started || reduced);
    el.hint.hidden = started || reduced;
  }

  /** 지금 무슨 일이 벌어지는지 한 줄로 알려 줍니다. 판서가 끝난 뒤에는 절대 '판서 중'이라고 하지 않습니다. */
  function statusMessage() {
    const n = index + 1;
    const last = index >= N - 1;
    const voiceBad = voiceEnabled && !!voiceError;
    if (ended) return '마지막 단계까지 마쳤어요 · 처음부터 다시 보려면 재생을 누르세요';
    if (hiddenPaused && !playing) return '탭이 가려져 일시정지했어요 · 돌아와서 재생을 누르세요';
    if (blockedByBrowser && !playing) return n + '단계 · 브라우저가 소리 재생을 막았어요. 재생 버튼을 눌러 주세요';
    if (!started) {
      if (reduced) return '재생 버튼을 누르면 해설 음성이 시작돼요 (완성된 칠판을 보여 드려요)';
      return voiceEnabled ? '재생 버튼을 누르면 판서와 해설 음성이 시작돼요' : '재생 버튼을 누르면 판서가 시작돼요 (해설 음성은 꺼져 있어요)';
    }
    if (playing) {
      if (isComplete()) return n + '단계 완료 · ' + GAP_SEC + '초 뒤 다음 단계로 넘어가요';
      if (!drawDone()) return n + '단계 판서 중' + (voiceBad ? ' · 해설 음성 오류로 소리 없이 진행해요' : '');
      return reduced ? n + '단계 · 완성된 칠판을 보며 해설을 듣는 중' : n + '단계 판서 완료 · 해설을 마저 듣는 중';
    }
    if (isComplete()) {
      if (last) return n + '단계 완료 · 마지막 단계예요';
      if (!auto) return n + '단계 완료 · 자동 넘김이 꺼져 있어요. 재생을 누르면 다음 단계로 가요';
      if (!autoAvailable()) return n + '단계 완료 · 자동 넘김을 쓸 수 없어요. "다음 단계 보기"로 직접 넘겨 주세요';
      return n + '단계 완료';
    }
    if (drawDone() && voiceUsable()) return n + '단계 판서 완료 · 재생을 누르면 해설을 들려드려요';
    return n + '단계 일시정지' + (voiceBad ? ' · 해설 음성 오류' : '');
  }

  function refreshStatus() {
    const msg = statusMessage();
    if (el.status.textContent !== msg) el.status.textContent = msg;
  }

  let lastPct = -1;
  let lastBeat = -2;
  let lastClock = '';
  function updateProgressUI() {
    const S = steps[index];
    const tt = effT();
    // 음성이 있으면 진행 막대와 시간은 해설 음성의 길이를 기준으로 보여 줍니다(판서는 그 앞부분에서 끝나요).
    const dur = S.raw.audioDuration || 0;
    let frac;
    let clock;
    if (voiceUsable() && dur > 0) {
      const ct = audioLoaded === index && voice ? voice.currentTime || 0 : 0;
      const cur = voiceDone ? dur : clamp(ct, 0, dur);
      frac = clamp(cur / dur, 0, 1);
      clock = formatClock(cur) + ' / ' + formatClock(dur);
    } else {
      frac = S.tl.animEnd > 0 ? clamp(tt / S.tl.animEnd, 0, 1) : 1;
      clock = formatClock(tt) + ' / ' + formatClock(S.tl.animEnd);
    }
    el.fill.style.transform = 'scaleX(' + frac.toFixed(4) + ')';
    const pct = Math.round(frac * 100);
    if (pct !== lastPct) {
      lastPct = pct;
      el.progress.setAttribute('aria-valuenow', String(pct));
      el.progress.setAttribute('aria-valuetext', pct + '%');
    }
    if (clock !== lastClock) {
      lastClock = clock;
      el.time.textContent = clock;
    }
    // 설명 순서 강조
    const beats = S.raw.beats;
    const done = drawDone();
    let active = -1;
    if (!done) for (let i = 0; i < beats.length; i++) if (beats[i].at <= tt) active = i;
    const key = done ? beats.length : active;
    if (key !== lastBeat) {
      lastBeat = key;
      [...el.beats.children].forEach((li, i) => {
        const state = done ? 'past' : i < active ? 'past' : i === active ? 'active' : 'future';
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
      renderRich(tx, item.text);
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
    renderRich(el.title, S.raw.title);
    el.count.textContent = (index + 1) + ' / ' + N;
    el.tag.textContent = TONE_LABEL[S.raw.tag.tone] || '';
    el.tag.dataset.tone = S.raw.tag.tone;
    if (el.tagText) el.tagText.textContent = S.raw.tag.text;
    renderRich(el.summary, S.raw.summary);
    const frag = document.createDocumentFragment();
    S.raw.beats.forEach((b) => {
      const li = document.createElement('li');
      renderRich(li, b.text);
      frag.appendChild(li);
    });
    el.beats.replaceChildren(frag);
    lastBeat = -2;
    el.callout.dataset.tone = S.raw.callout.tone;
    renderRich(el.calloutTitle, S.raw.callout.title);
    renderRich(el.calloutText, S.raw.callout.text);
    buildLegend(S);
    canvas.setAttribute('aria-label', '칠판 ' + (index + 1) + '단계: ' + S.titleText);
    el.sr.textContent = S.altText;
    if (el.transcriptText) el.transcriptText.textContent = S.raw.narration || '';
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
      renderRich(h, m.title);
      const p = document.createElement('p');
      p.className = 'mis-text';
      renderRich(p, m.text);
      li.append(h, p);
      frag.appendChild(li);
    }
    mis.replaceChildren(frag);
    const refs = byId('ref-list');
    const rf = document.createDocumentFragment();
    for (const r of DATA.references) {
      const li = document.createElement('li');
      renderRich(li, r);
      rf.appendChild(li);
    }
    refs.replaceChildren(rf);
  }

  /* ====================================================================
   * 9. 조작
   * ==================================================================== */
  /**
   * 단계 i 로 들어갑니다. 이전 단계의 음성·분필 소리·시계는 모두 여기서 끊습니다.
   * wantPlay 가 참이면 처음부터 판서와 해설을 함께 시작하고, 아니면 완성된 칠판을 멈춘 채 보여 줍니다.
   */
  function enterStep(i, wantPlay) {
    stopVoice();
    chalk.stop();
    stopLoop();
    index = clamp(i, 0, N - 1);
    ended = false;
    hold = 0;
    lastTip = null;
    penDown = false;
    writingCharacter = '';
    voiceDone = false;
    voiceError = '';
    voiceStarted = false;
    blockedByBrowser = false;
    hiddenPaused = false;
    stallAt = -1;
    stallFor = 0;
    setNote(el.voiceNote, '', '');
    visited.add(index);
    started = true;
    playing = !!wantPlay && autoAvailable();
    t = wantPlay && !reduced ? 0 : stepEnd();
    updateStepUI();
    if (playing) {
      startVoice();
      startLoop();
    }
    syncControlsUI();
    updatePlayUI();
    refreshStatus();
    render();
  }

  /** 사용자가 고른 단계로 이동. 재생 중이었다면 새 단계를 처음부터 재생합니다. */
  function goTo(i, opts) {
    const o = opts || {};
    enterStep(i, o.play !== undefined ? o.play : playing);
  }

  function play() {
    // 재생 버튼은 사용자 동작이므로, 막혀 있던 AudioContext 를 여기서 다시 깨웁니다(누를 때마다 재시도).
    if (chalkEnabled && !reduced) chalk.unlock();
    if (playing) return;
    const nextIndex = index < N - 1 ? index + 1 : 0;
    if (ended) { enterStep(0, true); return; }
    if (reduced && !voiceUsable()) { enterStep(nextIndex, false); return; }
    if (started && isComplete()) { enterStep(nextIndex, true); return; }
    hiddenPaused = false;
    if (voiceUsable() && voiceStarted && !voiceDone) {
      // 해설을 듣다 멈춘 상태: 같은 자리에서 이어서
      playing = true;
      started = true;
      hold = 0;
      if (!resumeVoice()) { playing = false; enterStep(index, true); return; }
      blockedByBrowser = false;
      startLoop();
      updatePlayUI();
      refreshStatus();
      return;
    }
    if (voiceUsable() && !voiceStarted) { enterStep(index, true); return; }
    // 음성이 꺼졌거나 오류인 단계: 판서만 자체 시계로 이어갑니다.
    playing = true;
    started = true;
    hold = 0;
    startLoop();
    updatePlayUI();
    refreshStatus();
  }

  /** 재생을 멈춥니다. 음성과 분필 소리도 함께 무음이 됩니다. */
  function pausePlayback() {
    if (!playing) return;
    playing = false;
    hold = 0;
    stopLoop();
    chalk.stop();
    pauseAudio();
    render();
    updatePlayUI();
    refreshStatus();
  }
  const pause = pausePlayback;
  const toggle = () => (playing ? pausePlayback() : play());
  const next = () => { if (index < N - 1) goTo(index + 1); };
  const prev = () => { if (index > 0) goTo(index - 1); };
  const replay = () => enterStep(index, true);
  const restart = () => enterStep(0, true);

  /** 자동 넘김. 켜는 순간 이미 완료되어 멈춰 있던 단계라면 바로 다음 단계로 가는 카운트를 이어갑니다. */
  function setAuto(on) {
    auto = !!on;
    if (auto) {
      if (!playing && started && !ended && isComplete() && index < N - 1 && autoAvailable()) {
        playing = true;
        hold = 0;
        startLoop();
      }
    } else if (playing && isComplete()) {
      haltComplete();
    }
    syncControlsUI();
    updatePlayUI();
    refreshStatus();
  }

  function setSpeed(v) {
    const n = Number(v);
    if (!SPEEDS.includes(n)) return;
    speed = n;
    el.speed.value = String(n);
    if (voice) {
      voice.defaultPlaybackRate = n;
      voice.playbackRate = n;
    }
  }

  /** 해설 음성 켜기/끄기. 끄면 판서는 자체 시계로 계속 가고, 켜면(재생 중이라면) 이 단계를 해설과 함께 처음부터 다시 시작합니다. */
  function setVoiceEnabled(on) {
    const want = !!on;
    if (want === voiceEnabled) { syncControlsUI(); return; }
    voiceEnabled = want;
    if (!want) {
      stopVoice();
      voiceDone = false;
      voiceError = '';
      blockedByBrowser = false;
      stallAt = -1;
      stallFor = 0;
      setNote(el.voiceNote, '', '');
      if (reduced && playing) {
        playing = false;
        hold = 0;
        stopLoop();
        chalk.stop();
      }
    } else if (playing) {
      enterStep(index, true);
      return;
    }
    syncControlsUI();
    updatePlayUI();
    refreshStatus();
    render();
  }

  /** 분필 소리 켜기/끄기 */
  function setChalkEnabled(on) {
    chalkEnabled = !!on;
    syncControlsUI();
    if (!chalkEnabled) {
      chalk.stop();
      setNote(el.chalkNote, '', '');
    } else {
      chalk.retry();
      if (playing && !reduced) chalk.unlock(); // 토글 클릭은 사용자 동작입니다
    }
    render();
  }

  /** 분필 소리 크기 0–100 (기본 25) */
  function setChalkVolume(v) {
    chalk.setVolume(v);
  }

  /** 테스트·점검용: 단계 i의 시각 tt(초 또는 'end')로 이동해 멈춘 채 그립니다. */
  function seek(i, tt) {
    stopVoice();
    chalk.stop();
    stopLoop();
    index = clamp(i, 0, N - 1);
    playing = false;
    started = true;
    ended = false;
    hold = 0;
    lastTip = null;
    voiceDone = false;
    voiceError = '';
    blockedByBrowser = false;
    hiddenPaused = false;
    setNote(el.voiceNote, '', '');
    visited.add(index);
    t = tt === 'end' || tt === undefined ? stepEnd() : clamp(Number(tt), 0, stepEnd());
    updateStepUI();
    syncControlsUI();
    updatePlayUI();
    refreshStatus();
    render();
  }

  /** 탭이 가려지면 일시정지(음성·분필 소리까지 무음), 페이지를 떠날 때는 모든 소리를 확실히 끕니다. */
  function onVisibility() {
    if (document.hidden && playing) {
      hiddenPaused = true;
      pausePlayback();
    }
  }
  function onPageHide() {
    hiddenPaused = true;
    if (playing) pausePlayback();
    chalk.stop();
    pauseAudio();
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
    ensureFonts();
  }

  /** 시스템의 "움직임 줄이기" 설정이 도중에 바뀐 경우. 재생 중인 해설 음성은 끊지 않습니다. */
  function onMotionChange() {
    reduced = !!(reducedQuery && reducedQuery.matches);
    if (reduced) {
      t = stepEnd();
      started = true;
      chalk.stop();
      if (playing && !voiceUsable()) {
        playing = false;
        hold = 0;
        stopLoop();
        pauseAudio();
      }
    }
    syncControlsUI();
    updatePlayUI();
    refreshStatus();
    render();
  }

  /* ====================================================================
   * 10. 공개 API · 시작
   * ==================================================================== */
  function getState() {
    const S = steps[index];
    const G = frame ? frame.geoms[index] : null;
    const tt = effT();
    const cs = chalk.state();
    const voiceMode = !voiceEnabled ? 'off' : voiceError ? 'error' : voiceStarted ? 'embedded' : 'idle';
    const dur = S.raw.audioDuration || 0;
    let progress;
    if (voiceUsable() && dur > 0) {
      const ct = audioLoaded === index && voice ? voice.currentTime || 0 : 0;
      progress = voiceDone ? 1 : clamp(ct / dur, 0, 1);
    } else {
      progress = S.tl.animEnd > 0 ? clamp(tt / S.tl.animEnd, 0, 1) : 1;
    }
    return {
      ready: !!frame,
      index, count: N, id: S.id, kind: S.kind,
      playing, started, ended, reduced, auto, autoAvailable: autoAvailable(), speed,
      t: Number(tt.toFixed(3)), animEnd: Number(S.tl.animEnd.toFixed(3)),
      complete: isComplete(), drawDone: drawDone(), drawing: playing && !drawDone() && !reduced,
      hold: Number(hold.toFixed(3)), holdEnd: GAP_SEC,
      voiceEnabled, chalkEnabled, voiceMode, voiceDone: voiceFinished(), voiceError,
      audioTime: audioLoaded === index && voice ? Number((voice.currentTime || 0).toFixed(3)) : 0,
      audioDuration: dur,
      penDown, writingCharacter,
      chalkVolume: cs.volume, chalkReady: cs.ready, chalkError: cs.error,
      progress,
      canvas: frame ? { cssW: frame.W, cssH: Math.ceil(frame.wide ? frame.H : frame.stepH[index]), dpr, wide: frame.wide } : null,
      plot: G && G.kind === 'graph'
        ? { kind: G.kind, xPxPerUnit: G.xPxPerUnit, yPxPerUnit: G.yPxPerUnit, rect: G.rect, view: G.view }
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

  window.quantumPlayer = {
    getState, layoutReport, goTo, play, pause, toggle, next, prev, replay, restart, seek, setSpeed, setAuto,
    setVoiceEnabled, setChalkEnabled, setChalkVolume,
    get steps() { return steps.map((S) => S.id); },
  };

  function init() {
    renderRich(byId('lesson-title'), DATA.title);
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
    el.autoToggle.addEventListener('click', () => {
      if (!autoAvailable()) return; // 줄어든 동작 + 해설 음성 없음: 시간을 재 줄 시계가 없어 비활성
      setAuto(el.autoToggle.getAttribute('aria-pressed') !== 'true');
    });
    if (el.voiceToggle) el.voiceToggle.addEventListener('click', () => setVoiceEnabled(el.voiceToggle.getAttribute('aria-pressed') !== 'true'));
    if (el.chalkToggle) el.chalkToggle.addEventListener('click', () => setChalkEnabled(el.chalkToggle.getAttribute('aria-pressed') !== 'true'));
    if (el.chalkVolume) {
      const onVolume = () => setChalkVolume(el.chalkVolume.value);
      el.chalkVolume.addEventListener('input', onVolume);
      el.chalkVolume.addEventListener('change', onVolume);
    }
    el.speed.addEventListener('change', () => setSpeed(el.speed.value));
    el.captionToggle.addEventListener('click', () => {
      const open = el.captionBody.hidden;
      el.captionBody.hidden = !open;
      el.captionToggle.setAttribute('aria-expanded', String(open));
      el.captionToggle.textContent = open ? '설명 접기' : '설명 펼치기';
    });
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    if (reducedQuery && reducedQuery.addEventListener) reducedQuery.addEventListener('change', onMotionChange);
    window.addEventListener('resize', onResize);
    if (window.ResizeObserver) new ResizeObserver(onResize).observe(byId('board-stage'));
    window.addEventListener('hashchange', () => {
      const n = parseInt(location.hash.slice(1), 10);
      if (n >= 1 && n <= N && n - 1 !== index) goTo(n - 1);
    });

    const n0 = parseInt(location.hash.slice(1), 10);
    if (n0 >= 1 && n0 <= N) index = n0 - 1;
    visited.add(index);
    chalk.setVolume(CHALK_DEFAULT_VOLUME);
    layoutAll();
    lastW = frame.W;
    t = reduced ? stepEnd() : 0;
    syncControlsUI();
    updateStepUI();
    updatePlayUI();
    refreshStatus();
    render();
    // 손글씨 글꼴(NanumPenScript)과 수학 글꼴(QMath)이 준비되면 글자 폭이 달라지므로 한 번 더 배치합니다.
    ensureFonts();
    // 브라우저가 내장 글꼴을 도중에 비웠다가(창 크기·미디어 쿼리 변경 등) 다시 읽어 들이면, 멈춰 있는 칠판도 새 글꼴로 다시 그립니다.
    if (document.fonts && document.fonts.addEventListener) {
      document.fonts.addEventListener('loadingdone', () => { layoutAll(); render(); });
    }
  }

  const FONT_SAMPLE = '가나다ABC123ψħλν⟩∫√≥';
  function ensureFonts() {
    if (!document.fonts || !document.fonts.load) return;
    Promise.all([document.fonts.load('30px NanumPenScript', FONT_SAMPLE), document.fonts.load('30px QMath', FONT_SAMPLE)]).then(() => {
      layoutAll();
      render();
    }).catch(() => { /* 글꼴을 못 읽어도 대체 글꼴로 계속합니다 */ });
  }

  init();
})();
