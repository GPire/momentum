// ============================================================
// FEATURE FLAG PER PIANO — FREE / PRO / PRO_INVESTOR
// ============================================================
// Puro dato + funzioni pure: nessuna chiamata di rete, nessuno stato
// globale. Chi chiama passa lo `state` del vault (VaultDAO.state) e
// riceve una risposta — la stessa disciplina di ogni altro modulo
// "predict"/"alpha" di questo progetto.
//
// ONESTÀ (regola del progetto): ogni chiave qui sotto corrisponde a una
// funzionalità VERA e già esistente nel codice — mai una voce-vetrina per
// qualcosa non ancora costruito. L'elenco NON è ancora agganciato a ogni
// schermata dell'app (lavoro incrementale, dichiarato nel commit): questo
// file è l'infrastruttura, non ancora il gating completo.
'use strict';

import { verifyLicenseKey } from './license.js';

// Prezzi decisi il 2026-09-21 (docs/pricing-decision-2026-09-21.md): sotto
// il pavimento verificato di ogni concorrente della ricerca (Monarch Core
// $8.33/mese, nessuno con un piano gratis completo). UN SOLO posto dove il
// prezzo è scritto — ogni schermata che lo mostra legge da qui, mai un
// numero ricopiato a mano che può disallinearsi. Nessun sistema di
// pagamento è ancora collegato: sono i prezzi decisi, non un flusso
// d'acquisto reale.
export const PRICE_PRO_MONTHLY_EUR = 3.99;
export const PRICE_PRO_YEARLY_EUR = 34.99;
// PRO Investor, deciso il 2026-09-26: sotto il pavimento personale verificato
// (Monarch Core $8.33/mese), sconto annuale allineato a PRO (~27%).
export const PRICE_PRO_INVESTOR_MONTHLY_EUR = 6.99;
export const PRICE_PRO_INVESTOR_YEARLY_EUR = 59.99;

export const TIER_FREE = 'FREE';
export const TIER_PRO = 'PRO';
export const TIER_PRO_INVESTOR = 'PRO_INVESTOR';

const FREE_FEATURES = [
  'budget_oggi',
  'categorizzazione_base',
  'proiezione_fine_mese',
  'patrimonio_manuale',
  'import_base',
  'calendario',
  'obiettivi_risparmio',
  'divisione_spese',
  'export_dati',
  'vista_completa',
];

const PRO_FEATURES = [
  ...FREE_FEATURES,
  'fisco_italia', // src/predict/tax.js — forfettario/ordinario, F24, ravvedimento
  'fisco_svizzera', // src/predict/tax-ch.js — AVS/AI/IPG, QR-bill
  'fisco_spagna', // src/predict/tax-es.js — RETA, IRPF autonomo
  'fatturazione_elettronica', // src/predict/tax.js — FatturaPA, predittore scarto SdI
  'pannello_sec_base', // screener-settore.js — le 600 aziende pubblicate per intero
  'beneish_piotroski', // src/alpha/quality-scores.js
  'sentiment_on_device', // src/ai/local-sentiment.js
  'sync_multi_dispositivo', // mesh P2P WebRTC
];

const PRO_INVESTOR_FEATURES = [
  ...PRO_FEATURES,
  'pannello_sec_completo', // tutte le 11.304 aziende con ricavi depositati
  'analisi_causale_titolo', // src/alpha/titolo-causale.js, confronto-titoli.js
  'comps_multipli', // src/alpha/comps-multipli.js
  'posizionamento_derivati_crypto', // src/alpha/crypto-derivati.js
  'proiezioni_monte_carlo',
  'regime_di_mercato',
  'risk_parity_rebalancing',
];

export const FEATURES_PER_PIANO = {
  [TIER_FREE]: FREE_FEATURES,
  [TIER_PRO]: PRO_FEATURES,
  [TIER_PRO_INVESTOR]: PRO_INVESTOR_FEATURES,
};

