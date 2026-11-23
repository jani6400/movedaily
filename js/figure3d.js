// 3D-Figur: schattiertes Anatomiemodell aus Muskelkörpern, 360° drehbar.
// Eigener kleiner WebGL-Renderer (keine externen Bibliotheken, funktioniert offline).
// Die Posen kommen aus den bestehenden 2D-Keyframes (figure.js) und werden in 3D übertragen:
// Verkürzte Segmente ([winkel, skalierung]) bekommen die fehlende Tiefe zurück.

import { normalizePose, lerpPose, place, prepare, ease, LEN, createFigure as createFigure2D, setFigureGender as setGender2D } from './figure.js';
import { h } from './ui.js';

// ==================== Mathe ====================
const V = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
};
// Punkt auf Segment a→b bei t, verschoben im lokalen Rahmen
const at = (fr, t, da = 0, dl = 0, du = 0) => V.add(V.add(V.add(V.lerp(fr.a, fr.b, t), V.mul(fr.an, da)), V.mul(fr.lat, dl)), V.mul(fr.u, du));

function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}
function lookAt(eye, target, up) {
  const z = V.norm(V.sub(eye, target));
  const x = V.norm(V.cross(up, z));
  const y = V.cross(z, x);
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -V.dot(x, eye), -V.dot(y, eye), -V.dot(z, eye), 1]);
}

// ==================== WebGL ====================
const VS = `
attribute vec3 aPos;
uniform mat4 uModel, uView, uProj;
uniform mat3 uNormal;
uniform float uMode, uSlope;
uniform vec2 uR0, uR1;
varying vec3 vN; varying vec3 vP;
void main() {
  vec3 pos = aPos;
  vec3 nrm = aPos;
  if (uMode > 0.5) {
    // Röhre: Querschnitt verjüngt sich von uR0 (unten) nach uR1 (oben), elliptisch (lat, an)
    vec2 r = mix(uR0, uR1, aPos.y);
    pos = vec3(aPos.x * r.x, aPos.y, aPos.z * r.y);
    float rm = 0.5 * (r.x + r.y);
    nrm = vec3(aPos.x * rm / r.x, uSlope, aPos.z * rm / r.y);
  }
  vec4 vp = uView * uModel * vec4(pos, 1.0);
  vP = vp.xyz;
  vN = uNormal * nrm;
  gl_Position = uProj * vp;
}`;
const FS = `
precision mediump float;
uniform vec3 uColor; uniform float uAlpha; uniform float uFlat;
varying vec3 vN; varying vec3 vP;
void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(-vP);
  if (dot(n, v) < 0.0) n = -n;
  vec3 L1 = normalize(vec3(-0.45, 0.75, 0.55));
  vec3 L2 = normalize(vec3(0.75, 0.2, 0.3));
  float key = max(dot(n, L1), 0.0);
  float fill = max(dot(n, L2), 0.0);
  float hemi = 0.5 + 0.5 * n.y;
  float spec = pow(max(dot(n, normalize(L1 + v)), 0.0), 30.0);
  float rim = pow(1.0 - max(dot(n, v), 0.0), 2.4);
  vec3 c = uColor * (0.27 + 0.56 * key + 0.17 * fill + 0.12 * hemi) + vec3(0.11) * spec + vec3(0.09) * rim;
  c = mix(c, uColor, uFlat);
  gl_FragColor = vec4(c, uAlpha);
}`;

let G = null; // gemeinsamer Renderer
function initGL() {
  if (G !== null) return G;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 900; canvas.height = 900;
    const gl = canvas.getContext('webgl', { antialias: true, alpha: true, preserveDrawingBuffer: true, premultipliedAlpha: false });
    if (!gl) { G = false; return G; }
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
    gl.useProgram(prog);
    const mesh = (pos, idx) => {
      const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);
      const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
      return { vb, ib, count: idx.length };
    };
    // Einheitskugel
    const LAT = 22, LON = 32;
    let pos = [], idx = [];
    for (let i = 0; i <= LAT; i++) {
      const th = (i / LAT) * Math.PI;
      for (let j = 0; j <= LON; j++) {
        const ph = (j / LON) * Math.PI * 2;
        pos.push(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph));
      }
    }
    for (let i = 0; i < LAT; i++) for (let j = 0; j < LON; j++) {
      const a = i * (LON + 1) + j, b = a + LON + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const sphere = mesh(pos, idx);
    // Einheitsröhre (Radius 1, Höhe 0..1, offen)
    pos = []; idx = [];
    const SEG = 36, ROWS = 4;
    for (let i = 0; i <= ROWS; i++) for (let j = 0; j <= SEG; j++) {
      const ph = (j / SEG) * Math.PI * 2;
      pos.push(Math.cos(ph), i / ROWS, Math.sin(ph));
    }
    for (let i = 0; i < ROWS; i++) for (let j = 0; j < SEG; j++) {
      const a = i * (SEG + 1) + j, b = a + SEG + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const tube = mesh(pos, idx);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    const U = {};
    for (const n of ['uModel', 'uView', 'uProj', 'uNormal', 'uColor', 'uAlpha', 'uFlat', 'uMode', 'uSlope', 'uR0', 'uR1']) U[n] = gl.getUniformLocation(prog, n);
    gl.enable(gl.DEPTH_TEST);
    G = { gl, canvas, U, sphere, tube, aPos, bound: null };
  } catch (e) {
    console.warn('WebGL nicht verfügbar, nutze 2D-Figur', e);
    G = false;
  }
  return G;
}
export const has3D = () => !!initGL();

