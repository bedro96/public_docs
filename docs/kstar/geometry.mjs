import { boxCorners, corners, cylinder, depthOf, fitProjection, haloOf, insetPlan, iso, lineSvg, pathOf, planOutline, slabOf, solidSvg } from "../shipyard/vendor/iso-kit.mjs";

const W = 760;
const H = 474;
const TONES = 32;
const TAU = 2 * Math.PI;
const at = (deg) => deg * Math.PI / 180;
const angles = (a, b, steps) => Array.from({ length: steps + 1 }, (_, i) => a + (b - a) * i / steps);
const azimuth = 42;
const front = at(azimuth);
const cut = at(65);
const first = front + cut;
const last = front + TAU - cut;
const base = { x: -225, y: -225, w: 450, d: 450, r: 43 };
const P = fitProjection([
  ...boxCorners(base, -149, -124),
  ...angles(0, TAU, 48).flatMap((t) => [ring(t, 252, 11), ring(t, 153, 114)]),
  [0, 0, 121],
], W, H, { pad: 17, azimuth, elevation: 31 });

const project = (p) => iso(p, P);
const outline = (pts, close = false) => pathOf(pts.map(project), close);
const depth = (p) => depthOf(p, P);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = (v) => v.map((x) => x / (Math.hypot(...v) || 1));
const sun = normalize([-0.16, 0.53, 0.83]);

function ring(t, r, z) {
  return [r * Math.cos(t), r * Math.sin(t), z];
}

function section(p, a, b) {
  return [139 + a * Math.cos(p + 0.23 * Math.sin(p)), b * Math.sin(p)];
}

const profile = (t, p, a, b) => ring(t, ...section(p, a, b));
const warm = (t, p) => profile(t, p, 37, 46);
const shell = (t, p) => profile(t, p, 61, 71);
const inner = (t, p) => profile(t, p, 57, 67);

