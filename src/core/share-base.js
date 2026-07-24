// ============================================================
// SHARE-BASE — la base dei link Momentum, presa in automatico e resiliente
// ============================================================
// Un link condiviso (invito al gruppo, "vedi la tua parte") deve funzionare
// anche se domani Momentum vive su un host/server/dominio DIVERSO da oggi. Due
// livelli, stessa filosofia di update-locator/discovery-memory:
//   1. RICONOSCIMENTO (già in split-engine.extractSharePayload): il payload si
//      riconosce per CONTENUTO (marcatore MSPLIT1:), da qualunque dominio → un
//      link vecchio, incollato in QUALSIASI istanza Momentum viva, funziona.
//   2. GENERAZIONE (qui): la base del link non è cablata su location.origin, ma
//      RISOLTA in modo intelligente — una base canonica stabile se conosciuta,
//      altrimenti l'origine che l'app ha imparato essere più stabile (vista più
//      volte), altrimenti quella corrente. L'app IMPARA le origini a ogni avvio
//      (recordOrigin), così più è usata su un dominio stabile più i link ci
//      puntano — sopravvivendo a mirror/host effimeri.
// Onesto: nessun link può resuscitare un dominio spento (è DNS, non codice), ma
// il payload auto-contenuto + il riconoscimento per contenuto rendono il link
// utilizzabile ovunque ci sia un Momentum vivo. Funzioni pure (l'origine e lo
// stato si passano da fuori), nessun DOM.
'use strict';

// Base canonica PUBBLICA di Momentum, quando esiste un dominio stabile ufficiale.
// Vuota = si risolve dinamicamente (sotto). Impostabile al deploy o dall'utente
// (state.shareBase) senza toccare il codice. Deve finire SENZA slash.
export const MOMENTUM_CANONICAL_BASE = '';

const stripTrailingSlash = (s) => String(s || '').replace(/\/+$/, '');
const isHttpOrigin = (s) => /^https?:\/\/[^/]+/i.test(String(s || ''));

// Normalizza un valore a un'origine http(s) pulita ("https://host[:porta]"),
// o null se non è un'origine valida. Tollera che passino un URL intero.
export function normalizeOrigin(value) {
  const v = String(value || '').trim();
  if (!v) return null;
  try {
    if (isHttpOrigin(v)) return stripTrailingSlash(new URL(v).origin);
  } catch (_) { /* non parsabile */ }
  return null;
}

// Impara un'origine vista (a ogni avvio dell'app): conta le occorrenze e tiene
// l'ultima vista. Ritorna il nuovo stato `shareOrigins` (mai muta l'input).
// Struttura: { [origin]: { count, last } }. Serve a capire quale dominio è
// quello "vero e stabile" dell'utente vs un mirror occasionale.
export function recordOrigin(shareOrigins = {}, origin, now = Date.now()) {
  const o = normalizeOrigin(origin);
  if (!o) return shareOrigins || {};
  const cur = shareOrigins[o] || { count: 0, last: 0 };
  return { ...shareOrigins, [o]: { count: cur.count + 1, last: now } };
}

// Risolve la BASE da usare per generare un link, in ordine di priorità:
//  1. override esplicito dell'utente/deploy (state.shareBase) o la costante
//     canonica → base stabile, indipendente da dove gira ORA l'app;
//  2. l'origine imparata più STABILE (vista più volte; a parità, la più
//     recente) — così i link puntano al dominio abituale dell'utente;
//  3. l'origine corrente (fallback sempre valido).
// currentOrigin va passata da fuori (in app: location.origin).
export function resolveShareBase(state = {}, currentOrigin = '') {
  const explicit = normalizeOrigin(state && state.shareBase) || normalizeOrigin(MOMENTUM_CANONICAL_BASE);
  if (explicit) return explicit;
  const seen = (state && state.shareOrigins) || {};
  const entries = Object.entries(seen).map(([origin, s]) => ({ origin, count: s.count || 0, last: s.last || 0 }));
  if (entries.length) {
    entries.sort((a, b) => b.count - a.count || b.last - a.last);
    // Usa l'origine imparata solo se ha un minimo di stabilità (≥2 avvii) o se
    // non c'è un'origine corrente valida; altrimenti preferisci quella corrente.
    const best = entries[0];
    const cur = normalizeOrigin(currentOrigin);
    if (!cur || best.count >= 2) return best.origin;
  }
  return normalizeOrigin(currentOrigin) || stripTrailingSlash(currentOrigin) || '';
}

// Costruisce il link "unisciti/vedi" completo a partire dalla base risolta e dal
// codice condivisione (MSPLIT1:...). path = pathname corrente (default "/").
export function buildShareUrl(state, currentOrigin, code, pathname = '/') {
  const base = resolveShareBase(state, currentOrigin);
  const path = String(pathname || '/').replace(/index\.html$/, '') || '/';
  return `${base}${path.startsWith('/') ? path : '/' + path}?join=${encodeURIComponent(code)}`.replace(/([^:])\/\/+/g, '$1/');
}
