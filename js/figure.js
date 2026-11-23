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
// Dicke je Gelenk (für Bodenkontakt und Bildausschnitt)
const PR = { hip: 6.5, hipN: 6.5, hipF: 6.5, sc: 6.5, soN: 5.5, soF: 5.5, spine: 6.5, elN: 4, elF: 4, wrN: 4.2, wrF: 4.2, knN: 5, knF: 5, anN: 3.6, anF: 3.6, toN: 2.4, toF: 2.4 };
const STROKE = 4.5;

function groundY(pts) {
  let m = pts.head[1] + LEN.head;
  for (const k of BODY_KEYS) m = Math.max(m, pts[k][1] + PR[k]);
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
      const r = (PR[k] || STROKE) + 1.5;
      minX = Math.min(minX, pts[k][0] - r); maxX = Math.max(maxX, pts[k][0] + r);
      minY = Math.min(minY, pts[k][1] - r); maxY = Math.max(maxY, pts[k][1] + r);
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

// ---------- Figur zeichnen (Line-Art) ----------
// Stil: weiße Körperflächen mit dunkler Kontur, schwarze Haare und Shorts.
// Beanspruchte Muskeln werden als Flächen auf dem Körper hervorgehoben
// (rot = Hauptziel, orange = mitbeteiligt), Gelenke als Ring.
const BODY_R = {
  ua: [4.5, 3.6], fa: [3.4, 2.7], hand: 3.3,
  th: [6.5, 4.5], sh: [4.5, 3.0], foot: [3.0, 1.9],
  neck: 3.0, head: 8.6,
};
const TORSO_PROFILE = [[0, 6.6], [0.3, 5.6], [0.62, 6.9], [0.86, 7.4], [1, 6.3]]; // Halbbreite Hüfte → Schulter

const f1 = (n) => Math.round(n * 10) / 10;
const lerpP = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const poly = (pts) => 'M' + pts.map((q) => `${f1(q[0])} ${f1(q[1])}`).join('L') + 'Z';

function circlePath(c, r) {
  return `M${f1(c[0] - r)} ${f1(c[1])}a${f1(r)} ${f1(r)} 0 1 0 ${f1(2 * r)} 0a${f1(r)} ${f1(r)} 0 1 0 ${f1(-2 * r)} 0Z`;
}

// Kapsel von a nach b mit Radius ra bzw. rb (verjüngt)
function capsule(a, b, ra, rb) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L = Math.hypot(dx, dy);
  if (L < 0.6) return circlePath(a, Math.max(ra, rb));
  const nx = -dy / L, ny = dx / L;
  return `M${f1(a[0] + nx * ra)} ${f1(a[1] + ny * ra)}L${f1(b[0] + nx * rb)} ${f1(b[1] + ny * rb)}` +
    `A${f1(rb)} ${f1(rb)} 0 0 0 ${f1(b[0] - nx * rb)} ${f1(b[1] - ny * rb)}` +
    `L${f1(a[0] - nx * ra)} ${f1(a[1] - ny * ra)}A${f1(ra)} ${f1(ra)} 0 0 0 ${f1(a[0] + nx * ra)} ${f1(a[1] + ny * ra)}Z`;
}

function profileW(t) {
  for (let i = 1; i < TORSO_PROFILE.length; i++) {
    const [t1, w1] = TORSO_PROFILE[i], [t0, w0] = TORSO_PROFILE[i - 1];
    if (t <= t1) return w0 + ((w1 - w0) * (t - t0)) / (t1 - t0);
  }
  return TORSO_PROFILE[TORSO_PROFILE.length - 1][1];
}

// Punkte entlang der Wirbelsäule: Mitte, Vorderseite-Normale, Halbbreite
function spineAt(p, t) {
  const u = 1 - t;
  const P = [u * u * p.hip[0] + 2 * u * t * p.ctrl[0] + t * t * p.sc[0], u * u * p.hip[1] + 2 * u * t * p.ctrl[1] + t * t * p.sc[1]];
  let tx = 2 * u * (p.ctrl[0] - p.hip[0]) + 2 * t * (p.sc[0] - p.ctrl[0]);
  let ty = 2 * u * (p.ctrl[1] - p.hip[1]) + 2 * t * (p.sc[1] - p.ctrl[1]);
  const tl = Math.hypot(tx, ty) || 1;
  tx /= tl; ty /= tl;
  const hw = Math.hypot(p.hipN[0] - p.hip[0], p.hipN[1] - p.hip[1]);
  const sw = Math.hypot(p.soN[0] - p.sc[0], p.soN[1] - p.sc[1]);
  return { P, n: [-ty, tx], w: profileW(t) + hw + (sw - hw) * t };
}

