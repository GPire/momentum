import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { d1Files,companyStorageEnvironment } from './d1-files.js';
import { digestBytes } from '../../src/trips/company-attachments.js';
function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('./d1-files.sql',import.meta.url),'utf8'));let failAt=-1;
 const db={prepare(query){return {bind(...values){const args=values.map(x=>x instanceof ArrayBuffer?new Uint8Array(x):x);return {
  async first(){return sql.prepare(query).get(...args)||null},async all(){return {results:sql.prepare(query).all(...args)}},run(){return sql.prepare(query).run(...args)}
 }}}},async batch(statements){sql.exec('BEGIN');try{for(const [i,s]of statements.entries()){if(i===failAt)throw Error('interrupted');s.run()}sql.exec('COMMIT')}catch(error){sql.exec('ROLLBACK');throw error}}};
 return {sql,db,files:d1Files(db),fail(n){failAt=n}};
}
const key=async bytes=>'pilot/'+'a'.repeat(64)+'/'+await digestBytes(bytes);
test('D1 stores 8 MiB in bounded chunks, deduplicates retries and deletes atomically',async()=>{
 const {sql,files}=fixture();try{
 const bytes=new Uint8Array(8*1024*1024);bytes[0]=43;bytes[bytes.length-1]=99;const path=await key(bytes);
 await files.put(path,bytes);await files.put(path,bytes);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM company_file_objects').get().n,1);
 assert.equal(sql.prepare('SELECT COUNT(*) n,MAX(length(bytes)) largest FROM company_file_chunks').get().largest,1000000);
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
