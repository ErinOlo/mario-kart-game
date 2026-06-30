// ============================================================
//  Vinted Kart — game configuration & data tables
// ============================================================

export const RACE = {
  durationSec: 150,        // 2.5-minute timer
  totalLaps: 3,            // finish early if you complete all laps
  roadWidth: 16,
  points: [10, 6, 3, 1],   // Mario Kart-style: 1st..4th
};

// Tuning for the arcade kart physics (units/sec).
export const KART = {
  maxSpeed: 58,
  accel: 42,
  reverseSpeed: 18,
  brakeForce: 70,
  drag: 0.9,               // passive friction multiplier (per-sec-ish)
  offTrackDrag: 0.55,      // heavy slowdown off the road
  turnRate: 2.1,           // rad/sec at full grip
  driftTurnBoost: 1.55,    // sharper rotation while drifting
  boostMult: 1.7,          // speed-boost power-up multiplier
  driftBoostSpeed: 26,     // instant speed added on a good drift release
  aiMaxSpeed: 52,          // capped so AI can't beat 2:30 easily
};

// ---- Track centerline control points (XZ plane, y = 0) ----
// A closed circuit with a mix of sweeping and tight turns for drifting.
export const TRACK_POINTS = [
  [0, 0, 0],
  [70, 0, -50],
  [150, 0, -55],
  [205, 0, -5],
  [195, 0, 70],
  [130, 0, 120],
  [55, 0, 130],
  [-25, 0, 150],
  [-95, 0, 115],
  [-120, 0, 45],
  [-100, 0, -35],
  [-45, 0, -65],
];

// ---- Racers: 1 player + 3 AI, each a kart made of a local food ----
//  color  = bright chunky kart body color
//  shirt  = driver's torso/jacket color
//  pants  = driver's legs color
export const RACERS = [
  { id: 'you', name: 'You',        food: 'currywurst', color: 0xff2e63, shirt: 0x1fa8ff, pants: 0xff7a18, player: true },
  { id: 'ai1', name: 'Brezel Bot', food: 'pretzel',    color: 0x2d7dff, shirt: 0x9b4dff, pants: 0x2b2b6b, player: false },
  { id: 'ai2', name: 'Döner Dan',  food: 'doner',      color: 0xffd23f, shirt: 0x2ecc40, pants: 0x1f7a2e, player: false },
  { id: 'ai3', name: 'Späti Sam',  food: 'beer',       color: 0xff4fa3, shirt: 0xff7a18, pants: 0x8a3bd6, player: false },
];

// ============================================================
//  POWER-UP LAYOUT
//  t = normalized position along the track (0..1).
//  side = lateral offset from centerline (-1 left .. +1 right).
//  type: boost | theme | mode | slowmo
// ============================================================
export const PICKUPS = [
  { t: 0.06, side: -0.45, type: 'boost' },
  { t: 0.12, side: 0.5,   type: 'theme',  theme: 'amsterdam' },
  { t: 0.20, side: 0.0,   type: 'boost' },
  { t: 0.27, side: 0.55,  type: 'slowmo' },
  { t: 0.34, side: -0.55, type: 'mode',   mode: 'bad' },
  { t: 0.42, side: 0.4,   type: 'boost' },
  { t: 0.50, side: -0.5,  type: 'theme',  theme: 'vilnius' },
  { t: 0.57, side: 0.0,   type: 'boost' },
  { t: 0.64, side: 0.55,  type: 'mode',   mode: 'good' },
  { t: 0.71, side: -0.55, type: 'slowmo' },
  { t: 0.78, side: 0.45,  type: 'theme',  theme: 'vinted' },
  { t: 0.85, side: -0.4,  type: 'boost' },
  { t: 0.92, side: 0.5,   type: 'theme',  theme: 'berlin' },
];

// ============================================================
//  THEMES — visual-only palettes & landmark sets.
//  Track geometry never changes; only the dressing swaps.
//  Each theme has good/bad palettes (mode toggle).
// ============================================================
export const THEMES = {
  berlin: {
    name: 'BERLIN',
    blurb: 'TV Tower, currywurst & techno',
    good: { sky: 0x6cc6ff, fog: 0xbdeaff, ground: 0x4fd35f, road: 0x1f9fff, accent: 0xff2e63 },
    bad:  { sky: 0x565a66, fog: 0x474a54, ground: 0x4a4d44, road: 0x26282f, accent: 0x8a8d99 },
  },
  amsterdam: {
    name: 'AMSTERDAM',
    blurb: 'Canals, windmills & stroopwafels',
    good: { sky: 0x7fe0d6, fog: 0xc6f3ee, ground: 0x4fd35f, road: 0x1fb6ff, accent: 0xff5ca8 },
    bad:  { sky: 0x5d646b, fog: 0x4d5258, ground: 0x4d5046, road: 0x2a2926, accent: 0x6f7a80 },
  },
  vilnius: {
    name: 'VILNIUS',
    blurb: 'Gediminas Tower, amber & hoops',
    good: { sky: 0xffd066, fog: 0xffe9bf, ground: 0x5fd84a, road: 0x7ed957, accent: 0xff3b2e },
    bad:  { sky: 0x60584e, fog: 0x4c463d, ground: 0x4f4a3e, road: 0x29251f, accent: 0x9a7f5e },
  },
  vinted: {
    name: 'VINTED',
    blurb: 'Mountains of secondhand fashion',
    good: { sky: 0xb6e6ff, fog: 0xdcf4ff, ground: 0x36d6b0, road: 0x1f9fff, accent: 0x0bd3dd },
    bad:  { sky: 0x585c66, fog: 0x474b54, ground: 0x46504a, road: 0x23272e, accent: 0x5f8a8c },
  },
};

export const THEME_ORDER = ['berlin', 'amsterdam', 'vilnius', 'vinted'];
