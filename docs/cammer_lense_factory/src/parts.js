// The hero object as DATA: one iPhone-class rear main-camera module (sensor-shift OIS), drawn at the module's own
// scale in millimetres (1 world unit = 1 mm). Pure: used by the model (build schedule), the loupe geometry (mod.js)
// and the live layer (names, order). Dimensions are an [estimate]: no public source gives the iPhone module's size
// (R2 §1); the body footprint (about 15 x 15 mm, height about 9.6 mm) and every internal dimension are drawn to be
// self-consistent, not copied from a teardown.
//
// Every row: id, Korean name, English name, build stage (tour stage index 1..5), local window [a, b] inside that stage,
// the part's resting box in mm, material class, confidence tag and group.
//   mat: pcb flex gold steel dark glass copper polymer magnet silicon resin
//   grp: base (rigid-flex board and what rides on it) | ois (sensor-shift stage) | lens (VCM + barrel, one sub-assembly) | top
//   tag: V verified, E estimate, A assumption, U unverified (see data.js TAG)
import { order } from './order.js';

export const STAGE_OF = { smt: 1, bond: 2, lens: 3, align: 4, test: 5 };

const parts = [];
const add = (id, ko, en, st, f, box, mat, tag, grp, extra = {}) => parts.push({ id, ko, en, st, f, box, mat, tag, grp, ...extra });
const B = (x0, y0, z0, x1, y1, z1) => ({ x: x0, y: y0, z: z0, w: x1 - x0, d: y1 - y0, h: z1 - z0 });

// ---------- stage 2: substrate and SMT (tour stage 1) ----------
add('base', '리지드 기판', 'Rigid board', 1, [0.0, 0.1], B(-9.5, -7.5, 0, 9.5, 7.5, 0.4), 'pcb', 'E', 'base', { from: [0, 0, 6] });
add('flex', '연성 테일(FPCB)', 'Flex tail (FPCB)', 1, [0.02, 0.12], B(9.5, -2.5, 0.1, 28, 2.5, 0.3), 'flex', 'E', 'base', { from: [6, 0, 0], bdx: 6, bz: 1 });
add('stiff', '보강판(PI)', 'PI stiffener', 1, [0.1, 0.16], B(22, -2.9, 0.3, 28.4, 2.9, 0.6), 'polymer', 'A', 'base', { bdx: 8, bz: 2 });
add('b2b', 'B2B 커넥터 플러그', 'B2B connector plug', 1, [0.14, 0.2], B(23, -2.2, 0.6, 27.6, 2.2, 1.5), 'dark', 'V', 'base', { bdx: 10, bz: 6 });
add('paste', '솔더 페이스트', 'Solder paste', 1, [0.2, 0.34], B(-9.4, -7, 0.4, 9.4, 7, 0.5), 'copper', 'V', 'base', { from: [0, 0, 0], bz: 1.5 });

