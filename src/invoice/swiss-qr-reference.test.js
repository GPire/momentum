'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeQrrCheckDigit, generateQrrReference, validateQrrReference, formatQrrReference } from './swiss-qr-reference.js';

// Riferimento reale pubblicato da SIX Group (Implementation Guidelines
// QR-bill), usato come esempio ufficiale nella documentazione del settore:
// base 26 cifre "21000000000313947143000901" -> cifra di controllo "7".
const RIFERIMENTO_UFFICIALE_BASE = '21000000000313947143000901';
const RIFERIMENTO_UFFICIALE_COMPLETO = '210000000003139471430009017';

test('computeQrrCheckDigit: corrisponde ESATTAMENTE al riferimento ufficiale SIX Group', () => {
  assert.equal(computeQrrCheckDigit(RIFERIMENTO_UFFICIALE_BASE), 7);
});

test('generateQrrReference: dalla stessa base ufficiale genera il riferimento completo identico', () => {
  const r = generateQrrReference(RIFERIMENTO_UFFICIALE_BASE);
  assert.equal(r.ok, true);
  assert.equal(r.reference, RIFERIMENTO_UFFICIALE_COMPLETO);
});

test('generateQrrReference: una base corta viene riempita con zeri a sinistra fino a 26 cifre', () => {
  const r = generateQrrReference('123');
  assert.equal(r.ok, true);
  assert.equal(r.reference.length, 27);
  assert.equal(r.reference.slice(0, 26), '00000000000000000000000123');
});

test('generateQrrReference: base troppo lunga -> errore esplicito, mai un riferimento troncato', () => {
  const r = generateQrrReference('1'.repeat(27));
  assert.equal(r.ok, false);
  assert.match(r.reason, /troppo lunga/);
});

test('generateQrrReference: base vuota -> errore, nessun crash', () => {
  assert.equal(generateQrrReference('').ok, false);
  assert.equal(generateQrrReference(null).ok, false);
});

test('validateQrrReference: il riferimento ufficiale è valido', () => {
  const v = validateQrrReference(RIFERIMENTO_UFFICIALE_COMPLETO);
  assert.equal(v.ok, true);
});

test('validateQrrReference: un typo sull\'ultima cifra viene intercettato prima dell\'invio', () => {
  const alterato = RIFERIMENTO_UFFICIALE_COMPLETO.slice(0, 26) + '9'; // 7 -> 9
  const v = validateQrrReference(alterato);
  assert.equal(v.ok, false);
  assert.match(v.reason, /Cifra di controllo non valida/);
});

test('validateQrrReference: lunghezza diversa da 27 -> respinto, mai una validazione a caso', () => {
  assert.equal(validateQrrReference('123').ok, false);
  assert.equal(validateQrrReference('1'.repeat(28)).ok, false);
});

test('round-trip: 50 basi casuali generate e poi validate, sempre coerenti', () => {
  for (let i = 0; i < 50; i++) {
    const base = String(Math.floor(Math.random() * 1e12));
    const gen = generateQrrReference(base);
    assert.equal(gen.ok, true);
    assert.equal(validateQrrReference(gen.reference).ok, true, `fallito per base ${base}`);
  }
});

test('formatQrrReference: raggruppa in blocchi da 5 come sui bollettini reali', () => {
  assert.equal(formatQrrReference(RIFERIMENTO_UFFICIALE_COMPLETO), '21 00000 00003 13947 14300 09017');
});
