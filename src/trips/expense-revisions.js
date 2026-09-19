// Originals remain available for audit; concurrent edits are retained, not erased.
const fields = ['amount', 'description', 'date', 'category', 'tripCategory', 'mealType', 'receiptImage', 'tripPersonal'];
const pick = tx => Object.fromEntries(fields.filter(key => tx[key] !== undefined).map(key => [key, tx[key]]));
const key = row => String(row.id);
export function revisionHeads(tx) {
  const revisions = tx.tripRevisions || [];
  const parents = new Set(revisions.flatMap(row => row.parents));
  return revisions.filter(row => !parents.has(row.id)).map(row => row.id).sort();
}
export function revisionDigest(tx) { return (tx.tripRevisions || []).map(key).sort().join('|'); }

function materialize(tx, revisions) {
  const result = { ...tx, tripRevisionBase: tx.tripRevisionBase || pick(tx), tripRevisions: revisions };
  const heads = new Set(revisionHeads(result));
  const ordered = [...revisions].sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id));
  const selected = ordered.filter(row => heads.has(row.id)).at(-1);
  if (selected) Object.assign(result, selected.values);
  result.tripRevisionConflict = heads.size > 1;
  return result;
}

export function reviseTripExpense(tx, changes, revisionId) {
  if (!tx?.businessTripId || typeof revisionId !== 'string' || !revisionId || (tx.tripRevisions || []).some(row => row.id === revisionId)) throw new TypeError('Invalid expense revision');
  const values = { ...pick(tx), ...pick(changes) };
  if (typeof values.amount !== 'number' || !Number.isFinite(values.amount) || values.amount <= 0 || !Number.isSafeInteger(Math.round(values.amount * 100))) throw new TypeError('Invalid amount');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date) || new Date(values.date).toISOString().slice(0, 10) !== values.date) throw new TypeError('Invalid date');
  const revisions = tx.tripRevisions || [];
  const row = { id: revisionId, parents: revisionHeads(tx), sequence: 1 + Math.max(0, ...revisions.map(row => row.sequence)), values };
  return materialize(tx, [...revisions, row]);
}

export function mergeTripExpenseRevisions(local, incoming) {
  if (String(local.id) !== String(incoming.id) || !local.businessTripId || local.businessTripId !== incoming.businessTripId || local.hash !== incoming.hash) return local;
  const revisions = new Map((local.tripRevisions || []).map(row => [row.id, row]));
  for (const row of incoming.tripRevisions || []) {
    if (!row || typeof row.id !== 'string' || !Array.isArray(row.parents) || !Number.isSafeInteger(row.sequence) || row.sequence < 1 || !row.values || !Number.isFinite(row.values.amount) || row.values.amount <= 0 || typeof row.values.date !== 'string' || !Number.isFinite(Date.parse(row.values.date))) continue;
    if (!revisions.has(row.id)) revisions.set(row.id, { id: row.id, parents: row.parents, sequence: row.sequence, values: pick(row.values) });
  }
  if (revisions.size === (local.tripRevisions || []).length) return local;
  return materialize({ ...local, tripRevisionBase: local.tripRevisionBase || incoming.tripRevisionBase || pick(local) }, [...revisions.values()].sort((a, b) => a.id.localeCompare(b.id)));
}
