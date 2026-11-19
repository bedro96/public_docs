# 손자병법 칠판 강의

《손자병법》을 저자와 시대(배경 6단계) → 열세 편(13단계) → 마무리(4단계), 모두 **23단계**로 풀어 가는 칠판 강의입니다.
한국어 AI 해설 음성에 맞춰 손글씨 칠판(Canvas)이 한 요소씩 그려지고, 실제 분필 녹음이 펜이 닿는 순간에 맞춰 납니다.
네트워크 없이 `art-of-war.html` **한 파일만** 열면 재생됩니다(글꼴·해설 MP3·분필 소리·재생 코드가 모두 안에 들어 있습니다).

- 열기: [`art-of-war.html`](art-of-war.html) 을 브라우저로 엽니다. (서버·설치 불필요, 소리는 재생 버튼을 누른 뒤에 시작)
- 형제 강의 [`../linear-function`](../linear-function), [`../elliptic_curve`](../elliptic_curve) 와 같은 방식입니다. 재생 시계·분필 소리·자동 넘김은 `elliptic_curve` 의 엔진을 바탕으로 하고, 수학 칠판은 빼고 인문 고전용 칠판 6종을 새로 넣었습니다.

## 꼭 알아 둘 점

- **해설 음성은 AI 합성**입니다(Microsoft Foundry / Azure AI Speech, MAI-Voice-2 `ko-KR-Haena`). 사람이 녹음한 것이 아니며 화면 위쪽 칩과 하단에 그 사실을 적어 둡니다.
- **이 강의는 일반 개요**입니다. 〈절대 지지 않는 법 ─ 《손자병법》 90분 완전 해설〉(채널 인문학이랑)에서 영감을 받았지만, **확인한 것은 영상의 제목과 채널뿐**이고 자막·설명·장(챕터)·링크가 열리는 19분 3초 구간의 내용은 확인하지 못했습니다. 따라서 영상 속 발언을 인용하거나 요약하지 않으며, 어떤 설명도 영상의 주장으로 소개하지 않습니다. 근거는 《손자병법》 원전과 공개된 자료(`content/00-meta.json` 의 `references`)입니다.
- 저자(孫武)·성립 시기·판본에 관한 학계의 논의는 단정하지 않고 "논쟁이 남아 있다"고 적었습니다.
- **현재 저장소의 `art-of-war.html` 은 해설 MP3 가 없는 개발용 빌드**(`--no-audio`)일 수 있습니다. 이때는 소리 칩에 "개발용"이라고 표시되고 해설 음성 버튼은 쓸 수 없으며, 판서는 대본 길이로 추정한 시간표로 진행합니다. 배포용 빌드는 아래 「해설 음성 만들기」를 거친 뒤 `node build.mjs` 로 만듭니다.
- 칠판 폭이 1000px 이상일 때(창 너비 약 1060px 이상) 칠판은 왼쪽, 설명은 오른쪽에 놓이는 넓은 배치가 되고, 그보다 좁으면 위아래로 쌓이는 배치가 됩니다.

## 강의 구성

| 묶음 | 단계 | 내용 |
|---|---|---|
| 배경 | 6 | 저자와 시대, 책의 성립과 판본, 이 강의의 지도 등 |
| 13편 | 13 | 〈시계〉부터 〈용간〉까지 한 편에 한 단계. 단계마다 원문 한 구절(한자 · 한글 독음 · 뜻 · 출처) |
| 마무리 | 4 | 열세 편을 잇는 실, 흔한 오해, 오늘의 적용, 되짚기 |

단계마다 화면에는 다음이 함께 나옵니다.

