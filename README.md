# Momentum — l'AI finanziaria che vive nel tuo dispositivo

**Personal finance intelligence, 100% on-device.** Nessun server, nessun abbonamento, nessun dato che lascia il telefono — e un'intelligenza che migliora con l'uso reale e attraverso i tuoi dispositivi collegati.

> Il vantaggio non è "più grande dei competitor": è **strutturalmente diverso**. Chi monetizza i dati o il cloud non può copiare un'architettura il cui valore è non ricevere mai i dati.

---

## Perché esiste

La maggior parte delle app di finanza personale viene abbandonata per due motivi: **frizione** (inserire ogni spesa a mano) e **assenza di motivazione** (numeri senza significato). Momentum attacca entrambi con AI reale on-device, e risponde alla domanda che l'utente si fa davvero ogni giorno: **"quanto posso spendere oggi?"**

## Cosa fa (tutto verificato da 167 test automatici)

### 🎯 Il numero del giorno
- **Safe-to-spend**: "Oggi puoi spendere X€" — budget settimanale (derivato dal mensile, proporzionale ai giorni reali, con riporto envelope) meno gli abbonamenti in arrivo, diviso per i giorni rimasti.
- **Proiezione fine mese**: Holt-Winters sul tuo andamento reale (fallback run-rate, metodo sempre dichiarato).

### 🧠 AI di categorizzazione: ensemble a 3 modelli + arbitro che impara
- **NeuralNexus**: Naive Bayes + rete neurale (backprop reale, L2, gradient clipping) che apprende dall'uso.
- **Nano** (sempre attivo): MLP addestrato in Python/scikit-learn, 99% train / 94.7% CV, portato in JS con parità numerica verificata (diff max 2.2e-16 su cross-check Python↔JS).
- **Meso** (tier medio/alto): TF-IDF ibrido parole+n-grammi di caratteri, 2 strati nascosti — **89.7% su testo bancario sporco** (vs 80.0% del Nano, stesso test set, misurato non dichiarato).
- **Orchestrator v3**: voto pesato a N vie; i pesi sono modulati dalla **precisione per-categoria misurata sulle correzioni reali dell'utente** (matrice incrementale, lisciatura di Laplace, neutro senza dati). Il sistema impara *quale dei suoi modelli ascoltare*, categoria per categoria.

### 🕸️ Ragionamento a catena (grafo causale personale)
Co-variazione misurata tra categorie sulle **differenze** settimanali (il trend comune non crea legami finti), lag 0 e lag 1: "quando sale Ristorante, di solito sale anche Trasporti — e Farmacia la settimana dopo". Propagazione con smorzamento e percorso esplicativo. Onestà nel testo: *"non è una legge, è quello che è successo nei tuoi dati"*.

### 💬 Q&A on-device (testo e voce, anche offline)
12 intent deterministici calcolati sui dati veri: "quanto ho speso a giugno?", "posso permettermi 50€?", "come chiudo il mese?", "quando pago Netflix?", "cosa succede se spendo di più in ristorante?". Risposta vocale via speechSynthesis. Quando non sa, lo dice.

### ⚡ Frizione zero
- **Tasti rapidi contestuali**: gli acquisti abituali con cifra stabile diventano bottoni one-tap, **ordinati per probabilità adesso** (istogrammi ora-del-giorno e giorno-settimana misurati: il caffè in cima alle 8, la spesa il sabato) con il perché spiegato.
- **Memoria importi**: selezioni la categoria → se la cifra è sempre la stessa (es. sigarette 5,40€) si precompila da sola.
- **Import**: PDF bancari multi-formato (Intesa, UniCredit, N26, Revolut — colonna Saldo ignorata, righe multi-linea, date ISO/testuali), CSV, screenshot/scontrini via OCR (esercente estratto filtrando P.IVA/indirizzi), Web Share Target Android, parser notifiche wallet (Google Wallet, Satispay, SMS bancari, Revolut, PayPal) pronto per il guscio nativo.
- **Voce**: transazioni, appuntamenti (.ics) e domande in linguaggio naturale, frasi composte multi-azione.

