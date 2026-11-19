# 타원곡선 칠판 강의

곡선 위의 덧셈에서 Ed25519 인증서 서명까지, 8단계로 이어지는 **소리 없는** 한국어 칠판 강의입니다.
파일 하나(`elliptic-curve.html`)만 열면 인터넷 없이도 그대로 재생됩니다.

- 열기: `elliptic-curve.html`을 브라우저로 열기 (서버 불필요)
- 작성: Microsoft Korea STU
- 방식: 칠판 위에 하나씩 그려지는 판서 + 한두 문장 설명 + 한 줄 정리 (음성·효과음 없음)

## 강의 구성

| 단계 | 질문 | 핵심 |
|---|---|---|
| 1 | 타원곡선은 어떻게 생겼을까? | `y^2 = x^3 + ax + b`, 판별식 `4a^3 + 27b^2 != 0`, x축 대칭 |
| 2 | 점 두 개를 어떻게 더할까? | 현(두 점을 지나는 직선), 세 번째 교점을 뒤집기, 접선, 무한원점 `O` |
| 3 | 같은 점을 여러 번 더하면? | `P, 2P, 3P, 4P`, 두 배 하기와 더하기로 `kP` 계산 |
| 4 | 진짜 암호는 어디서 계산할까? | 유한체 `F17` 위의 곡선, 위수 19, `13G = (16, 4)` |
| 5 | 왜 안전하다고 할까? | 타원곡선 이산로그 문제(ECDLP), 알려진 효율적인 고전 알고리즘이 없음 |
| 6 | 예외 없는 덧셈 공식 | 뒤틀린 에드워즈 곡선, `-x^2 + y^2 = 1 + d x^2 y^2` |
| 7 | Ed25519는 서명 방식이에요 | `p = 2^255 - 19`, `d = -121665/121666`, 서명·검증 |
| 8 | 인증서는 서명된 문서예요 | X.509 인증서에 CA가 서명, 모든 인증서가 Ed25519를 쓰는 건 아님 |

### 검증된 예제 값 (모두 `ecmath.test.mjs`가 정확한 정수·분수 연산으로 확인합니다)

- 곡선 `y^2 = x^3 - 4x + 4` (판별식 176)
  - 현: `P(-2, 2)`, `Q(1, -1)`, 세 번째 교점 `R(2, -2)`, `P + Q = (2, 2)`
  - 접선: `P(0, 2)`에서 `2P = (1, -1)`, `3P = (8, 22)`, `4P = (-7/4, 19/8)`
- 장난감 곡선 `F17`의 `y^2 = x^3 + 2x + 2`: 기준점 `G = (5, 1)`의 위수 19, `13G = (16, 4)`
- 에드워즈 곡선과 Ed25519: 상수와 기준점 `B`, 위수 `L`이 RFC 8032와 같고, 공개키·서명이 Node의 `node:crypto`(Ed25519) 결과와 바이트 단위로 일치하며 RFC 8032 시험 벡터 1을 통과

## 꼭 알아 둘 점

- **실수 평면의 곡선 그림은 비유입니다.** 매끈한 곡선은 이해를 돕는 그림일 뿐이고, 실제 암호는 같은 식을 유한체(나머지 계산) 위에서 쓰기 때문에 점이 흩어져 있습니다. 4단계에서 직접 확인합니다.
- **ECDLP는 "풀 수 없다"가 아닙니다.** 이 강의는 "알려진 효율적인 고전 알고리즘이 없다. 하지만 어려움이 증명된 것은 아니다"라고 말합니다. 양자 컴퓨터는 "충분히 큰 양자 컴퓨터는 쇼어 알고리즘으로 풀 수 있다고 알려져 있다"고만 언급하고, 연도나 큐비트 수는 단정하지 않습니다.
- **Ed25519는 서명 방식입니다.** 암호화도 키 교환도 아닙니다(키 교환은 같은 곡선 계열의 X25519가 따로 있습니다). 인증서가 Ed25519 서명을 *쓸 수는* 있지만, 모든 인증서가 쓰는 것은 아닙니다.
- 연도 숫자와 출처 없는 통계는 넣지 않았습니다.

## 폴더 구성

