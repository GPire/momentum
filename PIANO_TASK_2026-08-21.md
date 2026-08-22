# Momentum — il motore che compone, i dati veri, e un modello che è davvero nostro

*Piano approvato in plan mode il 2026-08-21 (sessione Claude Code fff62129).
Recuperato e salvato qui il 2026-08-22 dopo che era rimasto solo nella
cronologia della sessione (mai persistito come file) e la memoria del turno
successivo lo aveva perso. Da qui in avanti: questo è il documento di
riferimento, non ricostruirlo a memoria.*

## Contesto

Hai chiesto: modelli più avanzati (matematica, statistica, fisica, algoritmi,
finanza, investment banking), analisi all'altezza di chi fa questo mestiere
(trader, investitori, investment banker, JP Morgan/McKinsey/VanEck/Deloitte),
**test d'uso reali** di quei mestieri, **integrazione di modelli AI open source**,
l'espansione dei modelli proprietari (NeuralNexus, Orchestrator, NeuroSym) e
soprattutto **la costituzione dell'SLM di Momentum**.

Ho misurato lo stato attuale prima di pianificare. I numeri sono misurati.

### Diagnosi

| Cosa | Misura | Dove |
|---|---|---|
| Superficie domande personali | **15 famiglie regex chiuse** | `src/ai/qa-engine.js:236-345` |
| Superficie domande mercato | 34 intenti a cascata di parole chiave | `src/alpha/mercato-qa.js:179-345` |
| Quando interviene la semantica | **per ultima**, dopo che tutto ha fallito | `qa-engine.js:762` |
| Quanto separa il modello da solo | **divario grezzo 0,023** | `src/ai/embed-models.js:86` |
| Costo di quel poco | **113 MB** scaricati, opt-in | `embed-models.js:80` |
| WebGPU | **mai usato**: `backend:'wasm'` a mano; `modelloPerDispositivo()` ignora il parametro | `embed-models.js:70,101,185-187` |
| "Cervello AI" mai eseguito | **~1.500 righe** (`omega`, `neurosym`, `executive`, `expert-adapter`, `nb-categorizer`, distillazione Livello A) | `src/ai/calibration-gate.js:6-9` lo ammette |
| Analisi mercati scritte e mai collegate | **853 righe** (`confronto-titoli`, `titolo-causale`, `deterioramento`, `causale-validita`) | `src/alpha/` |
| Pesi ensemble | codificati `0.85` per Meso… **il modello spedito dichiara `0.55`** | `orchestrator.js:250-254` vs `public/momentum_meso_model.json` |
| Ragionamento simbolico / pianificazione | **zero.** Nessun solver, nessun AST, nessuna ricerca | tutto `src/` |
| Reinforcement learning | **non esiste.** `QuantumRL` è un nome esportato | `neural-nexus.js:290` |

**La sensazione di if/else ha una causa architetturale precisa: la superficie
delle domande è una lista chiusa e lo strato semantico arriva per ultimo con
soglia alta.** Lo dice già il commento in testa a
`src/alpha/mercato-canonical-bank.js:4-10`: *aggiungere la centesima stringa non
è intelligenza, è rimandare.*

### Le due scoperte verificate dal vivo che cambiano il piano

**1. La SEC restituisce tutto il mercato in una richiesta.**

```
us-gaap/Revenues/USD/CY2024                     → 2.494 aziende
us-gaap/RevenueFromContractWithCustomer…/CY2024  → 2.964   ┐ unione: 4.762
us-gaap/NetIncomeLoss/USD/CY2024                → 6.047
us-gaap/StockholdersEquity/USD/CY2024Q4I        → 5.987   (le grandezze di STOCK
                                                            vogliono CY####Q#I;
                                                            con CY#### danno 404)
55 giurisdizioni non-USA presenti (CN, HK, IL, SG, GB…)
```

Oggi `fondamentali-storici.js` copre **82 aziende**, una richiesta ciascuna. Con
`frames`: **~5.000 aziende × 19 anni in ~60 richieste.**
E il numero che dimostra perché serve: **il margine netto mediano dell'azienda
quotata USA nel 2024 è 0,2%** (misurato su 4.387 aziende; p10 −515%, p90 +25%).
Le 82 aziende nel repo sono tutte large cap: **raccontano un mondo che non
esiste**, e tutte le soglie scritte a mano in `fondamentali.js` sono tarate lì.

**2. La fisica ha qualcosa da dire, e l'ho misurata.** Sui 9 settori × 330 mesi
del repo, **un solo autovalore (5,522) supera il bordo di Marchenko-Pastur
(1,358)**; il secondo (0,995) e il terzo (0,727) stanno *dentro* la banda di
rumore. Il primo spiega il 61,4%. `panoramica-incrociata.js` e `assorbimento.js`
oggi leggono come struttura anche ciò che potrebbe essere rumore.

---

## La tesi

Non serve un modello più potente: serve **smettere di enumerare domande e
iniziare a comporre risposte**, avere **abbastanza dati** perché la composizione
dica qualcosa che nessun altro dice, e avere **un modello piccolo che è davvero
nostro** invece di 113 MB scaricati che separano di 0,023.

Ogni cantiere chiude con una misura che **può dire di no**: in questa sessione
quattro segnali plausibili su quattro sono stati smontati dai dati.

---

## CANTIERE A — Il motore che compone *(la risposta a "sembra if/else")*

### A1. Una domanda diventa un oggetto tipizzato

Nuovo `src/ai/interrogazione.js`:

```js
{
  operazione: 'descrivi'|'confronta'|'classifica'|'condiziona'|'spiega'|'simula'|'attribuisci',
  soggetti:  [{ tipo:'titolo'|'settore'|'classe'|'portafoglio'|'io'|'mercato', id }],
  misura:    'margine'|'roe'|'rendimento'|'perdita-attesa'|'correlazione'|'percentile'|…,
  finestra:  { da, a } | { evento:'2008' } | { regime:'attuale' } | { ultimi:12 },
  vincoli:   { minCopertura, valuta, alNetto:true }
}
```

