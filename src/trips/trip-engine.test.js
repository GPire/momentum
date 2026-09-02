import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrip, tripExpenses, tripTotals, exportTripData, TRIP_CATEGORIES, addOfferedItem, removeOfferedItem, tripOfferedTotals, MEAL_SUBTYPES, needsReceipt } from './trip-engine.js';

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
