import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseVaultCandidate, reconcileVaultCandidates, manifestMatches, readVaultManifest, VAULT_LEGACY_SHADOW_KEY, VAULT_MAIN_KEY, VAULT_MANIFEST_KEY, vaultManifest, writeLocalVaultSnapshot } from './vault-storage.js';

const storage = ({ quota = Infinity } = {}) => {
  const values = new Map(); let writes = 0;
  return {
    getItem: key => values.get(key) ?? null,
    setItem(key, value) {
      value = String(value);
      const used = [...values.entries()].reduce((sum, [storedKey, storedValue]) => sum + (storedKey === key ? 0 : storedValue.length), 0);
      if (used + value.length > quota) throw new DOMException('full', 'QuotaExceededError');
      values.set(key, value); writes++;
    },
    removeItem: key => values.delete(key),
    values, writes: () => writes,
  };
};

test('one snapshot plus a small manifest replaces the oversized base64 duplicate', () => {
  const local = storage(), state = { storageRevision: 4, transactions: { m: [{ id: 1 }] }, note: 'x'.repeat(4_000) };
  const payload = JSON.stringify(state);
  local.setItem(VAULT_LEGACY_SHADOW_KEY, Buffer.from(payload).toString('base64'));
  writeLocalVaultSnapshot(local, payload, state);
  assert.equal(local.getItem(VAULT_MAIN_KEY), payload);
  assert.equal(local.getItem(VAULT_LEGACY_SHADOW_KEY), null);
  assert.ok(local.getItem(VAULT_MANIFEST_KEY).length < payload.length / 10);
  assert.equal(manifestMatches(payload, readVaultManifest(local)), true);
});

test('an unchanged archive causes no repeated storage writes', () => {
  const local = storage(), state = { storageRevision: 1, transactions: {} }, payload = JSON.stringify(state);
  writeLocalVaultSnapshot(local, payload, state);
  const before = local.writes();
  assert.equal(writeLocalVaultSnapshot(local, payload, state).changed, false);
  assert.equal(local.writes(), before);
});

test('quota recovery may discard the legacy duplicate only after durable retention', () => {
  const state = { storageRevision: 2, transactions: {}, value: 'x'.repeat(1_000) }, payload = JSON.stringify(state);
  const manifestLength = JSON.stringify(vaultManifest(payload, state)).length;
  const local = storage({ quota: payload.length + manifestLength + 10 });
  local.setItem(VAULT_LEGACY_SHADOW_KEY, 'o'.repeat(100));
  assert.throws(() => writeLocalVaultSnapshot(local, payload, state), /full/);
  assert.equal(local.getItem(VAULT_LEGACY_SHADOW_KEY), 'o'.repeat(100));
  assert.equal(writeLocalVaultSnapshot(local, payload, state, { durableSafe: true }).recoveredQuota, true);
  assert.equal(local.getItem(VAULT_MAIN_KEY), payload);
});

test('same transaction count chooses the newest revision; transaction safety still wins first', () => {
  const count = state => Object.values(state.transactions || {}).flat().length;
  const current = { source: 'localStorage(main)', state: { storageRevision: 4, transactions: { m: [{ id: 1 }] } } };
  const newer = { source: 'indexedDB', state: { storageRevision: 5, transactions: { m: [{ id: 1 }] } } };
  const moreData = { source: 'localStorage(shadow)', state: { storageRevision: 1, transactions: { m: [{ id: 1 }, { id: 2 }] } } };
  assert.equal(chooseVaultCandidate([current, newer], count), newer);
  assert.equal(chooseVaultCandidate([newer, moreData], count), moreData);
});

test('a newer snapshot with an explicit deletion does not resurrect the removed expense', () => {
  const count = state => Object.values(state.transactions || {}).flat().length;
  const older = { source: 'localStorage(main)', state: { deviceId: 'same-device', storageRevision: 8, transactions: { m: [{ id: 'keep' }, { id: 'removed' }] }, deletedTx: {} } };
  const newer = { source: 'indexedDB', state: { deviceId: 'same-device', storageRevision: 9, transactions: { m: [{ id: 'keep' }] }, deletedTx: { removed: 1780000000000 } } };
  assert.equal(chooseVaultCandidate([older, newer], count), newer);
});

test('a smaller snapshot without deletion evidence never wins merely by claiming a higher revision', () => {
  const count = state => Object.values(state.transactions || {}).flat().length;
  const older = { source: 'localStorage(main)', state: { deviceId: 'same-device', storageRevision: 8, transactions: { m: [{ id: 'keep' }, { id: 'missing' }] } } };
  const incomplete = { source: 'indexedDB', state: { deviceId: 'same-device', storageRevision: 9, transactions: { m: [{ id: 'keep' }] }, deletedTx: {} } };
  assert.equal(chooseVaultCandidate([older, incomplete], count), older);
});

test('same-device divergent copies retain both transaction sets and the latest settings', () => {
  const count = state => Object.values(state.transactions || {}).flat().length;
  const older = { source: 'localStorage(main)', state: { deviceId: 'one', storageRevision: 8, monthlyBudget: 100, transactions: { m: [{ id: 'a' }, { id: 'b' }] }, deletedTx: {} } };
  const newer = { source: 'indexedDB', state: { deviceId: 'one', storageRevision: 9, monthlyBudget: 200, transactions: { m: [{ id: 'b' }, { id: 'c' }] }, deletedTx: {} } };
  const result = reconcileVaultCandidates([older, newer], count);
  assert.equal(result.state.monthlyBudget, 200);
  assert.deepEqual(result.state.transactions.m.map(row => row.id), ['a', 'b', 'c']);
});

test('reconciliation never restores a transaction with a deletion tombstone', () => {
  const count = state => Object.values(state.transactions || {}).flat().length;
  const older = { source: 'localStorage(main)', state: { deviceId: 'one', storageRevision: 8, transactions: { m: [{ id: 'a' }, { id: 'b' }] }, deletedTx: {} } };
  const newer = { source: 'indexedDB', state: { deviceId: 'one', storageRevision: 9, transactions: { m: [{ id: 'a' }] }, deletedTx: { b: 123 } } };
  const result = reconcileVaultCandidates([older, newer], count);
  assert.deepEqual(result.state.transactions.m.map(row => row.id), ['a']);
  assert.equal(result.state.deletedTx.b, 123);
});

test('different device identities are not automatically combined', () => {
  const count = state => Object.values(state.transactions || {}).flat().length;
  const mine = { source: 'localStorage(main)', state: { deviceId: 'mine', storageRevision: 2, transactions: { m: [{ id: 'mine' }] } } };
  const other = { source: 'indexedDB', state: { deviceId: 'other', storageRevision: 3, transactions: { m: [{ id: 'other' }] } } };
  assert.equal(reconcileVaultCandidates([mine, other], count), other);
});

test('manifest detects a changed or truncated snapshot', () => {
  const state = { storageRevision: 1, transactions: {} }, payload = JSON.stringify(state), manifest = vaultManifest(payload, state, '2026-09-20T00:00:00Z');
  assert.equal(manifestMatches(payload, manifest), true);
  assert.equal(manifestMatches(payload.slice(0, -1), manifest), false);
});
