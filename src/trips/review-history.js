// Personal review archive, not an authenticated company approval ledger.
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
