import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };

const { MeshNode } = await import('./mesh-signaling.js');
const { mergePeerPrices } = await import('../alpha/market-data.js');

// Due canali dati finti incrociati: send su A consegna a onmessage di B e
// viceversa — simula un DataChannel WebRTC aperto senza rete vera.
function linkedChannels() {
  const a = { readyState: 'open' };
  const b = { readyState: 'open' };
  a.send = (data) => b.onmessage?.({ data });
  b.send = (data) => a.onmessage?.({ data });
  return [a, b];
}

// Mind finto minimale: basta per addDirectPeer (che condivide subito i pesi)
// senza toccare il motore standalone né fare import dinamici.
const fakeMind = () => ({
  model: { serialize: () => ({ format: 'nexus-v1', net: {}, trainedExamples: 0 }) },
  mergeRemote: () => ({ accepted: false }),
});

function twoNodes() {
  const [chA, chB] = linkedChannels();
  const nodeA = new MeshNode('A', fakeMind());
  const nodeB = new MeshNode('B', fakeMind());
  nodeB.addDirectPeer('A', null, chB); // B prima: così riceve i pesi iniziali di A senza errori
  nodeA.addDirectPeer('B', null, chA);
  return { nodeA, nodeB, chA, chB };
}

const samplePayload = () => ({
  BTC: { kind: 'crypto', asOf: '2026-07-14T10:00:00Z', source: 'coingecko', series: [{ date: '2026-07-13', close: 100 }, { date: '2026-07-14', close: 101 }] },
});

test('sharePrices: il payload arriva intatto al peer via price_share', () => {
  const { nodeA, nodeB } = twoNodes();
  let got = null;
  nodeB.onPricesReceived = (peerId, prices) => { got = { peerId, prices }; };

  const payload = samplePayload();
  nodeA.sharePrices(payload);

  assert.ok(got, 'il messaggio price_share deve essere consegnato');
  assert.equal(got.peerId, 'A');
  assert.deepEqual(got.prices, payload); // round-trip JSON senza perdite
});

test('sharePrices: non invia su canali non aperti e non crasha', () => {
  const { nodeA, nodeB, chA } = twoNodes();
  let got = null;
  nodeB.onPricesReceived = (peerId, prices) => { got = { peerId, prices }; };

  chA.readyState = 'closed';
  nodeA.sharePrices(samplePayload());
  assert.equal(got, null);
});

test('price_share senza handler registrato: nessun crash', () => {
  const { nodeA, chB } = twoNodes();
  nodeA.onPricesReceived = null; // A non ha handler
  // B → A: l'optional chaining deve assorbire l'assenza del callback
  chB.send(JSON.stringify({ type: 'price_share', prices: samplePayload() }));
});

test('due nodi: newest-wins end-to-end — il ricevente accetta solo dati più freschi e plausibili', () => {
  const { nodeA, nodeB } = twoNodes();

  // Il ricevente B applica mergePeerPrices sulla sua "cache" locale
  const localStore = { BTC: { prices: [{ date: '2026-07-10', close: 99 }], source: 'coingecko', asOf: '2026-07-10T00:00:00Z', stale: true } };
  const decisions = [];
  nodeB.onPricesReceived = (peerId, prices) => {
    for (const [sym, payload] of Object.entries(prices)) {
      const winner = mergePeerPrices(localStore[sym], payload, peerId);
      decisions.push({ sym, accepted: !!winner });
      if (winner) localStore[sym] = winner;
    }
  };

  // 1) A condivide dati più recenti e plausibili → B li adotta
  nodeA.sharePrices(samplePayload());
  assert.deepEqual(decisions, [{ sym: 'BTC', accepted: true }]);
  assert.equal(localStore.BTC.priceSource, 'peer:A');
  assert.equal(localStore.BTC.asOf, '2026-07-14T10:00:00Z');
  assert.equal(localStore.BTC.stale, false);

  // 2) A ri-condivide gli STESSI dati (asOf pari) → rifiutati, niente loop
  nodeA.sharePrices(samplePayload());
  assert.equal(decisions.length, 2);
  assert.equal(decisions[1].accepted, false);

  // 3) A condivide un dato più "fresco" ma con salto del 60% → anti-poison
  nodeA.sharePrices({ BTC: { kind: 'crypto', asOf: '2026-07-15T00:00:00Z', source: 'coingecko', series: [{ date: '2026-07-15', close: 161.6 }] } });
  assert.equal(decisions[2].accepted, false);
  assert.equal(localStore.BTC.asOf, '2026-07-14T10:00:00Z'); // la copia buona resta
});

