// Isolated loopback-only UI fixture. Synthetic identity; NEVER a production server.
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { joinPage } from '../server/company/join-page.js';
import { invitationRequest } from '../server/company/invitations.js';
import { companyRequest } from '../server/company/worker.js';
import { workspacePage } from '../server/company/workspace-page.js';
const ownerMode=process.argv.includes('--owner');
const port=ownerMode?4194:4193;
const sql = new DatabaseSync(':memory:');
for (const file of ['schema.sql', 'invitations.sql']) sql.exec(readFileSync(new URL(`../server/company/${file}`, import.meta.url), 'utf8'));
sql.exec("INSERT INTO companies VALUES('demo','Azienda di prova'); INSERT INTO memberships VALUES('demo','owner','owner',1)");
const db = { prepare(query) { return { bind(...args) { return {
  async first() { return sql.prepare(query).get(...args) || null; },
    async all() { return { results: sql.prepare(query).all(...args) }; },
  async run() { return { meta: { changes: Number(sql.prepare(query).run(...args).changes) } }; },
}; } }; } };
const env = { COMPANY_DB: db, APP_ORIGIN: `http://127.0.0.1:${port}` };
sql.prepare('INSERT INTO policies VALUES(?,?,?,?,?)').run('demo',1,JSON.stringify({currency:'EUR',receiptThreshold:25,expenseLimits:{vitto:30},dailyLimits:{vitto:60}}),'owner','2026-09-13');
const created = await invitationRequest(new Request(`${env.APP_ORIGIN}/v1/companies/demo/invitations`, { method: 'POST', headers: { Origin: env.APP_ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'demo@example.com', role: 'employee' }) }), env, { subject: 'owner', email: 'owner@example.com' });
const invitation = await created.json();
createServer(async (req, res) => {
  try {
    let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 8192) { res.writeHead(413).end(); return; } }
    const request = new Request(env.APP_ORIGIN + req.url, { method: req.method, headers: req.headers, ...(['GET','HEAD'].includes(req.method) ? {} : { body }) });
    const path=new URL(request.url).pathname;
    const identity=ownerMode?{subject:'owner',email:'owner@example.com'}:{subject:'demo-user',email:'demo@example.com'};
    const response = path === '/company/join' ? joinPage() : path==='/company/workspace'?workspacePage():path.includes('/invitations')?await invitationRequest(request, env, identity):await companyRequest(request,env,identity.subject);
    res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(await response.text());
  } catch { res.writeHead(500).end('Fixture error'); }
}).listen(port, '127.0.0.1', () => console.log(`Synthetic fixture: ${ownerMode?env.APP_ORIGIN+'/company/workspace?lang=it':invitation.url.replace('/company/join#', '/company/join?lang=it#')}`));
