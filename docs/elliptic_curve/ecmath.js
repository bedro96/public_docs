/* ecmath.js - 타원곡선 정확 연산(BigInt)과 서식 토큰 파서.
 *
 * 브라우저(window.ECMath)와 Node(require)가 같은 파일을 씁니다.
 * - 빌드(build.mjs)와 테스트는 장면 원본의 모든 좌표를 이 파일로 다시 계산해 검증합니다.
 * - 재생기(player.js)는 같은 계산으로 점·직선을 그립니다. 부동소수점은 화면에 찍을 때만 씁니다.
 *
 * 구성: 1) 정수/유한체/유리수  2) 바이어슈트라스 곡선  3) 에드워즈 곡선  4) Ed25519 상수
 *       5) 장면 수학 해석(resolveMath)  6) 서식 토큰(^{ } _{ } ** [[점]])
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  else root.ECMath = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ====================================================================
   * 1. 정수 · 유한체 · 유리수
   * ==================================================================== */
  const mod = (a, p) => {
    const r = a % p;
    return r < 0n ? r + p : r;
  };
  const abs = (a) => (a < 0n ? -a : a);

  function gcd(a, b) {
    a = abs(a);
    b = abs(b);
    while (b !== 0n) [a, b] = [b, a % b];
    return a;
  }

  function modPow(base, exp, p) {
    let result = 1n;
    let b = mod(base, p);
    let e = exp;
    while (e > 0n) {
      if (e & 1n) result = (result * b) % p;
      b = (b * b) % p;
      e >>= 1n;
    }
    return result;
  }

  /** a의 mod p 역원 (확장 유클리드). 역원이 없으면 예외. */
  function modInv(a, p) {
    let r0 = mod(a, p);
    let r1 = p;
    let s0 = 1n;
    let s1 = 0n;
    while (r1 !== 0n) {
      const q = r0 / r1;
      [r0, r1] = [r1, r0 - q * r1];
      [s0, s1] = [s1, s0 - q * s1];
    }
    if (r0 !== 1n) throw new Error('mod ' + p + ' 에서 역원이 없습니다');
    return mod(s0, p);
  }

  /** Tonelli-Shanks. 제곱근이 없으면 null. */
  function sqrtMod(a, p) {
    a = mod(a, p);
    if (a === 0n) return 0n;
    if (modPow(a, (p - 1n) / 2n, p) !== 1n) return null;
    if (p % 4n === 3n) return modPow(a, (p + 1n) / 4n, p);
    let q = p - 1n;
    let s = 0n;
    while ((q & 1n) === 0n) {
      q >>= 1n;
      s += 1n;
    }
    let z = 2n;
    while (modPow(z, (p - 1n) / 2n, p) !== p - 1n) z += 1n;
    let c = modPow(z, q, p);
    let x = modPow(a, (q + 1n) / 2n, p);
    let t = modPow(a, q, p);
    let m = s;
    while (t !== 1n) {
      let i = 0n;
      let tt = t;
      while (tt !== 1n) {
        tt = (tt * tt) % p;
        i += 1n;
      }
      const b = modPow(c, 1n << (m - i - 1n), p);
      x = (x * b) % p;
      c = (b * b) % p;
      t = (t * c) % p;
      m = i;
    }
    return x;
  }

  /** Miller-Rabin (고정 밑). 작은 수는 정확, 큰 수는 확률적이지만 실무 수준으로 충분. */
  function isProbablePrime(n) {
    n = BigInt(n);
    if (n < 2n) return false;
    const small = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n, 43n, 47n];
    for (const sp of small) {
      if (n === sp) return true;
      if (n % sp === 0n) return false;
    }
    let d = n - 1n;
    let r = 0n;
    while ((d & 1n) === 0n) {
      d >>= 1n;
      r += 1n;
    }
    for (const a of small) {
      let x = modPow(a, d, n);
      if (x === 1n || x === n - 1n) continue;
      let composite = true;
      for (let i = 1n; i < r; i++) {
        x = (x * x) % n;
        if (x === n - 1n) {
          composite = false;
          break;
        }
      }
      if (composite) return false;
    }
    return true;
  }

  /** log2(양의 정수 문자열). 매우 큰 수도 근사값으로 계산. */
  function log2Count(value) {
    const n = BigInt(value);
    if (n <= 0n) throw new Error('log2는 양수에만 정의됩니다');
    const bits = n.toString(2).length;
    if (bits <= 53) return Math.log2(Number(n));
    const shift = BigInt(bits - 53);
    return Math.log2(Number(n >> shift)) + bits - 53;
  }

  /** 왼쪽에서 오른쪽으로 읽는 double-and-add에서 필요한 연산 횟수. */
  function ladderCost(k) {
    const n = BigInt(k);
    if (n < 1n) throw new Error('k는 1 이상이어야 합니다');
    const bin = n.toString(2);
    const ones = bin.split('').filter((c) => c === '1').length;
    return { bits: bin.length, binary: bin, doublings: bin.length - 1, additions: ones - 1 };
  }

  /* ---- 유리수 체 Q ---- */
  function qNorm(n, d) {
    if (d === 0n) throw new Error('분모가 0입니다');
    if (d < 0n) {
      n = -n;
      d = -d;
    }
    const g = gcd(n, d);
    return { n: n / g, d: d / g };
  }

  const Q = {
    kind: 'Q',
    name: 'Q',
    zero: { n: 0n, d: 1n },
    one: { n: 1n, d: 1n },
    from(v) {
      if (typeof v === 'bigint') return qNorm(v, 1n);
      if (typeof v === 'number') {
        if (!Number.isInteger(v)) throw new Error('정수만 숫자로 쓸 수 있습니다: ' + v);
        return qNorm(BigInt(v), 1n);
      }
      if (typeof v === 'string') {
        const m = /^\s*(-?\d+)(?:\/(\d+))?\s*$/.exec(v);
        if (!m) throw new Error('유리수 형식이 아닙니다: ' + JSON.stringify(v));
        return qNorm(BigInt(m[1]), m[2] === undefined ? 1n : BigInt(m[2]));
      }
      if (v && typeof v === 'object' && typeof v.n === 'bigint') return qNorm(v.n, v.d);
      throw new Error('유리수로 바꿀 수 없습니다');
    },
    add: (a, b) => qNorm(a.n * b.d + b.n * a.d, a.d * b.d),
    sub: (a, b) => qNorm(a.n * b.d - b.n * a.d, a.d * b.d),
    mul: (a, b) => qNorm(a.n * b.n, a.d * b.d),
    div(a, b) {
      if (b.n === 0n) throw new Error('0으로 나눌 수 없습니다');
      return qNorm(a.n * b.d, a.d * b.n);
    },
    neg: (a) => ({ n: -a.n, d: a.d }),
    inv(a) {
      if (a.n === 0n) throw new Error('0의 역수는 없습니다');
      return qNorm(a.d, a.n);
    },
    eq: (a, b) => a.n === b.n && a.d === b.d,
    isZero: (a) => a.n === 0n,
    str: (a) => (a.d === 1n ? a.n.toString() : a.n.toString() + '/' + a.d.toString()),
    num: (a) => Number(a.n) / Number(a.d),
    isSquare: () => { throw new Error('Q에서는 제곱 판정을 지원하지 않습니다'); },
  };

  /* ---- 소수체 F_p ---- */
  function makeFp(pIn) {
    const p = BigInt(pIn);
    if (p < 5n || p % 2n === 0n) throw new Error('p는 5 이상의 홀수 소수여야 합니다');
    const F = {
      kind: 'F',
      name: 'F_' + p.toString(),
      p,
      zero: 0n,
      one: 1n,
      from(v) {
        if (typeof v === 'bigint') return mod(v, p);
        if (typeof v === 'number') {
          if (!Number.isInteger(v)) throw new Error('정수만 숫자로 쓸 수 있습니다: ' + v);
          return mod(BigInt(v), p);
        }
        if (typeof v === 'string') {
          const m = /^\s*(-?\d+)(?:\/(-?\d+))?\s*$/.exec(v);
          if (!m) throw new Error('정수 또는 분수 형식이 아닙니다: ' + JSON.stringify(v));
          const top = mod(BigInt(m[1]), p);
          return m[2] === undefined ? top : mod(top * modInv(BigInt(m[2]), p), p);
        }
        throw new Error('F_p 원소로 바꿀 수 없습니다');
      },
      add: (a, b) => mod(a + b, p),
      sub: (a, b) => mod(a - b, p),
      mul: (a, b) => mod(a * b, p),
      div: (a, b) => mod(a * modInv(b, p), p),
      neg: (a) => mod(-a, p),
      inv: (a) => modInv(a, p),
      eq: (a, b) => a === b,
      isZero: (a) => a === 0n,
      str: (a) => a.toString(),
      num: (a) => Number(a),
      pow: (a, k) => modPow(a, BigInt(k), p),
      sqrt: (a) => sqrtMod(a, p),
      isSquare: (a) => a === 0n || modPow(a, (p - 1n) / 2n, p) === 1n,
    };
    return F;
  }

  /* ====================================================================
   * 2. 바이어슈트라스 곡선  y^2 = x^3 + a x + b   (점은 {x, y}, 무한원점 O는 null)
   * ==================================================================== */
  function weierstrass(F, aIn, bIn) {
    const a = F.from(aIn);
    const b = F.from(bIn);
    const c2 = F.from(2n);
    const c3 = F.from(3n);
    const c4 = F.from(4n);
    const c27 = F.from(27n);
    const disc = F.add(F.mul(c4, F.mul(a, F.mul(a, a))), F.mul(c27, F.mul(b, b)));
    if (F.isZero(disc)) throw new Error('특이 곡선입니다: 4a^3 + 27b^2 = 0');

    const rhs = (x) => F.add(F.mul(x, F.add(F.mul(x, x), a)), b);
    const isOnCurve = (P) => P === null || F.eq(F.mul(P.y, P.y), rhs(P.x));
    const neg = (P) => (P === null ? null : { x: P.x, y: F.neg(P.y) });

    function slope(P, R) {
      if (F.eq(P.x, R.x)) return F.div(F.add(F.mul(c3, F.mul(P.x, P.x)), a), F.mul(c2, P.y));
      return F.div(F.sub(R.y, P.y), F.sub(R.x, P.x));
    }
    function add(P, R) {
      if (P === null) return R;
      if (R === null) return P;
      if (F.eq(P.x, R.x) && (!F.eq(P.y, R.y) || F.isZero(P.y))) return null; // R = -P
      const m = slope(P, R);
      const x3 = F.sub(F.sub(F.mul(m, m), P.x), R.x);
      const y3 = F.sub(F.mul(m, F.sub(P.x, x3)), P.y);
      return { x: x3, y: y3 };
    }
    function mul(kIn, P) {
      let k = BigInt(kIn);
      if (k < 0n) return mul(-k, neg(P));
      let result = null;
      let addend = P;
      while (k > 0n) {
        if (k & 1n) result = add(result, addend);
        addend = add(addend, addend);
        k >>= 1n;
      }
      return result;
    }
    /** 점 P, R를 지나는 직선. 수직이면 {vertical: true, x}, 아니면 {m, c} (y = m x + c). */
    function lineThrough(P, R) {
      if (F.eq(P.x, R.x) && !F.eq(P.y, R.y)) return { vertical: true, x: P.x };
      const m = slope(P, R);
      return { m, c: F.sub(P.y, F.mul(m, P.x)) };
    }
    function tangentLine(P) {
      if (F.isZero(P.y)) return { vertical: true, x: P.x };
      return lineThrough(P, P);
    }
    function enumerate() {
      if (F.kind !== 'F') throw new Error('유한체에서만 점을 모두 나열할 수 있습니다');
      if (F.p > 5000n) throw new Error('p가 너무 커서 나열하지 않습니다');
      const points = [];
      for (let xi = 0n; xi < F.p; xi++) {
        const root = F.sqrt(rhs(xi));
        if (root === null) continue;
        points.push({ x: xi, y: root });
        if (root !== 0n) points.push({ x: xi, y: F.neg(root) });
      }
      points.sort((u, v) => (u.x === v.x ? (u.y < v.y ? -1 : 1) : u.x < v.x ? -1 : 1));
      return points;
    }
    const eqPoint = (P, R) => (P === null || R === null ? P === R : F.eq(P.x, R.x) && F.eq(P.y, R.y));
    return {
      model: 'weierstrass', F, a, b, discriminant: disc,
      identity: null, isIdentity: (P) => P === null, eqPoint,
      rhs, isOnCurve, neg, add, mul, lineThrough, tangentLine, slope, enumerate,
      groupOrder: () => BigInt(enumerate().length + 1),
    };
  }

  /* ====================================================================
   * 3. (뒤틀린) 에드워즈 곡선  a x^2 + y^2 = 1 + d x^2 y^2   (항등원 (0, 1))
   * ==================================================================== */
  function edwards(F, aIn, dIn) {
    const a = F.from(aIn);
    const d = F.from(dIn);
    if (F.isZero(a) || F.isZero(d) || F.eq(a, d)) throw new Error('a, d는 0이 아니고 서로 달라야 합니다');
    const identity = { x: F.zero, y: F.one };
    const isOnCurve = (P) => {
      const x2 = F.mul(P.x, P.x);
      const y2 = F.mul(P.y, P.y);
      return F.eq(F.add(F.mul(a, x2), y2), F.add(F.one, F.mul(d, F.mul(x2, y2))));
    };
    const neg = (P) => ({ x: F.neg(P.x), y: P.y });
    const isIdentity = (P) => F.isZero(P.x) && F.eq(P.y, F.one);
    /** 완전(complete) 덧셈 공식: a가 제곱수이고 d가 비제곱수이면 분모가 0이 되지 않아 예외 처리가 필요 없습니다. */
    function add(P, R) {
      const t = F.mul(d, F.mul(F.mul(P.x, R.x), F.mul(P.y, R.y)));
      const den1 = F.add(F.one, t);
      const den2 = F.sub(F.one, t);
      if (F.isZero(den1) || F.isZero(den2)) throw new Error('불완전한 덧셈: 분모가 0입니다');
      const x3 = F.div(F.add(F.mul(P.x, R.y), F.mul(P.y, R.x)), den1);
      const y3 = F.div(F.sub(F.mul(P.y, R.y), F.mul(a, F.mul(P.x, R.x))), den2);
      return { x: x3, y: y3 };
    }
    function mul(kIn, P) {
      let k = BigInt(kIn);
      if (k < 0n) return mul(-k, neg(P));
      let result = identity;
      let addend = P;
      while (k > 0n) {
        if (k & 1n) result = add(result, addend);
        addend = add(addend, addend);
        k >>= 1n;
      }
      return result;
    }
    function isComplete() {
      return F.kind === 'F' && F.isSquare(a) && !F.isSquare(d);
    }
    function enumerate() {
      if (F.kind !== 'F') throw new Error('유한체에서만 점을 모두 나열할 수 있습니다');
      if (F.p > 400n) throw new Error('p가 너무 커서 나열하지 않습니다');
      const points = [];
      for (let x = 0n; x < F.p; x++) {
        for (let y = 0n; y < F.p; y++) {
          const P = { x, y };
          if (isOnCurve(P)) points.push(P);
        }
      }
      return points;
    }
    const eqPoint = (P, R) => F.eq(P.x, R.x) && F.eq(P.y, R.y);
    return {
      model: 'edwards', F, a, d, identity, isIdentity, eqPoint,
      isOnCurve, neg, add, mul, isComplete, enumerate,
      groupOrder: () => BigInt(enumerate().length),
    };
  }

  /* ====================================================================
   * 4. Ed25519 상수 (RFC 8032)
   * ==================================================================== */
  function ed25519() {
    const p = (1n << 255n) - 19n;
    const F = makeFp(p);
    const d = F.div(F.from(-121665n), F.from(121666n));
    const curve = edwards(F, F.from(-1n), d);
    const L = (1n << 252n) + 27742317777372353535851937790883648493n;
    const y = F.div(F.from(4n), F.from(5n));
    const y2 = F.mul(y, y);
    const x2 = F.div(F.sub(y2, F.one), F.add(F.mul(d, y2), F.one));
    let x = F.sqrt(x2);
    if (x === null) throw new Error('Ed25519 기준점의 x를 복원하지 못했습니다');
    if (x % 2n === 1n) x = F.neg(x); // RFC 8032: 기준점의 x는 짝수 쪽 근
    return { p, F, d, curve, L, cofactor: 8n, B: { x, y } };
  }

  /* ====================================================================
   * 5. 장면 수학 해석
   * ==================================================================== */
  function fieldFromSpec(name) {
    if (name === 'Q') return Q;
    if (name === 'F25519') return makeFp((1n << 255n) - 19n);
    const m = /^F(\d+)$/.exec(String(name));
    if (!m) throw new Error('알 수 없는 체: ' + JSON.stringify(name));
    const p = BigInt(m[1]);
    if (!isProbablePrime(p)) throw new Error('p가 소수가 아닙니다: ' + p);
    return makeFp(p);
  }

  function formatPoint(curve, P) {
    if (curve.model === 'weierstrass' && P === null) return 'O';
    return '(' + curve.F.str(P.x) + ', ' + curve.F.str(P.y) + ')';
  }

  /**
   * 장면의 math 블록을 정확 연산으로 풀고, 선언된 기대값(expect)과 검사(checks)를 모두 검증합니다.
   * 하나라도 어긋나면 한국어 메시지의 Error를 던집니다.
   */
  function resolveMath(spec) {
    if (!spec || typeof spec !== 'object') throw new Error('math 블록이 없습니다');
    const c = spec.curve;
    if (!c || typeof c !== 'object') throw new Error('math.curve가 없습니다');
    const F = fieldFromSpec(c.field);
    let curve;
    if (c.model === 'weierstrass') curve = weierstrass(F, c.a, c.b);
    else if (c.model === 'edwards') curve = edwards(F, c.a, c.d);
    else throw new Error('알 수 없는 곡선 모델: ' + JSON.stringify(c.model));

    const points = Object.create(null);
    const get = (name) => {
      if (!(name in points)) throw new Error('정의되지 않은 점: ' + name);
      return points[name];
    };
    const defs = spec.points || {};
    for (const name of Object.keys(defs)) {
      if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) throw new Error('점 이름 형식 오류: ' + name);
      const def = defs[name];
      let P;
      if (def.op === undefined) {
        P = { x: F.from(def.x), y: F.from(def.y) };
        if (!curve.isOnCurve(P)) throw new Error('점 ' + name + '이(가) 곡선 위에 있지 않습니다');
      } else if (def.op === 'inf') {
        P = curve.identity;
      } else if (def.op === 'add') {
        if (!Array.isArray(def.args) || def.args.length !== 2) throw new Error(name + ': add에는 args 2개가 필요합니다');
        P = curve.add(get(def.args[0]), get(def.args[1]));
      } else if (def.op === 'neg') {
        if (!Array.isArray(def.args) || def.args.length !== 1) throw new Error(name + ': neg에는 args 1개가 필요합니다');
        P = curve.neg(get(def.args[0]));
      } else if (def.op === 'mul') {
        if (!Array.isArray(def.args) || def.args.length !== 1 || def.k === undefined) throw new Error(name + ': mul에는 k와 args 1개가 필요합니다');
        P = curve.mul(BigInt(def.k), get(def.args[0]));
      } else {
        throw new Error(name + ': 알 수 없는 op ' + JSON.stringify(def.op));
      }
      if (!curve.isOnCurve(P)) throw new Error('계산한 점 ' + name + '이(가) 곡선 위에 있지 않습니다');
      if (def.expect !== undefined) {
        const label = formatPoint(curve, P);
        if (def.expect === 'O') {
          if (!curve.isIdentity(P)) throw new Error('점 ' + name + ': 무한원점/항등원이어야 하는데 ' + label);
        } else {
          if (!Array.isArray(def.expect) || def.expect.length !== 2) throw new Error(name + ': expect 형식 오류');
          const want = { x: F.from(def.expect[0]), y: F.from(def.expect[1]) };
          if (curve.isIdentity(P) || !curve.eqPoint(P, want)) {
            throw new Error('점 ' + name + ' 계산값 ' + label + ' 이(가) 기대값 (' + def.expect[0] + ', ' + def.expect[1] + ')과 다릅니다');
          }
        }
      }
      points[name] = P;
    }

    for (const chk of spec.checks || []) runCheck(curve, F, chk, get);
    return { curve, F, points };
  }

  function orbitOf(curve, G, cap) {
    const seen = [];
    let P = G;
    for (let k = 1; k <= cap; k++) {
      seen.push(P);
      if (curve.isIdentity(P)) return { order: k, multiples: seen };
      P = curve.add(P, G);
    }
    throw new Error('위수를 ' + cap + ' 이내에서 찾지 못했습니다');
  }

  function runCheck(curve, F, chk, get) {
    if (chk.collinear) {
      const [A, B, C] = chk.collinear.map(get);
      if (!A || !B || !C) throw new Error('collinear: 무한원점은 지원하지 않습니다');
      const cross = F.sub(F.mul(F.sub(B.y, A.y), F.sub(C.x, A.x)), F.mul(F.sub(C.y, A.y), F.sub(B.x, A.x)));
      if (!F.isZero(cross)) throw new Error('세 점이 한 직선 위에 있지 않습니다: ' + chk.collinear.join(', '));
    } else if (chk.tangent) {
      if (curve.model !== 'weierstrass') throw new Error('tangent는 바이어슈트라스 곡선에서만 씁니다');
      const [P, R] = chk.tangent.map(get);
      const m = curve.slope(P, P);
      if (!F.eq(F.sub(R.y, P.y), F.mul(m, F.sub(R.x, P.x)))) throw new Error('접선 위의 점이 아닙니다: ' + chk.tangent.join(', '));
    } else if (chk.order) {
      const G = get(chk.order.of);
      const { order } = orbitOf(curve, G, 100000);
      if (BigInt(order) !== BigInt(chk.order.equals)) throw new Error(chk.order.of + '의 위수는 ' + order + ' 입니다 (기대 ' + chk.order.equals + ')');
    } else if (chk.groupOrder !== undefined) {
      if (curve.groupOrder() !== BigInt(chk.groupOrder)) throw new Error('군의 크기는 ' + curve.groupOrder() + ' 입니다 (기대 ' + chk.groupOrder + ')');
    } else if (chk.generates) {
      const G = get(chk.generates);
      const { order } = orbitOf(curve, G, 100000);
      if (BigInt(order) !== curve.groupOrder()) throw new Error(chk.generates + '는 군 전체를 생성하지 않습니다');
    } else if (chk.complete !== undefined) {
      if (curve.model !== 'edwards') throw new Error('complete는 에드워즈 곡선에서만 씁니다');
      if (curve.isComplete() !== !!chk.complete) throw new Error('완전(complete) 덧셈 조건 판정이 기대와 다릅니다');
    } else if (chk.discriminant !== undefined) {
      if (curve.model !== 'weierstrass') throw new Error('discriminant는 바이어슈트라스 곡선에서만 씁니다');
      if (F.str(curve.discriminant) !== String(chk.discriminant)) {
        throw new Error('4a^3 + 27b^2 = ' + F.str(curve.discriminant) + ' 입니다 (기대 ' + chk.discriminant + ')');
      }
    } else if (chk.ladder) {
      const cost = ladderCost(chk.ladder.k);
      if (cost.doublings !== chk.ladder.doublings || cost.additions !== chk.ladder.additions) {
        throw new Error('double-and-add 비용이 다릅니다: ' + JSON.stringify(cost));
      }
    } else {
      throw new Error('알 수 없는 검사: ' + JSON.stringify(chk));
    }
  }

  /** 문자열의 [[이름]] 자리표시자를 점 좌표 "(x, y)" (무한원점은 "O")로 바꿉니다. */
  function substitute(text, resolved) {
    return String(text).replace(/\[\[([A-Za-z][A-Za-z0-9]*)\]\]/g, (_, name) => {
      if (!resolved || !(name in resolved.points)) throw new Error('자리표시자 [[' + name + ']]에 해당하는 점이 없습니다');
      return formatPoint(resolved.curve, resolved.points[name]);
    });
  }

  /* ====================================================================
   * 6. 서식 토큰
   *   ^{...} 위첨자   _{...} 아래첨자   **...** 강조
   *   그 밖의 ^ _ { } \ 는 모두 오류입니다. (HTML은 쓰지 않으며 출력은 항상 텍스트 노드로만 만듭니다.)
   * ==================================================================== */
  function parseRich(src) {
    if (typeof src !== 'string') throw new Error('문자열이 아닙니다');
    const runs = [];
    let buf = '';
    let strong = false;
    const flush = () => {
      if (buf) runs.push({ text: buf, sup: false, sub: false, strong });
      buf = '';
    };
    let i = 0;
    while (i < src.length) {
      const ch = src[i];
      if (ch === '*') {
        if (src[i + 1] !== '*') throw new Error('낱개 * 는 쓸 수 없습니다 (강조는 **...**): ' + JSON.stringify(src));
        flush();
        strong = !strong;
        i += 2;
        continue;
      }
      if ((ch === '^' || ch === '_') && src[i + 1] === '{') {
        const end = src.indexOf('}', i + 2);
        if (end < 0) throw new Error('닫히지 않은 첨자 토큰: ' + JSON.stringify(src));
        const inner = src.slice(i + 2, end);
        if (!inner) throw new Error('빈 첨자 토큰: ' + JSON.stringify(src));
        if (/[{}^_\\*[\]]/.test(inner)) throw new Error('첨자 토큰 안에 쓸 수 없는 문자가 있습니다: ' + JSON.stringify(src));
        flush();
        runs.push({ text: inner, sup: ch === '^', sub: ch === '_', strong });
        i = end + 1;
        continue;
      }
      if (ch === '^' || ch === '_' || ch === '{' || ch === '}' || ch === '\\') {
        throw new Error('잘못된 서식 문자 ' + JSON.stringify(ch) + ': ' + JSON.stringify(src));
      }
      if (ch === '[' && src[i + 1] === '[') throw new Error('해결되지 않은 자리표시자: ' + JSON.stringify(src));
      if (ch < ' ' || ch === '\u007f') throw new Error('제어 문자는 쓸 수 없습니다: ' + JSON.stringify(src));
      buf += ch;
      i += 1;
    }
    if (strong) throw new Error('닫히지 않은 ** 강조: ' + JSON.stringify(src));
    flush();
    return runs;
  }

  /** 스크린리더/aria용 평문: x^{3} -> x^3, 2^{252} -> 2^252, F_{17} -> F_17 */
  function richToPlain(runs) {
    return runs.map((r) => (r.sup ? '^' + r.text : r.sub ? '_' + r.text : r.text)).join('');
  }

  /** 화면에 실제로 그려지는 글자 집합(공백 제외). 글리프 검사용. */
  function richChars(runs) {
    const set = new Set();
    for (const r of runs) for (const ch of r.text) set.add(ch);
    return set;
  }

  /* ====================================================================
   * 7. 시간표 (빌드와 재생기가 같은 값을 쓰도록 여기서 계산)
   * ==================================================================== */
  const PALETTE = ['white', 'mint', 'yellow', 'pink', 'sky', 'orange'];
  const DEFAULT_DUR = { axes: 0.8, curve: 2.4, line: 1.2, tangent: 1.2, point: 0.4, link: 0.9, dots: 1.2, orbit: 4, hline: 0.8, bar: 1.2, node: 0.75 };
  const READ_CHARS_PER_SEC = 9; // 자동 넘김 때 자막을 읽을 시간 (판서가 진행되는 동안 읽기 시작하므로 초당 9자로 잡습니다)

  const textDuration = (plain) => Math.min(2.4, Math.max(0.7, plain.length * 0.075));

  /** 요소 하나가 그려지는 데 걸리는 시간(초). 글이 붙은 요소는 글자 수에 비례해 늘어납니다. */
  function elementDuration(el, substituteFn) {
    if (el.dur !== undefined) return el.dur;
    const sub = substituteFn || ((t) => t);
    const labelDur = (text) => (text ? textDuration(richToPlain(parseRich(sub(text)))) : 0);
    if (el.type === 'point') return el.label ? 0.35 + 0.6 * labelDur(el.label) : DEFAULT_DUR.point;
    if (el.type === 'node') {
      return DEFAULT_DUR.node + 0.7 * [el.title].concat(el.lines || []).reduce((n, t) => n + labelDur(t), 0);
    }
    return DEFAULT_DUR[el.type] || 0.5;
  }

  /**
   * 한 단계의 판서 시간표. substituteFn(text)는 [[점]]을 좌표 문자열로 바꿔 주는 함수입니다.
   * 반환: { panel: [{at, dur}], animEnd, holdEnd }   (초 단위, 속도 1배 기준)
   */
  function stepTimeline(step, substituteFn) {
    const sub = substituteFn || ((t) => t);
    let end = 0;
    let prevEnd = 0;
    const panel = [];
    (step.panel || []).forEach((line, i) => {
      const plain = richToPlain(parseRich(sub(line.text)));
      const dur = line.dur !== undefined ? line.dur : textDuration(plain);
      const at = line.at !== undefined ? line.at : i === 0 ? 0.3 : prevEnd + 0.25;
      prevEnd = at + dur;
      end = Math.max(end, prevEnd);
      panel.push({ at, dur });
    });
    for (const el of (step.board && step.board.elements) || []) {
      end = Math.max(end, el.at + elementDuration(el, sub));
    }
    const lastBeat = (step.beats || []).reduce((m, b) => Math.max(m, b.at), 0);
    const animEnd = Math.max(end, lastBeat) + 0.4;
    const readChars = [step.summary].concat((step.beats || []).map((b) => b.text))
      .reduce((n, t) => n + richToPlain(parseRich(t)).length, 0);
    const holdEnd = Math.max(animEnd + 3, readChars / READ_CHARS_PER_SEC);
    return { panel, animEnd, holdEnd };
  }

  return {
    version: 1,
    mod, gcd, modPow, modInv, sqrtMod, isProbablePrime, log2Count, ladderCost,
    Q, makeFp, fieldFromSpec,
    weierstrass, edwards, ed25519,
    resolveMath, runCheck, orbitOf, formatPoint, substitute,
    parseRich, richToPlain, richChars,
    PALETTE, DEFAULT_DUR, READ_CHARS_PER_SEC, textDuration, elementDuration, stepTimeline,
  };
});
