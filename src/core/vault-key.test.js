import test from 'node:test';
import assert from 'node:assert/strict';
import { loadVaultKey, createVaultKey, enablePin, unlockWithPin, disablePin, destroyVaultKey, KEK_RECORD_ID, generateRecoveryCode, normalizeRecoveryCode, wrapRecovery, unlockWithRecovery, setRecovery } from './vault-key.js';
import { memoryKeyStore } from '../mesh/exchange-identity.js';

const FAST = { iterations: 1000 };

test('primo avvio: nessuna chiave; creata, conservata e riletta identica', async () => {
  const store = memoryKeyStore();
  assert.equal((await loadVaultKey(store)).status, 'none');
  const key = await createVaultKey(store);
  const r = await loadVaultKey(store);
  assert.equal(r.status, 'ready');
  assert.deepEqual(r.key, key);
});

test('la chiave del dispositivo non è esportabile: nessuno legge i byte che avvolgono i dati', async () => {
  const store = memoryKeyStore();
  await createVaultKey(store);
  const kek = await store.get(KEK_RECORD_ID);
  assert.equal(kek.extractable, false);
  await assert.rejects(crypto.subtle.exportKey('raw', kek));
});

test('deposito che non conserva: la chiave NON viene usata (i dati sarebbero persi al riavvio)', async () => {
  const smemorato = { disponibile: true, get: async () => null, put: async () => {}, del: async () => {} };
  await assert.rejects(createVaultKey(smemorato));
});

test('deposito irraggiungibile o bloccato: stato dichiarato, mai un blocco infinito', async () => {
  assert.equal((await loadVaultKey({ disponibile: false })).status, 'unavailable');
  const appeso = { disponibile: true, get: () => new Promise(() => {}) };
  assert.equal((await loadVaultKey(appeso, { timeoutMs: 20 })).status, 'unavailable');
});

test('chiave del dispositivo sparita: stato "broken", mai una chiave nuova che renderebbe illeggibili i dati', async () => {
  const store = memoryKeyStore();
  await createVaultKey(store);
  await store.del(KEK_RECORD_ID);
  assert.equal((await loadVaultKey(store)).status, 'broken');
});

test('PIN: stessa chiave dei dati, apribile solo col PIN giusto; la copia del dispositivo sparisce', async () => {
  const store = memoryKeyStore();
  const key = await createVaultKey(store);
  await enablePin(store, key, '482915', FAST);
  const r = await loadVaultKey(store);
  assert.equal(r.status, 'pin');
  assert.equal(await store.get(KEK_RECORD_ID), null);
  assert.equal(await unlockWithPin(r.record, '000000'), null);
  assert.deepEqual(await unlockWithPin(r.record, '482915'), key);
});

test('PIN troppo corto: rifiutato', async () => {
  const store = memoryKeyStore();
  const key = await createVaultKey(store);
  await assert.rejects(enablePin(store, key, '1234', FAST), /pin_too_short/);
  assert.equal((await loadVaultKey(store)).status, 'ready');
});

test('togliere il PIN riporta la stessa chiave in modo dispositivo; cancellazione totale la elimina', async () => {
  const store = memoryKeyStore();
  const key = await createVaultKey(store);
  await enablePin(store, key, 'passphrase lunga', FAST);
  await disablePin(store, key);
  const r = await loadVaultKey(store);
  assert.deepEqual([r.status, r.key], ['ready', key]);
  await destroyVaultKey(store);
  assert.equal((await loadVaultKey(store)).status, 'none');
});

const RAPIDO = { iterations: 1000 };

test('codice di recupero: 32 caratteri leggibili in 8 gruppi, sempre diverso', () => {
  const a = generateRecoveryCode();
  assert.match(a, /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){7}$/);
  assert.notEqual(generateRecoveryCode(), a);
});

test('codice di recupero: ricopiato con minuscole, spazi o I/O al posto di 1/0 funziona uguale', () => {
  assert.equal(normalizeRecoveryCode('abcd efgh-1o1i'), 'ABCDEFGH1011');
});

test('PIN dimenticato: il codice di recupero apre la stessa chiave; un codice sbagliato no', async () => {
  const store = memoryKeyStore();
  const key = await createVaultKey(store);
  const code = generateRecoveryCode();
  await enablePin(store, key, '739152', { ...RAPIDO, recovery: await wrapRecovery(key, code, RAPIDO) });
  const { record } = await loadVaultKey(store);
  assert.deepEqual(await unlockWithRecovery(record, code.toLowerCase().replace(/-/g, ' ')), key);
  assert.equal(await unlockWithRecovery(record, generateRecoveryCode()), null);
  assert.equal(await unlockWithRecovery(record, 'corto'), null);
});

test('cambiare PIN conserva il codice di recupero; generarne uno nuovo invalida il vecchio', async () => {
  const store = memoryKeyStore();
  const key = await createVaultKey(store);
  const vecchio = generateRecoveryCode();
  await enablePin(store, key, '739152', { ...RAPIDO, recovery: await wrapRecovery(key, vecchio, RAPIDO) });
  await enablePin(store, key, '555111', RAPIDO);
  assert.deepEqual(await unlockWithRecovery((await loadVaultKey(store)).record, vecchio), key);
  const nuovo = generateRecoveryCode();
  await setRecovery(store, key, nuovo, RAPIDO);
  const { record } = await loadVaultKey(store);
  assert.equal(await unlockWithRecovery(record, vecchio), null);
  assert.deepEqual(await unlockWithRecovery(record, nuovo), key);
  assert.deepEqual(await unlockWithPin(record, '555111'), key);
});
