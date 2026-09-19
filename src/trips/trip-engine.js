// ============================================================
// TRIP ENGINE — nota spese di trasferta lavorativa, on-device (v1)
// ============================================================
// Diverso dallo split ("Insieme"): lì si DIVIDE una spesa fra persone (cena,
// viaggio con amici). Qui si ACCUMULA per un rimborso da un solo soggetto,
// il datore di lavoro — nessuna divisione, nessun altro membro.
//
// Ricerca reale fatta prima di scrivere codice (SAP Concur, Expensify, Zoho
// Expense, Emburse Certify — recensioni 2026): i problemi che si ripetono
// su TUTTI i prodotti sono la cattura scontrino inaffidabile (crash, upload
// lenti, dati persi), lo split di una spesa fra progetti che richiede
// calcoli manuali, gli export in formati incompatibili con l'ERP
// dell'azienda, e il tempo (71% dei travel & finance manager — chi
// APPROVA le note spese, non genericamente "gli utenti" — impiega 30+
// minuti per UNA nota spese: "The State of Corporate Travel and Expense
// 2026", Skift/Navan, verificato 2026-09-13). On-device risolve
// strutturalmente il primo problema (zero
// upload che può bloccarsi, la foto resta sul device) e il terzo in parte
// (nessuna integrazione cloud fragile da rompere) — ma NON possiamo
// promettere un'integrazione diretta con un ERP che non conosciamo: l'export
// resta un CSV/riepilogo stampabile universale, dichiarato onestamente come
// tale, non un connettore SAP/Oracle.
//
// PRINCIPIO CHIAVE: una spesa di trasferta è un'uscita VERA (il dipendente
// l'ha pagata di tasca sua, in attesa del rimborso) — deve esistere come
// TRANSAZIONE reale nel Vault (VaultDAO.addTransaction), mai in un ledger
// separato scollegato dal resto: altrimenti il budget/cashflow dell'utente
// sarebbe falsato (sembrerebbe che gli avanzino più soldi di quanti gliene
// restino davvero prima del rimborso). Questo file NON tocca il Vault (resta
// puro, nessun DOM/rete) — main.js chiama VaultDAO.addTransaction con un tag
// `businessTripId`, e un "viaggio" qui è solo un FILTRO su quelle
// transazioni, esattamente come lo split-engine fa già con "la tua quota di
// una spesa condivisa diventa una spesa vera categorizzata dall'AI".
// Pure, nessun DOM, nessuna rete.
'use strict';

const round2 = (n) => Math.round((+n + Number.EPSILON) * 100) / 100;

// Le 4 macro-voci standard di QUALUNQUE nota spese aziendale (non le 15
// categorie personali di Momentum, un linguaggio diverso per un documento
// diverso) — l'utente le sceglie esplicitamente per ogni spesa di trasferta,
// indipendenti dalla categoria "vera" della transazione nel Vault (che resta
// quella suggerita dall'ensemble AI, per coerenza col resto dei dati).
export const TRIP_CATEGORIES = ['trasporto', 'vitto', 'alloggio', 'altro'];

// Sotto-tipo pasto (solo per la macro-voce 'vitto') — ricerca reale su
// SAP Concur/policy aziendali standard: molte aziende chiedono di sapere
// SE un pasto era colazione/pranzo/cena (tetti di spesa spesso diversi per
// fascia), non solo "vitto" generico.
export const MEAL_SUBTYPES = ['colazione', 'pranzo', 'cena'];

// GIUSTIFICATIVO MANCANTE — problema reale dal lato AZIENDA, non solo del
// dipendente: chi approva una nota spese la rifiuta o la rimanda indietro
// se manca lo scontrino sopra una certa soglia (policy standard verificata:
// $25 è la soglia più bassa comunemente citata, per la colazione — usarla
// come limite generale è la scelta conservativa, mai più permissiva del
// caso più severo). Segnalarlo SUBITO, prima dell'invio, evita il
// classico va-e-vieni "nota spese rimandata indietro" lamentato ovunque
// nelle recensioni dei prodotti concorrenti.
const SOGLIA_GIUSTIFICATIVO = 25;
export function parseTripAmount(value) {
  const text = String(value ?? '').trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(text)) return null;
  const amount = Number(text.replace(',', '.'));
  return Number.isSafeInteger(Math.round(amount * 100)) ? amount : null;
}

