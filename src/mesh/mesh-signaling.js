

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

// ─────────────────────────────────────────────────────────────
// § 1. COMPACT CODEC — comprime l'SDP (verboso) in un codice corto
// condivisibile a voce, per QR, o via qualunque canale (AirDrop,
// messaggio, ecc.) — mai attraverso un server.
// ─────────────────────────────────────────────────────────────
const PairingCodec = {
  async encode(sdpObject) {
    const json = JSON.stringify(sdpObject);
    if (typeof CompressionStream !== 'undefined') {
      const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
      const buf = await new Response(stream).arrayBuffer();
      return this._toBase64Url(new Uint8Array(buf));
    }
    // Fallback (browser senza CompressionStream, es. Safari vecchie versioni)
    return this._toBase64Url(new TextEncoder().encode(json));
  },

  async decode(code) {
    const bytes = this._fromBase64Url(code);
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
    const data = await PairingCodec.decode(answerCode);
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

    const data = await PairingCodec.decode(inviteCode);
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
  }

  // Aggiunge un canale dati già aperto (da PairingSignaling) come primo peer
  addDirectPeer(peerId, pc, channel) {
    this._reconnectAttempts.delete(peerId); // tornati connessi: il contatore di tentativi riparte da zero
    this.peers.set(peerId, { pc, channel, lastSeen: Date.now() });
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
    const msg = JSON.stringify({ type: 'peer_list', peerIds: Array.from(this.knownPeerIds) });
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
      } else if (msg.type === 'morphology_share') {
        // Federazione dei "tipi di esercente" (merchant-morphology.js): il peer
        // condivide il suo modello morfologico (SOLO parole-tipo + categorie, mai
        // dati grezzi). Il merge anti-poisoning (mergeMorphology, cap per token)
        // è del ricevente: qui si consegna soltanto, come per reliability_share.
        this.onMorphologyReceived?.(peerId, msg.model);
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

  _handlePeerList(fromPeerId, peerIds) {
    for (const id of peerIds) {
      if (id === this.nodeId) continue;
      if (!this.knownPeerIds.has(id)) {
        this.knownPeerIds.add(id);
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
  shareSplitGroups(groups) {
    const msg = JSON.stringify({ type: 'split_share', groups });
    for (const entry of this.peers.values()) {
      if (entry.channel?.readyState === 'open') entry.channel.send(msg);
    }
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
  shareLexicon(digest) {
    if (!digest || !Array.isArray(digest.entries) || !digest.entries.length) return 0;
    const msg = JSON.stringify({ type: 'lexicon_share', digest });
    let inviati = 0;
    for (const entry of this.peers.values()) {
      if (entry.channel?.readyState === 'open') { entry.channel.send(msg); inviati++; }
    }
    return inviati;
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
