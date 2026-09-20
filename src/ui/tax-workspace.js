export const TAX_WORKSPACE_COUNTRIES = Object.freeze(['it', 'ch', 'es']);

// Old archives may have an active regime without an explicit country.
// This selects a view only: no fiscal configuration or financial data changes.
export function taxWorkspaceCountry(state = {}) {
  if (TAX_WORKSPACE_COUNTRIES.includes(state.taxActiveCountry)) return state.taxActiveCountry;
  if (state.taxRegime) return 'it';
  return state.esActive ? 'es' : 'it';
}
