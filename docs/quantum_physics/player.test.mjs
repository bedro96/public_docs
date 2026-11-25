// 재생기 상태 기계 시험: 시계, 해설 음성, 분필 소리, 자동 넘김, 줄어든 동작.  실행: node --test   (이 폴더에서)
//
// 브라우저 없이 player.js 를 Node vm 에 올립니다. DOM·Canvas·Audio·AudioContext·requestAnimationFrame 은
// 이 파일의 가짜 구현이며, 시간은 시험이 직접 흘려 보냅니다(벽시계·미디어 시계를 따로 제어).
// 실제 Chrome 에서의 확인은 verify_browser.py / verify_media.py / verify_chalk.py 가 맡습니다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { ROOT, loadContent } from './build.mjs';

const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');
const require = createRequire(import.meta.url);
const QM = require('./qmath.js');
// 장면은 content/ 에서 조립합니다(조립 결과 파일이나 TTS 산출물에 의존하지 않음). 음성 길이는 대본 길이로 추정한 값입니다.
const LOADED = loadContent(path.join(ROOT, 'content'));
assert.ok(LOADED.meta && LOADED.steps.length >= 2, 'content/ 에 00-meta.json 과 단계 파일이 있어야 시험할 수 있습니다');
const SCENE = Object.assign({}, LOADED.meta, { steps: LOADED.steps.map((s) => s.step) });
const IDS = SCENE.steps.map((s) => s.id);
const LAST = IDS.length - 1;
const durationsOf = (scene) => Object.fromEntries(scene.steps.map((s) => [s.id, Math.round(QM.estimateNarration(s.narration) * 1000) / 1000]));
const DURATIONS = durationsOf(SCENE);
// 보드 종류마다 한 단계씩 있는 시험용 강의 (tests/fixtures/content)
const FIXTURE_LOADED = loadContent(path.join(ROOT, 'tests', 'fixtures', 'content'), { free: true });
const FIXTURE = Object.assign({}, FIXTURE_LOADED.meta, { steps: FIXTURE_LOADED.steps.map((s) => s.step) });
const TEMPLATE = read('template.html');
const QMATH_SRC = read('qmath.js');
const PLAYER_SRC = read('player.js');
const GAP = 0.9;

/* ---------------------------------------------------------------------
 * 가짜 브라우저
 * ------------------------------------------------------------------- */
