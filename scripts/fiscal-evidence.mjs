import {readFile,stat} from 'node:fs/promises';
import {assessFiscalEvidence} from '../src/invoice/fiscal-evidence.js';
const [archivePath,checksPath]=process.argv.slice(2);
try{
 if(!archivePath)throw Error('Usage: node scripts/fiscal-evidence.mjs archive.json [checks.json]');
 const read=async(path,max)=>{if((await stat(path)).size>max)throw Error('Input too large');const text=await readFile(path,'utf8');if(Buffer.byteLength(text)>max)throw Error('Input too large');return JSON.parse(text);};
 const result=await assessFiscalEvidence(await read(archivePath,30000000),checksPath?await read(checksPath,2000000):[]);
 console.log(JSON.stringify(result,null,2));
 if(!result.ok||result.documents.some(d=>d.missing.length))process.exitCode=2;
}catch(error){console.error(error.message);process.exitCode=1;}
