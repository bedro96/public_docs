/* fonts.mjs - 내장 글꼴(NanumPenScript + QMath)의 글자 집합(cmap)을 읽는 도우미.
 *
 * 칠판(Canvas)과 화면(DOM)에 쓰이는 모든 글자는 두 글꼴의 합집합 안에 있어야 합니다.
 * 어느 글꼴에도 없는 글자는 조용히 빈 네모로 보이므로 검증(validate.mjs)과 빌드(build.mjs)에서 오류로 막습니다.
 */
import fs from 'node:fs';
import path from 'node:path';

export const NANUM_FILE = 'NanumPenScript-Regular.ttf';
export const QMATH_FILE = 'QMath-subset.ttf';

/** TTF cmap 읽기 (형식 4, 12): 글꼴이 실제로 가진 글자(코드 포인트) 집합 */
export function loadCmap(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const numTables = dv.getUint16(4);
  let cmapOff = -1;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    const tag = String.fromCharCode(dv.getUint8(rec), dv.getUint8(rec + 1), dv.getUint8(rec + 2), dv.getUint8(rec + 3));
    if (tag === 'cmap') cmapOff = dv.getUint32(rec + 8);
  }
  if (cmapOff < 0) throw new Error('글꼴에 cmap 표가 없습니다');
  const subCount = dv.getUint16(cmapOff + 2);
  const set = new Set();
  for (let i = 0; i < subCount; i++) {
    const off = cmapOff + dv.getUint32(cmapOff + 4 + i * 8 + 4);
    const format = dv.getUint16(off);
    if (format === 4) {
      const segX2 = dv.getUint16(off + 6);
      const endO = off + 14;
      const startO = endO + segX2 + 2;
      const deltaO = startO + segX2;
      const rangeO = deltaO + segX2;
      for (let s = 0; s < segX2 / 2; s++) {
        const end = dv.getUint16(endO + s * 2);
        const start = dv.getUint16(startO + s * 2);
        const delta = dv.getInt16(deltaO + s * 2);
        const rOff = dv.getUint16(rangeO + s * 2);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          let g;
          if (rOff === 0) g = (c + delta) & 0xffff;
          else {
            g = dv.getUint16(rangeO + s * 2 + rOff + (c - start) * 2);
            if (g !== 0) g = (g + delta) & 0xffff;
          }
          if (g !== 0) set.add(c);
        }
      }
    } else if (format === 12) {
      const groups = dv.getUint32(off + 12);
      for (let g = 0; g < groups; g++) {
        const start = dv.getUint32(off + 16 + g * 12);
        const end = dv.getUint32(off + 20 + g * 12);
        const gid = dv.getUint32(off + 24 + g * 12);
        for (let c = start; c <= end; c++) if (gid + (c - start) !== 0) set.add(c);
      }
    }
  }
  if (set.size === 0) throw new Error('글꼴 cmap을 해석하지 못했습니다');
  return set;
}

/** 글꼴 파일 바이트에서 { cmap, size } */
export const parseFont = (buf) => ({ cmap: loadCmap(buf), size: buf.length });

/** assets/ 의 두 글꼴을 읽습니다. 실패하면 { error } 를 돌려줍니다(예외를 던지지 않습니다). */
export function loadFonts(root) {
  const read = (name) => {
    const p = path.join(root, 'assets', name);
    try { return fs.readFileSync(p); } catch { return null; }
  };
  const nanum = read(NANUM_FILE);
  const qmath = read(QMATH_FILE);
  if (!nanum) return { error: 'assets/' + NANUM_FILE + ' 이(가) 없습니다' };
  if (!qmath) return { error: 'assets/' + QMATH_FILE + ' 이(가) 없습니다 — python3 subset_font.py 로 만드세요' };
  try {
    const a = parseFont(nanum);
    const b = parseFont(qmath);
    return { nanum, qmath, nanumInfo: a, qmathInfo: b, union: new Set([...a.cmap, ...b.cmap]) };
  } catch (e) {
    return { error: '글꼴을 읽지 못했습니다: ' + e.message };
  }
}

const codeOf = (ch) => 'U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');

/**
 * entries = [{ text, where }] 중 어느 글꼴(cmaps 중 하나)에도 없는 글자를 [{ char, code, where }] 로 돌려줍니다.
 * 공백류와 줄바꿈은 그리지 않으므로 건너뜁니다.
 */
export function missingGlyphs(entries, cmaps) {
  const list = Array.isArray(cmaps) ? cmaps : [cmaps];
  const has = (cp) => list.some((c) => (c instanceof Set ? c.has(cp) : c.cmap.has(cp)));
  const missing = new Map();
  for (const { text, where } of entries) {
    for (const ch of text) {
      if (/\s/.test(ch) || has(ch.codePointAt(0))) continue;
      if (!missing.has(ch)) missing.set(ch, where);
    }
  }
  return [...missing].map(([char, where]) => ({ char, where, code: codeOf(char) }));
}
