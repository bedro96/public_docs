// Where everything stands in the world (units of 0.1 m, x = flow direction). Pure constants, shared by the model and the scene.
// The plant is compressed in places: the supply map is schematic, the 3,500 km rail leg is broken, the hall is followed by a
// camera, and the runway keeps its TRUE length (1,640 m) so the take-off is measured on the real thing while the camera pans along it.
export const CENTRE = 197; // local x of the plane's mid-point
export const GZ = 32; // axis height when standing on its wheels
export const PITCH = 520; // 52 m between line positions = 2 in/min x ~17 h/day  [estimate]
export const X1 = 1300; // plane centre at line position 1 (flow day 1)
export const xDay = (d) => X1 + (d - 1) * PITCH;
export const DECK = 50; // raised level used in flow days 1-3 (5 m) [verified-secondary: "raised level"], height itself [estimate]
export const DECK_X = { x0: 1000, x1: 2620 };
export const RAMP_X0 = 560; // the ramp from the yard to the raised level starts here (schematic)
export const CRANE_Z = 270; // 89 ft = 27 m above the floor [verified-secondary]

export const MAP = { x0: -7100, x1: -4700, y0: -480, y1: 480 };
export const HUB = { x: -5050, y: 0, w: 320, d: 260 };
// schematic supplier nodes (positions invented for the map; modes of transport other than rail are NOT documented, so they are drawn as 'schematic')
export const SUPPLY = [
  { id: 'wichita', x: -6750, y: 340, crate: 'fus', mode: 'rail', win: [0.04, 0.80], ko: '위치타(캔자스)', en: 'Wichita, Kansas', what: { ko: '동체', en: 'fuselage' }, c: 'vs' },
  { id: 'auburn', x: -6000, y: -380, crate: 'wing', mode: 'truck', win: [0.10, 0.52], ko: '오번·프레더릭슨(워싱턴)', en: 'Auburn / Frederickson, WA', what: { ko: '날개 외판·스파', en: 'wing skins, spars' }, c: 'vs' },
  { id: 'kai', x: -6800, y: -250, crate: 'tail', mode: 'ship', win: [0.14, 0.86], ko: 'KAI(한국)', en: 'KAI, Korea', what: { ko: '수평 안정판', en: 'horizontal stabilizers' }, c: 'v' },
  { id: 'tata', x: -6700, y: -20, crate: 'fin', mode: 'air', win: [0.20, 0.90], ko: '타타 보잉(하이데라바드)', en: 'Tata Boeing, Hyderabad', what: { ko: '수직 꼬리 구조물', en: 'vertical-fin structures' }, c: 'u' },
  { id: 'cfm', x: -6500, y: 190, back: true, crate: 'eng', mode: 'truck', win: [0.26, 0.74], ko: 'CFM(LEAP-1B)', en: 'CFM, LEAP-1B', what: { ko: '엔진 2기', en: 'two engines' }, c: 'v' },
  { id: 'misc', x: -5750, y: 400, crate: 'gear', mode: 'truck', win: [0.32, 0.84], ko: '착륙장치·항공전자', en: 'Landing gear, avionics', what: { ko: '제작사 미확인', en: 'makers not confirmed' }, c: 'u' },
];
export const WICHITA = { x0: -4300, x1: -2300, y0: -380, y1: 380, cx: -3300 };
export const RAIL = { x0: -2300, x1: -300, y: 0, brk: -1300 };
export const YARD = { x0: -300, x1: 900, y0: -260, y1: 260, cx: 250, stop: 150 };
export const HALL = { x0: 900, x1: 6900, y0: -560, y1: 400 };
export const WINGBAY = { x0: 2250, x1: 3000, y0: -545, y1: -285 };
export const APRON = { x0: 6900, x1: 9700, y0: -340, y1: 340, stand: 8000 };
export const RWY = { x0: 10300, len: 16400, w: 610, start: 10600 }; // start = where the main wheels stand at brake release (30 m in)
export const RWY_END = RWY.x0 + RWY.len;
export const PIVOT = [194, 0, -GZ]; // main-gear ground contact in plane-local coordinates

// wings are built in the bay with the plane frame displaced by these offsets (world position of the wing's local origin)
export const WING_BAY = { S: { x: 2160, y: -320, z: 34 }, P: { x: 2410, y: -520, z: 34 } };
// the plane origin (tail, x=0) at the Wichita jigs
export const WICH_X = WICHITA.cx - CENTRE;
export const CART_X = 4850; // engine cart waits here (day 9, schematic)
