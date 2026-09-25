import test from 'node:test';
import assert from 'node:assert/strict';
import { handleMarketHeadlines } from './market-headlines.js';

test('public relay only accepts bounded company or asset names', async () => {
  for (const name of ['X', 'javascript:evil', 'a'.repeat(71)]) {
    const result = await handleMarketHeadlines(new Request(`https://app.test/api/market-headlines?name=${encodeURIComponent(name)}`), { fetchImpl: async () => { throw Error('fetch should not start'); } });
    assert.equal(result.status, 400);
  }
});

test('GDELT metadata is bounded and cached; no Vault payload is transmitted', async () => {
  let calls = 0, saved;
  const cache = { match: async () => saved?.clone(), put: async (_, response) => { saved = response; } };
  const request = new Request('https://app.test/api/market-headlines?name=Apple');
  const fetchImpl = async (url, options) => {
    calls++;
    assert.ok(options.signal instanceof AbortSignal);
    const upstream = new URL(url);
    assert.equal(upstream.hostname, 'api.gdeltproject.org');
    assert.equal(upstream.searchParams.get('query'), '"Apple"');
    return { ok: true, json: async () => ({ articles: [{ title: 'Apple earnings', url: 'https://example.com/a', domain: 'example.com', seendate: '20260925T120000Z', body: 'not forwarded' }] }) };
  };
  const first = await handleMarketHeadlines(request, { cache, fetchImpl });
  assert.equal(first.status, 200);
  const data = await first.json();
  assert.equal(data.articles[0].body, undefined);
  await handleMarketHeadlines(request, { cache, fetchImpl });
  assert.equal(calls, 1);
});
