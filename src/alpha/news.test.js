import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchNewsSentiment, fetchFinnhubNews, fetchHackerNewsMentions, fetchNewsApiOrg, fetchGdeltCompanyNews, fetchCoinDeskCryptoNews, isFreshNewsEvidence } from './news.js';

test('crypto editorial feed keeps verified publisher, date and safe link', async () => {
  const now = Date.parse('2026-09-25T12:00:00Z');
  const result = await fetchCoinDeskCryptoNews('Bitcoin', { now, fetchImpl: async (url) => {
    assert.equal(url, '/api/market-crypto-news?coin=Bitcoin');
    return { ok: true, json: async () => ({ articles: [
      { title: 'Bitcoin ETF inflows', url: 'https://www.coindesk.com/markets/bitcoin/', publishedAt: '2026-09-25T11:00:00Z' },
      { title: 'Malicious', url: 'https://example.com/', publishedAt: '2026-09-25T11:00:00Z' },
    ] }) };
  } });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].sourceType, 'editorial');
  assert.equal(result.items[0].sentimentScore, null);
});

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
  assert.equal(r.items[0].publishedAt, '2026-07-27T09:00:00Z');
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

test('GDELT: titoli recenti pertinenti, URL sicuri, data di indicizzazione separata dalla pubblicazione', async () => {
  const now = Date.parse('2026-09-24T12:00:00Z');
  let requested;
  const fetchImpl = async (url) => {
    requested = new URL(url);
    return { ok: true, json: async () => ({ articles: [
      { title: 'Costco aggiorna la rete dei negozi', url: 'https://news.example/costco', domain: 'trusted.example', seendate: '20260924T100000Z' },
      { title: 'COSTCO aggiornamenti ripubblicati', url: 'javascript:alert(1)', seendate: '20260924T100000Z' },
      { title: 'Costco su pagina non cifrata', url: 'http://news.example/costco', seendate: '20260924T100000Z' },
      { title: 'Un retailer diverso', url: 'https://news.example/other', seendate: '20260924T100000Z' },
      { title: 'Costco: articolo vecchio', url: 'https://news.example/old', seendate: '20260901T100000Z' },
    ] }) };
  };
  const r = await fetchGdeltCompanyNews('Costco Wholesale Corporation', { fetchImpl, now });
  assert.equal(requested.hostname, 'api.gdeltproject.org');
  assert.equal(requested.searchParams.get('query'), '"Costco"');
  assert.equal(requested.searchParams.get('timespan'), '1week');
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].publishedAt, null);
  assert.equal(r.items[0].observedAt, '2026-09-24T10:00:00Z');
  assert.equal(r.items[0].sentimentScore, null);
  assert.equal(r.items[0].source, 'news.example · GDELT');
  assert.equal(isFreshNewsEvidence(r.items[0], { now }), true);
});

test('GDELT: cache recente evita nuove richieste; offline è segnalato e non alimenta il modello', async () => {
  const now = Date.parse('2026-09-24T12:00:00Z');
  let stored = null, calls = 0;
  const cache = { get: async () => stored, put: async (_key, value) => { stored = value; } };
  const fetchImpl = async () => { calls++; return { ok: true, json: async () => ({ articles: [
    { title: 'Nvidia aggiorna i chip', url: 'https://news.example/nvidia', seendate: '20260924T100000Z' },
  ] }) }; };
  await fetchGdeltCompanyNews('Nvidia Corporation', { fetchImpl, cache, now });
  await fetchGdeltCompanyNews('Nvidia Corporation', { fetchImpl, cache, now: now + 60_000 });
  assert.equal(calls, 1);
  const offline = await fetchGdeltCompanyNews('Nvidia Corporation', { fetchImpl: async () => { throw new Error('offline'); }, cache, now: now + 11 * 60_000 });
  assert.equal(offline.stale, true);
  assert.equal(isFreshNewsEvidence({ ...offline.items[0], staleSource: offline.stale }, { now }), false);
});

test('una discussione recente non diventa evidenza per il modello di sentiment', () => {
  const now = Date.parse('2026-09-25T12:00:00Z');
  assert.equal(isFreshNewsEvidence({ sourceType: 'community', publishedAt: '2026-09-25T11:00:00Z', sentimentScore: 0.8 }, { now }), false);
  assert.equal(isFreshNewsEvidence({ sourceType: 'editorial', publishedAt: '2026-09-25T11:00:00Z', sentimentScore: 0.8 }, { now }), true);
});

test('GDELT: risposta non valida e nomi troppo generici non diventano notizie', async () => {
  await assert.rejects(() => fetchGdeltCompanyNews('E', { fetchImpl: async () => ({ ok: true, json: async () => ({}) }) }), /nome/i);
  await assert.rejects(() => fetchGdeltCompanyNews('Costco', { fetchImpl: async () => ({ ok: true, json: async () => ({}) }) }), /risposta non valida/i);
});

test('GDELT: same-origin relay first, then direct source when the relay is unavailable', async () => {
  const urls = [];
  const r = await fetchGdeltCompanyNews('Costco', { relayFirst: true, fetchImpl: async (url) => {
    urls.push(url);
    if (url.startsWith('/api/')) return { ok: false, status: 404 };
    return { ok: true, json: async () => ({ articles: [] }) };
  } });
  assert.match(urls[0], /^\/api\/market-headlines\?name=Costco$/);
  assert.equal(new URL(urls[1]).hostname, 'api.gdeltproject.org');
  assert.deepEqual(r.items, []);
});

