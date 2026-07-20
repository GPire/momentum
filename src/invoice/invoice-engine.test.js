import test from 'node:test';
import assert from 'node:assert/strict';
const { computeInvoice, nextInvoiceNumber, suggestFromHistory, renderInvoiceHTML, BOLLO_IMPORTO } = await import('./invoice-engine.js');

test('forfettario 1000€: no IVA, no ritenuta, bollo 2€ sopra soglia', () => {
  const r = computeInvoice({ imponibile: 1000, regime: 'forfettario' });
  assert.equal(r.ivaImporto, 0);
  assert.equal(r.ritenutaImporto, 0);
  assert.equal(r.bolloImporto, 2);
  assert.equal(r.totaleFattura, 1002);       // 1000 + bollo
  assert.equal(r.nettoARicevere, 1002);      // nessuna ritenuta
  assert.ok(/forfettario/i.test(r.note));
});

test('forfettario sotto 77,47€: nessuna marca da bollo', () => {
  const r = computeInvoice({ imponibile: 50, regime: 'forfettario' });
  assert.equal(r.bolloImporto, 0);
  assert.equal(r.totaleFattura, 50);
});

test('ordinario professionista 1000€: IVA 22% su (imponibile+cassa), ritenuta 20%', () => {
  const r = computeInvoice({ imponibile: 1000, regime: 'ordinario' });
  // cassa 4% = 40; imponibile IVA = 1040; IVA 22% = 228.80; ritenuta 20% su 1000 = 200
  assert.equal(r.cassaImporto, 40);
  assert.equal(r.ivaImporto, 228.80);
  assert.equal(r.ritenutaImporto, 200);
  assert.equal(r.totaleFattura, 1268.80);    // 1000 + 40 + 228.80
  assert.equal(r.nettoARicevere, 1068.80);   // totale − ritenuta
});

test('aliquote personalizzabili (es. cassa 0, IVA agevolata)', () => {
  const r = computeInvoice({ imponibile: 1000, regime: 'ordinario', cassaPct: 0, ivaPct: 0.10, ritenutaPct: 0 });
  assert.equal(r.cassaImporto, 0);
  assert.equal(r.ivaImporto, 100);            // 10% di 1000
  assert.equal(r.ritenutaImporto, 0);
  assert.equal(r.totaleFattura, 1100);
});

test('imponibile 0 o mancante → tutto 0, mai NaN', () => {
  const r = computeInvoice({ regime: 'forfettario' });
  assert.equal(r.totaleFattura, 0);
  assert.equal(r.nettoARicevere, 0);
});

test('nextInvoiceNumber: max dell\'anno + 1, riparte per anno', () => {
  const invoices = [
    { year: 2026, number: 1 }, { year: 2026, number: 2 }, { year: 2025, number: 9 },
  ];
  assert.equal(nextInvoiceNumber(invoices, 2026), 3);
  assert.equal(nextInvoiceNumber(invoices, 2027), 1); // nuovo anno riparte da 1
  assert.equal(nextInvoiceNumber([], 2026), 1);
});

test('suggestFromHistory: predice importo tipico e ultima descrizione dal cliente', () => {
  const invoices = [
    { client: 'Acme SRL', imponibile: 1000, description: 'Consulenza gennaio', date: '2026-01-10' },
    { client: 'Acme SRL', imponibile: 1200, description: 'Consulenza marzo', date: '2026-03-10' },
    { client: 'Beta SpA', imponibile: 500, description: 'Sviluppo', date: '2026-02-01' },
  ];
  const s = suggestFromHistory(invoices, 'acme');
  assert.equal(s.client, 'Acme SRL');
  assert.equal(s.invoiceCount, 2);
  assert.ok(s.suggestedImponibile >= 1000 && s.suggestedImponibile <= 1200);
  assert.equal(s.lastDescription, 'Consulenza marzo'); // la più recente
});

test('suggestFromHistory: cliente mai visto → null, nessuna invenzione', () => {
  assert.equal(suggestFromHistory([{ client: 'Acme', imponibile: 1000 }], 'zzz'), null);
  assert.equal(suggestFromHistory([], 'acme'), null);
});

test('renderInvoiceHTML: documento valido, importi e note presenti, input escapato', () => {
  const inv = computeInvoice({ imponibile: 1000, regime: 'forfettario' });
  const html = renderInvoiceHTML(inv, { number: 3, year: 2026, client: 'Acme <SRL>', description: 'Consulenza' });
  assert.ok(/Fattura n\. 3\/2026/.test(html));
  assert.ok(/Netto a ricevere/.test(html));
  assert.ok(/1002,00/.test(html));                 // totale col bollo
  assert.ok(/Acme &lt;SRL&gt;/.test(html));         // input escapato (no XSS)
  assert.ok(/forfettario/i.test(html));             // nota regime
  assert.ok(/fattura elettronica SdI/.test(html));  // disclaimer onesto presente
});

test('bollo a carico dell\'emittente: non entra nel totale addebitato al cliente', () => {
  const cliente = computeInvoice({ imponibile: 1000, regime: 'forfettario', bolloACliente: true });
  const emittente = computeInvoice({ imponibile: 1000, regime: 'forfettario', bolloACliente: false });
  assert.equal(cliente.totaleFattura, 1002);   // bollo addebitato
  assert.equal(emittente.totaleFattura, 1000);  // bollo NON addebitato (lo paga l'emittente)
});
