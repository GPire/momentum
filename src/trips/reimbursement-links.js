// Associations are separate from immutable bank movement fields.
const valid = event => event && typeof event.id === 'string' && event.id.length > 0
  && Array.isArray(event.parents) && event.parents.every(id => typeof id === 'string')
  && (event.tripId === null || typeof event.tripId === 'string' && event.tripId.length > 0);
export function reimbursementLinkDigest(tx) {
  return (tx.reimbursementLinks || []).map(event => event.id).sort().join('|');
}
export function reimbursementLinkState(tx) {
  const events = (tx.reimbursementLinks || []).filter(valid);
  const parents = new Set(events.flatMap(event => event.parents));
  const heads = events.filter(event => !parents.has(event.id));
  const destinations = new Set(heads.map(event => event.tripId));
  return { tripId: destinations.size === 1 ? heads[0].tripId : events.length ? null : tx.businessTripId || null,
    conflict: destinations.size > 1 || events.length > 0 && heads.length === 0, heads: heads.map(event => event.id).sort() };
}
export function associateReimbursement(tx, tripId, id, expectedDigest) {
  if (tx.type !== 'entrata' || !Number.isFinite(tx.amount) || tx.amount <= 0
    || reimbursementLinkDigest(tx) !== expectedDigest || !valid({ id, tripId, parents: [] })
    || (tx.reimbursementLinks || []).some(event => event.id === id)) throw new TypeError('Invalid or stale association');
  return { ...tx, reimbursementLinks: [...(tx.reimbursementLinks || []), { id, tripId, parents: reimbursementLinkState(tx).heads }] };
}
export function mergeReimbursementLinks(local, incoming) {
  if (local.type !== 'entrata' || incoming.type !== 'entrata' || String(local.id) !== String(incoming.id)
    || local.hash !== incoming.hash || local.amount !== incoming.amount || local.currency !== incoming.currency) return local;
  const events = new Map((local.reimbursementLinks || []).map(event => [event.id, event]));
  for (const event of incoming.reimbursementLinks || []) if (valid(event) && !events.has(event.id)) events.set(event.id, { id: event.id, tripId: event.tripId, parents: [...event.parents] });
  return events.size === (local.reimbursementLinks || []).length ? local : { ...local, reimbursementLinks: [...events.values()].sort((a, b) => a.id.localeCompare(b.id)) };
}

// Exact currency is required. Similar amounts rank first but never authorize a link.
export function reimbursementCandidates(trip, transactions, remaining) {
  const counts = new Map();
  for (const tx of transactions) counts.set(String(tx.id), (counts.get(String(tx.id)) || 0) + 1);
  return transactions.filter(tx => tx.type === 'entrata' && tx.id != null && counts.get(String(tx.id)) === 1
    && Number.isFinite(tx.amount) && tx.amount > 0 && tx.currency === (trip.receiptPolicy?.currency || 'EUR')
    && !tx.tripPersonal && !tx.tripRevisionConflict && !reimbursementLinkState(tx).conflict && !reimbursementLinkState(tx).tripId)
    .sort((a, b) => Math.abs(a.amount - remaining) - Math.abs(b.amount - remaining) || String(b.date).localeCompare(String(a.date)));
}
