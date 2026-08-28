'use strict';
import test from 'node:test';
import assert from 'node:assert/strict';
import { initSourceRegistry, observeImport, affidabilitaCanale, riepilogoAffidabilita, CANALI } from './source-registry.js';

test('un canale mai usato è "da-confermare" con zero osservazioni, mai un finto verdetto', () => {
  const r = initSourceRegistry();
  const a = affidabilitaCanale(r, 'notifica');
  assert.equal(a.etichetta, 'da-confermare');
  assert.equal(a.osservazioni, 0);
});

test('poche osservazioni corrette (sotto la soglia minima) restano "da-confermare", anche se tutte giuste — un numero finto travestito da fiducia', () => {
  let r = initSourceRegistry();
  r = observeImport(r, 'screenshot', true);
  r = observeImport(r, 'screenshot', true);
  const a = affidabilitaCanale(r, 'screenshot');
  assert.equal(a.etichetta, 'da-confermare');
  assert.ok(a.osservazioni < 5);
});

test('molte osservazioni corrette (sopra soglia) → "bene"', () => {
  let r = initSourceRegistry();
  for (let i = 0; i < 20; i++) r = observeImport(r, 'csv', true);
  const a = affidabilitaCanale(r, 'csv');
  assert.equal(a.etichetta, 'bene');
  assert.ok(a.media > 0.85);
});

test('molte osservazioni sbagliate (sopra soglia) → "male"', () => {
  let r = initSourceRegistry();
  for (let i = 0; i < 20; i++) r = observeImport(r, 'pdf', false);
  const a = affidabilitaCanale(r, 'pdf');
  assert.equal(a.etichetta, 'male');
  assert.ok(a.media < 0.5);
});

test('un canale storicamente buono che inizia a sbagliare (la banca cambia formato) peggiora — il decadimento pesa il recente più del lontano', () => {
  let r = initSourceRegistry();
  for (let i = 0; i < 30; i++) r = observeImport(r, 'notifica', true);
  const primaBuono = affidabilitaCanale(r, 'notifica').media;
  for (let i = 0; i < 30; i++) r = observeImport(r, 'notifica', false);
  const dopoRotto = affidabilitaCanale(r, 'notifica').media;
  assert.ok(dopoRotto < primaBuono, 'la media deve scendere dopo una lunga serie di errori recenti');
  assert.ok(dopoRotto < 0.5, 'con 30 errori recenti consecutivi deve finire sotto la soglia neutra');
});

test('canale non riconosciuto → registry invariato, mai un canale finto creato', () => {
  const r0 = initSourceRegistry();
  const r1 = observeImport(r0, 'canale-mai-esistito', true);
  assert.deepEqual(r1.canali, {});
});

test('riepilogoAffidabilita: mostra solo i canali davvero usati almeno una volta', () => {
  let r = initSourceRegistry();
  r = observeImport(r, 'manuale', true);
  const rows = riepilogoAffidabilita(r);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].canale, 'manuale');
});

test('riepilogoAffidabilita: registry vuoto → lista vuota, mai righe inventate per canali mai toccati', () => {
  assert.deepEqual(riepilogoAffidabilita(initSourceRegistry()), []);
});

test('CANALI copre tutte le vie di import reali del progetto', () => {
  assert.deepEqual(CANALI, ['notifica', 'screenshot', 'csv', 'pdf', 'testo-condiviso', 'manuale']);
});

test('due canali diversi non si influenzano a vicenda', () => {
  let r = initSourceRegistry();
  for (let i = 0; i < 10; i++) r = observeImport(r, 'csv', true);
  for (let i = 0; i < 10; i++) r = observeImport(r, 'screenshot', false);
  assert.equal(affidabilitaCanale(r, 'csv').etichetta, 'bene');
  assert.equal(affidabilitaCanale(r, 'screenshot').etichetta, 'male');
});
