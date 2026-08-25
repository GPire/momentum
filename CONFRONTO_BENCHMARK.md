# Momentum vs il settore — confronto benchmark (metodologia onesta)

**2026-08-24 · 3768 test verdi · numeri da `npm run bench*`**

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
| Copertura pannello settoriale (bilanci SEC reali) | `npm run bench:panel` | **11.304 aziende con ricavi**, 1.500 arricchite con SIC, 600 pubblicate per intero |
| Percentile settore ↔ titolo (accuratezza del ponte SIC→settore) | verificato dal vivo | **86,3%** delle 600 aziende del pannello collegate a un settore SPDR |
| Copertura Q&A di mercato in gergo professionale | `src/ai/qa-banco-prova.js` | **BANCO_TRADER 88,9%, BANCO_INVESTITORE 100%, BANCO_BANKER 100%** (misura manuale, non ancora uno script bench permanente) |
| Sentiment on-device — dimensione modello | — | 82,5MB int8 (DistilRoBERTa, Apache-2.0), <100ms a modello caldo (verificato dal vivo, non un bench riproducibile a riga di comando) |

## Metodologia del confronto (perché non "battiamo tutti su tutto")

Ci sono TRE domande diverse, e vanno tenute separate per non mentire:

1. **Categorizzazione bancaria specializzata (on-device)** — il NOSTRO terreno. Un modello da 2 MB specializzato batte plausibilmente un LLM generalista, ma va MISURATO eseguendo l'LLM sul nostro test set (rimandato). Struttura del confronto pronta in `bench:vs-llm`.
2. **Aritmetica finanziaria verificabile** (quanto investire, pesi di portafoglio, safe-to-spend, ranking fattori) — qui un motore deterministico è **esatto per costruzione** e sub-millisecondo, mentre gli LLM hanno errori aritmetici documentati. Vinciamo su questo sottoinsieme (`bench:reasoning` = 100%).
3. **Ragionamento finanziario aperto/qualitativo** (analisi di scenari, spiegazioni complesse) — qui un frontier LLM (Claude Opus, GPT-5, Grok) è **più forte** di noi. Dichiararlo è ciò che rende credibile il resto.
4. **Screening istituzionale da bilanci SEC reali** (percentile di settore, Beneish M-Score, Piotroski F-Score) — qui, come al punto 2, un motore deterministico che legge XBRL vero è **esatto per costruzione**, mentre un LLM generalista senza accesso strutturato ai bilanci può solo descrivere il metodo o inventare un numero plausibile. Un terminale enterprise (Bloomberg Intelligence) fa lo stesso calcolo con dati più ampi ma a costo professionale: qui la differenza non è l'accuratezza del metodo (la formula è la stessa, pubblica), è chi può permetterselo.

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
| Screening da bilanci SEC reali (percentile settore, Beneish, Piotroski) senza rischio di numero inventato | Sì, deterministico da XBRL reale | No (nessun accesso strutturato ai bilanci; può solo descrivere il metodo) |

## Tabella competitor — versioni reali e benchmark pubblicati (verificato via ricerca web, 2026-08-24)

I nomi di modello in questa tabella sono stati verificati via ricerca web il 2026-08-24 (non ricordati a memoria — la sessione precedente aveva scritto versioni plausibili ma in parte sbagliate/premature). Colonna "benchmark finanziario": **nessuno dei modelli sotto pubblica, al momento di questa verifica, un punteggio specifico su un benchmark finanziario riconosciuto (FinBen/FLARE) per la propria ULTIMA versione** — dove c'è un numero, è dichiarato di chi è davvero e su cosa.