// ---- reliability_share (Wave 15 v10, meta-federation.js) ----

test('shareReliability: il digest arriva intatto al peer via reliability_share', () => {
  const { nodeA, nodeB } = twoNodes();
  let got = null;
  nodeB.onReliabilityReceived = (peerId, digest) => { got = { peerId, digest }; };

  const digest = { 'spesa|mid|medio|nano': 0.87 };
  nodeA.shareReliability(digest);

  assert.ok(got, 'il messaggio reliability_share deve essere consegnato');
  assert.equal(got.peerId, 'A');
  assert.deepEqual(got.digest, digest); // round-trip JSON senza perdite
});

test('shareReliability: non invia su canali non aperti e non crasha', () => {
  const { nodeA, nodeB, chA } = twoNodes();
  let got = null;
  nodeB.onReliabilityReceived = (peerId, digest) => { got = { peerId, digest }; };
  chA.readyState = 'closed';
  nodeA.shareReliability({ 'x|y|z|nano': 0.5 });
  assert.equal(got, null);
});

test('reliability_share senza handler registrato: nessun crash', () => {
  const { nodeA, chB } = twoNodes();
  nodeA.onReliabilityReceived = null;
  chB.send(JSON.stringify({ type: 'reliability_share', digest: { 'x|y|z|nano': 0.5 } }));
});

test('due nodi: reliability_share end-to-end con mergeReliabilityDigest (pesato per reputazione)', async () => {
  const { exportReliabilityDigest, mergeReliabilityDigest } = await import('../mesh/meta-federation.js');
  const { appendUpdate } = await import('../mesh/update-ledger.js');
  const { initBandit, banditObserve, armMean } = await import('../predict/advisor-bandit.js');

  const { nodeA, nodeB } = twoNodes();
  // A ha imparato che 'nano' è affidabile in questo contesto
  let stateA = initBandit();
  for (let i = 0; i < 20; i++) stateA = banditObserve(stateA, { context: 'spesa|mid|medio', kind: 'nano', reward: 1 });

  let stateB = initBandit();
  let ledgerB = [];
  for (let i = 0; i < 5; i++) ledgerB = appendUpdate(ledgerB, { peerId: 'A', accepted: true, examplesBefore: 0, examplesAfter: 1 });
  nodeB.onReliabilityReceived = (peerId, digest) => {
    stateB = mergeReliabilityDigest(stateB, [{ peerId, digest }], ledgerB);
  };

  nodeA.shareReliability(exportReliabilityDigest(stateA).digest);

  const meanB = armMean(stateB, { context: 'spesa|mid|medio', kind: 'nano' });
  assert.ok(meanB > 0.5, `B deve aver assorbito l'affidabilità appresa da A, avuto ${meanB}`);
});

// ── shareSplitGroups: sync LIVE dei gruppi di divisione spese ──────────────
test('shareSplitGroups: il payload arriva intatto al peer via split_share', () => {
  const { nodeA, nodeB } = twoNodes();
  let got = null;
  nodeB.onSplitGroupsReceived = (peerId, groups) => { got = { peerId, groups }; };
  const groups = [{ id: 'g1', name: 'cena', members: [{ id: 'm0', name: 'Io' }], expenses: [] }];
  nodeA.shareSplitGroups(groups);
  assert.ok(got, 'il messaggio split_share deve essere consegnato');
  assert.equal(got.peerId, 'A');
  assert.deepEqual(got.groups, groups);
});

test('shareSplitGroups: non invia su canali non aperti e non crasha', () => {
  const { nodeA, nodeB, chA } = twoNodes();
  chA.readyState = 'closed';
  let got = null;
  nodeB.onSplitGroupsReceived = (peerId, groups) => { got = { peerId, groups }; };
  assert.doesNotThrow(() => nodeA.shareSplitGroups([{ id: 'g1', name: 'x', members: [], expenses: [] }]));
  assert.equal(got, null);
});

