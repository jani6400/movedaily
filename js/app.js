// App-Shell: Navigation und Ansichten (Heute, Vorschau, Bibliothek, Verlauf, Einstellungen).

import { EXERCISES, BY_ID, CATS, AREAS, formatAmount } from './exercises.js';
import { createFigure } from './figure.js';
import { store, dateKey } from './storage.js';
import { generate, dailyWorkout, swapItem, singleWorkout, DURATIONS, FOCI } from './generator.js';
import { startPlayer, estimateText } from './player.js';
import { unlockAudio, speak, voiceAvailable } from './signals.js';
import { h, icon, toast, confirmDialog, sheet } from './ui.js';

const app = document.getElementById('app');
const view = h('main', { class: 'view' });
const nav = h('nav', { class: 'tabbar' });
app.append(view, nav);

const TABS = [
  { route: '', label: 'Heute', icon: 'home' },
  { route: 'library', label: 'Übungen', icon: 'grid' },
  { route: 'history', label: 'Verlauf', icon: 'calendar' },
  { route: 'settings', label: 'Einstellungen', icon: 'sliders' },
];

let currentWorkout = null;
let libFilter = { cat: 'all', area: 'all', list: 'all', q: '' };

// ---------- Hilfen ----------
const greet = () => {
  const hr = new Date().getHours();
  return hr < 11 ? 'Guten Morgen' : hr < 17 ? 'Hallo' : hr < 22 ? 'Guten Abend' : 'Gute Nacht';
};
const fmtDate = (d) => d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

function thumb(e, cls = 'thumb') {
  const box = h('div', { class: cls });
  box.append(createFigure(e.anim, { animate: false, aspect: 1.35, label: cls !== 'mini' }).svg);
  return box;
}

function catChip(e) {
  const c = CATS[e.cat];
  return h('span', { class: `chip cat-${e.cat}` }, `${c.icon} ${c.label}`);
}

function header(title, { back, right } = {}) {
  return h('header', { class: 'topbar' }, [
    back ? h('button', { class: 'icon-btn', 'aria-label': 'Zurück', onclick: back }, icon('back')) : null,
    h('h1', {}, title),
    right || null,
  ]);
}

function go(route) { location.hash = '#/' + route; }

