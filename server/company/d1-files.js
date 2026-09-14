import { digestBytes,FILE_LIMIT,BUNDLE_LIMIT } from '../../src/trips/company-attachments.js';
const CHUNK=1000000;
async function decodeChunk(row,expected){
 const stored=new Uint8Array(row.bytes);
 if(row.encoding==='identity')return stored;
 if(row.encoding!=='gzip')throw Error('Corrupt file encoding');
 const reader=new Blob([stored]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
 const bytes=new Uint8Array(expected);let offset=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;
  if(offset+value.length>expected){await reader.cancel();throw Error('Corrupt file expansion')}
  bytes.set(value,offset);offset+=value.length;
 }}catch{throw Error('Corrupt compressed file')}finally{reader.releaseLock()}
 if(offset!==expected)throw Error('Corrupt file size');return bytes;
}
const validKey=key=>typeof key==='string'&&/^[-a-zA-Z0-9_]{1,80}\/[a-f0-9]{64}\/[a-f0-9]{64}$/.test(key);
// Implements the private object operations used by the corporate service.
// Batch writes commit all chunks together; partial uploads never become readable.
export function d1Files(binding){
 if(!binding?.batch)throw Error('D1 file storage not configured');
 const db=binding.withSession?binding.withSession('first-primary'):binding;
 const check=key=>{if(!validKey(key))throw Error('Invalid object key')};
 return {
  async headMany(keys){
   if(!Array.isArray(keys)||keys.length>64)throw Error('Too many files');for(const key of keys)check(key);
   const rows=await db.prepare('SELECT object_key,size FROM company_file_objects WHERE object_key IN (SELECT value FROM json_each(?))').bind(JSON.stringify(keys)).all();
   return new Map((rows.results||[]).map(row=>[row.object_key,{size:row.size}]));
  },
  async head(key){check(key);return db.prepare('SELECT size FROM company_file_objects WHERE object_key=?').bind(key).first()},
  async getMany(keys){
   if(!Array.isArray(keys)||keys.length>64)throw Error('Too many files');
   const found=new Map();for(const key of keys)check(key);
   const sizes=await db.prepare('SELECT size FROM company_file_objects WHERE object_key IN (SELECT value FROM json_each(?))').bind(JSON.stringify(keys)).all();
   if((sizes.results||[]).some(r=>!Number.isSafeInteger(r.size)||r.size<1||r.size>FILE_LIMIT)||(sizes.results||[]).reduce((sum,r)=>sum+r.size,0)>BUNDLE_LIMIT)throw Error('File bundle too large');
   // Eight keys per query; bounded by the caller's 32 MiB aggregate limit.
   for(let i=0;i<keys.length;i+=8){
    const rows=await db.prepare(`SELECT o.object_key,o.size,o.chunks,c.part,c.bytes,c.encoding FROM company_file_objects o JOIN company_file_chunks c ON c.object_key=o.object_key
      WHERE o.object_key IN (SELECT value FROM json_each(?)) ORDER BY o.object_key,c.part`).bind(JSON.stringify(keys.slice(i,i+8))).all();
    for(const row of rows.results||[]){let file=found.get(row.object_key);if(!file){if(row.size<1||row.size>FILE_LIMIT)throw Error('Corrupt file');file={size:row.size,chunks:row.chunks,parts:[]};found.set(row.object_key,file)}file.parts.push(row)}
   }
   const result=new Map();for(const [key,file]of found){
    if(file.parts.length!==file.chunks)throw Error('Incomplete file');const bytes=new Uint8Array(file.size);let offset=0;
    for(const [index,row]of file.parts.entries()){const chunk=await decodeChunk(row,Math.min(CHUNK,file.size-offset));if(row.part!==index||chunk.length!==Math.min(CHUNK,file.size-offset))throw Error('Corrupt file');bytes.set(chunk,offset);offset+=chunk.length}
    if(offset!==file.size||await digestBytes(bytes)!==key.split('/')[2])throw Error('Corrupt file');
    result.set(key,{size:file.size,async arrayBuffer(){return bytes.slice().buffer}});
   }
   return result;
  },
  async put(key,value){
   check(key);const bytes=value instanceof Uint8Array?value:new Uint8Array(value);
   if(!bytes.length||bytes.length>FILE_LIMIT||await digestBytes(bytes)!==key.split('/')[2])throw Error('Invalid file content');
   const chunks=Math.ceil(bytes.length/CHUNK),statements=[db.prepare('INSERT OR IGNORE INTO company_file_objects(object_key,size,chunks) VALUES(?,?,?)').bind(key,bytes.length,chunks)];
   for(let part=0;part<chunks;part++){
    const raw=bytes.slice(part*CHUNK,(part+1)*CHUNK);let stored=raw,encoding='identity';
    if(raw.length>=1024){const compressed=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
     if(compressed.length<=raw.length*0.9){stored=compressed;encoding='gzip'}}
    statements.push(db.prepare('INSERT OR IGNORE INTO company_file_chunks(object_key,part,bytes,encoding) VALUES(?,?,?,?)').bind(key,part,stored.buffer,encoding));
   }
   await db.batch(statements);
  },
  async get(key){
   check(key);
   const rows=await db.prepare(`SELECT o.size,o.chunks,c.part,c.bytes,c.encoding FROM company_file_objects o JOIN company_file_chunks c ON c.object_key=o.object_key WHERE o.object_key=? ORDER BY c.part`).bind(key).all();
   const parts=rows.results||[];if(!parts.length)return null;
   const {size,chunks}=parts[0];if(!Number.isSafeInteger(size)||size<1||size>FILE_LIMIT||parts.length!==chunks)throw Error('Incomplete file');
   const bytes=new Uint8Array(size);let offset=0;
   for(const [index,row]of parts.entries()){
    const chunk=await decodeChunk(row,Math.min(CHUNK,size-offset));if(row.part!==index||chunk.length!==Math.min(CHUNK,size-offset))throw Error('Corrupt file');
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