function renderMachine(orbit = false) {
  const faces = [];
  const push = (part, points, shadeShift = 0) => {
    const n = normalize(cross(sub(points[1], points[0]), sub(points[2], points[1])));
    const facing = Math.abs(dot(n, sun));
    const shade = Math.min(TONES - 1, Math.max(0, Math.round((1 + facing * 5 + shadeShift) * (TONES - 1) / 7)));
    faces.push({ part, shade, path: outline(points, true), depth: points.reduce((sum, p) => sum + depth(p), 0) / points.length });
  };

  function surface(part, us, vs, point, shift = 0) {
    const rows = us.map((u) => vs.map((v) => point(u, v)));
    for (let i = 1; i < us.length; i++) {
      for (let j = 1; j < vs.length; j++) {
        push(part, [rows[i - 1][j - 1], rows[i - 1][j], rows[i][j], rows[i][j - 1]], shift);
      }
    }
  }

  function band(part, from, to, r, z, width, height, samples = 50) {
    const arc = angles(from, to, samples);
    const box = [[r - width / 2, z - height / 2], [r + width / 2, z - height / 2],
      [r + width / 2, z + height / 2], [r - width / 2, z + height / 2]];
    for (let i = 0; i < 4; i++) {
      surface(part, arc, [0, 1], (t, j) => ring(t, ...box[(i + j) % 4]), i === 2 ? 1 : -1);
    }
    if (to - from < TAU - 0.01) {
      for (const t of [from, to]) push(part, box.map(([rr, zz]) => ring(t, rr, zz)), 1);
    }
  }

  // The missing sector is a museum cut, not an opening in the working machine.
  const arc = angles(front - cut, front + TAU - cut, 112);
  surface("plasma", arc, angles(0, TAU, 28), warm, 0.75);
  if (!orbit) machineParts();
  function machineParts() {
  const rear = angles(first, last, 68);
  surface("vessel", rear, angles(0, TAU, 32), shell);
  const open = angles(front - cut, first, 40);
  const lip = [at(168), at(323)];
  surface("vessel", open, angles(...lip, 22), shell);
  surface("liner", open, angles(...lip, 22), inner, -0.5);
  for (const p of lip) {
    surface("vessel", open, [0, 1], (t, i) => (i ? shell(t, p) : inner(t, p)), 1.5);
  }
  for (const t of [front - cut, first]) {
    surface("vessel", [0, 1], angles(lip[1], TAU + lip[0], 38),
      (i, p) => i ? shell(t, p) : inner(t, p), 1.5);
  }

  // Two closed rows of exposed target tiles, inside the low part of the vessel.
  for (let i = 0; i < 18; i++) {
    const from = front - cut + 2 * cut * i / 18 + 0.006;
    const to = front - cut + 2 * cut * (i + 1) / 18 - 0.006;
    band("divertor", from, to, 115, -52, 13, 5, 2);
    band("divertor", from, to, 143, -59, 15, 5, 2);
  }

  // Offset windings are distinct solids; omitted front coils expose the plasma.
  for (let i = 0; i < 16; i++) {
    const t = front + TAU * i / 16;
    if (t < first - 0.05 || t > last + 0.05) continue;
    const rim = (p, side, radius) => {
      const [r, z] = section(p, radius, radius + 1);
      return ring(t + side / r, r, z);
    };
    const p = angles(0, TAU, 52);
    for (const side of [-6.4, 6.4]) {
      surface("tf", p, [84, 99], (v, r) => rim(v, side, r));
    }
    for (const r of [84, 99]) {
      surface("tf", p, [-6.4, 6.4], (v, side) => rim(v, side, r), -0.25);
    }
    for (const v of [0.2, 1.57, 3.14, 4.7, 5.9]) {
      const seam = angles(v - 0.021, v + 0.021, 1);
      surface("trim", seam, [84, 99], (vv, r) => rim(vv, 6.54, r), -0.75);
      surface("trim", seam, [84, 99], (vv, r) => rim(vv, -6.54, r), -0.75);
      for (const r of [83.9, 99.1]) {
        surface("trim", seam, [-6.3, 6.3], (vv, side) => rim(vv, side, r), -0.75);
      }
    }
  }

  // The six external examples are a schematic selection, not a coil inventory.
  for (const [r, z] of [[121, 112], [181, 108], [248, 47], [248, -47], [181, -108], [121, -112]]) {
    band("pf", first - 0.08, last + 0.08, r, z, 7, 8, 68);
    band("trim", first - 0.08, last + 0.08, r, z + 4.7, 8, 1.4, 68);
  }
  band("body", 0, TAU, 204, -121, 28, 8, 96);
  band("body", 0, TAU, 169, -111, 21, 12, 96);
  band("body", 0, TAU, 118, -105, 15, 10, 96);
  for (const t of angles(0, TAU, 8).slice(0, -1)) {
    band("body", t - 0.045, t + 0.045, 169, -121, 24, 8, 2);
    band("body", t - 0.045, t + 0.045, 118, -117.5, 15, 15, 2);
  }

  function barrel(part, radius, from, to) {
    const all = angles(0, TAU, 64);
    surface(part, all, [from, to], (t, z) => ring(t, radius, z));
    surface(part, all, [0.01, radius], (t, r) => ring(t, r, to), 1);
  }
  barrel("body", 30, -125, -91);
  const spine = [[24, -91]];
  for (const z of [-85, -58, -30, -2, 28, 56, 83]) {
    spine.push([24, z - 4], [26.3, z - 4], [26.3, z - 1], [27, z - 1],
      [27, z + 1], [26.3, z + 1], [26.3, z + 4], [24, z + 4]);
  }
  spine.push([24, 94]);
  surface("cs", angles(0, TAU, 72), spine.map((_, i) => i), (t, i) => ring(t, ...spine[i]));
  barrel("cs", 28, 94, 103);
  barrel("trim", 18, 103, 113);
  barrel("cs", 13, 113, 120);

  // These equatorial ports terminate on the outer equator of the vacuum vessel.
  for (const i of [4, 5, 10, 11]) {
    const t = front + TAU * (i + 0.5) / 16;
    const along = (r, v, size) => {
      const f = ring(t, r, 0);
      return [f[0] - Math.sin(t) * size * Math.cos(v), f[1] + Math.cos(t) * size * Math.cos(v), size * Math.sin(v)];
    };
    const round = angles(0, TAU, 26);
    surface("vessel", round, [198, 226], (v, r) => along(r, v, 9));
    surface("trim", round, [223, 229], (v, r) => along(r, v, 12), -0.35);
    surface("trim", round, [9, 12], (v, r) => along(229, v, r));
    const cap = round.slice(0, -1).map((v) => along(229, v, 9));
    push("liner", cap, -0.4);
    for (const v of angles(0, TAU, 10).slice(0, -1)) {
      const p = along(229.15, v, 10.6);
      const a = [-Math.sin(t) * 0.65, Math.cos(t) * 0.65, 0];
      push("vessel", [p.map((x, i) => x - a[i]), [p[0], p[1], p[2] + 0.65],
        p.map((x, i) => x + a[i]), [p[0], p[1], p[2] - 0.65]], 1);
    }
  }
  }

  const foundation = orbit ? "" : `<path class="iso-halo" d="${haloOf(base, -150, 12, P)}"/>` +
    [[-145, -145], [-145, 145], [145, -145], [145, 145]].sort((a, b) => depth([...a, 0]) - depth([...b, 0]))
      .map(([x, y]) => solidSvg(slabOf({ x: x - 31, y: y - 31, w: 62, d: 62, r: 12 }, -149, 14, P, 6, 2), { tone: "lo" })).join("") +
    solidSvg(slabOf(base, -138, 13, P, 10, 2), { tone: "mid",
      inner: lineSvg(planOutline(insetPlan(base, 12), -125, P), { tone: "lo", className: "base-inlay" }),
    }) +
    corners(base, 37).map(([x, y]) =>
      solidSvg(cylinder(x, y, 4.6, -125, 1.4, P, 18, 0.4), { tone: "lo", crease: "none" }) +
      solidSvg(cylinder(x, y, 2.8, -123.6, 2.5, P, 6, 0.35), { tone: "mid", crease: "none" })
    ).join("");

  faces.sort((a, b) => a.depth - b.depth);
  const batches = [];
  for (const face of faces) {
    const batch = batches.at(-1);
    if (batch?.part === face.part && batch.shade === face.shade) batch.paths.push(face.path);
    else batches.push({ part: face.part, shade: face.shade, paths: [face.path] });
  }
  return foundation + batches.map(({ part, shade, paths }) =>
    `<path class="mesh shade-${shade}" data-part="${part}" d="${paths.join("")}"/>`).join("");
}

