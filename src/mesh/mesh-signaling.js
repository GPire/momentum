

// ============================================================
// MOMENTUM MESH SIGNALING — v1.0 — Zero-Server Architecture
// ============================================================
// Onestà tecnica, prima del codice:
//
// Nessun browser permette a una pagina web di scoprire altri
// dispositivi sulla rete senza un qualche scambio di informazioni
// di connessione (ICE/SDP). Questo è un limite di sicurezza di
// TUTTI i browser, non aggirabile — vale per ogni rete P2P vera
// (BitTorrent, Bitcoin, ecc. hanno tutte un "bootstrap" iniziale).
//
// La soluzione onesta e reale implementata qui usa DUE meccanismi:
//
//  1. PairingSignaling — il PRIMO aggancio tra due dispositivi
//     avviene tramite scambio manuale di un codice (o QR) generato
//     localmente. Zero server, zero terze parti, mai. L'utente
//     mostra un codice, l'altro dispositivo lo inserisce o lo
//     scannerizza. Da questo momento i due dispositivi hanno un
//     canale WebRTC diretto.
//
//  2. MeshNode — dopo il primo aggancio, la rete si espande DA
//     SOLA: ogni dispositivo già connesso relaya le informazioni
//     di connessione (offer/answer) tra un nuovo dispositivo e
//     qualunque altro nodo della mesh, usando i canali dati GIÀ
//     APERTI. Non serve più nessun server esterno: "il server è
//     il telefono stesso", esattamente come richiesto — ogni nodo
//     della mesh funge da relay di segnalazione per gli altri.
//     Questo è un vero gossip protocol P2P (stessa famiglia di
//     tecniche usate nelle DHT Kademlia di BitTorrent/Bitcoin).
//
// Questo sostituisce la dipendenza da Firebase per l'uso quotidiano:
// Firebase (in momentum_federated_peer.js) resta disponibile come
// modalità OPZIONALE di comodo per riconnettere da remoto due
// dispositivi che non sono mai stati vicini fisicamente — ma non è
// più necessario per il funzionamento normale della mesh.
// ============================================================
'use strict';

import { STUN_POOL } from './nat-probe.js';
import { scegliStrada } from './relay-election.js';

// ─────────────────────────────────────────────────────────────
// § 1. COMPACT CODEC — comprime l'SDP (verboso) in un codice corto
// condivisibile a voce, per QR, o via qualunque canale (AirDrop,
// messaggio, ecc.) — mai attraverso un server.
// ─────────────────────────────────────────────────────────────
// Prefisso del formato COMPATTO (sdp-codec.js): non si comprime l'SDP, si
// manda solo cio' che varia e si ricostruisce il resto da un modello.
// Misurato su un SDP vero di Chrome: 720 caratteri -> 95. La differenza tra
// un codice che si incolla in una chat e uno che fa esitare.
const COMPACT_PREFIX = 'S1.';
// Quanti dispositivi al massimo può attraversare un pacchetto prima di essere
// lasciato cadere. Senza questo limite un anello nella mesh lo farebbe
// rimbalzare per sempre. Tre bastano: oltre, conviene la consegna differita.
const BRIDGE_MAX_HOPS = 3;

const PairingCodec = {
  async encode(sdpObject) {
    // Prima si tenta il formato compatto. Se per qualche motivo l'SDP non e'
    // riducibile (campi mancanti, forma inattesa), si ripiega su quello
    // storico invece di fallire: un invito lungo funziona, un invito assente no.
    try {
      const { packSdp } = await import('./sdp-codec.js');
      return COMPACT_PREFIX + packSdp(sdpObject.sdp);
    } catch (_) { /* si continua col formato storico */ }

    const json = JSON.stringify(sdpObject);
    if (typeof CompressionStream !== 'undefined') {
      const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
      const buf = await new Response(stream).arrayBuffer();
      return this._toBase64Url(new Uint8Array(buf));
    }
    // Fallback (browser senza CompressionStream, es. Safari vecchie versioni)
    return this._toBase64Url(new TextEncoder().encode(json));
  },

  // `tipo` serve solo al formato compatto, che non porta con se' l'etichetta
  // offer/answer: la conosce gia' chi sta decodificando, dal punto del flusso
  // in cui si trova. Un byte risparmiato su un codice cosi' corto conta.
  async decode(code, tipo = 'offer') {
    const testo = String(code || '').trim();
    if (testo.startsWith(COMPACT_PREFIX)) {
      const { unpackSdp } = await import('./sdp-codec.js');
      return { type: tipo, sdp: unpackSdp(testo.slice(COMPACT_PREFIX.length), tipo) };
    }
    // RETROCOMPATIBILITA': i codici generati prima devono continuare a
    // funzionare. Un utente che ha salvato un invito in una chat non deve
    // scoprire che non vale piu' perche' abbiamo cambiato formato.
    const bytes = this._fromBase64Url(testo);
    if (typeof DecompressionStream !== 'undefined') {
      try {
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
        const buf = await new Response(stream).arrayBuffer();
        return JSON.parse(new TextDecoder().decode(buf));
      } catch (_) { /* non compresso, fallback sotto */ }
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  },

  _toBase64Url(bytes) {
    let bin = '';
    bytes.forEach(b => (bin += String.fromCharCode(b)));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },

  _fromBase64Url(str) {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(str.length + (4 - (str.length % 4)) % 4, '=');
    const bin = atob(b64);
    return Uint8Array.from(bin, c => c.charCodeAt(0));
  },
};

// ─────────────────────────────────────────────────────────────
// § 2. PAIRING SIGNALING — primo aggancio, ZERO server
// ─────────────────────────────────────────────────────────────
class PairingSignaling {
  constructor() {
    this.pc = null;
    this.channel = null;
  }

  // Dispositivo A: genera il codice di invito da mostrare/condividere
  async createInvite() {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.channel = this.pc.createDataChannel('mesh');

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    // Attende la raccolta di tutte le ICE candidate (necessario perché
    // non c'è un server a cui inviarle una per una — devono stare
    // tutte dentro il codice unico condiviso a mano).
    await this._waitIceGatheringComplete();

    return PairingCodec.encode({
      type: 'offer',
      sdp: this.pc.localDescription.sdp,
    });
  }

  // Dispositivo A: dopo che B ha condiviso la sua risposta, la applica
  async acceptAnswer(answerCode) {
    const data = await PairingCodec.decode(answerCode, 'answer');
    await this.pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.sdp }));
    return this._waitChannelOpen();
  }

  // Dispositivo B: riceve l'invito, genera la risposta da rimandare ad A
  async acceptInvite(inviteCode, onDataChannel) {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc.ondatachannel = (e) => {
      this.channel = e.channel;
      onDataChannel(e.channel);
    };

    const data = await PairingCodec.decode(inviteCode, 'offer');
    await this.pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: data.sdp }));

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    await this._waitIceGatheringComplete();

    return PairingCodec.encode({ type: 'answer', sdp: this.pc.localDescription.sdp });
  }

  _waitIceGatheringComplete() {
    if (this.pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise((resolve) => {
      const check = () => {
        if (this.pc.iceGatheringState === 'complete') {
          this.pc.removeEventListener('icegatheringstatechange', check);
          resolve();
        }
      };
      this.pc.addEventListener('icegatheringstatechange', check);
      // Timeout di sicurezza: procede comunque dopo 3s con le candidate raccolte finora
      setTimeout(resolve, 3000);
    });
  }

  _waitChannelOpen() {
    return new Promise((resolve) => {
      if (this.channel.readyState === 'open') return resolve(this.channel);
      this.channel.onopen = () => resolve(this.channel);
    });
  }
}

