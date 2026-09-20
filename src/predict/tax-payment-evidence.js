const cents=value=>{
  if(!/^\d+(?:\.\d{1,2})?$/.test(String(value))) return null;
  const n=Math.round(Number(value)*100);
  return Number.isSafeInteger(n) ? n : null;
};
// A declared Erario row, not a national validation or a submitted F24.
export function taxPaymentEvidence(input,cashPaid,taxYear) {
  const code=String(input?.code||'').trim(), reference=String(input?.reference||'').trim();
  const cash=cents(cashPaid), credit=cents(input?.credit ?? 0);
  if(!/^\d{4}$/.test(code) || !reference || reference.length>120 || !Number.isInteger(taxYear) || taxYear<1900 || taxYear>9999 || cash===null || credit===null || cash+credit<=0 || !Number.isSafeInteger(cash+credit)) return {ok:false};
  return {ok:true,evidence:{version:1,country:'IT',section:'Erario',code,reference,taxYear,
    cashPaid:cash/100,credit:credit/100,debit:(cash+credit)/100,status:'user-declared'}};
}