function bindMesh(g, m) {
  if (g.bound === m) return;
  const { gl } = g;
  gl.bindBuffer(gl.ARRAY_BUFFER, m.vb);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ib);
  gl.vertexAttribPointer(g.aPos, 3, gl.FLOAT, false, 0, 0);
  g.bound = m;
}

// ==================== Körperbau ====================
const C = {
  skin: [0.80, 0.82, 0.85], skinFar: [0.70, 0.73, 0.77],
  cloth: [0.16, 0.18, 0.22], hair: [0.20, 0.17, 0.15],
  hl: [0.91, 0.30, 0.22], hl2: [0.96, 0.58, 0.25],
  mat: [0.77, 0.81, 0.87], eye: [0.12, 0.13, 0.15],
};
let GENDER = 'm';
export function setFigureGender(g) { GENDER = g === 'f' ? 'f' : 'm'; setGender2D(GENDER); }
const B = () => (GENDER === 'f'
  ? { hw: 7.5, sw: 8.6, pelvis: [8, 7.2, 12.4], waist: [11, 6.2, 8.4], rib: [12.5, 7.6, 10.2], delt: 4.3, ua: 3.3, fa: 2.7, th: 5.6, sh: 3.2, neck: 2.8, head: 8.2, arm: 0.86 }
  : { hw: 7, sw: 10, pelvis: [8, 7, 11], waist: [11, 6.6, 9.4], rib: [13, 8.6, 11.6], delt: 5.2, ua: 3.8, fa: 3.1, th: 5.8, sh: 3.4, neck: 3.3, head: 8.6, arm: 1 });

// ==================== Pose → 3D ====================
function viewMode(anim) {
  if (anim.view === 'top') return 'top';
  if (anim.label === 'von hinten') return 'rear';
  if (anim.label) return 'front';
  return 'side';
}