// ─────────────────────────────────────────────────────────────
// § 3. MESH NODE — il vero "server sei tu": ogni dispositivo relaya
// la segnalazione per gli altri, la mesh cresce senza infrastruttura
// esterna dopo il primo aggancio manuale.
// ─────────────────────────────────────────────────────────────
// Pool completo invece di un solo server: se quell'unico e' bloccato (rete
// aziendale, disservizio) il collegamento falliva senza che nessuno capisse
// perche'. I tre server sono verificati dal vivo — vedi nat-probe.js.
const ICE_SERVERS = STUN_POOL.map((urls) => ({ urls }));

class MeshNode {
  // autoDiscovery (default true): quando un peer ci segnala l'esistenza di
  // un nodo che non conoscevamo (gossip peer_list), proviamo a stabilire una
  // connessione DIRETTA con lui passando dal peer che ce l'ha segnalato come
  // relay — questo era il pezzo mancante: prima la mesh SCOPRIVA altri nodi
  // ma non si connetteva mai a loro (dichiarato nel commento originale di
  // _handlePeerList). maxAutoPeers cappa le connessioni dirette totali: in
  // una mesh con molti nodi, connettersi a TUTTI quelli scoperti crescerebbe
  // O(n²) — restare relay-collegati (i messaggi comunque arrivano via gossip
  // multi-hop) è più sostenibile di un mesh completamente magliato.
  // Riconnessione (nuovo): prima, se un canale cadeva (blip di rete, non una
  // disconnessione voluta), il peer veniva semplicemente dimenticato — solo
  // il gossip successivo poteva farlo ritrovare, senza fretta. Ora si riprova
  // da soli con backoff esponenziale (+ jitter, per non far ripartire tutti i
  // dispositivi nello stesso istante) passando da un QUALSIASI relay ancora
  // connesso — esattamente lo stesso meccanismo di `_initiateAutoConnect` già
  // usato per l'auto-discovery, qui solo richiamato in automatico. `scheduleFn`
  // e `randomFn` sono iniettabili: nei test si passano finti e deterministici,
  // così i tempi di attesa non dipendono da timer veri.
  constructor(nodeId, mind, {
    autoDiscovery = true, maxAutoPeers = 6,
    reconnect = true, reconnectBaseMs = 1000, reconnectMaxMs = 30000, maxReconnectAttempts = 6,
    sketchFallbackMs = 4000,
    scheduleFn = (fn, ms) => setTimeout(fn, ms), randomFn = Math.random,
  } = {}) {
    this.nodeId = nodeId || crypto.randomUUID();
    this.mind = mind;               // MomentumMind locale da sincronizzare
    this.peers = new Map();         // nodeId -> { pc, channel, lastSeen }
    this.knownPeerIds = new Set([this.nodeId]);
    this.autoDiscovery = autoDiscovery;
    this.maxAutoPeers = maxAutoPeers;
    this.reconnect = reconnect;
    this.reconnectBaseMs = reconnectBaseMs;
    this.reconnectMaxMs = reconnectMaxMs;
    this.maxReconnectAttempts = maxReconnectAttempts;
    this.sketchFallbackMs = sketchFallbackMs;
    this.getSyncSketch = null;     // () => { cells, m, k } | null
    this.reconcileSketch = null;   // (msg) => { success, txs } — riconciliazione IBLT
    this._scheduleFn = scheduleFn;
    this._randomFn = randomFn;
    this._reconnectAttempts = new Map(); // peerId -> tentativi finora
    this.pendingOutbound = new Map(); // targetId -> { pc } — offer inviato, in attesa di relay_answer
    this.onPeerConnected = null;    // callback opzionale (nodeId) => {}
    this.onPeerDiscovered = null;   // callback opzionale (peerId, viaPeerId) => {} — scoperto ma non ancora connesso
    this.onGradientReceived = null; // callback opzionale (nodeId, stats) => {}
    this.onPricesReceived = null;   // callback opzionale (nodeId, pricesBySymbol) => {}
    this.onReliabilityReceived = null; // callback opzionale (nodeId, digest) => {} (Wave 15 v10)
    this.onSplitGroupsReceived = null; // callback opzionale (nodeId, groups) => {} — sync LIVE gruppi divisione
    this.onMorphologyReceived = null;  // callback opzionale (nodeId, model) => {} — federazione tipi esercente
    this.onLexiconReceived = null;     // callback opzionale (nodeId, digest) => {} — lessico k-anonimo (opt-in)
    this.onDistillationReceived = null; // callback opzionale (nodeId, digest) => {} — distillazione su sonde pubbliche, LIVELLO A (opt-in)
    this.onKnowledgeReceived = null;   // callback opzionale (nodeId, payload) => {} — staffetta dati pubblici verificati
    this.onSentimentReceived = null;   // callback opzionale (nodeId, payload) => {} — staffetta sentiment on-device (src/mesh/sentiment-relay.js)
    this.onDeviceHello = null;         // callback opzionale (nodeId, publicKey) => {} — device-trust.js
    // CLASSE DI RETE dei peer (nat-matrix.js): 'aperto' | 'prevedibile' |
    // 'variabile' | 'bloccato' | 'incerto'. Senza questa informazione
    // l'elezione del ponte NON è calcolabile — `scegliStrada` ha bisogno di
    // sapere com'è la rete DELL'ALTRO, non solo la propria. Era il pezzo
    // davvero mancante: relay-election.js esisteva ed era orfano perché non
    // aveva su cosa decidere.
    // Viaggia solo la CLASSE, una parola: mai un indirizzo, mai una porta.
    // Sapere "questa rete cambia porta" non dice dove sia nessuno.
    this.peerNat = new Map();
    this.localNat = null;
    this.runComputeUnits = null;       // (workloadId, units) => results — esegue lavoro PER un peer
    this.onBundlesReceived = null;     // (peerId, bundles) => {} — pacchetti cifrati a staffetta
    this.onComputeResult = null;       // (peerId, workloadId, results) => {} — risultati di ritorno
  }

