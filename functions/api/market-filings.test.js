import test from 'node:test';
import assert from 'node:assert/strict';
import { handleMarketFilings, normalizeSecFilings } from './market-filings.js';

const sample = {
  name: 'Apple Inc.',
  filings: { recent: {
    form: ['8-K', '10-Q', '4', '8-K'],
    filingDate: ['2026-09-24', '2026-08-01', '2026-09-25', '2027-01-01'],
    accessionNumber: ['0000320193-26-000100', '0000320193-26-000090', '0000320193-26-000101', '0000320193-27-000001'],
    primaryDocument: ['aapl-20260924.htm', 'aapl-20260801.htm', 'form4.htm', 'future.htm'],
  } },
};

test('only dated, relevant, safe official filings are returned', () => {
  const result = normalizeSecFilings(sample, '320193', { now: Date.parse('2026-09-25T12:00:00Z') });
  assert.equal(result.filings.length, 2);
  assert.deepEqual(result.filings.map(row => row.form), ['8-K', '10-Q']);
  assert.equal(result.filings[0].url, 'https://www.sec.gov/Archives/edgar/data/320193/000032019326000100/aapl-20260924.htm');
  assert.equal('price' in result, false);
  assert.equal('sentiment' in result, false);
});

test('bad CIK is rejected before any request; remote failure is explicit', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return { ok: false }; };
  const bad = await handleMarketFilings(new Request('https://example.test/api/market-filings?cik=../oops'), { fetchImpl });
  assert.equal(bad.status, 400);
  assert.equal(calls, 0);
  const missing = await handleMarketFilings(new Request('https://example.test/api/market-filings?cik=320193'), { fetchImpl });
  assert.equal(missing.status, 503);
});

test('same-origin handler retrieves a single bounded SEC record and caches response', async () => {
  let calls = 0, saved = null, requested = '';
  const cache = { match: async () => saved?.clone(), put: async (_, response) => { saved = response; } };
  const request = new Request('https://example.test/api/market-filings?cik=320193');
  const args = { cache, now: Date.parse('2026-09-25T12:00:00Z'), fetchImpl: async (url, options) => {
    calls++; requested = url;
    assert.match(options.headers['User-Agent'], /Momentum Finance/);
    return { ok: true, json: async () => sample };
  } };
  const first = await handleMarketFilings(request, args);
  assert.equal(first.status, 200);
  assert.equal((await first.json()).filings.length, 2);
  const second = await handleMarketFilings(request, args);
  assert.equal((await second.json()).source, 'SEC EDGAR');
  assert.equal(calls, 1);
  assert.match(requested, /CIK0000320193\.json$/);
});
