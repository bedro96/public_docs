/* 칠판 그리기 도구 — Canvas 2D 위에 분필 질감으로 그립니다 (layout.js 가 만든 "조각"을 시간에 맞춰 보여 줍니다).
 *
 * 조각 종류: poly(선·도형) / text(글) / dot(점) / band(옅은 면).  모든 조각은 at(해설 길이 비율) + o0/o1(초) 로 시간이 정해집니다.
 * 이 파일은 DOM 이나 오디오를 건드리지 않고 ctx 에만 그립니다. 분필 끝(tips)은 호출한 쪽이 소리·분필 그림에 씁니다.
 * window.ArtDraw.create(ctx) 로 도구 한 벌을 만듭니다.
 */
(function (root) {
  'use strict';

  const TAU = Math.PI * 2;
  const FONT_FAMILY = "ChalkKorean, ChalkHanja, 'Nanum Pen Script', 'Noto Serif CJK KR', 'Noto Serif KR', 'Apple SD Gothic Neo', 'Malgun Gothic', serif";
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, s, e) => (e > s ? clamp((t - s) / (e - s), 0, 1) : t >= e ? 1 : 0);
  const HAN_RE = /\p{Script=Han}/u;
  const HANGUL_RE = /[가-힣]/;

  function create(ctx) {
    const L = root.ArtLayout;
    const fontStr = (px) => px.toFixed(1) + 'px ' + FONT_FAMILY;
    /** 한 글꼴 크기로 잰 폭 (덩어리 하나) */
    const rawMeasure = (text, px) => { ctx.font = fontStr(px); return ctx.measureText(text).width; };
    /** 한자는 px, 한글·기호는 px × KO_BOOST 로 잰 폭 — layout.js 가 배치에 쓰는 것과 같은 규칙 */
    const measure = L.boosted(rawMeasure);
    /** 글을 한자/그 밖 덩어리로 나눠 각자의 글꼴·가로 위치를 정합니다. 반환: [{ t, x, font }] (x 는 줄 시작 기준) */
    function glyphRuns(text, px) {
      const out = [];
      let x = 0;
      for (const r of L.splitRuns(text)) {
        const font = fontStr(r.han ? px : px * L.KO_BOOST);
        ctx.font = font;
        out.push({ t: r.t, x, font });
        x += ctx.measureText(r.t).width;
      }
      return out;
    }

    /* ---- 분필 질감 ---- */
    let grain = null;
    function applyGrain(W, H) {
      if (!grain) {
        const tile = document.createElement('canvas');
        tile.width = tile.height = 128;
        const tctx = tile.getContext('2d');
        const img = tctx.createImageData(128, 128);
        for (let i = 0; i < img.data.length; i += 4) img.data[i + 3] = Math.random() < 0.34 ? 110 + Math.random() * 145 : 0;
        tctx.putImageData(img, 0, 0);
        grain = ctx.createPattern(tile, 'repeat');
      }
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = grain;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    function arrowHead(x, y, ang, size, color, alpha) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.92 * alpha;
      ctx.beginPath();
      ctx.moveTo(-size, -size * 0.55);
      ctx.lineTo(0, 0);
      ctx.lineTo(-size, size * 0.55);
      ctx.stroke();
      ctx.restore();
    }

    /** runs: glyphRuns() 결과. (x, y) 는 줄 시작과 baseline. 같은 글을 세 겹으로 겹쳐 분필 질감을 냅니다. */
    function chalkGlyphs(runs, x, y, color, size) {
      const pass = (fn) => { for (const r of runs) { ctx.font = r.font; fn(r.t, x + r.x, y); } };
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 3;
      ctx.globalAlpha = 0.92;
      pass((t, px, py) => ctx.fillText(t, px, py));
      ctx.shadowBlur = 0;
      ctx.lineWidth = Math.max(0.6, size * 0.025);
      ctx.globalAlpha = 0.5;
      pass((t, px, py) => ctx.strokeText(t, px, py));
      ctx.globalAlpha = 0.3;
      pass((t, px, py) => ctx.fillText(t, px + 0.7, py + 0.6));
    }

    /** 폴리라인을 limit(px 길이)까지 3겹 분필 선으로 그립니다. 반환: 펜 끝 */
    function strokePolyline(pts, cum, limit, color, w, dash, alpha) {
      const A = alpha === undefined ? 1 : alpha;
      let tip = pts[0];
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = color;
      if (dash) ctx.setLineDash(dash);
      const build = () => {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        let i = 1;
        for (; i < pts.length && cum[i] <= limit; i++) { ctx.lineTo(pts[i][0], pts[i][1]); tip = pts[i]; }
        if (i < pts.length && limit > cum[i - 1]) {
          const f = (limit - cum[i - 1]) / (cum[i] - cum[i - 1]);
          tip = [lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)];
          ctx.lineTo(tip[0], tip[1]);
        }
        ctx.stroke();
      };
      ctx.globalAlpha = 0.16 * A; ctx.lineWidth = w * 2.6; build();
      ctx.globalAlpha = 0.92 * A; ctx.lineWidth = w; build();
      ctx.globalAlpha = 0.4 * A; ctx.lineWidth = Math.max(1, w * 0.45); ctx.translate(0.7, -0.6); build();
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

    function dot(x, y, r, color, alpha, hollow) {
      ctx.save();
      ctx.globalAlpha = alpha * 0.95;
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      if (hollow) { ctx.lineWidth = 2.6; ctx.setLineDash([4, 3.5]); ctx.stroke(); } else { ctx.fill(); ctx.shadowBlur = 0; ctx.globalAlpha = alpha * 0.55; ctx.lineWidth = 1.4; ctx.strokeStyle = '#fffdf2'; ctx.stroke(); }
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

    /**
     * 분필 끝 후보를 기록합니다. tip = { x, y, active?, contact?, unit?, character? }
     *   active  — 지금 그리고 있는 중인가. 다 그린 요소의 끝은 active:false 로 "쉬는" 위치만 알립니다.
     *   contact — 분필이 칠판에 닿아 있는가. false 면 그림은 그려지지만 소리는 없습니다.
     *   unit    — 소리 조각 식별자(site 와 합쳐 단계 안에서 유일). 바뀌면 새 조각이 시작됩니다.
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

    function linePrefix(ln, px) {
      if (!ln.pre || ln.preFont !== px) {
        const pre = [0];
        const cs = Array.from(ln.text);
        for (let k = 1; k <= cs.length; k++) pre.push(measure(cs.slice(0, k).join(''), px));
        ln.pre = pre;
        ln.preFont = px;
      }
      return ln.pre;
    }

    /**
     * 글을 p(0~1)만큼 써 줍니다. (x, y)는 align 에 따른 가로 기준점과 글 덩어리의 맨 위.
     * 반환: 분필 끝 { x, y, active, contact, unit, character }.
     *   한글 한 글자는 2획, 한자는 3획, 그 밖은 1획으로 보고 각 획의 앞 70% 만 칠판에 닿습니다(공백은 닿지 않음).
     */
    function drawText(T, x, y, p, color, align, knock) {
      if (p <= 0) return null;
      const f = p >= 1 ? Infinity : p * T.n;
      let acc = 0;
      let tip = null;
      ctx.save();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      for (let li = 0; li < T.lines.length; li++) {
        const ln = T.lines[li];
        if (acc >= f) break;
        const ox = align === 'right' ? -ln.w : align === 'center' ? -ln.w / 2 : 0;
        const sx = x + ox;
        const fp = T.fpx || T.px;
        const by = y + li * T.lh + fp * (T.ko ? 0.82 : 0.92);
        let width = ln.w;
        const partial = acc + ln.n > f;
        let contact = false;
        let unit = 't' + T.uid + ':' + li;
        let character = '';
        let shown = ln.text;
        if (partial) {
          const pre = linePrefix(ln, T.px);
          const cs = Array.from(ln.text);
          const kf = f - acc;
          const k = Math.min(ln.n - 1, Math.floor(kf));
          width = pre[k] + (pre[k + 1] - pre[k]) * (kf - k);
          character = cs[k] || '';
          const strokes = HANGUL_RE.test(character) ? 2 : HAN_RE.test(character) ? 3 : 1;
          const strokePos = (kf - k) * strokes;
          const stroke = Math.min(strokes - 1, Math.floor(strokePos));
          contact = !/\s/.test(character) && strokePos - stroke < 0.7;
          unit += ':' + k + ':' + stroke;
          shown = cs.slice(0, k + 1).join('');
        }
        ctx.save();
        if (partial) { ctx.beginPath(); ctx.rect(sx - 6, by - fp * 1.2, width + 6, fp * 1.8); ctx.clip(); }
        const runs = glyphRuns(shown, T.px);
        if (knock) {
          // 글 뒤의 점선·화살표를 부드러운 둥근 사각형으로 지웁니다
          ctx.globalCompositeOperation = 'destination-out';
          ctx.fillStyle = '#000';
          const kh = fp * (T.ko ? 0.98 : 1.0);
          roundedRect(sx - 6, by - fp * (T.ko ? 0.78 : 0.86), width + 12, kh, Math.min(8, kh / 2));
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
        }
        chalkGlyphs(runs, sx, by, color, fp);
        ctx.restore();
        tip = { x: sx + width, y: by - fp * 0.3, active: p < 1, contact, unit, character };
        acc += ln.n;
        if (partial) break;
      }
      ctx.restore();
      return tip;
    }

    /** 조각 목록을 시각 tt 에 맞춰 그립니다. D 는 해설 길이(초). 반환 없음(분필 끝은 tips 에 쌓입니다). */
    function renderPrims(prims, tt, D, tips) {
      for (const p of prims) {
        const start = p.at * D + p.o0;
        const end = p.at * D + p.o1;
        const pr = seg(tt, start, end);
        if (pr <= 0) continue;
        if (p.type === 'poly') {
          if (p.fill) {
            ctx.save();
            ctx.globalAlpha = p.fill.alpha * seg(pr, 0.15, 1);
            ctx.fillStyle = p.fill.color;
            ctx.beginPath();
            ctx.moveTo(p.pts[0][0], p.pts[0][1]);
            for (let i = 1; i < p.pts.length; i++) ctx.lineTo(p.pts[i][0], p.pts[i][1]);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
          const tipPt = strokePolyline(p.pts, p.cum, p.len * pr, p.color, p.w, p.dash, p.alpha);
          if (p.arrow && pr >= 0.98) {
            const n = p.pts.length;
            const a = p.pts[n - 2];
            const b = p.pts[n - 1];
            arrowHead(b[0], b[1], Math.atan2(b[1] - a[1], b[0] - a[0]), 11, p.color, p.alpha);
          }
          noteTip(tips, start, { x: tipPt.x, y: tipPt.y, active: pr < 1 }, p.site);
        } else if (p.type === 'text') {
          noteTip(tips, start, drawText(p.T, p.x, p.y, pr, p.color, p.align, p.knock), p.site);
        } else if (p.type === 'dot') {
          dot(p.x, p.y, p.r * (0.4 + 0.6 * pr), p.color, pr, p.hollow);
          noteTip(tips, start, { x: p.x, y: p.y, active: pr < 1 }, p.site);
        } else if (p.type === 'band') {
          ctx.save();
          ctx.globalAlpha = p.alpha * pr;
          ctx.fillStyle = p.color;
          roundedRect(p.x, p.y, p.w, p.h, p.r);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    /** 칠판 안쪽의 그림 영역 테두리 */
    function boardOutline(rect) {
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = '#f3f0e4';
      ctx.lineWidth = 1.6;
      roundedRect(rect.x - 2, rect.y - 2, rect.w + 4, rect.h + 4, 12);
      ctx.stroke();
      ctx.restore();
    }

    return { fontStr, measure, applyGrain, strokePolyline, drawText, dot, drawChalkPiece, noteTip, renderPrims, boardOutline, roundedRect };
  }

  root.ArtDraw = { create, FONT_FAMILY, seg, clamp };
})(typeof window !== 'undefined' ? window : globalThis);
