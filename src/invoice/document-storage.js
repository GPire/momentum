import {verifyDocumentArchive} from './document-archive.js';
import {sealValue,openValue} from '../core/vault-cipher.js';
// Originali cifrati a riposo; l'impronta resta leggibile per il confronto atomico fra schede.
export const sealArchive=a=>sealValue(a,{manifestSha256:a.manifestSha256});
export const documentStorageKey=(country,invoiceId)=>`invoice-documents:${JSON.stringify([country,invoiceId])}`;
export async function loadDocumentArchive(store,country,invoiceId){
 if(!await store.open())throw Error('Storage unavailable');
 const archive=openValue(await store.get('state',documentStorageKey(country,invoiceId)));
 if(archive!==undefined&&(!(await verifyDocumentArchive(archive)).ok||archive.country!==country||archive.invoiceId!==invoiceId))throw Error('Archive integrity failure');
 return archive;
}
// Compare and write in one IDB transaction: another tab cannot silently lose files.
export async function saveDocumentArchive(store,archive,expectedHash=null){
 if(!(await verifyDocumentArchive(archive)).ok)throw Error('Invalid archive');
 const db=await store.open();if(!db)throw Error('Storage unavailable');
 await new Promise((resolve,reject)=>{
  const tx=db.transaction('state','readwrite'),objects=tx.objectStore('state');
  const timer=setTimeout(()=>{try{tx.abort();}catch{}reject(Error('Storage timeout'));},5000);
  const request=objects.get(documentStorageKey(archive.country,archive.invoiceId));
  request.onsuccess=()=>{
   if((request.result?.manifestSha256??null)!==expectedHash){tx.abort();return;}
   objects.put(sealArchive(archive),documentStorageKey(archive.country,archive.invoiceId));
  };
  tx.oncomplete=()=>{clearTimeout(timer);resolve();};
  tx.onabort=tx.onerror=()=>{clearTimeout(timer);reject(Error('Save failed or conflicting version'));};
 });
 return archive.manifestSha256;
}
