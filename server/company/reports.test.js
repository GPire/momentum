import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { reportRequest } from './reports.js';
import { storageAuditRequest } from './storage-audit.js';
import { cleanupAttachmentRequest,lockAttachment,attachmentKey } from './attachment-lifecycle.js';
import { attachmentRecoveryRequest } from './attachment-recovery.js';
const rules={currency:'EUR',receiptThreshold:25,expenseLimits:{},dailyLimits:{vitto:50}};

test('confirmed deletion recovers after database failure without deleting twice; journal is immutable',async()=>{
 const {sql,env}=fixture();try{
 sql.exec("INSERT INTO memberships VALUES('a','owner','owner',1)");
 const key=await attachmentKey('a','employee','d'.repeat(64));const release=await lockAttachment(env.COMPANY_DB,'a',key);await release();
 sql.prepare('INSERT INTO company_attachment_reservations(company_id,object_key,size,created_at) VALUES(?,?,?,?)').run('a',key,3,'2000-01-01');
 let deletes=0;env.COMPANY_FILES={async delete(){deletes++}};
 const original=env.COMPANY_DB;let fail=true;
 env.COMPANY_DB={prepare(query){if(fail&&query.startsWith("UPDATE company_attachment_lifecycle SET state='active',cleanup_id=NULL")&&query.includes('EXISTS')){fail=false;throw Error('database unavailable')}return original.prepare(query)}};
 const req=(action,method='POST')=>new Request(env.APP_ORIGIN+'/v1/companies/a/storage/'+action,{method,headers:{Origin:env.APP_ORIGIN,'Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify({key})}:{})});
 assert.equal((await cleanupAttachmentRequest(req('cleanup'),env,'owner')).status,503);assert.equal(deletes,1);
 assert.equal(sql.prepare('SELECT SUM(size) n FROM company_attachment_reservations').get().n,3);
 assert.equal((await attachmentRecoveryRequest(req('reconcile'),env,'employee')).status,403);
 const recovered=await attachmentRecoveryRequest(req('reconcile'),env,'owner');assert.equal(recovered.status,200);assert.equal((await recovered.json()).state,'reconciled');assert.equal(deletes,1);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM company_attachment_reservations').get().n,0);
 assert.equal((await attachmentRecoveryRequest(req('reconcile'),env,'owner')).status,409);
 const journal=await(await attachmentRecoveryRequest(req('journal','GET'),env,'owner')).json();assert.deepEqual(journal.events.map(e=>e.event),['requested','confirmed','uncertain']);
 assert.ok(journal.events.every(e=>e.actor==='owner'));assert.equal(new Set(journal.events.map(e=>e.attempt)).size,1);
 assert.throws(()=>sql.exec('DELETE FROM company_attachment_journal'),/Immutable/);assert.throws(()=>sql.exec("UPDATE company_attachment_journal SET actor='other'"),/Immutable/);
 }finally{sql.close()}
});

test('missing storage object does not prove completion of an uncertain deletion',async()=>{
 const {sql,env}=fixture();try{
 sql.exec("INSERT INTO memberships VALUES('a','owner','owner',1)");
 const key=await attachmentKey('a','employee','e'.repeat(64));const release=await lockAttachment(env.COMPANY_DB,'a',key);await release();
 sql.prepare('INSERT INTO company_attachment_reservations(company_id,object_key,size,created_at) VALUES(?,?,?,?)').run('a',key,3,'2000-01-01');
 env.COMPANY_FILES={async delete(){throw Error('timeout')},async head(){return null}};
 const req=action=>new Request(env.APP_ORIGIN+'/v1/companies/a/storage/'+action,{method:'POST',headers:{Origin:env.APP_ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({key})});
 assert.equal((await cleanupAttachmentRequest(req('cleanup'),env,'owner')).status,503);
 const response=await attachmentRecoveryRequest(req('reconcile'),env,'owner');assert.equal(response.status,409);assert.equal((await response.json()).observation,'observed_missing');
 assert.equal(sql.prepare('SELECT SUM(size) n FROM company_attachment_reservations').get().n,3);
 await assert.rejects(lockAttachment(env.COMPANY_DB,'a',key),/busy/);
 assert.deepEqual(sql.prepare('SELECT event FROM company_attachment_journal ORDER BY id').all().map(x=>x.event),['requested','uncertain','observed_missing']);
 }finally{sql.close()}
});

test('cleanup excludes active operations and historical reports; successful deletion frees quota',async()=>{
 const {sql,env}=fixture();try{
 sql.exec("INSERT INTO memberships VALUES('a','owner','owner',1)");
 const hash='a'.repeat(64),key=await attachmentKey('a','employee',hash);let deletes=0;
 env.COMPANY_FILES={async delete(){deletes++}};
 sql.prepare('INSERT INTO company_attachment_reservations(company_id,object_key,size,created_at) VALUES(?,?,?,?)').run('a',key,3,'2000-01-01');
 const cleanup=(subject='owner',origin=env.APP_ORIGIN)=>cleanupAttachmentRequest(new Request(env.APP_ORIGIN+'/v1/companies/a/storage/cleanup',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({key})}),env,subject);
 assert.equal((await cleanup()).status,409); // Pre-protocol objects are not collected.
 const release=await lockAttachment(env.COMPANY_DB,'a',key);
 assert.equal((await cleanup()).status,409);assert.equal(deletes,0);await release();
 assert.equal((await cleanup('employee')).status,403);assert.equal((await cleanup('owner','https://evil.test')).status,403);
 const archive={format:'momentum-company-upload',archive:{transactions:[{receiptRef:{hash}}]}};
 sql.prepare('INSERT INTO reports VALUES(?,?,?,?,?,?,?,?,?)').run('old','a','employee','t',1,1,'f'.repeat(64),JSON.stringify(archive),'2000-01-01');
 assert.equal((await cleanup()).status,409);assert.equal(deletes,0);
 const second=await attachmentKey('a','employee','b'.repeat(64));const releaseSecond=await lockAttachment(env.COMPANY_DB,'a',second);await releaseSecond();
 sql.prepare('INSERT INTO company_attachment_reservations(company_id,object_key,size,created_at) VALUES(?,?,?,?)').run('a',second,3,'2000-01-01');
 const response=await cleanupAttachmentRequest(new Request(env.APP_ORIGIN+'/v1/companies/a/storage/cleanup',{method:'POST',headers:{Origin:env.APP_ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({key:second})}),env,'owner');
 assert.equal(response.status,200);assert.equal(deletes,1);assert.equal(sql.prepare('SELECT SUM(size) n FROM company_attachment_reservations').get().n,3);
 const reuse=await lockAttachment(env.COMPANY_DB,'a',second);await reuse();
 }finally{sql.close()}
});

test('deletion blocks simultaneous upload locks and ambiguous deletion never frees quota',async()=>{
 const {sql,env}=fixture();try{
 sql.exec("INSERT INTO memberships VALUES('a','owner','owner',1)");
 const key=await attachmentKey('a','employee','c'.repeat(64)),release=await lockAttachment(env.COMPANY_DB,'a',key);await release();
 sql.prepare('INSERT INTO company_attachment_reservations(company_id,object_key,size,created_at) VALUES(?,?,?,?)').run('a',key,3,'2000-01-01');
 let deletes=0;env.COMPANY_FILES={async delete(){deletes++;await assert.rejects(lockAttachment(env.COMPANY_DB,'a',key),/busy/);throw Error('ambiguous')}};
 const req=()=>new Request(env.APP_ORIGIN+'/v1/companies/a/storage/cleanup',{method:'POST',headers:{Origin:env.APP_ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({key})});
 assert.equal((await cleanupAttachmentRequest(req(),env,'owner')).status,503);
 assert.equal((await cleanupAttachmentRequest(req(),env,'owner')).status,409);assert.equal(deletes,1);
 assert.equal(sql.prepare('SELECT SUM(size) n FROM company_attachment_reservations').get().n,3);
 await assert.rejects(lockAttachment(env.COMPANY_DB,'a',key),/busy/);
 }finally{sql.close()}
});

test('report submission holds attachment protection through hydration and persistence',async()=>{
 const {sql,env,archive,call}=fixture();try{
 sql.exec("INSERT INTO memberships VALUES('a','owner','owner',1)");
 archive.transactions[0].receiptImage='data:image/png;base64,YQ==';
 const {envelope,blobs}=await prepareCompanyAttachments(archive),[hash,bytes]=[...blobs][0];
 const key=await attachmentKey('a','employee',hash);const release=await lockAttachment(env.COMPANY_DB,'a',key);await release();
 sql.prepare('INSERT INTO company_attachment_reservations(company_id,object_key,size) VALUES(?,?,?)').run('a',key,bytes.length);
 const cleanup=()=>cleanupAttachmentRequest(new Request(env.APP_ORIGIN+'/v1/companies/a/storage/cleanup',{method:'POST',headers:{Origin:env.APP_ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({key})}),env,'owner');
 env.COMPANY_FILES={async delete(){assert.fail('Receipt must survive')},async get(){assert.equal((await cleanup()).status,409);return{size:bytes.length,async arrayBuffer(){return bytes.slice().buffer}}}};
 assert.equal((await cleanup()).status,409); // Recent uploads are retained even without a report.
 sql.exec("UPDATE company_attachment_reservations SET created_at='2000-01-01'");
 assert.equal((await call('',envelope)).status,201);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM company_attachment_operations').get().n,0);
 assert.equal((await cleanup()).status,409);assert.equal(sql.prepare('SELECT COUNT(*) n FROM reports').get().n,1);
 }finally{sql.close()}
});

test('storage inventory protects historic references and distinguishes missing or unavailable objects',async()=>{
 const {sql,env}=fixture();
 try{
 sql.exec("INSERT INTO memberships VALUES('a','owner','owner',1)");
 const {digestBytes}=await import('../../src/trips/company-attachments.js');
 const subjectHash=await digestBytes(new TextEncoder().encode('employee'));
 const hashes=['1','2','3','4'].map(x=>x.repeat(64));
 for(const hash of hashes)sql.prepare('INSERT INTO company_attachment_reservations(company_id,object_key,size) VALUES(?,?,?)').run('a',`a/${subjectHash}/${hash}`,3);
 // Even superseded revisions retain their attachments.
 const archive={format:'momentum-company-upload',archive:{transactions:[{receiptRef:{hash:hashes[0]}}]}};
 for(const [id,revision,body]of [['old',1,archive],['new',2,{transactions:[]}]])sql.prepare('INSERT INTO reports VALUES(?,?,?,?,?,?,?,?,?)').run(id,'a','employee','t',revision,1,'f'.repeat(64),JSON.stringify(body),'2026-09-14');
 env.COMPANY_FILES={async head(key){if(key.endsWith(hashes[2]))throw new Error('offline');return key.endsWith(hashes[1])?null:{size:key.endsWith(hashes[3])?4:3}}};
 const get=(subject='owner',suffix='')=>storageAuditRequest(new Request(env.APP_ORIGIN+'/v1/companies/a/storage'+suffix),env,subject);
 assert.equal((await get('employee')).status,403);assert.equal((await get('manager')).status,403);assert.equal((await get('other')).status,403);
 const response=await get();assert.equal(response.status,200);assert.match(response.headers.get('Cache-Control'),/no-store/);
 const data=await response.json();assert.equal(data.reservedBytes,12);assert.equal(data.readOnly,true);
 assert.deepEqual(data.entries.map(x=>x.reference),['report','unlinked','unlinked','unlinked']);
 assert.deepEqual(data.entries.map(x=>x.object),['present','missing','unavailable','size_mismatch']);
 assert.equal((await get('owner','?after=b%2F'+'a'.repeat(64)+'%2F'+'b'.repeat(64))).status,400);
 env.COMPANY_FILES.head=async()=>{sql.exec("UPDATE memberships SET active=0 WHERE subject='owner'");return null};
 assert.equal((await get()).status,403);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM company_attachment_reservations').get().n,4);
 }finally{sql.close()}
});

test('storage inventory paginates without dropping reservations and refuses writes',async()=>{
 const {sql,env}=fixture();try{
 sql.exec("INSERT INTO memberships VALUES('a','owner','owner',1)");env.COMPANY_FILES={async head(){return null}};
 for(let i=0;i<28;i++)sql.prepare('INSERT INTO company_attachment_reservations(company_id,object_key,size) VALUES(?,?,?)').run('a',`a/${'a'.repeat(64)}/${i.toString(16).padStart(64,'0')}`,1);
 const url=env.APP_ORIGIN+'/v1/companies/a/storage';
 const first=await(await storageAuditRequest(new Request(url),env,'owner')).json();assert.equal(first.entries.length,25);assert.ok(first.nextCursor);
 const second=await(await storageAuditRequest(new Request(url+'?after='+encodeURIComponent(first.nextCursor)),env,'owner')).json();assert.equal(second.entries.length,3);assert.equal(second.nextCursor,null);
 assert.equal(new Set([...first.entries,...second.entries].map(x=>x.key)).size,28);
 assert.equal((await storageAuditRequest(new Request(url,{method:'DELETE'}),env,'owner')).status,405);
 }finally{sql.close()}
});
function fixture(){
 const sql=new DatabaseSync(':memory:');for(const file of ['schema.sql','reports.sql','attachment-quota.sql','attachment-lifecycle.sql','attachment-journal.sql'])sql.exec(readFileSync(new URL(file,import.meta.url),'utf8'));
 sql.exec("INSERT INTO companies VALUES('a','A'),('b','B'); INSERT INTO memberships VALUES('a','employee','employee',1),('a','manager','reviewer',1),('b','other','owner',1)");
 sql.prepare('INSERT INTO policies VALUES(?,?,?,?,?)').run('a',1,JSON.stringify(rules),'admin','2026-09-13');
 sql.exec("INSERT INTO company_storage_limits VALUES('a',33554432),('b',33554432)");
 const env={APP_ORIGIN:'https://momentum.test',COMPANY_DB:{prepare(query){return{bind(...args){return{async first(){return sql.prepare(query).get(...args)||null},async all(){return {results:sql.prepare(query).all(...args)}},async run(){return{meta:{changes:Number(sql.prepare(query).run(...args).changes)}}}}}}}}};
 const archive={format:'momentum-trip-archive',version:1,trip:{id:'t',companyPolicy:{companyId:'a',version:1},receiptPolicy:rules},transactions:[{id:'uuid',businessTripId:'t',type:'uscita',tripCategory:'vitto',amount:10,date:'2026-09-13'}]};
 const call=(path='',body=archive,subject='employee',version='0',method='POST')=>reportRequest(new Request('https://momentum.test/v1/companies/a/reports'+path,{method,headers:{Origin:env.APP_ORIGIN,'Content-Type':'application/json','If-Match':`"${version}"`},...(method==='POST'?{body:JSON.stringify(body)}:{})}),env,subject);
 return{sql,archive,call,env};
}
test('submission and independent approval persist the exact fingerprint; no self approval',async()=>{
 const{sql,call}=fixture();try{
 const response=await call();assert.equal(response.status,201);const report=await response.json();
 assert.equal((await call('/'+report.reportId+'/decision',{decision:'approved',note:''},'employee',report.fingerprint)).status,403);
 assert.equal((await call('/'+report.reportId+'/decision',{decision:'approved',note:''},'manager',report.fingerprint)).status,201);
 assert.equal((await call('/'+report.reportId,null,'other','0','GET')).status,403);
 const stored=await(await call('/'+report.reportId,null,'employee','0','GET')).json();assert.equal(stored.decision,'approved');assert.equal(stored.superseded,false);
 assert.throws(()=>sql.exec('UPDATE reports SET revision=9'),/Immutable/);
 }finally{sql.close()}
});
test('new data or attachment invalidates earlier revision approval',async()=>{
 const{sql,archive,call}=fixture();try{
 const first=await(await call()).json();
 const revised=structuredClone(archive);revised.transactions[0].receiptImage='data:image/png;base64,YQ==';
 const second=await(await call('',revised,'employee','1')).json();assert.notEqual(first.fingerprint,second.fingerprint);
 assert.equal((await call('/'+first.reportId+'/decision',{decision:'approved',note:''},'manager',first.fingerprint)).status,409);
 assert.equal((await call('/'+second.reportId+'/decision',{decision:'approved',note:''},'manager',first.fingerprint)).status,409);
 assert.equal((await call('/'+second.reportId+'/decision',{decision:'approved',note:''},'manager',second.fingerprint)).status,201);
 }finally{sql.close()}
});
test('edited rules and stale policy cannot be submitted; decisions recheck current policy',async()=>{
 const{sql,archive,call}=fixture();try{
 const forged=structuredClone(archive);forged.trip.receiptPolicy.receiptThreshold=100;
 assert.equal((await call('',forged)).status,400);
 const report=await(await call()).json();sql.prepare('INSERT INTO policies VALUES(?,?,?,?,?)').run('a',2,JSON.stringify(rules),'admin','2026-09-14');
 assert.equal((await call('',archive,'employee','1')).status,409);
 assert.equal((await call('/'+report.reportId+'/decision',{decision:'approved',note:''},'manager',report.fingerprint)).status,409);
 assert.equal((await call('/'+report.reportId+'/decision',{decision:'changes_requested',note:'Update policy'},'manager',report.fingerprint)).status,201);
 }finally{sql.close()}
});
test('revocation and duplicate submission do not create extra records',async()=>{
 const{sql,call}=fixture();try{
 const report=await(await call()).json();assert.equal((await call()).status,200);
 sql.exec("UPDATE memberships SET active=0 WHERE subject='manager'");
 assert.equal((await call('/'+report.reportId+'/decision',{decision:'approved',note:''},'manager',report.fingerprint)).status,403);
 assert.equal(sql.prepare('SELECT count(*) n FROM reports').get().n,1);
 }finally{sql.close()}
});
test('reviewer cannot approve own report and changes requests require a reason',async()=>{
 const{sql,archive,call}=fixture();try{
 const response=await call('',archive,'manager');assert.equal(response.status,201);const report=await response.json();
 assert.equal((await call('/'+report.reportId+'/decision',{decision:'approved',note:''},'manager',report.fingerprint)).status,409);
 assert.equal((await call('/'+report.reportId+'/decision',{decision:'changes_requested',note:' '},'manager',report.fingerprint)).status,400);
 }finally{sql.close()}
});
test('inbox shows latest revisions only and employees never see colleagues reports',async()=>{
 const{sql,archive,call}=fixture();try{
 const first=await(await call()).json();
 const revised=structuredClone(archive);revised.transactions[0].amount=20;
 const latest=await(await call('',revised,'employee','1')).json();
 sql.exec("INSERT INTO memberships VALUES('a','colleague','employee',1)");
 await call('',archive,'colleague');
 const mine=await(await call('',null,'employee','0','GET')).json();assert.equal(mine.reports.length,1);assert.equal(mine.reports[0].id,latest.reportId);
 const team=await(await call('',null,'manager','0','GET')).json();assert.equal(team.reports.length,2);assert.ok(!team.reports.some(r=>r.id===first.reportId));
 await call('/'+latest.reportId+'/decision',{decision:'approved',note:''},'manager',latest.fingerprint);
 assert.equal((await(await call('',null,'manager','0','GET')).json()).reports.length,1);
 assert.equal((await(await call('?filter=all',null,'manager','0','GET')).json()).reports.length,2);
 }finally{sql.close()}
});

test('inbox pagination preserves all latest reports and rejects foreign cursors',async()=>{
 const {sql,archive,call}=fixture();try{
 for(let i=0;i<32;i++){const a=structuredClone(archive);a.trip.id='t'+i;a.transactions[0].businessTripId=a.trip.id;assert.equal((await call('',a)).status,201)}
 const first=await(await call('?filter=all',null,'manager','0','GET')).json();assert.equal(first.reports.length,30);
 const second=await(await call('?filter=all&after='+first.nextCursor,null,'manager','0','GET')).json();assert.equal(second.reports.length,2);assert.equal(second.nextCursor,null);
 assert.equal(new Set([...first.reports,...second.reports].map(r=>r.id)).size,32);
 assert.equal((await call('?after=not-found',null,'manager','0','GET')).status,400);
 }finally{sql.close()}
});

import { prepareCompanyAttachments, restoreCompanyAttachments } from '../../src/trips/company-attachments.js';
import { attachmentRequest } from './attachments.js';
import { submitCompanyReport } from '../../src/trips/company-submit.js';
test('large report uploads once, preserves approval fingerprint and rejects missing or foreign files',async()=>{
 const {sql,archive,call,env}=fixture();const objects=new Map();let uploads=0;
 env.COMPANY_FILES={async head(k){return objects.has(k)?{size:objects.get(k).length}:null},async put(k,b){uploads++;objects.set(k,b.slice())},async get(k){const b=objects.get(k);return b?{size:b.length,async arrayBuffer(){return b.slice().buffer}}:null}};
 const fetcher=async(path,options={})=>{const request=new Request(env.APP_ORIGIN+path,{...options,headers:{...options.headers,Origin:env.APP_ORIGIN}});return path.includes('/attachments/')?attachmentRequest(request,env,'employee'):reportRequest(request,env,'employee')};
 try{
 archive.transactions[0].receiptImage='data:image/png;base64,'+Buffer.alloc(300000,5).toString('base64');
 await assert.rejects(submitCompanyReport(archive,0,(path,opts)=>path.endsWith('/reports')?Response.json({error:'service_unavailable'},{status:503}):fetcher(path,opts)),/network/);
 assert.equal(uploads,1);assert.equal(sql.prepare('SELECT count(*) n FROM reports').get().n,0);
 const sent=await submitCompanyReport(archive,0,fetcher);assert.equal(uploads,1);
 const stored=sql.prepare('SELECT archive FROM reports').get().archive;assert.ok(stored.length<10000);assert.equal(JSON.parse(stored).format,'momentum-company-upload');
 const detail=await(await call('/'+sent.reportId,null,'manager','0','GET')).json();assert.equal(detail.archive.transactions[0].receiptImage,archive.transactions[0].receiptImage);assert.equal(detail.fingerprint,sent.fingerprint);
 await submitCompanyReport(archive,0,fetcher);assert.equal(uploads,1);
 const {envelope}=await prepareCompanyAttachments(archive);
 sql.exec("INSERT INTO memberships VALUES('a','colleague','employee',1)");
 assert.equal((await call('',envelope,'colleague')).status,409);
 const backup=new Map(objects);objects.clear();
 assert.equal((await call('/'+sent.reportId+'/decision',{decision:'approved',note:''},'manager',sent.fingerprint)).status,409);
 for(const [key,value]of backup)objects.set(key,value);
 assert.equal((await call('/'+sent.reportId+'/decision',{decision:'approved',note:''},'manager',sent.fingerprint)).status,201);
 }finally{sql.close()}
});
test('legacy attachment spelling round-trips and altered storage bytes fail closed',async()=>{
 const {sql,archive}=fixture();try{
 archive.transactions[0].receiptImage='data:image/png;base64,YQ==\n';
 const {envelope,blobs}=await prepareCompanyAttachments(archive);
 const restored=await restoreCompanyAttachments(envelope,async ref=>blobs.get(ref.hash));assert.deepEqual(restored,archive);
 await assert.rejects(restoreCompanyAttachments(envelope,async ref=>new Uint8Array(ref.size)),/attachment_missing/);
 }finally{sql.close()}
});

test('company quota serializes competing uploads and keeps failed reservations retryable',async()=>{
 const {sql,env}=fixture();const objects=new Map();let fail=false;
 env.COMPANY_FILES={async head(k){return objects.has(k)?{size:objects.get(k).length}:null},async put(k,b){if(fail)throw new Error('storage interrupted');objects.set(k,b)}};
 const {digestBytes}=await import('../../src/trips/company-attachments.js');
 const put=async(bytes)=>attachmentRequest(new Request(env.APP_ORIGIN+'/v1/companies/a/attachments/'+await digestBytes(bytes),{method:'PUT',headers:{Origin:env.APP_ORIGIN,'Content-Type':'application/octet-stream'},body:bytes}),env,'employee');
 try{
 sql.exec("UPDATE company_storage_limits SET limit_bytes=3 WHERE company_id='a'");
 const a=new Uint8Array([1,2,3]),b=new Uint8Array([4,5,6]);
 const responses=await Promise.all([put(a),put(b)]);assert.deepEqual(responses.map(r=>r.status).sort(),[201,507]);assert.equal(objects.size,1);
 const accepted=responses[0].status===201?a:b;
 assert.equal((await put(accepted)).status,201);assert.equal(sql.prepare('SELECT SUM(size) n FROM company_attachment_reservations').get().n,3);
 sql.exec("UPDATE company_storage_limits SET limit_bytes=6 WHERE company_id='a'");
 fail=true;await assert.rejects(put(new Uint8Array([7,8,9])),/interrupted/);
 assert.equal(sql.prepare('SELECT SUM(size) n FROM company_attachment_reservations').get().n,6);
 assert.equal((await put(new Uint8Array([10]))).status,507);
 fail=false;assert.equal((await put(new Uint8Array([7,8,9]))).status,201);
 sql.exec("DELETE FROM company_storage_limits WHERE company_id='a'");assert.equal((await put(a)).status,503);
 }finally{sql.close()}
});

test('attachment uploads reject forged content, hostile origin and revoked access',async()=>{
 const {sql,env}=fixture();const objects=new Map();env.COMPANY_FILES={async head(k){return objects.has(k)?{size:objects.get(k).length}:null},async put(k,b){objects.set(k,b)}};
 try{
 const hash='a'.repeat(64),url=env.APP_ORIGIN+'/v1/companies/a/attachments/'+hash;
 const request=(origin=env.APP_ORIGIN)=>new Request(url,{method:'PUT',headers:{Origin:origin,'Content-Type':'application/octet-stream'},body:new Uint8Array([1,2,3])});
 assert.equal((await attachmentRequest(request(),env,'employee')).status,400);
 assert.equal((await attachmentRequest(request('https://other.test'),env,'employee')).status,403);
 sql.exec("UPDATE memberships SET active=0 WHERE subject='employee'");
 assert.equal((await attachmentRequest(request(),env,'employee')).status,403);assert.equal(objects.size,0);
 }finally{sql.close()}
});