### A2. Registro di capacità + pianificatore

Nuovo `src/ai/pianificatore.js`. Ogni modulo dichiara **cosa sa produrre**:

```js
registra({ misura:'margine', soggetti:['titolo'], finestra:'annuale',
           copertura:(q) => …,     // sa rispondere a QUESTA domanda?
           calcola:  (q) => … });  // il numero, deterministico
```

Il pianificatore cerca la composizione. Se non la trova, **dice quale pezzo
manca** invece di "non ho capito".

> **Perché non è if/else:** 7 operazioni × ~14 misure × 6 soggetti × 5 finestre =
> **migliaia di domande** con la stessa quantità di codice. Ogni nuovo modulo che
> si registra **moltiplica**, non aggiunge.

**Guadagno immediato senza scrivere analisi nuove:** collegare i 5 moduli orfani
di `alpha/` come capacità registrate — `confronto-titoli.js` ("meglio Intel o
AMD, e la differenza si distingue dal rumore?"), `titolo-causale.js` (beta/alfa,
chi anticipa chi), `deterioramento.js`, `causale-validita.js`. **853 righe già
scritte e testate diventano raggiungibili.**

### A3. Il rifiuto diventa strutturale

Oggi ~70 pattern in 6 lingue da mantenere (`mercato-qa.js:857-902`). Domani una
regola sull'**operazione**: `operazione:'consiglia'`, o una misura di prezzo con
`finestra:{futuro}`, **si rifiuta per costruzione**, in qualunque lingua, anche
mai vista. Resta il primo controllo assoluto (`qa-engine.js:400`).

### A4. Accendere WebGPU — il guadagno che costa zero

`embed-models.js:70,101`: togliere `backend:'wasm'` scritto a mano; `:185-187`:
`modelloPerDispositivo()` smette di ignorare il parametro. Il repo è già su
`@huggingface/transformers` **4.2.0**, che porta il runtime WebGPU riscritto in
C++ (3-10× su v3). **È installato e mai acceso.** Misurare prima/dopo.

---

## CANTIERE B — I modelli open source *(quello che mi mancava)*

Tutti permissivi, tutti on-device, tutti con un lavoro che sanno fare.

| Modello | Licenza | Peso | Il lavoro che gli diamo |
|---|---|---|---|
| **Model2Vec / Potion** | **MIT** | **8-30 MB** | **Il pezzo più importante.** Distilla *qualunque* sentence-transformer in un modello statico: **15× più piccolo, fino a 500× più veloce su CPU, in 30 secondi, senza dataset.** Distilliamo `e5-small` (MIT) sul vocabolario finanziario di Momentum → **un modello nostro, nel bundle, senza i 113 MB di download, senza dipendere da WebGPU.** |
| **GLiNER** | permissiva | ~50-200 MB, ONNX UINT8 | Estrazione zero-shot di entità: ticker, date, misure, importi. È **esattamente** il riempi-slot del Cantiere A, e regge ~50 tipi di entità senza addestramento. |
| **TinyFinBERT** | permissiva | **14,5 M par.** (7,6× più piccolo di FinBERT, ~99% delle prestazioni) | **Sentiment delle notizie on-device.** Oggi il sentiment arriva **da una sola fonte su quattro** (`news.js`) e senza la chiave Alpha Vantage è sempre `'sconosciuto'`. Questo lo rende nostro e gratuito. |
| **Chronos-Bolt / Kronos** | Apache-2.0 | da **9 M par.** (Bolt fino a 250× più veloce) | **Un esperimento onesto, non una promessa.** Kronos è preaddestrato su candele OHLCV di 45 borse. Lo mettiamo contro il nostro block bootstrap **walk-forward**. Quattro segnali su quattro sono già stati smontati: **questo ha ottime probabilità di essere il quinto, e va pubblicato lo stesso.** |
| **Qwen3-Embedding-0.6B** | Apache-2.0 | già nel registro | Resta l'opzione pesante per chi ha hardware. Oggi raggiungibile solo via `forzaModello`. |
| **Qwen3-0.6B generativo** | Apache-2.0 | **q4f16 = 570 MB verificato** | **Non ancora.** Vedi C3. |

> **La regola d'oro, e la ricerca 2026 la conferma:** gli SLM falliscono
> l'aritmetica, mentre "modelli molto più semplici e piccoli eccellono".
> **Il modello interpreta e parla; il codice calcola.** Nessun numero mostrato
> all'utente esce mai da un modello generativo.

### Licenze: zero euro, e nessuna catena

**Tutti i modelli in tabella sono MIT o Apache-2.0: costo zero, uso commerciale
permesso, modifica e ridistribuzione permesse.** Non c'è nessuna licenza da
pagare, né ora né dopo. L'unica trappola nota è già stata evitata nel repo:
**EmbeddingGemma è sotto Gemma Terms of Use, che non è una licenza OSI**
(`embed-models.js:10-21, 145-147`) — resta nel registro solo come voce
documentata, non va usata.

### E "proprietari" cosa vuol dire davvero

Un modello non diventa nostro perché lo rinominiamo. Diventa nostro in tre modi,
tutti permessi dalle licenze sopra e tutti verificabili:

1. **Pesi derivati che produciamo noi.** Model2Vec distilla `e5-small` (MIT) sul
   **nostro** vocabolario: i pesi risultanti sono un'opera derivata che
   generiamo, distribuiamo e possediamo. MIT lo permette esplicitamente.
2. **Addestramento sul nostro dataset** (C2), che nessun altro ha.
3. **L'architettura che li mette insieme** — pianificatore, confine di rifiuto
   calibrato, correzione geometrica dello spazio (`spazio-momentum.js`, l'unico
   pezzo già oggi genuinamente originale).

**Il fossato non sono i pesi, che chiunque può scaricare: è il dataset etichettato
e il modo in cui i pezzi si compongono.** Chi copiasse i nostri pesi non avrebbe
né le domande tipizzate, né il confine di rifiuto validato, né le capacità
registrate.

