// Bounded same-origin relay for public GDELT headlines. This avoids browser
// extensions/CORS blocking the data host while retaining source URLs, dates
// and editorial attribution. No user Vault or profile data is sent upstream.
const HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300', 'x-content-type-options': 'nosniff' };
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS });

export async function handleMarketHeadlines(request, { fetchImpl = fetch, cache = globalThis.caches?.default } = {}) {
  const name = (new URL(request.url).searchParams.get('name') || '').trim();
  if (name.length < 4 || name.length > 70 || !/^[\p{L}\p{N} .&'-]+$/u.test(name)) return reply({ error: 'invalid_query' }, 400);
  const cacheKey = new Request(request.url);
  const cached = await cache?.match(cacheKey).catch(() => null);
  if (cached) return cached;
  try {
    const url = new URL('https://api.gdeltproject.org/api/v2/doc/doc');
    url.searchParams.set('query', `"${name.replaceAll('"', '')}"`);
    url.searchParams.set('mode', 'artlist');
    url.searchParams.set('format', 'json');
    url.searchParams.set('timespan', '1week');
    url.searchParams.set('sort', 'datedesc');
    url.searchParams.set('maxrecords', '25');
    // The public DOC API can need more than ten seconds even for a bounded
    // query. Cache successful responses at the edge rather than turning a
    // slow source into a permanent false "no news" result.
    const upstream = await fetchImpl(url.toString(), { signal: AbortSignal.timeout(18_000), cf: { cacheEverything: true, cacheTtl: 300 } });
    if (!upstream.ok) return reply({ error: 'source_unavailable' }, 503);
    const source = await upstream.json();
    if (!Array.isArray(source?.articles)) return reply({ error: 'source_unavailable' }, 503);
    const articles = source.articles.slice(0, 25).map(row => ({
      title: String(row?.title || '').slice(0, 300),
      url: String(row?.url || '').slice(0, 1200),
      domain: String(row?.domain || '').slice(0, 120),
      seendate: String(row?.seendate || '').slice(0, 24),
    }));
    const response = reply({ articles });
    await cache?.put(cacheKey, response.clone()).catch(() => {});
    return response;
  } catch (_) { return reply({ error: 'source_unavailable' }, 503); }
}

export const onRequestGet = ({ request }) => handleMarketHeadlines(request);
