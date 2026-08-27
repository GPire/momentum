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

// ── BUG REALE trovato beta-testando (2026-08-27): con la wiring vera di
// produzione, il nodeId della mesh era CASUALE ad ogni sessione
// (new MeshNode(undefined,...)), slegato dal deviceId persistito che
// claimMember scrive in claimedBy — peerAppartieneAlGruppo(peerId, g)
// confronta m.claimedBy === peerId, e con due spazi di id indipendenti
// quel confronto non è MAI vero. Risultato: shareSplitGroups(groups,
// peerAppartieneAlGruppo) filtrava fuori OGNI peer, sempre — nessuna
// rinomina/spesa/messaggio è mai arrivato via push live in produzione.
// Fix: il nodeId della mesh DIVENTA VaultDAO.state.deviceId (main.js) —
// qui si riproduce esattamente lo scenario reale (id realistici, non le
// etichette corte 'A'/'B' del resto del file) prima/dopo il fix. ──
function peerAppartieneAlGruppo(peerId, gruppo) {
  if (!gruppo || !Array.isArray(gruppo.members)) return false;
  return gruppo.members.some((m) => m.claimedBy && m.claimedBy === peerId);
}

test('shareSplitGroups + peerAppartieneAlGruppo: con nodeId di mesh SLEGATO dal deviceId (bug reale, wiring pre-fix) non arriva NULLA', async () => {
  const { claimMember } = await import('../split/split-engine.js');
  const meshNodeIdA = crypto.randomUUID(), meshNodeIdB = crypto.randomUUID();
  const deviceIdB = crypto.randomUUID(); // MAI uguale a meshNodeIdB — è il bug
  const [chA, chB] = linkedChannels();
  const nodeA = new MeshNode(meshNodeIdA, fakeMind());
  const nodeB = new MeshNode(meshNodeIdB, fakeMind());
  nodeB.addDirectPeer(meshNodeIdA, null, chB);
  nodeA.addDirectPeer(meshNodeIdB, null, chA);
  let g = { id: 'g1', name: 'Weekend', members: [{ id: 'm0', name: 'Io' }, { id: 'm1', name: 'Marco' }], expenses: [] };
  g = claimMember(g, 'm1', deviceIdB);
  let ricevuto = null;
  nodeB.onSplitGroupsReceived = (peerId, groups) => { ricevuto = groups; };
  const inviati = nodeA.shareSplitGroups([{ ...g, name: 'Weekend a Barcellona' }], peerAppartieneAlGruppo);
  assert.equal(inviati, 0, 'con id slegati, il filtro esclude ogni peer — riproduce esattamente il bug');
  assert.equal(ricevuto, null, 'Marco non riceve la rinomina: questo è il bug, non il comportamento voluto');
});

