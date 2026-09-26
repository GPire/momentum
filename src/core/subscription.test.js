import test from 'node:test';
import assert from 'node:assert/strict';
import { currentTier, hasFeature, activateLicense, deactivateLicense, recommendPlan, requiredTier, TIER_FREE, TIER_PRO, TIER_PRO_INVESTOR, FEATURES_PER_PIANO, PRICE_PRO_MONTHLY_EUR, PRICE_PRO_YEARLY_EUR } from './subscription.js';

test('prezzi: il piano annuale costa meno di 12 mesi al prezzo mensile, mai un finto sconto', () => {
  assert.ok(PRICE_PRO_YEARLY_EUR < PRICE_PRO_MONTHLY_EUR * 12);
  assert.ok(PRICE_PRO_MONTHLY_EUR > 0 && PRICE_PRO_YEARLY_EUR > 0);
});

test('currentTier: nessuna licenza -> FREE', () => {
  assert.equal(currentTier({}), TIER_FREE);
  assert.equal(currentTier({ license: null }), TIER_FREE);
});

test('currentTier: licenza PRO valida, non scaduta -> PRO', () => {
  assert.equal(currentTier({ license: { tier: TIER_PRO, exp: Date.now() + 86_400_000 } }), TIER_PRO);
});

test('currentTier: licenza PRO_INVESTOR a vita (exp null) -> PRO_INVESTOR', () => {
  assert.equal(currentTier({ license: { tier: TIER_PRO_INVESTOR, exp: null } }), TIER_PRO_INVESTOR);
});

test('currentTier: licenza SCADUTA -> retrocede onestamente a FREE, mai bloccare l\'app fingendo che sia ancora valida', () => {
  assert.equal(currentTier({ license: { tier: TIER_PRO, exp: Date.now() - 1000 } }), TIER_FREE);
});

test('currentTier: tier salvato non riconosciuto (dato corrotto) -> FREE, mai un piano inventato', () => {
  assert.equal(currentTier({ license: { tier: 'QUALCOSA_A_CASO', exp: null } }), TIER_FREE);
});

test('hasFeature: una feature FREE è disponibile a chiunque, anche senza licenza', () => {
  assert.equal(hasFeature({}, 'budget_oggi'), true);
});

test('hasFeature: una feature PRO non è disponibile su FREE', () => {
  assert.equal(hasFeature({}, 'fisco_italia'), false);
});

test('hasFeature: una feature PRO è disponibile con licenza PRO', () => {
  assert.equal(hasFeature({ license: { tier: TIER_PRO, exp: null } }, 'fisco_italia'), true);
});

test('PRO does NOT include investor-only features (2026-09-14: piani separati per ANALISI_COMPETITOR.md §8, gating mai attivo finora quindi nessun utente reale impattato)', () => {
  assert.equal(hasFeature({ license: { tier: TIER_PRO, exp: null } }, 'pannello_sec_completo'), false);
});

test('PRO_INVESTOR include le feature investor avanzate', () => {
  assert.equal(hasFeature({ license: { tier: TIER_PRO_INVESTOR, exp: null } }, 'pannello_sec_completo'), true);
});

test('Free keeps data portability and presentation preferences after expiry', () => {
  const expired = { license: { tier: TIER_PRO, exp: 1 } };
  for (const key of ['export_dati', 'vista_completa', 'calendario', 'divisione_spese', 'obiettivi_risparmio']) {
    assert.equal(hasFeature(expired, key), true);
  }
});

test('plan suggestions require relevant needs and never activate payment', () => {
  assert.equal(recommendPlan({ onboardingProfile: { ageBracket: '65+', riskProfile: 'aggressivo' } }).tier, TIER_FREE);
  assert.equal(recommendPlan({ investmentPrefs: { invests: true } }).tier, TIER_FREE);
  const state = { taxRegime: 'forfettario' };
  assert.deepEqual(recommendPlan(state), { tier: TIER_PRO, reasons: ['professional_tax'] });
  assert.equal(currentTier(state), TIER_FREE);
  assert.equal(recommendPlan({ ...state, onboardingProfile: { isMinor: true } }).tier, TIER_FREE);
});

test('hasFeature: PRO_INVESTOR include TUTTE le feature di PRO (nessun downgrade nascosto salendo di piano)', () => {
  for (const f of FEATURES_PER_PIANO[TIER_PRO]) {
    assert.ok(FEATURES_PER_PIANO[TIER_PRO_INVESTOR].includes(f), `PRO_INVESTOR manca la feature PRO "${f}"`);
  }
});

test('hasFeature: PRO include TUTTE le feature di FREE', () => {
  for (const f of FEATURES_PER_PIANO[TIER_FREE]) {
    assert.ok(FEATURES_PER_PIANO[TIER_PRO].includes(f), `PRO manca la feature FREE "${f}"`);
  }
});

test('activateLicense: codice non valido -> non attiva, stato non toccato', async () => {
  const state = {};
  const r = await activateLicense('codice-inventato', state);
  assert.equal(r.attivata, false);
  assert.equal(state.license, undefined);
});

test('deactivateLicense: rimuove la licenza dallo stato, il dispositivo torna FREE', () => {
  const state = { license: { tier: TIER_PRO, exp: null } };
  deactivateLicense(state);
  assert.equal(state.license, undefined);
  assert.equal(currentTier(state), TIER_FREE);
});

test('requiredTier: il piano minimo richiesto è quello vero, mai PRO per una funzione solo PRO_INVESTOR', () => {
  assert.equal(requiredTier('budget_oggi'), TIER_FREE);
  assert.equal(requiredTier('fisco_italia'), TIER_PRO);
  assert.equal(requiredTier('risk_parity_rebalancing'), TIER_PRO_INVESTOR);
  assert.equal(requiredTier('comps_multipli'), TIER_PRO_INVESTOR);
  assert.equal(requiredTier('chiave_inesistente'), null);
});

test('requiredTier: coerente con hasFeature per ogni chiave di ogni piano', () => {
  const ordine = [TIER_FREE, TIER_PRO, TIER_PRO_INVESTOR];
  for (const key of FEATURES_PER_PIANO[TIER_PRO_INVESTOR]) {
    const minimo = requiredTier(key);
    for (const tier of ordine) {
      const license = tier === TIER_FREE ? undefined : { tier, exp: null };
      const atteso = ordine.indexOf(tier) >= ordine.indexOf(minimo);
      assert.equal(hasFeature({ license }, key), atteso, `${key} su ${tier}`);
    }
  }
});