```
docs/elliptic_curve/
├─ elliptic-curve.html        # 결과물: 단독 실행 HTML (빌드로 생성, 글꼴 포함 약 4.2 MB)
├─ elliptic-curve.scene.json  # 편집하는 원본: 8단계의 글·수식·판서 순서
├─ template.html              # 페이지 뼈대
├─ style.css                  # 스타일 (칠판, 반응형, 줄어든 동작)
├─ player.js                  # Canvas 판서·컨트롤·재생기 (window.ellipticPlayer)
├─ ecmath.js                  # 정확한 수학(BigInt 분수, F_p, 바이어슈트라스·에드워즈·Ed25519)과 서식 토큰
├─ build.mjs                  # 검증 + 단독 HTML 조립
├─ ecmath.test.mjs            # 수학 단위 시험
├─ lesson.test.mjs            # 장면·빌드·산출물 시험
├─ verify_browser.py          # Playwright 브라우저 검증
├─ README.md
└─ assets/
   ├─ NanumPenScript-Regular.ttf   # 칠판 글꼴(나눔손글씨 펜, SIL OFL 1.1)
   └─ OFL.txt                      # 글꼴 라이선스
```

이 폴더에는 HTML이 `elliptic-curve.html`(결과물)과 `template.html`(뼈대) 둘뿐이어야 합니다. 빌드가 이를 강제합니다. 강의 목록(`docs/index.html`) 쪽 등록은 이 작업과 별개로 다른 담당이 관리합니다.

## 왜 Canvas 렌더러를 직접 만들었나

기본 chalk-talk 엔진은 시스템 블록 다이어그램용이라 좌표평면 위의 곡선, 현과 접선, 유한체의 점 격자를 그릴 수 없습니다. 그래서 `docs/linear-function`의 방식을 바탕으로 이 폴더 안에 Canvas 렌더러를 두었습니다. SVG를 손으로 쓰지 않고, 모든 도형은 장면 JSON의 요소(`curve`, `point`, `line` ...)에서 `player.js`가 계산해 그립니다. 수학 그래프에 한해서만 Canvas로 직접 그립니다.

- **등축**: 좌표평면은 가로·세로 눈금이 같은 배율(정사각형 칸)이라 곡선과 접선의 모양이 왜곡되지 않습니다.
- **오프라인**: 글꼴은 HTML 안에 base64로 들어 있고, 외부 URL·구글 글꼴·`fetch`·`innerHTML`은 빌드가 막습니다.
- **줄어든 동작**(`prefers-reduced-motion`): 판서를 건너뛰고 완성된 칠판을 바로 보여 줍니다. 재생 버튼은 "다음 단계 보기"가 됩니다.

## 명령어

모든 명령은 이 폴더(`docs/elliptic_curve`)에서 실행합니다. 의존 패키지는 없습니다(Node.js 24에서 확인; `BigInt`와 `node:test`를 쓰므로 최신 LTS를 권장합니다. 브라우저 검증만 Python Playwright와 Chrome이 필요합니다).

```bash
node build.mjs          # 원본 검증 + elliptic-curve.html 생성
node --test             # ecmath.test.mjs + lesson.test.mjs 실행
python3 verify_browser.py --artifacts <스크린샷을 저장할 폴더>
```

`verify_browser.py`는 Chrome으로 1440 / 1024 / 390 px 너비, 줄어든 동작, 오프라인(네트워크 요청 0건), 자동 넘김(가짜 시계)을 점검하고 단계별 스크린샷과 `report.json`을 `--artifacts` 폴더에 저장합니다. 저장소 안이 아니라 임시 폴더를 지정하세요.

### 빌드가 실패하는 경우

- 장면 JSON이 깨졌거나 알 수 없는 요소·색·서식 토큰을 썼을 때
- 수식 `expect`(기대값)가 실제 정확 연산과 다를 때
- 칠판 글꼴에 없는 글자(예: `²`, `³`, `→`, `∞`, `λ`)가 판서에 들어갔을 때
- 외부 URL, `@import`, 구글 글꼴, `fetch`/`XMLHttpRequest`, `innerHTML` 등이 템플릿·스타일·스크립트에 있을 때
- 이 폴더에 `elliptic-curve.html`, `template.html` 외의 HTML이 있을 때

## 장면 파일(`elliptic-curve.scene.json`) 편집

최상위: `schema`(`elliptic-curve-lesson/1`), `lang`(`ko`), `eyebrow`, `title`, `subtitle`, `author`, `ui`, `steps`, `misconceptions`, `references`.

각 단계(`steps[]`)는 다음을 가집니다.

| 필드 | 설명 |
|---|---|
| `id`, `nav`, `title` | 식별자, 단계 목록에 쓰는 짧은 이름, 제목 |
| `tag` | `{ tone: "analogy" or "real", text }` 이 그림이 비유인지 실제 계산인지 표시 |
| `summary` | 한 줄 정리 |
| `beats[]` | `{ at, text }` 판서가 진행되는 동안 순서대로 나오는 설명(초 단위) |
| `callout` | `{ tone: "info", "warn", "ok", title, text }` 주의·정리 상자 |
| `legend[]` | 범례(`style`: line, dot, dash, bar, box) |
| `alt` | 칠판 그림을 말로 풀어 쓴 대체 텍스트 (스크린 리더용) |
| `math` | 정확 연산 정의. `curve`(모델·체·계수), `points`(점과 `add`/`mul`/`neg`/`inf` 연산, `expect` 기대값), `checks`(판별식·위수 등) |
| `board` | `kind`와 `elements[]`. 종류별 허용 요소는 아래 표 |
| `panel[]` | 칠판 옆 판서 줄 `{ text, color, size: xl/l/m/s, at }` |

