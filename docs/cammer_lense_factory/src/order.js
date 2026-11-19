// Painter's-order sorting of axis-aligned boxes (pure: no kit, no DOM). Shared by the plant (world.js) and the loupe (parts.js).
// A is drawn before B when a separating plane puts A behind B for a viewer at +x, +y, +z.
// Where the axes disagree (a diagonal neighbour) the centre depth `key` decides; a cycle falls back to `key` too.
const EPS = 0.01;
function before(a, b) {
  // returns -1 if a is behind b, 1 if a is in front of b, 0 if the boxes are not separable
  let votes = 0;
  if (a.x1 <= b.x0 + EPS) votes -= 1;
  else if (b.x1 <= a.x0 + EPS) votes += 1;
  if (a.y1 <= b.y0 + EPS) votes -= 1;
  else if (b.y1 <= a.y0 + EPS) votes += 1;
  if (a.z1 <= b.z0 + EPS) votes -= 1;
  else if (b.z1 <= a.z0 + EPS) votes += 1;
  if (votes < 0) return -1;
  if (votes > 0) return 1;
  return 0;
}
export function order(items) {
  const n = items.length;
  const behind = Array.from({ length: n }, () => new Set()); // behind[j] = items that must come before j
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let r = before(items[i], items[j]);
      if (r === 0) r = items[i].key <= items[j].key ? -1 : 1;
      if (r < 0) behind[j].add(i);
      else behind[i].add(j);
    }
  }
  const out = [];
  const done = new Array(n).fill(false);
  for (let step = 0; step < n; step++) {
    let pick = -1;
    for (let i = 0; i < n; i++) {
      if (done[i]) continue;
      let ready = true;
      for (const j of behind[i]) if (!done[j]) { ready = false; break; }
      if (ready && (pick < 0 || items[i].key < items[pick].key)) pick = i;
    }
    if (pick < 0) { // cycle: take the farthest remaining
      for (let i = 0; i < n; i++) if (!done[i] && (pick < 0 || items[i].key < items[pick].key)) pick = i;
    }
    done[pick] = true;
    out.push(items[pick]);
  }
  return out;
}
