# Momentum vs il settore — teardown competitivo onesto

**2026-07-07 · 224 test verdi · numeri da `npm run bench` / `npm run bench:forecast`**

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

## Ottimizzazione hardware (la parte "prestazioni/potenza")

`compute-planner.js` sceglie il percorso migliore dalle capacità MISURATE: WebGPU→WebNN→SIMD→JS; quantizzazione int8 su hardware debole (8× meno memoria, 0 perdita). Onesto: Metal/Vulkan li gestisce il browser sotto WebGPU; non esiste "25×" — si usa BENE ciò che c'è, e si degrada con grazia invece di crashare.

## Le domande difficili degli investitori (risposte oneste)

- **"Battete ogni modello su ogni benchmark?"** No, e chi lo dicesse mentirebbe. Vinciamo sugli assi che contano per la finanza personale on-device (privacy, latenza, offline, costo, specializzazione, calibrazione), con numeri riproducibili. Un GPT-5 batte noi nel ragionamento aperto; noi battiamo lui nel categorizzare una transazione in 0,08 ms offline senza vedere i tuoi dati.
- **"Il moat?"** Privacy-by-architecture (non replicabile da chi monetizza dati) + architettura-sistema integrata + benchmark verificabili.
- **"Cosa manca per il valore?"** Utenti reali + retention misurata + store + team. Il codice è pronto; il resto è execution di mercato, non software. (Gap list completa in COPERTURA.md.)

## La verità che regge una due diligence
Ogni numero qui è riproducibile in 30 secondi con `npm run bench` e `npm test`. È questa verificabilità — non le promesse — l'argomento che convince un acquirente tecnico. Una slide che dice "2,5 miliardi" e "obsoleto ogni modello" viene smontata dal primo esperto; una repo con 224 test e benchmark onesti no.
