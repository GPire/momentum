# Trasferte: verifica aziendale del 20 settembre 2026

## Sviluppato e collegato

Il controllo degli importi nella schermata trasferta usa ora un confronto
temporale: almeno cinque spese precedenti della stessa categoria e valuta,
ultime 24 osservazioni, mediana e dispersione robusta. Le spese dello stesso
giorno non si predicono reciprocamente. Duplicati di ID, importi non finiti,
entrate, spese personali e revisioni in conflitto sono esclusi.

Il pannello «Quanto sono utili le stime?» mostra casi confrontati, errore
assoluto medio e confronto con la media semplice, separati per valuta.
Testi in IT/EN/DE/FR/ES/NL/PT. Nessuna trasmissione o nuovo training remoto.

È una rilettura retrospettiva dei record attuali: non un esperimento
prospettico, una misura di frode o una promessa di precisione. Rettifiche
successive possono cambiare la rilettura. Non tiene ancora conto di città,
durata del servizio o cambiamenti di policy. Non promuovere automaticamente
il metodo perché migliore in un singolo storico o in fixture sintetiche.

## Prove eseguite

- Suite aziendali e autenticazione: 64 test su codice reale, SQLite locale,
  firme e risposte di rete controllate. Nessuna identità cloud reale.
- Suite trasferte: 276 test prima dell'aggiunta del controllo traduzioni;
  quest'ultimo è verificato separatamente con il modulo previsioni.
- Build di produzione riuscita; restano avvisi sui bundle grandi.
- Browser: casella responsabile locale, apertura riepilogo, approvazione
  disabilitata prima della verifica, verifica completa, esito registrato,
  rimozione dalla coda. Dati e identità sintetici, nessun pagamento.
- Browser app: pannello delle stime aperto e astensione con storico
  insufficiente; ramo numerico coperto da test di modulo, non ancora
  verificato visivamente con uno storico lungo.

## Evidenze di mercato e conseguenze

- Expensify documenta controlli su discrepanze e modifiche agli importi OCR:
  https://help.expensify.com/articles/expensify-classic/workspaces/Enable-and-set-up-expense-violations
  Priorità Momentum: correzioni tracciate e motivi chiari prima dell'invio.
- Riconciliazione internazionale: importo addebitato all'azienda e ricevuto
  dal dipendente possono avere valute diverse:
  https://help.expensify.com/articles/new-expensify/reports-and-expenses/Reconcile-Reimbursements
  Non confondere nota spese approvata, rimborso disposto e denaro ricevuto.
- Zoho richiede OAuth e contesto dell'organizzazione:
  https://www.zoho.com/expense/api/v1/authentication/
  https://www.zoho.com/expense/api/v1/introduction/
  Un CSV pronto non è un connettore autenticato.

Queste sono capacità e problemi descritti dalle fonti, non prove di
superiorità di Momentum né una ricerca rappresentativa di tutti gli utenti.

## Blocchi reali al completamento commerciale

1. Cloud: la configurazione aziendale presente è ancora un esempio.
   Occorrono dominio/route, database, autorità di identità, membership e
   storage realmente configurati. Non usare il servizio telemetria.
2. Connettori: mancano account autorizzati e applicazioni/scopes concessi
   dai gestionali. Validare invio, retry, revoca e riconciliazione con
   identificativi remoti. Nessun connettore live certificato da questi test.
3. Dispositivi fisici: browser ridimensionato non prova Safari/iOS,
   tastiera, fotocamera, sospensione e ripresa su un telefono reale.
4. Previsioni: salvare previsioni prima degli eventi, raccogliere esiti
   autorizzati e confrontare errori/astensioni nel tempo. La rilettura
   introdotta qui è un primo confronto riproducibile, non quel collaudo.

Non attivati servizi a pagamento, nuovi account, invii a gestionali o deploy.


## Reconciliation and guided handoff follow-up

