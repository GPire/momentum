import { conTimeout } from '../core/con-timeout.js';

export async function fetchRecentSecQuarter(cik, { fetchImpl = fetch } = {}) {
  if (!Number.isInteger(Number(cik)) || Number(cik) < 1 || Number(cik) > 9_999_999_999) return null;
  try {
    const response = await conTimeout(fetchImpl(`/api/market-quarter?cik=${Number(cik)}`), 8_000, 'SEC quarter timeout');
    if (!response.ok) return null;
    const data = await response.json();
    const q = data?.quarter;
    if (data?.source !== 'SEC EDGAR companyfacts' || Number(data.cik) !== Number(cik) || !q || !['10-Q', '10-Q/A'].includes(q.form)
      || !/^\d{4}-\d{2}-\d{2}$/.test(q.start) || !/^\d{4}-\d{2}-\d{2}$/.test(q.end)
      || !/^\d{4}-\d{2}-\d{2}$/.test(q.filedAt)
      || !/^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/\d+\/[0-9]+\/[0-9-]+-index\.html$/.test(q.url)
      || Date.parse(q.end) < Date.parse(q.start)
      || Date.parse(q.filedAt) < Date.parse(q.end)
      || Date.parse(q.filedAt) > Date.now() + 86_400_000) return null;
    const metrics = Object.fromEntries(Object.entries(q.metrics || {}).filter(([key, metric]) =>
      ['revenue', 'netIncome'].includes(key) && Number.isFinite(metric?.value)
      && /^\d{4}-\d{2}-\d{2}$/.test(metric?.filedAt || '')
      && /^\d{10}-\d{2}-\d{6}$/.test(metric?.accession || '')));
    if (!Object.keys(metrics).length) return null;
    return { ...data, quarter: { ...q, metrics } };
  } catch (_) { return null; }
}