function build3D(P, anim) {
  const p = place(P, anim);
  const mode = viewMode(anim);
  const facing = anim.facing || (mode === 'side' ? 'plane' : mode === 'rear' ? 'away' : 'camera');
  const b = B();
  const sign = anim.mirrored ? -1 : 1;
  const seg = (k) => P[k];
  const segLen = { torso: LEN.torso, neck: LEN.neck + LEN.head, uaN: LEN.ua, uaF: LEN.ua, faN: LEN.fa, faF: LEN.fa, thN: LEN.th, thF: LEN.th, shN: LEN.sh, shF: LEN.sh, ftN: LEN.ft, ftF: LEN.ft };
  const dz = (k) => {
    const s = Math.min(1, Math.abs(seg(k).s));
    const def = facing === 'plane' ? (k.endsWith('F') ? -1 : 1) : 1;
    const sg = anim.depth?.[k] ?? def;
    return Math.sqrt(Math.max(0, 1 - s * s)) * segLen[k] * sg;
  };
  const z = {};
  const plane = facing === 'plane';
  z.hip = 0;
  z.hipN = plane ? b.hw : 0;
  z.hipF = plane ? -b.hw : 0;
  z.sc = z.hip + dz('torso');
  z.spine = (z.hip + z.sc) / 2;
  z.soN = z.sc + (plane ? b.sw : 0);
  z.soF = z.sc - (plane ? b.sw : 0);
  z.head = z.sc + dz('neck');
  for (const s of ['N', 'F']) {
    z['el' + s] = z['so' + s] + dz('ua' + s);
    z['wr' + s] = z['el' + s] + dz('fa' + s);
    z['kn' + s] = z['hip' + s] + dz('th' + s);
    z['an' + s] = z['kn' + s] + dz('sh' + s);
    z['to' + s] = z['an' + s] + dz('ft' + s);
  }
  // Ansicht → Welt (y nach oben)
  const W = mode === 'top' ? (q, d) => [q[0], d, q[1]] : (q, d) => [q[0], -q[1], d];
  const J = {};
  for (const k of ['hip', 'hipN', 'hipF', 'sc', 'soN', 'soF', 'head', 'spine', 'elN', 'wrN', 'elF', 'wrF', 'knN', 'anN', 'toN', 'knF', 'anF', 'toF']) J[k] = W(p[k], z[k]);
  J.ctrl = W(p.ctrl, (z.hip + z.sc) / 2);
  // Vorderseite (Blickrichtung des Körpers)
  const camDir = mode === 'top' ? [0, 1, 0] : facing === 'away' ? [0, 0, -1] : [0, 0, 1];
  const ant2D = (d2) => { // d2: 2D-Richtung im Bild → Vorderseite im Bild
    const a = [d2[1] * sign, -d2[0] * sign];
    return mode === 'top' ? [a[0], 0, a[1]] : [a[0], -a[1], 0];
  };
  const dir2D = (a, b2) => { const dx = p[b2][0] - p[a][0], dy = p[b2][1] - p[a][1]; const l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
  const lateralRef = V.len(V.sub(J.hipN, J.hipF)) > 0.5 ? V.norm(V.sub(J.hipN, J.hipF)) : (plane ? (mode === 'top' ? [0, 1, 0] : [0, 0, 1]) : [1, 0, 0]);
  const frame = (a, b2, k2D, side) => {
    const A = J[a], Bp = J[b2];
    let u = V.sub(Bp, A);
    const L = V.len(u);
    u = L > 1e-3 ? V.mul(u, 1 / L) : [0, 1, 0];
    let an = plane ? ant2D(dir2D(a, b2)) : camDir;
    if (k2D === 'torso' && plane) {
      const d = dir2D('hip', 'sc');
      an = ant2D(d).map((x) => -x); // Rumpf: Vorderseite = andere Drehrichtung als Gliedmaßen
    }
    an = V.sub(an, V.mul(u, V.dot(an, u)));
    if (V.len(an) < 0.15) an = V.cross(u, lateralRef);
    an = V.norm(an);
    let lat = V.norm(V.cross(u, an));
    const ref = side === 'F' ? V.mul(lateralRef, -1) : lateralRef;
    if (V.dot(lat, ref) < 0) lat = V.mul(lat, -1);
    return { a: A, b: Bp, u, an, lat, L };
  };
  const F = {
    torso: frame('hip', 'sc', 'torso', 'N'),
    neck: frame('sc', 'head', 'torso', 'N'),
  };
  for (const s of ['N', 'F']) {
    F['ua' + s] = frame('so' + s, 'el' + s, 'limb', s);
    F['fa' + s] = frame('el' + s, 'wr' + s, 'limb', s);
    F['th' + s] = frame('hip' + s, 'kn' + s, 'limb', s);
    F['sh' + s] = frame('kn' + s, 'an' + s, 'limb', s);
    F['ft' + s] = frame('an' + s, 'to' + s, 'limb', s);
  }
  // Rumpf-Vorderseite für den Kopf übernehmen
  F.neck.an = V.norm(V.sub(F.torso.an, V.mul(F.neck.u, V.dot(F.torso.an, F.neck.u))));
  F.neck.lat = V.norm(V.cross(F.neck.u, F.neck.an));
  if (V.dot(F.neck.lat, lateralRef) < 0) F.neck.lat = V.mul(F.neck.lat, -1);
  return { J, F, mode };
}

// ==================== Modell zusammensetzen ====================
// Formen: 'e' = Ellipsoid (Mitte c, Achsen u/an/lat, Radien [ru, ra, rl]),
//         't' = Röhre von a nach b mit elliptischem Querschnitt r0 → r1 ([lat, an]).
const BUILD = {
  m: {
    torso: [[0, 10.4, 7.4], [0.18, 10.0, 7.0], [0.38, 8.9, 6.4], [0.6, 10.4, 7.4], [0.8, 11.2, 7.8], [0.97, 9.4, 6.2]],
    ua: [4.4, 3.4], fa: [3.4, 2.4], th: [6.7, 4.4], sh: [4.5, 2.6], delt: [5.6, 4.8, 5.4], neck: 3.4, head: 8.6, k: 1,
  },
  f: {
    torso: [[0, 11.6, 7.6], [0.18, 11.0, 7.2], [0.38, 8.1, 5.9], [0.6, 9.0, 6.6], [0.8, 9.4, 6.9], [0.97, 8.2, 5.4]],
    ua: [3.8, 3.0], fa: [3.0, 2.2], th: [7.0, 4.2], sh: [4.3, 2.4], delt: [4.6, 4.0, 4.4], neck: 2.8, head: 8.2, k: 0.85,
  },
};

function partsFor(model, target) {
  const { J, F } = model;
  const b = BUILD[GENDER];
  const female = GENDER === 'f';
  const out = [];
  const hl = (m, side) => {
    const hit = (list) => (list || []).some((x) => x.m === m && (!x.side || !side || x.side === side));
    if (hit(target?.p)) return 'hl';
    if (hit(target?.s)) return 'hl2';
    return null;
  };
  const E = (fr, c, ru, ra, rl, color) => out.push({ t: 'e', c, u: fr.u, an: fr.an, lat: fr.lat, r: [ru, ra, rl], color });
  const orth = (u, an0, latRef) => {
    let an = V.norm(V.sub(an0, V.mul(u, V.dot(an0, u))));
    let lat = V.norm(V.cross(u, an));
    if (latRef && V.dot(lat, latRef) < 0) lat = V.mul(lat, -1);
    return { an, lat };
  };
  // Röhre mit Gelenkkugeln an beiden Enden
  const Tb = (a, bp, r0, r1, color, an0, latRef, caps = true) => {
    const d = V.sub(bp, a);
    const L = V.len(d);
    if (L < 0.5) { E({ u: [0, 1, 0], an: [0, 0, 1], lat: [1, 0, 0] }, a, r0[1], r0[1], r0[0], color); return; }
    const u = V.mul(d, 1 / L);
    const { an, lat } = orth(u, an0, latRef);
    out.push({ t: 't', a, u, L, an, lat, r0, r1, color });
    if (caps) {
      out.push({ t: 'e', c: a, u, an, lat, r: [Math.min(r0[0], r0[1]), r0[1], r0[0]], color });
      out.push({ t: 'e', c: bp, u, an, lat, r: [Math.min(r1[0], r1[1]), r1[1], r1[0]], color });
    }
  };
  const skinOf = (side) => (side === 'F' ? 'skinFar' : 'skin');
  const latRef = V.norm(V.sub(J.hipN, J.hipF));
  const lr = V.len(V.sub(J.hipN, J.hipF)) > 0.5 ? latRef : F.torso.lat;

  // ---------- Rumpf: elliptische Querschnitte entlang der gebogenen Wirbelsäule ----------
  const T = F.torso;
  const sp = (t) => { const u = 1 - t; return [0, 1, 2].map((i) => u * u * J.hip[i] + 2 * u * t * J.ctrl[i] + t * t * J.sc[i]); };
  const sec = b.torso;
  for (let i = 0; i < sec.length - 1; i++) {
    const [t0, l0, a0] = sec[i], [t1, l1, a1] = sec[i + 1];
    let color = 'skin';
    if (t1 <= 0.18 + 1e-6) color = 'cloth'; // Shorts
    if (female && t0 >= 0.6 - 1e-6 && t1 <= 0.8 + 1e-6) color = 'cloth'; // Sport-Top
    Tb(sp(t0), sp(t1), [l0, a0], [l1, a1], color, T.an, lr, false);
  }
  // Abschlüsse: Becken unten (Shorts), Schultern oben
  const Tat = (t, da = 0, dl = 0) => V.add(V.add(sp(t), V.mul(T.an, da)), V.mul(T.lat, dl));
  E(T, Tat(0.01, -0.2), 5.5, sec[0][2], sec[0][1], 'cloth');
  E(T, Tat(0.95), 4.2, sec[5][2] + 0.4, sec[5][1] + 0.4, 'skin');
  // Shorts etwas weiter als die Haut
  Tb(sp(0), sp(0.2), [sec[0][1] + 0.5, sec[0][2] + 0.5], [sec[1][1] + 0.4, sec[1][2] + 0.4], 'cloth', T.an, lr, false);

  // Muskelreliefs am Rumpf
  const waistA = sec[2][2], chestA = sec[4][2], waistL = sec[2][1];
  const absC = hl('abs') || 'skin';
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) E(T, Tat(0.3 + i * 0.1, waistA - 0.9 + i * 0.25, s * 2.1), 2.6, 1.4, 1.95, absC); // Sixpack
  for (const s of [-1, 1]) E(T, Tat(0.36, 0.4, s * (waistL - 2.4)), 9, 3.8, 2.6, hl('obliques') || 'skin'); // seitl. Bauch
  for (const s of [-1, 1]) {
    if (female) E(T, Tat(0.72, chestA - 1.4, s * 3.9), 3.8, 3.3, 3.9, hl('chest') || 'cloth');
    else E(T, Tat(0.8, chestA - 1.7, s * 4.3), 5.4, 2.1, 6.0, hl('chest') || 'skin'); // Brustmuskeln
    E(T, Tat(0.64, -chestA + 3.4, s * 4.6), 11, 3.6, 5.2, hl('upperback') || 'skin'); // Latissimus
    E(T, Tat(0.3, -waistA + 1.6, s * 2.2), 10, 2.3, 2.6, hl('lowerback') || 'skin'); // Rückenstrecker
  }
  E(T, Tat(0.92, -2.6), 5.5, 3.6, 7.6 * b.k, hl('upperback') || 'skin'); // Kapuzenmuskel
  for (const s of [-1, 1]) E(T, Tat(0.05, -sec[0][2] + 2.8, s * 4.6), 6.4, 4.2, 5.4, hl('glutes') || 'cloth'); // Gesäß (in Shorts)
  for (const s of ['N', 'F']) {
    const hs = hl('hipflexors', s);
    if (!hs) continue;
    const th = F['th' + s];
    E(th, at(th, 0.12, 5.4), 6.2, 2.4, 3.4, hs); // Hüftbeuger (nur sichtbar, wenn markiert)
  }

  // ---------- Hals & Kopf ----------
  const N = F.neck;
  Tb(J.sc, at(N, 0.62), [b.neck * 1.15, b.neck * 1.05], [b.neck, b.neck * 0.95], hl('neck') || 'skin', N.an, lr);
  const H = J.head;
  const Hat = (du, da, dl) => V.add(V.add(V.add(H, V.mul(N.u, du)), V.mul(N.an, da)), V.mul(N.lat, dl));
  E(N, Hat(0.6, 0.3, 0), b.head * 1.1, b.head, b.head * 0.9, 'skin'); // Schädel
  E(N, Hat(-3.6, 2.6, 0), 4.2, 4.6, 5.3, 'skin'); // Kiefer
  E(N, Hat(-0.4, b.head - 0.1, 0), 1.7, 1.4, 1.0, 'skin'); // Nase
  for (const s of [-1, 1]) {
    E(N, Hat(-0.2, 0, s * (b.head * 0.9 - 0.4)), 2.4, 1.6, 1.0, 'skin'); // Ohren
    E(N, Hat(1.4, b.head * 0.9, s * 2.8), 0.8, 0.6, 0.8, 'eye'); // Augen
  }
  E(N, Hat(1.9, -1.3, 0), b.head * 1.06, b.head * 0.98, b.head * 0.95, 'hair'); // Haare
  if (female) {
    E(N, Hat(1.2, -b.head * 0.95, 0), 2.6, 2.6, 2.6, 'hair');
    E(N, Hat(-4.5, -b.head * 1.15, 0), 6, 2.4, 2.4, 'hair'); // Pferdeschwanz
  }

  // ---------- Arme ----------
  for (const s of ['F', 'N']) {
    const sk = skinOf(s);
    const Ua = F['ua' + s], Fa = F['fa' + s];
    const ref = s === 'F' ? V.mul(lr, -1) : lr;
    Tb(Ua.a, Ua.b, [b.ua[0], b.ua[0] * 0.95], [b.ua[1], b.ua[1] * 0.95], sk, Ua.an, ref);
    Tb(Fa.a, Fa.b, [b.fa[0] * 1.08, b.fa[0] * 0.92], [b.fa[1] * 1.1, b.fa[1] * 0.8], sk, Fa.an, ref);
    E(Ua, at(Ua, 0.08, 0, 0.6), b.delt[0], b.delt[1], b.delt[2], hl('shoulders', s) || sk); // Deltamuskel
    E(Ua, at(Ua, 0.56, b.ua[0] * 0.55), 7.2 * b.k, 2.4 * b.k, 2.6 * b.k, hl('biceps', s) || sk); // Bizeps
    E(Ua, at(Ua, 0.46, -b.ua[0] * 0.52), 8.2 * b.k, 2.5 * b.k, 2.8 * b.k, sk); // Trizeps
    E(Fa, at(Fa, 0.25, 0.4), 6.5, b.fa[0] * 0.9, b.fa[0] * 1.05, sk); // Unterarmmuskeln
    const wr = Fa.b;
    E(Fa, V.add(wr, V.mul(Fa.u, 3.4)), 3.7, 1.35, 2.7, sk); // Handfläche
    E(Fa, V.add(wr, V.mul(Fa.u, 7.2)), 2.7, 1.1, 2.4, sk); // Finger
    E(Fa, V.add(V.add(wr, V.mul(Fa.u, 3)), V.mul(Fa.an, 2.2)), 2.4, 1.0, 1.0, sk); // Daumen
  }

  // ---------- Beine ----------
  for (const s of ['F', 'N']) {
    const sk = skinOf(s);
    const Th = F['th' + s], Sh = F['sh' + s], Ft = F['ft' + s];
    const ref = s === 'F' ? V.mul(lr, -1) : lr;
    const medial = -1; // lat zeigt nach außen
    Tb(Th.a, Th.b, [b.th[0], b.th[0] * 0.95], [b.th[1], b.th[1] * 0.98], sk, Th.an, ref);
    Tb(Sh.a, Sh.b, [b.sh[0], b.sh[0] * 1.02], [b.sh[1], b.sh[1] * 1.05], sk, Sh.an, ref);
    Tb(Th.a, at(Th, 0.36), [b.th[0] + 0.9, b.th[0] + 0.8], [b.th[0] + 0.4, b.th[0] + 0.3], 'cloth', Th.an, ref, false); // Hosenbein
    E(Th, at(Th, 0.58, 3.4), 12.5, 3.0, 4.4, hl('quads', s) || sk); // Quadrizeps
    E(Th, at(Th, 0.8, 2.2, medial * 2.4), 5.0, 2.6, 2.8, hl('quads', s) || sk); // innerer Oberschenkelmuskel
    E(Th, at(Th, 0.52, -3.3), 12.5, 2.9, 4.2, hl('hamstrings', s) || sk); // Beinbeuger
    E(Th, at(Th, 0.42, 0, medial * 3.6), 10, 3.4, 2.8, hl('adductors', s) || sk); // Adduktoren
    E(Sh, at(Sh, 0.02, 3.0), 2.1, 1.3, 2.1, sk); // Kniescheibe
    const calf = hl('calves', s) || sk;
    E(Sh, at(Sh, 0.3, -2.4, 1.0), 7.0, 2.5, 2.3, calf); // Wade außen
    E(Sh, at(Sh, 0.27, -2.5, -1.1), 7.0, 2.6, 2.4, calf); // Wade innen
    E(Sh, at(Sh, 0.42, 2.5), 10, 1.5, 1.8, hl('shins', s) || sk); // Schienbeinmuskel
    // Fuß
    const an = Sh.b;
    const fd = Ft.L > 1 ? Ft.u : V.norm(V.cross(Sh.u, Sh.lat));
    const fan = V.norm(V.cross(Sh.lat, fd));
    const fFrame = { u: fd, an: fan, lat: V.norm(V.cross(fd, fan)) };
    const foot = hl('feet', s) || sk;
    E(fFrame, V.add(an, V.mul(fd, 4.6)), 7.0, 1.9, 3.0, foot);
    E(fFrame, V.sub(an, V.mul(fd, 0.3)), 2.7, 2.5, 2.5, foot); // Ferse
  }
  return out;
}

