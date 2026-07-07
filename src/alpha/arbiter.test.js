import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arbitrate, REGIME_WEIGHTS } from './arbiter.js';

const S = (v, g, m, r) => ({ value: { score: v }, growth: { score: g }, momentum: { score: m }, risk: { score: r } });

test('risk-on pesa più growth/momentum; risk-off più value/risk', () => {
  assert.ok(REGIME_WEIGHTS['risk-on'].momentum > REGIME_WEIGHTS['risk-off'].momentum);
  assert.ok(REGIME_WEIGHTS['risk-off'].risk > REGIME_WEIGHTS['risk-on'].risk);
});

test('asset forte in tutto → verdetto compra', () => {
  const r = arbitrate(S(0.9, 0.9, 0.85, 0.9), 'neutral');
  assert.equal(r.verdict, 'compra');
  assert.ok(r.score > 0.66);
});

test('Inversion: rischio di coda alto dimezza il punteggio', () => {
  const safe = arbitrate(S(0.9, 0.9, 0.9, 0.9), 'risk-on');
  const risky = arbitrate(S(0.9, 0.9, 0.9, 0.1), 'risk-on'); // stesso ma rischio pessimo
  assert.ok(risky.flags.inversion);
  assert.ok(risky.score < safe.score * 0.75);
});

test('lo stesso asset cambia verdetto col regime', () => {
  const growthy = S(0.4, 0.9, 0.9, 0.4); // molto growth/momentum, poco value/risk
  const on = arbitrate(growthy, 'risk-on').score;
  const off = arbitrate(growthy, 'risk-off').score;
  assert.ok(on > off, 'in risk-on questo asset vale di più che in risk-off');
});

test('astensione quando troppi fattori sono neutri per mancanza dati', () => {
  const r = arbitrate(S(0.5, 0.5, 0.5, 0.8), 'neutral');
  assert.equal(r.abstain, true);
  assert.equal(r.verdict, 'astengo');
});

test('output sempre spiegato', () => {
  const r = arbitrate(S(0.7, 0.6, 0.6, 0.7), 'neutral');
  assert.ok(typeof r.explanation === 'string' && r.explanation.length > 0);
});
