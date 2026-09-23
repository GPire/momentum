// Run with a clean checkout of the previously published commit:
// node scripts/vault-upgrade-gate.mjs ../momentum-baseline
// All records are deterministic synthetic data. No customer archive is read.
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const baseline = process.argv[2];
if (!baseline) throw new Error('Pass the previous checkout path');
globalThis.window = {};
globalThis.navigator = { maxTouchPoints: 0 };
globalThis.indexedDB = undefined;
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const old = await import(pathToFileURL(resolve(baseline, 'src/core/vault.js')).href);
const current = await import('../src/core/vault.js');
const oldVault = old.VaultDAO, newVault = current.VaultDAO;
const oldDefault = JSON.parse(JSON.stringify(oldVault.state));
const newDefault = newVault.state;
const originalOldPut = old.DurableStore.put;
const originalNewPut = current.DurableStore.put;
const originalNewGet = current.DurableStore.get;
old.DurableStore.put = async () => {};
current.DurableStore.put = async () => {};

function storage(initial = {}, quota = Infinity) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.get(key) ?? null,
    setItem(key, value) {
      const text = String(value);
      if (text.length > quota) throw Object.assign(new Error('QuotaExceededError'), { name: 'QuotaExceededError' });
      values.set(key, text);
    },
    removeItem: key => values.delete(key),
  };
}

const descriptions = ['pane', 'café €', 'ÖPNV', '東京', 'دفع', '🪐 viaggio'];
function synthetic(index) {
  const state = structuredClone(oldDefault);
  const counts = [0, 1, 7, 40, 150, 500];
  const count = index === 512 ? 2_500 : index === 513 ? 10_000 : counts[index % counts.length];
  state.deviceId = `synthetic-device-${index}`;
  state.isFirstLaunch = false;
  state.currentDate = new Date('2026-09-22T12:00:00.000Z');
  state.monthlyBudget = index % 4 === 0 ? null : 300 + index * 3;
  state.transactions = {};
  for (let n = 0; n < count; n++) {
    const month = `202${4 + Math.floor(n / 240)}-${String((n % 12) + 1).padStart(2, '0')}`;
    (state.transactions[month] ||= []).push({
      id: `tx-${index}-${n}`, amount: (n % 2 ? -1 : 1) * (n + .25),
      date: `${month}-15T12:00:00.000Z`, category: n % 3 ? 'alimentari' : 'viaggi',
      currency: ['EUR', 'CHF', 'USD'][n % 3], description: descriptions[n % descriptions.length],
      ...(n === 0 && index % 5 === 0 ? { receiptImage: `data:image/jpeg;base64,${'a'.repeat(10_000)}` } : {}),
    });
  }
  state.deletedTx = index % 3 === 0 ? { [`old-${index}`]: 1780000000000 + index } : {};
  state.customCategories = [{ id: `custom-${index}`, name: descriptions[index % descriptions.length], color: '#5468af', icon: 'star' }];
  state.savingsGoals = [{ id: `goal-${index}`, name: 'Casa', target: 12000 + index, saved: index * 7 }];
  state.invoices = [{ id: `invoice-${index}`, number: `${index}/2026`, client: 'Azienda prova', imponibile: 300 + index, country: ['IT', 'CH', 'ES'][index % 3] }];
  state.invoiceCollections = [{ invoiceId: `invoice-${index}`, amount: 100, date: '2026-09-10' }];
  state.businessTrips = [{ id: `trip-${index}`, name: 'Trasferta', startDate: '2026-09-01', endDate: '2026-09-03', expenseIds: count ? [`tx-${index}-0`] : [] }];
  state.positions = [{ ticker: index % 2 ? 'SPY' : 'BTC', quantity: index + 1 }];
  state.liabilities = [{ id: `debt-${index}`, amount: index * 10 }];
  state.events = [{ id: `event-${index}`, date: '2026-10-01', title: 'Scadenza' }];
  state.splitGroups = [{ id: `split-${index}`, members: [{ id: 'mine', name: 'Io' }, { id: 'friend', name: 'Amico' }] }];
  state.voiceLearning = { phrases: { [descriptions[index % descriptions.length]]: 'alimentari' } };
  state.mlData = { vocab: { pane: { alimentari: index + 1 } }, totalWords: index + 1 };
  state.taxActiveCountry = ['IT', 'CH', 'ES'][index % 3];
  state.futureUnrecognizedField = { source: 'old-version', value: index };
  return state;
}

function comparePriorFields(expected, actual, label) {
  for (const [key, value] of Object.entries(expected)) {
    if (['currentDate', 'storageRevision', 'schemaVersion', 'themePreference'].includes(key)) continue;
    assert.ok(isDeepStrictEqual(actual[key], value), `${label}: ${key}`);
  }
}

