// Töne, Vibration, Sprachansage und Bildschirm-Sperre verhindern.

import { store } from './storage.js';

let ctx = null;

// Muss in einem Klick-Handler aufgerufen werden (iOS/Android entsperren Audio nur nach Nutzer-Geste)
export function unlockAudio() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch { /* kein Audio */ }
  if ('speechSynthesis' in window && store.settings.voice) {
    // leere Ansage entsperrt die Sprachausgabe auf iOS
    const u = new SpeechSynthesisUtterance('');
    u.volume = 0;
    speechSynthesis.speak(u);
  }
}

export function beep(freq = 880, dur = 0.12, vol = 0.22) {
  if (!store.settings.sound || !ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const tick = () => beep(660, 0.09);
export const go = () => { beep(990, 0.18); setTimeout(() => beep(1320, 0.22), 160); };
export const finish = () => { beep(784, 0.15); setTimeout(() => beep(988, 0.15), 150); setTimeout(() => beep(1318, 0.3), 300); };

export function vibrate(pattern) {
  if (store.settings.vibrate && navigator.vibrate) navigator.vibrate(pattern);
}

// ---------- Sprachausgabe ----------
let voice = null;
function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const vs = speechSynthesis.getVoices().filter((v) => v.lang && v.lang.toLowerCase().startsWith('de'));
  voice = vs.find((v) => /google|premium|enhanced|anna|petra|helena/i.test(v.name)) || vs[0] || null;
}
if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

export function speak(text, { interrupt = true } = {}) {
  if (!store.settings.voice || !('speechSynthesis' in window) || !text) return;
  if (interrupt) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'de-DE';
  if (voice) u.voice = voice;
  u.rate = 1.0;
  u.pitch = 1.0;
  speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

export const voiceAvailable = () => 'speechSynthesis' in window;

// ---------- Bildschirm anlassen ----------
let lock = null;
let wantLock = false;

async function acquire() {
  try {
    if ('wakeLock' in navigator && document.visibilityState === 'visible') {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    }
  } catch { /* nicht unterstützt oder verweigert */ }
}

export function keepAwake(on) {
  wantLock = on;
  if (on && !lock) acquire();
  if (!on && lock) { lock.release(); lock = null; }
}

document.addEventListener('visibilitychange', () => {
  if (wantLock && document.visibilityState === 'visible' && !lock) acquire();
});
