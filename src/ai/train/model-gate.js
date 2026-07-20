// ============================================================
// MODEL GATE — Wave 6 v10: nessun modello sostituisce quello in
// produzione senza un confronto MISURATO su dati mai visti.
// ============================================================
// Risponde al killer #1 di retention del settore ("update rotti" — Revolut
// 4.68→3.69, Money Pro crash): un retrain che sembra migliore in media puo'
// nascondere un crollo su UNA categoria specifica. Questo modulo confronta
// baseline vs candidato su ENTRAMBI gli assi — globale e per-categoria — e
// blocca la sostituzione se una categoria crolla, anche se la media sale.
// Funzioni pure, nessun DOM, nessuna scrittura file (quella e' del runner
// bench/model-regression.mjs).
'use strict';

// Valuta un modello (con .predict(text) -> {category}) su un dataset
// [{text, cat}]. Ritorna accuratezza globale + per categoria + n totale.
// Mai un numero su un dataset vuoto: n=0 -> acc null, esplicito.
export function evalReport(model, dataset = [], categories = null) {
  if (!dataset.length) return { acc: null, perCat: {}, n: 0 };
  const buckets = {};
  let correct = 0;
  for (const { text, cat } of dataset) {
    const pred = model.predict(text).category;
    const b = buckets[cat] = buckets[cat] || { right: 0, total: 0 };
    b.total++;
    if (pred === cat) { b.right++; correct++; }
  }
  const perCat = {};
  for (const [cat, b] of Object.entries(buckets)) perCat[cat] = +(100 * b.right / b.total).toFixed(2);
  if (categories) for (const cat of categories) if (!(cat in perCat)) perCat[cat] = null; // categoria attesa ma assente dal dataset: esplicito, non 0 finto
  return { acc: +(100 * correct / dataset.length).toFixed(2), perCat, n: dataset.length };
}

// Confronta baseline (modello in produzione) vs candidato (nuovo addestramento).
// pass SOLO se: (1) l'accuratezza globale non e' scesa oltre epsilon punti E
// (2) NESSUNA categoria e' scesa oltre maxPerCatDrop punti — anche se la
// media sale. Una media che sale mentre una categoria crolla e' esattamente
// il tipo di regressione silenziosa che un test aggregato non vede.
export function compareModels(baselineReport, candidateReport, { epsilon = 0.3, maxPerCatDrop = 3.0 } = {}) {
  const reasons = [];
  if (baselineReport.acc == null || candidateReport.acc == null) {
    return { pass: false, reasons: ['dataset di valutazione vuoto: nulla da confrontare'], worstCat: null, worstDrop: 0 };
  }
  const globalOk = candidateReport.acc >= baselineReport.acc - epsilon;
  if (!globalOk) reasons.push(`accuratezza globale scesa: ${baselineReport.acc}% → ${candidateReport.acc}% (oltre epsilon=${epsilon})`);

  let worstDrop = 0, worstCat = null;
  for (const [cat, before] of Object.entries(baselineReport.perCat)) {
    const after = candidateReport.perCat[cat];
    if (before == null || after == null) continue; // categoria non valutabile in uno dei due: non giudicabile
    const drop = before - after;
    if (drop > worstDrop) { worstDrop = drop; worstCat = cat; }
  }
  const perCatOk = worstDrop <= maxPerCatDrop;
  if (!perCatOk) reasons.push(`categoria "${worstCat}" scesa di ${worstDrop.toFixed(2)} punti (oltre maxPerCatDrop=${maxPerCatDrop})`);

  return { pass: globalOk && perCatOk, reasons, worstCat, worstDrop: +worstDrop.toFixed(2) };
}
