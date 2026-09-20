const CORE_TABLES = ['companies', 'memberships', 'policies', 'reports', 'report_decisions', 'invitations'];
const CORE_TRIGGERS = ['immutable_policy_update', 'immutable_policy_delete', 'reports_no_update', 'reports_no_delete', 'decisions_no_update', 'decisions_no_delete', 'invitation_membership'];
const ATTACHMENT_TABLES = ['company_storage_limits', 'company_attachment_reservations', 'company_attachment_lifecycle', 'company_attachment_operations', 'company_attachment_journal'];
const D1_FILE_TABLES = ['company_file_objects', 'company_file_chunks'];

const configured = value => typeof value === 'string' && value.trim().length > 0;

function identityChecks(env) {
  const driver = env.IDENTITY_DRIVER || 'access';
  if (driver === 'access') return { driver, missing: ['ACCESS_ISSUER', 'ACCESS_AUD'].filter(key => !configured(env[key])) };
  if (driver === 'oidc') return { driver, missing: ['OIDC_ISSUER', 'OIDC_JWKS_URL', 'OIDC_AUDIENCE', 'OIDC_SCOPE'].filter(key => !configured(env[key])) };
  return { driver, missing: ['IDENTITY_DRIVER'] };
}

function originCheck(request, env) {
  try {
    const app = new URL(env.APP_ORIGIN);
    return app.origin === new URL(request.url).origin && app.pathname === '/' && !app.search && !app.hash;
  } catch { return false; }
}

async function schemaObjects(db) {
  const result = await db.prepare("SELECT name,type FROM sqlite_master WHERE type IN ('table','trigger')").all();
  return new Map((result.results || []).map(row => [row.name, row.type]));
}

export async function deploymentReadiness(request, env) {
  const identity = identityChecks(env);
  const blockers = identity.missing.map(key => `missing:${key}`);
  if (!originCheck(request, env)) blockers.push('invalid:APP_ORIGIN');
  if (!env.COMPANY_DB) blockers.push('missing:COMPANY_DB');

  let objects = new Map();
  if (env.COMPANY_DB) {
    try {
      const db = env.COMPANY_DB.withSession ? env.COMPANY_DB.withSession('first-primary') : env.COMPANY_DB;
      objects = await schemaObjects(db);
      for (const name of [...CORE_TABLES, ...CORE_TRIGGERS]) if (!objects.has(name)) blockers.push(`schema:${name}`);
    } catch { blockers.push('unreachable:COMPANY_DB'); }
  }

  const storageDriver = env.COMPANY_FILES ? 'r2' : env.COMPANY_FILES_DRIVER === 'd1' ? 'd1' : 'none';
  const attachmentBlockers = [];
  if (storageDriver === 'none') attachmentBlockers.push('missing:COMPANY_FILES');
  if (env.COMPANY_FILES && env.COMPANY_FILES_DRIVER === 'd1') attachmentBlockers.push('conflict:COMPANY_FILES');
  if (storageDriver === 'd1') {
    const fileDb = env.COMPANY_FILES_DB || env.COMPANY_DB;
    if (!fileDb) attachmentBlockers.push('missing:COMPANY_FILES_DB');
    else if (fileDb === env.COMPANY_DB) {
      for (const name of D1_FILE_TABLES) if (!objects.has(name)) attachmentBlockers.push(`schema:${name}`);
    } else {
      try {
        const fileObjects = await schemaObjects(fileDb.withSession ? fileDb.withSession('first-primary') : fileDb);
        for (const name of D1_FILE_TABLES) if (!fileObjects.has(name)) attachmentBlockers.push(`schema:${name}`);
      } catch { attachmentBlockers.push('unreachable:COMPANY_FILES_DB'); }
    }
  }
  if (env.COMPANY_DB) for (const name of ATTACHMENT_TABLES) if (!objects.has(name)) attachmentBlockers.push(`schema:${name}`);

  return {
    operational: blockers.length === 0,
    capabilities: {
      identity: { driver: identity.driver, ready: identity.missing.length === 0 },
      reports: { ready: blockers.length === 0 },
      attachments: { driver: storageDriver, ready: attachmentBlockers.length === 0 },
    },
    blockers,
    attachmentBlockers,
  };
}
