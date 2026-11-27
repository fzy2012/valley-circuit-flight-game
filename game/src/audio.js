// Sound from oscillators alone — no audio files, so the game stays a folder
// of static text. An engine note that follows the throttle, wind that
// follows the speed, a two-note chime for a ring, and a low thud for the
// ground. Everything starts on the first user gesture, as browsers require.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let windGain = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter).connect(engineGain).connect(ctx.destination);
    engineOsc.start();
    // Wind: looped noise through a bandpass, gained by airspeed.
    const len = ctx.sampleRate * 1.2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const wind = ctx.createBufferSource();
    wind.buffer = buffer;
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 800;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    wind.connect(windFilter).connect(windGain).connect(ctx.destination);
    wind.start();
  }

  function blip(freq, at, dur, gain = 0.12) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, ctx.currentTime + at);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(ctx.currentTime + at);
    osc.stop(ctx.currentTime + at + dur + 0.05);
  }

  return {
    unlock: ensure,
    update(ac) {
      if (!ctx) return;
      const t = ctx.currentTime;
      const rpm = 55 + ac.throttle * 95 + ac.speed * 0.35;
      engineOsc.frequency.setTargetAtTime(rpm, t, 0.08);
      engineGain.gain.setTargetAtTime(muted ? 0 : 0.028 + ac.throttle * 0.05, t, 0.1);
      windGain.gain.setTargetAtTime(muted ? 0 : Math.min(0.09, ac.speed * 0.0011), t, 0.15);
    },
    ring() { blip(880, 0, 0.16); blip(1318, 0.09, 0.24); },
    thud() { blip(72, 0, 0.3, 0.22); },
    crash() { blip(48, 0, 0.7, 0.3); blip(96, 0.05, 0.5, 0.18); },
    toggleMute() { muted = !muted; return muted; },
  };
}
