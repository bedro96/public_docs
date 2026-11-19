// 정확 연산(BigInt/유리수) 검증: 강의에 나오는 모든 수치를 독립적으로 다시 계산합니다.
// 실행: node --test   (이 폴더에서)
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const EC = require('./ecmath.js');

const Q = EC.Q;
const q = (n, d = 1) => Q.div(Q.from(n), Q.from(d));
const pt = (x, y) => ({ x: Q.from(x), y: Q.from(y) });
const str = (curve, P) => EC.formatPoint(curve, P);

/* ------------------------------------------------------------------
 * 1. 실수(유리수) 곡선  y^2 = x^3 - 4x + 4
 * ------------------------------------------------------------------ */
const real = EC.weierstrass(Q, '-4', '4');

test('y^2 = x^3 - 4x + 4: 판별식 4a^3 + 27b^2 = 176, 특이하지 않음', () => {
  assert.equal(Q.str(real.discriminant), '176');
  assert.throws(() => EC.weierstrass(Q, '-3', '2'), /특이/); // 4(-27) + 27(4) = 0
});

test('대칭: (1, 1)의 역원은 (1, -1)이고 둘 다 곡선 위에 있다', () => {
  const A = pt(1, 1);
  assert.ok(real.isOnCurve(A));
  assert.equal(str(real, real.neg(A)), '(1, -1)');
  assert.ok(real.isOnCurve(real.neg(A)));
});

test('현: P(-2, 2), Q(1, -1) → 세 번째 교점 R = (2, -2), P + Q = (2, 2)', () => {
  const P = pt(-2, 2);
  const Qp = pt(1, -1);
  assert.ok(real.isOnCurve(P) && real.isOnCurve(Qp));
  const line = real.lineThrough(P, Qp);
  assert.equal(Q.str(line.m), '-1');
  assert.equal(Q.str(line.c), '0'); // y = -x
  const R = pt(2, -2);
  assert.ok(real.isOnCurve(R));
  assert.equal(Q.str(R.y), Q.str(Q.add(Q.mul(line.m, R.x), line.c))); // R은 직선 위
  assert.equal(str(real, real.add(P, Qp)), '(2, 2)');
  assert.equal(str(real, real.neg(R)), '(2, 2)');
});

test('접선: P(0, 2)에서 접선 y = 2 - x, 2P = (1, -1)', () => {
  const P = pt(0, 2);
  const t = real.tangentLine(P);
  assert.equal(Q.str(t.m), '-1');
  assert.equal(Q.str(t.c), '2');
  assert.equal(str(real, real.add(P, P)), '(1, -1)');
  assert.equal(str(real, real.mul(2n, P)), '(1, -1)');
  assert.ok(real.isOnCurve(pt(1, 1))); // 접선이 다시 만나는 점
});

test('스칼라 곱: 3P = (8, 22), 4P = (-7/4, 19/8), 그리고 결합법칙', () => {
  const P = pt(0, 2);
  assert.equal(str(real, real.mul(3n, P)), '(8, 22)');
  assert.equal(str(real, real.mul(4n, P)), '(-7/4, 19/8)');
  assert.equal(str(real, real.add(real.mul(2n, P), real.mul(2n, P))), '(-7/4, 19/8)');
  const sum = real.add(real.add(P, P), P);
  assert.equal(str(real, sum), str(real, real.mul(3n, P)));
  // 3P가 그림 밖에 있다는 설명의 근거: |y| = 22 > 5
  assert.ok(Math.abs(Q.num(real.mul(3n, P).y)) > 5);
});

test('유리수 군: 항등원 O, 역원, 교환·결합 법칙 (여러 점 조합)', () => {
  const P = pt(0, 2);
  const A = real.mul(2n, P);
  const B = real.mul(3n, P);
  const C = real.mul(5n, P);
  assert.equal(str(real, real.add(A, B)), str(real, real.add(B, A)));
  assert.equal(str(real, real.add(real.add(A, B), C)), str(real, real.add(A, real.add(B, C))));
  assert.equal(real.add(A, real.neg(A)), null);
  assert.equal(str(real, real.add(A, null)), str(real, A));
  assert.equal(str(real, null), 'O');
});

