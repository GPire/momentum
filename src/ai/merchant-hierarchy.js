// ============================================================
// MERCHANT HIERARCHY — l'esperto che generalizza agli esercenti MAI VISTI (v11)
// ============================================================
// Il limite n.1 MISURATO di Momentum Core (VERSIONI.md): l'accuratezza alta
// vale in-distribution, ma sugli esercenti fuori vocabolario crolla. Il nemico
// vero non e' il modello, e' la COPERTURA DEL VOCABOLARIO.
//
// Qui l'attacco frontale: le descrizioni bancarie NON sono stringhe piatte,
// hanno una gerarchia implicita che nessuno dei modelli sfrutta:
//   "ESSELUNGA"                → catena
//   "ESSELUNGA VIA RIZZOLI"    → punto vendita
//   "ESSELUNGA VIA RIZZOLI 12" → terminale
// Se l'utente ha gia' categorizzato due punti vendita Esselunga, il TERZO —
// mai visto, fuori dal dizionario, fuori dal vocabolario di Nano/Meso — non
// deve ripartire da zero: eredita dalla catena.
//
// Motore: ./hierarchical-bandit.js, LO STESSO primitivo che ordina i
// sotto-domini nella scoperta aggiornamenti (src/core/discovery-memory.js).
// Un'unica architettura, due domini molto distanti: e' questo che la rende un
// pezzo di tecnologia del progetto e non una feature isolata.
//
// PROPRIETA' ONESTE E UTILI:
// - Impara SOLO dai dati reali dell'utente (learn(): conferme e correzioni).
//   A freddo non esiste e non vota: zero effetto, zero rumore.
// - Se il primo token e' spazzatura (prefissi bancari non filtrati), i rami
//   risultano ETEROGENEI e il pooling adattivo si abbassa da solo: il sistema
//   smette di generalizzare dove generalizzare farebbe danno. Si auto-corregge
//   invece di richiedere una lista di prefissi perfetta.
// - Non sostituisce nessun modello: aggiunge un voto dove gli altri tirano a
//   indovinare.
'use strict';

import { normalizeMerchant } from './merchant-dictionary.js';
import {
  initHierarchical, observeHierarchical, predictHierarchical,
  explainHierarchical, pruneHierarchical, mergeHierarchical,
} from './hierarchical-bandit.js';

const MAX_DEPTH = 4;      // oltre il 4° token si scende nel rumore (civici, codici)
const MIN_TOKEN = 2;      // token di 1 carattere: non identificano nulla

export function initMerchantHierarchy(opts = {}) {
  return initHierarchical(opts);
}

// Percorso gerarchico di una descrizione: prefissi cumulativi dei token.
// "POS ESSELUNGA VIA RIZZOLI 12" → ['esselunga', 'esselunga via', 'esselunga via rizzoli']
export function merchantPath(description) {
  const norm = normalizeMerchant(description);
  if (!norm) return [];
  const tokens = norm.split(' ').filter(t => t.length >= MIN_TOKEN).slice(0, MAX_DEPTH);
  const path = [];
  for (let i = 0; i < tokens.length; i++) path.push(tokens.slice(0, i + 1).join(' '));
  return path;
}

// Apprendimento: una transazione confermata/corretta dall'utente.
export function observeMerchant(model, description, category, now = Date.now(), weight = 1) {
  const path = merchantPath(description);
  if (!path.length || !category) return model;
  return observeHierarchical(model, path, category, now, weight);
}

// Predizione. Ritorna null quando non ha nulla di sensato da dire: l'astensione
// e' parte del contratto (regola del progetto: meglio tacere che inventare).
export function predictMerchant(model, description, now = Date.now(), opts = {}) {
  const path = merchantPath(description);
  if (!path.length) return null;
  const r = predictHierarchical(model, path, now);
  if (!r.label || r.support < (opts.minSupport ?? 2)) return null;
  return {
    category: r.label,
    confidence: r.p,
    margin: r.margin,
    support: r.support,
    depth: r.depth,
    inherited: r.depth < path.length,   // true = esercente mai visto, eredita dalla catena
    // il nodo piu' profondo che ha davvero fatto match (non tutta la catena)
    matchedPath: r.depth > 0 ? path[r.depth - 1] : '',
  };
}

// Spiegazione in italiano per la UI e per l'audit (mai un numero senza il perche').
export function explainMerchant(model, description, now = Date.now()) {
  const path = merchantPath(description);
  if (!path.length) return null;
  const e = explainHierarchical(model, path, now);
  const p = predictMerchant(model, description, now);
  if (!p) return { category: null, reason: 'nessuna esperienza su questo esercente' };
  return {
    ...p,
    reason: p.inherited
      ? `mai visto prima: assomiglia a "${p.matchedPath}", che per te e' ${p.category}`
      : `gia' categorizzato come ${p.category} (${p.support.toFixed(0)} volte)`,
    raw: e.reason,
  };
}

export function pruneMerchantHierarchy(model, opts = {}) { return pruneHierarchical(model, opts); }
export function mergeMerchantHierarchy(local, remote, opts = {}) { return mergeHierarchical(local, remote, opts); }
