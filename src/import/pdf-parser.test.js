import test from 'node:test';
import assert from 'node:assert/strict';

// Shim minimo per moduli scritti per il browser (stesso pattern degli altri test).
globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };
globalThis.document = globalThis.document || { querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {}, getElementById: () => null };

const { extractTransactionsFromItems, parseCellDate, parseCellAmount, detectCurrency } = await import('./pdf-parser.js');
const { intesaLayout, unicreditLayout, n26Layout, revolutLayout, saldoColumnLayout } = await import('./fixtures/pdf-layouts.js');

// ---- layout multi-banca ----

test('Intesa (Addebiti/Accrediti plurali): 3 transazioni, continuazione appesa alla descrizione', () => {
  const txs = extractTransactionsFromItems(intesaLayout());
  assert.equal(txs.length, 3);

  assert.equal(txs[0].amount, 45.80);
  assert.equal(txs[0].type, 'uscita');
  // la riga "ESSELUNGA MILANO" (senza data né importo) è la seconda riga
  // della descrizione, non una transazione persa
  assert.equal(txs[0].description, 'PAGAMENTO POS ESSELUNGA MILANO');
  assert.equal(txs[0].date.getDate(), 2);

  // "Accredito Stipendio" nella DESCRIZIONE non deve rompere nulla
  assert.equal(txs[1].amount, 1850);
  assert.equal(txs[1].type, 'entrata');

  assert.equal(txs[2].amount, 78.50);
  assert.equal(txs[2].type, 'uscita');
});

test('UniCredit (colonna Importo unica, segno): uscita negativa, entrata positiva', () => {
  const txs = extractTransactionsFromItems(unicreditLayout());
  assert.equal(txs.length, 2);
  assert.deepEqual(
    txs.map(t => [t.amount, t.type]),
    [[32.90, 'uscita'], [1500, 'entrata']]
  );
});

test('N26 (header inglesi, date ISO): parsing completo', () => {
  const txs = extractTransactionsFromItems(n26Layout());
  assert.equal(txs.length, 2);
  assert.equal(txs[0].amount, 10.99);
  assert.equal(txs[0].type, 'uscita');
  assert.equal(txs[0].date.getMonth(), 5); // giugno da "2026-06-03", non gennaio
  assert.equal(txs[0].date.getDate(), 3);
  assert.equal(txs[1].type, 'entrata');
  assert.equal(txs[1].amount, 2100);
});

test('Revolut (Money out/in + Balance): il saldo progressivo NON diventa transazione', () => {
  const txs = extractTransactionsFromItems(revolutLayout());
  assert.equal(txs.length, 2); // 2 transazioni, non 4 (i due Balance ignorati)
  assert.equal(txs[0].amount, 12.40);
  assert.equal(txs[0].type, 'uscita');
  assert.equal(txs[0].date.getMonth(), 5); // "3 Jun 2026"
  assert.equal(txs[1].amount, 200);
  assert.equal(txs[1].type, 'entrata');
});

test('colonna Saldo italiana: ignorata, mai importata come spesa', () => {
  const txs = extractTransactionsFromItems(saldoColumnLayout());
  assert.equal(txs.length, 2);
  const amounts = txs.map(t => t.amount).sort((a, b) => a - b);
  assert.deepEqual(amounts, [25, 300]); // 975/1275 (saldi) assenti
});

test('ordine di lettura: righe processate dalla cima della pagina (y decrescente)', () => {
  const txs = extractTransactionsFromItems(intesaLayout());
  // la prima transazione restituita è quella più in alto sulla pagina
  assert.equal(txs[0].date.getDate(), 2);
  assert.equal(txs[txs.length - 1].date.getDate(), 10);
});

// ---- parseCellDate esteso ----

test('parseCellDate: ISO, giorno/mese a 1 cifra, mesi testuali IT/EN', () => {
  assert.equal(parseCellDate('2026-06-03').getMonth(), 5);
  assert.equal(parseCellDate('3/1/2026').getMonth(), 0);   // prima veniva perso
  assert.equal(parseCellDate('3 gen 2026').getMonth(), 0);
  assert.equal(parseCellDate('03 GEN 26').getFullYear(), 2026);
  assert.equal(parseCellDate('5 Jun 2026').getMonth(), 5);
  assert.equal(parseCellDate('senza data'), null);
});