test('수직선: P + (-P) = O, y = 0인 점은 두 배 하면 O', () => {
  const P = pt(-2, 2);
  assert.equal(real.add(P, real.neg(P)), null);
  assert.deepEqual(real.lineThrough(P, real.neg(P)).vertical, true);
});

test('배가 알고리즘 비용: 13 = 1101_2 → 두 배 3번, 더하기 2번', () => {
  const c = EC.ladderCost(13);
  assert.deepEqual(c, { bits: 4, binary: '1101', doublings: 3, additions: 2 });
});

/* ------------------------------------------------------------------
 * 2. 유한체 F17 위의 장난감 곡선  y^2 = x^3 + 2x + 2
 * ------------------------------------------------------------------ */
const F17 = EC.makeFp(17);
const toy = EC.weierstrass(F17, 2, 2);
const G = { x: 5n, y: 1n };

test('F17: 점 18개 + O = 19개, G = (5, 1)의 위수는 19', () => {
  assert.equal(toy.enumerate().length, 18);
  assert.equal(toy.groupOrder(), 19n);
  assert.ok(toy.isOnCurve(G));
  assert.equal(toy.mul(19n, G), null);
  for (let k = 1n; k < 19n; k++) assert.notEqual(toy.mul(k, G), null, `${k}G`);
  const orbit = EC.orbitOf(toy, G, 100);
  assert.equal(orbit.order, 19);
  const seen = new Set(orbit.multiples.filter((p) => p).map((p) => `${p.x},${p.y}`));
  assert.equal(seen.size, 18); // 곡선 위 점을 하나도 빠짐없이 한 번씩
  for (const P of toy.enumerate()) assert.ok(seen.has(`${P.x},${P.y}`));
});

test('F17: kG 표 1G..18G, 13G = (16, 4)', () => {
  const expected = [[5, 1], [6, 3], [10, 6], [3, 1], [9, 16], [16, 13], [0, 6], [13, 7], [7, 6], [7, 11], [13, 10], [0, 11], [16, 4], [9, 1], [3, 16], [10, 11], [6, 14], [5, 16]];
  expected.forEach(([x, y], i) => {
    const P = toy.mul(BigInt(i + 1), G);
    assert.deepEqual([Number(P.x), Number(P.y)], [x, y], `${i + 1}G`);
  });
  assert.equal(str(toy, toy.mul(13n, G)), '(16, 4)');
  // 이산로그: (16, 4)에서 k를 찾으려면 최대 19번 시도
  let k = 1n;
  let P = G;
  while (!(P.x === 16n && P.y === 4n)) { P = toy.add(P, G); k++; }
  assert.equal(k, 13n);
});

test('F17: -P = (x, 17 - y), 덧셈 법칙이 실수 곡선과 같은 공식', () => {
  const P = toy.mul(7n, G);
  const N = toy.neg(P);
  assert.equal(N.y, 17n - P.y);
  assert.equal(toy.add(P, N), null);
  assert.equal(str(toy, toy.add(toy.mul(5n, G), toy.mul(9n, G))), str(toy, toy.mul(14n, G)));
});

/* ------------------------------------------------------------------
 * 3. 뒤틀린 에드워즈 곡선
 * ------------------------------------------------------------------ */
const ed = EC.edwards(F17, 16n, 6n); // -x^2 + y^2 = 1 + 6 x^2 y^2 (a = -1 = 16 mod 17)

test('F17 에드워즈 곡선 a=-1, d=6: 점 20개, 완전한 덧셈 공식', () => {
  assert.equal(ed.enumerate().length, 20);
  assert.equal(ed.groupOrder(), 20n);
  assert.equal(ed.isComplete(), true);
  const pts = ed.enumerate();
  // 같은 공식 하나로 모든 쌍이 곡선 위의 점을 낸다(예외 없음)
  for (const P of pts) for (const R of pts) assert.ok(ed.isOnCurve(ed.add(P, R)));
});

