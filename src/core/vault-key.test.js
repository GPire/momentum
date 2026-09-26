import test from 'node:test';
import assert from 'node:assert/strict';
import { loadVaultKey, createVaultKey, enablePin, unlockWithPin, disablePin, destroyVaultKey, KEK_RECORD_ID } from './vault-key.js';
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
