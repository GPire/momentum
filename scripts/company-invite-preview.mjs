// Isolated loopback-only UI fixture. Synthetic identity; NEVER a production server.
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { joinPage } from '../server/company/join-page.js';
import { invitationRequest } from '../server/company/invitations.js';
import { companyRequest } from '../server/company/worker.js';
import { workspacePage } from '../server/company/workspace-page.js';
import { inboxPage } from '../server/company/inbox-page.js';
import { reportRequest } from '../server/company/reports.js';
import { storagePage } from '../server/company/storage-page.js';
import { storageAuditRequest } from '../server/company/storage-audit.js';
const storageMode=process.argv.includes('--storage');
const inboxMode=process.argv.includes('--inbox');
const ownerMode=storageMode||inboxMode||process.argv.includes('--owner');
const port=storageMode?4201:inboxMode?4197:ownerMode?4194:4193;
const sql = new DatabaseSync(':memory:');
for (const file of ['schema.sql', 'invitations.sql','reports.sql','attachment-quota.sql']) sql.exec(readFileSync(new URL(`../server/company/${file}`, import.meta.url), 'utf8'));
sql.exec("INSERT INTO companies VALUES('demo','Azienda di prova'); INSERT INTO memberships VALUES('demo','owner','owner',1)");
const db = { prepare(query) { return { bind(...args) { return {
  async first() { return sql.prepare(query).get(...args) || null; },
    async all() { return { results: sql.prepare(query).all(...args) }; },
  async run() { return { meta: { changes: Number(sql.prepare(query).run(...args).changes) } }; },
}; } }; } };
const env = { COMPANY_DB: db, APP_ORIGIN: `http://127.0.0.1:${port}` };
sql.prepare('INSERT INTO policies VALUES(?,?,?,?,?)').run('demo',1,JSON.stringify({currency:'EUR',receiptThreshold:25,expenseLimits:{vitto:30},dailyLimits:{vitto:60}}),'owner','2026-09-13');
if(storageMode){sql.exec("INSERT INTO company_storage_limits VALUES('demo',33554432)");env.COMPANY_FILES={async head(){return null}};for(let i=0;i<28;i++)sql.prepare('INSERT INTO company_attachment_reservations(company_id,object_key,size) VALUES(?,?,?)').run('demo','demo/'+'a'.repeat(64)+'/'+i.toString(16).padStart(64,'0'),1048576)}
if(inboxMode){
sql.exec("INSERT INTO memberships VALUES('demo','staff','employee',1)");
const archive={format:'momentum-trip-archive',version:1,trip:{id:'test-trip',name:'Trasferta Milano',companyPolicy:{companyId:'demo',version:1},receiptPolicy:JSON.parse(sql.prepare('SELECT rules FROM policies').get().rules),offeredItems:[{description:'Hotel',amount:100}]},transactions:[{id:'uuid-fixture',businessTripId:'test-trip',type:'uscita',tripCategory:'vitto',description:'Pranzo di lavoro',amount:15,date:'2026-09-13'}]};
const seeded=await reportRequest(new Request(env.APP_ORIGIN+'/v1/companies/demo/reports',{method:'POST',headers:{Origin:env.APP_ORIGIN,'Content-Type':'application/json','If-Match':'"0"'},body:JSON.stringify(archive)}),env,'staff');
if(seeded.status!==201)throw new Error(await seeded.text());
}
const created = await invitationRequest(new Request(`${env.APP_ORIGIN}/v1/companies/demo/invitations`, { method: 'POST', headers: { Origin: env.APP_ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'demo@example.com', role: 'employee' }) }), env, { subject: 'owner', email: 'owner@example.com' });
const invitation = await created.json();
createServer(async (req, res) => {
  try {
    let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 8192) { res.writeHead(413).end(); return; } }
    const request = new Request(env.APP_ORIGIN + req.url, { method: req.method, headers: req.headers, ...(['GET','HEAD'].includes(req.method) ? {} : { body }) });
    const path=new URL(request.url).pathname;
    const identity=ownerMode?{subject:'owner',email:'owner@example.com'}:{subject:'demo-user',email:'demo@example.com'};
    const response = path==='/company/storage'?storagePage():path.endsWith('/storage')?await storageAuditRequest(request,env,identity.subject):path==='/company/reports'?inboxPage():path.includes('/reports')?await reportRequest(request,env,identity.subject):path === '/company/join' ? joinPage() : path==='/company/workspace'?workspacePage():path.includes('/invitations')?await invitationRequest(request, env, identity):await companyRequest(request,env,identity.subject);
    res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(await response.text());
  } catch { res.writeHead(500).end('Fixture error'); }
}).listen(port, '127.0.0.1', () => console.log(`Synthetic fixture: ${ownerMode?env.APP_ORIGIN+'/company/workspace?lang=it':invitation.url.replace('/company/join#', '/company/join?lang=it#')}`));
