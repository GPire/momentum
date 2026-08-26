// Conteggio ANONIMO di installazioni/utenti attivi — SOLO per dare a chi
// gestisce il progetto un numero reale da mostrare a investitori/partner,
// MAI per profilare l'utente. Nessun dato personale o finanziario esce dal
// dispositivo: un id casuale (non collegato a nessuna identità, nessuna
// transazione, nessun saldo) + "sono attivo questo mese/anno".
//
// ATTIVO DI DEFAULT (opt-OUT, non opt-in): un id casuale non collegabile a
// nessuna identità reale non è "dato personale" in senso stretto — a
// differenza delle chiavi API/dati finanziari (quelli sì restano SEMPRE
// solo sul dispositivo, senza eccezioni). Un opt-in nascosto in
// Impostazioni darebbe numeri quasi inutili all'inizio, quando servono di
// più. Onestà: avviso ESPLICITO e immediato al primo avvio (mai silenzioso)
// con un tocco per disattivare subito — non un opt-out nascosto in un
// sottomenu. Senza endpoint configurato, ogni funzione qui è un no-op
// silenzioso (nessun errore per chi clona il repo senza distribuire il
// proprio server di conteggio).
'use strict';

const ANON_ID_KEY = 'momentum_anon_id';
const OPT_IN_KEY = 'momentum_telemetry_opt_in';
const DISCLOSED_KEY = 'momentum_telemetry_disclosed';
const INSTALL_SENT_KEY = 'momentum_telemetry_install_sent';
const ACTIVE_MONTH_KEY = 'momentum_telemetry_active_month';
const FEATURE_SENT_KEY = 'momentum_telemetry_feature_sent';

// ============================================================
// EVENTI DI FUNZIONALITÀ (2026-08-26) — stessa infrastruttura, stessa
// disciplina di install/active: MAI un log dettagliato di utilizzo, solo
// "questo dispositivo ha toccato questa pietra miliare questo mese",
// idempotente (un secondo tocco nello stesso mese non manda nulla di
// nuovo). Elenco CHIUSO — un evento fuori lista non parte MAI, stesso
// principio già in uso per gli intenti del QA (rifiuto-strutturale.js) e
// per le parole chiave fiscali: mai testo libero, mai un campo che possa
// diventare per errore un canale per dati veri dell'utente.
//
// PERCHÉ QUESTI E NON ALTRI: rispondono alle domande strategiche reali
// (dove si abbandona, cosa funziona) SENZA MAI sapere "quanto" o "cosa" —
// solo "questo dispositivo ci è arrivato", una volta al mese. Il ciclo
// completo (come questi numeri tornano a migliorare Momentum): l'endpoint
// /stats aggrega "quota di dispositivi attivi che ha agito su ogni tipo di
// consiglio" — un domani, quando esisteranno numeri reali (oggi zero
// traffico, nessun utente distribuito), quella quota può ritarare a mano i
// pesi iniziali di banditSeed() (onboarding-priors.js) per i nuovi
// utenti — stesso meccanismo di "regola aggiornabile pubblicata" già usato
// per le regole fiscali (core/auto-update.js), MAI un pipeline automatico
// che si ritara da solo: sarebbe un modello che decide la propria priorità
// senza revisione umana, il tipo di automazione che questo progetto evita
// deliberatamente altrove (vedi tax-rules.js: le regole SI PROPONGONO,
// non si applicano mai senza conferma).
export const FEATURE_KEYS = [
  'onboarding_completed',
  'first_real_transaction',
  'analysis_tensor_opened',
  'spain_tax_activated',
  'swiss_tax_opened',
  'italy_piva_activated',
  'group_chat_used',
  // Un evento per ogni "kind" di consiglio che il bandit già conosce
  // (advisor.js/advisor-bandit.js) — così /stats può un giorno mostrare
  // quale TIPO di consiglio fa agire di più, in aggregato, mai per singolo
  // utente identificabile.
  'nudge_acted_sweep',
  'nudge_acted_causal',
  'nudge_acted_month-end',
  'nudge_acted_price-hike',
  'nudge_acted_budget-stale',
  'nudge_acted_bnpl-exposure',
  'nudge_acted_es-tax-set-aside',
  'nudge_acted_investment-readiness',
];
const FEATURE_KEY_SET = new Set(FEATURE_KEYS);

export function isTelemetryEnabled(storage = localStorage) {
  return storage.getItem(OPT_IN_KEY) !== '0'; // assente o '1' → attivo di default
}

// true solo alla primissima chiamata di sempre (mai vista prima su questo
// dispositivo): il chiamante la usa per mostrare l'avviso UNA volta sola.
export function needsTelemetryDisclosure(storage = localStorage) {
  return storage.getItem(DISCLOSED_KEY) !== '1';
}
export function markTelemetryDisclosed(storage = localStorage) {
  storage.setItem(DISCLOSED_KEY, '1');
}

export function setTelemetryEnabled(enabled, storage = localStorage) {
  storage.setItem(OPT_IN_KEY, enabled ? '1' : '0');
}

export function getAnonId(storage = localStorage, uuidFn = () => crypto.randomUUID()) {
  let id = storage.getItem(ANON_ID_KEY);
  if (!id) { id = uuidFn(); storage.setItem(ANON_ID_KEY, id); }
  return id;
}

// Al massimo un ping "install" per sempre e uno "active" per mese solare —
// mai più frequente, mai un log dettagliato di utilizzo.
export async function sendTelemetryPings(endpoint, { storage = localStorage, fetchImpl = fetch, now = new Date() } = {}) {
  if (!endpoint || !isTelemetryEnabled(storage)) return { sent: [] };
  const id = getAnonId(storage);
  const sent = [];
  if (storage.getItem(INSTALL_SENT_KEY) !== '1') {
    try {
      await fetchImpl(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, event: 'install' }) });
      storage.setItem(INSTALL_SENT_KEY, '1');
      sent.push('install');
    } catch (_) { /* riprova al prossimo avvio, mai bloccante */ }
  }
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  if (storage.getItem(ACTIVE_MONTH_KEY) !== month) {
    try {
      await fetchImpl(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, event: 'active', month }) });
      storage.setItem(ACTIVE_MONTH_KEY, month);
      sent.push('active');
    } catch (_) { /* riprova al prossimo avvio */ }
  }
  return { sent };
}

// Un evento di funzionalità: idempotente per (chiave, mese) — un secondo
// tocco della stessa pietra miliare nello stesso mese non manda nulla
// (dedup letta da FEATURE_SENT_KEY, un piccolo insieme "chiave:mese" già
// inviati). Chiave fuori dall'elenco chiuso FEATURE_KEYS → no-op silenzioso
// (mai un typo che manda testo libero per errore).
export async function sendFeatureEvent(endpoint, key, { storage = localStorage, fetchImpl = fetch, now = new Date() } = {}) {
  if (!endpoint || !isTelemetryEnabled(storage) || !FEATURE_KEY_SET.has(key)) return { sent: false };
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const dedupKey = `${key}:${month}`;
  let already;
  try { already = new Set(JSON.parse(storage.getItem(FEATURE_SENT_KEY) || '[]')); } catch (_) { already = new Set(); }
  if (already.has(dedupKey)) return { sent: false };
  const id = getAnonId(storage);
  try {
    await fetchImpl(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, event: 'feature', key, month }) });
    already.add(dedupKey);
    storage.setItem(FEATURE_SENT_KEY, JSON.stringify([...already]));
    return { sent: true };
  } catch (_) { return { sent: false }; /* riprova al prossimo tentativo, mai bloccante */ }
}