// ---------- Router ----------
function render() {
  const route = location.hash.replace(/^#\/?/, '').split('/')[0];
  view.replaceChildren();
  window.scrollTo(0, 0);
  const fn = { '': homeView, library: libraryView, history: historyView, settings: settingsView, preview: previewView }[route] || homeView;
  fn();
  nav.replaceChildren(...TABS.map((t) => h('a', {
    href: '#/' + t.route,
    class: 'tab' + ((route === t.route || (route === 'preview' && t.route === '')) ? ' active' : ''),
  }, [icon(t.icon), h('span', {}, t.label)])));
}
window.addEventListener('hashchange', render);

// ---------- Heute ----------
function homeView() {
  const s = store.settings;
  const streak = store.streak();
  const today = new Date();
  const daily = dailyWorkout(today);
  const doneToday = store.doneToday();

  // Wochenstreifen
  const days = store.doneDays();
  const week = [];
  for (let k = 6; k >= 0; k--) {
    const d = new Date(); d.setDate(d.getDate() - k);
    week.push(h('div', { class: 'wday' + (days.has(dateKey(d)) ? ' done' : '') + (k === 0 ? ' today' : '') }, [
      h('span', {}, d.toLocaleDateString('de-DE', { weekday: 'narrow' })),
      h('i'),
    ]));
  }

  let minutes = s.lastMinutes;
  let focus = s.lastFocus;
  const durRow = h('div', { class: 'seg' });
  const focusGrid = h('div', { class: 'focus-grid' });
  const drawPickers = () => {
    durRow.replaceChildren(...DURATIONS.map((m) => h('button', {
      class: 'seg-btn' + (m === minutes ? ' on' : ''),
      onclick: () => { minutes = m; store.setSetting('lastMinutes', m); drawPickers(); },
    }, [h('b', {}, String(m)), h('small', {}, 'Min')])));
    focusGrid.replaceChildren(...Object.entries(FOCI).map(([k, f]) => h('button', {
      class: `focus-card f-${k}` + (k === focus ? ' on' : ''),
      onclick: () => { focus = k; store.setSetting('lastFocus', k); drawPickers(); },
    }, [h('span', { class: 'focus-ico' }, f.icon), h('b', {}, f.label), h('small', {}, f.desc)])));
  };
  drawPickers();

  view.append(
    h('section', { class: 'hero' }, [
      h('div', {}, [h('p', { class: 'muted' }, fmtDate(today)), h('h1', {}, `${greet()}!`)]),
      h('div', { class: 'streak' + (streak ? ' hot' : '') }, [h('span', {}, '🔥'), h('b', {}, String(streak))]),
    ]),
    h('div', { class: 'week' }, week),
    h('section', { class: 'card daily' }, [
      h('div', { class: 'daily-head' }, [
        h('div', {}, [h('p', { class: 'eyebrow' }, 'Workout des Tages'), h('h2', {}, daily.title)]),
        doneToday ? h('span', { class: 'badge ok' }, [icon('check'), ' Erledigt']) : null,
      ]),
      h('p', { class: 'muted' }, `${daily.items.length} Übungen · ${estimateText(daily)}`),
      h('div', { class: 'thumb-row' }, daily.items.slice(0, 5).map((it) => thumb(BY_ID[it.id], 'mini'))),
      h('button', { class: 'btn primary big', onclick: () => { currentWorkout = daily; go('preview'); } }, [icon('play'), doneToday ? ' Nochmal machen' : ' Starten']),
    ]),
    h('section', { class: 'card' }, [
      h('h2', {}, 'Eigenes Workout'),
      h('p', { class: 'label' }, 'Wie viel Zeit hast du?'),
      durRow,
      h('p', { class: 'label' }, 'Worauf liegt der Fokus?'),
      focusGrid,
      h('button', {
        class: 'btn primary big',
        onclick: () => { currentWorkout = generate({ minutes, focus }); go('preview'); },
      }, [icon('shuffle'), ' Workout erstellen']),
    ]),
  );
}

// ---------- Vorschau ----------
function previewView() {
  const w = currentWorkout;
  if (!w) { go(''); return; }
  const list = h('ol', { class: 'ex-list' });
  const sub = h('p', { class: 'muted' });

  const draw = () => {
    sub.textContent = `${w.items.length} Übungen · ${estimateText(w)}`;
    list.replaceChildren(...w.items.map((it, i) => {
      const e = BY_ID[it.id];
      return h('li', { class: 'ex-row' }, [
        h('button', { class: 'ex-main', onclick: () => openDetail(e) }, [
          thumb(e, 'thumb sm'),
          h('div', { class: 'ex-txt' }, [
            h('b', {}, e.name),
            h('span', { class: 'muted' }, [h('i', { class: `dot cat-${e.cat}` }), formatAmountItem(e, it)]),
          ]),
        ]),
        w.single ? null : h('button', {
          class: 'icon-btn', 'aria-label': 'Übung austauschen',
          onclick: () => { if (swapItem(w, i)) draw(); else toast('Keine Alternative verfügbar'); },
        }, icon('swap')),
      ]);
    }));
  };
  draw();

  const title = w.title || (w.single ? 'Einzelübung' : `${w.minutes} Min · ${FOCI[w.focus]?.label || ''}`);
  view.append(
    header(title, { back: () => history.length > 1 ? history.back() : go('') }),
    sub,
    list,
    h('div', { class: 'sticky-actions' }, [
      (w.daily || w.single) ? null : h('button', {
        class: 'btn ghost', onclick: () => { currentWorkout = generate({ minutes: w.minutes, focus: w.focus }); previewView.redraw(); },
      }, [icon('shuffle'), ' Neu mischen']),
      h('button', { class: 'btn primary big', onclick: () => start(w) }, [icon('play'), ' Start']),
    ]),
  );
}
previewView.redraw = () => { view.replaceChildren(); previewView(); };

function formatAmountItem(e, it) {
  const side = e.perSide ? ' / Seite' : '';
  return e.type === 'time' ? `${it.dur} Sek.${side}` : `${it.reps}×${side}`;
}

function start(w) {
  unlockAudio();
  startPlayer(w, { onExit: () => location.replace('#/') });
}

// ---------- Übungsdetail ----------
function openDetail(e) {
  const fav = h('button', { class: 'btn ghost' + (store.isFav(e.id) ? ' on' : '') });
  const hid = h('button', { class: 'btn ghost' + (store.isHidden(e.id) ? ' on' : '') });
  const paint = () => {
    fav.className = 'btn ghost toggle' + (store.isFav(e.id) ? ' on fav' : '');
    fav.replaceChildren(icon('heart'), store.isFav(e.id) ? ' Favorit' : ' Favorisieren');
    hid.className = 'btn ghost toggle' + (store.isHidden(e.id) ? ' on hid' : '');
    hid.replaceChildren(icon(store.isHidden(e.id) ? 'eyeoff' : 'eye'), store.isHidden(e.id) ? ' Ausgeblendet' : ' Ausblenden');
  };
  fav.onclick = () => { store.toggleFav(e.id); paint(); };
  hid.onclick = () => { store.toggleHidden(e.id); paint(); };
  paint();

  const figBox = h('div', { class: 'detail-fig' });
  figBox.append(createFigure(e.anim, { aspect: 1.4 }).svg);
  const s = sheet(h('div', { class: 'detail' }, [
    figBox,
    h('h2', {}, e.name),
    h('div', { class: 'chips' }, [
      ...e.cats.map((c) => h('span', { class: `chip cat-${c}` }, `${CATS[c].icon} ${CATS[c].label}`)),
      ...e.areas.map((a) => h('span', { class: 'chip' }, AREAS[a])),
      e.wall ? h('span', { class: 'chip' }, [icon('wall'), ' Wand']) : null,
    ]),
    h('p', { class: 'amount' }, [icon('clock'), ' ', formatAmount(e)]),
    h('ol', { class: 'steps' }, e.steps.map((t) => h('li', {}, t))),
    h('p', { class: 'tip' }, '💡 ' + e.tip),
    h('div', { class: 'detail-actions' }, [fav, hid]),
    h('button', { class: 'btn primary big', onclick: () => { s.close(); currentWorkout = singleWorkout(e.id); start(currentWorkout); } }, [icon('play'), ' Jetzt üben']),
  ]), { onClose: () => { if (location.hash.startsWith('#/library')) drawLibrary?.(); } });
}

// ---------- Bibliothek ----------
let drawLibrary = null;
function libraryView() {
  const grid = h('div', { class: 'lib-grid' });
  const count = h('p', { class: 'muted small' });
  const search = h('input', { type: 'search', placeholder: 'Übung suchen…', value: libFilter.q, class: 'search' });
  search.addEventListener('input', () => { libFilter.q = search.value; draw(); });

  const chipRow = (opts, key) => {
    const row = h('div', { class: 'chip-row' });
    const paint = () => row.replaceChildren(...opts.map(([v, label]) => h('button', {
      class: 'chip btn-chip' + (libFilter[key] === v ? ' on' : ''),
      onclick: () => { libFilter[key] = v; paint(); draw(); },
    }, label)));
    paint();
    return row;
  };

  const draw = () => {
    const q = libFilter.q.trim().toLowerCase();
    const list = EXERCISES.filter((e) =>
      (libFilter.cat === 'all' || e.cats.includes(libFilter.cat)) &&
      (libFilter.area === 'all' || e.areas.includes(libFilter.area)) &&
      (libFilter.list === 'all' ? true : libFilter.list === 'fav' ? store.isFav(e.id) : store.isHidden(e.id)) &&
      (!q || e.name.toLowerCase().includes(q)));
    count.textContent = `${list.length} Übungen`;
    grid.replaceChildren(...list.map((e) => h('button', {
      class: 'lib-card' + (store.isHidden(e.id) ? ' hidden-ex' : ''),
      onclick: () => openDetail(e),
    }, [
      thumb(e),
      store.isFav(e.id) ? h('span', { class: 'fav-dot' }, icon('heart')) : null,
      store.isHidden(e.id) ? h('span', { class: 'fav-dot hid' }, icon('eyeoff')) : null,
      h('b', {}, e.name),
      h('span', { class: 'muted small' }, [h('i', { class: `dot cat-${e.cat}` }), formatAmount(e)]),
    ])));
    if (!list.length) grid.append(h('p', { class: 'empty muted' }, libFilter.list === 'fav' ? 'Noch keine Favoriten – tippe bei einer Übung auf das Herz.' : libFilter.list === 'hidden' ? 'Keine ausgeblendeten Übungen.' : 'Nichts gefunden.'));
  };
  drawLibrary = draw;

  view.append(
    header('Übungen'),
    search,
    chipRow([['all', 'Alle'], ...Object.entries(CATS).map(([k, c]) => [k, `${c.icon} ${c.label}`])], 'cat'),
    chipRow([['all', 'Alle Bereiche'], ...Object.entries(AREAS)], 'area'),
    chipRow([['all', 'Alle'], ['fav', '❤️ Favoriten'], ['hidden', '🚫 Ausgeblendet']], 'list'),
    count,
    grid,
  );
  draw();
}

// ---------- Verlauf ----------
let calMonth = new Date();
function historyView() {
  const t = store.totals();
  const cal = h('div', { class: 'cal' });
  const drawCal = () => {
    const y = calMonth.getFullYear(), m = calMonth.getMonth();
    const first = new Date(y, m, 1);
    const offset = (first.getDay() + 6) % 7; // Montag zuerst
    const daysIn = new Date(y, m + 1, 0).getDate();
    const done = store.doneDays();
    const todayKey = dateKey();
    const cells = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => h('span', { class: 'cal-h' }, d));
    for (let i = 0; i < offset; i++) cells.push(h('span'));
    for (let d = 1; d <= daysIn; d++) {
      const k = dateKey(new Date(y, m, d));
      cells.push(h('span', { class: 'cal-d' + (done.has(k) ? ' done' : '') + (k === todayKey ? ' today' : '') }, String(d)));
    }
    cal.replaceChildren(
      h('div', { class: 'cal-nav' }, [
        h('button', { class: 'icon-btn', 'aria-label': 'Voriger Monat', onclick: () => { calMonth = new Date(y, m - 1, 1); drawCal(); } }, icon('back')),
        h('b', {}, first.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })),
        h('button', { class: 'icon-btn', 'aria-label': 'Nächster Monat', onclick: () => { calMonth = new Date(y, m + 1, 1); drawCal(); } }, icon('chevron')),
      ]),
      h('div', { class: 'cal-grid' }, cells),
    );
  };
  drawCal();

  const recent = store.state.history.slice(-15).reverse();
  view.append(
    header('Verlauf'),
    h('div', { class: 'stats grid4' }, [
      h('div', { class: 'stat hot' }, [h('b', {}, `🔥 ${store.streak()}`), h('span', {}, 'Aktuelle Serie')]),
      h('div', { class: 'stat' }, [h('b', {}, String(store.bestStreak())), h('span', {}, 'Beste Serie')]),
      h('div', { class: 'stat' }, [h('b', {}, String(t.workouts)), h('span', {}, 'Workouts')]),
      h('div', { class: 'stat' }, [h('b', {}, String(t.minutes)), h('span', {}, 'Minuten')]),
    ]),
    h('section', { class: 'card' }, cal),
    h('h2', { class: 'section-title' }, 'Letzte Workouts'),
    recent.length ? h('ul', { class: 'hist' }, recent.map((r) => h('li', {}, [
      h('div', {}, [
        h('b', {}, `${FOCI[r.focus]?.icon || '•'} ${r.daily ? 'Workout des Tages' : FOCI[r.focus]?.label || 'Workout'}`),
        h('span', { class: 'muted small' }, new Date(r.ts).toLocaleString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })),
      ]),
      h('span', { class: 'muted' }, `${Math.max(1, Math.round((r.seconds || 0) / 60))} Min · ${r.ex?.length || 0} Üb.`),
    ]))) : h('p', { class: 'empty muted' }, 'Noch keine Workouts – dein erstes wartet auf der Startseite!'),
  );
}

