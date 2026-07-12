// ============================================================
// EVOLUZIONE DELLE STRATEGIE — le strategie dei grandi si PERSONALIZZANO
// ============================================================
// Sezione 4.2 del blueprint, resa REALE e onesta: ogni esito noto di una
// decisione d'investimento aggiorna un track-record per FATTORE (value/growth/
// momentum/risk/reflexivity). Il sistema impara quale strategia funziona
// meglio per QUESTO utente in QUESTO periodo, e ne modula il peso nell'arbitro.
// Stessa disciplina della matrice di affidabilità dell'orchestratore (modelStats):
// lisciatura di Laplace → neutro senza dati (nessuna invenzione), fino a
// premiare/penalizzare col misurato. Funzioni pure. NON è consulenza né una
// promessa: è misura del passato personale.
'use strict';

// Stato iniziale del track-record (serializzabile → vive nel vault).
export function createStrategyPerf() {
  return { value: { right: 0, wrong: 0 }, growth: { right: 0, wrong: 0 }, momentum: { right: 0, wrong: 0 }, risk: { right: 0, wrong: 0 }, reflexivity: { right: 0, wrong: 0 } };
}

// Registra l'esito di una decisione. `factorScores` = { value, growth, ... }
// (gli score AL MOMENTO della decisione, 0..1). `favorable` = true se l'esito
// è andato bene (es. l'asset è salito dopo un "compra"). Ogni fattore che
// era CONVINTO (score > 0.55) viene premiato se l'esito è favorevole, punito
// se sfavorevole; i fattori neutri non muovono il loro record.
export function updateStrategyPerf(perf, factorScores, favorable) {
  const p = perf || createStrategyPerf();
  for (const f of Object.keys(p)) {
    const s = factorScores[f];
    if (typeof s !== 'number') continue;
    if (s > 0.55) { if (favorable) p[f].right++; else p[f].wrong++; }
    else if (s < 0.45) { if (!favorable) p[f].right++; else p[f].wrong++; } // "evita" corretto = giusto
  }
  return p;
}

// Affidabilità misurata di un fattore per questo utente (Laplace): senza
// dati = 0.5 (neutro). Il moltiplicatore (0.5 + affidabilità) lascia i pesi
// ESATTAMENTE invariati finché non c'è storia — l'evoluzione non inventa.
export function factorReliability(perf, factor) {
  const c = perf?.[factor];
  if (!c) return 0.5;
  return (c.right + 1) / (c.right + c.wrong + 2);
}

// Pesi personalizzati: parte dai pesi-per-regime (REGIME_WEIGHTS) e li
// modula con l'affidabilità misurata per l'utente, poi rinormalizza a somma 1.
// Con perf vuoto → identico ai pesi base (retro-compatibile).
export function personalizeWeights(baseWeights, perf) {
  const factors = Object.keys(baseWeights);
  const adj = {};
  let sum = 0;
  for (const f of factors) {
    adj[f] = baseWeights[f] * (0.5 + factorReliability(perf, f)); // ×1.0 neutro, ×1.5 max, ×0.5 min
    sum += adj[f];
  }
  if (sum > 0) for (const f of factors) adj[f] = +(adj[f] / sum).toFixed(4);
  return adj;
}
