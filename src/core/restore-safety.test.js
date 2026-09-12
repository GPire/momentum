import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRestoredState, prepareRestoredState, checkpointBeforeRestore, readRestoreCheckpoint, writeRestoredArchive, RESTORE_CHECKPOINT_KEY } from './restore-safety.js';
const saved = () => ({ schemaVersion: 50, transactions: { old: [{ id: 1, amount: 3, hash: 'original', date: 'legacy-date' }] },
  mlData: { weights: [0.5, -0.1] }, invoices: [{ id: 'invoice' }], futureExtension: { keep: true } });
const storage = () => {
  const map = new Map();
  return { getItem: k => map.get(k), setItem: (k, v) => map.set(k, v) };
};
test('restore validates the container without rewriting old transactions, weights or unknown fields', () => {
  const state = saved(), before = structuredClone(state);
  assert.equal(validateRestoredState(state, 50), state);
  assert.deepEqual(state, before);
});
test('partial DNA preserves absent learning and uses its own chain head, not the old device head', () => {
  const old = { ...saved(), lastHash: 'old-device-head' };
  const partial = { transactions: { '2026-07': [{ id: 2, amount: 7, category: 'spesa', hash: 'restored-head', prevHash: 'GENESIS', date: '2026-07-01' }] } };
  const next = prepareRestoredState(old, partial, 50);
  assert.equal(next.lastHash, 'restored-head');
  assert.deepEqual(next.mlData, old.mlData);
  assert.deepEqual(next.transactions, partial.transactions);
  assert.equal(prepareRestoredState(old, { transactions: {} }, 50).lastHash, 'GENESIS');
  assert.equal(prepareRestoredState(old, { ...partial, lastHash: 'explicit' }, 50).lastHash, 'explicit');
});
for (const state of [null, [], {}, { transactions: [] }, { transactions: { bad: {} } }, { transactions: { bad: [null] } },
  { transactions: {}, mlData: null }, { transactions: {}, splitGroups: {} }]) {
  test(`invalid backup container is refused: ${JSON.stringify(state)}`, () => assert.throws(() => validateRestoredState(state, 50), /restoreInvalid/));
}
test('future and malformed schema versions are refused before writing', () => {
  for (const schemaVersion of [51, '50', -1, NaN]) assert.throws(() => validateRestoredState({ transactions: {}, schemaVersion }, 50), /restoreNewer/);
  assert.ok(validateRestoredState({ transactions: {} }, 50));
});
test('a real durable round trip protects complete data before replacing an archive', async () => {
  const map = new Map(), local = storage();
  const durable = { put: async (_s, v, k) => map.set(k, v), get: async (_s, k) => map.get(k) };
  const state = saved();
  assert.equal(await checkpointBeforeRestore(state, durable, local), true);
  state.mlData.weights[0] = 999;
  assert.deepEqual((await readRestoreCheckpoint(durable, local)).data, saved());
  assert.equal(local.getItem(RESTORE_CHECKPOINT_KEY), undefined);
});
test('disabled IndexedDB is not mistaken for success: use and verify local fallback', async () => {
  const durable = { put: async () => {}, get: async () => undefined }, local = storage();
  await checkpointBeforeRestore(saved(), durable, local);
  assert.deepEqual((await readRestoreCheckpoint(durable, local)).data, saved());
});
test('no checkpoint means no permission to continue a destructive restore', async () => {
  const durable = { put: async () => {}, get: async () => undefined };
  const full = { getItem: () => null, setItem: () => { throw new Error('QuotaExceeded'); } };
  await assert.rejects(checkpointBeforeRestore(saved(), durable, full), /restoreCheckpointFailed/);
});

test('restoring a smaller archive updates all copies before success', async () => {
  const local = storage(), map = new Map();
  const durable = { put: async (_s, v, k) => map.set(k, v), get: async (_s, k) => map.get(k) };
  const old = saved(), next = { ...old, transactions: {} };
  await writeRestoredArchive({}, old, durable, local);
  await checkpointBeforeRestore(old, durable, local);
  await writeRestoredArchive(old, next, durable, local);
  assert.deepEqual(JSON.parse(local.getItem('omega_core_db')), next);
  assert.deepEqual(JSON.parse(Buffer.from(local.getItem('omega_shadow_vault'), 'base64').toString('utf8')), next);
  assert.deepEqual(JSON.parse(await durable.get('state', 'main')), next);
  assert.deepEqual((await readRestoreCheckpoint(durable, local)).data, old);
});

test('a stale durable archive cannot silently pass restore and revive old transactions', async () => {
  const old = saved(), local = storage(), oldPayload = JSON.stringify(old);
  local.setItem('omega_core_db', oldPayload);
  local.setItem('omega_shadow_vault', Buffer.from(oldPayload).toString('base64'));
  const durable = { put: async () => {}, get: async () => oldPayload };
  await assert.rejects(writeRestoredArchive(old, { transactions: {} }, durable, local));
  assert.equal(local.getItem('omega_core_db'), oldPayload);
});
