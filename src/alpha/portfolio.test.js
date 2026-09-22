import { test } from 'node:test';
import assert from 'node:assert/strict';
import { covarianceMatrix, riskParityWeights, portfolioReturns, portfolioStats, currentWeights, rebalanceSuggestions } from './portfolio.js';

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

test('currentWeights: pesi reali dal valore di mercato (quantità × prezzo), somma 1', () => {
  const positions = [{ ticker: 'AAPL', quantity: 10 }, { ticker: 'MSFT', quantity: 5 }];
  const w = currentWeights(positions, { AAPL: 100, MSFT: 200 }); // 1000 vs 1000
  assert.equal(w.AAPL, 0.5);
  assert.equal(w.MSFT, 0.5);
});

test('currentWeights: posizione senza prezzo noto o quantità non finita viene esclusa, mai un peso inventato', () => {
  const positions = [{ ticker: 'AAPL', quantity: 10 }, { ticker: 'GHOST', quantity: 5 }];
  const w = currentWeights(positions, { AAPL: 100 }); // GHOST senza prezzo
  assert.equal(w.AAPL, 1);
  assert.equal(w.GHOST, undefined);
});

test('currentWeights: due posizioni sullo stesso ticker si sommano (mai due voci separate per lo stesso titolo)', () => {
  const positions = [{ ticker: 'AAPL', quantity: 4 }, { ticker: 'AAPL', quantity: 6 }];
  const w = currentWeights(positions, { AAPL: 50 });
  assert.equal(w.AAPL, 1);
});

test('currentWeights: nessuna posizione valutabile → oggetto vuoto, mai un crash o pesi a somma diversa da 1', () => {
  assert.deepEqual(currentWeights([], {}), {});
  assert.deepEqual(currentWeights([{ ticker: 'X', quantity: 1 }], {}), {});
});

test('rebalanceSuggestions: uno scostamento sopra soglia genera un suggerimento con la direzione corretta', () => {
  const current = { AAPL: 0.7, MSFT: 0.3 };
  const target = { AAPL: 0.5, MSFT: 0.5 };
  const out = rebalanceSuggestions(current, target);
  assert.equal(out.length, 2);
  const aapl = out.find(o => o.ticker === 'AAPL');
  assert.equal(aapl.action, 'reduce'); // pesa più del target → ridurre
  assert.equal(aapl.deltaPts, 20);
  const msft = out.find(o => o.ticker === 'MSFT');
  assert.equal(msft.action, 'increase'); // pesa meno del target → aumentare
});

test('rebalanceSuggestions: uno scostamento minimo (rumore quotidiano dei prezzi) NON genera un segnale', () => {
  const current = { AAPL: 0.52, MSFT: 0.48 };
  const target = { AAPL: 0.5, MSFT: 0.5 };
  assert.deepEqual(rebalanceSuggestions(current, target), []);
});

test('rebalanceSuggestions: un ticker presente solo nel target (posizione mai aperta) genera comunque "increase" da zero', () => {
  const out = rebalanceSuggestions({}, { AAPL: 1 });
  assert.equal(out.length, 1);
  assert.equal(out[0].action, 'increase');
  assert.equal(out[0].currentPct, 0);
});

test('rebalanceSuggestions: ordinato per gravità, scostamento più grande prima', () => {
  const out = rebalanceSuggestions({ A: 0.9, B: 0.1 }, { A: 0.5, B: 0.5 });
  assert.equal(out[0].ticker, 'A'); // 40 punti di scostamento, il più grande
});
