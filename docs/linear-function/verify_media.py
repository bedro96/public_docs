"""Verify audible chalk output, reduced motion and media failures in offline Chrome."""

import argparse
import json
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parent
INSTRUMENT_AUDIO = """
(() => {
  window.__audioTaps = [];
  window.__lessonAudio = [];
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifacts", type=Path, required=True)
    args = parser.parse_args()
    args.artifacts.mkdir(parents=True, exist_ok=True)
    url = (ROOT / "일차함수_칠판강의.html").as_uri()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path="/usr/bin/google-chrome", headless=True,
            args=["--no-sandbox", "--autoplay-policy=document-user-activation-required"]
        )
        context = browser.new_context(offline=True, viewport={"width": 1440, "height": 1100})
        context.add_init_script(INSTRUMENT_AUDIO)
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(url)
        page.wait_for_function("Boolean(window.lessonPlayer)")
        assert page.evaluate("window.__soundEnergy()") == 0
        page.locator("#voice-toggle").click()
        page.locator("#play").click()
        audible = False
        for _ in range(40):
            page.wait_for_timeout(100)
            if page.evaluate("window.__soundEnergy()") > 1e-8:
                audible = True
                break
        assert audible, "Chalk drawing did not produce any real audio signal."
        page.locator("#play").click()
        page.wait_for_timeout(250)
        assert page.evaluate("window.__soundEnergy()") < 1e-9, "Chalk did not stop on pause."
        page.locator("#play").click()
        page.wait_for_timeout(300)
        page.locator("#chalk-toggle").click()
        page.wait_for_timeout(250)
        assert page.evaluate("window.__soundEnergy()") < 1e-9, "Chalk mute was not silent."
        page.locator("#play").click()

        page.locator("#voice-toggle").click()
        page.locator("#play").click()
        for _ in range(4):
            page.locator("#next").click()
            page.wait_for_timeout(80)
        page.wait_for_timeout(600)
        state = page.evaluate("window.lessonPlayer.getState()")
        assert state["index"] == 4 and state["playing"] and not state["voiceError"], state
        page.locator("#play").click()
        page.evaluate("document.activeElement.blur()")
        page.keyboard.press("Space")
        assert page.evaluate("window.lessonPlayer.getState().playing")
        page.keyboard.press("Space")
        assert not page.evaluate("window.lessonPlayer.getState().playing")
        page.locator("#slope").focus()
        page.keyboard.press("ArrowRight")
        assert page.evaluate("window.lessonPlayer.getState().index") == 4

        page.evaluate("""() => {
          window.__lessonAudio[0].dispatchEvent(new Event('error'));
        }""")
        assert page.evaluate("Boolean(window.lessonPlayer.getState().voiceError)")
        notice = page.locator("#voice-note").inner_text() + page.locator("#status").inner_text()
        assert any(word in notice for word in ["오류", "실패", "재생할 수", "불러오지", "문제"]), notice
        assert not errors, errors
        context.close()

        context = browser.new_context(
            offline=True, reduced_motion="reduce",
            viewport={"width": 1440, "height": 1100}
        )
        page = context.new_page()
        page.goto(url)
        page.wait_for_function("Boolean(window.lessonPlayer)")
        page.evaluate("document.fonts.ready")
        assert page.evaluate("window.lessonPlayer.getState().reducedMotion")
        for index in range(8):
            page.evaluate("(index) => window.lessonPlayer.goTo(index)", index)
            page.wait_for_timeout(120)
            page.locator("#board").screenshot(path=str(args.artifacts / f"board-{index+1}.png"))
        page.locator("#play").click()
        page.wait_for_timeout(600)
        assert page.evaluate("window.lessonPlayer.getState().audioTime") > 0.2
        page.locator("#play").click()
        print(json.dumps({
            "passed": True, "chalkSignalMeasured": audible,
            "silentBeforePlay": True, "silentOnPause": True, "silentOnMute": True,
            "rapidNavigation": True, "keyboardControls": True,
            "audioFailureNotice": True, "reducedMotionPlayback": True,
            "completedBoardScreenshots": 8
        }, indent=2))
        browser.close()


if __name__ == "__main__":
    main()