- **칠판**: `diagram`(노드·링크 도식), `timeline`(연표), `ladder`(단계 사다리), `radial`(방사형), `table`(표), `compare`(비교) 중 하나. 요소마다 `at`(해설 길이의 비율)에 맞춰 하나씩 그려집니다.
- 소제목(kicker), 큰 한자 제목(`han`), 원문 카드(`quote`), 칠판에 적는 요점(`panel`), 해설 흐름 캡션(`beats`), 짚어 주는 상자(`callout`), 범례(`legend`), 스크린리더용 설명(`alt`), 해설 대본(소리를 못 들을 때).
- **한 장 요약(`digest`)**: 소리 없이도 읽을 수 있는 3~4장의 카드. 단계별 요약 페이지 역할을 합니다.
- 강의 끝에는 **퀴즈**(6문항·보기 3개·바로 정오답과 해설·점수·다시 풀기), **자주 하는 오해**, **참고 문헌**과 출처 안내가 있습니다.
- **목차**: 23개 단계를 배경 / 13편 / 마무리로 묶어 보여 주며, 현재 단계 강조와 강의 전체 진행 막대가 있습니다.

## 폴더 구성

| 파일 | 역할 |
|---|---|
| `content/00-meta.json`, `01-background.json`, `02-chapters-a.json`, `03-chapters-b.json`, `04-closing.json` | **편집하는 원본.** 파일 이름순으로 합쳐 장면 하나가 됩니다. 규칙은 [`content/SCHEMA.md`](content/SCHEMA.md) |
| `validate.mjs` | 스키마 검증(필수 칸, id, 해설 글자 규칙, `at` 순서, 보드별 규칙, 금지어 등) |
| `build.mjs` | 합치기 → 검증 → 글꼴 글리프·배치 검사 → MP3 검증·내장 → `art-of-war.html` 생성 |
| `layout.js` | 칠판 배치와 시간표(보드 6종, 좁은 화면 재배치, 세로 연표). 빌드의 배치 검사와 브라우저가 같은 코드를 씁니다 |
| `draw.js` | 분필 질감의 선·글자·화살표 그리기 |
| `player.js` | 재생기: 시계, 판서, 해설 음성, 분필 소리, 목차, 퀴즈, `window.artOfWarPlayer` |
| `template.html`, `style.css` | 화면 뼈대와 스타일 |
| `narrate.py` | 해설 MP3 생성(Azure Speech MAI-Voice-2) |
| `subset_hanja.py` | 한자 부분 글꼴 생성 |
| `assets/` | 나눔손글씨 펜, 한자 부분 글꼴(`ChalkHanja-subset.otf`), 분필 녹음(CC0)과 출처 기록, 라이선스 전문 |
| `audio/` | (생성물, 해설을 만든 뒤에 생김) `<단계 id>.mp3`, `durations.json`, `provider.json` |
| `art-of-war.html` | 생성 결과(수정하지 않음). 이 폴더의 HTML 은 이 파일과 `template.html` 뿐이어야 하며 빌드가 강제합니다 |
| `lesson.test.mjs`, `player.test.mjs`, `tests/` | Node 시험과 시험용 내용(`tests/fixtures/content`), 소리 시험용 빌드(`tests/standin-build.mjs`) |
| `verify_browser.py`, `verify_media.py`, `verify_chalk.py` | 실제 Chrome 으로 하는 검증 |
| `requirements-audio.txt`, `requirements-fonts.txt` | `narrate.py`, `subset_hanja.py` 의 Python 의존 패키지 |

## 명령어

모든 명령은 이 폴더(`docs/art_of_war`)에서 실행합니다. 빌드와 Node 시험은 의존 패키지가 없습니다(Node.js 24에서 확인). 브라우저 검증에는 Python Playwright 와 `/usr/bin/google-chrome` 이 필요합니다.

```bash
node build.mjs --no-audio     # 개발용: 해설 없이 추정 길이로 빌드(경고를 출력)
node build.mjs                # 배포용: audio/ 의 MP3 를 검증하고 내장
node build.mjs --check        # 파일을 쓰지 않고 검증만
node --test                   # 스키마·빌드·재생기 시험(브라우저 불필요)

python3 verify_browser.py --artifacts <폴더>             # 보드 6종·한자·반응형·목차·퀴즈·자동 넘김·오프라인
python3 verify_browser.py --artifacts <폴더> --fixture    # 시험용 내용(보드 6종 각 1단계)으로
python3 verify_media.py   --artifacts <폴더>             # 해설 음성·오디오 시계·0.9초 간격·줄어든 동작·오류
python3 verify_chalk.py   --artifacts <폴더>             # 분필 소리: 실제 녹음·음량·공백 무음·0% 무음
```

