const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])])) : value;
const sorted = rows => rows.map(canonical).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

// No approval status or delivery timestamps: those don't change the reviewed facts.
export function tripReviewSnapshot(trip, transactions) {
  const fields = ['id', 'amount', 'date', 'description', 'category', 'tripCategory', 'mealType', 'currency', 'originalCurrency', 'originalAmount', 'exchangeRate', 'receiptImage', 'tripRevisionConflict'];
  return JSON.stringify(canonical({
    id: trip.id, name: trip.name, startDate: trip.startDate, endDate: trip.endDate,
    startTime: trip.startTime, endTime: trip.endTime, receiptPolicy: trip.receiptPolicy,
    companyPolicy: trip.companyPolicy,
    offeredItems: sorted(trip.offeredItems || []),
    // Bleisure (2026-09-19): una spesa marcata tripPersonal non fa parte di
    // ciò che viene davvero inviato all'azienda (vedi reimbursableTripExpenses
    // in trip-engine.js) — esclusa anche qui, altrimenti modificarla dopo
    // l'approvazione la invaliderebbe per un dato che il revisore non ha mai
    // visto né approvato. Marcarla/smarcarla cambia comunque l'elenco (entra o
    // esce da questa lista), quindi resta rilevata come una modifica vera.
    expenses: sorted(transactions.filter(tx => tx.businessTripId === trip.id && !tx.tripPersonal).map(tx => Object.fromEntries(fields.filter(key => tx[key] !== undefined).map(key => [key, tx[key]])))),
  }));
}

export async function fingerprintTripSnapshot(snapshot) {
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(snapshot));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
