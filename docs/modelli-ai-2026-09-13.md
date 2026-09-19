# Modelli Momentum — audit, stato dell'arte 2026 e cosa risolviamo del mercato (2026-09-13)

Fonte di verità per il cantiere "rete neurale e apprendimento". Tre ricerche
parallele (audit del codice contro SOTA, panorama SLM on-device, limiti
documentati degli AI finanziari del mercato). Ogni numero ha fonte o è marcato
stima. Regole invariate: tutto on-device, deterministico dove esiste una
formula, mai testo libero che addestri un modello, ogni limite dichiarato.

## 1. Cosa fanno DAVVERO i modelli oggi (letto nel codice, non nei commenti)

- `conformal.js`: split conformal corretto (quantile ⌈(n+1)(1−α)⌉/n,
  `garantito:false` sotto il minimo, insieme vuoto = fuori dominio). Contiene
  anche l'ACI di Gibbs & Candès (`initAdaptive`/`updateAdaptive`,
  `observedCoverage`) — fino a oggi **mai chiamata in produzione**.
- `orchestrator.js`: pesi = affidabilità × precisione Laplace per categoria ×
  bandit × cancello di calibrazione; classificazione conforme con α fisso 0,1
  su finestra di 300 correzioni reali.
- `calibration.js`/`calibration-gate.js`: ECE a 10 bin per esperto su finestra
  200; sospensione (peso ridotto) sopra ECE 0,25; registra se l'astensione
  "aveva ragione". Nessuna ricalibrazione delle probabilità (solo pesi).
- `neural-nexus.js`: **un solo passo di SGD** per correzione (lr 0,05, L2
  1e-4), categoria che nasce al primo esempio. Nessun replay, nessun EWC: una
  correzione recente può sovrascrivere le precedenti. Il vocabolario a
  conteggi non dimentica per costruzione.
- `cash-forecast.js`: banda p10/p90 **parametrica** (`Z90·√(σ²+eventVar)`);
  `forecast-calibration.js` misura ex-post la copertura ma non la ricollega.
- `federated-distillation.js`: previsioni su `PROBE_SET` pubblico (niente
  gradienti → inversione impossibile), mediana per coordinata pesata da
  reputazione; `contribution-drift.js`: CUSUM per peer sullo scarto persistente.

## 2. Confronto con lo stato dell'arte (con fonte)

