import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInvestmentResearchBrief } from './investment-research-brief.js';

const now = Date.parse('2026-09-25T12:00:00Z');
const stock = { kind: 'stock', symbol: 'AAPL' };

test('annual SEC data and newer documents remain distinct, with a concrete next document', () => {
  const result = buildInvestmentResearchBrief({
    asset: stock,
    snapshot: { year: 2025, snapshotAt: '2026-09-12', cik: 320193 },
    filings: { source: 'SEC EDGAR', filings: [
      { form: '10-Q', filedAt: '2026-09-24', url: 'https://www.sec.gov/Archives/edgar/data/320193/1/a.htm' },
    ] },
    quote: { price: 200, marketAsOf: '2026-09-24' },
    news: { items: [] }, now,
  });
  assert.equal(result.company.status, 'annual');
  assert.equal(result.company.year, 2025);
  assert.equal(result.next.code, 'compare-filing');
  assert.equal(result.next.form, '10-Q');
  assert.equal(result.quote.status, 'dated');
});

test('future or stale quotes never become current evidence', () => {
  const cases = [
    [{ price: 100, marketAsOf: '2026-08-10' }, 'old'],
    [{ price: 100, marketAsOf: '2026-09-27' }, 'unverified'],
    [{ price: 100 }, 'unverified'],
    [{ price: Number.NaN, marketAsOf: '2026-09-25' }, 'unavailable'],
  ];
  for (const [quote, expected] of cases) {
    assert.equal(buildInvestmentResearchBrief({ asset: stock, quote, now }).quote.status, expected);
  }
});

test('community posts and stale headlines do not count as fresh company reporting', () => {
  const result = buildInvestmentResearchBrief({ asset: stock, news: { items: [
    { sourceType: 'community', publishedAt: '2026-09-25T11:00:00Z' },
    { sourceType: 'editorial', publishedAt: '2026-09-01T11:00:00Z' },
    { sourceType: 'editorial', publishedAt: '2026-09-25T10:00:00Z', staleSource: true },
  ] }, now });
  assert.equal(result.news.status, 'community-only');
  assert.equal(result.news.currentCount, 0);
});

test('ETF and crypto do not inherit company balance-sheet or SEC claims', () => {
  const etf = buildInvestmentResearchBrief({ asset: { kind: 'stock', instrumentType: 'etf', symbol: 'SPY' }, now });
  const crypto = buildInvestmentResearchBrief({ asset: { kind: 'crypto', symbol: 'BTC' }, now });
  assert.equal(etf.company.status, 'not-applicable');
  assert.equal(etf.next.code, 'check-fund');
  assert.equal(crypto.company.status, 'not-applicable');
  assert.equal(crypto.next.code, 'check-crypto');
});

test('fresh official quarterly facts are the next check even if the filing list is offline', () => {
  const q = { source: 'SEC EDGAR companyfacts', quarter: { form: '10-Q', end: '2026-06-30', filedAt: '2026-08-01', url: 'https://www.sec.gov/Archives/edgar/data/320193/1/index.html' } };
  const withAnnual = buildInvestmentResearchBrief({ asset: stock, snapshot: { year: 2025, snapshotAt: '2026-09-12' }, quarter: q, now });
  assert.equal(withAnnual.next.code, 'compare-filing');
  const withoutAnnual = buildInvestmentResearchBrief({ asset: stock, quarter: q, now });
  assert.equal(withoutAnnual.next.code, 'read-filing');
});

test('an old quarterly filing remains historical evidence, not a current next step', () => {
  const old = { source: 'SEC EDGAR companyfacts', quarter: { form: '10-Q', end: '2023-06-30', filedAt: '2023-08-01', url: 'https://www.sec.gov/Archives/edgar/data/320193/1/index.html' } };
  assert.equal(buildInvestmentResearchBrief({ asset: stock, quarter: old, now }).next.code, 'find-accounts');
});
