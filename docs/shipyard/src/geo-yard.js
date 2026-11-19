// The yard figure: static markup for every part that does not change shape, plus the
// anchors and boxes the live code needs. Runs in Node at build time.
import { LAYOUT, HULL, BLOCKS, slotX, slotY, slotZ, REST_GX } from './model.js';
import { tools, hullRing, halfBreadth } from './geo-common.js';

const SH = LAYOUT.shops;
const DOCK = LAYOUT.dock;
const SEA_X1 = LAYOUT.plate.w;

export function yardBounds() {
  const W = LAYOUT.plate.w, D = LAYOUT.plate.d;
  const pts = [];
  for (const x of [0, W]) for (const y of [0, D]) for (const z of [-44, 0]) pts.push([x, y, z]);
  pts.push([300, 300, LAYOUT.craneZ + 22], [60, 20, 70], [660, 330, 100], [W, 392, 120]);
  return pts;
}

export function buildYard(K, P) {
  const T = tools(K, P);
  const { box, post, prism, line, mark, flatPoly, hcyl } = T;
  const out = { fac: {}, meta: { anchors: {}, boxes: {} } };

  // ---- ground: land, dock floor, sea bed --------------------------------------------------------
  const ground = [
    box(0, 0, -44, LAYOUT.plate.w, DOCK.y0, 44, { cls: 'c-land', crease: 'none', tone: 'mid' }),
    box(0, DOCK.y0, -44, DOCK.x0, LAYOUT.plate.d - DOCK.y0, 44, { cls: 'c-land', crease: 'none', tone: 'mid' }),
    box(DOCK.x0, DOCK.y0, -44, DOCK.x1 - DOCK.x0, LAYOUT.plate.d - DOCK.y0, 8, { cls: 'c-bed', crease: 'none', tone: 'mid' }),
    box(DOCK.x1, DOCK.y0, -44, LAYOUT.plate.w - DOCK.x1, LAYOUT.plate.d - DOCK.y0, 8, { cls: 'c-bed', crease: 'none', tone: 'mid' }),
  ];
  // roads and the pad (paint on the land)
  const roads = [
    flatPoly([[4, 134], [556, 134], [556, 148], [4, 148]], 0.1, { cls: 'iso-solid c-road', tone: 'lo' }),
    flatPoly([[493, 148], [507, 148], [507, 318], [493, 318]], 0.1, { cls: 'iso-solid c-road', tone: 'lo' }),
    flatPoly([[LAYOUT.pad.x - 34, LAYOUT.pad.y - 26], [LAYOUT.pad.x + 34, LAYOUT.pad.y - 26], [LAYOUT.pad.x + 34, LAYOUT.pad.y + 26], [LAYOUT.pad.x - 34, LAYOUT.pad.y + 26]], 0.1, { cls: 'iso-solid c-pad', tone: 'mid' }),
    mark([[8, 141], [552, 141]], 0.2, { dashed: true, tone: 'mid' }),
    mark([[500, 150], [500, 316]], 0.2, { dashed: true, tone: 'mid' }),
  ];
  // the dock floor: filling culverts
  const culverts = [0, 1, 2].map((i) => box(DOCK.x0 + 10 + i * 8, DOCK.y0 + 22 + i * 12, -36, 5, 7, 0.4, { cls: 'c-dark', crease: 'none', tone: 'lo' }));
  // a paved quay edge along the sea and dock edge
  const edges = [
    box(DOCK.x0, DOCK.y0 - 4, -2, DOCK.x1 - DOCK.x0, 4, 2, { cls: 'c-curb', crease: 'none', tone: 'mid' }),
    box(DOCK.x1, DOCK.y0 - 4, -2, LAYOUT.plate.w - DOCK.x1, 4, 2, { cls: 'c-curb', crease: 'none', tone: 'mid' }),
  ];
  out.ground = T.svgOf([...ground, ...roads]) + T.svgOf(edges);

  // ---- shops ---------------------------------------------------------------------------------------
  const shell = (k) => {
    const s = SH[k], w = s.w, d = s.d, h = s.h;
    const parts = [
      box(s.x, s.y, 0, w, d, 1, { cls: 'c-floor', crease: 'none', tone: 'lo' }),
      box(s.x, s.y, 1, w, 3, h, { cls: 'c-wall' }),                       // back wall
      box(s.x, s.y + 3, 1, 3, d - 3, 9, { cls: 'c-wall', crease: 'none' }), // low side wall
      post(s.x + 2, s.y + d - 2, 1, h, 1.6, { cls: 'c-col' }),
      post(s.x + w - 2, s.y + d - 2, 1, h, 1.6, { cls: 'c-col' }),
      post(s.x + w - 2, s.y + 3.5 + (d - 8) * 0.45, 1, h, 1.4, { cls: 'c-col' }),
      box(s.x, s.y + d - 3, h - 2, w, 2.4, 2.4, { cls: 'c-beam', crease: 'none' }),
      box(s.x, s.y, h, w, d * 0.38, 1.6, { cls: 'c-roof', crease: 'none' }),   // the back part of the roof; the front stays open
      box(s.x, s.y + d * 0.62, h - 1, w, 1.4, 1.4, { cls: 'c-beam', crease: 'none' }),
    ];
    return parts;
  };
  const facParts = {};
  const sizeOf = (k) => SH[k];

  // warehouse: plate stock, pipe rack, cable reels, paint drums, engine parts, forklift
  {
    const s = SH.warehouse, p = shell('warehouse');
    p.push(box(s.x + 8, s.y + 12, 1, 38, 24, 4, { cls: 'c-plate' }), box(s.x + 11, s.y + 14, 5, 32, 20, 3, { cls: 'c-plate' }), box(s.x + 14, s.y + 16, 8, 26, 16, 3, { cls: 'c-plate' }));
    p.push(box(s.x + 58, s.y + 8, 1, 3, 3, 16, { cls: 'c-col' }), box(s.x + 90, s.y + 8, 1, 3, 3, 16, { cls: 'c-col' }));
    p.push(box(s.x + 58, s.y + 8, 7, 35, 3, 1.6, { cls: 'c-beam', crease: 'none' }), box(s.x + 58, s.y + 8, 14, 35, 3, 1.6, { cls: 'c-beam', crease: 'none' }));
    for (let i = 0; i < 3; i++) p.push(hcyl('x', [s.x + 76, s.y + 10 + 0.5, 10 + 2.6 + i * 0 + (i === 2 ? 5 : 0)], 2.6, 32, { cls: 'c-pipe' }));
    p[p.length - 1].bb[2] = s.y + 6; // keep the pipes in the rack
    p.push(hcyl('y', [s.x + 24, s.y + 68, 7], 7, 5, { cls: 'c-reel' }), hcyl('y', [s.x + 42, s.y + 82, 7], 7, 5, { cls: 'c-reel' }));
    for (const [dx, dy] of [[70, 62], [78, 62], [70, 70], [78, 70]]) p.push(post(s.x + dx, s.y + dy, 1, 8, 3.2, { cls: 'c-drum', steps: 12 }));
    p.push(box(s.x + 58, s.y + 86, 1, 30, 14, 9, { cls: 'c-crate' }), post(s.x + 66, s.y + 93, 10, 3, 3, { cls: 'c-dark', steps: 10 }));
    p.push(box(s.x + 12, s.y + 94, 1, 14, 9, 5, { cls: 'c-fork' }), box(s.x + 24, s.y + 96, 1, 1.5, 5, 13, { cls: 'c-dark', crease: 'none' }));
    facParts.warehouse = p;
  }
  // cutting shop: stack, cutting table with slats, portal, dust hood
  {
    const s = SH.cutting, p = shell('cutting');
    p.push(box(s.x + 5, s.y + 12, 1, 22, 16, 5, { cls: 'c-plate' }), box(s.x + 7, s.y + 14, 6, 18, 12, 3, { cls: 'c-plate' }));
    p.push(box(s.x + 18, s.y + 36, 1, 62, 46, 4, { cls: 'c-table' }));                      // the table, top at z 5
    for (let i = 0; i < 9; i++) p.push(line([[s.x + 20 + i * 6.4, s.y + 37, 5.1], [s.x + 20 + i * 6.4, s.y + 81, 5.1]], { tone: 'lo' }));
    p.push(box(s.x + 12, s.y + 32, 1, 70, 2.4, 2, { cls: 'c-rail' }), box(s.x + 12, s.y + 86, 1, 70, 2.4, 2, { cls: 'c-rail' }));
    p.push(post(s.x + 82, s.y + 22, 1, 28, 4.5, { cls: 'c-dark', steps: 14 }));             // dust extractor
    p.push(line([[s.x + 82, s.y + 22, 29], [s.x + 82, s.y + 60, 20], [s.x + 60, s.y + 60, 8]], { tone: 'mid' }));
    facParts.cutting = p;
  }
  // welding shop: panel line with rollers, SAW portal, FCAW robot, flux hopper, gas bottles
  {
    const s = SH.welding, p = shell('welding');
    p.push(box(s.x + 10, s.y + 38, 1, 76, 40, 4, { cls: 'c-table' }));
    for (let i = 0; i < 8; i++) p.push(line([[s.x + 14 + i * 9, s.y + 39, 5.1], [s.x + 14 + i * 9, s.y + 77, 5.1]], { tone: 'lo' }));
    p.push(box(s.x + 8, s.y + 32, 1, 80, 2.4, 2, { cls: 'c-rail' }), box(s.x + 8, s.y + 84, 1, 80, 2.4, 2, { cls: 'c-rail' }));
    // SAW portal over the bed with two heads and a flux hopper
    p.push(box(s.x + 24, s.y + 31, 1, 3, 3, 24, { cls: 'c-col' }), box(s.x + 24, s.y + 83, 1, 3, 3, 24, { cls: 'c-col' }), box(s.x + 23, s.y + 31, 25, 5, 55, 4, { cls: 'c-beam' }));
    p.push(box(s.x + 24.5, s.y + 50, 10.5, 2.5, 2.5, 14.5, { cls: 'c-dark', crease: 'none' }), box(s.x + 24.5, s.y + 62, 10.5, 2.5, 2.5, 14.5, { cls: 'c-dark', crease: 'none' }), post(s.x + 26, s.y + 70, 25, 8, 3.6, { cls: 'c-drum', steps: 12 }));
    // robot: its torch reaches the panel's right end (the panel stops at the weld station, centred at x + 40)
    p.push(post(s.x + 76, s.y + 26, 1, 5, 6, { cls: 'c-dark', steps: 14 }), post(s.x + 76, s.y + 26, 6, 9, 2.6, { cls: 'c-robot', steps: 12 }));
    p.push(line([[s.x + 76, s.y + 26, 15], [s.x + 70, s.y + 42, 28], [s.x + 56, s.y + 58, 14]], { tone: 'hi', cls: 'arm' }));
    p.push(box(s.x + 54.7, s.y + 56.7, 10.2, 2.6, 2.6, 5, { cls: 'c-robot', crease: 'none' }));
    for (let i = 0; i < 3; i++) p.push(post(s.x + 8 + i * 5.5, s.y + 14, 1, 14, 2, { cls: 'c-gas', steps: 10 }));
    p.push(box(s.x + 54, s.y + 14, 1, 14, 9, 10, { cls: 'c-machine' }));
    p.push(line([[s.x + 68, s.y + 19, 5], [s.x + 76, s.y + 22, 1.2], [s.x + 76, s.y + 25, 5]], { tone: 'lo', dashed: true }));
    facParts.welding = p;
  }
  // assembly shop: block bed on jigs, sub-assembly stands, bridge crane, scaffold, pre-outfit
  {
    const s = SH.assembly, p = shell('assembly');
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) p.push(box(s.x + 24 + c * 17, s.y + 42 + r * 28, 1, 5, 5, 4, { cls: 'c-jig' }));
    p.push(box(s.x + 18, s.y + 36, 4, 66, 44, 1, { cls: 'c-table', crease: 'none' }));
    p.push(box(s.x + 8, s.y + 14, 1, 24, 18, 3, { cls: 'c-jig' }), box(s.x + 12, s.y + 17, 4, 16, 12, 5, { cls: 'c-plate' }));
    p.push(box(s.x + 4, s.y + 6, 43, s.w - 8, 2.4, 2.4, { cls: 'c-rail' }), box(s.x + 4, s.y + 104, 43, s.w - 8, 2.4, 2.4, { cls: 'c-rail' }));
    p.push(box(s.x + 54, s.y + 6, 41, 3.4, 100, 3.4, { cls: 'c-beam' }), box(s.x + 54, s.y + 52, 36, 6, 6, 5, { cls: 'c-dark' }));
    p.push(line([[s.x + 57, s.y + 55, 36], [s.x + 57, s.y + 55, 28]], { tone: 'hi' }), box(s.x + 55, s.y + 54, 24, 4, 4, 4, { cls: 'c-hook' }));
    // scaffold on the right: two levels
    for (const [dx, dy] of [[92, 38], [92, 86], [104, 38], [104, 86]]) p.push(box(s.x + dx, s.y + dy, 1, 1.6, 1.6, 26, { cls: 'c-col', crease: 'none' }));
    p.push(box(s.x + 91, s.y + 37, 11, 15, 51, 1.4, { cls: 'c-plank' }), box(s.x + 91, s.y + 37, 22, 15, 51, 1.4, { cls: 'c-plank' }));
    p.push(hcyl('x', [s.x + 38, s.y + 92, 6], 2.4, 34, { cls: 'c-pipe' }), line([[s.x + 20, s.y + 96, 5.5], [s.x + 78, s.y + 96, 5.5], [s.x + 78, s.y + 64, 5.5]], { tone: 'mid', dashed: true }));
    facParts.assembly = p;
  }
  // painting shop: blast booth, dust collector, spray robot, drying bay, paint tank
  {
    const s = SH.painting, p = shell('painting');
    p.push(box(s.x + 8, s.y + 30, 1, 82 - 4, 2, 24, { cls: 'c-glass', crease: 'none', tone: 'mid' }));    // the booth back
    p.push(box(s.x + 8, s.y + 30, 1, 2, 66, 24, { cls: 'c-glass', crease: 'none', tone: 'mid' }));
    p.push(box(s.x + 18, s.y + 40, 1, 52, 46, 4, { cls: 'c-table' }));
    p.push(post(s.x + 90, s.y + 18, 1, 38, 5.5, { cls: 'c-dark', steps: 14 }), line([[s.x + 90, s.y + 18, 36], [s.x + 60, s.y + 34, 30], [s.x + 60, s.y + 34, 22]], { tone: 'mid' }));
    p.push(post(s.x + 82, s.y + 78, 1, 6, 5, { cls: 'c-dark', steps: 12 }), line([[s.x + 82, s.y + 78, 7], [s.x + 70, s.y + 68, 19], [s.x + 56, s.y + 62, 14]], { tone: 'hi', cls: 'arm' }));
    p.push(post(s.x + 90, s.y + 98, 1, 20, 6.5, { cls: 'c-tank', steps: 16 }), line([[s.x + 90, s.y + 98, 14], [s.x + 82, s.y + 90, 14], [s.x + 82, s.y + 80, 7]], { tone: 'mid', dashed: true }));
    p.push(box(s.x + 14, s.y + 102, 1, 36, 13, 18, { cls: 'c-oven', tone: 'mid' }));                  // drying bay
    for (let i = 0; i < 4; i++) p.push(line([[s.x + 18 + i * 8, s.y + 105, 16], [s.x + 18 + i * 8, s.y + 105, 6]], { tone: 'mid', dashed: true }));
    facParts.painting = p;
  }
  const facOrder = ['warehouse', 'cutting', 'welding', 'assembly', 'painting'];
  out.shopsSvg = facOrder.map((k) => T.g(T.svgOf(T.paint(facParts[k])), { 'data-fac': k, class: 'fac' })).join('');
  for (const k of facOrder) {
    out.meta.boxes[k] = T.screenBox(facParts[k]);
    const s = SH[k];
    out.meta.anchors[k] = K.iso([s.x + s.w / 2, s.y + s.d - 6, s.h + 4], P);
  }

  // ---- dock: keel blocks, rails, posts, gate -----------------------------------------------------------
  const cy = slotY(), hb = HULL.beam / 2;
  const dock = [];
  for (let i = 0; i < 11; i++) dock.push(box(HULL.x0 + 10 + i * 25, cy - 5, LAYOUT.floor, 10, 10, LAYOUT.keelH, { cls: 'c-keel', crease: 'none' }));
  for (let i = 0; i < 5; i++) dock.push(post(DOCK.x0 + 40 + i * 70, DOCK.y0 - 2, -2, 3, 1.6, { cls: 'c-dark', steps: 10 }));      // bollards on the north edge
  out.dockBackSvg = T.svgOf(T.paint(dock));
  // north gantry rail on the land, south rail on piles
  const rails = [
    box(DOCK.x0 + 10, 378, 0, DOCK.x1 - DOCK.x0 - 20, 3, 1.8, { cls: 'c-rail', crease: 'none' }),
  ];
  out.northRail = T.svgOf(rails);
  const piles = [];
  for (let i = 0; i < 8; i++) piles.push(box(DOCK.x0 + 12 + i * 48, 457, LAYOUT.floor, 4, 4, -LAYOUT.floor - 2, { cls: 'c-pile', crease: 'none' }));
  piles.push(box(DOCK.x0 + 10, 456, -2, DOCK.x1 - DOCK.x0 - 20, 6, 3.6, { cls: 'c-rail' }));
  out.southRail = T.svgOf(T.paint(piles));
  out.gate = T.svgOf([box(DOCK.x1 - 3, DOCK.y0, LAYOUT.floor, 6, DOCK.y1 - DOCK.y0, -LAYOUT.floor - 2, { cls: 'c-gate' })]) +
    T.svgOf([0, 1, 2, 3].map((i) => line([[DOCK.x1 + 3.2, DOCK.y0 + 4, LAYOUT.floor + 6 + i * 9], [DOCK.x1 + 3.2, DOCK.y1 - 4, LAYOUT.floor + 6 + i * 9]], { tone: 'mid' })));
  out.meta.boxes.dock = T.screenBox([box(DOCK.x0, DOCK.y0, LAYOUT.floor, DOCK.x1 - DOCK.x0, DOCK.y1 - DOCK.y0, 90)]);
  out.meta.boxes.quay = T.screenBox([box(520, 340, -30, 300, 122, 100)]);

  // ---- the hull: six blocks (placed copy and carried copy are the same shapes) ---------------------------------------------
  const blockParts = (i) => {
    const b = BLOCKS[i];
    const ring = hullRing(HULL.length, hb, cy, b.a / HULL.length, b.b / HULL.length, 5).map(([x, y]) => [x + HULL.x0, y]);
    const z0 = slotZ();
    const low = prism(ring, z0, HULL.draftUnits, { cls: 'c-red' });
    const up = prism(ring, z0 + HULL.draftUnits, HULL.height - HULL.draftUnits, { cls: 'c-navy' });
    const topz = z0 + HULL.height;
    const x0 = HULL.x0 + b.a, x1 = HULL.x0 + b.b;
    const hbAt = (x) => hb * halfBreadth((x - HULL.x0) / HULL.length);
    const dets = [];
    // deck details: hatch coaming rectangle on the hold blocks, a seam line at the stern edge of the block
    dets.push(line([[x0, cy - hbAt(x0), topz], [x0, cy + hbAt(x0), topz]], { tone: 'hi', cls: 'seam' }));
    if (i >= 2 && i <= 4) dets.push(mark([[x0 + 6, cy - 12], [x1 - 6, cy - 12], [x1 - 6, cy + 12], [x0 + 6, cy + 12]], topz + 0.2, { tone: 'mid' }));
    if (i === 5) dets.push(line([[x0 + 4, cy, topz], [x1 - 14, cy, topz]], { tone: 'lo', dashed: true }));
    return [low, up, ...dets];
  };
  out.blocksSvg = BLOCKS.map((b) => T.g(T.svgOf(blockParts(b.i)), { 'data-block': b.i, class: 'blk' }));
  out.meta.boxes.hull = T.screenBox([box(HULL.x0, cy - hb, slotZ(), HULL.length, HULL.beam, HULL.height)]);

  // ---- the deckhouse the quay crane lifts: built at its final spot on the ship ----------------------------------
  const hx = 500 + 36, hy = cy, deckZ = LAYOUT.seaLevel - HULL.draftUnits + HULL.height;
  const house = [
    box(hx - 14, hy - 17, deckZ, 28, 34, 24, { cls: 'c-white' }),
    box(hx - 11, hy - 14, deckZ + 24, 22, 28, 8, { cls: 'c-white' }),
    box(hx - 9, hy - 19, deckZ + 32, 18, 38, 4, { cls: 'c-glass', crease: 'none' }),            // bridge wings
    post(hx, hy, deckZ + 36, 16, 1, { cls: 'c-dark', steps: 8 }),
  ];
  for (let r = 0; r < 4; r++) house.push(line([[hx + 14.1, hy - 14, deckZ + 5 + r * 5.5], [hx + 14.1, hy + 14, deckZ + 5 + r * 5.5]], { tone: 'mid', dashed: true }));
  out.houseSvg = T.svgOf(house);
  out.houseBase = [hx, hy, deckZ];

  // ---- the quay: wall fenders, bollards, jib crane base, the pallet the deckhouse waits on -----------------------------
  const quay = [];
  for (let i = 0; i < 6; i++) quay.push(box(DOCK.x1 + 16 + i * 55, DOCK.y0 + 0.2, -22, 8, 2, 14, { cls: 'c-fender', crease: 'none' }));
  for (let i = 0; i < 6; i++) quay.push(post(DOCK.x1 + 20 + i * 55, DOCK.y0 - 8, 0, 3, 1.8, { cls: 'c-dark', steps: 10 }));
  quay.push(box(538, 358, 0, 20, 16, 4, { cls: 'c-dark' }), box(542, 361, 4, 12, 10, 24, { cls: 'c-crane' }), box(541, 360, 28, 14, 12, 8, { cls: 'c-cab' }));
  quay.push(box(594, 351, 0, 36, 30, 5, { cls: 'c-plate' }));
  out.quaySvg = T.svgOf(T.paint(quay));
  out.quayPivot = [548, 366, 36];
  out.palletTop = [612, 366, 5];
  out.meta.anchors.quay = K.iso([620, 392, 40], P);
  out.meta.anchors.dock = K.iso([DOCK.x0 + 70, DOCK.y0 + 8, 6], P);
  out.meta.anchors.hull = K.iso([HULL.x0 + 100, cy, slotZ() + HULL.height + 6], P);
  out.meta.anchors.crane = K.iso([REST_GX, 296, LAYOUT.craneZ + 10], P);

  // ---- crane (built at REST_GX, moved by dx) -------------------------------------------------------------------------
  const gz = LAYOUT.craneZ, g = LAYOUT.gantry, cx = REST_GX;
  const craneFar = [], craneNear = [];
  for (const dx of [-34, 34]) {
    craneFar.push(box(cx + dx - 3, g.yN - 3, 0, 6, 6, gz, { cls: 'c-crane' }));
    craneNear.push(box(cx + dx - 3, g.yS - 3, -2, 6, 6, gz + 2, { cls: 'c-crane' }));
  }
  craneFar.push(box(cx - 40, g.yN - 4, gz - 8, 80, 8, 8, { cls: 'c-crane' }));
  craneNear.push(box(cx - 40, g.yS - 4, gz - 8, 80, 8, 8, { cls: 'c-crane' }));
  // cross braces on the legs
  for (const dx of [-34, 34]) {
    craneFar.push(line([[cx + dx, g.yN, 6], [cx + dx * 0.4, g.yN, gz - 8]], { tone: 'mid' }));
    craneNear.push(line([[cx + dx, g.yS, 4], [cx + dx * 0.4, g.yS, gz - 8]], { tone: 'mid' }));
  }
  const girder = [
    box(cx - 4, g.yCant, gz, 8, g.yS - g.yCant + 4, 12, { cls: 'c-crane' }),
    box(cx - 3, g.yCant - 12, gz + 12, 6, 18, 6, { cls: 'c-cab' }),
  ];
  // truss on the girder's visible side
  const tz0 = gz + 1.5, tz1 = gz + 10.5;
  const truss = [];
  const nSeg = 18;
  for (let i = 0; i <= nSeg; i++) {
    const y = g.yCant + ((g.yS - g.yCant) * i) / nSeg;
    truss.push([cx + 4.1, y, i % 2 ? tz1 : tz0]);
  }
  girder.push(line(truss, { tone: 'mid' }));
  out.craneBackSvg = T.svgOf(T.paint(craneFar));
  out.craneFrontSvg = T.svgOf(T.paint([...craneNear, ...girder]));
  out.trolleySvg = T.svgOf([box(-7, -5, 0, 14, 10, 6, { cls: 'c-trolley' }), box(-4, -3, 6, 8, 6, 4, { cls: 'c-cab' })]);   // built at the origin
  out.crane0 = { gx: cx, girderZ: gz + 12 };
  out.meta.boxes.crane = T.screenBox([box(cx - 44, g.yCant - 14, 0, 88, g.yS - g.yCant + 18, gz + 30)]);

  // ---- water: the sea (static) -------------------------------------------------------------------------------------------
  const seaZ = LAYOUT.seaLevel, W = LAYOUT.plate.w;
  const quad = (pts) => K.pathOf(pts.map((p) => K.iso(p, P)), true);
  out.seaTop = quad([[DOCK.x1, DOCK.y0, seaZ], [W, DOCK.y0, seaZ], [W, DOCK.y1, seaZ], [DOCK.x1, DOCK.y1, seaZ]]);
  out.seaBand = quad([[DOCK.x1, DOCK.y1, LAYOUT.floor], [W, DOCK.y1, LAYOUT.floor], [W, DOCK.y1, seaZ], [DOCK.x1, DOCK.y1, seaZ]]) +
    quad([[W, DOCK.y0, LAYOUT.floor], [W, DOCK.y1, LAYOUT.floor], [W, DOCK.y1, seaZ], [W, DOCK.y0, seaZ]]);

  // ---- the work piece that travels through the shops: four forms, drawn at the origin -----------------------------------------
  const wpPlate = [box(-15, -10, 0, 30, 20, 1.6, { cls: 'c-plate' })];
  const nest = [[-12, -7, 8, 6], [-2, -7, 6, 6], [6, -7, 7, 14], [-12, 1, 12, 6]].map(([x, y, w, d]) => K.onTop([[x, y], [x + w, y], [x + w, y + d], [x, y + d]], 1.7, P, true)).join('');
  const panel = [box(-16, -11, 0, 32, 22, 1.6, { cls: 'c-plate' })];
  for (const y of [-7, -1, 5]) panel.push(box(-16, y, 1.6, 32, 1.2, 3, { cls: 'c-ribs', crease: 'none' }));
  for (const x of [-9, 0, 9]) panel.push(box(x, -11, 1.6, 1.2, 22, 2, { cls: 'c-ribs', crease: 'none' }));
  const sub = [box(-14, -10, 0, 28, 20, 1.6, { cls: 'c-plate' })];
  for (const x of [-14, -5, 4, 13]) sub.push(box(x, -10, 1.6, 1.2, 20, 8, { cls: 'c-ribs', crease: 'none' }));
  sub.push(box(-14, -10, 9.6, 28, 1.2, 1.4, { cls: 'c-ribs', crease: 'none' }), box(-14, 8.8, 1.6, 28, 1.2, 8, { cls: 'c-plate' }));
  const blk = [box(-18, -12, 0, 36, 24, 16, { cls: 'c-plate' })];
  const frames = [-9, 0, 9].map((x) => line([[x, -12, 16.1], [x, 12, 16.1]], { tone: 'mid' })).concat([line([[-18, 0, 16.1], [18, 0, 16.1]], { tone: 'mid' })]);
  const primer = [box(-18, -12, 0, 36, 24, 16, { cls: 'c-primer' })];
  out.wpSvg = `<g id="wp-move"><g id="wp-plate" class="wpf">${T.svgOf(wpPlate)}<path id="wp-nest" class="iso-line nest" data-tone="hi" pathLength="1" d="${nest}"/></g>` +
    `<g id="wp-panel" class="wpf">${T.svgOf(T.paint(panel))}</g><g id="wp-sub" class="wpf">${T.svgOf(T.paint(sub))}</g>` +
    `<g id="wp-block" class="wpf">${T.svgOf(blk)}${T.svgOf(frames)}<g id="wp-primer">${T.svgOf(primer)}</g></g></g>`;
  out.wpSize = { block: [36, 24, 16] };

  return out;
}
