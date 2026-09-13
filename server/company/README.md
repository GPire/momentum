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

## Risposta al dipendente (13 settembre 2026)

La modale di invio nell'app include Controlla risposta aziendale per documenti
con ricevuta salvata. Legge l'esito con accesso same-origin e valida azienda,
trasferta, revisione e fingerprint. Modifiche locali, revisioni superate e policy
cambiate non mostrano una vecchia approvazione come valida. Le note sono testo,
non HTML; nessuna decisione viene salvata come approvazione locale automatica.
Un nuovo tocco su Invia per la stessa ricevuta consulta la risposta.

23 test mirati superati; build portable completata. Chrome locale verificato con
richiesta di modifica sintetica e motivazione. Fixture: trip-receipt-preview.mjs
4198, query ?lang=it&company-status=1. Il mock non prova SSO o un servizio remoto.
Il ritorno manuale dell'esito e implementato; notifiche e aggiornamento automatico,
riconciliazione di revisioni da altri dispositivi restano da completare.

## Allegati separati (14 settembre 2026)

Il client usa il nuovo percorso quando il JSON supera 256 KiB. Carica gli
allegati separatamente tramite PUT e invia un manifesto piccolo. Limiti attuali:
8 MiB per file, 32 MiB complessivi (conteggiati per riferimento), 64 allegati e
256 KiB per manifesto. Le ricevute canoniche sono binarie; codifiche legacy non
canoniche sono conservate esattamente per non cambiare il fingerprint storico.

Binding opzionale privato COMPANY_FILES (interfaccia R2 head/get/put), ancora
NON configurato su cloud. Le chiavi sono separate per azienda e mittente; non
viene esposto un endpoint pubblico di download. Il revisore legge gli allegati
attraverso il resoconto autorizzato. Il database conserva il manifesto, non le
immagini grandi. I resoconti piccoli e i vecchi archivi mantengono il percorso v1.

Un ritentativo salta i file gia caricati; NON riprende un singolo file a meta
upload. Hash e dimensioni sono verificati e l'approvazione controlla nuovamente
che gli oggetti siano disponibili. Nessuna conferma prima del salvataggio finale.

26 test mirati superati: invio grande con SQLite reale e object store in memoria,
interruzione prima della finalizzazione, retry senza doppio upload, riferimenti
altrui, hash errato, revoca, allegati mancanti, compatibilita della codifica legacy.
Build portable passata; Chrome locale verificato su invio sopra il vecchio limite.
Fixture: node scripts/trip-receipt-preview.mjs 4200 --company-files, query
?lang=it&company-files=1. Identita sintetica: NON un test di Access o R2 reali.

Prima del rollout: quote cumulative per azienda, scadenza degli oggetti orfani,
backup e conservazione, verifica del contenuto/antimalware, prove prestazionali
sul runtime reale e collaudo mobile. La validazione attuale e strutturale e di
integrita dei byte, non una garanzia di leggibilita o autenticita della ricevuta.
Notifiche, connettori e deployment rimangono separati e non sono stati attivati.

### Quote allegati (2026-09-14)
Applicare anche attachment-quota.sql prima di abilitare COMPANY_FILES e configurare
company_storage_limits per ogni azienda (byte; nessuna quota implicita gratuita).
Una riserva SQL atomica precede ciascun nuovo oggetto. Retry dello stesso oggetto
non consuma una seconda quota. Errori ambigui mantengono la riserva: un PUT scaduto
potrebbe essere stato completato. Quota esaurita: HTTP 507 e messaggio in 7 lingue.
Nessuna cancellazione automatica o modifica dei resoconti storici.

Per storage preesistente, inventariare e registrare TUTTI gli oggetti prima di
abilitare gli upload: il registro non ricostruisce automaticamente un bucket.
Non rimuovere riserve per recuperare spazio senza riconciliare bucket e tutti i
resoconti. La pulizia degli orfani richiede ancora un protocollo che impedisca
conflitti con invii in corso. La quota comprende riserve interrotte e allegati
separati, non database, archivi inline, backup o traffico.
Verifica locale: 27 test, SQLite reale e storage simulato; nessun servizio cloud attivato.

### Inventario protetto dello storage (2026-09-14)
GET /v1/companies/:company/storage: solo owner attivo, risposta no-store,
25 prenotazioni per pagina; proseguire con after=nextCursor codificato nell'URL.
Riepiloga limite, byte riservati e spazio disponibile. Per ciascuna prenotazione:
reference=report/unlinked; object=present/missing/size_mismatch/unavailable.
La ricerca comprende tutte le revisioni storiche e verifica anche il mittente:
lo stesso hash di un altro dipendente non costituisce un collegamento.
I permessi sono ricontrollati dopo le letture dello storage.

È una fotografia in sola lettura, NON un'autorizzazione alla cancellazione.
Unlinked può essere un invio ancora in corso. Missing può essere un PUT non
concluso; unavailable indica errore dello storage, non assenza del file.
Nessun oggetto viene cancellato e nessuna quota viene liberata. Non enumera
oggetti del bucket privi di prenotazione, né contabilizza archivi inline o backup.
Le ricerche JSON sulle revisioni richiedono ancora indici dedicati e prove di
carico prima dell'uso su grandi archivi aziendali. Il pannello UI resta da collegare.

29 test locali passati, inclusi riferimenti storici, revoca durante la lettura,
separazione aziende/ruoli, errori storage e paginazione. Storage simulato;
nessun deployment né collaudo del servizio cloud reale in questa verifica.
