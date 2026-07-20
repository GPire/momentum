// ============================================================
// META-FEDERATION — Wave 15 v10, Mesh v2
// ============================================================
// Condivide via mesh SOLO i metadati aggregati "quale esperto è risultato
// affidabile per quale contesto" tra dispositivi — MAI i dati grezzi, MAI le
// transazioni, MAI i pesi completi del modello, MAI i conteggi grezzi (che
// rivelerebbero volume/frequenza d'uso personale). Un livello sopra il
// FedAvg classico (già altrove nella mesh): non "impara i pesi insieme",
// impara "di chi fidarsi insieme" — saggezza della folla sull'affidabilità,
// non sui dati. Riusa il bandit generico (advisor-bandit.js) come substrato
// e il ledger di reputazione (update-ledger.js) per l'anti-poisoning: un
// peer con storico di rifiuti pesa vicino a zero nel merge.
'use strict';

import { initBandit, banditObserve } from '../predict/advisor-bandit.js';
import { reputationWeight } from './update-ledger.js';

function meanOf(arm) { return +(arm.a / (arm.a + arm.b)).toFixed(2); }

// L'ultimo '|' separa il kind (mai un pipe al suo interno: kind sono nomi
// come 'nano'/'sweep') dal context (che PUÒ contenere più segmenti separati
// da '|', es. 'spesa|mid|medio').
function splitArmKey(key) {
  const idx = key.lastIndexOf('|');
  return idx < 0 ? [key, ''] : [key.slice(0, idx), key.slice(idx + 1)];
}

// Esporta SOLO le medie a posteriori arrotondate per arm — mai a/b grezzi.
// Un arm con pochissime osservazioni (vicino al prior 0,5) non è distinguibile
// da uno mai osservato: nessuna informazione sul VOLUME d'uso esce mai.
export function exportReliabilityDigest(banditState) {
  const state = banditState && banditState.arms ? banditState : initBandit();
  const digest = {};
  for (const [key, arm] of Object.entries(state.arms)) digest[key] = meanOf(arm);
  return { version: 1, digest };
}

// Fonde i digest ricevuti dai peer nel bandit locale, pesati per reputazione
// (update-ledger.js). Ogni media a posteriori di un peer diventa un numero
// LIMITATO di osservazioni sintetiche (mai una singola osservazione enorme
// che stravolgerebbe il locale): n = round(reputationWeight * maxWeight).
// Un peer a reputazione ~0 (storico di rifiuti/poisoning) contribuisce n=0:
// zero influenza, senza bisogno di bandirlo esplicitamente.
export function mergeReliabilityDigest(localState, peerDigests = [], ledger = [], { maxWeight = 3 } = {}) {
  let state = localState && localState.arms ? localState : initBandit();
  for (const { peerId, digest } of peerDigests) {
    const w = reputationWeight(ledger, peerId, 1);
    const n = Math.max(0, Math.round(w * maxWeight));
    if (n === 0) continue;
    for (const [key, mean] of Object.entries(digest || {})) {
      const [context, kind] = splitArmKey(key);
      for (let i = 0; i < n; i++) state = banditObserve(state, { context, kind, reward: mean });
    }
  }
  return state;
}
