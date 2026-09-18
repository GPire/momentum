import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker, { companyRequest, validateCompanyRules } from './worker.js';
import { accessSubject } from './access.js';
import { workspacePage } from './workspace-page.js';

const rules = { currency: 'EUR', receiptThreshold: 25, expenseLimits: { vitto: 30 }, dailyLimits: { vitto: 60 } };
function fixture() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  sql.exec(readFileSync(new URL('./reports.sql', import.meta.url), 'utf8'));
  sql.exec("INSERT INTO companies VALUES ('a','Company A'),('b','Company B'); INSERT INTO memberships VALUES ('a','admin','owner',1),('a','employee','employee',1),('a','reviewer','reviewer',1),('a','auditor','auditor',1),('a','editor','policy_admin',1),('b','outsider','owner',1)");
  const db = { prepare(query) { return { bind(...args) { return {
    async first() { return sql.prepare(query).get(...args) || null; },
    async all() { return { results: sql.prepare(query).all(...args) }; },
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
test('company discovery returns only active memberships and paginates without duplicates', async () => {
  const { sql, env } = fixture();
  try {
    for (let n=0;n<55;n++) { const id='c'+String(n).padStart(2,'0'); sql.prepare('INSERT INTO companies VALUES(?,?)').run(id,id); sql.prepare('INSERT INTO memberships VALUES(?,?,?,1)').run(id,'employee','employee'); }
    const first = await (await companyRequest(new Request('https://momentum.test/v1/me/companies'), env, 'employee')).json();
    assert.equal(first.companies.length,50);
    assert.ok(!first.companies.some(c=>c.id==='b'));
    const second = await (await companyRequest(new Request('https://momentum.test/v1/me/companies?after='+first.nextCursor), env, 'employee')).json();
    assert.equal(second.companies.length,6);
    assert.equal(new Set([...first.companies,...second.companies].map(c=>c.id)).size,56);
    sql.exec("UPDATE memberships SET active=0 WHERE subject='employee'");
    assert.deepEqual((await (await companyRequest(new Request('https://momentum.test/v1/me/companies'),env,'employee')).json()).companies,[]);
  } finally { sql.close(); }
});
test('workspace page provides translated labels and a restrictive content policy', async () => {
  const response=workspacePage();const html=await response.text();
  assert.match(response.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);
  for (const lang of ['it','en','de','fr','es','nl','pt']) assert.ok(html.includes(`"${lang}":`));
  assert.ok(html.includes("company.role!=='owner'"));
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
    for (const body of [{ ...rules, role: 'owner' }, { ...rules, currency: 'ZZZ' }, { ...rules, currency: 'eur' }, { ...rules, dailyLimits: { vitto: -1 } }, { ...rules, expenseLimits: { unknown: 2 } }]) {
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

test('validateCompanyRules: perDiem/mileage sono opzionali — una policy pubblicata prima che esistessero resta valida', () => {
  assert.equal(validateCompanyRules(rules), true);
});

test('validateCompanyRules: perDiem valido (quota ridotta non può superare quella piena)', () => {
  assert.equal(validateCompanyRules({ ...rules, perDiem: { piena: 28, ridotta: 14 } }), true);
  assert.equal(validateCompanyRules({ ...rules, perDiem: { piena: 14, ridotta: 28 } }), false);
  assert.equal(validateCompanyRules({ ...rules, perDiem: { piena: -1, ridotta: 0 } }), false);
  assert.equal(validateCompanyRules({ ...rules, perDiem: { piena: 28 } }), false);
});

test('validateCompanyRules: mileage valido (tariffa positiva, unita km o mi)', () => {
  assert.equal(validateCompanyRules({ ...rules, mileage: { tariffa: 0.30, unita: 'km' } }), true);
  assert.equal(validateCompanyRules({ ...rules, mileage: { tariffa: 0.725, unita: 'mi' } }), true);
  assert.equal(validateCompanyRules({ ...rules, mileage: { tariffa: 0, unita: 'km' } }), false);
  assert.equal(validateCompanyRules({ ...rules, mileage: { tariffa: 0.30, unita: 'furlong' } }), false);
});

test('validateCompanyRules: perDiem/mileage pubblicati end-to-end attraverso il worker reale', async () => {
  const { sql, env, request } = fixture();
  try {
    const body = { ...rules, perDiem: { piena: 68, ridotta: 51 }, mileage: { tariffa: 0.725, unita: 'mi' } };
    assert.equal((await companyRequest(request('POST', 'a', 0, body), env, 'admin')).status, 201);
    const stored = JSON.parse(sql.prepare('SELECT rules FROM policies WHERE company_id=? ORDER BY version DESC LIMIT 1').get('a').rules);
    assert.deepEqual(stored.perDiem, { piena: 68, ridotta: 51 });
    assert.deepEqual(stored.mileage, { tariffa: 0.725, unita: 'mi' });
  } finally { sql.close(); }
});

test('workspace page includes a policy-editing form gated to owner/policy_admin, with perDiem/mileage fields', async () => {
  const response = workspacePage();
  const html = await response.text();
  assert.ok(html.includes('id="edit-policy"'));
  assert.ok(html.includes('id="perdiem-full"'));
  assert.ok(html.includes('id="perdiem-reduced"'));
  assert.ok(html.includes('id="mileage-rate"'));
  assert.ok(html.includes('id="mileage-unit"'));
  assert.ok(html.includes("puoModificare(company){return company.role==='owner'||company.role==='policy_admin'}"));
  const match = html.match(/const words=(\{[\s\S]*?\});const lang=/);
  const words = JSON.parse(match[1]);
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) assert.equal(words[lang].length, 39);
});

test('workspace page policy form: la sostituzione è sempre totale, mai un merge silenzioso (verificato leggendo il codice del submit)', async () => {
  const response = workspacePage();
  const html = await response.text();
  // Ogni submit ricostruisce rules da zero (currency/receiptThreshold/expenseLimits/dailyLimits),
  // mai un oggetto parziale spedito al server che si affiderebbe a un merge lato server (che non esiste).
  assert.ok(html.includes("const rules={currency,receiptThreshold,expenseLimits,dailyLimits}"));
  assert.ok(html.includes("'If-Match':'\"'+policyVersion+'\"'"));
});

test('validateCompanyRules: qualunque valuta ISO 4217 reale è ammessa (non solo EUR) — un\'azienda a Londra/Oslo/Mumbai deve poter pubblicare nella propria valuta', () => {
  for (const currency of ['USD', 'GBP', 'NOK', 'INR', 'JPY', 'CHF']) assert.equal(validateCompanyRules({ ...rules, currency }), true);
  assert.equal(validateCompanyRules({ ...rules, currency: 'ZZZ' }), false);
  assert.equal(validateCompanyRules({ ...rules, currency: 'eur' }), false);
});

test('workspace page: il form pubblica sempre la valuta scelta, mai EUR fisso — un\'azienda a Londra/Oslo/Mumbai deve poter usare la propria', async () => {
  const response = workspacePage();
  const html = await response.text();
  assert.ok(html.includes('id="currency-input"'));
  assert.ok(html.includes('policyCurrency=data.rules.currency'));
  assert.ok(html.includes("currency:policyCurrency"));
  assert.ok(html.includes('/^[A-Z]{3}$/.test(currency)'));
});

test('pendingCount: conta i resoconti senza decisione SOLO per owner/reviewer — gap reale, prima nessuno sapeva di dover approvare senza aprire ogni azienda', async () => {
  const { sql, env } = fixture();
  try {
    sql.prepare(`INSERT INTO reports(id,company_id,submitter,trip_id,revision,policy_version,fingerprint,archive,created_at)
      VALUES ('r1','a','employee','trip1',1,0,'f1','{}','2026-01-01'),('r2','a','employee','trip2',1,0,'f2','{}','2026-01-01')`).run();
    // r2 ha già una decisione: non deve contare come pendente.
    sql.prepare(`INSERT INTO report_decisions(report_id,reviewer,decision,note,created_at) VALUES ('r2','admin','approved','','2026-01-02')`).run();
    const forOwner = await (await companyRequest(new Request('https://momentum.test/v1/me/companies'), env, 'admin')).json();
    assert.equal(forOwner.companies.find(c => c.id === 'a').pendingCount, 1);
    const forReviewer = await (await companyRequest(new Request('https://momentum.test/v1/me/companies'), env, 'reviewer')).json();
    assert.equal(forReviewer.companies.find(c => c.id === 'a').pendingCount, 1);
    const forEmployee = await (await companyRequest(new Request('https://momentum.test/v1/me/companies'), env, 'employee')).json();
    assert.equal(forEmployee.companies.find(c => c.id === 'a').pendingCount, null);
    const forAuditor = await (await companyRequest(new Request('https://momentum.test/v1/me/companies'), env, 'auditor')).json();
    assert.equal(forAuditor.companies.find(c => c.id === 'a').pendingCount, null);
  } finally { sql.close(); }
});

test('workspace page: la lista aziende mostra il contatore da approvare accanto al nome', async () => {
  const response = workspacePage();
  const html = await response.text();
  assert.ok(html.includes('company.pendingCount>0'));
  assert.ok(html.includes('function pendingLabel'));
});
