// The 3D renderer: a small software projector over a 2D canvas. World points
// are turned into camera space with a yaw/pitch/roll basis, projected with a
// pinhole focal length, and painted far to near — sky, terrain mesh, runway,
// course rings, trees and hangars, then the aircraft itself, built from
// projected polygons so it banks and pitches as a solid object.

import { PALETTE, RUNWAYS } from './config.js';
import { terrainHeight, groundColor, valleyCenterX } from './terrain.js';
import { mulberry } from './noise.js';

const FOV_Y = 1.08; // radians, vertical field of view

// --- tiny vector helpers (arrays [x, y, z]) ---
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function norm(a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

// A camera is a position plus an orthonormal basis {f, r, u}.
export function chaseCamera(ac) {
  const cp = Math.cos(ac.pitch), sp = Math.sin(ac.pitch);
  const fwd = [Math.sin(ac.heading) * cp, sp, Math.cos(ac.heading) * cp];
  const pos = [
    ac.x - fwd[0] * 17,
    ac.y - fwd[1] * 17 + 5.4,
    ac.z - fwd[2] * 17,
  ];
  const groundY = terrainHeight(pos[0], pos[2]) + 2.2;
  if (pos[1] < groundY) pos[1] = groundY;
  return basisFrom(pos, ac.heading, ac.pitch * 0.62, ac.roll * 0.55);
}

export function orbitCamera(pos, target) {
  const f = norm(sub(target, pos));
  const yaw = Math.atan2(f[0], f[2]);
  const pitch = Math.asin(Math.max(-1, Math.min(1, f[1])));
  return basisFrom(pos, yaw, pitch, 0);
}

function basisFrom(pos, yaw, pitch, roll) {
  const f = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  const r0 = norm(cross([0, 1, 0], f));
  const u0 = cross(f, r0);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const r = [r0[0] * cr - u0[0] * sr, r0[1] * cr - u0[1] * sr, r0[2] * cr - u0[2] * sr];
  const u = [u0[0] * cr + r0[0] * sr, u0[1] * cr + r0[1] * sr, u0[2] * cr + r0[2] * sr];
  return { pos, f, r, u };
}

// Clouds are placed once, far above the valley, and drift with the clock.
function buildClouds() {
  const rand = mulberry(4242);
  const clouds = [];
  for (let i = 0; i < 30; i++) {
    clouds.push({
      x: (rand() - 0.5) * 5200,
      y: 330 + rand() * 190,
      z: -500 + rand() * 5400,
      s: 90 + rand() * 190,
    });
  }
  return clouds;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const clouds = buildClouds();
  let W = 0, H = 0, focal = 1, cx = 0, cy = 0;
  const fogRGB = [195, 220, 238];
  const colTmp = [0, 0, 0];

  function resize(w, h) {
    W = w; H = h; cx = w / 2; cy = h / 2;
    focal = (h / 2) / Math.tan(FOV_Y / 2);
  }

  // Project a world point; returns [sx, sy, depth] or null when behind.
  function project(cam, p) {
    const dx = p[0] - cam.pos[0], dy = p[1] - cam.pos[1], dz = p[2] - cam.pos[2];
    const zc = dx * cam.f[0] + dy * cam.f[1] + dz * cam.f[2];
    if (zc < 1.4) return null;
    const xc = dx * cam.r[0] + dy * cam.r[1] + dz * cam.r[2];
    const yc = dx * cam.u[0] + dy * cam.u[1] + dz * cam.u[2];
    return [cx + (focal * xc) / zc, cy - (focal * yc) / zc, zc];
  }

  // Project a whole polygon, clipping it against the near plane in camera
  // space first. Surfaces that straddle the camera — the runway under the
  // aircraft, the ground at the frame's bottom edge — would otherwise be
  // dropped whole the moment one corner fell behind the eye.
  function projectClipped(cam, pts3D) {
    const NEAR = 1.4;
    let polyCam = pts3D.map((p) => {
      const dx = p[0] - cam.pos[0], dy = p[1] - cam.pos[1], dz = p[2] - cam.pos[2];
      return [
        dx * cam.r[0] + dy * cam.r[1] + dz * cam.r[2],
        dx * cam.u[0] + dy * cam.u[1] + dz * cam.u[2],
        dx * cam.f[0] + dy * cam.f[1] + dz * cam.f[2],
      ];
    });
    const clipped = [];
    for (let i = 0; i < polyCam.length; i++) {
      const a = polyCam[i];
      const b = polyCam[(i + 1) % polyCam.length];
      const aIn = a[2] >= NEAR, bIn = b[2] >= NEAR;
      if (aIn) clipped.push(a);
      if (aIn !== bIn) {
        const t = (NEAR - a[2]) / (b[2] - a[2]);
        clipped.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]);
      }
    }
    if (clipped.length < 3) return null;
    return clipped.map(([x, y, z]) => [cx + (focal * x) / z, cy - (focal * y) / z, z]);
  }

  function poly(pts, fill) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function fogMix(rgb, depth) {
    const t = Math.min(1, Math.max(0, (depth - 480) / 1750));
    const k = t * t * (3 - 2 * t);
    const r = Math.round(rgb[0] + (fogRGB[0] - rgb[0]) * k);
    const g = Math.round(rgb[1] + (fogRGB[1] - rgb[1]) * k);
    const b = Math.round(rgb[2] + (fogRGB[2] - rgb[2]) * k);
    return `rgb(${r},${g},${b})`;
  }

  function drawSky(cam, t) {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, PALETTE.skyTop);
    grad.addColorStop(0.55, '#7db3dd');
    grad.addColorStop(0.78, PALETTE.skyHorizon);
    grad.addColorStop(1, PALETTE.fog);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    // Sun: one fixed world direction, projected like everything else.
    const sunDir = norm([-0.38, 0.4, 0.83]);
    const sp = project(cam, [cam.pos[0] + sunDir[0] * 6000, cam.pos[1] + sunDir[1] * 6000, cam.pos[2] + sunDir[2] * 6000]);
    if (sp) {
      const glow = ctx.createRadialGradient(sp[0], sp[1], 4, sp[0], sp[1], 120);
      glow.addColorStop(0, 'rgba(255,243,196,0.95)');
      glow.addColorStop(0.25, 'rgba(255,240,190,0.55)');
      glow.addColorStop(1, 'rgba(255,240,190,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sp[0] - 130, sp[1] - 130, 260, 260);
    }
    // Clouds drift slowly east; each is three soft ellipses.
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    for (const c of clouds) {
      const drifted = c.x + t * 3.5;
      const p = project(cam, [drifted, c.y, c.z]);
      if (!p || p[2] > 4200) continue;
      const s = (focal * c.s) / p[2];
      if (s < 6) continue;
      ctx.globalAlpha = Math.max(0, 0.85 - p[2] / 6000);
      ctx.beginPath();
      ctx.ellipse(p[0], p[1], s, s * 0.26, 0, 0, Math.PI * 2);
      ctx.ellipse(p[0] - s * 0.5, p[1] + s * 0.05, s * 0.62, s * 0.2, 0, 0, Math.PI * 2);
      ctx.ellipse(p[0] + s * 0.52, p[1] + s * 0.04, s * 0.58, s * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  const CELL = 60;
  const HALF = 1260;

  function drawTerrain(cam) {
    const gx = Math.round(cam.pos[0] / CELL) * CELL;
    const gz = Math.round(cam.pos[2] / CELL) * CELL;
    const quads = [];
    for (let ix = -HALF; ix < HALF; ix += CELL) {
      for (let iz = -HALF; iz < HALF; iz += CELL) {
        const x0 = gx + ix, z0 = gz + iz;
        const corners = [
          [x0, terrainHeight(x0, z0), z0],
          [x0 + CELL, terrainHeight(x0 + CELL, z0), z0],
          [x0 + CELL, terrainHeight(x0 + CELL, z0 + CELL), z0 + CELL],
          [x0, terrainHeight(x0, z0 + CELL), z0 + CELL],
        ];
        const pts = projectClipped(cam, corners);
        if (!pts) continue;
        let depth = 0;
        for (const p of pts) depth += p[2];
        depth /= pts.length;
        if (depth > 2600) continue;
        const hAvg = (corners[0][1] + corners[1][1] + corners[2][1] + corners[3][1]) / 4;
        const slope = Math.max(
          Math.abs(corners[1][1] - corners[0][1]), Math.abs(corners[3][1] - corners[0][1]),
          Math.abs(corners[2][1] - corners[0][1])) / CELL;
        groundColor(hAvg, slope, x0 + CELL / 2, z0 + CELL / 2, colTmp);
        quads.push({ pts, depth, fill: fogMix(colTmp, depth) });
      }
    }
    quads.sort((a, b) => b.depth - a.depth);
    for (const q of quads) poly(q.pts, q.fill);
  }

  function drawRunway(cam, strip) {
    const zMid = (strip.zFrom + strip.zTo) / 2;
    if (Math.abs(zMid - cam.pos[2]) > 2400) return;
    const y = RUNWAYS.elevation + 0.18;
    const hw = RUNWAYS.width / 2;
    const corner = (side, z) => project(cam, [valleyCenterX(z) + side * hw, y, z]);
    const surface = projectClipped(cam, [
      [valleyCenterX(strip.zFrom) - hw, y, strip.zFrom],
      [valleyCenterX(strip.zFrom) + hw, y, strip.zFrom],
      [valleyCenterX(strip.zTo) + hw, y, strip.zTo],
      [valleyCenterX(strip.zTo) - hw, y, strip.zTo],
    ]);
    if (surface) poly(surface, PALETTE.runway);
    // Edge lines and centreline dashes.
    ctx.strokeStyle = PALETTE.runwayEdge;
    ctx.lineWidth = Math.max(1, focal * 0.35 / Math.max(60, Math.abs(zMid - cam.pos[2])));
    for (const side of [-0.92, 0.92]) {
      const a = corner(side, strip.zFrom), b = corner(side, strip.zTo);
      if (a && b) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    }
    ctx.fillStyle = PALETTE.runwayEdge;
    for (let z = strip.zFrom + 24; z < strip.zTo - 10; z += 34) {
      const a = project(cam, [valleyCenterX(z) - 0.5, y, z]);
      const b = project(cam, [valleyCenterX(z) + 0.5, y, z]);
      const c = project(cam, [valleyCenterX(z) + 0.5, y, z + 15]);
      const d = project(cam, [valleyCenterX(z) - 0.5, y, z + 15]);
      if (a && b && c && d) poly([a, b, c, d], PALETTE.runwayEdge);
    }
    // Threshold bars at both ends.
    for (const zEnd of [strip.zFrom + 6, strip.zTo - 6]) {
      for (let i = -3; i <= 3; i++) {
        if (i === 0) continue;
        const off = i * (RUNWAYS.width / 8);
        const a = project(cam, [valleyCenterX(zEnd) + off - 0.8, y, zEnd - 3]);
        const b = project(cam, [valleyCenterX(zEnd) + off + 0.8, y, zEnd - 3]);
        const c = project(cam, [valleyCenterX(zEnd) + off + 0.8, y, zEnd + 3]);
        const d = project(cam, [valleyCenterX(zEnd) + off - 0.8, y, zEnd + 3]);
        if (a && b && c && d) poly([a, b, c, d], PALETTE.runwayEdge);
      }
    }
  }

  function drawHangar(cam, hg, drawList) {
    const depth = Math.hypot(hg.x - cam.pos[0], hg.z - cam.pos[2]);
    if (depth > 1900) return;
    const cosr = Math.cos(hg.rot), sinr = Math.sin(hg.rot);
    const local = (lx, ly, lz) => [hg.x + lx * cosr - lz * sinr, ly, hg.z + lx * sinr + lz * cosr];
    const base = terrainHeight(hg.x, hg.z);
    const top = base + hg.h;
    const c = [
      local(-hg.w / 2, base, -hg.d / 2), local(hg.w / 2, base, -hg.d / 2),
      local(hg.w / 2, base, hg.d / 2), local(-hg.w / 2, base, hg.d / 2),
      local(-hg.w / 2, top, -hg.d / 2), local(hg.w / 2, top, -hg.d / 2),
      local(hg.w / 2, top, hg.d / 2), local(-hg.w / 2, top, hg.d / 2),
    ].map((p) => project(cam, p));
    if (c.some((p) => !p)) return;
    // Door on the south face, interpolated in screen space from its corners:
    // enough for the box to read as a hangar rather than a crate.
    const lerpPt = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2]];
    const door = [
      lerpPt(lerpPt(c[0], c[1], 0.32), lerpPt(c[4], c[5], 0.32), 0.68),
      lerpPt(lerpPt(c[0], c[1], 0.68), lerpPt(c[4], c[5], 0.68), 0.68),
      lerpPt(c[0], c[1], 0.68),
      lerpPt(c[0], c[1], 0.32),
    ];
    drawList.push({
      depth,
      fn() {
        poly([c[3], c[2], c[6], c[7]], '#7a6a55');
        poly([c[1], c[2], c[6], c[5]], '#8d7c64');
        poly([c[0], c[1], c[5], c[4]], '#6b5c49');
        poly(door, '#3d3428');
        poly([c[4], c[5], c[6], c[7]], '#a33f27');
      },
    });
  }

  function drawTree(cam, tree, drawList) {
    const depth = Math.hypot(tree.x - cam.pos[0], tree.z - cam.pos[2]);
    if (depth > 1050 || depth < 8) return;
    const base = project(cam, [tree.x, tree.h, tree.z]);
    if (!base) return;
    const s = tree.s * 1.35;
    const mid = project(cam, [tree.x, tree.h + 5.2 * s, tree.z]);
    const top = project(cam, [tree.x, tree.h + 11.5 * s, tree.z]);
    const left = project(cam, [tree.x - 3.1 * s, tree.h + 3.2 * s, tree.z]);
    const right = project(cam, [tree.x + 3.1 * s, tree.h + 3.2 * s, tree.z]);
    const uLeft = project(cam, [tree.x - 2.1 * s, tree.h + 6.8 * s, tree.z]);
    const uRight = project(cam, [tree.x + 2.1 * s, tree.h + 6.8 * s, tree.z]);
    if (!mid || !top || !left || !right || !uLeft || !uRight) return;
    drawList.push({
      depth,
      fn() {
        ctx.strokeStyle = '#5a4632';
        ctx.lineWidth = Math.max(1, (focal * 0.4) / depth);
        ctx.beginPath(); ctx.moveTo(base[0], base[1]); ctx.lineTo(mid[0], mid[1]); ctx.stroke();
        // Two stacked tiers read as a pine even at a few pixels tall.
        poly([left, right, mid], fogMix([34, 88, 40], depth));
        poly([uLeft, uRight, top], fogMix([27, 76, 34], depth));
      },
    });
  }

  function drawRing(cam, ring, isNext, t, drawList) {
    const depth = Math.hypot(ring.x - cam.pos[0], ring.z - cam.pos[2]);
    if (depth > 2600) return;
    const pts = [];
    const pulse = isNext ? 1 + 0.045 * Math.sin(t * 4.2) : 1;
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const p = project(cam, [ring.x + Math.cos(a) * ring.r * pulse, ring.y + Math.sin(a) * ring.r * pulse, ring.z]);
      if (!p) return;
      pts.push(p);
    }
    const color = ring.state === 'done' ? PALETTE.ringDone
      : ring.state === 'missed' ? PALETTE.ringMissed
      : isNext ? PALETTE.ringNext : PALETTE.ringOpen;
    drawList.push({
      depth,
      fn() {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        if (isNext) {
          ctx.strokeStyle = 'rgba(255,201,60,0.35)';
          ctx.lineWidth = Math.max(3, (focal * 2.6) / depth);
          ctx.stroke();
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(2, (focal * 1.55) / depth);
        ctx.stroke();
        // Two support struts down to the ground, so the ring sits in the world.
        ctx.strokeStyle = 'rgba(40,48,56,0.8)';
        ctx.lineWidth = Math.max(1, (focal * 0.5) / depth);
        const bl = project(cam, [ring.x - ring.r * 0.7, ring.y - ring.r * 0.7, ring.z]);
        const bg = project(cam, [ring.x - ring.r * 0.7, terrainHeight(ring.x - ring.r * 0.7, ring.z), ring.z]);
        const br = project(cam, [ring.x + ring.r * 0.7, ring.y - ring.r * 0.7, ring.z]);
        const bg2 = project(cam, [ring.x + ring.r * 0.7, terrainHeight(ring.x + ring.r * 0.7, ring.z), ring.z]);
        if (bl && bg) { ctx.beginPath(); ctx.moveTo(bl[0], bl[1]); ctx.lineTo(bg[0], bg[1]); ctx.stroke(); }
        if (br && bg2) { ctx.beginPath(); ctx.moveTo(br[0], br[1]); ctx.lineTo(bg2[0], bg2[1]); ctx.stroke(); }
      },
    });
  }

  // The aircraft as projected solid parts, painted far to near.
  function drawPlane(cam, ac, t) {
    const cp = Math.cos(ac.pitch), sp = Math.sin(ac.pitch);
    const ch = Math.cos(ac.heading), sh = Math.sin(ac.heading);
    const cr = Math.cos(ac.roll), sr = Math.sin(ac.roll);
    // Local (x right, y up, z forward) -> world, roll then pitch then yaw.
    // Signs match the flight model: positive roll drops the right wing,
    // positive pitch raises the nose along the model's forward vector.
    function toWorld(lx, ly, lz) {
      const x1 = lx * cr + ly * sr;
      const y1 = -lx * sr + ly * cr;
      const z1 = lz;
      const y2 = y1 * cp + z1 * sp;
      const z2 = -y1 * sp + z1 * cp;
      const x2 = x1;
      return [
        ac.x + x2 * ch + z2 * sh,
        ac.y + y2,
        ac.z - x2 * sh + z2 * ch,
      ];
    }
    const sections = [
      { z: 4.9, w: 0.16, h: 0.16, y: 0.05 },
      { z: 2.4, w: 0.6, h: 0.74, y: 0.08 },
      { z: -0.6, w: 0.64, h: 0.82, y: 0.12 },
      { z: -2.9, w: 0.32, h: 0.48, y: 0.3 },
      { z: -4.2, w: 0.09, h: 0.15, y: 0.42 },
    ];
    const parts = [];
    function addPart(localPts, fill) {
      const world = localPts.map((p) => toWorld(p[0], p[1], p[2]));
      const depth = Math.hypot(
        world[0][0] - cam.pos[0], world[0][1] - cam.pos[1], world[0][2] - cam.pos[2]);
      const pts = world.map((p) => project(cam, p));
      if (pts.some((p) => !p)) return;
      parts.push({ depth, fn: () => poly(pts, fill) });
    }
    // Fuselage skins between sections: top, right, bottom, left.
    for (let i = 0; i < sections.length - 1; i++) {
      const A = sections[i], B = sections[i + 1];
      const quad = (side) => {
        if (side === 'top') return [[-A.w, A.y + A.h, A.z], [A.w, A.y + A.h, A.z], [B.w, B.y + B.h, B.z], [-B.w, B.y + B.h, B.z]];
        if (side === 'bottom') return [[A.w, A.y - A.h, A.z], [-A.w, A.y - A.h, A.z], [-B.w, B.y - B.h, B.z], [B.w, B.y - B.h, B.z]];
        if (side === 'right') return [[A.w, A.y + A.h, A.z], [A.w, A.y - A.h, A.z], [B.w, B.y - B.h, B.z], [B.w, B.y + B.h, B.z]];
        return [[-A.w, A.y - A.h, A.z], [-A.w, A.y + A.h, A.z], [-B.w, B.y + B.h, B.z], [-B.w, B.y - B.h, B.z]];
      };
      addPart(quad('top'), '#f0562f');
      addPart(quad('right'), PALETTE.planeBody);
      addPart(quad('bottom'), '#b23a1c');
      addPart(quad('left'), '#cf4a24');
    }
    // Wings, tailplane, fin, canopy.
    addPart([[-5.1, 0.02, 0.95], [5.1, 0.02, 0.95], [5.1, 0.3, -0.55], [-5.1, 0.3, -0.55]], PALETTE.planeWing);
    addPart([[-2.05, 0.34, -3.55], [2.05, 0.34, -3.55], [2.05, 0.42, -4.25], [-2.05, 0.42, -4.25]], PALETTE.planeWing);
    addPart([[0, 0.3, -4.25], [0, 1.55, -4.05], [0, 1.5, -3.2], [0, 0.42, -3.1]], PALETTE.planeBody);
    addPart([[-0.34, 0.52, 1.95], [0.34, 0.52, 1.95], [0.3, 0.52, 0.55], [-0.3, 0.52, 0.55]], PALETTE.canopy);
    addPart([[-0.34, 0.95, 1.9], [0.34, 0.95, 1.9], [0.3, 0.52, 0.55], [-0.3, 0.52, 0.55]], 'rgba(159,216,239,0.55)');
    // Gear: struts and wheels while down.
    if (ac.onGround || ac.speed < 42) {
      addPart([[-1.15, -0.8, 0.7], [-1.0, -0.8, 0.7], [-1.0, -1.62, 0.7], [-1.15, -1.62, 0.7]], '#2c3138');
      addPart([[1.0, -0.8, 0.7], [1.15, -0.8, 0.7], [1.15, -1.62, 0.7], [1.0, -1.62, 0.7]], '#2c3138');
    }
    // Propeller: a translucent disc and one blade line, spinning with power.
    const nose = toWorld(0, 0.05, 5.05);
    const discPts = [];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      discPts.push(toWorld(Math.cos(a) * 1.85, 0.05 + Math.sin(a) * 1.85, 5.0));
    }
    const discProj = discPts.map((p) => project(cam, p));
    if (!discProj.some((p) => !p)) {
      parts.push({
        depth: Math.hypot(nose[0] - cam.pos[0], nose[2] - cam.pos[2]) - 1,
        fn() {
          poly(discProj, 'rgba(230,238,244,0.20)');
          const ba = t * (6 + ac.throttle * 55);
          const b1 = project(cam, toWorld(Math.cos(ba) * 1.8, 0.05 + Math.sin(ba) * 1.8, 5.02));
          const b2 = project(cam, toWorld(-Math.cos(ba) * 1.8, 0.05 - Math.sin(ba) * 1.8, 5.02));
          if (b1 && b2) {
            ctx.strokeStyle = 'rgba(30,34,40,0.75)';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(b1[0], b1[1]); ctx.lineTo(b2[0], b2[1]); ctx.stroke();
          }
        },
      });
    }
    parts.sort((a, b) => b.depth - a.depth);
    for (const p of parts) p.fn();
    // Navigation lights on the wingtips.
    const lt = project(cam, toWorld(-5.1, 0.1, 0.2));
    const rt = project(cam, toWorld(5.1, 0.1, 0.2));
    if (lt) { ctx.fillStyle = '#ff4040'; ctx.beginPath(); ctx.arc(lt[0], lt[1], 3, 0, Math.PI * 2); ctx.fill(); }
    if (rt) { ctx.fillStyle = '#40ff70'; ctx.beginPath(); ctx.arc(rt[0], rt[1], 3, 0, Math.PI * 2); ctx.fill(); }
  }

  // view: { ac, course, scatter, t, cam } — cam from chaseCamera/orbitCamera.
  function draw(view) {
    const { cam, ac, course, scatter, t } = view;
    drawSky(cam, t);
    drawTerrain(cam);
    drawRunway(cam, RUNWAYS.a);
    drawRunway(cam, RUNWAYS.b);
    const drawList = [];
    for (const hg of scatter.hangars) drawHangar(cam, hg, drawList);
    for (const tree of scatter.trees) drawTree(cam, tree, drawList);
    course.rings.forEach((ring, i) => drawRing(cam, ring, i === course.next, t, drawList));
    drawList.sort((a, b) => b.depth - a.depth);
    for (const d of drawList) d.fn();
    drawPlane(cam, ac, t);
  }

  return { resize, draw };
}