test('GDELT: a failed deployed relay does not repeat the slow upstream query', async () => {
  const urls = [];
  await assert.rejects(() => fetchGdeltCompanyNews('Costco', { relayFirst: true, fetchImpl: async (url) => {
    urls.push(url);
    return { ok: false, status: 503 };
  } }), /503/);
  assert.equal(urls.length, 1);
});

test('GDELT: per un marchio ambiguo non confonde il frutto con la società', async () => {
  const now = Date.parse('2026-09-24T12:00:00Z');
  const fetchImpl = async () => ({ ok: true, json: async () => ({ articles: [
    { title: 'Apple pie recipe goes viral', url: 'https://food.example/pie', seendate: '20260924T100000Z' },
    { title: 'Apple reveals an iPhone update', url: 'https://tech.example/iphone', seendate: '20260924T090000Z' },
  ] }) });
  const r = await fetchGdeltCompanyNews('Apple Inc', { fetchImpl, now });
  assert.deepEqual(r.items.map((item) => item.title), ['Apple reveals an iPhone update']);
});

// ── "APPLE" DENTRO "APPLYING" ──
test('titoloParlaDi: confine di PAROLA, non sottostringa', async () => {
  const { titoloParlaDi } = await import('./news.js');
  // Il caso reale segnalato dall'utente: chiedendo notizie su Apple arrivava
  // "Foreign Students APPLYing to US Colleges". Algolia cerca per prefisso, e
  // il filtro guardava solo la data. Il danno non è l'imprecisione: è che una
  // notizia palesemente sbagliata accanto al nome di un'azienda fa sospettare
  // che siano inventati anche i numeri veri lì di fianco.
  assert.equal(titoloParlaDi('Foreign Students Applying to US Colleges Fell 10%', 'Apple'), false);
  assert.equal(titoloParlaDi('Application deadline extended', 'Apple'), false);
  assert.equal(titoloParlaDi('Apple announces new iPhone', 'Apple'), true);
  assert.equal(titoloParlaDi('Microsoft and Apple settle dispute', 'Apple'), true);
  // Anche a inizio e fine titolo, e con punteggiatura attaccata.
  assert.equal(titoloParlaDi('Apple: the next decade', 'Apple'), true);
  assert.equal(titoloParlaDi('Everything about Apple.', 'Apple'), true);
});

test('titoloParlaDi: accenti e maiuscole non contano', async () => {
  const { titoloParlaDi } = await import('./news.js');
  assert.equal(titoloParlaDi('NVIDIA batte le attese', 'nvidia'), true);
  assert.equal(titoloParlaDi('Société Générale in rialzo', 'societe'), true);
});

test('titoloParlaDi: i simboli molto corti passano, e il motivo è dichiarato', async () => {
  const { titoloParlaDi } = await import('./news.js');
  // Con meno di tre lettere il confine di parola non distingue nulla di utile
  // (ticker come "F" o "GM"): meglio qualche notizia in più che nessuna.
  assert.equal(titoloParlaDi('Qualcosa di totalmente scorrelato', 'F'), true);
});

test('titoloParlaDi: titolo vuoto non passa mai', async () => {
  const { titoloParlaDi } = await import('./news.js');
  assert.equal(titoloParlaDi('', 'Apple'), false);
  assert.equal(titoloParlaDi(null, 'Apple'), false);
});

// ============================================================
// BUG REALE segnalato dal vivo dall'utente (2026-08-30, account reale con
// chiavi configurate): "Chiedi a Momentum" restava bloccato su "sto
// cercando..." indefinitamente per certi asset — mai un errore, mai una
// risposta. Riprodotto in isolamento: un provider a chiave reale che resta
// "pending" senza mai rispondere né fallire (host lento/rate-limitato)
// lasciava `await fetchImpl(url)` bloccato per sempre, esattamente lo
// stesso buco già trovato e corretto in src/ai/local-sentiment.js (vedi
// src/core/con-timeout.js, già testato a fondo lì). Qui si verifica solo
// che il collegamento a conTimeout ci sia in ognuna delle 4 fonti — con i
// timer finti, mai un test reale da 15 secondi.
// ============================================================
test('fetchNewsSentiment: un fetch che non risponde mai NON blocca per sempre, scade con un errore chiaro', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const cheNonFiniscePiu = () => new Promise(() => {});
  const p = assert.rejects(
    () => fetchNewsSentiment('AAPL', { apiKey: 'k', fetchImpl: cheNonFiniscePiu }),
    /non risponde da troppo tempo/,
  );
  t.mock.timers.tick(15_000);
  await p;
});

test('fetchFinnhubNews: un fetch che non risponde mai scade con un errore chiaro', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const cheNonFiniscePiu = () => new Promise(() => {});
  const p = assert.rejects(
    () => fetchFinnhubNews('AAPL', { apiKey: 'k', fetchImpl: cheNonFiniscePiu }),
    /non risponde da troppo tempo/,
  );
  t.mock.timers.tick(15_000);
  await p;
});

test('fetchHackerNewsMentions: un fetch che non risponde mai scade con un errore chiaro', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const cheNonFiniscePiu = () => new Promise(() => {});
  const p = assert.rejects(
    () => fetchHackerNewsMentions('Apple', { fetchImpl: cheNonFiniscePiu }),
    /non risponde da troppo tempo/,
  );
  t.mock.timers.tick(15_000);
  await p;
});

test('fetchNewsApiOrg: un fetch che non risponde mai scade con un errore chiaro', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const cheNonFiniscePiu = () => new Promise(() => {});
  const p = assert.rejects(
    () => fetchNewsApiOrg('Apple', { apiKey: 'k', fetchImpl: cheNonFiniscePiu }),
    /non risponde da troppo tempo/,
  );
  t.mock.timers.tick(15_000);
  await p;
});
