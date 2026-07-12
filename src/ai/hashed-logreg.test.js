import test from 'node:test';
import assert from 'node:assert/strict';
const { HashedLogReg, trainHashedLogReg, hashFeatures } = await import('./hashed-logreg.js');

test('hashFeatures: vettore sparso L2-normalizzato, deterministico', () => {
  const a = hashFeatures('esselunga supermercato', 4096);
  const b = hashFeatures('esselunga supermercato', 4096);
  assert.deepEqual([...a.entries()], [...b.entries()]); // deterministico
  let norm = 0; for (const v of a.values()) norm += v * v;
  assert.ok(Math.abs(Math.sqrt(norm) - 1) < 1e-9); // L2 = 1
});

test('trainHashedLogReg: impara pattern separabili', () => {
  const pairs = [];
  for (let i = 0; i < 30; i++) { pairs.push(['supermercato spesa alimentari', 'spesa']); pairs.push(['ristorante pizza cena', 'ristoranti']); pairs.push(['netflix abbonamento mensile', 'abbonamenti']); }
  const model = trainHashedLogReg(pairs, { dim: 2048, epochs: 30 });
  const m = new HashedLogReg(model);
  assert.equal(m.predict('supermercato spesa').category, 'spesa');
  assert.equal(m.predict('ristorante pizza').category, 'ristoranti');
  assert.equal(m.predict('netflix abbonamento').category, 'abbonamenti');
});

test('predict: distribuzione somma a 1', () => {
  const model = trainHashedLogReg([['a b c', 'x'], ['d e f', 'y']], { dim: 512, epochs: 10 });
  const r = new HashedLogReg(model).predict('a b c');
  const sum = Object.values(r.allProbs).reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
});
