// Schneller Renderer: das einmal erzeugte Körpernetz wird an ein Skelett gebunden (Skinning)
// und pro Bild nur noch über 13 Knochen bewegt. So läuft die Animation flüssig, auch auf dem Handy.

import { buildPrims } from './body3d.js';

const BONES = ['tL', 'tU', 'head', 'uaN', 'faN', 'uaF', 'faF', 'thN', 'shN', 'ftN', 'thF', 'shF', 'ftF'];

// ---------- Vektorhilfen ----------
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// ---------- Shader ----------
const BODY_VS = `#version 300 es
in vec3 aPos; in vec3 aNrm; in vec4 aBI; in vec4 aBW; in vec3 aCol; in vec2 aHL; in float aAO;
uniform mat4 uBones[13];
uniform mat4 uView, uProj;
out vec3 vN; out vec3 vP; out vec3 vCol; out vec2 vHL; out float vAO;
void main() {
  mat4 M = uBones[int(aBI.x)] * aBW.x + uBones[int(aBI.y)] * aBW.y + uBones[int(aBI.z)] * aBW.z + uBones[int(aBI.w)] * aBW.w;
  vec4 wp = M * vec4(aPos, 1.0);
  vec4 vp = uView * wp;
  vP = vp.xyz;
  vN = mat3(uView) * (mat3(M) * aNrm);
  vCol = aCol; vHL = aHL; vAO = aAO;
  gl_Position = uProj * vp;
}`;
const BODY_FS = `#version 300 es
precision highp float;
uniform vec3 uCol[6];
in vec3 vN; in vec3 vP; in vec3 vCol; in vec2 vHL; in float vAO;
out vec4 frag;
void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(-vP);
  if (dot(n, v) < 0.0) n = -n;
  vec3 base = vCol;
  base = mix(base, uCol[4], smoothstep(0.2, 0.7, vHL.x));
  base = mix(base, uCol[5], smoothstep(0.2, 0.7, vHL.y));
  vec3 L1 = normalize(vec3(-0.5, 0.8, 0.55));
  vec3 L2 = normalize(vec3(0.8, 0.15, 0.3));
  float dif = clamp(dot(n, L1), 0.0, 1.0);
  float wrap = clamp(dot(n, L1) * 0.5 + 0.5, 0.0, 1.0);
  float fill = clamp(dot(n, L2), 0.0, 1.0);
  float sky = 0.5 + 0.5 * n.y;
  float spec = pow(clamp(dot(n, normalize(L1 + v)), 0.0, 1.0), 28.0) * 0.16;
  float rim = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 3.0) * 0.18;
  float ao = vAO;
  vec3 col = base * (0.13 + 0.62 * dif + 0.12 * wrap + 0.15 * fill + 0.13 * sky) * (0.35 + 0.65 * ao);
  col += vec3(spec + rim) * ao;
  frag = vec4(col, 1.0);
}`;
const FLOOR_VS = `#version 300 es
in vec2 aXZ;
uniform mat4 uView, uProj;
uniform float uFloor;
out vec2 vXZ;
void main() { vXZ = aXZ; gl_Position = uProj * uView * vec4(aXZ.x, uFloor, aXZ.y, 1.0); }`;
const FLOOR_FS = `#version 300 es
precision highp float;
uniform vec4 uMat; uniform vec4 uShadow;
in vec2 vXZ;
out vec4 frag;
void main() {
  vec2 m = (vXZ - uMat.xy) / uMat.zw;
  float r = dot(m, m);
  if (r > 1.0) discard;
  vec2 s = (vXZ - uShadow.xy) / uShadow.zw;
  float blob = exp(-2.4 * dot(s, s));
  vec3 c = vec3(0.80, 0.84, 0.89) * (1.0 - 0.36 * blob);
  frag = vec4(c, smoothstep(1.0, 0.93, r));
}`;
const JOINT_VS = `#version 300 es
in vec3 aPos;
uniform mat4 uView, uProj;
uniform vec4 uJ;
out vec3 vN; out vec3 vP;
void main() { vec4 vp = uView * vec4(uJ.xyz + aPos * uJ.w, 1.0); vP = vp.xyz; vN = mat3(uView) * aPos; gl_Position = uProj * vp; }`;
const JOINT_FS = `#version 300 es
precision highp float;
uniform vec3 uColor;
in vec3 vN; in vec3 vP;
out vec4 frag;
void main() { float f = abs(dot(normalize(vN), normalize(-vP))); frag = vec4(uColor, 0.18 + 0.32 * (1.0 - f)); }`;

