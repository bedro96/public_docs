import * as THREE from 'three';
import { mergeVertices, mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ORGANS } from './data.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const sstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/* ---------- shared look: ink outline + toon pigment ---------- */

export const GLOBAL_UNIFORMS = { uRes: { value: new THREE.Vector2(1, 1) } };

const gradient = (() => {
  const data = new Uint8Array([78, 128, 176, 224, 255]);
  const tex = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
})();

const WAVE_GLSL = `
uniform float uWaveC; uniform float uWaveA;
float waveD(float u) {
  float d = u - uWaveC;
  return uWaveA * (exp(-pow(d / 0.035, 2.0)) - 0.55 * exp(-pow((d + 0.085) / 0.05, 2.0)));
}`;

function patchWave(material, wave) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWaveC = wave.uWaveC;
    shader.uniforms.uWaveA = wave.uWaveA;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${WAVE_GLSL}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normal * waveD(uv.x);');
  };
}

const HULL_VERT = `
uniform vec2 uRes; uniform float uWidth;
${WAVE_GLSL}
void main() {
  vec3 p = position + normal * waveD(uv.x);
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  vec3 nv = normalize(normalMatrix * normal);
  vec2 nc = (projectionMatrix * vec4(nv, 0.0)).xy;
  nc = length(nc) > 1e-5 ? normalize(nc) : vec2(0.0);
  clip.xy += nc * uWidth * 2.0 / uRes * clip.w;
  gl_Position = clip;
}`;
const HULL_FRAG = `
uniform vec3 uColor; uniform float uStipple; uniform float uAlpha;
void main() {
  if (uStipple > 0.5 && mod(floor(gl_FragCoord.x + gl_FragCoord.y), 9.0) < 5.0) discard;
  gl_FragColor = vec4(uColor, uAlpha);
}`;

export function makeHullMaterial(shared, wave, { stipple = false } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uRes: GLOBAL_UNIFORMS.uRes,
      uWidth: shared.uWidth,
      uColor: shared.uColor,
      uWaveC: wave.uWaveC,
      uWaveA: wave.uWaveA,
      uStipple: { value: stipple ? 1 : 0 },
      uAlpha: stipple ? shared.uGhostAlpha : { value: 1 },
    },
    vertexShader: HULL_VERT,
    fragmentShader: HULL_FRAG,
    side: THREE.BackSide,
    transparent: stipple,
    depthWrite: !stipple,
  });
}

/* ---------- geometry helpers ---------- */

function hash3(i, j, k) {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
    l(l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v),
    w,
  );
}

// Smooth closed surface from the unit sphere: `deform` receives and edits a unit-sphere vector.
function blob(deform, detail = 26) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-4);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    deform(v);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
const ellipsoid = (rx, ry, rz, extra, detail) =>
  blob((v) => {
    v.set(v.x * rx, v.y * ry, v.z * rz);
    if (extra) extra(v);
  }, detail);

// Tube with varying radius. uv.x = arc-length fraction (used by the peristalsis wave).
function varTube(curve, radiusFn, { segs, radial = 22, capStart = true, capEnd = true } = {}) {
  const L = curve.getLength();
  segs = segs || Math.max(40, Math.round(L * 26));
  const frames = curve.computeFrenetFrames(segs, false);
  const r0 = radiusFn(0), r1 = radiusFn(1);
  const rr = (t) => {
    let c = 1;
    if (capStart) {
      const e = Math.max(0.004, r0 / L);
      if (t < e) c = Math.sqrt(Math.max(0, 1 - (1 - t / e) ** 2));
    }
    if (capEnd) {
      const e = Math.max(0.004, r1 / L);
      if (t > 1 - e) c = Math.min(c, Math.sqrt(Math.max(0, 1 - (1 - (1 - t) / e) ** 2)));
    }
    return radiusFn(t) * c;
  };
  const pos = [], nor = [], uv = [], idx = [];
  const p = new THREE.Vector3(), dir = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, p);
    const e = 1 / segs;
    const dr = (rr(Math.min(1, t + e * 0.5)) - rr(Math.max(0, t - e * 0.5))) / (e * L);
    const slope = Math.max(-4, Math.min(4, dr));
    const r = rr(t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      dir.copy(frames.normals[i]).multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i], Math.sin(a));
      pos.push(p.x + dir.x * r, p.y + dir.y * r, p.z + dir.z * r);
      n.copy(dir).addScaledVector(frames.tangents[i], -slope).normalize();
      nor.push(n.x, n.y, n.z);
      uv.push(t, j / radial);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j, b = a + radial + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

