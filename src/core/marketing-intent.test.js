import test from 'node:test';
import assert from 'node:assert/strict';
import { splitIntentUrl } from './marketing-intent.js';

test('split entry preserves language and unrelated parameters when consumed', () => {
  assert.equal(splitIntentUrl('https://example.test/?lang=it&intent=split#inizio'), '/?lang=it#inizio');
  assert.equal(splitIntentUrl('https://example.test/?intent=split&lang=de&ref=site'), '/?lang=de&ref=site');
  assert.equal(splitIntentUrl('https://example.test/?intent=company'), null);
  assert.equal(splitIntentUrl('https://example.test/?lang=it'), null);
});
