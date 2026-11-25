# 양자물리학 칠판 강의

흑체복사에서 양자 컴퓨터까지, 14단계로 이어지는 **해설이 있는** 한국어 칠판 강의입니다.
단계마다 ko-KR-Haena 목소리의 AI 합성 해설이 흐르고, 칠판 위의 판서(함수 그래프, 준위선, 블로흐 원, 흐름도)가 그 해설 시계를 따라 그려집니다.
파일 하나(`quantum-physics.html`)만 열면 인터넷 없이도 해설 음성과 분필 소리까지 그대로 재생됩니다.

이 강의는 [`docs/elliptic_curve`](../elliptic_curve/README.md)의 타원곡선 칠판 강의와 **같은 형식**입니다. 직접 만든 Canvas 판서 렌더러, 해설 음성이 기준 시계가 되는 재생기,
실제 녹음한 분필 소리, 단독 실행 HTML이라는 구조를 그대로 가져왔고, [`docs/art_of_war`](../art_of_war/README.md)에서 발전한 **분할 콘텐츠 + 검증기 + 해설 증분 생성**을 더했습니다.
타원곡선의 정확 연산(BigInt, 유한체)은 없애고, 대신 일반 함수 그래프(`graph` 보드)와 안전한 수식 계산기(`qmath.js`)를 넣었습니다.

- 열기: `quantum-physics.html`을 브라우저로 열기 (서버 불필요). 소리는 재생 버튼을 눌러야 시작됩니다(브라우저 정책).
- 작성: Microsoft Korea STU
- 방식: 칠판 위에 하나씩 그려지는 판서 + 한두 문장 설명 + 한 줄 정리 + **해설 음성(MP3 14개, 단계마다 1개)** + 글씨가 닿는 순간에만 나는 **분필 소리**

## 강의 구성 (14단계)

| 단계 | id | 주제 | 종류 | 보드 |
|---|---|---|---|---|
| 1 | `blackbody` | 흑체복사와 자외선 파국, 플랑크의 양자 가설 | 실험 | graph |
| 2 | `photoelectric` | 광전 효과, 아인슈타인의 광양자 | 실험 | graph |
| 3 | `doubleslit` | 이중 슬릿, 드브로이 파장, 한 알씩 쌓이는 간섭무늬 | 실험 | graph |
| 4 | `schrodinger` | 파동함수, 보른 규칙, 슈뢰딩거 방정식 | 유도 | graph |
| 5 | `box` | 상자 속 입자와 에너지 양자화 | 유도 | graph |
| 6 | `uncertainty` | 불확정성 원리 | 유도 | graph |
| 7 | `tunneling` | 양자 터널링 | 개념 | graph |
| 8 | `spin` | 스핀 1/2와 블로흐 원 | 실험 | graph |
| 9 | `entanglement` | 얽힘, EPR, 벨·CHSH 부등식 | 유도 | bars |
| 10 | `bell-tests` | 벨 실험의 역사 | 실험 | flow |
| 11 | `measurement` | 측정 문제와 결어긋남, 해석들 | 열린 문제 | flow |
| 12 | `qcomputing` | 양자 컴퓨팅 | 응용 | flow |
| 13 | `applications` | 이미 쓰고 있는 양자 기술 | 응용 | flow |
| 14 | `frontier` | 열린 문제와 고찰 | 열린 문제 | flow |

(단계 제목·종류의 최종 내용은 `content/NN-<id>.json`이 기준이며, 이 표는 안내용입니다.)
단계마다 **개념 / 실험 / 유도 / 응용 / 열린 문제** 중 하나의 라벨(`tag.tone`)이 붙어 서로 다른 색의 알약으로 표시됩니다. 판서 옆에는 짧은 수식 노트(`panel`), 한 줄 정리, 설명 구절(`beats`), 주의·정리 상자(`callout`), 범례가 붙고,
맨 아래에 "흔한 오해"와 "참고 자료"가 있습니다.

