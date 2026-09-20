'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAccountantReport, renderAccountantReportHTML } from './accountant-export.js';
import { addCollectionEntry, collectionInvoiceId } from '../invoice/collection-workspace.js';

test('export: totale e scomposizione rispettano la copertura previdenziale selezionata', () => {
  const tx = { '2026-02': [{ type:'entrata', date:'2026-02-10', amount:10000, taxable:true }] };
  const base = buildAccountantReport([], tx, 2026, 'forfettario');
  const ridotta = buildAccountantReport([], tx, 2026, 'forfettario', { altraCoperturaPrevidenziale:true });
  assert.ok(ridotta.accantonamento.dovuto < base.accantonamento.dovuto);
  const somma = ridotta.accantonamento.scomposizione.reduce((s,v) => s + v.importo,0);
  assert.ok(Math.abs(somma - ridotta.accantonamento.dovuto) <= .01);
});

const fattura = (n, client, imponibile, date, extra = {}) => ({ number: n, year: +date.slice(0, 4), client, imponibile, date, description: 'consulenza', ...extra });
const entrata = (date, amount, description, id, taxable = true) => ({ id, type: 'entrata', date, amount, description, category: 'stipendio', taxable });

test('report: abbinamento esplicito parziale prevale sulla stima e mostra residuo netto',()=>{
  const invoice=fattura(1,'Rossi',100,'2026-01-01',{paymentSnapshot:{amountDue:102,currency:'EUR'}});
  const tx={m:[{...entrata('2026-02-01',100,'Rossi','uuid'),currency:'EUR'}]};
  const {ledger}=addCollectionEntry([invoice],tx,{}, {id:'a',invoiceId:collectionInvoiceId(invoice),receiptId:'uuid',amount:50});
  const r=buildAccountantReport([invoice],tx,2026,'forfettario',{invoiceCollections:ledger});
  assert.equal(r.incassato,50);
  assert.equal(r.fatture[0].stato,'parziale');
  assert.equal(r.fatture[0].residuoNetto,52);
  assert.equal(r.incassi[0].confidenza,'confermato');
  assert.match(renderAccountantReportHTML(r),/Parziale/);
  const stale=buildAccountantReport([{...invoice,client:'Modificato'}],tx,2026,'forfettario',{invoiceCollections:ledger});
  assert.equal(stale.incassato,0);
  assert.equal(stale.anomalie.abbinamentiDaRivedere,1);
});

test('export: incasso di gennaio include la fattura di dicembre senza duplicare il fatturato', () => {
  const invoices = [fattura(1, 'Alfa', 1000, '2025-12-20'), fattura(1, 'Beta', 2000, '2026-02-01')];
  const tx = { '2026-01': [entrata('2026-01-10', 1000, 'Alfa', 'uuid-old')] };
  const before = JSON.stringify({ invoices, tx });
  const report = buildAccountantReport(invoices, tx, 2026, 'forfettario');
  assert.equal(report.fatturato, 2000);
  assert.equal(report.incassato, 1000);
  assert.equal(report.fatture.length, 1);
  assert.equal(report.incassi.length, 1);
  assert.equal(report.incassi[0].annoFattura, 2025);
  assert.equal(report.incassi[0].importo, 1000);
  assert.equal(JSON.stringify({ invoices, tx }), before);
  assert.match(renderAccountantReportHTML(report), /Incassi abbinati/);
});

test('export: stessa transazione non paga fatture di due anni nel riepilogo', () => {
  const invoices = [fattura(1, 'Alfa', 1000, '2025-12-20'), fattura(1, 'Alfa', 1000, '2026-01-01')];
  const tx = { '2026-01': [entrata('2026-01-10', 1000, 'Alfa', 'uuid-shared')] };
  const report = buildAccountantReport(invoices, tx, 2026, 'forfettario');
  assert.equal(report.incassato, 1000);
  assert.equal(report.fatture[0].stato, 'non incassata');
});

test('buildAccountantReport: scenario completo — fatturato/incassato/scadenze/non incassate, stessa aritmetica dei moduli esistenti', () => {
  const invoices = [
    fattura(1, 'Alfa Spa', 10000, '2026-02-10'),
    fattura(2, 'Beta Srl', 5000, '2026-06-10'), // non incassata
  ];
  const transactions = {
    '2026-03': [entrata('2026-03-05', 10000, 'bonifico Alfa', 'a')],
  };
  const report = buildAccountantReport(invoices, transactions, 2026, 'forfettario', { now: new Date(Date.UTC(2026, 7, 1)) });
  assert.equal(report.anno, 2026);
  assert.equal(report.fatturato, 15000);
  assert.equal(report.incassato, 10000);
  assert.equal(report.differenzaFatturatoIncassato, 5000);
  assert.equal(report.fatture.length, 2);
  assert.equal(report.fatture.find(f => f.numero === 1).stato, 'incassata');
  assert.equal(report.fatture.find(f => f.numero === 2).stato, 'non incassata');
  assert.equal(report.fattureNonIncassate.length, 1);
  assert.equal(report.fattureNonIncassate[0].cliente, 'Beta Srl');
  assert.ok(report.accantonamento.dovuto > 0);
});

test('buildAccountantReport: anno senza fatture -> riepilogo vuoto, mai un crash', () => {
  const report = buildAccountantReport([], {}, 2026, 'forfettario');
  assert.equal(report.fatturato, 0);
  assert.equal(report.incassato, 0);
  assert.equal(report.fatture.length, 0);
  assert.equal(report.scadenze.length, 0);
});

test('buildAccountantReport: filtra SOLO le fatture dell\'anno richiesto', () => {
  const invoices = [fattura(1, 'Alfa', 1000, '2025-05-01'), fattura(2, 'Beta', 2000, '2026-05-01')];
  const report = buildAccountantReport(invoices, {}, 2026, 'forfettario');
  assert.equal(report.fatture.length, 1);
  assert.equal(report.fatture[0].cliente, 'Beta');
});

test('buildAccountantReport: entrate ambigue non confermate segnalate come anomalia, non tassate d\'ufficio', () => {
  const transactions = { '2026-04': [{ id: 'x', type: 'entrata', date: '2026-04-01', amount: 800, description: 'bonifico ricevuto', category: 'stipendio' }] };
  const report = buildAccountantReport([], transactions, 2026, 'forfettario');
  assert.equal(report.anomalie.entrateAmbigueDaConfermare, 1);
  assert.equal(report.accantonamento.dovuto, 0, 'l\'entrata ambigua non va tassata d\'ufficio');
});

test('renderAccountantReportHTML: documento valido, dati presenti, input escapato, disclaimer onesto', () => {
  const report = buildAccountantReport(
    [fattura(1, 'Cliente <XSS>', 1000, '2026-01-10')],
    { '2026-02': [{ type: 'entrata', date: '2026-02-01', amount: 1000, description: 'bonifico Cliente', category: 'x', id: 'a' }] },
    2026, 'forfettario',
  );
  const html = renderAccountantReportHTML(report, { emitter: 'Studio Bianchi' });
  assert.match(html, /Studio Bianchi/);
  assert.match(html, /Cliente &lt;XSS&gt;/);
  assert.doesNotMatch(html, /Cliente <XSS>/);
  assert.match(html, /non un documento fiscale ufficiale/);
  assert.match(html, /Incassata/);
});
