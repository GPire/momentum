import test from 'node:test';
import assert from 'node:assert/strict';
import { monthGrid, isoDi, parseIso, giornoAmmesso, mesePrecedente, meseSuccessivo, meseHaGiorniAmmessi } from './date-picker.js';

test('la griglia allinea i giorni al loro giorno della settimana, lunedì per primo', () => {
  // Settembre 2026 inizia di martedì → una cella vuota davanti.
  const celle = monthGrid(2026, 8);
  assert.equal(celle[0], null);
  assert.equal(celle[1], 1);
  assert.equal(celle.length % 7, 0);
  assert.equal(celle.filter(c => c !== null).length, 30);
});

test('un mese che inizia di lunedì non ha celle vuote davanti', () => {
  // Giugno 2026 inizia di lunedì.
  const celle = monthGrid(2026, 5);
  assert.equal(celle[0], 1);
});

test('febbraio bisestile ha 29 giorni, quello normale 28', () => {
  assert.equal(monthGrid(2028, 1).filter(Boolean).length, 29);
  assert.equal(monthGrid(2026, 1).filter(Boolean).length, 28);
});

test('la data ISO si compone a mano: niente slittamento di un giorno per il fuso', () => {
  assert.equal(isoDi(2026, 8, 2), '2026-09-02');
  assert.equal(isoDi(2026, 0, 1), '2026-01-01');
  assert.deepEqual(parseIso('2026-09-02'), { anno: 2026, mese0: 8, giorno: 2 });
  assert.equal(parseIso('non è una data'), null);
  assert.equal(parseIso(''), null);
  assert.equal(parseIso(null), null);
});

test('i limiti min/max valgono come li legge una persona: estremi inclusi', () => {
  const limiti = { min: '2026-09-01', max: '2026-09-30' };
  assert.equal(giornoAmmesso('2026-09-01', limiti), true);
  assert.equal(giornoAmmesso('2026-09-30', limiti), true);
  assert.equal(giornoAmmesso('2026-08-31', limiti), false);
  assert.equal(giornoAmmesso('2026-10-01', limiti), false);
  assert.equal(giornoAmmesso('2026-09-15', {}), true); // senza limiti, tutto ammesso
});

// L'aritmetica ingenua sulle date (setMonth(-1) su un 31) salta un mese
// intero: il 31 gennaio meno un mese diventa il 3 marzo.
test('cambiare mese non salta mai un mese, nemmeno partendo dal 31', () => {
  assert.deepEqual(mesePrecedente(2026, 0), { anno: 2025, mese0: 11 });
  assert.deepEqual(meseSuccessivo(2026, 11), { anno: 2027, mese0: 0 });
  assert.deepEqual(mesePrecedente(2026, 2), { anno: 2026, mese0: 1 }); // marzo → febbraio
  assert.deepEqual(meseSuccessivo(2026, 0), { anno: 2026, mese0: 1 });
});

test('un mese interamente fuori dai limiti si riconosce: la freccia si spegne', () => {
  const limiti = { min: '2026-09-01', max: '2026-09-30' };
  assert.equal(meseHaGiorniAmmessi(2026, 8, limiti), true);   // settembre
  assert.equal(meseHaGiorniAmmessi(2026, 7, limiti), false);  // agosto: tutto prima del minimo
  assert.equal(meseHaGiorniAmmessi(2026, 9, limiti), false);  // ottobre: tutto dopo il massimo
  // Un mese a cavallo del limite resta raggiungibile.
  assert.equal(meseHaGiorniAmmessi(2026, 8, { min: '2026-09-20' }), true);
});

test('senza limiti ogni mese è raggiungibile', () => {
  assert.equal(meseHaGiorniAmmessi(2026, 0, {}), true);
  assert.equal(meseHaGiorniAmmessi(1999, 5), true);
});
