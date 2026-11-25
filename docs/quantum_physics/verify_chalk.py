#!/usr/bin/env python3
"""분필 소리 회귀 검증: 내장된 CC0 실제 녹음만, 조용하게, 펜이 닿은 동안에만.

오프라인 Chrome 에서 강의 HTML 을 열고 Web Audio 의 최종 출력(analyser)을 직접 재서 확인합니다.
  * 소리는 디코딩된 실제 녹음 조각(루프 아님, 합성 없음)이어야 한다
  * 기본 음량(25%)의 RMS −75 ~ −35 dBFS, 가장 큰 창 −27 dBFS 미만 (조용한 마스터 상한)
  * 글자 사이 · 공백 위에서는 분필을 들어 무음, 획마다 별도의 소리 시작(8번 이상)
  * 슬라이더 0 → 무음, 일시정지 → 무음, 분필 끄기 → 무음
  * graph 보드(축·곡선·점·선분·타원)를 그릴 때도 펜이 닿은 동안에만 소리가 나고, 그리는 중이 아니면 무음
  * 내장 녹음을 풀지 못하면 화면에 오류가 보이고 강의는 계속된다(합성 대체 없음)

해설 음성(HTMLAudioElement)은 Web Audio 를 거치지 않으므로 여기서는 해설을 끄고 분필만 잽니다.
HTML 은 verify_media.py 와 같은 방식으로 고릅니다(--html / --fixture / quantum-physics.html / 시험 빌드).
사용법:  python3 verify_chalk.py --artifacts <폴더>   (저장소 밖 폴더 필수, /tmp 권장)
"""
from __future__ import annotations

import argparse
import json
import math
import sys

from playwright.sync_api import sync_playwright

from verify_common import add_common_args, launch, player, prepare

TRACE_AUDIO = """
(() => {
  window.__chalkSources = [];
  window.__chalkTaps = [];
  const decoded = new WeakSet();
  const decode = AudioContext.prototype.decodeAudioData;
  AudioContext.prototype.decodeAudioData = function(...args) {
    return decode.apply(this, args).then((buffer) => { decoded.add(buffer); return buffer; });
  };
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function(...args) {
    window.__chalkSources.push({recorded: decoded.has(this.buffer), loop: this.loop, offset: args[1] || 0});
    return start.apply(this, args);
  };
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function(destination, ...args) {
    if (destination instanceof AudioDestinationNode) {
      const analyser = this.context.createAnalyser();
      analyser.fftSize = 128;
      window.__chalkTaps.push(analyser);
      connect.call(analyser, destination);
      return connect.call(this, analyser, ...args);
    }
    return connect.call(this, destination, ...args);
  };
  window.__chalkEnergy = () => window.__chalkTaps.reduce((sum, analyser) => {
    const data = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(data);
    return sum + data.reduce((energy, x) => energy + x*x, 0) / data.length;
  }, 0);
})();
"""

SAMPLE_JS = """async (ms) => {
  const samples = [], start = performance.now();
  while (performance.now() - start < ms) {
    const state = window.quantumPlayer.getState();
    samples.push({at: performance.now(), energy: window.__chalkEnergy(),
      penDown: state.penDown, character: state.writingCharacter, playing: state.playing, drawing: state.drawing});
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return samples;
}"""

VOLUME_OUT = "(document.getElementById('chalk-volume-value').textContent || document.getElementById('chalk-volume-value').value)"


