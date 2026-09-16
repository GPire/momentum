import test from 'node:test';
import assert from 'node:assert/strict';
import { isTripAttachment } from './attachment-format.js';
import { buildTripArchive, inspectTripArchive } from './trip-archive.js';
import { readReviewArchive } from './review-archive.js';
import { reviseTripExpense } from './expense-revisions.js';

test('sender and reviewer agree on supported attachment envelopes', async () => {
  for (const mime of ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf']) {
    const attachment = `data:${mime};base64,YQ==`;
    assert.equal(isTripAttachment(attachment), true);
    const rows = [{ id: 'id', businessTripId: 't', type: 'uscita', amount: 10, date: '2026-09-13', receiptImage: attachment }];
    assert.equal(inspectTripArchive(rows).blockingCount, 0);
    assert.equal((await readReviewArchive(JSON.stringify(buildTripArchive({ id: 't' }, rows)))).expenses[0].scontrino, attachment);
  }
});
test('unsupported URLs and malformed base64 are flagged without deleting evidence', () => {
  for (const attachment of ['https://example.com/a.jpg', 'data:image/svg+xml;base64,YQ==', 'data:image/heic;base64,YQ==', 'data:image/png;base64,=YQ=', 'data:image/png;base64,AAA', 'data:image/png;base64,   ']) {
    assert.equal(isTripAttachment(attachment), false);
    const rows = [{ id: 'id', amount: 10, date: '2026-09-13', receiptImage: attachment }];
    assert.ok(inspectTripArchive(rows).issues.some(issue => issue.code === 'invalid_attachment' && issue.severity === 'blocking'));
    assert.equal(rows[0].receiptImage, attachment);
  }
});
test('removing an attachment creates a revision and keeps the original evidence', () => {
  const original = { id: 'id', businessTripId: 't', amount: 10, date: '2026-09-13', receiptImage: 'data:image/png;base64,YQ==' };
  const revised = reviseTripExpense(original, { receiptImage: null }, 'r1');
  assert.equal(revised.receiptImage, null);
  assert.equal(revised.tripRevisionBase.receiptImage, original.receiptImage);
  assert.equal(original.receiptImage, 'data:image/png;base64,YQ==');
});
