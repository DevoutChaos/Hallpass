// Sounds are synthesised with the Web Audio API, so there are no audio files to load.

let ctx = null;

function audio() {
  if (!ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Call from a tap handler: browsers only allow audio after a user gesture.
export function unlockAudio() {
  try {
    // Lets iPad/iPhone play sounds even when the silent switch is on (iOS 17+).
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch {}
  audio();
}

function tone(freq, start, dur, type = 'sine', vol = 0.3) {
  const c = audio();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  const t = c.currentTime + start;
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

export function dingOut() {
  tone(1046.5, 0, 0.9, 'sine', 0.35);
  tone(2093, 0, 0.5, 'sine', 0.08);
}

export function dingBack() {
  tone(784, 0, 0.45, 'sine', 0.3);
  tone(1046.5, 0.12, 0.8, 'sine', 0.3);
}

export function buzz() {
  tone(180, 0, 0.18, 'square', 0.12);
  tone(140, 0.24, 0.32, 'square', 0.12);
}
