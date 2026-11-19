/* 일차함수 칠판 강의 재생기 — 외부 의존성 없는 단일 파일 플레이어.
 *
 * 빌드 계약: window.LESSON_DATA (lesson.json + narrationProvider + 장별 audio/duration)가 먼저 정의되어야 합니다.
 * 해설 음성은 장마다 내장된 Foundry(MAI-Voice-2) MP3 하나뿐이며, 브라우저 음성합성(speechSynthesis) 같은
 * 다른 음성 제공자로는 절대 대체하지 않습니다. 오디오가 실패하면 오류를 표시하고 판서·자막만으로 계속합니다.
 */
(function () {
  'use strict';

  const DATA = window.LESSON_DATA;
  const byId = (id) => document.getElementById(id);

  if (!DATA || !Array.isArray(DATA.chapters) || DATA.chapters.length === 0) {
    const fatal = byId('fatal');
    if (fatal) fatal.hidden = false;
    return;
  }

  /* ====================================================================
   * 0. 상수 · 수학/서식 도우미
   * ==================================================================== */
  const TAU = Math.PI * 2;
  const COLORS = { white: '#f3f0e4', mint: '#86efc6', yellow: '#ffe27d', pink: '#ff9fc4' };
  const COLOR_KO = { white: '흰색', mint: '민트색', yellow: '노란색', pink: '분홍색' };
  // 손글씨 글꼴에 없는 Δ · → ↗ ① 같은 기호는 시스템 기호/수학 글꼴이 글자 단위로 채웁니다.
  const FONT_FAMILY = "ChalkKorean, 'Nanum Pen Script', 'Segoe UI Symbol', 'Apple Symbols', 'Noto Sans Math', 'Noto Sans Symbols 2', 'DejaVu Sans', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', 'Noto Sans CJK KR', sans-serif";
  const AXIS_R = 6.5; // 보이는 좌표 범위: -6.5 ~ 6.5 (가로세로 동일 배율)
  const TICK_MAX = 6; // 눈금: -6 ~ 6
  const CHAPTER_GAP = 0.9; // 판서·음성이 모두 끝난 뒤 다음 단원까지의 여유(초)
  const SPEEDS = [0.75, 1, 1.25, 1.5];
  const LAB_DEFAULT = { a: 1, b: 1 };
  const INITIAL_STATUS = '재생 버튼을 누르면 판서와 한국어 해설이 시작됩니다';

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, s, e) => (e > s ? clamp((t - s) / (e - s), 0, 1) : t >= e ? 1 : 0);
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const fontStr = (px) => px.toFixed(1) + 'px ' + FONT_FAMILY;

  function fmt(n) {
    const r = Math.round(n * 100) / 100;
    return String(r === 0 ? 0 : r);
  }
  function fmtApprox(n) {
    const r = Math.round(n * 100) / 100;
    return (Math.abs(r - n) > 1e-9 ? '≈' : '') + fmt(n);
  }
  function signed(n) {
    return n > 0 ? '+' + fmt(n) : fmt(n);
  }
  /** y = ax + b 를 "+ -" 없이, a = ±1 은 x / -x, a = 0 은 상수식으로 표기 */
  function lineEquation(a, b) {
    if (a === 0) return 'y = ' + fmt(b);
    let term = a === 1 ? 'x' : a === -1 ? '-x' : fmt(a) + 'x';
    if (b > 0) term += ' + ' + fmt(b);
    else if (b < 0) term += ' - ' + fmt(-b);
    return 'y = ' + term;
  }
  function formatClock(sec) {
    const s = Math.max(0, Math.floor(sec || 0));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  /* ====================================================================
   * 1. 강의 데이터 정규화
   * ==================================================================== */
  const PROVIDER = DATA.narrationProvider && typeof DATA.narrationProvider === 'object' ? DATA.narrationProvider : null;
  const VOICE_LABEL = PROVIDER && PROVIDER.model ? 'Foundry · ' + PROVIDER.model + ' 한국어 AI 음성' : 'AI 합성 한국어 음성';

  const CH = DATA.chapters.map((c, i) => ({
    id: String(c.id || 'chapter-' + (i + 1)),
    title: String(c.title || ''),
    kicker: String(c.kicker || ''),
    summary: String(c.summary || ''),
    formula: String(c.formula || ''),
    a: Number(c.a) || 0,
    b: Number(c.b) || 0,
    points: Array.isArray(c.points) ? c.points.map((p) => ({ x: Number(p.x), y: Number(p.y), label: p.label ? String(p.label) : '' })) : [],
    rise: c.rise && Number(c.rise.dx) !== 0 ? { x: Number(c.rise.x), y: Number(c.rise.y), dx: Number(c.rise.dx), dy: Number(c.rise.dy) } : null,
    compare: Array.isArray(c.compare) ? c.compare.map((q) => ({ a: Number(q.a) || 0, b: Number(q.b) || 0, label: q.label ? String(q.label) : '', color: COLORS[q.color] ? q.color : 'white' })) : [],
    notes: (Array.isArray(c.notes) ? c.notes : []).slice(0, 4).map((n) => ({ text: String(n.text || ''), tone: COLORS[n.tone] ? n.tone : 'white' })),
    narration: String(c.narration || ''),
    audio: typeof c.audio === 'string' && c.audio ? c.audio : '',
    duration: Number(c.duration) > 0 ? Number(c.duration) : 0,
  }));
  const N = CH.length;
  const HAS_AUDIO = CH.some((c) => c.audio);

  function mainLineLabel(ch) {
    let s = lineEquation(ch.a, ch.b);
    if (/a\s*x/.test(ch.formula)) s += ' (예: a = ' + fmt(ch.a) + ', b = ' + fmt(ch.b) + ')';
    else if (ch.a === 0) s += ' (수평선)';
    return s;
  }

  function pointColor(ch, p) {
    if (Math.abs(ch.a * p.x + ch.b - p.y) < 1e-9) return 'mint';
    for (const c of ch.compare) if (Math.abs(c.a * p.x + c.b - p.y) < 1e-9) return c.color;
    return 'yellow';
  }

  /** 장 하나의 그림 요소(선·점·삼각형). 좌표계와 무관한 순수 데이터 */
  function buildScene(ch) {
    const lines = [{ key: 'line', a: ch.a, b: ch.b, color: 'mint', width: 3.8, label: mainLineLabel(ch) }];
    ch.compare.forEach((c, i) => lines.push({ key: 'cmp' + i, a: c.a, b: c.b, color: c.color, width: 3.4, label: c.label || lineEquation(c.a, c.b) }));
    const points = ch.points.map((p, i) => ({
      key: 'pt' + i, x: p.x, y: p.y, color: pointColor(ch, p),
      label: p.label || '(' + fmt(p.x) + ', ' + fmt(p.y) + ')',
    }));
    // 기울기 0 장: 대본이 언급하는 수직선 x = 2 를 점선으로 함께 보여 줌
    const vline = ch.id === 'zero' ? { key: 'vline', x: 2, color: 'pink', label: 'x = 2 (수직선 · 함수 아님)' } : null;
    return { lines, points, rise: ch.rise ? { key: 'rise', ...ch.rise } : null, vline };
  }
  const SCENES = CH.map(buildScene);

  function describeLine(a, b) {
    if (a === 0) return '수평선 y = ' + fmt(b) + ' (기울기 0)';
    return '오른쪽으로 갈수록 ' + (a > 0 ? '올라가는' : '내려가는') + ' 직선 ' + lineEquation(a, b) + ', 기울기 ' + fmt(a) + ', y절편 ' + fmt(b);
  }
  function describeChapter(ch, scene) {
    const out = ['좌표평면: x축과 y축 모두 -6부터 6까지 눈금 간격 1, 가로세로 눈금 크기가 같습니다.'];
    scene.lines.forEach((l) => out.push(COLOR_KO[l.color] + ' 그래프: ' + describeLine(l.a, l.b) + '.'));
    if (scene.vline) out.push('분홍색 점선: x = 2인 수직선.');
    if (scene.points.length) out.push('표시한 점: ' + scene.points.map((p) => p.label).join(', ') + '.');
    if (scene.rise) {
      const r = scene.rise;
      out.push('기울기 삼각형: (' + fmt(r.x) + ', ' + fmt(r.y) + ')에서 오른쪽으로 ' + fmt(r.dx) + '칸, ' + (r.dy >= 0 ? '위로 ' : '아래로 ') + fmt(Math.abs(r.dy)) + '칸 이동.');
    }
    return out.join(' ');
  }

  /* ====================================================================
   * 2. DOM 참조
   * ==================================================================== */
  const el = {
    title: byId('lesson-title'), subtitle: byId('lesson-subtitle'), count: byId('lesson-count'), chip: byId('voice-chip-label'),
    stage: byId('board-stage'), canvas: byId('board'), hint: byId('board-hint'),
    kicker: byId('board-kicker'), boardTitle: byId('board-title'), boardCount: byId('board-count'),
    legend: byId('legend'), sr: byId('board-sr'),
    status: byId('status'), time: byId('time'), progress: byId('progress'), fill: byId('progress-fill'),
    prev: byId('prev'), play: byId('play'), playIcon: byId('play-icon'), playLabel: byId('play-label'), next: byId('next'),
    replay: byId('replay'), restart: byId('restart'),
    voiceToggle: byId('voice-toggle'), chalkToggle: byId('chalk-toggle'), speed: byId('speed'),
    chalkVolume: byId('chalk-volume'), chalkVolumeValue: byId('chalk-volume-value'), chalkNote: byId('chalk-note'),
    voiceLabel: byId('voice-label'), voiceNote: byId('voice-note'),
    chapters: byId('chapters'), summary: byId('summary'), narration: byId('narration'),
    captionToggle: byId('caption-toggle'), captionBody: byId('caption-body'),
    lab: byId('lab'), labEq: byId('lab-equation'), labDesc: byId('lab-description'), labCanvas: byId('lab-canvas'), labLegend: byId('lab-legend'),
    slope: byId('slope'), intercept: byId('intercept'), slopeValue: byId('slope-value'), interceptValue: byId('intercept-value'),
    labCompare: byId('lab-compare'), labReset: byId('lab-reset'),
    quiz: byId('quiz'), quizQuestion: byId('quiz-question'), quizOptions: byId('quiz-options'), quizFeedback: byId('quiz-feedback'),
    quizRetry: byId('quiz-retry'), quizToLab: byId('quiz-to-lab'),
  };
  const bctx = el.canvas.getContext('2d');
  const lctx = el.labCanvas.getContext('2d');

  const ICON = {
    play: '<svg viewBox="0 0 24 24" focusable="false"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24" focusable="false"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>',
    replay: '<svg viewBox="0 0 24 24" focusable="false"><path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z" fill="currentColor"/></svg>',
  };

  /* ====================================================================
   * 3. 분필 소리 (Web Audio) — 판서 중일 때만, 사용자의 재생 클릭 뒤에만 생성
   * ==================================================================== */
  const chalk = (() => {
    const MAX_GAIN = 0.3;
    let volume = 25;
    let ctx = null, buffer = null, master = null, current = null, loading = null;
    let cursor = 0;
    let error = '';

    function fail(reason) {
      error = '분필 녹음을 재생하지 못했어요. 분필 소리를 끄고 강의를 계속할 수 있어요. (' + reason + ')';
      el.chalkNote.textContent = error;
      el.chalkNote.className = 'voice-note is-error';
      stop();
    }

    function ensure() {
      if (ctx) return ctx;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { fail('이 브라우저는 Web Audio를 지원하지 않습니다'); return null; }
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = MAX_GAIN * volume / 100;
        master.connect(ctx.destination);
      } catch (e) {
        fail(e.message);
        return null;
      }
      return ctx;
    }

    function unlock() {
      const c = ensure();
      if (!c || error) return;
      if (c.state === 'suspended') c.resume().catch((e) => fail(e.message));
      if (!loading) {
        loading = (async () => {
          const sample = DATA.chalkSound;
          if (!sample || !sample.audio) throw new Error('내장된 실제 분필 녹음이 없습니다');
          const bytes = Uint8Array.from(atob(sample.audio.split(',')[1]), (char) => char.charCodeAt(0));
          buffer = await c.decodeAudioData(bytes.buffer);
          if (buffer.duration < 4) throw new Error('분필 녹음이 너무 짧습니다');
        })().catch((e) => fail(e.message));
      }
    }

    /** 획이 끝날 때 4ms만 감쇠해 클릭음을 막고, 다음 글자까지 실제로 무음이 되게 합니다. */
    function stop() {
      if (!current || !ctx) return;
      const voice = current;
      current = null;
      const t = ctx.currentTime;
      voice.envelope.gain.cancelScheduledValues(t);
      voice.envelope.gain.setValueAtTime(voice.envelope.gain.value, t);
      voice.envelope.gain.linearRampToValueAtTime(0, t + 0.004);
      voice.source.stop(t + 0.005);
      cursor = (voice.offset + Math.max(0.06, t - voice.started) + 0.137) % (buffer.duration - 4);
    }

    function update(contact) {
      if (!contact || volume === 0) { stop(); return; }
      if (!buffer || !ctx || ctx.state !== 'running' || error) return;
      if (current && current.id === contact.id) return;
      stop();
      const t = ctx.currentTime;
      const source = ctx.createBufferSource();
      const envelope = ctx.createGain();
      source.buffer = buffer;
      envelope.gain.setValueAtTime(0, t);
      envelope.gain.linearRampToValueAtTime(1, t + 0.004);
      source.connect(envelope);
      envelope.connect(master);
      const voice = { source, envelope, id: contact.id, started: t, offset: cursor };
      source.onended = () => {
        source.disconnect();
        envelope.disconnect();
        if (current === voice) current = null;
      };
      current = voice;
      source.start(t, cursor);
    }

    function setVolume(value) {
      volume = clamp(Number(value), 0, 100);
      if (master) master.gain.setValueAtTime(MAX_GAIN * volume / 100, ctx.currentTime);
      if (volume === 0) stop();
      el.chalkVolumeValue.value = Math.round(volume) + '%';
      el.chalkVolume.setAttribute('aria-valuetext', Math.round(volume) + '퍼센트');
    }
    return { unlock, update, stop, setVolume, state: () => ({ volume, ready: !!buffer, error }) };
  })();

  /* ====================================================================
   * 4. 재생 상태
   * ==================================================================== */
  const motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let reduced = !!(motionQuery && motionQuery.matches);

  let index = 0;
  let playing = false;
  let ended = false;
  let everStarted = false;
  let drawT = 0; // 판서 시계 (단원 안에서 흐르는 "해설 시간" 초 단위)
  let completeHold = 0;
  let timeline = null;
  let speed = 1;
  let voiceEnabled = true;
  let chalkEnabled = true;
  let rafId = 0;
  let lastTs = 0;
  let fontEpoch = 0;
  let penContact = null;
  let writingCharacter = '';

  // 해설(내장 MP3) 상태
  const audio = new Audio();
  audio.preload = 'auto';
  try { audio.preservesPitch = true; } catch (e) { /* noop */ }
  let audioLoaded = -1; // audio.src가 가리키는 단원
  let voiceMode = 'idle'; // 'idle' | 'embedded' | 'error' | 'off'
  let voiceStarted = false;
  let voiceDone = false;
  let voiceError = '';
  let playToken = 0;
  let selfPause = false;
  const knownDur = {};

  const durationFor = (i) => CH[i].duration || knownDur[i] || 0;
  const drawDone = () => timeline && drawT >= timeline.total - 1e-6;
  const effectiveT = () => (reduced ? timeline.total : drawT);
  const audioIsMaster = () => voiceMode === 'embedded' && audioLoaded === index && voiceStarted && !voiceDone && !audio.paused;

  function audioTime() {
    return voiceMode === 'embedded' && audioLoaded === index && voiceStarted ? audio.currentTime || 0 : 0;
  }
  function audioDuration() {
    if (audioLoaded === index && isFinite(audio.duration) && audio.duration > 0) return audio.duration;
    return durationFor(index);
  }
  function chapterProgress() {
    if (ended) return 1;
    let p;
    const D = audioDuration();
    if (voiceMode === 'embedded' && voiceStarted && D > 0) p = clamp(audioTime() / D, 0, 1);
    else p = timeline && timeline.total > 0 ? clamp(drawT / timeline.total, 0, 1) : 0;
    if (voiceStarted && voiceDone && drawDone()) return 1;
    if (!drawDone() || !voiceDone) p = Math.min(p, 0.999);
    return p;
  }

  /* ---------- 타임라인: 단계별 [시작, 끝] (초) ---------- */
  function buildTimeline(i, D) {
    const ch = CH[i];
    const sc = SCENES[i];
    const steps = [];
    steps.push({ key: 'formula', dur: clamp(ch.formula.length * 0.085, 1.2, 2.4) });
    ch.notes.forEach((n, k) => steps.push({ key: 'note' + k, dur: clamp(n.text.length * 0.075, 1.1, 2.2) }));
    steps.push({ key: 'axes', dur: 2.4 });
    const pt = (k) => steps.push({ key: 'pt' + k, dur: 0.75 });
    if (sc.rise) {
      if (sc.points.length) pt(0);
      steps.push({ key: 'rise', dur: 1.9 });
      for (let k = 1; k < sc.points.length; k++) pt(k);
    } else {
      sc.points.forEach((_, k) => pt(k));
    }
    steps.push({ key: 'line', dur: 1.8 });
    sc.lines.slice(1).forEach((_, k) => steps.push({ key: 'cmp' + k, dur: 1.6 }));
    if (sc.vline) steps.push({ key: 'vline', dur: 1.4 });

    const base = steps.reduce((s, x) => s + x.dur, 0);
    const lead = 0.4;
    let scale = 1;
    let gap = 0.25;
    if (D > 0) {
      // 판서가 해설 길이의 약 92% 안에 끝나도록 속도와 쉬는 구간을 배분
      const avail = Math.max(D * 0.92 - lead, base * 0.6);
      scale = clamp(avail / base, 0.85, 1.4);
      gap = Math.max(0, (avail - base * scale) / steps.length);
    }
    let t = lead;
    const map = {};
    steps.forEach((s) => {
      t += gap;
      const dur = s.dur * scale;
      map[s.key] = { start: t, end: t + dur };
      t += dur;
    });
    return { map, order: steps.map((s) => s.key), total: t + 0.5, D };
  }

  /* ====================================================================
   * 5. 칠판 레이아웃 (왼쪽 글 · 오른쪽 그래프 / 좁은 화면은 세로 배치)
   * ==================================================================== */
  const board = { W: 0, H: 0, dpr: 1, key: '', geom: null, ticks: null, chapters: [], tipScale: 1 };

  function textRun(ctx, text, size) {
    const font = fontStr(size);
    ctx.font = font;
    const prefix = new Array(text.length + 1);
    prefix[0] = 0;
    for (let i = 1; i <= text.length; i++) prefix[i] = ctx.measureText(text.slice(0, i)).width;
    return { text, size, font, prefix, width: prefix[text.length] };
  }

  function wrapText(ctx, text, size, maxW) {
    ctx.font = fontStr(size);
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const trial = cur ? cur + ' ' + w : w;
      if (!cur || ctx.measureText(trial).width <= maxW) cur = trial;
      else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function computeGeom(W) {
    const narrow = W < 720;
    const pad = W < 520 ? 14 : 22;
    const scale = narrow ? clamp(W / 400, 0.82, 1.2) : clamp(W / 1100, 0.72, 1);
    const g = { W, narrow, pad, scale, baseF: (narrow ? 40 : 54) * scale, baseN: (narrow ? 26 : 34) * scale };
    g.formulaH = Math.round(g.baseF * 1.25 + 16);
    g.fnGap = Math.round(14 * scale);
    if (!narrow) {
      const H = Math.round(clamp(W * 0.5, 400, 580));
      const side = Math.min(H - pad * 2, W - pad * 3 - 250);
      g.H = H;
      g.plot = { x: W - pad - side, y: Math.round((H - side) / 2), size: side };
      g.text = { x: pad, w: W - side - pad * 3, h: H - pad * 2 };
      g.formulaY = pad;
      g.notesY = pad + g.formulaH + g.fnGap;
    } else {
      g.text = { x: pad, w: W - pad * 2, h: Infinity };
      g.side = Math.min(W - pad * 2, 520);
    }
    return g;
  }

  function layoutChapterText(ch, g) {
    const ctx = bctx;
    const boxW = g.text.w;
    const budget = g.narrow ? Infinity : g.text.h - g.formulaH - g.fnGap;
    const scales = g.narrow ? [1, 0.92, 0.84] : [1, 0.93, 0.86, 0.8, 0.74, 0.68, 0.62, 0.56, 0.5];
    let best = null;
    for (const s of scales) {
      // 수식: 한 줄에 맞을 때까지 글자 크기를 줄임
      let fs = g.baseF * s;
      let run = textRun(ctx, ch.formula, fs);
      if (run.width > boxW) {
        fs = Math.max(14, fs * (boxW / run.width) * 0.98);
        run = textRun(ctx, ch.formula, fs);
      }
      // 메모: 최대 2줄(작을 때 3줄)로 감싸 오른쪽 그래프와 겹치지 않게
      const notes = layoutNotes(ch, boxW, g.baseN * s);
      best = { formula: { run, baseline: Math.min(run.size * 0.98, g.formulaH - 12) }, notes: notes.items, notesH: notes.height, scale: s };
      if (notes.height <= budget) break;
    }
    return best;
  }

  function layoutNotes(ch, boxW, n0) {
    const ctx = bctx;
    const attempt = (n, maxLines, strict) => {
      const indent = n * 0.8;
      const maxW = boxW - indent;
      const lineH = n * 1.22;
      const gap = n * 0.5;
      let y = 0;
      const items = [];
      for (const note of ch.notes) {
        const lines = wrapText(ctx, note.text, n, maxW);
        if (strict && lines.length > maxLines) return null;
        const runs = lines.map((l) => textRun(ctx, l, n));
        if (strict && runs.some((r) => r.width > maxW + 0.5)) return null;
        items.push({
          tone: note.tone, size: n, indent, top: y, chars: note.text.length,
          firstBase: n * 0.95,
          lines: runs.map((run, k) => ({ run, y: n * 0.95 + k * lineH })),
        });
        y += runs.length * lineH + gap;
      }
      return { items, height: Math.max(0, y - gap) };
    };
    for (let n = Math.round(n0); n >= 14; n -= 1) {
      const res = attempt(n, n <= 20 ? 3 : 2, true);
      if (res) return res;
    }
    return attempt(14, 4, false);
  }

  function makeGraph(x, y, size) {
    const R = AXIS_R;
    const unit = size / (2 * R);
    return { x, y, size, R, unit, X: (v) => x + (v + R) * unit, Y: (v) => y + (R - v) * unit };
  }

  /** y = ax + b 를 정사각형 [-R,R]² 에 해석적으로 자른 선분 (없으면 null) */
  function clipLine(a, b, R) {
    if (a === 0) return b < -R || b > R ? null : [-R, b, R, b];
    const t1 = (-R - b) / a;
    const t2 = (R - b) / a;
    const xl = Math.max(-R, Math.min(t1, t2));
    const xh = Math.min(R, Math.max(t1, t2));
    if (xl > xh) return null;
    return [xl, a * xl + b, xh, a * xh + b];
  }

  function computeTicks(ctx, g) {
    const size = Math.round(clamp(g.unit * 0.52, 12, 18));
    const font = fontStr(size);
    ctx.font = font;
    const h = size * 1.1;
    const xs = [];
    const ys = [];
    for (let k = -TICK_MAX; k <= TICK_MAX; k++) {
      if (k === 0) continue;
      const text = String(k);
      const w = ctx.measureText(text).width;
      xs.push({ v: k, text, rect: { x: g.X(k) - w / 2, y: g.Y(0) + 5, w, h } });
      ys.push({ v: k, text, rect: { x: g.X(0) - 7 - w, y: g.Y(k) - h / 2, w, h } });
    }
    const named = (text, x, y) => ({ text, rect: { x, y, w: ctx.measureText(text).width, h } });
    const ow = ctx.measureText('O').width;
    return {
      size, font, h, xs, ys,
      origin: named('O', g.X(0) - 7 - ow, g.Y(0) + 4),
      xName: named('x', g.X(AXIS_R) - 22, g.Y(0) - 6 - h),
      yName: named('y', g.X(0) + 9, g.Y(AXIS_R) + 5),
    };
  }

  /* ---------- 라벨 배치: 눈금 글자·축·직선·다른 라벨과 겹치지 않는 자리를 고름 ---------- */
  const DIRS = {
    ru: (ax, ay, w, h, d) => ({ x: ax + d, y: ay - d - h }),
    rd: (ax, ay, w, h, d) => ({ x: ax + d, y: ay + d }),
    lu: (ax, ay, w, h, d) => ({ x: ax - d - w, y: ay - d - h }),
    ld: (ax, ay, w, h, d) => ({ x: ax - d - w, y: ay + d }),
    r: (ax, ay, w, h, d) => ({ x: ax + d + 2, y: ay - h / 2 }),
    l: (ax, ay, w, h, d) => ({ x: ax - d - w - 2, y: ay - h / 2 }),
    u: (ax, ay, w, h, d) => ({ x: ax - w / 2, y: ay - d - h }),
    d: (ax, ay, w, h, d) => ({ x: ax - w / 2, y: ay + d }),
  };
  const ORDER_POINT = ['rd', 'ru', 'lu', 'ld', 'r', 'u', 'd', 'l'];
  const ORDER_RUN = ['u', 'd', 'ru', 'rd', 'lu', 'ld', 'r', 'l'];
  const ORDER_RISE = ['r', 'l', 'ru', 'rd', 'lu', 'ld', 'u', 'd'];

  const rectsOverlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  function segHitsRect(s, r) {
    let t0 = 0;
    let t1 = 1;
    const dx = s.x1 - s.x0;
    const dy = s.y1 - s.y0;
    const p = [-dx, dx, -dy, dy];
    const q = [s.x0 - r.x, r.x + r.w - s.x0, s.y0 - r.y, r.y + r.h - s.y0];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) {
        if (q[i] < 0) return false;
      } else {
        const t = q[i] / p[i];
        if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
      }
    }
    return true;
  }

  function buildObstacles(g, scene, ticks) {
    const rects = [];
    const segs = [];
    ticks.xs.concat(ticks.ys).forEach((t) => rects.push({ ...t.rect, owner: '' }));
    [ticks.origin, ticks.xName, ticks.yName].forEach((t) => rects.push({ ...t.rect, owner: '' }));
    segs.push({ x0: g.X(-g.R), y0: g.Y(0), x1: g.X(g.R), y1: g.Y(0) });
    segs.push({ x0: g.X(0), y0: g.Y(-g.R), x1: g.X(0), y1: g.Y(g.R) });
    scene.lines.forEach((l) => {
      const c = clipLine(l.a, l.b, g.R);
      if (c) segs.push({ x0: g.X(c[0]), y0: g.Y(c[1]), x1: g.X(c[2]), y1: g.Y(c[3]) });
    });
    if (scene.vline) segs.push({ x0: g.X(scene.vline.x), y0: g.Y(-g.R), x1: g.X(scene.vline.x), y1: g.Y(g.R) });
    if (scene.rise) {
      const r = scene.rise;
      segs.push({ x0: g.X(r.x), y0: g.Y(r.y), x1: g.X(r.x + r.dx), y1: g.Y(r.y) });
      segs.push({ x0: g.X(r.x + r.dx), y0: g.Y(r.y), x1: g.X(r.x + r.dx), y1: g.Y(r.y + r.dy) });
    }
    scene.points.forEach((p) => rects.push({ x: g.X(p.x) - 8, y: g.Y(p.y) - 8, w: 16, h: 16, owner: p.key }));
    return { rects, segs };
  }

  function placeLabel(item, g, obs, placed) {
    const { w, h } = item;
    const inset = 2;
    let best = null;
    [1, 1.8, 2.7].forEach((mult, di) => {
      item.order.forEach((name, oi) => {
        const pos = DIRS[name](item.ax, item.ay, w, h, item.gap * mult);
        const pad = 3;
        const rect = { x: pos.x - pad, y: pos.y - pad, w: w + pad * 2, h: h + pad * 2 };
        let score = oi * 0.5 + di * 4;
        const ox = Math.max(0, g.x + inset - rect.x, rect.x + rect.w - (g.x + g.size - inset));
        const oy = Math.max(0, g.y + inset - rect.y, rect.y + rect.h - (g.y + g.size - inset));
        if (ox > 0 || oy > 0) score += 500 + ox + oy;
        obs.rects.forEach((r) => { if (r.owner !== item.owner && rectsOverlap(rect, r)) score += 100; });
        obs.segs.forEach((s) => { if (segHitsRect(s, rect)) score += 80; });
        placed.forEach((r) => { if (rectsOverlap(rect, r)) score += 150; });
        if (!best || score < best.score) best = { score, x: pos.x, y: pos.y, rect };
      });
    });
    return best;
  }

  function computeLabels(ctx, g, scene, ticks) {
    const size = Math.round(clamp(g.unit * 0.6, 14, 22));
    const compact = g.unit < 30;
    const obs = buildObstacles(g, scene, ticks);
    const items = [];
    scene.points.forEach((p) => items.push({ key: p.key, text: p.label, ax: g.X(p.x), ay: g.Y(p.y), order: ORDER_POINT, gap: 11, owner: p.key }));
    if (scene.rise) {
      const r = scene.rise;
      items.push({
        key: 'run', text: compact ? signed(r.dx) : 'Δx = ' + fmt(r.dx),
        ax: (g.X(r.x) + g.X(r.x + r.dx)) / 2, ay: g.Y(r.y), order: ORDER_RUN, gap: 7, owner: '',
      });
      items.push({
        key: 'rise', text: compact ? signed(r.dy) : 'Δy = ' + fmt(r.dy),
        ax: g.X(r.x + r.dx), ay: (g.Y(r.y) + g.Y(r.y + r.dy)) / 2, order: ORDER_RISE, gap: 7, owner: '',
      });
    }
    const out = {};
    const placed = [];
    items.forEach((it) => {
      const run = textRun(ctx, it.text, size);
      it.w = run.width;
      it.h = size * 1.15;
      const pos = placeLabel(it, g, obs, placed);
      placed.push(pos.rect);
      out[it.key] = { run, x: pos.x, y: pos.y, size, h: it.h };
    });
    return out;
  }

  function buildBoardLayout(W, dpr, key) {
    const g = computeGeom(W);
    const texts = CH.map((ch) => layoutChapterText(ch, g));
    if (g.narrow) {
      const notesH = Math.max(...texts.map((t) => t.notesH));
      g.formulaY = g.pad;
      const plotY = g.formulaY + g.formulaH + g.fnGap;
      g.plot = { x: Math.round((W - g.side) / 2), y: plotY, size: g.side };
      g.notesY = plotY + g.side + g.fnGap + 4;
      g.H = Math.ceil(g.notesY + notesH + g.pad);
    }
    g.graph = makeGraph(g.plot.x, g.plot.y, g.plot.size);
    board.W = W; board.H = g.H; board.dpr = dpr; board.key = key; board.geom = g;
    board.tipScale = clamp(W / 900, 0.8, 1.15);
    el.canvas.width = Math.round(W * dpr);
    el.canvas.height = Math.round(g.H * dpr);
    el.canvas.style.height = g.H + 'px';
    board.ticks = computeTicks(bctx, g.graph);
    board.chapters = CH.map((ch, i) => ({
      text: texts[i],
      scene: SCENES[i],
      labels: computeLabels(bctx, g.graph, SCENES[i], board.ticks),
    }));
  }

  function ensureLayout() {
    const W = Math.max(280, Math.floor(el.stage.clientWidth || 640));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const key = W + '|' + dpr + '|' + fontEpoch;
    if (board.key !== key) buildBoardLayout(W, dpr, key);
    return board;
  }

  /* ====================================================================
   * 6. 분필 그리기 도구
   * ==================================================================== */
  const grainTiles = new WeakMap();
  function applyGrain(ctx, W, H) {
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

  function chalkLine(ctx, x0, y0, x1, y1, color, w, dash) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    if (dash) ctx.setLineDash(dash);
    const path = () => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
    ctx.globalAlpha = 0.16; ctx.lineWidth = w * 2.6; path(); // 분필 가루 번짐
    ctx.globalAlpha = 0.92; ctx.lineWidth = w; path();
    ctx.globalAlpha = 0.4; ctx.lineWidth = Math.max(1, w * 0.45); ctx.translate(0.7, -0.6); path();
    ctx.restore();
  }

  function arrowHead(ctx, x, y, ang, size, color) {
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

  function chalkGlyphs(ctx, text, x, y, color, size) {
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

  /** 글자 단위로 오른쪽 경계를 클리핑해 "써지는" 효과. 분필 끝 위치를 돌려줌 */
  function revealText(ctx, run, x, base, p, color, knock) {
    const n = run.text.length;
    if (p <= 0 || n === 0) return null;
    const f = clamp(p, 0, 1) * n;
    const k = Math.min(n, Math.floor(f));
    const character = run.text[k] || '';
    const strokes = /[가-힣=+]/u.test(character) ? 2 : 1;
    const strokePosition = (f - k) * strokes;
    const stroke = Math.floor(strokePosition);
    const phase = strokePosition - stroke;
    const isSpace = /\s/u.test(character);
    // 글자 안의 짧은 획과 획 사이에도 분필을 뗍니다. 이 같은 접촉 상태를 소리에도 전달합니다.
    const ink = isSpace ? f - k : (stroke + clamp(phase / 0.7, 0, 1)) / strokes;
    const w = p >= 1 ? run.prefix[n] : run.prefix[k] + (run.prefix[Math.min(n, k + 1)] - run.prefix[k]) * ink;
    ctx.save();
    ctx.font = run.font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    if (p < 1) {
      ctx.beginPath();
      ctx.rect(x - 8, base - run.size * 1.2, w + 8, run.size * 1.8);
      ctx.clip();
    }
    if (knock) { // 글자 주변의 격자선을 살짝 지워 읽기 쉽게
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 5;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#000';
      ctx.strokeText(run.text, x, base);
      ctx.globalCompositeOperation = 'source-over';
    }
    chalkGlyphs(ctx, run.text, x, base, color, run.size);
    ctx.restore();
    return {
      x: x + w, y: base - run.size * 0.28,
      contact: p < 1 && !isSpace && phase < 0.7,
      unit: run.text + ':' + k + ':' + stroke,
      character,
    };
  }

  function roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /** 선생님이 쥔 분필 (끝이 (x, y)에 닿고 몸통은 오른쪽 위로) */
  function drawChalkPiece(ctx, x, y, active, k) {
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
    roundedRect(ctx, 0, -wd / 2, len, wd, wd * 0.38);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = 'rgba(224,196,102,0.92)';
    ctx.fillRect(len * 0.5, -wd / 2, len * 0.26, wd);
    ctx.restore();
    if (active) { // 떨어지는 분필 가루
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
   * 7. 좌표평면 그리기 (칠판과 실험실이 함께 사용)
   * ==================================================================== */
  function drawAxes(ctx, g, ticks, p, tips) {
    const R = g.R;
    const ax = g.X(0);
    const ay = g.Y(0);
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = COLORS.white;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(g.x + 0.7, g.y + 0.7, g.size - 1.4, g.size - 1.4);

    ctx.globalAlpha = 0.06 + 0.12 * easeOut(seg(p, 0, 0.3)); // 판서 전에는 희미한 안내선
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = -TICK_MAX; k <= TICK_MAX; k++) {
      if (k === 0) continue;
      ctx.moveTo(g.X(k), g.y); ctx.lineTo(g.X(k), g.y + g.size);
      ctx.moveTo(g.x, g.Y(k)); ctx.lineTo(g.x + g.size, g.Y(k));
    }
    ctx.stroke();
    ctx.restore();
    if (p <= 0) return;

    const px = easeInOut(seg(p, 0.04, 0.5));
    const py = easeInOut(seg(p, 0.5, 0.92));
    const x0 = g.X(-R), x1 = g.X(R), y0 = g.Y(-R), y1 = g.Y(R);
    if (px > 0) chalkLine(ctx, x0, ay, lerp(x0, x1, px), ay, COLORS.white, 2.4);
    if (py > 0) chalkLine(ctx, ax, y0, ax, lerp(y0, y1, py), COLORS.white, 2.4);
    if (px >= 1) arrowHead(ctx, x1, ay, 0, 10, COLORS.white);
    if (py >= 1) arrowHead(ctx, ax, y1, -Math.PI / 2, 10, COLORS.white);

    ctx.save();
    ctx.font = ticks.font;
    ctx.textBaseline = 'alphabetic';
    ctx.strokeStyle = COLORS.white;
    ctx.fillStyle = COLORS.white;
    ctx.lineWidth = 1.6;
    ticks.xs.forEach((t) => {
      const a = clamp((px - (t.v + R) / (2 * R)) * 10, 0, 1);
      if (a <= 0) return;
      ctx.globalAlpha = 0.9 * a;
      ctx.beginPath(); ctx.moveTo(g.X(t.v), ay - 4); ctx.lineTo(g.X(t.v), ay + 4); ctx.stroke();
      ctx.globalAlpha = 0.88 * a;
      ctx.fillText(t.text, t.rect.x, t.rect.y + ticks.size * 0.85);
    });
    ticks.ys.forEach((t) => {
      const a = clamp((py - (t.v + R) / (2 * R)) * 10, 0, 1);
      if (a <= 0) return;
      ctx.globalAlpha = 0.9 * a;
      ctx.beginPath(); ctx.moveTo(ax - 4, g.Y(t.v)); ctx.lineTo(ax + 4, g.Y(t.v)); ctx.stroke();
      ctx.globalAlpha = 0.88 * a;
      ctx.fillText(t.text, t.rect.x, t.rect.y + ticks.size * 0.85);
    });
    ctx.fillStyle = COLORS.yellow;
    if (py >= 0.99) { ctx.globalAlpha = 0.95; ctx.fillText('O', ticks.origin.rect.x, ticks.origin.rect.y + ticks.size * 0.85); }
    if (px >= 1) { ctx.globalAlpha = 0.95; ctx.fillText('x', ticks.xName.rect.x, ticks.xName.rect.y + ticks.size * 0.85); }
    if (py >= 1) { ctx.globalAlpha = 0.95; ctx.fillText('y', ticks.yName.rect.x, ticks.yName.rect.y + ticks.size * 0.85); }
    ctx.restore();

    tips.axes = p < 0.5
      ? { x: lerp(x0, x1, px), y: ay, contact: p > 0.04, unit: 'x-axis' }
      : { x: ax, y: lerp(y0, y1, py), contact: p > 0.5 && p < 0.92, unit: 'y-axis' };
  }

  function drawLine(ctx, g, l, p) {
    const c = clipLine(l.a, l.b, g.R);
    if (!c) return null;
    const x0 = g.X(c[0]), y0 = g.Y(c[1]), x1 = g.X(c[2]), y1 = g.Y(c[3]);
    const q = easeInOut(p);
    const ex = lerp(x0, x1, q);
    const ey = lerp(y0, y1, q);
    chalkLine(ctx, x0, y0, ex, ey, COLORS[l.color] || COLORS.white, l.width || 3.4, l.dash);
    return { x: ex, y: ey };
  }

  function drawVLine(ctx, g, v, p) {
    const x = g.X(v.x);
    const y0 = g.Y(-g.R);
    const y1 = g.Y(g.R);
    const ey = lerp(y0, y1, easeInOut(p));
    chalkLine(ctx, x, y0, x, ey, COLORS[v.color], 3.2, [9, 7]);
    return { x, y: ey };
  }

  function drawLabel(ctx, lab, p, color) {
    if (!lab || p <= 0) return null;
    return revealText(ctx, lab.run, lab.x, lab.y + lab.size * 0.9, p, color, true);
  }

  function drawPoint(ctx, g, pt, lab, p) {
    const x = g.X(pt.x);
    const y = g.Y(pt.y);
    const col = COLORS[pt.color] || COLORS.yellow;
    const grow = easeOut(seg(p, 0, 0.45));
    const r = 6.5 * grow;
    if (r > 0.2) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath(); ctx.arc(x, y, r + 3.5, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
      ctx.fillStyle = col; ctx.globalAlpha = 0.96; ctx.fill();
      ctx.lineWidth = 1.8; ctx.strokeStyle = COLORS.white; ctx.stroke();
      if (p < 1) {
        ctx.globalAlpha = 0.5 * (1 - grow);
        ctx.beginPath(); ctx.arc(x, y, r + 9 * (1 - grow), 0, TAU); ctx.stroke();
      }
      ctx.restore();
    }
    const labelTip = drawLabel(ctx, lab, seg(p, 0.4, 1), col);
    return labelTip || { x, y, contact: p < 0.2, unit: 'dot' };
  }

  function drawRise(ctx, g, r, labels, p) {
    const x0 = g.X(r.x), y0 = g.Y(r.y), x1 = g.X(r.x + r.dx), y1 = g.Y(r.y + r.dy);
    const pr = easeInOut(seg(p, 0, 0.24));
    const pu = easeInOut(seg(p, 0.5, 0.74));
    if (pr > 0) chalkLine(ctx, x0, y0, lerp(x0, x1, pr), y0, COLORS.yellow, 3.4);
    if (pr >= 1) arrowHead(ctx, x1, y0, r.dx > 0 ? 0 : Math.PI, 9, COLORS.yellow);
    if (pu > 0) chalkLine(ctx, x1, y0, x1, lerp(y0, y1, pu), COLORS.mint, 3.4, [8, 6]);
    if (pu >= 1) arrowHead(ctx, x1, y1, y1 < y0 ? -Math.PI / 2 : Math.PI / 2, 9, COLORS.mint);
    const runTip = drawLabel(ctx, labels.run, seg(p, 0.24, 0.48), COLORS.yellow);
    const riseTip = drawLabel(ctx, labels.rise, seg(p, 0.74, 1), COLORS.mint);
    if (p >= 0.74) return riseTip;
    if (p >= 0.5) return { x: x1, y: lerp(y0, y1, pu), unit: 'rise' };
    if (p >= 0.24) return runTip;
    return { x: lerp(x0, x1, pr), y: y0, unit: 'run' };
  }

  function drawScene(ctx, g, scene, labels, ticks, P, tips) {
    drawAxes(ctx, g, ticks, P('axes'), tips);
    ctx.save();
    ctx.beginPath();
    ctx.rect(g.x, g.y, g.size, g.size); // 모든 직선은 그래프 영역 밖으로 나가지 않게 한 번 더 클리핑
    ctx.clip();
    if (scene.vline) {
      const p = P(scene.vline.key);
      if (p > 0) tips[scene.vline.key] = drawVLine(ctx, g, scene.vline, p);
    }
    for (let i = scene.lines.length - 1; i >= 0; i--) { // 주 직선(민트)이 맨 위
      const l = scene.lines[i];
      const p = P(l.key);
      if (p > 0) {
        const tip = drawLine(ctx, g, l, p);
        if (tip) tips[l.key] = tip;
      }
    }
    ctx.restore();
    if (scene.rise) {
      const p = P(scene.rise.key);
      if (p > 0) tips[scene.rise.key] = drawRise(ctx, g, scene.rise, labels, p);
    }
    scene.points.forEach((pt) => {
      const p = P(pt.key);
      if (p > 0) tips[pt.key] = drawPoint(ctx, g, pt, labels[pt.key], p);
    });
  }

  /* ====================================================================
   * 8. 칠판 렌더링
   * ==================================================================== */
  function drawTextBlocks(ctx, L, P, tips) {
    const g = board.geom;
    const t = L.text;
    const pf = P('formula');
    if (pf > 0) {
      const base = g.formulaY + t.formula.baseline;
      const fx = g.text.x;
      let tip = revealText(ctx, t.formula.run, fx, base, seg(pf, 0, 0.8), COLORS.yellow, false);
      const q = seg(pf, 0.8, 1);
      if (q > 0) { // 수식 밑줄
        const uy = base + t.formula.run.size * 0.2;
        const ex = fx + t.formula.run.width * 1.02 * easeInOut(q);
        chalkLine(ctx, fx, uy + 1.5, ex, uy - 1, COLORS.mint, 2.6);
        tip = { x: ex, y: uy };
      }
      tips.formula = tip;
    }
    t.notes.forEach((n, i) => {
      const p = P('note' + i);
      if (p <= 0) return;
      const ny = g.notesY + n.top;
      const color = COLORS[n.tone] || COLORS.white;
      ctx.save();
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(g.text.x + n.size * 0.3, ny + n.firstBase - n.size * 0.32, n.size * 0.12, 0, TAU);
      ctx.fill();
      ctx.restore();
      let acc = 0;
      let tip = null;
      n.lines.forEach((line) => {
        const len = Math.max(1, line.run.text.length);
        const lp = clamp((p * n.chars - acc) / len, 0, 1);
        acc += line.run.text.length;
        if (lp > 0) {
          const r = revealText(ctx, line.run, g.text.x + n.indent, ny + line.y, lp, color, false);
          if (r) tip = r;
        }
      });
      tips['note' + i] = tip;
    });
  }

  let legendState = [];
  function buildLegend() {
    const scene = SCENES[index];
    el.legend.textContent = '';
    legendState = [];
    const add = (key, color, label, dashed) => {
      const li = document.createElement('li');
      const sw = document.createElement('span');
      sw.className = 'swatch' + (dashed ? ' is-dashed' : '');
      sw.style.setProperty('--c', COLORS[color] || COLORS.white);
      sw.setAttribute('aria-hidden', 'true');
      const tx = document.createElement('span');
      tx.textContent = label;
      li.append(sw, tx);
      el.legend.appendChild(li);
      legendState.push({ key, li, on: false });
    };
    scene.lines.forEach((l) => add(l.key, l.color, l.label, false));
    if (scene.vline) add(scene.vline.key, scene.vline.color, scene.vline.label, true);
  }

  function renderBoard(t) {
    const B = ensureLayout();
    const ctx = bctx;
    ctx.setTransform(B.dpr, 0, 0, B.dpr, 0, 0);
    ctx.clearRect(0, 0, B.W, B.H);
    const L = B.chapters[index];
    const tl = timeline;
    const P = (key) => {
      const s = tl.map[key];
      return s ? seg(t, s.start, s.end) : 0;
    };
    const tips = {};
    drawTextBlocks(ctx, L, P, tips);
    drawScene(ctx, B.geom.graph, L.scene, L.labels, B.ticks, P, tips);
    applyGrain(ctx, B.W, B.H);

    legendState.forEach((s) => {
      const on = P(s.key) > 0;
      if (on !== s.on) { s.on = on; s.li.classList.toggle('is-on', on); }
    });

    let tip = null;
    let active = false;
    let activeKey = '';
    if (!reduced && t > 0 && t < tl.total) {
      for (let i = tl.order.length - 1; i >= 0; i--) {
        const key = tl.order[i];
        const p = P(key);
        if (p > 0) { tip = tips[key] || null; active = p < 1 && !!tip; activeKey = key; break; }
      }
    }
    writingCharacter = active && tip ? tip.character || '' : '';
    penContact = active && playing && tip.contact !== false
      ? { id: index + ':' + activeKey + ':' + (tip.unit || 'line') } : null;
    if (tip) drawChalkPiece(ctx, tip.x, tip.y, !!penContact, B.tipScale);
    return penContact;
  }

  /* ====================================================================
   * 9. 해설 음성 — 내장 Foundry MP3 전용 (다른 음성 제공자로 대체하지 않음)
   * ==================================================================== */
  function setVoiceNote(text, kind) {
    el.voiceNote.textContent = text || '';
    el.voiceNote.className = 'voice-note' + (text && kind ? ' is-' + kind : '');
  }

  function updateVoiceLabel() {
    let text;
    if (!voiceEnabled) text = '해설 음성이 꺼져 있어요. 판서와 자막으로만 진행합니다.';
    else if (voiceMode === 'error') text = '해설 음성을 재생하지 못해 판서와 자막으로 진행 중이에요.';
    else if (!HAS_AUDIO) text = '이 파일에는 내장 해설 음성이 없어 판서와 자막으로만 진행합니다.';
    else text = '해설 음성: ' + VOICE_LABEL + ' — 사람 목소리가 아닌 AI 합성 음성이며 파일 안에 미리 담겨 있어요.';
    el.voiceLabel.textContent = text;
  }

  function failVoice(token, message) {
    if (token !== playToken) return;
    voiceMode = 'error';
    voiceDone = true;
    voiceError = message;
    audioLoaded = -1; // 다음 시도 때 다시 불러오기
    setVoiceNote('⚠ ' + VOICE_LABEL + ' 오디오 오류: ' + message + ' 판서와 자막으로 계속 진행합니다. 소리 없이 보려면 "해설 음성"을 끄세요.', 'error');
    updateVoiceLabel();
    refreshStatus();
  }

  function pauseAudio() {
    if (!audio.paused) {
      selfPause = true;
      try { audio.pause(); } catch (e) { selfPause = false; }
    }
  }

  function stopVoice() {
    playToken += 1; // 늦게 도착하는 이벤트·약속을 모두 무효화
    pauseAudio();
    voiceStarted = false;
    voiceMode = voiceEnabled ? 'idle' : 'off';
  }

  function onPlayRejected(token, err) {
    if (token !== playToken) return;
    const name = err && err.name ? err.name : '';
    if (name === 'AbortError') return; // pause()/새 로드가 끼어든 정상 상황
    if (name === 'NotAllowedError') {
      voiceStarted = false;
      pausePlayback();
      setVoiceNote('브라우저가 소리 재생을 막았어요. 재생 버튼을 한 번 더 눌러 주세요.', 'info');
      return;
    }
    failVoice(token, '파일을 재생하지 못했어요' + (name ? ' (' + name + ')' : '') + '.');
  }

  function startVoice() {
    voiceStarted = true;
    voiceError = '';
    const token = ++playToken;
    if (!voiceEnabled) { voiceMode = 'off'; voiceDone = true; return; }
    const ch = CH[index];
    if (!ch.audio) { voiceMode = 'embedded'; failVoice(token, '이 단원에는 내장된 해설 음성 파일이 없어요.'); return; }
    voiceMode = 'embedded';
    voiceDone = false;
    setVoiceNote('', '');
    if (audioLoaded !== index) {
      audio.src = ch.audio;
      audioLoaded = index;
    }
    audio.defaultPlaybackRate = speed; // 새 src를 불러오면 playbackRate가 이 값으로 초기화됨
    try { audio.currentTime = 0; } catch (e) { /* 메타데이터 이전엔 무시 */ }
    audio.playbackRate = speed;
    const pr = audio.play();
    if (pr && typeof pr.then === 'function') {
      pr.then(() => { if (token === playToken) updateVoiceLabel(); }, (err) => onPlayRejected(token, err));
    }
  }

  function resumeVoice() {
    if (voiceMode !== 'embedded' || voiceDone || audioLoaded !== index) return;
    const token = playToken;
    audio.playbackRate = speed;
    const pr = audio.play();
    if (pr && typeof pr.then === 'function') pr.then(null, (err) => onPlayRejected(token, err));
  }

  audio.addEventListener('ended', () => {
    if (voiceMode === 'embedded' && audioLoaded === index && voiceStarted) {
      voiceDone = true;
      refreshStatus();
    }
  });
  audio.addEventListener('error', () => {
    if (voiceMode !== 'embedded' || audioLoaded !== index || !voiceStarted) return;
    const code = audio.error ? audio.error.code : 0;
    failVoice(playToken, '오디오 파일을 읽지 못했어요' + (code ? ' (코드 ' + code + ')' : '') + '.');
  });
  audio.addEventListener('loadedmetadata', () => {
    if (audioLoaded < 0 || !isFinite(audio.duration) || audio.duration <= 0) return;
    knownDur[audioLoaded] = audio.duration;
    // 데이터에 duration이 없었다면 판서 속도를 실제 길이에 맞춰 다시 배분(아직 거의 시작 전일 때만)
    if (audioLoaded === index && timeline && timeline.D === 0 && drawT < 1.5) timeline = buildTimeline(index, audio.duration);
  });
  audio.addEventListener('pause', () => {
    if (selfPause) { selfPause = false; return; }
    // 헤드셋·미디어 키 등 외부에서 일시정지한 경우 재생 상태를 맞춤
    if (playing && voiceMode === 'embedded' && audioLoaded === index && !audio.ended && !voiceDone) pausePlayback();
  });

  /* ====================================================================
   * 10. 재생 컨트롤러
   * ==================================================================== */
  function enterChapter(i, intent) {
    stopVoice();
    stopLoop();
    chalk.stop();
    index = clamp(i, 0, N - 1);
    ended = false;
    drawT = 0;
    completeHold = 0;
    voiceDone = !voiceEnabled;
    voiceError = '';
    voiceMode = voiceEnabled ? 'idle' : 'off';
    setVoiceNote('', '');
    timeline = buildTimeline(index, durationFor(index));
    updateChapterUI();
    updateVoiceLabel();
    playing = !!intent;
    if (playing) {
      everStarted = true;
      startVoice();
      startLoop();
    }
    renderStatic();
    updatePlayUI();
    refreshStatus();
  }

  function play() {
    if (playing) return;
    if (ended) { chalk.unlock(); enterChapter(0, true); return; } // "다시 재생": 처음부터
    if (chalkEnabled) chalk.unlock();
    playing = true;
    everStarted = true;
    if (!voiceEnabled) {
      voiceMode = 'off';
      voiceDone = true;
    } else if (!voiceStarted) {
      if (drawT > 0.05) { drawT = 0; completeHold = 0; } // 소리 없이 진행했던 판서와 음성을 다시 맞추기 위해 이 단원을 처음부터
      startVoice();
    } else {
      resumeVoice();
    }
    startLoop();
    updatePlayUI();
    refreshStatus();
  }

  /** 즉시 정지: 분필 소리·음성·애니메이션 모두 멈춤 */
  function pausePlayback() {
    if (!playing) return;
    playing = false;
    stopLoop();
    chalk.stop();
    pauseAudio();
    renderStatic();
    updatePlayUI();
    refreshStatus();
  }

  const toggle = () => (playing ? pausePlayback() : play());

  function goTo(i, opts) {
    const n = Math.round(Number(i));
    if (!isFinite(n)) return;
    const intent = opts && typeof opts.play === 'boolean' ? opts.play : playing;
    if (intent && chalkEnabled) chalk.unlock();
    enterChapter(clamp(n, 0, N - 1), intent);
  }
  function next() { if (index < N - 1) goTo(index + 1); }
  function prev() {
    if (index > 0) goTo(index - 1);
    else if (drawT > 0.5 || ended) goTo(0);
  }
  function replay() { if (chalkEnabled) chalk.unlock(); enterChapter(index, true); }
  function restart() { if (chalkEnabled) chalk.unlock(); enterChapter(0, true); }

  function finishChapter() {
    if (index < N - 1) {
      enterChapter(index + 1, true);
    } else {
      playing = false;
      ended = true;
      stopLoop();
      chalk.stop();
      renderStatic();
      updatePlayUI();
      refreshStatus();
    }
  }

  function startLoop() {
    if (rafId) return;
    lastTs = performance.now();
    rafId = requestAnimationFrame(tick);
  }
  function stopLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function tick(now) {
    rafId = 0;
    if (!playing) return;
    const dt = clamp((now - lastTs) / 1000, 0, 0.1);
    lastTs = now;
    // 음성이 재생 중이면 음성 시계가 기준, 아니면(음성 끝남·꺼짐·오류) 자체 시계 × 속도
    if (audioIsMaster()) drawT = clamp(Math.max(drawT, audio.currentTime || 0), 0, timeline.total);
    else if (drawT < timeline.total) drawT = Math.min(timeline.total, drawT + dt * speed);

    let contact = null;
    if (!reduced) contact = renderBoard(effectiveT());
    chalk.update(chalkEnabled && !reduced && playing ? contact : null);
    updateProgressUI();

    if (drawDone() && voiceDone) {
      completeHold += dt;
      if (completeHold >= CHAPTER_GAP) { finishChapter(); return; }
    } else {
      completeHold = 0;
    }
    if (playing && !rafId) rafId = requestAnimationFrame(tick);
  }

  function renderStatic() {
    if (!timeline) return;
    renderBoard(effectiveT());
    updateProgressUI();
  }

  /* ====================================================================
   * 11. 화면(DOM) 갱신
   * ==================================================================== */
  const navButtons = [];
  let sentEls = [];
  let sentCum = [];
  let sentIdx = -2;
  let lastPct = -1;
  let lastTime = '';

  function splitSentences(text) {
    const m = text.match(/[^.!?。]+[.!?。]*\s*/g);
    return (m || [text]).map((s) => s.trim()).filter(Boolean);
  }

  function updateChapterUI() {
    const ch = CH[index];
    el.kicker.textContent = ch.kicker;
    el.boardTitle.textContent = ch.title;
    el.boardCount.textContent = index + 1 + ' / ' + N;
    el.summary.textContent = ch.summary;
    navButtons.forEach((b, i) => {
      const cur = i === index;
      b.classList.toggle('is-current', cur);
      b.classList.toggle('is-seen', i < index);
      if (cur) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
    });
    el.prev.setAttribute('aria-disabled', index === 0 ? 'true' : 'false');
    el.next.setAttribute('aria-disabled', index === N - 1 ? 'true' : 'false');

    const scene = SCENES[index];
    const desc = describeChapter(ch, scene);
    el.canvas.setAttribute('aria-label', '칠판 그림. ' + ch.title + '. 식 ' + ch.formula + '. 좌표평면 그래프.');
    el.sr.textContent = '';
    const h = document.createElement('p');
    h.textContent = ch.kicker + ' ' + ch.title + '. 식: ' + ch.formula + '.';
    const ul = document.createElement('ul');
    ch.notes.forEach((n) => { const li = document.createElement('li'); li.textContent = n.text; ul.appendChild(li); });
    const d = document.createElement('p');
    d.textContent = desc;
    el.sr.append(h, ul, d);

    el.narration.textContent = '';
    const sentences = splitSentences(ch.narration);
    const total = sentences.reduce((s, x) => s + x.length, 0) || 1;
    let acc = 0;
    sentEls = [];
    sentCum = [];
    sentences.forEach((s, k) => {
      const span = document.createElement('span');
      span.className = 'sent';
      span.textContent = s;
      el.narration.appendChild(span);
      if (k < sentences.length - 1) el.narration.appendChild(document.createTextNode(' '));
      acc += s.length;
      sentEls.push(span);
      sentCum.push(acc / total);
    });
    sentIdx = -2;
    buildLegend();
  }

  function highlightSentence(p) {
    const idx = p <= 0.001 && !everStarted ? -1 : p <= 0.001 && drawT <= 0.05 ? -1 : Math.max(0, sentCum.findIndex((c) => p <= c + 1e-9));
    const at = idx === -1 && p > 0.001 ? sentEls.length - 1 : idx;
    if (at === sentIdx) return;
    sentIdx = at;
    sentEls.forEach((s, k) => {
      s.classList.toggle('is-active', k === at);
      s.classList.toggle('is-past', at >= 0 && k < at);
    });
  }

  function updateProgressUI() {
    const p = chapterProgress();
    el.fill.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    const pct = Math.round(p * 100);
    if (pct !== lastPct) {
      lastPct = pct;
      el.progress.setAttribute('aria-valuenow', String(pct));
      el.progress.setAttribute('aria-valuetext', index + 1 + '단원 ' + pct + '%');
    }
    const D = audioDuration() || (timeline ? timeline.total : 0);
    const cur = voiceMode === 'embedded' && voiceStarted ? audioTime() : drawT;
    const txt = formatClock(ended ? D : cur) + ' / ' + formatClock(D);
    if (txt !== lastTime) { lastTime = txt; el.time.textContent = txt; }
    highlightSentence(p);
  }

  function updatePlayUI() {
    let label;
    let icon;
    if (playing) { label = '일시정지'; icon = ICON.pause; }
    else if (ended) { label = '다시 재생'; icon = ICON.replay; }
    else if (drawT > 0.05) { label = '이어서 재생'; icon = ICON.play; }
    else { label = '재생'; icon = ICON.play; }
    if (el.playLabel.textContent !== label) el.playLabel.textContent = label;
    if (el.playIcon.dataset.icon !== icon) { el.playIcon.dataset.icon = icon; el.playIcon.innerHTML = icon; }
    el.hint.classList.toggle('is-off', playing || ended || drawT >= 0.05 || reduced);
  }

  function refreshStatus() {
    const ch = CH[index];
    let text;
    if (ended) text = '강의가 끝났어요. "다시 재생"을 누르면 처음부터 다시 볼 수 있어요.';
    else if (playing) {
      const tail = !voiceEnabled ? '판서와 자막 진행 중 (해설 음성 꺼짐)' : voiceMode === 'error' ? '판서와 자막 진행 중 (음성 오류)' : '판서와 해설이 진행 중이에요';
      text = index + 1 + '/' + N + ' · ' + ch.title + ' — ' + tail;
    } else if (drawT < 0.05) {
      text = index === 0 ? INITIAL_STATUS : index + 1 + '/' + N + ' · ' + ch.title + ' — 재생 버튼을 누르면 이 단원이 시작됩니다';
    } else {
      text = '일시정지 · ' + (index + 1) + '/' + N + ' ' + ch.title;
    }
    if (el.status.textContent !== text) el.status.textContent = text;
  }

  function setToggle(btn, key, on) {
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    const s = btn.querySelector('.state');
    if (s) s.textContent = on ? '켬' : '끔';
  }

  function setVoiceEnabled(on) {
    on = !!on;
    if (on === voiceEnabled) return;
    voiceEnabled = on;
    setToggle(el.voiceToggle, 'voice', on);
    if (!on) {
      stopVoice();
      voiceDone = true;
      voiceMode = 'off';
      setVoiceNote('', '');
    } else {
      voiceMode = 'idle';
      voiceDone = false;
      voiceStarted = false;
      setVoiceNote('', '');
      if (playing) { enterChapter(index, true); return; } // 판서와 음성을 맞추려고 이 단원을 처음부터
    }
    updateVoiceLabel();
    refreshStatus();
  }

  function setChalkEnabled(on) {
    chalkEnabled = !!on;
    setToggle(el.chalkToggle, 'chalk', chalkEnabled);
    if (!chalkEnabled) chalk.stop();
    else if (playing) chalk.unlock();
  }

  function setSpeed(v) {
    const s = Number(v);
    if (!SPEEDS.includes(s)) return;
    speed = s;
    el.speed.value = String(s);
    audio.defaultPlaybackRate = s;
    audio.playbackRate = s;
  }

  /* ====================================================================
   * 12. 실험실: 기울기 a · y절편 b
   * ==================================================================== */
  const lab = { a: LAB_DEFAULT.a, b: LAB_DEFAULT.b, compare: false };

  function steepWord(abs) {
    if (abs <= 0.5) return '아주 완만해요';
    if (abs < 1) return '완만해요';
    if (abs === 1) return '45° 대각선이에요 (오른쪽 1칸에 1칸)';
    if (abs <= 2) return '가팔라요';
    return '아주 가팔라요';
  }

  function labScene() {
    const { a, b } = lab;
    const lines = [{ key: 'line', a, b, color: 'mint', width: 3.8, label: lineEquation(a, b) }];
    if (lab.compare) {
      lines.push({ key: 'cmp0', a, b: b + 2, color: 'yellow', width: 3, dash: [9, 7], label: lineEquation(a, b + 2) });
      lines.push({ key: 'cmp1', a, b: b - 2, color: 'pink', width: 3, dash: [9, 7], label: lineEquation(a, b - 2) });
    }
    const points = [];
    const xi = a !== 0 ? -b / a : null;
    if (a !== 0 && b === 0) {
      points.push({ key: 'pt0', x: 0, y: 0, color: 'yellow', label: 'x·y절편 (0, 0)' });
    } else {
      points.push({ key: 'pt0', x: 0, y: b, color: 'yellow', label: 'y절편 (0, ' + fmt(b) + ')' });
      if (xi !== null && Math.abs(xi) <= TICK_MAX + 0.3) points.push({ key: 'pt1', x: xi, y: 0, color: 'pink', label: 'x절편 (' + fmtApprox(xi) + ', 0)' });
    }
    const rise = a !== 0 ? { key: 'rise', x: 0, y: b, dx: 1, dy: a } : null;
    return { lines, points, rise, vline: null };
  }

  function renderLab() {
    const W = Math.floor(el.labCanvas.clientWidth);
    if (W < 40) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (el.labCanvas.width !== Math.round(W * dpr)) {
      el.labCanvas.width = Math.round(W * dpr);
      el.labCanvas.height = Math.round(W * dpr);
    }
    const ctx = lctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, W);
    const pad = Math.round(W * 0.03);
    const g = makeGraph(pad, pad, W - pad * 2);
    const ticks = computeTicks(ctx, g);
    const scene = labScene();
    const labels = computeLabels(ctx, g, scene, ticks);
    drawScene(ctx, g, scene, labels, ticks, () => 1, {});
    applyGrain(ctx, W, W);
  }

  function updateLab() {
    const { a, b } = lab;
    const eq = lineEquation(a, b);
    el.labEq.textContent = '';
    const main = document.createElement('span');
    main.className = 'eq-main';
    main.textContent = eq;
    el.labEq.appendChild(main);
    if (a === 0) {
      const badge = document.createElement('span');
      badge.className = 'eq-badge';
      badge.textContent = '상수함수 · 일차함수 아님';
      el.labEq.append(' ', badge);
    }
    el.slopeValue.textContent = fmt(a);
    el.interceptValue.textContent = fmt(b);
    el.slope.setAttribute('aria-valuetext', '기울기 ' + fmt(a));
    el.intercept.setAttribute('aria-valuetext', 'y절편 ' + fmt(b));

    const rows = [];
    if (a === 0) {
      rows.push(['warn', '상수함수 · 일차함수 아님', ' — 기울기 a = 0이면 y = ' + fmt(b) + '인 수평선이에요. 일차함수는 a ≠ 0이어야 해요.']);
      rows.push(['direction', '방향', ' x가 변해도 y는 항상 ' + fmt(b) + '이라서 오르지도 내리지도 않아요.']);
    } else {
      const up = a > 0;
      rows.push(['direction', '방향', ' a = ' + fmt(a) + (up ? ' > 0' : ' < 0') + ' 이므로 오른쪽으로 갈수록 ' + (up ? '올라가요(증가).' : '내려가요(감소).')]);
      rows.push(['steep', '가파름', ' |a| = ' + fmt(Math.abs(a)) + ' → ' + steepWord(Math.abs(a)) + ' x가 1 늘 때 y는 ' + fmt(Math.abs(a)) + '만큼 ' + (up ? '늘어요.' : '줄어요.')]);
    }
    rows.push(['yint', 'y절편', ' b = ' + fmt(b) + ' → x = 0일 때의 y값이에요. y축과 만나는 점은 (0, ' + fmt(b) + ') (노란 점).']);
    if (a !== 0) {
      const xi = -b / a;
      const far = Math.abs(xi) > TICK_MAX + 0.3;
      rows.push(['xint', 'x절편', ' y = 0일 때의 x값 = ' + fmtApprox(xi) + ' → x축과 만나는 점은 (' + fmtApprox(xi) + ', 0)' + (b === 0 ? ' (y절편과 같은 원점, 노란 점)' : ' (분홍 점)') + (far ? ' — 눈금 범위 밖이에요.' : '이에요.')]);
    } else if (b !== 0) {
      rows.push(['xint', 'x절편', ' 없어요 — 수평선 y = ' + fmt(b) + '은 x축과 평행해서 만나지 않아요.']);
    } else {
      rows.push(['xint', 'x절편', ' y = 0은 x축 그 자체라서 x절편이 하나로 정해지지 않아요.']);
    }
    el.labDesc.textContent = '';
    const ul = document.createElement('ul');
    rows.forEach(([kind, head, body]) => {
      const li = document.createElement('li');
      li.dataset.kind = kind;
      const bTag = document.createElement('b');
      bTag.textContent = head;
      li.append(bTag, body);
      ul.appendChild(li);
    });
    el.labDesc.appendChild(ul);

    el.labCanvas.setAttribute('aria-label', '실험실 그래프: ' + eq + (a === 0 ? ' (상수함수, 일차함수 아님)' : '') + '. ' + describeLine(a, b) + '. y절편 (0, ' + fmt(b) + ').');

    el.labLegend.textContent = '';
    const item = (color, label, kind) => {
      const li = document.createElement('li');
      const sw = document.createElement('span');
      sw.className = 'swatch' + (kind === 'dash' ? ' is-dashed' : kind === 'dot' ? ' is-dot' : '');
      sw.style.setProperty('--c', COLORS[color]);
      sw.setAttribute('aria-hidden', 'true');
      const tx = document.createElement('span');
      tx.textContent = label;
      li.append(sw, tx);
      el.labLegend.appendChild(li);
    };
    item('mint', eq, 'line');
    if (lab.compare) { item('yellow', lineEquation(a, b + 2), 'dash'); item('pink', lineEquation(a, b - 2), 'dash'); }
    item('yellow', 'y절편', 'dot');
    if (a !== 0 && b !== 0) item('pink', 'x절편', 'dot');
    renderLab();
  }

  function setLab(a, b) {
    const na = clamp(Math.round(Number(a) * 2) / 2, -3, 3);
    const nb = clamp(Math.round(Number(b) * 2) / 2, -3, 3);
    lab.a = isFinite(na) ? na : lab.a;
    lab.b = isFinite(nb) ? nb : lab.b;
    el.slope.value = String(lab.a);
    el.intercept.value = String(lab.b);
    updateLab();
  }

  /* ====================================================================
   * 13. 확인 문제
   * ==================================================================== */
  let quizChoice = -1;
  function renderQuiz() {
    const q = DATA.quiz;
    if (!q || !Array.isArray(q.options) || !q.options.length) { el.quiz.hidden = true; return; }
    el.quizQuestion.textContent = q.question || '';
    el.quizOptions.textContent = '';
    q.options.forEach((o, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'quiz-option';
      b.dataset.index = String(i);
      const mark = document.createElement('span');
      mark.className = 'opt-mark';
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = String.fromCharCode(0x2460 + i);
      const text = document.createElement('span');
      text.className = 'opt-text';
      text.textContent = o.text;
      const res = document.createElement('span');
      res.className = 'opt-result';
      b.append(mark, text, res);
      b.addEventListener('click', () => answerQuiz(i));
      el.quizOptions.appendChild(b);
    });
    // 문제 속 "y = -2x + 3" 같은 식이 실험실 범위 안이면 바로 넣어 볼 수 있게 함
    const m = /y\s*=\s*(-?\d*\.?\d*)x\s*([+-])\s*(\d+\.?\d*)/.exec(q.question || '');
    if (m) {
      const a = m[1] === '' ? 1 : m[1] === '-' ? -1 : Number(m[1]);
      const b = (m[2] === '-' ? -1 : 1) * Number(m[3]);
      if (isFinite(a) && isFinite(b) && Math.abs(a) <= 3 && Math.abs(b) <= 3 && a !== 0) {
        el.quizToLab.hidden = false;
        el.quizToLab.textContent = '실험실에 ' + lineEquation(a, b) + ' 맞춰 보기';
        el.quizToLab.addEventListener('click', () => {
          setLab(a, b);
          el.lab.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
          el.slope.focus({ preventScroll: true });
        });
      }
    }
  }

  function answerQuiz(i) {
    const o = DATA.quiz.options[i];
    quizChoice = i;
    Array.from(el.quizOptions.children).forEach((b, k) => {
      b.classList.remove('is-correct', 'is-wrong');
      const res = b.querySelector('.opt-result');
      res.textContent = '';
      if (k === i) {
        b.classList.add(o.correct ? 'is-correct' : 'is-wrong');
        res.textContent = o.correct ? '정답' : '오답';
      }
    });
    el.quizFeedback.textContent = '';
    const box = document.createElement('div');
    box.className = 'fb ' + (o.correct ? 'is-correct' : 'is-wrong');
    const st = document.createElement('span');
    st.className = 'fb-state';
    st.textContent = o.correct ? '✓ 정답' : '✕ 오답';
    box.append(st, o.feedback || '');
    el.quizFeedback.appendChild(box);
    el.quizRetry.hidden = false;
  }

  function resetQuiz() {
    quizChoice = -1;
    Array.from(el.quizOptions.children).forEach((b) => {
      b.classList.remove('is-correct', 'is-wrong');
      b.querySelector('.opt-result').textContent = '';
    });
    el.quizFeedback.textContent = '';
    el.quizRetry.hidden = true;
    const first = el.quizOptions.querySelector('button');
    if (first) first.focus();
  }

  /* ====================================================================
   * 14. 초기화 · 이벤트
   * ==================================================================== */
  function onKeyDown(e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    const tag = t && t.tagName;
    const isField = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || (t && t.isContentEditable);
    const isActivator = isField || tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY' || (t && t.getAttribute && t.getAttribute('role') === 'button');
    const inNoHotkeys = !!(t && t.closest && t.closest('[data-no-hotkeys]'));
    if (e.key === ' ' || e.code === 'Space') {
      if (isActivator) return; // 버튼은 브라우저가 Space로 click을 일으키므로 중복 토글 방지
      e.preventDefault();
      toggle();
    } else if (e.key === 'ArrowRight') {
      if (isField || inNoHotkeys) return;
      e.preventDefault();
      next();
    } else if (e.key === 'ArrowLeft') {
      if (isField || inNoHotkeys) return;
      e.preventDefault();
      prev();
    }
  }

  let resizeQueued = false;
  function onResize() {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => {
      resizeQueued = false;
      renderStatic();
      renderLab();
    });
  }

  function getState() {
    return {
      chapter: CH[index].id,
      index,
      playing,
      progress: Math.round(chapterProgress() * 1000) / 1000,
      voiceEnabled,
      chalkEnabled,
      a: lab.a,
      b: lab.b,
      audioTime: Math.round(audioTime() * 1000) / 1000,
      audioDuration: Math.round(audioDuration() * 1000) / 1000,
      ended,
      // 추가 진단 값
      chapterA: CH[index].a,
      chapterB: CH[index].b,
      speed,
      voiceMode,
      voiceError,
      drawing: playing && !drawDone(),
      drawDone: !!drawDone(),
      reducedMotion: reduced,
      penDown: !!penContact,
      writingCharacter,
      chalkVolume: chalk.state().volume,
      chalkReady: chalk.state().ready,
      chalkError: chalk.state().error,
    };
  }

  function init() {
    document.title = (DATA.title || '일차함수') + (DATA.subtitle ? ' · ' + DATA.subtitle : '');
    document.documentElement.lang = DATA.lang || 'ko';
    el.title.textContent = DATA.title || '';
    el.subtitle.textContent = DATA.subtitle || '';
    const totalSec = CH.reduce((s, c) => s + c.duration, 0);
    el.count.textContent = '· ' + N + '개 단원' + (totalSec > 0 ? ' · 약 ' + Math.round(totalSec / 60) + '분' : '');
    el.chip.textContent = HAS_AUDIO ? VOICE_LABEL : '내장 음성 없음 (자막만)';

    CH.forEach((ch, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chapter-btn';
      b.dataset.index = String(i);
      const num = document.createElement('span');
      num.className = 'chapter-num';
      num.textContent = String(i + 1);
      const name = document.createElement('span');
      name.className = 'chapter-name';
      name.textContent = ch.title;
      b.append(num, name);
      b.addEventListener('click', () => goTo(i));
      li.appendChild(b);
      el.chapters.appendChild(li);
      navButtons.push(b);
    });

    const guard = (fn) => (e) => { if (e.currentTarget.getAttribute('aria-disabled') === 'true') return; fn(e); };
    el.play.addEventListener('click', toggle);
    el.prev.addEventListener('click', guard(prev));
    el.next.addEventListener('click', guard(next));
    el.replay.addEventListener('click', replay);
    el.restart.addEventListener('click', restart);
    el.hint.addEventListener('click', play);
    el.voiceToggle.addEventListener('click', () => setVoiceEnabled(!voiceEnabled));
    el.chalkToggle.addEventListener('click', () => setChalkEnabled(!chalkEnabled));
    el.chalkVolume.addEventListener('input', () => chalk.setVolume(el.chalkVolume.value));
    el.speed.addEventListener('change', () => setSpeed(el.speed.value));
    el.captionToggle.addEventListener('click', () => {
      const open = el.captionBody.hidden;
      el.captionBody.hidden = !open;
      el.captionToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      el.captionToggle.textContent = open ? '자막 접기' : '자막 펼치기';
    });

    el.slope.addEventListener('input', () => { lab.a = Number(el.slope.value) || 0; updateLab(); });
    el.intercept.addEventListener('input', () => { lab.b = Number(el.intercept.value) || 0; updateLab(); });
    el.labCompare.addEventListener('click', () => {
      lab.compare = !lab.compare;
      el.labCompare.setAttribute('aria-pressed', lab.compare ? 'true' : 'false');
      updateLab();
    });
    el.labReset.addEventListener('click', () => {
      lab.compare = false;
      el.labCompare.setAttribute('aria-pressed', 'false');
      setLab(LAB_DEFAULT.a, LAB_DEFAULT.b);
    });
    el.quizRetry.addEventListener('click', resetQuiz);

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && playing) {
        pausePlayback();
        el.status.textContent = '탭이 가려져 일시정지했어요 · ' + (index + 1) + '/' + N + ' ' + CH[index].title;
      }
    });
    window.addEventListener('pagehide', () => { chalk.stop(); pauseAudio(); });
    if (motionQuery) {
      const onMotion = (e) => {
        reduced = !!e.matches;
        if (reduced) chalk.stop();
        renderStatic();
        updatePlayUI();
      };
      if (motionQuery.addEventListener) motionQuery.addEventListener('change', onMotion);
      else if (motionQuery.addListener) motionQuery.addListener(onMotion);
    }
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(onResize);
      ro.observe(el.stage);
      ro.observe(el.labCanvas);
    } else {
      window.addEventListener('resize', onResize);
    }

    setToggle(el.voiceToggle, 'voice', voiceEnabled);
    setToggle(el.chalkToggle, 'chalk', chalkEnabled);
    chalk.setVolume(el.chalkVolume.value);
    setSpeed(1);
    renderQuiz();
    setLab(LAB_DEFAULT.a, LAB_DEFAULT.b);
    enterChapter(0, false);
    el.status.textContent = INITIAL_STATUS;

    // 손글씨 글꼴이 준비되면 글자 폭을 다시 재서 레이아웃을 갱신
    if (document.fonts && document.fonts.load) {
      document.fonts.load('32px ChalkKorean', '가나다 abc 123 y = ax + b').then(() => {
        fontEpoch += 1;
        renderStatic();
        renderLab();
      }, () => {});
    }
  }

  try {
    init();
  } catch (err) {
    if (window.console) console.error(err);
    const fatal = byId('fatal');
    if (fatal) fatal.hidden = false;
    return;
  }

  window.lessonPlayer = {
    getState,
    goTo,
    play,
    pause: pausePlayback,
    toggle,
    next,
    prev,
    replay,
    restart,
    setVoiceEnabled,
    setChalkEnabled,
    setSpeed,
    setLab,
  };
})();
