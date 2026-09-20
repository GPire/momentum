import {readFile,writeFile,stat} from 'node:fs/promises';
import {createDocumentArchive,verifyDocumentArchive} from '../src/invoice/document-archive.js';
const [mode,input,output]=process.argv.slice(2);
try{
 if(!['create','verify'].includes(mode)||!input||(mode==='create'&&!output))throw Error('Usage: node scripts/document-archive.mjs create input.json output.json | verify archive.json');
 if((await stat(input)).size>30000000)throw Error('Input too large');
 const raw=await readFile(input,'utf8');
 if(Buffer.byteLength(raw)>30000000)throw Error('Input too large');
 const data=JSON.parse(raw);
 if(mode==='create'){
  const archive=await createDocumentArchive(data);
  await writeFile(output,JSON.stringify(archive,null,2),{flag:'wx'});
  console.log('Archive created. Integrity only; authenticity and legal preservation are not verified.');
 }else{
  const result=await verifyDocumentArchive(data);console.log(JSON.stringify(result));
  if(!result.ok)process.exitCode=1;
 }
}catch(error){console.error(error.message);process.exitCode=1;}