const curveOf = (pts, closed = false, type = 'centripetal') =>
  new THREE.CatmullRomCurve3(pts.map((p) => V3(...p)), closed, type);

function table(points) {
  return (t) => {
    for (let i = 1; i < points.length; i++) {
      if (t <= points[i][0]) {
        const [t0, v0] = points[i - 1], [t1, v1] = points[i];
        return v0 + (v1 - v0) * sstep(0, 1, (t - t0) / (t1 - t0));
      }
    }
    return points[points.length - 1][1];
  };
}

/* ---------- organ builder ---------- */

class Builder {
  constructor(def) {
    this.def = def;
    this.id = def.id;
    this.root = new THREE.Group(); // body-space contents
    this.meshes = [];
    this.tubes = {}; // name -> { curve, wave }
    this.shared = {
      uWidth: { value: 1.4 },
      uColor: { value: new THREE.Color('#1f2430') },
      uGhostAlpha: { value: 0.5 },
    };
  }
  newWave() {
    return { uWaveC: { value: -5 }, uWaveA: { value: 0 } };
  }
  add(geometry, color, { wave, parent, pos, rot, name, tube } = {}) {
    const material = new THREE.MeshToonMaterial({ color, gradientMap: gradient });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.organId = this.id;
    mesh.userData.baseColor = new THREE.Color(color);
    const w = wave ? this.newWave() : null;
    if (w) patchWave(material, w);
    mesh.userData.wave = w;
    if (pos) mesh.position.set(...pos);
    if (rot) mesh.rotation.set(...rot);
    (parent || this.root).add(mesh);
    this.meshes.push(mesh);
    if (name && tube) this.tubes[name] = { curve: tube, wave: w };
    return mesh;
  }
  tube(name, curve, radiusFn, color, opts = {}) {
    const geo = varTube(curve, radiusFn, opts);
    return this.add(geo, color, { wave: opts.wave !== false, name, tube: curve, parent: opts.parent });
  }

  finalize() {
    // Hull meshes: constant-pixel ink outline, one per mesh.
    const dummyWave = this.newWave();
    for (const mesh of this.meshes) {
      const hull = new THREE.Mesh(mesh.geometry, makeHullMaterial(this.shared, mesh.userData.wave || dummyWave));
      hull.raycast = () => {};
      hull.userData.isHull = true;
      mesh.add(hull);
    }
    const box = new THREE.Box3().setFromObject(this.root);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    const group = new THREE.Group(); // animated: position / quaternion / scale
    const pulse = new THREE.Group(); // beat / churn
    this.root.position.sub(center);
    pulse.add(this.root);
    group.add(pulse);
    group.position.copy(center);
    group.userData.organId = this.id;

    // Ghost: stippled outline left in the body when the organ is removed.
    const ghost = new THREE.Group();
    ghost.position.copy(center);
    const ghostFill = new THREE.MeshBasicMaterial({ color: '#2d4c7e', transparent: true, opacity: 0.06, depthWrite: false });
    // Dotted silhouette only (rim of the surface), so the empty cavity reads as an outline and not as hatching.
    const ghostRimMaterial = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color('#2d4c7e') } },
      transparent: true,
      depthWrite: false,
      vertexShader: `varying vec3 vN; varying vec3 vV;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uColor; varying vec3 vN; varying vec3 vV;
        void main(){
          float d = 1.0 - abs(dot(normalize(vN), normalize(vV)));
          float rim = smoothstep(0.62, 0.82, d);
          if (rim < 0.05 || mod(floor(gl_FragCoord.x + gl_FragCoord.y), 8.0) < 4.0) discard;
          gl_FragColor = vec4(uColor, 0.85 * rim);
        }`,
    });
    const ghostRoot = new THREE.Group();
    ghostRoot.position.copy(this.root.position);
    ghost.add(ghostRoot);
    for (const mesh of this.meshes) {
      const holder = new THREE.Group();
      mesh.updateWorldMatrix(true, false);
      // replicate the mesh's transform relative to the organ root
      const rel = new THREE.Matrix4().copy(this.root.matrixWorld).invert().multiply(mesh.matrixWorld);
      rel.decompose(holder.position, holder.quaternion, holder.scale);
      const fill = new THREE.Mesh(mesh.geometry, ghostFill);
      fill.raycast = () => {};
      const hull = new THREE.Mesh(mesh.geometry, ghostRimMaterial);
      hull.raycast = () => {};
      holder.add(fill, hull);
      ghostRoot.add(holder);
    }
    ghost.visible = false;

    const pins = (this.def.pins || []).map((p) => ({
      kr: p.kr, en: p.en,
      local: V3(...p.p).sub(center),
    }));

    return {
      id: this.id,
      def: this.def,
      group, pulse, ghost,
      home: center.clone(),
      size,
      maxDim: Math.max(size.x, size.y, size.z),
      meshes: this.meshes,
      tubes: this.tubes,
      shared: this.shared,
      pins,
      extra: this.extra || {},
    };
  }
}

