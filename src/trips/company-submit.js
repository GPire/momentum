import { prepareCompanyAttachments, MANIFEST_LIMIT } from './company-attachments.js';
import { tripReviewSnapshot, fingerprintTripSnapshot } from './review-fingerprint.js';
export async function submitCompanyReport(archive, revision=0, fetcher=fetch) {
  const company=archive?.trip?.companyPolicy?.companyId;
  if(!/^[a-zA-Z0-9_-]{1,80}$/.test(company||'')||!Number.isSafeInteger(revision)||revision<0)throw new Error('invalid');
  let body=JSON.stringify(archive);
  if(new TextEncoder().encode(body).length>MANIFEST_LIMIT){
    const {envelope,blobs}=await prepareCompanyAttachments(archive);
    for(const [hash,bytes] of blobs){
      const path=`/v1/companies/${encodeURIComponent(company)}/attachments/${hash}`;
      let found;try{found=await fetcher(path,{credentials:'same-origin',redirect:'error',signal:AbortSignal.timeout(20000)})}catch{throw new Error('network')}
      if(found.ok){const ref=await found.json();if(ref.hash!==hash||ref.size!==bytes.length)throw new Error('network');continue}
      if(found.status!==404)throw new Error([401,403].includes(found.status)?'access':'network');
      let sent;try{sent=await fetcher(path,{method:'PUT',credentials:'same-origin',redirect:'error',headers:{'Content-Type':'application/octet-stream'},body:bytes,signal:AbortSignal.timeout(60000)})}catch{throw new Error('network')}
      if(!sent.ok)throw new Error([401,403].includes(sent.status)?'access':sent.status===413?'large':'network');
      const ref=await sent.json();if(ref.hash!==hash||ref.size!==bytes.length)throw new Error('network');
    }
    body=JSON.stringify(envelope);
  }
  const fingerprint=await fingerprintTripSnapshot(tripReviewSnapshot(archive.trip,archive.transactions));
  let response;
  try{response=await fetcher(`/v1/companies/${encodeURIComponent(company)}/reports`,{method:'POST',credentials:'same-origin',redirect:'error',headers:{'Content-Type':'application/json','If-Match':`"${revision}"`},body,signal:AbortSignal.timeout(20000)})}catch{throw new Error('network')}
  let result;try{result=await response.json()}catch{throw new Error('network')}
  if(!response.ok)throw new Error(response.status===401||response.status===403?'access':response.status===413?'large':result.error==='policy_update_required'?'policy':response.status===409?'changed':response.status>=500?'network':'invalid');
  if(typeof result.reportId!=='string'||!result.reportId||result.revision!==revision+1||result.fingerprint!==fingerprint)throw new Error('network');
  return {reportId:result.reportId,revision:result.revision,fingerprint};
}

// Read a decision without promoting an older approval onto edited local data.
export async function readCompanyReportStatus(archive, receipt, fetcher=fetch) {
  const company=archive?.trip?.companyPolicy?.companyId;
  if(!/^[a-zA-Z0-9_-]{1,80}$/.test(company||'')||!/^[a-zA-Z0-9-]{1,80}$/.test(receipt?.reportId||'')||!Number.isSafeInteger(receipt?.revision)||receipt.revision<1)throw new Error('invalid');
  let response,result;
  try{response=await fetcher(`/v1/companies/${encodeURIComponent(company)}/reports/${receipt.reportId}`,{credentials:'same-origin',redirect:'error',signal:AbortSignal.timeout(20000)});result=await response.json()}catch{throw new Error('network')}
  if(!response.ok)throw new Error([401,403].includes(response.status)?'access':response.status===404?'changed':'network');
  if(result.id!==receipt.reportId||result.company_id!==company||result.trip_id!==archive.trip.id||result.revision!==receipt.revision||result.fingerprint!==receipt.fingerprint||typeof result.superseded!=='boolean'||typeof result.policyStale!=='boolean'||![null,'approved','changes_requested'].includes(result.decision)||!(result.note===null||typeof result.note==='string'&&result.note.length<=1000))throw new Error('network');
  const local=await fingerprintTripSnapshot(tripReviewSnapshot(archive.trip,archive.transactions));
  return {state:local!==result.fingerprint||result.superseded?'changed':result.policyStale?'policy':result.decision||'pending',note:result.note||''};
}
