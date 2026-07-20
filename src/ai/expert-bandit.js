// ============================================================
// EXPERT BANDIT — Wave 13 v10, Momentum Core v4 (Meta-Bandit Ensemble)
// ============================================================
// Riusa il motore bandit generico di src/predict/advisor-bandit.js
// (Beta-Bernoulli, Laplace-equivalente) applicandolo alla SELEZIONE DEGLI
// ESPERTI dell'orchestratore: non "quale nudge mostrare all'utente" ma
// "quale cervello ascoltare, in QUESTO contesto" — categoria x
// lunghezza-descrizione x tier-hardware. Più fine della precisione flat
// per-categoria già in modelStats (orchestrator.js _measuredReliability),
// che non distingue una descrizione di 3 parole da un estratto conto rumoroso
// di 40 caratteri, né un device minimo da uno potente.
//
// Onestà (regola #1): è un FATTORE MOLTIPLICATIVO AGGIUNTIVO, non sostituisce
// il voto Laplace esistente (che resta il prior grosso-grana per categoria).
// A freddo (0 osservazioni) il fattore è 1.0 → comportamento IDENTICO alla
// v3 attuale, bit per bit. Usa SOLO la media a posteriori (armMean), MAI
// Thompson sampling: orchestrator.classify() deve restare deterministico a
// parità di stato (i test lo richiedono) — l'esplorazione randomizzata è
// cosa da advisor (mostrare nudge diversi tra un render e l'altro va bene),
// non da un classificatore che deve dare la stessa risposta alla stessa domanda.
'use strict';

import { initBandit, banditObserve, armMean } from '../predict/advisor-bandit.js';

// Bucket di lunghezza descrizione: una frase breve ("Bar") e un estratto
// conto rumoroso ("PAGAMENTO POS CARTA *4412 RISTORANTE DA MARIO SRL") sono
// domini diversi per un classificatore di testo — vale la pena distinguerli.
export function lengthBucket(description = '') {
  const n = String(description || '').trim().length;
  return n < 15 ? 'short' : n <= 40 ? 'mid' : 'long';
}

export function expertContext(category, description, tier = 'medio') {
  return `${category || '?'}|${lengthBucket(description)}|${tier || 'medio'}`;
}

// Fattore moltiplicativo analogo a (0.5 + reliability) già in orchestrator.js:
// neutro (×1.0) senza dati, fino a ×1.5 per un esperto sempre giusto in
// questo contesto fine, giù verso ×0.5 per uno che lì sbaglia sempre.
export function expertWeightFactor(state, context, source) {
  return 0.5 + armMean(state, { context, kind: source });
}

// Osserva l'esito ex-post (quando arriva la conferma/correzione utente):
// stesso segnale già usato da modelStats, in più al contesto fine.
export function observeExpertOutcome(state, { context, source, correct }) {
  return banditObserve(state && state.arms ? state : initBandit(), { context, kind: source, reward: correct ? 1 : 0 });
}

export { initBandit as initExpertBandit };
