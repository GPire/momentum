import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
globalThis.window = {};
globalThis.navigator = { maxTouchPoints: 0 };
globalThis.localStorage = { getItem: () => null, setItem() {} };
const { VaultDAO, DurableStore } = await import('./vault.js');
const { exportPlain, readBackupFile, encryptBackup, decryptBackup } = await import('./backup.js');
const { simpleHash } = await import('./utils.js');
const defaults = structuredClone(VaultDAO.state);
const historical = JSON.parse(readFileSync(new URL('./fixtures/historical-backups.json', import.meta.url), 'utf8'));

// Synthetic persisted shapes from both branches; no real customer data.
function fixture(branch) {
  let lastHash = 'GENESIS';
  const transactions = { '2026-08': Array.from({ length: 25 }, (_, i) => {
    const tx = { id: `tx-${i}`, type: 'uscita', amount: 10.25 + i, category: 'custom-snack',
      date: `2026-08-${String(i + 1).padStart(2, '0')}T09:00:00.000Z`,
      description: `Caffè ${i}`, currency: 'EUR', prevHash: lastHash };
    tx.hash = simpleHash(tx.id + tx.amount + tx.category + tx.prevHash);
    lastHash = tx.hash;
    return tx;
  }) };
  const common = {
    schemaVersion: 50, isFirstLaunch: false, currentDate: '2026-09-01T12:00:00.000Z',
    transactions, lastHash, deletedTx: { removed: 123456 }, monthlyBudget: 875.75,
    customCategories: [{ id: 'custom-snack', name: 'Caffè e snack', type: 'uscita', color: '#e2ad51' }],
    onboardingProfile: { ageBracket: '25-34', hasPartitaIva: true, riskProfile: 'bilanciato' },
    taxLearned: { acme: 'invoice', employer: 'salary' },
    mlData: { vocab: { caffè: 2 }, catCounts: { 'custom-snack': 5 }, totalWords: 51,
      lastTraining: 12345, neuralNet: { version: 1, weights: [0.15, -0.75] },
      dcgn: { nodes: { caffè: { count: 3 } }, edges: {} }, expertBandit: { version: 1, arms: { nano: { wins: 2 } } },
      modelStats: { nano: { 'custom-snack': { correct: 2, total: 3 } } },
      merchantMorphology: { learned: ['caffè'] }, conformalScores: [0.1, 0.3] },
    advisorBandit: { version: 1, arms: { budget: { alpha: 3, beta: 2 } } },
    invoices: [{ number: 1, year: 2026, client: 'Test', imponibile: 100 }],
    splitGroups: [{ id: 'group', members: [{ id: 'a', name: 'Alex' }, { id: 'b', name: 'Alex' }], expenses: [] }],
    savingsGoals: [{ id: 'trip', name: 'Viaggio', target: 2500, saved: 10 }],
    deviceId: 'unchanged-device', license: { tier: 'PRO', exp: null },
    futureExtension: { nested: ['must', 'survive'] },
  };
  return branch === 'main' ? { ...common, chAttivitaTipo: 'accessoria', esActive: false,
    forecastSnapshots: [{ takenAt: '2026-08-01', startBalance: 0, relative: true, targets: [] }],
    forecastShown: { '2026-08-01:7': true },
  } : { ...common, themePreference: 'light', uiComplexity: 'completo', recoveryPromptSuppressed: true,
    paymentDeclarations: [{ id: 'trial', startDate: '2026-09-01', nextDate: '2026-09-15', endDate: '2026-12-15' }],
    mlData: { ...common.mlData, learningExamples: 22, federatedProbeConsensus: { food: 0.7 } },
  };
}

function setup(t) {
  const local = new Map(), durable = new Map();
  const old = { state: VaultDAO.state, storage: globalThis.localStorage, get: DurableStore.get, put: DurableStore.put };
  globalThis.localStorage = { getItem: k => local.get(k) ?? null, setItem: (k, v) => local.set(k, String(v)), removeItem: k => local.delete(k) };
  DurableStore.get = async (store, key) => durable.get(`${store}:${key}`) ?? null;
  DurableStore.put = async (store, value, key) => durable.set(`${store}:${key}`, structuredClone(value));
  VaultDAO.state = structuredClone(defaults);
  t.after(() => { VaultDAO.state = old.state; globalThis.localStorage = old.storage; DurableStore.get = old.get; DurableStore.put = old.put; });
  return { local, durable };
}

