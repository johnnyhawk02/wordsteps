// Sound: each word plays its Coral recording (media/voice/), decoded once and
// kept in memory so a replay is instant. Web Audio has to be started by a tap
// on iPad, so unlock() runs on the first touch. A word without a recording
// falls back to the iPad's own voice.

import { voiceUrl } from './words.js';

let ctx = null;
const buffers = new Map(); // word -> Promise<AudioBuffer|null>
let playing = null;

export function unlock() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  // Safari also wants one silent buffer played inside the tap.
  const src = ctx.createBufferSource();
  src.buffer = ctx.createBuffer(1, 1, 22050);
  src.connect(ctx.destination);
  src.start(0);
}

function load(word) {
  if (!buffers.has(word)) {
    buffers.set(word, fetch(voiceUrl(word))
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then((data) => new Promise((resolve, reject) => ctx.decodeAudioData(data, resolve, reject)))
      .catch(() => { buffers.delete(word); return null; }));
  }
  return buffers.get(word);
}

/** Loads a set's words ahead of time, so the first play has no delay. */
export function preload(words) { if (ctx) for (const w of words) load(w); }

export function stop() {
  try { playing?.stop(); } catch { /* already finished */ }
  playing = null;
  speechSynthesis?.cancel();
}

/** Says a word; resolves when it has finished. */
export async function say(word) {
  stop();
  if (!ctx) unlock();
  const buf = await load(word);
  if (buf) {
    return new Promise((resolve) => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.onended = resolve;
      playing = src;
      src.start();
    });
  }
  if (!window.speechSynthesis) return;
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(word);
    u.lang = 'en-GB';
    u.rate = 0.85;
    u.onend = resolve;
    u.onerror = resolve;
    speechSynthesis.speak(u);
  });
}

/** A soft rising chime for a right answer. */
export function chime() {
  if (!ctx) return;
  const t = ctx.currentTime;
  [523.25, 659.25, 783.99].forEach((f, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t + i * 0.09);
    g.gain.linearRampToValueAtTime(0.18, t + i * 0.09 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.6);
    o.connect(g).connect(ctx.destination);
    o.start(t + i * 0.09);
    o.stop(t + i * 0.09 + 0.65);
  });
}
