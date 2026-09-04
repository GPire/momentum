# Manifesto versioni e benchmark

Regola del progetto: **una versione si guadagna con un salto reale misurato, mai con un'etichetta.** Questo file dice dove è ogni componente oggi (con la prova) e cosa deve succedere — misurabile — per ogni salto successivo, fino alla v5.

## Stato attuale (2026-07-06)

| Componente | Versione | Prova del salto |
|---|---|---|
| NeuralNexus (rete on-device) | **v2** | backprop + L2 + gradient clipping; apprende dall'uso reale; validate() usato dall'anti-poisoning |
| Nano (categorizzatore leggero) | **v1** | 99% train / 94.7% CV / 80.0% su testo sporco; parità Python↔JS 2.2e-16 |
| Meso (categorizzatore robusto) | **v1** | 89.7% su testo bancario sporco (stesso test set del Nano, confronto misurato) |
| Orchestrator | **v3** | v1: confronto binario → v2: voto pesato N-vie per accuratezza misurata → v3: pesi modulati dalla precisione per-categoria appresa dalle correzioni reali (test: dopo 6 correzioni il Nano supera il Meso dove il Meso sbaglia) |
| Grafo causale | **v1** | co-variazione su differenze settimanali, lag 0/1, propagazione a catena con percorso esplicativo (7 test) |
| Q&A engine | **v1** | 12 intent deterministici, onesto su unknown (16 test) |
| Predittore contestuale | **v1** | lift temporale misurato (fasce orarie + giorno settimana, Laplace), neutro senza pattern (6 test) |
| Mesh federata | **v2** | v1: motore standalone → v2: cablata al vero NeuralNexus, adozione per nodi nuovi, verificata live su 2 nodi (FedAvg 9+9=18) |
| Parser PDF | **v2** | v1: solo layout italiano semplice → v2: Intesa/UniCredit/N26/Revolut, colonna Saldo ignorata, multi-riga, date ISO/testuali (8 test su fixture) |
| OCR scontrini | **v2** | v1: solo totale → v2: esercente (filtri fiscali), data, categoria via ensemble (12 test, verificato end-to-end su canvas reale) |
| Voice | **v2** | v1: transazioni singole → v2: frasi multi-azione, appuntamenti .ics, domande instradate al Q&A con risposta parlata |
| Offline/PWA | **v2** | v1: shell only → v2: doppia cache con vendor CDN + wasm/traineddata OCR, warm-up idle |

## Benchmark-target per i prossimi salti (misurabili, non negoziabili)

### Categorizzazione → v3/v5
**Primo benchmark eseguito (2026-07-06, `npm run bench`, seed 20260706, 480 esempi)** — esercenti MAI visti in training + rumore bancario pesante:
| | accuratezza | latenza |
|---|---|---|
| Nano | 47.5% | 0.06 ms/predizione |
| Meso | 50.0% | 0.13 ms |
| **Ensemble (ML puro)** | **59.4%** | 0.51 ms |
| **Momentum Core (dizionario+ML)** | **92.5%** | 0.08 ms |

Scoperta onesta e preziosa: l'89.7% storico del Meso vale sulla distribuzione del suo training; su esercenti fuori vocabolario si crolla a ~50% (l'ensemble batte comunque i singoli — il voto pesato funziona). **Il vero nemico è la copertura del vocabolario**, e ora è misurato.
- **v2 (Nano/Meso riaddestrati)**: vocabolario esercenti 10-20×, n-grammi più aggressivi, + correzioni REALI dell'utente (export `modelStats`). Target misurabile: **ensemble ≥ 75% su QUESTO bench** (che resta held-out: mai mettere i suoi esercenti nel training — sarebbe barare), parità Python↔JS ≤ 1e-9.
- **v5**: ≥ **97%** su un benchmark pubblico riproducibile di descrizioni bancarie italiane sporche (da costruire e pubblicare — diventa anche l'argomento marketing verificabile: "97% on-device in 400KB"), su 12+ categorie, con calibrazione della confidenza (ECE ≤ 0.05: quando dice 80% ha ragione l'80% delle volte).

