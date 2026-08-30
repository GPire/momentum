

// ============================================================
// MOMENTUM TRAINED INFERENCE — v1.0
// ============================================================
// Carica ed esegue in JS puro (nessuna dipendenza Python in
// produzione) il modello addestrato realmente con scikit-learn
// (train_categorizer.py → momentum_trained_model.json).
// Reimplementa TF-IDF + MLP forward pass in modo IDENTICO
// all'implementazione sklearn, verificato con cross-check numerico
// diretto contro l'output Python (vedi verify_inference.py).
// ============================================================
'use strict';

import { quantizeModel, matmulQuantized } from './quantize.js';

class TrainedCategorizer {
  constructor(modelJson, opts = {}) {
    this.vocabulary = modelJson.vocabulary;
    this.idf = modelJson.idf;
    this.categories = modelJson.categories;
    this.coefs = modelJson.coefs;           // [W1(nFeat x hidden), W2(hidden x nCat)]
    this.intercepts = modelJson.intercepts; // [b1(hidden), b2(nCat)]
    this.metrics = modelJson.metrics;
    this.vocabSize = Object.keys(this.vocabulary).length;
    // Feature a caratteri (opzionale, retrocompatibile — 2026-08-30): un
    // vocabolario SOLO a parole non generalizza mai a typo/abbreviazioni
    // ("amzn" non condivide nessun token con "amazon"), motivo reale per
    // cui LogReg (hashed-logreg.js: word+char hashati insieme) e Meso
    // (trained-meso.js: stesso principio con vocabolario esplicito)
    // generalizzano meglio del Nano sullo stesso held-out. Un modello
    // vecchio senza char_vocabulary continua a funzionare identico a
    // prima: charVocabSize resta 0, _featureVector() equivale a
    // _tfidfVector() word-only.
    this.charVocabulary = modelJson.char_vocabulary || null;
    this.charIdf = modelJson.char_idf || null;
    this.charVocabSize = this.charVocabulary ? Object.keys(this.charVocabulary).length : 0;
    // Path int8 opzionale (src/ai/quantize.js), stesso schema già in
    // produzione per il Meso (trained-meso.js): pesi 8× più compatti in
    // memoria, dequantizzati al volo. Il Nano è l'UNICO modello attivo sul
    // tier minimo (Meso non carica nemmeno lì, vedi main.js) — è quindi il
    // caso dove la quantizzazione conta di più, non un'aggiunta simmetrica
    // per coerenza. Default 'false' (float): mai un cambio di comportamento
    // per chi già costruisce `new TrainedCategorizer(json)` senza opts.
    this.quantized = opts.int8 ? quantizeModel(this.coefs) : null;
  }

  static async load(url, opts = {}) {
    const res = await fetch(url);
    const json = await res.json();
    return new TrainedCategorizer(json, opts);
  }

  // Tokenizzazione identica a TfidfVectorizer di default (token_pattern
  // standard sklearn: sequenze di 2+ caratteri alfanumerici) + bigram,
  // dato che il training ha usato ngram_range=(1,2).
  _tokenize(text) {
    const words = (text.toLowerCase().match(/\b\w\w+\b/g)) || [];
    const unigrams = words;
    const bigrams = [];
    for (let i = 0; i < words.length - 1; i++) bigrams.push(words[i] + ' ' + words[i + 1]);
    return [...unigrams, ...bigrams];
  }

  // TF-IDF con normalizzazione L2 (default sklearn: norm='l2', smooth_idf=True,
  // sublinear_tf=False — replica esatta del comportamento di TfidfVectorizer)
  _tfidfVector(text) {
    const tokens = this._tokenize(text);
    const counts = {};
    for (const t of tokens) {
      if (this.vocabulary[t] !== undefined) counts[t] = (counts[t] || 0) + 1;
    }

    const vec = new Float64Array(this.vocabSize);
    for (const [token, count] of Object.entries(counts)) {
      const idx = this.vocabulary[token];
      vec[idx] = count * this.idf[idx];
    }

    // Normalizzazione L2
    let norm = 0;
    for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm);
    if (norm > 0) for (let i = 0; i < vec.length; i++) vec[i] /= norm;

