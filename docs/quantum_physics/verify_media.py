#!/usr/bin/env python3
"""해설 음성·분필 소리·줄어든 동작·재생 실패를 실제 오프라인 Chrome 에서 검증합니다.

내장된 MP3(해설 클립 + CC0 분필)를 실제로 재생해서 다음을 확인합니다.
  * 재생이 막히면(NotAllowedError, 브라우저의 거절을 그대로 흉내) 멈추고 안내하며, 버튼을 누르면 재생된다
  * 해설이 재생되는 동안 판서 시계 t 는 audio.currentTime 과 같다(속도 1.5배의 playbackRate 포함)
  * 판서가 끝나도 해설이 남아 있으면 완료가 아니고, 해설이 끝나면 실제 0.9초 뒤에 다음 단계 해설이 시작된다
  * 일시정지·분필 끄기·탭 숨김·pagehide·수동 이동은 이전 소리를 즉시 멈춘다
  * 해설 파일이 깨지면 화면에 오류가 보이고 판서는 자체 시계로 계속된다(합성 음성 없음)
  * 줄어든 동작: 완성된 칠판을 보여 주며 해설만 재생하고, 해설 후 자동으로 넘어가며,
    해설을 끄면 자동 넘김 버튼을 정확히 비활성으로 표시한다

해설 MP3 가 들어 있는 HTML 이 필요합니다.
  * 실제 배포본:  node build.mjs 로 만든 quantum-physics.html  (narrate.py 로 해설을 만든 뒤)
  * 해설 합성 전:  기본값으로 실제 내용(content/)에 가짜 클립을 넣은 시험 빌드를 만들어 검증합니다 (--fixture 는 시험 내용).
    가짜 클립은 분필 녹음을 이어 붙인 것이라 소리 경로·시계·0.9초 간격을 똑같이 시험할 수 있습니다.

사용법:  python3 verify_media.py --artifacts <폴더>   (저장소 밖 폴더 필수, /tmp 권장)
"""
from __future__ import annotations

import argparse
import json
import sys

from playwright.sync_api import sync_playwright

from verify_common import add_common_args, launch, player, prepare

INSTRUMENT_AUDIO = """
(() => {
  window.__audioTaps = [];
  window.__lessonAudio = [];
  // 자동화(Playwright)의 evaluate 는 사용자 동작으로 취급되어 브라우저가 재생을 막지 않으므로,
  // 브라우저가 줄 거절(NotAllowedError)을 그대로 흉내 내서 "막힌 재생"을 시험합니다.
  window.__blockPlay = 0;
  const nativePlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function(...args) {
    if (window.__blockPlay > 0) {
      window.__blockPlay -= 1;
      return Promise.reject(new DOMException("play() failed because the user didn't interact with the document first.", 'NotAllowedError'));
    }
    return nativePlay.apply(this, args);
  };
  const NativeAudio = window.Audio;
  window.Audio = class extends NativeAudio {
    constructor(...args) { super(...args); window.__lessonAudio.push(this); }
  };
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function(destination, ...args) {
    if (destination instanceof AudioDestinationNode) {
      const analyser = this.context.createAnalyser();
      analyser.fftSize = 2048;
      window.__audioTaps.push(analyser);
      connect.call(analyser, destination);
      return connect.call(this, analyser, ...args);
    }
    return connect.call(this, destination, ...args);
  };
  window.__soundEnergy = () => window.__audioTaps.reduce((sum, analyser) => {
    const samples = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(samples);
    return sum + samples.reduce((energy, x) => energy + x*x, 0) / samples.length;
  }, 0);
})();
"""

checks: list[dict] = []


def check(name: str, ok: bool, detail: str = "") -> bool:
    checks.append({"name": name, "ok": bool(ok), "detail": detail})
    print(("  PASS " if ok else "  FAIL ") + name + (f"  [{detail}]" if detail and not ok else ""))
    return bool(ok)


def st(page) -> dict:
    return page.evaluate(player("() => window.quantumPlayer.getState()"))


def ready(page) -> None:
    page.wait_for_function(player("() => Boolean(window.quantumPlayer && window.quantumPlayer.getState().ready)"))


def energy(page) -> float:
    return page.evaluate("() => window.__soundEnergy()")


