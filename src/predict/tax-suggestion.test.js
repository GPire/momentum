import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldSuggestTaxSetup } from './profilo-feature.js';

// BUG REALE corretto 2026-09-13, trovato testando dal vivo il funnel di
// conversione P.IVA: questo test codificava il comportamento sbagliato
// ("richiede un interesse esplicito, non basta il dato mancante") — ma
// profilo-feature.js dichiara nel proprio commento di testa il PRINCIPIO 1
// opposto ("finché non ha detto niente, resta visibile"). In onboarding
// "Non ancora, magari dopo" collassa nello stesso `hasPartitaIva:false` di
// un "No" esplicito (main.js), quindi il vecchio comportamento trattava il
// freelance indeciso — il pubblico per cui questa card esiste — come chi ha
// già detto no. Il segnale esplicito di "no" è `state.noPartitaIva`, non
// `hasPartitaIva`: vedi il secondo test sotto.
test('tax suggestion stays visible until an explicit no, never hidden by missing data', () => {
  for (const state of [{}, { onboardingProfile: {} }, { onboardingProfile: { hasPartitaIva:false } }, { onboardingProfile: { hasPartitaIva:true } }]) assert.equal(shouldSuggestTaxSetup(state), true);
});
test('tax suggestion respects minor age, active regimes and opt-outs', () => {
  const base = { onboardingProfile: { hasPartitaIva:true } };
  for (const extra of [{noPartitaIva:true},{taxDiscoveryDismissed:true},{taxRegime:'forfettario'},{esActive:true},{chActive:true},{taxActiveCountry:'ch'},{taxActiveCountry:'es'}]) assert.equal(shouldSuggestTaxSetup({...base,...extra}), false);
  for (const extra of [{isMinor:true},{ageBracket:'under18'}]) assert.equal(shouldSuggestTaxSetup({onboardingProfile:{...base.onboardingProfile,...extra}}), false);
});
