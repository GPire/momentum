import { json } from './worker.js';
import { digestBytes } from '../../src/trips/company-attachments.js';

// An observation, never a deletion authorization: submissions can still be in flight.
export async function storageAuditRequest(request,env,subject){
  if(!subject)return json({error:'unauthenticated'},401);
  if(!env.COMPANY_DB||!env.COMPANY_FILES)return json({error:'not_configured'},503);
  const url=new URL(request.url),match=/^\/v1\/companies\/([a-zA-Z0-9_-]{1,80})\/storage$/.exec(url.pathname);
  if(!match)return json({error:'not_found'},404);
  const company=match[1],db=env.COMPANY_DB.withSession?env.COMPANY_DB.withSession('first-primary'):env.COMPANY_DB;
  const owner=()=>db.prepare("SELECT 1 FROM memberships WHERE company_id=? AND subject=? AND active=1 AND role='owner'").bind(company,subject).first();
  if(!await owner())return json({error:'forbidden'},403);
  if(request.method!=='GET')return json({error:'method_not_allowed'},405);
  const after=url.searchParams.get('after')||'';
  if(after&&(!after.startsWith(company+'/')||!new RegExp('^[a-zA-Z0-9_-]{1,80}/[a-f0-9]{64}/[a-f0-9]{64}$').test(after)))return json({error:'invalid_cursor'},400);
  const limit=await db.prepare('SELECT limit_bytes FROM company_storage_limits WHERE company_id=?').bind(company).first();
  if(!limit)return json({error:'storage_not_configured'},503);
  const usage=await db.prepare('SELECT COALESCE(SUM(size),0) AS bytes,COUNT(*) AS objects FROM company_attachment_reservations WHERE company_id=?').bind(company).first();
  const page=await db.prepare('SELECT object_key,size,created_at FROM company_attachment_reservations WHERE company_id=? AND object_key>? ORDER BY object_key LIMIT 26').bind(company,after).all();
  const entries=[];
  for(const row of (page.results||[]).slice(0,25)){
    const parts=row.object_key.split('/'),hash=parts[2];
    const refs=await db.prepare(`SELECT DISTINCT r.submitter FROM reports r,json_each(r.archive,'$.archive.transactions') t
      WHERE r.company_id=? AND json_extract(r.archive,'$.format')='momentum-company-upload'
      AND json_extract(t.value,'$.receiptRef.hash')=?`).bind(company,hash).all();
    let referenced=false;
    for(const ref of refs.results||[]){
      if(await digestBytes(new TextEncoder().encode(ref.submitter))===parts[1]){referenced=true;break}
    }
    let object,status;
    try{object=await env.COMPANY_FILES.head(row.object_key);status=object?(object.size===row.size?'present':'size_mismatch'):'missing'}catch{status='unavailable'}
    entries.push({key:row.object_key,reservedBytes:row.size,reservedAt:row.created_at,reference:referenced?'report':'unlinked',object:status});
  }
  // Revocation during a slow storage lookup must not expose the resulting inventory.
  if(!await owner())return json({error:'forbidden'},403);
  return json({companyId:company,limitBytes:limit.limit_bytes,reservedBytes:usage.bytes,reservations:usage.objects,
    availableBytes:Math.max(0,limit.limit_bytes-usage.bytes),entries,
    nextCursor:(page.results||[]).length>25?entries.at(-1).key:null,readOnly:true});
}