---

## CANTIERE C — L'SLM di Momentum *(cosa è davvero costruibile, e cosa no)*

**Prima l'onestà, perché regge tutto il resto.** Addestrare da zero un SLM
generale che competa con Qwen o Claude costa milioni in GPU: non è raggiungibile,
e chiunque faccia due conti lo verifica. **Ma non è nemmeno la cosa giusta da
fare** — un modello generale su hardware da telefono sarebbe peggio di entrambi.

Quello che è raggiungibile *e* genuinamente proprietario sono tre strati.

### C1. Il vocabolario: un modello distillato che è nostro *(fattibile subito)*

Model2Vec su `e5-small` (MIT), distillato sul **nostro** vocabolario: le 88
formulazioni canoniche, le 15 famiglie di mercato, i termini di bilancio, i
ticker, le sei lingue del rifiuto. Risultato atteso: **~8-30 MB nel bundle**
invece di 113 MB da scaricare, con inferenza sincrona.

Questo **capovolge l'economia dello strato semantico**: se il modello è già lì e
costa millisecondi, smette di essere l'ultima spiaggia con soglia alta e diventa
il **primo** passo del parser. È il cambio singolo con più effetto sulla
sensazione di "vera intelligenza".

### C2. Il dataset che nessun altro ha *(il vero fossato)*

Il fossato non sono i pesi — sono **i dati etichettati**:

1. **(domanda → interrogazione tipizzata)**, generabile **combinatoriamente** dal
   registro di capacità del Cantiere A: ogni capacità sa enunciare le domande a
   cui risponde, in 6 lingue. Decine di migliaia di coppie senza annotare a mano.
2. **Il confine del rifiuto**, con la asimmetria già misurata e testata.
3. **Le correzioni reali degli utenti**, dal canale `qa-learning.js` che già
   esiste (≥2 conferme prima di applicare), e dalla distillazione federata
   Livello A che **è già scritta e mai invocata** (`mesh/federated-distillation.js:107-219`).

Nessun competitor ha un corpus di domande finanziarie **con intento tipizzato e
confine di rifiuto validato**, perché nessuno ha dovuto costruire il rifiuto.

### C3. La plasticità: impara sul dispositivo, non torna mai indietro

L'infrastruttura c'è già e non è marketing: `hashed-logreg.js:126-170` **addestra
in JS** (SGD con lr decadente + L2), `neural-nexus.js:84-132` fa **backprop vera**
(cross-entropy, clipping, L2). Si applica al riempi-slot: **il tuo Momentum
capisce le tue formulazioni**, e la mediana per coordinata della distillazione
federata porta il miglioramento agli altri senza che un dato esca.

**La decisione sui 570 MB del generativo: rimandata dietro una misura.**
Costruiamo C1 + GLiNER, misuriamo il residuo sui banchi del Cantiere E, e
decidiamo con un numero. È anche il modo onesto di rendere l'SLM più avanzato:
dargli un lavoro che sa fare (interpretare) invece di uno che non sa fare
(rispondere).

### C4. I tre modelli proprietari — cosa fare di ciascuno

| Modello | Stato reale misurato | Cosa fare |
|---|---|---|
| **NeuralNexus** | Backprop vera (`:84-132`), **ma `predict()` ritorna `confidence:75` da `CAT_RULES` prima di interrogare la rete** (`:177-179`), e gli embedding partono da `Math.random()` (`:47-49`) con "prior" scritti a mano | Togliere la scorciatoia; **inizializzare gli embedding dai vettori statici di C1** invece che dal rumore. Una rete che parte da una geometria che ha senso invece che dal caso è un cambio di sostanza, non di etichetta |
| **Orchestrator** | Pesi codificati `0.8/0.85/0.80` (`:250-254`), **mentre il modello spedito dichiara `0.55`** e `bench/train-eval.mjs:37` usa `0.55/0.75`. `nexusWeight = min(0.8, 0.2+parole/500)` è una curva arbitraria | Sostituire le costanti con **accuratezze misurate su held-out al caricamento**. Promuovere `conformal.js` e `calibration-gate.js` — già scritti — a cittadini di prima classe. È un **bug misurabile che costa accuratezza adesso** |
| **NeuroSym** | Façade di 76 righe, **orfana**, con un `explain()` che restituisce un oggetto scritto a mano dichiarato "per la due diligence" (`:60`) | **Renderla vera**: diventa la faccia pubblica del **pianificatore** (Cantiere A), e `explain()` restituisce **la catena di composizione realmente usata** — quali capacità, quali dati, quale copertura. È la versione onesta di "un solo cervello", ed è anche l'unica che sopravvive a chi verifica |

### C5. Un linguaggio più performante? — **misurare prima, portare poi**

La ricerca 2026 è netta: WASM/Rust rende **8-10×** (10-15× con SIMD) ma **solo**
su cicli numerici stretti che pesano >10% della CPU; su tutto il resto non fa
nulla o peggiora. I candidati veri qui sono **i test di permutazione (999
iterazioni × block bootstrap)** e le decomposizioni ad autovalori. E Model2Vec ha
già un'implementazione Rust compilabile a WASM.

**Ma il guadagno più grande disponibile oggi costa zero righe di Rust: WebGPU è
installato e mai acceso (A4).** Prima quello, poi il profilo, poi eventualmente
Rust — non il contrario.

---

## CANTIERE D — I dati: da 82 a ~5.000 aziende *(il pezzo JP Morgan / McKinsey)*

Nuovo `bench/fetch-panel-sec.mjs` → `src/alpha/panel-settoriale.js`.

1. **~60 richieste `frames`** (5 concetti × 19 anni), riusando i tre bug SEC già
   risolti in `bench/fetch-fondamentali-sec.mjs`: unione dei nomi contabili,
   flusso vs stock, `end` invece di `fy`.
