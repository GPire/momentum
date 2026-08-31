// ============================================================
// EXCHANGE RATE — tasso di cambio storico per le spese multi-valuta nei
// gruppi di divisione spese
// ============================================================
// Gap reale trovato in split-engine.js: un gruppo di viaggio assumeva
// un'unica valuta condivisa mai dichiarata, chi pagava in una valuta diversa
// durante un viaggio non aveva modo di registrarlo onestamente. Questo
// modulo fa SOLO una cosa — chiedere alla fonte il tasso del GIORNO della
// spesa (mai "oggi", altrimenti un saldo cambierebbe nel tempo per un
// cambio sceso, tradendo la fiducia) — tutta la logica di conversione e
// validazione resta in addSharedExpense (split-engine.js), che deve restare
// puro/senza rete.
//
// FONTE: Frankfurter (dati BCE, CC BY 4.0, licenza pulita), stessa fonte già
// verificata nel progetto per i cambi (vedi memoria "Fonti dati verificate
// senza chiave") — CORS aperto confermato dal vivo con `curl -H Origin`
// (access-control-allow-origin: *), nessuna chiave richiesta.
'use strict';

import { conTimeout } from '../core/con-timeout.js';

const TIMEOUT_MS = 8000;

// Cache in-memoria per sessione: la stessa coppia valuta+data non cambia mai
// (è un tasso storico, non live), quindi una sola richiesta di rete per
// combinazione basta per tutta la sessione dell'app.
const cache = new Map();

// Ritorna il tasso da `fromCurrency` a `toCurrency` per la data `isoDate`
// (YYYY-MM-DD), o `null` se la fonte non risponde/non ha il dato — MAI un
// tasso indovinato o approssimato: il chiamante deve mostrare un errore
// onesto, non far finta che la conversione sia andata a buon fine.
export async function fetchHistoricalRate(fromCurrency, toCurrency, isoDate, fetchImpl = fetch) {
  if (!fromCurrency || !toCurrency) return null;
  if (fromCurrency === toCurrency) return 1;
  const key = `${fromCurrency}_${toCurrency}_${isoDate}`;
  if (cache.has(key)) return cache.get(key);

  const url = `https://api.frankfurter.dev/v1/${isoDate}?base=${encodeURIComponent(fromCurrency)}&symbols=${encodeURIComponent(toCurrency)}`;
  try {
    const res = await conTimeout(fetchImpl(url), TIMEOUT_MS, 'Il tasso di cambio non arriva da troppo tempo');
    if (!res.ok) return null;
    const data = await res.json();
    const rate = data?.rates?.[toCurrency];
    if (!(rate > 0)) return null;
    cache.set(key, rate);
    return rate;
  } catch (_) {
    return null;
  }
}