// ── Il bug reale: un export USA in MM/DD/YYYY letto giorno-primo ──
// "12/25/2025" (25 dicembre) con la vecchia logica diventava
// new Date(2025, 24, 12) — mese 24 non esiste, e `Date` non lancia un
// errore: SCORRE sull'anno dopo, dando gennaio 2027. Un dato sbagliato
// senza nessun avviso, esattamente il tipo di errore silenzioso che
// questo progetto rifiuta.
test('parseCellDate: giorno/mese ambiguo resta giorno-primo (convenzione dichiarata)', () => {
  const d = parseCellDate('05/03/2026'); // potrebbe essere 5 marzo o 3 maggio
  assert.equal(d.getMonth(), 2, 'ambiguo → resta giorno-primo: 5 marzo');
  assert.equal(d.getDate(), 5);
});

test('parseCellDate: quando il "mese" supera 12 non può essere ambiguo — si scambia', () => {
  const d = parseCellDate('12/25/2025'); // 25 non è un mese in NESSUNA lettura
  assert.equal(d.getFullYear(), 2025, 'prima "scorreva" silenziosamente al 2027');
  assert.equal(d.getMonth(), 11, 'dicembre');
  assert.equal(d.getDate(), 25);
});

test('parseCellDate: il caso INEQUIVOCABILE (giorno>12) restava già corretto', () => {
  const d = parseCellDate('25/12/2025'); // 25 non può essere un mese: già giorno-primo
  assert.equal(d.getMonth(), 11);
  assert.equal(d.getDate(), 25);
});

// ── Mesi testuali in spagnolo, francese, tedesco, portoghese — le altre
// 4 lingue che Momentum dichiara di supportare (i18n/detect.js), non solo
// italiano e inglese. ──
test('parseCellDate: mesi testuali ES/FR/DE/PT, incluse le abbreviazioni con accento', () => {
  assert.equal(parseCellDate('3 ene 2026').getMonth(), 0, 'spagnolo: enero');
  assert.equal(parseCellDate('15 Abr 2026').getMonth(), 3, 'spagnolo/portoghese: abril');
  assert.equal(parseCellDate('9 mai 2026').getMonth(), 4, 'francese: mai');
  assert.equal(parseCellDate('3 août 2026').getMonth(), 7, 'francese CON accento: août');
  assert.equal(parseCellDate('20 Okt 2026').getMonth(), 9, 'tedesco: Oktober');
  assert.equal(parseCellDate('1 Dez 2026').getMonth(), 11, 'tedesco: Dezember');
  assert.equal(parseCellDate('12 déc 2026').getMonth(), 11, 'francese CON accento: décembre');
  assert.equal(parseCellDate('4 Fev 2026').getMonth(), 1, 'portoghese: fevereiro');
  assert.equal(parseCellDate('30 out 2026').getMonth(), 9, 'portoghese: outubro');
});

test('parseCellDate: ambiguità genuina fra lingue (francese juin/juillet) resta non riconosciuta, non indovinata', () => {
  // Entrambi si accorciano a "jui" nelle prime 3 lettere: nessuna delle due
  // letture è più giusta dell'altra senza sapere la lingua del documento.
  // Meglio null (la riga viene saltata) che una data sbagliata a metà.
  assert.equal(parseCellDate('3 juin 2026'), null);
  assert.equal(parseCellDate('3 juillet 2026'), null);
});

// ---- regressione parseCellAmount (comportamento già verificato, fissato) ----

test('parseCellAmount: formati IT/US e segni invariati', () => {
  assert.equal(parseCellAmount('1.234,56'), 1234.56);
  assert.equal(parseCellAmount('1,234.56'), 1234.56);
  assert.equal(parseCellAmount('-32,90'), -32.9);
  assert.equal(parseCellAmount('1.500'), 1500);
});

