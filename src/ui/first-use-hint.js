// A short orientation belongs to an empty first visit, never to an invitation.
export function shouldShowAddHint(state = {}) {
  const transactions = Object.values(state.transactions || {}).flat();
  return state.isFirstLaunch !== true && !state.activatedLite && !(state.addHintShownCount > 0)
    && !transactions.some(tx => tx && tx.isDemo !== true && tx.isSeed !== true);
}
