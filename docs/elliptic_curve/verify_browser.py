#!/usr/bin/env python3
"""타원곡선 칠판 강의(elliptic-curve.html) 브라우저 검증.

Playwright + 시스템 Chrome으로 다음을 확인합니다.
  * 1440x900, 1024x768, 390x844 화면, 줄어든 동작(prefers-reduced-motion), 오프라인(file:// + 네트워크 차단)
  * 페이지 오류/콘솔 오류 없음, 가로 넘침 없음, 외부 요청 없음
  * 단계마다 캔버스가 비어 있지 않고, 좌표평면 가로·세로 배율이 같고(등축), 배치 경고가 없음
  * 재생/일시정지/이전/다음/키보드/해시/자동 넘김/속도 조작
  * 손글씨 글꼴이 내장 글꼴로 로드되고, 화면에 서식 토큰(^{ }, _{ }, [[ ]])이 남지 않음
  * 푸터 작성자 "Microsoft Korea STU", window.ellipticPlayer 노출

스크린샷과 report.json은 --artifacts 폴더에 저장합니다(저장소 밖 경로를 권장).
사용법:  python3 verify_browser.py --artifacts <폴더> [--html elliptic-curve.html]
"""
from __future__ import annotations

import argparse
import json
import sys
import tempfile
from pathlib import Path

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
VIEWPORTS = [("1440", 1440, 900), ("1024", 1024, 768), ("390", 390, 844)]
CHROME_PATHS = ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"]

results: list[dict] = []


def check(name: str, ok: bool, detail: str = "") -> bool:
    results.append({"name": name, "ok": bool(ok), "detail": detail})
    print(("  PASS " if ok else "  FAIL ") + name + (f"  [{detail}]" if detail and not ok else ""))
    return bool(ok)


def launch(pw):
    for path in CHROME_PATHS:
        if Path(path).exists():
            return pw.chromium.launch(executable_path=path, headless=True, args=["--no-sandbox"])
    return pw.chromium.launch(headless=True, args=["--no-sandbox"])


class Watcher:
    """페이지 오류, 콘솔 오류, 외부 요청을 모읍니다."""

    def __init__(self, page):
        self.errors: list[str] = []
        self.external: list[str] = []
        page.on("pageerror", lambda e: self.errors.append("pageerror: " + str(e)))
        page.on("console", lambda m: self.errors.append("console." + m.type + ": " + m.text) if m.type in ("error", "warning") else None)
        page.on("request", lambda r: self.external.append(r.url) if not r.url.startswith(("file:", "data:", "blob:", "about:")) else None)


def ink(page) -> float:
    """캔버스에서 불투명하게 칠해진 픽셀의 비율(%). 읽기 전용 복사본에서 셉니다."""
    return page.evaluate(
        """() => {
          const c = document.getElementById('board');
          const o = document.createElement('canvas');
          o.width = c.width; o.height = c.height;
          const x = o.getContext('2d', { willReadFrequently: true });
          x.drawImage(c, 0, 0);
          const d = x.getImageData(0, 0, o.width, o.height).data;
          let n = 0;
          for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++;
          return 100 * n / (d.length / 4);
        }"""
    )


def state(page) -> dict:
    return page.evaluate("() => window.ellipticPlayer.getState()")


def open_page(browser, url: str, width: int, height: int, *, reduced: bool = False, offline: bool = True):
    ctx = browser.new_context(
        viewport={"width": width, "height": height},
        device_scale_factor=1,
        reduced_motion="reduce" if reduced else "no-preference",
        offline=offline,
        locale="ko-KR",
    )
    page = ctx.new_page()
    watcher = Watcher(page)
    page.goto(url, wait_until="load")
    page.wait_for_function("() => window.ellipticPlayer && window.ellipticPlayer.getState().ready")
    page.evaluate("() => document.fonts.ready")
    page.wait_for_timeout(250)
    return ctx, page, watcher


