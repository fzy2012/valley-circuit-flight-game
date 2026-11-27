// Valley Circuit — the game loop and the state machine that ties the modules
// together: title -> flying -> done, with pause and restart. Physics, course
// watching and sound run only in the flying state; the renderer and cockpit
// draw every frame, whatever the state, so the title and results screens sit
// over the living valley.

import { FLIGHT } from './config.js';
import { valleyCenterX, buildScatter } from './terrain.js';
import { createAircraft, resetToRunway, stepAircraft } from './aircraft.js';
import { buildCourse, watchCourse, finishCourse } from './course.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, chaseCamera, orbitCamera } from './render.js';
import { drawCockpit, drawTitle, drawEnd, drawPaused } from './cockpit.js';
import { shotNameFromUrl, applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const input = createInput(canvas);
const audio = createAudio();
const scatter = buildScatter();

const startX = valleyCenterX(FLIGHT.startZ);
let ac = createAircraft(startX, FLIGHT.startZ);
resetToRunway(ac, startX, FLIGHT.startZ);
let course = buildCourse();
let state = 'title'; // title | fly | done
let paused = false;
let camOverride = null;
let elapsed = 0;

const shot = shotNameFromUrl();
if (shot) {
  applyShot(shot, {
    ac,
    course,
    setState: (s) => { state = s; },
    setCamOverride: (c) => { camOverride = c; },
  });
}

function announce(text) {
  status.textContent = text;
}

function restart() {
  resetToRunway(ac, startX, FLIGHT.startZ);
  course = buildCourse();
  paused = false;
  state = 'fly';
  announce('Takeoff roll. Thread the rings and land at the far runway.');
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  renderer.resize(w, h);
}
addEventListener('resize', resize);
resize();

function camera() {
  if (camOverride) return orbitCamera(camOverride.pos, camOverride.target);
  if (state === 'title') {
    return orbitCamera(
      [ac.x + 30, ac.y + 9.5, ac.z - 38],
      [ac.x, ac.y + 1.5, ac.z + 30],
    );
  }
  return chaseCamera(ac);
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = shot ? 12.5 : elapsed;

  if (input.takeMute()) audio.toggleMute();
  if (state === 'fly' && input.takePause()) paused = !paused;

  if (!shot) {
    if ((state === 'title' || state === 'done') && input.takeStart()) {
      audio.unlock();
      restart();
    } else if (state === 'fly' && !paused) {
      elapsed += dt;
      input.applyTo(ac);
      const px = ac.x, pz = ac.z;
      const event = stepAircraft(ac, dt);
      const cev = watchCourse(course, ac, px, pz);
      if (course.started && !course.finished) course.elapsed += dt;
      if (cev === 'ring') audio.ring();
      if (event) {
        finishCourse(course, ac, event);
        state = 'done';
        if (event === 'crashed') audio.crash(); else audio.thud();
        announce(event === 'landed-far'
          ? `Circuit complete. Score ${course.score}.`
          : event === 'crashed' ? 'Crashed.' : 'Down in the valley.');
      }
      audio.update(ac);
    }
  }

  const W = window.innerWidth;
  const H = window.innerHeight;
  renderer.draw({ cam: camera(), ac, course, scatter, t });
  if (state !== 'title') drawCockpit(ctx, W, H, ac, course, t);
  if (state === 'title') drawTitle(ctx, W, H);
  if (state === 'done') drawEnd(ctx, W, H, course, ac);
  if (paused && state === 'fly') drawPaused(ctx, W, H);
}
requestAnimationFrame(frame);
