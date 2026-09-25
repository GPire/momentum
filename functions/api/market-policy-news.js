// Same-origin relay for the two official central-bank feeds. It returns only
// headline metadata and original links; the app never republishes articles.
const FEEDS = {
  fed: { url: 'https://www.federalreserve.gov/feeds/press_monetary.xml', host: 'federalreserve.gov' },
  bce: { url: 'https://www.ecb.europa.eu/rss/press.html', host: 'ecb.europa.eu' },
};
const HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300', 'x-content-type-options': 'nosniff' };
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS });
const clean = text => String(text || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ').trim();

export function parsePolicyFeed(xml, host, now = Date.now()) {
  const items = [];
  for (const match of String(xml).matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const body = match[1];
    const title = clean(body.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
    const link = clean(body.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i)?.[1]);
    const pubDate = clean(body.match(/<pubDate\b[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]);
    const date = Date.parse(pubDate);
    let target;
    try { target = new URL(link); } catch (_) { continue; }
    if (!title || !Number.isFinite(date) || date > now + 86_400_000 || date < now - 365 * 86_400_000) continue;
    if (target.protocol !== 'https:' || (target.hostname !== host && !target.hostname.endsWith(`.${host}`))) continue;
    items.push({ title: title.slice(0, 220), link: target.href, pubDate: new Date(date).toUTCString() });
    if (items.length === 12) break;
  }
  return items;
}

export async function handleMarketPolicyNews(request, { fetchImpl = fetch, cache = globalThis.caches?.default, now = Date.now() } = {}) {
  const source = new URL(request.url).searchParams.get('source');
  const feed = FEEDS[source];
  if (!feed) return reply({ error: 'invalid_source' }, 400);
  const cacheKey = new Request(request.url);
  const cached = await cache?.match(cacheKey).catch(() => null);
  if (cached) return cached;
  try {
    const upstream = await fetchImpl(feed.url, { signal: AbortSignal.timeout(6000), cf: { cacheEverything: true, cacheTtl: 300 } });
    if (!upstream.ok) return reply({ error: 'source_unavailable' }, 503);
    const xml = await upstream.text();
    if (xml.length > 1_500_000 || !xml.includes('<rss')) return reply({ error: 'source_unavailable' }, 503);
    const result = reply({ status: 'ok', source, checkedAt: new Date(now).toISOString(), items: parsePolicyFeed(xml, feed.host, now) });
    await cache?.put(cacheKey, result.clone()).catch(() => {});
    return result;
  } catch (_) { return reply({ error: 'source_unavailable' }, 503); }
}

export const onRequestGet = ({ request }) => handleMarketPolicyNews(request);