test('shareSplitGroups + peerAppartieneAlGruppo: con nodeId di mesh = deviceId (wiring corretta, post-fix) la rinomina arriva', async () => {
  const { claimMember } = await import('../split/split-engine.js');
  const deviceIdA = crypto.randomUUID(), deviceIdB = crypto.randomUUID();
  const [chA, chB] = linkedChannels();
  // Stessa identità usata sia dalla mesh (nodeId) sia da claimMember — il fix.
  const nodeA = new MeshNode(deviceIdA, fakeMind());
  const nodeB = new MeshNode(deviceIdB, fakeMind());
  nodeB.addDirectPeer(deviceIdA, null, chB);
  nodeA.addDirectPeer(deviceIdB, null, chA);
  let g = { id: 'g1', name: 'Weekend', members: [{ id: 'm0', name: 'Io' }, { id: 'm1', name: 'Marco' }], expenses: [] };
  g = claimMember(g, 'm0', deviceIdA);
  g = claimMember(g, 'm1', deviceIdB);
  let ricevuto = null;
  nodeB.onSplitGroupsReceived = (peerId, groups) => { ricevuto = groups; };
  const inviati = nodeA.shareSplitGroups([{ ...g, name: 'Weekend a Barcellona' }], peerAppartieneAlGruppo);
  assert.equal(inviati, 1, 'con id allineati, il filtro riconosce correttamente Marco come membro del gruppo');
  assert.ok(ricevuto, 'Marco riceve la rinomina');
  assert.equal(ricevuto[0].name, 'Weekend a Barcellona');
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

// ── shareDistillation: distillazione federata LIVELLO A ─────────────────────
test('shareDistillation: il digest arriva intatto al peer via distillation_share', () => {
  const { nodeA, nodeB } = twoNodes();
  let got = null;
  nodeB.onDistillationReceived = (peerId, digest) => { got = { peerId, digest }; };
  const digest = { kind: 'distillation', probeVersion: 1, answers: { farmacia: { Salute: 1 } } };
  nodeA.shareDistillation(digest);
  assert.ok(got, 'distillation_share deve essere consegnato');
  assert.equal(got.peerId, 'A');
  assert.deepEqual(got.digest, digest);
});

test('shareDistillation: un digest vuoto non manda nulla (niente chiacchiericcio)', () => {
  const { nodeA, nodeB } = twoNodes();
  let chiamato = false;
  nodeB.onDistillationReceived = () => { chiamato = true; };
  assert.equal(nodeA.shareDistillation({ kind: 'distillation', probeVersion: 1, answers: {} }), 0);
  assert.equal(nodeA.shareDistillation(null), 0);
  assert.ok(!chiamato);
});

test('distillation_share senza handler registrato: nessun crash', () => {
  const { nodeA, chB } = twoNodes();
  nodeA.onDistillationReceived = null;
  assert.doesNotThrow(() => chB.send(JSON.stringify({ type: 'distillation_share', digest: { probeVersion: 1, answers: {} } })));
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

// ── CRESCITA A N DISPOSITIVI: il gossip trova i nuovi da solo ──
// La domanda vera non è "due dispositivi si collegano?", ma "il terzo, il
// quarto, il decimo arrivano senza che l'utente rifaccia il QR ogni volta?".
// Qui si verifica proprio quello, con i canali finti già usati sopra.

test('gossip: chi si collega a UNO viene annunciato a TUTTI gli altri', () => {
  const { nodeA, nodeB } = twoNodes();               // A ↔ B
  const [chB2, chC] = linkedChannels();
  const nodeC = new MeshNode('C', fakeMind(), { autoDiscovery: false });
  const scoperti = [];
  nodeA.onPeerDiscovered = (id) => scoperti.push(id);
  nodeC.addDirectPeer('B', null, chC);
  nodeB.addDirectPeer('C', null, chB2);              // C entra passando da B
  assert.ok(nodeA.knownPeerIds.has('C'), 'A deve venire a sapere di C senza averlo mai incontrato');
  assert.deepEqual(scoperti, ['C']);
});

test('gossip: la conoscenza si propaga a CATENA (A non è mai stato vicino a D)', () => {
  const { nodeA, nodeB } = twoNodes();
  const [chB2, chC] = linkedChannels();
  const nodeC = new MeshNode('C', fakeMind(), { autoDiscovery: false });
  nodeC.addDirectPeer('B', null, chC);
  nodeB.addDirectPeer('C', null, chB2);
  const [chC2, chD] = linkedChannels();
  const nodeD = new MeshNode('D', fakeMind(), { autoDiscovery: false });
  nodeD.addDirectPeer('C', null, chD);
  nodeC.addDirectPeer('D', null, chC2);              // D entra passando da C
  assert.ok(nodeA.knownPeerIds.has('D'), 'A deve conoscere D pur essendo a due salti di distanza');
});

test('gossip: il tetto alle connessioni dirette protegge i dispositivi deboli', () => {
  // Oltre maxAutoPeers non si aprono altre connessioni punto-a-punto: si
  // resta raggiungibili via relay. Magliare tutto sarebbe insostenibile per
  // un telefono con dieci dispositivi in rete.
  const nodo = new MeshNode('A', fakeMind(), { maxAutoPeers: 2 });
  assert.equal(nodo.maxAutoPeers, 2);
  const [ch1] = linkedChannels(); const [ch2] = linkedChannels(); const [ch3] = linkedChannels();
  nodo.addDirectPeer('B', null, ch1);
  nodo.addDirectPeer('C', null, ch2);
  nodo._handlePeerList('B', ['Z']);                  // scoperto con il tetto già raggiunto
  assert.ok(nodo.knownPeerIds.has('Z'), 'lo si conosce comunque (raggiungibile via relay)');
  assert.ok(!nodo.pendingOutbound.has('Z'), 'ma non si apre una terza connessione diretta');
});

test('gossip: un nodo non tenta MAI di collegarsi a sé stesso', () => {
  // Il proprio id STA in knownPeerIds di proposito (serve a non ri-scoprirsi):
  // la garanzia che conta è che non parta un tentativo di connessione verso
  // sé stessi, che sarebbe un cortocircuito.
  const nodo = new MeshNode('A', fakeMind());
  nodo._handlePeerList('B', ['A', 'B']);
  assert.ok(!nodo.pendingOutbound.has('A'), 'un auto-collegamento sarebbe un cortocircuito');
});

// ── CALCOLO CONDIVISO: il cancello su cosa si può distribuire ──
test('calcolo condiviso: chi ESEGUE rifiuta i carichi non distribuibili, non si fida di chi chiede', async () => {
  const { nodeA, nodeB } = twoNodes();
  const eseguiti = [];
  nodeB.runComputeUnits = (workloadId, units) => {
    // stessa logica del cancello lato esecutore
    if (workloadId === 'previsione-cassa') return null; // input = movimenti dell'utente
    eseguiti.push(workloadId);
    return { 0: 42 };
  };
  const ricevuti = [];
  nodeA.onComputeResult = (peerId, workloadId, results) => ricevuti.push({ workloadId, results });
  nodeA.sendComputeUnits('B', 'previsione-cassa', [{ index: 0, seed: 1 }]);
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(eseguiti, [], 'un carico sui dati personali non deve essere eseguito nemmeno se richiesto');
  assert.deepEqual(ricevuti, [], 'e non deve tornare alcun risultato');
});

test('calcolo condiviso: un carico a input pubblico viene eseguito e i risultati tornano', async () => {
  const { nodeA, nodeB } = twoNodes();
  nodeB.runComputeUnits = (workloadId, units) => Object.fromEntries(units.map((u) => [u.index, u.seed * 2]));
  const ricevuti = [];
  nodeA.onComputeResult = (peerId, workloadId, results) => ricevuti.push({ peerId, workloadId, results });
  nodeA.sendComputeUnits('B', 'montecarlo-strategie', [{ index: 0, seed: 21 }, { index: 1, seed: 50 }]);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(ricevuti.length, 1);
  assert.equal(ricevuti[0].workloadId, 'montecarlo-strategie');
  assert.deepEqual(ricevuti[0].results, { 0: 42, 1: 100 });
});

// ── SYNC LIVE: la spesa appena inserita arriva SUBITO, senza riconnettersi ──
test('sync live: broadcastTransactions consegna a tutti i peer collegati', () => {
  const { nodeA, nodeB } = twoNodes();
  const ricevute = [];
  nodeB.onSyncReceived = (txs) => { ricevute.push(txs); return 1; };
  const inviati = nodeA.broadcastTransactions({ '2026-08': [{ id: 't1', amount: 12 }] });
  assert.equal(inviati, 1);
  assert.equal(ricevute.length, 1);
  assert.equal(ricevute[0]['2026-08'][0].id, 't1');
});

test('sync live: niente da mandare -> nessun messaggio (niente chiacchiericcio)', () => {
  const { nodeA, nodeB } = twoNodes();
  let messaggi = 0;
  nodeB.onSyncReceived = () => { messaggi++; return 0; };
  assert.equal(nodeA.broadcastTransactions({}), 0);
  assert.equal(nodeA.broadcastTransactions(null), 0);
  assert.equal(messaggi, 0);
});

test('sync live: su canale chiuso non invia e non crasha', () => {
  const { nodeA, chA } = twoNodes();
  chA.readyState = 'closed';
  assert.doesNotThrow(() => nodeA.broadcastTransactions({ '2026-08': [{ id: 'x' }] }));
  assert.equal(nodeA.broadcastTransactions({ '2026-08': [{ id: 'x' }] }), 0);
});

test('sync live: la stessa transazione ricevuta due volte non si duplica (merge idempotente)', async () => {
  const { mergeTransactions } = await import('./sync.js');
  const locale = { '2026-08': [{ id: 't1', amount: 10, date: '2026-08-01' }] };
  const in1 = mergeTransactions(locale, { '2026-08': [{ id: 't1', amount: 10, date: '2026-08-01' }] });
  assert.equal(in1.added, 0, 'ritrasmettere deve essere sicuro: e\' cio\' che rende il live sync senza rischi');
  assert.equal(in1.merged['2026-08'].length, 1);
});

test('sync live: e\' un\'ACCELERAZIONE, non un sostituto — cio\' che non parte live arriva alla connessione', async () => {
  const { computeSyncDigest, transactionsMissingFromPeer } = await import('./sync.js');
  // Scenario: A inserisce una spesa mentre B è scollegato. Il sync live non
  // ha nessuno a cui mandarla. Alla riconnessione DEVE arrivare comunque.
  const A = { '2026-08': [{ id: 'persa-live', amount: 30, date: '2026-08-06' }] };
  const B = {};
  const mancanti = transactionsMissingFromPeer(A, computeSyncDigest(B));
  assert.equal(mancanti['2026-08']?.[0]?.id, 'persa-live',
    'nessun dato puo\' sparire perche\' era poco urgente: la sincronizzazione alla connessione e\' la garanzia');
});

// ══ IL BUCO DI PRIVACY VERO (2026-08-08) ══
// Trovato perche' l'utente ha contestato, giustamente, una protezione che non
// proteggeva: cifrare l'invito con una chiave che viaggia NELLO STESSO link
// non nasconde niente a chi il link ce l'ha. Cercando cosa proteggesse
// davvero e' emerso il problema reale, che non era li': `shareSplitGroups`
// mandava OGNI gruppo a OGNI peer collegato, senza guardare chi ne fa parte.
test('PRIVACY: un gruppo va SOLO ai dispositivi che ne fanno parte', () => {
  const N = new MeshNode('io', null);
  const ricevuto = {};
  for (const id of ['amico', 'estraneo']) {
    ricevuto[id] = [];
    N.peers.set(id, { channel: { readyState: 'open', send: (m) => ricevuto[id].push(JSON.parse(m)) } });
  }
  const gruppo = { id: 'g1', name: 'Cena', members: [
    { id: 'm1', name: 'Io', claimedBy: 'io' },
    { id: 'm2', name: 'Amico', claimedBy: 'amico' },
  ] };
  const appartiene = (peerId, g) => g.members.some((m) => m.claimedBy === peerId);

  N.shareSplitGroups([gruppo], appartiene);
  assert.equal(ricevuto.amico.length, 1, 'chi e\' nel gruppo lo riceve');
  assert.equal(ricevuto.estraneo.length, 0,
    'collegarsi per dividere una cena non deve dare accesso agli altri gruppi di quella persona');
});

test('PRIVACY: nomi e importi non raggiungono chi non ha titolo', () => {
  const N = new MeshNode('io', null);
  let visto = '';
  N.peers.set('estraneo', { channel: { readyState: 'open', send: (m) => { visto += m; } } });
  const gruppo = { id: 'g1', name: 'Vacanza', members: [{ id: 'm1', name: 'Sara', claimedBy: 'io' }], expenses: [{ amount: 480, label: 'Hotel' }] };
  N.shareSplitGroups([gruppo], (p, g) => g.members.some((m) => m.claimedBy === p));
  assert.equal(visto, '');
  for (const s of ['Sara', 'Vacanza', '480', 'Hotel']) assert.ok(!visto.includes(s));
});

test('con piu\' gruppi, ognuno va solo ai suoi', () => {
  const N = new MeshNode('io', null);
  const r = { a: [], b: [] };
  N.peers.set('a', { channel: { readyState: 'open', send: (m) => r.a.push(JSON.parse(m)) } });
  N.peers.set('b', { channel: { readyState: 'open', send: (m) => r.b.push(JSON.parse(m)) } });
  const g1 = { id: 'g1', members: [{ id: 'x', claimedBy: 'a' }] };
  const g2 = { id: 'g2', members: [{ id: 'y', claimedBy: 'b' }] };
  N.shareSplitGroups([g1, g2], (p, g) => g.members.some((m) => m.claimedBy === p));
  assert.deepEqual(r.a[0].groups.map((g) => g.id), ['g1']);
  assert.deepEqual(r.b[0].groups.map((g) => g.id), ['g2']);
});

test('un dispositivo che non ha rivendicato nessuno slot non riceve niente', () => {
  const N = new MeshNode('io', null);
  let n = 0;
  N.peers.set('anonimo', { channel: { readyState: 'open', send: () => n++ } });
  N.shareSplitGroups([{ id: 'g', members: [{ id: 'm', name: 'Tizio' }] }], (p, g) => g.members.some((m) => m.claimedBy === p));
  assert.equal(n, 0, 'uno slot non rivendicato non identifica nessun dispositivo');
});

test('RETROCOMPATIBILITA\': senza il filtro il comportamento resta quello di prima', () => {
  const N = new MeshNode('io', null);
  let n = 0;
  N.peers.set('x', { channel: { readyState: 'open', send: () => n++ } });
  N.shareSplitGroups([{ id: 'g', members: [] }]);
  assert.equal(n, 1, 'cambiare in silenzio la semantica romperebbe i chiamanti che non sanno di dover passare il filtro');
});
