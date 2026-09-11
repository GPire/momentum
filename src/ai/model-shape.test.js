import test from 'node:test';
import assert from 'node:assert/strict';
import { validNeuralModel, validGraphModel } from './model-shape.js';
export function sampleNet(value = 0.1) {
  return { W1: Array.from({ length: 12 }, () => Array(8).fill(value)), b1: Array(12).fill(0),
    W2: Array.from({ length: 8 }, () => Array(12).fill(value)), b2: Array(8).fill(0), embeddings: {} };
}
test('original eight-output network and dynamic category maps are accepted', () => {
  assert.equal(validNeuralModel(sampleNet()), true);
  const net = sampleNet();
  net.indexToCat = Array.from({ length: 8 }, (_, i) => `custom-${i}`);
  net.catIndex = Object.fromEntries(net.indexToCat.map((c, i) => [c, i]));
  assert.equal(validNeuralModel(net), true);
  net.catIndex['custom-0'] = 1;
  assert.equal(validNeuralModel(net), false);
});
for (const [name, damage] of [
  ['NaN', n => n.W1[0][0] = NaN], ['Infinity', n => n.b2[0] = Infinity],
  ['short matrix', n => n.W2.pop()], ['wrong embedding', n => n.embeddings.shop = [1]],
  ['reserved key', n => n.embeddings = JSON.parse('{"__proto__":[1]}')],
  ['unknown category mapping', n => n.indexToCat = ['invented']],
]) test(`rejects ${name} without changing the network`, () => {
  const net = sampleNet(); damage(net); const before = structuredClone(net);
  assert.equal(validNeuralModel(net), false); assert.deepEqual(net, before);
});
test('graph structural checks allow decay but reject poisoned counts and cells', () => {
  const graph = { version: 'dcgn-1', docs: 2, cats: { spesa: 1.5 }, df: { 'w:shop': 1 }, edges: { 'w:shop': { spesa: { w: 0.5, n: 1 } } } };
  assert.equal(validGraphModel(graph), true);
  graph.edges['w:shop'].spesa.w = NaN;
  assert.equal(validGraphModel(graph), false);
  assert.equal(validGraphModel({ ...graph, docs: -2 }), false);
});
