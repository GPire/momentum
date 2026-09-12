# Momentum — contesto per chi subentra (persone e AI)

> **Ultima integrazione locale 2026-09-12:** commit applicativo `443c23a`,
> lista da 8 movimenti, correzioni viewport/tastiera/importo, rinomina delle
> categorie senza cambiare ID e 10 icone nuove. 4.893 test / 322 file e build
> passati localmente. Push bloccato (rete Git e autenticazione connettore);
> non è ancora nell'anteprima online. Collaudo UI/browser non completato.
> Leggere [command-center-touch-2026-09-12.md](docs/command-center-touch-2026-09-12.md).

> **Revisione del 2026-09-12:** `main` è `adc8a66`, release precedente integrata.
> Il branch `codex/data-learning-continuity` aggiunge test storici v7.0/v7.1,
> protezioni del ripristino, conservazione dei pesi appresi e controlli mesh.
> Commit applicativo `758f90c`: **4.889 test, zero fallimenti/skip**, build web,
> Android build/lint e iOS Simulator con SDK 27 passati in CI. PR #2 in bozza:
> manca il collaudo visivo del ripristino tramite upload, bloccato dal browser.
> Leggere [data-learning-mesh-audit-2026-09-12.md](docs/data-learning-mesh-audit-2026-09-12.md)
> per risultati, limiti e lavoro residuo. Non dichiarare provata ogni vecchia
> versione o tutti i dispositivi. Non cambiare le formule fiscali per analogia.

> **Integrazione precedente, 2026-09-11:** integrazione di main `d92a5dc` nel branch
> UI completata per sezione; 13 conflitti risolti, casi limite dei motori corretti.
> Suite finale su `66602c7`: **4.846 test / 317 file, zero fallimenti o skip**;
> build web standard, Android e iOS Simulator SDK 27 passati in CI. Corretto
> anche il reload delle anteprime e il grafo delle associazioni simmetriche.
> Leggere prima [merge-validation-2026-09-11.md](docs/merge-validation-2026-09-11.md)
> per i controlli sui dati e i limiti del checkpoint. I conteggi e i conflitti
> descritti nei riquadri successivi sono precedenti a questa integrazione.
> Nessun reset degli archivi o fusione arbitraria dei pesi ML è autorizzato.
> Il sottodominio di anteprima ha dati separati dal dominio di produzione.

> **Questo file è la fonte di verità condivisa.** Lo leggono Codex/altri agenti
> (convenzione `AGENTS.md`) e Claude Code (via `CLAUDE.md`, che punta qui —
> un solo file, mai due che divergono).
>
> **Regola d'oro di questo documento**: ogni affermazione qui è stata
> verificata contro il codice reale al momento in cui è stata scritta. Se
> aggiungi qualcosa, verificala prima con un comando vero (`grep`, `ls`,
> `npm test`) — mai a memoria. Questo progetto ha già avuto documenti
> strategici con dati inventati, poi trovati e corretti: non ricominciamo.
>
> Ultimo aggiornamento verificato: **2026-09-06**.

> Integrazione verificata **2026-09-11**: il checkout di lavoro è sul branch
> `codex/public-release-foundation`. Stato, modifiche e limiti dei controlli sono
> in [release-review-2026-09-11.md](docs/release-review-2026-09-11.md). Le tabelle
> e i conteggi storici qui sotto restano riferiti alla verifica del 6 settembre.
> Aggiornamento: suite completa **4.767 test / 310 file passati**, inclusi i
> quattro test di fuso con veri processi; build di produzione completata con
> esbuild WebAssembly della stessa versione. `test:serial` e `build:portable`
> evitano le pipe bloccate da EPERM; non modificano la sicurezza del sistema.
> Per il merge con main `d92a5dc`, leggere
> [integration-handoff-2026-09-11.md](docs/integration-handoff-2026-09-11.md).
> Ingresso unico per il revisore: [merge-request-2026-09-11.md](docs/merge-request-2026-09-11.md),
> con manifesto file per file e risultati della suite. La simulazione di merge
> `eb86338` / `d92a5dc` rileva 13 file in conflitto: integrazione guidata necessaria.
> Non dichiarare un merge, deploy o collaudo nativo sulla base dei test locali.
> Prima di integrare i motori, leggere anche
> [engine-integration-audit-2026-09-11.md](docs/engine-integration-audit-2026-09-11.md):
> 246 test mirati di main superati, ma casi limite riprodotti in calibrazione,
> CSV e scadenze ancora da correggere. Conservare le protezioni locali dei
> modelli e della mesh; main non è automaticamente superiore in ogni modulo.

