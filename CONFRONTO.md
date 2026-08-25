# Momentum vs il settore — teardown competitivo onesto

**2026-08-24 · 3768 test verdi · numeri da `npm run bench` / `npm run bench:forecast` / `npm run bench:panel`**

Documento per investitori/acquirenti: per ogni problema REALE dei modelli e delle app concorrenti, la risposta di Momentum ancorata a codice e benchmark. Regola: si vince sugli assi che contano per la finanza personale ON-DEVICE, con numeri verificabili — non si dichiara di "battere ogni benchmark di ogni modello" (non sarebbe vero né dimostrabile).

## I problemi degli LLM generalisti (ChatGPT, Gemini, Claude, Grok, Copilot) applicati alla finanza

| Problema reale del generalista | Risposta di Momentum |
|---|---|
| **I tuoi dati finanziari finiscono su un server** | 100% on-device. Non possiamo leakare dati che non riceviamo. `backup.js` cifrato AES-GCM. |
| **Costo per query, serve connessione** | 0 costo, 0 rete: `momentumCore.infer()` a **0,08 ms** offline. |
| **Allucinano numeri** | Q&A deterministico sui tuoi dati reali (`qa-engine.js`); l'AI **si astiene** se incerta invece di inventare. |
| **Enormi (GB), lenti sull'edge** | Modello **400 KB → 108 KB int8**, gira su un i5 2020. |
| **Generalisti, non calibrati sulla finanza** | Specializzato: dizionario esercenti + Meso 3.0, **92,7%** su transazioni reali. |
| **Confidenza non affidabile** | Confidenza **calibrata** (temperature scaling, ECE 0,018 misurato). |
| **Chiedi "è a rischio contabile questo titolo?" e ricevi una stima a parole, senza formula, senza fonte** | Beneish M-Score e Piotroski F-Score **calcolati per davvero** dai bilanci SEC reali (`src/alpha/quality-scores.js`), non descritti a parole — con il limite noto del modello (falso positivo su crescita legittima) dichiarato ogni volta, non solo se lo chiedi due volte. |
| **Il sentiment di una notizia te lo riassume, ma richiede rete, chiave API, e i tuoi dati passano dal loro server** | Sentiment calcolato **on-device** (DistilRoBERTa reale, 82,5MB, Apache-2.0) — zero rete dopo il primo download, zero chiave, e condiviso via mesh P2P **verificato tra pari** (corroborato da almeno 2 peer indipendenti prima di essere fidato), mai su un server terzo. |

## I problemi delle app di finanza personale (Mint/Rocket Money, Cleo, Plaid-based, Revolut budgeting)

| Problema reale dell'app di categoria | Risposta di Momentum |
|---|---|
| **La gente le abbandona (inserimento manuale noioso)** | Zero-frizione: quick-add contestuali, voce "il solito", OCR, import PDF/CSV. Vedi COPERTURA.md. |
| **Categorizzazione cloud, dati venduti/condivisi** | Categorizzazione on-device; la privacy è l'architettura, non una promessa. |
| **Numeri senza significato** | Safe-to-spend ("oggi puoi spendere X"), linguaggio da bambino di 8 anni. |
| **Nessun ragionamento causale** | Grafo causale: "se sale Ristorante, sale anche Trasporti" (`causal-graph.js`). |
| **Previsioni deboli o assenti** | Holt-Winters **68,9% meglio del naive**, 40/40 serie (`bench:forecast`). |
| **Ogni dispositivo è isolato** | Mesh federata a pairing: l'AI cresce con i tuoi dispositivi fidati. |
| **Se perdi il telefono perdi tutto** | Backup cifrato esportabile/ripristinabile. |
| **Voce banale (un comando alla volta)** | Discorso lungo misto: 5 azioni (spese+promemoria+appuntamenti+risparmio) in una frase. |

## I problemi dei terminali istituzionali (Bloomberg Terminal, Bloomberg Intelligence, TradingView Premium, Yahoo Finance) applicati a un investitore privato

