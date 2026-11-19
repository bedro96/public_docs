// Articulated robots: a base, a shoulder, two links, a wrist and a tool, solved with two-bone inverse kinematics in the vertical
// plane that contains the base and the target. Links are prisms (cheap), joints are small spheres, so rebuilding an arm every
// frame costs about a millisecond.
import { k, G, S, P } from './world.js';

const L1 = 17;
const L2 = 15;
const SHOULDER = 15;

function link(A, B, ht, w, tone = 'hi') {
  // A, B are [rho, z] in the arm plane; the link is a rectangle of half-thickness ht and width w across the plane.
  return (F) => {
    const dx = B[0] - A[0];
    const dz = B[1] - A[1];
    const len = Math.hypot(dx, dz) || 1;
    const nx = (-dz / len) * ht;
    const nz = (dx / len) * ht;
    const ex = (dx / len) * ht * 0.6;
    const ez = (dz / len) * ht * 0.6;
    const poly = [
      [A[0] - ex + nx, A[1] - ez + nz],
      [B[0] + ex + nx, B[1] + ez + nz],
      [B[0] + ex - nx, B[1] + ez - nz],
      [A[0] - ex - nx, A[1] - ez - nz],
    ];
    return S(G.prismOf(F, poly, -w / 2, w / 2, P), { tone, crease: 'faint' });
  };
}

// Draw the movable part of a robot standing at (bx, by) on the floor, reaching for `target` = [x, y, z].
// The arm is built in the plane that holds the base and the target; `lift` raises the whole shoulder (for a pedestal).
export function robotArm(bx, by, target, { pedestal = 0, tool = 'gun', reach = 1 } = {}) {
  const phi = Math.atan2(target[1] - by, target[0] - bx);
  const u = [Math.cos(phi), Math.sin(phi), 0];
  const a = [-Math.sin(phi), Math.cos(phi), 0];
  const F = G.frameOf([bx, by, 0], a, u, [0, 0, 1]);
  const sz = pedestal + SHOULDER + 1;
  const tr = Math.hypot(target[0] - bx, target[1] - by);
  const tz = target[2] - sz;
  // the wrist stops one tool length short of the target so the tool ends exactly on it
  const toolLen = tool === 'gun' ? 6 : 7;
  const dTarget = Math.hypot(tr, tz) || 1;
  const wr = tr - (tr / dTarget) * toolLen;
  const wz = tz - (tz / dTarget) * toolLen;
  const l1 = L1 * reach;
  const l2 = L2 * reach;
  const dd = Math.min(Math.max(Math.hypot(wr, wz), Math.abs(l1 - l2) + 0.5), l1 + l2 - 0.1);
  const base = Math.atan2(wz, wr);
  const bend = Math.acos(Math.max(-1, Math.min(1, (dd * dd + l1 * l1 - l2 * l2) / (2 * dd * l1))));
  const t1 = base + bend; // elbow up
  const E = [Math.cos(t1) * l1, sz + Math.sin(t1) * l1];
  const W = [Math.cos(base) * dd, sz + Math.sin(base) * dd];
  const T = [W[0] + Math.cos(base) * toolLen, W[1] + Math.sin(base) * toolLen];
  const to3 = ([r, z]) => [bx + u[0] * r, by + u[1] * r, z];
  const joint = (p, r, steps = 14) => S(G.sphereOf(to3(p), r, P, { steps }), { tone: 'hi', crease: 'none' });
  return [
    link([0, sz - 1], E, 2.2, 5)(F),
    joint([0, sz], 3.1),
    link(E, W, 1.7, 4)(F),
    joint(E, 2.6),
    joint(W, 1.9, 12),
    link(W, T, tool === 'gun' ? 0.9 : 1.1, tool === 'gun' ? 2.4 : 3)(F),
  ].join('');
}

// static robot pedestal: base plate, column and turret (drawn once into the scene)
export function robotBase(bx, by, { pedestal = 0, id = '' } = {}) {
  const parts = [
    S(k.slabOf({ x: bx - 6, y: by - 6, w: 12, d: 12, r: 1 }, 0, 2, P, 3, 0.4), { tone: 'mid' }),
    pedestal ? S(k.cylinder(bx, by, 3.6, 2, pedestal, P, 16, 0.2), { tone: 'mid' }) : '',
    S(k.cylinder(bx, by, 4.6, 2 + pedestal, SHOULDER - 2, P, 18, 0.3), { tone: 'hi' }),
    S(k.cylinder(bx, by, 3.2, SHOULDER + pedestal, 1.2, P, 16, 0.2), { tone: 'hi' }),
    id ? `<g id="arm-${id}" class="arm"></g>` : '',
  ];
  return parts.join('');
}
