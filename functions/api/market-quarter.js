// Public SEC XBRL, reduced to one comparable three-month period. No user data
// or API key reaches the SEC. Quarterly and annual figures remain separate.
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': status === 200 ? 'public, max-age=1800' : 'no-store',
  'x-content-type-options': 'nosniff',
} });
const CONCEPTS = {
  revenue: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet'],
  netIncome: ['NetIncomeLoss', 'ProfitLoss'],
};
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const validAccession = value => typeof value === 'string' && /^\d{10}-\d{2}-\d{6}$/.test(value);

export function normalizeSecQuarter(payload, cik, { now = Date.now() } = {}) {
  if (Number(payload?.cik) !== Number(cik) || !payload?.facts?.['us-gaap']) throw new Error('SEC companyfacts mismatch');
  const candidates = [];
  for (const [metric, concepts] of Object.entries(CONCEPTS)) {
    concepts.forEach((concept, priority) => {
      const rows = payload.facts['us-gaap']?.[concept]?.units?.USD;
      if (!Array.isArray(rows)) return;
      for (const row of rows) {
        if (!['10-Q', '10-Q/A'].includes(row?.form) || !validDate(row.start) || !validDate(row.end)
          || !validDate(row.filed) || !validAccession(row.accn) || !Number.isFinite(row.val)
          || (metric === 'revenue' && row.val < 0)) continue;
        const length = (Date.parse(row.end) - Date.parse(row.start)) / 86_400_000;
        if (length < 60 || length > 120 || row.filed < row.end || Date.parse(row.filed) > now + 86_400_000) continue;
        candidates.push({ metric, concept, priority, value: row.val, start: row.start, end: row.end, filedAt: row.filed, accession: row.accn, form: row.form });
      }
    });
  }
  const newest = candidates.sort((a, b) => b.end.localeCompare(a.end) || b.start.localeCompare(a.start))[0];
  if (!newest) return { source: 'SEC EDGAR companyfacts', cik: Number(cik), quarter: null };
  const samePeriod = candidates.filter(row => row.start === newest.start && row.end === newest.end);
  // An amendment can replace only one concept. Keep the displayed figures tied
  // to one accession so the single filing link never attributes older numbers
  // to a newer document.
  const filing = [...samePeriod].sort((a, b) => b.filedAt.localeCompare(a.filedAt) || b.accession.localeCompare(a.accession))[0];
  const sameFiling = samePeriod.filter(row => row.accession === filing.accession);
  const metrics = {};
  for (const metric of Object.keys(CONCEPTS)) {
    const rows = sameFiling.filter(row => row.metric === metric).sort((a, b) => a.priority - b.priority);
    if (!rows.length) continue;
    const preferred = rows[0];
    const equallyPreferred = rows.filter(row => row.priority === preferred.priority);
    if (equallyPreferred.some(row => row.value !== preferred.value)) continue; // ambiguous restatement: abstain
    metrics[metric] = { value: preferred.value, concept: preferred.concept, filedAt: preferred.filedAt, accession: preferred.accession };
  }
  if (!Object.keys(metrics).length) return { source: 'SEC EDGAR companyfacts', cik: Number(cik), quarter: null };
  return { source: 'SEC EDGAR companyfacts', cik: Number(cik), quarter: {
    start: newest.start, end: newest.end, filedAt: filing.filedAt, form: filing.form, metrics,
    url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${filing.accession.replaceAll('-', '')}/${filing.accession}-index.html`,
  } };
}

export async function handleMarketQuarter(request, { fetchImpl = fetch, cache = globalThis.caches?.default, now = Date.now() } = {}) {
  const cik = new URL(request.url).searchParams.get('cik') || '';
  if (!/^\d{1,10}$/.test(cik) || Number(cik) < 1) return reply({ error: 'invalid_cik' }, 400);
  const cacheKey = new Request(request.url);
  const cached = await cache?.match(cacheKey).catch(() => null);
  if (cached) return cached;
  try {
    const upstream = await fetchImpl(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik.padStart(10, '0')}.json`, {
      headers: { 'User-Agent': 'Momentum Finance (https://momentum-finance.pages.dev; contact: giorgiopiredda96@gmail.com)', Accept: 'application/json' },
      signal: AbortSignal.timeout(7000),
      cf: { cacheEverything: true, cacheTtl: 1800 },
    });
    if (!upstream.ok || Number(upstream.headers?.get('content-length') || 0) > 12_000_000) return reply({ error: 'source_unavailable' }, 503);
    const result = normalizeSecQuarter(await upstream.json(), cik, { now });
    const response = reply({ ...result, receivedAt: new Date(now).toISOString() });
    await cache?.put(cacheKey, response.clone()).catch(() => {});
    return response;
  } catch (_) { return reply({ error: 'source_unavailable' }, 503); }
}

export const onRequestGet = ({ request }) => handleMarketQuarter(request);
