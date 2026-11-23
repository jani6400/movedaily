// Figuren-Engine: 2D-Gelenkfigur mit Vorwärtskinematik und Keyframe-Animation.
//
// Winkel-Konvention (Grad, Bildschirmkoordinaten):
//   0 = nach unten, 90 = nach rechts (vorne), 180 = nach oben, -90 = nach links (hinten)
// Jeder Segmentwert ist entweder ein Winkel oder [winkel, skalierung] (Skalierung < 1
// = perspektivische Verkürzung, z. B. wenn ein Bein zur Kamera zeigt).

export const LEN = { torso: 50, neck: 6, head: 9, ua: 26, fa: 24, th: 38, sh: 36, ft: 11 };

const RAD = Math.PI / 180;
const dir = (a) => [Math.sin(a * RAD), Math.cos(a * RAD)];

export const SEGS = ['torso', 'neck', 'uaN', 'faN', 'uaF', 'faF', 'thN', 'shN', 'ftN', 'thF', 'shF', 'ftF'];

export const DEFAULTS = {
  torso: 180, neck: 180,
  uaN: 0, faN: 0, uaF: 0, faF: 0,
  thN: 0, shN: 0, ftN: 90, thF: 0, shF: 0, ftF: 90,
  curve: 0, hipOff: [0, 0], shOff: [0, 0],
};

const seg = (v) => (Array.isArray(v) ? { a: v[0], s: v[1] } : { a: v, s: 1 });

export function normalizePose(p) {
  const q = { ...DEFAULTS, ...p };
  const out = { curve: q.curve, hipOff: [...q.hipOff], shOff: [...q.shOff] };
  for (const k of SEGS) out[k] = seg(q[k]);
  return out;
}

const lerp = (a, b, t) => a + (b - a) * t;
// kürzester Weg zwischen zwei Winkeln
function lerpAngle(a, b, t) {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return a + d * t;
}

export function lerpPose(A, B, t) {
  const o = {
    curve: lerp(A.curve, B.curve, t),
    hipOff: [lerp(A.hipOff[0], B.hipOff[0], t), lerp(A.hipOff[1], B.hipOff[1], t)],
    shOff: [lerp(A.shOff[0], B.shOff[0], t), lerp(A.shOff[1], B.shOff[1], t)],
  };
  for (const k of SEGS) o[k] = { a: lerpAngle(A[k].a, B[k].a, t), s: lerp(A[k].s, B[k].s, t) };
  return o;
}

const add = (p, a, l) => {
  const d = dir(a);
  return [p[0] + d[0] * l, p[1] + d[1] * l];
};

// Vorwärtskinematik: liefert alle Gelenkpunkte relativ zur Hüfte (0,0)
export function fk(P) {
  const hip = [0, 0];
  const hipN = [P.hipOff[0], P.hipOff[1]];
  const hipF = [-P.hipOff[0], -P.hipOff[1]];
  const sc = add(hip, P.torso.a, LEN.torso * P.torso.s);
  const soN = [sc[0] + P.shOff[0], sc[1] + P.shOff[1]];
  const soF = [sc[0] - P.shOff[0], sc[1] - P.shOff[1]];
  const head = add(sc, P.neck.a, (LEN.neck + LEN.head) * P.neck.s);
  const mid = [(hip[0] + sc[0]) / 2, (hip[1] + sc[1]) / 2];
  const td = dir(P.torso.a);
  const perp = [-td[1], td[0]];
  const ctrl = [mid[0] + perp[0] * P.curve * 2, mid[1] + perp[1] * P.curve * 2];
  const spine = [mid[0] + perp[0] * P.curve, mid[1] + perp[1] * P.curve];
  const elN = add(soN, P.uaN.a, LEN.ua * P.uaN.s);
  const wrN = add(elN, P.faN.a, LEN.fa * P.faN.s);
  const elF = add(soF, P.uaF.a, LEN.ua * P.uaF.s);
  const wrF = add(elF, P.faF.a, LEN.fa * P.faF.s);
  const knN = add(hipN, P.thN.a, LEN.th * P.thN.s);
  const anN = add(knN, P.shN.a, LEN.sh * P.shN.s);
  const toN = add(anN, P.ftN.a, LEN.ft * P.ftN.s);
  const knF = add(hipF, P.thF.a, LEN.th * P.thF.s);
  const anF = add(knF, P.shF.a, LEN.sh * P.shF.s);
  const toF = add(anF, P.ftF.a, LEN.ft * P.ftF.s);
  return { hip, hipN, hipF, sc, soN, soF, head, ctrl, spine, elN, wrN, elF, wrF, knN, anN, toN, knF, anF, toF };
}

