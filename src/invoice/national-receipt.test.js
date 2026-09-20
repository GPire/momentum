import {test} from 'node:test';
import assert from 'node:assert/strict';
import {receiptXml,readVerifactuReceipt} from './national-receipt.js';
import {nationalReceiptCopy,sdiReceiptCopy} from '../i18n/national-receipt.js';
test('receipt decoding keeps UTF-8 and rejects invalid encoding or excessive input',()=>{
 const xml='<test>correzión</test>';
 assert.equal(receiptXml('data:application/xml;base64,'+Buffer.from(xml).toString('base64')),xml);
 assert.equal(receiptXml(xml),xml);
 assert.throws(()=>receiptXml('data:text/xml,%broken'));
 assert.throws(()=>receiptXml('data:text/xml;base64,/w=='));
 assert.throws(()=>receiptXml('x'.repeat(3000001)));
 assert.throws(()=>readVerifactuReceipt('<!DOCTYPE test><test/>'));
});
test('receipt controls and outcomes translated in all supported languages',()=>{
 for(const lang of ['it','en','de','fr','es','nl','pt']){
  const copy=nationalReceiptCopy(lang);assert.equal(Object.keys(copy).length,11);
  for(const value of Object.values(copy))assert.ok(typeof value==='string'&&value.length>0);
  for(const key of ['RicevutaConsegna','RicevutaScarto','RicevutaImpossibilitaRecapito'])assert.ok(sdiReceiptCopy(lang)[key]);
 }
});