def common_checks(tag: str, page, watcher: Watcher, width: int) -> None:
    check(f"[{tag}] window.ellipticPlayer 노출", page.evaluate("() => typeof window.ellipticPlayer === 'object' && typeof window.ellipticPlayer.goTo === 'function'"))
    over = page.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
    check(f"[{tag}] 가로 넘침 없음", over <= 1, f"overflow={over}")
    cw = page.evaluate("() => { const c = document.getElementById('board'); const r = c.getBoundingClientRect(); return [r.left, r.right, window.innerWidth]; }")
    check(f"[{tag}] 캔버스가 화면 안에 있음", cw[0] >= -0.5 and cw[1] <= cw[2] + 0.5, str(cw))
    font_ok = page.evaluate("() => document.fonts.check('30px ChalkKorean', '가나다 xy 123')")
    check(f"[{tag}] 내장 손글씨 글꼴 로드(오프라인)", font_ok)
    leak = page.evaluate("() => /\\^\\{|_\\{|\\[\\[|\\*\\*/.test(document.body.innerText)")
    check(f"[{tag}] 화면에 서식 토큰이 남지 않음", not leak)
    footer = page.evaluate("() => (document.querySelector('footer') || {}).innerText || ''")
    check(f"[{tag}] 푸터 작성자 Microsoft Korea STU", "Microsoft Korea STU" in footer, footer[:80])
    check(f"[{tag}] 제곱·첨자는 <sup>/<sub> 요소로 표시", page.evaluate("() => document.querySelectorAll('#beats sup, #board-title sup, #summary sup, #callout sup').length > 0"))


def per_step(tag: str, page, art: Path, shots: bool) -> None:
    ids = page.evaluate("() => window.ellipticPlayer.steps")
    check(f"[{tag}] 단계 8개", len(ids) == 8, str(ids))
    for i, sid in enumerate(ids):
        page.evaluate("([i]) => window.ellipticPlayer.seek(i, 'end')", [i])
        page.wait_for_timeout(120)
        st = state(page)
        pct = ink(page)
        check(f"[{tag}] {i + 1}단계 {sid}: 캔버스가 비어 있지 않음", pct > 1.0, f"ink={pct:.2f}%")
        check(f"[{tag}] {i + 1}단계 {sid}: 완료 상태·재생 멈춤", st["complete"] and not st["playing"], json.dumps(st)[:160])
        check(f"[{tag}] {i + 1}단계 {sid}: 배치 경고 없음", not st["warnings"], json.dumps(st["warnings"], ensure_ascii=False))
        if st["plot"]:
            px, py = st["plot"]["xPxPerUnit"], st["plot"]["yPxPerUnit"]
            check(f"[{tag}] {i + 1}단계 {sid}: 가로·세로 배율이 같음(등축)", abs(px - py) < 1e-9 and px > 0, f"x={px} y={py}")
        # 설명 구절 표시
        n_beats = page.evaluate("() => document.querySelectorAll('#beats li').length")
        n_past = page.evaluate("() => document.querySelectorAll('#beats li.is-past').length")
        check(f"[{tag}] {i + 1}단계 {sid}: 완료 시 모든 설명 구절이 지난 상태", n_beats >= 3 and n_beats == n_past, f"{n_past}/{n_beats}")
        if shots:
            page.screenshot(path=str(art / f"{tag}-step{i + 1}-{sid}-full.png"), full_page=True)
            page.locator(".board-frame").screenshot(path=str(art / f"{tag}-step{i + 1}-{sid}-board.png"))


def mid_frames(tag: str, page, art: Path) -> None:
    for i in (1, 3, 5, 6):
        page.evaluate("([i]) => { const p = window.ellipticPlayer; p.seek(i, 0); const end = p.getState().animEnd; p.seek(i, end * 0.45); }", [i])
        page.wait_for_timeout(100)
        st = state(page)
        check(f"[{tag}] {i + 1}단계 중간 프레임(t={st['t']}): 분필이 그리는 중", 0 < st["t"] < st["animEnd"] and not st["complete"])
        page.locator(".board-frame").screenshot(path=str(art / f"{tag}-step{i + 1}-mid.png"))


