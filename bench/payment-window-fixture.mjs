import {addCollectionEntry,collectionInvoiceId} from '../src/invoice/collection-workspace.js';
export function paymentWindowFixture(country='IT',currency='EUR'){
 const invoices=[1,2,3,4].map(number=>({number,year:2026,country,client:'Client TEST',date:number===4?'2026-09-01':'2026-08-01',paymentSnapshot:{amountDue:100,currency}}));
 const s={invoices,transactions:{m:[10,20,30].map((d,i)=>({id:`test-${i}`,type:'entrata',amount:100,currency,date:`2026-08-${d+1}`}))}};
 for(let i=0;i<3;i++)s.invoiceCollections=addCollectionEntry(invoices,s.transactions,s.invoiceCollections||{},{id:`p-${i}`,invoiceId:collectionInvoiceId(invoices[i]),receiptId:`test-${i}`,amount:100}).ledger;
 return s;
}
export const syntheticPaymentDataset={version:1,kind:'synthetic',cases:[['IT','EUR'],['CH','CHF'],['ES','EUR']].flatMap(([country,currency])=>[20,50].map(days=>{
 const snapshot=paymentWindowFixture(country,currency);return {id:`${country}-${days}`,snapshot,snapshotCapturedOn:'2026-09-01',asOf:'2026-09-01',invoiceId:collectionInvoiceId(snapshot.invoices[3]),settledOn:new Date(Date.parse('2026-09-01')+days*86400000).toISOString().slice(0,10)};
}))};