const def = (id) => ORGANS.find((o) => o.id === id);

/* ---------- individual organs ---------- */

function buildHeart() {
  const b = new Builder(def('heart'));
  const H = [0.3, 3.55, 0.3];
  const ventricles = blob((v) => {
    const { x, y, z } = v;
    const down = sstep(-0.15, 1.0, -y);
    let X = x * (1 - 0.78 * down) * 0.52;
    let Y = y * 0.66;
    const Z = z * (1 - 0.7 * down) * 0.42;
    X += 0.36 * down * down;
    Y -= 0.1 * sstep(0.25, 0.95, y) * Math.exp(-((x / 0.26) ** 2));
    v.set(X, Y, Z);
  }, 30);
  b.add(ventricles, '#b8433a', { pos: H });
  b.add(ellipsoid(0.23, 0.26, 0.22), '#a83c35', { pos: [-0.13, 3.98, 0.33] });
  b.add(ellipsoid(0.17, 0.21, 0.15), '#a83c35', { pos: [0.56, 4.02, 0.5] });
  b.tube('aorta', curveOf([[0.16, 4.0, 0.28], [0.16, 4.45, 0.3], [0.3, 4.72, 0.2], [0.52, 4.66, 0.05], [0.57, 4.3, -0.1], [0.52, 3.9, -0.15]]),
    () => 0.14, '#d2503f', { wave: false });
  b.tube('vcava', curveOf([[-0.14, 3.95, 0.22], [-0.2, 4.4, 0.18], [-0.2, 4.95, 0.14]]), () => 0.1, '#4a6aa3', { wave: false });
  b.tube('pulm', curveOf([[0.3, 3.98, 0.5], [0.46, 4.3, 0.48], [0.34, 4.58, 0.36]]), () => 0.115, '#5b78ad', { wave: false });
  b.extra = { beats: true };
  return b.finalize();
}

function lungGeo(side) {
  return blob((v) => {
    const { x, y, z } = v;
    let xm = -side * x * 0.68; // medial positive
    let Y = y * 1.12, Z = z * 0.82;
    const up = sstep(0, 1, y);
    xm *= 1 - 0.34 * up;
    Z *= 1 - 0.25 * up;
    const base = sstep(-0.45, -1, y);
    Y += base * 0.34 * (1 - Math.min(1, x * x + z * z));
    if (xm > 0) xm *= 0.7;
    if (side > 0) xm -= 0.4 * Math.exp(-(((Y + 0.35) / 0.4) ** 2)) * sstep(0, 0.5, xm); // cardiac notch
    const lateralFlat = side * 0;
    let X = -side * xm + lateralFlat;
    // fissures: oblique (both) and horizontal (right lung)
    const d = 0.76 * y + 0.65 * z;
    let g = Math.exp(-((d / 0.07) ** 2));
    if (side < 0) g = Math.max(g, Math.exp(-(((y - 0.22) / 0.06) ** 2)) * sstep(0.05, 0.45, z));
    const k = 1 - 0.06 * g;
    v.set(X * k, Y * k, Z * k);
  }, 30);
}

