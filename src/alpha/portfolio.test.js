import { test } from 'node:test';
import assert from 'node:assert/strict';
import { covarianceMatrix, riskParityWeights, portfolioReturns, portfolioStats } from './portfolio.js';

test('risk-parity dà più peso all\'asset meno volatile', () => {
  const calm = Array.from({ length: 50 }, (_, i) => (i % 2 ? 0.002 : -0.002));
  const wild = Array.from({ length: 50 }, (_, i) => (i % 2 ? 0.05 : -0.05));
  const w = riskParityWeights({ CALM: calm, WILD: wild });
  assert.ok(w.CALM > w.WILD);
  assert.ok(Math.abs(w.CALM + w.WILD - 1) < 1e-6);
});

test('covarianza: la diagonale è la varianza di ciascun asset', () => {
  const a = [0.01, -0.01, 0.02, -0.02, 0.01];
  const cov = covarianceMatrix({ A: a, B: a });
  assert.ok(cov.A.A > 0);
  assert.ok(Math.abs(cov.A.A - cov.A.B) < 1e-9); // A e B identici → cov = var
});

test('portfolioReturns combina i pesi; portfolioStats misura Sharpe/drawdown', () => {
  const up = Array.from({ length: 60 }, () => 0.004);
  const flat = Array.from({ length: 60 }, () => 0.0);
  const pr = portfolioReturns({ UP: 0.5, FLAT: 0.5 }, { UP: up, FLAT: flat });
  assert.ok(Math.abs(pr[0] - 0.002) < 1e-9);
  const stats = portfolioStats(pr);
  assert.ok(stats.annReturn > 0);
  assert.equal(stats.maxDrawdown, 0); // serie monotona crescente
});

test('una serie con crolli ha maxDrawdown > 0', () => {
  const r = [0.05, 0.05, -0.2, 0.03, -0.15, 0.04];
  assert.ok(portfolioStats(r).maxDrawdown > 0);
});