### 사실 규율

확립된 물리와 역사만 씁니다. 출처 없는 통계나 성능 수치는 넣지 않았고, 실험이 *이론의 예측을 확인한* 것과 수학적으로 *증명한* 것(불확정성 부등식, 벨 부등식)을 구분합니다.
측정 문제·해석 논쟁·양자 중력은 "아직 합의가 없다"고 말하고, 양자 컴퓨팅은 쇼어 알고리즘의 이론적 속도 향상과 현재 장치의 규모·오류 한계를 나누어 말합니다.

## 폴더 구성

```
docs/quantum_physics/
├─ quantum-physics.html        # 결과물: 단독 실행 HTML (빌드로 생성, 글꼴 2종·해설 MP3·분필 녹음 포함 약 17 MB)
├─ quantum-physics.scene.json  # 결과물: 조립된 장면(시험·검토용). 직접 고치지 않습니다 — content/ 를 고치세요
├─ template.html               # 페이지 뼈대 (해설·분필 컨트롤 포함)
├─ style.css                   # 스타일 (칠판, 반응형 — 1000px 이상은 넓은 배치 —, 줄어든 동작)
├─ player.js                   # Canvas 판서·해설 시계·분필 소리·컨트롤 (window.quantumPlayer)
├─ qmath.js                    # 서식 토큰 파서, 시간선 계산, 안전한 수식 계산기 (window.QMath)
├─ fonts.mjs                   # 글꼴 cmap 읽기 (검증·빌드가 공유)
├─ validate.mjs                # 콘텐츠 검증기 (스키마, 글자, 해설 길이, 보드별 규칙)
├─ build.mjs                   # 검증 + MP3 검증·내장 + 단독 HTML 조립
├─ narrate.py                  # 해설 대본 → ko-KR-Haena MP3 생성 (Foundry / Azure AI Speech)
├─ subset_font.py              # QMath 글꼴(DejaVu Sans 부분 집합) 만들기 (한 번만 실행하면 됨)
├─ requirements-audio.txt      # narrate.py 의존 패키지 (빌드·재생에는 필요 없음)
├─ qmath.test.mjs              # 서식 파서, 수식 계산기(안전성 포함), 시간선 시험
├─ lesson.test.mjs             # 콘텐츠 검증·빌드·글꼴·오프라인 규칙·README 시험
├─ player.test.mjs             # 재생기 시계·자동 넘김·해설/분필 상태 시험 (가짜 오디오, 브라우저 불필요)
├─ verify_browser.py           # Playwright 브라우저 검증 (화면·조작·자동 넘김·줄어든 동작)
├─ verify_media.py             # Playwright 실제 소리 재생 검증 (해설 시계·일시정지·수명주기·오류)
├─ verify_chalk.py             # 분필 소리 검증 (녹음 소스, 접촉 동기, 음량 상한, 공백 무음)
├─ verify_common.py            # 위 세 검증기가 함께 쓰는 도우미
├─ README.md
├─ content/
│  ├─ SCHEMA.md                # 콘텐츠 계약 (필드, 보드 종류, 글자 집합, 해설 규칙) + Engine notes
│  ├─ 00-meta.json             # 제목·부제·작성자·UI 문구·흔한 오해·참고 자료
│  └─ 01-blackbody.json … 14-frontier.json   # 단계 하나당 파일 하나 (파일 이름순 = 강의 순서)
├─ audio/
│  ├─ blackbody.mp3 … frontier.mp3   # 단계별 해설 14개 (ko-KR-Haena, 24 kHz 모노)
│  ├─ durations.json                 # 클립 길이(초) — 판서 시계와 진행 막대의 기준
│  └─ provider.json                  # 목소리·모델·대본 해시 (대본이 바뀌면 다시 만들어야 함을 빌드가 알림)
├─ assets/
│  ├─ NanumPenScript-Regular.ttf     # 칠판 글꼴(나눔손글씨 펜, SIL OFL 1.1)
│  ├─ OFL.txt                        # 나눔손글씨 라이선스
│  ├─ QMath-subset.ttf               # 그리스 문자·수학 기호 보충 글꼴 (DejaVu Sans 부분 집합, 아래 '글꼴' 참고)
│  ├─ LICENSE-DejaVu.txt             # DejaVu / Bitstream Vera 라이선스
│  ├─ chalk-writing.mp3              # 실제 칠판 녹음(CC0) 14초
│  └─ chalk-writing-source.json      # 분필 녹음 출처·라이선스·편집 내역
└─ tests/
   ├─ standin-build.mjs              # 해설 대신 가짜 클립을 넣은 시험 빌드 (소리 경로 시험용, 배포 금지)
   └─ fixtures/content/              # 보드 종류별 1단계씩 모은 시험 콘텐츠 (graph 모든 요소, flow 6노드, bars+markers, chalk)
```

