import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectRegime } from './regime.js';

test('trend rialzista e vol normale → risk-on', () => {
  const p = Array.from({ length: 40 }, (_, i) => 100 * (1 + 0.004) ** i);
  assert.equal(detectRegime(p).regime, 'risk-on');
});

test('trend ribassista → risk-off', () => {
  const p = Array.from({ length: 40 }, (_, i) => 100 * (1 - 0.004) ** i);
  assert.equal(detectRegime(p).regime, 'risk-off');
});

test('volatilità in forte aumento → risk-off anche senza trend', () => {
  const calm = Array.from({ length: 25 }, (_, i) => 100 + (i % 2 ? 0.1 : -0.1));
  const spike = Array.from({ length: 15 }, (_, i) => 100 + (i % 2 ? 6 : -6));
  assert.equal(detectRegime([...calm, ...spike]).regime, 'risk-off');
});

test('dati insufficienti → neutral', () => {
  assert.equal(detectRegime([1, 2, 3]).regime, 'neutral');
});
