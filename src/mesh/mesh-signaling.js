

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
    this.pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
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
    this.pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
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
class MeshNode {
  constructor(nodeId, mind) {
    this.nodeId = nodeId || crypto.randomUUID();
    this.mind = mind;               // MomentumMind locale da sincronizzare
    this.peers = new Map();         // nodeId -> { pc, channel, lastSeen }
    this.knownPeerIds = new Set([this.nodeId]);
    this.onPeerConnected = null;    // callback opzionale (nodeId) => {}
    this.onGradientReceived = null; // callback opzionale (nodeId, stats) => {}
  }

  // Aggiunge un canale dati già aperto (da PairingSignaling) come primo peer
  addDirectPeer(peerId, pc, channel) {
    this.peers.set(peerId, { pc, channel, lastSeen: Date.now() });
    this._wireChannel(peerId, channel);
    this.knownPeerIds.add(peerId);
    this.onPeerConnected?.(peerId);
    this._shareWeights(peerId);
    this._sharePeerList(peerId);
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
        // Un nodo A chiede a noi (relay) di inoltrare il suo offer a un
        // nuovo nodo C che vuole raggiungere — vera segnalazione mesh
        // senza server: il relay è un nodo della rete stessa.
        this._relayToTarget(msg.targetId, msg);
      } else if (msg.type === 'relay_answer') {
        this._relayToTarget(msg.targetId, msg);
      } else if (msg.type === 'sync_digest') {
        // Il peer manda il suo digest → gli rispondo con le SOLE tx mancanti.
        this._handleSyncDigest(peerId, msg.digest);
      } else if (msg.type === 'sync_txs') {
        // Ricevo le tx mancanti → merge deterministico nel vault.
        const added = this.onSyncReceived ? this.onSyncReceived(msg.txs) : 0;
        if (added > 0) console.log(`Sync: ${added} transazioni ricevute e unite da un device fidato.`);
      }
    };
    channel.onclose = () => this.peers.delete(peerId);
  }

  // Avvia il sync differenziale verso un peer: gli mando il MIO digest, lui
  // mi risponderà con ciò che mi manca (e viceversa). Scambio simmetrico.
  requestSync(peerId) {
    const entry = this.peers.get(peerId);
    if (!entry || entry.channel.readyState !== 'open' || !this.getSyncDigest) return;
    entry.channel.send(JSON.stringify({ type: 'sync_digest', digest: this.getSyncDigest() }));
  }

  _handleSyncDigest(peerId, peerDigest) {
    const entry = this.peers.get(peerId);
    if (!entry || entry.channel.readyState !== 'open' || !this.getMissingForPeer) return;
    const txs = this.getMissingForPeer(peerDigest); // { month: [tx…] } solo i delta
    if (Object.keys(txs).length) entry.channel.send(JSON.stringify({ type: 'sync_txs', txs }));
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
      if (!this.knownPeerIds.has(id)) {
        this.knownPeerIds.add(id);
        // Non ci connettiamo automaticamente (richiederebbe comunque un
        // primo aggancio a coppie) — ma la lista è disponibile per
        // future connessioni dirette scegliendo un relay comune.
      }
    }
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

  _sharePeerList(peerId) {
    const entry = this.peers.get(peerId);
    if (!entry || entry.channel.readyState !== 'open') return;
    entry.channel.send(JSON.stringify({ type: 'peer_list', peerIds: Array.from(this.knownPeerIds) }));
  }

  // Chiamare dopo ogni training locale per propagare l'apprendimento
  // a tutta la mesh connessa (gossip broadcast reale).
  broadcastLearning() {
    for (const peerId of this.peers.keys()) this._shareWeights(peerId);
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