  // Aggiunge un canale dati già aperto (da PairingSignaling) come primo peer
  addDirectPeer(peerId, pc, channel) {
    this._reconnectAttempts.delete(peerId); // tornati connessi: il contatore di tentativi riparte da zero
    this.peers.set(peerId, { pc, channel, lastSeen: Date.now(), connessoDa: Date.now(), sessioniPonte: 0 });
    this._wireChannel(peerId, channel);
    this.knownPeerIds.add(peerId);
    this.onPeerConnected?.(peerId);
    this._shareWeights(peerId);
    // BUG REALE trovato e corretto: prima si mandava la lista peer SOLO al
    // nodo appena aggiunto — chi era già connesso non veniva MAI informato
    // di un nuovo arrivo, quindi l'auto-discovery non poteva mai scattare
    // (nessuno sapeva mai di un peer scoperto DOPO la propria connessione).
    // Il broadcast a TUTTI i peer, ad ogni nuova connessione, è quello che
    // fa crescere la mesh via gossip anche a scale grandi (centinaia di
    // nodi): l'informazione si propaga multi-hop senza che ogni coppia
    // debba connettersi direttamente.
    this._broadcastPeerList();
  }

  _broadcastPeerList() {
    // `peerNats` è ADDITIVO: i nodi con la versione precedente ignorano il
    // campo e continuano a funzionare esattamente come prima. Senza questo,
    // la classe di rete di un peer scoperto via gossip ma mai visto di
    // persona resterebbe ignota — e senza quella l'elezione del ponte non è
    // calcolabile proprio per i peer che ne hanno più bisogno.
    const nats = {};
    if (this.localNat) nats[this.nodeId] = this.localNat;
    for (const [id, k] of this.peerNat) if (k) nats[id] = k;
    const msg = JSON.stringify({ type: 'peer_list', peerIds: Array.from(this.knownPeerIds), peerNats: nats });
    for (const entry of this.peers.values()) {
      if (entry.channel?.readyState === 'open') entry.channel.send(msg);
    }
  }

