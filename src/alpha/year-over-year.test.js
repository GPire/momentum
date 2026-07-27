import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchCryptoPriceYearsAgo, describeYoyChange, fetchCryptoPriceSeries, yearlyExtremes, fetchCryptoMultiYearComparison, fetchCryptoKlinesSeries, fetchCryptoHistoryCascade } from './year-over-year.js';

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

test('fetchCryptoKlinesSeries: chiama Binance senza chiave e mappa il close (indice 4)', async () => {
  let calledUrl = null;
  const fetchImpl = async (url) => {
    calledUrl = url;
    return { ok: true, json: async () => ([[1700000000000, '100', '110', '90', '105', '1000']]) };
  };
  const r = await fetchCryptoKlinesSeries('BTC', { fetchImpl });
  assert.equal(r.length, 1);
  assert.equal(r[0].price, 105);
  assert.ok(calledUrl.includes('BTCEUR'));
  assert.ok(!calledUrl.includes('apikey') && !calledUrl.includes('api_key')); // nessuna chiave richiesta
});

test('fetchCryptoKlinesSeries: simbolo non quotato su Binance -> array vuoto', async () => {
  const r = await fetchCryptoKlinesSeries('XYZ', { fetchImpl: async () => ({ ok: false }) });
  assert.deepEqual(r, []);
});

test('fetchCryptoKlinesSeries: nessun simbolo -> array vuoto', async () => {
  assert.deepEqual(await fetchCryptoKlinesSeries(null, { fetchImpl: async () => ({}) }), []);
});

test('fetchCryptoHistoryCascade: usa Binance se disponibile (fonte primaria, senza chiave)', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ([[1700000000000, '1', '1', '1', '100', '1'], [1702678400000, '1', '1', '1', '105', '1']]) });
  const r = await fetchCryptoHistoryCascade('bitcoin', 'BTC', { fetchImpl });
  assert.equal(r.source, 'binance');
  assert.equal(r.series.length, 2);
});

test('fetchCryptoHistoryCascade: ripiega su CoinGecko se il simbolo non è su Binance', async () => {
  let call = 0;
  const fetchImpl = async () => {
    call++;
    if (call === 1) return { ok: false }; // Binance: simbolo assente
    return { ok: true, json: async () => ({ prices: [[1700000000000, 50]] }) }; // CoinGecko: reale
  };
  const r = await fetchCryptoHistoryCascade('somecoin', 'XYZ', { fetchImpl });
  assert.equal(r.source, 'coingecko');
  assert.equal(r.series.length, 1);
});

test('fetchCryptoHistoryCascade: entrambe le fonti falliscono -> source null, mai un dato inventato', async () => {
  const fetchImpl = async () => ({ ok: false });
  const r = await fetchCryptoHistoryCascade('somecoin', 'XYZ', { fetchImpl });
  assert.equal(r.source, null);
  assert.deepEqual(r.series, []);
});