function jointMarkers(model, target) {
  const { J } = model;
  const pts = [];
  for (const { m, side } of target?.j || []) {
    const sides = side ? [side] : ['N', 'F'];
    if (m === 'hip') side ? pts.push(J['hip' + side]) : pts.push(J.hip);
    else if (m === 'spine') pts.push(J.spine);
    else if (m === 'knee') sides.forEach((s) => pts.push(J['kn' + s]));
    else if (m === 'ankle') sides.forEach((s) => pts.push(J['an' + s]));
    else if (m === 'shoulder') sides.forEach((s) => pts.push(J['so' + s]));
  }
  return pts;
}

// ==================== Zeichnen ====================
function drawEllipsoid(g, VM, p, rgb, alpha = 1, flat = 0) {
  const { gl, U } = g;
  bindMesh(g, g.sphere);
  const [ru, ra, rl] = p.r;
  // Modell: Spalten = lat·rl, u·ru, an·ra, Mitte
  const M = new Float32Array([
    p.lat[0] * rl, p.lat[1] * rl, p.lat[2] * rl, 0,
    p.u[0] * ru, p.u[1] * ru, p.u[2] * ru, 0,
    p.an[0] * ra, p.an[1] * ra, p.an[2] * ra, 0,
    p.c[0], p.c[1], p.c[2], 1,
  ]);
  setNormal(g, VM, [V.mul(p.lat, 1 / rl), V.mul(p.u, 1 / ru), V.mul(p.an, 1 / ra)]);
  gl.uniformMatrix4fv(U.uModel, false, M);
  gl.uniform1f(U.uMode, 0);
  gl.uniform3fv(U.uColor, rgb);
  gl.uniform1f(U.uAlpha, alpha);
  gl.uniform1f(U.uFlat, flat);
  gl.drawElements(gl.TRIANGLES, g.sphere.count, gl.UNSIGNED_SHORT, 0);
}

