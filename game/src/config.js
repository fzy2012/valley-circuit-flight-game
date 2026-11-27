// Valley Circuit — every tunable in one place: world shape, flight model,
// course layout and the palette the renderer paints with. Other modules read
// these numbers; none of them hard-code their own.

export const WORLD = {
  seed: 7,
  // The valley runs north (+Z). Its centre line wanders with two slow sines.
  valleyWanderA: 160,
  valleyWanderAFreq: 0.00045,
  valleyWanderB: 60,
  valleyWanderBFreq: 0.0013,
  valleyHalfWidth: 250,      // flat-ish floor out to this distance from centre
  mountainStart: 240,        // mountains begin rising here
  mountainFull: 950,         // and reach full height here
  mountainHeight: 300,
  floorBase: 5,              // valley floor elevation, metres
  courseEndZ: 4300,          // valley closes into mountains past here
  startWallZ: -420,          // and behind the start runway
};

export const RUNWAYS = {
  elevation: 6,
  width: 30,
  // Takeoff strip at the south end, landing strip at the north end.
  a: { zFrom: -300, zTo: 80 },
  b: { zFrom: 3780, zTo: 4160 },
};

export const FLIGHT = {
  startZ: -210,              // parked position on runway A
  gearHeight: 1.7,           // fuselage origin height above the ground on gear
  maxSpeed: 82,              // m/s at full throttle, level
  stallSpeed: 21,
  thrustAccel: 15,           // m/s^2 at full throttle
  dragK: 0.0022,             // quadratic drag coefficient
  gravity: 9.8,
  pitchRate: 1.15,           // rad/s toward the commanded pitch
  pitchMaxUp: 0.55,
  pitchMaxDown: -0.62,
  rollRate: 2.4,             // rad/s toward the commanded bank
  rollMax: 1.05,
  fuelStart: 100,
  fuelBurnBase: 0.5,         // per second, engine idling
  fuelBurnThrottle: 1.35,    // extra per second at full throttle
};

export const COURSE = {
  ringCount: 8,
  ringFirstZ: 560,
  ringSpacing: 385,
  ringRadius: 26,
  ringScore: 150,
  finishTimeBonusMax: 600,   // decays 2 points per second of flight
  landingBonusMax: 300,
};

export const PALETTE = {
  skyTop: '#2e63a8',
  skyHorizon: '#cfe8f7',
  fog: '#c3dcee',
  sun: '#fff3c4',
  grassLow: '#5d9c4e',
  grassHigh: '#7fae56',
  scrub: '#a9a06b',
  rock: '#8d8578',
  snow: '#f4f7f5',
  runway: '#3c4147',
  runwayEdge: '#e8e8e2',
  ringNext: '#ffc93c',
  ringOpen: '#39c2d7',
  ringDone: '#57d977',
  ringMissed: '#5a6672',
  planeBody: '#e8542f',
  planeTrim: '#f7f3e8',
  planeWing: '#d8431f',
  canopy: '#9fd8ef',
  panel: '#10151d',
  panelEdge: '#2b3644',
  litAmber: '#ffb347',
  litCyan: '#6fe3ff',
  litGreen: '#7dff8a',
  litRed: '#ff5a4e',
  hudText: '#eaf6ff',
};