test('F17 에드워즈: P = (2, 6)의 위수 20, -P = (15, 6), 항등원 (0, 1)', () => {
  const P = { x: 2n, y: 6n };
  assert.ok(ed.isOnCurve(P));
  assert.equal(str(ed, ed.neg(P)), '(15, 6)');
  assert.equal(str(ed, ed.add(P, ed.neg(P))), '(0, 1)');
  assert.equal(str(ed, ed.add(P, { x: 0n, y: 1n })), '(2, 6)');
  assert.equal(str(ed, ed.mul(2n, P)), '(5, 10)');
  assert.equal(str(ed, ed.mul(3n, P)), '(6, 14)');
  assert.equal(str(ed, ed.add(P, ed.mul(3n, P))), '(7, 9)');
  assert.equal(str(ed, ed.mul(20n, P)), '(0, 1)');
  for (let k = 1n; k < 20n; k++) assert.notEqual(str(ed, ed.mul(k, P)), '(0, 1)', `${k}P`);
});

/* ------------------------------------------------------------------
 * 4. Ed25519 (RFC 8032) — node:crypto 와 대조
 * ------------------------------------------------------------------ */
const E = EC.ed25519();
const sha512 = (...parts) => crypto.createHash('sha512').update(Buffer.concat(parts.map((p) => Buffer.from(p)))).digest();
const leToBig = (buf) => BigInt('0x' + Buffer.from(buf).reverse().toString('hex') || '0');
const bigToLe = (n, len) => {
  const out = Buffer.alloc(len);
  let v = n;
  for (let i = 0; i < len; i++) { out[i] = Number(v & 0xffn); v >>= 8n; }
  return out;
};
const encodePoint = (P) => {
  const b = bigToLe(P.y, 32);
  if (P.x & 1n) b[31] |= 0x80;
  return b;
};

function signEd25519(seed, msg) {
  const h = sha512(seed);
  let a = leToBig(h.subarray(0, 32));
  a &= (1n << 254n) - 8n;
  a |= 1n << 254n;
  const A = E.curve.mul(a, E.B);
  const Aenc = encodePoint(A);
  const r = leToBig(sha512(h.subarray(32), msg)) % E.L;
  const R = E.curve.mul(r, E.B);
  const Renc = encodePoint(R);
  const k = leToBig(sha512(Renc, Aenc, msg)) % E.L;
  const S = (r + k * a) % E.L;
  return { A, Aenc, R, Renc, k, S, sig: Buffer.concat([Renc, bigToLe(S, 32)]) };
}

const pkcs8 = (seed) => crypto.createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]), format: 'der', type: 'pkcs8' });

test('Ed25519 상수: p = 2^255 - 19, d = -121665/121666, B, L (RFC 8032)', () => {
  assert.equal(E.p, (1n << 255n) - 19n);
  assert.ok(EC.isProbablePrime(E.p));
  assert.ok(EC.isProbablePrime(E.L));
  assert.equal(E.F.mul(E.d, E.F.from(121666n)), E.F.from(-121665n));
  assert.equal(E.B.y, E.F.div(E.F.from(4n), E.F.from(5n)));
  assert.equal(E.B.x, 15112221349535400772501151409588531511454012693041857206046113283949847762202n);
  assert.equal(E.B.y, 46316835694926478169428394003475163141307993866256225615783033603165251855960n);
  assert.ok(E.curve.isOnCurve(E.B));
  assert.equal(E.L, 7237005577332262213973186563042994240857116359379907606001950938285454250989n);
  const id = E.curve.mul(E.L, E.B);
  assert.deepEqual([id.x, id.y], [0n, 1n]); // L·B = 항등원
  assert.equal(E.curve.isComplete(), true); // a = -1은 제곱수, d는 제곱수가 아님
  assert.equal(E.F.isSquare(E.d), false);
  assert.equal(E.F.isSquare(E.F.from(-1n)), true);
});