## Cos'è

App di finanza personale + analisi di mercato **100% on-device**. PWA in
JavaScript vanilla + Vite, nessun framework UI. Il valore nasce dal **non
ricevere mai i dati dell'utente**: nessun server proprietario, nessun cloud
obbligatorio, nessun account.

Repo: `https://github.com/GPire/momentum` · branch di lavoro `codex/data-learning-continuity` ·
versione in `package.json`: **50.1.0**.

## Regole non negoziabili

Aggiornamento esplicito dell'utente, 2026-09-07: la telemetria di utilizzo è
attiva di default e disattivabile. L'opt-out già salvato va rispettato.
Questa eccezione riguarda solo gli eventi del catalogo `core/telemetry.js`,
non autorizza l'invio di transazioni, saldi, documenti o testo delle chat.
La versione GitHub corrente è la base preferita; valutare separatamente
le modifiche locali e preservare il lavoro precedente. Pubblicare solo dopo
test completi e autorizzazione esplicita dell'utente.

1. **I dati dell'utente non lasciano mai il dispositivo.** Le uniche
   eccezioni sono dichiarate e opt-in (riassunto notizie via LLM esterno con
   chiave dell'utente, mai dati finanziari; staffetta mesh di dati PUBBLICI
   come prezzi/tassi, mai dati personali).
2. **Mai un numero inventato.** Ogni stima dichiara la propria incertezza e
   copertura; ogni dato "quasi in tempo reale" dichiara esattamente quanto
   non lo è. Se un dato non è verificabile, si dice — non si riempie il buco.
3. **Se non è testato, non esiste.** `npm test` gira su tutto `src/`.
4. **Funzioni pure separate dal DOM.** Il DOM si tocca solo in `src/main.js`.
5. **UI a prova di bambino di 8 anni**: un numero dominante per schermata,
   linguaggio semplice, mai gergo tecnico non spiegato.
6. **Ogni testo va tradotto subito in tutte e 7 le lingue** coperte
   (IT/EN/DE/FR/ES/NL/PT, `src/i18n/ui-strings.js`), mai solo in italiano.
7. **Mai emoji nell'interfaccia**: solo icone SVG disegnate.
8. **Catena hash delle transazioni**: `vault.js` calcola
   `tx.hash = simpleHash(tx.id + tx.amount + tx.category + tx.prevHash)`.
   Correggere `amount`/`category` di una transazione esistente invalida la
   catena — si aggiungono solo campi mancanti (es. `description`).

## Comandi

```bash
npm run dev            # server di sviluppo (Vite, :5173)
npm test               # tutta la suite — 4620 test, tutti verdi al 2026-09-06
npm run build          # build di produzione
npm run preview        # anteprima della build
npm run cap:android    # build + apre il progetto Android (Capacitor)
```

Ci sono molti benchmark separati (`npm run bench:*`, `npm run train:*`, vedi
`package.json`): sono strumenti di misura, non parte del percorso di
produzione.

## Mappa del codice (`src/`, conteggi verificati)

| Cartella | File .js | di cui test | Cosa contiene |
|---|---|---|---|
| `alpha/` | 174 | 81 | Motore mercati: rendimenti netti post-tasse, regime di mercato, drawdown, segnali istituzionali da filing SEC reali (Beneish M-Score, Piotroski F-Score, mappa SIC→settore) |
| `predict/` | 120 | 60 | Previsioni + fisco: Cassa Unica (`cash-forecast.js`), modello entrate (`income-model.js`), fiscale IT/CH/ES, FatturaPA, ravvedimento operoso |
| `ai/` | 72 | 33 | Ensemble di categorizzazione on-device: Nano, Meso, NeuralNexus, orchestratore con pesi adattivi e astensione quando la confidenza è bassa |
| `mesh/` | 58 | 29 | Sync P2P WebRTC senza signaling server, federated learning, anti-poisoning, reputazione peer, resistenza Sybil |
| `core/` | 54 | 27 | Vault (localStorage + IndexedDB con riconciliazione), licenze ECDSA P-256/SHA-256, auto-update |
| `import/` | 22 | 11 | CSV bank-agnostico, PDF/OCR, screenshot, notifiche bancarie, CAMT.053 |
| `split/` | 21 | 11 | Divisione spese CRDT, settlement minimo esatto, chat ancorata alle spese |
| `invoice/` | 20 | 11 | Fatturazione, XML FatturaPA, QR-bill svizzera |
| `trips/` | 10 | 6 | Trasferte |
| `i18n/` | 8 | 4 | 7 lingue |
| `ui/`, `voice/`, `graph/`, `device/`, `pay/`, `pwa/` | ~31 | ~15 | Componenti UI puri, dettatura, grafo DCGN, profilo hardware, pagamenti SEPA, installazione PWA |

