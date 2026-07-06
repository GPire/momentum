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
