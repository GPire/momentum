import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDocumentArchive} from './document-archive.js';
import {assessFiscalEvidence} from './fiscal-evidence.js';
const fixture=country=>createDocumentArchive({country,invoiceId:'TEST',files:[{id:'invoice',kind:'invoice',name:'invoice.xml',data:'<invoice/>'},{id:'proof',kind:'attachment',documentId:'invoice',name:'review.txt',data:'Synthetic review only'}]});
const record=a=>({id:'check-1',country:a.country,invoiceId:a.invoiceId,documentId:'invoice',documentHash:a.files[0].sha256,evidenceId:'proof',evidenceHash:a.files[1].sha256,kind:'professional-review',checkedAt:'2026-09-19T10:00:00Z',reviewer:'TEST',reference:'TEST-REVIEW'});
test('IT CH ES: missing proofs remain explicit; a recorded review is not certification',async()=>{
 for(const country of ['IT','CH','ES']){
  const a=await fixture(country),r=await assessFiscalEvidence(a,[record(a)],'2026-09-19T12:00:00Z');
  assert.equal(r.records[0].status,'recorded-unverified');assert.equal(r.authenticityVerified,false);assert.equal(r.legalPreservationVerified,false);
  assert.deepEqual(r.documents[0].missing,['authority-outcome','origin-check','preservation']);
 }
});
test('changed document or evidence invalidates previous review even when archive hashes are regenerated',async()=>{
 const a=await fixture('IT'),check=record(a);
 for(const index of [0,1]){const source=structuredClone(a);source.files[index].data+='changed';const next=await createDocumentArchive(source);const r=await assessFiscalEvidence(next,[check]);assert.equal(r.records[0].status,'stale');}
});
test('rejects duplicate records, foreign scope, future dates and receipt linked to another document',async()=>{
 const a=await fixture('CH'),c=record(a);
 for(const checks of [[c,c],[{...c,country:'IT'}],[{...c,checkedAt:'2099-01-01T00:00:00Z'}],[{...c,kind:'fake'}]]){
  const r=await assessFiscalEvidence(a,checks,'2026-09-19T12:00:00Z');assert.equal(r.ok,false);
 }
 const b=await createDocumentArchive({...a,files:[...a.files,{id:'other',kind:'invoice',name:'other.xml',data:'other'},{id:'wrong',kind:'receipt',documentId:'other',name:'receipt.xml',data:'receipt'}]});
 const r=await assessFiscalEvidence(b,[{...c,kind:'authority-outcome',evidenceId:'wrong',evidenceHash:b.files[3].sha256}]);assert.equal(r.records[0].status,'wrong-link');
});
test('corrupt archive and invalid record containers fail closed',async()=>{
 const a=await fixture('ES');assert.equal((await assessFiscalEvidence(a,{})).ok,false);
 a.files[0].data='tampered';assert.equal((await assessFiscalEvidence(a,[])).ok,false);
});
