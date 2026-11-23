// App-Shell: Navigation und Ansichten (Heute, Vorschau, Bibliothek, Verlauf, Einstellungen).

import { EXERCISES, BY_ID, CATS, AREAS, formatAmount } from './exercises.js';
import { createFigure } from './figure.js';
import { store, dateKey } from './storage.js';
import { generate, dailyWorkout, swapItem, singleWorkout, DURATIONS, FOCI } from './generator.js';
import { startPlayer, estimateText } from './player.js';
import { unlockAudio, speak, voiceAvailable, germanVoices, genderOf, currentVoice, preview as previewSounds } from './signals.js';
import { h, icon, toast, confirmDialog, sheet, CAT_ICON } from './ui.js';

const app = document.getElementById('app');
const view = h('main', { class: 'view' });
const nav = h('nav', { class: 'tabbar', 'aria-label': 'Hauptnavigation' });
app.append(view, nav);

const TABS = [
  { route: '', label: 'Heute', icon: 'home' },
  { route: 'library', label: 'Übungen', icon: 'grid' },
  { route: 'history', label: 'Verlauf', icon: 'calendar' },
  { route: 'settings', label: 'Einstellungen', icon: 'sliders' },
];

let currentWorkout = null;
const libFilter = { cat: 'all', area: 'all', list: 'all', q: '' };
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

// ---------- Hilfen ----------
const greet = () => {
  const hr = new Date().getHours();
  return hr < 11 ? 'Guten Morgen' : hr < 17 ? 'Hallo' : hr < 22 ? 'Guten Abend' : 'Gute Nacht';
};
const fmtDate = (d) => d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

function stage(e, cls = 'stage', opts = {}) {
  const box = h('div', { class: cls });
  box.append(createFigure(e.anim, { animate: false, aspect: 1.35, ...opts }).svg);
  return box;
}

const catLabel = (c) => h('span', { class: `cat cat-${c}` }, [icon(CAT_ICON[c]), CATS[c].label]);

function largeTitle(title, sub) {
  return h('header', { class: 'large-title' }, [sub ? h('p', { class: 'overline' }, sub) : null, h('h1', {}, title)]);
}

function navBar(title, back) {
  return h('header', { class: 'navbar' }, [
    h('button', { class: 'nav-back', onclick: back }, [icon('back'), 'Zurück']),
    h('h1', {}, title),
  ]);
}

// Gruppierte Liste im iOS-Stil
function group(title, rows, footer) {
  return h('section', { class: 'group' }, [
    title ? h('h2', { class: 'group-title' }, title) : null,
    h('div', { class: 'group-body' }, rows.filter(Boolean)),
    footer ? h('p', { class: 'group-footer' }, footer) : null,
  ]);
}

// Segmented Control (gleich breite Segmente, ein gleitender Daumen)
function segmented(values, current, label, onChange, fmt = (v) => String(v)) {
  const el = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label, style: `--n:${values.length}` });
  const paint = (cur) => {
    const i = Math.max(0, values.indexOf(cur));
    el.style.setProperty('--i', i);
    el.replaceChildren(h('span', { class: 'seg-thumb', 'aria-hidden': 'true' }), ...values.map((v) => h('button', {
      class: 'seg-item' + (v === cur ? ' on' : ''),
      role: 'radio',
      'aria-checked': String(v === cur),
      onclick: () => { onChange(v); paint(v); },
    }, fmt(v))));
  };
  paint(current);
  return el;
}

function go(route) { location.hash = '#/' + route; }