function drawTube(g, VM, p, rgb) {
  const { gl, U } = g;
  bindMesh(g, g.tube);
  const M = new Float32Array([
    p.lat[0], p.lat[1], p.lat[2], 0,
    p.u[0] * p.L, p.u[1] * p.L, p.u[2] * p.L, 0,
    p.an[0], p.an[1], p.an[2], 0,
    p.a[0], p.a[1], p.a[2], 1,
  ]);
  setNormal(g, VM, [p.lat, p.u, p.an]);
  gl.uniformMatrix4fv(U.uModel, false, M);
  gl.uniform1f(U.uMode, 1);
  gl.uniform2fv(U.uR0, p.r0);
  gl.uniform2fv(U.uR1, p.r1);
  gl.uniform1f(U.uSlope, ((p.r0[0] + p.r0[1]) - (p.r1[0] + p.r1[1])) / 2 / p.L);
  gl.uniform3fv(U.uColor, rgb);
  gl.uniform1f(U.uAlpha, 1);
  gl.uniform1f(U.uFlat, 0);
  gl.drawElements(gl.TRIANGLES, g.tube.count, gl.UNSIGNED_SHORT, 0);
}

// Normalenmatrix (Sichtraum) = Vrot · [Spalten]
function setNormal(g, VM, cols) {
  const Nm = new Float32Array(9);
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) Nm[c * 3 + r] = VM[r] * cols[c][0] + VM[4 + r] * cols[c][1] + VM[8 + r] * cols[c][2];
  g.gl.uniformMatrix3fv(g.U.uNormal, false, Nm);
}

