#!/usr/bin/env python3
"""한자 부분 글꼴(ChalkHanja)을 만듭니다.

나눔손글씨 펜(ChalkKorean)에는 한자와 일부 기호가 없습니다. 이 스크립트는 강의 데이터(content/*.json 과
tests/fixtures/content/*.json)에 쓰인 모든 글자 중 나눔손글씨 펜에 없는 글자를 모아 Noto Serif CJK KR(Bold)에서
그 글자들만 잘라 assets/ChalkHanja-subset.otf 로 저장합니다. 빌드(build.mjs)는 이 파일을 base64 @font-face 로 내장하고,
장면의 모든 글자가 ChalkKorean 또는 ChalkHanja 에 있는지 확인해 하나라도 없으면 빌드를 실패시킵니다.

  python3 subset_hanja.py            # 글자 집합이 바뀐 경우에만 다시 만듭니다
  python3 subset_hanja.py --force    # 항상 다시 만듭니다
  python3 subset_hanja.py --check    # 파일을 쓰지 않고, 기존 부분 글꼴이 모든 글자를 덮는지만 확인합니다

필요: fonttools (pip install -r requirements-fonts.txt). 원본 글꼴은 시스템의 fonts-noto-cjk 패키지
(/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc, 한국어 서체 번호 1)이며 SIL OFL 1.1 입니다.
라이선스 전문은 assets/OFL-NotoSerifCJK.txt 에 있습니다. 결과 파일에는 원본의 저작권·라이선스 이름표(name 표)를 남깁니다.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent
SOURCE_FONTS = [
    "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc",
    "/usr/share/fonts/truetype/noto/NotoSerifCJK-Bold.ttc",
    "/usr/share/fonts/noto-cjk/NotoSerifCJK-Bold.ttc",
]
FONT_NUMBER = 1  # 0 JP, 1 KR, 2 SC, 3 TC, 4 HK — 한국어 자형
NANUM = ROOT / "assets" / "NanumPenScript-Regular.ttf"
OUTPUT = ROOT / "assets" / "ChalkHanja-subset.otf"
CHARS_FILE = ROOT / "assets" / "ChalkHanja-chars.txt"
CONTENT_DIRS = [ROOT / "content", ROOT / "tests" / "fixtures" / "content"]
# 콘텐츠를 조금 고쳤다고 글꼴을 매번 다시 만들지 않도록 자주 쓰는 한자 문장부호·기호를 미리 포함합니다.
BASELINE = "·…—–‧、。《》〈〉『』「」※→←↑↓○●△▲◎★☆×"


def strings_of(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, list):
        for item in value:
            yield from strings_of(item)
    elif isinstance(value, dict):
        for item in value.values():
            yield from strings_of(item)


def scene_chars() -> set[str]:
    chars: set[str] = set()
    for directory in CONTENT_DIRS:
        for path in sorted(directory.glob("*.json")):
            for text in strings_of(json.loads(path.read_text(encoding="utf-8"))):
                chars.update(text)
    return {ch for ch in chars if not ch.isspace() and ord(ch) >= 0x20 and ch != "\u007f"}


def cmap_of(path: Path, number: int | None = None) -> set[int]:
    font = TTFont(str(path), fontNumber=number if number is not None else -1, lazy=True)
    return set(font.getBestCmap().keys())


def source_path() -> Path:
    for candidate in SOURCE_FONTS:
        if Path(candidate).exists():
            return Path(candidate)
    sys.exit("Noto Serif CJK Bold 를 찾지 못했습니다. fonts-noto-cjk 패키지를 설치하세요 (apt install fonts-noto-cjk).")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--force", action="store_true", help="글자 집합이 같아도 다시 만듭니다")
    parser.add_argument("--check", action="store_true", help="파일을 쓰지 않고 덮는지만 확인합니다")
    args = parser.parse_args()

    nanum = cmap_of(NANUM)
    needed = {ch for ch in scene_chars() if ord(ch) not in nanum}
    existing = set()
    if OUTPUT.exists():
        existing = {chr(cp) for cp in cmap_of(OUTPUT)}
    missing = needed - existing
    if args.check:
        if missing:
            print("부분 글꼴에 없는 글자 %d개: %s" % (len(missing), "".join(sorted(missing))))
            return 1
        print("OK: 부분 글꼴이 장면의 모든 글자를 덮습니다 (%d자)" % len(needed))
        return 0

    wanted = needed | {ch for ch in BASELINE if ord(ch) not in nanum}
    if OUTPUT.exists() and not args.force and not missing:
        print("기존 부분 글꼴이 이미 모든 글자를 덮습니다 (%d자). 다시 만들지 않았습니다." % len(needed))
        return 0
    # 이미 들어 있던 글자는 버리지 않습니다(콘텐츠 일부를 지웠다가 다시 쓸 때 글꼴이 흔들리지 않게).
    wanted |= {ch for ch in existing if ord(ch) > 0x7F}

    source = source_path()
    source_cmap = cmap_of(source, FONT_NUMBER)
    absent = sorted(ch for ch in wanted if ord(ch) not in source_cmap)
    required_absent = [ch for ch in absent if ch in needed]
    if required_absent:
        print("원본 글꼴에도 없는 글자: %s" % "".join(required_absent))
        return 1
    wanted -= set(absent)

    options = subset.Options()
    options.layout_features = []
    options.hinting = False
    options.desubroutinize = True
    options.notdef_outline = True
    options.glyph_names = False
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
    options.name_languages = [0x409]
    options.recalc_bounds = True
    options.drop_tables += ["DSIG", "GDEF", "GPOS", "GSUB", "BASE", "vhea", "vmtx", "VORG"]
    font = TTFont(str(source), fontNumber=FONT_NUMBER, lazy=True)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=[ord(ch) for ch in sorted(wanted)])
    subsetter.subset(font)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    subset.save_font(font, str(OUTPUT), options)
    font.close()
    CHARS_FILE.write_text("".join(sorted(wanted)) + "\n", encoding="utf-8")
    print("만들었습니다: %s (%d자, %.1f KB)" % (OUTPUT.relative_to(ROOT), len(wanted), OUTPUT.stat().st_size / 1024))
    print("장면에 쓰인 글자 중 나눔손글씨 펜에 없는 글자: %d자" % len(needed))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
