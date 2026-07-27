import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchCryptoPriceYearsAgo, describeYoyChange, fetchCryptoPriceSeries, yearlyExtremes, fetchCryptoMultiYearComparison } from './year-over-year.js';

test('fetchCryptoPriceYearsAgo: costruisce la data corretta (1 anno fa) e chiama l\'URL giusto', async () => {
  let calledUrl = null;
  const fetchImpl = async (url) => {
    calledUrl = url;
    return { ok: true, json: async () => ({ market_data: { current_price: { eur: 100 } } }) };
  };
  const r = await fetchCryptoPriceYearsAgo('bitcoin', { yearsAgo: 1, fetchImpl, referenceDate: new Date('2026-07-27') });
  assert.equal(r.price, 100);
  assert.equal(r.date, '2025-07-27');
  assert.ok(calledUrl.includes('date=27-07-2025'));
  assert.ok(calledUrl.includes('coins/bitcoin/history'));
});

test('fetchCryptoPriceYearsAgo: fonte senza dato -> null, mai un prezzo inventato', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({}) });
  const r = await fetchCryptoPriceYearsAgo('bitcoin', { fetchImpl });
  assert.equal(r, null);
});

test('fetchCryptoPriceYearsAgo: HTTP non ok -> null', async () => {
  const fetchImpl = async () => ({ ok: false });
  const r = await fetchCryptoPriceYearsAgo('bitcoin', { fetchImpl });
  assert.equal(r, null);
});

test('fetchCryptoPriceYearsAgo: nessun coinId -> null', async () => {
  assert.equal(await fetchCryptoPriceYearsAgo(null, { fetchImpl: async () => ({}) }), null);
});

test('describeYoyChange: variazione positiva', () => {
  const s = describeYoyChange(150, { price: 100, date: '2025-07-27' }, { yearsAgo: 1 });
  assert.ok(s.includes('1 anno fa'));
  assert.ok(s.includes('50% in più'));
});

test('describeYoyChange: variazione negativa', () => {
  const s = describeYoyChange(50, { price: 100, date: '2024-07-27' }, { yearsAgo: 2 });
  assert.ok(s.includes('2 anni fa'));
  assert.ok(s.includes('50% in meno'));
});

test('describeYoyChange: senza dato passato -> null', () => {
  assert.equal(describeYoyChange(100, null), null);
});

test('fetchCryptoPriceSeries: chiama l\'URL range con from/to corretti e mappa i prezzi', async () => {
  let calledUrl = null;
  const fetchImpl = async (url) => {
    calledUrl = url;
    return { ok: true, json: async () => ({ prices: [[1700000000000, 100], [1700086400000, 110]] }) };
  };
  const r = await fetchCryptoPriceSeries('bitcoin', { yearsBack: 5, fetchImpl, referenceDate: new Date('2026-07-27') });
  assert.equal(r.length, 2);
  assert.equal(r[0].price, 100);
  assert.ok(calledUrl.includes('market_chart/range'));
  assert.ok(calledUrl.includes('coins/bitcoin'));
});

test('fetchCryptoPriceSeries: HTTP non ok -> array vuoto, mai un dato inventato', async () => {
  const r = await fetchCryptoPriceSeries('bitcoin', { fetchImpl: async () => ({ ok: false }) });
  assert.deepEqual(r, []);
});

test('fetchCryptoPriceSeries: nessun coinId -> array vuoto', async () => {
  assert.deepEqual(await fetchCryptoPriceSeries(null, { fetchImpl: async () => ({}) }), []);
});

test('yearlyExtremes: trova massimo/minimo reali per anno + variazione', () => {
  const series = [
    { date: '2024-01-01', price: 100 },
    { date: '2024-06-01', price: 150 },
    { date: '2024-12-31', price: 90 },
    { date: '2025-01-01', price: 90 },
    { date: '2025-12-31', price: 200 },
  ];
  const r = yearlyExtremes(series);
  assert.equal(r.length, 2);
  assert.equal(r[0].year, '2024');
  assert.equal(r[0].max.price, 150);
  assert.equal(r[0].min.price, 90);
  assert.ok(r[0].changePct < 0); // 100 -> 90
  assert.equal(r[1].year, '2025');
  assert.ok(r[1].changePct > 0); // 90 -> 200
});

test('yearlyExtremes: serie vuota -> array vuoto', () => {
  assert.deepEqual(yearlyExtremes([]), []);
});

test('fetchCryptoMultiYearComparison: chiama più punti reali (1,2,3,5 anni) e scarta quelli senza dato', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('27-07-2023')) return { ok: false }; // 3 anni fa: fonte senza dato
    return { ok: true, json: async () => ({ market_data: { current_price: { eur: 100 } } }) };
  };
  const r = await fetchCryptoMultiYearComparison('bitcoin', { yearsList: [1, 2, 3], fetchImpl, referenceDate: new Date('2026-07-27') });
  assert.equal(r.length, 2); // 3 anni fa scartato, mai un dato inventato al suo posto
  assert.deepEqual(r.map(x => x.yearsAgo), [1, 2]);
});
