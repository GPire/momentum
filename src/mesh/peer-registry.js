import { PairingSignaling, MeshNode } from './mesh-signaling.js';

// ============================================================
// MOMENTUM PEER REGISTRY & AUTO-RECONNECT — v2.0 — Zero Config
// ============================================================
// Onestà tecnica: questo modulo NON scopre dispositivi sconosciuti
// (impossibile in un browser, vedi momentum_mesh_signaling.js).
// Automatizza invece le RICONNESSIONI tra dispositivi che si sono
// già agganciati almeno una volta con PairingSignaling.
//
// CAMBIO v2.0: rimossa la dipendenza da un progetto Firebase da
// configurare. Il rendezvous automatico usa ora il broker pubblico
// gratuito di PeerJS (0.peerjs.com) — libreria open source, zero
// account da creare, zero chiavi API, tutto vive nella webapp dal
// punto di vista dell'utente. Non è possibile eliminare del tutto
// un punto di rendezvous condiviso (due dispositivi dietro NAT non
// possono trovarsi da soli su internet — è una legge della rete,
// non un limite di questo codice), ma questo è il modo più vicino
// possibile a "zero configurazione" con tecnologie reali esistenti.
// Nota onesta: PeerJS dichiara il proprio broker pubblico non
// garantito per uso enterprise (nessuna SLA) — adeguato per uso
// personale/familiare come questo caso d'uso.
//
// Meccanismo (funziona su Safari/iPhone: solo fetch/WebSocket verso
// il broker PeerJS, nessun permesso hardware speciale — a differenza
// di Bluetooth/NFC bloccati su tutto l'ecosistema Apple, vedi nota
// in fondo al file):
//   1. Ogni dispositivo si registra sul broker PeerJS con un ID
//      stabile persistito localmente.
//   2. Il broker stesso sa quali ID sono online in questo momento
//      (è la sua funzione), quindi non serve un sistema di presenza
//      separato da costruire a mano.
//   3. Quando un peer già fidato risulta raggiungibile, si avvia la
//      connessione WebRTC in automatico, senza QR da rifare.
//   4. Nessun dato finanziario o peso del modello passa mai dal
//      broker — solo l'ID del peer, gestito dal protocollo PeerJS.
// ============================================================
'use strict';

const TRUST_STORE_KEY = 'momentum_trusted_peers';
const RECONNECT_RETRY_MS = 15_000;

// ─────────────────────────────────────────────────────────────
// § 1. TRUST STORE — elenco locale dei peer con cui ci si fida
// (persistito, sopravvive a riavvii, mai condiviso con nessuno)
// ─────────────────────────────────────────────────────────────
class TrustStore {
  constructor(store) {
    this.store = store; // riusa ModelStore da momentum_real_ai_engine.js
  }

  async list() {
    return (await this.store.load(TRUST_STORE_KEY)) || [];
  }

  async add(peerId, label = '') {
    const peers = await this.list();
    if (!peers.find(p => p.peerId === peerId)) {
      peers.push({ peerId, label, pairedAt: Date.now() });
      await this.store.save(TRUST_STORE_KEY, peers);
    }
    return peers;
  }

  async remove(peerId) {
    const peers = (await this.list()).filter(p => p.peerId !== peerId);
    await this.store.save(TRUST_STORE_KEY, peers);
    return peers;
  }

  async isTrusted(peerId) {
    return (await this.list()).some(p => p.peerId === peerId);
  }
}

