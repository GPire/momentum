# Accesso e collaborazione aziendale per Momentum

## Decisione consigliata

Momentum dovrebbe conservare l'uso personale locale senza account obbligatorio e attivare un servizio condiviso soltanto per il lavoro aziendale. Per il prodotto destinato a molte aziende, la soluzione consigliata è un livello di identità sostituibile, basato su standard, separato dai ruoli e dai processi proprietari di Momentum. Cloudflare Access può restare l'adattatore del pilota: non dovrebbe diventare un vincolo economico per tutti i futuri dipendenti.

La combinazione proposta è: passkey per chi non ha un'identità aziendale, accesso aziendale federato per chi ne dispone, autorizzazioni Momentum, resoconti versionati, allegati caricati una sola volta e notifiche originate da eventi persistenti. Si tratta di un'architettura da implementare e verificare, non di un servizio già disponibile. La verifica dei prezzi e delle fonti è riferita al 14 settembre 2026.

La proprietà intellettuale difendibile risiede nel percorso che elimina ricompilazioni, distingue correzioni da duplicati e collega ogni decisione ai dati esatti. Non occorre inventare una nuova crittografia. Non è dimostrata la brevettabilità della combinazione proposta, né un primato mondiale.

## Cosa significa davvero gratis

Esistono quattro condizioni diverse: software senza costo di licenza, servizio ospitato entro quote gratuite, utilizzo dell'infrastruttura già pagata dall'azienda e assenza di costo marginale per una singola operazione. Nessuna di queste implica gratuitamente utenti illimitati, assistenza, conservazione pluriennale, recupero dei dati e disponibilità contrattuale.

Il costo totale comprende identità, calcolo, database, allegati, notifiche, backup, monitoraggio, manutenzione e supporto. Aggiungere il tempo degli amministratori clienti è essenziale: una soluzione che risparmia cinque dollari ma richiede configurazioni frequenti può essere peggiore per una PMI. Le stime sotto isolano componenti specifici, non rappresentano preventivi completi.

La ricerca confronta alternative pertinenti al codice esistente. Non dimostra quale sia il prezzo minimo assoluto di ogni fornitore al mondo, soprattutto per contratti negoziati o licenze già possedute dai clienti.

## Alternative per l'identità

| Opzione | Gratuità verificata o natura del costo | Impiego sensato per Momentum | Limite determinante |
|---|---|---|---|
| Cloudflare Access | Piano gratuito per piccoli team; pagina commerciale indica sotto 50 utenti. Piano a consumo indicato a 7 USD/utente/mese, pagamento annuale | Pilota già vicino al codice attuale | Costo per posto e limite condiviso dell'account, non moltiplicato automaticamente per azienda |
| Supabase Auth | Free: 50.000 utenti attivi mensili; SAML escluso dal piano gratuito | Avvio gestito con accessi ordinari | Email di produzione, inattività e quote; SSO non equivale all'accesso social |
| Firebase / Identity Platform | Distinguere prodotto base e upgrade. Identity Platform: quote diverse per accessi ordinari e SAML/OIDC | Alternativa gestita per ampia utenza | Prezzo e quote dipendono dal metodo; non chiamare tutti gli accessi gratuiti |
| Keycloak gestito dall'azienda | Software open source, supporto OIDC/SAML | Clienti con reparto IT e requisiti di gestione propria | Hosting, aggiornamenti, backup e reperibilità rimangono a carico di qualcuno |
| Passkey Momentum su WebAuthn | Nessun servizio SMS obbligatorio per ogni accesso | Percorso proprietario senza password per utenti invitati | Registrazione, verifica server, recupero account, abuso e gestione sessioni da realizzare |

Cloudflare descrive un piano da 7 USD per utente al mese con pagamento annuale. A 1.000 posti, la semplice moltiplicazione vale 7.000 USD/mese equivalenti, prima di eventuali condizioni negoziate. Non è una stima basata sugli utenti attivi mensili: posti Access e MAU sono metriche diverse. Non si devono creare account artificiali per eludere quote. [^1]

Supabase offre 50.000 MAU ordinari sul piano gratuito, ma i progetti gratuiti possono essere sospesi dopo una settimana di inattività. Il prezzo Pro parte da 25 USD/mese. SAML è separato: sul Pro sono inclusi 50 SSO MAU, poi 0,015 USD per SSO MAU aggiuntivo. L'accesso alla dashboard Supabase è un'altra funzione rispetto al login degli utenti Momentum. [^2][^3]

