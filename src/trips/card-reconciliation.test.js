import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileCardStatement } from './card-reconciliation.js';

const carta = (date, amount, description = 'Hotel') => ({ date, amount, type: 'uscita', description });
const spesa = (date, amount, extra = {}) => ({ date, amount, type: 'uscita', paymentMethod: 'carta', description: 'Spesa', ...extra });

test('reconcileCardStatement: abbinamento esatto stessa data stesso importo', () => {
  const r = reconcileCardStatement([carta('2026-09-10', 50)], [spesa('2026-09-10', 50)]);
  assert.equal(r.matched.length, 1);
  assert.equal(r.matched[0].diffGiorni, 0);
  assert.equal(r.unmatchedCharges.length, 0);
  assert.equal(r.expensesWithoutCharge.length, 0);
});

test('reconcileCardStatement: tollera il ritardo di settlement (1-3 giorni), non oltre', () => {
  const entroTolleranza = reconcileCardStatement([carta('2026-09-13', 50)], [spesa('2026-09-10', 50)]);
  assert.equal(entroTolleranza.matched.length, 1);
  const oltreTolleranza = reconcileCardStatement([carta('2026-09-15', 50)], [spesa('2026-09-10', 50)]);
  assert.equal(oltreTolleranza.matched.length, 0);
  assert.equal(oltreTolleranza.unmatchedCharges.length, 1);
});

test('reconcileCardStatement: un importo diverso (anche di poco oltre la tolleranza) non abbina mai', () => {
  const r = reconcileCardStatement([carta('2026-09-10', 50.05)], [spesa('2026-09-10', 50)]);
  assert.equal(r.matched.length, 0);
  assert.equal(r.unmatchedCharges.length, 1);
});

test('reconcileCardStatement: un addebito doppio (duplicato reale) — solo UNO si abbina, il secondo resta segnalato', () => {
  const r = reconcileCardStatement([carta('2026-09-10', 50), carta('2026-09-10', 50)], [spesa('2026-09-10', 50)]);
  assert.equal(r.matched.length, 1);
  assert.equal(r.unmatchedCharges.length, 1);
});

test('reconcileCardStatement: una spesa pagata con carta senza addebito corrispondente resta dichiarata, mai nascosta', () => {
  const r = reconcileCardStatement([], [spesa('2026-09-10', 50)]);
  assert.equal(r.expensesWithoutCharge.length, 1);
  assert.equal(r.matched.length, 0);
});

test('reconcileCardStatement: una spesa in contanti non è mai un candidato — non può comparire sull\'estratto conto carta', () => {
  const r = reconcileCardStatement([carta('2026-09-10', 50)], [spesa('2026-09-10', 50, { paymentMethod: 'contanti' })]);
  assert.equal(r.matched.length, 0);
  assert.equal(r.unmatchedCharges.length, 1);
  assert.equal(r.expensesWithoutCharge.length, 0); // la spesa in contanti non entra nemmeno nel conteggio "senza addebito"
});

test('reconcileCardStatement: il più vicino vince quando più spese sono candidate, e lo dichiara (altriCandidati)', () => {
  const r = reconcileCardStatement([carta('2026-09-10', 50)], [spesa('2026-09-08', 50), spesa('2026-09-10', 50)]);
  assert.equal(r.matched.length, 1);
  assert.equal(r.matched[0].diffGiorni, 0); // ha scelto quella del 10, non quella dell'8
  assert.equal(r.matched[0].altriCandidati, 1); // ma dichiara che c'era un'alternativa
});

test('reconcileCardStatement: entrate e altri tipi non sono mai considerati (solo uscite)', () => {
  const r = reconcileCardStatement([{ date: '2026-09-10', amount: 50, type: 'entrata', description: 'Rimborso' }], [spesa('2026-09-10', 50)]);
  assert.equal(r.matched.length, 0);
  assert.equal(r.unmatchedCharges.length, 0);
  assert.equal(r.expensesWithoutCharge.length, 1);
});

test('reconcileCardStatement: dati vuoti non generano eccezioni', () => {
  const r = reconcileCardStatement([], []);
  assert.deepEqual(r, { matched: [], unmatchedCharges: [], expensesWithoutCharge: [] });
  assert.deepEqual(reconcileCardStatement(null, null), { matched: [], unmatchedCharges: [], expensesWithoutCharge: [] });
});

test('reconcileCardStatement: tolleranze personalizzabili, mai fisse per chi ha bisogno di margini diversi', () => {
  const r = reconcileCardStatement([carta('2026-09-20', 50)], [spesa('2026-09-10', 50)], { toleranzaGiorni: 15 });
  assert.equal(r.matched.length, 1);
});
