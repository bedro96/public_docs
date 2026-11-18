"""Generate embedded Korean narration with an existing Foundry AIServices account."""

import argparse
import json
import os
import subprocess
import time
from pathlib import Path

import azure.cognitiveservices.speech as speechsdk
from azure.identity import AzureCliCredential


ROOT = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only", help="Generate one chapter by id.")
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
        "--query", "{id:id,endpoint:properties.endpoint}", "-o", "json"
    ], text=True))
    token = AzureCliCredential().get_token("https://cognitiveservices.azure.com/.default")

    def synthesize(text, output):
        config = speechsdk.SpeechConfig(endpoint=resource["endpoint"])
        config.authorization_token = f'aad#{resource["id"]}#{token.token}'
        config.speech_synthesis_voice_name = args.voice
        config.set_speech_synthesis_output_format(
            speechsdk.SpeechSynthesisOutputFormat.Audio24Khz96KBitRateMonoMp3
        )
        synthesizer = speechsdk.SpeechSynthesizer(
            speech_config=config,
            audio_config=speechsdk.audio.AudioOutputConfig(filename=str(output))
        )
        result = synthesizer.speak_text_async(text).get()
        if result.reason != speechsdk.ResultReason.SynthesizingAudioCompleted:
            raise RuntimeError(
                f"Foundry speech synthesis failed: {result.cancellation_details.error_details}"
            )
        if output.stat().st_size < 2000:
            raise ValueError(f"Foundry returned an empty or truncated clip: {output}")

    lesson = json.loads((ROOT / "lesson.json").read_text(encoding="utf-8"))
    audio_dir = ROOT / "audio"
    audio_dir.mkdir(exist_ok=True)
    if args.smoke:
        target = audio_dir / "smoke.mp3"
        synthesize("안녕하세요. 기울기와 와이 절편을 함께 배워 봅시다.", target)
        print(f"Foundry voice smoke test passed: {args.voice}", flush=True)
        target.unlink()
        return
    chapters = [
        chapter for chapter in lesson["chapters"]
        if args.only is None or chapter["id"] == args.only
    ]
    if not chapters:
        parser.error(f"Unknown chapter: {args.only}")
    durations = {}
    for chapter in chapters:
        target = audio_dir / f'{chapter["id"]}.mp3'
        if args.force or not target.exists():
            temporary = target.with_suffix(".pending.mp3")
            print(f'Generating {chapter["id"]}…', flush=True)
            try:
                synthesize(chapter["narration"], temporary)
                temporary.replace(target)
            finally:
                temporary.unlink(missing_ok=True)
            time.sleep(2)
        duration = float(subprocess.check_output([
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", str(target)
        ], text=True).strip())
        if duration <= 0:
            raise ValueError(f"Empty narration: {target}")
        durations[chapter["id"]] = round(duration, 3)
        print(f'{chapter["id"]}: {duration:.1f} seconds', flush=True)
    manifest_path = audio_dir / "durations.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    manifest.update(durations)
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (audio_dir / "provider.json").write_text(json.dumps({
        "provider": "Microsoft Foundry / Azure AI Speech",
        "model": "MAI-Voice-2",
        "voice": args.voice,
        "synthetic": True,
        "language": "ko-KR"
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