def interactions(tag: str, page) -> None:
    page.evaluate("() => window.location.hash = ''")
    page.evaluate("() => window.ellipticPlayer.goTo(0, { play: false })")
    page.evaluate("() => window.ellipticPlayer.seek(0, 0)")
    page.evaluate("() => { const p = window.ellipticPlayer; p.pause(); }")
    label0 = page.inner_text("#play-label")
    page.click("#play")
    page.wait_for_timeout(1300)
    st = state(page)
    check(f"[{tag}] 재생 버튼: 재생 시작", st["playing"] and st["t"] > 0.5, json.dumps(st)[:140])
    check(f"[{tag}] 재생 중 버튼 이름 '일시정지'", page.inner_text("#play-label") == "일시정지", label0)
    page.click("#play")
    t1 = state(page)["t"]
    page.wait_for_timeout(400)
    st = state(page)
    check(f"[{tag}] 일시정지 후 시간이 멈춤", (not st["playing"]) and abs(st["t"] - t1) < 0.05, f"{t1}->{st['t']}")
    check(f"[{tag}] 일시정지 후 버튼 이름 '이어서 재생'", page.inner_text("#play-label") == "이어서 재생")
    page.click("#next")
    check(f"[{tag}] 다음 단계 버튼", state(page)["index"] == 1)
    page.click("#prev")
    check(f"[{tag}] 이전 단계 버튼", state(page)["index"] == 0)
    page.keyboard.press("ArrowRight")
    check(f"[{tag}] → 키", state(page)["index"] == 1)
    page.keyboard.press("ArrowLeft")
    check(f"[{tag}] ← 키", state(page)["index"] == 0)
    page.keyboard.press("5")
    check(f"[{tag}] 숫자 키 5", state(page)["index"] == 4)
    page.evaluate("() => { window.location.hash = '#7'; }")
    page.wait_for_timeout(150)
    check(f"[{tag}] #7 해시 이동", state(page)["index"] == 6)
    page.click("#chapters li:nth-child(2) button")
    check(f"[{tag}] 단계 목록 버튼", state(page)["index"] == 1)
    cur = page.evaluate("() => document.querySelector('#chapters [aria-current=step]')?.innerText || ''")
    check(f"[{tag}] 현재 단계 표시(aria-current)", "2" in cur, cur)
    page.click("#replay")
    page.wait_for_timeout(500)
    st = state(page)
    check(f"[{tag}] 다시 그리기: 처음부터 재생", st["playing"] and st["t"] < 2.5 and st["index"] == 1, json.dumps(st)[:140])
    page.click("#play")  # 멈춤
    page.click("#auto-toggle")
    check(f"[{tag}] 자동 넘김 끄기", state(page)["auto"] is False and page.get_attribute("#auto-toggle", "aria-pressed") == "false")
    page.click("#auto-toggle")
    page.select_option("#speed", "1.5")
    check(f"[{tag}] 속도 1.5배", state(page)["speed"] == 1.5)
    page.select_option("#speed", "1")
    page.evaluate("() => document.activeElement && document.activeElement.blur()")
    page.keyboard.press("Space")  # 포커스가 본문에 있을 때 재생/멈춤이 되는지
    page.wait_for_timeout(150)
    st1 = state(page)
    page.keyboard.press("Space")
    st2 = state(page)
    check(f"[{tag}] 스페이스 바 재생/멈춤", st1["playing"] != st2["playing"], f"{st1['playing']}->{st2['playing']}")


def auto_advance(browser, url: str) -> None:
    """가짜 시계로 자동 넘김을 확인합니다 (실제 40초를 기다리지 않음)."""
    ctx = browser.new_context(viewport={"width": 1024, "height": 768}, offline=True, locale="ko-KR")
    page = ctx.new_page()
    w = Watcher(page)
    page.clock.install(time=0)
    page.goto(url, wait_until="load")
    page.wait_for_function("() => window.ellipticPlayer && window.ellipticPlayer.getState().ready")
    page.evaluate("() => { const p = window.ellipticPlayer; p.seek(5, 0); p.setAuto(true); p.setSpeed(1.5); }")
    page.evaluate("() => window.ellipticPlayer.play()")
    page.clock.run_for(2000)
    st = state(page)
    check("[auto] 5단계 재생 중 (가짜 시계)", st["index"] == 5 and st["playing"] and st["t"] > 0.5, json.dumps(st)[:140])
    page.clock.run_for(60000)
    st = state(page)
    check("[auto] 충분히 기다리면 다음 단계로 넘어감", st["index"] >= 6 and st["started"], json.dumps(st)[:140])
    page.evaluate("() => { const p = window.ellipticPlayer; p.seek(7, 0); p.setAuto(true); p.play(); }")
    page.clock.run_for(90000)
    st = state(page)
    check("[auto] 마지막 단계는 끝나면 멈춤", st["index"] == 7 and not st["playing"] and st["complete"], json.dumps(st)[:140])
    page.evaluate("() => { const p = window.ellipticPlayer; p.seek(2, 0); p.setAuto(false); p.play(); }")
    page.clock.run_for(40000)
    st = state(page)
    check("[auto] 자동 넘김을 끄면 판서가 끝난 뒤 멈춤", st["index"] == 2 and not st["playing"] and st["complete"], json.dumps(st)[:140])
    check("[auto] 오류 없음", not w.errors, "; ".join(w.errors)[:200])
    ctx.close()


