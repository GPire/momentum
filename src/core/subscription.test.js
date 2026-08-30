import test from 'node:test';
import assert from 'node:assert/strict';
import { currentTier, hasFeature, activateLicense, deactivateLicense, TIER_FREE, TIER_PRO, TIER_PRO_INVESTOR, FEATURES_PER_PIANO } from './subscription.js';

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

test('hasFeature: una feature PRO_INVESTOR NON è disponibile con licenza PRO (solo il piano superiore)', () => {
  assert.equal(hasFeature({ license: { tier: TIER_PRO, exp: null } }, 'pannello_sec_completo'), false);
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
