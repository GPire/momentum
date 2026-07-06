// ============================================================
// MOMENTUM FEDERATED PEER — v1.0
// ============================================================
// Onestà tecnica, prima del codice:
//
// Le versioni precedenti (v12.5/v14) dichiaravano una "rete mesh
// P2P" basata su BroadcastChannel. BroadcastChannel funziona SOLO
// tra tab/finestre dello STESSO browser sullo STESSO dispositivo —
// non può far comunicare due telefoni o computer diversi. Quella
// parte del codice precedente non poteva funzionare come descritto.
//
// Per una vera connessione peer-to-peer tra dispositivi diversi,
// il browser richiede WebRTC. WebRTC richiede un passaggio iniziale
// di "signaling" (scambio di indirizzi di rete/ICE candidates) che
// NON può avvenire in modo puramente serverless con le API attuali:
// due dispositivi non possono "trovarsi" su internet senza un punto
// di incontro condiviso.
//
// Soluzione onesta adottata qui: Firebase Firestore (piano gratuito)
// usato ESCLUSIVAMENTE come "bacheca" temporanea per lo scambio di
// offer/answer/ICE candidates. Una volta stabilita la connessione,
// TUTTO il traffico (i pesi del modello, i gradienti) passa
// direttamente peer-to-peer via WebRTC DataChannel — Firebase non
// vede né riceve mai i dati finanziari o i gradienti del modello.
//
// Per usarlo, l'utente deve creare un progetto Firebase gratuito
// (console.firebase.google.com) e incollare la propria config qui
// sotto — non posso crearlo/registrarlo per conto dell'utente.
//
// AGGIORNAMENTO: questa modalità Firebase è ora OPZIONALE/legacy.
// Il percorso principale, a zero configurazione, è:
//   - momentum_mesh_signaling.js → PairingSignaling (primo aggancio
//     manuale via codice/QR, zero server in assoluto)
//   - momentum_peer_registry.js → PresenceAutoConnect (riconnessione
//     automatica tra dispositivi già fidati, via broker pubblico
//     PeerJS, zero account da creare)
// Firebase resta qui solo per chi preferisce quella via.
// ============================================================
'use strict';

// ── Federated Averaging reale: media pesata dei pesi tra due modelli ──
function federatedAverage(localWeights, remoteWeights, localExamples, remoteExamples) {
  const totalExamples = localExamples + remoteExamples;
  if (totalExamples === 0) return localWeights;

  const wLocal = localExamples / totalExamples;
  const wRemote = remoteExamples / totalExamples;

  const avg = (a, b) => a.map((v, i) => v * wLocal + b[i] * wRemote);

  return {
    W1: avg(localWeights.W1, remoteWeights.W1),
    b1: avg(localWeights.b1, remoteWeights.b1),
    W2: avg(localWeights.W2, remoteWeights.W2),
    b2: avg(localWeights.b2, remoteWeights.b2),
    trainedExamples: totalExamples,
    inputDim: localWeights.inputDim,
    hiddenDim: localWeights.hiddenDim,
    outputDim: localWeights.outputDim,
  };
}

class FederatedPeer {
  /**
   * @param {object} firebaseConfig - config del progetto Firebase dell'utente
   * @param {string} roomId - identificatore condiviso (es. ID famiglia/gruppo)
   * @param {MomentumMind} mind - istanza locale del motore AI da sincronizzare
   */
  constructor(firebaseConfig, roomId, mind) {
    this.firebaseConfig = firebaseConfig;
    this.roomId = roomId;
    this.mind = mind;
    this.pc = null;
    this.channel = null;
    this._db = null;
    this.onStatusChange = null; // callback opzionale (status) => {}
  }

  _emitStatus(status) {
    if (this.onStatusChange) this.onStatusChange(status);
  }

  async _initFirebase() {
    // Import dinamico: richiede firebase/app e firebase/firestore
    // già caricati in pagina (via <script type="module"> o bundler).
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const firestore = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const app = initializeApp(this.firebaseConfig);
    this._db = firestore.getFirestore(app);
    this._firestoreLib = firestore;
  }