let upgraded = 0;
const snapshots = new Map();
try {
  for (let index = 0; index < 514; index++) {
    const source = storage();
    globalThis.localStorage = source;
    oldVault.state = synthetic(index);
    assert.equal(oldVault.save(), true, `old version saved case ${index}`);
    await oldVault.flushDurable();
    const oldPayload = source.getItem('omega_core_db');
    assert.ok(oldPayload, `old payload exists ${index}`);
    const expected = JSON.parse(oldPayload);
    if ([3, 4, 5].includes(index)) snapshots.set(index, oldPayload);

    // This is the actual old localStorage snapshot, now opened by the new code.
    globalThis.localStorage = storage({ omega_core_db: oldPayload });
    newVault.state = { ...newDefault, currentDate: new Date() };
    newVault.init();
    comparePriorFields(expected, newVault.state, `case ${index} loaded`);
    assert.equal(newVault.save(), true, `new version saved case ${index}`);
    await newVault.flushDurable();
    const retained = JSON.parse(globalThis.localStorage.getItem('omega_core_db'));
    comparePriorFields(expected, retained, `case ${index} retained`);
    upgraded++;
  }
  console.log(`PASS: ${upgraded} synthetic old-version archives loaded and saved without losing prior fields`);

  const oldShadow = Buffer.from(snapshots.get(3), 'utf8').toString('base64');
  globalThis.localStorage = storage({ omega_core_db: snapshots.get(5), omega_shadow_vault: oldShadow });
  newVault.state = { ...newDefault, currentDate: new Date() };
  newVault.init();
  comparePriorFields(JSON.parse(snapshots.get(5)), newVault.state, 'newer main than shadow');

  globalThis.localStorage = storage({ omega_core_db: '{broken', omega_shadow_vault: oldShadow });
  newVault.state = { ...newDefault, currentDate: new Date() };
  newVault.init();
  comparePriorFields(JSON.parse(snapshots.get(3)), newVault.state, 'corrupt main with valid shadow');

  const idb = new Map([['state:main', snapshots.get(5)]]);
  current.DurableStore.get = async (store, key) => idb.get(`${store}:${key}`) ?? null;
  current.DurableStore.put = async (store, value, key) => { idb.set(`${store}:${key}`, value); };
  globalThis.localStorage = storage({ omega_core_db: snapshots.get(3) });
  newVault.state = { ...newDefault, currentDate: new Date() };
  await newVault.initDurable();
  newVault.init();
  comparePriorFields(JSON.parse(snapshots.get(5)), newVault.state, 'durable copy wins');

  // The larger IndexedDB copy must still load if localStorage cannot accept
  // it. A write failure must not silently boot the older, smaller main copy.
  idb.set('state:main', snapshots.get(5));
  globalThis.localStorage = storage({ omega_core_db: snapshots.get(3) }, snapshots.get(3).length + 100);
  newVault.state = { ...newDefault, currentDate: new Date() };
  await newVault.initDurable();
  newVault.init();
  comparePriorFields(JSON.parse(snapshots.get(5)), newVault.state, 'durable copy with full localStorage');

  // The very first upgrade may have no room for its extra checkpoint. The
  // existing durable copy must still open, and neither source is overwritten.
  const quotaIdb = new Map([['state:main', snapshots.get(5)]]);
  current.DurableStore.get = async (store, key) => quotaIdb.get(`${store}:${key}`) ?? null;
  current.DurableStore.put = async (store, value, key) => {
    if (key === 'upgrade-2026-09-11') throw Object.assign(new Error('QuotaExceededError'), { name: 'QuotaExceededError' });
    quotaIdb.set(`${store}:${key}`, value);
  };
  globalThis.localStorage = storage({ omega_core_db: snapshots.get(3) });
  newVault.state = { ...newDefault, currentDate: new Date() };
  await newVault.initDurable();
  newVault.init();
  comparePriorFields(JSON.parse(snapshots.get(5)), newVault.state, 'checkpoint quota failure');
  assert.equal(globalThis.localStorage.getItem('omega_core_db'), snapshots.get(3), 'older local copy remains untouched');
  assert.equal(quotaIdb.get('state:main'), snapshots.get(5), 'durable copy remains untouched');
  current.DurableStore.get = async (store, key) => idb.get(`${store}:${key}`) ?? null;
  current.DurableStore.put = async (store, value, key) => { idb.set(`${store}:${key}`, value); };

  // A deliberate deletion legitimately reduces the transaction count. The
  // newer snapshot, including its tombstone, must win over an older copy.
  const beforeDeletion = JSON.parse(snapshots.get(5));
  const afterDeletion = structuredClone(beforeDeletion);
  const firstMonth = Object.keys(afterDeletion.transactions)[0];
  const removed = afterDeletion.transactions[firstMonth].shift();
  afterDeletion.deletedTx[removed.id] = Date.now();
  afterDeletion.storageRevision = beforeDeletion.storageRevision + 1;
  idb.set('state:main', JSON.stringify(afterDeletion));
  globalThis.localStorage = storage({ omega_core_db: snapshots.get(5) });
  newVault.state = { ...newDefault, currentDate: new Date() };
  await newVault.initDurable();
  newVault.init();
  assert.equal(Object.values(newVault.state.transactions).flat().some(tx => tx.id === removed.id), false, 'deleted transaction must not reappear');
  assert.equal(newVault.state.deletedTx[removed.id], afterDeletion.deletedTx[removed.id], 'deletion tombstone must survive');

  // Simulate two stores receiving different writes between app sessions:
  // the newer copy has a new expense but missed an older one. Neither count
  // nor revision alone is a safe selector; both IDs must remain visible.
  const divergent = structuredClone(beforeDeletion);
  divergent.transactions[firstMonth].shift();
  divergent.transactions[firstMonth].push({ id: 'new-expense', amount: -43.25, date: '2026-01-15', category: 'alimentari' });
  divergent.storageRevision = beforeDeletion.storageRevision + 2;
  idb.set('state:main', JSON.stringify(divergent));
  globalThis.localStorage = storage({ omega_core_db: snapshots.get(5) });
  newVault.state = { ...newDefault, currentDate: new Date() };
  await newVault.initDurable();
  newVault.init();
  const ids = new Set(Object.values(newVault.state.transactions).flat().map(tx => tx.id));
  assert.ok(ids.has(removed.id), 'older expense must survive the divergent write');
  assert.ok(ids.has('new-expense'), 'newer expense must survive the divergent write');
  console.log('PASS: corrupt, quota-blocked, deleted and divergent copies reconcile without losing expenses');
} finally {
  old.DurableStore.put = originalOldPut;
  current.DurableStore.put = originalNewPut;
  current.DurableStore.get = originalNewGet;
  newVault.state = newDefault;
}
