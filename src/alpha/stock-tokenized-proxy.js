// ============================================================
// PROXY TOKENIZZATO — prezzo/storico azionario SENZA ALCUNA CHIAVE
// ============================================================
// Trovato dal vivo (2026-08-30), dopo aver riverificato quanto già scritto
// in src/alpha/live-price.js (Yahoo Finance e Stooq bloccano il browser,
// nessun header CORS — confermato di nuovo con una chiamata reale, non
// un'assunzione vecchia): un'azione NOTA (Apple, Tesla, Nvidia, Microsoft,
// Amazon...) ha spesso un "token tokenizzato" che la traccia 1:1 su una o
// più piattaforme cripto (xStock/Backed di Robinhood-Kraken, Ondo Global
// Markets, bStocks, Dinari, Coinbase) — e quei token sono normalissime
// "cripto" per CoinGecko, la STESSA API pubblica, senza chiave, già usata
// ovunque in questo progetto per bitcoin/ethereum/ecc.
//
// Verificato dal vivo con chiamate reali (non assunto dalla documentazione):
// - api.coingecko.com/api/v3/search?query=apple → trova "apple-xstock"
//   (rank 1027), "apple-ondo-tokenized-stock", ecc.
// - api.coingecko.com/api/v3/coins/apple-xstock → prezzo corrente reale
// - .../apple-xstock/market_chart → storico giornaliero reale (stesso
//   limite di 365gg del piano gratuito CoinGecko, stessa fonte già usata
//   per le cripto in year-over-year.js — RIUSATA qui, non duplicata)
// - Copertura verificata anche per Tesla, NVIDIA, Microsoft — non solo Apple
//
// ONESTÀ (regola #1 del progetto): un token tokenizzato traccia da vicino
// il titolo reale ma NON è il titolo quotato in borsa — piccoli scarti di
// prezzo (premio/sconto, orari di trading diversi, liquidità del token)
// sono normali e dichiarati SEMPRE nel testo che usa questo modulo, mai
// spacciati per il prezzo esatto del listino.
'use strict';

import { conTimeout } from '../core/con-timeout.js';

const TIMEOUT_RICERCA_MS = 15_000;

// Pattern che identificano un token-proxy (non una cripto "normale" che
// abbia per caso il nome dell'azienda nel nome — es. non deve matchare
// "Apple Network" o simili): la piattaforma emittente lo dichiara SEMPRE
// nel proprio nome, mai un'euristica sul solo simbolo.
const PROXY_PATTERN = /\b(xstock|tokenized stock)\b/i;

// Ordine di preferenza tra piattaforme quando più di una traccia la stessa
// azienda: xStock (Backed/Robinhood-Kraken) ha sistematicamente il
// market_cap_rank più basso (= più liquido) di ogni alternativa osservata
// dal vivo per Apple/Tesla/NVIDIA/Microsoft — si sceglie comunque per RANK
// reale, mai per nome fisso, così un'altra piattaforma che diventasse più
// liquida in futuro vince da sola senza dover toccare questo elenco.
export async function resolveTokenizedStockProxy(query, { fetchImpl = fetch } = {}) {
  const q = String(query || '').trim();
  if (!q) return null;
  let json;
  try {
    const res = await conTimeout(fetchImpl(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`), TIMEOUT_RICERCA_MS, 'CoinGecko search non risponde da troppo tempo');
    if (!res.ok) return null;
    json = await res.json();
  } catch (_) {
    return null;
  }
  const { titoloParlaDi } = await import('./news.js');
  const coins = Array.isArray(json?.coins) ? json.coins : [];
  const candidati = coins
    .filter((c) => PROXY_PATTERN.test(c.name || '') && titoloParlaDi(c.name, q))
    .filter((c) => Number.isFinite(c.market_cap_rank));
  if (!candidati.length) return null;
  candidati.sort((a, b) => a.market_cap_rank - b.market_cap_rank);
  const best = candidati[0];
  return { id: best.id, name: best.name, symbol: (best.symbol || '').toUpperCase() };
}
