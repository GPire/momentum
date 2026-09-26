import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };
globalThis.indexedDB = undefined;

const { VaultDAO } = await import('./vault.js');
const { setVaultKey, isSealed } = await import('./vault-cipher.js');
const { memoryKeyStore } = await import('../mesh/exchange-identity.js');
const { enablePin, unlockWithPin, loadVaultKey } = await import('./vault-key.js');

function fakeLocalStorage() {
  const store = new Map();
  return { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), _store: store };
}
const DESCR = 'Visita Dott. Esposito';
const legacy = () => JSON.stringify({ schemaVersion: 50, isFirstLaunch: false, deviceId: 'dev-1', transactions: { '2026-09': [{ id: 'a1', amount: 80, category: 'salute', description: DESCR, date: '2026-09-20' }] }, currentDate: new Date().toISOString() });
const defaults = { ...VaultDAO.state };

async function boot(ls, opts) {
  globalThis.localStorage = ls;
  setVaultKey(null);
  VaultDAO.state = { ...defaults, transactions: {}, currentDate: new Date() };
  VaultDAO._lastPlain = undefined;
  VaultDAO.locked = false;
  await VaultDAO.initDurable(opts);
  VaultDAO.init();
}
const txCount = () => Object.values(VaultDAO.state.transactions).flat().length;
test.afterEach(() => setVaultKey(null));

test('utente esistente che aggiorna: dati conservati e riscritti subito cifrati, nulla in chiaro', async () => {
  const ls = fakeLocalStorage();
  ls.setItem('omega_core_db', legacy());
  const store = memoryKeyStore();
  await boot(ls, { store });
  assert.equal(txCount(), 1);
  const raw = ls.getItem('omega_core_db');
  assert.ok(isSealed(raw));
  assert.ok(!raw.includes('Esposito') && !raw.includes('salute'));
  assert.equal(ls.getItem('momentum_onboarded'), '1');
});

test('riavvio: con la chiave del dispositivo il Vault cifrato si riapre identico', async () => {
  const ls = fakeLocalStorage();
  ls.setItem('omega_core_db', legacy());
  const store = memoryKeyStore();
  await boot(ls, { store });
  VaultDAO.addTransaction('2026-09', { id: 'b2', amount: 12, category: 'cibo', description: 'Panificio', date: '2026-09-21', type: 'uscita' }, { noDedup: true });
  await boot(ls, { store });
  assert.equal(txCount(), 2);
  assert.ok(Object.values(VaultDAO.state.transactions).flat().some((t) => t.description === DESCR));
});

test('dati cifrati ma chiave assente: sola lettura, l\'archivio non viene MAI sovrascritto', async () => {
  const ls = fakeLocalStorage();
  ls.setItem('omega_core_db', legacy());
  await boot(ls, { store: memoryKeyStore() });
  const cifrato = ls.getItem('omega_core_db');
  await boot(ls, { store: memoryKeyStore() });
  assert.equal(VaultDAO.locked, true);
  assert.equal(txCount(), 0);
  VaultDAO.state.transactions = { '2026-09': [] };
  assert.equal(VaultDAO.save(), false);
  assert.equal(ls.getItem('omega_core_db'), cifrato);
});

test('salvataggio senza modifiche: nessuna riscrittura inutile anche se il cifrato cambia a ogni volta', async () => {
  const ls = fakeLocalStorage();
  ls.setItem('omega_core_db', legacy());
  await boot(ls, { store: memoryKeyStore() });
  const prima = ls.getItem('omega_core_db');
  assert.equal(VaultDAO.save(), false);
  assert.equal(ls.getItem('omega_core_db'), prima);
});

test('PIN: col PIN giusto il Vault si apre; senza, resta chiuso e intatto', async () => {
  const ls = fakeLocalStorage();
  ls.setItem('omega_core_db', legacy());
  const store = memoryKeyStore();
  await boot(ls, { store });
  const { key } = await loadVaultKey(store);
  await enablePin(store, key, '739152', { iterations: 1000 });
  const cifrato = ls.getItem('omega_core_db');
  await boot(ls, { store, requestPin: async () => null });
  assert.equal(VaultDAO.locked, true);
  assert.equal(VaultDAO.save(), false);
  assert.equal(ls.getItem('omega_core_db'), cifrato);
  await boot(ls, { store, requestPin: (record) => unlockWithPin(record, '739152') });
  assert.equal(VaultDAO.locked, false);
  assert.equal(txCount(), 1);
});

test('primo avvio assoluto: chiave creata, primo salvataggio già cifrato', async () => {
  const ls = fakeLocalStorage();
  const store = memoryKeyStore();
  await boot(ls, { store });
  assert.equal(VaultDAO.keyStatus, 'ready');
  VaultDAO.state.isFirstLaunch = false;
  assert.equal(VaultDAO.save(), true);
  assert.ok(isSealed(ls.getItem('omega_core_db')));
});
