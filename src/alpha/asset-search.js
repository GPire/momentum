// Ricerca di un asset (cripto o azione/ETF) per nome/simbolo — CoinGecko
// /search (nessuna chiave, CORS verificato) per le cripto, Alpha Vantage
// SYMBOL_SEARCH (chiave personale, stesso host già verificato) per
// azioni/ETF. Mai un risultato inventato: fonte vuota → lista vuota.
'use strict';

export async function searchCrypto(query, { fetchImpl = fetch } = {}) {
  if (!query || !query.trim()) return [];
  const res = await fetchImpl(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query.trim())}`);
  if (!res.ok) throw new Error(`CoinGecko search: HTTP ${res.status}`);
  const json = await res.json();
  const coins = Array.isArray(json?.coins) ? json.coins : [];
  return coins.slice(0, 8).map((c) => ({ kind: 'crypto', id: c.id, symbol: (c.symbol || '').toUpperCase(), name: c.name }));
}

export async function searchStock(query, { apiKey, fetchImpl = fetch } = {}) {
  if (!query || !query.trim()) return [];
  if (!apiKey) throw new Error('Serve la tua chiave Alpha Vantage personale (Momentum Vault → Prezzi live).');
  const url = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(query.trim())}&apikey=${encodeURIComponent(apiKey)}`;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Alpha Vantage search: HTTP ${res.status}`);
  const json = await res.json();
  if (json?.Note || json?.Information) throw new Error('Limite richieste Alpha Vantage raggiunto o chiave non valida — riprova tra un minuto.');
  const matches = Array.isArray(json?.bestMatches) ? json.bestMatches : [];
  return matches.slice(0, 8).map((m) => ({
    kind: 'stock',
    id: m['1. symbol'],
    symbol: m['1. symbol'],
    name: m['2. name'],
    region: m['4. region'],
  }));
}

// Combina cripto + azioni in una lista unica; ognuna fallisce in modo
// indipendente (una fonte giù non deve azzerare l'altra). Con `cache`
// (opzionale) l'ultima ricerca riuscita per la stessa query resta disponibile
// offline (dichiarata stale), invece di restituire una lista vuota che
// sembrerebbe "nessun risultato" invece di "rete assente".
export async function searchAsset(query, { apiKey, fetchImpl = fetch, cache = null } = {}) {
  const cacheKey = `assetsearch:${(query || '').trim().toLowerCase()}`;
  const [crypto, stock] = await Promise.all([
    searchCrypto(query, { fetchImpl }).catch(() => []),
    apiKey ? searchStock(query, { apiKey, fetchImpl }).catch(() => []) : Promise.resolve([]),
  ]);
  const results = [...crypto, ...stock];
  if (results.length) {
    if (cache) await cache.put(cacheKey, results).catch(() => {});
    return { results, stale: false };
  }
  if (cache) {
    const cached = await cache.get(cacheKey).catch(() => null);
    if (cached) return { results: cached, stale: true };
  }
  return { results: [], stale: false };
}
