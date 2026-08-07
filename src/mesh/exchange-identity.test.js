'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  memoryKeyStore, loadOrCreateExchangeIdentity, openSealedAny, chiaveUsabile,
  statoIdentita, GRAZIA_CHIAVE_VECCHIA_MS, MAX_CHIAVI_RITIRATE, RECORD_ID,
} from './exchange-identity.js';
import { sealFor, generateExchangeIdentity } from './store-forward.js';

test('la prima volta crea un\'identita\' e la conserva', async () => {
  const store = memoryKeyStore();
  const id = await loadOrCreateExchangeIdentity(store);
  assert.ok(id.publicKey);
  assert.equal(id.persistente, true);
  assert.equal(id.nuova, true);
  assert.ok(await store.get(RECORD_ID), 'deve essere finita nel deposito');
});

test('IL DIFETTO CORRETTO: dopo un riavvio la chiave e\' LA STESSA', async () => {
  const store = memoryKeyStore();
  const primo = await loadOrCreateExchangeIdentity(store);
  const dopoRiavvio = await loadOrCreateExchangeIdentity(store);
  assert.equal(dopoRiavvio.publicKey, primo.publicKey,
    'se cambia, ogni pacchetto gia\' in viaggio verso questo dispositivo e\' perso per sempre');
  assert.equal(dopoRiavvio.nuova, false);
});

test('IL CASO REALE: un pacchetto sigillato PRIMA del riavvio si apre DOPO', async () => {
  const store = memoryKeyStore();
  const destinatario = await loadOrCreateExchangeIdentity(store);
  const mittente = await generateExchangeIdentity();
  // Un amico sigilla per me mentre io sono offline.
  const pacco = await sealFor(destinatario.publicKey, mittente, { importo: 42, nota: 'cena' });
  // Io riapro l'app: e' un processo nuovo, tutto quello che era in memoria e' sparito.
  const dopoRiavvio = await loadOrCreateExchangeIdentity(store);
  const aperto = await openSealedAny(dopoRiavvio, pacco);
  assert.deepEqual(aperto, { importo: 42, nota: 'cena' });
});

test('la vecchia versione avrebbe perso quel pacchetto (contro-prova)', async () => {
  const mittente = await generateExchangeIdentity();
  const vecchiaIdentita = await generateExchangeIdentity();
  const pacco = await sealFor(vecchiaIdentita.publicKey, mittente, { x: 1 });
  // Comportamento precedente: al riavvio si rigenerava e basta.
  const rigenerata = await generateExchangeIdentity();
  const aperto = await openSealedAny({ ...rigenerata, ritirate: [] }, pacco);
  assert.equal(aperto, null, 'e\' esattamente il dato che spariva senza che nessuno se ne accorgesse');
});

test('SIMULAZIONE 30 giorni: consegna prima e dopo la correzione', async () => {
  // Modello semplice: 3 ricariche al giorno, incontro con un portatore ogni ~1 giorno.
  const GIORNI = 30, RICARICHE = 3;
  const store = memoryKeyStore();
  let consegnatiPrima = 0, consegnatiDopo = 0;
  const mittente = await generateExchangeIdentity();

  let identitaVolatile = await generateExchangeIdentity(); // comportamento vecchio
  for (let g = 0; g < GIORNI; g++) {
    const persistente = await loadOrCreateExchangeIdentity(store);
    const paccoV = await sealFor(identitaVolatile.publicKey, mittente, { g });
    const paccoP = await sealFor(persistente.publicKey, mittente, { g });
    // ...passa un giorno, con le sue ricariche...
    for (let r = 0; r < RICARICHE; r++) identitaVolatile = await generateExchangeIdentity();
    const oggiVolatile = identitaVolatile;
    const oggiPersistente = await loadOrCreateExchangeIdentity(store);
    if (await openSealedAny({ ...oggiVolatile, ritirate: [] }, paccoV)) consegnatiPrima++;
    if (await openSealedAny(oggiPersistente, paccoP)) consegnatiDopo++;
  }
  assert.equal(consegnatiPrima, 0, 'il canale a consegna differita era, di fatto, spento');
  assert.equal(consegnatiDopo, GIORNI, 'con la chiave persistente arriva tutto');
});

