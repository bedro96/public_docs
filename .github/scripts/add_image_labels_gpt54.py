#!/usr/bin/env python3
"""Overlay editable text-box labels on the right-hand illustration of each slide.

The deck has no generator, so labels are added straight into the .pptx.
Idempotent: existing ImgLabel_* shapes are removed before re-adding.

Usage: python3 add_image_labels_gpt54.py IN.pptx [OUT.pptx] [--only 3,5,8]
Positions in SPEC are percentages of the picture box (x right, y down) and
come from looking at each image. Anchor: 'c' centre (default), 'l' left edge, 'r' right edge.
ADJUST holds per-label overrides in inches (top-left x/y, width w) from the visual-QA reports;
apply_text_fixes() holds the two non-label QA fixes (slide 28 code size, slide 64 closing text).
"""
import os
import re
import sys
import unicodedata
import zipfile
from copy import deepcopy
from lxml import etree
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE, MSO_SHAPE_TYPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN, MSO_AUTO_SIZE
from pptx.util import Emu, Pt

FONT = "Noto Sans CJK KR"
INK = RGBColor(0x25, 0x33, 0x34)
TEAL = RGBColor(0x08, 0x7F, 0x8C)
SIZE_PT = 10.5
NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main"

SPEC = {
    # --- SPEC START ---
    2: [("1. 계약 이해", 8, 25.5, "l"), ("2. 요청 실행", 8, 47.5, "l"),
        ("3. 결과 측정", 8, 71.5, "l"), ("4. 한 변수 개선", 8, 92, "l")],
    3: [("프롬프트 지시", 38, 26), ("앱 오케스트레이션", 36, 58),
        ("fine-tuning\n미지원", 44, 67, "r"), ("모델 가중치", 50, 94)],
    4: [("답변 품질", 18, 15.5), ("응답 지연", 50, 12), ("운영 비용", 82, 15.5),
        ("GPT-5.4-mini", 19, 51)],
    5: [("텍스트 입력", 20, 26), ("이미지 입력", 17, 63.5), ("gpt-5.4-mini", 57, 30.5),
        ("텍스트 출력", 84, 35.5), ("스트리밍", 76, 59, "r"), ("JSON 스키마", 76, 65, "r"),
        ("도구 호출", 76, 70.6, "r"), ("가중치 잠김", 76, 76.4, "r")],
    6: [("OpenAI 직접 경로", 4, 11.5, "l"), ("앱", 16, 36.5), ("OpenAI 클라우드", 76, 36.5),
        ("Azure 경로", 4, 57.5, "l"), ("앱", 15, 88), ("인증 게이트", 41, 88),
        ("Azure\ndeployment", 77, 89)],
    7: [("작업 PC", 20, 27), ("비밀값 금고", 75, 11), ("환경변수 주입", 78, 46, "r"),
        ("격리 Python 환경", 68, 88), ("로그 출력 금지", 22, 88.5)],
    8: [("터미널(curl)", 20, 36), ("모델 서비스", 66, 22.5), ("요청 JSON", 22, 76),
        ("응답 JSON", 71, 77)],
    9: [("Python 앱", 2, 12, "l"), ("SDK\n클라이언트", 2, 41, "l"),
        ("Responses\nendpoint", 2, 63, "l"), ("반환 텍스트", 2, 79, "l"),
        ("요청 ID\nusage 로그", 99, 37, "r")],
    10: [("TypeScript\n앱", 3, 30, "l"), ("await Promise", 40, 59),
         ("Responses\nendpoint", 62, 31), ("결과 텍스트", 85, 61), ("타입 결과 카드", 60, 70)],
    11: [("모델\nsnapshot", 15, 5), ("SDK 패키지", 53, 4.2), ("설정 파일", 86, 5.5),
         ("고정된 실험 상자", 50, 39.5), ("실행 1", 32, 97.5), ("실행 2", 68, 97.5)],
    12: [("고정 테스트 세트", 20, 46.5), ("baseline 실험", 60, 17.5), ("원본 출력", 23, 80),
         ("지연 시간", 52, 82), ("토큰 수", 79, 83)],
    13: [("역할", 57, 14), ("목적", 57, 24.5), ("성공 기준", 57, 35), ("신뢰 지시", 57, 47),
         ("신뢰 경계", 14, 57.3), ("비신뢰 입력", 58, 68.5), ("출력 계약", 62, 85)],
    14: [("모호한 요청", 27, 11), ("결과가 갈라짐", 20, 79), ("명확한 합격 기준", 77, 11),
         ("검증 가능한 출력", 62, 90)],
    15: [("비신뢰 문서", 21, 28), ("주입된 명령", 30, 72), ("신뢰 경계", 52, 26),
         ("developer 지시", 79, 70)],
    16: [("정상 예", 22, 14.5), ("경계 예", 50, 14.5), ("부정 예", 78, 14.5),
         ("모델 호출", 14, 50), ("분류 결과", 42, 88), ("held-out 평가", 83, 39)],
    17: [("한국어 설명", 18, 22), ("영문 식별자", 82, 22), ("한 응답에 둘 다", 50, 86.5)],
    18: [("구조", 33, 10), ("설명량", 51, 10.5), ("토큰 상한", 74, 11), ("제한된 출력", 50, 95)],
    19: [("none", 58, 27.5, "l"), ("low", 58, 42.5, "l"), ("medium", 58, 57.5, "l"),
         ("high", 58, 73, "l"), ("xhigh", 58, 89, "l"), ("정확도", 14, 28.5),
         ("지연 시간", 14, 84), ("effort 선택", 28, 10)],
    20: [("출력 토큰 예산", 50, 6), ("reasoning 토큰", 50, 28), ("가시 답변", 50, 85)],
    21: [("설정 카드", 13, 31.5), ("호환성 게이트", 47, 27), ("모델", 85, 27),
         ("명시적 오류", 66, 75)],
    22: [("실패 사례", 50, 4), ("증상 분류", 80, 33), ("결론 충돌", 20, 45), ("제약 과다", 50, 45),
         ("설명 과다", 80, 45), ("한 규칙만 수정", 50, 95.5)],
    23: [("JSON schema", 22, 50.5), ("모양 검증", 78, 51, "r"), ("업무 규칙 검사", 80, 81)],
    24: [("Pydantic schema", 58, 8), ("모델 응답", 17, 57), ("타입 객체", 84, 59),
         ("refusal", 22, 86), ("incomplete", 73, 89)],
    25: [("거절", 20, 11.5), ("불완전", 50, 11.5), ("의미 오류", 80, 11.5),
         ("각각 실패로 기록", 50, 80)],
    26: [("① 요청 전달", 12, 60), ("② function_call", 66, 11), ("③ 도구 실행", 70, 84),
         ("④ 결과 반환", 28, 83), ("⑤ 최종 답변", 85, 61.5)],
    27: [("함수 명세", 22, 28), ("schema 검증", 58, 35), ("허용", 84, 27),
         ("알 수 없는\n인수 거부", 80, 77.5)],
    28: [("허용 목록", 15, 31), ("검증기", 38, 36.5), ("읽기 전용", 62, 31), ("call_id", 86, 36.5),
         ("최대 반복 stop", 66, 80)],
    29: [("type 판별 union", 52, 11), ("function_call", 26, 77), ("message", 75, 77),
         ("call_id 일치", 50, 93)],
    30: [("도구\n실행", 11, 26), ("권한\n확인", 30, 26), ("사용자\n승인", 49, 26),
         ("멱등성\n키", 69, 26), ("DB\n변경", 88, 26)],
    31: [("지시문", 18, 22.5), ("대화 기록", 50, 22.5), ("검색 근거", 82, 22.5),
         ("토큰 예산\n깔때기", 57, 34, "l"), ("모델", 83, 61), ("모델 입력", 73, 94)],
    32: [("질문", 9, 54), ("검색 인덱스", 33, 62), ("재순위", 53, 36), ("선별 근거", 68, 61.5),
         ("모델 답변", 86, 35), ("출처 카드", 82, 73.5)],
    33: [("청킹", 30, 8), ("top-k", 57, 5.3), ("필터", 74, 10.5), ("재순위", 90, 5.3),
         ("Recall@k", 26, 91.5), ("정답 정확도", 74, 91.5)],
    34: [("질문", 82, 11), ("근거 게이트", 84, 26), ("인용 답변", 37, 61.5),
         ("답변 보류", 82, 73.5), ("출처 검사기", 50, 87.5)],
    35: [("긴 대화", 22, 6.5), ("요약 캡슐", 67, 22.5, "l"), ("고정 사실 레인", 34, 56),
         ("컨텍스트 예산", 28, 79), ("다음 요청", 80, 91.5)],
    36: [("요청 A", 29, 13.5), ("요청 B", 71, 13.5), ("캐시된 prefix", 48, 53.5),
         ("모델 추론", 50, 84)],
    37: [("서버", 15, 53), ("delta 청크", 55, 61), ("취소 밸브", 50, 22), ("취소됨", 87, 18),
         ("클라이언트 화면", 80, 80), ("오류 이벤트", 33, 80)],
    38: [("네트워크", 29, 33), ("대기열", 38, 56), ("첫 토큰", 62, 56), ("텍스트 생성", 76, 63),
         ("외부 도구", 66, 19), ("클라이언트\n렌더링", 87, 30)],
    39: [("순차 요청", 19, 27), ("제한된 병렬", 50, 27), ("Batch 큐", 80, 27),
         ("즉시 응답", 17, 60), ("동시 요청 상한", 47, 66.5), ("지연된 결과", 82, 70.5)],
    40: [("요청", 50, 8), ("일시\n오류", 23, 32, "r"), ("서버 지정\n대기", 64, 32.5, "l"),
         ("제한된 재시도", 47, 63.5), ("영구 오류 종료", 85, 57.5), ("멱등성 레지스터", 44, 87),
         ("쓰기 대상", 82, 85)],
    41: [("입력", 16, 11), ("cached 입력", 40, 5.5), ("출력", 64, 11), ("비용\n계산기", 26, 57, "r"),
         ("가격표", 84, 14.5), ("별도 도구 요금", 83, 41.5), ("총 비용", 42, 89.5)],
    42: [("A · 제외", 20, 29), ("B · 후보", 50, 21), ("C · 재검토", 80, 29), ("품질 ↑", 3, 19, "l"),
         ("지연 →", 97, 66.5, "r"), ("비용", 75, 83)],
    43: [("전체 데이터셋", 50, 5), ("개발 세트", 20, 47), ("검증 세트", 50, 47), ("최종 test", 81, 47),
         ("정상", 20, 94.5), ("경계", 50, 94.5), ("적대적", 80, 94.5)],
    44: [("정확도", 10, 80), ("근거성", 30, 87), ("형식 유효성", 50, 80), ("도구 성공", 70, 87),
         ("응답 지연", 89, 80)],
    45: [("LLM judge", 36, 28, "r"), ("평가 답변", 22, 49), ("기준 답안", 83, 14.5),
         ("편향 경고", 85, 51), ("사람 보정", 18, 62)],
    46: [("cases.jsonl", 14, 19), ("runner", 50, 24), ("raw 결과\nJSONL", 82, 15), ("집계기", 88, 66),
         ("metrics 리포트", 60, 83.5), ("오류 원장", 22, 79)],
    47: [("고정 데이터셋", 30, 3.5), ("고정 snapshot", 70, 3.5), ("변경 변수", 14, 29),
         ("반복 실행 ×3", 83, 28.5), ("분산 분석", 55, 96.5)],
    48: [("품질\n하한", 26, 32), ("지연\n상한", 50, 32), ("비용\n상한", 75, 32), ("릴리스 승인", 86, 39),
         ("평가 결과", 14, 71), ("판정 게이트", 53, 61, "l"), ("표본 부족", 40, 84), ("추가 테스트", 77, 91)],
    49: [("한국어 문의", 28, 33.5), ("추출기", 56, 25.5), ("타입 지정 티켓", 80, 15.5),
         ("필드 검증기", 24, 87), ("기대 필드 비교", 57, 64), ("통과", 86, 65), ("불일치", 86, 85)],
    50: [("질문", 12, 46.5), ("근거 문서 2건", 42, 20.5), ("출처 ID 검증", 41, 54.5, "r"), ("인용 답변", 82, 36),
         ("근거 없음", 25, 79), ("답변 보류", 66, 79)],
    51: [("① 조회", 10.5, 52), ("② 자격\n검증", 33, 52), ("③ 승인\n요청", 51, 27), ("④ 통제된\n실행", 75, 19),
         ("⑤ 감사\n영수증", 89, 52)],
    52: [("잠긴 모델\n가중치", 14, 38), ("① 프롬프트", 18, 87.5), ("② RAG", 50, 87.5), ("③ 도구 호출", 83, 87.5)],
    53: [("지원 모델", 33, 13, "r"), ("학습 데이터", 24, 21.5), ("기준선 평가", 76, 21.5), ("학습 필요?", 50, 53.5),
         ("안정된 행동", 23, 64.5), ("라이선스", 68, 64.5), ("Held-out test\n격리 보관", 50, 77)],
    54: [("요청 ID", 28, 25), ("설정 버전", 40, 41), ("토큰", 60.5, 41), ("도구 이벤트", 74, 25), ("최종 상태", 88, 41),
         ("마스킹\n필터", 62, 82), ("정제된\n로그", 86, 82)],
    55: [("비신뢰 문서", 27, 5), ("주입 차단", 84, 15), ("사용자 요청", 26, 40), ("서버 권한\n검증", 87, 39),
         ("통제된 도구", 24, 74), ("자격증명\n금고", 87, 81)],
    56: [("릴리스\n체크리스트", 85, 22), ("기능", 12, 66), ("평가 품질", 33, 66), ("예산", 51, 46, "l"),
         ("관측", 68, 66), ("롤백", 87, 66), ("배포 게이트", 50, 93)],
    57: [("카나리\n라우터", 83, 13.5), ("주\n트래픽", 12, 30), ("소량\n트래픽", 90, 28), ("기존\nBaseline", 41, 67),
         ("후보\nCandidate", 78, 67), ("헬스 모니터", 50, 94), ("롤백", 15, 73, "r")],
    58: [("증상 입력", 50, 14), ("400\n요청 오류", 19, 22), ("느림 점검", 80, 25), ("429 한도", 80, 60),
         ("401/403\n인증·권한", 18, 82), ("환각·품질\n점검", 80, 82)],
    59: [("모델", 27, 43), ("추론", 42, 43), ("형식", 57, 43), ("토큰", 72, 43),
         ("호환성 검사기", 40, 76, "r"), ("요청 커넥터", 82, 71)],
    60: [("① 환경\n설정", 15, 67), ("② 최소\n요청", 39, 67), ("③ 평가\n실행", 63, 67), ("④ 결과\n요약", 88, 67)],
    61: [("운영 예산", 62, 25, "r"), ("컨텍스트·도구", 50, 38, "r"), ("Reasoning\nsweep", 37, 47, "r"),
         ("프롬프트 수정", 58, 61.5, "l"), ("품질 기준선", 46, 70, "l"), ("최소 유효 요청", 34, 80.5, "l")],
    62: [("공식 문서 서가", 24, 72.5), ("모델 계약", 81, 20.5), ("Responses API", 80, 38.2), ("추론·프롬프트", 81, 55.5),
         ("구조화 출력", 81, 73.3), ("함수 호출", 81, 90.8)],
    63: [("평가", 15, 51.5), ("운영", 33, 33.5), ("개인정보", 50, 51.5), ("Azure", 68.5, 33.5), ("설계", 85, 51.5),
         ("확인 도장", 14, 68), ("날짜별 원장", 85, 57)],
    # --- SPEC END ---
}

