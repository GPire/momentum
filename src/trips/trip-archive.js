// Portable evidence package, not a vendor-specific API payload or Vault backup.
export function buildTripArchive(trip, transactions, exportedAt = new Date().toISOString()) {
  if (!trip?.id || !Array.isArray(transactions)) throw new TypeError('Invalid trip archive');
  return JSON.parse(JSON.stringify({
    format: 'momentum-trip-archive', version: 1, exportedAt,
    trip,
    transactions: transactions.filter(tx => tx?.businessTripId === trip.id),
  }));
}
