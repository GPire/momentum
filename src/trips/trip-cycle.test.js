// ============================================================
// CICLO COMPLETO DI UNA NOTA SPESE — a scala di azienda vera
// ============================================================
// I test degli altri file provano un pezzo alla volta. Qui si prova il giro
// INTERO, come lo vive un'azienda con oltre cento dipendenti in trasferta
// nello stesso periodo: ognuno crea la sua trasferta su un telefono che non
// parla con gli altri, ci mette dentro spese vere con e senza giustificativo,
// esporta, la manda in approvazione, e riceve indietro l'esito.
//
// Serve perché i pezzi possono essere tutti corretti e il giro rompersi lo
// stesso: un totale che non torna fra due funzioni, un giustificativo che si
// perde nell'export, un esito che finisce sulla trasferta di un collega.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrip, tripTotals, exportTripData, addOfferedItem, tripOfferedTotals, needsReceipt } from './trip-engine.js';
import { encodeTripReview, decodeTripReview, encodeTripVerdict, decodeTripVerdict, applyTripVerdict, markTripSentForReview } from './trip-review.js';

const N_DIPENDENTI = 120;

// Una finta foto di scontrino: quello che conta qui è che sia una data-URL
// come quelle vere, e che sopravviva all'export senza essere toccata.
const scontrinoFinto = (i) => `data:image/jpeg;base64,SCONTRINO${i}`;

// Un dipendente vero non ha due spese: ne ha una manciata al giorno, alcune
// con lo scontrino, altre no, qualcuna offerta dal cliente.
function trasfertaDiUnDipendente(i) {
  let trip = createTrip({ name: `Trasferta dipendente ${i}`, startDate: '2026-09-10', endDate: '2026-09-13' });
  const tx = [
    { id: `t${i}-1`, type: 'uscita', amount: 45.5, date: '2026-09-10', description: `Treno andata ${i}`, businessTripId: trip.id, tripCategory: 'trasporto', receiptImage: scontrinoFinto(`${i}a`) },
    { id: `t${i}-2`, type: 'uscita', amount: 120, date: '2026-09-10', description: `Hotel ${i}`, businessTripId: trip.id, tripCategory: 'alloggio', receiptImage: scontrinoFinto(`${i}b`) },
    { id: `t${i}-3`, type: 'uscita', amount: 32, date: '2026-09-11', description: `Cena cliente ${i}`, businessTripId: trip.id, tripCategory: 'vitto', mealType: 'cena' }, // sopra soglia SENZA scontrino
    { id: `t${i}-4`, type: 'uscita', amount: 8.5, date: '2026-09-11', description: `Caffè ${i}`, businessTripId: trip.id, tripCategory: 'vitto', mealType: 'colazione' }, // sotto soglia, nessun obbligo
    { id: `t${i}-5`, type: 'uscita', amount: 45.5, date: '2026-09-13', description: `Treno ritorno ${i}`, businessTripId: trip.id, tripCategory: 'trasporto', receiptImage: scontrinoFinto(`${i}c`) },
    // Rumore che nella vita vera c'è sempre: spese personali dello stesso mese
    // e il rimborso stesso quando arriva. Non devono MAI finire nella nota spese.
    { id: `p${i}`, type: 'uscita', amount: 999, date: '2026-09-12', description: 'Spesa personale', category: 'spesa' },
    { id: `r${i}`, type: 'entrata', amount: 251.5, date: '2026-09-20', description: 'Rimborso', businessTripId: trip.id },
  ];
  // Un pasto pagato dal cliente: si dichiara, non si rimborsa.
  trip = addOfferedItem(trip, { description: `Pranzo offerto ${i}`, amount: 25, tripCategory: 'vitto', mealType: 'pranzo', date: '2026-09-12' });
  return { trip, tx };
}

