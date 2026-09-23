import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stringifyVault } from './safe-json.js';

test('normal vault data keeps native JSON semantics', () => {
  const value = { list: [1, undefined, new Date('2026-09-20T00:00:00Z')], absent: undefined, price: NaN };
  assert.equal(stringifyVault(value), JSON.stringify(value));
});

test('a deeply nested non-circular archive is retained without a stack overflow', () => {
  const root = {}; let cursor = root;
  for (let index = 0; index < 5_000; index++) { cursor.next = {}; cursor = cursor.next; }
  cursor.value = 42;
  const text = stringifyVault({ watchlist: [root], whatsNewSeen: '2026-09-23' });
  assert.ok(text.includes('"value":42'));
  assert.ok(text.includes('"whatsNewSeen":"2026-09-23"'));
});

test('circular data is rejected rather than silently dropped', () => {
  const value = {}; value.self = value;
  assert.throws(() => stringifyVault(value), TypeError);
});

test('historical saved states keep exactly the same JSON bytes and every field', () => {
  const fixtures = JSON.parse(readFileSync(new URL('./fixtures/historical-backups.json', import.meta.url), 'utf8'));
  for (const { tag, state } of fixtures.states) {
    const original = JSON.stringify(state);
    const current = stringifyVault(state);
    assert.equal(current, original, `${tag}: no changed storage format`);
    assert.deepEqual(JSON.parse(current), state, `${tag}: no lost data`);
  }
});
