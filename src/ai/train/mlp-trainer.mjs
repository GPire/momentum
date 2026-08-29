// ============================================================
// TRAINER MLP GENERICO — TF-IDF (parole e/o caratteri) + rete a N strati,
// riproducibile in JS puro (nessuna dipendenza Python in produzione).
// ============================================================
// Nano (trained-categorizer.js) e Meso (trained-meso.js) condividono la
// STESSA famiglia di modello (TF-IDF → MLP con ReLU+softmax), quindi
// condividono anche il MEDESIMO trainer qui — solo la costruzione delle
// feature (solo parole per Nano; parole+caratteri concatenati per Meso) e
// la profondità (hiddenSizes) cambiano. Prima di questo file NESSUNO dei
// due era riproducibile in questo repo (nessuno script train_*.py esiste
// qui, i pesi arrivavano già addestrati altrove) — limite dichiarato più
// volte nella memoria di progetto, colmato qui per la prima volta.
//
// Tokenizzazione/TF-IDF replicano ESATTAMENTE quanto trained-categorizer.js/
// trained-meso.js si aspettano in inferenza (stesso token_pattern sklearn,
// stesso char_wb n=3..5, stessa normalizzazione L2, stesso smooth_idf) —
// verificato dai test che confrontano un giro predict() prima/dopo.
'use strict';

export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Identico a trained-categorizer.js/_tokenize e trained-meso.js/_wordTokenize.
export function wordTokenize(text) {
  const words = (text.toLowerCase().match(/\b\w\w+\b/g)) || [];
  const bigrams = [];
  for (let i = 0; i < words.length - 1; i++) bigrams.push(words[i] + ' ' + words[i + 1]);
  return [...words, ...bigrams];
}

// Identico a trained-meso.js/_charNgrams (analyzer='char_wb' sklearn, n=3..5).
export function charNgrams(text) {
  const normalized = text.toLowerCase().replace(/\s+/g, ' ');
  const [minN, maxN] = [3, 5];
  const ngrams = [];
  for (const rawWord of normalized.split(' ')) {
    if (!rawWord) continue;
    const w = ' ' + rawWord + ' ';
    const wLen = w.length;
    for (let n = minN; n <= Math.min(maxN, wLen); n++) {
      let offset = 0;
      ngrams.push(w.slice(offset, offset + n));
      while (offset + n < wLen) { offset++; ngrams.push(w.slice(offset, offset + n)); }
      if (offset === 0) break;
    }
  }
  return ngrams;
}

// Costruisce un vocabolario {token:idx} + idf smooth (sklearn: ln((1+n)/(1+df))+1),
// tenendo solo i token con document-frequency >= minDf, capato a maxVocab
// (ordinati per df decrescente — i più informativi/comuni restano, mai un
// taglio arbitrario per posizione di scoperta).
export function buildVocabulary(texts, tokenizeFn, { minDf = 2, maxVocab = 6000 } = {}) {
  const df = new Map();
  for (const text of texts) {
    const seen = new Set(tokenizeFn(text));
    for (const tok of seen) df.set(tok, (df.get(tok) || 0) + 1);
  }
  let entries = [...df.entries()].filter(([, d]) => d >= minDf);
  entries.sort((a, b) => b[1] - a[1]);
  if (entries.length > maxVocab) entries = entries.slice(0, maxVocab);
  const vocabulary = {};
  const idf = new Array(entries.length);
  const n = texts.length;
  entries.forEach(([tok, d], i) => {
    vocabulary[tok] = i;
    idf[i] = Math.log((1 + n) / (1 + d)) + 1;
  });
  return { vocabulary, idf };
}

// Vettore TF-IDF sparso [[idx,val],...], L2-normalizzato — stessa
// normalizzazione di _tfidfVector nei due moduli di inferenza.
export function tfidfSparse(tokens, vocabulary, idf) {
  const counts = new Map();
  for (const t of tokens) {
    const idx = vocabulary[t];
    if (idx !== undefined) counts.set(idx, (counts.get(idx) || 0) + 1);
  }
  let norm = 0;
  const entries = [];
  for (const [idx, count] of counts) {
    const val = count * idf[idx];
    entries.push([idx, val]);
    norm += val * val;
  }
  norm = Math.sqrt(norm);
  if (norm > 0) for (const e of entries) e[1] /= norm;
  return entries;
}