이 폴더에는 HTML이 `quantum-physics.html`(결과물)과 `template.html`(뼈대) 둘뿐이어야 합니다. 빌드가 이를 강제합니다. 강의 목록(`docs/index.html`) 쪽 등록은 이 작업과 별개로 다른 담당이 관리합니다.

## 명령어

모든 명령은 이 폴더(`docs/quantum_physics`)에서 실행합니다. 빌드와 Node 시험에는 의존 패키지가 없습니다(Node.js 24에서 확인). 브라우저·소리 검증은 Python Playwright와 Chrome이,
해설 MP3 생성(`narrate.py`)은 아래의 Python 환경이 필요합니다.

```bash
node validate.mjs                 # 콘텐츠 검증 (아직 없는 파일은 pending 으로만 표시)
node validate.mjs --strict        # 14단계 + meta 가 모두 있어야 통과
node validate.mjs content/03-doubleslit.json     # 한 파일만
node build.mjs --no-audio --out /tmp/qp-dev.html # 개발용 빌드: 해설 MP3 없이(추정 시간으로 무음 재생), 저장소 밖에 저장
node build.mjs --no-audio --check                # 빌드만 하지 않고 검증만
node build.mjs                                   # 최종 빌드: 해설 MP3 검증·내장 + quantum-physics.html (+ .scene.json) 생성
node build.mjs --check                           # 쓰지 않고 검증만 (산출물이 최신인지 확인)
node --test                                      # qmath + lesson + player 시험 (브라우저 불필요)
```

`--no-audio` 빌드는 배포용이 아닙니다. 해설이 없으므로 재생기가 대본 길이로 추정한 시계를 씁니다(레이아웃·판서 검토용). 개발 빌드는 `--out`으로 저장소 밖(`/tmp`)에 만드세요.

### 해설 음성 만들기 (`narrate.py`)

이 폴더에는 별도 가상환경을 만들지 않습니다. 이미 `docs/art_of_war`에 `azure-cognitiveservices-speech`가 설치된 환경이 있으면 그것을 씁니다.

```bash
cd docs/quantum_physics
az login                                                       # Microsoft Entra ID (Azure CLI). 키는 저장하지 않습니다
../art_of_war/.venv/bin/python narrate.py --check             # 네트워크 없이: 대본 길이·글자·해시·상태 확인
../art_of_war/.venv/bin/python narrate.py --smoke             # 목소리·인증 확인(짧은 클립 하나, audio/ 에 남기지 않음)
../art_of_war/.venv/bin/python narrate.py                     # 없거나 대본이 바뀐 클립만 생성
../art_of_war/.venv/bin/python narrate.py --only schrodinger --force   # 한 단계만 다시 생성
node build.mjs                                                 # 새 MP3 를 HTML 에 내장
```

