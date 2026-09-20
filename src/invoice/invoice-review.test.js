import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addInvoiceReviewEvent,invoiceReviewState} from './invoice-review.js';
import {collectionInvoiceId} from './collection-workspace.js';
import {prepareRestoredState} from '../core/restore-safety.js';
import {invoiceReviewCopy} from '../i18n/invoice-review.js';
import {buildAccountantReport,renderAccountantReportHTML} from '../predict/accountant-export.js';
import {accountantReportToCsv} from '../predict/accountant-export-structured.js';
const invoice={number:1,year:2026,client:'Rossi',date:'2026-01-01',imponibile:100};
const id=collectionInvoiceId(invoice);
const event={id:'request-1',invoiceId:id,type:'request',note:'Controllare indirizzo cliente',at:'2026-09-19T12:00:00Z'};
test('richiesta, risoluzione e modifica successiva restano tracciate senza mutazioni',()=>{
  const original=[];
  const request=addInvoiceReviewEvent([invoice],original,event);
  assert.equal(request.ok,true);assert.equal(original.length,0);
  assert.equal(invoiceReviewState(invoice,request.events).open.length,1);
  const done=addInvoiceReviewEvent([invoice],request.events,{id:'done-1',invoiceId:id,type:'resolve',requestId:event.id,at:'2026-09-19T13:00:00Z'});
  assert.equal(done.ok,true);
  assert.equal(invoiceReviewState(invoice,done.events).open.length,0);
  assert.equal(addInvoiceReviewEvent([invoice],done.events,{id:'done-2',invoiceId:id,type:'resolve',requestId:event.id,at:'2026-09-19T14:00:00Z'}).ok,false);
  assert.equal(invoiceReviewState({...invoice,client:'Rossi nuovo'},done.events).open.length,1);
  assert.equal(invoiceReviewState({...invoice,client:'Rossi nuovo'},done.events).stale.length,1);
  assert.equal(invoiceReviewState({...invoice,address:'indirizzo nuovo'},done.events).open.length,1);
  assert.equal(invoiceReviewState(Object.fromEntries(Object.entries(invoice).reverse()),done.events).open.length,0);
  const restored=prepareRestoredState({},JSON.parse(JSON.stringify({transactions:{},invoiceReviewEvents:done.events})),50);
  assert.deepEqual(restored.invoiceReviewEvents,done.events);
});
test('esportazione conserva note e cronologia, output HTML protetto, testi in sette lingue',()=>{
  const events=addInvoiceReviewEvent([invoice],[],{...event,note:'<script>da controllare</script>'}).events;
  const report=buildAccountantReport([invoice],{},2026,'forfettario',{invoiceReviewEvents:events});
  assert.equal(report.invoiceReviews[0].open.length,1);
  assert.match(renderAccountantReportHTML(report),/&lt;script&gt;/);
  assert.match(accountantReportToCsv(report),/request-1/);
  for(const lang of ['it','en','de','fr','es','nl','pt']) for(const value of Object.values(invoiceReviewCopy(lang))) assert.ok(value.length);
});
test('eventi duplicati, riferimenti inesistenti e risoluzioni ripetute sono rifiutati',()=>{
  const first=addInvoiceReviewEvent([invoice],[],event).events;
  assert.equal(addInvoiceReviewEvent([invoice],first,event).ok,false);
  assert.equal(addInvoiceReviewEvent([],[],event).ok,false);
  assert.equal(addInvoiceReviewEvent([invoice],[],{...event,type:'resolve',requestId:'missing'}).ok,false);
  assert.equal(addInvoiceReviewEvent([invoice],[],{...event,note:'   '}).ok,false);
});
test('eventi corrotti non vengono trattati come approvazioni',()=>{
  const state=invoiceReviewState(invoice,[null,{...event,version:'old'},{id:'bad',type:'resolve',invoiceId:id,requestId:event.id}]);
  assert.equal(state.open.length,1);
  assert.equal(state.invalid,true);
});
