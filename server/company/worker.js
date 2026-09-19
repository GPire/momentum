import { companyIdentity } from './identity.js';
import { companyStorageEnvironment } from './d1-files.js';
import { storageAuditRequest } from './storage-audit.js';
import { storagePage } from './storage-page.js';
import { cleanupAttachmentRequest } from './attachment-lifecycle.js';
import { attachmentRecoveryRequest } from './attachment-recovery.js';
import { invitationRequest } from './invitations.js';
import { joinPage } from './join-page.js';
import { workspacePage } from './workspace-page.js';
import { reportRequest } from './reports.js';
import { attachmentRequest } from './attachments.js';
import { inboxPage } from './inbox-page.js';
import { VALUTE_ISO4217 } from '../../src/core/iso4217.js';

const categories = ['trasporto', 'vitto', 'alloggio', 'altro'];
const amount = n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && Number.isSafeInteger(Math.round(n * 100)) && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
// Una tariffa al km/miglio NON è un importo assoluto: le tariffe reali hanno
// spesso il terzo decimale (IRS USA 2026: $0,725/miglio — bocciata da
// amount() sopra, che richiede centesimi interi, verificato scrivendo
// questo stesso test). Stessa disciplina di amount() ma a 3 decimali, non 2.
const tariffaUnitaria = n => typeof n === 'number' && Number.isFinite(n) && n > 0 && n < 1000 && Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-6;
// perDiem/mileage sono OPZIONALI: una policy pubblicata prima che esistessero
// resta valida senza (retrocompatibile) — mai una rottura per un'azienda che
// ha già pubblicato solo receiptThreshold/limiti. Quando presenti, decidono
// la diaria/il rimborso chilometrico per OGNI dipendente della trasferta —
// prima non c'era alcun modo per un responsabile di fissarli, ogni
// dipendente inseriva un numero a piacere sulla propria trasferta (bug
// architetturale reale, segnalato dall'utente 2026-09-18: "le quote vengono
// definite da altri uffici, mica da dove compila il dipendente").
function validaOpzionale(rules, chiave, valida) {
  return !(chiave in rules) || valida(rules[chiave]);
}
export function validateCompanyRules(rules) {
  if (!rules || typeof rules !== 'object' || Array.isArray(rules) || Object.keys(rules).some(k => !['currency', 'receiptThreshold', 'expenseLimits', 'dailyLimits', 'perDiem', 'mileage', 'secondApprover'].includes(k))) return false;
  // Fino al 2026-09-19 solo EUR era ammessa: l'editor (workspace-page.js)
  // non aveva un campo valuta, pubblicare qualunque altra cosa avrebbe
  // significato un valore mai scelto da nessuno. Ora che l'editor esiste
  // ed espone il campo, qualunque valuta ISO 4217 reale è ammessa — mai
  // una sigla inventata (un'azienda a Londra/Oslo/Mumbai deve poter
  // pubblicare una policy nella propria valuta, non solo in euro).
  if (typeof rules.currency !== 'string' || !VALUTE_ISO4217.has(rules.currency) || !amount(rules.receiptThreshold)) return false;
  if (!['expenseLimits', 'dailyLimits'].every(name => {
    const limits = rules[name];
    return limits && typeof limits === 'object' && !Array.isArray(limits) && Object.entries(limits).every(([key, value]) => categories.includes(key) && amount(value));
  })) return false;
  if (!validaOpzionale(rules, 'perDiem', (p) => p && typeof p === 'object' && !Array.isArray(p) && Object.keys(p).every(k => ['piena', 'ridotta'].includes(k)) && amount(p.piena) && amount(p.ridotta) && p.ridotta <= p.piena)) return false;
  if (!validaOpzionale(rules, 'mileage', (m) => m && typeof m === 'object' && !Array.isArray(m) && Object.keys(m).every(k => ['tariffa', 'unita'].includes(k)) && tariffaUnitaria(m.tariffa) && ['km', 'mi'].includes(m.unita))) return false;
  // secondApprover (opzionale, ricerca 2026-09-19): quando impostato, OGNI
  // resoconto richiede una SECONDA approvazione da qualcuno con questo
  // ruolo, sempre una persona diversa da chi ha dato la prima — pattern
  // reale più comune trovato (Expensify "Advanced Approval": il
  // responsabile approva e inoltra, la finance dà l'ultima parola). Sempre
  // 'owner' per ora (unico ruolo con autorità gerarchica sopra 'reviewer'
  // nello schema esistente) — mai 'reviewer' due volte, sarebbe lo stesso
  // livello travestito da due. Nessuna soglia di importo in questa prima
  // versione (limite dichiarato: sempre 2 stadi se attivo, non solo sopra
  // un importo — richiederebbe sommare l'archivio in SQL, cantiere a parte).
  if (!validaOpzionale(rules, 'secondApprover', (s) => s === 'owner')) return false;
  return true;
}
export const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
export async function readBody(request, limit = 8192) {
  if (!request.body) throw new Error('Empty body');
  const reader = request.body.getReader();
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); throw new Error('Too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const buffer = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(buffer));
}

