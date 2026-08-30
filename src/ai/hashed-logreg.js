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
// `idf` opzionale (Float array dim): pesa ogni feature per l'inverse-document-
// frequency (down-pesa gli n-grammi ubiqui) PRIMA della normalizzazione L2 —
// tecnica TF-IDF che alza l'accuratezza sulla classificazione di testo.
export function hashFeatures(text, dim = 8192, idf = null) {
  const toks = [...wordTokens(text), ...charTokens(text)];
  const vec = new Map();
  for (const t of toks) {
    const h = fnv1a(t);
    const idx = h % dim;
    const sign = (h & 0x80000000) ? -1 : 1; // bit alto → segno
    vec.set(idx, (vec.get(idx) || 0) + sign);
  }
  if (idf) for (const [k, v] of vec) vec.set(k, v * (idf[k] || 1));
  let norm = 0; for (const v of vec.values()) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  for (const [k, v] of vec) vec.set(k, v / norm);
  return vec;
}

// IDF su feature HASHATE: df[idx] = #documenti che attivano l'indice idx;
// idf = log((N+1)/(df+1)) + 1 (smoothed). Ritorna Float array [dim].
export function computeHashedIdf(pairs, dim) {
  const df = new Float64Array(dim);
  for (const [text] of pairs) {
    const seen = new Set();
    for (const t of [...wordTokens(text), ...charTokens(text)]) seen.add(fnv1a(t) % dim);
    for (const idx of seen) df[idx]++;
  }
  const N = pairs.length || 1;
  const idf = new Float32Array(dim);
  for (let i = 0; i < dim; i++) idf[i] = Math.log((N + 1) / (df[i] + 1)) + 1;
  return idf;
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
    this.idf = model.idf || null; // pesi IDF opzionali (TF-IDF), retrocompatibile
    // BUG REALE TROVATO (Cantiere C4, PIANO_TASK_2026-08-21.md): il modello
    // spedito (public/momentum_logreg_model.json) dichiara la sua accuratezza
    // MISURATA in meta.gate.candidateAcc (91,46% held-out) — ma questo
    // costruttore la scartava in silenzio, tenendo solo i pesi numerici.
    // orchestrator.js non aveva quindi MAI potuto leggere il numero vero,
    // ed era condannato al suo fallback fisso (0,80) anche se il modello
    // reale è più forte. Stesso principio già applicato a TrainedMeso
    // (trained-meso.js: this.metrics = modelJson.metrics).
    this.meta = model.meta || null;
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
    const vec = hashFeatures(text, this.dim, this.idf);
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
// optimizer: 'sgd' (default, invariato) o 'adam' (Kingma & Ba 2014,
// arXiv:1412.6980) — stesso principio già misurato sul Meso (mlp-trainer.mjs):
// SGD per-esempio (non a minibatch) ha un gradiente rumoroso ad ogni singolo
// aggiornamento; Adam mantiene momento (m) e varianza (v) per parametro, che
// smorzano quel rumore. Con 'adam' usare un learning rate molto più basso
// (0.001-0.005) di quello SGD di default (0.5) — scale diverse per natura.
export function trainHashedLogReg(pairs, opts = {}) {
  const dim = opts.dim ?? 8192;
  const epochs = opts.epochs ?? 25;
  const lr0 = opts.lr ?? 0.5;
  const l2 = opts.l2 ?? 1e-5;
  const seed = opts.seed ?? 42;
  const useAdam = opts.optimizer === 'adam';
  const ADAM_B1 = 0.9, ADAM_B2 = 0.999, ADAM_EPS = 1e-8;
  let adamT = 0;

  const classes = [...new Set(pairs.map(p => p[1]))].sort();
  const classIndex = Object.fromEntries(classes.map((c, i) => [c, i]));
  const nC = classes.length;
  const W = new Float32Array(dim * nC); // init a 0
  const b = new Array(nC).fill(0);
  const mW = useAdam ? new Float64Array(dim * nC) : null;
  const vW = useAdam ? new Float64Array(dim * nC) : null;
  const mb = useAdam ? new Array(nC).fill(0) : null;
  const vb = useAdam ? new Array(nC).fill(0) : null;

  // IDF opzionale (TF-IDF): calcolato UNA volta dal train, applicato alle
  // feature e salvato nel modello (usato identico in inferenza).
  const idf = opts.useIdf ? computeHashedIdf(pairs, dim) : null;
  // pre-calcolo delle feature (una volta) per velocità
  const data = pairs.map(([text, cat]) => ({ vec: hashFeatures(text, dim, idf), y: classIndex[cat] }));

  // RNG deterministico per lo shuffle (riproducibilità → numeri onesti)
  let s = seed >>> 0;
  const rnd = () => { s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 1) >>> 0; return s / 4294967296; };
  const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } };

  const order = data.map((_, i) => i);
  for (let ep = 0; ep < epochs; ep++) {
    shuffle(order);
    const lr = lr0 / (1 + 0.05 * ep); // decadimento del learning rate
    for (const i of order) {
      adamT++;
      const { vec, y } = data[i];
      // forward
      const logits = b.slice();
      for (const [idx, val] of vec) { const base = idx * nC; for (let c = 0; c < nC; c++) logits[c] += val * W[base + c]; }
      const p = softmax(logits);
      // gradiente (softmax - onehot); update solo sulle feature attive
      for (let c = 0; c < nC; c++) {
        const g = p[c] - (c === y ? 1 : 0);
        if (useAdam) {
          const mbc = ADAM_B1 * mb[c] + (1 - ADAM_B1) * g;
          const vbc = ADAM_B2 * vb[c] + (1 - ADAM_B2) * g * g;
          mb[c] = mbc; vb[c] = vbc;
          const mHat = mbc / (1 - ADAM_B1 ** adamT), vHat = vbc / (1 - ADAM_B2 ** adamT);
          b[c] -= lr * mHat / (Math.sqrt(vHat) + ADAM_EPS);
        } else {
          b[c] -= lr * g;
        }
        for (const [idx, val] of vec) {
          const wi = idx * nC + c;
          const gw = g * val + l2 * W[wi];
          if (useAdam) {
            const m = ADAM_B1 * mW[wi] + (1 - ADAM_B1) * gw;
            const v = ADAM_B2 * vW[wi] + (1 - ADAM_B2) * gw * gw;
            mW[wi] = m; vW[wi] = v;
            const mHat = m / (1 - ADAM_B1 ** adamT), vHat = v / (1 - ADAM_B2 ** adamT);
            W[wi] -= lr * mHat / (Math.sqrt(vHat) + ADAM_EPS);
          } else {
            W[wi] -= lr * gw;
          }
        }
      }
    }
  }
  const out = { W: Array.from(W), b, classes, dim };
  if (idf) out.idf = Array.from(idf);
  return out;
}