- 목소리: **ko-KR-Haena**, 모델 **MAI-Voice-2** (Azure AI Services 계정 `mai-transcribe-westus-resource`, 리소스 그룹 `public-ai-rg`). 다르면 `--resource`, `--resource-group`, `--voice`로 바꿉니다.
- 인증: `az account get-access-token` 의 Entra 토큰을 `aad#<리소스 ID>#<토큰>` 형식으로 보내며, 호출마다 새 `SpeechConfig`를 만들고 호출 사이에 약 2초 쉽니다(한도 보호).
- **증분 생성**: 클립마다 대본의 해시를 `audio/provider.json`에 적어 두고, 해시가 같고 파일이 정상이면 건너뜁니다. 대본이 바뀐 단계만 다시 만들고, 빌드는 해시가 어긋난 클립을 거부합니다(오래된 해설 방지).
- 한 단계의 대본은 250~440자입니다(MAI-Voice-2 입력 한도). 검증기가 강제합니다.
- 대본은 숫자·기호·로마자·한자 없이 한글로만 씁니다("플랑크 상수", "프사이", "십의 마이너스 삼십사 제곱"). 목소리가 읽는 방식을 예측할 수 있고, 화면의 "해설 대본 보기"에도 같은 글이 나옵니다.

### 검증

```bash
node --test                                                    # 시험 전부 (qmath, lesson, player)
python3 verify_browser.py --artifacts /tmp/qp-verify           # 화면·조작·자동 넘김·줄어든 동작 (스크린샷 저장)
python3 verify_media.py   --artifacts /tmp/qp-media            # 실제 소리 재생 (해설 시계, 0.9초 간격, 오류)
python3 verify_chalk.py   --artifacts /tmp/qp-chalk            # 분필 소리 신호
```

- 세 검증기는 `--artifacts`를 **저장소 밖**(`/tmp` 권장)으로 받고, 저장소 안이면 거부합니다.
- 검증할 HTML은 `--html 경로` → `--fixture`(시험 콘텐츠로 만든 시험 빌드) → `quantum-physics.html` 순으로 고릅니다. `quantum-physics.html`이 아직 없으면 실제 콘텐츠에 가짜 클립을 넣은 시험 빌드를 `--artifacts` 폴더에 만들어 검증하므로, 해설을 만들기 전에도 돌릴 수 있습니다.
- `qmath.test.mjs`: 서식 토큰(`^{ }`, `_{ }`, `**굵게**`), 수식 계산기(연산 우선순위, 오른쪽 결합 `^`, 단항 마이너스, 함수 12개, 정의되지 않는 값, 문법 오류, **`eval`·`Function`·속성 접근 같은 주입 시도 차단**), 곡선 표본, 시간선 계산.
- `lesson.test.mjs`: 시험 콘텐츠와 실제 콘텐츠 검증, 잘못된 입력마다 나오는 오류, 글꼴 합집합과 SCHEMA 보장 글자, 개발 빌드·시험 빌드, 오프라인 규칙(외부 URL·`fetch`·`innerHTML`·`eval` 금지, 금지 이름 검사), 분필 녹음 바이트가 원본과 같은지, 폴더 규칙, README 필수 항목.
- `player.test.mjs`: 가짜 `Audio`/`AudioContext`로 재생기의 시계와 상태기계를 시험합니다 — 오디오 `currentTime`이 시계가 되는 것, 단계 완료 = 판서 끝 && 해설 끝, 0.9초 간격 뒤 자동 넘김, 줄어든 동작, `NotAllowedError`, 해설 오류, 숨김·`pagehide`, 분필 접촉 동기, 늦게 도착한 `ended` 경합, `graph` 보드의 좌표·라벨 배치.
- `verify_browser.py`: Chrome으로 1440 / 1024 / 390 px, 줄어든 동작, 오프라인(요청 0건), 단계마다 비어 있지 않은 캔버스·배치 경고 없음·graph 좌표계(`equalAspect`는 가로세로 배율 같음)·태그 라벨, 두 글꼴이 실제로 읽혔는지, 컨트롤(분필 기본 25%), 가짜 시계로 자동 넘김(0.9초 간격), 글꼴을 브라우저가 비운 뒤 다시 읽는 경우.
- `verify_media.py`: 내장 MP3를 실제로 재생해 오디오 시계, 속도, 일시정지·이어서, 분필 신호, 자동 넘김, 숨김·`pagehide`, 오류 표시, 깨진 MP3, 줄어든 동작을 확인합니다.
- `verify_chalk.py`: 분필 녹음의 소스(디코딩된 실제 녹음, 루프 아님), 접촉 동기, 공백 무음, 음량 상한과 25% 기본값, graph 보드를 그릴 때의 접촉, 해독 실패 표시.

