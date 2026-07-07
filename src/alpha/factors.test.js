import { test } from 'node:test';
import assert from 'node:assert/strict';
import { percentileRank, valueScore, growthScore, momentumScore, riskScore } from './factors.js';

test('percentileRank: soglie dinamiche, neutro senza dati', () => {
  assert.equal(percentileRank(5, [1, 2, 3, 4, 10], true), 0.8);
  assert.equal(percentileRank(5, [1, 2, 3, 4, 10], false), 0.2); // basso è meglio
  assert.equal(percentileRank(5, [], true), 0.5); // neutro
});

test('valueScore: un asset a sconto e solido batte uno caro e indebitato', () => {
  const peers = { pe: [10, 20, 30], pb: [1, 2, 3], roe: [5, 15, 25], debtEquity: [0.2, 0.5, 1.0], fcfYield: [1, 3, 6] };
  const cheap = valueScore({ pe: 9, pb: 0.9, roe: 26, debtEquity: 0.1, fcfYield: 7 }, peers);
  const pricey = valueScore({ pe: 31, pb: 3.5, roe: 4, debtEquity: 1.2, fcfYield: 0.5 }, peers);
  assert.ok(cheap.score > pricey.score);
  assert.ok(cheap.score > 0.8 && pricey.score < 0.2);
});

test('growthScore premia crescita alta a PEG basso', () => {
  const peers = { revCagr: [5, 10, 20], epsCagr: [5, 12, 25], peg: [0.8, 1.5, 3] };
  const g = growthScore({ revCagr: 22, epsCagr: 26, peg: 0.7, marginTrend: 0.1 }, peers);
  assert.ok(g.score > 0.7);
});

test('momentumScore: trend rialzista netto → score alto; dati scarsi → neutro', () => {
  const up = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
  assert.ok(momentumScore(up).score > 0.6);
  assert.equal(momentumScore([1, 2, 3]).score, 0.5);
});

test('riskScore: serie volatile con drawdown → score più basso di una stabile', () => {
  const stable = Array.from({ length: 30 }, () => 0.005);
  const wild = Array.from({ length: 30 }, (_, i) => (i % 2 ? -0.08 : 0.09));
  assert.ok(riskScore(stable).score > riskScore(wild).score);
  assert.ok(riskScore([0.01]).score === 0.5); // dati insufficienti → neutro
});

test('ogni fattore porta la spiegazione (parts), mai numero orfano', () => {
  for (const r of [valueScore({}, {}), growthScore({}, {}), momentumScore([]), riskScore([])]) {
    assert.ok(Array.isArray(r.parts) && r.parts.length > 0);
    assert.ok(typeof r.score === 'number');
  }
});