test('split_share senza handler registrato: nessun crash', () => {
  const { nodeA, chB } = twoNodes();
  nodeA.onSplitGroupsReceived = null;
  assert.doesNotThrow(() => chB.send(JSON.stringify({ type: 'split_share', groups: [] })));
});

test('shareSplitGroups: il ricevente può fondere col CRDT (mergeIntoGroups) senza perdere dati locali', async () => {
  const { mergeIntoGroups } = await import('../split/split-engine.js');
  const { nodeA, nodeB } = twoNodes();
  let localGroups = [{ id: 'g1', name: 'cena', members: [{ id: 'm0', name: 'Io' }, { id: 'm1', name: 'Marco' }], expenses: [] }];
  nodeB.onSplitGroupsReceived = (peerId, groups) => {
    for (const g of groups) localGroups = mergeIntoGroups(localGroups, g);
  };
  // A condivide lo STESSO gruppo con una spesa in più (aggiunta dal suo lato)
  const fromA = [{ id: 'g1', name: 'cena', members: [{ id: 'm0', name: 'Io' }, { id: 'm1', name: 'Marco' }], expenses: [{ id: 'e1', payer: 'm0', amount: 40, description: 'pizza', date: '2026-07-26', owed: { m0: 20, m1: 20 }, updatedAt: Date.now() }] }];
  nodeA.shareSplitGroups(fromA);
  assert.equal(localGroups.length, 1);
  assert.equal(localGroups[0].expenses.length, 1, 'la spesa condivisa da A si unisce al gruppo locale');
});

// ── shareMorphology: federazione dei tipi esercente ─────────────────────────
test('shareMorphology: il modello arriva intatto al peer via morphology_share', () => {
  const { nodeA, nodeB } = twoNodes();
  let got = null;
  nodeB.onMorphologyReceived = (peerId, model) => { got = { peerId, model }; };
  const model = { tokens: { pizzeria: { c: { svago: 3 }, n: 3, last: 0, anchors: { da: { svago: 1 }, x: { svago: 1 }, y: { svago: 1 } } } }, version: 2 };
  nodeA.shareMorphology(model);
  assert.ok(got, 'morphology_share deve essere consegnato');
  assert.equal(got.peerId, 'A');
  assert.deepEqual(got.model, model);
});

test('morphology_share senza handler registrato: nessun crash', () => {
  const { nodeA, chB } = twoNodes();
  nodeA.onMorphologyReceived = null;
  assert.doesNotThrow(() => chB.send(JSON.stringify({ type: 'morphology_share', model: { tokens: {} } })));
});

// ── AUTO-DISCOVERY: la mesh scopre un nodo via gossip e si connette DA SOLA,
// passando dal peer che l'ha segnalato come relay — mai serve un secondo
// aggancio manuale. RTCPeerConnection non esiste in Node: simulata con un
// mock fedele (offer/answer/datachannel), non un test debole. ──
let pcRegistry;
class FakeChannel {
  constructor() { this.readyState = 'connecting'; this.onopen = null; this.onmessage = null; this._peer = null; }
  send(data) { this._peer?.onmessage?.({ data }); }
}
function openChannel(ch, peer) { ch._peer = peer; ch.readyState = 'open'; ch.onopen?.(); }
class FakeRTCPeerConnection {
  constructor() {
    this.id = Math.random().toString(36).slice(2);
    pcRegistry.set(this.id, this);
    this.iceGatheringState = 'complete'; // salta l'attesa ICE nei test
    this._channel = null;
    this.ondatachannel = null;
  }
  createDataChannel() { this._channel = new FakeChannel(); return this._channel; }
  async createOffer() { return { type: 'offer', sdp: JSON.stringify({ pcId: this.id }) }; }
  async createAnswer() { return { type: 'answer', sdp: JSON.stringify({ pcId: this.id }) }; }
  async setLocalDescription(desc) { this.localDescription = desc; }
  async setRemoteDescription(desc) {
    this.remoteDescription = desc;
    const { pcId } = JSON.parse(desc.sdp);
    const remotePc = pcRegistry.get(pcId);
    if (desc.type === 'offer') {
      const ch = new FakeChannel();
      this._channel = ch;
      this.ondatachannel?.({ channel: ch }); // registra channel.onopen PRIMA di aprirlo
      openChannel(ch, remotePc._channel);
    } else {
      openChannel(this._channel, remotePc._channel);
    }
  }
  addEventListener() {} // mai chiamato: iceGatheringState già 'complete'
}
class FakeRTCSessionDescription { constructor(init) { Object.assign(this, init); } }

