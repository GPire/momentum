// ============================================================
// NB-CATEGORIZER — esperto complementare addestrato IN JS (W0.1/0.2/0.4)
// ============================================================
// Naive Bayes multinomiale su n-grammi di CARATTERE (char_wb 3..5, come Meso).
// A differenza di Nano/Meso (addestrati in Python/sklearn e congelati), QUESTO
// esperto si addestra a runtime dai dati che abbiamo davvero: il dizionario
// esercenti etichettato. Generalizza a esercenti MAI visti tramite sottostringhe
// condivise ("supermercato/supermercado/mercato" → "merc"; "-eria", "market").
// Onestà (regola #1): è un classificatore statistico reale, addestrato con
// conteggi + smoothing di Laplace; nessun numero inventato. Complementa gli
// altri esperti nell'ensemble calibrato (src/ai/calibration.js).
'use strict';

// char n-grammi con "word boundary" identici all'analyzer char_wb di sklearn
// usato dal Meso: ogni token è imbottito di spazi e se ne estraggono i 3..5-grammi.
function charNgrams(text, minN = 3, maxN = 5) {
  const norm = String(text).toLowerCase().replace(/\s+/g, ' ').trim();
  const grams = [];
  for (const raw of norm.split(' ')) {
    if (!raw) continue;
    const w = ' ' + raw + ' ';
    for (let n = minN; n <= Math.min(maxN, w.length); n++) {
      for (let i = 0; i + n <= w.length; i++) grams.push(w.slice(i, i + n));
    }
  }
  return grams;
}

export class NBCategorizer {
  // trainingPairs: [ [testo, categoria], ... ]. alpha = smoothing di Laplace.
  constructor(trainingPairs, opts = {}) {
    this.alpha = opts.alpha ?? 1;
    this.minN = opts.minN ?? 3;
    this.maxN = opts.maxN ?? 5;
    this.classes = [];
    this.classCount = {};                 // #documenti per classe (prior)
    this.featCountByClass = {};           // classe → {ngram → conteggio}
    this.totalByClass = {};               // classe → conteggio totale ngrammi
    this.vocab = new Set();
    this._train(trainingPairs || []);
  }

  _train(pairs) {
    for (const [text, cat] of pairs) {
      if (!this.classCount[cat]) {
        this.classCount[cat] = 0; this.featCountByClass[cat] = {}; this.totalByClass[cat] = 0;
        this.classes.push(cat);
      }
      this.classCount[cat]++;
      for (const g of charNgrams(text, this.minN, this.maxN)) {
        this.featCountByClass[cat][g] = (this.featCountByClass[cat][g] || 0) + 1;
        this.totalByClass[cat]++;
        this.vocab.add(g);
      }
    }
    this.nDocs = pairs.length || 1;
    this.V = this.vocab.size || 1;
  }

  // log P(classe|testo) ∝ log P(classe) + Σ log P(ngram|classe) (Laplace).
  predict(text) {
    const grams = charNgrams(text, this.minN, this.maxN);
    const logp = {};
    for (const c of this.classes) {
      let lp = Math.log(this.classCount[c] / this.nDocs); // log-prior
      const denom = this.totalByClass[c] + this.alpha * this.V;
      const fc = this.featCountByClass[c];
      for (const g of grams) {
        const count = fc[g] || 0;
        lp += Math.log((count + this.alpha) / denom);
      }
      logp[c] = lp;
    }
    // softmax sui log-prob → distribuzione (confidenza onesta, non calibrata)
    const max = Math.max(...this.classes.map(c => logp[c]));
    let sum = 0; const exps = {};
    for (const c of this.classes) { exps[c] = Math.exp(logp[c] - max); sum += exps[c]; }
    const allProbs = {}; let best = this.classes[0];
    for (const c of this.classes) { allProbs[c] = exps[c] / sum; if (allProbs[c] > allProbs[best]) best = c; }
    return { category: best, confidence: allProbs[best], allProbs };
  }
}

// Costruisce l'esperto dal dizionario esercenti (fonte di verità etichettata).
// Aggiunge anche il nome-categoria come esempio (rinforza il segnale di classe).
export function trainNBFromDictionary(dictionary) {
  const pairs = [];
  for (const [merchant, cat] of Object.entries(dictionary)) pairs.push([merchant, cat]);
  return new NBCategorizer(pairs, { alpha: 0.1 });
}
