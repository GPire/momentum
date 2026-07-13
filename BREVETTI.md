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

## Cosa NON rivendichiamo
Novità sui singoli algoritmi (sono pubblici); superiorità sul ragionamento aperto vs LLM di frontiera; numeri di mercato. La difendibilità reale è **strutturale**: specializzato + on-device + privato + riaddestrabile localmente by design.
