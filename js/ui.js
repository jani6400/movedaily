// Kleine UI-Helfer: Elemente bauen, Icons, Dialoge, Toasts, Bottom-Sheets.

const SVG_NS = 'http://www.w3.org/2000/svg';

export function h(tag, attrs = {}, children = [], svg = false) {
  const el = svg ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.setAttribute('class', v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && !svg && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const ICONS = {
  close: 'M18 6 6 18M6 6l12 12',
  check: 'M20 6 9 17l-5-5',
  next: 'M5 4l10 8-10 8z M19 5v14',
  prev: 'M19 20 9 12l10-8z M5 19V5',
  pause: 'M7 4h3v16H7z M14 4h3v16h-3z',
  play: 'M7 4l13 8-13 8z',
  heart: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z',
  eyeoff: 'M9.88 9.88a3 3 0 1 0 4.24 4.24 M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68 M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61 M2 2l20 20',
  eye: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  grid: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
  calendar: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M3 10h18 M8 2v4 M16 2v4',
  sliders: 'M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3 M1 14h6 M9 8h6 M17 16h6',
  shuffle: 'M16 3h5v5 M4 20 21 3 M21 16v5h-5 M15 15l6 6 M4 4l5 5',
  swap: 'M21 12a9 9 0 1 1-3-6.7L21 8 M21 3v5h-5',
  back: 'M15 18l-6-6 6-6',
  chevron: 'M9 18l6-6-6-6',
  info: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M12 16v-4 M12 8h.01',
  search: 'M21 21l-4.3-4.3 M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  clock: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M12 6v6l4 2',
  download: 'M12 3v12 M7 10l5 5 5-5 M5 21h14',
  wall: 'M3 3h18v18H3z M3 9h18 M3 15h18 M9 3v6 M15 9v6 M9 15v6',
};

export function icon(name) {
  const span = document.createElement('span');
  span.className = 'ico ico-' + name;
  span.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name] || ''}"/></svg>`;
  return span;
}

let toastTimer = 0;
export function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = h('div', { class: 'toast', role: 'status' }); document.body.append(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

export function confirmDialog(title, text, okLabel = 'OK', cancelLabel = 'Abbrechen') {
  return new Promise((resolve) => {
    const done = (v) => { wrap.classList.remove('open'); setTimeout(() => wrap.remove(), 200); resolve(v); };
    const wrap = h('div', { class: 'modal-wrap', onclick: (e) => { if (e.target === wrap) done(false); } }, [
      h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, [
        h('h3', {}, title),
        h('p', { class: 'muted' }, text),
        h('div', { class: 'modal-actions' }, [
          h('button', { class: 'btn ghost', onclick: () => done(false) }, cancelLabel),
          h('button', { class: 'btn primary', onclick: () => done(true) }, okLabel),
        ]),
      ]),
    ]);
    document.body.append(wrap);
    requestAnimationFrame(() => wrap.classList.add('open'));
  });
}

export function sheet(content, { onClose } = {}) {
  const close = () => {
    wrap.classList.remove('open');
    setTimeout(() => { wrap.remove(); onClose?.(); }, 250);
    window.removeEventListener('popstate', close);
  };
  const wrap = h('div', { class: 'sheet-wrap', onclick: (e) => { if (e.target === wrap) close(); } }, [
    h('div', { class: 'sheet' }, [
      h('div', { class: 'sheet-handle' }),
      h('button', { class: 'icon-btn sheet-close', 'aria-label': 'Schließen', onclick: close }, icon('close')),
      content,
    ]),
  ]);
  document.body.append(wrap);
  requestAnimationFrame(() => wrap.classList.add('open'));
  window.addEventListener('popstate', close);
  return { close };
}
