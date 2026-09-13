import { accessIdentity } from './access.js';
import { invitationRequest } from './invitations.js';
import { joinPage } from './join-page.js';
import { workspacePage } from './workspace-page.js';

const categories = ['trasporto', 'vitto', 'alloggio', 'altro'];
const amount = n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && Number.isSafeInteger(Math.round(n * 100)) && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
export function validateCompanyRules(rules) {
  if (!rules || typeof rules !== 'object' || Array.isArray(rules) || Object.keys(rules).some(k => !['currency', 'receiptThreshold', 'expenseLimits', 'dailyLimits'].includes(k))) return false;
  // The current application editor is denominated in EUR. Do not silently
  // publish other currencies until its import/edit path supports them.
  if (rules.currency !== 'EUR' || !amount(rules.receiptThreshold)) return false;
  return ['expenseLimits', 'dailyLimits'].every(name => {
    const limits = rules[name];
    return limits && typeof limits === 'object' && !Array.isArray(limits) && Object.entries(limits).every(([key, value]) => categories.includes(key) && amount(value));
  });
}
export const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
export async function readBody(request) {
  if (!request.body) throw new Error('Empty body');
  const reader = request.body.getReader();
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 8192) { await reader.cancel(); throw new Error('Too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const buffer = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(buffer));
}

// Exported separately for tests; production always calls accessSubject first.
export async function companyRequest(request, env, subject) {
  if (typeof subject !== 'string' || !subject) return json({ error: 'unauthenticated' }, 401);
  const url = new URL(request.url);
  if (url.pathname === '/v1/me/companies') {
    if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
    if (!env.COMPANY_DB) return json({ error: 'not_configured' }, 503);
    const cursor = url.searchParams.get('after') || '';
    if (cursor && !/^[a-zA-Z0-9_-]{1,80}$/.test(cursor)) return json({ error: 'invalid_cursor' }, 400);
    const db = env.COMPANY_DB.withSession ? env.COMPANY_DB.withSession('first-primary') : env.COMPANY_DB;
    const result = await db.prepare(`SELECT c.id,c.name,m.role,(SELECT MAX(version) FROM policies p WHERE p.company_id=c.id) AS policyVersion
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
  const member = await db.prepare('SELECT role FROM memberships WHERE company_id = ? AND subject = ? AND active = 1').bind(company, subject).first();
  if (!member) return json({ error: 'forbidden' }, 403);
  if (request.method === 'GET') {
    const row = match[2]
      ? await db.prepare('SELECT * FROM policies WHERE company_id = ? AND version = ?').bind(company, Number(match[2])).first()
      : await db.prepare('SELECT * FROM policies WHERE company_id = ? ORDER BY version DESC LIMIT 1').bind(company).first();
    return row ? json({ companyId: company, version: row.version, rules: JSON.parse(row.rules), author: row.author, createdAt: row.created_at }, 200, { ETag: `"${row.version}"` }) : json({ error: 'not_found' }, 404);
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

export default {
  async fetch(request, env) {
    let identity;
    try { identity = await accessIdentity(request, env); } catch { return json({ error: 'unauthenticated' }, 401); }
    try {
      const path = new URL(request.url).pathname;
      if (path === '/company/join' && request.method === 'GET') return joinPage();
      if (path === '/company/workspace' && request.method === 'GET') return workspacePage();
      if (path.includes('/invitations')) return await invitationRequest(request, env, identity);
      return await companyRequest(request, env, identity.subject);
    } catch { return json({ error: 'service_unavailable' }, 503); }
  },
};
