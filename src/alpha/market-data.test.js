import test from 'node:test';
import assert from 'node:assert/strict';

const { parseStooqCsv, parseCoinGeckoJson, parseGenericCsv, fetchPrices, toReturns } = await import('./market-data.js');

test('parseStooqCsv: estrae date e close', () => {
  const csv = 'Date,Open,High,Low,Close,Volume\n2026-07-01,10,11,9,10.5,1000\n2026-07-02,10.5,12,10,11.2,900';
  const p = parseStooqCsv(csv);
  assert.equal(p.length, 2);
  assert.deepEqual(p[0], { date: '2026-07-01', close: 10.5 });
  assert.equal(p[1].close, 11.2);
});

test('parseCoinGeckoJson: [ms, price] → serie', () => {
  const j = { prices: [[1751328000000, 55000.5], [1751414400000, 56100]] };
  const p = parseCoinGeckoJson(j);
  assert.equal(p.length, 2);
  assert.equal(p[1].close, 56100);
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(p[0].date));
});

test('parseGenericCsv: rileva colonne, normalizza date dd/mm/yyyy', () => {
  const csv = 'Data;Prezzo\n01/07/2026;10,50\n02/07/2026;11,20';
  const p = parseGenericCsv(csv);
  assert.equal(p.length, 2);
  assert.equal(p[0].date, '2026-07-01');
  assert.equal(p[0].close, 10.5);
});

test('fetchPrices: sorgente ok → prezzi + cache aggiornata', async () => {
  const cache = { store: {}, async get(k) { return this.store[k]; }, async put(k, v) { this.store[k] = v; } };
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ prices: [[1751328000000, 100], [1751414400000, 102]] }) });
  const r = await fetchPrices({ symbol: 'bitcoin', kind: 'crypto', fetchImpl, cache });
  assert.equal(r.stale, false);
  assert.equal(r.source, 'coingecko');
  assert.equal(r.prices.length, 2);
  assert.ok(cache.store['mkt:crypto:bitcoin']);
});

test('fetchPrices: CORS/rete giù → cade sulla cache (stale) senza crash', async () => {
  const cache = { store: { 'mkt:crypto:bitcoin': { prices: [{ date: '2026-07-01', close: 99 }], source: 'coingecko', asOf: '2026-07-01T00:00:00Z' } }, async get(k) { return this.store[k]; }, async put() {} };
  const fetchImpl = async () => { throw new TypeError('Failed to fetch'); }; // simula blocco CORS
  const r = await fetchPrices({ symbol: 'bitcoin', kind: 'crypto', fetchImpl, cache });
  assert.equal(r.stale, true);
  assert.equal(r.prices[0].close, 99);
  assert.ok(/offline|non raggiungibile/i.test(r.note));
});

test('fetchPrices: nessuna cache e fonti giù → dichiara, offre import CSV, mai inventa', async () => {
  const cache = { async get() { return null; }, async put() {} };
  const fetchImpl = async () => ({ ok: false, status: 429 });
  const r = await fetchPrices({ symbol: 'bitcoin', kind: 'crypto', fetchImpl, cache });
  assert.equal(r.prices.length, 0);
  assert.ok(/CSV/i.test(r.note));
});

test('toReturns: rendimenti giornalieri corretti', () => {
  const r = toReturns([{ close: 100 }, { close: 110 }, { close: 99 }]);
  assert.equal(r.length, 2);
  assert.ok(Math.abs(r[0] - 0.1) < 1e-9);
  assert.ok(Math.abs(r[1] - (-0.1)) < 1e-9);
});

test('estimateCurrentPrice: estrapola col trend (Holt), etichettata coi giorni', async () => {
  const { estimateCurrentPrice } = await import('./market-data.js');
  // serie in salita lineare +1/giorno fino al 2026-06-10 (close 110)
  const prices = [];
  for (let i = 0; i < 11; i++) { const d = new Date('2026-06-01'); d.setDate(d.getDate() + i); prices.push({ date: d.toISOString().slice(0, 10), close: 100 + i }); }
  const est = estimateCurrentPrice(prices, { asOfDate: '2026-06-10', now: new Date('2026-06-15') }); // 5 giorni dopo
  assert.equal(est.daysAhead, 5);
  assert.ok(est.estimate > 110);            // trend positivo → stima sopra l'ultimo
  assert.ok(est.estimate < 130);            // ma ragionevole (~115 col trend +1/g)
  assert.equal(est.method, 'holt');
});

test('estimateCurrentPrice: null se troppo pochi dati', async () => {
  const { estimateCurrentPrice } = await import('./market-data.js');
  assert.equal(estimateCurrentPrice([{ date: '2026-06-01', close: 100 }]), null);
});