- `--artifacts` 는 스크린샷·보고서를 쓸 폴더이며 **저장소 밖**(예: `/tmp/aow-verify`)을 지정해야 합니다(저장소 안이면 거부).
- `verify_media.py` 는 배포용 빌드(해설 MP3 내장)라면 그 파일을 그대로 시험합니다. 해설이 없는 개발용 빌드이면 `tests/standin-build.mjs` 가 임시 폴더에서 분필 녹음으로 만든 **가짜 해설 클립**(ffmpeg 필요)으로 시험용 빌드를 만들어 오디오 경로를 시험합니다(해설이 아니므로 배포 금지, 임시 폴더는 끝나면 지워지고 결과는 `--artifacts` 아래에만 남음).
- `node --test` 의 "산출물이 최신" 시험은 `content/`·엔진을 고치고 다시 빌드하지 않으면 실패합니다. 고친 뒤에는 빌드를 다시 하세요.

### 빌드가 하는 일과 실패하는 경우

빌드는 다음 중 하나라도 어긋나면 **실패**하고 이유를 한국어로 모두 나열합니다.

- 스키마 위반: 필수 칸 누락, id 중복, 23단계가 아님(파일이 모두 있을 때), `chapterNo` 1–13 순서, 해설 330–430자 밖, 해설에 한자·영문·숫자·기호(`%`, `->`, 《》, 괄호 등) 포함, `at` 가 오름차순이 아니거나 마지막이 0.85 초과, 글자 수 제한 초과, 편 단계에 `quote` 없음, 허용되지 않은 색조(`tag.tone`) 등
- 보드 규칙 위반: 노드가 칠판 범위(`[5,155]×[5,95]`)를 벗어남·서로 겹침, 링크 끝점 없음, 연표 연도가 축 범위 밖 등
- **글리프 누락**: 장면에 쓰인 모든 글자(칠판·원문·한자 제목·요점·요약·퀴즈 등)가 내장한 두 글꼴(나눔손글씨 펜 + 한자 부분 글꼴) 중 하나에도 없는 경우
- **배치 검사**: 글자 폭을 실제 글꼴로 재서 노드 상자·칠판 밖으로 넘치는 글을 찾음(`error` 는 실패, `warn` 은 출력만)
- 금지어(고객·회사 이름, `LG` 등), 외부 URL·`fetch`·`XMLHttpRequest`·`innerHTML`·`eval`·브라우저 음성합성이 결과물에 남은 경우, 이 폴더에 `art-of-war.html`·`template.html` 외의 HTML 이 있는 경우
- (배포용 빌드) `audio/provider.json` 의 목소리·대본 해시가 현재 대본과 다름, 클립 길이가 `durations.json` 과 0.1초 넘게 다름, 클립이 20초보다 짧음, MP3 에 URL 메타데이터가 있음, 단계의 MP3 가 없음

## 한자 글꼴

나눔손글씨 펜에는 한자가 없습니다. 그래서 빌드 시점에 장면 전체(칠판·원문·한자 제목·요점·퀴즈 등)에서 한글이 아닌 CJK 한자를 모아, **Noto Serif CJK KR Bold**(SIL OFL 1.1)에서 그 글자들만 잘라 낸 부분 글꼴 `assets/ChalkHanja-subset.otf` 를 만들어 base64 `@font-face`(`ChalkHanja`)로 내장합니다. Canvas 와 DOM 모두 나눔손글씨 펜에 없는 글자만 이 글꼴로 대신 쓰므로, **한자도 건너뛰지 않고 판서로 그려집니다.**

```bash
python3 -m venv .venv && . .venv/bin/activate     # .venv 는 git 에서 제외됩니다
pip install -r requirements-fonts.txt
python3 subset_hanja.py            # 글자 집합(assets/ChalkHanja-chars.txt)이 바뀐 경우에만 다시 만듦
python3 subset_hanja.py --force    # 항상 다시 만듦
python3 subset_hanja.py --check    # 쓰지 않고, 기존 부분 글꼴이 모든 글자를 덮는지만 확인
```

