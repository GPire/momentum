# Momentum — contesto per chi subentra (persone e AI)

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

## Cos'è

App di finanza personale + analisi di mercato **100% on-device**. PWA in
JavaScript vanilla + Vite, nessun framework UI. Il valore nasce dal **non
ricevere mai i dati dell'utente**: nessun server proprietario, nessun cloud
obbligatorio, nessun account.

Repo: `https://github.com/GPire/momentum` · branch di lavoro `main` ·
versione in `package.json`: **50.1.0**.

## Regole non negoziabili

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

Scaffold **Capacitor** presente: `android/` (pronto), `capacitor.config.json`
con appId `com.momentum.vault`, webDir `dist`. iOS non ancora inizializzato.

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
- **Modulo Spagna tradotto solo IT/EN/ES, non nelle altre 4 lingue**
  (verificato 2026-09-06 contando le occorrenze di ~33 chiavi `esXxx*` in
  `ui-strings.js`, es. `esCardNoteFn`/`esDeactivate`: 3/7 lingue ciascuna).
  Chi usa Momentum in tedesco/francese/olandese/portoghese con la Spagna
  attiva vede il fallback inglese per queste stringhe (mai un crash, `t()`
  ricade su EN poi IT poi la chiave grezza) — non ideale, ma non rotto.
  Le chiavi NUOVE aggiunte lo stesso giorno (territorio foral, `esTerritorio*`)
  sono già nelle 7 lingue: il debito è solo sulle ~33 preesistenti, da
  chiudere in una sessione dedicata (non una riga sola per volta).
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
