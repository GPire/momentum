import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { d1Files,companyStorageEnvironment } from './d1-files.js';
import { digestBytes } from '../../src/trips/company-attachments.js';
import { prepareCompanyAttachments } from '../../src/trips/company-attachments.js';
import { reportRequest } from './reports.js';
import { lockArchive } from './attachment-lifecycle.js';
function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('./d1-files.sql',import.meta.url),'utf8'));sql.exec(readFileSync(new URL('./d1-files-compression.sql',import.meta.url),'utf8'));let failAt=-1,queries=0;
 const db={prepare(query){return {bind(...values){const args=values.map(x=>x instanceof ArrayBuffer?new Uint8Array(x):x);return {
  async first(){queries++;return sql.prepare(query).get(...args)||null},async all(){queries++;return {results:sql.prepare(query).all(...args)}},run(){queries++;return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}}}
 }}}},async batch(statements){sql.exec('BEGIN');try{for(const [i,s]of statements.entries()){if(i===failAt)throw Error('interrupted');s.run()}sql.exec('COMMIT')}catch(error){sql.exec('ROLLBACK');throw error}}};
 return {sql,db,files:d1Files(db),fail(n){failAt=n},queries(){return queries}};
}
const key=async bytes=>'pilot/'+'a'.repeat(64)+'/'+await digestBytes(bytes);
test('64-attachment report uses fewer than 50 SQL statements and persists exact data',async()=>{
 const f=fixture(),{sql,db,files}=f;try{
 for(const file of ['schema.sql','reports.sql','attachment-quota.sql','attachment-lifecycle.sql','attachment-journal.sql'])sql.exec(readFileSync(new URL(file,import.meta.url),'utf8'));
 sql.exec("INSERT INTO companies VALUES('pilot','Pilot');INSERT INTO memberships VALUES('pilot','staff','employee',1)");
 const rules={currency:'EUR',receiptThreshold:0,expenseLimits:{},dailyLimits:{}};
 sql.prepare('INSERT INTO policies VALUES(?,?,?,?,?)').run('pilot',1,JSON.stringify(rules),'admin','2026-09-14');
 const archive={format:'momentum-trip-archive',version:1,trip:{id:'many',companyPolicy:{companyId:'pilot',version:1},receiptPolicy:rules},transactions:Array.from({length:64},(_,i)=>({id:'tx-'+i,businessTripId:'many',type:'uscita',amount:1,date:'2026-09-14',tripCategory:'vitto',receiptImage:'data:image/png;base64,'+btoa(String.fromCharCode(i+1))}))};
 const {envelope,blobs}=await prepareCompanyAttachments(archive);const owner=await digestBytes(new TextEncoder().encode('staff'));
 for(const [hash,bytes]of blobs)await files.put('pilot/'+owner+'/'+hash,bytes);
 const before=f.queries();const env={APP_ORIGIN:'https://momentum.test',COMPANY_DB:db,COMPANY_FILES:files};
 const response=await reportRequest(new Request(env.APP_ORIGIN+'/v1/companies/pilot/reports',{method:'POST',headers:{Origin:env.APP_ORIGIN,'Content-Type':'application/json','If-Match':'"0"'},body:JSON.stringify(envelope)}),env,'staff');
 assert.equal(response.status,201);const used=f.queries()-before;assert.ok(used<=16,'SQL statements: '+used);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM company_attachment_operations').get().n,0);
 const receipt=await response.json();const detail=await(await reportRequest(new Request(env.APP_ORIGIN+'/v1/companies/pilot/reports/'+receipt.reportId),env,'staff')).json();assert.deepEqual(detail.archive,archive);
 sql.exec("UPDATE company_attachment_lifecycle SET state='deleting' WHERE object_key=(SELECT MAX(object_key) FROM company_attachment_lifecycle)");
 await assert.rejects(lockArchive(db,'pilot','staff',envelope),/busy/);assert.equal(sql.prepare('SELECT COUNT(*) n FROM company_attachment_operations').get().n,0);
 }finally{sql.close()}
});
test('D1 stores 8 MiB in bounded chunks, deduplicates retries and deletes atomically',async()=>{
 const {sql,files}=fixture();try{
 const bytes=new Uint8Array(8*1024*1024);bytes[0]=43;bytes[bytes.length-1]=99;const path=await key(bytes);
 await files.put(path,bytes);await files.put(path,bytes);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM company_file_objects').get().n,1);
 assert.ok(sql.prepare('SELECT SUM(length(bytes)) stored FROM company_file_chunks').get().stored<bytes.length/5);
 assert.equal((await files.head(path)).size,bytes.length);assert.deepEqual(new Uint8Array(await(await files.get(path)).arrayBuffer()),bytes);
 await files.delete(path);assert.equal(await files.head(path),null);assert.equal(await files.get(path),null);assert.equal(sql.prepare('SELECT COUNT(*) n FROM company_file_chunks').get().n,0);
 }finally{sql.close()}
});
test('failed chunk batch exposes no partial object and corruption is rejected',async()=>{
 const {sql,files,fail}=fixture();try{
 const bytes=new Uint8Array(1100000),path=await key(bytes);fail(2);await assert.rejects(files.put(path,bytes),/interrupted/);assert.equal(await files.head(path),null);
 fail(-1);await files.put(path,bytes);sql.prepare('UPDATE company_file_chunks SET bytes=? WHERE part=0').run(new Uint8Array([1]));await assert.rejects(files.get(path),/Corrupt/);
 await assert.rejects(files.put(path,new Uint8Array([9])),/Invalid/);await assert.rejects(files.head('../public'),/Invalid/);
 }finally{sql.close()}
});
test('D1 storage requires explicit selection and never silently overrides R2',()=>{
 const {sql,db}=fixture();try{const env={COMPANY_DB:db};assert.equal(companyStorageEnvironment(env),env);assert.ok(companyStorageEnvironment({...env,COMPANY_FILES_DRIVER:'d1'}).COMPANY_FILES);
 assert.throws(()=>companyStorageEnvironment({...env,COMPANY_FILES_DRIVER:'d1',COMPANY_FILES:{}}),/one/);
 }finally{sql.close()}
});

