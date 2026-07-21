// ============================================================
// QR ENCODER — generatore QR on-device, zero dipendenze (v10)
// ============================================================
// Serve al "QR di bonifico SEPA" (EPC069-12): dev'essere un QR VERO e conforme,
// altrimenti l'app bancaria non lo legge. Implementa la modalità BYTE, livello di
// correzione M (lo standard GiroCode/SEPA), versioni 1–13 (coprono i 331 byte max
// dell'EPC). Onestà (regola #1): la MATEMATICA (Reed-Solomon su GF(256)) è
// verificata contro un vettore di RIFERIMENTO indipendente noto (vedi test); la
// struttura (finder/timing/dark) è verificata; la lettura reale con la tua app
// bancaria resta da confermare sul dispositivo. Funzioni pure, nessun DOM/rete.
'use strict';

// ---- GF(256) per Reed-Solomon (polinomio 0x11D, standard QR) ----
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const gfMul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];

// Polinomio generatore per `degree` codeword di correzione, con il coefficiente
// di TESTA in posizione 0 (gen[0]=1), come richiede la divisione in rsEncode.
function rsGenerator(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];                       // x * poly
      next[j + 1] ^= gfMul(poly[j], EXP[i]);    // α^i * poly
    }
    poly = next;
  }
  return poly;
}

// Codeword di correzione (Reed-Solomon) per un blocco di dati: divisione
// sintetica del messaggio (esteso con ecCount zeri) per il polinomio generatore;
// il resto sono gli ecCount codeword di correzione.
export function rsEncode(data, ecCount) {
  const gen = rsGenerator(ecCount);            // length ecCount+1, gen[0]=1
  const res = data.concat(new Array(ecCount).fill(0));
  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef !== 0) for (let j = 0; j < gen.length; j++) res[i + j] ^= gfMul(gen[j], coef);
  }
  return res.slice(data.length);               // esattamente ecCount codeword
}

// ---- Parametri per versione, livello M ----
// [ecPerBlock, blocchiG1, datiPerBloccoG1, blocchiG2, datiPerBloccoG2]
const EC_M = {
  1: [10, 1, 16, 0, 0], 2: [16, 1, 28, 0, 0], 3: [26, 1, 44, 0, 0], 4: [18, 2, 32, 0, 0],
  5: [24, 2, 43, 0, 0], 6: [16, 4, 27, 0, 0], 7: [18, 4, 31, 0, 0], 8: [22, 2, 38, 2, 39],
  9: [22, 3, 36, 2, 37], 10: [26, 4, 43, 1, 44], 11: [30, 1, 50, 4, 51], 12: [22, 6, 36, 2, 37],
  13: [22, 8, 37, 1, 38],
};
// capacità dati in BYTE per versione, livello M (mode+count già scontati)
const BYTE_CAP_M = { 1: 14, 2: 26, 3: 42, 4: 62, 5: 84, 6: 106, 7: 122, 8: 152, 9: 180, 10: 213, 11: 251, 12: 287, 13: 331 };
// posizioni dei pattern di allineamento per versione
const ALIGN = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38],
  8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50], 11: [6, 30, 54], 12: [6, 32, 58], 13: [6, 34, 62],
};

function chooseVersion(byteLen) {
  for (let v = 1; v <= 13; v++) if (byteLen <= BYTE_CAP_M[v]) return v;
  throw new Error('dati troppo lunghi per un QR (max ~331 byte a livello M)');
}

// ---- Bit stream ----
function bitStream() {
  const bits = [];
  return {
    push(val, len) { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); },
    bits,
  };
}

