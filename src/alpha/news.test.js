import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchNewsSentiment, fetchFinnhubNews, fetchHackerNewsMentions, fetchNewsApiOrg } from './news.js';

const realShape = () => ({
  ok: true,
  status: 200,
  json: async () => ({
    items: '2',
    feed: [
      { title: 'Apple rialza le stime', url: 'https://x.test/1', source: 'Reuters', time_published: '20260727T090000', summary: 'Apple ha rialzato le stime di fatturato per il trimestre.',
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
  assert.equal(r.items[0].summary, 'Apple ha rialzato le stime di fatturato per il trimestre.');
});

// Richiesta esplicita: "anche dei piccoli riassunti delle notizie" — il
// riassunto è quello REALE già fornito dalla fonte (mai generato da
// Momentum), tagliato per restare leggibile in una card.
test('fetchNewsSentiment: riassunto troppo lungo → tagliato a ~160 caratteri, mai l\'intero articolo', async () => {
  const long = 'A'.repeat(300);
  const fetchImpl = async () => ({ ok: true, json: async () => ({ feed: [{ title: 't', url: 'https://x.test/1', source: 's', summary: long }] }) });
  const r = await fetchNewsSentiment('AAPL', { apiKey: 'k', fetchImpl });
  assert.ok(r.items[0].summary.length <= 160);
  assert.ok(r.items[0].summary.endsWith('...'));
});

test('fetchNewsSentiment: senza riassunto nella fonte → null, mai un testo inventato', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ feed: [{ title: 't', url: 'https://x.test/1', source: 's' }] }) });
  const r = await fetchNewsSentiment('AAPL', { apiKey: 'k', fetchImpl });
  assert.equal(r.items[0].summary, null);
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
      { headline: 'Apple presenta il nuovo prodotto', url: 'https://x.test/1', source: 'Reuters', datetime: 1785000000, summary: 'Apple ha presentato oggi un nuovo dispositivo.' },
      { headline: 'Rumor su un nuovo servizio Apple', url: 'https://x.test/2', source: 'Bloomberg', datetime: 1784900000 },
    ]),
  });
  const r = await fetchFinnhubNews('AAPL', { apiKey: 'k', fetchImpl });
  assert.equal(r.symbol, 'AAPL');
  assert.equal(r.items.length, 2);
  assert.equal(r.items[0].title, 'Apple presenta il nuovo prodotto');
  assert.equal(r.items[0].sentimentLabel, 'sconosciuto');
  assert.equal(r.items[0].summary, 'Apple ha presentato oggi un nuovo dispositivo.');
  assert.equal(r.items[1].summary, null); // senza riassunto nella fonte → null, mai inventato
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

// Piano B SENZA chiave, verificato dal vivo (2026-07-27): Hacker News
// Algolia funziona subito, senza configurare nulla.
test('fetchHackerNewsMentions: senza query → errore onesto', async () => {
  await assert.rejects(() => fetchHackerNewsMentions(null, {}), /nome o simbolo/i);
});

test('fetchHackerNewsMentions: forma reale → titoli reali, punti/commenti come segnale, mai un sentiment inventato', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      hits: [
        { title: 'Apple Vision Pro: prime impressioni', url: 'https://x.test/1', points: 320, num_comments: 145, created_at: '2026-07-20T10:00:00Z' },
        { title: 'Senza URL, va escluso', points: 5, num_comments: 1 },
      ],
    }),
  });
  const r = await fetchHackerNewsMentions('Apple', { fetchImpl });
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].title, 'Apple Vision Pro: prime impressioni');
  assert.match(r.items[0].source, /320 punti/);
  assert.equal(r.items[0].sentimentLabel, 'sconosciuto');
  assert.equal(r.items[0].summary, null); // onesto: mai un riassunto inventato per l'articolo mai letto
});

test('fetchHackerNewsMentions: usa l\'endpoint cronologico (search_by_date), non quello per rilevanza — BUG REALE segnalato dal vivo: la rilevanza faceva risalire post virali vecchissimi al posto di notizie attuali', async () => {
  let urlUsata = null;
  const fetchImpl = async (url) => { urlUsata = url; return { ok: true, json: async () => ({ hits: [] }) }; };
  await fetchHackerNewsMentions('Apple', { fetchImpl });
  assert.match(urlUsata, /\/search_by_date\?/);
  assert.doesNotMatch(urlUsata, /\/search\?/); // mai l'endpoint per rilevanza
});

test('fetchHackerNewsMentions: uno scarto oltre ~400 giorni viene escluso, mai spacciato per notizia attuale', async () => {
  const oggi = new Date();
  const recente = new Date(oggi.getTime() - 10 * 86_400_000).toISOString();
  const vecchissima = new Date(oggi.getTime() - 800 * 86_400_000).toISOString();
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      hits: [
        { title: 'Discussione recente su Apple', url: 'https://x.test/1', points: 50, num_comments: 5, created_at: recente },
        { title: 'Apple stock under Jobs: from $10 to $400', url: 'https://x.test/2', points: 900, num_comments: 300, created_at: vecchissima },
      ],
    }),
  });
  const r = await fetchHackerNewsMentions('Apple', { fetchImpl });
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].title, 'Discussione recente su Apple');
});

test('fetchHackerNewsMentions: offline CON cache → ripiega sulla cache, dichiarata stale', async () => {
  const cached = { symbol: 'Apple', asOf: '2026-07-01T00:00:00Z', items: [{ title: 'vecchia discussione' }] };
  const cache = { get: async () => cached, put: async () => {} };
  const fetchImpl = async () => { throw new TypeError('Failed to fetch'); };
  const r = await fetchHackerNewsMentions('Apple', { fetchImpl, cache });
  assert.equal(r.stale, true);
});

// Piano B a chiave, verificato dal vivo (CORS confermato).
test('fetchNewsApiOrg: senza chiave → errore onesto', async () => {
  await assert.rejects(() => fetchNewsApiOrg('Apple', {}), /chiave/i);
});

test('fetchNewsApiOrg: forma reale → titoli reali', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ status: 'ok', articles: [{ title: 'Apple lancia una novità', url: 'https://x.test/1', source: { name: 'Reuters' }, publishedAt: '2026-07-20T10:00:00Z', description: 'Apple ha lanciato oggi una novità.' }] }),
  });
  const r = await fetchNewsApiOrg('Apple', { apiKey: 'k', fetchImpl });
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].source, 'Reuters');
  assert.equal(r.items[0].summary, 'Apple ha lanciato oggi una novità.');
});

test('fetchNewsApiOrg: chiave non valida → errore col messaggio reale, mai dati finti', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ status: 'error', code: 'apiKeyInvalid', message: 'Your API key is invalid or incorrect.' }) });
  await assert.rejects(() => fetchNewsApiOrg('Apple', { apiKey: 'sbagliata', fetchImpl }), /API key is invalid/);
});
