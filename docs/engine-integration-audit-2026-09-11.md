> Aggiornamento successivo: main d92a5dc è stato integrato e i casi limite corretti. Esito corrente, preservazione dei dati e 4.839 test / 316 file sono in [merge-validation-2026-09-11.md](merge-validation-2026-09-11.md). I riferimenti e i blocchi di autenticazione descritti sotto documentano la fase precedente.

# Motori: cosa conservare nel merge

## Perimetro verificato

Confronto a tre vie: antenato `a62ceeaf67fdbaed2785af80b88ca0134b1b810b`, main GitHub `d92a5dcd9a5a9dae7649ce4c74fd6e836adb124f`, branch UI `a2ddb0ce8867ff62ea08ea93d611634f9954e2c8` (codice `eb86338`). I riferimenti remoti sono stati riletti l'11 settembre 2026. Non è stato eseguito un merge.

La revisione copre l'elenco completo dei cambiamenti di main dall'antenato: **34 file in src**, oltre al workflow prezzi e ai documenti. Controlla inoltre le differenze locali nei modelli, mesh, ricorrenze, onboarding e piani. Non è una certificazione di ogni algoritmo storico, della correttezza normativa fiscale o del deploy.

**Decisione:** conservare gli avanzamenti di main come base dei rispettivi motori, innestare la UI del branch e mantenere i controlli locali. Non sostituire integralmente `src/main.js`, `src/ai`, `src/predict` o `src/mesh` con una delle due versioni. Un merge senza conflitto testuale può perdere un contratto applicativo.

## Matrice delle decisioni

| Area | Avanzamento verificato in main | Cosa conservare dal branch / integrazione |
|---|---|---|
| Fisco Italia | `predict/tax.js` aggiunge la cassa geometri/CIPAG alle casse già gestite. | Usare il calcolo di main negli editor rinnovati. Non ricreare formule nella UI; distinguere valori non calcolabili da zero. Questo incremento non sostituisce tutto il motore fiscale. |
| Fisco Svizzera | `computeAvsIndipendente` distingue attività accessoria; l'export internazionale propaga l'opzione. | Leggere e salvare `chAttivitaTipo`, con valori `principale`/`accessoria`; non confonderlo con `chActive`. I risultati non calcolabili e le relative note devono restare visibili. |
| Fisco Spagna | Nuovo `tax-deadlines-es.js`, scadenze Modelo 130 e priorità nel feed in `onboarding-priors.js`. | Conservare la scadenza e l'importo dichiarato stimato. Non presentare la proiezione di tre mesi come calcolo cumulativo ufficiale. Correggere il caso del giorno di scadenza descritto sotto. |
| Card fiscale Dashboard | `openTaxDiscover` instrada per Paese; il render viene aggiornato dopo la risposta. | Unire con la pertinenza della nuova UI: risposta esplicita, rifiuto rispettato, assenza per minori e per profili già configurati. Paese fiscale e lingua restano distinti. |
| Ponte commercialista | `accountant-export-structured.js` aggiunge CSV e JSON allo stesso report di calcolo; export CH aggiornato. | Riutilizzare i report esistenti; azioni di download negli editor nuovi. Proteggere i campi CSV prima del rilascio. Il CSV a sezioni non garantisce importazione automatica in qualunque gestionale. |
| Cassa Unica | Nuovo `forecast-calibration.js`: istantanee e confronto successivo fra previsione e storico. | Conservare il modulo dopo la correzione delle finestre temporali. Collegarlo alla card unificata senza duplicare la previsione. `cash-forecast.js` non è cambiato in questi commit: la novità osserva il motore, non lo riaddestra automaticamente. |
| Storico mercati | `alpha/pattern-storico.js` misura episodi su storico giornaliero; `mercato-qa.js` riconosce nuove domande. | Mantenere campione, periodo e incertezza; integrare insieme al QA locale dei pagamenti. Tradurre testo e intenti, validare parametri se esposti a form/SDK. Non rappresentare frequenze passate come probabilità garantite future. |
| Aggiornamento prezzi | `refresh-daily-long.yml` rigenera il pannello settimanalmente e apre una PR dopo test/build. | Conservare workflow e revisione dei dati. Non è uno stream live né un aggiornamento automatico del deploy. Verificare la pipeline sulla versione Node scelta per l'integrazione. |
| Centro Fiducia | `openTrustCenter` riunisce limiti, informazioni e copia dei dati. | Collegarlo al Vault rinnovato; conservare i testi tradotti di main. Riconciliare promesse Free/Pro con diritti realmente implementati. |
| Date, recupero e import | `backup.js`, `vault.js`, `week-insight.js`, `mese-strip.js` adottano utilità per date locali; test strutturali. Recupero spese, PDF e installazione includono correzioni condivise. | Unire con integrità Vault, preferenze tema, date retrodatate e test Windows del branch. Non eliminare i test di fuso per superare EPERM. Per commenti/test equivalenti evitare duplicati. |
| Telemetria | Main incorpora controllo HTTP, preferenze dopo gli await e diagnostica separata. | Preservare catalogo consentito e opt-out; conservare i test locali senza creazione ID e con disattivazione durante l'invio. Non ampliare i payload durante il merge. |
| Onboarding e personalizzazione | Main aggiunge priorità fiscali ES, conserva primo avvio esplicito e migliora la leggibilità su viewport corto. | Budget facoltativo e confermato dall'utente, storico già importato, rilevamento accrediti con confidenza, onboarding e accessi diretti della UI. La priorità del feed non deve nascondere una scadenza necessaria. |
| Ricorrenze, rate e prove | Nessuna nuova modifica al motore BNPL in questi commit di main. | Conservare le ricorrenze settimanali/quindicinali, filtri dati, annualizzazione corretta e `predict/payment-agenda.js` del branch; date dichiarate distinte dalle stime. Verificare che previsione e QA consumino la stessa agenda senza doppio conteggio. |
| Modelli di categorizzazione | Nessun nuovo cambiamento in `src/ai` di main dall'antenato confrontato. | Conservare contatore `learningExamples`, holdout scorrevole e controlli `ai/train/model-gate.js` su metriche/categorie mancanti. Non tornare al campionamento basato sul numero di parole. |
| Mesh e apprendimento distribuito | Nessun nuovo cambiamento in `src/mesh` di main dall'antenato confrontato. | Conservare `authorizePrivatePeer`, controllo del canale corrente e revoca, più `validateDistillationDigest`. La connessione a un peer non basta ad autorizzare sincronizzazione privata/pesi. Distillazione pubblica e dati personali restano percorsi distinti. |
| Split e debiti condivisi | Nessun nuovo cambiamento di main in `src/split` dall'antenato confrontato. | Conservare ID per omonimi, centesimi esatti, anticipi multipli, importi validati, link/rimborso e UI per dieci partecipanti. Non sostituire i nomi agli ID. |
| Grafo e registro fiscale | `src/graph` e `predict/tax-engine.js` non sono cambiati nei commit confrontati. | Non dedurre un nuovo motore neurale/registro collegato dalla sola data di main. Il registro fiscale non va attivato alla cieca: richiede test del percorso reale IT/CH/ES. |

