import test from 'node:test';
import assert from 'node:assert/strict';
import { deploymentReadiness } from './deployment-readiness.js';
import { createCompanyWorker } from './worker.js';
import { onRequest as apiRoute } from '../../functions/v1/[[path]].js';
import { onRequest as pageRoute } from '../../functions/company/[[path]].js';

function database(names) {
  return {
    prepare() { return { async all() { return { results: names.map(([name, type]) => ({ name, type })) }; } }; },
  };
}

const core = [
  ...['companies', 'memberships', 'policies', 'reports', 'report_decisions', 'invitations', 'company_storage_limits', 'company_attachment_reservations', 'company_attachment_lifecycle', 'company_attachment_operations', 'company_attachment_journal', 'company_file_objects', 'company_file_chunks'].map(name => [name, 'table']),
  ...['immutable_policy_update', 'immutable_policy_delete', 'reports_no_update', 'reports_no_delete', 'decisions_no_update', 'decisions_no_delete', 'invitation_membership'].map(name => [name, 'trigger']),
];

test('readiness separates report service from optional attachment storage', async () => {
  const request = new Request('https://momentum.example/v1/company/readiness');
  const base = { ACCESS_ISSUER: 'https://team.cloudflareaccess.com', ACCESS_AUD: 'audience', APP_ORIGIN: 'https://momentum.example', COMPANY_DB: database(core) };
  const withoutFiles = await deploymentReadiness(request, base);
  assert.equal(withoutFiles.operational, true);
  assert.equal(withoutFiles.capabilities.reports.ready, true);
  assert.equal(withoutFiles.capabilities.attachments.ready, false);
  assert.deepEqual(withoutFiles.attachmentBlockers, ['missing:COMPANY_FILES']);

  const withD1Files = await deploymentReadiness(request, { ...base, COMPANY_FILES_DRIVER: 'd1' });
  assert.equal(withD1Files.capabilities.attachments.ready, true);
});

test('readiness reports identity, origin and schema blockers without secrets', async () => {
  const result = await deploymentReadiness(new Request('https://preview.example/v1/company/readiness'), { APP_ORIGIN: 'https://momentum.example', COMPANY_DB: database([]) });
  assert.equal(result.operational, false);
  assert.ok(result.blockers.includes('missing:ACCESS_ISSUER'));
  assert.ok(result.blockers.includes('invalid:APP_ORIGIN'));
  assert.ok(result.blockers.includes('schema:companies'));
  assert.equal(JSON.stringify(result).includes('https://momentum.example'), false);
});

test('Pages routes pass only company paths to the authenticated worker', async () => {
  const env = {};
  assert.equal((await apiRoute({ request: new Request('https://momentum.example/v1/me/companies'), env })).status, 401);
  assert.equal((await pageRoute({ request: new Request('https://momentum.example/company/workspace'), env })).status, 401);
});

test('authenticated worker exposes readiness before attachment driver setup', async () => {
  const worker = createCompanyWorker(async () => ({ subject: 'owner' }));
  const env = { ACCESS_ISSUER: 'https://team.cloudflareaccess.com', ACCESS_AUD: 'audience', APP_ORIGIN: 'https://momentum.example', COMPANY_DB: database(core) };
  const response = await worker.fetch(new Request('https://momentum.example/v1/company/readiness'), env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).capabilities.attachments.ready, false);
});
