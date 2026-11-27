// The ring course and the score. Eight rings hang over the valley floor
// between the two runways; each is crossed in order, the next one lit gold.
// Crossing is judged on the segment the plane flew this step: if it pierced
// the ring's disc, the ring is taken; if it passed the ring's line wide,
// the ring is missed and the course moves on without it.

import { COURSE } from './config.js';
import { valleyCenterX, terrainHeight } from './terrain.js';

export function buildCourse() {
  const offsets = [0, -70, 55, -30, 80, -85, 35, 0];
  const heights = [52, 74, 60, 92, 66, 100, 78, 58];
  const rings = [];
  for (let i = 0; i < COURSE.ringCount; i++) {
    const z = COURSE.ringFirstZ + i * COURSE.ringSpacing;
    const x = valleyCenterX(z) + offsets[i];
    const y = Math.max(terrainHeight(x, z) + heights[i], 46);
    rings.push({ x, y, z, r: COURSE.ringRadius, state: 'open' }); // open | done | missed
  }
  return {
    rings,
    next: 0,              // index of the ring to fly next
    score: 0,
    ringsTaken: 0,
    elapsed: 0,           // seconds since takeoff roll began
    started: false,
    finished: false,
    landingBonus: 0,
    timeBonus: 0,
    outcome: null,        // 'landed-far' | 'landed-valley' | 'crashed'
  };
}

// Watch the segment from (px, pz) to the aircraft's new position against the
// next ring. Returns 'ring' on the step the plane threads it, else null.
export function watchCourse(course, ac, px, pz) {
  if (course.finished) return null;
  if (ac.speed > 1 || ac.throttle > 0) course.started = true;
  const ring = course.rings[course.next];
  if (!ring) return null;
  // The ring faces the approaching plane: its plane is z = ring.z.
  const crossed = (pz - ring.z) * (ac.z - ring.z) <= 0 && ac.z !== pz;
  if (crossed) {
    const t = (ring.z - pz) / (ac.z - pz);
    const ix = px + (ac.x - px) * t;
    const iy = ac.y; // close enough at these speeds; the disc test is generous
    const d = Math.hypot(ix - ring.x, iy - ring.y);
    if (d <= ring.r) {
      ring.state = 'done';
      course.next += 1;
      course.ringsTaken += 1;
      course.score += COURSE.ringScore;
      return 'ring';
    }
  }
  if (ac.z > ring.z + 46) {
    ring.state = 'missed';
    course.next += 1;
    return 'missed';
  }
  return null;
}

// Close the books when the sortie ends and award what was earned.
export function finishCourse(course, ac, outcome) {
  course.finished = true;
  course.outcome = outcome;
  if (outcome === 'landed-far') {
    course.timeBonus = Math.max(0, Math.round(COURSE.finishTimeBonusMax - course.elapsed * 2));
    const gentleness = Math.max(0, 1 - Math.abs(ac.vy) / 6);
    const alignment = Math.max(0, 1 - Math.abs(ac.x - valleyCenterX(ac.z)) / 15);
    course.landingBonus = Math.round(COURSE.landingBonusMax * (0.6 * gentleness + 0.4 * alignment));
    course.score += course.timeBonus + course.landingBonus;
  }
  return course;
}
