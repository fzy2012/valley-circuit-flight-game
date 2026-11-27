// Everything drawn flat over the 3D view: the HUD readouts (altitude, speed
// and heading, always on show), the compass strip, the lit instrument panel
// along the bottom — artificial horizon, airspeed and altitude tapes,
// throttle and fuel — plus the title, pause and results overlays.

import { PALETTE, COURSE } from './config.js';
import { wrapAngle } from './aircraft.js';

const FT = 3.28084;
const KT = 1.94384;

export function headingDeg(ac) {
  const d = (ac.heading * 180) / Math.PI;
  return ((d % 360) + 360) % 360;
}

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, '0')}`;
}

function box(ctx, x, y, w, h, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
}

function drawHudText(ctx, W, ac, course) {
  ctx.textBaseline = 'top';
  box(ctx, 14, 12, 252, 104, 'rgba(8,12,18,0.55)');
  ctx.fillStyle = PALETTE.litCyan;
  ctx.font = '600 11px ui-monospace, Menlo, monospace';
  ctx.fillText('ALTITUDE', 26, 20);
  ctx.fillText('SPEED', 26, 52);
  ctx.fillText('HEADING', 26, 84);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '700 24px ui-monospace, Menlo, monospace';
  ctx.fillText(`${Math.round(ac.y * FT)} ft`, 104, 14);
  ctx.fillText(`${Math.round(ac.speed * KT)} kt`, 104, 46);
  ctx.fillStyle = PALETTE.litAmber;
  ctx.fillText(`${Math.round(headingDeg(ac)).toString().padStart(3, '0')}°`, 104, 78);
  // Score block, top right.
  box(ctx, W - 232, 12, 218, 104, 'rgba(8,12,18,0.55)');
  ctx.font = '600 11px ui-monospace, Menlo, monospace';
  ctx.fillStyle = PALETTE.litCyan;
  ctx.fillText('SCORE', W - 220, 20);
  ctx.fillText('RINGS', W - 220, 48);
  ctx.fillText('TIME', W - 220, 76);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '700 20px ui-monospace, Menlo, monospace';
  ctx.fillText(`${course.score}`, W - 150, 16);
  ctx.fillText(`${course.ringsTaken} / ${COURSE.ringCount}`, W - 150, 44);
  ctx.fillText(fmtTime(course.elapsed), W - 150, 72);
  // Fuel bar under the score block.
  const fw = 218;
  box(ctx, W - 232, 124, fw, 12, 'rgba(8,12,18,0.55)');
  const fuelW = Math.max(0, (fw - 8) * (ac.fuel / 100));
  ctx.fillStyle = ac.fuel < 25 ? PALETTE.litRed : PALETTE.litGreen;
  ctx.fillRect(W - 228, 127, fuelW, 6);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '600 10px ui-monospace, Menlo, monospace';
  ctx.fillText('FUEL', W - 228, 140);
}

function drawCompass(ctx, W, ac) {
  const w = 300, x = W / 2 - w / 2, y = 14;
  box(ctx, x, y, w, 40, 'rgba(8,12,18,0.55)');
  const hdg = headingDeg(ac);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 6, y, w - 12, 40);
  ctx.clip();
  ctx.textAlign = 'center';
  for (let d = -60; d <= 60; d += 5) {
    const deg = Math.round((hdg + d) / 5) * 5;
    const px = W / 2 + ((deg - hdg) * (Math.PI / 180)) * (w / 1.5);
    if (px < x + 8 || px > x + w - 8) continue;
    const norm = ((deg % 360) + 360) % 360;
    ctx.strokeStyle = 'rgba(234,246,255,0.6)';
    ctx.beginPath();
    ctx.moveTo(px, y + 26);
    ctx.lineTo(px, y + (norm % 30 === 0 ? 16 : 21));
    ctx.stroke();
    if (norm % 30 === 0) {
      const names = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
      ctx.fillStyle = PALETTE.hudText;
      ctx.font = '700 13px ui-monospace, Menlo, monospace';
      ctx.fillText(names[norm] ?? `${norm / 10}`, px, y + 3);
    }
  }
  ctx.restore();
  ctx.fillStyle = PALETTE.litAmber;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 6, y + 40);
  ctx.lineTo(W / 2 + 6, y + 40);
  ctx.lineTo(W / 2, y + 33);
  ctx.closePath();
  ctx.fill();
  ctx.textAlign = 'left';
}

function drawGuidance(ctx, W, H, ac, course) {
  const ring = course.rings[course.next];
  if (!ring || course.finished) return;
  const dist = Math.hypot(ring.x - ac.x, ring.z - ac.z);
  const bearing = Math.atan2(ring.x - ac.x, ring.z - ac.z);
  const rel = wrapAngle(bearing - ac.heading);
  const cxp = W / 2, cyp = 74;
  ctx.save();
  ctx.translate(cxp, cyp);
  ctx.fillStyle = PALETTE.litAmber;
  ctx.font = '700 15px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`NEXT RING ${Math.round(dist)} m`, 0, 22);
  ctx.rotate(Math.max(-1.2, Math.min(1.2, rel)));
  ctx.beginPath();
  ctx.moveTo(0, -13);
  ctx.lineTo(6, 4);
  ctx.lineTo(0, 0);
  ctx.lineTo(-6, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.textAlign = 'left';
}

function drawHorizon(ctx, x, y, r, ac) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(-ac.roll);
  const pitchPx = ac.pitch * 130;
  ctx.fillStyle = '#3f7fbf';
  ctx.fillRect(-r * 1.6, -r * 1.6 + pitchPx, r * 3.2, r * 1.6);
  ctx.fillStyle = '#8a6b42';
  ctx.fillRect(-r * 1.6, pitchPx, r * 3.2, r * 1.6);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-r * 1.6, pitchPx); ctx.lineTo(r * 1.6, pitchPx); ctx.stroke();
  ctx.lineWidth = 1;
  for (const p of [-20, -10, 10, 20]) {
    const yy = pitchPx - p * 1.15;
    const hw = p % 20 === 0 ? 16 : 10;
    ctx.beginPath(); ctx.moveTo(-hw, yy); ctx.lineTo(hw, yy); ctx.stroke();
  }
  ctx.restore();
  // Fixed aircraft symbol and bezel.
  ctx.strokeStyle = PALETTE.litAmber;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.62, y); ctx.lineTo(x - r * 0.18, y); ctx.lineTo(x, y + 6);
  ctx.lineTo(x + r * 0.18, y); ctx.lineTo(x + r * 0.62, y);
  ctx.stroke();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = PALETTE.litCyan;
  ctx.font = '600 10px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', x, y + r + 6);
  ctx.textAlign = 'left';
}

function drawTape(ctx, x, y, h, value, unit, label, color, stepMajor) {
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(x, y, 74, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, 74, h);
  ctx.clip();
  const pxPerUnit = 2.1;
  const midY = y + h / 2;
  ctx.font = '600 11px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'right';
  const start = Math.floor((value - (h / 2) / pxPerUnit) / stepMajor) * stepMajor;
  for (let v = start; v < value + (h / 2) / pxPerUnit + stepMajor; v += stepMajor) {
    if (v < 0) continue;
    const yy = midY + (value - v) * pxPerUnit;
    if (yy < y + 9 || yy > y + h - 5) continue; // keep labels inside the tape
    ctx.strokeStyle = 'rgba(234,246,255,0.55)';
    ctx.beginPath(); ctx.moveTo(x + 52, yy); ctx.lineTo(x + 64, yy); ctx.stroke();
    ctx.fillStyle = 'rgba(234,246,255,0.85)';
    ctx.fillText(`${v}`, x + 48, yy - 5);
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(8,12,18,0.9)';
  ctx.fillRect(x + 2, midY - 13, 70, 26);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 2, midY - 13, 70, 26);
  ctx.fillStyle = color;
  ctx.font = '700 17px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(value)}`, x + 37, midY - 8);
  ctx.fillStyle = PALETTE.litCyan;
  ctx.font = '600 10px ui-monospace, Menlo, monospace';
  ctx.fillText(`${label} ${unit}`, x + 37, y + h + 4);
  ctx.textAlign = 'left';
}

