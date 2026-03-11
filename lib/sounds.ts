// ============================================================
// 8-BIT SOUND SYSTEM using Web Audio API
// ============================================================

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch { return null; }
  }
  return audioCtx;
}

// Resume audio context (required after user interaction)
export function resumeAudio() {
  const ctx = getCtx();
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

// Play a simple 8-bit tone
function playTone(freq: number, duration: number, type: OscillatorType = 'square', volume: number = 0.15) {
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = volume;
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

// Play a quick sequence of tones
function playSequence(notes: { freq: number; dur: number; delay: number }[], type: OscillatorType = 'square', volume: number = 0.12) {
  const ctx = getCtx();
  if (!ctx) return;
  for (const note of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = note.freq;
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + note.delay + note.dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + note.delay);
    osc.stop(ctx.currentTime + note.delay + note.dur);
  }
}

// === SOUND EFFECTS ===

export function sfxClick() {
  playTone(600, 0.06, 'square', 0.08);
}

export function sfxBuy() {
  playSequence([
    { freq: 440, dur: 0.06, delay: 0 },
    { freq: 660, dur: 0.06, delay: 0.06 },
  ], 'square', 0.1);
}

export function sfxComet() {
  playSequence([
    { freq: 800, dur: 0.08, delay: 0 },
    { freq: 1000, dur: 0.08, delay: 0.08 },
    { freq: 1200, dur: 0.12, delay: 0.16 },
  ], 'triangle', 0.12);
}

export function sfxPrestige() {
  playSequence([
    { freq: 523, dur: 0.12, delay: 0 },
    { freq: 659, dur: 0.12, delay: 0.12 },
    { freq: 784, dur: 0.12, delay: 0.24 },
    { freq: 1047, dur: 0.25, delay: 0.36 },
  ], 'square', 0.15);
}

export function sfxAchievement() {
  playSequence([
    { freq: 880, dur: 0.1, delay: 0 },
    { freq: 1100, dur: 0.1, delay: 0.1 },
    { freq: 1320, dur: 0.15, delay: 0.2 },
  ], 'triangle', 0.12);
}

export function sfxAdClaim() {
  playSequence([
    { freq: 300, dur: 0.08, delay: 0 },
    { freq: 500, dur: 0.08, delay: 0.08 },
    { freq: 700, dur: 0.12, delay: 0.16 },
  ], 'sawtooth', 0.08);
}

export function sfxExpulsion() {
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.value = 200;
  osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.3);
  gain.gain.value = 0.12;
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.35);
}

export function sfxTabSwitch() {
  playTone(440, 0.04, 'square', 0.05);
}

export function sfxError() {
  playSequence([
    { freq: 200, dur: 0.1, delay: 0 },
    { freq: 150, dur: 0.15, delay: 0.12 },
  ], 'square', 0.1);
}

// === 8-BIT MUSIC (simple looping melody) ===
let musicOsc: OscillatorNode | null = null;
let musicGain: GainNode | null = null;
let musicInterval: ReturnType<typeof setInterval> | null = null;

const MELODY = [
  523, 587, 659, 784, 659, 587, 523, 440,
  523, 659, 784, 880, 784, 659, 523, 440,
  349, 440, 523, 587, 523, 440, 349, 330,
  392, 440, 523, 587, 659, 587, 523, 440,
];

export function startMusic() {
  stopMusic();
  const ctx = getCtx();
  if (!ctx) return;
  musicGain = ctx.createGain();
  musicGain.gain.value = 0.06;
  musicGain.connect(ctx.destination);
  let noteIndex = 0;
  const playNote = () => {
    if (!ctx || !musicGain) return;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = MELODY[noteIndex % MELODY.length];
    const noteGain = ctx.createGain();
    noteGain.gain.value = 1;
    noteGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
    osc.connect(noteGain);
    noteGain.connect(musicGain!);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.38);
    noteIndex++;
  };
  playNote();
  musicInterval = setInterval(playNote, 400);
}

export function stopMusic() {
  if (musicInterval) { clearInterval(musicInterval); musicInterval = null; }
  if (musicOsc) { try { musicOsc.stop(); } catch {} musicOsc = null; }
  musicGain = null;
}
