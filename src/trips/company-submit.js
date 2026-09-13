import { tripReviewSnapshot, fingerprintTripSnapshot } from './review-fingerprint.js';
export async function submitCompanyReport(archive, revision=0, fetcher=fetch) {
  const company=archive?.trip?.companyPolicy?.companyId;
  if(!/^[a-zA-Z0-9_-]{1,80}$/.test(company||'')||!Number.isSafeInteger(revision)||revision<0)throw new Error('invalid');
  const body=JSON.stringify(archive);
  if(new TextEncoder().encode(body).length>256*1024)throw new Error('large');
  const fingerprint=await fingerprintTripSnapshot(tripReviewSnapshot(archive.trip,archive.transactions));
  let response;
  try{response=await fetcher(`/v1/companies/${encodeURIComponent(company)}/reports`,{method:'POST',credentials:'same-origin',redirect:'error',headers:{'Content-Type':'application/json','If-Match':`"${revision}"`},body,signal:AbortSignal.timeout(20000)})}catch{throw new Error('network')}
  let result;try{result=await response.json()}catch{throw new Error('network')}
  if(!response.ok)throw new Error(response.status===401||response.status===403?'access':response.status===413?'large':result.error==='policy_update_required'?'policy':response.status===409?'changed':response.status>=500?'network':'invalid');
  if(typeof result.reportId!=='string'||!result.reportId||result.revision!==revision+1||result.fingerprint!==fingerprint)throw new Error('network');
  return {reportId:result.reportId,revision:result.revision,fingerprint};
}