  _wireChannel(peerId, channel) {
    channel.onmessage = async (event) => {
      const msg = JSON.parse(event.data);
      const entry = this.peers.get(peerId);
      if (entry) entry.lastSeen = Date.now();

      if (msg.type === 'weights') {
        await this._handleRemoteWeights(peerId, msg.weights);
      } else if (msg.type === 'peer_list') {
        // Le classi di rete si imparano SOLO se non le sappiamo già di prima
        // mano: quello che ci ha detto il diretto interessato (device_hello)
        // vale più di quello che ci racconta un terzo. Un peer malevolo non
        // deve poter sovrascrivere la classe di un altro per farsi eleggere
        // ponte al suo posto.
        for (const [id, k] of Object.entries(msg.peerNats || {})) {
          if (id !== this.nodeId && !this.peerNat.has(id)) this.peerNat.set(id, k);
        }
        this._handlePeerList(peerId, msg.peerIds);
      } else if (msg.type === 'relay_offer') {
        // Se il messaggio è per NOI, siamo la destinazione C: creiamo la
        // connessione e rispondiamo (BUG REALE trovato qui: prima anche a
        // destinazione si richiamava _relayToTarget, che non trovando un
        // peer con il PROPRIO id non faceva nulla — l'offer spariva in
        // silenzio, la mesh scopriva peer ma non si connetteva MAI). Se
        // invece è per un altro nodo, restiamo un semplice relay (multi-hop).
        if (msg.targetId === this.nodeId) await this._handleRelayOffer(peerId, msg);
        else this._relayToTarget(msg.targetId, msg);
      } else if (msg.type === 'relay_answer') {
        if (msg.targetId === this.nodeId) await this._handleRelayAnswer(peerId, msg);
        else this._relayToTarget(msg.targetId, msg);
      } else if (msg.type === 'bridge_data') {
        // PONTE FRA PARI. Quando due dispositivi non riescono a parlarsi in
        // diretta (entrambi dietro una rete che cambia porta — l'unico caso
        // senza uscita, vedi nat-matrix.js), un terzo che li vede entrambi
        // porta avanti il pacchetto. Il contenuto è già sigillato da un capo
        // all'altro: chi fa da ponte NON può leggerlo, esattamente come nel
        // trasporto a staffetta. È il posto del server TURN, occupato da un
        // dispositivo qualunque invece che da un'infrastruttura.
        if (msg.targetId === this.nodeId) {
          if (this.onBundlesReceived) await this.onBundlesReceived(msg.fromId, [msg.bundle]);
        } else if ((msg.hops || 0) < BRIDGE_MAX_HOPS) {
          // Il contatore di salti non è prudenza generica: senza, un ciclo
          // nella mesh farebbe rimbalzare lo stesso pacchetto all'infinito.
          this._relayToTarget(msg.targetId, { ...msg, hops: (msg.hops || 0) + 1 });
        }
      } else if (msg.type === 'sync_digest') {
        // Il peer manda il suo digest → gli rispondo con le SOLE tx mancanti.
        this._handleSyncDigest(peerId, msg.digest);
      } else if (msg.type === 'sync_sketch') {
        // RICONCILIAZIONE PROPORZIONALE ALLA DIFFERENZA (iblt.js): invece di
        // elencare TUTTI gli id posseduti (digest, che cresce con lo storico)
        // si scambia uno sketch di dimensione fissa, tarato sulle differenze
        // attese. Misurato: 10.000 transazioni con 3 differenze passano da
        // 169.299 a 477 byte (npm run bench:mesh).
        this._handleSyncSketch(peerId, msg);
      } else if (msg.type === 'sync_need_digest') {
        // L'altro non è riuscito a riconciliare (troppe differenze per lo
        // sketch): si torna al metodo classico, che funziona sempre. Nessun
        // fallimento silenzioso — degrada, non si rompe.
        this.requestSync(peerId, { forceDigest: true });
      } else if (msg.type === 'sync_txs') {
        // Ricevo le tx mancanti → merge deterministico nel vault.
        const added = this.onSyncReceived ? this.onSyncReceived(msg.txs) : 0;
        if (added > 0) console.log(`Sync: ${added} transazioni ricevute e unite da un device fidato.`);
      } else if (msg.type === 'price_share') {
        // Un peer condivide i suoi ultimi prezzi di mercato. La validazione
        // (newest-wins + anti-poison) è del ricevente: mergePeerPrices in
        // market-data.js decide, qui si consegna soltanto.
        this.onPricesReceived?.(peerId, msg.prices);
      } else if (msg.type === 'reliability_share') {
        // Wave 15 v10 (meta-federation.js): un peer condivide SOLO le medie a
        // posteriori "quale esperto è affidabile per quale contesto" — mai
        // dati grezzi. Il merge (pesato per reputazione, anti-poisoning) è
        // del ricevente: qui si consegna soltanto, come per price_share.
        this.onReliabilityReceived?.(peerId, msg.digest);
      } else if (msg.type === 'split_share') {
        // Sync LIVE dei gruppi di divisione spese (sopra il canale mesh già
        // aperto, nessun link da ri-condividere): il merge CRDT (last-writer-
        // wins per campo, unione per aggiunte) è del ricevente — qui si
        // consegna soltanto, stesso pattern di price_share/reliability_share.
        this.onSplitGroupsReceived?.(peerId, msg.groups);
      } else if (msg.type === 'trip_share') {
        // Sync LIVE delle trasferte di lavoro fra i PROPRI dispositivi. Le
        // spese viaggiano già da sole (sono transazioni vere, `sync_txs`); qui
        // viaggia il contenitore — nome, date, voci offerte, esito
        // dell'approvazione — che senza questo restava su un solo telefono e
        // lasciava le spese orfane sull'altro. Il merge CRDT è del ricevente
        // (mergeTripLists in trips/trip-engine.js), stesso pattern di
        // split_share: qui si consegna soltanto.
        this.onBusinessTripsReceived?.(peerId, msg.trips);
      } else if (msg.type === 'custom_categories_share') {
        // Le CATEGORIE personalizzate. Sembrano un dettaglio e invece sono la
        // differenza fra vedere la stessa spesa sotto "Palestra" o sotto un
        // "Altro" grigio: le transazioni si sincronizzavano già, le categorie
        // che usano no. Merge CRDT del ricevente (core/custom-categories-merge.js).
        this.onCustomCategoriesReceived?.(peerId, msg.categories);
      } else if (msg.type === 'morphology_share') {
        // Federazione dei "tipi di esercente" (merchant-morphology.js): il peer
        // condivide il suo modello morfologico (SOLO parole-tipo + categorie, mai
        // dati grezzi). Il merge anti-poisoning (mergeMorphology, cap per token)
        // è del ricevente: qui si consegna soltanto, come per reliability_share.
        this.onMorphologyReceived?.(peerId, msg.model);
      } else if (msg.type === 'bundle_carry') {
        // TRASPORTO A STAFFETTA (store-forward.js): il peer ci passa dei
        // pacchetti cifrati. Alcuni possono essere PER NOI (li apriremo),
        // altri no — e quelli li porteremo avanti senza poterli leggere.
        // La decisione su cosa accettare e quanto e' del ricevente: qui si
        // consegna soltanto, come per ogni altro messaggio di questa mesh.
        this.onBundlesReceived?.(peerId, msg.bundles || []);
      } else if (msg.type === 'compute_request') {
        // CALCOLO CONDIVISO (compute-market.js): un peer chiede di eseguire
        // alcune unità di lavoro. Il cancello su COSA è distribuibile sta dal
        // lato di chi chiede (assertShareable), ma chi esegue non si fida:
        // ricontrolla che il carico sia tra quelli ammessi prima di muovere
        // un dito. Un peer compromesso non deve poter far calcolare al mio
        // dispositivo qualcosa che tocchi dati altrui.
        this._handleComputeRequest(peerId, msg);
      } else if (msg.type === 'compute_result') {
        // Risultati di ritorno: la verifica (unità calcolate in doppio,
        // confronto per hash) è di chi ha chiesto — qui si consegna soltanto.
        this.onComputeResult?.(peerId, msg.workloadId, msg.results);
      } else if (msg.type === 'lexicon_share') {
        // APPRENDIMENTO CONDIVISO SENZA CONDIVIDERE DATI
        // (src/mesh/federated-distillation.js). Qui NON passano né pesi né
        // gradienti — da quelli si possono ricostruire gli esempi di
        // addestramento, ed è il punto in cui quasi tutto il settore bara.
        // Passa solo un lessico gia' filtrato dal mittente con soglia
        // k-anonima: un esercente visto da un solo dispositivo — che
        // identificherebbe una persona — non esce mai, per costruzione.
        // Il merge (voto di maggioranza tra peer indipendenti) e' del
        // ricevente: qui si consegna soltanto.
        this.onLexiconReceived?.(peerId, msg.digest);
      } else if (msg.type === 'distillation_share') {
        // DISTILLAZIONE FEDERATA LIVELLO A (src/mesh/federated-distillation.js):
        // il peer manda solo le previsioni del suo modello locale su sonde
        // PUBBLICHE e fisse — mai pesi, gradienti o dati suoi. Il merge robusto
        // per mediana e il rilevatore di deriva lenta (contribution-drift.js)
        // sono del ricevente: qui si consegna soltanto, come per il lessico.
        this.onDistillationReceived?.(peerId, msg.digest);
      } else if (msg.type === 'knowledge_share') {
        // STAFFETTA DELLA CONOSCENZA (src/mesh/knowledge-relay.js). Qui passano
        // SOLO dati pubblici già verificati da chi li manda (serie di mercato,
        // tassi macro) — mai un dato legato a una transazione o a una persona.
        // Il cancello anti-avvelenamento (plausibilità ricontrollata in locale,
        // mai fidarsi dell'etichetta del mittente) e' del ricevente: qui si
        // consegna soltanto, esattamente come per il lessico.
        this.onKnowledgeReceived?.(peerId, msg.payload);
      } else if (msg.type === 'sentiment_share') {
        // STAFFETTA DEL SENTIMENT (src/mesh/sentiment-relay.js). Un titolo di
        // notizia PUBBLICO (mai una transazione, mai un dato personale) e il
        // suo punteggio già calcolato on-device — chi non ha scaricato il
        // modello (o è su una rete dove il download resta bloccato, vedi
        // src/core/con-timeout.js) può comunque saperlo. Stesso principio di
        // knowledge_share sopra, cancello anti-avvelenamento del ricevente.
        this.onSentimentReceived?.(peerId, msg.payload);
      } else if (msg.type === 'device_hello') {
        // FIDUCIA (device-trust.js): la scoperta di rete non prova CHI SEI.
        // Qui arriva solo una chiave pubblica dichiarata — la prova vera (le
        // tre parole, calcolate in locale da entrambe le chiavi) è del
        // ricevente, non di questo trasporto. Un canale gia' aperto non è
        // di per sé una prova d'identità: chiunque condivida la stessa rete
        // avrebbe potuto arrivare fin qui.
        if (msg.nat) this.peerNat.set(peerId, msg.nat);
        this.onDeviceHello?.(peerId, msg.publicKey);
      }
    };
    channel.onclose = () => {
      this.peers.delete(peerId);
      this._scheduleReconnect(peerId);
    };
  }

