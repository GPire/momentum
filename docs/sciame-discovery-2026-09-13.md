# Sciame — scoperta e primo aggancio senza server (2026-09-13)

Stato: **progettazione verificata, implementazione iniziata** (solo il livello di
impegno crittografico, `src/mesh/pairing-commitment.js`). Nessun plugin nativo
ancora installato. Questo documento è la fonte di verità per questo cantiere;
ogni numero qui sotto ha una fonte o è marcato come stima.

## Perché

La mesh WebRTC (`src/mesh/mesh-signaling.js`) cresce già da sola via gossip
multi-hop dopo il primo aggancio (`MeshNode.autoDiscovery`, `relay_offer`/
`relay_answer`, `relay-election.js`). Il solo attrito rimasto è **il primo
aggancio con un membro qualsiasi**: oggi richiede un codice/QR scambiato a mano.
Sciame è il livello che rende quel primo aggancio automatico su più canali, con
l'app che verrà pubblicata anche come nativa (Capacitor 8.5, `android/` e
`ios/` già presenti).

Il limite reale di piattaforma non è "serve un server": è che un browser (e in
parte anche un'app) **non può ricevere una connessione in entrata da uno
sconosciuto**. Serve un canale laterale per il primo scambio. Momentum dipende
già da infrastruttura pubblica di terzi che non vede dati (STUN Google in
`nat-probe.js`) e ha già un'eccezione dichiarata e opt-in (Firebase in
`momentum_federated_peer.js`). Il principio in vigore è quindi: **nessun server
che veda, conservi o controlli dati dell'utente** — non "zero pacchetti verso
terzi".

## I canali, dal più puro al meno

| Canale | Dove | Server? | Stato verificato | Limite dichiarato |
|---|---|---|---|---|
| Presentazione dallo sciame (gossip) | PWA + nativo | No | Già nel codice | Serve almeno un membro già connesso |
| Suono ultrasonico (ggwave) | PWA (Safari iOS incluso) + nativo | No | Fattibile, condizionato | Canale NON segreto; serve microfono; 15–19,5 kHz udibile da alcuni; npm fermo al 2022 (WASM da vendorizzare); AudioWorklet da riscrivere |
| DNS-SD sullo stesso Wi-Fi | Nativo | No | Standard su Android/iOS; plugin gratuito fermo a Cap 7 → **plugin nostro** | Wi-Fi con client isolation (bar/hotel) lo blocca |
| BLE beacon (periferico+centrale) | Nativo, app aperta | No | `@capgo/capacitor-bluetooth-low-energy` 8.2.0 (2026-06), MPL-2.0, ruolo periferico su entrambi | Solo in primo piano su iOS; cross-OS **non ancora provato su telefoni fisici** |
| Nearby (Android↔Android) / Multipeer (iOS↔iOS) | Nativo, stesso OS | No | Acceleratore opzionale, fase 2 | Google conferma: iOS↔Android offline **non funziona**; Nearby richiede Play Services |
| Rendezvous pubblico (relay Nostr effimeri, più relay) | PWA + nativo | Terzi, non nostri | Da provare; NIP-01 kind 20000–29999 non conservati | Il relay vede che due chiavi si sono cercate; contenuto cifrato |
| DHT Mainline | Nativo | No | UDP via plugin non ufficiali; nessuna libreria JS pronta per WebView | Batteria; solo come esperimento misurato |
| Relay fra pari (al posto di TURN) | Desktop/PWA installata/telefono in carica, opt-in | No | `relay-election.js` esiste | iPhone in background: ~30 s poi sospeso → mai relay; Android FGS `dataSync` max 6 h/24 h |

Fonti: report di ricerca del 2026-09-13 (quattro fork, URL nei commenti dei
moduli e in fondo a questo file).

## Numeri che decidono le promesse

