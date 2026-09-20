import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateDocumentBundle,splitDocumentBackup} from './document-backup.js';
import {createDocumentArchive} from './document-archive.js';
const sample=()=>createDocumentArchive({country:'IT',invoiceId:'1',files:[{id:'a',kind:'invoice',name:'a.xml',data:'<original/>'}]});
test('backup legacy resta invariato, gli allegati non finiscono nello stato attivo',async()=>{
 const old={transactions:{},mlData:{keep:1}};assert.deepEqual(splitDocumentBackup(old),{state:old,documents:undefined});
 const a=await sample(),backup={...old,invoiceDocumentBackup:{version:1,archives:[a]}};
 const result=splitDocumentBackup(backup);assert.deepEqual(result.state,old);assert.equal(result.documents.archives[0],a);
 assert.equal((await validateDocumentBundle(result.documents)).length,1);assert.ok(backup.invoiceDocumentBackup);
});
test('pacchetti corrotti, duplicati e versioni sconosciute bloccano il ripristino',async()=>{
 const a=await sample();
 for(const value of [null,{version:2,archives:[]},{version:1,archives:[a,a]},{version:1,archives:[{...a,invoiceId:'other'}]}])await assert.rejects(validateDocumentBundle(value));
});