원본 글꼴은 시스템의 `fonts-noto-cjk` 패키지(`NotoSerifCJK-Bold.ttc`, 한국어 서체 1번)이고, 라이선스 전문은 `assets/OFL-NotoSerifCJK.txt` 입니다. 내용에 새 한자를 넣으면 `subset_hanja.py` 를 다시 돌리세요. 안 돌리면 빌드가 "글리프 누락"으로 실패해서 알려 줍니다.

## 소리: 해설 음성과 분필 소리

### 해설 음성 (재생기의 기준 시계)

- 목소리는 **ko-KR-Haena**(모델 **MAI-Voice-2**)이며 AI 합성 음성입니다. 대본은 단계의 `narration` 이고, 화면의 "해설 대본 보기"에도 그대로 나옵니다. 숫자·기호·한자는 쓰지 않고 한글로 풀어 써서(예: 孫子 → 손자) 읽는 방식을 예측할 수 있게 했습니다.
- 해설이 켜져 있으면 **오디오의 `currentTime` 이 판서 시계**입니다. 재생 속도(0.75–1.5배)는 `playbackRate` 에 그대로 적용됩니다. 요소의 `at` 은 해설 길이에 대한 비율이라, 실제 클립 길이(`audio/durations.json`)에 맞춰 그려지고, 해설이 꺼졌거나 길이를 모를 때는 대본 글자 수로 추정한 길이로 같은 시간표를 씁니다.
- **단계가 끝난 것은 "판서가 끝났고 해설도 끝났을 때"** 입니다. 판서가 먼저 끝나면 칠판은 완성된 채 해설이 끝나기를 기다립니다(상태: "판서 완료 · 해설을 마저 듣는 중"). 자동 넘김이 켜져 있으면 **0.9초** 뒤 다음 단계로 넘어갑니다("n단계 완료 · 0.9초 뒤 다음 단계로 넘어가요").
- 이전·다음·목차·숫자 키·주소 해시(`#5`) 이동은 이전 단계의 소리를 즉시 멈추고 새 단계를 처음부터 시작합니다. 늦게 도착한 이전 클립의 `ended`/`pause` 이벤트는 무시합니다.
- 브라우저가 소리 재생을 막으면(`NotAllowedError`) 판서를 소리 없이 흘려보내지 않고 멈춘 뒤 "재생 버튼을 한 번 더 눌러 주세요"라고 알립니다. 해설 파일이 깨졌거나 재생에 실패하면 이유를 화면에 보이고 그 단계는 판서 시계로 계속됩니다. 대체 합성음(브라우저 음성합성 등)은 쓰지 않습니다.
- 탭이 가려지거나(`visibilitychange`) 페이지를 떠나면(`pagehide`) 해설과 분필이 모두 멈춥니다.

### 분필 소리

