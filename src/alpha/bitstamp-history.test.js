import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchBitstampHistory } from './bitstamp-history.js';

const row = (date, close, volume = '1') => ({ timestamp: String(Date.parse(`${date}T00:00:00Z`) / 1000), close: String(close), volume });

test('lo storico Bitstamp sfoglia all’indietro, senza unire fonti o inventare giorni', async () => {
  const recent = Array.from({ length: 1000 }, (_, i) => {
    const date = new Date(Date.UTC(2018, 0, 1) + i * 3 * 86_400_000).toISOString().slice(0, 10);
    return row(date, 100 + i);
  });
  const older = [row('2011-08-18', 10), row('2011-08-21', 11), row('2017-12-28', 99)];
  const urls = [];
  const result = await fetchBitstampHistory('bitcoin', { fetchImpl: async url => {
    urls.push(url);
    return { ok: true, json: async () => ({ data: { ohlc: urls.length === 1 ? recent : older } }) };
  } });
  assert.equal(result.pair, 'BTCUSD');
  assert.equal(urls.length, 2);
  assert.ok(urls[1].includes('end='));
  assert.equal(result.series[0].date, '2011-08-21');
  assert.equal(result.series.at(-1).date.slice(0, 4), '2026');
  assert.ok(result.series.length < recent.length + older.length);
});

test('scarta candele senza scambi e non chiama la fonte per identità non riconosciute', async () => {
  const result = await fetchBitstampHistory('ethereum', { fetchImpl: async () => ({ ok: true, json: async () => ({ data: { ohlc: [row('2026-01-01', 1, '0'), row('2026-01-04', 2)] } }) }) });
  assert.deepEqual(result.series, [{ date: '2026-01-04', price: 2 }]);
  assert.deepEqual(await fetchBitstampHistory('coin-with-colliding-symbol', { fetchImpl: () => { throw Error('should not call'); } }), { series: [], pair: null });
});

test('un errore di rete lascia disponibili le pagine già ricevute', async () => {
  const recent = Array.from({ length: 1000 }, (_, i) => row(new Date(Date.UTC(2018, 0, 1) + i * 3 * 86_400_000).toISOString().slice(0, 10), i + 1));
  let count = 0;
  const result = await fetchBitstampHistory('bitcoin', { fetchImpl: async () => {
    if (++count === 2) throw Error('offline');
    return { ok: true, json: async () => ({ data: { ohlc: recent } }) };
  } });
  assert.equal(count, 2);
  assert.equal(result.series[0].date.slice(0, 4), '2018');
});