L'SMTP predefinito Supabase è destinato a uso non produttivo: al momento della verifica è limitato a due messaggi l'ora, con destinatari limitati e senza garanzia di consegna. Un piano Auth gratuito non elimina automaticamente il costo di un servizio email affidabile. [^4]

Firebase documenta che l'upgrade a Identity Platform introduce, sul piano Spark, 3.000 utenti attivi giornalieri per molti provider e due per SAML/OIDC. Sul piano Blaze la quota senza costo per accessi ordinari è 50.000 MAU, mentre per SAML/OIDC è 50. Anche questa opzione richiede quindi un modello economico distinto per l'utenza enterprise. [^5]

Keycloak supporta OIDC, OAuth2 e SAML; può essere usato senza progettare un protocollo di autenticazione nuovo. È una buona opzione di distribuzione gestita dal cliente, ma non il percorso più semplice da imporre a una microimpresa senza personale tecnico. [^6]

## Un metodo Momentum su standard affidabili

Il percorso suggerito per il dipendente è: aprire un invito, riconoscere l'azienda, accedere con il metodo predisposto, vedere soltanto i propri resoconti e le azioni richieste. Per chi usa una passkey, il dispositivo presenta il proprio controllo di sblocco; non si promette che sia sempre il riconoscimento facciale. Il nome del metodo tecnico resta secondario nella UI.

WebAuthn fornisce credenziali a chiave pubblica legate al sito. Non prova da solo che una persona lavori per una certa azienda, né sostituisce l'ammissione nell'organizzazione. Momentum deve collegare una credenziale a un'identità già ammessa mediante invito verificato o identità aziendale, poi verificare le autorizzazioni a ogni operazione. [^7]

Per la realizzazione si può valutare SimpleWebAuthn, che separa generazione e verifica delle risposte di registrazione/autenticazione. La compatibilità della versione scelta con Workers va collaudata: la disponibilità della libreria non costituisce un test sul runtime di Momentum. Per OIDC si devono usare librerie mantenute, callback rigorose, PKCE e controlli coerenti con le raccomandazioni OAuth attuali. [^8][^9]

La proposta prevede un identificativo interno stabile della persona e una tabella di identità esterne indicizzate da coppia emittente/soggetto. Due provider possono usare lo stesso valore di soggetto: non si possono unire automaticamente. Neppure due email uguali costituiscono da sole una regola sicura di fusione. Inviti, recupero e collegamento di account devono lasciare una traccia verificabile.

Il cambio del provider non deve rinumerare spese o riscrivere chi ha approvato uno storico. La migrazione del prototipo deve quindi precedere l'accettazione di più emittenti. Attualmente `access.js` accetta un solo emittente Cloudflare configurato e la membership usa il suo soggetto; ampliare soltanto la regex del dominio sarebbe insufficiente.

Per il recupero, prevedere una seconda passkey o un percorso assistito dall'amministratore, con revoca delle sessioni precedenti e registrazione dell'operazione. Per aziende con SSO, un account disabilitato dal cliente non deve rientrare attraverso un recupero personale più debole. Un invito inoltrato non deve trasformarsi in un diritto aziendale per chiunque lo apra.

Questa strada riduce la dipendenza da una tariffa per posto, ma aggiunge responsabilità operative. Prima di farne il login pubblico sono necessari collaudi di replay, revoca, recupero, rotazione chiavi, isolamento tra aziende, sessioni concorrenti e dispositivi persi. La priorità è ottenere un accesso affidabile, poi misurarne il costo; non riscrivere subito tutto il prototipo.

## Allegati: dove ottenere risparmi concreti

La modifica più urgente è separare i file dal JSON dei resoconti. Il prototipo attuale limita l'intero invio a 256 KiB e incorpora immagini nel documento: aumentare soltanto quel limite non risolve copie ripetute, interruzioni o crescita dello storico.

Ogni allegato dovrebbe avere un identificativo, hash dei byte, dimensione e tipo verificati, proprietario aziendale e stato di caricamento. Il resoconto approvabile contiene un manifesto degli allegati. Se cambia un file, cambia il manifesto e quindi l'impronta del documento. L'hash prova l'identità dei byte, non l'autenticità fiscale della ricevuta.