- Matching now requires a uniquely closest candidate on both sides. Identical charges or equally plausible expenses remain unresolved instead of being arbitrarily marked matched. Currency is never converted for matching.
- Generic CSV reads explicit ISO currency columns (including EUR/USD/CAD on separate rows); invalid explicit codes reject the import. Existing amount-cell currency detection remains the fallback.
- Reconciliation UI displays both sides of proposed matches and candidates for ambiguous charges. Amounts retain their transaction currency; unknown currencies are labelled.
- New generic Momentum export defaults populate columns without forcing ten manual inputs. Existing saved mappings are preserved. Advanced mapping and official documentation are progressively disclosed. UI blocks downloads with row errors, no ready rows, or invalid mapping; no silent partial export from this UI.
- New text in seven languages. Mobile fields wrap and have labels; action area is sticky; reduced motion supported.
- Rydoo added to receipt email preparation using its documented production inbox. Opening email/share is not evidence of delivery. Sender instructions now localized for all listed platforms.
- Documentation links also cover Emburse, Navan, Pleo, Spendesk. These are guidance, NOT implemented or verified authenticated adapters. Each product/API scope and account entitlement must be checked before implementing its adapter. No universal CSV compatibility is claimed.

Validation: 39 test files in src/import and src/trips pass using Node24 with --no-experimental-global-navigator (existing test harness assigns navigator). Production portable build passes. Browser: synthetic duplicate EUR charges unresolved, USD charge retains USD; export preview ready without manual configuration; download success feedback; deleting required amount mapping produces inline error and blocks export. Responsive checks at 390x844 and 820x1180: no horizontal document overflow. Browser console checked without errors. These are browser viewport tests, not physical iOS/Android tests. No live provider upload performed.

Sources checked:
- https://help.rydoo.com/hc/en-be/articles/8139189477660-Forward-a-receipt-via-email
- https://help.rydoo.com/hc/en-be/articles/8232712930460-Create-API-credentials
- https://www.zoho.com/ca/expense/help/reports/creating-reports/
- https://developer.concur.com/api-reference/authentication/getting-started.html
- https://integrations.expensify.com/Integration-Server/doc/getting_started.html
- https://www.emburse.com/api-docs
- https://navan.com/uk/integrations
- https://developers.pleo.io/reference/get-company-by-id
- https://helpcenter.spendesk.com/en/articles/9250246-build-a-native-integration-using-spendesk-api

Still missing: real cloud configuration, authorized vendor accounts and authenticated connector implementation, physical-device tests, prospective prediction measurement, end-to-end partial/international reimbursement settlement. Card matching is not reimbursement settlement. No push or deployment in this follow-up.


## Company template assistant

Added deterministic local header matching for company CSV templates, with multilingual aliases, comma/semicolon/tab delimiters, and explicit user application. Unknown, duplicate, ambiguous and missing required columns block automatic application; previous mapping is preserved. An unresolved template also blocks save/download so an old template cannot silently be exported as the newly requested one. No vendor field requirements, dates, categories or API permissions are inferred. This is not an authenticated connector or a vendor-certified import schema.

Validation: four new scenario tests pass; all Trips test files pass. Browser verified German headers populate the real fields; an unknown Cost center column shows feedback and preserves previous fields. Build passes. Local service restarted at port4177. No commit/push/deploy or third-party data transmission.

## International export evidence and column order

Exports now support trip ID, original amount/currency, recorded exchange rate and payment method. Missing original amounts and rates stay empty; no rate is inferred or converted during export. Company template column order is retained in mapping metadata and survives JSON persistence. Older mappings retain their existing canonical ordering. Labels cover IT/EN/DE/FR/ES/NL/PT.

Validation: all 35 test files in src/trips, server/company and server/auth passed locally. Added original-currency evidence and saved-template ordering regression cases. Portable production build passed (existing large-bundle warning remains). Browser: applied Currency,Amount,Category,Date,Original currency,Original amount,Exchange rate to the isolated synthetic trip; field assignments and localized labels were correct, preview showed one ready row and no errors, console had no errors. No real financial data sent.

These changes improve export evidence; they do not implement partial/international reimbursement settlement or vendor-certified import schemas. Authenticated external connectors, real receipt acknowledgements, live cloud provisioning and physical-device tests remain unverified. No commit, push or deployment in this follow-up.