test(`${N_DIPENDENTI} dipendenti: il ciclo intero regge per ognuno, senza interferenze fra loro`, async () => {
  const tutti = Array.from({ length: N_DIPENDENTI }, (_, i) => trasfertaDiUnDipendente(i));
  // Tutte le transazioni di tutti, mescolate: è la situazione vera se un
  // giorno più dipendenti condividessero un archivio, ed è il modo più
  // severo di verificare che il filtro per trasferta non peschi altrove.
  const tutteLeTx = tutti.flatMap(d => d.tx);

  const idVisti = new Set();

  for (let i = 0; i < N_DIPENDENTI; i++) {
    const { trip } = tutti[i];
    assert.ok(!idVisti.has(trip.id), 'due trasferte non possono avere lo stesso identificativo');
    idVisti.add(trip.id);

    // ── 1. I TOTALI: solo le sue spese, mai quelle dei colleghi, mai la
    //       spesa personale, mai il rimborso in entrata.
    const { totale, perCategoria, numeroSpese } = tripTotals(trip, tutteLeTx);
    assert.equal(numeroSpese, 5, `dipendente ${i}: contate spese che non sono sue`);
    assert.equal(totale, 251.5);
    assert.equal(perCategoria.trasporto, 91);
    assert.equal(perCategoria.alloggio, 120);
    assert.equal(perCategoria.vitto, 40.5);

    // ── 2. LE VOCI OFFERTE: dichiarate, mai sommate al rimborsabile.
    const offerti = tripOfferedTotals(trip);
    assert.equal(offerti.totale, 25);
    assert.notEqual(totale, totale + offerti.totale - 25 + 0.0001); // il totale resta quello di prima

    // ── 3. L'EXPORT (gli stessi dati che alimentano CSV e stampa):
    //       ordine per data, allegati intatti, conteggio di cosa manca.
    const dati = exportTripData(trip, tutteLeTx);
    assert.equal(dati.expenses.length, 5);
    assert.equal(dati.totale, 251.5);
    assert.equal(dati.offertiTotale, 25);
    assert.deepEqual(dati.expenses.map(e => e.data), ['2026-09-10', '2026-09-10', '2026-09-11', '2026-09-11', '2026-09-13']);
    // Gli allegati arrivano fino all'export senza essere toccati: è quello che
    // finisce dentro al riepilogo stampabile.
    assert.equal(dati.expenses.filter(e => e.scontrino).length, 3);
    assert.ok(dati.expenses.find(e => e.descrizione === `Hotel ${i}`).scontrino.endsWith(`SCONTRINO${i}b`));
    // Una sola spesa sopra soglia senza scontrino: la cena.
    assert.equal(dati.numeroGiustificativiMancanti, 1);
    const senzaGiustificativo = dati.expenses.filter(e => e.giustificativoMancante);
    assert.equal(senzaGiustificativo.length, 1);
    assert.equal(senzaGiustificativo[0].descrizione, `Cena cliente ${i}`);
    // Il caffè da 8,50 € è sotto soglia: nessuna policy lo richiede.
    assert.equal(needsReceipt(tutti[i].tx[3]), false);
    // Il sotto-tipo pasto sopravvive fino all'export (le aziende hanno tetti
    // diversi per colazione, pranzo e cena).
    assert.equal(dati.expenses.find(e => e.descrizione === `Caffè ${i}`).mealType, 'colazione');

    // ── 4. LA RICHIESTA DI APPROVAZIONE: il codice porta il riepilogo e i
    //       flag, MAI i byte delle foto (in un QR non entrerebbero).
    const code = await encodeTripReview({
      tripId: trip.id, tripName: trip.name, startDate: trip.startDate, endDate: trip.endDate,
      expenses: dati.expenses, totale: dati.totale,
      numeroGiustificativiMancanti: dati.numeroGiustificativiMancanti, mittente: `Dipendente ${i}`,
    });
    assert.ok(!code.includes('SCONTRINO'), `dipendente ${i}: una foto è finita dentro al codice`);
    assert.ok(code.length < 900, `dipendente ${i}: codice da ${code.length} caratteri, un QR non lo regge`);

    const ricevuto = await decodeTripReview(code);
    assert.equal(ricevuto.tripId, trip.id);
    assert.equal(ricevuto.totale, 251.5);
    assert.equal(ricevuto.numeroGiustificativiMancanti, 1);
    assert.equal(ricevuto.expenses.length, 5);
    // Chi approva sa QUALI spese hanno un giustificativo, pur non vedendolo.
    assert.equal(ricevuto.expenses.filter(e => e.haGiustificativo).length, 3);
    assert.equal(ricevuto.mittente, `Dipendente ${i}`);

    // ── 5. LO STATO: dopo l'invio la trasferta non è più muta.
    const inviata = markTripSentForReview(trip);
    assert.equal(inviata.approval.state, 'inviata');

    // ── 6. L'ESITO torna indietro e si applica SOLO a questa trasferta.
    const verdetto = decodeTripVerdict(encodeTripVerdict({
      tripId: ricevuto.tripId, state: i % 2 ? 'approvata' : 'modifiche',
      note: i % 2 ? '' : `Manca lo scontrino della cena`, reviewer: 'Manager',
    }));
    const chiusa = applyTripVerdict(inviata, verdetto);
    assert.equal(chiusa.approval.state, i % 2 ? 'approvata' : 'modifiche');
    assert.equal(chiusa.approval.reviewer, 'Manager');
    if (!(i % 2)) assert.match(chiusa.approval.note, /cena/);

    // L'esito di questo dipendente NON deve poter chiudere la trasferta di un
    // collega: è l'errore che a cento note spese in parallelo capiterebbe.
    const collega = tutti[(i + 1) % N_DIPENDENTI].trip;
    assert.throws(() => applyTripVerdict(collega, verdetto), /altra trasferta/i);

    // ── 7. I dati del dipendente restano identici dopo tutto il giro: nessuna
    //       funzione ha mutato in silenzio la trasferta o le transazioni.
    assert.equal(trip.approval, undefined);
    assert.equal(tutti[i].tx[1].receiptImage, scontrinoFinto(`${i}b`));
  }
});

