// QR requests are payment documents, not tax invoices. Never create income.
export function recordSwissPaymentRequest(invoices,r){
  if(!Array.isArray(invoices)||!r||typeof r.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(r.id)||typeof r.payload!=='string'||!/^SPC\r?\n/.test(r.payload))return {ok:false};
  const n=Number(r.amount),c=Math.round(n*100),date=r.date;
  if(!Number.isFinite(n)||n<=0||!Number.isSafeInteger(c)||Math.abs(n*100-c)>1e-7||!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!Number.isFinite(Date.parse(date)))return {ok:false};
  const record={country:'CH',number:`QR-${r.id}`,year:Number(date.slice(0,4)),date,client:String(r.client||''),description:String(r.description||''),documentKind:'payment-request',paymentSnapshot:{amountDue:n,currency:'CHF'},qrPayload:r.payload};
  const found=invoices.filter(f=>f?.country==='CH'&&f.number===record.number&&f.year===record.year);
  if(found.length)return found.length===1&&JSON.stringify(found[0])===JSON.stringify(record)?{ok:true,invoices,record,duplicate:true}:{ok:false};
  return {ok:true,invoices:[...invoices,record],record,duplicate:false};
}
