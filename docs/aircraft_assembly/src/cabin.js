// The cabin and the belly of the hero airliner: floor, sidewalls, bins, 29 seat rows, galleys, flight deck, cargo, tanks, wiring.
// Drawn first inside the plane, back to front, then the skin goes semi-transparent (x-ray) while the aircraft is still being fitted out.
import { G, S, L, P, at, pathOf, polyPath, layer, slab, post, prismXZ, tr } from './world.js';
import { FX } from './hull.js';

export const ROWS = 29;
export const ROW_PITCH = 7.1;
export const ROW_X0 = 302; // x of the first (forward-most) row's front edge
export const rowX = (i) => ROW_X0 - i * ROW_PITCH;
const FLOOR_Z = -6.4;
const SEAT = [[0, FLOOR_Z], [4.2, FLOOR_Z], [4.2, -3.5], [1.7, 3.4], [0, 3.4]];

const wrapP = (id, inner, cls = '') => `<g data-p="${id}"${cls ? ` class="${cls}"` : ''}>${inner}</g>`;
const m = (cls, inner) => `<g class="${cls}">${inner}</g>`;

export function cabinDefs() {
  const triplet = (y0) => prismXZ(SEAT, y0, y0 + 13, { tone: 'hi', crease: 'faint' }) + L(pathOf([at(1.1, y0 + 4.33, -0.5), at(1.1, y0 + 4.33, FLOOR_Z + 2.5)]) + pathOf([at(1.1, y0 + 8.66, -0.5), at(1.1, y0 + 8.66, FLOOR_Z + 2.5)]), { tone: 'hi' });
  return `<defs><g id="seat-f">${triplet(-15.6)}</g><g id="seat-n">${triplet(2.6)}</g></defs>`;
}

// the far window positions are echoed on the far wall of the cabin
const farWindows = () => {
  const ds = [];
  for (let x = 298; x > 104; x -= 5.1) {
    if (Math.abs(x - 307) < 7 || Math.abs(x - 97) < 7 || Math.abs(x - 142) < 6) continue;
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      pts.push(at(x + 1.3 * Math.cos(a), -17.2, 2.4 + 2.4 * Math.sin(a)));
    }
    ds.push(polyPath(pts.map((p) => p)));
  }
  return `<path class="win" d="${ds.join('')}"/>`;
};