## Difetti riprodotti sul main isolato

Eseguiti su una copia estratta con `git archive`, senza modificare il checkout né i dati dell'app. [Script riproducibile](audit-main-engines-repro.mjs) e [osservazioni JSON](engine-audit-observations-2026-09-11.json). Le asserzioni dello script confermano la presenza dei difetti nella versione analizzata: **non sono test di accettazione superati**. Dopo le correzioni, convertirle in regression test che richiedano il comportamento corretto.

### 1. Intervallo della verifica delle previsioni — da correggere prima di attivarlo

`snapshotForecast` conserva solo la data UTC; `evaluateSnapshot` somma dall'inizio di quel giorno fino alla mezzanotte del giorno target, inclusi gli estremi. `simulateCash` costruisce invece il percorso dal giorno successivo alla data iniziale e include i flussi del giorno target.

- Saldo iniziale 1.000 già aggiornato alle 12:00, spesa di 100 alle 09:00 dello stesso giorno: il confronto la sottrae ancora e restituisce 900.
- Spesa di 100 al giorno target: se registrata come `2026-01-08` produce 900, se registrata come `2026-01-08T09:00:00Z` produce 1.000. Stessa giornata, esiti diversi.
- Alle 00:01 del giorno target il checkpoint viene già valutato, prima di conoscere le spese del giorno. Main può anche segnarlo come già mostrato.

Contratto da definire: stessa finestra e stessa convenzione di giorno del motore di cassa, intervalli con estremo finale esclusivo, valutazione solo dopo la chiusura del giorno target. Distinguere data economica e timestamp; gestire importazioni tardive e istantanee salvate col vecchio formato. Non limitarsi a spostare una data senza testare saldo assoluto, flusso relativo, fusi e ora legale.

`calibrationSummary` si aspetta array di valutazioni, mentre `evaluateAllSnapshots` restituisce oggetti `{ takenAt, evaluations }`: un futuro pannello aggregato deve passare le `evaluations`, non direttamente l'intero risultato. Main attualmente importa solo snapshot/evaluate, non il riepilogo.

### 2. CSV: testo non confinato — da correggere prima di distribuire l'export

Un cliente sintetico `=1+1` viene esportato come cella grezza. Un emittente con newline introduce una nuova riga fuori dall'intestazione. Non è stata eseguita alcuna formula o aperto il CSV in un foglio di calcolo.

Integrare escaping coerente anche per i metadati e trattamento come testo dei campi non numerici che possono essere interpretati come formule. Preservare valori numerici contabili autentici, Unicode e decimali. Aggiungere prove per `=`, `+`, `-`, `@`, tab, CR/LF, virgolette, virgole e numeri negativi reali; verificare anche che un destinatario possa importare le sezioni previste.

### 3. Scadenza ES che scompare il giorno dovuto — da correggere prima del reminder

