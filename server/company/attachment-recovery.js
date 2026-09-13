import { json,readBody } from './worker.js';
export const recordCleanup=(db,company,key,attempt,actor,event)=>db.prepare('INSERT INTO company_attachment_journal(company_id,object_key,attempt,actor,event) VALUES(?,?,?,?,?)').bind(company,key,attempt,actor,event).run();
export const finishCleanup=(db,company,key,attempt)=>db.prepare(`UPDATE company_attachment_lifecycle SET state='active',cleanup_id=NULL WHERE company_id=? AND object_key=? AND state='deleting' AND cleanup_id=?
 AND EXISTS(SELECT 1 FROM company_attachment_journal WHERE company_id=? AND object_key=? AND attempt=? AND event='confirmed')
 AND NOT EXISTS(SELECT 1 FROM company_attachment_operations WHERE company_id=? AND object_key=?)`).bind(company,key,attempt,company,key,attempt,company,key).run();

export async function attachmentRecoveryRequest(request,env,subject){
 if(!subject)return json({error:'unauthenticated'},401);
 if(!env.COMPANY_DB)return json({error:'not_configured'},503);
 const url=new URL(request.url),route=/^\/v1\/companies\/([a-zA-Z0-9_-]{1,80})\/storage\/(journal|reconcile)$/.exec(url.pathname);
 if(!route)return json({error:'not_found'},404);
 const [,company,action]=route,db=env.COMPANY_DB.withSession?env.COMPANY_DB.withSession('first-primary'):env.COMPANY_DB;
 const owner=()=>db.prepare("SELECT 1 FROM memberships WHERE company_id=? AND subject=? AND active=1 AND role='owner'").bind(company,subject).first();
 if(!await owner())return json({error:'forbidden'},403);
 if(action==='journal'){
  if(request.method!=='GET')return json({error:'method_not_allowed'},405);
  const after=url.searchParams.get('after')||'0';if(!/^(0|[1-9][0-9]{0,14})$/.test(after))return json({error:'invalid_cursor'},400);
  const rows=await db.prepare('SELECT * FROM company_attachment_journal WHERE company_id=? AND id>? ORDER BY id LIMIT 51').bind(company,Number(after)).all();
  if(!await owner())return json({error:'forbidden'},403);
  return json({events:(rows.results||[]).slice(0,50),nextCursor:rows.results?.length>50?String(rows.results[49].id):null});
 }
 if(request.method!=='POST')return json({error:'method_not_allowed'},405);
 if(!env.APP_ORIGIN||request.headers.get('Origin')!==env.APP_ORIGIN||request.headers.get('Content-Type')!=='application/json')return json({error:'invalid_origin_or_type'},403);
 let body;try{body=await readBody(request,1024)}catch{return json({error:'invalid_body'},400)}
 const key=body?.key;if(typeof key!=='string'||!key.startsWith(company+'/')||!/^[-a-zA-Z0-9_]{1,80}\/[a-f0-9]{64}\/[a-f0-9]{64}$/.test(key))return json({error:'invalid_key'},400);
 const row=await db.prepare('SELECT state,cleanup_id FROM company_attachment_lifecycle WHERE company_id=? AND object_key=?').bind(company,key).first();
 if(!row||row.state!=='deleting'||!row.cleanup_id)return json({error:'no_recoverable_cleanup'},409);
 if(!await owner())return json({error:'forbidden'},403);
 const result=await finishCleanup(db,company,key,row.cleanup_id);
 if(result.meta?.changes)return json({state:'reconciled'});
 let event='observed_unavailable';try{if(env.COMPANY_FILES?.head)event=await env.COMPANY_FILES.head(key)?'observed_present':'observed_missing'}catch{}
 if(!await owner())return json({error:'forbidden'},403);
 await recordCleanup(db,company,key,row.cleanup_id,subject,event);
 return json({state:'requires_review',observation:event,locked:true},409);
}
