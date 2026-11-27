// The flight model: an arcade model with real discipline. Throttle sets the
// power, speed bleeds in a climb and builds in a dive, the turn rate comes
// from the bank angle, and below stall speed the nose drops and the sink
// grows — so the pilot who manhandles it gets told, in altitude.

import { FLIGHT } from './config.js';
import { terrainHeight, terrainSlope, runwayAt } from './terrain.js';

export function createAircraft(startX, startZ) {
  return {
    x: startX, y: 0, z: startZ,       // y is set by resetToRunway
    heading: 0,                        // radians, 0 = north (+Z), + = right
    pitch: 0,                          // radians, + = nose up
    roll: 0,                           // radians, + = right wing down
    speed: 0,                          // m/s along the flight path
    vy: 0,                             // last vertical speed, m/s (for touchdown)
    throttle: 0,
    fuel: FLIGHT.fuelStart,
    onGround: true,
    stalled: false,
    crashed: false,
    // commands, written by input each frame: -1..1 pitch/roll, throttle delta
    cmdPitch: 0, cmdRoll: 0, cmdThrottle: 0, brake: false,
  };
}

export function resetToRunway(ac, startX, startZ) {
  ac.x = startX; ac.z = startZ;
  ac.y = terrainHeight(startX, startZ) + FLIGHT.gearHeight;
  ac.heading = 0; ac.pitch = 0; ac.roll = 0;
  ac.speed = 0; ac.vy = 0; ac.throttle = 0;
  ac.fuel = FLIGHT.fuelStart;
  ac.onGround = true; ac.stalled = false; ac.crashed = false;
  ac.cmdPitch = 0; ac.cmdRoll = 0; ac.cmdThrottle = 0; ac.brake = false;
}

// Advance the model by dt seconds. Returns an event string when the sortie
// ends on this step: 'landed-far' (runway B), 'landed-valley', 'crashed',
// or null while still flying/rolling.
export function stepAircraft(ac, dt) {
  // Throttle and attitude chase their commands at fixed rates.
  ac.throttle = clamp(ac.throttle + ac.cmdThrottle * dt * 0.55, 0, 1);
  if (ac.fuel <= 0) ac.throttle = 0;
  const pitchTarget = ac.cmdPitch >= 0
    ? ac.cmdPitch * FLIGHT.pitchMaxUp
    : ac.cmdPitch * -FLIGHT.pitchMaxDown;
  ac.pitch += clamp(pitchTarget - ac.pitch, -FLIGHT.pitchRate * dt, FLIGHT.pitchRate * dt);
  // On the ground the bank command works the nose wheel instead: the strip
  // curves with the valley, so a takeoff roll has to be steerable. The wings
  // only lean a touch while rolling.
  const rollTarget = ac.cmdRoll * (ac.onGround ? 0.22 : FLIGHT.rollMax);
  ac.roll += clamp(rollTarget - ac.roll, -FLIGHT.rollRate * dt, FLIGHT.rollRate * dt);
  if (ac.onGround && ac.speed > 0.5) {
    ac.heading += ac.cmdRoll * 0.5 * dt * clamp(ac.speed / 12, 0.3, 1);
  }

  // Fuel burns with power; an empty tank is a glider.
  ac.fuel = Math.max(0, ac.fuel - dt * (FLIGHT.fuelBurnBase + FLIGHT.fuelBurnThrottle * ac.throttle));

  // Banked flight turns the nose; the rate fades as speed builds.
  const turnRate = (FLIGHT.gravity * Math.tan(clamp(ac.roll, -1.2, 1.2))) / Math.max(ac.speed, 16);
  if (!ac.onGround) ac.heading += turnRate * 0.92 * dt;

  // Speed: thrust against drag, gravity along the flight path.
  const thrust = ac.throttle * FLIGHT.thrustAccel;
  const drag = FLIGHT.dragK * ac.speed * ac.speed;
  let accel = thrust - drag - Math.sin(ac.pitch) * FLIGHT.gravity * 0.92;
  if (ac.onGround) accel -= ac.brake ? 6.5 : 0.35;
  ac.speed = Math.max(0, ac.speed + accel * dt);
  if (ac.onGround && ac.throttle === 0 && ac.speed < 0.4) ac.speed = 0;

  // Stall: too slow and the wing stops holding the nose up.
  ac.stalled = !ac.onGround && ac.speed < FLIGHT.stallSpeed;
  let sink = 0;
  if (ac.stalled) sink = (FLIGHT.stallSpeed - ac.speed) * 0.55 + 1.6;

  const cosP = Math.cos(ac.pitch);
  const fx = Math.sin(ac.heading) * cosP;
  const fz = Math.cos(ac.heading) * cosP;
  const prevY = ac.y;
  ac.x += fx * ac.speed * dt;
  ac.z += fz * ac.speed * dt;
  ac.y += Math.sin(ac.pitch) * ac.speed * dt - sink * dt;
  ac.vy = dt > 0 ? (ac.y - prevY) / dt : 0;

  // Ground contact.
  const ground = terrainHeight(ac.x, ac.z) + FLIGHT.gearHeight;
  if (ac.y <= ground) {
    ac.y = ground;
    const strip = runwayAt(ac.x, ac.z);
    const slope = terrainSlope(ac.x, ac.z);
    const hardHit = ac.vy < -8.5 || ac.speed > 46;
    if (!ac.onGround) {
      // Touchdown moment: judge it once.
      if (hardHit || slope > 0.55) { ac.crashed = true; return 'crashed'; }
      if (strip === 'b' && Math.abs(wrapAngle(ac.heading)) < 0.6) return 'landed-far';
      if (strip === 'a') { ac.onGround = true; return null; }   // bounced back onto the home strip
      return 'landed-valley';
    }
    ac.onGround = true;
    if (ac.speed > 26 && slope > 0.5) { ac.crashed = true; return 'crashed'; }
  } else if (ac.y > ground + 0.4) {
    ac.onGround = false;
  }
  // Rolling on the home strip and running out of it into the grass ends the
  // sortie gently once the plane slows; rolling fast into a wall crashes.
  if (ac.onGround && !runwayAt(ac.x, ac.z) && ac.speed < 2) return 'landed-valley';
  return null;
}

export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