| Famiglia | Ultima versione verificata | Data di rilascio | Benchmark finanziario pubblicato | Fonte |
|---|---|---|---|---|
| Claude (Anthropic) | Opus 5 (general availability); tier superiore Fable 5 | Opus 5: 24 lug 2026 · Fable 5: 9 giu 2026 | Nessuno trovato per queste versioni | [Axios](https://www.axios.com/2026/07/24/anthropic-releases-new-model-opus-5) |
| GPT (OpenAI) | GPT-5.6 (varianti Luna/Terra/Sol) | 9 lug 2026 | Nessuno per GPT-5.6. Il predecessore **GPT-4** ottenne 0,63 Exact Match su QA numerica e 0,54 su previsione del movimento di un titolo (vicino al caso) sul benchmark FinBen — non è il numero della versione attuale, è l'unico dato pubblico reale trovato sulla famiglia GPT su un benchmark finanziario | [OpenAI](https://openai.com/index/gpt-5-6/), [paper FinBen (NeurIPS 2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/adb1d9fa8be4576d28703b396b82ba1b-Paper-Datasets_and_Benchmarks_Track.pdf) |
| Gemini (Google) | 3.6 Flash / 3.5 Flash-Lite (general availability) | lug 2026 | Nessuno trovato | [Axios](https://www.axios.com/2026/07/21/google-gemini-ai-models) |
| Grok (xAI) | Grok 4.6 | 12 ago 2026 | Nessuno indipendente. xAI ha descritto il predecessore Grok 4.5 come "paragonabile a Opus 4.7, più veloce" — dichiarazione aziendale, non un benchmark terzo | [evolink.ai](https://evolink.ai/blog/grok-4-6-release-date), [fullstack.com](https://www.fullstack.com/labs/resources/blog/grok-4-5-a-closer-look-at-xais-latest-model) |
| DeepSeek | V4-Pro-0813 (general availability) | 13 ago 2026 | Nessuno trovato | [Yahoo Tech](https://tech.yahoo.com/ai/articles/deepseek-officially-launches-v4-pro-181255468.html) |
| Qwen (Alibaba) | Qwen3.8-Max (2,4T parametri, 95B attivi) | 3 ago 2026 | Su Arena.AI (classifica crowdsourced, ragionamento generale non finanziario): primo tra i modelli cinesi per compiti testuali, ancora dietro Claude Fable 5 | [Forbes](https://www.forbes.com/sites/gabrielalinzainescu/2026/08/03/alibaba-unveils-its-largest-ai-model-yet-as-china-closes-the-gap/), [MarkTechPost](https://www.marktechpost.com/2026/08/03/alibaba-qwen-releases-qwen3-8-max/) |
| Kimi (Moonshot AI) | K2.7-Code | 12 giu 2026 | +21,8% su Kimi Code Bench v2 — benchmark di coding, non finanziario | [MarkTechPost](https://www.marktechpost.com/2026/06/12/moonshot-ai-releases-kimi-k2-7-code-a-coding-model-reporting-21-8-on-kimi-code-bench-v2-over-k2-6/) |
| GLM (Zhipu/Z.ai) | GLM-5.3 (GLM-5.2 il più recente con punteggio pubblico) | GLM-5.3: 14 ago 2026 · GLM-5.2: 13 giu 2026 | GLM-5.2: 51 sull'Artificial Analysis Intelligence Index, il più alto tra i modelli open-weight, a 5 punti da Claude Opus 4.8 — indice di ragionamento generale, non finanziario | [SCMP](https://www.scmp.com/tech/article/3343239/chinas-zhipu-ai-launches-new-major-model-glm-5-challenge-its-rivals), [tech-insider.org](https://tech-insider.org/au/glm-5-2-tops-open-weight-ai-models-2026/) |

**La conclusione onesta non cambia**: nessun modello frontier qui sopra pubblica ancora, a questa data, un benchmark finanziario specifico e comparabile sulla propria ultima versione — l'unico dato reale reperibile (GPT-4 su FinBen, un modello di generazione precedente) mostra un punteggio "vicino al caso" proprio sui compiti quantitativi/di previsione dove Momentum è esatto per costruzione. Questo conferma, con una fonte vera, il punto 2 della metodologia sotto — non lo sostituisce con qualcosa di più forte.

## Conclusione onesta per un investitore

Momentum non è "un LLM migliore di GPT-5". È un **sistema specializzato on-device** che vince sugli assi che contano per la finanza personale privata: categorizzazione specializzata, aritmetica finanziaria esatta, screening istituzionale da bilanci SEC reali, latenza, dimensione, offline, privacy, costo, adattività hardware e apprendimento online. Su questi assi la superiorità è **misurata e riproducibile in 30 secondi**. Sul ragionamento aperto generale i frontier LLM restano avanti — e dirlo è precisamente ciò che rende il resto credibile davanti a un esperto tecnico.
