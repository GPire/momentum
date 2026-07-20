import test from 'node:test';
import assert from 'node:assert/strict';

// Modulo puro (nessun DOM/vault): niente shim necessari.
const nw = await import('./net-worth.js');

const TX = { '2026-06': [
  { type: 'entrata', amount: 2000 },
  { type: 'uscita', amount: 500 },
  { type: 'invest', amount: 300 },
] };

test('cashFromTransactions: entrata +, uscita −, invest esce dal contante ma è tracciato', () => {
  const r = nw.cashFromTransactions(TX);
  assert.equal(r.cash, 1200);
  assert.equal(r.investedFromFlow, 300);
});

test('valuePositions: senza prezzo → fallback avgPrice ETICHETTATO stale (onestà)', () => {
  const v = nw.valuePositions([{ ticker: 'AAPL', assetClass: 'stock', quantity: 10, avgPrice: 100 }], {});
  assert.equal(v.rows[0].price, 100);
  assert.equal(v.rows[0].stale, true);
  assert.equal(v.stale, true);
  assert.equal(v.total, 1000);
});

test('computeNetWorth: aggrega cash+posizioni+asset dichiarati−debiti, aritmetica verificabile', () => {
  const n = nw.computeNetWorth({
    transactions: TX,
    positions: [{ ticker: 'BTC', assetClass: 'crypto', quantity: 0.1, avgPrice: 50000 }],
    currentPriceByTicker: { BTC: 60000 },
    manualAssets: [{ name: 'casa', value: 150000 }],
    liabilities: 80000,
  });
  assert.equal(n.cash, 1200);
  assert.equal(n.invested, 6000);
  assert.equal(n.total, 1200 + 6000 + 150000 - 80000);
  assert.equal(n.stale, false);
  assert.ok(/consulenza/i.test(n.disclaimer));
  assert.equal(n.manualAssets[0].declared, true); // valore dichiarato, etichettato
});

test('projectStrategy: stesso seed → stessi percentili (numeri riproducibili, regola #1)', () => {
  const o = { start: 10000, monthlyContribution: 100, years: 5, mu: 0.07, sigma: 0.15, paths: 500, seed: 42 };
  const a = nw.projectStrategy(o);
  const b = nw.projectStrategy(o);
  assert.equal(a.p50, b.p50);
  assert.equal(a.p5, b.p5);
  assert.equal(a.p95, b.p95);
  assert.equal(a.invested, 16000); // capitale versato: 10000 + 100×60
});

test('projectStrategy: percentili ordinati p5<p50<p95 e traiettoria annuale presente', () => {
  const c = nw.projectStrategy({ start: 10000, monthlyContribution: 200, years: 10, mu: 0.07, sigma: 0.15, paths: 2000, seed: 1 });
  assert.ok(c.p5 < c.p50 && c.p50 < c.p95);
  assert.equal(c.medianTrajectory.length, 10);
  assert.ok(c.medianTrajectory.every((y, i) => y.year === i + 1 && y.p50 > 0));
});

test('projectNetWorthByStrategy: 7 strategie (onestà: 5 fattori reali + liquidità + indice, NON "8 strategie"), ordinate per mediana, con disclaimer', () => {
  const s = nw.projectNetWorthByStrategy({ start: 5000, monthlyContribution: 100, years: 10, paths: 500, seed: 7 });
  assert.equal(s.rows.length, 7);
  assert.ok(s.rows.every((r, i, arr) => i === 0 || arr[i - 1].p50 >= r.p50));
  assert.ok(/non è consulenza/i.test(s.disclaimer));
  assert.ok(s.rows.every(r => typeof r.mu === 'number' && typeof r.sigma === 'number')); // ipotesi dichiarate
});

test('ipotesi dichiarate: la liquidità ha p50 più basso delle strategie azionarie su 10 anni (coerenza μ)', () => {
  const s = nw.projectNetWorthByStrategy({ start: 10000, monthlyContribution: 0, years: 10, paths: 1000, seed: 3 });
  const cashRow = s.rows.find(r => r.strategy === 'risparmio');
  const equityRow = s.rows.find(r => r.strategy === 'indice');
  assert.ok(cashRow.p50 < equityRow.p50);
});
