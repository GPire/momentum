import { cleanPriceSeries } from './market-series-quality.js';

// Historical buy-and-hold scenarios, not the sector model's rebalanced
// bootstrap. valueBase must already be valued in the declared base currency.
export function portfolioHistoryRisk(positions = [], {
  histories = {}, fx = {}, baseCurrency, horizon = 21, level = 0.975,
  asOf = new Date().toISOString().slice(0, 10),
} = {}) {
  if (!/^[A-Z]{3}$/.test(baseCurrency) || !Number.isInteger(horizon) || horizon < 1 || horizon > 252
      || !Number.isFinite(level) || level < 0.9 || level >= 1
      || !cleanPriceSeries([{ date: asOf, price: 1 }]).length) return { available: false, reason: 'invalid-options' };
  if (!positions.length) return { available: false, reason: 'empty-portfolio' };
  if (positions.some(p => !p?.ticker || !Number.isFinite(p.valueBase) || p.valueBase <= 0)) {
    return { available: false, reason: 'unknown-valuation' };
  }
  const values = new Map();
  for (const p of positions) values.set(p.ticker, (values.get(p.ticker) || 0) + p.valueBase);
  const total = [...values.values()].reduce((a, b) => a + b, 0);
  if (!Number.isFinite(total)) return { available: false, reason: 'unknown-valuation' };
  const included = [], excluded = [];
  for (const [ticker, value] of values) {
    const history = histories[ticker];
    if (!history?.source || !/^[A-Z]{3}$/.test(history.currency)) {
      excluded.push({ ticker, value, reason: 'missing-history' }); continue;
    }
    let points = cleanPriceSeries(Array.isArray(history.points) ? history.points : []).filter(p => p.date <= asOf);
    if (history.currency !== baseCurrency) {
      const rate = fx[history.currency];
      if (!rate?.source || rate.baseCurrency !== baseCurrency) {
        excluded.push({ ticker, value, reason: 'missing-historical-fx' }); continue;
      }
      const rates = new Map(cleanPriceSeries(Array.isArray(rate.points) ? rate.points : []).map(p => [p.date, p.price]));
      points = points.filter(p => rates.has(p.date)).map(p => ({ date: p.date, price: p.price * rates.get(p.date) }));
    }
    if (points.length < 2) { excluded.push({ ticker, value, reason: 'short-history' }); continue; }
    included.push({ ticker, value, source: history.source, prices: new Map(points.map(p => [p.date, p.price])) });
  }
  const covered = included.reduce((a, p) => a + p.value, 0);
  const coverage = covered / total;
  const common = included.length ? [...included[0].prices.keys()].filter(date => included.every(p => p.prices.has(date))) : [];
  const metadata = { coverage, coveredValue: covered, totalValue: total, excluded, baseCurrency, horizon, level, asOf,
    first: common[0] ?? null, last: common.at(-1) ?? null, alignedSessions: common.length,
    method: 'historical-non-overlapping-buy-and-hold', calendar: 'common-observation-dates',
    ageDays: common.length ? Math.floor((Date.parse(asOf) - Date.parse(common.at(-1))) / 86400000) : null };
  if (coverage < 0.5) return { ...metadata, available: false, reason: 'insufficient-coverage' };
  const windows = [];
  for (let end = horizon; end < common.length; end += horizon) {
    const contributions = included.map(p => p.value / covered * (p.prices.get(common[end]) / p.prices.get(common[end - horizon]) - 1));
    if (contributions.every(Number.isFinite)) windows.push({ contributions, value: contributions.reduce((a, b) => a + b, 0) });
  }
  const tailCount = Math.floor((1 - level) * windows.length);
  if (tailCount < 5) return { ...metadata, available: false, reason: 'insufficient-tail', windows: windows.length, tailCount };
  const tail = windows.sort((a, b) => a.value - b.value).slice(0, tailCount);
  const expectedShortfall = tail.reduce((sum, x) => sum + x.value, 0) / tail.length;
  return { ...metadata, available: true, windows: windows.length, tailCount, expectedShortfall,
    valueAtRisk: tail.at(-1).value, changeBase: covered * expectedShortfall,
    contributions: included.map((p, index) => ({ ticker: p.ticker, source: p.source, weight: p.value / covered,
      returnContribution: tail.reduce((sum, x) => sum + x.contributions[index], 0) / tail.length })),
  };
}
