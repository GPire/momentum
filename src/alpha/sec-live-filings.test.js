import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchRecentSecFilings } from './sec-live-filings.js';

test('official filings are accepted without a user API key', async () => {
  const result = await fetchRecentSecFilings(320193, { fetchImpl: async (url) => {
    assert.equal(url, '/api/market-filings?cik=320193');
    return { ok: true, json: async () => ({ source: 'SEC EDGAR', filings: [
      { form: '8-K', filedAt: '2026-09-24', url: 'https://www.sec.gov/Archives/edgar/data/320193/000032019326000100/aapl.htm' },
      { form: '8-K', filedAt: '2026-09-24', url: 'javascript:alert(1)' },
    ] }) };
  } });
  assert.equal(result.filings.length, 1);
});

test('missing relay is not presented as no corporate events', async () => {
  assert.equal(await fetchRecentSecFilings(320193, { fetchImpl: async () => ({ ok: false }) }), null);
  assert.equal(await fetchRecentSecFilings('bad', { fetchImpl: async () => { throw Error('should not fetch'); } }), null);
});
