import test from 'node:test';
import assert from 'node:assert/strict';
import { submitCompanyReport } from './company-submit.js';
import { tripReviewSnapshot,fingerprintTripSnapshot } from './review-fingerprint.js';
const archive={trip:{id:'t',companyPolicy:{companyId:'a',version:1}},transactions:[]};
test('submission validates server receipt and uses optimistic revision',async()=>{
 const fingerprint=await fingerprintTripSnapshot(tripReviewSnapshot(archive.trip,[]));
 const result=await submitCompanyReport(archive,2,async(url,options)=>{assert.equal(url,'/v1/companies/a/reports');assert.equal(options.headers['If-Match'],'"2"');return Response.json({reportId:'r',revision:3,fingerprint})});
 assert.equal(result.fingerprint,fingerprint);
 await assert.rejects(submitCompanyReport(archive,0,async()=>Response.json({reportId:'r',revision:1,fingerprint:'wrong'})),/network/);
});
test('actionable failures never pretend a report was received',async()=>{
 for(const [status,error,message] of [[403,'forbidden','access'],[409,'policy_update_required','policy'],[409,'revision_or_access_changed','changed'],[413,'too_large','large'],[503,'unavailable','network']])await assert.rejects(submitCompanyReport(archive,0,async()=>Response.json({error},{status})),new RegExp(message));
 await assert.rejects(submitCompanyReport({...archive,extra:'x'.repeat(300000)},0,()=>{throw new Error('must not send')}),/large/);
 await assert.rejects(submitCompanyReport(archive,0,async()=>{throw new Error('offline')}),/network/);
});

import { readCompanyReportStatus } from './company-submit.js';
test('company approval applies only to unchanged local data and current server revision',async()=>{
 const fingerprint=await fingerprintTripSnapshot(tripReviewSnapshot(archive.trip,[]));
 const receipt={reportId:'r',revision:1,fingerprint};
 const report={id:'r',company_id:'a',trip_id:'t',revision:1,fingerprint,superseded:false,policyStale:false,decision:'approved',note:null};
 const fetcher=async()=>Response.json(report);
 assert.equal((await readCompanyReportStatus(archive,receipt,fetcher)).state,'approved');
 const edited=structuredClone(archive);edited.trip.name='Edited';
 assert.equal((await readCompanyReportStatus(edited,receipt,fetcher)).state,'changed');
 report.superseded=true;assert.equal((await readCompanyReportStatus(archive,receipt,fetcher)).state,'changed');
 report.superseded=false;report.policyStale=true;assert.equal((await readCompanyReportStatus(archive,receipt,fetcher)).state,'policy');
 report.company_id='other';await assert.rejects(readCompanyReportStatus(archive,receipt,fetcher),/network/);
 await assert.rejects(readCompanyReportStatus(archive,receipt,async()=>{throw Error('offline')}),/network/);
});