  // Programma un tentativo di riconnessione con backoff esponenziale.
  // Il numero di tentativi è LIMITATO apposta: oltre `maxReconnectAttempts`
  // si smette di insistere e si lascia che sia il gossip (peer_list) a far
  // ritrovare il peer quando torna raggiungibile — insistere all'infinito
  // sprecherebbe batteria per un dispositivo magari spento per ore.
  _scheduleReconnect(peerId) {
    if (!this.reconnect) return;
    const tentativi = (this._reconnectAttempts.get(peerId) || 0) + 1;
    if (tentativi > this.maxReconnectAttempts) { this._reconnectAttempts.delete(peerId); return; }
    this._reconnectAttempts.set(peerId, tentativi);
    const attesaBase = Math.min(this.reconnectMaxMs, this.reconnectBaseMs * 2 ** (tentativi - 1));
    const jitter = 0.75 + this._randomFn() * 0.5; // ±25%: evita che dispositivi caduti insieme riprovino insieme
    this._scheduleFn(() => this._tryReconnect(peerId), Math.round(attesaBase * jitter));
  }

  _tryReconnect(peerId) {
    if (this.peers.has(peerId) || this.pendingOutbound.has(peerId)) {
      this._reconnectAttempts.delete(peerId); // già tornato connesso nel frattempo (es. via gossip)
      return;
    }
    // Un relay QUALSIASI tra quelli ancora connessi: la mesh non ha bisogno
    // che sia lo stesso di prima, basta un percorso verso il peer perduto.
    const via = [...this.peers.keys()][0];
    if (!via) { this._scheduleReconnect(peerId); return; } // nessun relay ora disponibile: si riprova più avanti
    this._initiateAutoConnect(peerId, via).catch(() => this._scheduleReconnect(peerId));
  }

  // Avvia il sync differenziale verso un peer: gli mando il MIO digest, lui
  // mi risponderà con ciò che mi manca (e viceversa). Scambio simmetrico.
  requestSync(peerId, { forceDigest = false } = {}) {
    const entry = this.peers.get(peerId);
    if (!entry || entry.channel.readyState !== 'open') return;
    // Si prova PRIMA lo sketch, che costa pochi byte anche con uno storico
    // enorme. Se il chiamante non lo fornisce (o siamo già in ripiego), si usa
    // il digest classico: la sincronizzazione non deve MAI dipendere dal
    // pezzo nuovo per funzionare.
    if (!forceDigest && this.getSyncSketch) {
      const sketch = this.getSyncSketch();
      if (sketch) {
        entry.channel.send(JSON.stringify({ type: 'sync_sketch', ...sketch, reply: false }));
        // Rete di sicurezza: se l'altro non parla lo sketch (versione
        // vecchia), non risponde e resteremmo fermi. Dopo l'attesa si torna
        // al digest, che ogni versione capisce.
        this._scheduleFn(() => {
          const e = this.peers.get(peerId);
          if (e?.channel?.readyState === 'open' && !e.sketchAnswered) {
            e.channel.send(JSON.stringify({ type: 'sync_digest', digest: this.getSyncDigest?.() }));
          }
        }, this.sketchFallbackMs);
        return;
      }
    }
    if (!this.getSyncDigest) return;
    entry.channel.send(JSON.stringify({ type: 'sync_digest', digest: this.getSyncDigest() }));
  }

  _handleSyncDigest(peerId, peerDigest) {
    const entry = this.peers.get(peerId);
    if (!entry || entry.channel.readyState !== 'open' || !this.getMissingForPeer) return;
    const txs = this.getMissingForPeer(peerDigest); // { month: [tx…] } solo i delta
    if (Object.keys(txs).length) entry.channel.send(JSON.stringify({ type: 'sync_txs', txs }));
  }

  // Riconcilia lo sketch ricevuto col proprio. Chi riconcilia può NOMINARE
  // ciò che manca all'altro (sono cose sue), ma del proprio mancante conosce
  // solo le impronte: per questo lo scambio è simmetrico, e chi riceve
  // rimanda a sua volta il proprio sketch — una sola volta (`reply`), mai un
  // ping-pong infinito.
  _handleSyncSketch(peerId, msg) {
    const entry = this.peers.get(peerId);
    if (!entry || entry.channel.readyState !== 'open') return;
    entry.sketchAnswered = true;
    if (!this.reconcileSketch) { // non so riconciliare: chiedo il metodo classico
      entry.channel.send(JSON.stringify({ type: 'sync_need_digest' }));
      return;
    }
    const esito = this.reconcileSketch(msg);
    if (!esito || !esito.success) {
      // Troppe differenze perché lo sketch le "sbucci": si degrada al digest.
      entry.channel.send(JSON.stringify({ type: 'sync_need_digest' }));
      return;
    }
    if (esito.txs && Object.keys(esito.txs).length) {
      entry.channel.send(JSON.stringify({ type: 'sync_txs', txs: esito.txs }));
    }
    // Ora tocca a me ricevere: mando il MIO sketch, ma solo se questo era il
    // primo giro (msg.reply === false), altrimenti si rimbalzerebbe all'infinito.
    if (!msg.reply && this.getSyncSketch) {
      const mio = this.getSyncSketch();
      if (mio) entry.channel.send(JSON.stringify({ type: 'sync_sketch', ...mio, reply: true }));
    }
  }

  async _handleRemoteWeights(peerId, weights) {
    // Percorso webapp (nexus-adapter.js): il merge avviene sul VERO stato
    // NeuralNexus tramite l'orchestratore (FedAvg + anti-poisoning inclusi
    // lì). Il percorso standalone qui sotto resta per il motore RealMind.
    if (typeof this.mind?.mergeRemote === 'function') {
      const res = this.mind.mergeRemote(weights) || { accepted: false };
      this.onGradientReceived?.(peerId, res);
      return;
    }
    const { federatedAverage } = await import('./momentum_federated_peer.js');
    const { RealMind } = await import('./momentum_real_ai_engine.js');
    const local = this.mind.model.serialize();
    const merged = federatedAverage(local, weights, local.trainedExamples, weights.trainedExamples);
    const mergedModel = RealMind.deserialize(merged);

    // Stesso controllo anti-avvelenamento del merge diretto
    const validationSet = this.mind.validationSet || [];
    if (validationSet.length >= 5) {
      const lossBefore = this.mind.model.validate(validationSet);
      const lossAfter = mergedModel.validate(validationSet);
      if (lossAfter > lossBefore * 1.1) {
        this.onGradientReceived?.(peerId, { accepted: false });
        return;
      }
    }
    this.mind.model = mergedModel;
    await this.mind.store.save('weights', merged);
    this.onGradientReceived?.(peerId, { accepted: true, trainedExamples: merged.trainedExamples });
  }