// Codifica i dati (modalità byte) → array di codeword (byte) già interleavati con l'ECC.
function encodeData(bytes, version) {
  const [ecPer, b1, d1, b2, d2] = EC_M[version];
  const totalDataCw = b1 * d1 + b2 * d2;
  const bs = bitStream();
  bs.push(0b0100, 4);                                   // mode: byte
  bs.push(bytes.length, version >= 10 ? 16 : 8);        // char count
  for (const b of bytes) bs.push(b, 8);
  bs.push(0, Math.min(4, totalDataCw * 8 - bs.bits.length)); // terminatore
  while (bs.bits.length % 8 !== 0) bs.bits.push(0);     // allinea al byte
  const dataCw = [];
  for (let i = 0; i < bs.bits.length; i += 8) { let v = 0; for (let j = 0; j < 8; j++) v = (v << 1) | bs.bits[i + j]; dataCw.push(v); }
  const PAD = [0xEC, 0x11];
  let p = 0; while (dataCw.length < totalDataCw) dataCw.push(PAD[p++ % 2]);

  // suddividi in blocchi, calcola ECC per blocco
  const blocks = [];
  let idx = 0;
  for (let i = 0; i < b1; i++) { const d = dataCw.slice(idx, idx + d1); idx += d1; blocks.push({ d, ec: rsEncode(d, ecPer) }); }
  for (let i = 0; i < b2; i++) { const d = dataCw.slice(idx, idx + d2); idx += d2; blocks.push({ d, ec: rsEncode(d, ecPer) }); }

  // interleaving dati poi ECC
  const out = [];
  const maxD = Math.max(...blocks.map(b => b.d.length));
  for (let i = 0; i < maxD; i++) for (const b of blocks) if (i < b.d.length) out.push(b.d[i]);
  for (let i = 0; i < ecPer; i++) for (const b of blocks) out.push(b.ec[i]);
  return out;
}

// ---- Matrice ----
const SIZE = (v) => 17 + v * 4;

function placeFinder(m, r, c) {
  for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) {
    const rr = r + i, cc = c + j; if (rr < 0 || cc < 0 || rr >= m.length || cc >= m.length) continue;
    const inb = i >= 0 && i <= 6 && j >= 0 && j <= 6;
    const on = inb && (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4));
    m[rr][cc] = on ? 1 : 0;
  }
}

function buildMatrix(version, codewords, mask) {
  const n = SIZE(version);
  const m = Array.from({ length: n }, () => new Array(n).fill(null));
  const reserved = Array.from({ length: n }, () => new Array(n).fill(false));
  const setF = (r, c, v) => { m[r][c] = v; reserved[r][c] = true; };

  // finder + separatori
  placeFinder(m, 0, 0); placeFinder(m, 0, n - 7); placeFinder(m, n - 7, 0);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    reserved[i][j] = true; reserved[i][n - 1 - j] = true; reserved[n - 1 - i][j] = true;
    if (m[i][j] === null) m[i][j] = 0;
    if (m[i][n - 1 - j] === null) m[i][n - 1 - j] = 0;
    if (m[n - 1 - i][j] === null) m[n - 1 - i][j] = 0;
  }
  // timing
  for (let i = 8; i < n - 8; i++) { const v = i % 2 === 0 ? 1 : 0; setF(6, i, v); setF(i, 6, v); }
  // dark module
  setF(n - 8, 8, 1);
  // allineamento
  const pos = ALIGN[version];
  for (const r of pos) for (const c of pos) {
    if ((r <= 7 && c <= 7) || (r <= 7 && c >= n - 8) || (r >= n - 8 && c <= 7)) continue;
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
      const on = Math.max(Math.abs(i), Math.abs(j)) !== 1;
      setF(r + i, c + j, on ? 1 : 0);
    }
  }
  // aree riservate a format info
  for (let i = 0; i < 9; i++) { if (!reserved[8][i]) reserved[8][i] = true; if (!reserved[i][8]) reserved[i][8] = true; }
  for (let i = 0; i < 8; i++) { reserved[8][n - 1 - i] = true; reserved[n - 1 - i][8] = true; }
  // version info (v7+)
  if (version >= 7) {
    const vinfo = versionInfoBits(version);
    let k = 0;
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
      const bit = (vinfo >> k++) & 1;
      setF(i, n - 11 + j, bit); setF(n - 11 + j, i, bit);
    }
  }

  // posizionamento dati (zigzag) con maschera
  let bitIdx = 0; const totalBits = codewords.length * 8;
  const getBit = () => bitIdx < totalBits ? (codewords[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1 : 0;
  let upward = true;
  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col--; // salta la timing column
    for (let t = 0; t < n; t++) {
      const row = upward ? n - 1 - t : t;
      for (let dc = 0; dc < 2; dc++) {
        const c = col - dc;
        if (reserved[row][c]) continue;
        let bit = getBit(); bitIdx++;
        if (maskFn(mask)(row, c)) bit ^= 1;
        m[row][c] = bit;
      }
    }
    upward = !upward;
  }
  // format info (livello M = 0b00) con maschera scelta
  placeFormat(m, reserved, version, mask);
  return m;
}