2. **Settore SIC + ticker** da `data.sec.gov/submissions/CIK##########.json`
   (verificato: restituisce `sic`, `sicDescription`, `tickers`, `exchanges`).
   Una passata a <10 req/s a tempo di sviluppo.
3. **Voci nuove indispensabili**: `Assets`, `Liabilities`,
   `CashAndCashEquivalents…`, `NetCashProvidedByUsedInOperatingActivities`,
   `OperatingIncomeLoss`. **Con i 6 campi attuali F-score, Z-score e M-score sono
   impossibili** — è questo che oggi blocca l'analisi di bilancio seria.
4. **Compressione — non spediamo 5.000 aziende:**
   - **tabelle di percentili** per settore SIC × anno × misura (~12 × 19 × 6 × 9
     ≈ 12.000 numeri ≈ **70 KB**)
   - righe complete delle prime **~600 aziende** per ricavi

### Cosa sblocca, in una riga

> Oggi: *"il ROE è 15%, sopra la soglia 0,15 che abbiamo scritto a mano."*
> Domani: **"il ROE del 15% è il 78° percentile del suo settore nel 2024 — e nel
> 2009 lo stesso 15% era il 91°."**

Le soglie smettono di essere costanti e diventano **posizioni nella popolazione
reale**. Attacca il buco documentato di Yahoo Finance (pochi anni di fondamentali
anche a pagamento, mentre l'analisi seria ne vuole 10-20) e di Bloomberg
Intelligence (~32.000 $/anno, dati difficili da estrarre verso modelli propri).

**Poi si accendono, con dati veri:**
- **Comparables**: `factors.js:27` accetta già un parametro `peers` che **nessun
  chiamante popola mai**.
- **Screener multi-criterio**: oggi `qualita-nel-tempo.js:142` ordina 82 aziende
  per **una** misura.

---

## CANTIERE E — Matematica, statistica, fisica *(validate o dichiarate)*

**E1. Pulizia della matrice di correlazione (RMT / Marchenko-Pastur).**
Corregge un difetto reale: `panoramica-incrociata.js` e `assorbimento.js` oggi
leggono anche autovalori indistinguibili dal rumore.
⚠️ **Con un fattore dominante (61,4%) il bordo MP ingenuo non si applica**: va
rimosso prima il modo di mercato e usata la MP generalizzata su correlazione
sottostante non banale. **Validazione: protocollo Potters-Bouchaud** (calibra
in-sample, misura il rischio *realizzato* out-of-sample).

**E2. Rischio di rovina e dimensionamento — il pezzo trader.**
La ricerca è netta: **la dimensione della posizione pesa più del tasso di
vincita** (2% per operazione → 40-60% di rovina in 1.000 operazioni; 1% → sotto
il 5%). **Matematica deterministica sul portafoglio REALE dell'utente, non un
consiglio.** Si aggancia a `forced-sale-risk.js` e `portfolio-tail-risk.js`, che
già leggono `state.positions`.

**E3. Piotroski F-score, Altman Z-score, Beneish M-score**, sui campi nuovi di D
e **validati walk-forward sul pannello**, non copiati da un manuale. La ricerca
2026 dice che il valore degli accrual si è eroso: **la misura conta più
dell'implementazione.**

---

## CANTIERE F — I banchi trader / investitore / investment banker *(il cancello)*

`src/ai/qa-banco-prova.js` **esiste già**, separa **copertura** da **sicurezza** e
conta a parte "non ho capito" e "ho capito male" — ed è **orfano**, usato solo dal
suo test. Diventa il cancello della sessione.

| Banco | Esempi |
|---|---|
| `BANCO_TRADER` | "quanto rischio per operazione prima di non rialzarmi più?", "le mie posizioni sono la stessa scommessa?", "il mio portafoglio nei mesi veri del 2008", "quanto ho rischiato davvero, non quanto pensavo" |
| `BANCO_INVESTITORE` | "questa tesi regge ancora?", "in che percentile del suo settore sta?", "quanto sono concentrato senza saperlo?", "su quale numero un investitore uscirebbe?" |
| `BANCO_BANKER` | "chi somiglia a questa azienda sui conti?", "i margini sono qualità o ciclo?", "questi accrual sono normali per il settore?", "com'era il percentile all'anno dell'acquisto?" |

**In ognuno la quota di domande da RIFIUTARE resta alta**: sono i mestieri in cui
il consiglio non richiesto costa di più. Resta la regola già scritta in
`qa-banco-prova.js:197-213`: *un aumento di copertura pagato con un solo rifiuto
mancato non è un miglioramento.*

**Nessun cantiere si dichiara finito senza i tre banchi prima e dopo.**

---

## CANTIERE G — Le sezioni di analisi, per mestiere *(cosa vede davvero l'utente)*

Ogni voce è una **capacità registrata** nel pianificatore, quindi diventa
raggiungibile sia da una card che da una domanda in linguaggio naturale, senza
scrivere due volte la stessa cosa.

| Per chi | Sezione nuova | Su quali dati |
|---|---|---|
| **Trader** | **Quanto rischi per operazione prima di non rialzarti più** — rischio di rovina e dimensionamento sul portafoglio vero | E2 + `state.positions` |
| **Trader** | **Le tue posizioni sono la stessa scommessa?** — numero efficace di scommesse dopo la pulizia RMT, non il conteggio dei ticker | E1 + `portfolio.js` |
| **Trader** | **Il tuo portafoglio nei mesi veri del 2008** — non una simulazione, i mesi realmente accaduti con la tua cassa e le tue spese | `forced-sale-risk.js` (già scritto) |
| **Investitore** | **In che percentile del suo settore sta** — e com'era all'anno in cui l'hai comprata | D |
| **Investitore** | **Meglio questa o quella, e la differenza si distingue dal rumore** — 999 permutazioni | `confronto-titoli.js` (**già scritto, orfano**) |
| **Investitore** | **È bravura o è il mercato?** — scomposizione beta/alfa, chi anticipa chi | `titolo-causale.js` (**già scritto, orfano**) |
| **Banker** | **Chi somiglia a questa azienda sui conti** — comparabili veri sul pannello, non una lista scritta a mano | D + `factors.js:27` (il parametro `peers` che nessuno popola) |
| **Banker** | **Screener multi-criterio** — oggi si ordina per **una** misura su **82** aziende; domani si filtra e combina su ~5.000 | D |
| **Banker** | **Qualità dei conti**: F-score, Z-score, M-score **con il loro guadagno misurato** accanto, non il punteggio nudo | E3 |
| **Tutti** | **Cosa non so** — il pianificatore dice *quale pezzo manca*, con la copertura dichiarata | A2 |

---

## CANTIERE H — Notizie *(tre buchi, tutti chiudibili)*

1. **Le notizie non sanno cosa possiedi.** `fetchAssetNewsCascade`
   (`main.js:11818`) si attiva **solo** quando l'utente cerca un titolo. Nessun
   codice scorre `state.positions` — mentre `main.js:13128` **già lo fa** per i
   prezzi. L'infrastruttura c'è, manca il collegamento.
2. **Il sentiment arriva da 1 fonte su 4.** Senza la chiave Alpha Vantage è
   sempre `'sconosciuto'` (onesto, ma inutile). **TinyFinBERT on-device**
   (14,5 M parametri, ~99% di FinBERT) lo rende nostro e gratuito, in ogni lingua
   che sappiamo tradurre.
3. **173 righe di pipeline RSS ufficiale sono codice morto.**
   `notizie.js:137 prendiNotizie()` non è chiamata da nessuno tranne il suo test
   — ed è l'unica fonte **senza chiave e con licenza pulita** (Fed, BCE, Federal
   Register). ⚠️ **Ma quei domini non espongono CORS**: o si dichiara il limite,
   o si sceglie una fonte equivalente che il browser può leggere. Non si finge
   che funzioni.