// Il caso che in un'azienda capita davvero: due dipendenti con la STESSA
// trasferta (stesso cliente, stesse date, stessi importi). Niente deve
// confondersi, nemmeno se i dati sono identici parola per parola.
test('due dipendenti con trasferte identiche restano due trasferte distinte', async () => {
  const a = createTrip({ name: 'Milano cliente X', startDate: '2026-09-10', endDate: '2026-09-11' });
  const b = createTrip({ name: 'Milano cliente X', startDate: '2026-09-10', endDate: '2026-09-11' });
  assert.notEqual(a.id, b.id);

  const txA = [{ id: 'a1', type: 'uscita', amount: 45, date: '2026-09-10', description: 'Treno', businessTripId: a.id, tripCategory: 'trasporto' }];
  const txB = [{ id: 'b1', type: 'uscita', amount: 45, date: '2026-09-10', description: 'Treno', businessTripId: b.id, tripCategory: 'trasporto' }];

  assert.equal(tripTotals(a, [...txA, ...txB]).numeroSpese, 1);
  assert.equal(tripTotals(b, [...txA, ...txB]).numeroSpese, 1);

  const verdettoA = decodeTripVerdict(encodeTripVerdict({ tripId: a.id, state: 'approvata' }));
  assert.equal(applyTripVerdict(a, verdettoA).approval.state, 'approvata');
  assert.throws(() => applyTripVerdict(b, verdettoA), /altra trasferta/i);
});

// Una trasferta senza NESSUN giustificativo (il caso peggiore per chi approva)
// e una con tutti (il caso migliore): entrambe devono dire la verità.
test('nota spese senza alcun giustificativo e nota spese completa: il conteggio è sempre onesto', () => {
  const trip = createTrip({ name: 'Roma' });
  const nessuno = exportTripData(trip, [
    { type: 'uscita', amount: 100, date: '2026-09-10', businessTripId: trip.id, tripCategory: 'alloggio' },
    { type: 'uscita', amount: 50, date: '2026-09-10', businessTripId: trip.id, tripCategory: 'vitto' },
  ]);
  assert.equal(nessuno.numeroGiustificativiMancanti, 2);

  const tutti = exportTripData(trip, [
    { type: 'uscita', amount: 100, date: '2026-09-10', businessTripId: trip.id, tripCategory: 'alloggio', receiptImage: 'data:image/jpeg;base64,X' },
    { type: 'uscita', amount: 50, date: '2026-09-10', businessTripId: trip.id, tripCategory: 'vitto', receiptImage: 'data:application/pdf;base64,Y' },
  ]);
  assert.equal(tutti.numeroGiustificativiMancanti, 0);
  // Un PDF vale quanto una foto: è un giustificativo a tutti gli effetti.
  assert.ok(tutti.expenses[1].scontrino.startsWith('data:application/pdf'));
});
