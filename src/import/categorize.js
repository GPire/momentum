// ============================================================
// CATEGORIZZAZIONE SICURA — guardrail anti-misclassificazione (import)
// ============================================================
// Problema reale: il classificatore ML, su un esercente sconosciuto, può
// "scommettere" una categoria ad alto rischio (es. un negozio → CRYPTO). Su
// categorie finanziariamente fuorvianti (crypto/etf/stipendio) questo è
// inaccettabile. Architettura: DIZIONARIO prima (alta precisione), poi ML ma
// con GUARDRAIL — crypto/etf si accettano SOLO con evidenza (keyword o
// dizionario), stipendio solo per un'entrata. Altrimenti si demota a una
// categoria sicura. Onestà (regola #1): non forziamo mai una categoria
// speciale senza prova; meglio "spesa" onesto che "crypto" inventato.
'use strict';

import { lookupMerchant } from '../ai/merchant-dictionary.js';

const CRYPTO_KW = /\b(crypto|bitcoin|btc|ethereum|eth|litecoin|solana|cardano|ripple|dogecoin|binance|coinbase|kraken|bitpanda|bitget|okx|wallet|staking|nft|metamask|ledger|usdt|usdc|blockchain|defi)\b/i;
const INVEST_KW = /\b(etf|stock|shares?|azioni|equity|dividend|dividendo|vanguard|ishares|xtrackers|amundi|lyxor|invesco|wisdomtree|msci|sp500|s&p|obbligazion|bond|fund|fondo|pac|piano accumulo|trading|broker|degiro|directa|fineco|scalable)\b/i;

// Categorie "a rischio" (finanziariamente fuorvianti) e la loro prova richiesta.
export function guardCategory(catId, description, type) {
  const d = String(description || '');
  if (catId === 'crypto' && !CRYPTO_KW.test(d)) return demote(d, type);
  if (catId === 'etf' && !INVEST_KW.test(d)) return demote(d, type);
  if (catId === 'stipendio' && type === 'uscita') return demote(d, type); // una spesa non è stipendio
  return catId;
}

function demote(d, type) {
  const hit = lookupMerchant(d);                       // il dizionario sa la verità?
  if (hit && hit.category !== 'crypto' && hit.category !== 'etf') return hit.category;
  return type === 'entrata' ? 'stipendio' : 'spesa';   // default sicuro
}

// Categorizzazione completa e sicura: dizionario (fidato) → ML (con guardrail)
// → default per verso. `type` = 'entrata'|'uscita'|'invest'.
export function safeCategorize(description, amount, date, type) {
  const hit = lookupMerchant(description);
  if (hit) return hit.category;                        // esercente noto: massima precisione
  const orch = (typeof window !== 'undefined' && window.momentumOrchestrator) ? window.momentumOrchestrator : null;
  const ml = orch ? orch.classify(description, amount, date) : null;
  if (ml && ml.cat && ml.confidence > 60) return guardCategory(ml.cat, description, type);
  return type === 'entrata' ? 'stipendio' : 'spesa';
}
