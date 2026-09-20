import {invoicePaymentWindow} from './invoice-payment-window.js';
import {collectionInvoiceId} from './collection-workspace.js';
const day=86400000;
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const mean=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;

// A case contains a historical snapshot, not today's ledger with dates removed.
// Provenance is declared by the supplier; this does not authenticate real data.
export function evaluatePaymentWindows(dataset){
  if(dataset?.version!==1 || !['synthetic','real-anonymized'].includes(dataset.kind) || !Array.isArray(dataset.cases))throw new Error('Invalid evaluation dataset');
  const seen=new Set(), results=[];
  for(const c of dataset.cases){
    if(!c || typeof c.id!=='string'||seen.has(c.id)||!validDate(c.asOf)||!validDate(c.snapshotCapturedOn)||c.snapshotCapturedOn>c.asOf||!validDate(c.settledOn)||c.settledOn<=c.asOf)throw new Error('Invalid case or temporal leakage');
    seen.add(c.id);
    if(!Array.isArray(c.snapshot?.invoices))throw new Error('Missing snapshot');
    const invoice=c.snapshot.invoices.find(f=>f&&collectionInvoiceId(f)===c.invoiceId);
    if(!invoice||!validDate(invoice.date)||invoice.date>c.asOf)throw new Error('Invalid target invoice');
    if(Object.values(c.snapshot.transactions||{}).flat().some(t=>!validDate(t?.date)||t.date>c.asOf))throw new Error('Future transaction in snapshot');
    const estimate=invoicePaymentWindow(c.snapshot,c.invoiceId,c.asOf),actual=Date.parse(c.settledOn);
    results.push({id:c.id,country:invoice.country||'IT',predicted:!!estimate,
      ...(estimate?{covered:c.settledOn>=estimate.from&&c.settledOn<=estimate.to,widthDays:(Date.parse(estimate.to)-Date.parse(estimate.from))/day,errorDays:Math.abs((Date.parse(estimate.from)+Date.parse(estimate.to))/2-actual)/day,baseline30DaysError:Math.abs(Date.parse(invoice.date)+30*day-actual)/day}: {})});
  }
  const summarize=rows=>{const p=rows.filter(r=>r.predicted);return {cases:rows.length,predictions:p.length,abstentions:rows.length-p.length,coverage:p.length?p.filter(r=>r.covered).length/p.length:null,meanAbsoluteErrorDays:mean(p.map(r=>r.errorDays)),meanWindowWidthDays:mean(p.map(r=>r.widthDays)),baseline30DaysError:mean(p.map(r=>r.baseline30DaysError))};};
  return {kind:dataset.kind,provenanceVerified:false,scope:'settled cases only; not an unbiased estimate for all invoices',...summarize(results),countries:Object.fromEntries(['IT','CH','ES'].map(country=>[country,summarize(results.filter(r=>r.country===country))])),results};
}
