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
