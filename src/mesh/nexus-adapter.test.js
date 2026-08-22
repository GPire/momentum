import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };

const { createNexusMeshMind } = await import('./nexus-adapter.js');
const { MeshNode } = await import('./mesh-signaling.js');

function fakeWorld() {
  const vault = {
    state: { mlData: { neuralNet: { W1: [[1]], b1: [0], W2: [[1]], b2: [0], embeddings: {} }, totalWords: 10, catCounts: { spesa: 8, casa: 2 }, dcgn: { version: 'dcgn-1', edges: {}, cats: { spesa: 5 }, df: {}, docs: 5 } } },
    saved: 0,
    save() { this.saved++; },
  };
  const orchestrator = {
    _validationSet: [],
    graph: vault.state.mlData.dcgn,
    calls: [],
    graphCalls: [],
    mergeRemoteNeuralNet(net, count, catCounts) { this.calls.push({ net, count, catCounts }); return { accepted: true, totalExamples: 10 + count }; },
    mergeRemoteGraph(graph) { this.graphCalls.push(graph); return { accepted: true }; },
  };
  return { vault, orchestrator, mind: createNexusMeshMind(orchestrator, vault) };
}

test('serialize legge la rete VERA dal vault con formato dichiarato', () => {
  const { mind, vault } = fakeWorld();
  const s = mind.model.serialize();
  assert.equal(s.format, 'nexus-v1');
  assert.equal(s.net, vault.state.mlData.neuralNet); // stesso oggetto, non una copia morta
  assert.equal(s.trainedExamples, 10);
  assert.deepEqual(s.catCounts, { spesa: 8, casa: 2 }, 'i conteggi PER categoria vanno trasmessi, non solo il totale');
  assert.equal(s.graph, vault.state.mlData.dcgn, 'il grafo DCGN va trasmesso nello stesso payload, stesso oggetto');
});

test('mergeRemote delega all\'orchestratore con il conteggio esempi remoto', () => {
  const { mind, orchestrator } = fakeWorld();
  const res = mind.mergeRemote({ format: 'nexus-v1', net: { W1: [[2]] }, trainedExamples: 5 });
  assert.equal(res.accepted, true);
  assert.equal(orchestrator.calls.length, 1);
  assert.equal(orchestrator.calls[0].count, 5);
});

test('mergeRemote passa anche i conteggi PER categoria del peer, quando presenti', () => {
  const { mind, orchestrator } = fakeWorld();
  mind.mergeRemote({ format: 'nexus-v1', net: { W1: [[2]] }, trainedExamples: 5, catCounts: { salute: 300 } });
  assert.deepEqual(orchestrator.calls[0].catCounts, { salute: 300 });
});

test('mergeRemote con un peer di formato più vecchio (senza catCounts) non si rompe: passa null', () => {
  const { mind, orchestrator } = fakeWorld();
  mind.mergeRemote({ format: 'nexus-v1', net: { W1: [[2]] }, trainedExamples: 5 });
  assert.equal(orchestrator.calls[0].catCounts, null);
});

test('mergeRemote instrada il grafo DCGN a mergeRemoteGraph, come canale indipendente annidato in risultato.graph', () => {
  const { mind, orchestrator, vault } = fakeWorld();
  const grafoPeer = { version: 'dcgn-1', edges: {}, cats: { ristoranti: 3 }, df: {}, docs: 3 };
  const res = mind.mergeRemote({ format: 'nexus-v1', net: { W1: [[2]] }, trainedExamples: 5, graph: grafoPeer });
  assert.equal(orchestrator.graphCalls.length, 1);
  assert.equal(orchestrator.graphCalls[0], grafoPeer);
  assert.equal(res.graph.accepted, true, 'l\'esito del grafo vive annidato, non sovrascrive quello della rete');
  assert.equal(res.accepted, true, 'l\'esito della rete resta quello della rete, indipendente dal grafo');
});

test('mergeRemote senza campo graph (peer di formato più vecchio) non tocca il DCGN, mai un crash', () => {
  const { mind, orchestrator } = fakeWorld();
  const res = mind.mergeRemote({ format: 'nexus-v1', net: { W1: [[2]] }, trainedExamples: 5 });
  assert.equal(orchestrator.graphCalls.length, 0);
  assert.equal(res.graph, undefined);
});

test('mergeRemote con grafo locale VUOTO (dispositivo nuovo) ADOTTA il grafo del peer invece di fonderlo', () => {
  const { orchestrator } = fakeWorld();
  const vaultGrafoVuoto = {
    state: { mlData: { neuralNet: { W1: [[1]] }, totalWords: 10, dcgn: { version: 'dcgn-1', edges: {}, cats: {}, df: {}, docs: 0 } } },
    saved: 0, save() { this.saved++; },
  };
  const mind = createNexusMeshMind(orchestrator, vaultGrafoVuoto);
  const grafoPeer = { version: 'dcgn-1', edges: {}, cats: { spesa: 9 }, df: {}, docs: 9 };
  const res = mind.mergeRemote({ format: 'nexus-v1', net: { W1: [[2]] }, trainedExamples: 5, graph: grafoPeer });
  assert.equal(orchestrator.graphCalls.length, 0, 'un grafo locale vuoto adotta direttamente, non passa dal cancello di merge');
  assert.equal(res.graph.adopted, true);
  assert.equal(vaultGrafoVuoto.state.mlData.dcgn, grafoPeer);
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