const FLOOR = { u: [0, 1, 0], an: [0, 0, 1], lat: [1, 0, 0] };

function renderScene(g, view, model, target, w, h) {
  const { gl, U } = g;
  if (g.canvas.width < w || g.canvas.height < h) {
    g.canvas.width = Math.max(g.canvas.width, w);
    g.canvas.height = Math.max(g.canvas.height, h);
  }
  gl.viewport(0, 0, w, h);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const { box } = view;
  const yaw = (view.yaw * Math.PI) / 180, pitch = (view.pitch * Math.PI) / 180;
  const fov = (26 * Math.PI) / 180;
  const aspect = w / h;
  const fit = Math.max(box.r / Math.tan(fov / 2), (box.r / Math.tan(fov / 2)) / Math.min(1, aspect)) * 1.08;
  const eye = [box.c[0] + Math.sin(yaw) * Math.cos(pitch) * fit, box.c[1] + Math.sin(pitch) * fit, box.c[2] + Math.cos(yaw) * Math.cos(pitch) * fit];
  const VM = lookAt(eye, box.c, [0, 1, 0]);
  gl.uniformMatrix4fv(U.uView, false, VM);
  gl.uniformMatrix4fv(U.uProj, false, perspective(fov, aspect, 5, fit * 4));
  // Matte und weicher Schatten
  const fy = box.floor;
  drawEllipsoid(g, VM, { ...FLOOR, c: [box.c[0], fy - 0.8, box.c[2]], r: [0.7, box.mz, box.mx] }, C.mat, 1, 0.55);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(false);
  const hipP = model.J.hip;
  drawEllipsoid(g, VM, { ...FLOOR, c: [hipP[0], fy + 0.05, hipP[2]], r: [0.1, box.mz * 0.7, box.mx * 0.62] }, [0.1, 0.12, 0.16], 0.14, 1);
  gl.depthMask(true);
  gl.disable(gl.BLEND);
  // Körper
  for (const p of partsFor(model, target)) (p.t === 't' ? drawTube : drawEllipsoid)(g, VM, p, C[p.color] || C.skin);
  // Gelenke (durchscheinend, immer sichtbar)
  const jm = jointMarkers(model, target);
  if (jm.length) {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    for (const q of jm) drawEllipsoid(g, VM, { ...FLOOR, c: q, r: [5.4, 5.4, 5.4] }, C.hl, 0.32, 0.6);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
  }
}

