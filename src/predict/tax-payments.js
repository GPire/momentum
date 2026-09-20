// ============================================================
// TAX-PAYMENTS — il salvadanaio fiscale è VIRTUALE, mai un trasferimento
// ============================================================
// Correzione esplicita dell'utente durante questa sessione: Momentum non ha
// accesso al conto bancario né a un'API di pagamento — non può "mettere da
// parte" soldi veri. Quello che PUÒ fare: calcolare quanto andrebbe
// accantonato (tax.js: taxSetAsideForPeriod, già esistente, applicato a
// TUTTE le fatture invece che a un periodo — nessun nuovo motore di calcolo
// serve qui) e lasciare che l'utente registri i versamenti REALI che ha
// fatto (F24, acconto, saldo) — l'unica cosa che Momentum non può dedurre
// da sola dai dati che ha. La differenza tra i due è "quanto ti manca
// ancora da mettere via", mai un numero che finge di sapere cosa è successo
// fuori dall'app. Funzioni pure, stato additivo (stesso stile di
// backup-health.js/recovery-shares.js): mai mutato in place.
'use strict';
import {taxPaymentEvidence} from './tax-payment-evidence.js';

const validYear=year=>Number.isInteger(year) && year>=1900 && year<=9999;
const validAmount=n=>Number.isFinite(Number(n)) && Number(n)>0 && Number.isSafeInteger(Math.round(Number(n)*100));
const validPayment=p=>validAmount(p?.amount) || (p?.amount===0 && p.document?.status==='user-declared' && p.document.taxYear===p.taxYear && taxPaymentEvidence(p.document,0,p.taxYear).ok);

export function recordTaxPayment(payments, amount, { note = '', date = new Date().toISOString(), taxYear, document } = {}) {
  const importo = Number(amount);
  const evidence=document ? taxPaymentEvidence(document,importo,taxYear) : null;
  if ((evidence && !evidence.ok) || (!validAmount(importo) && !(importo===0 && evidence?.ok)) || !Number.isFinite(Date.parse(date)) || (taxYear!==undefined && !validYear(taxYear))) return payments || [];
  const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, amount: +importo.toFixed(2), note, date };
  return [...(payments || []), {...entry,...(taxYear!==undefined ? {taxYear,country:'IT'} : {}),...(evidence ? {document:evidence.evidence} : {})}];
}

export function assignTaxPaymentYear(payments,id,year) {
  if(!validYear(year) || payments.filter(p=>p?.id===id).length!==1) return payments;
  return payments.map(p=>p.id===id ? {...p,taxYear:year,...(p.document && p.taxYear!==year ? {document:{...p.document,status:'needs-review'}} : {})} : p);
}

export function removeTaxPayment(payments, id) {
  return (payments || []).filter((p) => p.id !== id);
}

// totalSetAside = quanto risulta dovuto in totale (tax.js:taxSetAsideForPeriod
// su tutte le fatture). Ritorna la situazione completa e leggibile: mai un
// solo numero senza la sua scomposizione.
export function taxReserveStatus(totalSetAside, payments, {year} = {}) {
  // BUG REALE trovato dal test: senza questa normalizzazione, un totale
  // assente/NaN (es. calcolo fiscale non ancora disponibile al primo avvio)
  // propagava NaN fino alla UI — un "NaN €" mostrato dove l'utente si
  // aspetta dei soldi è il tipo di errore che fa perdere fiducia all'istante.
  const dovuto = Number.isFinite(+totalSetAside) ? +totalSetAside : 0;
  const list=payments || [];
  const invalidCount=list.filter(p=>!validPayment(p)).length;
  const valid=list.filter(p=>validPayment(p) && (!p.country || p.country==='IT'));
  const unassigned=year===undefined ? [] : valid.filter(p=>!validYear(p.taxYear));
  const eligible=year===undefined ? valid : valid.filter(p=>validYear(year) && p.taxYear===year);
  const versato = eligible.reduce((s,p)=>s+Math.round(Number(p.amount)*100),0)/100;
  const daAccantonare = Math.max(0, +(dovuto - versato).toFixed(2));
  return {
    totaleDovuto: +dovuto.toFixed(2),
    versato: +versato.toFixed(2),
    daAccantonare,
    inPari: daAccantonare <= 0.01,
    unassignedCount: unassigned.length,
    unassignedAmount: unassigned.reduce((s,p)=>s+Math.round(Number(p.amount)*100),0)/100,
    invalidCount,
  };
}
