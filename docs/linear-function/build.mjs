import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (file, encoding = 'utf8') => readFile(path.join(root, file), encoding);
const lesson = JSON.parse(await read('lesson.json'));
const durations = JSON.parse(await read('audio/durations.json'));
lesson.narrationProvider = JSON.parse(await read('audio/provider.json'));
lesson.chalkSound = {
  ...JSON.parse(await read('assets/chalk-writing-source.json')),
  audio: `data:audio/mpeg;base64,${(await read('assets/chalk-writing.mp3', null)).toString('base64')}`
};
for (const chapter of lesson.chapters) {
  const clip = await read(`audio/${chapter.id}.mp3`, null);
  if (clip.length < 1000 || !(durations[chapter.id] > 0)) {
    throw new Error(`Narration is missing or invalid for ${chapter.id}`);
  }
  chapter.audio = `data:audio/mpeg;base64,${clip.toString('base64')}`;
  chapter.duration = durations[chapter.id];
}
const font = (await read('assets/NanumPenScript-Regular.ttf', null)).toString('base64');
const fontFace = `@font-face{font-family:ChalkKorean;src:url(data:font/ttf;base64,${font}) format('truetype');font-display:swap;}\n`;
const scriptData = JSON.stringify(lesson).replaceAll('<', '\\u003c');
let html = await read('template.html');
const parts = [
  ['/*__STYLES__*/', fontFace + await read('style.css')],
  ['/*__LESSON__*/', `window.LESSON_DATA = ${scriptData};`],
  ['/*__PLAYER__*/', await read('player.js')]
];
for (const [token, replacement] of parts) {
  if (html.split(token).length !== 2) throw new Error(`Expected exactly one ${token}`);
  html = html.replace(token, () => replacement);
}
if (/\/\*__[A-Z]+__\*\//.test(html)) throw new Error('Unresolved build token');
const output = path.join(root, '일차함수_칠판강의.html');
await writeFile(output, html);
console.log(`Built ${output}`);
console.log(`${lesson.chapters.length} chapters; ${(Object.values(durations).reduce((a, b) => a + b, 0) / 60).toFixed(1)} minutes of embedded Korean synthetic narration`);
console.log(`${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MiB; scripts, font and audio embedded; no runtime network required`);
