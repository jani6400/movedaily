// Menschliches Körpermodell aus Muskelbäuchen.
// Alle Körperteile und Muskeln sind „Round Cones“ (sich verjüngende Kapseln), die weich miteinander
// verschmelzen (Signed Distance Field mit Smooth-Union). meshgen.js macht daraus einmalig ein
// Dreiecksnetz mit natürlichen Muskelrillen, skin3d.js bewegt es über ein Skelett.

const MAT = { skin: 0, cloth: 1, hair: 2, eye: 3, hl: 4, hl2: 5 };

// ---------- Vektorhilfen ----------
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const at = (fr, t, da = 0, dl = 0) => add(add(lerp(fr.a, fr.b, t), mul(fr.an, da)), mul(fr.lat, dl));
const D2R = Math.PI / 180;

// ---------- Körper aus Muskelbäuchen (athletischer Mann / sportliche Frau, Maße ≈ cm) ----------
// Der Rumpf ist ein Stapel elliptischer Querschnitte. Muskeln werden über surf()/limbP() auf die
// Oberfläche gelegt: p = wie weit der Muskel über die Grundform hinausragt, r = Dicke des Muskelbauchs.
export function buildPrims(model, target, gender, opts = {}) {
  const { J, F } = model;
  const female = gender === 'f';
  const prims = [];
  const groups = [];
  let gs = 0;
  const group = () => { if (prims.length > gs) groups.push([gs, prims.length]); gs = prims.length; };
  // BONE: Knochen, an dem die Form hängt (für das animierte Netz)
  let BONE = 'torso';
  let CH = false; // true: Fortsetzung der vorigen Form (Kette, ohne Wulst an der Naht)
  const C = (a, b, r1, r2, mat, k = 2) => {
    const tag = typeof mat === 'object' && mat !== null ? mat : { mat, mus: null, side: null };
    prims.push({ a, b, r1, r2, mat: tag.mat, k, bone: BONE, mus: tag.mus, side: tag.side, chain: CH });
    CH = false;
  };
  // Muskel: liefert Material (inkl. Markierung) und merkt sich, welcher Muskel es ist
  const hl = (m, side, fallback) => {
    const hit = (list) => (list || []).some((x) => x.m === m && (!x.side || !side || x.side === side));
    let mat = fallback;
    if (hit(target?.p)) mat = MAT.hl;
    else if (hit(target?.s)) mat = MAT.hl2;
    return { mat, mus: m, side: side || null };
  };
  const SK = MAT.skin, CL = MAT.cloth;
  const Mf = female ? 0.8 : 1; // Muskelvolumen

  // ---------- Rumpf ----------
  const T = F.torso;
  const sp = (t) => { const u = 1 - t; return [0, 1, 2].map((i) => u * u * J.hip[i] + 2 * u * t * J.ctrl[i] + t * t * J.sc[i]); };
  const Tat = (t, da = 0, dl = 0) => add(add(sp(t), mul(T.an, da)), mul(T.lat, dl));
  // Querschnitte [t, L (halbe Länge der Mittellinie), R (Radius ≈ halbe Tiefe), Tiefenversatz]
  const PROF = female
    ? [[0.0, 6.4, 10.4, -0.9], [0.16, 4.6, 9.4, -0.3], [0.32, 3.2, 8.7, 0.3], [0.48, 3.6, 9.3, 0.3], [0.7, 3.9, 9.8, 0.2], [0.92, 5.4, 7.4, -1.2]]
    : [[0.0, 5.0, 10.6, -0.9], [0.16, 3.0, 10.0, -0.3], [0.32, 2.4, 9.7, 0.4], [0.48, 4.0, 11.0, 0.4], [0.7, 5.0, 12.2, 0.3], [0.92, 6.4, 9.0, -1.4]];
  const prof = (t) => {
    const P = PROF;
    if (t <= P[0][0]) return P[0].slice(1);
    for (let i = 1; i < P.length; i++) {
      if (t <= P[i][0]) {
        const f = (t - P[i - 1][0]) / (P[i][0] - P[i - 1][0]);
        return [1, 2, 3].map((j) => P[i - 1][j] + (P[i][j] - P[i - 1][j]) * f);
      }
    }
    return P[P.length - 1].slice(1);
  };
  // Punkt auf der Rumpfoberfläche: Winkel th (0 = vorne Mitte, 90 = Seite s, 180 = hinten), off = Abstand nach außen
  const surf = (t, th, s, off = 0) => {
    const [L, R, c] = prof(t);
    const dl = Math.sin(th * D2R), da = Math.cos(th * D2R);
    let k;
    if (Math.abs(da) > 1e-4 && Math.abs((R / Math.abs(da)) * dl) <= L) k = R / Math.abs(da);
    else { // Strahl trifft die runde Seite: |k·d − (L,0)| = R
      const b = -2 * L * Math.abs(dl), cc = L * L - R * R;
      k = (-b + Math.sqrt(b * b - 4 * cc)) / 2;
    }
    const x = k * Math.abs(dl), y = k * da;
    const cx = Math.min(L, x);
    const nl = x - cx, na = y;
    const nn = Math.hypot(nl, na) || 1;
    return Tat(t, c + y + (na / nn) * off, s * (x + (nl / nn) * off));
  };
  // Punkt auf der Vorder- (front = 1) oder Rückfläche (−1) bei seitlichem Abstand x (cm)
  const surfX = (t, x, front, off = 0) => {
    const [L, R, c] = prof(t);
    const ax = Math.abs(x);
    let y = R, nl = 0, na = 1;
    if (ax > L) { const e = Math.min(R, ax - L); y = Math.sqrt(R * R - e * e); nl = Math.sign(x) * e / R; na = y / R; }
    return Tat(t, c + front * (y + na * off), x + nl * off);
  };
  const TS = (t, th, s, p, r) => surf(t, th, s, p - r);
  const TX = (t, x, front, p, r) => surfX(t, x, front, p - r);

  let PS = 1, KS = 1.5; // Überstand- und Weichheitsfaktor (Gliedmaßen: flacher, weicher)
  const spindle = (Pf, A, B, p, r, rE, mat, k = 1.1, f = 0.45, pA = -0.3, pB = -0.3) => {
    const span = 0.16; // Länge des Muskelbauchs (Anteil der Strecke)
    const f1 = Math.max(0.05, f - span), f2 = Math.min(0.95, f + span);
    const P = (ff) => [A[0] + (B[0] - A[0]) * ff, A[1] + (B[1] - A[1]) * ff];
    const [ta, va] = P(f1), [tb, vb] = P(f2);
    const m1 = Pf(ta, va, p * 0.9 * PS, r * 0.95), m2 = Pf(tb, vb, p * 0.9 * PS, r * 0.95);
    const kk = k * KS;
    C(Pf(A[0], A[1], pA, rE), m1, rE, r * 0.95, mat, kk);
    CH = true; C(m1, m2, r * 0.95, r * 0.95, mat, kk);
    CH = true; C(m2, Pf(B[0], B[1], pB, rE), r * 0.95, rE, mat, kk);
  };


  // Gliedmaße mit Grundprofil [t, Radius, Versatz nach vorne]: liefert Oberflächenpunkte und baut die Grundform
  const limbP = (fr, PR, sc = 1) => {
    const pr = (t) => {
      const tt = Math.max(PR[0][0], Math.min(PR[PR.length - 1][0], t));
      for (let i = 1; i < PR.length; i++) {
        if (tt <= PR[i][0]) {
          const f = (tt - PR[i - 1][0]) / (PR[i][0] - PR[i - 1][0]);
          return [(PR[i - 1][1] + (PR[i][1] - PR[i - 1][1]) * f) * sc, PR[i - 1][2] + (PR[i][2] - PR[i - 1][2]) * f];
        }
      }
      return [PR[PR.length - 1][1] * sc, PR[PR.length - 1][2]];
    };
    const Pf = (t, ang, p, r) => {
      const [R0, d0] = pr(t);
      const rr = R0 + p - r;
      return at(fr, t, d0 + Math.cos(ang * D2R) * rr, Math.sin(ang * D2R) * rr);
    };
    Pf.base = (mat, k) => {
      for (let i = 1; i < PR.length; i++) {
        const [t0, r0, d0] = PR[i - 1], [t1, r1, d1] = PR[i];
        CH = i > 1;
        C(at(fr, t0, d0), at(fr, t1, d1), r0 * sc, r1 * sc, mat, k);
      }
    };
    return Pf;
  };

  // Grundform
  for (const s of [-1, 1]) {
    for (let i = 1; i < PROF.length; i++) {
      const [t0, L0, R0, c0] = PROF[i - 1], [t1, L1, R1, c1] = PROF[i];
      CH = i > 1;
      C(Tat(t0, c0, s * L0), Tat(t1, c1, s * L1), R0, R1, i === 1 ? CL : SK, 4.0);
    }
  }
  { const [L, R, c] = prof(0.165); C(Tat(0.165, c, -L), Tat(0.165, c, L), R + 0.7, R + 0.7, CL, 0.6); } // Hosenbund
  const shW = female ? 10.6 : 12.8;
  C(Tat(0.96, -1.6, -shW), Tat(0.96, -1.6, shW), female ? 4.6 : 5.4, female ? 4.6 : 5.4, SK, 3.5); // Schultergürtel

  // Bauch: drei Reihen Sixpack + unterer Bauch
  const absM = hl('abs', null, SK);
  const abR = 2.2 * Mf, abP = female ? 0.7 : 1.3;
  for (const s of [-1, 1]) {
    C(TX(0.2, s * 2.7, 1, abP * 0.7, 2.2 * Mf), TX(0.29, s * 2.6, 1, abP * 0.8, 2.2 * Mf), 2.2 * Mf, 2.2 * Mf, absM, 0.5);
    for (const [t, w] of [[0.355, 1], [0.455, 1], [0.552, 0.9]]) {
      C(TX(t, s * 2.3, 1, abP, abR * w), TX(t, s * 3.3, 1, abP, abR * w), abR * w, abR * w, absM, 1.0);
    }
    // schräge Bauchmuskeln + Sägemuskel
    const ob = hl('obliques', null, SK);
    const Ts = (t, th, p, r) => TS(t, th, s, p, r);
    spindle(Ts, [0.15, 76], [0.52, 68], 1.1 * Mf, 3.4, 1.6, ob, 1.4, 0.4);
    spindle(Ts, [0.17, 98], [0.54, 92], 1.0 * Mf, 3.4, 1.6, ob, 1.6, 0.4);
    for (let i = 0; i < 3; i++) { // Sägemuskel: schräge Zacken
      const t = 0.55 + 0.055 * i;
      C(TS(t + 0.04, 92, s, 0.2, 1.6), TS(t - 0.015, 70, s, 0.5 * Mf, 1.5), 1.6, 1.5, ob, 1.0);
    }
  }
  // Brust
  for (const s of [-1, 1]) {
    if (female) {
      C(TS(0.67, 18, s, 1.0, 4.2), TS(0.69, 22, s, 2.4, 3.6), 4.2, 3.6, hl('chest', null, CL), 1.4);
    } else {
      const ch = hl('chest', null, SK);
      C(TS(0.625, 9, s, 2.8, 3.6), TS(0.79, 58, s, 2.4, 3.2), 3.6, 3.2, ch, 0.6); // unterer Rand
      C(TS(0.715, 7, s, 3.0, 4.0), TS(0.835, 61, s, 2.4, 3.4), 4.0, 3.4, ch, 1.2);
      C(TS(0.815, 8, s, 2.3, 3.4), TS(0.88, 58, s, 1.9, 3.0), 3.4, 3.0, ch, 1.4); // Schlüsselbeinanteil
    }
  }
  if (female) { // Sport-Top: Band um den Brustkorb und Stoff über der Brust
    const [L, R, c] = prof(0.69);
    C(Tat(0.69, c + 0.8, -L), Tat(0.69, c + 0.8, L), R + 1.2, R + 1.2, CL, 0.8);
    C(TS(0.685, 22, -1, 2.8, 4.0), TS(0.685, 22, 1, 2.8, 4.0), 4.0, 4.0, hl('chest', null, CL), 1.8);
  }
  // Rücken
  const ub = hl('upperback', null, SK);
  for (const s of [-1, 1]) {
    const Ts = (t, th, p, r) => TS(t, th, s, p, r);
    spindle(Ts, [0.24, 155], [0.84, 102], 3.0 * Mf, 5.0, 2.4, ub, 1.8, 0.7, -0.3, 1.8); // breiter Rückenmuskel
    spindle(Ts, [0.38, 132], [0.87, 112], 2.4 * Mf, 4.4, 2.2, ub, 1.8, 0.66, -0.3, 1.5);
    spindle(Ts, [0.72, 165], [0.88, 122], 1.2 * Mf, 3.6, 2.0, ub, 1.4, 0.45); // Untergrätenmuskel / großer Rundmuskel
    C(Tat(1.03, -2.2, s * 1.8), Tat(0.97, -1.6, s * (shW - 1.4)), female ? 3.4 : 4.4, female ? 2.4 : 2.9, ub, 1.6); // Kapuzenmuskel oben
    const Tb = (tt, x, p, r) => TX(tt, s * x, -1, p, r);
    spindle(Tb, [0.54, 1.2], [0.86, 7.0], 0.8 * Mf, 2.6, 1.4, ub, 1.2, 0.6); // Kapuzenmuskel unten
    spindle(Tb, [0.72, 1.8], [0.99, 4.0], 0.7 * Mf, 3.0, 1.6, ub, 1.2, 0.5); // Kapuzenmuskel Mitte
    spindle((t, x, p, r) => TX(t, s * x, -1, p, r), [-0.02, 3.6], [0.68, 2.8], 1.5 * Mf, 2.5, 1.3, hl('lowerback', null, SK), 1.2, 0.3); // Rückenstrecker
    C(TS(-0.03, 150, s, 2.4, 6.4), TS(0.1, 145, s, 2.0, 5.8), 6.4, 5.8, hl('glutes', null, CL), 1.4); // Gesäß
    C(Tat(0.99, prof(0.92)[1] * 0.5, s * 1.6), Tat(1.0, 2.0, s * (shW + 1.2)), 1.2, 1.1, SK, 0.9); // Schlüsselbein
  }
  for (const s of ['N', 'F']) {
    const m = hl('hipflexors', s, opts.mesh ? SK : null);
    if (m.mat === null) continue;
    const th = F['th' + s];
    C(at(th, 0.0, 5.4, 0), at(th, 0.26, 6.0, 0), 2.8, 2.4, m, 1.2); // Hüftbeuger
  }
  group();

  // ---------- Hals & Kopf ----------
  BONE = 'head';
  const N = F.neck;
  const H = J.head;
  const Hat = (du, da, dl) => add(add(add(H, mul(N.u, du)), mul(N.an, da)), mul(N.lat, dl));
  const neckM = hl('neck', null, SK);
  const hs = female ? 0.94 : 1;
  C(Tat(0.97, -0.8, 0), Hat(-4.6, -0.6, 0), female ? 4.6 : 6.0, female ? 4.1 : 5.2, neckM, 2.6); // Hals
  for (const s of [-1, 1]) C(Hat(-3.0, -1.0, s * 4.0 * hs), Tat(1.0, 3.6, s * 1.2), 1.6, 1.8, neckM, 1.2); // Kopfwender
  C(Hat(-0.4, -0.6, 0), Hat(2.4, -1.0, 0), 7.4 * hs, 7.8 * hs, SK, 1.8); // Schädel
  C(Hat(1.2, 3.0, 0), Hat(-3.6, 3.8, 0), 5.5 * hs, 3.6 * hs, SK, 2.4); // Gesicht
  for (const s of [-1, 1]) {
    C(Hat(0.0, 5.0, s * 3.4 * hs), Hat(0.2, 4.4, s * 5.0 * hs), 1.4, 1.2, SK, 1.2); // Wangenknochen
    C(Hat(-2.0, 0.6, s * 5.0 * hs), Hat(-5.6, 4.6, s * 1.6), female ? 1.6 : 2.0, 1.5, SK, 1.6); // Kiefer
    C(Hat(0.8, -0.6, s * 7.2 * hs), Hat(-1.9, -0.4, s * 7.2 * hs), 1.4, 1.1, SK, 0.6); // Ohren
    C(Hat(1.2, 5.9, s * 2.6), Hat(1.2, 5.95, s * 2.6), 0.6, 0.6, MAT.eye, 0.3); // Augen
  }
  C(Hat(-5.8, 5.0, 0), Hat(-5.6, 5.3, 0), female ? 1.6 : 2.0, 1.8, SK, 1.2); // Kinn
  C(Hat(1.2, 6.9, 0), Hat(-1.2, 7.9, 0), 0.75, 1.05, SK, 0.7); // Nase
  C(Hat(2.4, 6.8, -3.2), Hat(2.4, 6.8, 3.2), 1.0, 1.0, SK, 1.0); // Augenbrauenbogen
  C(Hat(0.8, -2.0, 0), Hat(3.4, -0.2, 0), 7.8 * hs, 8.1 * hs, MAT.hair, 0.4); // Haare
  if (female) {
    C(Hat(1.2, -7.6, 0), Hat(1.0, -8.0, 0), 2.6, 2.6, MAT.hair, 0.8);
    C(Hat(1.0, -8.0, 0), Hat(-5.5, -9.8, 0), 2.5, 1.3, MAT.hair, 0.9); // Pferdeschwanz
  }
  group();

  // ---------- Arme ----------
  PS = 0.7; KS = 2.0;
  for (const s of ['F', 'N']) {
    const Ua = F['ua' + s], Fa = F['fa' + s];
    const sgn = s === 'N' ? 1 : -1;
    BONE = 'ua' + s;
    const U = limbP(Ua, [[0, 4.9, 0], [0.45, 5.0, 0.3], [1.0, 3.5, 0]], female ? 0.8 : 1);
    const sh = hl('shoulders', s, SK);
    C(Ua.a, at(Ua, 0.04), female ? 4.0 : 4.8, female ? 4.0 : 4.8, SK, 2.4); // Oberarmkopf
    U.base(SK, 2.4); // Oberarm
    // Deltamuskel: drei Köpfe, oben rund über dem Gelenk
    spindle(U, [-0.08, 90], [0.52, 90], 2.5 * Mf, 4.4 * Mf, 1.5, sh, 1.2, 0.3, 1.2, -0.2);
    spindle(U, [-0.07, 38], [0.48, 10], 2.0 * Mf, 3.8 * Mf, 1.4, sh, 1.2, 0.32, 0.8, -0.2);
    spindle(U, [-0.07, 142], [0.48, 170], 2.0 * Mf, 3.8 * Mf, 1.4, sh, 1.2, 0.32, 0.8, -0.2);
    spindle(U, [0.16, 0], [0.94, -5], 2.6 * Mf, 3.3 * Mf, 1.4, SK, 1.1, 0.55); // Bizeps
    spindle(U, [0.42, 80], [0.92, 55], 1.0 * Mf, 2.1 * Mf, 1.2, SK, 1.0, 0.6); // Armbeuger
    spindle(U, [0.06, 200], [0.82, 185], 2.2 * Mf, 3.3 * Mf, 1.4, SK, 1.1, 0.38); // Trizeps (langer Kopf)
    spindle(U, [0.1, 128], [0.68, 160], 2.0 * Mf, 2.9 * Mf, 1.3, SK, 1.1, 0.42); // Trizeps (seitlicher Kopf)
    C(U(0.66, 180, 0.4, 2.2), U(0.94, 180, 0.3, 1.6), 2.2, 1.6, SK, 1.0); // Trizepssehne
    if (!female) C(TS(0.83, 66, sgn, 1.6, 2.8), U(0.2, -25, 0.4, 2.0), 2.8, 2.0, hl('chest', null, SK), 1.4); // Brustmuskel-Ansatz
    C(TS(0.8, 112, sgn, 1.6 * Mf, 2.8), U(0.16, -150, 0.3, 1.8), 2.8 * Mf, 1.8, hl('upperback', null, SK), 1.4); // Latissimus-Ansatz
    BONE = 'fa' + s;
    const Fm = limbP(Fa, [[0, 3.8, 0], [0.22, 4.3, 0.2], [0.75, 2.9, 0], [1.0, 2.4, 0]], female ? 0.82 : 1);
    C(Fm(-0.02, 180, 0.6, 1.5), Fm(0.04, 180, 0.4, 1.3), 1.5, 1.3, SK, 1.0); // Ellbogen
    Fm.base(SK, 2.4); // Unterarm
    spindle(Fm, [-0.12, 75], [0.72, 45], 1.9 * Mf, 3.0 * Mf, 1.2, SK, 1.1, 0.25); // Oberarmspeichenmuskel
    spindle(Fm, [-0.04, -50], [0.78, -25], 1.9 * Mf, 3.1 * Mf, 1.2, SK, 1.1, 0.28); // Beuger
    spindle(Fm, [-0.04, 145], [0.78, 125], 1.5 * Mf, 2.6 * Mf, 1.1, SK, 1.1, 0.28); // Strecker
    C(at(Fa, 0.97, 0, -1.3), at(Fa, 0.97, 0, 1.3), female ? 1.6 : 1.9, female ? 1.6 : 1.9, SK, 1.2); // Handgelenk
    const wr = Fa.b, u = Fa.u, an = Fa.an, lt = Fa.lat;
    const P = (du, da, dl) => add(add(add(wr, mul(u, du)), mul(an, da)), mul(lt, dl));
    const hk = female ? 0.9 : 1;
    for (const q of [-1, 1]) C(P(1.5, 0, q * 1.4 * hk), P(8.4 * hk, -0.3, q * 1.6 * hk), 1.9 * hk, 1.7 * hk, SK, 1.2); // Handfläche
    for (const f of [-2.2, -0.75, 0.75, 2.1]) C(P(8.6 * hk, -0.3, f * hk), P((8.6 + (Math.abs(f) > 2 ? 5.4 : 6.6)) * hk, -1.0, f * 0.95 * hk), 0.9 * hk, 0.72 * hk, SK, 0.5); // Finger
    C(P(2.0, 1.6, 1.5 * hk), P(6.6 * hk, 3.2, 2.4 * hk), 1.25 * hk, 0.95 * hk, SK, 0.7); // Daumen
    group();
  }

  // ---------- Beine ----------
  for (const s of ['F', 'N']) {
    const Th = F['th' + s], Sh = F['sh' + s], Ft = F['ft' + s];
    const q = hl('quads', s, SK), hm = hl('hamstrings', s, SK);
    BONE = 'th' + s;
    const Q = limbP(Th, [[0, 8.2, 0], [0.3, 8.4, 0.5], [0.8, 5.8, 0.4], [1.0, 4.9, 0]], 1);
    Q.base(SK, 3.0); // Oberschenkel
    spindle(Q, [0.04, 5], [0.94, 0], 2.0 * Mf, 3.8 * Mf, 1.6, q, 1.2, 0.45); // gerader Schenkelmuskel
    spindle(Q, [0.08, 82], [0.9, 55], 2.2 * Mf, 4.6 * Mf, 1.8, q, 1.2, 0.45); // äußerer Schenkelmuskel
    spindle(Q, [0.46, -38], [0.97, -62], 2.0 * Mf, 3.4 * Mf, 1.4, q, 1.1, 0.72); // innerer Schenkelmuskel (Tropfen)
    spindle(Q, [-0.02, -95], [0.64, -80], 1.6 * Mf, 4.2 * Mf, 1.6, hl('adductors', s, SK), 1.4, 0.3, 0.6); // Adduktoren
    spindle(Q, [0.06, 150], [0.96, 145], 1.8 * Mf, 3.6 * Mf, 1.4, hm, 1.2, 0.45); // Beinbeuger außen
    spindle(Q, [0.06, -152], [0.96, -145], 1.8 * Mf, 3.6 * Mf, 1.4, hm, 1.2, 0.45); // Beinbeuger innen
    spindle(Q, [-0.06, 100], [0.28, 90], 1.0, 2.6, 1.4, SK, 1.2, 0.4, 0.4); // Schenkelbindenspanner
    C(at(Th, -0.04), at(Th, 0.34, 0.4), female ? 9.7 : 10.2, female ? 9.5 : 9.9, CL, 0.7); // Hosenbein
    BONE = 'sh' + s;
    const S = limbP(Sh, [[0, 4.3, -0.2], [0.28, 5.4, -1.5], [0.72, 3.1, -0.5], [1.0, 2.5, 0]], female ? 0.92 : 1);
    C(at(Sh, 0.0, 0, -2.0), at(Sh, 0.0, 0, 2.0), female ? 3.0 : 3.3, female ? 3.0 : 3.3, SK, 2.4); // Kniegelenk
    C(S(-0.03, 0, 1.3, 1.9), S(0.04, 0, 1.0, 1.6), 1.9, 1.6, SK, 1.0); // Kniescheibe
    S.base(SK, 3.0); // Unterschenkel
    spindle(S, [0.04, 35], [0.82, 15], 1.0 * Mf, 2.2 * Mf, 1.1, hl('shins', s, SK), 1.0, 0.35); // Schienbeinmuskel
    const cv = hl('calves', s, SK);
    spindle(S, [0.0, -140], [0.62, -170], 3.0 * Mf, 4.0 * Mf, 1.5, cv, 1.2, 0.35, 0.4); // Wade innen
    spindle(S, [0.0, 140], [0.54, 170], 2.4 * Mf, 3.6 * Mf, 1.4, cv, 1.2, 0.33, 0.4); // Wade außen
    spindle(S, [0.24, -110], [0.86, -150], 1.3 * Mf, 2.6 * Mf, 1.2, cv, 1.2, 0.5); // Schollenmuskel innen
    spindle(S, [0.24, 110], [0.86, 150], 1.2 * Mf, 2.4 * Mf, 1.2, cv, 1.2, 0.5); // Schollenmuskel außen
    spindle(S, [0.1, 95], [0.78, 110], 0.6, 1.5, 0.9, SK, 0.9, 0.4); // Wadenbeinmuskel
    C(S(0.72, 180, 0.3, 1.0), S(1.0, 180, 0.5, 1.1), 1.0, 1.1, SK, 0.8); // Achillessehne
    C(at(Sh, 0.97, 0, -1.9), at(Sh, 0.98, 0, -1.9), 1.3, 1.3, SK, 0.8); // Innenknöchel
    C(at(Sh, 0.99, 0, 1.8), at(Sh, 1.0, 0, 1.8), 1.2, 1.2, SK, 0.8); // Außenknöchel
    // Fuß: Ferse, Mittelfuß (breit), Zehen
    const fm = hl('feet', s, SK);
    BONE = 'ft' + s;
    const an = Sh.b;
    const fd = Ft.L > 1 ? Ft.u : norm(cross(Sh.u, Sh.lat));
    let up = mul(Sh.u, -1);
    up = norm(sub(up, mul(fd, dot(up, fd))));
    const fl = norm(cross(up, fd));
    const fk = female ? 0.92 : 1;
    const fP = (along, upOff, side = 0) => add(add(add(an, mul(fd, along * fk)), mul(up, upOff)), mul(fl, side * fk));
    C(fP(-2.6, -1.6), fP(-2.0, -1.6), 2.6 * fk, 2.6 * fk, fm, 1.2); // Ferse
    for (const q2 of [-1, 1]) C(fP(-1.6, -1.6, q2 * 0.5), fP(10.5, -2.4, q2 * 2.2), 2.3 * fk, 1.8 * fk, fm, 1.6); // Mittelfuß
    C(fP(11.2, -2.6, -2.4), fP(11.2, -2.6, 2.4), 1.6 * fk, 1.6 * fk, fm, 1.2); // Zehengrundgelenke
    C(fP(11.4, -2.7, -1.5), fP(15.6, -2.9, -1.4), 1.5 * fk, 1.3 * fk, fm, 0.9); // große Zehe
    C(fP(11.4, -2.8, 1.0), fP(14.6, -3.0, 1.8), 1.4 * fk, 1.1 * fk, fm, 0.9); // kleine Zehen
    group();
  }
  return { prims, groups };
}
