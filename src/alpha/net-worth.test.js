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

test('valuePositions: senza prezzo live ma con serie storica → nowcast (stima+banda), MAI il close grezzo spacciato per live', () => {
  const now = new Date('2026-06-15').getTime();
  const series = Array.from({ length: 10 }, (_, i) => ({ date: `2026-06-0${i + 1}`, close: 100 + i }));
  const v = nw.valuePositions([{ ticker: 'AAPL', assetClass: 'stock', quantity: 10, avgPrice: 50 }], { pricesByTicker: { AAPL: series }, now });
  assert.equal(v.rows[0].stale, true); // onestà: è una stima, non un prezzo live
  assert.ok(v.rows[0].nowcast);
  assert.notEqual(v.rows[0].price, 50); // non è il fallback a costo
  assert.ok(v.rows[0].nowcast.band >= 0);
});

test('valuePositions: prezzo live presente → nessun nowcast, nessuna stima', () => {
  const series = [{ date: '2026-06-01', close: 100 }];
  const v = nw.valuePositions([{ ticker: 'AAPL', assetClass: 'stock', quantity: 10, avgPrice: 50 }], { pricesByTicker: { AAPL: series }, currentPriceByTicker: { AAPL: 120 } });
  assert.equal(v.rows[0].price, 120);
  assert.equal(v.rows[0].stale, false);
  assert.equal(v.rows[0].nowcast, null);
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

test('projectNetWorthByStrategy: 7 strategie dichiarate + (se disponibile) 1 riga cripto MISURATA su Bitcoin reale — mai una riga in più senza un backtest vero dietro', () => {
  const s = nw.projectNetWorthByStrategy({ start: 5000, monthlyContribution: 100, years: 10, paths: 500, seed: 7 });
  const expected = nw.STRATEGY_ASSUMPTIONS.cripto ? 8 : 7;
  assert.equal(s.rows.length, expected);
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

// ── Ponte con il backtest reale (bench/generate-measured-assumptions.mjs) ──
test('STRATEGY_ASSUMPTIONS: indice e momentum usano i numeri MISURATI dal backtest reale quando lo scatto è disponibile', async () => {
  const measured = (await import('./measured-assumptions.js')).default;
  if (!measured.spy) return; // niente cache locale in questo ambiente: nulla da verificare
  assert.equal(nw.STRATEGY_ASSUMPTIONS.indice.mu, measured.spy.buyHold.mu);
  assert.equal(nw.STRATEGY_ASSUMPTIONS.indice.sigma, measured.spy.buyHold.sigma);
  assert.equal(nw.STRATEGY_ASSUMPTIONS.indice.measured, true);
  assert.equal(nw.STRATEGY_ASSUMPTIONS.momentum.mu, measured.spy.momentumTiming.mu);
  assert.equal(nw.STRATEGY_ASSUMPTIONS.momentum.measured, true);
});

test('STRATEGY_ASSUMPTIONS: le altre 4 righe (value/growth/risk/reflexivity) restano dichiarate da letteratura, mai "measured" senza un backtest vero dietro', () => {
  for (const k of ['value', 'growth', 'risk', 'reflexivity']) {
    assert.equal(nw.STRATEGY_ASSUMPTIONS[k].measured, undefined, `${k} non ha un backtest reale: non deve dichiararsi misurato`);
  }
});

test('STRATEGY_ASSUMPTIONS: la riga cripto (quando presente) riflette onestamente il BUY&HOLD, non il timing (il backtest reale mostra il timing peggiore su Bitcoin)', async () => {
  if (!nw.STRATEGY_ASSUMPTIONS.cripto) return;
  const measured = (await import('./measured-assumptions.js')).default;
  assert.equal(nw.STRATEGY_ASSUMPTIONS.cripto.mu, measured.btc.buyHold.mu);
  assert.ok(measured.btc.buyHold.mu > measured.btc.momentumTiming.mu, 'precondizione: il buy&hold ha davvero battuto il timing su Bitcoin');
});

test('NET_WORTH_DISCLAIMER dichiara la differenza tra righe misurate e ipotesi da letteratura', () => {
  assert.ok(/backtest|misurat/i.test(nw.NET_WORTH_DISCLAIMER));
});
