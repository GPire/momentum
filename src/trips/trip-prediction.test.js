import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateTripPredictions } from './trip-prediction.js';
import { tripPredictionCopy } from '../i18n/trip-prediction.js';
const rows = amounts => amounts.map((amount, i) => ({ id: `e${i}`, businessTripId: 't', amount, currency: 'EUR', tripCategory: 'vitto', date: `2026-09-${String(i + 1).padStart(2, '0')}` }));

test('measurement guidance is present in all seven supported languages', () => {
  for (const lang of ['it','en','de','fr','es','nl','pt']) {
    assert.equal(tripPredictionCopy(lang).length, 6);
    assert.ok(tripPredictionCopy(lang).every(text => typeof text === 'string' && text.length > 0));
  }
});

test('only earlier days train a prediction; future values cannot change earlier results', () => {
  const input = rows([20, 20, 20, 20, 20, 90]);
  const result = evaluateTripPredictions(input);
  assert.equal(result.predictions.length, 1);
  assert.equal(result.predictions[0].expected, 20);
  assert.equal(result.predictions[0].unusual, true);
  assert.deepEqual(evaluateTripPredictions([...input, ...rows([999]).map(r => ({ ...r, id: 'future', date: '2026-10-01' }))]).predictions[0], result.predictions[0]);
  assert.deepEqual(evaluateTripPredictions([...input].reverse()), result);
});
test('no pooling across currencies, categories or private spending', () => {
  const input = rows([20, 20, 20, 20, 20, 90]);
  for (const patch of [{ currency: 'USD' }, { tripCategory: 'trasporto' }, { tripPersonal: true }, { businessTripId: null }]) {
    assert.equal(evaluateTripPredictions(input.map((r, i) => i === 5 ? { ...r, ...patch } : r)).predictions.length, 0);
  }
});
test('same-day rows, duplicates and invalid values cannot inflate history', () => {
  const input = rows([20, 20, 20, 20, 20, 90]);
  assert.equal(evaluateTripPredictions(input.map(r => ({ ...r, date: '2026-09-01' }))).predictions.length, 0);
  assert.equal(evaluateTripPredictions(input.map(r => ({ ...r, id: 'duplicate' }))).predictions.length, 0);
  for (const amount of [NaN, Infinity, -10, '20']) assert.equal(evaluateTripPredictions(input.map((r,i) => i === 0 ? {...r,amount} : r)).predictions.length, 0);
});
test('errors compare a robust estimate and an honest mean baseline on identical held-out cases', () => {
  const result = evaluateTripPredictions(rows([20, 20, 20, 20, 100, 20]));
  assert.equal(result.metrics[0].cases, 1);
  assert.equal(result.metrics[0].mae, 0);
  assert.equal(result.metrics[0].baselineMae, 16);
  assert.equal(result.metrics[0].currency, 'EUR');
  assert.equal(result.mode, 'historical-replay');
});
