import {test} from 'node:test';
import assert from 'node:assert/strict';
import {collectionWorkspace,addCollectionEntry,collectionInvoiceId,collectionInvoiceVersion,collectionReceiptVersion} from './collection-workspace.js';
import {invoiceCollectionsCopy} from '../i18n/invoice-collections.js';
import {prepareRestoredState} from '../core/restore-safety.js';
const invoice={number:1,year:2026,client:'Rossi',date:'2026-01-01',imponibile:100,paymentSnapshot:{amountDue:102,currency:'EUR'}};
const tx={m:[{id:'import-uuid',type:'entrata',amount:50,date:'2026-02-01',currency:'EUR'}]};
const entry={id:'a',invoiceId:collectionInvoiceId(invoice),receiptId:'import-uuid',amount:50};

test('un registro malformato blocca gli abbinamenti senza cancellare o reinterpretare dati',()=>{
  for(const ledger of [null,[],{entries:{}},{entries:null},{entries:[null]},{targets:[]},{currencies:'EUR'}]) {
    const before=JSON.stringify(ledger);
    const result=collectionWorkspace([invoice],tx,ledger);
    assert.equal(result.ok,false);
    assert.equal(result.result.ok,false);
    assert.equal(addCollectionEntry([invoice],tx,ledger,entry).ok,false);
    assert.equal(JSON.stringify(ledger),before);
  }
});

test('archivi sorgente malformati restituiscono un errore controllato',()=>{
  for(const [invoices,transactions] of [[{},tx],[[null],tx],[[invoice],{m:null}],[[invoice],[]]]) {
    assert.equal(collectionWorkspace(invoices,transactions,{}).ok,false);
  }
  assert.equal(collectionWorkspace(undefined,undefined).ok,true);
});
test('aggiunge un incasso parziale con UUID, conserva i dati originali e torna identico da JSON',()=>{
  const before=JSON.stringify({invoice,tx});
  const added=addCollectionEntry([invoice],tx,{},entry);
  assert.equal(added.ok,true);
  const restored=JSON.parse(JSON.stringify(added.ledger));
  assert.equal(collectionWorkspace([invoice],tx,restored).result.invoices[0].remaining,52);
  assert.equal(JSON.stringify({invoice,tx}),before);
  assert.equal(addCollectionEntry([invoice],tx,restored,{...entry,id:'b',amount:1}).ok,false);
});
test('modifiche al documento o al movimento invalidano la conferma; rimuovere libera il residuo',()=>{
  const {ledger}=addCollectionEntry([invoice],tx,{},entry);
  for(const changed of [{...invoice,client:'Altro'},{...invoice,imponibile:99}]) {
    assert.equal(collectionWorkspace([changed],tx,ledger).ok,false);
  }
  assert.equal(collectionWorkspace([invoice],{m:[{...tx.m[0],description:'changed'}]},ledger).ok,false);
  assert.equal(collectionWorkspace([invoice],tx,{...ledger,entries:[]}).result.invoices[0].remaining,102);
});
test('vecchie fatture e valute mancanti richiedono conferme esplicite',()=>{
  const old={...invoice,paymentSnapshot:undefined}, raw={...tx.m[0],currency:undefined};
  assert.equal(addCollectionEntry([old],{m:[raw]},{},entry).ok,false);
  const ledger={targets:{[collectionInvoiceId(old)]:{amountDue:102,currency:'EUR',version:collectionInvoiceVersion(old)}},
    currencies:{[raw.id]:{currency:'EUR',version:collectionReceiptVersion(raw)}}};
  assert.equal(addCollectionEntry([old],{m:[raw]},ledger,entry).ok,true);
});
test('cumulativo su due fatture e recupero attraverso il percorso di ripristino',()=>{
  const second={...invoice,number:2,paymentSnapshot:{amountDue:60,currency:'EUR'}};
  const bank={m:[{...tx.m[0],amount:150}]};
  const first=addCollectionEntry([invoice,second],bank,{}, {...entry,amount:102});
  const added=addCollectionEntry([invoice,second],bank,first.ledger,{...entry,id:'b',invoiceId:collectionInvoiceId(second),amount:48});
  assert.equal(added.ok,true);
  const restored=prepareRestoredState({},JSON.parse(JSON.stringify({invoices:[invoice,second],transactions:bank,invoiceCollections:added.ledger})),50);
  const r=collectionWorkspace(restored.invoices,restored.transactions,restored.invoiceCollections);
  assert.deepEqual(r.result.invoices.map(i=>i.remaining),[0,12]);
  assert.equal(r.result.receipts[0].remaining,0);
});
test('cambiare il netto confermato invalida gli abbinamenti precedenti',()=>{
  const old={...invoice,paymentSnapshot:undefined}, id=collectionInvoiceId(old);
  const ledger={targets:{[id]:{amountDue:102,currency:'EUR',version:collectionInvoiceVersion(old)}}};
  const added=addCollectionEntry([old],tx,ledger,entry);
  assert.equal(collectionWorkspace([old],tx,{...added.ledger,targets:{[id]:{...ledger.targets[id],amountDue:200}}}).ok,false);
});
test('tutti i controlli hanno testo in sette lingue',()=>{
  const base=Object.keys(invoiceCollectionsCopy('en'));
  for(const lang of ['it','en','fr','de','es','nl','pt']) {
    const strings=invoiceCollectionsCopy(lang);
    assert.deepEqual(Object.keys(strings),base);
    assert.ok(Object.values(strings).every(s=>typeof s==='string' && s.length>0));
  }
});
