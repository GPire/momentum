// Reproducible research check, not a trading recommendation or trained model.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validateStrategySet } from '../src/alpha/strategy-validation.js';
import { portfolioRiskSnapshot } from '../src/alpha/portfolio-risk-snapshot.js';

const root = new URL('./data/research-universe/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));
const strategies = [], skipped = [];
const histories = {};
const quotes = {};
const evaluationFrom = '2022-01-01';
const transactionCost = 0.001; // declared assumption: 10 bps per traded notional
for (const asset of manifest.assets) {
  const bytes = readFileSync(new URL(asset.file, root));
  if (createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new Error(`Checksum mismatch: ${asset.symbol}`);
  const { rows } = JSON.parse(bytes);
  if (rows.some(row => !Number.isFinite(row.adjustedClose) || row.adjustedClose <= 0)) {
    skipped.push({ symbol: asset.symbol, reason: 'incomplete-adjusted-prices' });
    continue;
  }
  const prices = rows.map(row => row.adjustedClose);
  histories[asset.symbol] = { currency: asset.currency, source: manifest.provider,
    points: rows.map(row => ({ date: row.date, price: row.adjustedClose })) };
  const last = rows.at(-1);
  quotes[asset.symbol] = { price: last.close, date: last.date, currency: asset.currency, source: manifest.provider };
  for (const window of [20, 60, 120]) {
    // Signal is known at previous close; execution is at today's open. Open
    // is adjusted by the same session's close ratio. No same-close fill claim.
    let position = 0;
    const returns = [];
    for (let i = window + 1; i < rows.length - 1; i++) {
      if (rows[i].date < evaluationFrom) continue;
      const target = prices[i - 1] > prices[i - 1 - window] ? 1 : 0;
      const open = rows[i].open * prices[i] / rows[i].close;
      const nextOpen = rows[i + 1].open * prices[i + 1] / rows[i + 1].close;
      const gain = target * (nextOpen / open - 1) - Math.abs(target - position) * transactionCost;
      returns.push(gain);
      position = target;
    }
    if (returns.length && position) returns[returns.length - 1] -= transactionCost;
    if (returns.length < 252) { skipped.push({ symbol: asset.symbol, window, reason: 'short-evaluation' }); continue; }
    strategies.push({ name: `${asset.symbol}:trend-${window}`, returns });
  }
}
const validation = validateStrategySet(strategies);
const report = {
  generatedAt: new Date().toISOString(), datasetGeneratedAt: manifest.generatedAt,
  evaluationFrom, transactionCost, tested: strategies.length,
  passingStatisticalGate: validation.solide.length, skipped,
  limitations: [...manifest.limitations, 'no-order-book-or-execution-simulation', 'fixed-cost-assumption', 'historical-adjustments-may-be-revised', 'not-proof-of-future-performance'],
  results: validation.esiti,
  examplePortfolios: [
    ['SPY', 'QQQ', 'TLT', 'GLD'],
    ['AAPL', 'MSFT', 'JPM', 'BTC-USD', 'ETH-USD'],
  ].map(tickers => ({
    hypothetical: true, tickers, equalValuesUSD: 1000,
    risk: portfolioRiskSnapshot(tickers.map(ticker => ({ ticker, quantity: 1000 / quotes[ticker].price, currency: 'USD' })),
      { quotes, histories, baseCurrency: 'USD', horizon: 5, asOf: manifest.generatedAt.slice(0, 10) }),
  })),
};
writeFileSync(new URL('evaluation.json', root), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ tested: report.tested, passingStatisticalGate: report.passingStatisticalGate, skipped,
  portfolios: report.examplePortfolios.map(p => ({ tickers: p.tickers, available: p.risk.available, windows: p.risk.windows, coverage: p.risk.coverage, reason: p.risk.reason })) }));
