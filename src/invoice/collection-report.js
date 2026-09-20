import {collectionWorkspace,collectionInvoiceId} from './collection-workspace.js';

// Confirmed liquidity appendix. Never a substitute for a country's tax base.
export function collectionReport(invoices,transactions,ledger,country,year) {
  const w=collectionWorkspace(invoices,transactions,ledger);
  const source=new Map(invoices.map(f=>[collectionInvoiceId(f),f]));
  const rows=[];
  let reviewCount=0;
  for(const e of w.entries) {
    const f=source.get(e.invoiceId);
    if(f && (f.country||'IT')!==country) continue;
    const t=w.receipts.find(t=>t.id===e.receiptId);
    if(!w.ok || !f || !t || !Number.isFinite(Date.parse(t.date))) { reviewCount++; continue; }
    if(new Date(t.date).getUTCFullYear()!==year) continue;
    const balance=w.result.invoices.find(i=>i.id===e.invoiceId);
    rows.push({invoiceId:e.invoiceId,invoiceNumber:f.number,invoiceYear:f.year,client:f.client,
      receiptId:t.id,date:t.date,amount:e.amount,currency:balance.currency,remaining:balance.remaining});
  }
  return {ok:reviewCount===0,reviewCount,rows};
}
