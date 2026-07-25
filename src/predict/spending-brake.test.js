import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateBrake } from './spending-brake.js';

test('importo zero o assente → nessun freno', () => {
  assert.equal(evaluateBrake('advisor', { amount: 0 }).level, 'ok');
});

test('i 3 modi si comportano DAVVERO in modo diverso sulla stessa spesa', () => {
  const ctx = { amount: 30, safeToday: 25, budget: 1500 };
  const zen = evaluateBrake('zen', ctx).level;
  const adv = evaluateBrake('advisor', ctx).level;
  const pred = evaluateBrake('predator', ctx).level;
  // predator interviene, zen no (stessa spesa) → la scelta CAMBIA qualcosa
  assert.equal(pred !== 'ok', true, 'predator interviene');
  assert.equal(zen, 'ok', 'zen lascia correre una spesa moderata');
  assert.notEqual(pred, zen, 'predator e zen differiscono');
  assert.ok(['ok', 'nudge', 'warn'].includes(adv));
});

test('segnale PREDITTIVO: se la spesa fa chiudere il mese in rosso → avviso motivazionale', () => {
  const r = evaluateBrake('advisor', { amount: 100, monthEndDelta: 40, budget: 1500 });
  assert.equal(r.level, 'warn');
  assert.match(r.message, /il mese chiude a −/);
  assert.match(r.message, /resti più in pari/); // azionabile, non paura
});

test('messaggio è motivazionale/onesto: mai "bloccato"', () => {
  const msgs = [
    evaluateBrake('predator', { amount: 200, safeToday: 20, budget: 1500 }).message,
    evaluateBrake('advisor', { amount: 100, monthEndDelta: 40, budget: 1500 }).message,
  ];
  for (const m of msgs) assert.doesNotMatch(m.toLowerCase(), /bloccat|vietat|non puoi/);
});

test('più del solito per la categoria (importo tipico appreso)', () => {
  const r = evaluateBrake('advisor', { amount: 50, typical: 12, budget: 1500 });
  assert.equal(r.level, 'nudge');
  assert.match(r.message, /del solito/);
});

test('safe-to-spend: nudge informa quanto resta, warn su spesa eccessiva', () => {
  const nudge = evaluateBrake('advisor', { amount: 30, safeToday: 25, budget: 1500 });
  assert.equal(nudge.level, 'nudge');
  assert.match(nudge.message, /ti restano|oltre/);
  const warn = evaluateBrake('advisor', { amount: 60, safeToday: 25, budget: 1500 });
  assert.equal(warn.level, 'warn');
});

test('senza segnali (no safe, no proiezione) frena solo su importi enormi', () => {
  assert.equal(evaluateBrake('advisor', { amount: 100, budget: 1500 }).level, 'ok');
  assert.equal(evaluateBrake('advisor', { amount: 800, budget: 1500 }).level, 'nudge');
});
