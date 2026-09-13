// Isolated loopback-only UI fixture. Synthetic identity; NEVER a production server.
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { joinPage } from '../server/company/join-page.js';
import { invitationRequest } from '../server/company/invitations.js';
const sql = new DatabaseSync(':memory:');
for (const file of ['schema.sql', 'invitations.sql']) sql.exec(readFileSync(new URL(`../server/company/${file}`, import.meta.url), 'utf8'));
sql.exec("INSERT INTO companies VALUES('demo','Azienda di prova'); INSERT INTO memberships VALUES('demo','owner','owner',1)");
const db = { prepare(query) { return { bind(...args) { return {
  async first() { return sql.prepare(query).get(...args) || null; },
  async run() { return { meta: { changes: Number(sql.prepare(query).run(...args).changes) } }; },
}; } }; } };
const env = { COMPANY_DB: db, APP_ORIGIN: 'http://127.0.0.1:4193' };
const created = await invitationRequest(new Request(`${env.APP_ORIGIN}/v1/companies/demo/invitations`, { method: 'POST', headers: { Origin: env.APP_ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'demo@example.com', role: 'employee' }) }), env, { subject: 'owner', email: 'owner@example.com' });
const invitation = await created.json();
createServer(async (req, res) => {
  try {
    let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 8192) { res.writeHead(413).end(); return; } }
    const request = new Request(env.APP_ORIGIN + req.url, { method: req.method, headers: req.headers, ...(['GET','HEAD'].includes(req.method) ? {} : { body }) });
    const response = new URL(request.url).pathname === '/company/join' ? joinPage() : await invitationRequest(request, env, { subject: 'demo-user', email: 'demo@example.com' });
    res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(await response.text());
  } catch { res.writeHead(500).end('Fixture error'); }
}).listen(4193, '127.0.0.1', () => console.log(`Synthetic invitation fixture: ${invitation.url.replace('/company/join#', '/company/join?lang=it#')}`));