// ---- BUG REALE CORRETTO: solo € e $ venivano ripuliti, un importo in
// sterline/yen/franchi restava con un carattere non numerico e parseFloat
// restituiva NaN — la transazione veniva scartata in silenzio. Colpiva ogni
// estratto conto UK/giapponese/svizzero (CSV, PDF, screenshot, notifiche
// bancarie condividono tutti questa stessa funzione). ----

test('parseCellAmount: valute prima ROTTE (£, ¥, CHF) ora si leggono come le altre', () => {
  assert.equal(parseCellAmount('£45.00'), 45);
  assert.equal(parseCellAmount('¥4500'), 4500);
  assert.equal(parseCellAmount('CHF 45.00'), 45);
  assert.equal(parseCellAmount('45.00 CHF'), 45);
  assert.equal(parseCellAmount('USD-12.50'), -12.5, 'il segno resta corretto anche con un codice valuta davanti');
  assert.equal(parseCellAmount('-CHF 45.00'), -45, 'il segno può stare anche PRIMA del codice valuta, non solo dopo');
});

test('detectCurrency: simboli riconosciuti', () => {
  assert.equal(detectCurrency('€45,00'), 'EUR');
  assert.equal(detectCurrency('$45.00'), 'USD');
  assert.equal(detectCurrency('£45.00'), 'GBP');
  assert.equal(detectCurrency('¥4500'), 'JPY');
});

test('detectCurrency: un codice ISO esplicito ha PRECEDENZA sul simbolo ambiguo ($=USD/CAD/AUD/...)', () => {
  assert.equal(detectCurrency('45.00 CAD'), 'CAD');
  assert.equal(detectCurrency('AUD 45.00'), 'AUD');
  assert.equal(detectCurrency('CHF 45.00'), 'CHF', 'il franco non ha un simbolo dedicato, solo il codice');
});

test('detectCurrency: nessun indizio -> null, mai una valuta indovinata a caso', () => {
  assert.equal(detectCurrency('-45,00'), null);
  assert.equal(detectCurrency('1.234,56'), null);
  assert.equal(detectCurrency(''), null);
  assert.equal(detectCurrency(null), null);
});

// ---- copertura GLOBALE (~150 valute, non solo EUR/USD/GBP): chi vive
// altrove nel mondo non deve vedere le proprie transazioni scartate ----

test('detectCurrency: valute di ogni continente, non solo europee/nordamericane', () => {
  assert.equal(detectCurrency('NGN 4500'), 'NGN', 'Naira nigeriana');
  assert.equal(detectCurrency('45000 IDR'), 'IDR', 'Rupia indonesiana');
  assert.equal(detectCurrency('BRL 45,00'), 'BRL', 'Real brasiliano');
  assert.equal(detectCurrency('₹450'), 'INR', 'Rupia indiana (simbolo)');
  assert.equal(detectCurrency('₦4500'), 'NGN', 'Naira (simbolo)');
  assert.equal(detectCurrency('฿450'), 'THB', 'Baht thailandese (simbolo)');
  assert.equal(detectCurrency('KES 4500'), 'KES', 'Scellino keniano');
  assert.equal(detectCurrency('45.00 PKR'), 'PKR', 'Rupia pakistana');
  assert.equal(detectCurrency('45,00 VES'), 'VES', 'Bolivar venezuelano');
});

test('parseCellAmount: importi in valute globali si leggono correttamente, non solo EUR/USD/GBP', () => {
  assert.equal(parseCellAmount('NGN 4500'), 4500);
  assert.equal(parseCellAmount('45000 IDR'), 45000);
  assert.equal(parseCellAmount('₹450'), 450);
  assert.equal(parseCellAmount('KES 4500'), 4500);
});

// ---- FALSI POSITIVI: alcuni codici ISO reali coincidono con parole comuni
// inglesi (ALL=lek albanese, TRY=lira turca, TOP=pa'anga tongano,
// SOS=scellino somalo) — un codice isolato in un paragrafo qualunque non
// deve MAI risultare in una valuta, solo se adiacente a un numero ----

