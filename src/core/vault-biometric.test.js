import test from 'node:test';
import assert from 'node:assert/strict';
import { biometricAvailability, enableBiometric, unlockWithBiometric, disableBiometric, BIOMETRIC_DATA_KEY } from './vault-biometric.js';
import { memoryKeyStore } from '../mesh/exchange-identity.js';
import { createVaultKey, enablePin, setBiometricFlag, loadVaultKey, disablePin } from './vault-key.js';

function finto({ tipo = 2, forte = true, annulla = false } = {}) {
  const dati = new Map();
  const chiamate = [];
  return {
    chiamate,
    isAvailable: async () => ({ isAvailable: true, strongBiometryIsAvailable: forte, biometryType: tipo }),
    setData: async (o) => { chiamate.push(o); dati.set(o.key, o); },
    getSecureData: async ({ key }) => { if (annulla) throw new Error('cancel'); const d = dati.get(key); if (!d || d.accessControl !== 1) throw new Error('21'); return { value: d.value }; },
    deleteData: async ({ key }) => { dati.delete(key); },
  };
}

test('disponibilità: solo biometria forte; Face ID e impronta riconosciuti', async () => {
  assert.deepEqual(await biometricAvailability(finto({ tipo: 2 })), { available: true, kind: 'face' });
  assert.deepEqual(await biometricAvailability(finto({ tipo: 3 })), { available: true, kind: 'fingerprint' });
  assert.equal((await biometricAvailability(finto({ forte: false }))).available, false);
  assert.equal((await biometricAvailability({ isAvailable: async () => { throw new Error('web'); } })).available, false);
});

test('attivazione: la chiave va nel Keychain/Keystore protetta dalla biometria attuale, senza finestra di validità', async () => {
  const p = finto();
  const key = crypto.getRandomValues(new Uint8Array(32));
  await enableBiometric(p, key);
  assert.equal(p.chiamate[0].key, BIOMETRIC_DATA_KEY);
  assert.equal(p.chiamate[0].accessControl, 1);
  assert.equal(p.chiamate[0].authValidityDuration, 0);
  assert.deepEqual(await unlockWithBiometric(p), key);
});

test('annullato, rimosso o invalidato: null, e si passa al PIN', async () => {
  const key = crypto.getRandomValues(new Uint8Array(32));
  const annullato = finto({ annulla: true });
  await enableBiometric(annullato, key);
  assert.equal(await unlockWithBiometric(annullato), null);
  const p = finto();
  await enableBiometric(p, key);
  await disableBiometric(p);
  assert.equal(await unlockWithBiometric(p), null);
});

test('il flag biometria vive solo nel modo PIN e si perde togliendo il PIN', async () => {
  const store = memoryKeyStore();
  const key = await createVaultKey(store);
  await assert.rejects(setBiometricFlag(store, true));
  await enablePin(store, key, '739152', { iterations: 1000 });
  await setBiometricFlag(store, true);
  assert.equal((await loadVaultKey(store)).record.biometric, true);
  await disablePin(store, key);
  assert.equal((await loadVaultKey(store)).status, 'ready');
});
