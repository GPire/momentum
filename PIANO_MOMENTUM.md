# MOMENTUM — Piano Ultra Potenziamento & Dossier Valore (2026-07-06)

Documento unico: stato reale del prodotto, piano di sviluppo, e dossier investitori.
Scritto perché QUALSIASI sessione futura (Sonnet, Opus 4.8, Fable) possa riprendere il lavoro senza ricostruire il contesto.
Progetto: `~/Downloads/momentum_app/` (Vite vanilla JS, PWA offline-first). Copia sincronizzata in Obsidian: `Claude Memory/Momentum — Piano Potenziamento 2026-07-06.md`.

## Regole non negoziabili del progetto
1. 100% on-device: i dati dell'utente non lasciano MAI il dispositivo.
2. Niente server proprietari, niente API a pagamento obbligatorie.
3. Onestà tecnica assoluta: MAI moduli decorativi o claim non misurati (i "moduli SLLMv2" delle versioni vecchie erano facciate — mai più).
4. Ogni modulo nuovo = funzioni pure + test `node --test src/`; DOM solo in main.js.
5. Mai riscrivere amount/category/hash di transazioni esistenti (hash chain).
6. UI/UX "a prova di bambino di 8 anni": un numero dominante per schermata, parole semplici, verde=puoi/giallo=attenzione/rosso=fermati.

## Limiti OS accertati (NON riproporre soluzioni impossibili)
- Una PWA non legge le notifiche di altre app (iOS e Android). Su iOS nemmeno un'app NATIVA può farlo; Apple non espone le transazioni Apple Pay (via reale su iOS: Open Banking, che le copre via conto bancario).
- Su Android la lettura diretta è reale SOLO in app nativa con `NotificationListenerService` (guscio Capacitor → F7b).
- iOS non supporta Web Share Target per PWA; push PWA su iOS richiede un push server (vietato dai vincoli).
- Niente Bluetooth/NFC da Safari; niente scrittura silenziosa nel Calendario iOS (solo export .ics).
- Nessun rilevamento "testo generato da AI" affidabile (ricerca irrisolta, già respinto 2 volte); nessun training di modelli 15M-7B senza GPU cluster e dataset (già respinto — il Meso reale è la via).

---

## 🚀 Sessione 2026-07-20: MOMENTUM CONSTELLATION v10 — 6 wave core spedite, 521 test verdi

Piano completo in `~/.claude/plans/okay-adesso-prendi-ogni-mellow-liskov.md` (16 wave) +
strategia offensiva in `MANIFESTO_v10.md` (repo root). Priorità: prima approfondire i
motori CORE esistenti (NeuroSym/Momentum Core/DCGN/mesh), poi le feature periferiche.
**Ogni wave verificata end-to-end in Chrome con dati reali**, non solo unit test — i bug
veri emergono solo lì (2 bug reali trovati e corretti così questa sessione).

Ordine eseguito: Wave 0 → 1 → 13 → 12 → 14 (+Granger) → 15. Da 468 a 521 test, 8 commit puliti.

- **Wave 0**: chiuso il batch appeso di sessione precedente (Net Worth+Monte Carlo,
  sources.js W17, mesh prezzi P2P, modulo bandit). **Bug reale corretto**: chat.js
  multilingua rotto (matchIntent→{intent,lang} non aggiornato nel call-site).
- **Wave 1**: bandit cablato nell'advisor reale (`src/predict/advisor-bandit.js`:
  phaseOfMonth/dailySeed/mergePendingSameDay/window.nudgeActed). **2° bug reale
  corretto**: renderAnalysis() gira più volte/giorno, perdeva i tap registrati →
  mergePendingSameDay. Nota tecnica: vault.js ha un anti-tampering (omega_shadow_vault
  base64) che scarta edit localStorage grezzi non passati da save() — utile per testare.
- **Wave 13 "Meta-Bandit Ensemble"**: `src/ai/expert-bandit.js` — il bandit (Wave 1)
  applicato alla SELEZIONE ESPERTI dell'orchestrator (contesto categoria×lunghezza-
  descrizione×tier). Deliberatamente NO Thompson sampling (solo armMean deterministico:
  classify() deve restare deterministico). A freddo = v3 bit-identico.
- **Wave 12 "NeuroSym v2 Financial Reasoning Layer"**: scoperto che `Omega.reason()`
  (src/ai/omega.js) esisteva già come ragionatore a 5 strati — esteso, non duplicato.
  Nuovo `src/ai/reasoning-fusion.js` (combineConfidence + crossDomainWhatIf: combina
  what-if.js cashflow€ con net-worth.js Twin Monte Carlo). Verificato live: "taglia
  ristoranti 20%" → causale → 62,06€/mese liberati → Twin 1 anno +751,01€ p50.
- **Wave 14 "causale v2" + Granger causality reale**: `pruneNonCausal` (euristica di
  precedenza quando A→B e B→A stesso lag superano soglia, tiene solo la direzione più
  forte) + **vero test di Granger causality** (OLS 1/2 variabili scritto da zero,
  regola di Cramer per il sistema 3x3) — la parte REALE e costruibile di TCGformer
  (verificato via ricerca: paper reale, non allucinato — ma il Transformer richiede
  training pesante su GPU, non gira on-device; Granger sì). Verificato live sui dati
  reali: "spesa→ristoranti" aveva r=0.592 ma Granger lo boccia (riduzione 0.001,
  correlazione spuria); "trasporti→shopping" confermato (riduzione 0.402).
