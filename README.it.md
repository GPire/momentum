<div align="center">

# Momentum

### L'intelligenza finanziaria che vive dentro il tuo dispositivo.

**Nessun server. Nessun abbonamento. Niente esce dal tuo telefono.**

[![test](https://img.shields.io/badge/test-4599%20verdi-brightgreen)](#verificalo-tu-30-secondi)
[![on-device](https://img.shields.io/badge/AI-100%25%20on--device-blue)](#lunica-cosa-che-la-rende-diversa)
[![no cloud](https://img.shields.io/badge/cloud-nessuno-blue)](#lunica-cosa-che-la-rende-diversa)
[![PWA](https://img.shields.io/badge/PWA-funziona%20offline-blue)](#funziona-senza-campo)
[![dipendenze minime](https://img.shields.io/badge/dipendenze%20runtime-1-blue)](#avvio-rapido)

[English](README.md) · **Italiano**

</div>

---

## In 10 secondi

Le app di finanza personale si abbandonano per due motivi: **scrivere ogni spesa a mano** e **numeri che non dicono niente**.

Momentum risponde alla domanda che ti fai davvero — **"quanto posso spendere oggi?"** — e fa i conti dove i tuoi dati già stanno: sul tuo dispositivo.

C'è un terzo motivo, più silenzioso, per cui si abbandonano le app di finanza: ogni notifica è pensata per farti temere di perdere un badge, una serie, un livello. L'unico feedback di Momentum è *"il tuo andamento è capito, il tuo numero è vero"* — la dopamina del controllo, non quella dell'inseguimento.

**È per te se:**
- vuoi sapere quanto puoi spendere **oggi**, non un grafico del mese scorso
- hai la **Partita IVA** e le scadenze fiscali ti mettono ansia (Italia 🇮🇹 e Svizzera 🇨🇭)
- **investi** e vuoi il rendimento *dopo le tasse*, non quello della brochure
- non vuoi la tua vita bancaria sul server di qualcun altro

## L'unica cosa che la rende diversa

Ogni altra app di finanza ha un server. Quel server **è** il prodotto: tiene i dati, e i dati sono il modello di business.

Momentum ribalta tutto. **Il valore nasce dal non ricevere mai i tuoi dati.**

Non è una promessa di privacy attaccata sopra: è l'architettura. I dispositivi si sincronizzano direttamente tra loro (WebRTC, peer-to-peer, senza server di segnalazione). L'AI si addestra in locale. Non c'è un account da creare, perché non c'è niente su cui crearlo.

> Un concorrente che monetizza i dati o il cloud non può copiarla. Dovrebbe prima cancellare il proprio modello di business.

---

## Cosa fa

### 💶 Il numero di oggi
**"Oggi puoi spendere X€."** Budget settimanale derivato dal mensile, proporzionale ai giorni veri, con riporto envelope, meno gli abbonamenti in arrivo — diviso per i giorni che restano.

La proiezione di fine mese usa Holt-Winters sul tuo andamento reale (ripiega sul run-rate, e ti dice sempre quale metodo ha usato).

### 🧾 Partita IVA, fisco e fatturazione — Italia e Svizzera
La parte che trasforma un'app di budget in infrastruttura.

**🇮🇹 Italia**
- **Salvadanaio fiscale** — a ogni incasso sai cosa è tuo e cosa è del fisco. Regime forfettario e ordinario, coefficienti ATECO reali, INPS, casse professionali, aliquota ridotta al 24% per chi è già dipendente.
- **Fatture elettroniche vere** — XML FatturaPA v1.2.2 generato sul dispositivo. In più un **predittore offline dei codici di scarto SdI** (00400/00415/00417/00422/00423/00427…): l'errore lo vedi *prima* di inviare, non dopo.
- **Fatture a più voci**, righe percentuali (sconto/maggiorazione), PDF di cortesia, controllo reale delle cifre di controllo di Partita IVA e Codice Fiscale.
- **Liquidazione IVA periodica**, registro acquisti (IVA detraibile), **importazione fatture passive** (carichi l'XML ricevuto e si registra da solo).
- **F24 precompilato** con codici tributo verificati (1790/1791/1792, 4033/4034/4001, 6001-6012, 6031-6034, P10), pronti da copiare in home banking.
- **Hai saltato una scadenza?** **Ravvedimento operoso** calcolato da solo: sanzione ridotta per fascia di ritardo più interessi legali. Altrove la scadenza sparisce e basta.

**🇨🇭 Svizzera**
- **AVS/AI/APG** per indipendenti, **soglia IVA** (CHF 100'000 — molti piccoli indipendenti non devono nemmeno registrarsi, e Momentum lo dice).
- **QR-bill** — il codice QR di pagamento obbligatorio su ogni fattura svizzera dal 2022. Payload verificato **riga per riga contro tre esempi ufficiali di SIX Group**; la cifra di controllo del riferimento QRR verificata contro il riferimento pubblicato da SIX stessa.
- Interfaccia in **tedesco, francese, italiano e inglese**, riconosciuta in automatico.

### 📈 Investimenti — il netto **vero**
Ogni simulatore mostra il lordo. Un ETF al 7% non è un ETF al 7%.

Momentum mostra il rendimento **dopo imposta sulle plusvalenze e bollo titoli**, con aliquote verificate per Paese — 🇮🇹 Italia (26% / 12,5% titoli di Stato / 0,2% bollo), 🇩🇪 Germania (26,375% + franchigia 1.000€), 🇫🇷 Francia (31,4% PFU 2026), 🇨🇭 Svizzera (0% per investitori privati — con i limiti su trader professionale e imposta patrimoniale cantonale dichiarati, mai nascosti).

E poi: patrimonio netto, proiezioni Monte Carlo con ipotesi dichiarate, regime di mercato misurato, base-rate su 40 anni di drawdown, importazione portafoglio e ribilanciamento risk-parity.

**Mai un consiglio compra/vendi.** Il quadro, mai l'ordine — è una linea normativa, ed è anche ciò che rende Momentum integrabile invece che bloccabile.

### 🏦 Analisi da livello istituzionale, costruita sui bilanci pubblici
Momentum legge bilanci SEC veri — non uno slogan, uno script (`bench/fetch-panel-sec.mjs`) che scarica dati XBRL per **11.304** aziende USA con ricavi depositati, ne arricchisce **1.500** con il vero codice SIC, e ne pubblica **600** per intero dentro l'app.

- **Percentile di settore** — dove si colloca un titolo rispetto a veri competitor per crescita ricavi, margini e altro, via un ponte SIC→settore costruito a mano (non esiste un crosswalk ufficiale gratuito — dichiarato, non nascosto).
- **Beneish M-Score e Piotroski F-Score** — gli stessi screening accademici di frode/qualità contabile che usano i team di due diligence, calcolati sul dispositivo dagli stessi bilanci. Momentum dichiara il loro limite noto nella stessa frase in cui mostra il punteggio: una crescita dei ricavi legittima e molto rapida può generare un falso positivo su Beneish, e lo dice sempre, non solo qui.
- **Analisi causale e comparativa, per singolo titolo o cripto** — un motore statistico di 777 righe (scomposizione a regressione, test di permutazione) restava irraggiungibile in questo repo finché il ponte SIC→settore non l'ha sbloccato per ognuna delle 600 aziende tracciate; un'integrazione CoinGecko estende lo stesso ragionamento alle principali criptovalute.
- **Comparabili (comps)** — mediana EV/EBITDA ed EV/Revenue contro pari reali, valutazione implicita, esportazione CSV pronta per Excel. Si chiede in chat ("quali aziende sono comparabili a NVDA?") o dalla scheda dell'asset.
- **Posizionamento sui derivati crypto** — funding rate, open interest e squilibrio long/short combinati (non solo affiancati): l'affollamento reale si dichiara solo quando un funding elevato E un posizionamento sbilanciato si rinforzano a vicenda, verificato contro la storia recente della stessa moneta, non una soglia universale. Nessuna chiave richiesta (API pubblica di Binance Futures). Si chiede in chat ("sono troppo affollato su bitcoin?") o dalla scheda dell'asset.
- **Storico prezzi azionario senza alcuna configurazione** — per le azioni senza una chiave dati personale, Momentum ripiega sul loro proxy tokenizzato (xStock/Ondo/Backed e simili, quotati come cripto normali sulla stessa API gratuita di CoinGecko), sempre dichiarato come proxy, mai spacciato per il prezzo esatto del titolo in borsa.
- **Sentiment delle notizie on-device** — un vero modello DistilRoBERTa (82,5MB, Apache-2.0, addestrato su notizie finanziarie) legge il tono di un titolo in meno di 100ms a modello caldo, senza server né chiave API.
- **Segnali condivisi tra pari** — un dispositivo che ha già calcolato il sentiment di un titolo di notizia, o che già conosce un prezzo/tasso, lo inoltra (solo etichetta e punteggio, mai un dato personale) sulla stessa mesh P2P ai dispositivi fidati che non hanno ancora scaricato il modello — verificato incrociando un secondo peer indipendente, o un peer con una storia affidabile, prima di fidarsene.

Niente di questo finge di essere un flusso in tempo reale: ogni schermata dichiara esattamente quando i dati di bilancio sono stati scaricati. Per riprodurlo: `npm run bench:panel` rigenera i dati di settore direttamente da SEC EDGAR.

### 🧠 Un'AI che impara davvero da te
Un ensemble che vota, più un arbitro che impara **quale dei suoi stessi modelli ascoltare, categoria per categoria**, dalle tue correzioni vere.

<details>
<summary>Dettaglio tecnico</summary>

- **NeuralNexus** — Naive Bayes + rete neurale (backprop reale, L2, gradient clipping), apprende dall'uso.
- **Nano** (sempre attivo) — MLP addestrato in Python/scikit-learn, portato in JS con parità numerica verificata.
- **Meso** (tier medio/alto) — TF-IDF ibrido parole + n-grammi di caratteri, 2 strati nascosti, pensato per il *testo bancario sporco*.
- **Orchestrator** — voto pesato a N vie, pesi modulati dalla precisione per-categoria misurata sulle tue correzioni (matrice incrementale, lisciatura di Laplace, neutro quando non ha dati).
- **Tier hardware** — un micro-benchmark reale al boot sceglie la profondità Monte Carlo (500–10.000) e quali motori svegliare. Le transazioni di routine non svegliano mai quelli pesanti.

Per rigenerare i numeri: `npm run bench`, `npm run bench:vs-llm`, `npm run bench:cash`
</details>

### 🕸️ Causa ed effetto, onestamente
Co-variazione misurata tra categorie sulle **differenze** settimanali (così un trend comune non inventa legami finti), lag 0 e lag 1, con propagazione smorzata e percorso spiegabile.

Scritto chiaro anche nell'app: *"non è una legge, è quello che è successo nei tuoi dati."*

### 💬 Chiedi quello che vuoi, anche offline
Intent deterministici calcolati sui dati veri — *"quanto ho speso a giugno?"*, *"posso permettermi 50€?"*, *"quando pago Netflix?"*, *"cosa succede se spendo di più al ristorante?"* Tollera i refusi. Risponde a voce. **Quando non sa, lo dice.**

### ⚡ Frizione zero
Tasti one-tap per gli acquisti abituali, **ordinati per quello che è probabile adesso** (istogrammi misurati di ora e giorno: il caffè in cima alle 8, la spesa il sabato), con il perché spiegato. Memoria degli importi. Import da PDF bancari (Intesa, UniCredit, N26, Revolut), CSV, OCR degli scontrini, voce con frasi multi-azione.

### 🌍 Sei lingue dove conta davvero
Le schermate che ogni utente incontra — onboarding, il numero principale della Dashboard, i nomi categoria, l'invito a importare, "Cosa c'è di nuovo" — in italiano, inglese, spagnolo, tedesco, francese e olandese (rilevate in automatico, nessun selettore da cercare). Scelte su dati reali, non a intuito: Francia, Belgio, Paesi Bassi e Germania sono dove le app di divisione spese (lo stesso motore virale di Momentum) hanno già l'adozione più profonda. Il resto dell'app — impostazioni, analisi, schermate fiscali — resta solo in italiano; dichiarato qui sopra in "Cosa c'è in cantiere", non nascosto.

### 🌐 Sincronizzazione senza server
Collegamento esplicito tra dispositivi fidati via WebRTC. FedAvg pesato, **anti-poisoning validato su un set locale**, e un dispositivo nuovo **eredita** la rete addestrata al primo collegamento.

### 📴 Funziona senza campo
Service worker a doppia cache, IndexedDB + localStorage, migrazioni di schema, e una **hash chain sulle transazioni che non si riscrive mai**.

---

## Come si confronta

Il confronto completo, competitor per competitor, con il file esatto che sostiene ogni claim: **[ANALISI_COMPETITOR.md](ANALISI_COMPETITOR.md)**.

In breve: Bloomberg Terminal e Bloomberg Intelligence vedono il mercato ma mai la tua cassa. Revolut e la tua banca vedono il loro conto ma non il mercato — e il loro modello di business guadagna sul tuo spread, non sul tuo risparmio. Robinhood guadagna sul flusso ordini. Copilot e Monarch hanno bisogno delle tue credenziali bancarie su un server terzo (Plaid) solo per funzionare. YNAB traccia quello che hai già speso, mai quello che sta facendo il mercato in questo momento.

Momentum è l'unico di questi che mette la tua cassa reale e i dati di mercato reali — percentili di settore, punteggi di qualità, sentiment — nella stessa risposta on-device, perché è l'unico senza un server che li tiene separati.

## Cosa c'è in cantiere

Una pipeline onesta, non un elenco di promesse — dettaglio e ordine di priorità in [ANALISI_COMPETITOR.md §5](ANALISI_COMPETITOR.md#5-roadmap-proprietaria-onesta-in-ordine-di-impatto) e [PIANO_MOMENTUM.md](PIANO_MOMENTUM.md).

- Estendere la traduzione dell'interfaccia oltre onboarding, numero principale della Dashboard, nomi categoria e invito a importare — la maggior parte dell'app (impostazioni, analisi, schermate fiscali) resta solo in italiano.
- Mesh-discovery oltre un codice di pairing già scambiato a mano.
- Una seconda criptovaluta nel confronto causale a coppia (oggi solo vs. Bitcoin).
- Estendere il motore causale ai mercati quando ci sarà storia personale sufficiente per un risultato onesto.
- Ragionamento SLM più profondo per statistica/fisica/algoritmi oltre alla finanza — non ancora affrontato con lo stesso rigore del lavoro sui bilanci qui sopra.

---

## Verificalo tu (30 secondi)

Non fidarti delle affermazioni. Eseguile.

```bash
npm install
npm test      # 4599 test, node --test src/
```

Ogni funzionalità qui sopra ha i suoi test accanto al codice. La QR-bill svizzera è confrontata con gli esempi ufficiali SIX; le aliquote portano la data in cui sono state verificate e la fonte; i numeri dell'AI si rigenerano con `npm run bench:*`.

## Avvio rapido

```bash
npm install
npm run dev               # localhost:5173
npm test                  # 4599 test
npm run build             # PWA multi-file in dist/
npm run build:singlefile  # singolo file HTML ~575KB
```

**Una sola dipendenza a runtime**: [`@huggingface/transformers`](https://www.npmjs.com/package/@huggingface/transformers), per il modello di sentiment on-device (opt-in, vedi sopra). Vite resta l'unica dipendenza di sviluppo. Questa dichiarazione diceva "zero" — aggiornata il giorno in cui è arrivata la feature sentiment, non lasciata vecchia.

## Struttura

```
src/
  ai/        NeuralNexus, Nano, Meso, Orchestrator, motore Q&A, calibrazione
  predict/   previsione di cassa, motore fiscale (IT + CH), liquidazione IVA,
             F24, ravvedimento, scadenze, scoperta causale, abbonamenti, BNPL
  invoice/   XML FatturaPA + predittore scarti SdI, import fatture passive,
             QR-bill svizzera, checksum fiscali, registro per Paese
  alpha/     netto dopo le tasse, patrimonio, portafoglio, regime di mercato,
             fattori, base-rate sui drawdown, fonti dati verificate
  mesh/      segnalazione WebRTC (senza server), peer federato, sync CRDT
  core/      vault (IndexedDB + hash chain + migrazioni), auto-aggiornamento
  split/     spese condivise, settlement ottimo, crittografia degli inviti
  i18n/      rilevamento lingua + stringhe interfaccia
  import/    PDF bancari, CSV, OCR scontrini, parser notifiche
  voice/     parser vocale multi-azione
```

284 moduli sorgente in 15 domini (`find src -name "*.js" -not -name "*.test.js" | wc -l`).

## Limiti dichiarati

La fiducia si costruisce con quello che un progetto ammette, non con quello che promette.

- Una PWA **non può** leggere le notifiche di altre app (iOS o Android). La lettura diretta richiede un guscio nativo Android (`NotificationListenerService`). Su iOS non può nessuno: lì la strada è l'Open Banking.
- iOS non supporta Web Share Target per le PWA.
- Il grafo causale misura **co-variazione, non causalità** — ed è scritto anche nell'interfaccia.
- Momentum **non può trasmettere** una fattura allo SdI al posto tuo: serve l'accreditamento come intermediario, che è una pratica societaria, non codice. Prepara il file giusto e ti guida passo passo sul portale vero.
- La QR-bill svizzera produce un **codice corretto e scansionabile**, non ancora il layout stampabile del bollettino a norma.
- Sotto CHF 60'500 l'AVS usa una scala degressiva che non è una formula pubblica semplice: Momentum mostra il minimo verificato e rimanda al calcolatore ufficiale, invece di inventare un numero.
- **Non è consulenza fiscale.** Sono stime su aliquote pubbliche, ognuna con la sua data di verifica.
- **Alcuni moduli AI sono ricerca, non produzione.** `src/ai/omega.js`, `neurosym.js`, `expert-adapter.js`, `executive.js` e `nb-categorizer.js` sono scritti e testati ma **nessun percorso di produzione li esegue** — il percorso di classificazione reale è `orchestrator.js` + `expert-bandit.js` + `trained-categorizer` + `hashed-logreg`. Lo diciamo qui invece di lasciare che il conteggio dei file lasci intendere altro: un modulo testato che nessuno esegue non è una funzione.
- **Gli aggiornamenti automatici delle regole fiscali richiedono una fonte raggiungibile.** Verificato dal vivo: l'Agenzia delle Entrate e Normattiva bloccano le richieste cross-origin, quindi un browser non può leggerle, e trasformare un testo di legge in aliquote in automatico sarebbe esattamente il tipo di numero inventato che questo progetto vieta. Le regole sono verificate a mano e pubblicate come file JSON firmato che l'app scarica da sola.

## Principi non negoziabili

1. I dati dell'utente non lasciano mai il dispositivo.
2. Mai moduli decorativi: ogni claim è misurato e testato (`npm test`).
3. Funzioni pure separate dal DOM; ogni modulo nuovo nasce coi suoi test.
4. La hash chain delle transazioni non si riscrive.
5. Ogni testo dell'interfaccia deve essere comprensibile da un bambino di 8 anni.
6. **Se il numero non è stampato, non esiste.** Nessuna cifra non verificata entra in un documento, in un commit o nell'interfaccia.

## Documentazione

- **[AGENTS.md](AGENTS.md)** — **parti da qui se subentri nello sviluppo** (persona o AI): regole non negoziabili, mappa del codice verificata, limiti dichiarati e trappole già pagate. Ogni affermazione è controllata contro il codice reale, mai scritta a memoria. `CLAUDE.md` punta allo stesso file, così ogni strumento legge una sola fonte di verità.
- **[VERSIONI.md](VERSIONI.md)** — manifesto delle versioni per componente: le versioni si guadagnano con salti reali misurati, mai con le etichette.
- **[PIANO_MOMENTUM.md](PIANO_MOMENTUM.md)** — piano di sviluppo, stato delle fasi, gap list.
- **[NEUROSYM.md](NEUROSYM.md)** — l'architettura di ragionamento, compreso ciò che dichiaratamente *non* è.

---

<div align="center">

**I tuoi soldi. Il tuo dispositivo. Niente esce.**

</div>
