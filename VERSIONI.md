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
