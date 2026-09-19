import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrip, tripExpenses, tripTotals, exportTripData, TRIP_CATEGORIES, addOfferedItem, removeOfferedItem, tripOfferedTotals, MEAL_SUBTYPES, needsReceipt, isCashTraceabilityRuleApplicable, expenseNeedsTraceabilityWarning, SOGLIA_CONTANTI_ACCESSORIE, expenseNeedsSpainCashWarning } from './trip-engine.js';

// ── TRACCIABILITÀ PAGAMENTI TRASFERTA (Circolare Agenzia delle Entrate
// n. 15/E del 22/12/2025): spese di trasferta in ITALIA pagate in contanti
// non sono più deducibili per vitto/alloggio/trasporto, salvo biglietti di
// trasporto pubblico e piccole spese accessorie fino a 15,49€ ──

test('isCashTraceabilityRuleApplicable: trasferta in Italia → true', () => {
  assert.equal(isCashTraceabilityRuleApplicable({ country: 'IT' }), true);
});

test('isCashTraceabilityRuleApplicable: trasferta estera → false (la circolare esenta l\'estero)', () => {
  assert.equal(isCashTraceabilityRuleApplicable({ country: 'ES' }), false);
});

test('isCashTraceabilityRuleApplicable: Paese non dichiarato → false, mai un\'assunzione senza dato', () => {
  assert.equal(isCashTraceabilityRuleApplicable({ country: null }), false);
  assert.equal(isCashTraceabilityRuleApplicable(null), false);
});

test('expenseNeedsTraceabilityWarning: contanti + Italia + vitto sopra soglia → avviso', () => {
  const trip = { country: 'IT' };
  assert.equal(expenseNeedsTraceabilityWarning({ paymentMethod: 'contanti', amount: 40, tripCategory: 'vitto' }, trip), true);
});

test('expenseNeedsTraceabilityWarning: contanti + Italia + alloggio sopra soglia → avviso', () => {
  const trip = { country: 'IT' };
  assert.equal(expenseNeedsTraceabilityWarning({ paymentMethod: 'contanti', amount: 90, tripCategory: 'alloggio' }, trip), true);
});

test('expenseNeedsTraceabilityWarning: pagamento tracciabile (carta) → mai un avviso, qualunque importo/categoria', () => {
  const trip = { country: 'IT' };
  assert.equal(expenseNeedsTraceabilityWarning({ paymentMethod: 'carta', amount: 90, tripCategory: 'vitto' }, trip), false);
});

test('expenseNeedsTraceabilityWarning: metodo di pagamento non dichiarato → nessun avviso, mai un dato inventato', () => {
  const trip = { country: 'IT' };
  assert.equal(expenseNeedsTraceabilityWarning({ amount: 90, tripCategory: 'vitto' }, trip), false);
});

test('expenseNeedsTraceabilityWarning: trasferta estera, anche in contanti → mai un avviso (eccezione dichiarata dalla circolare)', () => {
  const trip = { country: 'ES' };
  assert.equal(expenseNeedsTraceabilityWarning({ paymentMethod: 'contanti', amount: 90, tripCategory: 'vitto' }, trip), false);
});

test('expenseNeedsTraceabilityWarning: piccola spesa accessoria fino a 15,49€ → mai un avviso', () => {
  const trip = { country: 'IT' };
  assert.equal(expenseNeedsTraceabilityWarning({ paymentMethod: 'contanti', amount: SOGLIA_CONTANTI_ACCESSORIE, tripCategory: 'vitto' }, trip), false);
  assert.equal(expenseNeedsTraceabilityWarning({ paymentMethod: 'contanti', amount: 15.50, tripCategory: 'vitto' }, trip), true);
});

test('expenseNeedsTraceabilityWarning: biglietto di trasporto pubblico in contanti → mai un avviso (eccezione esplicita della circolare)', () => {
  const trip = { country: 'IT' };
  assert.equal(expenseNeedsTraceabilityWarning({ paymentMethod: 'contanti', amount: 90, tripCategory: 'trasporto', transportMode: 'pubblico' }, trip), false);
});

