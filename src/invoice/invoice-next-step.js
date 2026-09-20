import {collectionWorkspace,collectionInvoiceId} from './collection-workspace.js';
import {invoiceReviewState} from './invoice-review.js';

// Workflow status is not a fiscal approval or proof of legal delivery.
export function invoiceNextSteps(state={},country='IT') {
  const invoices=Array.isArray(state.invoices)?state.invoices.filter(f=>f && typeof f==='object' && (f.country||'IT')===country && ['IT','CH','ES'].includes(country)):[];
  let workspace;
  try {workspace=collectionWorkspace(state.invoices,state.transactions,state.invoiceCollections);} catch {workspace={ok:false};}
  return invoices.map(invoice=>{
    const id=collectionInvoiceId(invoice), review=invoiceReviewState(invoice,state.invoiceReviewEvents||[]);
    const balance=workspace.ok?workspace.result.invoices.find(f=>f.id===id):null;
    const reason=review.invalid?'journal':!workspace.ok?'reconcile':review.open.length?'review':!balance?'amount':balance.remaining>0?'collect':'recorded';
    return {id,label:`${invoice.number}/${invoice.year} · ${invoice.client||''}`,reason,open:review.open.length,remaining:balance?.remaining,currency:balance?.currency};
  }).sort((a,b)=>['journal','reconcile','review','amount','collect','recorded'].indexOf(a.reason)-['journal','reconcile','review','amount','collect','recorded'].indexOf(b.reason));
}
