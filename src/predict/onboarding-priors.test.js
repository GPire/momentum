import test from 'node:test';
import assert from 'node:assert/strict';
import { derivePriors, banditSeed, seedBanditState } from './onboarding-priors.js';

test('derivePriors: profili diversi → config diverse e sensate', () => {
  const cons = derivePriors('conservativo', 'breve');
  const aggr = derivePriors('aggressivo', 'lungo');
  assert.ok(cons.investFraction < aggr.investFraction, 'prudente investe meno');
  assert.ok(cons.emergencyMonths > aggr.emergencyMonths, 'prudente più cuscinetto');
  assert.ok(cons.riskFloor > aggr.riskFloor);
  assert.equal(aggr.aiAggression, 'zen', 'aggressivo = meno interruzioni');
});

test('derivePriors: orizzonte breve alza i mesi di emergenza', () => {
  assert.ok(derivePriors('bilanciato', 'breve').emergencyMonths > derivePriors('bilanciato', 'lungo').emergencyMonths);
});

test('derivePriors: input non validi → default bilanciato/medio', () => {
  const d = derivePriors('boh', 'chissa');
  assert.equal(d.risk, 'bilanciato');
  assert.equal(d.horizon, 'medio');
  assert.equal(d.monthlyBudget, 1500);
});

test('banditSeed: prudente favorisce "sweep" (risparmio), aggressivo "causal"', () => {
  const cons = banditSeed('conservativo');
  const aggr = banditSeed('aggressivo');
  // media a posteriori a/(a+b) del kind favorito deve essere > dell'altro
  const mean = (arm) => arm.a / (arm.a + arm.b);
  assert.ok(mean(cons['ok:mid|sweep']) > mean(cons['ok:mid|causal']), 'prudente → sweep');
  assert.ok(mean(aggr['ok:mid|causal']) > mean(aggr['ok:mid|sweep']), 'aggressivo → causal');
  // priori DEBOLI: mai oltre ~0.62 (i dati reali li superano subito)
  assert.ok(mean(cons['ok:mid|sweep']) < 0.65, 'prior debole, non forzante');
});

test('seedBanditState: semina solo bracci vuoti, NON tocca quelli appresi', () => {
  const learned = { version: 1, arms: { 'ok:mid|sweep': { a: 8, b: 2 } } }; // dato reale
  const out = seedBanditState(learned, 'conservativo');
  assert.deepEqual(out.arms['ok:mid|sweep'], { a: 8, b: 2 }, 'il braccio appreso resta intatto');
  assert.ok(out.arms['over:mid|sweep'], 'i bracci vuoti vengono seminati');
});

test('seedBanditState: da stato vuoto/nullo produce uno stato valido seminato', () => {
  const out = seedBanditState(null, 'aggressivo');
  assert.equal(out.version, 1);
  assert.ok(Object.keys(out.arms).length > 0);
});
