// Keyboard and mouse, read as one command set. Arrows (or the mouse, held
// over the canvas) command pitch and bank; W/S work the throttle; Space is
// the wheel brake. The flight model consumes commands in -1..1, so the two
// devices never fight: a pressed key simply outvotes the mouse.

export function createInput(canvas) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, seen: false };
  let startPressed = false;
  let pausePressed = false;
  let mutePressed = false;

  addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'Enter' || e.code === 'KeyR') startPressed = true;
    if (e.code === 'KeyP') pausePressed = true;
    if (e.code === 'KeyM') mutePressed = true;
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    mouse.y = ((e.clientY - r.top) / r.height) * 2 - 1;
    mouse.seen = true;
  });
  canvas.addEventListener('pointerdown', () => { startPressed = true; });

  function dead(v, zone) {
    return Math.abs(v) < zone ? 0 : v;
  }

  return {
    // Fill the aircraft's command fields from the devices.
    applyTo(ac) {
      let pitch = 0;
      let roll = 0;
      if (keys.has('ArrowUp')) pitch += 1;
      if (keys.has('ArrowDown')) pitch -= 1;
      if (keys.has('ArrowLeft')) roll -= 1;
      if (keys.has('ArrowRight')) roll += 1;
      if (pitch === 0 && roll === 0 && mouse.seen) {
        pitch = dead(-mouse.y, 0.12) * 0.9;
        roll = dead(mouse.x, 0.12) * 0.95;
      }
      ac.cmdPitch = pitch;
      ac.cmdRoll = roll;
      ac.cmdThrottle = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
      ac.brake = keys.has('Space');
    },
    takeStart() { const v = startPressed; startPressed = false; return v; },
    takePause() { const v = pausePressed; pausePressed = false; return v; },
    takeMute() { const v = mutePressed; mutePressed = false; return v; },
  };
}
