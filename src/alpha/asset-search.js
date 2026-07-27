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

// Piano B per la RICERCA azionaria (non solo per lo storico, dove già
// c'era): verificato dal vivo (2026-07-27) che Twelve Data ha un endpoint
// di ricerca reale, funzionante con la chiave dell'utente. BUG REALE
// trovato: prima solo Alpha Vantage veniva usato per la ricerca — se il
// suo limite di 25 richieste/giorno si esauriva (facile, basta usare
// l'app), la ricerca falliva SEMPRE anche con Twelve Data/FMP configurati,
// perché quei due erano collegati solo allo storico prezzi, mai alla
// ricerca iniziale.
export async function searchStockTwelveData(query, { apiKey, fetchImpl = fetch } = {}) {
  if (!query || !query.trim()) return [];
  if (!apiKey) throw new Error('Serve la tua chiave Twelve Data personale (Momentum Vault → Prezzi live).');
  const url = `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(query.trim())}&apikey=${encodeURIComponent(apiKey)}`;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Twelve Data search: HTTP ${res.status}`);
  const json = await res.json();
  if (json?.status === 'error' || json?.code) throw new Error(json?.message || 'Twelve Data: chiave non valida o limite raggiunto.');
  const matches = Array.isArray(json?.data) ? json.data : [];
  return matches.map((m) => ({ kind: 'stock', id: m.symbol, symbol: m.symbol, name: m.instrument_name, region: m.country }));
}
// Piano C: endpoint "stable/search-name" verificato dal vivo (2026-07-27,
// funzionante con la chiave dell'utente) — l'endpoint legacy usato prima
// (api/v3/search) è stato dismesso da FMP il 31/8/2025.
export async function searchStockFMP(query, { apiKey, fetchImpl = fetch } = {}) {
  if (!query || !query.trim()) return [];
  if (!apiKey) throw new Error('Serve la tua chiave Financial Modeling Prep personale (Momentum Vault → Prezzi live).');
  const url = `https://financialmodelingprep.com/stable/search-name?query=${encodeURIComponent(query.trim())}&apikey=${encodeURIComponent(apiKey)}`;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`FMP search: HTTP ${res.status}`);
  const json = await res.json();
  if (json?.['Error Message']) throw new Error(json['Error Message']);
  const matches = Array.isArray(json) ? json : [];
  // FMP non restituisce un campo "paese" esplicito — la valuta USD è
  // l'indicatore più affidabile del listino USA primario (stessa
  // convenzione "region" di Alpha Vantage/Twelve Data, usata per la
  // preferenza in relevanceScore).
  return matches.map((m) => ({ kind: 'stock', id: m.symbol, symbol: m.symbol, name: m.name, region: m.currency === 'USD' ? 'United States' : m.exchangeFullName }));
}
// Cascata: Alpha Vantage → Twelve Data → FMP, mai un secondo motore isolato
// (stesso ordine già usato per lo storico prezzi in stock-history.js).
// Ritorna l'ULTIMO errore reale solo se TUTTE le fonti configurate falliscono
// — un fallimento intermedio non deve azzerare la ricerca se una fonte
// successiva riesce.
async function searchStockCascade(query, { apiKey, twelvedataKey, fmpKey, fetchImpl }) {
  const attempts = [
    apiKey && (() => searchStock(query, { apiKey, fetchImpl })),
    twelvedataKey && (() => searchStockTwelveData(query, { apiKey: twelvedataKey, fetchImpl })),
    fmpKey && (() => searchStockFMP(query, { apiKey: fmpKey, fetchImpl })),
  ].filter(Boolean);
  let lastError = null;
  for (const attempt of attempts) {
    try {
      const results = await attempt();
      if (results.length) return { results, error: null };
    } catch (e) { lastError = e; }
  }
  return { results: [], error: lastError };
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

// BUG REALE trovato dal vivo (2026-07-27, query "Apple" con dati reali):
// un token cripto ("dog with apple in mouth") ha SIMBOLO letterale "APPLE"
// — il match esatto sul solo simbolo lo portava in cima ai risultati (1000),
// DAVANTI ad Apple Inc. vera, perché il "match esatto" contava sia il
// simbolo sia il nome per QUALSIASI kind. Il simbolo cripto può essere
// scelto liberamente da chiunque (già corretto per il warning, ma non per
// l'ORDINAMENTO): ora un match esatto sul solo simbolo di una cripto non
// batte più un titolo azionario reale — solo il nome esatto (o un titolo
// azionario, sempre) può farlo.
// BUG REALE trovato dal vivo (2026-07-27): tra più listini dello stesso
// titolo (es. Apple quotata anche a Milano/Francoforte/Messico), un
// listino estero il cui NOME è per caso troncato esattamente alla query
// (es. "APPLE" su una piazza estera) vinceva su quello USA primario
// ("Apple Inc.", nome non troncato) — e il listino estero spesso richiede
// un piano a pagamento per lo storico sulle stesse API gratuite (verificato
// dal vivo: 4AAPL su Twelve Data → 404 "serve un piano Pro"). Ora il
// listino USA ha una preferenza esplicita quando i punteggi sono vicini.
function relevanceScore(item, q) {
  const exactName = item.name?.toLowerCase() === q;
  if (item.kind === 'stock') {
    const exactSymbol = item.symbol?.toLowerCase() === q;
    let score = exactSymbol ? 900 : exactName ? 600 : 500;
    if (item.region === 'United States') score += 300;
    return score;
  }
  return exactName ? 1000 : 100; // cripto senza match esatto sul nome: resta sempre sotto ogni azione/ETF
}

// Combina cripto + azioni in una lista unica; ognuna fallisce in modo
// indipendente (una fonte giù non deve azzerare l'altra). Ordinata per
// rilevanza reale (match esatto > azioni > cripto per notorietà), non per
// ordine di arrivo delle due fonti — altrimenti una ricerca come "tesla"
// mostra 8 token cripto oscuri prima del titolo azionario vero. Con `cache`
// (opzionale) l'ultima ricerca riuscita per la stessa query resta disponibile
// offline (dichiarata stale), invece di restituire una lista vuota che
// sembrerebbe "nessun risultato" invece di "rete assente".
export async function searchAsset(query, { apiKey, twelvedataKey, fmpKey, fetchImpl = fetch, cache = null } = {}) {
  const q = (query || '').trim().toLowerCase();
  const proxy = resolveSectorProxy(q);
  if (proxy.length) return { results: proxy, stale: false };
  const cacheKey = `assetsearch:${q}`;
  // BUG REALE trovato dal vivo (2026-07-27): con una chiave Alpha Vantage non
  // valida/demo (es. "TEST_DEMO_KEY") o esaurita (limite di 25 richieste/
  // giorno, facilissimo da raggiungere), la ricerca azionaria falliva del
  // tutto — anche con Twelve Data/FMP configurati, perché prima erano
  // collegati SOLO allo storico prezzi, mai alla ricerca. Ora la ricerca usa
  // la STESSA cascata (Alpha Vantage → Twelve Data → FMP): un fallimento
  // intermedio non azzera più tutto. L'errore REALE viene conservato e
  // restituito solo se TUTTE le fonti configurate falliscono e l'unico
  // risultato rimasto è una cripto poco pertinente (mai un match esatto).
  const [crypto, stockRes] = await Promise.all([
    searchCrypto(query, { fetchImpl }).catch(() => []),
    (apiKey || twelvedataKey || fmpKey) ? searchStockCascade(query, { apiKey, twelvedataKey, fmpKey, fetchImpl }) : Promise.resolve({ results: [], error: null }),
  ]);
  const stock = stockRes.results;
  let stockWarning = stockRes.error?.message || null;
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