export function cabinSvg() {
  const lay = layer();
  const add = (box, id, cls, inner) => lay.add(box, wrapP(id, inner, cls));

  // --- belly ---
  add({ x: 96, y: -16.4, w: 256, d: 32.8, z: -7.4, h: 0.8 }, 'cabin_floor', 'm-int', slab(96, -16.8, 256, 33.6, -7.4, 0.8, { tone: 'mid' }));
  add({ x: 238, y: -10.5, w: 86, d: 21, z: -14.6, h: 7.2 }, 'cargo_fwd', 'm-wall', slab(238, -10.5, 86, 21, -14.6, 1.8, { tone: 'mid' }) + slab(238, -10.5, 86, 0.9, -14.6, 7.2, { tone: 'mid' }) + slab(238, 9.6, 86, 0.9, -14.6, 7.2, { tone: 'mid' }));
  add({ x: 92, y: -10, w: 74, d: 20, z: -14.4, h: 7 }, 'cargo_aft', 'm-wall', slab(92, -10, 74, 20, -14.4, 1.8, { tone: 'mid' }) + slab(92, -10, 74, 0.9, -14.4, 7, { tone: 'mid' }) + slab(92, 9.1, 74, 0.9, -14.4, 7, { tone: 'mid' }));
  const bag = (x, y, z, w, d, h) => slab(x, y, w, d, z, h, { tone: 'mid' });
  const bagsF = [[246, -8.5, -12.8, 8, 6, 4.2], [258, 2, -12.8, 7, 6.5, 4.4], [268, -8, -12.8, 8, 6.5, 3.6], [280, 3, -12.8, 8, 6, 4.4], [292, -7.5, -12.8, 7, 6, 4.2], [304, 2.5, -12.8, 8, 6.5, 3.8]];
  bagsF.forEach(([x, y, z, w, d, h], i) => add({ x, y, w, d, z, h }, `bags_fwd`, 'm-yellow', bag(x, y, z, w, d, h)));
  const bagsA = [[98, -7.5, -12.6, 8, 6, 4.4], [110, 1, -12.6, 8, 6.5, 4], [123, -8, -12.6, 8, 6, 3.8], [136, 2.5, -12.6, 8, 6, 4.4], [149, -6.5, -12.6, 8, 6.5, 4]];
  bagsA.forEach(([x, y, z, w, d, h]) => add({ x, y, w, d, z, h }, `bags_aft`, 'm-yellow', bag(x, y, z, w, d, h)));
  add({ x: 182, y: -11, w: 56, d: 22, z: -14.2, h: 6.4 }, 'center_tank', 'm-fuel', slab(182, -11, 56, 22, -14.2, 6.4, { tone: 'mid' }));
  add({ x: 168, y: -8, w: 12, d: 16, z: -14.4, h: 7 }, 'ac_packs', 'm-steel', post(173, -4, 3.3, -14.2, 6.6, { steps: 14 }) + post(173, 4, 3.3, -14.2, 6.6, { steps: 14 }));
  add({ x: 328, y: -9, w: 16, d: 18, z: -14.6, h: 7 }, 'elec_bay', 'm-steel', slab(328, -9, 16, 18, -14.6, 7, { tone: 'mid' }));
  add({ x: 100, y: -5, w: 10, d: 10, z: -9.5, h: 2.2 }, 'water_tanks', 'm-fuel', slab(98, -5, 10, 10, -9.8, 2.2, { tone: 'mid' }));

  // --- walls and ceilings ---
  add({ x: 96, y: -16.8, w: 216, d: 0.7, z: -6.4, h: 13.2 }, 'sidewall_far', 'm-wall', slab(96, -16.8, 216, 0.7, -6.4, 13.2, { tone: 'mid' }) + farWindows());
  for (let i = 0; i < 10; i++) {
    const x = 104 + i * 20;
    add({ x, y: -15, w: 18, d: 5, z: 6.6, h: 3.8 }, 'bins_far', 'm-wall', slab(x, -15, 18, 5, 6.6, 3.8, { tone: 'mid', r: 0 }));
    add({ x, y: 10, w: 18, d: 5, z: 6.6, h: 3.8 }, 'bins_near', 'm-wall', slab(x, 10, 18, 5, 6.6, 3.8, { tone: 'mid', r: 0 }));
  }

  // --- seats ---
  for (let i = 0; i < ROWS; i++) {
    const x = rowX(i) - 4.2;
    const id = `seat_row_${String(i + 1).padStart(2, '0')}`;
    add({ x, y: -15.6, w: 4.2, d: 13, z: FLOOR_Z, h: 9.8 }, id, 'm-seat', `<use href="#seat-f" transform="${tr(x, 0, 0)}"/>`);
    add({ x, y: 2.6, w: 4.2, d: 13, z: FLOOR_Z, h: 9.8 }, id, 'm-seat', `<use href="#seat-n" transform="${tr(x, 0, 0)}"/>`);
  }

  // --- galleys, lavatories, flight deck ---
  add({ x: 306, y: 4, w: 16, d: 12, z: FLOOR_Z, h: 13 }, 'galley_fwd', 'm-wall', slab(306, 4, 16, 12, FLOOR_Z, 13, { tone: 'mid' }));
  add({ x: 306, y: -16, w: 16, d: 8, z: FLOOR_Z, h: 13 }, 'lavatory_fwd', 'm-wall', slab(306, -16, 16, 8, FLOOR_Z, 13, { tone: 'mid' }));
  add({ x: 96, y: 2, w: 12, d: 14, z: FLOOR_Z, h: 13 }, 'galley_aft', 'm-wall', slab(96, 2, 12, 14, FLOOR_Z, 13, { tone: 'mid' }));
  add({ x: 96, y: -16, w: 12, d: 13.5, z: FLOOR_Z, h: 13 }, 'lavatory_aft', 'm-wall', slab(96, -16, 12, 13.5, FLOOR_Z, 13, { tone: 'mid' }));
  add({ x: 324, y: -17, w: 2, d: 34, z: FLOOR_Z, h: 16 }, 'cockpit_door', 'm-dark', slab(324.5, -4, 1.4, 8, FLOOR_Z, 14, { tone: 'mid' }));
  add({ x: 326, y: -17, w: 28, d: 34, z: -7.4, h: 0.8 }, 'flight_deck_floor', 'm-int', slab(326, -16.6, 26, 33.2, -7.4, 0.8, { tone: 'mid' }));
  const pilotSeat = (y0) => prismXZ([[0, FLOOR_Z], [5, FLOOR_Z], [5, -3.2], [1.8, 4.2], [0, 4.2]], y0, y0 + 5.2, { tone: 'hi', crease: 'faint' });
  add({ x: 334, y: -12, w: 5, d: 5.2, z: FLOOR_Z, h: 10.6 }, 'flight_deck', 'm-seat', pilotSeat(-12));
  add({ x: 334, y: 6.8, w: 5, d: 5.2, z: FLOOR_Z, h: 10.6 }, 'flight_deck', 'm-seat', pilotSeat(6.8));
  add({ x: 346, y: -13, w: 4, d: 26, z: FLOOR_Z, h: 7 }, 'flight_deck', 'm-dark', slab(346, -13, 4, 26, FLOOR_Z, 7, { tone: 'mid' }) + slab(349.5, -15, 3, 30, 0.3, 3, { tone: 'mid' }));
  // --- pressure bulkheads ---
  add({ x: 87, y: -18, w: 1, d: 36, z: -18, h: 36 }, 'pressure_bulkhead_aft', 'm-comp', S(G.disc(87.4, 88.2, 17.9, FX, P), { tone: 'hi' }));
  add({ x: 352, y: -18, w: 1, d: 36, z: -18, h: 36 }, 'pressure_bulkhead_fwd', 'm-comp', S(G.disc(352.4, 353.2, 17.5, FX, P), { tone: 'hi' }));
  return lay.svg();
}

