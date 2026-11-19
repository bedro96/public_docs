import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const lesson = JSON.parse(await readFile(path.join(root, 'lesson.json'), 'utf8'));

test('the daughter-facing lesson and narration are Korean throughout', async () => {
  assert.equal(lesson.lang, 'ko');
  for (const chapter of lesson.chapters) {
    for (const field of ['title', 'summary', 'narration']) {
      assert.match(chapter[field], /[가-힣]/, `${chapter.id}: ${field}`);
    }
    assert.ok(chapter.notes.every(note => /[가-힣]/.test(note.text) || /[xy]/.test(note.text)));
  }
  const provider = JSON.parse(await readFile(path.join(root, 'audio/provider.json'), 'utf8'));
  assert.equal(provider.language, 'ko-KR');
  const html = await readFile(path.join(root, '일차함수_칠판강의.html'), 'utf8');
  assert.match(html, /<html\b[^>]*lang=["']ko["']/i);
});

test('all teaching points, comparison lines and slope triangles are mathematically consistent', () => {
  for (const chapter of lesson.chapters) {
    const lines = [chapter, ...(chapter.compare ?? [])];
    for (const point of chapter.points ?? []) {
      assert.ok(lines.some(({ a, b }) => Math.abs(a * point.x + b - point.y) < 1e-9),
        `${chapter.id}: (${point.x}, ${point.y}) is not on any displayed line`);
    }
    if (chapter.rise) {
      const { x, y, dx, dy } = chapter.rise;
      assert.equal(chapter.a * x + chapter.b, y, chapter.id);
      assert.notEqual(dx, 0);
      assert.equal(dy / dx, chapter.a, chapter.id);
    }
  }
  assert.equal(lesson.chapters.find(chapter => chapter.id === 'zero').a, 0);
  assert.match(lesson.chapters.find(chapter => chapter.id === 'zero').summary, /a ≠ 0/);
});

test('the quiz teaches the slope sign and correct y-intercept without conflating x-intercept', () => {
  const answers = lesson.quiz.options.filter(option => option.correct);
  assert.equal(answers.length, 1);
  assert.match(answers[0].text, /내려가/);
  assert.match(answers[0].text, /\(0, 3\)/);
  assert.ok(lesson.quiz.options.some(option => /1.5/.test(option.feedback)));
});

test('every chapter has a real, nonempty Foundry-generated audio clip', async () => {
  const durations = JSON.parse(await readFile(path.join(root, 'audio/durations.json'), 'utf8'));
  const provider = JSON.parse(await readFile(path.join(root, 'audio/provider.json'), 'utf8'));
  assert.equal(provider.model, 'MAI-Voice-2');
  assert.equal(provider.voice, 'ko-KR-Haena:MAI-Voice-2');
  for (const chapter of lesson.chapters) {
    const clip = await readFile(path.join(root, `audio/${chapter.id}.mp3`));
    assert.ok(clip.length > 2000, chapter.id);
    assert.ok(durations[chapter.id] > 10, chapter.id);
  }
});

test('the distributed HTML embeds all media and has no external runtime dependencies', async () => {
  const html = await readFile(path.join(root, '일차함수_칠판강의.html'), 'utf8');
  assert.equal((html.match(/data:audio\/mpeg;base64,/g) ?? []).length, lesson.chapters.length + 1);
  assert.match(html, /data:font\/ttf;base64,/);
  assert.doesNotMatch(html, /\/\*__[A-Z]+__\*\//);
  assert.doesNotMatch(html, /<(?:script|img|audio|source)\b[^>]*src=["']https?:/i);
  assert.doesNotMatch(html, /<link\b[^>]*href=["']https?:/i);
  assert.doesNotMatch(html, /url\(\s*["']?https?:/i);
});
