// Fusione delle trasferte fra i propri dispositivi: telefono e portatile
// devono arrivare alla STESSA trasferta, in qualunque ordine si incontrino e
// qualunque dei due sia stato acceso per ultimo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrip, addOfferedItem, mergeTrips, mergeTripLists, touchTrip } from './trip-engine.js';
import { encodeTripVerdict, decodeTripVerdict, applyTripVerdict, markTripSentForReview } from './trip-review.js';

test('merge: vince il nome scritto più di recente, non quello arrivato per ultimo', () => {
  const base = createTrip({ name: 'Milano' });
  const vecchia = { ...base, name: 'Milano', updatedAt: 1000 };
  const nuova = { ...base, name: 'Milano cliente X', updatedAt: 2000 };
  assert.equal(mergeTrips(vecchia, nuova).name, 'Milano cliente X');
  assert.equal(mergeTrips(nuova, vecchia).name, 'Milano cliente X'); // ordine indifferente
});

test('merge: le voci offerte si UNISCONO, nessun dispositivo cancella quelle dell altro', () => {
  let sulTelefono = createTrip({ name: 'Milano' });
  sulTelefono = addOfferedItem(sulTelefono, { description: 'Pranzo offerto', amount: 25, tripCategory: 'vitto', date: '2026-09-10' });
  sulTelefono = touchTrip(sulTelefono);

  let sulPortatile = { ...sulTelefono, offeredItems: [] };
  sulPortatile = addOfferedItem(sulPortatile, { description: 'Cena offerta', amount: 40, tripCategory: 'vitto', date: '2026-09-11' });
  sulPortatile = touchTrip(sulPortatile);

  const fuso = mergeTrips(sulTelefono, sulPortatile);
  assert.equal(fuso.offeredItems.length, 2);
  const descrizioni = fuso.offeredItems.map(i => i.description);
  assert.ok(descrizioni.includes('Pranzo offerto'));
  assert.ok(descrizioni.includes('Cena offerta'));
  // Ordinate per data: chi legge non trova un elenco a caso.
  assert.equal(fuso.offeredItems[0].description, 'Pranzo offerto');
});

test('merge: l esito più recente vince (prima "serve una modifica", poi "approvata")', () => {
  const trip = createTrip({ name: 'Milano' });
  const primaRisposta = applyTripVerdict(trip, { tripId: trip.id, state: 'modifiche', note: 'manca lo scontrino', reviewedAt: 1000 });
  const secondaRisposta = applyTripVerdict(trip, { tripId: trip.id, state: 'approvata', note: '', reviewedAt: 2000 });
  assert.equal(mergeTrips(primaRisposta, secondaRisposta).approval.state, 'approvata');
  assert.equal(mergeTrips(secondaRisposta, primaRisposta).approval.state, 'approvata');
});

// Caso vero: il telefono ha ricevuto l'esito, il portatile è rimasto fermo a
// "inviata" da prima. Il portatile non deve riportare indietro la trasferta.
test('merge: la copia rimasta a "inviata" non cancella un esito arrivato DOPO', () => {
  const trip = touchTrip(createTrip({ name: 'Milano' }));
  const soloInviata = markTripSentForReview(trip);                       // sentAt = adesso
  const conEsito = applyTripVerdict(trip, { tripId: trip.id, state: 'approvata', reviewedAt: Date.now() + 60000 }); // risposto dopo
  assert.equal(mergeTrips(soloInviata, conEsito).approval.state, 'approvata');
  assert.equal(mergeTrips(conEsito, soloInviata).approval.state, 'approvata');
});

// L'altro verso, altrettanto reale e più sottile: dopo un "serve una modifica"
// l'utente corregge e RIMANDA in approvazione. Lì "inviata" è lo stato giusto,
// perché è successo dopo — un merge che tenesse il vecchio esito mostrerebbe
// per sempre "serve una modifica" su una nota spese già ricorretta e rimandata.
test('merge: un nuovo invio DOPO un esito riporta la trasferta in attesa, non resta bloccata sul vecchio esito', () => {
  const trip = touchTrip(createTrip({ name: 'Milano' }));
  const conEsitoVecchio = applyTripVerdict(trip, { tripId: trip.id, state: 'modifiche', note: 'manca lo scontrino', reviewedAt: Date.now() - 60000 });
  const rimandata = markTripSentForReview(conEsitoVecchio); // sentAt = adesso, dopo l'esito
  assert.equal(mergeTrips(conEsitoVecchio, rimandata).approval.state, 'inviata');
});