## 콘텐츠 만들기 (`content/`)

장면은 하나의 큰 JSON이 아니라 **파일로 나뉘어** 있습니다. `build.mjs`가 `00-meta.json` + `NN-<id>.json`을 파일 이름순으로 모아 하나의 장면(`quantum-physics.scene.json`)으로 조립합니다.
필드와 보드 종류, 허용 글자, 해설 규칙은 모두 [`content/SCHEMA.md`](content/SCHEMA.md)가 계약입니다. 요약:

- `00-meta.json`: `schema`(`quantum-physics-lesson/1`), `lang`(`ko`), `eyebrow`, `title`, `subtitle`, `author`, `ui.hint`, `misconceptions[]`, `references[]`. 화면의 제목·소제목은 여기서 옵니다.
- 단계 파일: `id`(파일명과 일치), `nav`, `title`, `tag{tone,text}`, `summary`, `narration`, `beats[]`, `callout`, `legend[]`, `alt`, `board`, `panel[]`.
- `board.kind`:

| kind | 요소 | 용도 |
|---|---|---|
| `graph` | `axes`, `fn`, `area`, `point`, `seg`, `ellipse`, `text` | 함수 그래프, 준위선, 블로흐 원, 장벽과 파동함수. `equalAspect`는 가로세로 눈금을 같게(원이 찌그러지지 않게) |
| `flow` | `node` (2~6개, `cols` 1~4) | 상자와 화살표: 시간선, 절차, 구조도 |
| `bars` | `bar` (`amount`), `markers` | 가로 막대 비교와 기준 세로선(예: CHSH 한계 2) |
| `chalk` | (없음) | 수식 노트(`panel`)만으로 전개하는 단계 |

- 모든 요소의 `at`(시작 초)와 `dur`(그리는 시간 초)가 판서 순서를 정합니다. 색은 `white mint yellow pink sky orange` 여섯 가지뿐입니다.
- `graph`의 `fn`·`area`는 `expr`(예: `"cos(pi*x)^2*sinc(2*pi*x)^2"`)로 곡선을 정의합니다. 계산은 `qmath.js`의 **직접 만든 파서**가 하며 `eval`/`Function`을 쓰지 않습니다. 허용: 숫자, `x`, `pi`, `e`, `+ - * / ^`(오른쪽 결합, 단항 마이너스), 괄호, `sin cos tan exp ln sqrt abs sinc tanh sinh cosh step`. 값이 없는 구간은 선이 끊깁니다.
- 서식: `^{2}` 위첨자, `_{n}` 아래첨자, `**굵게**`. 마이너스는 ASCII `-`.
- 콘텐츠를 고친 뒤에는 `node validate.mjs`를 돌리면 파일·경로가 붙은 오류와 경고가 나옵니다. 해설 대본을 고쳤다면 `narrate.py`로 해당 단계만 다시 만든 뒤 빌드하세요.

### 빌드가 실패하는 경우

