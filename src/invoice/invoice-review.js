import {collectionInvoiceId} from './collection-workspace.js';
const canonical=value=>Array.isArray(value) ? value.map(canonical) : value && typeof value==='object' ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])) : value;
const invoiceVersion=invoice=>JSON.stringify(canonical(invoice));
const valid=e=>e && typeof e.id==='string' && e.id.length>0 && typeof e.invoiceId==='string' && typeof e.version==='string' && Number.isFinite(Date.parse(e.at)) && (e.type==='request' ? typeof e.note==='string' && e.note.trim().length>0 && e.note.length<=1000 : e.type==='resolve' && typeof e.requestId==='string');

// Append-only local journal. A declaration by the user, never an SdI result.
export function invoiceReviewState(invoice,events=[]) {
  const id=collectionInvoiceId(invoice), version=invoiceVersion(invoice);
  const list=Array.isArray(events)?events:[];
  const history=list.filter(e=>valid(e) && e.invoiceId===id);
  const invalid=!Array.isArray(events) || list.some(e=>!valid(e)) || new Set(list.filter(Boolean).map(e=>e.id)).size!==list.length;
  const requests=history.filter(e=>e.type==='request');
  const resolved=requests.filter(r=>!invalid && history.some((e,i)=>e.type==='resolve' && e.requestId===r.id && e.version===version && i>history.indexOf(r)));
  const open=requests.filter(r=>!resolved.includes(r));
  return {history,open,resolved,stale:open.filter(r=>history.some(e=>e.type==='resolve' && e.requestId===r.id && e.version!==version)),invalid};
}

export function addInvoiceReviewEvent(invoices,events,event) {
  if(!Array.isArray(events) || events.some(e=>!valid(e)) || !event || events.some(e=>e.id===event.id)) return {ok:false};
  const found=invoices.filter(f=>collectionInvoiceId(f)===event.invoiceId);
  if(found.length!==1) return {ok:false};
  const invoice=found[0], state=invoiceReviewState(invoice,events);
  const next={...event,...(event.type==='request'?{note:event.note?.trim()}:{}),version:invoiceVersion(invoice)};
  if(state.invalid || !valid(next) || (next.type==='resolve' && !state.open.some(r=>r.id===next.requestId))) return {ok:false};
  return {ok:true,events:[...events,next]};
}

// External files supply requests only, never approvals or invoice mutations.
export function previewInvoiceReviewImport(invoices,events,text) {
  const fail=reason=>({ok:false,reason});
  if(typeof text!=='string' || text.length>1000000) return fail('format');
  let packet;
  try { packet=JSON.parse(text); } catch { return fail('format'); }
  if(packet?.format!=='momentum-invoice-review' || packet.version!==1 || !packet.invoice || !Array.isArray(packet.review?.history) || packet.review.history.length>500) return fail('format');
  if(!Array.isArray(invoices) || !Array.isArray(events)) return fail('format');
  const id=collectionInvoiceId(packet.invoice), found=invoices.filter(f=>f && collectionInvoiceId(f)===id);
  if(found.length!==1) return fail('invoice');
  const invoice=found[0], version=invoiceVersion(invoice);
  if(version!==invoiceVersion(packet.invoice)) return fail('version');
  if(invoiceReviewState(invoice,events).invalid) return fail('journal');
  const history=packet.review.history;
  if(history.some(e=>!valid(e) || e.invoiceId!==id) || new Set(history.map(e=>e.id)).size!==history.length) return fail('format');
  const requests=[]; let duplicates=0;
  for(const e of history.filter(e=>e.type==='request')) {
    const existing=events.find(x=>x.id===e.id);
    if(existing) {
      if(existing.type!=='request' || existing.invoiceId!==id || existing.version!==e.version || existing.note!==e.note || existing.at!==e.at) return fail('conflict');
      duplicates++; continue;
    }
    if(e.version!==version) return fail('version');
    requests.push({id:e.id,invoiceId:id,version,type:'request',note:e.note,at:e.at,source:'imported-file'});
  }
  return {ok:true,invoiceId:id,requests,duplicates,ignored:history.filter(e=>e.type==='resolve').length,events:[...events,...requests]};
}
