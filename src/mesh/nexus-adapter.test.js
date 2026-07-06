import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };

const { createNexusMeshMind } = await import('./nexus-adapter.js');
const { MeshNode } = await import('./mesh-signaling.js');

function fakeWorld() {
  const vault = {
    state: { mlData: { neuralNet: { W1: [[1]], b1: [0], W2: [[1]], b2: [0], embeddings: {} }, totalWords: 10 } },
    saved: 0,
    save() { this.saved++; },
  };
  const orchestrator = {
    _validationSet: [],
    calls: [],
    mergeRemoteNeuralNet(net, count) { this.calls.push({ net, count }); return { accepted: true, totalExamples: 10 + count }; },
  };
  return { vault, orchestrator, mind: createNexusMeshMind(orchestrator, vault) };
}

test('serialize legge la rete VERA dal vault con formato dichiarato', () => {
  const { mind, vault } = fakeWorld();
  const s = mind.model.serialize();
  assert.equal(s.format, 'nexus-v1');
  assert.equal(s.net, vault.state.mlData.neuralNet); // stesso oggetto, non una copia morta
  assert.equal(s.trainedExamples, 10);
});

test('mergeRemote delega all\'orchestratore con il conteggio esempi remoto', () => {
  const { mind, orchestrator } = fakeWorld();
  const res = mind.mergeRemote({ format: 'nexus-v1', net: { W1: [[2]] }, trainedExamples: 5 });
  assert.equal(res.accepted, true);
  assert.equal(orchestrator.calls.length, 1);
  assert.equal(orchestrator.calls[0].count, 5);
});

test('mergeRemote rifiuta formati sconosciuti, mai indovinare', () => {
  const { mind, orchestrator } = fakeWorld();
  assert.equal(mind.mergeRemote({ format: 'realmind-v9', net: {} }).accepted, false);
  assert.equal(mind.mergeRemote(null).accepted, false);
  assert.equal(orchestrator.calls.length, 0);
});

test('MeshNode instrada i pesi remoti al mergeRemote della webapp (non al motore standalone)', async () => {
  const { mind, orchestrator } = fakeWorld();
  const node = new MeshNode('nodo-test', mind);
  let received = null;
  node.onGradientReceived = (peerId, stats) => { received = { peerId, stats }; };
  await node._handleRemoteWeights('peer-remoto', { format: 'nexus-v1', net: { W1: [[3]] }, trainedExamples: 7 });
  assert.equal(orchestrator.calls.length, 1); // il merge è passato dall'orchestratore
  assert.equal(received.stats.accepted, true);
});

test('getMeshStats legge il conteggio esempi vero dal vault', () => {
  const { mind } = fakeWorld();
  const node = new MeshNode('nodo-test', mind);
  assert.equal(node.getMeshStats().trainedExamples, 10);
});

test('dispositivo nuovo (rete vuota) ADOTTA la mente del peer invece di rifiutarla', () => {
  const { orchestrator } = fakeWorld();
  const emptyVault = { state: { mlData: { neuralNet: null, totalWords: 0 } }, saved: 0, save() { this.saved++; } };
  const mind = createNexusMeshMind(orchestrator, emptyVault);
  const res = mind.mergeRemote({ format: 'nexus-v1', net: { W1: [[9]] }, trainedExamples: 42 });
  assert.equal(res.accepted, true);
  assert.equal(res.adopted, true);
  assert.deepEqual(emptyVault.state.mlData.neuralNet, { W1: [[9]] });
  assert.equal(emptyVault.state.mlData.totalWords, 42);
  assert.equal(emptyVault.saved, 1);
  assert.equal(orchestrator.calls.length, 0); // niente merge: adozione diretta
});
