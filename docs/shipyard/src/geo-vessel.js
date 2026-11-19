// The vessel figure: a container ship in cutaway, built in ship coordinates
// (x: stern 0 -> bow L, y: athwart ships, centre line 0, the near half is cut away; z: up from the keel).
// Heights and beam are exaggerated about 1.5x so small parts stay legible; the page says so.
import { SHIP_ZLIFT } from './model.js';
import { tools, hullRing, halfBreadth } from './geo-common.js';

export const V = {
  L: 300, HB: 28, DK: 38, DB: 4.8,
  bulkheads: [14, 82, 136, 190, 244],
  house: { x0: 40, x1: 70, hw: 20, z0: 38, decks: 6, dz: 5.6 },
  shaftZ: 10,
  propX: -6, propR: 8.5,
  radar: [66, 0, 101],
  lift: { hull: 0, piping: 10, cargo: 30, engine: 24, electrical: 50, house: 56, nav: 80 },
};
const hbAt = (x) => V.HB * halfBreadth(Math.max(0, Math.min(1, x / V.L)));

export function vesselBounds() {
  const pts = [];
  for (const x of [-18, 304]) for (const y of [-30, 30]) for (const z of [0, 108 + V.lift.nav]) pts.push([x, y, z]);
  return pts;
}

export function buildVessel(K, P) {
  const T = tools(K, P);
  const { box, post, prism, line, mark, hcyl } = T;
  const L = V.L, HB = V.HB, DK = V.DK, DB = V.DB;
  const layers = {};
  const items = {};
  const tag = (o, item, sys) => ({ ...o, item, sys });
  const A = (id, layer, at) => { items[id] = { layer, at }; };

  /** consecutive parts of the same item share one group, so a click finds the item */
  const runs = (parts) => {
    let out = '', cur = null, buf = '';
    const flush = () => { if (buf) out += cur ? T.g(buf, { 'data-item': cur, class: 'item' }) : buf; buf = ''; };
    for (const p of parts) { if (p.item !== cur) { flush(); cur = p.item; } buf += p.svg; }
    flush();
    return out;
  };
  const make = (name, parts, extra = '') => {
    layers[name] = { parts, svg: T.g(runs(T.paint(parts)) + extra, { id: `v-${name}`, class: 'layer', 'data-layer': name }) };
  };
  const stackOf = (x, y, z, nx, ny, tiers, cls, item) => {
    const w = nx * 6.2, d = ny * 5.4, h = tiers * 5.4;
    const b = box(x, y, z, w, d, h, { cls, item, crease: 'faint' });
    const seg = [];
    for (let i = 1; i < tiers; i++) { seg.push(K.segment([x, y + d, z + i * 5.4], [x + w, y + d, z + i * 5.4], P)); seg.push(K.segment([x + w, y, z + i * 5.4], [x + w, y + d, z + i * 5.4], P)); }
    for (let i = 1; i < nx; i++) seg.push(K.segment([x + i * 6.2, y + d, z], [x + i * 6.2, y + d, z + h], P));
    for (let i = 1; i < ny; i++) seg.push(K.segment([x + w, y + i * 5.4, z], [x + w, y + i * 5.4, z + h], P));
    b.svg = b.svg.replace(/<\/g>$/, '') + `<path class="iso-line cont-line" data-tone="lo" d="${seg.join('')}"/></g>`;
    return b;
  };

  // ============ hull ==========================================================================================
  {
    const p = [];
    const full = hullRing(L, HB, 0, 0, 1, 14);
    const inset = hullRing(L, HB - 1.2, 0, 0.01, 0.99, 14);
    p.push(tag(prism(full, 0, 0.8, { cls: 'c-hull-plate' }), 'double-bottom'));
    p.push(tag(prism(inset, DB - 0.8, 0.8, { cls: 'c-hull-plate' }), 'double-bottom'));
    for (const x of [14, 46, 82, 112, 142, 172, 202, 232, 262]) {
      const h = hbAt(x) - 1.2;
      p.push(tag(box(x - 0.6, -h, 0.8, 1.2, 2 * h, DB - 1.6, { cls: 'c-floor-t', crease: 'none' }), 'double-bottom'));
    }
    p.push(tag(box(2, -0.6, 0.8, 260, 1.2, DB - 1.6, { cls: 'c-floor-t', crease: 'none' }), 'double-bottom'));
    // ballast water in the tanks of the double bottom (the page changes its opacity)
    for (let j = 0; j < 6; j++) {
      const x0 = 84 + j * 30;
      const o = tag(box(x0, -hbAt(x0 + 15) + 1.6, 1, 28, 2 * hbAt(x0 + 15) - 3.2, DB - 2, { cls: 'c-ballast bw', crease: 'none', tone: 'faint' }), 'ballast');
      p.push(o);
    }
    // side shell, far half, as a closed band: transom -> bow
    const outer = [[0, 0]], inner = [[1.2, 0]];
    for (let i = 0; i <= 28; i++) { const x = (i / 28) * L; outer.push([x, -hbAt(x)]); inner.push([Math.min(L - 1.2, Math.max(1.2, x)), -(hbAt(x) - 1.2)]); }
    outer.push([L, 0]); inner.push([L - 1.2, 0]);
    p.push(prism([...outer, ...inner.reverse()], 0, DK, { cls: 'c-shell', convex: false, item: 'hull-shell', crease: 'none' }));
    // watertight bulkheads (glass-like so the rooms behind them stay readable)
    for (const x of V.bulkheads) p.push(tag(box(x - 0.7, -hbAt(x) + 1.2, DB, 1.4, 2 * hbAt(x) - 2.4, DK - DB, { cls: 'c-bulk', crease: 'none', tone: 'mid' }), 'bulkhead'));
    // frames on the far shell
    for (let i = 0; i < 8; i++) p.push(tag(box(26 + i * 28, -HB + 1.2, DB, 1, 1.8, DK - DB - 1, { cls: 'c-frame', crease: 'none' }), 'frames'));
    // wing (topside) ballast tanks, far side
    for (let j = 0; j < 3; j++) p.push(tag(box(88 + j * 54, -HB + 3, DB + 1, 50, 5.4, DK - DB - 4, { cls: 'c-ballast bw', crease: 'none', tone: 'faint' }), 'ballast'));
    // decks: bow, stern and the far side strip
    p.push(prism(hullRing(L, HB, 0, 0.87, 1, 6), DK - 1, 1.6, { cls: 'c-deck' }));
    p.push(prism(hullRing(L, HB, 0, 0, 0.07, 4), DK - 1, 1.6, { cls: 'c-deck' }));
    p.push(prism([[84, -HB], [262, -HB], [262, -HB + 5.6], [84, -HB + 5.6]], DK - 1, 1.6, { cls: 'c-deck' }));
    make('hull', p);
    A('double-bottom', 'hull', [172, 24, 2.4]); A('ballast', 'hull', [146, -20, DB + 2]); A('bulkhead', 'hull', [136, 0, DK]); A('frames', 'hull', [110, -26, 24]);
  }

  // ============ piping: fuel and ballast ===============================================================================
  {
    const p = [];
    p.push(tag(box(84, -24, DB, 16, 11, 12, { cls: 'c-tank' }), 'piping'));
    p.push(tag(line([[84, -19, 12], [76, -19, 12], [76, -8, 10]], { tone: 'red', flow: true }), 'piping'));
    p.push(tag(line([[96, -26, 7], [262, -26, 7]], { tone: 'blue', flow: true }), 'piping'));
    for (let j = 0; j < 3; j++) p.push(tag(line([[100 + j * 54, -26, 7], [100 + j * 54, -26, 3.6]], { tone: 'blue' }), 'piping'));
    p.push(tag(post(74, -26, DB, 5, 2.2, { cls: 'c-pump', steps: 10 }), 'piping'));
    p.push(tag(line([[74, -26, 8], [74, -26, 7], [96, -26, 7]], { tone: 'blue', flow: true }), 'piping'));
    make('piping', p);
    A('piping', 'piping', [92, -26, 12]);
  }

  // ============ engine and propulsion ======================================================================
  {
    const p = [];
    const zc = V.shaftZ;
    p.push(tag(box(18, -9, DB, 58, 18, 4, { cls: 'c-dark' }), 'main-engine'));
    p.push(tag(box(22, -7, DB + 4, 50, 14, 6, { cls: 'c-engine' }), 'main-engine'));                    // frame and crankcase
    for (let i = 0; i < 7; i++) {
      const x = 28 + i * 6.8;
      p.push(tag(post(x, 0, DB + 10, 15, 2.7, { cls: 'c-engine', steps: 14 }), 'main-engine'));
      p.push(tag(post(x, 0, DB + 25, 3, 2.1, { cls: 'c-head', steps: 12 }), 'main-engine'));
    }
    p.push(tag(hcyl('x', [47, 7.6, 20], 2.4, 48, { cls: 'c-pipe' }), 'main-engine'));                    // scavenge air receiver
    p.push(tag(hcyl('x', [20, 0, zc + 3], 4.2, 7, { cls: 'c-engine' }), 'main-engine'));                  // turbocharger
    p.push(tag(post(21, 0, DB + 4, 22, 1.6, { cls: 'c-pipe', steps: 10 }), 'main-engine'));
    p.push(tag(hcyl('x', [17.5, 0, zc], 4.8, 3, { cls: 'c-dark' }), 'shaft'));                           // flywheel / thrust collar
    p.push(tag(hcyl('x', [8, 0, zc], 1.8, 17, { cls: 'c-shaft' }), 'shaft'));
    p.push(tag(hcyl('x', [-1.5, 0, zc], 2.2, 8, { cls: 'c-shaft' }), 'shaft'));                           // through the stern tube
    for (const x of [6, 13]) p.push(tag(box(x - 2, -2.6, DB, 4, 5.2, zc - DB - 1.2, { cls: 'c-dark', crease: 'none' }), 'shaft'));
    p.push(tag(hcyl('x', [V.propX - 1, 0, zc], 2.8, 5, { cls: 'c-hub' }), 'propeller'));                  // hub; the blades are drawn live
    p.push(tag(post(46, 0, DB + 28, 32, 1.1, { cls: 'c-pipe', steps: 8 }), 'main-engine'));              // exhaust to the funnel
    // rudder: plate behind the propeller, stock up into the hull
    p.push(tag(box(-17, -0.9, 1, 9, 1.8, 26, { cls: 'c-rudder' }), 'rudder'));
    p.push(tag(post(-12.6, 0, 27, 12, 0.9, { cls: 'c-pipe', steps: 8 }), 'rudder'));
    make('engine', p, `<g id="v-prop" class="item" data-item="propeller"></g>`);
    A('main-engine', 'engine', [48, 0, DB + 30]); A('shaft', 'engine', [8, 0, zc + 3]); A('propeller', 'engine', [V.propX, 0, zc + V.propR]); A('rudder', 'engine', [-13, 0, 28]);
  }

  // ============ electrical =====================================================================================
  {
    const p = [];
    for (let i = 0; i < 3; i++) {
      const x = 22 + i * 13;
      p.push(tag(box(x, -26, DB, 8, 5.6, 7, { cls: 'c-dark' }), 'generators'));
      p.push(tag(hcyl('x', [x + 11, -23.2, DB + 3.4], 2.7, 6, { cls: 'c-gen' }), 'generators'));
      p.push(tag(post(x + 2.5, -23.2, DB + 7, 4, 1.1, { cls: 'c-pipe', steps: 8 }), 'generators'));
    }
    p.push(tag(box(62, -27, DB, 14, 4.4, 18, { cls: 'c-panel' }), 'switchboard'));
    for (let i = 0; i < 3; i++) p.push(tag(line([[64 + i * 4.4, -22.5, DB + 2], [64 + i * 4.4, -22.5, DB + 16]], { tone: 'mid' }), 'switchboard'));
    p.push(tag(box(60, -27, DB + 18, 18, 4.4, 1.4, { cls: 'c-beam', crease: 'none' }), 'switchboard'));
    // cable tray along the far wall and the cables inside it
    p.push(tag(box(20, -27.6, 26, 58, 2.4, 1.2, { cls: 'c-tray', crease: 'none' }), 'cables'));
    for (let i = 0; i < 3; i++) p.push(tag(line([[26 + i * 13, -26.6, DB + 7.2], [26 + i * 13, -26.4, 26.6]], { tone: 'mid', flow: true }), 'cables'));
    p.push(tag(line([[26, -26.4, 26.6], [70, -26.4, 26.6], [70, -26.4, DB + 19.4]], { tone: 'lit', flow: true }), 'cables'));
    p.push(tag(line([[78, -26.4, 26.6], [262, -26.4, 36.2]], { tone: 'lit', flow: true }), 'cables'));
    p.push(tag(line([[70, -26.4, 26.6], [78, -26.4, 26.6]], { tone: 'lit', flow: true }), 'cables'));
    p.push(tag(line([[74, -26.4, 26.6], [74, -26.4, DK + 24]], { tone: 'lit', flow: true }), 'cables'));
    // emergency generator in its own room on the aft deck, high above the engine room
    p.push(tag(box(8, -12, DK, 16, 24, 8, { cls: 'c-glass', crease: 'none', tone: 'mid' }), 'emergency'));
    p.push(tag(box(10, -7, DK, 8, 5, 5, { cls: 'c-dark' }), 'emergency'));
    p.push(tag(hcyl('x', [20, -4.5, DK + 2.5], 2.3, 5, { cls: 'c-gen' }), 'emergency'));
    make('electrical', p);
    A('generators', 'electrical', [34, -23, DB + 8]); A('switchboard', 'electrical', [69, -25, DB + 18]); A('cables', 'electrical', [48, -27, 27.5]); A('emergency', 'electrical', [16, 0, DK + 8]);
  }

  // ============ cargo ====================================================================================
  {
    const p = [];
    const cls = ['c-cont-a', 'c-cont-b', 'c-cont-c', 'c-cont-d'];
    let n = 0;
    const stack = (x, y, z, nx, ny, t) => p.push(stackOf(x, y, z, nx, ny, t, cls[n++ % 4], 'cargo'));
    // hold 1 full, hold 2 half loaded, hold 3 empty (cell guides only); containers sit on deck over holds 1 and 2
    for (const hx of [86]) for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) stack(hx + i * 24.8, -24 + j * 10.8, DB, 4, 2, 5);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) stack(86 + i * 24.8, -24 + j * 10.8, DK, 4, 2, 3);
    for (let i = 0; i < 2; i++) stack(140 + i * 24.8, -24, DB, 4, 2, 4);
    for (let i = 0; i < 2; i++) stack(140 + i * 24.8, -24, DK, 4, 2, 3);
    stack(140, -13.2, DK, 4, 2, 2);
    for (const x of [195, 239]) for (const y of [-24, -3]) p.push(tag(line([[x, y, DB], [x, y, DK - 2]], { tone: 'mid' }), 'cargo'));
    make('cargo', p);
    A('cargo', 'cargo', [112, -14, DK + 17]);
  }

  // ============ accommodation, funnel, deck gear, safety =====================================================================
  {
    const p = [];
    const H = V.house;
    p.push(tag(box(H.x0, -H.hw - 1, H.z0, H.x1 - H.x0, 1.4, H.decks * H.dz, { cls: 'c-white' }), 'house'));     // far wall
    for (let d = 0; d < H.decks; d++) {
      const z = H.z0 + d * H.dz;
      p.push(tag(box(H.x0, -H.hw, z, H.x1 - H.x0, 2 * H.hw, 0.9, { cls: 'c-deckfloor', crease: 'none' }), 'house'));
      p.push(tag(box(H.x0 + 3, -H.hw + 2, z + 0.9, 5, 4, 2.4, { cls: 'c-bunk', crease: 'none' }), 'house'));
    }
    for (const [x, y] of [[H.x0 + 0.8, H.hw - 0.8], [H.x1 - 0.8, H.hw - 0.8], [H.x1 - 0.8, -H.hw + 0.8]]) p.push(tag(post(x, y, H.z0, H.decks * H.dz, 0.8, { cls: 'c-col', steps: 8 }), 'house'));
    for (let d = 0; d < H.decks; d++) p.push(tag(line([[H.x0 + 2, -H.hw - 1 + 1.5, H.z0 + 3 + d * H.dz], [H.x1 - 2, -H.hw - 1 + 1.5, H.z0 + 3 + d * H.dz]], { tone: 'mid', dashed: true }), 'house'));
    p.push(tag(post(48, 0, H.z0 + H.decks * H.dz, 15, 5, { cls: 'c-funnel', steps: 18 }), 'house'));               // funnel
    p.push(tag(box(54, 8, H.z0 + H.decks * H.dz, 7, 6, 3.6, { cls: 'c-hvac' }), 'house'));                        // HVAC units on the roof
    p.push(tag(box(54, -14, H.z0 + H.decks * H.dz, 7, 6, 3.6, { cls: 'c-hvac' }), 'house'));
    p.push(tag(line([[57, 8, 76], [57, 2, 76], [62, 2, 74]], { tone: 'mid', dashed: true }), 'house'));
    // lifeboat on its slide at the stern
    p.push(tag(line([[22, -3.4, DK + 8], [-2, -3.4, DK + 1]], { tone: 'mid' }), 'lifeboat'));
    p.push(tag(line([[22, 3.4, DK + 8], [-2, 3.4, DK + 1]], { tone: 'mid' }), 'lifeboat'));
    p.push(tag(hcyl('x', [30, 0, DK + 11], 3.6, 16, { cls: 'c-boat' }), 'lifeboat'));
    p.push(tag(box(24, -4, DK + 3, 12, 8, 3.2, { cls: 'c-dark' }), 'lifeboat'));
    // forecastle: windlass, chain, anchor, bollards
    p.push(tag(box(276, -6, DK + 0.6, 10, 12, 4, { cls: 'c-dark' }), 'anchor'));
    p.push(tag(hcyl('y', [281, 0, DK + 6.2], 2, 9, { cls: 'c-pipe' }), 'anchor'));
    p.push(tag(line([[288, 3, DK + 0.6], [296, 1, DK - 4], [298, 1, DK - 14]], { tone: 'mid' }), 'anchor'));
    p.push(tag(box(296.4, -1.2, DK - 20, 2.4, 2.4, 6, { cls: 'c-dark' }), 'anchor'));
    for (const y of [-9, 9]) p.push(tag(post(270, y * 0.9, DK + 0.6, 3, 1.4, { cls: 'c-dark', steps: 8 }), 'anchor'));
    make('house', p);
    A('house', 'house', [56, 0, H.z0 + H.decks * H.dz + 4]); A('lifeboat', 'house', [30, 0, DK + 16]); A('anchor', 'house', [282, 0, DK + 8]);
  }

  // ============ navigation =============================================================================================
  {
    const p = [];
    const zt = V.house.z0 + V.house.decks * V.house.dz;          // 71.6
    p.push(tag(box(56, -17, zt, 14, 34, 8, { cls: 'c-glass', crease: 'none', tone: 'mid' }), 'bridge'));
    p.push(tag(box(60, -24, zt + 1, 8, 48, 1.2, { cls: 'c-white', crease: 'none' }), 'bridge'));
    p.push(tag(box(56, -17, zt + 8, 14, 34, 1.4, { cls: 'c-white' }), 'bridge'));
    // consoles inside: ECDIS, radar display, autopilot, gyro
    p.push(tag(box(64, -10, zt + 0.5, 3.4, 8, 3.6, { cls: 'c-panel' }), 'ecdis'));
    p.push(tag(box(64, 2, zt + 0.5, 3.4, 8, 3.6, { cls: 'c-panel' }), 'ecdis'));
    p.push(tag(box(60, -3, zt + 0.5, 3, 6, 3, { cls: 'c-dark' }), 'ecdis'));
    p.push(tag(post(58.5, -12, zt + 0.5, 3.6, 1.4, { cls: 'c-gyro', steps: 10 }), 'ecdis'));
    p.push(tag(line([[65.8, -10, zt + 4.1], [65.8, -2, zt + 4.1]], { tone: 'lit' }), 'ecdis'));
    // mast and antennas
    p.push(tag(post(60, 0, zt + 9.4, 18, 0.9, { cls: 'c-pipe', steps: 8 }), 'radar'));
    p.push(tag(post(60, 0, zt + 27.4, 1.4, 1.8, { cls: 'c-dark', steps: 10 }), 'radar'));
    p.push(tag(post(64, 8, zt + 9.4, 4, 1.6, { cls: 'c-white', steps: 10 }), 'radar'));                         // GPS dome
    p.push(tag(line([[57, -6, zt + 9.4], [57, -6, zt + 22]], { tone: 'hi' }), 'radar'));                      // AIS whip
    p.push(tag(line([[60, 0, zt + 20], [70, 0, zt + 9.4]], { tone: 'lo' }), 'radar'));
    p.push(tag(line([[60, 0, zt + 20], [50, 0, zt + 9.4]], { tone: 'lo' }), 'radar'));
    make('nav', p, `<g id="v-radar" class="item" data-item="radar"></g>`);
    V.radar = [60, 0, zt + 28.8];
    A('bridge', 'nav', [63, 14, zt + 10]); A('radar', 'nav', [60, 0, zt + 32]); A('ecdis', 'nav', [64, -6, zt + 6]);
  }

  // ---- the figure ---------------------------------------------------------------------------------------------
  const order = ['hull', 'piping', 'engine', 'electrical', 'cargo', 'house', 'nav'];
  const sysOf = { hull: 'hull', piping: 'other', engine: 'engine', electrical: 'elec', cargo: 'other', house: 'other', nav: 'nav' };
  const body = order.map((k) => T.g(layers[k].svg, { class: `lyr lyr-${sysOf[k]}`, 'data-sys': sysOf[k], 'data-lyr': k, id: `lyr-${k}` })).join('');
  const svg = `<svg id="svg-vessel" class="iso-svg fig" viewBox="0 0 1200 640" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Container ship in cutaway: hull with double bottom and ballast tanks, engine room with two-stroke engine, shaft and propeller, electrical system, navigation bridge, cargo holds and accommodation. 컨테이너선 단면도: 이중저와 밸러스트 탱크가 있는 선체, 기관실, 프로펠러, 전기 시스템, 선교 항해 장비, 화물창, 거주구.">${body}<g id="v-halo"></g></svg>`;

  const anchors = {};
  for (const [k, v] of Object.entries(items)) anchors[k] = v;
  const boxes = {};
  for (const k of order) boxes[k] = T.screenBox(layers[k].parts);
  return { svg, meta: { anchors, boxes, items: Object.fromEntries(Object.entries(items).map(([k, v]) => [k, v])), nums: { radar: V.radar, propX: V.propX, propR: V.propR, shaftZ: V.shaftZ, lift: V.lift } } };
}
