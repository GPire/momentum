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
// dell'azienda, e il tempo (71% degli utenti impiega 30+ minuti per UNA
// nota spese). On-device risolve strutturalmente il primo problema (zero
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
export function needsReceipt(expense) {
  return expense.amount >= SOGLIA_GIUSTIFICATIVO && !expense.receiptImage;
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

// Crea un viaggio di lavoro (solo metadati: nome, date indicative, e le
// voci OFFERTE — vedi addOfferedItem sotto. Le spese pagate dal dipendente
// vivono nel Vault, mai duplicate qui).
export function createTrip({ name = 'Trasferta', startDate, endDate } = {}) {
  return { id: genId(), name, startDate: startDate || null, endDate: endDate || null, createdAt: Date.now(), offeredItems: [] };
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

// Le spese di UN viaggio, filtrate dalle transazioni VERE del Vault (mai un
// secondo elenco): ogni transazione con businessTripId === trip.id.
export function tripExpenses(trip, allTransactions) {
  return allTransactions.filter(t => t.businessTripId === trip.id && t.type === 'uscita');
}

// Totale generale + per macro-voce (trasporto/vitto/alloggio/altro) — quello
// che una nota spese aziendale chiede per prima cosa.
export function tripTotals(trip, allTransactions) {
  const expenses = tripExpenses(trip, allTransactions);
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
export function exportTripData(trip, allTransactions) {
  const expenses = [...tripExpenses(trip, allTransactions)]
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map(t => ({
      data: t.date,
      categoria: TRIP_CATEGORIES.includes(t.tripCategory) ? t.tripCategory : 'altro',
      mealType: MEAL_SUBTYPES.includes(t.mealType) ? t.mealType : null,
      descrizione: t.description || '',
      importo: t.amount,
      scontrino: t.receiptImage || null,
      giustificativoMancante: needsReceipt(t),
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
  return { tripName: trip.name, startDate: trip.startDate, endDate: trip.endDate, expenses, totale, perCategoria, offerti, offertiTotale: offertiTotali.totale, numeroGiustificativiMancanti };
}