const PAS = [];
for (let i = 0; i < 8; i++) PAS.push([-8.6, -5.6 + i * 1.5, 'v']); // west strip, standing
PAS.push([8.9, -2.9, 'v'], [8.9, 2.9, 'v'], [8.0, -2.9, 'v'], [8.0, 2.9, 'v']); // east strip near the tail
PAS.push([-3.4, -7.0, 'h'], [3.4, 7.0, 'h']); // north and south edges
PAS.forEach(([x, y, o], i) => {
  const [w, d] = o === 'v' ? [0.7, 1.2] : [1.2, 0.7];
  add(`c${i + 1}`, `수동소자 ${i + 1} (0402급)`, `Passive ${i + 1} (0402-class)`, 1, [0.34 + (i % 7) * 0.035, 0.44 + (i % 7) * 0.035], B(x - w / 2, y - d / 2, 0.4, x + w / 2, y + d / 2, 0.85), i % 3 === 0 ? 'dark' : 'polymer', 'E', 'base', { bz: 5 + (i % 3), from: [0, 0, 7] });
});
add('ic-ois', 'OIS 드라이버 IC', 'OIS driver IC', 1, [0.58, 0.64], B(8.0, -6.6, 0.4, 9.4, -4.4, 1.1), 'dark', 'E', 'base', { bz: 7 });
add('ic-af', 'AF 드라이버 IC', 'AF driver IC', 1, [0.6, 0.66], B(8.0, 4.4, 0.4, 9.4, 6.6, 1.1), 'dark', 'E', 'base', { bz: 7 });
add('eeprom', 'EEPROM (보정 데이터)', 'EEPROM (calibration data)', 1, [0.62, 0.68], B(-9.4, 5.9, 0.4, -7.9, 7.1, 0.9), 'dark', 'E', 'base', { bz: 7 });
const COILS = [['e', 6.1, -3.7, 7.7, 3.7], ['w', -7.7, -3.7, -6.1, 3.7], ['n', -4.7, 5.0, 4.7, 6.6], ['s', -4.7, -6.6, 4.7, -5.0]];
COILS.forEach(([n, x0, y0, x1, y1], i) => add(`coil-${n}`, `OIS 코일 ${'동서북남'[i]}`, `OIS coil ${['E', 'W', 'N', 'S'][i]}`, 1, [0.66 + i * 0.03, 0.74 + i * 0.03], B(x0, y0, 0.4, x1, y1, 0.8), 'copper', 'E', 'base', { bz: 3.4 }));
const TMR = [['e', 6.9, 0], ['w', -6.9, 0], ['n', 0, 5.8]];
TMR.forEach(([n, x, y], i) => add(`tmr-${n}`, `TMR 위치 센서 ${i + 1}`, `TMR position sensor ${i + 1}`, 1, [0.76 + i * 0.03, 0.82 + i * 0.03], B(x - 0.45, y - 0.45, 0.8, x + 0.45, y + 0.45, 1.05), 'silicon', 'V', 'base', { bz: 5, note: 'TDK TMR ×3 (iPhone 17 main, 2차 자료)' }));

// ---------- stage 3: die attach and wire bond (tour stage 2) ----------
[[-6.9, -6.2], [6.9, -6.2], [-6.9, 6.2], [6.9, 6.2]].forEach(([x, y], i) => add(`post-${i + 1}`, `서스펜션 포스트 ${i + 1}`, `Suspension post ${i + 1}`, 2, [0.1 + i * 0.03, 0.2 + i * 0.03], B(x - 0.5, y - 0.5, 0.4, x + 0.5, y + 0.5, 3.2), 'steel', 'A', 'ois', { from: [0, 0, 6], bz: 4 }));
add('stage', 'OIS 이동 스테이지', 'OIS moving stage', 2, [0.18, 0.26], B(-6, -5, 1.2, 6, 5, 1.6), 'pcb', 'A', 'ois', { from: [0, 0, 7], bz: 8 });
add('daf', '다이어태치 필름', 'Die-attach film', 2, [0.28, 0.32], B(-5.4, -4.2, 1.6, 5.4, 4.2, 1.7), 'polymer', 'E', 'ois', { from: [0, 0, 3], bz: 11 });
add('sensor', 'CMOS 이미지 센서', 'CMOS image sensor die', 2, [0.3, 0.4], B(-5.4, -4.2, 1.7, 5.4, 4.2, 2.1), 'silicon', 'V', 'ois', { from: [0, 0, 9], bz: 14, note: '센서는 소니급(외부 조달)' });
const wire = (id, ko, en, a, b) => add(id, ko, en, 2, [a, b], B(-4.4, -5.2, 2.0, 4.4, 5.2, 2.6), 'gold', 'E', 'ois', { from: [0, 0, 0], bz: 17 });
wire('wire-n', '본딩 와이어 (북)', 'Bond wires (north)', 0.5, 0.64);
wire('wire-s', '본딩 와이어 (남)', 'Bond wires (south)', 0.64, 0.78);
wire('wire-w', '본딩 와이어 (서)', 'Bond wires (west)', 0.78, 0.84);
add('holder', 'IR 필터 홀더', 'IR-cut filter holder', 2, [0.86, 0.92], B(-7.5, -7, 3.2, 7.5, 7, 3.8), 'polymer', 'A', 'ois', { from: [0, 0, 9], bz: 17 });
add('ircf', 'IR 차단 필터(유리)', 'IR-cut filter (glass)', 2, [0.9, 0.95], B(-6.1, -5.1, 3.4, 6.1, 5.1, 3.6), 'glass', 'V', 'ois', { from: [0, 0, 9], bz: 19, note: '0.11 mm급 유리 필터(G4, 공개)' });
add('ircf-glue', '필터 접착제', 'Filter adhesive', 2, [0.94, 1.0], B(-6.2, -5.2, 3.4, 6.2, 5.2, 3.65), 'resin', 'A', 'ois', { from: [0, 0, 0], bz: 19 });