`src/main.js` è il solo punto che tocca il DOM ed è molto grande (~20k righe):
tutto il resto è puro e testabile senza browser.

## Nativo

Progetti **Capacitor** presenti: `android/`, `ios/App/App.xcodeproj`,
`capacitor.config.json` con appId `com.momentum.vault`, webDir `dist`.
La presenza degli scaffold non certifica il rilascio: vedere
`docs/ios-release-verification.md` per le prove native ancora necessarie.

## Automazione

`.github/workflows/refresh-panel-sec.yml` — aggiornamento schedulato del
pannello dati SEC.

## Limiti dichiarati (non sono bug: sono scelte o muri reali)

- **Moduli scritti e testati ma NON collegati alla UI** (verificato con grep su
  `src/main.js` il 2026-09-05, zero import):
  `predict/pianificatore.js` + `predict/interrogazione.js` (con i 4 moduli
  quant che orchestrano: confronto titoli, causalità, validità, deterioramento),
  `alpha/sentiment-divergence.js` (bloccato: serve uno storico prezzi
  per-titolo gratuito che oggi non esiste), `predict/tenuta-ciclo.js`.
  `ai/neurosym.js` è collegato solo al pannello "Come funziona Momentum".
  `predict/tax-engine.js` (registro comune IT/ES/CH, verificato 2026-09-06:
  zero import di `getTaxModule`/`listTaxModules`/`computeLiabilityCH` fuori
  dal file stesso e dal suo test). Il bug di mescolanza stipendio/reddito
  autonomo (`entrateAnnualizzate` sommava OGNI entrata) è stato CORRETTO lo
  stesso giorno (ora usa `classifyIncome`, come IT/ES) — resta comunque
  orfano, non collegato a nessuna UI: chi lo collega deve comunque scrivere
  i test di integrazione con dati reali prima, non solo fidarsi dei test
  unitari del modulo.
- **Nano e Meso non sono riaddestrabili in questo repo**: nessuno script
  `train_*.py`, i pesi arrivano da un addestramento fatto altrove. LogReg sì
  (`bench/train-logreg.mjs`).
- **SdI (trasmissione fatture)**: non risolvibile via codice. Scelta
  dichiarata, non un task aperto.
- **CORS**: SEC EDGAR, Fed e BCE non mandano `Access-Control-Allow-Origin`
  (verificato con `curl -I`, non ipotizzato). I proxy CORS generici sono stati
  provati e scartati per inaffidabilità: si usa un relay solo quando esiste un
  prodotto dedicato (es. rss2json per gli RSS), mai un proxy generico.
- **mDNS è impossibile da browser puro** e **Web Bluetooth non esiste su
  Safari iOS**: qualunque idea di "scoperta locale ambient" per la mesh va
  scartata senza un guscio nativo.
- **La causalità qui è co-variazione dichiarata**, non causalità stretta.
- **Vocabolario di categorizzazione**: forte su Italia/UK/USA/Brasile/Spagna,
  debole altrove — un utente in Nigeria o Indonesia viene importato
  correttamente (importo + valuta) ma categorizzato male. Limite dichiarato,
  non fabbricabile con dati che non abbiamo.
- **RETA spagnola calcolata sul fatturato lordo, non sul reddito netto**
  (`tax-es.js:retaIrpfPeriodo`): i tramos ufficiali si basano sui
  *rendimientos netos* (fatturato meno spese deducibili), ma Momentum non ha
  ancora un sistema di spese deducibili per l'estero — userebbe un tramo più
  alto del dovuto per chi ha spese significative. Limite dichiarato
  (2026-09-06, trovato analizzando un audit esterno), non ancora risolto:
  richiede una feature nuova (classificazione spese deducibili), non un
  fix puntuale.