## Linked reimbursement balance

Added a read-only balance to the trip screen, using explicitly trip-linked income and non-personal expenses. Partial credits accumulate once per transaction ID. Conflicting duplicates, missing currency, inconsistent recorded FX and revision conflicts suspend the balance; overpayments remain visible. Conversion is not inferred: original amount/currency and recorded rate must explain the base-currency amount. Existing transactions remain unchanged. Currency precision follows Intl currency digits.

The interface is available in seven languages, progressively disclosed below the trip summary, with responsive metrics and reduced-motion support. It compares recorded expenses, NOT an approved entitlement or an authenticated provider settlement. There is no new UI to link previously unlinked credits in this increment. Unlinked salary/income is deliberately excluded. Reversal allocation and version-bound provider acknowledgements remain outside this implementation.

Validation: all 36 Trips/company/auth test files passed; nine new scenarios include partial payments, duplicates/conflicts, international FX evidence, unrelated income, personal expenses, overpayment, precision and seven-language escaped rendering. Portable build passed. Browser tested existing synthetic trip and no-credit state; widths 390 and 820 had no horizontal document overflow and no captured console errors. Partial/FX cases were automated tests, not live bank or vendor payments. Physical devices and authenticated connectors were not tested. No push/deploy.

Official references rechecked: Expensify reimbursement reconciliation distinguishes company debit and employee credit currencies; SAP Concur OAuth requires registered client credentials and authorized scope. No new external account or provider connection was created.

## Associate existing credits — complete local path

Trip screen now includes a searchable credit picker (20 visible results), amount-distance ranking, explicit confirmation/cancel and reversible unlink. Existing transaction ID, hash, amount, currency and bank description are preserved. Association events have causal parents; sync includes their digest, merges events, preserves unlink history and exposes concurrent conflicting destinations instead of choosing one. Vault rejects deleted/duplicate IDs, stale selection, another trip's credit and unsafe currency/personal/revision states. These are local user-confirmed associations, not provider acknowledgements or verified entitlement.

Live browser found that Command Center saved its default-EUR movements without currency; new manual movements now record the currency displayed (EUR when no explicit alternative). No currency was inferred for historical records. Dates in the new picker/balance use locale formatting. After confirmation the balance opens and receives focus.

Validation: 103 test files across trips, mesh, core, company and auth passed; six association tests cover UUIDs, immutable originals, stale state, tombstones, unlink, concurrent destinations and candidate filtering. Browser on separate synthetic localhost origin: create credit, select it, confirm 7 EUR against 15 EUR expenses -> 8 EUR residual; unlink -> 15 EUR residual, credit retained. No user production-origin data or external account was changed.

Four usage paths must remain distinct:
- Personal trip archive: local expense/date/receipt and print/export; current increment adds credit association.
- Standalone company service: local tests exist; real deployment/access, operational notifications and physical-device end-to-end tests remain outstanding.
- Companion to an external platform: template export and documented handoff available; authenticated vendor adapters and actual delivery receipts are not activated.
- Manager/finance reconciliation: association/conflict controls tested locally; no real bank-to-provider reconciliation or multi-report allocation claimed.

Remaining: UI resolution of concurrent association conflicts, explicit currency confirmation for legacy credits, allocation of one credit across multiple trips, actual vendor adapters and version-bound authenticated acknowledgements. No push/deploy in this increment.

## Four guided entry paths

Added a responsive next-step workspace inside the trip, with four explicit choices: personal archive, company review, companion to another platform, HR/Finance. Primary actions reuse existing print/review/export/reconciliation handlers. Empty trips lead to adding an expense; blocking archive checks lead to the preflight section. CSV secondary action has the same guard. Existing repeated export buttons are consolidated under this workspace. Counts show expense and receipt coverage without implying approval or authenticated delivery. Seven languages, visible focus, 48px actions, two-column mobile choices and reduced-motion support.

