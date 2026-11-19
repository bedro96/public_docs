"""Generate embedded Korean narration for the elliptic-curve lesson.

Reads steps[].narration from elliptic-curve.scene.json and writes one MP3 per step
to audio/<step id>.mp3 plus audio/durations.json and audio/provider.json.
Auth is Microsoft Entra ID through the Azure CLI login only; no keys are stored.
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

import azure.cognitiveservices.speech as speechsdk
from azure.identity import AzureCliCredential


ROOT = Path(__file__).resolve().parent
SCENE = ROOT / "elliptic-curve.scene.json"
AUDIO_DIR = ROOT / "audio"
THROTTLE_SECONDS = 2
MAX_ATTEMPTS = 4
MIN_BYTES = 2000
# MAI-Voice-2 rejects long inputs with "input_too_long" (observed: 488 characters failed,
# 441 succeeded at about 59 s of audio). Keep each step's narration at or below this.
MAX_CHARS = 450
OUTPUT_FORMAT = speechsdk.SpeechSynthesisOutputFormat.Audio24Khz96KBitRateMonoMp3
# Symbols the voice may read unpredictably; narration must spell math out in Hangul.
UNSPOKEN = re.compile(r"[\^_{}=+*/<>≠≈≤≥→∞²³√·−]|[0-9]")


def sha256(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def probe_duration(path):
    out = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path)
    ], text=True).strip()
    return float(out)


def load_steps():
    scene = json.loads(SCENE.read_text(encoding="utf-8"))
    steps = []
    for step in scene["steps"]:
        text = step.get("narration")
        if not isinstance(text, str) or not text.strip():
            raise SystemExit(f'steps[{step["id"]}] has no narration text')
        bad = sorted(set(UNSPOKEN.findall(text)))
        if bad:
            raise SystemExit(f'steps[{step["id"]}] narration has unspoken symbols/digits: {bad}')
        if len(text.strip()) > MAX_CHARS:
            raise SystemExit(
                f'steps[{step["id"]}] narration is {len(text.strip())} characters; '
                f'the service limit requires at most {MAX_CHARS}'
            )
        steps.append({"id": step["id"], "text": text.strip()})
    return steps


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only", help="Generate one step by id.")
    parser.add_argument("--force", action="store_true", help="Regenerate existing clips.")
    parser.add_argument("--smoke", action="store_true", help="Test voice and auth with a short clip.")
    parser.add_argument("--resource", default="mai-transcribe-westus-resource")
    parser.add_argument("--resource-group", default="public-ai-rg")
    parser.add_argument("--voice", default="ko-KR-Haena:MAI-Voice-2")
    args = parser.parse_args()
    os.environ.setdefault("AZURE_CONFIG_DIR", str(Path.home() / ".azure"))
    resource = json.loads(subprocess.check_output([
        "az", "cognitiveservices", "account", "show",
        "--name", args.resource, "--resource-group", args.resource_group,
        "--query", "{id:id,endpoint:properties.endpoint,kind:kind}", "-o", "json"
    ], text=True))
    if resource["kind"] != "AIServices":
        raise SystemExit(f'{args.resource} is {resource["kind"]}, expected AIServices')
    credential = AzureCliCredential()

    def synthesize(text, output):
        token = credential.get_token("https://cognitiveservices.azure.com/.default")
        # A fresh config per call avoids sporadic mid-batch 1007 errors.
        config = speechsdk.SpeechConfig(endpoint=resource["endpoint"])
        config.authorization_token = f'aad#{resource["id"]}#{token.token}'
        config.speech_synthesis_voice_name = args.voice
        config.set_speech_synthesis_output_format(OUTPUT_FORMAT)
        # Keep the synthesizer bound; chaining it inline can segfault on garbage collection.
        synthesizer = speechsdk.SpeechSynthesizer(
            speech_config=config,
            audio_config=speechsdk.audio.AudioOutputConfig(filename=str(output))
        )
        result = synthesizer.speak_text_async(text).get()
        if result.reason != speechsdk.ResultReason.SynthesizingAudioCompleted:
            raise RuntimeError(
                f"Speech synthesis failed: {result.cancellation_details.error_details}"
            )
        del synthesizer
        if output.stat().st_size < MIN_BYTES:
            raise ValueError(f"Speech service returned an empty or truncated clip: {output}")

    AUDIO_DIR.mkdir(exist_ok=True)
    if args.smoke:
        target = AUDIO_DIR / "smoke.pending.mp3"
        try:
            synthesize("안녕하세요. 타원곡선 위의 덧셈을 함께 배워 봅시다.", target)
            print(f"Voice smoke test passed: {args.voice} ({target.stat().st_size} bytes, "
                  f"{probe_duration(target):.1f} s)", flush=True)
        finally:
            target.unlink(missing_ok=True)
        return

    steps = load_steps()
    selected = [s for s in steps if args.only is None or s["id"] == args.only]
    if not selected:
        parser.error(f"Unknown step: {args.only}")

    provider_path = AUDIO_DIR / "provider.json"
    previous = json.loads(provider_path.read_text(encoding="utf-8")) if provider_path.exists() else {}
    hashes = dict(previous.get("scriptSha256", {}))
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
            except Exception as error:
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
    provider_path.write_text(json.dumps({
        "provider": "Microsoft Foundry / Azure AI Speech",
        "model": "MAI-Voice-2",
        "voice": args.voice,
        "synthetic": True,
        "language": "ko-KR",
        "format": "audio-24khz-96kbitrate-mono-mp3",
        "auth": "Microsoft Entra ID (Azure CLI); no keys stored",
        "script": "elliptic-curve.scene.json steps[].narration",
        "scriptSha256": {s["id"]: hashes[s["id"]] for s in steps if s["id"] in hashes}
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if failures:
        raise SystemExit(f'Synthesis failed for: {", ".join(failures)}')


if __name__ == "__main__":
    main()
