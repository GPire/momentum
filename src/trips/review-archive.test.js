import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTripArchive } from './trip-archive.js';
import { readReviewArchive } from './review-archive.js';
import { tripReviewSnapshot, fingerprintTripSnapshot } from './review-fingerprint.js';
import { encodeTripReview, decodeTripReview, encodeTripVerdict, decodeTripVerdict, applyTripVerdict, assertReviewDecision } from './trip-review.js';
const trip = { id: 't', name: 'Work', offeredItems: [] };
const rows = [{ id: 'uuid', businessTripId: 't', type: 'uscita', date: '2026-09-13', amount: 12, receiptImage: 'data:image/png;base64,YQ==' }];
test('review round trip keeps company-paid costs separate and rejects stale receipts', async () => {
  const businessTrip = { ...trip, offeredItems: [{ amount: 80, date: '2026-09-13', description: 'Hotel', tripCategory: 'alloggio' }] };
  const review = await readReviewArchive(JSON.stringify(buildTripArchive(businessTrip, rows)));
  const link = await decodeTripReview(await encodeTripReview(review));
  assert.equal(link.totale, 12);
  assert.equal(link.offertiTotale, 80);
  assert.equal(link.offerti[0].descrizione, 'Hotel');
  const verdict = decodeTripVerdict(encodeTripVerdict({ tripId: trip.id, state: 'approvata', reportFingerprint: link.reportFingerprint }));
  assert.equal(applyTripVerdict(businessTrip, verdict, review.reportFingerprint, review).approval.state, 'approvata');
  const changed = await readReviewArchive(JSON.stringify(buildTripArchive(businessTrip, [{ ...rows[0], receiptImage: 'data:image/png;base64,Yg==' }])));
  assert.throws(() => applyTripVerdict(businessTrip, verdict, changed.reportFingerprint, changed), /VERSION_MISMATCH/);
});
test('conflicts block approval at reviewer and employee, including reduced links', async () => {
  const review = await readReviewArchive(JSON.stringify(buildTripArchive(trip, [{ ...rows[0], tripRevisionConflict: true }])));
  const reduced = await decodeTripReview(await encodeTripReview(review, null, { maxLen: 1 }));
  assert.equal(reduced.revisionConflictCount, 1);
  for (const report of [review, reduced]) {
    assert.throws(() => assertReviewDecision(report, 'approvata'), /CONFLICT/);
    assert.doesNotThrow(() => assertReviewDecision(report, 'modifiche'));
    assert.throws(() => applyTripVerdict(trip, { tripId: trip.id, state: 'approvata', reportFingerprint: review.reportFingerprint }, review.reportFingerprint, report), /CONFLICT/);
  }
});
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