# Visual-QA nudges (_qa_reports/gpt1_a.md, gpt1_b.md): slide -> {label n: {x, y, w}} in inches,
# x/y = top-left of the pill, w = pill width, wrap=False keeps a tight single-line pill from
# wrapping when the renderer substitutes a wider Latin font. Omitted keys keep the SPEC placement.
ADJUST = {
    5: {4: {"y": 2.72}, 5: {"x": 10.85}, 6: {"x": 10.49}, 7: {"x": 10.80}, 8: {"x": 10.62}},
    7: {3: {"x": 10.72, "y": 3.62, "w": 1.12}},
    10: {2: {"x": 9.70}},
    15: {2: {"y": 4.60}},
    18: {3: {"x": 11.46, "w": 0.82}},
    19: {3: {"w": 0.72, "wrap": False}},
    26: {1: {"w": 0.95}, 5: {"x": 11.72, "y": 4.52, "w": 1.0}},
    28: {3: {"x": 11.25}},
    29: {3: {"x": 11.35, "y": 5.10}},
    30: {3: {"x": 10.66, "w": 0.62}, 4: {"x": 11.36, "w": 0.62}},
    31: {6: {"x": 11.22}},
    32: {4: {"x": 11.05, "y": 3.97}},
    34: {5: {"y": 5.90}},
    36: {3: {"x": 10.33, "y": 3.76}},
    37: {2: {"y": 4.30}, 5: {"y": 5.25}},
    38: {6: {"x": 11.80, "w": 0.92}},
    39: {6: {"x": 11.66}},
    41: {6: {"y": 3.08}},
    45: {5: {"x": 9.33}},
    48: {5: {"x": 9.29, "y": 4.45}},
    49: {1: {"x": 9.77}},
    59: {1: {"x": 9.96, "y": 3.12, "w": 0.46}, 2: {"x": 10.49, "y": 3.12, "w": 0.46},
         3: {"x": 11.01, "y": 3.12, "w": 0.46}, 4: {"x": 11.54, "y": 3.12, "w": 0.46}},
    62: {4: {"x": 11.54, "w": 1.18, "wrap": False}},
}


