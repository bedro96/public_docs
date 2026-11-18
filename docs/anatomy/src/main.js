import * as THREE from 'three';
import { GROUPS, ORGANS, STAGES } from './data.js';
import { buildOrgans, juiceRoutes, GLOBAL_UNIFORMS } from './geometry.js';

/* =========================================================
   Setup
   ========================================================= */
const $ = (s, r = document) => r.querySelector(s);
const bi = (o) => `<span class="k">${o.kr}</span><span class="e">${o.en}</span>`;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const easeIO = (t) => t * t * (3 - 2 * t);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const PAPER = new THREE.Color('#efeee6');
const INK = new THREE.Color('#1f2430');
const INDIGO = new THREE.Color('#2d4c7e');
const CINNABAR = new THREE.Color('#b8321f');
const DIM_LINE = new THREE.Color('#aeb1b8');

const app = $('#app');
const canvas = $('#gl');
const viewport = $('#viewport');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(28, 1, 0.5, 300);
scene.add(camera);
scene.add(new THREE.AmbientLight('#ffffff', 1.45));
const key = new THREE.DirectionalLight('#fff8ee', 1.9);
key.position.set(-3, 5, 7);
camera.add(key);
camera.add(key.target);
key.target.position.set(0, 0, -10);

const O = buildOrgans();
const DEF = Object.fromEntries(ORGANS.map((o) => [o.id, o]));
const IDS = ORGANS.map((o) => o.id);
const bodyRig = new THREE.Group();
scene.add(bodyRig);
for (const id of IDS) {
  scene.add(O[id].group);
  scene.add(O[id].ghost);
}

