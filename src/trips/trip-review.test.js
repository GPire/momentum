import test from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeTripReview, decodeTripReview, extractTripReviewPayload,
  encodeTripVerdict, decodeTripVerdict, extractTripVerdictPayload,
  applyTripVerdict, markTripSentForReview,
  TRIP_REVIEW_PREFIX, TRIP_VERDICT_PREFIX, VERDICT_STATES,
} from './trip-review.js';

const riepilogoBase = () => ({
  tripId: 'trip-123',
  tripName: 'Milano',
  startDate: '2026-09-10',
  endDate: '2026-09-12',
  totale: 165,
  numeroGiustificativiMancanti: 1,
  mittente: 'Giorgio',
  expenses: [
    { data: '2026-09-10', categoria: 'trasporto', descrizione: 'Taxi aeroporto', importo: 45, scontrino: null, giustificativoMancante: true },
    { data: '2026-09-11', categoria: 'alloggio', descrizione: 'Hotel Marriott', importo: 120, scontrino: 'data:image/jpeg;base64,AAA', giustificativoMancante: false },
  ],
});

test('round-trip: il riepilogo torna identico dall altra parte', async () => {
  const code = await encodeTripReview(riepilogoBase());
  const out = await decodeTripReview(code);
  assert.equal(out.tripId, 'trip-123');
  assert.equal(out.tripName, 'Milano');
  assert.equal(out.startDate, '2026-09-10');
  assert.equal(out.endDate, '2026-09-12');
  assert.equal(out.mittente, 'Giorgio');
  assert.equal(out.totale, 165);
  assert.equal(out.numeroGiustificativiMancanti, 1);
  assert.equal(out.expenses.length, 2);
  assert.equal(out.expenses[1].descrizione, 'Hotel Marriott');
  assert.equal(out.expenses[1].importo, 120);
});

// LIMITE FISICO DICHIARATO: le immagini non stanno in un QR. Il codice porta
// solo il FLAG "il giustificativo esiste", mai i byte dell'immagine — che
// arrivano dopo sul canale P2P. Se un giorno qualcuno le infilasse qui dentro,
// questo test lo ferma prima che un QR diventi illeggibile.
test('le immagini dei giustificativi NON finiscono mai nel codice, solo il flag', async () => {
  const code = await encodeTripReview(riepilogoBase());
  assert.ok(!code.includes('data:image'), 'nessuna immagine nel codice');
  assert.ok(code.length < 1200, `codice troppo lungo per un QR leggibile: ${code.length}`);
  const out = await decodeTripReview(code);
  assert.equal(out.expenses[1].haGiustificativo, true);  // c'è, ma non è qui dentro
  assert.equal(out.expenses[0].haGiustificativo, false);
  assert.equal(out.expenses[0].giustificativoMancante, true);
});

test('il codice resta leggibile come QR anche con una trasferta lunga (30 spese)', async () => {
  const molte = { ...riepilogoBase(), expenses: [] };
  for (let i = 0; i < 30; i++) {
    molte.expenses.push({ data: '2026-09-10', categoria: 'vitto', descrizione: `Pranzo cliente ${i}`, importo: 25.5, scontrino: null, giustificativoMancante: true });
  }
  const code = await encodeTripReview(molte);
  // Limite pratico di un QR fotografato da un telefono: ~2.9KB. Oltre, chi
  // approva vedrebbe un quadrato che non si legge — meglio saperlo da un test
  // che da un manager fermo davanti allo schermo.
  // Senza compressione questo caso pesava 2931 byte (misurato, non stimato):
  // già oltre. Con gzip scende sotto i 400 — la soglia stretta qui sotto è
  // quella che impedisce di tornare indietro senza accorgersene.
  assert.ok(code.length < 500, `codice da ${code.length} byte: la compressione non sta funzionando`);
  assert.equal((await decodeTripReview(code)).expenses.length, 30);
});