// ==================== Bildausschnitt über alle Posen ====================
const boxCache = new WeakMap();
function boxFor(anim) {
  const key = anim;
  const cached = boxCache.get(key);
  if (cached && cached.g === GENDER) return cached.box;
  const prep = prepare(anim);
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < prep.seq.length; i++) {
    const A = prep.frames[prep.seq[i]], Bf = prep.frames[prep.seq[(i + 1) % prep.seq.length]];
    for (let s = 0; s <= 6; s++) {
      const m = build3D(lerpPose(A, Bf, s / 6), anim);
      for (const k in m.J) for (let d = 0; d < 3; d++) { mn[d] = Math.min(mn[d], m.J[k][d]); mx[d] = Math.max(mx[d], m.J[k][d]); }
    }
  }
  const rawMinY = mn[1];
  const pad = 10;
  mn = mn.map((v) => v - pad); mx = mx.map((v) => v + pad);
  const c = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  const r = Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) / 2 * 0.7;
  const floor = viewMode(anim) === 'top' ? rawMinY - 5.5 : 0;
  const box = { c, r, floor, mx: (mx[0] - mn[0]) / 2 + 6, mz: Math.max(18, (mx[2] - mn[2]) / 2 + 4) };
  boxCache.set(key, { g: GENDER, box });
  return box;
}

