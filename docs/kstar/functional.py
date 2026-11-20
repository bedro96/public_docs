import json
import os
import subprocess
from pathlib import Path

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError, expect, sync_playwright


here = Path(__file__).resolve().parent
artifact = (here / "kstar.html").as_uri()
index = (here.parent / "index.html").as_uri()
screens = os.environ.get("KSTAR_SCREEN_DIR")
chapters = json.loads((here / "narration.json").read_text())


for chapter in chapters:
    asset = here / "media" / f"{chapter}.mp4"
    probe = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "stream=codec_name,duration,width,height",
        "-of", "json", str(asset),
    ]))
    video_stream, audio_stream = probe["streams"]
    assert video_stream["codec_name"] == "h264" and video_stream["width"] == 760
    assert audio_stream["codec_name"] == "aac" and float(audio_stream["duration"]) > 10
    assert abs(float(video_stream["duration"]) - float(audio_stream["duration"])) < 0.25
    pcm = subprocess.check_output([
        "ffmpeg", "-v", "error", "-i", str(asset), "-ss", "2", "-t", "8",
        "-vn", "-f", "s16le", "-ac", "1", "-",
    ])
    samples = memoryview(pcm).cast("h")
    assert sum(abs(sample) > 400 for sample in samples) > 10000, f"silent audio: {chapter}"


def shot(locator, name):
    if screens:
        locator.screenshot(path=str(Path(screens) / f"kstar-{name}.png"))


def seek_near_end(video):
    video.evaluate("(v) => { v.currentTime = v.duration - 0.32 }")


def playback_at(page, lesson, threshold):
    try:
        page.wait_for_function(
            """([lesson, seconds]) => {
              const v = document.querySelector(`[data-lesson=${lesson}] video`);
              return !v.paused && !v.seeking && v.currentTime > seconds;
            }""",
            arg=[lesson, threshold], timeout=7000,
        )
    except PlaywrightTimeoutError as exc:
        state = page.locator(".lesson").evaluate_all("""lessons => lessons.map(node => {
          const v = node.querySelector("video");
          return {
            lesson: node.dataset.lesson, chapter: node.querySelector('[aria-current=step]').dataset.chapter,
            status: node.querySelector(".lesson-status").textContent, time: v.currentTime,
            duration: v.duration, paused: v.paused, readyState: v.readyState, seeking: v.seeking,
            ended: v.ended, error: v.error?.message
          };
        })""")
        raise AssertionError(f"{lesson} never played past {threshold}s: {state}") from exc


