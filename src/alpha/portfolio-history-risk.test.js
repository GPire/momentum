import test from 'node:test';
import assert from 'node:assert/strict';
import { portfolioHistoryRisk } from './portfolio-history-risk.js';
const series = (scale = 1) => Array.from({ length: 301 }, (_, i) => ({ date: new Date(Date.UTC(2024, 0, i + 1)).toISOString().slice(0, 10), price: scale * (100 + i % 13) }));
const asset = (currency = 'USD') => ({ currency, source: 'fixture', points: series() });

test('stocks, ETFs and crypto use actual histories with reconciled signed contributions', () => {
  const r = portfolioHistoryRisk([{ ticker: 'A', valueBase: 100 }, { ticker: 'B', valueBase: 200 }], {
    histories: { A: asset(), B: asset() }, baseCurrency: 'USD', horizon: 1,
  });
  assert.equal(r.available, true);
  assert.equal(r.coverage, 1);
  assert.equal(r.windows, 300);
  assert.ok(Math.abs(r.contributions.reduce((s, a) => s + a.returnContribution, 0) - r.expectedShortfall) < 1e-12);
});

test('foreign prices require dated FX; current FX never substitutes historical FX', () => {
  const p = [{ ticker: 'A', valueBase: 100 }];
  assert.equal(portfolioHistoryRisk(p, { histories: { A: asset('EUR') }, baseCurrency: 'USD', horizon: 1 }).available, false);
  const r = portfolioHistoryRisk(p, { histories: { A: asset('EUR') }, baseCurrency: 'USD', horizon: 1,
    fx: { EUR: { source: 'fixture', baseCurrency: 'USD', points: series(0.01) } } });
  assert.equal(r.available, true);
});

test('unknown valuation prevents a false full-coverage claim', () => {
  const r = portfolioHistoryRisk([{ ticker: 'A', valueBase: 100 }, { ticker: 'B' }], { histories: { A: asset() }, baseCurrency: 'USD' });
  assert.equal(r.available, false);
  assert.equal(r.reason, 'unknown-valuation');
});

test('young histories and overlapping horizons cannot invent a large tail sample', () => {
  const r = portfolioHistoryRisk([{ ticker: 'A', valueBase: 100 }], { histories: { A: asset() }, baseCurrency: 'USD', horizon: 21 });
  assert.equal(r.available, false);
  assert.equal(r.reason, 'insufficient-tail');
  assert.equal(r.windows, 14);
});

test('coverage uses all valued positions and never includes future observations', () => {
  const r = portfolioHistoryRisk([{ ticker: 'A', valueBase: 600 }, { ticker: 'B', valueBase: 400 }], {
    histories: { A: asset() }, baseCurrency: 'USD', horizon: 1, asOf: '2024-09-01',
  });
  assert.equal(r.available, true);
  assert.equal(r.coverage, 0.6);
  assert.equal(r.excluded[0].ticker, 'B');
  assert.equal(r.last, '2024-09-01');
  assert.equal(r.changeBase, r.expectedShortfall * 600);
});

test('duplicated holdings aggregate and malformed history is excluded safely', () => {
  const options = { histories: { A: asset() }, baseCurrency: 'USD', horizon: 1 };
  assert.deepEqual(portfolioHistoryRisk([{ ticker: 'A', valueBase: 50 }, { ticker: 'A', valueBase: 50 }], options),
    portfolioHistoryRisk([{ ticker: 'A', valueBase: 100 }], options));
  assert.equal(portfolioHistoryRisk([{ ticker: 'A', valueBase: 100 }], {
    ...options, histories: { A: { ...asset(), points: {} } },
  }).available, false);
});