| Problema reale del terminale | Risposta di Momentum |
|---|---|
| **Costo enterprise** — Bloomberg Terminal costa **31.980$/anno** per postazione a singolo terminale nel 2026 (fonte: [godeldiscount.com](https://godeldiscount.com/blog/bloomberg-terminal-cost-2026), [costbench.com](https://costbench.com/software/financial-data-terminals/bloomberg-terminal/)) — impegno minimo di 2 anni | **Gratuito**, gira sul telefono che hai già. |
| **Zero nozione della cassa personale** — vedono il mercato, mai quanto puoi davvero permetterti di investire questo mese | `investmentReadiness` fonde regime di mercato reale + minimo di cassa prudente (`src/predict/cash-forecast.js`) — nessun terminale lo fa, perché nessuno vede l'altro lato. |
| **Percentile di settore e quality score dietro abbonamento professionale** (Bloomberg Intelligence, o dietro un contratto quote-based tra ~4.000$ e 27.500$/anno mediano per FactSet, fonte [Vendr](https://www.vendr.com/marketplace/factset)) | Stesso tipo di analisi — percentile di settore su 600 aziende reali, Beneish/Piotroski — calcolata gratis, on-device, da bilanci SEC pubblici (`screener-settore.js`, `quality-scores.js`). Limite dichiarato: 600 aziende coperte per intero, non l'intero mercato USA. |
| **FactSet e LSEG Workspace** (ex Refinitiv Eikon) — contratti quote-based, tipicamente 10.000$–22.000$/anno per singolo posto LSEG Workspace, fino a 50.000$+ per un posto FactSet completo (fonti: [Vendr — FactSet](https://www.vendr.com/marketplace/factset), [Vendr — LSEG](https://www.vendr.com/marketplace/refinitiv)) — pensati per desk professionali, non per un investitore privato | Nessun contratto, nessuna negoziazione: l'app si scarica e i dati di bilancio si scaricano gratis da SEC EDGAR. |
| **TradingView Premium** — 49,95$/mese su fatturazione annuale (69,95$/mese mensile) nel 2026 (fonte: [stockbrokers.com](https://www.stockbrokers.com/review/tools/tradingview)): grafici e alert avanzati, ma **nessun equivalente di Beneish/Piotroski o percentile di settore da bilanci reali**, e nessuna fusione con la cassa personale | Screener multi-criterio, quality score e percentile di settore inclusi gratis; **nessuna app di grafici tocca la cassa personale per definizione** — è un limite strutturale, non una feature mancante da aggiungere. |
| **Koyfin** — piano Premium 79$/mese nel 2026 (fonte: [Koyfin pricing](https://www.koyfin.com/pricing-llm-info/)): screener e 10 anni di bilanci, il più vicino per spirito a un "Bloomberg per il retail" | Stessa filosofia di democratizzare dati istituzionali, ma resta un servizio cloud con account e abbonamento; Momentum è gratis, on-device, e l'unico che aggiunge la cassa personale reale al quadro. |
| **Serve terminale/abbonamento dati, spesso vincolato a un desk fisico o una rete aziendale** | Momentum funziona **offline** dopo il primo caricamento dati, su un telefono, senza contratto. |
| **Danno per definizione un'opinione o un rating (buy/hold/sell)** | Momentum **non lo fa mai** — il quadro, mai l'ordine, per scelta architetturale dichiarata, non per limite tecnico. |

**Limite onesto, non aggirabile**: nessun terminale qui sopra viene "battuto" sui dati istituzionali veri — order book, dark pool, notizie a microsecondo, copertura dell'intero mercato globale. Momentum non compete su quel terreno. Compete sul fondere quello che nessun terminale vede (la cassa personale reale) con una fetta misurabile di ciò che un terminale offre (percentile di settore, quality score, sentiment), gratis e on-device.

## Gli assi su cui vinciamo davvero (misurati, non dichiarati)

| Asse | Momentum | Generalista cloud | App tipica di categoria |
|---|---|---|---|
| Latenza categorizzazione | **0,08 ms** | 100-1000 ms (rete) | 50-500 ms (API) |
| Funziona offline | **Sì** | No | Parziale |
| Dati sul dispositivo | **Sì, sempre** | No | Raramente |
| Costo per predizione | **0** | $ per token | $ per chiamata API |
| Dimensione modello | **108 KB (int8)** | GB | N/D (cloud) |
| Accuratezza su transazioni reali | **92,7%** (bench riproducibile) | non specializzato | ~80-90% (dichiarato, non verificabile) |
| Confidenza calibrata | **Sì (ECE 0,018)** | No | No |
| Percentile di settore + quality score da bilanci SEC reali | **Sì, gratis (600 aziende)** | No (non calcola da XBRL reale, rischia di inventare il numero) | Solo nei terminali enterprise a pagamento (Bloomberg Intelligence) |

## Ottimizzazione hardware (la parte "prestazioni/potenza")

`compute-planner.js` sceglie il percorso migliore dalle capacità MISURATE: WebGPU→WebNN→SIMD→JS; quantizzazione int8 su hardware debole (8× meno memoria, 0 perdita). Onesto: Metal/Vulkan li gestisce il browser sotto WebGPU; non esiste "25×" — si usa BENE ciò che c'è, e si degrada con grazia invece di crashare.

## Le domande difficili degli investitori (risposte oneste)

- **"Battete ogni modello su ogni benchmark?"** No, e chi lo dicesse mentirebbe. Vinciamo sugli assi che contano per la finanza personale on-device (privacy, latenza, offline, costo, specializzazione, calibrazione), con numeri riproducibili. Un GPT-5 batte noi nel ragionamento aperto; noi battiamo lui nel categorizzare una transazione in 0,08 ms offline senza vedere i tuoi dati.
- **"Il moat?"** Privacy-by-architecture (non replicabile da chi monetizza dati) + architettura-sistema integrata + benchmark verificabili.
- **"Cosa manca per il valore?"** Utenti reali + retention misurata + store + team. Il codice è pronto; il resto è execution di mercato, non software. (Gap list completa in COPERTURA.md.)

## La verità che regge una due diligence
Ogni numero qui è riproducibile in 30 secondi con `npm run bench` e `npm test`. È questa verificabilità — non le promesse — l'argomento che convince un acquirente tecnico. Una slide che dice "2,5 miliardi" e "obsoleto ogni modello" viene smontata dal primo esperto; una repo con 3768 test e benchmark onesti no.
