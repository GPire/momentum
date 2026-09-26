import test from 'node:test';
import assert from 'node:assert/strict';
import { currentTier, hasFeature, activateLicense, deactivateLicense, recommendPlan, requiredTier, TIER_FREE, TIER_PRO, TIER_PRO_INVESTOR, FEATURES_PER_PIANO, PRICE_PRO_MONTHLY_EUR, PRICE_PRO_YEARLY_EUR, PRICE_PRO_INVESTOR_MONTHLY_EUR, PRICE_PRO_INVESTOR_YEARLY_EUR, verifyStoredLicense } from './subscription.js';

const DEV = 'ABCD-EFGH-JKMN-PQRS';

async function licenzaFirmata(tier, exp = null) {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const publicKeyB64 = Buffer.from(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))).toString('base64url');
  const payloadBytes = Buffer.from(JSON.stringify({ tier, iat: Date.now(), exp, dev: DEV }), 'utf8');
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, payloadBytes);
  return { key: `${payloadBytes.toString('base64url')}.${Buffer.from(sig).toString('base64url')}`, publicKeyB64 };
}

async function statoCon(tier, exp = null) {
  const { key, publicKeyB64 } = await licenzaFirmata(tier, exp);
  const state = {};
  const r = await activateLicense(key, state, { publicKeyB64, deviceCode: DEV });
  assert.equal(r.attivata, true);
  return state;
}

test('prezzi: il piano annuale costa meno di 12 mesi al prezzo mensile, mai un finto sconto', () => {
  assert.ok(PRICE_PRO_YEARLY_EUR < PRICE_PRO_MONTHLY_EUR * 12);
  assert.ok(PRICE_PRO_MONTHLY_EUR > 0 && PRICE_PRO_YEARLY_EUR > 0);
  assert.ok(PRICE_PRO_INVESTOR_YEARLY_EUR < PRICE_PRO_INVESTOR_MONTHLY_EUR * 12);
});

test('prezzi: PRO Investor costa più di PRO (include tutto PRO) e resta sotto il pavimento verificato di $8.33/mese', () => {
  assert.ok(PRICE_PRO_INVESTOR_MONTHLY_EUR > PRICE_PRO_MONTHLY_EUR);
  assert.ok(PRICE_PRO_INVESTOR_YEARLY_EUR > PRICE_PRO_YEARLY_EUR);
  assert.ok(PRICE_PRO_INVESTOR_MONTHLY_EUR < 8.33);
});

test('currentTier: nessuna licenza -> FREE', () => {
  assert.equal(currentTier({}), TIER_FREE);
  assert.equal(currentTier({ license: null }), TIER_FREE);
});

test('currentTier: licenza PRO valida, non scaduta -> PRO', async () => {
  assert.equal(currentTier(await statoCon(TIER_PRO, Date.now() + 86_400_000)), TIER_PRO);
});

test('currentTier: licenza PRO_INVESTOR a vita (exp null) -> PRO_INVESTOR', async () => {
  assert.equal(currentTier(await statoCon(TIER_PRO_INVESTOR)), TIER_PRO_INVESTOR);
});

test('currentTier: licenza che scade durante l\'uso -> retrocede onestamente a FREE', async () => {
  const state = await statoCon(TIER_PRO, Date.now() + 800);
  assert.equal(currentTier(state), TIER_PRO);
  await new Promise((r) => setTimeout(r, 900));
  assert.equal(currentTier(state), TIER_FREE);
});

test('currentTier: una licenza salvata nello stato ma MAI verificata qui non sblocca nulla (backup, altro dispositivo, modifica a mano)', () => {
  assert.equal(currentTier({ license: { key: 'x.y', tier: TIER_PRO_INVESTOR, exp: null } }), TIER_FREE);
  assert.equal(currentTier({ license: { tier: TIER_PRO, exp: null } }), TIER_FREE);
});

test('verifyStoredLicense: all\'avvio una licenza di QUESTO dispositivo torna attiva, quella di un altro no', async () => {
  const { key, publicKeyB64 } = await licenzaFirmata(TIER_PRO);
  const state = { license: { key, tier: TIER_PRO, exp: null } };
  assert.equal((await verifyStoredLicense(state, { publicKeyB64, deviceCode: 'ZZZZ-ZZZZ-ZZZZ-ZZZZ' })).valid, false);
  assert.equal(currentTier(state), TIER_FREE);
  assert.equal((await verifyStoredLicense(state, { publicKeyB64, deviceCode: DEV })).valid, true);
  assert.equal(currentTier(state), TIER_PRO);
});

test('activateLicense: la chiave di un altro dispositivo non attiva nulla e spiega il perché', async () => {
  const { key, publicKeyB64 } = await licenzaFirmata(TIER_PRO);
  const state = {};
  const r = await activateLicense(key, state, { publicKeyB64, deviceCode: 'ZZZZ-ZZZZ-ZZZZ-ZZZZ' });
  assert.equal(r.attivata, false);
  assert.equal(r.codice, 'altro_dispositivo');
  assert.equal(state.license, undefined);
});

test('hasFeature: una feature FREE è disponibile a chiunque, anche senza licenza', () => {
  assert.equal(hasFeature({}, 'budget_oggi'), true);
});

test('hasFeature: una feature PRO non è disponibile su FREE', () => {
  assert.equal(hasFeature({}, 'fisco_italia'), false);
});

test('hasFeature: una feature PRO è disponibile con licenza PRO', async () => {
  assert.equal(hasFeature(await statoCon(TIER_PRO), 'fisco_italia'), true);
});

test('PRO does NOT include investor-only features (2026-09-14: piani separati per ANALISI_COMPETITOR.md §8, gating mai attivo finora quindi nessun utente reale impattato)', async () => {
  assert.equal(hasFeature(await statoCon(TIER_PRO), 'pannello_sec_completo'), false);
});

test('PRO_INVESTOR include le feature investor avanzate', async () => {
  assert.equal(hasFeature(await statoCon(TIER_PRO_INVESTOR), 'pannello_sec_completo'), true);
});

test('Free keeps data portability and presentation preferences after expiry', () => {
  const expired = { license: { key: 'scaduta.x', tier: TIER_PRO, exp: 1 } };
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

test('deactivateLicense: rimuove la licenza dallo stato, il dispositivo torna FREE', async () => {
  const state = await statoCon(TIER_PRO);
  assert.equal(currentTier(state), TIER_PRO);
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

test('requiredTier: coerente con hasFeature per ogni chiave di ogni piano', async () => {
  const ordine = [TIER_FREE, TIER_PRO, TIER_PRO_INVESTOR];
  for (const tier of ordine) {
    const state = tier === TIER_FREE ? {} : await statoCon(tier);
    for (const key of FEATURES_PER_PIANO[TIER_PRO_INVESTOR]) {
      const atteso = ordine.indexOf(tier) >= ordine.indexOf(requiredTier(key));
      assert.equal(hasFeature(state, key), atteso, `${key} su ${tier}`);
    }
  }
});
