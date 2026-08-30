# Momentum — Angoli di novità (spunti IP a livello di SISTEMA)

> Onestà (regola #1 del progetto): questo NON è un deposito brevetti né una promessa di concessione. Sono **angoli di novità a livello di sistema** da valutare con un consulente IP. Descrivono come i pezzi REALI e testati di Momentum si combinano in modi non ovvi. Nessun claim di "battere GPT" o param-count inventati.

## Perché "a livello di sistema"
I singoli mattoni (Naive Bayes, regressione logistica, DCGN, Holt-Winters, federated averaging) sono noti. La potenziale novità sta nella **combinazione integrata on-device** e nel modo in cui i dati fluiscono tra i moduli senza mai lasciare il dispositivo.

## Angoli candidati (da valutare con un legale IP)
1. **Categorizzazione finanziaria a cascata dizionario→ensemble calibrato→astensione**, con **guardrail semantico anti-misclassificazione** (categorie a rischio come crypto/etf accettate solo con evidenza) e **online learning** che converge dai dati confermati. (`src/ai/orchestrator.js`, `src/ai/calibration.js`, `src/import/categorize.js`)
2. **Riaddestramento locale in-browser (JS, senza server né Python)** di un esperto discriminativo (feature hashing) e **ri-allineamento automatico dei modelli ai dati preservati** al cambio di versione/modello, senza perdita dati. (`src/ai/hashed-logreg.js`, `reconcileModelsWithHistory`)
3. **Motore causale a lag variabile su dati personali** con catene spiegabili "se A allora B (e forse C)" e caveat correlazione≠causalità, che alimenta consigli tracciabili. (`src/predict/causal-graph.js`)
4. **Import unificato multi-formato con dedup esatta per ID + fuzzy**, categoria via MCC, e **apprendimento in background idle-chunked** che integra ogni dato importato in rete neurale + grafo episodico + affidabilità. (`src/import/multi-import.js`)
5. **Federated learning P2P reputation-weighted con ledger hash-chain** (non blockchain) e privacy differenziale semplificata, tra device fidati, senza server. (`src/mesh/*`)
6. **Adattività per-hardware** che sceglie backend (WebGPU/WebNN/SIMD/JS) e budget esperti/precisione in base al dispositivo, con self-tuning sulla latenza misurata. (`src/device/*`, `src/ai/adaptive-runtime.js`)
7. **Riuso dell'infrastruttura pubblica cripto come fonte gratuita di dati azionari storici** — non ovvio perché unisce due mercati (dati cripto pubblici, dati azionari storicamente chiusi dietro licenze) tramite l'osservazione che i "token tokenizzati" (xStock/Ondo/bStocks/Coinbase/Dinari, quotati su exchange cripto ma emessi 1:1 su azioni reali) sono indicizzati come cripto normali su un'API pubblica gratuita — con **selezione automatica del proxy più liquido per market-cap-rank reale** (mai un nome fisso) e disclosure onesta obbligatoria in UI ("proxy, non il prezzo esatto del titolo"). Trovato dal vivo il 2026-08-30, verificato per più aziende (Apple, Tesla, NVIDIA, Microsoft, Nike, Boeing). (`src/alpha/stock-tokenized-proxy.js`)
8. **Resilienza di rete uniforme a livello di intero progetto**: ogni chiamata verso un provider esterno (dati di mercato, notizie, chat cloud) è protetta dallo stesso limite di tempo dichiarato (`src/core/con-timeout.js`), evitando che un singolo provider "pending" (mai un errore, mai una risposta) blocchi l'intera esperienza — pattern uniforme, non una toppa isolata, propagato a tutte le fonti del progetto nella stessa sessione in cui è stato scoperto. (`src/alpha/news.js`, `src/alpha/asset-search.js`, `src/alpha/stock-history.js`, `src/ai/chat-fallback.js`)

## Cosa NON rivendichiamo
Novità sui singoli algoritmi (sono pubblici); superiorità sul ragionamento aperto vs LLM di frontiera; numeri di mercato. La difendibilità reale è **strutturale**: specializzato + on-device + privato + riaddestrabile localmente by design.