test('una chiave salvata ma INUTILIZZABILE viene sostituita, non usata a vuoto', async () => {
  const store = memoryKeyStore();
  const buona = await loadOrCreateExchangeIdentity(store);
  // Verifica che fallisce sempre: simula un record corrotto o un browser difettoso.
  const rigenerata = await loadOrCreateExchangeIdentity(store, { verifica: async () => false });
  assert.notEqual(rigenerata.publicKey, buona.publicKey);
  assert.match(rigenerata.motivo, /non era piu' utilizzabile/);
  assert.equal(await chiaveUsabile(rigenerata), true, 'la sostituta deve funzionare davvero');
});

test('PERIODO DI GRAZIA: una sostituzione non butta via la posta in viaggio', async () => {
  const store = memoryKeyStore();
  const vecchia = await loadOrCreateExchangeIdentity(store);
  const mittente = await generateExchangeIdentity();
  const inViaggio = await sealFor(vecchia.publicKey, mittente, { salvato: true });
  const nuova = await loadOrCreateExchangeIdentity(store, { verifica: async () => false });
  const aperto = await openSealedAny(nuova, inViaggio);
  assert.deepEqual(aperto, { salvato: true }, 'ruotare una chiave non deve significare perdere la corrispondenza');
});

test('la grazia SCADE: oltre due settimane la chiave vecchia non si tiene piu\'', async () => {
  const store = memoryKeyStore();
  const t0 = Date.now();
  const A = await loadOrCreateExchangeIdentity(store, { now: t0 });
  // A viene ritirata adesso: deve restare, perche' possono esserci pacchetti vivi.
  const B = await loadOrCreateExchangeIdentity(store, { verifica: async () => false, now: t0 });
  assert.deepEqual(B.ritirate.map((k) => k.publicKey), [A.publicKey]);
  // Due settimane dopo si ritira anche B: A e' ormai inutile e deve sparire.
  const C = await loadOrCreateExchangeIdentity(store, {
    verifica: async () => false, now: t0 + GRAZIA_CHIAVE_VECCHIA_MS + 1,
  });
  const tenute = C.ritirate.map((k) => k.publicKey);
  assert.ok(!tenute.includes(A.publicKey), 'tenere chiavi morte e\' solo superficie d\'attacco in piu\'');
  assert.deepEqual(tenute, [B.publicKey], 'quella appena ritirata invece serve ancora');
});

test('le chiavi ritirate non si accumulano all\'infinito', async () => {
  const store = memoryKeyStore();
  let ultima = await loadOrCreateExchangeIdentity(store);
  for (let i = 0; i < 8; i++) ultima = await loadOrCreateExchangeIdentity(store, { verifica: async () => false });
  assert.ok(ultima.ritirate.length <= MAX_CHIAVI_RITIRATE, `trattenute ${ultima.ritirate.length}`);
});

test('deposito NON disponibile: si funziona lo stesso e lo si DICHIARA', async () => {
  const spento = { disponibile: false, async get() { return null; }, async put() {}, async del() {} };
  const id = await loadOrCreateExchangeIdentity(spento);
  assert.ok(id.publicKey, 'l\'app deve continuare a funzionare');
  assert.equal(id.persistente, false);
  assert.equal(statoIdentita(id).ok, false);
  assert.match(statoIdentita(id).testo, /mentre Momentum è chiuso/);
});

test('deposito che ESPLODE in scrittura: nessun crash, stato onesto', async () => {
  const rotto = {
    disponibile: true,
    async get() { throw new Error('IndexedDB non leggibile'); },
    async put() { throw new Error('quota superata'); },
    async del() {},
  };
  const id = await loadOrCreateExchangeIdentity(rotto);
  assert.ok(id.publicKey);
  assert.equal(id.persistente, false);
  assert.match(id.motivo, /non riesce a conservarla/);
});

test('record incompleto (scrittura interrotta a meta\') non manda in errore', async () => {
  const store = memoryKeyStore();
  await store.put(RECORD_ID, { v: 1, publicKey: 'abc' }); // manca la privata
  const id = await loadOrCreateExchangeIdentity(store);
  assert.ok(id.publicKey);
  assert.equal(id.nuova, true);
  assert.match(id.motivo, /record incompleto/);
});

test('un pacchetto per QUALCUN ALTRO resta chiuso, anche con le chiavi vecchie', async () => {
  const store = memoryKeyStore();
  const io = await loadOrCreateExchangeIdentity(store);
  const altro = await generateExchangeIdentity();
  const mittente = await generateExchangeIdentity();
  const nonMio = await sealFor(altro.publicKey, mittente, { segreto: 'non tuo' });
  assert.equal(await openSealedAny(io, nonMio), null);
  const conRitirate = await loadOrCreateExchangeIdentity(store, { verifica: async () => false });
  assert.equal(await openSealedAny(conRitirate, nonMio), null, 'la grazia non deve mai diventare una scorciatoia');
});

test('due dispositivi hanno identita\' DIVERSE (depositi separati)', async () => {
  const a = await loadOrCreateExchangeIdentity(memoryKeyStore());
  const b = await loadOrCreateExchangeIdentity(memoryKeyStore());
  assert.notEqual(a.publicKey, b.publicKey);
});

test('N DISPOSITIVI: 12 nodi, ognuno sigilla per tutti gli altri, tutti riavviano', async () => {
  const N = 12;
  const depositi = Array.from({ length: N }, () => memoryKeyStore());
  const identita = [];
  for (const d of depositi) identita.push(await loadOrCreateExchangeIdentity(d));

  const pacchi = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if (i === j) continue;
      pacchi.push({ j, b: await sealFor(identita[j].publicKey, identita[i], { da: i, a: j }) });
    }
  }
  // Tutti riavviano prima di ricevere.
  const dopo = [];
  for (const d of depositi) dopo.push(await loadOrCreateExchangeIdentity(d));

  let consegnati = 0;
  for (const { j, b } of pacchi) if (await openSealedAny(dopo[j], b)) consegnati++;
  assert.equal(consegnati, N * (N - 1), `attesi ${N * (N - 1)}, consegnati ${consegnati}`);
});

