/* 손자병법 칠판 강의 재생기 — 외부 의존성 없는 단일 파일 플레이어 (해설 음성 + 분필 소리).
 *
 * 빌드 계약: window.ArtLayout(layout.js)·window.ArtDraw(draw.js)·window.LESSON_DATA(장면 JSON + 내장 MP3)가 먼저 정의되어야 합니다.
 * 이 파일은 장면 JSON을 읽어 Canvas에 판서하고, 단계마다 내장된 해설 음성(ko-KR-Haena)을 재생합니다.
 * 화면의 모든 글은 텍스트 노드/Canvas fillText로만 그리며 HTML 문자열을 삽입하지 않습니다.
 *
 * 시계 규칙(이 파일의 핵심):
 *   - 해설 음성이 재생 중이면 audio.currentTime 이 판서 시계 t 의 기준입니다. 자체 시계를 더하지 않습니다(두 번 세지 않음).
 *   - 음성이 없거나(끔·오류·끝남) 재생 중이 아니면 rAF 타임스탬프 차이 × 속도로 t 를 흘립니다.
 *     기준점은 첫 프레임의 rAF 타임스탬프이고 schedule() 이 덮어쓰지 않습니다(렌더 시간이 시계에서 빠지지 않게).
 *   - 칠판 요소의 시작 시각 = at(해설 길이 비율) × D. D 는 음성이 쓸 수 있고 길이를 알면 그 클립 길이,
 *     아니면 해설 글자 수로 추정한 길이입니다. D 가 바뀌면(음성 끔·오류) t 도 같은 비율로 맞춥니다.
 *   - 단계 완료 = 판서 끝 && 음성 끝(음성이 꺼져 있거나 오류면 판서 끝). 완료 뒤 0.9초(실제 시간)를 세고 자동 넘김.
 *   - 분필 소리는 펜이 칠판에 닿아 있는 동안에만, 내장된 실제 녹음(CC0)으로만 냅니다. 합성 소리로 대체하지 않습니다.
 *
 * 구성: 0 상수·도우미  1 단계 준비  2 칠판 배치  3 분필 소리·해설 음성  4 렌더·재생  5 화면 갱신
 *       6 퀴즈  7 조작  8 공개 API
 */
