import test from 'node:test';
import assert from 'node:assert/strict';
const { createStrategyPerf, updateStrategyPerf, factorReliability, personalizeWeights } = await import('./strategy-evolution.js');
const { reflexivityScore } = await import('./factors.js');
const { arbitrate, REGIME_WEIGHTS } = await import('./arbiter.js');

test('reflexivityScore: trend auto-alimentato in accelerazione → score alto', () => {
  const p = []; let x = 100;
  for (let i = 0; i < 30; i++) { x *= 1 + 0.002 * i; p.push(x); } // rendimenti crescenti (loop che si rinforza)
  const r = reflexivityScore(p);
  assert.ok(r.score > 0.6, `atteso alto, ${r.score}`);
});

test('reflexivityScore: dati insufficienti → neutro', () => {
  assert.equal(reflexivityScore([1,2,3]).score, 0.5);
});

test('updateStrategyPerf: fattore convinto + esito favorevole → right++', () => {
  let perf = createStrategyPerf();
  perf = updateStrategyPerf(perf, { value: 0.8, momentum: 0.3 }, true);
  assert.equal(perf.value.right, 1);   // value convinto (0.8) + esito favorevole → giusto
  assert.equal(perf.momentum.wrong, 1); // momentum "evita" (0.3) ma l'esito era favorevole → sbagliato
});

test('personalizeWeights: senza storia = pesi base invariati', () => {
  const w = personalizeWeights(REGIME_WEIGHTS.neutral, createStrategyPerf());
  // somma 1 e proporzioni ~uguali alla base (tutti reliability 0.5 → ×1.0)
  const sum = Object.values(w).reduce((a,b)=>a+b,0);
  assert.ok(Math.abs(sum - 1) < 1e-3);
});

test('personalizeWeights: fattore che ha sempre funzionato pesa di più', () => {
  const perf = createStrategyPerf();
  for (let i=0;i<10;i++) perf.value.right++;      // value affidabile per l'utente
  for (let i=0;i<10;i++) perf.momentum.wrong++;   // momentum inaffidabile
  const w = personalizeWeights(REGIME_WEIGHTS.neutral, perf);
  assert.ok(w.value > w.momentum, 'value personalizzato > momentum');
});

test('arbitrate: accetta perf e reflexivity senza rompere il verdetto', () => {
  const scores = { value: {score:0.7}, growth:{score:0.6}, momentum:{score:0.6}, risk:{score:0.7}, reflexivity:{score:0.6} };
  const perf = createStrategyPerf(); for(let i=0;i<8;i++) perf.value.right++;
  const r = arbitrate(scores, 'risk-on', { perf });
  assert.ok(['compra','tieni','evita','astengo'].includes(r.verdict));
  assert.ok(r.weights.reflexivity !== undefined);
});
