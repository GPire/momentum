import test from 'node:test';
import assert from 'node:assert/strict';
import { handleMarketPolicyNews, parsePolicyFeed } from './market-policy-news.js';

const now = Date.parse('2026-09-25T12:00:00Z');
const feed = `<rss><channel><item><title><![CDATA[FOMC statement]]></title><link>https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm</link><pubDate>Wed, 16 Sep 2026 18:00:00 GMT</pubDate></item><item><title>Impostor</title><link>https://federalreserve.gov.attacker.example/post</link><pubDate>Wed, 16 Sep 2026 18:00:00 GMT</pubDate></item></channel></rss>`;

test('policy relay accepts original official headlines and rejects lookalike links', () => {
  assert.deepEqual(parsePolicyFeed(feed, 'federalreserve.gov', now).map(item => item.title), ['FOMC statement']);
});

test('policy relay uses a fixed feed and yields cacheable metadata', async () => {
  let requested = '';
  const response = await handleMarketPolicyNews(new Request('https://momentum.test/api/market-policy-news?source=fed'), {
    now, fetchImpl: async url => { requested = url; return new Response(feed); }, cache: null,
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(requested, 'https://www.federalreserve.gov/feeds/press_monetary.xml');
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].title, 'FOMC statement');
  assert.match(response.headers.get('cache-control'), /max-age=300/);
});

test('policy relay rejects arbitrary sources without fetching them', async () => {
  const response = await handleMarketPolicyNews(new Request('https://momentum.test/api/market-policy-news?source=https://example.com'), {
    fetchImpl: () => { throw new Error('must not fetch'); }, cache: null,
  });
  assert.equal(response.status, 400);
});