export function drawCockpit(ctx, W, H, ac, course, t) {
  drawHudText(ctx, W, ac, course);
  drawCompass(ctx, W, ac);
  drawGuidance(ctx, W, H, ac, course);
  // Panel strip.
  const panelH = 148;
  const py = H - panelH;
  ctx.fillStyle = 'rgba(10,14,20,0.88)';
  ctx.fillRect(0, py, W, panelH);
  ctx.fillStyle = PALETTE.panelEdge;
  ctx.fillRect(0, py, W, 2);
  drawTape(ctx, 26, py + 16, 108, ac.speed * KT, 'kt', 'AIRSPEED', PALETTE.litCyan, 10);
  // Throttle bar beside the speed tape.
  const tx = 118;
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(tx, py + 16, 16, 108);
  const th = 108 * ac.throttle;
  ctx.fillStyle = PALETTE.litAmber;
  ctx.fillRect(tx, py + 16 + (108 - th), 16, th);
  ctx.fillStyle = PALETTE.litCyan;
  ctx.font = '600 10px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('THR', tx + 8, py + 128);
  ctx.fillText(`${Math.round(ac.throttle * 100)}%`, tx + 8, py + 30 - 22);
  ctx.textAlign = 'left';
  drawHorizon(ctx, W / 2, py + 66, 52, ac);
  drawTape(ctx, W - 100, py + 16, 108, ac.y * FT, 'ft', 'ALTITUDE', PALETTE.litGreen, 100);
  // Vertical speed under the altitude tape.
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '700 14px ui-monospace, Menlo, monospace';
  ctx.fillText(`VS ${ac.vy >= 0 ? '+' : ''}${Math.round(ac.vy * FT)} fpm`, W - 190, py + 62);
  ctx.fillStyle = PALETTE.litCyan;
  ctx.font = '600 10px ui-monospace, Menlo, monospace';
  ctx.fillText('VERT SPEED', W - 190, py + 50);
  // Warnings, centre screen — only while the sortie is still live; on the
  // results board they would sit on top of the score breakdown.
  ctx.textAlign = 'center';
  let wy = H * 0.3;
  if (course.finished) { ctx.textAlign = 'left'; return; }
  if (ac.stalled && Math.sin(t * 9) > -0.2) {
    ctx.fillStyle = PALETTE.litRed;
    ctx.font = '800 34px ui-monospace, Menlo, monospace';
    ctx.fillText('STALL', W / 2, wy);
    wy += 40;
  }
  if (ac.fuel > 0 && ac.fuel < 25) {
    ctx.fillStyle = PALETTE.litAmber;
    ctx.font = '800 22px ui-monospace, Menlo, monospace';
    ctx.fillText('LOW FUEL', W / 2, wy);
    wy += 32;
  }
  if (ac.fuel <= 0 && !ac.onGround) {
    ctx.fillStyle = PALETTE.litRed;
    ctx.font = '800 22px ui-monospace, Menlo, monospace';
    ctx.fillText('FUEL EMPTY — GLIDE', W / 2, wy);
  }
  ctx.textAlign = 'left';
}

