// Tiny synthesised sound set (no audio files). Created lazily on the first user gesture.

let ctx = null, master = null, musicGain = null, musicTimer = null;
export const audioSettings = { sfx: true, music: true };

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
  musicGain = ctx.createGain(); musicGain.gain.value = 0.0; musicGain.connect(master);
  return ctx;
}
export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume();
  if (audioSettings.music) startMusic();
}

function tone(freq, t0, dur, { type = 'sine', vol = 0.2, slide = 0, dest = master } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(dest);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

const SOUNDS = {
  click: (t) => tone(620, t, 0.07, { type: 'triangle', vol: 0.12, slide: 1.3 }),
  open: (t) => { tone(440, t, 0.09, { type: 'triangle', vol: 0.1 }); tone(660, t + 0.05, 0.1, { type: 'triangle', vol: 0.1 }); },
  pop: (t) => tone(300, t, 0.12, { vol: 0.22, slide: 3.2 }),
  coin: (t) => { tone(988, t, 0.09, { type: 'square', vol: 0.07 }); tone(1319, t + 0.07, 0.28, { type: 'square', vol: 0.07 }); tone(1976, t + 0.07, 0.3, { vol: 0.08 }); },
  order: (t) => { tone(784, t, 0.12, { vol: 0.14 }); tone(1047, t + 0.1, 0.2, { vol: 0.14 }); },
  done: (t) => [523, 659, 784].forEach((f, i) => tone(f, t + i * 0.07, 0.25, { type: 'triangle', vol: 0.14 })),
  queue: (t) => tone(392, t, 0.14, { type: 'triangle', vol: 0.14, slide: 1.5 }),
  delivery: (t) => { tone(180, t, 0.1, { type: 'triangle', vol: 0.2 }); tone(140, t + 0.09, 0.14, { type: 'triangle', vol: 0.2 }); },
  error: (t) => { tone(220, t, 0.12, { type: 'sawtooth', vol: 0.07 }); tone(180, t + 0.1, 0.16, { type: 'sawtooth', vol: 0.07 }); },
  sad: (t) => { tone(392, t, 0.18, { vol: 0.12 }); tone(311, t + 0.15, 0.3, { vol: 0.12 }); },
  upgrade: (t) => [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.08, 0.3, { type: 'triangle', vol: 0.15 })),
  star: (t) => { tone(1319, t, 0.1, { vol: 0.1 }); tone(1760, t + 0.06, 0.2, { vol: 0.1 }); },
  fanfare: (t) => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * 0.13, 0.4, { type: 'triangle', vol: 0.16 })),
  day: (t) => [659, 523, 392].forEach((f, i) => tone(f, t + i * 0.16, 0.45, { vol: 0.12 })),
};

export function sfx(name) {
  if (!audioSettings.sfx) return;
  const c = ensure();
  if (!c || c.state !== 'running' || !SOUNDS[name]) return;
  SOUNDS[name](c.currentTime + 0.005);
}

// A soft generative music-box loop: pentatonic notes over slow pads.
const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
const CHORDS = [[0, 2, 4], [1, 3, 5], [0, 3, 5], [2, 4, 6]];
let bar = 0;
function scheduleBar() {
  if (!ctx || !audioSettings.music) return;
  const t = ctx.currentTime + 0.05, chord = CHORDS[bar % CHORDS.length];
  for (const n of chord) tone(SCALE[n] / 2, t, 3.8, { vol: 0.045, dest: musicGain });
  for (let i = 0; i < 8; i++) {
    if (Math.random() < 0.55) {
      const n = chord[Math.floor(Math.random() * 3)] + (Math.random() < 0.4 ? 2 : 0);
      tone(SCALE[Math.min(7, n)] * (Math.random() < 0.3 ? 2 : 1), t + i * 0.5, 0.9, { type: 'triangle', vol: 0.05, dest: musicGain });
    }
  }
  bar += 1;
}
export function startMusic() {
  if (!ensure() || musicTimer) return;
  musicGain.gain.setTargetAtTime(1, ctx.currentTime, 1.5);
  scheduleBar();
  musicTimer = setInterval(scheduleBar, 4000);
}
export function stopMusic() {
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  if (ctx) musicGain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
}
export function setMusic(on) { audioSettings.music = on; if (on) startMusic(); else stopMusic(); }
export function setSfx(on) { audioSettings.sfx = on; }