// ---------- Initialisierung ----------
// Gemeinsamer Zustand: erzeugte Netze (Rohdaten) und Wartende
const meshData = {};
const pending = {};
const listeners = new Set();

// Ein Renderer gehört zu einer Zeichenfläche. Bewegte Figuren bekommen eine eigene (kein Kopieren pro Bild),
// Standbilder teilen sich eine unsichtbare.
export function makeRenderer(canvas, { preserve = false } = {}) {
  try {
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, preserveDrawingBuffer: preserve, premultipliedAlpha: false });
    if (!gl) return null;
    const prog = (vs, fs) => {
      const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
      gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      return p;
    };
    const body = prog(BODY_VS, BODY_FS), floor = prog(FLOOR_VS, FLOOR_FS), joint = prog(JOINT_VS, JOINT_FS);
    const loc = (p, names) => Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(p, n)]));
    // Bodenfläche
    const fvao = gl.createVertexArray();
    gl.bindVertexArray(fvao);
    const fvb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, fvb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(8), gl.DYNAMIC_DRAW);
    const fa = gl.getAttribLocation(floor, 'aXZ');
    gl.enableVertexAttribArray(fa);
    gl.vertexAttribPointer(fa, 2, gl.FLOAT, false, 0, 0);
    // Kugel für Gelenke
    const sp = [], si = [];
    for (let i = 0; i <= 12; i++) for (let j = 0; j <= 18; j++) {
      const th = (i / 12) * Math.PI, ph = (j / 18) * Math.PI * 2;
      sp.push(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph));
    }
    for (let i = 0; i < 12; i++) for (let j = 0; j < 18; j++) { const a = i * 19 + j, b = a + 19; si.push(a, b, a + 1, b, b + 1, a + 1); }
    const jvao = gl.createVertexArray();
    gl.bindVertexArray(jvao);
    const jvb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, jvb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sp), gl.STATIC_DRAW);
    const ja = gl.getAttribLocation(joint, 'aPos'); gl.enableVertexAttribArray(ja); gl.vertexAttribPointer(ja, 3, gl.FLOAT, false, 0, 0);
    const jib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, jib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(si), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    gl.useProgram(body);
    const UB = loc(body, ['uBones', 'uView', 'uProj', 'uCol']);
    gl.uniform3fv(UB.uCol, new Float32Array([0.80, 0.81, 0.84, 0.16, 0.17, 0.20, 0.25, 0.19, 0.15, 0.09, 0.09, 0.10, 0.88, 0.29, 0.22, 0.95, 0.56, 0.24]));
    return {
      gl, canvas, body, floor, joint, UB,
      UF: loc(floor, ['uView', 'uProj', 'uFloor', 'uMat', 'uShadow']),
      UJ: loc(joint, ['uView', 'uProj', 'uJ', 'uColor']),
      fvao, fvb, jvao, jcount: si.length,
      meshes: {},
    };
  } catch (e) {
    console.warn('Skinning-Renderer nicht verfügbar', e);
    return null;
  }
}

let R = null;
export function initSkin() {
  if (R !== null) return R;
  const c = document.createElement('canvas');
  c.width = 700; c.height = 700;
  R = makeRenderer(c, { preserve: true }) || false;
  return R;
}

export function disposeRenderer(inst) {
  if (!inst || inst === R) return;
  inst.gl.getExtension('WEBGL_lose_context')?.loseContext();
}

