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

export const TIER_FREE = 'FREE';
export const TIER_PRO = 'PRO';
export const TIER_PRO_INVESTOR = 'PRO_INVESTOR';

const FREE_FEATURES = [
  'budget_oggi',
  'categorizzazione_base',
  'proiezione_fine_mese',
  'patrimonio_manuale',
  'import_base',
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
  'export_dati', // CSV/PDF
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

// Il piano corrente si legge SEMPRE dalla licenza salvata nello stato, mai
// da un flag separato che potrebbe disallinearsi — un solo posto dove
// "quale piano ha questo dispositivo" è vero. Una licenza scaduta
// retrocede onestamente a FREE (mai bloccare l'app, mai fingere che sia
// ancora valida).
export function currentTier(state = {}) {
  const lic = state?.license;
  if (!lic?.tier || !FEATURES_PER_PIANO[lic.tier]) return TIER_FREE;
  if (Number.isFinite(lic.exp) && Date.now() > lic.exp) return TIER_FREE;
  return lic.tier;
}

export function hasFeature(state, featureKey) {
  const piano = currentTier(state);
  return FEATURES_PER_PIANO[piano].includes(featureKey);
}

// Attiva una licenza: verifica la firma (license.js, mai una chiamata di
// rete) e SOLO se valida scrive `state.license` — chi chiama (main.js)
// resta responsabile di salvare lo stato dopo (VaultDAO.save()), stessa
// disciplina di ogni altra mutazione di stato nel progetto: questa
// funzione non ha side-effect di persistenza propri.
export async function activateLicense(licenseKey, state) {
  const r = await verifyLicenseKey(licenseKey);
  if (!r.valid) return { attivata: false, motivo: r.motivo || (r.scaduto ? 'Codice scaduto.' : 'Codice non valido.') };
  state.license = { key: licenseKey, tier: r.tier, exp: r.exp, attivataIl: Date.now() };
  return { attivata: true, tier: r.tier, exp: r.exp };
}

// Disattiva la licenza corrente (es. "esci dal piano PRO su questo
// dispositivo") — non revoca la licenza altrove, è solo locale: chi ha lo
// stesso codice può riattivarla su un altro dispositivo o di nuovo qui.
export function deactivateLicense(state) {
  delete state.license;
}