---

## CANTIERE J — Multilingua *(il progetto non è italiano)*

### Cosa c'è già, e il buco che nessuno ha notato

`src/i18n/` esiste: `detect.js` rileva **6 lingue** (`it, en, es, fr, de, pt`) e
`resolveDeviceLanguage()`/`resolveUiLanguage()` **leggono già la lingua del
dispositivo**. Ma `ui-strings.js:25` traduce l'interfaccia in **4 sole lingue**
(`it, en, de, fr`).

⚠️ **Spagnolo e portoghese sono riconosciuti ma l'interfaccia non li parla.** È
una vittoria gratuita che sta lì da mesi.

**Il buco vero è però più profondo:** le migliaia di frasi che l'utente legge
davvero — `testoTesi()`, `testoQualita()`, `testoPreavviso()`, tutti i referti di
`alpha/` — **sono italiano scritto dentro il codice**, non chiavi in
`ui-strings.js`. Nessun catalogo di traduzioni le raggiunge.

### La soluzione: si traduce a tempo di compilazione, e **il giudice è il modello di Momentum**

Hai chiesto un modo innovativo, istantaneo, che passi dai nostri modelli e non
appesantisca il progetto. C'è, e la ricerca lo conferma.

**Prima il vicolo cieco, così si capisce perché la via giusta è un'altra.** I
modelli di traduzione on-device esistono (opus-mt in ONNX per transformers.js,
58 coppie di lingue): pesano **~100 MB per coppia**, quantizzati. Cinque lingue =
mezzo giga scaricato dall'utente per tradurre **testo che è nostro e che
conosciamo già**. È esattamente l'appesantimento da evitare.

**L'osservazione che sblocca tutto: il nostro testo non è generato dagli utenti.
È nostro, finito e conosciuto in anticipo.** Quindi non va tradotto quando
l'utente apre l'app — va tradotto **una volta sola, da noi, e verificato.**

```
1. ESTRAZIONE   ogni frase → chiave + slot tipizzati
                (i numeri restano numeri: mai tradotti, mai toccati)
                ↓
2. TRADUZIONE   opus-mt gira in bench/, sulla macchina di sviluppo.
                NON viene spedito. La sua dimensione è irrilevante.
                ↓
3. IL CANCELLO  ri-traduzione all'indietro, e la somiglianza fra originale e
   ⭐           ritorno è misurata da semantic-embed.js + spazio-momentum.js
                — cioè DAL MODELLO DI MOMENTUM. Soglia calibrata con lo stesso
                metodo di calibraSoglia(), non scritta a mano.
                ↓
4. SERRATURA    glossario finanziario bloccato: se il giro di andata e ritorno
                fa slittare un termine dell'elenco, la frase non passa.
                ↓
5. SE NON PASSA la frase NON si spedisce tradotta: resta in inglese, marcata.
                ↓
6. SI SPEDISCE  solo JSON. Decine di KB per lingua. Modelli a runtime: ZERO.
                Per l'utente la traduzione è istantanea perché è già lì.
```

**Perché il passo 3 è l'innovazione, e non un'idea carina:** la stima della
qualità di traduzione tramite **giro di andata e ritorno + embedding di frase** è
un metodo pubblicato e validato, e la ricerca 2026 mostra una **forte
correlazione positiva fra i punteggi COMET-Kiwi e la somiglianza semantica del
round-trip** calcolata con embedding multilingua. Momentum **ha già** un
embedding multilingua (`multilingual-e5-small`) **e** la correzione geometrica
che rende quelle somiglianze davvero informative — il divario misurato passa da
**0,023 a 0,220** con `spazio-momentum.js`. Senza quella correzione un giudice
del genere non funzionerebbe: **il pezzo più originale del progetto trova qui il
suo secondo lavoro.**

**Perché la serratura del glossario non è paranoia:** questo progetto ha già
avuto un correttore di refusi che riscriveva **"perdere" in "spendere"**. Su
"utile", "rendita", "scoperto", "posizione corta" un traduttore automatico fa
danni peggiori — e in un'app di soldi non è un refuso.

