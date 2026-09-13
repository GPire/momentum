import { json, readBody, validateCompanyRules } from './worker.js';
import { readReviewArchive } from '../../src/trips/review-archive.js';
import { inspectTripArchive } from '../../src/trips/trip-archive.js';

const equal = (a,b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const canonical = value => value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])) : value;
const reportLimit = 256 * 1024;
export async function reportRequest(request, env, subject) {
  if (!subject) return json({error:'unauthenticated'},401);
  if (!env.COMPANY_DB) return json({error:'not_configured'},503);
  const route = /^\/v1\/companies\/([a-zA-Z0-9_-]{1,80})\/reports(?:\/([a-zA-Z0-9-]{1,80})(\/decision)?)?$/.exec(new URL(request.url).pathname);
  if(!route)return json({error:'not_found'},404);
  const [,company,id,decisionPath]=route;
  const db=env.COMPANY_DB.withSession?env.COMPANY_DB.withSession('first-primary'):env.COMPANY_DB;
  const member=await db.prepare('SELECT role FROM memberships WHERE company_id=? AND subject=? AND active=1').bind(company,subject).first();
  if(!member)return json({error:'forbidden'},403);
  const canReview=['owner','reviewer'].includes(member.role);
  if(request.method==='GET' && id && !decisionPath){
    const row=await db.prepare(`SELECT r.*,d.decision,d.note,d.reviewer FROM reports r LEFT JOIN report_decisions d ON d.report_id=r.id
      WHERE r.company_id=? AND r.id=? AND (r.submitter=? OR ?=1)` ).bind(company,id,subject,canReview||member.role==='auditor'?1:0).first();
    if(!row)return json({error:'not_found'},404);
    const latest=await db.prepare('SELECT MAX(revision) AS revision FROM reports WHERE company_id=? AND submitter=? AND trip_id=?').bind(company,row.submitter,row.trip_id).first();
    return json({...row,archive:JSON.parse(row.archive),superseded:row.revision!==latest.revision});
  }
  if(request.method!=='POST')return json({error:'method_not_allowed'},405);
  if(request.headers.get('Origin')!==env.APP_ORIGIN || !env.APP_ORIGIN || request.headers.get('Content-Type')?.split(';')[0].trim()!=='application/json')return json({error:'invalid_origin_or_type'},403);
  let body;try{body=await readBody(request,id?8192:reportLimit)}catch{return json({error:'invalid_or_oversized_body',maxBytes:id?8192:reportLimit},413)}
  if(id && decisionPath){
    if(!canReview)return json({error:'forbidden'},403);
    if(!body || !['approved','changes_requested'].includes(body.decision) || typeof body.note!=='string' || body.note.length>1000 || (body.decision==='changes_requested'&&!body.note.trim()))return json({error:'invalid_decision'},400);
    const fingerprint=/^"([a-f0-9]{64})"$/.exec(request.headers.get('If-Match')||'')?.[1];
    if(!fingerprint)return json({error:'fingerprint_required'},428);
    const result=await db.prepare(`INSERT INTO report_decisions(report_id,reviewer,decision,note,created_at)
      SELECT r.id,?,?,?,? FROM reports r WHERE r.company_id=? AND r.id=? AND r.fingerprint=? AND r.submitter<>?
      AND r.revision=(SELECT MAX(v.revision) FROM reports v WHERE v.company_id=r.company_id AND v.submitter=r.submitter AND v.trip_id=r.trip_id)
      AND (?='changes_requested' OR r.policy_version=(SELECT MAX(version) FROM policies WHERE company_id=r.company_id))
      AND NOT EXISTS(SELECT 1 FROM report_decisions WHERE report_id=r.id)
      AND EXISTS(SELECT 1 FROM memberships WHERE company_id=r.company_id AND subject=? AND active=1 AND role IN ('owner','reviewer'))`)
      .bind(subject,body.decision,body.note.trim(),new Date().toISOString(),company,id,fingerprint,subject,body.decision,subject).run();
    return result.meta?.changes?json({reportId:id,decision:body.decision},201):json({error:'stale_or_forbidden_decision'},409);
  }
  if(id)return json({error:'method_not_allowed'},405);
  const previous=/^"(0|[1-9][0-9]{0,8})"$/.exec(request.headers.get('If-Match')||'');
  if(!previous)return json({error:'revision_required'},428);
  let review;try{review=await readReviewArchive(JSON.stringify(body))}catch{return json({error:'invalid_report'},400)}
  const trip=body.trip;
  if(typeof trip.id!=='string'||trip.id.length>100||!trip.id.trim()||!body.transactions.length||trip.companyPolicy?.companyId!==company)return json({error:'invalid_company_report'},400);
  const policy=await db.prepare('SELECT version,rules FROM policies WHERE company_id=? ORDER BY version DESC LIMIT 1').bind(company).first();
  if(!policy||trip.companyPolicy.version!==policy.version)return json({error:'policy_update_required'},409);
  const {exceptionReason,...submittedRules}=trip.receiptPolicy||{};
  if((exceptionReason!==undefined&&(typeof exceptionReason!=='string'||exceptionReason.length>500))||!validateCompanyRules(submittedRules)||!equal(submittedRules,JSON.parse(policy.rules)))return json({error:'policy_mismatch'},400);
  const checks=inspectTripArchive(body.transactions,JSON.parse(policy.rules));
  if(checks.blockingCount)return json({error:'report_errors',checks},400);
  const reportId=crypto.randomUUID();const revision=Number(previous[1])+1;
  const result=await db.prepare(`INSERT INTO reports(id,company_id,submitter,trip_id,revision,policy_version,fingerprint,archive,created_at)
    SELECT ?,?,?,?,?,?,?,?,? WHERE COALESCE((SELECT MAX(revision) FROM reports WHERE company_id=? AND submitter=? AND trip_id=?),0)=?
    AND EXISTS(SELECT 1 FROM memberships WHERE company_id=? AND subject=? AND active=1)
    AND ?=(SELECT MAX(version) FROM policies WHERE company_id=?)`)
    .bind(reportId,company,subject,trip.id,revision,policy.version,review.reportFingerprint,JSON.stringify(body),new Date().toISOString(),company,subject,trip.id,Number(previous[1]),company,subject,policy.version,company).run();
  return result.meta?.changes?json({reportId,revision,fingerprint:review.reportFingerprint,checks},201):json({error:'revision_or_access_changed'},409);
}
