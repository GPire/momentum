import test from 'node:test';
import assert from 'node:assert/strict';
import { reviseTripExpense, mergeTripExpenseRevisions, revisionHeads } from './expense-revisions.js';
import { computeSyncDigest, transactionsMissingFromPeer, mergeTransactions } from '../mesh/sync.js';
const base = { id: 'uuid', businessTripId: 'trip', amount: 12, category: 'food', date: '2026-09-13', receiptImage: 'receipt', hash: 'original', prevHash: 'previous', customField: 'keep' };
test('sync sends existing-ID revisions and moves months without duplicating expenses', () => {
  const local = { '2026-09': [base] };
  const edited = reviseTripExpense(base, { date: '2026-10-01', amount: 14 }, 'move');
  const delta = transactionsMissingFromPeer({ '2026-10': [edited] }, computeSyncDigest(local));
  const result = mergeTransactions(local, delta);
  assert.equal(result.updated, 1);
  assert.equal(Object.values(result.merged).flat().length, 1);
  assert.equal(result.merged['2026-10'][0].amount, 14);
  assert.equal(mergeTransactions(result.merged, delta).updated, 0);
  const deleted = mergeTransactions(local, delta, { uuid: Date.now() });
  assert.equal(Object.values(deleted.merged).flat().length, 0);
});
test('edit preserves identity, attachment, provenance and original values', () => {
  const edited = reviseTripExpense(base, { amount: 14, date: '2026-10-01' }, 'r1');
  assert.equal(edited.id, base.id);
  assert.equal(edited.hash, base.hash);
  assert.equal(edited.receiptImage, 'receipt');
  assert.equal(edited.customField, 'keep');
  assert.equal(edited.tripRevisionBase.amount, 12);
  assert.equal(base.amount, 12);
});
// Bleisure (2026-09-19): marcare/smarcare una spesa come personale è una
// revisione vera come cambiare l'importo — deve sopravvivere al giro
// pick()/materialize(), altrimenti il toggle sparirebbe silenziosamente
// alla prima modifica successiva della spesa.
test('edit carries tripPersonal through a revision (bleisure toggle survives an edit)', () => {
  const personal = reviseTripExpense(base, { tripPersonal: true }, 'p1');
  assert.equal(personal.tripPersonal, true);
  const stillPersonal = reviseTripExpense(personal, { amount: 20 }, 'p2');
  assert.equal(stillPersonal.tripPersonal, true);
  const backToReimbursable = reviseTripExpense(stillPersonal, { tripPersonal: false }, 'p3');
  assert.equal(backToReimbursable.tripPersonal, false);
});

test('edit carries payment and transport choices through a revision, including an explicit clear', () => {
  const cashTaxi = reviseTripExpense(base, { paymentMethod: 'contanti', transportMode: 'taxi_ncc' }, 'pay1');
  assert.equal(cashTaxi.paymentMethod, 'contanti');
  assert.equal(cashTaxi.transportMode, 'taxi_ncc');
  const publicCard = reviseTripExpense(cashTaxi, { paymentMethod: 'carta', transportMode: 'pubblico' }, 'pay2');
  assert.equal(publicCard.paymentMethod, 'carta');
  assert.equal(publicCard.transportMode, 'pubblico');
  const cleared = reviseTripExpense(publicCard, { paymentMethod: null, transportMode: null }, 'pay3');
  assert.equal(cleared.paymentMethod, null);
  assert.equal(cleared.transportMode, null);
});

test('concurrent edits converge and retain both alternatives for explicit review', () => {
  const a = reviseTripExpense(base, { amount: 14 }, 'a');
  const b = reviseTripExpense(base, { amount: 16 }, 'b');
  const ab = mergeTripExpenseRevisions(a, b), ba = mergeTripExpenseRevisions(b, a);
  assert.deepEqual(ab, ba);
  assert.equal(ab.tripRevisionConflict, true);
  assert.deepEqual(revisionHeads(ab), ['a', 'b']);
  const resolved = reviseTripExpense(ab, { amount: 15 }, 'c');
  assert.equal(resolved.tripRevisionConflict, false);
  assert.equal(resolved.tripRevisions.length, 3);
  assert.equal(mergeTripExpenseRevisions(resolved, a), resolved);
});
test('valuta originale (src/trips/trip-currency.js): impostata e poi rimossa esplicitamente con null, mai persa in silenzio', () => {
  const converted = reviseTripExpense(base, { amount: 11.04, originalAmount: 12, originalCurrency: 'CHF', exchangeRate: 0.92 }, 'cur1');
  assert.equal(converted.originalCurrency, 'CHF');
  assert.equal(converted.originalAmount, 12);
  assert.equal(converted.exchangeRate, 0.92);
  const cleared = reviseTripExpense(converted, { amount: 12, originalAmount: null, originalCurrency: null, exchangeRate: null }, 'cur2');
  assert.equal(cleared.originalCurrency, null);
  assert.equal(cleared.originalAmount, null);
  assert.equal(cleared.exchangeRate, null);
});

test('invalid edits and unrelated incoming rows cannot alter a trip', () => {
  assert.throws(() => reviseTripExpense(base, { amount: Infinity }, 'x'));
  assert.throws(() => reviseTripExpense(base, { date: '2026-02-30' }, 'x'));
  assert.equal(mergeTripExpenseRevisions(base, { ...base, businessTripId: 'other' }), base);
});

test('Vault edit moves the existing record and rejects stale editor snapshots', async () => {
  globalThis.window ||= {};
  if (!globalThis.navigator) Object.defineProperty(globalThis, 'navigator', { value: { language: 'it', maxTouchPoints: 0 }, configurable: true });
  globalThis.localStorage ||= { getItem: () => null, setItem: () => {} };
  const { VaultDAO } = await import('../core/vault.js');
  const originalState = VaultDAO.state, originalSave = VaultDAO.save;
  let saved = 0;
  try {
    VaultDAO.state = { transactions: { '2026-09': [{ ...base }] } };
    VaultDAO.save = () => { saved++; };
    const next = VaultDAO.reviseTripTransaction('uuid', 'trip', { date: '2026-10-01', amount: 18, category: 'ristoranti' }, 'edit', '');
    assert.equal(next.amount, 18);
    assert.equal(next.category, 'ristoranti');
    assert.equal(next.tripRevisionBase.category, 'food');
    assert.equal(VaultDAO.state.transactions['2026-09'].length, 0);
    assert.equal(VaultDAO.state.transactions['2026-10'][0].receiptImage, 'receipt');
    assert.equal(VaultDAO.reviseTripTransaction('uuid', 'trip', { amount: 20 }, 'stale', ''), null);
    assert.equal(saved, 1);
  } finally { VaultDAO.state = originalState; VaultDAO.save = originalSave; }
});
