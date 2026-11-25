#!/usr/bin/env python3
"""양자물리학 칠판 강의(quantum-physics.html) 브라우저 검증.

Playwright + 시스템 Chrome 으로 다음을 확인합니다.
  * 1440x900, 1024x768, 390x844 화면, 줄어든 동작(prefers-reduced-motion), 오프라인(file:// + 네트워크 차단)
  * 페이지 오류/콘솔 오류 없음, 가로 넘침 없음, 외부 요청 없음
  * 단계마다 캔버스가 비어 있지 않고, 배치 경고(layoutReport)가 없고, graph 보드에는 그래프 좌표계가 있으며
    equalAspect 보드는 가로·세로 배율이 같음
  * 단계 태그(개념/실험/유도/응용/열린 문제) 표시, 글꼴 두 개(NanumPenScript + QMath)가 내장 글꼴로 로드됨
  * 재생/일시정지/이전/다음/키보드/해시/자동 넘김/속도 조작
  * 해설 음성·분필 소리 토글, 분필 음량 기본 25%, 해설 자막(음성 칩·대본) 표시
  * 자동 넘김: 해설이 끝난 뒤 0.9초 간격을 두고 넘어가며, 끄면 완료 상태에서 멈추고 다시 켜면 이어서 넘어감
  * 줄어든 동작: 완성된 칠판 + 해설 재생, 해설을 끈 경우 '다음 단계 보기'와 자동 넘김 불가 표시
  * 화면에 서식 토큰(^{ }, _{ }, [[ ]])이 남지 않음, 푸터 작성자 "Microsoft Korea STU", window.quantumPlayer 노출

실제 소리가 나오는 재생·수명주기 검증은 verify_media.py, 분필 소리 신호 검증은 verify_chalk.py 가 맡습니다.
이 파일의 가짜 시계 시험은 해설 음성을 끄고(시계는 오디오가 아니라 판서) 자동 넘김의 시간 규칙을 봅니다.

스크린샷과 report.json 은 --artifacts 폴더(저장소 밖)에 저장합니다.
사용법:
  python3 verify_browser.py --artifacts /tmp/qp-verify                # 실제 내용 (quantum-physics.html 이 없으면 시험 빌드)
  python3 verify_browser.py --artifacts /tmp/qp-verify --fixture      # 시험 내용(보드 종류별 1단계)
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import sync_playwright

from verify_common import add_common_args, launch, player, prepare

VIEWPORTS = [("1440", 1440, 900), ("1024", 1024, 768), ("390", 390, 844)]
TONE_LABELS = {"concept": "개념", "experiment": "실험", "math": "유도", "apply": "응용", "open": "열린 문제"}
results: list[dict] = []


def check(name: str, ok: bool, detail: str = "") -> bool:
    results.append({"name": name, "ok": bool(ok), "detail": detail})
    print(("  PASS " if ok else "  FAIL ") + name + (f"  [{detail}]" if detail and not ok else ""))
    return bool(ok)


def ev(page, script: str, arg=None):
    return page.evaluate(player(script), arg)


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
    return ev(page, "() => $P.getState()")


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
    page.wait_for_function(player("() => window.quantumPlayer && window.quantumPlayer.getState().ready"))
    page.evaluate("() => document.fonts.ready")
    page.wait_for_timeout(250)
    return ctx, page, watcher


def common_checks(tag: str, page, watcher: Watcher, width: int) -> None:
    check(f"[{tag}] window.quantumPlayer 노출", page.evaluate("() => typeof window.quantumPlayer === 'object' && typeof window.quantumPlayer.goTo === 'function'"))
    over = page.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
    check(f"[{tag}] 가로 넘침 없음", over <= 1, f"overflow={over}")
    cw = page.evaluate("() => { const c = document.getElementById('board'); const r = c.getBoundingClientRect(); return [r.left, r.right, window.innerWidth]; }")
    check(f"[{tag}] 캔버스가 화면 안에 있음", cw[0] >= -0.5 and cw[1] <= cw[2] + 0.5, str(cw))
    # 글꼴 상태는 크기 변경(전체 화면 스크린샷 등) 뒤 브라우저가 비웠다가 다시 읽을 수 있으므로, 불러오기를 요청한 뒤 확인한다.
    page.evaluate("() => Promise.all([document.fonts.load('30px NanumPenScript', '가나다 xy'), document.fonts.load('30px QMath', 'ψħλ∫√')])")
    check(f"[{tag}] 내장 손글씨 글꼴(NanumPenScript) 로드(오프라인)", page.evaluate("() => document.fonts.check('30px NanumPenScript', '가나다 xy 123')"))
    check(f"[{tag}] 내장 수학 글꼴(QMath) 로드(오프라인)", page.evaluate("() => document.fonts.check('30px QMath', 'ψħλ∫√')"))
    loaded = page.evaluate("() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/\"/g, ''))")
    check(f"[{tag}] 두 글꼴이 실제로 내려받아져(loaded) 있음", "NanumPenScript" in loaded and "QMath" in loaded, str(loaded))
    leak = page.evaluate("() => /\\^\\{|_\\{|\\[\\[|\\*\\*/.test(document.body.innerText)")
    check(f"[{tag}] 화면에 서식 토큰이 남지 않음", not leak)
    footer = page.evaluate("() => (document.querySelector('footer') || {}).innerText || ''")
    check(f"[{tag}] 푸터 작성자 Microsoft Korea STU", "Microsoft Korea STU" in footer, footer[:80])
    check(f"[{tag}] 푸터에 AI 합성 음성 공시", "AI 합성" in footer, footer[:200])


def per_step(tag: str, page, art: Path, shots: bool, expect: int) -> None:
    ids = page.evaluate(player("() => window.quantumPlayer.steps"))
    check(f"[{tag}] 단계 {expect}개", len(ids) == expect, str(ids))
    data = page.evaluate("() => window.LESSON_DATA.steps.map((s) => ({id: s.id, kind: s.board.kind, equal: !!s.board.equalAspect, tone: s.tag.tone, tagText: s.tag.text, beats: s.beats.length}))")
    report = ev(page, "() => $P.layoutReport()")
    check(f"[{tag}] layoutReport: 단계 수·칠판 폭 일치, 경고 없음", len(report["steps"]) == len(ids) and report["width"] > 200 and not report["warnings"], f"{len(report['steps'])} / {report['width']} / {report['warnings']}")
    kinds_seen: set[str] = set()
    for i, sid in enumerate(ids):
        ev(page, "([i]) => $P.seek(i, 'end')", [i])
        page.wait_for_timeout(120)
        st = state(page)
        d = data[i]
        kinds_seen.add(st["kind"])
        pct = ink(page)
        label = f"[{tag}] {i + 1}단계 {sid}({st['kind']})"
        check(f"{label}: 캔버스가 비어 있지 않음", pct > 1.0, f"ink={pct:.2f}%")
        # seek 는 정지 화면을 만들므로 판서가 끝난 상태이고, 해설은 아직 시작 전이라 '완료'(판서+음성)는 아니다
        check(f"{label}: 판서 끝 상태·재생 멈춤·소리 없음", st["drawDone"] and not st["playing"] and st["audioTime"] == 0, json.dumps(st)[:160])
        check(f"{label}: 배치 경고 없음", not st["warnings"], json.dumps(st["warnings"], ensure_ascii=False))
        if st["kind"] == "graph":
            check(f"{label}: 그래프 좌표계(plot)가 있고 캔버스 안", bool(st["plot"]) and st["plot"]["xPxPerUnit"] > 0 and st["plot"]["yPxPerUnit"] > 0 and st["plot"]["rect"]["x"] >= 0 and st["plot"]["rect"]["y"] >= 0, json.dumps(st["plot"])[:160])
            if d["equal"]:
                px, py = st["plot"]["xPxPerUnit"], st["plot"]["yPxPerUnit"]
                check(f"{label}: equalAspect — 가로·세로 배율이 같음", abs(px - py) < 1e-9, f"x={px} y={py}")
        else:
            check(f"{label}: graph 가 아닌 보드에는 plot 이 없음", st["plot"] is None, str(st["plot"]))
        # 태그: 개념/실험/유도/응용/열린 문제 + 단계 태그 글
        tag_label = page.inner_text("#board-tag").strip()
        tag_text = page.inner_text("#board-tag-text").strip()
        check(f"{label}: 태그 '{TONE_LABELS[d['tone']]}' + 설명 표시", tag_label == TONE_LABELS[d["tone"]] and len(tag_text) > 0, f"{tag_label} / {tag_text}")
        n_beats = page.evaluate("() => document.querySelectorAll('#beats li').length")
        check(f"{label}: 설명 구절 {d['beats']}개 표시", n_beats == d["beats"], str(n_beats))
        sr = page.evaluate("() => (document.getElementById('board-sr') || {}).textContent || ''")
        check(f"{label}: 스크린리더용 설명(alt)이 있음", len(sr.strip()) >= 20, sr[:40])
        if shots:
            page.screenshot(path=str(art / f"{tag}-step{i + 1:02d}-{sid}-full.png"), full_page=True)
            page.locator("#board-stage").screenshot(path=str(art / f"{tag}-step{i + 1:02d}-{sid}-board.png"))
    check(f"[{tag}] 보드 종류 {sorted(kinds_seen)} (graph 포함)", "graph" in kinds_seen, str(kinds_seen))


def mid_frames(tag: str, page, art: Path, expect: int) -> None:
    for i in [k for k in (1, 3, 5, 6) if k < expect]:
        ev(page, "([i]) => { const p = $P; p.seek(i, 0); const end = p.getState().animEnd; p.seek(i, end * 0.45); }", [i])
        page.wait_for_timeout(100)
        st = state(page)
        check(f"[{tag}] {i + 1}단계 중간 프레임(t={st['t']}): 분필이 그리는 중", 0 < st["t"] < st["animEnd"] and not st["drawDone"] and not st["complete"])
        page.locator("#board-stage").screenshot(path=str(art / f"{tag}-step{i + 1:02d}-mid.png"))


def audio_controls(tag: str, page) -> None:
    """해설 음성·분필 토글, 분필 기본 25%, 해설 자막(음성 칩·대본)을 확인합니다. 소리 자체는 verify_media.py 가 잰다."""
    ev(page, "() => { const p = $P; p.pause(); p.goTo(0, { play: false }); p.setVoiceEnabled(true); p.setChalkEnabled(true); }")
    st = state(page)
    check(f"[{tag}] 해설 음성·분필 소리 기본 켬", st["voiceEnabled"] and st["chalkEnabled"], json.dumps(st)[:160])
    check(f"[{tag}] 분필 음량 기본 25% (슬라이더·표시·상태 일치)",
          st["chalkVolume"] == 25 and page.input_value("#chalk-volume") == "25" and page.inner_text("#chalk-volume-value").strip() == "25%",
          f"{st['chalkVolume']} / {page.input_value('#chalk-volume')} / {page.inner_text('#chalk-volume-value')}")
    chip = page.inner_text("#voice-chip-label")
    check(f"[{tag}] 음성 칩에 해설 음성 이름 표시", "Haena" in chip or "해나" in chip, chip)
    narration = page.evaluate("() => document.getElementById('transcript-text').textContent.trim()")
    check(f"[{tag}] 해설 대본이 화면에 있음(자막)", len(narration) > 40, narration[:40])
    page.click("#voice-toggle")
    check(f"[{tag}] 해설 음성 끄기 (aria-pressed·상태 글자·API)",
          page.get_attribute("#voice-toggle", "aria-pressed") == "false" and page.inner_text("#voice-state").strip() == "끔" and state(page)["voiceEnabled"] is False)
    page.click("#voice-toggle")
    check(f"[{tag}] 해설 음성 다시 켜기", page.get_attribute("#voice-toggle", "aria-pressed") == "true" and state(page)["voiceEnabled"] is True)
    page.click("#chalk-toggle")
    check(f"[{tag}] 분필 소리 끄기 (aria-pressed·상태 글자·API)",
          page.get_attribute("#chalk-toggle", "aria-pressed") == "false" and page.inner_text("#chalk-state").strip() == "끔" and state(page)["chalkEnabled"] is False)
    page.click("#chalk-toggle")
    check(f"[{tag}] 분필 소리 다시 켜기", page.get_attribute("#chalk-toggle", "aria-pressed") == "true" and state(page)["chalkEnabled"] is True)
    page.evaluate("() => { const s = document.getElementById('chalk-volume'); s.value = '60'; s.dispatchEvent(new Event('input', { bubbles: true })); }")
    check(f"[{tag}] 분필 슬라이더 60% 반영", state(page)["chalkVolume"] == 60 and page.inner_text("#chalk-volume-value").strip() == "60%", page.inner_text("#chalk-volume-value"))
    ev(page, "() => $P.setChalkVolume(25)")
    check(f"[{tag}] 분필 음량을 25%로 되돌림", state(page)["chalkVolume"] == 25 and page.inner_text("#chalk-volume-value").strip() == "25%")


def interactions(tag: str, page, expect: int) -> None:
    hash_n = min(7, expect)
    key_n = min(5, expect)
    page.evaluate("() => { window.location.hash = ''; }")
    ev(page, "() => { $P.pause(); $P.goTo(0, { play: false }); $P.seek(0, 0); }")
    page.click("#play")
    page.wait_for_timeout(1300)
    st = state(page)
    check(f"[{tag}] 재생 버튼: 재생 시작", st["playing"] and st["t"] > 0.5, json.dumps(st)[:140])
    check(f"[{tag}] 재생 중 버튼 이름 '일시정지'", page.inner_text("#play-label") == "일시정지", page.inner_text("#play-label"))
    page.click("#play")
    t1 = state(page)["t"]
    page.wait_for_timeout(400)
    st = state(page)
    check(f"[{tag}] 일시정지 후 시간이 멈춤", (not st["playing"]) and abs(st["t"] - t1) < 0.05, f"{t1}->{st['t']}")
    check(f"[{tag}] 일시정지 후 버튼 이름 '이어서 재생'", page.inner_text("#play-label") == "이어서 재생", page.inner_text("#play-label"))
    page.click("#next")
    check(f"[{tag}] 다음 단계 버튼", state(page)["index"] == 1)
    page.click("#prev")
    check(f"[{tag}] 이전 단계 버튼", state(page)["index"] == 0)
    page.keyboard.press("ArrowRight")
    check(f"[{tag}] → 키", state(page)["index"] == 1)
    page.keyboard.press("ArrowLeft")
    check(f"[{tag}] ← 키", state(page)["index"] == 0)
    page.keyboard.press(str(key_n))
    check(f"[{tag}] 숫자 키 {key_n}", state(page)["index"] == key_n - 1)
    page.evaluate("(n) => { window.location.hash = '#' + n; }", hash_n)
    page.wait_for_timeout(150)
    check(f"[{tag}] #{hash_n} 해시 이동", state(page)["index"] == hash_n - 1)
    page.click("#chapters li:nth-child(2) button")
    check(f"[{tag}] 단계 목록 버튼", state(page)["index"] == 1)
    cur = page.evaluate("() => { const e = document.querySelector('#chapters [aria-current]'); return e ? e.innerText : ''; }")
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


def auto_advance(browser, url: str, expect: int) -> None:
    """가짜 시계로 자동 넘김의 시간 규칙(0.9초 간격)을 확인합니다 (실제 1분을 기다리지 않음).

    가짜 시계는 실제 오디오를 돌리지 못하므로 해설 음성을 끄고(시계=판서) 확인합니다.
    음성이 있는 실제 재생의 자동 넘김은 verify_media.py 가 맡습니다.
    """
    last = expect - 1
    mid = min(3, last - 1)
    ctx = browser.new_context(viewport={"width": 1024, "height": 768}, offline=True, locale="ko-KR")
    page = ctx.new_page()
    w = Watcher(page)
    page.clock.install(time=0)
    page.goto(url, wait_until="load")
    page.wait_for_function(player("() => window.quantumPlayer && window.quantumPlayer.getState().ready"))
    ev(page, "() => { const p = $P; p.setVoiceEnabled(false); p.setChalkEnabled(false); }")
    ev(page, "([i]) => { const p = $P; p.seek(i, 0); p.setAuto(true); p.setSpeed(1.5); }", [mid])
    ev(page, "() => $P.play()")
    page.clock.run_for(2000)
    st = state(page)
    check(f"[auto] {mid + 1}단계 재생 중 (가짜 시계)", st["index"] == mid and st["playing"] and st["t"] > 0.5, json.dumps(st)[:140])
    page.clock.run_for(70000)
    st = state(page)
    check("[auto] 충분히 기다리면 다음 단계로 넘어감", st["index"] > mid and st["started"], json.dumps(st)[:140])
    ev(page, "([i]) => { const p = $P; p.seek(i, 0); p.setAuto(true); p.play(); }", [last])
    page.clock.run_for(110000)
    st = state(page)
    check("[auto] 마지막 단계는 끝나면 멈춤", st["index"] == last and not st["playing"] and st["complete"] and st["ended"], json.dumps(st)[:140])
    ev(page, "() => { const p = $P; p.seek(2, 0); p.setAuto(false); p.play(); }")
    page.clock.run_for(70000)
    st = state(page)
    check("[auto] 자동 넘김을 끄면 판서가 끝난 뒤 멈춤", st["index"] == 2 and not st["playing"] and st["complete"], json.dumps(st)[:140])
    status = page.inner_text("#status")
    check("[auto] 멈춘 상태 문구가 '판서 중'이 아님", "판서 중" not in status, status)
    ev(page, "() => $P.setAuto(true)")
    page.clock.run_for(2000)
    st = state(page)
    check("[auto] 자동 넘김을 다시 켜면 완료된 단계에서 이어서 다음 단계로", st["index"] == 3 and st["auto"] and st["playing"], json.dumps(st)[:140])

    # 0.9초 간격: 판서가 끝나고 0.9초가 지나기 전에는 넘어가지 않고, 지난 뒤에는 넘어간다
    ev(page, "() => { const p = $P; p.seek(0, 0); p.setAuto(true); p.setSpeed(1); p.play(); }")
    anim_end = state(page)["animEnd"]
    page.clock.run_for(int(anim_end * 1000) + 300)
    st = state(page)
    check("[auto] 판서 완료 직후(0.3초)에는 아직 같은 단계", st["index"] == 0 and st["drawDone"], json.dumps(st)[:160])
    page.clock.run_for(800)
    st = state(page)
    check("[auto] 0.9초 뒤에는 다음 단계로 넘어가 재생", st["index"] == 1 and st["playing"], json.dumps(st)[:160])

    ev(page, "() => { const p = $P; p.seek(0, 0); p.setAuto(true); p.setSpeed(1); p.play(); }")
    page.clock.run_for(1000)
    t_a = state(page)["t"]
    page.clock.run_for(2000)
    t_b = state(page)["t"]
    check("[auto] 재생 시간이 실제 경과와 같은 속도로 흐름 (2초 → 약 2초)", 1.7 <= t_b - t_a <= 2.3, f"{t_a}->{t_b}")
    check("[auto] 오류 없음", not w.errors, "; ".join(w.errors)[:200])
    ctx.close()


def font_reload(browser, url: str) -> None:
    """브라우저가 내장 글꼴(QMath)을 도중에 비워도(전체 화면 스크린샷이 이를 일으킴) 칠판이 새 글꼴로 다시 그려지는지 확인합니다."""
    ctx, page, w = open_page(browser, url, 1440, 900)
    ev(page, "() => $P.seek(0, 'end')")
    page.screenshot(full_page=True)
    page.wait_for_timeout(700)
    status = page.evaluate("() => [...document.fonts].filter((f) => f.family.includes('QMath')).map((f) => f.status)")
    check("[font] 글꼴이 비워졌다가도 다시 읽어 들임(QMath loaded)", status == ["loaded"], str(status))
    check("[font] 오류 없음", not w.errors, "; ".join(w.errors)[:200])
    ctx.close()


def reduced_motion(browser, url: str, art: Path, expect: int) -> None:
    """줄어든 동작: 완성된 칠판을 보여 주고, 해설이 켜져 있으면 소리만 재생합니다(실제 오디오는 verify_media.py)."""
    ctx, page, w = open_page(browser, url, 1024, 768, reduced=True)
    st = state(page)
    check("[reduced] 줄어든 동작 감지", st["reduced"] is True)
    check("[reduced] 시작부터 완성된 칠판 (판서 끝·재생 안 함)", st["drawDone"] and not st["playing"] and ink(page) > 1.0, json.dumps(st)[:140])
    check("[reduced] 안내 문구 표시", page.is_visible("#reduced-note"))
    check("[reduced] 해설이 켜져 있어 자동 넘김 사용 가능", st["voiceEnabled"] and st["autoAvailable"] and st["auto"], json.dumps(st)[:160])
    check("[reduced] 시작 안내 오버레이 숨김", not page.is_visible("#board-hint"))
    page.click("#play")
    page.wait_for_timeout(900)
    st = state(page)
    check("[reduced] 재생하면 같은 단계에서 해설이 재생되고 판서 애니메이션은 없음", st["index"] == 0 and st["playing"] and st["drawDone"], json.dumps(st)[:180])
    page.click("#play")  # 일시정지
    check("[reduced] 일시정지하면 멈춤", not state(page)["playing"])

    page.click("#voice-toggle")
    st = state(page)
    check("[reduced] 해설을 끄면 자동 넘김 사용 불가", st["voiceEnabled"] is False and st["autoAvailable"] is False, json.dumps(st)[:160])
    check("[reduced] 자동 넘김 버튼이 aria-disabled 와 '불가'로 표시", page.get_attribute("#auto-toggle", "aria-disabled") == "true" and "불가" in page.inner_text("#auto-state"), page.inner_text("#auto-state"))
    check("[reduced] 재생 버튼 이름 '다음 단계 보기'", page.inner_text("#play-label") == "다음 단계 보기", page.inner_text("#play-label"))
    ev(page, "() => $P.goTo(0)")
    page.click("#play")
    st = state(page)
    check("[reduced] 재생 버튼은 다음 단계를 완성된 모습으로 보여 줌", st["index"] == 1 and st["drawDone"] and not st["playing"], json.dumps(st)[:140])
    bad = None
    for i in range(expect):
        ev(page, "([i]) => $P.goTo(i)", [i])
        st = state(page)
        if not (st["drawDone"] and not st["playing"] and ink(page) > 1.0):
            bad = (i, json.dumps(st)[:140])
            break
    check(f"[reduced] {expect}단계 모두 정적으로 완성 표시(음성 끔)", bad is None, str(bad))
    ev(page, "([i]) => $P.goTo(i)", [min(3, expect - 1)])
    page.screenshot(path=str(art / "reduced-step04-full.png"), full_page=True)
    check("[reduced] 오류 없음", not w.errors, "; ".join(w.errors)[:200])
    ctx.close()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    add_common_args(ap)
    ap.add_argument("--no-shots", action="store_true", help="스크린샷을 저장하지 않음")
    args = ap.parse_args()

    prep = prepare(args, "qp-verify-")
    if prep is None:
        return 2
    art, html, expect = prep
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
                per_step(tag, page, art, not args.no_shots, expect)
                if tag != "390":
                    mid_frames(tag, page, art, expect)
                interactions(tag, page, expect)
                audio_controls(tag, page)
                check(f"[{tag}] 페이지·콘솔 오류 없음", not watcher.errors, "; ".join(watcher.errors)[:300])
                check(f"[{tag}] 외부 요청 없음", not watcher.external, ", ".join(watcher.external)[:300])
                ctx.close()
            print("\n== 줄어든 동작 ==")
            reduced_motion(browser, url, art, expect)
            print("\n== 글꼴 다시 읽기 ==")
            font_reload(browser, url)
            print("\n== 자동 넘김 (가짜 시계) ==")
            auto_advance(browser, url, expect)
        finally:
            browser.close()

    failed = [r for r in results if not r["ok"]]
    (art / "report.json").write_text(json.dumps({"html": str(html), "total": len(results), "failed": len(failed), "results": results}, ensure_ascii=False, indent=2), encoding="utf-8")
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