// ---------- Router ----------
let cleanupView = null;
function render() {
  const route = location.hash.replace(/^#\/?/, '').split('/')[0];
  cleanupView?.();
  cleanupView = null;
  view.replaceChildren();
  window.scrollTo(0, 0);
  const fn = { '': homeView, library: libraryView, history: historyView, settings: settingsView, preview: previewView }[route] || homeView;
  fn();
  const activeRoute = route === 'preview' || route === 'workout' ? '' : route;
  nav.replaceChildren(...TABS.map((t) => h('a', {
    href: '#/' + t.route,
    class: 'tab' + (activeRoute === t.route ? ' active' : ''),
    'aria-current': activeRoute === t.route ? 'page' : null,
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
    const done = days.has(dateKey(d));
    week.push(h('div', {
      class: 'wday' + (done ? ' done' : '') + (k === 0 ? ' today' : ''),
      'aria-label': `${d.toLocaleDateString('de-DE', { weekday: 'long' })}: ${done ? 'erledigt' : 'offen'}`,
    }, [h('span', {}, d.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '')), h('i', {}, done ? icon('check') : null)]));
  }

  // Signatur: die Figur des Tages zeigt nacheinander die Übungen des Workouts
  const heroStage = h('div', { class: 'hero-stage' });
  const heroCaption = h('p', { class: 'hero-caption' });
  let k = 0;
  const showFig = () => {
    const e = BY_ID[daily.items[k % daily.items.length].id];
    const fig = createFigure(e.anim, { aspect: 1.6, arrows: false, animate: !reduceMotion.matches });
    fig.svg.classList.add('fade-in');
    heroStage.replaceChildren(fig.svg);
    heroCaption.replaceChildren(h('span', {}, `${(k % daily.items.length) + 1}/${daily.items.length}`), e.name);
    k++;
  };
  showFig();
  if (!reduceMotion.matches) {
    const timer = setInterval(showFig, 5200);
    cleanupView = () => clearInterval(timer);
  }

  let minutes = s.lastMinutes;
  let focus = s.lastFocus;
  const focusList = h('div', { class: 'focus-grid', role: 'radiogroup', 'aria-label': 'Fokus' });
  const drawFocus = () => focusList.replaceChildren(...Object.entries(FOCI).map(([key, f]) => h('button', {
    class: `focus-card f-${key}` + (key === focus ? ' on' : ''),
    role: 'radio',
    'aria-checked': String(key === focus),
    onclick: () => { focus = key; store.setSetting('lastFocus', key); drawFocus(); },
  }, [
    h('span', { class: `focus-ico cat-${key}` }, icon(CAT_ICON[key])),
    h('span', { class: 'focus-txt' }, [h('b', {}, f.label), h('small', {}, f.desc)]),
    h('span', { class: 'focus-check', 'aria-hidden': 'true' }, key === focus ? icon('check') : null),
  ])));
  drawFocus();

  view.append(
    h('header', { class: 'large-title home-head' }, [
      h('div', {}, [h('p', { class: 'overline' }, fmtDate(today)), h('h1', {}, greet())]),
      h('div', { class: 'streak' + (streak ? ' hot' : ''), 'aria-label': `Serie: ${streak} Tage` }, [icon('flame'), h('b', {}, String(streak))]),
    ]),
    h('div', { class: 'week' }, week),

    h('section', { class: 'hero' }, [
      heroStage,
      h('div', { class: 'hero-body' }, [
        heroCaption,
        h('div', { class: 'hero-head' }, [
          h('div', {}, [h('p', { class: 'overline accent' }, 'Workout des Tages'), h('h2', {}, daily.title)]),
          doneToday ? h('span', { class: 'badge ok' }, [icon('check'), 'Erledigt']) : null,
        ]),
        h('p', { class: 'secondary' }, `${daily.items.length} Übungen · ${estimateText(daily)}`),
        h('button', { class: 'btn primary big', onclick: () => { currentWorkout = daily; go('preview'); } }, [icon('play'), doneToday ? 'Nochmal machen' : 'Starten']),
      ]),
    ]),

    h('section', { class: 'section' }, [
      h('h2', { class: 'section-title' }, 'Eigenes Workout'),
      h('p', { class: 'field-label' }, 'Zeit'),
      segmented(DURATIONS, minutes, 'Dauer in Minuten', (v) => { minutes = v; store.setSetting('lastMinutes', v); }, (v) => `${v} Min`),
      h('p', { class: 'field-label' }, 'Fokus'),
      focusList,
      h('button', {
        class: 'btn tinted big',
        onclick: () => { currentWorkout = generate({ minutes, focus }); go('preview'); },
      }, [icon('shuffle'), 'Workout erstellen']),
    ]),
  );
}

// ---------- Vorschau ----------
function previewView() {
  const w = currentWorkout;
  if (!w) { go(''); return; }
  const list = h('div', { class: 'group-body' });
  const sub = h('p', { class: 'secondary' });

  const draw = () => {
    sub.textContent = `${w.items.length} Übungen · ${estimateText(w)}`;
    list.replaceChildren(...w.items.map((it, i) => {
      const e = BY_ID[it.id];
      return h('div', { class: 'row ex-row' }, [
        h('button', { class: 'ex-main', onclick: () => openDetail(e) }, [
          stage(e, 'stage sm', { label: false }),
          h('span', { class: 'ex-txt' }, [
            h('b', {}, e.name),
            h('span', { class: 'meta' }, [catLabel(e.cat), formatAmountItem(e, it)]),
          ]),
        ]),
        w.single ? null : h('button', {
          class: 'icon-btn plain', 'aria-label': `${e.name} austauschen`,
          onclick: () => { if (swapItem(w, i)) draw(); else toast('Keine Alternative verfügbar'); },
        }, icon('swap')),
      ]);
    }));
  };
  draw();

  const title = w.title || (w.single ? 'Einzelübung' : `${w.minutes} Min · ${FOCI[w.focus]?.label || ''}`);
  view.append(
    navBar(title, () => (history.length > 1 ? history.back() : go(''))),
    sub,
    h('section', { class: 'group' }, list),
    h('div', { class: 'action-bar' }, [
      (w.daily || w.single) ? null : h('button', {
        class: 'btn tinted', onclick: () => { currentWorkout = generate({ minutes: w.minutes, focus: w.focus }); previewView.redraw(); },
      }, [icon('shuffle'), 'Neu mischen']),
      h('button', { class: 'btn primary grow', onclick: () => start(w) }, [icon('play'), 'Start']),
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
  const fav = h('button', { class: 'btn toggle' });
  const hid = h('button', { class: 'btn toggle' });
  const paint = () => {
    const f = store.isFav(e.id), x = store.isHidden(e.id);
    fav.className = 'btn toggle' + (f ? ' on fav' : '');
    fav.setAttribute('aria-pressed', String(f));
    fav.replaceChildren(icon('heart'), f ? 'Favorit' : 'Favorisieren');
    hid.className = 'btn toggle' + (x ? ' on hid' : '');
    hid.setAttribute('aria-pressed', String(x));
    hid.replaceChildren(icon(x ? 'eyeoff' : 'eye'), x ? 'Ausgeblendet' : 'Ausblenden');
  };
  fav.onclick = () => { store.toggleFav(e.id); paint(); };
  hid.onclick = () => { store.toggleHidden(e.id); paint(); };
  paint();

  const figBox = h('div', { class: 'detail-stage' });
  figBox.append(createFigure(e.anim, { aspect: 1.4, animate: !reduceMotion.matches }).svg);
  const s = sheet(h('div', { class: 'detail' }, [
    figBox,
    h('h2', { class: 'detail-title' }, e.name),
    h('div', { class: 'chips' }, [
      ...e.cats.map((c) => h('span', { class: 'chip' }, catLabel(c))),
      ...e.areas.map((a) => h('span', { class: 'chip' }, AREAS[a])),
      e.wall ? h('span', { class: 'chip' }, [icon('wall'), 'Wand']) : null,
    ]),
    h('p', { class: 'amount' }, [icon('clock'), formatAmount(e)]),
    h('h3', { class: 'sub-title' }, 'So geht’s'),
    h('ol', { class: 'steps' }, e.steps.map((t) => h('li', {}, t))),
    h('p', { class: 'tip' }, [icon('bulb'), h('span', {}, e.tip)]),
    h('div', { class: 'detail-actions' }, [fav, hid]),
    h('button', { class: 'btn primary big', onclick: () => { s.close(); currentWorkout = singleWorkout(e.id); start(currentWorkout); } }, [icon('play'), 'Jetzt üben']),
  ]), { onClose: () => { if (location.hash.startsWith('#/library')) drawLibrary?.(); } });
}

// ---------- Bibliothek ----------
let drawLibrary = null;
function libraryView() {
  const grid = h('div', { class: 'lib-grid' });
  const count = h('p', { class: 'tertiary small' });
  const search = h('input', { type: 'search', placeholder: 'Suchen', value: libFilter.q, 'aria-label': 'Übung suchen', enterkeyhint: 'search' });
  search.addEventListener('input', () => { libFilter.q = search.value; draw(); });

  const chipRow = (opts, key, label) => {
    const row = h('div', { class: 'chip-row', role: 'group', 'aria-label': label });
    const paint = () => row.replaceChildren(...opts.map(([v, content]) => h('button', {
      class: 'filter' + (libFilter[key] === v ? ' on' : ''),
      'aria-pressed': String(libFilter[key] === v),
      onclick: () => { libFilter[key] = v; paint(); draw(); },
    }, content)));
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
    count.textContent = list.length === 1 ? '1 Übung' : `${list.length} Übungen`;
    grid.replaceChildren(...list.map((e) => h('button', {
      class: 'lib-card' + (store.isHidden(e.id) ? ' hidden-ex' : ''),
      onclick: () => openDetail(e),
    }, [
      stage(e, 'stage', { label: false }),
      store.isFav(e.id) ? h('span', { class: 'badge-ico fav', 'aria-label': 'Favorit' }, icon('heart')) : null,
      store.isHidden(e.id) ? h('span', { class: 'badge-ico', 'aria-label': 'Ausgeblendet' }, icon('eyeoff')) : null,
      h('b', {}, e.name),
      h('span', { class: 'meta' }, [catLabel(e.cat)]),
      h('span', { class: 'tertiary small' }, formatAmount(e)),
    ])));
    if (!list.length) grid.append(h('p', { class: 'empty' }, libFilter.list === 'fav' ? 'Noch keine Favoriten. Tippe bei einer Übung auf „Favorisieren“, dann kommt sie öfter dran.' : libFilter.list === 'hidden' ? 'Keine ausgeblendeten Übungen.' : 'Keine Übung gefunden. Probier einen anderen Suchbegriff oder Filter.'));
  };
  drawLibrary = draw;

  view.append(
    largeTitle('Übungen'),
    h('label', { class: 'searchbar' }, [icon('search'), search]),
    chipRow([['all', 'Alle'], ...Object.keys(CATS).map((k) => [k, catLabel(k)])], 'cat', 'Kategorie'),
    chipRow([['all', 'Alle Bereiche'], ...Object.entries(AREAS)], 'area', 'Körperbereich'),
    chipRow([['all', 'Alle'], ['fav', [icon('heart'), 'Favoriten']], ['hidden', [icon('eyeoff'), 'Ausgeblendet']]], 'list', 'Liste'),
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
      const key = dateKey(new Date(y, m, d));
      const isDone = done.has(key);
      cells.push(h('span', {
        class: 'cal-d' + (isDone ? ' done' : '') + (key === todayKey ? ' today' : ''),
        'aria-label': `${d}.${isDone ? ' erledigt' : ''}`,
      }, String(d)));
    }
    cal.replaceChildren(
      h('div', { class: 'cal-nav' }, [
        h('button', { class: 'icon-btn plain', 'aria-label': 'Voriger Monat', onclick: () => { calMonth = new Date(y, m - 1, 1); drawCal(); } }, icon('back')),
        h('b', {}, first.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })),
        h('button', { class: 'icon-btn plain', 'aria-label': 'Nächster Monat', onclick: () => { calMonth = new Date(y, m + 1, 1); drawCal(); } }, icon('chevron')),
      ]),
      h('div', { class: 'cal-grid' }, cells),
    );
  };
  drawCal();

  const recent = store.state.history.slice(-15).reverse();
  const stat = (value, label, hot) => h('div', { class: 'stat' + (hot ? ' hot' : '') }, [h('b', {}, value), h('span', {}, label)]);
  view.append(
    largeTitle('Verlauf'),
    h('div', { class: 'stats' }, [
      stat([icon('flame'), String(store.streak())], 'Aktuelle Serie', true),
      stat(String(store.bestStreak()), 'Beste Serie'),
      stat(String(t.workouts), 'Workouts'),
      stat(String(t.minutes), 'Minuten'),
    ]),
    h('section', { class: 'card' }, cal),
    recent.length
      ? group('Letzte Workouts', recent.map((r) => h('div', { class: 'row' }, [
        h('span', { class: `row-ico cat-${r.focus}` }, icon(CAT_ICON[r.focus] || 'sparkle')),
        h('div', { class: 'row-txt' }, [
          h('b', {}, r.daily ? 'Workout des Tages' : FOCI[r.focus]?.label || 'Workout'),
          h('span', { class: 'secondary small' }, new Date(r.ts).toLocaleString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })),
        ]),
        h('span', { class: 'secondary small nowrap' }, `${Math.max(1, Math.round((r.seconds || 0) / 60))} Min · ${r.ex?.length || 0} Üb.`),
      ])))
      : h('p', { class: 'empty' }, 'Noch keine Workouts. Dein erstes wartet auf der Startseite.'),
  );
}

// ---------- Einstellungen ----------
function voiceRow() {
  const select = h('select', { class: 'select', 'aria-label': 'Stimme' });
  const fill = () => {
    const vs = germanVoices();
    const auto = currentVoice();
    const label = (v) => `${v.name.replace(/^Microsoft |\s*-\s*German.*$|\s*\(.*?\)/g, '')}${genderOf(v) === 'male' ? ' ♂' : genderOf(v) === 'female' ? ' ♀' : ''}`;
    select.replaceChildren(
      h('option', { value: '' }, `Automatisch${auto && !store.settings.voiceName ? ` (${label(auto)})` : ''}`),
      ...vs.map((v) => h('option', { value: v.name, selected: v.name === store.settings.voiceName }, label(v))),
    );
    if (!vs.length) select.append(h('option', { disabled: true }, 'Keine deutsche Stimme gefunden'));
  };
  fill();
  speechSynthesis.addEventListener?.('voiceschanged', fill);
  select.addEventListener('change', () => {
    store.setSetting('voiceName', select.value);
    unlockAudio();
    speak('Hallo! So klinge ich als deine Trainingsstimme.');
  });
  return h('label', { class: 'row' }, [h('div', { class: 'row-txt' }, [h('span', {}, 'Stimme'), h('span', { class: 'secondary small' }, '♂ = männlich')]), select]);
}

let installEvent = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; });