// ---------- stage 4: lens barrel, VCM and OIS magnets/springs (tour stage 3) ----------
[['e', 6.1, -3.5, 7.1, 3.5], ['w', -7.1, -3.5, -6.1, 3.5], ['n', -4.5, 5.1, 4.5, 6.1], ['s', -4.5, -6.1, 4.5, -5.1]].forEach(([n, x0, y0, x1, y1], i) => add(`mag-${n}`, `OIS 자석 ${'동서북남'[i]}`, `OIS magnet ${['E', 'W', 'N', 'S'][i]}`, 3, [0.0 + i * 0.035, 0.07 + i * 0.035], B(x0, y0, 1.35, x1, y1, 2.55), 'magnet', 'V', 'ois', { from: [0, 0, 9], bz: 10, note: '센서 주위 자석 4개(12 Pro Max X-ray, 2차 자료)' }));
// four flexure arms, one per post: two run along x (5.5 mm), two along y (3.4 mm), each 0.6 mm wide, at z 1.05-1.2
[[-6.9, -6.2, 'x'], [6.9, -6.2, 'y'], [-6.9, 6.2, 'y'], [6.9, 6.2, 'x']].forEach(([x, y, ax], i) => {
  const sx = x < 0 ? 1 : -1; // arms point toward the module centre
  const sy = y < 0 ? 1 : -1;
  const [x1, y1] = ax === 'x' ? [x + 5.5 * sx, y + 0.6 * sy] : [x + 0.6 * sx, y + 3.4 * sy];
  add(`spr-${i + 1}`, `서스펜션 스프링 ${i + 1}`, `Suspension spring ${i + 1}`, 3, [0.14 + i * 0.03, 0.21 + i * 0.03], B(Math.min(x, x1), Math.min(y, y1), 1.05, Math.max(x, x1), Math.max(y, y1), 1.2), 'steel', 'E', 'ois', { from: [0, 0, 8], bz: 6 });
});
add('vcm-base', 'VCM 베이스', 'VCM base', 3, [0.28, 0.34], B(-7.5, -7.5, 3.8, 7.5, 7.5, 4.3), 'polymer', 'A', 'lens', { from: [0, 0, 8], bz: 14 });
add('spr-lo', 'AF 하부 스프링', 'AF lower spring', 3, [0.33, 0.38], B(-6.3, -6.3, 4.3, 6.3, 6.3, 4.4), 'steel', 'E', 'lens', { from: [0, 0, 8], bz: 15 });
add('carrier', '렌즈 캐리어', 'Lens carrier', 3, [0.37, 0.43], B(-4.9, -4.9, 4.4, 4.9, 4.9, 8.2), 'polymer', 'A', 'lens', { from: [0, 0, 8], bz: 17 });
add('af-coil', 'AF 코일', 'AF coil', 3, [0.42, 0.47], B(-5.3, -5.3, 5.0, 5.3, 5.3, 7.2), 'copper', 'E', 'lens', { from: [0, 0, 8], bz: 19 });
[[-6, -6], [6, -6], [-6, 6], [6, 6]].forEach(([x, y], i) => add(`afmag-${i + 1}`, `AF 자석 ${i + 1}`, `AF magnet ${i + 1}`, 3, [0.46 + i * 0.02, 0.5 + i * 0.02], B(x - 1.1, y - 1.1, 4.8, x + 1.1, y + 1.1, 7.6), 'magnet', 'E', 'lens', { from: [0, 0, 8], bz: 21 }));
add('hall-af', 'AF 홀 센서', 'AF Hall sensor', 3, [0.5, 0.54], B(-1.2, -6.9, 4.4, 0.2, -6.1, 5.0), 'silicon', 'E', 'lens', { from: [0, 0, 8], bz: 22.5, note: 'AF 위치 피드백 센서(구성은 추정)' });
add('spr-up', 'AF 상부 스프링', 'AF upper spring', 3, [0.5, 0.55], B(-6.3, -6.3, 8.2, 6.3, 6.3, 8.3), 'steel', 'E', 'lens', { from: [0, 0, 8], bz: 24 });
add('yoke', 'VCM 요크(하우징)', 'VCM yoke (housing)', 3, [0.54, 0.6], B(-7.5, -7.5, 4.3, 7.5, 7.5, 8.9), 'steel', 'A', 'lens', { from: [0, 0, 9], bz: 30, ghost: true });
add('barrel', '렌즈 배럴', 'Lens barrel', 3, [0.6, 0.66], B(-4.3, -4.3, 4.2, 4.3, 4.3, 9.6), 'dark', 'A', 'lens', { from: [0, 0, 10], bz: 34, ghost: true, note: '배럴은 렌즈 업체가 완제품으로 납품할 가능성 [가정]' });
// seven plastic aspheric elements, front (L1) to rear (L7). z0..z1 are resting positions inside the barrel.
export const LENS = [
  { id: 'L1', z0: 8.7, z1: 9.3, r: 3.45, a1: 0.42, a2: -0.12 },
  { id: 'L2', z0: 8.0, z1: 8.5, r: 3.3, a1: 0.2, a2: 0.3 },
  { id: 'L3', z0: 7.3, z1: 7.8, r: 3.2, a1: -0.2, a2: 0.34 },
  { id: 'L4', z0: 6.6, z1: 7.1, r: 3.15, a1: 0.18, a2: -0.32 },
  { id: 'L5', z0: 5.9, z1: 6.4, r: 3.15, a1: -0.28, a2: 0.22, wv: 0.12 },
  { id: 'L6', z0: 5.2, z1: 5.7, r: 3.25, a1: 0.3, a2: -0.2, wv: -0.16 },
  { id: 'L7', z0: 4.5, z1: 5.0, r: 3.4, a1: -0.36, a2: -0.3, wv: 0.2 },
];
export const SPACERS = [
  { id: 'sp2', z0: 8.5, z1: 8.7 }, { id: 'sp3', z0: 7.8, z1: 8.0 }, { id: 'sp4', z0: 7.1, z1: 7.3 }, { id: 'sp5', z0: 6.4, z1: 6.6 }, { id: 'sp6', z0: 5.7, z1: 5.9 },
];
// the barrel is stacked rear element first: L7 goes in first, L1 last (the lens is built upside down in the barrel, then flipped)
const lensOrder = ['L7', 'L6', 'L5', 'L4', 'L3', 'L2', 'L1'];
LENS.forEach((l) => {
  const idx = lensOrder.indexOf(l.id);
  add(l.id, `렌즈 ${l.id} (플라스틱 비구면)`, `Lens ${l.id} (plastic asphere)`, 3, [0.62 + idx * 0.04, 0.68 + idx * 0.04], B(-l.r, -l.r, l.z0, l.r, l.r, l.z1), 'glass', idx === 0 ? 'V' : 'E', 'lens', { from: [0, 0, 10], bz: 38 + idx * 1.2, note: '7매 구성은 공식 사양, 형상은 추정' });
});
SPACERS.forEach((s) => {
  const idx = lensOrder.indexOf('L' + s.id.slice(2)) ;
  add(s.id, `스페이서 ${s.id.slice(2)}(차광링)`, `Spacer ${s.id.slice(2)} (light shield ring)`, 3, [0.64 + (idx - 0.5) * 0.04, 0.7 + (idx - 0.5) * 0.04], B(-3.9, -3.9, s.z0, 3.9, 3.9, s.z1), 'dark', 'E', 'lens', { from: [0, 0, 10], bz: 38 + (idx - 0.5) * 1.2 });
});
add('stop', '조리개 스톱', 'Aperture stop', 3, [0.84, 0.88], B(-3.6, -3.6, 9.3, 3.6, 3.6, 9.38), 'dark', 'E', 'lens', { from: [0, 0, 10], bz: 44 });
add('retainer', '리테이너 링', 'Retainer ring', 3, [0.88, 0.94], B(-3.9, -3.9, 9.38, 3.9, 3.9, 9.6), 'polymer', 'A', 'lens', { from: [0, 0, 10], bz: 46 });

