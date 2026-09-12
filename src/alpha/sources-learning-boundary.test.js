import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchVerified, trainingEligible, plausibility } from './sources.js';

const prices = [{ date: '2026-09-10', close: 100 }, { date: '2026-09-11', close: 101 }];
const source = (id, currency = 'EUR') => ({ id, currency, kind: 'prices', assetKinds: ['crypto'],
  cors: 'yes', type: 'json', parse: x => x, urlFor: () => id });
const response = data => ({ ok: true, json: async () => data });

test('live stock requests never consult crypto providers and cache keys separate asset classes', async () => {
  const calls = [], keys = [];
  await fetchVerified({ symbol: 'AAPL', assetKind: 'stock', params: { apiKey: 'fixture' },
    cache: { put: async k => keys.push(k) }, fetchImpl: async url => {
      calls.push(url); return response({ 'Time Series (Daily)': { '2026-09-11': { '4. close': '100' } } });
    } });
  assert.equal(calls.length, 1);
  assert.ok(calls[0].startsWith('https://www.alphavantage.co/'));
  assert.deepEqual(keys, ['vrf:prices:stock:AAPL']);
});

test('duplicate source cannot confirm itself, and mismatching currencies never cross-confirm', async () => {
  const a = source('a');
  const duplicate = await fetchVerified({ symbol: 'coin', sources: [a, a], fetchImpl: async () => response(prices) });
  assert.equal(duplicate.verified, 'single-source');
  const different = await fetchVerified({ symbol: 'coin', sources: [a, source('b', 'USD')], fetchImpl: async () => response(prices) });
  assert.equal(different.verified, 'unconfirmed');
  assert.equal(trainingEligible(different), false);
});

test('matching latest quote does not hide malformed history in second source', async () => {
  const r = await fetchVerified({ symbol: 'coin', sources: [source('a'), source('b')],
    fetchImpl: async url => response(url === 'a' ? prices : [{ date: '2026-02-30', close: 100 }, prices[1]]) });
  assert.equal(r.verified, 'unconfirmed');
});

test('training gate rechecks data instead of trusting verified labels', () => {
  const base = { prices, verified: 'confirmed', asOf: '2026-09-11T10:00:00Z' };
  assert.equal(trainingEligible(base), true);
  for (const changes of [
    { synthetic: true }, { estimated: true }, { asOf: '2026-09-09' }, { asOf: 123 }, { prices: [null] },
    { prices: [{ date: '2026-02-30', close: 100 }] },
    { prices: [{ date: '2026-09-11', close: NaN }] },
    { prices: [prices[1], prices[0]] },
    { prices: [prices[0], { ...prices[0], close: 102 }] },
  ]) assert.equal(trainingEligible({ ...base, ...changes }), false, JSON.stringify(changes));
  assert.equal(trainingEligible({ ...base, kind: 'macro', prices: [{ date: '2026-09-11', close: -0.1 }] }), true);
  assert.equal(plausibility([{ date: 'nonsense', close: 10 }]).plausible, false);
});

test('typed requests do not reuse legacy cache with ambiguous instrument identity', async () => {
  const requested = [];
  const r = await fetchVerified({ symbol: 'coin', assetKind: 'crypto', sources: [],
    cache: { get: async key => { requested.push(key); return null; } } });
  assert.deepEqual(requested, ['vrf:prices:crypto:coin']);
  assert.equal(trainingEligible(r), false);
});
