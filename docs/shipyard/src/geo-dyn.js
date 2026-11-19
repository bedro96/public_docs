// Parts whose shape changes every frame: water, propeller blades, radar, cranes' hooks. They take (K, P) like the static builders.
// Everything returns path strings or markup built from numbers only, never from user text.

/** water of the dry dock at fill level f (0..1): top surface, front section band and the waterline */
export function dockWater(K, P, dock, floorZ, seaZ, f) {
  if (f < 0.004) return { top: '', band: '', line: '' };
  const z = floorZ + (seaZ - floorZ) * f;
  const q = (pts) => K.pathOf(pts.map((p) => K.iso(p, P)), true);
  return {
    top: q([[dock.x0, dock.y0, z], [dock.x1, dock.y0, z], [dock.x1, dock.y1, z], [dock.x0, dock.y1, z]]),
    band: q([[dock.x0, dock.y1, floorZ], [dock.x1, dock.y1, floorZ], [dock.x1, dock.y1, z], [dock.x0, dock.y1, z]]),
    line: K.pathOf([[dock.x0, dock.y1, z], [dock.x1, dock.y1, z], [dock.x1, dock.y0, z]].map((p) => K.iso(p, P))),
  };
}

/** one blade outline in the blade's own frame: r outward from the hub, s sideways (skewed, thickest at 60% radius) */
const BLADE = [[0.28, -0.1], [0.45, -0.3], [0.7, -0.3], [0.92, -0.12], [1, 0.12], [0.9, 0.3], [0.62, 0.34], [0.36, 0.22], [0.28, 0.1]];

/** the propeller blades at angle theta: front and back copies give them thickness */
export function propeller(K, P, c, R, n, theta) {
  const front = [], back = [];
  for (let k = 0; k < n; k++) {
    const phi = theta + (k * Math.PI * 2) / n;
    const co = Math.cos(phi), si = Math.sin(phi);
    const world = (r, s, dx) => [c[0] + dx + s * R * 0.12, c[1] + R * (r * co - s * 0.5 * si), c[2] + R * (r * si + s * 0.5 * co)];   // small pitch: a larger one makes a blade edge-on (a bare line) in this view
    front.push(K.pathOf(BLADE.map(([r, s]) => K.iso(world(r, s, 0), P)), true));
    back.push(K.pathOf(BLADE.map(([r, s]) => K.iso(world(r, s, -1.4), P)), true));
  }
  return { front, back };
}

/** radar scanner bar and the beam it throws at angle theta */
export function radar(K, P, c, theta, len = 7, beam = 46) {
  const co = Math.cos(theta), si = Math.sin(theta);
  const bar = [[-len, -0.9], [len, -0.9], [len, 0.9], [-len, 0.9]].map(([a, b]) => K.iso([c[0] + a * co - b * si, c[1] + a * si + b * co, c[2]], P));
  const w = 0.13;
  const tip = (a) => K.iso([c[0] + beam * Math.cos(a), c[1] + beam * Math.sin(a), c[2] - 3], P);
  const o = K.iso([c[0], c[1], c[2] - 3], P);
  return { bar: K.pathOf(bar, true), beam: K.pathOf([o, tip(theta - w), tip(theta + w)], true) };
}

/** the cutting portal and torch head, built around the origin; the page moves them */
export function portalParts(T, half = 27) {
  const legs = [-half, half].map((y) => T.box(-1.5, y - 1.5, 0, 3, 3, 14, { cls: 'c-col' }));
  const beam = T.box(-1.8, -half - 1.5, 14, 3.6, 2 * half + 3, 3, { cls: 'c-beam' });
  const head = T.box(-1.6, -1.6, 7, 3.2, 3.2, 7, { cls: 'c-robot' });
  return { fixed: T.svgOf(T.paint([...legs, beam])), head: T.svgOf([head]) };
}

/** the hook block, built around the origin */
export function hookParts(T) {
  return T.svgOf([T.box(-2.6, -2.6, -4, 5.2, 5.2, 4, { cls: 'c-hook' })]);
}