test('compression migration preserves legacy bytes; mixed reads and expansion bounds are safe',async()=>{
 const {sql,files}=fixture();try{
 const old=new Uint8Array([12,34,56]),path=await key(old);
 sql.prepare('INSERT INTO company_file_objects VALUES(?,?,?)').run(path,old.length,1);
 sql.prepare('INSERT INTO company_file_chunks(object_key,part,bytes) VALUES(?,?,?)').run(path,0,old);
 const text=new TextEncoder().encode('Expense receipt: EUR 25.00, business travel. '.repeat(4000)),compressed=await key(text);
 await files.put(compressed,text);
 const all=await files.getMany([path,compressed]);
 assert.deepEqual(new Uint8Array(await all.get(path).arrayBuffer()),old);
 assert.deepEqual(new Uint8Array(await all.get(compressed).arrayBuffer()),text);
 sql.prepare('UPDATE company_file_objects SET size=1 WHERE object_key=?').run(compressed);
 await assert.rejects(files.get(compressed),/Corrupt/);
 await assert.rejects(files.getMany([compressed]),/Corrupt/);
 }finally{sql.close()}
});

test('incompressible data stays uncompressed without increasing stored payload',async()=>{
 const {sql,files}=fixture();try{
 const bytes=crypto.getRandomValues(new Uint8Array(32000)),path=await key(bytes);
 await files.put(path,bytes);
 const row=sql.prepare('SELECT encoding,length(bytes) size FROM company_file_chunks').get();
 assert.equal(row.encoding,'identity');assert.equal(row.size,bytes.length);
 assert.deepEqual(new Uint8Array(await(await files.get(path)).arrayBuffer()),bytes);
 }finally{sql.close()}
});
