import {collectionWorkspace,collectionInvoiceId,collectionInvoiceVersion} from './collection-workspace.js';
import {invoicePaymentWindow} from './invoice-payment-window.js';
const day=86400000;
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const valid=r=>r?.model==='payment-window-v1'&&typeof r.invoiceId==='string'&&typeof r.invoiceVersion==='string'&&validDate(r.asOf)&&validDate(r.from)&&validDate(r.to)&&r.from<=r.to&&Number.isInteger(r.samples)&&r.samples>=3;
// Local prospective observations: first forecast per invoice/version only.
// This is not tamper-proof evidence and never uploads financial data.
export function observePaymentWindows(state,country,asOf){
 const previous=state.paymentWindowObservations||[];
 if(!Array.isArray(previous)||previous.some(r=>!valid(r))||!validDate(asOf))return {changed:false,observations:previous};
 const observations=[...previous];
 for(const f of state.invoices||[]){
  if(!f||(f.country||'IT')!==country)continue;
  const invoiceId=collectionInvoiceId(f),invoiceVersion=collectionInvoiceVersion(f);
  if(observations.some(r=>r.invoiceId===invoiceId&&r.invoiceVersion===invoiceVersion))continue;
  const prediction=invoicePaymentWindow(state,invoiceId,asOf);
  if(prediction)observations.push({model:'payment-window-v1',invoiceId,invoiceVersion,asOf,...prediction});
 }
 return {changed:observations.length!==previous.length,observations};
}
export function scoreObservedPaymentWindows(state,asOf=new Date().toISOString().slice(0,10)){
 const records=state.paymentWindowObservations||[];
 if(!Array.isArray(records)||!validDate(asOf))return {invalid:true,rows:[]};
 let w;try{w=collectionWorkspace(state.invoices,state.transactions,state.invoiceCollections);}catch{return {invalid:true,rows:[]};}
 if(!w.ok)return {invalid:true,rows:[]};
 const seen=new Set();
 const rows=records.map(r=>{
  if(!valid(r))return {status:'invalid'};
  const key=JSON.stringify([r.invoiceId,r.invoiceVersion]);
  if(seen.has(key))return {status:'invalid'};seen.add(key);
  if(r.asOf>asOf)return {status:'not-observed-yet'};
  const f=state.invoices.find(f=>collectionInvoiceId(f)===r.invoiceId),balance=w.result.invoices.find(b=>b.id===r.invoiceId);
  if(!f||collectionInvoiceVersion(f)!==r.invoiceVersion)return {status:'changed'};
  const pending={status:'pending',country:f.country||'IT',overdue:r.to<asOf};
  if(!balance||balance.remaining>0)return pending;
  const dates=w.entries.filter(e=>e.invoiceId===r.invoiceId).map(e=>w.receipts.find(t=>t.id===e.receiptId)?.date);
  if(!dates.length||dates.some(d=>!validDate(d)))return {status:'invalid'};
  const settledOn=dates.sort().at(-1);
  if(settledOn>asOf)return pending;
  // Old payments entered later do not prove that the forecast preceded payment.
  if(settledOn<=r.asOf)return {status:'not-prospective'};
  if(!validDate(f.date))return {status:'invalid'};
  return {status:'measured',country:f.country||'IT',covered:settledOn>=r.from&&settledOn<=r.to,errorDays:Math.abs((Date.parse(r.from)+Date.parse(r.to))/2-Date.parse(settledOn))/day,baseline30DaysError:Math.abs(Date.parse(f.date)+30*day-Date.parse(settledOn))/day,widthDays:(Date.parse(r.to)-Date.parse(r.from))/day};
 });
 const summarize=rows=>{
  const measured=rows.filter(r=>r.status==='measured'),pending=rows.filter(r=>r.status==='pending');
  const mean=key=>measured.length?measured.reduce((sum,r)=>sum+r[key],0)/measured.length:null;
  const error=mean('errorDays'),baseline=mean('baseline30DaysError');
  return {measured:measured.length,pending:pending.length,overduePending:pending.filter(r=>r.overdue).length,coverage:measured.length?measured.filter(r=>r.covered).length/measured.length:null,meanAbsoluteErrorDays:error,baseline30DaysError:baseline,improvementDays:error===null?null:baseline-error,meanWindowWidthDays:mean('widthDays')};
 };
 return {invalid:rows.some(r=>r.status==='invalid'),asOf,provenanceVerified:false,scope:'settled outcomes only; pending invoices reported separately',rows,observed:records.length,...summarize(rows),countries:Object.fromEntries(['IT','CH','ES'].map(country=>[country,summarize(rows.filter(r=>r.country===country))]))};
}