- **Wave 15 "Mesh v2 federazione metadati"**: `src/mesh/meta-federation.js` — condivide
  via mesh SOLO le medie a posteriori "quale esperto fidarsi per quale contesto" (mai
  dati grezzi/conteggi), pesato per reputazione (update-ledger.js, stesso anti-poisoning
  già validato). Un livello sopra il FedAvg classico. Cablato in mesh-signaling.js
  (reliability_share) + main.js (ciclo idle). Verificato live end-to-end.

**Verifica di due blueprint esterni incollati dall'utente durante la sessione**:
1° blueprint (commit + tech "TCGformer/FinSecure-FL/NanoQuant/PrismML"): commit VERI
(verificato via git log), tecnologie VERE (verificato via WebSearch — a differenza dei
blueprint "SLLMv2" passati) ma SCALA sbagliata (LLM 70B su GPU cluster / blockchain
multi-istituzionale bancaria vs modelli KB on-device / mesh P2P consumer). Risposta:
costruita la versione onesta e scalata correttamente (Granger invece di TCGformer intero,
digest di affidabilità invece di blockchain PoA). Dettagli in MANIFESTO_v10.md.
Ricerca reale su Google Finance (uscito da beta 25/6/2026): risposta nel manifesto,
Deep Search esplicitamente [Rifiutato] (richiederebbe LLM cloud).

**RESTA nel piano** (16 wave totali, task tracciate solo per le prime 6 core): Wave 2
(NLU quick-add testuale), 3 (achievements/badge onesti), 4 (onboarding valore-immediato
+ FAQ), 5 (simulatore utenti sintetici per validare retention), 6 (training gate
regressioni), 8 (splitting P2P alla Splitwise), 9 (envelopes/round-up/PAC/runway 90gg),
10 (strategy scorecard investitori), 11 (bench vs-LLM aggiornato), 7 (sync bulletproof
E2E cifrato, rischio alto — richiede 2 device fisici, per ultima).

---

# PARTE 1 — STATO SVILUPPO (aggiornato 2026-07-06, 161/161 test verdi, build pulita)

## ✅ Fatto in questa sessione (codice + test; verifica browser in coda)

### F1 — Offline vero
`public/sw.js` v52: doppia cache — `momentum-vault-v52` network-first (app), `momentum-vendor-v1` cache-first per host CDN (tailwind, cdnjs, jsdelivr, google fonts, tessdata.projectnaptha.com). Precache tollerante (`Promise.allSettled`, mai `addAll`), activate che NON spazza la vendor cache ai bump. Warm-up OCR in main.js (`Tesseract.createWorker('ita')` in idle, solo tier≠minimo e online, worker condiviso con pdf-parser via `window._tesseractWorker`).

