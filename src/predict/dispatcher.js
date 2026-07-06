// Dispatcher a soglia: decide, per ogni transazione in ingresso, se basta un
// aggiornamento leggero o se conviene svegliare il motore pesante (Monte
// Carlo, GARCH, deduplicazione fuzzy approfondita). Funzioni pure sui dati
// (mese -> array transazioni), nessuna dipendenza da DOM: eseguibile da
// main thread, worker o test Node, come engines.js e deduplicator.js.
//
// Nota onesta: le soglie sotto sono costanti dichiarate, non "percentili
// mobili adattivi" — quella parte (tarare le soglie sull'uso reale
// dell'utente) è lavoro futuro, non ancora implementata. Meglio soglie
// fisse e trasparenti oggi che una promessa di adattività non costruita.
import { normalizeStr, descriptionSimilarity } from '../core/deduplicator.js';

const DEFAULT_WEIGHTS = { amount: 0.35, merchant: 0.2, rules: 0.3, drift: 0.15 };
const DEFAULT_THRESHOLDS = { low: 0.35, high: 0.7 };

function flattenTx(allTx) {
  return Object.values(allTx || {}).flat();
}

// z-score dell'importo rispetto alla storia della stessa categoria, capato
// a [0,1] per essere combinabile con le altre componenti.
export function amountNovelty(tx, allTx) {
  const history = flattenTx(allTx).filter(t => t.category === tx.category && t.type === tx.type);
  if (history.length < 3) return 0.3; // troppo poca storia per giudicare: novità moderata di default
  const amounts = history.map(t => t.amount);
  const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const variance = amounts.reduce((acc, v) => acc + (v - mean) ** 2, 0) / amounts.length;
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return tx.amount === mean ? 0 : 1;
  const z = Math.abs(tx.amount - mean) / stdDev;
  return Math.min(1, z / 4); // z=4 o più → novità massima
}

// Quanto è insolito il merchant/descrizione: 0 = già visto spesso in questa
// categoria, 1 = mai visto (nessun match anche approssimato).
export function merchantNovelty(tx, allTx) {
  const history = flattenTx(allTx).filter(t => t.category === tx.category);
  if (history.length === 0) return 0.5; // prima transazione della categoria: novità moderata
  let best = 0;
  for (const t of history) {
    const sim = descriptionSimilarity(t.description, tx.description);
    if (sim > best) best = sim;
  }
  return 1 - best;
}

// Regole esplicite, dichiarate e ispezionabili (non un punteggio nascosto):
// - zona grigia del deduplicatore (simile ma non abbastanza da fondere in automatico)
// - sforamento del budget mensile della categoria, se un budget è configurato
export function ruleScore(tx, allTx, opts = {}) {
  const history = flattenTx(allTx);
  const reasons = [];
  let score = 0;

  const greyZoneMatch = history.some(t => {
    const sim = descriptionSimilarity(t.description, tx.description);
    return sim >= 0.5 && sim < 0.72 && Math.abs(t.amount - tx.amount) < 0.01;
  });
  if (greyZoneMatch) { score = Math.max(score, 0.6); reasons.push('possibile_duplicato_incerto'); }

  if (opts.monthlyBudget && tx.type === 'uscita') {
    const month = (tx.date || '').slice(0, 7);
    const monthSpend = flattenTx({ [month]: allTx[month] || [] })
      .filter(t => t.type === 'uscita')
      .reduce((sum, t) => sum + t.amount, 0) + tx.amount;
    if (monthSpend > opts.monthlyBudget) { score = Math.max(score, 0.8); reasons.push('budget_sforato'); }
  }

  return { score, reasons };
}

// Scostamento tra la spesa recente (ultimi 7 giorni) e quella precedente
// (7-14 giorni fa) nella stessa categoria: un drift ampio giustifica un
// ricalcolo completo del forecast invece di aspettare il prossimo idle.
export function driftScore(tx, allTx, referenceDate = new Date(tx.date)) {
  const history = flattenTx(allTx).filter(t => t.category === tx.category && t.type === tx.type);
  if (history.length < 4) return 0;

  const ref = referenceDate.getTime();
  const DAY = 86_400_000;
  const sum = (from, to) => history
    .filter(t => { const d = new Date(t.date).getTime(); return d >= ref - to * DAY && d < ref - from * DAY; })
    .reduce((s, t) => s + t.amount, 0);

  const recent = sum(0, 7);
  const prior = sum(7, 14);
  if (prior === 0) return recent > 0 ? 1 : 0;
  return Math.min(1, Math.abs(recent - prior) / prior);
}

// Combina le quattro componenti con pesi dichiarati e instrada l'evento.
export function novelty(tx, allTx, opts = {}) {
  const weights = { ...DEFAULT_WEIGHTS, ...opts.weights };
  const thresholds = { ...DEFAULT_THRESHOLDS, ...opts.thresholds };

  const amount = amountNovelty(tx, allTx);
  const merchant = merchantNovelty(tx, allTx);
  const rules = ruleScore(tx, allTx, opts);
  const drift = driftScore(tx, allTx);

  const score = weights.amount * amount + weights.merchant * merchant + weights.rules * rules.score + weights.drift * drift;

  const route = score < thresholds.low ? 'fast' : score < thresholds.high ? 'incremental' : 'heavy';

  return {
    score: +score.toFixed(3),
    route, // 'fast' = solo aggiornamento O(1), 'incremental' = aggiorna e rimanda il ricalcolo pesante, 'heavy' = sveglia il worker ora
    components: { amount, merchant, rules: rules.score, drift },
    reasons: rules.reasons,
  };
}

export { DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS };
