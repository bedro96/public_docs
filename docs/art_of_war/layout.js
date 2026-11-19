/* 칠판 배치 — DOM 없이 도는 순수 계산 모듈 (재생기·빌드 검사·시험이 함께 씁니다).
 *
 * 하는 일
 *   1. 시간표: 장면의 모든 요소가 언제(해설 길이에 대한 비율 at + 요소 안의 초 단위 오프셋) 쓰이는지 정합니다.
 *      오프셋은 요소의 종류와 글자 수에만 달려 있고 화면 크기와 무관합니다 → 화면이 바뀌어도 판서 길이가 같습니다.
 *   2. 글 배치: 줄바꿈, 크기 줄이기(바닥 크기까지), 넘침 표시.
 *   3. 보드 배치: diagram / timeline / ladder / radial / table / compare 를 "그리기 조각(prim)"으로 풀어 줍니다.
 *      조각은 poly(선·도형) / text / dot / band 네 가지뿐이라 draw 쪽은 이 넷만 알면 됩니다.
 *   4. 단계 계획(planStep): 넓은 화면(그림 왼쪽 + 글 오른쪽) / 좁은 화면(위아래로 쌓기) 틀을 정합니다.
 *
 * 글 너비는 measure(text, px) 로 주입합니다: 브라우저에서는 canvas measureText, 빌드 검사에서는 글꼴 폭 표.
 * 이 파일은 window.ArtLayout 과 module.exports 를 모두 내보냅니다(브라우저·Node 겸용).
 */
