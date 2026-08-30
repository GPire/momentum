// Notizie finanziarie REALI + sentiment, per ticker (Alpha Vantage
// NEWS_SENTIMENT — stesso host di TIME_SERIES_DAILY, CORS verificato dal
// browser il 2026-07-27 con fetch() diretto, nessun proxy). Richiede la
// chiave PERSONALE dell'utente (mai una chiave condivisa Momentum, vedi
// src/alpha/live-price.js). Mai un sentiment inventato: se la fonte non
// risponde o la chiave manca, si dichiara e basta.
'use strict';

import { conTimeout } from '../core/con-timeout.js';

// Nessuna delle 4 fonti sotto aveva un limite di tempo esplicito — lo
// stesso buco già trovato e corretto in src/ai/local-sentiment.js (vedi
// src/core/con-timeout.js): un host che resta "pending" senza mai
// rispondere né fallire (misurato dal vivo con un provider a chiave reale
// rate-limitato) lasciava `await fetchImpl(url)` bloccato per sempre,
// mai intercettato dal try/catch perché non è mai un errore — e a
// cascata bloccava PER SEMPRE "Chiedi a Momentum"/"Cerca un asset" su
// "sto cercando...", indistinguibile per l'utente da un bug che non
// risponde mai. 15s (non 60s come i modelli: qui è solo JSON, non un
// download di decine di MB).
const TIMEOUT_NOTIZIE_MS = 15_000;

// Esportate (non più solo interne): src/ai/local-sentiment.js le riusa per
// etichettare il punteggio calcolato ON-DEVICE con le STESSE soglie di
// Alpha Vantage — un'unica scala per "bullish/bearish" in tutto il
// progetto, mai due sistemi di etichette che dicono cose diverse per lo
// stesso numero.
export const SENTIMENT_LABELS = [
  [-Infinity, -0.35, 'bearish'],
  [-0.35, -0.15, 'somewhat-bearish'],
  [-0.15, 0.15, 'neutral'],
  [0.15, 0.35, 'somewhat-bullish'],
  [0.35, Infinity, 'bullish'],
];

export function labelFor(score) {
  const hit = SENTIMENT_LABELS.find(([lo, hi]) => score >= lo && score < hi);
  return hit ? hit[2] : 'neutral';
}

// Riassunto REALE (già fornito dalla fonte, mai generato/inventato da
// Momentum) — tagliato per restare leggibile in una card, non un intero
// articolo. `null` se la fonte non lo fornisce (es. Hacker News: solo il
// titolo della discussione, l'articolo collegato non è mai stato letto).
function shortSummary(text) {
  if (!text || typeof text !== 'string') return null;
  const clean = text.trim();
  if (!clean) return null;
  return clean.length > 160 ? `${clean.slice(0, 157)}...` : clean;
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
    const res = await conTimeout(fetchImpl(url), TIMEOUT_NOTIZIE_MS, 'Alpha Vantage news non risponde da troppo tempo');
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
      summary: shortSummary(a.summary),
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
    const res = await conTimeout(fetchImpl(url), TIMEOUT_NOTIZIE_MS, 'Finnhub news non risponde da troppo tempo');
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
    summary: shortSummary(a.summary),
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
// BUG REALE segnalato dal vivo dall'utente ("notizie che non esistono più
// oppure vecchissime"): l'endpoint di default di Algolia (`/search`)
// ordina per RILEVANZA/punti, non per data — un post virale di anni fa su
// un'azienda nota (es. "Apple's stock under Jobs: from $10 to $400")
// batteva sempre qualunque discussione realmente recente. `/search_by_date`
// ordina cronologicamente; `restrictSearchableAttributes=title` tiene la
// ricerca sul titolo (altrimenti il match su testo/commenti fa risalire
// storie non pertinenti). Filtro di sicurezza aggiuntivo: uno scarto oltre
// MAX_ETA_GIORNI non viene mai mostrato spacciato per "notizia attuale",
// anche se fosse l'unico risultato — mai stale silenzioso.
const MAX_ETA_GIORNI_HN = 400;

// ── IL TITOLO PARLA DAVVERO DI QUESTA AZIENDA? ──
// SECONDO BUG REALE segnalato dall'utente dal vivo (2026-08-20): chiedendo
// notizie su Apple arrivava "Foreign Students APPLYing to US Colleges Fell
// 10%". Algolia cerca per PREFISSO, quindi "apple" trova "applying",
// "applied", "application" — e il filtro precedente controllava solo la data,
// non che la parola ci fosse davvero.
// Il danno non e' l'imprecisione: e' che una notizia palesemente sbagliata
// accanto al nome di un'azienda fa sospettare che siano inventati anche i
// numeri veri che stanno di fianco.
// Confine di PAROLA, non sottostringa — lo stesso errore gia' corretto nel
// glossario di mercato-qa.js, dove "obbligazioni" contiene "azioni".
export function titoloParlaDi(titolo, query) {
  const pulisci = (x) => String(x || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const t = pulisci(titolo);
  if (!t) return false;
  // Ogni parola della ricerca lunga almeno tre lettere deve comparire NEL
  // TITOLO come parola intera. Con meno di tre lettere (i ticker brevi tipo
  // "F" o "GM") il confine di parola non basta a distinguere, e si accetta:
  // meglio qualche notizia in piu' che nessuna su quei simboli.
  const parole = pulisci(query).split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  if (!parole.length) return true;
  return parole.some((w) => new RegExp(`(^|[^a-z0-9])${w}([^a-z0-9]|$)`).test(t));
}
export async function fetchHackerNewsMentions(query, { fetchImpl = fetch, limit = 5, cache = null } = {}) {
  if (!query) throw new Error('Serve un nome o simbolo da cercare.');
  const cacheKey = `hn-news:${query.toLowerCase()}`;
  const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=${limit}&restrictSearchableAttributes=title`;
  let json;
  try {
    const res = await conTimeout(fetchImpl(url), TIMEOUT_NOTIZIE_MS, 'Hacker News non risponde da troppo tempo');
    if (!res.ok) throw new Error(`Hacker News: HTTP ${res.status}`);
    json = await res.json();
  } catch (err) {
    if (cache) {
      const cached = await cache.get(cacheKey).catch(() => null);
      if (cached) return { ...cached, stale: true };
    }
    throw err;
  }
  const sogliaEta = Date.now() - MAX_ETA_GIORNI_HN * 86_400_000;
  const hits = (Array.isArray(json?.hits) ? json.hits : [])
    .filter((h) => !h.created_at || new Date(h.created_at).getTime() >= sogliaEta)
    .filter((h) => titoloParlaDi(h.title, query));
  const items = hits.filter(h => h.url).map((h) => ({
    title: h.title,
    url: h.url,
    source: `Hacker News (${h.points ?? 0} punti, ${h.num_comments ?? 0} commenti)`,
    publishedAt: h.created_at || null,
    summary: null, // onesto: solo il titolo della discussione, l'articolo collegato non è mai stato letto
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
    const res = await conTimeout(fetchImpl(url), TIMEOUT_NOTIZIE_MS, 'NewsAPI.org non risponde da troppo tempo');
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
    summary: shortSummary(a.description),
    sentimentScore: null,
    sentimentLabel: 'sconosciuto',
    relevance: null,
  }));
  const result = { symbol: query, asOf: new Date().toISOString(), items, stale: false };
  if (cache) await cache.put(cacheKey, result).catch(() => {});
  return result;
}
