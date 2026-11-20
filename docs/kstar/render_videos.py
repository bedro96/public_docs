import argparse
import hashlib
import json
import math
import os
import subprocess
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter
from playwright.sync_api import sync_playwright


here = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description="Render KSTAR MP4 chapters using the Anatomy vectors.")
parser.add_argument("audio", type=Path)
parser.add_argument("--out", type=Path, default=here / "media")
parser.add_argument("--only", help="Replace one chapter in an existing media build.")
args = parser.parse_args()
script = json.loads((here / "narration.json").read_text())
manifest_path = args.out / "manifest.json"
if args.only and args.only not in script:
    parser.error(f"unknown chapter: {args.only}")
if args.only and not manifest_path.is_file():
    parser.error("--only requires an existing media build")
chapter_ids = [args.only] if args.only else list(script)
manifest = json.loads(manifest_path.read_text()) if args.only else {}
scenes = json.loads(subprocess.check_output(["node", str(here / "video-scenes.mjs")]))
args.out.mkdir(parents=True, exist_ok=True)
size = (760, 474)
fps = 15
frames = {}

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.environ.get("CHROME_PATH", "/usr/bin/google-chrome"))
    page = browser.new_page(viewport={"width": size[0], "height": size[1]}, offline=True)
    page.set_content(scenes["html"])
    stages = {"machine": page.locator("#machine"), "field": page.locator("#field"), "orbit": page.locator("#orbit")}

    def background(stage):
        return Image.open(BytesIO(stages[stage].screenshot(animations="disabled"))).convert("RGB")

    def sampled(stage, selector):
        return stages[stage].evaluate("""(stage, selector) => {
          const path = stage.querySelector(selector);
          const length = path.getTotalLength(), rect = stage.getBoundingClientRect();
          return Array.from({length: 241}, (_, i) => {
            const p = path.getPointAtLength(length * i / 240).matrixTransform(path.getScreenCTM());
            return [p.x - rect.left, p.y - rect.top];
          });
        }""", selector)

    overview = background("machine")
    for chapter in chapter_ids:
        if chapter == "plasma":
            frames[chapter] = (background("orbit"), sampled("orbit", "[data-orbit]"))
        elif chapter in scenes["machine"]:
            stages["machine"].locator("svg").evaluate("(el, chapter) => { el.dataset.focus = chapter }", chapter)
            frames[chapter] = (background("machine"), None)
        elif chapter in scenes["summaries"]:
            still = Image.open(BytesIO(page.locator(f"#stage-{chapter}").screenshot())).convert("RGB")
            frames[chapter] = (still, None)
        else:
            stages["field"].evaluate("(el, chapter) => { el.dataset.step = chapter }", chapter)
            frames[chapter] = (background("field"), sampled("field", f'[data-track="{chapter}"]'))
    browser.close()


def build(chapter):
    audio = args.audio / f"{chapter}.mp3"
    duration = float(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(audio),
    ]))
    stage, track = frames[chapter]
    target = args.out / f"{chapter}.mp4"
    frame_count = math.ceil((duration + 0.60) * fps)
    command = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
        "-s", f"{size[0]}x{size[1]}", "-r", str(fps), "-i", "-", "-i", str(audio),
        "-af", "adelay=220:all=1,apad", "-shortest", "-vf", "format=yuv420p",
        "-c:v", "libx264", "-threads", "2", "-preset", "fast", "-crf", "25", "-c:a", "aac",
        "-b:a", "48k", "-movflags", "+faststart", str(target),
    ]
    with subprocess.Popen(command, stdin=subprocess.PIPE) as encoder:
        for i in range(frame_count):
            t = i / fps
            u = min(1, t / 0.82)
            if track is None and u < 1:
                start = Image.new("RGB", size, "#172620") if chapter in scenes["summaries"] else overview
                frame = Image.blend(start, stage, (1 - math.cos(math.pi * u)) / 2)
            elif track:
                frame = stage.copy()
                phase = min(1, t / max(duration - 0.7, 1)) if chapter == "exhaust" else (t / 4.9) % 1
                position = round(phase * 240)
                glow = Image.new("RGBA", size)
                draw = ImageDraw.Draw(glow)
                strength = min(1, t / 0.6)
                for j in range(22, -1, -1):
                    if chapter == "exhaust" and position < j:
                        continue
                    x, y = track[(position - j) % 241]
                    radius = 4.4 - j * 0.10
                    draw.ellipse((x-radius, y-radius, x+radius, y+radius),
                                 fill=(255, 195, 106, round(strength * (190 - j * 7))))
                frame.paste(glow, (0, 0), glow.filter(ImageFilter.GaussianBlur(2)))
                frame.paste(glow, (0, 0), glow)
            else:
                frame = stage
            encoder.stdin.write(frame.tobytes())
        encoder.stdin.close()
        if encoder.wait() != 0:
            raise RuntimeError(f"ffmpeg failed building {chapter}")
    print(f"{chapter}: {duration:.1f}s voice, {target.stat().st_size:,} bytes", flush=True)
    return chapter, {
        "narrationSha256": hashlib.sha256(script[chapter].encode()).hexdigest(),
        "videoSha256": hashlib.sha256(target.read_bytes()).hexdigest(),
    }


with ThreadPoolExecutor(max_workers=3) as pool:
    manifest.update(pool.map(build, chapter_ids))
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
