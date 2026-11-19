// The scene: the static world (factory.js) plus the empty groups the live layer moves. Painter order, back to front:
//   static world -> jigs, crates, train -> ghosts -> far-side helpers -> support, shadow -> THE PLANE -> near-side helpers
//   -> front columns -> effects -> overhead crane.
// Everything that moves is a group with an id and a transform; nothing here is redrawn per frame.
import { G, P, at, S, slab, post, polyPath, pathOf } from './world.js';
import { GZ, CRANE_Z, HALL, WING_BAY, SUPPLY, RWY } from './layout.js';
import { takeoffAt } from './takeoff.js';
import { planeSvg } from './plane.js';
import { rAt } from './hull.js';
import { ENG } from './engines.js';
import {
  staticBack, staticFront, ghostDefs, crateGroup, jigSvg, gantryBack, gantryFront, BARRELS,
} from './factory.js';

const Z0 = 1.5;
const TO_T0 = 30; // s after brake release from which the flight path is sampled for the clouds
const mat = (cls, svg) => `<g class="${cls}">${svg}</g>`;
export const SLOTS = 10; // ghost aeroplanes on the line

// ---------- the railcar and locomotive (stage 2): drawn around the car's centre ----------
function trainSvg() {
  const car = [
    slab(-218, -30, 436, 60, 4, 3.4, { r: 2, tone: 'mid' }),
    slab(-218, -30, 8, 60, 7.4, 3, { tone: 'faint', crease: 'none' }),
    slab(210, -30, 8, 60, 7.4, 3, { tone: 'faint', crease: 'none' }),
  ].join('');
  const bogies = [-160, 128].map((x) => slab(x, -24, 32, 48, 1.6, 2.4, { r: 1, tone: 'faint' })).join('');
  const loco = slab(232, -27, 184, 54, 3.4, 22, { r: 5, tone: 'mid' }) + slab(232, -29, 184, 8, 3.4, 22, { r: 2, tone: 'faint', crease: 'none' });
  const cab = slab(350, -25, 62, 50, 25.4, 12, { r: 3, tone: 'mid' });
  const lbogies = [250, 360].map((x) => slab(x, -24, 40, 48, 1.6, 2.4, { r: 1, tone: 'faint' })).join('');
  const coupler = slab(218, -4, 14, 8, 4.5, 2.2, { tone: 'faint', crease: 'none' });
  return `<g id="train" display="none">${mat('m-steel', car + coupler)}${mat('m-dark', bogies + lbogies)}${mat('m-red', loco)}${mat('m-dark', cab)}</g>`;
}

// ---------- the dolly that carries the fuselage through the yard (stage 4), in plane-origin coordinates ----------
const dollySvg = () => `<g id="cart-fus" display="none">${mat('m-steel', slab(40, -28, 310, 56, 3.6, 3.4, { r: 3, tone: 'mid' }))}${mat('m-dark', [60, 290].map((x) => slab(x, -24, 38, 48, 1.6, 2, { r: 1, tone: 'faint' })).join(''))}</g>`;

// saddle blocks under the fuselage, in plane-LOCAL coordinates (they ride with the plane)
const cradleSvg = () => `<g id="cradle" display="none">${mat('m-steel', [95, 300].map((x) => slab(x - 13, -15, 26, 30, -GZ, 14.4, { r: 3, tone: 'mid' })).join(''))}${mat('m-dark', [95, 300].map((x) => slab(x - 11, -13, 22, 26, -GZ + 14.4, 1.2, { r: 2, tone: 'faint', crease: 'none' })).join(''))}</g>`;

// the shadow of the plane on the ground: a flat planform in plane-local coordinates at 0.2 mm above the floor
function shadowSvg() {
  const z = -GZ + 1.8;
  const pt = (x, y) => at(x, y, z);
  const xs = Array.from({ length: 25 }, (_, i) => (395 * i) / 24);
  const side = xs.map((x) => [x, Math.max(2.4, x < 30 ? 2.4 + (rAt(120) - 2.4) * (x / 30) ** 0.6 : rAt(x))]);
  const fus = polyPath([...side.map(([x, r]) => pt(x, r)), ...side.slice().reverse().map(([x, r]) => pt(x, -r))]);
  const wing = (s) => polyPath([[252, 18 * s], [169, 179 * s], [155, 179 * s], [183, 18 * s]].map(([x, y]) => pt(x, y)));
  const stab = (s) => polyPath([[60, 10 * s], [19, 72 * s], [12, 72 * s], [14, 10 * s]].map(([x, y]) => pt(x, y)));
  const eng = (s) => polyPath([[ENG.x0 - 2, s * ENG.y - 10], [ENG.x0 + ENG.len + 2, s * ENG.y - 10], [ENG.x0 + ENG.len + 2, s * ENG.y + 10], [ENG.x0 - 2, s * ENG.y + 10]].map(([x, y]) => pt(x, y)));
  return `<g id="shadow" display="none" opacity="1"><path class="shadow" d="${fus}${wing(1)}${wing(-1)}${stab(1)}${stab(-1)}${eng(1)}${eng(-1)}"/></g>`;
}

