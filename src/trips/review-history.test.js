import test from 'node:test';
import assert from 'node:assert/strict';
import { rememberReview } from './review-history.js';
const review = { tripId: 'trip-uuid', tripName: 'Paris', expenses: [], totale: 15 };
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
