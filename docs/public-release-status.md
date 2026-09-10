# Preparazione del rilascio — 10 settembre 2026

Questo ramo contiene un primo blocco di correzioni e una base SDK sperimentale.
Non certifica la preparazione alla pubblicazione commerciale o agli store.
Il calendario non è stato modificato; l'utente autorizza ora miglioramenti motivati.

## Implementato e verificato

| Area | Comportamento nuovo | Verifica |
|---|---|---|
| Telemetria | Dal 7 settembre: attiva di default su richiesta esplicita dell'utente; opt-out persistente. Un errore HTTP non viene registrato come invio riuscito. | Test default, disattivazione anche durante invio, HTTP 400/429/500/503 e successivo tentativo |
| Chat esterna | Riepilogo finanziario solo con `chatContextOptIn === true`; saldo mensile non più sostituito dal residuo settimanale. | Controllo codice e toggle nel browser |
| PDF | `isEvalSupported: false` in tutti e tre i punti di apertura PDF. | Ricerca delle chiamate e build; è una mitigazione, non l'aggiornamento completo della libreria |
| Apprendimento locale | Contatore degli esempi separato dai token; un holdout ogni dieci osservazioni, buffer limitato a 100. | Test del blocco a `totalWords=9`, riavvio e buffer pieno |
| Promozione modelli | Report senza categorie, con valori non finiti o copertura incompleta vengono rifiutati. | Test della media alta con categoria mancante |
| Mesh privata | Nessuna lettura/invio/merge diretto di dati personali o modelli grezzi senza policy esplicita di autorizzazione. | Peer non autorizzato, revoca, policy difettosa e 498 test mesh al primo controllo |
| Apprendimento condiviso | Distillazione pubblica e lessico opt-in restano presenti; aggiunti controllo dello schema delle sonde/categorie e limite di 10 tentativi di contribuzione ogni 7 giorni. | Test dello schema e suite completa |
| SDK gradienti | Consenso, firma, chiavi ammesse, round/versione, dimensioni, clipping, quorum, deduplicazione per firmatario e aggregazione mediana. | 5 test, incluso gradiente reale di un modello lineare su dati sintetici |
| Primo avvio | Area domande adattata allo schermo, passaggi nascosti non raggiungibili da tastiera, focus sul titolo. Rimossa la creazione anticipata di un worker OCR mai riusato. | Chrome, 390×844, sette sessioni nuove IT/EN/DE/FR/ES/NL/PT |
| Accessibilità | Zoom nuovamente permesso. | Meta viewport e browser |
| RETA ordinaria ES | Inclusi cese de actividad e formazione: aliquota totale 31,5%. | Fonte ufficiale e caso base 1.437,91 → quota 452,94 |
| Distribuzione web | Aggiunti nosniff, no-referrer, anti-framing e CSP limitata a frame/object/base. | File di configurazione incluso nella build; header remoti da verificare dopo deploy |
| CI | Test sorgenti/server e build su PR e main, Node 24. | Esecuzione locale equivalente; esito remoto da leggere su GitHub |

**Ultima suite locale:** suite applicativa completa e 19 test del worker superati,
zero fallimenti. Build Vite di produzione riuscita. Il modello Nano è ora caricato
come chunk asincrono: il bundle iniziale è sceso da circa 4,67 MB (1,58 MB gzip) a
2,38 MB (795 KB gzip). I dataset e i modelli più pesanti restano caricati su richiesta.

Le verifiche browser usano Chrome installato, risorse CDN già acquisite e CSS compilato
del progetto. La precedente verifica senza eventi al primo avvio riguardava il vecchio
default opt-in. Il 7 settembre sono stati verificati default attivo (tre eventi iniziali),
opt-out già salvato (zero eventi), disattivazione e persistenza al ricaricamento;
endpoint intercettato, senza inviare eventi di test al servizio reale. Copertura precedente: ingresso, scelta età, prima
e seconda domanda e preferenze privacy. Non equivalgono a collaudo completo su dispositivi
fisici, Safari/WebKit, Firefox, import bancari reali o servizi esterni live.

## Come resta condivisa l'intelligenza

Ci sono tre canali distinti:

