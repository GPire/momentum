import test from 'node:test';
import assert from 'node:assert/strict';
const { computeInvoice, nextInvoiceNumber, suggestFromHistory, detectRecurringClients, renderInvoiceHTML, buildInvoiceEmail, pendingSdiTransmission, BOLLO_IMPORTO } = await import('./invoice-engine.js');

test('pendingSdiTransmission: elenca le e-fatture create ma non ancora trasmesse', () => {
  const invoices = [
    { number: 1, year: 2026, client: 'A', imponibile: 1000, country: 'IT', isElectronic: true, sdiTransmitted: false },
    { number: 2, year: 2026, client: 'B', imponibile: 500, country: 'IT', isElectronic: true, sdiTransmitted: true }, // gia' trasmessa
    { number: 3, year: 2026, client: 'C', imponibile: 300, country: 'IT', isElectronic: false }, // solo PDF cortesia
    { number: 4, year: 2026, client: 'D', imponibile: 800, country: 'DEFAULT', isElectronic: true }, // estero, no SdI
  ];
  const r = pendingSdiTransmission(invoices);
  assert.equal(r.count, 1);
  assert.equal(r.totaleImponibile, 1000);
  assert.equal(r.invoices[0].client, 'A');
});

test('pendingSdiTransmission: nessuna e-fattura pendente → count 0', () => {
  assert.equal(pendingSdiTransmission([]).count, 0);
  assert.equal(pendingSdiTransmission([{ number: 1, year: 2026, isElectronic: false }]).count, 0);
});

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
  const html = renderInvoiceHTML(inv, { number: 3, year: 2026, client: 'Acme <SRL>', description: 'Consulenza', country: 'IT' });
  assert.ok(/Fattura n\. 3\/2026/.test(html));
  assert.ok(/Netto a ricevere/.test(html));
  assert.ok(/1002,00/.test(html));                 // totale col bollo
  assert.ok(/Acme &lt;SRL&gt;/.test(html));         // input escapato (no XSS)
  assert.ok(/forfettario/i.test(html));             // nota regime
  assert.ok(/SdI/.test(html) && /cortesia/i.test(html)); // disclaimer IT chiaro
});

test('bollo a carico dell\'emittente: non entra nel totale addebitato al cliente', () => {
  const cliente = computeInvoice({ imponibile: 1000, regime: 'forfettario', bolloACliente: true });
  const emittente = computeInvoice({ imponibile: 1000, regime: 'forfettario', bolloACliente: false });
  assert.equal(cliente.totaleFattura, 1002);   // bollo addebitato
  assert.equal(emittente.totaleFattura, 1000);  // bollo NON addebitato (lo paga l'emittente)
});

test('buildInvoiceEmail: genera oggetto, corpo con importi reali, destinatario e mailto', () => {
  const inv = computeInvoice({ imponibile: 1000, regime: 'ordinario' });
  const e = buildInvoiceEmail({ inv, meta: { number: 5, year: 2026, client: 'Studio Rossi', description: 'Consulenza', emitter: 'Mario Bianchi', emitterInfo: 'IBAN IT60X...', date: '20/07/2026' }, clientEmail: 'studio@rossi.it' });
  assert.equal(e.to, 'studio@rossi.it');
  assert.ok(/Fattura n\. 5\/2026 — Mario Bianchi/.test(e.subject));
  assert.ok(/Gentile Studio Rossi/.test(e.body));
  assert.ok(/1\.?268,80/.test(e.body) || /Totale fattura: 1268,80/.test(e.body)); // totale reale ordinario
  assert.ok(/netto a ricevere: 1068,80/.test(e.body));                            // netto reale
  assert.ok(/IBAN IT60X/.test(e.body));
  assert.ok(e.mailto.startsWith('mailto:studio%40rossi.it?subject='));
});

test('buildInvoiceEmail: senza email cliente → to vuoto, nessun dato inventato', () => {
  const inv = computeInvoice({ imponibile: 500, regime: 'forfettario' });
  const e = buildInvoiceEmail({ inv, meta: { number: 1, year: 2026, client: 'Beta' } });
  assert.equal(e.to, '');
  assert.ok(e.mailto.startsWith('mailto:?subject='));
  assert.ok(!/netto a ricevere/.test(e.body)); // forfettario senza ritenuta: netto == totale, non lo ripete
});

