// Workout-Player: Timer, Ablaufsteuerung, Ansagen.

import { BY_ID, CATS } from './exercises.js';
import { mirror, MUSCLES } from './figure.js';
import { createFigure } from './figure3d.js';
import { store } from './storage.js';
import { workoutSeconds } from './generator.js';
import * as sig from './signals.js';
import { h, icon, confirmDialog, toast, CAT_ICON } from './ui.js';

const RING = 2 * Math.PI * 54;
const SWITCH_SECS = 5;
const BOX = ['Einatmen', 'Halten', 'Ausatmen', 'Halten'];

const mirroredAnims = new Map();
function animFor(e, side) {
  if (side !== 2) return e.anim;
  if (!mirroredAnims.has(e.id)) mirroredAnims.set(e.id, { ...e.anim, frames: e.anim.frames.map(mirror), wall: e.anim.wall === 'left' ? 'right' : e.anim.wall === 'right' ? 'left' : undefined, mirrored: !e.anim.mirrored });
  return mirroredAnims.get(e.id);
}

function buildSteps(w) {
  const steps = [];
  w.items.forEach((it, i) => {
    const e = BY_ID[it.id];
    steps.push({ kind: 'prep', i, dur: i === 0 ? 6 : w.rest });
    const work = (side) => ({ kind: 'work', i, side, dur: e.type === 'time' ? it.dur : null, reps: e.type === 'reps' ? it.reps : null });
    if (e.perSide) {
      steps.push(work(1));
      steps.push({ kind: 'switch', i, dur: SWITCH_SECS });
      steps.push(work(2));
    } else steps.push(work(0));
  });
  return steps;
}

function amountText(e, it, spoken = false) {
  const side = e.perSide ? (spoken ? ' pro Seite' : ' / Seite') : '';
  if (e.type === 'time') return spoken ? `${it.dur} Sekunden${side}` : `${it.dur} Sek.${side}`;
  return spoken ? `${it.reps} Wiederholungen${side}` : `${it.reps}×${side}`;
}

