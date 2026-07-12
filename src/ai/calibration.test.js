import test from 'node:test';
import assert from 'node:assert/strict';
const { reliabilityWeight, softVote, calibratedEnsemble, expectedCalibrationError } = await import('./calibration.js');

const CATS = ['a', 'b', 'c'];

test('reliabilityWeight: al caso → 0, perfetto → 1, monotono', () => {
  assert.equal(reliabilityWeight(1 / 3, 3), 0);        // caso su 3 classi
  assert.equal(reliabilityWeight(1, 3), 1);            // perfetto
  assert.ok(reliabilityWeight(0.8, 3) > reliabilityWeight(0.5, 3));
  assert.equal(reliabilityWeight(0.1, 3), 0);          // sotto il caso → 0 (non vota)
});

test('softVote: esperti concordi → quella categoria', () => {
  const r = softVote([
    { allProbs: { a: 0.8, b: 0.1, c: 0.1 }, weight: 1 },
    { allProbs: { a: 0.7, b: 0.2, c: 0.1 }, weight: 1 },
  ], CATS);
  assert.equal(r.category, 'a');
  assert.ok(r.margin > 0);
});

test('softVote: un esperto incerto NON sovrasta uno sicuro (soft-voting)', () => {
  // esperto1 sicurissimo su a; esperto2 sbaglia ma sparso (poca massa su b)
  const r = softVote([
    { allProbs: { a: 0.95, b: 0.03, c: 0.02 }, weight: 1 },
    { allProbs: { a: 0.30, b: 0.40, c: 0.30 }, weight: 1 },
  ], CATS);
  assert.equal(r.category, 'a'); // la massa aggregata resta su a
});

test('calibratedEnsemble: astensione sotto soglia', () => {
  const preds = [
    { allProbs: { a: 0.4, b: 0.35, c: 0.25 }, category: 'a', accuracy: 0.6 },
    { allProbs: { a: 0.34, b: 0.36, c: 0.30 }, category: 'b', accuracy: 0.6 },
  ];
  const r = calibratedEnsemble(preds, CATS, { abstainBelow: 0.6 });
  assert.equal(r.abstain, true); // nessuno abbastanza sicuro → si astiene/chiede
});

test('expectedCalibrationError: perfetto ≈ 0, pessimo > 0', () => {
  // confidenza = accuratezza reale in ogni bin → ECE ~0
  const good = [];
  for (let i = 0; i < 100; i++) good.push({ confidence: 0.9, correct: i < 90 });
  assert.ok(expectedCalibrationError(good) < 0.05);
  // sempre confidentissimo ma sempre sbagliato → ECE alto
  const bad = Array.from({ length: 50 }, () => ({ confidence: 0.99, correct: false }));
  assert.ok(expectedCalibrationError(bad) > 0.9);
});
