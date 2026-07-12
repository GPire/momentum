// ============================================================
// HASHED LOGREG — modello discriminativo addestrabile IN LOCALE (JS puro)
// ============================================================
// Risposta reale a "riaddestrare i modelli in locale senza Python": un
// classificatore a regressione logistica multinomiale (softmax) su feature
// HASHATE (word 1-2gram + char 3-5gram → dimensione fissa via hashing trick).
// Addestrabile e riaddestrabile interamente in Node — nessuna dipendenza
// Python, pesi salvabili in JSON compatto. Onestà (regola #1): è un modello
// statistico discriminativo reale, addestrato per discesa del gradiente su
// dati misurati; ogni metrica è quella dello script, mai a mano.
//
// Perché hashing trick: niente vocabolario gigante da salvare; dimensione D
// fissa → memoria costante; generalizza a esercenti mai visti via sottostringhe.
'use strict';

// FNV-1a 32-bit: hash veloce e deterministico di una stringa.
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function wordTokens(text) {
  const words = (text.toLowerCase().match(/\b\w\w+\b/g)) || [];
  const out = [...words];
  for (let i = 0; i < words.length - 1; i++) out.push(words[i] + '_' + words[i + 1]);
  return out;
}
function charTokens(text, minN = 3, maxN = 5) {
  const norm = text.toLowerCase().replace(/\s+/g, ' ').trim();
  const out = [];
  for (const raw of norm.split(' ')) {
    if (!raw) continue;
    const w = ' ' + raw + ' ';
    for (let n = minN; n <= Math.min(maxN, w.length); n++)
      for (let i = 0; i + n <= w.length; i++) out.push('#' + w.slice(i, i + n));
  }
  return out;
}

// Feature hashing con segno (riduce il bias da collisioni): ogni token va in
// un indice [0,D) e contribuisce con ±1. Ritorna vettore sparso L2-normalizzato
// come Map(index→value). Condiviso IDENTICO tra training e inferenza.
export function hashFeatures(text, dim = 8192) {
  const toks = [...wordTokens(text), ...charTokens(text)];
  const vec = new Map();
  for (const t of toks) {
    const h = fnv1a(t);
    const idx = h % dim;
    const sign = (h & 0x80000000) ? -1 : 1; // bit alto → segno
    vec.set(idx, (vec.get(idx) || 0) + sign);
  }
  let norm = 0; for (const v of vec.values()) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  for (const [k, v] of vec) vec.set(k, v / norm);
  return vec;
}

function softmax(logits) {
  const max = Math.max(...logits);
  const ex = logits.map(v => Math.exp(v - max));
  const s = ex.reduce((a, b) => a + b, 0);
  return ex.map(v => v / s);
}

export class HashedLogReg {
  // model = { W:Float32Array(dim*nClasses) o number[][], b:number[], classes, dim }
  constructor(model) {
    this.dim = model.dim;
    this.classes = model.classes;
    this.nC = model.classes.length;
    this.b = model.b;
    // W memorizzato come array piatto dim*nC per compattezza
    this.W = model.W;
  }

  _logits(vec) {
    const logits = this.b.slice();
    for (const [idx, val] of vec) {
      const base = idx * this.nC;
      for (let c = 0; c < this.nC; c++) logits[c] += val * this.W[base + c];
    }
    return logits;
  }

  predict(text) {
    const vec = hashFeatures(text, this.dim);
    const probs = softmax(this._logits(vec));
    let best = 0; for (let c = 1; c < this.nC; c++) if (probs[c] > probs[best]) best = c;
    const allProbs = {}; this.classes.forEach((c, i) => { allProbs[c] = probs[i]; });
    return { category: this.classes[best], confidence: probs[best], allProbs };
  }

  static async load(url) {
    const res = await fetch(url);
    const json = await res.json();
    return new HashedLogReg(json);
  }
}

// TRAINER (discesa del gradiente, SGD con L2). Ritorna il modello serializzabile.
// pairs: [[testo, categoria], ...]. Eseguibile in Node (script) o nel browser.
export function trainHashedLogReg(pairs, opts = {}) {
  const dim = opts.dim ?? 8192;
  const epochs = opts.epochs ?? 25;
  const lr0 = opts.lr ?? 0.5;
  const l2 = opts.l2 ?? 1e-5;
  const seed = opts.seed ?? 42;

  const classes = [...new Set(pairs.map(p => p[1]))].sort();
  const classIndex = Object.fromEntries(classes.map((c, i) => [c, i]));
  const nC = classes.length;
  const W = new Float32Array(dim * nC); // init a 0
  const b = new Array(nC).fill(0);

  // pre-calcolo delle feature (una volta) per velocità
  const data = pairs.map(([text, cat]) => ({ vec: hashFeatures(text, dim), y: classIndex[cat] }));

  // RNG deterministico per lo shuffle (riproducibilità → numeri onesti)
  let s = seed >>> 0;
  const rnd = () => { s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 1) >>> 0; return s / 4294967296; };
  const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } };

  const order = data.map((_, i) => i);
  for (let ep = 0; ep < epochs; ep++) {
    shuffle(order);
    const lr = lr0 / (1 + 0.05 * ep); // decadimento del learning rate
    for (const i of order) {
      const { vec, y } = data[i];
      // forward
      const logits = b.slice();
      for (const [idx, val] of vec) { const base = idx * nC; for (let c = 0; c < nC; c++) logits[c] += val * W[base + c]; }
      const p = softmax(logits);
      // gradiente (softmax - onehot); update solo sulle feature attive
      for (let c = 0; c < nC; c++) {
        const g = p[c] - (c === y ? 1 : 0);
        b[c] -= lr * g;
        for (const [idx, val] of vec) {
          const wi = idx * nC + c;
          W[wi] -= lr * (g * val + l2 * W[wi]);
        }
      }
    }
  }
  return { W: Array.from(W), b, classes, dim };
}
