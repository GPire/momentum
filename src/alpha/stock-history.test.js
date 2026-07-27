import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchStockMonthlySeries, describeStockYearsAgo, fetchStockMonthlySeriesCascade } from './stock-history.js';

const SAMPLE_SERIES = {
  'Monthly Time Series': {
    '2026-07-24': { '4. close': '120.50' },
    '2025-07-25': { '4. close': '80.00' },
    '2023-07-27': { '4. close': '40.00' },
  },
};

test('fetchStockMonthlySeries: mappa e ordina la serie reale per data', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => SAMPLE_SERIES });
  const r = await fetchStockMonthlySeries('NVDA', { apiKey: 'k', fetchImpl });
  assert.equal(r.length, 3);
  assert.equal(r[0].date, '2023-07-27');
  assert.equal(r[2].price, 120.50);
});

test('fetchStockMonthlySeries: senza chiave -> array vuoto, mai un fetch a vuoto', async () => {
  const r = await fetchStockMonthlySeries('NVDA', { apiKey: null, fetchImpl: async () => ({}) });
  assert.deepEqual(r, []);
});

test('fetchStockMonthlySeries: HTTP non ok -> array vuoto', async () => {
  const r = await fetchStockMonthlySeries('NVDA', { apiKey: 'k', fetchImpl: async () => ({ ok: false }) });
  assert.deepEqual(r, []);
});

test('fetchStockMonthlySeries: quota esaurita (Note/Information) -> array vuoto, mai un dato inventato', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ Note: 'limite raggiunto' }) });
  const r = await fetchStockMonthlySeries('NVDA', { apiKey: 'k', fetchImpl });
  assert.deepEqual(r, []);
});

test('fetchStockMonthlySeries: yearsBack filtra la serie', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => SAMPLE_SERIES });
  const r = await fetchStockMonthlySeries('NVDA', { apiKey: 'k', fetchImpl, yearsBack: 2 });
  assert.ok(r.every(p => p.date >= '2023-07-27' || p.date >= '2024'));
  assert.ok(!r.some(p => p.date === '2023-07-27'));
});

test('describeStockYearsAgo: trova il mese più vicino e calcola la variazione', () => {
  const series = [{ date: '2023-07-27', price: 40 }, { date: '2025-07-25', price: 80 }];
  const s = describeStockYearsAgo(series, 1, 120);
  assert.ok(s.includes('1 anno fa'));
  assert.ok(s.includes('50% in più')); // 80 -> 120
});

test('describeStockYearsAgo: serie non copre così indietro -> null', () => {
  const series = [{ date: '2025-07-25', price: 80 }];
  assert.equal(describeStockYearsAgo(series, 5, 120), null);
});

test('describeStockYearsAgo: serie vuota -> null', () => {
  assert.equal(describeStockYearsAgo([], 1, 100), null);
});

test('fetchStockMonthlySeries: provider Twelve Data mappa e ordina la serie reale', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ status: 'ok', values: [
    { datetime: '2026-07-24', close: '120.50' },
    { datetime: '2023-07-27', close: '40.00' },
  ] }) });
  const r = await fetchStockMonthlySeries('NVDA', { apiKey: 'k', provider: 'twelvedata', fetchImpl });
  assert.equal(r.length, 2);
  assert.equal(r[0].date, '2023-07-27');
});

test('fetchStockMonthlySeries: Twelve Data errore -> array vuoto', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ status: 'error' }) });
  const r = await fetchStockMonthlySeries('NVDA', { apiKey: 'k', provider: 'twelvedata', fetchImpl });
  assert.deepEqual(r, []);
});

test('fetchStockMonthlySeries: provider sconosciuto -> array vuoto', async () => {
  const r = await fetchStockMonthlySeries('NVDA', { apiKey: 'k', provider: 'boh', fetchImpl: async () => ({}) });
  assert.deepEqual(r, []);
});

test('fetchStockMonthlySeriesCascade: usa l\'unico provider con chiave configurata', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ status: 'ok', values: [{ datetime: '2026-01-01', close: '50' }] }) });
  const r = await fetchStockMonthlySeriesCascade('NVDA', { keys: { twelvedata: 't' }, fetchImpl });
  assert.equal(r.provider, 'twelvedata');
  assert.equal(r.series.length, 1);
});

test('fetchStockMonthlySeriesCascade: passa al secondo provider se il primo non dà dati', async () => {
  let call = 0;
  const fetchImpl = async () => {
    call++;
    if (call === 1) return { ok: true, json: async () => ({}) }; // alphavantage: vuoto
    return { ok: true, json: async () => ({ status: 'ok', values: [{ datetime: '2026-01-01', close: '50' }] }) }; // twelvedata: reale
  };
  const r = await fetchStockMonthlySeriesCascade('NVDA', { keys: { alphavantage: 'a', twelvedata: 't' }, fetchImpl });
  assert.equal(r.provider, 'twelvedata');
  assert.equal(r.series.length, 1);
});

test('fetchStockMonthlySeriesCascade: nessuna chiave -> serie vuota, provider null', async () => {
  const r = await fetchStockMonthlySeriesCascade('NVDA', { keys: {}, fetchImpl: async () => ({}) });
  assert.deepEqual(r, { series: [], provider: null });
});

test('fetchStockMonthlySeries: provider Financial Modeling Prep mappa e ordina la serie reale', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ symbol: 'AAPL', historical: [
    { date: '2026-07-24', close: 120.50 },
    { date: '2023-07-27', close: 40.00 },
  ] }) });
  const r = await fetchStockMonthlySeries('AAPL', { apiKey: 'k', provider: 'fmp', fetchImpl });
  assert.equal(r.length, 2);
  assert.equal(r[0].date, '2023-07-27');
});

test('fetchStockMonthlySeries: FMP senza campo historical -> array vuoto', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ 'Error Message': 'Invalid API KEY' }) });
  const r = await fetchStockMonthlySeries('AAPL', { apiKey: 'k', provider: 'fmp', fetchImpl });
  assert.deepEqual(r, []);
});

test('fetchStockMonthlySeriesCascade: prova anche FMP come terzo piano B', async () => {
  let call = 0;
  const fetchImpl = async () => {
    call++;
    if (call <= 2) return { ok: true, json: async () => ({}) }; // alphavantage e twelvedata: vuoti
    return { ok: true, json: async () => ({ historical: [{ date: '2026-01-01', close: 50 }] }) }; // fmp: reale
  };
  const r = await fetchStockMonthlySeriesCascade('AAPL', { keys: { alphavantage: 'a', twelvedata: 't', fmp: 'f' }, fetchImpl });
  assert.equal(r.provider, 'fmp');
  assert.equal(r.series.length, 1);
});