function buildLungs() {
  const b = new Builder(def('lungs'));
  b.add(lungGeo(-1), '#d7a5a0', { pos: [-1.1, 4.1, 0.12] });
  b.add(lungGeo(1), '#d7a5a0', { pos: [1.2, 4.1, 0.12] });
  const L = 1.2;
  b.tube('trachea', curveOf([[0, 5.95, 0.27], [0, 4.78, 0.27]]),
    (t) => 0.125 * (1 + 0.06 * Math.sin(t * L * 26)), '#b3c1cc', { wave: false });
  b.tube('bronchR', curveOf([[0, 4.8, 0.27], [-0.35, 4.58, 0.25], [-0.75, 4.35, 0.2]]), () => 0.085, '#b3c1cc', { wave: false });
  b.tube('bronchL', curveOf([[0, 4.8, 0.27], [0.32, 4.56, 0.25], [0.8, 4.3, 0.2]]), () => 0.085, '#b3c1cc', { wave: false });
  return b.finalize();
}

function buildLiver() {
  const b = new Builder(def('liver'));
  const geo = blob((v) => {
    const { x, y, z } = v;
    const taper = 1 - 0.78 * sstep(0.05, 1.0, x);
    let X = x * (x < 0 ? 1.22 : 1.35);
    let Y = y * 0.6 * taper;
    let Z = z * 0.72 * taper;
    if (y < 0) Y *= 0.8;
    Y += 0.13 * Math.exp(-(((X + 0.55) / 0.35) ** 2)) * sstep(0, -1, y) * 0.9; // gallbladder fossa
    const g = Math.exp(-(((X - 0.3) / 0.05) ** 2)) * sstep(0, 0.4, z) * sstep(-0.2, 0.5, y);
    const k = 1 - 0.07 * g;
    v.set(X * k, Y * k, Z * k);
  }, 30);
  b.add(geo, '#8a4636', { pos: [-0.6, 2.62, 0.15], rot: [0, 0, 0.1] });
  return b.finalize();
}

function buildGallbladder() {
  const b = new Builder(def('gallbladder'));
  const geo = blob((v) => {
    const t = (v.y + 1) / 2;
    const f = 0.2 * (1 - 0.66 * sstep(0.3, 1, t));
    v.set(v.x * f, v.y * 0.38, v.z * f);
  }, 22);
  b.add(geo, '#5f9467', { pos: [-1.15, 1.95, 0.55], rot: [0, 0, 3.785] });
  b.tube('duct', curveOf([[-0.92, 1.65, 0.55], [-0.78, 1.5, 0.4], [-0.62, 1.4, 0.25], [-0.74, 1.42, 0.16]]),
    () => 0.036, '#4b7a52', { wave: false });
  return b.finalize();
}

function buildStomach() {
  const b = new Builder(def('stomach'));
  const curve = curveOf([[0.7, 2.86, 0.18], [0.92, 2.5, 0.22], [1.0, 2.05, 0.28], [0.82, 1.7, 0.32], [0.45, 1.56, 0.33], [0.1, 1.68, 0.32], [-0.25, 1.75, 0.3]]);
  const r = table([[0, 0.3], [0.18, 0.42], [0.5, 0.46], [0.72, 0.36], [0.88, 0.2], [0.94, 0.17], [1, 0.15]]);
  b.tube('stomach', curve, r, '#e0a07f', { radial: 30, wave: false });
  b.extra = { churn: true };
  return b.finalize();
}

function buildPancreas() {
  const b = new Builder(def('pancreas'));
  const curve = curveOf([[-0.5, 1.28, 0.04], [-0.12, 1.5, -0.02], [0.4, 1.62, -0.08], [0.9, 1.86, -0.1], [1.2, 2.16, -0.15]]);
  const r = table([[0, 0.27], [0.25, 0.21], [0.6, 0.17], [1, 0.12]]);
  b.tube('pancreas', curve, (t) => r(t) * (1 + 0.13 * Math.sin(t * 46) + 0.08 * Math.sin(t * 19 + 1)), '#d9b25a', { radial: 24, wave: false });
  return b.finalize();
}

function buildSpleen() {
  const b = new Builder(def('spleen'));
  const geo = ellipsoid(0.26, 0.5, 0.22, (v) => {
    v.x -= 0.06 * Math.exp(-((v.y / 0.3) ** 2)) * (v.x > 0 ? 1 : 0);
  });
  b.add(geo, '#774a69', { pos: [1.22, 2.35, -0.35], rot: [0, 0, -0.28] });
  return b.finalize();
}