test('expenseNeedsTraceabilityWarning: trasporto in contanti SENZA transportMode dichiarato → avviso conservativo (mai assumere "va bene" su un dato mancante)', () => {
  const trip = { country: 'IT' };
  assert.equal(expenseNeedsTraceabilityWarning({ paymentMethod: 'contanti', amount: 90, tripCategory: 'trasporto' }, trip), true);
});

test('expenseNeedsTraceabilityWarning: categoria "altro" → nessun avviso, la circolare copre solo vitto/alloggio/trasporto', () => {
  const trip = { country: 'IT' };
  assert.equal(expenseNeedsTraceabilityWarning({ paymentMethod: 'contanti', amount: 90, tripCategory: 'altro' }, trip), false);
});

// ── SPAGNA — Real Decreto 439/2007, art. 9.A.3.a): "gastos de manutención"
// (vitto) in contanti mai deducibili, nessuna soglia, indipendente dalla
// destinazione della trasferta (dipende da chi dichiara in Spagna) ──

test('expenseNeedsSpainCashWarning: contanti + vitto + regime fiscale attivo ES → avviso', () => {
  assert.equal(expenseNeedsSpainCashWarning({ paymentMethod: 'contanti', tripCategory: 'vitto' }, 'es'), true);
});

test('expenseNeedsSpainCashWarning: nessuna soglia di importo, a differenza dell\'Italia — anche 1 centesimo in contanti scatta', () => {
  assert.equal(expenseNeedsSpainCashWarning({ paymentMethod: 'contanti', tripCategory: 'vitto', amount: 0.5 }, 'es'), true);
});

test('expenseNeedsSpainCashWarning: pagamento tracciabile → mai un avviso', () => {
  assert.equal(expenseNeedsSpainCashWarning({ paymentMethod: 'carta', tripCategory: 'vitto' }, 'es'), false);
});

test('expenseNeedsSpainCashWarning: regime fiscale attivo diverso da ES → nessun avviso (la regola vale per chi dichiara in Spagna)', () => {
  assert.equal(expenseNeedsSpainCashWarning({ paymentMethod: 'contanti', tripCategory: 'vitto' }, 'it'), false);
  assert.equal(expenseNeedsSpainCashWarning({ paymentMethod: 'contanti', tripCategory: 'vitto' }, null), false);
});

test('expenseNeedsSpainCashWarning: si applica indipendentemente dal Paese della trasferta (vale anche fuori Spagna, a differenza dell\'Italia)', () => {
  assert.equal(expenseNeedsSpainCashWarning({ paymentMethod: 'contanti', tripCategory: 'vitto', tripCountry: 'DE' }, 'es'), true);
});

test('expenseNeedsSpainCashWarning: categoria diversa da vitto (alloggio/trasporto/altro) → nessun avviso, la norma qui copre solo manutención', () => {
  assert.equal(expenseNeedsSpainCashWarning({ paymentMethod: 'contanti', tripCategory: 'alloggio' }, 'es'), false);
  assert.equal(expenseNeedsSpainCashWarning({ paymentMethod: 'contanti', tripCategory: 'trasporto' }, 'es'), false);
});

// ── GIUSTIFICATIVO MANCANTE (problema lato azienda: nota spese rifiutata
// se manca lo scontrino sopra soglia) ──

test('needsReceipt: sopra soglia senza scontrino → true', () => {
  assert.equal(needsReceipt({ amount: 30 }), true);
});

test('needsReceipt: sopra soglia CON scontrino → false', () => {
  assert.equal(needsReceipt({ amount: 30, receiptImage: 'data:image/jpeg;base64,AAA' }), false);
});

test('needsReceipt: sotto soglia, con o senza scontrino → sempre false (nessuna policy lo richiederebbe)', () => {
  assert.equal(needsReceipt({ amount: 10 }), false);
  assert.equal(needsReceipt({ amount: 10, receiptImage: 'x' }), false);
});

test('needsReceipt: esattamente alla soglia → true (>=, non solo >)', () => {
  assert.equal(needsReceipt({ amount: 25 }), true);
});

