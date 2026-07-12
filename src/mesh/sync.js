// ============================================================
// SYNC DIFFERENZIALE — stessi dati su più device + recupero da perdita
// ============================================================
// La paura numero uno dell'utente: "e se perdo il telefono?" e "voglio gli
// stessi dati sul tablet". Soluzione onesta, senza server: sync tra i PROPRI
// device fidati (pairing esplicito, mesh già esistente), scambiando solo i
// DELTA e cifrando E2E (via core/backup.js quando si trasmette).
//
// Proprietà d'ingegneria (perché è intelligente e ottimizzato):
//  - OTTIMIZZATO: prima si scambiano DIGEST compatti (id+hash per mese), poi
//    SOLO le transazioni mancanti — non l'intero dataset.
//  - DETERMINISTICO / order-independent (stile CRDT): il merge è una UNIONE
//    per id; converge allo stesso stato su tutti i device qualunque sia
//    l'ordine di sync. Nessun conflitto sulle tx esistenti.
//  - INTEGRO: non riscrive MAI amount/category/hash/prevHash di una tx già
//    presente (la hash chain resta valida). Una tx nuova arriva col suo hash.
//  - RECUPERO: device nuovo = merge da stato vuoto → ripristino completo.
// Funzioni PURE (nessun DOM/IndexedDB): testabili, riusabili nel worker.
'use strict';

// Digest compatto: per ogni mese, la lista di { id, hash }. Piccolo da
// scambiare (niente importi/descrizioni), sufficiente a capire cosa manca.
export function computeSyncDigest(transactions) {
  const digest = {};
  for (const [month, list] of Object.entries(transactions || {})) {
    digest[month] = (list || []).map(t => ({ id: t.id, hash: t.hash }));
  }
  return digest;
}

// Dato il MIO insieme di transazioni e il DIGEST del peer, quali transazioni
// il peer NON ha (da inviargli). Confronto per id.
export function transactionsMissingFromPeer(myTransactions, peerDigest) {
  const peerIds = new Set();
  for (const list of Object.values(peerDigest || {})) for (const e of list) peerIds.add(String(e.id));
  const toSend = {};
  for (const [month, list] of Object.entries(myTransactions || {})) {
    const missing = (list || []).filter(t => !peerIds.has(String(t.id)));
    if (missing.length) toSend[month] = missing;
  }
  return toSend;
}

// Merge deterministico: aggiunge le transazioni in arrivo che non sono già
// presenti (per id); NON tocca quelle esistenti (hash chain intatta). Ritorna
// { merged, added, skipped }. Order-independent: A.merge(B) e B.merge(A)
// convergono allo stesso set.
export function mergeTransactions(localTransactions, incomingByMonth) {
  const merged = {};
  for (const [m, list] of Object.entries(localTransactions || {})) merged[m] = [...list];
  let added = 0, skipped = 0;

  for (const [month, incoming] of Object.entries(incomingByMonth || {})) {
    if (!merged[month]) merged[month] = [];
    const known = new Set(merged[month].map(t => String(t.id)));
    for (const tx of incoming) {
      if (known.has(String(tx.id))) { skipped++; continue; }
      merged[month].push(tx);        // arriva col SUO hash/prevHash — non ricalcolato
      known.add(String(tx.id));
      added++;
    }
    // ordine stabile per data → viste identiche su ogni device
    merged[month].sort((a, b) => new Date(a.date) - new Date(b.date) || String(a.id).localeCompare(String(b.id)));
  }
  return { merged, added, skipped };
}

// Riconcilia i lastHash: dopo un merge, lastHash è quello della tx più recente
// per data nell'intero stato (la hash chain locale resta valida per costruzione,
// ma il "puntatore" di testa va aggiornato per le NUOVE tx locali future).
export function reconcileHead(mergedTransactions) {
  let latest = null;
  for (const list of Object.values(mergedTransactions || {})) {
    for (const t of list) if (!latest || new Date(t.date) > new Date(latest.date)) latest = t;
  }
  return latest ? latest.hash : 'GENESIS';
}

// Piano di sync completo tra due device (per la UI/mesh): cosa inviare e una
// stima del "costo" (quante tx viaggiano) — così si vede che è un DELTA.
export function planSync(myTransactions, peerDigest) {
  const toSend = transactionsMissingFromPeer(myTransactions, peerDigest);
  const count = Object.values(toSend).reduce((s, l) => s + l.length, 0);
  return { toSend, count, note: count === 0 ? 'Già sincronizzati.' : `Da inviare: ${count} transazioni (solo le mancanti).` };
}