// ==================== Öffentliche API ====================
const active = new Set();
let raf = 0;
function loop(now) {
  for (const f of active) {
    if (!f.wrap.isConnected) { if (f.started) active.delete(f); continue; }
    f.tick(now);
  }
  raf = active.size ? requestAnimationFrame(loop) : 0;
}
const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };

// Erzeugt eine 3D-Figur. opts: { animate, interactive, aspect, frame, yaw, pitch }
// Rückgabe kompatibel zur 2D-Figur: { svg: Element, play(), stop() }
export function createFigure(anim, opts = {}) {
  const g = initGL();
  if (!g) return createFigure2D(anim, opts);
  const { animate = true, interactive = false } = opts;
  const prep = prepare(anim);
  const mode = viewMode(anim);
  const canvas = h('canvas', { class: 'fig3d-canvas', role: 'img', 'aria-label': 'Übungsfigur' });
  const wrap = h('div', { class: 'fig3d' + (interactive ? ' interactive' : '') }, canvas);
  const view = {
    yaw: opts.yaw ?? (mode === 'side' ? -28 : mode === 'top' ? -20 : mode === 'rear' ? 200 : 18),
    pitch: opts.pitch ?? (mode === 'top' ? 52 : 10),
    box: boxFor(anim),
  };
  const home = { yaw: view.yaw, pitch: view.pitch };
  let auto = false;
  let dirty = true;
  const staticFrame = opts.frame ?? (prep.frames.length > 1 ? (anim.thumb ?? 1) : 0);
  let pose = prep.frames[Math.min(staticFrame, prep.frames.length - 1)];
  const t0 = performance.now();

  const fig = {
    svg: wrap, wrap, started: false, playing: false,
    tick(now) {
      fig.started = true;
      if (fig.playing && prep.frames.length > 1) {
        const steps = prep.seq.map((f) => prep.holds[f] + prep.T);
        const period = steps.reduce((a, c) => a + c, 0);
        let t = (now - t0) % period, k = 0;
        while (t >= steps[k]) { t -= steps[k]; k++; }
        const hd = prep.holds[prep.seq[k]];
        const A = prep.frames[prep.seq[k]];
        pose = t < hd ? A : lerpPose(A, prep.frames[prep.seq[(k + 1) % prep.seq.length]], ease((t - hd) / prep.T));
        dirty = true;
      }
      if (auto) { view.yaw += 0.35; dirty = true; }
      if (!dirty) { if (!fig.playing && !auto) active.delete(fig); return; }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(canvas.clientWidth * dpr), hgt = Math.round(canvas.clientHeight * dpr);
      if (!w || !hgt) return;
      if (canvas.width !== w || canvas.height !== hgt) { canvas.width = w; canvas.height = hgt; }
      const model = build3D(pose, anim);
      renderScene(g, view, model, opts.highlight === false ? null : anim.target, w, hgt);
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, w, hgt);
      ctx.drawImage(g.canvas, 0, g.canvas.height - hgt, w, hgt, 0, 0, w, hgt);
      dirty = false;
    },
    play() { fig.playing = animate; active.add(fig); kick(); return fig; },
    stop() { fig.playing = false; dirty = true; },
    update() {},
  };

  if (interactive) {
    let drag = null;
    canvas.addEventListener('pointerdown', (e) => { active.add(fig); kick(); drag = { x: e.clientX, y: e.clientY, yaw: view.yaw, pitch: view.pitch }; canvas.setPointerCapture(e.pointerId); wrap.classList.add('touched'); auto = false; autoBtn.classList.remove('on'); });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      view.yaw = drag.yaw - (e.clientX - drag.x) * 0.6;
      view.pitch = Math.max(-12, Math.min(80, drag.pitch + (e.clientY - drag.y) * 0.4));
      dirty = true; active.add(fig); kick();
    });
    const end = () => { drag = null; };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    const autoBtn = h('button', { class: 'fig3d-btn', 'aria-label': 'Automatisch drehen', onclick: () => { auto = !auto; autoBtn.classList.toggle('on', auto); wrap.classList.add('touched'); active.add(fig); kick(); } }, '360°');
    const resetBtn = h('button', { class: 'fig3d-btn', 'aria-label': 'Ansicht zurücksetzen', onclick: () => { auto = false; autoBtn.classList.remove('on'); view.yaw = home.yaw; view.pitch = home.pitch; dirty = true; active.add(fig); kick(); } }, '⟲');
    wrap.append(h('div', { class: 'fig3d-tools' }, [resetBtn, autoBtn]), h('span', { class: 'fig3d-hint' }, 'Zum Drehen ziehen'));
  }

  active.add(fig);
  if (animate) fig.playing = true;
  kick();
  return fig;
}

// Nach Wechsel der Figur alle Bildausschnitte neu berechnen
export function resetFigureCache() { /* boxCache prüft das Geschlecht selbst */ }
