// Personal review archive, not an authenticated company approval ledger.
export function reviewHistoryPage(history, { query = '', filter = 'all', limit = 20 } = {}) {
  const normalize = value => String(value || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
  const needle = normalize(query.trim());
  const entries = (Array.isArray(history) ? history : []).filter(entry => entry?.review?.tripId && Array.isArray(entry.review.expenses));
  const pending = entries.filter(entry => !entry.decision).length;
  const matches = entries.filter(entry => (filter === 'pending' ? !entry.decision : filter === 'prepared' ? !!entry.decision : true)
    && normalize([entry.review.tripName, entry.review.mittente, entry.decision?.reviewer, entry.decision?.note].join(' ')).includes(needle))
    .sort((a, b) => (Number(b.savedAt) || 0) - (Number(a.savedAt) || 0));
  const count = Number.isSafeInteger(limit) && limit > 0 ? limit : 20;
  return { entries: matches.slice(0, count), total: matches.length, counts: { all: entries.length, pending, prepared: entries.length - pending } };
}

export function rememberReview(history = [], review, decision = null, now = Date.now()) {
  if (!review?.tripId || !Array.isArray(review.expenses)) throw new TypeError('Invalid review');
  const snapshot = JSON.stringify(review);
  const entries = Array.isArray(history) ? history : [];
  const existing = entries.find(entry => JSON.stringify(entry.review) === snapshot);
  const decisions = existing?.decisions || (existing?.decision ? [existing.decision] : []);
  const nextDecisions = decision && JSON.stringify(decisions.at(-1)) !== JSON.stringify(decision)
    ? [...decisions, decision] : decisions;
  const entry = { review: JSON.parse(snapshot), savedAt: existing?.savedAt ?? now,
    decision: decision ? JSON.parse(JSON.stringify(decision)) : existing?.decision ?? null,
    decisions: JSON.parse(JSON.stringify(nextDecisions)) };
  return [entry, ...entries.filter(item => item !== existing)];
}