Il caricamento avviene prima della finalizzazione: un upload interrotto rimane incompleto e non produce un resoconto apparentemente consegnato. Una ripetizione ritenta le parti mancanti. Il server deve verificare che tutti i riferimenti appartengano alla stessa azienda, siano leggibili e corrispondano ai file ricevuti. Gli oggetti temporanei scaduti vanno rimossi con una procedura controllata.

La deduplicazione va limitata all'azienda, senza rivelare se un file esista presso un altro cliente. L'originale rimane disponibile: anteprime leggere e compressione migliorano la consultazione, ma non devono sostituire silenziosamente il documento che l'utente ha caricato. Anche conservazione, blocchi di cancellazione e copie di backup vanno concordati, non dedotti da una soglia di costo.

R2 Standard include 10 GB-mese, un milione di operazioni A e dieci milioni B al mese; il trasferimento in uscita non è tariffato. Oltre la quota, lo storage è 0,015 USD/GB-mese, con costi separati per operazioni. La classe Infrequent Access ha condizioni differenti: non usarne il prezzo inferiore per promettere risparmi automatici. [^10]

### Scenari indicativi di conservazione

Ipotesi di calcolo: dieci ricevute per dipendente al mese, 0,5 MB decimali ciascuna, dodici mesi conservati, un solo originale, senza anteprime o backup. Si considera il volume a regime mantenuto per un mese intero, non la fattura del primo mese di crescita. La quota gratuita è ipotizzata interamente disponibile per Momentum.

| Dipendenti | Ricevute nuove/mese | Volume a regime | Solo storage R2 Standard/mese |
|---:|---:|---:|---:|
| 30 | 300 | 1,8 GB | 0 USD |
| 300 | 3.000 | 18 GB | 0,12 USD |
| 3.000 | 30.000 | 180 GB | 2,55 USD |
| 30.000 | 300.000 | 1.800 GB | 26,85 USD |

Formula: `max(0, volume_GB - 10) × 0,015`. Le operazioni, il calcolo, l'identità, i backup, la scansione dei file e il supporto sono esclusi. A cinque MB per file il volume diventa dieci volte maggiore. Le quote di R2 sono dell'account e la fatturazione applica arrotondamenti: la tabella non è una promessa commerciale. Il CSV allegato rende esplicite tutte le ipotesi.

Workers Free include 100.000 richieste al giorno e 10 ms di CPU per invocazione. Il piano a pagamento ha una base indicata di 5 USD/mese. La verifica crittografica, la scansione documentale e l'elaborazione dei file devono essere misurate sul runtime: i test locali non dimostrano che il piano Free basti. [^11]

D1 include sul Free cinque milioni di righe lette e 100.000 scritte al giorno, con cinque GB complessivi. Si contano righe lette, non semplicemente chiamate API. Servono indici per azienda e stato, paginazione e misurazione dei consumi; un polling frequente o una scansione completa può consumare quote senza aggiungere valore. [^12]

## Notifiche e funzionamento senza app aperta

La fonte di verità deve essere un evento persistito insieme alla decisione, non la notifica. Il dipendente trova l'esito nella casella anche se non concede il permesso alle notifiche o se una consegna fallisce. Una coda di uscita con ritentativi registra separatamente creazione, tentativo e risultato.

Per contenere costi e rumore, proporre una notifica quando serve un'azione, un riepilogo per eventi non urgenti e aggiornamento in primo piano della casella. Su schermata bloccata mostrare un testo generico, senza importi, ricevute o note del responsabile. La conferma dell'utente alla notifica è diversa dalla ricezione del resoconto e dalla sua approvazione.

WebKit documenta Web Push per web app aggiunte alla schermata Home e richiesta del permesso mediante interazione dell'utente. Questo non equivale a un worker che resta attivo continuamente. Per Capacitor va verificato separatamente il percorso nativo, senza presumere che il WebView abbia lo stesso comportamento della PWA installata. [^13]

Un servizio di invio email può restare un'opzione di recupero o riepilogo. Riutilizzare SMTP o identità del cliente può ridurre la fattura Momentum, ma trasferisce configurazione e responsabilità al cliente; non deve diventare requisito per l'uso base.

## Sostituire o affiancare i gestionali

