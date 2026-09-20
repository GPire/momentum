import {verifyDocumentArchive} from './document-archive.js';
const kinds=['authority-outcome','origin-check','professional-review','preservation'];
const text=s=>typeof s==='string'&&s.trim().length>0&&s.length<=300;
const timestamp=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===(s.length===20?s.slice(0,-1)+'.000Z':s);
// Evidence inventory, not a trust authority. User-supplied reviews cannot grant certification.
export async function assessFiscalEvidence(archive,checks=[],asOf=new Date().toISOString()){
 const base={authenticityVerified:false,legalPreservationVerified:false,professionalValidationVerified:false};
 if(!timestamp(asOf)||!Array.isArray(checks)||checks.length>1000||!(await verifyDocumentArchive(archive)).ok)return {...base,ok:false,records:[],documents:[]};
 const seen=new Set();
 const records=checks.map(c=>{
  const row={id:typeof c?.id==='string'?c.id:null,status:'invalid'};
  if(!c||!text(c.id)||seen.has(c.id)||!kinds.includes(c.kind)||!text(c.reviewer)||!text(c.reference)||!timestamp(c.checkedAt)||Date.parse(c.checkedAt)>Date.parse(asOf))return row;
  seen.add(c.id);
  if(c.country!==archive.country||c.invoiceId!==archive.invoiceId)return {...row,status:'wrong-scope'};
  const document=archive.files.find(f=>f.id===c.documentId&&f.kind==='invoice'),evidence=archive.files.find(f=>f.id===c.evidenceId&&f.kind!=='invoice');
  if(!document||!evidence||document.sha256!==c.documentHash||evidence.sha256!==c.evidenceHash)return {...row,status:'stale'};
  if(evidence.documentId!==document.id)return {...row,status:'wrong-link'};
  return {...row,status:'recorded-unverified',documentId:document.id,kind:c.kind};
 });
 const documents=archive.files.filter(f=>f.kind==='invoice').map(f=>({documentId:f.id,missing:kinds.filter(kind=>!records.some(r=>r.status==='recorded-unverified'&&r.documentId===f.id&&r.kind===kind))}));
 return {...base,ok:records.every(r=>r.status==='recorded-unverified'),asOf,records,documents};
}