// maschere QR
function maskFn(k) {
  return [
    (r, c) => (r + c) % 2 === 0,
    (r) => r % 2 === 0,
    (r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ][k];
}

// BCH per format info (15 bit) e version info (18 bit)
function bch(data, gen, deg) {
  let d = data << deg;
  const bit = (x) => { let b = -1; while (x) { x >>= 1; b++; } return b; };
  while (bit(d) >= deg) d ^= gen << (bit(d) - deg);
  return d;
}
function formatBits(mask) {
  const data = (0b00 << 3) | mask;           // livello M = 00
  const bits = ((data << 10) | bch(data, 0b10100110111, 10)) ^ 0b101010000010010;
  return bits & 0x7FFF;
}
function versionInfoBits(v) {
  return (v << 12) | bch(v, 0b1111100100101, 12);
}
function placeFormat(m, reserved, version, mask) {
  const f = formatBits(mask);
  const n = m.length;
  const bitAt = (i) => (f >> i) & 1;
  // copia 1 (attorno al finder in alto a sx)
  for (let i = 0; i <= 5; i++) m[8][i] = bitAt(i);
  m[8][7] = bitAt(6); m[8][8] = bitAt(7); m[7][8] = bitAt(8);
  for (let i = 9; i <= 14; i++) m[14 - i][8] = bitAt(i);
  // copia 2
  for (let i = 0; i <= 7; i++) m[n - 1 - i][8] = bitAt(i);
  for (let i = 8; i <= 14; i++) m[8][n - 15 + i] = bitAt(i);
  m[n - 8][8] = 1; // dark module (ribadito)
}

// penalità per scegliere la maschera migliore (regole standard, sintetiche)
function penalty(m) {
  const n = m.length; let p = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    // regola 1: run ≥5 su righe/colonne
    if (c <= n - 5) { let same = true; for (let k = 1; k < 5; k++) if (m[r][c + k] !== m[r][c]) { same = false; break; } if (same) p += 3; }
    if (r <= n - 5) { let same = true; for (let k = 1; k < 5; k++) if (m[r + k][c] !== m[r][c]) { same = false; break; } if (same) p += 3; }
    // regola 2: blocchi 2x2
    if (r < n - 1 && c < n - 1 && m[r][c] === m[r][c + 1] && m[r][c] === m[r + 1][c] && m[r][c] === m[r + 1][c + 1]) p += 3;
  }
  return p;
}

// Matrice QR finale (boolean[][]) per un testo, scegliendo la maschera migliore.
export function qrMatrix(text, opts = {}) {
  const bytes = Array.from(new TextEncoder().encode(String(text)));
  const version = opts.version || chooseVersion(bytes.length);
  const cw = encodeData(bytes, version);
  let best = null, bestP = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const m = buildMatrix(version, cw, mask);
    const p = penalty(m);
    if (p < bestP) { bestP = p; best = m; }
  }
  return best.map(row => row.map(v => v === 1));
}

// Rende il QR come SVG (coerente con l'app: colori theme-aware via currentColor,
// sfondo trasparente/chiaro, quiet zone corretta). Semplice da mostrare ovunque.
export function qrSvg(text, { moduleSize = 6, quiet = 4, dark = '#0b0b0d', light = '#ffffff' } = {}) {
  const m = qrMatrix(text);
  const n = m.length;
  const dim = (n + quiet * 2) * moduleSize;
  let rects = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c]) {
    rects += `<rect x="${(c + quiet) * moduleSize}" y="${(r + quiet) * moduleSize}" width="${moduleSize}" height="${moduleSize}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges" role="img" aria-label="QR bonifico SEPA"><rect width="${dim}" height="${dim}" fill="${light}"/><g fill="${dark}">${rects}</g></svg>`;
}