SAP Concur possiede già verifiche di policy, audit e stati di approvazione. Presentare queste funzioni come un'invenzione esclusiva di Momentum sarebbe errato. La documentazione SAP descrive anche notifiche e gestione degli esiti; l'opportunità competitiva da validare è ridurre errori, tempi e ricompilazioni, non limitarsi ad aggiungere un pulsante Approva. [^14]

Le esigenze più importanti da verificare con dipendenti, responsabili e amministrazione sono: fotografare una volta sola, vedere cosa manca prima dell'invio, sapere chi deve agire, correggere solo ciò che è cambiato, distinguere spesa personale da aziendale e conoscere lo stato del rimborso. Sono ipotesi di prodotto motivate dal percorso analizzato, non una statistica rappresentativa degli utenti dei concorrenti.

Momentum dovrebbe avere un modello comune di resoconto con adattatori separati. Ogni adattatore dichiara ciò che supporta: spese, allegati, categorie, centri di costo, imposte, stati e cancellazioni. Un file esportato non è un'integrazione bidirezionale; un HTTP 200 non dimostra che tutte le spese siano contabilizzate.

| Destinazione | Evidenza verificata | Implicazione |
|---|---|---|
| SAP Concur | Documentazione OAuth2 e procedure per accesso API | Collegamento subordinato a credenziali, permessi e capacità dell'ambiente cliente |
| Zoho Expense | API con OAuth e organizzazione destinataria | Conservare scope, regione e mapping dell'organizzazione; verificare quote del piano |
| Expensify | Integration Server richiede coppia di credenziali generata dall'account | Segreto nel servizio, mai nella PWA distribuita |
| Rydoo | Integrazioni tramite API e SFTP dichiarate dal fornitore | Verificare disponibilità contrattuale e schema con il cliente; non presumere accesso gratuito |

Le fonti provano l'esistenza delle interfacce, non l'abilitazione di un account Momentum. [^15][^16][^17][^18]

Il protocollo proprietario di consegna dovrebbe usare un identificativo stabile composto da azienda, resoconto, revisione e destinazione. Conservare ID remoto, hash inviato, tentativi e ricevuta. Dopo un timeout, verificare lo stato remoto prima di duplicare l'operazione. Se il fornitore non consente questa verifica, mostrare consegna da verificare invece di un successo inventato.

Per una sostituzione completa occorrono inoltre deleghe temporanee, separazione tra chi spende e chi approva, più entità aziendali, centri di costo, riconciliazione, rimborsi parziali, export contabile e gestione degli accessi cessati. Le regole fiscali specifiche di ciascun paese e le procedure di conservazione richiedono un'analisi dedicata: questo rapporto non ne certifica la conformità.

## Distribuzione raccomandata

Offrire un servizio ospitato predefinito per PMI e una distribuzione gestita dal cliente per organizzazioni che la richiedono. Entrambe devono usare lo stesso modello di resoconto e test di compatibilità. Non creare una variante di prodotto per ogni cliente: le differenze devono stare in configurazioni validate e adattatori documentati.

Un dominio stabile va scelto prima di registrare passkey e callback: cambiare l'identità del sito ha conseguenze di migrazione. Il prototipo è same-origin; spostare soltanto il Worker su un sottodominio non rende automaticamente corretti cookie, CORS e redirect. Occorre progettare e collaudare il percorso completo, senza allargare indiscriminatamente le origini consentite.

Non rendere la rete mesh l'autorità unica dei permessi aziendali. Un dispositivo offline non può conoscere immediatamente una revoca appena avvenuta. La mesh può aiutare nella preparazione e nel trasferimento autorizzato, mentre decisioni e revoche aziendali necessitano di un'autorità verificabile e raggiungibile. Il servizio può essere gestito dal cliente: rimane comunque un servizio, anche se non ospitato da Momentum.

## Stato del codice e lavoro prioritario

Nel repository esistono controllo JWT Access, membership per azienda, policy immutabili, inviti nominativi, resoconti versionati, casella del responsabile e lettura manuale dell'esito nell'app. La correzione Essenziale/Completa è indipendente da questo servizio. I collaudi descritti nei documenti precedenti sono locali, non una distribuzione aziendale autenticata.

Il percorso di implementazione consigliato è sequenziale:

