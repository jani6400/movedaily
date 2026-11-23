// Lokale Datenhaltung (localStorage) – Favoriten, ausgeblendete Übungen, Verlauf, Einstellungen.

const KEY = 'sportapp.v1';

const DEFAULT_SETTINGS = {
  sound: true,
  vibrate: true,
  voice: true,
  rest: 10, // Sekunden Vorbereitung zwischen den Übungen
  wall: true, // Übungen mit Wand erlauben
  dailyMinutes: 5,
  lastMinutes: 5,
  lastFocus: 'mix',
};

function fresh() {
  return { favorites: [], hidden: [], history: [], settings: { ...DEFAULT_SETTINGS } };
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (!raw) return fresh();
    return {
      favorites: raw.favorites || [],
      hidden: raw.hidden || [],
      history: raw.history || [],
      settings: { ...DEFAULT_SETTINGS, ...(raw.settings || {}) },
    };
  } catch {
    return fresh();
  }
}

const state = load();
const listeners = new Set();

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
  for (const fn of listeners) fn(state);
}

export function dateKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const store = {
  get state() { return state; },
  get settings() { return state.settings; },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  isFav: (id) => state.favorites.includes(id),
  isHidden: (id) => state.hidden.includes(id),
  toggleFav(id) {
    const i = state.favorites.indexOf(id);
    if (i >= 0) state.favorites.splice(i, 1);
    else {
      state.favorites.push(id);
      const h = state.hidden.indexOf(id);
      if (h >= 0) state.hidden.splice(h, 1);
    }
    save();
    return i < 0;
  },
  toggleHidden(id) {
    const i = state.hidden.indexOf(id);
    if (i >= 0) state.hidden.splice(i, 1);
    else {
      state.hidden.push(id);
      const f = state.favorites.indexOf(id);
      if (f >= 0) state.favorites.splice(f, 1);
    }
    save();
    return i < 0;
  },
  setSetting(k, v) { state.settings[k] = v; save(); },

  addHistory(entry) {
    state.history.push({ date: dateKey(), ts: Date.now(), ...entry });
    save();
  },

  resetLists() { state.favorites = []; state.hidden = []; save(); },
  resetAll() {
    const f = fresh();
    Object.assign(state, f);
    save();
  },

  // ---------- Statistik ----------
  doneDays() { return new Set(state.history.map((h) => h.date)); },
  doneToday() { return this.doneDays().has(dateKey()); },
  streak() {
    const days = this.doneDays();
    const d = new Date();
    if (!days.has(dateKey(d))) d.setDate(d.getDate() - 1);
    let n = 0;
    while (days.has(dateKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  },
  bestStreak() {
    const days = [...this.doneDays()].sort();
    let best = 0, cur = 0, prev = null;
    for (const k of days) {
      const d = new Date(k + 'T12:00:00');
      if (prev && (d - prev) / 86400000 < 1.5) cur++;
      else cur = 1;
      best = Math.max(best, cur);
      prev = d;
    }
    return best;
  },
  totals() {
    const secs = state.history.reduce((a, h) => a + (h.seconds || 0), 0);
    return { workouts: state.history.length, minutes: Math.round(secs / 60) };
  },
  // zuletzt gemachte Übungen (für Abwechslung)
  recentIds(n = 2) {
    const ids = new Set();
    for (const h of state.history.slice(-n)) for (const id of h.ex || []) ids.add(id);
    return ids;
  },
};
