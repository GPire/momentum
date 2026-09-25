import test from 'node:test';
import assert from 'node:assert/strict';
import { collectCryptoHistoryEvidence } from './independent-history.js';

test('a failed optional comparison does not discard a real chart series', async () => {
  const series = [{ date: '2026-01-01', price: 4 }, { date: '2026-02-01', price: 6 }];
  const result = await collectCryptoHistoryEvidence({
    livePrice: () => Promise.reject(new Error('rate limited')),
    yearAgo: () => Promise.reject(new Error('offline')),
    history: () => ({ series }),
    multiYear: () => Promise.reject(new Error('not available')),
  });
  assert.deepEqual(result.series, series);
  assert.equal(result.live, null);
  assert.deepEqual(result.multiYear, []);
});

test('failed chart retrieval never manufactures history from other evidence', async () => {
  const result = await collectCryptoHistoryEvidence({
    livePrice: () => ({ price: 10 }),
    yearAgo: () => ({ price: 5 }),
    history: () => Promise.reject(new Error('offline')),
    multiYear: () => [],
  });
  assert.deepEqual(result.series, []);
  assert.equal(result.live.price, 10);
});
