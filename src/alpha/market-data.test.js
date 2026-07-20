import test from 'node:test';
import assert from 'node:assert/strict';

const { parseStooqCsv, parseCoinGeckoJson, parseGenericCsv, fetchPrices, toReturns, mergePeerPrices } = await import('./market-data.js');

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

// ── priceSource: provenienza sempre dichiarata (regola #1) ──

test('fetchPrices: priceSource = id fonte quando il dato è live', async () => {
  const cache = { store: {}, async get(k) { return this.store[k]; }, async put(k, v) { this.store[k] = v; } };
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ prices: [[1751328000000, 100], [1751414400000, 102]] }) });
  const r = await fetchPrices({ symbol: 'bitcoin', kind: 'crypto', fetchImpl, cache });
  assert.equal(r.priceSource, 'coingecko');
  assert.equal(cache.store['mkt:crypto:bitcoin'].priceSource, 'coingecko'); // anche in cache
});

test('fetchPrices: priceSource = holt-estimate quando cade su cache CON stima', async () => {
  // ≥3 close in cache → estimateCurrentPrice produce una stima etichettata
  const cached = { prices: [{ date: '2026-07-01', close: 99 }, { date: '2026-07-02', close: 100 }, { date: '2026-07-03', close: 101 }], source: 'coingecko', asOf: '2026-07-03T00:00:00Z' };
  const cache = { store: { 'mkt:crypto:bitcoin': cached }, async get(k) { return this.store[k]; }, async put() {} };
  const fetchImpl = async () => { throw new TypeError('Failed to fetch'); }; // CORS
  const r = await fetchPrices({ symbol: 'bitcoin', kind: 'crypto', fetchImpl, cache });
  assert.equal(r.stale, true);
  assert.ok(r.estimatedNow);
  assert.equal(r.priceSource, 'holt-estimate');
});

test('fetchPrices: priceSource = cache quando la cache non basta per la stima', async () => {
  // 1 solo close → Holt impossibile → cache pura, dichiarata come tale
  const cache = { store: { 'mkt:crypto:bitcoin': { prices: [{ date: '2026-07-01', close: 99 }], source: 'coingecko', asOf: '2026-07-01T00:00:00Z' } }, async get(k) { return this.store[k]; }, async put() {} };
  const fetchImpl = async () => { throw new TypeError('Failed to fetch'); };
  const r = await fetchPrices({ symbol: 'bitcoin', kind: 'crypto', fetchImpl, cache });
  assert.equal(r.stale, true);
  assert.equal(r.estimatedNow, null);
  assert.equal(r.priceSource, 'cache');
});

test('fetchPrices: priceSource = null quando non c\'è nessun dato', async () => {
  const cache = { async get() { return null; }, async put() {} };
  const fetchImpl = async () => ({ ok: false, status: 429 });
  const r = await fetchPrices({ symbol: 'bitcoin', kind: 'crypto', fetchImpl, cache });
  assert.equal(r.priceSource, null);
});

// ── mergePeerPrices: newest-wins + anti-poison (stessa filosofia di update-ledger) ──

const localCached = () => ({ prices: [{ date: '2026-07-01', close: 100 }, { date: '2026-07-02', close: 102 }], source: 'coingecko', asOf: '2026-07-02T00:00:00Z', stale: true });
const peerPayload = () => ({ kind: 'crypto', asOf: '2026-07-10T00:00:00Z', source: 'coingecko', series: [{ date: '2026-07-09', close: 105 }, { date: '2026-07-10', close: 106 }] });

test('mergePeerPrices: peer più recente e plausibile → accettato con peer:<id>', () => {
  const r = mergePeerPrices(localCached(), peerPayload(), 'nodo-B');
  assert.ok(r);
  assert.equal(r.priceSource, 'peer:nodo-B');
  assert.equal(r.stale, false);                    // dato reale, non stimato
  assert.equal(r.asOf, '2026-07-10T00:00:00Z');    // mantiene l'asOf del peer
  assert.equal(r.prices.length, 2);
});

test('mergePeerPrices: accetta anche senza dato locale (primo dato per il simbolo)', () => {
  const r = mergePeerPrices(null, peerPayload(), 'nodo-B');
  assert.equal(r?.priceSource, 'peer:nodo-B');
});

test('mergePeerPrices: peer più vecchio o pari → rifiutato (newest-wins stretto)', () => {
  assert.equal(mergePeerPrices(localCached(), { ...peerPayload(), asOf: '2026-07-01T00:00:00Z' }, 'B'), null);
  assert.equal(mergePeerPrices(localCached(), { ...peerPayload(), asOf: '2026-07-02T00:00:00Z' }, 'B'), null);
});

test('mergePeerPrices: salto del 60% sull\'ultimo close → rifiutato (anti-poison)', () => {
  // locale chiude a 102, il peer dichiara 163.2 = +60% → non plausibile
  const r = mergePeerPrices(localCached(), { ...peerPayload(), series: [{ date: '2026-07-10', close: 163.2 }] }, 'B');
  assert.equal(r, null);
});

test('mergePeerPrices: date non monotone → rifiutato', () => {
  const r = mergePeerPrices(localCached(), { ...peerPayload(), series: [{ date: '2026-07-10', close: 105 }, { date: '2026-07-09', close: 106 }] }, 'B');
  assert.equal(r, null);
});

test('mergePeerPrices: close non positivi, serie vuota o payload rotto → rifiutato', () => {
  assert.equal(mergePeerPrices(localCached(), { ...peerPayload(), series: [{ date: '2026-07-10', close: 0 }] }, 'B'), null);
  assert.equal(mergePeerPrices(localCached(), { ...peerPayload(), series: [] }, 'B'), null);
  assert.equal(mergePeerPrices(localCached(), null, 'B'), null);
  assert.equal(mergePeerPrices(null, { series: [{ date: '2026-07-10', close: 1 }] }, 'B'), null); // manca asOf
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
