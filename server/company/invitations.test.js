import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { invitationRequest } from './invitations.js';
import { companyRequest } from './worker.js';
import { joinPage } from './join-page.js';

function fixture() {
  const sql = new DatabaseSync(':memory:');
  for (const file of ['schema.sql', 'invitations.sql']) sql.exec(readFileSync(new URL(file, import.meta.url), 'utf8'));
  sql.exec("INSERT INTO companies VALUES('a','Company A'),('b','Company B'); INSERT INTO memberships VALUES('a','owner','owner',1),('a','staff','employee',1),('b','other','owner',1)");
  const db = { prepare(query) { return { bind(...args) { return {
    async first() { return sql.prepare(query).get(...args) || null; },
    async all() { return { results: sql.prepare(query).all(...args) }; },
    async run() { return { meta: { changes: Number(sql.prepare(query).run(...args).changes) } }; },
  }; } }; } };
  const env = { COMPANY_DB: db, APP_ORIGIN: 'https://momentum.test' };
  const identity = { subject: 'alice', email: 'alice@example.com' };
  const req = (path, body) => new Request(env.APP_ORIGIN + path, { method: 'POST', headers: { Origin: env.APP_ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const call = (path, body, actor = identity) => invitationRequest(req(path, body), env, actor);
  const invite = async () => (await call('/v1/companies/a/invitations', { email: identity.email, role: 'employee' }, { subject: 'owner', email: 'owner@example.com' })).json();
  return { sql, env, call, invite, identity };
}
test('invitation creates real membership atomically and enables policy read, with safe retries', async () => {
  const { sql, env, call, invite } = fixture();
  try {
    const invitation = await invite(); const token = new URL(invitation.url).hash.slice(1);
    assert.notEqual(invitation.invitationId, token);
    assert.equal(sql.prepare('SELECT token_hash FROM invitations').get().token_hash, invitation.invitationId);
    assert.equal((await call('/v1/invitations/preview', { token })).status, 200);
    assert.equal(sql.prepare("SELECT count(*) n FROM memberships WHERE subject='alice'").get().n, 0);
    assert.equal((await call('/v1/invitations/accept', { token })).status, 201);
    assert.equal((await call('/v1/invitations/accept', { token })).status, 200);
    assert.equal(sql.prepare("SELECT count(*) n FROM memberships WHERE subject='alice'").get().n, 1);
    sql.prepare('INSERT INTO policies VALUES(?,?,?,?,?)').run('a', 1, '{"currency":"EUR"}', 'owner', '2026-09-13');
    assert.equal((await companyRequest(new Request('https://momentum.test/v1/companies/a/policies'), env, 'alice')).status, 200);
  } finally { sql.close(); }
});
test('forwarded, expired and revoked invitations cannot grant access', async () => {
  const { sql, call, invite } = fixture();
  try {
    const invitation = await invite(); const token = new URL(invitation.url).hash.slice(1);
    assert.equal((await call('/v1/invitations/accept', { token }, { subject: 'evil', email: 'evil@example.com' })).status, 403);
    sql.exec('UPDATE invitations SET expires_at=1');
    assert.equal((await call('/v1/invitations/accept', { token })).status, 403);
    const second = await invite();
    assert.equal((await call('/v1/companies/a/invitations/revoke', { invitationId: second.invitationId }, { subject: 'owner', email: 'owner@example.com' })).status, 200);
    assert.equal((await call('/v1/invitations/accept', { token: new URL(second.url).hash.slice(1) })).status, 403);
  } finally { sql.close(); }
});
test('tenant owners cannot invite into another company or grant ownership; staff cannot invite', async () => {
  const { sql, call } = fixture();
  try {
    for (const subject of ['staff', 'other']) assert.equal((await call('/v1/companies/a/invitations', { email: 'alice@example.com', role: 'employee' }, { subject, email: 'test@example.com' })).status, 403);
    assert.equal((await call('/v1/companies/a/invitations', { email: 'alice@example.com', role: 'owner' }, { subject: 'owner', email: 'test@example.com' })).status, 400);
  } finally { sql.close(); }
});
test('invitations never restore revoked membership or work after issuer revocation', async () => {
  const { sql, call, invite } = fixture();
  try {
    const invitation = await invite(); const token = new URL(invitation.url).hash.slice(1);
    sql.exec("INSERT INTO memberships VALUES('a','alice','employee',0)");
    assert.equal((await call('/v1/invitations/accept', { token })).status, 409);
    sql.exec("UPDATE memberships SET active=0 WHERE subject='owner'");
    assert.equal((await call('/v1/invitations/accept', { token })).status, 403);
  } finally { sql.close(); }
});
test('join page disallows embedding and external scripts and contains seven languages', async () => {
  const response = joinPage(); const html = await response.text();
  assert.match(response.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
  assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
  for (const lang of ['it','en','de','fr','es','nl','pt']) assert.ok(html.includes(`"${lang}":`));
});
