import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldSuggestTaxSetup } from './profilo-feature.js';

test('tax suggestion requires an explicit onboarding interest, not missing data', () => {
  for (const state of [{}, { onboardingProfile: {} }, { onboardingProfile: { hasPartitaIva:false } }]) assert.equal(shouldSuggestTaxSetup(state), false);
  assert.equal(shouldSuggestTaxSetup({ onboardingProfile: { hasPartitaIva:true } }), true);
});
test('tax suggestion respects minor age, active regimes and opt-outs', () => {
  const base = { onboardingProfile: { hasPartitaIva:true } };
  for (const extra of [{noPartitaIva:true},{taxDiscoveryDismissed:true},{taxRegime:'forfettario'},{esActive:true},{chActive:true},{taxActiveCountry:'ch'},{taxActiveCountry:'es'}]) assert.equal(shouldSuggestTaxSetup({...base,...extra}), false);
  for (const extra of [{isMinor:true},{ageBracket:'under18'}]) assert.equal(shouldSuggestTaxSetup({onboardingProfile:{...base.onboardingProfile,...extra}}), false);
});
