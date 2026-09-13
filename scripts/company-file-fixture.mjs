// Synthetic local identity and in-memory object storage. Not a cloud/SSO test.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { reportRequest } from '../server/company/reports.js';
import { attachmentRequest } from '../server/company/attachments.js';
export function companyFileFixture(origin){
  const sql=new DatabaseSync(':memory:'),objects=new Map();
  for(const file of ['schema.sql','reports.sql','attachment-quota.sql'])sql.exec(readFileSync(new URL('../server/company/'+file,import.meta.url),'utf8'));
  sql.exec("INSERT INTO companies VALUES('demo','Demo');INSERT INTO memberships VALUES('demo','staff','employee',1)");
  sql.prepare('INSERT INTO policies VALUES(?,?,?,?,?)').run('demo',3,JSON.stringify({currency:'EUR',receiptThreshold:0,expenseLimits:{},dailyLimits:{}}),'admin','2026-09-14');
  sql.exec("INSERT INTO company_storage_limits VALUES('demo',33554432)");
  const db={prepare(query){return {bind(...args){return {
    async first(){return sql.prepare(query).get(...args)||null},
    async all(){return {results:sql.prepare(query).all(...args)}},
    async run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}}}
  }}}}};
  const files={
    async head(k){return objects.has(k)?{size:objects.get(k).length}:null},
    async put(k,b){objects.set(k,b.slice())},
    async get(k){const b=objects.get(k);return b?{size:b.length,async arrayBuffer(){return b.slice().buffer}}:null}
  };
  const env={APP_ORIGIN:origin,COMPANY_DB:db,COMPANY_FILES:files};
  return async req=>new URL(req.url).pathname.includes('/attachments/')?attachmentRequest(req,env,'staff'):reportRequest(req,env,'staff');
}