// Richiesta esplicita: una trasferta può durare da un giorno a MESI. Una
// trasferta lunghissima non deve diventare un QR illeggibile proprio per chi
// ne ha più bisogno (più giorni = più spese = più lavoro per chi approva).
test('anche una trasferta di mesi (120 spese) resta dentro i limiti di un QR', async () => {
  const lunghissima = { ...riepilogoBase(), expenses: [] };
  for (let i = 0; i < 120; i++) {
    lunghissima.expenses.push({ data: `2026-09-${String((i % 28) + 1).padStart(2, '0')}`, categoria: ['vitto', 'trasporto', 'alloggio', 'altro'][i % 4], descrizione: `Spesa numero ${i}`, importo: 10 + i, scontrino: null, giustificativoMancante: i % 3 === 0 });
  }
  const code = await encodeTripReview(lunghissima);
  // ~900 caratteri e' il limite pratico misurato per un QR generabile e
  // leggibile (vedi split/invite-codec.js, stessa lezione gia' pagata li').
  assert.ok(code.length < 900, `codice da ${code.length} byte: oltre il limite pratico di un QR`);
  const out = await decodeTripReview(code);
  // Il dettaglio completo non ci starebbe: il codice degrada da solo a una
  // sintesi per giorno, e lo DICHIARA (mai far credere che siano tutte).
  assert.equal(out.ridotto, true);
  assert.equal(out.numeroSpeseTotali, 120);
  assert.equal(out.totale, lunghissima.totale);
  // I totali per giorno e per categoria restano esatti: sono la cosa che
  // serve davvero a chi approva una trasferta di mesi.
  const sommaGiorni = Object.values(out.totaliPerGiorno).reduce((s, v) => s + v, 0);
  const sommaSpese = lunghissima.expenses.reduce((s, e) => s + e.importo, 0);
  assert.equal(Math.round(sommaGiorni * 100) / 100, Math.round(sommaSpese * 100) / 100);
  // E restano visibili una per una le sole righe senza giustificativo.
  assert.ok(out.expenses.length > 0);
  assert.ok(out.expenses.every(e => e.giustificativoMancante));
});