/* ---------- body shell: translucent torso + head with an ink rim ---------- */
// Incision window on the front of the torso (world y). The skin is opaque until the cut
// has been made, then it fades to the translucent ghost used for the rest of the session.
const CUT = { top: 5.7, bottom: -0.05, wmax: 1.55 };
const bodyUniforms = {
  uFade: { value: 1 }, uColor: { value: new THREE.Color('#2d4c7e') },
  uSkin: { value: 1 }, uCut: { value: 0 }, uOpen: { value: 0 },
  uTop: { value: CUT.top }, uLen: { value: CUT.top - CUT.bottom }, uWmax: { value: CUT.wmax },
};
// [y, halfWidth, halfDepth, zCenter]
const BODY_PROF = [
  [-1.2, 1.5, 0.95, 0.12], [-0.9, 1.72, 1.0, 0.12], [0.3, 1.86, 1.08, 0.14], [1.5, 1.74, 1.02, 0.14],
  [2.6, 1.86, 1.12, 0.15], [3.6, 2.0, 1.22, 0.15], [4.6, 2.16, 1.26, 0.14], [5.2, 2.2, 1.1, 0.12],
  [5.6, 1.62, 0.9, 0.12], [5.85, 0.9, 0.72, 0.12], [6.1, 0.62, 0.62, 0.12], [6.4, 0.62, 0.62, 0.14],
  [6.6, 0.88, 0.9, 0.28], [7.0, 1.02, 1.1, 0.42], [7.6, 1.04, 1.14, 0.44], [8.2, 0.98, 1.1, 0.4],
  [8.6, 0.72, 0.82, 0.32], [8.82, 0.32, 0.38, 0.28], [8.88, 0.01, 0.01, 0.28],
];
function bodyFrontZ(y) {
  for (let i = 0; i < BODY_PROF.length - 1; i++) {
    const a = BODY_PROF[i], b = BODY_PROF[i + 1];
    if (y >= a[0] && y <= b[0]) {
      const f = (y - a[0]) / (b[0] - a[0]);
      return (a[3] + a[2]) + ((b[3] + b[2]) - (a[3] + a[2])) * f;
    }
  }
  return 1.2;
}
let bodyMat;
const bodyMesh = (() => {
  const prof = BODY_PROF;
  const curve = new THREE.CatmullRomCurve3(prof.map((p) => new THREE.Vector3(p[1], p[2], p[3])), false, 'catmullrom', 0.5);
  const rows = 140, cols = 64, n = 2.5;
  const pos = [], idx = [];
  const tmp = new THREE.Vector3();
  for (let r = 0; r <= rows; r++) {
    const t = r / rows;
    curve.getPoint(t, tmp);
    const f = t * (prof.length - 1), i = Math.min(prof.length - 2, Math.floor(f));
    const y = prof[i][0] + (prof[i + 1][0] - prof[i][0]) * (f - i);
    for (let c = 0; c <= cols; c++) {
      const th = (c / cols) * Math.PI * 2;
      const cs = Math.cos(th), sn = Math.sin(th);
      pos.push(
        tmp.x * Math.sign(cs) * Math.pow(Math.abs(cs), 2 / n),
        y,
        tmp.z + tmp.y * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n),
      );
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c, b = a + cols + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.ShaderMaterial({
    uniforms: bodyUniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; vP = position; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uFade, uSkin, uCut, uOpen, uTop, uLen, uWmax;
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        vec3 n = normalize(vN); vec3 v = normalize(vV);
        // incision: a midline slit that is drawn downwards (uCut) and then pulled open into a wide window (uOpen)
        float cutY = uTop - uCut * uLen;
        float front = step(0.1, vP.z);
        float inY = front * step(cutY, vP.y) * step(vP.y, uTop);
        float s = (vP.y - (uTop - 0.5 * uLen)) / (0.5 * uLen);
        float wd = uOpen * uWmax * pow(max(1.0 - pow(abs(s), 4.0), 0.0), 0.25);
        float ax = abs(vP.x);
        if (inY > 0.5 && ax < wd) discard;
        float g = 0.4 + 0.6 * min(1.0, uOpen * 3.0);
        float e = ax - wd;
        float wound = 0.0; vec3 wc = vec3(0.0);
        if (inY > 0.5) {
          if (e < 0.05 * g) { wound = 1.0; wc = vec3(0.60, 0.20, 0.15); }
          else if (e < 0.062 * g) { wound = 1.0; wc = vec3(0.12, 0.14, 0.19); }
          else if (e < 0.115 * g) { wound = 1.0; wc = vec3(0.91, 0.81, 0.56); }
        }
        float d = 1.0 - abs(dot(n, v));
        float rim = smoothstep(0.80, 0.9, d);
        float low = smoothstep(-1.2, -0.3, vP.y);
        float lowSkin = smoothstep(-1.2, -0.75, vP.y);
        float ghostA = (0.045 + 0.2 * pow(d, 2.4) + 0.62 * rim) * uFade;
        // skin: three flat tone steps (ink-and-pigment look) with an ink outline at the silhouette
        float lam = dot(n, normalize(vec3(-0.35, 0.55, 0.75)));
        float band = lam > 0.42 ? 1.0 : (lam > -0.05 ? 0.9 : 0.79);
        vec3 skin = mix(vec3(0.925, 0.835, 0.72) * band, vec3(0.12, 0.14, 0.19), smoothstep(0.76, 0.86, d));
        // seen through the incision: the inner wall of the torso, a deep madder-brown so the organs stand out
        if (!gl_FrontFacing) skin = vec3(0.50, 0.27, 0.24) * (0.8 + 0.2 * band);
        vec3 col = mix(uColor, skin, uSkin);
        // opaque skin fades into the page colour at the waist instead of becoming see-through
        col = mix(mix(col, vec3(0.937, 0.933, 0.902), uSkin), col, mix(low, gl_FrontFacing ? lowSkin : 1.0, uSkin));
        float a = mix(ghostA * low, 1.0, uSkin);
        if (wound > 0.5) { col = wc; a = max(a, uFade * low); }
        gl_FragColor = vec4(col, a);
      }`,
  });
  bodyMat = m;
  const mesh = new THREE.Mesh(g, m);
  mesh.renderOrder = 10;
  mesh.raycast = () => {};
  return mesh;
})();
scene.add(bodyMesh);

/* ---------- scalpel: only seen while the incision is drawn ---------- */
const scalpel = (() => {
  const g = new THREE.Group();
  const gm = O.heart.meshes[0].material.gradientMap;
  const edge = new THREE.LineBasicMaterial({ color: '#1f2430' });
  const add = (geo, color) => {
    const m = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color, gradientMap: gm }));
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edge));
    g.add(m);
    return m;
  };
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(0.1, 0.06, 0.09, 0.3);
  shape.lineTo(0.09, 0.78);
  shape.lineTo(-0.07, 0.78);
  shape.lineTo(-0.07, 0.12);
  shape.lineTo(0, 0);
  const blade = add(new THREE.ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: false }), '#d3d9e2');
  blade.position.z = -0.012;
  add(new THREE.BoxGeometry(0.2, 0.16, 0.1), '#b8321f').position.set(0.01, 0.86, 0);
  add(new THREE.BoxGeometry(0.15, 1.9, 0.07), '#2a2f3a').position.set(0.01, 1.89, 0);
  g.rotation.set(0.95, 0, -0.14);
  g.visible = false;
  g.traverse((o) => { o.raycast = () => {}; });
  return g;
})();
scene.add(scalpel);

/* =========================================================
   State
   ========================================================= */
const S = {
  mode: 'explore',
  selected: null,
  hover: null,
  removed: new Set(),
  held: null,
  inspect: null,
  yaw: 0.4, pitch: -0.12, zoom: 1, spin: !reduceMotion,
  camYaw: 0, camPitch: 0.04,
  opened: false, // false until the incision is complete; the UI and organ interaction stay locked until then
  inc: { phase: 'closed', t: 0 }, // closed → cut → open → fade → done
  labels: true, body: true,
  meal: { stage: 0, t: 0, playing: false, done: false },
  time: 0,
};

const A = {};
for (const id of IDS) {
  const o = O[id];
  A[id] = {
    pos: o.home.clone(), quat: new THREE.Quaternion(), scale: 1,
    tpos: o.home.clone(), tquat: new THREE.Quaternion(), tscale: 1,
    dim: 0, tdim: 0, hl: 0, // hl: 0 none, 1 helper (indigo), 2 selected (cinnabar)
  };
}

const layout = { portrait: false, w: 800, h: 600, dist: 20, center: new THREE.Vector3(0, 3.1, 0.2), halfW: 6.8 };

/* =========================================================
   Layout / camera
   ========================================================= */
function trayPos(id) {
  const d = DEF[id];
  if (layout.portrait) {
    const i = IDS.indexOf(id);
    return new THREE.Vector3(-3.9 + (i % 4) * 2.6, -2.8 - Math.floor(i / 4) * 2.75, 0.5);
  }
  return new THREE.Vector3((d.trayCol === 'L' ? -1 : 1) * 5.0, 7.4 - d.traySlot * 1.9, 0.5);
}
function trayScale(id) {
  const lim = layout.portrait ? 1.7 : 1.3;
  return clamp(lim / O[id].maxDim, 0.3, 1.25);
}

function resize() {
  const r = viewport.getBoundingClientRect();
  const w = Math.max(200, Math.round(r.width)), h = Math.max(200, Math.round(r.height));
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  GLOBAL_UNIFORMS.uRes.value.set(w * dpr, h * dpr);
  layout.w = w; layout.h = h; layout.dpr = dpr;
  layout.portrait = w / h < 1.05;
  camera.aspect = w / h;
  let y0, y1, hw;
  if (layout.portrait && S.mode !== 'meal') { y0 = -10.3; y1 = 9.0; hw = 5.6; }
  else if (layout.portrait) { y0 = -3.3; y1 = 8.9; hw = 4.4; }
  else { y0 = -3.3; y1 = 8.9; hw = 6.0; }
  layout.center.set(0, (y0 + y1) / 2, 0.2);
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  layout.distV = (y1 - y0) / 2 / t * 1.03;
  layout.distH = hw / (camera.aspect * t) * 1.03;
  layout.dist = Math.max(layout.distV, layout.distH);
  layout.halfW = hw;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewport);

function placeCamera() {
  // looking down foreshortens the torso, so the camera may come closer without cropping it
  const d = Math.max(layout.distV * (1 - 0.22 * clamp(S.camPitch / SURGEON_PITCH, 0, 1.3)), layout.distH);
  const cy = Math.cos(S.camPitch);
  camera.position.set(
    layout.center.x + Math.sin(S.camYaw) * cy * d,
    layout.center.y + Math.sin(S.camPitch) * d,
    layout.center.z + Math.cos(S.camYaw) * cy * d,
  );
  camera.lookAt(layout.center);
  camera.updateMatrixWorld(true);
}

const _v = new THREE.Vector3();
function project(p) {
  _v.copy(p).project(camera);
  return { x: (_v.x * 0.5 + 0.5) * layout.w, y: (-_v.y * 0.5 + 0.5) * layout.h, z: _v.z };
}

/* =========================================================
   Organ state helpers
   ========================================================= */
const toast = $('#toast');
let toastTimer = 0;
function say(kr, en) {
  toast.innerHTML = `<span class="k">${kr}</span><span class="e">${en}</span>`;
  toast.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('on'), 2600);
}

function removeOrgan(id, quiet) {
  if (S.mode === 'meal') return;
  if (!S.removed.has(id)) {
    S.removed.add(id);
    if (!quiet) say(`${DEF[id].kr}을(를) 꺼냈어요`, `${DEF[id].en} taken out`);
  }
  refreshAll();
}
function putOrgan(id, quiet) {
  if (S.removed.delete(id) && !quiet) say(`${DEF[id].kr}을(를) 제자리에 넣었어요`, `${DEF[id].en} put back`);
  refreshAll();
}
function putAll() {
  S.removed.clear();
  refreshAll();
}

function select(id) {
  S.selected = id;
  refreshAll();
}

/* =========================================================
   Rail list
   ========================================================= */
const nav = $('#organNav');
const listBtn = {};
for (const g of GROUPS) {
  const wrap = document.createElement('div');
  wrap.className = 'grp';
  wrap.innerHTML = `<h2>${bi(g)}</h2>`;
  const ul = document.createElement('ul');
  for (const o of ORGANS.filter((x) => x.group === g.id)) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.className = 'organ';
    b.dataset.id = o.id;
    b.innerHTML = `<i class="chip" style="--c:${o.color}"></i><span class="nm"><span class="k">${o.kr}</span><span class="e">${o.en}</span></span><span class="st" aria-hidden="true"></span>`;
    b.addEventListener('click', () => select(S.selected === o.id && S.mode === 'explore' ? null : o.id));
    b.addEventListener('pointerenter', () => { S.hover = o.id; });
    b.addEventListener('pointerleave', () => { if (S.hover === o.id) S.hover = null; });
    b.addEventListener('focus', () => { S.hover = o.id; });
    b.addEventListener('blur', () => { if (S.hover === o.id) S.hover = null; });
    li.appendChild(b);
    ul.appendChild(li);
    listBtn[o.id] = b;
  }
  wrap.appendChild(ul);
  nav.appendChild(wrap);
}

/* =========================================================
   Tags & leaders
   ========================================================= */
const tagsEl = $('#tags');
const leaders = $('#leaders');
const tag = {};
for (const o of ORGANS) {
  const b = document.createElement('button');
  b.className = 'tag';
  b.dataset.id = o.id;
  b.innerHTML = `<span class="k">${o.kr}</span><span class="e">${o.en}</span>`;
  b.addEventListener('click', () => select(o.id));
  tagsEl.appendChild(b);
  const ln = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  dot.setAttribute('r', '3');
  leaders.append(ln, dot);
  tag[o.id] = { el: b, ln, dot, w: 0, h: 0 };
}
function measureTags() {
  for (const id of IDS) {
    const t = tag[id];
    t.w = t.el.offsetWidth; t.h = t.el.offsetHeight;
  }
}

const anchor = {};
function computeAnchors() {
  anchor.esophagus = O.esophagus.tubes.esophagus.curve.getPointAt(0.1);
  anchor.colon = O.colon.tubes.colon.curve.getPointAt(0.12);
  anchor.smallint = new THREE.Vector3(0.1, 0.35, 0.5);
}
computeAnchors();

function updateTags() {
  const vis = S.labels && !S.inspect && S.opened;
  tagsEl.classList.toggle('off', !vis);
  leaders.classList.toggle('off', !vis);
  if (!vis) return;
  const sides = { L: [], R: [] };
  const edgeL = project(new THREE.Vector3(-2.3, 3.4, 0.2)).x - 16;
  const edgeR = project(new THREE.Vector3(2.3, 3.4, 0.2)).x + 16;
  const cx = project(layout.center).x;
  const mealIds = S.mode === 'meal' ? activeSet() : null;
  for (const id of IDS) {
    const t = tag[id];
    const a = A[id];
    const inBody = !S.removed.has(id) && S.held !== id;
    const show = (S.mode === 'explore' || mealIds.has(id)) && S.held !== id;
    t.el.hidden = !show;
    t.ln.style.display = t.dot.style.display = 'none';
    t.el.classList.toggle('sel', S.selected === id);
    t.el.classList.toggle('out', !inBody);
    t.el.classList.toggle('hot', S.hover === id);
    if (!show) continue;
    if (!inBody) {
      const tp = trayPos(id);
      tp.y -= O[id].size.y * trayScale(id) * 0.5 + 0.22;
      const p = project(tp);
      t.el.style.transform = `translate(${Math.round(p.x - t.w / 2)}px,${Math.round(p.y)}px)`;
      continue;
    }
    const wp = O[id].group.getWorldPosition(new THREE.Vector3());
    const an = anchor[id] ? anchor[id] : wp;
    const p = project(an);
    const side = p.x < cx ? 'L' : 'R';
    sides[side].push({ id, p, y: p.y });
  }
  for (const side of ['L', 'R']) {
    const arr = sides[side].sort((a, b) => a.y - b.y);
    const gap = 3;
    let prev = 6;
    for (const it of arr) {
      const h = tag[it.id].h;
      it.ty = Math.max(it.y - h / 2, prev);
      prev = it.ty + h + gap;
    }
    let next = layout.h - 6;
    for (let i = arr.length - 1; i >= 0; i--) {
      const h = tag[arr[i].id].h;
      arr[i].ty = Math.min(arr[i].ty, next - h);
      next = arr[i].ty - gap;
    }
    for (const it of arr) {
      const t = tag[it.id];
      const x = side === 'L' ? Math.max(4, edgeL - t.w) : Math.min(layout.w - t.w - 4, edgeR);
      t.el.style.transform = `translate(${Math.round(x)}px,${Math.round(it.ty)}px)`;
      const sx = side === 'L' ? x + t.w : x, sy = it.ty + t.h / 2;
      t.ln.setAttribute('d', `M${sx.toFixed(1)} ${sy.toFixed(1)} L${(side === 'L' ? sx + 8 : sx - 8).toFixed(1)} ${sy.toFixed(1)} L${it.p.x.toFixed(1)} ${it.p.y.toFixed(1)}`);
      t.dot.setAttribute('cx', it.p.x.toFixed(1));
      t.dot.setAttribute('cy', it.p.y.toFixed(1));
      t.ln.style.display = t.dot.style.display = '';
      const on = S.selected === it.id || S.hover === it.id;
      t.ln.classList.toggle('on', on);
      t.dot.classList.toggle('on', on);
    }
  }
}

/* =========================================================
   Detail panel
   ========================================================= */
const detail = $('#detail');
const GROUP = Object.fromEntries(GROUPS.map((g) => [g.id, g]));

function para(o, cls = '') {
  return `<p class="kr ${cls}">${o.kr}</p><p class="en ${cls}">${o.en}</p>`;
}

function renderDetail() {
  const id = S.selected;
  if (!S.opened) {
    const busy = S.inc.phase !== 'closed';
    detail.innerHTML = `
      <div class="intro">
        <h2><span class="k">집도 시점</span><span class="e">The surgeon's view</span></h2>
        ${busy
    ? para({ kr: '가슴에서 배까지 길게 절개하고 있어요. 잠시만 기다려 주세요.', en: 'Opening the chest and belly with one long cut. One moment.' })
    : para({ kr: '지금은 몸이 닫혀 있어요. 절개 버튼을 누르면 몸을 크게 열고, 수술하는 의사처럼 위에서 내려다보며 장기를 살펴볼 수 있어요.', en: 'The body is closed for now. Press the incision button to open it wide, then look down at the organs the way a surgeon does.' })}
        ${para({ kr: '교육용 모형이에요. 실제 수술 장면은 아니에요.', en: 'This is a teaching model, not a real operation.' }, 'sm')}
      </div>`;
    return;
  }
  if (!id) {
    detail.innerHTML = `
      <div class="intro">
        <h2><span class="k">몸속 여행</span><span class="e">A trip inside the body</span></h2>
        ${para({ kr: '장기를 눌러 이름과 하는 일을 알아보세요. 심장에서 췌장까지, 모든 장기를 몸 밖으로 꺼내 돌려 볼 수 있어요.', en: 'Choose an organ to learn its name and its job. From the heart to the pancreas, every organ can be taken out and turned around.' })}
        <ul class="how">
          <li><svg><use href="#i-out"/></svg><div><b>${bi({ kr: '끌어서 꺼내기', en: 'Drag it out' })}</b>${para({ kr: '장기를 몸 밖으로 끌어 놓으면 옆 선반에 놓여요.', en: 'Pull an organ away from the body and it rests on the side shelf.' }, 'sm')}</div></li>
          <li><svg><use href="#i-zoom"/></svg><div><b>${bi({ kr: '확대하고 돌려 보기', en: 'Enlarge and rotate' })}</b>${para({ kr: '장기를 고른 뒤 확대 버튼을 누르면 크게 보며 돌릴 수 있어요.', en: 'Pick an organ, then press Enlarge to turn it around at a larger size.' }, 'sm')}</div></li>
          <li><svg><use href="#i-play"/></svg><div><b>${bi({ kr: '음식 따라가기', en: 'Follow the meal' })}</b>${para({ kr: '한 입의 음식이 입에서 항문까지 가는 길을 따라가 봐요.', en: 'Follow one bite of food from the mouth all the way to the anus.' }, 'sm')}</div></li>
        </ul>
      </div>`;
    return;
  }
  const d = DEF[id];
  const out = S.removed.has(id);
  const inMeal = S.mode === 'meal';
  const parts = d.pins.map((p) => `<li>${bi(p)}</li>`).join('');
  const facts = d.facts.map((f) => `<li>${para(f)}</li>`).join('');
  const hint = id === 'pancreas' && !out ? para({ kr: '췌장은 위 뒤쪽에 숨어 있어요. 위를 꺼내면 잘 보여요.', en: 'The pancreas hides behind the stomach. Take the stomach out to see it.' }, 'tip') : '';
  detail.innerHTML = `
    ${inMeal ? `<div class="stagecard">${mealHTML()}</div>` : ''}
    <article class="card">
      <header>
        <h2><span class="k">${d.kr}</span><span class="e">${d.en}</span></h2>
        <p class="meta">${d.krSub ? `<span class="k">${d.krSub}</span>` : ''}${d.enSub ? `<span class="e">${d.enSub}</span>` : ''}<span class="k">${GROUP[d.group].kr}</span><span class="e">${GROUP[d.group].en}</span></p>
      </header>
      <div class="actions">
        <button class="btn primary" id="actZoom"><svg><use href="#i-zoom"/></svg>${bi({ kr: '확대 · 회전', en: 'Enlarge & rotate' })}</button>
        <button class="btn" id="actToggle" ${inMeal ? 'disabled' : ''}><svg><use href="#${out ? 'i-in' : 'i-out'}"/></svg>${out ? bi({ kr: '몸에 넣기', en: 'Put back' }) : bi({ kr: '꺼내기', en: 'Take out' })}</button>
      </div>
      ${hint}
      <section><h3>${bi({ kr: '하는 일', en: 'What it does' })}</h3>${para(d.role)}</section>
      <section><h3>${bi({ kr: '소화에서의 역할', en: 'Its part in digestion' })}</h3>${para(d.digest)}</section>
      <section><h3>${bi({ kr: '알아두기', en: 'Good to know' })}</h3><ul class="facts">${facts}</ul></section>
      <section><h3>${bi({ kr: '부분 이름', en: 'Parts' })}</h3><ul class="parts">${parts}</ul></section>
      ${d.note ? `<section class="note">${para(d.note, 'sm')}</section>` : ''}
    </article>`;
  $('#actZoom').addEventListener('click', () => openInspect(id));
  $('#actToggle').addEventListener('click', () => (S.removed.has(id) ? putOrgan(id) : removeOrgan(id)));
}

/* =========================================================
   Inspect (enlarge + rotate)
   ========================================================= */
const inspectBar = $('#inspectBar');
const pinsEl = $('#pins');
const pinNodes = [];
const dial = new THREE.Group();
const dialSpin = new THREE.Group();
dial.add(dialSpin);
dial.visible = false;
dial.renderOrder = 20;
scene.add(dial);
(() => {
  const pts = [];
  const N = 72;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2, deg = i * 5;
    const len = deg % 45 === 0 ? 0.13 : deg % 15 === 0 ? 0.085 : 0.045;
    pts.push(Math.cos(a), 0, Math.sin(a), Math.cos(a) * (1 + len), 0, Math.sin(a) * (1 + len));
  }
  const ring = [];
  const M = 128;
  for (let i = 0; i < M; i++) {
    const a0 = (i / M) * Math.PI * 2, a1 = ((i + 1) / M) * Math.PI * 2;
    ring.push(Math.cos(a0), 0, Math.sin(a0), Math.cos(a1), 0, Math.sin(a1));
  }
  const mat = new THREE.LineBasicMaterial({ color: '#2d4c7e', transparent: true, opacity: 0.85, depthTest: false });
  const g1 = new THREE.BufferGeometry();
  g1.setAttribute('position', new THREE.Float32BufferAttribute([...pts, ...ring], 3));
  dialSpin.add(new THREE.LineSegments(g1, mat));
  const gi = new THREE.BufferGeometry();
  gi.setAttribute('position', new THREE.Float32BufferAttribute([-0.05, 0, 1.3, 0.05, 0, 1.3, 0.05, 0, 1.3, 0, 0, 1.08, 0, 0, 1.08, -0.05, 0, 1.3], 3));
  dial.add(new THREE.LineSegments(gi, new THREE.LineBasicMaterial({ color: '#b8321f', depthTest: false })));
  dial.children.forEach((c) => (c.renderOrder = 20));
})();

function openInspect(id) {
  if (S.mode === 'meal') setMode('explore');
  S.inspect = id;
  S.selected = id;
  S.zoom = 1;
  S.yaw = 0.5; S.pitch = -0.15;
  S.spin = !reduceMotion;
  pinsEl.innerHTML = '';
  pinNodes.length = 0;
  O[id].pins.forEach((p) => {
    const d = document.createElement('div');
    d.className = 'pin';
    d.innerHTML = `<i></i><span class="lab"><span class="k">${p.kr}</span><span class="e">${p.en}</span></span>`;
    pinsEl.appendChild(d);
    pinNodes.push({ el: d, p });
  });
  refreshAll();
  $('#inClose').focus({ preventScroll: true });
}
function closeInspect() {
  if (!S.inspect) return;
  const id = S.inspect;
  S.inspect = null;
  pinsEl.innerHTML = '';
  pinNodes.length = 0;
  refreshAll();
  (listBtn[id] || document.body).focus?.({ preventScroll: true });
}

$('#inClose').addEventListener('click', closeInspect);
$('#inSpin').addEventListener('click', () => { S.spin = !S.spin; refreshInspectBar(); });
$('#inReset').addEventListener('click', () => { S.yaw = 0.5; S.pitch = -0.15; S.zoom = 1; });
$('#inLarger').addEventListener('click', () => { S.zoom = clamp(S.zoom * 1.2, 0.5, 2.6); });
$('#inSmaller').addEventListener('click', () => { S.zoom = clamp(S.zoom / 1.2, 0.5, 2.6); });
function refreshInspectBar() {
  inspectBar.hidden = !S.inspect;
  $('#inSpin').setAttribute('aria-pressed', String(S.spin));
}

function inspectTarget(id) {
  const fwd = camera.getWorldDirection(new THREE.Vector3());
  const dI = layout.dist * 0.5;
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const viewH = 2 * dI * t, viewW = viewH * camera.aspect;
  const fit = Math.min(viewH * 0.56, viewW * 0.64);
  const s = (fit / O[id].maxDim) * S.zoom;
  const pos = camera.position.clone().addScaledVector(fwd, dI).addScaledVector(camera.up, viewH * 0.04);
  return { pos, s, viewH, dI };
}

/* =========================================================
   Meal mode
   ========================================================= */
const mealEl = $('#meal');
const railEl = $('#rail');
const modesEl = $('#modes');
const routeEl = $('#route');
const mealText = $('#mealText');
const routeBtn = [];
STAGES.forEach((st, i) => {
  const li = document.createElement('li');
  const b = document.createElement('button');
  b.innerHTML = `<span class="k">${st.kr}</span><span class="e">${st.en}</span>`;
  b.addEventListener('click', () => mealGoto(i, true));
  li.appendChild(b);
  routeEl.appendChild(li);
  routeBtn.push(li);
});

const bolus = new THREE.Mesh(
  new THREE.SphereGeometry(1, 28, 20),
  new THREE.MeshToonMaterial({ color: '#d9a85a', gradientMap: O.heart.meshes[0].material.gradientMap }),
);
// the food travels inside tubes and behind organs, so it is drawn on top of them as a tracer
bolus.material.depthTest = false;
bolus.visible = false;
bolus.renderOrder = 20;
scene.add(bolus);
const trail = [];
for (let i = 0; i < 3; i++) {
  const m = new THREE.Mesh(bolus.geometry, bolus.material);
  m.visible = false;
  m.renderOrder = 20;
  scene.add(m);
  trail.push(m);
}
const juice = [];
const juiceGeo = new THREE.SphereGeometry(0.05, 10, 8);
const JR = juiceRoutes();
for (let i = 0; i < 36; i++) {
  const m = new THREE.Mesh(juiceGeo, new THREE.MeshBasicMaterial({ color: '#98b04a', transparent: true, depthTest: false }));
  m.renderOrder = 20;
  m.visible = false;
  scene.add(m);
  juice.push({ m, life: 0, age: 1, route: null, off: new THREE.Vector3() });
}

function activeSet() {
  const st = STAGES[S.meal.stage];
  return new Set([st.organ, ...st.helpers]);
}

/* =========================================================
   Incision: the body starts closed; one press opens it up
   ========================================================= */
const SURGEON_PITCH = 0.72; // the look-down angle of someone standing over the table
const INC = { cut: 2.1, open: 2.4, fade: 1.5 };
const easeOut = (t) => 1 - (1 - t) ** 3;

function placeScalpel(w) {
  const yTip = CUT.top - bodyUniforms.uCut.value * (CUT.top - CUT.bottom);
  scalpel.position.set(w * 2.2, yTip + w * 1.0, bodyFrontZ(yTip) + 0.02 + w * 1.6);
  scalpel.scale.setScalar(1.25 * (1 - w * 0.35));
}
function beginIncision() {
  if (S.inc.phase !== 'closed') return;
  if (reduceMotion) { finishIncision(); return; }
  S.inc.phase = 'cut'; S.inc.t = 0;
  scalpel.visible = true;
  placeScalpel(0);
  refreshAll();
}
function finishIncision() {
  S.inc.phase = 'done';
  S.opened = true;
  bodyUniforms.uCut.value = 1; bodyUniforms.uOpen.value = 1; bodyUniforms.uSkin.value = 0;
  S.camPitch = SURGEON_PITCH;
  scalpel.visible = false;
  refreshAll();
}
function incisionUpdate(dt) {
  const I = S.inc;
  if (I.phase === 'closed' || I.phase === 'done') return;
  I.t += dt;
  if (I.phase === 'cut') {
    const u = clamp(I.t / INC.cut, 0, 1);
    bodyUniforms.uCut.value = easeIO(u);
    placeScalpel(0);
    S.camPitch = 0.04 + (SURGEON_PITCH - 0.04) * 0.35 * easeIO(u);
    if (u >= 1) { I.phase = 'open'; I.t = 0; }
  } else if (I.phase === 'open') {
    const u = clamp(I.t / INC.open, 0, 1);
    bodyUniforms.uOpen.value = easeOut(u);
    const w = clamp((u - 0.05) / 0.4, 0, 1);
    placeScalpel(easeIO(w));
    scalpel.visible = w < 1;
    S.camPitch = 0.04 + (SURGEON_PITCH - 0.04) * (0.35 + 0.65 * easeIO(u));
    if (u >= 1) { I.phase = 'fade'; I.t = 0; S.opened = true; refreshAll(); }
  } else if (I.phase === 'fade') {
    const u = clamp(I.t / INC.fade, 0, 1);
    bodyUniforms.uSkin.value = 1 - easeIO(u);
    if (u >= 1) I.phase = 'done';
  }
}

function setMode(mode) {
  if (!S.opened) return;
  if (S.mode === mode) return;
  if (mode === 'meal') {
    if (S.inspect) closeInspect();
    S.removed.clear();
    S.mode = 'meal';
    S.meal = { stage: 0, t: 0, playing: !reduceMotion, done: false };
    S.selected = STAGES[0].organ;
  } else {
    S.mode = 'explore';
    S.meal.playing = false;
    bolus.visible = false;
    trail.forEach((m) => (m.visible = false));
    juice.forEach((j) => (j.m.visible = false));
    resetWaves();
    O.mouth.extra.jaw.rotation.x = 0;
  }
  refreshAll();
  resize();
}
function mealGoto(i, play) {
  i = clamp(i, 0, STAGES.length - 1);
  S.meal.stage = i; S.meal.t = 0; S.meal.done = false;
  if (play !== undefined) S.meal.playing = play;
  juice.forEach((j) => { j.age = 1; j.m.visible = false; });
  S.selected = STAGES[i].organ;
  refreshAll();
}
function mealPlay(on) {
  if (on && S.meal.done) { S.meal.stage = 0; S.meal.t = 0; S.meal.done = false; S.selected = STAGES[0].organ; }
  S.meal.playing = on;
  refreshAll();
}
$('#modeExplore').addEventListener('click', () => setMode('explore'));
$('#modeMeal').addEventListener('click', () => setMode('meal'));
$('#mealPlay').addEventListener('click', () => mealPlay(!S.meal.playing));
$('#mealPrev').addEventListener('click', () => mealGoto(S.meal.stage - 1, false));
$('#mealNext').addEventListener('click', () => mealGoto(S.meal.stage + 1, false));

function resetWaves() {
  for (const id of IDS) for (const k in O[id].tubes) {
    const w = O[id].tubes[k].wave;
    if (w) { w.uWaveC.value = -5; w.uWaveA.value = 0; }
  }
}

function mealHTML() {
  const st = STAGES[S.meal.stage];
  const helpers = st.helpers.length
    ? `<p class="helpers">${bi({ kr: '소화를 돕는 기관', en: 'Helpers' })}: ${st.helpers.map((h) => `<b>${DEF[h].kr} <span class="e">${DEF[h].en}</span></b>`).join(' · ')}</p>`
    : '';
  return `
    <h2><span class="k">${st.kr}</span><span class="e">${st.en}</span><span class="time"><span class="k">${st.time.kr}</span><span class="e">${st.time.en}</span></span></h2>
    ${para(st.say, 'sm')}${helpers}`;
}
function renderMealText() {
  mealText.innerHTML = mealHTML();
}

function stageUpdate(dt) {
  const M = S.meal;
  const st = STAGES[M.stage];
  if (M.playing) {
    M.t += dt;
    if (M.t >= st.dur) {
      if (M.stage < STAGES.length - 1) {
        M.stage++; M.t = 0;
        S.selected = STAGES[M.stage].organ;
        refreshAll();
      } else {
        M.t = st.dur; M.playing = false; M.done = true;
        refreshAll();
      }
    }
  }
  const cur = STAGES[M.stage];
  const u = clamp(M.t / cur.dur, 0, 1);
  resetWaves();
  O.mouth.extra.jaw.rotation.x = 0;
  const bp = new THREE.Vector3();
  let curveU = null, tubeName = null;
  bolus.material.color.set(cur.bolus);
  let size = cur.size;
  const id = cur.id;
  if (id === 'mouth') {
    bp.set(0, 6.97 + 0.02 * Math.sin(M.t * 9), 0.5);
    O.mouth.extra.jaw.rotation.x = 0.2 * (0.5 - 0.5 * Math.cos(M.t * 8)) * (u < 0.85 ? 1 : 0);
    size *= 1 - 0.28 * easeIO(clamp(u / 0.8, 0, 1));
  } else if (id === 'esophagus') {
    tubeName = 'esophagus'; curveU = easeIO(u) * 0.96 + 0.02;
  } else if (id === 'stomach') {
    const c = O.stomach.tubes.stomach.curve;
    let t;
    if (u < 0.18) t = easeIO(u / 0.18) * 0.3;
    else if (u < 0.82) t = 0.3 + 0.12 * Math.sin((u - 0.18) * 14) + 0.06 * Math.sin((u - 0.18) * 31);
    else t = 0.3 + (easeIO((u - 0.82) / 0.18)) * 0.69;
    bp.copy(c.getPointAt(clamp(t, 0, 1)));
    if (u > 0.18 && u < 0.82) bp.x += 0.07 * Math.sin(M.t * 3.3);
    size *= 1 + 0.35 * Math.sin(clamp(u / 0.82, 0, 1) * Math.PI);
    bolus.material.color.set(cur.bolus).lerp(new THREE.Color('#d6b98c'), 0.5 * clamp((u - 0.2) / 0.5, 0, 1));
  } else if (id === 'smallint') {
    tubeName = 'smallint'; curveU = u * 0.985 + 0.005;
  } else if (id === 'colon') {
    tubeName = 'colon'; curveU = u * 0.97 + 0.015;
  } else if (id === 'rectum') {
    tubeName = 'rectum'; curveU = easeIO(u) * 0.95 + 0.02;
  }
  if (tubeName) {
    const T = (tubeName === 'rectum' ? O.colon : O[cur.organ]).tubes[tubeName];
    bp.copy(T.curve.getPointAt(clamp(curveU, 0, 1)));
    if (T.wave) { T.wave.uWaveC.value = curveU; T.wave.uWaveA.value = reduceMotion ? 0 : 0.07; }
    // trailing pieces behind the head of the bolus, shrinking
    trail.forEach((m, i) => {
      const tu = curveU - 0.012 * (i + 1) * (id === 'smallint' ? 1.6 : 2.4);
      m.visible = id === 'smallint' && tu > 0;
      if (m.visible) {
        m.position.copy(T.curve.getPointAt(tu));
        m.scale.setScalar(size * (0.7 - i * 0.18));
      }
    });
  } else trail.forEach((m) => (m.visible = false));
  bolus.visible = true;
  bolus.position.copy(bp);
  bolus.scale.setScalar(size);

  // digestive juices flow into the duodenum during the small-intestine stage
  const emit = id === 'smallint' && M.playing;
  for (const j of juice) {
    if (j.age < 1) {
      j.age += dt / j.life;
      if (j.age >= 1) { j.m.visible = false; continue; }
      j.m.position.copy(j.route.curve.getPointAt(easeIO(j.age))).add(j.off);
      j.m.scale.setScalar(0.8 + 0.4 * Math.sin(j.age * Math.PI));
      j.m.material.opacity = Math.sin(j.age * Math.PI) * 0.95;
    } else if (emit && u < 0.7 && Math.random() < dt * 9) {
      const keys = ['liver', 'gallbladder', 'pancreas'];
      const k = keys[Math.floor(Math.random() * 3)];
      j.route = JR[k]; j.age = 0; j.life = 1.5 + Math.random() * 0.8;
      j.off.set((Math.random() - 0.5) * 0.14, (Math.random() - 0.5) * 0.14, (Math.random() - 0.5) * 0.14);
      j.m.material.color.set(JR[k].color);
      j.m.visible = true;
    }
  }
  O.stomach.pulse.scale.set(1, 1, 1);
  if (id === 'stomach' && M.playing && !reduceMotion) {
    const c = 0.045 * Math.sin(M.t * 2.2);
    O.stomach.pulse.scale.set(1 + c, 1 - c * 0.8 + 0.02 * Math.sin(M.t * 3.1), 1 + c * 0.5);
  }

  // progress UI
  routeBtn.forEach((li, i) => {
    li.classList.toggle('done', i < M.stage || (M.done && i === M.stage));
    li.classList.toggle('now', i === M.stage && !M.done);
    li.style.setProperty('--p', i < M.stage ? 1 : i === M.stage ? u.toFixed(3) : 0);
  });
}

/* =========================================================
   Refresh UI (non-per-frame)
   ========================================================= */
const hint = $('#hint');
const readout = $('#readout');

function refreshAll() {
  app.dataset.mode = S.mode;
  app.dataset.body = S.opened ? 'open' : S.inc.phase === 'closed' ? 'closed' : 'cutting';
  railEl.inert = !S.opened;
  modesEl.inert = !S.opened;
  app.classList.toggle('inspecting', !!S.inspect);
  $('#modeExplore').setAttribute('aria-selected', String(S.mode === 'explore'));
  $('#modeMeal').setAttribute('aria-selected', String(S.mode === 'meal'));
  mealEl.hidden = S.mode !== 'meal';
  for (const id of IDS) {
    const b = listBtn[id];
    b.classList.toggle('sel', S.selected === id);
    b.setAttribute('aria-pressed', String(S.selected === id));
    const st = b.querySelector('.st');
    st.innerHTML = S.removed.has(id) ? '<span class="k">꺼냄</span><span class="e">out</span>' : '';
  }
  renderDetail();
  refreshInspectBar();
  if (S.mode === 'meal') {
    renderMealText();
    const playBtn = $('#mealPlay');
    playBtn.innerHTML = `<svg><use href="#${S.meal.playing ? 'i-pause' : 'i-play'}"/></svg>`;
    playBtn.setAttribute('aria-label', S.meal.playing ? '일시정지 Pause' : S.meal.done ? '다시 보기 Replay' : '재생 Play');
    $('#mealPrev').disabled = S.meal.stage === 0;
    $('#mealNext').disabled = S.meal.stage === STAGES.length - 1;
  }
  const outN = S.removed.size;
  if (!S.opened) {
    hint.innerHTML = bi(S.inc.phase === 'closed'
      ? { kr: '몸이 닫혀 있어요', en: 'The body is closed' }
      : { kr: '절개 중…', en: 'Making the incision…' });
  } else if (S.inspect) {
    hint.innerHTML = bi({ kr: '끌어서 회전 · 휠이나 +/−로 크기 조절 · Esc로 닫기', en: 'Drag to rotate · wheel or +/− to resize · Esc to close' });
  } else if (S.mode === 'meal') {
    hint.innerHTML = bi({ kr: '단계를 눌러 건너뛸 수 있어요', en: 'Tap a stage to jump to it' });
  } else {
    hint.innerHTML = bi({ kr: '장기를 끌어내 보세요 · 빈 곳을 끌면 시점이 돌아가요', en: 'Drag an organ out · drag empty space to look around' });
  }
  readout.dataset.n = outN;
  $('#toolReset').disabled = outN === 0 && S.mode === 'explore';
}

/* =========================================================
   Toolbar
   ========================================================= */
$('#toolLabels').addEventListener('click', (e) => {
  S.labels = !S.labels;
  e.currentTarget.setAttribute('aria-pressed', String(S.labels));
});
$('#toolBody').addEventListener('click', (e) => {
  S.body = !S.body;
  e.currentTarget.setAttribute('aria-pressed', String(S.body));
});
$('#toolReset').addEventListener('click', () => { putAll(); });
$('#toolView').addEventListener('click', () => { S.camYaw = 0; S.camPitch = SURGEON_PITCH; });
$('#incise').addEventListener('click', beginIncision);

/* =========================================================
   Pointer interaction
   ========================================================= */
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const allMeshes = IDS.flatMap((id) => O[id].meshes);
const dropzone = $('#dropzone');

function setNdc(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
}
function pick(e) {
  setNdc(e);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects(allMeshes, false)[0];
  return hit ? hit.object.userData.organId : null;
}
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -1.8);
function pointerWorld(e) {
  setNdc(e);
  raycaster.setFromCamera(ndc, camera);
  const p = new THREE.Vector3();
  return raycaster.ray.intersectPlane(plane, p) ? p : null;
}

let ptr = null;
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || !S.opened) return;
  canvas.setPointerCapture(e.pointerId);
  const id = S.inspect ? null : pick(e);
  ptr = { id, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false };
});
canvas.addEventListener('pointermove', (e) => {
  if (!S.opened) return;
  if (!ptr) {
    if (!S.inspect) {
      const id = pick(e);
      canvas.style.cursor = id ? (S.mode === 'explore' ? 'grab' : 'pointer') : 'default';
      S.hover = id;
    }
    return;
  }
  const dx = e.clientX - ptr.lx, dy = e.clientY - ptr.ly;
  ptr.lx = e.clientX; ptr.ly = e.clientY;
  if (!ptr.moved && Math.hypot(e.clientX - ptr.x, e.clientY - ptr.y) > 6) ptr.moved = true;
  if (!ptr.moved) return;
  if (S.inspect) {
    S.yaw += dx * 0.009;
    S.pitch = clamp(S.pitch + dy * 0.009, -1.45, 1.45);
    S.spin = false;
    refreshInspectBar();
  } else if (ptr.id && S.mode === 'explore') {
    if (S.held !== ptr.id) {
      S.held = ptr.id;
      canvas.style.cursor = 'grabbing';
      app.classList.add('dragging');
      const tp = trayPos(ptr.id);
      const p = project(tp);
      dropzone.style.cssText = `left:${p.x}px;top:${p.y}px;width:${Math.max(64, trayScale(ptr.id) * O[ptr.id].maxDim * (layout.h / 11.9))}px`;
      refreshAll();
    }
    const w = pointerWorld(e);
    if (w) A[ptr.id].heldPos = w;
  } else if (!ptr.id) {
    S.camYaw = clamp(S.camYaw - dx * 0.006, -0.7, 0.7);
    S.camPitch = clamp(S.camPitch + dy * 0.004, -0.3, 0.95);
  }
});
function endPointer(e) {
  if (!ptr) return;
  const p = ptr;
  ptr = null;
  app.classList.remove('dragging');
  if (S.held) {
    const id = S.held;
    S.held = null;
    const home = project(O[id].home);
    const homeR = Math.max(40, O[id].maxDim * (layout.h / 11.9) * 0.5);
    const d = Math.hypot(e.clientX - canvas.getBoundingClientRect().left - home.x, e.clientY - canvas.getBoundingClientRect().top - home.y);
    if (d < homeR + 30) putOrgan(id, !S.removed.has(id)); else removeOrgan(id, S.removed.has(id));
    select(id);
    return;
  }
  if (!p.moved && !S.inspect) {
    if (p.id) select(p.id); else if (S.mode === 'explore') select(null);
  }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('dblclick', (e) => {
  if (S.inspect || !S.opened) return;
  const id = pick(e);
  if (!id) return;
  if (S.removed.has(id)) putOrgan(id); else removeOrgan(id);
  select(id);
});
canvas.addEventListener('wheel', (e) => {
  if (!S.inspect) return;
  e.preventDefault();
  S.zoom = clamp(S.zoom * Math.exp(-e.deltaY * 0.0015), 0.5, 2.6);
}, { passive: false });

document.addEventListener('keydown', (e) => {
  if (e.target.closest?.('input,textarea')) return;
  if (e.key === 'Escape' && S.inspect) { closeInspect(); return; }
  if (!S.inspect) return;
  const k = e.key;
  if (k === 'ArrowLeft') S.yaw -= 0.15;
  else if (k === 'ArrowRight') S.yaw += 0.15;
  else if (k === 'ArrowUp') S.pitch = clamp(S.pitch - 0.12, -1.45, 1.45);
  else if (k === 'ArrowDown') S.pitch = clamp(S.pitch + 0.12, -1.45, 1.45);
  else if (k === '+' || k === '=') S.zoom = clamp(S.zoom * 1.15, 0.5, 2.6);
  else if (k === '-') S.zoom = clamp(S.zoom / 1.15, 0.5, 2.6);
  else return;
  if (k.startsWith('Arrow')) { S.spin = false; refreshInspectBar(); e.preventDefault(); }
});

/* =========================================================
   Frame loop
   ========================================================= */
const _q = new THREE.Quaternion(), _e = new THREE.Euler();
const lerpK = (dt, r) => 1 - Math.exp(-dt * r);

function outlineFor(id) {
  const inMeal = S.mode === 'meal';
  let hl = 0;
  if (S.inspect === id || (S.selected === id && !S.inspect)) hl = 2;
  else if (inMeal && activeSet().has(id) && STAGES[S.meal.stage].organ !== id) hl = 1;
  else if (S.hover === id && !S.inspect) hl = 1;
  if (inMeal && STAGES[S.meal.stage].organ === id) hl = 2;
  return hl;
}

function update(dt) {
  S.time += dt;
  incisionUpdate(dt);
  // camera
  placeCamera();
  const insp = S.inspect ? inspectTarget(S.inspect) : null;
  if (S.inspect && S.spin) S.yaw += dt * 0.55;
  if (S.mode === 'meal') stageUpdate(dt);

  const k = lerpK(dt, 9);
  const meal = S.mode === 'meal' ? activeSet() : null;
  for (const id of IDS) {
    const a = A[id], o = O[id];
    const out = S.removed.has(id);
    if (S.inspect === id) {
      _e.set(S.pitch, S.yaw, 0, 'XYZ');
      a.tquat.setFromEuler(_e);
      a.tpos.copy(insp.pos);
      a.tscale = insp.s;
    } else if (S.held === id && a.heldPos) {
      a.tpos.copy(a.heldPos);
      a.tquat.identity();
      a.tscale = Math.min(1, 2.4 / o.maxDim);
    } else if (out) {
      a.tpos.copy(trayPos(id));
      a.tquat.identity();
      a.tscale = trayScale(id);
    } else {
      a.tpos.copy(o.home);
      a.tquat.identity();
      a.tscale = 1;
    }
    a.pos.lerp(a.tpos, k);
    a.quat.slerp(a.tquat, k);
    a.scale += (a.tscale - a.scale) * k;
    o.group.position.copy(a.pos);
    o.group.quaternion.copy(a.quat);
    o.group.scale.setScalar(a.scale);
    o.ghost.visible = out || S.held === id || S.inspect === id;

    // focus / dimming
    a.tdim = S.inspect ? (S.inspect === id ? 0 : 0.86) : meal ? (meal.has(id) ? 0 : 0.62) : 0;
    a.dim += (a.tdim - a.dim) * lerpK(dt, 8);
    a.hl = outlineFor(id);
    const sh = o.shared;
    const dpr = layout.dpr || 1;
    const line = a.hl === 2 ? CINNABAR : a.hl === 1 ? INDIGO : INK;
    sh.uColor.value.copy(line).lerp(DIM_LINE, a.dim);
    sh.uWidth.value = (a.hl === 2 ? 2.8 : a.hl === 1 ? 2.1 : 1.35) * (1 - a.dim * 0.45) * dpr;
    for (const m of o.meshes) m.material.color.copy(m.userData.baseColor).lerp(PAPER, a.dim);

    // life
    if (id !== 'stomach') o.pulse.scale.set(1, 1, 1);
    else if (S.mode !== 'meal') o.pulse.scale.set(1, 1, 1);
    if (!reduceMotion) {
      if (id === 'heart') {
        const ph = (S.time % 0.85);
        const b = Math.exp(-((ph - 0.08) ** 2) / 0.0016) + 0.7 * Math.exp(-((ph - 0.3) ** 2) / 0.0025);
        const s = 1 + 0.07 * b;
        o.pulse.scale.set(s, s * 1.02, s);
      } else if (id === 'lungs') {
        const s = 1 + 0.022 * Math.sin(S.time * 1.4);
        o.pulse.scale.set(s, s, s);
      }
    }
  }

  // body shell
  const want = S.inspect ? 0.12 : S.body ? 1 : 0;
  bodyUniforms.uFade.value += (want - bodyUniforms.uFade.value) * lerpK(dt, 7);
  // while the skin is still opaque it must hide what is behind it and draw one layer only
  const skinOn = bodyUniforms.uSkin.value > 0.002;
  bodyMat.depthWrite = skinOn;
  bodyMesh.visible = bodyUniforms.uFade.value > 0.01 || skinOn;

  // dial
  dial.visible = !!S.inspect;
  if (S.inspect) {
    const id = S.inspect;
    const R = Math.max(O[id].size.x, O[id].size.z) * 0.5 + 0.2;
    const sc = insp.s;
    dial.position.copy(insp.pos).addScaledVector(camera.up, -(O[id].size.y * 0.5 * sc + 0.12 * sc));
    dial.quaternion.copy(camera.quaternion);
    dial.rotateX(1.05);
    dial.scale.setScalar(R * sc);
    dialSpin.rotation.y = -S.yaw;
    dial.updateMatrixWorld(true);
  }

  updateTags();
  updatePins();
  updateReadout();
}

const _w = new THREE.Vector3(), _n = new THREE.Vector3();
function updatePins() {
  if (!S.inspect || !pinNodes.length) return;
  const o = O[S.inspect];
  o.group.updateMatrixWorld(true);
  const cam = camera.position;
  const sides = [];
  pinNodes.forEach((pn, i) => {
    _w.copy(pn.p.local);
    const dirLocal = pn.p.local.clone().normalize();
    o.group.localToWorld(_w);
    const sp = project(_w);
    const facing = dirLocal.applyQuaternion(o.group.quaternion).dot(_n.copy(cam).sub(_w).normalize());
    const op = clamp((facing + 0.15) / 0.35, 0, 1);
    pn.sp = sp; pn.op = op;
    sides.push({ pn, i });
  });
  const c = project(O[S.inspect].group.position);
  const L = sides.filter((s) => s.pn.sp.x < c.x).sort((a, b) => a.pn.sp.y - b.pn.sp.y);
  const R = sides.filter((s) => s.pn.sp.x >= c.x).sort((a, b) => a.pn.sp.y - b.pn.sp.y);
  const place = (arr, dir) => {
    let prev = 8;
    for (const s of arr) {
      const h = 38;
      s.ty = Math.max(s.pn.sp.y - h / 2, prev);
      prev = s.ty + h + 4;
    }
    let next = layout.h - 70;
    for (let i = arr.length - 1; i >= 0; i--) { arr[i].ty = Math.min(arr[i].ty, next - 38); next = arr[i].ty - 42; }
    for (const s of arr) {
      const pn = s.pn;
      const x = dir < 0 ? Math.max(8, pn.sp.x - 150 - 40) : Math.min(layout.w - 150 - 8, pn.sp.x + 40);
      pn.el.style.opacity = pn.op.toFixed(2);
      pn.el.style.visibility = pn.op < 0.02 ? 'hidden' : 'visible';
      pn.el.style.setProperty('--px', `${pn.sp.x.toFixed(1)}px`);
      pn.el.style.setProperty('--py', `${pn.sp.y.toFixed(1)}px`);
      const lab = pn.el.querySelector('.lab');
      lab.style.transform = `translate(${Math.round(x)}px,${Math.round(s.ty)}px)`;
      lab.style.textAlign = dir < 0 ? 'right' : 'left';
      const ex = dir < 0 ? x + 150 : x;
      const ln = pn.el.querySelector('i');
      ln.style.cssText = `left:${pn.sp.x.toFixed(1)}px;top:${pn.sp.y.toFixed(1)}px`;
      pn.el.style.setProperty('--ex', `${ex.toFixed(1)}px`);
      pn.el.style.setProperty('--ey', `${(s.ty + 19).toFixed(1)}px`);
      const dxl = ex - pn.sp.x, dyl = s.ty + 19 - pn.sp.y;
      const len = Math.hypot(dxl, dyl);
      ln.style.width = `${len.toFixed(1)}px`;
      ln.style.transform = `rotate(${Math.atan2(dyl, dxl).toFixed(4)}rad)`;
    }
  };
  place(L, -1);
  place(R, 1);
}

function updateReadout() {
  if (S.inspect) {
    const deg = ((Math.round((S.yaw * 180) / Math.PI) % 360) + 360) % 360;
    const tilt = Math.round((S.pitch * 180) / Math.PI);
    readout.innerHTML = `<span class="k">회전 ${deg}° · 기울기 ${tilt}° · 크기 ×${S.zoom.toFixed(1)}</span><span class="e">Turn ${deg}° · Tilt ${tilt}° · Size ×${S.zoom.toFixed(1)}</span>`;
  } else if (S.mode === 'explore') {
    readout.innerHTML = `<span class="k">꺼낸 장기 ${S.removed.size} / ${IDS.length}</span><span class="e">Taken out ${S.removed.size} of ${IDS.length}</span>`;
  } else {
    readout.innerHTML = `<span class="k">단계 ${S.meal.stage + 1} / ${STAGES.length}</span><span class="e">Stage ${S.meal.stage + 1} of ${STAGES.length}</span>`;
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

/* =========================================================
   Boot + test hooks
   ========================================================= */
resize();
refreshAll();
measureTags();
if (document.fonts?.ready) document.fonts.ready.then(measureTags);
new ResizeObserver(measureTags).observe(tagsEl);
requestAnimationFrame(frame);

window.__anatomy = {
  openBody: (instant = true) => (instant ? finishIncision() : beginIncision()),
  incise: beginIncision,
  incSeek: (phase, u) => {
    if (phase === 'closed') return;
    S.inc.phase = phase; S.inc.t = u * INC[phase];
    scalpel.visible = phase !== 'fade';
    bodyUniforms.uCut.value = phase === 'cut' ? 0 : 1;
    bodyUniforms.uOpen.value = phase === 'fade' ? 1 : 0;
    incisionUpdate(0);
    refreshAll();
  },
  select, putAll,
  remove: (id) => removeOrgan(id),
  put: (id) => putOrgan(id),
  inspect: openInspect,
  closeInspect,
  setMode,
  mealGoto: (i, p) => mealGoto(i, p),
  mealSeek: (i, u) => { mealGoto(i, false); S.meal.t = u * STAGES[i].dur; },
  mealPlay,
  rotate: (yaw, pitch) => { S.spin = false; S.yaw = yaw; S.pitch = pitch; refreshInspectBar(); },
  zoom: (z) => { S.zoom = z; },
  state: () => ({
    mode: S.mode, camPitch: S.camPitch, opened: S.opened, phase: S.inc.phase, selected: S.selected, inspect: S.inspect, removed: [...S.removed], held: S.held,
    yaw: S.yaw, pitch: S.pitch, zoom: S.zoom, meal: { ...S.meal },
    at: Object.fromEntries(IDS.map((id) => [id, { x: A[id].pos.x, y: A[id].pos.y, z: A[id].pos.z, s: A[id].scale }])),
  }),
  screenPos: (id) => {
    const p = project(A[id].pos);
    const r = canvas.getBoundingClientRect();
    return { x: r.left + p.x, y: r.top + p.y };
  },
  homeScreenPos: (id) => {
    const p = project(O[id].home);
    const r = canvas.getBoundingClientRect();
    return { x: r.left + p.x, y: r.top + p.y };
  },
  bolus: () => ({ visible: bolus.visible, x: bolus.position.x, y: bolus.position.y, z: bolus.position.z }),
};