Validation: four route tests pass (empty, blocked, ready and all locales); portable build passes. Browser verified personal action labels, companion action opening real mapping/preview, company action opening recipient/review preparation, and HR/Finance action opening card reconciliation. No review message was sent, no receipt was submitted, and no external integration was certified. These checks verify navigation and readiness controls, not the complete enterprise service.

## Approval preparation and QR interaction

Reorganized local review sharing into prepare/share/receive-reply sections, with recipient feedback, optional QR disclosure, explanatory QR limits, grouped receipt/archive actions and an explicit return-to-trip footer. New copy supports seven languages. A changed or deleted trip now blocks copying/opening the prepared review message as well as recording dispatch. Opening a message remains preparation, not a delivery receipt. Snapshot fingerprint verification for applying the returned verdict remains in place.

Validation: 23 review tests plus six fingerprint tests passed, including changes to attachments/amounts/policy; build and syntax check passed. Browser verified the three sections, QR disclosure and missing-recipient error/focus. No message was sent, no real manager identity was authenticated, and no physical QR scan was performed. CompanyPolicy trips still use their existing separate company submission path; this change does not deploy that service or complete its authentication.

## Telemetria applicativa e verifica cloud — 20 settembre 2026

Verifica dalla console Cloudflare autenticata: Workers & Pages elenca solo
momentum-finance (Pages) e momentum-telemetry. La console richiede ancora
configurazione Zero Trust prima di proteggere Workers con Access. Nessun
servizio aziendale distribuito in questo intervento; nessun account esterno
aziendale o dispositivo fisico collaudato.

Telemetria locale estesa: 35 punti d'ingresso nei moduli personali/fiscali,
18 eventi trasferte e ulteriori eventi navigazione, salvataggio e voce.
Il catalogo chiuso client/server impedisce che nomi, importi, allegati,
trascrizioni o messaggi d'errore finiscano nei payload. Gli eventi di uso
rispettano l'opt-out. La diagnostica essenziale preesistente resta distinta.
Aperture non equivalgono a operazioni completate: export richiesto non è
consegna; submit_received è emesso solo dopo la verifica della ricevuta
applicativa. I conteggi sono dispositivi pseudonimi unici per mese, NON
frequenza delle azioni né persone uniche. featureReach ordina tale copertura;
non usarla come tasso di successo o conversione per singolo tentativo.

Corrette due gare nella deduplicazione locale: chiamate uguali simultanee
non inviano doppioni; chiamate diverse non perdono il proprio marcatore.
Cache limitata alle chiavi ammesse del mese corrente. Nessun errore di
storage o rete deve bloccare la funzione dell'app.

Aggiunto preflight CORS al Worker: solo origine di produzione per default,
altre origini esplicite in TELEMETRY_ORIGINS; /stats non esposto via CORS.
Il Worker aggiornato NON è distribuito: i nuovi eventi richiedono deploy
sia del collector sia dell'app. Nessun traffico sintetico inviato al collector
reale durante questi test.

Validazione: 60 test locali passati (26 client, 22 collector, 8 sessioni
voce, 4 percorsi), controllo sintassi e build produzione riusciti.
Rimane warning bundle grande. Non è ancora copertura di ogni esito di
ogni feature: completare esiti import/OCR/modelli, funnel per tentativo,
misure tempi e dashboard operativa con dati reali prima di dichiararla completa.

### Verifica reale collector e significato installazioni (20 settembre)
Preflight OPTIONS reale eseguito con Node contro il collector pubblico:
status 404, Access-Control-Allow-Origin e Methods assenti. La correzione
CORS locale non è ancora distribuita. Non attestare ricezione dal browser.

Aggiunti eventi pwa_installed (browser appinstalled), standalone_opened
(anche installazioni preesistenti al prossimo avvio aggiornato) e presence
(solo foreground, intervallo minimo 120 secondi, opt-out rispettato).
La statistica installedDevicesObserved unisce i due segnali senza duplicare
lo stesso ID. I vecchi install restano intatti come firstSeenDevices:
non ricostruiscono vere installazioni. Cambio browser/storage cancellato
può produrre nuovi ID: sono contesti client, non persone uniche.

