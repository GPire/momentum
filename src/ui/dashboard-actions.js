// Quick actions follow explicit interests and existing work, never age-based ability assumptions.
export function dashboardActions(state = {}) {
  const p = state.onboardingProfile || {};
  const prefs = state.investmentPrefs || {};
  const minor = p.isMinor === true || p.ageBracket === 'under18';
  const actions = ['split'];
  if (!minor || (state.fixedCommitments || []).length) actions.push('agenda');
  if ((state.trips || []).length) actions.push('trips');
  if (!minor && prefs.invests === true) actions.push('invest');
  if (minor || (state.savingsGoals || []).length) actions.push('goals');
  return actions.slice(0,4);
}
