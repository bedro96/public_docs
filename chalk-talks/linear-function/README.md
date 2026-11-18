# 일차함수 칠판 강의

`일차함수_칠판강의.html`을 Chrome 또는 Edge에서 열고 **강의 시작 / 재생**을 누르세요. HTML 하나에 한국어 글꼴, 음성, 코드가 들어 있어 인터넷 없이 사용할 수 있습니다. 브라우저 정책상 소리는 첫 재생 클릭 후 시작합니다.

- 8장, 약 4분: 일차함수 → 기울기 → 부호·가파름 → y절편 → 그래프 그리기 → 기울기 0 → 정리.
- 실제 분필 녹음을 글자·획의 접촉 순간에만 재생하며, 공백이나 분필을 떼는 동안에는 소리가 멈춥니다. 기본 음량은 작게 설정했고 **분필 음량** 슬라이더로 따로 조절할 수 있습니다.
- **Microsoft Foundry / MAI-Voice-2**의 한국어 AI 해설(`ko-KR-Haena:MAI-Voice-2`), 재생·일시정지, 장 이동, 재생 속도, 음성·분필 소리 설정, 기울기·절편 실험, 확인 문제.
- 실제 촬영된 선생님 영상이 아니라 글씨와 그래프를 그리는 칠판 애니메이션입니다.

## 제작과 검증

```bash
cd chalk-talks/linear-function
node build.mjs
node --test lesson.test.mjs
```

실제 Chrome 검증 스크립트도 포함합니다. Python `playwright`와 `/usr/bin/google-chrome`이 설치된 환경에서 실행하세요. 결과 스크린샷은 지정한 별도 폴더에 저장됩니다.

```bash
python3 verify_browser.py --artifacts /tmp/linear-function-qa --full-playback
python3 verify_media.py --artifacts /tmp/linear-function-qa
python3 verify_chalk.py --artifacts /tmp/linear-function-qa
```

첫 스크립트는 인터넷을 차단한 상태에서 8장 전체 재생, 일시정지·재개, 속도, 장 이동, 실험실, 퀴즈를 확인합니다. 두 번째는 실제 분필 오디오 신호와 정지·음소거 시 무음, 음성 오류 안내, 키보드 조작, 모션 감소 설정을 검증합니다.
`verify_chalk.py`는 녹음된 음원을 사용하는지, 기본 출력이 충분히 작은지, 글자별 접촉과 공백의 무음이 있는지, 음량 0이 실제로 무음인지 확인합니다. 신호 측정은 청감 평가를 대신하지 않습니다.

`lesson.json`은 수정 가능한 강의 원본입니다. `template.html`, `style.css`, `player.js`는 재생기 원본입니다. 기본 chalk-talk 엔진에는 좌표 그래프·음성 타임라인이 없으므로 원본 스킬을 수정하지 않고 수학 수업용 Canvas 재생기를 별도로 구현했습니다. 코드 호출 흐름을 설명하는 자료가 아니므로 코드 증명 수치는 적용되지 않습니다.

## Foundry 음성 다시 만들기

이미 생성된 음성 파일로 HTML을 빌드할 때는 Python, Azure 로그인, API 키가 필요하지 않습니다. 대본을 바꾸고 음성을 재생성할 때만 아래 과정이 필요하며 Azure Speech 사용료가 발생합니다.

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements-audio.txt
az login
AZURE_CONFIG_DIR="$HOME/.azure" .venv/bin/python narrate.py --smoke
AZURE_CONFIG_DIR="$HOME/.azure" .venv/bin/python narrate.py --force
node build.mjs
```

기존 Foundry AIServices 리소스 `mai-transcribe-westus-resource` / `public-ai-rg`를 사용합니다. 다른 리소스에는 `--resource`, `--resource-group`, `--voice`를 명시하세요. Entra 인증은 Azure CLI 로그인만 사용하며, HTML에는 인증 정보·API 키·접근 토큰을 넣지 않습니다. 음성 모델은 배포 목록이 아닌 Speech SDK의 음성 이름으로 호출합니다.

한국어 손글씨는 네이버 **나눔손글씨 펜**을 포함합니다. 글꼴 라이선스는 `assets/OFL.txt`에 있습니다.

분필 음원은 **digitale.de — Writing with Chalk / Chalkboard**, [Freesound 178433](https://freesound.org/people/digitale.de/sounds/178433/), **CC0-1.0**의 실제 녹음입니다. 사용 구간·필터·라이선스는 `assets/chalk-writing-source.json`에 기록했습니다. 글자마다 원본 녹음을 새로 한 것은 아니며, 녹음 일부를 화면의 글자·획 접촉에 맞춰 재생합니다.
