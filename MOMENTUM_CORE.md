# Momentum Core — Architettura AI proprietaria (whitepaper onesto)

**2026-07-06 · repo GPire/momentum · 212 test verdi**

Questo documento descrive l'architettura AI reale di Momentum come sistema unificato, con la linea netta tra ciò che **esiste ed è misurato**, ciò che è **roadmap**, e ciò che è **rifiutato**. È scritto per reggere una due diligence tecnica, non per un pitch: ogni claim è ancorato a codice e a un benchmark riproducibile.

## La domanda: costruire un modello proprietario o usare Phi-4?

**Decisione: architettura proprietaria specializzata, NO Phi-4, NO LLM generalista.** Motivi tecnici, non ideologici:
- Per la **categorizzazione finanziaria** un LLM generalista (Phi-4, 14B) è enorme, lento sull'edge e non batte un sistema specializzato. Momentum Core categorizza a **0,08 ms/transazione**, 100% on-device, offline.
- Un vero transformer proprietario "da zero" richiede cluster GPU + dataset da centinaia di milioni di esempi + team: mesi di R&S, non una sessione. Prometterlo sarebbe fumo.
- **La via vincente e reale**: un sistema ibrido specializzato (dizionario esercenti + modelli ML leggeri + apprendimento dalle correzioni + grafo causale), la cui difendibilità è l'**architettura-sistema**, non un peso di modello copiato da un paper.

## I 5 pilastri difendibili (tutti nel codice, tutti testati)

### 1. Categorizzazione ibrida dizionario+ML (accuratezza di prodotto 92,5%)
Come i veri sistemi fintech (Plaid/Yodlee/Tink): la maggioranza delle transazioni sono esercenti NOTI, riconosciuti da un dizionario ad alta confidenza (`src/ai/merchant-dictionary.js`); gli sconosciuti passano al modello ML che generalizza dalle parole-contesto.
- **Benchmark riproducibile** (`npm run bench`, seed fisso, esercenti held-out):
  - Generalizzazione ML pura (esercenti mai visti): Nano 47,5% → Meso v2 55,0% → Ensemble **59,4%**.
  - **Sistema completo di prodotto: 92,5%** (0,08 ms/predizione).
- Le due metriche sono dichiarate SEPARATE apposta: la prima è la robustezza ML su ignoti, la seconda è l'accuratezza reale su transazioni vere. Nessuna delle due è gonfiata.
- Modello Meso v2 addestrato su CPU (questo Mac i5), cross-check Python↔JS esatto (max diff 2,2e-16).

### 2. Astensione — l'AI che "sa di non sapere" (`orchestrator.js`)
Quando i modelli sono in disaccordo e la confidenza combinata è bassa, l'esito è `abstain: true`: invece di forzare una categoria sbagliando con sicurezza, l'AI propone la sua ipotesi e chiede conferma. La risposta dell'utente diventa training (active learning). È il "capisce a priori gli errori" richiesto — ed è raro nei prodotti consumer.

### 3. Orchestrator con pesi per-categoria misurati (v3)
Il voto dell'ensemble è modulato dalla **precisione reale per-modello-per-categoria** appresa dalle correzioni dell'utente (`modelStats`). Il sistema impara QUALE dei suoi modelli ascoltare, categoria per categoria. Neutro senza dati (retro-compatibile), fino a ×1,5/×0,5 col misurato.

### 4. Ragionamento causale a catena (`causal-graph.js`)
Co-variazione misurata tra categorie sulle differenze settimanali (lag 0/1): "quando sale Ristorante, di solito sale Trasporti, e Farmacia la settimana dopo". Propagazione con percorso esplicativo. Onesto: misura co-variazione, non causalità stretta — e lo dice anche in UI.

### 5. Apprendimento federato con integrità verificabile (`mesh/`)
Federated learning P2P a consenso esplicito (pairing, no server): FedAvg pesato, anti-poisoning su validation set, **reputazione per-peer + catena hash a prova di manomissione** (`update-ledger.js`) — un nodo che avvelena il modello perde peso da solo (tolleranza bizantina emergente). Verificato live su 2 nodi (fusione 9+9=18 esatta). Un dispositivo nuovo eredita il modello al pairing.

## Ottimizzazione hardware-adattiva (`device/compute-planner.js`)
Sceglie il backend (WebGPU→WebNN→SIMD→JS), precisione, profondità Monte Carlo e worker dalle capacità MISURATE del dispositivo. Onesto: Metal/Vulkan li gestisce il browser sotto WebGPU; non si rileva il chip (il web non lo espone); non esiste "25x", si usa BENE ciò che c'è.

## Mappatura onesta delle sigle del blueprint V7.5
| Sigla del blueprint | Cosa Momentum fa DAVVERO |
|---|---|
| TCGformer / causal transformer | Grafo causale statistico misurato (no transformer, ma reale e testato) |
| FinSecure-FL blockchain / BFT | Catena hash + reputazione per-peer (no blockchain, ma integrità+BFT emergente reali) |
| FedProx / homomorphic encryption | FedAvg pesato + anti-poisoning (HE end-to-end: non praticabile su edge, non promesso) |
| Adaptive compute 25x | compute-planner reale (usa bene le risorse; "25x" è fisicamente impossibile) |
| Autonomous web / fake-news | RIFIUTATO: PWA non può navigare siti terzi (CORS); rilevamento fake-news è ricerca irrisolta |
| Mesh "virale" | RIFIUTATO: sarebbe malware; la crescita è a consenso esplicito |

## Perché è difendibile come sistema (angoli brevettabili)
Non un peso di modello, ma la **combinazione integrata**: dizionario+ML+astensione+active-learning+grafo-causale+reputazione-federata-hash-chained+dispatch-hardware, il tutto 100% on-device e verificabile. Nessun competitor consumer ha questa pila integrata. È questa architettura-sistema l'IP difendibile, dimostrabile con benchmark riproducibili.

## Roadmap onesta (non ancora fatto)
Riaddestramento con correzioni reali degli utenti (export già pronto); forecast-bench walk-forward; quantizzazione int8 per hardware debole; feature multi-segnale (importo+ora+giorno nel modello); app nativa Android (lettura notifiche wallet); Open Banking. Tutto costruibile; niente di ciò richiede promesse impossibili.