export function onMeshReady(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export const meshReady = (gender) => !!meshData[gender];

// Netz in einen Renderer hochladen (einmal je Renderer und Figur)
function uploadMesh(inst, gender) {
  if (inst.meshes[gender]) return inst.meshes[gender];
  const d = meshData[gender];
  if (!d) return null;
  const { gl, body } = inst;
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const attr = (name, data, size, usage = gl.STATIC_DRAW) => {
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data, usage);
    const l = gl.getAttribLocation(body, name);
    if (l < 0) return b;
    gl.enableVertexAttribArray(l);
    gl.vertexAttribPointer(l, size, gl.FLOAT, false, 0, 0);
    return b;
  };
  attr('aPos', d.P, 3); attr('aNrm', d.Nrm, 3); attr('aBI', d.BI, 4); attr('aBW', d.BW, 4);
  attr('aCol', d.COLA, 3); attr('aAO', d.AO, 1);
  // Markierung je Ecke (wird pro Übung neu berechnet, damit die Ränder weich verlaufen)
  const nv = d.P.length / 3;
  const hlBuf = attr('aHL', new Float32Array(nv * 2), 2, gl.DYNAMIC_DRAW);
  const ib = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, d.I, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  inst.meshes[gender] = { vao, count: d.I.length, musKeys: d.musKeys, rest: d.rest, hlBuf, hlKey: null, hl: new Float32Array(nv * 2), d };
  return inst.meshes[gender];
}

// ---------- Knochen-Rahmen ----------
function frameFrom(o, b, anRef) {
  let u = sub(b, o);
  u = len(u) > 1e-4 ? norm(u) : [0, 1, 0];
  let an = sub(anRef, mul(u, dot(anRef, u)));
  if (len(an) < 1e-3) an = Math.abs(u[0]) < 0.9 ? cross(u, [1, 0, 0]) : cross(u, [0, 0, 1]);
  an = norm(an);
  const x = cross(u, an);
  return { o, x, y: u, z: an };
}

export function boneFrames(model) {
  const { J, F } = model;
  const sp = (t) => { const u = 1 - t; return [0, 1, 2].map((i) => u * u * J.hip[i] + 2 * u * t * J.ctrl[i] + t * t * J.sc[i]); };
  const mid = sp(0.5);
  const fr = {
    tL: frameFrom(J.hip, mid, F.torso.an),
    tU: frameFrom(mid, J.sc, F.torso.an),
    head: frameFrom(J.sc, J.head, F.neck.an),
  };
  for (const s of ['N', 'F']) {
    fr['ua' + s] = frameFrom(J['so' + s], J['el' + s], F['ua' + s].an);
    fr['fa' + s] = frameFrom(J['el' + s], J['wr' + s], F['fa' + s].an);
    fr['th' + s] = frameFrom(J['hip' + s], J['kn' + s], F['th' + s].an);
    fr['sh' + s] = frameFrom(J['kn' + s], J['an' + s], F['sh' + s].an);
    const Ft = F['ft' + s], Sh = F['sh' + s];
    const fd = Ft.L > 1 ? Ft.u : norm(cross(Sh.u, Sh.lat));
    fr['ft' + s] = frameFrom(J['an' + s], add(J['an' + s], fd), mul(Sh.u, -1));
  }
  return fr;
}

// M = Rahmen_aktuell · Rahmen_Ruhe⁻¹ (spaltenweise 4×4)
function boneMatrix(cur, rest) {
  const C = [cur.x, cur.y, cur.z];
  const Rr = [rest.x, rest.y, rest.z];
  const m = new Float32Array(16);
  // Rotation: C · Rᵀ
  for (let col = 0; col < 3; col++) for (let row = 0; row < 3; row++) {
    let v = 0;
    for (let k = 0; k < 3; k++) v += C[k][row] * Rr[k][col];
    m[col * 4 + row] = v;
  }
  // Translation: o_cur − Rot · o_rest
  for (let row = 0; row < 3; row++) {
    let v = 0;
    for (let col = 0; col < 3; col++) v += m[col * 4 + row] * rest.o[col];
    m[12 + row] = cur.o[row] - v;
  }
  m[15] = 1;
  return m;
}

// ---------- Netz erzeugen (einmal je Figur, im Hintergrund) ----------
// Netz-Version: erhöhen, wenn sich das Körpermodell ändert (alter Gerätespeicher wird dann ignoriert)
const MESH_VERSION = 12;
const idb = () => new Promise((res, rej) => {
  const rq = indexedDB.open('movedaily-mesh', 1);
  rq.onupgradeneeded = () => rq.result.createObjectStore('mesh');
  rq.onsuccess = () => res(rq.result);
  rq.onerror = () => rej(rq.error);
});
async function loadCached(key) {
  try {
    const db = await idb();
    return await new Promise((res) => { const r = db.transaction('mesh').objectStore('mesh').get(key); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); });
  } catch { return null; }
}
async function saveCached(key, val) {
  try { const db = await idb(); db.transaction('mesh', 'readwrite').objectStore('mesh').put(val, key); } catch { /* kein Speicher – egal */ }
}