test('createTrip: genera un id univoco e conserva nome/date', () => {
  const t1 = createTrip({ name: 'Milano', startDate: '2026-09-10', endDate: '2026-09-12' });
  const t2 = createTrip({ name: 'Roma' });
  assert.notEqual(t1.id, t2.id);
  assert.equal(t1.name, 'Milano');
  assert.equal(t2.startDate, null);
});

test('tripExpenses: filtra SOLO le transazioni di quel viaggio, ignora le altre e le entrate', () => {
  const trip = createTrip({ name: 'Milano' });
  const altro = createTrip({ name: 'Roma' });
  const tx = [
    { id: 1, type: 'uscita', amount: 20, businessTripId: trip.id, tripCategory: 'trasporto' },
    { id: 2, type: 'uscita', amount: 15, businessTripId: altro.id, tripCategory: 'vitto' }, // altro viaggio
    { id: 3, type: 'uscita', amount: 10 }, // spesa personale, nessun trip
    { id: 4, type: 'entrata', amount: 500, businessTripId: trip.id }, // il rimborso stesso, mai contato come spesa
  ];
  const risultato = tripExpenses(trip, tx);
  assert.equal(risultato.length, 1);
  assert.equal(risultato[0].id, 1);
});

test('tripTotals: somma per macro-voce e totale generale, categoria mancante o sconosciuta ricade su "altro"', () => {
  const trip = createTrip({ name: 'Milano' });
  const tx = [
    { type: 'uscita', amount: 45, businessTripId: trip.id, tripCategory: 'trasporto' },
    { type: 'uscita', amount: 30, businessTripId: trip.id, tripCategory: 'vitto' },
    { type: 'uscita', amount: 12, businessTripId: trip.id, tripCategory: 'vitto' },
    { type: 'uscita', amount: 5, businessTripId: trip.id }, // categoria trip mai assegnata
    { type: 'uscita', amount: 8, businessTripId: trip.id, tripCategory: 'categoria-inventata' }, // valore non valido
  ];
  const { totale, perCategoria, numeroSpese } = tripTotals(trip, tx);
  assert.equal(totale, 100);
  assert.equal(perCategoria.trasporto, 45);
  assert.equal(perCategoria.vitto, 42);
  assert.equal(perCategoria.altro, 13); // 5 + 8, entrambe ricadute qui onestamente
  assert.equal(perCategoria.alloggio, 0);
  assert.equal(numeroSpese, 5);
});

test('tripTotals: viaggio senza spese → tutto zero, mai un crash', () => {
  const trip = createTrip({ name: 'Vuoto' });
  const { totale, perCategoria, numeroSpese } = tripTotals(trip, []);
  assert.equal(totale, 0);
  assert.equal(numeroSpese, 0);
  for (const cat of TRIP_CATEGORIES) assert.equal(perCategoria[cat], 0);
});

test('exportTripData: righe ordinate per data, con scontrino quando presente', () => {
  const trip = createTrip({ name: 'Milano', startDate: '2026-09-10', endDate: '2026-09-12' });
  const tx = [
    { type: 'uscita', amount: 30, date: '2026-09-11', description: 'Cena', businessTripId: trip.id, tripCategory: 'vitto', receiptImage: 'data:image/jpeg;base64,AAA' },
    { type: 'uscita', amount: 45, date: '2026-09-10', description: 'Treno', businessTripId: trip.id, tripCategory: 'trasporto' },
  ];
  const out = exportTripData(trip, tx);
  assert.equal(out.tripName, 'Milano');
  assert.equal(out.expenses.length, 2);
  assert.equal(out.expenses[0].descrizione, 'Treno'); // 10 settembre prima dell'11
  assert.equal(out.expenses[1].scontrino, 'data:image/jpeg;base64,AAA');
  assert.equal(out.expenses[0].scontrino, null);
  assert.equal(out.totale, 75);
  assert.equal(out.numeroGiustificativiMancanti, 1); // solo "Treno", "Cena" ha lo scontrino
});

