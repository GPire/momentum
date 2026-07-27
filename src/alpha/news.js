// Notizie finanziarie REALI + sentiment, per ticker (Alpha Vantage
// NEWS_SENTIMENT — stesso host di TIME_SERIES_DAILY, CORS verificato dal
// browser il 2026-07-27 con fetch() diretto, nessun proxy). Richiede la
// chiave PERSONALE dell'utente (mai una chiave condivisa Momentum, vedi
// src/alpha/live-price.js). Mai un sentiment inventato: se la fonte non
// risponde o la chiave manca, si dichiara e basta.
'use strict';

const SENTIMENT_LABELS = [
  [-Infinity, -0.35, 'bearish'],
  [-0.35, -0.15, 'somewhat-bearish'],
  [-0.15, 0.15, 'neutral'],
  [0.15, 0.35, 'somewhat-bullish'],
  [0.35, Infinity, 'bullish'],
];

function labelFor(score) {
  const hit = SENTIMENT_LABELS.find(([lo, hi]) => score >= lo && score < hi);
  return hit ? hit[2] : 'neutral';
}

// `cache` (opzionale, { get(key), put(key,val) } come in market-data.js):
// se la rete è assente o la fonte fallisce, si ripiega sull'ultimo risultato
// salvato per quel simbolo, dichiarato `stale:true` — mai un crash, mai un
// sentiment inventato al posto della cache mancante (in quel caso rilancia
// l'errore, onesto fino in fondo).
export async function fetchNewsSentiment(symbol, { apiKey, fetchImpl = fetch, limit = 10, cache = null } = {}) {
  if (!symbol) throw new Error('Serve un ticker.');
  if (!apiKey) throw new Error('Serve la tua chiave Alpha Vantage personale (Momentum Vault → Prezzi live).');
  const cacheKey = `news:${symbol.toUpperCase()}`;
  const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`;
  let json;
  try {
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`Alpha Vantage news: HTTP ${res.status}`);
    json = await res.json();
    if (json?.Note || json?.Information) {
      throw new Error('Limite richieste Alpha Vantage raggiunto o chiave non valida — riprova tra un minuto.');
    }
  } catch (err) {
    if (cache) {
      const cached = await cache.get(cacheKey).catch(() => null);
      if (cached) return { ...cached, stale: true };
    }
    throw err;
  }
  const feed = Array.isArray(json?.feed) ? json.feed : [];
  const items = feed.slice(0, limit).map((a) => {
    const tickerScore = (a.ticker_sentiment || []).find((t) => t.ticker === symbol.toUpperCase());
    const score = tickerScore ? parseFloat(tickerScore.ticker_sentiment_score) : parseFloat(a.overall_sentiment_score);
    return {
      title: a.title,
      url: a.url,
      source: a.source,
      publishedAt: a.time_published,
      sentimentScore: Number.isFinite(score) ? score : null,
      sentimentLabel: Number.isFinite(score) ? labelFor(score) : 'sconosciuto',
      relevance: tickerScore ? parseFloat(tickerScore.relevance_score) : null,
    };
  });
  const result = { symbol: symbol.toUpperCase(), asOf: new Date().toISOString(), items, stale: false };
  if (cache) await cache.put(cacheKey, result).catch(() => {});
  return result;
}

// Piano B per le notizie (feedback esplicito: "la parte delle notizie
// non dice niente" — Alpha Vantage News condivide lo stesso limite di 25
// richieste/giorno della ricerca, facilissimo da esaurire). Finnhub:
// CORS verificato dal vivo (2026-07-27, access-control-allow-origin: *),
// endpoint dedicato alle notizie aziendali, piano gratuito molto più
// generoso (60 richieste/minuto). Nessun punteggio di sentiment reale
// disponibile su questo endpoint gratuito: dichiarato onestamente come
// "sconosciuto", MAI un punteggio inventato.
export async function fetchFinnhubNews(symbol, { apiKey, fetchImpl = fetch, limit = 10, cache = null, daysBack = 14 } = {}) {
  if (!symbol) throw new Error('Serve un ticker.');
  if (!apiKey) throw new Error('Serve la tua chiave Finnhub personale (Momentum Vault → Prezzi live).');
  const cacheKey = `finnhub-news:${symbol.toUpperCase()}`;
  const to = new Date();
  const from = new Date(to.getTime() - daysBack * 86_400_000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${fmt(from)}&to=${fmt(to)}&token=${encodeURIComponent(apiKey)}`;
  let json;
  try {
    const res = await fetchImpl(url);
    json = await res.json().catch(() => null);
    if (!res.ok || json?.error) throw new Error(json?.error || `Finnhub news: HTTP ${res.status}`);
  } catch (err) {
    if (cache) {
      const cached = await cache.get(cacheKey).catch(() => null);
      if (cached) return { ...cached, stale: true };
    }
    throw err;
  }
  const feed = Array.isArray(json) ? json : [];
  const items = feed.slice(0, limit).map((a) => ({
    title: a.headline,
    url: a.url,
    source: a.source,
    publishedAt: a.datetime ? new Date(a.datetime * 1000).toISOString() : null,
    sentimentScore: null,
    sentimentLabel: 'sconosciuto',
    relevance: null,
  }));
  const result = { symbol: symbol.toUpperCase(), asOf: new Date().toISOString(), items, stale: false };
  if (cache) await cache.put(cacheKey, result).catch(() => {});
  return result;
}

