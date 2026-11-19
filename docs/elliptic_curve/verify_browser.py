#!/usr/bin/env python3
"""타원곡선 칠판 강의(elliptic-curve.html) 브라우저 검증.

Playwright + 시스템 Chrome으로 다음을 확인합니다.
  * 1440x900, 1024x768, 390x844 화면, 줄어든 동작(prefers-reduced-motion), 오프라인(file:// + 네트워크 차단)
  * 페이지 오류/콘솔 오류 없음, 가로 넘침 없음, 외부 요청 없음
  * 단계마다 캔버스가 비어 있지 않고, 좌표평면 가로·세로 배율이 같고(등축), 배치 경고가 없음
  * 재생/일시정지/이전/다음/키보드/해시/자동 넘김/속도 조작
  * 해설 음성·분필 소리 토글, 분필 음량 기본 25%, 해설 자막(음성 칩·대본) 표시
  * 자동 넘김: 해설이 끝난 뒤 0.9초 간격을 두고 넘어가며, 끄면 완료 상태에서 멈추고 다시 켜면 이어서 넘어감
  * 줄어든 동작: 완성된 칠판 + 해설 재생, 해설을 끈 경우 '다음 단계 보기'와 자동 넘김 불가 표시
  * 손글씨 글꼴이 내장 글꼴로 로드되고, 화면에 서식 토큰(^{ }, _{ }, [[ ]])이 남지 않음
  * 푸터 작성자 "Microsoft Korea STU", window.ellipticPlayer 노출

실제 소리가 나오는 재생·활성화·수명주기 검증은 verify_media.py, 분필 소리 신호 검증은 verify_chalk.py 가 맡습니다.
이 파일의 가짜 시계 시험은 해설 음성을 끄고(시계는 오디오가 아니라 판서) 자동 넘김의 시간 규칙을 봅니다.

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
# 실제 브라우저처럼 '사용자 동작이 있어야 소리를 낼 수 있음' 정책을 지킨다(버튼 클릭으로만 재생).
LAUNCH_ARGS = ["--no-sandbox", "--autoplay-policy=document-user-activation-required"]

results: list[dict] = []


def check(name: str, ok: bool, detail: str = "") -> bool:
    results.append({"name": name, "ok": bool(ok), "detail": detail})
    print(("  PASS " if ok else "  FAIL ") + name + (f"  [{detail}]" if detail and not ok else ""))
    return bool(ok)


def launch(pw):
    for path in CHROME_PATHS:
        if Path(path).exists():
            return pw.chromium.launch(executable_path=path, headless=True, args=LAUNCH_ARGS)
    return pw.chromium.launch(headless=True, args=LAUNCH_ARGS)


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
        # seek 는 정지 화면을 만들므로 판서가 끝난 상태이고, 해설은 아직 시작 전이라 '완료'(판서+음성)는 아니다
        check(f"[{tag}] {i + 1}단계 {sid}: 판서 끝 상태·재생 멈춤·소리 없음",
              st["drawDone"] and not st["playing"] and not st["complete"] and st["audioTime"] == 0, json.dumps(st)[:160])
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
        check(f"[{tag}] {i + 1}단계 중간 프레임(t={st['t']}): 분필이 그리는 중", 0 < st["t"] < st["animEnd"] and not st["drawDone"] and not st["complete"])
        page.locator(".board-frame").screenshot(path=str(art / f"{tag}-step{i + 1}-mid.png"))


def audio_controls(tag: str, page) -> None:
    """해설 음성·분필 토글, 분필 기본 25%, 해설 자막(음성 칩·대본)을 확인합니다. 소리 자체는 verify_media.py 가 잰다."""
    page.evaluate("() => { const p = window.ellipticPlayer; p.pause(); p.goTo(0, { play: false }); p.setVoiceEnabled(true); p.setChalkEnabled(true); }")
    st = state(page)
    check(f"[{tag}] 해설 음성·분필 소리 기본 켬", st["voiceEnabled"] and st["chalkEnabled"], json.dumps(st)[:160])
    check(f"[{tag}] 분필 음량 기본 25% (슬라이더·표시·상태 일치)",
          st["chalkVolume"] == 25 and page.input_value("#chalk-volume") == "25" and page.inner_text("#chalk-volume-value").strip() == "25%",
          f"{st['chalkVolume']} / {page.input_value('#chalk-volume')} / {page.inner_text('#chalk-volume-value')}")
    chip = page.inner_text("#voice-chip-label")
    check(f"[{tag}] 음성 칩에 해설 음성 이름 표시", "Haena" in chip or "해나" in chip, chip)
    narration = page.evaluate("() => document.getElementById('transcript-text').textContent.trim()")
    check(f"[{tag}] 해설 대본이 화면에 있음(자막)", len(narration) > 40, narration[:40])
    # 해설 음성 토글
    page.click("#voice-toggle")
    check(f"[{tag}] 해설 음성 끄기 (aria-pressed·상태 글자·API)",
          page.get_attribute("#voice-toggle", "aria-pressed") == "false" and page.inner_text("#voice-state").strip() == "끔" and state(page)["voiceEnabled"] is False)
    page.click("#voice-toggle")
    check(f"[{tag}] 해설 음성 다시 켜기", page.get_attribute("#voice-toggle", "aria-pressed") == "true" and state(page)["voiceEnabled"] is True)
    # 분필 소리 토글
    page.click("#chalk-toggle")
    check(f"[{tag}] 분필 소리 끄기 (aria-pressed·상태 글자·API)",
          page.get_attribute("#chalk-toggle", "aria-pressed") == "false" and page.inner_text("#chalk-state").strip() == "끔" and state(page)["chalkEnabled"] is False)
    page.click("#chalk-toggle")
    check(f"[{tag}] 분필 소리 다시 켜기", page.get_attribute("#chalk-toggle", "aria-pressed") == "true" and state(page)["chalkEnabled"] is True)
    # 슬라이더
    page.evaluate("() => { const s = document.getElementById('chalk-volume'); s.value = '60'; s.dispatchEvent(new Event('input', { bubbles: true })); }")
    check(f"[{tag}] 분필 슬라이더 60% 반영", state(page)["chalkVolume"] == 60 and page.inner_text("#chalk-volume-value").strip() == "60%", page.inner_text("#chalk-volume-value"))
    page.evaluate("() => window.ellipticPlayer.setChalkVolume(25)")
    check(f"[{tag}] 분필 음량을 25%로 되돌림", state(page)["chalkVolume"] == 25 and page.inner_text("#chalk-volume-value").strip() == "25%")


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
    """가짜 시계로 자동 넘김의 시간 규칙(0.9초 간격)을 확인합니다 (실제 40초를 기다리지 않음).

    가짜 시계는 실제 오디오를 돌리지 못하므로 해설 음성을 끄고(시계=판서) 확인합니다.
    음성이 있는 실제 재생의 자동 넘김은 verify_media.py 가 맡습니다.
    """
    ctx = browser.new_context(viewport={"width": 1024, "height": 768}, offline=True, locale="ko-KR")
    page = ctx.new_page()
    w = Watcher(page)
    page.clock.install(time=0)
    page.goto(url, wait_until="load")
    page.wait_for_function("() => window.ellipticPlayer && window.ellipticPlayer.getState().ready")
    page.evaluate("() => { const p = window.ellipticPlayer; p.setVoiceEnabled(false); p.setChalkEnabled(false); }")
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
    check("[auto] 마지막 단계는 끝나면 멈춤", st["index"] == 7 and not st["playing"] and st["complete"] and st["ended"], json.dumps(st)[:140])
    page.evaluate("() => { const p = window.ellipticPlayer; p.seek(2, 0); p.setAuto(false); p.play(); }")
    page.clock.run_for(40000)
    st = state(page)
    check("[auto] 자동 넘김을 끄면 판서가 끝난 뒤 멈춤", st["index"] == 2 and not st["playing"] and st["complete"], json.dumps(st)[:140])
    check("[auto] 멈춘 상태 문구가 '판서 중'이 아니라 완료를 알림", "판서 중" not in page.inner_text("#status") and "완료" in page.inner_text("#status"), page.inner_text("#status"))
    # 다시 켜면 완료된 마지막 상태에서 이어서 넘어간다
    page.evaluate("() => window.ellipticPlayer.setAuto(true)")
    page.clock.run_for(2000)
    st = state(page)
    check("[auto] 자동 넘김을 다시 켜면 완료된 단계에서 이어서 다음 단계로", st["index"] == 3 and st["auto"] and st["playing"], json.dumps(st)[:140])

    # 0.9초 간격: 판서가 끝나고 0.9초가 지나기 전에는 넘어가지 않고, 지난 뒤에는 넘어간다
    page.evaluate("() => { const p = window.ellipticPlayer; p.seek(0, 0); p.setAuto(true); p.setSpeed(1); p.play(); }")
    anim_end = state(page)["animEnd"]
    page.clock.run_for(int(anim_end * 1000) + 300)
    st = state(page)
    check("[auto] 판서 완료 직후(0.3초)에는 아직 같은 단계", st["index"] == 0 and st["drawDone"] and st["complete"], json.dumps(st)[:160])
    check("[auto] 그 사이 상태 문구는 완료·다음 단계 안내(판서 중 아님)", "판서 중" not in page.inner_text("#status") and "다음 단계" in page.inner_text("#status"), page.inner_text("#status"))
    check("[auto] 대기 시간(hold)이 0.9초 미만", 0.2 < st["hold"] < 0.9, str(st["hold"]))
    page.clock.run_for(800)
    st = state(page)
    check("[auto] 0.9초 뒤에는 다음 단계로 넘어가 재생", st["index"] == 1 and st["playing"], json.dumps(st)[:160])

    # 긴 프레임 지연(탭 지연·렌더 지연)이 시계에서 사라지지 않는다 — 시계는 rAF 타임스탬프 기준
    page.evaluate("() => { const p = window.ellipticPlayer; p.seek(0, 0); p.setAuto(true); p.setSpeed(1); p.play(); }")
    page.clock.run_for(1000)
    t_a = state(page)["t"]
    page.clock.run_for(2000)
    t_b = state(page)["t"]
    check("[auto] 재생 시간이 실제 경과와 같은 속도로 흐름 (2초 → 약 2초)", 1.7 <= t_b - t_a <= 2.3, f"{t_a}->{t_b}")
    check("[auto] 오류 없음", not w.errors, "; ".join(w.errors)[:200])
    ctx.close()


def reduced_motion(browser, url: str, art: Path) -> None:
    """줄어든 동작: 완성된 칠판을 보여 주고, 해설이 켜져 있으면 소리만 재생합니다(실제 오디오는 verify_media.py)."""
    ctx, page, w = open_page(browser, url, 1024, 768, reduced=True)
    st = state(page)
    check("[reduced] 줄어든 동작 감지", st["reduced"] is True)
    check("[reduced] 시작부터 완성된 칠판 (판서 끝·재생 안 함)", st["drawDone"] and not st["playing"] and ink(page) > 1.0, json.dumps(st)[:140])
    check("[reduced] 안내 문구 표시", page.is_visible("#reduced-note"))
    check("[reduced] 해설이 켜져 있어 자동 넘김 사용 가능", st["voiceEnabled"] and st["autoAvailable"] and st["auto"], json.dumps(st)[:160])
    check("[reduced] 재생 버튼 이름 '이 단계 재생' (해설을 들려 줌)", page.inner_text("#play-label") == "이 단계 재생", page.inner_text("#play-label"))
    check("[reduced] 시작 안내 오버레이 숨김", not page.is_visible("#board-hint"))
    page.click("#play")
    page.wait_for_timeout(900)
    st = state(page)
    check("[reduced] 재생하면 같은 단계에서 해설이 재생되고 판서 애니메이션은 없음", st["index"] == 0 and st["playing"] and st["drawDone"] and st["audioTime"] > 0.3, json.dumps(st)[:180])
    check("[reduced] 해설 중 상태 문구는 '판서 중'이 아님", "판서 중" not in page.inner_text("#status"), page.inner_text("#status"))
    page.click("#play")  # 일시정지
    check("[reduced] 일시정지하면 멈춤", not state(page)["playing"])

    # 해설을 끈 줄어든 동작: 자동 넘김은 쓸 수 없고, 버튼이 정직하게 '다음 단계 보기'가 된다
    page.click("#voice-toggle")
    st = state(page)
    check("[reduced] 해설을 끄면 자동 넘김 사용 불가", st["voiceEnabled"] is False and st["autoAvailable"] is False, json.dumps(st)[:160])
    check("[reduced] 자동 넘김 버튼이 aria-disabled 와 '불가'로 표시", page.get_attribute("#auto-toggle", "aria-disabled") == "true" and "불가" in page.inner_text("#auto-state"), page.inner_text("#auto-state"))
    check("[reduced] 재생 버튼 이름 '다음 단계 보기'", page.inner_text("#play-label") == "다음 단계 보기", page.inner_text("#play-label"))
    page.evaluate("() => window.ellipticPlayer.goTo(0)")
    page.click("#play")
    st = state(page)
    check("[reduced] 재생 버튼은 다음 단계를 완성된 모습으로 보여 줌", st["index"] == 1 and st["drawDone"] and not st["playing"], json.dumps(st)[:140])
    for i in range(8):
        page.evaluate("([i]) => window.ellipticPlayer.goTo(i)", [i])
        st = state(page)
        if not (st["complete"] and not st["playing"] and ink(page) > 1.0):
            check(f"[reduced] {i + 1}단계 정적 표시", False, json.dumps(st)[:140])
            break
    else:
        check("[reduced] 8단계 모두 정적으로 완성 표시(음성 끔)", True)
    page.evaluate("() => window.ellipticPlayer.goTo(3)")
    page.screenshot(path=str(art / "reduced-step4-full.png"), full_page=True)
    page.keyboard.press("Space")
    st = state(page)
    check("[reduced] 스페이스 바도 애니메이션을 시작하지 않음(다음 단계 보기)", not st["playing"] and st["index"] == 4, json.dumps(st)[:140])
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
                audio_controls(tag, page)
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
