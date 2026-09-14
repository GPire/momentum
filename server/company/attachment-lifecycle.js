import { digestBytes } from '../../src/trips/company-attachments.js';
import { json,readBody } from './worker.js';
import { recordCleanup,finishCleanup } from './attachment-recovery.js';

export async function attachmentKey(company,subject,hash){return `${company}/${await digestBytes(new TextEncoder().encode(subject))}/${hash}`}
export async function lockAttachment(db,company,key){
 await db.prepare('INSERT OR IGNORE INTO company_attachment_lifecycle(company_id,object_key) VALUES(?,?)').bind(company,key).run();
 const token=crypto.randomUUID();
 await db.prepare('INSERT INTO company_attachment_operations(token,company_id,object_key) VALUES(?,?,?)').bind(token,company,key).run();
 return ()=>db.prepare('DELETE FROM company_attachment_operations WHERE token=?').bind(token).run();
}
export async function lockArchive(db,company,subject,body){
 if(body?.format!=='momentum-company-upload')return async()=>{};
   if(!Array.isArray(body.archive?.transactions)||body.archive.transactions.length>10000)throw Error('invalid archive');
   const hashes=new Set(body.archive.transactions.map(t=>t?.receiptRef?.hash).filter(Boolean));
   if(hashes.size>64)throw Error('too many attachments');
 const entries=[];for(const hash of hashes){if(!/^[a-f0-9]{64}$/.test(hash))throw Error('invalid hash');entries.push({key:await attachmentKey(company,subject,hash),token:crypto.randomUUID()})}
 if(!entries.length)return async()=>{};
 const payload=JSON.stringify(entries);
 await db.prepare("INSERT OR IGNORE INTO company_attachment_lifecycle(company_id,object_key) SELECT ?,json_extract(value,'$.key') FROM json_each(?)").bind(company,payload).run();
 // One guarded INSERT is atomic across the entire set: a busy file rolls it all back.
 await db.prepare("INSERT INTO company_attachment_operations(token,company_id,object_key) SELECT json_extract(value,'$.token'),?,json_extract(value,'$.key') FROM json_each(?)").bind(company,payload).run();
 return ()=>db.prepare("DELETE FROM company_attachment_operations WHERE token IN (SELECT json_extract(value,'$.token') FROM json_each(?))").bind(payload).run();
}
export async function attachmentReferenced(db,company,key){
 const [,ownerHash,hash]=key.split('/');
 const refs=await db.prepare(`SELECT DISTINCT r.submitter FROM reports r,json_each(r.archive,'$.archive.transactions') t
 WHERE r.company_id=? AND json_extract(r.archive,'$.format')='momentum-company-upload'
 AND json_extract(t.value,'$.receiptRef.hash')=?`).bind(company,hash).all();
 for(const ref of refs.results||[])if(await digestBytes(new TextEncoder().encode(ref.submitter))===ownerHash)return true;
 return false;
}
// Explicit owner action, one old object at a time. Never schedules bulk deletion.
export async function cleanupAttachmentRequest(request,env,subject){
 if(!subject)return json({error:'unauthenticated'},401);
 if(!env.COMPANY_DB||!env.COMPANY_FILES?.delete)return json({error:'not_configured'},503);
 const route=/^\/v1\/companies\/([a-zA-Z0-9_-]{1,80})\/storage\/cleanup$/.exec(new URL(request.url).pathname);
 if(!route)return json({error:'not_found'},404);
 const company=route[1],db=env.COMPANY_DB.withSession?env.COMPANY_DB.withSession('first-primary'):env.COMPANY_DB;
 const owner=()=>db.prepare("SELECT 1 FROM memberships WHERE company_id=? AND subject=? AND role='owner' AND active=1").bind(company,subject).first();
 if(!await owner())return json({error:'forbidden'},403);
 if(request.method!=='POST')return json({error:'method_not_allowed'},405);
 if(!env.APP_ORIGIN||request.headers.get('Origin')!==env.APP_ORIGIN||request.headers.get('Content-Type')!=='application/json')return json({error:'invalid_origin_or_type'},403);
 let body;try{body=await readBody(request,1024)}catch{return json({error:'invalid_body'},400)}
 const key=body?.key;
 if(typeof key!=='string'||!key.startsWith(company+'/')||!/^[-a-zA-Z0-9_]{1,80}\/[a-f0-9]{64}\/[a-f0-9]{64}$/.test(key))return json({error:'invalid_key'},400);
 // Only objects observed by the new locking protocol can be collected.
 const attempt=crypto.randomUUID();
 const claim=await db.prepare(`UPDATE company_attachment_lifecycle SET state='deleting',cleanup_id=? WHERE company_id=? AND object_key=? AND state='active'
 AND NOT EXISTS(SELECT 1 FROM company_attachment_operations WHERE company_id=? AND object_key=?)
 AND EXISTS(SELECT 1 FROM company_attachment_reservations WHERE company_id=? AND object_key=? AND julianday(created_at)<julianday('now','-7 days'))
 AND EXISTS(SELECT 1 FROM memberships WHERE company_id=? AND subject=? AND role='owner' AND active=1)`)
 .bind(attempt,company,key,company,key,company,key,company,subject).run();
 if(!claim.meta?.changes)return json({error:'attachment_busy_recent_or_untracked'},409);
 const unlock=()=>db.prepare("UPDATE company_attachment_lifecycle SET state='active',cleanup_id=NULL WHERE company_id=? AND object_key=? AND cleanup_id=?").bind(company,key,attempt).run();
 // A report cannot start using the object after the claim. Inspect all historical revisions.
 try{
  await recordCleanup(db,company,key,attempt,subject,'requested');
  if(await attachmentReferenced(db,company,key)){await recordCleanup(db,company,key,attempt,subject,'retained');await unlock();return json({error:'attachment_referenced'},409)}
  if(!await owner()){await recordCleanup(db,company,key,attempt,subject,'retained');await unlock();return json({error:'forbidden'},403)}
 }catch{return json({error:'cleanup_requires_review'},503)}
 try{
  await env.COMPANY_FILES.delete(key);
  await recordCleanup(db,company,key,attempt,subject,'confirmed');
  const finished=await finishCleanup(db,company,key,attempt);
  return finished.meta?.changes?json({deleted:true,attempt}):json({error:'cleanup_requires_review',attempt},503);
 }catch{
  // A timed-out deletion may still finish later. Keep the key blocked until reconciled.
  try{await recordCleanup(db,company,key,attempt,subject,'uncertain')}catch{}
  return json({error:'cleanup_requires_review',attempt},503);
 }
}