export function startPlayer(workout, { onExit }) {
  const steps = buildSteps(workout);
  const root = h('div', { class: 'player' });
  document.body.appendChild(root);
  document.body.classList.add('playing');
  // Zurück-Taste (Android/Browser) beendet nicht sofort, sondern fragt nach
  history.pushState({ player: true }, '', '#/workout');
  const onPop = () => {
    if (finished) { exit(null); return; }
    history.pushState({ player: true }, '', '#/workout');
    quit();
  };
  window.addEventListener('popstate', onPop);
  sig.keepAwake(true);

  let idx = 0;
  let stepStart = performance.now();
  let pausedAt = null;
  let lastSec = null;
  let halfSaid = false;
  let tenSaid = false;
  let breathPhase = -1;
  let fig = null;
  let figKey = '';
  let timer = 0;
  let raf = 0;
  let finished = false;
  const doneItems = new Set();
  const startedAt = Date.now();

  // ---------- Grundgerüst ----------
  const segs = h('div', { class: 'p-segs' }, workout.items.map(() => h('i')));
  const counter = h('div', { class: 'p-count' });
  const btnClose = h('button', { class: 'icon-btn', 'aria-label': 'Workout beenden', onclick: quit }, icon('close'));
  const phase = h('div', { class: 'p-phase' });
  const figBox = h('div', { class: 'p-figure' });
  const name = h('h2', { class: 'p-name' });
  const meta = h('div', { class: 'p-meta' });
  const ringFg = h('circle', { class: 'ring-fg', cx: 60, cy: 60, r: 54, 'stroke-dasharray': RING.toFixed(1), stroke: 'url(#ringGrad)' }, [], true);
  const ringNum = h('div', { class: 'ring-num' });
  const ringSub = h('div', { class: 'ring-sub' });
  const ring = h('div', { class: 'ring' }, [
    h('svg', { viewBox: '0 0 120 120', 'aria-hidden': 'true' }, [
      h('defs', {}, h('linearGradient', { id: 'ringGrad', x1: '0', y1: '0', x2: '1', y2: '1' }, [
        h('stop', { offset: '0', 'stop-color': '#FF4136' }, [], true),
        h('stop', { offset: '1', 'stop-color': '#FF851B' }, [], true),
      ], true), true),
      h('circle', { class: 'ring-bg', cx: 60, cy: 60, r: 54 }, [], true), ringFg], true),
    h('div', { class: 'ring-txt' }, [ringNum, ringSub]),
  ]);
  const doneBtn = h('button', { class: 'btn primary big p-done', onclick: next }, [icon('check'), 'Fertig']);
  const goBtn = h('button', { class: 'btn tinted p-go', onclick: next }, ['Los geht’s', icon('next')]);
  const breath = h('div', { class: 'p-breath' });
  const stepsList = h('ol', { class: 'p-steps' });
  const tip = h('p', { class: 'p-tip' });
  const howto = h('details', { class: 'p-howto' }, [h('summary', {}, 'Anleitung'), stepsList, tip]);

  const btnPrev = h('button', { class: 'icon-btn lg', 'aria-label': 'Zurück', onclick: prev }, icon('prev'));
  const btnPause = h('button', { class: 'icon-btn xl accent', 'aria-label': 'Pause', onclick: togglePause }, icon('pause'));
  const btnNext = h('button', { class: 'icon-btn lg', 'aria-label': 'Weiter', onclick: next }, icon('next'));
  const btnFav = h('button', { class: 'icon-btn', 'aria-label': 'Favorit', 'aria-pressed': 'false', onclick: fav }, icon('heart'));
  const btnHide = h('button', { class: 'icon-btn', 'aria-label': 'Ausblenden', onclick: hide }, icon('eyeoff'));

  root.append(
    h('header', { class: 'p-top' }, [btnClose, segs, counter]),
    h('main', { class: 'p-main' }, [phase, figBox, name, meta, h('div', { class: 'p-center' }, [ring, breath, doneBtn, goBtn]), howto]),
    h('footer', { class: 'p-controls' }, [btnFav, btnPrev, btnPause, btnNext, btnHide]),
  );

  // ---------- Ablauf ----------
  const cur = () => steps[idx];
  const elapsed = () => ((pausedAt ?? performance.now()) - stepStart) / 1000;

  function enter(i) {
    idx = i;
    stepStart = performance.now();
    if (pausedAt !== null) pausedAt = stepStart;
    lastSec = null;
    halfSaid = false;
    tenSaid = false;
    breathPhase = -1;
    const s = cur();
    const it = workout.items[s.i];
    const e = BY_ID[it.id];

    // Figur
    const key = e.id + ':' + (s.kind === 'work' && s.side === 2 ? 2 : s.kind === 'switch' ? 2 : 1);
    if (key !== figKey) {
      figKey = key;
      fig?.stop();
      figBox.replaceChildren();
      fig = createFigure(animFor(e, key.endsWith(':2') ? 2 : 1), { aspect: 1.45, interactive: true });
      figBox.append(fig.svg);
      if (pausedAt !== null) fig.stop();
    }

    // Texte
    name.textContent = e.name;
    const cat = CATS[e.cat];
    const chips = [h('span', { class: 'chip' }, h('span', { class: `cat cat-${e.cat}` }, [icon(CAT_ICON[e.cat]), cat.label])), h('span', { class: 'chip' }, amountText(e, it))];
    if (s.kind === 'work' && s.side) chips.push(h('span', { class: 'chip side' }, s.side === 1 ? 'Seite 1' : 'Seite 2'));
    const focus = [...new Set((e.target?.p || []).map((x) => MUSCLES[x.m]?.label).filter(Boolean))];
    if (focus.length) chips.push(h('span', { class: 'chip target-chip' }, [h('i', { class: 'swatch p', 'aria-hidden': 'true' }), focus.join(' · ')]));
    meta.replaceChildren(...chips);
    stepsList.replaceChildren(...e.steps.map((t) => h('li', {}, t)));
    tip.replaceChildren(icon('bulb'), h('span', {}, e.tip));
    howto.open = s.kind === 'prep';
    counter.textContent = `${s.i + 1}/${workout.items.length}`;
    [...segs.children].forEach((el, k) => {
      el.className = k < s.i || doneItems.has(k) ? 'done' : k === s.i ? 'cur' : '';
    });
    btnFav.classList.toggle('on', store.isFav(e.id));
    btnFav.setAttribute('aria-pressed', String(store.isFav(e.id)));

    root.dataset.kind = s.kind;
    root.dataset.type = s.dur ? 'time' : 'reps';
    phase.textContent = s.kind === 'prep' ? (s.i === 0 ? 'Gleich geht’s los' : 'Als Nächstes') : s.kind === 'switch' ? 'Seite wechseln' : 'Los!';
    breath.textContent = '';
    breath.hidden = !(s.kind === 'work' && e.breath === 'box');

    // Ansagen
    if (s.kind === 'prep') {
      const say = s.i === 0 ? sig.PHRASES.first : s.i === workout.items.length - 1 ? sig.PHRASES.last : sig.PHRASES.next;
      sig.speak(say(e.name, amountText(e, it, true)));
    } else if (s.kind === 'switch') {
      sig.sideSwitch();
      sig.speak(sig.PHRASES.switch());
      sig.vibrate([80, 60, 80]);
    } else {
      sig.go();
      sig.vibrate(200);
      if (s.reps) sig.speak(s.side === 2 ? `${sig.PHRASES.side2()} ${s.reps} Wiederholungen.` : sig.PHRASES.reps(s.reps));
      else if (s.side === 1) sig.speak(sig.PHRASES.side1());
      else if (s.side === 2) sig.speak(sig.PHRASES.side2());
      else if (e.breath !== 'box') sig.speak(sig.PHRASES.start());
    }
    update();
  }

  function next() {
    if (finished) return;
    const s = cur();
    if (s.kind === 'work') {
      const last = idx + 1 >= steps.length || steps[idx + 1].i !== s.i;
      if (last) doneItems.add(s.i);
    }
    if (idx + 1 >= steps.length) return finish();
    enter(idx + 1);
  }

  function prev() {
    const s = cur();
    // an den Anfang der aktuellen Übung bzw. zur vorherigen
    let target = steps.findIndex((x) => x.i === s.i);
    if (target === idx || (s.kind === 'prep' && elapsed() < 2)) {
      target = steps.findIndex((x) => x.i === Math.max(0, s.i - 1));
    }
    enter(target);
  }

  function togglePause() {
    if (pausedAt === null) {
      pausedAt = performance.now();
      fig?.stop();
      sig.stopSpeaking();
      root.classList.add('paused');
      btnPause.replaceChildren(icon('play'));
    } else {
      stepStart += performance.now() - pausedAt;
      pausedAt = null;
      fig?.play();
      root.classList.remove('paused');
      btnPause.replaceChildren(icon('pause'));
    }
  }

  function fav() {
    const e = BY_ID[workout.items[cur().i].id];
    const on = store.toggleFav(e.id);
    btnFav.classList.toggle('on', on);
    btnFav.setAttribute('aria-pressed', String(on));
    toast(on ? `❤️ ${e.name} kommt jetzt öfter dran` : 'Aus Favoriten entfernt');
  }

  async function hide() {
    const e = BY_ID[workout.items[cur().i].id];
    const wasPaused = pausedAt !== null;
    if (!wasPaused) togglePause();
    const ok = await confirmDialog(`„${e.name}“ ausblenden?`, 'Die Übung wird in künftigen Workouts nicht mehr vorgeschlagen. Du kannst das in der Bibliothek rückgängig machen.', 'Ausblenden', 'Abbrechen', { destructive: true });
    if (ok) {
      if (!store.isHidden(e.id)) store.toggleHidden(e.id);
      toast('Übung ausgeblendet');
      const nextIdx = steps.findIndex((x) => x.i > cur().i);
      if (wasPaused === false) togglePause();
      if (nextIdx < 0) finish(); else enter(nextIdx);
    } else if (!wasPaused) togglePause();
  }

  async function quit() {
    const wasPaused = pausedAt !== null;
    if (!wasPaused) togglePause();
    const ok = await confirmDialog('Workout beenden?', doneItems.size >= Math.ceil(workout.items.length / 2)
      ? 'Du hast schon mehr als die Hälfte geschafft – das zählt für heute!'
      : 'Dein Fortschritt für dieses Workout wird nicht gespeichert.', 'Beenden', 'Weiter trainieren', { destructive: true });
    if (!ok) { if (!wasPaused) togglePause(); return; }
    if (doneItems.size >= Math.ceil(workout.items.length / 2)) finish();
    else close();
  }

  function exit(result) {
    window.removeEventListener('popstate', onPop);
    root.remove();
    onExit?.(result);
  }

  function close() {
    cleanup();
    exit(null);
  }

  function cleanup() {
    clearInterval(timer);
    cancelAnimationFrame(raf);
    fig?.stop();
    sig.keepAwake(false);
    sig.stopSpeaking();
    document.body.classList.remove('playing');
  }

  function finish() {
    if (finished) return;
    finished = true;
    const s = cur();
    if (s?.kind === 'work') doneItems.add(s.i);
    cleanup();
    const seconds = Math.round((Date.now() - startedAt) / 1000);
    const ids = workout.items.filter((_, k) => doneItems.has(k)).map((it) => it.id);
    store.addHistory({ minutes: workout.minutes, seconds, focus: workout.focus, ex: ids, daily: !!workout.daily });
    sig.finish();
    sig.vibrate([100, 80, 100, 80, 250]);
    sig.speak(sig.PHRASES.done());
    showDone(seconds, ids.length);
  }

  function showDone(seconds, count) {
    const streak = store.streak();
    const mins = Math.floor(seconds / 60), secs = seconds % 60;
    root.replaceChildren(h('div', { class: 'p-finish' }, [
      h('div', { class: 'confetti' }, Array.from({ length: 28 }, () => h('i', { style: `--x:${(Math.random() * 100).toFixed(1)}%;--d:${(Math.random() * 1.4).toFixed(2)}s;--r:${Math.round(Math.random() * 360)}deg` }))),
      h('div', { class: 'finish-badge' }, icon('check')),
      h('h1', {}, 'Geschafft!'),
      h('p', { class: 'secondary' }, 'Stark, dass du heute drangeblieben bist.'),
      h('div', { class: 'stats' }, [
        h('div', { class: 'stat' }, [h('b', {}, `${mins}:${String(secs).padStart(2, '0')}`), h('span', {}, 'Dauer')]),
        h('div', { class: 'stat' }, [h('b', {}, String(count)), h('span', {}, 'Übungen')]),
        h('div', { class: 'stat hot' }, [h('b', {}, [icon('flame'), String(streak)]), h('span', {}, streak === 1 ? 'Tag Serie' : 'Tage Serie')]),
      ]),
      h('button', { class: 'btn primary big', onclick: () => exit({ seconds, count }) }, 'Zurück zur Übersicht'),
    ]));
  }

  // ---------- Zeitschleife ----------
  function update() {
    if (finished) return;
    const s = cur();
    const t = elapsed();
    const e = BY_ID[workout.items[s.i].id];

    if (s.dur) {
      const left = Math.max(0, s.dur - t);
      const sec = Math.ceil(left);
      ringFg.style.strokeDashoffset = (RING * (1 - left / s.dur)).toFixed(1);
      ringNum.textContent = sec;
      ringSub.textContent = s.kind === 'work' ? 'Sekunden' : s.kind === 'switch' ? 'Seitenwechsel' : 'Vorbereitung';
      if (pausedAt === null && sec !== lastSec) {
        if (lastSec !== null && sec <= 3 && sec > 0) sig.tick();
        lastSec = sec;
      }
      if (pausedAt === null && s.kind === 'work' && !tenSaid && s.dur >= 40 && !e.breath && left <= 10.5 && left > 9) {
        tenSaid = true;
        sig.speak(sig.PHRASES.tenLeft(), { interrupt: false });
      }
      if (pausedAt === null && s.kind === 'work' && !halfSaid && s.dur >= 30 && !e.breath && t >= s.dur / 2) {
        halfSaid = true;
        sig.speak(sig.PHRASES.half(), { interrupt: false });
      }
      if (s.kind === 'work' && e.breath === 'box') {
        const ph = Math.floor(t / 4) % 4;
        if (ph !== breathPhase) {
          breathPhase = ph;
          breath.textContent = BOX[ph];
          breath.dataset.phase = ph;
          if (pausedAt === null) sig.speak(BOX[ph]);
        }
      }
      if (left <= 0 && pausedAt === null) {
        if (s.kind === 'work') { sig.workEnd(); sig.vibrate([100, 60, 100]); }
        next();
      }
    } else {
      // Wiederholungen: Zeit läuft hoch
      ringFg.style.strokeDashoffset = '0';
      ringNum.textContent = `${s.reps}×`;
      const m = Math.floor(t / 60), sc = Math.floor(t % 60);
      ringSub.textContent = `${m}:${String(sc).padStart(2, '0')}`;
    }
  }

  function loop() {
    update();
    raf = requestAnimationFrame(loop);
  }
  timer = setInterval(update, 250); // läuft auch weiter, wenn rAF gedrosselt wird
  loop();
  enter(0);

  return { close };
}

export function estimateText(w) {
  const s = workoutSeconds(w);
  const m = Math.round(s / 60);
  return m < 1 ? `${s} Sek.` : `ca. ${m} Min.`;
}