(function () {
  'use strict';

  const DATA = window.LESSON_DATA;
  const L = window.ArtLayout;
  const Draw = window.ArtDraw;
  const byId = (id) => document.getElementById(id);

  if (!DATA || !L || !Draw || !Array.isArray(DATA.steps) || DATA.steps.length === 0) {
    const fatal = byId('fatal');
    if (fatal) fatal.hidden = false;
    return;
  }

  /* ====================================================================
   * 0. 상수 · 도우미
   * ==================================================================== */
  const COLORS = L.COLORS;
  const COLOR_KO = { white: '흰색', mint: '민트색', yellow: '노란색', pink: '분홍색', sky: '하늘색', orange: '주황색' };
  const PART_LABEL = { background: '배경', chapter: '본론 · 열세 편', closing: '마무리' };
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

  function formatClock(sec) {
    const s = Math.max(0, Math.round(sec));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  /* ====================================================================
   * 1. 단계 준비
   * ==================================================================== */
  const steps = DATA.steps.map((raw, i) => ({
    i, raw, id: raw.id, kind: raw.board.kind, est: L.estimateDuration(raw.narration),
  }));
  const N = steps.length;
  /** 모든 단계에 내장 음성이 있는가. 없으면(개발용 빌드) 해설 음성은 처음부터 꺼져 있고 판서는 추정 길이로 흐릅니다. */
  const HAS_AUDIO = steps.every((S) => typeof S.raw.audio === 'string' && S.raw.audio.length > 0 && S.raw.audioDuration > 0);

  const canvas = byId('board');
  const ctx = canvas.getContext('2d');
  const draw = Draw.create(ctx);

  /* ====================================================================
   * 2. 칠판 배치 (layout.js 가 계산, 여기서는 단계별 틀을 모아 둡니다)
   * ==================================================================== */
  let frame = null; // { W, wide, H, plans:[plan], warnings:[] }
  let dpr = 1;

  function layoutAll() {
    const stage = byId('board-stage');
    const W = Math.max(280, Math.floor(stage.clientWidth));
    dpr = clamp(window.devicePixelRatio || 1, 1, 2.5);
    const plans = steps.map((S) => L.planStep(S.raw, W, draw.measure));
    const wide = plans[0].wide;
    const H = Math.ceil(Math.max.apply(null, plans.map((p) => p.height)));
    const warnings = [];
    plans.forEach((p, i) => p.issues.forEach((is) => warnings.push(steps[i].id + ': ' + is.detail)));
    frame = { W, wide, H, plans, warnings };
    canvas.width = 0; // render()가 단계에 맞는 크기로 다시 맞춥니다
  }

  /** 넓은 화면은 모든 단계가 같은 높이, 좁은 화면은 단계마다 필요한 높이로 맞춥니다. */
  const frameHeight = (i) => Math.ceil(frame.wide ? frame.H : frame.plans[i].height);

  function syncCanvasSize() {
    const H = frameHeight(index);
    const pw = Math.round(frame.W * dpr);
    const ph = Math.round(H * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
      canvas.style.height = H + 'px';
    }
    return H;
  }

  /* ====================================================================
   * 3. 분필 소리 · 해설 음성 — 둘 다 파일 안에 내장된 녹음만 씁니다(합성·외부 대체 없음)
   * ==================================================================== */
  const el = {
    status: byId('status'), time: byId('time'), progress: byId('progress'), fill: byId('progress-fill'),
    play: byId('play'), playLabel: byId('play-label'),
    prev: byId('prev'), next: byId('next'), replay: byId('replay'), restart: byId('restart'),
    autoToggle: byId('auto-toggle'), autoState: byId('auto-state'), speed: byId('speed'),
    voiceToggle: byId('voice-toggle'), voiceState: byId('voice-state'), voiceLabel: byId('voice-label'),
    voiceChip: byId('voice-chip-label'), voiceNote: byId('voice-note'),
    chalkToggle: byId('chalk-toggle'), chalkState: byId('chalk-state'), chalkNote: byId('chalk-note'),
    chalkVolume: byId('chalk-volume'), chalkVolumeValue: byId('chalk-volume-value'),
    hint: byId('board-hint'), hintText: byId('hint-text'),
    kicker: byId('board-kicker-text'), title: byId('board-title'), count: byId('board-count'), tag: byId('board-tag'),
    legend: byId('legend'), chapters: byId('chapters'), summary: byId('summary'), beats: byId('beats'),
    callout: byId('callout'), calloutTitle: byId('callout-title'), calloutText: byId('callout-text'),
    captionToggle: byId('caption-toggle'), captionBody: byId('caption-body'), sr: byId('board-sr'),
    transcriptText: byId('transcript-text'),
    quote: byId('quote'), quoteHan: byId('quote-han'), quoteReading: byId('quote-reading'),
    quoteMeaning: byId('quote-meaning'), quoteWhere: byId('quote-where'),
    digest: byId('digest'), digestTitle: byId('digest-title'),
    lectureFill: byId('lecture-progress-fill'), lectureText: byId('lecture-progress-text'),
    reducedNote: byId('reduced-note'),
  };

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
  let voiceEnabled = HAS_AUDIO;
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
    retime();
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
   * 4. 렌더 · 재생
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

  /** 이 단계의 시간 기준 길이 D(초): 쓸 수 있는 음성이 있으면 그 클립 길이, 아니면 글자 수로 추정한 길이 */
  function stepDur(S) {
    return voiceUsable() && S.raw.audioDuration > 0 ? S.raw.audioDuration : S.est;
  }
  let curD = stepDur(steps[0]);
  const endCache = { index: -1, D: 0, value: 0 };
  function stepEnd() {
    const S = steps[index];
    const D = curD;
    if (endCache.index !== index || endCache.D !== D) {
      endCache.index = index;
      endCache.D = D;
      endCache.value = L.stepEnd(S.raw, D);
    }
    return endCache.value;
  }
  /** D 가 바뀌면(음성 끔·오류·다시 켬) 판서 시계를 같은 진행 비율로 옮깁니다. */
  function retime() {
    const D = stepDur(steps[index]);
    if (Math.abs(D - curD) < 1e-9) return;
    t = t * (D / curD);
    curD = D;
  }

  const effT = () => (reduced ? stepEnd() : t);
  const drawDone = () => reduced || t >= stepEnd() - 1e-6;
  /** 단계 완료 = 판서 끝 && 음성 끝(음성이 꺼져 있거나 오류면 판서 끝) */
  const isComplete = () => drawDone() && voiceFinished();
  /** 자동 넘김을 쓸 수 있는가: 줄어든 동작에서는 해설 음성만이 시간을 재 주므로 음성이 있어야 합니다. */
  const autoAvailable = () => !reduced || voiceUsable();

  function render() {
    if (!frame) return;
    const H = syncCanvasSize();
    const plan = frame.plans[index];
    const offY = frame.wide ? Math.max(0, (H - plan.height) / 2) : 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, frame.W, H);
    const tt = effT();
    const tips = [];
    ctx.save();
    ctx.translate(0, offY);
    draw.boardOutline(plan.board);
    draw.renderPrims(plan.prims, tt, curD, tips);
    ctx.restore();
    draw.applyGrain(frame.W, H);

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
      if (lastTip) {
        ctx.save();
        ctx.translate(0, offY);
        draw.drawChalkPiece(lastTip.x, lastTip.y, penDown, clamp(frame.W / 900, 0.7, 1));
        ctx.restore();
      }
    }
    chalk.update(chalkEnabled && contact ? contact : null);
    updateProgressUI();
  }

  /**
   * 한 프레임(dt 실제 초)만큼 시계를 진행합니다.
   * - 음성이 재생 중이면 판서 시계는 오디오의 currentTime 을 따라가고(dt 를 더하지 않음 → 이중 계산 없음),
   * - 그렇지 않으면 자체 시계(dt × 속도)로 흐릅니다.
   * - 단계가 "완료"된 뒤 실제로 흐른 시간만 hold 에 쌓입니다(속도와 무관한 실제 0.9초).
   */
  function advance(dt) {
    retime();
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
   * 5. 화면 갱신
   * ==================================================================== */
  const REDUCED_WITH_VOICE = '움직임 줄이기가 켜져 있어요. 판서 애니메이션 없이 완성된 칠판을 보여 주고 해설 음성만 재생합니다.';
  const REDUCED_NO_VOICE = '움직임 줄이기가 켜져 있어요. 완성된 칠판만 보여 주며, 해설 음성이 꺼져 있어 "자동 넘김"을 쓸 수 없어요. "다음 단계 보기"로 직접 넘겨 주세요.';
  const NO_AUDIO_LABEL = '개발용 빌드 · 해설 음성이 들어 있지 않아요. 판서는 글 길이로 어림한 시간에 맞춰 진행합니다';

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
    if (el.voiceToggle) el.voiceToggle.setAttribute('aria-disabled', String(!HAS_AUDIO));
    syncToggle(el.chalkToggle, el.chalkState, chalkEnabled);
    if (el.voiceLabel) {
      el.voiceLabel.textContent = !HAS_AUDIO ? NO_AUDIO_LABEL : voiceEnabled ? VOICE_LABEL + ' (AI 합성)' : '해설 음성을 껐어요 · 판서와 설명 글만 진행합니다';
    }
    if (el.voiceChip) {
      el.voiceChip.textContent = !HAS_AUDIO ? '개발용 빌드 (음성 없음)' : VOICE_NAME ? VOICE_NAME + ' · ' + (PROVIDER.model || 'MAI-Voice-2') + ' (AI 합성)' : VOICE_LABEL;
    }
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
  let lastLecture = '';
  /** 현재 단계의 진행 비율(0~1): 음성이 있으면 음성 길이 기준, 아니면 판서 시계 기준 */
  function stepProgress() {
    const S = steps[index];
    const dur = S.raw.audioDuration || 0;
    if (voiceUsable() && dur > 0) {
      const ct = audioLoaded === index && voice ? voice.currentTime || 0 : 0;
      return { frac: voiceDone ? 1 : clamp(ct / dur, 0, 1), cur: voiceDone ? dur : clamp(ct, 0, dur), total: dur };
    }
    const end = stepEnd();
    const tt = effT();
    return { frac: end > 0 ? clamp(tt / end, 0, 1) : 1, cur: tt, total: end };
  }

  function updateProgressUI() {
    const S = steps[index];
    const tt = effT();
    const pr = stepProgress();
    const clock = formatClock(pr.cur) + ' / ' + formatClock(pr.total);
    el.fill.style.transform = 'scaleX(' + pr.frac.toFixed(4) + ')';
    const pct = Math.round(pr.frac * 100);
    if (pct !== lastPct) {
      lastPct = pct;
      el.progress.setAttribute('aria-valuenow', String(pct));
      el.progress.setAttribute('aria-valuetext', pct + '%');
    }
    if (clock !== lastClock) {
      lastClock = clock;
      el.time.textContent = clock;
    }
    if (el.lectureFill) {
      const whole = clamp((index + (ended || isComplete() ? 1 : pr.frac)) / N, 0, 1);
      el.lectureFill.style.transform = 'scaleX(' + whole.toFixed(4) + ')';
      const text = (index + 1) + ' / ' + N + ' 단계';
      if (text !== lastLecture) { lastLecture = text; el.lectureText.textContent = text; }
    }
    // 설명 순서 강조: beats[].at 는 해설 길이의 비율이므로 D 를 곱해 판서 시계와 맞춥니다.
    const beats = S.raw.beats;
    const done = drawDone();
    let active = -1;
    if (!done) for (let i = 0; i < beats.length; i++) if (beats[i].at * curD <= tt) active = i;
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
    for (const item of S.raw.legend || []) {
      const li = document.createElement('li');
      const sw = document.createElement('span');
      sw.className = 'swatch' + (item.style === 'line' ? '' : ' is-' + item.style);
      sw.style.setProperty('--c', COLORS[item.color]);
      sw.setAttribute('aria-hidden', 'true');
      const tx = document.createElement('span');
      tx.textContent = item.text;
      const hidden = document.createElement('span');
      hidden.className = 'sr-only';
      hidden.textContent = ' (' + COLOR_KO[item.color] + ')';
      li.append(sw, tx, hidden);
      frag.appendChild(li);
    }
    el.legend.replaceChildren(frag);
  }

  function buildDigest(S) {
    const frag = document.createDocumentFragment();
    for (const card of S.raw.digest || []) {
      const li = document.createElement('li');
      li.className = 'digest-card';
      const head = document.createElement('strong');
      head.className = 'digest-head';
      head.textContent = card.head;
      const text = document.createElement('span');
      text.className = 'digest-text';
      text.textContent = card.text;
      li.append(head, text);
      frag.appendChild(li);
    }
    el.digest.replaceChildren(frag);
    if (el.digestTitle) el.digestTitle.textContent = '한 장 요약 · ' + S.raw.title;
  }

  function updateQuote(S) {
    const q = S.raw.quote;
    if (!el.quote) return;
    el.quote.hidden = !q;
    if (!q) return;
    el.quoteHan.textContent = q.han;
    el.quoteReading.textContent = q.reading;
    el.quoteMeaning.textContent = q.meaning;
    el.quoteWhere.textContent = q.where;
  }

  function updateStepUI() {
    const S = steps[index];
    const raw = S.raw;
    el.kicker.textContent = raw.kicker || '';
    el.title.textContent = raw.title;
    el.count.textContent = (index + 1) + ' / ' + N;
    el.tag.textContent = raw.tag.text;
    el.tag.dataset.tone = raw.tag.tone;
    el.summary.textContent = raw.summary;
    const frag = document.createDocumentFragment();
    raw.beats.forEach((b) => {
      const li = document.createElement('li');
      li.textContent = b.text;
      frag.appendChild(li);
    });
    el.beats.replaceChildren(frag);
    lastBeat = -2;
    el.callout.dataset.tone = raw.callout.tone;
    el.calloutTitle.textContent = raw.callout.title;
    el.calloutText.textContent = raw.callout.text;
    updateQuote(S);
    buildDigest(S);
    buildLegend(S);
    canvas.setAttribute('aria-label', '칠판 ' + (index + 1) + '단계: ' + raw.title + (raw.han ? ' (' + raw.han + ')' : ''));
    el.sr.textContent = raw.alt;
    if (el.transcriptText) el.transcriptText.textContent = raw.narration || '';
    [...el.chapters.querySelectorAll('.chapter-btn')].forEach((b, i) => {
      b.classList.toggle('is-current', i === index);
      b.classList.toggle('is-seen', i !== index && visited.has(i));
      if (i === index) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    lastPct = -1;
    lastLecture = '';
    try {
      history.replaceState(null, '', '#' + (index + 1));
    } catch (e) { /* file:// 등에서 막히면 주소 갱신만 건너뜁니다 */ }
  }

  /** 단계 목록: 배경 / 본론 열세 편 / 마무리 묶음별로 */
  function buildChapters() {
    const frag = document.createDocumentFragment();
    let list = null;
    let lastPart = '';
    steps.forEach((S, i) => {
      const part = S.raw.part;
      if (part !== lastPart) {
        const group = document.createElement('div');
        group.className = 'chapter-group';
        group.dataset.part = part;
        const gt = document.createElement('p');
        gt.className = 'group-title';
        gt.textContent = PART_LABEL[part] || part;
        list = document.createElement('ol');
        list.className = 'chapter-list';
        group.append(gt, list);
        frag.appendChild(group);
        lastPart = part;
      }
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
      b.setAttribute('aria-label', (i + 1) + '단계 ' + S.raw.nav + ' (' + (PART_LABEL[part] || part) + ')');
      b.addEventListener('click', () => goTo(i));
      li.appendChild(b);
      list.appendChild(li);
    });
    el.chapters.replaceChildren(frag);
  }

  function buildExtras() {
    const mis = byId('mis-list');
    const frag = document.createDocumentFragment();
    for (const m of DATA.misconceptions || []) {
      const li = document.createElement('li');
      li.className = 'mis-item';
      const h = document.createElement('p');
      h.className = 'mis-title';
      h.textContent = m.title;
      const p = document.createElement('p');
      p.className = 'mis-text';
      p.textContent = m.text;
      li.append(h, p);
      frag.appendChild(li);
    }
    mis.replaceChildren(frag);
    const refs = byId('ref-list');
    const rf = document.createDocumentFragment();
    for (const r of DATA.references || []) {
      const li = document.createElement('li');
      li.textContent = r;
      rf.appendChild(li);
    }
    refs.replaceChildren(rf);
    const src = byId('source-note');
    if (src && DATA.source) {
      src.textContent = '참고한 영상: ' + DATA.source.title + ' · ' + DATA.source.channel + '. ' + DATA.source.note;
    }
  }

  /* ====================================================================
   * 6. 퀴즈 (강의 끝: 6문항, 보기 3개, 즉시 피드백, 점수)
   * ==================================================================== */
  const quiz = DATA.quiz || [];
  const quizAnswers = quiz.map(() => null); // 고른 보기 번호 | null
  const quizEls = [];
  const OPT_LETTERS = ['①', '②', '③', '④'];

  /** 퀴즈가 가리키는 편(chapterNo 1~13)의 단계 번호. 0 이면 배경 첫 단계. */
  function stepIndexForChapter(no) {
    if (no >= 1) {
      const k = steps.findIndex((S) => S.raw.part === 'chapter' && S.raw.chapterNo === no);
      if (k >= 0) return k;
    }
    return 0;
  }

  function quizScore() {
    let correct = 0;
    let answered = 0;
    quiz.forEach((q, qi) => {
      const a = quizAnswers[qi];
      if (a === null) return;
      answered += 1;
      if (q.options[a].correct) correct += 1;
    });
    return { correct, answered, total: quiz.length };
  }

  function updateQuizScore() {
    const s = quizScore();
    const node = byId('quiz-score');
    if (!node) return;
    let msg = '맞힌 문제 ' + s.correct + ' / ' + s.total + ' · 푼 문제 ' + s.answered + ' / ' + s.total;
    if (s.total > 0 && s.answered === s.total) {
      msg += s.correct === s.total ? ' · 모두 맞혔어요!' : ' · 틀린 문제의 "다시 보기"로 해당 편을 복습해 보세요';
    }
    node.textContent = msg;
  }

  function renderQuizQuestion(qi) {
    const q = quiz[qi];
    const ui = quizEls[qi];
    const a = quizAnswers[qi];
    const right = q.options.findIndex((o) => o.correct);
    ui.buttons.forEach((b, oi) => {
      const opt = q.options[oi];
      let state = 'idle';
      let result = '';
      if (a !== null) {
        if (oi === a) { state = opt.correct ? 'right' : 'wrong'; result = opt.correct ? '정답' : '오답'; } else if (oi === right) { state = 'reveal'; result = '정답은 이 보기예요'; }
      }
      b.dataset.state = state;
      b.setAttribute('aria-disabled', String(a !== null));
      b.setAttribute('aria-pressed', String(a === oi));
      ui.results[oi].textContent = result;
    });
    ui.fb.replaceChildren();
    if (a === null) { ui.fb.hidden = true; ui.fb.className = 'quiz-fb'; return; }
    ui.fb.hidden = false;
    ui.fb.className = 'quiz-fb ' + (q.options[a].correct ? 'is-correct' : 'is-wrong');
    const first = document.createElement('p');
    first.textContent = (q.options[a].correct ? '정답! ' : '아쉬워요. ') + q.options[a].feedback;
    ui.fb.appendChild(first);
    if (!q.options[a].correct) {
      const second = document.createElement('p');
      second.textContent = '정답은 ' + OPT_LETTERS[right] + '번이에요. ' + q.options[right].feedback;
      ui.fb.appendChild(second);
    }
  }

  function answerQuiz(qi, oi) {
    const q = quiz[qi];
    if (!q || !q.options[oi] || quizAnswers[qi] !== null) return;
    quizAnswers[qi] = oi;
    renderQuizQuestion(qi);
    updateQuizScore();
  }

  function resetQuiz() {
    quizAnswers.fill(null);
    quiz.forEach((q, qi) => renderQuizQuestion(qi));
    updateQuizScore();
  }

  function buildQuiz() {
    const list = byId('quiz-list');
    if (!list) return;
    const frag = document.createDocumentFragment();
    quiz.forEach((q, qi) => {
      const li = document.createElement('li');
      li.className = 'quiz-q';
      const head = document.createElement('p');
      head.className = 'quiz-question';
      head.textContent = q.question;
      const opts = document.createElement('ul');
      opts.className = 'quiz-options';
      const ui = { buttons: [], results: [], fb: null };
      q.options.forEach((opt, oi) => {
        const row = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'quiz-opt';
        b.dataset.state = 'idle';
        const mark = document.createElement('span');
        mark.className = 'opt-mark';
        mark.textContent = OPT_LETTERS[oi];
        mark.setAttribute('aria-hidden', 'true');
        const text = document.createElement('span');
        text.className = 'opt-text';
        text.textContent = opt.text;
        const result = document.createElement('span');
        result.className = 'opt-result';
        b.append(mark, text, result);
        b.addEventListener('click', () => answerQuiz(qi, oi));
        row.appendChild(b);
        opts.appendChild(row);
        ui.buttons.push(b);
        ui.results.push(result);
      });
      const fb = document.createElement('div');
      fb.className = 'quiz-fb';
      fb.setAttribute('role', 'status');
      fb.hidden = true;
      ui.fb = fb;
      const jump = document.createElement('button');
      jump.type = 'button';
      jump.className = 'btn btn-small quiz-jump';
      jump.textContent = q.chapterNo >= 1 ? '제' + q.chapterNo + '편 다시 보기' : '배경 다시 보기';
      jump.addEventListener('click', () => {
        goTo(stepIndexForChapter(q.chapterNo), { play: false });
        const stage = byId('board-stage');
        if (stage && typeof stage.scrollIntoView === 'function') {
          try { stage.scrollIntoView({ block: 'center' }); } catch (e) { /* 스크롤만 건너뜁니다 */ }
        }
      });
      li.append(head, opts, fb, jump);
      frag.appendChild(li);
      quizEls.push(ui);
    });
    list.replaceChildren(frag);
    const retry = byId('quiz-retry');
    if (retry) retry.addEventListener('click', resetQuiz);
    updateQuizScore();
  }

  /* ====================================================================
   * 7. 조작
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
    curD = stepDur(steps[index]);
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
    const want = !!on && HAS_AUDIO;
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
      retime();
      if (reduced && playing) {
        playing = false;
        hold = 0;
        stopLoop();
        chalk.stop();
      }
    } else if (playing) {
      enterStep(index, true);
      return;
    } else {
      retime();
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
    curD = stepDur(steps[index]);
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
      if (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY') return; // 버튼은 스스로 눌림 처리
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
   * 8. 공개 API · 시작
   * ==================================================================== */
  function getState() {
    const S = steps[index];
    const plan = frame ? frame.plans[index] : null;
    const tt = effT();
    const cs = chalk.state();
    const voiceMode = !voiceEnabled ? 'off' : voiceError ? 'error' : voiceStarted ? 'embedded' : 'idle';
    const dur = S.raw.audioDuration || 0;
    const sp = stepProgress();
    const qs = quizScore();
    return {
      ready: !!frame,
      index, count: N, id: S.id, kind: S.kind,
      playing, started, ended, reduced, auto, autoAvailable: autoAvailable(), speed,
      t: Number(tt.toFixed(3)), animEnd: Number(stepEnd().toFixed(3)), duration: Number(curD.toFixed(3)),
      complete: isComplete(), drawDone: drawDone(), drawing: playing && !drawDone() && !reduced,
      hold: Number(hold.toFixed(3)), holdEnd: GAP_SEC,
      voiceEnabled, hasAudio: HAS_AUDIO, chalkEnabled, voiceMode, voiceDone: voiceFinished(), voiceError,
      audioTime: audioLoaded === index && voice ? Number((voice.currentTime || 0).toFixed(3)) : 0,
      audioDuration: dur,
      penDown, writingCharacter,
      chalkVolume: cs.volume, chalkReady: cs.ready, chalkError: cs.error,
      progress: sp.frac,
      quiz: { answered: qs.answered, correct: qs.correct, total: qs.total },
      canvas: frame ? { cssW: frame.W, cssH: frameHeight(index), dpr, wide: frame.wide } : null,
      board: plan ? { mode: plan.mode || '', x: plan.board.x, y: plan.board.y, w: plan.board.w, h: plan.board.h } : null,
      warnings: frame ? frame.warnings.slice() : [],
    };
  }

  function layoutReport() {
    return {
      width: frame ? frame.W : 0, height: frame ? frame.H : 0, wide: frame ? frame.wide : false,
      warnings: frame ? frame.warnings.slice() : [],
      steps: steps.map((S, i) => ({
        id: S.id, kind: S.kind,
        mode: frame ? frame.plans[i].mode || '' : '',
        animEnd: Number(L.stepEnd(S.raw, S.est).toFixed(3)),
        estimatedDuration: Number(S.est.toFixed(3)),
        neededHeight: frame ? Math.round(frame.plans[i].height) : 0,
        issues: frame ? frame.plans[i].issues.map((is) => ({ level: is.level, kind: is.kind, detail: is.detail })) : [],
      })),
    };
  }

  window.artOfWarPlayer = {
    getState, layoutReport, goTo, play, pause, toggle, next, prev, replay, restart, seek, setSpeed, setAuto,
    setVoiceEnabled, setChalkEnabled, setChalkVolume, answerQuiz, resetQuiz,
    get steps() { return steps.map((S) => S.id); },
  };

  function init() {
    byId('lesson-title').textContent = DATA.title;
    byId('lesson-eyebrow').textContent = DATA.eyebrow;
    byId('lesson-subtitle').textContent = DATA.subtitle;
    byId('lesson-count').textContent = '· ' + N + '단계';
    el.hintText.textContent = (DATA.ui && DATA.ui.hint) || '';
    buildChapters();
    buildExtras();
    buildQuiz();
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
    if (el.voiceToggle) {
      el.voiceToggle.addEventListener('click', () => {
        if (!HAS_AUDIO) return; // 개발용 빌드: 켤 음성이 없음
        setVoiceEnabled(el.voiceToggle.getAttribute('aria-pressed') !== 'true');
      });
    }
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
    curD = stepDur(steps[index]);
    chalk.setVolume(CHALK_DEFAULT_VOLUME);
    layoutAll();
    lastW = frame.W;
    t = reduced ? stepEnd() : 0;
    syncControlsUI();
    updateStepUI();
    updatePlayUI();
    refreshStatus();
    render();
    // 손글씨·한자 글꼴이 준비되면 글자 폭이 달라지므로 한 번 더 배치합니다.
    if (document.fonts && document.fonts.load) {
      Promise.all([
        document.fonts.load('30px ChalkKorean', '가나다ABC123'),
        document.fonts.load('30px ChalkHanja', '孫子兵法'),
      ]).then(() => {
        layoutAll();
        render();
      }).catch(() => { /* 글꼴을 못 읽어도 대체 글꼴로 계속합니다 */ });
    }
  }

  init();
})();
