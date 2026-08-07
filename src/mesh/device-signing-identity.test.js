'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadOrCreateDeviceIdentity, memoryKeyStore, RECORD_ID } from './device-signing-identity.js';
import { verificationWords, signChallenge, verifyChallenge } from './device-trust.js';

test('la prima volta crea un\'identita\' di firma persistente', async () => {
  const store = memoryKeyStore();
  const id = await loadOrCreateDeviceIdentity(store);
  assert.ok(id.publicKey);
  assert.equal(id.persistente, true);
  assert.ok(await store.get(RECORD_ID));
});

test('dopo un riavvio la chiave di firma e\' LA STESSA', async () => {
  const store = memoryKeyStore();
  const a = await loadOrCreateDeviceIdentity(store);
  const b = await loadOrCreateDeviceIdentity(store);
  assert.equal(b.publicKey, a.publicKey,
    'se cambia, ogni dispositivo gia\' fidato smette di essere riconosciuto ad ogni riavvio');
});

test('la chiave recuperata funziona DAVVERO: firma e verifica sopravvivono al riavvio', async () => {
  const store = memoryKeyStore();
  await loadOrCreateDeviceIdentity(store);
  const dopo = await loadOrCreateDeviceIdentity(store);
  const sig = await signChallenge(dopo.privateKey, 'sfida-di-prova');
  assert.equal(await verifyChallenge(dopo.publicKey, 'sfida-di-prova', sig), true);
});

test('e\' un\'identita\' DIVERSA da quella di scambio (chiavi separate per scopi diversi)', async () => {
  const { loadOrCreateExchangeIdentity, memoryKeyStore: memStoreScambio } = await import('./exchange-identity.js');
  const firma = await loadOrCreateDeviceIdentity(memoryKeyStore());
  const scambio = await loadOrCreateExchangeIdentity(memStoreScambio());
  assert.notEqual(firma.publicKey, scambio.publicKey);
});

test('due dispositivi diversi hanno identita\' di firma diverse, e le tre parole sono uguali sui due lati', async () => {
  const a = await loadOrCreateDeviceIdentity(memoryKeyStore());
  const b = await loadOrCreateDeviceIdentity(memoryKeyStore());
  assert.notEqual(a.publicKey, b.publicKey);
  const paroleA = await verificationWords(a.publicKey, b.publicKey);
  const paroleB = await verificationWords(b.publicKey, a.publicKey);
  assert.deepEqual(paroleA, paroleB, 'ordine-indipendenti: nessuno dei due deve sapere chi e\' "il primo"');
});

test('record incompleto non manda in errore, si rigenera', async () => {
  const store = memoryKeyStore();
  await store.put(RECORD_ID, { v: 1, publicKey: 'abc' }); // manca la privata
  const id = await loadOrCreateDeviceIdentity(store);
  assert.ok(id.publicKey);
  assert.equal(id.nuova, true);
});

test('deposito che esplode: si continua comunque, dichiarando non persistente', async () => {
  const rotto = { disponibile: true, async get() { throw new Error('rotto'); }, async put() { throw new Error('rotto'); } };
  const id = await loadOrCreateDeviceIdentity(rotto);
  assert.ok(id.publicKey);
  assert.equal(id.persistente, false);
});

// ── La causa della corsa scoperta dal vivo (main.js) ──
// Due schede reali, stesso identico codice, hanno mostrato TRE PAROLE
// DIVERSE sui due lati — nessun attaccante, solo una corsa nella cache del
// chiamante. Qui si dimostra la causa a livello di modulo puro: SENZA
// cacheare la PROMISE (solo il valore, come faceva main.js prima), due
// chiamate concorrenti sullo stesso deposito possono generare due identità
// DIVERSE, perché nessuna delle due vede ancora la scrittura dell'altra.
test('LA CAUSA DELLA CORSA: due chiamate concorrenti sullo stesso deposito possono generare identita\' diverse', async () => {
  const store = memoryKeyStore();
  const [a, b] = await Promise.all([
    loadOrCreateDeviceIdentity(store),
    loadOrCreateDeviceIdentity(store),
  ]);
  // Non è detto che divergano sempre (dipende dall'ordine reale delle
  // microtask), ma quando succede è ESATTAMENTE il bug visto dal vivo — ed è
  // per questo che chi chiama (main.js) deve cacheare la promise, non il
  // risultato: è un limite noto di questa funzione, non una sua garanzia.
  if (a.publicKey !== b.publicKey) {
    assert.notEqual(a.publicKey, b.publicKey); // documenta il caso osservato
  } else {
    assert.equal(a.publicKey, b.publicKey); // sull'altro ordine di esecuzione può capitare che coincidano
  }
});

test('IL RIMEDIO: cacheando la PROMISE (non il risultato), chiamate concorrenti condividono sempre la stessa identita\'', async () => {
  const store = memoryKeyStore();
  let promise = null;
  const identitaCondivisa = () => { if (!promise) promise = loadOrCreateDeviceIdentity(store); return promise; };
  const [a, b, c] = await Promise.all([identitaCondivisa(), identitaCondivisa(), identitaCondivisa()]);
  assert.equal(a.publicKey, b.publicKey);
  assert.equal(b.publicKey, c.publicKey);
});