// ---------- stage 5: active alignment adhesive (tour stage 4) ----------
add('adh', 'UV·열경화 접착제(8점 표시)', 'UV / heat-cure adhesive (8 of 30+ points)', 4, [0.54, 0.62], B(-7.2, -7.2, 3.78, 7.2, 7.2, 4.05), 'resin', 'V', 'top', { from: [0, 0, 0], bz: 3.5, note: '접착점 30+ (벤더 공개)' });

// ---------- stage 6: shield, label, film (tour stage 5) ----------
add('shield', '실드 캔', 'Shield can', 5, [0.0, 0.16], B(-7.7, -7.7, 0.4, 7.7, 7.7, 9.2), 'steel', 'V', 'top', { from: [0, 0, 14], bz: 50, note: '니켈 도금 실드 캔, 열경화 접착 [확인됨 2차]' });
add('label', '2D 코드 라벨', '2D-code label', 5, [0.18, 0.24], B(3.2, 3.2, 9.2, 6.8, 6.8, 9.25), 'polymer', 'A', 'top', { from: [0, 0, 6], bz: 54 });
add('film', '렌즈 보호 필름', 'Lens protective film', 5, [0.24, 0.3], B(-4.9, -4.9, 9.62, 4.9, 4.9, 9.7), 'polymer', 'A', 'top', { from: [0, 0, 6], bz: 56 });
add('film-tab', '필름 당김 탭', 'Film pull tab', 5, [0.3, 0.34], B(4.0, -0.9, 9.62, 8.6, 0.9, 9.7), 'resin', 'A', 'top', { from: [0, 0, 6], bz: 58 });