function withFakeRTC(fn) {
  return async () => {
    pcRegistry = new Map();
    globalThis.RTCPeerConnection = FakeRTCPeerConnection;
    globalThis.RTCSessionDescription = FakeRTCSessionDescription;
    try { await fn(); } finally { delete globalThis.RTCPeerConnection; delete globalThis.RTCSessionDescription; }
  };
}

test('auto-discovery: A scopre C tramite B (relay) e si connette DA SOLA, senza un secondo aggancio manuale', withFakeRTC(async () => {
  const { nodeA, nodeB } = twoNodes(); // A↔B già connessi manualmente (simula il primo aggancio QR)
  const nodeC = new MeshNode('C', fakeMind());
  const [chBC, chCB] = linkedChannels();
  nodeB.addDirectPeer('C', null, chCB);
  nodeC.addDirectPeer('B', null, chBC); // B↔C già connessi (secondo aggancio manuale, come oggi)

  // A non conosce ancora C: B glielo segnala via gossip peer_list (già
  // succede oggi ad ogni addDirectPeer). Attendiamo che il relay offer/answer
  // (asincrono, RTCPeerConnection reale) completi il giro.
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.ok(nodeA.peers.has('C'), 'A deve essersi connesso direttamente a C, scoperto solo via gossip');
  assert.ok(nodeC.peers.has('A'), 'anche C deve vedere A come peer diretto (connessione bidirezionale reale)');
}));

test('auto-discovery: rispetta maxAutoPeers, non tenta la connessione se già al limite', withFakeRTC(async () => {
  const nodeA = new MeshNode('A', fakeMind(), { maxAutoPeers: 0 }); // già "pieno"
  const nodeB = new MeshNode('B', fakeMind());
  const [chAB, chBA] = linkedChannels();
  nodeB.addDirectPeer('A', null, chBA);
  nodeA.addDirectPeer('B', null, chAB);

  const nodeC = new MeshNode('C', fakeMind());
  const [chBC, chCB] = linkedChannels();
  nodeB.addDirectPeer('C', null, chCB);
  nodeC.addDirectPeer('B', null, chBC);

  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(nodeA.peers.has('C'), false, 'con maxAutoPeers=0 A non deve tentare nessuna connessione automatica');
  assert.ok(nodeA.knownPeerIds.has('C'), 'ma la scoperta (sapere che C esiste) resta comunque valida');
}));

test('auto-discovery: disattivabile con autoDiscovery:false — scoperta sì, connessione no', withFakeRTC(async () => {
  const nodeA = new MeshNode('A', fakeMind(), { autoDiscovery: false });
  const nodeB = new MeshNode('B', fakeMind());
  const [chAB, chBA] = linkedChannels();
  nodeB.addDirectPeer('A', null, chBA);
  nodeA.addDirectPeer('B', null, chAB);

  const nodeC = new MeshNode('C', fakeMind());
  const [chBC, chCB] = linkedChannels();
  nodeB.addDirectPeer('C', null, chCB);
  nodeC.addDirectPeer('B', null, chBC);

  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(nodeA.peers.has('C'), false);
  assert.ok(nodeA.knownPeerIds.has('C'));
}));