const BODY_KEYS = ['hipN', 'hipF', 'sc', 'soN', 'soF', 'spine', 'elN', 'wrN', 'elF', 'wrF', 'knN', 'anN', 'toN', 'knF', 'anF', 'toF'];
const STROKE = 4.5;

function groundY(pts) {
  let m = pts.head[1] + LEN.head;
  for (const k of BODY_KEYS) m = Math.max(m, pts[k][1] + STROKE);
  return m;
}

// Figur in die Szene setzen: Boden bei y=0, Anker-Gelenk bei x=0
function place(P, anim) {
  const pts = fk(P);
  const a = pts[anim.anchor || 'hip'];
  const dx = -a[0];
  const dy = anim.view === 'top' ? -a[1] : -groundY(pts);
  for (const k in pts) pts[k] = [pts[k][0] + dx, pts[k][1] + dy];
  return pts;
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ---------- Vorbereitung einer Animation ----------
const prepCache = new WeakMap();

function prepare(anim) {
  if (prepCache.has(anim)) return prepCache.get(anim);
  const frames = anim.frames.map(normalizePose);
  const n = frames.length;
  let seq;
  if (n === 1) seq = [0];
  else if (anim.loop === 'cycle') seq = frames.map((_, i) => i);
  else {
    seq = frames.map((_, i) => i);
    for (let i = n - 2; i > 0; i--) seq.push(i);
  }
  const T = anim.dur || 1300;
  const holds = anim.holds || frames.map(() => anim.hold ?? 450);

  // Bounding-Box über alle Zwischenposen
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const grow = (pts) => {
    for (const k of BODY_KEYS.concat(['hip'])) {
      minX = Math.min(minX, pts[k][0] - STROKE); maxX = Math.max(maxX, pts[k][0] + STROKE);
      minY = Math.min(minY, pts[k][1] - STROKE); maxY = Math.max(maxY, pts[k][1] + STROKE);
    }
    const h = pts.head;
    minX = Math.min(minX, h[0] - LEN.head); maxX = Math.max(maxX, h[0] + LEN.head);
    minY = Math.min(minY, h[1] - LEN.head); maxY = Math.max(maxY, h[1] + LEN.head);
  };
  for (let i = 0; i < seq.length; i++) {
    const A = frames[seq[i]], B = frames[seq[(i + 1) % seq.length]];
    for (let s = 0; s <= 10; s++) grow(place(lerpPose(A, B, s / 10), anim));
  }
  const body = { minX, maxX, minY, maxY };
  const prep = { frames, seq, T, holds, body };
  prepCache.set(anim, prep);
  return prep;
}

function viewBox(anim, body, aspect) {
  const pad = 12;
  let x0 = body.minX - pad, x1 = body.maxX + pad;
  let y0 = body.minY - pad, y1 = anim.view === 'top' ? body.maxY + pad : 10;
  if (anim.wall === 'left') x0 = body.minX - 14;
  if (anim.wall === 'right') x1 = body.maxX + 14;
  let w = x1 - x0, h = y1 - y0;
  if (w / h < aspect) {
    const nw = h * aspect; x0 -= (nw - w) / 2; w = nw;
  } else {
    const nh = w / aspect; y0 -= (nh - h) * (anim.view === 'top' ? 0.5 : 1); h = nh;
  }
  return { x0, y0, w, h };
}

const fmt = (n) => Math.round(n * 10) / 10;
const pt = (p) => `${fmt(p[0])} ${fmt(p[1])}`;

let uid = 0;
const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

// ---------- Figur zeichnen ----------
// order 'front': beide Beine vor dem Rumpf (Front-/Rückansicht)
function buildBody(g, order) {
  const b = {};
  const mk = (key, cls) => { b[key] = el('path', { class: cls }, g); };
  mk('farArm', 'limb far');
  if (order !== 'front') mk('farLeg', 'limb far');
  mk('trunkFill', 'trunk-fill');
  mk('torso', 'trunk');
  mk('neck', 'limb near');
  b.head = el('circle', { class: 'head', r: LEN.head }, g);
  if (order === 'front') mk('farLeg', 'limb far');
  mk('nearLeg', 'limb near');
  mk('nearArm', 'limb near');
  return b;
}

function drawBody(b, p) {
  b.farArm.setAttribute('d', `M${pt(p.soF)}L${pt(p.elF)}L${pt(p.wrF)}`);
  b.farLeg.setAttribute('d', `M${pt(p.hipF)}L${pt(p.knF)}L${pt(p.anF)}L${pt(p.toF)}`);
  const wide = Math.hypot(p.hipN[0] - p.hipF[0], p.hipN[1] - p.hipF[1]) + Math.hypot(p.soN[0] - p.soF[0], p.soN[1] - p.soF[1]) > 4;
  b.trunkFill.setAttribute('d', wide ? `M${pt(p.hipF)}L${pt(p.hipN)}L${pt(p.soN)}L${pt(p.soF)}Z` : '');
  b.torso.setAttribute('d', `M${pt(p.hip)}Q${pt(p.ctrl)} ${pt(p.sc)}`);
  b.neck.setAttribute('d', `M${pt(p.sc)}L${pt(p.head)}`);
  b.head.setAttribute('cx', fmt(p.head[0]));
  b.head.setAttribute('cy', fmt(p.head[1]));
  b.nearLeg.setAttribute('d', `M${pt(p.hipN)}L${pt(p.knN)}L${pt(p.anN)}L${pt(p.toN)}`);
  b.nearArm.setAttribute('d', `M${pt(p.soN)}L${pt(p.elN)}L${pt(p.wrN)}`);
}

function arrowPaths(anim, prep) {
  const keys = anim.arrows || [];
  const [i0, i1] = anim.arrowSeg || [0, 1];
  const A = prep.frames[i0], B = prep.frames[i1 % prep.frames.length];
  if (!A || !B || A === B) return [];
  const out = [];
  for (const k of keys) {
    const pts = [];
    for (let s = 0; s <= 16; s++) {
      const t = 0.1 + (s / 16) * 0.8;
      pts.push(place(lerpPose(A, B, t), anim)[k]);
    }
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (len < 8) continue;
    out.push('M' + pts.map(pt).join('L'));
  }
  return out;
}

// Erzeugt ein SVG für eine Übungsanimation.
// opts: { animate: bool, aspect: number, ghost: bool, arrows: bool, frame: index }
export function createFigure(anim, opts = {}) {
  const { animate = true, aspect = 1.35, ghost = !animate, arrows = true } = opts;
  const prep = prepare(anim);
  const vb = viewBox(anim, prep.body, aspect);
  const id = 'f' + (++uid);
  const svg = el('svg', {
    viewBox: `${fmt(vb.x0)} ${fmt(vb.y0)} ${fmt(vb.w)} ${fmt(vb.h)}`,
    class: 'figure' + (anim.view === 'top' ? ' top' : ''),
    role: 'img',
  });
  const defs = el('defs', {}, svg);
  const m = el('marker', { id: id + 'a', viewBox: '0 0 10 10', refX: 6, refY: 5, markerWidth: 4, markerHeight: 4, orient: 'auto-start-reverse' }, defs);
  el('path', { d: 'M0 0L10 5L0 10z', class: 'arrow-head' }, m);
  const rg = el('radialGradient', { id: id + 'g' }, defs);
  el('stop', { offset: '0%', 'stop-color': 'var(--red)', 'stop-opacity': '.75' }, rg);
  el('stop', { offset: '100%', 'stop-color': 'var(--red)', 'stop-opacity': '0' }, rg);

  // Requisiten
  const props = el('g', { class: 'props' }, svg);
  const b = prep.body;
  if (anim.view === 'top') {
    el('rect', { x: fmt(b.minX - 8), y: fmt(b.minY - 8), width: fmt(b.maxX - b.minX + 16), height: fmt(b.maxY - b.minY + 16), rx: 8, class: 'mat-top' }, props);
  } else {
    el('line', { x1: fmt(vb.x0), x2: fmt(vb.x0 + vb.w), y1: 0, y2: 0, class: 'ground' }, props);
    el('rect', { x: fmt(b.minX - 8), y: 0, width: fmt(b.maxX - b.minX + 16), height: 5, rx: 2.5, class: 'mat' }, props);
    if (anim.wall) {
      const x = anim.wall === 'left' ? b.minX - 2 : b.maxX + 2;
      const w = 7;
      el('rect', { x: fmt(anim.wall === 'left' ? x - w : x), y: fmt(vb.y0 - 2), width: w, height: fmt(-vb.y0 + 2), class: 'wall' }, props);
    }
  }
  if (anim.label && opts.label !== false) {
    const fs = vb.w * 0.052;
    const tx = el('text', { x: fmt(anim.wall === 'left' ? vb.x0 + vb.w - fs * 0.6 : vb.x0 + fs * 0.6), y: fmt(vb.y0 + fs * 1.5), 'font-size': fmt(fs), class: 'view-label', 'text-anchor': anim.wall === 'left' ? 'end' : 'start' }, svg);
    tx.textContent = 'Ansicht ' + anim.label;
  }

  if (ghost && prep.frames.length > 1) {
    const gg = el('g', { class: 'ghost' }, svg);
    drawBody(buildBody(gg, anim.order), place(prep.frames[anim.ghostFrame ?? 0], anim));
  }

  if (arrows) {
    const ga = el('g', { class: 'arrows' }, svg);
    for (const d of arrowPaths(anim, prep)) {
      el('path', { d, class: 'arrow', 'marker-end': `url(#${id}a)` }, ga);
    }
  }

  const gGlow = el('g', { class: 'glow' }, svg);
  const glows = (anim.focus || []).map((k) => ({ k, c: el('circle', { r: 15, fill: `url(#${id}g)` }, gGlow) }));

  const gb = el('g', { class: 'body' }, svg);
  const body = buildBody(gb, anim.order);

  const render = (P) => {
    const p = place(P, anim);
    drawBody(body, p);
    for (const g of glows) {
      g.c.setAttribute('cx', fmt(p[g.k][0]));
      g.c.setAttribute('cy', fmt(p[g.k][1]));
    }
  };

  const staticFrame = opts.frame ?? (prep.frames.length > 1 ? (anim.thumb ?? 1) : 0);
  render(prep.frames[Math.min(staticFrame, prep.frames.length - 1)]);

  const fig = {
    svg,
    t0: performance.now(),
    speed: 1,
    update(now) {
      const { frames, seq, T, holds } = prep;
      if (frames.length < 2) return;
      const steps = seq.map((f) => holds[f] + T);
      const period = steps.reduce((a, c) => a + c, 0);
      let t = ((now - fig.t0) * fig.speed) % period;
      let k = 0;
      while (t >= steps[k]) { t -= steps[k]; k++; }
      const h = holds[seq[k]];
      const A = frames[seq[k]];
      if (t < h) render(A);
      else render(lerpPose(A, frames[seq[(k + 1) % seq.length]], ease((t - h) / T)));
    },
    play() { active.add(fig); kick(); return fig; },
    stop() { active.delete(fig); },
  };
  if (animate) fig.play();
  return fig;
}

// ---------- gemeinsame Animationsschleife ----------
const active = new Set();
let raf = 0;
function tick(now) {
  for (const f of active) {
    if (!f.svg.isConnected) { active.delete(f); continue; }
    f.update(now);
  }
  raf = active.size ? requestAnimationFrame(tick) : 0;
}
function kick() {
  if (!raf) raf = requestAnimationFrame(tick);
}

// Spiegelt eine Pose horizontal (links/rechts tauschen)
export function mirror(p) {
  const q = { ...DEFAULTS, ...p };
  const neg = (v) => (Array.isArray(v) ? [-v[0], v[1]] : -v);
  const o = {
    torso: neg(q.torso), neck: neg(q.neck), curve: -q.curve,
    hipOff: [q.hipOff[0], -q.hipOff[1]], shOff: [q.shOff[0], -q.shOff[1]],
  };
  for (const s of ['ua', 'fa', 'th', 'sh', 'ft']) {
    o[s + 'N'] = neg(q[s + 'F']);
    o[s + 'F'] = neg(q[s + 'N']);
  }
  return o;
}
