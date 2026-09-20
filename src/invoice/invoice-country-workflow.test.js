import {test} from 'node:test';
import assert from 'node:assert/strict';
import {invoiceNextSteps} from './invoice-next-step.js';
import {suggestInvoiceReceipts} from './invoice-assistant.js';
import {collectionInvoiceId,addCollectionEntry} from './collection-workspace.js';
import {addInvoiceReviewEvent,invoiceReviewState,previewInvoiceReviewImport} from './invoice-review.js';

for(const [country,currency,client] of [['IT','EUR','Studio Rossi'],['CH','CHF','Müller Beratung'],['ES','EUR','García Diseño']]) {
  test(`${country}: suggerimento → conferma parziale → saldo → controllo → esportazione/rientro`,()=>{
    const invoice={country,client,number:1,year:2026,date:'2026-09-01',paymentSnapshot:{amountDue:100,currency}};
    const id=collectionInvoiceId(invoice);
    const state={invoices:[invoice],transactions:{m:[{id:'uuid-1',type:'entrata',amount:40,currency,date:'2026-09-10',description:client},{id:'uuid-2',type:'entrata',amount:60,currency,date:'2026-09-12',description:client}]}};
    assert.equal(invoiceNextSteps(state,country)[0].reason,'collect');
    const first=suggestInvoiceReceipts(state,id)[0];assert.equal(first.receiptId,'uuid-1');
    state.invoiceCollections=addCollectionEntry(state.invoices,state.transactions,{}, {id:'p1',invoiceId:id,receiptId:first.receiptId,amount:first.amount}).ledger;
    assert.equal(invoiceNextSteps(state,country)[0].remaining,60);
    const second=suggestInvoiceReceipts(state,id)[0];assert.equal(second.receiptId,'uuid-2');
    state.invoiceCollections=addCollectionEntry(state.invoices,state.transactions,state.invoiceCollections,{id:'p2',invoiceId:id,receiptId:second.receiptId,amount:second.amount}).ledger;
    assert.equal(invoiceNextSteps(state,country)[0].reason,'recorded');assert.deepEqual(suggestInvoiceReceipts(state,id),[]);
    const external=addInvoiceReviewEvent([invoice],[],{id:'check',invoiceId:id,type:'request',note:'Check client address',at:'2026-09-19'}).events;
    const packet=JSON.stringify({format:'momentum-invoice-review',version:1,invoice,review:{history:external}});
    const received=previewInvoiceReviewImport(state.invoices,[],packet);assert.equal(received.ok,true);
    state.invoiceReviewEvents=received.events;
    assert.equal(invoiceNextSteps(state,country)[0].reason,'review');
    assert.equal(previewInvoiceReviewImport(state.invoices,received.events,packet).requests.length,0);
    const done=addInvoiceReviewEvent([invoice],received.events,{id:'done',invoiceId:id,type:'resolve',requestId:'check',at:'2026-09-20'});
    assert.equal(invoiceReviewState(invoice,done.events).open.length,0);
    assert.equal(invoiceReviewState({...invoice,client:'Changed'},done.events).open.length,1);
  });
}
test('identificativi uguali in paesi diversi non mescolano liste e controlli',()=>{
  const invoices=['IT','CH','ES'].map(country=>({country,number:1,year:2026,client:'Same name'}));
  for(const country of ['IT','CH','ES']){
    const rows=invoiceNextSteps({invoices},country);assert.equal(rows.length,1);assert.equal(rows[0].id,collectionInvoiceId(invoices.find(f=>f.country===country)));
  }
});