test('auto-discovery: onPeerDiscovered avvisa anche prima/senza che la connessione diretta si completi', withFakeRTC(async () => {
  const nodeA = new MeshNode('A', fakeMind(), { autoDiscovery: false });
  const nodeB = new MeshNode('B', fakeMind());
  const [chAB, chBA] = linkedChannels();
  nodeB.addDirectPeer('A', null, chBA);
  nodeA.addDirectPeer('B', null, chAB);
  let discovered = null;
  nodeA.onPeerDiscovered = (id, via) => { discovered = { id, via }; };

  const nodeC = new MeshNode('C', fakeMind());
  const [chBC, chCB] = linkedChannels();
  nodeB.addDirectPeer('C', null, chCB);
  nodeC.addDirectPeer('B', null, chBC);

  assert.deepEqual(discovered, { id: 'C', via: 'B' });
}));

// ── RICONCILIAZIONE IBLT NEL PROTOCOLLO ──
// Il metodo classico manda l'elenco di TUTTI gli id posseduti; lo sketch ha
// dimensione fissa. Qui si verifica che il protocollo lo usi davvero, che
// consegni le transazioni giuste, e — soprattutto — che degradi al digest
// invece di rompersi quando la riconciliazione non riesce.

function nodiConSketch({ idsA, idsB, reconcileOk = true }) {
  const { nodeA, nodeB } = twoNodes();
  const sketchDi = (ids) => ({ cells: `cells:${ids.join(',')}`, m: 12, k: 4 });
  for (const [nodo, ids] of [[nodeA, idsA], [nodeB, idsB]]) {
    nodo.getSyncSketch = () => sketchDi(ids);
    nodo.getSyncDigest = () => ({ ids });
    nodo.reconcileSketch = (msg) => {
      if (!reconcileOk) return { success: false };
      const suoi = String(msg.cells).replace('cells:', '').split(',').filter(Boolean);
      const mancanti = ids.filter((x) => !suoi.includes(x));
      const txs = mancanti.length ? { '2026-08': mancanti.map((id) => ({ id })) } : {};
      return { success: true, txs };
    };
    nodo.getMissingForPeer = () => ({ '2026-08': [{ id: 'da-digest' }] });
  }
  return { nodeA, nodeB };
}

test('sync via sketch: il peer riceve ESATTAMENTE le transazioni che gli mancano', () => {
  const { nodeA, nodeB } = nodiConSketch({ idsA: ['t1', 't2'], idsB: ['t1', 't2', 't3', 't4'] });
  const ricevuteDaA = [];
  nodeA.onSyncReceived = (txs) => { ricevuteDaA.push(...(txs['2026-08'] || [])); return txs['2026-08'].length; };
  nodeA.requestSync('B');
  assert.deepEqual(ricevuteDaA.map((t) => t.id).sort(), ['t3', 't4'], 'devono arrivare solo le due mancanti');
});

test('sync via sketch: scambio SIMMETRICO — anche chi ha risposto riceve ciò che gli manca', () => {
  const { nodeA, nodeB } = nodiConSketch({ idsA: ['t1', 't9'], idsB: ['t1', 't3'] });
  const aB = [];
  nodeB.onSyncReceived = (txs) => { aB.push(...(txs['2026-08'] || [])); return 1; };
  nodeA.requestSync('B');
  assert.deepEqual(aB.map((t) => t.id), ['t9'], 'B deve ricevere a sua volta, senza una seconda richiesta');
});

test('sync via sketch: nessun ping-pong infinito (il secondo giro non ne genera un terzo)', () => {
  const { nodeA, nodeB } = nodiConSketch({ idsA: ['t1'], idsB: ['t2'] });
  let sketchScambiati = 0;
  for (const n of [nodeA, nodeB]) {
    const orig = n.peers.get(n === nodeA ? 'B' : 'A').channel.send;
    n.peers.get(n === nodeA ? 'B' : 'A').channel.send = (d) => {
      if (String(d).includes('sync_sketch')) sketchScambiati++;
      return orig(d);
    };
  }
  nodeA.requestSync('B');
  assert.ok(sketchScambiati <= 2, `attesi al massimo 2 sketch (andata+risposta), inviati ${sketchScambiati}`);
});

test('sync via sketch: se la riconciliazione FALLISCE si torna al digest, mai un fallimento silenzioso', () => {
  const { nodeA, nodeB } = nodiConSketch({ idsA: ['t1'], idsB: ['t2'], reconcileOk: false });
  const ricevute = [];
  nodeA.onSyncReceived = (txs) => { ricevute.push(...(txs['2026-08'] || [])); return 1; };
  nodeA.requestSync('B');
  assert.deepEqual(ricevute.map((t) => t.id), ['da-digest'], 'deve arrivare comunque il delta, per la via classica');
});

