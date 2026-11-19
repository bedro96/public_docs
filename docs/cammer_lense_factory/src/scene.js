// Assemble the two SVGs at build time: #plant (the schematic factory) and #loupe (the hero module at its own scale).
import { W, H, P, at, k, S, L, D, slab, post, BAYS, BAY_ORDER, CLEAN, CLEAN_CORE, newScene, tag } from './world.js';
import { buildStatic1 } from './shops.js';
import { buildStatic2, truckSvg } from './shops2.js';
import { BELT_Z } from './layout.js';
import { LW, LH, PL, lat, LS, LL, LD } from './mod.js';
import { moduleSvg } from './mod.js';
import { jigSvg, esdSvg, bagSvg, cartonSvg, rigStatic, rigOptics, gripSvg, strutsSvg, needleSvg, uvSvg, ovenSvg } from './rig.js';
import { phoneStatic, lidSvg, screwSvg, backViewSvg } from './phone.js';

// the carrier on the plant: a pallet tray plus up to five build levels, then a bag or a carton. Drawn once at x = 0, y = 0.
export function carSvg() {
  const z = BELT_Z;
  const tray = slab(-6, -6, 12, 12, z, 1.4, { tone: 'hi', r: 1.2, steps: 4, bevel: 0.2 }) + L(k.planOutline({ x: -4.4, y: -4.4, w: 8.8, d: 8.8, r: 0.8 }, z + 1.4, P, 3), { tone: 'faint' });
  const l1 = slab(-4.6, -4, 9.2, 8, z + 1.4, 0.7, { tone: 'hi', r: 0.4, cls: 'mt-pcb' }) + D([at(-3, -2.6, z + 2.1), at(-1.6, -2.6, z + 2.1), at(1.4, 2.4, z + 2.1), at(3, 2.4, z + 2.1)], { size: 0.5, tone: 'mid' });
  const l2 = slab(-2.6, -2.2, 5.2, 4.4, z + 2.1, 0.8, { tone: 'dark', r: 0.4, cls: 'mt-silicon' }) + slab(-3.4, -3, 6.8, 6, z + 2.9, 1.1, { tone: 'mid', r: 0.4, cls: 'mt-resin' }) + slab(-2.2, -2, 4.4, 4, z + 4, 0.5, { tone: 'hi', r: 0.3, cls: 'mt-glass' });
  const l3 = post(0, 0, 3.2, z + 4.5, 2.6, { tone: 'mid', steps: 16, cls: 'mt-polymer' }) + post(0, 0, 2.3, z + 7.1, 2.6, { tone: 'dark', steps: 16, cls: 'mt-dark' });
  const l4 = L(k.ring(0, 0, 3.4, z + 5.2, P, 18), { tone: 'lit' }) + post(0, 0, 1.2, z + 9.7, 0.6, { tone: 'lit', steps: 12, cls: 'mt-glass' });
  const l5 = slab(-4.4, -4.4, 8.8, 8.8, z + 1.5, 7.4, { tone: 'hi', r: 0.5, steps: 3, cls: 'mt-steel' }) + L(k.ring(0, 0, 2.2, z + 8.9, P, 16), { tone: 'mid' });
  const bag = slab(-8, -8, 16, 16, z - 0.2, 7, { tone: 'mid', r: 3, steps: 5, crease: 'none', cls: 'bagp' });
  const carton = slab(-7.4, -7.4, 14.8, 14.8, z - 0.2, 9, { tone: 'hi', r: 0.6, steps: 3, groove: 0.8, cls: 'cartonp' }) + L(k.pathOf([at(0, -7.4, z + 8.8), at(0, 7.4, z + 8.8)], false), { tone: 'mid', free: true });
  return `<g id="car">` +
    `<g id="car-tray">${tray}</g>` +
    `<g id="car-l1" class="lv">${l1}</g><g id="car-l2" class="lv">${l2}</g><g id="car-l3" class="lv">${l3}</g><g id="car-l4" class="lv">${l4}</g><g id="car-l5" class="lv">${l5}</g>` +
    `<g id="car-bag" class="lv">${bag}</g><g id="car-carton" class="lv">${carton}</g></g>`;
}

