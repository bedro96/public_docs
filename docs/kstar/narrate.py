import argparse
import json
import subprocess
import time
from pathlib import Path

import azure.cognitiveservices.speech as speech
from azure.identity import AzureCliCredential


here = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description="Generate Korean narration for the KSTAR chapters.")
parser.add_argument("out", type=Path)
parser.add_argument("--account", required=True, help="Name of the Azure AI Services speech account.")
parser.add_argument("--only")
parser.add_argument("--missing", action="store_true")
args = parser.parse_args()
script = json.loads((here / "narration.json").read_text())
if args.only and args.only not in script:
    parser.error(f"unknown chapter: {args.only}")
accounts = json.loads(subprocess.check_output([
    "az", "cognitiveservices", "account", "list", "--query",
    f"[?name=='{args.account}'].{{id:id, endpoint:properties.endpoint}}", "-o", "json",
], text=True))
if len(accounts) != 1:
    raise SystemExit("Speech account not uniquely available in the active Azure subscription.")
account = accounts[0]
token = AzureCliCredential().get_token("https://cognitiveservices.azure.com/.default")
args.out.mkdir(parents=True, exist_ok=True)

for chapter, text in script.items():
    if args.only and chapter != args.only:
        continue
    dest = args.out / f"{chapter}.mp3"
    if args.missing and dest.is_file() and dest.stat().st_size >= 2000:
        continue
    config = speech.SpeechConfig(endpoint=account["endpoint"])
    config.authorization_token = f"aad#{account['id']}#{token.token}"
    config.speech_synthesis_voice_name = "ko-KR-Haena:MAI-Voice-2"
    config.set_speech_synthesis_output_format(speech.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3)
    pending = dest.with_suffix(".pending.mp3")
    synth = speech.SpeechSynthesizer(speech_config=config, audio_config=speech.audio.AudioOutputConfig(filename=str(pending)))
    result = synth.speak_text_async(text).get()
    if result.reason != speech.ResultReason.SynthesizingAudioCompleted or not pending.is_file() or pending.stat().st_size < 2000:
        pending.unlink(missing_ok=True)
        details = result.cancellation_details
        raise SystemExit(f"Narration failed for {chapter}: {details.error_details if details else result.reason}")
    pending.replace(dest)
    print(f"{chapter}: {dest.stat().st_size} bytes", flush=True)
    time.sleep(2)
