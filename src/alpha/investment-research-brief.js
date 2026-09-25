// One compact research gate for shares, funds and crypto. It records what is
// actually observable; it does not turn missing data into a trade signal.
import { isFreshNewsEvidence } from './news.js';

const DAY = 86_400_000;
const validTime = (value, now) => {
  const time = Date.parse(value || '');
  return Number.isFinite(time) && time <= now + 5 * 60_000 ? time : null;
};

export function buildInvestmentResearchBrief({ asset = {}, snapshot = null, filings = null, quarter = null, quote = null, news = null, now = Date.now() } = {}) {
  const kind = asset.kind === 'crypto' ? 'crypto' : asset.instrumentType === 'etf' ? 'etf' : 'stock';
  const annual = kind === 'stock' && Number.isInteger(snapshot?.year) && validTime(snapshot?.snapshotAt, now) !== null;
  const company = annual
    ? { status: 'annual', year: snapshot.year, snapshotAt: snapshot.snapshotAt }
    : { status: kind === 'stock' ? 'unavailable' : 'not-applicable' };

  const price = Number(quote?.price);
  const marketAt = validTime(quote?.marketAsOf, now);
  let quoteStatus = 'unavailable';
  if (Number.isFinite(price) && price > 0) {
    quoteStatus = marketAt === null ? 'unverified'
      : now - marketAt > (kind === 'crypto' ? 60 * 60_000 : 5 * DAY) ? 'old' : 'dated';
  }

  const items = Array.isArray(news?.items) ? news.items : [];
  const currentCount = news?.stale ? 0 : items.filter(item => isFreshNewsEvidence(item, { now })).length;
  const communityCount = items.filter(item => item?.sourceType === 'community').length;
  const newsStatus = currentCount ? 'recent' : communityCount ? 'community-only' : 'unavailable';

  const recentFiling = filings?.source === 'SEC EDGAR' && Array.isArray(filings.filings)
    ? [...filings.filings].filter(row => /^(10-K|10-Q|20-F|40-F)$/.test(row?.form)
      && validTime(row?.filedAt, now) !== null
      && /^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\//.test(row?.url || ''))
      .sort((a, b) => b.filedAt.localeCompare(a.filedAt))[0]
    : null;
  const recentQuarter = quarter?.source === 'SEC EDGAR companyfacts'
    && validTime(quarter?.quarter?.filedAt, now) !== null
    && now - Date.parse(quarter?.quarter?.end || '') < 550 * DAY
    && /^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\//.test(quarter?.quarter?.url || '')
    ? quarter.quarter : null;
  let next;
  if (kind === 'etf') next = { code: 'check-fund' };
  else if (kind === 'crypto') next = { code: 'check-crypto' };
  else if (recentQuarter) next = annual
    ? { code: 'compare-filing', form: recentQuarter.form, date: recentQuarter.filedAt, url: recentQuarter.url }
    : { code: 'read-filing', form: recentQuarter.form, date: recentQuarter.filedAt, url: recentQuarter.url };
  else if (annual && recentFiling) next = { code: 'compare-filing', form: recentFiling.form, date: recentFiling.filedAt, url: recentFiling.url };
  else if (!annual) next = { code: 'find-accounts' };
  else if (quoteStatus !== 'dated') next = { code: 'check-quote' };
  else next = { code: 'check-risk' };

  return {
    kind, company,
    quote: { status: quoteStatus, marketAsOf: marketAt === null ? null : quote.marketAsOf, source: quote?.source || null },
    news: { status: newsStatus, currentCount, communityCount },
    next,
  };
}