- **실제 칠판 녹음만** 씁니다. 출처는 **digitale.de — Writing with Chalk / Chalkboard**, [Freesound 178433](https://freesound.org/people/digitale.de/sounds/178433/), 라이선스 **CC0-1.0** 입니다. 사용한 구간·필터·정규화는 `assets/chalk-writing-source.json` 에 기록되어 있고(`elliptic_curve` 와 같은 파일), 합성 소리나 소리 합성기로 만든 대체음은 없습니다.
- 녹음의 서로 다른 부분을 화면의 **분필 접촉**(글씨·선·점이 실제로 그려지는 순간)에 맞춰 짧게 재생합니다. 글자 사이·공백, 판서 사이의 쉬는 구간, 일시정지에서는 소리가 나지 않습니다.
- 기본 음량 **25%**(슬라이더·표시 모두), 0% 는 완전한 무음이며 최대 출력도 해설을 가리지 않도록 작게 제한했습니다.
- 분필 녹음을 해독하지 못하면 이유가 화면에 보이고 강의는 계속됩니다.

### 해설 음성 만들기·다시 만들기

대본(`narration`)을 고치면 MP3 를 다시 만들어야 합니다(빌드가 대본 해시 불일치를 알려 줍니다). `narrate.py` 는 Azure CLI 로그인(Microsoft Entra ID)만 쓰며 키를 저장하지 않습니다. 자원은 `public-ai-rg` 의 `mai-transcribe-westus-resource`, 한 클립마다 새 `SpeechConfig` 를 만들고 클립 사이에 2초를 쉽니다. 이미 있고 대본 해시가 같은 클립은 건너뛰므로 중간에 끊겨도 이어서 만들 수 있습니다.

```bash
python3 -m venv .venv && . .venv/bin/activate     # .venv 는 git 에서 제외됩니다
pip install -r requirements-audio.txt
az login
python3 narrate.py --check                        # 네트워크 없이 대본·기존 클립 상태만 점검
python3 narrate.py --smoke                        # 목소리·인증 확인(짧은 한 문장, 파일을 남기지 않음)
python3 narrate.py                                # 없거나 대본이 바뀐 클립만 생성(이어 만들기)
python3 narrate.py --only ch02-cost --force       # 한 단계만 다시 생성
node build.mjs                                    # 새 MP3 를 HTML 에 내장
```

`audio/<단계 id>.mp3`, `audio/durations.json`, `audio/provider.json`(목소리·모델·대본 해시)이 만들어집니다. 해설 한 단계는 330–430자여야 합니다(길이 제한과 판서 길이 균형). 생성 중 임시 파일(`*.pending.mp3`)은 git 에서 제외됩니다.

## 재생기 사용법

- 하단 컨트롤: 재생/일시정지, 이전/다음, 현재 단계 다시, 처음부터, 속도(0.75–1.5배), **자동 넘김**, **해설 음성 켬/끔**, **분필 소리 켬/끔**, **분필 음량 슬라이더(기본 25%)**, 단계 목차.
- 키보드: `Space` 재생/일시정지, `←` `→` 이전/다음, `1`–`9` 단계 바로 이동(10단계 이후는 목차). 버튼·선택 칸에 초점이 있으면 그 컨트롤의 기본 동작이 우선합니다. 주소의 `#n` 으로 시작 단계를 정할 수 있습니다.
- 처음에는 빈 칠판과 안내("눌러서 판서 시작")를 보여 주고, 재생을 눌러야 판서와 해설이 시작됩니다.
- 자동 넘김을 끄면 단계가 끝난 상태("n단계 완료")로 멈추고, 다시 켜면 그 완료된 단계에서 이어서 다음 단계로 넘어갑니다. 마지막 단계에서는 멈춥니다.
- 일시정지하면 해설과 분필이 즉시 멈춥니다. 해설을 끄면 판서가 자체 시계로 진행되고, 다시 켜면 그 단계를 해설과 함께 처음부터 시작합니다.
- **줄어든 동작**(`prefers-reduced-motion`): 판서 애니메이션 없이 완성된 칠판을 보여 주고, 재생은 칠판을 그대로 둔 채 해설만 재생합니다. 해설을 끄면 시계가 없으므로 자동 넘김 버튼은 "불가"(`aria-disabled`)로 표시되고 재생 버튼은 "다음 단계 보기"가 됩니다.
- 한 장 요약(`digest`)·원문 카드·요점·퀴즈·오해·참고 문헌은 모두 일반 HTML 글이므로 소리와 애니메이션 없이도 읽을 수 있습니다.

### `window.artOfWarPlayer` (시험·자동화용)

`getState()` 는 다음을 돌려줍니다.

| 분류 | 필드 |
|---|---|
| 진행 | `ready, index, count, id, kind, playing, started, ended, reduced, auto, autoAvailable, speed, t, animEnd, duration, progress` |
| 완료 | `complete`(판서 끝 && 해설 끝, 해설이 꺼졌거나 오류면 판서 끝), `drawDone` |
| 해설 | `voiceEnabled, hasAudio, voiceMode`(`off`/`idle`/`embedded`/`error`), `voiceDone, voiceError, audioTime, audioDuration` |
| 분필 | `chalkEnabled, chalkVolume, chalkReady, chalkError, penDown, writingCharacter` |
| 화면 | `canvas, board, quiz, warnings` |

메서드는 `goTo(i)`, `play()`, `pause()`, `toggle()`, `next()`, `prev()`, `replay()`, `restart()`, `seek(i, t | 'end')`, `setSpeed(x)`, `setAuto(bool)`, `setVoiceEnabled(bool)`, `setChalkEnabled(bool)`, `setChalkVolume(0–100)`, `answerQuiz(q, o)`, `resetQuiz()`, `layoutReport()`, `steps` 입니다. `seek` 는 소리를 모두 멈추고 정지 화면만 만듭니다. `layoutReport()` 는 현재 단계의 글자 폭과 노드 상자를 비교해 넘침·겹침·링크가 노드를 가로지르는 경우를 알려 줍니다(오류 `error`는 시험이 실패로 보고, 경고 `warn`은 참고용입니다).

## 내용 고치기

1. `content/*.json` 을 고칩니다(필드 규칙은 [`content/SCHEMA.md`](content/SCHEMA.md)).
2. 새 한자를 썼다면 `python3 subset_hanja.py`.
3. `node build.mjs --no-audio` 로 검증·확인. 칠판 글이 넘치거나 겹치면 빌드가 알려 줍니다.
4. 대본을 고쳤다면 `python3 narrate.py` 로 해당 클립을 다시 만들고 `node build.mjs`.
5. `node --test` 와 `python3 verify_browser.py --artifacts <폴더>`.

## 알려진 한계

- 해설 MP3 가 생성되기 전에는 개발용 빌드뿐이며, 실제 해설 음성으로 본 시험은 `narrate.py` 를 돌려 만든 뒤에야 할 수 있습니다(그 전의 소리 경로는 가짜 클립으로 시험).
- 좁은 화면(칠판 폭 560px 미만)에서는 도식을 줄 단위로 다시 배치하고 연표는 세로로 다시 그립니다. 도식의 링크가 다른 노드를 가로지르는 경우가 일부 단계에 남아 있으며 `layoutReport()` 의 참고(INFO) 항목으로만 표시됩니다.
- 손글씨 글꼴은 한글 글자 크기가 작게 보여서 칠판 안의 한글은 일정 배수로 키워 그립니다(`layout.js` 의 `KO_BOOST`). 글꼴을 바꾸면 이 값과 글자 폭 검사를 함께 확인하세요.
- 해설은 합성 음성이라 한자어의 발음·끊어 읽기가 어색할 수 있습니다. 한자·숫자를 대본에 쓰지 않는 규칙은 이를 줄이기 위한 것입니다.
- Chrome 에서 전체 쪽 스크린샷을 찍는 동안 글꼴 상태가 잠시 `unloaded` 로 보이는 일이 있어 `verify_browser.py` 는 점검 전에 글꼴을 다시 불러옵니다(엔진의 문제가 아니라 Playwright 도구의 특성).

## 참고

- 글꼴: 나눔손글씨 펜(Nanum Pen Script, SIL OFL 1.1, `assets/OFL.txt`), Noto Serif CJK KR 의 부분 글꼴(SIL OFL 1.1, `assets/OFL-NotoSerifCJK.txt`).
- 해설 음성: Microsoft Foundry / Azure AI Speech 의 MAI-Voice-2 `ko-KR-Haena`(AI 합성). 목소리·모델·대본 해시는 `audio/provider.json` 에 있습니다.
- 분필 소리: digitale.de, "Writing with Chalk / Chalkboard"(Freesound 178433), CC0-1.0. 편집 내역은 `assets/chalk-writing-source.json`.
- 원전과 참고 문헌 목록은 `content/00-meta.json` 의 `references` 와 페이지 하단 「참고 문헌」 카드에 있습니다. 참고 문헌의 주소는 눈에 보이는 글자로만 적고 링크(`<a href>`)로 만들지 않아, 파일이 외부 주소로 요청을 보내지 않습니다.
