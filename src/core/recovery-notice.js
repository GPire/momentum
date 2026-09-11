// One automatic prompt applies to this set of candidates, independent of
// order/month. Recording it never deletes a transaction or changes the log.
export function recoveryPromptKey(recovered = {}) {
  const ids = [...new Set(Object.values(recovered).flat().filter(tx => tx?.id != null).map(tx => String(tx.id)))].sort();
  return ids.length ? JSON.stringify(ids) : null;
}

export function shouldAutoOpenRecoveryPrompt(recovered, seenKey, suppressed = false) {
  const key = recoveryPromptKey(recovered);
  return !suppressed && key !== null && key !== seenKey;
}
