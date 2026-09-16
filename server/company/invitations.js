import { json, readBody } from './worker.js';

const hash = async token => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))].map(n => n.toString(16).padStart(2, '0')).join('');
export async function invitationRequest(request, env, identity) {
  if (!identity?.subject || !identity.email) return json({ error: 'identity_email_required' }, 401);
  if (!env.COMPANY_DB) return json({ error: 'not_configured' }, 503);
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!env.APP_ORIGIN || request.headers.get('Origin') !== env.APP_ORIGIN || request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') return json({ error: 'invalid_origin_or_type' }, 403);
  let body;
  try { body = await readBody(request); } catch { return json({ error: 'invalid_body' }, 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'invalid_body' }, 400);
  const db = env.COMPANY_DB.withSession ? env.COMPANY_DB.withSession('first-primary') : env.COMPANY_DB;
  const path = new URL(request.url).pathname;
  const create = /^\/v1\/companies\/([a-zA-Z0-9_-]{1,80})\/invitations$/.exec(path);
  if (create) {
    if (typeof body.email !== 'string' || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) || !['employee', 'reviewer', 'auditor', 'policy_admin'].includes(body.role)) return json({ error: 'invalid_invitation' }, 400);
    const token = [...crypto.getRandomValues(new Uint8Array(32))].map(n => n.toString(16).padStart(2, '0')).join('');
    const digest = await hash(token);
    const expires = Date.now() + 7 * 86400000;
    const result = await db.prepare(`INSERT INTO invitations(token_hash,company_id,email,role,invited_by,expires_at)
      SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM memberships WHERE company_id=? AND subject=? AND role='owner' AND active=1)`)
      .bind(digest, create[1], body.email.trim().toLowerCase(), body.role, identity.subject, expires, create[1], identity.subject).run();
    if (!result.meta?.changes) return json({ error: 'forbidden' }, 403);
    return json({ invitationId: digest, expiresAt: expires, url: `${env.APP_ORIGIN}/company/join#${token}` }, 201);
  }
  const revoke = /^\/v1\/companies\/([a-zA-Z0-9_-]{1,80})\/invitations\/revoke$/.exec(path);
  if (revoke) {
    if (typeof body.invitationId !== 'string' || !/^[a-f0-9]{64}$/.test(body.invitationId)) return json({ error: 'invalid_invitation' }, 400);
    const result = await db.prepare(`UPDATE invitations SET revoked=1 WHERE company_id=? AND token_hash=? AND accepted_by IS NULL
      AND EXISTS(SELECT 1 FROM memberships WHERE company_id=? AND subject=? AND role='owner' AND active=1)`)
      .bind(revoke[1], body.invitationId, revoke[1], identity.subject).run();
    return result.meta?.changes ? json({ revoked: true }) : json({ error: 'not_available' }, 404);
  }
  if (!['/v1/invitations/preview', '/v1/invitations/accept'].includes(path)) return json({ error: 'not_found' }, 404);
  if (typeof body.token !== 'string' || !/^[a-f0-9]{64}$/.test(body.token)) return json({ error: 'invalid_invitation' }, 400);
  const digest = await hash(body.token);
  const email = identity.email.toLowerCase();
  const invitation = await db.prepare(`SELECT i.*,c.name FROM invitations i JOIN companies c ON c.id=i.company_id
    WHERE token_hash=? AND email=? AND revoked=0 AND expires_at>?
    AND EXISTS(SELECT 1 FROM memberships WHERE company_id=i.company_id AND subject=i.invited_by AND role='owner' AND active=1)`)
    .bind(digest, email, Date.now()).first();
  if (!invitation) return json({ error: 'invitation_unavailable' }, 403);
  if (path.endsWith('/preview')) return json({ companyName: invitation.name, role: invitation.role });
  if (invitation.accepted_by === identity.subject) {
    const member = await db.prepare('SELECT role FROM memberships WHERE company_id=? AND subject=? AND active=1').bind(invitation.company_id, identity.subject).first();
    return member ? json({ companyId: invitation.company_id, role: member.role }) : json({ error: 'membership_revoked' }, 403);
  }
  const result = await db.prepare(`UPDATE invitations SET accepted_by=?,accepted_at=?
    WHERE token_hash=? AND email=? AND accepted_by IS NULL AND revoked=0 AND expires_at>?
    AND EXISTS(SELECT 1 FROM memberships WHERE company_id=invitations.company_id AND subject=invitations.invited_by AND role='owner' AND active=1)
    AND NOT EXISTS(SELECT 1 FROM memberships WHERE company_id=invitations.company_id AND subject=?)`)
    .bind(identity.subject, Date.now(), digest, email, Date.now(), identity.subject).run();
  if (!result.meta?.changes) return json({ error: 'invitation_already_used_or_membership_exists' }, 409);
  return json({ companyId: invitation.company_id, role: invitation.role }, 201);
}