for (const saved of historical.states) for (const source of ['main', 'shadow', 'indexedDB']) {
  test(`${saved.tag} (${saved.revision.slice(0, 7)}) historical shape survives ${source}, save, reload and export`, async t => {
    const { local, durable } = setup(t), payload = JSON.stringify(saved.state);
    if (source === 'main') local.set('omega_core_db', payload);
    if (source === 'shadow') local.set('omega_shadow_vault', Buffer.from(payload).toString('base64'));
    if (source === 'indexedDB') durable.set('state:main', payload);
    await VaultDAO.initDurable(); VaultDAO.init(); VaultDAO.save();
    VaultDAO.state = structuredClone(defaults);
    await VaultDAO.initDurable(); VaultDAO.init();
    const exported = readBackupFile(JSON.stringify(exportPlain(VaultDAO.state))).state;
    for (const [key, value] of Object.entries(saved.state)) {
      if (!['currentDate', 'schemaVersion'].includes(key)) assert.deepEqual(exported[key], value, key);
    }
  });
}

test('the original July encrypted exporter can be decrypted by the current reader', async () => {
  const { envelope, password, expected } = historical.encrypted;
  const file = readBackupFile(JSON.stringify(envelope));
  assert.equal(file.serve, 'passphrase');
  assert.deepEqual(await decryptBackup(file.envelope, password), expected);
  await assert.rejects(decryptBackup(file.envelope, 'wrong password'));
});

test('legacy DNA preserves all transactions but cannot supply learning it never exported', () => {
  const file = readBackupFile(historical.dna.text);
  assert.deepEqual(Object.values(file.state.transactions).flat(), historical.dna.expected.transactions);
  assert.equal(file.state.monthlyBudget, historical.dna.expected.budget);
  assert.equal(file.state.mlData, undefined);
  assert.ok(file.parziale);
  const existing = { mlData: { vocab: { kept: 3 } }, invoices: [{ id: 'kept' }] };
  const restored = { ...existing, ...file.state };
  assert.deepEqual(restored.mlData, existing.mlData);
  assert.deepEqual(restored.invoices, existing.invoices);
});

for (const branch of ['main', 'ui']) for (const source of ['main', 'shadow', 'indexedDB', 'all']) {
  test(`${branch} persisted data survives upgrade/save/reload from ${source}`, async t => {
    const { local, durable } = setup(t);
    const original = fixture(branch), payload = JSON.stringify(original);
    if (source === 'main' || source === 'all') local.set('omega_core_db', payload);
    if (source === 'shadow' || source === 'all') local.set('omega_shadow_vault', Buffer.from(payload).toString('base64'));
    if (source === 'indexedDB' || source === 'all') durable.set('state:main', payload);
    await VaultDAO.initDurable(); VaultDAO.init(); VaultDAO.save();
    VaultDAO.state = structuredClone(defaults);
    await VaultDAO.initDurable(); VaultDAO.init();
    for (const [key, value] of Object.entries(original)) {
      if (key !== 'currentDate') assert.deepEqual(VaultDAO.state[key], value, key);
    }
    const exported = readBackupFile(JSON.stringify(exportPlain(VaultDAO.state))).state;
    assert.deepEqual(exported.mlData, original.mlData);
    assert.deepEqual(exported.transactions, original.transactions);
    assert.deepEqual(durable.get('state:upgrade-2026-09-11').sources[0].state, original);
  });
}

test('pre-upgrade checkpoint keeps learning from divergent copies and is not overwritten', async t => {
  const { local, durable } = setup(t);
  const a = fixture('main'), b = fixture('ui');
  local.set('omega_core_db', JSON.stringify(a));
  durable.set('state:main', JSON.stringify(b));
  await VaultDAO.initDurable();
  const checkpoint = structuredClone(durable.get('state:upgrade-2026-09-11'));
  assert.deepEqual(checkpoint.sources.map(s => s.state.mlData), [a.mlData, b.mlData]);
  await VaultDAO.initDurable();
  assert.deepEqual(durable.get('state:upgrade-2026-09-11'), checkpoint);
});

test('encrypted backup round trip preserves both branch shapes including all learning', async () => {
  for (const branch of ['main', 'ui']) {
    const state = fixture(branch);
    const envelope = await encryptBackup(state, 'Synthetic test passphrase');
    const restored = await decryptBackup(envelope, 'Synthetic test passphrase');
    assert.deepEqual(restored, state);
  }
});

test('IndexedDB request success is not mistaken for transaction commit', async t => {
  const old = DurableStore.open;
  t.after(() => { DurableStore.open = old; });
  let transaction;
  DurableStore.open = async () => ({ transaction: () => (transaction = { objectStore: () => ({ put: () => ({}) }) }) });
  let settled = false;
  const promise = DurableStore.put('state', 'test', 'main').then(() => { settled = true; });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(settled, false);
  transaction.oncomplete(); await promise;
  assert.equal(settled, true);
  const rejected = DurableStore.put('state', 'test', 'main');
  await Promise.resolve();
  transaction.onabort();
  await assert.rejects(rejected, /aborted/);
});
