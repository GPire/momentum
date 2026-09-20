import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addInvoiceReviewEvent,previewInvoiceReviewImport} from './invoice-review.js';
import {collectionInvoiceId} from './collection-workspace.js';
import {invoiceReviewImportCopy,invoiceReviewImportError} from '../i18n/invoice-review-import.js';
const invoice={number:1,year:2026,client:'Rossi',imponibile:100};
const events=addInvoiceReviewEvent([invoice],[],{id:'a',invoiceId:collectionInvoiceId(invoice),type:'request',note:'Indirizzo?',at:'2026-09-19T12:00:00Z'}).events;
const packet=history=>JSON.stringify({format:'momentum-invoice-review',version:1,invoice,review:{history}});
test('preview non muta dati, import ripetuto idempotente e approvazioni ignorate',()=>{
  const all=addInvoiceReviewEvent([invoice],events,{id:'b',invoiceId:collectionInvoiceId(invoice),type:'resolve',requestId:'a',at:'2026-09-19T13:00:00Z'}).events;
  const original=[];const result=previewInvoiceReviewImport([invoice],original,packet(all));
  assert.equal(result.ok,true);assert.equal(original.length,0);assert.equal(result.requests.length,1);assert.equal(result.ignored,1);
  const twice=previewInvoiceReviewImport([invoice],result.events,packet(all));
  assert.equal(twice.ok,true);assert.equal(twice.requests.length,0);assert.equal(twice.duplicates,1);
});
test('versione cambiata, conflitti e pacchetti corrotti non scrivono nulla',()=>{
  assert.equal(previewInvoiceReviewImport([{...invoice,imponibile:101}],[],packet(events)).ok,false);
  assert.equal(previewInvoiceReviewImport([],[],packet(events)).ok,false);
  for(const history of [[null],[...events,...events],[{...events[0],version:'old'}]]) assert.equal(previewInvoiceReviewImport([invoice],[],packet(history)).ok,false);
  assert.equal(previewInvoiceReviewImport([invoice],events,packet([{...events[0],note:'Altro'}])).reason,'conflict');
  assert.equal(previewInvoiceReviewImport([invoice],[],'bad').ok,false);
  assert.equal(previewInvoiceReviewImport([invoice],[],'x'.repeat(1000001)).ok,false);
});
test('feedback di recupero distinto e disponibile nelle sette lingue',()=>{
  for(const lang of ['it','en','de','fr','es','nl','pt']){
    for(const value of Object.values(invoiceReviewImportCopy(lang)))assert.ok(value.length);
    const messages=['invoice','version','conflict','journal','format'].map(reason=>invoiceReviewImportError(lang,reason));
    assert.equal(new Set(messages).size,5);
  }
});