test('merge: la data di creazione non cambia mai, nemmeno fondendo molte volte', () => {
  const trip = createTrip({ name: 'Milano' });
  const creato = trip.createdAt;
  let fuso = mergeTrips(trip, { ...trip, updatedAt: Date.now() + 1000 });
  fuso = mergeTrips(fuso, { ...trip, createdAt: creato + 50000, updatedAt: Date.now() + 2000 });
  assert.equal(fuso.createdAt, creato);
});

// Un merge che non è deterministico fa "litigare" due dispositivi all'infinito:
// ognuno rimanda all'altro la propria versione, e la trasferta continua a
// cambiare da sola sotto gli occhi dell'utente.
test('merge: fondere due volte non cambia più niente (idempotente) e l ordine non conta', () => {
  let a = touchTrip(addOfferedItem(createTrip({ name: 'Milano' }), { description: 'A', amount: 10, tripCategory: 'vitto', date: '2026-09-10' }));
  let b = touchTrip(addOfferedItem({ ...a, offeredItems: [] }, { description: 'B', amount: 20, tripCategory: 'vitto', date: '2026-09-11' }));

  const ab = mergeTrips(a, b);
  const ba = mergeTrips(b, a);
  assert.deepEqual(ab.offeredItems.map(i => i.description).sort(), ba.offeredItems.map(i => i.description).sort());
  assert.deepEqual(mergeTrips(ab, ab), ab);
  assert.deepEqual(mergeTrips(ab, b).offeredItems.length, 2);
});

test('merge di elenchi: le trasferte nuove si aggiungono, quelle esistenti si fondono', () => {
  const milano = touchTrip(createTrip({ name: 'Milano' }));
  const roma = touchTrip(createTrip({ name: 'Roma' }));
  const milanoAggiornata = { ...milano, name: 'Milano cliente X', updatedAt: milano.updatedAt + 1000 };

  const fuse = mergeTripLists([milano, roma], [milanoAggiornata, touchTrip(createTrip({ name: 'Berlino' }))]);
  assert.equal(fuse.length, 3);
  assert.equal(fuse.find(t => t.id === milano.id).name, 'Milano cliente X');
  assert.ok(fuse.find(t => t.name === 'Berlino'));
  assert.ok(fuse.find(t => t.id === roma.id));
});

test('merge di elenchi: trasferte di dispositivi diversi non si mescolano mai fra loro', () => {
  const mie = Array.from({ length: 50 }, (_, i) => touchTrip(createTrip({ name: `Mia ${i}` })));
  const altre = Array.from({ length: 50 }, (_, i) => touchTrip(createTrip({ name: `Altra ${i}` })));
  const fuse = mergeTripLists(mie, altre);
  assert.equal(fuse.length, 100);
  assert.equal(new Set(fuse.map(t => t.id)).size, 100);
});

// Senza lapide, questo è il bug che si vede solo con due dispositivi veri: si
// cancella una trasferta sul telefono, si riaccende il portatile, e la
// trasferta ricompare — con l'utente convinto di averla eliminata.
test('cancellazione: una trasferta cancellata non torna in vita dal dispositivo che non lo sapeva', async () => {
  const { deleteTrip, visibleTrips } = await import('./trip-engine.js');
  const trip = touchTrip(createTrip({ name: 'Milano' }));
  const cancellata = deleteTrip(trip);
  // Il portatile ha ancora la copia viva, e magari pure più "fresca".
  const copiaViva = { ...trip, name: 'Milano cliente X', updatedAt: Date.now() + 60000 };

  assert.ok(mergeTrips(cancellata, copiaViva).deletedAt, 'la lapide deve vincere');
  assert.ok(mergeTrips(copiaViva, cancellata).deletedAt, 'in qualunque ordine');
  assert.equal(visibleTrips(mergeTripLists([copiaViva], [cancellata])).length, 0);
  // E la lapide sopravvive a quanti merge si vuole: non "scade" da sola.
  let stato = mergeTripLists([copiaViva], [cancellata]);
  for (let i = 0; i < 5; i++) stato = mergeTripLists(stato, [copiaViva]);
  assert.equal(visibleTrips(stato).length, 0);
});

