import { isTripAttachment } from './attachment-format.js';

export const FILE_LIMIT = 8 * 1024 * 1024;
export const BUNDLE_LIMIT = 32 * 1024 * 1024;
export const MANIFEST_LIMIT = 256 * 1024;
export const digestBytes = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
const encoder = new TextEncoder();
function base64(bytes) {
  let text=''; for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(text);
}
export function validAttachmentRef(ref) {
  return ref && /^[a-f0-9]{64}$/.test(ref.hash) && Number.isSafeInteger(ref.size) && ref.size>0 && ref.size<=FILE_LIMIT &&
    ['binary-base64','data-url-utf8'].includes(ref.encoding) && /^(image\/(png|jpeg|webp|gif)|application\/pdf)$/.test(ref.mime);
}
export async function prepareCompanyAttachments(archive) {
  const copy=structuredClone(archive), blobs=new Map();let total=0,count=0;
  for(const tx of copy.transactions) {
    if(tx.receiptRef)throw new Error('invalid');
    if(!tx.receiptImage)continue;
    if(++count>64)throw new Error('large');
    const original=tx.receiptImage;
    if(!isTripAttachment(original))throw new Error('invalid');
    const [prefix,payload]=original.split(',');const mime=prefix.slice(5,-7);
    if(original.length>FILE_LIMIT*2)throw new Error('large');
    let bytes;try{bytes=Uint8Array.from(atob(payload.replace(/\s/g,'')),c=>c.charCodeAt(0))}catch{throw new Error('invalid')}
    let encoding='binary-base64';
    // Legacy whitespace/noncanonical encoding must retain the exact review fingerprint.
    if(`data:${mime};base64,${base64(bytes)}`!==original){bytes=encoder.encode(original);encoding='data-url-utf8'}
    if(!bytes.length||bytes.length>FILE_LIMIT)throw new Error('large');
    total+=bytes.length;if(total>BUNDLE_LIMIT)throw new Error('large');
    const hash=await digestBytes(bytes);blobs.set(hash,bytes);
    tx.receiptRef={hash,size:bytes.length,mime,encoding};delete tx.receiptImage;
  }
  const envelope={format:'momentum-company-upload',version:1,archive:copy};
  if(encoder.encode(JSON.stringify(envelope)).length>MANIFEST_LIMIT||blobs.size>64)throw new Error('large');
  return {envelope,blobs};
}
export async function restoreCompanyAttachments(envelope,read) {
  if(envelope?.format!=='momentum-company-upload'||envelope.version!==1||!Array.isArray(envelope.archive?.transactions))throw new Error('invalid');
  const archive=structuredClone(envelope.archive);let total=0,count=0;const cache=new Map();
  for(const tx of archive.transactions){
    if(!tx||typeof tx!=='object')throw new Error('invalid');
    const ref=tx.receiptRef;if(!ref)continue;
    if(tx.receiptImage||!validAttachmentRef(ref)||++count>64)throw new Error('invalid');
    total+=ref.size;if(total>BUNDLE_LIMIT)throw new Error('large');
    let bytes=cache.get(ref.hash);
    if(!bytes){bytes=await read(ref);if(!(bytes instanceof Uint8Array)||bytes.length!==ref.size||await digestBytes(bytes)!==ref.hash)throw new Error('attachment_missing');cache.set(ref.hash,bytes)}
    if(bytes.length!==ref.size)throw new Error('invalid');
    const value=ref.encoding==='binary-base64'?`data:${ref.mime};base64,${base64(bytes)}`:new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    if(!isTripAttachment(value)||!value.startsWith(`data:${ref.mime};base64,`))throw new Error('invalid');
    tx.receiptImage=value;delete tx.receiptRef;
  }
  return archive;
}
