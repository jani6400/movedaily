// Entwicklungs-Helfer: rendert eine Übungsfigur und schickt das Bild an einen lokalen Speicher-Server.
// Nutzung in der Browser-Konsole: const s = await import('/tools/snap.js'); await s.save('name', 'squat', { yaw: 70 });
import { createFigure, setFigureGender } from '../js/figure3d.js';
import { BY_ID } from '../js/exercises.js';

export async function snap(id, opts = {}) {
  setFigureGender(opts.g || 'm');
  const e = opts.anim ? { anim: opts.anim } : BY_ID[id];
  const holder = document.createElement('div');
  holder.style.cssText = `position:fixed;left:0;top:0;width:${opts.w || 380}px;height:${opts.h || 560}px;background:#F3F6FA;z-index:9`;
  document.body.append(holder);
  const f = createFigure(e.anim, { animate: false, frame: opts.frame ?? (e.anim.frames.length - 1), yaw: opts.yaw, pitch: opts.pitch });
  f.svg.style.cssText = 'width:100%;height:100%';
  f.svg.firstChild.style.cssText = 'width:100%;height:100%;display:block';
  holder.append(f.svg);
  await new Promise((r) => setTimeout(r, 300));
  f.tick(performance.now());
  const c = f.svg.querySelector('canvas');
  const out = document.createElement('canvas');
  out.width = c.width; out.height = c.height;
  const x = out.getContext('2d');
  x.fillStyle = '#F3F6FA';
  x.fillRect(0, 0, out.width, out.height);
  x.drawImage(c, 0, 0);
  holder.remove();
  return out.toDataURL('image/jpeg', 0.85);
}

export async function save(name, id, opts) {
  const d = await snap(id, opts);
  const r = await fetch('http://127.0.0.1:5174/save?name=' + name, { method: 'POST', body: d });
  return r.status;
}