Con stima mensile positiva, il 19 aprile viene mostrata la scadenza del 20 aprile; il 20 aprile a mezzogiorno non viene più restituita. Il filtro `data <= oggi` elimina anche la scadenza odierna. La stessa forma di filtro è presente nel motore IT e merita il relativo test.

La UI deve distinguere oggi/futura/scaduta/pagata, senza far sparire una voce non pagata a mezzanotte. `slittaSeFestivo` gestisce soltanto sabato e domenica: la sua importazione dal modulo IT non costituisce un calendario delle festività spagnole. Nessuna verifica normativa indipendente è stata eseguita in questo audit del codice.

## Altri rischi d'integrazione rilevati dal codice

- **Parametri del pattern storico:** il percorso QA attuale passa finestre fisse di 20 giorni. L'API esportata non valida interi positivi per finestra/orizzonte né valori finiti per soglia. Con orizzonte zero, quando scatta un episodio, `i += orizzonteGiorni` non avanza. Rischio individuato staticamente, non eseguito intenzionalmente come ciclo bloccante. Necessarie guardie prima di un nuovo form/SDK e test dei parametri invalidi.
- **Multilingua dei nuovi insight:** `patternStoricoText` costruisce frasi italiane; il nuovo insight di calibrazione in `main.js` usa testi italiani e `it-IT`. Avere le chiavi ES/CH nei sette dizionari non traduce questi percorsi. Servono presentazione/intent locali e formato numeri/date coerente.
- **Piani:** il documento aggiornato `ANALISI_COMPETITOR.md` §8 propone tre livelli, esplicitamente non implementati. Main elenca export nei PRO; il branch lo lascia FREE e associa PRO al set PRO_INVESTOR. Nessuna delle due versioni chiama `hasFeature()` in `main.js`: non dichiarare gating completo. Riconciliare prodotto e diritti separatamente dal merge UI, mantenendo accesso ai dati e split già promessi gratuiti. Non attivare abbonamenti in base all'onboarding.
- **Profilo svizzero nel suggerimento piano locale:** `recommendPlan` legge `chActive`, mentre main usa `chAttivitaTipo`. L'adattamento è necessario; una risposta professionale suggerisce soltanto un piano e non attiva una licenza.
- **Limiti fiscali preesistenti:** le nuove funzionalità non dimostrano che siano risolti il modello RETA basato sul lordo, la scala AVS incompleta o il registro fiscale non collegato. Verificarli come cantieri distinti prima di annunciare copertura fiscale completa.

## Verifiche eseguite e ordine di integrazione

Su snapshot main `d92a5dc`, Node **24**, otto file: **246 test superati**, zero fallimenti, cancellati, saltati o todo. File: `forecast-calibration.test.js`, `accountant-export-structured.test.js`, `tax-deadlines-es.test.js`, `tax-ch.test.js`, `tax.test.js`, `pattern-storico.test.js`, `mercato-qa.test.js`, `onboarding-priors.test.js`. Non sono 246 test nuovi scritti per questa revisione: sono la suite mirata già presente in main. Il log integrale locale è `../audit-main-engines-tests.log` rispetto al repo e non viene pubblicato come artefatto di produzione.

SHA-256 del log: `ef30989eb8845187296d005b3f189b0e9ebbb92904dafffde277413fc03ddbc5`.

```sh
# Dalla copia isolata di main, con Node 24:
node --no-experimental-global-navigator --test --test-isolation=none src/predict/forecast-calibration.test.js src/predict/accountant-export-structured.test.js src/predict/tax-deadlines-es.test.js src/predict/tax-ch.test.js src/predict/tax.test.js src/alpha/pattern-storico.test.js src/alpha/mercato-qa.test.js src/predict/onboarding-priors.test.js
# Dal branch UI, indicando la copia isolata:
node docs/audit-main-engines-repro.mjs ../audit-main-d92a5dc
```

1. Partire dal main aggiornato al momento dell'integrazione, riverificando gli SHA e questo delta.
2. Portare controlli locali di integrità, modelli, mesh e pagamenti; conservare gli avanzamenti fiscali/mercato di main. Correggere i difetti riprodotti nei relativi motori prima dell'attivazione in UI.
3. Innestare editor e layout per flusso, con contratti IT/ES/CH, non copiando tutto `main.js`. Un solo dato di saldo/agenda/report deve alimentare le diverse viste.
4. Riconciliare lingua, stato del profilo e politica Free/Pro; i controlli di pertinenza non equivalgono a permessi di abbonamento.
5. Rieseguire suite completa, build, prove dei flussi su mobile/tablet/desktop e checkpoint nativi. I 4.767 test del branch e i 246 di main non certificano il risultato del merge e non vanno sommati come test unici.

Questa consegna aggiunge audit e riproduzioni, **non incorpora main nel codice UI e non modifica l'app in produzione**. Rimangono validi i 13 conflitti documentati nell'[handoff](integration-handoff-2026-09-11.md). Il push precedente è bloccato dall'autenticazione: non confondere i commit locali con la loro disponibilità su GitHub.
