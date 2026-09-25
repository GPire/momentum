import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSecQuarter, handleMarketQuarter } from './market-quarter.js';

const fact = (val, start, end, filed = '2026-08-01', accn = '0000320193-26-000100') => ({ val, start, end, filed, accn, form: '10-Q' });
const payload = rows => ({ cik: 320193, facts: { 'us-gaap': {
  RevenueFromContractWithCustomerExcludingAssessedTax: { units: { USD: rows } },
  NetIncomeLoss: { units: { USD: [fact(25, '2026-04-01', '2026-06-30')] } },
} } });

test('picks a standalone three-month quarter, never a six-month cumulative figure', () => {
  const r = normalizeSecQuarter(payload([
    fact(90, '2026-01-01', '2026-03-31'),
    fact(210, '2026-01-01', '2026-06-30'),
    fact(120, '2026-04-01', '2026-06-30'),
  ]), 320193, { now: Date.parse('2026-09-25') });
  assert.equal(r.quarter.metrics.revenue.value, 120);
  assert.equal(r.quarter.metrics.netIncome.value, 25);
  assert.equal(r.quarter.end, '2026-06-30');
  assert.match(r.quarter.url, /^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/320193\//);
});

test('future facts, mismatched CIK and absent quarterly coverage never become numbers', () => {
  assert.throws(() => normalizeSecQuarter(payload([]), 123), /mismatch/);
  const future = normalizeSecQuarter({ cik: 320193, facts: { 'us-gaap': {
    RevenueFromContractWithCustomerExcludingAssessedTax: { units: { USD: [fact(300, '2026-10-01', '2026-12-31', '2027-02-01')] } },
  } } }, 320193, { now: Date.parse('2026-09-25') });
  assert.equal(future.quarter, null);
  const absent = normalizeSecQuarter({ cik: 320193, facts: { 'us-gaap': {} } }, 320193);
  assert.equal(absent.quarter, null);
});

test('the public route takes only CIK and returns a compact SEC-sourced record', async () => {
  let upstreamUrl;
  const response = await handleMarketQuarter(new Request('https://example.test/api/market-quarter?cik=320193'), {
    now: Date.parse('2026-09-25'), cache: null,
    fetchImpl: async url => { upstreamUrl = url; return { ok: true, headers: new Headers(), json: async () => payload([fact(120, '2026-04-01', '2026-06-30')]) }; },
  });
  assert.match(upstreamUrl, /companyfacts\/CIK0000320193\.json$/);
  const body = await response.json();
  assert.equal(body.quarter.metrics.revenue.value, 120);
  assert.equal(body.source, 'SEC EDGAR companyfacts');
  assert.equal(body.facts, undefined);
});

test('source failures are not cached as a missing company result', async () => {
  const unavailable = await handleMarketQuarter(new Request('https://example.test/api/market-quarter?cik=320193'), {
    cache: null, fetchImpl: async () => ({ ok: false, headers: new Headers() }),
  });
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.headers.get('cache-control'), 'no-store');
});

test('an amended filing keeps its own form and corrected value', () => {
  const rows = [
    fact(120, '2026-04-01', '2026-06-30', '2026-08-01'),
    { ...fact(121, '2026-04-01', '2026-06-30', '2026-08-12', '0000320193-26-000111'), form: '10-Q/A' },
  ];
  const result = normalizeSecQuarter(payload(rows), 320193, { now: Date.parse('2026-09-25') });
  assert.equal(result.quarter.form, '10-Q/A');
  assert.equal(result.quarter.metrics.revenue.value, 121);
  assert.equal(result.quarter.metrics.netIncome, undefined);
  assert.match(result.quarter.url, /0000320193-26-000111-index\.html$/);
});

test('an amendment to only net income does not relabel prior revenue as amended', () => {
  const amendedIncome = { ...fact(27, '2026-04-01', '2026-06-30', '2026-08-12', '0000320193-26-000111'), form: '10-Q/A' };
  const result = normalizeSecQuarter({ cik: 320193, facts: { 'us-gaap': {
    RevenueFromContractWithCustomerExcludingAssessedTax: { units: { USD: [fact(120, '2026-04-01', '2026-06-30')] } },
    NetIncomeLoss: { units: { USD: [fact(25, '2026-04-01', '2026-06-30'), amendedIncome] } },
  } } }, 320193, { now: Date.parse('2026-09-25') });
  assert.equal(result.quarter.metrics.revenue, undefined);
  assert.equal(result.quarter.metrics.netIncome.value, 27);
});
