const encoder=new TextEncoder();
const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
const manifest=a=>JSON.stringify([a.format,a.version,a.country,a.invoiceId,a.files.map(f=>[f.id,f.kind,f.name,f.documentId||null,f.sha256])]);
function validate(input){
 if(!['IT','CH','ES'].includes(input?.country)||typeof input.invoiceId!=='string'||!input.invoiceId.trim()||input.invoiceId.length>500||!Array.isArray(input.files)||!input.files.length||input.files.length>100)throw Error('Invalid archive');
 const ids=new Set();let bytes=0;
 for(const f of input.files){
  if(!f||typeof f.id!=='string'||!f.id.trim()||f.id.length>120||ids.has(f.id)||!['invoice','receipt','attachment'].includes(f.kind)||typeof f.name!=='string'||!f.name||f.name.length>240||/[\\/\x00-\x1f]/.test(f.name)||typeof f.data!=='string'||f.data.length>10000000)throw Error('Invalid file');
  ids.add(f.id);bytes+=encoder.encode(f.data).length;
  if(bytes>20000000)throw Error('Archive too large');
 }
 if(!input.files.some(f=>f.kind==='invoice'))throw Error('Missing document');
 for(const f of input.files){
  if((f.kind==='receipt'||f.documentId!==undefined)&&!input.files.some(d=>d.id===f.documentId&&d.kind==='invoice'))throw Error('Missing linked document');
 }
}
// Text documents or data URLs. Integrity only: no verified issuer, signature or legal preservation.
export async function createDocumentArchive(input){
 validate(input);
 const files=[];
 for(const f of input.files)files.push({id:f.id,kind:f.kind,name:f.name,...(f.documentId!==undefined?{documentId:f.documentId}:{}),data:f.data,sha256:await digest(f.data)});
 const archive={format:'momentum-document-archive',version:1,country:input.country,invoiceId:input.invoiceId,files};
 return {...archive,manifestSha256:await digest(manifest(archive))};
}
export async function verifyDocumentArchive(archive){
 const base={authenticityVerified:false,legalPreservationVerified:false};
 try{
  if(archive?.format!=='momentum-document-archive'||archive.version!==1)throw Error('Invalid format');
  validate(archive);
  for(const file of archive.files)if(await digest(file.data)!==file.sha256)throw Error('Changed file');
  if(await digest(manifest(archive))!==archive.manifestSha256)throw Error('Changed manifest');
  return {...base,ok:true};
 }catch{return {...base,ok:false};}
}