test('Ed25519: 공개키·서명이 node:crypto 결과와 바이트 단위로 같고, S·B = R + k·A', () => {
  const seeds = [
    Buffer.from('9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60', 'hex'), // RFC 8032 시험 1
    crypto.createHash('sha256').update('elliptic-curve-lesson').digest(),
  ];
  for (const seed of seeds) {
    for (const msg of [Buffer.alloc(0), Buffer.from('안녕하세요, 인증서!')]) {
      const mine = signEd25519(seed, msg);
      const key = pkcs8(seed);
      const spki = crypto.createPublicKey(key).export({ format: 'der', type: 'spki' });
      assert.equal(Buffer.from(spki.subarray(spki.length - 32)).toString('hex'), mine.Aenc.toString('hex'), '공개키');
      const theirs = crypto.sign(null, msg, key);
      assert.equal(theirs.toString('hex'), mine.sig.toString('hex'), '서명');
      assert.equal(crypto.verify(null, msg, crypto.createPublicKey(key), mine.sig), true);
      // 검증식 S·B = R + k·A
      const left = E.curve.mul(mine.S, E.B);
      const right = E.curve.add(mine.R, E.curve.mul(mine.k, mine.A));
      assert.deepEqual([left.x, left.y], [right.x, right.y]);
      // 메시지를 바꾸면 검증이 실패
      assert.equal(crypto.verify(null, Buffer.from('x'), crypto.createPublicKey(key), mine.sig), false);
    }
  }
});

