import test from 'node:test';
import assert from 'node:assert/strict';
import { comparePeriods, lastNMonthKeys } from './period-compare.js';

const allTx = {
  '2026-06': [
    { date: '2026-06-05', amount: 100, type: 'uscita', category: 'Ristorante' },
    { date: '2026-06-10', amount: 50, type: 'uscita', category: 'Trasporti' },
  ],
  '2026-07': [
    { date: '2026-07-05', amount: 150, type: 'uscita', category: 'Ristorante' },
    { date: '2026-07-10', amount: 30, type: 'uscita', category: 'Trasporti' },
    { date: '2026-07-15', amount: 20, type: 'uscita', category: 'Alimentari' },
  ],
};

test('comparePeriods: totali e delta percentuale corretti tra due mesi', () => {
  const r = comparePeriods(allTx, ['2026-07'], ['2026-06']);
  assert.equal(r.current, 200); // 150+30+20
  assert.equal(r.previous, 150); // 100+50
  assert.ok(r.totalDeltaPct > 0); // speso di più a luglio
});

test('comparePeriods: categoria nuova (assente nel periodo precedente) → +100%, mai una divisione per zero', () => {
  const r = comparePeriods(allTx, ['2026-07'], ['2026-06']);
  const alimentari = r.rows.find(row => row.category === 'Alimentari');
  assert.equal(alimentari.previous, 0);
  assert.equal(alimentari.deltaPct, 100);
});

test('comparePeriods: categoria sparita nel periodo corrente → -100%, mai un dato inventato', () => {
  const r = comparePeriods({ '2026-06': allTx['2026-06'] }, [], ['2026-06']);
  const ristorante = r.rows.find(row => row.category === 'Ristorante');
  assert.equal(ristorante.current, 0);
  assert.equal(ristorante.deltaPct, -100);
});

test('comparePeriods: nessun dato in nessuno dei due periodi → array vuoto, mai un crash', () => {
  const r = comparePeriods({}, ['2099-01'], ['2098-01']);
  assert.equal(r.rows.length, 0);
  assert.equal(r.current, 0);
  assert.equal(r.previous, 0);
});

test('comparePeriods: confronto anno-su-anno con più mesi sommati per periodo', () => {
  const r = comparePeriods(allTx, ['2026-07'], ['2026-06', '2026-07']);
  // previous = giugno+luglio insieme (350), current = solo luglio (200)
  assert.equal(r.previous, 350);
  assert.equal(r.current, 200);
});

test('lastNMonthKeys: esclude il mese in corso di default (offsetMonths=0 → parte da referenceDate)', () => {
  const ref = new Date(2026, 6, 15); // luglio 2026
  const keys = lastNMonthKeys(ref, 3, 1); // ultimi 3 mesi COMPLETI prima di luglio
  assert.deepEqual(keys, ['2026-06', '2026-05', '2026-04']);
});

test('lastNMonthKeys: gestisce correttamente il cambio anno', () => {
  const ref = new Date(2026, 1, 1); // febbraio 2026
  const keys = lastNMonthKeys(ref, 2, 1);
  assert.deepEqual(keys, ['2026-01', '2025-12']);
});
