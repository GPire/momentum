import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTripArchive } from './trip-archive.js';
import { readReviewArchive } from './review-archive.js';
import { tripReviewSnapshot, fingerprintTripSnapshot } from './review-fingerprint.js';
const trip = { id: 't', name: 'Work', offeredItems: [] };
const rows = [{ id: 'uuid', businessTripId: 't', type: 'uscita', date: '2026-09-13', amount: 12, receiptImage: 'data:image/png;base64,YQ==' }];
test('employee archive becomes a complete review with the same fingerprint and receipt', async () => {
  const review = await readReviewArchive(JSON.stringify(buildTripArchive(trip, rows)));
  assert.equal(review.reportFingerprint, await fingerprintTripSnapshot(tripReviewSnapshot(trip, rows)));
  assert.equal(review.expenses[0].scontrino, rows[0].receiptImage);
  assert.equal(review.totale, 12);
  assert.equal(review.ridotto, false);
  assert.equal(review.transactions, undefined);
});
test('rejects another archive type, unrelated rows, duplicate IDs and remote attachments', async () => {
  await assert.rejects(readReviewArchive('{}'));
  for (const patch of [{ businessTripId: 'other' }, { amount: '12' }, { receiptImage: 'https://example.com/tracker' }]) {
    await assert.rejects(readReviewArchive(JSON.stringify({ ...buildTripArchive(trip, rows), transactions: [{ ...rows[0], ...patch }] })));
  }
  await assert.rejects(readReviewArchive(JSON.stringify({ ...buildTripArchive(trip, rows), transactions: [...rows, ...rows] })));
});
