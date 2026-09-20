# Attivazione cloud del servizio aziende — 20 settembre 2026

## Stato verificabile

Il codice applicativo e il gateway Pages sono presenti. Le route dinamiche sono
limitate a `/v1/*` e `/company/*`; Dashboard, Analisi, Vault e gli asset statici
restano serviti come file. Il servizio aziendale non usa il KV della telemetria.

`GET /v1/company/readiness`, dopo l'accesso, distingue tre capacità:

- identità configurata;
- resoconti e approvazioni su D1;
- allegati su R2 oppure sul pilota D1 esplicitamente abilitato.

Un esito positivo del controllo non sostituisce il collaudo con persone,
dispositivi e gestionali reali.

## Attivazione minima sul progetto Pages

1. Creare un database D1 dedicato e applicare, nell'ordine, `schema.sql`,
   `reports.sql`, `report-navigation.sql`, `invitations.sql`,
   `attachment-quota.sql`, `attachment-lifecycle.sql` e
   `attachment-journal.sql`. Per il pilota allegati D1 applicare anche
   `d1-files.sql` e `d1-files-compression.sql`.
2. Nel progetto Pages aggiungere il binding D1 `COMPANY_DB`. Per gli allegati
   scegliere un solo driver: binding R2 privato `COMPANY_FILES`, oppure variabile
   `COMPANY_FILES_DRIVER=d1`. Un database separato per i file usa il binding
   `COMPANY_FILES_DB`.
3. Impostare `APP_ORIGIN` sull'origine di produzione esatta. Impostare
   `ACCESS_ISSUER` e `ACCESS_AUD` per Access, oppure tutte le variabili OIDC
   documentate in `server/company/wrangler.example.toml`.
4. Creare applicazioni Access per i percorsi `/v1/*` e `/company/*`. La policy
   deve nominare utenti o domini autorizzati; una regola “Everyone” o “all valid
   emails” renderebbe l'accesso troppo ampio.
5. Inserire la prima azienda e il proprietario in `companies` e `memberships`
   usando il `sub` firmato dell'identità scelta. Non usare l'email come chiave
   di autorizzazione.
6. Ridistribuire Pages e aprire `/v1/company/readiness`. Prima del pilota devono
   essere vuoti `blockers` e, se si usano allegati, `attachmentBlockers`.

Cloudflare documenta il routing a file e `_routes.json`, i binding D1/R2 di
Pages e le policy Access per percorso:

- https://developers.cloudflare.com/pages/functions/routing/
- https://developers.cloudflare.com/pages/functions/bindings/
- https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/
- https://developers.cloudflare.com/cloudflare-one/access-controls/policies/

## Collaudo che decide il rilascio

Usare due identità reali appartenenti alla stessa azienda: dipendente e
responsabile. Verificare invio, richiesta di correzione, nuova revisione,
approvazione della revisione esatta, revoca membership, conflitto di versione,
allegato grande, ritentativo dopo rete interrotta, cancellazione e recupero.
Ripetere su iPhone installato come PWA, Android/Chrome e desktop. Simulatori e
fixture locali restano prove diverse dai dispositivi fisici.

Per ogni gestionale, l'attivazione richiede un account autorizzato del cliente.
Momentum può preparare mapping, idempotenza e riconciliazione; non può ottenere
o simulare una ricevuta ufficiale. Zoho usa OAuth e offre il ciclo completo dei
resoconti; SAP Concur richiede la registrazione dell'app/ambiente autorizzato;
Expensify e Rydoo rilasciano credenziali secondo il loro processo. Un export o
un'email preparata non diventano quindi un invio ricevuto.

## Installazioni e telemetria storica

Gli eventi mai arrivati al collector non esistono e non vengono inventati.
`install` storico conserva il significato di prima apertura browser. Una PWA
già installata viene aggiunta a `installedDevicesObserved` alla prima riapertura
standalone successiva all'introduzione della misura. La data è “prima volta
osservata”, non la data originaria di installazione.
