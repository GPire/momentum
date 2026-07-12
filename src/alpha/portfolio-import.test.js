import test from 'node:test';
import assert from 'node:assert/strict';

const { parsePortfolioCsv, analyzePortfolio } = await import('./portfolio-import.js');

test('parsePortfolioCsv: riconosce colonne IT/EN e classifica gli asset', () => {
  const csv = 'Ticker;Classe;Quantità;PrezzoMedio\nAAPL;stock;10;150,5\nBTC;crypto;0,5;40000\nVWCE;etf;20;110';
  const p = parsePortfolioCsv(csv);
  assert.equal(p.length, 3);
  assert.deepEqual(p[0], { ticker: 'AAPL', assetClass: 'stock', quantity: 10, avgPrice: 150.5 });
  assert.equal(p[1].assetClass, 'crypto');
  assert.equal(p[2].assetClass, 'etf');
});

test('analyzePortfolio: valore, P/L e allocazione corretti', () => {
  const positions = [
    { ticker: 'AAPL', assetClass: 'stock', quantity: 10, avgPrice: 100 },
    { ticker: 'BTC', assetClass: 'crypto', quantity: 1, avgPrice: 30000 },
  ];
  const a = analyzePortfolio(positions, { currentPriceByTicker: { AAPL: 120, BTC: 40000 } });
  assert.equal(a.rows[0].value, 1200);
  assert.equal(a.rows[0].pl, 200);          // (120-100)*10
  assert.equal(a.totalValue, 41200);
  assert.equal(a.totalPl, 10200);
  assert.ok(a.allocation.crypto > 0.9);     // BTC domina
});

test('analyzePortfolio: concentrazione alta → consiglio Graham', () => {
  const positions = [
    { ticker: 'TSLA', assetClass: 'stock', quantity: 100, avgPrice: 200 },
    { ticker: 'KO', assetClass: 'stock', quantity: 1, avgPrice: 60 },
  ];
  const a = analyzePortfolio(positions, { currentPriceByTicker: { TSLA: 200, KO: 60 } });
  assert.ok(a.topWeight > 0.9);
  assert.ok(a.advice.some(x => /Graham|Concentrazione/i.test(x.rule + x.text)));
});

test('analyzePortfolio: con serie prezzi calcola stats e rebalancing risk-parity', () => {
  const mkSeries = (base, vol) => Array.from({ length: 30 }, (_, i) => ({ date: `2026-06-${String((i % 28) + 1).padStart(2, '0')}`, close: base + (i % 2 ? vol : -vol) }));
  const positions = [
    { ticker: 'A', assetClass: 'stock', quantity: 10, avgPrice: 100 },
    { ticker: 'B', assetClass: 'stock', quantity: 10, avgPrice: 100 },
  ];
  const a = analyzePortfolio(positions, {
    pricesByTicker: { A: mkSeries(100, 5), B: mkSeries(100, 1) },
    currentPriceByTicker: { A: 100, B: 100 },
  });
  assert.ok(a.stats, 'deve calcolare le stats');
  assert.ok(Array.isArray(a.rebalance));
  // B meno volatile → target risk-parity più alto di A
  const wA = a.rebalance.find(r => r.ticker === 'A').target;
  const wB = a.rebalance.find(r => r.ticker === 'B').target;
  assert.ok(wB > wA);
});

test('analyzePortfolio: disclaimer sempre presente (mai consulenza)', () => {
  const a = analyzePortfolio([{ ticker: 'X', assetClass: 'stock', quantity: 1, avgPrice: 10 }], { currentPriceByTicker: { X: 10 } });
  assert.ok(/[Nn]on è consulenza/.test(a.disclaimer));
});