export function ensureMesh(gender, restModel) {
  if (meshData[gender]) return meshData[gender];
  if (pending[gender] || !initSkin()) return null;
  pending[gender] = true;
  const key = `v${MESH_VERSION}-${gender}`;
  const done = (data) => {
    meshData[gender] = data;
    pending[gender] = false;
    for (const fn of listeners) fn(gender);
  };
  // 1. schneller Weg: auf dem Gerät gespeichertes Netz
  loadCached(key).then((cached) => {
    if (cached && cached.P) { done(cached); return; }
    generateMesh(gender, restModel, (data) => { done(data); saveCached(key, data); });
  });
  return null;
}

// 2. Netz im Hintergrund (Web Worker) berechnen
function generateMesh(gender, restModel, cb) {
  const { prims } = buildPrims(restModel, null, gender, { mesh: true });
  const musKeys = [...new Set(prims.filter((p) => p.mus).map((p) => p.mus + '|' + (p.side || '')))];
  const plain = prims.map((p) => ({ a: p.a, b: p.b, r1: p.r1, r2: p.r2, mat: p.mat, k: p.k, bone: p.bone, mus: p.mus, side: p.side, chain: !!p.chain }));
  const rest = boneFrames(restModel);
  const worker = new Worker(new URL('./meshgen.js', import.meta.url));
  worker.onmessage = (ev) => {
    worker.terminate();
    cb({ ...ev.data, musKeys, rest });
  };
  worker.onerror = (e) => { console.warn('Netz-Erzeugung fehlgeschlagen', e); pending[gender] = false; };
  worker.postMessage({ prims: plain, hip: restModel.J.hip, sc: restModel.J.sc, voxel: 0.95, musKeys });
  return null;
}

// ---------- Zeichnen ----------
function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}
function lookAt(eye, target, mirror) {
  const z = norm(sub(eye, target));
  const x = norm(cross([0, 1, 0], z));
  const y = cross(z, x);
  const m = new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
  if (mirror) { // Welt an der x-Achse spiegeln (Seite 2)
    for (let r = 0; r < 4; r++) m[r] = -m[r];
  }
  return m;
}

// Weichzeichnen über die Dreiecke, damit die Markierung nicht treppenartig aufhört
function smoothHL(hl, I, passes) {
  const nv = hl.length / 2;
  const acc = new Float32Array(nv * 2), cnt = new Float32Array(nv);
  for (let p = 0; p < passes; p++) {
    acc.fill(0); cnt.fill(0);
    for (let i = 0; i < I.length; i += 3) {
      const a = I[i], b = I[i + 1], c = I[i + 2];
      const sx = hl[a * 2] + hl[b * 2] + hl[c * 2], sy = hl[a * 2 + 1] + hl[b * 2 + 1] + hl[c * 2 + 1];
      acc[a * 2] += sx; acc[b * 2] += sx; acc[c * 2] += sx;
      acc[a * 2 + 1] += sy; acc[b * 2 + 1] += sy; acc[c * 2 + 1] += sy;
      cnt[a] += 3; cnt[b] += 3; cnt[c] += 3;
    }
    for (let v = 0; v < nv; v++) if (cnt[v]) { hl[v * 2] = acc[v * 2] / cnt[v]; hl[v * 2 + 1] = acc[v * 2 + 1] / cnt[v]; }
  }
}

// Markierte Muskeln je Ecke: Hauptmuskel (rot) in x, Nebenmuskel (orange) in y
function updateHighlight(gl, mesh, target) {
  const key = JSON.stringify([target?.p || [], target?.s || []]);
  if (mesh.hlKey === key) return;
  mesh.hlKey = key;
  const st = mesh.musKeys.map((k) => {
    const [m, side] = k.split('|');
    const hit = (list) => (list || []).some((x) => x.m === m && (!x.side || !side || x.side === side));
    return hit(target?.p) ? 1 : hit(target?.s) ? 2 : 0;
  });
  const { MUS, MUSW, HLA } = mesh.d;
  const hl = mesh.hl;
  hl.fill(0);
  if (st.some((x) => x)) {
    for (let v = 0, n = MUS.length; v < n; v++) {
      const id = MUS[v];
      if (id < 0) continue;
      const s = st[id];
      if (s) hl[v * 2 + s - 1] = MUSW[v] * HLA[v];
    }
  }
  if (st.some((x) => x)) smoothHL(hl, mesh.d.I, 2);
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.hlBuf);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, hl);
}