### F2 — Safe-to-spend + advisor predittivo
`src/predict/advisor.js` (15 test): `getUpcomingCharges` (importo = ULTIMO addebito per catturare aumenti; grazia 5gg per addebiti in ritardo), `getDailySafeToSpend` ((rimanente settimana − ricorrenti attesi)/giorni rimasti; null senza budget: mai numeri inventati), `getMonthEndProjection` (Holt-Winters `hw.level` dal forecast worker quando c'è, altrimenti run-rate; `method` sempre dichiarato), `getAdvisorInsights` (consolidatore unico, ordinato per gravità).
UI: card "Oggi puoi spendere" (`#safe-to-spend-card`) in cima alla dashboard; `renderRadarAlerts()` unifica gli avvisi; il forecast worker aggiorna `window.__hwDailyLevel` e ri-renderizza. I consigli finti "Buffett/Munger" sono stati SOSTITUITI dalla proiezione misurata.

### F3 — Retention layer (anti-abbandono)
`src/predict/engagement.js` (17 test): `touchStreak` (gap→1, orologio indietro non regala progressi), `computeWeeklyRecap` (ultima settimana completa vs precedente; null se vuota), `computeGoalProgress` (risparmio netto reale da createdAt; onTrack misurato vs deadline), `suggestSubscriptionRegistrations` (ricorrenti rilevati non registrati, un tap per registrarli → migliorano anche il forecast via oracle.js).
Stato: campi ADDITIVI `engagement` e `savingsGoals` in VaultDAO.state (nessuna migrazione necessaria — spread di init). UI: badge 🔥 streak nell'orb, card recap/proposte negli alert, card obiettivi in analysis (`window.openGoalEditor/confirmGoalCreate/deleteSavingsGoal/registerDetectedSubscription`).

### F5 — OCR scontrini potenziato
`src/import/screenshot-parser.js` (12 test): `extractMerchant` (filtri P.IVA/CAP/indirizzi/diciture fiscali; null se non c'è nulla di plausibile), pattern importo allargato a \D{0,24} ("TOTALE COMPLESSIVO 45,80" prima sfuggiva). Categoria automatica via ensemble già cablata.

### F6 — PDF multi-banca
`src/import/pdf-parser.js` + `src/import/fixtures/pdf-layouts.js` (8 test: Intesa, UniCredit, N26, Revolut, colonna-Saldo). Fix reali: (1) ordinamento y INVERTITO (y PDF cresce verso l'alto); (2) `extractTransactionsFromItems` estratta pura ed esportata; (3) keyword a TEMI ("addebit|accredit" — Intesa usa i plurali) + inglesi; (4) colonna `ignore` per Saldo/Balance (prima il saldo progressivo diventava una spesa per riga); (5) niente più distanze da colonne assenti (x=-1); (6) righe di continuazione appese alla descrizione precedente (prima perse); (7) date ISO/1-cifra/mesi testuali IT-EN.
🔴 Bug reale trovato: pdf/csv-parser chiamavano `renderDashboard()` nudo (ReferenceError silenziato → import ok ma UI mai aggiornata). Corretto con `window.renderDashboard?.()`.

### F10 — Motore Q&A on-device ("l'app risponde a ogni domanda")
`src/ai/qa-engine.js` (14 test): `answerQuestion(q, ctx)` deterministico. Intent: quanto ho speso (periodo+categoria), quanto posso spendere oggi, posso permettermi X, come chiudo il mese, quali abbonamenti pago / quando pago Netflix, dove spendo di più, quanto ho risparmiato/guadagnato, a che punto è l'obiettivo, unknown (onestà: elenca cosa sa fare). Periodi: oggi/ieri/questa settimana/mese scorso/mesi nominati.
UI: card "Chiedi a Momentum" in dashboard; `window.askMomentum`; console `queryOracleChat`. VOCE: le domande parlate vengono riconosciute PRIMA del parser transazioni e la risposta viene letta ad alta voce (speechSynthesis it-IT, offline).

### F7a — Parser notifiche wallet (parte pura)
`src/import/notification-parser.js` (8 test): pattern reali Google Wallet, Satispay, SMS/push bancari (addebito/accredito+causale), Revolut EN, PayPal, prelievi. `cleanMerchant` toglie code tecniche. `parseNativeNotification` filtra per `KNOWN_WALLET_PACKAGES` (13 app bancarie/wallet italiane): WhatsApp & co. non arrivano nemmeno al parser. Null quando non matcha — MAI transazioni inventate.

## ⬜ Da fare (in ordine)

### ✅ Verifica browser reale — FATTA (2026-07-06, localhost:5173)
- Console pulita al boot; orchestratore 3 vie + OCR warm-up ok.
- Safe-to-spend ESATTO a mano: budget 1000€, settimana 6-12 lug = 225,81€ + riporto 129,29€ = 355,10€; ÷7 = 50,73€ — identico alla card.
- Proiezione fine mese aggiornata dal forecast worker con hw.level=5.05 (32 + 5.05×25 = 158,25€ — verificato a mano).
- Q&A via UI reale: "quanto posso spendere oggi?" → risposta esatta; affordability 40€ → "Sì... restano 10,73€".
- Recap settimanale renderizzato; obiettivo "Vacanza" creato via UI, barra 0%.
- SW v52 attivo, cache `momentum-vendor-v1` con 12 entry (tutti i CDN + font runtime).
- OCR end-to-end con scontrino sintetico su canvas: "FARMACIA SAN CARLO" estratto (P.IVA/indirizzo saltati), totale 12,80€ da "TOTALE COMPLESSIVO" (non i 20€ contanti), tx nel vault.
- NON verificabili qui: voce (serve mic), share target (serve Android), mesh 2 dispositivi.

### ✅ F4 — Web Share Target (Android) — CODICE FATTO, verifica device mancante
Implementato: manifest.json `share_target` POST multipart (file `image`, action `./share-target`); sw.js intercetta il POST prima del check GET, blob in cache (`./__shared-image`), redirect 303 a `?shared=1`; main.js `consumeSharedImage()` al boot → `handleScreenshotUpload(blob)`. Solo Android Chrome con PWA installata (iOS escluso da Apple). ⚠️ NON VERIFICATO su device (nessun Android/adb su questo Mac): al primo device reale, `adb reverse tcp:5173 tcp:5173` e condividere uno screenshot.

### ✅ F11 — Memoria importi + tasti rapidi one-tap (FATTO, verificato in browser reale)
`src/predict/amount-memory.js` (8 test): `predictAmount(catId, desc, allTx)` — importo tipico con confidenza dichiarata ('alta' ≥3 occorrenze stesso importo e ≥60% dei casi; mai indovinare se il pattern non è stabile); `getQuickAddSuggestions` — acquisti abituali ultimi 90gg con cifra stabile, ordinati per frequenza.
UI (main.js): riga `#quick-add-row` nel form transazioni — un tocco compila tipo+categoria+descrizione+importo (verificato live: "⚡Sigarette 5,40 €" → form completo e Conferma attivo); selezione categoria a importo vuoto → prefill automatico se confidenza alta (cancellabile col DEL). È la risposta diretta a "se selezioni quel prodotto la cifra è sempre la stessa".

### ✅ UX semplificata (FATTO)
Sottotitoli in linguaggio da bambino di 8 anni sotto i titoli criptici (additivi, brand intatto): Salvadanaio Quantistico ("I soldi che avanzano finiscono qui da soli"), Analisi Tensor ("Dove vanno i tuoi soldi e come andrà a finire il mese"), Dispersione Capitale ("La torta delle tue spese"), FIRE ("Tra quanti anni potresti vivere di rendita"), What-If ("Muovi la barra e guarda"), Mappa Giornaliera ("Più il giorno è acceso, più hai speso — tocca un giorno per la cifra" + tooltip con l'importo reale su ogni giorno).

### F7b — Guscio nativo Android (Capacitor) → LETTURA DIRETTA NOTIFICHE
`npm i -D @capacitor/cli @capacitor/core @capacitor/android`, `webDir:'dist'`, `npx cap add android`. Plugin Kotlin `NotificationListenerService`: filtra `KNOWN_WALLET_PACKAGES`, accoda `{title,text,package,ts}`, consegna al WebView → `parseNativeNotification` → `VaultDAO.addTransaction` (il dedup fuzzy esistente evita doppioni con PDF/OCR/Open Banking). Serve Android SDK + device per verifica onesta (2026-07-06: NESSUN SDK/adb su questo Mac — installare Android Studio prima di questa fase).

### ✅ F8 — Mesh federato: cablato e VERIFICATO SU 2 NODI REALI (2026-07-06)
Il buco previsto era vero: `MeshNode._handleRemoteWeights` fondeva i pesi nel motore standalone (copia morta), non in NeuralNexus. Costruito `src/mesh/nexus-adapter.js` (6 test): serialize() legge la rete VERA (formato dichiarato nexus-v1), mergeRemote() delega a `orchestrator.mergeRemoteNeuralNet` (FedAvg pesato + anti-poisoning su validation set), formati sconosciuti rifiutati; **dispositivo nuovo (rete vuota) ADOTTA la mente del peer** invece di rifiutarla — il secondo dispositivo nasce già addestrato. MeshNode instrada al percorso webapp quando `mind.mergeRemote` esiste (standalone invariato). main.js: nodo creato in initMomentumRealAI, `orchestrator.mesh` collegato (learn() già chiamava broadcastLearning), UI "🧠 Collega un dispositivo" nel P2P Sync Bridge con modal invito/risposta (PairingSignaling, codici compressi ~700 caratteri).
**Verificato live su due origin separati (dev :5173 + preview :4173 = storage indipendenti)**: pairing riuscito via scambio codici; pesi iniziali del nodo vuoto RIFIUTATI dal controllo di sicurezza (corretto); il nodo nuovo ha EREDITATO la rete addestrata (9 esempi); learn() su B → broadcast → A ha fuso: "esempi totali: 18" (9+9 FedAvg esatto). Fiducia = pairing esplicito, MAI federazione con sconosciuti.

### ✅ F12 — Salto di versione AI: ragionamento a catena + Orchestrator v3 (2026-07-06, sera)
Versioni etichettate SOLO dove il salto è reale (regola del progetto):
- **Grafo causale** (`src/predict/causal-graph.js`, 7 test): co-variazione misurata tra categorie sulle DIFFERENZE settimanali (mai sui livelli: il trend comune non crea legami finti), lag 0 (si muovono insieme) e lag 1 (una settimana dopo — unico indizio di direzione possibile coi dati di un utente). `propagateImpact` = attivazione a catena ("tocchi A → si muovono i vicini di A"), profondità 2, effetti sotto soglia scartati, ogni effetto porta il PERCORSO che lo spiega. Onestà dichiarata anche nel testo UI: "Non è una legge, è quello che è successo nelle tue settimane".
- **Orchestrator v3** (3 nuovi test): matrice di precisione incrementale per-modello-per-categoria (`mlData.modelStats`), aggiornata da ogni conferma/correzione reale dell'utente in `learn()`; in `classify()` ogni voto è modulato da (0.5 + precisione Laplace) — NEUTRO senza dati (comportamento pre-v3 bit-identico, verificato dai test vecchi che restano verdi), fino a ×1.5/×0.5 col misurato. Il sistema impara QUALE dei suoi modelli ascoltare, categoria per categoria. Verificato: dopo 6 correzioni il Nano batte il Meso sul caso dove il Meso sbagliava.
- **Cablaggio**: nuovo intent Q&A "cosa succede se spendo di più in X?" (risposta dal grafo, con onestà nel testo); card advisor "Le tue spese si muovono insieme" (solo legami |r|≥0.6 e ≥10 settimane).
- **NeuralNexus "v2"**: L2 + gradient clipping erano GIÀ innestati (sessione precedente) — nessuna rietichetta finta.
- **Nano v2 / Meso v2**: richiedono RIADDESTRAMENTO Python (train_meso.py) con le correzioni reali accumulate da modelStats/uso — sessione dedicata, ora c'è la fonte dati giusta.

### Evoluzioni architettura AI (potenziamento continuo, tutte fattibili on-device)
1. **Orchestratore v2 — pesi per-categoria**: oggi Nano/Meso pesano 80%/89.7% globali; misurare l'affidabilità PER CATEGORIA sul feedback reale dell'utente (matrice di confusione incrementale in IndexedDB) e pesare il voto di conseguenza. Auto-apprendimento vero, zero cloud.
2. **Active learning**: quando l'ensemble è in disaccordo o sotto soglia di confidenza, chiedere UNA conferma all'utente (un tap) e usarla come esempio di training prioritario per NeuralNexus — il modello impara di più dove sbaglia di più.
3. **Meso v2**: riaddestrare in Python (train_meso.py in ~/Downloads/momentum_real_ai/) aggiungendo al dataset le descrizioni REALI corrette dall'utente (esportate anonime dal vault, mai stringhe personali nel modello pubblico).
4. **State-space Holt-Winters** (src/predict/state-space.js, già scritto e testato, O(1) per punto): collegarlo a oracle.js con persistenza stato in IndexedDB + re-init pieno su modifiche retroattive.
5. **Dispatcher adattivo**: soglie a percentili mobili sul dispositivo (oggi costanti dichiarate).

### Roadmap prodotto
- **Open Banking GoCardless** (gratuito, copre anche Apple Pay via conto): serve account/credenziali dell'UTENTE — scaffolding del client appena le fornisce.
- **Tailwind build-time + vendoring** (ora CDN precache-ata dal SW: offline garantito ma JIT runtime non ottimale).
- **Pubblicazione Android** (APK/store) dal guscio Capacitor; poi valutazione iOS nativa (per iOS la lettura notifiche resta impossibile, il valore è distribuzione + push).
- **Backup cifrato esportabile** (file .momentum cifrato con passphrase, già coerente con hash chain) — risposta alla domanda "e se perdo il telefono?".

---

# PARTE 2 — DOSSIER VALORE: cosa risponde Momentum a utenti, investitori e acquirenti

## Le domande degli UTENTI (e le risposte già implementate)
| Domanda | Risposta del prodotto |
|---|---|
| "Quanto posso spendere oggi?" | Card safe-to-spend + Q&A testuale/vocale: numero unico calcolato (settimana − abbonamenti in arrivo) ÷ giorni |
| "Posso permettermi X?" | Q&A `affordability`: sì/sì-ma/no con i numeri veri |
| "Come chiudo il mese?" | Proiezione Holt-Winters (o run-rate dichiarato) |
| "Dove vanno i miei soldi?" | Top categorie con percentuali, recap settimanale automatico |
| "Che abbonamenti pago? Sono aumentati?" | Rilevamento automatico + aumenti silenziosi >10% + proposta one-tap |
| "Perché dovrei continuare a usarla?" | Streak, recap, obiettivi con progresso reale, zero-input (OCR scontrini/PDF/notifiche) |
| "I miei dati dove vanno?" | Da nessuna parte: tutto sul dispositivo, funziona offline, verificabile |

## Le domande degli INVESTITORI/ACQUIRENTI (e le risposte oneste)
1. **"Perché non vi schiaccia ChatGPT Finance / Google / Apple?"** — Perché il vantaggio è STRUTTURALE, non di scala: loro monetizzano i dati o l'abbonamento cloud; Momentum non può leakare dati che non riceve. Privacy-by-architecture non è replicabile da chi ha un business model basato sui dati. L'AI on-device (ensemble 3 modelli reali + federated learning tra dispositivi fidati) migliora senza che un byte esca dal telefono.
2. **"Il moat tecnico qual è?"** — (a) pipeline di categorizzazione ensemble addestrata e verificata (Nano 80% / Meso 89.7% misurati su testo bancario sporco, cross-check Python↔JS a 2e-16); (b) mesh federata P2P senza server con anti-poisoning; (c) motore predittivo reale (HW/GARCH/AR2 con backtest walk-forward); (d) architettura a tier hardware (κ misurato, non stimato). Tutto testato: 135 test automatici.
3. **"Come fate i soldi senza vendere dati?"** — Freemium onesto: gratis il core, a pagamento una-tantum (non abbonamento) le funzioni pro (Open Banking multi-conto, backup cifrato cloud personale dell'utente, app nativa con lettura notifiche). Il pitch: "l'unica app di finanza che paghi UNA volta perché non sei tu il prodotto".
4. **"Che cosa vi manca per valere 1,5 miliardi?"** — vedi sotto, gap list concreta.
5. **"Retention?"** — Il layer anti-abbandono è appena stato costruito (streak/recap/obiettivi/zero-input); la metrica va MISURATA su utenti reali — è il primo gap da chiudere, non un numero da inventare.

## GAP LIST CONCRETA per il valore miliardario (in ordine di importanza)
1. **Utenti reali e dati di retention** — oggi: 1 utente (il fondatore). Nessuna valutazione seria esiste senza D30/D90 retention misurata. Azione: TestFlight/APK a 50-100 beta tester, telemetria PRIVACY-FIRST (contatori aggregati opt-in, mai contenuti).
2. **Distribuzione** — una PWA non si scopre da sola. Azione: guscio Capacitor → Play Store (subito) e App Store (dopo), che è anche l'unica via alla lettura notifiche (Android).
3. **Open Banking (PSD2)** — l'import automatico dal conto è la killer feature di onboarding UE e copre Apple Pay. Azione: integrazione GoCardless (gratuita) appena l'utente crea l'account.
4. **Sicurezza certificata** — "i dati restano sul dispositivo" vale il doppio con un audit di terze parti + cifratura at-rest (WebCrypto AES-GCM sul vault IndexedDB, deriva chiave da passphrase). Buildabile subito.
5. **Backup/ripristino** — "e se perdo il telefono?" oggi non ha una buona risposta. Export cifrato + ripristino verificato con hash chain.
6. **Localizzazione** — il parser è IT-first con EN parziale; per il mercato UE servono DE/FR/ES (pattern banche locali nel notification/pdf parser — architettura già pronta, sono dati non codice).
7. **Entità legale, brevettabilità, team** — le architetture (mesh federata anti-poisoning on-device per finanza personale; dispatcher novelty-routing) sono difendibili ma vanno depositate; e una società con 1 persona non vale 1,5B: la valuation compra team + traiettoria.
8. **Benchmark pubblico** — pubblicare il confronto misurato di categorizzazione vs competitor (dataset sintetico bancario open) — il claim "89,7% su testo sporco, on-device, 400KB" è verificabile e fa PR da solo.

**Verdetto onesto**: il prodotto ha già una base tecnica VERA e differenziata (rara nel settore, dove quasi tutto è wrapper di API cloud). Il valore da 1,5B non è bloccato dalla tecnologia: è bloccato da distribuzione, prova di retention e struttura societaria. La strada: beta misurata → store → Open Banking → audit sicurezza → metriche → round.

---


## 🚀 MOMENTUM CORE — modello proprietario (2026-07-06, notte tarda; 212 test)
Rispondendo alla domanda "Phi-4 o costruire da zero?": costruito il modello PROPRIETARIO reale su questo Mac i5. Decisione documentata: no Phi-4, no transformer-da-zero (serve GPU cluster), sì architettura-sistema ibrida.
- **Salto benchmark MISURATO 51.5% → 92.5%** (`npm run bench`): architettura ibrida dizionario esercenti (`src/ai/merchant-dictionary.js`, come Plaid/Yodlee) + Meso v2 riaddestrato su CPU (vocabolario esercenti reali) + fallback ML. Generalizzazione ML pura dichiarata a parte (59.4%) per onestà. Cross-check Python↔JS 2.2e-16 esatto.
- **Astensione** (`orchestrator.js`): l'AI dichiara `abstain` quando incerta ("non sono sicuro, confermi?") invece di forzare — il "capisce a priori gli errori" richiesto. UI del form aggiornata. 3 test.
- **Documenti per investitori/acquirenti**: `MOMENTUM_CORE.md` (whitepaper architettura onesto, decisione Phi-4, 5 pilastri, mappatura sigle V7.5), `COPERTURA.md` (matrice frizioni-utente + domande due-diligence, con onestà sulla valutazione). Su repo + Obsidian.
- Restano (roadmap, non promesse): C7 feature multi-segnale, C8 quantizzazione int8, C4 orchestrator v4 API unica, C6 modello globale in UI, forecast-bench, riaddestramento con dati reali utenti.


## MOMENTUM CORE — completamento fasi (2026-07-07; 214 test)
- ✅ C4: API unificata `momentumOrchestrator.infer(desc, amount, date)` → {category, confidence, abstain, sources, explanation}. `classify()` resta alias retro-compatibile. È il nome pubblico dell'architettura Momentum Core.
- ✅ C5: `npm run bench:forecast` — Holt-Winters MAPE 8.6% vs naive 27.8% = **68.9% meglio, 40/40 serie**. Secondo numero difendibile per gli investitori.
- ✅ C6: stato del "modello globale emergente" visibile nel Momentum Vault (esempi totali, fusioni accettate/rifiutate, reputazione peer dalla catena hash).
- ⬜ Restano opzionali (roadmap, non promesse): C7 feature multi-segnale (importo+ora+giorno nel modello), C8 quantizzazione int8 per hardware debole, calibrazione temperature-scaling formale (ECE).

# GUIDA OPERATIVA PER LA PROSSIMA SESSIONE (qualsiasi modello: Opus, Sonnet, Fable)

Scritta per essere eseguita passo-passo senza dover ricostruire il contesto. Leggi PRIMA le trappole note in fondo.

## Regole d'oro (violarle = rompere il progetto)
1. `cd ~/Downloads/momentum_app` — il progetto è QUESTO. `~/Downloads/momentum_real_ai/` è solo il laboratorio Python di training.
2. Dopo OGNI modifica: `node --test src/` (devono restare TUTTI verdi, oggi 167) e `npm run build` (pulita).
3. `node --check` e i test unitari NON bastano: i bug veri emergono solo aprendo `localhost:5173` in un browser vero e guardando la console PRIMA di interagire.
4. Mai riscrivere `amount`/`category`/`hash` di transazioni esistenti (hash chain a cascata).
5. Campi di stato NUOVI in VaultDAO.state = additivi (lo spread di init() li copre). Ristrutturare un campo esistente = serve entry in MIGRATIONS (vault.js).
6. Ogni modulo nuovo: funzioni pure in src/predict|ai|import + file .test.js accanto (shim: `globalThis.window = globalThis.window || {}; globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };` prima dell'import dinamico). DOM solo in main.js.
7. Mai moduli decorativi, mai numeri non misurati. Le versioni si guadagnano coi benchmark (`VERSIONI.md`).
8. Ogni testo UI: comprensibile a un bambino di 8 anni. Colori: verde=puoi, giallo=attenzione, rosso=fermati.
9. A fine sessione: aggiornare questo file + copiarlo in Obsidian (`cp PIANO_MOMENTUM.md "/Users/giorgiopiredda/Documents/claude_obsidian/Claude Memory/Momentum — Piano Potenziamento 2026-07-06.md"`) + aggiornare la memoria del progetto + commit e push su GitHub (repo privato GPire/momentum).

## ONDATA 2 — stato (2026-07-06, notte; 203/203 test verdi)
- ✅ **Backup cifrato "DNA"** (`src/core/backup.js`, 7 test): risolve il limite REALE "perdo il dispositivo = perdo i dati". AES-GCM-256 + PBKDF2 SHA-256 210k iterazioni via Web Crypto (reale, non teatro). Export .momentum protetto da passphrase + ripristino con conferma. **Verificato nel browser**: nessun dato in chiaro nel file, round-trip ok, passphrase errata respinta (autenticità GCM). UI nel Momentum Vault.
- ✅ **W7** Export dataset (`window.exportTrainingData`): storico descrizione→categoria + modelStats in JSON, pronto per train_meso.py (riaddestramento v2).
- ✅ **W5** Calendario addebiti attesi: `getUpcomingCharges` (30gg) mostrati come voci "fantasma" 💳 accanto agli eventi reali, "~importo" ambrato, stima dagli abbonamenti.

## ONDATA 2 — stato (2026-07-06, sera; 196/196 test verdi)
- ✅ **Mesh Update Ledger** (`src/mesh/update-ledger.js`, 6 test): catena hash a prova di manomissione sugli aggiornamenti federati + reputazione per peer (un avvelenatore perde peso da solo = Byzantine tolerance emergente). Versione ONESTA del "blockchain audit trail" del blueprint V7.5, cablata in onGradientReceived. Vedi V6_ASSESSMENT.md per il verdetto completo su V7.5.
- ✅ **W6** Voce "aggiungi il solito X" (`matchSolito` in amount-memory.js, 4 test): match fuzzy sull'abituale, registrazione vocale in 2s, guardia anti-falsi-positivi ("ho preso il solito treno" resta spesa normale).

## ONDATA 2 — stato (2026-07-06, sera; 186/186 test verdi)
- ✅ **W4** Ghost Radar v2 (`findUnknownMerchants` in anomaly.js, 3 test): anomalie con esercente mai visto → bottoni "È mia" (addestra modelStats) / "Non la riconosco" (tag `suspect` additivo, hash chain intatta). Cablato in renderRadarAlerts + handler window.
- ✅ **Compute Planner adattivo** (`src/device/compute-planner.js`, 8 test): risposta REALE alla richiesta "adattivo per tipo di risorsa". Sopra il profiler: sceglie backend WebGPU→WebNN→SIMD→JS, precisione fp16/fp32, profondità Monte Carlo, worker, tier modello dalle capacità MISURATE. Onesto sui limiti (Metal/Vulkan li gestisce il browser; niente "25x"; nessun rilevamento di chip che il web non espone).
- ✅ **V6_ASSESSMENT.md**: valutazione onesta del blueprint V6 incollato dall'utente — buildable/oversold/rifiutato. RIFIUTATO esplicitamente il "mesh come virus che entra nei dispositivi" (malware/reato, distruggerebbe la fiducia-privacy che è l'unico asset). La mesh potente e legale = consenso esplicito, già costruita.

## ONDATA 2 — stato (2026-07-06, sera; 175/175 test verdi)
- ✅ **W1** Predittore contestuale (`src/predict/context-predictor.js`, 6 test): quick-add ordinati per probabilità ADESSO (lift orario+settimanale misurato, neutro senza pattern), motivo spiegato sul primo chip. Cablato nel form.
- ✅ **W2** Sweep one-tap (`getSweepSuggestion` in advisor.js, 4 test): avanzo settimana scorsa ≥10€ → card "li metto da parte?" → `window.applySweep` registra invest + `lastSweepWeek` additivo. Renderer azioni generalizzato (handler+payload JSON).
- ✅ **W3** What-If v2 (`src/predict/what-if.js`, 4 test): select categoria + slider ±50% → risparmio diretto dalla media reale 3 mesi + effetti a catena dal grafo causale in €, linguaggio semplice. UI nella card what-if esistente.
- ✅ **W9** Repo GitHub PRIVATO: https://github.com/GPire/momentum (account GPire) — README completo, VERSIONI.md (manifesto versioni + benchmark-target v5), primo benchmark riproducibile `npm run bench` (seed 20260706): Nano 47.5% / Meso 50.0% / **Ensemble 51.5%** su 480 esercenti MAI visti col rumore pesante — scoperta: l'89.7% storico vale in-distribution, il vero nemico è la copertura vocabolario. Target v2 riaddestrato: ensemble ≥75% su questo bench (held-out, mai barare).
- ⬜ **W4/W6/W5/W7/W8**: passi esatti nella Guida Operativa qui sotto (sezioni C, D, E, F).

## Lavori pronti da eseguire, in ordine

### A. W2 — Sweep settimanale one-tap (≈1h)
1. In `src/predict/advisor.js` aggiungi `getSweepSuggestion({ allTx, monthlyBudget, savingsGoals, lastSweepWeek, referenceDate })`:
   - usa `getWeeklyStatus` sulla settimana SCORSA (referenceDate - 7gg): se `remaining ≥ 10` e la settimana corrente ≠ `lastSweepWeek` → ritorna `{ amount: remaining, goalId: savingsGoals[0]?.id ?? null, weekKey }`; altrimenti null.
2. Includi l'insight `kind:'sweep'` in `getAdvisorInsights` (severity info, action con payload).
3. In `main.js`: handler `window.applySweep(payload)` → registra tx `type:'invest'`, `description:'Messo da parte (avanzo settimana)'` via `VaultDAO.addTransaction` + salva `VaultDAO.state.lastSweepWeek = weekKey` (campo additivo) + `renderAnalysis({skipHeavyForecast:true})`.
4. Test in `advisor.test.js`: avanzo→proposta; sforamento→null; stessa settimana già fatta→null.

### B. W3 — What-If v2 per categoria (≈1.5h)
1. Nuovo `src/predict/what-if.js`: `simulateCategoryChange({ allTx, catId, deltaPct, monthlyBudget, referenceDate })` →
   - spesa media mensile della categoria (ultimi 3 mesi) × deltaPct = risparmio/aggravio diretto;
   - `propagateImpact(buildCausalGraph(allTx, referenceDate), catId, deltaPct)` = effetti a catena (in € usando la media mensile di ogni categoria toccata);
   - nuovo `projectedDelta` fine mese = quello di `getMonthEndProjection` + effetto diretto pro-rata sui giorni rimasti.
   - Ritorna `{ directMonthly, chainEffects:[{category, pct, monthlyEur}], newMonthEndDelta }`.
2. UI: nella card "Simulatore What-If" (index.html ~riga 519) aggiungi `<select id="whatif-cat">` (popolato da main.js con le categorie usate) + slider ±50% + area risultato. Testo semplice: "Se tagli X del 20%: +Y€ al mese, e di solito scende anche Z".
3. Test con la storia sintetica di `causal-graph.test.js` (riusa il generatore).

### C. W4 — Ghost Radar v2 (≈1h)
1. Nuovo modulo o estensione `src/predict/anomaly.js`: `findUnknownMerchants(anomalies, allTx)` → anomalie la cui `description` non somiglia (descriptionSimilarity < 0.72) a NESSUNA tx precedente alla loro data.
2. In `renderRadarAlerts` (main.js): per queste, due bottoni — `window.confirmAnomalyMine(txId)` (chiama `momentumOrchestrator.learn(desc, cat, ...)` → aggiorna modelStats) e `window.flagAnomalySuspect(txId)` (trova la tx, `tx.suspect = true` — campo additivo OK, MAI toccare amount/hash — + save + evidenza rossa nel ledger render).
3. Test per findUnknownMerchants (esercente nuovo sì, esercente noto no).

### D. W6 — Voce "il solito" (≈45min)
1. In `voice.js`, PRIMA del parser transazioni (dopo il blocco Q&A): regex `/(aggiungi|metti|segna)\s+il solito\s*(.*)/i` → match fuzzy del gruppo 2 contro `getQuickAddSuggestions(VaultDAO.state.transactions)` (descriptionSimilarity ≥ 0.6); se trovato → registra la tx col suo importo/categoria + toast + return. Se gruppo 2 vuoto → usa il primo suggerimento contestuale (`rankSuggestionsByContext`).
2. Guardia: la frase deve INIZIARE con il verbo — "ho preso il solito treno" NON deve matchare (test).
3. Test in voice.test.js con lo shim già presente lì.

### E. W5 — Addebiti attesi sul calendario (≈30min)
In main.js, dove si renderizza il calendario eventi (`renderCalendarEvents`): aggiungi gli item da `getUpcomingCharges(VaultDAO.state.transactions, new Date(), 30)` come voci "💳 {desc} ~{amount}€ atteso {data}" non cliccabili (o con export .ics via `exportSingleEventToICS`). Nessuna logica nuova: solo UI su dato già testato.

### F. W7 — Export dataset correzioni (≈30min)
`window.exportTrainingData()` in main.js + bottone nel pannello Momentum Vault: scarica JSON `{ examples: [{text: description, label: category}...] da tutte le tx con description non vuota, modelStats: VaultDAO.state.mlData.modelStats }` (Blob + a.download, stesso pattern .ics). Servirà a `~/Downloads/momentum_real_ai/train_meso.py` per il riaddestramento v2.

### G. Riaddestramento Nano/Meso v2 (sessione dedicata, richiede questo Mac)
1. `cd ~/Downloads/momentum_real_ai && source .venv/bin/activate` (venv già pronto, scikit-learn installato, CPU-only: questo Mac non ha MPS).
2. In `train_meso.py`: ampliare il vocabolario esercenti 10-20× (nuovi nomi plausibili per le 8 categorie; NON usare gli esercenti di `momentum_app/bench/categorizer-bench.mjs` — quel bench è held-out, usarli = barare) + includere l'export delle correzioni reali (punto F).
3. Rigenerare `momentum_meso_model.json` → copiarlo in `momentum_app/public/` → rifare il cross-check numerico Python↔JS (pattern di `verify_meso_inference.py`, diff ≤ 1e-9).
4. Verifica: `npm run bench` → target ensemble ≥ 75% (oggi 51.5%). Aggiornare VERSIONI.md coi numeri VERI stampati.

### H. F7b — App nativa Android (sessione dedicata, PREREQUISITO: installare Android Studio + device fisico)
Scaffold: `npm i -D @capacitor/cli @capacitor/core @capacitor/android && npx cap init Momentum com.momentum.vault --web-dir dist && npx cap add android`. Plugin Kotlin `NotificationListenerService` che filtra `KNOWN_WALLET_PACKAGES` (già in `src/import/notification-parser.js`) e consegna `{title,text,package,ts}` al WebView → `parseNativeNotification` → `VaultDAO.addTransaction`. Senza device reale: scrivere e marcare NON VERIFICATO.

## Trappole note (successe davvero in questo progetto)
- Commenti contenenti tag script letterali dentro i sorgenti rompono il parsing HTML se il codice finisce inline (bug storico MomentumOrchestrator undefined).
- In un modulo ES, chiamare `renderDashboard()` nudo = ReferenceError silenzioso dentro i catch: usare `window.renderDashboard?.()`.
- Il service worker può servire moduli stantii: dopo modifiche a sw.js, bump di `APP_CACHE` e hard-reload; controllare la console.
- `max-h-[92vh]` è inaffidabile su iOS: usare `dvh`. Il modal deve avere `padding-bottom: var(--safe-bottom)`.
- Date a 1 cifra in stringhe ISO fatte a mano nei test ("T8:00") = Invalid Date silenzioso: sempre padStart.
- I test con date: MAI `new Date()` senza argomenti dentro le aspettative.
- L'ambiente browser di test resta bloccato a ~586px di larghezza: il responsive sotto quella soglia non è verificabile da qui.