`board.kind`별 요소:

| kind | 요소 | 용도 |
|---|---|---|
| `plane` | `axes`, `curve`, `point`, `line`, `tangent`, `link` | 실수 평면(등축) 위의 곡선, 현, 접선 |
| `finite` | `axes`, `dots`, `orbit`, `point`, `hline` | 유한체의 점 격자와 `G, 2G, ...` 궤도 |
| `bars` | `bar` | 로그 눈금 막대 비교 |
| `flow` | `node` | 상자와 화살표 흐름 (서명, 인증서) |

공통 규칙:

- 점은 `math.points`의 이름으로 참조합니다(`"ref": "P"`). 좌표는 직접 쓰지 않고, 라벨에 `[[P]]`를 쓰면 정확 연산 결과의 좌표로 치환됩니다.
- 모든 요소의 `at`(시작 초)와 `dur`(그리는 시간 초)로 판서 순서를 정합니다. 점 라벨이 겹칠 때 쓰는 대체 짧은 이름은 `"short": "3P"`처럼 `label`과 함께 둡니다.
- `beats`의 마지막 시각은 판서가 끝나는 시각에서 1초 이상 늦지 않아야 합니다.
- 색은 `white`, `mint`, `yellow`, `pink`, `sky`, `orange` 여섯 가지만 씁니다.

### 글자 쓰는 법 (칠판 글꼴이 가진 글자만)

나눔손글씨 펜에는 `²`, `³`, `−`, `·`, `→`, `≈`, `≡`, `∞`, `λ`, `π` 같은 기호가 없습니다. 그래서 다음 토큰을 쓰고, 렌더러가 안전하게 위첨자·아래첨자·굵게로 그립니다(HTML 문자열은 쓰지 않습니다).

| 입력 | 결과 |
|---|---|
| `y^{2}` , `2^{255}` | 위첨자 (y², 2²⁵⁵) |
| `x_{R}`, `x_{P}` | 아래첨자 |
| `**강조**` | 굵게 |
| 마이너스 | 반드시 ASCII `-` |
| `[[R]]` | `math.points`의 점 `R`을 정확 좌표 `(2, -2)`로 치환 |

빌드가 모든 판서 글자를 글꼴의 cmap에서 확인하므로, 지원하지 않는 글자는 오류 위치와 함께 빌드 단계에서 잡힙니다.

## 재생기 사용법

- 하단 컨트롤: 재생/일시정지, 이전/다음, 다시 그리기, 속도, 자동 넘김, 단계 목록
- 키보드: `Space` 재생/일시정지, `←` `→` 이전/다음, `1`부터 `8`까지 단계로 바로 이동
- 처음에는 빈 칠판과 안내("눌러서 판서 시작")를 보여 주고, 재생을 눌러야 판서가 시작됩니다. 소리는 나지 않습니다.
- 자동 넘김을 켜 두면 설명을 읽을 시간을 두고 다음 단계로 넘어가며, 마지막 단계에서 멈춥니다.

### `window.ellipticPlayer` (시험·자동화용)

`getState()`는 `{ ready, index, count, id, kind, playing, started, reduced, auto, speed, t, animEnd, complete, progress, canvas, plot, warnings }`를 돌려줍니다. `plot`에는 좌표평면의 `xPxPerUnit`, `yPxPerUnit`(등축이므로 같은 값)이 들어 있습니다. 그 밖의 메서드는 `goTo(i)`, `play()`, `pause()`, `toggle()`, `next()`, `prev()`, `replay()`, `restart()`, `seek(i, t | 'end')`, `setSpeed(x)`, `setAuto(bool)`, `layoutReport()`, `steps`입니다.

## 참고

- 글꼴: 나눔손글씨 펜(Nanum Pen Script), SIL Open Font License 1.1. `assets/OFL.txt` 참조.
- 표준과 논문: RFC 8032(Ed25519), RFC 7748(X25519), RFC 8410(X.509의 Ed25519 식별자), RFC 5280(X.509 인증서), 뒤틀린 에드워즈 곡선과 Ed25519 논문. 전체 목록은 `elliptic-curve.scene.json`의 `references`와 페이지 하단 "참고 문서" 카드에 있습니다.
- 이 강의는 개념 설명용이며, 실제 시스템의 암호 구현을 직접 만들 때는 검증된 라이브러리를 사용하세요.
