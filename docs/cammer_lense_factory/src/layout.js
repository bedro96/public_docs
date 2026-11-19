// Where things stand on the plant line. Pure numbers (no kit, no DOM) so the model, the scene and the tests agree.
// x runs along the flow line, y is across it (+y toward the viewer), z is up. One unit is roughly 6 cm.
// All positions are a schematic [assumption]: no public source gives LG Innotek's real layout.

export const BELT_Z = 9; // top of the line conveyor
export const TRAY_W = 11; // carrier tray footprint on the line (schematic)

// station centres on the line (x)
export const ST = {
  start: 24, pass: 162,
  printer: 206, mount1: 246, mount2: 282, reflow: 324, aoi: 354,
  plasma: 392, die: 430, wb1: 466, wb2: 492, wb3: 518, irc: 542,
  mag: 584, vcm: 622, stack: 662, xfer: 698,
  aa: 790, oven: 872,
  cal: 962, shake: 998, optic: 1036, otp: 1070, avi: 1102,
  tray: 1148, bag: 1186, carton: 1224, dock: 1316,
};

// the seven entry steps of the gowning routine, as floor markers in the receiving bay (x, y); the person walks them in order,
// then steps through the clean-room door at the end [the route is a schematic; the 7 steps are the 2017 report]
export const GOWN = [
  [34, 58], [58, 58], [82, 58], [106, 58], // gown+boots, sticky roller, static test, shoe wash
  [146, 50], // air shower (x 140..164)
  [180, 50], [198, 38], // second sticky roller and hand wash, just inside the wall
];
export const GOWN_DOOR = [210, 22];

// robots: base position and the role of the tool at the end of the arm
export const ROBOTS = [
  { id: 'lens', bay: 'lens', x: 640, y: -58, pedestal: 6, tool: 'grip', rest: [640, -30, 22] },
  { id: 'aa', bay: 'aa', x: 742, y: -58, pedestal: 6, tool: 'grip', rest: [742, -30, 22] },
  { id: 'pack', bay: 'pack', x: 1172, y: -58, pedestal: 6, tool: 'grip', rest: [1172, -30, 22] },
];

// the loading dock truck
export const TRUCK = { x0: 1470, x1: 1318, y: 8 };