// Piano B senza chiave alcuna (richiesto esplicitamente: "trova altri
// RSS e metodi innovativi"): Hacker News (Algolia search API), CORS
// verificato dal vivo (2026-07-27), funziona SUBITO senza configurare
// nulla. Discussioni reali della comunità tech — utile soprattutto per
// aziende tech/cripto, meno per settori non tech, ma sempre dati veri
// (mai un sentiment inventato: qui non esiste un punteggio, solo i
// punti/commenti reali come segnale di interesse, dichiarati come tali,
// non come "sentiment").
export async function fetchHackerNewsMentions(query, { fetchImpl = fetch, limit = 5, cache = null } = {}) {
  if (!query) throw new Error('Serve un nome o simbolo da cercare.');
  const cacheKey = `hn-news:${query.toLowerCase()}`;
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=${limit}`;
  let json;
  try {
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`Hacker News: HTTP ${res.status}`);
    json = await res.json();
  } catch (err) {
    if (cache) {
      const cached = await cache.get(cacheKey).catch(() => null);
      if (cached) return { ...cached, stale: true };
    }
    throw err;
  }
  const hits = Array.isArray(json?.hits) ? json.hits : [];
  const items = hits.filter(h => h.url).map((h) => ({
    title: h.title,
    url: h.url,
    source: `Hacker News (${h.points ?? 0} punti, ${h.num_comments ?? 0} commenti)`,
    publishedAt: h.created_at || null,
    sentimentScore: null,
    sentimentLabel: 'sconosciuto',
    relevance: null,
  }));
  const result = { symbol: query, asOf: new Date().toISOString(), items, stale: false };
  if (cache) await cache.put(cacheKey, result).catch(() => {});
  return result;
}

// Piano B a chiave, ulteriore diversificazione (CORS verificato dal vivo,
// access-control-allow-origin: *). Aggregatore di notizie generaliste
// (non solo finanziarie) — utile quando le fonti finanziarie non hanno
// nulla su un'azienda meno coperta dagli analisti.
export async function fetchNewsApiOrg(query, { apiKey, fetchImpl = fetch, limit = 5, cache = null } = {}) {
  if (!query) throw new Error('Serve un nome o simbolo da cercare.');
  if (!apiKey) throw new Error('Serve la tua chiave NewsAPI.org personale (Momentum Vault → Prezzi live).');
  const cacheKey = `newsapi:${query.toLowerCase()}`;
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=${limit}&apiKey=${encodeURIComponent(apiKey)}`;
  let json;
  try {
    const res = await fetchImpl(url);
    json = await res.json().catch(() => null);
    if (!res.ok || json?.status === 'error') throw new Error(json?.message || `NewsAPI.org: HTTP ${res.status}`);
  } catch (err) {
    if (cache) {
      const cached = await cache.get(cacheKey).catch(() => null);
      if (cached) return { ...cached, stale: true };
    }
    throw err;
  }
  const articles = Array.isArray(json?.articles) ? json.articles : [];
  const items = articles.map((a) => ({
    title: a.title,
    url: a.url,
    source: a.source?.name || 'NewsAPI.org',
    publishedAt: a.publishedAt || null,
    sentimentScore: null,
    sentimentLabel: 'sconosciuto',
    relevance: null,
  }));
  const result = { symbol: query, asOf: new Date().toISOString(), items, stale: false };
  if (cache) await cache.put(cacheKey, result).catch(() => {});
  return result;
}