1. Separare gli identificativi interni dalle identità del provider, con migrazione verificabile e mantenimento dell'adattatore Access.
2. Introdurre manifesto allegati versionato e upload riprendibile, preservando import e lettura degli archivi precedenti. Testare file corrotti, riassegnazioni tra aziende e invii incompleti.
3. Aggiungere eventi di decisione e coda notifiche persistente, con interfaccia che distingue in attesa, ricevuto, da correggere, approvato e rimborso confermato.
4. Collaudare un pilota reale con due ruoli e due dispositivi, inclusi perdita di rete e modifica successiva all'approvazione.
5. Introdurre passkey e/o un adattatore gestito alternativo, dopo verifica del costo operativo e del recupero account.
6. Attivare un solo connettore con un account di prova autorizzato, verificare ricevuta remota e riconciliazione, poi estendere agli altri.

Il costo ridotto non giustifica saltare il passaggio quattro. Senza account esterno, i test di contratto sono utili ma non costituiscono integrazione funzionante. Non è stato attivato alcun abbonamento o connettore nell'ambito di questa ricerca.

## Come misurare il vantaggio

Confrontare gli stessi compiti su utenti con ruoli equivalenti: prima trasferta, dieci ricevute, errore di categoria, richiesta di correzione, approvazione e verifica del rimborso. Misurare tempo, errori, abbandoni, richieste di assistenza e percentuale di invii riusciti al primo tentativo. Registrare dispositivo, lingua e familiarità, senza raccogliere importi o documenti per semplici metriche di utilizzo.

Non fissare come risultato già acquisito una conversione del 97% o superiorità su tutti i concorrenti. Scegliere soglie interne, misurarle e correggere i passaggi che falliscono. Il vantaggio proposto è rendere chiaro e affidabile il lavoro anche quando qualcosa va storto: rete assente, documento modificato, manager assente o gestionale remoto indisponibile.

## Fonti

Fonti ufficiali consultate il 14 settembre 2026; prezzi in USD, imposte e contratti negoziati esclusi. Le pagine senza data editoriale esplicita sono identificate dalla data di consultazione. Le proposte architetturali e le simulazioni sono analisi Momentum, non dichiarazioni dei fornitori.

[^1]: Cloudflare, [Access: prezzi](https://www.cloudflare.com/sase/products/access/).
[^2]: Supabase, [Pricing & Fees](https://supabase.com/pricing).
[^3]: Supabase, [Monthly Active SSO Users](https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users-sso).
[^4]: Supabase, [Send emails with custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
[^5]: Google Firebase, [Authentication e Identity Platform](https://firebase.google.com/docs/auth).
[^6]: Keycloak, [Planning for securing applications and services](https://www.keycloak.org/securing-apps/overview), [progetto](https://www.keycloak.org/).
[^7]: W3C, [Web Authentication Level 3](https://www.w3.org/TR/webauthn-3/).
[^8]: SimpleWebAuthn, [server package](https://simplewebauthn.dev/docs/packages/server).
[^9]: IETF, Lodderstedt et al., gennaio 2025, [RFC 9700: OAuth 2.0 Security Best Current Practice](https://www.rfc-editor.org/rfc/rfc9700.html).
[^10]: Cloudflare, aggiornamento indicato 7 agosto 2026, [R2 Pricing](https://developers.cloudflare.com/r2/pricing/).
[^11]: Cloudflare, [Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/).
[^12]: Cloudflare, [D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/).
[^13]: WebKit, [Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
[^14]: SAP, [Expense Report Approval Overview](https://help.sap.com/docs/concur-expense/concur-expense-standard-edition-end-user-help/expense-report-approval-overview), [Concur Audit](https://www.concur.com/products/intelligent-audit).
[^15]: SAP Concur, [OAuth2 Getting Started](https://developer.concur.com/api-reference/authentication/getting-started.html).
[^16]: Zoho Expense, [API Authentication](https://www.zoho.com/expense/api/v1/authentication/), [Introduction](https://www.zoho.com/expense/api/v1/introduction/).
[^17]: Expensify, [Integration Server API Reference](https://integrations.expensify.com/Integration-Server/doc/index.html).
[^18]: Rydoo, [Integrations](https://www.rydoo.com/integrations/).

Evidenza locale: `server/company/access.js`, `schema.sql`, `reports.js`, `inbox-page.js`, `src/trips/company-submit.js`, `src/trips/review-fingerprint.js`, `wrangler.example.toml`. Questi file descrivono il prototipo e non provano l'esistenza di risorse cloud configurate.