def char_em(ch):
    if unicodedata.east_asian_width(ch) in ("W", "F") or 0x2460 <= ord(ch) <= 0x24FF:
        return 1.0
    if ch == " ":
        return 0.32
    if ch.isdigit():
        return 0.6
    if ch.isupper():
        return 0.7
    if ch in "-.,:;/()[]·+→":
        return 0.45
    return 0.6


def label_size(text, size_pt):
    lines = text.split("\n")
    em = max(sum(char_em(c) for c in ln) for ln in lines)
    w_in = em * size_pt / 72 * 1.18 + 0.16
    h_in = len(lines) * size_pt * 1.3 / 72 + 0.09
    return w_in, h_in


def find_picture(slide, slide_w):
    for sh in slide.shapes:
        if sh.shape_type == MSO_SHAPE_TYPE.PICTURE and sh.width < slide_w * 0.9:
            return sh
    return None


def set_alpha(fill_fore_color_parent, pct):
    clr = fill_fore_color_parent.find(".//{%s}srgbClr" % NS_A)
    a = etree.SubElement(clr, "{%s}alpha" % NS_A)
    a.set("val", str(int(pct * 1000)))


def add_label(slide, pic, n, text, x, y, anchor="c", size_pt=SIZE_PT, adj=None):
    adj = adj or {}
    w, h = label_size(text, size_pt)
    w = adj.get("w", w)
    W, H = pic.width / 914400, pic.height / 914400
    cx = pic.left / 914400 + W * x / 100
    cy = pic.top / 914400 + H * y / 100
    left = adj.get("x", {"c": cx - w / 2, "l": cx, "r": cx - w}[anchor])
    top = adj.get("y", cy - h / 2)
    pl, pr = pic.left / 914400 + 0.03, (pic.left + pic.width) / 914400 - 0.03
    pt_, pb = pic.top / 914400 + 0.03, (pic.top + pic.height) / 914400 - 0.03
    left = min(max(left, pl), pr - w)
    top = min(max(top, pt_), pb - h)
    shp = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE, Emu(int(left * 914400)), Emu(int(top * 914400)),
        Emu(int(w * 914400)), Emu(int(h * 914400)))
    shp.name = "ImgLabel_%d" % n
    shp.adjustments[0] = 0.32
    shp.shadow.inherit = False
    shp.fill.solid()
    shp.fill.fore_color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    set_alpha(shp._element.spPr.find("{%s}solidFill" % NS_A), 90)
    shp.line.color.rgb = TEAL
    shp.line.width = Pt(0.75)
    tf = shp.text_frame
    tf.word_wrap = adj.get("wrap", True)
    tf.auto_size = MSO_AUTO_SIZE.NONE
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    tf.margin_left = tf.margin_right = Emu(int(0.05 * 914400))
    tf.margin_top = tf.margin_bottom = Emu(int(0.02 * 914400))
    for i, line in enumerate(text.split("\n")):
        para = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        para.alignment = PP_ALIGN.CENTER
        run = para.add_run()
        run.text = line
        f = run.font
        f.size = Pt(size_pt)
        f.bold = True
        f.color.rgb = INK
        f.name = FONT
        rPr = run._r.get_or_add_rPr()
        for tag in ("ea", "cs"):
            el = etree.SubElement(rPr, "{%s}%s" % (NS_A, tag))
            el.set("typeface", FONT)
    return (left, top, w, h)


