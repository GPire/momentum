import test from 'node:test';
import assert from 'node:assert/strict';
import { annualSecFacts, secFactsAt } from './sec-filing-facts.js';

const row = (extra = {}) => ({ start: '2022-01-01', end: '2022-12-31', filed: '2023-02-15',
  form: '10-K', accn: '0000000001-23-000001', val: 100, ...extra });
const data = rows => ({ facts: { 'us-gaap': { Revenues: { units: { USD: rows } } } } });

test('revisioni mantenute, nessuna informazione futura nello snapshot', () => {
  const records = annualSecFacts(data([row(), row({ filed: '2024-02-15', val: 90, form: '10-K/A', accn: '0000000001-24-000001' })]), ['Revenues'], { flow: true });
  assert.equal(records.length, 2);
  assert.deepEqual(secFactsAt(records, '2023-02-14'), []);
  assert.equal(secFactsAt(records, '2023-02-15')[0].value, 100);
  assert.equal(secFactsAt(records, '2024-02-15')[0].value, 90);
  assert.equal(records[0].unit, 'USD');
  assert.equal(records[0].concept, 'Revenues');
});

test('trimestri, date impossibili, documenti senza provenienza esclusi', () => {
  const records = annualSecFacts(data([row(), row({ start: '2022-10-01' }), row({ filed: '2023-02-30' }),
    row({ accn: undefined }), row({ val: Infinity }), row({ filed: '2021-01-01' })]), ['Revenues'], { flow: true });
  assert.equal(records.length, 1);
});

test('stock e flussi non si mescolano; unità selezionata esplicitamente', () => {
  assert.equal(annualSecFacts(data([row()]), ['Revenues'], { flow: false }).length, 0);
  assert.equal(annualSecFacts(data([row({ start: undefined })]), ['Revenues'], { flow: false }).length, 1);
  assert.equal(annualSecFacts(data([row()]), ['Revenues'], { flow: true, unit: 'EUR' }).length, 0);
});

test('conflitti nella stessa data restano mancanti e non resuscitano dati vecchi', () => {
  const r = annualSecFacts(data([row(), row({ filed: '2024-02-15', val: 90 }), row({ filed: '2024-02-15', val: 95 })]), ['Revenues'], { flow: true });
  assert.equal(secFactsAt(r, '2024-02-15')[0].value, null);
  assert.equal(secFactsAt(r, '2024-02-15')[0].conflict, true);
  assert.deepEqual(secFactsAt(r, 'bad-date'), []);
});

test('periodi fiscali distinti restano distinti anche se finiscono nello stesso anno', () => {
  const r = annualSecFacts(data([row(), row({ start: '2021-10-01', end: '2022-09-30' })]), ['Revenues'], { flow: true });
  assert.equal(secFactsAt(r, '2023-12-31').length, 2);
  assert.deepEqual(secFactsAt([...r].reverse(), '2023-12-31'), secFactsAt(r, '2023-12-31'));
});

test('priorità esplicita dei concetti, senza scambiare misure diverse per revisioni', () => {
  const input = data([row()]);
  input.facts['us-gaap'].SalesRevenueNet = { units: { USD: [row({val: 0, filed: '2024-02-15'})] } };
  const r = annualSecFacts(input, ['Revenues','SalesRevenueNet'], {flow:true});
  assert.equal(secFactsAt(r, '2024-03-01', {conceptPriority:['Revenues','SalesRevenueNet']})[0].value, 100);
});

test('fotografie trimestrali nel 10-K escluse dai valori annuali', async () => {
  const { annualSecValues } = await import('./sec-filing-facts.js');
  const r = annualSecFacts(data([row({start:undefined}), row({start:undefined,end:'2022-03-31',val:50})]), ['Revenues'], {flow:false});
  const y = annualSecValues(r, '2023-12-31', {periodEnds:new Set(['2022-12-31'])});
  assert.equal(y.length,1);
  assert.equal(y[0].valore,100);
  assert.equal(y[0].provenienza.end,'2022-12-31');
});
