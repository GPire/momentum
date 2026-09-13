// Personal review archive, not an authenticated company approval ledger.
export function rememberReview(history = [], review, decision = null, now = Date.now()) {
  if (!review?.tripId || !Array.isArray(review.expenses)) throw new TypeError('Invalid review');
  const snapshot = JSON.stringify(review);
  const entries = Array.isArray(history) ? history : [];
  const existing = entries.find(entry => JSON.stringify(entry.review) === snapshot);
  const entry = { review: JSON.parse(snapshot), savedAt: existing?.savedAt ?? now,
    decision: decision ? JSON.parse(JSON.stringify(decision)) : existing?.decision ?? null };
  return [entry, ...entries.filter(item => item !== existing)];
}
