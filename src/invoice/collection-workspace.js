import { reconcileInvoiceAllocations } from './payment-allocation.js';

export const collectionInvoiceId = f => JSON.stringify([f.country || 'IT', f.year, f.number]);
export const collectionInvoiceVersion = f => JSON.stringify([f.client,f.date,f.imponibile,f.regime,f.voci,f.paymentSnapshot]);
export const collectionReceiptVersion = t => JSON.stringify([t.type,t.amount,t.currency,t.date,t.description,t.taxable]);

// Sidecar data never changes invoice history, transactions or their hash chain.
export function collectionWorkspace(invoices = [], transactions = {}, ledger = {}) {
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  // An absent legacy journal is allowed; a damaged journal must never mean zero allocations.
  if (!Array.isArray(invoices) || invoices.some(f=>!record(f)) || !record(transactions) ||
      Object.values(transactions).some(rows=>!Array.isArray(rows) || rows.some(t=>!record(t))) ||
      !record(ledger) || ['targets','currencies'].some(key=>ledger[key] !== undefined &&
        (!record(ledger[key]) || Object.values(ledger[key]).some(value=>!record(value)))) ||
      (ledger.entries !== undefined && (!Array.isArray(ledger.entries) || ledger.entries.some(e=>!record(e))))) {
    return {bills:[],receipts:[],entries:[],stale:[],ok:false,
      result:{ok:false,errors:[{code:'invalid-workspace'}],invoices:[],receipts:[]}};
  }
  const targets = ledger.targets || {}, currencies = ledger.currencies || {};
  const bills = (invoices || []).map(f => {
    const id=collectionInvoiceId(f), version=collectionInvoiceVersion(f);
    const target=targets[id]?.version === version ? targets[id] : f.paymentSnapshot;
    return {id, baseVersion:version, version:JSON.stringify([version,target?.amountDue,target?.currency]), label:`${f.number}/${f.year} · ${f.client || ''}`, amountDue:target?.amountDue, currency:target?.currency};
  });
  const receipts=Object.values(transactions || {}).flat().filter(t => t?.type === 'entrata' && t.taxable !== false && t.id != null).map(t => {
    const id=String(t.id), version=collectionReceiptVersion(t);
    const currency=t.currency || (currencies[id]?.version === version ? currencies[id].currency : undefined);
    return {id,baseVersion:version,version:JSON.stringify([version,currency]),label:t.description || '',date:t.date,amount:Number(t.amount),currency};
  });
  const entries=Array.isArray(ledger.entries) ? ledger.entries : [];
  const stale=entries.filter(e => bills.find(f=>f.id===e.invoiceId)?.version !== e.invoiceVersion || receipts.find(t=>t.id===e.receiptId)?.version !== e.receiptVersion);
  const readyBill=bills.filter(f=>f.amountDue > 0 && ['EUR','CHF'].includes(f.currency));
  const readyReceipt=receipts.filter(t=>t.amount > 0 && ['EUR','CHF'].includes(t.currency));
  const result=reconcileInvoiceAllocations(readyBill,readyReceipt,stale.length ? [] : entries);
  return {bills,receipts,entries,stale,result,ok:stale.length===0 && result.ok};
}

export function addCollectionEntry(invoices,transactions,ledger,entry) {
  const current=collectionWorkspace(invoices,transactions,ledger);
  if (!current.ok) return {ok:false};
  const invoice=current.bills.find(f=>f.id===entry.invoiceId), receipt=current.receipts.find(t=>t.id===entry.receiptId);
  if (!invoice || !receipt) return {ok:false};
  const next={...ledger,entries:[...current.entries,{...entry,invoiceVersion:invoice.version,receiptVersion:receipt.version}]};
  return collectionWorkspace(invoices,transactions,next).ok ? {ok:true,ledger:next} : {ok:false};
}