// ─────────────────────────────────────────────────────────────
// § 2. PRESENCE AUTO-CONNECT — riconnessione automatica, zero config
// Richiede la libreria PeerJS caricata in pagina:
//   script tag src: unpkg.com/peerjs@1.5.4/dist/peerjs.min.js (senza tag HTML letterale nel commento: rompe il parsing se incollato in una pagina HTML)
// (host statico pubblico, nessuna chiave, nessun account)
// ─────────────────────────────────────────────────────────────
class PresenceAutoConnect {
  /**
   * @param {string} myPeerId - id stabile di questo dispositivo (persistito)
   * @param {TrustStore} trustStore
   * @param {MeshNode} meshNode - nodo mesh locale a cui agganciare i peer trovati online
   */
  constructor(myPeerId, trustStore, meshNode) {
    this.myPeerId = myPeerId;
    this.trustStore = trustStore;
    this.meshNode = meshNode;
    this._peer = null;         // istanza PeerJS (Peer)
    this._retryTimer = null;
    this.onPeerFound = null;   // callback opzionale (peerId) => {}
    this.onStatusChange = null; // callback opzionale (status) => {}
  }

  start() {
    // Peer.js: la libreria gestisce da sola signaling + presenza sul
    // broker pubblico 0.peerjs.com — nessun codice di presenza a mano.
    this._peer = new Peer(this.myPeerId);

    this._peer.on('open', () => {
      this.onStatusChange?.('online');
      this._tryConnectTrustedPeers();
      // Riprova periodicamente per i peer di fiducia non ancora online
      this._retryTimer = setInterval(() => this._tryConnectTrustedPeers(), RECONNECT_RETRY_MS);
    });

    // Un peer fidato ci contatta lui per primo: accettiamo solo se fidato
    this._peer.on('connection', async (conn) => {
      const isTrusted = await this.trustStore.isTrusted(conn.peer);
      if (!isTrusted) { conn.close(); return; } // scarta connessioni da sconosciuti
      this._bindConnection(conn);
    });

    this._peer.on('error', (err) => {
      // 'peer-unavailable' = il peer cercato non è online ora, normale, si riprova dopo
      if (err.type !== 'peer-unavailable') this.onStatusChange?.(`error:${err.type}`);
    });
  }

  stop() {
    clearInterval(this._retryTimer);
    this._peer?.destroy();
  }

  async _tryConnectTrustedPeers() {
    const trusted = await this.trustStore.list();
    for (const { peerId } of trusted) {
      if (this.meshNode.peers.has(peerId)) continue; // già connesso in questa sessione
      const conn = this._peer.connect(peerId, { reliable: true });
      this._bindConnection(conn);
    }
  }

  _bindConnection(conn) {
    conn.on('open', () => {
      this.onPeerFound?.(conn.peer);
      // PeerJS espone un DataChannel-compatibile via conn.dataChannel,
      // oppure adattiamo l'interfaccia minima richiesta da MeshNode.
      const channelAdapter = {
        readyState: 'open',
        send: (data) => conn.send(data),
        set onmessage(fn) { conn.on('data', (data) => fn({ data: typeof data === 'string' ? data : JSON.stringify(data) })); },
        set onclose(fn) { conn.on('close', fn); },
      };
      this.meshNode.addDirectPeer(conn.peer, conn.peerConnection, channelAdapter);
    });
  }
}

// ─────────────────────────────────────────────────────────────
// NOTA SU BLUETOOTH/NFC (verificata con fonti, non a memoria):
// Web Bluetooth e Web NFC sono bloccati su TUTTO l'ecosistema Apple
// (Safari macOS/iOS/iPadOS, e anche Chrome/Edge su iPhone perché
// Apple obbliga ogni browser iOS a usare il motore WebKit). È una
// scelta esplicita di Apple dal 2020 per motivi di privacy, invariata
// nel 2026. Per avere davvero scoperta locale via Bluetooth/NFC su
// iPhone serve un'app nativa (Swift + Core Bluetooth / Core NFC, o
// Multipeer Connectivity di Apple — pensato esattamente per mesh
// locali peer-to-peer) invece di una webapp/PWA. È un progetto
// diverso, non un'estensione di questo codice.
// ─────────────────────────────────────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TrustStore, PresenceAutoConnect };
}



export { TrustStore, PresenceAutoConnect };