// Rumpfabschnitt t0..t1 zwischen den Seiten-Anteilen o1..o2 (−1 = Rücken, +1 = Bauch)
function torsoBand(p, t0, t1, o1 = -1, o2 = 1, sign = 1) {
  const A = [], B = [];
  for (let i = 0; i <= 8; i++) {
    const { P, n, w } = spineAt(p, t0 + ((t1 - t0) * i) / 8);
    A.push([P[0] + n[0] * w * o2 * sign, P[1] + n[1] * w * o2 * sign]);
    B.push([P[0] + n[0] * w * o1 * sign, P[1] + n[1] * w * o1 * sign]);
  }
  return poly(A.concat(B.reverse()));
}

// Abschnitt einer Gliedmaße (a→b, Radien ra→rb) zwischen den Seiten-Anteilen o1..o2
function limbBand(a, b, ra, rb, t0, t1, o1, o2, sign = 1) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  const nx = (dy / L) * sign, ny = (-dx / L) * sign; // Vorderseite
  const at = (t, o) => {
    const P = lerpP(a, b, t);
    const r = ra + (rb - ra) * t;
    return [P[0] + nx * r * o, P[1] + ny * r * o];
  };
  return poly([at(t0, o1), at(t1, o1), at(t1, o2), at(t0, o2)]);
}

// Muskelgruppen: Segment, Abschnitt [t0, t1], Seite (ant = vorn, post = hinten, mid = Mitte)
export const MUSCLES = {
  quads: { label: 'Oberschenkel vorn', parts: [['th', 0.14, 0.86, 'ant']] },
  hamstrings: { label: 'Oberschenkel hinten', parts: [['th', 0.12, 0.9, 'post']] },
  glutes: { label: 'Po', parts: [['torso', 0, 0.2, 'post'], ['th', 0, 0.3, 'post']] },
  hipflexors: { label: 'Hüftbeuger', parts: [['torso', 0, 0.22, 'ant'], ['th', 0, 0.34, 'ant']] },
  adductors: { label: 'Innenschenkel', parts: [['th', 0.06, 0.66, 'mid']] },
  calves: { label: 'Waden', parts: [['sh', 0.08, 0.6, 'post']] },
  shins: { label: 'Schienbein', parts: [['sh', 0.1, 0.85, 'ant']] },
  abs: { label: 'Bauch', parts: [['torso', 0.22, 0.62, 'ant']] },
  obliques: { label: 'Seitliche Bauchmuskeln', parts: [['torso', 0.18, 0.62, 'mid']] },
  lowerback: { label: 'Unterer Rücken', parts: [['torso', 0.1, 0.48, 'post']] },
  upperback: { label: 'Oberer Rücken', parts: [['torso', 0.52, 0.96, 'post']] },
  chest: { label: 'Brust', parts: [['torso', 0.6, 0.93, 'ant']] },
  shoulders: { label: 'Schultern', parts: [['ua', 0, 0.36, 'mid'], ['torso', 0.9, 1, 'mid']] },
  neck: { label: 'Nacken', parts: [['neck', 0, 1, 'mid']] },
  feet: { label: 'Fußsohlen', parts: [['foot', 0, 1, 'mid']] },
};
export const JOINTS = { hip: 'Hüfte', knee: 'Knie', spine: 'Wirbelsäule', ankle: 'Sprunggelenk', shoulder: 'Schulter' };

const SIDE_O = { ant: [0.16, 0.84], post: [-0.84, -0.16], mid: [-0.55, 0.55], full: [-0.78, 0.78] };

// Highlight-Pfade für eine Körperseite (N/F) bzw. den Rumpf
function regionPaths(p, list, st, owner) {
  let d = '';
  for (const { m, side } of list) {
    const mus = MUSCLES[m];
    if (!mus) continue;
    for (const [seg, t0, t1, where0] of mus.parts) {
      const where = st.sideView ? where0 : (where0 === 'mid' ? 'mid' : 'full');
      const [o1, o2] = SIDE_O[where];
      const sign = st.mirrored ? -1 : 1;
      if (seg === 'torso' || seg === 'neck') {
        if (owner !== seg) continue;
        if (seg === 'torso') d += torsoBand(p, t0, t1, o1, o2, sign);
        else d += capsule(p.sc, p.head, BODY_R.neck * 0.9, BODY_R.neck * 0.9);
        continue;
      }
      if (owner !== 'N' && owner !== 'F') continue;
      if (side && side !== owner) continue;
      const s = owner;
      const r = BODY_R;
      if (seg === 'ua') continue; // Schultern: siehe shoulderPaths
      if (seg === 'th') d += limbBand(p['hip' + s], p['kn' + s], r.th[0], r.th[1], t0, t1, o1, o2, sign);
      else if (seg === 'sh') d += limbBand(p['kn' + s], p['an' + s], r.sh[0], r.sh[1], t0, t1, o1, o2, sign);
      else if (seg === 'ua') d += limbBand(p['so' + s], p['el' + s], r.ua[0], r.ua[1], t0, t1, o1, o2, sign);
      else if (seg === 'foot') {
        const an = p['an' + s], to = p['to' + s];
        if (Math.hypot(to[0] - an[0], to[1] - an[1]) > 1) d += limbBand(an, to, r.foot[0], r.foot[1], 0, 1, -0.85, 0.85, sign);
      }
    }
  }
  return d;
}