function overlayShade(ctx, W, H) {
  ctx.fillStyle = 'rgba(5,9,15,0.48)';
  ctx.fillRect(0, 0, W, H);
}

export function drawTitle(ctx, W, H) {
  overlayShade(ctx, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '800 54px ui-monospace, Menlo, monospace';
  ctx.fillText('VALLEY CIRCUIT', W / 2, H * 0.24);
  ctx.fillStyle = PALETTE.litAmber;
  ctx.font = '600 19px ui-monospace, Menlo, monospace';
  ctx.fillText('Thread all 8 rings down the valley — then land at the far runway.', W / 2, H * 0.24 + 58);
  ctx.fillStyle = 'rgba(234,246,255,0.92)';
  ctx.font = '500 16px ui-monospace, Menlo, monospace';
  const lines = [
    'W / S — throttle      ↑ ↓ — pitch      ← → — steer, then bank',
    'Mouse also steers.  Space — brake.  P — pause.  M — sound.',
    'Watch your fuel: full throttle drinks it, and an empty tank glides.',
    'Land gently on the far strip — a hard arrival ends the sortie.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, W / 2, H * 0.24 + 104 + i * 26));
  ctx.fillStyle = PALETTE.litGreen;
  ctx.font = '800 22px ui-monospace, Menlo, monospace';
  ctx.fillText('Press ENTER or click to take off', W / 2, H * 0.24 + 226);
  ctx.textAlign = 'left';
}

export function drawEnd(ctx, W, H, course, ac) {
  overlayShade(ctx, W, H);
  ctx.textAlign = 'center';
  const titles = {
    'landed-far': 'CIRCUIT COMPLETE',
    'landed-valley': 'DOWN IN THE VALLEY',
    crashed: 'CRASHED',
  };
  ctx.fillStyle = course.outcome === 'crashed' ? PALETTE.litRed : PALETTE.litGreen;
  ctx.font = '800 44px ui-monospace, Menlo, monospace';
  ctx.fillText(titles[course.outcome] ?? 'SORTIE OVER', W / 2, H * 0.2);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '600 19px ui-monospace, Menlo, monospace';
  const rows = [
    [`Rings threaded`, `${course.ringsTaken} / ${COURSE.ringCount}  (+${course.ringsTaken * COURSE.ringScore})`],
    [`Time bonus`, `+${course.timeBonus}`],
    [`Landing bonus`, `+${course.landingBonus}`],
    [`Flight time`, fmtTime(course.elapsed)],
    [`Fuel left`, `${Math.round(ac.fuel)}%`],
  ];
  rows.forEach((row, i) => {
    ctx.fillStyle = 'rgba(234,246,255,0.75)';
    ctx.fillText(row[0], W / 2 - 170, H * 0.2 + 64 + i * 30);
    ctx.fillStyle = PALETTE.hudText;
    ctx.fillText(row[1], W / 2 + 170, H * 0.2 + 64 + i * 30);
  });
  ctx.fillStyle = PALETTE.litAmber;
  ctx.font = '800 34px ui-monospace, Menlo, monospace';
  ctx.fillText(`SCORE  ${course.score}`, W / 2, H * 0.2 + 64 + rows.length * 30 + 26);
  ctx.fillStyle = PALETTE.litGreen;
  ctx.font = '800 20px ui-monospace, Menlo, monospace';
  ctx.fillText('Press ENTER to fly again', W / 2, H * 0.2 + 64 + rows.length * 30 + 66);
  ctx.textAlign = 'left';
}

export function drawPaused(ctx, W, H) {
  overlayShade(ctx, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '800 36px ui-monospace, Menlo, monospace';
  ctx.fillText('PAUSED', W / 2, H * 0.42);
  ctx.font = '600 16px ui-monospace, Menlo, monospace';
  ctx.fillText('P to resume', W / 2, H * 0.42 + 40);
  ctx.textAlign = 'left';
}
