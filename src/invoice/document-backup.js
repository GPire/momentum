import {verifyDocumentArchive} from './document-archive.js';
import {documentStorageKey} from './document-storage.js';
const prefix='invoice-documents:';
export function splitDocumentBackup(backup){
 const {invoiceDocumentBackup:documents,...state}=backup;return {state,documents};
}
export async function validateDocumentBundle(bundle){
 if(bundle?.version!==1||!Array.isArray(bundle.archives)||bundle.archives.length>1000)throw Error('Invalid document backup');
 const seen=new Set();let bytes=0;
 for(const a of bundle.archives){
  if(!(await verifyDocumentArchive(a)).ok)throw Error('Document integrity failure');
  const key=documentStorageKey(a.country,a.invoiceId);if(seen.has(key))throw Error('Duplicate document archive');seen.add(key);
  bytes+=new TextEncoder().encode(JSON.stringify(a)).length;if(bytes>100000000)throw Error('Document backup too large');
 }
 return bundle.archives;
}
function transaction(db,mode,work){
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('state',mode),store=tx.objectStore('state');let value;
  const timer=setTimeout(()=>{try{tx.abort();}catch{}reject(Error('Document storage timeout'));},10000);
  tx.oncomplete=()=>{clearTimeout(timer);resolve(value);};
  tx.onabort=tx.onerror=()=>{clearTimeout(timer);reject(Error('Document storage failed or conflicting originals'));};
  try{work(store,tx,v=>{value=v;});}catch(e){clearTimeout(timer);try{tx.abort();}catch{}reject(e);}
 });
}
export async function includeDocumentBackup(state,durable){
 const db=await durable.open();if(!db)throw Error('Cannot verify document storage');
 const archives=await transaction(db,'readonly',(store,tx,set)=>{
  const found=[];set(found);const r=store.openCursor(IDBKeyRange.bound(prefix,prefix+'\uffff'));
  r.onsuccess=()=>{const cursor=r.result;if(!cursor)return;const a=cursor.value;
   if(!a||cursor.key!==documentStorageKey(a.country,a.invoiceId)){tx.abort();return;}found.push(a);cursor.continue();};
 });
 const bundle={version:1,archives};await validateDocumentBundle(bundle);
 return {...state,invoiceDocumentBackup:bundle};
}
// Restore is additive. Conflicting originals are never silently replaced, even across tabs.
export async function restoreDocumentBackup(bundle,durable){
 if(bundle===undefined)return;
 const archives=await validateDocumentBundle(bundle);if(!archives.length)return;
 const db=await durable.open();if(!db)throw Error('Document storage unavailable');
 await transaction(db,'readwrite',(store,tx)=>{
  for(const a of archives){const key=documentStorageKey(a.country,a.invoiceId),r=store.get(key);
   r.onsuccess=()=>{if(r.result!==undefined&&JSON.stringify(r.result)!==JSON.stringify(a)){tx.abort();return;}store.put(a,key);};}
 });
}
