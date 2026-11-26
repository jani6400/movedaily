// Entwicklungs-Helfer: Referenzpose aus mehreren Blickwinkeln speichern.
// Nutzung: const m = await import('/tools/shots.js'); await m.shots('c', 'm');
import { save } from './snap.js';

export const REF = { frames: [{ torso: 180, neck: 180, uaN: [0, 0.55], faN: [10, 0.6], uaF: [0, 0.55], faF: [-10, 0.6], thN: [2, 0.98], shN: [0, 0.99], ftN: 90, thF: [-2, 0.98], shF: [0, 0.99], ftF: 90 }], target: { p: [{ m: 'chest', side: null }], s: [], j: [] }, anchor: 'hip' };

export async function shots(prefix, g = 'm', views = { front: 90, back: -90, q34: 50, side: 0 }, size = [700, 1100]) {
  const t0 = performance.now();
  // erst ein Bild anstoßen, dann warten, bis das Netz für dieses Geschlecht fertig ist
  const { meshReady } = await import('../js/skin3d.js');
  if (!meshReady(g)) {
    await save('_warm', null, { anim: REF, g, w: 100, h: 160 });
    while (!meshReady(g) && performance.now() - t0 < 60000) await new Promise((r) => setTimeout(r, 250));
  }
  for (const [n, yaw] of Object.entries(views)) await save(`${prefix}_${g}_${n}`, null, { anim: REF, g, yaw, w: size[0], h: size[1] });
  return Math.round(performance.now() - t0);
}