**E il punto 5 è la stessa regola di tutto il resto del progetto**: `portfolio-tail-risk.js`
rifiuta di rispondere sotto il 50% di copertura invece di mentire. Qui una frase
che non supera il cancello resta in inglese invece di dire una cosa sbagliata sui
soldi di qualcuno.

### Coerente con come è stato fatto l'italiano

L'italiano resta **scritto a mano**, con cura, ed è la sorgente. Le altre lingue
sono **generate e poi misurate**, con una soglia calibrata sui dati. È la stessa
disciplina applicata ovunque: non si afferma che una cosa funziona, la si misura
— e se non passa, si dichiara invece di spedirla.

**Si aggancia al Cantiere A e al Cantiere I:** le frasi composte da numeri (i
referti di `alpha/`) diventano **modelli di frase con slot tipizzati** — è lo
stesso movimento del pianificatore, nell'altra direzione (calcolo → referto
tipizzato → frase). E la prova del bambino di otto anni si applica **per lingua**,
come test.

### Le lingue, scelte dai dati e non a gusto

Dall'indice di adozione cripto 2025-2026 e dai dati fintech:
**India 1ª** al mondo per adozione dal basso, **USA 2ª**, **Pakistan 3ª**,
**Vietnam 4º**, **Brasile 5º con il 20,6% della popolazione che detiene cripto**;
Indonesia e Filippine in top-10 (Indonesia **+103%** di valore on-chain in 12
mesi); Giappone con oltre **35.000 esercizi** che accettano cripto; Germania al
**10,2%** dei pagamenti e-commerce.

| Priorità | Lingue | Perché |
|---|---|---|
| **Subito (gratis)** | **es, pt** | Già rilevate da `detect.js`, mancano solo in `ui-strings.js`. Il Brasile è il 5° mercato cripto al mondo. |
| **Poi** | **id** (indonesiano), **hi** (hindi), **ja** (giapponese) | I tre mercati con la crescita più forte misurata, e tre alfabeti/strutture diverse che mettono alla prova il narratore per davvero. |
| **Dopo** | vi, tl, ur, zh, ar | ⚠️ **ar** e **ur** richiedono il layout **da destra a sinistra**: non è una traduzione, è un lavoro di UI. Va pianificato, non improvvisato. |

### Il testo che NON è nostro

Titoli di notizie, nomi di aziende, contenuti esterni: quelli sì arrivano a
runtime e non si possono pre-tradurre. Lì restano `alpha/translate.js` (oggi
MyMemory) e, come miglioramento progressivo, l'**API Translator integrata in
Chrome** — on-device, gratuita, senza chiave.
⚠️ **Ma non può essere la fondazione**: funziona **solo su desktop, non su
mobile**, e richiede **22 GB liberi**. Per una PWA mobile-first è un extra, mai
il fondamento — e mai per il nostro testo, che passa dal cancello sopra.

---

## CANTIERE I — UI/UX anti-abbandono *(«lo apre e si preoccupa»)*

Hai detto la cosa più importante di tutta la sessione: **oggi un utente apre
Momentum e si preoccupa — sembra difficile da capire e da usare.** I dati che ho
misurato ti danno ragione con precisione.

### Perché si preoccupa — misurato, non intuito

| Cosa vede | Misura | Dove |
|---|---|---|
| Orb 3D prima di qualunque numero | **~40% della prima schermata** (260-350 px) | `index.html:3034`, `main.js:2165-2212` |
| Livelli di predizione **sopra** le tessere numeriche | **6** (cassa, prossima spesa, insight, divisione spese, mercati, QA) | `index.html:3077-3122` |
| Avviso "questi dati sono finti" | **sotto tutti e sei** | `index.html:3128` |
| Card nella vista Analisi | **41** | `index.html:3238-3575` |
| Funzione principale (importare) | **3ª card dentro una tab chiamata "Vault"**, zero CTA in Dashboard | `index.html:3606` |
| Categorie in cui finisce la vita di una persona | **5** | `constants.js:14-26` |

**Sei previsioni su dati finti, prima ancora di un numero vero, con l'avviso in
fondo.** Non è un difetto estetico: è la ragione per cui sembra difficile.

### I principi, e come si verificano

**1. Un focus per schermata.** La prima schermata risponde a **una** domanda con
**un** numero, **una** frase e **una** azione. Tutto il resto scende sotto la
piega o entra in Analisi. L'orb resta, ma **dopo** il numero, non al posto suo.
*Verifica:* conteggio degli elementi interattivi sopra la piega, per classe di
dispositivo, come test.

**2. Responsive nativo per dispositivo, non per larghezza.** Non basta un
breakpoint: si distingue **tipo di puntatore** (`pointer: coarse` vs `fine`),
**hover disponibile** (`hover: hover`), **altezza** oltre alla larghezza,
**orientamento**, e `prefers-reduced-motion`. Telefono, tablet, desktop e schermo
grande ricevono **gerarchie diverse**, non la stessa griglia stirata. Le card
usano **container queries**, così si adattano al contenitore e non alla finestra.
*Verifica:* prova dal vivo in Chrome su 4 formati + touch e tastiera, non solo
il ridimensionamento.

**3. Micro-animazioni con un motivo, e un budget.** Ogni animazione deve
**dire qualcosa**: conferma di uno stato cambiato, direzione della navigazione,
un valore che si muove. Mai decorazione. Solo `transform` e `opacity` (mai
proprietà che ricalcolano il layout), durate 120-240 ms, curve coerenti, e
**`prefers-reduced-motion` rispettato ovunque**.
*Verifica:* nessuna animazione su proprietà di layout, come test sul CSS.

**4. Neurocolori.** Il colore **codifica** (entra/esce, quanto rischio) e resta
coerente ovunque; **mai il colore da solo** come unico canale (numero e parola
accanto, sempre). E il rosso non è il default: il codice ha già l'istinto giusto
a `main.js:2175-2187` — evita l'allarme rosso 26 giorni su 30 — **va
generalizzato a tutta l'app**, non lasciato in una card.