Presenza: timestamp server, finestra 5 minuti, TTL 10 minuti. KV ha consistenza
eventuale: non dichiarare online esatto/in tempo reale. Non registra la schermata
aperta, testo, importi o documenti. Il collector deve essere distribuito PRIMA
dell'app. Nessun evento sintetico scritto al collector pubblico.

27 test client e 24 test collector passati. Build produzione passata.
Wrangler installato in directory temporanea senza script di installazione;
CLI non autenticata; tentativo OAuth limitato non completato per spawn EPERM.
Nessun deploy, nessuna nuova autorizzazione concessa, nessun token copiato.

### Hotfix realmente pubblicato — 20 settembre 2026
Via Cloudflare Quick Edit, dalla sessione Chrome autorizzata, applicato SOLO
il wrapper CORS al codice di produzione esistente. Versione attiva 2b2178a3,
precedente 551fb3e6. Nessuna modifica al binding KV o agli eventi salvati.
Non confondere questo hotfix con il deploy integrale della telemetria locale:
nuovi cataloghi, presenza e rilevazione installazioni restano locali.

Verifiche HTTP sul collector pubblico dopo deploy:
- OPTIONS origine momentum-finance.pages.dev, POST/content-type: 204 con ACAO esatta e POST.
- POST JSON vuoto: 400 con ACAO corretta (nessun evento di prova salvato).
- preflight origine non autorizzata: 403 senza ACAO.
- GET /stats senza credenziale: 401 senza ACAO.

Il blocco CLI è stato aggirato con il normale editor web, non disabilitando
protezioni. Non è stata concessa una nuova autorizzazione OAuth. Accesso
alle statistiche aggregate, test di ricezione con confronto prima/dopo e
pubblicazione completa delle nuove metriche restano da completare.
Verifica successiva in dashboard KV autenticata: presenti chiavi active:2026-08
ed active:2026-09 con timestamp salvati. Storico esistente confermato in lettura;
non cancellato né riclassificato in installazioni reali. Non ancora enumerato
l'intero archivio né certificati i totali. Nessun identificatore riportato qui.

### Collector completo distribuito e ricezione verificata — 20 settembre 2026

Cloudflare Quick Edit ha pubblicato la versione attiva `c84aad16` del Worker
`momentum-telemetry`. Il codice distribuito conserva il binding KV esistente e
aggiunge il catalogo chiuso di eventi prodotto/trasferte, `pwa_installed`,
`standalone_opened`, `presence` e le statistiche aggregate corrispondenti.
La policy CORS verificata sopra resta applicata; `/stats` continua a richiedere
la credenziale server e non è reso leggibile dal browser pubblico.

Prova di ricezione reale: POST `presence` dalla stessa origine di produzione,
HTTP 200 con ACAO esatta. La ricerca autenticata nel namespace KV ha mostrato
la chiave del probe con valore `1`. Il probe usa TTL di dieci minuti e non viene
riclassificato come visita, installazione o uso di una funzione. Non contiene
dati utente. Questo prova ricezione e scrittura del nuovo tipo di evento, non
certifica ancora i conteggi generati dal client di produzione: il client locale
che emette installazione, apertura standalone e presenza deve essere pubblicato.

I record storici mai ricevuti non sono ricostruibili. Le vecchie chiavi
`install` restano prime aperture di un contesto browser; solo segnali osservati
dopo la nuova strumentazione possono alimentare `installedDevicesObserved`.

Validazione finale del checkout destinato alla pubblicazione: 394/394 file di
test passati con Node 24 in modalità seriale. La build Vite standard incontra
ancora il vincolo host `spawn EPERM`; la build portabile con esbuild WebAssembly
0.21.5, stesso target e stessa minificazione, è riuscita su 443 moduli. Restano
gli avvisi preesistenti sui chunk grandi. Il test DOM ora considera anche i
moduli UI importati da `main.js`, evitando di classificare come assente il campo
di ricerca degli accrediti che viene realmente generato dal relativo modulo.