// Exported separately for tests; production always verifies companyIdentity first.
export async function companyRequest(request, env, subject) {
  if (typeof subject !== 'string' || !subject) return json({ error: 'unauthenticated' }, 401);
  const url = new URL(request.url);
  if (url.pathname === '/v1/me/companies') {
    if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
    if (!env.COMPANY_DB) return json({ error: 'not_configured' }, 503);
    const cursor = url.searchParams.get('after') || '';
    if (cursor && !/^[a-zA-Z0-9_-]{1,80}$/.test(cursor)) return json({ error: 'invalid_cursor' }, 400);
    const db = env.COMPANY_DB.withSession ? env.COMPANY_DB.withSession('first-primary') : env.COMPANY_DB;
    // pendingCount: quanti resoconti aspettano UNA decisione dalla persona
    // che sta guardando — SOLO per chi può decidere (owner/reviewer),
    // consapevole degli stadi (vedi report_decisions.stage/secondApprover
    // sotto): un 'reviewer' vede solo i resoconti al primo stadio, un
    // 'owner' vede anche quelli in attesa della seconda approvazione
    // finale. Gap reale trovato il 2026-09-19: un reviewer scopriva una
    // richiesta pendente solo se ricordava di riaprire l'inbox di sua
    // iniziativa — nessuna notifica esisteva. Non è ancora una notifica
    // push/email (richiederebbe un servizio esterno, stesso blocco dei
    // pagamenti), ma almeno il numero è visibile SUBITO aprendo l'elenco
    // aziende, non sepolto dentro l'inbox di ciascuna. Semplificazione
    // dichiarata: non esclude chi ha già dato la prima approvazione dal
    // conteggio della seconda (lo fa invece la vera porta in reports.js,
    // questo è solo un numero indicativo, non un controllo di sicurezza).
    const result = await db.prepare(`WITH pending_reports AS (
        SELECT r.id, r.company_id,
          (SELECT COUNT(*) FROM report_decisions d WHERE d.report_id=r.id AND d.decision='approved') AS approved_stages,
          EXISTS(SELECT 1 FROM report_decisions d WHERE d.report_id=r.id AND d.decision='changes_requested') AS rejected,
          (SELECT json_extract(p.rules,'$.secondApprover') FROM policies p WHERE p.company_id=r.company_id AND p.version=r.policy_version) AS second_approver
        FROM reports r
        WHERE r.revision=(SELECT MAX(v.revision) FROM reports v WHERE v.company_id=r.company_id AND v.submitter=r.submitter AND v.trip_id=r.trip_id)
      )
      SELECT c.id,c.name,m.role,(SELECT MAX(version) FROM policies p WHERE p.company_id=c.id) AS policyVersion,
      (CASE
        WHEN m.role='reviewer' THEN (SELECT COUNT(*) FROM pending_reports pr WHERE pr.company_id=c.id AND NOT pr.rejected AND pr.approved_stages=0)
        WHEN m.role='owner' THEN (SELECT COUNT(*) FROM pending_reports pr WHERE pr.company_id=c.id AND NOT pr.rejected AND (pr.approved_stages=0 OR (pr.approved_stages=1 AND pr.second_approver='owner')))
        ELSE NULL
      END) AS pendingCount
      FROM companies c JOIN memberships m ON m.company_id=c.id WHERE m.subject=? AND m.active=1 AND c.id>? ORDER BY c.id LIMIT 51`).bind(subject, cursor).all();
    const rows = result.results || [];
    return json({ companies: rows.slice(0, 50), nextCursor: rows.length > 50 ? rows[49].id : null });
  }
  const match = /^\/v1\/companies\/([a-zA-Z0-9_-]{1,80})\/policies(?:\/([1-9][0-9]{0,8}))?$/.exec(url.pathname);
  if (!match) return json({ error: 'not_found' }, 404);
  if (!['GET', 'POST'].includes(request.method)) return json({ error: 'method_not_allowed' }, 405);
  if (!env.COMPANY_DB) return json({ error: 'not_configured' }, 503);
  // Primary reads are required: stale membership replicas must not allow a
  // recently revoked user to read or publish company policy.
  const db = env.COMPANY_DB.withSession ? env.COMPANY_DB.withSession('first-primary') : env.COMPANY_DB;
  const company = match[1];
  const member = await db.prepare('SELECT m.role,c.name AS companyName FROM memberships m JOIN companies c ON c.id=m.company_id WHERE company_id = ? AND subject = ? AND active = 1').bind(company, subject).first();
  if (!member) return json({ error: 'forbidden' }, 403);
  if (request.method === 'GET') {
    const row = match[2]
      ? await db.prepare('SELECT * FROM policies WHERE company_id = ? AND version = ?').bind(company, Number(match[2])).first()
      : await db.prepare('SELECT * FROM policies WHERE company_id = ? ORDER BY version DESC LIMIT 1').bind(company).first();
    return row ? json({ companyId: company, companyName: member.companyName, version: row.version, rules: JSON.parse(row.rules), author: row.author, createdAt: row.created_at }, 200, { ETag: `"${row.version}"` }) : json({ error: 'not_found' }, 404);
  }
  if (match[2]) return json({ error: 'method_not_allowed' }, 405);
  if (!['owner', 'policy_admin'].includes(member.role)) return json({ error: 'forbidden' }, 403);
  if (!env.APP_ORIGIN || request.headers.get('Origin') !== env.APP_ORIGIN || request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') return json({ error: 'invalid_origin_or_type' }, 403);
  const version = /^"(0|[1-9][0-9]{0,8})"$/.exec(request.headers.get('If-Match') || '');
  if (!version) return json({ error: 'version_required' }, 428);
  let body;
  try { body = await readBody(request); } catch { return json({ error: 'invalid_body' }, 400); }
  if (!validateCompanyRules(body)) return json({ error: 'invalid_rules' }, 400);
  const previous = Number(version[1]);
  const created = new Date().toISOString();
  // Membership and expected version are checked atomically with the insertion.
  // Concurrent editors cannot overwrite or silently fork the same version.
  const result = await db.prepare(`INSERT INTO policies(company_id, version, rules, author, created_at)
    SELECT ?, ?, ?, ?, ? WHERE
    COALESCE((SELECT MAX(version) FROM policies WHERE company_id = ?), 0) = ?
    AND EXISTS (SELECT 1 FROM memberships WHERE company_id = ? AND subject = ? AND active = 1 AND role IN ('owner','policy_admin'))`)
    .bind(company, previous + 1, JSON.stringify(body), subject, created, company, previous, company, subject).run();
  if (!result.meta?.changes) return json({ error: 'version_or_membership_changed' }, 409);
  return json({ companyId: company, version: previous + 1 }, 201, { ETag: `"${previous + 1}"` });
}

export function createCompanyWorker(resolveIdentity = companyIdentity) { return {
  async fetch(request, env) {
    let identity;
    try { identity = await resolveIdentity(request, env); } catch { return json({ error: 'unauthenticated' }, 401); }
    try {
      env=companyStorageEnvironment(env);
      const path = new URL(request.url).pathname;
      if (/^\/v1\/companies\/[^/]+\/storage\/(journal|reconcile)$/.test(path)) return await attachmentRecoveryRequest(request, env, identity.subject);
      if (/^\/v1\/companies\/[^/]+\/storage\/cleanup$/.test(path)) return await cleanupAttachmentRequest(request, env, identity.subject);
      if (path === '/company/storage' && request.method === 'GET') return storagePage();
      if (/^\/v1\/companies\/[^/]+\/storage$/.test(path)) return await storageAuditRequest(request, env, identity.subject);
      if (path === '/company/join' && request.method === 'GET') return joinPage();
      if (path === '/company/workspace' && request.method === 'GET') return workspacePage();
      if (path === '/company/reports' && request.method === 'GET') return inboxPage();
      if (/^\/v1\/companies\/[^/]+\/attachments\//.test(path)) return await attachmentRequest(request, env, identity.subject);
      if (path.includes('/invitations')) return await invitationRequest(request, env, identity);
      if (/^\/v1\/companies\/[^/]+\/reports(?:\/|$)/.test(path)) return await reportRequest(request, env, identity.subject);
      return await companyRequest(request, env, identity.subject);
    } catch { return json({ error: 'service_unavailable' }, 503); }
  },
}; }
export default createCompanyWorker();