  // DIFFUSIONE EPIDEMICA: chi impara qualcosa di NUOVO lo ridice ai propri
  // vicini. Senza questo la conoscenza si fermava a un salto — in una catena
  // A—B—C—D il nodo A non veniva mai a sapere di D, e la mesh restava una
  // somma di isolotti invece di una rete. Termina da sola: un nodo ri-annuncia
  // solo quando il proprio insieme di conosciuti CRESCE, e quell'insieme è
  // monotono e limitato dal numero di dispositivi. Niente tempeste di
  // messaggi, nessun contatore da mantenere.
  _handlePeerList(fromPeerId, peerIds) {
    let imparatoQualcosa = false;
    for (const id of peerIds) {
      if (id === this.nodeId) continue;
      if (!this.knownPeerIds.has(id)) {
        this.knownPeerIds.add(id);
        imparatoQualcosa = true;
        this.onPeerDiscovered?.(id, fromPeerId);
        // AUTO-DISCOVERY (il pezzo prima mancante, dichiarato onestamente
        // nel commento originale): proviamo una connessione DIRETTA con
        // il nodo appena scoperto, passando dal peer che ce l'ha
        // segnalato come relay. Cappato a maxAutoPeers connessioni
        // dirette totali — oltre, restare raggiungibili via gossip
        // multi-hop (già funzionante) è più sostenibile che magliare
        // tutta la mesh punto-a-punto.
        if (this.autoDiscovery && this.peers.size < this.maxAutoPeers && !this.peers.has(id) && !this.pendingOutbound.has(id)) {
          this._initiateAutoConnect(id, fromPeerId).catch(() => { this.pendingOutbound.delete(id); });
        }
      }
    }
    // Ho imparato nomi nuovi: li passo ai miei vicini, cosi' la conoscenza
    // attraversa la catena invece di fermarsi qui.
    if (imparatoQualcosa) this._broadcastPeerList();
  }

  // Avvia una connessione RELAYED verso `targetId`, un nodo scoperto via
  // gossip ma mai visto direttamente — passa dal peer `viaPeerId` (già
  // connesso a entrambi) esattamente come un aggancio manuale, ma senza
  // scambio di QR: l'offer/answer viaggia sui canali dati già aperti della
  // mesh invece che a voce/QR tra due persone.
  async _initiateAutoConnect(targetId, viaPeerId) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const channel = pc.createDataChannel('mesh');
    this.pendingOutbound.set(targetId, { pc });
    channel.onopen = () => {
      this.pendingOutbound.delete(targetId);
      this.addDirectPeer(targetId, pc, channel);
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await this._waitIce(pc);
    this._relayToTarget(viaPeerId, { type: 'relay_offer', targetId, fromId: this.nodeId, sdp: pc.localDescription.sdp });
  }

