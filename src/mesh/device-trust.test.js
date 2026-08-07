'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateIdentity, verificationWords, newChallenge, signChallenge, verifyChallenge,
  addTrustedDevice, removeTrustedDevice, isTrustedKey, authenticatePeer, PAROLE,
} from './device-trust.js';

test('identità: ogni dispositivo ha una chiave pubblica diversa', async () => {
  const a = await generateIdentity();
  const b = await generateIdentity();
  assert.ok(a.publicKey && b.publicKey);
  assert.notEqual(a.publicKey, b.publicKey);
});

test('identità: la chiave privata NON è esportabile (non può lasciare il dispositivo)', async () => {
  const a = await generateIdentity();
  await assert.rejects(
    () => globalThis.crypto.subtle.exportKey('pkcs8', a.privateKey),
    'una chiave privata esportabile potrebbe essere copiata su un altro dispositivo',
  );
});

// ── LE TRE PAROLE: come si distingue "il mio telefono" da "quello di un altro" ──
test('parole: i DUE dispositivi calcolano la stessa terna, in qualunque ordine', async () => {
  const a = await generateIdentity();
  const b = await generateIdentity();
  const daA = await verificationWords(a.publicKey, b.publicKey);
  const daB = await verificationWords(b.publicKey, a.publicKey); // ordine invertito
  assert.deepEqual(daA, daB, 'i due schermi devono mostrare le STESSE parole senza accordarsi su chi è primo');
  assert.equal(daA.length, 3);
  assert.ok(daA.every((p) => PAROLE.includes(p)));
});

test('parole: un TERZO che si infila nel mezzo produce parole DIVERSE (è così che lo si vede)', async () => {
  const io = await generateIdentity();
  const mioAltroTelefono = await generateIdentity();
  const intruso = await generateIdentity();

  const atteso = await verificationWords(io.publicKey, mioAltroTelefono.publicKey);
  // L'intruso si mette in mezzo: io vedo le parole calcolate con LUI
  const conIntruso = await verificationWords(io.publicKey, intruso.publicKey);
  assert.notDeepEqual(atteso, conIntruso, 'se coincidessero, un attacco nel mezzo sarebbe invisibile');
});

test('parole: deterministiche — le stesse chiavi danno sempre le stesse parole', async () => {
  const a = await generateIdentity();
  const b = await generateIdentity();
  assert.deepEqual(await verificationWords(a.publicKey, b.publicKey), await verificationWords(a.publicKey, b.publicKey));
});

// ── LA PROVA DI POSSESSO: un id si può dichiarare, una firma no ──
test('sfida: chi possiede la chiave privata la firma e viene verificato', async () => {
  const a = await generateIdentity();
  const sfida = newChallenge();
  const firma = await signChallenge(a.privateKey, sfida);
  assert.equal(await verifyChallenge(a.publicKey, sfida, firma), true);
});

test('sfida: chi NON ha la chiave privata non può produrre una firma valida', async () => {
  const vero = await generateIdentity();
  const impostore = await generateIdentity();
  const sfida = newChallenge();
  const firmaImpostore = await signChallenge(impostore.privateKey, sfida);
  assert.equal(await verifyChallenge(vero.publicKey, sfida, firmaImpostore), false,
    'firmare con un\'altra chiave non deve mai passare per il dispositivo vero');
});

test('sfida: una firma vecchia non vale per una sfida nuova (niente replay)', async () => {
  const a = await generateIdentity();
  const sfida1 = newChallenge();
  const firma1 = await signChallenge(a.privateKey, sfida1);
  const sfida2 = newChallenge();
  assert.notEqual(sfida1, sfida2);
  assert.equal(await verifyChallenge(a.publicKey, sfida2, firma1), false,
    'riusare una firma intercettata deve fallire');
});