// Caso sollevato esplicitamente: una trasferta di due mesi può avere 800
// spese o più. Il degrado a un solo livello (per giorno) non basta, perché i
// totali giornalieri crescono coi GIORNI: a 1500 spese su 112 giorni si
// sforava di nuovo. Il secondo livello raggruppa per mese e il codice resta
// piccolo per sempre, qualunque sia la durata.
test('trasferte enormi (800, 1500, 3000 spese): il codice resta sempre dentro i limiti di un QR', async () => {
  const mk = (n) => ({
    tripId: 'trip-lungo', tripName: 'Progetto annuale', totale: 0, numeroGiustificativiMancanti: Math.ceil(n / 3),
    expenses: Array.from({ length: n }, (_, i) => ({
      data: `2026-${String(1 + (Math.floor(i / 300) % 12)).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
      categoria: ['vitto', 'trasporto', 'alloggio', 'altro'][i % 4],
      descrizione: `Spesa numero ${i}`, importo: 10 + (i % 90), scontrino: null, giustificativoMancante: i % 3 === 0,
    })),
  });
  for (const n of [800, 1500, 3000]) {
    const code = await encodeTripReview(mk(n));
    assert.ok(code.length < 900, `${n} spese → ${code.length} caratteri: oltre il limite di un QR`);
    const out = await decodeTripReview(code);
    assert.equal(out.ridotto, true);
    assert.equal(out.raggruppamento, 'mese');
    assert.equal(out.numeroSpeseTotali, n); // il numero vero non si perde mai
    assert.ok(Object.keys(out.totaliPerGiorno).length <= 12); // al massimo dodici mesi
  }
});

test('il livello di raggruppamento è sempre dichiarato: mai "per giorno" sopra dei totali mensili', async () => {
  const corta = await decodeTripReview(await encodeTripReview(riepilogoBase()));
  assert.equal(corta.raggruppamento, null); // dettaglio completo
});

test('trasferta corta: nessun degrado, il dettaglio completo resta tutto nel codice', async () => {
  const out = await decodeTripReview(await encodeTripReview(riepilogoBase()));
  assert.equal(out.ridotto, false);
  assert.equal(out.numeroSpeseTotali, 2);
  assert.equal(out.expenses.length, 2);
});

// Un telefono vecchio (senza CompressionStream) genera il formato in chiaro:
// deve restare leggibile da chiunque, altrimenti due colleghi con telefoni
// diversi non riescono a parlarsi — il caso peggiore, perché sembra un
// problema dell'app e non del telefono.
test('un codice NON compresso (telefono vecchio) resta leggibile lo stesso', async () => {
  const json = JSON.stringify({ v: 1, i: 'trip-123', n: 'Milano', t: 45, k: 0, r: [{ d: '2026-09-10', c: 'trasporto', w: 'Taxi', a: 45 }] });
  const inChiaro = TRIP_REVIEW_PREFIX + Buffer.from(json, 'utf8').toString('base64');
  const out = await decodeTripReview(inChiaro);
  assert.equal(out.tripId, 'trip-123');
  assert.equal(out.expenses[0].descrizione, 'Taxi');
});

test('il sotto-tipo pasto (colazione/pranzo/cena) sopravvive al round-trip', async () => {
  const r = riepilogoBase();
  r.expenses[0] = { data: '2026-09-10', categoria: 'vitto', mealType: 'cena', descrizione: 'Cena col cliente', importo: 40, scontrino: null, giustificativoMancante: true };
  const out = await decodeTripReview(await encodeTripReview(r));
  assert.equal(out.expenses[0].mealType, 'cena');
});

test('l offerta P2P viaggia nel codice quando c è, e il codice funziona anche senza', async () => {
  const conP2p = await decodeTripReview(await encodeTripReview(riepilogoBase(), 'OFFERTA-WEBRTC-FINTA'));
  assert.equal(conP2p.p2pOffer, 'OFFERTA-WEBRTC-FINTA');
  const senzaP2p = await decodeTripReview(await encodeTripReview(riepilogoBase()));
  assert.equal(senzaP2p.p2pOffer, null); // il riepilogo si legge lo stesso: mai dipendente dal P2P
  assert.equal(senzaP2p.expenses.length, 2);
});

test('riconoscimento per CONTENUTO: link completo, testo attorno, percent-encoding', async () => {
  const code = await encodeTripReview(riepilogoBase());
  const daLink = await decodeTripReview(`https://momentum.app/?revisione=${encodeURIComponent(code)}`);
  assert.equal(daLink.tripId, 'trip-123');
  const daMessaggio = await decodeTripReview(`Ciao, mi approvi questa? ${code} grazie!`);
  assert.equal(daMessaggio.tripId, 'trip-123');
  // Un dominio diverso (o un domani un deep link dell app nativa) non cambia nulla
  const daAltroDominio = await decodeTripReview(`momentum://revisione?c=${code}`);
  assert.equal(daAltroDominio.tripId, 'trip-123');
});

test('codice non valido o incolla sbagliato: null, mai un crash', async () => {
  assert.equal(await decodeTripReview('non è un codice'), null);
  assert.equal(await decodeTripReview(''), null);
  assert.equal(await decodeTripReview(null), null);
  assert.equal(await decodeTripReview('MTRIP1:questo-non-e-base64-valido!!!'), null);
  assert.equal(extractTripReviewPayload('niente qui'), null);
});

test('encodeTripReview senza id trasferta: errore esplicito, mai un codice muto', async () => {
  await assert.rejects(() => encodeTripReview({ tripName: 'Milano' }), /identificativo/i);
});

// ── ESITO (il ritorno dal manager) ──

test('esito: round-trip completo con nota e nome di chi ha approvato', () => {
  const code = encodeTripVerdict({ tripId: 'trip-123', state: 'modifiche', note: 'Manca lo scontrino del taxi', reviewer: 'Anna' });
  const v = decodeTripVerdict(code);
  assert.equal(v.tripId, 'trip-123');
  assert.equal(v.state, 'modifiche');
  assert.equal(v.note, 'Manca lo scontrino del taxi');
  assert.equal(v.reviewer, 'Anna');
  assert.ok(v.reviewedAt > 0);
});

test('esito: il codice è piccolo, ci sta in un SMS', () => {
  const code = encodeTripVerdict({ tripId: 'trip-123', state: 'approvata', reviewer: 'Anna' });
  assert.ok(code.length < 160, `esito da ${code.length} caratteri: non ci sta in un SMS`);
});

test('esito: solo i due stati previsti, mai un valore inventato', () => {
  assert.deepEqual(VERDICT_STATES, ['approvata', 'modifiche']);
  assert.throws(() => encodeTripVerdict({ tripId: 'trip-123', state: 'respinta' }), /esito/i);
  assert.equal(decodeTripVerdict(TRIP_VERDICT_PREFIX + btoa('{"v":1,"i":"x","s":"boh"}')), null);
});

test('esito: riconoscimento per contenuto anche dentro un messaggio', () => {
  const code = encodeTripVerdict({ tripId: 'trip-123', state: 'approvata' });
  assert.equal(decodeTripVerdict(`Approvata! ${code}`).state, 'approvata');
  assert.equal(extractTripVerdictPayload('nessun codice qui'), null);
});

test('applyTripVerdict: applica l esito e non tocca l originale (funzione pura)', () => {
  const trip = { id: 'trip-123', name: 'Milano' };
  const v = decodeTripVerdict(encodeTripVerdict({ tripId: 'trip-123', state: 'approvata', reviewer: 'Anna' }));
  const dopo = applyTripVerdict(trip, v);
  assert.equal(dopo.approval.state, 'approvata');
  assert.equal(dopo.approval.reviewer, 'Anna');
  assert.equal(trip.approval, undefined); // l originale resta intatto
});

// Caso reale: due trasferte aperte, si incolla il codice sbagliato. Senza
// questo controllo, la trasferta di Roma risulterebbe approvata da un esito
// che parlava di Milano — e nessuno se ne accorgerebbe.
test('applyTripVerdict: un esito di un ALTRA trasferta viene rifiutato con un errore chiaro', () => {
  const trip = { id: 'trip-999', name: 'Roma' };
  const v = decodeTripVerdict(encodeTripVerdict({ tripId: 'trip-123', state: 'approvata' }));
  assert.throws(() => applyTripVerdict(trip, v), /altra trasferta/i);
});

test('markTripSentForReview: la trasferta risulta "inviata", mai muta dopo la condivisione', () => {
  const trip = { id: 'trip-123', name: 'Milano' };
  const dopo = markTripSentForReview(trip);
  assert.equal(dopo.approval.state, 'inviata');
  assert.ok(dopo.approval.sentAt > 0);
  assert.equal(trip.approval, undefined);
});

// SCALA REALE: un manager di un'azienda vera non riceve una nota spese, ne
// riceve cento nello stesso periodo — una per dipendente, ognuna generata su
// un telefono diverso, senza nessun server che coordini gli identificativi.
// Due cose devono reggere: che due trasferte non finiscano mai con lo stesso
// id (altrimenti l'esito di uno approverebbe la trasferta di un altro), e che
// ogni esito si applichi SOLO alla sua trasferta.
test('cento dipendenti, cento trasferte: nessun id ripetuto e nessun esito che finisce sulla trasferta sbagliata', async () => {
  const { createTrip } = await import('./trip-engine.js');
  const trips = Array.from({ length: 120 }, (_, i) => createTrip({ name: `Trasferta dipendente ${i}` }));

  // Nessuna collisione di identificativi fra dispositivi che non si parlano.
  assert.equal(new Set(trips.map(t => t.id)).size, trips.length);

  // Ogni esito vale per la sua trasferta e per nessun'altra.
  for (const t of trips) {
    const v = decodeTripVerdict(encodeTripVerdict({ tripId: t.id, state: 'approvata', reviewer: 'Manager' }));
    assert.equal(applyTripVerdict(t, v).approval.state, 'approvata');
    const altra = trips.find(x => x.id !== t.id);
    assert.throws(() => applyTripVerdict(altra, v), /altra trasferta/i);
  }
});

test('un manager che apre cento richieste di seguito le legge tutte, ognuna con i suoi dati', async () => {
  const codici = [];
  for (let i = 0; i < 100; i++) {
    codici.push(await encodeTripReview({
      tripId: `dip-${i}`, tripName: `Dipendente ${i}`, totale: 100 + i, numeroGiustificativiMancanti: i % 4,
      expenses: [{ data: '2026-09-10', categoria: 'trasporto', descrizione: `Treno ${i}`, importo: 100 + i, scontrino: null, giustificativoMancante: i % 4 > 0 }],
    }));
  }
  for (let i = 0; i < 100; i++) {
    const out = await decodeTripReview(codici[i]);
    assert.equal(out.tripId, `dip-${i}`);
    assert.equal(out.totale, 100 + i);
    assert.equal(out.expenses[0].descrizione, `Treno ${i}`);
  }
});

test('i prefissi dei due codici sono diversi: un esito non può essere scambiato per una richiesta', async () => {
  assert.notEqual(TRIP_REVIEW_PREFIX, TRIP_VERDICT_PREFIX);
  const review = await encodeTripReview(riepilogoBase());
  const verdict = encodeTripVerdict({ tripId: 'trip-123', state: 'approvata' });
  assert.equal(decodeTripVerdict(review), null);
  assert.equal(await decodeTripReview(verdict), null);
});