// harness and plumbing, drawn on top of everything inside the cabin (it is a line overlay in x-ray)
export function systemsSvg() {
  const run = (pts) => pathOf(pts.map((p) => at(...p)));
  const wire = [];
  for (const [y, z] of [[-14.5, 12.6], [14.2, 12.6], [-9.5, -9.2], [9.5, -9.2], [-16.4, -5.6], [16.4, -5.6]]) {
    wire.push(run([[96, y, z], [160, y, z], [250, y, z], [330, y, z], [346, y * 0.5, z + (z < 0 ? 3 : 0)]]));
  }
  for (let x = 130; x < 300; x += 40) wire.push(run([[x, -14.5, 12.6], [x, -14.5, 7.8]]), run([[x, 14.2, 12.6], [x, 14.2, 7.8]]));
  const hyd = [run([[100, -7.5, -9.4], [180, -7.5, -9.4], [182, -8, -9.5], [215, -8, -9.5]]), run([[100, 7.5, -9.4], [180, 7.5, -9.4], [182, 8, -9.5], [215, 8, -9.5]]), run([[200, -8, -9.4], [200, -25, -10.6]]), run([[200, 8, -9.4], [200, 25, -10.6]])];
  return { wire: `<path class="wire" d="${wire.join('')}"/>`, hyd: `<path class="hyd" d="${hyd.join('')}"/>` };
}