export function needsReceipt(expense, policy) {
  const threshold = typeof policy?.receiptThreshold === 'number' && Number.isFinite(policy.receiptThreshold) && policy.receiptThreshold >= 0
    ? policy.receiptThreshold : SOGLIA_GIUSTIFICATIVO;
  return expense.amount >= threshold && !expense.receiptImage;
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

// Crea un viaggio di lavoro (solo metadati: nome, date indicative, Paese —
// vedi TRACCIABILITÀ PAGAMENTI sotto — e le voci OFFERTE, vedi addOfferedItem
// sotto. Le spese pagate dal dipendente vivono nel Vault, mai duplicate qui).
export function createTrip({ name = 'Trasferta', startDate, endDate, country = null } = {}) {
  return { id: genId(), name, startDate: startDate || null, endDate: endDate || null, country: country || null, createdAt: Date.now(), offeredItems: [] };
}

// ── TRACCIABILITÀ PAGAMENTI (Circolare Agenzia delle Entrate n. 15/E del
// 22/12/2025, testo ufficiale: agenziaentrate.gov.it) ──
// Dal 2025 le spese di trasferta pagate in CONTANTI per vitto, alloggio e
// trasporto (taxi/NCC) sostenute IN ITALIA non sono più deducibili: il
// rimborso diventa reddito imponibile per chi lo riceve. Eccezioni dichiarate
// dalla circolare stessa: (1) biglietti di treno/aereo/bus DI LINEA restano
// deducibili anche in contanti; (2) piccole spese accessorie fino a
// 15,49€/giorno restano deducibili anche in contanti; (3) le trasferte
// ESTERE restano esenti anche in contanti (difficoltà reale di POS in alcuni
// Paesi), TRANNE le spese di rappresentanza (tracciabilità richiesta anche
// all'estero — non gestite qui, vedi limite dichiarato sotto).
//
// LIMITI DICHIARATI (onestà, non un calcolo esatto della norma):
//  - La soglia (2) è applicata QUI per singola spesa, non aggregata per
//    giorno come dice la circolare ("fino a 15,49€/giorno"): sommare le
//    spese accessorie di una giornata richiederebbe sapere quali voci
//    contano come "accessorie", distinzione che la circolare non elenca in
//    modo esaustivo. Può quindi mancare un avviso quando più piccole spese
//    nello stesso giorno superano insieme la soglia pur restando sotto una
//    per una — mai il contrario (mai un falso "va bene" su una spesa singola
//    sopra soglia).
//  - L'eccezione (1) richiede di sapere se il 'trasporto' è un biglietto di
//    linea o una corsa taxi/NCC — TRIP_CATEGORIES non lo distingue ancora
//    (serve un sotto-tipo dedicato, come mealType per 'vitto'). Qui il campo
//    opzionale `transportMode` lo permette (`'pubblico'` = biglietto di
//    linea, sempre esente); se non dichiarato, la scelta è CONSERVATIVA
//    (si avvisa) — mai assumere "è un biglietto di linea" su un dato
//    mancante, l'errore ammesso va sempre nella direzione di avvisare in
//    più, mai di tacere un problema reale.
//  - Le spese di rappresentanza (tracciabili anche all'estero) non sono una
//    categoria distinta in TRIP_CATEGORIES oggi: nessuna trasferta estera
//    genera un avviso, per nessuna categoria — limite dichiarato, non un
//    calcolo che finge di coprirle.
export const SOGLIA_CONTANTI_ACCESSORIE = 15.49;

// La regola vale solo per le trasferte in Italia. Paese non dichiarato →
// nessun avviso: un dato mancante non diventa mai un "sì" o un "no" inventato.
export function isCashTraceabilityRuleApplicable(trip) {
  return !!(trip && trip.country === 'IT');
}

// Un singolo avviso, pensato per essere mostrato SUBITO (stesso principio di
// needsReceipt sopra): mai bloccare il salvataggio della spesa, solo
// dichiarare che quel rimborso rischia di diventare reddito imponibile.
export function expenseNeedsTraceabilityWarning(expense, trip) {
  if (!expense || expense.paymentMethod !== 'contanti') return false;
  if (!isCashTraceabilityRuleApplicable(trip)) return false;
  if (!['vitto', 'alloggio', 'trasporto'].includes(expense.tripCategory)) return false;
  if (!(expense.amount > SOGLIA_CONTANTI_ACCESSORIE)) return false;
  if (expense.tripCategory === 'trasporto' && expense.transportMode === 'pubblico') return false;
  return true;
}

// ── SPAGNA — Real Decreto 439/2007, art. 9.A.3.a) del Reglamento IRPF
// (fonte primaria: sede.agenciatributaria.gob.es, verificato 2026-09-14) ──
// I "gastos de manutención" (vitto) per un autonomo in regime di estimación
// directa richiedono pagamento ELETTRONICO sempre: i contanti sono esclusi
// esplicitamente ("cualquier medio electrónico de pago"), SENZA la soglia
// per piccole spese che esiste in Italia. Diversa anche la portata
// geografica: si applica sia alle trasferte in Spagna sia all'estero (cambia
// solo l'importo massimo deducibile, non SE il contante è ammesso) — quindi
// il segnale giusto non è il Paese della trasferta (come per l'Italia) ma il
// regime fiscale ATTIVO di chi dichiara (VaultDAO.state.taxActiveCountry nel
// chiamante, mai letto qui: modulo puro, nessun accesso al Vault).
//
// LIMITE DICHIARATO: questa funzione segnala SOLO che il pagamento in
// contanti rende la spesa non deducibile — non calcola l'importo massimo
// deducibile (26,67€/53,34€ in Spagna, 48,08€/91,35€ all'estero, secondo
// pernotto sì/no), perché quel calcolo richiede sapere se OGNI notte della
// trasferta è fuori dal proprio comune, un dato che trip-engine.js non
// traccia oggi (vedi ANALISI_COMPETITOR.md, sezione Spagna). Dire "non è
// deducibile" è corretto in ogni caso quando c'è contante; dire "sarebbe
// deducibile fino a X€" richiederebbe quel dato mancante — non lo si inventa.
export function expenseNeedsSpainCashWarning(expense, taxActiveCountry) {
  if (!expense || expense.paymentMethod !== 'contanti') return false;
  if (taxActiveCountry !== 'es') return false;
  return expense.tripCategory === 'vitto';
}

// SPESA "OFFERTA" — ricerca reale (policy standard di trasferta/per diem):
// quando un pasto/alloggio/trasporto è pagato da un cliente, un evento o
// l'azienda stessa (non dal dipendente di tasca propria), va DICHIARATO
// nella nota spese ma MAI rimborsato — i soldi del dipendente non sono mai
// usciti. Diverso da una spesa normale: qui la voce vive SOLO dentro il
// trip (non diventa mai una transazione Vault, perché non è un movimento
// di denaro del dipendente — l'unica eccezione dichiarata al principio
// "ogni spesa è una transazione vera" in testa al file, e per lo stesso
// motivo che lo giustifica: qui i soldi non sono usciti da NESSUNA tasca
// del dipendente, quindi non c'è nulla da tracciare nel suo cashflow).
export function addOfferedItem(trip, { description = '', amount, tripCategory, mealType, date } = {}) {
  const amt = round2(amount);
  if (!(amt >= 0)) throw new Error('importo non valido');
  if (!TRIP_CATEGORIES.includes(tripCategory)) throw new Error('categoria per il rimborso non valida');
  const item = { id: genId(), description, amount: amt, tripCategory, mealType: MEAL_SUBTYPES.includes(mealType) ? mealType : null, date: date || new Date().toISOString().slice(0, 10) };
  return { ...trip, offeredItems: [...(trip.offeredItems || []), item] };
}

export function removeOfferedItem(trip, itemId) {
  return { ...trip, offeredItems: (trip.offeredItems || []).filter(i => i.id !== itemId) };
}

// ── SINCRONIZZAZIONE FRA I PROPRI DISPOSITIVI ──
// Gap reale trovato provando lo scenario "telefono + portatile": le SPESE di
// una trasferta si sincronizzano già da sole, perché sono transazioni vere del
// Vault (è il motivo per cui il principio in testa a questo file vale anche
// qui). Ma la trasferta in sé — nome, date, voci offerte, esito
// dell'approvazione — vive in `businessTrips`, che nessun percorso di sync
// copriva: sull'altro dispositivo le spese comparivano orfane, agganciate a
// una trasferta che lì non esisteva.
//
// Merge senza server e senza un "vincitore" arbitrario (stessa disciplina già
// usata per i gruppi di divisione spese): campo per campo l'ultimo che ha
// scritto vince, le aggiunte si uniscono per id. Deterministico: due
// dispositivi che fondono le stesse due copie, in qualunque ordine, ottengono
// lo stesso risultato — altrimenti due telefoni continuerebbero a
// "correggersi" a vicenda all'infinito.
export function mergeTrips(a, b) {
  if (!a) return b; if (!b) return a;
  if (a.id !== b.id) return a;
  // VITA E MORTE DECISE DA DUE DATE, NON DA UNA LAPIDE DEFINITIVA.
  // Il problema di base è quello di ogni sistema senza server (ed è il motivo
  // per cui esiste `deletedTx` per le transazioni): se cancello una trasferta
  // sul telefono, il portatile che non lo sa me la rimanda indietro alla prima
  // riconnessione, resuscitandola. Una lapide secca lo risolve, ma ne apre
  // altri due: non si può più annullare un errore (una nota spese di mesi
  // cancellata per sbaglio è persa su TUTTI i dispositivi, all'istante), e la
  // lapide resta lì per sempre.
  // Qui la cancellazione è un FATTO DATATO come gli altri: `deletedAt` la
  // spegne, `restoredAt` la riaccende, e vince semplicemente il più recente
  // dei due. Così l'annullamento funziona anche a sincronizzazione avvenuta,
  // e resta comunque impossibile che una copia ignara la resusciti: modificare
  // una trasferta non è ripristinarla, solo un ripristino esplicito conta.
  const morteA = +a.deletedAt || 0, morteB = +b.deletedAt || 0;
  const vitaA = +a.restoredAt || 0, vitaB = +b.restoredAt || 0;
  const morte = Math.max(morteA, morteB);
  const vita = Math.max(vitaA, vitaB);
  if (morte || vita) {
    const base = (morte >= vita ? (morteA >= morteB ? a : b) : (vitaA >= vitaB ? a : b));
    const fuso = { ...base, id: a.id, ...(morte ? { deletedAt: morte } : {}), ...(vita ? { restoredAt: vita } : {}) };
    // Se è viva (ripristinata dopo l'ultima cancellazione) prosegue il merge
    // normale sui contenuti; se è morta ci si ferma qui, non serve altro.
    if (morte >= vita) return fuso;
  }
  const aAt = +a.updatedAt || +a.createdAt || 0;
  const bAt = +b.updatedAt || +b.createdAt || 0;
  const recente = bAt > aAt ? b : a;
  // Le voci offerte sono AGGIUNTE: si uniscono per id, mai si sovrascrivono in
  // blocco — chi ha dichiarato un pranzo offerto sul telefono non deve
  // perderlo perché il portatile aveva una copia più vecchia della trasferta.
  const perId = new Map();
  for (const it of [...(a.offeredItems || []), ...(b.offeredItems || [])]) {
    if (it && it.id) perId.set(it.id, it);
  }
  // L'esito dell'approvazione: vince il più recente, perché un capo può
  // rispondere due volte (prima "serve una modifica", poi "approvata") e
  // l'ultima parola è quella che conta.
  const apA = a.approval, apB = b.approval;
  const tsAp = (x) => (x ? Math.max(+x.reviewedAt || 0, +x.sentAt || 0, +x.invalidatedAt || 0) : -1);
  const approval = tsAp(apB) > tsAp(apA) ? apB : apA;
  return {
    ...recente,
    id: a.id,
    // La data di creazione non cambia mai nel merge: è un fatto accaduto una
    // volta sola, non un campo che si "vince".
    createdAt: Math.min(+a.createdAt || Infinity, +b.createdAt || Infinity) || recente.createdAt,
    updatedAt: Math.max(aAt, bAt) || undefined,
    offeredItems: [...perId.values()].sort((x, y) => String(x.date).localeCompare(String(y.date))),
    ...(approval ? { approval } : {}),
    // Le due date di vita/morte risolte sopra vanno riportate ESPLICITAMENTE:
    // `...recente` potrebbe portarsi dietro solo una delle due (quella della
    // copia che ha vinto sui contenuti), e una trasferta ripristinata che si
    // ritrova senza la sua data di ripristino verrebbe ricancellata al merge
    // successivo dalla prima copia che ha ancora la lapide.
    ...(morte ? { deletedAt: morte } : {}),
    ...(vita ? { restoredAt: vita } : {}),
  };
}

// Viva o cancellata? Una sola regola, usata ovunque: conta l'ultimo fatto
// avvenuto. Senza una funzione unica, ogni punto dell'app riscriverebbe questo
// confronto e prima o poi uno lo scriverebbe al contrario.
export function isTripDeleted(trip) {
  if (!trip) return false;
  const morte = +trip.deletedAt || 0;
  const vita = +trip.restoredAt || 0;
  return morte > 0 && morte >= vita;
}

// Unisce un elenco di trasferte in arrivo con quelle locali (per id).
export function mergeTripLists(locali = [], inArrivo = []) {
  const perId = new Map();
  for (const t of locali) if (t && t.id) perId.set(t.id, t);
  for (const t of inArrivo) {
    if (!t || !t.id) continue;
    perId.set(t.id, perId.has(t.id) ? mergeTrips(perId.get(t.id), t) : t);
  }
  return [...perId.values()];
}

// Marca una trasferta come appena modificata: senza questo timbro il merge non
// saprebbe quale delle due copie è la più recente e finirebbe per tenere a
// caso quella sbagliata.
export function touchTrip(trip) {
  return { ...trip, updatedAt: Date.now() };
}

// Cancella una trasferta lasciando la lapide (vedi mergeTrips). Le SPESE non
// vengono toccate: restano transazioni vere del Vault, come sono sempre state
// — cancellare la nota spese non deve far sparire i soldi che sono usciti
// davvero dal conto. Perdono solo l'aggancio alla trasferta.
export function deleteTrip(trip, now = Date.now()) {
  return { ...trip, deletedAt: now, updatedAt: now };
}

// Annulla la cancellazione. Funziona anche DOPO che la cancellazione è già
// arrivata sugli altri dispositivi: è una data più recente, e vince come
// vincerebbe qualunque altra modifica. Il ripristino di un errore non deve
// dipendere dall'essere stati abbastanza veloci da precedere la sincronizzazione
// — è esattamente quando si è lenti che serve.
export function restoreTrip(trip, now = Date.now()) {
  return { ...trip, restoredAt: now, updatedAt: now };
}

// Le trasferte da mostrare: mai quelle cancellate.
export function visibleTrips(trips = []) {
  return trips.filter(t => t && !isTripDeleted(t));
}

// PULIZIA DELLE LAPIDI. Una lapide serve solo finché esiste un dispositivo che
// non ha ancora saputo della cancellazione: dopo, è peso morto che si porta
// dietro nome e voci offerte per sempre. Si tengono per un periodo generoso
// (un anno, la stessa scelta già fatta per le transazioni in mesh/sync.js:
// pruneTombstones), poi restano solo id e data — abbastanza per continuare a
// respingere una copia vecchissima, senza conservare più i dati.
export function pruneDeletedTrips(trips = [], maxAgeDays = 365, now = Date.now()) {
  const limite = now - maxAgeDays * 24 * 60 * 60 * 1000;
  return trips.map(t => {
    if (!isTripDeleted(t)) return t;
    if (+t.deletedAt > limite) return t;
    return { id: t.id, deletedAt: t.deletedAt, updatedAt: t.updatedAt || t.deletedAt };
  });
}

// Le spese di UN viaggio, filtrate dalle transazioni VERE del Vault (mai un
// secondo elenco): ogni transazione con businessTripId === trip.id.
export function tripExpenses(trip, allTransactions) {
  return allTransactions.filter(t => t.businessTripId === trip.id && t.type === 'uscita');
}

// Bleisure (business + leisure, richiesta esplicita 2026-09-19): una spesa
// pagata durante il periodo della trasferta ma dichiarata PERSONALE (es. il
// weekend extra prima di rientrare) — resta una transazione vera (i soldi
// sono usciti davvero, stesso principio di sempre), ma non entra MAI nel
// totale da rimborsare né nell'export verso l'azienda. Funzione a parte
// (non un filtro in-line ripetuto in ogni punto che oggi fa
// `allTx.filter(tx => tx?.businessTripId === trip.id)`): un solo posto
// dove "cosa conta per il rimborso" è definito, mai due elenchi che possono
// divergere.
export function reimbursableTripExpenses(trip, allTransactions) {
  return tripExpenses(trip, allTransactions).filter(t => !t.tripPersonal);
}

// Totale generale + per macro-voce (trasporto/vitto/alloggio/altro) — quello
// che una nota spese aziendale chiede per prima cosa. Esclude le spese
// personali (bleisure): mai un euro di vacanza extra rimborsato per errore.
export function tripTotals(trip, allTransactions) {
  const expenses = reimbursableTripExpenses(trip, allTransactions);
  const perCategoria = {};
  for (const cat of TRIP_CATEGORIES) perCategoria[cat] = 0;
  let totale = 0;
  for (const t of expenses) {
    const cat = TRIP_CATEGORIES.includes(t.tripCategory) ? t.tripCategory : 'altro';
    perCategoria[cat] = round2(perCategoria[cat] + t.amount);
    totale = round2(totale + t.amount);
  }
  return { totale, perCategoria, numeroSpese: expenses.length };
}

// Totale delle voci OFFERTE — SOLO informativo, mai sommato al "totale da
// rimborsare" (tripTotals sopra): dichiarare che un pranzo è stato offerto
// da un cliente non genera un euro di rimborso in più.
export function tripOfferedTotals(trip) {
  const items = trip.offeredItems || [];
  const perCategoria = {};
  for (const cat of TRIP_CATEGORIES) perCategoria[cat] = 0;
  let totale = 0;
  for (const it of items) {
    perCategoria[it.tripCategory] = round2((perCategoria[it.tripCategory] || 0) + it.amount);
    totale = round2(totale + it.amount);
  }
  return { totale, perCategoria, numeroVoci: items.length };
}

// Dati pronti per l'export (CSV o riepilogo stampabile) — righe ordinate per
// data, mai un formato ERP specifico promesso: un CSV/HTML leggibile
// ovunque, dichiarato come tale (vedi commento in testa al file).
export function exportTripData(trip, allTransactions, { taxActiveCountry = null } = {}) {
  const expenses = [...reimbursableTripExpenses(trip, allTransactions)]
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map(t => ({
      data: t.date,
      categoria: TRIP_CATEGORIES.includes(t.tripCategory) ? t.tripCategory : 'altro',
      mealType: MEAL_SUBTYPES.includes(t.mealType) ? t.mealType : null,
      descrizione: t.description || '',
      importo: t.amount,
      scontrino: t.receiptImage || null,
      giustificativoMancante: needsReceipt(t, trip.receiptPolicy),
      avvisoTracciabilita: expenseNeedsTraceabilityWarning(t, trip),
      avvisoSpagna: expenseNeedsSpainCashWarning(t, taxActiveCountry),
      ...(t.tripRevisionConflict ? { revisionConflict: true } : {}),
    }));
  const offerti = [...(trip.offeredItems || [])]
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map(it => ({ data: it.date, categoria: it.tripCategory, mealType: it.mealType, descrizione: it.description || '', importo: it.amount }));
  const { totale, perCategoria } = tripTotals(trip, allTransactions);
  const offertiTotali = tripOfferedTotals(trip);
  // Ricerca reale (SAP Concur, reclami 2026): il motivo più citato per cui una
  // nota spese torna indietro è un giustificativo mancante scoperto TARDI,
  // durante l'approvazione, riga per riga. Un conteggio in cima al riepilogo
  // (CSV e stampa) lo rende visibile SUBITO a chi approva, prima di scorrere
  // l'intero elenco — mai un blocco, solo un avviso di sintesi.
  const numeroGiustificativiMancanti = expenses.filter(e => e.giustificativoMancante).length;
  // Stesso principio: un conteggio in cima, non scoperto riga per riga —
  // qui per la tracciabilità pagamenti (Circolare 15/E, vedi commento sopra
  // expenseNeedsTraceabilityWarning), non per il giustificativo mancante.
  const numeroAvvisiTracciabilita = expenses.filter(e => e.avvisoTracciabilita).length;
  const numeroAvvisiSpagna = expenses.filter(e => e.avvisoSpagna).length;
  return { policyExceptionReason: trip.receiptPolicy?.exceptionReason || '', tripName: trip.name, startDate: trip.startDate, endDate: trip.endDate, expenses, totale, perCategoria, offerti, offertiTotale: offertiTotali.totale, numeroGiustificativiMancanti, numeroAvvisiTracciabilita, numeroAvvisiSpagna };
}
