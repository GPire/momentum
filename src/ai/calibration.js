// ============================================================
// CALIBRAZIONE + ENSEMBLE CALIBRATO CON ASTENSIONE (W0.3)
// ============================================================
// Rende NeuroSym un RAGIONATORE, non solo un router: combina gli esperti
// (Nano/Meso/…) con soft-voting sull'INTERA distribuzione di probabilità
// (non solo il top-1), pesi di affidabilità "sopra il caso", e astensione
// quando nessuno è abbastanza sicuro. Onestà (regola #1): sono regole
// statistiche principiate e MISURATE sul bench, nessun numero inventato.
//
// Perché soft-voting batte il voto top-1: la distribuzione piena di un
// esperto porta più informazione del suo solo vincitore. Quando un esperto
// debole sbaglia MA è incerto, la sua massa di probabilità è sparsa e non
// sovrasta un esperto forte e sicuro. Il voto top-1 invece dà a un errore
// sicuro-ma-sbagliato lo stesso peso di una risposta giusta.
'use strict';

// Peso di affidabilità di un esperto: quanto fa meglio del caso (1/nClassi).
// Un modello all'80% su 8 classi (caso 12.5%) pesa molto più di uno al 55%.
// Clamp a 0: un esperto sotto il caso non vota. Fonte del numero: la metrica
// dichiarata dell'esperto (mai una peek sul test-set → niente leakage).
export function reliabilityWeight(accuracy, nClasses) {
  const chance = 1 / Math.max(2, nClasses);
  return Math.max(0, (accuracy - chance) / (1 - chance)); // "informedness", in [0,1]
}

// Soft-voting: P(c) = Σ_i w_i · probs_i(c), poi argmax. `experts` = lista di
// { allProbs:{cat:prob}, weight }. Ritorna { category, confidence, margin,
// distribution }. margin = distacco tra 1° e 2° (misura di sicurezza).
export function softVote(experts, categories) {
  const agg = {};
  for (const c of categories) agg[c] = 0;
  let wSum = 0;
  for (const e of experts) {
    const w = e.weight ?? 1;
    if (w <= 0 || !e.allProbs) continue;
    wSum += w;
    for (const c of categories) agg[c] += w * (e.allProbs[c] || 0);
  }
  if (wSum > 0) for (const c of categories) agg[c] /= wSum;

  let best = categories[0];
  for (const c of categories) if (agg[c] > agg[best]) best = c;
  let second = null;
  for (const c of categories) {
    if (c === best) continue;
    if (second === null || agg[c] > agg[second]) second = c;
  }
  const confidence = agg[best] || 0;
  const margin = confidence - (second ? agg[second] : 0);
  return { category: best, confidence, margin, distribution: agg };
}

// Ensemble calibrato con astensione. `predictions` = lista di
// { allProbs, category, confidence, accuracy } (una per esperto). `opts`:
//  - abstainBelow: se la confidenza aggregata è sotto soglia → abstain:true
//    (il chiamante può salire all'esperto pesante o chiedere all'utente:
//    "il modello capisce a priori quando rischia di sbagliare").
//  - perCatWeight: mappa opzionale {expertIndex: {cat: fattore}} da reliability
//    per-categoria (stacking leggero).
export function calibratedEnsemble(predictions, categories, opts = {}) {
  const nClasses = categories.length;
  const experts = predictions.map((p, i) => {
    let w = reliabilityWeight(p.accuracy ?? 0.5, nClasses);
    if (opts.perCatWeight && opts.perCatWeight[i]) {
      // pesa per la categoria che QUESTO esperto sta proponendo
      w *= opts.perCatWeight[i][p.category] ?? 1;
    }
    return { allProbs: p.allProbs, weight: w };
  });
  const voted = softVote(experts, categories);
  const abstain = opts.abstainBelow != null && voted.confidence < opts.abstainBelow;
  return { ...voted, abstain };
}

// Expected Calibration Error: quanto la confidenza dichiarata corrisponde
// all'accuratezza reale (0 = perfettamente calibrato). Usata per verificare
// che "80%" voglia dire davvero giusto ~80% delle volte. `samples` =
// [{ confidence, correct:bool }]. bins uniformi in [0,1].
export function expectedCalibrationError(samples, nBins = 10) {
  if (!samples.length) return 0;
  const bins = Array.from({ length: nBins }, () => ({ n: 0, conf: 0, acc: 0 }));
  for (const s of samples) {
    const b = Math.min(nBins - 1, Math.floor(s.confidence * nBins));
    bins[b].n++; bins[b].conf += s.confidence; bins[b].acc += s.correct ? 1 : 0;
  }
  let ece = 0;
  for (const b of bins) {
    if (!b.n) continue;
    ece += (b.n / samples.length) * Math.abs(b.acc / b.n - b.conf / b.n);
  }
  return ece;
}
