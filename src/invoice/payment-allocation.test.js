import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcileInvoiceAllocations } from './payment-allocation.js';
import { invoicePaymentSnapshot } from './invoice-engine.js';
import { computeInvoice } from './invoice-engine.js';

test('snapshot usa il netto del documento, non l’imponibile, senza ricostruire dati mancanti', () => {
  const computed=computeInvoice({imponibile:1000,regime:'ordinario'});
  const snapshot=invoicePaymentSnapshot(computed,'EUR');
  assert.equal(snapshot.amountDue,1068.8);
  assert.equal(snapshot.totaleFattura,computed.totaleFattura);
  assert.equal(snapshot.version,1);
  assert.equal(invoicePaymentSnapshot({imponibile:1000},'EUR'),null);
  assert.equal(invoicePaymentSnapshot(computed,''),null);
  assert.equal(invoicePaymentSnapshot({...computed,nettoARicevere:Infinity},'EUR'),null);
  assert.equal(invoicePaymentSnapshot({...computed,verifica:{ok:false}},'EUR'),null);
});

const invoices = [{ id:'i1', amountDue:100, currency:'EUR' }, { id:'i2', amountDue:50, currency:'EUR' }];
const receipts = [{ id:'bank-uuid', amount:120, currency:'EUR' }];
const line = (id, invoiceId, amount, receiptId='bank-uuid') => ({ id, invoiceId, receiptId, amount });

test('pagamento cumulativo: ripartisce il movimento senza duplicarlo e conserva il residuo', () => {
  const input = structuredClone({ invoices, receipts });
  const r = reconcileInvoiceAllocations(invoices, receipts, [line('a','i1',100),line('b','i2',20)]);
  assert.equal(r.ok,true);
  assert.deepEqual(r.invoices.map(i => [i.allocated,i.remaining]), [[100,0],[20,30]]);
  assert.equal(r.receipts[0].remaining,0);
  assert.deepEqual({ invoices, receipts },input);
});
test('acconti multipli: somma esatta in centesimi', () => {
  const r = reconcileInvoiceAllocations([{id:'i',amountDue:.3,currency:'CHF'}],
    [{id:'a',amount:.1,currency:'CHF'},{id:'b',amount:.2,currency:'CHF'}],
    [line('1','i',.1,'a'),line('2','i',.2,'b')]);
  assert.equal(r.ok,true);
  assert.equal(r.invoices[0].remaining,0);
});
test('un piano che supera movimento o fattura viene respinto per intero', () => {
  for (const lines of [[line('a','i1',101)], [line('a','i1',100),line('b','i2',30)]]) {
    const r = reconcileInvoiceAllocations(invoices,receipts,lines);
    assert.equal(r.ok,false);
    assert.equal(r.invoices[0].allocated,0);
    assert.equal(r.receipts[0].allocated,0);
  }
});
test('rifiuta riferimenti mancanti, doppioni, valute diverse e importi invalidi', () => {
  for (const lines of [[line('a','missing',10)], [line('a','i1',10),line('a','i1',10)],
    [line('a','i1',Infinity)], [line('a','i1',-1)], [line('a','i1',.001)]]) {
    assert.equal(reconcileInvoiceAllocations(invoices,receipts,lines).ok,false);
  }
  assert.equal(reconcileInvoiceAllocations(invoices,[{...receipts[0],currency:'CHF'}],[line('a','i1',10)]).ok,false);
  assert.equal(reconcileInvoiceAllocations([...invoices,invoices[0]],receipts,[]).ok,false);
  assert.equal(reconcileInvoiceAllocations([{id:'i1',imponibile:100,currency:'EUR'}],receipts,[]).ok,false);
});
test('ricalcolare dopo una rimozione ripristina il residuo; una modifica al movimento invalida il piano', () => {
  const lines = [line('a','i1',100),line('b','i2',20)];
  assert.equal(reconcileInvoiceAllocations(invoices,receipts,lines.slice(1)).invoices[0].remaining,100);
  assert.equal(reconcileInvoiceAllocations(invoices,[{...receipts[0],amount:110}],lines).ok,false);
});

test('300 scenari: conservazione dei centesimi e risultato indipendente dall’ordine del piano', () => {
  for (let n=1;n<=300;n++) {
    const a=n/100,b=(301-n)/100;
    const inv=[{id:'a',amountDue:a,currency:'EUR'},{id:'b',amountDue:b,currency:'EUR'}];
    const bank=[{id:'bank-uuid',amount:3.01,currency:'EUR'}];
    const plan=[line('one','a',a),line('two','b',b)];
    const result=reconcileInvoiceAllocations(inv,bank,plan);
    assert.equal(result.ok,true);
    assert.equal(result.receipts[0].remaining,0);
    assert.deepEqual(result.invoices.map(i=>i.remaining),[0,0]);
    assert.deepEqual(reconcileInvoiceAllocations(inv,bank,[...plan].reverse()),result);
  }
});