function makeCtx() {
  const state = {};
  const returns = {
    measureText: (s) => ({ width: String(s).length * 11 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createPattern: () => ({}),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  };
  return new Proxy(state, {
    get(t, k) {
      if (k in t) return t[k];
      if (returns[k]) return returns[k];
      return () => undefined;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

function makeEl(id, tag, ctx, attrs = {}) {
  const listeners = {};
  const classes = new Set();
  const el = {
    id, tagName: String(tag || 'div').toUpperCase(), children: [], style: { setProperty() {} }, dataset: {},
    attrs: { ...attrs }, hidden: 'hidden' in attrs, textContent: '', value: attrs.value || '', clientWidth: 900, clientHeight: 500,
    width: 0, height: 0, open: false,
    get className() { return [...classes].join(' '); },
    set className(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach((c) => classes.add(c)); },
    classList: {
      toggle(c, force) { const on = force === undefined ? !classes.has(c) : !!force; if (on) classes.add(c); else classes.delete(c); return on; },
      add(c) { classes.add(c); }, remove(c) { classes.delete(c); }, contains: (c) => classes.has(c),
    },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    removeAttribute(k) { delete this.attrs[k]; },
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener() {},
    dispatch(type, ev) { for (const fn of listeners[type] || []) fn(Object.assign({ type, target: el, currentTarget: el, preventDefault() {} }, ev)); },
    appendChild(c) { this.children.push(c); return c; },
    append(...cs) { this.children.push(...cs); },
    replaceChildren(...cs) { this.children = cs.flatMap((c) => (c && c.isFragment ? c.children : [c])); },
    querySelector() { return makeEl(null, 'div', ctx); },
    querySelectorAll() { return []; },
    closest() { return null; },
    focus() {},
    getContext() { return ctx; },
  };
  return el;
}

function createEnv(opts = {}) {
  const o = { reduced: false, playReject: null, ctxState: 'running', decodeFails: false, stall: false, ...opts };
  const USED = o.scene || SCENE; // 이 환경이 쓰는 장면(기본: 실제 content, scene 옵션: 시험용 fixture)
  const SDUR = o.scene ? durationsOf(o.scene) : DURATIONS;
  const ctxBlocked = o.ctxState === 'blocked'; // 사용자 동작이 없어 resume() 해도 suspended 로 남는 브라우저
  const clock = { now: 1000 };
  let frameTs = 1000;
  const raf = new Map();
  let rafSeq = 0;
  const docListeners = {};
  const winListeners = {};
  const ctx2d = makeCtx();
  const audios = [];
  const audioCtxs = [];
  const decoded = { duration: 14.064, tag: 'decoded-chalk' };
  const counters = { createBuffer: 0, createOscillator: 0, speech: 0, play: 0 };

  // 템플릿의 id 와 똑같은 요소만 만듭니다. 플레이어가 템플릿에 없는 id 를 쓰면 바로 드러납니다.
  const els = new Map();
  for (const m of TEMPLATE.matchAll(/<([a-z0-9]+)\b([^>]*?)>/gi)) {
    const idm = /\sid="([^"]+)"/.exec(m[2]);
    if (!idm) continue;
    const attrs = {};
    for (const a of m[2].matchAll(/\s([a-z-]+)="([^"]*)"/gi)) attrs[a[1]] = a[2];
    if (/\shidden(\s|$)/.test(m[2])) attrs.hidden = '';
    els.set(idm[1], makeEl(idm[1], m[1], ctx2d, attrs));
  }
  const mq = { matches: !!o.reduced, listeners: [], addEventListener(t, fn) { this.listeners.push(fn); }, removeEventListener() {} };

  class FakeAudio {
    constructor() {
      audios.push(this);
      this.listeners = {};
      this.paused = true; this.ended = false; this.currentTime = 0; this.playbackRate = 1; this.defaultPlaybackRate = 1;
      this.duration = NaN; this.error = null; this._src = ''; this.preload = ''; this.volume = 1; this.muted = false;
      this.pauseCalls = 0; this.playCalls = 0;
    }
    get src() { return this._src; }
    set src(v) {
      this._src = v; this.paused = true; this.ended = false; this.currentTime = 0; this.playbackRate = this.defaultPlaybackRate;
      const step = USED.steps.find((s) => v.endsWith(':' + s.id));
      this.duration = step ? SDUR[step.id] : NaN;
      this.stepId = step ? step.id : null;
    }
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
    emit(type) { for (const fn of this.listeners[type] || []) fn({ type, target: this }); }
    play() {
      this.playCalls += 1; counters.play += 1;
      if (o.playReject) return Promise.reject(Object.assign(new Error(o.playReject), { name: o.playReject }));
      if (this.ended) { this.currentTime = 0; this.ended = false; }
      this.paused = false;
      return Promise.resolve();
    }
    pause() {
      this.pauseCalls += 1;
      if (this.paused) return;
      this.paused = true;
      Promise.resolve().then(() => this.emit('pause'));
    }
    advance(sec) {
      if (this.paused || this.ended || o.stall) return;
      this.currentTime += sec * this.playbackRate;
      if (isFinite(this.duration) && this.currentTime >= this.duration) {
        this.currentTime = this.duration; this.ended = true; this.paused = true;
        Promise.resolve().then(() => { this.emit('pause'); this.emit('ended'); });
      }
    }
  }

  class FakeAudioContext {
    constructor() {
      audioCtxs.push(this);
      this.state = ctxBlocked ? 'suspended' : o.ctxState; this.destination = {}; this.sources = []; this.resumeCalls = 0;
    }
    get currentTime() { return clock.now / 1000; }
    createGain() {
      return { gain: { value: 1, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime(v) { this.value = v; }, cancelScheduledValues() {} }, connect() {}, disconnect() {} };
    }
    createBufferSource() {
      const s = {
        buffer: null, startedAt: null, offset: null, stoppedAt: null, onended: null, connect() {}, disconnect() {},
        start(when, offset) { s.startedAt = when; s.offset = offset; }, stop(when) { s.stoppedAt = when; },
      };
      this.sources.push(s);
      return s;
    }
    createBuffer() { counters.createBuffer += 1; throw new Error('합성 버퍼는 허용되지 않습니다'); }
    createOscillator() { counters.createOscillator += 1; throw new Error('합성 오실레이터는 허용되지 않습니다'); }
    decodeAudioData() { return o.decodeFails ? Promise.reject(new Error('decode failed')) : Promise.resolve(decoded); }
    resume() {
      this.resumeCalls += 1;
      if (ctxBlocked) return Promise.resolve();
      this.state = 'running';
      return Promise.resolve();
    }
  }

  const doc = {
    hidden: false, visibilityState: 'visible',
    fonts: { load: () => Promise.resolve() },
    getElementById: (id) => els.get(id) || null,
    createElement: (tag) => makeEl(null, tag, ctx2d),
    createDocumentFragment: () => ({ isFragment: true, children: [], appendChild(c) { this.children.push(c); return c; }, append(...cs) { this.children.push(...cs); } }),
    createTextNode: (text) => ({ nodeType: 3, textContent: text }),
    addEventListener(type, fn) { (docListeners[type] = docListeners[type] || []).push(fn); },
    removeEventListener() {},
  };
  const win = {
    document: doc, devicePixelRatio: 1,
    matchMedia: () => mq,
    addEventListener(type, fn) { (winListeners[type] = winListeners[type] || []).push(fn); },
    removeEventListener() {},
    location: { hash: o.hash || '' }, history: { replaceState() {} },
    navigator: { userActivation: { hasBeenActive: true } },
    performance: { now: () => clock.now },
    requestAnimationFrame(cb) { rafSeq += 1; raf.set(rafSeq, cb); return rafSeq; },
    cancelAnimationFrame(id) { raf.delete(id); },
    atob: (s) => Buffer.from(s, 'base64').toString('latin1'),
    console,
    Audio: FakeAudio, AudioContext: FakeAudioContext,
    get speechSynthesis() { counters.speech += 1; throw new Error('speechSynthesis 는 쓰지 않습니다'); },
  };
  win.window = win;
  const lesson = JSON.parse(JSON.stringify(USED));
  for (const st of lesson.steps) {
    st.audio = 'data:audio/mpeg;base64,STEP:' + st.id;
    st.audioDuration = SDUR[st.id];
  }
  lesson.narrationProvider = { provider: 'Microsoft Foundry / Azure AI Speech', model: 'MAI-Voice-2', voice: 'ko-KR-Haena:MAI-Voice-2', language: 'ko-KR', synthetic: true };
  lesson.chalkSound = { title: 'Writing with Chalk', creator: 'digitale.de', license: 'CC0-1.0', recorded: true, audio: 'data:audio/mpeg;base64,Q0hBTEs=' };
  win.LESSON_DATA = lesson;

  const sandbox = vm.createContext(win);
  vm.runInContext(QMATH_SRC, sandbox, { filename: 'qmath.js' });
  vm.runInContext(PLAYER_SRC, sandbox, { filename: 'player.js' });

  const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
  const env = {
    P: win.quantumPlayer, win, doc, els, audios, audioCtxs, counters, clock, decoded, mq, raf,
    get audio() { return audios[0]; },
    get actx() { return audioCtxs[0]; },
    el: (id) => els.get(id),
    state: () => win.quantumPlayer.getState(),
    status: () => els.get('status').textContent,
    flush,
    /** 프레임 하나: 미디어가 먼저 흐르고, rAF 타임스탬프 = 프레임 시작, performance.now = 타임스탬프 + 렌더 시간 */
    async frame(ms = 1000 / 60, renderMs = 6) {
      for (const a of audios) a.advance(ms / 1000);
      frameTs += ms;
      clock.now = frameTs + renderMs;
      const cbs = [...raf.entries()];
      raf.clear();
      for (const [, cb] of cbs) cb(frameTs);
      await flush();
    },
    async frames(n, ms, renderMs) { for (let i = 0; i < n; i++) await env.frame(ms, renderMs); },
    async seconds(s, ms = 1000 / 60, renderMs = 6) { await env.frames(Math.round((s * 1000) / ms), ms, renderMs); },
    /** 조건이 참이 될 때까지 프레임을 돌립니다(최대 maxS초). */
    async until(pred, maxS = 120, ms = 1000 / 30) {
      // 이 강의의 한 단계는 약 40~55초 판서이므로, 40초 이상을 기다리라는 요청은 2.5배 여유를 둡니다.
      const n = Math.ceil(((maxS >= 40 ? maxS * 2.5 : maxS) * 1000) / ms);
      for (let i = 0; i < n; i++) {
        if (pred()) return true;
        await env.frame(ms);
      }
      return pred();
    },
    /** 음성이 끝나기 직전으로 건너뛰고 끝까지 흘려 보냅니다. */
    async finishVoice() {
      const a = env.audio;
      a.currentTime = Math.max(a.currentTime, a.duration - 0.2);
      await env.until(() => env.state().voiceDone, 5);
    },
    activeChalk(lead = 0.01) { // 지금 시각 + lead 이후에도 소리가 나는 조각 수
      const c = env.actx;
      if (!c) return 0;
      const at = c.currentTime + lead;
      return c.sources.filter((s) => s.startedAt !== null && (s.stoppedAt === null || s.stoppedAt > at)).length;
    },
    setReduced(on) { mq.matches = !!on; for (const fn of mq.listeners) fn({ matches: !!on }); },
    setHidden(on) { doc.hidden = !!on; doc.visibilityState = on ? 'hidden' : 'visible'; for (const fn of docListeners.visibilitychange || []) fn({ type: 'visibilitychange' }); },
    fireWin(type) { for (const fn of winListeners[type] || []) fn({ type }); },
    click(id) { els.get(id).dispatch('click'); },
  };
  return env;
}

/** 음성 없이 판서 시계만 시험할 때(옛 구현에서도 같은 호출이 실패 이유를 시계로 남기도록 선택 호출). */
const voiceOff = (env) => { if (typeof env.P.setVoiceEnabled === 'function') env.P.setVoiceEnabled(false); };

/* ---------------------------------------------------------------------
 * 1. 시계 — 뿌리 원인: schedule() 이 매 프레임 performance.now() 로 기준점을 덮어써 렌더 시간이 시계에서 빠졌음
 * ------------------------------------------------------------------- */
test('시계: 렌더에 6ms 가 걸려도 판서 시계는 벽시계와 같다 (rAF 타임스탬프가 기준)', async () => {
  const env = createEnv();
  voiceOff(env);
  env.P.play();
  await env.seconds(6, 1000 / 60, 6);
  const st = env.state();
  // 첫 프레임은 기준점만 잡으므로 6초 = 360프레임 중 359프레임분이 흐릅니다.
  assert.ok(Math.abs(st.t - 359 / 60) < 0.05, `t=${st.t} (6초 흘렀는데 시계가 느림: 옛 구현은 약 3.9초)`);
});

test('시계: 프레임 간격이 들쭉날쭉해도 한 프레임 0.25초까지만 따라가고 합계는 맞다', async () => {
  const env = createEnv();
  voiceOff(env);
  env.P.play();
  await env.frame(16);
  await env.frame(400); // 탭 전환 등으로 한 프레임이 길어진 경우: 0.25초로 제한
  assert.ok(env.state().t <= 0.25 + 0.02, `t=${env.state().t}`);
  await env.frame(16);
  assert.ok(env.state().t > 0.25, `t=${env.state().t}`);
});

test('시계: 속도 1.5배면 판서 시계도 1.5배로 흐른다', async () => {
  const env = createEnv();
  voiceOff(env);
  env.P.setSpeed(1.5);
  env.P.play();
  await env.seconds(4, 1000 / 60, 5);
  assert.ok(Math.abs(env.state().t - (239 / 60) * 1.5) < 0.1, `t=${env.state().t}`);
});

test('시계: 해설 음성이 기준이면 t 는 audio.currentTime 과 같고(두 번 세지 않음) playbackRate 는 속도와 같다', async () => {
  const env = createEnv();
  env.P.setSpeed(1.5);
  env.P.play();
  await env.flush();
  assert.equal(env.audio.paused, false, '재생 클릭으로 음성이 시작되어야 합니다');
  assert.equal(env.audio.playbackRate, 1.5);
  assert.equal(env.audio.defaultPlaybackRate, 1.5);
  await env.seconds(3, 1000 / 60, 6);
  const st = env.state();
  assert.ok(st.audioTime > 4, `audioTime=${st.audioTime} (3초 × 1.5배)`);
  assert.ok(Math.abs(st.t - st.audioTime) < 0.001, `t=${st.t} audioTime=${st.audioTime}`);
});

test('시계: audio.currentTime 이 앞서면 판서가 그 시각으로 따라간다', async () => {
  const env = createEnv();
  env.P.play();
  await env.seconds(0.5);
  env.audio.currentTime = 6;
  await env.frame();
  assert.ok(env.state().t >= 6, `t=${env.state().t}`);
  assert.ok(Math.abs(env.state().t - env.audio.currentTime) < 0.001, `getState().t 는 소수 셋째 자리로 반올림됩니다 (t=${env.state().t}, audio=${env.audio.currentTime})`);
});

test('시계: 속도를 바꾸면 이미 재생 중인 음성에도 바로 적용된다', async () => {
  const env = createEnv();
  env.P.play();
  await env.seconds(0.5);
  env.P.setSpeed(0.75);
  assert.equal(env.audio.playbackRate, 0.75);
  assert.equal(env.audio.defaultPlaybackRate, 0.75);
});

/* ---------------------------------------------------------------------
 * 2. 완료 = 판서 끝 && 음성 끝, 간격 0.9초, 자동 넘김
 * ------------------------------------------------------------------- */
test('완료: 판서가 끝나도 해설이 남아 있으면 완료가 아니고 "판서 중"이라고 하지 않는다', async () => {
  const env = createEnv();
  env.P.play();
  await env.flush();
  assert.match(env.status(), /판서 중/, '판서 중에는 판서 중');
  assert.ok(await env.until(() => env.state().drawDone, 40));
  await env.seconds(1);
  const st = env.state();
  assert.equal(st.drawDone, true);
  assert.equal(st.complete, false, '음성이 남았으므로 아직 완료가 아님');
  assert.equal(st.playing, true);
  assert.equal(st.hold, 0);
  assert.equal(st.holdEnd, GAP);
  assert.doesNotMatch(env.status(), /판서 중/, env.status());
  assert.match(env.status(), /해설/, env.status());
});

test('완료: 음성이 끝나면 0.9초 간격을 센 뒤 다음 단계로 넘어가 새 음성을 시작한다', async () => {
  const env = createEnv();
  env.P.play();
  await env.flush();
  assert.ok(await env.until(() => env.state().drawDone, 40));
  await env.finishVoice();
  assert.equal(env.state().voiceDone, true);
  assert.equal(env.state().complete, true);
  await env.seconds(0.5, 1000 / 60);
  const mid = env.state();
  assert.equal(mid.index, 0);
  assert.ok(mid.hold > 0.35 && mid.hold < 0.6, `hold=${mid.hold}`);
  assert.match(env.status(), /다음 단계/);
  assert.doesNotMatch(env.status(), /판서 중/);
  await env.seconds(0.6, 1000 / 60);
  const st = env.state();
  assert.equal(st.index, 1);
  assert.equal(st.playing, true);
  assert.ok(env.audio.src.endsWith(':' + IDS[1]), env.audio.src);
  assert.equal(env.audio.paused, false);
  assert.ok(env.audio.currentTime < 1.5, `새 단계 음성은 처음부터: ${env.audio.currentTime}`);
  assert.equal(st.hold, 0);
});

test('완료: 음성을 끄면 판서가 끝난 뒤 0.9초 만에 다음 단계 (옛 구현은 20~40초 대기)', async () => {
  const env = createEnv();
  voiceOff(env);
  env.P.play();
  assert.ok(await env.until(() => env.state().drawDone, 60));
  const st0 = env.state();
  assert.equal(st0.index, 0);
  assert.equal(st0.complete, true, '음성이 꺼져 있으면 판서가 끝나는 순간이 완료');
  await env.seconds(GAP + 0.3);
  assert.equal(env.state().index, 1, `status=${env.status()}`);
  assert.equal(env.state().playing, true);
});

test('완료: 간격 0.9초는 실제 시간이라 속도 1.5배여도 줄지 않는다', async () => {
  const env = createEnv();
  voiceOff(env);
  env.P.setSpeed(1.5);
  env.P.play();
  assert.ok(await env.until(() => env.state().drawDone, 60));
  await env.seconds(0.6);
  assert.equal(env.state().index, 0, `0.6초 뒤에는 아직 대기: hold=${env.state().hold}`);
  assert.ok(env.state().hold > 0.4 && env.state().hold < 0.7, `hold=${env.state().hold}`);
  await env.seconds(0.5);
  assert.equal(env.state().index, 1);
});

test('자동 넘김 끔: 완료에서 멈추고 완료 상태를 말하며, 다시 켜면 이어서 넘어간다', async () => {
  const env = createEnv();
  voiceOff(env);
  env.P.setAuto(false);
  env.P.play();
  assert.ok(await env.until(() => env.state().drawDone, 60));
  await env.seconds(2);
  let st = env.state();
  assert.equal(st.index, 0);
  assert.equal(st.playing, false, '자동 넘김이 꺼져 있으면 완료에서 멈춥니다');
  assert.equal(st.complete, true);
  assert.match(env.status(), /완료/);
  assert.match(env.status(), /자동 넘김/);
  assert.doesNotMatch(env.status(), /판서 중/);
  env.P.setAuto(true); // 옛 구현: 아무 일도 일어나지 않음
  assert.equal(env.state().playing, true, '자동 넘김을 켜면 완료된 단계에서 다시 진행');
  await env.seconds(GAP + 0.3);
  assert.equal(env.state().index, 1);
  assert.equal(env.state().playing, true);
});

test('자동 넘김 끔 → 켬: 음성이 있는 단계에서도 완료 상태에서 이어진다', async () => {
  const env = createEnv();
  env.P.setAuto(false);
  env.P.play();
  await env.flush();
  assert.ok(await env.until(() => env.state().drawDone, 40));
  await env.finishVoice();
  await env.seconds(1);
  assert.equal(env.state().playing, false);
  assert.equal(env.state().index, 0);
  assert.equal(env.state().complete, true);
  env.P.setAuto(true);
  await env.seconds(GAP + 0.3);
  assert.equal(env.state().index, 1);
  assert.equal(env.state().playing, true);
});

test('자동 넘김 끔 → 켬: 마지막 단계에서는 처음으로 돌아가지 않고 끝난 상태로 남는다', async () => {
  const env = createEnv();
  voiceOff(env);
  env.P.setAuto(false);
  env.P.goTo(LAST, { play: true });
  assert.ok(await env.until(() => env.state().drawDone, 60));
  await env.seconds(1);
  assert.equal(env.state().playing, false);
  env.P.setAuto(true);
  await env.seconds(2);
  const st = env.state();
  assert.equal(st.index, LAST);
  assert.equal(st.playing, false);
  assert.equal(st.ended, true);
  assert.match(env.status(), /마지막|끝/);
});

test('자동 넘김 켬: 마지막 단계가 끝나면 멈추고 끝났다고 알린다', async () => {
  const env = createEnv();
  voiceOff(env);
  env.P.goTo(LAST, { play: true });
  assert.ok(await env.until(() => env.state().ended, 60));
  assert.equal(env.state().playing, false);
  assert.equal(env.state().index, LAST);
  assert.match(env.status(), /마지막|끝/);
  // 재생 버튼은 처음부터 다시
  env.P.play();
  assert.equal(env.state().index, 0);
  assert.equal(env.state().playing, true);
  assert.equal(env.state().ended, false);
});

test('상태 문구: 재생 내내 비어 있지 않고, "판서 중"은 판서하는 동안에만 나온다', async () => {
  const env = createEnv();
  voiceOff(env);
  env.P.play();
  const seen = new Set();
  for (let i = 0; i < 2400 && env.state().index === 0; i++) {
    await env.frame(1000 / 20);
    const s = env.status();
    assert.ok(s.length > 0, '상태 문구가 비어 있음');
    seen.add(s);
    if (/판서 중/.test(s)) assert.equal(env.state().drawDone, false, `판서가 끝났는데 "${s}"`);
    if (env.state().drawDone && env.state().index === 0) assert.doesNotMatch(s, /판서 중/);
  }
  assert.ok(seen.size >= 2, [...seen].join(' | '));
});

/* ---------------------------------------------------------------------
 * 3. 음성: 사용자 동작, 오류, 수동 이동, 수명주기
 * ------------------------------------------------------------------- */
test('음성: 브라우저가 재생을 막으면(NotAllowedError) 멈추고 안내하며, 다시 누르면 처음부터 재생한다', async () => {
  const env = createEnv({ playReject: 'NotAllowedError' });
  env.P.play();
  await env.flush();
  const st = env.state();
  assert.equal(st.playing, false, '막혔는데 재생 중인 척하면 안 됨');
  assert.notEqual(st.voiceMode, 'error', '허용 문제는 오류가 아니라 안내');
  const note = env.el('voice-note');
  assert.match(note.textContent, /재생 버튼/);
  assert.match(note.className, /is-info/);
  assert.match(env.status(), /막|일시정지|눌러/);
  // 사용자가 다시 누르면(허용됨) 처음부터
  env.audio.play = function play() { this.paused = false; this.playCalls += 1; return Promise.resolve(); };
  env.P.play();
  await env.flush();
  assert.equal(env.state().playing, true);
  assert.equal(env.audio.paused, false);
  assert.equal(note.textContent, '', '안내가 지워져야 함');
});

test('음성: 자동 넘김 중 다음 단계 재생이 막혀도(NotAllowedError) 단계는 넘어가되 멈추고 안내한다', async () => {
  const env = createEnv();
  env.P.play();
  await env.flush();
  assert.ok(await env.until(() => env.state().drawDone, 40));
  await env.finishVoice();
  env.audio.play = function play() { return Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' })); };
  await env.seconds(GAP + 0.3);
  const st = env.state();
  assert.equal(st.index, 1);
  assert.equal(st.playing, false);
  assert.match(env.el('voice-note').textContent, /재생 버튼/);
});

test('음성: 재생이 실패하면(NotSupportedError) 화면에 오류를 보이고 판서는 자체 시계로 계속한다 (합성 음성으로 대체하지 않음)', async () => {
  const env = createEnv({ playReject: 'NotSupportedError' });
  env.P.play();
  await env.flush();
  const st = env.state();
  assert.equal(st.voiceMode, 'error');
  assert.ok(st.voiceError.length > 0);
  const note = env.el('voice-note');
  assert.match(note.className, /is-error/);
  assert.match(note.textContent, /오류|재생하지 못/);
  assert.match(env.status(), /오류|음성/);
  await env.seconds(2);
  assert.ok(env.state().t > 1.5, `판서는 계속: t=${env.state().t}`);
  assert.equal(env.state().playing, true);
  assert.equal(env.counters.speech, 0);
  assert.equal(env.counters.createOscillator, 0);
  assert.equal(env.counters.createBuffer, 0);
});

test('음성: 재생은 시작됐는데 시계가 멈춰 있으면 조용히 멈춰 서지 않고 오류를 보이고 계속한다', async () => {
  const env = createEnv({ stall: true });
  env.P.play();
  await env.seconds(8, 1000 / 20);
  const st = env.state();
  assert.equal(st.voiceMode, 'error', JSON.stringify({ mode: st.voiceMode, t: st.t, status: env.status() }));
  assert.match(env.el('voice-note').className, /is-error/);
  assert.ok(st.t > 3, `자체 시계로 계속: t=${st.t}`);
});

test('수동 이동: 다음/이전/단계 선택/다시/처음부터는 이전 음성과 분필을 즉시 멈추고 새 단계를 처음부터 시작한다', async () => {
  const env = createEnv();
  env.P.play();
  await env.flush();
  await env.seconds(3);
  assert.ok(env.audio.currentTime > 2);
  for (const [name, fn, expectIndex, expectId] of [
    ['next', () => env.P.next(), 1, IDS[1]],
    ['goTo(5)', () => env.P.goTo(5), 5, IDS[5]],
    ['prev', () => env.P.prev(), 4, IDS[4]],
    ['replay', () => env.P.replay(), 4, IDS[4]],
    ['restart', () => env.P.restart(), 0, IDS[0]],
  ]) {
    await env.seconds(1.5);
    const before = env.audio.pauseCalls;
    fn();
    await env.flush();
    const st = env.state();
    assert.equal(st.index, expectIndex, name);
    assert.equal(st.playing, true, name + ': 재생 중이면 계속 재생');
    assert.ok(env.audio.src.endsWith(':' + expectId), `${name}: ${env.audio.src}`);
    assert.ok(env.audio.currentTime < 0.5, `${name}: 새 음성은 처음부터 ${env.audio.currentTime}`);
    assert.ok(env.audio.pauseCalls > before, `${name}: 이전 음성을 멈춤`);
    assert.equal(st.hold, 0, name);
  }
});

test('수동 이동: 멈춘 채 이동하면 음성 없이 완성된 칠판을 보여 주고, 지난 단계의 늦은 ended 이벤트는 무시한다', async () => {
  const env = createEnv();
  env.P.play();
  await env.flush();
  await env.seconds(2);
  env.P.pause();
  env.P.goTo(3);
  await env.flush();
  let st = env.state();
  assert.equal(st.index, 3);
  assert.equal(st.playing, false);
  assert.equal(st.drawDone, true, '멈춘 채 이동하면 완성된 칠판');
  assert.equal(st.complete, false, '해설은 아직 듣지 않았으므로 완료가 아님');
  assert.equal(env.audio.paused, true);
  env.audio.emit('ended'); // 이전 단계에서 늦게 도착한 이벤트
  assert.equal(env.state().voiceDone, false);
  assert.equal(env.state().complete, false);
  // 재생을 누르면 이 단계의 해설을 처음부터(다음 단계로 건너뛰지 않음)
  env.P.play();
  await env.flush();
  st = env.state();
  assert.equal(st.index, 3);
  assert.equal(st.playing, true);
  assert.ok(env.audio.src.endsWith(':' + IDS[3]));
  assert.equal(env.audio.paused, false);
  assert.ok(st.t < 1, `해설과 판서를 맞추려고 처음부터: t=${st.t}`);
});

/* 수동 이동 경합: <audio> 요소 하나를 단계마다 재사용하므로, 이전 클립에서 늦게 도착한 ended 가
 * 새 클립이 시작된 뒤 전달되면 새 단계가 "해설을 다 들었다"고 오판할 수 있다. */
test('수동 이동 경합: 새 클립이 재생 중일 때 도착한 이전 클립의 ended 는 무시한다 (완료·자동 넘김 오판 없음)', async () => {
  const env = createEnv();
  env.P.play();
  await env.flush();
  await env.seconds(2);
  env.P.next();
  await env.flush();
  await env.seconds(1.5);
  let st = env.state();
  assert.equal(st.index, 1);
  assert.equal(st.playing, true);
  assert.equal(st.voiceDone, false);
  assert.ok(env.audio.src.endsWith(':' + IDS[1]));
  const at = env.audio.currentTime;
  assert.ok(at > 1 && !env.audio.ended, `새 클립은 재생 중: ${at}`);

  env.audio.emit('ended'); // 1단계 클립에서 늦게 도착한 이벤트(요소는 이미 2단계 클립을 재생 중)

  st = env.state();
  assert.equal(st.voiceDone, false, '늦은 ended 가 새 단계를 완료로 만들면 안 됨');
  assert.equal(st.complete, false);
  assert.equal(st.playing, true);
  assert.equal(st.progress < 1, true, `진행률이 1 로 뛰면 안 됨: ${st.progress}`);
  assert.doesNotMatch(env.status(), /완료/);
  // 0.9초 간격 + 여유보다 오래 기다려도 해설이 남아 있는 한 다음 단계로 넘어가지 않는다
  await env.seconds(2.5);
  st = env.state();
  assert.equal(st.index, 1, '2단계 해설을 듣는 중에 3단계로 건너뛰면 안 됨');
  assert.equal(st.voiceDone, false);
  assert.ok(env.audio.currentTime > at + 2, '2단계 해설은 끊김 없이 계속');
  // 진짜 ended 는 정상 처리: 완료 → 0.9초 뒤 3단계
  await env.finishVoice();
  assert.equal(env.state().index, 1);
  assert.equal(env.state().voiceDone, true);
  assert.ok(await env.until(() => env.state().index === 2, 5));
  assert.ok(env.audio.src.endsWith(':' + IDS[2]));
});

test('수동 이동 경합: 1단계 해설이 막 끝나 pause·ended 가 큐에 있을 때 다음을 눌러도 2단계 재생·판서가 유지된다', async () => {
  const env = createEnv();
  env.P.play();
  await env.flush();
  await env.seconds(2);
  const old = env.audio;
  old.currentTime = old.duration - 0.01;
  old.advance(0.05); // 끝에 닿음 → pause·ended 이벤트가 큐에 올라가지만 아직 전달되지 않음
  assert.equal(old.ended, true);
  env.P.next(); // 이벤트가 전달되기 전에 사용자가 다음 단계로 이동 (같은 요소가 2단계 클립을 재생)
  await env.flush(); // 이제 1단계의 늦은 pause·ended 가 전달됨
  let st = env.state();
  assert.equal(st.index, 1);
  assert.equal(st.playing, true, '늦은 pause 가 새 단계 재생을 멈추면 안 됨');
  assert.equal(st.voiceDone, false, '늦은 ended 가 새 단계를 완료로 만들면 안 됨');
  assert.equal(env.audio.paused, false);
  await env.seconds(3);
  st = env.state();
  assert.equal(st.index, 1);
  assert.equal(st.playing, true);
  assert.ok(st.audioTime > 2.5, `2단계 해설이 계속 흐름: ${st.audioTime}`);
  assert.ok(st.t > 2.5, `판서도 계속: t=${st.t}`);
});

test('수동 이동 경합: 같은 단계를 다시 재생(replay)해도 이전 재생에서 늦게 온 ended 는 무시한다', async () => {
  const env = createEnv();
  env.P.play();
  await env.flush();
  await env.seconds(2);
  const a = env.audio;
  a.currentTime = a.duration - 0.01;
  a.advance(0.05);
  env.P.replay(); // src 는 그대로(새 로드 없음)라 브라우저도 이전 ended 를 취소하지 않는다
  await env.flush();
  const st = env.state();
  assert.equal(st.index, 0);
  assert.equal(st.playing, true);
  assert.equal(st.voiceDone, false, '이전 재생의 ended 가 다시 시작한 해설을 완료로 만들면 안 됨');
  assert.ok(a.currentTime < 1 && !a.ended);
  await env.seconds(2);
  assert.equal(env.state().index, 0);
  assert.equal(env.state().voiceDone, false);
  assert.equal(env.state().playing, true);
});

test('수명주기: 일시정지·탭 숨김·pagehide 는 음성과 분필을 모두 무음으로 만든다', async () => {
  const env = createEnv();
  env.P.play();
  await env.flush();
  await env.seconds(4);
  // 일시정지
  env.P.pause();
  await env.flush();
  assert.equal(env.audio.paused, true);
  assert.equal(env.activeChalk(), 0);
  assert.equal(env.state().playing, false);
  // 이어서 재생: 같은 위치에서
  const resumedAt = env.audio.currentTime;
  env.P.play();
  await env.flush();
  assert.equal(env.audio.paused, false);
  assert.ok(Math.abs(env.audio.currentTime - resumedAt) < 0.05, '이어서 재생은 같은 위치');
  // 탭 숨김
  await env.seconds(0.5);
  env.setHidden(true);
  await env.flush();
  assert.equal(env.state().playing, false);
  assert.equal(env.audio.paused, true);
  assert.equal(env.activeChalk(), 0);
  assert.match(env.status(), /가려|숨|일시정지/);
  env.setHidden(false);
  // pagehide
  env.P.play();
  await env.flush();
  await env.seconds(0.5);
  env.fireWin('pagehide');
  await env.flush();
  assert.equal(env.audio.paused, true);
  assert.equal(env.activeChalk(), 0);
  assert.equal(env.state().playing, false, 'bfcache 로 돌아와도 멈춘 채여야 함(소리만 멈추고 재생 중인 상태로 남으면 안 됨)');
});

test('음성 토글: 끄면 음성을 멈추고 자체 시계로 이어가며, 켜면 판서와 맞추려고 이 단계를 처음부터 다시 시작한다', async () => {
  const env = createEnv();
  env.P.play();
  await env.flush();
  await env.seconds(3);
  env.click('voice-toggle');
  await env.flush();
  assert.equal(env.state().voiceEnabled, false);
  assert.equal(env.el('voice-toggle').getAttribute('aria-pressed'), 'false');
  assert.equal(env.audio.paused, true);
  const t1 = env.state().t;
  await env.seconds(1);
  assert.ok(env.state().t > t1 + 0.8, '음성을 꺼도 판서는 계속');
  env.click('voice-toggle');
  await env.flush();
  assert.equal(env.state().voiceEnabled, true);
  assert.equal(env.el('voice-toggle').getAttribute('aria-pressed'), 'true');
  assert.equal(env.audio.paused, false);
  assert.ok(env.state().t < 0.5, `다시 맞추려고 처음부터: t=${env.state().t}`);
});

/* ---------------------------------------------------------------------
 * 4. 분필 소리: 실제 녹음만, 펜이 닿아 있을 때만
 * ------------------------------------------------------------------- */
test('분필: 처음 켜면 슬라이더 25%, 출력 25%이고 합성 소리는 만들지 않는다', async () => {
  const env = createEnv();
  assert.equal(env.el('chalk-volume').value, '25');
  assert.equal(env.el('chalk-volume-value').value, '25%');
  assert.equal(env.state().chalkVolume, 25);
  assert.equal(env.state().chalkEnabled, true);
  assert.equal(env.state().voiceEnabled, true);
  env.P.play();
  await env.seconds(6);
  assert.ok(env.state().chalkReady, '내장 녹음을 풀었어야 함');
  assert.equal(env.counters.createBuffer, 0);
  assert.equal(env.counters.createOscillator, 0);
  assert.ok(env.actx.sources.length > 0, '판서 중에 분필 조각이 울려야 함');
  for (const s of env.actx.sources) assert.equal(s.buffer, env.decoded, '녹음된 버퍼만 재생');
});

test('분필: 펜이 닿은 동안에만 소리가 나고(접촉 동기화) 닿지 않으면 무음이다', async () => {
  const env = createEnv();
  voiceOff(env);
  env.P.play();
  await env.flush();
  let contactFrames = 0;
  let liftedFrames = 0;
  let mismatched = 0;
  for (let i = 0; i < 6 * 60; i++) {
    await env.frame();
    const st = env.state();
    if (!st.chalkReady) continue;
    const sounding = env.activeChalk(0.01) > 0;
    if (st.penDown) contactFrames += 1; else liftedFrames += 1;
    if (st.penDown !== sounding) mismatched += 1;
  }
  assert.ok(contactFrames > 100, `접촉 프레임 ${contactFrames}`);
  assert.ok(liftedFrames > 0, '획 사이에는 떼어야 함');
  assert.equal(mismatched, 0, '펜 접촉과 소리가 어긋난 프레임');
  const ids = env.actx.sources.length;
  assert.ok(ids >= 8, `획마다 따로 울린 조각 ${ids}개`);
  assert.ok(new Set(env.actx.sources.map((s) => Math.round(s.offset * 1000))).size >= 5, '조각마다 녹음의 다른 부분');
  for (const s of env.actx.sources) assert.ok(s.offset >= 0 && s.offset < env.decoded.duration - 4 + 1e-6, `offset ${s.offset}`);
});

test('분필: 판서가 끝나면(펜 뗌) 무음이고, 일시정지·소리 끔·음량 0 도 무음이다', async () => {
  const env = createEnv();
  voiceOff(env);
  env.P.play();
  await env.flush();
  await env.seconds(2);
  env.P.pause();
  assert.equal(env.activeChalk(), 0, '일시정지');
  env.P.play();
  await env.seconds(1);
  env.click('chalk-toggle');
  assert.equal(env.state().chalkEnabled, false);
  assert.equal(env.el('chalk-toggle').getAttribute('aria-pressed'), 'false');
  assert.equal(env.activeChalk(), 0, '분필 소리 끔');
  const n = env.actx.sources.length;
  await env.seconds(2);
  assert.equal(env.actx.sources.length, n, '끈 동안 새 조각 없음');
  env.click('chalk-toggle');
  env.el('chalk-volume').value = '0';
  env.el('chalk-volume').dispatch('input');
  assert.equal(env.el('chalk-volume-value').value, '0%');
  const n2 = env.actx.sources.length;
  await env.seconds(2);
  assert.equal(env.actx.sources.length, n2, '음량 0 에서는 새 조각 없음');
  assert.equal(env.activeChalk(), 0);
  env.el('chalk-volume').value = '25';
  env.el('chalk-volume').dispatch('input');
  assert.equal(env.el('chalk-volume-value').value, '25%');
  assert.equal(env.state().chalkVolume, 25);
});

test('분필: 줄어든 동작에서는 판서가 없으므로 분필 소리도 없다', async () => {
  const env = createEnv({ reduced: true });
  env.P.play();
  await env.seconds(3);
  assert.equal(env.actx ? env.actx.sources.length : 0, 0);
  assert.equal(env.state().penDown, false);
});

test('분필: 내장 녹음을 풀지 못하면 화면에 오류를 보이고(합성 대체 없음) 강의는 계속된다', async () => {
  const env = createEnv({ decodeFails: true });
  env.P.play();
  await env.seconds(3);
  const note = env.el('chalk-note');
  assert.match(note.className, /is-error/);
  assert.match(note.textContent, /분필/);
  assert.ok(env.state().chalkError.length > 0);
  assert.equal(env.state().playing, true);
  assert.ok(env.state().t > 2, `강의는 계속: t=${env.state().t}`);
  assert.equal(env.actx.sources.length, 0);
  assert.equal(env.counters.createBuffer + env.counters.createOscillator, 0);
});

test('분필: AudioContext 가 계속 suspended 이면 소리 없이 지나가지 않고 안내하며, 다시 누를 때 resume 을 재시도한다', async () => {
  const env = createEnv({ ctxState: 'blocked' });
  env.P.play();
  await env.seconds(4);
  const note = env.el('chalk-note');
  assert.match(note.textContent, /분필/);
  assert.match(note.className, /is-info|is-error/);
  const before = env.actx.resumeCalls;
  env.P.pause();
  env.P.play();
  assert.ok(env.actx.resumeCalls > before, '재생을 누를 때마다 resume 재시도');
});

test('분필: 한 번 울리는 조각은 녹음의 남은 길이(4초)를 넘기기 전에 다음 조각으로 넘어간다 (느린 속도의 긴 획)', async () => {
  const env = createEnv();
  voiceOff(env);
  env.P.setSpeed(0.75);
  env.P.play();
  await env.seconds(20, 1000 / 30);
  for (const s of env.actx.sources) {
    if (s.startedAt === null) continue;
    const stop = s.stoppedAt === null ? Infinity : s.stoppedAt;
    assert.ok(stop - s.startedAt <= 4.01 || env.actx.currentTime - s.startedAt <= 4.01, `조각 길이 ${stop - s.startedAt}`);
  }
});

/* ---------------------------------------------------------------------
 * 5. 줄어든 동작: 완성된 칠판 + 해설은 그대로
 * ------------------------------------------------------------------- */
test('줄어든 동작: 시작부터 완성된 칠판이고, 재생하면 칠판은 그대로 둔 채 해설이 나온다', async () => {
  const env = createEnv({ reduced: true });
  const st0 = env.state();
  assert.equal(st0.reduced, true);
  assert.equal(st0.drawDone, true);
  assert.equal(st0.t, st0.animEnd);
  env.P.play();
  await env.flush();
  const st = env.state();
  assert.equal(st.playing, true);
  assert.equal(st.index, 0, '재생은 단계를 건너뛰지 않음');
  assert.equal(env.audio.paused, false);
  assert.equal(env.audio.src.endsWith(':' + IDS[0]), true);
  await env.seconds(2);
  assert.equal(env.state().t, env.state().animEnd, '칠판은 계속 완성 상태');
  assert.equal(env.state().penDown, false);
  assert.doesNotMatch(env.status(), /판서 중/);
  assert.match(env.status(), /해설/);
});

test('줄어든 동작: 자동 넘김이 켜져 있으면 해설이 끝나고 0.9초 뒤 다음 단계 해설로 이어진다', async () => {
  const env = createEnv({ reduced: true });
  env.P.play();
  await env.flush();
  await env.finishVoice();
  assert.equal(env.state().complete, true);
  assert.match(env.status(), /다음 단계/);
  await env.seconds(GAP + 0.3);
  const st = env.state();
  assert.equal(st.index, 1);
  assert.equal(st.playing, true);
  assert.equal(st.t, st.animEnd);
  assert.ok(env.audio.src.endsWith(':' + IDS[1]));
  assert.equal(env.audio.paused, false);
});

test('줄어든 동작: 자동 넘김이 꺼져 있으면 해설이 끝난 뒤 멈추고, 자동 넘김을 켜면 이어진다', async () => {
  const env = createEnv({ reduced: true });
  env.P.setAuto(false);
  env.P.play();
  await env.flush();
  await env.finishVoice();
  await env.seconds(2);
  assert.equal(env.state().index, 0);
  assert.equal(env.state().playing, false);
  assert.match(env.status(), /완료|끝/);
  env.P.setAuto(true);
  await env.seconds(GAP + 0.3);
  assert.equal(env.state().index, 1);
  assert.equal(env.state().playing, true);
});

test('줄어든 동작 + 해설 음성 끔: 타이머 없이 수동으로만 넘기며, 자동 넘김 버튼은 쓸 수 없다고 정확히 표시한다', async () => {
  const env = createEnv({ reduced: true });
  voiceOff(env);
  assert.equal(env.state().voiceEnabled, false);
  const auto = env.el('auto-toggle');
  assert.equal(auto.getAttribute('aria-disabled'), 'true');
  assert.match(env.el('reduced-note').textContent, /자동 넘김/);
  assert.equal(env.el('reduced-note').hidden, false);
  assert.equal(env.state().autoAvailable, false);
  assert.match(env.el('play-label').textContent, /다음 단계 보기/);
  env.P.play();
  assert.equal(env.state().index, 1, '재생 = 다음 단계 보기');
  assert.equal(env.state().playing, false);
  assert.equal(env.raf.size, 0, '타이머(rAF) 없음');
  await env.seconds(5);
  assert.equal(env.state().index, 1, '저절로 넘어가지 않음');
  env.click('auto-toggle'); // 눌러도 아무 일 없음
  assert.equal(env.state().index, 1);
  // 해설을 다시 켜면 자동 넘김도 다시 쓸 수 있다
  env.P.setVoiceEnabled(true);
  assert.equal(env.state().autoAvailable, true);
  assert.notEqual(auto.getAttribute('aria-disabled'), 'true');
});

test('줄어든 동작: 재생 중에 설정이 바뀌어도 음성이 처음부터 다시 시작되지 않는다', async () => {
  const env = createEnv();
  env.P.play();
  await env.flush();
  await env.seconds(5);
  const playsBefore = env.audio.playCalls;
  const at = env.audio.currentTime;
  env.setReduced(true);
  await env.flush();
  const st = env.state();
  assert.equal(st.reduced, true);
  assert.equal(st.playing, true, '해설은 계속');
  assert.equal(st.t, st.animEnd, '칠판은 완성 상태로');
  assert.equal(env.audio.playCalls, playsBefore, 'play() 를 다시 부르지 않음');
  assert.ok(env.audio.currentTime >= at);
  assert.equal(env.activeChalk(), 0);
  await env.seconds(1);
  assert.equal(env.audio.paused, false);
});

/* ---------------------------------------------------------------------
 * 6. 공개 API 계약
 * ------------------------------------------------------------------- */
test('API: getState 와 메서드에 해설·분필·시계 상태가 노출된다', async () => {
  const env = createEnv();
  const st = env.state();
  for (const key of ['ready', 'index', 'count', 'id', 'kind', 'playing', 'started', 'reduced', 'auto', 'autoAvailable', 'speed', 't', 'animEnd',
    'complete', 'drawDone', 'drawing', 'ended', 'hold', 'holdEnd', 'voiceEnabled', 'chalkEnabled', 'voiceMode', 'voiceDone', 'voiceError',
    'audioTime', 'audioDuration', 'penDown', 'writingCharacter', 'chalkVolume', 'chalkReady', 'chalkError', 'progress', 'warnings']) {
    assert.ok(key in st, `getState().${key}`);
  }
  for (const m of ['setVoiceEnabled', 'setChalkEnabled', 'setChalkVolume', 'setAuto', 'setSpeed', 'goTo', 'play', 'pause', 'toggle', 'next', 'prev', 'replay', 'restart', 'seek', 'layoutReport']) {
    assert.equal(typeof env.P[m], 'function', m);
  }
  assert.equal(st.voiceEnabled, true);
  assert.equal(st.chalkEnabled, true);
  assert.equal(st.holdEnd, GAP);
  assert.equal(st.audioDuration, DURATIONS[IDS[0]]);
  env.P.setChalkVolume(60);
  assert.equal(env.state().chalkVolume, 60);
  assert.equal(env.el('chalk-volume').value, '60');
  assert.equal(env.el('chalk-volume-value').value, '60%');
  env.P.setChalkVolume(25);
});

test('API: seek 는 소리를 모두 멈추고 지정한 시각의 정지 화면을 만든다', async () => {
  const env = createEnv();
  env.P.play();
  await env.flush();
  await env.seconds(2);
  env.P.seek(2, 3);
  await env.flush();
  const st = env.state();
  assert.equal(st.index, 2);
  assert.equal(st.playing, false);
  assert.equal(st.t, 3);
  assert.equal(env.audio.paused, true);
  assert.equal(env.activeChalk(), 0);
});

test('API: 옛 시험 유틸 getState().complete 는 판서 끝 && 음성 끝이다 (음성 끔이면 판서 끝)', async () => {
  const env = createEnv();
  voiceOff(env);
  env.P.seek(0, 'end');
  assert.equal(env.state().complete, true);
  env.P.setVoiceEnabled(true);
  env.P.seek(0, 'end');
  assert.equal(env.state().complete, false, '해설을 아직 듣지 않음');
  assert.ok(env.state().animEnd > 5);
});

/* ---------------------------------------------------------------------
 * 7. 양자물리학 판: 보드 종류(graph·flow·bars·chalk), 태그 말머리, 글꼴 대체, 선택지
 * ------------------------------------------------------------------- */
test('보드 종류: 시험용 강의의 graph·graph(equalAspect)·flow·bars·chalk 가 모두 그려지고 배치 경고가 없다', async () => {
  const env = createEnv({ scene: FIXTURE });
  assert.deepEqual([...env.P.steps], FIXTURE.steps.map((s) => s.id));
  assert.equal(env.state().count, FIXTURE.steps.length);
  const rep = env.P.layoutReport();
  assert.equal(rep.warnings.length, 0, JSON.stringify(rep.warnings));
  const kinds = FIXTURE.steps.map((s) => s.board.kind);
  assert.deepEqual(Array.from(rep.steps, (s) => s.kind), kinds);
  assert.deepEqual([...new Set(kinds)].sort(), ['bars', 'chalk', 'flow', 'graph']);
  FIXTURE.steps.forEach((s, i) => {
    env.P.seek(i, 'end');
    const st = env.state();
    assert.equal(st.kind, s.board.kind);
    assert.equal(st.index, i);
    assert.equal(st.drawDone, true);
    assert.equal(st.plot === null, s.board.kind !== 'graph', `${s.id}: plot 은 graph 에만`);
    if (s.board.kind === 'graph') {
      assert.ok(st.plot.xPxPerUnit > 0 && st.plot.yPxPerUnit > 0, s.id);
      if (s.board.equalAspect) assert.ok(Math.abs(st.plot.xPxPerUnit - st.plot.yPxPerUnit) < 1e-6, `${s.id}: equalAspect 는 가로세로 배율이 같다`);
      else assert.ok(Math.abs(st.plot.xPxPerUnit - st.plot.yPxPerUnit) > 1, `${s.id}: 비등비`);
    }
  });
});

test('보드 종류: 실제 강의 14단계에 배치 경고가 없고 graph 단계마다 배율이 계산된다', async () => {
  const env = createEnv();
  const rep = env.P.layoutReport();
  assert.equal(rep.warnings.length, 0, JSON.stringify(rep.warnings));
  assert.equal(rep.steps.length, SCENE.steps.length);
  for (const s of rep.steps) assert.ok(s.animEnd > 5 && s.holdEnd >= s.animEnd, `${s.id}: animEnd=${s.animEnd}`);
  const graphs = rep.steps.filter((s) => s.kind === 'graph');
  assert.ok(graphs.length >= 6, `graph 단계 ${graphs.length}개`);
  for (const g of graphs) assert.ok(g.plot && g.plot.x > 0 && g.plot.y > 0, g.id);
});

test('태그: 개념·실험·유도·응용·열린 문제 말머리가 구분되어 표시된다', async () => {
  const labels = { concept: '개념', experiment: '실험', math: '유도', apply: '응용', open: '열린 문제' };
  const env = createEnv();
  const seen = new Set();
  SCENE.steps.forEach((s, i) => {
    env.P.goTo(i);
    assert.equal(env.el('board-tag').textContent, labels[s.tag.tone], `${s.id}: ${s.tag.tone}`);
    assert.equal(env.el('board-tag').dataset.tone, s.tag.tone);
    assert.equal(env.el('board-tag-text').textContent, s.tag.text);
    seen.add(s.tag.tone);
  });
  assert.ok(seen.size >= 3, `강의에서 쓰인 말머리: ${[...seen].join(', ')}`);
});

test('글꼴: 캔버스 글꼴 지정은 NanumPenScript 다음에 QMath(그리스·수학 기호)로 대체된다', async () => {
  const env = createEnv({ scene: FIXTURE });
  env.P.seek(0, 'end');
  const font = String(env.win.document.getElementById('board').getContext().font);
  assert.match(font, /NanumPenScript/);
  assert.match(font, /QMath/);
  assert.ok(font.indexOf('NanumPenScript') < font.indexOf('QMath'), font);
});

test('내용 오류: 실행 중 데이터에 알 수 없는 보드 종류가 있으면 화면에 오류를 보이고 던지지 않는다', async () => {
  const bad = JSON.parse(JSON.stringify(FIXTURE));
  bad.steps[0].board.kind = 'plane';
  const env = createEnv({ scene: bad });
  assert.equal(env.P, undefined, '해석하지 못한 강의는 플레이어를 노출하지 않는다');
  assert.equal(env.el('fatal').hidden, false);
  assert.match(env.el('fatal').textContent, /알 수 없는 보드 종류/);
});

test('내용 오류: 알 수 없는 요소 종류도 같은 방식으로 알린다', async () => {
  const bad = JSON.parse(JSON.stringify(FIXTURE));
  bad.steps[0].board.elements.push({ type: 'point3d', x: 1, y: 1, color: 'mint', at: 1 });
  const env = createEnv({ scene: bad });
  assert.equal(env.P, undefined);
  assert.match(env.el('fatal').textContent, /알 수 없는 요소 종류/);
});