- 콘텐츠가 검증을 통과하지 못할 때(필수 필드, 열거값, 해설 250~440자·금지 문자, `expr` 해석 불가·값 없음, `beats` 순서, 요소 필드·색·방향 등). 오류에 `파일 › 경로`가 붙습니다.
- 판서에 두 글꼴 어디에도 없는 글자가 들어갔을 때(글리프 누락)
- 해설 MP3가 없거나(단계마다 1개), 파일이 MP3가 아니거나, 길이·목소리·모델이 `audio/provider.json`과 다를 때, **대본 해시가 달라졌을 때**(오래된 해설), 분필 녹음이 없거나 너무 짧을 때
- 외부 URL, `@import`, 구글 글꼴, `fetch`/`XMLHttpRequest`, `innerHTML`, `eval` 등이 템플릿·스타일·스크립트에 있을 때 (MP3 메타데이터에 든 URL 태그는 빌드가 미리 제거합니다)
- 고객사로 보이는 이름이 콘텐츠에 들어갔을 때
- 이 폴더에 `quantum-physics.html`, `template.html` 외의 HTML이 있을 때

## 소리: 해설 음성과 분필 소리

### 해설 음성 (재생기의 기준 시계)

- 목소리는 **ko-KR-Haena**(모델 **MAI-Voice-2**, Microsoft Foundry / Azure AI Speech)입니다. **AI로 합성한 음성**이며, 화면 위쪽 칩과 컨트롤, 푸터에 그 사실을 적어 둡니다.
- 대본은 단계 파일의 `narration`입니다. 화면의 "해설 대본 보기"에도 그대로 나와 소리를 못 들을 때도 내용을 읽을 수 있습니다.
- 해설이 켜져 있으면 **오디오의 `currentTime`이 판서 시계**입니다. 재생 속도(0.75–1.5배)는 오디오 `playbackRate`에 그대로 적용되고, 판서가 해설과 어긋나지 않습니다.
- **단계가 끝난 것은 "판서가 끝났고 해설도 끝났을 때"**입니다. 판서가 먼저 끝나면 칠판은 완성된 채 해설이 끝나기를 기다립니다. 해설을 끄면 판서가 끝나는 시점이 곧 단계의 끝입니다.
- 자동 넘김이 켜져 있으면 단계가 끝난 뒤 **0.9초**의 간격을 두고 다음 단계로 넘어가고, 마지막 단계에서 멈춥니다. 판서 중이 아닌데 "판서 중"이라고 말하거나 말없이 멈추는 일은 없습니다.
- 이전·다음·단계 목록·숫자 키·해시 이동은 이전 단계의 소리를 즉시 멈추고 새 단계를 해설과 함께 시작합니다.
- 브라우저가 소리 재생을 막으면(`NotAllowedError`) 판서를 소리 없이 흘려보내지 않고 멈춘 뒤 재생 버튼을 다시 누르라고 알립니다. 해설 파일을 읽지 못하면 이유를 화면에 보이고 그 단계는 판서 시계로 계속됩니다. 대체 합성음(브라우저 음성합성 등)은 쓰지 않습니다.
- 탭이 가려지거나 페이지를 떠나면 해설과 분필이 모두 멈춥니다.

### 분필 소리 (정책)

