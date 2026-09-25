// Official SEC submissions through Momentum's same-origin, bounded relay.
// Company disclosures are primary documents, not editorial news or quotes.
import { conTimeout } from '../core/con-timeout.js';

export async function fetchRecentSecFilings(cik, { fetchImpl = fetch } = {}) {
  if (!Number.isInteger(Number(cik)) || Number(cik) < 1 || Number(cik) > 9_999_999_999) return null;
  try {
    const response = await conTimeout(fetchImpl(`/api/market-filings?cik=${Number(cik)}`), 6_000, 'SEC filings timeout');
    if (!response.ok) return null;
    const data = await response.json();
    if (data?.source !== 'SEC EDGAR' || !Array.isArray(data.filings)) return null;
    const filings = data.filings.filter(row => /^(8-K|10-K|10-Q|6-K|20-F|40-F|S-1|424B2|N-PORT|N-1A)$/.test(row?.form)
      && /^\d{4}-\d{2}-\d{2}$/.test(row?.filedAt)
      && /^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/\d+\/[0-9]+\/[A-Za-z0-9._%-]+$/.test(row?.url)).slice(0, 6);
    return { ...data, receivedAt: Number.isFinite(Date.parse(data.receivedAt)) ? data.receivedAt : new Date().toISOString(), filings };
  } catch (_) { return null; }
}