function armGeo(p, s) {
  const so = p['so' + s], elb = p['el' + s], wr = p['wr' + s];
  const r = BODY_R;
  const fd = Math.hypot(wr[0] - elb[0], wr[1] - elb[1]) || 1;
  const hand = [wr[0] + ((wr[0] - elb[0]) / fd) * 1.6, wr[1] + ((wr[1] - elb[1]) / fd) * 1.6];
  return { skin: capsule(so, elb, r.ua[0], r.ua[1]) + capsule(elb, wr, r.fa[0], r.fa[1]) + circlePath(hand, r.hand), cloth: '' };
}

function legGeo(p, s) {
  const hip = p['hip' + s], kn = p['kn' + s], an = p['an' + s], to = p['to' + s];
  const r = BODY_R;
  const fl = Math.hypot(to[0] - an[0], to[1] - an[1]);
  let foot;
  if (fl > 1) {
    const ux = (to[0] - an[0]) / fl, uy = (to[1] - an[1]) / fl;
    foot = capsule([an[0] - ux * 2.2, an[1] - uy * 2.2], to, r.foot[0], r.foot[1]);
  } else foot = circlePath(an, r.foot[0]);
  return {
    skin: capsule(hip, kn, r.th[0], r.th[1]) + capsule(kn, an, r.sh[0], r.sh[1]) + foot,
    cloth: capsule(hip, lerpP(hip, kn, 0.34), r.th[0] + 0.4, r.th[0] + 0.1),
  };
}

function headGeo(p, st) {
  const nd = Math.hypot(p.head[0] - p.sc[0], p.head[1] - p.sc[1]) || 1;
  const ux = (p.head[0] - p.sc[0]) / nd, uy = (p.head[1] - p.sc[1]) / nd;
  // Blickrichtung: Halsrichtung um 90° gedreht (gespiegelt bei Seite 2)
  const fx = st.mirrored ? uy : -uy, fy = st.mirrored ? -ux : ux;
  const R = BODY_R.head;
  let skin = capsule(p.sc, p.head, BODY_R.neck, BODY_R.neck) + circlePath(p.head, R);
  let eye = '';
  if (st.nose) {
    skin += circlePath([p.head[0] + fx * (R - 0.3), p.head[1] + fy * (R - 0.3) + 0], 1.9);
    eye = circlePath([p.head[0] + fx * 4.6 + ux * 1.6, p.head[1] + fy * 4.6 + uy * 1.6], 0.95);
  }
  let hair = '';
  if (st.hair === 'back') {
    // Haarkappe am Hinterkopf
    hair = circlePath([p.head[0] - fx * 1.8 + ux * 1.2, p.head[1] - fy * 1.8 + uy * 1.2], R + 0.4);
  } else if (st.hair === 'top') hair = circlePath([p.head[0] + ux * 2.2, p.head[1] + uy * 2.2], R + 0.2);
  return { skin, hair, eye };
}

function figStyle(anim) {
  const side = !anim.label && anim.view !== 'top';
  return {
    order: anim.order,
    sideView: side,
    nose: side,
    hair: anim.view === 'top' ? null : side ? 'back' : 'top',
    mirrored: !!anim.mirrored,
  };
}

// order 'front': beide Beine vor dem Rumpf (Front-/Rückansicht)
function buildBody(g, order) {
  const part = (cls) => {
    const grp = el('g', { class: 'part ' + cls }, g);
    // Kontur zuerst (dicke Linie), Flächen darüber: so bleibt nur die äußere Silhouette sichtbar
    return {
      line: el('path', { class: 'line' }, grp),
      skin: el('path', { class: 'skin' }, grp),
      cloth: el('path', { class: 'cloth' }, grp),
      hl: el('path', { class: 'hl' }, grp),
      hl2: el('path', { class: 'hl2' }, grp),
    };
  };
  const b = {};
  b.farArm = part('far arm');
  if (order !== 'front') b.farLeg = part('far leg');
  b.torso = part('torso');
  b.head = part('head');
  b.head.hair = el('path', { class: 'hair' }, b.head.skin.parentNode);
  b.head.skin.parentNode.insertBefore(b.head.hair, b.head.skin);
  b.head.eye = el('path', { class: 'eye' }, b.head.skin.parentNode);
  if (order === 'front') b.farLeg = part('far leg');
  b.nearLeg = part('near leg');
  b.nearArm = part('near arm');
  return b;
}

