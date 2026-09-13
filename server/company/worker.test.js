import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker, { companyRequest, validateCompanyRules } from './worker.js';
import { accessSubject } from './access.js';

const rules = { currency: 'EUR', receiptThreshold: 25, expenseLimits: { vitto: 30 }, dailyLimits: { vitto: 60 } };
function fixture() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  sql.exec("INSERT INTO companies VALUES ('a','Company A'),('b','Company B'); INSERT INTO memberships VALUES ('a','admin','owner',1),('a','employee','employee',1),('a','reviewer','reviewer',1),('a','auditor','auditor',1),('a','editor','policy_admin',1),('b','outsider','owner',1)");
  const db = { prepare(query) { return { bind(...args) { return {
    async first() { return sql.prepare(query).get(...args) || null; },
    async run() { return { meta: { changes: Number(sql.prepare(query).run(...args).changes) } }; },
  }; } }; } };
  const env = { COMPANY_DB: db, APP_ORIGIN: 'https://momentum.test' };
  const request = (method = 'GET', company = 'a', version = 0, body = rules, origin = env.APP_ORIGIN) => new Request(`https://momentum.test/v1/companies/${company}/policies`, { method, headers: { Origin: origin, 'Content-Type': 'application/json', 'If-Match': `"${version}"` }, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}) });
  return { sql, env, request };
}

test('company policy publishes to actual SQLite and supports immutable version retrieval', async () => {
  const { sql, env, request } = fixture();
  try {
    assert.equal((await companyRequest(request('POST'), env, 'admin')).status, 201);
    assert.equal((await companyRequest(request('POST', 'a', 1, { ...rules, receiptThreshold: 0 }), env, 'editor')).status, 201);
    const latest = await companyRequest(request(), env, 'employee');
    assert.equal((await latest.json()).version, 2);
    const old = await companyRequest(new Request('https://momentum.test/v1/companies/a/policies/1'), env, 'auditor');
    assert.equal((await old.json()).rules.receiptThreshold, 25);
    assert.throws(() => sql.exec('UPDATE policies SET version=3'), /immutable/);
    assert.throws(() => sql.exec('DELETE FROM policies'), /immutable/);
  } finally { sql.close(); }
});
test('tenant boundaries and roles are enforced on reads and writes', async () => {
  const { sql, env, request } = fixture();
  try {
    for (const subject of ['employee', 'reviewer', 'auditor', 'outsider', 'unknown']) assert.equal((await companyRequest(request('POST'), env, subject)).status, 403);
    assert.equal((await companyRequest(request(), env, 'outsider')).status, 403);
    assert.equal((await companyRequest(request('GET', 'b'), env, 'admin')).status, 403);
    assert.equal((await companyRequest(request(), env, '')).status, 401);
    sql.exec("UPDATE memberships SET active=0 WHERE subject='admin'");
    assert.equal((await companyRequest(request('POST'), env, 'admin')).status, 403);
  } finally { sql.close(); }
});
test('stale edits, hostile origins and unvalidated rules cannot publish', async () => {
  const { sql, env, request } = fixture();
  try {
    assert.equal((await companyRequest(request('POST'), env, 'admin')).status, 201);
    assert.equal((await companyRequest(request('POST'), env, 'admin')).status, 409);
    assert.equal((await companyRequest(request('POST', 'a', 1, rules, 'https://evil.test'), env, 'admin')).status, 403);
    for (const body of [{ ...rules, role: 'owner' }, { ...rules, currency: 'USD' }, { ...rules, dailyLimits: { vitto: -1 } }, { ...rules, expenseLimits: { unknown: 2 } }]) {
      assert.equal(validateCompanyRules(body), false);
      assert.equal((await companyRequest(request('POST', 'a', 1, body), env, 'admin')).status, 400);
    }
    assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM policies').get().n, 1);
  } finally { sql.close(); }
});
test('write rechecks a membership revoked after initial authorization', async () => {
  const { sql, env, request } = fixture();
  const original = env.COMPANY_DB.prepare;
  env.COMPANY_DB.prepare = query => {
    if (query.startsWith('INSERT')) sql.exec("UPDATE memberships SET active=0 WHERE subject='admin'");
    return original(query);
  };
  try { assert.equal((await companyRequest(request('POST'), env, 'admin')).status, 409); }
  finally { sql.close(); }
});
test('missing identity, missing version and oversized bodies fail closed', async () => {
  const { sql, env, request } = fixture();
  try {
    assert.equal((await worker.fetch(request(), env)).status, 401);
    const missingVersion = request('POST'); missingVersion.headers.delete('If-Match');
    assert.equal((await companyRequest(missingVersion, env, 'admin')).status, 428);
    assert.equal((await companyRequest(request('POST', 'a', 0, { text: 'a'.repeat(9000) }), env, 'admin')).status, 400);
    assert.equal(validateCompanyRules({ ...rules, receiptThreshold: 0.001 }), false);
    assert.equal(validateCompanyRules({ ...rules, receiptThreshold: 0.29 }), true);
  } finally { sql.close(); }
});
test('Access verifies cryptographic signature, audience, expiry and issuer', async () => {
  const keys = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', keys.publicKey);
  const env = { ACCESS_ISSUER: 'https://test.cloudflareaccess.com', ACCESS_AUD: 'aud' };
  const claims = { iss: env.ACCESS_ISSUER, aud: ['aud'], sub: 'admin', exp: Date.now() / 1000 + 300 };
  const base64 = value => Buffer.from(value).toString('base64url');
  async function token(payload) {
    const message = `${base64(JSON.stringify({ alg: 'RS256', kid: 'key' }))}.${base64(JSON.stringify(payload))}`;
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey, new TextEncoder().encode(message));
    return `${message}.${base64(signature)}`;
  }
  const fetchKeys = async url => { assert.equal(url, `${env.ACCESS_ISSUER}/cdn-cgi/access/certs`); return Response.json({ keys: [{ ...jwk, kid: 'key' }] }); };
  const request = value => new Request('https://momentum.test', { headers: { 'Cf-Access-Jwt-Assertion': value } });
  assert.equal(await accessSubject(request(await token(claims)), env, fetchKeys), 'admin');
  for (const change of [{ exp: 1 }, { aud: ['other'] }, { iss: 'https://evil.test' }, { nbf: Date.now() / 1000 + 600 }]) await assert.rejects(accessSubject(request(await token({ ...claims, ...change })), env, fetchKeys));
  const valid = await token(claims);
  const pieces = valid.split('.');
  pieces[1] = base64(JSON.stringify({ ...claims, sub: 'owner' }));
  await assert.rejects(accessSubject(request(pieces.join('.')), env, fetchKeys));
});
