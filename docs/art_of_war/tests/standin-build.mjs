// 시험용 "소리 있는" 빌드 만들기 (verify_media.py 가 사용합니다).
//
// 실제 해설 MP3 가 아직 없어도 소리 경로(오디오 시계·완료·0.9초 간격·자동 넘김·소리 끄기)를 브라우저에서 시험할 수 있도록,
// 임시 폴더 안에서 CC0 분필 녹음을 반복 이어 붙여 단계마다 "가짜 해설 클립"을 만들고 그 폴더로 일반 빌드를 돌립니다.
// 임시 폴더는 끝나면 지워지고, 저장소에는 아무것도 남지 않습니다. 산출물은 --out 으로 받은 경로(저장소 밖 권장)에만 씁니다.
//
//   node tests/standin-build.mjs --out /tmp/art-of-war-standin.html [--content tests/fixtures/content]
//
// 이 산출물은 시험 전용입니다. 배포하지 마세요(해설이 아니라 분필 소리입니다).
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { ROOT, TEMPLATE_NAME, loadContent, mp3Info, build } from '../build.mjs';

const require = createRequire(import.meta.url);
const L = require('../layout.js');

const ASSETS = ['NanumPenScript-Regular.ttf', 'ChalkHanja-subset.otf', 'OFL.txt', 'OFL-NotoSerifCJK.txt', 'chalk-writing.mp3', 'chalk-writing-source.json'];

/**
 * 분필 녹음을 seconds 길이로 반복해 새로 인코딩한 MP3. 단순히 MP3 파일을 이어 붙이면 Chrome 이 길이를
 * 재생하면서 계속 늘려 잡아 "끝"(ended)이 오지 않으므로, ffmpeg 로 정상 헤더(Xing)가 있는 CBR 파일을 만듭니다.
 * (이 도구는 시험 전용이며, 빌드 자체는 ffmpeg 가 필요 없습니다.)
 */
function repeatedChalk(chalkPath, seconds, tmpDir, name) {
  const out = path.join(tmpDir, name + '.tmp.mp3');
  const r = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-loglevel', 'error', '-y', '-stream_loop', '-1', '-i', chalkPath, '-t', seconds.toFixed(2), '-c:a', 'libmp3lame', '-b:a', '64k', '-ar', '24000', '-ac', '1', '-map_metadata', '-1', out],
    { encoding: 'utf8' },
  );
  if (r.error || r.status !== 0) throw new Error('ffmpeg 가 필요합니다(시험용 가짜 해설 클립 생성): ' + (r.error ? r.error.message : r.stderr));
  const buf = fs.readFileSync(out);
  fs.rmSync(out);
  return buf;
}

export function buildStandIn({ content, out }) {
  if (!out || !path.isAbsolute(out)) throw new Error('--out 은 절대 경로여야 합니다');
  const contentDir = path.resolve(content || path.join(ROOT, 'tests', 'fixtures', 'content'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aow-standin-'));
  try {
    fs.mkdirSync(path.join(dir, 'assets'));
    fs.mkdirSync(path.join(dir, 'content'));
    fs.mkdirSync(path.join(dir, 'audio'));
    for (const f of [TEMPLATE_NAME, 'style.css', 'layout.js', 'draw.js', 'player.js']) fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
    for (const f of ASSETS) fs.copyFileSync(path.join(ROOT, 'assets', f), path.join(dir, 'assets', f));
    for (const f of fs.readdirSync(contentDir)) {
      if (f.endsWith('.json')) fs.copyFileSync(path.join(contentDir, f), path.join(dir, 'content', f));
    }
    const loaded = loadContent(path.join(dir, 'content'));
    if (!loaded.scene) throw new Error('내용을 읽지 못했습니다: ' + loaded.problems.join('; '));
    const chalkPath = path.join(dir, 'assets', 'chalk-writing.mp3');
    const durations = {};
    const hashes = {};
    for (const s of loaded.scene.steps) {
      // 판서(추정 길이)보다 조금 긴 클립: 판서가 끝난 뒤에도 "해설이 남는" 상황을 시험할 수 있게 합니다.
      const clip = repeatedChalk(chalkPath, L.estimateDuration(s.narration) + 4, dir, s.id);
      fs.writeFileSync(path.join(dir, 'audio', s.id + '.mp3'), clip);
      durations[s.id] = Math.round(mp3Info(clip).duration * 1000) / 1000;
      hashes[s.id] = crypto.createHash('sha256').update(s.narration).digest('hex');
    }
    fs.writeFileSync(path.join(dir, 'audio', 'durations.json'), JSON.stringify(durations, null, 2));
    fs.writeFileSync(
      path.join(dir, 'audio', 'provider.json'),
      JSON.stringify({ provider: 'azure-speech', model: 'MAI-Voice-2', voice: 'ko-KR-Haena:MAI-Voice-2', language: 'ko-KR', format: 'mp3', synthetic: true, scriptSha256: hashes }, null, 2),
    );
    build({ root: dir, out, clipMinSeconds: 4 });
    return out;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  try {
    const out = buildStandIn({ content: get('--content'), out: get('--out') && path.resolve(get('--out')) });
    console.log('시험용 소리 빌드(가짜 해설 클립 — 배포 금지):', out);
  } catch (e) {
    console.error('실패:', e.message);
    process.exit(1);
  }
}
