import { cleanPriceSeries } from './market-series-quality.js';
import { portfolioHistoryRisk } from './portfolio-history-risk.js';

// Quotes are unadjusted prices per unit; histories may be adjusted for returns.
// FX is expressed as base-currency units per one quoted-currency unit.
// No network, persistence, cost-basis fallback or inferred currency.
export function portfolioRiskSnapshot(positions = [], {
  quotes = {}, histories = {}, fx = {}, baseCurrency, asOf,
  maxAgeDays = 7, horizon = 21, level = 0.975,
} = {}) {
  const validDate = date => cleanPriceSeries([{ date, price: 1 }]).length === 1;
  if (!/^[A-Z]{3}$/.test(baseCurrency) || !validDate(asOf)
      || !Number.isInteger(maxAgeDays) || maxAgeDays < 0 || maxAgeDays > 30) {
    return { available: false, reason: 'invalid-options' };
  }
  const age = date => (Date.parse(asOf) - Date.parse(date)) / 86400000;
  const issues = [], valued = [], valuations = [];
  for (const p of positions) {
    const ticker = p?.ticker;
    const fail = reason => issues.push({ ticker: ticker || null, reason });
    if (!ticker || !Number.isFinite(p.quantity) || p.quantity <= 0) { fail('invalid-holding'); continue; }
    const quote = quotes[ticker];
    if (!quote?.source || !Number.isFinite(quote.price) || quote.price <= 0
        || !/^[A-Z]{3}$/.test(quote.currency) || !validDate(quote.date)) { fail('missing-quote'); continue; }
    if (age(quote.date) < 0 || age(quote.date) > maxAgeDays) { fail('quote-outside-window'); continue; }
    if ((p.currency && p.currency !== quote.currency)
        || (histories[ticker]?.currency && histories[ticker].currency !== quote.currency)) {
      fail('currency-mismatch'); continue;
    }
    let rate = 1;
    if (quote.currency !== baseCurrency) {
      const conversion = fx[quote.currency];
      const point = conversion?.source && conversion.baseCurrency === baseCurrency
        ? cleanPriceSeries(Array.isArray(conversion.points) ? conversion.points : []).find(x => x.date === quote.date) : null;
      if (!point) { fail('missing-valuation-fx'); continue; }
      rate = point.price;
    }
    const valueBase = p.quantity * quote.price * rate;
    if (!Number.isFinite(valueBase) || valueBase <= 0) { fail('invalid-valuation'); continue; }
    valued.push({ ticker, valueBase });
    valuations.push({ ticker, quantity: p.quantity, valueBase, quoteDate: quote.date,
      quoteSource: quote.source, quoteCurrency: quote.currency, fxRate: rate,
      fxSource: quote.currency === baseCurrency ? null : fx[quote.currency].source });
  }
  // An unknown holding must not silently shrink the coverage denominator.
  if (issues.length) return { available: false, reason: 'incomplete-valuation', issues, baseCurrency, asOf };
  const result = portfolioHistoryRisk(valued, { histories, fx, baseCurrency, asOf, horizon, level });
  if (result.available && result.ageDays > maxAgeDays) {
    return { available: false, reason: 'stale-history', baseCurrency, asOf,
      last: result.last, ageDays: result.ageDays, valuations };
  }
  return { ...result, valuations };
}
