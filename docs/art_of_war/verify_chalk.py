#!/usr/bin/env python3
"""분필 소리 회귀 검증: 내장된 CC0 실제 녹음만, 조용하게, 펜이 닿은 동안에만.

오프라인 Chrome 에서 art-of-war.html 을 열고 Web Audio 의 최종 출력(analyser)을 직접 재서 확인합니다.
  * 소리는 디코딩된 실제 녹음 조각(루프 아님, 합성 없음)이어야 한다
  * 기본 음량(25%)의 RMS −75 ~ −35 dBFS, 가장 큰 창 −27 dBFS 미만 (조용한 마스터 상한)
  * 글자 사이 · 공백 위에서는 분필을 들어 무음, 획마다 별도의 소리 시작(8번 이상)
  * 슬라이더 0 → 무음, 일시정지 → 무음, 분필 끄기 → 무음
  * 내장 녹음을 풀지 못하면 화면에 오류가 보이고 강의는 계속된다(합성 대체 없음)

해설 음성(HTMLAudioElement)은 Web Audio 를 거치지 않으므로 여기서는 해설을 끄고 분필만 잽니다.
해설 MP3 가 없는 개발용 빌드(--no-audio)에서도 그대로 돌아갑니다(해설은 처음부터 꺼져 있습니다).

사용법:  python3 verify_chalk.py --artifacts <폴더>              (저장소 밖 폴더를 권장)
         python3 verify_chalk.py --artifacts <폴더> --html <파일>
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
HTML = ROOT / "art-of-war.html"
CHROME_PATHS = ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"]
POLICY = "--autoplay-policy=document-user-activation-required"
PLAYER = "window.artOfWarPlayer"

TRACE_AUDIO = """
(() => {
  window.__chalkSources = [];
  window.__chalkTaps = [];
  const decoded = new WeakSet();
  const decode = AudioContext.prototype.decodeAudioData;
  AudioContext.prototype.decodeAudioData = function(...args) {
    return decode.apply(this, args).then(buffer => { decoded.add(buffer); return buffer; });
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
    const state = window.artOfWarPlayer.getState();
    samples.push({at: performance.now(), energy: window.__chalkEnergy(),
      penDown: state.penDown, character: state.writingCharacter, playing: state.playing});
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  return samples;
}"""


def launch(pw):
    for path in CHROME_PATHS:
        if Path(path).exists():
            return pw.chromium.launch(executable_path=path, headless=True, args=["--no-sandbox", POLICY])
    return pw.chromium.launch(headless=True, args=["--no-sandbox", POLICY])


def db(power: float) -> float:
    return 10 * math.log10(max(power, 1e-12))


def ready(page) -> None:
    page.wait_for_function(f"() => Boolean({PLAYER} && {PLAYER}.getState().ready)")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--artifacts", type=Path, required=True, help="보고서를 쓸 폴더(저장소 밖 권장)")
    parser.add_argument("--html", type=Path, default=HTML, help="시험할 HTML (기본: art-of-war.html)")
    args = parser.parse_args()
    art = args.artifacts.resolve()
    if ROOT in art.parents or art == ROOT:
        print("--artifacts 는 저장소 밖 폴더여야 합니다:", art)
        return 2
    art.mkdir(parents=True, exist_ok=True)
    html = args.html.resolve()
    if not html.exists():
        print("HTML이 없습니다. 먼저 node build.mjs (개발 중에는 --no-audio) 를 실행하세요:", html)
        return 2

    failures: list[str] = []
    with sync_playwright() as playwright:
        browser = launch(playwright)
        context = browser.new_context(offline=True, viewport={"width": 1280, "height": 900})
        context.add_init_script(TRACE_AUDIO)
        page = context.new_page()
        errors: list[str] = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("console", lambda m: errors.append("console." + m.type + ": " + m.text) if m.type == "error" else None)
        page.goto(html.as_uri())
        ready(page)

        # 기본값: 슬라이더 25%, 출력 25%
        defaults = page.evaluate(
            f"""() => ({{slider: document.getElementById('chalk-volume').value,
          output: document.getElementById('chalk-volume-value').textContent || document.getElementById('chalk-volume-value').value,
          state: {PLAYER}.getState()}})"""
        )
        if defaults["slider"] != "25" or defaults["output"] != "25%" or defaults["state"]["chalkVolume"] != 25:
            failures.append(f"Default chalk volume must be 25% (slider {defaults['slider']}, output {defaults['output']}).")
        if not defaults["state"]["chalkEnabled"]:
            failures.append("Chalk must default to on.")
        if defaults["state"]["hasAudio"] and not defaults["state"]["voiceEnabled"]:
            failures.append("Voice must default to on when the narration is embedded.")
        if page.evaluate("window.__chalkEnergy()") != 0:
            failures.append("There must be no sound before the first user action.")

        # 해설을 끄고(분필만 재기) 재생: 10초 동안 출력 에너지를 10ms 간격으로 잰다
        # (글자 사이의 공백은 짧으므로, 공백 위에서 소리가 나는지 확인할 표본이 충분히 모이도록 넉넉히 잽니다)
        if page.evaluate(f"() => {PLAYER}.getState().voiceEnabled"):
            page.locator("#voice-toggle").click()
        page.locator("#play").click()
        samples = page.evaluate(SAMPLE_JS, 10000)
        page.locator("#play").click()  # 일시정지
        page.wait_for_timeout(250)
        paused_energy = page.evaluate("window.__chalkEnergy()")
        sources = page.evaluate("window.__chalkSources")
        state = page.evaluate(f"{PLAYER}.getState()")

        energies = [s["energy"] for s in samples]
        rms_db = db(sum(energies) / len(energies))
        peak_window_db = db(max(energies))
        space_samples = [
            cur for prev, cur in zip(samples, samples[1:])
            if cur.get("character") == " " and prev.get("character") == " " and cur["playing"]
        ]
        # 펜을 든 구간(penDown=false, 재생 중)에서는 소리가 거의 없어야 한다(릴리스 램프 4ms 이후)
        lifted = [cur for prev, cur in zip(samples, samples[1:]) if not cur["penDown"] and not prev["penDown"] and cur["playing"]]
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

        # 슬라이더 0 → 무음 (키보드 Home 으로 슬라이더 최소값)
        page.locator("#chalk-volume").focus()
        page.keyboard.press("Home")
        out0 = page.evaluate("document.getElementById('chalk-volume-value').textContent || document.getElementById('chalk-volume-value').value")
        page.locator("#play").click()
        page.wait_for_timeout(700)
        volume_zero_silent = page.evaluate("window.__chalkEnergy()") < 1e-10
        page.locator("#play").click()
        if out0 != "0%" or not volume_zero_silent:
            failures.append(f"Chalk volume 0 must read '0%' and be silent (output {out0!r}, silent {volume_zero_silent}).")
        page.locator("#chalk-volume").focus()
        page.keyboard.press("End")
        page.evaluate(f"{PLAYER}.setChalkVolume(25)")

        # 분필 끄기 → 무음
        page.locator("#chalk-toggle").click()
        page.locator("#play").click()
        page.wait_for_timeout(700)
        mute_energy = page.evaluate("window.__chalkEnergy()")
        page.locator("#play").click()
        if mute_energy > 1e-10 or page.locator("#chalk-toggle").get_attribute("aria-pressed") != "false":
            failures.append(f"Chalk off must be silent and reflect aria-pressed=false (energy {mute_energy:.2e}).")
        page.locator("#chalk-toggle").click()

        # 한자 판서 중에도 분필이 들리는지: 한자가 많은 단계(첫 장)에서 한 번 더 잰다
        hanja_step = page.evaluate(
            f"""() => {{
          const steps = window.LESSON_DATA.steps;
          const re = /[\\u4e00-\\u9fff]/;
          const i = steps.findIndex(s => re.test(s.han || ''));
          return i;
        }}"""
        )
        hanja_contacts = None
        if hanja_step >= 0:
            page.evaluate(f"(i) => {PLAYER}.goTo(i, {{play: false}})", hanja_step)
            before = len(page.evaluate("window.__chalkSources"))
            page.locator("#play").click()
            page.wait_for_timeout(2500)
            page.locator("#play").click()
            hanja_contacts = len(page.evaluate("window.__chalkSources")) - before
            if hanja_contacts < 3:
                failures.append(f"Chalk must sound while writing the hanja title step (only {hanja_contacts} new contacts).")

        if errors:
            failures.append("Page errors: " + "; ".join(errors))

        # 내장 녹음이 깨졌을 때: 화면에 오류, 합성 대체 없음, 강의는 계속
        bad_context = browser.new_context(offline=True, viewport={"width": 1280, "height": 900})
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
        bad_page.goto(html.as_uri())
        ready(bad_page)
        if bad_page.evaluate(f"() => {PLAYER}.getState().voiceEnabled"):
            bad_page.locator("#voice-toggle").click()
        bad_page.locator("#play").click()
        bad_page.wait_for_function(f"() => Boolean({PLAYER}.getState().chalkError)")
        note = bad_page.locator("#chalk-note").inner_text()
        bad_page.wait_for_timeout(600)
        bad_state = bad_page.evaluate(f"{PLAYER}.getState()")
        decode_failure_reported = "분필 녹음을 재생하지 못했어요" in note
        if not decode_failure_reported:
            failures.append(f"Chalk decode failure must be visible, got {note!r}.")
        if not bad_state["playing"] or bad_state["t"] < 0.3:
            failures.append("Lesson must keep playing when the chalk recording cannot be decoded.")
        bad_context.close()

        report = {
            "passed": not failures,
            "target": str(html),
            "defaultRmsDbFS": round(rms_db, 1),
            "loudestWindowDbFS": round(peak_window_db, 1),
            "separateContacts": len(sources),
            "distinctOffsets": len({round(s['offset'], 2) for s in sources}),
            "silentSpaceSamples": len(space_samples),
            "liftedSamples": len(lifted),
            "volumeZeroSilent": volume_zero_silent,
            "hanjaStepContacts": hanja_contacts,
            "recordingDecodeFailureReported": decode_failure_reported,
            "failures": failures,
        }
        (art / "chalk-report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(json.dumps(report, indent=2, ensure_ascii=False))
        browser.close()
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
