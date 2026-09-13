import test from 'node:test';
import assert from 'node:assert/strict';
import { rememberReview } from './review-history.js';
const review = { tripId: 'trip-uuid', tripName: 'Paris', expenses: [], totale: 15 };
test('changing a decision retains the earlier decision and note, including legacy histories', () => {
  const previous = { state: 'modifiche', note: 'Receipt missing', preparedAt: 1 };
  const history = [{ review, savedAt: 1, decision: previous }];
  const approval = { state: 'approvata', note: 'Receipt checked', preparedAt: 2 };
  const updated = rememberReview(history, review, approval, 2);
  assert.deepEqual(updated[0].decisions, [previous, approval]);
  assert.equal(history[0].decisions, undefined);
  assert.equal(updated[0].decision.state, 'approvata');
  assert.equal(rememberReview(updated, review, approval, 3)[0].decisions.length, 2);
  approval.note = 'Changed externally';
  assert.equal(updated[0].decisions[1].note, 'Receipt checked');
});
test('same snapshot is saved once and never mutates received data', () => {
  const history = rememberReview([], review, null, 1);
  assert.equal(rememberReview(history, review, null, 2).length, 1);
  assert.notEqual(history[0].review, review);
  assert.equal(review.savedAt, undefined);
});
test('a revised request preserves the prior decision', () => {
  const first = rememberReview([], review, { state: 'approvata' }, 1);
  const next = rememberReview(first, { ...review, totale: 20 }, null, 2);
  assert.equal(next.length, 2);
  assert.equal(next[1].decision.state, 'approvata');
});
test('opening a saved request does not erase its decision', () => {
  const first = rememberReview([], review, { state: 'modifiche' }, 1);
  assert.equal(rememberReview(first, review, null, 2)[0].decision.state, 'modifiche');
});
