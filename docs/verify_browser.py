"""Exercise the delivered, offline HTML in real Chrome using Playwright."""

import argparse
import json
import re
import time
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifacts", type=Path, required=True)
    parser.add_argument("--full-playback", action="store_true")
    args = parser.parse_args()
    args.artifacts.mkdir(parents=True, exist_ok=True)
    lesson = json.loads((ROOT / "lesson.json").read_text())
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path="/usr/bin/google-chrome",
            headless=True,
            args=["--no-sandbox", "--autoplay-policy=document-user-activation-required"]
        )
        context = browser.new_context(viewport={"width": 1440, "height": 1100}, offline=True)
        page = context.new_page()
        errors, requests = [], []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("request", lambda request: requests.append(request.url))
        page.goto((ROOT / "일차함수_칠판강의.html").as_uri())
        page.wait_for_function("Boolean(window.lessonPlayer)")
        page.evaluate("document.fonts.ready")
        state = lambda: page.evaluate("window.lessonPlayer.getState()")
        assert not state()["playing"], state()

        page.locator("#play").click()
        page.wait_for_timeout(1700)
        assert state()["playing"], state()
        assert state()["audioTime"] > 0.3, state()
        page.locator("#play").click()
        paused = state()["audioTime"]
        page.wait_for_timeout(400)
        assert not state()["playing"], state()
        assert abs(state()["audioTime"] - paused) < 0.15, state()
        page.locator("#play").click()
        page.wait_for_timeout(500)
        assert state()["audioTime"] > paused + 0.15, state()

        page.locator("#next").click()
        assert state()["index"] == 1, state()
        page.locator("#prev").click()
        assert state()["index"] == 0, state()
        if state()["playing"]:
            page.locator("#play").click()
        page.locator("#voice-toggle").click()
        assert not state()["voiceEnabled"], state()
        page.locator("#voice-toggle").click()
        page.locator("#chalk-toggle").click()
        assert not state()["chalkEnabled"], state()
        page.locator("#chalk-toggle").click()
        page.locator("#speed").select_option("1.5")

        page.locator("#slope").focus()
        page.keyboard.press("Home")
        for _ in range(6):
            page.keyboard.press("ArrowRight")
        assert float(page.locator("#slope").input_value()) == 0
        assert "상수함수" in page.locator("#lab-description").inner_text()
        page.keyboard.press("Home")
        page.locator("#intercept").focus()
        page.keyboard.press("End")
        assert "+ -" not in page.locator("#lab-equation").inner_text()
        assert float(page.locator("#slope").input_value()) == -3
        assert float(page.locator("#intercept").input_value()) == 3

        wrong, right = lesson["quiz"]["options"][:2]
        page.get_by_text(wrong["text"], exact=True).click()
        assert "음수" in page.locator("#quiz-feedback").inner_text()
        retry = page.get_by_role("button", name=re.compile("다시 풀|다시 도전"))
        if retry.count():
            retry.first.click()
        page.get_by_text(right["text"], exact=True).click()
        assert "정답" in page.locator("#quiz-feedback").inner_text()

        page.locator("#restart").click()
        if not state()["playing"]:
            page.locator("#play").click()
        page.wait_for_timeout(3600)
        page.screenshot(path=str(args.artifacts / "desktop-writing.png"), full_page=True)
        if state()["playing"]:
            page.locator("#play").click()
        page.evaluate("window.lessonPlayer.goTo(2)")
        page.locator("#play").click()
        page.wait_for_timeout(15000)
        if state()["playing"]:
            page.locator("#play").click()
        page.screenshot(path=str(args.artifacts / "desktop-slope.png"), full_page=True)

        page.set_viewport_size({"width": 390, "height": 844})
        page.screenshot(path=str(args.artifacts / "mobile.png"), full_page=True)
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
        assert page.locator("#play").is_visible()
        page.set_viewport_size({"width": 1440, "height": 1100})

        seen = set()
        if args.full_playback:
            page.locator("#restart").click()
            if not state()["playing"]:
                page.locator("#play").click()
            deadline = time.monotonic() + 230
            while time.monotonic() < deadline:
                current = state()
                seen.add(current["index"])
                if current.get("ended") or (
                    current["index"] == 7 and not current["playing"]
                    and current["progress"] >= 0.99
                ):
                    break
                page.wait_for_timeout(500)
            else:
                raise AssertionError(f"Lecture failed to finish: {state()}")
            assert seen == set(range(8)), seen
            assert not state()["playing"], state()
            page.screenshot(path=str(args.artifacts / "desktop-recap.png"), full_page=True)
            page.locator("#play").click()
            page.wait_for_timeout(500)
            assert state()["index"] == 0 and state()["playing"], state()
            page.locator("#play").click()

        assert not errors, errors
        external = [url for url in requests if url.startswith(("http:", "https:"))]
        assert not external, external
        report = {
            "passed": True, "offline": True,
            "checked": ["audio playback", "pause/resume", "chapter navigation",
                        "independent sound toggles", "speed selection",
                        "zero/negative slope", "intercept control", "quiz feedback",
                        "desktop/mobile layout"],
            "fullPlaybackChapters": sorted(seen),
            "pageErrors": errors, "externalRequests": external,
            "finalState": state()
        }
        (args.artifacts / "browser-report.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n"
        )
        print(json.dumps(report, ensure_ascii=False, indent=2))
        browser.close()


if __name__ == "__main__":
    main()