// ---------- jacks, fuel truck, conveyor, engine carts ----------
const jackHost = (id) => `<g id="${id}" class="m-steel" display="none"></g>`;

const fuelTruckSvg = () => `<g id="fuel" display="none">${mat('m-dark', slab(-58, -13, 130, 26, 3, 3.6, { r: 2, tone: 'faint' }) + [-36, 44, 62].map((x) => [-1, 1].map((s) => slab(x - 6, s * 12 - 2, 12, 4, 1.6, 4, { r: 1, tone: 'faint', crease: 'none' })).join('')).join(''))}` +
  `${mat('m-steel', slab(-56, -13, 98, 26, 6.6, 20, { r: 11, tone: 'mid', steps: 5 }))}${mat('m-red', slab(46, -12.5, 24, 25, 6.6, 17, { r: 3, tone: 'mid' }))}` +
  `${mat('m-dark', slab(60, -12, 8, 24, 17, 5, { r: 1, tone: 'faint', crease: 'none' }))}<path id="hose" class="hose" d=""/></g>`;

const conveyorSvg = () => `<g id="conv" display="none">${mat('m-yellow', S(G.prismOf(G.frameOf([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]), [[18, 22], [18, 24.5], [110, 24.5], [330, 8], [330, 5]], 296, 320, P), { tone: 'mid', crease: 'faint' }))}` +
  `${mat('m-steel', [60, 180, 290].map((y) => post(308, y, 1.6, Z0, y < 120 ? 22 : y < 200 ? 15 : 6, { tone: 'faint', steps: 6 })).join(''))}</g>`;

const cartSvg = (side) => `<g id="cart-eng-${side}" display="none">${mat('m-yellow', slab(-40, -19, 80, 38, Z0, 0.9, { r: 3, tone: 'faint' }))}${mat('m-steel', [-20, 20].map((x) => slab(x - 4, -11, 8, 22, Z0 + 0.9, 1.1, { r: 1, tone: 'faint', crease: 'none' })).join(''))}</g>`;

// ---------- pressure test arrows (plane-local) and the engine heat shimmer (plane-local) ----------
function pressureSvg() {
  const d = [];
  for (const x of [70, 120, 190, 255, 300]) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r0 = rAt(x) + 2.5;
      const r1 = r0 + 7;
      const p0 = at(x, r0 * Math.cos(a), r0 * Math.sin(a));
      const p1 = at(x, r1 * Math.cos(a), r1 * Math.sin(a));
      const pa = at(x, (r1 - 2.2) * Math.cos(a + 0.2), (r1 - 2.2) * Math.sin(a + 0.2));
      const pb = at(x, (r1 - 2.2) * Math.cos(a - 0.2), (r1 - 2.2) * Math.sin(a - 0.2));
      d.push(`M${p0[0].toFixed(1)} ${p0[1].toFixed(1)}L${p1[0].toFixed(1)} ${p1[1].toFixed(1)}M${pa[0].toFixed(1)} ${pa[1].toFixed(1)}L${p1[0].toFixed(1)} ${p1[1].toFixed(1)}L${pb[0].toFixed(1)} ${pb[1].toFixed(1)}`);
    }
  }
  return `<g id="pfx" class="pfx" display="none" opacity="0"><path d="${d.join('')}"/></g>`;
}
export const shimmerSvg = () => `<g id="shim" display="none">${[-1, 1].map((s) => `<path id="shim${s > 0 ? 'P' : 'S'}" class="shim" d=""/>`).join('')}</g>`;

