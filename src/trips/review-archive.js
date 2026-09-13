import { exportTripData } from './trip-engine.js';
import { isTripDate } from './trip-archive.js';
import { isTripAttachment as isReviewAttachment } from './attachment-format.js';
export { isTripAttachment as isReviewAttachment } from './attachment-format.js';
import { tripReviewSnapshot, fingerprintTripSnapshot } from './review-fingerprint.js';

export const MAX_REVIEW_ARCHIVE_BYTES = 50 * 1024 * 1024;

// Produces a review, never transactions for the reviewer's personal ledger.
export async function readReviewArchive(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_REVIEW_ARCHIVE_BYTES) throw new TypeError('Invalid archive size');
  const archive = JSON.parse(text);
  if (archive?.format !== 'momentum-trip-archive' || archive.version !== 1 || !archive.trip?.id || !Array.isArray(archive.transactions)) throw new TypeError('Invalid trip archive');
  const ids = new Set();
  for (const tx of archive.transactions) {
    if (!tx || tx.businessTripId !== archive.trip.id || tx.id === undefined || tx.id === null || !String(tx.id).trim() || ids.has(String(tx.id).trim()) || typeof tx.amount !== 'number' || !Number.isFinite(tx.amount) || tx.amount < 0 || !Number.isSafeInteger(Math.round(tx.amount * 100)) || !isTripDate(tx.date) || (tx.receiptImage && !isReviewAttachment(tx.receiptImage))) throw new TypeError('Invalid expense');
    ids.add(String(tx.id).trim());
  }
  if (archive.trip.offeredItems !== undefined && (!Array.isArray(archive.trip.offeredItems) || archive.trip.offeredItems.some(item => !item || !Number.isFinite(item.amount) || item.amount < 0))) throw new TypeError('Invalid offered expenses');
  const reportFingerprint = await fingerprintTripSnapshot(tripReviewSnapshot(archive.trip, archive.transactions));
  const report = exportTripData(archive.trip, archive.transactions);
  return { ...report, tripId: archive.trip.id, reportFingerprint, ridotto: false,
    numeroSpeseTotali: report.expenses.length, source: 'local-archive' };
}
