import { hydrateCompanyArchive } from './attachments.js';
import { lockArchive } from './attachment-lifecycle.js';
import { json, readBody, validateCompanyRules } from './worker.js';
import { readReviewArchive } from '../../src/trips/review-archive.js';
import { inspectTripArchive } from '../../src/trips/trip-archive.js';
import { companyReportAnomaly } from '../../src/trips/company-report-anomaly.js';

// Stesso filtro di reimbursableTripExpenses (trip-engine.js): il totale
// aziendale non include mai una spesa bleisure/personale, coerente con
// quello che il revisore vede già come "totale da rimborsare" nell'export.
function reportTotal(transactions) {
  return (transactions || [])
    .filter(t => t?.type === 'uscita' && !t.tripPersonal && Number.isFinite(Number(t.amount)))
    .reduce((sum, t) => sum + Number(t.amount), 0);
}

const equal = (a,b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const canonical = value => value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])) : value;
const reportLimit = 256 * 1024;
// Approvazione a due stadi (ricerca 2026-09-19, pattern reale più comune
// trovato in Expensify "Advanced Approval": il responsabile approva e
// inoltra, la finance dà l'ultima parola) — vedi report_decisions.stage in
// reports.sql e rules.secondApprover in worker.js validateCompanyRules.
// Espressione SQL riusata in più punti: la decisione FINALE del resoconto,
// mai una singola riga di report_decisions presa a caso — 'changes_requested'
// a QUALUNQUE stadio è sempre terminale (mai serve completare il secondo
// stadio dopo un rifiuto al primo), 'approved' solo quando gli stadi
// richiesti (1 o 2, secondo la policy ATTIVA al momento dell'invio, non
// quella odierna) sono TUTTI approvati.
const finalDecisionExpr = `(CASE
  WHEN EXISTS(SELECT 1 FROM report_decisions rd WHERE rd.report_id=r.id AND rd.decision='changes_requested') THEN 'changes_requested'
  WHEN (SELECT COUNT(*) FROM report_decisions rd WHERE rd.report_id=r.id AND rd.decision='approved') >= (CASE WHEN (SELECT json_extract(p.rules,'$.secondApprover') FROM policies p WHERE p.company_id=r.company_id AND p.version=r.policy_version) IS NOT NULL THEN 2 ELSE 1 END) THEN 'approved'
  ELSE NULL
END)`;
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
  if(request.method==='GET'&&!id){
    const query=new URL(request.url).searchParams;
    if(query.has('resolve')){
      const fingerprint=query.get('resolve'),tripId=query.get('trip'),revision=query.get('revision');
      if(!/^[a-f0-9]{64}$/.test(fingerprint||'')||!tripId||tripId.length>100||! /^[1-9][0-9]{0,8}$/.test(revision||''))return json({error:'invalid_lookup'},400);
      const receipt=await db.prepare(`SELECT id AS reportId,revision,fingerprint FROM reports WHERE company_id=? AND submitter=? AND trip_id=? AND revision=? AND fingerprint=?
        AND EXISTS(SELECT 1 FROM memberships WHERE company_id=? AND subject=? AND active=1)`)
        .bind(company,subject,tripId,Number(revision),fingerprint,company,subject).first();
      return receipt?json(receipt):json({error:'submission_not_found'},404);
    }
    const params=new URL(request.url).searchParams;const after=params.get('after')||'';const filter=params.get('filter')||'pending';
    if(!['pending','all'].includes(filter)||after&&!/^[a-zA-Z0-9-]{1,80}$/.test(after))return json({error:'invalid_filter'},400);
    const canReadAll=canReview||member.role==='auditor';
    const anchor=after?await db.prepare('SELECT created_at FROM reports WHERE company_id=? AND id=? AND (submitter=? OR ?=1)').bind(company,after,subject,canReadAll?1:0).first():null;
    if(after&&!anchor)return json({error:'invalid_cursor'},400);
    const result=await db.prepare(`SELECT r.id,r.trip_id,r.revision,r.created_at,COALESCE(json_extract(r.archive,'$.trip.name'),json_extract(r.archive,'$.archive.trip.name')) AS name,${finalDecisionExpr} AS decision
      FROM reports r
      WHERE r.company_id=? ${canReadAll?'':'AND r.submitter=?'}
      AND r.revision=(SELECT MAX(v.revision) FROM reports v WHERE v.company_id=r.company_id AND v.submitter=r.submitter AND v.trip_id=r.trip_id)
      AND (?='all' OR ${finalDecisionExpr} IS NULL)
      ${after?'AND (r.created_at,r.id)<(?,?)':''}
      ORDER BY r.created_at DESC,r.id DESC LIMIT 31`).bind(company,...(canReadAll?[]:[subject]),filter,...(after?[anchor.created_at,after]:[])).all();
    const rows=result.results||[];return json({reports:rows.slice(0,30),nextCursor:rows.length>30?rows[29].id:null});
  }
  if(request.method==='GET' && id && !decisionPath){
    if(new URL(request.url).searchParams.get('view')==='status'){
      const state=await db.prepare(`SELECT r.id,r.company_id,r.trip_id,r.revision,r.fingerprint,${finalDecisionExpr} AS decision,
        (SELECT rd.note FROM report_decisions rd WHERE rd.report_id=r.id ORDER BY rd.stage DESC LIMIT 1) AS note,
        r.revision<>(SELECT MAX(v.revision) FROM reports v WHERE v.company_id=r.company_id AND v.submitter=r.submitter AND v.trip_id=r.trip_id) AS superseded,
        r.policy_version<>(SELECT MAX(p.version) FROM policies p WHERE p.company_id=r.company_id) AS policyStale
        FROM reports r
        WHERE r.company_id=? AND r.id=? AND (r.submitter=? OR ?=1)`)
        .bind(company,id,subject,canReview||member.role==='auditor'?1:0).first();
      return state?json({...state,superseded:Boolean(state.superseded),policyStale:Boolean(state.policyStale)}):json({error:'not_found'},404);
    }
    const row=await db.prepare(`SELECT r.* FROM reports r
      WHERE r.company_id=? AND r.id=? AND (r.submitter=? OR ?=1)` ).bind(company,id,subject,canReview||member.role==='auditor'?1:0).first();
    if(!row)return json({error:'not_found'},404);
    // Stadi dell'approvazione (vedi report_decisions.stage/secondApprover
    // in cima al file): letti dalla policy ATTIVA quando il resoconto è
    // stato inviato (row.policy_version), mai quella odierna — un'azienda
    // che aggiunge secondApprover DOPO non deve far spuntare un secondo
    // stadio su resoconti già inviati sotto la regola vecchia.
    const decisions=(await db.prepare('SELECT stage,reviewer,decision,note FROM report_decisions WHERE report_id=? ORDER BY stage ASC').bind(row.id).all()).results||[];
    const reportPolicyRow=await db.prepare('SELECT rules FROM policies WHERE company_id=? AND version=?').bind(company,row.policy_version).first();
    const secondApprover=reportPolicyRow?JSON.parse(reportPolicyRow.rules).secondApprover||null:null;
    const requiredStages=secondApprover?2:1;
    const rejectedDecision=decisions.find(d=>d.decision==='changes_requested');
    const approvedCount=decisions.filter(d=>d.decision==='approved').length;
    const finalDecision=rejectedDecision?'changes_requested':(approvedCount>=requiredStages?'approved':null);
    const lastDecision=decisions[decisions.length-1];
    const nextStageRole=decisions.length===0?['owner','reviewer']:(decisions.length===1&&!rejectedDecision?[secondApprover]:[]);
    const query=new URL(request.url).searchParams;
    const stored=JSON.parse(row.archive),source=stored.format==='momentum-company-upload'?stored.archive:stored;
    if(query.has('attachment')){
      const index=query.get('attachment');
      if(!/^(0|[1-9][0-9]{0,4})$/.test(index||''))return json({error:'invalid_attachment_index'},400);
      const tx=source.transactions?.[Number(index)];
      if(!tx||(!tx.receiptImage&&!tx.receiptRef))return json({error:'not_found'},404);
      try{
        const one=stored.format==='momentum-company-upload'?await hydrateCompanyArchive({...stored,archive:{...source,transactions:[tx]}},env,company,row.submitter):{transactions:[tx]};
        return json({reportId:row.id,fingerprint:row.fingerprint,index:Number(index),receiptImage:one.transactions[0].receiptImage});
      }catch{return json({error:'attachment_unavailable'},409)}
    }
    const summary=query.get('view')==='summary';
    const latest=await db.prepare('SELECT MAX(revision) AS revision FROM reports WHERE company_id=? AND submitter=? AND trip_id=?').bind(company,row.submitter,row.trip_id).first();
    const archive=summary?{...source,transactions:source.transactions.map(({receiptImage,receiptRef,...tx})=>({...tx,hasAttachment:Boolean(receiptImage||receiptRef)}))}:await hydrateCompanyArchive(stored,env,company,row.submitter);const policy=await db.prepare('SELECT MAX(version) AS version FROM policies WHERE company_id=?').bind(company).first();
    const superseded=row.revision!==latest.revision;
    // canDecide: mai lo stesso reviewer per due stadi diversi (Expensify
    // chiama esplicitamente questa regola "un secondo paio d'occhi") — un
    // 'owner' che ha già dato la prima approvazione NON può dare anche la
    // seconda sullo stesso resoconto, deve essere un'altra persona con lo
    // stesso ruolo.
    const canDecide=!finalDecision&&row.submitter!==subject&&!superseded&&nextStageRole.includes(member.role)&&!decisions.some(d=>d.reviewer===subject);
    // Anomalia statistica aziendale (src/trips/company-report-anomaly.js):
    // confronta il TOTALE di questo resoconto con gli altri resoconti GIÀ
    // approvati della stessa azienda (mai con quelli di un singolo
    // dipendente — un'aggregazione di tutta l'azienda, nessuno confrontato
    // individualmente con nessun altro). Mai un blocco, solo un fatto
    // statistico mostrato a chi già vede `checks` — stessa disciplina
    // onesta di policy_daily/policy_limit/duplicate_receipt.
    let companyAnomaly=null;
    if(row.total!=null){
      const history=(await db.prepare(`SELECT r.total FROM reports r WHERE r.company_id=? AND r.id<>? AND r.total IS NOT NULL
        AND r.revision=(SELECT MAX(v.revision) FROM reports v WHERE v.company_id=r.company_id AND v.submitter=r.submitter AND v.trip_id=r.trip_id)
        AND ${finalDecisionExpr}='approved' ORDER BY r.created_at DESC LIMIT 200`).bind(company,row.id).all()).results||[];
      companyAnomaly=companyReportAnomaly(row.total,history.map(h=>h.total));
    }
    return json({...row,archive,superseded,policyStale:row.policy_version!==policy.version,decision:finalDecision,note:lastDecision?.note??null,reviewer:lastDecision?.reviewer??null,decisions,requiredStages,canDecide,attachmentContentsVerified:!summary,checks:summary?null:inspectTripArchive(archive.transactions,archive.trip.receiptPolicy),companyAnomaly});
  }
  if(request.method!=='POST')return json({error:'method_not_allowed'},405);
  if(request.headers.get('Origin')!==env.APP_ORIGIN || !env.APP_ORIGIN || request.headers.get('Content-Type')?.split(';')[0].trim()!=='application/json')return json({error:'invalid_origin_or_type'},403);
  let body;try{body=await readBody(request,id?8192:reportLimit)}catch{return json({error:'invalid_or_oversized_body',maxBytes:id?8192:reportLimit},413)}
  if(id && decisionPath){
    if(!canReview)return json({error:'forbidden'},403);
    if(!body || !['approved','changes_requested'].includes(body.decision) || typeof body.note!=='string' || body.note.length>1000 || (body.decision==='changes_requested'&&!body.note.trim()))return json({error:'invalid_decision'},400);
    const fingerprint=/^"([a-f0-9]{64})"$/.exec(request.headers.get('If-Match')||'')?.[1];
    if(!fingerprint)return json({error:'fingerprint_required'},428);
    if(body.decision==='approved'){
      const candidate=await db.prepare('SELECT archive,submitter FROM reports WHERE company_id=? AND id=?').bind(company,id).first();
      if(candidate){try{await hydrateCompanyArchive(JSON.parse(candidate.archive),env,company,candidate.submitter)}catch{return json({error:'attachment_unavailable'},409)}}
    }
    // Approvazione a due stadi: lo STADIO lo calcola l'INSERT stesso
    // (MAX(stage)+1 su questo resoconto, atomico con l'inserimento — mai
    // un check-poi-scrivi separato, stessa disciplina già in uso per
    // versione/membership). Un resoconto già rifiutato o già arrivato agli
    // stadi richiesti non accetta più nessuna decisione; lo stesso reviewer
    // non può decidere due volte sullo stesso resoconto (mai la stessa
    // persona per due stadi — "un secondo paio d'occhi" reale, non
    // decorativo); il ruolo richiesto per lo stadio corrente lo decide la
    // policy ATTIVA al momento dell'invio (r.policy_version), non quella
    // odierna.
    const result=await db.prepare(`INSERT INTO report_decisions(report_id,stage,reviewer,decision,note,created_at)
      SELECT r.id,(SELECT COALESCE(MAX(stage),0)+1 FROM report_decisions WHERE report_id=r.id),?,?,?,? FROM reports r
      WHERE r.company_id=? AND r.id=? AND r.fingerprint=? AND r.submitter<>?
      AND r.revision=(SELECT MAX(v.revision) FROM reports v WHERE v.company_id=r.company_id AND v.submitter=r.submitter AND v.trip_id=r.trip_id)
      AND (?='changes_requested' OR r.policy_version=(SELECT MAX(version) FROM policies WHERE company_id=r.company_id))
      AND NOT EXISTS(SELECT 1 FROM report_decisions WHERE report_id=r.id AND decision='changes_requested')
      AND NOT EXISTS(SELECT 1 FROM report_decisions WHERE report_id=r.id AND reviewer=?)
      AND (SELECT COUNT(*) FROM report_decisions WHERE report_id=r.id AND decision='approved') < (CASE WHEN (SELECT json_extract(p.rules,'$.secondApprover') FROM policies p WHERE p.company_id=r.company_id AND p.version=r.policy_version) IS NOT NULL THEN 2 ELSE 1 END)
      AND EXISTS(
        SELECT 1 FROM memberships m WHERE m.company_id=r.company_id AND m.subject=? AND m.active=1
        AND (
          ((SELECT COUNT(*) FROM report_decisions WHERE report_id=r.id)=0 AND m.role IN ('owner','reviewer'))
          OR ((SELECT COUNT(*) FROM report_decisions WHERE report_id=r.id)=1 AND m.role=(SELECT json_extract(p.rules,'$.secondApprover') FROM policies p WHERE p.company_id=r.company_id AND p.version=r.policy_version))
        )
      )`)
      .bind(subject,body.decision,body.note.trim(),new Date().toISOString(),company,id,fingerprint,subject,body.decision,subject,subject).run();
    return result.meta?.changes?json({reportId:id,decision:body.decision},201):json({error:'stale_or_forbidden_decision'},409);
  }
  if(id)return json({error:'method_not_allowed'},405);
  const previous=/^"(0|[1-9][0-9]{0,8})"$/.exec(request.headers.get('If-Match')||'');
  if(!previous)return json({error:'revision_required'},428);
  const storedBody=body;
  let release;try{release=await lockArchive(db,company,subject,storedBody)}catch{return json({error:'attachment_busy'},409)}
  let uncertainWrite=false;
  try{
  try{body=await hydrateCompanyArchive(body,env,company,subject)}catch{return json({error:'attachment_unavailable'},409)}
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
  const total=reportTotal(body.transactions);
  uncertainWrite=true;
  const result=await db.prepare(`INSERT INTO reports(id,company_id,submitter,trip_id,revision,policy_version,fingerprint,archive,created_at,total)
    SELECT ?,?,?,?,?,?,?,?,?,? WHERE COALESCE((SELECT MAX(revision) FROM reports WHERE company_id=? AND submitter=? AND trip_id=?),0)=?
    AND EXISTS(SELECT 1 FROM memberships WHERE company_id=? AND subject=? AND active=1)
    AND ?=(SELECT MAX(version) FROM policies WHERE company_id=?)`)
    .bind(reportId,company,subject,trip.id,revision,policy.version,review.reportFingerprint,JSON.stringify(storedBody),new Date().toISOString(),total,company,subject,trip.id,Number(previous[1]),company,subject,policy.version,company).run();
  uncertainWrite=false;
  if(result.meta?.changes)return json({reportId,revision,fingerprint:review.reportFingerprint,checks},201);
  const retry=await db.prepare(`SELECT id,revision,fingerprint FROM reports r WHERE company_id=? AND submitter=? AND trip_id=? AND revision=? AND fingerprint=?
    AND revision=(SELECT MAX(v.revision) FROM reports v WHERE v.company_id=r.company_id AND v.submitter=r.submitter AND v.trip_id=r.trip_id)
    AND EXISTS(SELECT 1 FROM memberships WHERE company_id=r.company_id AND subject=? AND active=1)`)
    .bind(company,subject,trip.id,revision,review.reportFingerprint,subject).first();
  return retry?json({reportId:retry.id,revision:retry.revision,fingerprint:retry.fingerprint,checks}):json({error:'revision_or_access_changed'},409);
  }finally{if(!uncertainWrite)await release()}
}