  // Destinazione di un relay_offer: creiamo la nostra parte della
  // connessione e rispondiamo passando dallo STESSO relay che ci ha
  // consegnato l'offer (è per costruzione connesso anche al mittente).
  async _handleRelayOffer(viaPeerId, msg) {
    if (this.peers.has(msg.fromId) || this.pendingOutbound.has(msg.fromId)) return; // già connessi/in corso, non duplicare
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.ondatachannel = (e) => {
      const channel = e.channel;
      channel.onopen = () => this.addDirectPeer(msg.fromId, pc, channel);
    };
    await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: msg.sdp }));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await this._waitIce(pc);
    this._relayToTarget(viaPeerId, { type: 'relay_answer', targetId: msg.fromId, fromId: this.nodeId, sdp: pc.localDescription.sdp });
  }

  // Ricezione della risposta al NOSTRO offer uscente: completiamo la
  // connessione. `addDirectPeer` scatta da channel.onopen (sopra).
  async _handleRelayAnswer(viaPeerId, msg) {
    const pending = this.pendingOutbound.get(msg.fromId);
    if (!pending) return; // risposta a un tentativo che non esiste più (scaduto/duplicato)
    await pending.pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: msg.sdp }));
  }

  _waitIce(pc) {
    if (pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise((resolve) => {
      const check = () => {
        if (pc.iceGatheringState === 'complete') {
          pc.removeEventListener('icegatheringstatechange', check);
          resolve();
        }
      };
      pc.addEventListener('icegatheringstatechange', check);
      setTimeout(resolve, 3000); // stesso timeout di sicurezza di PairingSignaling
    });
  }

  _relayToTarget(targetId, msg) {
    const entry = this.peers.get(targetId);
    if (entry?.channel?.readyState === 'open') {
      entry.channel.send(JSON.stringify(msg));
    }
  }

  _shareWeights(peerId) {
    const entry = this.peers.get(peerId);
    if (!entry || entry.channel.readyState !== 'open') return;
    entry.channel.send(JSON.stringify({ type: 'weights', weights: this.mind.model.serialize() }));
  }

  // Chiamare dopo ogni training locale per propagare l'apprendimento
  // a tutta la mesh connessa (gossip broadcast reale).
  broadcastLearning() {
    for (const peerId of this.peers.keys()) this._shareWeights(peerId);
  }

  // Condivide con tutta la mesh gli ultimi prezzi di mercato noti (stesso
  // gossip dei pesi). Payload per simbolo:
  //   { SYM: { kind, asOf, source, series:[{date,close},…] } }
  // Ogni ricevente decide da sé se accettare (mergePeerPrices, newest-wins
  // + anti-poison) — qui si trasmette e basta, mai si impone.
  sharePrices(pricesBySymbol) {
    const msg = JSON.stringify({ type: 'price_share', prices: pricesBySymbol });
    for (const entry of this.peers.values()) {
      if (entry.channel?.readyState === 'open') entry.channel.send(msg);
    }
  }

  // Condivide con la mesh il digest di affidabilità (Wave 15 v10,
  // exportReliabilityDigest): SOLO medie a posteriori arrotondate, mai a/b
  // grezzi. Stesso pattern gossip di sharePrices/pesi.
  shareReliability(digest) {
    const msg = JSON.stringify({ type: 'reliability_share', digest });
    for (const entry of this.peers.values()) {
      if (entry.channel?.readyState === 'open') entry.channel.send(msg);
    }
  }

  // Condivide con tutta la mesh i gruppi di divisione spese (sync LIVE, task
  // "sync live post-condivisione"): quando entrambi i dispositivi sono online
  // sullo stesso canale mesh già aperto, un rename/nuova-spesa/nuova-persona
  // si propaga SUBITO, senza dover ri-condividere un link statico. Ogni
  // ricevente decide da sé il merge (mergeIntoGroups, CRDT last-writer-wins);
  // qui si trasmette e basta, stesso pattern di sharePrices/shareReliability.
  // BUCO DI PRIVACY REALE, trovato il 2026-08-08 perché l'utente ha contestato
  // (giustamente) una protezione che non proteggeva. Prima questa funzione
  // mandava OGNI gruppo a OGNI peer collegato, senza guardare chi ne fa parte.
  // Conseguenza concreta: colleghi il telefono a quello di un amico per
  // dividere una cena, e quel dispositivo riceve TUTTI i tuoi gruppi — nomi
  // delle persone, spese, importi — inclusi quelli con cui non c'entra nulla.
  // Non era un rischio teorico su un link intercettato: era un invio, a ogni
  // sincronizzazione, verso dispositivi che non avevano titolo per riceverlo.
  //
  // `appartiene(peerId, gruppo)` decide chi ha titolo. Se non viene passata,
  // il comportamento resta quello di prima — di proposito: cambiare in
  // silenzio la semantica di un metodo pubblico romperebbe i chiamanti che
  // non sanno di doverla passare. Il chiamante vero (main.js) la passa.
  shareSplitGroups(groups, appartiene = null) {
    let inviati = 0;
    for (const [peerId, entry] of this.peers.entries()) {
      if (entry.channel?.readyState !== 'open') continue;
      const suoi = appartiene ? (groups || []).filter((g) => appartiene(peerId, g)) : groups;
      if (!suoi || !suoi.length) continue;
      entry.channel.send(JSON.stringify({ type: 'split_share', groups: suoi }));
      inviati++;
    }
    return inviati;
  }

  // Manda le trasferte di lavoro ai propri dispositivi. `destinatario` decide
  // chi ha titolo a riceverle: una nota spese è personale, non è un gruppo
  // condiviso come lo split — non deve finire su un dispositivo qualunque
  // della mesh solo perché il canale è aperto. Se il chiamante non passa il
  // filtro non si manda NIENTE: su un dato personale il default sicuro è il
  // silenzio, non la diffusione (l'opposto della scelta fatta per lo split,
  // dove il gruppo è condiviso per definizione).
  shareBusinessTrips(trips, destinatario = null) {
    if (!trips || !trips.length || typeof destinatario !== 'function') return 0;
    let inviati = 0;
    for (const [peerId, entry] of this.peers.entries()) {
      if (entry.channel?.readyState !== 'open') continue;
      if (!destinatario(peerId, entry)) continue;
      entry.channel.send(JSON.stringify({ type: 'trip_share', trips }));
      inviati++;
    }
    return inviati;
  }

  // Le categorie personalizzate ai propri dispositivi. Stesso filtro delle
  // trasferte (`destinatario` obbligatorio): sono dati personali, non vanno a
  // un peer qualunque solo perché il canale è aperto.
  shareCustomCategories(categories, destinatario = null) {
    if (!categories || !categories.length || typeof destinatario !== 'function') return 0;
    let inviati = 0;
    for (const [peerId, entry] of this.peers.entries()) {
      if (entry.channel?.readyState !== 'open') continue;
      if (!destinatario(peerId, entry)) continue;
      entry.channel.send(JSON.stringify({ type: 'custom_categories_share', categories }));
      inviati++;
    }
    return inviati;
  }

  // Condivide con la mesh il modello morfologico (tipi di esercente appresi).
  // Zero dati grezzi: viaggiano solo le parole-tipo e le loro categorie. Ogni
  // ricevente fonde con anti-poisoning (mergeMorphology). Stesso gossip dei pesi.
  shareMorphology(model) {
    const msg = JSON.stringify({ type: 'morphology_share', model });
    for (const entry of this.peers.values()) {
      if (entry.channel?.readyState === 'open') entry.channel.send(msg);
    }
  }

  // Condivide il LESSICO gia' filtrato con soglia k-anonima
  // (federated-distillation.js: buildLexiconDigest). Il chiamante decide SE
  // chiamarla — e' opt-in esplicito, mai automatica: qui la mesh non ha
  // opinioni sul consenso, si limita a trasportare cio' che le viene dato.
  // SYNC LIVE: manda SUBITO a tutti i peer le transazioni appena create,
  // senza aspettare la prossima riconnessione. Riusa il messaggio `sync_txs`
  // che il ricevente sa già fondere (merge CRDT idempotente): una
  // transazione che arriva due volte non si duplica, quindi ritrasmettere è
  // sicuro e non serve un protocollo nuovo per una cosa che c'è già.
  broadcastTransactions(txsByMonth) {
    if (!txsByMonth || !Object.keys(txsByMonth).length) return 0;
    const msg = JSON.stringify({ type: 'sync_txs', txs: txsByMonth });
    let inviati = 0;
    for (const entry of this.peers.values()) {
      if (entry.channel?.readyState === 'open') { entry.channel.send(msg); inviati++; }
    }
    return inviati;
  }

  // Consegna a un peer i pacchetti cifrati che lo riguardano o che puo'
  // portare avanti. Chi manda non sa cosa contengono piu' di chi riceve: sono
  // cifrati per il loro destinatario finale, e basta.
  sendBundles(peerId, bundles) {
    const entry = this.peers.get(peerId);
    if (!entry || entry.channel?.readyState !== 'open') return 0;
    if (!Array.isArray(bundles) || !bundles.length) return 0;
    entry.channel.send(JSON.stringify({ type: 'bundle_carry', bundles }));
    return bundles.length;
  }

  // Manda un pacchetto sigillato a un dispositivo che NON riusciamo a
  // raggiungere in diretta, passando da uno che vede entrambi. Il ponte va
  // scelto con `eleggiPonte` (relay-election.js), che mette davanti a tutto il
  // costo per la privacy: un tuo secondo dispositivo prima di uno sconosciuto.
  // Ritorna true solo se il primo salto è partito davvero — mai un "inviato"
  // che non è successo.
  sendViaBridge(viaPeerId, targetId, bundle) {
    const entry = this.peers.get(viaPeerId);
    if (!entry || entry.channel?.readyState !== 'open') return false;
    if (!targetId || !bundle || targetId === this.nodeId) return false;
    entry.channel.send(JSON.stringify({ type: 'bridge_data', targetId, fromId: this.nodeId, bundle, hops: 0 }));
    return true;
  }

  // Manda a UN peer le unità che gli sono state assegnate. Non si trasmette
  // mai un "carico" generico: solo un id di workload noto e dei semi
  // numerici, da cui il ricevente ricostruisce il lavoro in modo
  // deterministico. Nessun dato dell'utente viaggia, per costruzione.
  sendComputeUnits(peerId, workloadId, units) {
    const entry = this.peers.get(peerId);
    if (!entry || entry.channel?.readyState !== 'open') return false;
    entry.channel.send(JSON.stringify({ type: 'compute_request', workloadId, units }));
    return true;
  }

  _handleComputeRequest(peerId, msg) {
    const entry = this.peers.get(peerId);
    if (!entry || entry.channel?.readyState !== 'open') return;
    if (!this.runComputeUnits) return; // questo dispositivo non offre calcolo
    Promise.resolve()
      .then(() => this.runComputeUnits(msg.workloadId, msg.units || []))
      .then((results) => {
        if (!results) return;
        entry.channel.send(JSON.stringify({ type: 'compute_result', workloadId: msg.workloadId, results }));
      })
      .catch((e) => console.warn('Calcolo per un peer non riuscito:', e));
  }

  shareLexicon(digest) {
    if (!digest || !Array.isArray(digest.entries) || !digest.entries.length) return 0;
    const msg = JSON.stringify({ type: 'lexicon_share', digest });
    let inviati = 0;
    for (const entry of this.peers.values()) {
      if (entry.channel?.readyState === 'open') { entry.channel.send(msg); inviati++; }
    }
    return inviati;
  }

  // Condivide il digest di distillazione LIVELLO A (federated-distillation.js:
  // buildDistillationDigest). Escono solo le previsioni del modello locale su
  // sonde PUBBLICHE e fisse (PROBE_SET): mai un dato dell'utente, per
  // costruzione — nessun gradiente, nessun peso, nessuna transazione.
  shareDistillation(digest) {
    if (!digest || !digest.answers || !Object.keys(digest.answers).length) return 0;
    const msg = JSON.stringify({ type: 'distillation_share', digest });
    let inviati = 0;
    for (const entry of this.peers.values()) {
      if (entry.channel?.readyState === 'open') { entry.channel.send(msg); inviati++; }
    }
    return inviati;
  }

  // Manda un pacchetto già impacchettato da `packForRelay` (knowledge-relay.js)
  // a tutti i peer diretti. Broadcast semplice, come shareLexicon: il costo
  // per la privacy è già stato deciso a monte (solo dati eleggibili
  // all'addestramento, mai dati personali) — qui non c'è altro da decidere.
  shareKnowledge(payload) {
    if (!payload || payload.v !== 1) return 0;
    const msg = JSON.stringify({ type: 'knowledge_share', payload });
    let inviati = 0;
    for (const entry of this.peers.values()) {
      if (entry.channel?.readyState === 'open') { entry.channel.send(msg); inviati++; }
    }
    return inviati;
  }

  // Manda un pacchetto già impacchettato da `packSentimentForRelay`
  // (sentiment-relay.js) a tutti i peer diretti. Stesso schema di
  // shareKnowledge sopra: broadcast semplice, il costo per la privacy è già
  // deciso a monte (solo titoli di notizia pubblici + un punteggio, mai
  // dati personali).
  shareSentiment(payload) {
    if (!payload || payload.v !== 1) return 0;
    const msg = JSON.stringify({ type: 'sentiment_share', payload });
    let inviati = 0;
    for (const entry of this.peers.values()) {
      if (entry.channel?.readyState === 'open') { entry.channel.send(msg); inviati++; }
    }
    return inviati;
  }

  // Manda la propria chiave pubblica di firma a UN peer specifico (mai in
  // broadcast: la fiducia è per coppia di dispositivi, non per la mesh
  // intera). Chi riceve NON deve fidarsene da sola — è solo il primo passo
  // di un aggancio che l'utente conferma guardando le tre parole.
  sendDeviceHello(peerId, publicKey) {
    const entry = this.peers.get(peerId);
    if (!entry || entry.channel?.readyState !== 'open' || !publicKey) return false;
    entry.channel.send(JSON.stringify({ type: 'device_hello', publicKey, nat: this.localNat }));
    return true;
  }

  // La propria classe di rete, misurata da nat-probe.js. Va impostata appena
  // la sonda ha risposto: da quel momento viaggia in ogni device_hello e nel
  // gossip, ed è quello che rende calcolabile l'elezione di un ponte.
  setLocalNat(kind) { this.localNat = kind || null; return this.localNat; }

  // ── IL ROUTING VERO (relay-election.js finalmente collegato) ──
  // Prima esisteva `sendViaBridge` ma nessuno eleggeva un ponte: il modulo
  // era citato solo nei commenti. Qui la decisione viene presa davvero.
  //  1. se siamo collegati direttamente, si manda e basta
  //  2. altrimenti si sceglie la strada (nat-matrix + relay-election): se
  //     esiste un ponte che vede entrambi, si passa da lì
  //  3. se nessuna strada è aperta ora, lo dice — il chiamante mette il
  //     pacchetto nella staffetta a consegna differita invece di perderlo
  // Ritorna sempre l'esito, mai un silenzio: un "inviato" che non è successo
  // è peggio di un errore.
  routeToPeer(targetId, bundle, opts = {}) {
    if (!targetId || targetId === this.nodeId) return { tipo: 'nessuno', motivo: 'destinatario non valido' };
    const diretto = this.peers.get(targetId);
    if (diretto?.channel?.readyState === 'open') {
      diretto.channel.send(JSON.stringify({ type: 'bundle_carry', bundles: [bundle] }));
      return { tipo: 'diretto' };
    }
    // I candidati ponte sono i peer con cui SIAMO già collegati: un ponte che
    // non possiamo raggiungere non è un ponte.
    const candidati = [...this.peers.entries()]
      .filter(([, e]) => e.channel?.readyState === 'open')
      .map(([id, e]) => ({
        id,
        nat: { kind: this.peerNat.get(id) || 'incerto' },
        sessioniAttive: e.sessioniPonte || 0,
        minutiOnline: Math.round((Date.now() - (e.connessoDa || Date.now())) / 60000),
        disponibile: true,
        mio: !!e.mio, stessoGruppo: !!e.stessoGruppo,
      }));
    const io = { id: this.nodeId, nat: { kind: this.localNat || 'incerto' } };
    const lui = { id: targetId, nat: { kind: this.peerNat.get(targetId) || 'incerto' } };
    const strada = scegliStrada(io, lui, candidati, opts);
    if (strada.tipo === 'ponte' && this.sendViaBridge(strada.via.id, targetId, bundle)) {
      const e = this.peers.get(strada.via.id);
      if (e) e.sessioniPonte = (e.sessioniPonte || 0) + 1; // la capienza si consuma davvero
      return { tipo: 'ponte', via: strada.via.id, costoPrivacy: strada.costoPrivacy, testo: strada.testo };
    }
    return { tipo: 'differito', motivo: strada.motivo, testo: strada.testo };
  }

  getMeshStats() {
    return {
      nodeId: this.nodeId,
      directPeers: this.peers.size,
      knownPeers: this.knownPeerIds.size,
      trainedExamples: this.mind.model.trainedExamples,
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PairingSignaling, PairingCodec, MeshNode };
}



export { PairingCodec, PairingSignaling, MeshNode };