export function plantSvg() {
  const sc = newScene();
  buildStatic1(sc);
  buildStatic2(sc);
  const back = sc.back.svg();
  const front = sc.front.svg();
  const t = truckSvg();
  const work = `${t.back}${carSvg()}${t.front}`;
  const title = 'Camera module factory, isometric schematic (카메라 모듈 공장 모식도)';
  return `<svg class="iso-svg plant" id="plant" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="plant-title"><title id="plant-title">${title}</title>` +
    `<g id="back">${back}</g><g id="work">${work}</g><g id="front">${front}</g><g id="fx"></g></svg>`;
}

// the loupe: layers back to front. The module's parts are one flat list of <g data-p> inside #mod so the BOM view can reorder them.
export function loupeSvg() {
  const esd = esdSvg();
  const car = cartonSvg();
  const ph = phoneStatic();
  const back = backViewSvg();
  const scaleBar = (() => {
    const a = lat(-14, 16, -3);
    const b = lat(-9, 16, -3);
    const t1 = lat(-14, 15.2, -3);
    const t2 = lat(-14, 16.8, -3);
    const t3 = lat(-9, 15.2, -3);
    const t4 = lat(-9, 16.8, -3);
    const d = `M${a.join(' ')}L${b.join(' ')}M${t1.join(' ')}L${t2.join(' ')}M${t3.join(' ')}L${t4.join(' ')}`;
    const m = [b[0] + 10, b[1] + 11]; // the label sits right of the bar's far end so it stays inside the frame at every zoom
    return `<g id="l-scale" class="lscale"><path class="sc-line" d="${d}"/><text class="sc-text" x="${m[0].toFixed(1)}" y="${m[1].toFixed(1)}" text-anchor="start">5 mm</text></g>`;
  })();
  const defs = '<defs></defs>';
  const bg = `<g id="l-jig">${jigSvg()}</g><g id="l-esd">${esd.back}</g><g id="l-cartonb">${car.back}</g><g id="l-phoneb" class="phg" opacity="0">${ph.back}</g><g id="l-rig" class="rigg" opacity="0">${rigStatic()}</g>`;
  const mod = `<g id="mod">${moduleSvg()}</g>`;
  const fg = `<g id="l-proxies">${esd.proxies}</g><g id="l-bag" class="bagw" opacity="0">${bagSvg()}</g><g id="l-cartonf">${car.front}</g><g id="l-cartonlid" opacity="0">${car.lid}</g>` +
    `<g id="l-phonef" class="phg" opacity="0">${ph.front}</g><g id="l-screws">${screwSvg(0)}${screwSvg(1)}</g><g id="l-lid" opacity="0">${lidSvg()}</g>` +
    `<g id="l-optics" opacity="0">${rigOptics()}</g><g id="l-struts" opacity="0">${strutsSvg()}</g><g id="l-grip" opacity="0">${gripSvg()}</g><g id="l-needle">${needleSvg()}</g><g id="l-uv" opacity="0">${uvSvg()}</g><g id="l-oven" opacity="0">${ovenSvg()}</g>` +
    `${scaleBar}<g id="l-back" opacity="0">${back.svg}</g>`;
  return `<svg class="iso-svg loupe" id="loupe" viewBox="0 0 ${LW} ${LH}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="loupe-title"><title id="loupe-title">Camera module loupe (확대경): the hero module, drawn far larger than real</title>${defs}` +
    `<g id="l-bg">${bg}</g>${mod}<g id="l-fg">${fg}</g></svg>`;
}
export { P, at, k, BAYS, BAY_ORDER, CLEAN, CLEAN_CORE, PL, LS, LL, LD, S };