test('exportTripData: numeroGiustificativiMancanti conta tutte le spese sopra soglia senza scontrino, zero se nessuna', () => {
  const trip = createTrip({ name: 'Roma' });
  const nessunGiustificativo = exportTripData(trip, [
    { type: 'uscita', amount: 30, date: '2026-09-10', businessTripId: trip.id, tripCategory: 'vitto' },
    { type: 'uscita', amount: 40, date: '2026-09-11', businessTripId: trip.id, tripCategory: 'trasporto' },
  ]);
  assert.equal(nessunGiustificativo.numeroGiustificativiMancanti, 2);

  const tuttoAPosto = exportTripData(trip, [
    { type: 'uscita', amount: 10, date: '2026-09-10', businessTripId: trip.id, tripCategory: 'vitto' }, // sotto soglia
  ]);
  assert.equal(tuttoAPosto.numeroGiustificativiMancanti, 0);
});

test('exportTripData: numeroAvvisiTracciabilita conta le spese in contanti a rischio (Circolare 15/E), incluse nelle righe come avvisoTracciabilita', () => {
  const tripIT = createTrip({ name: 'Milano', country: 'IT' });
  const out = exportTripData(tripIT, [
    { type: 'uscita', amount: 40, date: '2026-09-10', businessTripId: tripIT.id, tripCategory: 'vitto', paymentMethod: 'contanti' }, // avviso
    { type: 'uscita', amount: 40, date: '2026-09-10', businessTripId: tripIT.id, tripCategory: 'vitto', paymentMethod: 'carta' }, // tracciabile, nessun avviso
    { type: 'uscita', amount: 10, date: '2026-09-10', businessTripId: tripIT.id, tripCategory: 'vitto', paymentMethod: 'contanti' }, // sotto soglia
  ]);
  assert.equal(out.numeroAvvisiTracciabilita, 1);
  assert.equal(out.expenses[0].avvisoTracciabilita, true);
  assert.equal(out.expenses[1].avvisoTracciabilita, false);

  const tripES = createTrip({ name: 'Barcellona', country: 'ES' });
  const outEstero = exportTripData(tripES, [
    { type: 'uscita', amount: 40, date: '2026-09-10', businessTripId: tripES.id, tripCategory: 'vitto', paymentMethod: 'contanti' },
  ]);
  assert.equal(outEstero.numeroAvvisiTracciabilita, 0); // trasferta estera, eccezione dichiarata
});

test('exportTripData: numeroAvvisiSpagna conta i pasti in contanti quando il regime fiscale attivo è ES, indipendente dal Paese della trasferta', () => {
  const trip = createTrip({ name: 'Monaco', country: 'DE' }); // trasferta in Germania, non in Spagna
  const conRegimeEs = exportTripData(trip, [
    { type: 'uscita', amount: 5, date: '2026-09-10', businessTripId: trip.id, tripCategory: 'vitto', paymentMethod: 'contanti' },
    { type: 'uscita', amount: 5, date: '2026-09-10', businessTripId: trip.id, tripCategory: 'vitto', paymentMethod: 'carta' },
  ], { taxActiveCountry: 'es' });
  assert.equal(conRegimeEs.numeroAvvisiSpagna, 1);
  assert.equal(conRegimeEs.expenses[0].avvisoSpagna, true);

  const senzaRegimeEs = exportTripData(trip, [
    { type: 'uscita', amount: 5, date: '2026-09-10', businessTripId: trip.id, tripCategory: 'vitto', paymentMethod: 'contanti' },
  ], { taxActiveCountry: 'it' });
  assert.equal(senzaRegimeEs.numeroAvvisiSpagna, 0);
});

// ── SPESE "OFFERTE" (meals provided / spesa pagata da altri, mai rimborsata) ──

test('addOfferedItem: aggiunge una voce SENZA toccare le transazioni (vive solo nel trip)', () => {
  const trip = createTrip({ name: 'Milano' });
  const t2 = addOfferedItem(trip, { description: 'Cena col cliente', amount: 40, tripCategory: 'vitto', mealType: 'cena' });
  assert.equal(t2.offeredItems.length, 1);
  assert.equal(t2.offeredItems[0].description, 'Cena col cliente');
  assert.equal(t2.offeredItems[0].mealType, 'cena');
  assert.equal(trip.offeredItems.length, 0); // il trip originale resta immutato (funzione pura)
});

