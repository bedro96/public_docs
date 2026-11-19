"""Regression checks for recorded, quiet, pen-contact-synchronized chalk sound."""

import argparse
import json
import math
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parent
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
    window.__chalkSources.push({recorded: decoded.has(this.buffer), loop: this.loop});
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifacts", type=Path, required=True)
    args = parser.parse_args()
    args.artifacts.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path="/usr/bin/google-chrome", headless=True,
            args=["--no-sandbox", "--autoplay-policy=document-user-activation-required"]
        )
        context = browser.new_context(offline=True)
        context.add_init_script(TRACE_AUDIO)
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto((ROOT / "일차함수_칠판강의.html").as_uri())
        page.wait_for_function("Boolean(window.lessonPlayer)")
        page.locator("#voice-toggle").click()
        page.locator("#play").click()
        samples = page.evaluate("""async () => {
          const samples = [], start = performance.now();
          while (performance.now() - start < 6000) {
            const state = window.lessonPlayer.getState();
            samples.push({at: performance.now(), energy: window.__chalkEnergy(),
              penDown: state.penDown, character: state.writingCharacter});
            await new Promise(resolve => setTimeout(resolve, 10));
          }
          return samples;
        }""")
        page.locator("#play").click()
        sources = page.evaluate("window.__chalkSources")
        energies = [sample["energy"] for sample in samples]
        rms_db = 10 * math.log10(max(sum(energies) / len(energies), 1e-12))
        peak_window_db = 10 * math.log10(max(max(energies), 1e-12))
        space_samples = [
            sample for previous, sample in zip(samples, samples[1:])
            if sample.get("character") == " " and previous.get("character") == " "
        ]
        failures = []
        if not sources or not all(source["recorded"] and not source["loop"] for source in sources):
            failures.append("Chalk must use decoded field-recording strokes, not generated looping noise.")
        if not (-75 < rms_db < -35 and peak_window_db < -27):
            failures.append(f"Default chalk is not quiet enough: RMS {rms_db:.1f}, peak-window {peak_window_db:.1f} dBFS.")
        if len(sources) < 8:
            failures.append(f"Expected separate handwriting contacts, got only {len(sources)} sound starts.")
        if len(space_samples) < 3 or any(sample["energy"] > 1e-8 for sample in space_samples):
            failures.append("Moving across spaces must lift the chalk and produce silence.")
        if not page.locator("#chalk-volume").count():
            failures.append("Missing independent chalk-volume control.")
        else:
            page.locator("#chalk-volume").focus()
            page.keyboard.press("Home")
            page.locator("#play").click()
            page.wait_for_timeout(700)
            assert page.evaluate("window.__chalkEnergy()") < 1e-10
            page.locator("#play").click()
            page.keyboard.press("Tab")
        assert not errors, errors
        bad_context = browser.new_context(offline=True)
        bad_context.add_init_script("""
          Object.defineProperty(window, 'LESSON_DATA', {
            configurable: true,
            set(value) {
              value.chalkSound.audio = 'data:audio/mpeg;base64,AAAA';
              Object.defineProperty(window, 'LESSON_DATA', {value, configurable: true});
            }
          });
        """)
        bad_page = bad_context.new_page()
        bad_page.goto((ROOT / "일차함수_칠판강의.html").as_uri())
        bad_page.locator("#play").click()
        bad_page.wait_for_function("Boolean(window.lessonPlayer.getState().chalkError)")
        assert "분필 녹음을 재생하지 못했어요" in bad_page.locator("#chalk-note").inner_text()
        bad_page.wait_for_timeout(500)
        assert bad_page.evaluate("window.lessonPlayer.getState().playing")
        assert bad_page.evaluate("window.lessonPlayer.getState().audioTime") > 0.1
        bad_context.close()
        report = {
            "passed": not failures, "defaultRmsDbFS": round(rms_db, 1),
            "loudestWindowDbFS": round(peak_window_db, 1),
            "separateContacts": len(sources), "silentSpaceSamples": len(space_samples),
            "recordingDecodeFailureReported": True, "failures": failures
        }
        (args.artifacts / "chalk-report.json").write_text(json.dumps(report, indent=2) + "\n")
        print(json.dumps(report, indent=2))
        browser.close()
        assert not failures, "\n".join(failures)


if __name__ == "__main__":
    main()
