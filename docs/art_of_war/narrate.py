"""손자병법 칠판 강의의 한국어 해설 음성을 만듭니다.

content/00-meta.json 과 01~04 단계 파일(파일 이름순)을 합친 뒤 steps[].narration 마다
audio/<단계 id>.mp3 한 개, audio/durations.json, audio/provider.json 을 씁니다.
인증은 Azure CLI 로그인(Microsoft Entra ID)만 씁니다. 키는 어디에도 저장하지 않습니다.

  python narrate.py --check          # 네트워크 없이 대본·기존 클립 상태만 점검
  python narrate.py --smoke          # 목소리·인증 확인(짧은 한 문장)
  python narrate.py                  # 없거나 대본이 바뀐 클립만 만들기(이어 만들기)
  python narrate.py --only ch02-cost # 한 단계만
  python narrate.py --force          # 모두 다시 만들기

음성은 AI 합성(Azure Speech MAI-Voice-2, ko-KR-Haena)이며 실제 사람 목소리가 아닙니다.
"""

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONTENT_DIR = ROOT / "content"
AUDIO_DIR = ROOT / "audio"
META_FILE = "00-meta.json"
# 01-background.json, 02-chapters-a.json ... 처럼 0 + 숫자로 시작하는 단계 파일 (build.mjs 와 같은 규칙)
STEP_FILE_RE = re.compile(r"^0[1-9][\w-]*\.json$")
THROTTLE_SECONDS = 2
MAX_ATTEMPTS = 4
MIN_BYTES = 2000
# MAI-Voice-2 는 너무 긴 입력을 input_too_long 으로 거절합니다(488자 실패, 441자 성공 — 약 59초).
MAX_CHARS = 450
OUTPUT_FORMAT_NAME = "Audio24Khz96KBitRateMonoMp3"
# 음성이 예측 불가하게 읽을 수 있는 글자: 한자·로마자·숫자·기호는 해설에 쓰지 않습니다(모두 한글로 풉니다).
UNSPOKEN = re.compile(r"[^가-힣\s,.?!]")
SMOKE_TEXT = "안녕하세요. 손자병법 칠판 강의를 함께 읽어 봅시다."


def sha256(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def probe_duration(path):
    out = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path)
    ], text=True).strip()
    return float(out)


def load_steps(content_dir=CONTENT_DIR):
    """단계 파일을 이름순으로 합쳐 [{id, text}] 를 돌려줍니다. 대본이 규칙을 어기면 종료합니다."""
    files = sorted(p for p in content_dir.iterdir() if STEP_FILE_RE.match(p.name)) if content_dir.exists() else []
    if not files:
        raise SystemExit(f"{content_dir} 에 단계 파일(01-*.json …)이 없습니다")
    steps = []
    seen = set()
    for path in files:
        data = json.loads(path.read_text(encoding="utf-8"))
        for step in data.get("steps", []):
            sid = step.get("id")
            text = step.get("narration")
            if not isinstance(sid, str) or not sid:
                raise SystemExit(f"{path.name}: id 가 없는 단계가 있습니다")
            if sid in seen:
                raise SystemExit(f"{path.name}: id 가 겹칩니다: {sid}")
            seen.add(sid)
            if not isinstance(text, str) or not text.strip():
                raise SystemExit(f"steps[{sid}] 에 narration 이 없습니다")
            bad = sorted(set(UNSPOKEN.findall(text)))
            if bad:
                raise SystemExit(f"steps[{sid}] 해설에 읽을 수 없는 글자(한자·숫자·기호 등)가 있습니다: {bad}")
            if text != text.strip():
                raise SystemExit(f"steps[{sid}] 해설 앞뒤에 공백이 있습니다 (대본 해시가 달라집니다)")
            if len(text) > MAX_CHARS:
                raise SystemExit(f"steps[{sid}] 해설이 {len(text)}자입니다. 음성 서비스 한도는 {MAX_CHARS}자입니다")
            steps.append({"id": sid, "text": text})
    return steps