def db(power: float) -> float:
    return 10 * math.log10(max(power, 1e-12))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    add_common_args(parser)
    args = parser.parse_args()
    if not args.artifacts:
        print("--artifacts 폴더가 필요합니다(저장소 밖, /tmp 권장).")
        return 2
    prep = prepare(args, "qp-chalk-")
    if prep is None:
        return 2
    art, html, expect = prep
    url = html.as_uri()
    print("검증 대상:", url)

    failures: list[str] = []
    with sync_playwright() as playwright:
        browser = launch(playwright)
        context = browser.new_context(offline=True, viewport={"width": 1280, "height": 800})
        context.add_init_script(TRACE_AUDIO)
        page = context.new_page()
        errors: list[str] = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(url)
        page.wait_for_function(player("() => Boolean(window.quantumPlayer && window.quantumPlayer.getState().ready)"))

        # 기본값: 슬라이더 25%, 출력 25%
        defaults = page.evaluate(player("() => ({slider: document.getElementById('chalk-volume').value, output: " + VOLUME_OUT + ", state: $P.getState()})"))
        if defaults["slider"] != "25" or defaults["output"].strip() != "25%" or defaults["state"]["chalkVolume"] != 25:
            failures.append(f"Default chalk volume must be 25% (slider {defaults['slider']}, output {defaults['output']}).")
        if not (defaults["state"]["chalkEnabled"] and defaults["state"]["voiceEnabled"]):
            failures.append("Voice and chalk must both default to on.")
        if page.evaluate("() => window.__chalkEnergy()") != 0:
            failures.append("There must be no sound before the first user action.")

        # 해설을 끄고(분필만 재기) 재생: 단계마다 6초 동안 출력 에너지를 10ms 간격으로 잰다.
        # 1단계(그래프)와, 글자를 많이 쓰는 첫 flow/chalk 단계(공백 위에서 분필을 드는지 보려면 글줄이 필요)를 잰다.
        page.locator("#voice-toggle").click()
        text_idx = page.evaluate("() => window.LESSON_DATA.steps.findIndex((s) => s.board.kind === 'flow' || s.board.kind === 'chalk')")
        segments: list[list[dict]] = []
        paused_energy = 0.0
        for idx in [0] + ([text_idx] if text_idx > 0 else []):
            page.evaluate(player("([i]) => { $P.pause(); $P.goTo(i, { play: false }); $P.seek(i, 0); }"), [idx])
            page.locator("#play").click()
            segments.append(page.evaluate(SAMPLE_JS, 6000 if idx == 0 else 9000))
            page.locator("#play").click()  # 일시정지
            page.wait_for_timeout(250)
            paused_energy = max(paused_energy, page.evaluate("() => window.__chalkEnergy()"))
        samples = [s for seg in segments for s in seg]
        sources = page.evaluate("() => window.__chalkSources")
        state = page.evaluate(player("() => $P.getState()"))

        energies = [s["energy"] for s in samples]
        rms_db = db(sum(energies) / len(energies))
        peak_window_db = db(max(energies))
        space_samples = [
            cur for seg in segments for prev, cur in zip(seg, seg[1:])
            if cur.get("character") == " " and prev.get("character") == " " and cur["playing"]
        ]
        # 펜을 든 구간(penDown=false, 재생 중)에서는 소리가 거의 없어야 한다(릴리스 램프 4ms 이후)
        lifted = [cur for seg in segments for prev, cur in zip(seg, seg[1:]) if not cur["penDown"] and not prev["penDown"] and cur["playing"]]
        loud_lifted = [s for s in lifted if s["energy"] > 1e-7]

        if not sources or not all(s["recorded"] and not s["loop"] for s in sources):
            failures.append("Chalk must use decoded field-recording strokes, not generated looping noise.")
        if not (-75 < rms_db < -35 and peak_window_db < -27):
            failures.append(f"Default chalk is not quiet enough: RMS {rms_db:.1f}, peak-window {peak_window_db:.1f} dBFS.")
        if len(sources) < 8:
            failures.append(f"Expected separate handwriting contacts, got only {len(sources)} sound starts.")
        if len({round(s['offset'], 2) for s in sources}) < 5:
            failures.append("Strokes must start from different places in the recording (no obvious repetition).")
        if len(space_samples) < 3 or any(s["energy"] > 1e-8 for s in space_samples):
            failures.append(f"Moving across spaces must lift the chalk and produce silence ({len(space_samples)} space samples).")
        if len(lifted) < 5 or len(loud_lifted) > max(2, len(lifted) // 20):
            failures.append(f"Sound continued while the pen was lifted: {len(loud_lifted)}/{len(lifted)} loud samples.")
        if paused_energy > 1e-10:
            failures.append(f"Chalk did not stop on pause (energy {paused_energy:.2e}).")
        if not state["chalkReady"] or state["chalkError"]:
            failures.append(f"Chalk recording was not decoded cleanly: {state['chalkError']!r}")

        # graph 보드: 곡선·축을 그리는 동안 소리가 나고(펜이 닿음), 그리는 중이 아니면(정지·완성) 무음이어야 한다
        graph_idx = page.evaluate("() => window.LESSON_DATA.steps.findIndex((s) => s.board.kind === 'graph')")
        graph_contacts = graph_silent_idle = graph_pen_loud = None
        if graph_idx < 0:
            failures.append("Lesson has no graph step to check.")
        else:
            page.evaluate(player("([i]) => { $P.pause(); $P.goTo(i, { play: false }); $P.seek(i, 0); $P.setSpeed(1.5); }"), [graph_idx])
            before = len(page.evaluate("() => window.__chalkSources"))
            page.locator("#play").click()
            gs = page.evaluate(SAMPLE_JS, 9000)
            page.locator("#play").click()
            after = len(page.evaluate("() => window.__chalkSources"))
            graph_contacts = after - before
            pen_samples = [s for s in gs if s["penDown"] and s["playing"]]
            graph_pen_loud = len([s for s in pen_samples if s["energy"] > 1e-9])
            if graph_contacts < 3:
                failures.append(f"Drawing a graph must trigger chalk contacts, got {graph_contacts}.")
            if len(pen_samples) < 20 or graph_pen_loud < max(3, len(pen_samples) // 10):
                failures.append(f"Chalk must be audible while the pen touches the graph board ({graph_pen_loud}/{len(pen_samples)} audible samples).")
            # 완성 화면(판서 끝)에서는 소리가 없어야 한다
            page.evaluate(player("([i]) => { $P.seek(i, 'end'); }"), [graph_idx])
            page.wait_for_timeout(400)
            graph_silent_idle = page.evaluate("() => window.__chalkEnergy()") < 1e-10
            if not graph_silent_idle:
                failures.append("A finished graph board must be silent.")
            page.evaluate(player("() => $P.setSpeed(1)"))

        # 슬라이더 0 → 무음 (키보드 Home 으로 슬라이더 최소값)
        page.evaluate(player("() => { $P.pause(); $P.goTo(0, { play: false }); $P.seek(0, 0); }"))
        page.locator("#chalk-volume").focus()
        page.keyboard.press("Home")
        out0 = page.evaluate("() => " + VOLUME_OUT).strip()
        page.locator("#play").click()
        page.wait_for_timeout(700)
        volume_zero_silent = page.evaluate("() => window.__chalkEnergy()") < 1e-10
        page.locator("#play").click()
        if out0 != "0%" or not volume_zero_silent:
            failures.append(f"Chalk volume 0 must read '0%' and be silent (output {out0!r}, silent {volume_zero_silent}).")
        page.locator("#chalk-volume").focus()
        page.keyboard.press("End")
        page.evaluate(player("() => $P.setChalkVolume(25)"))

        # 분필 끄기 → 무음
        page.locator("#chalk-toggle").click()
        page.locator("#play").click()
        page.wait_for_timeout(700)
        mute_energy = page.evaluate("() => window.__chalkEnergy()")
        page.locator("#play").click()
        if mute_energy > 1e-10 or page.locator("#chalk-toggle").get_attribute("aria-pressed") != "false":
            failures.append(f"Chalk off must be silent and reflect aria-pressed=false (energy {mute_energy:.2e}).")
        page.locator("#chalk-toggle").click()

        if errors:
            failures.append("Page errors: " + "; ".join(errors))

        # 내장 녹음이 깨졌을 때: 화면에 오류, 합성 대체 없음, 강의는 계속
        bad_context = browser.new_context(offline=True)
        bad_context.add_init_script(
            """
          Object.defineProperty(window, 'LESSON_DATA', {
            configurable: true,
            set(value) {
              value.chalkSound.audio = 'data:audio/mpeg;base64,AAAA';
              Object.defineProperty(window, 'LESSON_DATA', {value, configurable: true});
            }
          });
        """
        )
        bad_page = bad_context.new_page()
        bad_page.goto(url)
        bad_page.wait_for_function(player("() => Boolean(window.quantumPlayer && window.quantumPlayer.getState().ready)"))
        bad_page.locator("#voice-toggle").click()
        bad_page.locator("#play").click()
        bad_page.wait_for_function(player("() => Boolean(window.quantumPlayer.getState().chalkError)"))
        note = bad_page.locator("#chalk-note").inner_text()
        bad_page.wait_for_timeout(600)
        bad_state = bad_page.evaluate(player("() => $P.getState()"))
        decode_failure_reported = "분필 녹음을 재생하지 못했어요" in note
        if not decode_failure_reported:
            failures.append(f"Chalk decode failure must be visible, got {note!r}.")
        if not bad_state["playing"] or bad_state["t"] < 0.3:
            failures.append("Lesson must keep playing when the chalk recording cannot be decoded.")
        bad_context.close()

        report = {
            "passed": not failures,
            "html": str(html),
            "defaultRmsDbFS": round(rms_db, 1),
            "loudestWindowDbFS": round(peak_window_db, 1),
            "separateContacts": len(sources),
            "distinctOffsets": len({round(s['offset'], 2) for s in sources}),
            "silentSpaceSamples": len(space_samples),
            "liftedSamples": len(lifted),
            "graphContacts": graph_contacts,
            "graphAudibleWhilePenDown": graph_pen_loud,
            "graphSilentWhenFinished": graph_silent_idle,
            "volumeZeroSilent": volume_zero_silent,
            "recordingDecodeFailureReported": decode_failure_reported,
            "failures": failures,
        }
        (art / "chalk-report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(json.dumps(report, indent=2, ensure_ascii=False))
        browser.close()
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
