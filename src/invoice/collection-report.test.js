import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addCollectionEntry,collectionInvoiceId} from './collection-workspace.js';
import {buildAccountantReportCh,buildAccountantReportEs,renderAccountantReportHTMLIntl} from '../predict/accountant-export-intl.js';
import {accountantReportToCsv} from '../predict/accountant-export-structured.js';

for (const country of ['CH','ES']) test(`${country}: incassi parziali documentati separati dal calcolo fiscale`,()=>{
  const currency=country==='CH'?'CHF':'EUR';
  const invoice={country,number:1,year:2025,date:'2025-12-01',client:'Cliente <test>',imponibile:100,paymentSnapshot:{amountDue:102,currency}};
  const tx={m:[{id:'uuid-1',type:'entrata',amount:150,date:'2026-02-01',currency,taxable:true}]};
  const {ledger}=addCollectionEntry([invoice],tx,{}, {id:'a',invoiceId:collectionInvoiceId(invoice),receiptId:'uuid-1',amount:50});
  const build=country==='CH'?buildAccountantReportCh:buildAccountantReportEs;
  const base=build(tx,2026,{redditoManuale:60000});
  const report=build(tx,2026,{redditoManuale:60000,invoices:[invoice],invoiceCollections:ledger});
  assert.equal(report.incassato,base.incassato);
  assert.deepEqual(report.contributi,base.contributi);
  assert.equal(report.invoiceCollections.rows[0].amount,50);
  assert.equal(report.invoiceCollections.rows[0].remaining,52);
  assert.equal(report.invoiceCollections.rows[0].invoiceYear,2025);
  assert.equal(report.invoiceCollections.rows[0].currency,currency);
  assert.equal(build(tx,2025,{invoices:[invoice],invoiceCollections:ledger}).invoiceCollections.rows.length,0);
  const stale=build(tx,2026,{invoices:[{...invoice,client:'changed'}],invoiceCollections:ledger});
  assert.equal(stale.invoiceCollections.ok,false);
  assert.equal(stale.invoiceCollections.rows.length,0);
  for(const lang of ['it','en','de','fr','es','nl','pt']) {
    const html=renderAccountantReportHTMLIntl(report,{lang});
    assert.ok(html.includes('Cliente &lt;test&gt;'));
    assert.ok(!html.includes('Cliente <test>'));
  }
  assert.match(accountantReportToCsv(report),/uuid-1/);
  const other=country==='CH'?buildAccountantReportEs:buildAccountantReportCh;
  assert.equal(other(tx,2026,{invoices:[invoice],invoiceCollections:ledger}).invoiceCollections.rows.length,0);
});