def apply_text_fixes(prs):
    # Idempotent: sets absolute values, so re-runs are safe.
    s28 = prs.slides[27]
    for sh in s28.shapes:
        if sh.name == "Text 7" and sh.has_text_frame:
            for el in sh._element.iter("{%s}rPr" % NS_A, "{%s}endParaRPr" % NS_A):
                el.set("sz", "1200")
    s64 = prs.slides[63]
    for sh in s64.shapes:
        if sh.name == "Text 2":
            sh.width, sh.height = Emu(int(4.6 * 914400)), Emu(int(0.95 * 914400))
            sh.top = Emu(int(3.225 * 914400))
        elif sh.name == "Text 3":
            sh.width = Emu(int(4.5 * 914400))
            for el in sh._element.iter("{%s}rPr" % NS_A, "{%s}endParaRPr" % NS_A):
                el.set("sz", "1300")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    only = None
    if "--only" in sys.argv:
        only = {int(v) for v in sys.argv[sys.argv.index("--only") + 1].split(",")}
        args = [a for a in args if a != sys.argv[sys.argv.index("--only") + 1]]
    src = args[0]
    dst = args[1] if len(args) > 1 else src
    prs = Presentation(src)
    count_before = len(prs.slides)
    total = 0
    for idx, slide in enumerate(prs.slides, 1):
        if only and idx not in only:
            continue
        for sh in list(slide.shapes):
            if sh.name.startswith("ImgLabel_"):
                sh._element.getparent().remove(sh._element)
        spec = SPEC.get(idx)
        if not spec:
            continue
        pic = find_picture(slide, prs.slide_width)
        if pic is None:
            print("slide %d: no picture" % idx)
            continue
        boxes = []
        for n, item in enumerate(spec, 1):
            text, x, y = item[0], item[1], item[2]
            anchor = item[3] if len(item) > 3 else "c"
            boxes.append(add_label(slide, pic, n, text, x, y, anchor,
                                   adj=ADJUST.get(idx, {}).get(n)))
            total += 1
        for i in range(len(boxes)):
            for j in range(i + 1, len(boxes)):
                a, b = boxes[i], boxes[j]
                if a[0] < b[0] + b[2] and b[0] < a[0] + a[2] and a[1] < b[1] + b[3] and b[1] < a[1] + a[3]:
                    print("slide %d: labels %d and %d overlap" % (idx, i + 1, j + 1))
    if not only:
        apply_text_fixes(prs)
    assert len(prs.slides) == count_before
    prs.save(dst)
    normalize_jpg_content_type(dst)
    print("labels added:", total, "->", dst)


def normalize_jpg_content_type(path):
    # python-pptx turns the deck's non-standard Default jpg=image/jpg into one Override per
    # image, which the pptx validator rejects; restore a single standard Default instead.
    ct_name = "[Content_Types].xml"
    with zipfile.ZipFile(path) as zin:
        ct = zin.read(ct_name).decode("utf-8")
        if 'Extension="jpg"' in ct:
            return
        ct = re.sub(r'<Override PartName="/ppt/media/[^"]+\.jpg" ContentType="image/jpe?g"\s*/>', "", ct)
        ct = ct.replace("<Default ", '<Default Extension="jpg" ContentType="image/jpeg"/><Default ', 1)
        tmp = path + ".tmp"
        with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = ct.encode("utf-8") if item.filename == ct_name else zin.read(item.filename)
                zout.writestr(item, data, compress_type=zipfile.ZIP_DEFLATED)
    os.replace(tmp, path)


if __name__ == "__main__":
    main()
