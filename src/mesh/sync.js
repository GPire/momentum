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

// ── CANCELLAZIONI (lapidi) ───────────────────────────────────────────────────
// BUG REALE, dimostrato prima di essere corretto: cancellare una spesa sul
// telefono NON bastava. Il tablet ce l'aveva ancora, al sync successivo la
// vedeva "mancante" al telefono e gliela rimandava: la spesa cancellata
// TORNAVA DA SOLA. E' il difetto classico di un'unione per id senza memoria
// delle cancellazioni, e su un'app di soldi e' grave: l'utente cancella un
// doppione, lo ritrova il giorno dopo, e non capisce piu' i suoi conti.
//
// Si risolve ricordando le cancellazioni, non solo eseguendole: ogni id
// cancellato lascia una LAPIDE (id → quando). Le lapidi viaggiano nel sync
// come i dati, quindi la cancellazione fatta su un dispositivo arriva a tutti
// gli altri, in qualunque ordine si sincronizzino.
//
// Stanno in un elenco SEPARATO, non dentro le transazioni: cosi' nessuna delle
// letture esistenti cambia comportamento (l'elenco delle spese resta com'era)
// e non c'e' il rischio di mostrare per sbaglio una spesa cancellata.
//
// LIMITE DICHIARATO: le lapidi si possono potare dopo molto tempo
// (pruneTombstones) per non farle crescere all'infinito. Un dispositivo rimasto
// spento OLTRE quel periodo, e che ha ancora la spesa viva, potrebbe
// reintrodurla al primo sync. Per questo il periodo di default e' lungo (un
// anno): oltre, e' piu' onesto un ripristino da backup che un sync.
const TOMBSTONE_KEY = '__deleted'; // nel digest: non e' un mese, non collide mai

export function markDeleted(tombstones = {}, id, now = Date.now()) {
  return { ...tombstones, [String(id)]: now };
}

// Toglie le lapidi piu' vecchie di `maxAgeDays`. Ritorna un nuovo oggetto.
export function pruneTombstones(tombstones = {}, maxAgeDays = 365, now = Date.now()) {
  const limite = now - maxAgeDays * 86400000;
  const out = {};
  for (const [id, ts] of Object.entries(tombstones)) if (+ts >= limite) out[id] = +ts;
  return out;
}

// Digest compatto: per ogni mese, la lista di { id, hash }. Piccolo da
// scambiare (niente importi/descrizioni), sufficiente a capire cosa manca.
// Include anche le lapidi, altrimenti il peer non puo' sapere che una spesa
// e' stata cancellata e continuerebbe a rimandarcela.
export function computeSyncDigest(transactions, tombstones = {}) {
  const digest = {};
  for (const [month, list] of Object.entries(transactions || {})) {
    digest[month] = (list || []).map(t => ({ id: t.id, hash: t.hash }));
  }
  if (tombstones && Object.keys(tombstones).length) digest[TOMBSTONE_KEY] = { ...tombstones };
  return digest;
}

// Le lapidi conosciute dal peer, leggendo il suo digest. Tollera i digest dei
// dispositivi con una versione precedente (che non le hanno affatto).
export function tombstonesFromDigest(peerDigest) {
  const t = peerDigest && peerDigest[TOMBSTONE_KEY];
  return (t && typeof t === 'object' && !Array.isArray(t)) ? t : {};
}

// Dato il MIO insieme di transazioni e il DIGEST del peer, cosa mandargli:
// le transazioni che non ha, e le lapidi che non conosce. Non gli si mandano
// MAI transazioni che lui ha gia' cancellato: sarebbe farle risorgere da capo.
export function transactionsMissingFromPeer(myTransactions, peerDigest, myTombstones = {}) {
  const peerIds = new Set();
  for (const [k, list] of Object.entries(peerDigest || {})) {
    if (k === TOMBSTONE_KEY) continue;
    for (const e of (list || [])) peerIds.add(String(e.id));
  }
  const peerTomb = tombstonesFromDigest(peerDigest);
  const toSend = {};
  for (const [month, list] of Object.entries(myTransactions || {})) {
    const missing = (list || []).filter(t => !peerIds.has(String(t.id)) && !(String(t.id) in peerTomb));
    if (missing.length) toSend[month] = missing;
  }
  // Lapidi che il peer non ha ancora (comprese quelle su spese che lui ha
  // ancora vive: sono proprio quelle che devono raggiungerlo).
  const nuove = {};
  for (const [id, ts] of Object.entries(myTombstones || {})) if (!(id in peerTomb)) nuove[id] = +ts;
  if (Object.keys(nuove).length) toSend[TOMBSTONE_KEY] = nuove;
  return toSend;
}

// Merge deterministico: aggiunge le transazioni in arrivo che non sono già
// presenti (per id); NON tocca quelle esistenti (hash chain intatta) e non
// resuscita quelle cancellate. Applica anche le lapidi ricevute, togliendo le
// spese corrispondenti. Ritorna { merged, added, skipped, tombstones, removed }.
// Order-independent: A.merge(B) e B.merge(A) convergono allo stesso stato.
export function mergeTransactions(localTransactions, incomingByMonth, localTombstones = {}) {
  const merged = {};
  for (const [m, list] of Object.entries(localTransactions || {})) merged[m] = [...list];
  let added = 0, skipped = 0, removed = 0;

  // Le lapidi (mie + ricevute) si applicano PRIMA di aggiungere: una spesa
  // cancellata non deve rientrare nemmeno per un istante.
  const tombstones = { ...(localTombstones || {}) };
  for (const [id, ts] of Object.entries(tombstonesFromDigest(incomingByMonth))) {
    if (!(id in tombstones) || +ts < tombstones[id]) tombstones[id] = +ts;
  }

  for (const [month, incoming] of Object.entries(incomingByMonth || {})) {
    if (month === TOMBSTONE_KEY) continue;
    if (!merged[month]) merged[month] = [];
    const known = new Set(merged[month].map(t => String(t.id)));
    for (const tx of incoming) {
      const id = String(tx.id);
      if (id in tombstones) { skipped++; continue; } // cancellata: non risorge
      if (known.has(id)) { skipped++; continue; }
      merged[month].push(tx);        // arriva col SUO hash/prevHash — non ricalcolato
      known.add(id);
      added++;
    }
    // ordine stabile per data → viste identiche su ogni device
    merged[month].sort((a, b) => new Date(a.date) - new Date(b.date) || String(a.id).localeCompare(String(b.id)));
  }

  // Applica le lapidi anche a cio' che era gia' qui: e' cosi' che una
  // cancellazione fatta sull'altro dispositivo arriva davvero fin qui.
  for (const month of Object.keys(merged)) {
    const prima = merged[month].length;
    merged[month] = merged[month].filter(t => !(String(t.id) in tombstones));
    removed += prima - merged[month].length;
  }
  return { merged, added, skipped, tombstones, removed };
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
export function planSync(myTransactions, peerDigest, myTombstones = {}) {
  const toSend = transactionsMissingFromPeer(myTransactions, peerDigest, myTombstones);
  const count = Object.entries(toSend).reduce((s, [k, l]) => s + (k === TOMBSTONE_KEY ? 0 : l.length), 0);
  const cancellazioni = Object.keys(toSend[TOMBSTONE_KEY] || {}).length;
  const parti = [];
  if (count) parti.push(`${count} transazioni`);
  if (cancellazioni) parti.push(`${cancellazioni} cancellazioni`);
  return {
    toSend, count, deletions: cancellazioni,
    note: parti.length ? `Da inviare: ${parti.join(' e ')} (solo le differenze).` : 'Già sincronizzati.',
  };
}
