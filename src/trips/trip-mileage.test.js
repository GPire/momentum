import test from 'node:test';
import assert from 'node:assert/strict';
import { rimborsoChilometrico } from './trip-mileage.js';

test('rimborsoChilometrico: distanza per tariffa, arrotondato a 2 decimali', () => {
  assert.equal(rimborsoChilometrico(42, 0.30), 12.6);
});

test('rimborsoChilometrico: funziona identico per km o miglia — la conversione la fa la tariffa, non la formula', () => {
  assert.equal(rimborsoChilometrico(100, 0.725), 72.5); // USA, miglia
  assert.equal(rimborsoChilometrico(100, 0.55), 55); // UK, miglia
});

test('rimborsoChilometrico: distanza zero o negativa, null — mai un rimborso inventato', () => {
  assert.equal(rimborsoChilometrico(0, 0.30), null);
  assert.equal(rimborsoChilometrico(-5, 0.30), null);
});

test('rimborsoChilometrico: senza tariffa valida, null — mai zero scambiato per "nessuna tariffa impostata"', () => {
  assert.equal(rimborsoChilometrico(42, null), null);
  assert.equal(rimborsoChilometrico(42, 0), null);
  assert.equal(rimborsoChilometrico(42, undefined), null);
});

test('rimborsoChilometrico: dati sporchi non rompono nulla', () => {
  assert.equal(rimborsoChilometrico('quaranta', 0.30), null);
  assert.equal(rimborsoChilometrico(42, 'gratis'), null);
});
