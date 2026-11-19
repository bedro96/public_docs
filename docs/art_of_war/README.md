# 손자병법 칠판 강의

《손자병법》 13편을 "싸우기 전에 이기는 판단"이라는 하나의 흐름으로 읽는 8단계 칠판 강의입니다.
네트워크 없이 `art-of-war.html` 한 파일만 열면 재생됩니다.

- 열기: [`art-of-war.html`](art-of-war.html) 을 브라우저로 엽니다. (서버·설치 불필요)
- 조작: `→`/`Space` 다음, `←` 이전, `Home`/`End` 처음·끝, `1`~`8` 단계 이동, `N` 강의 노트, `Esc` 닫기, `T` 화면 전환
- 구성: 단계 8개 · 노드 10개 · 간선 10개 · 오디오 없음

## 출처와 범위

이 강의는 **일반 개요**이며, 아래 영상에서 영감을 받아 구성했습니다.

| 항목 | 내용 |
| --- | --- |
| 영상 | 〈절대 지지 않는 법 ─ 《손자병법》 90분 완전 해설〉 |
| 채널 | [인문학이랑](https://www.youtube.com/@humanitieserang) |
| 링크 | <https://www.youtube.com/watch?v=MfY0Xaa1P2g&t=1143s> (19:03 위치로 열림) |

- **확인한 것은 영상의 제목과 채널뿐입니다.** 영상의 자막, 설명, 장(챕터) 구분, 19:03 구간의 내용은 확인하지 못했습니다.
- 따라서 이 페이지의 어떤 설명도 영상 속 발언이나 19:03 구간의 내용으로 소개하지 않습니다.
- 19:03 은 영상 링크가 열리는 위치일 뿐, 그 구간을 근거로 삼았다는 뜻이 아닙니다.
- 본문과 '강의 노트'는 《손자병법》 원전을 바탕으로 한 일반 해설입니다. '현대적 해석'은 이해를 돕기 위한 적용 예입니다.
- 저자(孫武)와 성립 시기, 판본에 관해서는 학계의 논의가 이어지고 있어 단정하지 않았습니다.

## 파일

| 파일 | 역할 |
| --- | --- |
| `art-of-war.scene.json` | **편집하는 원본.** 노드·간선·8단계·강의 노트(`handout`)·출처(`source`) |
| `build.mjs` | 장면 검증 → chalk-talk 엔진 빌드 → 한국어 후처리 → 결과물 점검 |
| `art-of-war.html` | 생성 결과(수정하지 않음). 이 폴더의 유일한 HTML |
| `tests/build.test.mjs` | 장면 규칙과 결과물 점검 테스트 |

## 빌드

```bash
cd docs/art_of_war
node build.mjs            # art-of-war.html 생성
node build.mjs --verify   # 장면과 결과물이 어긋났는지만 확인 (파일을 쓰지 않음)
```

엔진은 `CHALK_TALK_DIR` → 저장소의 `.github/skills/chalk-talk` → `~/.agents/skills/chalk-talk` 순서로 찾습니다.
엔진 파일은 수정하지 않고, 엔진이 만든 결과에 아래 후처리를 덧붙입니다. 기준 문자열이 한 번씩만 일치하지 않으면 빌드가 실패합니다.

- 외부 글꼴(Google Fonts) 링크 제거. 한글 시스템 글꼴 스택(`Noto Sans CJK KR`, `Nanum…`, `Malgun Gothic`, `Apple SD Gothic Neo` 등)으로 대체하고, 템플릿 기본값에 남은 `Geist` 글꼴 이름도 같은 스택으로 교체
- 하단 `칠판 강의 · chalk-talk` 표기의 투명도를 없애 글자 대비를 4.5:1 이상으로 유지
- 컨트롤 레이블·툴팁·`<title>`·스크린리더용 제목을 한국어로 교체, `lang="ko"`
- 출처 푸터(채널, 영상 링크, 범위 안내)
- '강의 노트' 서랍: 장면의 `steps[].handout` 만 읽어 현재 단계에 맞춰 표시 (`N` 키 또는 버튼, `?notes` 로 열린 채 시작)

### 빌드가 거부하는 것

`proof: true`, `code`·`calls`·`inferred` 키, `handout` 의 네 필드(`ref`, `classic`, `limit`, `modern`) 외 키, 영상 장(챕터) 링크,
`source.verified` 가 `["title","channel"]` 이 아닌 경우, 링크 시각과 `source.at` 불일치, 외부 주소·스크립트·이미지·오디오·네트워크 호출이 결과물에 남은 경우.

## 점검

```bash
mkdir -p ~/.cache/aowc
TMPDIR=$HOME/.cache/aowc node "$(realpath ~/.agents/skills/chalk-talk/scripts/check.mjs)" \
  docs/art_of_war/art-of-war.html ~/.cache/aowc/snaps
node --test docs/art_of_war/tests/build.test.mjs
rm -rf ~/.cache/aowc
```

- `check.mjs` 는 반드시 **실제 경로**(`realpath`)로 실행합니다. 심볼릭 링크 경로로 실행하면 아무것도 점검하지 않고 성공(종료 코드 0)으로 끝납니다.
- `TMPDIR` 는 짧은 경로로 지정합니다. 경로가 길면 Chrome 이 소켓을 만들지 못해 "page did not produce a report" 로 실패할 수 있습니다.
- 스냅샷은 저장소 밖(`~/.cache/aowc/snaps`)에 저장해 폴더에 `.png` 가 남지 않게 합니다.
- 기대 결과: `steps: 8   errors: 0   warnings: 0`
- 디자인 검사(선택): `impeccable detect docs/art_of_war/art-of-war.html` 과 `impeccable detect file://<절대경로>/art-of-war.html` 모두 결과 `[]`

## 장면 수정

`art-of-war.scene.json` 을 고친 뒤 `node build.mjs` 를 다시 실행합니다. 단계 수(8), 노드·간선 수(10/10)를 바꾸면 테스트가 실패하므로, 구조를 바꿀 때는 테스트의 기대값도 함께 고칩니다.
한 줄 설명을 길게 늘리면 칠판 위 글자가 겹칠 수 있으니 수정 후 점검을 다시 실행하세요.

## 한계

- 13편 전체를 해설하는 자료가 아니라, 판단의 흐름을 8단계로 요약한 개요입니다.
- 원문 인용은 짧은 구절에 한정하며, 번역·풀이는 이 저장소에서 쓴 요약입니다.
- 화면 구성은 chalk-talk 엔진의 칠판 스타일을 따르며, 글꼴은 사용하는 기기에 설치된 한글 시스템 글꼴에 의존합니다.
