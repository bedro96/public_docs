"""verify_browser.py / verify_media.py / verify_chalk.py 가 함께 쓰는 도우미.

검증할 HTML 고르기:
  1. --html 경로                      그대로 검증
  2. --fixture                        시험 내용(tests/fixtures/content)으로 "소리 있는" 시험 빌드를 만들어 검증
  3. (기본) quantum-physics.html 이 있으면 그것, 없으면 실제 내용(content/)으로 시험 빌드를 만들어 검증

"소리 있는 시험 빌드"는 tests/standin-build.mjs 가 만듭니다. 해설 대신 분필 녹음을 이어 만든 가짜 클립이 들어 있어
소리 경로(오디오 시계·0.9초 간격·자동 넘김·소리 끄기)를 실제 브라우저에서 시험할 수 있습니다. 배포용이 아닙니다.
산출물·스크린샷은 모두 --artifacts 폴더(저장소 밖)에만 씁니다.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUTPUT = HERE / "quantum-physics.html"
CHROME_PATHS = ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"]
# 실제 브라우저처럼 '사용자 동작이 있어야 소리를 낼 수 있음' 정책을 지킨다(버튼 클릭으로만 재생).
AUTOPLAY_POLICY = "--autoplay-policy=document-user-activation-required"
FIXTURE_STEPS = 5
REAL_STEPS = 14


def player(script: str) -> str:
    """JS 문자열 안의 $P 를 window.quantumPlayer 로 바꿉니다 (엄격한 CSP 라 화살표 함수 + 인자를 씁니다)."""
    return script.replace("$P", "window.quantumPlayer")


def launch(pw):
    args = ["--no-sandbox", AUTOPLAY_POLICY]
    for path in CHROME_PATHS:
        if Path(path).exists():
            return pw.chromium.launch(executable_path=path, headless=True, args=args)
    return pw.chromium.launch(headless=True, args=args)


def add_common_args(ap: argparse.ArgumentParser) -> None:
    ap.add_argument("--html", default="", help="검증할 HTML (기본: quantum-physics.html, 없으면 실제 내용으로 시험 빌드)")
    ap.add_argument("--fixture", action="store_true", help="tests/fixtures/content 로 시험 빌드를 만들어 그것을 검증")
    ap.add_argument("--artifacts", default="", help="스크린샷·보고서·시험 빌드 저장 폴더 (기본: 임시 폴더, 저장소 밖만 허용)")
    ap.add_argument("--steps", type=int, default=0, help="예상 단계 수 (기본: 시험 내용 5, 실제 내용 14)")


def prepare(args, prefix: str) -> tuple[Path, Path, int] | None:
    """(artifacts 폴더, 검증할 HTML, 예상 단계 수) 를 돌려줍니다. 실패하면 None."""
    art = Path(args.artifacts) if args.artifacts else Path(tempfile.mkdtemp(prefix=prefix))
    art.mkdir(parents=True, exist_ok=True)
    if HERE == art.resolve() or HERE in art.resolve().parents:
        print("--artifacts 는 저장소 밖 폴더여야 합니다(/tmp 권장):", art)
        return None
    if args.html:
        html = Path(args.html).resolve()
        expect = args.steps or REAL_STEPS
    elif args.fixture:
        html = art / "fixture-standin.html"
        expect = args.steps or FIXTURE_STEPS
        build_standin(html, "tests/fixtures/content")
    elif OUTPUT.exists():
        html = OUTPUT
        expect = args.steps or REAL_STEPS
    else:
        html = art / "real-standin.html"
        expect = args.steps or REAL_STEPS
        print("quantum-physics.html 이 아직 없어 실제 내용(content/)으로 시험 빌드(가짜 해설 클립)를 만듭니다.")
        build_standin(html, "content")
    if not html.exists():
        print("HTML이 없습니다. 먼저 node build.mjs 를 실행하세요:", html)
        return None
    return art, html, expect


def build_standin(out: Path, content: str) -> None:
    r = subprocess.run(["node", "tests/standin-build.mjs", "--out", str(out), "--content", content], cwd=HERE, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stdout + r.stderr)
        sys.exit(2)
