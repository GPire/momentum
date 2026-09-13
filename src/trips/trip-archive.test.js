import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTripArchive } from './trip-archive.js';
test('archive preserves UUIDs, receipts, currency and trip metadata without unrelated data', () => {
  const trip = { id: 't1', name: 'Paris', offeredItems: [{ id: 'meal', amount: 20 }], approval: { state: 'approvata' } };
  const tx = { id: 'uuid-1', businessTripId: 't1', type: 'uscita', amount: 15, currency: 'CHF', receiptImage: 'data:image/png;base64,YQ==', hash: 'original' };
  const archive = buildTripArchive(trip, [tx, { ...tx, id: 'private', businessTripId: 'other' }], '2026-09-13T12:00:00Z');
  assert.deepEqual(archive.transactions, [tx]);
  assert.deepEqual(archive.trip, trip);
  assert.deepEqual(JSON.parse(JSON.stringify(archive)).transactions, [tx]);
  archive.transactions[0].amount = 99;
  assert.equal(tx.amount, 15);
});
test('invalid trip cannot accidentally export an entire archive', () => {
  assert.throws(() => buildTripArchive({}, []));
});
