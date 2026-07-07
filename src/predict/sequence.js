// ============================================================
// MODELLO DI SEQUENZA TEMPORALE — il segnale PREDITTIVO/anticipatorio
// ============================================================
// Onestà tecnica (regola #1): è una catena di Markov d'ordine 1 sulle
// categorie, con lisciatura di Laplace — statistica trasparente, non un
// "transformer". Bias induttivo DIVERSO dai classificatori di testo: non
// chiede "che categoria è questo testo?" ma "dopo la categoria X, quale
// di solito segue?". Complementare a context-predictor.js (che misura il
// ritmo ora/giorno): qui conta l'ORDINE, non l'orario.
//
// Neutro senza dati (mai inventare): con storia insufficiente ritorna una
// distribuzione uniforme dichiarata. Funzioni pure (pattern engines.js).
'use strict';

// Costruisce il modello dalle transazioni: conteggi di transizione
// prevCat → nextCat sulle transazioni ORDINATE per data, + prior unigramma.
export function buildSequenceModel(allTx, opts = {}) {
  const onlyType = opts.type ?? 'uscita'; // le entrate spezzano la sequenza di spesa
  const txs = Object.values(allTx || {}).flat()
    .filter(t => !onlyType || t.type === onlyType)
    .filter(t => t.category && t.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const trans = {};      // prevCat -> { nextCat: count }
  const unigram = {};    // cat -> count
  const cats = new Set();
  for (const t of txs) { unigram[t.category] = (unigram[t.category] || 0) + 1; cats.add(t.category); }
  for (let i = 1; i < txs.length; i++) {
    const prev = txs[i - 1].category, next = txs[i].category;
    (trans[prev] = trans[prev] || {})[next] = (trans[prev][next] || 0) + 1;
  }
  return { trans, unigram, cats: [...cats], n: txs.length };
}

// Predice la prossima categoria dato l'ultima. Combina la probabilità di
// transizione (Markov + Laplace) col prior unigramma quando la riga è povera.
// Ritorna { top, confidence, ranked:[{category, prob}] } — sempre spiegabile.
export function predictNext(model, prevCat, opts = {}) {
  const alpha = opts.alpha ?? 1;           // lisciatura di Laplace
  const cats = model.cats;
  if (!cats || cats.length === 0) return { top: null, confidence: 0, ranked: [] };

  const row = model.trans[prevCat] || {};
  const rowTotal = Object.values(row).reduce((s, v) => s + v, 0);
  const denom = rowTotal + alpha * cats.length;

  // Se non abbiamo mai visto prevCat come predecessore, la sequenza non
  // informa: si ricade sul prior unigramma (comportamento neutro dichiarato).
  const uniTotal = Object.values(model.unigram).reduce((s, v) => s + v, 0) || 1;
  const useUnigram = rowTotal === 0;

  const ranked = cats.map(c => {
    const prob = useUnigram
      ? (model.unigram[c] || 0) / uniTotal
      : ((row[c] || 0) + alpha) / denom;
    return { category: c, prob: +prob.toFixed(4) };
  }).sort((a, b) => b.prob - a.prob);

  const top = ranked[0];
  // Confidenza = quanto la distribuzione è concentrata sul primo (0 = uniforme).
  const uniform = 1 / cats.length;
  const confidence = top ? +Math.max(0, (top.prob - uniform) / (1 - uniform)).toFixed(4) : 0;
  return { top: top ? top.category : null, confidence, ranked, fromSequence: !useUnigram };
}
