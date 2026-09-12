import { trainingEligible } from './sources.js';
import { cleanPriceSeries } from './market-series-quality.js';
import { portfolioRiskSnapshot } from './portfolio-risk-snapshot.js';

// Only provider results with explicit currency enter this on-device path.
// Legacy scalar live prices and peer estimates cannot supply provenance.
export function portfolioProviderRisk(positions, results = {}, { asOf, baseCurrency = 'EUR', horizon = 5 } = {}) {
  const quotes = {}, histories = {};
  for (const p of positions || []) {
    const r = results[p.ticker];
    if (!r || !trainingEligible(r) || !/^[A-Z]{3}$/.test(r.currency)
        || r.kind !== 'prices' || r.symbol?.toLowerCase() !== p.ticker.toLowerCase()
        || r.assetKind !== (p.assetClass === 'crypto' ? 'crypto' : 'stock')) continue;
    const points = cleanPriceSeries(r.prices.map(x => ({ date: x.date, price: x.close })));
    const last = points.at(-1);
    if (!last) continue;
    quotes[p.ticker] = { ...last, currency: r.currency, source: r.priceSource };
    histories[p.ticker] = { points, currency: r.currency, source: r.priceSource };
  }
  return portfolioRiskSnapshot(positions || [], { quotes, histories, baseCurrency, asOf, horizon });
}
