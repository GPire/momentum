import test from 'node:test';
import assert from 'node:assert/strict';
import { marketingIntent, splitIntentUrl } from './marketing-intent.js';

test('split entry preserves language and unrelated parameters when consumed', () => {
  assert.equal(splitIntentUrl('https://example.test/?lang=it&intent=split#inizio'), '/?lang=it#inizio');
  assert.equal(splitIntentUrl('https://example.test/?intent=split&lang=de&ref=site'), '/?lang=de&ref=site');
  assert.equal(splitIntentUrl('https://example.test/?intent=company'), null);
  assert.equal(splitIntentUrl('https://example.test/?lang=it'), null);
});

test('only the three public task intents can be consumed once without dropping other URL state', () => {
  for (const type of ['split','trips','tax']) {
    assert.deepEqual(marketingIntent(`https://example.test/?lang=de&intent=${type}&ref=site#start`), {type,cleanUrl:'/?lang=de&ref=site#start'});
  }
  assert.equal(marketingIntent('https://example.test/?intent=company'), null);
  assert.equal(marketingIntent('https://example.test/?lang=it'), null);
});
