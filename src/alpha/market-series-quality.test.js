import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanPriceSeries, commonReturns } from './market-series-quality.js';

test('rejects impossible dates, partial numbers, nonpositive prices and conflicting duplicates', () => {
  const r = cleanPriceSeries([
    { date: '2026-02-30', price: 10 }, { date: '2026-01-01', price: '12bad' },
    { date: '2026-01-02', price: 0 }, { date: '2026-01-03', price: 20 },
    { date: '2026-01-03', price: 21 }, { date: '2026-01-04', price: '22' },
    { date: '2026-01-04', price: 22 },
  ]);
  assert.deepEqual(r, [{ date: '2026-01-04', price: 22 }]);
});

test('common returns have a real previous observation and preserve weekend compounding', () => {
  const r = commonReturns({
    stock: [{ date: '2026-09-04', price: 100 }, { date: '2026-09-07', price: 110 }],
    crypto: [{ date: '2026-09-04', price: 100 }, { date: '2026-09-05', price: 120 }, { date: '2026-09-07', price: 150 }],
    vix: [{ date: '2026-09-04', price: 20 }, { date: '2026-09-07', price: 22 }],
  }, { levels: ['vix'] });
  assert.deepEqual(r.dates, ['2026-09-07']);
  assert.ok(Math.abs(r.series.stock[0] - 0.1) < 1e-12);
  assert.equal(r.series.crypto[0], 0.5);
  assert.equal(r.series.vix[0], 22);
  assert.deepEqual(commonReturns({ one: [{ date: '2026-09-04', price: 10 }] }).dates, []);
});
