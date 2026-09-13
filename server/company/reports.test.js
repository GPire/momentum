import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { reportRequest } from './reports.js';
const rules={currency:'EUR',receiptThreshold:25,expenseLimits:{},dailyLimits:{vitto:50}};
function fixture(){
 const sql=new DatabaseSync(':memory:');for(const file of ['schema.sql','reports.sql'])sql.exec(readFileSync(new URL(file,import.meta.url),'utf8'));
 sql.exec("INSERT INTO companies VALUES('a','A'),('b','B'); INSERT INTO memberships VALUES('a','employee','employee',1),('a','manager','reviewer',1),('b','other','owner',1)");
 sql.prepare('INSERT INTO policies VALUES(?,?,?,?,?)').run('a',1,JSON.stringify(rules),'admin','2026-09-13');
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
