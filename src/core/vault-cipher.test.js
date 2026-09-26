import test from 'node:test';
import assert from 'node:assert/strict';
import { seal, open, sealValue, openValue, setVaultKey, vaultKeyActive, isSealed, VaultLockedError, SEAL_PREFIX } from './vault-cipher.js';

const chiave = () => crypto.getRandomValues(new Uint8Array(32));
test.afterEach(() => setVaultKey(null));

test('senza chiave: nessuna trasformazione, i dati esistenti restano leggibili', () => {
  assert.equal(vaultKeyActive(), false);
  assert.equal(seal('{"a":1}'), '{"a":1}');
  assert.equal(open('{"a":1}'), '{"a":1}');
  assert.deepEqual(sealValue({ a: 1 }), { a: 1 });
});

test('con chiave: il testo salvato non contiene nulla del contenuto e torna identico', () => {
  setVaultKey(chiave());
  const piano = JSON.stringify({ descrizione: 'Farmacia Rossi', importo: 42.5, iban: 'IT60X0542811101000000123456' });
  const cifrato = seal(piano);
  assert.ok(cifrato.startsWith(SEAL_PREFIX));
  for (const pezzo of ['Farmacia', 'Rossi', '42.5', 'IT60X']) assert.ok(!cifrato.includes(pezzo));
  assert.equal(open(cifrato), piano);
  assert.notEqual(seal(piano), cifrato, 'nonce casuale: due salvataggi identici non sono confrontabili');
});

test('testo non cifrato (dati di prima) si legge anche con la chiave attiva: migrazione senza perdite', () => {
  setVaultKey(chiave());
  assert.equal(open('{"vecchio":true}'), '{"vecchio":true}');
});

test('dati cifrati senza chiave: errore esplicito, mai uno stato vuoto', () => {
  setVaultKey(chiave());
  const c = seal('segreto');
  setVaultKey(null);
  assert.throws(() => open(c), VaultLockedError);
});

test('chiave sbagliata o testo manomesso: rifiutato', () => {
  setVaultKey(chiave());
  const c = seal('segreto');
  setVaultKey(chiave());
  assert.throws(() => open(c));
  const k = chiave();
  setVaultKey(k);
  const d = seal('segreto');
  const manomesso = d.slice(0, -4) + (d.at(-4) === 'A' ? 'B' : 'A') + d.slice(-3);
  assert.throws(() => open(manomesso));
});

test('oggetti: i campi in chiaro richiesti restano leggibili, il resto no', () => {
  setVaultKey(chiave());
  const archivio = { invoiceId: 'F-1', cliente: 'Mario Bianchi', pdf: 'JVBERi0x', manifestSha256: 'abc' };
  const s = sealValue(archivio, { manifestSha256: 'abc' });
  assert.equal(s.manifestSha256, 'abc');
  assert.ok(isSealed(s));
  assert.ok(!JSON.stringify(s).includes('Bianchi'));
  assert.deepEqual(openValue(s), archivio);
  assert.deepEqual(openValue(archivio), archivio);
});

test('archivi grandi (oltre 1 MB, come un Vault con anni di movimenti e foto) vanno e tornano', () => {
  setVaultKey(chiave());
  const grande = JSON.stringify({ righe: Array.from({ length: 40000 }, (_, i) => ({ id: i, d: 'descrizione con àccenti € ' + i })) });
  assert.ok(grande.length > 1_000_000);
  assert.equal(open(seal(grande)), grande);
});

test('chiave di lunghezza sbagliata: rifiutata subito', () => {
  assert.throws(() => setVaultKey(new Uint8Array(16)));
});
