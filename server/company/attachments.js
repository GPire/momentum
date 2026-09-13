import { json } from './worker.js';
import { digestBytes, FILE_LIMIT, restoreCompanyAttachments } from '../../src/trips/company-attachments.js';
import { attachmentKey,lockAttachment } from './attachment-lifecycle.js';

const objectKey=attachmentKey;
export async function hydrateCompanyArchive(stored,env,company,subject){
  if(stored?.format!=='momentum-company-upload')return stored;
  if(!env.COMPANY_FILES)throw new Error('Attachment storage unavailable');
  return restoreCompanyAttachments(stored,async ref=>{
    const object=await env.COMPANY_FILES.get(await objectKey(company,subject,ref.hash));
    if(!object||object.size!==ref.size||object.size>FILE_LIMIT)throw new Error('Attachment unavailable');
    return new Uint8Array(await object.arrayBuffer());
  });
}
export async function attachmentRequest(request,env,subject){
  if(!subject)return json({error:'unauthenticated'},401);
  if(!env.COMPANY_DB||!env.COMPANY_FILES)return json({error:'not_configured'},503);
  const route=/^\/v1\/companies\/([a-zA-Z0-9_-]{1,80})\/attachments\/([a-f0-9]{64})$/.exec(new URL(request.url).pathname);
  if(!route)return json({error:'not_found'},404);
  const [,company,hash]=route;
  const db=env.COMPANY_DB.withSession?env.COMPANY_DB.withSession('first-primary'):env.COMPANY_DB;
  const member=()=>db.prepare('SELECT role FROM memberships WHERE company_id=? AND subject=? AND active=1').bind(company,subject).first();
  if(!await member())return json({error:'forbidden'},403);
  const key=await objectKey(company,subject,hash);
  if(request.method==='GET'){
    const object=await env.COMPANY_FILES.head(key);
    return object?json({hash,size:object.size}):json({error:'not_found'},404);
  }
  if(request.method!=='PUT')return json({error:'method_not_allowed'},405);
  if(!env.APP_ORIGIN||request.headers.get('Origin')!==env.APP_ORIGIN||request.headers.get('Content-Type')!=='application/octet-stream')return json({error:'invalid_origin_or_type'},403);
  if(!request.body)return json({error:'invalid_attachment'},400);
  const reader=request.body.getReader(),chunks=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>FILE_LIMIT){await reader.cancel();return json({error:'attachment_too_large'},413)}chunks.push(value)}}finally{reader.releaseLock()}
  if(!size)return json({error:'invalid_attachment'},400);
  const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length}
  if(await digestBytes(bytes)!==hash)return json({error:'hash_mismatch'},400);
  if(!await member())return json({error:'forbidden'},403);
  let release;try{release=await lockAttachment(db,company,key)}catch{return json({error:'attachment_busy'},409)}
  let uncertain=false;
  try{
  // One SQL statement serializes quota checks and reservations, including parallel uploads.
  const limit=await db.prepare('SELECT limit_bytes FROM company_storage_limits WHERE company_id=?').bind(company).first();
  if(!limit)return json({error:'storage_not_configured'},503);
  await db.prepare(`INSERT OR IGNORE INTO company_attachment_reservations(company_id,object_key,size)
    SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM company_storage_limits l WHERE l.company_id=?
      AND ? <= l.limit_bytes-COALESCE((SELECT SUM(size) FROM company_attachment_reservations WHERE company_id=?),0))
      AND EXISTS(SELECT 1 FROM memberships WHERE company_id=? AND subject=? AND active=1)`)
    .bind(company,key,size,company,size,company,company,subject).run();
  const reservation=await db.prepare('SELECT size FROM company_attachment_reservations WHERE company_id=? AND object_key=?').bind(company,key).first();
  if(!reservation)return json({error:'storage_quota_exceeded'},507);
  if(reservation.size!==size)return json({error:'attachment_conflict'},409);
  if(!await member())return json({error:'forbidden'},403);
  // Content-addressed private object: repeated uploads cannot replace different bytes.
  // Keep the reservation on failure: a timed-out PUT may still have stored the object.
  if(!await env.COMPANY_FILES.head(key)){uncertain=true;await env.COMPANY_FILES.put(key,bytes,{httpMetadata:{contentType:'application/octet-stream'}});uncertain=false}
  return json({hash,size},201);
  }finally{if(!uncertain)await release()}
}