// A recommendation cannot activate a licence. Age, risk appetite and income
// alone are never evidence that someone needs a paid plan.
export function recommendPlan(state = {}) {
  const profile = state.onboardingProfile || {};
  if (profile.isMinor || profile.ageBracket === 'under18') return { tier: TIER_FREE, reasons: [] };
  const reasons = [];
  if (state.taxRegime || state.esActive || state.chActive || state.chAttivitaTipo) reasons.push('professional_tax');
  if (state.investmentPrefs?.invests === true && state.positions?.length > 0) reasons.push('portfolio_analysis');
  return { tier: reasons.length ? TIER_PRO : TIER_FREE, reasons };
}

// Il piano corrente si legge SEMPRE dalla licenza salvata nello stato, mai
// da un flag separato che potrebbe disallinearsi — un solo posto dove
// "quale piano ha questo dispositivo" è vero. Una licenza scaduta
// retrocede onestamente a FREE (mai bloccare l'app, mai fingere che sia
// ancora valida).
//
// Il piano viene solo da una licenza la cui firma E il cui dispositivo sono
// stati verificati in questa sessione (activateLicense/verifyStoredLicense):
// una `state.license` arrivata da un backup, da un altro dispositivo o
// modificata a mano non sblocca nulla finché non supera la verifica qui.
let licenzaVerificata = null;

export function currentTier(state = {}) {
  const lic = state?.license;
  if (!lic?.key || licenzaVerificata?.key !== lic.key) return TIER_FREE;
  if (!FEATURES_PER_PIANO[licenzaVerificata.tier]) return TIER_FREE;
  if (Number.isFinite(licenzaVerificata.exp) && Date.now() > licenzaVerificata.exp) return TIER_FREE;
  return licenzaVerificata.tier;
}

// Da chiamare all'avvio, prima di mostrare funzioni a pagamento.
export async function verifyStoredLicense(state, opts = {}) {
  licenzaVerificata = null;
  const lic = state?.license;
  if (!lic?.key) return { valid: false };
  const r = await verifyLicenseKey(lic.key, opts);
  if (r.valid) licenzaVerificata = { key: lic.key, tier: r.tier, exp: r.exp };
  return r;
}

export function hasFeature(state, featureKey) {
  const piano = currentTier(state);
  return FEATURES_PER_PIANO[piano].includes(featureKey);
}

// Il piano più basso che sblocca la funzione: un avviso che proponesse PRO
// per una funzione solo PRO_INVESTOR farebbe pagare qualcosa che non la sblocca.
export function requiredTier(featureKey) {
  for (const tier of [TIER_FREE, TIER_PRO, TIER_PRO_INVESTOR]) {
    if (FEATURES_PER_PIANO[tier].includes(featureKey)) return tier;
  }
  return null;
}

// Attiva una licenza: verifica la firma (license.js, mai una chiamata di
// rete) e SOLO se valida scrive `state.license` — chi chiama (main.js)
// resta responsabile di salvare lo stato dopo (VaultDAO.save()), stessa
// disciplina di ogni altra mutazione di stato nel progetto: questa
// funzione non ha side-effect di persistenza propri.
export async function activateLicense(licenseKey, state, opts = {}) {
  const key = String(licenseKey || '').trim();
  const r = await verifyLicenseKey(key, opts);
  if (!r.valid) return { attivata: false, codice: r.codice || null, motivo: r.motivo || (r.scaduto ? 'Codice scaduto.' : 'Codice non valido.') };
  state.license = { key, tier: r.tier, exp: r.exp, dev: r.dev, attivataIl: Date.now() };
  licenzaVerificata = { key, tier: r.tier, exp: r.exp };
  return { attivata: true, tier: r.tier, exp: r.exp };
}

// Disattiva la licenza corrente (es. "esci dal piano PRO su questo
// dispositivo") — non revoca la licenza altrove, è solo locale: chi ha lo
// stesso codice può riattivarla su un altro dispositivo o di nuovo qui.
export function deactivateLicense(state) {
  if (licenzaVerificata?.key === state?.license?.key) licenzaVerificata = null;
  delete state.license;
}
