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
assignment endpoint. Owners can now issue scoped invitations (see below).
No assumption that a supplied company ID grants access.

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

## Named invitations

Apply invitations.sql after schema.sql. Owners may POST
`/v1/companies/{id}/invitations` with `{email, role}`. The role is limited to
employee/reviewer/auditor/policy_admin; ownership cannot be granted by invite.
The response includes invitationId and a seven-day link. No email is sent.
Owners may POST `{invitationId}` to the same path plus `/revoke` while pending.
Revoking a pending invite does not revoke an already accepted membership.

`/company/join` is an Access-protected landing page in seven languages.
Include it in Worker routing along with `/v1/*`, on the app's origin. It
previews the company/role then requires a deliberate acceptance. The raw
256-bit token stays in the URL fragment until acceptance; only its SHA-256
hash is stored. Configure the identity provider so the signed Access email
is authoritative and verified. An explicit email_verified=false is rejected;
the service cannot independently verify the provider's email ownership policy.
The email in the signed token, not a client field, must match the invitation.

Acceptance creates membership using a database trigger in the same update.
An existing membership, including a revoked one, is never overwritten. A
retry by the same accepted, still-active subject returns success without a
second insertion. Revocation of the issuing owner's membership also makes
pending invitations unusable. Staff and other-company owners cannot invite.

11 service tests passed on SQLite and WebCrypto. Chrome loopback fixture
verified preview and accept through real handlers with a synthetic identity;
no live Access login, emails, deployed D1 or physical-device tests performed.
`scripts/company-invite-preview.mjs` is a loopback-only synthetic fixture,
never a production entry point. The final Open Momentum action returns to
the company workspace after acceptance. The personal trip editor does not yet
automatically apply company policy to a trip.

## Company workspace

`GET /v1/me/companies` lists only the verified subject's active memberships,
50 per page with an `after` cursor. `/company/workspace` provides a seven-language
company chooser, current policy readout and an owner-only invitation form.
The form offers employee or reviewer; privileged roles remain API-only.
The server, not the hidden form, enforces ownership. No email is sent;
the owner copies the generated link. Preview/accept now leads here.

13 tests passed including a 56-membership pagination case and revocation.
Chrome owner fixture verified company selection, EUR policy readout and
invitation form visibility. Form submission/copy were not exercised in the
browser this turn; invitation handler creation/acceptance has SQLite tests.
The fixture is available with `node scripts/company-invite-preview.mjs --owner`
on loopback port 4194. Neither fixture uses a real corporate identity.

Add `/company/workspace` to the deployment's Access-protected routes. This
does not deploy the service or make the personal PWA automatically connected.
The next integration is explicit company selection when creating a trip,
pinning the server policy version, and server revalidation at submission.

## Versioned report submission and decisions (not connected to UI yet)

Apply reports.sql after schema.sql. The worker now exposes:

- POST `/v1/companies/{id}/reports`: full momentum-trip-archive body,
  `If-Match: "0"` initially, then the last submitted revision number.
  Validates the archive, active membership, company binding and exact current
  published policy rules. Unknown/changed policy requires a new submission.
- GET `/v1/companies/{id}/reports/{reportId}`: submitter, owner, reviewer or
  auditor may read; others are denied. Returns `superseded` when a newer
  revision exists, even if the earlier revision was previously approved.
- POST `/v1/companies/{id}/reports/{reportId}/decision`: owner or reviewer,
  never the submitter. `If-Match` must contain the exact fingerprint in quotes;
  JSON `{decision: "approved" | "changes_requested", note: "..."}`. A request
  for changes requires a nonempty reason. Approval also requires the policy
  version still be current. An older-policy report can be sent back for changes.

Publication and decisions use conditional SQL writes with membership checks.
Records and decisions cannot be overwritten through UPDATE/DELETE. Original
approvals remain historical facts when a newer revision supersedes them.
Local changes not submitted to the server are not remotely detectable.

The current prototype accepts at most 256 KiB per report, INCLUDING attachments;
larger reports are rejected explicitly, never silently stripped. This is not
adequate for many real receipt bundles. Object storage/attachment manifests,
malware/file-content checks, explicit retention and backup policy remain
required before real company rollout. File validation checks the envelope,
not proof of a genuine or readable financial document.

18 service tests passed on SQLite/WebCrypto. No cloud submission, real company
account, report inbox UI or mobile-device submission has been tested. The PWA
still uses its existing file/link review flow; these endpoints do not silently
upload user data. These are implemented server operations, not a deployed
or end-to-end production approval system.

Sources consulted:
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- https://developers.cloudflare.com/d1/worker-api/prepared-statements/
- https://developers.cloudflare.com/d1/worker-api/d1-database/

## Casella resoconti (13 settembre 2026)

`/company/reports?company=<id>&lang=it`, collegata allo spazio aziendale,
mostra le ultime revisioni con filtri Da verificare/Tutti e pagine da 30.
Dipendenti vedono solo i propri documenti; reviewer/owner/auditor quelli aziendali.
Il dettaglio espone spese, allegati scaricabili, elementi pagati dall'azienda,
controlli ed eccezioni. Solo reviewer/owner diversi dal mittente possono decidere;
richiedere modifiche esige un motivo. La decisione usa il fingerprint esatto.

Verifica: 20 test del servizio superati su SQLite reale. Chrome locale verificato
per dettaglio, spese aziendali, motivo mancante e approvazione persistita.
Fixture riproducibile: `node scripts/company-invite-preview.mjs --inbox` (4197).
Identita sintetiche: NON un collaudo SSO, Cloudflare distribuito o dispositivi fisici.
Restano distribuzione, autenticazione aziendale reale, allegati oltre 256 KiB,
ritorno dell'esito nell'app personale e connettori esterni autenticati.
