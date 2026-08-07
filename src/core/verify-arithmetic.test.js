'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyArithmetic, verifySum, verifyMoney } from './verify-arithmetic.js';

test('verifyArithmetic: numeri coincidenti -> coerente', () => {
  const v = verifyArithmetic(100, 100);
  assert.equal(v.ok, true);
  assert.equal(v.reason, 'coerente');
});

test('verifyArithmetic: differenza reale -> incoerenza dichiarata, mai silenziosa', () => {
  const v = verifyArithmetic(100, 130);
  assert.equal(v.ok, false);
  assert.match(v.reason, /incoerenza/);
  assert.equal(v.diff, 30);
});

test('verifyArithmetic: la tolleranza è RELATIVA alla scala', () => {
  // Un centesimo su diecimila euro è arrotondamento...
  assert.equal(verifyArithmetic(10000.01, 10000).ok, true);
  // ...ma trenta centesimi su due euro no.
  assert.equal(verifyArithmetic(2.30, 2.00).ok, false);
});

test('verifyArithmetic: valore mancante -> non affidabile, mai un "ok" di comodo', () => {
  assert.equal(verifyArithmetic(null, 10).ok, false);
  assert.equal(verifyArithmetic(10, null).ok, false);
  assert.equal(verifyArithmetic(undefined, undefined).ok, false);
});

test('verifySum: il totale coincide con la somma degli addendi', () => {
  const v = verifySum(180, [100, 50, 30]);
  assert.equal(v.ok, true);
});

test('verifySum: un addendo dimenticato viene intercettato', () => {
  const v = verifySum(150, [100, 50, 30]); // 30 non contato nel totale
  assert.equal(v.ok, false);
  assert.equal(v.recomputed, 180);
});

test('verifySum: nessun addendo -> totale diverso da zero è incoerente', () => {
  assert.equal(verifySum(50, []).ok, false);
  assert.equal(verifySum(0, []).ok, true);
});

test('verifySum: tollera gli arrotondamenti al centesimo, non gli errori veri', () => {
  assert.equal(verifySum(100.00, [33.33, 33.33, 33.34]).ok, true);
  assert.equal(verifySum(100.00, [33.33, 33.33, 30.00]).ok, false);
});

// ── LA TOLLERANZA DEL DENARO (difetto reale trovato da un test) ──
test('verifyMoney: la tolleranza è ASSOLUTA — 7 € su 1.220 NON passano', () => {
  const { ok } = verifyMoney(1227, 1220);
  assert.equal(ok, false, 'con la tolleranza relativa all\'1% questo passava: su una fattura da 10.000 € avrebbe lasciato passare 100 €');
});

test('verifyMoney: l\'arrotondamento al centesimo passa, l\'errore no', () => {
  assert.equal(verifyMoney(1220.01, 1220).ok, true);
  assert.equal(verifyMoney(1220.02, 1220).ok, true);
  assert.equal(verifyMoney(1220.50, 1220).ok, false);
});

test('verifyMoney: la scala non ammorbidisce il controllo (10 € restano un errore su 1 milione)', () => {
  assert.equal(verifyMoney(1000010, 1000000).ok, false);
});

test('verifyMoney: il messaggio dice QUANTO manca, non solo che qualcosa non va', () => {
  const v = verifyMoney(1227, 1220);
  assert.match(v.reason, /7\.00 €/);
});
