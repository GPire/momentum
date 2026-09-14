import test from 'node:test';
import assert from 'node:assert/strict';
import { submitCompanyReport } from './company-submit.js';
import { tripReviewSnapshot,fingerprintTripSnapshot } from './review-fingerprint.js';
const archive={trip:{id:'t',companyPolicy:{companyId:'a',version:1}},transactions:[]};
test('lost submission response recovers the exact receipt without another POST',async()=>{
 const fingerprint=await fingerprintTripSnapshot(tripReviewSnapshot(archive.trip,[]));let writes=0,reads=0;
 const fetcher=async(url,options)=>{if(options.method==='POST'){writes++;throw Error('response lost')}reads++;const query=new URL(url,'https://momentum.test').searchParams;assert.equal(query.get('resolve'),fingerprint);assert.equal(query.get('revision'),'1');return Response.json({reportId:'saved',revision:1,fingerprint})};
 assert.equal((await submitCompanyReport(archive,0,fetcher)).reportId,'saved');assert.equal(writes,1);assert.equal(reads,1);
 await assert.rejects(submitCompanyReport(archive,0,async(url,options)=>options.method==='POST'?Response.json({}, {status:503}):Response.json({reportId:'wrong',revision:2,fingerprint})),/network/);
});
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
 const fetcher=async(url,options)=>{assert.equal(url,'/v1/companies/a/reports/r?view=status');assert.equal(options.credentials,'same-origin');return Response.json(report)};
 assert.equal((await readCompanyReportStatus(archive,receipt,fetcher)).state,'approved');
 const edited=structuredClone(archive);edited.trip.name='Edited';
 assert.equal((await readCompanyReportStatus(edited,receipt,fetcher)).state,'changed');
 report.superseded=true;assert.equal((await readCompanyReportStatus(archive,receipt,fetcher)).state,'changed');
 report.superseded=false;report.policyStale=true;assert.equal((await readCompanyReportStatus(archive,receipt,fetcher)).state,'policy');
 report.company_id='other';await assert.rejects(readCompanyReportStatus(archive,receipt,fetcher),/network/);
 await assert.rejects(readCompanyReportStatus(archive,receipt,async()=>{throw Error('offline')}),/network/);
});