function relu(x) { return x.map(v => Math.max(0, v)); }
function softmax(logits) {
  const max = Math.max(...logits);
  const exps = logits.map(v => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map(v => v / sum);
}

// Addestra un MLP a N strati (hiddenSizes.length strati nascosti + output)
// su feature TF-IDF sparse in ingresso. Il PRIMO strato resta sparso (solo
// gli indici attivi vengono letti/aggiornati — stesso principio di
// hashed-logreg.js, essenziale con vocabolari di migliaia di token e
// decine di migliaia di esempi); gli strati successivi sono densi ma
// piccoli (16-48 unità), nessun problema di prestazioni.
//
// examples: [{ sparse:[[idx,val],...], y: classIndex }, ...]
// Ritorna { coefs:[W1,...,Wn] (annidati number[][]), intercepts:[b1,...,bn] }.
export function trainMLP({ examples, inputDim, nClasses, hiddenSizes = [16], epochs = 30, lr = 0.3, l2 = 1e-5, seed = 42, onEpoch = null }) {
  const rnd = mulberry32(seed);
  const gauss = () => { // Box-Muller, per un'inizializzazione He più sana di uniform(-1,1)
    let u = 0, v = 0;
    while (u === 0) u = rnd();
    while (v === 0) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const dims = [inputDim, ...hiddenSizes, nClasses];
  const nLayers = dims.length - 1;

  // Strato 0 (sparso, grande): flat Float64Array per velocità in training.
  const W0 = new Float64Array(dims[0] * dims[1]);
  const he0 = Math.sqrt(2 / dims[0]);
  for (let i = 0; i < W0.length; i++) W0[i] = gauss() * he0;
  const b = dims.slice(1).map(d => new Array(d).fill(0));

  // Strati successivi (densi, piccoli): number[][] annidati fin da subito.
  const Wrest = [];
  for (let l = 1; l < nLayers; l++) {
    const he = Math.sqrt(2 / dims[l]);
    const W = Array.from({ length: dims[l] }, () => Array.from({ length: dims[l + 1] }, () => gauss() * he));
    Wrest.push(W);
  }

  const order = examples.map((_, i) => i);
  const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } };

  for (let ep = 0; ep < epochs; ep++) {
    shuffle(order);
    const lrEp = lr / (1 + 0.04 * ep);
    for (const idx of order) {
      const { sparse, y } = examples[idx];
      const h1dim = dims[1];

      // ── forward strato 0 (sparso) ──
      const pre0 = b[0].slice();
      for (const [fi, val] of sparse) {
        const base = fi * h1dim;
        for (let j = 0; j < h1dim; j++) pre0[j] += val * W0[base + j];
      }
      const acts = [relu(pre0)];
      const pres = [pre0];

      // ── forward strati successivi (densi) ──
      for (let l = 1; l < nLayers; l++) {
        const W = Wrest[l - 1], bl = b[l];
        const prevAct = acts[l - 1];
        const outDim = dims[l + 1];
        const pre = bl.slice();
        for (let i = 0; i < prevAct.length; i++) {
          const wi = W[i];
          const ai = prevAct[i];
          if (ai === 0) continue;
          for (let k = 0; k < outDim; k++) pre[k] += ai * wi[k];
        }
        pres.push(pre);
        acts.push(l === nLayers - 1 ? pre : relu(pre)); // ultimo strato: logits grezzi (softmax dopo)
      }

      const logits = acts[acts.length - 1];
      const probs = softmax(logits);
      let dOut = probs.slice();
      dOut[y] -= 1; // gradiente softmax+cross-entropy

      // ── backward strati densi (dal fondo verso lo strato 1) ──
      let dNext = dOut;
      for (let l = nLayers - 1; l >= 1; l--) {
        const W = Wrest[l - 1], bl = b[l];
        const prevAct = acts[l - 1];
        const outDim = dNext.length;
        const dPrev = new Array(prevAct.length).fill(0);
        for (let i = 0; i < prevAct.length; i++) {
          const wi = W[i];
          const ai = prevAct[i];
          let s = 0;
          for (let k = 0; k < outDim; k++) {
            s += wi[k] * dNext[k];
            wi[k] -= lrEp * (dNext[k] * ai + l2 * wi[k]);
          }
          dPrev[i] = s;
        }
        for (let k = 0; k < outDim; k++) bl[k] -= lrEp * dNext[k];
        // ReLU'(pre_{l-1}) applicato scendendo verso lo strato precedente
        const preHere = pres[l - 1];
        for (let i = 0; i < dPrev.length; i++) if (preHere[i] <= 0) dPrev[i] = 0;
        dNext = dPrev;
      }

      // ── backward strato 0 (sparso: solo gli indici attivi) ──
      for (const [fi, val] of sparse) {
        const base = fi * h1dim;
        for (let j = 0; j < h1dim; j++) W0[base + j] -= lrEp * (dNext[j] * val + l2 * W0[base + j]);
      }
      for (let j = 0; j < h1dim; j++) b[0][j] -= lrEp * dNext[j];
    }
    // SGD per-esempio su un corpus di decine di migliaia di righe può
    // "dimenticare" una classe rara in un'epoca sfortunata (interferenza
    // catastrofica) e poi non riprendersi più — misurato dal vivo su questo
    // stesso corpus. onEpoch permette a chi chiama di misurare su un set
    // held-out ad ogni epoca e tenere lo snapshot migliore, invece di
    // fidarsi ciecamente dell'ultima epoca.
    if (onEpoch) onEpoch(ep, snapshot());
  }

  function snapshot() {
    const W0nested = Array.from({ length: dims[0] }, (_, i) => Array.from(W0.subarray(i * dims[1], (i + 1) * dims[1])));
    const bCopy = b.map(layer => layer.slice());
    const WrestCopy = Wrest.map(W => W.map(row => row.slice()));
    return { coefs: [W0nested, ...WrestCopy], intercepts: bCopy };
  }

  return snapshot();
}