1. **Informazioni pubbliche e distillazione:** restano trasportabili nella mesh. La
   partecipazione alla distillazione/lessico richiede l'opzione di apprendimento condiviso.
2. **Dati personali tra propri dispositivi:** il canale diretto ora fallisce chiuso.
   Il collegamento WebRTC e una chiave annunciata non provano il possesso della chiave.
   Integrare sfide firmate legate alla sessione, revoca, scadenza e test di replay prima
   di riattivarlo. La policy non viene abilitata automaticamente in `main.js`.
3. **Gradienti per integrazioni istituzionali:** `src/sdk/federation.js` è una base
   eseguibile separata, senza rete automatica e senza accesso al vault. Non è ancora
   collegata al training dei modelli dell'app. Contratto e limiti in `src/sdk/README.md`.

Le chiavi dei contributori del SDK devono provenire da un registro indipendente. Nella
mesh pubblica gli ID di peer non dimostrano ancora identità indipendenti: restano aperti
attestazione, resistenza Sybil e verifica dei contributi lessicali. Il limite degli invii
è un contatore operativo, **non** un budget di differential privacy. Firme, clipping,
sonde pubbliche e mediana non certificano anonimato o assenza di inferenza sui modelli.

## Analisi del PDF fornito dall'utente

Letto il testo di tutte le 66 pagine di «Audit app e mercato.pdf», con controllo visivo
del caso numerico ES a pagina 41. È un audit precedente con proposte, non una fonte
normativa o un'autorizzazione a cambiare prezzi, nome, calendario o accesso ai minori.

- **Confermati:** contraddizione della telemetria, contesto chat implicito, mancanza di
  CI generale, target Android 35, iOS assente, aliquota RETA ordinaria incompleta.
- **Confermati come limiti del codice da approfondire:** adapter CH che annualizza le
  entrate senza separare il reddito d'impresa; RETA/IRPF di periodo semplificati; selezione
  fiscale italiana nell'onboarding globale. Le relative formule non sono state rifatte
  in questo blocco: servono fonti, scenari e dati di input adeguati.
- **Da verificare autonomamente prima di modificare le regole:** dettaglio dei casi
  forfettario 85k/100k, ATECO 2025, scala AVS, eccezioni ES e workflow dichiarativi.
- **Ipotesi commerciali, non fatti dimostrati:** voti su dieci, percentuali di automazione,
  disponibilità a pagare, stime di acquisizione e prezzi proposti. Non diventano claim UI.
- **Direzione mantenuta:** prodotto globale, lingua separata dal Paese fiscale, primi
  moduli fiscali IT/ES/CH, semplicità progressiva e apprendimento condiviso. La proposta
  del PDF di restringere il prodotto all'Italia o adottare automaticamente più abbonamenti
  non sostituisce la richiesta dell'utente.

## Ordine dei prossimi blocchi

### P0 — prima della distribuzione ampia

1. Completare autenticazione della sessione mesh e identità dei contributori; prove
   avversarie del protocollo, autorizzazione per gruppo e isolamento dei carichi privati.
2. Aggiornare PDF.js e le altre dipendenze/CDN, eliminare gli script inline per una CSP
   restrittiva, verificare XSS e storage delle chiavi, import/backup/ripristino e aggiornamenti PWA.
3. Correggere gli input e le formule fiscali IT/ES/CH con test di confine e fonti
   versionate. Nessuna promessa di fiscalità completa o sostituzione del professionista.
4. Separare onboarding per bisogni e Paese fiscale. Due livelli commerciali Free/Pro:
   proposta di piano basata sulle funzioni richieste; pagamento e attivazione espliciti.
   La base gratuita deve includere gestione ordinaria, accesso ed esportazione dei dati.
   Il catalogo locale ora include esportazione, calendario, obiettivi, divisione spese
   e vista completa nel Free; Pro comprende anche le analisi prima riservate a Investor.
   Le licenze Investor esistenti restano riconosciute. Il suggerimento richiede attività
   fiscali configurate o un portafoglio, esclude i minori e non attiva licenze.
   Il gating completo e i pagamenti store non sono ancora implementati.
   Nell'onboarding la vista essenziale/completa è ora una scelta esplicita e reversibile:
   il default non dipende più dall'età. Il confronto piani ha due pannelli leggibili;
   i controlli hanno focus visibile e rispettano la riduzione del movimento.