test('STAFFETTA A PIU\' SALTI: il portatore intermedio non legge mai il contenuto', async () => {
  const mittente = await loadOrCreateExchangeIdentity(memoryKeyStore());
  const destinatario = await loadOrCreateExchangeIdentity(memoryKeyStore());
  const pacco = await sealFor(destinatario.publicKey, mittente, { iban: 'IT60X0542811101000000123456' });
  // Sei portatori diversi lo passano di mano in mano, e ognuno riavvia.
  for (let salto = 0; salto < 6; salto++) {
    const dep = memoryKeyStore();
    await loadOrCreateExchangeIdentity(dep);
    const portatore = await loadOrCreateExchangeIdentity(dep);
    assert.equal(await openSealedAny(portatore, pacco), null, `il portatore ${salto} non deve poter leggere`);
  }
  const finale = await openSealedAny(destinatario, pacco);
  assert.equal(finale.iban, 'IT60X0542811101000000123456');
});

test('statoIdentita\' dice da quanti giorni l\'identita\' e\' attiva', async () => {
  const store = memoryKeyStore();
  const t0 = Date.now();
  await loadOrCreateExchangeIdentity(store, { now: t0 });
  const id = await loadOrCreateExchangeIdentity(store, { now: t0 });
  const s = statoIdentita(id, { now: t0 + 5 * 86400000 });
  assert.equal(s.ok, true);
  assert.match(s.testo, /5 giorni/);
});
