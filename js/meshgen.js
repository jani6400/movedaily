// Web Worker: wandelt das weich verschmolzene Körpermodell (Round Cones, SDF) einmalig
// in ein Dreiecksnetz um (Surface Nets) und berechnet je Punkt:
// Knochen-Gewichte (fürs Animieren), Material, Muskel-Zugehörigkeit und Umgebungsschatten.

const COL = [[0.80, 0.81, 0.84], [0.16, 0.17, 0.20], [0.25, 0.19, 0.15], [0.30, 0.30, 0.32], [0.80, 0.81, 0.84], [0.80, 0.81, 0.84]];
const BONES = ['tL', 'tU', 'head', 'uaN', 'faN', 'uaF', 'faF', 'thN', 'shN', 'ftN', 'thF', 'shF', 'ftF'];

function prep(prims) {
  return prims.map((p) => {
    const ba = [p.b[0] - p.a[0], p.b[1] - p.a[1], p.b[2] - p.a[2]];
    const l2 = ba[0] * ba[0] + ba[1] * ba[1] + ba[2] * ba[2];
    const rr = p.r1 - p.r2;
    const c = [(p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2, (p.a[2] + p.b[2]) / 2];
    const R = Math.sqrt(l2) / 2 + Math.max(p.r1, p.r2);
    return { ...p, ba, l2, rr, a2: l2 - rr * rr, il2: l2 > 1e-6 ? 1 / l2 : 0, c, R };
  });
}

function sdRC(x, y, z, P) {
  const pax = x - P.a[0], pay = y - P.a[1], paz = z - P.a[2];
  if (P.l2 < 1e-6) return Math.sqrt(pax * pax + pay * pay + paz * paz) - Math.max(P.r1, P.r2);
  const { ba, l2, rr, a2, il2 } = P;
  const yy = pax * ba[0] + pay * ba[1] + paz * ba[2];
  const zz = yy - l2;
  const xvx = pax * l2 - ba[0] * yy, xvy = pay * l2 - ba[1] * yy, xvz = paz * l2 - ba[2] * yy;
  const x2 = xvx * xvx + xvy * xvy + xvz * xvz;
  const y2 = yy * yy * l2;
  const z2 = zz * zz * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - P.r2;
  if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - P.r1;
  return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - P.r1;
}

function generate({ prims: rawPrims, hip, sc, voxel, musKeys }) {
  const prims = prep(rawPrims);
  const KMAX = 4;
  // Bounding-Box
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const p of prims) for (let d = 0; d < 3; d++) { mn[d] = Math.min(mn[d], p.c[d] - p.R); mx[d] = Math.max(mx[d], p.c[d] + p.R); }
  mn = mn.map((v) => v - 2.5); mx = mx.map((v) => v + 2.5);
  const h = voxel;
  const nx = Math.ceil((mx[0] - mn[0]) / h) + 1, ny = Math.ceil((mx[1] - mn[1]) / h) + 1, nz = Math.ceil((mx[2] - mn[2]) / h) + 1;

  // Grobe Zellen mit Listen der Formen in der Nähe (Beschleunigung)
  const B = 8;
  const bx = Math.ceil(nx / B), by = Math.ceil(ny / B), bz = Math.ceil(nz / B);
  const bins = new Array(bx * by * bz);
  const binR = (B * h * Math.sqrt(3)) / 2;
  for (let i = 0; i < bx; i++) for (let j = 0; j < by; j++) for (let k = 0; k < bz; k++) {
    const cx = mn[0] + (i + 0.5) * B * h, cy = mn[1] + (j + 0.5) * B * h, cz = mn[2] + (k + 0.5) * B * h;
    const list = [];
    for (const p of prims) {
      const d = Math.hypot(cx - p.c[0], cy - p.c[1], cz - p.c[2]) - p.R - binR;
      if (d < KMAX + 6) list.push(p);
    }
    bins[(i * by + j) * bz + k] = list;
  }
  const listAt = (x, y, z) => {
    const i = Math.min(bx - 1, Math.max(0, Math.floor((x - mn[0]) / (B * h))));
    const j = Math.min(by - 1, Math.max(0, Math.floor((y - mn[1]) / (B * h))));
    const k = Math.min(bz - 1, Math.max(0, Math.floor((z - mn[2]) / (B * h))));
    return bins[(i * by + j) * bz + k];
  };
  // Formen werden der Reihe nach weich vereint. Aufeinanderfolgende Teile einer Kette (chain) werden erst
  // hart vereint und dann als Ganzes weich angefügt – so entstehen an den Nahtstellen keine Wülste.
  const smin = (d, e, k) => {
    const hh = Math.min(1, Math.max(0, 0.5 + (0.5 * (e - d)) / k));
    return e * (1 - hh) + d * hh - k * hh * (1 - hh);
  };
  const sdf = (x, y, z, list = listAt(x, y, z)) => {
    let d = 1e5, g = 1e5, gk = 1;
    for (let n = 0; n < list.length; n++) {
      const P = list[n];
      if (!P.chain) {
        if (g < 1e4) d = smin(d, g, gk);
        g = 1e5;
      }
      gk = P.k;
      const dc = Math.hypot(x - P.c[0], y - P.c[1], z - P.c[2]) - P.R;
      if (dc > Math.min(d, g) + P.k) continue;
      const e = sdRC(x, y, z, P);
      if (e < g) g = e;
    }
    if (g < 1e4) d = smin(d, g, gk);
    return d;
  };

  // Abstandsfeld auf dem Gitter
  const vals = new Float32Array(nx * ny * nz);
  const idx = (i, j, k) => (i * ny + j) * nz + k;
  for (let i = 0; i < nx; i++) {
    const x = mn[0] + i * h;
    for (let j = 0; j < ny; j++) {
      const y = mn[1] + j * h;
      for (let k = 0; k < nz; k++) {
        const z = mn[2] + k * h;
        const list = listAt(x, y, z);
        vals[idx(i, j, k)] = list.length ? sdf(x, y, z, list) : 10;
      }
    }
  }

  // Surface Nets: ein Punkt je Zelle mit Vorzeichenwechsel
  const cellV = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cidx = (i, j, k) => (i * (ny - 1) + j) * (nz - 1) + k;
  const pos = [];
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (let i = 0; i < nx - 1; i++) for (let j = 0; j < ny - 1; j++) for (let k = 0; k < nz - 1; k++) {
    let neg = 0;
    for (let c = 0; c < 8; c++) {
      cv[c] = vals[idx(i + corners[c][0], j + corners[c][1], k + corners[c][2])];
      if (cv[c] < 0) neg++;
    }
    if (neg === 0 || neg === 8) continue;
    let sx = 0, sy = 0, sz = 0, cnt = 0;
    for (const [a, b] of edges) {
      const va = cv[a], vb = cv[b];
      if ((va < 0) === (vb < 0)) continue;
      const t = va / (va - vb);
      sx += corners[a][0] + (corners[b][0] - corners[a][0]) * t;
      sy += corners[a][1] + (corners[b][1] - corners[a][1]) * t;
      sz += corners[a][2] + (corners[b][2] - corners[a][2]) * t;
      cnt++;
    }
    cellV[cidx(i, j, k)] = pos.length / 3;
    pos.push(mn[0] + (i + sx / cnt) * h, mn[1] + (j + sy / cnt) * h, mn[2] + (k + sz / cnt) * h);
  }
  // Flächen: je Gitterkante mit Vorzeichenwechsel ein Viereck aus den 4 angrenzenden Zellen
  const tris = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) tris.push(a, c, b, a, d, c);
    else tris.push(a, b, c, a, c, d);
  };
  for (let i = 0; i < nx - 1; i++) for (let j = 0; j < ny - 1; j++) for (let k = 0; k < nz - 1; k++) {
    const v0 = vals[idx(i, j, k)];
    if (j > 0 && k > 0) { const v1 = vals[idx(i + 1, j, k)]; if ((v0 < 0) !== (v1 < 0)) quad(cellV[cidx(i, j - 1, k - 1)], cellV[cidx(i, j, k - 1)], cellV[cidx(i, j, k)], cellV[cidx(i, j - 1, k)], v0 < 0); }
    if (i > 0 && k > 0) { const v1 = vals[idx(i, j + 1, k)]; if ((v0 < 0) !== (v1 < 0)) quad(cellV[cidx(i - 1, j, k - 1)], cellV[cidx(i - 1, j, k)], cellV[cidx(i, j, k)], cellV[cidx(i, j, k - 1)], v0 < 0); }
    if (i > 0 && j > 0) { const v1 = vals[idx(i, j, k + 1)]; if ((v0 < 0) !== (v1 < 0)) quad(cellV[cidx(i - 1, j - 1, k)], cellV[cidx(i, j - 1, k)], cellV[cidx(i, j, k)], cellV[cidx(i - 1, j, k)], v0 < 0); }
  }

  // Eigenschaften je Punkt
  const nv = pos.length / 3;
  const P = new Float32Array(pos);
  const Nrm = new Float32Array(nv * 3);
  const BI = new Float32Array(nv * 4), BW = new Float32Array(nv * 4);
  const COLA = new Float32Array(nv * 3), HLA = new Float32Array(nv), MUS = new Float32Array(nv), MUSW = new Float32Array(nv), AO = new Float32Array(nv);
  const boneIdx = Object.fromEntries(BONES.map((b, i) => [b, i]));
  const musIdx = Object.fromEntries(musKeys.map((k, i) => [k, i]));
  const ax = [sc[0] - hip[0], sc[1] - hip[1], sc[2] - hip[2]];
  const axL2 = ax[0] * ax[0] + ax[1] * ax[1] + ax[2] * ax[2];
  const e = 0.35;
  for (let v = 0; v < nv; v++) {
    const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
    const list = listAt(x, y, z);
    // Normale über den Gradienten
    let gx = sdf(x + e, y, z, list) - sdf(x - e, y, z, list);
    let gy = sdf(x, y + e, z, list) - sdf(x, y - e, z, list);
    let gz = sdf(x, y, z + e, list) - sdf(x, y, z - e, list);
    const gl = Math.hypot(gx, gy, gz) || 1;
    gx /= gl; gy /= gl; gz /= gl;
    Nrm[v * 3] = gx; Nrm[v * 3 + 1] = gy; Nrm[v * 3 + 2] = gz;
    // Beiträge der einzelnen Formen
    let dmin = 1e9;
    const ds = [];
    for (const Q of list) {
      const dc = Math.hypot(x - Q.c[0], y - Q.c[1], z - Q.c[2]) - Q.R;
      if (dc > 6) continue;
      const d = sdRC(x, y, z, Q);
      ds.push([Q, d]);
      if (d < dmin) dmin = d;
    }
    const boneW = new Float32Array(BONES.length);
    const matW = [0, 0, 0, 0, 0, 0];
    let cw = 0, cr = 0, cg = 0, cb = 0;
    let bestMus = -1, bestMusW = 0;
    for (const [Q, d] of ds) {
      const w = Math.exp(-Math.max(0, d - dmin) / 0.8);
      if (w < 0.02) continue;
      matW[Q.mat] += w;
      const wc = Math.exp(-Math.max(0, d - dmin) / 0.45); // Farbe: etwas schärfer überblendet
      const col = COL[Q.mat];
      cr += col[0] * wc; cg += col[1] * wc; cb += col[2] * wc; cw += wc;
      if (Q.bone === 'torso') {
        const t = Math.min(1, Math.max(0, ((x - hip[0]) * ax[0] + (y - hip[1]) * ax[1] + (z - hip[2]) * ax[2]) / axL2));
        const u = Math.min(1, Math.max(0, (t - 0.35) / 0.3));
        const su = u * u * (3 - 2 * u);
        boneW[0] += w * (1 - su);
        boneW[1] += w * su;
      } else boneW[boneIdx[Q.bone]] += w;
      if (Q.mus) {
        const key = Q.mus + '|' + (Q.side || '');
        const mw = Math.exp(-Math.max(0, d - dmin) / 1.4); // Markierung reicht etwas über den Muskelrand
        if (mw > bestMusW && musIdx[key] !== undefined) { bestMusW = mw; bestMus = musIdx[key]; }
      }
    }
    // Farbe (weich überblendet) und Anteil, der eingefärbt werden darf (Haut/Kleidung, nicht Haare/Augen)
    COLA[v * 3] = cr / cw; COLA[v * 3 + 1] = cg / cw; COLA[v * 3 + 2] = cb / cw;
    const tot = matW.reduce((a, b) => a + b, 0) || 1;
    HLA[v] = (matW[0] + matW[1] + matW[4] + matW[5]) / tot;
    MUS[v] = bestMus;
    MUSW[v] = bestMus >= 0 ? Math.min(1, Math.max(0, (bestMusW - 0.2) / 0.5)) : 0;
    // die 4 stärksten Knochen
    const order = Array.from(boneW.keys()).sort((a, b) => boneW[b] - boneW[a]).slice(0, 4);
    let sum = 0;
    for (const o of order) sum += boneW[o];
    order.forEach((o, n) => { BI[v * 4 + n] = o; BW[v * 4 + n] = sum > 0 ? boneW[o] / sum : (n === 0 ? 1 : 0); });
    // Umgebungsschatten (Rillen zwischen Muskeln)
    let occ = 0, sca = 1;
    for (let n = 1; n <= 4; n++) {
      const hh = 0.45 * n;
      occ += (hh - sdf(x + gx * hh, y + gy * hh, z + gz * hh)) * sca;
      sca *= 0.75;
    }
    AO[v] = Math.min(1, Math.max(0, 1 - 0.42 * occ));
  }
  const I = new Uint32Array(tris);
  return { P, Nrm, BI, BW, COLA, HLA, MUS, MUSW, AO, I, stats: { nv, nt: tris.length / 3, grid: [nx, ny, nz] } };
}

self.onmessage = (ev) => {
  const t0 = performance.now();
  const out = generate(ev.data);
  out.stats.ms = Math.round(performance.now() - t0);
  self.postMessage(out, [out.P.buffer, out.Nrm.buffer, out.BI.buffer, out.BW.buffer, out.COLA.buffer, out.HLA.buffer, out.MUS.buffer, out.MUSW.buffer, out.AO.buffer, out.I.buffer]);
};
