'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initChannelLearning, recordOutcome, probabilitaAppresa, preferenzaRipiego,
  mergeChannelLearning, tipoRete,
} from './channel-learning.js';
import { probabilitaDiretta } from './nat-matrix.js';

const CTX = { reteTipo: '4g', miaNat: { kind: 'prevedibile' }, altruiNat: { kind: 'aperto' } };

test('SENZA dati si usa la fisica pura, non un\'invenzione', () => {
  const m = initChannelLearning();
  const r = probabilitaAppresa(m, CTX);
  assert.equal(r.fonte, 'fisica');
  assert.equal(r.evidenza, 0);
  assert.equal(r.p, probabilitaDiretta(CTX.miaNat, CTX.altruiNat));
});

test('POCA evidenza (1-2 osservazioni) non ribalta la fisica', () => {
  const m = initChannelLearning();
  recordOutcome(m, { ...CTX, canale: 'ponte' }); // un solo caso, e per giunta contrario
  const r = probabilitaAppresa(m, CTX);
  const fisica = probabilitaDiretta(CTX.miaNat, CTX.altruiNat);
  assert.ok(Math.abs(r.p - fisica) < 0.15, `uno scostamento cosi\' piccolo di dati non deve spostare molto: ${r.p} vs ${fisica}`);
});

test('IL PUNTO: con MOLTA evidenza reale e coerente, il dato osservato PREVALE sulla fisica', () => {
  const m = initChannelLearning();
  // Un operatore locale, per qualche motivo di infrastruttura, fa fallire
  // sistematicamente il diretto anche dove la fisica lo darebbe per probabile.
  for (let i = 0; i < 30; i++) recordOutcome(m, { ...CTX, canale: 'ponte' });
  const r = probabilitaAppresa(m, CTX);
  const fisica = probabilitaDiretta(CTX.miaNat, CTX.altruiNat);
  assert.ok(fisica > 0.7, 'premessa: la fisica darebbe il diretto per probabile');
  assert.ok(r.p < 0.3, `con 30 fallimenti osservati il diretto NON va piu\' proposto per primo: stima ${r.p}`);
  assert.equal(r.fonte, 'osservata');
});

test('un contesto MAI visto eredita dal suo genitore piu\' generale, non riparte da zero', () => {
  const m = initChannelLearning();
  // Si osserva molto su "4g, prevedibile" in generale (senza specificare l'altrui classe).
  for (let i = 0; i < 20; i++) recordOutcome(m, { reteTipo: '4g', miaNat: { kind: 'prevedibile' }, canale: 'ponte' });
  // Si interroga un ramo piu' specifico MAI osservato prima.
  const r = probabilitaAppresa(m, { reteTipo: '4g', miaNat: { kind: 'prevedibile' }, altruiNat: { kind: 'bloccato' } });
  assert.ok(r.evidenza > 0, 'deve ereditare evidenza dal genitore, non partire da zero');
  assert.ok(r.p < 0.5, 'eredita la tendenza sfavorevole osservata sul ramo piu\' generale');
});

test('contesti DIVERSI non si contaminano a vicenda', () => {
  const m = initChannelLearning();
  for (let i = 0; i < 30; i++) recordOutcome(m, { reteTipo: 'wifi', miaNat: { kind: 'prevedibile' }, altruiNat: { kind: 'aperto' }, canale: 'diretto' });
  for (let i = 0; i < 30; i++) recordOutcome(m, { reteTipo: '4g', miaNat: { kind: 'prevedibile' }, altruiNat: { kind: 'aperto' }, canale: 'ponte' });
  const wifi = probabilitaAppresa(m, { reteTipo: 'wifi', miaNat: { kind: 'prevedibile' }, altruiNat: { kind: 'aperto' } });
  const mobile = probabilitaAppresa(m, { reteTipo: '4g', miaNat: { kind: 'prevedibile' }, altruiNat: { kind: 'aperto' } });
  assert.ok(wifi.p > 0.7, `wifi dovrebbe restare alto: ${wifi.p}`);
  assert.ok(mobile.p < 0.3, `4g dovrebbe essere sceso: ${mobile.p}`);
});

test('PREFERENZA DI RIPIEGO: senza dati non si inventa un ordine', () => {
  const m = initChannelLearning();
  const r = preferenzaRipiego(m, CTX);
  assert.equal(r.canale, null);
});

test('PREFERENZA DI RIPIEGO: con abbastanza dati emerge quale ripiego funziona qui', () => {
  const m = initChannelLearning();
  for (let i = 0; i < 10; i++) recordOutcome(m, { ...CTX, canale: 'differito' });
  for (let i = 0; i < 2; i++) recordOutcome(m, { ...CTX, canale: 'ponte' });
  const r = preferenzaRipiego(m, CTX);
  assert.equal(r.canale, 'differito');
});

test('FEDERAZIONE: quello che impara un dispositivo aiuta un altro appena connesso', () => {
  const a = initChannelLearning();
  for (let i = 0; i < 30; i++) recordOutcome(a, { ...CTX, canale: 'ponte' });
  const bVergine = initChannelLearning();
  const primaBianco = probabilitaAppresa(bVergine, CTX);
  assert.equal(primaBianco.evidenza, 0);
  const bFuso = mergeChannelLearning(bVergine, a);
  const dopoFusione = probabilitaAppresa(bFuso, CTX);
  assert.ok(dopoFusione.evidenza > 0, 'un dispositivo nuovo deve beneficiare di quanto imparato dagli altri');
  assert.ok(dopoFusione.p < primaBianco.p, 'la fusione deve spostare la stima verso quanto osservato altrove');
});

test('FEDERAZIONE anti-avvelenamento: un solo peer non puo\' ribaltare da solo un modello gia\' solido', () => {
  const a = initChannelLearning();
  for (let i = 0; i < 100; i++) recordOutcome(a, { ...CTX, canale: 'diretto' }); // consolidato: il diretto funziona qui
  const cattivo = initChannelLearning();
  for (let i = 0; i < 1000; i++) recordOutcome(cattivo, { ...CTX, canale: 'ponte' }); // un peer malevolo/rumoroso
  const fuso = mergeChannelLearning(a, cattivo, { maxPeerWeight: 5 });
  const r = probabilitaAppresa(fuso, CTX);
  assert.ok(r.p > 0.7, `un peer solo non deve poter ribaltare 100 osservazioni proprie: stima crollata a ${r.p}`);
});

test('tipoRete non inventa un valore quando non lo sa', () => {
  assert.equal(tipoRete({}), 'sconosciuta');
  assert.equal(tipoRete({ connection: { effectiveType: '3g' } }), '3g');
  assert.equal(tipoRete(null), 'sconosciuta');
});

test('registrare senza canale non sporca il modello', () => {
  const m = initChannelLearning();
  const prima = JSON.stringify(m);
  recordOutcome(m, { ...CTX, canale: null });
  assert.equal(JSON.stringify(m), prima);
});
