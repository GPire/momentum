const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])])) : value;
const sorted = rows => rows.map(canonical).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

// No approval status or delivery timestamps: those don't change the reviewed facts.
export function tripReviewSnapshot(trip, transactions) {
  const fields = ['id', 'amount', 'date', 'description', 'category', 'tripCategory', 'mealType', 'currency', 'originalCurrency', 'originalAmount', 'receiptImage', 'tripRevisionConflict'];
  return JSON.stringify(canonical({
    id: trip.id, name: trip.name, startDate: trip.startDate, endDate: trip.endDate,
    startTime: trip.startTime, endTime: trip.endTime, receiptPolicy: trip.receiptPolicy,
    companyPolicy: trip.companyPolicy,
    offeredItems: sorted(trip.offeredItems || []),
    expenses: sorted(transactions.filter(tx => tx.businessTripId === trip.id).map(tx => Object.fromEntries(fields.filter(key => tx[key] !== undefined).map(key => [key, tx[key]])))),
  }));
}

export async function fingerprintTripSnapshot(snapshot) {
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(snapshot));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