// Il caso che una lapide secca non saprebbe gestire: cancello per sbaglio una
// trasferta di mesi, la cancellazione è GIÀ arrivata sull'altro dispositivo, e
// solo dopo me ne accorgo. Con una lapide definitiva sarebbe persa ovunque.
test('ripristino: annullare una cancellazione funziona anche dopo che è già stata sincronizzata', async () => {
  const { deleteTrip, restoreTrip, visibleTrips, isTripDeleted } = await import('./trip-engine.js');
  const trip = touchTrip(createTrip({ name: 'Progetto annuale' }));
  const cancellata = deleteTrip(trip, 1000);

  // L'altro dispositivo l'ha già ricevuta cancellata.
  const suAltroDispositivo = mergeTrips(trip, cancellata);
  assert.equal(isTripDeleted(suAltroDispositivo), true);

  // Poi mi accorgo dell'errore e la ripristino: la data è più recente, vince.
  const ripristinata = restoreTrip(cancellata, 2000);
  assert.equal(isTripDeleted(ripristinata), false);
  assert.equal(isTripDeleted(mergeTrips(suAltroDispositivo, ripristinata)), false);
  assert.equal(isTripDeleted(mergeTrips(ripristinata, suAltroDispositivo)), false);
  assert.equal(visibleTrips(mergeTripLists([suAltroDispositivo], [ripristinata])).length, 1);
});

test('ripristino: una copia rimasta indietro non ricancella la trasferta appena ripristinata', async () => {
  const { deleteTrip, restoreTrip, isTripDeleted } = await import('./trip-engine.js');
  const trip = touchTrip(createTrip({ name: 'Milano' }));
  const ripristinata = restoreTrip(deleteTrip(trip, 1000), 2000);
  // Il dispositivo lento continua a rimandare la sua copia cancellata.
  let stato = ripristinata;
  for (let i = 0; i < 5; i++) stato = mergeTrips(stato, deleteTrip(trip, 1000));
  assert.equal(isTripDeleted(stato), false, 'la trasferta ripristinata deve restare viva');
  // E se poi la cancello DI NUOVO per davvero, la nuova cancellazione vince.
  assert.equal(isTripDeleted(mergeTrips(stato, deleteTrip(stato, 3000))), true);
});

test('pulizia: dopo un anno la lapide resta, ma non si porta più dietro i dati', async () => {
  const { deleteTrip, pruneDeletedTrips, isTripDeleted } = await import('./trip-engine.js');
  const adesso = Date.now();
  const vecchia = deleteTrip(touchTrip(createTrip({ name: 'Vecchia trasferta' })), adesso - 400 * 24 * 3600 * 1000);
  const recente = deleteTrip(touchTrip(createTrip({ name: 'Cancellata ieri' })), adesso - 24 * 3600 * 1000);
  const viva = touchTrip(createTrip({ name: 'Viva' }));

  const pulite = pruneDeletedTrips([vecchia, recente, viva], 365, adesso);
  const dopo = pulite.find(t => t.id === vecchia.id);
  assert.equal(dopo.name, undefined, 'i dati di una lapide vecchia non servono più');
  assert.equal(isTripDeleted(dopo), true, 'ma deve restare capace di respingere una copia vecchia');
  // Una cancellazione recente si tiene intera: potrebbe ancora servire un
  // annullamento, e un dispositivo spento potrebbe non saperne ancora nulla.
  assert.equal(pulite.find(t => t.id === recente.id).name, 'Cancellata ieri');
  assert.equal(pulite.find(t => t.id === viva.id).name, 'Viva');
});

test('cancellazione: le altre trasferte restano visibili, solo quella cancellata sparisce', async () => {
  const { deleteTrip, visibleTrips } = await import('./trip-engine.js');
  const milano = touchTrip(createTrip({ name: 'Milano' }));
  const roma = touchTrip(createTrip({ name: 'Roma' }));
  const fuse = mergeTripLists([milano, roma], [deleteTrip(milano)]);
  const visibili = visibleTrips(fuse);
  assert.equal(visibili.length, 1);
  assert.equal(visibili[0].name, 'Roma');
});

test('merge: dati sporchi o incompleti non rompono niente', () => {
  const trip = createTrip({ name: 'Milano' });
  assert.equal(mergeTrips(trip, null), trip);
  assert.equal(mergeTrips(null, trip), trip);
  // Identificativi diversi: non si fondono mai, si tiene il proprio.
  assert.equal(mergeTrips(trip, createTrip({ name: 'Roma' })).name, 'Milano');
  assert.deepEqual(mergeTripLists([trip], [null, undefined, {}]), [trip]);
});
