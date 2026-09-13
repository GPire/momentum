// Portable evidence package, not a vendor-specific API payload or Vault backup.
export function inspectTripArchive(transactions) {
  const seen = new Set();
  const issues = [];
  transactions.forEach((tx, index) => {
    const issue = code => issues.push({ index, transactionId: tx.id ?? null, code });
    if (tx.tripRevisionConflict) issue('revision_conflict');
    const id = String(tx.id ?? '').trim();
    if (!id) issue('missing_id');
    else if (seen.has(id)) issue('duplicate_id');
    seen.add(id);
    if (typeof tx.amount !== 'number' || !Number.isFinite(tx.amount)) issue('invalid_amount');
    if (typeof tx.date !== 'string' || !Number.isFinite(Date.parse(tx.date))) issue('invalid_date');
    if (!tx.receiptImage) issue('missing_attachment');
  });
  return { transactionCount: transactions.length, attachmentCount: transactions.filter(tx => tx.receiptImage).length,
    reviewCount: new Set(issues.map(issue => issue.index)).size, issues };
}

export function buildTripArchive(trip, transactions, exportedAt = new Date().toISOString()) {
  if (!trip?.id || !Array.isArray(transactions)) throw new TypeError('Invalid trip archive');
  const selected = transactions.filter(tx => tx?.businessTripId === trip.id);
  return JSON.parse(JSON.stringify({
    format: 'momentum-trip-archive', version: 1, exportedAt,
    trip,
    transactions: selected,
    checks: inspectTripArchive(selected),
  }));
}
