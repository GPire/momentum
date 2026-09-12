import test from 'node:test';
import assert from 'node:assert/strict';
import { olsWithSE, directEffect } from './causal-effects.js';

test('HAC intercept uncertainty agrees with a hand-calculated Bartlett lag-one example', () => {
  const r = olsWithSE([1, 2, 3, 4, 5, 6], [], { hacLag: 1 });
  assert.ok(Math.abs(r.seHac[0] ** 2 - 0.875) < 1e-10);
  assert.equal(r.hacLag, 1);
  assert.ok(r.seHac[0] > r.se[0]);
});

test('invalid or misaligned observations are rejected, never silently truncated', () => {
  for (const [y, X] of [[[1, 2, NaN, 4], []], [[1, 2, 3, 4], [[1, 2]]],
    [[1, 2, 3, 4], [[1, 2, 3, 4, 5]]], [[1, 2, 3, Infinity], []]]) {
    assert.equal(olsWithSE(y, X), null);
  }
  assert.equal(olsWithSE([1, 2, 3, 4], [], { hacLag: 4 }), null);
});

test('causal effect never reports narrower uncertainty than the classical fit', () => {
  const x = Array.from({ length: 120 }, (_, i) => Math.sin(i * 0.3));
  const y = x.map((v, i) => 2 * v + Math.cos(i * 0.07));
  const fit = olsWithSE(y, [x]);
  const effect = directEffect({ target: { B: y }, lagged: { 'A@1': x } }, {}, 'A@1', 'B');
  assert.equal(effect.uncertainty, 'max-classical-hac');
  assert.ok(effect.se + 0.00005 >= fit.se[1]);
  assert.ok(effect.se + 0.00005 >= fit.seHac[1]);
});
