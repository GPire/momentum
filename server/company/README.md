# Company policy service — not deployed

Separate Cloudflare Worker and D1 database for shared, versioned company
policies. No changes to telemetry or personal Vault storage. The app is not
yet connected to this service; local template settings remain local.

## Trust boundary

The Worker verifies the Access JWT signature, configured issuer, audience,
expiry and optional not-before. Email/role headers and client-supplied roles
are not trusted. Public keys come only from the configured Access issuer.
Membership is read from the primary database on every request. Publishing
rechecks membership in the same SQL statement as the version insertion.

Roles: employee, reviewer and auditor can read company policy; policy_admin
and owner can also publish. These permissions apply ONLY to policy endpoints,
not report approval. Company and membership provisioning currently require
an authorized database operator. There is no public self-enrollment or role
assignment endpoint. No assumption that a supplied company ID grants access.

## API

- `GET /v1/companies/{id}/policies`: latest policy, ETag contains its version.
- `GET /v1/companies/{id}/policies/{version}`: immutable historical version.
- `POST /v1/companies/{id}/policies`: JSON rules, exact configured Origin,
  `Content-Type: application/json`, `If-Match: "0"` for the first publication,
  otherwise the previously read version. Returns 409 if superseded or revoked.

Rules contain exactly `currency: "EUR"`, `receiptThreshold`, `expenseLimits`
and `dailyLimits`. Category maps accept trasporto, vitto, alloggio, altro;
values are nonnegative amounts with at most two decimal places. A maximum
8 KiB streamed request body is accepted. No employee exception reasons in
central policy. EUR-only is intentional until the app's currency editor is
extended; this service is not yet a global/multicurrency solution.

Policy versions are append-only at database level and retain author subject
and timestamp. This is publication history, not a complete enterprise audit
trail. Privileged database operators remain able to alter the schema.

## Deployment prerequisites

1. Create a dedicated D1 database and apply schema.sql. This creates no users.
2. Configure an Access application for the service route and a trusted identity
   provider. Set issuer, audience and exact app Origin in a deployment config
   based on wrangler.example.toml. Placeholder config deliberately cannot work.
3. Provision the company and the verified Access `sub` in memberships through
   an authorized operator. Never use an unverified email as subject. One issuer
   is supported per deployment; changing issuer requires membership migration.
4. Configure a same-origin service route and Access protection; no permissive
   CORS fallback is provided. Keep direct workers.dev access disabled.
5. Test two real company identities, revoked membership, version conflicts and
   recovery against D1 before connecting employee data or enabling the UI.

No account, paid service, database or production route was created by this
change. Tokens, JWTs and financial contents are not logged by this code.
Operational access logging, retention, backups, tenant geography and service
limits must be configured and reviewed before production.

## Verification and limits

Tests use actual in-memory SQLite with the same schema/statements, a minimal
D1 API wrapper, and real WebCrypto RSA signing/verification. JWKS responses
are controlled fixtures, not a live Cloudflare Access login. They do not
certify cloud deployment, company SSO, physical devices or enterprise scale.

Still required: member administration with audit, organization hierarchy and
delegation, shared report inbox, server-side report-version approval, app UI
integration, region/currency policy assignment, connector credentials and
delivery reconciliation, monitoring, backup restore and load testing.

Sources consulted:
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- https://developers.cloudflare.com/d1/worker-api/prepared-statements/
- https://developers.cloudflare.com/d1/worker-api/d1-database/
