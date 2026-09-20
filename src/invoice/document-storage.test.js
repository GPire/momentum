import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadDocumentArchive,saveDocumentArchive,documentStorageKey} from './document-storage.js';
import {createDocumentArchive} from './document-archive.js';
test('nessun falso salvataggio senza archivio durevole',async()=>{
 const archive=await createDocumentArchive({country:'IT',invoiceId:'1',files:[{id:'a',kind:'invoice',name:'a.xml',data:'test'}]});
 await assert.rejects(saveDocumentArchive({open:async()=>null},archive));
 await assert.rejects(loadDocumentArchive({open:async()=>null},'IT','1'));
});
test('recupero verifica integrità e identità, separando i Paesi',async()=>{
 const archive=await createDocumentArchive({country:'CH',invoiceId:'1',files:[{id:'a',kind:'invoice',name:'a.xml',data:'test'}]});
 const store={open:async()=>true,get:async()=>structuredClone(archive)};
 assert.deepEqual(await loadDocumentArchive(store,'CH','1'),archive);
 await assert.rejects(loadDocumentArchive(store,'IT','1'));
 archive.files[0].data='changed';await assert.rejects(loadDocumentArchive(store,'CH','1'));
 assert.notEqual(documentStorageKey('IT','1'),documentStorageKey('CH','1'));
});