- **Hole punching senza TURN**: ~70% di successo (libp2p/probe-lab, 6,25M
  tentativi, 2022-23; ACM IMC 2026, 4,4M tentativi in 167 Paesi: 70% ± 7,1%;
  nel ~29% dei casi fallisce già la scoperta dell'indirizzo). Il 97,6% dei
  successi arriva al primo tentativo: ritentare non aiuta, serve un ponte.
- **Suono**: ggwave dichiara 8–16 byte/s; uno studio accademico (arXiv
  2602.02249, 5 smartphone) misura la variante inaudibile efficace fino a 20 m
  con musica/voci di sottofondo e la variante udibile inutilizzabile oltre 1 m
  nel rumore. Con l'SDP compatto già esistente (95 caratteri, `sdp-codec.js`)
  un'offerta via suono costa ~6–12 s per direzione ai numeri di ggwave.
  Trasmettere invece solo l'impegno (28 byte) costa ~2–4 s.
- **Da misurare prima di promettere** (con `nat-probe.js`/`nat-matrix.js`):
  classe NAT per rete reale degli utenti (CGNAT mobile incluso), tasso di
  connessione diretta per coppia, tempo di setup, quanti utenti hanno un
  nodo ponte raggiungibile.

Nel Centro Fiducia va scritto: "connessione diretta attesa in circa 7 casi su
10; negli altri serve un dispositivo ponte disponibile; nessuna promessa di
'sempre connesso'".

## Sicurezza del primo aggancio (vale per tutti i canali)

Il canale laterale (suono, BLE, QR, relay) è considerato **autenticato ma non
segreto**: chiunque nella stanza o sul relay può leggerlo. Quindi via canale
laterale viaggia solo un **impegno pubblico**:

1. A prepara l'offerta WebRTC; calcola `C = H(fingerprintDTLS_A ‖ nonce)`;
   trasmette `nonce ‖ C ‖ id_breve` (28 byte, TTL 60 s).
2. B ottiene l'offerta di A (via relay/gossip/rendezvous o via suono intera) e
   verifica che il fingerprint DTLS dell'offerta produca `C`. Se no: scarta —
   qualcuno in mezzo ha sostituito l'offerta.
3. B risponde via WebRTC. Entrambi mostrano le **tre parole di verifica** già
   esistenti in `device-trust.js` (`verificationWords`, derivate da entrambe le
   identità, indipendenti dall'ordine): un tocco di conferma chiude il pairing.
   Da lì la riservatezza è di DTLS-SRTP, end-to-end anche attraverso un ponte.

Replay: inutile dopo il TTL. Intercettazione: rivela solo un hash pubblico.
Implementato in `src/mesh/pairing-commitment.js` (puro, 8 test, indipendente
dal canale). Nessun secondo meccanismo di verifica umana: le tre parole sono
già quelle che l'utente conosce.

## Risorse e potenza di calcolo condivise

Sciame non serve solo a sincronizzare: ogni peer trovato è anche capacità di
calcolo. Il mercato esiste già (`compute-market.js`, `compute-protocol.js`,
`compute-reliability.js`, `mesh-economics.js`, `MeshNode.runComputeUnits`) con
tre vincoli imposti dal codice: si distribuiscono **solo carichi con input
pubblico o già condiviso** (`assertShareable`: Monte Carlo su rendimenti di
mercato, backtest, saldi di un gruppo che tutti i membri hanno già), ogni unità
è **deterministica e verificata in doppio** su due dispositivi indipendenti (chi
non coincide perde la stessa reputazione dell'apprendimento federato), e
nessun dispositivo lavora sotto soglia di batteria. `mesh-economics.js` calcola
PRIMA se distribuire conviene (tetto di Amdahl: con il 5% non divisibile il
guadagno massimo è 20x anche con mille telefoni; costo di trasmissione vs
calcolo) — "potenza illimitata" non si dice, si misura.

Conseguenze per Sciame:

- Il ruolo **"nodo aiutante"** è uno solo, opt-in, e copre tre cose insieme:
  ponte per chi non buca il NAT, unità di calcolo per il mercato, staffetta
  di dati pubblici. Stesso interruttore, stessa reputazione, stessi limiti di
  piattaforma: su iOS solo con app in primo piano (in background ~30 s), su
  Android con foreground service e notifica persistente (max 6 h/24 h con
  `dataSync`). I candidati naturali sono desktop, PWA installate e telefoni in
  carica — esattamente il caso descritto nel commento di `compute-market.js`.
- Più canali di scoperta = più peer raggiungibili = più unità verificabili in
  doppio: la verifica ridondante ha bisogno di ALMENO due dispositivi
  indipendenti, quindi la scoperta locale (DNS-SD/BLE in casa o in ufficio) è
  ciò che rende il mercato utilizzabile davvero, non solo possibile.
- La classe NAT dei peer (`nat-matrix.js`, già propagata via `peer_list`)
  entra nella scelta di chi riceve unità di calcolo: un peer "bloccato" va
  raggiunto tramite ponte e costa di più in trasmissione — `mesh-economics.js`
  deve leggerla, oggi non lo fa (gap dichiarato, da chiudere nel livello
  `discovery/`).

## Ordine di costruzione

1. `pairing-commitment.js` — fatto in questa data.
2. Livello `src/mesh/discovery/` con adattatori (`gossip`, `acoustic`, `qr`,
   `dnssd`, `ble`, `rendezvous`) e la stessa interfaccia: `annuncia(impegno)`,
   `ascolta(cb)`, `ferma()`. Prima gli adattatori PWA (gossip, QR, acoustic).
3. Acoustic: vendorizzare il WASM ggwave compilato dal sorgente (npm fermo a
   0.4.0/2022), AudioWorklet al posto di `createScriptProcessor`, solo
   protocollo ultrasuono, fallback automatico a QR dopo due tentativi.
4. Nativo: plugin DNS-SD nostro (NsdManager + `NWBrowser`/`NWListener`,
   `NSBonjourServices` con `_momentum._tcp`), BLE via Capgo. Stringhe di
   scopo specifiche per App Review ("trovare l'altro tuo dispositivo nella
   stanza per condividere il gruppo spese"). Validazione **solo su telefoni
   fisici**: CI compila, non prova la radio.
5. Rendezvous pubblico multiplo (Nostr, più relay), eccezione dichiarata nel
   Centro Fiducia come lo STUN. Poi relay fra pari opt-in.
6. Misure con `nat-probe.js` prima di ogni claim in UI.

## Bozza di invention disclosure (input per un consulente IP, non consulenza)

Scansione prior art del 2026-09-13 (WebSearch, non per classi CPC — una ricerca
professionale troverà di più). Rischio "già noto" per idea:

| Idea | Prior art più vicina | Elemento combinatorio possibile | Rischio |
|---|---|---|---|
| FL browser-to-browser via WebRTC con CUSUM anti-avvelenamento | WebFLex (CMC 2024), BrainTorrent (2019), FedDec | Fusione per NOME categoria con conteggi reali + doppio cancello + CUSUM sul drift lento (nessun risultato che li combini) | Alto sul FL P2P, medio sulla combinazione |
| Staffetta di inferenze a chi non ha il modello, corroborazione per etichetta ≥2 peer, reputazione | Caching cooperativo edge (2024), US10516752, US11412060 | Corroborazione per etichetta + reputazione + destinatari senza modello | Medio-basso |
| Presentazione amico-di-amico firmata | F2F (non transitivo), US9137027 bootstrap NAT, Browser-to-Browser Trust for WebRTC | Introduzione **transitiva ma firmata** (device-signing-identity) con reputazione del presentatore | Alto sul bootstrap, medio sull'introduzione firmata |
| Pairing acustico | wave-share (2020), US9024998B2 (Polycom, 2015), LISNR | Nessuno: componente, non invenzione. ggwave MIT = libertà d'uso | Molto alto |
| Settlement esatto + CRDT offline | Greedy/max-flow noti; **PayPal US10956894B2** "Offline bill splitting" (2021) | Solver DP a blocchi a somma zero + CRDT; Momentum non muove fondi (fuori dalla claim 1 letta) — da far leggere al consulente | Medio |
| Certificato finanziario verificabile on-device | W3C VC, BBS+, ZK-SD-VC | Emittente = il dispositivo che ha calcolato il dato, con prova che il calcolo segue una regola fiscale dichiarata. Limite: prova integrità del calcolo, non veridicità degli input | Alto sulla crittografia, medio sull'applicazione |

Fatti di contesto (citati, non consulenza): EPO G-II 3.6 richiede un "further
technical effect" (es. cifratura di comunicazioni, funzionamento interno di
interfacce) — metodi di business e matematici in sé esclusi; approccio COMVIK:
le caratteristiche non tecniche non contano per l'attività inventiva. USA:
provisional application = 12 mesi di "patent pending", senza esame, tassa
USPTO $65–325 secondo entità, $2.000–5.000 con redazione professionale.

L'impegno crittografico legato al canale laterale (sezione Sicurezza) è, fra le
parti nuove, quella con l'effetto tecnico più chiaro secondo G-II 3.6: è
cifratura/autenticazione di comunicazioni, non un metodo di business.

## Fonti principali

- probe-lab rfm15-nat-hole-punching; arXiv 2604.12484; arXiv 2510.27500
- NIP-01; libp2p browser connectivity; EFF su Tor Snowflake
- Apple: background execution, CoreBluetooth background, Local Network privacy
- Android: FGS timeout (Android 15), permessi Bluetooth 12+
- ggwave (GitHub/npm); arXiv 2602.02249; IEEE TIFS 2013 acoustic eavesdropping;
  WiSec 2020 Acoustic Integrity Codes
- google/nearby discussion #2447; capgo bluetooth-low-energy; capacitor-zeroconf
- WebFLex; BrainTorrent; US10516752; US11412060; US9137027; US9024998B2;
  US10956894B2; EPO Guidelines G-II 3.6; USPTO fee schedule
