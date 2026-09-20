import {test} from 'node:test';
import assert from 'node:assert/strict';
import {paymentWindowFixture} from '../../bench/payment-window-fixture.mjs';
import {observePaymentWindows,scoreObservedPaymentWindows} from './payment-window-observations.js';
import {addCollectionEntry,collectionInvoiceId} from './collection-workspace.js';
test('previsione salvata prima del saldo, riaperture senza duplicati, misura dopo conferma',()=>{
 const s=paymentWindowFixture();s.paymentWindowObservations=observePaymentWindows(s,'IT','2026-09-01').observations;
 assert.equal(s.paymentWindowObservations.length,1);assert.equal(observePaymentWindows(s,'IT','2026-09-02').changed,false);
 assert.equal(scoreObservedPaymentWindows(s).pending,1);
 s.transactions.m.push({id:'new',type:'entrata',amount:100,currency:'EUR',date:'2026-09-21'});
 s.invoiceCollections=addCollectionEntry(s.invoices,s.transactions,s.invoiceCollections,{id:'last',invoiceId:collectionInvoiceId(s.invoices[3]),receiptId:'new',amount:100}).ledger;
 const result=scoreObservedPaymentWindows(JSON.parse(JSON.stringify(s)),'2026-09-22');assert.equal(result.measured,1);assert.equal(result.coverage,1);assert.equal(result.meanAbsoluteErrorDays,0);
 assert.equal(result.baseline30DaysError,10);assert.equal(result.improvementDays,10);
 s.invoices[3].client='Changed';assert.equal(scoreObservedPaymentWindows(s).measured,undefined);
});
test('future payments and observations cannot count as outcomes; overdue invoices stay visible',()=>{
 const s=paymentWindowFixture();s.paymentWindowObservations=observePaymentWindows(s,'IT','2026-09-01').observations;
 s.transactions.m.push({id:'future',type:'entrata',amount:100,currency:'EUR',date:'2026-10-10'});
 s.invoiceCollections=addCollectionEntry(s.invoices,s.transactions,s.invoiceCollections,{id:'future-link',invoiceId:collectionInvoiceId(s.invoices[3]),receiptId:'future',amount:100}).ledger;
 const r=scoreObservedPaymentWindows(s,'2026-10-02');assert.equal(r.measured,0);assert.equal(r.pending,1);assert.equal(r.overduePending,1);assert.equal(r.coverage,null);
 assert.equal(scoreObservedPaymentWindows(s,'2026-08-31').rows[0].status,'not-observed-yet');
 assert.equal(scoreObservedPaymentWindows(s,'2026-02-30').invalid,true);
});
test('same-cohort baseline and pending counts are separated by country',()=>{
 for(const [country,currency] of [['IT','EUR'],['CH','CHF'],['ES','EUR']]){
  const s=paymentWindowFixture(country,currency);s.paymentWindowObservations=observePaymentWindows(s,country,'2026-09-01').observations;
  const r=scoreObservedPaymentWindows(s,'2026-10-02');assert.equal(r.countries[country].pending,1);assert.equal(r.countries[country].overduePending,1);assert.equal(r.baseline30DaysError,null);assert.equal(r.provenanceVerified,false);
 }
});
test('incasso preesistente inserito dopo non è una previsione prospettica',()=>{
 const s=paymentWindowFixture();s.paymentWindowObservations=observePaymentWindows(s,'IT','2026-09-19').observations;
 s.transactions.m.push({id:'old',type:'entrata',amount:100,currency:'EUR',date:'2026-09-10'});
 s.invoiceCollections=addCollectionEntry(s.invoices,s.transactions,s.invoiceCollections,{id:'last',invoiceId:collectionInvoiceId(s.invoices[3]),receiptId:'old',amount:100}).ledger;
 const r=scoreObservedPaymentWindows(s);assert.equal(r.measured,0);assert.equal(r.rows[0].status,'not-prospective');
});