### 🔥 Retention layer
Streak, recap settimanale misurato, obiettivi di risparmio con progresso reale e ritmo vs deadline, rilevamento abbonamenti + aumenti di prezzo silenziosi (>10%) + registrazione one-tap.

### 🌐 Mente condivisa (federated learning P2P, zero server)
Pairing esplicito tra dispositivi fidati via codici WebRTC (nessun server di segnalazione); FedAvg pesato sul conteggio esempi; **anti-poisoning** su validation set locale; un dispositivo nuovo **eredita** la rete addestrata al primo collegamento. Verificato live su 2 nodi: fusione 9+9=18 esempi esatta, pesi malformati rifiutati.

### 📴 Offline totale
Service worker a doppia cache: app network-first, librerie CDN cache-first (inclusi wasm e traineddata OCR). Warm-up OCR in idle. Dati in IndexedDB + localStorage con migrazioni di schema e hash chain sulle transazioni (mai riscritte).

### 🖥️ Architettura a tier hardware
Micro-benchmark reale al boot (κ) + rilevamento WebGPU/WebNN/WASM-SIMD → profondità Monte Carlo 500-10.000, 3D on/off, Meso on/off. Dispatcher a novelty: le transazioni di routine non svegliano i motori pesanti.

### 📈 Motore predittivo
Holt-Winters, GARCH(1,1) con forecast multi-step corretto, AR(2) via Yule-Walker, ensemble pesato per backtest walk-forward, Monte Carlo Cornish-Fisher — in Web Worker, con aggiornamento progressivo della UI.

---

## Avvio rapido

```bash
npm install
npm run dev          # localhost:5173
npm test             # 167 test (node --test src/)
npm run build        # PWA multi-file in dist/
npm run build:singlefile  # single-file ~220KB
```

## Struttura

```
src/
  ai/        NeuralNexus, Nano, Meso, Orchestrator v3, Q&A engine
  predict/   advisor, engines (HW/GARCH/AR2/MC), causal-graph, engagement,
             amount-memory, context-predictor, subscriptions, weekly-budget,
             dispatcher, anomaly, oracle + forecast worker
  import/    pdf-parser (Column Resonance), csv, screenshot OCR,
             notification-parser (+ fixtures multi-banca)
  mesh/      mesh-signaling (WebRTC zero-server), nexus-adapter,
             federated peer, peer-registry (PeerJS trusted reconnect)
  core/      vault (IndexedDB + hash chain + migrazioni), deduplicator fuzzy
  device/    profiler hardware (κ, tier)
  voice/     parser vocale IT/EN multi-azione
```

## Limiti dichiarati (onestà tecnica)

- Una PWA **non può** leggere le notifiche di altre app (iOS e Android): la lettura diretta richiede l'app nativa Android (`NotificationListenerService`, roadmap Capacitor). Su iOS non è possibile per nessuno; lì la via è l'Open Banking.
- iOS non supporta Web Share Target per PWA.
- Le transazioni Apple Pay arrivano solo via conto bancario (Open Banking/PSD2, roadmap).
- Il grafo causale misura co-variazione, non causalità in senso stretto — ed è scritto anche nella UI.

## Documentazione

- **[VERSIONI.md](VERSIONI.md)** — manifesto versioni per componente e benchmark-target verso la v5 (le versioni si guadagnano con salti reali misurati, mai con le etichette).
- **[PIANO_MOMENTUM.md](PIANO_MOMENTUM.md)** — piano di sviluppo completo, stato fasi, dossier valore/investitori e gap list.

## Principi non negoziabili

1. I dati dell'utente non lasciano mai il dispositivo.
2. Mai moduli decorativi: ogni claim è misurato e testato (`node --test src/`).
3. Funzioni pure separate dal DOM; ogni modulo nuovo nasce coi suoi test.
4. La hash chain delle transazioni non si riscrive.
5. Ogni testo UI deve essere comprensibile a un bambino di 8 anni.
