// Assemble the whole plant into one SVG string (build time) and the hooks the live module needs.
import { W, H, P, at, k, G, S, L, D, slab, rollY, BAYS, tag } from './world.js';
import { buildStatic, COIL, PANEL_Z } from './shops.js';
import { buildAll, ENGINE_Y, ENGINE_STATIONS } from './shops2.js';
import { carSvg, engineParts, PARKED_SKIP } from './car.js';

const faceRing = (cx, y, cz, r, n = 28) => k.pathOf(Array.from({ length: n }, (_, i) => at(cx + r * Math.cos((i / n) * Math.PI * 2), y, cz + r * Math.sin((i / n) * Math.PI * 2))), true);

function coilVariants() {
  const out = [];
  const N = 8;
  for (let i = 0; i < N; i++) {
    const r = COIL.rMax + (COIL.rMin - COIL.rMax) * (i / (N - 1));
    const w = COIL.w / 2;
    const rings = [r * 0.82, r * 0.64, r * 0.46].filter((q) => q > 3.4).map((q) => L(faceRing(COIL.x, w, COIL.z, q), { tone: 'faint' })).join('');
    out.push(`<g id="coil-${i}" class="coilv">${rollY(COIL.x, -w, w, COIL.z, r, 'hi', { steps: 28 })}${rings}${L(faceRing(COIL.x, w, COIL.z, 3.2, 16), { tone: 'mid' })}</g>`);
  }
  return out.join('');
}

function panelVariants() {
  const z = PANEL_Z;
  const base = (w, d, r) => slab(-w / 2, -d / 2, w, d, z, 0.7, { tone: 'hi', r, steps: 4, bevel: 0.25 });
  const raised = (w, d) => slab(-w / 2, -d / 2, w, d, z + 0.7, 3.2, { tone: 'hi', r: 3, steps: 4, bevel: 0.8 });
  const holes = L([-6, 6].map((x) => k.ring(x, 0, 1.4, z + 3.95, P, 10)).join(''), { tone: 'mid' });
  const flange = L(k.planOutline({ x: -9, y: -6, w: 18, d: 12, r: 2 }, z + 3.9, P, 4), { tone: 'faint' });
  return [
    `<g id="pn-0" class="pn">${base(26, 20, 0.6)}</g>`,
    `<g id="pn-1" class="pn">${base(26, 20, 0.6)}${raised(20, 14)}</g>`,
    `<g id="pn-2" class="pn">${base(22, 16, 3)}${raised(20, 14)}</g>`,
    `<g id="pn-3" class="pn">${base(22, 16, 3)}${raised(20, 14)}${holes}${flange}</g>`,
  ].join('');
}

function blankStack() {
  const out = [];
  for (let i = 0; i < 8; i++) out.push(`<g id="bl-${i}" class="bl">${slab(-13, -10, 26, 20, 6 + i * 1.3, 0.8, { tone: 'hi', r: 0.6, steps: 3, bevel: 0.2 })}</g>`);
  return out.join('');
}

function engineHero() {
  const e = engineParts(0, 0, 3);
  const order = ['pan', 'block', 'crank', 'pistons', 'head', 'intake', 'exhaust', 'cover', 'belt'];
  return `<g id="eng">${order.map((n) => `<g data-e="${n}">${e[n]}</g>`).join('')}<g data-e="bores">${e.bores}</g></g>`;
}

export function sceneSvg() {
  const sc = buildStatic();
  buildAll(sc);
  // the engine hero lives in the back slot (it is behind the car's line); its box sweeps the whole engine conveyor
  sc.back.add({ x: 1042, y: ENGINE_Y - 14, z: 3, w: 150, d: 28, h: 26 }, tag('engine', `<g id="eng-slot">${engineHero()}</g>`));
  const back = sc.back.svg();
  const front = sc.front.svg();
  const car = carSvg();
  const defs = `<defs><g id="car-parked" class="parked paintdone">${carSvg(PARKED_SKIP)}</g></defs>`;
  const agv = `<g id="agv">${slab(12, -16, 28, 32, 0, 2.6, { tone: 'mid', r: 2 })}${D([at(16, -12, 2.8), at(36, -12, 2.8), at(16, 12, 2.8), at(36, 12, 2.8)], { size: 0.5, tone: 'mid' })}</g>`;
  const work = `<g id="coils">${coilVariants()}</g><path id="strip" class="steel" d=""/><g id="blanks">${blankStack()}</g><g id="scrap"></g><g id="panel">${panelVariants()}</g>${agv}<g id="car">${car}</g>`;
  return `<svg class="iso-svg plant" id="plant" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="plant-title"><title id="plant-title">Automobile factory — 자동차 공장</title>${defs}` +
    `<g id="back">${back}</g><g id="work">${work}</g><g id="front">${front}</g><g id="fx"></g></svg>`;
}
export { P, at, k, G, BAYS, ENGINE_Y, ENGINE_STATIONS };
