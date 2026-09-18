import test from 'node:test';
import assert from 'node:assert/strict';
import { TARIFFE_GERMANIA_2026, TARIFFE_USA_2026, RIDUZIONE_USA_2026, TARIFFE_REGNO_UNITO_2026 } from './trip-perdiem-rates.js';

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

test('TARIFFE_USA_2026: tasso CONUS standard FY2026 verificato su fonte primaria (gsa.gov, 2025-08-15)', () => {
  assert.equal(TARIFFE_USA_2026.piena, 68);
  assert.equal(TARIFFE_USA_2026.ridotta, 51);
});

test('TARIFFE_USA_2026: la quota ridotta è esattamente il 75% della piena (regola GSA primo/ultimo giorno)', () => {
  assert.equal(TARIFFE_USA_2026.ridotta, TARIFFE_USA_2026.piena * 0.75);
});

test('TARIFFE_USA_2026: oggetto immutabile', () => {
  assert.throws(() => { TARIFFE_USA_2026.piena = 999; }, /Cannot assign|read only/i);
});

test('RIDUZIONE_USA_2026: le tre frazioni sommano a 63/68, mai a 1 — gli incidentals ($5) non sono un pasto e non si riducono mai', () => {
  const somma = RIDUZIONE_USA_2026.colazione + RIDUZIONE_USA_2026.pranzo + RIDUZIONE_USA_2026.cena;
  assert.ok(Math.abs(somma - 63 / 68) < 1e-9, `somma attesa 63/68, trovata ${somma}`);
});

test('RIDUZIONE_USA_2026: derivata dalle cifre GSA reali (breakfast $16/lunch $19/dinner $28 su $68 totali)', () => {
  assert.ok(Math.abs(RIDUZIONE_USA_2026.colazione - 16 / 68) < 1e-9);
  assert.ok(Math.abs(RIDUZIONE_USA_2026.pranzo - 19 / 68) < 1e-9);
  assert.ok(Math.abs(RIDUZIONE_USA_2026.cena - 28 / 68) < 1e-9);
});

test('TARIFFE_REGNO_UNITO_2026: benchmark scale rates verificate su fonte primaria (gov.uk EIM30240, 2026-09-18)', () => {
  assert.equal(TARIFFE_REGNO_UNITO_2026.cinqueOre, 5);
  assert.equal(TARIFFE_REGNO_UNITO_2026.dieciOre, 10);
  assert.equal(TARIFFE_REGNO_UNITO_2026.quindiciOre, 25);
});

test('TARIFFE_REGNO_UNITO_2026: oggetto immutabile', () => {
  assert.throws(() => { TARIFFE_REGNO_UNITO_2026.cinqueOre = 999; }, /Cannot assign|read only/i);
});