test('sync: senza getSyncSketch si usa direttamente il digest (retrocompatibile)', () => {
  const { nodeA, nodeB } = twoNodes();
  nodeA.getSyncDigest = () => ({ ids: ['x'] });
  nodeB.getMissingForPeer = () => ({ '2026-08': [{ id: 'classico' }] });
  const ricevute = [];
  nodeA.onSyncReceived = (txs) => { ricevute.push(...(txs['2026-08'] || [])); return 1; };
  nodeA.requestSync('B'); // getSyncSketch è null: percorso classico
  assert.deepEqual(ricevute.map((t) => t.id), ['classico']);
});

// ── RICONNESSIONE CON BACKOFF (era implementata ma senza un solo test) ──
test('riconnessione: alla caduta del canale parte un tentativo programmato', () => {
  const attese = [];
  const nodo = new MeshNode('A', fakeMind(), {
    scheduleFn: (fn, ms) => { attese.push(ms); },
    randomFn: () => 0.5, // niente jitter casuale nei test
  });
  const ch = { readyState: 'open', send() {} };
  nodo.addDirectPeer('B', null, ch);
  ch.onclose?.();
  assert.equal(attese.length, 1, 'una caduta deve programmare esattamente un tentativo');
  assert.ok(attese[0] > 0);
});

test('riconnessione: il backoff CRESCE ad ogni tentativo fallito', () => {
  const attese = [];
  const nodo = new MeshNode('A', fakeMind(), {
    scheduleFn: (fn, ms) => { attese.push(ms); },
    randomFn: () => 0.5,
    reconnectBaseMs: 100, reconnectMaxMs: 100000, maxReconnectAttempts: 5,
  });
  for (let i = 0; i < 4; i++) nodo._scheduleReconnect('B');
  for (let i = 1; i < attese.length; i++) {
    assert.ok(attese[i] > attese[i - 1], `il tentativo ${i + 1} deve attendere più del precedente`);
  }
});

test('riconnessione: una singola caduta smette di insistere dopo il limite (niente batteria sprecata)', () => {
  // Si simula la catena VERA: ogni tentativo programmato viene eseguito, e
  // se non trova un relay ne programma un altro. Deve fermarsi da sola.
  const nodo = new MeshNode('A', fakeMind(), {
    scheduleFn: (fn) => { code.push(fn); },
    randomFn: () => 0.5,
    maxReconnectAttempts: 3,
  });
  const code = [];
  nodo._scheduleReconnect('B');
  let eseguiti = 0;
  while (code.length && eseguiti < 50) { code.shift()(); eseguiti++; } // niente relay: si ri-programma
  assert.equal(eseguiti, 3, `la catena deve fermarsi a 3 tentativi, ne ha fatti ${eseguiti}`);
});

test('riconnessione: una NUOVA caduta riparte con tentativi freschi (il limite è per episodio)', () => {
  const attese = [];
  const nodo = new MeshNode('A', fakeMind(), {
    scheduleFn: (fn, ms) => { attese.push(ms); }, randomFn: () => 0.5, maxReconnectAttempts: 2,
  });
  nodo._scheduleReconnect('B'); nodo._scheduleReconnect('B'); // episodio 1: 2 tentativi
  nodo._scheduleReconnect('B'); // supera il limite: azzera, non programma
  const dopoPrimoEpisodio = attese.length;
  nodo._scheduleReconnect('B'); // episodio 2: deve ripartire
  assert.equal(dopoPrimoEpisodio, 2);
  assert.equal(attese.length, 3, 'un peer che torna e ricade merita nuovi tentativi');
});

test('riconnessione: disattivabile (reconnect:false) — nessun tentativo automatico', () => {
  const attese = [];
  const nodo = new MeshNode('A', fakeMind(), {
    scheduleFn: (fn, ms) => { attese.push(ms); }, reconnect: false,
  });
  nodo._scheduleReconnect('B');
  assert.equal(attese.length, 0);
});