test('suggestFromHistory: restituisce anche l\'email appresa del cliente', () => {
  const invoices = [{ client: 'Acme', imponibile: 1000, description: 'X', date: '2026-01-10', clientEmail: 'a@acme.it' }];
  assert.equal(suggestFromHistory(invoices, 'acme').lastEmail, 'a@acme.it');
});

test('detectRecurringClients: rileva cliente MENSILE + importo tipico + fattura del mese da fare', () => {
  const invoices = [
    { client: 'Studio Rossi', imponibile: 1000, description: 'Consulenza', date: '2026-05-05', clientEmail: 'a@rossi.it', regime: 'forfettario' },
    { client: 'Studio Rossi', imponibile: 1000, description: 'Consulenza', date: '2026-06-05' },
    { client: 'Studio Rossi', imponibile: 1100, description: 'Consulenza', date: '2026-07-05' },
  ];
  // ad agosto (mese senza fattura) → dovuta
  const r = detectRecurringClients(invoices, new Date(2026, 7, 20));
  const rossi = r.find(x => x.client === 'Studio Rossi');
  assert.equal(rossi.cadence, 'mensile');
  assert.equal(rossi.monthly, true);
  assert.equal(rossi.dueThisMonth, true);
  assert.ok(rossi.typicalAmount >= 1000 && rossi.typicalAmount <= 1100);
  assert.equal(rossi.lastEmail, 'a@rossi.it');
});

test('detectRecurringClients: se la fattura del mese è già emessa → non è "dovuta"', () => {
  const invoices = [
    { client: 'Acme', imponibile: 500, date: '2026-06-10' },
    { client: 'Acme', imponibile: 500, date: '2026-07-10' },
  ];
  const r = detectRecurringClients(invoices, new Date(2026, 6, 20)); // luglio, già emessa il 10
  assert.equal(r.find(x => x.client === 'Acme').dueThisMonth, false);
});

test('detectRecurringClients: cliente con una sola fattura → non ricorrente', () => {
  const r = detectRecurringClients([{ client: 'UnaVolta', imponibile: 300, date: '2026-05-01' }], new Date(2026, 6, 1));
  assert.equal(r.length, 0);
});

test('detectRecurringClients: gap irregolari → cadenza null (nessuna invenzione)', () => {
  const invoices = [
    { client: 'Sporadico', imponibile: 200, date: '2026-01-01' },
    { client: 'Sporadico', imponibile: 800, date: '2026-05-15' },
  ];
  const r = detectRecurringClients(invoices, new Date(2026, 6, 1));
  assert.equal(r[0].cadence, null);
  assert.equal(r[0].dueThisMonth, false);
});

test('detectRecurringClients: le fatture DOVUTE questo mese vengono prima', () => {
  const invoices = [
    { client: 'Mensile', imponibile: 1000, date: '2026-06-05' },
    { client: 'Mensile', imponibile: 1000, date: '2026-07-05' },
    { client: 'AltraTantum', imponibile: 500, date: '2026-06-01' },
    { client: 'AltraTantum', imponibile: 500, date: '2026-06-20' },
  ];
  const r = detectRecurringClients(invoices, new Date(2026, 7, 15)); // agosto
  assert.equal(r[0].client, 'Mensile'); // dovuta questo mese → prima
});

test('detectRecurringClients: flag ESPLICITO recurring vale già dalla PRIMA fattura', () => {
  const invoices = [{ client: 'NuovoCliente', imponibile: 800, description: 'Retainer', date: '2026-06-10', recurring: true, cadence: 'mensile', clientEmail: 'x@y.it' }];
  // a luglio (mese senza fattura) → dovuta, anche con UNA sola fattura
  const r = detectRecurringClients(invoices, new Date(2026, 6, 20));
  const c = r.find(x => x.client === 'NuovoCliente');
  assert.ok(c, 'il cliente esplicitamente ricorrente deve comparire con 1 sola fattura');
  assert.equal(c.monthly, true);
  assert.equal(c.dueThisMonth, true);
  assert.equal(c.typicalAmount, 800);
});