### Forecast → v3/v5
- **v3**: backtest walk-forward automatizzato nel repo (script `npm run bench:forecast`): MAPE della proiezione fine-mese misurata su storici sintetici e reali anonimi. Target: battere il run-rate naive di ≥ **20%** di errore relativo.
- **v5**: intervalli di previsione calibrati (copertura reale 90% ± 3 punti sul backtest) + state-space O(1) collegato (modulo già scritto e testato, `src/predict/state-space.js`).

### Grafo causale → v2/v5
- **v2**: validazione out-of-sample dei legami (un legame vale solo se regge sulle settimane successive alla scoperta) + test di stabilità.
- **v5**: scenari controfattuali integrati nel what-if con errore misurato sul backtest.

### Mesh → v3/v5
- **v3**: cifratura end-to-end applicativa sopra DTLS + rotazione chiavi per peer; test su 3+ nodi con relay gossip reale.
- **v5**: privacy differenziale con budget ε dichiarato e misurato sul gradiente condiviso (il rumore c'è già nel motore standalone, va portato e quantificato nel percorso NeuralNexus).

### Q&A / Voce → v3/v5
- **v3**: comprensione di date composte ("tra il 10 e il 20"), confronti ("più di giugno o luglio?"), follow-up conversazionali con contesto.
- **v5**: copertura ≥ 95% su una suite pubblica di 200 domande finanziarie personali in italiano (da costruire nel repo, `npm run bench:qa`) restando 100% deterministico e on-device.

### UX → v5
- Aggiunta spesa abituale: ≤ 2 tocchi (già raggiunto con i quick-add). Target v5: ≤ **1 tocco** dal widget/shortcut nativo (richiede guscio Capacitor).
- Ogni testo UI leggibile da un bambino di 8 anni (regola già attiva, da mantenere nei test di revisione).

## Come si misura (regole dei benchmark)

1. Ogni benchmark vive nel repo come script riproducibile (`npm run bench:*`), con dataset versionato o generatore deterministico con seed.
2. Il numero dichiarato è quello dello script, mai un numero a mano.
3. Un salto di versione richiede: benchmark superato + test verdi + verifica in browser reale documentata.
4. I confronti coi competitor si fanno solo su ciò che è misurabile pubblicamente (accuratezza su dataset aperto, dimensione modello, latenza, funzionamento offline) — mai claim non verificabili.

## Aggiornamento 2026-07-06 (sera) — Momentum Core
- **Meso v2** riaddestrato su questo Mac (vocabolario esercenti reali): generalizzazione ML held-out 55.0% (da 50.0%), ensemble ML 59.4% (da 51.5%).
- **Categorizzatore v3 = Momentum Core** (dizionario esercenti + ML fallback): **92.5% accuratezza di prodotto** sul benchmark riproducibile, 0.08 ms/predizione, cross-check Python↔JS 2.2e-16.
- **Astensione** aggiunta (orchestrator): l'AI dichiara `abstain` quando incerta invece di forzare — active learning dalla correzione utente.
- Documenti: MOMENTUM_CORE.md (architettura), COPERTURA.md (frizioni+investitori).

## Forecast bench (2026-07-07) — `npm run bench:forecast`
Walk-forward 60→7 giorni, 40 serie sintetiche con seed fisso:
- Baseline naive (media ultima settimana): MAPE 27.8%
- **Holt-Winters (motore Momentum): MAPE 8.6% — 68.9% meglio del naive, batte il naive in 40/40 serie.**

## Aggiornamento 2026-07-07 — modello più intelligente
- **Meso v2.1** (vocabolario-contesto ampliato): generalizzazione ML pura su esercenti mai visti **59.4% → 68.5%** (ensemble); accuratezza prodotto **92.5% → 93.3%**. Cross-check Python↔JS 8.3e-16.
- **Fusione multi-segnale** (`src/ai/signal-fusion.js`): la categorizzazione usa anche importo + fascia oraria (profili appresi dai dati reali dell'utente), non solo il testo. Attiva con ≥20 transazioni, il testo resta dominante. 5 test.

## Meso 3.0 (2026-07-07) — mega upgrade
- **Confidenza calibrata** (temperature scaling): meccanismo verificato (ECE 0.018→0.001 non vincolato); con T≥1 il modello risulta già ben calibrato (ECE 0.018, T*=1.0). Cross-check Python↔JS esatto (2.2e-16).
- **Più dati** (600/categoria): generalizzazione ML pura **68.5% → 69.8%**.
- **Quantizzazione int8** (`src/ai/quantize.js`): pesi 864KB→108KB (8× meno memoria), **8/8 categorie identiche a float, diff confidenza 0.0000**. Attiva su tier medio, float su tier massimo. 3 test.

## 🚀 MOMENTUM v7 (2026-07-10) — MEGA UPGRADE
Consolidamento del branch v3 (superset) in main + potenziamenti di sessione. **282 test verdi**, 6 benchmark riproducibili.
- **DCGN in produzione**: 3° modello reale nell'orchestratore, apprendimento Hebbiano ONLINE (nessun retraining) + adattività hardware (maxTokens per tier hardware — il grafo si plasma al dispositivo).
- **Layer investimenti** (Buffett/Graham/Lynch/Simons/Dalio/Bogle/Munger): factors + arbiter a regime + portfolio risk-parity + bridge cashflow↔investimenti + regime + nowcast. Cablato nella UI ("quanto puoi investire") + Q&A ("quanto posso investire?").
- **bench:reasoning**: 12/12 domande finanziarie a risposta verificabile, 0,002 ms — dove un motore deterministico batte gli LLM (che allucinano sull'aritmetica).
- **Categorizzazione**: prodotto 94,6% / ML held-out 76,0% (Nano++/Meso++).
- **Confronto onesto**: CONFRONTO_BENCHMARK.md (metodologia + assi strutturali + tabella competitor con fonti, mai inventate).
- 6 benchmark: bench, bench:forecast, bench:graph, bench:alpha, bench:reasoning, bench:vs-llm.

## MOMENTUM v7.1 (2026-07-10) — unificazione sparse-MoE
Fuso il branch v3 (adaptive-runtime) con main (M1-M4) senza perdere nulla. **293 test verdi**, 7 benchmark.
- **Sparse-MoE reale in produzione** (`src/device/adaptive-runtime.js` cablato in orchestrator): il budget di esperti per tier decide CHI vota — tier minimo solo Nano, salendo si sbloccano Meso e DCGN. Meno calcolo su hardware debole, mai crash. + self-tuning sotto throttling (riduce esperti se rallenta, target 60ms).
- `npm run bench:adaptive`: dimostra sparse-MoE per tier + self-tuning.
- Tutto il resto di v7.0 preservato (DCGN online, reasoning 12/12, layer investimenti, confronto onesto).

## 🚀 MOMENTUM v9 (2026-07-12) — NeuroSym + dati reali + saggezza investitori
**321 test verdi.** Salto v9 (parziale, in corso):
- **NeuroSym** (`src/ai/neurosym.js` + NEUROSYM.md): motore AI unificato — un cervello, un'API, spiegazione tracciabile. Onesto: no param-count inventati, no "batte GPT".
- **Dati mercato reali gratuiti** (`market-data.js`): stock/crypto, resiliente a CORS/offline (fallback multi-endpoint → CSV → cache).
- **Import + analisi portafoglio reale** (`portfolio-import.js`): P/L, allocazione, rischio, fattori, consigli Buffett/Graham/Dalio.
- **Saggezza investitori**: aggiunto Soros (reflexivity, 8° fattore) + evoluzione per-utente delle strategie (arbitro personalizzato).
- **Partita IVA** (`tax.js`): accantonamento fiscale automatico (forfettario/startup/ordinario). Card UI verificata.
- **Fix bug bloccante**: onboarding "Consacra" su iOS (Pointer Events + touch-action:none, no long-press selection).
- **Onboarding utile**: le domande iniziali ora parametrizzano il motore investimenti (quota investibile, fondo emergenza, riskFloor).
- **Readiness grande modello** (`expert-adapter.js`): slot pluggable per un modello compresso futuro (PrismML-style), oggi vuoto e dichiarato tale.
- RESTANO (prossimo batch): voice chatbot NL IT/EN, sync multi-device cifrato, PDF potenziato, INT4, public-bench Banking77, riaddestramento modelli.

## Sync multi-dispositivo (2026-07-12) — la paura "perdo i dati" risolta
`src/mesh/sync.js` (8 test) + `VaultDAO.applySyncMerge` + mesh cablata: sync differenziale tra device fidati senza server. Ottimizzato (scambia digest→solo delta), deterministico/CRDT-like (A∪B=B∪A, converge), integro (mai riscrive amount/category/hash → hash chain intatta), recupero da perdita (merge da vuoto = ripristino completo). Auto-sync al pairing. 337 test.

## MOMENTUM v9.2 (2026-07-12) — espansione europea a 5 lingue
- **Chatbot NL completo IT/EN/ES/FR/DE** (`src/ai/chat.js` + `i18n/detect.js`): rileva la lingua e risponde in quella, verificato in browser. Apre Germania/Francia (fintech ricco) oltre a Spagna/LatAm.
- **PDF bancario multilingua**: header ES/FR/DE (Cargo/Abono, Soll/Haben, Débit/Crédit), fixture banche spagnola/tedesca, date DD.MM.YYYY. Estratti EU importabili.
- **Dizionario esercenti EU**: Mercadona/Dia/Edeka/Rewe/Tesco/Carrefour... 342 test.
- Roadmap: localizzazione note invest/tax in EN/ES/FR/DE; PT/Brasile.

## Import robusto multi-file + AI (2026-07-13) — verificato su file bancari REALI
Sessione dedicata a import/categorizzazione, testata sui file reali dell'utente (export Revolut 1846 righe/5 anni, 4 PDF conferme, 15 screenshot buddybank).
- **Modelli riaddestrati IN LOCALE in JS** (nessun Python): nuovo esperto `HashedLogReg` (regressione logistica softmax, feature hashing word+char). Ensemble ML 76%→83.8% (held-out, +7.8). `bench/train-eval.mjs`, `bench/train-logreg.mjs`, modello in `public/momentum_logreg_model.json`, 3° esperto nell'orchestratore.
- **Import CSV Revolut** (`src/import/revolut-csv.js`): riconosce investimenti (Snowflake/Tesla→invest/etf), dividendi (→entrata/etf), spese carta via MCC. Verificato Chrome: 1777 tx, 301ms, 28 mesi, 0 date sbagliate.
- **parseGenericCsv ULTRA**: inferenza di contenuto (colonne dedotte dal dato), virgolette, negativi tra parentesi, Dare/Avere, D/C, header assenti/lingue sconosciute.
- **PDF conferme** (`extractConfirmationTransaction`): layout chiave-valore (Revolut/broker), stock/crypto riconosciuti.
- **Screenshot** (`parseScreenshotTransactions`): multi-transazione, contesto-data per intestazione ("13 Luglio"), multi-banca/valuta (€$£¥), fix "Genova≠Gennaio".
- **FIX freeze O(n²)**: `addTransaction({bulk})` → 1 save finale. **Dedup esatta** via transaction_id (`noDedup`). **Guardrail categorie** (`src/import/categorize.js`): crypto/etf solo con evidenza (fix "Sumup Sartoria→Crypto", verificato Chrome).
- **Multi-file MISTO** (`src/import/multi-import.js`): N file (anche 50) di formati diversi in una selezione, 1 save/render, dedup unica, **overlay di progresso** + **apprendimento in background** (learnInBackground, idle-chunked). UI: pulsante "Importa tutto". ETL responsive.
- 396 test verdi.

## Le 7 settimane non registrate (13/07 → 24/08), ricostruite dai commit + dalla memoria di sessione verificata
Questo file era rimasto fermo al 13/07. Sotto, solo ciò che risulta da commit reali + note di sessione già verificate dal vivo all'epoca (mai un numero ricostruito a memoria senza fonte) — non un resoconto completo di ogni commit (741 commit nel periodo), solo i salti misurabili.
- **Categorizzazione, 8→25 categorie, tutti e 3 i modelli riaddestrati con pipeline riproducibile** (`bench/train-nano.mjs`/`train-meso.mjs`/`train-logreg.mjs`, Adam optimizer): Nano 28,7%→71,6%, Meso 24%→78,5%, LogReg 90,0%→79,3%* (*su 25 categorie, non più 8 — non comparabile al numero vecchio). **Momentum Core (prodotto reale): 82,1%** dopo un bug dell'ensemble corretto (il bench limitava il voto alle sole categorie note al Meso, tagliando fuori le 17 nuove anche quando Nano/LogReg le riconoscevano giuste — `orchestrator.js` in produzione non aveva questo bug, solo il bench di misura).
- **Multilingua**: `UI_LANGS` da 4 a 7 lingue (+nl, +pt), tradotte Dashboard/Command Center/form spesa/flusso invito split/VoiceCore/Vault/guida installazione PWA. **Bug critico corretto**: `resolveUiLanguage()` ignorava sempre il device reale in produzione (default parametro `null` vs `undefined` in JS) — ogni utente vedeva l'app in inglese di default a prescindere dalla lingua del telefono, dal giorno in cui `__uiLang` fu introdotto fino al fix.
- **Bug critico di persistenza (perdita dati periodica segnalata da utenti reali)**: `VaultDAO` si fidava ciecamente di una copia "shadow" a un mismatch di checksum, invece di verificare quale copia avesse più transazioni reali; un secondo bug collegato poteva bloccare `indexedDB.open()` indefinitamente al boot (intera app mai avviata, zero errori in console). Entrambi risolti, log di recupero (`tx_log`) aggiunto per chi era già stato colpito.
- **Mesh P2P — sync gruppi mai funzionante in produzione, trovato e risolto**: il nodeId della mesh era casuale a ogni avvio invece di derivare dall'identità persistente del dispositivo — nessuna rinomina/spesa/messaggio aveva mai raggiunto un peer via push live da quando il filtro di privacy era stato introdotto.
- **Partita IVA multi-Paese**: casse professionali italiane (Forense/Inarcassa/CNPADC, aliquote da fonte primaria), motore fiscale Spagna (RETA 15 tramos + IRPF statale + ritenuta, BOE) completo di UI/i18n, framework `tax-engine.js` con registro per-Paese.
- **Trasferte di lavoro** (`src/trips/`): modello dati completo (categorie, CRDT su cancellazione/ripristino), diaria a ore (regola tedesca Verpflegungsmehraufwand come riferimento), approvazione senza server via codice compresso (QR), ponte email verso Concur/Expensify/Zoho (mai un'integrazione API reale — richiederebbe partnership commerciale, dichiarato onestamente).
- **Split spese**: multi-valuta (Frankfurter/BCE, tasso del giorno mai ricalcolato), nomi duplicati disambiguati ("Marco #1"/"#2"), promemoria Dashboard con direzione debito corretta (bug `'Io'` invertito su gruppi non creati dal dispositivo), log di verifica del settlement passo-passo, chat ancorata alle spese con contestazione che sospende il saldo.
- **Onboarding**: redesign neuro-linguistico (payoff visibile dopo le domande, wording corretto "compro ancora, è in saldo" invece di frasi semanticamente rotte), 3 domande + 1 condizionale (liquidità/rischio/orizzonte + uscita "non investo"), poi gate età con percorso dedicato minorenni.
- **Calendario mensile**: riscritto con allineamento reale al giorno della settimana, riusato identico in Dashboard e Analisi Tensor, "+" diretto sui giorni vuoti, export CSV movimenti (RFC 4180 + BOM).
- **Analisi Tensor**: pannello SEC su 600 aziende reali, Beneish/Piotroski, RMT, comps, sentiment on-device, grafico storico (Lightweight Charts, sostituito il vecchio SVG scritto a mano).

## Sessione 2026-09-04 — scroll rotto risolto, Command Center desktop/tablet ridisegnato, categorizzazione
**4400 test verdi (confermato di nuovo il 2026-09-04, `node --test src/`, 0 falliti).**
- **BUG CRITICO scroll**: `html`/`body` avevano `overflow-x: hidden` senza `overflow-y` dichiarato — per specifica CSS questo promuove l'asse lasciato implicito ad `auto`, creando DUE contenitori di scroll indipendenti. `body` non ha mai altezza propria (zero margine di scroll reale) e con `overscroll-behavior-y: none` già impostato, il gesto moriva lì prima di incatenarsi a `html` — su ogni pagina, per chi usava mouse/trackpad. Stessa causa per cui `position: sticky` sul Command Center desktop spariva dopo il primo scroll. Fix: `overflow-x: clip` al posto di `hidden` (non fa scattare la promozione). Un solo vero contenitore di scroll, verificato dal vivo.
- **Command Center desktop/tablet ridisegnato**: il tastierino disegnato (pensato per un dito) restava sempre aperto anche su desktop/laptop, dove la tastiera fisica scrive già l'importo — il pannello non stava mai a schermo senza scorrere. Ora chiuso di default (`pointer:fine`), un tocco per riaprirlo; suggerimento da tastiera sempre visibile. "Dividi" spostato fuori dall'accordion "Altri dettagli" (era a due tocchi, segnalato più volte come introvabile) — ora un pulsante a piena larghezza sempre visibile per le uscite, colore primario invece di grigio neutro.
- **Scopribilità**: il campo nota ora dichiara esplicitamente "Cosa hai comprato? Indovino la categoria" invece di un placeholder muto; il toggle data ha icone di anteprima invece di un link grigio in maiuscoletto indistinguibile da una didascalia.
- **Micro-animazioni**: pillola scorrevole (posizione/larghezza misurate via JS, non percentuali fisse) per ogni `.segmented-control` esistente (Essenziale/Completa ×2, Delicato/Consigliere/Deciso, In parti uguali/Chi ha consumato di più) — prima un semplice cambio di colore sul testo, ora un movimento visibile con `.type-toggle-pop` di conferma. Categorie con comparsa a cascata (stagger via CSS var `--i`). Barra di scorrimento personalizzata (`scrollbar-color`/`::-webkit-scrollbar`, segue il tema chiaro/scuro invece della barra grigia di sistema).
- **Tastiera nativa mobile**: `interactive-widget=resizes-content` (meta viewport, Chrome/Android) + `--tastiera-inset` misurato via `visualViewport` (fallback iOS Safari) — il modulo si accorge quando la tastiera copre parte dello schermo e il suo scroll interno si attiva davvero, invece di lasciare contenuto invisibile e irraggiungibile.
- **Categorizzazione — "risparmio" 47%→55%** (`bench/categorizer-bench.mjs`, 1500 esempi/25 categorie, riproducibile): zero voci nel dizionario esercenti nonostante fosse una categoria vera con dati di addestramento propri — le frasi sono generiche ("piano di risparmio", "salvadanaio digitale"), non brand, probabile motivo per cui sono sfuggite alla costruzione originale del dizionario. Ogni voce aggiunta verificata riga per riga contro `src/ai/train/data-gen.mjs` per escludere collisioni con le altre 24 categorie (es. mai "risparmio" da solo: compare anche in "eurospin risparmio"→spesa). Accuratezza di prodotto complessiva **82.1%→82.5%**, nessun'altra categoria peggiorata.
- **RESTA** (prossimo batch, discusso ma non iniziato): espansione Mesh P2P (più dispositivi, convergenza più veloce del modello condiviso), nuove capacità predittive, onboarding "3+1 domande", bridge auto-import (iOS Shortcuts/Android Share Target), open banking gratuito, dati di mercato multi-Paese.

## Onboarding adulto: stipendio/budget veri + BUG REALE sul "quanto puoi spendere al giorno" (2026-09-04)
**4404 test verdi.**
- **Obiettivo di risparmio minorenne**: verificato che era già stato completamente collegato in una sessione precedente (commit `3bd788a`, non ancora annotato qui) — `seedProfileStateMinor()` crea davvero un `savingsGoal` (senza cifra, mai un numero inventato), `computeGoalProgress`/`renderSavingsGoals` gestiscono un obiettivo senza cifra come caso di prima classe (CTA "imposta cifra", mai una barra rotta), visibile anche fuori da Analisi Tensor. Corretto solo un commento nel codice rimasto vecchio/contraddittorio.
- **Stipendio e budget veri richiesti SUBITO dopo l'onboarding completo adulto** (`endGenesis()`, main.js): fino ad ora, dopo le 4 domande, `monthlyBudget` restava la STIMA derivata dal profilo di rischio — mai un numero confermato. Riusa esattamente la stessa catena di editor già introdotta per "Parti dai miei dati" (Budget mensile → Il tuo accredito, entrambi skippabili con un tocco), invece di inventare un flusso nuovo. Saltata per un minorenne e per chi arriva da un invito/quick-add in sospeso (quei flussi hanno la priorità). Verificato dal vivo un vero primo avvio (backup+reset IndexedDB): confermati 1200€/mese e 1800€ il giorno 27, entrambi visibili subito in Dashboard.
- **BUG 1 (Cassa Unica ignora il budget) — trovato e risolto, segnalato dall'utente**: "quando inserisco lo stipendio e il budget non viene diviso in modo corretto al giorno". Causa trovata leggendo `cycleAllowance`/`commitmentForecast` (`src/predict/fixed-commitments.js`): appena un utente imposta uno STIPENDIO, la Dashboard passa automaticamente a "Il tuo mese, senza sorprese" (Cassa Unica) come UNICA fonte di "oggi puoi spendere" (`cassaUnicaAttiva` in main.js) — ma quel motore calcolava il pool disponibile SOLO da `stipendio − impegni fissi`, **ignorando completamente il budget mensile che l'utente aveva dichiarato**. Risultato verificato dal vivo: stipendio 1800€ + budget dichiarato 1200€ → prima del fix la card avrebbe proposto "liberi" l'intero stipendio (1800€, ~78€/giorno). **Fix**: il pool del ciclo è ora il MINIMO fra quanto lascia lo stipendio e la quota del budget mensile che spetta al ciclo di stipendio (proporzionale alla sua lunghezza, media 30,44 giorni/mese). Verificato dal vivo dopo il fix: "Oggi puoi spendere 53,13 €" su "1222,08 € liberi", non più 1800€. 4 test nuovi.
- **BUG 2 (settimana a cavallo di due mesi raddoppia il budget) — trovato VERIFICANDO A FONDO il fix del bug 1** (richiesto esplicitamente dall'utente: "verifica sempre budget diviso correttamente per settimana e giorno"), riprodotto in Node con gli stessi identici numeri prima di leggere una riga di codice. **Colpisce ANCHE senza stipendio impostato** (il caso più comune) ed è più esteso del bug 1: `getIsoWeekStatus` (`src/predict/weekly-budget.js`), il motore che alimenta sia l'hero "oggi puoi spendere" sia le risposte del chatbot QA quando non c'è Cassa Unica, sommava il segmento settimanale di OGNI mese toccato dalla settimana reale (lun-dom). Il segmento del mese che sta per chiudersi porta con sé TUTTO il suo riporto se il mese è stato speso poco (corretto isolatamente: "non hai speso, hai ancora tutto il mese") — sommato al budget fresco del mese nuovo, la settimana-ponte prometteva fino al DOPPIO del budget dichiarato. Riprodotto: 1200€/mese, agosto mai speso, oggi 4 settembre → 1440€ "liberi" quella settimana invece di 240€, "oggi puoi spendere" gonfiato a 480€ invece di 80€. **Fix**: un mese già chiuso rispetto a oggi non contribuisce più budget alla settimana-ponte (l'app non porta budget da un mese all'altro per design — quel riporto non esiste, non va inventato per la settimana di passaggio). 2 test di regressione nuovi (uno con agosto mai speso, uno con agosto speso regolarmente — in entrambi i casi ora 240€, mai più il fantasma di agosto).
- **BUG 3/4/5 — LA CAUSA VERA (commit `3345740`), trovata solo dopo che l'utente ha insistito che i fix precedenti non avevano risolto**: utenti veri pronti ad abbandonare l'app perché, definito il budget, sfogliando le settimane all'indietro il numero cambiava ogni volta anche con ZERO spese e stesso stipendio (621,43 / 483,87 / 348,39 / 212,20 / 690,37). I fix 1 e 2 erano corretti ma toccavano solo i confini di mese, non il modello. Tre difetti, stessa famiglia: **(3)** la settimana sommava il RIPORTO delle settimane precedenti (con zero spese la 4ª settimana valeva 4× la 1ª, poi ripartiva al cambio mese) → ora vale la sua **quota di calendario**, misurata stabile fra 338,71 e 350 su 104 settimane consecutive con budget 1500; **(4)** "oggi puoi spendere" era `remaining/giorni-rimasti`, quindi senza spese cresceva ogni giorno fino a proporre l'INTERO budget mensile in 24 ore (56€ → 211€ → **1478€** → poi 50€) → ora limitato alla quota giornaliera, misurato 49,28€ stabile; **(5)** il giorno del mese veniva letto in UTC mentre l'app usa mezzanotte locale — in Europa continentale sbagliava di un giorno per mezza giornata e **il giorno dello stipendio il ciclo collassava a 1 giorno** (budget ~49€ invece di ~1500€). Nuovo `src/predict/garanzia-budget.test.js`: **24 garanzie di proprietà** su stipendio, budget, divisione giornaliera/settimanale e obiettivi (104 settimane indietro, stessa settimana da giorni diversi, anno su anno, febbraio bisestile, ciclo giorno per giorno, impegni fissi, stipendi enormi, obiettivi con/senza cifra, FIRE, budget zero, nessun NaN). **Sono state due garanzie di questa batteria a trovare i bug 4 e 5**, non i test preesistenti. 4437 test verdi.
- **Gap noto, non affrontato in questa sessione**: il chatbot QA ("quanto posso spendere oggi?", `qa-engine.js`) usa sempre il motore budget-puro (ora corretto dal fix 2), mai Cassa Unica — per un utente con stipendio impostato, il numero detto in chat e quello mostrato in Dashboard possono quindi ancora divergere (entrambi corretti nel proprio dominio, ma calcolati da due motori diversi). Richiederebbe unificare le due fonti — non fatto per restare nello scope dei bug segnalati.
- **Gap noto, non affrontato in questa sessione**: la stessa domanda posta al QA testuale ("quanto posso spendere oggi?", `qa-engine.js`) risponde ancora dal motore budget-puro (`getDailySafeToSpend`), mai da Cassa Unica — per un utente con stipendio impostato, il numero detto in chat e quello mostrato in Dashboard possono quindi divergere. Stessa classe di bug "due risposte alla stessa domanda" già risolta altrove nel progetto, ma qui non ancora unificata: richiederebbe passare `fixedCommitments`/`monthlyBudget` al ramo QA e scegliere la stessa fonte unica — non fatto per restare nello scope del bug segnalato.
