import test from 'node:test';
import assert from 'node:assert/strict';
import { handleMarketCryptoNews, parseCoinDeskRss } from './market-crypto-news.js';

const NOW = Date.parse('2026-09-25T12:00:00Z');
const RSS = `<rss><channel><item><title>Bitcoin ETF inflows rise</title><link>https://www.coindesk.com/markets/bitcoin-etf/</link><pubDate>Fri, 25 Sep 2026 11:00:00 GMT</pubDate></item><item><title>Ethereum update</title><link>https://www.coindesk.com/markets/ethereum/</link><pubDate>Fri, 25 Sep 2026 11:00:00 GMT</pubDate></item><item><title>Bitcoin Cash rises</title><link>https://www.coindesk.com/markets/bitcoin-cash/</link><pubDate>Fri, 25 Sep 2026 11:00:00 GMT</pubDate></item><item><title>Bitcoin fake link</title><link>https://attacker.example/</link><pubDate>Fri, 25 Sep 2026 11:00:00 GMT</pubDate></item></channel></rss>`;

test('only recent matching headlines from the publisher are returned', () => {
  const items = parseCoinDeskRss(RSS, 'Bitcoin', NOW);
  assert.equal(items.length, 1);
  assert.equal(items[0].source, 'CoinDesk');
  assert.equal(items[0].publishedAt, '2026-09-25T11:00:00.000Z');
});

test('relay uses fixed host, validates input and returns metadata only', async () => {
  assert.equal((await handleMarketCryptoNews(new Request('https://app.test/api/market-crypto-news?coin=../../foo'))).status, 400);
  let fetched = '';
  const res = await handleMarketCryptoNews(new Request('https://app.test/api/market-crypto-news?coin=Bitcoin'), { now: NOW, cache: null, fetchImpl: async (url) => { fetched = url; return { ok: true, text: async () => RSS }; } });
  assert.equal(fetched, 'https://www.coindesk.com/arc/outboundfeeds/rss/');
  assert.equal((await res.json()).articles.length, 1);
});
