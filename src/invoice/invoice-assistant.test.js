import {test} from 'node:test';
import assert from 'node:assert/strict';
import {suggestInvoiceReceipts} from './invoice-assistant.js';
import {collectionInvoiceId,addCollectionEntry} from './collection-workspace.js';
import {invoiceNextStepCopy,invoiceAssistantCopy} from '../i18n/invoice-next-step.js';
const f={number:1,year:2026,client:'Studio Rossi',date:'2026-09-01',paymentSnapshot:{amountDue:100,currency:'EUR'}};
const tx=(id,description,amount=100,currency='EUR')=>({id,type:'entrata',date:'2026-09-19',description,amount,currency});
test('motivi espliciti, nessun suggerimento solo per importo, valuta e date rispettate',()=>{
  const s={invoices:[f],transactions:{m:[tx('a','Bonifico Rossi'),tx('b','Altro cliente'),tx('c','Rossi',100,'CHF'),{...tx('d','Rossi'),date:'2025-01-01'}]}};
  const result=suggestInvoiceReceipts(s,collectionInvoiceId(f));
  assert.equal(result.length,1);assert.deepEqual(result[0].reasons,['client','amount']);
  assert.equal(s.transactions.m.length,4);
});
test('apprende esempi dagli abbinamenti confermati e li esclude se invalidati',()=>{
  const old={...f,number:2};const s={invoices:[f,old],transactions:{m:[tx('a','ACME PAY'),tx('b','ACME PAY',40)]}};
  assert.equal(suggestInvoiceReceipts(s,collectionInvoiceId(f)).length,0);
  s.invoiceCollections=addCollectionEntry(s.invoices,s.transactions,{}, {id:'link',invoiceId:collectionInvoiceId(old),receiptId:'a',amount:100}).ledger;
  const results=suggestInvoiceReceipts(s,collectionInvoiceId(f));
  assert.equal(results[0].receiptId,'b');assert.deepEqual(results[0].reasons,['learned']);assert.equal(results[0].amount,40);
  s.transactions.m[0].amount=200;
  assert.equal(suggestInvoiceReceipts(s,collectionInvoiceId(f)).length,0);
});
test('candidati ambigui restano separati, massimo tre e testi multilingue',()=>{
  const s={invoices:[f],transactions:{m:[1,2,3,4].map(i=>tx(String(i),'Rossi'))}};
  assert.equal(suggestInvoiceReceipts(s,collectionInvoiceId(f)).length,3);
  assert.equal(s.invoiceCollections,undefined);
  for(const lang of ['it','en','de','fr','es','nl','pt'])for(const value of Object.values({...invoiceNextStepCopy(lang),...invoiceAssistantCopy(lang)}))assert.ok(value.length);
});