test('sfida: firma o chiave malformate -> non fidato, mai un\'eccezione', async () => {
  const a = await generateIdentity();
  assert.equal(await verifyChallenge(a.publicKey, 'x', 'non-una-firma'), false);
  assert.equal(await verifyChallenge('non-una-chiave', 'x', 'y'), false);
  assert.equal(await verifyChallenge(null, null, null), false);
});

// ── IL REGISTRO: si indicizza per CHIAVE, non per nome dichiarato ──
test('registro: aggiunge, riconosce e rimuove per chiave pubblica', async () => {
  const a = await generateIdentity();
  let lista = addTrustedDevice([], { publicKey: a.publicKey, label: 'Il mio tablet' });
  assert.equal(isTrustedKey(lista, a.publicKey), true);
  lista = removeTrustedDevice(lista, a.publicKey);
  assert.equal(isTrustedKey(lista, a.publicKey), false);
});

test('registro: non duplica lo stesso dispositivo', async () => {
  const a = await generateIdentity();
  let lista = addTrustedDevice([], { publicKey: a.publicKey });
  lista = addTrustedDevice(lista, { publicKey: a.publicKey, label: 'di nuovo' });
  assert.equal(lista.length, 1);
});

// ── LO SCENARIO CHE CONTA: lo sconosciuto sulla stessa rete ──
test('SCENARIO: uno sconosciuto sullo stesso Wi-Fi NON viene autenticato', async () => {
  const mioTelefono = await generateIdentity();
  const mioTablet = await generateIdentity();
  const sconosciutoNelBar = await generateIdentity();

  const fidati = addTrustedDevice([], { publicKey: mioTablet.publicKey, label: 'Tablet' });
  const sfida = newChallenge();

  // Il mio tablet: riconosciuto.
  const mio = await authenticatePeer(fidati, {
    publicKey: mioTablet.publicKey, challenge: sfida,
    signature: await signChallenge(mioTablet.privateKey, sfida),
  });
  assert.equal(mio.ok, true);

  // Lo sconosciuto, pur essendo sulla stessa rete: respinto.
  const estraneo = await authenticatePeer(fidati, {
    publicKey: sconosciutoNelBar.publicKey, challenge: sfida,
    signature: await signChallenge(sconosciutoNelBar.privateKey, sfida),
  });
  assert.equal(estraneo.ok, false);
  assert.match(estraneo.reason, /non tra quelli che hai collegato/);
});

test('SCENARIO: chi RUBA la chiave pubblica di un tuo dispositivo non passa comunque', async () => {
  // La chiave pubblica è pubblica per definizione: viaggia in rete e può
  // essere copiata. Se bastasse quella, il registro sarebbe inutile.
  const mioTablet = await generateIdentity();
  const ladro = await generateIdentity();
  const fidati = addTrustedDevice([], { publicKey: mioTablet.publicKey });
  const sfida = newChallenge();

  const esito = await authenticatePeer(fidati, {
    publicKey: mioTablet.publicKey,                               // si spaccia per il tablet
    challenge: sfida,
    signature: await signChallenge(ladro.privateKey, sfida),      // ma firma con la SUA chiave
  });
  assert.equal(esito.ok, false);
  assert.match(esito.reason, /non ha dimostrato di possedere la chiave/);
});

test('SCENARIO: un dispositivo rimosso smette immediatamente di essere riconosciuto', async () => {
  const vecchioTelefono = await generateIdentity();
  let fidati = addTrustedDevice([], { publicKey: vecchioTelefono.publicKey });
  fidati = removeTrustedDevice(fidati, vecchioTelefono.publicKey); // telefono venduto o perso
  const sfida = newChallenge();
  const esito = await authenticatePeer(fidati, {
    publicKey: vecchioTelefono.publicKey, challenge: sfida,
    signature: await signChallenge(vecchioTelefono.privateKey, sfida),
  });
  assert.equal(esito.ok, false, 'un telefono venduto non deve più vedere i tuoi dati');
});