test('RFC 8032 시험 벡터 1 (빈 메시지)', () => {
  const seed = Buffer.from('9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60', 'hex');
  const r = signEd25519(seed, Buffer.alloc(0));
  assert.equal(r.Aenc.toString('hex'), 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a');
  assert.equal(r.sig.toString('hex'), 'e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b');
});

test('ECDLP 규모: log2(13) ≈ 3.70, 504회 ≈ 2^8.98, L ≈ 2^252, 루트는 2^126', () => {
  assert.ok(Math.abs(EC.log2Count('13') - 3.7004) < 1e-3);
  assert.ok(Math.abs(EC.log2Count('504') - 8.9773) < 1e-3);
  assert.ok(Math.abs(EC.log2Count(E.L.toString()) - 252) < 1e-9 + 0.0001);
  // 253비트 스칼라의 double-and-add: 두 배 252번 + 더하기 최대 252번 ≈ 504
  const c = EC.ladderCost((1n << 253n) - 1n);
  assert.equal(c.doublings + c.additions, 252 + 252);
});

/* ------------------------------------------------------------------
 * 5. 보조 연산, 장면 해석, 서식 토큰
 * ------------------------------------------------------------------ */
test('정수 보조 함수: modInv, modPow, sqrtMod, gcd', () => {
  assert.equal(EC.modInv(3n, 17n), 6n);
  assert.equal(EC.modPow(2n, 16n, 17n), 1n);
  assert.equal(EC.gcd(12n, 18n), 6n);
  const r = EC.sqrtMod(13n, 17n);
  assert.equal((r * r) % 17n, 13n);
  assert.equal(EC.sqrtMod(3n, 17n), null);
  assert.throws(() => EC.modInv(0n, 17n));
});

test('resolveMath: 맞는 expect는 통과, 틀린 expect·곡선 밖 점·미정의 점은 거부', () => {
  const base = { curve: { model: 'weierstrass', field: 'Q', a: '-4', b: '4' } };
  const ok = EC.resolveMath({ ...base, points: { P: { x: '0', y: '2' }, P2: { op: 'mul', k: '2', args: ['P'], expect: ['1', '-1'] } } });
  assert.equal(str(ok.curve, ok.points.P2), '(1, -1)');
  assert.throws(() => EC.resolveMath({ ...base, points: { P: { x: '0', y: '2' }, P2: { op: 'mul', k: '2', args: ['P'], expect: ['1', '1'] } } }), /기대값/);
  assert.throws(() => EC.resolveMath({ ...base, points: { P: { x: '0', y: '3' } } }), /곡선 위/);
  assert.throws(() => EC.resolveMath({ ...base, points: { P2: { op: 'neg', args: ['Z'] } } }), /정의되지 않은 점/);
  assert.throws(() => EC.resolveMath({ curve: { model: 'foo', field: 'Q' } }), /곡선 모델/);
});

test('runCheck: 위수·판별식·공선 검사는 틀린 값을 거부', () => {
  const spec = { curve: { model: 'weierstrass', field: 'F17', a: '2', b: '2' }, points: { G: { x: '5', y: '1' } } };
  EC.resolveMath({ ...spec, checks: [{ order: { of: 'G', equals: '19' } }, { groupOrder: '19' }] });
  assert.throws(() => EC.resolveMath({ ...spec, checks: [{ order: { of: 'G', equals: '18' } }] }));
  assert.throws(() => EC.resolveMath({ curve: { model: 'weierstrass', field: 'Q', a: '-4', b: '4' }, checks: [{ discriminant: '175' }] }));
});

test('substitute: [[점]]을 정확한 좌표 문자열로 바꾸고 모르는 점은 거부', () => {
  const r = EC.resolveMath({ curve: { model: 'weierstrass', field: 'Q', a: '-4', b: '4' }, points: { P: { x: '0', y: '2' }, P4: { op: 'mul', k: '4', args: ['P'] }, O: { op: 'inf' } } });
  assert.equal(EC.substitute('4P = [[P4]], O = [[O]]', r), '4P = (-7/4, 19/8), O = O');
  assert.throws(() => EC.substitute('[[Zed]]', r));
});

test('parseRich: 위·아래 첨자와 강조를 해석하고, 잘못된 토큰은 거부', () => {
  const runs = EC.parseRich('y^{2} = x^{3} + F_{17} **굵게**');
  assert.deepEqual(runs.filter((r) => r.sup).map((r) => r.text), ['2', '3']);
  assert.deepEqual(runs.filter((r) => r.sub).map((r) => r.text), ['17']);
  assert.ok(runs.some((r) => r.strong && r.text === '굵게'));
  assert.equal(EC.richToPlain(EC.parseRich('y^{2} = x^{3}')), 'y^2 = x^3');
  for (const bad of ['y^2', 'x_1', 'a^{2', 'a}', '**열림', 'a \\ b', 'a ^{', '[[P]]', 'a\u0007b']) {
    assert.throws(() => EC.parseRich(bad), undefined, JSON.stringify(bad));
  }
  assert.equal(EC.parseRich('가나다 ≠ 0 ± ÷ ×').map((r) => r.text).join(''), '가나다 ≠ 0 ± ÷ ×');
});

test('시간표: 글자 수에 비례하고 항상 양수·단조', () => {
  assert.ok(EC.textDuration('가') >= 0.7);
  assert.ok(EC.textDuration('가'.repeat(200)) <= 2.4);
  assert.ok(EC.elementDuration({ type: 'curve', at: 0 }) > 0);
  assert.equal(EC.elementDuration({ type: 'curve', at: 0, dur: 5 }), 5);
  const step = {
    summary: '요약', beats: [{ at: 0.3, text: '가나다' }, { at: 4, text: '라마바' }],
    board: { elements: [{ type: 'axes', at: 0 }, { type: 'bar', at: 1 }] },
    panel: [{ text: 'a^{2}', color: 'white', size: 'l' }, { text: 'b', color: 'white', size: 'l' }],
  };
  const tl = EC.stepTimeline(step);
  assert.ok(tl.panel[1].at > tl.panel[0].at);
  assert.ok(tl.animEnd >= 4.4);
  assert.ok(tl.holdEnd >= tl.animEnd + 3);
});
