// The valley's shape: one height function every other module agrees on.
// The renderer draws it, the flight model collides with it, the course is
// laid over it. A winding flat floor, mountains on both sides, both runway
// strips pressed perfectly flat, and the valley walled off at both ends.

import { WORLD, RUNWAYS } from './config.js';
import { fbm, mulberry } from './noise.js';

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(edge0, edge1, v) {
  const t = clamp01((v - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

// The valley centre line's x at a given z.
export function valleyCenterX(z) {
  return WORLD.valleyWanderA * Math.sin(z * WORLD.valleyWanderAFreq)
       + WORLD.valleyWanderB * Math.sin(z * WORLD.valleyWanderBFreq);
}

// Is (x, z) on a runway strip? Returns 'a', 'b' or null. The strips follow
// the valley centre, with a small apron margin around the asphalt.
export function runwayAt(x, z) {
  const dx = Math.abs(x - valleyCenterX(z));
  if (dx > RUNWAYS.width / 2 + 14) return null;
  if (z >= RUNWAYS.a.zFrom - 20 && z <= RUNWAYS.a.zTo + 20) return 'a';
  if (z >= RUNWAYS.b.zFrom - 20 && z <= RUNWAYS.b.zTo + 20) return 'b';
  return null;
}

// How strongly the runway flattening applies at (x, z): 1 on the asphalt,
// fading to 0 at the apron edge, so the strips sit in the valley naturally.
function runwayBlend(x, z) {
  const dx = Math.abs(x - valleyCenterX(z));
  const across = 1 - smoothstep(RUNWAYS.width / 2 - 2, RUNWAYS.width / 2 + 16, dx);
  if (across <= 0) return 0;
  let along = 0;
  for (const r of [RUNWAYS.a, RUNWAYS.b]) {
    const inZ = smoothstep(r.zFrom - 46, r.zFrom + 10, z) * (1 - smoothstep(r.zTo - 10, r.zTo + 46, z));
    along = Math.max(along, inZ);
  }
  return across * along;
}

// Ground height in metres at (x, z). Pure function of the world seed.
export function terrainHeight(x, z) {
  const dx = Math.abs(x - valleyCenterX(z));
  // Rolling floor: gentle undulation, never steep enough to surprise.
  let h = WORLD.floorBase + 4.5 * fbm(x, z, 210, WORLD.seed + 3) + 1.2 * fbm(x, z, 47, WORLD.seed + 4);
  // Mountains: rise with distance from the centre line, shaped by big noise
  // so the two walls differ and carry ridges of their own.
  const rise = Math.pow(smoothstep(WORLD.mountainStart, WORLD.mountainFull, dx), 1.55);
  if (rise > 0) {
    const bulk = 0.72 + 0.5 * fbm(x, z, 620, WORLD.seed + 5);
    h += rise * WORLD.mountainHeight * bulk + rise * 26 * fbm(x, z, 130, WORLD.seed + 6);
  }
  // End walls: the valley closes behind the start and past the far runway.
  // The south wall rises over the 420 m south of the start strip's end
  // (startWallZ + 120 = -300, the strip's zFrom): full height at z = -720,
  // nothing at the strip itself. Written as one ascending smoothstep — the
  // reversed-edge form silently saturated to 1 across the whole course.
  const endRise = smoothstep(WORLD.courseEndZ, WORLD.courseEndZ + 420, z)
                + smoothstep(0, 420, (WORLD.startWallZ + 120) - z);
  if (endRise > 0) h += Math.min(endRise, 1) * 190 * (0.8 + 0.4 * fbm(x, z, 300, WORLD.seed + 8));
  // Runways are pressed to their exact elevation.
  const blend = runwayBlend(x, z);
  if (blend > 0) h = h + (RUNWAYS.elevation - h) * blend;
  return h;
}

// Surface slope at (x, z), as the steepest rise over run in a 6 m probe:
// the flight model uses it to tell a landing from a hillside strike.
export function terrainSlope(x, z) {
  const e = 6;
  const h = terrainHeight(x, z);
  const dx = Math.max(Math.abs(terrainHeight(x + e, z) - h), Math.abs(terrainHeight(x - e, z) - h));
  const dz = Math.max(Math.abs(terrainHeight(x, z + e) - h), Math.abs(terrainHeight(x, z - e) - h));
  return Math.max(dx, dz) / e;
}

// Ground colour for one terrain quad, from its height, slope and a noise
// variation: grass on the floor, scrub and rock up the walls, snow on top.
export function groundColor(h, slope, x, z, out) {
  const vary = 0.92 + 0.16 * (fbm(x, z, 90, WORLD.seed + 9) * 0.5 + 0.5);
  let r, g, b;
  if (slope > 0.85 || h > 150) {
    r = 141; g = 133; b = 120;                       // rock
  } else if (h > 96) {
    r = 169; g = 160; b = 107;                       // scrub
  } else {
    const t = Math.min(1, Math.max(0, (h - 4) / 90));
    r = 84 + (122 - 84) * t;                         // grassLow -> grassHigh
    g = 148 + (172 - 148) * t;
    b = 66 + (82 - 66) * t;
  }
  if (h > 235) { r = 244; g = 247; b = 245; }        // snow line
  out[0] = r * vary; out[1] = g * vary; out[2] = b * vary;
  return out;
}

// Scatter: pine trees on the lower slopes and a few hangars by the runways.
// Precomputed once from the seed; the renderer draws what is near.
export function buildScatter() {
  const rand = mulberry(WORLD.seed * 7919 + 13);
  const trees = [];
  for (let i = 0; i < 900 && trees.length < 420; i++) {
    const z = -350 + rand() * 4650;
    const side = rand() < 0.5 ? -1 : 1;
    const off = 60 + rand() * 620;
    const x = valleyCenterX(z) + side * off;
    if (runwayAt(x, z)) continue;
    const h = terrainHeight(x, z);
    if (h > 120 || terrainSlope(x, z) > 0.75) continue;
    trees.push({ x, z, h, s: 0.8 + rand() * 0.9 });
  }
  const hangars = [];
  for (const r of [RUNWAYS.a, RUNWAYS.b]) {
    const z = (r.zFrom + r.zTo) / 2;
    const cx = valleyCenterX(z);
    hangars.push({ x: cx + 44, z: z - 40, w: 26, d: 18, h: 9, rot: 0.12 });
    hangars.push({ x: cx - 48, z: z + 55, w: 20, d: 14, h: 7, rot: -0.08 });
  }
  return { trees, hangars };
}