5. Allineare informative e dichiarazioni store alla build e ai servizi realmente attivi;
   verificare nome/dominio, supporto e perimetro finanziario con i responsabili appropriati.

### P1 — distribuzione nativa e qualità del prodotto

6. Android: API 36 e toolchain compatibile, test delle variazioni di comportamento,
   secure storage, Billing, build firmata e closed testing. La configurazione della
   firma appena arrivata da main è conservata; nessun keystore viene creato/pubblicato qui.
7. iOS: lo scaffold Capacitor SPM è presente; restano Xcode/signing, Keychain,
   StoreKit, notifiche, import nativo e TestFlight. Windows non fornisce una verifica
   di build iOS; il workflow macOS esegue la build simulator senza firma a ogni PR.
8. Flussi completi e accessibilità su browser/dispositivi reali; budget di prestazioni,
   caricamento differito dei moduli e localizzazione fiscale oltre alla traduzione UI.

### P2 — SDK bancario e crescita verificabile

9. Registro tenant/chiavi, contratti di modello, round persistenti, trasporto autenticato,
   secure aggregation/DP misurata, training reale integrato, canary e rollback.
10. Continuità dei job tramite nodi autorizzati e checkpoint: nessuna promessa di esecuzione
    infinita su una PWA o un'app mobile chiusa. Prove di perdita rete, batteria e riavvio.

## Fonti primarie verificate il 6 settembre 2026

### Avanzamento nativo, installazione e interfaccia

- Android allineato alla guida Capacitor 8: API 36, minimo 24, AGP 8.13.0,
  Gradle 8.14.3 e librerie AndroidX aggiornate. Aggiunto `density` ai cambi di configurazione.
- Creato progetto iOS SPM con Capacitor CLI installata; versione 50.1.0, deployment
  target iOS 15.0. Nessuna firma, archivio App Store o build Xcode eseguita su Windows.
- Workflow locali per build Android debug/lint e iOS simulator senza firma; non eseguiti
  su GitHub, in rispetto della richiesta di non effettuare push.
- Installazione diretta basata sull'evento browser realmente disponibile; consumo singolo
  del prompt, protezione dal doppio tap, fallback alla guida. Riconoscimento iPad in modalità desktop.
- Pulsante di installazione anche nell'onboarding; guida con passi numerati e tipografia
  leggibile. Identità e scope del manifest espliciti; orientamento non più bloccato.
- Modali con ruolo dialog, nome, focus contenuto, Esc e ripristino del focus; sfondo inert.
  Selettori della vista convertiti in pulsanti nativi con aria-pressed e chiusura tradotta.
- Finiture grafiche su onboarding, campo budget e installazione; stati focus/pressione,
  transizioni brevi e rispetto di prefers-reduced-motion. Nessun ridisegno globale dichiarato.
- QA locale su Chrome e WebKit: 320×568, 390×844, 768×1024, 1440×900; percorso adulti/minori,
  budget assente/esplicito, focus modale, tastiera, nessuno scroll interno nella profilazione.
  Prompt di installazione simulato per verificare il doppio tap: non è una prova di installazione OS.
- Rimangono build native effettive, prove Safari/VoiceOver e TalkBack su dispositivi,
  audit WCAG 2.1 AA completo, pagamenti store e dichiarazioni privacy della build finale.

- [Capacitor — migrazione alla versione 8](https://capacitorjs.com/docs/updating/8-0).
- [Apple — aggiungere una web app alla Home](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios).
- [W3C — criteri WCAG 2.1](https://www.w3.org/WAI/WCAG22/quickref/?versions=2.1).

- [Mozilla — vulnerabilità PDF.js e mitigazione isEvalSupported](https://github.com/mozilla/pdf.js/security/advisories/GHSA-wgrm-67xf-hhpq).
- [Seguridad Social — basi e cinque componenti RETA 2026](https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/CotizacionRecaudacionTrabajadores/36537).
- [Google Play — target API 36](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en).
- [Google Play — Data safety, dati pseudonimi e raccolta opzionale](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en).
- [Apple — App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).