function buildEsophagus() {
  const b = new Builder(def('esophagus'));
  const curve = curveOf([[0, 6.92, 0.12], [0, 6.2, 0.1], [0, 5.5, 0.04], [0, 4.7, -0.02], [0.1, 3.9, -0.04], [0.28, 3.25, 0.04], [0.42, 2.82, 0.2]]);
  const r = table([[0, 0.24], [0.07, 0.15], [0.14, 0.112], [0.92, 0.112], [1, 0.14]]);
  b.tube('esophagus', curve, r, '#c97a68', { radial: 20 });
  return b.finalize();
}

function buildSmallIntestine() {
  const b = new Builder(def('smallint'));
  // duodenum C-loop, then six alternating rows, then the ileum entering the cecum
  const pts = [
    [-0.25, 1.75, 0.3], [-0.6, 1.7, 0.25], [-0.78, 1.4, 0.15], [-0.62, 1.05, 0.1], [-0.25, 0.92, 0.15], [0.05, 0.82, 0.2],
  ];
  const rows = 6;
  for (let i = 0; i < rows; i++) {
    const y = 0.68 - i * 0.16;
    const dirn = i % 2 === 0 ? 1 : -1;
    const half = 0.66 + 0.12 * noise3(i * 1.7, 3, 9);
    const n = 5;
    for (let k = 0; k < n; k++) {
      const u = k / (n - 1);
      const x = dirn * (-half + 2 * half * u);
      const yy = y + 0.045 * Math.sin(u * Math.PI * 2 + i) + 0.02 * (noise3(i, k, 4) - 0.5);
      const z = 0.22 + 0.06 * Math.sin(i * 1.3 + k) + 0.02 * (noise3(k, i, 2) - 0.5);
      pts.push([x, yy, z]);
    }
  }
  pts.push([-0.86, -0.1, 0.3], [-0.95, -0.04, 0.3]);
  const curve = curveOf(pts);
  const r = table([[0, 0.1], [0.1, 0.088], [1, 0.082]]);
  b.tube('smallint', curve, r, '#e8aa9c', { radial: 14, segs: Math.round(curve.getLength() * 34) });
  return b.finalize();
}

function buildColon() {
  const b = new Builder(def('colon'));
  const main = curveOf([
    [-1.05, -0.3, 0.3], [-1.08, 0.1, 0.34], [-1.1, 0.6, 0.36], [-1.06, 1.0, 0.38], [-0.9, 1.14, 0.42], [-0.5, 1.03, 0.47],
    [0, 0.95, 0.49], [0.5, 1.03, 0.47], [0.9, 1.15, 0.4], [1.13, 1.0, 0.3], [1.16, 0.55, 0.25], [1.12, 0.05, 0.22],
    [1.05, -0.3, 0.2], [0.8, -0.52, 0.25], [0.5, -0.42, 0.28], [0.3, -0.56, 0.2], [0.1, -0.46, 0.12], [0.0, -0.62, 0.05],
  ]);
  const L = main.getLength();
  const haustra = (s) => 1 + 0.1 * Math.cos((s * L * Math.PI * 2) / 0.46);
  b.tube('colon', main, (t) => (0.19 + 0.04 * (1 - sstep(0, 0.07, t))) * haustra(t), '#c98d78', { radial: 22, capEnd: false });
  const tail = main.getTangentAt(1);
  const rect = new THREE.CatmullRomCurve3([
    main.getPointAt(1),
    main.getPointAt(1).clone().addScaledVector(tail, 0.12),
    V3(0, -0.88, -0.05), V3(0, -1.08, -0.14),
  ], false, 'centripetal');
  b.tube('rectum', rect, (t) => 0.19 * (1 + 0.06 * Math.sin(t * 3)) * (1 - 0.35 * sstep(0.75, 1, t)), '#c3806c', { radial: 22, capStart: false });
  // appendix
  b.add(varTube(curveOf([[-1.1, -0.36, 0.34], [-1.0, -0.55, 0.38], [-0.86, -0.66, 0.4], [-0.76, -0.56, 0.42]]), () => 0.04, { radial: 10 }), '#d8a28d');
  return b.finalize();
}