| Tema | Già c'è | Manca | Come si misura l'upgrade |
|---|---|---|---|
| Continual learning senza dimenticare | Vocabolario a conteggi immune; correzioni reali già nel Vault | Replay buffer in `trainNeural` (8–16 esempi confermati per categoria, campionati dal Vault). EWC/SI falliscono in class-incremental, il replay regge (van de Ven 2020); la scelta dei campioni conta | `bench:ablation`: accuratezza sulle categorie vecchie prima/dopo N correzioni |
| Conformal adattiva sotto shift | ACI implementata e testata | **Collegata oggi** all'orchestrator (vedi §3). Manca ancora per la cassa: `predictInterval` sui residui di `forecast-calibration.js` al posto della banda parametrica (Gibbs & Candès 2021; Zaffran ICML 2022) | `bench:cash` walk-forward: copertura reale vs 80% promesso |
| Calibrazione online | ECE come cancello; astensione misurata | Temperature/Dirichlet scaling online sui logit dell'ensemble (Kull NeurIPS 2019); Brier e classwise-ECE (con 15+ categorie l'ECE di confidenza dice altro) | ECE prima/dopo sugli esiti già registrati |
| Aggregazione federata robusta | Mediana + reputazione + CUSUM (SABLE/DSN 2026 batte Multi-Krum e trimmed mean) | Garanzia formale: la mediana regge solo con <50% di peer malevoli per coordinata. **FLTrust** (NDSS'21) regge al 40–60% con una root dataset <100 esempi — e `PROBE_SET` **è già** una root dataset pubblica | `garanzia-sybil-partizione.test.js` esteso al 50–60% di peer avvelenati |
| Personalizzazione federata | De facto FedPer: base condivisa + testa personale | Regolarizzazione tipo Ditto (ICML 2021): il modello personale resta vicino al globale (robustezza + equità) | `train:eval` non-IID con/senza termine di prossimità |

## 3. Costruito oggi

- **ACI collegata** (`orchestrator.js`): l'α di lavoro viene da
  `mlData.conformalAdaptive` (clamp [0,03, 0,3]); a ogni conferma con
  garanzia attiva si registra se l'insieme conteneva la categoria vera;
  `garanzia` dichiarata alla UI = 1 − α di lavoro. Tre test nuovi. Effetto:
  la promessa "9 volte su 10" viene inseguita sulla copertura REALE della
  persona, non assunta.

Prossimi, in ordine (ognuno con il suo bench): replay buffer in
`neural-nexus.js`; `predictInterval` conforme per la cassa; FLTrust sopra le
sonde in `federated-distillation.js`.

## 4. Piccolo modello linguistico on-device: solo per capire, mai per contare

Verdetto della ricerca: **Qwen3-0.6B q4f16 via WebLLM + XGrammar**, unico
≤1B con Apache-2.0, multilingua dichiarato ("100+ lingue", le 7 di Momentum
non verificate una per una) e tool calling. Solo opt-in, solo con WebGPU
(Safari 26; in WKWebView Capacitor solo da iOS 26 — parola di Apple DTS;
Chrome Android ≥121). Peso ONNX q4f16 570 MB; decode 4–17 token/s sui
telefoni di fascia bassa (LlamaWeb, 16 device); fascia bassa iOS con 150–300
MB di memoria per WebView: esclusa di fatto.

Gate proposto: frase → SLM con schema XGrammar `{intento: enum[15],
argomenti}` (sintatticamente impossibile emettere altro) → validazione →
intento chiuso esistente → motore deterministico → `rifiuto-strutturale.js`.
L'SLM **non vede mai una transazione**: solo la frase. Nessun numero esce da
un modello linguistico. Da giustificare con un delta misurato sui banchi di
prova (oggi il parser a regole fa 88,9–100%): senza delta, resta spento.

## 5. I limiti documentati degli AI finanziari del mercato, e la nostra risposta

| Limite (fonte) | Momentum oggi | Per dirlo "risolto" davanti a terzi |
|---|---|---|
| Il chatbot impegna l'azienda: *Moffatt v. Air Canada* 2024 BCCRT 149; CFPB su chatbot bancari incompleti/errati | Q&A deterministico, `rifiuto-strutturale.js`, Centro Fiducia | Bench pubblico riproducibile da `qa-banco-prova.js` (script `bench:` permanente) |
| LLM su calcoli finanziari: FinanceBench 47% corretto; con contraddizioni iniettate risposta "pulita" nel 63–76% (arXiv 2609.05928) | Formule esatte, `train:gate` | Tax-bench IT/ES/CH con casi ufficiali e risultato atteso, eseguibile da terzi |
| Dati al cloud: Cleo rimanda alle policy OpenAI; Copilot Money manda domanda+dati a un LLM (policy non fetchabili oggi: da leggere a mano prima di citarle) | Zero dati in uscita per costruzione | Test di CI che asserisce nessuna chiamata di rete con dati personali |
| Calibrazione: FinVerBench, 9 run su 14 con 95–100% falsi positivi su bilanci corretti — "la calibrazione, non l'aritmetica, è il problema" | `conformal.js` + ACI, `calibration-gate.js`, `forecast-calibration.js` (7/14/30 gg) | Pubblicare la copertura reale degli intervalli |
| AI-washing: SEC, sei casi dal 2024, >44 M$ contestati; priorità d'esame 2025-26 su backtest spacciati per live | Mai buy/sell; backtest sempre etichettato | Nessun claim "AI proprietaria che batte il mercato" |
| Drift/categorizzazione: Plaid ">90%" e categorie disallineate in migrazione; Mint→Credit Karma perde categorie custom | `contribution-drift.js`, categorie custom che sopravvivono | Accuratezza nel tempo per utente, mostrata e riproducibile |

Tre claim difendibili con prova nel repo: (1) nessuna risposta su consiglio o
previsione è possibile per costruzione; (2) ogni proiezione ha una banda
misurata e ricontrollata a 7/14/30 giorni; (3) il modello si sospende da solo
quando la calibrazione peggiora, e ora insegue la copertura promessa (ACI).

Claim da NON fare: "AI che risponde a tutto", "nessun errore", "modello
proprietario superiore" senza bench pubblico, previsioni senza intervallo.

## 6. Tecnologie proprietarie (componenti per la invention disclosure)

Elenco dei pezzi costruiti o progettati in questo cantiere e in Sciame, con
l'effetto tecnico che li rende più di un "metodo di business" (EPO G-II 3.6):

- `pairing-commitment.js` — impegno pubblico legato al fingerprint DTLS per
  canali laterali non segreti (autenticazione di comunicazioni).
- `frame-stream.js` — canale affidabile a interfaccia RTCDataChannel sopra
  trasporti a pacchetti corti (BLE/L2CAP/suono): la mesh non cambia codice
  cambiando radio (funzionamento interno di interfacce).
- Orchestrator con ACI + cancello di calibrazione + astensione conforme —
  controllo adattivo della garanzia di copertura su correzioni reali.
- Distillazione federata su sonde pubbliche + CUSUM per peer (+ FLTrust in
  arrivo) — aggregazione robusta senza gradienti.
- Staffetta di inferenze corroborate per etichetta con reputazione
  (`sentiment-relay.js`, `knowledge-relay.js`).
- Mercato di calcolo con verifica in doppio deterministica (`compute-market.js`).

Prior art e rischi per idea: docs/sciame-discovery-2026-09-13.md, tabella
"Bozza di invention disclosure".