- **실제 칠판 녹음만** 씁니다. 출처는 **digitale.de — Writing with Chalk / Chalkboard**, [Freesound 178433](https://freesound.org/people/digitale.de/sounds/178433/), 라이선스 **CC0-1.0**입니다. 사용한 구간·필터·정규화는 `assets/chalk-writing-source.json`에 기록했고 (파일은 `docs/elliptic_curve`의 것과 바이트까지 같습니다), **합성 소리·잡음 생성은 없습니다.**
- 글자마다 새로 녹음한 것은 아닙니다. 녹음의 서로 다른 부분을 화면의 **분필 접촉**(글씨·선·곡선·점·타원이 실제로 그려지는 순간)에 맞춰 재생합니다. 공백, 판서 사이의 쉬는 구간, 일시정지, 판서가 끝난 화면에서는 소리가 나지 않습니다.
- 최대 출력은 작게 제한했고(해설을 가리지 않도록), 슬라이더 기본값은 **25%**이며 표시도 "25%"입니다. 0%는 완전한 무음입니다. 분필 소리 켬/끔 토글과 해설 음성 토글, 분필 음량 슬라이더가 컨트롤에 있습니다.
- 분필 녹음을 해독하지 못하면 이유가 화면에 보이고 강의는 계속됩니다(이때도 대체음은 없습니다).

## 글꼴 (NanumPenScript + QMath)

칠판 글꼴 **NanumPenScript**(나눔손글씨 펜, SIL OFL 1.1, `assets/OFL.txt`)에는 한글과 ASCII, `≠ ± × ÷ ° †`만 있고 **그리스 문자와 수학 기호가 없습니다**(`ψ ħ λ ν ⟩ ∫ √ ≥ → …`).
그래서 두 번째 글꼴 **QMath**를 함께 내장합니다.

- QMath는 `/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf`(DejaVu Sans, Bitstream Vera 라이선스 — 부분 집합 제작·재배포 허용, `assets/LICENSE-DejaVu.txt`)를 `subset_font.py`로 **SCHEMA가 보장하는 글자 + ASCII**만 남겨 줄인 것입니다(약 39 KB, 글자 약 380개). 다시 만들려면 `python3 subset_font.py` (fonttools 필요).
- 둘 다 `@font-face`로 base64 내장됩니다. 칠판(Canvas)과 화면 UI 모두 글꼴 목록을 `'NanumPenScript', 'QMath', …` 순서로 써서, NanumPenScript에 없는 글자만 QMath가 채웁니다.
- 검증기와 빌드는 **두 글꼴 글자 집합의 합집합**으로 확인합니다. 어느 쪽에도 없는 글자는 빌드 오류(오류에 위치가 나옵니다)이므로 네모 글자(두부)가 화면에 나오는 일이 없습니다.
- 브라우저가 내장 글꼴을 도중에 비웠다가(창 크기 변경 등) 다시 읽으면 멈춰 있는 칠판도 새 글꼴로 다시 그립니다.
- 유니코드 첨자(`²`, `₀`)는 쓰지 않고 `^{2}`, `_{0}` 서식을 씁니다.

## 재생기 사용법

- 하단 컨트롤: 재생/일시정지, 이전/다음, 다시 그리기, 속도, 자동 넘김, **해설 음성 켬/끔**, **분필 소리 켬/끔**, **분필 음량 슬라이더(기본 25%)**, 단계 목록(목차)
- 키보드: `Space` 재생/일시정지, `←` `→` 이전/다음, `1`부터 `9`까지 단계로 바로 이동, 주소의 `#7`처럼 해시로도 이동
- 처음에는 빈 칠판과 안내("눌러서 판서 시작")를 보여 주고, 재생을 눌러야 판서와 해설이 시작됩니다(소리는 브라우저 정책상 클릭 뒤에만 납니다).
- 1000 px 이상의 넓은 화면에서는 칠판과 수식 노트를 나란히, 좁은 화면(휴대폰 약 390 px)에서는 위아래로 놓습니다.
- **줄어든 동작**(`prefers-reduced-motion`): 판서 애니메이션을 건너뛰고 완성된 칠판을 바로 보여 줍니다. 해설은 그대로 쓸 수 있고, 해설을 끄면 자동 넘김은 "불가"로 표시되며(`aria-disabled`) 재생 버튼은 "다음 단계 보기"가 됩니다.
- **오프라인**: 글꼴 2종, 해설 MP3 14개, 분필 녹음은 HTML 안에 base64(`data:`)로 들어 있고, 외부 URL·구글 글꼴·`fetch`·`innerHTML`·`eval`은 빌드가 막습니다. 엄격한 CSP(`default-src 'none'`)가 걸려 있습니다.