def reduced_motion(browser, url: str, art: Path) -> None:
    ctx, page, w = open_page(browser, url, 1024, 768, reduced=True)
    st = state(page)
    check("[reduced] 줄어든 동작 감지", st["reduced"] is True)
    check("[reduced] 시작부터 완성된 칠판", st["complete"] and not st["playing"] and ink(page) > 1.0, json.dumps(st)[:140])
    check("[reduced] 안내 문구 표시", page.is_visible("#reduced-note"))
    check("[reduced] 재생 버튼 이름 '다음 단계 보기'", page.inner_text("#play-label") == "다음 단계 보기")
    check("[reduced] 시작 안내 오버레이 숨김", not page.is_visible("#board-hint"))
    page.click("#play")
    st = state(page)
    check("[reduced] 재생 버튼은 다음 단계를 완성된 모습으로 보여 줌", st["index"] == 1 and st["complete"] and not st["playing"], json.dumps(st)[:140])
    for i in range(8):
        page.evaluate("([i]) => window.ellipticPlayer.goTo(i)", [i])
        st = state(page)
        if not (st["complete"] and not st["playing"] and ink(page) > 1.0):
            check(f"[reduced] {i + 1}단계 정적 표시", False, json.dumps(st)[:140])
            break
    else:
        check("[reduced] 8단계 모두 정적으로 완성 표시", True)
    page.evaluate("() => window.ellipticPlayer.goTo(3)")
    page.screenshot(path=str(art / "reduced-step4-full.png"), full_page=True)
    page.keyboard.press("Space")
    check("[reduced] 스페이스 바도 애니메이션을 시작하지 않음", not state(page)["playing"])
    check("[reduced] 오류 없음", not w.errors, "; ".join(w.errors)[:200])
    ctx.close()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--html", default=str(HERE / "elliptic-curve.html"))
    ap.add_argument("--artifacts", default="", help="스크린샷·report.json 저장 폴더 (기본: 임시 폴더)")
    ap.add_argument("--no-shots", action="store_true", help="스크린샷을 저장하지 않음")
    args = ap.parse_args()

    html = Path(args.html).resolve()
    if not html.exists():
        print("HTML이 없습니다. 먼저 node build.mjs 를 실행하세요:", html)
        return 2
    art = Path(args.artifacts) if args.artifacts else Path(tempfile.mkdtemp(prefix="ecc-verify-"))
    art.mkdir(parents=True, exist_ok=True)
    url = html.as_uri()
    print("검증 대상:", url)
    print("결과 저장:", art)

    with sync_playwright() as pw:
        browser = launch(pw)
        try:
            for tag, w, h in VIEWPORTS:
                print(f"\n== {tag}px ({w}x{h}) · 오프라인 ==")
                ctx, page, watcher = open_page(browser, url, w, h)
                st = state(page)
                check(f"[{tag}] 처음에는 1단계가 비어 있고 재생 대기", st["index"] == 0 and not st["started"] and not st["playing"], json.dumps(st)[:140])
                check(f"[{tag}] 시작 안내 표시", page.is_visible("#board-hint"))
                page.screenshot(path=str(art / f"{tag}-initial.png"), full_page=True)
                common_checks(tag, page, watcher, w)
                per_step(tag, page, art, shots=not args.no_shots)
                if tag != "390":
                    mid_frames(tag, page, art)
                interactions(tag, page)
                common_checks(tag + "/after", page, watcher, w)
                check(f"[{tag}] 페이지·콘솔 오류 없음", not watcher.errors, "; ".join(watcher.errors)[:300])
                check(f"[{tag}] 외부 요청 없음", not watcher.external, ", ".join(watcher.external)[:300])
                ctx.close()
            print("\n== 줄어든 동작 ==")
            reduced_motion(browser, url, art)
            print("\n== 자동 넘김 (가짜 시계) ==")
            auto_advance(browser, url)
        finally:
            browser.close()

    failed = [r for r in results if not r["ok"]]
    (art / "report.json").write_text(json.dumps({"total": len(results), "failed": len(failed), "results": results}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n합계 {len(results)}건 중 실패 {len(failed)}건 · 보고서 {art / 'report.json'}")
    for r in failed:
        print("  FAIL:", r["name"], "|", r["detail"][:200])
    return 1 if failed else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except PlaywrightError as exc:
        print("Playwright 오류:", exc)
        sys.exit(2)
