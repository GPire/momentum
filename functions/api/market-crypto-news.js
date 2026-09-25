// Public CoinDesk RSS metadata for an asset, proxied on the app origin to
// avoid RSS CORS restrictions. Headlines and links only, never article text.
const RSS_URL = 'https://www.coindesk.com/arc/outboundfeeds/rss/';
const RESPONSE_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300', 'x-content-type-options': 'nosniff' };
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: RESPONSE_HEADERS });
const decode = (text) => String(text || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

export function parseCoinDeskRss(xml, term, now = Date.now()) {
  const articles = [];
  const needle = term.toLocaleLowerCase('en');
  const distinctFork = needle === 'bitcoin' ? /\bbitcoin\s+(cash|sv|gold)\b/i
    : needle === 'ethereum' ? /\bethereum\s+classic\b/i : null;
  for (const match of String(xml).matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const item = match[1];
    const title = decode(item.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
    const rawUrl = decode(item.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i)?.[1]);
    const publishedAt = decode(item.match(/<pubDate\b[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]);
    const date = Date.parse(publishedAt);
    if (!title.toLocaleLowerCase('en').includes(needle) || distinctFork?.test(title) || !Number.isFinite(date) || date > now + 300_000 || date < now - 7 * 86_400_000) continue;
    let url;
    try { url = new URL(rawUrl); } catch (_) { continue; }
    if (url.protocol !== 'https:' || !/(^|\.)coindesk\.com$/i.test(url.hostname)) continue;
    articles.push({ title: title.slice(0, 300), url: url.href, publishedAt: new Date(date).toISOString(), source: 'CoinDesk' });
    if (articles.length >= 8) break;
  }
  return articles;
}

export async function handleMarketCryptoNews(request, { fetchImpl = fetch, cache = globalThis.caches?.default, now = Date.now() } = {}) {
  const term = (new URL(request.url).searchParams.get('coin') || '').trim();
  if (!/^[a-zA-Z][a-zA-Z0-9 -]{2,35}$/.test(term)) return reply({ error: 'invalid_coin' }, 400);
  const cacheKey = new Request(request.url);
  const cached = await cache?.match(cacheKey).catch(() => null);
  if (cached) return cached;
  try {
    const response = await fetchImpl(RSS_URL, { signal: AbortSignal.timeout(5000), cf: { cacheEverything: true, cacheTtl: 300 } });
    if (!response.ok) return reply({ error: 'source_unavailable' }, 503);
    const xml = await response.text();
    if (xml.length > 1_500_000 || !xml.includes('<rss')) return reply({ error: 'source_unavailable' }, 503);
    const result = reply({ source: 'CoinDesk', checkedAt: new Date(now).toISOString(), articles: parseCoinDeskRss(xml, term, now) });
    await cache?.put(cacheKey, result.clone()).catch(() => {});
    return result;
  } catch (_) { return reply({ error: 'source_unavailable' }, 503); }
}

export const onRequestGet = ({ request }) => handleMarketCryptoNews(request);
