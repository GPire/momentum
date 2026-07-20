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