// ---------- overhead crane ----------
function craneSvg() {
  const y0 = HALL.y0 - 2;
  const y1 = HALL.y1 + 8;
  const bridge = mat('m-yellow', slab(-9, y0, 18, y1 - y0, CRANE_Z, 12, { tone: 'mid' }) + slab(-15, y0 - 2, 30, 14, CRANE_Z - 8, 10, { tone: 'faint' }) + slab(-15, y1 - 12, 30, 14, CRANE_Z - 8, 10, { tone: 'faint' }));
  const trolley = `<g id="crane-trolley">${mat('m-steel', slab(-13, -11, 26, 22, CRANE_Z + 12, 8, { r: 2, tone: 'mid' }))}</g>`;
  const hook = `<g id="crane-hook">${mat('m-yellow', slab(-6, -6, 12, 12, -10, 10, { r: 2, tone: 'mid' }))}<circle class="hook" id="crane-eye" r="2.6" cx="0" cy="0"/></g>`;
  return `<g id="crane" display="none">${bridge}${trolley}<path id="crane-cable" class="cable" d=""/>${hook}<path id="crane-sling" class="cable" d=""/></g>`;
}

// ---------- sky: a few flat clouds beside the climb-out so that altitude and speed can be seen once the ground has dropped out of frame ----------
// Positions come from the take-off simulation itself (they sit beside the real flight path); decorative, drawn once, never updated.
function skySvg() {
  const startX = RWY.start; // main wheels at brake release (world x)
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const out = [];
  for (let k = 0; k < 40; k++) {
    const st = takeoffAt(TO_T0 + k * 1.1); // sampled along the real flight path
    if (st.alt < 25) continue; // nothing over the runway itself
    const side = k % 2 ? 1 : -1;
    const cx = startX + st.dist * 10 + (rnd() - 0.5) * 500;
    const cy = st.y * 10 + side * (520 + rnd() * 760);
    const cz = Math.max(700, GZ + st.alt * 10 - 450 + rnd() * 1500);
    const lumps = [];
    for (let j = 0; j < 3; j++) {
      const rx = 170 + rnd() * 240;
      const ry = 70 + rnd() * 90;
      const ox = (j - 1) * rx * 0.8;
      const pts = [];
      for (let a = 0; a < 14; a++) {
        const t = (a / 14) * Math.PI * 2;
        pts.push(at(cx + ox + Math.cos(t) * rx, cy + Math.sin(t) * ry, cz + j * 4));
      }
      lumps.push(`<path d="${pathOf(pts, true)}"/>`);
    }
    out.push(`<g>${lumps.join('')}</g>`);
  }
  return `<g id="sky" class="cloud" display="none">${out.join('')}</g>`;
}

// ---------- the whole svg ----------
export function sceneSvg() {
  const ghosts = Array.from({ length: SLOTS }, (_, j) => `<g id="gh-${j}" display="none"><use id="gu0-${j}" href="#gh0"/><use id="gu1-${j}" href="#gh1" display="none"/><use id="gu2-${j}" href="#gh2" display="none"/></g>`).join('');
  // a sensible first frame (live replaces it): Wichita to the apron
  const corners = [[-7100, -560, 0], [9700, -560, 0], [-7100, 480, 0], [9700, 480, 0], [-3000, 0, 330]].map((p) => at(...p));
  const xs = corners.map((p) => p[0]);
  const ys = corners.map((p) => p[1]);
  const vb = `${Math.min(...xs).toFixed(0)} ${Math.min(...ys).toFixed(0)} ${(Math.max(...xs) - Math.min(...xs)).toFixed(0)} ${(Math.max(...ys) - Math.min(...ys)).toFixed(0)}`;
  const jigs = BARRELS.map(jigSvg).join('');
  const crates = SUPPLY.map((_, i) => crateGroup(i)).join('');
  return `<svg class="iso-svg plant" id="plant" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="plant-title"><title id="plant-title">Boeing 737 assembly factory and take-off — 보잉 737 조립 공장과 이륙</title>${ghostDefs()}` +
    `<g id="back">${staticBack()}</g>${skySvg()}` +
    `<g id="work"><g id="jigs">${jigs}</g><g id="crates">${crates}</g>${trainSvg()}</g>` +
    `<g id="ghosts">${ghosts}</g>` +
    `<g id="dyn-back">${BARRELS.map(gantryBack).join('')}${cartSvg('S')}${jackHost('jacks-far')}</g>` +
    `<g id="dyn-cart">${dollySvg()}</g>` +
    `<g id="dyn-plane-low">${shadowSvg()}${cradleSvg()}</g>` +
    `<g id="pwrap">${planeSvg()}${pressureSvg()}${shimmerSvg()}</g>` +
    `<g id="dyn-front">${cartSvg('P')}${jackHost('jacks-near')}${fuelTruckSvg()}${conveyorSvg()}${BARRELS.map(gantryFront).join('')}</g>` +
    `<g id="front">${staticFront()}</g>` +
    `<g id="fx"><path id="vortS" class="vort" d=""/><path id="vortP" class="vort" d=""/></g>` +
    `${craneSvg()}</svg>`;
}
export { WING_BAY };
