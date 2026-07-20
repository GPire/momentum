import test from 'node:test';
import assert from 'node:assert/strict';
const {
  lengthBucket, expertContext, expertWeightFactor, observeExpertOutcome, initExpertBandit,
} = await import('./expert-bandit.js');

test('lengthBucket: confini short/mid/long', () => {
  assert.equal(lengthBucket('Bar'), 'short');
  assert.equal(lengthBucket('a'.repeat(14)), 'short');
  assert.equal(lengthBucket('a'.repeat(15)), 'mid');
  assert.equal(lengthBucket('a'.repeat(40)), 'mid');
  assert.equal(lengthBucket('a'.repeat(41)), 'long');
  assert.equal(lengthBucket(''), 'short');
});

test('expertContext: combina categoria, bucket lunghezza e tier', () => {
  assert.equal(expertContext('spesa', 'Bar', 'minimo'), 'spesa|short|minimo');
  assert.equal(expertContext(null, '', undefined), '?|short|medio');
});

test('expertWeightFactor: a freddo (0 osservazioni) e\' neutro, fattore 1.0 (fallback identico a v3)', () => {
  const s = initExpertBandit();
  const ctx = expertContext('spesa', 'Bar', 'medio');
  assert.equal(expertWeightFactor(s, ctx, 'nano'), 1.0);
  assert.equal(expertWeightFactor(s, ctx, 'meso'), 1.0);
});

test('observeExpertOutcome + expertWeightFactor: un esperto giusto ripetutamente in un contesto viene privilegiato LI\'', () => {
  let s = initExpertBandit();
  const ctx = expertContext('spesa', 'Bar', 'medio');
  for (let i = 0; i < 15; i++) s = observeExpertOutcome(s, { context: ctx, source: 'nano', correct: true });
  for (let i = 0; i < 15; i++) s = observeExpertOutcome(s, { context: ctx, source: 'meso', correct: false });
  const nanoFactor = expertWeightFactor(s, ctx, 'nano');
  const mesoFactor = expertWeightFactor(s, ctx, 'meso');
  assert.ok(nanoFactor > 1.3, `atteso >1.3, avuto ${nanoFactor}`);
  assert.ok(mesoFactor < 0.7, `atteso <0.7, avuto ${mesoFactor}`);
});

test('il contesto e\' davvero contestuale: stesso esperto, contesto diverso, non si contamina', () => {
  let s = initExpertBandit();
  const ctxA = expertContext('spesa', 'Bar', 'medio');
  const ctxB = expertContext('ristorazione', 'a'.repeat(50), 'minimo');
  for (let i = 0; i < 15; i++) s = observeExpertOutcome(s, { context: ctxA, source: 'nano', correct: true });
  // nano non ha MAI votato nel contesto B: deve restare neutro li'
  assert.equal(expertWeightFactor(s, ctxB, 'nano'), 1.0);
  assert.ok(expertWeightFactor(s, ctxA, 'nano') > 1.0);
});

test('observeExpertOutcome accetta stato null/vuoto senza esplodere', () => {
  const ctx = expertContext('spesa', 'Bar', 'medio');
  const s = observeExpertOutcome(null, { context: ctx, source: 'nano', correct: true });
  assert.ok(expertWeightFactor(s, ctx, 'nano') > 1.0);
});