- **Scala AVS svizzera sotto CHF 60.500/anno non stimata** (`tax-ch.js`):
  scelta dichiarata nel file stesso ("mai un numero inventato"), non
  riverificata il 2026-09-06 — se in futuro si trova una fonte primaria con
  la tabella completa (non solo aliquota min/max), può diventare una tabella
  come `RETA_TRAMOS_2026`, mai una formula indovinata.
- **Copertura dei dizionari verificata il 2026-09-11**: le chiavi fiscali e
  di fatturazione prima mancanti sono ora presenti direttamente nelle sette
  lingue (`src/i18n/translation-coverage.test.js`). Restano testi italiani
  costruiti direttamente in alcune UI: copertura delle chiavi e traduzione
  completa delle schermate sono verifiche diverse.
- **Solo 4 casse professionali su 17 hanno un calcolo reale**
  (`tax.js:CASSE_CON_REGOLE` — Forense/Inarcassa/CNPADC/CIPAG-geometri,
  quest'ultima aggiunta 2026-09-11 — verificato contando le chiavi, non a
  memoria: una memoria precedente diceva erroneamente "16/16 coperte"). Le
  altre 13 restano a zero con nota onesta. **ENPAM (medici) verificata ma
  deliberatamente NON aggiunta**: struttura a 3 componenti (Quota A fissa
  per fascia d'età, Quota B a due aliquote, contributo maternità fisso) non
  riducibile allo schema `aliquotaSoggettivo/minimoSoggettivo` esistente —
  richiede un parametro età in più che `taxSetAside` non riceve oggi.
- **Scadenze fiscali multi-Paese (2026-09-10, analisi competitiva)**:
  `tax-deadlines.js` (Italia, maturo: cash-forecast, ravvedimento, F24
  precompilato) esteso con `tax-deadlines-es.js` (Modelo 130 spagnolo —
  SOLO la data è certa/verificata, l'importo è dichiarato come proiezione
  a 3 mesi, non il 20% cumulato ufficiale). **Svizzera deliberatamente
  assente**: l'AVS non ha una scadenza fissa nazionale, ogni Ausgleichskasse
  cantonale fattura secondo il proprio calendario — nessuna fonte trovata
  per una data unica, inventarne una violerebbe la stessa disciplina già
  in uso per la scala AVS degressiva.
- **Export commercialista, formato strutturato** (`accountant-export-structured.js`,
  2026-09-10): CSV multi-sezione + JSON accanto all'HTML stampabile
  esistente (`accountant-export.js`/`accountant-export-intl.js`), stesso
  `report` già calcolato, nessuna seconda formula. Manca ancora
  un'integrazione DIRETTA con un gestionale di studio (B.Point, TeamSystem,
  Zucchetti): nessuna API self-serve aperta a terzi è stata confermata per
  nessuno di questi — deliberatamente non costruita finché non si verifica
  un accesso reale, per non costruire su un'ipotesi.
- **Centro Fiducia** (`window.openTrustCenter()`, main.js, 2026-09-10):
  un solo posto che elenca i limiti dichiarati sparsi nei moduli fiscali
  (`LIMITI_DICHIARATI` in main.js) — se si aggiunge un nuovo limite fiscale
  in futuro, aggiungerlo anche lì, altrimenti il Centro Fiducia mente per
  omissione.
- **Granger causale spesa-personale × mercato: verificato NON verificabile
  in questo ambiente (2026-09-11)**. Il roadmap (ANALISI_COMPETITOR.md §5.3)
  chiedeva esplicitamente di testare la potenza statistica CON DATI REALI di
  un utente prima di costruire — questo repo di sviluppo non ha lo storico
  transazioni di un utente reale (solo dati demo), quindi il test richiesto
  non è eseguibile qui. Non costruito su dati sintetici per lo stesso motivo
  per cui `bench/cash-forecast-bench.mjs` dichiara esplicitamente che i suoi
  risultati sono relativi a un processo noto, non un'accuratezza assoluta —
  testare un'ipotesi di potenza statistica su dati sintetici sarebbe
  circolare (il generatore non ha bisogno di causalità mercato-spesa perché
  non la modella). Resta un task che richiede un vault reale per essere
  eseguito, non un dato mancante da questa sessione.
