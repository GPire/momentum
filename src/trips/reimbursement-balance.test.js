import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reimbursementBalance } from './reimbursement-balance.js';
import { tripReimbursementHtml } from '../ui/trip-reimbursement.js';
const trip = { id: 't', receiptPolicy: { currency: 'EUR' } };
const row = (id, type, amount, extra = {}) => ({ id, type, amount, currency: 'EUR', businessTripId: 't', ...extra });
test('partial payments accumulate once without creating new financial records', () => {
  const rows = [row('e', 'uscita', 100), row('a', 'entrata', 20), row('b', 'entrata', 30), row('a', 'entrata', 20)];
  const before = JSON.stringify(rows), result = reimbursementBalance(trip, rows);
  assert.equal(result.received, 50); assert.equal(result.remaining, 50); assert.equal(result.status, 'partial');
  assert.equal(JSON.stringify(rows), before);
});
test('unrelated income and personal expenses do not change balance', () => {
  const result = reimbursementBalance(trip, [row('e', 'uscita', 100), row('salary', 'entrata', 2000, { businessTripId: null }), row('p', 'uscita', 50, { tripPersonal: true })]);
  assert.equal(result.requested, 100); assert.equal(result.received, 0);
});
test('documented international payment preserves original evidence', () => {
  const result = reimbursementBalance(trip, [row('e', 'uscita', 100), row('p', 'entrata', 85, { originalAmount: 100, originalCurrency: 'USD', exchangeRate: 0.85 })]);
  assert.equal(result.remaining, 15); assert.equal(result.accepted[1].originalAmount, 100);
});
test('unknown currency or incoherent exchange prevents an apparent settlement', () => {
  for (const extra of [{ currency: undefined }, { currency: 'USD' }, { originalCurrency: 'USD', originalAmount: 100, exchangeRate: 0.5 }]) {
    const result = reimbursementBalance(trip, [row('e', 'uscita', 100), row('p', 'entrata', 100, extra)]);
    assert.equal(result.status, 'review'); assert.equal(result.remaining, null);
  }
});
test('conflicting duplicates cannot silently select the first payment', () => {
  const rows = [row('e', 'uscita', 100), row('p', 'entrata', 20), row('p', 'entrata', 100)];
  assert.deepEqual(reimbursementBalance(trip, rows).issues, [{ id: 'p', reason: 'conflicting_duplicate' }]);
  assert.equal(reimbursementBalance(trip, rows.reverse()).received, 0);
});
test('overpayment is visible instead of being clamped away', () => {
  const result = reimbursementBalance(trip, [row('e', 'uscita', 10), row('p', 'entrata', 12)]);
  assert.equal(result.excess, 2); assert.equal(result.remaining, 0); assert.equal(result.status, 'excess');
});
test('currency precision and invalid values', () => {
  assert.equal(reimbursementBalance(trip, [row('a', 'uscita', .1), row('b', 'uscita', .2), row('p', 'entrata', .3)]).status, 'balanced');
  for (const amount of [NaN, Infinity, -10, '10']) assert.equal(reimbursementBalance(trip, [row('a', 'entrata', amount)]).status, 'review');
  const jpy = { id: 't', receiptPolicy: { currency: 'JPY' } };
  assert.equal(reimbursementBalance(jpy, [row('a', 'uscita', 100, { currency: 'JPY' })]).remaining, 100);
});
test('personal flag conflicts and pending expense revisions require review', () => {
  assert.equal(reimbursementBalance(trip, [row('a', 'uscita', 10), row('a', 'uscita', 10, { tripPersonal: true })]).remaining, null);
  assert.equal(reimbursementBalance(trip, [row('a', 'uscita', 10, { tripRevisionConflict: true })]).remaining, null);
});
test('UI supports seven languages and escapes imported references', () => {
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    const html = tripReimbursementHtml(trip, [row('<img src=x>', 'entrata', 10, { currency: 'USD' })], lang);
    assert.ok(html.includes('&lt;img src=x&gt;')); assert.ok(!html.includes('undefined'));
    assert.ok(html.includes('role="status"'));
  }
});
