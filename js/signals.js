// Töne, Vibration, Sprachansage und Bildschirm-Sperre verhindern.

import { store } from './storage.js';

// ==================== Sanfte Klänge ====================
// Glocken-/Marimba-artige Töne statt Piepsen: weicher Anschlag, lange Ausklingzeit,
// Tiefpass und ein leises Echo für Raum.
let ctx = null;
let out = null;

function setupAudio() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  const master = ctx.createGain();
  master.gain.value = 0.9;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 3200;
  // leises Echo
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.19;
  const fb = ctx.createGain();
  fb.gain.value = 0.22;
  const wet = ctx.createGain();
  wet.gain.value = 0.18;
  lp.connect(master);
  lp.connect(delay);
  delay.connect(fb).connect(delay);
  delay.connect(wet).connect(master);
  master.connect(ctx.destination);
  out = lp;
}

// Muss in einem Klick-Handler aufgerufen werden (iOS/Android entsperren Audio nur nach Nutzer-Geste)
export function unlockAudio() {
  try {
    setupAudio();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  } catch { /* kein Audio */ }
  if ('speechSynthesis' in window && store.settings.voice) {
    // leere Ansage entsperrt die Sprachausgabe auf iOS
    const u = new SpeechSynthesisUtterance('');
    u.volume = 0;
    speechSynthesis.speak(u);
  }
}

// Ein weicher Glockenton: Grundton + leise Obertöne, sanfter Anschlag, exponentielles Ausklingen
function bell(freq, { at = 0, dur = 1.4, vol = 0.12, partials = [[1, 1], [2, 0.28], [3.01, 0.08]] } = {}) {
  if (!store.settings.sound || !ctx || !out) return;
  const t = ctx.currentTime + at;
  for (const [mult, amp] of partials) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq * mult;
    const d = dur / (mult > 1 ? mult * 0.9 : 1); // Obertöne klingen schneller aus
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * amp, t + 0.018);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + d + 0.05);
  }
}

// Kurzer, gedämpfter Holz-Klick für den Countdown
function wood(freq = 700, vol = 0.09) {
  if (!store.settings.sound || !ctx || !out) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = 4;
  o.type = 'triangle';
  o.frequency.setValueAtTime(freq * 1.15, t);
  o.frequency.exponentialRampToValueAtTime(freq, t + 0.05);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  o.connect(f).connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.2);
}

// Töne (C-Dur-Pentatonik, klingt immer harmonisch)
const N = { G4: 392, A4: 440, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, C6: 1046.5 };

export const tick = () => wood(760);                                   // 3 – 2 – 1
export const go = () => { bell(N.G4, { vol: 0.11 }); bell(N.C5, { at: 0.14, vol: 0.12, dur: 1.8 }); }; // Start
export const workEnd = () => { bell(N.E5, { vol: 0.1 }); bell(N.C5, { at: 0.16, vol: 0.09, dur: 1.6 }); }; // Übung fertig
export const sideSwitch = () => bell(N.D5, { vol: 0.09, dur: 1.2 });
export const finish = () => {
  [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => bell(f, { at: i * 0.16, vol: 0.1, dur: 2.2 }));
};
export const preview = () => { unlockAudio(); go(); setTimeout(tick, 1600); setTimeout(finish, 2300); };

export function vibrate(pattern) {
  if (store.settings.vibrate && navigator.vibrate) navigator.vibrate(pattern);
}

// ==================== Sprachausgabe ====================
// Browser können nur Stimmen nutzen, die auf dem Gerät installiert sind. Wir wählen
// automatisch eine männliche, möglichst natürlich klingende deutsche Stimme.
const MALE = /\b(stefan|conrad|killian|kilian|markus|yannick|martin|viktor|eddy|reed|rocko|grandpa|florian|jonas|ralf|christoph|bernd|klaus|kasper|hans|daniel|thomas|michael|lukas|felix|christian|matthias|male|männlich)\b/i;
const FEMALE = /\b(anna|petra|helena|hedda|katja|marlene|vicki|sandy|shelley|flo|amala|seraphina|louisa|elke|gisela|tanja|ingrid|female|weiblich)\b|google deutsch/i;
const QUALITY = /natural|neural|premium|enhanced|erweitert|siri/i;

export function genderOf(v) {
  if (MALE.test(v.name)) return 'male';
  if (FEMALE.test(v.name)) return 'female';
  return 'unknown';
}

function score(v) {
  let s = 0;
  const g = genderOf(v);
  if (g === 'male') s += 100;
  if (g === 'female') s -= 100;
  if (QUALITY.test(v.name)) s += 30;
  if (/online/i.test(v.name)) s += 10; // Edge: natürliche Online-Stimmen
  if (v.localService) s += 5;
  if (/de-DE/i.test(v.lang)) s += 3;
  return s;
}

export function germanVoices() {
  if (!('speechSynthesis' in window)) return [];
  return speechSynthesis.getVoices()
    .filter((v) => v.lang && v.lang.toLowerCase().startsWith('de'))
    .sort((a, b) => score(b) - score(a));
}

let voice = null;
function pickVoice() {
  const vs = germanVoices();
  const wanted = store.settings.voiceName;
  voice = (wanted && vs.find((v) => v.name === wanted)) || vs[0] || null;
}
if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}
export const currentVoice = () => { pickVoice(); return voice; };

export function speak(text, { interrupt = true } = {}) {
  if (!store.settings.voice || !('speechSynthesis' in window) || !text) return;
  pickVoice();
  if (interrupt) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = voice?.lang || 'de-DE';
  if (voice) u.voice = voice;
  // ruhiges Sprechtempo; ist keine männliche Stimme installiert, etwas tiefer
  u.rate = 0.96;
  u.pitch = voice && genderOf(voice) !== 'male' ? 0.82 : 0.98;
  u.volume = 1;
  speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

export const voiceAvailable = () => 'speechSynthesis' in window;

// Abwechslungsreiche, natürliche Formulierungen
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const PHRASES = {
  first: (name, amount) => pick([`Los geht's. Wir starten mit: ${name}. ${amount}.`, `Auf geht's! Erste Übung: ${name}. ${amount}.`]),
  next: (name, amount) => pick([`Als Nächstes: ${name}. ${amount}.`, `Weiter mit: ${name}. ${amount}.`, `Jetzt kommt: ${name}. ${amount}.`]),
  last: (name, amount) => pick([`Letzte Übung: ${name}. ${amount}.`, `Endspurt. Zum Schluss: ${name}. ${amount}.`]),
  start: () => pick(['Und los.', 'Los geht\'s.', 'Start.']),
  side1: () => pick(['Erste Seite. Los.', 'Wir beginnen mit der ersten Seite.']),
  side2: () => pick(['Und jetzt die andere Seite.', 'Zweite Seite. Los.']),
  switch: () => pick(['Seite wechseln.', 'Wechsel die Seite.']),
  half: () => pick(['Halbzeit.', 'Die Hälfte ist geschafft.', 'Halbzeit. Ruhig weiteratmen.']),
  tenLeft: () => pick(['Noch zehn Sekunden.', 'Zehn Sekunden noch.']),
  reps: (n) => `${n} Wiederholungen. Tipp auf Fertig, wenn du durch bist.`,
  done: () => pick(['Geschafft! Richtig gut gemacht.', 'Fertig für heute. Stark!', 'Geschafft. Dein Körper sagt danke.']),
};

// ==================== Bildschirm anlassen ====================
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
