// Ricerca di un asset (cripto o azione/ETF) per nome/simbolo — CoinGecko
// /search (nessuna chiave, CORS verificato) per le cripto, Alpha Vantage
// SYMBOL_SEARCH (chiave personale, stesso host già verificato) per
// azioni/ETF. Mai un risultato inventato: fonte vuota → lista vuota.
'use strict';

// BUG REALE trovato simulando la ricerca "tesla" (2026-07-27): CoinGecko
// restituisce fino a 8 token cripto derivati/tokenizzati chiamati "Tesla"
// (TSLAX, Tesla Ondo Tokenized, Backed Tesla...) — tutti legittimi come
// ricerca ma di rilevanza reale bassissima (market_cap_rank centinaia/
// migliaia, alcuni null). Messi PRIMA nell'elenco combinato, seppellivano
// il vero titolo azionario TSLA sotto 8 righe di rumore, dando l'impressione
// che "la ricerca trovi solo cripto". Fix: le cripto si ordinano per
// market_cap_rank REALE (asset più noti prima, non l'ordine grezzo
// dell'API) e si limitano a 5; il ranking finale combinato dà priorità a un
// match ESATTO col simbolo/nome cercato, poi alle azioni (rilevanza già
// ordinata da Alpha Vantage via matchScore), poi alle cripto per notorietà.
export async function searchCrypto(query, { fetchImpl = fetch } = {}) {
  if (!query || !query.trim()) return [];
  const res = await fetchImpl(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query.trim())}`);
  if (!res.ok) throw new Error(`CoinGecko search: HTTP ${res.status}`);
  const json = await res.json();
  const coins = Array.isArray(json?.coins) ? json.coins : [];
  return coins
    .map((c) => ({ kind: 'crypto', id: c.id, symbol: (c.symbol || '').toUpperCase(), name: c.name, _rank: Number.isFinite(c.market_cap_rank) ? c.market_cap_rank : Infinity }))
    .sort((a, b) => a._rank - b._rank)
    .slice(0, 5)
    .map(({ _rank, ...rest }) => rest);
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
  return matches
    .map((m) => ({ kind: 'stock', id: m['1. symbol'], symbol: m['1. symbol'], name: m['2. name'], region: m['4. region'], _score: parseFloat(m['9. matchScore']) || 0 }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 8)
    .map(({ _score, ...rest }) => rest);
}

// Alias per settori/beni senza un prezzo di mercato specifico interrogabile
// (un immobile non ha un ticker: nessuna API gratuita dà il valore di CASA
// TUA). Onesto: mai il valore del bene specifico dell'utente, solo un PROXY
// di settore dichiarato come tale nel nome — l'ETF reale (XLRE, quotato,
// stesso motore stock già verificato) mostra l'andamento generale del
// mercato immobiliare USA, non una previsione sul singolo immobile.
const SECTOR_PROXY_ALIASES = [
  { match: /immobil|real estate|property market/i, kind: 'stock', id: 'XLRE', symbol: 'XLRE', name: 'Immobiliare USA (proxy di settore: XLRE, non il tuo immobile specifico)' },
];

function resolveSectorProxy(q) {
  const found = SECTOR_PROXY_ALIASES.find(a => a.match.test(q));
  return found ? [{ kind: found.kind, id: found.id, symbol: found.symbol, name: found.name }] : [];
}

function relevanceScore(item, q) {
  const exact = item.symbol?.toLowerCase() === q || item.name?.toLowerCase() === q;
  if (exact) return 1000;
  return item.kind === 'stock' ? 500 : 100;
}

// Combina cripto + azioni in una lista unica; ognuna fallisce in modo
// indipendente (una fonte giù non deve azzerare l'altra). Ordinata per
// rilevanza reale (match esatto > azioni > cripto per notorietà), non per
// ordine di arrivo delle due fonti — altrimenti una ricerca come "tesla"
// mostra 8 token cripto oscuri prima del titolo azionario vero. Con `cache`
// (opzionale) l'ultima ricerca riuscita per la stessa query resta disponibile
// offline (dichiarata stale), invece di restituire una lista vuota che
// sembrerebbe "nessun risultato" invece di "rete assente".
export async function searchAsset(query, { apiKey, fetchImpl = fetch, cache = null } = {}) {
  const q = (query || '').trim().toLowerCase();
  const proxy = resolveSectorProxy(q);
  if (proxy.length) return { results: proxy, stale: false };
  const cacheKey = `assetsearch:${q}`;
  // BUG REALE trovato dal vivo (2026-07-27): con una chiave Alpha Vantage non
  // valida/demo (es. "TEST_DEMO_KEY"), la ricerca azionaria falliva in
  // silenzio (.catch(() => [])) e "Apple" ripiegava sull'unico risultato
  // rimasto: un token cripto assurdo ("dog-with-apple-in-mouth") spacciato
  // per il risultato migliore. Ora l'errore REALE della ricerca azionaria
  // (chiave non valida/limite raggiunto) viene conservato e restituito
  // quando l'unico risultato rimasto è una cripto poco pertinente (mai un
  // match esatto) — l'utente merita di sapere perché, non un dato sbagliato.
  let stockWarning = null;
  const [crypto, stock] = await Promise.all([
    searchCrypto(query, { fetchImpl }).catch(() => []),
    apiKey ? searchStock(query, { apiKey, fetchImpl }).catch(e => { stockWarning = e.message; return []; }) : Promise.resolve([]),
  ]);
  const results = [...crypto, ...stock].sort((a, b) => relevanceScore(b, q) - relevanceScore(a, q));
  if (results.length) {
    if (cache) await cache.put(cacheKey, results).catch(() => {});
    // BUG REALE trovato dal vivo (2026-07-27): un token cripto spazzatura può
    // impostare il proprio SIMBOLO a una parola comune ("APPLE") apposta per
    // scalare in cima ai risultati — relevanceScore lo trattava come "match
    // esatto" al pari di un titolo reale. Qui il match esatto conta solo se è
    // sul NOME (es. "bitcoin" → nome "Bitcoin": affidabile), mai sul solo
    // simbolo, che chiunque può scegliere liberamente.
    const onlyWeakCrypto = stock.length === 0 && results.every(r => r.kind === 'crypto' && r.name?.toLowerCase() !== q);
    return { results, stale: false, stockWarning: stockWarning && onlyWeakCrypto ? stockWarning : null };
  }
  if (cache) {
    const cached = await cache.get(cacheKey).catch(() => null);
    if (cached) return { results: cached, stale: true };
  }
  return { results: [], stale: false };
}
