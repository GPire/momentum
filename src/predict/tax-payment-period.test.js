import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recordTaxPayment,taxReserveStatus,assignTaxPaymentYear} from './tax-payments.js';
import {buildAccountantReport} from './accountant-export.js';
import {taxPaymentsCopy} from '../i18n/tax-payments.js';
import {prepareRestoredState} from '../core/restore-safety.js';

test('testi disponibili nelle sette lingue',()=>{
  for(const lang of ['it','en','de','fr','es','nl','pt']) for(const text of Object.values(taxPaymentsCopy(lang))) assert.ok(text.length>0);
});

test('un saldo pagato nel 2026 per il 2025 riduce solo il periodo confermato',()=>{
  const payments=recordTaxPayment([],100,{taxYear:2025,date:'2026-06-30'});
  assert.equal(taxReserveStatus(500,payments,{year:2026}).versato,0);
  assert.equal(taxReserveStatus(500,payments,{year:2025}).versato,100);
});
test('vecchi versamenti conservati senza dedurre anno dalla data, correggibili senza duplicati',()=>{
  const old=[{id:'legacy',amount:100,date:'2026-06-30',note:'saldo',custom:'keep'}];
  assert.equal(taxReserveStatus(500,old,{year:2026}).unassignedCount,1);
  assert.equal(taxReserveStatus(500,old,{year:2026}).versato,0);
  const next=assignTaxPaymentYear(old,'legacy',2025);
  assert.equal(next.length,1); assert.equal(next[0].custom,'keep');
  assert.equal(old[0].taxYear,undefined);
  const restored=prepareRestoredState({},JSON.parse(JSON.stringify({transactions:{},taxPayments:next})),50);
  assert.deepEqual(restored.taxPayments,next);
  assert.equal(taxReserveStatus(500,next,{year:2025}).versato,100);
  assert.equal(assignTaxPaymentYear(old,'legacy',NaN),old);
});
test('nessun Infinity, negativo, anno invalido o valuta estera nel totale italiano',()=>{
  assert.deepEqual(recordTaxPayment([],Infinity),[]);
  assert.deepEqual(recordTaxPayment([],1,{taxYear:2026.5}),[]);
  const s=taxReserveStatus(500,[{amount:Infinity,taxYear:2026},{amount:-3,taxYear:2026},{amount:40,taxYear:2026,country:'CH'}],{year:2026});
  assert.equal(s.versato,0);
  assert.equal(s.invalidCount,2);
});
test('report annuale non usa vecchi versamenti senza anno o pagamenti di altri periodi',()=>{
  const r=buildAccountantReport([],{},2026,'forfettario',{taxPayments:[{id:'a',amount:100,date:'2026-01-01'},{id:'b',amount:50,taxYear:2025},{id:'c',amount:20,taxYear:2026}]});
  assert.equal(r.accantonamento.versato,20);
  assert.equal(r.anomalie.versamentiSenzaAnno,1);
});