function drawBody(b, p, st, target) {
  const prim = target?.p || [], sec = target?.s || [];
  const set = (part, geo, owner) => {
    part.skin.setAttribute('d', geo.skin);
    part.cloth.setAttribute('d', geo.cloth);
    part.hl.setAttribute('d', regionPaths(p, prim, st, owner));
    part.hl2.setAttribute('d', regionPaths(p, sec, st, owner));
    part.line.setAttribute('d', geo.skin + geo.cloth);
  };
  set(b.farArm, armGeo(p, 'F'), 'armF');
  set(b.farLeg, legGeo(p, 'F'), 'F');
  const torso = torsoBand(p, 0, 1);
  set(b.torso, { skin: torso, cloth: torsoBand(p, 0, 0.22, -1.06, 1.06) }, 'torso');
  const hg = headGeo(p, st);
  b.head.hair.setAttribute('d', hg.hair);
  b.head.skin.setAttribute('d', hg.skin);
  b.head.cloth.setAttribute('d', '');
  b.head.hl.setAttribute('d', regionPaths(p, prim, st, 'neck'));
  b.head.hl2.setAttribute('d', regionPaths(p, sec, st, 'neck'));
  b.head.line.setAttribute('d', hg.skin + hg.hair);
  b.head.eye.setAttribute('d', hg.eye);
  set(b.nearLeg, legGeo(p, 'N'), 'N');
  set(b.nearArm, armGeo(p, 'N'), 'armN');
  // Schultern gehören zum Arm: als eigener Besitzer behandeln
  b.nearArm.hl.setAttribute('d', shoulderPaths(p, prim, st, 'N'));
  b.nearArm.hl2.setAttribute('d', shoulderPaths(p, sec, st, 'N'));
  b.farArm.hl.setAttribute('d', shoulderPaths(p, prim, st, 'F'));
  b.farArm.hl2.setAttribute('d', shoulderPaths(p, sec, st, 'F'));
}

function shoulderPaths(p, list, st, s) {
  if (!list.some((x) => x.m === 'shoulders' && (!x.side || x.side === s))) return '';
  const r = BODY_R;
  const [o1, o2] = SIDE_O.mid;
  return limbBand(p['so' + s], p['el' + s], r.ua[0], r.ua[1], 0, 0.36, o1 * 1.3, o2 * 1.3) + circlePath(p['so' + s], 4.2);
}

// Gelenk-Positionen für Ringe
function jointPoints(p, joints) {
  const out = [];
  for (const { m, side } of joints || []) {
    const sides = side ? [side] : ['N', 'F'];
    if (m === 'hip') side ? out.push(p['hip' + side]) : out.push(p.hip);
    else if (m === 'spine') out.push(p.spine);
    else if (m === 'knee') sides.forEach((s) => out.push(p['kn' + s]));
    else if (m === 'ankle') sides.forEach((s) => out.push(p['an' + s]));
    else if (m === 'shoulder') sides.forEach((s) => out.push(p['so' + s]));
  }
  return out;
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

  // Requisiten
  const props = el('g', { class: 'props' }, svg);
  const b = prep.body;
  if (anim.view === 'top') {
    el('rect', { x: fmt(b.minX - 8), y: fmt(b.minY - 8), width: fmt(b.maxX - b.minX + 16), height: fmt(b.maxY - b.minY + 16), rx: 8, class: 'mat-top' }, props);
  } else {
    el('line', { x1: fmt(vb.x0), x2: fmt(vb.x0 + vb.w), y1: 0, y2: 0, class: 'ground' }, props);
    el('rect', { x: fmt(b.minX - 10), y: 0.4, width: fmt(b.maxX - b.minX + 20), height: 4, rx: 2, class: 'mat' }, props);
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
    drawBody(buildBody(gg, anim.order), place(prep.frames[anim.ghostFrame ?? 0], anim), figStyle(anim), null);
  }

  if (arrows) {
    const ga = el('g', { class: 'arrows' }, svg);
    for (const d of arrowPaths(anim, prep)) {
      el('path', { d, class: 'arrow', 'marker-end': `url(#${id}a)` }, ga);
    }
  }

  const gb = el('g', { class: 'body' }, svg);
  const body = buildBody(gb, anim.order);
  const st = figStyle(anim);
  const target = opts.highlight === false ? null : anim.target;
  const gJ = el('g', { class: 'joints' }, svg);
  let rings = [];

  const render = (P) => {
    const p = place(P, anim);
    drawBody(body, p, st, target);
    const jp = target ? jointPoints(p, target.j) : [];
    while (rings.length < jp.length) rings.push(el('circle', { r: 5.2, class: 'joint' }, gJ));
    jp.forEach((q, i) => { rings[i].setAttribute('cx', fmt(q[0])); rings[i].setAttribute('cy', fmt(q[1])); });
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
