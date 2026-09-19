import test from 'node:test';
import assert from 'node:assert/strict';
import { tripReviewSnapshot, fingerprintTripSnapshot } from './review-fingerprint.js';
import { encodeTripReview, decodeTripReview, encodeTripVerdict, decodeTripVerdict, applyTripVerdict } from './trip-review.js';
const trip = { id: 't', name: 'Trip', offeredItems: [] };
const rows = [{ id: 'x', businessTripId: 't', amount: 12, date: '2026-09-13', receiptImage: 'original' }];
const fingerprint = (t = trip, r = rows) => fingerprintTripSnapshot(tripReviewSnapshot(t, r));
test('review round trip binds the decision to the same full report', async () => {
  const hash = await fingerprint();
  const review = await decodeTripReview(await encodeTripReview({ tripId: 't', reportFingerprint: hash }));
  const verdict = decodeTripVerdict(encodeTripVerdict({ tripId: review.tripId, state: 'approvata', reportFingerprint: review.reportFingerprint }));
  assert.equal(applyTripVerdict(trip, verdict, hash).approval.reportFingerprint, hash);
  assert.throws(() => applyTripVerdict(trip, verdict, 'changed'), /VERSION_MISMATCH/);
  assert.throws(() => applyTripVerdict(trip, { tripId: 't', state: 'approvata' }, hash), /VERSION_MISMATCH/);
});
test('attachments, amounts, offered expenses and policy change the fingerprint', async () => {
  const hash = await fingerprint();
  for (const patch of [{ amount: 13 }, { receiptImage: 'replacement' }, { date: '2026-09-14' }, { currency: 'USD' }]) {
    assert.notEqual(await fingerprint(trip, [{ ...rows[0], ...patch }]), hash);
  }
  assert.notEqual(await fingerprint({ ...trip, offeredItems: [{ id: 'meal', amount: 3 }] }), hash);
  assert.notEqual(await fingerprint({ ...trip, receiptPolicy: { receiptThreshold: 0 } }), hash);
});
test('delivery metadata, key order and unrelated expenses do not invalidate a report', async () => {
  assert.equal(await fingerprint({ ...trip, approval: { state: 'inviata' } }, [{ ...rows[0], bridgePreparedAt: 'now' }, { id: 'private', businessTripId: 'other' }]), await fingerprint());
  const another = { ...rows[0], id: 'y' };
  assert.equal(await fingerprint(trip, [...rows, another]), await fingerprint(trip, [another, ...rows]));
});

// Bleisure (2026-09-19): una spesa marcata personale non è mai stata parte
// di ciò che è stato davvero inviato all'azienda — modificarla DOPO
// l'approvazione non deve invalidarla, ma marcarla/smarcarla sì (cambia
// cosa viene davvero rimborsato).
test('bleisure: modificare una spesa GIÀ personale non invalida il report (non era mai stata inviata)', async () => {
  const personale = { ...rows[0], tripPersonal: true };
  const hash = await fingerprint(trip, [personale]);
  assert.equal(await fingerprint(trip, [{ ...personale, amount: 999 }]), hash);
});

test('bleisure: marcare/smarcare una spesa come personale INVALIDA il report (cambia cosa viene rimborsato)', async () => {
  const hash = await fingerprint(); // rows[0] normale, rimborsabile
  assert.notEqual(await fingerprint(trip, [{ ...rows[0], tripPersonal: true }]), hash);
});

test('compressed summaries keep the fingerprint of the full report', async () => {
  const hash = await fingerprint();
  const review = await decodeTripReview(await encodeTripReview({ tripId: 't', reportFingerprint: hash, expenses: Array.from({ length: 40 }, (_, i) => ({ data: '2026-09-13', categoria: 'vitto', descrizione: `Expense ${i}`, importo: i + 1 })) }, null, { maxLen: 1 }));
  assert.equal(review.ridotto, true);
  assert.equal(review.reportFingerprint, hash);
});
