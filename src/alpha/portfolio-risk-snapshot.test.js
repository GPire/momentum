import test from 'node:test';
import assert from 'node:assert/strict';
import { portfolioRiskSnapshot } from './portfolio-risk-snapshot.js';
import { parsePortfolioCsv, analyzePortfolio } from './portfolio-import.js';

const points = Array.from({ length: 301 }, (_, i) => ({
  date: new Date(Date.UTC(2024, 0, i + 1)).toISOString().slice(0, 10), price: 100 + i % 13,
}));
const asOf = points.at(-1).date;
const holding = { ticker: 'A', quantity: 2, avgPrice: 1, assetClass: 'stock' };
const context = () => ({ baseCurrency: 'USD', asOf, horizon: 1,
  quotes: { A: { price: 150, currency: 'USD', date: asOf, source: 'quote-fixture' } },
  histories: { A: { currency: 'USD', source: 'history-fixture', points } },
});

test('analysis entry point values actual quantities without using purchase price', () => {
  const positions = [holding], riskContext = context();
  const before = JSON.stringify({ positions, riskContext });
  const { historicalRisk: risk } = analyzePortfolio(positions, { riskContext });
  assert.equal(risk.available, true);
  assert.equal(risk.totalValue, 300);
  assert.equal(risk.valuations[0].quoteSource, 'quote-fixture');
  assert.equal(JSON.stringify({ positions, riskContext }), before);
  assert.equal(analyzePortfolio(positions).historicalRisk.reason, 'missing-risk-context');
});

test('one unknown position blocks valuation instead of claiming complete coverage', () => {
  const result = portfolioRiskSnapshot([holding, { ...holding, ticker: 'B' }], context());
  assert.equal(result.reason, 'incomplete-valuation');
  assert.deepEqual(result.issues, [{ ticker: 'B', reason: 'missing-quote' }]);
  assert.equal(result.expectedShortfall, undefined);
});

test('FX uses quote date and records its source, never an undated current rate', () => {
  const options = context();
  options.baseCurrency = 'EUR';
  assert.equal(portfolioRiskSnapshot([holding], options).issues[0].reason, 'missing-valuation-fx');
  options.fx = { USD: { baseCurrency: 'EUR', source: 'fx-fixture', points: points.map(p => ({ date: p.date, price: 0.9 })) } };
  const risk = portfolioRiskSnapshot([holding], options);
  assert.equal(risk.available, true);
  assert.equal(risk.totalValue, 270);
  assert.equal(risk.valuations[0].fxSource, 'fx-fixture');
  options.fx.USD.points.pop();
  assert.equal(portfolioRiskSnapshot([holding], options).issues[0].reason, 'missing-valuation-fx');
});

test('future, stale, malformed and overflowing quotes cannot feed the model', () => {
  for (const [changes, reason] of [
    [{ date: '2025-01-01' }, 'quote-outside-window'],
    [{ date: '2024-01-01' }, 'quote-outside-window'],
    [{ date: '2024-02-30' }, 'missing-quote'],
    [{ price: '150' }, 'missing-quote'],
    [{ price: Number.MAX_VALUE }, 'invalid-valuation'],
  ]) {
    const options = context(); Object.assign(options.quotes.A, changes);
    assert.equal(portfolioRiskSnapshot([holding], options).issues[0].reason, reason);
  }
});

test('stale common history suppresses risk figures even with fresh quotes', () => {
  const options = context();
  options.histories.A.points = points.slice(0, -10);
  const risk = portfolioRiskSnapshot([holding], options);
  assert.equal(risk.reason, 'stale-history');
  assert.equal(risk.expectedShortfall, undefined);
});

test('CSV currency survives import and mismatches cannot be treated as base currency', () => {
  const rows = parsePortfolioCsv('ticker;quantity;avgprice;valuta\nA;2;1;eur');
  assert.equal(rows[0].currency, 'EUR');
  assert.equal(portfolioRiskSnapshot(rows, context()).issues[0].reason, 'currency-mismatch');
  const invalid = parsePortfolioCsv('ticker,quantity,currency\nA,2,US$');
  assert.equal(portfolioRiskSnapshot(invalid, context()).available, false);
  const options = context(); options.histories.A.currency = 'EUR';
  assert.equal(portfolioRiskSnapshot([holding], options).issues[0].reason, 'currency-mismatch');
});

test('invalid holdings and options return explicit unavailable states', () => {
  for (const quantity of [0, -1, NaN, Infinity, '2']) {
    assert.equal(portfolioRiskSnapshot([{ ...holding, quantity }], context()).issues[0].reason, 'invalid-holding');
  }
  assert.equal(portfolioRiskSnapshot([holding], { ...context(), asOf: undefined }).reason, 'invalid-options');
  assert.equal(portfolioRiskSnapshot([holding], { ...context(), maxAgeDays: -1 }).reason, 'invalid-options');
  assert.equal(portfolioRiskSnapshot([], context()).reason, 'empty-portfolio');
});
