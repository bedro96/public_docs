# 타원곡선 칠판 강의

곡선 위의 덧셈에서 Ed25519 인증서 서명까지, 8단계로 이어지는 **해설이 있는** 한국어 칠판 강의입니다.
단계마다 ko-KR-Haena 목소리의 AI 합성 해설이 흐르고, 칠판 위의 판서가 그 해설 시계를 따라 그려집니다.
파일 하나(`elliptic-curve.html`)만 열면 인터넷 없이도 해설 음성과 분필 소리까지 그대로 재생됩니다.

- 열기: `elliptic-curve.html`을 브라우저로 열기 (서버 불필요). 소리는 재생 버튼을 눌러야 시작됩니다(브라우저 정책).
- 작성: Microsoft Korea STU
- 방식: 칠판 위에 하나씩 그려지는 판서 + 한두 문장 설명 + 한 줄 정리 + **해설 음성(MP3 8개, 단계마다 1개)** + 글씨가 닿는 순간에만 나는 **분필 소리**

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
├─ elliptic-curve.html        # 결과물: 단독 실행 HTML (빌드로 생성, 글꼴·해설 MP3·분필 녹음 포함 약 11 MB)
├─ elliptic-curve.scene.json  # 편집하는 원본: 8단계의 글·수식·판서 순서·해설 대본(narration)
├─ template.html              # 페이지 뼈대 (해설·분필 컨트롤 포함)
├─ style.css                  # 스타일 (칠판, 반응형, 줄어든 동작)
├─ player.js                  # Canvas 판서·해설 시계·분필 소리·컨트롤 (window.ellipticPlayer)
├─ ecmath.js                  # 정확한 수학(BigInt 분수, F_p, 바이어슈트라스·에드워즈·Ed25519)과 서식 토큰
├─ build.mjs                  # 검증 + MP3 내장 + 단독 HTML 조립
├─ narrate.py                 # 해설 대본 → ko-KR-Haena MP3 생성 (Foundry / Azure AI Speech)
├─ requirements-audio.txt     # narrate.py 의존 패키지 (빌드·재생에는 필요 없음)
├─ ecmath.test.mjs            # 수학 단위 시험
├─ lesson.test.mjs            # 장면·빌드·해설 계약·산출물·README 시험
├─ player.test.mjs            # 재생기 시계·자동 넘김·해설/분필 상태 시험 (가짜 오디오, 브라우저 불필요)
├─ verify_browser.py          # Playwright 브라우저 검증 (화면·조작·자동 넘김·줄어든 동작)
├─ verify_media.py            # Playwright 실제 소리 재생 검증 (해설 시계·일시정지·수명주기·오류)
├─ verify_chalk.py            # 분필 소리 검증 (녹음 소스, 접촉 동기, 음량 상한, 공백 무음)
├─ README.md
├─ audio/
│  ├─ shape.mp3 … x509.mp3    # 단계별 해설 8개 (ko-KR-Haena, 24 kHz 모노)
│  ├─ durations.json          # 클립 길이(초) — 판서 시계와 진행 막대의 기준
│  └─ provider.json           # 목소리·모델·대본 해시 (대본이 바뀌면 다시 만들어야 함을 빌드가 알림)
└─ assets/
   ├─ NanumPenScript-Regular.ttf   # 칠판 글꼴(나눔손글씨 펜, SIL OFL 1.1)
   ├─ OFL.txt                      # 글꼴 라이선스
   ├─ chalk-writing.mp3            # 실제 칠판 녹음(CC0) 14초
   └─ chalk-writing-source.json    # 분필 녹음 출처·라이선스·편집 내역
