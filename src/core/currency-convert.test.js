import test from 'node:test';
import assert from 'node:assert/strict';
import { raggruppaPerValuta, notaValuteEstranee, convertiConTasso } from './currency-convert.js';

test('raggruppaPerValuta: senza campo currency, tutto va nella valuta base (comportamento di sempre)', () => {
  const txs = [{ amount: 10 }, { amount: 20 }];
  const { base, altre } = raggruppaPerValuta(txs, 'EUR');
  assert.equal(base.totale, 30);
  assert.equal(base.count, 2);
  assert.deepEqual(altre, {});
});

test('raggruppaPerValuta: una transazione in valuta estera finisce SEPARATA, mai sommata al totale base', () => {
  const txs = [{ amount: 100, currency: 'EUR' }, { amount: 45, currency: 'GBP' }];
  const { base, altre } = raggruppaPerValuta(txs, 'EUR');
  assert.equal(base.totale, 100, 'il totale base non deve includere la transazione in sterline');
  assert.equal(altre.GBP.totale, 45);
  assert.equal(altre.GBP.count, 1);
});

test('raggruppaPerValuta: più valute estere si raggruppano ciascuna per il proprio codice', () => {
  const txs = [
    { amount: 100, currency: 'EUR' },
    { amount: 45, currency: 'GBP' },
    { amount: 30, currency: 'GBP' },
    { amount: 5000, currency: 'JPY' },
  ];
  const { altre } = raggruppaPerValuta(txs, 'EUR');
  assert.equal(altre.GBP.totale, 75);
  assert.equal(altre.GBP.count, 2);
  assert.equal(altre.JPY.totale, 5000);
  assert.equal(altre.JPY.count, 1);
});

test('raggruppaPerValuta: lista vuota o assente non fa mai crashare', () => {
  assert.deepEqual(raggruppaPerValuta([], 'EUR').base, { count: 0, totale: 0 });
  assert.deepEqual(raggruppaPerValuta(undefined, 'EUR').base, { count: 0, totale: 0 });
});

test('notaValuteEstranee: nessuna valuta estera -> null, nessuna nota da mostrare (il caso normale)', () => {
  assert.equal(notaValuteEstranee({}, () => ''), null);
});

test('notaValuteEstranee: testo onesto con conteggio e importo per valuta', () => {
  const fm = (v, c) => `${v.toFixed(2)} ${c}`;
  const testo = notaValuteEstranee({ GBP: { count: 2, totale: 75 } }, fm);
  assert.match(testo, /2 transazioni/);
  assert.match(testo, /75\.00 GBP/);
});

test('notaValuteEstranee: singolare corretto con una sola transazione', () => {
  const fm = (v, c) => `${v} ${c}`;
  const testo = notaValuteEstranee({ GBP: { count: 1, totale: 45 } }, fm);
  assert.match(testo, /1 transazione\b/);
  assert.doesNotMatch(testo, /1 transazioni/);
});

test('convertiConTasso: stessa valuta -> importo invariato, nessun tasso necessario', () => {
  assert.equal(convertiConTasso(45, 'EUR', 'EUR', {}), 45);
});

test('convertiConTasso: con un tasso fornito dall\'utente calcola l\'equivalente', () => {
  assert.equal(convertiConTasso(10, 'GBP', 'EUR', { GBP: 1.17 }), 11.7);
});

test('convertiConTasso: nessun tasso noto per quella valuta -> null, mai una stima inventata', () => {
  assert.equal(convertiConTasso(10, 'GBP', 'EUR', {}), null);
  assert.equal(convertiConTasso(10, 'GBP', 'EUR', null), null);
});
