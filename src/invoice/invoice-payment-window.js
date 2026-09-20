import {collectionWorkspace,collectionInvoiceId} from './collection-workspace.js';
const day=86400000;
const identity=s=>String(s||'').normalize('NFKC').toLowerCase().trim().replace(/\s+/g,' ');
const date=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s?Date.parse(s):NaN;

// Empirical range, not a due date or a calibrated probability interval.
// Count settled invoices, not payments: instalments never inflate the sample.
export function invoicePaymentWindow(state,id,asOf=new Date().toISOString().slice(0,10)){
  const now=date(asOf);if(!Number.isFinite(now))return null;
  let w;try{w=collectionWorkspace(state.invoices,state.transactions,state.invoiceCollections);}catch{return null;}
  if(!w.ok)return null;
  const invoice=(state.invoices||[]).find(f=>collectionInvoiceId(f)===id), current=w.result.invoices.find(r=>r.id===id);
  if(!invoice||!current||current.remaining<=0||!identity(invoice.client)||!Number.isFinite(date(invoice.date))||date(invoice.date)>now)return null;
  const samples=[];
  for(const f of state.invoices){
    const otherId=collectionInvoiceId(f), balance=w.result.invoices.find(b=>b.id===otherId);
    if(otherId===id || (f.country||'IT')!==(invoice.country||'IT') || identity(f.client)!==identity(invoice.client) || !balance || balance.currency!==current.currency || balance.remaining!==0 || !Number.isFinite(date(f.date)))continue;
    const dates=w.entries.filter(e=>e.invoiceId===otherId).map(e=>date(w.receipts.find(t=>t.id===e.receiptId)?.date));
    if(!dates.length||dates.some(d=>!Number.isFinite(d)||d<date(f.date)||d>now))continue;
    const settled=Math.max(...dates), elapsed=(settled-date(f.date))/day;
    if(elapsed<=400 && now-settled<=730*day)samples.push(elapsed);
  }
  if(samples.length<3)return null;
  samples.sort((a,b)=>a-b);
  const fromDays=samples[Math.floor((samples.length-1)*.25)],toDays=samples[Math.ceil((samples.length-1)*.75)];
  return {samples:samples.length,fromDays,toDays,from:new Date(date(invoice.date)+fromDays*day).toISOString().slice(0,10),to:new Date(date(invoice.date)+toDays*day).toISOString().slice(0,10)};
}
