import test from 'node:test';
import assert from 'node:assert/strict';
import { TARIFFA_KM_GERMANIA_2026, TARIFFA_KM_USA_2026, TARIFFA_KM_UK_2026, TARIFFA_KM_PER_PAESE } from './trip-mileage-rates.js';

test('TARIFFA_KM_GERMANIA_2026: 0,30€/km, unità km (Bundesreisekostengesetz §5)', () => {
  assert.equal(TARIFFA_KM_GERMANIA_2026.tariffa, 0.30);
  assert.equal(TARIFFA_KM_GERMANIA_2026.unita, 'km');
});

test('TARIFFA_KM_USA_2026: 72,5¢/miglio, unità miglia (IRS 2026, fonte primaria irs.gov)', () => {
  assert.equal(TARIFFA_KM_USA_2026.tariffa, 0.725);
  assert.equal(TARIFFA_KM_USA_2026.unita, 'mi');
});

test('TARIFFA_KM_UK_2026: 55p/miglio, unità miglia (HMRC AMAP 2026/27, fonte primaria gov.uk)', () => {
  assert.equal(TARIFFA_KM_UK_2026.tariffa, 0.55);
  assert.equal(TARIFFA_KM_UK_2026.unita, 'mi');
});

test('TARIFFA_KM_PER_PAESE: copre esattamente DE/US/UK, mai IT (tabelle ACI non sono una tariffa fissa)', () => {
  assert.deepEqual(Object.keys(TARIFFA_KM_PER_PAESE).sort(), ['DE', 'UK', 'US']);
});

test('tariffe immutabili, nessun punto del codice può corromperle silenziosamente', () => {
  assert.throws(() => { TARIFFA_KM_GERMANIA_2026.tariffa = 999; }, /Cannot assign|read only/i);
});
