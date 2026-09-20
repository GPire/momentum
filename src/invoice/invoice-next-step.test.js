import {test} from 'node:test';
import assert from 'node:assert/strict';
import {invoiceNextSteps} from './invoice-next-step.js';
import {addInvoiceReviewEvent} from './invoice-review.js';
import {addCollectionEntry,collectionInvoiceId} from './collection-workspace.js';
const f={number:1,year:2026,client:'Test',paymentSnapshot:{amountDue:100,currency:'EUR'}};
const s={invoices:[f],transactions:{'2026-09':[{id:'uuid-income',type:'entrata',amount:100,currency:'EUR',date:'2026-09-19'}]}};
test('prossimo passo segue incasso parziale e saldo senza modificare gli originali',()=>{
  assert.equal(invoiceNextSteps(s)[0].reason,'collect');
  const partial=addCollectionEntry(s.invoices,s.transactions,{}, {id:'p',invoiceId:collectionInvoiceId(f),receiptId:'uuid-income',amount:40});
  const state={...s,invoiceCollections:partial.ledger};
  assert.equal(invoiceNextSteps(state)[0].remaining,60);
  const paid=addCollectionEntry(s.invoices,s.transactions,partial.ledger,{id:'q',invoiceId:collectionInvoiceId(f),receiptId:'uuid-income',amount:60});
  assert.equal(invoiceNextSteps({...s,invoiceCollections:paid.ledger})[0].reason,'recorded');
  assert.equal(s.transactions['2026-09'][0].amount,100);
});
test('controlli aperti, importi mancanti e corruzione prevalgono sul completamento',()=>{
  const events=addInvoiceReviewEvent([f],[],{id:'r',invoiceId:collectionInvoiceId(f),type:'request',note:'Controllare',at:'2026-09-19'}).events;
  assert.equal(invoiceNextSteps({...s,invoiceReviewEvents:events})[0].reason,'review');
  assert.equal(invoiceNextSteps({invoices:[{number:2,year:2026}]})[0].reason,'amount');
  assert.equal(invoiceNextSteps({...s,invoiceReviewEvents:[null]})[0].reason,'journal');
  assert.equal(invoiceNextSteps({...s,invoiceCollections:{entries:[null]}})[0].reason,'reconcile');
  assert.equal(invoiceNextSteps({invoices:[{...f,country:'CH'}]}).length,0);
});
