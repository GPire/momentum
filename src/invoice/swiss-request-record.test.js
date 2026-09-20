import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recordSwissPaymentRequest} from './swiss-request-record.js';
import {invoiceNextSteps} from './invoice-next-step.js';
import {buildAccountantReport} from '../predict/accountant-export.js';
const request={id:'test-1',amount:125.50,date:'2026-09-19',client:'Test AG',payload:'SPC\r\n0200\r\n1'};
test('QR archiviato senza imponibile inventato, duplicati evitati',()=>{
  const result=recordSwissPaymentRequest([],request);assert.equal(result.ok,true);
  assert.equal(result.record.documentKind,'payment-request');assert.equal(result.record.imponibile,undefined);
  assert.equal(invoiceNextSteps({invoices:result.invoices},'CH')[0].remaining,125.5);
  assert.equal(recordSwissPaymentRequest(result.invoices,request).duplicate,true);
  assert.equal(recordSwissPaymentRequest(result.invoices,{...request,amount:200}).ok,false);
  const report=buildAccountantReport(result.invoices,{},2026,'forfettario');
  assert.equal(report.fatture.length,0);
});
test('importi ambigui e frazioni di centesimo rifiutati',()=>{
  for(const amount of [NaN,Infinity,-1,0,1.001,'12 euro'])assert.equal(recordSwissPaymentRequest([],{...request,amount}).ok,false);
  assert.equal(recordSwissPaymentRequest([],{...request,payload:''}).ok,false);
});
