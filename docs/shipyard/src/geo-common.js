// Geometry helpers shared by the yard and the vessel. They take the kit (K) and a projection (P)
// so the same code runs in Node (static figure) and in the page (parts that are rebuilt every frame).

/** a thing the sorter can place: svg markup + an axis aligned box [x0,x1,y0,y1,z0,z1] */
const part = (svg, bb, extra = {}) => ({ svg, bb, ...extra });

export function tools(K, P) {
  const tone = (o) => ({ tone: o.tone || 'hi', crease: o.crease || 'faint', lit: o.lit, flat: o.flat, className: o.cls, halo: o.halo });

  /** axis aligned box */
  const box = (x, y, z, w, d, h, o = {}) =>
    part(K.solidSvg(K.slabOf({ x, y, w, d, r: o.r || 0 }, z, h, P, 5, o.bevel || 0), tone(o)), [x, x + w, y, y + d, z, z + h], o);

  /** vertical cylinder */
  const post = (cx, cy, z, h, r, o = {}) =>
    part(K.solidSvg(K.cylinder(cx, cy, r, z, h, P, o.steps || 14, o.bevel || 0), tone(o)), [cx - r, cx + r, cy - r, cy + r, z, z + h], o);

  /** vertical prism over any ring of [x,y] points */
  const prism = (ringPts, z, h, o = {}) => {
    const xs = ringPts.map((p) => p[0]), ys = ringPts.map((p) => p[1]);
    return part(K.solidSvg(K.extrude(ringPts, z, h, P, { convex: o.convex ?? true, bevel: o.bevel || 0 }), tone(o)),
      [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys), z, z + h], o);
  };

  /** a polyline in 3D (points are [x,y,z]) */
  const line = (pts, o = {}) => {
    const d = K.pathOf(pts.map((p) => K.iso(p, P)));
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), zs = pts.map((p) => p[2]);
    return part(K.lineSvg(d, { tone: o.tone || 'mid', dashed: o.dashed, dotted: o.dotted, flow: o.flow, className: o.cls }),
      [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys), Math.min(...zs), Math.max(...zs)], { ...o, line: true });
  };

  /** closed polygon outline flat on a plane z (a painted marking, a footprint) */
  const mark = (ringPts, z, o = {}) => {
    const d = K.onTop(ringPts, z, P, true);
    const xs = ringPts.map((p) => p[0]), ys = ringPts.map((p) => p[1]);
    return part(K.lineSvg(d, { tone: o.tone || 'lo', dashed: o.dashed, className: o.cls }), [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys), z, z], { ...o, line: true });
  };

  /** a flat filled polygon lying on plane z (a road, a pad, water top) */
  const flatPoly = (ringPts, z, o = {}) => {
    const pts = ringPts.map(([x, y]) => K.iso([x, y, z], P));
    const d = K.pathOf(pts, true);
    const xs = ringPts.map((p) => p[0]), ys = ringPts.map((p) => p[1]);
    return part(`<g class="${o.cls || 'iso-solid'}"><path class="iso-fill" d="${d}"/><path class="iso-top" d="${d}"/><path class="iso-line iso-edge" data-tone="${o.tone || 'faint'}" d="${d}"/></g>`,
      [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys), z, z + 0.01], o);
  };

  /**
   * a horizontal cylinder along the x or y axis; centre c = [x,y,z], radius r, length len.
   * Drawn like the kit's extrusions: facets bucketed by light, silhouette on the outside, the near cap on top.
   */
  const hcyl = (axis, c, r, len, o = {}) => {
    const A = axis === 'x' ? 0 : 1;
    const n = o.steps || 20;
    const ringAt = (a) => Array.from({ length: n }, (_, i) => {
      const t = (i / n) * Math.PI * 2;
      const u = r * Math.cos(t), v = r * Math.sin(t);
      return A === 0 ? [c[0] + a, c[1] + u, c[2] + v] : [c[0] + u, c[1] + a, c[2] + v];
    });
    const a0 = -len / 2, a1 = len / 2;
    const r0 = ringAt(a0).map((p) => K.iso(p, P)), r1 = ringAt(a1).map((p) => K.iso(p, P));
    const cam = K.towardViewer(P);          // [cosA, sinA]
    const buckets = [[], [], [], []];
    const all = [...r0, ...r1];
    for (let i = 0; i < n; i++) {
      const t = ((i + 0.5) / n) * Math.PI * 2;
      const nrm = A === 0 ? [0, Math.cos(t), Math.sin(t)] : [Math.cos(t), 0, Math.sin(t)];
      const facing = nrm[0] * cam[0] + nrm[1] * cam[1] + 0.5 * nrm[2] > 0.02;
      if (!facing) continue;
      const lit = (nrm[2] * 0.7 + (A === 0 ? -nrm[1] : nrm[0]) * 0.55 + 1) / 2;
      const b = Math.min(3, Math.max(0, Math.floor(lit * 4)));
      const j = (i + 1) % n;
      buckets[b].push(K.pathOf([r0[i], r0[j], r1[j], r1[i]], true));
    }
    // the cap that faces the viewer is the one at +a on both axes
    const capPts = r1;
    const cap = K.pathOf(capPts, true);
    const hull = hullOf(all);
    const fill = K.pathOf(hull, true);
    const klass = o.cls ? `iso-solid ${o.cls}` : 'iso-solid';
    const shades = buckets.map((d, i) => (d.length ? `<path class="iso-shade" data-shade="${i}" d="${d.join('')}"/>` : '')).join('');
    const svg = `<g class="${klass}"${o.lit ? ' data-lit' : ''}><path class="iso-fill" d="${fill}"/>${shades}<path class="iso-top" d="${cap}"/><path class="iso-line iso-crease" data-tone="${o.crease || 'faint'}" d="${cap}"/><path class="iso-line iso-edge" data-tone="${o.tone || 'hi'}" d="${fill}"/></g>`;
    const bb = A === 0 ? [c[0] - len / 2, c[0] + len / 2, c[1] - r, c[1] + r, c[2] - r, c[2] + r] : [c[0] - r, c[0] + r, c[1] - len / 2, c[1] + len / 2, c[2] - r, c[2] + r];
    return part(svg, bb, o);
  };

  const hullOf = (points) => {
    const s = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const p of s) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = s.length - 1; i >= 0; i--) { const p = s[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    return [...lo.slice(0, -1), ...up.slice(0, -1)];
  };

  /** painter's sort of axis aligned parts: far to near. Pairs that cannot be separated fall back to depth. */
  const paint = (parts) => {
    const E = 0.05;
    const n = parts.length;
    const sep = (a, b) => (a.bb[1] <= b.bb[0] + E) || (a.bb[3] <= b.bb[2] + E) || (a.bb[5] <= b.bb[4] + E);
    const out = Array.from({ length: n }, () => []), need = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const A = parts[i], B = parts[j];
        if (A.line && B.line) continue;
        const ab = sep(A, B), ba = sep(B, A);
        if (ab && !ba) { out[i].push(j); need[j]++; }
        else if (ba && !ab) { out[j].push(i); need[i]++; }
      }
    }
    const depth = parts.map((p) => K.depthOf([(p.bb[0] + p.bb[1]) / 2, (p.bb[2] + p.bb[3]) / 2, (p.bb[4] + p.bb[5]) / 2], P) + (p.bias || 0));
    const done = new Array(n).fill(false), order = [];
    for (let k = 0; k < n; k++) {
      let pick = -1;
      for (let i = 0; i < n; i++) if (!done[i] && need[i] === 0 && (pick < 0 || depth[i] < depth[pick])) pick = i;
      if (pick < 0) for (let i = 0; i < n; i++) if (!done[i] && (pick < 0 || depth[i] < depth[pick])) pick = i;
      done[pick] = true; order.push(parts[pick]);
      for (const j of out[pick]) need[j]--;
    }
    return order;
  };

  const svgOf = (parts) => parts.map((p) => p.svg).join('');
  /** wrap markup in a group with attributes */
  const g = (inner, attrs = {}) => `<g${Object.entries(attrs).filter(([, v]) => v !== undefined && v !== false).map(([k, v]) => ` ${k}="${String(v).replace(/"/g, '&quot;')}"`).join('')}>${Array.isArray(inner) ? inner.join('') : inner}</g>`;
  /** bounding box of parts in world coordinates, as screen-space [x0,y0,x1,y1] */
  const screenBox = (parts) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of parts) {
      for (const x of [p.bb[0], p.bb[1]]) for (const y of [p.bb[2], p.bb[3]]) for (const z of [p.bb[4], p.bb[5]]) {
        const [sx, sy] = K.iso([x, y, z], P);
        x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
      }
    }
    return [x0, y0, x1, y1];
  };
  const worldBox = (parts) => parts.reduce((a, p) => [Math.min(a[0], p.bb[0]), Math.max(a[1], p.bb[1]), Math.min(a[2], p.bb[2]), Math.max(a[3], p.bb[3]), Math.min(a[4], p.bb[4]), Math.max(a[5], p.bb[5])], [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity]);

  return { box, post, prism, line, mark, flatPoly, hcyl, paint, svgOf, g, screenBox, worldBox, hullOf, part };
}

/** hull half-breadth (0..1) at fraction t along the ship: round stern, parallel body, pointed bow */
export function halfBreadth(t) {
  if (t < 0.05) return 0.62 + 0.38 * Math.sin((t / 0.05) * Math.PI / 2);
  if (t < 0.78) return 1;
  const s = (t - 0.78) / 0.22;
  return Math.max(0.04, Math.cos(s * Math.PI / 2) ** 0.8);
}

/** plan ring (x,y) of the hull between x=a..b (fractions along L), half beam hb about y=cy */
export function hullRing(L, hb, cy, a, b, steps = 6) {
  const xs = [];
  for (let i = 0; i <= steps; i++) xs.push(a + ((b - a) * i) / steps);
  const side = xs.map((t) => [t * L, cy + hb * halfBreadth(t)]);
  const other = xs.slice().reverse().map((t) => [t * L, cy - hb * halfBreadth(t)]);
  return [...side, ...other];
}