def read_provider():
    path = AUDIO_DIR / "provider.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def check_only(steps):
    """네트워크 없이 기존 클립이 최신인지 알려 줍니다."""
    hashes = read_provider().get("scriptSha256", {})
    missing, stale = [], []
    for step in steps:
        clip = AUDIO_DIR / f'{step["id"]}.mp3'
        if not clip.exists():
            missing.append(step["id"])
        elif hashes.get(step["id"]) != sha256(step["text"]):
            stale.append(step["id"])
    total = sum(len(s["text"]) for s in steps)
    print(f"단계 {len(steps)}개, 해설 {total}자 (단계당 평균 {total // max(1, len(steps))}자)")
    print(f"만들어야 할 클립: {len(missing)}개 {missing}" if missing else "없는 클립: 없음")
    print(f"대본이 바뀌어 다시 만들 클립: {len(stale)}개 {stale}" if stale else "오래된 클립: 없음")
    return not missing and not stale


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--only", help="한 단계만 만듭니다(단계 id).")
    parser.add_argument("--force", action="store_true", help="이미 있는 클립도 다시 만듭니다.")
    parser.add_argument("--smoke", action="store_true", help="짧은 문장으로 목소리와 인증만 확인합니다.")
    parser.add_argument("--check", action="store_true", help="네트워크 없이 대본과 기존 클립 상태만 점검합니다.")
    parser.add_argument("--resource", default="mai-transcribe-westus-resource")
    parser.add_argument("--resource-group", default="public-ai-rg")
    parser.add_argument("--voice", default="ko-KR-Haena:MAI-Voice-2")
    args = parser.parse_args()

    if args.check:
        sys.exit(0 if check_only(load_steps()) else 1)

    # SDK 는 실제로 합성할 때만 불러옵니다(그래서 --help, --check 는 SDK 없이도 동작합니다).
    try:
        import azure.cognitiveservices.speech as speechsdk
        from azure.identity import AzureCliCredential
    except ImportError as error:
        raise SystemExit(f"음성 SDK 가 없습니다: pip install -r requirements-audio.txt ({error})")

    os.environ.setdefault("AZURE_CONFIG_DIR", str(Path.home() / ".azure"))
    resource = json.loads(subprocess.check_output([
        "az", "cognitiveservices", "account", "show",
        "--name", args.resource, "--resource-group", args.resource_group,
        "--query", "{id:id,endpoint:properties.endpoint,kind:kind}", "-o", "json"
    ], text=True))
    if resource["kind"] != "AIServices":
        raise SystemExit(f'{args.resource} is {resource["kind"]}, expected AIServices')
    credential = AzureCliCredential()
    output_format = getattr(speechsdk.SpeechSynthesisOutputFormat, OUTPUT_FORMAT_NAME)

    def synthesize(text, output):
        token = credential.get_token("https://cognitiveservices.azure.com/.default")
        # 호출마다 새 설정을 씁니다: 일괄 작업 중간에 가끔 나는 1007 오류를 피합니다.
        config = speechsdk.SpeechConfig(endpoint=resource["endpoint"])
        config.authorization_token = f'aad#{resource["id"]}#{token.token}'
        config.speech_synthesis_voice_name = args.voice
        config.set_speech_synthesis_output_format(output_format)
        # synthesizer 를 변수에 붙들어 둡니다: 바로 이어 쓰면 가비지 수집 때 세그폴트가 날 수 있습니다.
        synthesizer = speechsdk.SpeechSynthesizer(
            speech_config=config,
            audio_config=speechsdk.audio.AudioOutputConfig(filename=str(output))
        )
        result = synthesizer.speak_text_async(text).get()
        if result.reason != speechsdk.ResultReason.SynthesizingAudioCompleted:
            raise RuntimeError(f"Speech synthesis failed: {result.cancellation_details.error_details}")
        del synthesizer
        if output.stat().st_size < MIN_BYTES:
            raise ValueError(f"Speech service returned an empty or truncated clip: {output}")

    AUDIO_DIR.mkdir(exist_ok=True)
    if args.smoke:
        target = AUDIO_DIR / "smoke.pending.mp3"
        try:
            synthesize(SMOKE_TEXT, target)
            print(f"Voice smoke test passed: {args.voice} ({target.stat().st_size} bytes, "
                  f"{probe_duration(target):.1f} s)", flush=True)
        finally:
            target.unlink(missing_ok=True)
        return

    steps = load_steps()
    selected = [s for s in steps if args.only is None or s["id"] == args.only]
    if not selected:
        parser.error(f"Unknown step: {args.only}")

    hashes = dict(read_provider().get("scriptSha256", {}))
    failures = []
    first = True
    for step in selected:
        target = AUDIO_DIR / f'{step["id"]}.mp3'
        digest = sha256(step["text"])
        current = target.exists() and hashes.get(step["id"]) == digest
        if current and not args.force:
            print(f'{step["id"]}: up to date', flush=True)
            continue
        temporary = target.with_suffix(".pending.mp3")
        for attempt in range(1, MAX_ATTEMPTS + 1):
            if not first:
                time.sleep(THROTTLE_SECONDS)
            first = False
            print(f'Generating {step["id"]} (attempt {attempt})…', flush=True)
            try:
                synthesize(step["text"], temporary)
                temporary.replace(target)
                hashes[step["id"]] = digest
                break
            except Exception as error:  # 일시적인 서비스 오류는 늘려 가며 다시 시도합니다
                print(f'  failed: {error}', file=sys.stderr, flush=True)
                if attempt == MAX_ATTEMPTS:
                    failures.append(step["id"])
                else:
                    time.sleep(THROTTLE_SECONDS * attempt * 2)
            finally:
                temporary.unlink(missing_ok=True)

    durations = {}
    for step in steps:
        target = AUDIO_DIR / f'{step["id"]}.mp3'
        if target.exists() and hashes.get(step["id"]) == sha256(step["text"]):
            duration = probe_duration(target)
            if duration <= 0:
                raise ValueError(f"Empty narration: {target}")
            durations[step["id"]] = round(duration, 3)
            print(f'{step["id"]}: {duration:.1f} seconds', flush=True)
    (AUDIO_DIR / "durations.json").write_text(
        json.dumps(durations, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (AUDIO_DIR / "provider.json").write_text(json.dumps({
        "provider": "Microsoft Foundry / Azure AI Speech",
        "model": "MAI-Voice-2",
        "voice": args.voice,
        "synthetic": True,
        "language": "ko-KR",
        "format": "audio-24khz-96kbitrate-mono-mp3",
        "auth": "Microsoft Entra ID (Azure CLI); no keys stored",
        "script": "content/*.json steps[].narration",
        "scriptSha256": {s["id"]: hashes[s["id"]] for s in steps if s["id"] in hashes}
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if failures:
        raise SystemExit(f'Synthesis failed for: {", ".join(failures)}')


if __name__ == "__main__":
    main()
