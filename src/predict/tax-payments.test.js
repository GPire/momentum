'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordTaxPayment, removeTaxPayment, taxReserveStatus } from './tax-payments.js';
import { taxSetAsideForPeriod } from './tax.js';

test('recordTaxPayment: aggiunge una voce con importo, nota e data', () => {
  const p = recordTaxPayment([], 500, { note: 'Acconto IRPEF giugno' });
  assert.equal(p.length, 1);
  assert.equal(p[0].amount, 500);
  assert.equal(p[0].note, 'Acconto IRPEF giugno');
  assert.ok(p[0].id);
});

test('recordTaxPayment: importo zero o negativo -> nessuna voce aggiunta', () => {
  assert.deepEqual(recordTaxPayment([], 0), []);
  assert.deepEqual(recordTaxPayment([], -50), []);
});

test('recordTaxPayment: additivo, mai muta l\'array originale', () => {
  const original = [];
  const p = recordTaxPayment(original, 100);
  assert.equal(original.length, 0);
  assert.equal(p.length, 1);
});

test('recordTaxPayment: stato assente (undefined) -> parte da lista vuota, nessun crash', () => {
  const p = recordTaxPayment(undefined, 200);
  assert.equal(p.length, 1);
});

test('removeTaxPayment: rimuove solo la voce con l\'id indicato', () => {
  let p = recordTaxPayment([], 100, { note: 'a' });
  p = recordTaxPayment(p, 200, { note: 'b' });
  const idDaRimuovere = p[0].id;
  const dopo = removeTaxPayment(p, idDaRimuovere);
  assert.equal(dopo.length, 1);
  assert.equal(dopo[0].note, 'b');
});

test('removeTaxPayment: id inesistente -> lista invariata, nessun crash', () => {
  const p = recordTaxPayment([], 100);
  assert.deepEqual(removeTaxPayment(p, 'non-esiste'), p);
});

// ============================================================
// taxReserveStatus — la situazione onesta: quanto dovresti aver messo da
// parte, quanto hai DICHIARATO di aver versato, quanto ti manca ancora.
// Mai un trasferimento reale: solo un confronto tra due numeri calcolati.
// ============================================================

test('taxReserveStatus: nessun versamento -> tutto da accantonare', () => {
  const s = taxReserveStatus(1000, []);
  assert.equal(s.totaleDovuto, 1000);
  assert.equal(s.versato, 0);
  assert.equal(s.daAccantonare, 1000);
  assert.equal(s.inPari, false);
});

test('taxReserveStatus: versamenti parziali -> resta la differenza', () => {
  const p = recordTaxPayment([], 400);
  const s = taxReserveStatus(1000, p);
  assert.equal(s.daAccantonare, 600);
  assert.equal(s.inPari, false);
});

test('taxReserveStatus: versato tutto o più del dovuto -> in pari, mai un numero negativo mostrato', () => {
  let p = recordTaxPayment([], 1000);
  let s = taxReserveStatus(1000, p);
  assert.equal(s.daAccantonare, 0);
  assert.equal(s.inPari, true);

  p = recordTaxPayment(p, 500); // versato più del dovuto (es. anticipo)
  s = taxReserveStatus(1000, p);
  assert.equal(s.daAccantonare, 0, 'mai un accantonamento negativo anche se si è versato di più');
  assert.equal(s.inPari, true);
});

test('taxReserveStatus: totale dovuto assente/NaN -> non esplode, tratta come zero', () => {
  const s = taxReserveStatus(undefined, []);
  assert.equal(s.totaleDovuto, 0);
  assert.equal(s.daAccantonare, 0);
});

// SCENARIO end-to-end: il salvadanaio virtuale collegato al calcolo VERO
// (tax.js), non a un contatore separato che si disallineerebbe. Un
// forfettario fattura due volte, versa un acconto, controlla a fine anno.
test('SCENARIO: ciclo completo — fatture reali → dovuto calcolato → acconto versato → quanto manca', () => {
  const fatture = [
    { type: 'entrata', description: 'fattura cliente consulenza marzo', amount: 3000, date: '2026-03-10' },
    { type: 'entrata', description: 'fattura cliente consulenza luglio', amount: 5000, date: '2026-07-10' },
  ];
  const dovuto = taxSetAsideForPeriod(fatture, { regime: 'forfettario' }).daAccantonare;
  assert.ok(dovuto > 0, 'il dovuto deve venire dal motore fiscale reale, non da un contatore a parte');

  // Nulla versato: tutto ancora da mettere via.
  let stato = taxReserveStatus(dovuto, []);
  assert.equal(stato.daAccantonare, +dovuto.toFixed(2));

  // Acconto di giugno dichiarato dall'utente (l'unica cosa che Momentum
  // non può dedurre da solo: è successo fuori dall'app).
  const versamenti = recordTaxPayment([], 800, { note: 'Acconto giugno F24' });
  stato = taxReserveStatus(dovuto, versamenti);
  assert.equal(stato.versato, 800);
  assert.equal(stato.daAccantonare, +(dovuto - 800).toFixed(2));
  assert.equal(stato.inPari, false);
});

