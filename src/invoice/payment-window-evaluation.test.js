import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluatePaymentWindows} from './payment-window-evaluation.js';
import {syntheticPaymentDataset} from '../../bench/payment-window-fixture.mjs';
test('metriche riproducibili anche sui casi sfavorevoli, dati sintetici espliciti',()=>{
 const r=evaluatePaymentWindows(syntheticPaymentDataset);
 assert.equal(r.kind,'synthetic');assert.equal(r.provenanceVerified,false);assert.equal(r.cases,6);assert.equal(r.coverage,.5);assert.equal(r.meanAbsoluteErrorDays,15);assert.equal(r.meanWindowWidthDays,20);assert.equal(r.baseline30DaysError,15);
});
test('rifiuta dati futuri, duplicati e metadati mancanti',()=>{
 for(const mutate of [d=>d.cases[0].snapshot.transactions.m[0].date='2026-09-20',d=>d.cases[0].snapshotCapturedOn='2026-09-02',d=>d.cases.push(d.cases[0]),d=>delete d.kind]){
  const d=structuredClone(syntheticPaymentDataset);mutate(d);assert.throws(()=>evaluatePaymentWindows(d));
 }
});
test('astensione e nessuna previsione non producono accuratezza fittizia',()=>{
 const d=structuredClone(syntheticPaymentDataset);for(const c of d.cases)c.snapshot.invoiceCollections.entries=[];
 const r=evaluatePaymentWindows(d);assert.equal(r.abstentions,6);assert.equal(r.coverage,null);assert.equal(r.meanAbsoluteErrorDays,null);
});
