#!/usr/bin/env python3
"""손자병법 칠판 강의(art-of-war.html) 브라우저 검증.

Playwright + 시스템 Chrome으로 다음을 확인합니다.
  * 1280x720, 1024x768, 390x844 화면, 줄어든 동작(prefers-reduced-motion), 오프라인(file:// + 네트워크 차단)
  * 페이지 오류/콘솔 오류 없음, 가로 넘침 없음, 외부 요청 없음, 화면 글자 크기 14px 이상
  * 모든 칠판 종류(diagram·timeline·ladder·radial·table·compare)가 비어 있지 않게 그려지고,
    칠판 글에 쓰인 한자가 실제로 Canvas 에 그려지며(fillText 기록), 내장 글꼴(ChalkKorean·ChalkHanja)이 로드됨
  * 단계마다 한 장 요약(digest 3~4장)·장 제목·인용 카드·설명 구절·대체 설명(alt)이 소리 없이도 보임, 배치 경고 없음
  * 넓은 화면은 칠판 왼쪽 + 글 오른쪽, 좁은 화면은 위아래로 쌓기
  * 장 목록(부별 묶음, 현재 단계 표시, 진행 막대), 재생/일시정지/이전/다음/키보드/해시/속도/자동 넘김
  * 퀴즈(6문항): 즉시 피드백, 점수, 다시 풀기, 해당 편으로 이동 / 오해 / 참고 문헌
  * 자동 넘김: 완료(판서+해설) 뒤 0.9초 간격을 두고 넘어가며, 끄면 멈추고 다시 켜면 이어서 넘어감 (가짜 시계, 해설 끔)
  * 줄어든 동작: 완성된 칠판

해설 음성이 내장된 빌드(node build.mjs)는 음성 토글·분필 25%·줄어든 동작의 해설 재생까지 확인하고,
개발용 빌드(--no-audio)는 음성 없는 동작(자동 넘김 불가 표시 등)을 확인합니다. 실제 소리 신호는 verify_media.py,
verify_chalk.py 가 맡습니다.

사용법:
  python3 verify_browser.py --artifacts /tmp/aow-verify                 # art-of-war.html
  python3 verify_browser.py --artifacts /tmp/aow-verify --fixture       # 시험용 내용으로 빌드해서 검증
  python3 verify_browser.py --artifacts /tmp/aow-verify --html FILE     # 다른 HTML
스크린샷과 report.json 은 --artifacts 폴더(저장소 밖 경로 권장)에 저장합니다.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
VIEWPORTS = [("1280", 1280, 720), ("1024", 1024, 768), ("390", 390, 844)]
CHROME_PATHS = ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"]
# 실제 브라우저처럼 '사용자 동작이 있어야 소리를 낼 수 있음' 정책을 지킨다(버튼 클릭으로만 재생).
LAUNCH_ARGS = ["--no-sandbox", "--autoplay-policy=document-user-activation-required"]
BOARD_KINDS = ["diagram", "timeline", "ladder", "radial", "table", "compare"]
HAN_RE = r"\p{Script=Han}"

results: list[dict] = []
# 칠판 밖으로 나가는 글·글이 넘치는 상자는 실패, 겹침 경고(안내용)는 요약만 보여 줍니다.
HARD_KINDS = {"text-out-of-bounds", "node-overflow", "panel-overflow"}
soft_notes: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> bool:
    results.append({"name": name, "ok": bool(ok), "detail": detail})
    print(("  PASS " if ok else "  FAIL ") + name + (f"  [{detail}]" if detail and not ok else ""))
    return bool(ok)


def skip(name: str, why: str) -> None:
    print(f"  SKIP {name}  [{why}]")


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


# Canvas 에 그려진 글을 기록합니다(한자가 실제로 그려졌는지 확인). 페이지 코드보다 먼저 실행됩니다.
RECORD_TEXT_JS = """
(() => {
  window.__drawn = [];
  const rec = (kind) => function (text, x, y) {
    try { window.__drawn.push([String(text), this.font, kind]); } catch (e) {}
    return kind === 'fill' ? origFill.apply(this, arguments) : origStroke.apply(this, arguments);
  };
  const proto = CanvasRenderingContext2D.prototype;
  const origFill = proto.fillText;
  const origStroke = proto.strokeText;
  proto.fillText = rec('fill');
  proto.strokeText = rec('stroke');
})();
"""


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
    return page.evaluate("() => window.artOfWarPlayer.getState()")


def open_page(browser, url: str, width: int, height: int, *, reduced: bool = False, offline: bool = True):
    ctx = browser.new_context(
        viewport={"width": width, "height": height},
        device_scale_factor=1,
        reduced_motion="reduce" if reduced else "no-preference",
        offline=offline,
        locale="ko-KR",
    )
    ctx.add_init_script(RECORD_TEXT_JS)
    page = ctx.new_page()
    watcher = Watcher(page)
    page.goto(url, wait_until="load")
    page.wait_for_function("() => window.artOfWarPlayer && window.artOfWarPlayer.getState().ready")
    page.evaluate("() => document.fonts.ready")
    page.wait_for_timeout(250)
    return ctx, page, watcher


def small_fonts(page) -> list:
    """보이는 글자 중 14px 미만인 것."""
    return page.evaluate(
        """() => {
          const out = [];
          for (const el of document.querySelectorAll('body *')) {
            if (!el.childNodes.length) continue;
            const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
            if (!own) continue;
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') continue;
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            if (el.closest('.sr-only')) continue;
            const fs = parseFloat(cs.fontSize);
            if (fs < 14) out.push([el.tagName + '.' + el.className + '#' + el.id, fs, el.textContent.trim().slice(0, 20)]);
          }
          return out;
        }"""
    )


def common_checks(tag: str, page, watcher: Watcher, expect_wide: bool | None) -> None:
    check(f"[{tag}] window.artOfWarPlayer 노출", page.evaluate("() => typeof window.artOfWarPlayer === 'object' && typeof window.artOfWarPlayer.goTo === 'function' && typeof window.artOfWarPlayer.layoutReport === 'function'"))
    over = page.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
    check(f"[{tag}] 가로 넘침 없음", over <= 1, f"overflow={over}")
    cw = page.evaluate("() => { const c = document.getElementById('board'); const r = c.getBoundingClientRect(); return [r.left, r.right, window.innerWidth]; }")
    check(f"[{tag}] 캔버스가 화면 안에 있음", cw[0] >= -0.5 and cw[1] <= cw[2] + 0.5, str(cw))
    check(f"[{tag}] 내장 손글씨 글꼴(ChalkKorean) 로드(오프라인)", page.evaluate("() => document.fonts.check('30px ChalkKorean', '가나다')"))
    face = page.evaluate(
        """async () => {
          await Promise.all([document.fonts.load('30px ChalkKorean', '가나다'), document.fonts.load('30px ChalkHanja', '孫子兵法')]);
          return [...document.fonts].filter((f) => f.family.includes('Chalk')).map((f) => f.family + ':' + f.status);
        }"""
    )
    check(f"[{tag}] 내장 글꼴 두 개(ChalkKorean·ChalkHanja)가 loaded", sorted(face) == ["ChalkHanja:loaded", "ChalkKorean:loaded"], str(face))
    footer = page.evaluate("() => (document.querySelector('footer') || {}).innerText || ''")
    check(f"[{tag}] 푸터 작성자 Microsoft Korea STU", "Microsoft Korea STU" in footer, footer[:80])
    small = small_fonts(page)
    check(f"[{tag}] 화면의 모든 글자가 14px 이상", not small, str(small[:5]))
    st = state(page)
    if expect_wide is not None:
        check(f"[{tag}] 칠판 배치가 {'넓은(왼쪽 칠판 + 오른쪽 글)' if expect_wide else '좁은(위아래 쌓기)'} 틀", st["canvas"]["wide"] is expect_wide, json.dumps(st["canvas"]))
    check(f"[{tag}] 페이지·콘솔 오류 없음", not watcher.errors, "; ".join(watcher.errors)[:300])
    check(f"[{tag}] 외부 요청 없음", not watcher.external, ", ".join(watcher.external)[:300])


def hanja_expected(page, i: int) -> list[str]:
    """단계 i 의 칠판에 쓰인 한자(board + han + panel)."""
    return page.evaluate(
        """([i]) => {
          const st = window.LESSON_DATA.steps[i];
          const text = JSON.stringify([st.board, st.han, st.panel]);
          return [...new Set(text.match(/\\p{Script=Han}/gu) || [])];
        }""",
        [i],
    )


def per_step(tag: str, page, art: Path, shots: bool, expect_count: int) -> None:
    ids = page.evaluate("() => window.artOfWarPlayer.steps")
    check(f"[{tag}] 단계 {expect_count}개", len(ids) == expect_count, str(ids))
    kinds_seen: set[str] = set()
    total_han = [0]
    report = page.evaluate("() => window.artOfWarPlayer.layoutReport()")
    check(f"[{tag}] layoutReport: 단계 수·칠판 폭 일치", len(report["steps"]) == len(ids) and report["width"] > 200, f"{len(report['steps'])} / {report['width']}")
    for i, sid in enumerate(ids):
        page.evaluate("() => { window.__drawn = []; }")
        page.evaluate("([i]) => window.artOfWarPlayer.seek(i, 'end')", [i])
        page.wait_for_timeout(140)
        st = state(page)
        kinds_seen.add(st["kind"])
        pct = ink(page)
        label = f"[{tag}] {i + 1}단계 {sid}({st['kind']})"
        check(f"{label}: 캔버스가 비어 있지 않음", pct > 1.0, f"ink={pct:.2f}%")
        check(f"{label}: 판서 끝 상태·재생 멈춤·소리 없음", st["index"] == i and st["drawDone"] and not st["playing"] and st["audioTime"] == 0, json.dumps(st)[:160])
        rep = report["steps"][i]
        hard = [x for x in rep["issues"] if x.get("level") == "error" or x.get("kind") in HARD_KINDS]
        check(f"{label}: 칠판 밖으로 나가는 글·넘치는 상자 없음(layoutReport)", not hard, json.dumps(hard, ensure_ascii=False)[:200])
        soft_notes.extend(f"{label}: {x.get('kind')} {x.get('detail')}" for x in rep["issues"] if x not in hard)
        # 칠판 글에 쓰인 한자가 실제로 Canvas 로 그려졌는가
        want = hanja_expected(page, i)
        drawn = page.evaluate("() => window.__drawn.map((d) => d[0]).join('')")
        drawn_set = set(page.evaluate("(t) => [...new Set(t.match(/\\p{Script=Han}/gu) || [])]", drawn))
        missing = [c for c in want if c not in drawn_set]
        check(f"{label}: 한자 {len(want)}종이 모두 Canvas 에 그려짐", not missing, f"missing={missing}")
        total_han[0] += len(want)
        fonts_used = page.evaluate("() => [...new Set(window.__drawn.filter((d) => /\\p{Script=Han}/u.test(d[0])).map((d) => d[1].split(' ').slice(1).join(' ')))]")
        check(f"{label}: 한자는 내장 한자 글꼴(ChalkHanja)을 글꼴 목록에 포함해 그림", all("ChalkHanja" in f for f in fonts_used) and (bool(fonts_used) or not want), str(fonts_used)[:120])
        # 한 장 요약·장 제목·인용·설명·alt 가 소리 없이도 보임
        dom = page.evaluate(
            """() => {
              const t = (id) => (document.getElementById(id) || {}).textContent || '';
              const vis = (el) => !!el && !el.hidden && el.getClientRects().length > 0;
              return {
                kicker: t('board-kicker-text').trim(), title: t('board-title').trim(), summary: t('summary').trim(),
                beats: document.querySelectorAll('#beats li').length, past: document.querySelectorAll('#beats li.is-past').length,
                digest: [...document.querySelectorAll('#digest > li')].map((li) => li.textContent.trim().length),
                digestVisible: vis(document.getElementById('digest')),
                quoteVisible: vis(document.getElementById('quote')), quoteHan: t('quote-han').trim(), quoteReading: t('quote-reading').trim(),
                quoteMeaning: t('quote-meaning').trim(), quoteWhere: t('quote-where').trim(),
                sr: t('board-sr').trim(), callout: t('callout-text').trim(), transcript: t('transcript-text').trim(),
              };
            }"""
        )
        raw = page.evaluate("([i]) => { const s = window.LESSON_DATA.steps[i]; return { part: s.part, quote: !!s.quote, han: s.han || '' }; }", [i])
        check(f"{label}: 제목·요약·대체 설명(alt)·대본이 비어 있지 않음", len(dom["title"]) > 2 and len(dom["summary"]) > 5 and len(dom["sr"]) > 8 and len(dom["transcript"]) > 100, json.dumps(dom, ensure_ascii=False)[:200])
        check(f"{label}: 한 장 요약(digest) 3~4장이 소리 없이 보임", dom["digestVisible"] and 3 <= len(dom["digest"]) <= 4 and min(dom["digest"]) > 6, str(dom["digest"]))
        check(f"{label}: 완료 시 모든 설명 구절이 지난 상태", dom["beats"] >= 2 and dom["beats"] == dom["past"], f"{dom['past']}/{dom['beats']}")
        if raw["quote"]:
            check(f"{label}: 인용 카드(원문·독음·뜻·출처) 표시", dom["quoteVisible"] and dom["quoteHan"] and dom["quoteReading"] and dom["quoteMeaning"] and dom["quoteWhere"], json.dumps(dom, ensure_ascii=False)[:200])
        else:
            check(f"{label}: 인용이 없는 단계는 인용 카드를 숨김", not dom["quoteVisible"])
        if shots:
            page.screenshot(path=str(art / f"{tag}-step{i + 1:02d}-{sid}-full.png"), full_page=True)
            page.locator("#board").screenshot(path=str(art / f"{tag}-step{i + 1:02d}-{sid}-board.png"))
    if soft_notes:
        print(f"  INFO [{tag}] 배치 안내 {len(soft_notes)}건 (겹침 후보; 화면은 스크린샷으로 확인)")
        for n in soft_notes[:12]:
            print("       -", n[:150])
        if len(soft_notes) > 12:
            print(f"       … 외 {len(soft_notes) - 12}건")
        soft_notes.clear()
    present = [k for k in BOARD_KINDS if k in kinds_seen]
    check(f"[{tag}] 칠판에 한자가 실제로 그려진 단계가 있음(전체 {total_han[0]}자 종류 합)", total_han[0] > 0)
    check(f"[{tag}] 칠판 종류 6가지가 모두 한 번 이상 그려짐", present == BOARD_KINDS, f"seen={sorted(kinds_seen)}")


def mid_frames(tag: str, page, art: Path, count: int) -> None:
    for i in sorted({1, count // 3, count // 2, count - 2}):
        i = max(0, min(count - 1, i))
        page.evaluate("([i]) => { const p = window.artOfWarPlayer; p.seek(i, 0); const end = p.getState().animEnd; p.seek(i, end * 0.45); }", [i])
        page.wait_for_timeout(100)
        st = state(page)
        check(f"[{tag}] {i + 1}단계 중간 프레임(t={st['t']}): 분필이 그리는 중", 0 < st["t"] < st["animEnd"] and not st["drawDone"] and not st["complete"])
        page.locator("#board").screenshot(path=str(art / f"{tag}-step{i + 1:02d}-mid.png"))


def layout_geometry(tag: str, page, w: int, h: int) -> None:
    """칠판·글 배치: 넓은 화면은 칠판이 글 왼쪽, 좁은 화면은 위아래. 첫 화면에서 칠판이 충분히 보임."""
    page.evaluate("() => { window.scrollTo(0, 0); window.artOfWarPlayer.goTo(2, { play: false }); }")
    page.wait_for_timeout(150)
    g = page.evaluate(
        """() => {
          const r = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height }; };
          return { board: r('#board'), caption: r('.caption'), controls: r('#play'), chapters: r('#chapters') };
        }"""
    )
    b, c = g["board"], g["caption"]
    visible = max(0.0, min(b["b"], h) - max(b["t"], 0))
    if w >= 1100:
        check(f"[{tag}] 첫 화면에서 칠판이 90% 이상 보임", visible >= 0.9 * b["h"], f"visible={visible:.0f}/{b['h']:.0f}")
    check(f"[{tag}] 칠판이 가로 방향으로 충분히 큼 (>= {int(min(w, 1000) * 0.55)}px)", b["w"] >= min(w, 1000) * 0.55, f"width={b['w']:.0f}")
    check(f"[{tag}] 칠판 가로세로 비율이 정상(너무 납작하지 않음)", b["h"] / b["w"] >= 0.38, f"{b['w']:.0f}x{b['h']:.0f}")
    # 설명(caption)은 칠판 아래에 놓인다(넓은 화면의 오른쪽 글은 칠판 안 Canvas 글)
    check(f"[{tag}] 설명 영역이 칠판 아래에 있음", c["t"] >= b["b"] - 2, f"board.bottom={b['b']:.0f} caption.top={c['t']:.0f}")


def chapter_nav(tag: str, page, count: int, expect_parts: bool) -> None:
    page.evaluate("() => { window.artOfWarPlayer.pause(); window.artOfWarPlayer.goTo(0, { play: false }); }")
    nav = page.evaluate(
        """() => ({
          groups: [...document.querySelectorAll('#chapters .chapter-group')].map((g) => ({ part: g.dataset.part, n: g.querySelectorAll('button.chapter-btn').length })),
          buttons: document.querySelectorAll('#chapters button.chapter-btn').length,
          current: [...document.querySelectorAll('#chapters button[aria-current=step]')].length,
        })"""
    )
    check(f"[{tag}] 장 목록 버튼 {count}개", nav["buttons"] == count, json.dumps(nav))
    if expect_parts:
        parts = [g["part"] for g in nav["groups"]]
        sizes = [g["n"] for g in nav["groups"]]
        check(f"[{tag}] 장 목록이 부별로 묶임(배경 6 · 13편 · 마무리 4)", parts == ["background", "chapter", "closing"] and sizes == [6, 13, 4], f"{parts} {sizes}")
    check(f"[{tag}] 현재 단계 표시(aria-current)가 정확히 1개", nav["current"] == 1, json.dumps(nav))
    p0 = page.evaluate("() => (document.getElementById('lecture-progress-fill').style.transform.match(/scaleX\\(([\\d.]+)\\)/) || [0, 0])[1]")
    target = min(count - 1, 8)
    page.click(f"#chapters button.chapter-btn >> nth={target}")
    st = state(page)
    check(f"[{tag}] 장 목록 버튼으로 {target + 1}단계 이동", st["index"] == target, json.dumps(st)[:100])
    cur = page.evaluate("() => { const b = document.querySelector('#chapters button[aria-current=step]'); const all = [...document.querySelectorAll('#chapters button.chapter-btn')]; return all.indexOf(b); }")
    check(f"[{tag}] 현재 단계 강조가 이동을 따라감", cur == target, str(cur))
    p1 = page.evaluate("() => (document.getElementById('lecture-progress-fill').style.transform.match(/scaleX\\(([\\d.]+)\\)/) || [0, 0])[1]")
    check(f"[{tag}] 전체 진행 막대가 늘어남", float(p1) > float(p0), f"{p0} -> {p1}")
    seen = page.evaluate("() => document.querySelectorAll('#chapters button.is-seen').length")
    check(f"[{tag}] 지나간 단계는 '본 단계'로 표시", seen >= 1, str(seen))
    check(f"[{tag}] 진행 문구", "단계" in page.inner_text("#lecture-progress-text") or "/" in page.inner_text("#lecture-progress-text"), page.inner_text("#lecture-progress-text"))


def quiz_checks(tag: str, page, art: Path, shots: bool) -> None:
    total = page.evaluate("() => window.LESSON_DATA.quiz.length")
    check(f"[{tag}] 퀴즈 6문항·보기 3개", total == 6 and page.evaluate("() => window.LESSON_DATA.quiz.every((q) => q.options.length === 3)"))
    page.locator("#quiz").scroll_into_view_if_needed()
    n_items = page.evaluate("() => document.querySelectorAll('#quiz-list > li.quiz-q').length")
    check(f"[{tag}] 퀴즈 문항 {total}개 표시", n_items == total, str(n_items))
    check(f"[{tag}] 처음 점수 문구", "맞힌 문제 0 / 6" in page.inner_text("#quiz-score") and "푼 문제 0 / 6" in page.inner_text("#quiz-score"), page.inner_text("#quiz-score"))
    # 0번 문항: 오답 먼저 → 정답 공개 + 피드백, 다시 눌러도 바뀌지 않음
    right0 = page.evaluate("() => window.LESSON_DATA.quiz[0].options.findIndex((o) => o.correct)")
    wrong0 = [k for k in range(3) if k != right0][0]
    q0 = page.locator("#quiz-list > li.quiz-q").nth(0)
    q0.locator("ul li button").nth(wrong0).click()
    check(f"[{tag}] 오답: 선택한 보기가 오답, 정답 보기가 공개됨", q0.locator("ul li button").nth(wrong0).get_attribute("data-state") == "wrong" and q0.locator("ul li button").nth(right0).get_attribute("data-state") == "reveal")
    fb = q0.locator(".quiz-fb").inner_text()
    check(f"[{tag}] 오답 즉시 피드백(\"아쉬워요\" + 정답 해설)", fb.startswith("아쉬워요.") and "정답은" in fb and q0.locator(".quiz-fb").is_visible(), fb[:60])
    q0.locator("ul li button").nth(right0).click(force=True)
    check(f"[{tag}] 한 번 답한 문항은 바뀌지 않음", q0.locator("ul li button").nth(wrong0).get_attribute("data-state") == "wrong")
    check(f"[{tag}] 점수: 맞힌 0 / 푼 1", "맞힌 문제 0 / 6" in page.inner_text("#quiz-score") and "푼 문제 1 / 6" in page.inner_text("#quiz-score"), page.inner_text("#quiz-score"))
    # 나머지 문항: 정답 클릭
    for qi in range(1, total):
        right = page.evaluate("([q]) => window.LESSON_DATA.quiz[q].options.findIndex((o) => o.correct)", [qi])
        page.locator("#quiz-list > li.quiz-q").nth(qi).locator("ul li button").nth(right).click()
    q1 = page.locator("#quiz-list > li.quiz-q").nth(1)
    check(f"[{tag}] 정답 즉시 피드백(\"정답!\")", q1.locator(".quiz-fb").inner_text().startswith("정답!") and q1.locator(".quiz-fb").is_visible())
    score = page.inner_text("#quiz-score")
    check(f"[{tag}] 최종 점수: 맞힌 5 / 푼 6", "맞힌 문제 5 / 6" in score and "푼 문제 6 / 6" in score, score)
    check(f"[{tag}] getState().quiz 가 점수와 일치", state(page)["quiz"] == {"answered": 6, "correct": 5, "total": 6}, json.dumps(state(page)["quiz"]))
    if shots:
        page.locator("#quiz").screenshot(path=str(art / f"{tag}-quiz.png"))
    # 해당 편으로 이동
    q0.locator(".quiz-jump").click()
    want = page.evaluate("() => { const q = window.LESSON_DATA.quiz[0]; const s = window.LESSON_DATA.steps; const k = s.findIndex((x) => x.part === 'chapter' && x.chapterNo === q.chapterNo); return k >= 0 ? k : 0; }")
    check(f"[{tag}] '다시 보기'가 해당 편 단계로 이동", state(page)["index"] == want and not state(page)["playing"], f"{state(page)['index']} vs {want}")
    # 다시 풀기
    page.locator("#quiz-retry").scroll_into_view_if_needed()
    page.click("#quiz-retry")
    check(f"[{tag}] 다시 풀기: 점수·표시 초기화", "푼 문제 0 / 6" in page.inner_text("#quiz-score") and q0.locator("ul li button").nth(wrong0).get_attribute("data-state") == "idle" and not q0.locator(".quiz-fb").is_visible())
    # 오해·참고 문헌
    mis = page.evaluate("() => document.querySelectorAll('#mis-list > li').length")
    refs = page.evaluate("() => document.querySelectorAll('#ref-list > li').length")
    check(f"[{tag}] 자주 하는 오해 섹션 (>=3개)", mis >= 3, str(mis))
    check(f"[{tag}] 참고 문헌 섹션 (>=3개)와 출처 안내", refs >= 3 and len(page.inner_text("#source-note")) > 10, f"{refs}")
    check(f"[{tag}] 참고 문헌에 링크(<a>)가 없음(보이는 글뿐)", page.evaluate("() => document.querySelectorAll('#references a, #quiz a, #misconceptions a').length") == 0)


def interactions(tag: str, page, count: int, has_audio: bool) -> None:
    page.evaluate("() => window.location.hash = ''")
    page.evaluate("() => window.artOfWarPlayer.goTo(0, { play: false })")
    page.evaluate("() => { window.artOfWarPlayer.seek(0, 0); window.artOfWarPlayer.pause(); }")
    page.click("#play")
    page.wait_for_timeout(1300)
    st = state(page)
    check(f"[{tag}] 재생 버튼: 재생 시작", st["playing"] and st["t"] > 0.5, json.dumps(st)[:140])
    check(f"[{tag}] 재생 중 버튼 이름 '일시정지'", page.inner_text("#play-label") == "일시정지", page.inner_text("#play-label"))
    if has_audio:
        check(f"[{tag}] 해설 소리가 실제로 흐름(audioTime > 0)", state(page)["audioTime"] > 0.3, json.dumps(state(page))[:160])
    check(f"[{tag}] 재생 중 분필 판서 상태 문구('판서 중')", "판서 중" in page.inner_text("#status"), page.inner_text("#status"))
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
    check(f"[{tag}] 숫자 키 5", state(page)["index"] == min(4, count - 1))
    page.evaluate("([n]) => { window.location.hash = '#' + n; }", [min(3, count)])
    page.wait_for_timeout(150)
    check(f"[{tag}] #{min(3, count)} 해시 이동", state(page)["index"] == min(3, count) - 1)
    page.click("#replay")
    page.wait_for_timeout(500)
    st = state(page)
    check(f"[{tag}] 다시 그리기: 처음부터 재생", st["playing"] and st["t"] < 2.5, json.dumps(st)[:140])
    page.click("#play")  # 멈춤
    page.click("#auto-toggle")
    check(f"[{tag}] 자동 넘김 끄기", state(page)["auto"] is False and page.get_attribute("#auto-toggle", "aria-pressed") == "false")
    page.click("#auto-toggle")
    check(f"[{tag}] 자동 넘김 다시 켜기", state(page)["auto"] is True and page.get_attribute("#auto-toggle", "aria-pressed") == "true")
    page.select_option("#speed", "1.5")
    check(f"[{tag}] 속도 1.5배", state(page)["speed"] == 1.5)
    page.select_option("#speed", "1")
    page.evaluate("() => document.activeElement && document.activeElement.blur()")
    page.keyboard.press("Space")
    page.wait_for_timeout(150)
    st1 = state(page)
    page.keyboard.press("Space")
    st2 = state(page)
    check(f"[{tag}] 스페이스 바 재생/멈춤", st1["playing"] != st2["playing"], f"{st1['playing']}->{st2['playing']}")
    page.evaluate("() => window.artOfWarPlayer.pause()")


def audio_controls(tag: str, page) -> None:
    """해설 음성·분필 토글, 분필 기본 25%, 해설 자막(음성 칩·대본). 소리 자체는 verify_media.py 가 잰다."""
    page.evaluate("() => { const p = window.artOfWarPlayer; p.pause(); p.goTo(0, { play: false }); p.setVoiceEnabled(true); p.setChalkEnabled(true); }")
    st = state(page)
    check(f"[{tag}] 분필 소리 기본 켬", st["chalkEnabled"], json.dumps(st)[:160])
    check(f"[{tag}] 분필 음량 기본 25% (슬라이더·표시·상태 일치)",
          st["chalkVolume"] == 25 and page.input_value("#chalk-volume") == "25" and page.inner_text("#chalk-volume-value").strip() == "25%",
          f"{st['chalkVolume']} / {page.input_value('#chalk-volume')} / {page.inner_text('#chalk-volume-value')}")
    chip = page.inner_text("#voice-chip-label")
    if st["hasAudio"]:
        check(f"[{tag}] 해설 음성 기본 켬", st["voiceEnabled"], json.dumps(st)[:160])
        check(f"[{tag}] 음성 칩에 해설 음성 이름 표시", "Haena" in chip or "해나" in chip, chip)
        page.click("#voice-toggle")
        check(f"[{tag}] 해설 음성 끄기 (aria-pressed·상태 글자·API)",
              page.get_attribute("#voice-toggle", "aria-pressed") == "false" and page.inner_text("#voice-state").strip() == "끔" and state(page)["voiceEnabled"] is False)
        page.click("#voice-toggle")
        check(f"[{tag}] 해설 음성 다시 켜기", page.get_attribute("#voice-toggle", "aria-pressed") == "true" and state(page)["voiceEnabled"] is True)
    else:
        check(f"[{tag}] 개발용 빌드: 음성 칩이 '개발용'이고 음성 토글이 비활성", "개발용" in chip and page.get_attribute("#voice-toggle", "aria-disabled") == "true" and st["voiceEnabled"] is False, chip)
    page.click("#chalk-toggle")
    check(f"[{tag}] 분필 소리 끄기 (aria-pressed·상태 글자·API)",
          page.get_attribute("#chalk-toggle", "aria-pressed") == "false" and page.inner_text("#chalk-state").strip() == "끔" and state(page)["chalkEnabled"] is False)
    page.click("#chalk-toggle")
    check(f"[{tag}] 분필 소리 다시 켜기", page.get_attribute("#chalk-toggle", "aria-pressed") == "true" and state(page)["chalkEnabled"] is True)
    page.evaluate("() => { const s = document.getElementById('chalk-volume'); s.value = '60'; s.dispatchEvent(new Event('input', { bubbles: true })); }")
    check(f"[{tag}] 분필 슬라이더 60% 반영", state(page)["chalkVolume"] == 60 and page.inner_text("#chalk-volume-value").strip() == "60%", page.inner_text("#chalk-volume-value"))
    page.evaluate("() => window.artOfWarPlayer.setChalkVolume(25)")
    check(f"[{tag}] 분필 음량을 25%로 되돌림", state(page)["chalkVolume"] == 25 and page.inner_text("#chalk-volume-value").strip() == "25%")
    narration = page.evaluate("() => document.getElementById('transcript-text').textContent.trim()")
    check(f"[{tag}] 해설 대본이 화면에 있음(자막)", len(narration) > 100, narration[:40])
    check(f"[{tag}] 합성 음성 안내 문구(MAI-Voice-2)가 화면에 있음", "MAI-Voice-2" in page.evaluate("() => document.body.innerText") and "합성" in page.evaluate("() => document.body.innerText"))
    check(f"[{tag}] 분필 CC0 출처 표시", "CC0" in page.evaluate("() => document.body.innerText") and "digitale.de" in page.evaluate("() => document.body.innerText"))


def auto_advance(browser, url: str, count: int) -> None:
    """가짜 시계로 자동 넘김의 시간 규칙(0.9초 간격)을 확인합니다 (실제 1분을 기다리지 않음).

    가짜 시계는 실제 오디오를 돌리지 못하므로 해설 음성을 끄고(시계=판서) 확인합니다.
    음성이 있는 실제 재생의 자동 넘김은 verify_media.py 가 맡습니다.
    """
    ctx = browser.new_context(viewport={"width": 1280, "height": 720}, offline=True, locale="ko-KR")
    page = ctx.new_page()
    w = Watcher(page)
    page.clock.install(time=0)
    page.goto(url, wait_until="load")
    page.wait_for_function("() => window.artOfWarPlayer && window.artOfWarPlayer.getState().ready")
    page.evaluate("() => { const p = window.artOfWarPlayer; p.setVoiceEnabled(false); p.setChalkEnabled(false); }")
    first = 1
    page.evaluate("([i]) => { const p = window.artOfWarPlayer; p.seek(i, 0); p.setAuto(true); p.setSpeed(1.5); }", [first])
    page.evaluate("() => window.artOfWarPlayer.play()")
    page.clock.run_for(2000)
    st = state(page)
    check("[auto] 재생 중 (가짜 시계)", st["index"] == first and st["playing"] and st["t"] > 0.5, json.dumps(st)[:140])
    page.clock.run_for(70000)
    st = state(page)
    check("[auto] 충분히 기다리면 다음 단계로 넘어감", st["index"] >= first + 1 and st["started"], json.dumps(st)[:140])
    last = count - 1
    page.evaluate("([i]) => { const p = window.artOfWarPlayer; p.seek(i, 0); p.setAuto(true); p.play(); }", [last])
    page.clock.run_for(120000)
    st = state(page)
    check("[auto] 마지막 단계는 끝나면 멈춤", st["index"] == last and not st["playing"] and st["complete"] and st["ended"], json.dumps(st)[:140])
    page.evaluate("([i]) => { const p = window.artOfWarPlayer; p.seek(i, 0); p.setAuto(false); p.play(); }", [2])
    page.clock.run_for(70000)
    st = state(page)
    check("[auto] 자동 넘김을 끄면 판서가 끝난 뒤 멈춤", st["index"] == 2 and not st["playing"] and st["complete"], json.dumps(st)[:140])
    check("[auto] 멈춘 상태 문구가 '판서 중'이 아니라 완료를 알림", "판서 중" not in page.inner_text("#status") and "완료" in page.inner_text("#status"), page.inner_text("#status"))
    page.evaluate("() => window.artOfWarPlayer.setAuto(true)")
    page.clock.run_for(2000)
    st = state(page)
    check("[auto] 자동 넘김을 다시 켜면 완료된 단계에서 이어서 다음 단계로", st["index"] == 3 and st["auto"] and st["playing"], json.dumps(st)[:140])

    # 0.9초 간격
    page.evaluate("() => { const p = window.artOfWarPlayer; p.seek(0, 0); p.setAuto(true); p.setSpeed(1); p.play(); }")
    anim_end = state(page)["animEnd"]
    page.clock.run_for(int(anim_end * 1000) + 300)
    st = state(page)
    check("[auto] 판서 완료 직후(0.3초)에는 아직 같은 단계", st["index"] == 0 and st["drawDone"] and st["complete"], json.dumps(st)[:160])
    check("[auto] 그 사이 상태 문구는 완료·다음 단계 안내(판서 중 아님)", "판서 중" not in page.inner_text("#status") and "다음 단계" in page.inner_text("#status"), page.inner_text("#status"))
    check("[auto] 대기 시간(hold)이 0.9초 미만", 0.2 < st["hold"] < 0.9, str(st["hold"]))
    page.clock.run_for(800)
    st = state(page)
    check("[auto] 0.9초 뒤에는 다음 단계로 넘어가 재생", st["index"] == 1 and st["playing"], json.dumps(st)[:160])
    page.evaluate("() => { const p = window.artOfWarPlayer; p.seek(0, 0); p.setAuto(true); p.setSpeed(1); p.play(); }")
    page.clock.run_for(1000)
    t_a = state(page)["t"]
    page.clock.run_for(2000)
    t_b = state(page)["t"]
    check("[auto] 재생 시간이 실제 경과와 같은 속도로 흐름 (2초 → 약 2초)", 1.7 <= t_b - t_a <= 2.3, f"{t_a}->{t_b}")
    check("[auto] 오류 없음", not w.errors, "; ".join(w.errors)[:200])
    ctx.close()


def auto_advance_chain(browser, url: str, count: int) -> None:
    """자동 넘김으로 여러 단계가 이어지는지: 판서·해설이 끝날 때마다 다음 단계로 (가짜 시계, 해설 음성 끔)."""
    ctx = browser.new_context(viewport={"width": 1280, "height": 720}, offline=True, locale="ko-KR")
    page = ctx.new_page()
    w = Watcher(page)
    page.clock.install(time=0)
    page.goto(url, wait_until="load")
    page.wait_for_function("() => window.artOfWarPlayer && window.artOfWarPlayer.getState().ready")
    page.evaluate("() => { const p = window.artOfWarPlayer; p.setVoiceEnabled(false); p.setChalkEnabled(false); p.setAuto(true); p.setSpeed(1.5); p.seek(0, 0); p.play(); }")
    seen = [0]
    for _ in range(min(count, 6) * 3):
        page.clock.run_for(20000)
        idx = state(page)["index"]
        if idx != seen[-1]:
            seen.append(idx)
        if idx >= min(count - 1, 4):
            break
    check("[chain] 자동 넘김으로 단계가 순서대로 이어짐 (0 → 1 → 2 ...)", seen[:4] == list(range(len(seen[:4]))) and len(seen) >= 3, str(seen))
    chip = page.evaluate("() => document.querySelector('#chapters button[aria-current=step]')?.textContent || ''")
    check("[chain] 장 목록 강조가 자동으로 따라감", bool(chip), chip[:30])
    check("[chain] 오류 없음", not w.errors, "; ".join(w.errors)[:200])
    ctx.close()


def reduced_motion(browser, url: str, art: Path, count: int, has_audio: bool) -> None:
    """줄어든 동작: 완성된 칠판. 해설이 있으면 소리만 재생(실제 오디오는 verify_media.py), 없으면 '다음 단계 보기'."""
    ctx, page, w = open_page(browser, url, 1024, 768, reduced=True)
    st = state(page)
    check("[reduced] 줄어든 동작 감지", st["reduced"] is True)
    check("[reduced] 시작부터 완성된 칠판 (판서 끝·재생 안 함)", st["drawDone"] and not st["playing"] and ink(page) > 1.0, json.dumps(st)[:140])
    check("[reduced] 안내 문구 표시", page.is_visible("#reduced-note"))
    check("[reduced] 시작 안내 오버레이 숨김", not page.is_visible("#board-hint"))
    if has_audio:
        check("[reduced] 해설이 켜져 있어 자동 넘김 사용 가능", st["voiceEnabled"] and st["autoAvailable"] and st["auto"], json.dumps(st)[:160])
        check("[reduced] 재생 버튼 이름 '이 단계 재생' (해설을 들려 줌)", page.inner_text("#play-label") == "이 단계 재생", page.inner_text("#play-label"))
        page.click("#play")
        page.wait_for_timeout(900)
        st = state(page)
        check("[reduced] 재생하면 같은 단계에서 해설이 재생되고 판서 애니메이션은 없음", st["index"] == 0 and st["playing"] and st["drawDone"] and st["audioTime"] > 0.3, json.dumps(st)[:180])
        check("[reduced] 해설 중 상태 문구는 '판서 중'이 아님", "판서 중" not in page.inner_text("#status"), page.inner_text("#status"))
        page.click("#play")
        check("[reduced] 일시정지하면 멈춤", not state(page)["playing"])
        page.click("#voice-toggle")
        st = state(page)
        check("[reduced] 해설을 끄면 자동 넘김 사용 불가", st["voiceEnabled"] is False and st["autoAvailable"] is False, json.dumps(st)[:160])
    else:
        check("[reduced] 해설이 없으면 자동 넘김 사용 불가", st["voiceEnabled"] is False and st["autoAvailable"] is False, json.dumps(st)[:160])
    check("[reduced] 자동 넘김 버튼이 aria-disabled 와 '불가'로 표시", page.get_attribute("#auto-toggle", "aria-disabled") == "true" and "불가" in page.inner_text("#auto-state"), page.inner_text("#auto-state"))
    check("[reduced] 재생 버튼 이름 '다음 단계 보기'", page.inner_text("#play-label") == "다음 단계 보기", page.inner_text("#play-label"))
    page.evaluate("() => window.artOfWarPlayer.goTo(0)")
    page.click("#play")
    st = state(page)
    check("[reduced] 재생 버튼은 다음 단계를 완성된 모습으로 보여 줌", st["index"] == 1 and st["drawDone"] and not st["playing"], json.dumps(st)[:140])
    for i in range(count):
        page.evaluate("([i]) => window.artOfWarPlayer.goTo(i)", [i])
        st = state(page)
        if not (st["complete"] and not st["playing"] and ink(page) > 1.0):
            check(f"[reduced] {i + 1}단계 정적 표시", False, json.dumps(st)[:140])
            break
    else:
        check(f"[reduced] {count}단계 모두 정적으로 완성 표시(음성 끔)", True)
    page.evaluate("() => window.artOfWarPlayer.goTo(3)")
    page.screenshot(path=str(art / "reduced-step4-full.png"), full_page=True)
    page.keyboard.press("Space")
    st = state(page)
    check("[reduced] 스페이스 바도 애니메이션을 시작하지 않음(다음 단계 보기)", not st["playing"] and st["index"] == 4 % count, json.dumps(st)[:140])
    check("[reduced] 오류 없음", not w.errors, "; ".join(w.errors)[:200])
    ctx.close()


def build_fixture(art: Path) -> Path:
    out = art / "fixture-art-of-war.html"
    cmd = ["node", "build.mjs", "--no-audio", "--content", "tests/fixtures/content", "--out", str(out)]
    r = subprocess.run(cmd, cwd=HERE, capture_output=True, text=True)
    if r.returncode != 0:
        print("시험용 빌드 실패:\n" + r.stdout + r.stderr)
        sys.exit(2)
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--html", default="", help="검증할 HTML (기본: art-of-war.html)")
    ap.add_argument("--fixture", action="store_true", help="tests/fixtures/content 로 개발용 빌드를 만들어 그것을 검증")
    ap.add_argument("--artifacts", default="", help="스크린샷·report.json 저장 폴더 (기본: 임시 폴더, 저장소 밖 경로 권장)")
    ap.add_argument("--no-shots", action="store_true", help="스크린샷을 저장하지 않음")
    ap.add_argument("--steps", type=int, default=0, help="예상 단계 수 (기본: 시험용 6, 실제 23)")
    args = ap.parse_args()

    art = Path(args.artifacts) if args.artifacts else Path(tempfile.mkdtemp(prefix="aow-verify-"))
    art.mkdir(parents=True, exist_ok=True)
    if HERE in art.resolve().parents or art.resolve() == HERE:
        print("--artifacts 는 저장소 밖 폴더여야 합니다:", art)
        return 2
    if args.fixture:
        html = build_fixture(art)
    else:
        html = Path(args.html).resolve() if args.html else HERE / "art-of-war.html"
    if not html.exists():
        print("HTML이 없습니다. 먼저 node build.mjs 를 실행하세요:", html)
        return 2
    url = html.as_uri()
    print("검증 대상:", url)
    print("결과 저장:", art)

    with sync_playwright() as pw:
        browser = launch(pw)
        try:
            ctx, page, watcher = open_page(browser, url, 1280, 720)
            count = page.evaluate("() => window.artOfWarPlayer.steps.length")
            has_audio = state(page)["hasAudio"]
            ctx.close()
            expect = args.steps or (6 if args.fixture else 23)
            print(f"단계 {count}개 · 해설 음성 {'포함' if has_audio else '없음(개발용 빌드 --no-audio)'}")
            if not has_audio:
                print("  (경고) 해설 음성이 없는 개발용 빌드: 음성이 필요한 검사는 건너뛰거나 '음성 없음' 기준으로 봅니다.")
            for tag, w, h in VIEWPORTS:
                print(f"\n== {tag}px ({w}x{h}) · 오프라인 ==")
                ctx, page, watcher = open_page(browser, url, w, h)
                st = state(page)
                check(f"[{tag}] 처음에는 1단계가 비어 있고 재생 대기", st["index"] == 0 and not st["started"] and not st["playing"], json.dumps(st)[:140])
                check(f"[{tag}] 시작 안내 표시", page.is_visible("#board-hint"))
                common_checks(tag, page, watcher, expect_wide=(w >= 1100) if w != 1024 else None)
                page.screenshot(path=str(art / f"{tag}-initial.png"), full_page=True)
                layout_geometry(tag, page, w, h)
                per_step(tag, page, art, shots=not args.no_shots, expect_count=expect)
                if tag != "390":
                    mid_frames(tag, page, art, count)
                chapter_nav(tag, page, count, expect_parts=(count == 23))
                interactions(tag, page, count, has_audio)
                audio_controls(tag, page)
                quiz_checks(tag, page, art, shots=not args.no_shots)
                common_checks(tag + "/after", page, watcher, expect_wide=None)
                ctx.close()
            print("\n== 줄어든 동작 ==")
            reduced_motion(browser, url, art, count, has_audio)
            print("\n== 자동 넘김 (가짜 시계) ==")
            auto_advance(browser, url, count)
            auto_advance_chain(browser, url, count)
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