    return vec;
  }

  // Identico a trained-meso.js/_charNgrams (analyzer='char_wb' sklearn,
  // n=3..5) e a src/ai/train/mlp-trainer.mjs/charNgrams usato in training —
  // le tre implementazioni devono restare bit-per-bit identiche o il
  // vettore di training e quello di inferenza divergono in silenzio.
  _charNgrams(text) {
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

  _charTfidfVector(text) {
    const tokens = this._charNgrams(text);
    const counts = {};
    for (const t of tokens) {
      if (this.charVocabulary[t] !== undefined) counts[t] = (counts[t] || 0) + 1;
    }
    const vec = new Float64Array(this.charVocabSize);
    for (const [token, count] of Object.entries(counts)) {
      const idx = this.charVocabulary[token];
      vec[idx] = count * this.charIdf[idx];
    }
    let norm = 0;
    for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm);
    if (norm > 0) for (let i = 0; i < vec.length; i++) vec[i] /= norm;
    return vec;
  }

  // Vettore di feature usato davvero da predict(): word-TFIDF da solo per
  // un modello vecchio/word-only (charVocabSize===0, comportamento
  // invariato), altrimenti word+char concatenati — ciascuno normalizzato
  // L2 per conto proprio PRIMA della concatenazione (np.hstack, stessa
  // scelta già in trained-meso.js), mai una seconda normalizzazione congiunta.
  _featureVector(text) {
    const wordVec = this._tfidfVector(text);
    if (!this.charVocabSize) return wordVec;
    const charVec = this._charTfidfVector(text);
    const combined = new Float64Array(wordVec.length + charVec.length);
    combined.set(wordVec, 0);
    combined.set(charVec, wordVec.length);
    return combined;
  }

  _relu(x) { return x.map(v => Math.max(0, v)); }

  _softmax(logits) {
    const max = Math.max(...logits);
    const exps = logits.map(v => Math.exp(v - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map(v => v / sum);
  }

  predict(text) {
    const x = this._featureVector(text);
    const [W1, W2] = this.coefs;
    const [b1, b2] = this.intercepts;
    const hiddenDim = W1[0].length;
    const nCat = W2[0].length;

    let h1, logits;
    if (this.quantized) {
      // Path int8: pesi quantizzati, dequantizzati al volo — stesso schema
      // già verificato in produzione per il Meso (trained-meso.js).
      const [qW1, qW2] = this.quantized;
      const acc1 = matmulQuantized(Array.from(x), qW1);
      h1 = acc1.map((v, j) => v + b1[j]);
      const a1 = this._relu(h1);
      const acc2 = matmulQuantized(a1, qW2);
      logits = acc2.map((v, k) => v + b2[k]);
    } else {
      // Layer 1: x (nFeat) · W1 (nFeat x 16) + b1 → ReLU
      h1 = new Array(hiddenDim).fill(0);
      for (let j = 0; j < hiddenDim; j++) {
        let s = b1[j];
        for (let i = 0; i < x.length; i++) s += x[i] * W1[i][j];
        h1[j] = s;
      }
      const a1 = this._relu(h1);

      // Layer 2: a1 (16) · W2 (16 x nCat) + b2 → softmax
      logits = new Array(nCat).fill(0);
      for (let k = 0; k < nCat; k++) {
        let s = b2[k];
        for (let j = 0; j < hiddenDim; j++) s += a1[j] * W2[j][k];
        logits[k] = s;
      }
    }
    const probs = this._softmax(logits);

    const idx = probs.indexOf(Math.max(...probs));
    return {
      category: this.categories[idx],
      confidence: probs[idx],
      allProbs: Object.fromEntries(this.categories.map((c, i) => [c, probs[i]])),
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TrainedCategorizer };
}



export { TrainedCategorizer };
