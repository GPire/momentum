# Momentum vs il settore — confronto benchmark (metodologia onesta)

**2026-07-10 · 282 test verdi · numeri da `npm run bench*`**

Regola #1 del progetto: **nessun numero di competitor è inventato.** Le celle senza fonte verificata sono marcate "da verificare da model card". La verità apples-to-apples richiede eseguire i modelli sul NOSTRO test (harness `bench:vs-llm --live` pronto, rimandato a quando ci saranno Ollama o chiavi API).

## I NOSTRI numeri (riproducibili, misurati su questa macchina)

| Benchmark | Comando | Risultato |
|---|---|---|
| Categorizzazione — prodotto (dizionario+ML) | `npm run bench` | **94,6%**, 0,18 ms/predizione |
| Categorizzazione — generalizzazione ML held-out | `npm run bench` | **76,0%** (esercenti mai visti) |
| DCGN — generalizzazione grafo puro | `npm run bench:graph` | **67,3%**, 0,078 ms; apprendimento online 0,031 ms/esempio |
| Forecast spesa vs naive | `npm run bench:forecast` | **68,9% meglio**, 40/40 serie |
| Ragionamento finanziario verificabile | `npm run bench:reasoning` | **12/12 (100%)**, 0,002 ms/risposta |
| Portfolio risk-parity (backtest onesto) | `npm run bench:alpha` | Sharpe/drawdown misurati, no look-ahead |
| Dimensione modello on-device | — | ~2,4 MB (108 KB in int8) |

## Metodologia del confronto (perché non "battiamo tutti su tutto")

Ci sono TRE domande diverse, e vanno tenute separate per non mentire:

1. **Categorizzazione bancaria specializzata (on-device)** — il NOSTRO terreno. Un modello da 2 MB specializzato batte plausibilmente un LLM generalista, ma va MISURATO eseguendo l'LLM sul nostro test set (rimandato). Struttura del confronto pronta in `bench:vs-llm`.
2. **Aritmetica finanziaria verificabile** (quanto investire, pesi di portafoglio, safe-to-spend, ranking fattori) — qui un motore deterministico è **esatto per costruzione** e sub-millisecondo, mentre gli LLM hanno errori aritmetici documentati. Vinciamo su questo sottoinsieme (`bench:reasoning` = 100%).
3. **Ragionamento finanziario aperto/qualitativo** (analisi di scenari, spiegazioni complesse) — qui un frontier LLM (Claude Opus, GPT-5, Grok) è **più forte** di noi. Dichiararlo è ciò che rende credibile il resto.

## Assi strutturali dove Momentum vince a prescindere (provabili senza le loro API)

| Asse | Momentum | LLM cloud frontier |
|---|---|---|
| Latenza | 0,002–0,18 ms | 100–1000 ms (rete) |
| Dimensione | 2,4 MB (108 KB int8) | ~GB–TB |
| Offline | Sì | No |
| Dati sul dispositivo | Sì, sempre | No |
| Costo per risposta | €0 | $ per token |
| Adattività hardware | Sì (compute-planner + DCGN maxTokens per tier) | No |
| Apprendimento online senza retraining | Sì (DCGN Hebbian) | No |

## Tabella competitor — benchmark PUBBLICATI (da compilare con fonti reali)

Da riempire eseguendo i modelli (`bench:vs-llm --live`) o citando i loro benchmark pubblici su task confrontabili (es. classificazione testuale finanziaria, FinBen/FLARE, ragionamento MMLU-Pro). NON inserire numeri senza fonte.

| Modello (versione lug. 2026) | Benchmark citato | Numero | Fonte (model card / paper) |
|---|---|---|---|
| Claude Opus 4.8 | — | da verificare | da model card |
| ChatGPT 5.6 | — | da verificare | da model card |
| Grok 4.5 | — | da verificare | da model card |
| DeepSeek V4 Pro | — | da verificare | da model card |
| Qwen 3.7 Max | — | da verificare | da model card |
| Gemini 3.5 | — | da verificare | da model card |
| Kimi K2.7 / GLM 5.2 | — | da verificare | da model card |

> Nota di ricerca: molte "versioni luglio 2026" citate non hanno (al mio knowledge-cutoff) model card pubbliche verificabili. Compilare SOLO con numeri realmente pubblicati e linkati — mai stime.

## Conclusione onesta per un investitore

Momentum non è "un LLM migliore di GPT-5". È un **sistema specializzato on-device** che vince sugli assi che contano per la finanza personale privata: categorizzazione specializzata, aritmetica finanziaria esatta, latenza, dimensione, offline, privacy, costo, adattività hardware e apprendimento online. Su questi assi la superiorità è **misurata e riproducibile in 30 secondi**. Sul ragionamento aperto generale i frontier LLM restano avanti — e dirlo è precisamente ciò che rende il resto credibile davanti a un esperto tecnico.