export function auditGeometry() {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const sampled = angles(0, TAU, 720);
  for (const p of sampled) {
    const [r, z] = section(p, 37, 46);
    const [ri, zi] = section(p, 57, 67);
    const [rs, zs] = section(p, 61, 71);
    const [rt, zt] = section(p, 84, 85);
    const rho = (x, y) => Math.hypot(x - 139, y);
    assert(rho(r, z) + 10 < rho(ri, zi), "Plasma and inner vessel envelope overlap");
    assert(rho(ri, zi) + 3 < rho(rs, zs), "Vessel shell thickness vanishes");
    assert(rho(rs, zs) + 10 < rho(rt, zt), "Toroidal coils contact the vessel");
  }
  const span = (to, from) => to - from;
  assert(Math.abs(span(last, first) + 2 * cut - TAU) < 1e-10, "Cut and rear sectors do not meet");
  assert(139 - 99 > 29, "Coils contact the central solenoid");
  const bounds = angles(0, TAU, 96).flatMap((t) => [ring(t, 252, 47), ring(t, 204, -125)]);
  assert(bounds.every((p) => { const [x, y] = project(p); return x >= 0 && x <= W && y >= 0 && y <= H; }), "Model exceeds the viewing window");
  console.log("Geometry audit passed: sampled envelopes, cut seams, solenoid clearance and viewport.");
}