```

이 폴더에는 HTML이 `elliptic-curve.html`(결과물)과 `template.html`(뼈대) 둘뿐이어야 합니다. 빌드가 이를 강제합니다. 강의 목록(`docs/index.html`) 쪽 등록은 이 작업과 별개로 다른 담당이 관리합니다.

## 소리: 해설 음성과 분필 소리

### 해설 음성 (재생기의 기준 시계)

- 목소리는 **ko-KR-Haena**(모델 **MAI-Voice-2**, Microsoft Foundry / Azure AI Speech)입니다. AI로 합성한 음성이며, 화면 위쪽 칩과 컨트롤에 그 사실을 적어 둡니다.
- 대본은 `elliptic-curve.scene.json`의 `steps[].narration`입니다. 화면의 "해설 대본 보기"에도 그대로 나와 소리를 못 들을 때도 내용을 읽을 수 있습니다. 숫자·기호는 한글로 풀어 써서 목소리가 읽는 방식을 예측할 수 있게 했습니다.
- 해설이 켜져 있으면 **오디오의 `currentTime`이 판서 시계**입니다. 재생 속도(0.75–1.5배)는 오디오 `playbackRate`에 그대로 적용되고, 판서가 해설과 어긋나지 않습니다.
- **단계가 끝난 것은 "판서가 끝났고 해설도 끝났을 때"**입니다. 판서가 먼저 끝나면 칠판은 완성된 채 해설이 끝나기를 기다립니다(상태: "판서 완료 · 해설을 마저 듣는 중"). 해설을 끄면 판서가 끝나는 시점이 곧 단계의 끝입니다.
- 자동 넘김이 켜져 있으면 단계가 끝난 뒤 **0.9초**의 간격을 두고 다음 단계로 넘어갑니다. 그 사이에는 "n단계 완료 · 0.9초 뒤 다음 단계로 넘어가요"라고 상태가 나옵니다. 판서 중이 아닌데 "판서 중"이라고 말하거나 말없이 멈추는 일은 없습니다.
- 이전·다음·단계 목록·숫자 키·해시 이동은 이전 단계의 소리를 즉시 멈추고 새 단계를 해설과 함께 시작합니다.
- 브라우저가 소리 재생을 막으면(`NotAllowedError`) 판서를 소리 없이 흘려보내지 않고 멈춘 뒤 "브라우저가 소리 재생을 막았어요. 재생 버튼을 한 번 더 눌러 주세요."라고 알립니다. 해설 파일을 읽지 못하거나 재생에 실패하면 이유를 화면에 보이고(`voiceError`), 그 단계는 판서 시계로 계속됩니다. 대체 합성음(브라우저 음성합성 등)은 쓰지 않습니다.
- 탭이 가려지거나(`visibilitychange`) 페이지를 떠나면(`pagehide`) 해설과 분필이 모두 멈추고, 돌아와서 재생을 누르면 이어집니다.
- 단계를 옮기거나 같은 단계를 다시 재생한 직후 **이전 클립에서 늦게 도착한 `ended`·`pause` 이벤트는 무시**합니다. 이벤트가 전달되는 시점에 요소가 정말 이 단계 클립의 끝에 닿았는지(`ended`이고 `currentTime`이 클립 길이 가까이)·아직 멈춰 있는지를 확인하므로, 새 해설을 완료로 오판하거나 멈추지 않습니다.

### 분필 소리

- **실제 칠판 녹음만** 씁니다. 출처는 **digitale.de — Writing with Chalk / Chalkboard**, [Freesound 178433](https://freesound.org/people/digitale.de/sounds/178433/), 라이선스 **CC0-1.0**입니다. 사용한 구간·필터·정규화는 `assets/chalk-writing-source.json`에 기록했고, 합성 소리나 소리 합성기로 만든 대체음은 없습니다.
- 글자마다 새로 녹음한 것은 아닙니다. 녹음의 서로 다른 부분을 화면의 **분필 접촉**(글씨·선·점이 실제로 그려지는 순간)에 맞춰 재생합니다. 공백, 판서 사이의 쉬는 구간, 일시정지에서는 소리가 나지 않습니다.
- 최대 출력은 작게 제한했고(해설을 가리지 않도록), 슬라이더 기본값은 **25%**이며 표시도 "25%"입니다. 0%는 완전한 무음입니다.
- 분필 소리를 켜고 끄는 토글, 해설 음성 토글, 분필 음량 슬라이더가 컨트롤에 있습니다.
- 분필 녹음을 해독하지 못하면 이유가 화면에 보이고 강의는 계속됩니다(이때도 대체음은 없습니다).

### 해설 음성 다시 만들기

대본을 고친 뒤에는 MP3를 다시 만들어야 합니다(빌드가 대본 해시 불일치를 알려 줍니다). `narrate.py`는 Azure CLI 로그인(Microsoft Entra ID)만 쓰며 키를 저장하지 않습니다.

```bash
python3 -m venv .venv && . .venv/bin/activate     # .venv 는 git 에서 제외됩니다
pip install -r requirements-audio.txt
az login
python3 narrate.py --smoke                       # 목소리·인증 확인(짧은 클립)
python3 narrate.py                               # 없는 클립만 생성
python3 narrate.py --only chord --force          # 한 단계만 다시 생성
node build.mjs                                   # 새 MP3 를 HTML 에 내장
```

한 단계의 대본은 450자 이하여야 합니다(MAI-Voice-2의 입력 길이 제한).

## 왜 Canvas 렌더러를 직접 만들었나

기본 chalk-talk 엔진은 시스템 블록 다이어그램용이라 좌표평면 위의 곡선, 현과 접선, 유한체의 점 격자를 그릴 수 없습니다. 그래서 `docs/linear-function`의 방식을 바탕으로 이 폴더 안에 Canvas 렌더러를 두었습니다. SVG를 손으로 쓰지 않고, 모든 도형은 장면 JSON의 요소(`curve`, `point`, `line` ...)에서 `player.js`가 계산해 그립니다. 수학 그래프에 한해서만 Canvas로 직접 그립니다.

- **등축**: 좌표평면은 가로·세로 눈금이 같은 배율(정사각형 칸)이라 곡선과 접선의 모양이 왜곡되지 않습니다.
- **오프라인**: 글꼴, 해설 MP3 8개, 분필 녹음은 HTML 안에 base64(`data:`)로 들어 있고, 외부 URL·구글 글꼴·`fetch`·`innerHTML`은 빌드가, 브라우저 음성합성·합성 소리 API는 시험이 막습니다. 내장 MP3의 메타데이터(ID3·URL 태그)는 빌드가 제거합니다.
- **줄어든 동작**(`prefers-reduced-motion`): 판서 애니메이션을 건너뛰고 완성된 칠판을 바로 보여 줍니다. 해설은 그대로 쓸 수 있습니다. 재생 버튼은 "이 단계 재생"이 되어 칠판은 그대로 두고 해설만 재생하고, 자동 넘김이 켜져 있으면 해설이 끝난 뒤 0.9초 간격으로 다음 단계의 완성된 칠판과 해설로 넘어갑니다. 해설을 끄면 소리도 시계도 없으므로 자동 넘김은 "불가"로 표시되고(`aria-disabled`), 재생 버튼은 "다음 단계 보기"가 되어 눌러야 다음 단계를 보여 줍니다.

## 명령어

모든 명령은 이 폴더(`docs/elliptic_curve`)에서 실행합니다. 빌드와 Node 시험에는 의존 패키지가 없습니다(Node.js 24에서 확인; `BigInt`와 `node:test`를 쓰므로 최신 LTS를 권장합니다). 브라우저·소리 검증은 Python Playwright와 Chrome이, 해설 MP3 재생성(`narrate.py`)은 `requirements-audio.txt`가 필요합니다.

```bash
node build.mjs          # 원본 검증 + MP3 검증·내장 + elliptic-curve.html 생성
node --test             # ecmath + lesson + player 시험 (브라우저 불필요)
python3 verify_browser.py --artifacts <스크린샷을 저장할 폴더>
python3 verify_media.py  --artifacts <보고서를 저장할 폴더>
python3 verify_chalk.py  --artifacts <보고서를 저장할 폴더>
```

- `player.test.mjs`: 가짜 `Audio`/`AudioContext`로 재생기의 시계와 상태기계를 시험합니다. `rAF` 타임스탬프 기준 시계, 오디오 `currentTime`이 시계가 되는 것(이중 계산 없음), 단계 완료 = 판서 끝 && 해설 끝, 0.9초 간격 뒤 자동 넘김, 자동 넘김을 껐다 켜면 완료된 단계에서 이어지는 것, 줄어든 동작, `NotAllowedError`, 해설 오류, 숨김·`pagehide`, 직접 이동 시 이전 소리 정지, 분필 접촉 동기를 다룹니다. 하나의 오디오 요소를 단계마다 재사용하므로, 이전 클립(또는 같은 단계의 이전 재생)에서 늦게 도착한 `ended`·`pause` 이벤트가 새 재생을 완료로 만들거나 멈추지 못하는지도 시험합니다(수동 이동·다시 재생 경합 3건).
- `verify_browser.py`: Chrome으로 1440 / 1024 / 390 px 너비, 줄어든 동작, 오프라인(네트워크 요청 0건), 해설·분필 컨트롤(분필 기본 25%), 자동 넘김(가짜 시계로 0.9초 간격)을 점검하고 단계별 스크린샷과 `report.json`을 `--artifacts` 폴더에 저장합니다.
- `verify_media.py`: 실제 Chrome에서 내장 MP3를 재생해 오디오 시계, 속도, 일시정지·이어서, 분필 신호, 자동 넘김, 숨김·`pagehide`, 오류 표시, 깨진 MP3, 줄어든 동작을 확인합니다.
- `verify_chalk.py`: 분필 녹음의 소스(CC0 기록), 접촉 동기, 공백 무음, 음량 상한(조용한 최대 출력)과 25% 기본값, 해독 실패 표시를 확인합니다.

저장소 안이 아니라 임시 폴더를 `--artifacts`로 지정하세요.

### 빌드가 실패하는 경우

- 장면 JSON이 깨졌거나 알 수 없는 요소·색·서식 토큰을 썼을 때
- 수식 `expect`(기대값)가 실제 정확 연산과 다를 때
- 칠판 글꼴에 없는 글자(예: `²`, `³`, `→`, `∞`, `λ`)가 판서에 들어갔을 때
- 해설 MP3가 없거나(단계마다 1개), 파일이 MP3가 아니거나, 길이·목소리·모델이 `audio/provider.json`과 다를 때, 분필 녹음이 없거나 너무 짧을 때
- 외부 URL, `@import`, 구글 글꼴, `fetch`/`XMLHttpRequest`, `innerHTML` 등이 템플릿·스타일·스크립트에 있을 때 (MP3 메타데이터에 든 URL 태그는 빌드가 미리 제거합니다). 브라우저 음성합성(`speechSynthesis`)·합성 소리 API는 `lesson.test.mjs`가 막습니다.
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

- 하단 컨트롤: 재생/일시정지, 이전/다음, 다시 그리기, 속도, 자동 넘김, **해설 음성 켬/끔**, **분필 소리 켬/끔**, **분필 음량 슬라이더(기본 25%)**, 단계 목록
- 키보드: `Space` 재생/일시정지, `←` `→` 이전/다음, `1`부터 `8`까지 단계로 바로 이동
- 처음에는 빈 칠판과 안내("눌러서 판서 시작")를 보여 주고, 재생을 눌러야 판서와 해설이 시작됩니다(소리는 브라우저 정책상 클릭 뒤에만 납니다).
- 자동 넘김을 켜 두면 한 단계의 **판서와 해설이 모두 끝난 뒤 0.9초** 있다가 다음 단계로 넘어가며, 마지막 단계에서 멈춥니다. 자동 넘김을 끄면 단계가 끝난 상태("n단계 완료")로 멈추고, 다시 켜면 그 완료된 단계에서 이어서 다음 단계로 넘어갑니다.
- 일시정지하면 해설과 분필이 모두 즉시 멈춥니다. 해설 음성을 끄면 판서가 자체 시계로 진행되고, 다시 켜면 그 단계를 해설과 함께 처음부터 시작합니다.
- 화면 상태 문구는 "판서 중" → "판서 완료 · 해설을 마저 듣는 중" → "n단계 완료 · 0.9초 뒤 다음 단계로 넘어가요"처럼 실제 상황을 말합니다(`role="status"`).

### 재생 시계 (왜 이렇게 만들었나)

- 시계는 `requestAnimationFrame`이 주는 타임스탬프를 기준으로 하나만 둡니다(첫 프레임은 기준점만 잡고, 한 프레임에 더하는 시간은 0.25초로 제한). 타이머를 다시 예약할 때 기준 시각을 덮어쓰면 프레임 지연이 시계에서 사라지고, 완료 뒤 대기 시간이 영원히 차지 않아 자동 넘김이 멈추는 문제가 생기는데, 그 원인을 이 구조로 없앴습니다.
- 해설이 시계일 때는 `audio.currentTime`을 그대로 따라가며 경과 시간을 따로 더하지 않습니다(이중 계산 없음). 오디오가 4초 넘게 진행하지 않으면 멈춘 것으로 보고 이유를 화면에 보입니다.
- 완료 뒤 기다린 실제 시간은 `hold`에 쌓이고, 기준은 `holdEnd`(0.9초)입니다. 속도 배율은 기다림에 곱하지 않습니다.

### `window.ellipticPlayer` (시험·자동화용)

`getState()`는 다음을 돌려줍니다.

| 분류 | 필드 |
|---|---|
| 진행 | `ready, index, count, id, kind, playing, started, ended, reduced, auto, autoAvailable, speed, t, animEnd, progress` |
| 완료·대기 | `complete`(판서 끝 && 해설 끝, 해설이 꺼졌거나 오류면 판서 끝), `drawDone`, `drawing`, `hold`, `holdEnd` |
| 해설 | `voiceEnabled, voiceMode`(`off`/`idle`/`embedded`/`error`), `voiceDone, voiceError, audioTime, audioDuration` |
| 분필 | `chalkEnabled, chalkVolume, chalkReady, chalkError, penDown, writingCharacter` |
| 화면 | `canvas, plot, warnings` (`plot`에는 좌표평면의 `xPxPerUnit`, `yPxPerUnit`(등축이므로 같은 값)) |

메서드는 `goTo(i)`, `play()`, `pause()`, `toggle()`, `next()`, `prev()`, `replay()`, `restart()`, `seek(i, t | 'end')`, `setSpeed(x)`, `setAuto(bool)`, `setVoiceEnabled(bool)`, `setChalkEnabled(bool)`, `setChalkVolume(0–100)`, `layoutReport()`, `steps`입니다. `seek`는 소리를 모두 멈추고 정지 화면만 만듭니다.

## 참고

- 글꼴: 나눔손글씨 펜(Nanum Pen Script), SIL Open Font License 1.1. `assets/OFL.txt` 참조.
- 해설 음성: Microsoft Foundry / Azure AI Speech의 MAI-Voice-2 `ko-KR-Haena`(AI 합성). 목소리·모델·대본 해시는 `audio/provider.json`에 있습니다.
- 분필 소리: digitale.de, "Writing with Chalk / Chalkboard"(Freesound 178433), CC0-1.0(퍼블릭 도메인 헌정). 편집 내역은 `assets/chalk-writing-source.json`.
- 표준과 논문: RFC 8032(Ed25519), RFC 7748(X25519), RFC 8410(X.509의 Ed25519 식별자), RFC 5280(X.509 인증서), 뒤틀린 에드워즈 곡선과 Ed25519 논문. 전체 목록은 `elliptic-curve.scene.json`의 `references`와 페이지 하단 "참고 문서" 카드에 있습니다.
- 이 강의는 개념 설명용이며, 실제 시스템의 암호 구현을 직접 만들 때는 검증된 라이브러리를 사용하세요.
- 이전의 읽는 시간 대기(판서 뒤 수십 초)는 없어졌습니다. 해설이 그 역할을 하며, 단계 사이의 간격은 0.9초입니다.
