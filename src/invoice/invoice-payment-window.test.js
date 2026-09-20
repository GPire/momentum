import {test} from 'node:test';
import assert from 'node:assert/strict';
import {invoicePaymentWindow} from './invoice-payment-window.js';
import {addCollectionEntry,collectionInvoiceId} from './collection-workspace.js';
import {invoicePaymentWindowCopy} from '../i18n/invoice-payment-window.js';
function fixture(country='IT',currency='EUR'){
 const invoices=[1,2,3,4].map(number=>({number,year:2026,country,client:'Cliente esempio',date:number===4?'2026-09-01':'2026-08-01',paymentSnapshot:{amountDue:100,currency}}));
 const s={invoices,transactions:{m:[10,20,30].map((days,i)=>({id:`uuid-${i}`,type:'entrata',currency,amount:100,date:`2026-08-${String(days+1).padStart(2,'0')}`}))}};
 for(let i=0;i<3;i++)s.invoiceCollections=addCollectionEntry(invoices,s.transactions,s.invoiceCollections||{},{id:`p-${i}`,invoiceId:collectionInvoiceId(invoices[i]),receiptId:`uuid-${i}`,amount:100}).ledger;
 return s;
}
for(const [country,currency] of [['IT','EUR'],['CH','CHF'],['ES','EUR']])test(`${country}: finestra basata su tre fatture confermate`,()=>{
 const s=fixture(country,currency),id=collectionInvoiceId(s.invoices[3]);
 assert.deepEqual(invoicePaymentWindow(s,id,'2026-09-19'),{samples:3,fromDays:10,toDays:30,from:'2026-09-11',to:'2026-10-01'});
 assert.equal(invoicePaymentWindow(s,id,'2026-08-15'),null);
 s.transactions.m[0].amount=200;assert.equal(invoicePaymentWindow(s,id,'2026-09-19'),null);
});
test('non inventa previsioni con storico insufficiente, cliente diverso o data impossibile',()=>{
 const s=fixture(),id=collectionInvoiceId(s.invoices[3]);
 s.invoices[3].client='Altro';assert.equal(invoicePaymentWindow(s,id,'2026-09-19'),null);
 s.invoices[3].client='Cliente esempio';assert.equal(invoicePaymentWindow(s,id,'2026-02-30'),null);
 s.invoiceCollections.entries.pop();assert.equal(invoicePaymentWindow(s,id,'2026-09-19'),null);
});
test('rate non aumentano il campione; testi disponibili in sette lingue',()=>{
 const s=fixture(),id=collectionInvoiceId(s.invoices[3]);
 const first=s.invoiceCollections.entries[0];
 s.invoiceCollections.entries[0]={...first,amount:40};
 s.invoiceCollections.entries.push({...first,id:'second-part',amount:60});
 assert.equal(invoicePaymentWindow(s,id,'2026-09-19').samples,3);
 for(const lang of ['it','en','de','fr','es','nl','pt'])for(const v of Object.values(invoicePaymentWindowCopy(lang)))assert.ok(v.length>10);
});
