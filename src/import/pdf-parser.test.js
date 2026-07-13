import test from 'node:test';
import assert from 'node:assert/strict';

// Shim minimo per moduli scritti per il browser (stesso pattern degli altri test).
globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };
globalThis.document = globalThis.document || { querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {}, getElementById: () => null };

const { extractTransactionsFromItems, parseCellDate, parseCellAmount } = await import('./pdf-parser.js');
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

// ---- regressione parseCellAmount (comportamento già verificato, fissato) ----

test('parseCellAmount: formati IT/US e segni invariati', () => {
  assert.equal(parseCellAmount('1.234,56'), 1234.56);
  assert.equal(parseCellAmount('1,234.56'), 1234.56);
  assert.equal(parseCellAmount('-32,90'), -32.9);
  assert.equal(parseCellAmount('1.500'), 1500);
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
