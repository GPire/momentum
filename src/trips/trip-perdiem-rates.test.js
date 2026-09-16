import test from 'node:test';
import assert from 'node:assert/strict';
import { TARIFFE_GERMANIA_2026 } from './trip-perdiem-rates.js';

test('TARIFFE_GERMANIA_2026: valori 2026 verificati (BMF + fonti triangolate 2026-09-14)', () => {
  assert.equal(TARIFFE_GERMANIA_2026.piena, 28);
  assert.equal(TARIFFE_GERMANIA_2026.ridotta, 14);
});

test('TARIFFE_GERMANIA_2026: quota piena sempre doppia della ridotta (invariante strutturale della norma tedesca, non una coincidenza numerica)', () => {
  assert.equal(TARIFFE_GERMANIA_2026.piena, TARIFFE_GERMANIA_2026.ridotta * 2);
});

test('TARIFFE_GERMANIA_2026: oggetto immutabile, nessun punto del codice può corromperlo silenziosamente', () => {
  assert.throws(() => { TARIFFE_GERMANIA_2026.piena = 999; }, /Cannot assign|read only/i);
});
