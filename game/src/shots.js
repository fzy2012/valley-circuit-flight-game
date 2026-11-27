// Deterministic scenes for the maker's screenshots, chosen with the URL:
//   ?shot=start  on the home runway, throttle up, the course ahead
//   ?shot=play   airborne mid-valley, banked toward the third ring
//   ?shot=ring   on final approach to a glowing ring, HUD lit
//   ?shot=end    the results board after a completed circuit
// Each scene poses the aircraft and the course directly — no physics runs —
// so a screenshot is the game's own render of a real game state, identical
// on every visit. shots.json at the repository root lists the same scenes.

import { RUNWAYS } from './config.js';
import { valleyCenterX } from './terrain.js';

export function shotNameFromUrl() {
  const params = new URLSearchParams(location.search);
  return params.get('shot');
}

function markRings(course, doneCount, missedIndex = -1) {
  course.rings.forEach((ring, i) => {
    if (i < doneCount) ring.state = 'done';
    else if (i === missedIndex) ring.state = 'missed';
    else ring.state = 'open';
  });
  course.next = doneCount + (missedIndex >= doneCount ? 1 : 0);
  course.ringsTaken = doneCount;
}

// Pose the game for one named scene. refs: { ac, course, setState, setCamOverride }
export function applyShot(name, refs) {
  const { ac, course } = refs;
  if (name === 'start') {
    ac.x = valleyCenterX(-150);
    ac.z = -150;
    ac.y = RUNWAYS.elevation + 1.7;
    ac.throttle = 0.66;
    ac.speed = 27;
    ac.pitch = 0.03;
    course.started = true;
    refs.setState('fly');
    return;
  }
  if (name === 'play') {
    const ring = course.rings[2];
    ac.x = ring.x - 26;
    ac.y = ring.y + 10;
    ac.z = ring.z - 235;
    ac.heading = Math.atan2(ring.x - ac.x, ring.z - ac.z);
    ac.pitch = 0.05;
    ac.roll = -0.38;
    ac.speed = 54;
    ac.throttle = 0.82;
    ac.fuel = 63;
    markRings(course, 2);
    course.score = 300;
    course.elapsed = 41;
    course.started = true;
    refs.setState('fly');
    return;
  }
  if (name === 'ring') {
    const ring = course.rings[3];
    ac.x = ring.x + 4;
    ac.y = ring.y + 2;
    ac.z = ring.z - 62;
    ac.heading = 0.02;
    ac.pitch = -0.02;
    ac.roll = 0.07;
    ac.speed = 47;
    ac.throttle = 0.7;
    ac.fuel = 57;
    markRings(course, 3);
    course.score = 450;
    course.elapsed = 58;
    course.started = true;
    refs.setState('fly');
    return;
  }
  if (name === 'end') {
    ac.x = valleyCenterX(3960);
    ac.z = 3960;
    ac.y = RUNWAYS.elevation + 1.7;
    ac.speed = 0;
    ac.throttle = 0;
    ac.fuel = 21;
    ac.onGround = true;
    markRings(course, 7, 7);
    course.elapsed = 191;
    course.timeBonus = 218;
    course.landingBonus = 264;
    course.score = 7 * 150 + 218 + 264;
    course.finished = true;
    course.outcome = 'landed-far';
    course.started = true;
    refs.setState('done');
    refs.setCamOverride({
      pos: [ac.x + 19, ac.y + 6.5, ac.z - 24],
      target: [ac.x, ac.y + 1.5, ac.z + 14],
    });
    return;
  }
  refs.setState('title');
}
