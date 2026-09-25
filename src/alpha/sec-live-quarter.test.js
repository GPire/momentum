import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchRecentSecQuarter } from './sec-live-quarter.js';

const valid = { source: 'SEC EDGAR companyfacts', cik: 320193, quarter: {
  start: '2026-04-01', end: '2026-06-30', filedAt: '2026-08-01', form: '10-Q',
  url: 'https://www.sec.gov/Archives/edgar/data/320193/000032019326000100/0000320193-26-000100-index.html',
  metrics: { revenue: { value: 120, filedAt: '2026-08-01', accession: '0000320193-26-000100' } },
} };
test('client accepts only compact companyfacts from the same-origin route', async () => {
  const r = await fetchRecentSecQuarter(320193, { fetchImpl: async url => {
    assert.equal(url, '/api/market-quarter?cik=320193');
    return { ok: true, json: async () => valid };
  } });
  assert.equal(r.quarter.metrics.revenue.value, 120);
  assert.equal(await fetchRecentSecQuarter(320193, { fetchImpl: async () => ({ ok: true, json: async () => ({ ...valid, quarter: { ...valid.quarter, url: 'javascript:alert(1)' } }) }) }), null);
  assert.equal(await fetchRecentSecQuarter(320193, { fetchImpl: async () => ({ ok: true, json: async () => ({ ...valid, cik: 123 }) }) }), null);
});

test('offline or malformed companyfacts do not masquerade as zero revenue', async () => {
  assert.equal(await fetchRecentSecQuarter(320193, { fetchImpl: async () => ({ ok: false }) }), null);
  assert.equal(await fetchRecentSecQuarter('bad', { fetchImpl: async () => { throw Error('should not fetch'); } }), null);
});
