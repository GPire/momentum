import test from 'node:test';
import assert from 'node:assert/strict';
import { derivePriors, banditSeed, seedBanditState, testoConsiglio } from './onboarding-priors.js';

test('derivePriors: profili diversi → config diverse e sensate', () => {
  const cons = derivePriors('conservativo', 'breve');
  const aggr = derivePriors('aggressivo', 'lungo');
  assert.ok(cons.investFraction < aggr.investFraction, 'prudente investe meno');
  assert.ok(cons.emergencyMonths > aggr.emergencyMonths, 'prudente più cuscinetto');
  assert.ok(cons.riskFloor > aggr.riskFloor);
});

test('freno spese (aiAggression) predittivo da rischio E orizzonte', () => {
  // orizzonte breve → freno forte a prescindere dal rischio (protegge il breve)
  assert.equal(derivePriors('aggressivo', 'breve').aiAggression, 'predator');
  assert.equal(derivePriors('conservativo', 'lungo').aiAggression, 'predator', 'prudente = guardrail');
  // aggressivo + lungo → poche interruzioni (costruisci libero)
  assert.equal(derivePriors('aggressivo', 'lungo').aiAggression, 'zen');
  // caso equilibrato
  assert.equal(derivePriors('bilanciato', 'medio').aiAggression, 'advisor');
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

// ── liquidityMonths (domanda 1 dell'onboarding): vince sul valore derivato dal rischio ──

test('derivePriors: senza liquidityMonths, emergencyMonths resta quello derivato dal rischio (comportamento invariato)', () => {
  const d = derivePriors('bilanciato', 'medio');
  assert.equal(d.emergencyMonths, 6);
  assert.equal(d.cashflowStress, null);
  assert.equal(d.liquidityMonths, null);
});

test('derivePriors: la liquidità reale dichiarata VINCE su quella derivata dal rischio', () => {
  const d = derivePriors('conservativo', 'medio', 1); // derivato sarebbe 9, dichiara 1
  assert.equal(d.emergencyMonths, 1);
  assert.equal(d.liquidityMonths, 1);
  assert.equal(d.cashflowStress, 'corto');
});

test('derivePriors: CONTRADDIZIONE dichiarata — profilo aggressivo ma liquidità corta attiva comunque il freno protettivo', () => {
  const d = derivePriors('aggressivo', 'lungo', 0.5); // da solo sarebbe 'zen'
  assert.equal(d.aiAggression, 'predator', 'il bisogno reale vince sul profilo dichiarato');
  assert.equal(d.cashflowStress, 'corto');
});

test('derivePriors: liquidità ampia (12+ mesi) si dichiara "ampio", ma non forza zen da sola', () => {
  const d = derivePriors('conservativo', 'medio', 18);
  assert.equal(d.cashflowStress, 'ampio');
  assert.equal(d.emergencyMonths, 18);
});

test('derivePriors: liquidityMonths assente/non valida (null, undefined, negativa, NaN) non altera il comportamento derivato', () => {
  for (const v of [null, undefined, -1, NaN, 'boh']) {
    const d = derivePriors('bilanciato', 'medio', v);
    assert.equal(d.emergencyMonths, 6, `con liquidityMonths=${v}`);
    assert.equal(d.cashflowStress, null, `con liquidityMonths=${v}`);
  }
});

// ── invests (uscita esplicita "non investo"): ortogonale al rischio ──

test('derivePriors: invests=true (default) è invariato rispetto a prima', () => {
  const d = derivePriors('aggressivo', 'medio');
  assert.equal(d.invests, true);
  assert.equal(d.investFraction, 0.85);
});

test('derivePriors: invests=false azzera SOLO investFraction, budget/cuscinetto/freno restano quelli del profilo (chi non investe ha comunque bisogno di tutto il resto)', () => {
  const conRischio = derivePriors('aggressivo', 'medio', null, true);
  const senzaInvestimenti = derivePriors('aggressivo', 'medio', null, false);
  assert.equal(senzaInvestimenti.invests, false);
  assert.equal(senzaInvestimenti.investFraction, 0);
  assert.equal(senzaInvestimenti.monthlyBudget, conRischio.monthlyBudget);
  assert.equal(senzaInvestimenti.emergencyMonths, conRischio.emergencyMonths);
  assert.equal(senzaInvestimenti.aiAggression, conRischio.aiAggression);
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

// testoConsiglio: usata nel payoff visibile dell'onboarding — deve restare
// coerente con QUELLO CHE banditSeed() favorisce davvero, non una frase
// scritta a mano che potrebbe raccontare una storia diversa dal codice.
test('testoConsiglio: coerente con ciò che banditSeed() favorisce per ogni profilo', () => {
  const mean = (arm) => arm.a / (arm.a + arm.b);
  for (const risk of ['conservativo', 'aggressivo', 'bilanciato']) {
    const arms = banditSeed(risk);
    const sweep = mean(arms['ok:mid|sweep']), causal = mean(arms['ok:mid|causal']);
    const t = testoConsiglio(risk);
    if (risk === 'conservativo') { assert.ok(sweep > causal); assert.match(t, /risparmio/); }
    if (risk === 'aggressivo') { assert.ok(causal > sweep); assert.match(t, /ottimizzare/); }
    if (risk === 'bilanciato') { assert.equal(sweep, causal); assert.match(t, /equilibrati/); }
  }
});

test('testoConsiglio: input non valido → default bilanciato, mai un crash', () => {
  assert.match(testoConsiglio('boh'), /equilibrati/);
  assert.match(testoConsiglio(), /equilibrati/);
});