test('detectCurrency: parole comuni che coincidono con codici ISO reali NON scattano lontano da un numero', () => {
  assert.equal(detectCurrency('PLEASE TRY AGAIN LATER'), null);
  assert.equal(detectCurrency('ALL SERVICES INCLUDED, NO EXTRA FEES'), null);
  assert.equal(detectCurrency('TOP UP YOUR ACCOUNT ANYTIME'), null);
  assert.equal(detectCurrency('SOS EMERGENCY CONTACT UPDATED'), null);
});

test('detectCurrency: lo stesso codice ISO funziona quando è davvero adiacente a un importo', () => {
  assert.equal(detectCurrency('TRY 45.00'), 'TRY');
  assert.equal(detectCurrency('45.00 TRY'), 'TRY');
});

test('detectCurrency: un codice non deve scattare da dentro una parola più lunga ("TALL", "ALLOWANCE")', () => {
  assert.equal(detectCurrency('TALL BUILDING FEE 45.00'), null);
  assert.equal(detectCurrency('ANNUAL ALLOWANCE 45.00'), null);
});

test('estratto SPAGNOLO (Cargo/Abono): 2 transazioni, verso corretto', async () => {
  const { spanishLayout } = await import('./fixtures/pdf-layouts.js');
  const txs = extractTransactionsFromItems(spanishLayout());
  assert.equal(txs.length, 2);
  assert.equal(txs[0].type, 'uscita'); // Cargo = uscita
  assert.equal(txs[0].amount, 45.80);
  assert.equal(txs[1].type, 'entrata'); // Abono = entrata (nomina)
  assert.equal(txs[1].amount, 1850);
});

test('estratto TEDESCO (Soll/Haben): 2 transazioni, verso corretto', async () => {
  const { germanLayout } = await import('./fixtures/pdf-layouts.js');
  const txs = extractTransactionsFromItems(germanLayout());
  assert.equal(txs.length, 2);
  assert.equal(txs[0].type, 'uscita'); // Soll = dare/uscita
  assert.equal(txs[1].type, 'entrata'); // Haben = avere/entrata (Gehalt)
  assert.equal(txs[1].amount, 2100);
});

test('estratto BRASILE/PT (Débito/Crédito, Descrição): 2 transazioni, verso corretto', async () => {
  const { brazilLayout } = await import('./fixtures/pdf-layouts.js');
  const txs = extractTransactionsFromItems(brazilLayout());
  assert.equal(txs.length, 2);
  assert.equal(txs[0].type, 'uscita'); // Débito = uscita
  assert.equal(txs[0].amount, 85.40);
  assert.equal(txs[1].type, 'entrata'); // Crédito = entrata (salario)
  assert.equal(txs[1].amount, 3200);
});

test('CONFERMA Revolut pagamento (chiave-valore): importo, data, descrizione, uscita, NO falso crypto', async () => {
  const { revolutPaymentConfirmation } = await import('./fixtures/pdf-layouts.js');
  const txs = extractTransactionsFromItems(revolutPaymentConfirmation());
  assert.equal(txs.length, 1);
  assert.equal(txs[0].amount, 38.08);        // importo (non la fee €0)
  assert.equal(txs[0].type, 'uscita');
  assert.equal(txs[0].date.getMonth(), 4);   // maggio
  assert.equal(txs[0].date.getDate(), 26);
  assert.ok(/IREN MERCATO SPA/.test(txs[0].description));
  assert.notEqual(txs[0].category, 'crypto'); // "Payment Token" NON deve dare crypto
});

test('CONFERMA acquisto STOCK → categoria etf', async () => {
  const { brokerStockConfirmation } = await import('./fixtures/pdf-layouts.js');
  const txs = extractTransactionsFromItems(brokerStockConfirmation());
  assert.equal(txs.length, 1);
  assert.equal(txs[0].amount, 500);
  assert.equal(txs[0].category, 'etf');
});

test('CONFERMA acquisto CRYPTO → categoria crypto', async () => {
  const { cryptoBuyConfirmation } = await import('./fixtures/pdf-layouts.js');
  const txs = extractTransactionsFromItems(cryptoBuyConfirmation());
  assert.equal(txs.length, 1);
  assert.equal(txs[0].amount, 250);
  assert.equal(txs[0].category, 'crypto');
});
