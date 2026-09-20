import {test} from 'node:test';
import assert from 'node:assert/strict';
import {taxPaymentEvidence} from './tax-payment-evidence.js';
import {recordTaxPayment,taxReserveStatus,assignTaxPaymentYear} from './tax-payments.js';
test('riga F24: separa cassa, credito e totale, senza dichiarare un esito ufficiale',()=>{
  const r=taxPaymentEvidence({code:'1792',reference:'F24 prova',credit:'25.50'},100,2025);
  assert.equal(r.ok,true);
  assert.equal(r.evidence.debit,125.5);
  assert.equal(r.evidence.cashPaid,100);
  assert.equal(r.evidence.status,'user-declared');
  assert.equal(r.evidence.credit,25.5);
});
test('compensazione totale non equivale a un addebito e richiede un documento',()=>{
  assert.equal(taxPaymentEvidence({code:'1792',reference:'F24 zero',credit:100},0,2025).ok,true);
  assert.equal(taxPaymentEvidence({code:'1792',reference:'',credit:100},0,2025).ok,false);
  const p=recordTaxPayment([],0,{taxYear:2025,document:{code:'1792',reference:'F24 zero',credit:100}});
  assert.equal(p.length,1);
  assert.equal(taxReserveStatus(100,p,{year:2025}).versato,0);
  assert.equal(taxReserveStatus(100,p,{year:2025}).invalidCount,0);
  assert.equal(assignTaxPaymentYear(p,p[0].id,2026)[0].document.status,'needs-review');
});
test('codice formalmente errato, importi invalidi e periodi assenti sono rifiutati',()=>{
  for(const code of ['<script>','1','12345','P10']) assert.equal(taxPaymentEvidence({code,reference:'x',credit:0},100,2025).ok,false);
  for(const credit of [-1,Infinity,'abc',1.001]) assert.equal(taxPaymentEvidence({code:'1792',reference:'x',credit},100,2025).ok,false);
  assert.equal(taxPaymentEvidence({code:'1792',reference:'x',credit:0},100,null).ok,false);
});
