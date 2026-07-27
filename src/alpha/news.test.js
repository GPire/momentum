import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchNewsSentiment, fetchFinnhubNews } from './news.js';

const realShape = () => ({
  ok: true,
  status: 200,
  json: async () => ({
    items: '2',
    feed: [
      { title: 'Apple rialza le stime', url: 'https://x.test/1', source: 'Reuters', time_published: '20260727T090000',
        overall_sentiment_score: 0.4, ticker_sentiment: [{ ticker: 'AAPL', ticker_sentiment_score: '0.42', relevance_score: '0.9' }] },
      { title: 'Rischio regolatorio per il settore tech', url: 'https://x.test/2', source: 'Bloomberg', time_published: '20260726T160000',
        overall_sentiment_score: -0.2, ticker_sentiment: [{ ticker: 'AAPL', ticker_sentiment_score: '-0.18', relevance_score: '0.5' }] },
    ],
  }),
});

test('fetchNewsSentiment: senza ticker → errore onesto', async () => {
  await assert.rejects(() => fetchNewsSentiment(null, { apiKey: 'k' }), /ticker/i);
});

test('fetchNewsSentiment: senza chiave → errore onesto, mai un fetch a vuoto', async () => {
  await assert.rejects(() => fetchNewsSentiment('AAPL', {}), /chiave/i);
});

test('fetchNewsSentiment: forma reale → titoli, punteggio ticker-specifico, etichetta sentiment', async () => {
  const r = await fetchNewsSentiment('AAPL', { apiKey: 'k', fetchImpl: async () => realShape() });
  assert.equal(r.symbol, 'AAPL');
  assert.equal(r.items.length, 2);
  assert.equal(r.items[0].sentimentScore, 0.42);
  assert.equal(r.items[0].sentimentLabel, 'bullish');
  assert.equal(r.items[1].sentimentLabel, 'somewhat-bearish');
});

test('fetchNewsSentiment: limite raggiunto ("Note"/"Information") → errore onesto, mai dati finti', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ Note: 'limite raggiunto' }) });
  await assert.rejects(() => fetchNewsSentiment('AAPL', { apiKey: 'k', fetchImpl }), /limite|chiave/i);
});

test('fetchNewsSentiment: HTTP non ok → errore, mai un array vuoto silenzioso spacciato per "nessuna notizia"', async () => {
  const fetchImpl = async () => ({ ok: false, status: 500 });
  await assert.rejects(() => fetchNewsSentiment('AAPL', { apiKey: 'k', fetchImpl }), /500/);
});

test('fetchNewsSentiment: offline/rete giù CON cache → ripiega sulla cache, dichiarata stale', async () => {
  const cached = { symbol: 'AAPL', asOf: '2026-07-01T00:00:00Z', items: [{ title: 'vecchia notizia' }] };
  const cache = { get: async () => cached, put: async () => {} };
  const fetchImpl = async () => { throw new TypeError('Failed to fetch'); };
  const r = await fetchNewsSentiment('AAPL', { apiKey: 'k', fetchImpl, cache });
  assert.equal(r.stale, true);
  assert.equal(r.items[0].title, 'vecchia notizia');
});

test('fetchNewsSentiment: rete giù SENZA cache → rilancia l\'errore, mai un risultato vuoto camuffato', async () => {
  const cache = { get: async () => null, put: async () => {} };
  const fetchImpl = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(() => fetchNewsSentiment('AAPL', { apiKey: 'k', fetchImpl, cache }));
});

// Piano B verificato dal vivo (2026-07-27): Finnhub ha CORS aperto e un
// piano gratuito molto più generoso (60/min vs 25/giorno di Alpha
// Vantage) — dedicato esattamente al bisogno segnalato dall'utente
// ("la parte delle notizie non dice niente").
test('fetchFinnhubNews: senza ticker → errore onesto', async () => {
  await assert.rejects(() => fetchFinnhubNews(null, { apiKey: 'k' }), /ticker/i);
});

test('fetchFinnhubNews: senza chiave → errore onesto, mai un fetch a vuoto', async () => {
  await assert.rejects(() => fetchFinnhubNews('AAPL', {}), /chiave/i);
});

test('fetchFinnhubNews: forma reale → titoli reali, sentiment onestamente "sconosciuto" (non disponibile su questo endpoint)', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ([
      { headline: 'Apple presenta il nuovo prodotto', url: 'https://x.test/1', source: 'Reuters', datetime: 1785000000 },
      { headline: 'Rumor su un nuovo servizio Apple', url: 'https://x.test/2', source: 'Bloomberg', datetime: 1784900000 },
    ]),
  });
  const r = await fetchFinnhubNews('AAPL', { apiKey: 'k', fetchImpl });
  assert.equal(r.symbol, 'AAPL');
  assert.equal(r.items.length, 2);
  assert.equal(r.items[0].title, 'Apple presenta il nuovo prodotto');
  assert.equal(r.items[0].sentimentLabel, 'sconosciuto');
});

test('fetchFinnhubNews: chiave non valida → errore col messaggio reale, mai dati finti', async () => {
  const fetchImpl = async () => ({ ok: false, status: 401, json: async () => ({ error: 'Invalid API key.' }) });
  await assert.rejects(() => fetchFinnhubNews('AAPL', { apiKey: 'sbagliata', fetchImpl }), /Invalid API key/);
});

test('fetchFinnhubNews: offline/rete giù CON cache → ripiega sulla cache, dichiarata stale', async () => {
  const cached = { symbol: 'AAPL', asOf: '2026-07-01T00:00:00Z', items: [{ title: 'vecchia notizia' }] };
  const cache = { get: async () => cached, put: async () => {} };
  const fetchImpl = async () => { throw new TypeError('Failed to fetch'); };
  const r = await fetchFinnhubNews('AAPL', { apiKey: 'k', fetchImpl, cache });
  assert.equal(r.stale, true);
  assert.equal(r.items[0].title, 'vecchia notizia');
});
