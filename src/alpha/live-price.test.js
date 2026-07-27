import test from 'node:test';
import assert from 'node:assert/strict';

const { fetchLiveCryptoPrice, fetchLiveStockPrice, STOCK_PROVIDER_IDS } = await import('./live-price.js');

function mockFetch(status, body) {
  return async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });
}

test('fetchLiveCryptoPrice: ritorna prezzo + data quando la rete risponde bene', async () => {
  const r = await fetchLiveCryptoPrice('bitcoin', { fetchImpl: mockFetch(200, { bitcoin: { eur: 57054 } }) });
  assert.equal(r.price, 57054);
  assert.ok(r.asOf);
  assert.ok(r.source.includes('CoinGecko'));
});

test('fetchLiveCryptoPrice: alias comuni (btc/eth) mappano all\'id CoinGecko corretto', async () => {
  let calledUrl = null;
  const fetchImpl = async (url) => { calledUrl = url; return { ok: true, status: 200, json: async () => ({ bitcoin: { eur: 100 } }) }; };
  await fetchLiveCryptoPrice('btc', { fetchImpl });
  assert.ok(calledUrl.includes('ids=bitcoin'));
});

test('fetchLiveCryptoPrice: rete assente non inventa un prezzo, lancia un errore onesto', async () => {
  const fetchImpl = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(() => fetchLiveCryptoPrice('bitcoin', { fetchImpl }), /rete non disponibile/i);
});

test('fetchLiveCryptoPrice: risposta HTTP non ok non inventa un prezzo', async () => {
  await assert.rejects(
    () => fetchLiveCryptoPrice('bitcoin', { fetchImpl: mockFetch(429, {}) }),
    /429/,
  );
});

test('fetchLiveCryptoPrice: prezzo mancante nella risposta (formato inatteso) non inventa nulla', async () => {
  await assert.rejects(
    () => fetchLiveCryptoPrice('dogecoin', { fetchImpl: mockFetch(200, { dogecoin: {} }) }),
    /non trovato/i,
  );
});

test('fetchLiveCryptoPrice: valuta diversa da EUR viene rispettata nella richiesta e nella lettura', async () => {
  const r = await fetchLiveCryptoPrice('bitcoin', { vsCurrency: 'usd', fetchImpl: mockFetch(200, { bitcoin: { usd: 61000 } }) });
  assert.equal(r.price, 61000);
});

// ── azioni/indici live (Alpha Vantage / Twelve Data, chiave utente) ─────────
test('fetchLiveStockPrice: senza chiave API tace esplicitamente (nessun tentativo alla cieca)', async () => {
  await assert.rejects(() => fetchLiveStockPrice('SPY', {}), /chiave api personale/i);
});

test('fetchLiveStockPrice: Alpha Vantage, risposta reale-shape → prezzo estratto correttamente', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ 'Global Quote': { '01. symbol': 'IBM', '05. price': '209.28' } }) });
  const r = await fetchLiveStockPrice('IBM', { provider: 'alphavantage', apiKey: 'demo', fetchImpl });
  assert.equal(r.price, 209.28);
  assert.ok(r.source.includes('Alpha Vantage'));
});

test('fetchLiveStockPrice: Twelve Data, risposta reale-shape → prezzo estratto correttamente', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ price: '333.070007' }) });
  const r = await fetchLiveStockPrice('AAPL', { provider: 'twelvedata', apiKey: 'demo', fetchImpl });
  assert.ok(Math.abs(r.price - 333.07) < 0.001);
});

test('fetchLiveStockPrice: limite giornaliero raggiunto (Alpha Vantage risponde 200 con "Note") è onesto, non un prezzo a caso', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ Note: 'Thank you for using Alpha Vantage! Our standard API rate limit is 25 requests per day.' }) });
  await assert.rejects(() => fetchLiveStockPrice('IBM', { apiKey: 'demo', fetchImpl }), /limite richieste/i);
});

test('fetchLiveStockPrice: provider sconosciuto viene rifiutato esplicitamente', async () => {
  await assert.rejects(() => fetchLiveStockPrice('SPY', { provider: 'boh', apiKey: 'x' }), /non supportato/i);
});

test('fetchLiveStockPrice: rete assente non inventa un prezzo', async () => {
  const fetchImpl = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(() => fetchLiveStockPrice('SPY', { apiKey: 'demo', fetchImpl }), /rete non disponibile/i);
});

test('fetchLiveStockPrice: simbolo non trovato (prezzo assente nella risposta) non inventa nulla', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ 'Global Quote': {} }) });
  await assert.rejects(() => fetchLiveStockPrice('ZZZZ', { apiKey: 'demo', fetchImpl }), /non trovato/i);
});