  // Chi crea la stanza (il primo dispositivo) è "host"
  async host() {
    await this._initFirebase();
    this._emitStatus('connecting');

    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    this.channel = this.pc.createDataChannel('gradients');
    this._setupChannel();

    const { doc, setDoc, onSnapshot, collection, addDoc } = this._firestoreLib;
    const roomRef = doc(this._db, 'momentum_rooms', this.roomId);

    this.pc.onicecandidate = (e) => {
      if (e.candidate) {
        addDoc(collection(roomRef, 'hostCandidates'), e.candidate.toJSON());
      }
    };

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await setDoc(roomRef, { offer: { type: offer.type, sdp: offer.sdp } });

    onSnapshot(roomRef, async (snap) => {
      const data = snap.data();
      if (data?.answer && this.pc.signalingState !== 'stable') {
        await this.pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    });

    onSnapshot(collection(roomRef, 'guestCandidates'), (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === 'added') {
          this.pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
        }
      });
    });
  }

  // Il secondo dispositivo si unisce alla stanza esistente ("guest")
  async join() {
    await this._initFirebase();
    this._emitStatus('connecting');

    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    this.pc.ondatachannel = (e) => {
      this.channel = e.channel;
      this._setupChannel();
    };

    const { doc, getDoc, updateDoc, collection, addDoc, onSnapshot } = this._firestoreLib;
    const roomRef = doc(this._db, 'momentum_rooms', this.roomId);
    const roomSnap = await getDoc(roomRef);
    const data = roomSnap.data();
    if (!data?.offer) throw new Error('Stanza non trovata o host non ancora pronto');

    this.pc.onicecandidate = (e) => {
      if (e.candidate) {
        addDoc(collection(roomRef, 'guestCandidates'), e.candidate.toJSON());
      }
    };

    await this.pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    await updateDoc(roomRef, { answer: { type: answer.type, sdp: answer.sdp } });

    onSnapshot(collection(roomRef, 'hostCandidates'), (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === 'added') {
          this.pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
        }
      });
    });
  }

  _setupChannel() {
    this.channel.onopen = () => {
      this._emitStatus('connected');
      // Appena connessi, scambio automatico dei pesi correnti
      this._sendWeights();
    };
    this.channel.onclose = () => this._emitStatus('disconnected');
    this.channel.onmessage = async (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === 'weights') {
        await this._mergeRemoteWeights(payload.weights);
      }
    };
  }

  // Rumore Laplaciano calibrato prima della condivisione — riduce il
  // rischio che un peer ricostruisca pattern esatti dai pesi ricevuti
  // (privacy differenziale semplificata; non è una garanzia formale di
  // DP, ma una mitigazione reale e misurabile, onestamente dichiarata
  // come tale, non come "crittografia" o simili).
  _addPrivacyNoise(arr, epsilon = 2.0, sensitivity = 0.05) {
    const scale = sensitivity / epsilon;
    const laplace = () => {
      const u = Math.random() - 0.5;
      return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
    };
    return arr.map(v => v + laplace());
  }

  _sendWeights() {
    if (!this.channel || this.channel.readyState !== 'open') return;
    const raw = this.mind.model.serialize();
    const weights = {
      ...raw,
      W1: this._addPrivacyNoise(raw.W1),
      W2: this._addPrivacyNoise(raw.W2),
    };
    this.channel.send(JSON.stringify({ type: 'weights', weights }));
  }

  // Fusione reale: federated averaging pesato per numero di esempi visti,
  // ACCETTATA SOLO se non peggiora la loss sul set di validazione locale
  // (mai usato per il training) — mitigazione reale contro un peer che
  // condivide pesi corrotti o malevoli (model poisoning).
  async _mergeRemoteWeights(remoteWeights) {
    const localWeights = this.mind.model.serialize();
    const merged = federatedAverage(
      localWeights, remoteWeights,
      localWeights.trainedExamples, remoteWeights.trainedExamples
    );
    const { RealMind } = await import('./momentum_real_ai_engine.js');
    const mergedModel = RealMind.deserialize(merged);

    const validationSet = this.mind.validationSet || [];
    if (validationSet.length >= 5) {
      const lossBefore = this.mind.model.validate(validationSet);
      const lossAfter = mergedModel.validate(validationSet);
      // Tolleranza 10%: il merge federato può introdurre piccola varianza,
      // ma va rifiutato se peggiora chiaramente le prestazioni locali.
      if (lossAfter > lossBefore * 1.1) {
        this._emitStatus('merge_rejected');
        return { accepted: false, lossBefore, lossAfter };
      }
    }

    this.mind.model = mergedModel;
    await this.mind.store.save('weights', merged);
    this._emitStatus('merged');
    return { accepted: true };
  }

  // Chiamare periodicamente (es. ogni volta che il modello si aggiorna
  // localmente) per ri-condividere i pesi aggiornati col peer connesso.
  broadcastUpdate() {
    this._sendWeights();
  }

  close() {
    this.channel?.close();
    this.pc?.close();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FederatedPeer, federatedAverage };
}