function settingsView() {
  const s = store.settings;
  const toggle = (key, label, desc) => h('label', { class: 'row' }, [
    h('div', { class: 'row-txt' }, [h('span', {}, label), desc ? h('span', { class: 'secondary small' }, desc) : null]),
    h('input', { type: 'checkbox', role: 'switch', class: 'switch', checked: !!s[key], onchange: (ev) => store.setSetting(key, ev.target.checked) }),
  ]);
  const choice = (key, label, values, unit) => h('div', { class: 'row col' }, [
    h('span', {}, label),
    segmented(values, s[key], label, (v) => store.setSetting(key, v), (v) => `${v} ${unit}`),
  ]);
  const action = (label, onclick, cls = '') => h('button', { class: 'row row-action ' + cls, onclick }, label);

  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

  view.append(
    largeTitle('Einstellungen'),
    group('Während des Workouts', [
      toggle('sound', 'Töne', 'Sanfte Klänge bei Start, Countdown und Ende'),
      toggle('vibrate', 'Vibration', 'Beim Übungswechsel (nur Android)'),
      action('Töne anhören', () => previewSounds()),
      voiceAvailable() ? toggle('voice', 'Sprachansage', 'Sagt die nächste Übung an') : null,
      voiceAvailable() ? voiceRow() : null,
      voiceAvailable() ? action('Ansage testen', () => { unlockAudio(); speak('Als Nächstes: Taube. Vierzig Sekunden pro Seite. Atme ruhig in die Dehnung.'); }) : null,
    ], 'Welche Stimmen es gibt, hängt vom Gerät ab. Auf dem iPhone klingen „Erweitert“- oder „Premium“-Stimmen am natürlichsten: Einstellungen › Bedienungshilfen › Gesprochene Inhalte › Stimmen › Deutsch, z. B. „Markus“ oder „Yannick“ laden.'),
    group('Workouts', [
      toggle('wall', 'Übungen mit Wand', 'z. B. Wall Sit oder Couch Stretch'),
      choice('rest', 'Vorbereitung zwischen Übungen', [5, 10, 15, 20], 's'),
      choice('dailyMinutes', 'Länge des Workouts des Tages', [3, 5, 10, 15], 'Min'),
    ]),
    standalone ? null : group('App installieren', [
      installEvent
        ? action('Auf dem Startbildschirm installieren', async () => { installEvent.prompt(); installEvent = null; })
        : h('div', { class: 'row' }, h('span', { class: 'secondary' }, ios
          ? 'In Safari auf „Teilen“ tippen und „Zum Home-Bildschirm“ wählen.'
          : 'Im Browser-Menü (⋮) „App installieren“ wählen.')),
    ], 'Als App startet MoveDaily im Vollbild und funktioniert auch offline.'),
    group('Daten', [
      action('Favoriten und Ausgeblendete zurücksetzen', async () => {
        if (await confirmDialog('Listen zurücksetzen?', 'Alle Favoriten und ausgeblendeten Übungen werden entfernt.', 'Zurücksetzen', 'Abbrechen', { destructive: true })) { store.resetLists(); render(); toast('Listen zurückgesetzt'); }
      }),
      action('Alle Daten löschen', async () => {
        if (await confirmDialog('Alle Daten löschen?', 'Verlauf, Serie, Favoriten und Einstellungen werden endgültig gelöscht.', 'Löschen', 'Abbrechen', { destructive: true })) { store.resetAll(); render(); toast('Alle Daten gelöscht'); }
      }, 'destructive'),
    ], `${store.state.favorites.length} Favoriten, ${store.state.hidden.length} ausgeblendet. Alles bleibt nur auf diesem Gerät gespeichert.`),
    h('p', { class: 'foot' }, 'Die Übungen ersetzen keine ärztliche oder physiotherapeutische Beratung. Bei Schmerzen abbrechen. · Version 1.2'),
  );
}

// ---------- Start ----------
render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