**5. Neurotesto, neurolinguaggio, fonetica.** Frasi corte, concrete, il numero
prima della parola, zero gergo non spiegato. **La prova del bambino di otto
anni**, applicata come test automatico e non come opinione: lunghezza della
frase, parole gergali in elenco, e la classe di errori di preposizioni articolate
già colpita 3+ volte in questa serie ("In il 2008", "Su gli ultimi 26 anni").
*Verifica:* un test che passa su ogni stringa rivolta all'utente. È la stessa
disciplina dei numeri, applicata alle parole.

**6. Anti-abbandono.** I punti di attrito sono già misurati sopra: import
sepolto, categoria non correggibile, 41 card, e un demo dataset che riempie lo
schermo e **toglie l'ultimo motivo per importare i propri dati**. Vanno
affrontati come un blocco unico, perché è un unico imbuto.

---

## La tua domanda diretta: ottimizzare o aggiungere?

Voce per voce, col file che lo dimostra.

| Cosa | Verdetto | Perché |
|---|---|---|
| **Dashboard** | **TOGLIERE**, non aggiungere | L'orb 3D occupa il **~40% della prima schermata** (`index.html:3034`), e **sopra** le tessere numeriche arrivano 6 livelli di predizione su dati ancora **finti** — il banner "è un esempio" sta *sotto* tutto (`index.html:3128`). La vista Analisi ha **41 card**. Chiede fiducia prima di averla guadagnata. |
| **"Carica i tuoi movimenti" / "Importa tutto"** | **AGGIUNGERE — è la priorità #1 di prodotto** | È la **3ª card dentro la tab chiamata "Momentum Vault"** (`index.html:3606`), cioè le Impostazioni. In tutta la Dashboard **non esiste una sola CTA di import**. E il demo dataset, riempiendo lo schermo, toglie l'ultimo stimolo a cercarla. Va in cima finché non ci sono dati veri. |
| **Riconoscimento transazioni** | **CORREGGERE — c'è un bug misurabile adesso** | I pesi usano `mesoAcc = 0.85` codificato (`orchestrator.js:251`), ma **il modello spedito dichiara `hard_noisy_test_accuracy: 0.55`** e `bench/train-eval.mjs:37` usa 0,55/0,75. E `neural-nexus.js:177-179` ritorna `confidence:75` da `CAT_RULES` **prima** di interrogare l'unica rete che impara online. |
| **Categorie** | **AGGIUNGERE — il difetto di qualità dei dati più grave** | **5 categorie di spesa** (`constants.js:14-26`). Mancano Casa/Affitto, Bollette, Salute, Istruzione, Viaggi, Tempo libero. La prova è nell'app stessa: il demo mette **Affitto 650 € e la bolletta della luce in "Abbonamenti"** (`demo-dataset.js:57-61`). "Dove vanno i tuoi soldi" diventa una torta che non dice niente. |
| **Correggere una categoria** | **AGGIUNGERE — sblocca tutto l'apprendimento** | La riga di un movimento ha **solo il cestino** (`main.js:2424`): non esiste `editTx` in tutto il codice. Dopo un import di 2.000 righe l'unica azione è **eliminare** — e tutta l'infrastruttura di `orchestrator.js:97-194` è alimentata da correzioni che **non hanno un canale**. |
| **Robustezza import** | **CORREGGERE** | `reader.readAsText(file)` senza encoding (`csv-parser.js:305`) → **solo UTF-8**, mentre molti export bancari italiani sono Windows-1252: accenti rotti in silenzio. Le date sono **sempre** lette giorno-primo (`pdf-parser.js:405-410`): un CSV americano `MM/DD/YYYY` è sbagliato senza avviso. `TEXT_MONTHS` ha 12 mesi IT ma solo 8 EN. |
| **Codice morto import** | **CANCELLARE** | `handleUniversalCSV` (175 righe, con una **seconda** logica di dedup) e `handlePDFUpload` sono importati in `main.js:173,175` e **mai chiamati**: due pipeline CSV parallele con regole diverse. |

### Momentum Vault — tre cose, in ordine di gravità