// ---------- Einstellungen ----------
let installEvent = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; });

function settingsView() {
  const s = store.settings;
  const toggle = (key, label, desc) => h('label', { class: 'row' }, [
    h('div', {}, [h('b', {}, label), desc ? h('span', { class: 'muted small' }, desc) : null]),
    h('input', { type: 'checkbox', class: 'switch', checked: !!s[key], onchange: (ev) => store.setSetting(key, ev.target.checked) }),
  ]);
  const choice = (key, label, values, unit) => {
    const row = h('div', { class: 'seg small' });
    const paint = () => row.replaceChildren(...values.map((v) => h('button', {
      class: 'seg-btn' + (s[key] === v ? ' on' : ''), onclick: () => { store.setSetting(key, v); paint(); },
    }, `${v} ${unit}`)));
    paint();
    return h('div', { class: 'row col' }, [h('b', {}, label), row]);
  };

  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

  view.append(
    header('Einstellungen'),
    h('section', { class: 'card list' }, [
      toggle('sound', 'Töne', 'Countdown-Pieptöne in den letzten Sekunden'),
      toggle('vibrate', 'Vibration', 'Beim Übungswechsel (Android)'),
      voiceAvailable() ? toggle('voice', 'Sprachansage', 'Sagt die nächste Übung an') : null,
      voiceAvailable() ? h('button', { class: 'btn ghost small', onclick: () => { unlockAudio(); speak('Als Nächstes: Glute Bridge. 15 Wiederholungen.'); } }, 'Ansage testen') : null,
      toggle('wall', 'Übungen mit Wand', 'z. B. Wall Sit oder Couch Stretch vorschlagen'),
    ]),
    h('section', { class: 'card list' }, [
      choice('rest', 'Vorbereitungszeit zwischen Übungen', [5, 10, 15, 20], 's'),
      choice('dailyMinutes', 'Länge des Workouts des Tages', [3, 5, 10, 15], 'Min'),
    ]),
    standalone ? null : h('section', { class: 'card list' }, [
      h('b', {}, 'Als App installieren'),
      installEvent
        ? h('button', { class: 'btn primary', onclick: async () => { installEvent.prompt(); installEvent = null; } }, [icon('download'), ' Installieren'])
        : h('p', { class: 'muted small' }, ios
          ? 'In Safari unten auf „Teilen“ tippen und „Zum Home-Bildschirm“ wählen.'
          : 'Im Browser-Menü (⋮) „App installieren“ bzw. „Zum Startbildschirm hinzufügen“ wählen.'),
    ]),
    h('section', { class: 'card list' }, [
      h('b', {}, 'Daten'),
      h('p', { class: 'muted small' }, `${store.state.favorites.length} Favoriten · ${store.state.hidden.length} ausgeblendet · alles nur lokal auf diesem Gerät gespeichert.`),
      h('button', {
        class: 'btn ghost small', onclick: async () => {
          if (await confirmDialog('Listen zurücksetzen?', 'Alle Favoriten und ausgeblendeten Übungen werden gelöscht.', 'Zurücksetzen')) { store.resetLists(); render(); toast('Listen zurückgesetzt'); }
        },
      }, 'Favoriten & Ausgeblendete zurücksetzen'),
      h('button', {
        class: 'btn ghost small danger', onclick: async () => {
          if (await confirmDialog('Alles löschen?', 'Verlauf, Serie, Favoriten und Einstellungen werden unwiderruflich gelöscht.', 'Alles löschen')) { store.resetAll(); render(); toast('Alle Daten gelöscht'); }
        },
      }, 'Alle Daten löschen'),
    ]),
    h('p', { class: 'muted small foot' }, 'Hinweis: Die Übungen ersetzen keine ärztliche oder physiotherapeutische Beratung. Bei Schmerzen abbrechen. · Version 1.0'),
  );
}

// ---------- Start ----------
render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