test('SCENARIO: una fattura cancellata riduce il dovuto — il salvadanaio resta allineato, mai un contatore a sé', () => {
  const fatture = [
    { type: 'entrata', description: 'fattura cliente A', amount: 2000, date: '2026-03-10' },
    { type: 'entrata', description: 'fattura cliente B', amount: 2000, date: '2026-04-10' },
  ];
  const dovutoPrima = taxSetAsideForPeriod(fatture, { regime: 'forfettario' }).daAccantonare;
  const dovutoDopo = taxSetAsideForPeriod(fatture.slice(0, 1), { regime: 'forfettario' }).daAccantonare;
  assert.ok(dovutoDopo < dovutoPrima, 'togliendo una fattura il dovuto scende');

  // Questo è il motivo per cui NON esiste un contatore incrementale: il
  // dovuto si ricalcola sempre dalle fatture vere, quindi cancellare una
  // fattura aggiorna da solo anche il salvadanaio.
  const versamenti = recordTaxPayment([], 100);
  const stato = taxReserveStatus(dovutoDopo, versamenti);
  assert.equal(stato.totaleDovuto, +dovutoDopo.toFixed(2));
});

// ── Il ciclo COMPLETO: dichiarare un versamento deve cambiare quello che si vede ──
// Questi test esistono perché `recordTaxPayment`/`removeTaxPayment` sono state
// scritte e testate una sessione, e collegate a NESSUNA interfaccia: per mesi
// `taxPayments` è stato letto e mai scritto, quindi `versato` era sempre 0 e il
// ravvedimento calcolava sanzioni su soldi già dati allo Stato. Testare la
// funzione da sola non bastava: serviva testare che l'effetto ARRIVI dove
// l'utente guarda.
import { upcomingTaxDeadlines, overdueTaxDeadlines } from './tax-deadlines.js';

test('CICLO COMPLETO: registrare un versamento riduce quanto resta da mettere via', () => {
  let pagamenti = [];
  const dovuto = 4000;
  assert.equal(taxReserveStatus(dovuto, pagamenti).daAccantonare, 4000);
  pagamenti = recordTaxPayment(pagamenti, 1500, { note: 'F24 giugno' });
  const dopo = taxReserveStatus(dovuto, pagamenti);
  assert.equal(dopo.versato, 1500);
  assert.equal(dopo.daAccantonare, 2500);
});

test('CICLO COMPLETO: una scadenza SCADUTA sparisce dopo averla dichiarata versata', () => {
  const dovuto = 4000;
  const now = new Date('2026-08-07T12:00:00Z');
  const primaScadute = overdueTaxDeadlines(dovuto, { now, giaVersato: 0 });
  assert.ok(primaScadute.length > 0, 'premessa: esiste almeno una scadenza passata non versata');

  // L'utente dichiara di aver versato tutto.
  const pagamenti = recordTaxPayment([], dovuto, { note: 'saldo' });
  const versato = taxReserveStatus(dovuto, pagamenti).versato;
  const dopoScadute = overdueTaxDeadlines(dovuto, { now, giaVersato: versato });
  assert.equal(dopoScadute.length, 0,
    'una scadenza dichiarata versata NON deve continuare a comparire fra le scadute: e\' il bug che faceva calcolare il ravvedimento su soldi gia\' pagati');
});

test('VERSAMENTO PARZIALE: gli importi calano, ma la scadenza resta visibile', () => {
  const dovuto = 4000;
  const now = new Date('2026-08-07T12:00:00Z');
  const pieno = upcomingTaxDeadlines(dovuto, { now, giaVersato: 0 });
  const pagamenti = recordTaxPayment([], 1000);
  const parziale = upcomingTaxDeadlines(dovuto, { now, giaVersato: taxReserveStatus(dovuto, pagamenti).versato });
  assert.ok(parziale.length > 0, 'un versamento parziale non azzera l\'obbligo');
  assert.ok(parziale[0].importo < pieno[0].importo, 'ma l\'importo residuo deve calare');
});

test('RIMOZIONE: annullare un versamento riporta indietro quello che si vede', () => {
  const dovuto = 4000;
  let pagamenti = recordTaxPayment([], 1500);
  const id = pagamenti[0].id;
  pagamenti = removeTaxPayment(pagamenti, id);
  assert.equal(taxReserveStatus(dovuto, pagamenti).daAccantonare, 4000,
    'un versamento inserito per errore deve poter essere annullato');
});

test('un importo non valido non sporca lo stato', () => {
  for (const bad of [0, -100, NaN, undefined, null, 'ciao']) {
    assert.deepEqual(recordTaxPayment([], bad), [], `rifiutato: ${bad}`);
  }
});
