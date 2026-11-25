#!/usr/bin/env python3
"""수학 부분 글꼴(QMath)을 만듭니다.

나눔손글씨 펜(NanumPenScript)에는 그리스 문자와 수학 기호가 없습니다(ASCII·한글·≠±×÷°† 만 있음).
이 스크립트는 DejaVu Sans 에서 content/SCHEMA.md '글꼴·글자 집합' 의 글자 + ASCII 만 잘라
assets/QMath-subset.ttf 로 저장합니다. 빌드(build.mjs)는 이 파일을 base64 @font-face 로 내장하고,
장면의 모든 글자가 NanumPenScript 또는 QMath 중 하나에 있는지 확인해 하나라도 없으면 빌드를 실패시킵니다.

  python3 subset_font.py            # 글자 집합이 바뀐 경우에만 다시 만듭니다
  python3 subset_font.py --force    # 항상 다시 만듭니다
  python3 subset_font.py --check    # 파일을 쓰지 않고 기존 부분 글꼴이 글자 집합을 모두 덮는지만 확인합니다
  python3 subset_font.py --face oblique   # 기울인 서체(DejaVuSans-Oblique)로 만들기 (기본: regular)

필요: fonttools (pip install fonttools). 원본은 시스템의 fonts-dejavu-core 패키지(/usr/share/fonts/truetype/dejavu/)입니다.
DejaVu 글꼴은 Bitstream Vera 라이선스(수정·재배포 허용, 수정본은 이름에 "Bitstream"·"Vera" 를 쓰지 않을 것)이며
전문은 assets/LICENSE-DejaVu.txt 에 있습니다. 결과 글꼴의 이름은 "QMath" 로 바꾸고(라이선스 조건), 저작권 문구는 남깁니다.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent
FACES = {
    "regular": "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "oblique": "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf",
    "bold": "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
}
OUTPUT = ROOT / "assets" / "QMath-subset.ttf"

# SCHEMA.md '글꼴·글자 집합 (보장)' 과 같은 목록입니다. 고치면 SCHEMA 와 validate.mjs 의 설명도 함께 고치세요.
GUARANTEED = (
    "≠±×÷°"
    "αβγδεθλμνπρστφψω" "ΓΔΘΛΣΦΨΩ" "ħℏℓ"
    "≥≤≈≡∼∝∈√∞∫∂∇∑∏⊗⊕†‖⊥·"
    "→←↑↓↔⇒⇔⟨⟩½′″…–—✓ℂℝ"
)
ASCII = "".join(chr(c) for c in range(0x20, 0x7F))
# 참고문헌의 인명(Schrödinger, Gödel, Łukasiewicz ...)과 따옴표를 위한 여유분: 라틴-1·라틴 확장 A 와 둥근 따옴표.
EXTRA = "".join(chr(c) for c in range(0xA1, 0x180) if c != 0xAD) + "‘’“”"
WANTED = set(GUARANTEED) | set(ASCII) | set(EXTRA)


def cmap_of(path: Path) -> set[int]:
    return set(TTFont(str(path), lazy=True).getBestCmap().keys())


def covers_ok() -> bool:
    if not OUTPUT.exists():
        return False
    have = cmap_of(OUTPUT)
    return all(ord(ch) in have for ch in WANTED)


def rename(font: TTFont) -> None:
    """라이선스 조건: 수정본은 원본 이름을 쓰지 않습니다. 저작권(0)·라이선스(13,14)는 남기고 이름만 QMath 로 바꿉니다."""
    for record in list(font["name"].names):
        if record.nameID in (1, 16):
            record.string = "QMath"
        elif record.nameID in (2, 17):
            record.string = "Regular"
        elif record.nameID == 3:
            record.string = "QMath-Regular; subset of DejaVu Sans (Bitstream Vera License)"
        elif record.nameID == 4:
            record.string = "QMath Regular"
        elif record.nameID == 6:
            record.string = "QMath-Regular"
        elif record.nameID in (18, 21, 22, 25):
            font["name"].names.remove(record)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--force", action="store_true", help="글자 집합이 같아도 다시 만듭니다")
    parser.add_argument("--check", action="store_true", help="파일을 쓰지 않고 덮는지만 확인합니다")
    parser.add_argument("--face", choices=sorted(FACES), default="regular", help="원본 서체 (기본 regular)")
    parser.add_argument("--out", help="출력 경로(시험용; 기본 assets/QMath-subset.ttf)")
    args = parser.parse_args()

    if args.check:
        ok = covers_ok()
        print("QMath 부분 글꼴이 글자 집합을 모두 덮습니다" if ok else "QMath 부분 글꼴이 없거나 글자가 모자랍니다")
        return 0 if ok else 1

    out = Path(args.out) if args.out else OUTPUT
    if not args.force and not args.out and covers_ok():
        print("이미 최신입니다 (--force 로 다시 만들 수 있습니다):", out)
        return 0

    source = Path(FACES[args.face])
    if not source.exists():
        sys.exit(f"{source} 가 없습니다. fonts-dejavu-core 패키지를 설치하세요 (apt install fonts-dejavu-core).")
    missing = sorted(ch for ch in WANTED if ord(ch) not in cmap_of(source))
    if missing:
        sys.exit("원본 글꼴에 없는 글자: " + " ".join(missing))

    options = subset.Options()
    options.layout_features = []  # 합자·커닝 등은 쓰지 않습니다(Canvas 에서 글자 하나씩 그립니다)
    options.hinting = False
    options.notdef_outline = True
    options.name_IDs = [0, 1, 2, 3, 4, 6, 13, 14]
    options.name_languages = [0x409]
    options.glyph_names = False
    options.drop_tables += ["DSIG", "GDEF", "GPOS", "GSUB", "kern", "FFTM"]
    font = TTFont(str(source))
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=[ord(ch) for ch in sorted(WANTED)])
    subsetter.subset(font)
    rename(font)
    out.parent.mkdir(parents=True, exist_ok=True)
    font.save(str(out))
    have = cmap_of(out)
    short = [ch for ch in WANTED if ord(ch) not in have]
    if short:
        sys.exit("부분 글꼴에 글자가 빠졌습니다: " + " ".join(short))
    print(f"{out} ({out.stat().st_size} bytes, 글자 {len(have)}개, 원본 {source.name})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
