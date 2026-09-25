// Same-origin, keyless access to recent SEC filings. The SEC API has no CORS
// support; this route requests only a bounded public company record and keeps
// the response cacheable. It is not a market-price or trade-signal endpoint.
const FORMS = new Set(['8-K', '10-K', '10-Q', '6-K', '20-F', '40-F', 'S-1', '424B2', 'N-PORT', 'N-1A']);
const HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300', 'x-content-type-options': 'nosniff' };
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS });

export function normalizeSecFilings(payload, cik, { limit = 6, now = Date.now() } = {}) {
  const recent = payload?.filings?.recent;
  if (!recent || !Array.isArray(recent.form) || !Array.isArray(recent.filingDate)
    || !Array.isArray(recent.accessionNumber) || !Array.isArray(recent.primaryDocument)) throw new Error('SEC response is incomplete');
  const filings = [];
  for (let index = 0; index < Math.min(recent.form.length, 200); index++) {
    const form = recent.form[index], filedAt = recent.filingDate[index];
    const accession = recent.accessionNumber[index], document = recent.primaryDocument[index];
    if (!FORMS.has(form) || !/^\d{4}-\d{2}-\d{2}$/.test(filedAt)
      || !Number.isFinite(Date.parse(filedAt)) || Date.parse(filedAt) > now + 86_400_000
      || !/^\d{10}-\d{2}-\d{6}$/.test(accession) || !/^[A-Za-z0-9._-]{1,120}$/.test(document)) continue;
    filings.push({ form, filedAt, url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replaceAll('-', '')}/${encodeURIComponent(document)}` });
    if (filings.length >= limit) break;
  }
  return { source: 'SEC EDGAR', company: String(payload.name || '').slice(0, 160), cik: Number(cik), filings };
}

export async function handleMarketFilings(request, { fetchImpl = fetch, cache = globalThis.caches?.default, now = Date.now() } = {}) {
  const cik = new URL(request.url).searchParams.get('cik') || '';
  if (!/^\d{1,10}$/.test(cik) || Number(cik) < 1) return reply({ error: 'invalid_cik' }, 400);
  const cacheKey = new Request(request.url);
  const cached = await cache?.match(cacheKey).catch(() => null);
  if (cached) return cached;
  try {
    const url = `https://data.sec.gov/submissions/CIK${cik.padStart(10, '0')}.json`;
    const upstream = await fetchImpl(url, {
      headers: { 'User-Agent': 'Momentum Finance (https://momentum-finance.pages.dev; contact: giorgiopiredda96@gmail.com)', Accept: 'application/json' },
      signal: AbortSignal.timeout(5500),
      cf: { cacheEverything: true, cacheTtl: 300 },
    });
    if (!upstream.ok) return reply({ error: 'source_unavailable' }, 503);
    const data = normalizeSecFilings(await upstream.json(), cik, { now });
    const response = reply({ ...data, receivedAt: new Date(now).toISOString() });
    await cache?.put(cacheKey, response.clone()).catch(() => {});
    return response;
  } catch (_) { return reply({ error: 'source_unavailable' }, 503); }
}

export const onRequestGet = ({ request }) => handleMarketFilings(request);