export function machineGraphic(inspector = false) {
  const id = inspector ? "inspector" : "machine";
  const art = inspector ? "" : `<defs><g id="machine-art">${renderMachine()}</g></defs>`;
  return `<svg class="machine" data-focus="${inspector ? "vessel" : "overview"}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}-title ${id}-desc">
    <title id="${id}-title">KSTAR 토카막 절개 모형</title><desc id="${id}-desc">받침대 위 도넛형 진공 용기의 앞쪽 절개면에서 플라스마와 아래쪽 디버터가 보입니다. D자형 자석, 수평 고리 자석, 중앙 솔레노이드가 용기 밖을 둘러쌉니다.</desc>
    ${art}<use href="#machine-art"/>
  </svg>`;
}

export function shadingCss() {
  return Array.from({ length: TONES }, (_, i) =>
    `.mesh.shade-${i}{--light:${(16 + 73 * i / (TONES - 1)).toFixed(2)}%}`
  ).join("");
}

export function plasmaOrbitGraphic() {
  const guide = outline(angles(front, front + TAU, 300).map((t) => warm(t, 0.88)), true);
  return `<svg class="machine" data-focus="plasma" viewBox="90 12 580 340" aria-hidden="true">
    ${renderMachine(true)}<path data-orbit="cycle" fill="none" stroke="#fff4d0" opacity=".46" stroke-width="1.25" d="${guide}"/>
  </svg>`;
}

export function fieldGraphic() {
  const fieldP = fitProjection([
    ...angles(0, TAU, 32).flatMap((t) => [ring(t, 184, 0), ring(t, 128, 45), ring(t, 128, -45)]),
  ], 470, 240, { azimuth, elevation: 41, pad: 26 });
  const line = (points) => pathOf(points.map((p) => iso(p, fieldP)));
  const course = angles(0, TAU, 200);
  const field = (t, p) => {
    const r = 129 + 45 * Math.cos(p);
    return ring(t, r, 45 * Math.sin(p));
  };
  const paths = (list) => list.map((d) => `<path d="${d}"/>`).join("");
  const body = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2].map((p) => line(course.map((t) => field(t, p))));
  const ribs = angles(0, TAU, 12).slice(0, -1).map((t) => line(course.map((p) => field(t, p))));
  const circular = line(course.map((t) => field(t, 0.58)));
  const helical = line(course.map((t) => field(t * 2, t * 5 + 0.58)));
  const poloidal = line(course.map((p) => field(front + 0.58, p)));
  const exhaustStart = front + 1.65;
  const exhaustEnd = front - 0.27;
  const edge = line(angles(0, 1, 120).map((u) => {
    const [x, y, z] = field(exhaustStart + (exhaustEnd - exhaustStart) * u, 3.78 + 0.95 * u);
    return [x, y, z - 11 * u ** 3];
  }));
  const targetTop = angles(exhaustEnd - 0.22, exhaustEnd + 0.22, 16);
  const target = pathOf([
    ...targetTop.map((t) => iso(ring(t, 147, -56), fieldP)),
    ...[...targetTop].reverse().map((t) => iso(ring(t, 115, -56), fieldP)),
  ], true);
  return `<svg class="field" viewBox="0 0 470 240" role="img" aria-labelledby="field-title field-desc">
    <title id="field-title">토카막 자기장 방향 개념도</title><desc id="field-desc">링을 크게 한 바퀴 도는 토로이달 성분과 단면을 도는 폴로이달 성분을 합하면 자기력선이 꼬입니다. 그림은 실제 실험 궤적이 아닙니다.</desc>
    <g class="field-scaffold">${paths([...body, ...ribs])}</g>
    <g class="field-track">
      <path data-track="seed" d="${circular}"/>
      <path data-track="toroidal" d="${circular}"/>
      <path data-track="poloidal" d="${poloidal}"/>
      <path data-track="helical" d="${helical}"/>
      <path data-track="control" d="${helical}"/>
      <path data-track="target" d="${target}"/>
      <path data-track="exhaust" d="${edge}"/>
    </g>
    <circle class="tracer" r="4" cx="235" cy="120" hidden/>
  </svg>`;
}
