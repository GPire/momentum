import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDocumentArchive,verifyDocumentArchive} from './document-archive.js';
import {documentArchiveCopy} from '../i18n/document-archive.js';
const file=(id,kind='invoice',extra={})=>({id,kind,name:`${id}.xml`,data:'<test/>',...extra});
test('azioni e feedback documentali disponibili in tutte le lingue',()=>{
 const keys=Object.keys(documentArchiveCopy('en'));
 for(const lang of ['it','en','de','fr','es','nl','pt']){const c=documentArchiveCopy(lang);assert.deepEqual(Object.keys(c),keys);assert.ok(Object.values(c).every(v=>typeof v==='string'&&v.length));}
});
test('archivio IT CH ES recuperabile con ricevuta legata al file esatto',async()=>{
 for(const country of ['IT','CH','ES']) {
  const archive=await createDocumentArchive({country,invoiceId:'1/2026',files:[file('invoice'),file('receipt','receipt',{documentId:'invoice'})]});
  const result=await verifyDocumentArchive(JSON.parse(JSON.stringify(archive)));
  assert.equal(result.ok,true);assert.equal(result.authenticityVerified,false);assert.equal(result.legalPreservationVerified,false);
 }
});
test('file modificati, mancanti, ricevute orfane e duplicati vengono rifiutati',async()=>{
 const archive=await createDocumentArchive({country:'IT',invoiceId:'1',files:[file('a'),file('r','receipt',{documentId:'a'})]});
 const changed=structuredClone(archive);changed.files[0].data+='changed';
 assert.equal((await verifyDocumentArchive(changed)).ok,false);
 const missing=structuredClone(archive);missing.files.shift();
 assert.equal((await verifyDocumentArchive(missing)).ok,false);
 await assert.rejects(createDocumentArchive({country:'IT',invoiceId:'1',files:[file('a'),file('a')]}));
 await assert.rejects(createDocumentArchive({country:'ES',invoiceId:'1',files:[file('r','receipt',{documentId:'missing'})]}));
});
test('manifesto modificato, formato ignoto e percorso di file non sicuro vengono rifiutati',async()=>{
 const archive=await createDocumentArchive({country:'CH',invoiceId:'1',files:[file('a')]});
 archive.invoiceId='2';assert.equal((await verifyDocumentArchive(archive)).ok,false);
 assert.equal((await verifyDocumentArchive({format:'unknown'})).ok,false);
 await assert.rejects(createDocumentArchive({country:'IT',invoiceId:'1',files:[file('a','invoice',{name:'../a.xml'})]}));
});