1. ⚠️ **L'export "DNA" è una trappola di perdita dati.** `main.js:9514-9529`
   produce Base64 **non cifrato** con la **stessa estensione `.momentum`** delle
   buste AES-GCM, accanto a CSV/PDF/Screenshot come se fosse un formato — e
   **nessuna funzione lo rilegge** (`backup.js:129`: *"File di backup non
   riconosciuto"*). In un'app senza server, chi scopre cambiando telefono di non
   avere un backup è il fallimento peggiore possibile.
2. **Lo stato vivo non è cifrato a riposo.** `vault.js:207-212` scrive in
   `localStorage` **in chiaro** più una copia **Base64** (`omega_shadow_vault`),
   che è un rilevatore di corruzione, non crittografia. La cifratura vera
   (AES-GCM 256, PBKDF2 210.000 iterazioni, Shamir 2-su-3) esiste **solo
   nell'export** ed è fatta bene: **il pezzo difficile è già scritto, va applicato
   anche allo stato vivo.**
3. **`positions` non è nello schema** e **`manualAssets` non è mai scritto da
   nessuna parte** (letto in 4 punti, popolato da zero). Le posizioni entrano
   **solo da CSV**, senza un campo di input in tutta l'app: **tutto il layer più
   prezioso — tail risk, diagnosi istituzionale, track record — resta spento** per
   chi non prepara un file a mano. E senza lotti né date, `net-return.js` non può
   fare FIFO né distinguere breve/lungo termine.

---

## L'ordine che ho scelto, per impatto sull'utente

Mi hai chiesto di decidere io. Ecco l'ordine e il perché.

Mi hai dato tu la decisione sull'ordine — e poi mi hai detto che **un utente lo
apre e si preoccupa.** Questo cambia la testa della fila: il motore più elegante
del mondo non serve a chi chiude l'app prima di arrivarci.

| # | Cantiere | Perché qui | Stato (aggiornato 2026-08-22) |
|---|---|---|---|
| **1** | **I + la porta d'ingresso** — prima schermata, import in Dashboard, categorie 5→~11, correzione di categoria, encoding/date, trappola "DNA" | È ciò che l'utente **sente**. | ✅ FATTO (21/08) |
| **2** | **C1 + A4** — Model2Vec + WebGPU | Un modello **nostro** da 8-30 MB nel bundle, WebGPU acceso (è già installato). | ✅ FATTO (C1 sì; A4 misurato e tenuto spento con dati a supporto) |
| **3** | **A1-A3** — interrogazione + pianificatore + rifiuto strutturale | La risposta a "sembra if/else". | ✅ FATTO |
| **4** | **F** — i tre banchi (trader / investitore / banker) | Prima dei dati, non dopo: senza un metro, D ed E sono scommesse. | ❌ NON FATTO — prossimo passo |
| **5** | **D** — il pannello SEC (~5.000 aziende × 19 anni) | Il salto di copertura più grande disponibile. | ❌ NON FATTO |
| **6** | **E** — RMT, rischio di rovina, F/Z/M | Dipende da D per i campi di bilancio e da F per essere giudicato. | ❌ NON FATTO (solo lo strato dati grezzo preparato in anticipo, commit cf20588 — non le formule) |
| **7** | **G + H + B + C4** — sezioni per mestiere, notizie, modelli open source, i tre modelli proprietari | Innesto, non chirurgia, una volta che A/D/E esistono. | ❌ NON FATTO |
| **8** | **J** — multilingua col cancello semantico | Va dopo C1 (il giudice è il modello di Momentum) e dopo A. | 🟡 solo il glossario fatto (82ef134); es/pt in `ui-strings.js` (eccezione "gratis" anticipata) ancora da fare |

**Il Vault (cifratura a riposo dello stato vivo, `positions` nello schema,
inserimento manuale delle posizioni) resta dopo il punto 1**, dove entra solo la
trappola "DNA" perché quella fa perdere dati.

---

## Cosa NON entra, e perché

- **Opzioni, greche, volatilità implicita, superficie**: servono dati che non
  abbiamo e non sono gratuiti. Dichiararlo è meglio che approssimarlo.
- **Duration/convexity/OAS per emittente**: idem. Oggi `portfolio-import.js:41`
  scrive `assetClass:'bond'` e poi lo tratta come un'azione — **va dichiarato
  come limite**, non finto.
- **Addestrare un SLM generale da zero**: non raggiungibile e non desiderabile
  (vedi C).
- **LLM esterni per "imparare da internet"**: resta la linea on-device, con la
  sola eccezione BYOK già esistente (`chat-fallback.js`, chiave dell'utente,
  etichettata "non è Momentum").
- **`AI_MODELS_PROBLEMS_SOLUTIONS.md`** contiene benchmark di competitor e
  cronologie normative non verificabili — cioè ciò che
  `ANALISI_COMPETITOR.md:28` dichiara di rifiutare per principio. Va allineato o
  marcato come bozza prima che lo legga qualcuno che verifica.

---

## Verifica

1. **`npm test`** — i 3.356 test attuali restano verdi; ogni cantiere ne aggiunge.
   *(2 test — voice/intent-segmenter e mesh-signaling — falliscono a volte sotto
   carico parallelo e passano sempre in isolamento: rumore noto.)*
2. **I tre banchi del Cantiere F**, prima e dopo ogni cantiere, con il **veto
   della sicurezza**. Copertura e sicurezza in numeri, mai "sembra meglio".
3. **`npm run build`** con **peso del bundle dichiarato** — i dati incorporati
   sono già **1.665 KB, il 69% di `src/alpha/`**. C1 deve farlo **scendere**.
4. **Prova dal vivo in Chrome** con `npx vite preview` (mai `vite dev`: i
   sourcemap gonfiano di 4×). Ogni sessione di questa serie ha trovato dal vivo
   bug che i test non vedevano. **Per il Cantiere I: quattro formati reali
   (telefono, tablet, desktop, schermo grande) × puntatore grosso e fine**, non
   il solo ridimensionamento della finestra — e sempre verificando anche lo stato
   *chiuso* dopo un fix sullo stato *aperto* (è la classe di bug che ha già
   lasciato lo schermo scurito in permanenza su desktop).
5. **Test automatici nuovi per la UI/UX**, perché "sembra più semplice" non è una
   misura: elementi interattivi sopra la piega per classe di dispositivo;
   nessuna animazione su proprietà che ricalcolano il layout;
   `prefers-reduced-motion` rispettato; e la **prova del bambino di otto anni**
   su ogni stringa rivolta all'utente (lunghezza della frase, gergo, preposizioni
   articolate concatenate).
5. **Segnali predittivi (E1, E3, Chronos): walk-forward, solo il passato**, e il
   risultato si pubblica **anche quando è negativo**.
6. **Cantiere D**: il pannello si rifiuta di rispondere sotto una soglia di
   copertura dichiarata, invece di dare un percentile calcolato su quattro
   aziende.
7. **Cantiere J**, tre cancelli invece di uno:
   - il test già presente in `ui-strings.test.js:69-72` (*"nessuna chiave può
     ripiegare sulla chiave grezza"*) esteso a **ogni lingua nuova** e a ogni
     referto tipizzato;
   - la **soglia di andata e ritorno calibrata** (non scritta a mano) e la
     **serratura del glossario**: quante frasi passano e quante restano in
     inglese va **dichiarato per lingua**, non nascosto;
   - il **rifiuto verificato in quella lingua** — "cosa devo comprare?" deve
     essere respinto in indonesiano come in italiano. Un rifiuto che vale solo
     in italiano protegge solo gli italiani.
   ⚠️ E il peso spedito per lingua va dichiarato: se un catalogo supera qualche
   decina di KB, qualcosa è finito nel bundle che non doveva starci.
8. **Licenze**: un test che fallisce se un modello nel registro non è MIT o
   Apache-2.0. La trappola Gemma è già stata evitata una volta a mano — la
   seconda volta la deve trovare il test.
