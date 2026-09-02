// ============================================================
// FUSIONE DEI DATI UTENTE FRA I PROPRI DISPOSITIVI (generica)
// ============================================================
// Ogni volta che un campo del vault non si sincronizzava, il difetto era lo
// stesso: le transazioni arrivavano e il loro contorno no. È già successo con
// le trasferte (le spese c'erano, il viaggio no) e con le categorie
// personalizzate (la spesa c'era, la categoria diventava un "Altro" grigio).
// Invece di riscrivere lo stesso merge per ogni campo — e sbagliarlo in modo
// diverso ogni volta — qui c'è una volta sola, e ogni campo dice solo QUAL È
// LA SUA CHIAVE.
//
// Le regole, identiche a quelle già collaudate per gruppi e trasferte:
//  - unione per chiave, mai sostituzione in blocco di una lista;
//  - campo per campo vince chi ha scritto per ultimo (updatedAt);
//  - la cancellazione è una data che si confronta (deletedAt/restoredAt), non
//    una sparizione: un dispositivo rimasto indietro non resuscita ciò che è
//    stato cancellato, ma un ripristino più recente vince comunque.
//
// Funzioni pure: nessun DOM, nessuna rete.
'use strict';

export function isDeleted(voce) {
  const morte = +voce?.deletedAt || 0;
  const vita = +voce?.restoredAt || 0;
  return morte > 0 && morte >= vita;
}

export function touch(voce, now = Date.now()) {
  return { ...voce, updatedAt: now };
}

export function markDeleted(voce, now = Date.now()) {
  return { ...voce, deletedAt: now, updatedAt: now };
}

export function markRestored(voce, now = Date.now()) {
  return { ...voce, restoredAt: now, updatedAt: now };
}

export function mergePair(a, b) {
  if (!a) return b; if (!b) return a;
  const morte = Math.max(+a.deletedAt || 0, +b.deletedAt || 0);
  const vita = Math.max(+a.restoredAt || 0, +b.restoredAt || 0);
  const aAt = +a.updatedAt || 0, bAt = +b.updatedAt || 0;
  const recente = bAt > aAt ? b : a;
  return {
    ...recente,
    updatedAt: Math.max(aAt, bAt) || undefined,
    ...(morte ? { deletedAt: morte } : {}),
    ...(vita ? { restoredAt: vita } : {}),
  };
}

// `chiave` estrae l'identità di una voce. Per i dati che hanno un id vero si
// passa `v => v.id`; per quelli che non ce l'hanno (gli abbonamenti sono
// `{name, amount, ...}` senza id) si passa una chiave NATURALE — l'importante
// è che sia stabile: se cambia, la stessa voce diventa due voci.
export function mergeList(locali = [], inArrivo = [], chiave = (v) => v?.id) {
  const perChiave = new Map();
  const aggiungi = (voce) => {
    if (!voce) return;
    const k = chiave(voce);
    if (k === undefined || k === null || k === '') return;
    perChiave.set(k, perChiave.has(k) ? mergePair(perChiave.get(k), voce) : voce);
  };
  for (const v of locali) aggiungi(v);
  for (const v of inArrivo) aggiungi(v);
  return [...perChiave.values()];
}

export function visible(lista = []) {
  return lista.filter(v => v && !isDeleted(v));
}

// Chiave naturale di un abbonamento: nome (normalizzato) + importo. Due
// dispositivi che rilevano lo stesso Netflix da 12,99 devono vedere UN
// abbonamento, non due; ma Netflix a 12,99 e Netflix a 17,99 (piano cambiato,
// registrato prima che l'altro dispositivo lo sapesse) restano due voci
// distinte, ed è giusto: è chi guarda a decidere quale tenere, non noi.
export function chiaveAbbonamento(s) {
  const nome = String(s?.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const importo = Math.round((+s?.amount || 0) * 100);
  if (!nome) return null;
  return `${nome}|${importo}`;
}

// VALORE SINGOLO (non una lista): il budget mensile è un numero solo, e due
// dispositivi possono averlo cambiato entrambi. Vince l'ultimo, ma serve una
// data: senza, "l'ultimo" sarebbe semplicemente l'ultimo che si è collegato —
// cioè il caso, non la volontà di chi ha deciso.
export function mergeScalar(localeValore, localeAt, remotoValore, remotoAt) {
  const lAt = +localeAt || 0, rAt = +remotoAt || 0;
  if (remotoValore === undefined || remotoValore === null) return { valore: localeValore, at: lAt || undefined };
  if (localeValore === undefined || localeValore === null) return { valore: remotoValore, at: rAt || undefined };
  return rAt > lAt ? { valore: remotoValore, at: rAt } : { valore: localeValore, at: lAt || undefined };
}