// ----------------------------------------------------------------------------------------------------
export const PARTS = parts.map((p, i) => ({ ...p, n: i, zc: (p.box.z + p.box.h / 2), bz: p.bz ?? 0, bdx: p.bdx ?? 0, from: p.from ?? [0, 0, 9] }));
export const PART_COUNT = PARTS.length;
export const PART_INDEX = Object.fromEntries(PARTS.map((p) => [p.id, p]));
export const GROUPS = ['base', 'ois', 'lens', 'top'];

// painter order of the parts: assembled (default) and exploded (stage 1 BOM view, parts lifted by bz).
const boxOf = (p, exploded) => ({ ...p.box, z: p.box.z + (exploded ? p.bz : 0), x: p.box.x + (exploded ? p.bdx : 0), id: p.id });
const LAST = ['shield', 'label', 'film', 'film-tab']; // the translucent shield encloses the rest; label and film sit on top of it
const lastly = (ids) => [...ids.filter((id) => !LAST.includes(id)), ...LAST.filter((id) => ids.includes(id))];
export const ORDER_ASM = lastly(order(PARTS.map((p) => ({ ...itemOf(boxOf(p, false)), key: keyOf(boxOf(p, false)), id: p.id }))).map((b) => b.id));
export const ORDER_BOM = lastly(order(PARTS.map((p) => ({ ...itemOf(boxOf(p, true)), key: keyOf(boxOf(p, true)), id: p.id }))).map((b) => b.id));
function itemOf(b) {
  return { x0: b.x, x1: b.x + b.w, y0: b.y, y1: b.y + b.d, z0: b.z, z1: b.z + b.h };
}
function keyOf(b) {
  // viewer sits at +x, +y, +z: depth grows toward the viewer (azimuth 40: cos/sin weights)
  const cx = b.x + b.w / 2;
  const cy = b.y + b.d / 2;
  const cz = b.z + b.h / 2;
  return (cx * 0.766 + cy * 0.643) * 0.866 + cz * 0.5;
}