def voice_paused(page) -> bool:
    return page.evaluate("() => window.__lessonAudio.every((a) => a.paused)")


def js(page, script: str, arg=None):
    return page.evaluate(player(script), arg)


def wait(page, script: str, arg=None, timeout: int = 8000) -> None:
    page.wait_for_function(player(script), arg=arg, timeout=timeout)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    add_common_args(ap)
    args = ap.parse_args()
    if not args.artifacts:
        print("--artifacts 폴더가 필요합니다(저장소 밖, /tmp 권장).")
        return 2
    prep = prepare(args, "qp-media-")
    if prep is None:
        return 2
    art, html, expect = prep
    url = html.as_uri()
    print("검증 대상:", url)

    def new_page(browser, **kwargs):
        ctx = browser.new_context(offline=True, viewport={"width": 1440, "height": 1100}, locale="ko-KR", **kwargs)
        ctx.add_init_script(INSTRUMENT_AUDIO)
        page = ctx.new_page()
        errors: list[str] = []
        requests: list[str] = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("request", lambda r: requests.append(r.url) if not r.url.startswith(("file:", "data:", "blob:", "about:")) else None)
        page.goto(url)
        ready(page)
        page.evaluate("() => document.fonts.ready")
        return ctx, page, errors, requests

    metrics: dict = {}
    with sync_playwright() as pw:
        browser = launch(pw)
        try:
            # ------------------------------------------------------------------
            print("\n== 해설 음성 · 분필 (실제 재생) ==")
            ctx, page, errors, requests = new_page(browser)
            s = st(page)
            check(f"해설 MP3 가 들어 있는 빌드 ({expect}단계)", s["voiceMode"] != "off" and page.evaluate("() => window.LESSON_DATA.steps.every((s) => typeof s.audio === 'string' && s.audio.startsWith('data:audio/mpeg'))"), s["voiceMode"])
            check("처음에는 소리가 없고 아무것도 재생 중이 아님", energy(page) == 0 and voice_paused(page) and not s["playing"])
            check("해설 음성과 분필 소리가 기본으로 켜져 있음 (분필 25%)", s["voiceEnabled"] and s["chalkEnabled"] and s["chalkVolume"] == 25)
            check("분필 녹음이 오류 없이 준비됨", s["chalkError"] in (None, "") or not s["chalkError"], str(s["chalkError"]))

            # 브라우저가 재생을 막는 경우(NotAllowedError): 오류가 아니라 안내하고 멈춘다
            js(page, "() => { window.__blockPlay = 1; $P.play(); }")
            page.wait_for_timeout(700)
            s = st(page)
            note = page.inner_text("#voice-note")
            status = page.inner_text("#status")
            check("재생이 막히면 멈추고 재생 버튼을 안내한다 (NotAllowedError)",
                  (not s["playing"]) and s["voiceMode"] != "error" and "재생 버튼" in note and ("막" in status or "눌러" in status),
                  json.dumps({"playing": s["playing"], "mode": s["voiceMode"], "note": note, "status": status}, ensure_ascii=False))
            check("그 상태에서 판서가 소리 없이 흘러가지 않는다", s["t"] < 1.0, f"t={s['t']}")

            # 진짜 사용자 클릭
            page.click("#play")
            wait(page, "() => $P.getState().audioTime > 0.8")
            s = st(page)
            check("버튼을 누르면 해설이 재생된다 (안내 문구 사라짐)", s["playing"] and s["voiceMode"] == "embedded" and page.inner_text("#voice-note").strip() == "", json.dumps(s)[:200])
            tracks = page.evaluate("() => window.__lessonAudio.map((a) => ({src: a.currentSrc.slice(0, 22), paused: a.paused, rate: a.playbackRate, duration: a.duration}))")
            check("내장된 data: MP3 한 개만 재생(외부 주소·합성 없음)", len(tracks) == 1 and tracks[0]["src"].startswith("data:audio/mpeg") and not tracks[0]["paused"], str(tracks))
            check("해설 길이가 장면 파일의 길이와 같다(1단계 올바른 클립)", abs(tracks[0]["duration"] - s["audioDuration"]) < 0.3, f"{tracks[0]['duration']} vs {s['audioDuration']}")

            # 시계: t 는 audio.currentTime
            diffs = []
            for _ in range(8):
                page.wait_for_timeout(120)
                d = js(page, "() => { const s = $P.getState(); return [s.t, s.audioTime, s.drawDone]; }")
                if not d[2]:
                    diffs.append(abs(d[0] - d[1]))
            check("판서 시계가 오디오 시계를 따라간다 (|t − audio.currentTime| < 0.15초)", bool(diffs) and max(diffs) < 0.15, f"max={max(diffs) if diffs else None}")
            metrics["clockMaxDiffSec"] = round(max(diffs), 3) if diffs else None

            # 분필이 해설과 함께 실제로 들린다
            audible = False
            for _ in range(60):
                page.wait_for_timeout(100)
                if energy(page) > 1e-8:
                    audible = True
                    break
            check("판서 중 분필의 실제 신호가 측정된다 (해설과 동시에)", audible)

            # 속도 1.5
            page.select_option("#speed", "1.5")
            page.wait_for_timeout(300)
            check("속도 1.5배가 실제 오디오 요소에 적용된다 (playbackRate)", page.evaluate("() => window.__lessonAudio[0].playbackRate") == 1.5)
            page.select_option("#speed", "1")

            # 일시정지: 해설과 분필 모두 무음, 같은 자리에서 이어서
            page.click("#play")
            page.wait_for_timeout(250)
            at = st(page)["audioTime"]
            check("일시정지하면 해설과 분필이 모두 멈춘다", voice_paused(page) and energy(page) < 1e-9)
            page.wait_for_timeout(400)
            check("일시정지 중에는 시계가 가지 않는다", abs(st(page)["audioTime"] - at) < 0.05)
            page.click("#play")
            page.wait_for_timeout(500)
            s = st(page)
            check("이어서 재생하면 같은 자리에서 계속된다", s["playing"] and at - 0.1 <= s["audioTime"] <= at + 1.2, f"{at} -> {s['audioTime']}")

            # 분필 끄기
            page.click("#chalk-toggle")
            page.wait_for_timeout(250)
            check("분필을 끄면 즉시 무음이고 버튼 상태가 맞다", energy(page) < 1e-9 and page.get_attribute("#chalk-toggle", "aria-pressed") == "false" and "끔" in page.inner_text("#chalk-state"))
            check("분필을 꺼도 해설은 계속된다", not voice_paused(page))
            page.click("#chalk-toggle")

            # 판서가 끝났지만 해설이 남은 상태: 완료가 아님, '판서 중' 아님
            js(page, "() => $P.setSpeed(1)")
            anim_end = st(page)["animEnd"]
            page.evaluate("(end) => { window.__lessonAudio[0].currentTime = end + 0.5; }", anim_end)
            wait(page, "() => $P.getState().drawDone", timeout=5000)
            s = st(page)
            status = page.inner_text("#status")
            check("판서가 끝나도 해설이 남아 있으면 완료가 아니다", s["drawDone"] and not s["complete"] and s["playing"] and not s["voiceDone"], json.dumps(s)[:200])
            check("그때 상태 문구는 '판서 중'이 아니라 해설을 듣는 중", "판서 중" not in status and "해설" in status, status)

            # 해설 끝 → 실제 0.9초 → 다음 단계 해설
            dur = s["audioDuration"]
            page.evaluate("(dur) => { window.__lessonAudio[0].currentTime = dur - 0.4; }", dur)
            js(page, """() => {
              window.__gap = {done: null, moved: null};
              const t0 = performance.now();
              const id = setInterval(() => {
                const s = $P.getState();
                if (window.__gap.done === null && s.complete) window.__gap.done = performance.now();
                if (s.index === 1) { window.__gap.moved = performance.now(); clearInterval(id); }
                if (performance.now() - t0 > 6000) clearInterval(id);
              }, 10);
            }""")
            page.wait_for_function("() => window.__gap.moved !== null", timeout=8000)
            gap = page.evaluate("() => window.__gap")
            gap_s = (gap["moved"] - gap["done"]) / 1000 if gap["done"] else None
            check("해설이 끝나면 약 0.9초 뒤에 다음 단계로 넘어간다", gap_s is not None and 0.75 <= gap_s <= 1.4, f"gap={gap_s}")
            metrics["autoAdvanceGapSec"] = round(gap_s, 3) if gap_s is not None else None
            wait(page, "() => $P.getState().audioTime > 0.3", timeout=6000)
            s = st(page)
            check("다음 단계 해설이 처음부터 재생된다 (2단계 길이)", s["index"] == 1 and s["playing"] and s["audioTime"] < 3 and abs(page.evaluate("() => window.__lessonAudio[0].duration") - s["audioDuration"]) < 0.3, json.dumps(s)[:200])

            # 수동 이동은 이전 소리를 즉시 끊는다
            for _ in range(3):
                page.click("#next")
                page.wait_for_timeout(60)
            page.wait_for_timeout(500)
            s = st(page)
            check("빠르게 다음을 눌러도 마지막으로 누른 단계 하나의 해설만 재생된다", s["index"] == 4 and s["playing"] and s["audioTime"] < 2.5 and not s["voiceError"] and abs(page.evaluate("() => window.__lessonAudio[0].duration") - s["audioDuration"]) < 0.3, json.dumps(s)[:200])
            page.click("#prev")
            page.wait_for_timeout(250)
            s = st(page)
            check("이전 단계로 가도 새 단계 해설이 처음부터", s["index"] == 3 and s["playing"] and s["audioTime"] < 1.5)
            # 경합: 이전 클립에서 늦게 도착한 ended 가 새 클립 재생 중에 전달돼도 완료·자동 넘김으로 오판하지 않는다
            page.evaluate("() => window.__lessonAudio[0].dispatchEvent(new Event('ended'))")
            page.wait_for_timeout(1500)  # 간격 0.9초보다 오래 기다려도
            s = st(page)
            check("경합: 늦게 도착한 이전 클립의 ended 는 새 단계를 완료로 만들지 않는다", s["index"] == 3 and s["playing"] and not s["voiceDone"] and not s["complete"] and s["audioTime"] > 1.0 and not voice_paused(page), json.dumps(s)[:200])
            page.click("#play")  # 일시정지
            page.evaluate("() => document.activeElement && document.activeElement.blur()")
            page.keyboard.press("Space")
            check("스페이스 바로 재생", st(page)["playing"])
            page.keyboard.press("Space")
            check("스페이스 바로 일시정지 (해설·분필 무음)", (not st(page)["playing"]) and voice_paused(page))
            page.locator("#speed").focus()
            page.keyboard.press("ArrowRight")
            check("속도 선택 칸에서 ← → 는 단계 이동이 아님", st(page)["index"] == 3)

            # 해설 끄기/켜기
            page.evaluate("() => document.activeElement && document.activeElement.blur()")
            page.click("#play")
            page.wait_for_timeout(300)
            page.click("#voice-toggle")
            page.wait_for_timeout(300)
            t_a = st(page)["t"]
            page.wait_for_timeout(500)
            s = st(page)
            check("해설을 끄면 소리가 멈추고 판서는 자체 시계로 계속된다", voice_paused(page) and s["playing"] and s["t"] > t_a + 0.2 and s["voiceMode"] == "off" and page.get_attribute("#voice-toggle", "aria-pressed") == "false", json.dumps(s)[:200])
            page.click("#voice-toggle")
            page.wait_for_timeout(500)
            s = st(page)
            check("해설을 다시 켜면 이 단계를 해설과 함께 처음부터", s["voiceMode"] == "embedded" and not voice_paused(page) and s["audioTime"] < 1.5 and page.get_attribute("#voice-toggle", "aria-pressed") == "true", json.dumps(s)[:200])

            # 탭 숨김 · pagehide
            page.evaluate("""() => {
              Object.defineProperty(document, 'hidden', {configurable: true, get: () => true});
              document.dispatchEvent(new Event('visibilitychange'));
            }""")
            page.wait_for_timeout(250)
            s = st(page)
            check("탭이 가려지면 일시정지하고 해설·분필이 무음", (not s["playing"]) and voice_paused(page) and energy(page) < 1e-9 and any(w in page.inner_text("#status") for w in ("가려", "숨", "일시정지")), page.inner_text("#status"))
            page.evaluate("() => { delete document.hidden; }")
            page.click("#play")
            page.wait_for_timeout(400)
            check("돌아와서 재생을 누르면 다시 재생", st(page)["playing"] and not voice_paused(page))
            page.evaluate("() => window.dispatchEvent(new Event('pagehide'))")
            page.wait_for_timeout(200)
            check("pagehide 에서 모든 소리가 멈춘다", (not st(page)["playing"]) and voice_paused(page) and energy(page) < 1e-9)

            # 해설 파일 오류: 화면에 보이고 판서는 계속 (합성 대체 없음)
            page.click("#play")
            page.wait_for_timeout(500)
            page.evaluate("() => window.__lessonAudio[0].dispatchEvent(new Event('error'))")
            page.wait_for_timeout(300)
            s = st(page)
            notice = page.inner_text("#voice-note") + " " + page.inner_text("#status")
            check("해설 오류는 화면에 보이고 상태가 'error'", bool(s["voiceError"]) and s["voiceMode"] == "error" and any(w in notice for w in ("오류", "실패", "재생하지 못")), notice)
            t_e = st(page)["t"]
            page.wait_for_timeout(600)
            check("해설 오류 뒤에도 판서는 자체 시계로 계속", st(page)["playing"] and st(page)["t"] > t_e + 0.3)
            check("합성 음성 API 를 쓰지 않음", not page.evaluate("() => typeof window.speechSynthesis === 'object' && window.speechSynthesis.speaking"))
            check("페이지 오류 없음", not errors, "; ".join(errors)[:300])
            check("외부 요청 없음", not requests, ", ".join(requests)[:300])
            ctx.close()

            # ------------------------------------------------------------------
            print("\n== 마지막 단계: 해설이 끝나면 멈춤 ==")
            ctx, page, errors, requests = new_page(browser)
            last = expect - 1
            js(page, "([i]) => { $P.goTo(i, { play: false }); }", [last])
            page.click("#play")
            wait(page, "() => $P.getState().audioTime > 0.5")
            dur = st(page)["audioDuration"]
            page.evaluate("(dur) => { window.__lessonAudio[0].currentTime = dur - 0.3; }", dur)
            wait(page, "() => $P.getState().ended || !$P.getState().playing", timeout=8000)
            page.wait_for_timeout(1500)
            s = st(page)
            check("마지막 단계는 해설이 끝나면 멈추고 처음으로 돌아가지 않는다", s["index"] == last and not s["playing"] and s["complete"] and s["ended"], json.dumps(s)[:200])
            check("끝난 뒤 소리가 없다", voice_paused(page) and energy(page) < 1e-9)
            check("끝난 뒤 오류 없음", not errors, "; ".join(errors)[:300])
            ctx.close()

            # ------------------------------------------------------------------
            print("\n== 깨진 해설 파일 (실제 디코딩 실패) ==")
            bad = browser.new_context(offline=True, viewport={"width": 1440, "height": 1100})
            bad.add_init_script(
                """
              Object.defineProperty(window, 'LESSON_DATA', {
                configurable: true,
                set(value) {
                  value.steps[0].audio = 'data:audio/mpeg;base64,AAAA';
                  Object.defineProperty(window, 'LESSON_DATA', {value, configurable: true});
                }
              });
            """
            )
            bp = bad.new_page()
            bp.goto(url)
            ready(bp)
            bp.click("#play")
            wait(bp, "() => Boolean($P.getState().voiceError)")
            s = st(bp)
            note = bp.inner_text("#voice-note")
            check("깨진 MP3: 화면에 오류가 보인다", s["voiceMode"] == "error" and "오류" in note, note)
            bp.wait_for_timeout(1200)
            s2 = st(bp)
            check("깨진 MP3: 판서는 계속 진행된다", s2["playing"] and s2["t"] > s["t"] + 0.5, f"{s['t']} -> {s2['t']}")
            bad.close()

            # ------------------------------------------------------------------
            print("\n== 줄어든 동작 (prefers-reduced-motion) ==")
            ctx, page, errors, requests = new_page(browser, reduced_motion="reduce")
            s = st(page)
            check("시작부터 완성된 칠판 · 판서 애니메이션 없음", s["reduced"] and s["drawDone"] and not s["playing"] and s["t"] == s["animEnd"], json.dumps(s)[:200])
            check("안내 문구가 해설만 재생한다고 알린다", page.is_visible("#reduced-note") and "해설" in page.inner_text("#reduced-note"), page.inner_text("#reduced-note"))
            for i in range(expect):
                js(page, "([i]) => $P.goTo(i)", [i])
                page.wait_for_timeout(100)
                page.locator("#board").screenshot(path=str(art / f"media-board-{i + 1:02d}.png"))
            js(page, "() => $P.goTo(0)")
            page.click("#play")
            wait(page, "() => $P.getState().audioTime > 0.6")
            s = st(page)
            check("재생하면 칠판은 그대로 두고 해설이 나온다", s["index"] == 0 and s["playing"] and s["drawDone"] and not s["penDown"] and energy(page) < 1e-9, json.dumps(s)[:200])
            check("해설을 듣는 동안 상태 문구는 '판서 중'이 아니다", "판서 중" not in page.inner_text("#status") and "해설" in page.inner_text("#status"), page.inner_text("#status"))
            dur = s["audioDuration"]
            page.evaluate("(dur) => { window.__lessonAudio[0].currentTime = dur - 0.4; }", dur)
            wait(page, "() => $P.getState().index === 1")
            wait(page, "() => $P.getState().audioTime > 0.3", timeout=6000)
            s = st(page)
            check("줄어든 동작 + 자동 넘김: 해설 후 다음 단계 해설로 이어진다", s["index"] == 1 and s["playing"] and s["t"] == s["animEnd"], json.dumps(s)[:200])
            # 자동 넘김을 끄면 해설이 끝난 뒤 멈추고, 다시 켜면 이어진다
            page.click("#auto-toggle")
            dur = s["audioDuration"]
            page.evaluate("(dur) => { window.__lessonAudio[0].currentTime = dur - 0.4; }", dur)
            wait(page, "() => !$P.getState().playing")
            s = st(page)
            status = page.inner_text("#status")
            check("자동 넘김을 끄면 해설이 끝난 뒤 멈추고 완료·자동 넘김 꺼짐을 알린다", s["index"] == 1 and s["complete"] and "완료" in status and "자동 넘김" in status, status)
            page.click("#auto-toggle")
            wait(page, "() => $P.getState().index === 2")
            check("자동 넘김을 다시 켜면 완료된 단계에서 이어서 넘어간다", st(page)["index"] == 2 and st(page)["playing"])
            # 해설을 끄면 시계가 없으므로 자동 넘김을 정확히 비활성으로 표시한다
            page.click("#voice-toggle")
            page.wait_for_timeout(200)
            s = st(page)
            check("해설을 끄면 소리가 멈추고 자동 넘김 사용 불가", voice_paused(page) and not s["autoAvailable"] and not s["playing"], json.dumps(s)[:200])
            check("자동 넘김 버튼이 aria-disabled 로 표시된다", page.get_attribute("#auto-toggle", "aria-disabled") == "true" and "불가" in page.inner_text("#auto-state"))
            check("안내 문구가 자동 넘김을 쓸 수 없다고 알린다", "자동 넘김" in page.inner_text("#reduced-note"), page.inner_text("#reduced-note"))
            check("재생 버튼 이름이 '다음 단계 보기'", page.inner_text("#play-label") == "다음 단계 보기")
            page.click("#play")
            s = st(page)
            check("그때 재생 버튼은 다음 단계를 완성된 모습으로 보여 준다", s["index"] == 3 and not s["playing"] and s["complete"], json.dumps(s)[:200])
            page.wait_for_timeout(1500)
            check("타이머로 저절로 넘어가지 않는다", st(page)["index"] == 3)
            check("줄어든 동작 페이지 오류·외부 요청 없음", not errors and not requests, "; ".join(errors + requests)[:300])
            ctx.close()
        finally:
            browser.close()

    failed = [c for c in checks if not c["ok"]]
    report = {"passed": not failed, "html": str(html), "total": len(checks), "failed": len(failed), "metrics": metrics, "checks": checks}
    (art / "media-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\n합계 {len(checks)}건 중 실패 {len(failed)}건 · 보고서 {art / 'media-report.json'}")
    for c in failed:
        print("  FAIL:", c["name"], "|", c["detail"][:240])
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
