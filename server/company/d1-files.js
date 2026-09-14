import { digestBytes,FILE_LIMIT } from '../../src/trips/company-attachments.js';
const CHUNK=1000000;
const validKey=key=>typeof key==='string'&&/^[-a-zA-Z0-9_]{1,80}\/[a-f0-9]{64}\/[a-f0-9]{64}$/.test(key);
// Implements the private object operations used by the corporate service.
// Batch writes commit all chunks together; partial uploads never become readable.
export function d1Files(binding){
 if(!binding?.batch)throw Error('D1 file storage not configured');
 const db=binding.withSession?binding.withSession('first-primary'):binding;
 const check=key=>{if(!validKey(key))throw Error('Invalid object key')};
 return {
  async head(key){check(key);return db.prepare('SELECT size FROM company_file_objects WHERE object_key=?').bind(key).first()},
  async put(key,value){
   check(key);const bytes=value instanceof Uint8Array?value:new Uint8Array(value);
   if(!bytes.length||bytes.length>FILE_LIMIT||await digestBytes(bytes)!==key.split('/')[2])throw Error('Invalid file content');
   const chunks=Math.ceil(bytes.length/CHUNK),statements=[db.prepare('INSERT OR IGNORE INTO company_file_objects(object_key,size,chunks) VALUES(?,?,?)').bind(key,bytes.length,chunks)];
   for(let part=0;part<chunks;part++)statements.push(db.prepare('INSERT OR IGNORE INTO company_file_chunks(object_key,part,bytes) VALUES(?,?,?)').bind(key,part,bytes.slice(part*CHUNK,(part+1)*CHUNK).buffer));
   await db.batch(statements);
  },
  async get(key){
   check(key);
   const rows=await db.prepare(`SELECT o.size,o.chunks,c.part,c.bytes FROM company_file_objects o JOIN company_file_chunks c ON c.object_key=o.object_key WHERE o.object_key=? ORDER BY c.part`).bind(key).all();
   const parts=rows.results||[];if(!parts.length)return null;
   const {size,chunks}=parts[0];if(!Number.isSafeInteger(size)||size<1||size>FILE_LIMIT||parts.length!==chunks)throw Error('Incomplete file');
   const bytes=new Uint8Array(size);let offset=0;
   for(const [index,row]of parts.entries()){
    const chunk=new Uint8Array(row.bytes);if(row.part!==index||chunk.length!==Math.min(CHUNK,size-offset))throw Error('Corrupt file');
    bytes.set(chunk,offset);offset+=chunk.length;
   }
   if(offset!==size||await digestBytes(bytes)!==key.split('/')[2])throw Error('Corrupt file');
   return {size,async arrayBuffer(){return bytes.slice().buffer}};
  },
  async delete(key){check(key);await db.batch([
   db.prepare('DELETE FROM company_file_chunks WHERE object_key=?').bind(key),
   db.prepare('DELETE FROM company_file_objects WHERE object_key=?').bind(key)
  ])}
 };
}
export function companyStorageEnvironment(env){
 if(env.COMPANY_FILES_DRIVER!=='d1')return env;
 if(env.COMPANY_FILES)throw Error('Choose one attachment storage driver');
 return {...env,COMPANY_FILES:d1Files(env.COMPANY_FILES_DB||env.COMPANY_DB)};
}
