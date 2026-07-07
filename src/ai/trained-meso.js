// ============================================================
// MOMENTUM MESO — inferenza in JS puro del modello addestrato con
// scikit-learn (train_meso.py → momentum_meso_model.json).
// Stesso principio del Nano (trained-categorizer.js): pesi REALI,
// addestrati, nessuna dipendenza Python in produzione. Onestà
// dichiarata: è un classificatore statistico più capace (feature
// ibride parole+caratteri, rete a 2 strati nascosti), NON un
// transformer, NON un modello linguistico generale.
// ============================================================
'use strict';

import { quantizeModel, matmulQuantized } from './quantize.js';

class TrainedMeso {
  constructor(modelJson, opts = {}) {
    this.wordVocab = modelJson.word_vocabulary;
    this.wordIdf = modelJson.word_idf;
    this.charVocab = modelJson.char_vocabulary;
    this.charIdf = modelJson.char_idf;
    this.categories = modelJson.categories;
    this.coefs = modelJson.coefs;           // [W1, W2, ..., Wn] uno per strato
    this.intercepts = modelJson.intercepts; // [b1, b2, ..., bn]
    this.temperature = modelJson.temperature || 1.0; // calibrazione confidenza (v3)
    this.metrics = modelJson.metrics;
    this.wordVocabSize = Object.keys(this.wordVocab).length;
    this.charVocabSize = Object.keys(this.charVocab).length;
    // Path int8 opzionale per hardware debole (src/ai/quantize.js): pesi 8×
    // più piccoli in memoria, dequantizzati al volo. Attivato dal
    // compute-planner su tier minimo. L'accuratezza cala in modo trascurabile
    // (misurato nel bench); su tier medio/alto si resta in float per la
    // massima precisione.
    this.quantized = opts.int8 ? quantizeModel(this.coefs) : null;
  }

  static async load(url, opts = {}) {
    const res = await fetch(url);
    const json = await res.json();
    return new TrainedMeso(json, opts);
  }

  // Identico a TfidfVectorizer di default (token_pattern standard sklearn:
  // sequenze di 2+ caratteri alfanumerici) + bigram, ngram_range=(1,2).
  _wordTokenize(text) {
    const words = (text.toLowerCase().match(/\b\w\w+\b/g)) || [];
    const bigrams = [];
    for (let i = 0; i < words.length - 1; i++) bigrams.push(words[i] + ' ' + words[i + 1]);
    return [...words, ...bigrams];
  }

  // Replica esatta di analyzer='char_wb' di sklearn: ogni parola (split su
  // spazi) viene "imbottita" con uno spazio ai due lati, poi se ne estraggono
  // tutti i n-grammi di caratteri per n in [min_n, max_n] (qui 3..5).
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
        while (offset + n < wLen) {
          offset++;
          ngrams.push(w.slice(offset, offset + n));
        }
        if (offset === 0) break; // parola più corta di n: contala una sola volta
      }
    }
    return ngrams;
  }

  _tfidfVector(tokens, vocabulary, idf, vocabSize) {
    const counts = {};
    for (const t of tokens) {
      if (vocabulary[t] !== undefined) counts[t] = (counts[t] || 0) + 1;
    }
    const vec = new Float64Array(vocabSize);
    for (const [token, count] of Object.entries(counts)) {
      const idx = vocabulary[token];
      vec[idx] = count * idf[idx];
    }
    let norm = 0;
    for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm);
    if (norm > 0) for (let i = 0; i < vec.length; i++) vec[i] /= norm;
    return vec;
  }

  // Le due rappresentazioni sono normalizzate L2 CIASCUNA per conto proprio
  // (come fa sklearn per ogni TfidfVectorizer indipendente) e poi concatenate
  // senza una seconda normalizzazione congiunta — replica esatta di np.hstack.
  _featureVector(text) {
    const wordVec = this._tfidfVector(this._wordTokenize(text), this.wordVocab, this.wordIdf, this.wordVocabSize);
    const charVec = this._tfidfVector(this._charNgrams(text), this.charVocab, this.charIdf, this.charVocabSize);
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

  // Forward pass generico: N strati nascosti + output, non hardcoded a 2
  // come il Nano — hidden_layer_sizes=(48,24) produce 3 matrici di pesi.
  predict(text) {
    let activation = Array.from(this._featureVector(text));
    for (let layer = 0; layer < this.coefs.length; layer++) {
      const b = this.intercepts[layer];
      let out;
      if (this.quantized) {
        // path int8: pesi quantizzati, dequantizzati al volo; poi si somma il bias
        const acc = matmulQuantized(activation, this.quantized[layer]);
        out = new Array(acc.length);
        for (let k = 0; k < acc.length; k++) out[k] = acc[k] + b[k];
      } else {
        const W = this.coefs[layer];
        const outDim = W[0].length;
        out = new Array(outDim).fill(0);
        for (let k = 0; k < outDim; k++) {
          let s = b[k];
          for (let i = 0; i < activation.length; i++) s += activation[i] * W[i][k];
          out[k] = s;
        }
      }
      const isLastLayer = layer === this.coefs.length - 1;
      activation = isLastLayer ? out : this._relu(out);
    }
    // Calibrazione a temperatura (Meso 3.0): logits/T prima del softmax rende
    // la confidenza onesta ("80%" ≈ giusto 80% delle volte). T=1 = nessun effetto.
    if (this.temperature !== 1.0) activation = activation.map(v => v / this.temperature);
    const probs = this._softmax(activation);
    const idx = probs.indexOf(Math.max(...probs));
    return {
      category: this.categories[idx],
      confidence: probs[idx],
      allProbs: Object.fromEntries(this.categories.map((c, i) => [c, probs[i]])),
    };
  }
}

export { TrainedMeso };