with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.environ.get("CHROME_PATH", "/usr/bin/google-chrome"))
    page = browser.new_page(viewport={"width": 1440, "height": 1000}, offline=True)
    failures = []
    requests = []
    page.on("pageerror", lambda error: failures.append(str(error)))
    page.on("console", lambda message: failures.append(message.text) if message.type == "error" else None)
    page.on("request", lambda request: requests.append(request.url))
    page.goto(artifact)
    expect(page.locator("html")).to_have_attribute("data-enhanced", "")
    expect(page.locator(".lead-metrics dd")).to_have_text(["48초", "102초", "300초"])
    expect(page.locator("#record meter")).to_have_count(6)
    assert page.locator("a[href^='#']").evaluate_all("(nodes) => nodes.every(n => document.getElementById(n.hash.slice(1)))")
    machine = page.locator('[data-lesson="machine"]')
    field = page.locator('[data-lesson="confinement"]')
    summary = page.locator('[data-lesson="summary"]')
    expect(machine.locator("[data-chapter]")).to_have_count(6)
    expect(field.locator("[data-chapter]")).to_have_count(5)
    expect(summary.locator("[data-chapter]")).to_have_count(3)
    expect(machine.locator(".lesson-prev")).to_be_disabled()
    shot(machine.locator(".lesson-grid"), "video-controls")

    video = machine.locator("video")
    machine.get_by_role("button", name="자동 넘김").click()
    expect(machine.locator(".lesson-auto")).to_have_attribute("aria-pressed", "true")
    playback_at(page, "machine", 0.65)
    assert video.evaluate("(v) => !v.paused && !v.muted && v.volume > 0 && v.videoWidth === 760")
    assert video.evaluate("(v) => v.webkitAudioDecodedByteCount") > 0
    seek_near_end(video)
    expect(machine.locator("[data-chapter=tf]")).to_have_attribute("aria-current", "step")
    playback_at(page, "machine", 0.25)
    machine.locator(".lesson-auto").click()
    seek_near_end(video)
    expect(machine.locator(".lesson-status")).to_contain_text("재생 완료")
    expect(machine.locator("[data-chapter=tf]")).to_have_attribute("aria-current", "step")

    machine.locator("[data-chapter=tf]").press("End")
    expect(machine.locator("[data-chapter=divertor]")).to_be_focused()
    machine.locator("[data-chapter=plasma]").click()
    playback_at(page, "machine", 0.85)
    shot(machine.locator("video"), "plasma-orbit")
    frame = """v => {
      const c = document.createElement('canvas');
      c.width = 380; c.height = 237;
      c.getContext('2d').drawImage(v, 0, 0, 380, 237);
      return [...c.getContext('2d').getImageData(0, 0, 380, 237).data]
        .reduce((hash, value) => (Math.imul(hash, 31) + value) | 0, 0);
    }"""
    at_start = video.evaluate(frame)
    playback_at(page, "machine", 1.4)
    assert video.evaluate(frame) != at_start, "orbit video is not visibly moving"
    machine.locator(".chapter-description summary").click()
    expect(machine.locator(".chapter-description details p")).to_contain_text("개념 그림")

    field.locator(".video-start").click()
    assert video.evaluate("(v) => v.paused"), "lessons played simultaneously"
    field.locator("[data-chapter=helical]").click()
    field_video = field.locator("video")
    playback_at(page, "confinement", 0.7)
    shot(field_video, "helical-video")
    field.locator(".lesson-auto").click()
    seek_near_end(field_video)
    expect(field.locator("[data-chapter=control]")).to_have_attribute("aria-current", "step")
    field.locator("[data-chapter=exhaust]").click()
    playback_at(page, "confinement", 0.25)
    seek_near_end(field_video)
    expect(field.locator(".lesson-status")).to_contain_text("마지막 단계 재생이 끝났습니다")
    expect(field.locator(".lesson-auto")).to_have_attribute("aria-pressed", "false")

    all_button = page.locator("#play-all")
    all_button.click()
    for section, order in [
        ("machine", ["vessel", "tf", "pf", "cs", "plasma", "divertor"]),
        ("confinement", ["seed", "toroidal", "helical", "control", "exhaust"]),
        ("summary", ["record", "comparison", "meaning"]),
    ]:
        lesson = page.locator(f'[data-lesson="{section}"]')
        lesson_video = lesson.locator("video")
        for chapter in order:
            expect(lesson.locator(f"[data-chapter={chapter}]")).to_have_attribute("aria-current", "step")
            expect(lesson.locator(".lesson-auto")).to_have_attribute("aria-pressed", "true")
            playback_at(page, section, 0.3)
            if chapter in {"comparison", "meaning"}:
                playback_at(page, section, 0.95)
                shot(lesson_video, f"{chapter}-video")
            seek_near_end(lesson_video)
    expect(summary.locator(".lesson-status")).to_contain_text("마지막 단계 재생이 끝났습니다")
    expect(all_button).to_have_attribute("aria-pressed", "false")
    assert not failures, failures
    assert all(url.startswith(("file:", "data:")) for url in requests), requests
    page.route("https://www.youtube-nocookie.com/**", lambda route: route.fulfill(body=""))
    kstar_footage = page.locator('[aria-controls="footage-kstar"]')
    st40_footage = page.locator('[aria-controls="footage-st40"]')
    kstar_frame = page.locator("#footage-kstar iframe")
    st40_frame = page.locator("#footage-st40 iframe")
    kstar_footage.click()
    expect(kstar_frame).to_have_attribute("src", "https://www.youtube-nocookie.com/embed/Sp99eLMRMDE")
    st40_footage.click()
    expect(kstar_frame).to_have_count(0)
    expect(st40_frame).to_have_attribute("src", "https://www.youtube-nocookie.com/embed/0MW8nkIeCUI")
    st40_footage.click()
    expect(st40_frame).to_have_count(0)
    st40_footage.click()
    machine.locator("[data-chapter=plasma]").click()
    expect(st40_frame).to_have_count(0)
    page.close()

    mobile = browser.new_page(viewport={"width": 390, "height": 844}, has_touch=True, reduced_motion="reduce", offline=True)
    mobile.goto(artifact)
    assert mobile.evaluate("document.documentElement.scrollWidth === innerWidth")
    shot(mobile.locator('[data-lesson=machine] .figure-plate'), "phone-video")
    mobile.locator('[data-lesson=confinement] [data-chapter=exhaust]').tap()
    expect(mobile.locator('[data-lesson=confinement] video')).to_be_visible()
    mobile.close()

    no_js = browser.new_page(java_script_enabled=False, offline=True)
    no_js.goto(artifact)
    expect(no_js.locator(".chapter-text > li")).to_have_count(14)
    expect(no_js.locator(".lesson-grid").first).to_be_hidden()
    expect(no_js.locator(".chapter-text > li > h3").last).to_be_visible()
    no_js.close()

    listing = browser.new_page(offline=True)
    listing.goto(index)
    listing.locator("[data-cat='sci'].cat").click()
    listing.locator("#q").fill("KSTAR")
    assert listing.locator(".stop:visible").count() == 1
    listing.get_by_role("link", name="KSTAR — 1억 도를 가두는 법").click()
    expect(listing).to_have_url(artifact)
    browser.close()

print("Passed: fourteen decoded video/audio tracks, audible offline Chrome playback, within-lesson and full-playlist auto-advance, and index link.")
