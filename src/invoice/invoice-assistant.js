import {collectionWorkspace,collectionInvoiceId} from './collection-workspace.js';
import {clienteNellaDescrizione} from '../predict/tax-cash-basis.js';
const normalize=s=>String(s||'').normalize('NFKC').toLocaleLowerCase().trim().replace(/\s+/g,' ');

// Explainable local ranking. Confirmed allocations provide retrieval examples;
// scores are ordering weights, not calibrated probabilities or tax decisions.
export function suggestInvoiceReceipts(state,invoiceId) {
  let w;
  try{w=collectionWorkspace(state.invoices,state.transactions,state.invoiceCollections);}catch{return [];}
  if(!w.ok)return [];
  const f=(state.invoices||[]).find(f=>collectionInvoiceId(f)===invoiceId), balance=w.result.invoices.find(f=>f.id===invoiceId);
  if(!f || !balance || balance.remaining<=0 || !Number.isFinite(Date.parse(f.date)))return [];
  const examples=new Set(w.entries.filter(e=>{
    const previous=state.invoices.find(x=>collectionInvoiceId(x)===e.invoiceId);
    return previous && (previous.country||'IT')===(f.country||'IT') && normalize(previous.client) && normalize(previous.client)===normalize(f.client);
  }).map(e=>normalize(w.receipts.find(t=>t.id===e.receiptId)?.label)).filter(Boolean));
  return w.receipts.flatMap(t=>{
    const available=w.result.receipts.find(r=>r.id===t.id)?.remaining;
    const days=(Date.parse(t.date)-Date.parse(f.date))/86400000;
    if(t.currency!==balance.currency || !(available>0) || !Number.isFinite(days) || days<0 || days>400)return [];
    const reasons=[];
    if(clienteNellaDescrizione(f.client,t.label))reasons.push('client');
    if(examples.has(normalize(t.label)))reasons.push('learned');
    if(!reasons.length)return []; // An equal amount alone is not enough.
    if(Math.round(available*100)===Math.round(balance.remaining*100))reasons.push('amount');
    return [{receiptId:t.id,amount:Math.min(available,balance.remaining),reasons,score:(reasons.includes('client')?4:0)+(reasons.includes('learned')?3:0)+(reasons.includes('amount')?2:0)}];
  }).sort((a,b)=>b.score-a.score || a.receiptId.localeCompare(b.receiptId)).slice(0,3);
}
