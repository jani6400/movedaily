// Workout-Generator: wählt Übungen passend zu Zeit und Fokus.

import { EXERCISES, BY_ID, exerciseSeconds } from './exercises.js';
import { store, dateKey } from './storage.js';

export const DURATIONS = [1, 3, 5, 10, 15];

export const FOCI = {
  mix: { label: 'Mix', icon: '✨', desc: 'Von allem etwas' },
  mobility: { label: 'Mobility', icon: '🌀', desc: 'Hüfte, Rücken, Knie' },
  strength: { label: 'Kräftigung', icon: '💪', desc: 'Po, Beine, Rumpf' },
  stretch: { label: 'Dehnen', icon: '🧘', desc: 'Länge & Weite' },
  relax: { label: 'Entspannung', icon: '🌙', desc: 'Runterkommen' },
};

// Ablauf je Fokus: Phasen mit Anteil an der Übungsanzahl
const PLANS = {
  mix: [
    { cats: ['mobility'], share: 0.35 },
    { cats: ['strength'], share: 0.4, main: true },
    { cats: ['stretch', 'relax'], share: 0.25 },
  ],
  mobility: [
    { cats: ['mobility'], share: 0.85, main: true },
    { cats: ['stretch', 'relax'], share: 0.15 },
  ],
  strength: [
    { cats: ['mobility'], share: 0.2 },
    { cats: ['strength'], share: 0.65, main: true },
    { cats: ['stretch'], share: 0.15 },
  ],
  stretch: [
    { cats: ['mobility'], share: 0.2 },
    { cats: ['stretch'], share: 0.65, main: true },
    { cats: ['relax'], share: 0.15 },
  ],
  relax: [
    { cats: ['stretch'], share: 0.35 },
    { cats: ['relax'], share: 0.65, main: true },
  ],
};

// Workout des Tages: Thema je Wochentag (So=0)
const DAILY_THEME = ['relax', 'mobility', 'strength', 'stretch', 'strength', 'mobility', 'mix'];
const DAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

const SLOT = { 1: 20, 3: 35, 5: 45, 10: 50, 15: 55 };

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function pool(cats, used) {
  const s = store.settings;
  return EXERCISES.filter((e) =>
    !used.has(e.id) &&
    !store.isHidden(e.id) &&
    (s.wall || !e.wall) &&
    e.cats.some((c) => cats.includes(c)));
}

function weight(e, cats, recent, short) {
  let w = 1;
  if (short && e.perSide) w *= 0.15; // bei Kurz-Workouts lieber beidseitige Übungen
  if (cats.includes(e.cat)) w *= 1.6; // Hauptkategorie passt
  if (store.isFav(e.id)) w *= 3;
  if (recent.has(e.id)) w *= 0.45;
  return w;
}

function pick(list, cats, recent, rnd, short = false) {
  const ws = list.map((e) => weight(e, cats, recent, short));
  let r = rnd() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) { r -= ws[i]; if (r <= 0) return list[i]; }
  return list[list.length - 1];
}

function distribute(n, plan) {
  const raw = plan.map((p) => p.share * n);
  const counts = raw.map(Math.floor);
  let rest = n - counts.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rest > 0; k = (k + 1) % order.length, rest--) counts[order[k][1]]++;
  const mainIdx = plan.findIndex((p) => p.main);
  if (counts[mainIdx] === 0) {
    const donor = counts.findIndex((c, i) => c > 0 && i !== mainIdx);
    if (donor >= 0) { counts[donor]--; counts[mainIdx]++; }
  }
  return counts;
}

// Zeiten an das Budget anpassen
function fit(items, minutes, rest) {
  const total = minutes * 60;
  const avail = total - rest * (items.length - 1);
  const natural = items.reduce((a, it) => a + exerciseSeconds(BY_ID[it.id]), 0);
  const f = Math.min(2, Math.max(0.35, avail / natural));
  const minReps = minutes <= 1 ? 3 : 5;
  for (const it of items) {
    const e = BY_ID[it.id];
    if (e.type === 'time') it.dur = Math.max(10, Math.round((e.dur * f) / 5) * 5);
    else it.reps = Math.max(minReps, Math.round(e.reps * Math.min(f, 1.5)));
  }
}

export function itemSeconds(it) {
  const e = BY_ID[it.id];
  const one = e.type === 'time' ? it.dur : it.reps * e.rep;
  return one * (e.perSide ? 2 : 1) + (e.perSide ? 5 : 0);
}

export function workoutSeconds(w) {
  return w.items.reduce((a, it) => a + itemSeconds(it), 0) + w.rest * Math.max(0, w.items.length - 1);
}

export function generate({ minutes, focus, seed }) {
  const rnd = mulberry32(seed ?? Math.floor(Math.random() * 2 ** 31));
  const rest = minutes <= 1 ? 5 : store.settings.rest;
  const slot = SLOT[minutes] || 40;
  const n = Math.max(2, Math.round((minutes * 60 + rest) / (slot + rest)));
  const plan = PLANS[focus] || PLANS.mix;
  const counts = distribute(n, plan);
  const recent = store.recentIds();
  const used = new Set();
  const items = [];

  plan.forEach((phase, pi) => {
    for (let k = 0; k < counts[pi]; k++) {
      let list = pool(phase.cats, used);
      if (!list.length) list = pool(plan.flatMap((p) => p.cats), used);
      if (!list.length) return;
      const e = pick(list, phase.cats, recent, rnd, minutes <= 3);
      used.add(e.id);
      items.push({ id: e.id, phase: pi });
    }
  });

  fit(items, minutes, rest);
  return { minutes, focus, rest, items, created: Date.now() };
}

// Eine Übung im Workout austauschen
export function swapItem(w, index) {
  const plan = PLANS[w.focus] || PLANS.mix;
  const it = w.items[index];
  const cats = plan[it.phase]?.cats || [BY_ID[it.id].cat];
  const used = new Set(w.items.map((x) => x.id));
  let list = pool(cats, used);
  if (!list.length) return false;
  const e = pick(list, cats, store.recentIds(), Math.random, w.minutes <= 3);
  w.items[index] = { id: e.id, phase: it.phase };
  fit(w.items, w.minutes, w.rest);
  return true;
}

export function dailyWorkout(date = new Date()) {
  const focus = DAILY_THEME[date.getDay()];
  const minutes = store.settings.dailyMinutes;
  const w = generate({ minutes, focus, seed: hash(dateKey(date) + focus + minutes) });
  w.daily = true;
  w.title = `${DAY_NAMES[date.getDay()]}: ${FOCI[focus].label}`;
  return w;
}

// Einzelübung als Mini-Workout
export function singleWorkout(id) {
  return { minutes: 0, focus: BY_ID[id].cat, rest: 5, items: [{ id, phase: 0, dur: BY_ID[id].dur, reps: BY_ID[id].reps }], single: true };
}