(function (root) {
  'use strict';

  const VW = 160;
  const VH = 100;
  const WIDE_MIN = 1000;
  /** 넓은 화면에서 칠판이 차지하는 가로 비율 후보(글이 많은 그림은 뒤쪽 값까지 시도) */
  const WIDE_RATIOS = [0.62, 0.68, 0.74];
  const COLORS = { white: '#f3f0e4', mint: '#86efc6', yellow: '#ffe27d', pink: '#ff9fc4', sky: '#8fd3ff', orange: '#ffb067' };
  const TEXT_UNITS = { s: 3.5, m: 4.2, l: 5.2, xl: 6.6 }; // 가상 좌표 단위 (px = 단위 × 칠판 가로 배율) — 한자 기준 크기, 한글은 KO_BOOST 배
  const TEXT_FLOOR = { s: 13.5, m: 15, l: 17, xl: 21 };
  const TEXT_CAP = { s: 16, m: 20, l: 26, xl: 34 };
  const PANEL_SIZES = { xl: 27, l: 22.5, m: 19, s: 16 };
  const STRETCH = { diagram: 1.4, timeline: 1.35, ladder: 1.7, radial: 1.5, table: 1.5, compare: 1.6 }; // 좁은 화면에서 칠판을 세로로 늘리는 배율
  const CHARS_PER_SEC = 6.9; // 해설 음성의 평균 속도(글자/초). 음성 길이를 모를 때 추정에 씁니다.

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const HAN_RE = /\p{Script=Han}/u;
  const HANGUL_RE = /[가-힣]/;
  const chars = (s) => Array.from(String(s));

  /* ====================================================================
   * 1. 시간표
   * ==================================================================== */
  function charSec(ch) {
    if (/\s/.test(ch)) return 0.03;
    if (HANGUL_RE.test(ch)) return 0.075;
    if (HAN_RE.test(ch)) return 0.13;
    return 0.05;
  }
  function textSec(text) {
    let s = 0.1;
    for (const ch of chars(text)) s += charSec(ch);
    return s;
  }
  const hanSec = (text) => textSec(text) * 1.25; // 한자는 천천히 한 글자씩 또박또박

  function estimateDuration(narration) {
    return clamp(chars(narration || '').length / CHARS_PER_SEC, 6, 150);
  }

  /** [시작, 끝) 구간을 차례로 이어 붙이는 도우미: seq.add(길이) → [시작, 끝] */
  function sequence(start) {
    let c = start || 0;
    return { add(d) { const a = c; c += d; return [a, c]; }, get end() { return c; } };
  }

  /** 요소 하나의 내부 시간표(초). 모든 값은 글자 수·종류에서만 나옵니다. end 는 요소가 완전히 쓰이는 시각. */
  function elementTimes(el) {
    const out = {};
    const stack = (seq, item) => {
      if (item.han) out.han = seq.add(hanSec(item.han));
      if (item.title) out.title = seq.add(textSec(item.title));
      const lines = item.lines || (item.line ? [item.line] : []);
      out.lines = lines.map((l) => seq.add(textSec(l)));
    };
    let seq;
    switch (el.type) {
      case 'region': {
        out.shape = [0, 0.9];
        seq = sequence(0.5);
        if (el.label) out.label = seq.add(textSec(el.label));
        out.end = Math.max(0.9, seq.end);
        break;
      }
      case 'node': {
        out.shape = [0, 0.6];
        seq = sequence(0.55);
        stack(seq, el);
        out.end = seq.end;
        break;
      }
      case 'link': {
        out.line = [0, 0.65];
        seq = sequence(0.6);
        if (el.label) out.label = seq.add(textSec(el.label));
        out.end = Math.max(0.65, seq.end);
        break;
      }
      case 'text': {
        out.text = [0, textSec(el.text)];
        out.end = out.text[1];
        break;
      }
      case 'span': {
        out.shape = [0, 0.7];
        seq = sequence(0.4);
        out.title = seq.add(textSec((el.title || '') + (el.uncertain ? ' ?' : '')));
        out.end = Math.max(0.7, seq.end);
        break;
      }
      case 'event': {
        out.shape = [0, 0.35];
        seq = sequence(0.3);
        out.title = seq.add(textSec((el.title || '') + (el.uncertain ? ' ?' : '')));
        out.sub = el.sub ? seq.add(textSec(el.sub)) : null;
        out.end = seq.end;
        break;
      }
      case 'tier': {
        out.shape = [0, 0.55];
        seq = sequence(0.45);
        stack(seq, el);
        out.end = seq.end;
        break;
      }
      case 'center': {
        out.shape = [0, 0.7];
        seq = sequence(0.6);
        stack(seq, el);
        out.end = seq.end;
        break;
      }
      case 'spoke': {
        out.link = [0, 0.4];
        out.shape = [0.3, 0.85];
        seq = sequence(0.8);
        stack(seq, el);
        out.end = seq.end;
        break;
      }
      case 'row': {
        out.band = [0, 0.3];
        seq = sequence(0.25);
        out.cells = el.cells.map((c) => seq.add(textSec(c)));
        out.end = seq.end;
        break;
      }
      case 'pair': {
        out.pill = [0, 0.2 + textSec(el.label)];
        seq = sequence(out.pill[1]);
        out.left = seq.add(textSec(el.left));
        out.right = seq.add(textSec(el.right));
        out.end = seq.end;
        break;
      }
      default:
        out.end = 0.5;
    }
    return out;
  }

  /** at(비율)가 0 인 "칠판 틀" 요소(축, 머리글, 사다리 레일, 비교 머리)의 시간표 */
  function staticTimes(board) {
    const out = { end: 0 };
    if (board.kind === 'timeline') {
      out.axis = [0, 1.0];
      const n = Math.floor((board.axis.to - board.axis.from) / board.axis.step) + 1;
      out.ticks = [];
      for (let i = 0; i < n; i++) out.ticks.push([0.5 + 0.08 * i, 0.5 + 0.08 * i + 0.25]);
      out.end = Math.max(out.axis[1], out.ticks.length ? out.ticks[out.ticks.length - 1][1] : 0);
    } else if (board.kind === 'ladder') {
      const seq = sequence(0);
      out.rail = seq.add(0.8);
      out.top = [0.2, 0.2 + textSec(board.top)];
      out.bottom = [0.5, 0.5 + textSec(board.bottom)];
      out.end = Math.max(out.rail[1], out.top[1], out.bottom[1]);
    } else if (board.kind === 'table') {
      const seq = sequence(0);
      out.header = board.cols.map((c) => seq.add(textSec(c)));
      out.rule = [0, seq.end];
      out.end = seq.end;
    } else if (board.kind === 'compare') {
      const seq = sequence(0);
      out.left = seq.add(0.3 + textSec(board.left.title));
      out.right = seq.add(0.3 + textSec(board.right.title));
      out.end = seq.end;
    }
    return out;
  }

  /** 단계의 모든 칠판 요소 [{at, end}] — 화면 크기와 무관. 해설 길이 D(초)가 정해지면 끝 시각이 나옵니다. */
  function stepItems(raw) {
    const items = [];
    const board = raw.board;
    const st = staticTimes(board);
    items.push({ at: 0, end: st.end });
    if (raw.han) items.push({ at: 0, end: 0.15 + hanSec(raw.han) });
    const els = board.elements.slice();
    if (board.kind === 'radial' && board.center) els.push(Object.assign({ type: 'center' }, board.center));
    for (const el of els) items.push({ at: el.at, end: elementTimes(el).end });
    (raw.panel || []).forEach((p) => items.push({ at: p.at, end: textSec(p.text) }));
    return items;
  }

  /** 판서가 모두 끝나는 시각(초). D 는 해설 길이(실제 음성 또는 추정). */
  function stepEnd(raw, D) {
    let end = 0;
    for (const it of stepItems(raw)) end = Math.max(end, it.at * D + it.end);
    return end;
  }

  /* ====================================================================
   * 2. 글 배치
   * ==================================================================== */
  let uidSeq = 0;

  /**
   * 글 크기: 같은 크기(px)에서 나눔손글씨 펜의 한글은 한자(명조)보다 훨씬 작게 보입니다.
   * 그래서 px 는 "한자 기준 크기"이고, 한글·숫자·기호 같은 한자 아닌 글자는 KO_BOOST 배 큰 글꼴로 씁니다.
   * 모든 폭 계산(measure)과 그리기(draw.js)가 같은 규칙(글자 종류별 덩어리)을 씁니다.
   */
  const KO_BOOST = 1.75;
  function splitRuns(text) {
    const out = [];
    for (const ch of chars(text)) {
      const han = HAN_RE.test(ch);
      const last = out[out.length - 1];
      if (last && last.han === han) last.t += ch; else out.push({ t: ch, han });
    }
    return out;
  }
  /** 한자 아닌 글자(공백 제외)가 하나라도 있으면 줄 높이·밑줄 기준은 큰 글꼴을 따릅니다. */
  const hasKo = (text) => splitRuns(text).some((r) => !r.han && r.t.trim() !== '');
  const boostMemo = new WeakMap();
  /** 한 글꼴 기준 measure(text, px) → 한자/그 밖의 덩어리별로 크기를 달리한 measure. 이미 처리된 것은 그대로 돌려줍니다. */
  function boosted(measure) {
    if (measure.isBoosted) return measure;
    let m = boostMemo.get(measure);
    if (!m) {
      m = (text, px) => {
        let w = 0;
        for (const r of splitRuns(text)) w += measure(r.t, r.han ? px : px * KO_BOOST);
        return w;
      };
      m.isBoosted = true;
      boostMemo.set(measure, m);
    }
    return m;
  }

  function wrapText(text, px, maxW, measure0) {
    const measure = boosted(measure0);
    const src = String(text).replace(/\s+/g, ' ').trim();
    const lines = [];
    let cur = '';
    for (const word of src.split(' ')) {
      const cand = cur ? cur + ' ' + word : word;
      if (measure(cand, px) <= maxW) { cur = cand; continue; }
      if (cur) { lines.push(cur); cur = ''; }
      if (measure(word, px) <= maxW) { cur = word; continue; }
      let piece = '';
      for (const ch of chars(word)) {
        if (piece && measure(piece + ch, px) > maxW) { lines.push(piece); piece = ch; } else piece += ch;
      }
      cur = piece;
    }
    if (cur) lines.push(cur);
    if (!lines.length) lines.push('');
    return lines.map((t) => ({ text: t, w: measure(t, px), n: chars(t).length }));
  }

  /** 글 덩어리: { text, lines:[{text,w,n}], px(한자 기준), fpx(가장 큰 글꼴), ko(한자 아닌 글자 포함), lh, w, h, n, overflow, uid }
   *  나눔손글씨 펜은 글자가 em 상자 안에서 작게 앉아 있어서 한글 줄 간격은 글꼴 크기의 1.05배면 충분합니다(한자는 1.2배). */
  function layoutText(text, px, maxW, measure, o) {
    const opt = o || {};
    const ko = hasKo(text);
    const fpx = ko ? px * KO_BOOST : px;
    const lh = fpx * (opt.lh || (ko ? 1.05 : 1.2));
    const lines = wrapText(text, px, Math.max(8, maxW), measure);
    let w = 0;
    let n = 0;
    for (const l of lines) { w = Math.max(w, l.w); n += l.n; }
    return { text: String(text), lines, px, fpx, ko, lh, w, h: lines.length * lh, n, overflow: w > maxW + 0.5, uid: ++uidSeq };
  }

  /** 글이 상자(maxW × maxH)에 들어가도록 px 를 바닥 크기까지 줄입니다. */
  function fitText(text, px0, floor, maxW, maxH, measure, o) {
    let px = px0;
    let T = layoutText(text, px, maxW, measure, o);
    while ((T.overflow || T.h > maxH + 0.5) && px > floor + 0.01) {
      px = Math.max(floor, px * 0.94);
      T = layoutText(text, px, maxW, measure, o);
    }
    T.fitted = !(T.overflow || T.h > maxH + 0.5);
    return T;
  }

  /**
   * 한 노드 안의 글 쌓기: [{key, text, px, floor, color}] 을 같은 비율 f 로 줄여 상자에 맞춥니다.
   * 반환: { items:[{...item, T, y}], h, overflow, f }
   */
  function fitStack(list, maxW, maxH, measure, gap) {
    const g = gap === undefined ? 3 : gap;
    let f = 1;
    let res = null;
    for (let guard = 0; guard < 40; guard++) {
      const items = list.map((it) => {
        const px = Math.max(it.floor, it.px * f);
        return Object.assign({}, it, { T: layoutText(it.text, px, maxW, measure) });
      });
      let h = 0;
      let bad = false;
      items.forEach((it, k) => { it.y = h; h += it.T.h + (k < items.length - 1 ? g : 0); if (it.T.overflow) bad = true; });
      res = { items, h, overflow: bad || h > maxH + 0.5, f };
      if (!res.overflow) return res;
      const atFloor = list.every((it) => it.px * f <= it.floor + 0.01);
      if (atFloor) return res;
      f *= 0.94;
    }
    return res;
  }

  /* ====================================================================
   * 3. 도형 도우미
   * ==================================================================== */
  function polyLength(pts) {
    let len = 0;
    const cum = [0];
    for (let i = 1; i < pts.length; i++) {
      len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      cum.push(len);
    }
    return { len, cum };
  }

  function roundRectPts(x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    const pts = [];
    const arc = (cx, cy, a0) => { for (let k = 0; k <= 5; k++) { const a = a0 + (k / 5) * (Math.PI / 2); pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); } };
    arc(x + w - rr, y + rr, -Math.PI / 2);
    arc(x + w - rr, y + h - rr, 0);
    arc(x + rr, y + h - rr, Math.PI / 2);
    arc(x + rr, y + rr, Math.PI);
    pts.push(pts[0].slice());
    return pts;
  }
  function ellipsePts(cx, cy, rx, ry, n) {
    const pts = [];
    const m = n || 48;
    for (let k = 0; k <= m; k++) { const a = -Math.PI / 2 + (k / m) * Math.PI * 2; pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
    return pts;
  }
  function hexPts(cx, cy, w, h) {
    const p = [[cx - w / 2, cy], [cx - w / 4, cy - h / 2], [cx + w / 4, cy - h / 2], [cx + w / 2, cy], [cx + w / 4, cy + h / 2], [cx - w / 4, cy + h / 2]];
    p.push(p[0].slice());
    return p;
  }
  function rectPts(x, y, w, h) {
    return [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
  }

  /** 도형의 바깥선과 글이 들어갈 안쪽 상자 비율 */
  function shapeOutline(shape, cx, cy, w, h) {
    switch (shape) {
      case 'ellipse': return { pts: ellipsePts(cx, cy, w / 2, h / 2), inner: [0.74, 0.72] };
      case 'circle': { const d = Math.min(w, h); return { pts: ellipsePts(cx, cy, d / 2, d / 2), inner: [0.72, 0.72], w: d, h: d }; }
      case 'hex': return { pts: hexPts(cx, cy, w, h), inner: [0.8, 0.88] };
      case 'round': return { pts: roundRectPts(cx - w / 2, cy - h / 2, w, h, Math.min(w, h) * 0.3), inner: [0.9, 0.92] };
      default: return { pts: roundRectPts(cx - w / 2, cy - h / 2, w, h, 7), inner: [0.94, 0.9] };
    }
  }

  /** (cx,cy) 에서 (dx,dy) 방향으로 나가는 반직선이 볼록 다각형을 나가는 매개값 t */
  function rayExit(pts, cx, cy, dx, dy) {
    let best = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      const ex = bx - ax;
      const ey = by - ay;
      const den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-9) continue;
      const t = ((ax - cx) * ey - (ay - cy) * ex) / den;
      const s = ((ax - cx) * dy - (ay - cy) * dx) / den;
      if (t > 1e-6 && s >= -1e-6 && s <= 1 + 1e-6 && t > best) best = t;
    }
    return best;
  }

  const rectsHit = (a, b, m) => {
    const g = m || 0;
    return a.x < b.x + b.w + g && b.x < a.x + a.w + g && a.y < b.y + b.h + g && b.y < a.y + a.h + g;
  };
  function segHitsRect(p0, p1, r) {
    // 선분–사각형 교차 (Liang–Barsky)
    let t0 = 0;
    let t1 = 1;
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const clip = (p, q) => {
      if (Math.abs(p) < 1e-9) return q >= 0;
      const t = q / p;
      if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
      return true;
    };
    return clip(-dx, p0[0] - r.x) && clip(dx, r.x + r.w - p0[0]) && clip(-dy, p0[1] - r.y) && clip(dy, r.y + r.h - p0[1]);
  }

  /* ====================================================================
   * 4. 보드 조립기
   * ==================================================================== */
  const Z = { band: 0, region: 1, guide: 2, link: 3, shape: 4, text: 5, mark: 6 };

  function makeBuilder(rect, raw, measure, narrow) {
    const sx = rect.w / VW;
    const sy = rect.h / VH;
    const B = { rect, sx, sy, measure: boosted(measure), narrow, issues: [], prims: [], id: raw.id, need: 0 };
    B.U = (x) => rect.x + x * sx;
    B.V = (y) => rect.y + y * sy;
    B.px = (key) => clamp(TEXT_UNITS[key] * sx, TEXT_FLOOR[key], TEXT_CAP[key]);
    B.issue = (level, kind, detail) => B.issues.push({ step: raw.id, level, kind, detail: String(detail) });
    B.add = (p) => { p.i = B.prims.length; B.prims.push(p); return p; };
    /** 선·도형. pts 는 [x,y] 목록(닫힌 도형은 첫 점이 마지막에 반복되어 있어야 함) */
    B.poly = (o) => {
      const { len, cum } = polyLength(o.pts);
      return B.add({ type: 'poly', pts: o.pts, cum, len, color: o.color, w: o.w || 2.4, dash: o.dash || null, fill: o.fill || null, arrow: !!o.arrow, alpha: o.alpha === undefined ? 1 : o.alpha, at: o.at, o0: o.t[0], o1: o.t[1], site: o.site, z: o.z === undefined ? Z.shape : o.z });
    };
    /** 글. (x, y): align 에 따른 가로 기준점과 글 덩어리의 맨 위 */
    B.text = (o) => B.add({ type: 'text', T: o.T, x: o.x, y: o.y, color: o.color, align: o.align || 'left', knock: !!o.knock, at: o.at, o0: o.t[0], o1: o.t[1], site: o.site, z: o.z === undefined ? Z.text : o.z, role: o.role || '' });
    B.dot = (o) => B.add({ type: 'dot', x: o.x, y: o.y, r: o.r, hollow: !!o.hollow, color: o.color, at: o.at, o0: o.t[0], o1: o.t[1], site: o.site, z: Z.mark });
    B.band = (o) => B.add({ type: 'band', x: o.x, y: o.y, w: o.w, h: o.h, r: o.r === undefined ? 8 : o.r, color: o.color, alpha: o.alpha, at: o.at, o0: o.t[0], o1: o.t[1], site: o.site, z: Z.band });
    return B;
  }

  function textRect(p) {
    const T = p.T;
    const x = p.align === 'center' ? p.x - T.w / 2 : p.align === 'right' ? p.x - T.w : p.x;
    return { x, y: p.y, w: T.w, h: T.h };
  }

  /** 노드형 요소(노드·계단 칸·방사 가지·중심)의 글 쌓기 크기. 칠판 가로 배율에서 나옵니다. */
  function stackSizes(B, hasHan) {
    return [
      hasHan ? { key: 'han', px: clamp(7.4 * B.sx, 22, 40), floor: 20 } : null,
      { key: 'title', px: clamp(3.7 * B.sx, 13.5, 18), floor: 13.5 },
      { key: 'line', px: clamp(3.4 * B.sx, 13, 16), floor: 13 },
    ].filter(Boolean);
  }
  function stackItems(B, el, colors) {
    const sz = stackSizes(B, !!el.han);
    const list = [];
    const color = colors || {};
    for (const s of sz) {
      if (s.key === 'han') list.push({ key: 'han', text: el.han, px: s.px, floor: s.floor, color: color.han || COLORS[el.color] || COLORS.white });
      else if (s.key === 'title') { if (el.title) list.push({ key: 'title', text: el.title, px: s.px, floor: s.floor, color: color.title || COLORS[el.color] || COLORS.white }); } else {
        const lines = el.lines || (el.line ? [el.line] : []);
        lines.forEach((ln, k) => list.push({ key: 'line', idx: k, text: ln, px: s.px, floor: s.floor, color: color.line || COLORS.white }));
      }
    }
    return list;
  }

  /** 도형 안에 글 쌓기를 올립니다. 반환: 넘쳤는지 */
  function placeStack(B, el, times, box, site, o) {
    const opt = o || {};
    const list = stackItems(B, el, opt.colors);
    const st = fitStack(list, box.w, box.h, B.measure);
    const top = box.cy - st.h / 2 + (opt.dy || 0);
    let lineNo = 0;
    for (const it of st.items) {
      let tt;
      if (it.key === 'han') tt = times.han;
      else if (it.key === 'title') tt = times.title;
      else tt = times.lines[lineNo++];
      B.text({ T: it.T, x: box.cx, y: top + it.y, align: 'center', color: it.color, at: el.at, t: tt, site: site + ':' + it.key + (it.idx !== undefined ? it.idx : ''), role: it.key });
    }
    return st.overflow;
  }

  /* ---------------- diagram ---------------- */
  /**
   * 글이 상자보다 크면 상자를 중심에서 키웁니다. 칠판 가장자리를 넘지 않고, 다른 노드와는 간격을 지키는 만큼만 키웁니다
   * (링크로 이어진 노드와는 링크 화살표가 그려질 수 있게 22px, 이어지지 않은 노드와는 4px).
   * 다 못 키우면 키울 수 있는 데까지만 키우고, 그래도 넘치는 것은 호출한 쪽이 error 로 보고합니다.
   */
  function growNode(B, rec, nodes, linked) {
    const list = stackItems(B, rec.el);
    const st = fitStack(list, rec.w * rec.inner[0], rec.h * rec.inner[1], B.measure);
    if (!st.overflow) return;
    let tw = 0;
    for (const it of st.items) tw = Math.max(tw, it.T.w);
    let w = Math.max(rec.w, tw / rec.inner[0] + 10);
    let h = Math.max(rec.h, st.h / rec.inner[1] + 10);
    if (rec.el.shape === 'circle') { w = Math.max(w, h); h = w; }
    const R = B.rect;
    const margin = 4;
    const w0 = rec.w;
    const h0 = rec.h;
    const make = (t) => {
      const ww = w0 + (w - w0) * t;
      const hh = h0 + (h - h0) * t;
      const cx = clamp(rec.cx, R.x + margin + ww / 2, R.x + R.w - margin - ww / 2);
      const cy = clamp(rec.cy, R.y + margin + hh / 2, R.y + R.h - margin - hh / 2);
      return { x: cx - ww / 2, y: cy - hh / 2, w: ww, h: hh, cx, cy };
    };
    const clear = (nb) => {
      for (const other of nodes.values()) {
        if (other === rec) continue;
        const gap = linked.has(rec.el.id + '|' + other.el.id) || linked.has(other.el.id + '|' + rec.el.id) ? 22 : 4;
        if (rectsHit(nb, other.bbox, gap)) return false;
      }
      return true;
    };
    let lo = 0;
    let hi = 1;
    if (clear(make(1))) lo = 1;
    else for (let i = 0; i < 12; i++) { const mid = (lo + hi) / 2; if (clear(make(mid))) lo = mid; else hi = mid; }
    if (lo <= 0.001) return;
    const nb = make(lo);
    const o = shapeOutline(rec.el.shape || 'box', nb.cx, nb.cy, nb.w, nb.h);
    rec.cx = nb.cx; rec.cy = nb.cy; rec.w = o.w || nb.w; rec.h = o.h || nb.h; rec.pts = o.pts;
    Object.assign(rec.bbox, { x: nb.cx - rec.w / 2, y: nb.cy - rec.h / 2, w: rec.w, h: rec.h });
  }

  function layoutDiagram(B, board) {
    const nodes = new Map();
    const boxes = [];
    board.elements.forEach((el, k) => {
      if (el.type !== 'node') return;
      const cx = B.U(el.x);
      const cy = B.V(el.y);
      const w = el.w * B.sx;
      const h = el.h * B.sy;
      const o = shapeOutline(el.shape || 'box', cx, cy, w, h);
      const rec = { el, k, cx, cy, w: o.w || w, h: o.h || h, pts: o.pts, inner: o.inner, bbox: { x: cx - (o.w || w) / 2, y: cy - (o.h || h) / 2, w: o.w || w, h: o.h || h } };
      nodes.set(el.id, rec);
      boxes.push(rec.bbox);
    });
    const linked = new Set();
    for (const el of board.elements) if (el.type === 'link' && typeof el.from === 'string' && typeof el.to === 'string') linked.add(el.from + '|' + el.to);
    for (const rec of nodes.values()) growNode(B, rec, nodes, linked);
    const labelBoxes = [];
    board.elements.forEach((el, k) => {
      const times = elementTimes(el);
      const site = 'e' + k;
      if (el.type === 'region') {
        const x0 = B.U(el.x);
        const y0 = B.V(el.y);
        const w = el.w * B.sx;
        const h = el.h * B.sy;
        const col = COLORS[el.color] || COLORS.white;
        B.poly({ pts: roundRectPts(x0, y0, w, h, 10), color: col, w: 2, dash: [10, 8], fill: { color: col, alpha: 0.06 }, alpha: 0.85, at: el.at, t: times.shape, site: site + ':shape', z: Z.region });
        if (el.label) {
          // 구역 이름은 위쪽 점선 위에 걸쳐 쓰고(점선은 글 뒤를 지웁니다) 안쪽 노드와 겹치지 않게 합니다.
          const T = layoutText(el.label, B.px('s') + 1, w - 28, B.measure);
          const tx = x0 + 16;
          const ty = Math.max(B.rect.y + 2, y0 - T.h * 0.55);
          B.text({ T, x: tx, y: ty, color: col, knock: true, at: el.at, t: times.label, site: site + ':label', role: 'region' });
          const rr = { x: tx, y: ty, w: T.w, h: T.h };
          for (const nb of boxes) if (rectsHit(rr, nb, 2)) B.issue('warn', 'label-overlap', '구역 이름 "' + el.label + '" 이 노드와 겹쳐요');
          labelBoxes.push(rr);
        }
      } else if (el.type === 'node') {
        const rec = nodes.get(el.id);
        const col = COLORS[el.color] || COLORS.white;
        B.poly({ pts: rec.pts, color: col, w: 2.8, fill: { color: col, alpha: 0.11 }, at: el.at, t: times.shape, site: site + ':shape' });
        const box = { cx: rec.cx, cy: rec.cy, w: rec.w * rec.inner[0], h: rec.h * rec.inner[1] };
        if (placeStack(B, el, times, box, site)) B.issue('error', 'node-overflow', '노드 "' + (el.title || el.id) + '" 글이 상자보다 커요');
      } else if (el.type === 'text') {
        const size = el.size || 'm';
        const px = B.px(size);
        const align = el.align || 'left';
        // 글이 칠판 안(5~155)에 한 줄로 들어가면 줄바꿈 없이, 기준점만 칠판 안으로 당겨 놓습니다.
        const lo = B.U(5);
        const hi = B.U(155);
        const T = fitText(el.text, px, TEXT_FLOOR[size] - 2, hi - lo, 9999, B.measure);
        let x = B.U(el.x);
        if (align === 'center') x = clamp(x, lo + T.w / 2, hi - T.w / 2);
        else if (align === 'right') x = clamp(x, lo + T.w, hi);
        else x = clamp(x, lo, hi - T.w);
        const y = B.V(el.y) - T.h / 2;
        B.text({ T, x, y, align, color: COLORS[el.color] || COLORS.white, at: el.at, t: times.text, site: site + ':text', role: 'text' });
        const rr = textRect({ T, x, y, align });
        for (const nb of boxes) if (rectsHit(rr, nb, 0)) B.issue('warn', 'label-overlap', '글 "' + el.text + '" 이 노드와 겹쳐요');
      }
    });
    // 링크는 노드 위치가 모두 정해진 뒤에
    drawDiagramLinks(B, board, nodes, boxes, labelBoxes, null);
  }

  /** 링크와 링크 이름. ends(el) 이 주어지면 그 끝점을 씁니다(좁은 화면에서 다시 흘려 배치한 경우). */
  function drawDiagramLinks(B, board, nodes, boxes, labelBoxes, ends) {
    board.elements.forEach((el, k) => {
      if (el.type !== 'link') return;
      const times = elementTimes(el);
      const site = 'e' + k;
      const col = COLORS[el.color] || COLORS.white;
      let A = typeof el.from === 'string' ? nodes.get(el.from) : null;
      let Bn = typeof el.to === 'string' ? nodes.get(el.to) : null;
      let pa = A ? [A.cx, A.cy] : [B.U(el.from[0]), B.V(el.from[1])];
      let pb = Bn ? [Bn.cx, Bn.cy] : [B.U(el.to[0]), B.V(el.to[1])];
      if (ends) {
        const e = ends(el);
        if (!e) return;
        A = e.A; Bn = e.Bn; pa = e.pa; pb = e.pb;
      }
      const dx = pb[0] - pa[0];
      const dy = pb[1] - pa[1];
      const L = Math.hypot(dx, dy);
      if (L < 1) { B.issue('error', 'link-degenerate', '링크 길이가 0이에요'); return; }
      const ux = dx / L;
      const uy = dy / L;
      const GAP = 5;
      const s0 = A ? rayExit(A.pts, A.cx, A.cy, ux, uy) + GAP : 0;
      const s1 = Bn ? rayExit(Bn.pts, Bn.cx, Bn.cy, -ux, -uy) + GAP : 0;
      const a = [pa[0] + ux * s0, pa[1] + uy * s0];
      const b = [pb[0] - ux * s1, pb[1] - uy * s1];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 8) { B.issue('error', 'link-too-short', '노드 사이가 너무 가까워 링크를 그릴 수 없어요'); return; }
      B.poly({ pts: [a, b], color: col, w: 2.6, dash: el.style === 'dash' ? [9, 8] : null, arrow: el.arrow !== false, at: el.at, t: times.line, site: site + ':line', z: Z.link });
      for (const [id, rec] of nodes) {
        if (rec === A || rec === Bn) continue;
        if (segHitsRect(a, b, rec.bbox)) B.issue('warn', 'link-crosses-node', '링크 "' + (el.label || id) + '" 가 노드 "' + (rec.el.title || id) + '" 위를 지나요');
      }
      if (el.label) {
        const T = layoutText(el.label, B.px('s') + 1, 150, B.measure);
        let placed = null;
        for (const f of [0.5, 0.4, 0.6, 0.3, 0.7, 0.22, 0.78]) {
          const mx = a[0] + (b[0] - a[0]) * f;
          const my = a[1] + (b[1] - a[1]) * f;
          const rr = { x: mx - T.w / 2 - 4, y: my - T.h / 2 - 2, w: T.w + 8, h: T.h + 4 };
          const bad = boxes.some((nb) => rectsHit(rr, nb, 0)) || labelBoxes.some((lb) => rectsHit(rr, lb, 0));
          if (!bad) { placed = { mx, my, rr }; break; }
        }
        if (!placed) {
          placed = { mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2, rr: null };
          B.issue('warn', 'label-overlap', '링크 이름 "' + el.label + '" 이 노드와 겹쳐요');
        }
        labelBoxes.push(placed.rr || { x: placed.mx, y: placed.my, w: 0, h: 0 });
        B.text({ T, x: placed.mx, y: placed.my - T.h / 2, align: 'center', color: col, knock: true, at: el.at, t: times.label, site: site + ':label', role: 'link', z: Z.text });
      }
    });
  }

  /* 좁은 화면의 다이어그램: 원래 좌표 그대로는 글이 상자보다 커질 때(칠판이 가로로 2배 이상 줄어든 경우)
   * 노드를 "줄"로 다시 흘려 배치합니다. 원래 좌표는 줄 묶기·순서·구역 소속에만 쓰고,
   * 상자 크기는 글에서 계산하며, 한 줄에 못 들어가면 다음 줄로 넘깁니다. */
  function layoutDiagramFlow(B, board) {
    const PAD = 10;
    const MINGAP = 26;
    const innerL = B.rect.x + PAD;
    const innerW = B.rect.w - 2 * PAD;
    const items = [];
    board.elements.forEach((el, k) => {
      if (el.type === 'node') {
        const inner = shapeOutline(el.shape || 'box', 0, 0, 10, 10).inner;
        const target = clamp(el.w * 4.6, 72, innerW);
        const st = fitStack(stackItems(B, el), target * inner[0] - 12, 9999, B.measure);
        let tw = 0;
        for (const it of st.items) tw = Math.max(tw, it.T.w);
        let w = clamp(tw / inner[0] + 14, 58, innerW);
        let h = st.h / inner[1] + 14;
        if (el.shape === 'circle') { w = Math.min(innerW, Math.max(w, h)); h = w; }
        items.push({ kind: 'node', el, k, w, h, x: el.x, y: el.y, region: -1 });
      } else if (el.type === 'text') {
        const size = el.size || 'm';
        const T = fitText(el.text, B.px(size), TEXT_FLOOR[size] - 2, innerW, 9999, B.measure);
        items.push({ kind: 'text', el, k, w: T.w, h: T.h, T, x: el.x, y: el.y, region: -1 });
      }
    });
    // 구역 소속(가장 작은 구역)
    const regions = [];
    board.elements.forEach((el, k) => {
      if (el.type !== 'region') return;
      const r = { el, k, members: [], labelT: el.label ? layoutText(el.label, B.px('s') + 1, innerW - 24, B.measure) : null };
      regions.push(r);
      for (const it of items) {
        if (it.kind !== 'node') continue;
        if (it.x >= el.x && it.x <= el.x + el.w && it.y >= el.y && it.y <= el.y + el.h) {
          const prev = it.region >= 0 ? regions[it.region] : null;
          if (!prev || el.w * el.h < prev.el.w * prev.el.h) it.region = regions.length - 1;
        }
      }
    });
    regions.forEach((r, ri) => { r.members = items.filter((it) => it.region === ri); });

    // 줄 묶기: 글은 자기 줄, 노드는 원래 y 가 비슷하면 같은 줄
    const sorted = items.slice().sort((a, b) => a.y - b.y || a.x - b.x);
    const clusters = [];
    for (const it of sorted) {
      const last = clusters[clusters.length - 1];
      if (it.kind === 'node' && last && last.kind === 'node' && Math.abs(it.y - last.y0) <= 9) last.items.push(it);
      else clusters.push({ kind: it.kind, y0: it.y, items: [it] });
    }
    const gapBetween = (a, b) => MINGAP + (a.region !== b.region ? 2 * PAD : 0);
    const rows = [];
    for (const c of clusters) {
      c.items.sort((a, b) => a.x - b.x);
      let cur = [];
      let curW = 0;
      for (const it of c.items) {
        const add = cur.length ? gapBetween(cur[cur.length - 1], it) + it.w : it.w;
        if (cur.length && curW + add > innerW) { rows.push(cur); cur = [it]; curW = it.w; } else { cur.push(it); curW += add; }
      }
      if (cur.length) rows.push(cur);
    }
    rows.forEach((row, ri) => row.forEach((it) => { it.row = ri; }));

    // 세로 위치
    const labeled = board.elements.some((el) => el.type === 'link' && el.label);
    const rowGap = labeled ? 44 : 34;
    const firstRow = regions.map((r) => (r.members.length ? Math.min(...r.members.map((m) => m.row)) : -1));
    const lastRow = regions.map((r) => (r.members.length ? Math.max(...r.members.map((m) => m.row)) : -1));
    let y = PAD;
    const rowY = [];
    rows.forEach((row, ri) => {
      let top = 0;
      regions.forEach((r, k) => { if (firstRow[k] === ri && r.labelT) top = Math.max(top, r.labelT.h + 14); else if (firstRow[k] === ri) top = Math.max(top, 14); });
      if (ri) {
        let bottom = 0;
        regions.forEach((r, k) => { if (lastRow[k] === ri - 1) bottom = 12; });
        y += rowGap + bottom;
      }
      y += top;
      const h = Math.max(...row.map((it) => it.h));
      rowY.push({ top: y, h });
      y += h;
    });
    let tail = 0;
    regions.forEach((r, k) => { if (lastRow[k] === rows.length - 1) tail = 12; });
    B.need = Math.ceil(y + tail + PAD) - B.rect.y;
    B.stackHeight = 0;

    // 가로 위치
    const nodes = new Map();
    const boxes = [];
    rows.forEach((row, ri) => {
      const sumW = row.reduce((a, it) => a + it.w, 0);
      let minGaps = 0;
      for (let i = 1; i < row.length; i++) minGaps += gapBetween(row[i - 1], row[i]);
      const free = Math.max(0, innerW - sumW - minGaps);
      const slack = free / (row.length + 1);
      let x = innerL;
      row.forEach((it, i) => {
        let cx;
        if (row.length === 1) {
          const ratio = clamp((it.x - 5) / 150, 0, 1);
          cx = clamp(innerL + ratio * innerW, innerL + it.w / 2, innerL + innerW - it.w / 2);
          if (it.kind === 'text') cx = innerL + innerW / 2;
        } else {
          x += (i === 0 ? slack : gapBetween(row[i - 1], it) + slack);
          cx = x + it.w / 2;
          x += it.w;
        }
        it.cx = cx;
        it.cy = B.rect.y + rowY[ri].top + rowY[ri].h / 2;
        if (it.kind === 'node') {
          const o = shapeOutline(it.el.shape || 'box', it.cx, it.cy, it.w, it.h);
          const rec = { el: it.el, k: it.k, cx: it.cx, cy: it.cy, w: o.w || it.w, h: o.h || it.h, pts: o.pts, inner: o.inner };
          rec.bbox = { x: rec.cx - rec.w / 2, y: rec.cy - rec.h / 2, w: rec.w, h: rec.h };
          nodes.set(it.el.id, rec);
          boxes.push(rec.bbox);
        }
      });
    });

    // 그리기 (원래 요소 순서)
    const nodeItems = items.filter((it) => it.kind === 'node');
    const labelBoxes = [];
    board.elements.forEach((el, k) => {
      const times = elementTimes(el);
      const site = 'e' + k;
      const col = COLORS[el.color] || COLORS.white;
      if (el.type === 'region') {
        const r = regions.find((q) => q.k === k);
        if (!r || !r.members.length) { B.issue('warn', 'region-empty', '구역 "' + (el.label || k) + '" 안에 노드가 없어요'); return; }
        let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
        for (const m of r.members) { const b = nodes.get(m.el.id).bbox; x0 = Math.min(x0, b.x); x1 = Math.max(x1, b.x + b.w); y0 = Math.min(y0, b.y); y1 = Math.max(y1, b.y + b.h); }
        const rx = Math.max(B.rect.x + 2, x0 - PAD);
        const rw = Math.min(B.rect.x + B.rect.w - 2, x1 + PAD) - rx;
        const ry = y0 - (r.labelT ? r.labelT.h + 10 : 10);
        const rh = y1 + 10 - ry;
        B.poly({ pts: roundRectPts(rx, ry, rw, rh, 10), color: col, w: 2, dash: [10, 8], fill: { color: col, alpha: 0.06 }, alpha: 0.85, at: el.at, t: times.shape, site: site + ':shape', z: Z.region });
        if (r.labelT) {
          B.text({ T: r.labelT, x: rx + 12, y: ry + 6, color: col, at: el.at, t: times.label, site: site + ':label', role: 'region' });
          labelBoxes.push({ x: rx + 12, y: ry + 6, w: r.labelT.w, h: r.labelT.h });
        }
      } else if (el.type === 'node') {
        const rec = nodes.get(el.id);
        B.poly({ pts: rec.pts, color: col, w: 2.8, fill: { color: col, alpha: 0.11 }, at: el.at, t: times.shape, site: site + ':shape' });
        const box = { cx: rec.cx, cy: rec.cy, w: rec.w * rec.inner[0], h: rec.h * rec.inner[1] };
        if (placeStack(B, el, times, box, site)) B.issue('error', 'node-overflow', '노드 "' + (el.title || el.id) + '" 글이 상자보다 커요');
      } else if (el.type === 'text') {
        const it = items.find((q) => q.k === k);
        const y0 = B.rect.y + rowY[it.row].top;
        B.text({ T: it.T, x: it.cx, y: y0, align: 'center', color: col, at: el.at, t: times.text, site: site + ':text', role: 'text' });
      }
    });
    const nearest = (pt) => {
      let best = null;
      let bd = Infinity;
      for (const it of nodeItems) { const d = Math.hypot(it.x - pt[0], it.y - pt[1]); if (d < bd) { bd = d; best = it; } }
      return best ? nodes.get(best.el.id) : null;
    };
    drawDiagramLinks(B, board, nodes, boxes, labelBoxes, (el) => {
      const free = typeof el.from !== 'string' || typeof el.to !== 'string';
      const A = typeof el.from === 'string' ? nodes.get(el.from) : nearest(el.from);
      const Bn = typeof el.to === 'string' ? nodes.get(el.to) : nearest(el.to);
      if (!A || !Bn || A === Bn) { B.issue('warn', 'link-dropped', '좁은 화면에서 그릴 수 없는 링크를 건너뛰었어요'); return null; }
      let pa = [A.cx, A.cy];
      let pb = [Bn.cx, Bn.cy];
      if (free) {
        // 자유 좌표 링크(서로 마주 보는 한 쌍)는 두 갈래로 벌려서 겹치지 않게 합니다.
        const L = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) || 1;
        const nx = -(pb[1] - pa[1]) / L;
        const ny = (pb[0] - pa[0]) / L;
        pa = [pa[0] + nx * 9, pa[1] + ny * 9];
        pb = [pb[0] + nx * 9, pb[1] + ny * 9];
      }
      return { A, Bn, pa, pb };
    });
  }

  /** 좁은 화면에서 원래 좌표로 글이 안 들어가면(error) 흘려 배치로 바꿉니다. 한 번 정해진 방식은 높이가 바뀌어도 유지됩니다. */
  function layoutDiagramAdaptive(B, board) {
    if (B.force === 'flow') { layoutDiagramFlow(B, board); B.mode = 'flow'; return; }
    layoutDiagram(B, board);
    B.mode = 'authored';
    // 좁은 화면에서는 글이 칠판 밖으로 나가는 오류뿐 아니라 글끼리 겹치는 경우에도 흘려 배치로 바꿉니다.
    const collides = (i) => i.level === 'error' || i.kind === 'text-overlap' || i.kind === 'label-overlap';
    if (B.narrow && !B.force && B.issues.some(collides)) {
      B.prims.length = 0;
      B.issues.length = 0;
      layoutDiagramFlow(B, board);
      B.mode = 'flow';
    }
  }

  /* ---------------- timeline ---------------- */
  function yearLabel(year) {
    if (year === 0) return ['기원', '전후'];
    return year < 0 ? ['기원전', String(-year)] : ['서기', String(year)];
  }

  /**
   * 좁은 칠판용 세로 연표. 세로 축(눈금 글은 왼쪽), 사건은 축 위 점, 기간은 축 옆 막대, 설명 글은 오른쪽 한 열.
   * 글끼리 겹치지 않게 위에서부터 아래로 밀어 놓고 점선 안내선으로 제자리와 이어 줍니다. 칠판 높이는 글에 맞춰 늘어납니다(B.need).
   * 그리기 시간표(site·t)는 가로 연표와 같아서 판서 길이가 화면 폭과 무관합니다.
   */
  function layoutTimelineVertical(B, board) {
    const { rect } = B;
    const axis = board.axis;
    const st = staticTimes(board);
    const tickPx = clamp(3.1 * B.sx, 13.5, 15.5);
    const titlePx = clamp(3.6 * B.sx, 13.5, 17);
    const subPx = clamp(3.1 * B.sx, 13, 15);
    const years = [];
    for (let y = axis.from; y <= axis.to; y += axis.step) years.push(y);
    const tickTexts = years.map((y) => layoutText(y === 0 ? '기원 전후' : y < 0 ? '기원전 ' + (-y) : '서기 ' + y, tickPx, 999, B.measure));
    const tickW = Math.max(...tickTexts.map((T) => T.w));
    const tickH = Math.max(...tickTexts.map((T) => T.h));
    const ax = rect.x + 8 + tickW + 12;
    const top = rect.y + 18;
    const barW = 11;
    const slotPitch = 15;

    // 눈금 간격(pitch)을 넓혀 가며, 설명 글이 축 끝 밖으로 많이 밀려나지 않는 첫 간격을 씁니다.
    const arrange = (pitch) => {
      const L = (pitch * (axis.to - axis.from)) / axis.step;
      const Y = (yr) => top + ((yr - axis.from) / (axis.to - axis.from)) * L;
      // 기간(span)은 축 옆 막대. 겹치는 기간은 다음 칸에 놓습니다.
      const slotEnd = [];
      const slotOf = new Map();
      board.elements
        .map((el, k) => ({ el, k }))
        .filter((q) => q.el.type === 'span')
        .sort((a, b) => (a.el.from - b.el.from) || (a.k - b.k))
        .forEach((q) => {
          let s = 0;
          while (slotEnd[s] !== undefined && slotEnd[s] > Y(q.el.from) - 4) s++;
          slotOf.set(q.k, s);
          slotEnd[s] = Y(q.el.to);
        });
      const barX = (s) => ax + 9 + s * slotPitch;
      const lx = ax + 9 + slotEnd.length * slotPitch + 18;
      const lw = Math.max(80, rect.x + rect.w - 6 - lx);
      const items = board.elements.map((el, k) => {
        const key = el.type === 'span' ? (el.from + el.to) / 2 : el.year;
        const T = layoutText((el.title || '') + (el.uncertain ? ' ?' : ''), titlePx, lw, B.measure);
        const S = el.sub ? layoutText(el.sub, subPx, lw, B.measure) : null;
        return { el, k, key, mark: Y(key), T, S, h: T.h + (S ? S.h + 2 : 0) };
      }).sort((a, b) => (a.key - b.key) || (a.k - b.k));
      // 위에서부터 겹치지 않게 놓기
      let cursor = top - 10;
      for (const it of items) {
        it.y = Math.max(it.mark - it.T.lh / 2, cursor);
        cursor = it.y + it.h + 8;
      }
      const axisEnd = top + L + 14;
      return { Y, L, slotOf, barX, lx, items, axisEnd, bottom: Math.max(axisEnd, cursor - 8), spill: cursor - 8 - axisEnd };
    };
    let P = null;
    for (const pitch of [Math.max(50, tickH * 2), 64, 80, 96, 112, 128]) {
      P = arrange(pitch);
      if (P.spill <= 24) break;
    }
    const { Y, slotOf, barX, lx, items, axisEnd, bottom } = P;
    B.poly({ pts: [[ax, top - 12], [ax, axisEnd]], color: COLORS.white, w: 2.6, arrow: true, at: 0, t: st.axis, site: 'axis', z: Z.link });
    years.forEach((yr, i) => {
      const ty = Y(yr);
      B.poly({ pts: [[ax - 6, ty], [ax + 6, ty]], color: COLORS.white, w: 2, at: 0, t: st.ticks[i], site: 'tick' + i, z: Z.link });
      B.text({ T: tickTexts[i], x: ax - 10, y: ty - tickTexts[i].h / 2, align: 'right', color: COLORS.white, at: 0, t: st.ticks[i], site: 'tl' + i, role: 'tick' });
    });

    for (const it of items) {
      const { el, k, T, S } = it;
      const times = elementTimes(el);
      const site = 'e' + k;
      const col = COLORS[el.color] || COLORS.white;
      const ly = it.y + T.lh / 2;
      let start;
      if (el.type === 'span') {
        const ya = Y(el.from);
        const bh = Math.max(8, Y(el.to) - ya);
        const bx = barX(slotOf.get(k));
        B.poly({ pts: roundRectPts(bx, ya, barW, bh, 5), color: col, w: 2.4, dash: el.uncertain ? [7, 6] : null, fill: el.uncertain ? null : { color: col, alpha: 0.32 }, at: el.at, t: times.shape, site: site + ':shape' });
        start = [bx + barW + 3, ya + bh / 2];
      } else {
        B.dot({ x: ax, y: it.mark, r: 7, hollow: !!el.uncertain, color: col, at: el.at, t: times.shape, site: site + ':dot' });
        start = [ax + 10, it.mark];
      }
      B.poly({ pts: [start, [lx - 7, ly]], color: col, w: 1.6, dash: [3, 6], alpha: 0.55, at: el.at, t: times.shape, site: site + ':guide', z: Z.guide });
      B.text({ T, x: lx, y: it.y, align: 'left', color: col, knock: true, at: el.at, t: times.title, site: site + ':title', role: el.type });
      if (S) B.text({ T: S, x: lx, y: it.y + T.h + 2, align: 'left', color: COLORS.white, knock: true, at: el.at, t: times.sub, site: site + ':sub', role: 'sub' });
    }
    B.need = Math.ceil(bottom + 12) - rect.y;
    B.stackHeight = 0;
  }

  function layoutTimeline(B, board) {
    const { rect } = B;
    // 폭이 좁은(휴대폰) 칠판: 가로 연표는 글이 겹치므로 세로 연표로 다시 짭니다.
    if (B.narrow && rect.w < 560) { B.mode = 'vertical'; layoutTimelineVertical(B, board); return; }
    const axis = board.axis;
    const st = staticTimes(board);
    const tickPx = clamp(2.9 * B.sx, 12.5, 14.5);
    const tickLh = tickPx * KO_BOOST * 1.1;
    const margin = Math.max(30, B.measure('기원전', tickPx) / 2 + 8);
    const x0 = rect.x + margin;
    const x1 = rect.x + rect.w - margin;
    const X = (y) => x0 + ((y - axis.from) / (axis.to - axis.from)) * (x1 - x0);
    const axisY = rect.y + rect.h - (tickLh * 2 + 12);
    B.poly({ pts: [[x0 - 14, axisY], [x1 + 14, axisY]], color: COLORS.white, w: 2.6, arrow: true, at: 0, t: st.axis, site: 'axis', z: Z.link });
    // 눈금 글자는 서로 겹치면 한 칸씩 건너뜁니다
    const years = [];
    for (let y = axis.from; y <= axis.to; y += axis.step) years.push(y);
    const widest = Math.max(...years.map((y) => B.measure(yearLabel(y)[1], tickPx)), B.measure('기원전', tickPx));
    const every = Math.max(1, Math.ceil((widest + 6) / ((x1 - x0) / Math.max(1, years.length - 1))));
    years.forEach((y, i) => {
      const x = X(y);
      B.poly({ pts: [[x, axisY - 6], [x, axisY + 6]], color: COLORS.white, w: 2, at: 0, t: st.ticks[i], site: 'tick' + i, z: Z.link });
      if (i % every !== 0 && i !== years.length - 1) return;
      const lab = yearLabel(y);
      // 두 줄: 기원전 / 800
      const T1 = layoutText(lab[0], tickPx, 999, B.measure);
      const T2 = layoutText(lab[1], tickPx, 999, B.measure);
      B.text({ T: T1, x, y: axisY + 9, align: 'center', color: COLORS.white, at: 0, t: st.ticks[i], site: 'tl' + i + 'a', role: 'tick' });
      B.text({ T: T2, x, y: axisY + 9 + tickLh, align: 'center', color: COLORS.white, at: 0, t: st.ticks[i], site: 'tl' + i + 'b', role: 'tick' });
    });
    // 줄(lane)
    const maxLane = Math.max(1, ...board.elements.map((e) => e.lane));
    const laneCount = maxLane + 1;
    const areaTop = rect.y + 6;
    const areaBot = axisY - 10;
    const laneH = Math.min(100 * (rect.w / 680 > 1 ? 1.1 : 1), (areaBot - areaTop) / laneCount);
    const groupTop = areaTop + (areaBot - areaTop - laneH * laneCount) / 2;
    const titlePx = clamp(3.6 * B.sx, 13.5, 17);
    const subPx = clamp(3.1 * B.sx, 13, 15);
    const placed = Array.from({ length: laneCount }, () => []);
    board.elements.forEach((el, k) => {
      const times = elementTimes(el);
      const site = 'e' + k;
      const col = COLORS[el.color] || COLORS.white;
      const laneTop = groupTop + el.lane * laneH;
      const midY = laneTop + laneH * 0.58;
      const label = (el.title || '') + (el.uncertain ? ' ?' : '');
      if (el.type === 'span') {
        const xa = X(el.from);
        const xb = X(el.to);
        const bw = Math.max(6, xb - xa);
        const bh = 12;
        B.poly({ pts: roundRectPts(xa, midY - bh / 2, bw, bh, 5), color: col, w: 2.4, dash: el.uncertain ? [7, 6] : null, fill: el.uncertain ? null : { color: col, alpha: 0.32 }, at: el.at, t: times.shape, site: site + ':shape' });
        const T = layoutText(label, titlePx, Math.max(150, rect.w * 0.6), B.measure);
        const tx = clamp(xa, rect.x + 6, rect.x + rect.w - 6 - T.w);
        let ty = midY - bh / 2 - 4 - T.h;
        let rr = { x: tx, y: ty, w: T.w, h: T.h };
        let ok = !placed[el.lane].some((r) => rectsHit(rr, r, 2));
        if (!ok) { ty = midY + bh / 2 + 4; rr = { x: tx, y: ty, w: T.w, h: T.h }; ok = !placed[el.lane].some((r) => rectsHit(rr, r, 2)); }
        if (!ok) B.issue('warn', 'label-overlap', '연표 글 "' + el.title + '" 이 겹쳐요');
        placed[el.lane].push(rr, { x: xa, y: midY - bh / 2, w: bw, h: bh });
        B.text({ T, x: tx, y: ty, color: col, at: el.at, t: times.title, site: site + ':title', role: 'span' });
      } else if (el.type === 'event') {
        const x = X(el.year);
        B.poly({ pts: [[x, axisY - 2], [x, midY + 8]], color: col, w: 1.6, dash: [3, 7], alpha: 0.28, at: el.at, t: times.shape, site: site + ':guide', z: Z.guide });
        B.dot({ x, y: midY, r: 7, hollow: !!el.uncertain, color: col, at: el.at, t: times.shape, site: site + ':dot' });
        const T = layoutText(label, titlePx, Math.min(rect.w * 0.5, 230), B.measure);
        const S = el.sub ? layoutText(el.sub, subPx, Math.min(rect.w * 0.5, 230), B.measure) : null;
        const clampX = (w) => clamp(x, rect.x + 6 + w / 2, rect.x + rect.w - 6 - w / 2);
        const variants = [
          { ty: midY - 12 - T.h, sy: midY + 11 },
          { ty: midY + 11, sy: midY + 11 + T.h },
        ];
        let pick = null;
        for (const v of variants) {
          const rects = [{ x: clampX(T.w) - T.w / 2, y: v.ty, w: T.w, h: T.h }];
          if (S) rects.push({ x: clampX(S.w) - S.w / 2, y: v.sy, w: S.w, h: S.h });
          if (!rects.some((r) => placed[el.lane].some((q) => rectsHit(r, q, 2)))) { pick = { v, rects }; break; }
        }
        if (!pick) {
          B.issue('warn', 'label-overlap', '연표 글 "' + el.title + '" 이 겹쳐요');
          const v = variants[0];
          pick = { v, rects: [{ x: clampX(T.w) - T.w / 2, y: v.ty, w: T.w, h: T.h }].concat(S ? [{ x: clampX(S.w) - S.w / 2, y: v.sy, w: S.w, h: S.h }] : []) };
        }
        placed[el.lane].push(...pick.rects, { x: x - 8, y: midY - 8, w: 16, h: 16 });
        B.text({ T, x: clampX(T.w), y: pick.v.ty, align: 'center', color: col, knock: true, at: el.at, t: times.title, site: site + ':title', role: 'event' });
        if (S) B.text({ T: S, x: clampX(S.w), y: pick.v.sy, align: 'center', color: COLORS.white, knock: true, at: el.at, t: times.sub, site: site + ':sub', role: 'sub' });
      }
    });
  }

  /* ---------------- ladder ---------------- */
  function layoutLadder(B, board) {
    const { rect } = B;
    const st = staticTimes(board);
    const tiers = board.elements;
    const n = tiers.length;
    const pad = 8;
    const labelPx = clamp(3.4 * B.sx, 13, 16);
    const railW = clamp(rect.w * 0.1, 40, 68);
    const railX = rect.x + pad + railW / 2;
    const TT = layoutText(board.top, labelPx, railW + 6, B.measure);
    const TB = layoutText(board.bottom, labelPx, railW + 6, B.measure);
    B.text({ T: TT, x: railX, y: rect.y + pad, align: 'center', color: COLORS.mint, at: 0, t: st.top, site: 'top', role: 'rail' });
    const botY = rect.y + rect.h - pad - TB.h;
    B.text({ T: TB, x: railX, y: botY, align: 'center', color: COLORS.pink, at: 0, t: st.bottom, site: 'bottom', role: 'rail' });
    B.poly({ pts: [[railX, botY - 8], [railX, rect.y + pad + TT.h + 8]], color: COLORS.white, w: 2.6, arrow: true, at: 0, t: st.rail, site: 'rail', z: Z.link });

    const x0 = rect.x + pad + railW + 12;
    const full = rect.x + rect.w - pad - x0;
    const step = clamp(full * 0.035, 6, 26);
    const boxW = full - step * (n - 1);
    const gapY = 9;
    const hanPx0 = clamp(8.2 * B.sx, 24, 44);
    // 자연 높이
    const rows = tiers.map((el) => {
      const nHan = chars(el.han || '').length || 1;
      const hanPx = Math.min(hanPx0, (boxW * 0.34) / nHan);
      const hanW = el.han ? B.measure(el.han, hanPx) + 14 : 0;
      const room = boxW - 20 - hanW;
      const titlePx = clamp(3.8 * B.sx, 13.5, 18);
      const linePx = clamp(3.4 * B.sx, 13, 16);
      const list = [{ key: 'title', text: el.title, px: titlePx, floor: 13.5, color: COLORS[el.color] }, { key: 'line', text: el.line || '', px: linePx, floor: 13, color: COLORS.white }];
      const stk = fitStack(list.filter((l) => l.text), room, 9999, B.measure, 3);
      return { el, hanPx, hanW, stk, natural: Math.max(stk.h, el.han ? hanPx * 1.15 : 0) + 18 };
    });
    const availH = rect.h - 2 * pad - gapY * (n - 1);
    const naturalMax = Math.max(...rows.map((r) => r.natural));
    B.need = naturalMax * n + gapY * (n - 1) + 2 * pad;
    const th = clamp(Math.min(availH / n, 118), Math.min(naturalMax, availH / n), 118);
    const total = th * n + gapY * (n - 1);
    const top = rect.y + (rect.h - total) / 2;
    rows.forEach((r, i) => {
      const el = r.el;
      const times = elementTimes(el);
      const site = 'e' + i;
      const col = COLORS[el.color] || COLORS.white;
      const bx = x0 + step * i;
      const by = top + i * (th + gapY);
      B.poly({ pts: roundRectPts(bx, by, boxW, th, 12), color: col, w: 2.8, fill: { color: col, alpha: 0.11 }, at: el.at, t: times.shape, site: site + ':shape' });
      if (el.han) {
        const T = layoutText(el.han, r.hanPx, r.hanW + 20, B.measure);
        B.text({ T, x: bx + 12 + (r.hanW - 14) / 2, y: by + (th - T.h) / 2, align: 'center', color: col, at: el.at, t: times.han, site: site + ':han', role: 'han' });
      }
      const tx = bx + 10 + r.hanW;
      let ln = 0;
      for (const it of r.stk.items) {
        const tt = it.key === 'title' ? times.title : times.lines[ln++];
        B.text({ T: it.T, x: tx, y: by + (th - r.stk.h) / 2 + it.y, align: 'left', color: it.color, at: el.at, t: tt, site: site + ':' + it.key, role: it.key });
      }
      if (r.stk.overflow) B.issue('error', 'node-overflow', '계단 칸 "' + el.title + '" 글이 칸보다 커요');
    });
  }

  /* ---------------- radial ---------------- */
  function layoutRadial(B, board) {
    const { rect } = B;
    const spokes = board.elements;
    const n = spokes.length;
    const c = board.center;
    const cEl = Object.assign({ type: 'center' }, c);
    const cTimes = elementTimes(cEl);
    let cw = clamp(rect.w * 0.34, 132, 240);
    let ch = clamp(rect.h * 0.3, 78, 150);
    const ccx = rect.x + rect.w / 2;
    let ccy = rect.y + rect.h / 2;
    // 가지 상자 크기를 줄여 가며 겹치지 않는 타원 배치를 찾습니다. 못 찾으면 두 줄로 쌓는 배치로 바꿉니다.
    let boxes = null;
    let stacked = false;
    for (let s = 1; s >= 0.7 && !boxes; s -= 0.03) {
      const bw = s * clamp(rect.w * 0.27, 110, 190);
      const bh = s * clamp(rect.h * 0.24, 66, 104);
      if (bw < 104 || bh < 58) break;
      const rx = (rect.w - bw) / 2 - 8;
      const ry = (rect.h - bh) / 2 - 8;
      if (rx < cw / 2 + bw / 2 + 4 && ry < ch / 2 + bh / 2 + 4) continue;
      const cand = spokes.map((_, k) => {
        const a = -Math.PI / 2 + (k * 2 * Math.PI) / n;
        const cx = ccx + rx * Math.cos(a);
        const cy = ccy + ry * Math.sin(a);
        return { x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh, cx, cy };
      });
      const cb = { x: ccx - cw / 2, y: ccy - ch / 2, w: cw, h: ch };
      const bad = cand.some((r, i) => rectsHit(r, cb, 6) || cand.some((q, j) => j > i && rectsHit(r, q, 6)));
      if (!bad) boxes = cand;
    }
    if (!boxes) {
      // 위 칸을 중심 글이 편히 들어가는 크기로 키웁니다(가지는 그 아래 두 줄로 쌓습니다)
      cw = Math.min(rect.w - 24, 300);
      const stc = fitStack(stackItems(B, cEl), cw * 0.74, 9999, B.measure);
      ch = Math.max(ch, stc.h / 0.72 + 10);
      const colW = (rect.w - 8 * 2 - 30) / 2;
      const rowsN = Math.ceil(n / 2);
      const bw = Math.min(colW, 220);
      // 자연 높이: 가지마다 글 쌓기를 맞춰 본 뒤 가장 큰 값
      let bh = 0;
      for (const el of spokes) {
        const list = stackItems(B, el);
        const stk = fitStack(list, bw * 0.86, 9999, B.measure);
        bh = Math.max(bh, stk.h / 0.8 + 14);
      }
      bh = Math.max(bh, 62);
      const gap = 12;
      const topH = ch + 22;
      B.need = 8 + topH + rowsN * (bh + gap) + 4;
      const H = Math.max(rect.h, B.need);
      const extra = H - B.need;
      const gapY = gap + extra / Math.max(1, rowsN);
      ccy = rect.y + 8 + ch / 2;
      boxes = spokes.map((_, k) => {
        const rightSide = k < rowsN;
        const row = rightSide ? k : n - 1 - k;
        const cx = rightSide ? rect.x + rect.w - 8 - colW / 2 : rect.x + 8 + colW / 2;
        const cy = rect.y + 8 + topH + row * (bh + gapY) + bh / 2;
        return { x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh, cx, cy };
      });
      B.stackHeight = H;
      stacked = true;
    }
    // 중심
    const cOut = shapeOutline('ellipse', ccx, ccy, cw, ch);
    const ccol = COLORS[c.color] || COLORS.white;
    B.poly({ pts: cOut.pts, color: ccol, w: 3, fill: { color: ccol, alpha: 0.13 }, at: c.at, t: cTimes.shape, site: 'c:shape' });
    if (placeStack(B, cEl, cTimes, { cx: ccx, cy: ccy, w: cw * cOut.inner[0], h: ch * cOut.inner[1] }, 'c')) B.issue('error', 'node-overflow', '중심 "' + c.title + '" 글이 상자보다 커요');
    spokes.forEach((el, k) => {
      const times = elementTimes(el);
      const site = 's' + k;
      const col = COLORS[el.color] || COLORS.white;
      const r = boxes[k];
      const dx = r.cx - ccx;
      const dy = r.cy - ccy;
      const L = Math.hypot(dx, dy) || 1;
      const ux = dx / L;
      const uy = dy / L;
      const boxPts = roundRectPts(r.x, r.y, r.w, r.h, 12);
      const a0 = rayExit(cOut.pts, ccx, ccy, ux, uy) + 4;
      const a1 = L - rayExit(boxPts, r.cx, r.cy, -ux, -uy) - 4;
      if (stacked) {
        // 두 줄 배치에서는 가운데 골을 따라 내려가다 줄마다 옆으로 꺾어 상자에 닿게 합니다(상자를 가로지르지 않도록)
        const edgeX = r.cx > ccx ? r.x - 3 : r.x + r.w + 3;
        B.poly({ pts: [[ccx, ccy + ch / 2 + 2], [ccx, r.cy], [edgeX, r.cy]], color: col, w: 2.2, alpha: 0.8, at: el.at, t: times.link, site: site + ':link', z: Z.link });
      } else if (a1 > a0 + 4) B.poly({ pts: [[ccx + ux * a0, ccy + uy * a0], [ccx + ux * a1, ccy + uy * a1]], color: col, w: 2.2, alpha: 0.8, at: el.at, t: times.link, site: site + ':link', z: Z.link });
      B.poly({ pts: boxPts, color: col, w: 2.8, fill: { color: col, alpha: 0.11 }, at: el.at, t: times.shape, site: site + ':shape' });
      if (placeStack(B, el, times, { cx: r.cx, cy: r.cy, w: r.w * 0.9, h: r.h * 0.84 }, site)) B.issue('error', 'node-overflow', '가지 "' + (el.title || k) + '" 글이 상자보다 커요');
    });
  }

  /* ---------------- table ---------------- */
  function layoutTable(B, board) {
    const { rect } = B;
    const st = staticTimes(board);
    const cols = board.cols;
    const rows = board.elements;
    const pad = 8;
    const tw = rect.w - 2 * pad;
    const cellPx = clamp(4.2 * B.sx, 15, 19);
    /** 한자만 있는 칸(첫 열의 한자 이름 등)은 한글 칸보다 눈에 띄게 조금 크게 */
    const cpx = (t) => (hasKo(t) ? cellPx : cellPx * 1.3);
    const headPx = clamp(3.4 * B.sx, 13.5, 16);
    const padX = B.narrow ? 6 : 9;
    // 열 너비: 가장 긴 글자 하나는 반드시 들어가는 최소 너비에서 시작해, 글이 한 줄로 들어가는 자연 너비까지 비율대로 나눕니다.
    const cellsOf = (ci) => rows.map((r) => r.cells[ci]);
    const minW = cols.map((c, ci) => {
      let m = 0;
      for (const t of cellsOf(ci)) for (const ch of chars(t)) m = Math.max(m, B.measure(ch, cpx(t) * 0.9));
      for (const ch of chars(c)) m = Math.max(m, B.measure(ch, headPx));
      return m + 2 * padX + 2;
    });
    const natW = cols.map((c, ci) => Math.max(B.measure(c, headPx), ...cellsOf(ci).map((t) => B.measure(t, cpx(t)))) + 2 * padX + 4);
    const colW = minW.slice();
    let spare = tw - minW.reduce((a, b) => a + b, 0);
    if (spare > 0) {
      const want = natW.map((n, ci) => Math.max(0, n - minW[ci]));
      const wantSum = want.reduce((a, b) => a + b, 0);
      if (wantSum > 0) {
        const give = Math.min(spare, wantSum);
        want.forEach((wv, ci) => { colW[ci] += (give * wv) / wantSum; });
        spare -= give;
      }
      if (spare > 0) {
        const nsum = natW.reduce((a, b) => a + b, 0);
        natW.forEach((n, ci) => { colW[ci] += (spare * n) / nsum; });
      }
    } else {
      const k = tw / minW.reduce((a, b) => a + b, 0);
      colW.forEach((_, ci) => { colW[ci] = minW[ci] * k; });
    }
    const natural = rows.map((r) => Math.max(...r.cells.map((c, ci) => fitText(c, cpx(c), 13, colW[ci] - 2 * padX, 9999, B.measure).h)) + 14);
    const headT = cols.map((c, ci) => layoutText(c, headPx, colW[ci] - 2 * padX, B.measure));
    const headH = Math.max(...headT.map((t) => t.h)) + 12;
    const rowMin = Math.max(...natural, 36);
    const needed = headH + 6 + rowMin * rows.length + 2 * pad;
    B.need = needed;
    const avail = rect.h - 2 * pad - headH - 6;
    const rowH = clamp(avail / rows.length, rowMin, Math.max(rowMin, 64));
    const total = headH + 6 + rowH * rows.length;
    const top = rect.y + Math.max(pad, (rect.h - total) / 2);
    let x = rect.x + pad;
    const colX = colW.map((w) => { const cx = x; x += w; return cx; });
    cols.forEach((c, ci) => B.text({ T: headT[ci], x: colX[ci] + padX, y: top + (headH - headT[ci].h) / 2 - 2, color: COLORS.white, at: 0, t: st.header[ci], site: 'h' + ci, role: 'head' }));
    B.poly({ pts: [[rect.x + pad, top + headH], [rect.x + pad + tw, top + headH]], color: COLORS.white, w: 2.2, alpha: 0.7, at: 0, t: st.rule, site: 'rule', z: Z.link });
    rows.forEach((r, ri) => {
      const times = elementTimes(r);
      const site = 'r' + ri;
      const col = COLORS[r.color] || COLORS.white;
      const y = top + headH + 6 + ri * rowH;
      B.band({ x: rect.x + pad, y: y + 2, w: tw, h: rowH - 4, color: col, alpha: 0.1, at: r.at, t: times.band, site: site + ':band' });
      B.poly({ pts: [[rect.x + pad + 3, y + 8], [rect.x + pad + 3, y + rowH - 8]], color: col, w: 3, at: r.at, t: times.band, site: site + ':tick', z: Z.link });
      r.cells.forEach((cell, ci) => {
        const T = fitText(cell, cpx(cell), 13, colW[ci] - 2 * padX, rowH - 8, B.measure);
        if (!T.fitted) B.issue('error', 'node-overflow', '표 칸 "' + cell + '" 글이 칸보다 커요');
        B.text({ T, x: colX[ci] + padX + (ci === 0 ? 4 : 0), y: y + (rowH - T.h) / 2, color: ci === 0 ? col : COLORS.white, at: r.at, t: times.cells[ci], site: site + ':c' + ci, role: ci === 0 ? 'title' : 'cell' });
      });
    });
  }

  /* ---------------- compare ---------------- */
  function layoutCompare(B, board) {
    const { rect } = B;
    const st = staticTimes(board);
    const pairs = board.elements;
    const pad = 8;
    const gap = 8;
    const pillW = clamp(rect.w * 0.19, 64, 118);
    const cellW = (rect.w - 2 * pad - pillW - 2 * gap) / 2;
    const lx = rect.x + pad;
    const rx = lx + cellW + gap + pillW + gap;
    const px = clamp(3.6 * B.sx, 13.5, 17);
    const labelPx = clamp(3.1 * B.sx, 13, 15);
    const bannerPx = clamp(4.4 * B.sx, 15, 20);
    const bannerH = bannerPx * KO_BOOST * 1.05 + 16;
    const natural = pairs.map((p) => Math.max(
      fitText(p.left, px, 13, cellW - 16, 9999, B.measure).h,
      fitText(p.right, px, 13, cellW - 16, 9999, B.measure).h,
      fitText(p.label, labelPx, 13.5, pillW - 12, 9999, B.measure).h,
    ) + 16);
    const rowMin = Math.max(...natural, 40);
    B.need = 2 * pad + bannerH + 10 + rowMin * pairs.length;
    const avail = rect.h - 2 * pad - bannerH - 10;
    const rowH = clamp(avail / pairs.length, rowMin, Math.max(rowMin, 70));
    const total = bannerH + 10 + rowH * pairs.length;
    const top = rect.y + Math.max(pad, (rect.h - total) / 2);
    const lc = COLORS[board.left.color] || COLORS.mint;
    const rc = COLORS[board.right.color] || COLORS.orange;
    const banner = (title, x, col, tt, site) => {
      B.poly({ pts: roundRectPts(x, top, cellW, bannerH, 12), color: col, w: 3, fill: { color: col, alpha: 0.16 }, at: 0, t: [tt[0], tt[0] + 0.3], site: site + ':shape' });
      const T = fitText(title, bannerPx, 18, cellW - 16, bannerH - 8, B.measure);
      B.text({ T, x: x + cellW / 2, y: top + (bannerH - T.h) / 2, align: 'center', color: col, at: 0, t: [tt[0] + 0.3, tt[1]], site: site + ':title', role: 'title' });
    };
    banner(board.left.title, lx, lc, st.left, 'bl');
    banner(board.right.title, rx, rc, st.right, 'br');
    pairs.forEach((p, i) => {
      const times = elementTimes(p);
      const site = 'p' + i;
      const y = top + bannerH + 10 + i * rowH;
      const cy = y + rowH / 2;
      const draw = (txt, x, col, tt, key) => {
        B.band({ x, y: y + 2, w: cellW, h: rowH - 4, color: col, alpha: 0.08, at: p.at, t: tt, site: site + ':' + key + 'b' });
        const T = fitText(txt, px, 13, cellW - 16, rowH - 8, B.measure);
        if (!T.fitted) B.issue('error', 'node-overflow', '비교 칸 "' + txt + '" 글이 칸보다 커요');
        B.text({ T, x: x + cellW / 2, y: cy - T.h / 2, align: 'center', color: COLORS.white, at: p.at, t: tt, site: site + ':' + key, role: 'cell' });
      };
      const pcx = rect.x + rect.w / 2;
      B.poly({ pts: roundRectPts(pcx - pillW / 2, y + 5, pillW, rowH - 10, (rowH - 10) / 2), color: COLORS.yellow, w: 2.2, fill: { color: COLORS.yellow, alpha: 0.1 }, at: p.at, t: [times.pill[0], times.pill[0] + 0.25], site: site + ':pill' });
      const PT = fitText(p.label, labelPx, 13.5, pillW - 12, rowH - 12, B.measure);
      B.text({ T: PT, x: pcx, y: cy - PT.h / 2, align: 'center', color: COLORS.yellow, at: p.at, t: times.pill, site: site + ':label', role: 'label' });
      draw(p.left, lx, lc, times.left, 'l');
      draw(p.right, rx, rc, times.right, 'r');
    });
  }

  const BOARD_LAYOUT = { diagram: layoutDiagramAdaptive, timeline: layoutTimeline, ladder: layoutLadder, radial: layoutRadial, table: layoutTable, compare: layoutCompare };

  /** 조각 하나를 세로로 dy 만큼 옮깁니다. */
  function shiftPrim(p, dy) {
    if (p.type === 'poly') p.pts = p.pts.map((q) => [q[0], q[1] + dy]);
    else p.y += dy;
  }

  /** 보드 하나를 주어진 사각형에 배치합니다. 반환: { prims, issues, need } */
  function layoutBoard(raw, rect, measure, narrow, force) {
    const B = makeBuilder(rect, raw, measure, narrow);
    B.force = force || null;
    BOARD_LAYOUT[raw.board.kind](B, raw.board);
    // 공통 검사: 글·도형이 칠판 밖으로 나가는가, 글끼리 겹치는가
    const texts = B.prims.filter((p) => p.type === 'text');
    for (const p of texts) {
      const r = textRect(p);
      if (r.x < rect.x - 3 || r.x + r.w > rect.x + rect.w + 3 || r.y < rect.y - 3 || r.y + r.h > rect.y + rect.h + 3) B.issue('warn', 'text-out-of-bounds', '글 "' + p.T.text + '" 이 칠판 밖으로 나가요');
    }
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        const a = textRect(texts[i]);
        const b = textRect(texts[j]);
        if (rectsHit(a, b, -2)) B.issue('warn', 'text-overlap', '"' + texts[i].T.text + '" 와 "' + texts[j].T.text + '" 가 겹쳐요');
      }
    }
    return { prims: B.prims, issues: B.issues, need: B.need, stackHeight: B.stackHeight || 0, mode: B.mode || '' };
  }

  /* ====================================================================
   * 5. 단계 계획 — 칠판 전체(그림 + 큰 한자 제목 + 판서 요약)의 틀
   * ==================================================================== */
  function panelPrims(raw, x, y, w, measure, scale, align) {
    const prims = [];
    let cy = y;
    const items = raw.panel || [];
    items.forEach((line, i) => {
      const base = PANEL_SIZES[line.size] * scale;
      let T = layoutText(line.text, base, w, measure);
      if (T.lines.length > 2) T = fitText(line.text, base, base * 0.78, w, T.lh * 2 + 1, measure);
      if (i) cy += T.fpx * 0.3;
      const ax = align === 'center' ? x + w / 2 : x;
      prims.push({ type: 'text', T, x: ax, y: cy, align: align === 'center' ? 'center' : 'left', color: COLORS[line.color] || COLORS.white, knock: false, at: line.at, o0: 0, o1: textSec(line.text), site: 'P' + i, z: Z.text, role: 'panel', overflow: T.overflow });
      cy += T.h;
    });
    return { prims, h: cy - y };
  }

  function hanPrim(raw, x, y, w, measure, maxPx, align) {
    if (!raw.han) return null;
    let px = maxPx;
    let T = layoutText(raw.han, px, 9999, measure);
    while (T.w > w && px > 28) { px *= 0.93; T = layoutText(raw.han, px, 9999, measure); }
    const ax = align === 'center' ? x + w / 2 : x;
    return { type: 'text', T, x: ax, y, align: align === 'center' ? 'center' : 'left', color: COLORS.yellow, knock: false, at: 0, o0: 0.15, o1: 0.15 + hanSec(raw.han), site: 'han', z: Z.text, role: 'han' };
  }

  /** 그리기 순서: 면 → 구역 → 안내선 → 링크 → 도형 → 글 → 표시 (같으면 만든 순서) */
  function sortPrims(list) {
    return list.map((p, k) => [p, k]).sort((a, b) => (a[0].z - b[0].z) || (a[1] - b[1])).map((q) => q[0]);
  }

  /**
   * 한 단계의 칠판 틀을 계산합니다.
   * 넓은 화면(W ≥ 760): 그림 왼쪽, 한자 제목·판서 요약 오른쪽. 좁은 화면: 한자 → 그림 → 판서 요약을 위아래로.
   * 반환: { wide, W, height, board:{x,y,w,h}, prims, issues } — prims 는 board 조각 + 한자 제목 + 판서 요약
   */
  function planStep(raw, W, measure0) {
    const measure = boosted(measure0);
    const wide = W >= WIDE_MIN;
    const kind = raw.board.kind;
    const issues = [];
    if (wide) {
      // 글이 많은 그림은 칠판을 조금 더 넓게(오른쪽 글 칸을 좁혀) 다시 배치합니다. 오류가 없는 첫 비율을 씁니다.
      let best = null;
      for (const ratio of WIDE_RATIOS) {
        const plan = planWide(raw, W, measure, ratio);
        if (!best || plan.issues.filter((x) => x.level === 'error').length < best.issues.filter((x) => x.level === 'error').length) best = plan;
        if (!plan.issues.some((x) => x.level === 'error')) break;
      }
      return best;
    }
    return planNarrow(raw, W, measure);
  }

  function planWide(raw, W, measure, ratio) {
    const kind = raw.board.kind;
    const wide = true;
    const issues = [];
    {
      const pad = 18;
      const gap = 24;
      const bw = clamp(Math.round((W - 2 * pad - gap) * ratio), 420, 800);
      let bh = Math.round(bw * 0.625);
      let rect = { x: pad, y: pad, w: bw, h: bh };
      let res = layoutBoard(raw, rect, measure, false);
      if (res.need > bh + 0.5) { bh = Math.ceil(res.need); rect = { x: pad, y: pad, w: bw, h: bh }; res = layoutBoard(raw, rect, measure, false); }
      const colX = pad + bw + gap;
      const colW = W - pad - colX;
      const scale = clamp(colW / 420, 0.8, 1.15);
      const hp = hanPrim(raw, colX, 0, colW, measure, clamp(colW * 0.26, 56, 92), 'left');
      const hanH = hp ? hp.T.h + 14 : 0;
      const pnl = panelPrims(raw, colX, 0, colW, measure, scale, 'left');
      const colH = hanH + pnl.h;
      const top = pad + Math.max(0, (bh - colH) / 2);
      const all = res.prims.slice();
      if (hp) { hp.y = top; all.push(hp); }
      for (const p of pnl.prims) { p.y += top + hanH; all.push(p); }
      for (const p of pnl.prims) if (p.overflow) issues.push({ step: raw.id, level: 'warn', kind: 'panel-overflow', detail: p.T.text });
      return { wide, W, kind, mode: res.mode, height: 2 * pad + Math.max(bh, colH), board: rect, prims: sortPrims(all), issues: res.issues.concat(issues), colX, colW };
    }
  }

  function planNarrow(raw, W, measure) {
    const kind = raw.board.kind;
    const wide = false;
    const issues = [];
    const pad = 8;
    const bw = W - 2 * pad;
    let bh = Math.round(bw * 0.625 * STRETCH[kind]);
    let rect = { x: pad, y: 0, w: bw, h: bh };
    let res = layoutBoard(raw, rect, measure, true);
    if (res.need > bh + 0.5 || ((res.mode === 'flow' || res.mode === 'vertical') && res.need < bh - 0.5)) { bh = Math.ceil(res.need); rect = { x: pad, y: 0, w: bw, h: bh }; res = layoutBoard(raw, rect, measure, true, res.mode); }
    if (res.stackHeight > bh) { bh = Math.ceil(res.stackHeight); rect = { x: pad, y: 0, w: bw, h: bh }; res = layoutBoard(raw, rect, measure, true, res.mode); }
    const hp = hanPrim(raw, pad, 0, bw, measure, clamp(bw * 0.2, 46, 70), 'center');
    const hanH = hp ? hp.T.h + 10 : 0;
    const scale = clamp(W / 420, 0.8, 1.1);
    const pnl = panelPrims(raw, pad + 6, 0, bw - 12, measure, scale, 'center');
    const gap = 12;
    // 위에서부터: 한자 제목, 칠판, 판서 요약
    let y = pad;
    const all = [];
    if (hp) { hp.y = y; all.push(hp); y += hanH; }
    const dy = y - rect.y;
    for (const p of res.prims) { shiftPrim(p, dy); all.push(p); }
    const boardRect = { x: pad, y, w: bw, h: bh };
    y += bh + gap;
    for (const p of pnl.prims) { p.y += y; all.push(p); }
    y += pnl.h + pad;
    for (const p of pnl.prims) if (p.overflow) issues.push({ step: raw.id, level: 'warn', kind: 'panel-overflow', detail: p.T.text });
    return { wide, W, kind, mode: res.mode, height: Math.ceil(y), board: boardRect, prims: sortPrims(all), issues: res.issues.concat(issues) };
  }

  const api = {
    VW, VH, WIDE_MIN, COLORS, PANEL_SIZES, STRETCH, TEXT_UNITS,
    isHan: (ch) => HAN_RE.test(ch),
    textSec, hanSec, estimateDuration, elementTimes, staticTimes, stepItems, stepEnd,
    KO_BOOST, splitRuns, boosted, wrapText, layoutText, fitText, fitStack, layoutBoard, planStep, textRect, rectsHit, shiftPrim,
    roundRectPts, shapeOutline, rayExit, polyLength,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ArtLayout = api;
})(typeof window !== 'undefined' ? window : globalThis);