test('addOfferedItem: mealType non valido o assente → null, mai un valore inventato', () => {
  const trip = createTrip({ name: 'Milano' });
  const t2 = addOfferedItem(trip, { description: 'Hotel offerto', amount: 100, tripCategory: 'alloggio' });
  assert.equal(t2.offeredItems[0].mealType, null);
  const t3 = addOfferedItem(trip, { description: 'x', amount: 10, tripCategory: 'vitto', mealType: 'merenda' });
  assert.equal(t3.offeredItems[0].mealType, null);
});

test('addOfferedItem: categoria per il rimborso non valida → errore', () => {
  const trip = createTrip({ name: 'Milano' });
  assert.throws(() => addOfferedItem(trip, { description: 'x', amount: 10, tripCategory: 'non-esiste' }), /categoria/i);
});

test('addOfferedItem: importo negativo → errore; zero è invece valido (un pasto "offerto" può essere dichiarato senza controvalore noto)', () => {
  const trip = createTrip({ name: 'Milano' });
  assert.throws(() => addOfferedItem(trip, { description: 'x', amount: -5, tripCategory: 'vitto' }), /importo/i);
  const t2 = addOfferedItem(trip, { description: 'x', amount: 0, tripCategory: 'vitto' });
  assert.equal(t2.offeredItems[0].amount, 0);
});

test('removeOfferedItem: rimuove solo la voce indicata', () => {
  let trip = createTrip({ name: 'Milano' });
  trip = addOfferedItem(trip, { description: 'A', amount: 10, tripCategory: 'vitto' });
  trip = addOfferedItem(trip, { description: 'B', amount: 20, tripCategory: 'alloggio' });
  const idDaRimuovere = trip.offeredItems[0].id;
  const trip2 = removeOfferedItem(trip, idDaRimuovere);
  assert.equal(trip2.offeredItems.length, 1);
  assert.equal(trip2.offeredItems[0].description, 'B');
});

test('tripOfferedTotals: somma le voci offerte per categoria, MAI insieme al totale rimborsabile', () => {
  let trip = createTrip({ name: 'Milano' });
  trip = addOfferedItem(trip, { description: 'Pranzo offerto', amount: 25, tripCategory: 'vitto', mealType: 'pranzo' });
  trip = addOfferedItem(trip, { description: 'Hotel offerto', amount: 150, tripCategory: 'alloggio' });
  const { totale, perCategoria, numeroVoci } = tripOfferedTotals(trip);
  assert.equal(totale, 175);
  assert.equal(perCategoria.vitto, 25);
  assert.equal(perCategoria.alloggio, 150);
  assert.equal(numeroVoci, 2);

  // Il totale RIMBORSABILE (tripTotals, sulle transazioni vere) resta
  // completamente indipendente: dichiarare un pasto offerto non genera un
  // euro di rimborso in più — è l'intero punto di questa feature.
  const tx = [{ type: 'uscita', amount: 45, businessTripId: trip.id, tripCategory: 'trasporto' }];
  const { totale: totaleRimborsabile } = tripTotals(trip, tx);
  assert.equal(totaleRimborsabile, 45);
});

test('exportTripData: include le voci offerte in una sezione separata, escluse dal totale rimborsabile', () => {
  let trip = createTrip({ name: 'Milano' });
  trip = addOfferedItem(trip, { description: 'Pranzo offerto dal cliente', amount: 25, tripCategory: 'vitto', mealType: 'pranzo', date: '2026-09-11' });
  const tx = [{ type: 'uscita', amount: 45, date: '2026-09-10', businessTripId: trip.id, tripCategory: 'trasporto' }];
  const out = exportTripData(trip, tx);
  assert.equal(out.totale, 45); // solo la spesa vera
  assert.equal(out.offertiTotale, 25);
  assert.equal(out.offerti.length, 1);
  assert.equal(out.offerti[0].mealType, 'pranzo');
});
