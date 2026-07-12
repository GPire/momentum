# NeuroSym — il motore AI unificato di Momentum (whitepaper onesto)

**v9 · 321 test · repo GPire/momentum · specs MISURATE, mai inventate**

NeuroSym è il nome del cervello AI di Momentum: un **sistema neuro-simbolico specializzato, on-device**, che unifica sotto un'unica API (`src/ai/neurosym.js`) i sottosistemi reali e testati del progetto. Non è un LLM, non è un transformer da 27B compresso. È l'architettura-sistema che nessun competitor consumer ha integrato così — ed è brevettabile come sistema, non come singolo modello.

## Cosa NON è (onestà da due diligence)
- **Non batte GPT-5/Opus al ragionamento aperto** — non lo pretendiamo. I frontier LLM restano avanti lì.
- **Non ha "0.05B parametri che battono BloombergGPT"** — sono cifre inventate dai blueprint; NeuroSym non dichiara param-count fasulli.
- **Non è PrismML** — quello comprime un generalista 27B per iPhone (problema diverso). NeuroSym è specializzato *by design*, ma è **pronto ad ospitarlo**: `expert-adapter.js` è lo slot pluggable per un grande modello futuro.

## Dove VINCE (misurato, riproducibile in 30s)
- **Categorizzazione bancaria specializzata**: 94,6% prodotto, 0,18 ms, on-device (`npm run bench`).
- **Aritmetica finanziaria verificabile**: 12/12, 0,002 ms — dove gli LLM allucinano i calcoli (`npm run bench:reasoning`).
- **Forecast spesa**: 68,9% meglio del naive, 40/40 (`npm run bench:forecast`).
- **Assi strutturali**: dimensione (KB vs GB), offline, privacy on-device, costo €0, adattività hardware, apprendimento online senza retraining.

## I layer (tutti reali, tutti testati)
| Layer | Componenti | Modalità |
|---|---|---|
| Categorizzazione | dizionario esercenti + Nano + Meso + DCGN | sparse-MoE per tier hardware |
| Memoria episodica | DCGN (grafo online) | impara ad ogni transazione, decade |
| Ragionamento causale | causal-graph | co-variazione tra categorie (Soros-style feedback nel factor reflexivity) |
| Investimenti | value/growth/momentum/risk/**reflexivity** + arbitro Munger + portfolio risk-parity | strategie degli 8 grandi (Buffett/Graham/Lynch/Simons/Dalio/Bogle/Munger/**Soros**), **personalizzate per utente** (strategy-evolution) |
| Q&A / fisco | qa-engine deterministico + tax P.IVA | on-device, offline, IT |
| Adattività hardware | compute-planner + adaptive-runtime + INT8 + expert-adapter | si plasma al device; slot per heavy-model futuro |

## La saggezza degli investitori DENTRO l'architettura (sez. 4)
Ogni strategia è un fattore misurabile (`src/alpha/factors.js`), pesato dall'arbitro per regime di mercato (`arbiter.js`), e **evolve per utente**: `strategy-evolution.js` misura quale strategia ha funzionato per quel particolare utente (track-record per fattore, lisciatura di Laplace) e ne modula il peso — neutro senza dati, mai inventato. È la sez. 4.2 resa reale: le strategie si personalizzano su chi usa l'app.

## Dati di mercato reali, gratuiti, resilienti
`src/alpha/market-data.js`: prezzi stock/crypto da fonti pubbliche gratuite (CoinGecko/Stooq CORS-friendly), con cascata che gestisce CORS/rate-limit/offline (fallback multi-endpoint → import CSV manuale → cache IndexedDB con etichetta "aggiornato al…"). Mai un crash, mai un prezzo inventato. Alimenta l'analisi del portafoglio reale (`portfolio-import.js`).

## Readiness per il grande modello (risposta a PrismML)
`expert-adapter.js` dichiara un'interfaccia esperto uniforme con requisiti hardware. Oggi lo slot heavy è vuoto (`available()=false`). Domani, un modello compresso reale (PrismML-style via WebGPU/WebNN) si innesta come esperto pesante attivato SOLO su tier alto, senza toccare l'architettura. Siamo pronti all'evenienza, onestamente, senza fingere di averlo già.