export function renderSkinned(view, model, target, gender, w, h, mirror = false, inst = null) {
  const r = inst || initSkin();
  if (!r) return null;
  const mesh = uploadMesh(r, gender);
  if (!mesh) return null;
  const { gl } = r;
  if (inst) { // eigene, sichtbare Zeichenfläche: genau passend
    if (r.canvas.width !== w || r.canvas.height !== h) { r.canvas.width = w; r.canvas.height = h; }
  } else if (r.canvas.width < w || r.canvas.height < h) {
    r.canvas.width = Math.max(r.canvas.width, w);
    r.canvas.height = Math.max(r.canvas.height, h);
  }
  const { box } = view;
  const yaw = (view.yaw * Math.PI) / 180, pitch = (view.pitch * Math.PI) / 180;
  const fov = (26 * Math.PI) / 180;
  const aspect = w / h;
  const fit = (box.r / Math.tan(fov / 2)) / Math.min(1, aspect) * 1.08;
  const cx = mirror ? -box.c[0] : box.c[0];
  const tgt = [cx, box.c[1], box.c[2]];
  const eye = [cx + Math.sin(yaw) * Math.cos(pitch) * fit, box.c[1] + Math.sin(pitch) * fit, box.c[2] + Math.cos(yaw) * Math.cos(pitch) * fit];
  // Bei Spiegelung: Kamera im gespiegelten Raum, Welt wird gespiegelt dargestellt
  const VM = lookAt(eye, tgt, false);
  if (mirror) { VM[0] = -VM[0]; VM[1] = -VM[1]; VM[2] = -VM[2]; }
  const PM = perspective(fov, aspect, 5, fit * 4);

  gl.viewport(0, 0, w, h);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Boden
  gl.useProgram(r.floor);
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.uniformMatrix4fv(r.UF.uView, false, VM);
  gl.uniformMatrix4fv(r.UF.uProj, false, PM);
  gl.uniform1f(r.UF.uFloor, box.floor);
  gl.uniform4fv(r.UF.uMat, [box.c[0], box.c[2], box.mx, box.mz]);
  gl.uniform4fv(r.UF.uShadow, [model.J.hip[0], model.J.hip[2], box.mx * 0.62, box.mz * 0.7]);
  gl.bindVertexArray(r.fvao);
  gl.bindBuffer(gl.ARRAY_BUFFER, r.fvb);
  const x0 = box.c[0] - box.mx, x1 = box.c[0] + box.mx, z0 = box.c[2] - box.mz, z1 = box.c[2] + box.mz;
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array([x0, z0, x1, z0, x0, z1, x1, z1]));
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  // Körper
  gl.disable(gl.BLEND);
  gl.enable(gl.DEPTH_TEST);
  gl.useProgram(r.body);
  const cur = boneFrames(model);
  const mats = new Float32Array(16 * BONES.length);
  BONES.forEach((b, i) => mats.set(boneMatrix(cur[b], mesh.rest[b]), i * 16));
  gl.uniformMatrix4fv(r.UB.uBones, false, mats);
  gl.uniformMatrix4fv(r.UB.uView, false, VM);
  gl.uniformMatrix4fv(r.UB.uProj, false, PM);
  updateHighlight(gl, mesh, target);
  gl.bindVertexArray(mesh.vao);
  gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0);

  // Gelenke
  const js = model.joints || [];
  if (js.length) {
    gl.useProgram(r.joint);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.uniformMatrix4fv(r.UJ.uView, false, VM);
    gl.uniformMatrix4fv(r.UJ.uProj, false, PM);
    gl.uniform3fv(r.UJ.uColor, [0.88, 0.29, 0.22]);
    gl.bindVertexArray(r.jvao);
    for (const q of js) {
      gl.uniform4fv(r.UJ.uJ, [q[0], q[1], q[2], 5.2]);
      gl.drawElements(gl.TRIANGLES, r.jcount, gl.UNSIGNED_SHORT, 0);
    }
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
  }
  gl.bindVertexArray(null);
  return r.canvas;
}