function buildMouth() {
  const b = new Builder(def('mouth'));
  const toothBase = blob((v) => {
    const f = (c) => Math.sign(c) * Math.pow(Math.abs(c), 0.55);
    v.set(f(v.x) * 0.045, f(v.y) * 0.075, f(v.z) * 0.04);
  }, 7);
  const archGeo = (y, flip) => {
    const parts = [];
    const n = 14;
    for (let i = 0; i < n; i++) {
      const th = (-1 + (2 * (i + 0.5)) / n) * 1.45;
      const a = 0.42, bb = 0.55, zc = 0.38;
      const x = a * Math.sin(th), z = zc + bb * Math.cos(th);
      const g = toothBase.clone();
      const m = new THREE.Matrix4().compose(
        V3(x, y + (flip ? 0.0 : 0.0), z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, th * 0.9, 0)),
        V3(1 + 0.25 * Math.cos(th * 1.5) * (i % 7 === 0 ? 0 : 1), flip ? 0.9 : 1.0, 1),
      );
      g.applyMatrix4(m);
      parts.push(g);
    }
    return mergeGeometries(parts.map((p) => { p.deleteAttribute('uv'); return p; }));
  };
  const gumCurve = (y) => {
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const th = (-1 + (2 * i) / 14) * 1.45;
      pts.push([0.42 * Math.sin(th) * 1.02, y, 0.38 + 0.55 * Math.cos(th) * 1.02 - 0.0]);
    }
    return curveOf(pts);
  };
  // upper arch (fixed)
  b.add(archGeo(7.13, false), '#efe9d8');
  b.add(varTube(gumCurve(7.2), () => 0.06, { radial: 10 }), '#cf6b6b');
  // jaw: lower arch + gum + tongue, hinged at the back so it can chew
  const pivot = V3(0, 7.0, -0.2);
  const jaw = new THREE.Group();
  jaw.position.copy(pivot);
  b.root.add(jaw);
  const lowerTeeth = archGeo(6.86, true);
  lowerTeeth.translate(-pivot.x, -pivot.y, -pivot.z);
  b.add(lowerTeeth, '#efe9d8', { parent: jaw });
  const lg = varTube(gumCurve(6.79), () => 0.06, { radial: 10 });
  lg.translate(-pivot.x, -pivot.y, -pivot.z);
  b.add(lg, '#cf6b6b', { parent: jaw });
  const tongue = ellipsoid(0.28, 0.095, 0.44, (v) => {
    v.x *= 1 - 0.35 * sstep(0.1, 1, v.z);
    v.y += 0.03 * Math.exp(-((v.x / 0.04) ** 2));
  }, 18);
  b.add(tongue, '#d6686f', { parent: jaw, pos: [0, 6.93 - pivot.y, 0.5 - pivot.z] });
  // salivary glands
  const gland = (rx, ry, rz) => ellipsoid(rx, ry, rz, (v) => { v.x += 0.02 * (noise3(v.x * 5, v.y * 5, v.z * 5) - 0.5); }, 14);
  for (const s of [-1, 1]) {
    b.add(gland(0.14, 0.26, 0.2), '#e0bd7f', { pos: [s * 0.78, 7.0, -0.1] });
    b.add(gland(0.2, 0.12, 0.2), '#e0bd7f', { pos: [s * 0.5, 6.64, 0.1] });
    b.add(gland(0.09, 0.07, 0.15), '#e0bd7f', { pos: [s * 0.22, 6.78, 0.62] });
  }
  b.extra = { jaw, pivot };
  const o = b.finalize();
  return o;
}

export function buildOrgans() {
  const list = [
    buildMouth(), buildEsophagus(), buildStomach(), buildSmallIntestine(), buildColon(),
    buildLiver(), buildGallbladder(), buildPancreas(), buildSpleen(), buildHeart(), buildLungs(),
  ];
  return Object.fromEntries(list.map((o) => [o.id, o]));
}

// Short curves along which bile / pancreatic juice particles drift towards the duodenum.
export function juiceRoutes() {
  return {
    liver: { color: '#98b04a', curve: curveOf([[-0.7, 2.2, 0.3], [-0.78, 1.9, 0.32], [-0.72, 1.6, 0.25], [-0.76, 1.42, 0.17]]) },
    gallbladder: { color: '#6f9f4a', curve: curveOf([[-0.92, 1.65, 0.55], [-0.78, 1.5, 0.4], [-0.62, 1.4, 0.25], [-0.74, 1.42, 0.16]]) },
    pancreas: { color: '#e6c65a', curve: curveOf([[-0.35, 1.3, 0.06], [-0.5, 1.34, 0.1], [-0.66, 1.4, 0.14], [-0.76, 1.42, 0.16]]) },
  };
}