- **La previsione si verifica da sola** (`forecast-calibration.js`,
  2026-09-11): istantanee giornaliere della Cassa Unica (checkpoint 7/14/30
  giorni) confrontate con quello che succede per davvero, quando la data è
  passata — mai un ricalcolo del motore di previsione, solo osservazione.
  Persistenza: `VaultDAO.state.forecastSnapshots` (tetto 45, FIFO) e
  `VaultDAO.state.forecastShown` (chiavi `takenAt:daysAhead`, per non
  ripetere lo stesso confronto). Un insight nel feed bandit-ranked
  (`kind: 'forecast-calibration'`) compare solo quando un checkpoint è
  appena diventato verificabile — nessuna UI aggregata di calibrazione
  (percentuale reale dentro banda vs 80% dichiarato) ancora costruita:
  `calibrationSummary()` esiste ed è testata, ma non è ancora mostrata da
  nessuna parte — prossimo passo naturale, non ancora fatto.
- **Previsioni di prezzo: deciso esplicitamente il 2026-09-11 di NON farle.**
  Segnalato all'utente il rischio reale di consulenza finanziaria non
  autorizzata (MiFID II/SEC) nel presentare un prezzo futuro o un segnale
  compra/vendi a utenti reali (l'app è pronta per il Play Store) — l'utente
  ha scelto esplicitamente la "via di mezzo": frequenza storica condizionata
  ("dopo un pattern simile, storicamente, in N casi su M"), mai un prezzo o
  un segnale. Costruito in `src/alpha/pattern-storico.js`, wired come intento
  QA `'pattern-storico'` in `mercato-qa.js` (deve precedere `materie-prime`
  nell'ordine delle regole — trovato dal vivo che "cosa succede dopo un
  crollo del petrolio" cadeva altrimenti in materie-prime). Usa il pannello
  40 anni (`daily-long.js`, azioni USA/Nasdaq/Russell2000/oro/argento/rame/
  petrolio/dollaro/bitcoin), episodi NON sovrapposti per costruzione (si
  salta l'intero orizzonte dopo un trigger), gate a 10 casi minimi. **Se in
  futuro qualcuno propone un prezzo target o un segnale compra/vendi vero:
  questa è la decisione esplicita che lo esclude, non un limite tecnico.**
- **5 correzioni integrate da un branch parallelo dopo revisione mirata**
  (`origin/codex/public-release-foundation`, 81 file/+3615 righe in totale —
  revisionato con un fork dedicato, NON integrato in blocco, solo questi 5
  pezzi isolati e verificati uno per uno il 2026-09-11):
  1. `telemetry.js`: `response.ok` verificato su ogni invio (un POST fallito
     con errore HTTP non veniva più ritentato, si perdeva in silenzio) +
     nuovo canale `sendEssentialDiagnostic` (indipendente dall'opt-out,
     chiavi chiuse, mai dati finanziari).
  2. `onboarding-state.js` + lo script inline gemello in `index.html`:
     `isFirstLaunch:true` esplicito ora richiede transazioni VERE, non basta
     più un `onboardingProfile` predefinito da solo (le due copie restano
     allineate, c'è un test dedicato che lo verifica).
  3. `multi-import.js`: `isEvalSupported:false` su pdf.js (hardening contro
     un PDF ostile importato dall'utente).
  4. `install-guide.js`: un iPad in modalità "sito desktop" mandava uno
     user-agent identico a un Mac vero — ora distinto via `maxTouchPoints`
     (i Mac veri non hanno touch), 3 punti di chiamata in main.js aggiornati.
  5. `recovery-notice.js` (nuovo modulo): il modale di recupero da tx_log
     ricompariva IDENTICO ad ogni riavvio per chi lo chiudeva con "Non ora"
     — ora un solo avviso automatico per insieme di id recuperabili, gated
     anche su `haCompletatoOnboarding` (chi non ha finito l'onboarding non
     vede il modale) e coordinato con `showWhatsNewIfDue` (mai due modali
     importanti sovrapposti allo stesso avvio).
  **NON integrato** (deliberatamente, richiede più revisione o conferma
  dell'utente): il resto di `main.js`/`index.html`/`dashboard-clarity.css`/
  `payment-agenda.js` (pacchetto UI/feature unico e intrecciato), `src/core/
  subscription.js` (riga sospetta: `FEATURES_PER_PIANO[TIER_PRO]` sembra
  concedere le feature Investor anche al solo piano Pro — da chiarire con
  l'utente prima), `src/sdk/federation.js` (SDK B2B speculativo, dormiente),
  `src/mesh/*` (protocollo condiviso fra device, serve revisione dedicata),
  scaffolding nativo iOS/Android e nuovi workflow CI (decisione di prodotto,
  non di codice). **Non risolve** il bug segnalato dall'utente (spese
  passate non salvabili da Command Center/calendario) — quel bug resta da
  diagnosticare direttamente su main.
- **Bug delle date backdatate — diagnosticato e risolto strutturalmente
  (2026-09-11)**. Causa reale (diversa da quanto sospettato all'inizio):
  NON un problema di fuso orario nel salvataggio/lettura (quello era già
  corretto, verificato con test multi-fuso reali) — il form spesa
  dimenticava la data scelta ad ogni salvataggio, tornando a "oggi" per la
  spesa successiva (`resetForm()`, mai un problema per chi registra UNA
  spesa arretrata, sempre per chi ne registra più di fila per lo stesso
  giorno). Fix: `rememberedTxDate()`/`setRememberedTxDate()` (main.js, vicino
  ad `attachFormListeners`) ricordano l'ultima data scelta a mano per 30
  minuti — sia `resetForm()` sia una nuova apertura del form (mobile, dove
  `closeModal()` distrugge il form ad ogni salvataggio) la riusano invece di
  azzerare a oggi. **Guardia strutturale aggiunta** (richiesta esplicita
  dell'utente, "risolvilo definitivamente"): `date-utils.test.js` ora
  spazzola OGNI file sorgente e vieta il pattern `t.date.slice(...)`/
  `tx.date.slice(...)`/`String(t.date).slice(...)` (il modo in cui il bug
  originale è nato) — ha trovato SUBITO 4 istanze reali pre-esistenti e mai
  notate prima, tutte corrette nella stessa sessione: `backup.js` (mese
  sbagliato ripristinando un vecchio formato), `vault.js` (**bug serio**:
  transazioni recuperate da tx_log potevano finire nel mese sbagliato),
  `week-insight.js` (confronto "spendi più del solito" su un giorno
  sbagliato), `ui/mese-strip.js` (**due bug**: rilevamento del giorno di
  paga e ritmo degli incassi entrambi basati su un giorno potenzialmente
  shiftato). Chiunque scriva un nuovo punto che legge `t.date`/`tx.date` con
  un taglio di stringa diretto ora fa fallire `npm test` immediatamente,
  invece di scoprirlo mesi dopo da un utente.
- **2 bug reali trovati e risolti VERIFICANDO DAL VIVO in Chrome** (2026-09-11,
  prima volta in questa sessione con l'estensione collegata — prima si
  procedeva alla cieca sul solo codice): (1) su un viewport corto reale, la
  domanda "Quanti anni hai?" (e potenzialmente altri step con contenuto più
  alto di 384px) aveva il titolo TAGLIATO in alto e irraggiungibile via
  scroll (`justify-content:center` + overflow: a scrollTop 0 il pezzo che
  sborda IN ALTO non è raggiungibile, scrollTop non può andare sotto zero)
  — fix: `justify-content: safe center` su `.genesis-step` (index.html),
  ripiega su flex-start solo quando centrare creerebbe overflow
  irraggiungibile, zero differenza sui passi che già entrano in 384px.
  (2) la scia di una stella cadente poteva attraversare visivamente il
  titolo di una domanda — un text-shadow NON bastava (lascia passare la
  luce nei vuoti fra le lettere): risolto con backdrop-filter (stessa
  ricetta già usata per `.payoff-card`, vetro smerigliato — le stelle
  restano visibili dietro, sfocate). Entrambi verificati con screenshot
  reali prima/dopo, non solo a lettura di codice.
- **Pannello prezzi giornalieri ora auto-aggiornato** (`.github/workflows/
  refresh-daily-long.yml`, 2026-09-11): stesso pattern del pannello SEC
  (`refresh-panel-sec.yml`) — PR settimanale, mai un push diretto su main,
  test+build verificati prima di proporla. `daily-panel.js` (il pannello a
  5 anni, più vecchio) resta SENZA workflow di refresh: nessuno script npm
  dedicato trovato per rigenerarlo, non toccato in questa sessione.

## Trappole già pagate (leggile prima di perderci un'ora)

- **Persistenza a tre copie**: `VaultDAO` scrive `localStorage['omega_core_db']`
  (payload), `localStorage['omega_shadow_vault']` (stesso payload in base64) e
  IndexedDB `momentum_vault`. Per iniettare uno stato di test a mano vanno
  scritte **tutte e tre** coerenti, altrimenti il boot le riconcilia e sembra
  un bug dell'app.
- **`indexedDB.open()` va sempre protetto da un timeout**: una connessione
  aperta altrove può lasciarlo appeso per sempre e bloccare l'intero boot
  senza un solo errore in console (è già successo).
- **ID duplicati nel form di inserimento**: lo stesso markup è iniettato due
  volte (modale mobile + pannello desktop). `document.getElementById` prende
  il primo, spesso quello nascosto — usa sempre `container.querySelector`
  o filtra per `offsetParent !== null`.
- **Eventi sintetici** (`dispatchEvent`/CDP) possono non attivare i listener
  reali della pagina. Le chiamate dirette a funzioni esposte su `window`
  (`window.openSplitGroup`, `window.genesisNext`, …) sono affidabili.
- **`?lang=xx` nell'URL** forza la lingua per la sessione corrente: è il modo
  rapido di verificare una traduzione dal vivo.
- **Un figlio flex-column con `overflow` non-visible ha dimensione minima
  automatica ZERO** per specifica CSS: dentro un contenitore ad altezza fissa
  viene schiacciato a niente pur avendo il contenuto nel DOM. Già costato due
  bug reali (scena privacy, payoff onboarding).
- **Ogni `window.setXxx` che tocca `VaultDAO.state` e influenza una card della
  Dashboard deve chiamare `renderDashboard()` esplicitamente** (2026-09-11,
  bug reale live-verificato in Chrome): `setTaxRegime`/`setNoPartitaIva` non
  la chiamavano — dopo aver scelto un regime fiscale dal card di scoperta,
  quel card restava visibile e ripeteva "hai la Partita IVA?" a chi aveva
  appena risposto, come se l'app non avesse ascoltato. Nessun errore in
  console: lo stato era corretto, solo il DOM non veniva ridisegnato. Stesso
  fix applicato a `setEsActive`/`setChAttivitaTipo`.
- **Una card "universale" tradotta in 7 lingue non implica un flusso
  universale dietro** (stesso bug, 2026-09-11): la card di scoperta fiscale in
  Dashboard chiede "sei autonomo?" in ogni lingua, ma il suo tasto chiamava
  sempre `openTaxLevel1()` — il simulatore SOLO italiano (ATECO, INPS Gestione
  Separata) — anche per chi aveva già detto a onboarding di essere in
  Svizzera o Spagna, dove esistono già `openSwissSimulator`/
  `openSpainSimulator` dedicati ma irraggiungibili da lì. Ora
  `window.openTaxDiscover()` instrada per `VaultDAO.state.taxActiveCountry`
  prima di aprire un modale — controllo da ripetere ogni volta che un punto
  d'ingresso "unico" nasconde più motori fiscali dietro.
- **`CAUSE_ESCLUSIONE_FORFETTARIO`/ATECO/CASSE_PROFESSIONALI (tax.js) non
  passano da `tCh()`** — sono normativa italiana reale (es. "Legge 190/2014,
  art.1 comma 57"), lasciata in italiano di proposito nell'unica riga di
  codice che li stampa; non tradurli a caso senza aver verificato la fonte
  normativa nella lingua target.

## Come si lavora qui

- Prima di proporre un modulo nuovo, **cerca nel repo**: più volte la cosa da
  costruire esisteva già, scritta e testata, solo non collegata.
- Prima di dichiarare che un dato non esiste, cerca anche le **agenzie
  statistiche di settore**, non solo i fornitori finanziari.
- Toccando fisco o AI: **prima i test**, poi il codice.
- Ogni contraddizione trovata si **dichiara all'utente**, non si risolve in
  silenzio (es. "hai dichiarato liquidità corta ma profilo aggressivo: tengo
  il freno protettivo, ed ecco perché").
- Verifica dal vivo in Chrome prima di dire "fatto" su qualunque cosa tocchi
  il DOM: `npm test` non vede la UI.
